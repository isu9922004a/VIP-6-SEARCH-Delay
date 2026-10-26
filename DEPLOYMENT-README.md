# R13 實際交付與驗收

## 部署核對
2026-10-26：GitHub main 的 version-v50.js 與公開 https://isu9922004a.github.io/VIP-BOWTOWER-4-SEARCH/version-v50.js 均為 V8.2.2-R12。R13 尚未上線。沒有執行 git push、main ref 更新或 Cloudflare 部署。本交付是可上傳檔案，不是部署成功證明。

## 盤點與依賴
原生 JavaScript 網站（index.html），不是 React。個股／掃描入口在 research-integration-v1.js；normalizeInput → 原有資料健康檢查 → four-models-research-v1.js → unified-analysis-v1.js → research-report-v1.js → 共用文字／多頁圖卡。保留原 four-models 結果為策略來源。圖卡沿用 1284×2778 與 image-share-v1.js。
六濾網：主升段／盤前在 index.html，強勢在 strong-stock-*，寶塔在 tower-*，餐廳在 restaurant-*，結構在 structure-reversal-*。這些資格、原分數、排名、排除規則與 A/B 模式核心未修改；沿用原 integration 摘要入口。
行情依賴 selection-data-v2.js、worker-data-contract-v1.js、既有快取和驗證；新增快取 key 含 R13。股數驗證沿用既有健康檢查，不放寬選股條件。主動個股查詢不新增產業排除。
大盤保留獨立 Worker 與既有渲染。只有明確 instrumentType、完成日K來源與日曆都核驗時才使用新指數報告；不滿足則保留舊報告並標示新增研究不足。**目前未完成為生產大盤 API 補齊全部 metadata，不能宣稱新版指數研究已全面啟用。**

## 修改原因與重用
- unified-analysis-v1.js：動態 MA／Pivot 價帶、九種階段、突破驗證、五情境、風險／訊號分離、成本 R/R、三分之一／漲停後候選／波浪與DIF背離。參數與 flags 集中；預設 Shadow，不寫入排名。
- four-models-research-v1.js：將共用分析掛在每份有效個股研究上；原模型不改。
- research-common-v1.js：加入可關閉的新研究 flags，重用原 normalize、健康檢查、MA、ATR、RSI、交易日曆與 freeze。
- research-report-v1.js：文字與圖片只讀同一結果；保留原模型／提醒／日週月證據。摘要不足則不製造目標。
- research-integration-v1.js：R13 快取 key、匯出檔名與 append-only 本機快照。
- research-history-v1.js：不可覆寫的快照儲存及舊假設失效轉移介面。
- market-research-v1.js、research-market-integration-r13.js：獨立指數檢查，無個股漲停及進場條件。
- research-backtest-r13.cjs：A–E 因果回放介面及保守成交模擬骨架。需要當時母體與原排名；缺少即阻擋。
- index.html、version-v50.js：載入順序、前端 R13 標示與快取、條件式大盤多頁預覽。
- workers/*.mjs：兩份附件原始碼落地、契約重建；stock 修正台北星期與可測試時間注入。market 無本次新增分析後端功能。
- .github/workflows/*：同步既有較完整的日曆驗證工作流程、main 觸發契約回歸。
- scripts/tests/*、scripts/legacy-report-fixture.cjs：保留舊格式測試在明確的 rollback presentation 下執行，新增 R13 預設功能測試。版本斷言更新 R13，沒有刪除原失敗測試。
- package-lock.json、.gitignore：鎖定瀏覽器測試依賴並排除 node_modules。

## 測試結果
基準 ZIP 原測試：22 個測試檔通過、3 個失敗。補入 Worker 後確認為真實日期錯誤、工作流程差異及內嵌格式，不是全部缺檔。
新版 npm test：26 個測試檔通過、0 失敗（包括新增 unified-r13.test.cjs）。新增測試涵蓋動態價位、相同輸入一致、風險阻擋、失效轉移、三分之一原始公式、漲停證據、Pivot 確認時間、指數隔離、原模型結果不變、flags、因果回放拒絕未來資料。
瀏覽器：Chromium，428×926 viewport、DPR3，三組合成行情；各2頁1284×2778。檢查每頁安全區、字體、文字與圖卡欄位一致；0 JS錯誤。證據 evidence/r13/。這不是 iOS Safari 實機驗證，也不是所有股票完整覆蓋。
LINE：既有分享程式未改；沒有本次 LINE App 實際收件測試，不能宣稱已驗證。
歷史回測：沒有足夠逐時點母體、原排名及制度資料；**未產生績效、假突破率、最大回撤或勝率提升數字**。目前只有回放與成交模擬的可測試骨架。

## 36 項驗收對照
01–07：完成離線代表案例；05直接驗證盤中狀態，不宣稱即時分時整合。
08–09：失效與舊停損移除介面測試完成；尚未自動跨日連接UI全部歷史訊號。
10–13：完成；漲停需逐日有效制度證據，否則未知，無鎖死判定。
14–15：自訂候選參數與可重現介面完成；未完成足夠真實紅中K正負樣本驗證。
16–18：日線Pivot候選與DIF風險完成；多週期嵌套／例外浪型／複雜替代數浪未完成。
19–21：完成代表案例；合理目標不足則不硬算。
22–23：完成指數資料隔離測試；生產指數契約補齊未完成。
24–26：原核心檔未改、既有資格與排名測試通過；不宣稱全市場逐檔歷史名單比較。
27：繁中名稱沿用並測試；未宣稱所有新上市名稱資料完整。
28：三組合成行情、兩頁圖卡通過；iPhone實機／Safari未測。
29：既有分享保留，本次LINE實收未測。
30：同一結果Schema文字圖片比較完成。
31：因果回放防未來資料完成，完整歷史績效未完成。
32–33：沿用既有契約／日期／單位檢查及回歸；未作本次全市場即時來源稽核。
34–35：完成。
36：26 個離線測試檔全部通過。舊格式回歸使用 rollback adapter；新版另測。

## 其他尚未完成範圍
報告未完整依原要求十二章／大盤十一章逐章重排。壓力帶相近候選僅作目標去重，未全面合併每個來源價帶。部分進場參考為分析均線，不是可直接下單的委託價；實際下單須重新確認合法級距。費率可配置，但未實作券商最低費／整股零股完整撮合與個人資金倉位計算。日週月以既有研究證據保留，不宣稱新增完整波浪跨週期研究。歷史快照僅本機localStorage，非跨裝置永久稽核；自動轉移UI尚未完成。統計檢定、走勢分組穩定性、完整A–E績效指標均未完成。這是安全的部分實作，不是整份原需求全部驗收。

## 上傳與回復
前端：解壓 frontend zip，將內容作為網站根目錄（index.html 在根），上傳既有 GitHub Pages 或 Cloudflare Pages；保留原服務網址及 API endpoint。需要重新部署前端。
後端：stock-worker.mjs / market-worker.mjs 是獨立 Cloudflare Worker ES module，各貼到對應服務；不要把兩份合成一個服務。沿用原環境變數／bindings／路由。stock 的日期修正要重新部署才生效；market僅內嵌契約格式同步，沒有新版分析API功能宣稱。不提供虛構 account ID 或 wrangler bindings。
部署後以無快取URL讀取 version-v50.js 確認 DISPLAY 與 fileVersion=V8.2.2-R13，再實測一檔有效個股、多頁圖與下載。公開GitHub repository更新不必然代表Pages已發布，必須讀網站版本確認。
回復：使用原附件ZIP完整還原前端，或將GitHub main回復至基準commit。Workers用原兩份TXT還原。前端研究可先透過 ShitouResearchIntegration.setFlags({unifiedResearchEnabled:false,marketContextEnabled:false,oneThirdEnabled:false,postLimitupEnabled:false,waveEnabled:false}) 回到舊報告路徑；不更動原排名。不要刪除既有歷史快照來假裝從未出現訊號。
