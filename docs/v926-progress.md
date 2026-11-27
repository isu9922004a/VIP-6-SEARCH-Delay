# V9.26 開發及驗收紀錄

候選分支 `feat/v926-postmarket-trend-lifeline`。主線基準為 `582a0decfb1cf727287d3c4efbe3874469c248a2`，識別版本 V9.25。GitHub 比對 main 與基準結果一致。分支查詢未找到先前 V9.26 分支或 PR。工作集中在 [草稿 PR #119](https://github.com/isu9922004a/VIP-6-SEARCH-Delay/pull/119)，候選網站與報告顯示 V9.26，正式策略資料版本沿用已核准識別。


[正式基準稽核 JSON](../evidence/v926/production-baseline.json)｜[正式基準 Actions](https://github.com/isu9922004a/VIP-6-SEARCH-Delay/actions/runs/45935469469/job/140297556045)

## 分享根因

用 V9.25 Pages 模組化建置、428×926 Chromium、1284×6800 測試長圖重現。長圖滿版規則把 `.image-preview-wrap` 改為 `max-height:none;overflow:visible`，整個彈窗負責捲動，工具列排在圖片之後。Computed style 顯示分享與 PNG 工具列從距視窗頂端 2370.66px 才開始。一般預覽的 82vh 上限也把外層標題和動作列排除在高度預算之外。分享工具偵測不支援檔案時設為 disabled，缺少共用模組的 legacy 路徑還會隱藏分享按鈕。

以 `git log -S` 查到這些規則已存在於 V9.25 之前，包含早期引入 82vh 的 `a961eb036` 及原生檔案拒絕時停用的 `a3ac0e704`。報障第一次發生的版本仍為 NOT_VERIFIED。修復後同一測試圖的按鈕在 786.91–830.91px，且可以開啟備援說明。新 layout 的 header 和 footer 各有一列固定佈局，圖片內容佔剩餘空間並自動捲動。測試圖只用於版面重現。換頁時，已完成的 JPG 要等當頁 PNG 就緒才可使用。測試故意先完成 JPG，驗證等待期間仍可見分享入口，且無法分享前一頁。

- [修復前 428×926](../evidence/v926/before-428x926.png)｜[Computed style](../evidence/v926/before-dom.json)
- [修復後 428×926](../evidence/v926/after-428x926.png)｜[Computed style](../evidence/v926/after-dom.json)
- [來源頁 Chromium](../evidence/v926/chromium-source.json)｜[實際 Pages 打包 Chromium](../evidence/v926/chromium-pages.json)
- [輸入 SHA256](../evidence/v926/baseline-inputs.sha256)｜[Pages manifest](../evidence/v926/pages-manifest.json)

## 程式及資料

- `mobile-image-share-v1.js` 共用預覽、預先編碼、分享狀態、交錯請求防護、下載 URL 生命週期。保留 PNG 原始解析度。單頁或長圖片段用真實 JPG File 呼叫系統分享。原生精簡版對話框保留 PNG 及既有桌面剪貼簿。LINE 系統選單回傳成功時只提示確認結果。
- `report-preview-v926.css` 三區式預覽、動態視窗安全區、直橫向操作。原獨立大盤、個股精簡和市場文字閱讀可使用同樣的版面約束。報告模板保留原始圖面。
- `postmarket-patterns-v926.js` 以正式交易日曆限定輸入，建構突破、鈍化、長紅十字與隔日防線、傳統日 K 跳空和 FVG。一般十字 10%，高檔轉折十字 15% 或開盤比例 0.5%。止漲最近四日收盤不得超過前十日最高收盤，最近三日振幅及均量比較自身前十日。FVG 以最近 10 個正式交易日的三根連續 K 棒確認，後續最多追蹤 8 個交易日。觸邊、回補及收盤失效個別記錄。2R/3R 用區間中點附近合法價，防守與目標向遠離參考價的方向取整。正式股票的 0.5% 防守與 0.1 ATR 緩衝分列。
- `postmarket-trend-v926.js` 共用日 K 推導趨勢、動能證據、影子鈍化研究、大盤防禦、同日市場廣度、同區間相對強弱與次日收盤情境。廣度分市場，以時間相符的官方普通股母體為起點，另報有核對的報價與歷史家數，已核實停牌及零成交可排除，缺報價時不出全市場比例。衰竭最多五組、單組相關訊號取最高，所有正式評分欄維持關閉。
- `postmarket-report-v926.js` 和 `postmarket-preview-v926.js` 由同一結構化結果產生研究文字與 1284×2778 PNG。試行路徑為 `?postmarket-study=1` 再開生命線，所需模組在操作時以現有本站資產載入。行情來源與日期不足時標示資料不足。無 opt-in 時沒有這些模組的額外載入。研究 PNG 透過既有預覽、分頁及分享，圖片及手機可展開的閱讀文字使用同一份資料。
- Worker 與 `worker-data-contract-v1.js` 在兩版間逐位元相同。研究沒有外部行情請求、輪詢或對正式排名的寫入。
- Pages 維持 13 個 inline JS 與兩個 inline CSS 的拆分，帶入資產內容指紋供瀏覽器快取識別。建置驗證可還原原始 HTML。

[加權指數 PNG](../evidence/v926/TAIEX-2026-11-26.png)｜[加權指數浮水印](../evidence/v926/TAIEX-2026-11-26-watermark.png)｜[台積電 PNG](../evidence/v926/2330-2026-11-26.png)｜[台積電浮水印](../evidence/v926/2330-2026-11-26-watermark.png)｜[圖表座標及輸出稽核](../evidence/v926/archive-reports.json)

## 回放與效能

[研究回放 JSON](../evidence/v926/archive-study.json) 的參數檔是 `scripts/fixtures/postmarket-study-v926.cjs`。資料為倉庫保存的 TWSE 指數日線與 TWSE／TPEx 官方個股日線。各樣本的資料路徑、SHA256、分析日期、報酬、方向、覆蓋與價格觸及狀態收在 JSON。採固定時間順序，3 段 walk-forward 各有 5 日隔離。方向報酬由 T+1 開盤量到第 1、3、5 個正式交易日收盤，對照同日 20MA 方向。以日 K 判讀到價；同日兩邊均觸及列次序不明。指數結果是點位觀察。股票可成交及成本後模擬缺成交與放空限制證據。

| 標的 | 封存期間 | 有完整後續的樣本 | 樣本外 |
|---|---|---:|---:|
| 加權指數 | 2026-06-03 至 2026-11-26 | 80 | 44 |
| 台積電 2330 | 2026-04-07 至 2026-11-26 | 120 | 62 |
| 大世科 8099 | 2026-04-07 至 2026-11-26 | 120 | 62 |

加權指數樣本外 5 日方向精確率，偏多 15 次為 46.7%，20MA 同向基準為 52.9%。偏空 17 次為 76.5%，基準為 70.4%。兩組都低於事前定義的每類 30 次。日期鄰近的觀察有重疊行情，樣本外的結果只用來紀錄。多年當時可見的版本、歷史全市場母體、公司行動、可成交資料及影子排名的驗證仍缺。研究效益與正式分數放行為 BLOCKED。

計算預算預設 P95 8ms。封存回放的 320 次 Node v24.22.3 計算不包含檔案 I/O，P50 0.40ms、P95 2.14ms，全程序 RSS 約 53.5 MiB，外部請求 0。Worker 瀏覽器重播基準／候選各 7 個被觀測的外部 URL、0 個 page error。這組統計屬封存回應重播。Pages HTML 由 73,785 bytes 至 74,022 bytes，拆分資產合計由 1,872,976 bytes 至 1,868,710 bytes，額外的共用 CSS 與 JS 另計。Worker 線上 CPU、記憶體及延遲尚待量測。

[修正後前端量測](../evidence/v926/preview-benchmark-optimized.json) 使用同一 Chromium、428×926、本機快取伺服器與 1284×6800 測試圖。兩版本各跑 5 組冷、暖快取，統計從載入及開始預覽至 PNG 解碼、分享 JPG 準備完成的時間。冷快取頁面載入 P50/P95 由 1801/4019ms 至 2019/2595ms，圖片由 511/1374ms 至 534/922ms。暖快取圖片 P50/P95 由 390/906ms 至 595/800ms。冷快取多一個本站 CSS 傳輸，暖快取兩版均無資產網路傳輸。樣本量小且同機另有測試並行，保留原始測量供重跑。

## 階段及驗收

| Phase | 結果 | 證據與待核對事項 |
|---|---|---|
| 0 基準 | PASS ／ BLOCKED | main SHA、來源及 Pages 記錄、50 項契約測試、1,251 項原測試及官方快照 hash 保存。GitHub Actions 已唯讀核對正式 V9.25 Pages 的 HTML、manifest 及 15 支拆分資產，以及 11/26 正式 Worker 盤後資料。 |
| 1 LINE 根因 | PASS ／ NOT_VERIFIED | 428×926 DOM 已重現。報障首次出現版本待查。 |
| 2 共用預覽 | PASS | Chromium source／Pages 固定工具列、影像捲動、關閉、備援、JPEG File、準備／取消／失敗及競態。 |
| 3 多空趨勢 | PASS ／ NOT_VERIFIED | 引擎和邊界測試。各階段真實案例覆蓋不足。 |
| 4 衰竭 | PASS ／ BLOCKED | 研究證據、分組及資料不足測試。預測效用待驗證。 |
| 5 長紅十字、防線、鈍化 | PASS ／ NOT_VERIFIED | 官方日期截斷、開盤等價、缺日過期、鈍化影子分數測試。缺個股參考價與公司行動的多年證據。 |
| 6 突破／回測 | PASS ／ NOT_VERIFIED | 前 5/10/20 日關卡事件的固定價、方向、直接續攻、回測、跌破測試。已納入同基準、同經核對日 K 的 NH、雙底頸線、N 字 B/C 點及原支撐壓力。ABC 引擎可收已核實關卡，原報告的 ABC 資料接線待完成。 |
| 7 傳統跳空、FVG、2R／3R | PASS ／ NOT_VERIFIED | 多空、形成至回補與失效、tick 邊界及觸及次序測試。真實個股 FVG 計畫缺交易資料證據。 |
| 8 防禦與觀望 | PASS | 大盤獨立警戒、1% 重挫與觀望守門，不同狀態保留各自資料。 |
| 9 廣度與相對強弱 | PASS ／ BLOCKED | 公式、分母、覆蓋、日期與市場對齊測試。可沿用同日已取用的加權指數快照。完整歷史母體與對應櫃買指數的交付來源待補。 |
| 10 次日關卡 | PASS ／ NOT_VERIFIED | 收盤三情境邊界、開盤分列、正式交易曆 1～5 日觀察期限及缺合法關卡降級。各方向真實驗收仍有缺項。 |
| 11 大盤生命線 | PASS ／ NOT_VERIFIED | 封存 2026-11-26 加權 39,151.81 點、原風險第 3 級與試行 PNG。正式網站複驗受限。 |
| 12 個股生命線 | PASS ／ NOT_VERIFIED | 封存 2026-11-26 台積電 2,145 元試行 PNG，含一般及浮水印。預設生命線既有圖片逐位元回歸通過。 |
| 13 白話文 | PASS | 試行研究模型共用瀏覽器預覽與 PNG。Kronos 預覽另列同一份技術關卡，與模型取樣分開，並以封存的真實模型驗證大盤。 |
| 14 契約與效能 | PASS ／ NOT_VERIFIED | 契約 50/50，生成 Worker 無 diff，量測本機回放。線上 Worker 資源及延遲待量測。 |
| 15 策略及報告 | PASS ／ NOT_VERIFIED | 原策略引擎比對、舊報告及各策略輸出測試。正式站同日完整重跑待查。 |
| 16 手機 | PASS ／ NOT_VERIFIED | 兩套本機 Chromium 路徑，各 20 個尺寸與色系組合。本機 WebKit 下載受限。Actions 首次執行的 Ubuntu 26.04 不支援固定的 Playwright 1.56.1 WebKit，候選 job 已指定 Ubuntu 24.04，來源頁 WebKit 在前一候選 HEAD 通過。實際 Pages 產物 WebKit 以本次候選結果為準。iPhone 實機與 LINE 內建瀏覽器分別待測。 |
| 17 as-of | PASS ／ NOT_VERIFIED | 注入 T 後日 K、晚公告公司行動與成員異動的測試通過。來源過往版本沒有當時可見證明。 |
| 18 多年回測 | BLOCKED | 現有封存回放 320 個樣本。多年可比資料及對照缺項。 |
| 19 真實案例 | NOT_VERIFIED | 兩類 PNG 及回放事件已留存，無法證實規格要求的每個案例。 |
| 20 CI | PASS ／ NOT_VERIFIED | 本機測試及 GitHub Actions 已接入。候選 runner 拉取完整 git 歷史，供既有大盤生命線像素比對程式讀取已核准的歷史點。加入正式 Pages 基準與 Worker 公開行情的唯讀檢查。完整必要 checks 以 PR 最終 SHA 為準。 |
| 21 合併、部署 | BLOCKED | 草稿 PR。必要驗收尚未完成。Worker 重部署 NOT_APPLICABLE。 |
| 22 最終 | BLOCKED | 結論以本文件、PR 最新檢查和實際正式環境為準。 |

### 六策略與其他報告

11/26 同一封存母體已逐筆比對主升、當沖、強勢、主力生命線成本與 2560。第六套用正式當日靜態 MACD+ 產物做 UI 正例，另測資料不完整。雙版本的結果、分數與列序完全一致。同時比對被記錄的 DEEP_SCAN 呼叫，各 622 次。全套永久測試見 PR 的 `formal-strategy-regression` 工作。

[六策略同日回放摘要](../evidence/v926/formal-replay-summary.json)｜[封存報告分享回歸](../evidence/v926/archived-report-share-checks.json)｜[主力生命線成本報告、場景與分享證據](../evidence/v926/main-force-share-checks.json)

| 現行入口 | 基準與候選 | 圖片 |
|---|---|---|
| 主動式主升掃描 | **PASS** 493 筆均標資料不足，兩版候選及輸出列相同 | 封存 Top 8／全部掃描圖及兩種浮水印狀態 |
| 明日當沖盤前適配 | **PASS** 70 筆處理、4 檔正式候選，兩版順序和分數相同 | 封存 Top 8／全部掃描圖及兩種浮水印狀態 |
| 強勢飆股 | **PASS** 636 筆處理、3 檔候選、9 筆問題，兩版順序和分數相同 | 封存 Top 8／全部掃描圖、長圖及一般／浮水印 |
| 主力生命線成本 | **PASS** 1,970 檔母體、245 筆新生 K0，兩版正式 Top 8 無入選 | 既有生命線多頁、ZIP 與分享介接；舊寶塔圖片另有歷史測試 |
| 2560 戰法 | **PASS** 1,926 筆處理、20 檔候選，同時保留 82 筆資料不足及 175 筆失敗，兩版明細相同 | 合成正例與空結果介面測試；既有 PNG／全部頁 |
| 強化 MACD+ | **PASS** 封存 11/26 共 1,997 檔、8 檔入選，兩版逐項結果、分數、順序及 Top 8 相同 | Top 8 PNG、全部頁、ZIP 與未完整資料防呆 |

[第六套結果](../evidence/v926/macd-scan.json) 依序為 1708 86.1176、8299 79.3914、3017 75.661、5469 61.5073、2413 59.5587、2360 56.465、2464 52.8772、3042 51.0847。神奇 K 線、0～3 號 K、四級風險、原突破品質及 Kronos 核心受既有回歸保護。大盤／個股精簡、專業及 Kronos 本機報告測試使用封存回應，LINE 測試呼叫瀏覽器模擬的系統分享介面。LINE 內實際傳送為 NOT_VERIFIED。

## 重跑與交接

- Node v24.22.3。 `npm run build:worker-contract` 0，`npm run test:contract` 0（50 通過），`npm test` 0（1,263 通過），`npm run research:validate` 0（保留未驗證效用結果），`npm run test:worker-browser` 0（來源與 Pages，封存 Worker 回應）。
- `node scripts/build-frontend-v924.cjs <stage> --defer-future` 搭配 `node scripts/prepare-pages-runtime-data.cjs <stage>`。先依 `.github/workflows/deploy-data-pages.yml` 的 tar 配方放完整資產，15 支拆分檔語法檢查 exit 0。
- `node scripts/tests/report-preview-v926-browser.cjs <evidence>` 在 `REPORT_PAGES_STAGE` 指定產物或省略時的來源頁執行。 `--webkit` 走相同斷言。實際手機及 LINE Apps 另外驗收。
- `node scripts/backtest-postmarket-v926.cjs <output.json>` 產生封存回放結論。 `node scripts/tests/postmarket-reports-v926-browser.cjs <evidence>` 產生加權及個股一般／浮水印 PNG。
- 已知基準 commit `582a0decfb1cf727287d3c4efbe3874469c248a2`。已驗證現行 Pages 產物對應此 commit 的建置結果。未來若正式發版有回歸，先查 Pages 實際產物與 Actions SHA，再走正常 PR revert 與 Pages 工作流程；契約相同，無此案 Worker 遷移或補歷史。
- Cloud Environment Runtime 查到正式 Pages、兩個 Worker 和 WebKit CDN 出站未允許，機器設定變更請求未獲核准。GitHub Git transport 和 connector 已用於分支與 PR。正式基準已由 GitHub Actions 唯讀驗證。本機出站限制仍適用。

[PR #119 與最新 checks](https://github.com/isu9922004a/VIP-6-SEARCH-Delay/pull/119/checks)｜[正式 Pages](https://isu9922004a.github.io/VIP-6-SEARCH-Delay/)｜[正式 Market Worker](https://shitou-taiwanmarket-api.d318426.workers.dev/)
