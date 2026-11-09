"""Independent 20-session Kronos inference. Original one-session runtime is unchanged."""
import argparse
import hashlib
import json
import math
import os
import random
import gzip
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import ROOT, prepare, input_window, signature, raw_signature, valid_bar, load_runtime, save
from future_cache import CausalCache

HORIZON = 20

def validate_future_rows(rows):
    """All original closes must be usable; other finite OHLC values stay unmodified.

    Invalid open/high/low bars cannot be drawn as candles, but must not discard
    otherwise valid original closing paths from the distribution.
    """
    if len(rows)!=HORIZON or any(not isinstance(b.get(k),(int,float)) or isinstance(b.get(k),bool) or not math.isfinite(b[k]) for b in rows for k in ['open','high','low','close']):
        raise ValueError('模型輸出含缺值、非有限值或不完整路徑，不補造價格')
    if any(b['close']<=0 for b in rows):
        raise ValueError('模型收盤路徑含非正值，不列模擬占比；不刪除路徑或補造價格')

def display_signature(paths, candle_path):
    h=2166136261
    values=[v for path in paths for v in path]
    values.append(candle_path['sampleIndex'] if candle_path else -1)
    if candle_path:
        values.extend(b[k] for b in candle_path['bars'] for k in ['open','high','low','close'])
    for value in values:
        for byte in struct.pack('>d',float(value)):
            h=((h^byte)*16777619)&0xffffffff
    return f'{h:08x}'

def pack_forecast(raw):
    paths=[[b['close'] for b in p] for p in raw['samples']]
    def median(values):
        values=sorted(values);n=len(values)
        return (values[(n-1)//2]+values[n//2])/2
    medians=[median([p[i] for p in paths]) for i in range(HORIZON)]
    valid=[i for i,p in enumerate(raw['samples']) if all(valid_bar(b) for b in p)]
    selected=min(valid,key=lambda i:sum(((v-medians[j])/medians[j])**2 for j,v in enumerate(paths[i]))) if valid else None
    candle_path=None if selected is None else {'sampleIndex':selected,'bars':raw['samples'][selected]}
    result={k:v for k,v in raw.items() if k!='samples'}
    result.update(representation='CLOSE_PATHS_AND_ONE_RAW_CANDLE_PATH',closePaths=paths,candlePath=candle_path)
    result['execution']={**raw['execution'],'displaySignature':display_signature(paths,candle_path)}
    return result

def prepare_future(source, calendar):
    bars, _ = prepare(source, calendar)
    dates = calendar.get('dates', [])
    if dates != sorted(set(dates)):
        raise ValueError('交易日曆含重複或倒序日期')
    future = [d for d in dates if d > source['closeDate']][:HORIZON]
    if len(future) != HORIZON:
        raise ValueError('未來20個正式交易日尚未完整核對，不以平日補足')
    if source.get('corporateActionUnresolved') or source.get('priceAdjustmentConsistent') is False:
        raise ValueError('價格基準尚未釐清，不執行20日推論')
    return bars, future

def infer_future(predictor, lock, receipt, source, calendar, code, sample_count=150, batch_size=30, seed=87220):
    import numpy as np
    import pandas as pd
    import torch
    bars, future = prepare_future(source, calendar)
    if not 20 <= sample_count <= 150 or not 1 <= batch_size <= 150:
        raise ValueError('取樣數或批次大小不合法')
    started_at = datetime.now(timezone.utc).isoformat()
    started = time.monotonic()
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    frame = pd.DataFrame(bars)
    columns = ['open','high','low','close','volume'] + (['amount'] if 'amount' in frame else [])
    x = pd.to_datetime(frame['date']); y = pd.Series(pd.to_datetime(future))
    samples = []
    with torch.inference_mode(), CausalCache(predictor.model).install() as cached:
        for offset in range(0, sample_count, batch_size):
            cached.reset()
            count = min(batch_size, sample_count-offset)
            outputs = predictor.predict_batch([frame[columns]]*count,[x]*count,[y]*count,
                pred_len=HORIZON,T=1.0,top_p=.9,sample_count=1,verbose=False)
            if len(outputs) != count:
                raise ValueError('模型回傳路徑數不足')
            for output in outputs:
                if [d.strftime('%Y-%m-%d') for d in output.index] != future:
                    raise ValueError('模型輸出交易日不一致')
                rows=output[['open','high','low','close']].to_dict(orient='records')
                validate_future_rows(rows)
                samples.append(rows)
            print('FUTURE_PROGRESS',code,len(samples),sample_count,round(time.monotonic()-started,2),flush=True)
    invalid=sum(not valid_bar(b) for p in samples for b in p)
    valid_paths=sum(all(valid_bar(b) for b in p) for p in samples)
    tensor=np.asarray([[b[k] for k in ['open','high','low','close','volume']]+[b.get('amount',b['volume']*sum(b[k] for k in ['open','high','low','close'])/4)] for b in bars],dtype=np.float32)
    generated=datetime.now(timezone.utc).isoformat()
    elapsed=round(time.monotonic()-started,3)
    result={'schema':'shitou-kronos-future-v1','kind':'KRONOS_FUTURE_INFERENCE','symbol':code,
        'market':'TWSE_INDEX' if code=='TAIEX' else source['market'],'asOf':source['closeDate'],
        'frequency':'1d','horizonTradingDays':HORIZON,'historySignature':signature(bars),
        'targetDates':future,'samples':samples,'sampleCount':sample_count,**lock,'calendar':calendar,
        'generatedAt':generated,'parameters':{'temperature':1.0,'top_p':.9,'seed':seed,'lookback':len(bars),'sample_count_per_row':1,'batchSize':batch_size},
        'outputQuality':{'rawSamplesPreserved':True,'invalidOhlcCount':invalid,'validOhlcPathCount':valid_paths,
            'candlesPolicy':'ONE_INTACT_VALID_PATH_CLOSEST_TO_POINTWISE_MEDIANS','distributionPolicy':'ALL_ORIGINAL_POSITIVE_CLOSE_SAMPLES'},
        'inputQuality':{'priceBasis':source['priceAdjustment'].get('basis'),'corporateActionsVerified':source['priceAdjustment'].get('corporateActionsVerified'),
            'window':{k:v for k,v in input_window(source['dailySeries']).items() if k!='bars'},'amountMode':'OFFICIAL' if 'amount' in frame else 'UPSTREAM_VOLUME_OHLC_PROXY'},
        'runtimeSeconds':elapsed,'performanceValidated':False,'calibratedWinProbability':None,'useForAutomaticOrders':False}
    runtime_hash=hashlib.sha256(Path(__file__).read_bytes()+Path(__file__).with_name('future_cache.py').read_bytes()).hexdigest()
    result['execution']={**receipt,'schema':'kronos-future-execution-v1','horizonTradingDays':HORIZON,
        'runtimeSHA256':runtime_hash,'baseRuntimeSHA256':receipt['runtimeSHA256'],'inferenceAlgorithm':'CAUSAL_KV_CACHE_1',
        'completed':True,'startedAt':started_at,'completedAt':generated,'symbol':code,'asOf':source['closeDate'],
        'targetDates':future,'inputLastDate':bars[-1]['date'],'inputCutoff':source['closeDate']+'T13:30:00+08:00',
        'historySignature':result['historySignature'],'inputTensorSHA256':hashlib.sha256(tensor.tobytes()).hexdigest(),
        'sampleCount':sample_count,'sampleCountPerRow':1,'seed':seed,'rawSamplesSignature':raw_signature(samples),
        'rawSamplesSHA256':hashlib.sha256(json.dumps(samples,separators=(',',':'),allow_nan=False).encode()).hexdigest(),
        'runtimeSeconds':elapsed,'mode':'LIVE_POST_CLOSE_20D'}
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source');p.add_argument('--output');p.add_argument('--calendar');p.add_argument('--codes',default='');p.add_argument('--all',action='store_true');p.add_argument('--index',action='store_true')
    p.add_argument('--samples',type=int,default=150);p.add_argument('--batch-size',type=int,default=30);p.add_argument('--threads',type=int,default=2)
    p.add_argument('--shard',type=int,default=0);p.add_argument('--shards',type=int,default=1)
    args=p.parse_args()
    if not 0<=args.shard<args.shards<=64:p.error('invalid shards')
    predictor,lock,receipt=load_runtime('cpu',args.threads)
    if args.source:
        source=json.loads(Path(args.source).read_text());code=source.get('stock') or source.get('instrumentType')
        cal=json.loads(Path(args.calendar).read_text()) if args.calendar else source['tradingCalendar']
        cal=cal.get('tradingCalendar',cal)
        result=infer_future(predictor,lock,receipt,source,cal,code,args.samples,args.batch_size)
        save(Path(args.output),result);print('FUTURE_SAVED',args.output,result['runtimeSeconds'],flush=True);return
    manifest=json.loads((ROOT/'data/research/manifest.json').read_text());calendar=json.loads((ROOT/'data/kronos/calendar.json').read_text())
    codes=(sorted(manifest['stocks']) if args.all else [c for c in args.codes.split(',') if c])[args.shard::args.shards]
    jobs=[]
    if args.index and args.shard==0:jobs.append(('TAIEX',ROOT/'data/index/TAIEX.json'))
    for code in codes:
        e=manifest['stocks'].get(code)
        if e and e.get('ready'):jobs.append((code,ROOT/'data/research'/e['path']))
    records=[]
    for code,file in jobs:
        try:
            source=json.loads(file.read_text());cal=source['tradingCalendar'] if code=='TAIEX' else calendar
            result=infer_future(predictor,lock,receipt,source,cal,code,args.samples,args.batch_size)
            save(ROOT/'data/kronos-future'/('TAIEX.json' if code=='TAIEX' else 'stocks/'+code+'.json'),pack_forecast(result))
            raw_path=ROOT/'data/kronos-future/raw'/(code+'.json.gz');raw_path.parent.mkdir(parents=True,exist_ok=True)
            raw_path.write_bytes(gzip.compress(json.dumps(result,separators=(',',':'),allow_nan=False).encode(),mtime=0))
            records.append({'code':code,'state':'SUCCESS','asOf':source['closeDate'],'seconds':result['runtimeSeconds']})
        except Exception as e:
            records.append({'code':code,'state':'UNAVAILABLE','reason':str(e)});print('FUTURE_UNAVAILABLE',code,str(e),flush=True)
    save(ROOT/'data/kronos-future'/f'status-{args.shard}.json',{'schema':'kronos-future-status-v1','results':records,**lock})
    if not records:raise SystemExit('No future jobs')

if __name__=='__main__':main()
