# 五浪增量修正盤點（2026-11-10）

基準 main：`b2dfc0bf99a2b7d6db5639f60c26cc3e2d34281e`；分支：`feat/wave-evidence-20261110`。
後續使用者指示：對外升級 V8.8，研究引擎另設修訂識別；專用分支完成驗收後直接部署 main。

| 實際檔案 | 已存在 | 本次缺口／處置 |
|---|---|---|
| elliott-wave-v1.js | 3/5/8 多尺度、上下鏡像、右側確認、歷史回放、資料核對、研究旗標 | 補逐浪指標、可得日期、已確認背離、浮點邊界及不支援修正類型；不新增另一套數浪核心 |
| structure-context-v1.js | 共用 pivot、交易日與來源核對 | 沿用，不改 N 字 ABC |
| indicator-multi-v1.js、research-common-v1.js | MACD、RSI、MA、Wilder ATR | 重用原公式；布林僅加在波浪研究證據內，ATR 明列 Wilder，與 Kronos 分類用 TR 算術平均分開 |
| elliott-wave-visual-v1.js | 真實 K 線、價位側欄、標籤避碰與隱藏紀錄 | 補起點、日期／可得性稽核與證據文字 |
| elliott-wave-report-v1.js、個股／大盤 beginner 模板 | 同一分析、1284×2778、雙版本、原買進／持股／價位、下載分享 | 原量價說明卡加入最重要三條證據；詳細背景留原資料及網頁，不新增報告引擎 |
| wave-postclose-context-v1.js | 盤後相對強弱、量縮與區間 | 保留資料與原判斷，不當成買進門檻 |
| kronos-future-core-v1.js、report | 150 條（非固定假設）原始路徑核對、20 日分布、獨立模擬圖例 | 補第 1/3/5/20 日可追溯分位數查詢；不動路徑／取樣／權重 |
| research-validation-v1.js | PIT 快照核驗、實際成交與成本才算交易報酬、walk-forward | 沿用核驗與 outcome，新增波浪分群的配對研究，缺歷史母體或成交證據明列未驗證 |

載入順序（兩入口）：common/structure → wave core/indicator → Elliott → visual → postclose → stock beginner → market beginner → wave report。Kronos 是後續獨立模組。保留次序、按鈕與事件；只更新受影響快取識別。

主要風險：修正標準規則可能使舊研究候選消失；不得影響原正式資格／分數／排行。未建模平台、三角、對角線、截斷與複雜修正維持不支援。歷史發布時間、歷史母體、成交及成本不能由今天的資料推造。圖片受固定高度限制，只放關鍵證據，完整稽核留結構化輸出。

驗證：新增純函式與前綴回放回歸；執行 npm test、test:elliott-browser、test:browser 及受影響圖片測試；實際編碼 PNG，核對手機四種寬度、雙版本、下載／分享。失敗不部署。
