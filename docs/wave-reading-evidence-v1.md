# 波浪圖片：回吐深度、量價證據與價位用途

公開版維持V8.7.2。個股與大盤波浪PNG仍為1284×2778，保留iPhone 12 Pro Max滿寬預覽、浮水印、下載、分享及原線圖。

本次在既有stock-beginner加入共用readingEvidence／retraceMeasure，market-beginner直接重用。沒有另建數浪、指標或選股核心。

回吐量尺以既有波浪的已確認端點計算：第2段對第1段、第4段對第3段，ABC以原五段起訖衡量；目前第3／5段顯示前一次已確認回檔，不把現在漲幅當成回檔。修正端點尚未確認時標暫估；未確認基準不計算。無合理浪型時，沿用structure-context.pivots與Elliott.cleanPivots、同一確認視窗的最近完整波段，對最新收盤量位置，明確不宣稱這就是目前浪號。所有端點必須對上實際日期與OHLC；不使用未來K棒。

比率分母是前段漲跌幅，不是股價。例如100→120→110，前段漲20、退10，是回吐50%，不是股價跌50%。超過100%說明前波已完全退回並超過起點；超過前波端點時說明延伸，不把負比例包裝成回檔。

證據重用primary.evidence的價格、前5日量比與MACD方向，保留MET／NOT_MET／UNKNOWN／PENDING／WARNING。資料未知不能當作不通過；未完成第5段時第3段長度仍待驗證。有背離只列警訊。沒有合理數法則僅提供已核對的均線位置，不假裝有量價支持某一浪。

數浪界線沿用primary.reference，說明何時重新評估數法；不取代原ABC/N字、原失效價或個人停損。回吐比例及波浪證據永不提高分數、排名或進場資格，也不填入1.618固定買價。

版面重排：線圖區不動；原wave-reading區增為350px，以5句呈現浪號、回吐、已有、仍缺、數浪界線。未持有區346px、持有區286px，使用原結論與原價格的精簡文句；原三條價位及所有原文字仍保留於結構化資料。字級沿用原40～32px自適應，不低於原本下限，檢查無重疊及無裁切。

測試包含數值分母、反彈、0與缺值、超過100%、未確認端點、來源不符、量能UNKNOWN、待驗證規則、前瞻偏誤、個股／大盤一致，以及全市場逐檔核對原始價格。瀏覽器產生實際行情的改前／改後、乾淨／浮水印PNG，並檢查428×926預覽的比例與寬度、下載與分享。預覽先提供使用者，再在完整驗收後發布。

改動檔案：elliott-wave-stock-beginner-v1.js（共用可測量尺與排版）；elliott-wave-market-beginner-v1.js（重用同資料及排版）；elliott-wave-report-v1.js（快取身分）；index.html／market-outlook.html／version-v50.js（快取）；scripts/tests/wave-reading-evidence.test.cjs（新單元）；scripts/tests/stock-wave-clear-browser.cjs／market-wave-clear-browser.cjs（對照與iPhone預覽）；scripts/audit-all-stock-images.cjs（全市場來源核對）；相關兩個workflow（驗收）。

研究績效限制維持，不宣稱勝率改善。僅Pages前端；Worker無需部署。回滾可revert本次合併，保留其他工作與後續行情。

手機預覽補正：兩個波浪畫布標記fullBleed，沿用主站既有滿寬預覽；獨立大盤對話框僅對此標記採用手機滿寬CSS，其他精簡報告不套用。實際下載PNG內容不受CSS影響。
