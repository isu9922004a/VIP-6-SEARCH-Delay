"""Test the production pure validation/packing functions without loading weights."""
import ast,copy,math,struct,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'kronos'))
from run import valid_bar
tree=ast.parse((Path(__file__).resolve().parents[2]/'kronos/future.py').read_text())
names={'validate_future_rows','pack_forecast','display_signature'}
namespace={'math':math,'struct':struct,'HORIZON':20,'valid_bar':valid_bar}
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'future.py','exec'),namespace)
validate,pack=namespace['validate_future_rows'],namespace['pack_forecast']

class Quality(unittest.TestCase):
    def bars(self):return [{'open':10.,'high':12.,'low':9.,'close':11.} for _ in range(20)]
    def test_finite_invalid_nonclose_prices_do_not_discard_valid_closes(self):
        for field in ['open','high','low']:
            for value in [-8.,0.]:
                rows=self.bars();rows[3][field]=value;before=copy.deepcopy(rows);validate(rows);self.assertEqual(rows,before);self.assertFalse(valid_bar(rows[3]))
    def test_invalid_closes_are_never_filtered_or_replaced(self):
        for value in [0.,-1.,float('nan'),float('inf'),None]:
            rows=self.bars();rows[2]['close']=value
            with self.assertRaises(ValueError):validate(rows)
    def test_missing_nonfinite_or_partial_ohlc_still_blocks_publication(self):
        for field in ['open','high','low','close']:
            for value in [None,float('nan'),float('inf'),True]:
                rows=self.bars();rows[0][field]=value
                with self.assertRaises(ValueError):validate(rows)
        for count in [0,19,21]:
            with self.assertRaises(ValueError):validate((self.bars()*2)[:count])
    def test_all_150_closing_paths_and_negative_raw_low_are_preserved(self):
        paths=[self.bars() for _ in range(150)];paths[19][16]['low']=-8.178115844726562
        raw={'samples':paths,'execution':{}};before=copy.deepcopy(raw)
        for rows in paths:validate(rows)
        packed=pack(raw);self.assertEqual(raw,before);self.assertEqual(len(packed['closePaths']),150)
        self.assertEqual(packed['closePaths'],[[b['close'] for b in p] for p in paths]);self.assertEqual(paths[19][16]['low'],-8.178115844726562)
        self.assertIsNotNone(packed['candlePath']);self.assertNotEqual(packed['candlePath']['sampleIndex'],19);self.assertTrue(all(valid_bar(b) for b in packed['candlePath']['bars']))
    def test_no_valid_candle_path_retains_every_valid_close(self):
        paths=[self.bars() for _ in range(150)]
        for rows in paths:rows[0]['low']=-1.;validate(rows)
        packed=pack({'samples':paths,'execution':{}});self.assertIsNone(packed['candlePath']);self.assertEqual(len(packed['closePaths']),150)
    def test_live_inference_calls_the_same_validator(self):
        f=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='infer_future')
        self.assertTrue(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='validate_future_rows' for n in ast.walk(f)))

if __name__=='__main__':unittest.main()
