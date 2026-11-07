# V8.7 大盤舊日期修正

2026-11-07 調查：使用者圖片為 2026-05-29、44,732.94。主頁的大盤入口直接接受 Worker 的 TAIEX 身分，沒有檢查最近完成交易日；圖片刷新取得較新的官方快照時只作提醒，失敗時仍匯出舊報告。

本次線上 Worker debug 實測回傳 2026-07-31、43,119.75、83 根 OHLCV。其 2026-08、09、10、11 的指數月份請求均顯示 `The operation was aborted`，仍回 HTTP 200。因此並非日期顯示或時區換算出錯，而是成功接納了不完整月份所組成的舊資料。實測日期不同於使用者圖片，不能宣稱重新取得了圖片當時的同一份回應。遠端 main 已核驗指數快照則截至 2026-11-06、39,701.64、120 根日K。

## 行為與檔案

- `index.html`：大盤查詢統一進入已核驗快照載入器；失敗時保留原快照供診斷，顯示查詢錯誤，不顯示成功的新結果。
- `market-report-refresh-v864.js`：主頁和匯出讀同一份 `data/index/TAIEX.json`，沿用結構核心的指數來源、完成日K、交易日曆、OHLCV、單位及價格基準驗證，再檢查台北交易日期。拒絕缺日、倒退、未完成或過期資料；共用請求、失敗不快取。每五分鐘及回到頁面時檢查；匯出前再次核對。預覽更新期間或失敗後阻擋下載及分享。
- `market-worker.mjs`：將既有 TAIEX 計算段抽成命名匯出 `buildTaiexReportFromHistory`，原 Worker 路由也呼叫同一函式。前端以靜態 ES module 載入，沒有另寫 ABC/N 引擎，沒有增加行情 API 呼叫。均線、RSI5、趨勢與 ABC/N 全部來自同一份歷史，不拼接舊 Worker 指標。計算窗口明確標示為快照實際提供的根數（目前 120），沒有宣稱取得了 360 根或 24 個月。
- `r45-report-suite.js`：最新行情核對未通過時停止新增圖片輸出。
- `version-v50.js`：維持 V8.7，更新快取識別。
- `scripts/tests/market-report-refresh.test.cjs`：重現五月舊結果、同日更正、資料風險、請求競態、重試與交易日判斷。
- `scripts/tests/market-report-core.test.mjs`、`scripts/fixtures/market-core-baseline-v87.json`：固定修正前 Worker 在同一份官方歷史的完整輸出，驗證共用計算器沒有改變原規則，也不改動輸入。
- `scripts/tests/market-date-browser.cjs`：真正執行主頁查詢與匯出入口，驗證 PNG、浮水印、波浪日期、下載、原生分享介面、故障阻擋與恢復，以及 390/428/768/1440 寬度。線上模式先讀取真正已發布快照，再注入故障，避免拿本機舊日期冒充線上日期。
- `scripts/tests/market-comfort-browser.cjs`：版面測試保留原有情境；刷新改以對應的指數快照路徑注入資料，測試伺服器支援 `.mjs` MIME。
- `.github/workflows/deploy-frontend.yml`、`scripts/verify-deployed-frontend.py`：部署前與部署後加入主頁日期回歸及共用模組檔案位元核對。

## 驗證與限制

實際執行結果記錄於交付訊息及 CI；不得把尚未跑完的 CI 寫成成功。原始 Worker 與抽出計算器已用相同 2026-11-05 固定歷史逐欄比較，完整結果相同。這只驗證計算相容性，不證明預測績效。`research:validate` 仍回報缺少逐日可得歷史的績效驗證限制。

本機瀏覽器採 Chromium，原生分享以可觀察的 API 接收器檢查檔案，未宣稱在實體 iPhone 或真實 LINE 收件人完成傳送。

此修正部署目標是 GitHub Pages。共用計算器檔案隨 Pages 發布；不代表 Cloudflare Worker 服務已部署。原 Worker 遠端月份抓取逾時仍可能發生，但主頁已停止使用該不完整回應。盤後排程仍必須成功發布下一份已核驗快照；若官方資料或自動更新失敗，系統保留真實舊日期並阻擋將它匯出為最新報告，不捏造當日行情。

回滾：對本修正的合併 commit 執行 revert，通過部署驗證後重新發布 Pages；不要回滾或覆寫 `data/` 行情與模型檔案。

### 本機實際完成的驗證

- `npm ci --offline --cache /workspace/novice-npm-cache --no-audit --no-fund`：成功。
- `npm test`：681 項通過，0 項失敗。
- `npm run test:contract`：成功。
- `npm run research:validate`：指令完成，但績效狀態為 `BLOCKED_MISSING_POINT_IN_TIME_HISTORY`，未宣稱績效通過。
- 一般瀏覽器回歸：29 項通過；波浪瀏覽器回歸：10 項通過。
- 主頁日期瀏覽器：6 組情境通過（含無浮水印 PNG、浮水印、實際分享 API 接收器、故障時禁止下載分享及恢復）。
- 原有大盤舒適版瀏覽器：正常、長來源字、ABC 未完成、偏強、ABC 待突破、缺資料、換交易日，以及下載／分享／背景更新全部通過。
- `node --check market-worker.mjs`、嵌入資料契約重建及 `git diff --check`：成功。
