# V8.7 波浪視覺化架構盤點

盤點基準：main 17050fd729e2f848d8157bd550ab9b79f2b2d68a（顯示 V8.6.4）。保留既有本機修改與行情資料，不重置原專案。

| 圖片或功能 | 原產生器與路徑 | 原技術圖 | V8.7 處理 |
|---|---|---|---|
| 個股專業 PNG | r45-report-suite.js → stock-professional-v84.js → report-layout-v563.js 擷取原圖 | 有真實 K 線、MA20、量與 N 字 ABC；圖寬較窄 | 開關開啟才使用較寬圖表與同日波浪結果，保留全部原卡片 |
| 個股研究證據圖 | research-report-v1.js → research-chart-v1.js | 有 K 線、MA5/20/60、N 字 ABC 與原關卡 | 按同一日期及價格座標加標記；說明增加高度，避免裁切 |
| 個股精簡 PNG | research-v83/stock-simple-report.js | 原本只有第五段完整白話文字 | 開啟波浪時增加同份已核對資料的真實 K 線與波浪說明 |
| 原有大盤單頁 PNG | r45-report-suite.js → market-report-comfort-v864.js | 有真實大盤 K 線、MA20、量及三叉戟 | 沿用原更新流程已取得的官方指數，逐根比對同日 OHLCV 後才能數浪 |
| 獨立大盤 PNG | research-v83/market-simple-report.js | 原本只有文字，不能把網頁 SVG 當成已匯出 | 補上同份大盤資料的 K 線與均線；波浪由開關控制 |
| 獨立大盤網頁 | market-outlook.html → research-v83/market.js | 原本有實際收盤與均線 SVG | 使用大盤自己的波浪資料與日期座標，不讀取個股波浪 |

## 重用與依賴

- structure-context-v1.js 的 pivots()：左右各 3 根，保留 pivotDate 與 confirmedAt。
- shitou-wave-core-v48.js：保留既有量價波段與斐波量尺，沿用 fibLevelPrice()。不改既有分數或篩選。
- indicator-multi-v1.js 的 MACD、research-common-v1.js 的 RSI/MA/ATR、合法價格與資料驗證。
- unified-analysis-v1.js 原本已有完整五浪的有限候選邏輯；現在由 elliott-wave-v1.js 擴充，保留 legacy() 輸出介面，避免再建立互相矛盾的數浪核心。
- 新增獨立 elliott-wave-v1.js，是為了讓個股、指數與圖片共用一份結果，並隔離波浪失敗；不變更原 N 字 ABC 的資料與成立規則。
- 新增 elliott-wave-visual-v1.js 只負責開關、白話呈現與圖上座標；不計算交易分數。
- four-models-research-v1.js、research-v83/market-engine.js 附帶結構化 elliottWave；不改 Kronos 輸入、取樣與推論。
- market-report-refresh-v864.js 利用原本就會讀取的官方指數回應，經同日收盤與逐根 OHLCV 比對後綁定；沒有新增行情 API。

## 命名隔離

原有 N 字結構：A 起漲點、B 前高、C 回低，namespace=N_STRUCTURE。
艾略特推動：1～5，namespace=ELLIOTT_IMPULSE。
艾略特修正：A～C，namespace=ELLIOTT_CORRECTION，圖上加「修正」字樣。

## 版面限制

維持 1284 像素寬。關閉波浪時，原個股專業圖仍為 1284×2778。
開啟後保留原資訊與字體，專業圖為完整單張長圖；研究圖及精簡圖也依完整內容增加高度，安全上限 8192。
獨立大盤原本沒有匯出的技術圖，新增真實技術圖後可能超過 2778 高；不縮成小字，不裁切，不將一張圖拆成兩頁。
目前瀏覽器模擬以 Chromium 執行，不等於已在實體 iPhone Safari 或實際 LINE 客戶端測試。
