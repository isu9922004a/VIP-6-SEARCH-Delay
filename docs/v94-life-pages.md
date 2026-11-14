# V9.4 生命線多頁圖片報告

V9.4 將生命線研究入口改成逐頁閱讀、下載與分享。每頁獨立排版、獨立 Canvas、1284×2778 PNG；並非切割原有長圖。

第 1 頁優先顯示最新收盤、目前方向、追價風險、近期高低點、目前／歷史生命線、歷史圖 A、下一交易日條件與首次穿越日期。第 2 頁說明實際四根連續完成日 K 的條件、排除規則、嚴格收盤比較、兩根站穩、回測容差及歷史價位的限制。第 3 頁起保留圖 B、技術數據、全部歷史事件、盤中測試與正式轉換、來源及未驗證條件。證據較多時增加補充頁，不縮小字體或刪除證據；8099 的完整快照輸出 6 頁。

## 模組與相容性

- `kline-life-03-pages-v94.js`：只處理資料呈現、文字測量、獨立價格座標與延遲渲染。複製輸入快照後排版，避免外部修改導致各頁數據不同。
- `kline-life-03-report-v1.js`：新增 `pages()`；保留 `inspect`、`fields`、`lines`、`page`、`teaching`。舊單張 API 及其他報告繼續運作。
- `kline-life-03-viewer-v94.js`：生命線專用上一頁／下一頁、當頁 PNG、當頁分享與順序編碼 ZIP。檔名使用版本、股票代號、行情日期與頁碼。
- `research-integration-v1.js`：生命線入口使用新分頁；等待字型後才製圖。生命線沒有 Kronos 預測依賴，其他研究仍保留原本的 Kronos 準備流程。
- 既有 `mobile-image-share-v1.js`、`report-pages-v47.js`、一般報告分頁器與首頁按鈕綁定未修改。原分享模組先準備目前頁的單張 JPEG，再由使用者點擊開啟系統分享；取消不視為送出成功。
- 發布版本／快取改為 V9.4／V9.4-LIFE94-1；生命線核心、歷史事件與模型識別碼維持原值。

## 保護範圍

`kline-life-03-core-v1.js` 保持 V9.3.2 檔案 SHA256 不變。六套選股規則、2560 名稱與條件、排名權重、原始／回測行情及 Kronos 模型、資料均無修改。`research-v921.test.cjs` 繼續檢查受保護來源、完整內嵌腳本及原分析雜湊；新增外部呈現模組有獨立的入口順序與唯一載入檢查。

`researchOnly=true`；`affectsEligibility=false`；`affectsRanking=false`；`automaticTrade=false`；`performance=NOT_VALIDATED`。

## 驗收方式

修改前 `npm test`：980 通過。新版 `npm test`：989 通過、0 失敗、0 跳過；契約測試 50 通過。早期版本標示與測試伺服器路徑問題均修正後重跑，不跳過失敗驗收。

正式行情快照 2026-11-13 共 1,965 檔，全數通過官方來源比對、收盤路徑獨立核對與歷史研究日重現；新分頁 PNG 編碼也涵蓋全部股票，最終完成數及通過狀態以 Actions artifacts 的 JSON 為準。11 檔官方成交量版本不同，沿用 V9.3.2 的待核對處理，不使用量能倍數確認。所有股票均納入圖片驗收，包括沒有 K0 或資料不足者。

V9.4 PNG 驗收逐頁比對核心價格、日期、狀態、角色與資料來源，檢查真實文字邊界及重疊；每張 PNG 有尺寸與 SHA256。合成測試另有明確標示，涵蓋各狀態、長公司名、長說明、指標不足與來源異常，不用於正式行情輸出。

```sh
npm test
npm run test:contract
npm run research:validate
node scripts/audit-life-v932-universe.cjs /tmp/v94-universe
node scripts/tests/life-v94-universe-browser.cjs /tmp/v94-universe
node scripts/tests/life-v94-mobile-browser.cjs /tmp/v94-mobile
```

GitHub Actions 的 `V9.4 independent life-line pages` 會重新驗證全部股票、實際圖片、手機下載／分享與既有 API；結果 JSON、PNG、手機截圖及 ZIP 放在該次執行的 artifacts。合併前必須確認所有必要檢查成功。部署流程再執行原研究／Kronos 瀏覽器驗收與正式站資源逐檔比對，並使用 `RESEARCH_BROWSER_ORIGIN` 對正式站重測多頁下載與分享。

## 8099 真實行情比較

分析版本維持 V9.3.2：2026-11-13 收盤 182.00 元；K0 2026-10-21；原始線 70.90 元；首次突破 2026-10-22；歷史進展為持續站穩，現在角色為歷史參考。目前方向偏強，追價風險較高；下一交易日觀察近期高點 182.00、低點 109.50、平均價與成交量。V9.4 沒有將歷史 70.90 元重新解讀為未突破壓力，也沒有改寫事件日期。

## 實測限制

完成桌面與 iPhone 12 Pro Max 尺寸的 Chromium 模擬；原生分享 API 使用可控替身測試使用者手勢、單檔、取消及失敗。沒有 iPhone 真機或 LINE App 收送驗證，不能宣稱已測過實際 LINE 壓縮或儲存行為。未支援檔案分享時保留 PNG／JPEG 下載替代。除權息事件核對及成交量來源差異仍按快照揭露；績效沒有樣本外驗證，不宣稱獲利改善。
