# V8.7.1 個股波浪圖片資料核對修正

富喬（1815）的官方日線可核對，但已存在的 Worker 日線快取可能沒有獨立價格證據。舊流程只在缺少快取時取得官方資料，並重用同一查詢物件的準備結果，造成圖片一直顯示「價格或除權息基準還沒核對」。這不是判斷該股票真的發生除權息問題。

修正內容：

- `selection-data-v2.js` 共用查詢與全市場稽核的資料準備流程；快取缺少價格證據時，使用既有官方歷史資料與原本核對規則補驗，不增加新的行情來源。
- `research-integration-v1.js` 重試未核對完成的結果，依行情收據變更更新快取，保存當次核對完成的來源供圖片使用。
- `elliott-wave-report-v1.js` 圖片使用同一股票、日期、收盤與市場的已核對資料，保留原報告的三個價位。
- `elliott-wave-visual-v1.js` 不讓舊的載入失敗覆蓋目前有效結果；真正短歷史、價格斷點、成交量口徑與DR限制顯示原限制原因。
- `index.html`、`market-outlook.html`、`version-v50.js` 更新相關快取版本，顯示版本維持 V8.7.1。
- `scripts/tests/wave-source-upgrade.test.cjs` 驗證暖快取、冷快取、重試、舊失敗與真正限制。
- `scripts/tests/elliott-browser.cjs` 新增富喬舊快取到實際PNG按鈕的測試，檢查圖上OHLCV、日期與價格。
- `scripts/audit-stock-wave-export.cjs` 逐檔使用當期官方日線，模擬未核對快取與舊失敗，檢查查詢到圖片模型的共同流程；輸出完整JSON/CSV。
- `.github/workflows/worker-contract-tests.yml` 持續執行與保存全市場圖片來源檢查結果。

本修正不放寬行情契約，不更改排名、停損、Kronos與數浪規則。圖表恢復不代表必須有1至5浪；行情沒有合理浪型時，仍顯示無法確認，保留真實K線及關鍵價位。

完整逐檔數量以 Actions 的 `STOCK_WAVE_EXPORT_AUDIT` 與 `stock-wave-export-all.json/csv` 為準。稽核檢查當期系統收錄的上市、上櫃股票，不聲稱逐檔發出新的 Worker API 請求；使用真實官方資料與相同資料準備函式，避免額外製造大量請求。

部署範圍為 GitHub Pages 前端，無 Worker 程式變更。回滾可 revert 本次合併提交，讓原有驗證與 Pages 發布工作流程重新執行；不需更動行情資料。
