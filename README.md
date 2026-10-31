# 石頭少爺 V8.2.9｜台股選股與研究

原生 JavaScript 靜態網站，提供選股掃描、個股研究、寶塔線及文字／圖片報告。版本資訊以 `version-v50.js` 為準，最近一版功能說明見 [RELEASE_V8.2.9.md](docs/RELEASE_V8.2.9.md)。

## 專案結構

| 路徑 | 用途 |
| --- | --- |
| `index.html`、根目錄 `.js`／`.css` | 前端介面、策略、研究分析與報告匯出 |
| `stock-worker.mjs` | 個股資料 Cloudflare Worker |
| `market-worker.mjs` | 市場資料 Cloudflare Worker |
| `worker-data-contract-v1.js` | 前端與 Worker 共用資料契約 |
| `data/market/` | 市場快照、實際交易日曆與交易排除資料 |
| `data/research/` | 個股歷史日線、逐日來源與發布清單 |
| `config/` | 已核實的市場休市設定 |
| `scripts/` | 資料更新、契約同步、驗證及測試工具 |
| `.github/workflows/` | GitHub Actions 更新與驗證流程 |
| `evidence/` | 測試及維護工具所需的原始回應、來源資訊與研究稽核結果 |

主升段、盤前／當沖、強勢股、寶塔、餐廳與結構反轉功能由既有前端及各自模組提供。資料完整性、日期、成交量單位及風險閘門由程式檢查；研究分數不代表獲利機率。

## 本機預覽與測試

從專案根目錄啟動靜態 HTTP 服務，例如已安裝 Python 時：

```sh
python -m http.server 8765 --bind 127.0.0.1
```

開啟 `http://127.0.0.1:8765/`。資料服務仍使用程式中既有的網址與設定。

使用 Node.js 24 安裝鎖定依賴並執行回歸：

```sh
npm ci
npm test
```

其他檢查指令：

```sh
npm run test:contract
npm run research:validate
```

`npm test` 執行離線回歸；瀏覽器測試需另外具備 Chromium 環境，不能以離線測試結果取代正式網站驗證。`data/research/` 的 SHA256 檢查使用原始檔案位元，下載或工具改寫換行可能造成不一致。

## 資料與自動更新

有效的 Actions 設定位於 `.github/workflows/`。市場更新流程先驗證上市、上櫃日期及完整性，取得有效資料後才發布。個股歷史更新與全市場研究稽核另有工作流程。

手動執行資料工具會向外部服務取得資料並寫入工作目錄，例如：

```sh
node scripts/update-market-snapshot.mjs
node scripts/verify-market-snapshot.mjs
node scripts/update-research-calendar.mjs
node scripts/build-official-research-history.mjs
node scripts/audit-official-research-v829.cjs
```

`data/`、測試 fixtures 及仍被工具讀取的 `evidence/` 都是維護流程的一部分。歷史截圖、巢狀交付包及過期版本文件已清理；舊內容可從 Git 歷史取得。

## 部署與回復

前端以整個專案根目錄發布，讓 `index.html`、相關腳本、樣式及 `data/` 保持相對路徑。GitHub Pages 的發布來源須依該儲存庫的實際設定確認。

`stock-worker.mjs` 與 `market-worker.mjs` 是兩個獨立 Cloudflare Worker，沿用各自服務的環境變數、bindings、路由及權限設定。只更新 GitHub 前端檔案不會自動部署這兩個 Worker。

共用資料契約修改後，執行 `npm run build:worker-contract` 同步 Worker 內嵌契約，再跑測試。部署後核對實際網站的 `version-v50.js`、資料日期、個股查詢與報告匯出；Actions 執行成功與前端發布成功需分別確認。

需要回復時，使用 Git 歷史還原對應檔案，或以 `git revert <commit>` 建立回復提交。資料更新與 Worker 部署應分別核對，避免用舊行情覆蓋後續已發布的資料。
