# 全部快篩合格股掃描中途退出修正

## 已重現原因

以真實官方快照、428×926手機畫面及256MB JavaScript堆積限制執行正式「全部」掃描，原版於約336/840檔時發生PAGE_CRASH。取樣堆積約247MB。修正後相同測試完成840/840、9檔候選，結束時堆積約52MB；實際iPhone記憶體限制依機型、其他分頁與系統狀態而異。

掃描路徑原本每取得一批日線就計算、保留所有股票的完整研究附層，官方載入器同時保留報告及已完成Promise。快取又保存淘汰股票的完整寶塔等資料，並反覆整批序列化到sessionStorage。資料量會隨掃描檔數成長。

## 修改

- `selection-data-v2.js`：掃描可延後研究附層；加入有身分保護的批次來源釋放。個股查詢、已開啟的其他策略報告及明確指定保留的候選來源不釋放。快照改變不刪新資料。其他呼叫預設維持原行為。
- `research-official-history-v1.js`：釋放已完成報告時一併移除已完成Promise；再次查詢仍重新核對發布SHA256、來源與內容，不用較弱的資料通過檢查。
- `research-integration-v1.js`：提供目前報告來源的保留判斷，避免掃描清理影響其他查詢。
- `strong-stock-ui-v47.js`：逐批驗證後釋放非候選資料；候選與風險名單仍保留原始判斷。研究附層在結果確定後計算。淘汰及可快取的資料不足只保存必要欄位，sessionStorage不寫入完整候選或研究模型。
- 同檔也加入中斷結果保存及掃描期間快照身分檢查：同一快照的中斷保留已完成數量；新快照不與舊資料混算，不將部分結果認證為全市場排名。
- `scripts/tests/strong-all-memory-browser.cjs`：256MB限制下點擊正式全部掃描按鈕、與逐檔正式核心結果比較、重跑、手動停止、中斷續跑及快照更換。以實際股票與行情檔測試，沒有改低資格門檻或縮小掃描範圍。
- `scripts/tests/wave-source-upgrade.test.cjs`：來源釋放、重新驗證、候選/個股/其他報告保留、延後附層等回歸。
- `scripts/verify-deployed-frontend.py`：將強勢濾網UI、核心、健康檢查與寶塔核心加入部署位元組驗證。
- `index.html`、`market-outlook.html`、`version-v50.js`：更新相關快取標籤，顯示版本維持V8.7.1。
- `.github/workflows/worker-contract-tests.yml`、`.github/workflows/deploy-frontend.yml`：將完整低記憶體掃描加入PR及發布前檢查。

正式資格、分數、排序、停損、Kronos推論與資料風險閘門均未調整。完整掃描仍會遇到真正資料不足的股票，這不等同執行失敗；不得因此冒稱全市場排名認證成功。

本次只部署GitHub Pages，Cloudflare Worker無修改、無另行部署。回滾可revert本次合併提交，再執行既有前端驗證與發布流程。

最終測試與部署結果以PR、Actions的STRONG_ALL_MEMORY_AUDIT及正式網站驗收為準，重現數據不當作手機效能保證。
