# 吞沒三關、箱體及假突破研究交付

基準 GitHub main：`f1a919344ed2b9395bd1cfcf095f9712e107b548`，實際版本 V8.6.4。
本次是研究附層，不升級正式預測模型，不改正式六策略資格、分數、TOP8、原停損或 Kronos。

## 完成範圍與正式啟用判斷

已實際修改計算核心、事件生命週期、共用結構化輸出、中文收合介面、研究圖片及四組比較框架；不是只改報告文字。
**維持研究模式，不適合提升為正式進場或排名規則。使用者已授權修復後直接部署研究介面；正式部署結果以 PR #9、GitHub Actions 與交付回覆為準。Worker 服務碼與契約未修改，不需另外部署。**
兩支舊瀏覽器測試已修復：更新實際版本／圖卡契約，使用正式入口展開收合卡，保留逐欄比對。亦修正網頁段落換行、長名稱超出圖界、手機圖卡漏傳個股模式；未放寬資料安全閘門。台股 A/B/C/D 績效仍缺證據，不能宣稱改善。

原目錄 `/workspace/repo` 的 303 個程式檔 SHA256 均與修改前相同，詳見 [原工作保護檢查](original-preservation.json)。完整隔離修改位於 `/workspace/engulf-range-research`，本地基線提交 `3f2baed`。依賴與修改前能力見 [架構盤點](architecture.md)。

## 檔案及原因

| 檔案 | 修改原因 |
|---|---|
| structure-context-v1.js | 在既有結構核心擴充吞沒、三關、逐日事件、箱體與假突破；統一中文結論及原風控衝突 |
| research-common-v1.js | 增加研究附層旗標，不改既有指標公式 |
| unified-analysis-v1.js | 傳入研究旗標與獨立參數，不讓新結果參與原 entryDecision |
| four-models-research-v1.js | 共用同一個 frozen 研究結果，向 foundation/report 傳遞；既有模型及排名不變 |
| research-foundation-v1.js | 接收上述結果，獨立呼叫時仍使用同一計算核心 |
| price-action-context-v1.js | 以延遲依賴消費同一核心，不另建競爭算法、不增 concerns 或放寬資格 |
| price-action-integration-v1.js | 暴露同一快照的確認結果，不增加行情 API |
| research-report-v1.js | 單一 view 同時供中文文字、完整研究報告及圖片；欄位標題獨立避免去重遺失 |
| research-integration-v1.js | 加入預設收合面板；個股原四策略研究亦預設收合；六策略沿用原入口 |
| engulf-range-report-v1.js（新增） | 僅顯示介接：手機單欄、量測文字後畫 1284×2778 PNG、浮水印，沿用既有圖片預覽／分享 |
| market-research-v1.js | 原大盤研究附上同一核心結果，不改既有趨勢判斷 |
| research-v83/market-engine.js | 獨立指數資料沿用同一確認核心及原 Kronos／regime |
| research-v83/market.js | 以已載入指數新增收合面板；不增加行情請求 |
| research-v83/market-simple-report.js | 原 PNG 預覽增加可選研究 canvas，沿用下載／LINE；原圖繪製不變 |
| market-outlook.html | 補上 version → tower → common → structure → presenter 的正確依賴順序與面板 |
| index.html | 載入顯示介接，刷新研究與換行／手機圖卡快取鍵 |
| research-action-guide-v1.js | 段落之間加入真實換行節點，使網頁與匯出文字逐字一致 |
| research-v83/iphone-summary-renderer.js | 長股名依實際寬度換行，必要時壓縮卡片間距保留1284×2778與完整文字，補齊個股／濾網模式稽核 |
| scripts/tests/research-browser.cjs | 對目前版本、摘要與完整圖片各自契約作驗證；保留原價位、七入口、風控與分享測試 |
| scripts/tests/research-context-r16-browser.cjs | 明確檢查預設收合，再透過實際卡片摘要打開研究 |
| scripts/tests/kronos-network-recovery.test.cjs | 歷史資料與每日模型採同一asOf，避免隔天資料更新使測試混日 |
| scripts/tests/limited-official-history.test.cjs | 按官方交易日計算新增天數；量能口徑衝突使用明確可控測試，不借每日變動股票狀態 |
| scripts/tests/official-full-volume-fallback.test.cjs、scripts/fixtures/2330-official-archive-manifest-20261103.json | 固定11/03的FULL範例對照同日官方封存行情；單股測試索引保留原SHA與日曆，不當績效母體 |
| scripts/verify-deployed-frontend.py、.github/workflows/deploy-frontend.yml | 部署前跑完整程式、兩支舊瀏覽器及新增研究測試；發布後核對實際檔案並驗證線上研究入口 |
| version-v50.js | V8.6.4 保留，新增研究版本及快取鍵，不宣稱新正式模型版本 |
| research-validation-v1.js | 增加固定原榜次序的 A/B/C/D 配對比較、缺資料阻擋、成本及樣本外介面 |
| scripts/compare-engulf-range.cjs（新增） | 無網路下載的本機官方歷史稽核；有合規 PIT 輸入時呼叫同一 validation 框架 |
| package.json | 提供 research:engulf-range 及 test:engulf-range-browser 命令，鎖檔及依賴版本不變 |
| scripts/tests/engulf-range-fixtures.cjs（新增） | 明確標記的合成 OHLCV、日期與契約測試資料，不作績效證據 |
| scripts/tests/engulf-range.test.cjs（新增） | 24 項型態／三關／生命週期／箱體／資料與前瞻測試 |
| scripts/tests/engulf-range-validation.test.cjs（新增） | 10 項配對比較、成本、TOP8 原序、原六策略不變及衝突優先序測試 |
| scripts/tests/engulf-range-market-load.test.cjs（新增） | 2 項真實腳本順序及指數身分／日期／價格安全測試 |
| scripts/tests/engulf-range-browser.cjs（新增） | 9 項真實應用瀏覽器測試：收合、手機桌面、PNG、一致性、分享及大盤 |
| docs/engulf-range/*（新增） | 架構、交付、機器可讀稽核、測試及工作保護證據 |

`stock-professional-v84.js`、`worker-data-contract-v1.js`、兩支 Worker 及 Kronos 推論模組未修改。新增獨立模組僅為顯示／驗證工具，計算核心集中在既有 structure-context，不另建一套模型。

## 新算法及判定

- BODY_ENGULFING：前日與當日實體方向相反、當日實體完整覆蓋；實體邊界允許相等。方向只看 OHLC，不讀畫面顏色。
- FULL_RANGE_ENGULFING：在實體吞沒上，再要求高點與低點各嚴格越過前日影線至少一個合法跳動價。實體與全幅為分開事件，同股同日績效只計一次。
- 三關：型態、收盤嚴格越過前日極值、當日量大於前日且除以前五根均量至少 1.2；前五日不含當日。缺量、口徑衝突或單位不一致不通過。
- 訊號日只可能是型態候選／嚴格初步通過；後續三根完成日 K 收盤越過訊號高／低價，且原三關通過，才確認延續。三根為可調研究參數。
- 逐日記錄確認、失效、逾期與反吞；失效後不復活。每個事件保留原始前後 K、三關、量比、失效價、來源、參數版本與日歷程。修改參數會改參數雜湊，避免同名混算。
- 同日高低同時觸及研究目標及失效，吞沒／箱體均保留 ORDER_UNKNOWN，沒有已成交獲利值。研究目標不自行臆造。
- 箱體僅使用事件日前完成日 K：8–20 根、寬不高於 2.5 ATR14、接近容忍至少一跳或 0.25 ATR14、上下各至少兩次分離測試。MA10 每根斜率／ATR 不高於 0.2、淨位移與線性趨勢不高於箱寬 0.6、同向步伐比例防護 0.8，避免單邊趨勢冒充盤整。
- 成形後箱頂底凍結；箱體候選最長保留 20 根，未發生訊號才可重找。突破日高低絕不拿來重新畫突破前邊界。此法與既有三角及前20日高點突破分開。
- 盤中刺穿但收回：INTRADAY_REJECTION；收盤越線但未完成量價／後續：PENDING；有可靠量能、收盤位於當日上方60%／下方40%且後續完成 K 守穩：CONFIRMED；回測原邊界並守穩：RETEST_HELD；收盤回原箱內或邊界：FAILED。向下條件對稱。
- 原策略阻擋、假突破失效、量能證據不足優先於「已確認」標題；原 ABC/N、MA20、RSI、成本後風險報酬繼續獨立檢查。研究失效價不覆寫原停損。
- 來源沿用原 Worker 契約／官方指數來源；嚴格核對商品、市場、日期、連續性、OHLC 合法跳動、量單位與統計口徑、價格調整及公司行動。缺證據不補 0、不借未來資料、不新增行情 API。

以上全部為未經績效驗證的預先研究門檻，不是最佳參數。歷史價量聚集不等於真實委託簿、主力成本或交易意圖。

## 可重現的實際計算例（合成測試，非真實個股）

前 K：開20.50、高21.00、低19.50、收20.00、量100,000股。
訊號 K：開19.95、高21.20、低19.40、收21.10、量150,000股；前五根均量100,000股。

實體吞沒=true，全幅吞沒=true；收21.10 > 前高21.00；前日量比1.50、前五均量比1.50，所以三關初步通過。
當日仍是 STRICT_CONDITIONS_PASSED，不是反轉成功。後續完成收盤須高於21.20；收盤低於19.40則失效。日後若同根高23.00、低19.00，同時碰到目標22.00及失效價，先後不明，不能算獲利。

箱頂21.00／箱底19.00 的合成箱體：當日最高21.50但收20.50為盤中刺穿未突破；收21.80且量比1.50先列待確認；下一完成 K 收22.00、最低仍高於容忍帶可確認；若之後收20.50，為突破失敗，箱頂底仍保留21.00／19.00。

## 實際測試

最終紀錄見 [測試摘要](tests-summary.json)，完整原始 log 保存在 `/workspace/engulf-*.log`。

| 命令／範圍 | 實際結果 |
|---|---|
| npm ci --cache /workspace/engulf-npm-cache | exit 0，鎖定依賴安裝成功 |
| npm test（最終程式） | 657 項通過、0 失敗；包含新增36項單元／比較／腳本載入測試 |
| npm run test:contract | exit 0；Node runner列2個測試檔通過 |
| npm run research:validate | exit 0；結果為 BLOCKED_MISSING_POINT_IN_TIME_HISTORY，不能當績效通過 |
| node scripts/compare-engulf-range.cjs | 完成1959檔本機稽核，四組績效保持null |
| 新增手機／桌面瀏覽器 | 9/9通過；428×926、390px、1280px；兩種1284×2778 PNG欄位等於文字；無裁切；LINE單張；過時面板不得產圖；獨立大盤無未捕捉錯誤 |
| 舊 market-comfort-browser | 通過；7種圖卡情境、自動更新／同日修正、手機滿版與原圖分享等檢查 |
| 舊 market-v862-browser | 通過；模型請求失敗重試、缺資料提示與恢復 |
| npm run test:browser | 最新29項通過；舊斷言改為目前版本及摘要／完整圖各自稽核；完整價格與停損證據仍檢查 |
| research-context-r16-browser | 正常與備援模式均通過，七檔實際查詢與七入口逐欄比對、線圖及風控保留 |

沒有刪測試、跳過失敗或把未跑項目列成功。基準一開始在未授予瀏覽器／bash環境權限下曾遇 spawnSync bash EPERM，取得環境權限後 npm test 全套通過。前輪失敗與基準比較紀錄保留；本輪修正實際排版／模式問題與測試資料混日，沒有刪除測試或解除原安全閘門。

PNG下載維持1284×2778；個股 LINE 沿用原系統單張JPG分享、PNG下載的既有流程；獨立大盤沿用原生PNG分享。新增研究圖不取代原專業個股圖或已核准的大盤含線圖版本。

## A/B/C/D 比較與資料缺口

四組：A原榜；B原榜AND已完成吞沒三關／後續確認、且沒有有效空頭反訊；C原榜AND箱體過濾（有箱體須向上確認／回測守穩，無箱體為中性）；D同時符合B及C。只作比較，不回寫正式榜，保持原序、不補滿TOP8。
使用共同可驗證五日結果母體；日標籤驗證完成OHLC及交易日；缺標籤另列，缺研究輸入整組阻擋。同股同日及快照重複拒絕。預設固定參數，禁止訓練／測試期間重疊。

輸出包含訊號數、次日收漲比、1/3/5日收盤報酬、五日內收回突破線比例、訊號後最低價不利幅度、已核驗成交後MAE、原成本計畫RR、錯失原本五日收盤成功股票、原TOP8覆蓋及報酬、歷史母體覆蓋、成本後進場收盤估值。沒有出場成交證明時，估值仍非已實現獲利，當日最高觸及目標不算成交。跨日同股依賴未完成統計校正，不宣稱改善。

[完整歷史稽核](archive-audit.json)：本機官方快照截止2026-11-03，日K涵蓋2026-03-11～2026-11-03，來源日檔320份、股票1959檔（上市1086、上櫃873），並非目前全台股無偏歷史母體。

- 1959檔都有原資料契約；0檔有完整公司行動核驗旗標。
- 新嚴格附層：1930檔公司行動證據不足、25檔完成日K不足、4檔商品／跳動規則未核驗；均返回資料不足。
- 缺逐日含下市股票的歷史母體、原六策略歷史分數與TOP8、當日發布時間及可執行成交成本證據。
- 可比較的合規歷史快照未提供；A/B/C/D的樣本數、勝率、1/3/5日績效、假突破、MAE、RR、漏失率及成本績效均為未知（null），不是0%也不是已證實改善。

不能靠把 corporateActionsVerified 改為true或重建今日成分股歷史來繞過缺口。若補齊合規PIT快照，可執行 `node scripts/compare-engulf-range.cjs input.json result.json`，格式沿用validate框架並附加engulfRangeResearch、五日完成標籤及split。

## 尚存風險、Git與回滾

新規則沒有台股樣本外績效證據；合法普通股／指數以外商品返回資料不足；官方停牌、公司行動、來源補檔須保持同日可得證明；日K不能知道盤中先後、掛單或成交。長文字若無法在安全字級排入一頁會明確停止產圖，不裁掉資料。

工作先保存在獨立研究分支與PR #9；本輪按使用者指示在驗證成功後合併main，交由有測試閘門的Pages工作流程發布，並核對線上檔案。部署成敗以Actions及交付回覆為準。兩支舊瀏覽器的基準失敗已修復。Worker wire schema、嵌入契約與服務碼未改，**本次不需要也沒有Worker部署**。前端更新絕不代表Worker更新。

快速關閉個股附層：`ShitouResearchIntegration.setFlags({engulfRangeResearchEnabled:false})`；純核心呼叫以`confirmationResearch(report,{enabled:false})`。這是研究開關，不改原策略。
完整回滾使用本次研究提交的 `git revert <研究提交SHA>`；若未合併，關閉草稿PR即可，正式站沒有任何變更。不使用reset、force push或覆蓋整個main，避免抹去後續行情更新或他人工作。
