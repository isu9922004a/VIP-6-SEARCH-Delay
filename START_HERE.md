# 石頭少爺 V50 寶塔線本地研究整合包

**已完成可檢查的本地SHADOW實作；尚未達到全部正式驗收，未部署。** 母版R5.3.2.8.1保留，新包版本R5.3.2.8.1-TOWER-SHADOW.1。共用T2/3/5核心、第四獨立A/B全量掃描、七級個股／大盤診斷、七節TXT與1284px專業個股長圖已實作。

原三套策略資格／分數／排序保持。54個母版檔案中50個byte不變，只有index載入、版本資訊、原圖片套件顯示版本及第三UI觀察接點修改；原12個inline與策略核心雜湊不變。完整母版備份與一鍵還原工具已提供。

測試與證據以`verification/`實際紀錄為準：新核心30項通過，瀏覽器30項通過（最終版本重跑紀錄），含第四真實UI的151檔合成全量掃描。這些是程式驗證，**不是實際市場全量掃描或績效驗證**。母版3項舊測試失敗及1項SKIP另有完整紀錄。

先讀 [測試與正式部署前驗收](測試與正式部署前驗收.md) 和 [使用教學與資料契約](使用教學與資料契約.md)。本地預覽：`agent-v50-tower-shadow/Preview.cmd`；還原：包根`Restore-Original.cmd`。網路查詢會沿用母版既有Worker，未連線驗收的FULL服務可能失敗或缺字段；遇缺資料會明示，不能用原資料不足結果冒充全市場零候選。

## A–T交付索引

|項目|成果|驗收狀態|
|---|---|---|
|A 書籍閱讀稽核|[閱讀報告](書籍閱讀與規則稽核.md)、[124圖清冊](書籍逐圖稽核.csv)、book-image-manifest.json|六章OCR通讀與重要圖核對；所有圖表數字人工核對未完成|
|B 原規則及頁碼|閱讀報告B01–B13，原規則／圖形觀察／工程假設分離|T參數表採用明示來源；軟體逐柱對照待驗證|
|C 原問題與呼叫路徑|[呼叫路徑報告](程式呼叫路徑與修改差異.md)、function-override-inventory.json|已交付；函式清冊為樣式搜尋非完整AST|
|D 修改清單|modified-files.json、changes.patch、integrity-check.json|4既有檔修改、12新增；50既有檔未變|
|E 四策略完整程式|agent-v50-tower-shadow完整66檔專案|原3策略保留＋第四SHADOW|
|F 第四A/B|tower-gold-scanner.js、tower-trend-classifier.js、tower-integration.js|合成與UI全量測試；真實服務待驗證|
|G 七級核心|tower-line-core.js、tower-risk-adapter.js、tower-trend-classifier.js|單元、同輸入一致性通過；工程閾值未校準|
|H 個股整合|原查詢／文字／附加HTML／professional renderer接點|本地合成驗證；原Worker真實資料待驗收|
|I 大盤整合|同核心index模式、原大盤HTML／文字／圖片包裝|核心免除個股流動性測試；真實大盤源待驗收|
|J 專業圖|verification八情境PNG與JSON|1284動態高度、D/F原文字單欄；實體手機與全部小卡重排未完成|
|K 寶塔圖|專業圖T3/T5單色前收→今收柱體|不是普通K圖或均線換色；鬼臉混色版未實作|
|L 四策略測試|verification/tower-core-tests.txt、browser-results.json、baseline-tests.txt|新測試通過；原舊測試3失敗，原真實全量服務未驗證|
|M 歷史回測|[回測報告](歷史回測與資料缺口.md)、historical-data-audit.json、回測引擎與CLI實際拒絕結果|UNAVAILABLE；不能宣稱績效改善|
|N 新舊差異|changes.patch、修改清單、呼叫路徑報告|原主資格未改，新增研究觀察層|
|O 未解問題|正式驗收報告殘餘風險清冊|具體列明，未隱藏|
|P 可還原包|original-master.zip、Restore-Original.cmd／ps1、rollback-test.json|原備份SHA256與54檔實還原核對|
|Q 版本資訊|version-v50.js、core.RELEASE／MODEL、主頁／TXT／新PNG|統一研究版本；原內部算法ID保留來源意義|
|R 部署前檢查|正式驗收報告25項對照|HOLD；全部驗收未通過，未部署|
|S 使用教學|使用教學與資料契約|入口、停止、TXT、詳細查詢、資料／成本契約與還原|
|T 失敗與假設|baseline紀錄、正式驗收報告、閱讀歧義與回測限制|已交付完整清冊；未聲稱零殘餘風險|

圖片與掃描報告中的「合成測試」不是任何真實股票當日行情。新分數不是上漲機率，盤後條件不是明天盤中已確認買點。現有14日歷史快照不足以完成原要求的跨策略、樣本外、成本及風險調整績效比較。

