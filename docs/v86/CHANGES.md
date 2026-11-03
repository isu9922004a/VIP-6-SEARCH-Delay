# V8.6實際修改檔案

模型推論：kronos/run.py；scripts/kronos-automation.cjs新增收據核對、原始預測與輸入資料封存。模型／tokenizer權重與Worker API不變。

行情與風險：research-v86/market-config.js、market-regime.js；research-v83/forecast-engine.js、market-engine.js。

報告與版本：大盤七節動態報告、個股執行收據標示、V8.6顯示與快取；個股既有四策略與餐廳六條件保留。

回測與測試：scripts/backtest、data/backtest/v86、相關單元／Python／瀏覽器測試與工作流程。

- `.github/workflows/v86-backtest.yml`
- `.github/workflows/worker-contract-tests.yml`
- `data/backtest/v86/comparison.json`
- `data/backtest/v86/observed-outcomes.json`
- `data/backtest/v86/results.json`
- `data/backtest/v86/source-frozen.json`
- `data/backtest/v86/v85-issued-forecast.json`
- `docs/v86/CHANGES.md`
- `docs/v86/IMPLEMENTATION.md`
- `index.html`
- `kronos/run.py`
- `market-outlook.html`
- `research-action-guide-v1.js`
- `research-report-v1.js`
- `research-v83/forecast-engine.js`
- `research-v83/iphone-summary-renderer.js`
- `research-v83/market-engine.js`
- `research-v83/market-simple-report.js`
- `research-v83/market.js`
- `research-v83/stock-fifth-module.js`
- `research-v83/stock-simple-report.js`
- `research-v83/workspace-v831.js`
- `research-v86/market-config.js`
- `research-v86/market-regime.js`
- `scripts/backtest/capture-outcome.cjs`
- `scripts/backtest/run-v86.py`
- `scripts/backtest/score-v86.cjs`
- `scripts/backtest/v85-forecast.cjs`
- `scripts/kronos-automation.cjs`
- `scripts/tests/kronos-automation.test.cjs`
- `scripts/tests/kronos-v83-browser.cjs`
- `scripts/tests/kronos-v86-runtime.py`
- `scripts/tests/market-simple-report.test.cjs`
- `scripts/tests/market-v86-browser.cjs`
- `scripts/tests/market-v86.test.cjs`
- `scripts/tests/receipt-v86-fixture.cjs`
- `scripts/tests/research-action-guide-v8210.test.cjs`
- `scripts/tests/research-mobile-v821.test.cjs`
- `scripts/tests/v84-live-smoke.cjs`
- `stock-professional-v84.js`
- `teacher-three-pan-ui.js`
- `ui-polish-v85.css`
- `version-v50.js`
- `.github/workflows/update-market-snapshot.yml`
- `scripts/verify-deployed-frontend.py`
- `update-market-snapshot.yml`（與啟用中的工作流程保持一致）
