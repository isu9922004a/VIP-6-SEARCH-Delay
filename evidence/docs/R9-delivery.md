# 石頭少爺 V8.2.2-R9 修復交付

本次為程式與離線／瀏覽器重播驗證交付，**尚未通過正式部署後的全市場驗收**。沒有部署 Cloudflare、合併 main、修改 Token、Service Binding 設定、KV 內容或正式行情檔案。

## 來源核對與重現範圍

GitHub 基準及提交前再次取得的 main 都是 `0a3e5add9d387a351b141688316aab8604a2f0ee`。使用者 ZIP 的 163 個檔案全部與該基準逐位元相同，採最新 GitHub main 建立 `codex/r9-worker-data-contract`。

附件對應：`142bf23d…/貼上的文字.txt` 是個股 Worker，`878a6217…/貼上的文字.txt` 是 Market Worker。兩份附件各有 10,005／4,333 個內容行（若把結尾空行計入則 10,006／4,334）。原始 SHA256、線上版本、ZIP 比對結果見 `evidence/source-versions.json`。線上版本字串、路由與附件相符；未取得 Cloudflare 已部署原碼，**無法證明部署程式與附件逐位元相同**。

2026-10-26 09:03 台北時間執行五個唯讀正式請求：網站版本、ALL_STOCKS、6173／4526 批次 DAILY_ONLY、6173 直接 DAILY_ONLY、6173 FULL，皆 HTTP 200，原始回應與回應表頭保存在 evidence。沒有把 HTTP 200 當成資料驗證成功。

已確認／重現：

- 補K來源字串不符與假K清理 metadata 漏算：由附件確認，使用明確標示的模擬補K／假K重現，不宣稱當次正式 API 有進入補K路徑。
- 6173 本次真實回應有七個平日零量K（10/07、10/08、10/12–16）；前端確實拒絕。沒有休市證據，保留這些列，不刪除、不補假量。過往來源字串故障本次未在線上重現。
- 4526 本次捕獲序列有效；以其回應做明確標示的變異測試，重現原始量變動被舊指紋掩蓋的問題，沒有把變異資料當成實際行情。
- 1,949 檔快照有 16 檔量值均價落在日K區間外，詳見 `evidence/volume-scope-audit.json`。這是統計範圍待查證，不能認定資料造假，也沒有推估／扣除鉅額交易。

完整根因表見 `R9-root-causes.md`，兩份 Worker 的附件前後差異見 `R9-stock-worker.patch`／`R9-market-worker.patch`。

## 實際變更

1. 新增 `worker-data-contract-v1.js`。兩份完整 Worker 內嵌同一份程式，獨立檔案即可部署，不依賴外部 import。`node scripts/build-worker-contract.cjs` 可重建內嵌區，測試逐位元比對。
2. 契約包含版本、來源、模式、股票／市場、完成日、完成狀態、成交量單位及解析器證據、根數、原始／標準化指紋、官方補K與逐列證據、快照驗證狀態。單純改 source 字串不能取得官方補K資格；未知解析器、缺少證據、股／張衝突仍拒絕。舊版只保留已核對附件解析器的精確來源契約，並做獨立同日 OHLCV 核對；裸 `volumeUnit=shares` 或偽造 audit 不算證據。
3. Worker 在清理及補K完成後，以 `countScope=RETURNED_SERIES` 重算根數、首末日期、排序、完成狀態、canonical/daily 數量。較長上游視窗的數量另存 `upstreamHistoryCounts`。本系統 canonicalBars 若提供，定義為 dailySeries 同一視窗；沒有聲稱不同視窗本來必須等長。
4. 只移除可核驗休市日的零量平價占位K。合法交易日零量列保留；非平價休市列、新的真正交易日、重複日期的量價衝突均拒絕。相同重複列可去重。
5. 保存 `originalDailySeries`、`sourceDailySeries`、原始指紋、回應指紋及研究指紋。有效快取凍結；新序列若有可驗證官方插入資料及前版指紋鏈，建立新歷史身分重新驗證；其他漂移隔離且不覆寫舊有效資料。新舊快照、並行 pending、失敗回應不得污染快取。
6. 沒有證明市場量與日K量統計範圍相同時，保留日K來源量，不再用市場總量覆寫。兩者仍必須通過既有 20% 差異閘門。均價超界保留原始量值並隔離正式量價判斷；不認定假行情。這可能改變量能條件的結果，屬輸入口徑修正，不是改門檻。
7. DEEP_SCAN 使用可識別的八類 failureCode。完成市場快照先驗證，再做完整 OHLCV／單位契約抽樣。每個涉及市場至少兩個健康樣本；一檔異常可找同市場補位，兩個日期／價格衝突視為系統性錯誤停止。重試最多三輪、每市場補位最多三檔。成功抽樣不代表全市場通過。健康檢查隔離名單傳入強勢及寶塔後續掃描，該輪不進入正式排名。
8. FULL 不能借有效日K快取掩蓋它自己提供的壞 OHLCV。研究七入口繼續使用共用核心；策略研究 A/B 另做比較。
9. 新查詢使舊圖片、分享檔、下載連結及尚未完成的字型等待預覽失效。版本、資源查詢版本、報告預設版本與輸出檔名升 R9。保留原介面。

MA／RSI／KD／MACD、支壓、六套門檻、分數、排名、停損停利、排除產業及四模型公式沒有改寫。資料契約正確接受／排除、日K來源量保留後，候選數或報告狀態可能改變。量價口徑仍待官方明確定義；[TWSE 每日市場成交資訊](https://www.twse.com.tw/zh/trading/historical/fmtqik.html) 本身列有一般／零股／盤後定價／鉅額等統計範圍，不能據此推定每個不同 API 的個股量值與 OHLC 一定同口徑。

## 測試指令與結果

完整可機讀結果見 `evidence/test-results.json`，完整單元測試輸出見 `evidence/unit-tests.txt`。

|實際執行指令|結果|界線|
|---|---|---|
|修改前 `node scripts/run-all-tests.cjs`|257 通過、0 失敗|基準|
|修改後 `node scripts/run-all-tests.cjs`|300 通過、0 失敗、0 跳過|含原有測試，未刪除失敗測試|
|`node --check workers/stock-worker.mjs` 與 market-worker|通過|語法檢查|
|`node scripts/tests/research-browser.cjs evidence/browser-ui`|29 通過、0 失敗|實際 DOM／canvas、428px 手機視窗、七研究入口、圖片分頁、分享 API 模擬|
|`node scripts/tests/research-worker-browser.cjs evidence/browser-worker`|通過|真實捕獲的 9933 回應，經實際查詢按鈕重播|
|`node scripts/tests/research-multi-stock-browser.cjs evidence/browser-multi-stock`|7 檔、49 次研究入口比較通過|歷史捕獲回應；驗證摘要／完整圖與卡片，不是全市場策略資格驗收|

Windows 本機使用已安裝的 Edge／Chromium 與既有 Playwright runtime。可依環境設定 `PLAYWRIGHT_MODULE`、`CHROME_BIN` 後重跑上述瀏覽器指令；乾淨環境可安裝 package.json 指定的 playwright-core，並提供瀏覽器執行檔。所有瀏覽器測試均為桌面 Chromium 模擬手機視窗，**不是實體 iPhone Safari 或真正 LINE 送出**。

新增測試涵蓋合法／偽造補K、來源／單位／股票／市場／日期／OHLC／20% 閘門、假K後 metadata、平日零量保留、假日／臨時休市／跨月跨年／缺日／重複日期、原始量變動、有效版本更新與不明衝突、併行去重、快照轉換與 pending 競態、同市場健康 quorum、個股隔離、系統性失效、四種 Service Binding 模式路由，以及圖片跨查詢狀態。既有測試的版本期待值與新依賴已更新；原本只有收盤價的健康假資料改成明確的完整模擬契約，單位測試保留其他 metadata 以單獨測量單位衝突。

新增 GitHub Actions 只執行離線測試、Worker 語法與內嵌重建檢查，沒有部署動作。首次 PR CI 的雲端結果與本機結果分開記錄。

## Cloudflare 部署順序與核驗（尚未執行）

1. 維運者先從 Cloudflare 匯出兩個正式 Worker 原碼、目前 version/deployment ID 與 Binding 清單，對照本交付的來源 SHA256。若不相符，先套用本交付差異到最新部署原碼再驗證，不直接覆蓋未知新修正。
2. 先將 `workers/stock-worker.mjs` 部署至測試 Worker。對 FULL（預設）、`mode=DAILY_ONLY`、`mode=MOMENTUM_LITE`、`mode=SCAN_LITE&profile=CORE` 各測上市／上櫃，核對原始日K、單位證據與 C.verify。
3. 將 `workers/market-worker.mjs` 部署至測試 Market Worker，其 `FIB_API` 指向上一步測試個股 Worker。服務名稱沿用既有設定；不提供或更動 Token／KV／正式綁定。測 ALL_STOCKS 和 `market=DEEP_SCAN&codes=…&markets=…&profile=DAILY_ONLY`，再測其餘 profiles。
4. 核准正式部署後，依「個股 Worker → Market Worker → 前端 R9」更新，保留舊部署版本。股數與模式相容性、補K metadata、來源指紋必須一起驗證。新 locator／official-month schema 只隔離新的快取命名空間，不刪除既有 KV；這是需要列入維運檢查的程式內快取 schema 變更。
5. 最後執行六套策略完整正式全市場掃描、個股研究交叉比對、實體 iPhone Safari 與 LINE 分享。逐檔統計母體、初篩、深掃、成功、資料不足、服務失敗、排除、符合與完整性；無候選與驗證失敗必須分開。任何未完成項不得標示全市場完整認證。

## 回復方法

正式尚未部署，現在不用回復。日後若需回復：先在 Cloudflare 將 Market／個股各自回復至部署前保存的 version ID，保持原 Binding；前端用獨立回復 PR 恢復部署前 commit／R8 資源版本，不強制推送、不直接覆蓋 main。不要刪除或改寫 KV；新舊 schema／版本有各自命名空間。

## 尚未實測與限制

- 新版 Worker 的正式 Cloudflare 執行、部署後外部供應來源與 Service Binding：尚未實測。
- 六套正式策略全市場完整掃描／正式排名：尚未實測。
- 實體 iPhone 12 Pro Max Safari、真正 LINE 接收與送出：尚未實測。
- 16 檔量值範圍的官方逐端點統計定義，及 6173 零量日期的來源更新／停牌原因：未取得足夠證據，保持隔離。
- FNV 指紋用於可重現內容身分與差異追蹤，不是來源數位簽章；SHA256 檔案清單用於交付完整性。資料可信度仍依賴受控 Worker、TLS 來源、解析器、獨立行情與補K證據核對。

GitHub 更新清單與檔案 SHA256 見根目錄 `V8.2.2-R9-CHANGE-MANIFEST.json`；完整可部署 Worker、前端、測試與證據均包含在本專案及交付 ZIP。
