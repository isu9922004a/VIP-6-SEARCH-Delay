"""Pinned Kronos inference. Publish real samples only; never substitute synthetic forecasts."""
import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMIT = '67b630e67f6a18c9e9be918d9b4337c960db1e9a'


def signature(bars):
    text = '\n'.join(','.join([b['date']] + [f"{float(b.get(k, 0)):.6f}" for k in ('open', 'high', 'low', 'close', 'volume', 'amount')]) for b in bars)
    h = 2166136261
    for c in text:
        h = ((h ^ ord(c)) * 16777619) & 0xffffffff
    return f'{h:08x}'


def prepare(source, calendar):
    bars = source.get('dailySeries', [])[-160:]
    as_of = source['closeDate']
    if source.get('completed') is not True or len(bars) < 63 or not source.get('priceAdjustment', {}).get('verified'):
        raise ValueError('完成日K、價格基準或63根歷史未核驗')
    if source.get('volumeUnit') != 'shares':
        raise ValueError('量能單位未核對')
    for i, b in enumerate(bars):
        if not all(isinstance(b.get(k), (int, float)) and math.isfinite(b[k]) and b[k] > 0 for k in ('open', 'high', 'low', 'close')):
            raise ValueError('OHLC缺值或非正值')
        if b['low'] > min(b['open'], b['close']) or b['high'] < max(b['open'], b['close']) or (i and b['date'] <= bars[i - 1]['date']):
            raise ValueError('OHLC或日期順序錯誤')
        if i and abs(b['open'] / bars[i - 1]['close'] - 1) > .30:
            raise ValueError('超過30%的價格斷點，需先處理公司行動或錯誤資料')
    if not calendar.get('verified') or not calendar.get('source') or bars[-1]['date'] != as_of:
        raise ValueError('交易日曆或截止日未對齊')
    expected = [d for d in calendar['dates'] if bars[0]['date'] <= d <= as_of]
    if expected != [b['date'] for b in bars]:
        raise ValueError('歷史交易日缺漏或日曆不符，不補造價格')
    future = [d for d in calendar['dates'] if d > as_of][:1]
    if len(future) != 1:
        raise ValueError('下一交易日未確認')
    return bars, future


def valid_bar(b):
    return all(math.isfinite(b[k]) and b[k] > 0 for k in ('open', 'high', 'low', 'close')) and b['low'] <= min(b['open'], b['close']) and b['high'] >= max(b['open'], b['close'])


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')
    temp.replace(path)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--codes', default='1569,2330,8039')
    p.add_argument('--all', action='store_true')
    p.add_argument('--index', action='store_true')
    p.add_argument('--samples', type=int, default=32)
    p.add_argument('--seed', type=int, default=83001)
    p.add_argument('--threads', type=int, default=4)
    p.add_argument('--device', default='cpu')
    p.add_argument('--shard', type=int, default=0)
    p.add_argument('--shards', type=int, default=1)
    args = p.parse_args()
    if not 20 <= args.samples <= 128:
        p.error('samples must be 20..128')
    if not 0 <= args.shard < args.shards <= 64:
        p.error('invalid shard range')
    import numpy as np
    import pandas as pd
    import torch
    from huggingface_hub import HfApi, snapshot_download
    torch.set_num_threads(max(1, min(args.threads, os.cpu_count() or 1)))
    sys.path.insert(0, str(ROOT / 'third_party' / 'kronos'))
    from model import Kronos, KronosTokenizer, KronosPredictor
    lock_path = ROOT / 'kronos' / 'model-lock.json'
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding='utf-8'))
    else:
        api = HfApi()
        lock = {'model': {'id': 'NeoQuasar/Kronos-small', 'revision': api.model_info('NeoQuasar/Kronos-small').sha},
                'tokenizer': {'id': 'NeoQuasar/Kronos-Tokenizer-base', 'revision': api.model_info('NeoQuasar/Kronos-Tokenizer-base').sha}, 'codeCommit': COMMIT}
        save(lock_path, lock)
    print('Loading pinned weights', lock['model']['revision'], flush=True)
    model = Kronos.from_pretrained(snapshot_download(lock['model']['id'], revision=lock['model']['revision'], allow_patterns=['config.json', 'model.safetensors']))
    tokenizer = KronosTokenizer.from_pretrained(snapshot_download(lock['tokenizer']['id'], revision=lock['tokenizer']['revision'], allow_patterns=['config.json', 'model.safetensors']))
    model.eval()
    tokenizer.eval()
    predictor = KronosPredictor(model, tokenizer, device=args.device, max_context=512)
    calendar = json.loads((ROOT / 'data/kronos/calendar.json').read_text(encoding='utf-8'))
    manifest = json.loads((ROOT / 'data/research/manifest.json').read_text(encoding='utf-8'))
    entries = manifest.get('stocks') or manifest.get('entries') or manifest.get('records')
    if not isinstance(entries, dict):
        # Manifest is inspected explicitly; no guesses about alternate instruments.
        entries = next((v for k, v in manifest.items() if isinstance(v, dict) and '1569' in v), {})
    codes = (sorted(entries) if args.all else [c.strip() for c in args.codes.split(',') if c.strip()])[args.shard::args.shards]
    jobs = []
    if args.index and args.shard == 0:
        jobs.append(('TAIEX', ROOT / 'data/index/TAIEX.json'))
    for code in codes:
        entry = entries.get(code)
        if entry and entry.get('ready'):
            jobs.append((code, ROOT / 'data/research' / entry['path']))
    started = time.monotonic()
    results = []
    for number, (code, file) in enumerate(jobs):
        try:
            source = json.loads(file.read_text(encoding='utf-8'))
            bars, future = prepare(source, calendar)
            random.seed(args.seed)
            np.random.seed(args.seed)
            torch.manual_seed(args.seed)
            df = pd.DataFrame(bars)
            columns = ['open', 'high', 'low', 'close', 'volume'] + (['amount'] if 'amount' in df else [])
            x = pd.to_datetime(df['date'])
            y = pd.Series(pd.to_datetime(future))
            before = time.monotonic()
            with torch.inference_mode():
                # One independent row per draw; sample_count=1 avoids averaging paths.
                outputs = predictor.predict_batch([df[columns]] * args.samples, [x] * args.samples, [y] * args.samples,
                    pred_len=1, T=1.0, top_p=.9, sample_count=1, verbose=False)
            samples = [frame[['open', 'high', 'low', 'close']].to_dict(orient='records') for frame in outputs]
            invalid = sum(not valid_bar(b) for path in samples for b in path)
            if any(not all(math.isfinite(b[k]) and b[k] > 0 for k in ('open','high','low','close')) for path in samples for b in path):
                raise ValueError('取樣含非有限或非正價格，不發布結果')
            is_index = source.get('instrumentType') == 'TAIEX'
            result = {'schema': 'shitou-kronos-v1', 'kind': 'KRONOS_INFERENCE', 'symbol': code,
                'market': 'TWSE_INDEX' if is_index else source['market'], 'asOf': source['closeDate'],
                'frequency': '1d', 'historySignature': signature(bars), 'targetDates': future, 'samples': samples,
                'sampleCount': args.samples, **lock, 'calendar': calendar, 'generatedAt': datetime.now(timezone.utc).isoformat(),
                'parameters': {'temperature': 1.0, 'top_p': .9, 'seed': args.seed, 'lookback': len(bars), 'sample_count_per_row': 1},
                'outputQuality': {'invalidOhlcCount': invalid, 'rawSamplesPreserved': True, 'use': 'OPEN_CLOSE_DISTRIBUTION_ONLY', 'warning': f'{invalid}/{args.samples}筆高低價順序不合理；保留全部收盤取樣，不顯示預測K棒。' if invalid else ''},
                'inputQuality': {'priceBasis': source['priceAdjustment'].get('basis'), 'corporateActionsVerified': source['priceAdjustment'].get('corporateActionsVerified'),
                    'amountMode': 'OFFICIAL' if 'amount' in df else 'UPSTREAM_VOLUME_OHLC_PROXY', 'warning': '' if is_index else '歷史採未還原成交價，公司行動尚未核驗，僅供研究。'},
                'performanceValidated': False, 'calibratedWinProbability': None, 'useForAutomaticOrders': False,
                'runtimeSeconds': round(time.monotonic() - before, 3), 'note': '真實Kronos取樣；尚未驗證台股績效，取樣占比不是實際勝率。'}
            output = ROOT / ('data/kronos/TAIEX.json' if is_index else f'data/kronos/stocks/{code}.json')
            save(output, result)
            results.append({'code': code, 'state': 'SUCCESS', 'asOf': source['closeDate'], 'seconds': result['runtimeSeconds']})
            print('PASS', code, result['runtimeSeconds'], flush=True)
        except Exception as e:
            results.append({'code': code, 'state': 'UNAVAILABLE', 'reason': str(e)})
            print('UNAVAILABLE', code, str(e), flush=True)
    status = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'modelRun': True, **lock, 'durationSeconds': round(time.monotonic() - started, 2),
              'successCount': sum(r['state'] == 'SUCCESS' for r in results), 'failedCount': sum(r['state'] != 'SUCCESS' for r in results), 'results': results}
    save(ROOT / ('data/kronos/status.json' if args.shards == 1 else f'data/kronos/status-{args.shard}.json'), status)
    print('RESULT', status['successCount'], status['failedCount'], status['durationSeconds'], flush=True)
    if not status['successCount']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
