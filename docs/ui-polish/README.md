# index.html 視覺層調整

本次只修改靜態 HTML 的展示結構，新增 `ui-polish-v1.css`，不更改任何正式 JavaScript。版本仍為 V8.7.1，現有腳本、CSS 的順序與版本參數均保留；新 CSS 放在 head 最後，原 body 末端 CSS 原位保留。

## 盤點與保護

修改前的 index.html 已保存在 `/tmp/shitou-ui-polish-before/index.html`；Git 基底為 `938ac742c6d0080869d2cfe7f30d2a9d5010cfc9`。獨立分支不覆蓋其他分支及原有 `docs/previews/`。

- 原有 303 個 id、52 個 onclick、name/data/aria 及既有 class 均保留。
- 13 段內嵌 JavaScript 雜湊相同，102 個外部腳本的 URL、順序相同，8 個原 CSS URL 與順序相同；原內嵌樣式表也保持相同。
- 34 處靜態 inline style 搬到 20 個輔助 class；動態產生的 inline style 不動，避免影響進度、顯示／隱藏、圖片及事件狀態。
- 所有原靜態文案均保留，長說明改原生 details；危險、時段及日期提醒沒有刪除。
- `momentumList`、`dayTradeList`、`strongStockList` 等動態區不修改模板；寶塔線、餐廳與結構面板只套樣式。

重現盤點與不變性檢查：

```sh
mkdir -p /tmp/shitou-ui-polish-before
git show 938ac742c6d0080869d2cfe7f30d2a9d5010cfc9:index.html > /tmp/shitou-ui-polish-before/index.html
python3 scripts/audit-ui-polish.py /tmp/shitou-ui-polish-before/index.html
```

完整 inline style 清單、重複色碼／字級／圓角出現次數見 `before-inventory.json`、`after-inventory.json`；保護項目結果見 `contract.json`。

## 新版介面

1. 沿用原導航與分頁功能，改為藍色主視覺、可橫滑 chip、目前區塊樣式與安全邊界。
2. 搜尋為主要動作；清除、夜間、重新整理、精簡圖為次要動作。原專業圖、波浪圖入口及 LINE 分享保留。
3. 四張策略卡保留參數、開始與停止，原長說明、時段、限制放入原生摺疊；不啟動新請求。
4. 靜態掃描與大盤匯出按鈕分為文字、圖片、浮水印三組，原 id／onclick 不變。動態注入的匯出群組沿用既有收合功能，不另改 DOM。
5. 摘要採桌面 4–6 欄、手機 2 欄；候選與既有關鍵價位 class 美化；表格可橫滑。沒有新增行情欄位，也未改價位意義或選股名次。
6. 新增頁面 token：6 個字級、3 個圓角加膠囊、4px 間距、兩級陰影；上漲／下跌與風險色分開。深色只替換新 token，保留原夜間按鈕與記憶。
7. focus-visible、reduced-motion、disabled／busy、44px 點擊區及 iOS 16px 以上輸入。

## 數量比較的口徑

| 指標 | 原 index | 新 index | 說明 |
|---|---:|---:|---|
| 靜態 inline style | 34 | 0 | 全數移到新 CSS class |
| 原頁面色碼種類 | 378 | 378 | 原 CSS 保留，沒有宣稱刪掉舊色碼 |
| 原頁面 font-size 宣告種類 | 64 | 64 | 原 CSS 保留；實際套用樣式另由瀏覽器量測 |
| 原頁面 border-radius 宣告種類 | 21 | 21 | 同上，含多角圓角與比例值 |
| 新層字級 token | — | 6 | 12／14／16／18／22／28 |
| 新層圓角 token | — | 3＋膠囊 | 8／12／16／999 |

不能把「新增統一覆蓋層」說成「已刪除所有舊宣告」。相同狀態、相同390px首頁的實際套用色彩／字級／圓角，另記在 `ui-polish-results.json.styleCounts`，與來源宣告種類分開。

## 自動驗收

專用工作流 `.github/workflows/ui-polish.yml` 在 PR 執行；完整執行結果與證據位於 PR #22 的 Actions artifact `ui-polish-visual-evidence`。

- 本機瀏覽器初步已完成12組個股／大盤、乾淨／浮水印圖的 PNG 位元組比對；最終以雲端完整結果為準。
- 專用測試以改動前基底重播同份已記錄行情，比對 12 組 PNG 雜湊，確保圖片樣式和內容沒有改變。
- 360／390／768／1280 × 淺深色 × 首頁／掃描中／候選／個股／大盤五畫面；另外檢查 44px、無頁面橫向溢出及切換後重新載入記憶。
- 檢查正文、中性、語意、紅漲綠跌 token 配對對比≥4.5:1。這不等於所有舊元件、漸層及原外掛都完成整站 WCAG 認證。
- 已記錄資料透過實際個股查詢按鈕、既有文字與圖卡入口、所有既有匯出及浮水印按鈕做回歸。
- 執行 `npm ci`、`npm test`、`npm run test:contract`、既有 Elliott／上下文／V8.4 匯出測試。未執行或失敗不列為通過。
- 畫面屬 Chromium 手機模擬；掃描中與候選截圖重播已記錄狀態，不宣稱當日實盤掃描或原生 iPhone Safari 測試。

## 明確保留的限制

- **OS 深色預設未加**：原 `initUiTheme` 把「未儲存」與「明確儲存 light」都表示成無 dark-mode 的相同 DOM；純 CSS 無法區分。為遵守禁止 JavaScript 修改及手動選擇優先，不硬加會覆蓋手動選擇的 `prefers-color-scheme`。若日後允許調整純 UI JS，才可補上明確偏好標記。
- 原 JS 產生的版本文字、icon-only 按鈕或候選 DOM 不重寫；能保留既有描述名稱的入口不改事件。只有靜態展示結構可加分組。無法新增動態逐價位語意 chip 時保留原圖例與資料。
- 外掛現有 important 必須用少量有註解的 important 覆蓋。舊 dark-mode 逐元件規則原位保留；新層沒有再新增逐元件深色規則。
- 本次未修改模型、Worker、行情、掃描／排序或圖片繪製，不提升任何資格，也沒有績效提升宣稱。

## 可以後續清理、此次不刪的舊規則

- `index.html` 裡的重複首頁／按鈕／summary／深色展示宣告。
- `ui-polish-v85.css` 中已被新層取代的標題、搜尋、導航、卡片及字級／圓角；既有 JS decorator 仍保留。
- `filter-unified-mobile-v1.css` 裡被新層覆蓋的按鈕配色、標題與選單圓角。

必須另做依賴與圖片回歸後才能刪除，不在本次順便清理。

## 檔案與回滾

正式介面只需 `index.html` 與 `ui-polish-v1.css`；其餘為盤點、測試、文件和只讀 CI。`scripts/tests/ui-polish-browser.cjs` 中的測試接縫僅存在於攔截的測試回應，不寫入正式 JS。

尚未合併／部署。回滾可還原本 PR 的 index.html 並移除新 CSS include；既有 JS、資料與圖片繪製不需回滾。
