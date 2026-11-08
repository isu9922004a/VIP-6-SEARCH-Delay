# 大盤波浪圖片同步白話版

範圍：主頁及獨立大盤入口的「大盤波浪分析圖片」，保留V8.7.2、1284×2778、真實K線與原始觀察價。公開版本升為V8.7.2，快取更新為MARKETWAVE2。

## 原流程與這次修改

`elliott-wave-report-v1.js`原本以renderLegacy產生大盤波浪PNG，個股已使用stock-beginner第三版。主頁的大盤價位來自MarketComfortReport；獨立頁來自regimeAnalysis.levels。這次沿用各入口既有來源，不修改兩套來源的計算，也不把網頁有圖當成匯出有圖。

新增`elliott-wave-market-beginner-v1.js`是大盤專用的顯示映射及畫布排版，因為大盤關卡不能套用個股openingPlan或個人認賠價。沒有新增數浪、指標、支撐壓力或交易核心。仍以`elliott-wave-v1.js`的已驗證結果及`elliott-wave-visual-v1.js`真實K線圖為依據。

從既有個股模板抽出`waveReading`純顯示函式，讓兩種報告對相同浪型使用同一組白話說明；個股原說明與版面保留，版號同步更新。完全同價標籤沿用既有groupPrices，保留每個成員的來源、用途及日期，不將近似值合併。

新版包含：

- 整體方向與近期方向；不把反彈當成已確認轉強。
- 現在可能第幾浪；不合規則／資料不足／過去浪型分開說明，不硬標1～5。
- 真實大盤K線、均線、成交量、既有浪號及價格標籤。
- 還沒買的人：主要及備用觀察情境；收盤站回、剛好到價、已在上方用不同說法。站回不等於個股可以買。
- 已持有的人：核對個股原買進理由及停損。大盤失守關卡只提示整體風險，不自動產生個股認賠價。
- 原報告三條關卡保留原值；缺少就說明，行情未核對時不補畫、不猜價。

模型保留trendReason、recentReason、mainScenario、alternativeScenario、watch、support、rawChartLevels與同價成員。文字及PNG使用同一份marketBeginner物件。entryEnabled固定false、entryRange及personalStop為null，因為這份大盤圖不負責核准個股買賣。

## 保持不變

不修改行情、日曆、ABC/N字、艾略特數浪規則、轉折確認日期、Kronos推論、正式評分、排名、個股進場資格、原停損及Worker。無額外行情API請求；原浮水印、下載及分享流程照舊。個股波浪圖、個股專業／精簡及其他大盤圖片以同輸入以相同V8.7.2版號的對照環境驗證PNG雜湊；實際舊版圖片的版本文字會更新。

兩入口各用其原有分析關卡，可能不同，不能為了圖面一致而偷偷替換計算來源。測試及預覽均標示來源；正式預覽使用同一份完成日行情，合成情境只用於測試，不冒充真實大盤。

## 檔案及驗收

- `elliott-wave-market-beginner-v1.js`：新增大盤白話模型、三價位、兩情境及安全畫布。
- `elliott-wave-stock-beginner-v1.js`：只抽出既有waveReading供共用，保留個股文字與PNG。
- `elliott-wave-report-v1.js`：大盤分流至新模板，分享身分含大盤白話資料；個股維持原路徑。
- `elliott-wave-visual-v1.js`：新增indexChart顯示選項，使用「大盤／平均指數」字樣，圖形計算沿用原函式。
- `index.html`、`market-outlook.html`、`version-v50.js`：新增模組引用及快取更新，不移除或重排原有模組。
- `scripts/verify-deployed-frontend.py`：正式站位元組核對增加新模組。
- `scripts/tests/market-wave-beginner.test.cjs`：大盤缺項、同價、站回狀態、共用浪號及不產生買賣價的單元驗證。
- `scripts/tests/market-wave-clear-browser.cjs`：兩入口真實圖改前後、其他圖種雜湊、價位座標、手機及下載分享驗證。
- `scripts/tests/elliott-browser.cjs`：舊固定why卡片斷言改為新模板安全契約。
- `scripts/tests/stock-wave-clear-browser.cjs`：保留個股比較及未修改圖種的雜湊比較；大盤波浪是本次預期變更，改由專用市場測試負責。原來上次發布的八種不變證據仍保留在PR23。
- `.github/workflows/market-wave-clear.yml`：專用改前後、回歸及圖片證據。

實際測試結果、預覽及部署狀態見本次PR／Actions。research:validate仍可因缺少歷史時點證據而保留研究限制；不宣稱這次顯示更新改善勝率。

只部署Pages前端，Cloudflare Worker無需更新。回滾以revert本次合併，保留其後行情及其他工作。

邊界補強：近3交易日收盤持平時，即使整體偏強或偏弱，也明確寫「近期價格大致持平」，不誤稱近期上漲或下跌。新增單元測試；既有日期的圖片不變。

依使用者要求，頁首、工作台、專業／精簡／波浪圖片與浮水印版號統一V8.7.2，並同步更新資源快取及正式站版本驗證。研究引擎與歷史資料契約的內部版本不變，封存行情／模型檔案不改寫。
