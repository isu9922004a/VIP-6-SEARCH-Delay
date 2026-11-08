# V8.7.2發布驗收：模型狀態顯示同步

發布額外驗收曾在`research-context-r16-browser.cjs`發現：同一檔川湖的網頁仍顯示「模型資料載入中」，當時研究核心的顯示資料已為「尚無可用模型」。歷史測試行情為2026-10-22、模型目錄為2026-11-06，日期不合而拒用模型是正確行為。

原因：`researchCard`的ensure回呼只在回傳true時更新白話摘要，且未同步完整研究欄位；false（模型不可用）時可能保留載入中。測試也在模型尚未穩定時立即取網頁及圖片兩次快照。

修正只在顯示層：模型請求結束後，仍在DOM中的卡片重新讀取原R.view(a)，同步白話摘要及完整研究文字。失敗／不可用也更新，不更改模型結果、分析物件、條件分、排名或進場資格。已切換查詢而移除的卡片不更新。不新增ensure請求或模型重試。

保留完整文字與圖片逐欄相等斷言；先等模型不再LOADING且網頁已同步，再比較同一狀態。不是忽略模型欄位、刪除斷言或把不可用模型判為可用。

檔案：research-integration-v1.js（顯示回呼）；scripts/tests/research-context-r16-browser.cjs（等待穩定狀態）；index.html／market-outlook.html／version-v50.js（快取）；.github/workflows/market-wave-clear.yml（加入顯示同步變更驗收）。公開版本仍V8.7.2，Worker無異動。實際測試與部署證據見PR／Actions。
