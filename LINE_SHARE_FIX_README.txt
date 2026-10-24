石頭少爺 V50｜第5／第6濾網手機 LINE 分享錯誤修復包
版本：STRUCTURECARD.1-FIXPACK.2-LINESHARE.1
原始基礎：STRUCTURECARD.1-FIXPACK.1（前一版已交付）

一、已確認原因
第六濾網新版前8強總覽回傳的並不是 HTMLCanvasElement，而是具有 width、height、dataset、toBlob() 的延遲繪圖描述物件。
舊版 mobile-image-share-v1.js 在沒有 renderExportRegion() 的情況下，把此物件直接傳給 CanvasRenderingContext2D.drawImage()，使 JPG 分享檔案無法建立，按鈕顯示「分享圖片未備妥」。
第五濾網單張總覽也使用同一類延遲繪圖描述物件，因此存在相同風險。

二、本次實際修改
1. structure-reversal-report-v1.js：在單張前8強圖片描述物件增加 renderExportRegion()，讓手機分享可直接繪製正確的 JPG 區段；PNG toBlob() 共用同一份 paintOverview()，保留原始尺寸與版型。
2. restaurant-report-v1.js：為第五濾網單張前8強加入相同介接，避免同類型錯誤。
3. mobile-image-share-v1.js：加入延遲繪圖物件缺少 renderExportRegion 時的明確錯誤說明，避免被模糊的 Canvas drawImage 型別錯誤掩蓋。
4. version-v50.js：更新版本尾碼至 -STRUCTURECARD.1-FIXPACK.2-LINESHARE.1。
5. index.html：同步更新所有本次變更的圖片模組、分享模組快取字串與頁面顯示版號。
6. scripts/tests/mobile-share-render-region.test.mjs：新增第五及第六濾網 JPG 分享區段與 PNG 匯出回歸測試。

未修改：股票篩選條件、風險評分、A/B 排名、資料認證、Cloudflare Worker。

三、驗證結果
- Node 新增測試：2/2 通過。包含第5及第6濾網 renderExportRegion()、獨立 JPG File 建立、分享按鈕解鎖及呼叫 Web Share mock。
- 既有第六濾網圖片回歸測試：4/4 通過。
- Chromium 實際畫布與 Blob 驗證：第六濾網 1284×2778 PNG 與 JPG 均可產生、分享按鈕啟用且測試用 navigator.share() 被呼叫；第五濾網亦可正常產生 PNG / JPG。
- 全專案 Node 測試 33 項：30 通過，3 項失敗。這 3 項與前版相同，屬第六濾網既存的舊測試預期／fixture 與嚴格 Gate 不一致；本次未放寬資格規則。
- JavaScript 語法檢查通過。
- 尚未進行 iPhone Safari 或 LINE App 實機測試；Chromium 的 navigator.share() 為測試模擬，不能宣稱 LINE 已實際收到圖片。

四、GitHub 更新方法
1. 推薦使用「僅更新檔案 ZIP」，解壓後把其中的 index.html、version-v50.js、structure-reversal-report-v1.js、restaurant-report-v1.js、mobile-image-share-v1.js 覆蓋上傳到 GitHub 同名路徑。
2. scripts/tests/mobile-share-render-region.test.mjs 是驗證程式，可一起放到同名測試資料夾，不影響網站使用。
3. GitHub Pages 完成部署後，用 iPhone Safari 重新開啟網站，檢查前端版本尾碼為 FIXPACK.2-LINESHARE.1。舊網頁若仍顯示 FIXPACK.1，請關閉原分頁並重新開啟以排除快取。
4. 第六濾網 A 模式跑完後開啟單張前8強圖片，分享按鈕應顯示「分享目前圖片到 LINE」，且不再是「分享圖片未備妥」。點擊後應出現 iOS 系統分享選單，再手動選擇 LINE。
5. 確認圖片實際出現在 LINE 對話；如果 LINE 未出現在分享選單或接收失敗，請先使用「儲存 PNG」再由 LINE 相簿分享，並記錄 Safari／iOS／LINE 版本與下方錯誤訊息。
6. 同樣驗證第五濾網前8強單張圖片與完整報告分頁匯出沒有回歸異常。

五、重要限制
本次修復的是網站在分享前轉換 JPG 失敗的 Bug；iOS 分享選單能否顯示 LINE 與 LINE 是否接受圖片仍依 iPhone／Safari／LINE App 實際環境，不能保證任何瀏覽器內建 WebView 均支援 Web Share Files API。
