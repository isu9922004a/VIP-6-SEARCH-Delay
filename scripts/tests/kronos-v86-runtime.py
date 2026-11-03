"""Input and prefix regressions; real inference is exercised by v86-backtest.yml."""
import copy
import json
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'kronos'), str(ROOT / 'scripts/backtest')]
from run import prepare, signature, raw_signature
import importlib.util
spec = importlib.util.spec_from_file_location('walkforward', ROOT / 'scripts/backtest/run-v86.py')
wf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wf)

class InputTests(unittest.TestCase):
    def setUp(self):
        self.source = json.loads((ROOT / 'data/backtest/v86/source-frozen.json').read_text())
        self.calendar = self.source['tradingCalendar']
    def test_next_actual_session_and_no_future_features(self):
        for p in wf.prefixes(self.source, self.calendar):
            bars, future = prepare(p, self.calendar)
            self.assertEqual(bars[-1]['date'], p['closeDate'])
            self.assertEqual(future[0], next(d for d in self.calendar['dates'] if d > p['closeDate']))
            self.assertTrue(all(b['date'] <= p['closeDate'] for b in bars))
    def test_missing_calendar_volume_completed_prices_and_sessions_fail_closed(self):
        changes = [lambda s:s.update(completed=False), lambda s:s.update(close=1),
                   lambda s:s['dailySeries'][-1].update(volume=float('nan')),
                   lambda s:s['dailySeries'][-1].update(completed=False),
                   lambda s:s['dailySeries'].pop(80), lambda s:s['dailySeries'][-1].update(amount=1)]
        for change in changes:
            s = copy.deepcopy(self.source)
            change(s)
            with self.assertRaises(ValueError): prepare(s, self.calendar)
        with self.assertRaises(ValueError): prepare(self.source, {**self.calendar, 'verified':False})
    def test_binary_output_fingerprint_and_history_signature(self):
        raw=json.loads((ROOT / 'data/backtest/v86/v85-issued-forecast.json').read_text())
        self.assertEqual(signature(self.source['dailySeries']), raw['historySignature'])
        self.assertEqual(raw_signature(raw['samples']), 'bcd7be51')
        changed=copy.deepcopy(raw['samples']);changed[0][0]['close']+=.000001
        self.assertNotEqual(raw_signature(changed),raw_signature(raw['samples']))
    def test_inference_has_no_synthetic_fallback(self):
        text=(ROOT/'kronos/run.py').read_text()
        self.assertIn('with torch.inference_mode()', text)
        self.assertIn('sample_count=1', text)
        self.assertIn('model.eval()', text)
        self.assertNotIn('random.uniform', text)

if __name__ == '__main__': unittest.main()
