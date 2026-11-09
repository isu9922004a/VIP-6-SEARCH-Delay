"""Replay the original pinned inference unchanged; inspect every original OHLC channel.

Diagnostic artifacts only. Never publishes forecasts, repairs prices or drops paths.
"""
import argparse, hashlib, json, math, random, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'kronos'))
from run import ROOT, load_runtime, signature
from future import prepare_future, infer_future, pack_forecast
from future_cache import CausalCache

def main():
    import numpy as np
    import pandas as pd
    import torch
    p=argparse.ArgumentParser();p.add_argument('--shard',type=int,default=0);p.add_argument('--shards',type=int,default=2);p.add_argument('--output',required=True);p.add_argument('--verify-fixed',action='store_true');args=p.parse_args()
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    catalog=json.loads((ROOT/'data/kronos-future/manifest.json').read_text());history=json.loads((ROOT/'data/research/manifest.json').read_text());calendar=json.loads((ROOT/'data/kronos/calendar.json').read_text())
    assert catalog['asOf']==history['date']
    codes=sorted(code for code,reason in catalog['unavailable'].items() if history['stocks'][code]['ready'] and '模型輸出含缺值' in reason)[args.shard::args.shards]
    # A known successful target independently proves replayed raw samples are identical.
    control=next(code for code in sorted(catalog['instruments']) if code!='TAIEX')
    if args.shard==0:codes=[control]+codes
    predictor,lock,receipt=load_runtime('cpu',2);results=[]
    for code in codes:
        source=json.loads((ROOT/'data/research'/history['stocks'][code]['path']).read_text());bars,dates=prepare_future(source,calendar)
        random.seed(87220);np.random.seed(87220);torch.manual_seed(87220)
        frame=pd.DataFrame(bars);columns=['open','high','low','close','volume']+(['amount'] if 'amount' in frame else []);x=pd.to_datetime(frame['date']);y=pd.Series(pd.to_datetime(dates));samples=[]
        with torch.inference_mode(),CausalCache(predictor.model).install() as cached:
            for offset in range(0,150,30):
                cached.reset();outputs=predictor.predict_batch([frame[columns]]*30,[x]*30,[y]*30,pred_len=20,T=1.0,top_p=.9,sample_count=1,verbose=False)
                assert len(outputs)==30
                for output in outputs:
                    assert [d.strftime('%Y-%m-%d') for d in output.index]==dates
                    samples.append(output[['open','high','low','close']].to_dict(orient='records'))
        assert len(samples)==150 and all(len(p)==20 for p in samples)
        issues={k:[] for k in ['open','high','low','close']}
        for i,route in enumerate(samples):
            for day,b in enumerate(route):
                for key in issues:
                    value=b[key]
                    if not isinstance(value,(int,float)) or not math.isfinite(value) or value<=0:issues[key].append({'sample':i,'day':day+1,'value':value if isinstance(value,(int,float)) and math.isfinite(value) else repr(value)})
        finite=all(isinstance(b[k],(int,float)) and math.isfinite(b[k]) for route in samples for b in route for k in issues)
        digest=hashlib.sha256(json.dumps(samples,separators=(',',':'),allow_nan=False).encode()).hexdigest() if finite else None
        control_match=None
        if code==control:
            original=json.loads((ROOT/'data/kronos-future'/catalog['instruments'][code]['path']).read_text());control_match=digest==original['execution']['rawSamplesSHA256'];assert control_match,'Diagnostic replay differs from published pinned inference'
        result={'code':code,'name':source['name'],'date':source['closeDate'],'sampleCount':150,'horizon':20,'badChannels':{k:len(v) for k,v in issues.items()},'examples':{k:v[:3] for k,v in issues.items()},'allOhlcFinite':finite,'allClosesPositive':not issues['close'],'historySignature':signature(bars),'rawSamplesSHA256':digest,'controlMatchesPublished':control_match}
        if args.verify_fixed:
            if finite and not issues['close']:
                actual=infer_future(predictor,lock,receipt,source,calendar,code,150,30)
                assert actual['samples']==samples and actual['execution']['rawSamplesSHA256']==digest,'Fix changed raw samples'
                packed=pack_forecast(actual);assert len(packed['closePaths'])==150
                assert packed['closePaths']==[[b['close'] for b in route] for route in samples]
                (out/(code+'-fixed-model.json')).write_text(json.dumps(packed,separators=(',',':'),allow_nan=False))
                result['fixedStatus']='READY_WITH_ALL_ORIGINAL_CLOSES'
            else:
                try:infer_future(predictor,lock,receipt,source,calendar,code,150,30)
                except ValueError as e:result['fixedStatus']='BLOCKED_INVALID_CLOSE';result['fixedReason']=str(e)
                else:raise AssertionError('Invalid closes were accepted')
        if finite:(out/(code+'-original-samples.json')).write_text(json.dumps(samples,separators=(',',':'),allow_nan=False))
        results.append(result);print('FUTURE_OUTPUT_DIAG '+json.dumps(result,ensure_ascii=False),flush=True)
    (out/'diagnosis.json').write_text(json.dumps({'diagnosticOnly':True,'receipt':receipt,'results':results},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
