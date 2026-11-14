# V9.3.2 生命線修正與驗收

基準 main：aa1dd6417c2ff06e7c2b98280abbaa7c6aca39d4。原站版本 V9.3。

## 修正原因與資料契約

原分析 sourceBars 只有20根；改用相同來源的 reportBars 較長窗口前，逐根核對近期20根的日期與開高低收量一致。不同步就拒絕判讀，PNG 直接使用核心 validatedBars，避免兩種窗口混用。

原核心已記錄首次突破，但 scenario 只依原始 side 產生，導致已突破後仍等待首次突破。原 state 也把歷史型態當作當下強弱，且無連續站穩狀態。

保留 VERSION、MODEL、eventId、原 status 及原偵測公式，以維持介面與事件識別。新增 lifecycleState、currentRole、referenceOnly、originalEvent、firstBreakoutDate、firstBreakdownDate、latestConfirmationDate、lastTransitionDate、eventAgeBars、distanceFromCurrentPricePct、statusReason、dataAsOf。各次再次突破有獨立 trace eventId，原事件 ID 保留。

收盤嚴格大於才突破、收復；嚴格小於才跌破支撐。突破後相等算失守，原支撐相等不算跌破。兩根連續完成日 K 才站穩。回測必須在站穩之後另有回到關卡上下 0.5% 內的低點，前一根低點須離開容差區，收盤必須仍高於關卡。

生命線角色與歷史進展分開：即使 referenceOnly，BREAKOUT_HELD 歷史仍保留。事件與最近轉換都超過 20 根，或距現價超過三倍 ATR14 且近十根未碰到，作歷史參考。選取有效關卡時比較現價距離、事件年齡與當日結構轉換；相近相反角色視為衝突。未使用固定百分比作通用失效判斷。

currentTrend 獨立提供 MA5/10/20、距均線距離、RSI5/14、ATR14、量比、最近十根高低點及兩側各兩根確認的轉折點。chaseRisk 與方向分開，未觸發提醒不代表安全。原 state 保留相容性，報告當下強弱一律讀 currentTrend。

## 圖片與白話教學

fields() 為網頁、PNG、摘要共用模型。缺項代碼僅保留於技術資料；圖片翻成繁體中文。withSource() 在股票、日期、逐根開高低收量一致後，帶入原始價格口徑與交易日曆，並明列除權息事件未完整核驗的限制。PNG 寬 1284，依文字量增加高度，單欄深色。順序：目前價格／強弱／風險、結論、三組完整教學、原事件、歷史圖、近十根圖、當下證據、下一交易日、來源與限制。雙圖使用各自價格座標；近期圖不納入舊生命線。原事件日期及首次突破明列。手機與長文字邊界由 Canvas 實際文字量測測試。

K3～K0 是連續四根完成日 K：K3→K2→K1 嚴格高點遞增且非低點同時遞減，K0 高點不大於 K1，成立支撐取 K3 低點；相反組合嚴格低點遞減且非高點同時遞增，K0 低點不小於 K1，成立壓力取 K3 高點。未改動此規則。舊核心及報告原文保留於 scripts/fixtures/v93-life，回歸比較三檔真實歷史的 detect 結果完全相同。

## 8099 正式行情核對

證據：evidence/v932/8099-official-verification.json；逐日重新取得櫃買中心日報比對開高低收及成交股數，非預測資料。

- K3 2026-10-16：最高 70.90、最低 65.20。
- K2 10/19：最低 65.10；K1 10/20：最低 64.00。
- K0 10/21：最低 70.40，確認低點不再降低；原始壓力 70.90。
- 10/22 收盤 77.40：首次突破。下一根完成交易日 10/27 繼續站上，標記站穩。
- 11/13 收盤 182.00，原線只供歷史參考。MA5 155.10、MA10 147.65、MA20 113.925；5日乖離約 17.34%，RSI5 約 88.43、RSI14 約 87.27、ATR14 約 9.93（61根已驗證歷史窗口）。近期偏強，追價風險較高。
- 下一交易日觀察近十根高低點、平均價及成交量，不再要求首次突破 70.90。

口徑為交易所未還原成交價格。corporateActionsVerified=false，不能宣稱完整除權息事件已核驗；不把不同口徑串接。原分析若未攜帶口徑明細，報告直接標明，不能補造。

## 測試與保護

main 未修改副本：npm test，960/960 通過。Worker 契約 50/50。完整母體 1965 檔，2560 原核心 15 檔 PASS；其他五策略以既有來源與 HTML 內嵌程式 SHA256 保護。Kronos 模型、歷史及正式預測資料均未修改。

舊 life 整體 hash 因這次正式修正需要升版，另立 v932-life-baseline；其餘來源、原分析 hash、原資料 hash 與內嵌策略 hash 繼續使用 v921 baseline。未刪除或略過失敗測試。

新增研究 outcomes 模組只作獨立 1/3/5 日描述，保留未到期與資料不足；不修改原 backtest。performanceValidated=false，outOfSampleValidated=false，不能宣稱勝率改善。

## 交付限制

手機測試為 Chromium 428×926、3 倍像素與觸控模擬，非 iPhone 真機。合成狀態圖片明確標示為測試案例，不冒充正式行情。GitHub Actions、PR、合併與正式站驗證須另附實際結果，不能以本文件當作部署完成證明。
