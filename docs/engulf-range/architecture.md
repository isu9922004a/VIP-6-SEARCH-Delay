# 修改前盤點與差異

基準：GitHub main `f1a919344ed2b9395bd1cfcf095f9712e107b548`，version-v50.js 顯示 V8.6.4。
原目錄 /workspace/repo 未改動；完整副本位於 /workspace/engulf-range-research，修改前 SHA256 清單另存 /workspace/engulf-range-original-sha256.json。此本地 Git 基線不收錄大型 data / evidence / node_modules，歷史行情仍完整保留供驗證。

| 模組 | 既有能力及依賴 | 本次差異 |
|---|---|---|
| worker-data-contract-v1.js | 身分、完成日期、原始/標準化指紋、量單位解析器；由兩支 Worker 嵌入 | 沿用驗證器，不改 wire schema，不部署 Worker |
| research-common-v1.js → tower-line-core.js | 日K驗證、合法跳動、ATR、均線、研究旗標 | 增加研究旗標；正式分數/排名不變 |
| structure-context-v1.js → research-common | 吞沒候選、量來源、前20日突破、回測、三角/W底 | 唯一新增計算核心：區分實體/全幅、三關、生命週期、事件日前凍結箱體、假突破 |
| price-action-context-v1.js | 完成K驗證、既有三種位置事件與三根追蹤 | 消費 structure-context 新研究結果，不複製另一套吞沒/箱體算法、不加入正式 concerns/gates |
| research-foundation-v1.js → common | 三日結構、葛蘭碧、錘子/十字反轉 | 接收同一研究結果，保留原判斷 |
| unified-analysis-v1.js → common/indicator/structure | 原結構關卡、量價、風險報酬、正式研究情境 | 傳遞研究旗標；新研究不參與 entryDecision |
| four-models-research-v1.js → foundation/unified | 四模型與各策略共用研究入口 | 附加同一 frozen 研究物件；A/B/C/D、families、rank 不變 |
| research-report-v1.js | 單一 view 供文字、報告、圖片 | 附加中文研究欄位與相同結構化狀態 |
| research-integration-v1.js / price-action-integration-v1.js | 六套策略、個股、共用快照；原研究收合 | 增加預設收合、手機單欄區塊；沿用既有預覽與分享 |
| stock-professional-v84.js / 大盤單頁 | 原圖片與浮水印、1284×2778 | 保留原模板；研究細節使用相同 view 的獨立研究圖，避免硬塞原圖 |
| research-validation-v1.js | 驗證逐日可得性、歷史母體、執行成本與已知未來 outcome | 擴充 A/B/C/D 同母體比較；資料不符即阻擋，目標碰觸不算已成交 |

依賴主鏈：Worker 契約 → 共用完成日K → structure-context → unified / foundation / price-action → four-models → report.view → 網頁與研究圖片。
新增獨立檔案僅限顯示介接、測試與比較腳本；不新增另一套互相競爭的計算核心。

## 預先定義（未做績效調參）
實體邊界允許相等，紅綠由 close 與 open 決定；全幅高/低及價格確認嚴格越界，需至少跨過一個合法跳動價。候選日後最多三根完成K確認，訊號高低/箱頂底凍結。量能必須同來源、同單位、無口徑衝突，且當日量>前日、對前五日均量>=1.2。日K內同時碰觸目標及失效列先後不明。
箱體8–20根，寬<=2.5 ATR14，接近容忍0.25 ATR且至少一個合法tick，上下緣各兩次分離測試；檢查事件前 MA10 斜率及區間位移，不以突破日重算。
原ABC/N、MA20、RSI、停損、分數、TOP8、Kronos保持原樣。所有新訊號 performanceValidated=false / researchOnly=true。
