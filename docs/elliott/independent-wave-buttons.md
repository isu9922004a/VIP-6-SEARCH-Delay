# V8.7.1：波浪圖片獨立按鈕

個股專業圖和原有大盤單頁圖固定維持1284×2778，不再受網頁波浪開關影響，也不在個股圖後自動附加研究分頁。動能量價研究仍有原本自己的按鈕；波浪圖新增獨立按鈕，個股、大盤各有無浮水印與浮水印版本。

新 `elliott-wave-report-v1.js` 沿用原有驗證後的波浪結果、實際OHLCV與圖表，產生單張1284×2778 PNG。頁面包含當前位置、真實日K、簡短白話解釋、原報告參考價及下一步觀察。原價位與波浪參考價分開；資料不足時畫明確佔位說明，不補造K線或數浪。網頁波浪開關不控制此按鈕，也不會因產圖而更改使用者的開關設定。

主頁沿用既有圖片預覽與分享，獨立大盤沿用原本預覽視窗；沒有新增另一套彈跳視窗。主頁大盤匯出前仍經原行情日期刷新，獨立頁檢查現有快照時效。查詢、股票輸入或資料變更時，阻擋舊波浪圖下載與分享，請使用者重新產生。

相關檔案：

- `stock-professional-v84.js`、`market-report-comfort-v864.js`：停止自動插入波浪長圖。
- `elliott-wave-visual-v1.js`：保留網頁圖表與白話內容；舊圖片增長接口改為相容的直接返回，價格數字不拆行。
- `r45-report-suite.js`：個股圖不再自動附上動能研究分頁，研究內容仍由既有按鈕開啟。
- `research-chart-v1.js`、`research-report-v1.js`、`research-v83/stock-simple-report.js`、`research-v83/market-simple-report.js`：原圖片不因網頁波浪開關而加長；網頁說明保留。獨立大盤預覽支援正確的波浪標題、下載檔名與稽核資料。
- `index.html`、`market-outlook.html`、`version-v50.js`：載入新按鈕並更新快取，顯示版本仍是V8.7.1。
- `scripts/tests/wave-report-separate.test.cjs`、`scripts/tests/elliott-browser.cjs`、`scripts/tests/market-date-browser.cjs`、`scripts/verify-deployed-frontend.py`：新增固定尺寸、實際按鈕、來源一致性、下載、浮水印、分享與部署檔案檢查。

原精簡報告若原本完整文字就超過一頁，仍保留內容原有高度；這次恢復的是專業單頁與大盤單頁，另提供固定尺寸的波浪手機圖。沒有裁切原分析來假裝容納。

本機完整程式與契約測試通過；波浪瀏覽器16項、一般瀏覽器29項通過。部署前後由同一組檢查驗證。研究績效仍未證明改善，本次不改數浪演算法、原六策略、排名、分數、停損或Kronos，不需另外部署Cloudflare Worker。回滾本次合併commit即可，保留data/行情與模型。
