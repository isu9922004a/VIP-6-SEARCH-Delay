# V8.3 Kronos integration

The runtime is vendored from [shiyu-coder/Kronos](https://github.com/shiyu-coder/Kronos), under its MIT license. `UPSTREAM.json` pins the code commit; `model-lock.json` pins both Hugging Face revisions. The zdoc page is documentation, not an inference service or a database.

`run.py` uses Kronos-small and Tokenizer-base with 32 independent draws, one completed next-session daily bar, temperature 1.0, top_p 0.9 and seed 83001. Each batch row uses sample_count=1; the upstream predictor's averaged multi-sample path is not treated as independent probabilities. Original draws, parameters, source history signatures and runtime are saved with every result.

The independent TAIEX page reads only `data/index/TAIEX.json` and `data/kronos/TAIEX.json`. Stock forecasts use each stock's own official daily archive. Annual exchange holiday schedules identify future sessions; actual FMTQIK sessions validate past history. Missing dates, incomplete sources, unverified volume units or large price discontinuities make an instrument unavailable rather than filling data.

Stock input prices are official unadjusted prices; corporate actions have not been fully verified. Every full stock narrative states this limitation. The model sometimes emits inconsistent high/low envelopes. All samples remain intact, and their count is disclosed; only the finite positive open/close distributions are summarized. No future candlesticks or repaired prices are published. Invalid envelope counts must match the recorded quality receipt.

Directions classify next close against the latest actual close: above +0.3% is bullish, below -0.3% bearish, otherwise flat. A direction needs at least 65% of draws; otherwise it is mixed. These are sampling proportions, not calibrated win probabilities. Entry, defence and resistance references remain the existing technical/risk framework; the model never authorizes an order. Taiwan performance has not been validated by a rolling out-of-sample backtest.

Initial local inference verified TAIEX, 1569, 2330 and 8039 for 2026-11-02 from the 2026-10-30 close. The daily/manual GitHub Actions workflow processes all ready archive instruments in 16 independent shards, then publishes only if the source date still matches the current archive. Unsupported instruments remain unavailable. The catalog allows browsers to avoid requesting nonexistent stock outputs. Results expire at 15:00 Taipei on their target session and never carry a previous stock's results into a new query.

## Run

Use Python 3.12 in an isolated environment:

```sh
python -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r kronos/requirements.txt
node scripts/update-kronos-sources.cjs
python kronos/run.py --codes 1569,2330,8039 --index --samples 32
node scripts/build-kronos-manifest.cjs
```

For all supported inputs, use `--all --index`. For independent workers use `--shards 16 --shard 0` through `15`; publish only newly created shard outputs. The frontend never runs PyTorch in the browser and does not call a public demo API.
