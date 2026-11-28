# V9.28 Telegram Bot 候選
獨立 Cloudflare Worker；既有 V9.27 Pages、行情 Worker、六策略公式、資料契約均不改。未部署、未綁定 webhook、未實際傳送。Bot 不下單、不要求券商帳密。
- /market 與 /stock 使用既有已核對的盤後資料；Kronos 沿用原 forecast-engine 的輸入/執行收據檢查，未核驗不顯示。
- /strategy 6 讀取原第六套官方 Top8，核對日期與封存快照 hash；1–5 目前明確顯示尚無正式排名封存，禁止重造公式。下一步以原掃描器的同日全市場實際輸出建立正式封存及一致性驗收。
- 私聊白名單、Webhook secret、Durable Object 逐 chat 去重；每天盤後僅在當日完整資料可用時推播，週末/未更新不推；部分推播預設關閉 ALLOW_PARTIAL_PUSH=0。未完成六策略接線不能宣稱全功能上線。
- 發送前先寫去重記錄，故不確定傳送成功時不重送，以避免重複；需增加營運告警與人工確認流程。候選無持久投遞重試。
- 管理員須在自己的 Cloudflare 帳戶配置 TELEGRAM_BOT_TOKEN、TELEGRAM_WEBHOOK_SECRET、TELEGRAM_CHAT_IDS（私人 chat ID，逗號分隔）。勿將 token 置於 GitHub、Pages 或聊天。使用 wrangler deploy --config telegram-bot/wrangler.toml，之後在 Cloudflare 安全輸入 secrets，再使用 Telegram setWebhook 設定獨立 Worker 的 /telegram/webhook 與相同 secret_token。不得將 token 寫入命令紀錄或 CI log。
- 驗收：測試通過後用真實正式資料核對模型與股票結果、未授權/重複更新、休市日、過期/缺漏資料與實際 Telegram 傳送；全六套同日排名與網站一致後方開啟完整推播。正式網站版號維持 V9.27 直至 V9.28 正式驗收。

## V9.29 整合
本分支選擇性接入 V9.28 Telegram 四個原始檔與測試，不引入舊2560專屬策略修改。/s5 及 /strategy 5 讀取 data/low-base-breakout/latest.json；須通過同日交易日曆、歷史清單原始 SHA256、母體數、排名及完整性核對。部分資料不足可手動查詢但明確標示非完整市場，不推斷零入選。/daily 增加⑤，既有白名單、私聊與 webhook secret 不變。自動推播仍預設關閉；可選試行仍限大盤及⑥；其餘策略未接線前不可宣稱全六套完成。Cloudflare Worker 原名保留以免破壞既有綁定；部署及真實 Telegram 驗收待完成。
