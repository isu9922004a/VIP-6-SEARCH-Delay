# 石頭少爺 V8.7：艾略特波浪整合交付說明

## 這次新增什麼

原本已經有量價波段、斐波回撤、N字ABC、部分完整五浪研究，以及個股與大盤圖片。這次把既有五浪研究擴充為可追蹤的波浪結果，再直接標在實際每日價格線圖上。

- 藍色 1～5 為疑似推動浪；橘色「修正A／B／C」是艾略特修正，與原 N 字 ABC 分開。
- 實線表示轉折已等到右側三根完成日K核對；虛線及 ? 是尚未完成的段落。浪型解讀仍是假設。
- 第2浪越過起點、第4浪進入第1浪範圍會拒絕該標準數法；第3浪最短規則要等第5浪轉折確認後才能通過。
- 價量、RSI、MACD與均線證據不一致時，說明仍待確認或有不同解讀；不產生勝率或自訂信心百分比。
- 同時保留主要與備用判讀；沒有足夠證據就顯示「目前無法確認波浪位置」。
- 波浪參考價與原本突破、回踩、失效、停損價分開；不調高任何策略分數、排名、TOP8、買進資格，也不改 Kronos。

## 實際計算例子

測試用合成行情會辨識第3、4、5浪及ABC修正。每個標記都核對該日真正的 high 或 low，還檢查畫布的 x/y 座標；不是畫固定五浪示意圖。測試資料只在 scripts/tests，沒有當成真實股票行情發布。

實際已存檔的 2026-11-05 TAIEX 在這套標準規則下不能可靠數浪，會保留完整技術圖並顯示無法確認；不強行標成五浪。上線後一律使用查詢當日同一份已核對的實際行情，不固定套用此例。

## 圖片與手機

個股專業圖開啟後改為較寬的真實K線，原有ABC、價格地圖、條件分與風控卡片都保留。個股研究圖與精簡圖共用同份波浪資料。原有大盤白話圖與獨立大盤 PNG 都已接入；獨立大盤 PNG 原本沒有圖，現在即使關閉波浪也會保留新增的真實指數技術圖。

波浪標註預設關閉，可在圖片操作區切換。390、428、768、1440像素畫面均已檢查。無浮水印、浮水印、下載及單檔分享流程已測試。這是 Chromium 的手機模擬，未宣稱已在實體 Safari 或真正LINE聊天室送達。

完整圖片維持1284寬；原個股專業圖關閉時仍為2778高。開啟後為3628高，以單張長圖保留所有資訊，不壓縮字體或裁切。其他精簡圖高度依完整文字與圖表增加，安全上限8192。

實測圖片尺寸：

- SYNTHETIC-stock-professional.png：1284×3628
- SYNTHETIC-stock-simple.png：1284×4316
- REAL-TAIEX-approved-wave-report.png：1284×3200
- REAL-TAIEX-waves-off.png：1284×3954
- REAL-TAIEX-waves-on.png：1284×4282


## 已執行驗證

- npm ci：使用既有套件快取離線安裝成功。
- npm test：677/677通過。
- npm run test:contract：50/50通過。
- npm run research:validate：已執行、結束碼0；歷史績效比較仍缺少完整證據，未證明預測改善。
- 原有瀏覽器29項、吞沒／箱體9項、新波浪10項通過。
- 直接驗證日期、OHLC高低價、確認日期、標籤座標、規則未完成、三條硬規則失敗、下跌對稱、橫盤、缺資料、前瞻隔離、同資料重整穩定、N字ABC獨立與原策略欄位不變。

## 限制與風險

1. 這是單一日線尺度的保守研究，不處理對角線、截短五浪、複雜修正或多層級浪。
2. 轉折需要等待，可能較晚標示；加入新的交易日後，合理的主要與備用數法可能改變。
3. 個股歷史公司行動未完整證實時會保留說明；價格斷點、來源或單位衝突會停止新波浪判讀，原報告仍能輸出。
4. 長圖較原單頁高；使用者仍可關閉波浪。
5. 回測證據尚不足，不適合把波浪解讀當成獨立買賣訊號。

## 部署與回滾

正式版顯示 V8.7。程式先經分支與雲端測試，再合併發布Pages；正式部署結果另以 GitHub Actions 與線上驗證記錄為準。Cloudflare Worker 本次未修改，無須另外部署，不能把Pages更新稱為Worker更新。

快速回退：關閉波浪可恢復原個股專業圖。完整回滾：先由新到舊revert後續排版修正，再revert本次PR合併提交，重新部署Pages；不要reset或覆蓋行情資料、不要回滾Worker。

## 修改檔案與原因

| 檔案 | 原因 |
|---|---|
| .github/workflows/deploy-frontend.yml | 雲端測試與V8.7發布、線上檢查。 |
| .github/workflows/worker-contract-tests.yml | 雲端測試與V8.7發布、線上檢查。 |
| docs/elliott/architecture.md | 架構、驗證與交付紀錄。 |
| docs/elliott/validation.json | 架構、驗證與交付紀錄。 |
| elliott-wave-v1.js | 擴充既有數浪核心，重用轉折、指標及斐波量尺，輸出可核對的波浪資料。 |
| elliott-wave-visual-v1.js | 白話文字、開關、同日期價格座標、完整圖片與命名隔離。 |
| four-models-research-v1.js | 附上各自股票或指數的波浪結果，不更動正式條件。 |
| index.html | 依賴順序、手機開關、V8.7版本與資源快取。 |
| market-outlook.html | 依賴順序、手機開關、V8.7版本與資源快取。 |
| market-report-comfort-v864.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| market-report-refresh-v864.js | 重用既有官方資料回應，核對同日OHLCV後供原大盤圖片使用，無額外行情請求。 |
| package.json | 新增專用瀏覽器驗證指令。 |
| research-chart-v1.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| research-integration-v1.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| research-report-v1.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| research-v83/iphone-summary-renderer.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| research-v83/market-engine.js | 附上各自股票或指數的波浪結果，不更動正式條件。 |
| research-v83/market-simple-report.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| research-v83/market.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| research-v83/stock-simple-report.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| scripts/tests/elliott-browser.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/elliott-fixtures.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/elliott-wave.test.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/engulf-range-browser.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/kronos-v83-browser.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/market-comfort-browser.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/market-simple-report.test.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/market-v862-browser.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/research-action-guide-v8210.test.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/research-mobile-v821.test.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/structure-v863-browser.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/tests/v84-live-smoke.cjs | 新增波浪或圖片驗證；舊測試只同步新版本、依賴與完整圖高。 |
| scripts/verify-deployed-frontend.py | 線上逐檔核對新波浪模組。 |
| stock-professional-v84.js | 讓原有文字或技術圖片接入同份波浪資料；保留舊資訊、圖表、分享與停損。 |
| unified-analysis-v1.js | 沿用原wave介面，改接單一擴充核心，避免互相衝突的數浪。 |
| version-v50.js | 依賴順序、手機開關、V8.7版本與資源快取。 |

原始模組與圖片管線對照另見 architecture.md；機器可讀測試結果見 validation.json。

日期避讓修正：研究技術圖在波浪標籤與日期之間另留間距，保留原本K線日期及價格座標。已重跑14項波浪單元與10項瀏覽器檢查，並以真實台泥2026-11-03存檔覆核。

資料衝突一致性：成交量來源衝突時，新圖片與既有波浪研究欄位都會停止數浪，統一顯示待核對原因。
