"""Retrospective prefix-only walk-forward; real pinned Kronos, never synthetic forecasts."""
import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'kronos'))
from run import load_runtime, infer, prepare, save

def policy_hash():
    paths = ['research-v86/market-config.js', 'research-v86/market-regime.js', 'research-v83/forecast-engine.js', 'scripts/backtest/v85-forecast.cjs', 'kronos/run.py', 'scripts/backtest/run-v86.py', 'scripts/backtest/score-v86.cjs']
    return hashlib.sha256('\n'.join(p + ':' + hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths).encode()).hexdigest()

def prefixes(source, calendar):
    bars = source['dailySeries']
    for n in range(63, len(bars) + 1):
        item = copy.deepcopy(source)
        item['dailySeries'] = bars[:n]
        item['closeDate'] = bars[n-1]['date']
        item['close'] = bars[n-1]['close']
        item['dailySeriesMeta'] = {**item['dailySeriesMeta'], 'firstDate': bars[0]['date'], 'lastDate': item['closeDate'], 'returnedBars': n}
        prepare(item, calendar)
        yield item

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', default='data/backtest/v86/results.json')
    args = p.parse_args()
    source = json.loads((ROOT / 'data/backtest/v86/source-frozen.json').read_text())
    calendar = source['tradingCalendar']
    if not calendar.get('historicalSource'):
        raise ValueError('Actual historical exchange session calendar required')
    digest = policy_hash()
    predictor, lock, receipt = load_runtime()
    forecasts, unavailable = [], []
    for item in prefixes(source, calendar):
        try:
            f = infer(predictor, lock, receipt, item, calendar, 'TAIEX', mode='RETROSPECTIVE_WALK_FORWARD')
            forecasts.append(f)
            print('INFERENCE', f['asOf'], f['targetDates'][0], f['runtimeSeconds'], flush=True)
        except Exception as e:
            unavailable.append({'asOf': item['closeDate'], 'reason': str(e)})
            print('UNAVAILABLE', item['closeDate'], str(e), flush=True)
    if digest != policy_hash():
        raise ValueError('Policy changed during evaluation')
    save(ROOT / args.output, {'schema': 'walk-forward-v86', 'policySHA256': digest, 'sourceSignature': hashlib.sha256((ROOT / 'data/backtest/v86/source-frozen.json').read_bytes()).hexdigest(),
        'forecasts': forecasts, 'unavailable': unavailable, 'modelTrainingOverlap': 'UNKNOWN_NOT_AN_EX_ANTE_LIVE_TRACK_RECORD',
        'protocol': 'FIXED_POLICY_CHRONOLOGICAL_50_20_30_NO_OPTIMIZATION', 'sampleUnit': 'ONE_TARGET_TRADING_DAY'})
    if not forecasts:
        raise SystemExit('No genuine inference; no performance claims')
if __name__ == '__main__':
    main()
