"""Pinned Kronos inference. Publish real samples only; never substitute synthetic forecasts."""
import argparse
import json
import hashlib
import platform
import struct
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


def raw_signature(paths):
    h = 2166136261
    for path in paths:
        for bar in path:
            for key in ('open', 'high', 'low', 'close'):
                for byte in struct.pack('>d', float(bar[key])):
                    h = ((h ^ byte) * 16777619) & 0xffffffff
    return f'{h:08x}'



def input_window(rows):
    original = rows[-160:]
    breaks = []
    for i in range(1, len(original)):
        change = original[i]['open'] / original[i - 1]['close'] - 1
        if abs(change) > .30:
            breaks.append({'index': i, 'date': original[i]['date'], 'previousDate': original[i - 1]['date'],
                'previousClose': original[i - 1]['close'], 'open': original[i]['open'], 'changePct': change * 100})
    last = breaks[-1] if breaks else None
    return {'bars': original[last['index'] if last else 0:], 'cutoff': last['date'] if last else None,
        'breaks': breaks, 'originalBars': len(original), 'policy': 'POST_PRICE_BASIS_RESET_V1'}


def prepare(source, calendar):
    bars = source.get('dailySeries', [])[-160:]
    as_of = source['closeDate']
    if source.get('completed') is not True or len(bars) < 63 or not source.get('priceAdjustment', {}).get('verified'):
        raise ValueError('完成日K、價格基準或63根歷史未核驗')
    if source.get('volumeUnit') != 'shares':
        raise ValueError('量能單位未核對')
    if source.get('close') != bars[-1]['close']:
        raise ValueError('Source close mismatch')
    for i, b in enumerate(bars):
        if b.get('completed') is False or not isinstance(b.get('volume'), (int, float)) or not math.isfinite(b['volume']) or b['volume'] < 0:
            raise ValueError('Incomplete bar or invalid volume')
        if any('amount' in z for z in bars) and (not isinstance(b.get('amount'), (int, float)) or not math.isfinite(b['amount']) or b['amount'] < 0):
            raise ValueError('Partial or invalid amount channel')
        if not all(isinstance(b.get(k), (int, float)) and math.isfinite(b[k]) and b[k] > 0 for k in ('open', 'high', 'low', 'close')):
            raise ValueError('OHLC缺值或非正值')
        if b['low'] > min(b['open'], b['close']) or b['high'] < max(b['open'], b['close']) or (i and b['date'] <= bars[i - 1]['date']):
            raise ValueError('OHLC或日期順序錯誤')
    if not calendar.get('verified') or not calendar.get('source') or bars[-1]['date'] != as_of:
        raise ValueError('交易日曆或截止日未對齊')
    expected = [d for d in calendar['dates'] if bars[0]['date'] <= d <= as_of]
    if expected != [b['date'] for b in bars]:
        raise ValueError('歷史交易日缺漏或日曆不符，不補造價格')
    window = input_window(bars)
    bars = window['bars']
    if len(bars) < 63:
        raise ValueError(f"{window['cutoff']} 價格基準斷點後只有{len(bars)}根日線，尚需{63-len(bars)}根；不混用斷點前價格")
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


def load_runtime(device='cpu', threads=4):
    import numpy as np
    import pandas as pd
    import torch
    from huggingface_hub import HfApi, snapshot_download
    torch.set_num_threads(max(1, min(threads, os.cpu_count() or 1)))
    sys.path.insert(0, str(ROOT / 'third_party' / 'kronos'))
    from model import Kronos, KronosTokenizer, KronosPredictor
    lock_path = ROOT / 'kronos' / 'model-lock.json'
    lock = json.loads(lock_path.read_text(encoding='utf-8'))
    if lock.get('codeCommit') != COMMIT or any(not lock[k].get('revision') for k in ('model', 'tokenizer')):
        raise ValueError('Pinned model lock is required')
    print('Loading pinned weights', lock['model']['revision'], flush=True)
    model_path = snapshot_download(lock['model']['id'], revision=lock['model']['revision'], allow_patterns=['config.json', 'model.safetensors'])
    tokenizer_path = snapshot_download(lock['tokenizer']['id'], revision=lock['tokenizer']['revision'], allow_patterns=['config.json', 'model.safetensors'])
    model = Kronos.from_pretrained(model_path)
    tokenizer = KronosTokenizer.from_pretrained(tokenizer_path)
    model.eval()
    tokenizer.eval()
    predictor = KronosPredictor(model, tokenizer, device=device, max_context=512)
    def digest(path):
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''):
                h.update(block)
        return h.hexdigest()
    receipt = {'schema': 'kronos-execution-v86', 'backend': 'PYTORCH_KRONOS', 'simulation': False,
        'torchVersion': torch.__version__, 'pythonVersion': platform.python_version(), 'device': device,
        'modelWeightsSHA256': digest(Path(model_path) / 'model.safetensors'),
        'tokenizerWeightsSHA256': digest(Path(tokenizer_path) / 'model.safetensors'),
        'runtimeSHA256': digest(Path(__file__)), 'upstreamCodeSHA256': digest(ROOT / 'third_party/kronos/model/kronos.py'),
        'workflowRun': os.environ.get('GITHUB_RUN_ID'), 'repositoryCommit': os.environ.get('GITHUB_SHA'),
        'inputChannels': ['open', 'high', 'low', 'close', 'volume', 'amount'],
        'normalization': 'PER_WINDOW_FEATURE_MEAN_POPULATION_STD_PLUS_1E-5_CLIP_5',
        'inverseNormalization': 'DECODE_TIMES_STD_PLUS_1E-5_PLUS_MEAN',
        'horizonTradingDays': 1, 'sampleCountPerRow': 1}
    return predictor, lock, receipt


def infer(predictor, lock, receipt, source, calendar, code, sample_count=32, seed=83001, mode='LIVE_POST_CLOSE'):
    import numpy as np
    import pandas as pd
    import torch
    started_at = datetime.now(timezone.utc).isoformat()
    bars, future = prepare(source, calendar)
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    df = pd.DataFrame(bars)
    columns = ['open', 'high', 'low', 'close', 'volume'] + (['amount'] if 'amount' in df else [])
    x = pd.to_datetime(df['date'])
    y = pd.Series(pd.to_datetime(future))
    before = time.monotonic()
    with torch.inference_mode():
        # One independent row per draw; sample_count=1 avoids averaging paths.
        outputs = predictor.predict_batch([df[columns]] * sample_count, [x] * sample_count, [y] * sample_count,
            pred_len=1, T=1.0, top_p=.9, sample_count=1, verbose=False)
    samples = [frame[['open', 'high', 'low', 'close']].to_dict(orient='records') for frame in outputs]
    invalid = sum(not valid_bar(b) for path in samples for b in path)
    if any(not all(math.isfinite(b[k]) and b[k] > 0 for k in ('open','high','low','close')) for path in samples for b in path):
        raise ValueError('取樣含非有限或非正價格，不發布結果')
    is_index = source.get('instrumentType') == 'TAIEX'
    result = {'schema': 'shitou-kronos-v1', 'kind': 'KRONOS_INFERENCE', 'symbol': code,
        'market': 'TWSE_INDEX' if is_index else source['market'], 'asOf': source['closeDate'],
        'frequency': '1d', 'historySignature': signature(bars), 'targetDates': future, 'samples': samples,
        'sampleCount': sample_count, **lock, 'calendar': calendar, 'generatedAt': datetime.now(timezone.utc).isoformat(),
        'parameters': {'temperature': 1.0, 'top_p': .9, 'seed': seed, 'lookback': len(bars), 'sample_count_per_row': 1},
        'outputQuality': {'invalidOhlcCount': invalid, 'rawSamplesPreserved': True, 'use': 'OPEN_CLOSE_DISTRIBUTION_ONLY', 'warning': f'{invalid}/{sample_count}筆高低價順序不合理；保留全部收盤取樣，不顯示預測K棒。' if invalid else ''},
        'inputQuality': {'window': {k: v for k, v in input_window(source['dailySeries']).items() if k != 'bars'}, 'priceBasis': source['priceAdjustment'].get('basis'), 'corporateActionsVerified': source['priceAdjustment'].get('corporateActionsVerified'),
            'amountMode': 'OFFICIAL' if 'amount' in df else 'UPSTREAM_VOLUME_OHLC_PROXY', 'warning': '' if is_index else '歷史採未還原成交價，公司行動尚未核驗，僅供研究。'},
        'performanceValidated': False, 'calibratedWinProbability': None, 'useForAutomaticOrders': False,
        'runtimeSeconds': round(time.monotonic() - before, 3), 'note': '真實Kronos取樣；尚未驗證台股績效，取樣占比不是實際勝率。'}
    input_tensor = np.asarray([[b[k] for k in ('open','high','low','close','volume')] + [b.get('amount', b['volume'] * sum(b[k] for k in ('open','high','low','close')) / 4)] for b in bars], dtype=np.float32)
    execution = {**receipt, 'completed': True, 'startedAt': started_at, 'completedAt': result['generatedAt'],
        'symbol': code, 'asOf': source['closeDate'], 'targetDate': future[0], 'inputLastDate': bars[-1]['date'],
        'inputCutoff': source['closeDate'] + 'T13:30:00+08:00', 'historySignature': result['historySignature'],
        'inputTensorSHA256': hashlib.sha256(input_tensor.tobytes()).hexdigest(),
        'sampleCount': sample_count, 'seed': seed,
        'rawSamplesSignature': raw_signature(samples),
        'rawSamplesSHA256': hashlib.sha256(json.dumps(samples, separators=(',', ':'), allow_nan=False).encode()).hexdigest(),
        'runtimeSeconds': result['runtimeSeconds'], 'mode': mode}
    result['execution'] = execution
    result['inputQuality']['warning'] += ' Amount若無官方欄位，採上游OHLC均價乘成交股數代理，並非官方成交金額。' if 'amount' not in df else ''
    return result


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
    predictor, lock, receipt = load_runtime(args.device, args.threads)
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
            job_calendar = source.get('tradingCalendar', calendar) if code == 'TAIEX' else calendar
            result = infer(predictor, lock, receipt, source, job_calendar, code, args.samples, args.seed)
            is_index = source.get('instrumentType') == 'TAIEX'
            output = ROOT / ('data/kronos/TAIEX.json' if is_index else f'data/kronos/stocks/{code}.json')
            save(output, result)
            results.append({'code': code, 'state': 'SUCCESS', 'asOf': source['closeDate'], 'seconds': result['runtimeSeconds']})
            print('PASS', code, result['runtimeSeconds'], flush=True)
        except Exception as e:
            results.append({'code': code, 'state': 'UNAVAILABLE', 'reason': str(e)})
            print('UNAVAILABLE', code, str(e), flush=True)
    status = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'modelRun': any(r['state'] == 'SUCCESS' for r in results), **lock, 'durationSeconds': round(time.monotonic() - started, 2),
              'successCount': sum(r['state'] == 'SUCCESS' for r in results), 'failedCount': sum(r['state'] != 'SUCCESS' for r in results), 'results': results}
    save(ROOT / ('data/kronos/status.json' if args.shards == 1 else f'data/kronos/status-{args.shard}.json'), status)
    print('RESULT', status['successCount'], status['failedCount'], status['durationSeconds'], flush=True)
    if not status['successCount']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
