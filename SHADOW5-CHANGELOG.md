# SHADOW.5｜變更及測試紀錄

## 版本
- 來源：`VIP-BOWTOWER-4-SEARCH-main.zip`（使用者本次上傳）。
- 新版：`R5.3.2.8.1-TOWER-SHADOW.5`。

## 實際調整
- `tower-beginner-guide.js`：新增 `observedLevels` 來源驗證、60根高點／局部高點／20根低點候選；分離短線警戒與3T空方門檻；新手熱度提醒與「不能追」原因；完整日K未確認時禁止輸出已確認價位階梯。
- `tower-stock-report.js`：TXT與1284×2778寶塔圖片共用上述分析，分段註明壓力層級、觀察價、日低、3T；圖片「追高警戒」改成「為什麼不能直接追？」。
- `version-v50.js`：版本更新至 `.5`。
- `index.html`：所有已存在的版本查詢參數同步更新至 `.5`，降低舊資源快取風險。

## 未修改
`tower-line-core.js`、`tower-risk-adapter.js`、`tower-trend-classifier.js`、`tower-gold-scanner.js`、原前三套濾網／月線資格／資料讀取。追高新手提醒是展示層判斷，與原硬性排除及研究品質分數分開。

## 條件與限制
- 歷史單日高點與局部轉折高點是候選壓力；未反覆驗證前不能稱強壓力。未找到第二壓力會寫「資料不足」，不自行填目標價。
- 下次完成收盤 `>T3上緣` 只代表T3模型續強條件，仍要看是否另行跨過第一和第二壓力；`<T3下緣` 則是下一次T3跌破條件，不自動代表個人停損。
- RSI5>=80 提醒偏熱，未改原風險排除門檻，且不宣稱 RSI 高就必跌。
- 本次 ZIP 缺原儲存庫 `.github/`、`scripts/`、`data/`；合併部署時必須保留那些原始檔。
- `tests/preview-shadow5.html` 是供合成測試用的靜態頁面，不需放上正式網站，部署時可略過 `tests/`。

## 本地已驗證
1. Node 合成行情 14 項測試通過。
2. Chromium 實際建立測試圖 1284×2778；12區塊無重疊、文字未觸發排版失敗。
3. 改版之4個既有檔案與未修改核心已另作 SHA256 對照；參見 `RELEASE-SHADOW5-MANIFEST.json`。

**尚未實測**：iPhone 實機 Safari、GitHub Pages 佈署、即時 Worker、正式市場資料與跨年度績效回測。
