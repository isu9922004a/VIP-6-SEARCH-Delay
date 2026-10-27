# 六濾網共用行情更新修復（DATAFIX.20261027.1）

基準 main f58f9d9254c6b8f89352cf9994c8adbf4f773d12，前端 V8.2.2-R14。
線上 ALL_STOCKS 真實回應：expectedTradeDate=20261027、tradeDate=20261022、STALE_SNAPSHOT；上市1081、上櫃868筆，完整性不是筆數不足，而是盤後日期不符。
GitHub Actions 最後可觀測更新為2026-10-27 02:13 UTC（台北10:13），run 40437139480成功；當時expected=20261022正確。查核時沒有今天盤後run，不能稱為今天盤後更新失敗，更不能推斷官方休市。尚未確認GitHub排程延遲的服務端原因。

修正：
1. GitHub排程補抓延長至UTC9–23時，保留手動與程式修改觸發；scheduled Actions仍非準時保證。
2. latest來源失敗或缺日期時改查同市場官方指定日API；不再因Promise.all短路而永遠無法走備援。指定日仍逐筆及雙市場核對，不將請求日期當成回應證據。
3. 發布前檢查實際coverage，git pull --rebase後再次驗證日期並有限重試push，避免共用main競爭導致已抓到資料卻發布失敗。
4. Actions always摘要記錄實際盤後日期驗證，綠燈與發布成功分開。

測試：9個行情更新案例與2個workflow guard案例通過。全套與乾淨基準均15個檔案通過／10個檔案失敗，無新增失敗；原有失敗包括workers/路徑缺檔、舊報告格式與R14版本斷言。不改這些無關模組，也不宣稱全回歸成功。

前端、Cloudflare Worker、六濾網資格／原分數／排名完全未改；此次部署GitHub更新流程即可，無需替換Cloudflare Worker。
必須在成功發布新行情後重新查驗ALL_STOCKS marketCoverageReady=true、expectedTradeDate與行情日相符，才可宣稱掃描資料入口恢復。不保證所有個股深度行情服務正常，也不把0檔入選當成錯誤。
回復：還原本次4個程式／workflow檔，不倒退已經驗證發布的新市場行情。
