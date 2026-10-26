// BEGIN EMBEDDED DAILY CONTRACT
/* Shared wire contract. Embedded verbatim in both standalone Workers by build-worker-contract.cjs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouWorkerDataContractV1=api;})(globalThis,function(){
'use strict';
const SCHEMA='shitou-daily-contract-v1',VERSION='R4.9.3-CONTRACT.1';
const fields=['date','open','high','low','close','volume'];
const clone=x=>JSON.parse(JSON.stringify(x));
const bars=x=>(x||[]).map(r=>Object.fromEntries(fields.map(k=>[k,k==='date'?String(r[k]):Number(r[k])])));
function fingerprint(rows){const text=JSON.stringify(bars(rows));let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return rows.length+'-'+(h>>>0).toString(16);}
const adapters=Object.freeze({YAHOO_CHART:{field:'indicators.quote.volume',inputUnit:'shares',multiplier:1},TWSE_MIS:{field:'v',inputUnit:'lots',multiplier:1000},TWSE_STOCK_DAY:{field:'成交股數',inputUnit:'shares',multiplier:1},TPEX_DAILY_HISTORY:{field:'成交仟股',inputUnit:'thousand-shares',multiplier:1000},VERIFIED_LATEST_SNAPSHOT:{field:'volume',inputUnit:'shares',multiplier:1},GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE:{field:'volume',inputUnit:'shares',multiplier:1}});
function unitEvidence(ids){return [...new Set(ids)].map(adapter=>({adapter,...adapters[adapter],outputUnit:'shares'}));}
function refresh(report,rows,extra={}){
 const r={...report},m=r.dailySeriesMeta||{},out=clone(rows);
 r.dailySeries=out;if(Array.isArray(r.canonicalBars))r.canonicalBars=clone(out);
 r.dailySeriesMeta={...m,returnedBars:out.length,completedDailyRowsAvailable:out.length,completeOhlcvRowsAvailable:out.length,countScope:'RETURNED_SERIES',canonicalBarCount:Array.isArray(r.canonicalBars)?out.length:0,dailySeriesCount:out.length,firstDate:out[0]?.date||null,lastDate:out.at(-1)?.date||null,ascending:out.every((b,i)=>!i||b.date>out[i-1].date),onlyCompletedBars:m.onlyCompletedBars===true,...extra};
 return r;
}
function seal(report,{evidence,originalRows,officialRecoveryEvidence=[],snapshotVerified=false,predecessor=null}={}){
 if(!report||!Array.isArray(report.dailySeries)||!report.dailySeries.length)return report;
 const r=refresh(report,report.dailySeries),prior=report.dataContract;
 const original=clone(originalRows||report.originalDailySeries||report.dailySeries);
 r.originalDailySeries=original;
 const c={schemaVersion:SCHEMA,sourceVersion:VERSION,source:r.dailySeriesMeta.source||null,sourceMode:r.scanMode||r.dailySeriesMeta.mode||'FULL',stock:String(r.stock||r.code||''),market:String(r.market||'').toUpperCase(),closeDate:r.closeDate,completed:r.completed!==false&&r.isComplete!==false&&r.dailySeriesMeta.onlyCompletedBars===true,onlyCompletedBars:r.dailySeriesMeta.onlyCompletedBars===true,volumeUnit:'shares',volumeUnitSource:clone(evidence||prior?.volumeUnitSource||[]),historyBarCount:r.dailySeries.length,originalHistoryFingerprint:fingerprint(original),normalizedHistoryFingerprint:fingerprint(r.dailySeries),officialRecoveryApplied:officialRecoveryEvidence.length>0,officialRecoveryEvidence:clone(officialRecoveryEvidence),snapshotVerified:snapshotVerified===true,revision:predecessor?{reason:'OFFICIAL_GAP_RECOVERY',predecessor}:null};
 r.dataContract=c;r.volumeUnit='shares';r.completed=c.completed;r.isComplete=c.completed;
 r.dailySeriesMeta={...r.dailySeriesMeta,schemaVersion:SCHEMA,volumeUnit:'shares',volumeUnitSource:c.volumeUnitSource};
 return r;
}
function auditQuote(q){
 const official=q.officialTradeValue??(q.tradeValueSource==='ESTIMATED_CLOSE_X_VOLUME'?null:q.tradeValue),volume=Number(q.volume),avg=Number(official)/volume;
 const available=official!=null&&Number(official)>0&&volume>0;
 const conflict=available&&(avg<Number(q.low)-.02||avg>Number(q.high)+.02);
 return {...q,volumeUnit:q.volumeUnit||'shares',volumeSource:q.volumeSource||'OFFICIAL_MARKET_SNAPSHOT',volumeScope:q.volumeScope||'OFFICIAL_REPORTED_SCOPE_UNVERIFIED',tradeValueScope:q.tradeValueScope||'OFFICIAL_REPORTED_SCOPE_UNVERIFIED',volumeScopeAudit:{status:conflict?'UNRESOLVED_SCOPE_CONFLICT':available?'RANGE_CONSISTENT_SCOPE_UNVERIFIED':'AMOUNT_UNAVAILABLE',impliedAverage:available?avg:null,formalVolumeEligible:!conflict,reason:conflict?'成交金額／股數與日K區間口徑待查證；保留原值，不認定假行情':''}};
}
function verify(report){
 const c=report?.dataContract,rows=report?.dailySeries,original=report?.originalDailySeries;
 const bad=reason=>({ok:false,reason});
 if(!c||c.schemaVersion!==SCHEMA||c.sourceVersion!==VERSION)return bad('未知結構化資料契約版本');
 if(report.dailySeriesMeta?.schema!=='daily-ohlcv-v1'||c.sourceMode!==(report.scanMode||report.dailySeriesMeta?.mode||'FULL'))return bad('結構化日K格式／模式衝突');
 if(!Array.isArray(rows)||!rows.length||!Array.isArray(original)||!original.length)return bad('缺少可追蹤原始日K');
 if(c.stock!==String(report.stock||report.code||'')||c.market!==String(report.market||'').toUpperCase()||c.closeDate!==report.closeDate)return bad('結構化資料身分衝突');
 if(c.completed!==true||c.onlyCompletedBars!==true||report.dailySeriesMeta?.onlyCompletedBars!==true)return bad('未確認完成日K');
 if(c.volumeUnit!=='shares'||c.historyBarCount!==rows.length||!['FULL','CORE','DAILY_ONLY','SCAN_LITE','MOMENTUM_LITE'].includes(c.sourceMode))return bad('結構化成交量單位／根數／模式衝突');
 if(c.originalHistoryFingerprint!==fingerprint(original)||c.normalizedHistoryFingerprint!==fingerprint(rows))return bad('原始／標準化指紋不符');
 if(original.some(b=>b.stock&&String(b.stock)!==c.stock||b.code&&String(b.code)!==c.stock||b.market&&String(b.market).toUpperCase()!==c.market))return bad('原始日K股票／市場身分衝突');
 if(!Array.isArray(c.volumeUnitSource)||!c.volumeUnitSource.length)return bad('缺少成交量解析器證據');
 for(const e of c.volumeUnitSource){const a=adapters[e.adapter];if(!a||e.field!==a.field||e.inputUnit!==a.inputUnit||e.multiplier!==a.multiplier||e.outputUnit!=='shares')return bad('成交量來源證據或單位衝突');}
 if(typeof c.snapshotVerified!=='boolean'||typeof c.officialRecoveryApplied!=='boolean'||!Array.isArray(c.officialRecoveryEvidence))return bad('驗證狀態格式錯誤');
 if(c.officialRecoveryApplied!==!!c.officialRecoveryEvidence.length)return bad('官方補K宣告缺少證據');
 for(const e of c.officialRecoveryEvidence){
  const row=rows.find(b=>b.date===e.date),adapter=adapters[e.adapter];
  if(!row||!adapter||!['TWSE_STOCK_DAY','TPEX_DAILY_HISTORY','VERIFIED_LATEST_SNAPSHOT','GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE'].includes(e.adapter)||e.stock!==c.stock||e.market!==c.market||e.volumeUnit!=='shares'||e.rowFingerprint!==fingerprint([row]))return bad('官方補K證據未對齊日K');
 }
 return {ok:true,contract:c};
}
return Object.freeze({SCHEMA,VERSION,adapters,bars,fingerprint,unitEvidence,refresh,seal,verify,auditQuote});
});

// END EMBEDDED DAILY CONTRACT
// 石頭少爺 Agent V49 R4.9.3｜DAILY_ONLY＋MOMENTUM_LITE 輕量掃描模式。
// - DAILY_ONLY 只回傳最近160根已完成OHLCV；略過月K、Fib、Tactical、Decision Layer，供前端三盤/8-21-55/5-13-34/費波自行計算。
// 石頭少爺 Agent V40 正式版｜批次掃描降載＋報告一致性修正。
// - profile=CORE：bulk DeepScan 跳過 Decision Layer；Fib/量價/structure/dailySeries 正式排名輸入不變。
// - 最終候選可再用預設 FULL profile 取得三週期適配；CORE 不污染共用 SCAN_LITE 結果快取。
// - 只澄清不同時間窗低點語意與中短波段空間比名稱，不改正式分數公式。
// - V40 Action Gate：統一個股頁與盤前榜的條件不足／等待突破／追價風險／第一壓力空間判讀；只覆蓋級別與名次資格，不改任何原始分數。
const VERSION = "石頭少爺 Agent V49 正式版｜R5.3.2.4.26-R4.9.3-CLOSED-BAR.1-CONTRACT.1｜選股一致性與完整性修正版";

// V39 B11 RC2｜SCAN_LITE 快取/投影淨化修正。
// - 修正 FULL 分析快取投影成 SCAN_LITE 時，B5/B6 research audit 可能被重新帶回的契約漏洞。
// - SCAN_LITE cache schema 升為 v2，避免舊候選快取沿用研究欄位。
// - cache hit / full-result projection / cold SCAN_LITE 三條路徑都強制 research audit = null。
// - 正式三週期分數、ABC/Fib/N字、DayTrade 排名公式不變。

// V39 B10 RC1｜總整併候選：SCAN_LITE fresh-build 已停止 B5/B6 研究稽核計算。

// V39 第七批候選：歷史 Replay Dataset 研究模式。
// 只有 ?replay=1 明確要求時才計算；正常個股查詢與 SCAN_LITE 不增加 replay CPU。
// 特徵只使用 anchor 當日及以前資料；未來 1/3/5 日只放在 labels，嚴禁回流到分數。

// V39 第六批候選：權重消融 Shadow Lab。
// 僅建立平行反事實分數與敏感度稽核；正式三週期分數、分界、primary/secondary 與排序完全不改。

// V2.9.14.1: Reuse immutable Intl formatters, normalize daily rows in one pass,
// and serialize JSON without indentation. No analytical rules/history windows changed.
// Lazy initialization avoids doing Intl work on cache-only responses/startup.
let taipeiDateFormatterV29141 = null;
let taipeiMonthFormatterV29141 = null;


// V2.9.14.0｜盤後決策層＋三週期適配度
// - 保留 V2.9.13.3 全部官方月線／日線資料隔離、Fib V2.4、Tactical N、量能、structure、快取與 SCAN_LITE。
// - 新增純盤後 Decision Layer：趨勢慣性、均線扣抵壓力、量價健康、反彈品質、壓力地圖、剩餘空間、追價風險、出場風險。
// - 新增三週期 0~100 適配度：明日當沖盤前、短波段、長波段；85~100優先作戰、70~84可以操作、55~69關注、54以下略過。
// - 分數是盤後適配度，不是統計勝率；不使用明日開盤／VWAP／5分K等不存在的即時資料。
// - SCAN_LITE 同步攜帶決策層，避免個股查詢與全市場 DeepScan 使用不同邏輯。
// V2.9.13.3｜TWSE 最新完成日K一致性修正
// - 修正「月K快取由 degraded → ready 後，TWSE 日線反而退回上一交易日」。
// - TWSE 正常月線路徑的日線來源改為：官方日K歷史為主體
//   ＋ Yahoo locator 僅補官方最後日期之後的尾端缺日
//   ＋ TWSE MIS 最新已完成交易日快照。
// - 不用 Yahoo 覆蓋既有官方歷史日K；只做官方尾端缺口 bridge。
// - 月K、startMonth、月20MA、Base 仍只使用官方月線；不拿 Yahoo/MIS 冒充月線。
// - SCAN_LITE 每次最多補1個月、cache-only candidate verification、220 bars 全部保留。
// - 目的：同一個靜態行情重掃時，不再因 STOCK_MONTH_KV 暖機狀態不同而讓 close/MA20/RSI/候選資格漂移。
// V2.9.13.2｜SCAN_LITE 跨月降載＋月K持久快取
// - 完整 ?stock= 查詢：維持 V2.9.13.1 的完整官方月K補抓、recovery、起始月驗證與動態回溯。
// - ?stock=&mode=SCAN_LITE：近期官方月K每次最多只補 1 個缺月，不執行 recent recovery。
// - SCAN_LITE 起始月驗證改成「快取資料足夠才驗證」；不足時直接 PENDING，不再為掃描啟動重型 candidate fetch / dynamic backfill。
// - SCAN_LITE 的 Yahoo locator 歷史窗由60個月降為42個月；仍遠高於 Fib 360交易日與月20MA所需觀察窗。
// - 新增可選 binding：STOCK_MONTH_KV。只保存官方月K aggregate，不把10分鐘掃描結果/locator等高頻快取寫進 KV。
// - STOCK_MONTH_KV 若未綁定，完全相容原 caches.default；若已綁定且 KV 尚未暖機，可回讀 caches.default 並漸進搬移。
// - SCAN_LITE 當月快取以「最新完成交易日」檢查資料日期；只要快取已含該交易日，就不因20分鐘 age 再重抓同一月份。
// - 目標：保留 Fib / RSI / MA20 / 量能 / structure 與三榜前端公式，同時把 Free Workers 冷啟動與跨月 CPU 壓力壓低。
// V2.9.13.1｜跨月最新完成交易月修正
// - 近期官方月K recentKeys 不再直接以「台北當下日曆月份」當終點。
// - 改以 Yahoo locator 中「最新完成交易日」所在月份作為終點。
// - 例如 2026/09/01 開盤前，最新完成交易日仍為 2026/08/31，recentKeys 必須結束在 202608，
//   不可誤要求尚不存在的 202609 官方月K。
// - 若當日已超過既有 completed-bar cutoff，且 locator 已有當日有效日K，才會自然切換到當月。
// - 若 locator 無可用完成日K，才退回原本台北當下月份，避免破壞既有容錯。
// - SCAN_LITE、Fib V2.4、月線規則、完整個股模式、快取、Market Worker 串接全部不變。
// V2.9.13.0｜SCAN_LITE 免費方案 CPU 瘦身
// - 一般 ?stock= 個股完整分析完全維持原 V2.9.12.1 路徑。
// - 新增 ?stock=xxxx&mode=SCAN_LITE，專供 Market Worker DeepScan。
// - SCAN_LITE 保留：官方月線資格、日 RSI5、Fib N字 V2.4、量能、日20MA/突破品質所需 structure、220根已完成日K。
// - SCAN_LITE 略過：Tactical N 全歷史掃描、attach tactical enrich、analyzeTacticalSignals 與完整420根序列。
// - 新增 10 分鐘 SCAN_LITE 專用快取；若完整個股快取已命中，直接投影成輕量回傳。
// - 目標：不改前端三榜 Gate/排序公式，降低 Free Workers 單檔 CPU time 超限機率。

// V2.9.12 核心新增：回傳最近最多420個「已完成交易日」OHLCV，供前端三叉戟／K棒情境／Replay-ready使用。
// 仍完整保留 V2.9.10 的 TPEx 月線／日線資料源隔離：
// - TPEx GitHub Relay只供「月線官方OHLC」。
// - 日線 Fib / Tactical N / RSI / MA / 量能固定使用 Yahoo 日K + TWSE MIS 最新已完成日K。
// - 絕對禁止把每月一筆的 Relay OHLC 誤當成連續日K。
// V2.9.12.1 Hotfix：TWSE／TPEx 近期官方月K若暫有缺月，不再讓整檔股票直接422空白。
// - 先保存已成功官方月份，後續查詢繼續補缺月。
// - 同次查詢先用Yahoo日K骨架＋TWSE MIS最新已完成日K提供「日線降級報告」。
// - 月20MA／startMonth／Base／固定倍數保持 unavailable，絕不以非官方月線補造。
// - 降級結果不寫入短效分析結果快取，讓下一次查詢能繼續補官方缺月。

const MAIN_HISTORY_MONTHS = 33;
const MONTHLY_MA_PERIOD = 20;
const MONTHLY_MA_WARMUP_MONTHS = MONTHLY_MA_PERIOD - 1;
const RECENT_OFFICIAL_MONTHS = 20;
const CANDIDATE_VERIFY_MONTHS = 22;
const LOCATOR_HISTORY_MONTHS = 60;
const MAX_NETWORK_FETCHES = 47;
const DYNAMIC_BACKFILL_STEP_MONTHS = 13;
const MAX_DYNAMIC_OFFICIAL_MONTHS = 56;
const RSI_PERIOD = 5;

// V2.9.12：前端逐日 OHLCV 輸出＋研究閘門較長歷史。
// 420 根約涵蓋 19～20 個月交易日；前端只畫最近約80根，但研究閘門可使用較長歷史做 no-lookahead / walk-forward 驗證；180 根作為研究最低觀察窗。
// 此欄位只輸出「已完成交易日」，不含當日尚未收盤的半根K。
const DAILY_SERIES_RETURN_BARS = 420;
const DAILY_SERIES_MIN_RECOMMENDED_BARS = 180;

// V2.9.13.0：DeepScan 專用輕量模式。
const SCAN_LITE_MODE = "SCAN_LITE";
// R4.9：強勢飆股專用 DAILY_ONLY。只取得已完成日K，不跑官方月K、Fib、Tactical、Decision Layer。
const DAILY_ONLY_MODE = "DAILY_ONLY";
const DAILY_ONLY_DAILY_SERIES_BARS = 160;
const DAILY_ONLY_HISTORY_MONTHS = 10;
// R4.9.3：主升全市場專用輕量分析。保留日RSI/Fib/量價/structure，略過官方月K與Decision Layer。
const MOMENTUM_LITE_MODE = "MOMENTUM_LITE";
const MOMENTUM_LITE_DAILY_SERIES_BARS = 220;
const MOMENTUM_LITE_HISTORY_MONTHS = 24;
const SCAN_LITE_DAILY_SERIES_BARS = 220;
const SCAN_LITE_CACHE_SCHEMA = "scan-lite-result-cache-v4-closed-session-guard";
const SCAN_LITE_CACHE_KEY_PATH = "/__shitou_internal_cache__/scan-lite-result";
const SCAN_LITE_CACHE_TTL_SECONDS = 10 * 60;
// V2.9.13.2：Free CPU 降載。
// Yahoo 42個月仍可覆蓋 Fib 360交易日與月20MA候選定位；
// 官方月K冷啟動每次最多補1個缺月，避免一次20月＋recovery。
const SCAN_LITE_LOCATOR_HISTORY_MONTHS = 42;
const SCAN_LITE_MONTHLY_FETCH_LIMIT = 1;

// V2.9.0：零設定漸進式官方資料快取。
// 若另外綁定 Workers KV（binding 名稱：STOCK_CACHE），會優先使用 KV；
// 未綁定也可直接貼上部署，會自動使用 caches.default。
const OFFICIAL_CACHE_SCHEMA = "official-month-cache-v2-contract-1";
const OFFICIAL_CACHE_MAX_MONTHS = 72;
const OFFICIAL_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CURRENT_MONTH_CACHE_MAX_AGE_MS = 20 * 60 * 1000;
const CACHE_KEY_PATH = "/__shitou_internal_cache__/official-months";
const RECENT_RECOVERY_RESERVE_BUDGET = 12;
const CANDIDATE_RECOVERY_RESERVE_BUDGET = 5;

// V2.9.6：效能層。
// 1) 分析結果短效快取：同一檔短時間重複查詢直接回傳，不再重跑上游資料取得與計算。
// 2) 市場別快取：TWSE / TPEx 官方辨識成功後保存 24 小時。
// 3) Yahoo 候選定位快取：保存 30 分鐘，且不跨越台灣 14:30 完整日K切換點。
// 4) debug=1 顯示各階段耗時；debug=1&nocache=1 可測冷啟動完整路徑。
const RESULT_CACHE_SCHEMA = "analysis-result-cache-v4-closed-session-guard";
const RESULT_CACHE_KEY_PATH = "/__shitou_internal_cache__/analysis-result";
const RESULT_CACHE_TTL_SECONDS = 5 * 60;
const MARKET_ROUTE_CACHE_SCHEMA = "market-route-cache-v4";
const MARKET_ROUTE_CACHE_KEY_PATH = "/__shitou_internal_cache__/market-route";
const MARKET_ROUTE_CACHE_TTL_SECONDS = 24 * 60 * 60;
const TPEX_CANDIDATE_ROUTE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const LOCATOR_CACHE_SCHEMA = "yahoo-locator-cache-v3-contract-1";
const LOCATOR_CACHE_KEY_PATH = "/__shitou_internal_cache__/yahoo-locator";
const LOCATOR_CACHE_TTL_SECONDS = 30 * 60;

const TWSE_OPENAPI_COMPANIES = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const TWSE_OPENAPI_QUOTES = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_OPENAPI_COMPANIES = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";
const TPEX_OPENAPI_QUOTES = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes";

const TWSE_REQUEST_DELAY_MS = 450;
const TPEX_REQUEST_DELAY_MS = 260;
const TWSE_BLOCK_BACKOFF_MS = 1200;
const TPEX_REDIRECT_BACKOFF_MS = 220;
const OFFICIAL_RECOVERY_COOLDOWN_MS = 2000;
const OFFICIAL_RECOVERY_SECOND_COOLDOWN_MS = 3000;
const OFFICIAL_RECOVERY_SPACING_MS = 1050;
const OFFICIAL_RECOVERY_MAX_ROUNDS = 2;
const TWSE_HISTORY_TIMEOUT_MS = 10000;
const TPEX_HISTORY_TIMEOUT_MS = 10000;
const TPEX_RELAY_TIMEOUT_MS = 12000;

const FIB_LOOKBACK_DAYS = 360;
const FIB_PIVOT_LEFT = 3;
const FIB_PIVOT_RIGHT = 3;
const FIB_MIN_AB_PCT = 0.06;
const FIB_MIN_RETRACE_OF_AB = 0.15;
const FIB_MAX_RETRACE_OF_AB = 0.85;

// 傑克.史東舊版戰術 N 字／寶塔線翻紅層。
// 只使用「當下已知」的前三個完整交易日，不使用未來K棒。
const TACTICAL_N_LOOKBACK_DAYS = 360;
const TACTICAL_N_NECKLINE_BARS = 3;
const TACTICAL_N_THREE_DAY_BARS = 3;
const TACTICAL_N_DEFENSE_NEAR_PCT = 1.5;

const TAIWAN_COMPLETED_BAR_HOUR = 14;
const TAIWAN_COMPLETED_BAR_MINUTE = 30;
const FETCH_TIMEOUT_MS = 8000;

// V47 少爺助理補充資料路由。
// 這條路由與原有個股分析完全分離；失敗時前端只會把該證據標為資料不足，
// 不會改動 ABC、N字、Pivot、Swing Chain、分數或 executionAllowed。
const SHITO_ASSISTANT_DATA_VERSION_V47 = "shito-assistant-data-v1";
const SHITO_ASSISTANT_TIMEOUT_V47 = 14000;
function assistantNumberV47(v) {
  if (v === null || v === undefined || String(v).trim() === "" || String(v).trim() === "-") return null;
  const x = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : null;
}
async function assistantFetchJsonV47(url, options = {}, timeout = SHITO_ASSISTANT_TIMEOUT_V47) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options.headers || {}) }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
function assistantTaiwanDateV47(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
// Candidate weekdays only; exchange holidays are verified separately downstream.
function assistantRecentDatesV47(count = 12, now = new Date()) {
 const out=[];
 for(let i=0;i<count;i++){
  const iso=assistantTaiwanDateV47(new Date(now.getTime()-i*86400000));
  const day=new Date(iso+'T00:00:00Z').getUTCDay();
  if(day!==0&&day!==6)out.push(iso);
 }
 return out;
}
function assistantRocDateV47(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return `${y - 1911}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}
async function fetchInstitutionDayV47(stock, market, isoDate) {
  if (String(market).toUpperCase().includes("TPEX") || String(market).toUpperCase().includes("OTC")) {
    const u = `https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php?l=zh-tw&o=json&d=${encodeURIComponent(assistantRocDateV47(isoDate))}&s=0,asc`;
    const j = await assistantFetchJsonV47(u);
    const table = Array.isArray(j?.tables) ? j.tables[0] : null;
    const row = (table?.data || []).find(x => String(x?.[0] || "").trim() === stock);
    if (!row) return null;
    return { date: isoDate, foreign: assistantNumberV47(row[4]), trust: assistantNumberV47(row[13]), dealer: assistantNumberV47(row[22]), total: assistantNumberV47(row[23]), source: "TPEx三大法人買賣明細" };
  }
  const compact = isoDate.replace(/-/g, "");
  const j = await assistantFetchJsonV47(`https://www.twse.com.tw/rwd/zh/fund/T86?date=${compact}&selectType=ALL&response=json`);
  if (j?.stat !== "OK") return null;
  const row = (j?.data || []).find(x => String(x?.[0] || "").trim() === stock);
  if (!row) return null;
  return { date: isoDate, foreign: assistantNumberV47(row[4]), trust: assistantNumberV47(row[10]), dealer: assistantNumberV47(row[11]), total: assistantNumberV47(row[18]), source: "TWSE三大法人買賣超日報" };
}
async function fetchInstitutionFiveDaysV47(stock, market) {
  const dates = assistantRecentDatesV47(14), rows = [];
  for (const date of dates) {
    if (rows.length >= 5) break;
    try { const row = await fetchInstitutionDayV47(stock, market, date); if (row) rows.push(row); } catch (_) {}
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
async function fetchRevenueSnapshotV47(stock, market) {
  const otc = String(market).toUpperCase().includes("TPEX") || String(market).toUpperCase().includes("OTC");
  const url = otc ? "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O" : "https://openapi.twse.com.tw/v1/opendata/t187ap05_L";
  const rows = await assistantFetchJsonV47(url);
  const row = (Array.isArray(rows) ? rows : []).find(x => String(x["公司代號"] || x.CompanyCode || "").trim() === stock);
  if (!row) return null;
  return { month: String(row["資料年月"] || row.YearMonth || ""), date: String(row["出表日期"] || row.Date || ""), revenue: assistantNumberV47(row["營業收入-當月營收"] || row.MonthlyRevenue), yoy: assistantNumberV47(row["營業收入-去年同月增減(%)"] || row.MonthlyRevenueChangePercent), source: otc ? "TPEx上櫃公司每月營收" : "TWSE上市公司每月營收" };
}
async function fetchGrossMarginSnapshotV47(stock, market) {
  const otc = String(market).toUpperCase().includes("TPEX") || String(market).toUpperCase().includes("OTC");
  const suffixes = ["ci", "mim", "basi", "fh", "ins", "bd"];
  for (const suffix of suffixes) {
    const url = otc ? `https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap06_O_${suffix}` : `https://openapi.twse.com.tw/v1/opendata/t187ap06_L_${suffix}`;
    try {
      const rows = await assistantFetchJsonV47(url);
      const row = (Array.isArray(rows) ? rows : []).find(x => String(x["公司代號"] || x.CompanyCode || "").trim() === stock);
      if (!row) continue;
      const revenue = assistantNumberV47(row["營業收入"] || row.OperatingRevenue), gross = assistantNumberV47(row["營業毛利（毛損）淨額"] || row["營業毛利（毛損）"] || row.GrossProfitLoss);
      return { quarter: `${row["年度"] || row.Year || ""}Q${row["季別"] || row.Season || ""}`, date: String(row["出表日期"] || row.Date || ""), cumulativeRevenue: revenue, cumulativeGrossProfit: gross, cumulativeGrossMargin: revenue ? gross / revenue * 100 : null, grossMargin: null, source: otc ? "TPEx上櫃公司綜合損益表" : "TWSE上市公司綜合損益表", note: "官方欄位是年初至本季累計值；未取得前一季累計值前，不冒充單季毛利率。" };
    } catch (_) {}
  }
  return null;
}
async function fetchTdccSnapshotV47(stock) {
  const rows = await assistantFetchJsonV47("https://openapi.tdcc.com.tw/v1/opendata/1-5", {}, 20000);
  const matched = (Array.isArray(rows) ? rows : []).filter(x => String(x["證券代號"] || "").trim() === stock);
  if (!matched.length) return null;
  const ratioFor = levels => matched.filter(x => levels.includes(Number(x["持股分級"]))).reduce((s, x) => s + (assistantNumberV47(x["占集保庫存數比例%"] || x["占集保庫存數比例％"]) || 0), 0);
  return { date: String(matched[0]["﻿資料日期"] || matched[0]["資料日期"] || ""), largeHolderPct: ratioFor([12,13,14,15]), smallHolderPct: ratioFor([1,2,3]), largeHolderLevels: "TDCC第12～15級（400張以上）", smallHolderLevels: "TDCC第1～3級（10張以下）", source: "TDCC集保戶股權分散表" };
}
async function handleShitoAssistantDataV47(request, env, ctx, corsHeaders, stock, market) {
  const cache = caches.default;
  const cacheKey = new Request(`https://shitou-assistant-cache.invalid/v1/${encodeURIComponent(market || "AUTO")}/${stock}`);
  const hit = await cache.match(cacheKey);
  if (hit) return new Response(hit.body, { status: hit.status, headers: { ...Object.fromEntries(hit.headers), ...corsHeaders, "X-Shito-Assistant-Cache": "HIT" } });
  const settled = await Promise.allSettled([
    fetchRevenueSnapshotV47(stock, market),
    fetchGrossMarginSnapshotV47(stock, market),
    fetchTdccSnapshotV47(stock),
    fetchInstitutionFiveDaysV47(stock, market)
  ]);
  const value = i => settled[i].status === "fulfilled" ? settled[i].value : null;
  const errors = settled.map((x, i) => x.status === "rejected" ? ({ source: ["月營收", "財報", "集保", "三大法人"][i], message: x.reason?.message || String(x.reason) }) : null).filter(Boolean);
  const revenue = value(0), gross = value(1), tdcc = value(2), institution = value(3) || [];
  const payload = { version: VERSION, schema: SHITO_ASSISTANT_DATA_VERSION_V47, stock, market, generatedAt: new Date().toISOString(), data: { revenueHistory: revenue ? [revenue] : [], grossMarginHistory: gross ? [gross] : [], tdccHistory: tdcc ? [tdcc] : [], institutionalTrading: institution, sourceStatus: { revenue: revenue ? "available" : "unavailable", grossMargin: gross ? "partial-cumulative-only" : "unavailable", tdcc: tdcc ? "latest-week-only" : "unavailable", institution: institution.length >= 5 ? "available" : "partial" }, errors } };
  const response = jsonResponse(payload, 200, { ...corsHeaders, "Cache-Control": "public, max-age=900", "X-Shito-Assistant-Cache": "MISS" });
  const stored = new Response(response.clone().body, { status: 200, headers: { ...Object.fromEntries(response.headers), "Cache-Control": "public, max-age=14400" } });
  if (ctx?.waitUntil) ctx.waitUntil(cache.put(cacheKey, stored)); else await cache.put(cacheKey, stored);
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return jsonResponse(
        { version: VERSION, error: "僅支援 GET 請求。" },
        405,
        { ...corsHeaders, Allow: "GET, OPTIONS" }
      );
    }

    const timing = createTimingTracker();
    const url = new URL(request.url);
    const stock = (url.searchParams.get("stock") || "2330").trim();
    const mode = String(url.searchParams.get("mode") || "").trim().toUpperCase();
    const scanLiteMode = mode === SCAN_LITE_MODE;
    const dailyOnlyMode = mode === DAILY_ONLY_MODE;
    const momentumLiteMode = mode === MOMENTUM_LITE_MODE;
    const marketHintRaw = String(url.searchParams.get("marketHint") || url.searchParams.get("market") || "").trim().toUpperCase();
    const marketHint = marketHintRaw === "TPEX" ? "TPEx" : (marketHintRaw === "TWSE" ? "TWSE" : null);
    // B12 RC3：批次掃描可指定 profile=CORE，只保留正式掃描排名需要的 Fib/量價/structure/dailySeries。
    // Decision Layer / 三週期適配延後到最終候選再載入，避免 400~500 檔 bulk scan 每檔都重算。
    const requestedScanProfile = String(url.searchParams.get("profile") || "FULL").trim().toUpperCase();
    const scanProfile = scanLiteMode && requestedScanProfile === "CORE" ? "CORE" : "FULL";
    const scanCoreMode = scanLiteMode && scanProfile === "CORE";
    const debugMode = url.searchParams.get("debug") === "1";
    const assistantMode = url.searchParams.get("assistant") === "1";
    if (assistantMode) {
      if (!/^\d{4,6}$/.test(stock)) return jsonResponse({ version: VERSION, error: "股票代號格式錯誤，請輸入4～6位數字。" }, 400, corsHeaders);
      return handleShitoAssistantDataV47(request, env, ctx, corsHeaders, stock, url.searchParams.get("market") || "TWSE");
    }
    const replayResearchMode = url.searchParams.get("replay") === "1" && !scanLiteMode && !dailyOnlyMode && !momentumLiteMode;
    const replayResearchLimit = Math.min(REPLAY_RESEARCH_MAX_LIMIT_V39B7, Math.max(1, Number.parseInt(url.searchParams.get("replayLimit") || String(REPLAY_RESEARCH_DEFAULT_LIMIT_V39B7), 10) || REPLAY_RESEARCH_DEFAULT_LIMIT_V39B7));
    const replayResearchStep = Math.min(REPLAY_RESEARCH_MAX_STEP_V39B7, Math.max(1, Number.parseInt(url.searchParams.get("replayStep") || String(REPLAY_RESEARCH_DEFAULT_STEP_V39B7), 10) || REPLAY_RESEARCH_DEFAULT_STEP_V39B7));
    const bypassCache = url.searchParams.get("nocache") === "1";
    const budget = createNetworkBudget(MAX_NETWORK_FETCHES);
    const fetchContext = {
      twsePreferredHost: "www.twse.com.tw",
      tpexLearnedHistoryBase: null,
      tpexPreferredHistoryMode: "modern",
      tpexOpenApiBlocked: false,
      // V2.9.9：同一次 invocation 內記住已失敗的 TPEx 歷史路徑，
      // 避免每個月份都重撞同一個 gateway。
      tpexModernCsvUnavailable: false,
      tpexLegacyJsonUnavailable: false,
      tpexLegacyCsvUnavailable: false,
      tpexHtmlUnavailable: false,
      marketProbeMonth: null,
      // V2.9.9：可選 TPEx 官方靜態 Relay / Mirror。
      // 建議值：
      //   TPEX_RELAY_URL=https://raw.githubusercontent.com/<owner>/shitou-tpex-relay/main/data/{stock}.json
      // Worker 會在單次 invocation 內只下載一次該股票 Relay 檔，再依 monthKey 篩選；
      // 因此 20～56 個月份不會重複對 GitHub 發出 20～56 次相同請求。
      // TPEX_RELAY_TOKEN 僅供自建動態 Relay 使用；公開 GitHub Raw 不需要。
      tpexRelayUrl: String(env?.TPEX_RELAY_URL || "").trim() || null,
      tpexRelayToken: String(env?.TPEX_RELAY_TOKEN || "").trim() || null,
      tpexRelayPayloadCache: new Map()
    };
    const debug = {
      version: VERSION,
      stock,
      strategy: dailyOnlyMode
        ? "R4.9.3 DAILY_ONLY completed-OHLCV-only + market-hint + no-monthly/no-fib/no-decision-layer"
        : momentumLiteMode
          ? "R4.9.3 MOMENTUM_LITE daily-RSI + fib-v2.4-lite + volume + structure + no-official-monthly/no-decision-layer"
        : scanLiteMode ? (scanCoreMode
          ? "v2.9.14.3 SCAN_LITE CORE bulk-ranking + deferred-decision-layer + fib-v2.4 + structure + 220-bars"
          : "v2.9.14.3 SCAN_LITE FULL monthly-load-shed + decision-layer + fib-v2.4 + structure + 220-bars") : "v2.9.12 daily-ohlcv-series-420-research-ready + v2.9.10 tpex-month-daily-source-isolation + github-static-tpex-relay-monthly-only + yahoo-mis-daily-analysis + v2.9.9 invocation-relay-payload-cache + v2.9.8 tpex-official-csv-recovery + v2.9.7 tpex-fast-route + v2.9.6 multi-layer-cache + monthly-regime-timeline-debug",
      steps: []
    };
    Object.defineProperty(debug, "__timingTracker", {
      value: timing,
      enumerable: false
    });

    try {
      if (!/^\d{4,6}$/.test(stock)) {
        return jsonResponse(
          { version: VERSION, error: "股票代號格式錯誤，請輸入 4～6 位數字。", stock },
          400,
          corsHeaders
        );
      }

      // V2.9.13.0：SCAN_LITE 先讀自己的10分鐘輕量快取。
      // 不污染完整個股分析快取，避免一般個股查詢誤拿到裁切資料。
      let scanLiteCacheState = {
        backend: env?.STOCK_CACHE ? "KV:STOCK_CACHE" : "caches.default",
        hit: false,
        bypassed: debugMode || bypassCache || !scanLiteMode,
        ageMs: null,
        error: null
      };

      if (scanLiteMode && !debugMode && !bypassCache && !replayResearchMode) {
        scanLiteCacheState = await timing.measure("scan-lite-cache-read", () =>
          loadScanLiteResultCacheV29130({ request, env, stock })
        );
        if (scanLiteCacheState.hit && scanLiteCacheState.payload) {
          // B11 RC2：即使 cache payload 來自舊投影或被污染，也在回傳前重新套用 SCAN_LITE 契約。
          const litePayload = scanCoreMode
            ? projectScanCorePayloadV39B12(scanLiteCacheState.payload, "scan-lite-cache-hit-core-projection")
            : projectScanLitePayloadV29130(scanLiteCacheState.payload, "scan-lite-cache-hit-sanitized");
          return jsonResponse(
            litePayload,
            200,
            {
              ...corsHeaders,
              "X-Shitou-Scan-Mode": "SCAN_LITE",
              "X-Shitou-Scan-Lite-Cache": "HIT",
              "X-Shitou-Scan-Lite-Cache-Backend": scanLiteCacheState.backend,
              "X-Shitou-Scan-Lite-Contract": "V40-SANITIZED",
              "X-Shitou-Scan-Profile": scanCoreMode ? "CORE" : "FULL"
            }
          );
        }
      }

      // V2.9.6 第一層：完整分析結果短效快取。
      // debug=1 永遠不吃此層，避免診斷時看不到真實執行路徑；nocache=1 則全部快取都繞過。
      let resultCacheState = {
        backend: env?.STOCK_CACHE ? "KV:STOCK_CACHE" : "caches.default",
        hit: false,
        bypassed: debugMode || bypassCache || dailyOnlyMode || momentumLiteMode,
        ageMs: null,
        error: null
      };

      if (!debugMode && !bypassCache && !replayResearchMode && !dailyOnlyMode && !momentumLiteMode) {
        resultCacheState = await timing.measure("result-cache-read", () =>
          loadAnalysisResultCache({ request, env, stock })
        );

        if (resultCacheState.hit && resultCacheState.payload) {
          if (scanLiteMode) {
            const litePayload = scanCoreMode
              ? projectScanCorePayloadV39B12(resultCacheState.payload, "full-result-cache-core-projection")
              : projectScanLitePayloadV29130(resultCacheState.payload, "full-result-cache");
            // CORE 不寫入共用 SCAN_LITE 結果快取，避免之後 FULL profile 誤拿到延後的 Decision Layer。
            if (!scanCoreMode) {
              persistScanLiteResultCacheV29130({ request, env, ctx, stock, payload: litePayload });
            }
            return jsonResponse(
              litePayload,
              200,
              {
                ...corsHeaders,
                "X-Shitou-Scan-Mode": "SCAN_LITE",
                "X-Shitou-Result-Cache": "HIT",
                "X-Shitou-Result-Cache-Backend": resultCacheState.backend,
                "X-Shitou-Scan-Lite-Contract": "V40-SANITIZED",
                "X-Shitou-Scan-Profile": scanCoreMode ? "CORE" : "FULL"
              }
            );
          }
          return jsonResponse(
            resultCacheState.payload,
            200,
            {
              ...corsHeaders,
              "X-Shitou-Result-Cache": "HIT",
              "X-Shitou-Result-Cache-Backend": resultCacheState.backend
            }
          );
        }
      }

      // V2.9.6 第二層：股票市場別快取。
      // 官方辨識成功後保存 TWSE/TPEx 路由，避免每次都重打公司主檔／每日行情 OpenAPI。
      let marketRouteCache = {
        backend: env?.STOCK_CACHE ? "KV:STOCK_CACHE" : "caches.default",
        hit: false,
        bypassed: !!bypassCache,
        market: null,
        name: null,
        ageMs: null,
        error: null
      };

      if (!bypassCache && !((dailyOnlyMode||momentumLiteMode) && marketHint)) {
        marketRouteCache = await timing.measure("market-route-cache-read", () =>
          loadMarketRouteCache({ request, env, stock })
        );
      }

      let marketInfo;
      if ((dailyOnlyMode||momentumLiteMode) && marketHint) {
        marketInfo = {
          market: marketHint,
          name: null,
          serviceUnavailable: false,
          officialMarketConfirmed: true,
          debug: debugMode ? { matchedBy: "R4.9 Market Worker snapshot marketHint" } : undefined
        };
      } else if (marketRouteCache.hit) {
        const officialRoute = marketRouteCache.quality !== "candidate";
        marketInfo = {
          market: marketRouteCache.market,
          name: marketRouteCache.name,
          serviceUnavailable: !officialRoute,
          officialMarketConfirmed: officialRoute,
          debug: debugMode
            ? {
                matchedBy: officialRoute
                  ? "V40 官方市場別快取"
                  : "V40 上櫃候選市場別快取",
                cache: marketRouteCache
              }
            : undefined
        };
      } else {
        // V2.9.3：市場辨識採不中斷 failover；TPEx 主檔 520 / 5xx / timeout / blocked 都不能直接當 not_found。
        // 會繼續查 TWSE / TPEx 官方每日行情，再視需要進 TPEx 官方歷史 fallback。
        marketInfo = await timing.measure("market-detection", () =>
          detectOfficialMarketByOpenApi(
            stock,
            budget,
            debugMode,
            fetchContext
          )
        );

        if (marketInfo.market && !bypassCache) {
          if (marketInfo.officialMarketConfirmed === true) {
            persistMarketRouteCache({
              request, env, ctx, stock,
              market: marketInfo.market,
              name: marketInfo.name || null,
              quality: "official"
            });
          } else if (marketInfo.market === "TPEx" && marketInfo.locatorProbe?.rows?.length) {
            persistMarketRouteCache({
              request, env, ctx, stock,
              market: "TPEx",
              name: marketInfo.name || marketInfo.locatorProbe?.name || null,
              quality: "candidate"
            });
          }
        }
      }

      if (debugMode) {
        debug.marketDetection = marketInfo.debug;
        debug.performanceCache = {
          result: resultCacheState,
          scanLite: scanLiteCacheState,
          marketRoute: marketRouteCache,
          locator: null
        };
      }

      if (!marketInfo.market) {
        const serviceUnavailable = marketInfo.serviceUnavailable === true;
        return jsonResponse(
          {
            version: VERSION,
            error: serviceUnavailable
              ? "官方市場資料來源目前暫時無法存取，無法安全辨識上市／上櫃別。"
              : "找不到此股票，或目前無法由官方市場資料辨識上市／上櫃別。",
            stock,
            ...(debugMode ? { debug: finalizeDebugBudget(debug, budget) } : {})
          },
          serviceUnavailable ? 503 : 404,
          corsHeaders
        );
      }

      const market = marketInfo.market;
      let stockName = marketInfo.name || null;

      // Yahoo 僅作「候選月份定位」，不能直接產生正式 MA20 / Base / 固定倍數。
      // V2.9.6：候選定位另有 30 分鐘快取，暖機後不必每次都重打 Yahoo。
      const locatorSymbol = `${stock}.${market === "TWSE" ? "TW" : "TWO"}`;
      let locatorCacheState = {
        backend: env?.STOCK_CACHE ? "KV:STOCK_CACHE" : "caches.default",
        hit: false,
        bypassed: !!bypassCache,
        ageMs: null,
        error: null
      };
      let locator = marketInfo.locatorProbe || null;

      if (locator?.rows?.length && !bypassCache) {
        persistLocatorCache({ request, env, ctx, symbol: locatorSymbol, payload: locator });
      }

      if (!locator && !bypassCache) {
        locatorCacheState = await timing.measure("locator-cache-read", () =>
          loadLocatorCache({ request, env, symbol: locatorSymbol })
        );
        if (locatorCacheState.hit) {
          locator = locatorCacheState.payload;
        }
      }

      if (!locator) {
        locator = await timing.measure("yahoo-locator-fetch", () =>
          fetchYahooHistory(
            locatorSymbol,
            dailyOnlyMode ? DAILY_ONLY_HISTORY_MONTHS : (momentumLiteMode ? MOMENTUM_LITE_HISTORY_MONTHS : (scanLiteMode ? SCAN_LITE_LOCATOR_HISTORY_MONTHS : LOCATOR_HISTORY_MONTHS)),
            debugMode,
            budget
          )
        );

        if (!bypassCache && locator?.rows?.length) {
          persistLocatorCache({
            request,
            env,
            ctx,
            symbol: locatorSymbol,
            payload: locator
          });
        }
      }

      if (debugMode) {
        debug.performanceCache.locator = locatorCacheState;
      }

      // R4.9 強勢飆股輕量日K路徑：到這裡就停止。
      // 只保留 Yahoo 已完成日K骨架 + TWSE MIS 最新完成日快照；不進官方月K/Fib/Tactical/Decision Layer。
      if (dailyOnlyMode) {
        const misLatest = await timing.measure("daily-only-mis-latest", () =>
          fetchTwseMisLatestCompletedDaily(stock, market, budget, debugMode)
        );
        const mergedRows = getCompletedDailyRows(
          mergeDailyRowsPreferSnapshot(locator.rows, misLatest.row)
        );
        const recentDailyRows = mergedRows.slice(-Math.min(mergedRows.length, DAILY_ONLY_DAILY_SERIES_BARS));
        const latestDailyRow = recentDailyRows.length ? recentDailyRows[recentDailyRows.length - 1] : null;
        const dailySeriesSource = misLatest.row
          ? "Yahoo Finance history + TWSE MIS latest completed daily (R4.9.3 DAILY_ONLY)"
          : "Yahoo Finance history (R4.9.3 DAILY_ONLY)";
        const dailySeries = serializeDailySeriesForFrontend(
          recentDailyRows,
          DAILY_ONLY_DAILY_SERIES_BARS
        );
        const dailySeriesMeta = buildDailySeriesMeta(
          recentDailyRows,
          dailySeries,
          dailySeriesSource
        );
        const payload = {
          version: VERSION,
          stock,
          name: stockName || locator.name || `股票 ${stock}`,
          market,
          close: latestDailyRow ? round(latestDailyRow.close, 2) : null,
          closeDate: latestDailyRow?.date || null,
          dailySeries,
          dailySeriesMeta: {
            ...dailySeriesMeta,
            mode: "DAILY_ONLY",
            marketHintUsed: !!marketHint,
            requestedBars: DAILY_ONLY_DAILY_SERIES_BARS
          },
          scanMode: "DAILY_ONLY",
          dailyOnly: true,
          lightweight: {
            version: "R4.9.3",
            purpose: "strong-stock-wave-filter",
            skippedModules: ["officialMonthly","fibV2.4","tacticalN","volumeContext","structureQuality","decisionLayerV1"],
            networkPath: "Yahoo daily history + MIS latest completed daily"
          }
        };
        if (debugMode) {
          debug.dailyOnly = {
            marketHint,
            locatorRows: locator.rows?.length || 0,
            mergedRows: mergedRows.length,
            returnedBars: dailySeries.length,
            latestDate: latestDailyRow?.date || null,
            misDate: misLatest.row?.date || null,
            // SHITOU-DAILY-DIAG-1: 區分 Yahoo 歷史資料落後與 MIS 新K失敗原因。
            yahooHistoryLastDate: locator.rows?.length ? locator.rows[locator.rows.length - 1].date : null,
            yahooFetchDiagnostic: locator.debug || null,
            misFetchDiagnostic: misLatest.debug || null,
            discrepancyCause:
              !misLatest.row && locator.rows?.length ? 'MIS_UNAVAILABLE_YAHOO_ONLY' :
              !locator.rows?.length && misLatest.row ? 'YAHOO_UNAVAILABLE_MIS_ONLY' :
              !locator.rows?.length && !misLatest.row ? 'BOTH_SOURCES_UNAVAILABLE' :
              'CHECK_LATEST_DATES'
          };
          payload.debug = finalizeDebugBudget(debug, budget);
        }
        return jsonResponse(payload, 200, {
          ...corsHeaders,
          "Cache-Control": "public, max-age=300",
          "X-Shitou-Scan-Mode": "DAILY_ONLY",
          "X-Shitou-Scan-Profile": "DAILY_ONLY"
        });
      }

      // R4.9.3 主升全市場輕量路徑：只使用已完成日K計算正式日線結構，避免每檔進官方月K／Decision Layer造成CPU超限。
      // 月線欄位明確標為 unavailable；前端主升公式原本就只把月線當加分項，不會冒充已通過月線資格。
      if (momentumLiteMode) {
        const misLatest = await timing.measure("momentum-lite-mis-latest", () =>
          fetchTwseMisLatestCompletedDaily(stock, market, budget, debugMode)
        );
        const mergedRows = getCompletedDailyRows(
          mergeDailyRowsPreferSnapshot(locator.rows, misLatest.row)
        );
        const recentDailyRows = mergedRows.slice(-Math.min(mergedRows.length, MOMENTUM_LITE_DAILY_SERIES_BARS));
        if (recentDailyRows.length < 30) {
          return jsonResponse({version:VERSION,error:"MOMENTUM_LITE 完成日K不足30根，無法建立主升日線結構。",stock,market},422,corsHeaders);
        }
        const latestDailyRow = recentDailyRows[recentDailyRows.length - 1];
        const dailyRsiSeries = calculateRSISeries(recentDailyRows.map(row => row.close), RSI_PERIOD);
        const dailyRsi5 = dailyRsiSeries.length ? dailyRsiSeries[dailyRsiSeries.length - 1] : null;
        const fib = analyzeFibonacciNPatternScanLiteV29130(recentDailyRows, latestDailyRow.close);
        const volume = analyzeVolumeContextScanLiteV29130(recentDailyRows, fib);
        const structure = analyzeStructureQualityScanLiteV29130(recentDailyRows, fib, volume);
        const dailySeriesSource = misLatest.row
          ? "Yahoo Finance history + TWSE MIS latest completed daily (R4.9.3 MOMENTUM_LITE)"
          : "Yahoo Finance history (R4.9.3 MOMENTUM_LITE)";
        const dailySeries = serializeDailySeriesForFrontend(recentDailyRows, MOMENTUM_LITE_DAILY_SERIES_BARS);
        const dailySeriesMeta = buildDailySeriesMeta(recentDailyRows, dailySeries, dailySeriesSource);
        const payload = {
          version: VERSION,
          stock,
          name: stockName || locator.name || `股票 ${stock}`,
          market,
          close: round(latestDailyRow.close,2),
          closeDate: latestDailyRow.date,
          dailyRsi5: round(dailyRsi5,2),
          dailyRsi: round(dailyRsi5,2),
          dailySeries,
          dailySeriesMeta:{...dailySeriesMeta,mode:"MOMENTUM_LITE",marketHintUsed:!!marketHint,requestedBars:MOMENTUM_LITE_DAILY_SERIES_BARS},
          fib,
          volume,
          structure,
          tacticalN:null,
          tactical:null,
          decisionLayer:null,
          scanMode:"MOMENTUM_LITE",
          scanLite:true,
          scanLiteProfile:{version:"R4.9.3",profile:"MOMENTUM_LITE",dailySeriesBars:dailySeries.length,skippedModules:["officialMonthly","tacticalN","tacticalSignals","decisionLayerV1"],preservedModules:["dailyRsi5","fibV2.4Lite","volume","structure","dailySeries"]},
          officialMonthlyUnavailable:true,
          officialMonthlyUnavailableReason:"主升全市場輕量掃描先完成日線判讀；月線只在最終個股完整查詢時補充，不用月線缺失淘汰候選。",
          monthlyStatus:"UNAVAILABLE",
          monthlyPass:false,
          entry:false,
          stage:"日線主升掃描",
          lightweight:{version:"R4.9.3",purpose:"momentum-full-market-daily-structure",networkPath:"Yahoo daily history + MIS latest completed daily"}
        };
        if (debugMode) {
          debug.momentumLite={marketHint,locatorRows:locator.rows?.length||0,mergedRows:mergedRows.length,returnedBars:dailySeries.length,latestDate:latestDailyRow?.date||null,misDate:misLatest.row?.date||null};
          payload.debug=finalizeDebugBudget(debug,budget);
        }
        return jsonResponse(payload,200,{...corsHeaders,"Cache-Control":"public, max-age=300","X-Shitou-Scan-Mode":"MOMENTUM_LITE","X-Shitou-Scan-Profile":"MOMENTUM_LITE"});
      }

      const locatorState = buildMonthlyLocatorState(locator.rows);

      // V2.9.13.2：先取得最新完成交易日，讓官方月K快取在載入時就能判斷
      // 「當月快取是否已包含最新完成日」，避免只靠20分鐘 age 反覆重抓當月。
      const latestCompletedTradingDateForMonthly =
        getLatestCompletedTradingDateFromRowsV29131(locator.rows);

      if (debugMode) {
        debug.locator = {
          source: locatorCacheState.hit
            ? "Yahoo Finance（僅協助辨識市場；V40 快取命中）"
            : "Yahoo Finance (candidate only)",
          symbol: locatorSymbol,
          rows: locator.rows.length,
          currentPass: locatorState.currentPass,
          currentStartCandidate: locatorState.currentStartCandidate,
          currentBreakCandidate: locatorState.currentBreakCandidate,
          previousBreakCandidate: locatorState.previousBreakCandidate,
          boundaryAmbiguous: locatorState.boundaryAmbiguous,
          detail: locator.debug || null
        };
      }

      const officialPhases = [];
      const monthMap = new Map();

      // V2.9.0：先載入前次已成功取得的官方月份。
      const cacheState = await timing.measure("official-aggregate-cache-read", () =>
        loadOfficialAggregateCache({
          request,
          env,
          stock,
          market,
          monthMap,
          bypassCache,
          debugMode,
          scanLiteMode,
          monthlyAnchorDate: latestCompletedTradingDateForMonthly
        })
      );
      if (debugMode) debug.officialCache = cacheState;

      // 市場辨識若已用官方歷史月成功確認 TPEx，直接重用該月份。
      if (
        fetchContext.marketProbeMonth &&
        fetchContext.marketProbeMonth.key &&
        hasMonthRows(fetchContext.marketProbeMonth.result)
      ) {
        monthMap.set(fetchContext.marketProbeMonth.key, {
          ...fetchContext.marketProbeMonth.result,
          provider: market,
          fetchedAt: Date.now()
        });
        if (!stockName && fetchContext.marketProbeMonth.result.name) {
          stockName = fetchContext.marketProbeMonth.result.name;
        }
      }

      // V2.9.13.1：跨月時，近期官方月K必須跟著「最新完成交易日」，
      // 不能跟著日曆月份，否則每月1日開盤前會誤要求尚不存在的新月份。
      const recentKeys = getRecentMonthKeys(
        RECENT_OFFICIAL_MONTHS,
        latestCompletedTradingDateForMonthly
      );

      if (debugMode) {
        debug.monthlyRecentAnchor = {
          latestCompletedTradingDate: latestCompletedTradingDateForMonthly,
          latestCompletedTradingMonth:
            monthKeyFromIsoDateV29131(latestCompletedTradingDateForMonthly),
          recentFirstMonth: recentKeys[0] || null,
          recentLastMonth: recentKeys[recentKeys.length - 1] || null,
          fallbackToCalendarMonth: !latestCompletedTradingDateForMonthly
        };
      }

      if (market === "TPEx" && marketInfo.officialMarketConfirmed === false) {
        const cachedMissing = recentKeys.filter(key => !hasMonthRows(monthMap.get(key)));
        if (cachedMissing.length > 0) {
          await persistOfficialAggregateCache({
            request, env, ctx, stock, market, monthMap, bypassCache, cacheState
          });
          if (debugMode) {
            debug.officialCache = { ...cacheState, savedMonths: countCacheableMonths(monthMap) };
          }
          return buildDegradedMonthlyResponse({
            stock,
            market,
            stockName: stockName || locator.name || null,
            locator,
            locatorState,
            missingRecent: cachedMissing,
            budget,
            debugMode,
            debug,
            officialPhases,
            monthMap,
            corsHeaders,
            request, env, ctx, bypassCache, scanLiteMode, scanCoreMode
          });
        }
      }

      // V2.9.13.2：
      // FULL 完整模式完全保留原 recent-20 + recovery。
      // SCAN_LITE 每次只補最多1個「最新端缺月」，不跑 recovery；
      // 若還缺月就直接走日線降級分析，不能為月線把整檔 DeepScan 算死。
      let recentFetch;
      if (scanLiteMode) {
        const liteFetchKeys = selectScanLiteMonthlyFetchKeysV29132(
          recentKeys,
          monthMap,
          SCAN_LITE_MONTHLY_FETCH_LIMIT
        );
        recentFetch = await timing.measure("recent-official-fetch-lite", () =>
          fetchOfficialMonthSetSequential(
            stock,
            market,
            liteFetchKeys,
            monthMap,
            budget,
            debugMode,
            fetchContext,
            "recent-lite-max1"
          )
        );
        officialPhases.push(recentFetch);

        if (debugMode) {
          debug.scanLiteMonthlyLoadShed = {
            enabled: true,
            fetchLimit: SCAN_LITE_MONTHLY_FETCH_LIMIT,
            requestedMissingMonths: liteFetchKeys,
            recoverySkipped: true,
            policy: "cache-first; max1 missing official month per invocation; no recent recovery"
          };
        }
      } else {
        recentFetch = await timing.measure("recent-official-fetch", () =>
          fetchOfficialMonthSetSequential(
            stock,
            market,
            recentKeys,
            monthMap,
            budget,
            debugMode,
            fetchContext,
            "recent-20"
          )
        );
        officialPhases.push(recentFetch);

        await timing.measure("recent-official-recovery", () =>
          recoverMissingOfficialMonths({
            stock,
            market,
            monthKeys: recentKeys,
            monthMap,
            budget,
            debugMode,
            fetchContext,
            phases: officialPhases,
            phaseBase: "recent-20-recovery",
            maxRounds: 1,
            reserveBudget: RECENT_RECOVERY_RESERVE_BUDGET
          })
        );
      }

      const missingRecent = recentKeys.filter(
        key => !hasMonthRows(monthMap.get(key))
      );
      if (missingRecent.length > 0) {
        await persistOfficialAggregateCache({
          request, env, ctx, stock, market, monthMap, bypassCache, cacheState
        });

        if (debugMode) {
          debug.official = buildOfficialDebug(officialPhases, monthMap, market);
          debug.officialCache = { ...cacheState, savedMonths: countCacheableMonths(monthMap) };
        }

        // V2.9.12.1：近期官方月K缺漏時，不再讓整檔股票直接422空白。
        // 只要Yahoo locator已有可用日K，就先回傳「日線可分析、月線暫不可用」的降級結果；
        // 已成功的官方月份仍已保存，下一次查詢會繼續補缺月。
        if (locator.rows.length > 0) {
          return buildDegradedMonthlyResponse({
            stock,
            market,
            stockName: stockName || locator.name || null,
            locator,
            locatorState,
            missingRecent,
            monthlyIssueReason: scanLiteMode
              ? "SCAN_LITE 跨月降載：官方月K快取仍有缺月；本次最多只補1個月份且不跑重型recovery。日線Fib／RSI／MA20／量能照常分析，月線資格暫標不可用；完整個股查詢仍維持完整補月。"
              : "近期官方月K資料仍有缺漏；已保存本次成功月份，後續查詢會繼續補缺月。",
            budget,
            debugMode,
            debug,
            officialPhases,
            monthMap,
            corsHeaders,
            request, env, ctx, bypassCache, scanLiteMode, scanCoreMode
          });
        }

        return jsonResponse(
          {
            version: VERSION,
            error: "近期官方月K資料仍有缺漏，且目前沒有足夠日K可建立降級分析。",
            stock,
            market,
            missingMonths: missingRecent,
            retrySuggested: true,
            source: `${market} Official`,
            officialCache: {
              backend: cacheState.backend,
              loadedMonths: cacheState.loadedMonths,
              savedMonths: countCacheableMonths(monthMap)
            },
            ...(debugMode ? { debug: finalizeDebugBudget(debug, budget) } : {})
          },
          422,
          corsHeaders
        );
      }

      const recentBars = buildMonthlyBarsFromMonthMap(recentKeys, monthMap);
      attachMonthlyIndicators(recentBars);

      if (recentBars.length < MONTHLY_MA_PERIOD) {
        if (debugMode) {
          debug.official = buildOfficialDebug(officialPhases, monthMap, market);
        }
        if (locator.rows.length > 0) {
          return buildDegradedMonthlyResponse({
            stock,
            market,
            stockName: stockName || locator.name || null,
            locator,
            locatorState,
            missingRecent: recentKeys.filter(key => !hasMonthRows(monthMap.get(key))),
            monthlyIssueReason: `月20MA暖機資料不足，目前只有 ${recentBars.length} 個可用官方月份；至少需要 ${MONTHLY_MA_PERIOD} 個連續月份。`,
            budget,
            debugMode,
            debug,
            officialPhases,
            monthMap,
            corsHeaders,
            request, env, ctx, bypassCache, scanLiteMode, scanCoreMode
          });
        }
        return jsonResponse(
          {
            version: VERSION,
            error: `月20MA暖機資料不足，至少需要 ${MONTHLY_MA_PERIOD} 個連續官方月份。`,
            stock,
            market,
            monthsFetched: recentBars.length,
            source: `${market} Official`,
            ...(debugMode ? { debug: finalizeDebugBudget(debug, budget) } : {})
          },
          422,
          corsHeaders
        );
      }

      const latestMonth = recentBars[recentBars.length - 1];
      const currentPass = isMonthlyPass(latestMonth.close, latestMonth.ma20);

      let startMonth = null;
      let startConfirmed = false;
      let previousBreakMonth = null;
      let latestBelowMonth = currentPass ? null : latestMonth;
      let previousSegmentStart = null;
      let monthlyBoundaryAmbiguous = false;
      let monthlyVerification = null;
      let monthlyConfirmationSource = null;
      let dynamicBackfill = null;
      let candidateVerificationPending = false;

      if (!currentPass) {
        monthlyVerification = {
          type: "current",
          candidate: locatorState.currentBreakCandidate || null,
          confirmed: true,
          month: latestMonth,
          previousMonth: recentBars.length >= 2 ? recentBars[recentBars.length - 2] : null,
          prePreviousMonth: recentBars.length >= 3 ? recentBars[recentBars.length - 3] : null,
          reason: "官方最近20個連續月份確認最新月收盤低於最新月20MA；目前月線條件未成立。"
        };
        monthlyConfirmationSource = `${market} official recent-20`;
      } else {
        if (locatorState.currentStartCandidate) {
          const candidateKey = locatorState.currentStartCandidate;
          const verifyKeys = getMonthKeysEndingAt(
            candidateKey,
            CANDIDATE_VERIFY_MONTHS
          );

          if (scanLiteMode) {
            // SCAN_LITE：只用已存在快取驗證起始月，缺任何月份都不再發網路請求。
            const verifyMissing = verifyKeys.filter(key => !hasMonthRows(monthMap.get(key)));
            if (!verifyMissing.length) {
              const verification = verifyOfficialTransition(
                monthMap,
                candidateKey,
                "start"
              );
              monthlyVerification = verification;
              candidateVerificationPending = !verification.confirmed;

              if (verification.confirmed) {
                startMonth = verification.month;
                startConfirmed = true;
                latestBelowMonth = verification.previousMonth;
                monthlyConfirmationSource = `${providerLabel(startMonth.provider)} official cached OHLC + locator continuity`;

                if (
                  verification.prePreviousMonth &&
                  isMonthlyPass(
                    verification.prePreviousMonth.close,
                    verification.prePreviousMonth.ma20
                  ) &&
                  !isMonthlyPass(
                    verification.previousMonth.close,
                    verification.previousMonth.ma20
                  )
                ) {
                  previousBreakMonth = verification.previousMonth;
                }
              }
            } else {
              candidateVerificationPending = true;
              monthlyVerification = {
                type: "scan-lite-cache-only-start",
                candidate: candidateKey,
                confirmed: false,
                missingMonths: verifyMissing,
                reason: "SCAN_LITE 為節省 Free Worker CPU，只使用既有官方月K快取驗證起始月；缺月不在本次掃描啟動額外補抓。"
              };
            }
          } else {
            const verifyFetch = await timing.measure("candidate-official-fetch", () =>
              fetchOfficialMonthSetSequential(
                stock,
                market,
                verifyKeys,
                monthMap,
                budget,
                debugMode,
                fetchContext,
                "candidate-verify"
              )
            );
            officialPhases.push(verifyFetch);

            await timing.measure("candidate-official-recovery", () =>
              recoverMissingOfficialMonths({
                stock,
                market,
                monthKeys: verifyKeys,
                monthMap,
                budget,
                debugMode,
                fetchContext,
                phases: officialPhases,
                phaseBase: "candidate-verify-recovery",
                maxRounds: 1,
                reserveBudget: CANDIDATE_RECOVERY_RESERVE_BUDGET
              })
            );

            const verification = verifyOfficialTransition(
              monthMap,
              candidateKey,
              "start"
            );
            monthlyVerification = verification;
            candidateVerificationPending =
              !verification.confirmed &&
              Array.isArray(verification.missingMonths) &&
              verification.missingMonths.length > 0;

            if (verification.confirmed) {
              startMonth = verification.month;
              startConfirmed = true;
              latestBelowMonth = verification.previousMonth;
              monthlyConfirmationSource = `${providerLabel(startMonth.provider)} official raw OHLC + locator continuity`;

              if (
                verification.prePreviousMonth &&
                isMonthlyPass(
                  verification.prePreviousMonth.close,
                  verification.prePreviousMonth.ma20
                ) &&
                !isMonthlyPass(
                  verification.previousMonth.close,
                  verification.previousMonth.ma20
                )
              ) {
                previousBreakMonth = verification.previousMonth;
              }
            }
          }
        }

        if (!startConfirmed && scanLiteMode) {
          // 若近期/歷史官方月份已在快取中，允許零網路成本從連續月份確認；
          // 資料不足就保持 PENDING，不啟動動態 backfill。
          const cachedStart = analyzeCachedOfficialStartV29132(
            monthMap,
            latestMonth.key
          );
          dynamicBackfill = cachedStart;

          if (cachedStart.confirmed) {
            startMonth = cachedStart.state.startMonth;
            startConfirmed = true;
            previousBreakMonth = cachedStart.state.previousBreakMonth;
            latestBelowMonth = cachedStart.state.latestBelowMonth;
            previousSegmentStart = cachedStart.state.previousSegmentStart;
            monthlyBoundaryAmbiguous = false;
            monthlyVerification = cachedStart.verification;
            monthlyConfirmationSource = `${market} official cached contiguous months`;
            candidateVerificationPending = false;
          } else {
            monthlyBoundaryAmbiguous = true;
            monthlyVerification = monthlyVerification || cachedStart.verification;
          }
        } else if (!startConfirmed && !candidateVerificationPending) {
          dynamicBackfill = await timing.measure("dynamic-official-backfill", () =>
            findActiveStartByDynamicOfficialBackfill({
              stock,
              market,
              currentMonthKey: latestMonth.key,
              monthMap,
              budget,
              debugMode,
              fetchContext,
              phases: officialPhases
            })
          );

          if (dynamicBackfill.confirmed) {
            startMonth = dynamicBackfill.state.startMonth;
            startConfirmed = true;
            previousBreakMonth = dynamicBackfill.state.previousBreakMonth;
            latestBelowMonth = dynamicBackfill.state.latestBelowMonth;
            previousSegmentStart = dynamicBackfill.state.previousSegmentStart;
            monthlyBoundaryAmbiguous = false;
            monthlyVerification = dynamicBackfill.verification;
            monthlyConfirmationSource = `${market} official contiguous dynamic backfill`;
          } else {
            monthlyBoundaryAmbiguous = true;
            monthlyVerification = dynamicBackfill.verification || monthlyVerification;
          }
        } else if (!startConfirmed && candidateVerificationPending) {
          monthlyBoundaryAmbiguous = true;
        }
      }

      // V2.9.10：月線與日線資料源強制隔離。
      // - TWSE：官方 monthMap 內仍是逐日官方資料，可直接供日線 Fib / Tactical N。
      // - TPEx：GitHub Relay 每個 row 代表「一個月的官方月 OHLC」，絕對不能當成日K。
      //   因此 TPEx 日線分析固定改用 Yahoo 歷史日K骨架 + TWSE MIS 最新已完成交易日快照。
      //   Relay 只負責月20MA / startMonth / Base / 月RSI，不得進入任何日線演算法。
      let dailyAnalysisMeta = null;
      let recentDailyRows = [];

      if (market === "TPEx") {
        dailyAnalysisMeta = await timing.measure("tpex-daily-source-isolation", () =>
          buildTpexDailyAnalysisRows({
            stock,
            locatorRows: locator.rows,
            budget,
            debugMode
          })
        );
        recentDailyRows = dailyAnalysisMeta.rows;
      } else {
        // V2.9.13.3：
        // TWSE 月K快取暖機後，不能只用 recentKeys/monthMap 的逐日資料，
        // 因為跨月時官方月K aggregate 可能仍停在上個月，造成日線 close/MA20/RSI 退回舊交易日。
        // 正式日線以官方歷史為主體，Yahoo只補「官方最後日期之後」的尾端缺日，
        // 再用 MIS 最新已完成交易日快照收尾；Yahoo/MIS 絕不進月線計算。
        dailyAnalysisMeta = await timing.measure("twse-daily-latest-consistency", () =>
          buildTwseDailyAnalysisRowsV29133({
            stock,
            officialRows: collectDailyRowsFromMonthMap(recentKeys, monthMap),
            locatorRows: locator.rows,
            budget,
            debugMode
          })
        );
        recentDailyRows = dailyAnalysisMeta.rows;
      }

      if (!recentDailyRows.length) {
        if (debugMode) {
          debug.official = buildOfficialDebug(officialPhases, monthMap, market);
          debug.dailyAnalysis = {
            source: dailyAnalysisMeta?.source || `${market} Official daily history`,
            rowCount: 0,
            relayRowsUsedForDaily: 0,
            monthlyRelayOnly: market === "TPEx",
            detail: dailyAnalysisMeta?.debug || null
          };
        }
        return jsonResponse(
          {
            version: VERSION,
            error: market === "TPEx"
              ? "TPEx官方月線已取得，但Yahoo/MIS近期日K資料不足，為避免把月OHLC誤當日K，本次不執行日線Fib／戰術N字。"
              : "近期官方日K資料不足。",
            stock,
            market,
            ...(debugMode ? { debug: finalizeDebugBudget(debug, budget) } : {})
          },
          422,
          corsHeaders
        );
      }

      const analysisStarted = Date.now();
      const latestDailyRow = recentDailyRows[recentDailyRows.length - 1];
      const latestDailyClose = latestDailyRow.close;
      const dailyRsiSeries = calculateRSISeries(
        recentDailyRows.map(row => row.close),
        RSI_PERIOD
      );
      const dailyRsi5 = dailyRsiSeries.length
        ? dailyRsiSeries[dailyRsiSeries.length - 1]
        : null;

      const fibCore = scanLiteMode
        ? analyzeFibonacciNPatternScanLiteV29130(recentDailyRows, latestDailyClose)
        : analyzeFibonacciNPattern(recentDailyRows, latestDailyClose);
      const tacticalN = scanLiteMode ? null : analyzeTacticalN(recentDailyRows);
      const fib = scanLiteMode
        ? fibCore
        : attachTacticalBreakoutsToFib(fibCore, tacticalN);
      const volume = scanLiteMode
        ? analyzeVolumeContextScanLiteV29130(recentDailyRows, fib)
        : analyzeVolumeContext(recentDailyRows, fib);
      const structure = scanLiteMode
        ? analyzeStructureQualityScanLiteV29130(recentDailyRows, fib, volume)
        : analyzeStructureQuality(recentDailyRows, fib, volume);
      const monthlyActive = currentPass && startConfirmed;
      const tactical = scanLiteMode
        ? null
        : analyzeTacticalSignals(
            recentDailyRows,
            fib,
            tacticalN,
            volume,
            structure,
            monthlyActive,
            latestDailyClose,
            dailyRsi5
          );
      const decisionLayer = scanCoreMode ? null : buildPostCloseDecisionLayerV29140({
        rows: recentDailyRows,
        fib,
        volume,
        structure,
        tactical,
        monthlyActive,
        monthlyAvailable: true,
        dailyRsi5,
        includeResearchAudit: !scanLiteMode
      });
      timing.add("analysis-core", Date.now() - analysisStarted);

      const baseValue = startMonth
        ? (startMonth.high + startMonth.low) / 2
        : null;
      const multiple = baseValue && baseValue > 0
        ? latestDailyClose / baseValue
        : null;

      const allSuccessfulKeys = uniqueSortedMonthKeys(
        [...monthMap.entries()]
          .filter(([, value]) => hasMonthRows(value))
          .map(([key]) => key)
      );

      await persistOfficialAggregateCache({
        request, env, ctx, stock, market, monthMap, bypassCache, cacheState
      });

      if (debugMode) {
        debug.market = market;
        debug.name = stockName || null;
        debug.source = `${market} Official`;
        debug.dailyAnalysis = {
          source: dailyAnalysisMeta?.source || `${market} Official daily history`,
          rowCount: recentDailyRows.length,
          firstDate: recentDailyRows[0]?.date || null,
          lastDate: recentDailyRows[recentDailyRows.length - 1]?.date || null,
          frontendDailySeriesBars: Math.min(
            DAILY_SERIES_RETURN_BARS,
            recentDailyRows.filter(
              row =>
                isValidDailyRow(row) &&
                Number.isFinite(row.volume) &&
                row.volume >= 0
            ).length
          ),
          relayRowsUsedForDaily: 0,
          monthlyRelayOnly: market === "TPEx",
          detail: dailyAnalysisMeta?.debug || null
        };
        if (dailyAnalysisMeta?.latestDailyHotfix) {
          debug.latestDailyHotfix = dailyAnalysisMeta.latestDailyHotfix;
        }
        debug.currentMonthly = summarizeMonthlyBar(latestMonth);
        debug.monthlyPass = currentPass;
        debug.monthlyActive = monthlyActive;
        debug.monthlyVerification = serializeVerification(monthlyVerification);
        debug.previousBreakCandidate = locatorState.previousBreakCandidate || null;
        debug.previousBreakMonth = previousBreakMonth?.key || null;
        debug.latestBelowMonth = latestBelowMonth?.key || null;
        debug.startMonth = startMonth?.key || null;
        debug.startMonthConfirmed = startConfirmed;
        debug.monthlyBoundaryAmbiguous = monthlyBoundaryAmbiguous;
        debug.dynamicBackfill = dynamicBackfill?.debug || null;
        debug.recentOfficialMonths = recentBars.map(summarizeMonthlyBar);

        debug.monthlyRegimeTimeline = buildMonthlyRegimeTimelineDebug(
          monthMap,
          latestMonth.key
        );

        debug.official = buildOfficialDebug(officialPhases, monthMap, market);
        debug.officialCache = {
          ...cacheState,
          savedMonths: countCacheableMonths(monthMap)
        };
        debug.fetchContext = {
          twsePreferredHost: fetchContext.twsePreferredHost,
          tpexLearnedHistoryBase: fetchContext.tpexLearnedHistoryBase,
          tpexPreferredHistoryMode: fetchContext.tpexPreferredHistoryMode,
          tpexOpenApiBlocked: fetchContext.tpexOpenApiBlocked,
          tpexModernCsvUnavailable: fetchContext.tpexModernCsvUnavailable,
          tpexLegacyJsonUnavailable: fetchContext.tpexLegacyJsonUnavailable,
          tpexLegacyCsvUnavailable: fetchContext.tpexLegacyCsvUnavailable,
          tpexHtmlUnavailable: fetchContext.tpexHtmlUnavailable,
          marketProbeMonth: fetchContext.marketProbeMonth?.key || null
        };
        finalizeDebugBudget(debug, budget);
      }

      const dailySeriesSource =
        dailyAnalysisMeta?.source || `${market} Official daily history`;
      const dailySeries = serializeDailySeriesForFrontend(
        recentDailyRows,
        scanLiteMode ? SCAN_LITE_DAILY_SERIES_BARS : DAILY_SERIES_RETURN_BARS
      );
      const dailySeriesMeta = buildDailySeriesMeta(
        recentDailyRows,
        dailySeries,
        dailySeriesSource
      );

      const replayResearch = replayResearchMode
        ? buildHistoricalReplayDatasetV39B7(recentDailyRows, monthMap, { limit: replayResearchLimit, step: replayResearchStep })
        : null;

      const payload = {
        version: VERSION,
        stock,
        name: stockName || `股票 ${stock}`,
        market,

        close: round(latestDailyClose, 2),
        closeDate: latestDailyRow.date,
        dailyRsi5: round(dailyRsi5, 2),

        // V2.9.12：最近最多420個已完成交易日的完整OHLCV。
        // V3.6.1+ 前端會自動讀取 dailySeries 啟用三叉戟。
        dailySeries,
        dailySeriesMeta,
        replayResearch,

        fib,
        tacticalN,
        volume,
        structure,
        tactical,
        decisionLayer,
        tradeability: decisionLayer?.tradeability ?? null,
        trendPersistence: decisionLayer?.trendPersistence ?? null,
        maDeduction: decisionLayer?.maDeduction ?? null,
        volumePriceHealth: decisionLayer?.volumePriceHealth ?? null,
        reboundQuality: decisionLayer?.reboundQuality ?? null,
        pressureMap: decisionLayer?.pressureMap ?? null,
        remainingOpportunity: decisionLayer?.remainingOpportunity ?? null,
        entryQualityVNext: decisionLayer?.entryQuality ?? null,
        chaseRisk: decisionLayer?.chaseRisk ?? null,
        exitRisk: decisionLayer?.exitRisk ?? null,
        actionGate: decisionLayer?.actionGate ?? null,

        scanMode: scanLiteMode ? "SCAN_LITE" : "FULL",
        scanLite: !!scanLiteMode,
        scanLiteProfile: scanLiteMode ? {
          version: "V40",
          profile: scanCoreMode ? "CORE" : "FULL",
          dailySeriesBars: dailySeries.length,
          monthlyFetchLimit: SCAN_LITE_MONTHLY_FETCH_LIMIT,
          candidateVerification: "cache-only",
          dynamicBackfill: "cache-only",
          locatorHistoryMonths: SCAN_LITE_LOCATOR_HISTORY_MONTHS,
          skippedModules: ["analyzeTacticalN","attachTacticalBreakoutsToFib","analyzeTacticalSignals","recentOfficialRecovery","networkCandidateBackfill", ...(scanCoreMode ? ["decisionLayerV1"] : [])],
          preservedModules: ["officialMonthlyWhenCacheReady","dailyRsi5","fibV2.4","volume","structure", ...(scanCoreMode ? [] : ["decisionLayerV1"]), "dailySeries"]
        } : null,

        entry: monthlyActive,
        stage: monthlyActive ? "建倉區" : "觀察區",
        monthlyPass: currentPass,

        startMonth: startMonth ? startMonth.key : null,
        qualifyingMonth: startMonth ? startMonth.key : null,
        startMonthConfirmed: startConfirmed,
        monthlyBoundaryAmbiguous,
        monthlyStartConfirmationSource: monthlyConfirmationSource,

        ma20: startMonth ? round(startMonth.ma20, 2) : null,
        startMonthMA20: startMonth ? round(startMonth.ma20, 2) : null,
        monthlyClose: startMonth ? round(startMonth.close, 2) : null,
        startMonthClose: startMonth ? round(startMonth.close, 2) : null,
        monthlyHigh: startMonth ? round(startMonth.high, 2) : null,
        startMonthHigh: startMonth ? round(startMonth.high, 2) : null,
        monthlyLow: startMonth ? round(startMonth.low, 2) : null,
        startMonthLow: startMonth ? round(startMonth.low, 2) : null,
        startMonthRsi5: startMonth ? round(startMonth.rsi5, 2) : null,

        baseValue: round(baseValue, 2),
        multiple: round(multiple, 2),

        latestMonth: latestMonth.key,
        latestMonthClose: round(latestMonth.close, 2),
        latestMonthMA20: round(latestMonth.ma20, 2),
        latestMonthRsi5: round(latestMonth.rsi5, 2),
        rsi: round(latestMonth.rsi5, 2),

        previousBreakMonth: previousBreakMonth ? previousBreakMonth.key : null,
        previousBreakClose: previousBreakMonth ? round(previousBreakMonth.close, 2) : null,
        previousBreakMA20: previousBreakMonth ? round(previousBreakMonth.ma20, 2) : null,

        latestBelowMonth: latestBelowMonth ? latestBelowMonth.key : null,
        latestBelowClose: latestBelowMonth ? round(latestBelowMonth.close, 2) : null,
        latestBelowMA20: latestBelowMonth ? round(latestBelowMonth.ma20, 2) : null,

        previousSegmentStart: previousSegmentStart ? previousSegmentStart.key : null,

        logic:
          market === "TPEx"
            ? "TPEx Relay只供官方月OHLC；日線Fib／RSI／MA20／量能使用Yahoo歷史日K骨架＋TWSE MIS最新已完成交易日。"
            : "V40：上市月線只用官方月K；日線以官方逐日行情為主，外部行情只補官方資料尾端缺日，再由上市市場最新完成交易日快照收尾，避免跨月或快取暖機讓日線退回舊交易日。",
        mainHistoryMonths: MAIN_HISTORY_MONTHS,
        rsiWarmupMonths: recentBars.length,
        monthlyHistoryMonthsAvailable: allSuccessfulKeys.length,
        source: `${market} Official`,
        dailySource:
          dailyAnalysisMeta?.source || `${market} Official daily history`,
        locatorSource: "Yahoo Finance (candidate only)",
        officialCache: {
          backend: cacheState.backend,
          loadedMonths: cacheState.loadedMonths,
          savedMonths: countCacheableMonths(monthMap),
          bypassed: !!bypassCache
        },
        networkFetchBudget: {
          max: budget.max,
          used: budget.used,
          remaining: budget.remaining()
        },

        ...(debugMode ? { debug } : {})
      };

      if (scanLiteMode) {
        const litePayload = scanCoreMode
          ? projectScanCorePayloadV39B12(payload, "cold-scan-core")
          : projectScanLitePayloadV29130(payload, "cold-scan-lite");
        if (!scanCoreMode && !debugMode && !bypassCache) {
          persistScanLiteResultCacheV29130({ request, env, ctx, stock, payload: litePayload });
        }
        return jsonResponse(
          litePayload,
          200,
          {
            ...corsHeaders,
            "X-Shitou-Scan-Mode": "SCAN_LITE",
            "X-Shitou-Scan-Lite-Cache": "MISS",
            "X-Shitou-Scan-Lite-Contract": "V40-SANITIZED",
              "X-Shitou-Scan-Profile": scanCoreMode ? "CORE" : "FULL"
          }
        );
      }

      if (!debugMode && !bypassCache && !replayResearchMode) {
        persistAnalysisResultCache({
          request,
          env,
          ctx,
          stock,
          payload
        });
        // 完整個股分析完成時順手暖機 SCAN_LITE，之後盤後掃描直接吃輕量快取。
        persistScanLiteResultCacheV29130({
          request,
          env,
          ctx,
          stock,
          payload: projectScanLitePayloadV29130(payload, "full-analysis-warm")
        });
      }

      return jsonResponse(
        payload,
        200,
        {
          ...corsHeaders,
          "X-Shitou-Result-Cache": "MISS",
          ...(replayResearchMode ? { "X-Shitou-Replay-Research": "1" } : {})
        }
      );
    } catch (error) {
      debug.fatal = { message: error?.message || String(error) };
      finalizeDebugBudget(debug, budget);

      return jsonResponse(
        {
          version: VERSION,
          error: "伺服器處理失敗",
          message: error?.message || String(error),
          ...(debugMode ? { debug } : {})
        },
        500,
        corsHeaders
      );
    }
  }
};

// ============================================================
// V2.9.7 效能快取／TPEx快速路由／耗時計時
// ============================================================
function createTimingTracker() {
  const startedAt = Date.now();
  const stages = {};
  return {
    add(label, ms) {
      const value = Math.max(0, Number(ms) || 0);
      stages[label] = (stages[label] || 0) + value;
    },
    async measure(label, task) {
      const started = Date.now();
      try {
        return await task();
      } finally {
        this.add(label, Date.now() - started);
      }
    },
    snapshot() {
      return {
        totalMs: Date.now() - startedAt,
        stagesMs: Object.fromEntries(
          Object.entries(stages).map(([key, value]) => [key, Math.round(value)])
        )
      };
    }
  };
}

function buildInternalCacheRequest(request, pathname, params = {}) {
  const base = new URL(request.url);
  base.pathname = pathname;
  base.search = "";
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      base.searchParams.set(key, String(value));
    }
  }
  return new Request(base.toString(), { method: "GET" });
}

function cacheBackendName(env) {
  return env?.STOCK_CACHE ? "KV:STOCK_CACHE" : "caches.default";
}

async function readJsonCache({ request, env, kvKey, cacheRequest, expectedSchema }) {
  let payload = null;
  if (env?.STOCK_CACHE?.get) {
    const text = await env.STOCK_CACHE.get(kvKey);
    if (text) payload = JSON.parse(text);
  } else {
    const response = await caches.default.match(cacheRequest);
    if (response) payload = await response.json();
  }
  if (!payload || payload.schema !== expectedSchema) return null;
  return payload;
}

function writeJsonCache({ request, env, ctx, kvKey, cacheRequest, payload, ttlSeconds }) {
  const write = async () => {
    if (env?.STOCK_CACHE?.put) {
      await env.STOCK_CACHE.put(kvKey, JSON.stringify(payload), {
        expirationTtl: Math.max(60, Math.floor(ttlSeconds))
      });
      return;
    }
    const response = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${Math.max(1, Math.floor(ttlSeconds))}`
      }
    });
    await caches.default.put(cacheRequest, response);
  };
  try {
    if (ctx?.waitUntil) ctx.waitUntil(write());
    else return write();
  } catch {
    // 效能快取失敗不得影響正式分析。
  }
}

function getSafeCacheTtlSeconds(baseTtlSeconds) {
  const now = getTaipeiDateTimeParts();
  const cutoffMinutes =
    TAIWAN_COMPLETED_BAR_HOUR * 60 + TAIWAN_COMPLETED_BAR_MINUTE;
  const currentMinutes = now.hour * 60 + now.minute;
  const base = Math.max(0, Math.floor(baseTtlSeconds));

  // 盤中快取不能跨越14:30，避免13:xx的「前一交易日」結果延續到收盤資料已完成之後。
  if (currentMinutes < cutoffMinutes) {
    const secondsUntilCutoff = (cutoffMinutes - currentMinutes) * 60;
    if (secondsUntilCutoff <= 20) return 0;
    return Math.max(1, Math.min(base, secondsUntilCutoff - 15));
  }
  return base;
}

async function loadAnalysisResultCache({ request, env, stock }) {
  const backend = cacheBackendName(env);
  const kvKey = `${RESULT_CACHE_SCHEMA}:${VERSION}:${stock}`;
  const cacheRequest = buildInternalCacheRequest(
    request,
    RESULT_CACHE_KEY_PATH,
    { schema: RESULT_CACHE_SCHEMA, version: VERSION, stock }
  );
  try {
    const wrapped = await readJsonCache({
      request, env, kvKey, cacheRequest, expectedSchema: RESULT_CACHE_SCHEMA
    });
    if (!wrapped || wrapped.version !== VERSION || !wrapped.payload) {
      return { backend, hit: false, payload: null, ageMs: null, error: null };
    }
    const expiresAt = Number(wrapped.expiresAt || 0);
    if (!expiresAt || Date.now() >= expiresAt) {
      return { backend, hit: false, payload: null, ageMs: null, error: null };
    }
    return {
      backend,
      hit: true,
      payload: wrapped.payload,
      ageMs: Math.max(0, Date.now() - Number(wrapped.savedAt || Date.now())),
      error: null
    };
  } catch (error) {
    return {
      backend,
      hit: false,
      payload: null,
      ageMs: null,
      error: error?.message || String(error)
    };
  }
}

function persistAnalysisResultCache({ request, env, ctx, stock, payload }) {
  const ttlSeconds = getSafeCacheTtlSeconds(RESULT_CACHE_TTL_SECONDS);
  if (ttlSeconds <= 0) return;
  const savedAt = Date.now();
  const kvKey = `${RESULT_CACHE_SCHEMA}:${VERSION}:${stock}`;
  const cacheRequest = buildInternalCacheRequest(
    request,
    RESULT_CACHE_KEY_PATH,
    { schema: RESULT_CACHE_SCHEMA, version: VERSION, stock }
  );
  writeJsonCache({
    request,
    env,
    ctx,
    kvKey,
    cacheRequest,
    ttlSeconds,
    payload: {
      schema: RESULT_CACHE_SCHEMA,
      version: VERSION,
      savedAt,
      expiresAt: savedAt + ttlSeconds * 1000,
      payload
    }
  });
}


async function loadScanLiteResultCacheV29130({ request, env, stock }) {
  const backend = cacheBackendName(env);
  const kvKey = `${SCAN_LITE_CACHE_SCHEMA}:${VERSION}:${stock}`;
  const cacheRequest = buildInternalCacheRequest(
    request,
    SCAN_LITE_CACHE_KEY_PATH,
    { schema: SCAN_LITE_CACHE_SCHEMA, version: VERSION, stock }
  );
  try {
    const wrapped = await readJsonCache({
      request, env, kvKey, cacheRequest, expectedSchema: SCAN_LITE_CACHE_SCHEMA
    });
    if (!wrapped || wrapped.version !== VERSION || !wrapped.payload) {
      return { backend, hit:false, payload:null, ageMs:null, error:null };
    }
    const expiresAt = Number(wrapped.expiresAt || 0);
    if (!expiresAt || Date.now() >= expiresAt) {
      return { backend, hit:false, payload:null, ageMs:null, error:null };
    }
    return {
      backend,
      hit:true,
      payload:wrapped.payload,
      ageMs:Math.max(0, Date.now() - Number(wrapped.savedAt || Date.now())),
      error:null
    };
  } catch (error) {
    return { backend, hit:false, payload:null, ageMs:null, error:error?.message || String(error) };
  }
}

function persistScanLiteResultCacheV29130({ request, env, ctx, stock, payload }) {
  const ttlSeconds = getSafeCacheTtlSeconds(SCAN_LITE_CACHE_TTL_SECONDS);
  if (ttlSeconds <= 0 || !payload) return;
  const savedAt = Date.now();
  const kvKey = `${SCAN_LITE_CACHE_SCHEMA}:${VERSION}:${stock}`;
  const cacheRequest = buildInternalCacheRequest(
    request,
    SCAN_LITE_CACHE_KEY_PATH,
    { schema: SCAN_LITE_CACHE_SCHEMA, version: VERSION, stock }
  );
  writeJsonCache({
    request,
    env,
    ctx,
    kvKey,
    cacheRequest,
    ttlSeconds,
    payload:{
      schema:SCAN_LITE_CACHE_SCHEMA,
      version:VERSION,
      savedAt,
      expiresAt:savedAt + ttlSeconds * 1000,
      payload
    }
  });
}

function sanitizeScanLiteTradeabilityV39B11(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value ?? null;
  return {
    ...value,
    factorContributionAudit: null,
    ablationShadowLab: null
  };
}

function sanitizeScanLiteDecisionLayerV39B11(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value ?? null;
  return {
    ...value,
    tradeability: sanitizeScanLiteTradeabilityV39B11(value.tradeability)
  };
}

function projectScanLitePayloadV29130(payload, sourceTag = "projection") {
  const p = payload && typeof payload === "object" ? payload : {};
  const ds = Array.isArray(p.dailySeries)
    ? p.dailySeries.slice(-SCAN_LITE_DAILY_SERIES_BARS)
    : [];

  const meta = p.dailySeriesMeta && typeof p.dailySeriesMeta === "object"
    ? {
        ...p.dailySeriesMeta,
        returnedBars: ds.length,
        firstDate: ds[0]?.date || null,
        lastDate: ds[ds.length - 1]?.date || null,
        scanLite: true,
        scanLiteBars: SCAN_LITE_DAILY_SERIES_BARS
      }
    : {
        returnedBars: ds.length,
        firstDate: ds[0]?.date || null,
        lastDate: ds[ds.length - 1]?.date || null,
        scanLite: true,
        scanLiteBars: SCAN_LITE_DAILY_SERIES_BARS
      };

  const keys = [
    "stock","name","market","close","closeDate","dailyRsi5",
    "entry","stage","monthlyPass","monthlyStatus",
    "startMonth","qualifyingMonth","startMonthConfirmed","monthlyBoundaryAmbiguous","monthlyStartConfirmationSource",
    "ma20","startMonthMA20","monthlyClose","startMonthClose","monthlyHigh","startMonthHigh",
    "monthlyLow","startMonthLow","startMonthRsi5","baseValue","multiple",
    "latestMonth","latestMonthClose","latestMonthMA20","latestMonthRsi5","rsi",
    "previousBreakMonth","previousBreakClose","previousBreakMA20",
    "latestBelowMonth","latestBelowClose","latestBelowMA20","previousSegmentStart",
    "officialMonthlyUnavailable","officialMonthlyUnavailableReason","missingOfficialMonths","retrySuggested",
    "source","dailySource","locatorSource","officialCache","networkFetchBudget",
    "mainHistoryMonths","rsiWarmupMonths","monthlyHistoryMonthsAvailable","scanLiteProfile",
    "decisionLayer","tradeability","trendPersistence","maDeduction","volumePriceHealth",
    "reboundQuality","pressureMap","remainingOpportunity","entryQualityVNext","chaseRisk","exitRisk","actionGate"
  ];

  const out = {
    version: VERSION,
    scanMode: "SCAN_LITE",
    scanLite: true,
    scanLiteVersion: "V40",
    scanLiteSource: sourceTag,
    dailySeries: ds,
    dailySeriesMeta: meta,
    fib: p.fib || null,
    volume: p.volume || null,
    structure: p.structure || null,
    // 刻意不攜帶 tacticalN / tactical：DeepScan 排名所需證據由 Fib + volume + structure + dailySeries 提供。
    tacticalN: null,
    tactical: null
  };

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(p, key)) out[key] = p[key];
  }

  // B11 RC2：SCAN_LITE 契約是「正式分數保留、B5/B6 research audit 一律不攜帶」。
  // 不能只依賴 fresh build 的 includeResearchAudit=false，因為 FULL result cache projection 仍可能含完整 research audit。
  if (Object.prototype.hasOwnProperty.call(out, "tradeability")) {
    out.tradeability = sanitizeScanLiteTradeabilityV39B11(out.tradeability);
  }
  if (Object.prototype.hasOwnProperty.call(out, "decisionLayer")) {
    out.decisionLayer = sanitizeScanLiteDecisionLayerV39B11(out.decisionLayer);
  }
  out.scanLiteContract = {
    id: "SCAN_LITE_CONTRACT_V40",
    researchAudit: "STRIPPED",
    factorContributionAudit: null,
    ablationShadowLab: null
  };

  // 前端新舊版本相容：dailyRsi / dailyRsi5 都提供。
  if (out.dailyRsi5 !== undefined && out.dailyRsi5 !== null) {
    out.dailyRsi = out.dailyRsi5;
  }

  return out;
}

function projectScanCorePayloadV39B12(payload, sourceTag = "scan-core") {
  const out = projectScanLitePayloadV29130(payload, sourceTag);
  // bulk ranking 不需要三週期 Decision Layer。正式 Fib / volume / structure / dailySeries 完整保留。
  out.decisionLayer = null;
  out.tradeability = null;
  out.trendPersistence = null;
  out.maDeduction = null;
  out.volumePriceHealth = null;
  out.reboundQuality = null;
  out.pressureMap = null;
  out.remainingOpportunity = null;
  out.entryQualityVNext = null;
  out.chaseRisk = null;
  out.exitRisk = null;
  out.actionGate = null;
  out.scanLiteVersion = "V40";
  out.scanLiteProfile = { ...(out.scanLiteProfile || {}), version:"V40", profile:"CORE", decisionLayer:"DEFERRED" };
  out.scanCoreContract = {
    id: "SCAN_CORE_CONTRACT_V40",
    purpose: "BULK_RANKING_ONLY",
    decisionLayer: "DEFERRED_TO_FINAL_CANDIDATES",
    formalRankingInputs: "PRESERVED",
    researchAudit: "STRIPPED"
  };
  return out;
}

async function loadMarketRouteCache({ request, env, stock }) {
  const backend = cacheBackendName(env);
  const kvKey = `${MARKET_ROUTE_CACHE_SCHEMA}:${stock}`;
  const cacheRequest = buildInternalCacheRequest(request, MARKET_ROUTE_CACHE_KEY_PATH, { schema: MARKET_ROUTE_CACHE_SCHEMA, stock });
  try {
    const wrapped = await readJsonCache({ request, env, kvKey, cacheRequest, expectedSchema: MARKET_ROUTE_CACHE_SCHEMA });
    if (!wrapped || !["TWSE", "TPEx"].includes(wrapped.market)) return { backend, hit:false, market:null, name:null, quality:null, ageMs:null, error:null };
    const quality = wrapped.quality === "candidate" ? "candidate" : "official";
    const ttlSeconds = quality === "candidate" ? TPEX_CANDIDATE_ROUTE_CACHE_TTL_SECONDS : MARKET_ROUTE_CACHE_TTL_SECONDS;
    const savedAt = Number(wrapped.savedAt || 0);
    const ageMs = savedAt ? Date.now() - savedAt : Number.POSITIVE_INFINITY;
    if (!savedAt || ageMs > ttlSeconds * 1000) return { backend, hit:false, market:null, name:null, quality:null, ageMs, error:null };
    if (quality === "candidate" && wrapped.market !== "TPEx") return { backend, hit:false, market:null, name:null, quality:null, ageMs, error:"invalid-candidate-route" };
    return { backend, hit:true, market:wrapped.market, name:wrapped.name || null, quality, officialMarketConfirmed:quality === "official", ageMs, error:null };
  } catch (error) {
    return { backend, hit:false, market:null, name:null, quality:null, ageMs:null, error:error?.message || String(error) };
  }
}

function persistMarketRouteCache({ request, env, ctx, stock, market, name, quality = "official" }) {
  if (!["TWSE", "TPEx"].includes(market)) return;
  if (quality === "candidate" && market !== "TPEx") return;
  const normalizedQuality = quality === "candidate" ? "candidate" : "official";
  const ttlSeconds = normalizedQuality === "candidate" ? TPEX_CANDIDATE_ROUTE_CACHE_TTL_SECONDS : MARKET_ROUTE_CACHE_TTL_SECONDS;
  const kvKey = `${MARKET_ROUTE_CACHE_SCHEMA}:${stock}`;
  const cacheRequest = buildInternalCacheRequest(request, MARKET_ROUTE_CACHE_KEY_PATH, { schema: MARKET_ROUTE_CACHE_SCHEMA, stock });
  writeJsonCache({ request, env, ctx, kvKey, cacheRequest, ttlSeconds, payload: { schema: MARKET_ROUTE_CACHE_SCHEMA, savedAt:Date.now(), market, name:name || null, quality:normalizedQuality, officialMarketConfirmed:normalizedQuality === "official" } });
}

async function loadLocatorCache({ request, env, symbol }) {
  const backend = cacheBackendName(env);
  const kvKey = `${LOCATOR_CACHE_SCHEMA}:${symbol}`;
  const cacheRequest = buildInternalCacheRequest(
    request,
    LOCATOR_CACHE_KEY_PATH,
    { schema: LOCATOR_CACHE_SCHEMA, symbol }
  );
  try {
    const wrapped = await readJsonCache({
      request, env, kvKey, cacheRequest, expectedSchema: LOCATOR_CACHE_SCHEMA
    });
    if (!wrapped || !wrapped.payload || !Array.isArray(wrapped.payload.rows)) {
      return { backend, hit: false, payload: null, ageMs: null, error: null };
    }
    const expiresAt = Number(wrapped.expiresAt || 0);
    if (!expiresAt || Date.now() >= expiresAt) {
      return { backend, hit: false, payload: null, ageMs: null, error: null };
    }
    return {
      backend,
      hit: true,
      payload: wrapped.payload,
      ageMs: Math.max(0, Date.now() - Number(wrapped.savedAt || Date.now())),
      error: null
    };
  } catch (error) {
    return {
      backend,
      hit: false,
      payload: null,
      ageMs: null,
      error: error?.message || String(error)
    };
  }
}

function persistLocatorCache({ request, env, ctx, symbol, payload }) {
  const ttlSeconds = getSafeCacheTtlSeconds(LOCATOR_CACHE_TTL_SECONDS);
  if (ttlSeconds <= 0 || !payload?.rows?.length) return;
  const savedAt = Date.now();
  const kvKey = `${LOCATOR_CACHE_SCHEMA}:${symbol}`;
  const cacheRequest = buildInternalCacheRequest(
    request,
    LOCATOR_CACHE_KEY_PATH,
    { schema: LOCATOR_CACHE_SCHEMA, symbol }
  );
  writeJsonCache({
    request,
    env,
    ctx,
    kvKey,
    cacheRequest,
    ttlSeconds,
    payload: {
      schema: LOCATOR_CACHE_SCHEMA,
      savedAt,
      expiresAt: savedAt + ttlSeconds * 1000,
      payload
    }
  });
}

function getCurrentTaipeiMonthKey() {
  return getRecentMonthKeys(1)[0];
}

function countCacheableMonths(monthMap) {
  return [...monthMap.values()].filter(value => hasMonthRows(value)).length;
}

function buildAggregateCacheRequest(request, stock, market) {
  const base = new URL(request.url);
  base.pathname = CACHE_KEY_PATH;
  base.search = "";
  base.searchParams.set("schema", OFFICIAL_CACHE_SCHEMA);
  base.searchParams.set("market", market);
  base.searchParams.set("stock", stock);
  return new Request(base.toString(), { method: "GET" });
}

function getTaipeiDateTimePartsAt(dateValue) {
  const parts = (taipeiDateFormatterV29141 ||= new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  })).formatToParts(dateValue instanceof Date ? dateValue : new Date(dateValue));
  const get = type => parts.find(part => part.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function officialMonthKvV29132(env) {
  // V2.9.13.2：STOCK_MONTH_KV 只供「官方月K aggregate」。
  // 若使用者既有 STOCK_CACHE，也保持相容；其他高頻結果快取仍沿用原 cacheBackendName 邏輯。
  return env?.STOCK_MONTH_KV?.get
    ? { binding: env.STOCK_MONTH_KV, name: "KV:STOCK_MONTH_KV" }
    : env?.STOCK_CACHE?.get
      ? { binding: env.STOCK_CACHE, name: "KV:STOCK_CACHE" }
      : null;
}

function latestDateInOfficialMonthEntryV29132(entry) {
  if (!entry || !Array.isArray(entry.rows)) return null;
  let latest = null;
  for (const row of entry.rows) {
    const date = String(row?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function isCachedMonthUsable(
  monthKey,
  entry,
  { scanLiteMode = false, monthlyAnchorDate = null } = {}
) {
  if (!entry || !Array.isArray(entry.rows) || !entry.rows.length) return false;

  const anchorMonthKey = monthKeyFromIsoDateV29131(monthlyAnchorDate);
  const currentKey = getCurrentTaipeiMonthKey();

  // V2.9.13.2：SCAN_LITE 最重要的跨月/當月降載。
  // 若這個月份就是「最新完成交易日」所在月，且快取最後一筆官方日資料
  // 已經到達該完成交易日，直接視為新鮮；不因20分鐘 age 重抓。
  if (scanLiteMode && anchorMonthKey && monthKey === anchorMonthKey) {
    const cachedLastDate = latestDateInOfficialMonthEntryV29132(entry);
    if (cachedLastDate && cachedLastDate >= monthlyAnchorDate) return true;
    // 若 provider 資料沒有可比較的逐日日期（特殊 mirror/relay），
    // 再退回既有 current-month age 規則，不能假裝資料已更新。
  }

  if (monthKey !== currentKey) return true;

  const fetchedAt = Number(entry.fetchedAt || 0);
  if (!fetchedAt) return false;
  return Date.now() - fetchedAt <= CURRENT_MONTH_CACHE_MAX_AGE_MS;
}

async function loadOfficialAggregateCache({
  request,
  env,
  stock,
  market,
  monthMap,
  bypassCache = false,
  debugMode = false,
  scanLiteMode = false,
  monthlyAnchorDate = null
}) {
  const monthKv = officialMonthKvV29132(env);
  const state = {
    backend: monthKv?.name || "caches.default",
    sourceBackend: null,
    hit: false,
    loadedMonths: 0,
    loadedMonthKeys: [],
    skippedCurrentStale: false,
    bypassed: !!bypassCache,
    needsMigrationToMonthlyKv: false,
    error: null
  };

  if (bypassCache) return state;

  try {
    let payload = null;
    const key = `${OFFICIAL_CACHE_SCHEMA}:${market}:${stock}`;

    // 先讀持久 KV；KV 尚未暖機時再回讀舊 caches.default，
    // 讓部署新 binding 後不用把既有暖機成果全部丟掉。
    if (monthKv?.binding?.get) {
      const storedText = await monthKv.binding.get(key);
      if (storedText) {
        payload = JSON.parse(storedText);
        state.sourceBackend = monthKv.name;
      }
    }

    if (!payload) {
      const cache = caches.default;
      const response = await cache.match(buildAggregateCacheRequest(request, stock, market));
      if (response) {
        payload = await response.json();
        state.sourceBackend = "caches.default";
        state.needsMigrationToMonthlyKv = !!monthKv;
      }
    }

    if (!payload || payload.schema !== OFFICIAL_CACHE_SCHEMA || !payload.months) {
      return state;
    }

    for (const [monthKey, entry] of Object.entries(payload.months)) {
      if (!isCachedMonthUsable(monthKey, entry, {
        scanLiteMode,
        monthlyAnchorDate
      })) {
        if (
          monthKey === getCurrentTaipeiMonthKey() ||
          monthKey === monthKeyFromIsoDateV29131(monthlyAnchorDate)
        ) {
          state.skippedCurrentStale = true;
        }
        continue;
      }

      monthMap.set(monthKey, {
        rows: entry.rows,
        name: entry.name || null,
        kind: "ok",
        provider: entry.provider || market,
        fetchedAt: Number(entry.fetchedAt || 0),
        cacheHit: true,
        cacheBackend: state.sourceBackend || state.backend
      });
      state.loadedMonths += 1;
      state.loadedMonthKeys.push(monthKey);
    }

    state.hit = state.loadedMonths > 0;
    state.savedAt = payload.savedAt || null;
    return state;
  } catch (error) {
    state.error = debugMode ? (error?.message || String(error)) : "cache-read-failed";
    return state;
  }
}


async function persistOfficialAggregateCache({
  request,
  env,
  ctx,
  stock,
  market,
  monthMap,
  bypassCache = false,
  cacheState = null
}) {
  if (bypassCache) return;

  const entries = [...monthMap.entries()]
    .filter(([, value]) => hasMonthRows(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-OFFICIAL_CACHE_MAX_MONTHS);

  if (!entries.length) return;

  const months = {};
  for (const [monthKey, value] of entries) {
    months[monthKey] = {
      rows: value.rows,
      name: value.name || null,
      provider: value.provider || market,
      fetchedAt: Number(value.fetchedAt || Date.now())
    };
  }

  const payload = {
    schema: OFFICIAL_CACHE_SCHEMA,
    stock,
    market,
    savedAt: new Date().toISOString(),
    months
  };

  const monthKv = officialMonthKvV29132(env);

  // V2.9.13.2：若持久KV已命中，而且本次沒有任何新抓/更新月份，
  // 不再每次掃描都浪費一筆 Free KV write。
  const hasFreshNetworkMonth = entries.some(([, value]) => value?.cacheHit !== true);
  if (
    monthKv &&
    cacheState?.sourceBackend === monthKv.name &&
    cacheState?.needsMigrationToMonthlyKv !== true &&
    !hasFreshNetworkMonth
  ) {
    if (cacheState) cacheState.savedMonths = entries.length;
    return;
  }

  const write = async () => {
    const key = `${OFFICIAL_CACHE_SCHEMA}:${market}:${stock}`;
    if (monthKv?.binding?.put) {
      await monthKv.binding.put(key, JSON.stringify(payload), {
        expirationTtl: 30 * 24 * 60 * 60
      });
      return;
    }

    const cache = caches.default;
    const response = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${OFFICIAL_CACHE_TTL_SECONDS}`
      }
    });
    await cache.put(buildAggregateCacheRequest(request, stock, market), response);
  };

  try {
    if (ctx?.waitUntil) {
      ctx.waitUntil(write());
    } else {
      await write();
    }
    if (cacheState) cacheState.savedMonths = entries.length;
  } catch {
    // 快取失敗不能影響正式分析結果。
  }
}

function getContiguousSuccessfulMonthKeysEndingAt(monthMap, endKey, maxMonths = 72) {
  const keys = [];
  let cursor = endKey;

  for (let i = 0; i < maxMonths; i++) {
    const item = monthMap.get(cursor);
    if (!hasMonthRows(item)) break;
    keys.unshift(cursor);
    cursor = shiftMonthKey(cursor, -1);
  }

  return keys;
}

async function fetchTwseMisLatestCompletedDaily(stock, market, budget, withDebug = false) {
  const channelPrefix = market === "TPEx" ? "otc" : market === "TWSE" ? "tse" : null;
  const detail = {
    mode: "twse-mis-latest-completed-daily",
    market,
    stock,
    applied: false
  };

  if (!channelPrefix) {
    detail.reason = "unsupported-market";
    return { row: null, debug: withDebug ? detail : undefined };
  }

  const channel = `${channelPrefix}_${stock}.tw`;
  const apiUrl =
    "https://mis.twse.com.tw/stock/api/getStockInfo.jsp" +
    `?ex_ch=${encodeURIComponent(channel)}` +
    "&json=1&delay=0" +
    `&_=${Date.now()}`;

  detail.url = apiUrl;

  try {
    const response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `TWSE-MIS-latest:${channel}`,
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw",
              "application/json,text/plain,*/*"
            )
          }
        )
      : await fetchWithTimeout(apiUrl, {
          headers: browserLikeHeaders(
            "https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw",
            "application/json,text/plain,*/*"
          ),
          redirect: "manual"
        });

    const text = await response.text();
    detail.status = response.status;
    detail.preview = text.slice(0, 220);

    if (!response.ok || text.trim().startsWith("<")) {
      detail.reason = `http-${response.status}`;
      return { row: null, debug: withDebug ? detail : undefined };
    }

    const payload = JSON.parse(text);
    const rows = Array.isArray(payload?.msgArray) ? payload.msgArray : [];
    const item =
      rows.find(row => String(row?.c || "").trim() === String(stock)) || rows[0] || null;

    if (!item) {
      detail.reason = "no-msgArray-row";
      return { row: null, debug: withDebug ? detail : undefined };
    }

    const rawDate = String(item?.d || "").trim();
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : marketDateToISO(rawDate);

    const open = numberOrNull(item?.o);
    const high = numberOrNull(item?.h);
    const low = numberOrNull(item?.l);
    const close = numberOrNull(item?.z);
    const volumeLots = numberOrNull(item?.v);
    const volume = volumeLots === null ? null : volumeLots * 1000;

    detail.raw = {
      ex: item?.ex ?? null,
      c: item?.c ?? null,
      d: item?.d ?? null,
      t: item?.t ?? null,
      o: item?.o ?? null,
      h: item?.h ?? null,
      l: item?.l ?? null,
      z: item?.z ?? null,
      v: item?.v ?? null
    };

    if (!date || open === null || high === null || low === null || close === null) {
      detail.reason = "incomplete-ohlc";
      return { row: null, debug: withDebug ? detail : undefined };
    }

    // MIS 在休市日仍可能把當天日曆日期放入 d，並夾帶前一交易日
    // 的收盤價與不完整盤中欄位。週末絕不能併入正式日K。
    if (!isTaiwanTradingWeekdayIsoDate(date)) {
      detail.reason = "non-trading-calendar-date";
      return { row: null, debug: withDebug ? detail : undefined };
    }

    const now = getTaipeiDateTimeParts();
    const cutoffMinutes =
      TAIWAN_COMPLETED_BAR_HOUR * 60 + TAIWAN_COMPLETED_BAR_MINUTE;
    const currentMinutes = now.hour * 60 + now.minute;

    if (date > now.date) {
      detail.reason = "future-date";
      return { row: null, debug: withDebug ? detail : undefined };
    }

    if (date === now.date && currentMinutes < cutoffMinutes) {
      detail.reason = "today-not-completed-yet";
      return { row: null, debug: withDebug ? detail : undefined };
    }

    const row = { date, open, high, low, close, volume, volumeAdapter:'TWSE_MIS' };
    detail.applied = true;
    detail.reason = "latest-completed-snapshot-ready";
    detail.row = row;

    return { row, debug: withDebug ? detail : undefined };
  } catch (error) {
    detail.reason = "fetch-error";
    detail.error = error?.message || String(error);
    return { row: null, debug: withDebug ? detail : undefined };
  }
}

function mergeDailyRowsPreferSnapshot(rows, snapshotRow) {
  const byDate = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (isValidDailyRow(row)) byDate.set(row.date, row);
  }

  if (isValidDailyRow(snapshotRow)) {
    byDate.set(snapshotRow.date, snapshotRow);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}


async function buildTwseDailyAnalysisRowsV29133({
  stock,
  officialRows,
  locatorRows,
  budget,
  debugMode
}) {
  const officialCompleted = getCompletedDailyRows(officialRows);
  const officialLastRow = officialCompleted.length
    ? officialCompleted[officialCompleted.length - 1]
    : null;

  // Yahoo locator 已經為月線定位流程取得，不新增網路請求。
  // 只允許補「官方最後日期之後」的尾端，禁止覆蓋既有官方歷史。
  const locatorCompleted = getCompletedDailyRows(locatorRows);
  const locatorTail = locatorCompleted.filter(row =>
    !officialLastRow || row.date > officialLastRow.date
  );

  let bridged = [...officialCompleted, ...locatorTail]
    .filter(isValidDailyRow)
    .sort((a,b)=>a.date.localeCompare(b.date));

  // 去重；若同日同時存在，官方先存在，tail只會是更晚日期，因此正常不衝突。
  const byDate = new Map();
  for (const row of bridged) byDate.set(row.date, row);
  bridged = [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));

  const preMisLastRow = bridged.length ? bridged[bridged.length - 1] : null;

  // MIS 是「最新已完成交易日」保險絲。
  // 即使 Yahoo locator 在跨月邊界尚未更新，也能把最後一個交易日補回來。
  const misLatest = await fetchTwseMisLatestCompletedDaily(
    stock,
    "TWSE",
    budget,
    debugMode
  );

  const mergedRows = getCompletedDailyRows(
    mergeDailyRowsPreferSnapshot(bridged, misLatest.row)
  );
  const rows = mergedRows.slice(-Math.min(mergedRows.length, 420));
  const latestRow = rows.length ? rows[rows.length - 1] : null;

  const sourceParts = ["TWSE Official daily history"];
  if (locatorTail.length) sourceParts.push("Yahoo tail bridge");
  if (misLatest.row) sourceParts.push("TWSE MIS latest completed daily");

  return {
    rows,
    source: sourceParts.join(" + "),
    latestDailyHotfix: {
      mode: "V40-上市最新日線資料一致性",
      officialLastDate: officialLastRow?.date || null,
      officialLastClose: officialLastRow?.close ?? null,
      locatorTailRows: locatorTail.length,
      locatorTailFirstDate: locatorTail[0]?.date || null,
      locatorTailLastDate: locatorTail.length
        ? locatorTail[locatorTail.length - 1]?.date || null
        : null,
      preMisLastDate: preMisLastRow?.date || null,
      preMisLastClose: preMisLastRow?.close ?? null,
      misSnapshotDate: misLatest.row?.date || null,
      misSnapshotClose: misLatest.row?.close ?? null,
      finalLastDate: latestRow?.date || null,
      finalLastClose: latestRow?.close ?? null,
      applied: !!(
        (locatorTail.length > 0) ||
        (misLatest.row && (!officialLastRow || misLatest.row.date >= officialLastRow.date))
      ),
      detail: misLatest.debug || null
    },
    debug: debugMode ? {
      rule: "TWSE官方日K為主；Yahoo只補官方尾端缺日；MIS補最新已完成交易日。Yahoo/MIS不得進入月線。",
      officialCompletedRows: officialCompleted.length,
      officialLastDate: officialLastRow?.date || null,
      locatorCompletedRows: locatorCompleted.length,
      locatorTailRows: locatorTail.length,
      misSnapshotDate: misLatest.row?.date || null,
      finalRows: rows.length,
      finalLastDate: latestRow?.date || null
    } : null
  };
}

async function buildTpexDailyAnalysisRows({
  stock,
  locatorRows,
  budget,
  debugMode
}) {
  const yahooCompletedRows = getCompletedDailyRows(locatorRows);
  const yahooLastRow = yahooCompletedRows.length
    ? yahooCompletedRows[yahooCompletedRows.length - 1]
    : null;

  const misLatest = await fetchTwseMisLatestCompletedDaily(
    stock,
    "TPEx",
    budget,
    debugMode
  );

  const mergedRows = getCompletedDailyRows(
    mergeDailyRowsPreferSnapshot(yahooCompletedRows, misLatest.row)
  );
  const rows = mergedRows.slice(-Math.min(mergedRows.length, 420));
  const latestRow = rows.length ? rows[rows.length - 1] : null;

  return {
    rows,
    source: misLatest.row
      ? "Yahoo Finance history + TWSE MIS latest completed daily"
      : "Yahoo Finance history",
    latestDailyHotfix: {
      yahooLastDate: yahooLastRow?.date || null,
      yahooLastClose: yahooLastRow?.close ?? null,
      misSnapshotDate: misLatest.row?.date || null,
      misSnapshotClose: misLatest.row?.close ?? null,
      finalLastDate: latestRow?.date || null,
      finalLastClose: latestRow?.close ?? null,
      applied: !!(
        misLatest.row &&
        (!yahooLastRow || misLatest.row.date >= yahooLastRow.date)
      ),
      detail: misLatest.debug || null
    },
    debug: debugMode
      ? {
          rule: "TPEx Relay僅供月線；日線分析固定使用Yahoo日K＋MIS最新已完成交易日，Relay rows used for daily = 0。",
          yahooCompletedRows: yahooCompletedRows.length,
          mergedCompletedRows: mergedRows.length,
          analysisRows: rows.length,
          firstDate: rows[0]?.date || null,
          lastDate: latestRow?.date || null,
          relayRowsUsedForDaily: 0
        }
      : null
  };
}

async function buildDegradedMonthlyResponse({
  stock,
  market,
  stockName,
  locator,
  locatorState,
  missingRecent,
  monthlyIssueReason = null,
  budget,
  debugMode,
  debug,
  officialPhases,
  monthMap,
  corsHeaders,
  request, env, ctx, bypassCache = false, scanLiteMode = false, scanCoreMode = false
}) {
  const safeMarket = market === "TPEx" ? "TPEx" : "TWSE";
  const yahooCompletedRows = getCompletedDailyRows(locator.rows);
  const yahooLastRow = yahooCompletedRows.length
    ? yahooCompletedRows[yahooCompletedRows.length - 1]
    : null;

  // V2.9.12.1：月線缺漏只降級「月線資格」，不讓整檔股票失去日線分析。
  // Yahoo只當日K歷史骨架，再由TWSE MIS補最新已完成交易日；
  // 絕對不拿Yahoo去補月20MA、startMonth、Base或固定倍數。
  const misLatest = await fetchTwseMisLatestCompletedDaily(
    stock,
    safeMarket,
    budget,
    debugMode
  );
  const rows = getCompletedDailyRows(
    mergeDailyRowsPreferSnapshot(yahooCompletedRows, misLatest.row)
  );

  if (!rows.length) {
    return jsonResponse(
      {
        version: VERSION,
        error: `${safeMarket}官方月線目前不完整，且降級日線資料也不足。`,
        stock,
        market: safeMarket,
        missingMonths: missingRecent,
        retrySuggested: true,
        source: `${safeMarket} monthly unavailable`
      },
      503,
      corsHeaders
    );
  }

  const recentDailyRows = rows.slice(-Math.min(rows.length, DAILY_SERIES_RETURN_BARS));
  const latestDailyRow = recentDailyRows[recentDailyRows.length - 1];
  const dailyRsiSeries = calculateRSISeries(
    recentDailyRows.map(row => row.close),
    RSI_PERIOD
  );
  const dailyRsi5 = dailyRsiSeries.length
    ? dailyRsiSeries[dailyRsiSeries.length - 1]
    : null;

  const fibCore = scanLiteMode
    ? analyzeFibonacciNPatternScanLiteV29130(recentDailyRows, latestDailyRow.close)
    : analyzeFibonacciNPattern(recentDailyRows, latestDailyRow.close);
  const tacticalN = scanLiteMode ? null : analyzeTacticalN(recentDailyRows);
  const fib = scanLiteMode ? fibCore : attachTacticalBreakoutsToFib(fibCore, tacticalN);
  const volume = scanLiteMode
    ? analyzeVolumeContextScanLiteV29130(recentDailyRows, fib)
    : analyzeVolumeContext(recentDailyRows, fib);
  const structure = scanLiteMode
    ? analyzeStructureQualityScanLiteV29130(recentDailyRows, fib, volume)
    : analyzeStructureQuality(recentDailyRows, fib, volume);
  const tactical = scanLiteMode
    ? null
    : analyzeTacticalSignals(
        recentDailyRows,
        fib,
        tacticalN,
        volume,
        structure,
        false,
        latestDailyRow.close,
        dailyRsi5
      );
  const decisionLayer = scanCoreMode ? null : buildPostCloseDecisionLayerV29140({
    rows: recentDailyRows,
    fib,
    volume,
    structure,
    tactical,
    monthlyActive: false,
    monthlyAvailable: false,
    dailyRsi5,
    includeResearchAudit: !scanLiteMode
  });

  const issueReason = monthlyIssueReason ||
    `${safeMarket}近期官方月K仍有缺漏；日線先正常顯示，月線資格等待官方月份補齊。`;

  if (debugMode) {
    debug.market = safeMarket;
    debug.name = stockName || locator.name || null;
    debug.source = misLatest.row
      ? "Yahoo Finance history + TWSE MIS latest completed daily (monthly degraded)"
      : "Yahoo Finance history (monthly degraded)";
    debug.latestDailyHotfix = {
      yahooLastDate: yahooLastRow?.date || null,
      yahooLastClose: yahooLastRow?.close ?? null,
      misSnapshotDate: misLatest.row?.date || null,
      misSnapshotClose: misLatest.row?.close ?? null,
      finalLastDate: latestDailyRow?.date || null,
      finalLastClose: latestDailyRow?.close ?? null,
      applied: !!(
        misLatest.row &&
        (!yahooLastRow || misLatest.row.date >= yahooLastRow.date)
      ),
      detail: misLatest.debug || null
    };
    debug.monthlyPass = null;
    debug.monthlyActive = false;
    debug.monthlyVerification = {
      type: "official-monthly-gap-degraded",
      candidate: locatorState.currentStartCandidate || null,
      confirmed: false,
      reason: issueReason,
      missingMonths: missingRecent
    };
    debug.official = buildOfficialDebug(officialPhases, monthMap, safeMarket);
    finalizeDebugBudget(debug, budget);
  }

  const dailySeriesSource = misLatest.row
    ? "Yahoo Finance history + TWSE MIS latest completed daily (monthly degraded)"
    : "Yahoo Finance history (monthly degraded)";
  const dailySeries = serializeDailySeriesForFrontend(
    recentDailyRows,
    scanLiteMode ? SCAN_LITE_DAILY_SERIES_BARS : DAILY_SERIES_RETURN_BARS
  );
  const dailySeriesMeta = buildDailySeriesMeta(
    recentDailyRows,
    dailySeries,
    dailySeriesSource
  );

  const payload = {
    version: VERSION,
    stock,
    name: stockName || locator.name || `股票 ${stock}`,
    market: safeMarket,
    close: round(latestDailyRow.close, 2),
    closeDate: latestDailyRow.date,
    dailyRsi5: round(dailyRsi5, 2),

    dailySeries,
    dailySeriesMeta,

    fib,
    tacticalN,
    volume,
    structure,
    tactical,
    decisionLayer,
    tradeability: decisionLayer?.tradeability ?? null,
    trendPersistence: decisionLayer?.trendPersistence ?? null,
    maDeduction: decisionLayer?.maDeduction ?? null,
    volumePriceHealth: decisionLayer?.volumePriceHealth ?? null,
    reboundQuality: decisionLayer?.reboundQuality ?? null,
    pressureMap: decisionLayer?.pressureMap ?? null,
    remainingOpportunity: decisionLayer?.remainingOpportunity ?? null,
    entryQualityVNext: decisionLayer?.entryQuality ?? null,
    chaseRisk: decisionLayer?.chaseRisk ?? null,
    exitRisk: decisionLayer?.exitRisk ?? null,
    actionGate: decisionLayer?.actionGate ?? null,

    scanMode: scanLiteMode ? "SCAN_LITE" : "FULL",
    scanLite: !!scanLiteMode,
    scanLiteProfile: scanLiteMode ? {
          version: "V40",
      profile: scanCoreMode ? "CORE" : "FULL",
      dailySeriesBars: dailySeries.length,
      degradedMonthly: true,
      monthlyFetchLimit: SCAN_LITE_MONTHLY_FETCH_LIMIT,
      candidateVerification: "cache-only",
      dynamicBackfill: "cache-only",
      locatorHistoryMonths: SCAN_LITE_LOCATOR_HISTORY_MONTHS,
      skippedModules: ["analyzeTacticalN","attachTacticalBreakoutsToFib","analyzeTacticalSignals","recentOfficialRecovery","networkCandidateBackfill", ...(scanCoreMode ? ["decisionLayerV1"] : [])]
    } : null,

    // 月線欄位全部明確標示 unavailable；這不是月線失效。
    entry: false,
    stage: "觀察區",
    monthlyPass: null,
    monthlyStatus: "UNAVAILABLE",
    startMonth: null,
    qualifyingMonth: null,
    startMonthConfirmed: false,
    monthlyBoundaryAmbiguous: true,
    monthlyStartConfirmationSource: null,
    ma20: null,
    startMonthMA20: null,
    monthlyClose: null,
    startMonthClose: null,
    monthlyHigh: null,
    startMonthHigh: null,
    monthlyLow: null,
    startMonthLow: null,
    startMonthRsi5: null,
    baseValue: null,
    multiple: null,
    latestMonth: null,
    latestMonthClose: null,
    latestMonthMA20: null,
    latestMonthRsi5: null,
    rsi: null,
    previousBreakMonth: null,
    previousBreakClose: null,
    previousBreakMA20: null,
    latestBelowMonth: null,
    latestBelowClose: null,
    latestBelowMA20: null,
    previousSegmentStart: null,

    officialMonthlyUnavailable: true,
    officialMonthlyUnavailableReason: issueReason,
    missingOfficialMonths: Array.isArray(missingRecent) ? missingRecent : [],
    retrySuggested: true,

    source: misLatest.row
      ? `Yahoo Finance history + TWSE MIS latest completed daily (degraded; ${safeMarket} official monthly pending)`
      : `Yahoo Finance history (degraded daily only; ${safeMarket} official monthly pending)`,
    dailySource: dailySeriesSource,
    locatorSource: "Yahoo Finance (candidate only)",
    logic:
      scanLiteMode
      ? "V40 精簡掃描跨月降載：月K快取不足時最多補1個官方月份，略過較耗時的修復與候選回溯；日線ABC／N字、漲跌力道、20日均線、量能及逐日行情正常提供，月線資格暫停，不以非官方資料補造。"
      : "V40 月K缺漏修正：官方月線資料暫時不完整時，先正常提供日線ABC／N字、戰術結構、漲跌力道、量能及逐日行情；月線20月均線、起始月、基準價與固定倍數一律暫停，等待官方缺月補齊。日線降級資料不得回寫或冒充官方月線。",
    officialCache: {
      savedMonths: countCacheableMonths(monthMap),
      pendingMonths: Array.isArray(missingRecent) ? missingRecent : []
    },
    networkFetchBudget: {
      max: budget.max,
      used: budget.used,
      remaining: budget.remaining()
    },
    ...(debugMode ? { debug } : {})
  };

  // 重要：降級結果刻意不寫入「分析結果短效快取」。
  // 官方月份快取已在進入本函式前保存；下一次查詢要真的再次進Worker補缺月，
  // 不能被5分鐘的降級分析快取擋住。
  // SCAN_LITE 降級結果同樣不寫 scan-lite cache，避免月線 unavailable 被暫存成正式狀態。
  const responsePayload = scanLiteMode
    ? (scanCoreMode
      ? projectScanCorePayloadV39B12(payload, "monthly-degraded-scan-core")
      : projectScanLitePayloadV29130(payload, "monthly-degraded-scan-lite"))
    : payload;
  return jsonResponse(responsePayload, 200, {
    ...corsHeaders,
    "Cache-Control": "no-store",
    "X-Shitou-Result-Cache": `MISS-DEGRADED-${safeMarket}`
  });
}

function createNetworkBudget(max) {
  return {
    max,
    used: 0,
    remaining() {
      return Math.max(0, this.max - this.used);
    },
    take(label) {
      if (this.used >= this.max) {
        throw new Error(
          `V40 網路請求數已達上限 ${this.max}，停止新增外部資料請求。最後請求：${label}`
        );
      }
      this.used += 1;
      return this.used;
    }
  };
}

function finalizeDebugBudget(debug, budget) {
  debug.networkFetchBudget = {
    max: budget.max,
    used: budget.used,
    remaining: budget.remaining()
  };
  if (debug?.__timingTracker?.snapshot) {
    debug.timing = debug.__timingTracker.snapshot();
  }
  return debug;
}

async function budgetedFetchWithTimeout(
  budget,
  label,
  url,
  options = {},
  timeoutMs = FETCH_TIMEOUT_MS
) {
  budget.take(label);
  return fetchWithTimeout(
    url,
    {
      ...options,
      redirect: "manual"
    },
    timeoutMs
  );
}

function browserLikeHeaders(referer, accept = "application/json,text/plain,*/*") {
  return {
    Accept: accept,
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: referer,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
  };
}

function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isAllowedOfficialHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "www.tpex.org.tw" ||
    host === "tpex.org.tw" ||
    host === "www.twse.com.tw" ||
    host === "wwwc.twse.com.tw" ||
    host === "openapi.twse.com.tw"
  );
}

async function fetchOpenApiArray(url, label, budget, withDebug = false) {
  const detail = {
    url,
    label,
    redirectStatus: null,
    redirectLocation: null,
    redirectFollowed: false
  };

  try {
    let response = await budgetedFetchWithTimeout(
      budget,
      label,
      url,
      { headers: browserLikeHeaders(url, "application/json") }
    );

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("Location");
      detail.redirectStatus = response.status;
      detail.redirectLocation = location;

      if (location) {
        const target = new URL(location, url);
        detail.redirectHost = target.hostname;
        detail.redirectPath = target.pathname;

        if (
          isAllowedOfficialHost(target.hostname) &&
          /^\/errors(?:\/|$)/i.test(target.pathname)
        ) {
          detail.blockedByOfficialGateway = true;
          return {
            rows: [],
            ok: false,
            blocked: true,
            kind: "blocked",
            debug: withDebug ? detail : undefined
          };
        }

        if (isAllowedOfficialHost(target.hostname) && budget.remaining() > 0) {
          response = await budgetedFetchWithTimeout(
            budget,
            `${label}:redirect`,
            target.toString(),
            { headers: browserLikeHeaders(url, "application/json") }
          );
          detail.redirectFollowed = true;
          detail.finalUrl = target.toString();
        }
      }
    }

    const text = await response.text();
    detail.status = response.status;
    detail.preview = text.slice(0, 180);

    if (!response.ok || text.trim().startsWith("<")) {
      const temporaryUpstream =
        response.status >= 500 &&
        response.status <= 599;
      const blocked =
        response.status === 403 ||
        response.status === 429 ||
        response.status === 503 ||
        /FOR SECURITY REASONS|因為安全性考量/i.test(text);
      return {
        rows: [],
        ok: false,
        blocked,
        kind: blocked
          ? "blocked"
          : temporaryUpstream
            ? "temporary_upstream_error"
            : "error",
        debug: withDebug ? detail : undefined
      };
    }

    const payload = JSON.parse(text);
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    detail.rowCount = rows.length;
    return {
      rows,
      ok: true,
      blocked: false,
      kind: "ok",
      debug: withDebug ? detail : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);
    return {
      rows: [],
      ok: false,
      blocked: false,
      kind: "error",
      debug: withDebug ? detail : undefined
    };
  }
}

function openApiStockCode(row) {
  if (!row || typeof row !== "object") return null;
  const candidates = [
    row["公司代號"],
    row.Code,
    row.code,
    row.SecuritiesCompanyCode,
    row.SecuritiesCode,
    row.StockNo,
    row.StockCode
  ];
  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function openApiStockName(row) {
  if (!row || typeof row !== "object") return null;
  const candidates = [
    row["公司簡稱"],
    row["公司名稱"],
    row.Name,
    row.name,
    row.CompanyAbbreviation,
    row.CompanyName,
    row.SecuritiesCompanyName
  ];
  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function findStockInOpenApiRows(rows, stock) {
  if (!Array.isArray(rows)) return null;
  return rows.find(row => openApiStockCode(row) === stock) || null;
}

async function detectOfficialMarketByOpenApi(
  stock,
  budget,
  withDebug = false,
  fetchContext = {}
) {
  const trace = [];

  const twseCompanies = await fetchOpenApiArray(
    TWSE_OPENAPI_COMPANIES,
    `OpenAPI:TWSE-company:${stock}`,
    budget,
    withDebug
  );
  trace.push({
    step: "twse-company-profile",
    ok: twseCompanies.ok,
    kind: twseCompanies.kind || null,
    rows: twseCompanies.rows.length,
    detail: twseCompanies.debug || null
  });

  const twseCompany = findStockInOpenApiRows(twseCompanies.rows, stock);
  if (twseCompany) {
    return {
      market: "TWSE",
      name: openApiStockName(twseCompany),
      serviceUnavailable: false,
      officialMarketConfirmed: true,
      debug: withDebug ? { matchedBy: "TWSE t187ap03_L", trace } : undefined
    };
  }

  // V2.9.9：TWSE 官方公司主檔確認不是上市後，若已設定 TPEx Relay，
  // 先用 Relay 最近月份做「官方鏡像」辨識。命中後直接確認 TPEx，
  // 避免 Cloudflare 再依序等待 TPEx company / quotes / JSON / CSV / HTML 全部被 /errors 擋住。
  if (fetchContext.tpexRelayUrl && budget.remaining() > 0) {
    const relayProbe = await detectTpexByOfficialHistoryFallback(
      stock,
      budget,
      withDebug,
      fetchContext
    );

    trace.push({
      step: "tpex-relay-early-probe",
      ok: !!relayProbe.market,
      kind: relayProbe.kind || null,
      month: relayProbe.month || null,
      rows: relayProbe.rows || 0,
      detail: relayProbe.debug || null
    });

    if (relayProbe.market) {
      return {
        market: "TPEx",
        name: relayProbe.name || null,
        serviceUnavailable: false,
        officialMarketConfirmed: true,
        debug: withDebug
          ? { matchedBy: "TPEx official static relay", trace }
          : undefined
      };
    }
  }

  const tpexCompanies = await fetchOpenApiArray(
    TPEX_OPENAPI_COMPANIES,
    `OpenAPI:TPEx-company:${stock}`,
    budget,
    withDebug
  );
  trace.push({
    step: "tpex-company-profile",
    ok: tpexCompanies.ok,
    kind: tpexCompanies.kind || null,
    rows: tpexCompanies.rows.length,
    detail: tpexCompanies.debug || null
  });

  const tpexCompany = findStockInOpenApiRows(tpexCompanies.rows, stock);
  if (tpexCompany) {
    return {
      market: "TPEx",
      name: openApiStockName(tpexCompany),
      serviceUnavailable: false,
      officialMarketConfirmed: true,
      debug: withDebug ? { matchedBy: "TPEx mopsfin_t187ap03_O", trace } : undefined
    };
  }

  let twseQuotes = {
    rows: [],
    ok: false,
    blocked: false,
    kind: "not_attempted",
    debug: undefined
  };

  if (budget.remaining() > 0) {
    twseQuotes = await fetchOpenApiArray(
      TWSE_OPENAPI_QUOTES,
      `OpenAPI:TWSE-quotes:${stock}`,
      budget,
      withDebug
    );
    trace.push({
      step: "twse-stock-day-all",
      ok: twseQuotes.ok,
      kind: twseQuotes.kind || null,
      rows: twseQuotes.rows.length,
      detail: twseQuotes.debug || null
    });

    const twseQuote = findStockInOpenApiRows(twseQuotes.rows, stock);
    if (twseQuote) {
      return {
        market: "TWSE",
        name: openApiStockName(twseQuote),
        serviceUnavailable: false,
        officialMarketConfirmed: true,
        debug: withDebug ? { matchedBy: "TWSE STOCK_DAY_ALL", trace } : undefined
      };
    }
  }

  let tpexQuotes = {
    rows: [],
    ok: false,
    blocked: false,
    kind: "not_attempted",
    debug: undefined
  };

  if (budget.remaining() > 0) {
    tpexQuotes = await fetchOpenApiArray(
      TPEX_OPENAPI_QUOTES,
      `OpenAPI:TPEx-quotes:${stock}`,
      budget,
      withDebug
    );
    trace.push({
      step: "tpex-mainboard-quotes",
      ok: tpexQuotes.ok,
      kind: tpexQuotes.kind || null,
      rows: tpexQuotes.rows.length,
      detail: tpexQuotes.debug || null
    });

    const tpexQuote = findStockInOpenApiRows(tpexQuotes.rows, stock);
    if (tpexQuote) {
      return {
        market: "TPEx",
        name: openApiStockName(tpexQuote),
        serviceUnavailable: false,
        officialMarketConfirmed: true,
        debug: withDebug ? { matchedBy: "TPEx tpex_mainboard_quotes", trace } : undefined
      };
    }
  }

  const tpexOpenApiUnavailable =
    !tpexCompanies.ok ||
    !tpexQuotes.ok;

  if (tpexOpenApiUnavailable && budget.remaining() > 0) {
    if (tpexCompanies.blocked || tpexQuotes.blocked) {
      fetchContext.tpexOpenApiBlocked = true;
      fetchContext.tpexPreferredHistoryMode = "legacy";
    }

    const tpexHistoryProbe = await detectTpexByOfficialHistoryFallback(
      stock,
      budget,
      withDebug,
      fetchContext
    );

    trace.push({
      step: "tpex-official-history-fallback",
      ok: !!tpexHistoryProbe.market,
      kind: tpexHistoryProbe.kind || null,
      month: tpexHistoryProbe.month || null,
      rows: tpexHistoryProbe.rows || 0,
      detail: tpexHistoryProbe.debug || null
    });

    if (tpexHistoryProbe.market) {
      return {
        market: "TPEx",
        name: tpexHistoryProbe.name || null,
        serviceUnavailable: false,
        officialMarketConfirmed: true,
        debug: withDebug
          ? { matchedBy: "TPEx official history fallback", trace }
          : undefined
      };
    }

    if (budget.remaining() > 0) {
      const yahooProbe = await fetchYahooHistory(
        `${stock}.TWO`,
        LOCATOR_HISTORY_MONTHS,
        withDebug,
        budget
      );

      trace.push({
        step: "tpex-yahoo-routing-candidate",
        ok: yahooProbe.rows.length > 0,
        kind: yahooProbe.rows.length > 0 ? "candidate" : "empty",
        rows: yahooProbe.rows.length,
        detail: yahooProbe.debug || null
      });

      if (yahooProbe.rows.length > 0) {
        return {
          market: "TPEx",
          name: yahooProbe.name || null,
          serviceUnavailable: true,
          officialMarketConfirmed: false,
          locatorProbe: yahooProbe,
          debug: withDebug
            ? {
                matchedBy: "Yahoo .TWO routing candidate; TPEx official temporarily unavailable",
                trace
              }
            : undefined
        };
      }
    }

    return {
      market: null,
      name: null,
      serviceUnavailable: true,
      officialMarketConfirmed: false,
      debug: withDebug ? { matchedBy: null, trace } : undefined
    };
  }

  const anyServiceFailure =
    !twseCompanies.ok ||
    !tpexCompanies.ok ||
    !twseQuotes.ok ||
    !tpexQuotes.ok;

  return {
    market: null,
    name: null,
    serviceUnavailable: anyServiceFailure,
    officialMarketConfirmed: false,
    debug: withDebug ? { matchedBy: null, trace } : undefined
  };
}

async function detectTpexByOfficialHistoryFallback(
  stock,
  budget,
  withDebug = false,
  fetchContext = {}
) {
  const keys = getRecentMonthKeys(2).reverse();
  const attempts = [];
  let sawServiceFailure = false;

  for (const key of keys) {
    if (budget.remaining() <= 0) break;

    const result = await fetchTpexMonth(
      stock,
      key,
      withDebug,
      budget,
      fetchContext,
      { recovery: true }
    );

    attempts.push({
      month: key,
      rows: result.rows.length,
      kind: result.kind || null,
      detail: result.debug || null
    });

    if (hasMonthRows(result)) {
      fetchContext.marketProbeMonth = {
        key,
        result
      };

      return {
        market: "TPEx",
        name: result.name || null,
        month: key,
        rows: result.rows.length,
        kind: "ok",
        serviceUnavailable: false,
        debug: withDebug ? { attempts } : undefined
      };
    }

    if (result.kind === "blocked" || result.kind === "error") {
      sawServiceFailure = true;
    }

    await sleep(TPEX_REQUEST_DELAY_MS);
  }

  return {
    market: null,
    name: null,
    month: null,
    rows: 0,
    kind: sawServiceFailure ? "service_unavailable" : "empty",
    serviceUnavailable: sawServiceFailure,
    debug: withDebug ? { attempts } : undefined
  };
}

async function fetchOfficialMonthSetSequential(
  stock,
  market,
  monthKeys,
  monthMap,
  budget,
  withDebug = false,
  fetchContext = {},
  phase = "official",
  requestOptions = {}
) {
  const keys = uniqueSortedMonthKeys(monthKeys);
  const requestedKeys = [];
  const attempts = [];
  const providersUsed = new Set();

  for (const key of keys) {
    const existing = monthMap.get(key);
    if (hasMonthRows(existing)) {
      providersUsed.add(existing.provider || market);
      continue;
    }

    if (budget.remaining() <= 0) break;

    requestedKeys.push(key);
    const result = await fetchOfficialMonth(
      stock,
      market,
      key,
      withDebug,
      budget,
      fetchContext,
      requestOptions
    );
    const stored = { ...result, provider: market, fetchedAt: Date.now() };
    monthMap.set(key, stored);

    attempts.push({
      month: key,
      provider: market,
      rows: result.rows.length,
      kind: result.kind || null,
      detail: result.debug || null
    });

    if (hasMonthRows(stored)) providersUsed.add(market);

    const delay = market === "TWSE" ? TWSE_REQUEST_DELAY_MS : TPEX_REQUEST_DELAY_MS;
    if (delay > 0) await sleep(delay);
  }

  const missingKeys = keys.filter(key => !hasMonthRows(monthMap.get(key)));
  const successfulKeys = keys.filter(key => hasMonthRows(monthMap.get(key)));

  return {
    phase,
    requestedKeys,
    allKeys: keys,
    successfulKeys,
    missingKeys,
    providersUsed: [...providersUsed],
    attempts
  };
}

async function fetchOfficialMonth(
  stock,
  market,
  monthKey,
  withDebug,
  budget,
  fetchContext,
  requestOptions = {}
) {
  return market === "TWSE"
    ? fetchTwseMonth(
        stock,
        monthKey,
        withDebug,
        budget,
        fetchContext,
        requestOptions
      )
    : fetchTpexMonth(
        stock,
        monthKey,
        withDebug,
        budget,
        fetchContext,
        requestOptions
      );
}

async function recoverMissingOfficialMonths({
  stock,
  market,
  monthKeys,
  monthMap,
  budget,
  debugMode = false,
  fetchContext = {},
  phases = [],
  phaseBase = "official-recovery",
  maxRounds = OFFICIAL_RECOVERY_MAX_ROUNDS,
  reserveBudget = 0
}) {
  const keys = uniqueSortedMonthKeys(monthKeys);
  let missing = keys.filter(key => !hasMonthRows(monthMap.get(key)));
  if (!missing.length || budget.remaining() <= reserveBudget) return missing;

  await sleep(OFFICIAL_RECOVERY_COOLDOWN_MS);

  for (let round = 1; round <= maxRounds; round++) {
    if (!missing.length || budget.remaining() <= reserveBudget) break;

    const requestedKeys = [];
    const attempts = [];
    const providersUsed = new Set();

    const forcedHost = market === "TWSE"
      ? (round === 1 ? "www.twse.com.tw" : "wwwc.twse.com.tw")
      : null;

    for (const key of [...missing]) {
      if (budget.remaining() <= reserveBudget) break;

      requestedKeys.push(key);
      const result = await fetchOfficialMonth(
        stock,
        market,
        key,
        debugMode,
        budget,
        fetchContext,
        {
          recovery: true,
          recoveryRound: round,
          forceHost: forcedHost,
          timeoutMs: market === "TWSE" ? TWSE_HISTORY_TIMEOUT_MS : TPEX_HISTORY_TIMEOUT_MS
        }
      );

      const stored = { ...result, provider: market, fetchedAt: Date.now() };
      monthMap.set(key, stored);

      attempts.push({
        month: key,
        provider: market,
        rows: result.rows.length,
        kind: result.kind || null,
        detail: result.debug || null
      });

      if (hasMonthRows(stored)) providersUsed.add(market);

      if (OFFICIAL_RECOVERY_SPACING_MS > 0) {
        await sleep(OFFICIAL_RECOVERY_SPACING_MS);
      }
    }

    missing = keys.filter(key => !hasMonthRows(monthMap.get(key)));
    const successfulKeys = keys.filter(key => hasMonthRows(monthMap.get(key)));

    phases.push({
      phase: `${phaseBase}-r${round}`,
      requestedKeys,
      allKeys: keys,
      successfulKeys,
      missingKeys: missing,
      providersUsed: [...providersUsed],
      attempts
    });

    if (!missing.length || budget.remaining() <= reserveBudget) break;
    if (round < maxRounds) {
      await sleep(OFFICIAL_RECOVERY_SECOND_COOLDOWN_MS);
    }
  }

  return missing;
}

function twseHistoryUrl(host, stock, monthKey) {
  return (
    `https://${host}/rwd/zh/afterTrading/STOCK_DAY` +
    `?date=${monthKey}01` +
    `&stockNo=${encodeURIComponent(stock)}` +
    "&response=json"
  );
}

function isTwseSecurityBlock(status, text) {
  const body = String(text || "");
  return (
    status === 307 ||
    status === 403 ||
    status === 429 ||
    body.includes("FOR SECURITY REASONS") ||
    body.includes("因為安全性考量")
  );
}

async function fetchTwseMonth(
  stock,
  monthKey,
  withDebug = false,
  budget = null,
  fetchContext = {},
  requestOptions = {}
) {
  const forcedHost = requestOptions.forceHost || null;
  const preferred = forcedHost || fetchContext.twsePreferredHost || "www.twse.com.tw";
  const host = preferred;
  const detail = {
    attempts: [],
    recovery: !!requestOptions.recovery,
    recoveryRound: requestOptions.recoveryRound || null
  };

  if (budget && budget.remaining() <= 0) {
    return emptyOfficialResult("budget", withDebug ? detail : null);
  }

  const apiUrl = twseHistoryUrl(host, stock, monthKey);
  const attempt = { url: apiUrl, host };
  const timeoutMs = requestOptions.timeoutMs || TWSE_HISTORY_TIMEOUT_MS;

  try {
    const response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `TWSE:${stock}:${monthKey}:${host}${requestOptions.recovery ? ":recovery" : ""}`,
          apiUrl,
          {
            headers: browserLikeHeaders(
              `https://${host}/zh/trading/historical/stock-day.html`,
              "application/json,text/plain,*/*"
            )
          },
          timeoutMs
        )
      : await fetchWithTimeout(
          apiUrl,
          {
            headers: browserLikeHeaders(
              `https://${host}/zh/trading/historical/stock-day.html`,
              "application/json,text/plain,*/*"
            ),
            redirect: "manual"
          },
          timeoutMs
        );

    const text = await response.text();
    attempt.status = response.status;
    attempt.preview = text.slice(0, 180);
    attempt.location = response.headers.get("Location");
    detail.attempts.push(attempt);

    if (isTwseSecurityBlock(response.status, text)) {
      return emptyOfficialResult("blocked", withDebug ? detail : null);
    }

    if (!response.ok || text.trim().startsWith("<")) {
      return emptyOfficialResult("error", withDebug ? detail : null);
    }

    const payload = JSON.parse(text);
    if (!payload || payload.stat !== "OK" || !Array.isArray(payload.data)) {
      return emptyOfficialResult(
        "empty",
        withDebug ? { ...detail, stat: payload?.stat || null } : null
      );
    }

    const rows = payload.data.map(parseTwseMarketRow).filter(Boolean);
    if (rows.length > 0 && !forcedHost) {
      fetchContext.twsePreferredHost = host;
    }

    return {
      rows,
      name: extractTwseStockName(payload.title, stock),
      kind: rows.length ? "ok" : "empty",
      debug: withDebug
        ? {
            ...detail,
            rowCount: rows.length,
            stat: payload.stat,
            selectedHost: host
          }
        : undefined
    };
  } catch (error) {
    attempt.error = error?.message || String(error);
    detail.attempts.push(attempt);
    return emptyOfficialResult("error", withDebug ? detail : null);
  }
}

function buildTpexHistoryUrl(stock, monthKey, learnedBase = null) {
  const year = monthKey.slice(0, 4);
  const month = monthKey.slice(4, 6);
  const base = learnedBase ||
    "https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock";
  const url = new URL(base);
  url.searchParams.set("date", `${year}/${month}/01`);
  url.searchParams.set("code", stock);
  url.searchParams.set("response", "json");
  return url.toString();
}

function buildTpexLegacyHistoryUrl(stock, monthKey) {
  const year = Number(monthKey.slice(0, 4));
  const month = monthKey.slice(4, 6);
  const rocYear = year - 1911;
  const url = new URL(
    "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php"
  );
  url.searchParams.set("l", "zh-tw");
  url.searchParams.set("d", `${rocYear}/${month}`);
  url.searchParams.set("stkno", stock);
  return url.toString();
}

// V2.9.9：TPEx 官方 CSV 歷史路徑。
// TPEx 個股日成交資訊頁面本身提供「Download CSV / Download CSV (UTF-8)」。
// JSON/HTML 若被 Cloudflare 出口導向 /errors，CSV 下載路徑有機會走不同的官方回應鏈。
function buildTpexCsvHistoryUrl(stock, monthKey, language = "zh-tw") {
  const year = monthKey.slice(0, 4);
  const month = monthKey.slice(4, 6);
  const lang = language === "en-us" ? "en-us" : "zh-tw";
  const url = new URL(
    `https://www.tpex.org.tw/www/${lang}/afterTrading/tradingStock`
  );
  url.searchParams.set("date", `${year}/${month}/01`);
  url.searchParams.set("code", stock);
  url.searchParams.set("id", "");
  url.searchParams.set("response", "csv");
  return url.toString();
}

function buildTpexLegacyCsvHistoryUrl(stock, monthKey) {
  const year = Number(monthKey.slice(0, 4));
  const month = monthKey.slice(4, 6);
  const rocYear = year - 1911;
  const url = new URL(
    "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_download_UTF-8.php"
  );
  url.searchParams.set("l", "zh-tw");
  url.searchParams.set("d", `${rocYear}/${month}`);
  url.searchParams.set("stkno", stock);
  url.searchParams.set("s", "0,asc,0");
  return url.toString();
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (ch === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells.map(value => value.replace(/^\uFEFF/, "").trim());
}

function extractTpexRowsFromCsv(csvText) {
  const rows = [];
  const lines = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cells = parseCsvLine(line);
    if (cells.length < 7) continue;
    const parsed = parseTpexMarketRow(cells);
    if (parsed) rows.push(parsed);
  }

  return rows
    .filter((row, index, arr) =>
      index === arr.findIndex(other => other.date === row.date)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function extractTpexNameFromCsv(csvText, stock) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const patterns = [
    new RegExp(`${escapeRegExp(stock)}\\s+([^,\\r\\n]+)`),
    new RegExp(`股票代號[:：]?\\s*${escapeRegExp(stock)}\\s*([^,\\r\\n]+)?`)
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return String(match[1]).replace(/["']/g, "").trim() || null;
    }
  }
  return null;
}

async function fetchTpexCsvMonth(
  stock,
  monthKey,
  withDebug = false,
  budget = null,
  requestOptions = {},
  language = "zh-tw"
) {
  const apiUrl = buildTpexCsvHistoryUrl(stock, monthKey, language);
  const detail = {
    mode: `official-csv-tradingStock-${language}`,
    url: apiUrl,
    recovery: !!requestOptions.recovery,
    recoveryRound: requestOptions.recoveryRound || null
  };
  const timeoutMs = requestOptions.timeoutMs || TPEX_HISTORY_TIMEOUT_MS;

  try {
    let response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `TPEx-csv-${language}:${stock}:${monthKey}${requestOptions.recovery ? ":recovery" : ""}`,
          apiUrl,
          {
            headers: browserLikeHeaders(
              `https://www.tpex.org.tw/${language}/mainboard/trading/info/stock-pricing.html`,
              "text/csv,text/plain;q=0.9,*/*;q=0.7"
            )
          },
          timeoutMs
        )
      : await fetchWithTimeout(
          apiUrl,
          {
            headers: browserLikeHeaders(
              `https://www.tpex.org.tw/${language}/mainboard/trading/info/stock-pricing.html`,
              "text/csv,text/plain;q=0.9,*/*;q=0.7"
            ),
            redirect: "manual"
          },
          timeoutMs
        );

    detail.status = response.status;
    detail.location = response.headers.get("Location");

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("Location");
      if (location) {
        const target = new URL(location, apiUrl);
        detail.redirectHost = target.hostname;
        detail.redirectPath = target.pathname;
        if (/^\/errors(?:\/|$)/i.test(target.pathname)) {
          detail.blockedByOfficialGateway = true;
          return emptyOfficialResult("blocked", withDebug ? detail : null);
        }
        if (isAllowedOfficialHost(target.hostname) && (!budget || budget.remaining() > 0)) {
          response = budget
            ? await budgetedFetchWithTimeout(
                budget,
                `TPEx-csv-${language}:${stock}:${monthKey}:redirect`,
                target.toString(),
                {
                  headers: browserLikeHeaders(apiUrl, "text/csv,text/plain;q=0.9,*/*;q=0.7")
                },
                timeoutMs
              )
            : await fetchWithTimeout(
                target.toString(),
                {
                  headers: browserLikeHeaders(apiUrl, "text/csv,text/plain;q=0.9,*/*;q=0.7"),
                  redirect: "manual"
                },
                timeoutMs
              );
          detail.redirectFollowed = true;
          detail.finalUrl = target.toString();
        }
      }
    }

    const text = await response.text();
    detail.status = response.status;
    detail.contentType = response.headers.get("Content-Type");
    detail.preview = text.slice(0, 240);

    if (!response.ok || /^\s*</.test(text)) {
      const blocked =
        response.status === 307 ||
        response.status === 403 ||
        response.status === 429 ||
        /FOR SECURITY REASONS|因為安全性考量/i.test(text);
      const temporaryUpstream = response.status >= 500 && response.status <= 599;
      return emptyOfficialResult(
        blocked ? "blocked" : temporaryUpstream ? "temporary_upstream_error" : "error",
        withDebug ? detail : null
      );
    }

    const rows = extractTpexRowsFromCsv(text);
    detail.rowCount = rows.length;
    return {
      rows,
      name: extractTpexNameFromCsv(text, stock),
      kind: rows.length ? "ok" : "empty",
      debug: withDebug ? detail : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);
    return emptyOfficialResult("error", withDebug ? detail : null);
  }
}

async function fetchTpexLegacyCsvMonth(
  stock,
  monthKey,
  withDebug = false,
  budget = null,
  requestOptions = {}
) {
  const apiUrl = buildTpexLegacyCsvHistoryUrl(stock, monthKey);
  const detail = {
    mode: "legacy-st43-download-utf8-csv",
    url: apiUrl,
    recovery: !!requestOptions.recovery,
    recoveryRound: requestOptions.recoveryRound || null
  };
  const timeoutMs = requestOptions.timeoutMs || TPEX_HISTORY_TIMEOUT_MS;

  try {
    const response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `TPEx-legacy-csv:${stock}:${monthKey}${requestOptions.recovery ? ":recovery" : ""}`,
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
              "text/csv,text/plain;q=0.9,*/*;q=0.7"
            )
          },
          timeoutMs
        )
      : await fetchWithTimeout(
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
              "text/csv,text/plain;q=0.9,*/*;q=0.7"
            ),
            redirect: "manual"
          },
          timeoutMs
        );

    detail.status = response.status;
    detail.location = response.headers.get("Location");
    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("Location");
      if (location) {
        const target = new URL(location, apiUrl);
        detail.redirectPath = target.pathname;
        if (/^\/errors(?:\/|$)/i.test(target.pathname)) {
          detail.blockedByOfficialGateway = true;
          return emptyOfficialResult("blocked", withDebug ? detail : null);
        }
      }
    }

    const text = await response.text();
    detail.contentType = response.headers.get("Content-Type");
    detail.preview = text.slice(0, 240);
    if (!response.ok || /^\s*</.test(text)) {
      const blocked =
        response.status === 307 ||
        response.status === 403 ||
        response.status === 429 ||
        /FOR SECURITY REASONS|因為安全性考量/i.test(text);
      const temporaryUpstream = response.status >= 500 && response.status <= 599;
      return emptyOfficialResult(
        blocked ? "blocked" : temporaryUpstream ? "temporary_upstream_error" : "error",
        withDebug ? detail : null
      );
    }

    const rows = extractTpexRowsFromCsv(text);
    detail.rowCount = rows.length;
    return {
      rows,
      name: extractTpexNameFromCsv(text, stock),
      kind: rows.length ? "ok" : "empty",
      debug: withDebug ? detail : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);
    return emptyOfficialResult("error", withDebug ? detail : null);
  }
}

function buildTpexHtmlHistoryUrl(stock, monthKey) {
  const year = monthKey.slice(0, 4);
  const month = monthKey.slice(4, 6);
  const url = new URL(
    "https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock"
  );
  url.searchParams.set("date", `${year}/${month}/01`);
  url.searchParams.set("code", stock);
  url.searchParams.set("id", "");
  url.searchParams.set("response", "html");
  return url.toString();
}

function decodeBasicHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (entity, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : entity;
    });
}

function htmlCellText(fragment) {
  return decodeBasicHtmlEntities(
    String(fragment ?? "")
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTpexRowsFromHtml(html) {
  const text = String(html || "");
  const rows = [];
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(text)) !== null) {
    const tr = trMatch[1];
    const cells = [];
    const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(tr)) !== null) {
      cells.push(htmlCellText(cellMatch[1]));
    }

    if (cells.length >= 7) {
      const parsed = parseTpexMarketRow(cells);
      if (parsed) rows.push(parsed);
    }
  }

  return rows
    .filter((row, index, arr) =>
      index === arr.findIndex(other => other.date === row.date)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function extractTpexNameFromHtml(html, stock) {
  const text = htmlCellText(html);
  const patterns = [
    new RegExp(`${escapeRegExp(stock)}\\s+([^\\s・|]+)`),
    new RegExp(`股票代號[:：]?\\s*${escapeRegExp(stock)}\\s*([^\\s・|]+)?`)
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

async function fetchTpexHtmlMonth(
  stock,
  monthKey,
  withDebug = false,
  budget = null,
  requestOptions = {}
) {
  const apiUrl = buildTpexHtmlHistoryUrl(stock, monthKey);
  const detail = {
    mode: "official-html-tradingStock",
    url: apiUrl,
    recovery: !!requestOptions.recovery,
    recoveryRound: requestOptions.recoveryRound || null
  };
  const timeoutMs = requestOptions.timeoutMs || TPEX_HISTORY_TIMEOUT_MS;

  try {
    const response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `TPEx-html:${stock}:${monthKey}${requestOptions.recovery ? ":recovery" : ""}`,
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
              "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.7"
            )
          },
          timeoutMs
        )
      : await fetchWithTimeout(
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
              "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.7"
            ),
            redirect: "manual"
          },
          timeoutMs
        );

    detail.status = response.status;
    detail.location = response.headers.get("Location");

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("Location");
      if (location) {
        const target = new URL(location, apiUrl);
        detail.redirectPath = target.pathname;
        if (/^\/errors(?:\/|$)/i.test(target.pathname)) {
          detail.blockedByOfficialGateway = true;
          return emptyOfficialResult("blocked", withDebug ? detail : null);
        }
      }
    }

    const html = await response.text();
    detail.preview = html.slice(0, 220);

    if (!response.ok) {
      const temporaryUpstream = response.status >= 500 && response.status <= 599;
      const blocked =
        response.status === 307 ||
        response.status === 403 ||
        response.status === 429 ||
        /FOR SECURITY REASONS|因為安全性考量/i.test(html);
      return emptyOfficialResult(
        blocked ? "blocked" : temporaryUpstream ? "temporary_upstream_error" : "error",
        withDebug ? detail : null
      );
    }

    const rows = extractTpexRowsFromHtml(html);
    detail.rowCount = rows.length;

    return {
      rows,
      name: extractTpexNameFromHtml(html, stock),
      kind: rows.length ? "ok" : "empty",
      debug: withDebug ? detail : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);
    return emptyOfficialResult("error", withDebug ? detail : null);
  }
}

function buildTpexRelayUrl(baseUrl, stock, monthKey) {
  const encodedStock = encodeURIComponent(stock);
  const encodedMonth = encodeURIComponent(monthKey);
  if (baseUrl.includes("{stock}") || baseUrl.includes("{month}")) {
    return baseUrl
      .replaceAll("{stock}", encodedStock)
      .replaceAll("{month}", encodedMonth);
  }
  const u = new URL(baseUrl);
  u.searchParams.set("stock", stock);
  u.searchParams.set("month", monthKey);
  return u.toString();
}

function normalizeRelayRow(row) {
  if (!row) return null;
  if (Array.isArray(row)) return parseTpexMarketRow(row);

  const date = String(row.date || row.Date || row.tradeDate || "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : marketDateToISO(date);
  const open = parsePrice(row.open ?? row.Open ?? row.openingPrice);
  const high = parsePrice(row.high ?? row.High ?? row.highestPrice);
  const low = parsePrice(row.low ?? row.Low ?? row.lowestPrice);
  const close = parsePrice(row.close ?? row.Close ?? row.closingPrice);
  const volume = parseVolume(row.volume ?? row.Volume ?? row.tradeVolume ?? row.TradeVolume ?? 0);
  if (!iso || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return null;
  }
  return { date: iso, open, high, low, close, volume };
}

function extractTpexRelayRows(payload) {
  if (!payload) return [];

  const normalizedCandidates = [
    payload.rows,
    payload.data,
    payload.result?.rows,
    payload.result?.data
  ].find(Array.isArray);
  if (normalizedCandidates) {
    const rows = normalizedCandidates.map(normalizeRelayRow).filter(Boolean);
    if (rows.length) return rows;
  }

  const table = Array.isArray(payload?.tables) ? payload.tables[0] : null;
  if (Array.isArray(table?.data)) {
    return table.data.map(parseTpexMarketRow).filter(Boolean);
  }

  const legacyRows = extractTpexLegacyRows(payload);
  if (legacyRows.length) {
    return legacyRows.map(parseTpexMarketRow).filter(Boolean);
  }
  return [];
}

function relayRowMonthKey(row) {
  const date = String(row?.date || "");
  const m = date.match(/^(\d{4})-(\d{2})-/);
  return m ? `${m[1]}${m[2]}` : null;
}

function validateStaticTpexRelayPayload(payload, stock) {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "payload_not_object" };

  // 舊的自建動態 Relay 沒有 schema 時仍維持相容；
  // 只有 Shitou static relay schema 才做嚴格欄位驗證。
  const schema = String(payload.schema || "").trim();
  if (!schema) return { ok: true, strict: false };
  if (schema !== "shitou-tpex-official-relay-v1") {
    return { ok: false, reason: `unsupported_schema:${schema}` };
  }
  if (String(payload.market || "TPEx") !== "TPEx") {
    return { ok: false, reason: "market_mismatch" };
  }
  if (String(payload.stock || "") !== String(stock)) {
    return { ok: false, reason: "stock_mismatch" };
  }
  const source = String(payload.source || payload.provider || "");
  if (!/TPEx Official/i.test(source)) {
    return { ok: false, reason: "source_not_official" };
  }
  return { ok: true, strict: true };
}

async function fetchTpexRelayMonth(
  stock,
  monthKey,
  withDebug = false,
  budget = null,
  fetchContext = {},
  requestOptions = {}
) {
  const baseUrl = fetchContext?.tpexRelayUrl;
  if (!baseUrl) {
    return emptyOfficialResult(
      "relay_not_configured",
      withDebug ? { mode: "tpex-relay-cache", configured: false } : null
    );
  }

  let relayUrl;
  try {
    relayUrl = buildTpexRelayUrl(baseUrl, stock, monthKey);
  } catch (error) {
    return emptyOfficialResult(
      "relay_config_error",
      withDebug ? { mode: "tpex-relay-cache", configured: true, error: error?.message || String(error) } : null
    );
  }

  const headers = {
    Accept: "application/json,text/plain,*/*",
    "User-Agent": "Shitou-Agent-Fib/2.9.9"
  };
  if (fetchContext?.tpexRelayToken) {
    headers["X-Shitou-Relay-Token"] = fetchContext.tpexRelayToken;
  }

  const detail = {
    mode: "tpex-relay-cache",
    configured: true,
    url: relayUrl,
    recovery: !!requestOptions.recovery,
    recoveryRound: requestOptions.recoveryRound || null,
    invocationPayloadCacheHit: false,
    requestedMonth: monthKey
  };

  try {
    let payload;
    let textPreview = null;
    const invocationCache = fetchContext?.tpexRelayPayloadCache;
    const cachedPayload = invocationCache instanceof Map ? invocationCache.get(relayUrl) : null;

    if (cachedPayload) {
      payload = cachedPayload;
      detail.invocationPayloadCacheHit = true;
      detail.status = 200;
    } else {
      const response = budget
        ? await budgetedFetchWithTimeout(
            budget,
            `TPEx-relay:${stock}:${monthKey}${requestOptions.recovery ? ":recovery" : ""}`,
            relayUrl,
            { headers },
            requestOptions.timeoutMs || TPEX_RELAY_TIMEOUT_MS
          )
        : await fetchWithTimeout(
            relayUrl,
            { headers, redirect: "follow" },
            requestOptions.timeoutMs || TPEX_RELAY_TIMEOUT_MS
          );

      detail.status = response.status;
      const text = await response.text();
      textPreview = text.slice(0, 220);
      detail.preview = textPreview;
      if (!response.ok) {
        return emptyOfficialResult(
          response.status >= 500 ? "relay_temporary_error" : "relay_error",
          withDebug ? detail : null
        );
      }

      payload = JSON.parse(text);
      if (invocationCache instanceof Map) invocationCache.set(relayUrl, payload);
    }

    const validation = validateStaticTpexRelayPayload(payload, stock);
    detail.schema = payload?.schema || null;
    detail.validation = validation;
    detail.source = payload?.source || payload?.provider || "TPEx-official-relay";
    detail.generatedAt = payload?.generatedAt || null;

    if (!validation.ok) {
      return emptyOfficialResult("relay_validation_error", withDebug ? detail : null);
    }

    const allRows = extractTpexRelayRows(payload)
      .filter((row, index, arr) => index === arr.findIndex(other => other.date === row.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    // V2.9.9：GitHub static relay 可是一檔股票一個 JSON，內含多個月份。
    // 這裡只回傳本次 monthKey，讓既有月K聚合邏輯完全不需要改動。
    const rows = allRows.filter(row => relayRowMonthKey(row) === monthKey);

    detail.totalRelayRows = allRows.length;
    detail.rowCount = rows.length;

    if (!rows.length) {
      return emptyOfficialResult("empty", withDebug ? detail : null);
    }

    fetchContext.tpexPreferredHistoryMode = "relay";
    return {
      rows,
      name: payload?.name || payload?.stockName || payload?.result?.name || null,
      kind: "ok",
      debug: withDebug ? detail : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);
    return emptyOfficialResult("relay_error", withDebug ? detail : null);
  }
}

async function fetchTpexLegacyThenHtml(
  stock,
  monthKey,
  withDebug,
  budget,
  fetchContext,
  requestOptions = {},
  fallbackFrom = null
) {
  const chain = [];
  let lastResult = emptyOfficialResult("error", null);

  const record = (label, result) => {
    chain.push({
      mode: label,
      kind: result?.kind || null,
      rows: Array.isArray(result?.rows) ? result.rows.length : 0,
      detail: result?.debug || null
    });
    lastResult = result || lastResult;
  };

  // ① modern CSV：官方頁面提供 CSV 下載；JSON gateway 被擋時先試同端點 CSV。
  if (!fetchContext.tpexModernCsvUnavailable && (!budget || budget.remaining() > 0)) {
    const modernCsv = await fetchTpexCsvMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      requestOptions,
      "zh-tw"
    );
    record("modern-csv-zh-tw", modernCsv);
    if (hasMonthRows(modernCsv)) {
      fetchContext.tpexPreferredHistoryMode = "csv-modern";
      if (withDebug && modernCsv.debug) {
        modernCsv.debug = { fallbackFrom, recoveryChain: chain, ...modernCsv.debug };
      }
      return modernCsv;
    }
    if (["blocked", "error", "temporary_upstream_error"].includes(modernCsv.kind)) {
      fetchContext.tpexModernCsvUnavailable = true;
    }
  }

  // ② legacy st43 JSON。
  if (!fetchContext.tpexLegacyJsonUnavailable && (!budget || budget.remaining() > 0)) {
    const legacy = await fetchTpexLegacyMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      requestOptions
    );
    record("legacy-st43-json", legacy);
    if (hasMonthRows(legacy)) {
      fetchContext.tpexPreferredHistoryMode = "legacy";
      if (withDebug && legacy.debug) {
        legacy.debug = { fallbackFrom, recoveryChain: chain, ...legacy.debug };
      }
      return legacy;
    }
    if (["blocked", "error", "temporary_upstream_error"].includes(legacy.kind)) {
      fetchContext.tpexLegacyJsonUnavailable = true;
    }
  }

  // ③ legacy UTF-8 CSV：不同下載腳本，可繞開 JSON gateway。
  if (!fetchContext.tpexLegacyCsvUnavailable && (!budget || budget.remaining() > 0)) {
    const legacyCsv = await fetchTpexLegacyCsvMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      requestOptions
    );
    record("legacy-st43-utf8-csv", legacyCsv);
    if (hasMonthRows(legacyCsv)) {
      fetchContext.tpexPreferredHistoryMode = "csv-legacy";
      if (withDebug && legacyCsv.debug) {
        legacyCsv.debug = { fallbackFrom, recoveryChain: chain, ...legacyCsv.debug };
      }
      return legacyCsv;
    }
    if (["blocked", "error", "temporary_upstream_error"].includes(legacyCsv.kind)) {
      fetchContext.tpexLegacyCsvUnavailable = true;
    }
  }

  // ④ official HTML。
  if (!fetchContext.tpexHtmlUnavailable && (!budget || budget.remaining() > 0)) {
    const html = await fetchTpexHtmlMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      requestOptions
    );
    record("official-html", html);
    if (hasMonthRows(html)) {
      fetchContext.tpexPreferredHistoryMode = "html";
      if (withDebug && html.debug) {
        html.debug = { fallbackFrom, recoveryChain: chain, ...html.debug };
      }
      return html;
    }
    if (["blocked", "error", "temporary_upstream_error"].includes(html.kind)) {
      fetchContext.tpexHtmlUnavailable = true;
    }
  }

  // ⑤ 可選 Relay/Cache，仍只允許回傳 TPEx 官方原始日K。
  if (fetchContext.tpexRelayUrl && (!budget || budget.remaining() > 0)) {
    const relay = await fetchTpexRelayMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      fetchContext,
      requestOptions
    );
    record("relay", relay);
    if (hasMonthRows(relay)) {
      if (withDebug && relay.debug) {
        relay.debug = { fallbackFrom, recoveryChain: chain, ...relay.debug };
      }
      return relay;
    }
  }

  if (withDebug) {
    const detail = {
      mode: "tpex-official-recovery-chain-v2.9.8",
      fallbackFrom,
      recoveryChain: chain
    };
    return emptyOfficialResult(lastResult?.kind || "error", detail);
  }

  return lastResult || emptyOfficialResult("error", null);
}

function extractTpexLegacyRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.aaData)) return payload.aaData;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload?.tables?.[0]?.data)) return payload.tables[0].data;
  return [];
}

function extractTpexLegacyName(payload, stock) {
  const candidates = [
    payload?.name,
    payload?.stkName,
    payload?.stockName,
    payload?.companyName,
    payload?.tables?.[0]?.subtitle
  ];
  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    if (text.includes(stock)) {
      return extractTpexStockName(text, stock) || text;
    }
    return text;
  }
  return null;
}

async function fetchTpexLegacyMonth(
  stock,
  monthKey,
  withDebug = false,
  budget = null,
  requestOptions = {}
) {
  const apiUrl = buildTpexLegacyHistoryUrl(stock, monthKey);
  const detail = {
    mode: "legacy-st43",
    url: apiUrl,
    recovery: !!requestOptions.recovery,
    recoveryRound: requestOptions.recoveryRound || null
  };
  const timeoutMs = requestOptions.timeoutMs || TPEX_HISTORY_TIMEOUT_MS;

  try {
    const response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `TPEx-legacy:${stock}:${monthKey}${requestOptions.recovery ? ":recovery" : ""}`,
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/ch/stock/aftertrading/daily_trading_info/st43.php",
              "application/json,text/plain,*/*"
            )
          },
          timeoutMs
        )
      : await fetchWithTimeout(
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/ch/stock/aftertrading/daily_trading_info/st43.php",
              "application/json,text/plain,*/*"
            ),
            redirect: "manual"
          },
          timeoutMs
        );

    detail.status = response.status;
    detail.location = response.headers.get("Location");

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("Location");
      if (location) {
        const target = new URL(location, apiUrl);
        detail.redirectPath = target.pathname;
        if (/^\/errors(?:\/|$)/i.test(target.pathname)) {
          detail.blockedByOfficialGateway = true;
          return emptyOfficialResult("blocked", withDebug ? detail : null);
        }
      }
    }

    const text = await response.text();
    detail.preview = text.slice(0, 180);

    if (!response.ok || text.trim().startsWith("<")) {
      const blocked =
        response.status === 307 ||
        response.status === 403 ||
        response.status === 429 ||
        /FOR SECURITY REASONS|因為安全性考量/i.test(text);
      return emptyOfficialResult(blocked ? "blocked" : "error", withDebug ? detail : null);
    }

    const payload = JSON.parse(text);
    const rawRows = extractTpexLegacyRows(payload);
    const rows = rawRows.map(parseTpexMarketRow).filter(Boolean);
    detail.rowCount = rows.length;

    return {
      rows,
      name: extractTpexLegacyName(payload, stock),
      kind: rows.length ? "ok" : "empty",
      debug: withDebug ? detail : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);
    return emptyOfficialResult("error", withDebug ? detail : null);
  }
}

function learnTpexHistoryBase(targetUrl) {
  try {
    const u = new URL(targetUrl);
    if (!isAllowedOfficialHost(u.hostname)) return null;
    if (!u.pathname.includes("tradingStock")) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

async function fetchTpexMonth(
  stock,
  monthKey,
  withDebug = false,
  budget = null,
  fetchContext = {},
  requestOptions = {}
) {
  // V2.9.9：只要設定 Relay 就優先讀 Relay。GitHub static relay 同一檔股票的
  // payload 在單次 invocation 內會記憶體快取，因此後續月份不再增加外部 fetch。
  if (fetchContext.tpexRelayUrl && !requestOptions.skipRelay) {
    const relay = await fetchTpexRelayMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      fetchContext,
      requestOptions
    );
    if (hasMonthRows(relay)) return relay;
    // Relay 暫時缺月份時仍保留 TPEx 官方直連 fallback。
    if (fetchContext.tpexPreferredHistoryMode === "relay") {
      fetchContext.tpexPreferredHistoryMode = "modern";
    }
  }

  if (fetchContext.tpexPreferredHistoryMode === "relay" && fetchContext.tpexRelayUrl) {
    const relay = await fetchTpexRelayMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      fetchContext,
      requestOptions
    );
    if (hasMonthRows(relay)) return relay;
    fetchContext.tpexPreferredHistoryMode = "modern";
  }

  if (fetchContext.tpexPreferredHistoryMode === "csv-modern") {
    const csv = await fetchTpexCsvMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      requestOptions,
      "zh-tw"
    );
    if (hasMonthRows(csv)) return csv;
    fetchContext.tpexModernCsvUnavailable = true;
    fetchContext.tpexPreferredHistoryMode = "legacy";
    return fetchTpexLegacyThenHtml(
      stock,
      monthKey,
      withDebug,
      budget,
      fetchContext,
      requestOptions,
      csv.debug || null
    );
  }

  if (fetchContext.tpexPreferredHistoryMode === "csv-legacy") {
    const csv = await fetchTpexLegacyCsvMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      requestOptions
    );
    if (hasMonthRows(csv)) return csv;
    fetchContext.tpexLegacyCsvUnavailable = true;
    fetchContext.tpexPreferredHistoryMode = "html";
    return fetchTpexLegacyThenHtml(
      stock,
      monthKey,
      withDebug,
      budget,
      fetchContext,
      requestOptions,
      csv.debug || null
    );
  }

  if (fetchContext.tpexPreferredHistoryMode === "html") {
    const html = await fetchTpexHtmlMonth(
      stock,
      monthKey,
      withDebug,
      budget,
      requestOptions
    );
    if (hasMonthRows(html)) {
      fetchContext.tpexPreferredHistoryMode = "html";
      return html;
    }
    fetchContext.tpexHtmlUnavailable = true;
    if (fetchContext.tpexRelayUrl && (!budget || budget.remaining() > 0)) {
      const relay = await fetchTpexRelayMonth(
        stock, monthKey, withDebug, budget, fetchContext, requestOptions
      );
      if (hasMonthRows(relay)) return relay;
    }
    return html;
  }

  if (fetchContext.tpexPreferredHistoryMode === "legacy") {
    return fetchTpexLegacyThenHtml(
      stock,
      monthKey,
      withDebug,
      budget,
      fetchContext,
      requestOptions
    );
  }

  const apiUrl = buildTpexHistoryUrl(
    stock,
    monthKey,
    fetchContext.tpexLearnedHistoryBase
  );
  const detail = {
    mode: "modern-tradingStock",
    url: apiUrl,
    redirectStatus: null,
    redirectLocation: null,
    redirectFollowed: false,
    recovery: !!requestOptions.recovery,
    recoveryRound: requestOptions.recoveryRound || null
  };
  const timeoutMs = requestOptions.timeoutMs || TPEX_HISTORY_TIMEOUT_MS;

  try {
    let response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `TPEx:${stock}:${monthKey}${requestOptions.recovery ? ":recovery" : ""}`,
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
              "application/json,text/plain,*/*"
            )
          },
          timeoutMs
        )
      : await fetchWithTimeout(
          apiUrl,
          {
            headers: browserLikeHeaders(
              "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
              "application/json,text/plain,*/*"
            ),
            redirect: "manual"
          },
          timeoutMs
        );

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("Location");
      detail.redirectStatus = response.status;
      detail.redirectLocation = location;

      if (location) {
        const target = new URL(location, apiUrl);
        detail.redirectHost = target.hostname;
        detail.redirectPath = target.pathname;

        if (
          isAllowedOfficialHost(target.hostname) &&
          /^\/errors(?:\/|$)/i.test(target.pathname)
        ) {
          detail.blockedByOfficialGateway = true;
          fetchContext.tpexPreferredHistoryMode = "legacy";
          fetchContext.tpexOpenApiBlocked = true;

          if (!budget || budget.remaining() > 0) {
            return fetchTpexLegacyThenHtml(
              stock,
              monthKey,
              withDebug,
              budget,
              fetchContext,
              requestOptions,
              detail
            );
          }

          return emptyOfficialResult("blocked", withDebug ? detail : null);
        }

        if (
          isAllowedOfficialHost(target.hostname) &&
          (!budget || budget.remaining() > 0)
        ) {
          const learned = learnTpexHistoryBase(target.toString());
          if (learned) fetchContext.tpexLearnedHistoryBase = learned;
          await sleep(TPEX_REDIRECT_BACKOFF_MS);
          response = budget
            ? await budgetedFetchWithTimeout(
                budget,
                `TPEx:${stock}:${monthKey}:redirect`,
                target.toString(),
                {
                  headers: browserLikeHeaders(
                    "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
                    "application/json,text/plain,*/*"
                  )
                },
                timeoutMs
              )
            : await fetchWithTimeout(
                target.toString(),
                {
                  headers: browserLikeHeaders(
                    "https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html",
                    "application/json,text/plain,*/*"
                  ),
                  redirect: "manual"
                },
                timeoutMs
              );
          detail.redirectFollowed = true;
          detail.finalUrl = target.toString();
        }
      }
    }

    const text = await response.text();
    detail.status = response.status;
    detail.preview = text.slice(0, 180);

    if (!response.ok || text.trim().startsWith("<")) {
      const temporaryUpstream =
        response.status >= 500 &&
        response.status <= 599;
      const blocked =
        response.status === 307 ||
        response.status === 403 ||
        response.status === 429 ||
        /FOR SECURITY REASONS|因為安全性考量/i.test(text);

      if ((blocked || temporaryUpstream) && (!budget || budget.remaining() > 0)) {
        if (blocked) fetchContext.tpexOpenApiBlocked = true;
        fetchContext.tpexPreferredHistoryMode = "legacy";
        return fetchTpexLegacyThenHtml(
          stock,
          monthKey,
          withDebug,
          budget,
          fetchContext,
          requestOptions,
          detail
        );
      }

      return emptyOfficialResult(
        blocked
          ? "blocked"
          : temporaryUpstream
            ? "temporary_upstream_error"
            : "error",
        withDebug ? detail : null
      );
    }

    const payload = JSON.parse(text);
    const table = Array.isArray(payload?.tables) ? payload.tables[0] : null;
    const data = Array.isArray(table?.data) ? table.data : [];
    const stat = String(payload?.stat || "").toLowerCase();

    if (!table || (stat && stat !== "ok") || !data.length) {
      return emptyOfficialResult(
        "empty",
        withDebug
          ? {
              ...detail,
              stat: payload?.stat || null,
              title: table?.title || null,
              subtitle: table?.subtitle || null
            }
          : null
      );
    }

    const rows = data.map(parseTpexMarketRow).filter(Boolean);
    if (rows.length > 0) {
      fetchContext.tpexPreferredHistoryMode = "modern";
    }

    return {
      rows,
      name: payload?.name || extractTpexStockName(table?.subtitle, stock),
      kind: rows.length ? "ok" : "empty",
      debug: withDebug
        ? {
            ...detail,
            rowCount: rows.length,
            stat: payload?.stat || null,
            title: table?.title || null,
            subtitle: table?.subtitle || null
          }
        : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);

    if (!budget || budget.remaining() > 0) {
      fetchContext.tpexPreferredHistoryMode = "legacy";
      return fetchTpexLegacyThenHtml(
        stock,
        monthKey,
        withDebug,
        budget,
        fetchContext,
        requestOptions,
        detail
      );
    }

    return emptyOfficialResult("error", withDebug ? detail : null);
  }
}

function buildOfficialDebug(phases, monthMap, market) {
  const allRequested = uniqueSortedMonthKeys(
    phases.flatMap(phase => phase.requestedKeys || [])
  );
  const allSuccessful = uniqueSortedMonthKeys(
    [...monthMap.entries()]
      .filter(([, value]) => hasMonthRows(value))
      .map(([key]) => key)
  );
  const providers = new Set();
  for (const value of monthMap.values()) {
    if (hasMonthRows(value)) providers.add(value.provider || market);
  }

  return {
    primaryMarket: market,
    requestedMonths: allRequested,
    requestedCount: allRequested.length,
    fetchedCount: allSuccessful.length,
    providersUsed: [...providers],
    missingMonths: allRequested.filter(key => !hasMonthRows(monthMap.get(key))),
    phases: phases.map(phase => ({
      phase: phase.phase,
      requestedMonths: phase.requestedKeys || [],
      successfulMonths: phase.successfulKeys || [],
      missingMonths: phase.missingKeys || [],
      attempts: phase.attempts || []
    }))
  };
}

function buildMonthlyRegimeTimelineDebug(monthMap, currentMonthKey) {
  const contiguousKeys = getContiguousSuccessfulMonthKeysEndingAt(
    monthMap,
    currentMonthKey,
    MAX_DYNAMIC_OFFICIAL_MONTHS
  );

  if (!contiguousKeys.length) {
    return {
      windowStart: null,
      windowEnd: currentMonthKey || null,
      monthsAvailable: 0,
      evaluableMonths: 0,
      firstEvaluableMonth: null,
      state: null,
      transitions: [],
      timeline: []
    };
  }

  const bars = buildMonthlyBarsFromMonthMap(contiguousKeys, monthMap);
  attachMonthlyIndicators(bars);

  const timeline = [];
  const transitions = [];
  let previousEvaluablePass = null;
  let previousEvaluableMonth = null;

  for (const month of bars) {
    const evaluable = month.ma20 !== null;
    const pass = evaluable
      ? isMonthlyPass(month.close, month.ma20)
      : null;

    let transition = null;

    if (evaluable && previousEvaluablePass !== null) {
      if (previousEvaluablePass === true && pass === false) {
        transition = {
          type: "break",
          label: "首次由月20MA上方轉為下方",
          previousMonth: previousEvaluableMonth?.key || null,
          previousPass: true,
          currentPass: false
        };
      } else if (previousEvaluablePass === false && pass === true) {
        transition = {
          type: "start",
          label: "由月20MA下方重新站上",
          previousMonth: previousEvaluableMonth?.key || null,
          previousPass: false,
          currentPass: true
        };
      }
    }

    const item = {
      month: month.key,
      open: round(month.open, 2),
      high: round(month.high, 2),
      low: round(month.low, 2),
      close: round(month.close, 2),
      ma20: round(month.ma20, 2),
      evaluable,
      pass,
      transition,
      provider: month.provider || null
    };

    timeline.push(item);

    if (transition) {
      transitions.push({
        month: month.key,
        close: round(month.close, 2),
        ma20: round(month.ma20, 2),
        ...transition
      });
    }

    if (evaluable) {
      previousEvaluablePass = pass;
      previousEvaluableMonth = month;
    }
  }

  const state = analyzeOfficialRegimeState(bars);

  return {
    rule:
      "V40 僅供除錯檢查：使用一路連到最新月、最多56個官方連續月份，逐月顯示官方開高低收、20月均線、是否通過與條件轉折；此欄位不參與正式計算。",
    windowStart: contiguousKeys[0],
    windowEnd: contiguousKeys[contiguousKeys.length - 1],
    monthsAvailable: bars.length,
    evaluableMonths: timeline.filter(item => item.evaluable).length,
    firstEvaluableMonth:
      timeline.find(item => item.evaluable)?.month || null,
    state: {
      currentPass: state.currentPass,
      startMonth: state.startMonth?.key || null,
      startConfirmed: !!state.startConfirmed,
      previousBreakMonth: state.previousBreakMonth?.key || null,
      latestBelowMonth: state.latestBelowMonth?.key || null,
      previousSegmentStart: state.previousSegmentStart?.key || null
    },
    transitions,
    timeline
  };
}

function analyzeOfficialRegimeState(bars) {
  const months = [...(bars || [])].sort((a, b) => a.key.localeCompare(b.key));
  attachMonthlyIndicators(months);
  const evaluable = months.filter(month => month.ma20 !== null);

  if (!evaluable.length) {
    return {
      currentPass: null,
      startMonth: null,
      startConfirmed: false,
      previousBreakMonth: null,
      latestBelowMonth: null,
      previousSegmentStart: null,
      firstEvaluableMonth: null
    };
  }

  let previousPass = null;
  let activeStart = null;
  let activePreviousBreak = null;
  let lastBreak = null;
  let latestBelow = null;
  let previousSegmentStart = null;

  for (const month of evaluable) {
    const pass = isMonthlyPass(month.close, month.ma20);

    if (previousPass === null) {
      previousPass = pass;
      if (!pass) latestBelow = month;
      continue;
    }

    if (previousPass === true && pass === false) {
      lastBreak = month;
      latestBelow = month;
      if (activeStart) previousSegmentStart = activeStart;
      activeStart = null;
      activePreviousBreak = null;
    } else if (previousPass === false && pass === true) {
      activeStart = month;
      activePreviousBreak = lastBreak;
    } else if (!pass) {
      latestBelow = month;
    }

    previousPass = pass;
  }

  const latest = evaluable[evaluable.length - 1];
  const currentPass = isMonthlyPass(latest.close, latest.ma20);

  return {
    currentPass,
    startMonth: currentPass ? activeStart : null,
    startConfirmed: currentPass && !!activeStart,
    previousBreakMonth:
      currentPass && activeStart ? activePreviousBreak : lastBreak,
    latestBelowMonth: currentPass ? latestBelow : latest,
    previousSegmentStart,
    firstEvaluableMonth: evaluable[0],
    latestMonth: latest,
    evaluableMonths: evaluable
  };
}


function selectScanLiteMonthlyFetchKeysV29132(monthKeys, monthMap, limit = 1) {
  const max = Math.max(0, Math.floor(Number(limit) || 0));
  if (!max) return [];

  // 從最新月份往回補：跨月時優先只補新月份；
  // 冷快取時每次 invocation 也只推進一個月，絕不一次20月。
  const missing = uniqueSortedMonthKeys(monthKeys)
    .filter(key => !hasMonthRows(monthMap.get(key)))
    .sort((a, b) => b.localeCompare(a));

  return missing.slice(0, max).sort((a, b) => a.localeCompare(b));
}

function analyzeCachedOfficialStartV29132(monthMap, currentMonthKey) {
  const contiguousKeys = getContiguousSuccessfulMonthKeysEndingAt(
    monthMap,
    currentMonthKey,
    MAX_DYNAMIC_OFFICIAL_MONTHS
  );

  if (!contiguousKeys.length) {
    return {
      confirmed: false,
      state: null,
      verification: {
        type: "scan-lite-cache-only-dynamic-start",
        candidate: null,
        confirmed: false,
        reason: "SCAN_LITE 快取中沒有可用的官方連續月份；不啟動網路動態回溯。"
      },
      debug: { mode: "cache-only", monthsAvailable: 0 }
    };
  }

  const bars = buildMonthlyBarsFromMonthMap(contiguousKeys, monthMap);
  const state = analyzeOfficialRegimeState(bars);

  if (state.startConfirmed && state.currentPass) {
    return {
      confirmed: true,
      state,
      verification: {
        type: "scan-lite-cache-only-dynamic-start",
        candidate: state.startMonth.key,
        confirmed: true,
        month: state.startMonth,
        previousMonth: findMonthByKey(
          state.evaluableMonths,
          shiftMonthKey(state.startMonth.key, -1)
        ),
        prePreviousMonth: findMonthByKey(
          state.evaluableMonths,
          shiftMonthKey(state.startMonth.key, -2)
        ),
        reason: "SCAN_LITE 以既有官方月K持久快取確認低於20MA→重新站上的有效起始月；未新增網路請求。"
      },
      debug: {
        mode: "cache-only",
        monthsAvailable: bars.length,
        evaluableMonths: state.evaluableMonths?.length || 0,
        startMonth: state.startMonth?.key || null
      }
    };
  }

  return {
    confirmed: false,
    state,
    verification: {
      type: "scan-lite-cache-only-dynamic-start",
      candidate: null,
      confirmed: false,
      reason: state.currentPass
        ? "目前月K在20MA上方，但既有官方月K快取尚不足以證明有效起始轉折；SCAN_LITE 保持待確認，不做網路回溯。"
        : "官方快取顯示最新月線目前未通過20MA條件。"
    },
    debug: {
      mode: "cache-only",
      monthsAvailable: bars.length,
      evaluableMonths: state.evaluableMonths?.length || 0,
      currentPass: state.currentPass,
      startMonth: state.startMonth?.key || null
    }
  };
}

async function findActiveStartByDynamicOfficialBackfill({
  stock,
  market,
  currentMonthKey,
  monthMap,
  budget,
  debugMode,
  fetchContext,
  phases
}) {
  const rounds = [];

  while (true) {
    const contiguousKeys = getContiguousSuccessfulMonthKeysEndingAt(
      monthMap,
      currentMonthKey,
      MAX_DYNAMIC_OFFICIAL_MONTHS
    );

    if (!contiguousKeys.length) {
      return {
        confirmed: false,
        state: null,
        verification: {
          type: "dynamic-start",
          candidate: null,
          confirmed: false,
          reason: "沒有可用的官方連續月份可進行動態回溯。"
        },
        debug: { rounds, reason: "no contiguous official months" }
      };
    }

    const earliest = contiguousKeys[0];
    const bars = buildMonthlyBarsFromMonthMap(contiguousKeys, monthMap);
    const state = analyzeOfficialRegimeState(bars);

    rounds.push({
      earliestMonth: earliest,
      monthsAvailable: bars.length,
      evaluableMonths: state.evaluableMonths?.length || 0,
      currentPass: state.currentPass,
      startMonth: state.startMonth?.key || null,
      previousBreakMonth: state.previousBreakMonth?.key || null,
      budgetRemaining: budget.remaining()
    });

    if (state.startConfirmed && state.currentPass) {
      return {
        confirmed: true,
        state,
        verification: {
          type: "dynamic-start",
          candidate: state.startMonth.key,
          confirmed: true,
          month: state.startMonth,
          previousMonth: findMonthByKey(
            state.evaluableMonths,
            shiftMonthKey(state.startMonth.key, -1)
          ),
          prePreviousMonth: findMonthByKey(
            state.evaluableMonths,
            shiftMonthKey(state.startMonth.key, -2)
          ),
          reason: "官方連續月份動態回溯已找到可證明的低於20MA→重新站上轉折。"
        },
        debug: { rounds, reason: "confirmed" }
      };
    }

    if (!state.currentPass) {
      return {
        confirmed: false,
        state,
        verification: {
          type: "dynamic-start",
          candidate: null,
          confirmed: false,
          reason: "官方最新月已不在20MA上方，不建立有效起始月。"
        },
        debug: { rounds, reason: "latest inactive" }
      };
    }

    if (contiguousKeys.length >= MAX_DYNAMIC_OFFICIAL_MONTHS) {
      return {
        confirmed: false,
        state,
        verification: {
          type: "dynamic-start",
          candidate: null,
          confirmed: false,
          reason: `已回溯 ${contiguousKeys.length} 個官方連續月份仍找不到可證明的起始轉折。`
        },
        debug: { rounds, reason: "max dynamic months reached" }
      };
    }

    if (budget.remaining() <= 2) {
      return {
        confirmed: false,
        state,
        verification: {
          type: "dynamic-start",
          candidate: null,
          confirmed: false,
          reason: "本次Cloudflare external subrequest預算不足；已保存成功官方月份，下次會由目前進度繼續補。"
        },
        debug: { rounds, reason: "budget exhausted; progressive cache saved" }
      };
    }

    const step = Math.min(
      DYNAMIC_BACKFILL_STEP_MONTHS,
      MAX_DYNAMIC_OFFICIAL_MONTHS - contiguousKeys.length,
      Math.max(1, budget.remaining() - 2)
    );

    const olderKeys = [];
    for (let i = step; i >= 1; i--) {
      olderKeys.push(shiftMonthKey(earliest, -i));
    }

    const phase = await fetchOfficialMonthSetSequential(
      stock,
      market,
      olderKeys,
      monthMap,
      budget,
      debugMode,
      fetchContext,
      `dynamic-backfill-${rounds.length}`
    );
    phases.push(phase);

    if (phase.missingKeys.length > 0) {
      await recoverMissingOfficialMonths({
        stock,
        market,
        monthKeys: olderKeys,
        monthMap,
        budget,
        debugMode,
        fetchContext,
        phases,
        phaseBase: `dynamic-backfill-${rounds.length}-recovery`,
        maxRounds: 1,
        reserveBudget: 2
      });
    }

    const remainingMissing = olderKeys.filter(
      key => !hasMonthRows(monthMap.get(key))
    );

    if (remainingMissing.length > 0) {
      return {
        confirmed: false,
        state,
        verification: {
          type: "dynamic-start",
          candidate: null,
          confirmed: false,
          missingMonths: remainingMissing,
          reason: "本次動態回溯仍有官方月份暫時抓不到；已保存其他成功月份，下次只補這些缺月。"
        },
        debug: {
          rounds,
          reason: "backfill pending; progressive cache saved",
          missing: remainingMissing
        }
      };
    }
  }
}

function findMonthByKey(months, key) {
  return Array.isArray(months)
    ? months.find(month => month.key === key) || null
    : null;
}

function getMonthKeysBetween(startKey, endKey) {
  const result = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 240) {
    result.push(cursor);
    if (cursor === endKey) break;
    cursor = shiftMonthKey(cursor, 1);
    guard += 1;
  }
  return result;
}

async function fetchYahooHistory(symbol, monthsBack, withDebug = false, budget = null) {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1)
  );
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const apiUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}` +
    `&period2=${period2}` +
    "&interval=1d" +
    "&events=history" +
    "&includeAdjustedClose=false";
  const detail = { url: apiUrl };

  try {
    const response = budget
      ? await budgetedFetchWithTimeout(
          budget,
          `Yahoo-locator:${symbol}`,
          apiUrl,
          { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }
        )
      : await fetchWithTimeout(apiUrl, {
          headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
          redirect: "manual"
        });

    const text = await response.text();
    detail.status = response.status;
    detail.preview = text.slice(0, 180);

    if (!response.ok || text.trim().startsWith("<")) {
      return { rows: [], name: null, symbol, debug: withDebug ? detail : undefined };
    }

    const payload = JSON.parse(text);
    const result = payload?.chart?.result?.[0];
    if (!result) {
      detail.chartError = payload?.chart?.error || null;
      return { rows: [], name: null, symbol, debug: withDebug ? detail : undefined };
    }

    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const quote = result?.indicators?.quote?.[0] || {};
    const rows = [];

    for (let i = 0; i < timestamps.length; i++) {
      const open = numberOrNull(quote.open?.[i]);
      const high = numberOrNull(quote.high?.[i]);
      const low = numberOrNull(quote.low?.[i]);
      const close = numberOrNull(quote.close?.[i]);
      const volume = numberOrNull(quote.volume?.[i]);
      if (open === null || high === null || low === null || close === null) continue;

      const d = new Date(timestamps[i] * 1000);
      const date =
        `${d.getUTCFullYear()}-` +
        `${String(d.getUTCMonth() + 1).padStart(2, "0")}-` +
        `${String(d.getUTCDate()).padStart(2, "0")}`;
      rows.push({ date, open, high, low, close, volume, volumeAdapter:'YAHOO_CHART' });
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    detail.rowCount = rows.length;
    return {
      rows,
      name: result?.meta?.longName || result?.meta?.shortName || null,
      symbol,
      debug: withDebug ? detail : undefined
    };
  } catch (error) {
    detail.error = error?.message || String(error);
    return { rows: [], name: null, symbol, debug: withDebug ? detail : undefined };
  }
}

function buildMonthlyLocatorState(rows) {
  const monthly = buildMonthlyBarsFromDailyRows(getCompletedDailyRows(rows));
  attachMonthlyIndicators(monthly);
  const window = monthly.slice(-MAIN_HISTORY_MONTHS).filter(month => month.ma20 !== null);

  if (!window.length) {
    return {
      currentPass: null,
      currentStartCandidate: null,
      currentBreakCandidate: null,
      previousBreakCandidate: null,
      boundaryAmbiguous: true
    };
  }

  let prevPass = null;
  let belowRunStart = null;
  let currentStartCandidate = null;
  let currentPreviousBreakCandidate = null;
  let lastBreakCandidate = null;
  let boundaryAmbiguous = false;

  window.forEach((month, index) => {
    const pass = isMonthlyPass(month.close, month.ma20);

    if (index === 0) {
      prevPass = pass;
      if (pass) boundaryAmbiguous = true;
      return;
    }

    if (!pass && prevPass === true) {
      belowRunStart = month.key;
      lastBreakCandidate = month.key;
    }

    if (pass && prevPass === false) {
      currentStartCandidate = month.key;
      currentPreviousBreakCandidate = belowRunStart;
      belowRunStart = null;
      boundaryAmbiguous = false;
    }

    prevPass = pass;
  });

  const currentPass = isMonthlyPass(window[window.length - 1].close, window[window.length - 1].ma20);

  if (currentPass && !currentStartCandidate) boundaryAmbiguous = true;

  return {
    currentPass,
    currentStartCandidate: currentPass ? currentStartCandidate : null,
    currentBreakCandidate: currentPass ? null : lastBreakCandidate,
    previousBreakCandidate: currentPass ? currentPreviousBreakCandidate : null,
    boundaryAmbiguous
  };
}

function verifyOfficialTransition(monthMap, candidateKey, type) {
  if (!candidateKey) {
    return { type, candidate: null, confirmed: false, reason: "candidate missing" };
  }

  const keys = getMonthKeysEndingAt(candidateKey, CANDIDATE_VERIFY_MONTHS);
  const missing = keys.filter(key => !hasMonthRows(monthMap.get(key)));
  if (missing.length) {
    return {
      type,
      candidate: candidateKey,
      confirmed: false,
      missingMonths: missing,
      reason: "官方候選驗證窗口資料不完整"
    };
  }

  const bars = buildMonthlyBarsFromMonthMap(keys, monthMap);
  attachMonthlyIndicators(bars);
  const candidate = bars.find(month => month.key === candidateKey) || null;
  const previousKey = shiftMonthKey(candidateKey, -1);
  const prePreviousKey = shiftMonthKey(candidateKey, -2);
  const previous = bars.find(month => month.key === previousKey) || null;
  const prePrevious = bars.find(month => month.key === prePreviousKey) || null;

  if (!candidate || !previous || candidate.ma20 === null || previous.ma20 === null) {
    return {
      type,
      candidate: candidateKey,
      confirmed: false,
      reason: "候選月或前月無法建立官方20MA"
    };
  }

  const candidatePass = isMonthlyPass(candidate.close, candidate.ma20);
  const previousPass = isMonthlyPass(previous.close, previous.ma20);
  const confirmed = type === "start"
    ? (!previousPass && candidatePass)
    : (previousPass && !candidatePass);

  return {
    type,
    candidate: candidateKey,
    confirmed,
    month: candidate,
    previousMonth: previous,
    prePreviousMonth: prePrevious,
    reason: confirmed
      ? (type === "start" ? "官方確認前月低於20MA、候選月重新站上" : "官方確認前月仍在20MA上、候選月首次跌破")
      : "候選定位與官方原始月收盤／20MA轉折不一致"
  };
}

function verifyBreakCandidateFromMap(monthMap, candidateKey) {
  if (!candidateKey) return null;
  const keys = getMonthKeysEndingAt(candidateKey, CANDIDATE_VERIFY_MONTHS);
  if (keys.some(key => !hasMonthRows(monthMap.get(key)))) return null;

  const bars = buildMonthlyBarsFromMonthMap(keys, monthMap);
  attachMonthlyIndicators(bars);
  const current = bars.find(month => month.key === candidateKey) || null;
  const prev = bars.find(month => month.key === shiftMonthKey(candidateKey, -1)) || null;
  if (!current || !prev || current.ma20 === null || prev.ma20 === null) return null;

  return isMonthlyPass(prev.close, prev.ma20) && !isMonthlyPass(current.close, current.ma20)
    ? current
    : null;
}

function attachMonthlyIndicators(months) {
  if (!Array.isArray(months)) return months;
  const closes = months.map(month => month.close);
  const rsiSeries = calculateRSISeries(closes, RSI_PERIOD);

  for (let i = 0; i < months.length; i++) {
    months[i].rsi5 = rsiSeries[i] ?? null;
    if (i < MONTHLY_MA_WARMUP_MONTHS) {
      months[i].ma20 = null;
      months[i].aboveMA = false;
      continue;
    }
    const ma20 = average(months.slice(i - MONTHLY_MA_WARMUP_MONTHS, i + 1).map(month => month.close));
    months[i].ma20 = ma20;
    months[i].aboveMA = isMonthlyPass(months[i].close, ma20);
  }
  return months;
}

function buildMonthlyBarsFromMonthMap(monthKeys, monthMap) {
  const result = [];
  for (const key of monthKeys) {
    const item = monthMap.get(key);
    if (!hasMonthRows(item)) continue;
    const rows = getCompletedDailyRows(item.rows);
    if (!rows.length) continue;
    const bar = makeMonthlyBar(key, rows);
    bar.provider = item.provider || null;
    result.push(bar);
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

function collectDailyRowsFromMonthMap(monthKeys, monthMap) {
  const rows = [];
  for (const key of monthKeys) {
    const item = monthMap.get(key);
    if (!hasMonthRows(item)) continue;
    rows.push(...item.rows);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function summarizeMonthlyBar(month) {
  if (!month) return null;
  return {
    month: month.key,
    open: round(month.open, 2),
    high: round(month.high, 2),
    low: round(month.low, 2),
    close: round(month.close, 2),
    ma20: round(month.ma20, 2),
    pass: month.ma20 !== null ? isMonthlyPass(month.close, month.ma20) : null,
    rsi5: round(month.rsi5, 2),
    provider: month.provider || null
  };
}

function serializeVerification(value) {
  if (!value) return null;
  return {
    type: value.type || null,
    candidate: value.candidate || null,
    confirmed: !!value.confirmed,
    reason: value.reason || null,
    missingMonths: value.missingMonths || [],
    prePreviousMonth: summarizeMonthlyBar(value.prePreviousMonth),
    previousMonth: summarizeMonthlyBar(value.previousMonth),
    month: summarizeMonthlyBar(value.month)
  };
}

function getMonthKeysEndingAt(endKey, count) {
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(shiftMonthKey(endKey, -i));
  }
  return result;
}

function shiftMonthKey(key, offset) {
  const year = Number(String(key).slice(0, 4));
  const month = Number(String(key).slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function uniqueSortedMonthKeys(keys) {
  return [...new Set(keys.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function hasMonthRows(item) {
  return !!item && Array.isArray(item.rows) && item.rows.length > 0;
}

function emptyOfficialResult(kind = "empty", debug = null) {
  return {
    rows: [],
    name: null,
    kind,
    debug: debug || undefined
  };
}

function isMonthlyPass(close, ma20) {
  if (!Number.isFinite(close) || !Number.isFinite(ma20)) return false;
  const tolerance = Math.max(1e-9, Math.abs(ma20) * 1e-12);
  return close + tolerance >= ma20;
}

function providerLabel(provider) {
  if (provider === "TWSE") return "TWSE";
  if (provider === "TPEx") return "TPEx";
  return "Official";
}

function parseTwseMarketRow(row) {
  if (!Array.isArray(row) || row.length < 7) return null;

  const date = marketDateToISO(row[0]);
  const volume = parseVolume(row[1]);
  const open = parsePrice(row[3]);
  const high = parsePrice(row[4]);
  const low = parsePrice(row[5]);
  const close = parsePrice(row[6]);

  if (!date || open === null || high === null || low === null || close === null) {
    return null;
  }

  return { date, open, high, low, close, volume, volumeAdapter:'TWSE_STOCK_DAY' };
}

function parseTpexMarketRow(row) {
  if (!Array.isArray(row) || row.length < 7) return null;

  const date = marketDateToISO(row[0]);
  const lots = parseVolume(row[1]);
  const volume = lots === null ? null : lots * 1000;
  const open = parsePrice(row[3]);
  const high = parsePrice(row[4]);
  const low = parsePrice(row[5]);
  const close = parsePrice(row[6]);

  if (!date || open === null || high === null || low === null || close === null) {
    return null;
  }

  return { date, open, high, low, close, volume, volumeAdapter:'TPEX_DAILY_HISTORY' };
}

function buildMonthlyBarsFromDailyRows(rows) {
  const grouped = new Map();

  for (const row of rows) {
    if (!isValidDailyRow(row)) continue;

    const key = row.date.slice(0, 7).replace("-", "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return [...grouped.entries()]
    .map(([key, monthRows]) => {
      monthRows.sort((a, b) => a.date.localeCompare(b.date));
      return makeMonthlyBar(key, monthRows);
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function makeMonthlyBar(key, monthRows) {
  return {
    key,
    open: monthRows[0].open,
    high: Math.max(...monthRows.map(row => row.high)),
    low: Math.min(...monthRows.map(row => row.low)),
    close: monthRows[monthRows.length - 1].close,
    rows: monthRows
  };
}

// CLOSED-BAR.1: exchange-confirmed closures, never inferred from missing quotes.
// Annual calendar: https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule
// Emergency 2026-10-23: https://eshop.twse.com.tw/zh/home/index
const VERIFIED_TWSE_CLOSED_DATES_CB1 = new Set([
 '2026-01-01','2026-02-12','2026-02-13','2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
 '2026-02-27','2026-02-28','2026-04-03','2026-04-04','2026-04-05','2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-09-28',
 '2026-10-09','2026-10-10','2026-10-23','2026-10-25','2026-10-26','2026-12-25'
]);
function isTaiwanTradingWeekdayIsoDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return false;
  const weekday = date.getUTCDay();
  return weekday >= 1 && weekday <= 5 && !VERIFIED_TWSE_CLOSED_DATES_CB1.has(String(value));
}

function isValidDailyRow(row) {
  return (
    row &&
    typeof row.date === "string" &&
    isTaiwanTradingWeekdayIsoDate(row.date) &&
    Number.isFinite(row.open) &&
    Number.isFinite(row.high) &&
    Number.isFinite(row.low) &&
    Number.isFinite(row.close)
  );
}

function marketDateToISO(value) {
  const text = String(value || "").trim();

  let match = text.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    return (
      `${Number(match[1]) + 1911}-` +
      `${String(match[2]).padStart(2, "0")}-` +
      `${String(match[3]).padStart(2, "0")}`
    );
  }

  match = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (match) {
    return (
      `${match[1]}-` +
      `${String(match[2]).padStart(2, "0")}-` +
      `${String(match[3]).padStart(2, "0")}`
    );
  }

  return null;
}

function parsePrice(value) {
  if (value === null || value === undefined) return null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[＋+]/g, "")
    .replace(/[－−]/g, "-")
    .trim();

  if (cleaned === "" || cleaned === "--" || cleaned === "---" || cleaned === "N/A") {
    return null;
  }

  return numberOrNull(cleaned);
}

function parseVolume(value) {
  if (value === null || value === undefined) return null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .trim();

  if (cleaned === "" || cleaned === "--" || cleaned === "---" || cleaned === "N/A") {
    return null;
  }

  const parsed = numberOrNull(cleaned);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function extractTwseStockName(title, stock) {
  const text = String(title || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;

  const regex = new RegExp(
    `${escapeRegExp(stock)}\\s+(.+?)(?:\\s+各日成交資訊|\\s+個股日成交資訊|$)`
  );

  const match = text.match(regex);
  if (match && match[1]) return match[1].trim();

  const index = text.indexOf(stock);
  if (index === -1) return null;

  return (
    text
      .slice(index + stock.length)
      .replace(/各日成交資訊.*$/u, "")
      .replace(/個股日成交資訊.*$/u, "")
      .trim() || null
  );
}

function extractTpexStockName(subtitle, stock) {
  const text = String(subtitle || "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const index = text.indexOf(stock);
  if (index === -1) return null;

  const remainder = text.slice(index + stock.length).trim();
  const cleaned = remainder
    .replace(/\s+\d{2,3}年\d{1,2}月.*$/u, "")
    .replace(/\s+\d{4}年\d{1,2}月.*$/u, "")
    .trim();

  return cleaned || null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRecentMonthKeys(count, anchorIsoDate = null) {
  let year = null;
  let month = null;

  const anchorMonthKey = monthKeyFromIsoDateV29131(anchorIsoDate);
  if (anchorMonthKey) {
    year = Number(anchorMonthKey.slice(0, 4));
    month = Number(anchorMonthKey.slice(4, 6));
  }

  // 無可靠「最新完成交易日」時，完整保留舊版行為作為容錯。
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const parts = (taipeiMonthFormatterV29141 ||= new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit"
    })).formatToParts(new Date());

    year = Number(parts.find(part => part.type === "year")?.value);
    month = Number(parts.find(part => part.type === "month")?.value);
  }

  const result = [];

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    result.push(
      `${date.getUTCFullYear()}` +
      `${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }

  return result;
}

// V2.9.13.1：僅取「最新完成交易日」，不做 sort/filter 複製，
// 避免為了修跨月邊界反而增加 SCAN_LITE 的 Free Worker CPU 負擔。
function getLatestCompletedTradingDateFromRowsV29131(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;

  const now = getTaipeiDateTimeParts();
  const cutoffMinutes =
    TAIWAN_COMPLETED_BAR_HOUR * 60 + TAIWAN_COMPLETED_BAR_MINUTE;
  const currentMinutes = now.hour * 60 + now.minute;

  let latestDate = null;

  for (const row of rows) {
    if (!isValidDailyRow(row)) continue;

    const date = String(row.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date > now.date) continue;

    // 今天的日K在既有 completed-bar cutoff 前，不可拿來推進月線月份。
    if (date === now.date && currentMinutes < cutoffMinutes) continue;

    if (!latestDate || date > latestDate) latestDate = date;
  }

  return latestDate;
}

function monthKeyFromIsoDateV29131(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;

  return `${match[1]}${match[2]}`;
}

function calculateRSISeries(closes, period = 5) {
  const result = Array(closes.length).fill(null);

  if (!Array.isArray(closes) || closes.length < period + 1) return result;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = rsiFromAverages(avgGain, avgLoss);
  }

  return result;
}

function rsiFromAverages(avgGain, avgLoss) {
  if (avgLoss === 0 && avgGain === 0) return 50;
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function serializeDailySeriesForFrontend(rows, limit = DAILY_SERIES_RETURN_BARS) {
  const completed = getCompletedDailyRows(rows);
  const maxBars = Math.max(
    DAILY_SERIES_MIN_RECOMMENDED_BARS,
    Math.min(DAILY_SERIES_RETURN_BARS, Number(limit) || DAILY_SERIES_RETURN_BARS)
  );

  // 三叉戟一定需要 Volume，因此只輸出真正完整的 OHLCV。
  // 正常 TWSE / Yahoo / MIS 日線都應具有 volume；若資料源某日缺 volume，
  // 寧可不把不完整日K冒充成 OHLCV。
  const valid = completed.filter(
    row =>
      isValidDailyRow(row) &&
      Number.isFinite(row.volume) &&
      row.volume >= 0
  );

  return valid.slice(-maxBars).map(row => ({
    date: row.date,
    open: round(row.open, 2),
    high: round(row.high, 2),
    low: round(row.low, 2),
    close: round(row.close, 2),
    volume: Math.round(row.volume)
  }));
}

function buildDailySeriesMeta(rows, dailySeries, source) {
  const completed = getCompletedDailyRows(rows);
  const completeOhlcvCount = completed.filter(
    row =>
      isValidDailyRow(row) &&
      Number.isFinite(row.volume) &&
      row.volume >= 0
  ).length;

  return {
    schema: "daily-ohlcv-v1",
    volumeUnit: "shares",
    volumeUnitSource: completed.filter(r=>dailySeries.some(b=>b.date===r.date)).every(r=>globalThis.ShitouWorkerDataContractV1.adapters[r.volumeAdapter]) ? globalThis.ShitouWorkerDataContractV1.unitEvidence([...new Set(completed.map(r=>r.volumeAdapter).filter(Boolean))]) : [],
    upstreamHistoryCounts: {completedDailyRowsAvailable:completed.length,completeOhlcvRowsAvailable:completeOhlcvCount},
    countScope: "RETURNED_SERIES",
    requestedBars: DAILY_SERIES_RETURN_BARS,
    minRecommendedBars: DAILY_SERIES_MIN_RECOMMENDED_BARS,
    returnedBars: dailySeries.length,
    completedDailyRowsAvailable: dailySeries.length,
    completeOhlcvRowsAvailable: dailySeries.length,
    firstDate: dailySeries[0]?.date || null,
    lastDate: dailySeries[dailySeries.length - 1]?.date || null,
    ascending: true,
    onlyCompletedBars: true,
    readyForTrident: dailySeries.length >= 2,
    recommendedWindowReady:
      dailySeries.length >= DAILY_SERIES_MIN_RECOMMENDED_BARS,
    source: source || null,
    note:
      dailySeries.length >= DAILY_SERIES_MIN_RECOMMENDED_BARS
        ? "最近逐日OHLCV已可供前端三叉戟／K棒情境與OHLCV研究閘門使用。"
        : "逐日OHLCV已回傳，但歷史筆數未滿180根；三叉戟仍可運作，研究閘門保持停用，不用短樣本硬驗證。"
  };
}

function getCompletedDailyRows(rows) {
  if (!Array.isArray(rows)) return [];
  const now = getTaipeiDateTimeParts();
  const cutoffMinutes = TAIWAN_COMPLETED_BAR_HOUR * 60 + TAIWAN_COMPLETED_BAR_MINUTE;
  const currentMinutes = now.hour * 60 + now.minute;
  const byDate = new Map();
  for (const row of rows) {
    if (!isValidDailyRow(row)) continue;
    if (row.date > now.date) continue;
    if (row.date === now.date && currentMinutes < cutoffMinutes) continue;
    // The previous stable sort also retained the last input row for each date.
    if(byDate.has(row.date)&&globalThis.ShitouWorkerDataContractV1.fingerprint([byDate.get(row.date)])!==globalThis.ShitouWorkerDataContractV1.fingerprint([row]))throw Error('HISTORY_CONFLICT｜同來源重複交易日OHLCV衝突');
    byDate.set(row.date, row);
  }
  const completed = [...byDate.values()];
  // Valid upstream rows normally arrive in order; sort only when needed.
  for (let i = 1; i < completed.length; i++) {
    if (completed[i - 1].date.localeCompare(completed[i].date) > 0) {
      completed.sort((a, b) => a.date.localeCompare(b.date));
      break;
    }
  }
  return completed;
}

function getTaipeiDateTimeParts() {
  return getTaipeiDateTimePartsAt(new Date());
}


function analyzeVolumeContextScanLiteV29130(rows, fib) {
  // recentDailyRows 在進入分析前已由 getCompletedDailyRows 完成有效性過濾、去重與日期排序。
  const sourceRows = Array.isArray(rows) ? rows : [];
  const latest = sourceRows.length
    ? buildRelativeVolumeSnapshot(sourceRows, sourceRows.length - 1, 20)
    : null;

  let breakout = null;
  const breakoutDate = fib?.breakoutDate || null;
  if (breakoutDate) {
    for (let i = sourceRows.length - 1; i >= 0; i--) {
      if (sourceRows[i]?.date === breakoutDate) {
        breakout = buildRelativeVolumeSnapshot(sourceRows, i, 20);
        break;
      }
    }
  }

  let pattern = null;
  const aDate = fib?.ADate || null;
  const bDate = fib?.BDate || null;
  const cDate = fib?.CDate || null;

  if (aDate && bDate && cDate) {
    let abSum=0,abCount=0,bcSum=0,bcCount=0;
    for (const row of sourceRows) {
      if (!Number.isFinite(row?.volume)) continue;
      if (row.date >= aDate && row.date <= bDate) {
        abSum += row.volume; abCount++;
      } else if (row.date > bDate && row.date <= cDate) {
        bcSum += row.volume; bcCount++;
      }
    }
    const abAvg = abCount ? abSum / abCount : null;
    const bcAvg = bcCount ? bcSum / bcCount : null;
    const bcVsAbRatio =
      Number.isFinite(abAvg) && abAvg > 0 && Number.isFinite(bcAvg)
        ? bcAvg / abAvg
        : null;
    pattern = {
      abAverageVolumeShares: round(abAvg,0),
      bcAverageVolumeShares: round(bcAvg,0),
      bcVsAbRatio: round(bcVsAbRatio,2),
      pullbackVolume: classifyPullbackVolume(bcVsAbRatio),
      abTradingDays: abCount,
      bcTradingDays: bcCount
    };
  }

  return {
    unit:"shares",
    rule:"SCAN_LITE：相對量與完整模式同公式；省略重複filter/sort配置。",
    latest,
    breakout,
    pattern
  };
}

function analyzeStructureQualityScanLiteV29130(rows, fib, volume) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const parameters = {
    maPeriod:20,
    maSlopeLookbackBars:5,
    maSlopeThresholdPct:0.5,
    shallowBreakoutPct:1,
    strongBreakoutPct:3,
    threeDayBars:3,
    retestZonePct:1.5,
    longUpperWickPct:40,
    closeNearHighPct:70,
    closeNearLowPct:30,
    postBreakoutStrongRetracePct:33.3333,
    postBreakoutWeakRetracePct:50
  };

  if (!sourceRows.length) {
    return {
      rule:"SCAN_LITE：市場結構與突破品質輔助判讀。",
      parameters,
      dailyMA20:null,
      latestCandle:null,
      breakout:null,
      phase:{key:"unknown",icon:"⚪",label:"資料不足"}
    };
  }

  const latestIndex = sourceRows.length - 1;
  const latestCandle = buildCandleQuality(sourceRows[latestIndex], parameters);
  const dailyMA20 = buildDailyMaTrend(
    sourceRows, latestIndex, parameters.maPeriod,
    parameters.maSlopeLookbackBars, parameters.maSlopeThresholdPct
  );

  let breakout = null;
  const B = numberOrNull(fib?.B);
  const breakoutDate = fib?.breakoutDate || null;

  if (B !== null && breakoutDate) {
    let breakoutIndex = -1;
    for (let i=sourceRows.length-1;i>=0;i--) {
      if (sourceRows[i]?.date === breakoutDate) { breakoutIndex=i; break; }
    }
    if (breakoutIndex >= 0) {
      const breakoutRow = sourceRows[breakoutIndex];
      const breakoutCandle = buildCandleQuality(breakoutRow, parameters);
      const breakoutPct = B > 0 ? ((breakoutRow.close - B) / B) * 100 : null;
      const breakoutStrength = classifyBreakoutMagnitude(
        breakoutPct, parameters.shallowBreakoutPct, parameters.strongBreakoutPct
      );
      const breakoutVolume = volume?.breakout || buildRelativeVolumeSnapshot(sourceRows,breakoutIndex,20);
      const threeDay = buildThreeDayBreakoutConfirmation(sourceRows,breakoutIndex,B,parameters.threeDayBars);
      const retest = detectBreakoutRetest(sourceRows,breakoutIndex,B,parameters.retestZonePct);
      const reattack = retest?.index !== null && retest?.index !== undefined
        ? detectReattackAfterRetest(sourceRows,retest.index,B)
        : null;
      const shakeout = detectBreakoutShakeout(sourceRows,breakoutIndex,B,parameters.threeDayBars);
      const falseBreakoutRisk = classifyFalseBreakoutRisk({
        breakoutPct,
        relativeVolume20:numberOrNull(breakoutVolume?.relativeVolume20),
        breakoutCandle,
        dailyMA20AtBreakout:buildDailyMaTrend(
          sourceRows,breakoutIndex,parameters.maPeriod,
          parameters.maSlopeLookbackBars,parameters.maSlopeThresholdPct
        ),
        threeDay
      });
      const defense = buildBreakoutDefense(sourceRows,breakoutIndex);
      const nextDayStrength = buildPostBreakoutDayStrength(sourceRows,breakoutIndex,parameters);

      breakout = {
        B:round(B,2),
        date:breakoutRow.date,
        close:round(breakoutRow.close,2),
        high:round(breakoutRow.high,2),
        low:round(breakoutRow.low,2),
        breakoutPct:round(breakoutPct,2),
        strength:breakoutStrength,
        candle:breakoutCandle,
        volume:breakoutVolume,
        defense,
        nextDayStrength,
        threeDay,
        retest:retest ? stripInternalIndex(retest) : null,
        reattack:reattack ? stripInternalIndex(reattack) : null,
        shakeout,
        falseBreakoutRisk
      };
    }
  }

  const phase = classifyMarketStructurePhase(fib,breakout,latestCandle);
  return {
    rule:"SCAN_LITE：日20MA／突破幅度／K棒／三日站穩／回測／假突破規則與完整模式相同。",
    parameters,
    dailyMA20,
    latestCandle,
    breakout,
    phase
  };
}

function analyzeFibonacciNPatternScanLiteV29130(rows, latestClose) {
  // recentDailyRows 已排序，避免完整模式再次 filter+sort 的配置成本。
  const sourceRows = Array.isArray(rows)
    ? rows.slice(-FIB_LOOKBACK_DAYS)
    : [];

  const algorithm = {
    name:"pivot-abc-v2.4-scan-lite",
    compatibleWith:"pivot-abc-v2.4",
    lookbackDays:FIB_LOOKBACK_DAYS,
    pivotLeft:FIB_PIVOT_LEFT,
    pivotRight:FIB_PIVOT_RIGHT,
    minABPct:round(FIB_MIN_AB_PCT*100,2),
    minRetraceOfABPct:round(FIB_MIN_RETRACE_OF_AB*100,2),
    maxRetraceOfABPct:round(FIB_MAX_RETRACE_OF_AB*100,2),
    breakoutRule:"C形成後，任一已完成日K收盤價 > B，才算突破確認",
    invalidationRule:"尚未突破B前，任一已完成日K最低價 < A，該組A/B/C立即失效並重新尋找新的N字",
    cUpdateRule:"尚未突破B前，如後續形成更低Swing Low且仍滿足規則，C更新",
    completionRule:"突破B後，任一已完成日K最高價 >= 1.618延伸目標即completed",
    postBreakFailureRule:"突破B後、未達1.618前，收盤跌破0.764或最低跌破A即failed",
    selectionRule:"與pivot-abc-v2.4相同；SCAN_LITE只優化資料走訪方式"
  };

  const minimumRows = FIB_PIVOT_LEFT + FIB_PIVOT_RIGHT + 7;
  if (sourceRows.length < minimumRows) {
    return makeFibNotFormedResult("N字尚未形成：有效日K資料不足。",null,null,null,null,algorithm);
  }

  const pivots = normalizeSwingPivots(
    detectSwingPivots(sourceRows,FIB_PIVOT_LEFT,FIB_PIVOT_RIGHT)
  );

  // 兩個共用索引取代每個候選重建 filter()/Map()。
  const rowIndexByDate = new Map();
  for (let i=0;i<sourceRows.length;i++) rowIndexByDate.set(sourceRows[i].date,i);
  const pivotLowByDate = new Map();
  for (const p of pivots) if (p.type==="low") pivotLowByDate.set(p.date,p);

  const activePatterns=[];
  const completedPatterns=[];
  const failedPatterns=[];
  let latestInvalidated=null;

  for (let i=0;i<pivots.length-2;i++) {
    const A=pivots[i],B=pivots[i+1],C=pivots[i+2];
    if (A.type!=="low"||B.type!=="high"||C.type!=="low") continue;
    const AB=B.price-A.price;
    const abPct=A.price>0?AB/A.price:0;
    if (AB<=0||abPct<FIB_MIN_AB_PCT) continue;
    if (!(C.price>A.price&&C.price<B.price)) continue;
    const retraceRatio=(B.price-C.price)/AB;
    if (retraceRatio<FIB_MIN_RETRACE_OF_AB||retraceRatio>FIB_MAX_RETRACE_OF_AB) continue;

    const lifecycle=evaluateFibonacciPatternLifecycleScanLiteV29130(
      {A,B,C,AB,abPct,retraceRatio},
      sourceRows,
      pivotLowByDate,
      rowIndexByDate
    );

    if (lifecycle.status==="invalidated") {
      if (!latestInvalidated||lifecycle.invalidatedDate>latestInvalidated.invalidatedDate) latestInvalidated=lifecycle;
    } else if (lifecycle.status==="completed") completedPatterns.push(lifecycle);
    else if (lifecycle.status==="failed") failedPatterns.push(lifecycle);
    else activePatterns.push(lifecycle);
  }

  completedPatterns.sort((x,y)=>{
    const xd=x.completedDate||x.C.date,yd=y.completedDate||y.C.date;
    const d=yd.localeCompare(xd);return d!==0?d:y.C.date.localeCompare(x.C.date);
  });
  failedPatterns.sort((x,y)=>{
    const xd=x.failedDate||x.C.date,yd=y.failedDate||y.C.date;
    const d=yd.localeCompare(xd);return d!==0?d:y.C.date.localeCompare(x.C.date);
  });

  const latestCompleted=completedPatterns[0]||null;
  const latestFailed=failedPatterns[0]||null;
  const terminalEvents=[];
  if (latestCompleted?.completedDate) terminalEvents.push({type:"completed",date:latestCompleted.completedDate,pattern:latestCompleted});
  if (latestFailed?.failedDate) terminalEvents.push({type:"failed",date:latestFailed.failedDate,pattern:latestFailed});
  terminalEvents.sort((a,b)=>b.date.localeCompare(a.date));
  const latestTerminal=terminalEvents[0]||null;
  const afterDate=latestTerminal?latestTerminal.date:null;
  const currentPatterns=afterDate
    ?activePatterns.filter(pattern=>getPivotConfirmDate(pattern.A)>afterDate)
    :activePatterns;

  if (!currentPatterns.length) {
    const latestAB=findLatestActiveABPattern(pivots,sourceRows,afterDate);
    const relevantInvalidated=latestInvalidated&&(!afterDate||latestInvalidated.invalidatedDate>afterDate)?latestInvalidated:null;
    let message;
    if (latestAB) message="N字尚未形成：目前只有新的有效 A → B，尚未出現符合規則的 C。";
    else if (relevantInvalidated) message="N字尚未形成：最近一組 A → B → C 已失效，系統正在等待新的有效N字。";
    else if (latestTerminal?.type==="failed") message="上一組已確認N字已觸發突破後失敗條件；目前尚無新的有效N字。";
    else if (latestTerminal?.type==="completed") message="上一組N字已完成1.618目標；目前尚無新的有效N字。";
    else message="N字尚未形成：尚未找到符合規則的有效 A → B。";
    return makeFibNotFormedResult(message,latestAB,relevantInvalidated,latestCompleted,latestFailed,algorithm);
  }

  currentPatterns.sort((x,y)=>{
    const c=y.C.date.localeCompare(x.C.date);if(c!==0)return c;
    const b=y.B.date.localeCompare(x.B.date);if(b!==0)return b;
    return y.A.date.localeCompare(x.A.date);
  });
  return buildFibPatternResult(currentPatterns[0],latestClose,latestCompleted,latestFailed,algorithm);
}

function evaluateFibonacciPatternLifecycleScanLiteV29130(candidate,sourceRows,pivotLowByDate,rowIndexByDate) {
  const A=candidate.A,B=candidate.B,AB=candidate.AB;
  let C=candidate.C,retraceRatio=candidate.retraceRatio;
  const initialC=candidate.C;
  let cUpdateCount=0,breakoutRow=null,target1618=null;
  const stop764=B.price-AB*0.764;
  const startIndex=rowIndexByDate.get(initialC.date);
  const from=Number.isInteger(startIndex)?startIndex+1:0;

  for (let idx=from;idx<sourceRows.length;idx++) {
    const row=sourceRows[idx];
    if (!breakoutRow) {
      if (row.low<A.price) {
        return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"invalidated",confirmed:false,
          breakoutRow:null,completedRow:null,completedDate:null,completedHigh:null,failedRow:null,failedDate:null,
          failedClose:null,failedLow:null,stop764,target1618:null,invalidatedDate:row.date,invalidatedPrice:row.low,
          invalidatedReason:"C形成後、尚未突破B前價格跌破A，原A/B/C結構失效"};
      }

      const newPivotLow=pivotLowByDate.get(row.date);
      if (newPivotLow && newPivotLow.date>initialC.date && newPivotLow.price<C.price) {
        const newRetraceRatio=(B.price-newPivotLow.price)/AB;
        if (newPivotLow.price<=A.price||newRetraceRatio>FIB_MAX_RETRACE_OF_AB) {
          return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"invalidated",confirmed:false,
            breakoutRow:null,completedRow:null,completedDate:null,completedHigh:null,failedRow:null,failedDate:null,
            failedClose:null,failedLow:null,stop764,target1618:null,invalidatedDate:newPivotLow.date,invalidatedPrice:newPivotLow.price,
            invalidatedReason:newPivotLow.price<=A.price?"新的Swing Low跌破或等於A，原A/B/C結構失效":"新的Swing Low回撤超過允許上限，原A/B/C結構失效"};
        }
        if (newRetraceRatio>=FIB_MIN_RETRACE_OF_AB) {
          C=newPivotLow;retraceRatio=newRetraceRatio;cUpdateCount++;
        }
      }

      if (row.close>B.price) {
        breakoutRow=row;
        target1618=C.price+AB*1.618;
        if (row.high>=target1618) {
          return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"completed",confirmed:true,
            breakoutRow,completedRow:row,completedDate:row.date,completedHigh:row.high,failedRow:null,failedDate:null,
            failedClose:null,failedLow:null,stop764,target1618,invalidatedDate:null,invalidatedPrice:null,invalidatedReason:null};
        }
      }
      continue;
    }

    if (row.high>=target1618) {
      return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"completed",confirmed:true,
        breakoutRow,completedRow:row,completedDate:row.date,completedHigh:row.high,failedRow:null,failedDate:null,
        failedClose:null,failedLow:null,stop764,target1618,invalidatedDate:null,invalidatedPrice:null,invalidatedReason:null};
    }
    if (row.low<A.price) {
      return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"failed",confirmed:false,
        breakoutRow,completedRow:null,completedDate:null,completedHigh:null,failedRow:row,failedDate:row.date,
        failedClose:row.close,failedLow:row.low,
        failureReason:"突破B後、尚未達1.618前，日K最低價跌破A，該組N字視為突破失敗",
        stop764,target1618,invalidatedDate:null,invalidatedPrice:null,invalidatedReason:null};
    }
    if (row.close<stop764) {
      return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"failed",confirmed:false,
        breakoutRow,completedRow:null,completedDate:null,completedHigh:null,failedRow:row,failedDate:row.date,
        failedClose:row.close,failedLow:row.low,
        failureReason:"突破B後、尚未達1.618前，完成日K收盤跌破0.764深度風控位，該組N字視為突破失敗",
        stop764,target1618,invalidatedDate:null,invalidatedPrice:null,invalidatedReason:null};
    }
  }

  if (breakoutRow) {
    return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"confirmed",confirmed:true,
      breakoutRow,completedRow:null,completedDate:null,completedHigh:null,failedRow:null,failedDate:null,
      failedClose:null,failedLow:null,stop764,target1618,invalidatedDate:null,invalidatedPrice:null,invalidatedReason:null};
  }
  return {...candidate,C,retraceRatio,initialC,cUpdateCount,status:"forming",confirmed:false,
    breakoutRow:null,completedRow:null,completedDate:null,completedHigh:null,failedRow:null,failedDate:null,
    failedClose:null,failedLow:null,stop764,target1618:null,invalidatedDate:null,invalidatedPrice:null,invalidatedReason:null};
}

function analyzeVolumeContext(rows, fib) {
  const sourceRows = Array.isArray(rows)
    ? rows
        .filter(row => isValidDailyRow(row))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const latest = sourceRows.length
    ? buildRelativeVolumeSnapshot(sourceRows, sourceRows.length - 1, 20)
    : null;

  let breakout = null;
  const breakoutDate = fib?.breakoutDate || null;
  if (breakoutDate) {
    const breakoutIndex = sourceRows.findIndex(row => row.date === breakoutDate);
    if (breakoutIndex >= 0) {
      breakout = buildRelativeVolumeSnapshot(sourceRows, breakoutIndex, 20);
    }
  }

  let pattern = null;
  const aDate = fib?.ADate || null;
  const bDate = fib?.BDate || null;
  const cDate = fib?.CDate || null;

  if (aDate && bDate && cDate) {
    const abRows = sourceRows.filter(
      row => row.date >= aDate && row.date <= bDate && Number.isFinite(row.volume)
    );
    const bcRows = sourceRows.filter(
      row => row.date > bDate && row.date <= cDate && Number.isFinite(row.volume)
    );

    const abAvg = average(abRows.map(row => row.volume));
    const bcAvg = average(bcRows.map(row => row.volume));
    const bcVsAbRatio =
      Number.isFinite(abAvg) && abAvg > 0 && Number.isFinite(bcAvg)
        ? bcAvg / abAvg
        : null;

    pattern = {
      abAverageVolumeShares: round(abAvg, 0),
      bcAverageVolumeShares: round(bcAvg, 0),
      bcVsAbRatio: round(bcVsAbRatio, 2),
      pullbackVolume: classifyPullbackVolume(bcVsAbRatio),
      abTradingDays: abRows.length,
      bcTradingDays: bcRows.length
    };
  }

  return {
    unit: "shares",
    rule:
      "相對量＝指定交易日成交股數 ÷ 前20個有效完整交易日平均成交股數；量能只作結構確認，不改變N字confirmed/forming判定。",
    latest,
    breakout,
    pattern
  };
}

function buildRelativeVolumeSnapshot(rows, index, lookback) {
  if (!Array.isArray(rows) || index < 0 || index >= rows.length) return null;

  const row = rows[index];
  const volume = Number.isFinite(row?.volume) ? row.volume : null;
  if (volume === null) {
    return {
      date: row?.date || null,
      volumeShares: null,
      average20VolumeShares: null,
      averageCount: 0,
      relativeVolume20: null,
      grade: classifyRelativeVolume(null)
    };
  }

  const previousVolumes = [];
  for (let i = index - 1; i >= 0 && previousVolumes.length < lookback; i--) {
    const v = rows[i]?.volume;
    if (Number.isFinite(v)) previousVolumes.push(v);
  }

  const avg20 = average(previousVolumes);
  const ratio = Number.isFinite(avg20) && avg20 > 0 ? volume / avg20 : null;

  return {
    date: row.date,
    volumeShares: round(volume, 0),
    average20VolumeShares: round(avg20, 0),
    averageCount: previousVolumes.length,
    relativeVolume20: round(ratio, 2),
    grade: classifyRelativeVolume(ratio)
  };
}

function classifyRelativeVolume(ratio) {
  if (!Number.isFinite(ratio)) {
    return { key: "unknown", icon: "⚪", label: "量能資料不足" };
  }

  if (ratio >= 1.5) {
    return { key: "strong", icon: "🟢", label: "明顯放量" };
  }

  if (ratio >= 1.2) {
    return { key: "mild", icon: "🟢", label: "溫和放量" };
  }

  if (ratio >= 0.8) {
    return { key: "normal", icon: "🟡", label: "正常量" };
  }

  return { key: "low", icon: "⚠️", label: "量縮" };
}

function classifyPullbackVolume(ratio) {
  if (!Number.isFinite(ratio)) {
    return { key: "unknown", icon: "⚪", label: "資料不足" };
  }

  if (ratio <= 0.8) {
    return { key: "contracting", icon: "🟢", label: "回檔量縮" };
  }

  if (ratio <= 1.2) {
    return { key: "similar", icon: "🟡", label: "回檔量能接近前段" };
  }

  return { key: "expanding", icon: "⚠️", label: "回檔放量" };
}

function analyzeStructureQuality(rows, fib, volume) {
  const sourceRows = Array.isArray(rows)
    ? rows
        .filter(row => isValidDailyRow(row))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const parameters = {
    maPeriod: 20,
    maSlopeLookbackBars: 5,
    maSlopeThresholdPct: 0.5,
    shallowBreakoutPct: 1,
    strongBreakoutPct: 3,
    threeDayBars: 3,
    retestZonePct: 1.5,
    longUpperWickPct: 40,
    closeNearHighPct: 70,
    closeNearLowPct: 30,
    postBreakoutStrongRetracePct: 33.3333,
    postBreakoutWeakRetracePct: 50
  };

  if (!sourceRows.length) {
    return {
      rule:
        "市場結構與突破品質只作輔助判讀，不改變N字的形成中、已確認、已失效或已完成狀態。",
      parameters,
      dailyMA20: null,
      latestCandle: null,
      breakout: null,
      phase: { key: "unknown", icon: "⚪", label: "資料不足" }
    };
  }

  const latestIndex = sourceRows.length - 1;
  const latestCandle = buildCandleQuality(sourceRows[latestIndex], parameters);
  const dailyMA20 = buildDailyMaTrend(
    sourceRows,
    latestIndex,
    parameters.maPeriod,
    parameters.maSlopeLookbackBars,
    parameters.maSlopeThresholdPct
  );

  let breakout = null;
  const B = numberOrNull(fib?.B);
  const breakoutDate = fib?.breakoutDate || null;

  if (B !== null && breakoutDate) {
    const breakoutIndex = sourceRows.findIndex(row => row.date === breakoutDate);

    if (breakoutIndex >= 0) {
      const breakoutRow = sourceRows[breakoutIndex];
      const breakoutCandle = buildCandleQuality(breakoutRow, parameters);
      const breakoutPct = B > 0 ? ((breakoutRow.close - B) / B) * 100 : null;
      const breakoutStrength = classifyBreakoutMagnitude(
        breakoutPct,
        parameters.shallowBreakoutPct,
        parameters.strongBreakoutPct
      );

      const breakoutVolume = volume?.breakout || buildRelativeVolumeSnapshot(
        sourceRows,
        breakoutIndex,
        20
      );

      const threeDay = buildThreeDayBreakoutConfirmation(
        sourceRows,
        breakoutIndex,
        B,
        parameters.threeDayBars
      );

      const retest = detectBreakoutRetest(
        sourceRows,
        breakoutIndex,
        B,
        parameters.retestZonePct
      );

      const reattack = retest?.index !== null && retest?.index !== undefined
        ? detectReattackAfterRetest(sourceRows, retest.index, B)
        : null;

      const shakeout = detectBreakoutShakeout(
        sourceRows,
        breakoutIndex,
        B,
        parameters.threeDayBars
      );

      const falseBreakoutRisk = classifyFalseBreakoutRisk({
        breakoutPct,
        relativeVolume20: numberOrNull(breakoutVolume?.relativeVolume20),
        breakoutCandle,
        dailyMA20AtBreakout: buildDailyMaTrend(
          sourceRows,
          breakoutIndex,
          parameters.maPeriod,
          parameters.maSlopeLookbackBars,
          parameters.maSlopeThresholdPct
        ),
        threeDay
      });

      const defense = buildBreakoutDefense(sourceRows, breakoutIndex);
      const nextDayStrength = buildPostBreakoutDayStrength(
        sourceRows,
        breakoutIndex,
        parameters
      );

      breakout = {
        B: round(B, 2),
        date: breakoutRow.date,
        close: round(breakoutRow.close, 2),
        high: round(breakoutRow.high, 2),
        low: round(breakoutRow.low, 2),
        breakoutPct: round(breakoutPct, 2),
        strength: breakoutStrength,
        candle: breakoutCandle,
        volume: breakoutVolume,
        defense,
        nextDayStrength,
        threeDay,
        retest: retest ? stripInternalIndex(retest) : null,
        reattack: reattack ? stripInternalIndex(reattack) : null,
        shakeout,
        falseBreakoutRisk
      };
    }
  }

  const phase = classifyMarketStructurePhase(fib, breakout, latestCandle);

  return {
    rule:
      "市場結構、突破幅度、K棒、日線20日均線、三日站穩、回測與量能只作突破品質輔助判讀；不改變N字核心狀態，也不把任何單一條件直接定義為買賣點。",
    parameters,
    dailyMA20,
    latestCandle,
    breakout,
    phase
  };
}

function buildDailyMaTrend(rows, index, period, slopeLookbackBars, thresholdPct) {
  if (!Array.isArray(rows) || index < 0 || index >= rows.length) return null;

  const latestMa = simpleCloseAverage(rows, index, period);
  const pastIndex = index - slopeLookbackBars;
  const pastMa = pastIndex >= 0 ? simpleCloseAverage(rows, pastIndex, period) : null;
  const slopePct =
    Number.isFinite(latestMa) && Number.isFinite(pastMa) && pastMa !== 0
      ? ((latestMa - pastMa) / pastMa) * 100
      : null;

  let direction = { key: "unknown", icon: "⚪", label: "資料不足" };

  if (Number.isFinite(slopePct)) {
    if (slopePct >= thresholdPct) {
      direction = { key: "up", icon: "🟢", label: "向上" };
    } else if (slopePct <= -thresholdPct) {
      direction = { key: "down", icon: "⚠️", label: "向下" };
    } else {
      direction = { key: "flat", icon: "🟡", label: "走平" };
    }
  }

  return {
    period,
    latest: round(latestMa, 2),
    previous: round(pastMa, 2),
    lookbackBars: slopeLookbackBars,
    slopePct: round(slopePct, 2),
    direction
  };
}

function simpleCloseAverage(rows, index, period) {
  const start = index - period + 1;
  if (start < 0) return null;
  const closes = rows.slice(start, index + 1).map(row => row.close);
  if (closes.length !== period || closes.some(value => !Number.isFinite(value))) return null;
  return average(closes);
}

function buildCandleQuality(row, parameters) {
  if (!row) return null;

  const range = row.high - row.low;
  const body = Math.abs(row.close - row.open);
  const upperWick = row.high - Math.max(row.open, row.close);
  const lowerWick = Math.min(row.open, row.close) - row.low;

  const closeLocationPct = range > 0 ? ((row.close - row.low) / range) * 100 : 50;
  const bodyPct = range > 0 ? (body / range) * 100 : 0;
  const upperWickPct = range > 0 ? (upperWick / range) * 100 : 0;
  const lowerWickPct = range > 0 ? (lowerWick / range) * 100 : 0;

  let closePosition;
  if (closeLocationPct >= parameters.closeNearHighPct) {
    closePosition = { key: "high", icon: "🟢", label: "收盤靠近當日高點" };
  } else if (closeLocationPct <= parameters.closeNearLowPct) {
    closePosition = { key: "low", icon: "⚠️", label: "收盤靠近當日低點" };
  } else {
    closePosition = { key: "middle", icon: "🟡", label: "收盤位於日內中段" };
  }

  const upperWickRisk = upperWickPct >= parameters.longUpperWickPct
    ? { key: "long", icon: "⚠️", label: "長上影較明顯" }
    : { key: "normal", icon: "🟡", label: "上影線未達高風險門檻" };

  return {
    date: row.date,
    open: round(row.open, 2),
    high: round(row.high, 2),
    low: round(row.low, 2),
    close: round(row.close, 2),
    range: round(range, 2),
    bodyPct: round(bodyPct, 2),
    upperWickPct: round(upperWickPct, 2),
    lowerWickPct: round(lowerWickPct, 2),
    closeLocationPct: round(closeLocationPct, 2),
    closePosition,
    upperWickRisk
  };
}

function classifyBreakoutMagnitude(pct, shallowPct, strongPct) {
  if (!Number.isFinite(pct)) {
    return { key: "unknown", icon: "⚪", label: "資料不足" };
  }
  if (pct < 0) {
    return { key: "none", icon: "⚠️", label: "未有效站上B" };
  }
  if (pct < shallowPct) {
    return { key: "shallow", icon: "🟡", label: "淺突破" };
  }
  if (pct < strongPct) {
    return { key: "clear", icon: "🟢", label: "有效脫離" };
  }
  return { key: "strong", icon: "🟢", label: "明顯突破" };
}

function buildThreeDayBreakoutConfirmation(rows, breakoutIndex, B, requiredBars) {
  const bars = [];

  for (let i = breakoutIndex; i < rows.length && bars.length < requiredBars; i++) {
    const row = rows[i];
    bars.push({
      date: row.date,
      close: round(row.close, 2),
      aboveB: row.close > B
    });
  }

  const anyFailed = bars.some(bar => !bar.aboveB);
  const completed = bars.length >= requiredBars;

  let status;
  if (anyFailed) {
    status = { key: "failed", icon: "⚠️", label: "三日站穩未通過" };
  } else if (completed) {
    status = { key: "passed", icon: "🟢", label: "三日站穩確認" };
  } else {
    status = {
      key: "pending",
      icon: "🟡",
      label: `三日確認進行中（${bars.length}/${requiredBars}）`
    };
  }

  return {
    requiredBars,
    daysAvailable: bars.length,
    bars,
    status,
    rule: `自突破日開始觀察前${requiredBars}個完整交易日收盤是否持續高於B；只作突破品質確認，不改變N字核心狀態。`
  };
}

function detectBreakoutRetest(rows, breakoutIndex, B, zonePct) {
  const upper = B * (1 + zonePct / 100);
  const lower = B * (1 - zonePct / 100);

  for (let i = breakoutIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const touchedZone = row.low <= upper && row.high >= lower;
    if (!touchedZone) continue;

    const snapshot = buildRelativeVolumeSnapshot(rows, i, 20);
    const closeHeld = row.close >= B;
    const relativeVolume20 = numberOrNull(snapshot?.relativeVolume20);

    let grade;
    if (closeHeld && Number.isFinite(relativeVolume20) && relativeVolume20 < 0.8) {
      grade = { key: "held_contracting", icon: "🟢", label: "量縮回測守住B" };
    } else if (closeHeld) {
      grade = { key: "held", icon: "🟢", label: "回測B後收盤守住" };
    } else {
      grade = { key: "lost", icon: "⚠️", label: "回測後收盤跌回B下方" };
    }

    return {
      index: i,
      date: row.date,
      close: round(row.close, 2),
      low: round(row.low, 2),
      high: round(row.high, 2),
      zonePct,
      closeHeld,
      relativeVolume20: round(relativeVolume20, 2),
      volumeGrade: snapshot?.grade || classifyRelativeVolume(relativeVolume20),
      grade
    };
  }

  return null;
}

function detectReattackAfterRetest(rows, retestIndex, B) {
  for (let i = retestIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.close <= B) continue;

    const snapshot = buildRelativeVolumeSnapshot(rows, i, 20);
    const relativeVolume20 = numberOrNull(snapshot?.relativeVolume20);

    return {
      index: i,
      date: row.date,
      close: round(row.close, 2),
      relativeVolume20: round(relativeVolume20, 2),
      volumeGrade: snapshot?.grade || classifyRelativeVolume(relativeVolume20),
      grade:
        Number.isFinite(relativeVolume20) && relativeVolume20 >= 1.2
          ? { key: "volume", icon: "🟢", label: "回測後再攻且量能改善" }
          : { key: "price", icon: "🟡", label: "回測後價格重新站上B" }
    };
  }

  return null;
}

function detectBreakoutShakeout(rows, breakoutIndex, B, reclaimBars) {
  const end = Math.min(rows.length - 1, breakoutIndex + 10);

  for (let i = breakoutIndex + 1; i <= end; i++) {
    const row = rows[i];
    if (row.low >= B && row.close >= B) continue;

    const fellBelow = row.low < B || row.close < B;
    if (!fellBelow) continue;

    const reclaimEnd = Math.min(end, i + reclaimBars);
    for (let j = i; j <= reclaimEnd; j++) {
      if (rows[j].close > B) {
        return {
          detected: true,
          icon: "🟡",
          label: "突破後曾跌回B附近／下方，但在短期內重新收復",
          breakdownDate: row.date,
          breakdownLow: round(row.low, 2),
          breakdownClose: round(row.close, 2),
          reclaimDate: rows[j].date,
          reclaimClose: round(rows[j].close, 2),
          note: "屬疑似震倉／假跌破後收復特徵，只描述價格行為，不代表可確認主力意圖。"
        };
      }
    }
  }

  return {
    detected: false,
    icon: "⚪",
    label: "未偵測到短期跌回B後快速收復特徵"
  };
}

function classifyFalseBreakoutRisk(input) {
  const flags = [];

  if (Number.isFinite(input.breakoutPct) && input.breakoutPct < 1) {
    flags.push("突破幅度小於1%（淺突破）");
  }

  if (Number.isFinite(input.relativeVolume20) && input.relativeVolume20 < 0.8) {
    flags.push("突破日相對量低於0.8倍");
  }

  if (Number.isFinite(input.breakoutCandle?.upperWickPct) && input.breakoutCandle.upperWickPct >= 40) {
    flags.push("突破K上影線占日內振幅40%以上");
  }

  if (Number.isFinite(input.breakoutCandle?.closeLocationPct) && input.breakoutCandle.closeLocationPct < 50) {
    flags.push("突破K收盤位於日內振幅中線以下");
  }

  const maDirection = input.dailyMA20AtBreakout?.direction?.key;
  if (maDirection === "down") {
    flags.push("突破時日20MA仍向下");
  }

  if (input.threeDay?.status?.key === "failed") {
    flags.push("突破後三日站穩未通過");
  }

  let level;
  if (flags.length >= 3) {
    level = { key: "high", icon: "⚠️", label: "假突破風險較高" };
  } else if (flags.length >= 1) {
    level = { key: "medium", icon: "🟡", label: "有部分假突破風險特徵" };
  } else {
    level = { key: "low", icon: "🟢", label: "目前未見明顯假突破風險特徵" };
  }

  return { level, count: flags.length, flags };
}

function classifyMarketStructurePhase(fib, breakout, latestCandle) {
  const status = fib?.status || "not_formed";

  if (status === "forming") {
    return { key: "recovery", icon: "🟡", label: "C後回升觀察" };
  }

  if (status === "confirmed") {
    if (breakout?.retest?.closeHeld && breakout?.reattack) {
      return { key: "retest_reattack", icon: "🟢", label: "突破後回測再攻" };
    }
    if (breakout?.threeDay?.status?.key === "passed") {
      return { key: "held", icon: "🟢", label: "突破後站穩" };
    }
    if (breakout?.threeDay?.status?.key === "failed") {
      return { key: "pullback", icon: "⚠️", label: "突破後回落觀察" };
    }
    return { key: "early_breakout", icon: "🟡", label: "突破初期，等待持續性確認" };
  }

  if (status === "not_formed" && numberOrNull(fib?.A) !== null && numberOrNull(fib?.B) !== null) {
    return { key: "waiting_c", icon: "🟡", label: "A→B完成，等待有效C" };
  }

  if (latestCandle?.closePosition?.key === "low") {
    return { key: "weak_wait", icon: "⚠️", label: "等待新結構，短線收盤位置偏弱" };
  }

  return { key: "waiting", icon: "⚪", label: "等待新的有效結構" };
}

function stripInternalIndex(value) {
  if (!value || typeof value !== "object") return value;
  const { index, ...rest } = value;
  return rest;
}

function buildBreakoutDefense(rows, breakoutIndex) {
  if (!Array.isArray(rows) || breakoutIndex < 0 || breakoutIndex >= rows.length) {
    return null;
  }

  const breakoutRow = rows[breakoutIndex];
  const previousRow = breakoutIndex > 0 ? rows[breakoutIndex - 1] : null;
  const previousClose = numberOrNull(previousRow?.close);
  const breakoutLow = numberOrNull(breakoutRow?.low);

  if (breakoutLow === null) return null;

  const level = previousClose !== null
    ? Math.min(previousClose, breakoutLow)
    : breakoutLow;

  return {
    label: "突破K短線防守參考",
    level: round(level, 2),
    previousClose: round(previousClose, 2),
    breakoutLow: round(breakoutLow, 2),
    formula: previousClose !== null
      ? "Min{突破前一日收盤, 突破日最低}"
      : "突破日最低",
    note: "此價位只作突破後短線結構觀察，不取代N字0.764深度風控，也不直接作為自動買賣指令。"
  };
}

function buildPostBreakoutDayStrength(rows, breakoutIndex, parameters) {
  if (!Array.isArray(rows) || breakoutIndex < 0 || breakoutIndex >= rows.length) {
    return null;
  }

  const breakoutRow = rows[breakoutIndex];
  const nextRow = rows[breakoutIndex + 1];
  const range = breakoutRow.high - breakoutRow.low;

  if (!nextRow || !Number.isFinite(range) || range <= 0) {
    return {
      available: false,
      label: "等待突破隔日完整日K",
      note: "突破後續強弱需至少再有1個完整交易日。"
    };
  }

  const oneThirdLevel = breakoutRow.high - range / 3;
  const halfLevel = breakoutRow.high - range / 2;
  let grade;

  if (nextRow.close > breakoutRow.high) {
    grade = { key: "strong", icon: "🔥", label: "續漲強勢" };
  } else if (nextRow.low >= oneThirdLevel) {
    grade = { key: "hold_one_third", icon: "🟢", label: "不破突破K 1/3回撤｜次強" };
  } else if (nextRow.low >= halfLevel) {
    grade = { key: "hold_half", icon: "🟡", label: "不破突破K 1/2回撤｜仍守住" };
  } else if (nextRow.close < breakoutRow.low || nextRow.low < breakoutRow.low) {
    grade = { key: "lost_low", icon: "⚠️", label: "跌破突破K低點｜假突破風險提高" };
  } else {
    grade = { key: "lost_half", icon: "⚠️", label: "跌破突破K 1/2回撤｜突破品質轉弱" };
  }

  return {
    available: true,
    breakoutDate: breakoutRow.date,
    nextDate: nextRow.date,
    breakoutHigh: round(breakoutRow.high, 2),
    breakoutLow: round(breakoutRow.low, 2),
    oneThirdLevel: round(oneThirdLevel, 2),
    halfLevel: round(halfLevel, 2),
    nextOpen: round(nextRow.open, 2),
    nextHigh: round(nextRow.high, 2),
    nextLow: round(nextRow.low, 2),
    nextClose: round(nextRow.close, 2),
    grade,
    rule: "突破隔日以突破K的1/3與1/2回撤位置判斷續強程度；只作突破品質輔助，不改變N字核心狀態。"
  };
}

// ============================================================
// 戰術 N 字／寶塔線翻紅層
// ============================================================
function analyzeTacticalN(rows) {
  const sourceRows = Array.isArray(rows)
    ? rows
        .filter(isValidDailyRow)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-TACTICAL_N_LOOKBACK_DAYS)
    : [];

  const algorithm = {
    name: "three-high-breakout-v1",
    lookbackDays: TACTICAL_N_LOOKBACK_DAYS,
    necklineBars: TACTICAL_N_NECKLINE_BARS,
    breakoutRule:
      "寶塔線綠翻紅：完成日K收盤 > 前三個完整交易日最高價之最大值（前三高頸線）",
    breakdownRule:
      "寶塔線紅翻綠：完成日K收盤 < 前三個完整交易日最低價之最小值（前三低）",
    defenseRule:
      "突破K短線防守＝Min{突破前一日收盤, 突破日最低}",
    threeDayRule:
      "自翻紅日算Day 1，連續3個完整交易日最低價不得跌破Day 1最低價；只作戰術突破持續性確認",
    note:
      "戰術N字只使用當下已知的前三日資料，不使用右側未來K棒；Fibonacci Swing N仍維持pivot-abc-v2.4。"
  };

  if (sourceRows.length < TACTICAL_N_NECKLINE_BARS + 1) {
    return {
      algorithm,
      state: { key: "UNKNOWN", icon: "⚪", label: "資料不足" },
      active: null,
      latestBreakout: null,
      previousBreakout: null,
      history: []
    };
  }

  let state = "GREEN";
  let activeEvent = null;
  const events = [];

  for (let i = TACTICAL_N_NECKLINE_BARS; i < sourceRows.length; i++) {
    const row = sourceRows[i];
    const previousRows = sourceRows.slice(i - TACTICAL_N_NECKLINE_BARS, i);
    const previous3High = Math.max(...previousRows.map(item => item.high));
    const previous3Low = Math.min(...previousRows.map(item => item.low));

    if (state === "GREEN" && row.close > previous3High) {
      const previousClose = sourceRows[i - 1]?.close ?? null;
      const defense =
        Number.isFinite(previousClose)
          ? Math.min(previousClose, row.low)
          : row.low;

      const event = {
        index: i,
        breakoutDate: row.date,
        breakoutOpen: row.open,
        breakoutHigh: row.high,
        breakoutLow: row.low,
        breakoutClose: row.close,
        previousClose,
        neckline: previous3High,
        previous3Low,
        breakoutPct:
          previous3High > 0
            ? ((row.close - previous3High) / previous3High) * 100
            : null,
        defense,
        stateBefore: "GREEN",
        stateAfter: "RED",
        endDate: null,
        endClose: null,
        endPrevious3Low: null,
        endReason: null
      };

      events.push(event);
      activeEvent = event;
      state = "RED";
      continue;
    }

    if (state === "RED" && row.close < previous3Low) {
      if (activeEvent && !activeEvent.endDate) {
        activeEvent.endDate = row.date;
        activeEvent.endClose = row.close;
        activeEvent.endPrevious3Low = previous3Low;
        activeEvent.endReason =
          "完成日K收盤跌破前三低，寶塔線由紅翻綠，該段戰術多方狀態結束";
      }

      activeEvent = null;
      state = "GREEN";
    }
  }

  const enrichedEvents = events.map(event =>
    enrichTacticalBreakoutEvent(sourceRows, event)
  );

  const active =
    state === "RED" && enrichedEvents.length
      ? enrichedEvents[enrichedEvents.length - 1]
      : null;

  const latestBreakout = enrichedEvents.length
    ? enrichedEvents[enrichedEvents.length - 1]
    : null;

  const previousBreakout = enrichedEvents.length >= 2
    ? enrichedEvents[enrichedEvents.length - 2]
    : null;

  return {
    algorithm,
    state:
      state === "RED"
        ? { key: "RED", icon: "🟥", label: "紅色｜持有／多方狀態" }
        : { key: "GREEN", icon: "🟩", label: "綠色｜空手／盤整狀態" },
    active: active ? summarizeTacticalBreakoutEvent(active) : null,
    latestBreakout: latestBreakout
      ? summarizeTacticalBreakoutEvent(latestBreakout)
      : null,
    previousBreakout: previousBreakout
      ? summarizeTacticalBreakoutEvent(previousBreakout)
      : null,
    history: enrichedEvents
      .slice(-20)
      .map(summarizeTacticalBreakoutEvent)
  };
}

function enrichTacticalBreakoutEvent(rows, event) {
  const endIndex = event.endDate
    ? rows.findIndex(row => row.date === event.endDate)
    : rows.length - 1;

  const effectiveEndIndex = endIndex >= event.index
    ? endIndex
    : rows.length - 1;

  const threeDay = buildTacticalThreeDayConfirmation(
    rows,
    event.index,
    event.breakoutLow,
    TACTICAL_N_THREE_DAY_BARS
  );

  const volume = buildRelativeVolumeSnapshot(rows, event.index, 20);

  const defenseRetest = detectTacticalDefenseRetest(
    rows,
    event.index,
    effectiveEndIndex,
    event.defense,
    TACTICAL_N_DEFENSE_NEAR_PCT
  );

  const defenseBreak = detectTacticalDefenseBreak(
    rows,
    event.index,
    effectiveEndIndex,
    event.defense
  );

  const latestIndex = Math.min(effectiveEndIndex, rows.length - 1);
  const latestRow = rows[latestIndex] || null;
  const previousRow = latestIndex > 0 ? rows[latestIndex - 1] : null;

  const latestChangePct =
    latestRow && previousRow && previousRow.close > 0
      ? ((latestRow.close - previousRow.close) / previousRow.close) * 100
      : null;

  return {
    ...event,
    threeDay,
    volume,
    defenseRetest,
    defenseBreak,
    latestDate: latestRow?.date || null,
    latestClose: latestRow?.close ?? null,
    latestLow: latestRow?.low ?? null,
    latestHigh: latestRow?.high ?? null,
    previousTradingDayClose: previousRow?.close ?? null,
    latestChangePct,
    daysSinceBreakout: Math.max(0, latestIndex - event.index)
  };
}

function buildTacticalThreeDayConfirmation(rows, breakoutIndex, day1Low, requiredBars) {
  const bars = [];

  for (
    let i = breakoutIndex;
    i < rows.length && bars.length < requiredBars;
    i++
  ) {
    const row = rows[i];
    bars.push({
      date: row.date,
      low: round(row.low, 2),
      close: round(row.close, 2),
      heldDay1Low: row.low >= day1Low
    });
  }

  const failedBar = bars.find(bar => bar.heldDay1Low === false) || null;
  const completed = bars.length >= requiredBars;

  let status;

  if (failedBar) {
    status = {
      key: "failed",
      icon: "⚠️",
      label: "三日防守未通過"
    };
  } else if (completed) {
    status = {
      key: "passed",
      icon: "🟢",
      label: "三日不破Day 1低點｜多頭確立"
    };
  } else {
    status = {
      key: "pending",
      icon: "🟡",
      label: `三日確認進行中（${bars.length}/${requiredBars}）`
    };
  }

  return {
    requiredBars,
    day1Low: round(day1Low, 2),
    daysAvailable: bars.length,
    bars,
    failedDate: failedBar?.date || null,
    status,
    rule:
      "綠翻紅後，自突破日算Day 1，連續3個完整交易日最低價不得跌破Day 1低點。"
  };
}

function detectTacticalDefenseRetest(rows, breakoutIndex, endIndex, defense, zonePct) {
  if (!Number.isFinite(defense) || defense <= 0) return null;

  const upper = defense * (1 + zonePct / 100);
  const lower = defense * (1 - zonePct / 100);

  for (let i = breakoutIndex + 1; i <= endIndex && i < rows.length; i++) {
    const row = rows[i];
    const touched = row.low <= upper && row.high >= lower;
    if (!touched) continue;

    const closeHeld = row.close >= defense;
    const snapshot = buildRelativeVolumeSnapshot(rows, i, 20);

    return {
      date: row.date,
      low: round(row.low, 2),
      high: round(row.high, 2),
      close: round(row.close, 2),
      defense: round(defense, 2),
      zonePct,
      closeHeld,
      relativeVolume20: round(snapshot?.relativeVolume20, 2),
      grade: closeHeld
        ? {
            key: "held",
            icon: "🟢",
            label: "回測軋空低附近後收盤守住"
          }
        : {
            key: "lost",
            icon: "⚠️",
            label: "回測軋空低後收盤失守"
          }
    };
  }

  return null;
}

function detectTacticalDefenseBreak(rows, breakoutIndex, endIndex, defense) {
  if (!Number.isFinite(defense)) return null;

  for (let i = breakoutIndex + 1; i <= endIndex && i < rows.length; i++) {
    const row = rows[i];
    if (row.close < defense) {
      return {
        date: row.date,
        close: round(row.close, 2),
        low: round(row.low, 2),
        defense: round(defense, 2),
        reason: "完成日K收盤跌破突破K軋空低／短線防守參考"
      };
    }
  }

  return null;
}

function summarizeTacticalBreakoutEvent(event) {
  if (!event) return null;

  return {
    status: event.endDate ? "ended" : "active",
    breakoutDate: event.breakoutDate,
    breakoutOpen: round(event.breakoutOpen, 2),
    breakoutHigh: round(event.breakoutHigh, 2),
    breakoutLow: round(event.breakoutLow, 2),
    breakoutClose: round(event.breakoutClose, 2),
    previousClose: round(event.previousClose, 2),
    neckline: round(event.neckline, 2),
    previous3Low: round(event.previous3Low, 2),
    breakoutPct: round(event.breakoutPct, 2),
    defense: round(event.defense, 2),
    defenseFormula: "Min{前一日收盤, 突破日最低}",
    threeDay: event.threeDay || null,
    volume: event.volume || null,
    defenseRetest: event.defenseRetest || null,
    defenseBreak: event.defenseBreak || null,
    latestDate: event.latestDate || null,
    latestClose: round(event.latestClose, 2),
    latestLow: round(event.latestLow, 2),
    latestHigh: round(event.latestHigh, 2),
    previousTradingDayClose: round(event.previousTradingDayClose, 2),
    latestChangePct: round(event.latestChangePct, 2),
    daysSinceBreakout: event.daysSinceBreakout,
    endDate: event.endDate || null,
    endClose: round(event.endClose, 2),
    endPrevious3Low: round(event.endPrevious3Low, 2),
    endReason: event.endReason || null
  };
}

function findAssociatedTacticalBreakout(tacticalN, cDate, fibBreakoutDate = null) {
  const history = Array.isArray(tacticalN?.history)
    ? tacticalN.history
    : [];

  if (!cDate || !history.length) return null;

  const candidates = history.filter(event => {
    if (!event?.breakoutDate) return false;
    if (event.breakoutDate <= cDate) return false;
    if (fibBreakoutDate && event.breakoutDate > fibBreakoutDate) return false;
    return true;
  });

  return candidates.length
    ? candidates[candidates.length - 1]
    : null;
}

function attachTacticalBreakoutsToFib(fib, tacticalN) {
  if (!fib || typeof fib !== "object") return fib;

  const result = { ...fib };

  const currentTactical = findAssociatedTacticalBreakout(
    tacticalN,
    fib.CDate,
    fib.breakoutDate
  );

  result.fibBreakoutDate = fib.breakoutDate || null;
  result.fibBreakoutClose = fib.breakoutClose ?? null;
  result.tacticalBreakout = currentTactical;
  result.tacticalBreakoutDate = currentTactical?.breakoutDate || null;
  result.tacticalBreakoutClose = currentTactical?.breakoutClose ?? null;
  result.tacticalNeckline = currentTactical?.neckline ?? null;
  result.tacticalDefense = currentTactical?.defense ?? null;

  const enrichHistorical = summary => {
    if (!summary) return null;

    const originalFibBreakoutDate = summary.breakoutDate || null;
    const originalFibBreakoutClose = summary.breakoutClose ?? null;
    const tactical = findAssociatedTacticalBreakout(
      tacticalN,
      summary.CDate,
      originalFibBreakoutDate
    );

    if (!tactical) {
      return {
        ...summary,
        fibBreakoutDate: originalFibBreakoutDate,
        fibBreakoutClose: originalFibBreakoutClose,
        tacticalBreakout: null,
        tacticalBreakoutDate: null,
        tacticalBreakoutClose: null,
        tacticalNeckline: null,
        tacticalDefense: null
      };
    }

    return {
      ...summary,
      breakoutDate: originalFibBreakoutDate,
      breakoutClose: originalFibBreakoutClose,
      fibBreakoutDate: originalFibBreakoutDate,
      fibBreakoutClose: originalFibBreakoutClose,
      tacticalBreakout: tactical,
      tacticalBreakoutDate: tactical.breakoutDate,
      tacticalBreakoutClose: tactical.breakoutClose,
      tacticalNeckline: tactical.neckline,
      tacticalDefense: tactical.defense
    };
  };

  result.lastFailedFib = enrichHistorical(fib.lastFailedFib);
  result.lastCompletedFib = enrichHistorical(fib.lastCompletedFib);

  return result;
}

function analyzeTacticalSignals(
  rows,
  fib,
  tacticalN,
  volume,
  structure,
  monthlyActive,
  latestClose,
  dailyRsi5
) {
  const sourceRows = Array.isArray(rows)
    ? rows
        .filter(isValidDailyRow)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const breakout = structure?.breakout || null;
  const maKey = structure?.dailyMA20?.direction?.key || "unknown";
  const relVol = numberOrNull(volume?.latest?.relativeVolume20);
  const breakoutRelVol = numberOrNull(breakout?.volume?.relativeVolume20);
  const threeDayKey = breakout?.threeDay?.status?.key || null;
  const retestHeld = breakout?.retest?.closeHeld === true;
  const hasReattack = !!breakout?.reattack;
  const falseRiskKey = breakout?.falseBreakoutRisk?.level?.key || "low";
  const breakoutPct = numberOrNull(breakout?.breakoutPct);
  const currentStatus = fib?.status || "not_formed";

  const tacticalActive = tacticalN?.active || null;
  const tacticalState = tacticalN?.state?.key || "UNKNOWN";
  const tacticalThreeDayKey = tacticalActive?.threeDay?.status?.key || null;
  const tacticalDefense = numberOrNull(tacticalActive?.defense);
  const tacticalBreakoutRelVol = numberOrNull(
    tacticalActive?.volume?.relativeVolume20
  );

  const fibBreakoutIsPrimary =
    currentStatus === "confirmed";

  const tacticalBreakoutIsPrimary =
    currentStatus !== "confirmed" &&
    !!tacticalActive;

  const primaryBreakoutType =
    fibBreakoutIsPrimary
      ? "fib"
      : tacticalBreakoutIsPrimary
        ? "tactical"
        : null;

  const fibBreakoutDefense =
    breakout?.defense ||
    null;

  const tacticalBreakoutDefense =
    tacticalActive
      ? {
          label: "戰術N字／軋空低短線防守",
          level: round(tacticalActive.defense, 2),
          previousClose: round(tacticalActive.previousClose, 2),
          breakoutLow: round(tacticalActive.breakoutLow, 2),
          breakoutDate: tacticalActive.breakoutDate || null,
          neckline: round(tacticalActive.neckline, 2),
          formula: "Min{突破前一日收盤, 突破日最低}",
          note:
            "依舊版綠翻紅突破K規則；不取代Fibonacci 0.764深度風控。"
        }
      : null;

  const primaryBreakoutDefense =
    primaryBreakoutType === "fib"
      ? fibBreakoutDefense
      : primaryBreakoutType === "tactical"
        ? tacticalBreakoutDefense
        : null;

  const primaryThreeDayConfirmation =
    primaryBreakoutType === "fib"
      ? breakout?.threeDay || null
      : primaryBreakoutType === "tactical"
        ? tacticalActive?.threeDay || null
        : null;

  const primaryBreakoutRelativeVolume20 =
    primaryBreakoutType === "fib"
      ? breakoutRelVol
      : primaryBreakoutType === "tactical"
        ? tacticalBreakoutRelVol
        : null;

  const primaryBreakout =
    primaryBreakoutType === "fib"
      ? {
          type: "fib",
          icon: "📐",
          label: "Fibonacci Swing B 突破",
          date: breakout?.date || fib?.fibBreakoutDate || fib?.breakoutDate || null,
          close: round(breakout?.close ?? fib?.fibBreakoutClose ?? fib?.breakoutClose, 2),
          referenceLabel: "Swing B",
          referencePrice: round(fib?.B, 2)
        }
      : primaryBreakoutType === "tactical"
        ? {
            type: "tactical",
            icon: "🔥",
            label: "戰術N字前三高突破",
            date: tacticalActive?.breakoutDate || null,
            close: round(tacticalActive?.breakoutClose, 2),
            referenceLabel: "前三高頸線",
            referencePrice: round(tacticalActive?.neckline, 2)
          }
        : null;

  const latestRow = sourceRows.length ? sourceRows[sourceRows.length - 1] : null;
  const previousRow = sourceRows.length >= 2 ? sourceRows[sourceRows.length - 2] : null;
  const latestChangePct =
    latestRow && previousRow && previousRow.close > 0
      ? ((latestRow.close - previousRow.close) / previousRow.close) * 100
      : null;

  const tacticalDefenseTouchedToday =
    tacticalActive &&
    tacticalDefense !== null &&
    latestRow &&
    latestRow.low <= tacticalDefense * (1 + TACTICAL_N_DEFENSE_NEAR_PCT / 100) &&
    latestRow.high >= tacticalDefense * (1 - TACTICAL_N_DEFENSE_NEAR_PCT / 100) &&
    latestRow.close >= tacticalDefense;

  const tacticalSuperToday =
    tacticalActive &&
    latestRow &&
    previousRow &&
    (
      latestRow.low > previousRow.close ||
      (latestChangePct !== null && latestChangePct >= 4)
    );

  let mode = {
    key: "consolidation",
    icon: "➖",
    label: "模式三：盤整等待",
    shortLabel: "盤整等待"
  };

  let subtype = {
    key: "waiting",
    icon: "➖",
    label: "觀望等待",
    description: "目前尚未具備足夠條件判定為正式趨勢延伸。"
  };

  if (currentStatus === "confirmed") {
    const superStrong =
      !retestHeld &&
      breakoutPct !== null &&
      breakoutPct >= 3 &&
      breakoutRelVol !== null &&
      breakoutRelVol >= 1.5 &&
      maKey === "up" &&
      threeDayKey === "passed" &&
      falseRiskKey !== "high";

    const squeeze =
      !retestHeld &&
      threeDayKey === "passed" &&
      falseRiskKey !== "high";

    if (retestHeld && falseRiskKey !== "high") {
      mode = {
        key: "extreme_bull",
        icon: "🚀",
        label: "模式一：極強模式",
        shortLabel: "極強"
      };

      subtype = {
        key: hasReattack ? "solid_bull_reattack" : "solid_bull",
        icon: "🛡️",
        label: "盤堅盤",
        description: hasReattack
          ? "目前Fibonacci N突破後曾回測前高B附近守住，之後再度上攻，形成「突破→回測→再攻」的穩健推升結構。"
          : "目前Fibonacci N突破後回測前高B附近，完成日K收盤仍能守住，屬盤堅回測型。"
      };
    } else if (superStrong) {
      mode = {
        key: "extreme_bull",
        icon: "🚀",
        label: "模式一：極強模式",
        shortLabel: "極強"
      };

      subtype = {
        key: "super_squeeze",
        icon: "🔥",
        label: "強軋空盤",
        description:
          "目前Fibonacci N突破後沒有明顯回測B，且突破幅度、量能、日20MA與三日站穩多項條件同步偏強，屬趨勢快速延伸型。"
      };
    } else if (squeeze) {
      mode = {
        key: "extreme_bull",
        icon: "🚀",
        label: "模式一：極強模式",
        shortLabel: "極強"
      };

      subtype = {
        key: "short_squeeze",
        icon: "🚩",
        label: "軋空盤",
        description:
          "目前Fibonacci N突破後持續維持在B上方，沒有明顯回測B，較接近高檔強勢整理、以盤代跌的型態。"
      };
    } else {
      mode = {
        key: "breakout",
        icon: "🔥",
        label: "模式二：突破模式",
        shortLabel: "突破啟動"
      };

      subtype = {
        key: "breakout_start",
        icon: "🔥",
        label: "突破啟動",
        description:
          "Fibonacci N已正式收盤突破Swing B，但尚未具備盤堅、軋空或強軋空的完整條件。"
      };
    }
  } else if (tacticalState === "RED" && tacticalActive) {
    if (tacticalThreeDayKey === "pending") {
      mode = {
        key: "breakout",
        icon: "🔥",
        label: "模式二：突破模式",
        shortLabel: "突破啟動"
      };

      subtype = {
        key: "tactical_breakout_start",
        icon: "🔥",
        label: "突破啟動",
        description:
          `完成日K已突破前三高頸線 ${fmtNumberForText(tacticalActive.neckline)}，寶塔線由綠翻紅；目前三日原則仍在確認中。`
      };
    } else if (tacticalDefenseTouchedToday) {
      mode = {
        key: "extreme_bull",
        icon: "🚀",
        label: "模式一：極強模式",
        shortLabel: "極強"
      };

      subtype = {
        key: "tactical_solid_bull",
        icon: "🛡️",
        label: "盤堅盤",
        description:
          "戰術N字已翻紅，今日回測軋空低／防守點附近後仍守住，屬穩健推升型。"
      };
    } else if (tacticalSuperToday && tacticalThreeDayKey === "passed") {
      mode = {
        key: "extreme_bull",
        icon: "🚀",
        label: "模式一：極強模式",
        shortLabel: "極強"
      };

      subtype = {
        key: "tactical_super_squeeze",
        icon: "🔥",
        label: "強軋空盤",
        description:
          "戰術N字三日原則已通過，且今日呈現跳空／大漲等快速脫離特徵，屬強軋空盤。"
      };
    } else if (tacticalThreeDayKey === "passed") {
      mode = {
        key: "extreme_bull",
        icon: "🚀",
        label: "模式一：極強模式",
        shortLabel: "極強"
      };

      subtype = {
        key: "tactical_short_squeeze",
        icon: "🚩",
        label: "軋空盤",
        description:
          "戰術N字三日原則已通過，價格仍維持翻紅狀態且未回測軋空低，較接近高檔強勢整理。"
      };
    } else {
      mode = {
        key: "breakout",
        icon: "🔥",
        label: "模式二：突破模式",
        shortLabel: "突破啟動"
      };

      subtype = {
        key: "tactical_breakout_watch",
        icon: "🟡",
        label: "突破後觀察",
        description:
          "已出現前三高突破，但三日防守品質未通過或仍不足；Fibonacci與戰術N字狀態分開解讀。"
      };
    }
  } else if (currentStatus === "forming") {
    mode = {
      key: "consolidation",
      icon: "➖",
      label: "模式三：盤整等待",
      shortLabel: "盤整等待"
    };

    subtype = {
      key: "forming",
      icon: "🟡",
      label: "N字形成中",
      description:
        "Fibonacci A→B→C已形成，但目前沒有有效的戰術綠翻紅狀態，仍屬C後回升／整理觀察。"
    };
  } else {
    const recentFailedDate = fib?.lastFailedFib?.failedDate || null;
    let barsSinceFailed = null;

    if (recentFailedDate && sourceRows.length) {
      const failedIndex = sourceRows.findIndex(
        row => row.date === recentFailedDate
      );

      if (failedIndex >= 0) {
        barsSinceFailed = sourceRows.length - 1 - failedIndex;
      }
    }

    const weakening =
      monthlyActive === false &&
      maKey === "down" &&
      barsSinceFailed !== null &&
      barsSinceFailed <= 10;

    if (weakening) {
      mode = {
        key: "weakening",
        icon: "💀",
        label: "模式四：結構轉弱",
        shortLabel: "結構轉弱"
      };

      subtype = {
        key: "slow_bear",
        icon: "📉",
        label: "盤跌盤／轉弱觀察",
        description:
          "近期曾出現N字失敗，而且日20MA向下、月線條件未成立，整體價格結構偏弱；但仍不直接等同自動放空訊號。"
      };
    } else {
      mode = {
        key: "consolidation",
        icon: "➖",
        label: "模式三：盤整等待",
        shortLabel: "盤整等待"
      };

      subtype = {
        key:
          fib?.A !== null && fib?.B !== null
            ? "waiting_c"
            : "waiting_new_pattern",
        icon: "➖",
        label:
          fib?.A !== null && fib?.B !== null
            ? "等待有效C"
            : "等待新結構",
        description:
          fib?.A !== null && fib?.B !== null
            ? "目前已經形成新的A→B，但尚未出現符合規則的有效C，且戰術寶塔線未處於有效翻紅狀態。"
            : "目前沒有新的有效Fibonacci N字，也沒有有效戰術翻紅狀態，先等待下一組價格結構。"
      };
    }
  }

  const rsi = numberOrNull(dailyRsi5);

  let heat = {
    key: "neutral",
    icon: "🟡",
    label: "中性"
  };

  if (rsi !== null) {
    if (rsi >= 90) {
      heat = { key: "extreme_hot", icon: "⚠️", label: "極度過熱" };
    } else if (rsi >= 80) {
      heat = { key: "hot", icon: "⚠️", label: "過熱" };
    } else if (rsi >= 70) {
      heat = { key: "high", icon: "⚠️", label: "偏高" };
    } else if (rsi >= 60) {
      heat = { key: "strong", icon: "🟡", label: "偏強但尚未過熱" };
    } else if (rsi < 40) {
      heat = { key: "weak", icon: "🟡", label: "偏弱" };
    }
  }

  return {
    framework: "四大模式新手翻譯層＋戰術N字前三高突破",
    mode,
    subtype,
    monthlyActive: !!monthlyActive,
    fibStatus: currentStatus,
    tacticalNState: tacticalState,
    tacticalNActive: tacticalActive,
    currentPrice: round(latestClose, 2),
    dailyRsi5: round(rsi, 2),
    rsiHeat: heat,
    latestRelativeVolume20: round(relVol, 2),

    primaryBreakoutType,
    primaryBreakout,

    breakoutRelativeVolume20: round(primaryBreakoutRelativeVolume20, 2),
    breakoutDefense: primaryBreakoutDefense,
    threeDayConfirmation: primaryThreeDayConfirmation,

    fibBreakoutRelativeVolume20: round(breakoutRelVol, 2),
    fibBreakoutDefense,
    fibThreeDayConfirmation: breakout?.threeDay || null,

    tacticalBreakoutRelativeVolume20: round(tacticalBreakoutRelVol, 2),
    tacticalBreakoutDefense,
    tacticalThreeDayConfirmation: tacticalActive?.threeDay || null,

    nextDayStrength:
      primaryBreakoutType === "fib"
        ? breakout?.nextDayStrength || null
        : null,
    retest:
      primaryBreakoutType === "fib"
        ? breakout?.retest || null
        : null,
    reattack:
      primaryBreakoutType === "fib"
        ? breakout?.reattack || null
        : null,
    falseBreakoutRisk:
      primaryBreakoutType === "fib"
        ? breakout?.falseBreakoutRisk || null
        : null,

    fibNextDayStrength: breakout?.nextDayStrength || null,
    fibRetest: breakout?.retest || null,
    fibReattack: breakout?.reattack || null,
    fibFalseBreakoutRisk: breakout?.falseBreakoutRisk || null,

    tacticalDefenseRetest: tacticalActive?.defenseRetest || null,
    tacticalDefenseBreak: tacticalActive?.defenseBreak || null,

    marketPhase: structure?.phase || null,
    classificationRules: {
      tacticalBreakout:
        "完成日K收盤 > 前三個完整交易日最高價的最大值時，視為舊版寶塔線綠翻紅／戰術N字突破啟動；不必等待Swing B右側3根K確認。",
      tacticalThreeDay:
        "綠翻紅後，自突破日算Day1，連續3個完整交易日Low不得跌破Day1 Low。",
      solidBull:
        "目前Fib N confirmed後，若有回測B且完成日K守住，仍優先保留已驗證的盤堅盤分類；未confirmed時則以軋空低附近回測守住判斷戰術盤堅。",
      superSqueeze:
        "費波那契N字已確認時沿用強軋空條件；尚未確認但戰術N字已翻紅時，三日防守通過且當日跳空／大漲可判為戰術強軋空。",
      shortSqueeze:
        "戰術N三日防守通過、仍維持紅色狀態且未回測防守點時，可視為軋空盤／以盤代跌。"
    },
    note:
      "V40 歷史雙突破欄位統一：戰術N字負責『何時由弱轉強／突破啟動』；費波那契N字負責A／B／C、0.618、0.764、1.618與失效／完成生命週期。費波那契N字已確認時，通用突破欄位指向費波那契事件；尚未確認時才由有效戰術N字事件接手。內部欄位名稱維持相容，不影響正式計算。"
  };
}

function fmtNumberForText(value) {
  const x = numberOrNull(value);
  return x === null ? "-" : round(x, 2).toFixed(2);
}

function analyzeFibonacciNPattern(rows, latestClose) {
  const sourceRows = Array.isArray(rows)
    ? rows
        .filter(isValidDailyRow)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-FIB_LOOKBACK_DAYS)
    : [];

  const algorithm = {
    name: "pivot-abc-v2.4",
    lookbackDays: FIB_LOOKBACK_DAYS,
    pivotLeft: FIB_PIVOT_LEFT,
    pivotRight: FIB_PIVOT_RIGHT,
    minABPct: round(FIB_MIN_AB_PCT * 100, 2),
    minRetraceOfABPct: round(FIB_MIN_RETRACE_OF_AB * 100, 2),
    maxRetraceOfABPct: round(FIB_MAX_RETRACE_OF_AB * 100, 2),
    breakoutRule: "C形成後，任一已完成日K收盤價 > B，才算突破確認",
    invalidationRule:
      "尚未突破B前，任一已完成日K最低價 < A，該組A/B/C立即失效並重新尋找新的N字",
    cUpdateRule:
      "尚未突破B前，如後續形成更低的Swing Low，且仍滿足A < C < B及15%～85%回撤規則，C更新為新的較低Swing Low",
    completionRule:
      "突破B後，任一已完成日K最高價 >= 1.618延伸目標，該組N字標記completed並退出目前有效N字",
    postBreakFailureRule:
      "突破B後、尚未達1.618前，若任一已完成日K收盤價 < 0.764深度風控位，或日K最低價 < A，該組N字標記failed並退出目前有效N字",
    selectionRule:
      "completed或failed的N字不再當目前N字；目前有效N字的A之Swing確認日必須晚於最近一次completed/failed終止日"
  };

  const minimumRows = FIB_PIVOT_LEFT + FIB_PIVOT_RIGHT + 7;
  if (sourceRows.length < minimumRows) {
    return makeFibNotFormedResult(
      "N字尚未形成：有效日K資料不足。",
      null,
      null,
      null,
      null,
      algorithm
    );
  }

  const pivots = normalizeSwingPivots(
    detectSwingPivots(sourceRows, FIB_PIVOT_LEFT, FIB_PIVOT_RIGHT)
  );

  const activePatterns = [];
  const completedPatterns = [];
  const failedPatterns = [];
  let latestInvalidated = null;

  for (let i = 0; i < pivots.length - 2; i++) {
    const A = pivots[i];
    const B = pivots[i + 1];
    const C = pivots[i + 2];

    if (A.type !== "low" || B.type !== "high" || C.type !== "low") continue;

    const AB = B.price - A.price;
    const abPct = A.price > 0 ? AB / A.price : 0;

    if (AB <= 0 || abPct < FIB_MIN_AB_PCT) continue;
    if (!(C.price > A.price && C.price < B.price)) continue;

    const retraceRatio = (B.price - C.price) / AB;
    if (
      retraceRatio < FIB_MIN_RETRACE_OF_AB ||
      retraceRatio > FIB_MAX_RETRACE_OF_AB
    ) {
      continue;
    }

    const lifecycle = evaluateFibonacciPatternLifecycle(
      { A, B, C, AB, abPct, retraceRatio },
      sourceRows,
      pivots
    );

    if (lifecycle.status === "invalidated") {
      if (
        !latestInvalidated ||
        lifecycle.invalidatedDate > latestInvalidated.invalidatedDate
      ) {
        latestInvalidated = lifecycle;
      }
      continue;
    }

    if (lifecycle.status === "completed") {
      completedPatterns.push(lifecycle);
      continue;
    }

    if (lifecycle.status === "failed") {
      failedPatterns.push(lifecycle);
      continue;
    }

    activePatterns.push(lifecycle);
  }

  completedPatterns.sort((x, y) => {
    const xDate = x.completedDate || x.C.date;
    const yDate = y.completedDate || y.C.date;
    const byDate = yDate.localeCompare(xDate);
    if (byDate !== 0) return byDate;
    return y.C.date.localeCompare(x.C.date);
  });

  failedPatterns.sort((x, y) => {
    const xDate = x.failedDate || x.C.date;
    const yDate = y.failedDate || y.C.date;
    const byDate = yDate.localeCompare(xDate);
    if (byDate !== 0) return byDate;
    return y.C.date.localeCompare(x.C.date);
  });

  const latestCompleted = completedPatterns.length ? completedPatterns[0] : null;
  const latestFailed = failedPatterns.length ? failedPatterns[0] : null;

  const terminalEvents = [];
  if (latestCompleted?.completedDate) {
    terminalEvents.push({
      type: "completed",
      date: latestCompleted.completedDate,
      pattern: latestCompleted
    });
  }
  if (latestFailed?.failedDate) {
    terminalEvents.push({
      type: "failed",
      date: latestFailed.failedDate,
      pattern: latestFailed
    });
  }

  terminalEvents.sort((a, b) => b.date.localeCompare(a.date));
  const latestTerminal = terminalEvents.length ? terminalEvents[0] : null;
  const afterDate = latestTerminal ? latestTerminal.date : null;

  const currentPatterns = afterDate
    ? activePatterns.filter(pattern => getPivotConfirmDate(pattern.A) > afterDate)
    : activePatterns;

  if (currentPatterns.length === 0) {
    const latestAB = findLatestActiveABPattern(pivots, sourceRows, afterDate);

    const relevantInvalidated =
      latestInvalidated &&
      (!afterDate || latestInvalidated.invalidatedDate > afterDate)
        ? latestInvalidated
        : null;

    let message;

    if (latestAB) {
      message = "N字尚未形成：目前只有新的有效 A → B，尚未出現符合規則的 C。";
    } else if (relevantInvalidated) {
      message = "N字尚未形成：最近一組 A → B → C 已失效，系統正在等待新的有效N字。";
    } else if (latestTerminal?.type === "failed") {
      message = "上一組已確認N字已觸發突破後失敗條件；目前尚無新的有效N字。";
    } else if (latestTerminal?.type === "completed") {
      message = "上一組N字已完成1.618目標；目前尚無新的有效N字。";
    } else {
      message = "N字尚未形成：尚未找到符合規則的有效 A → B。";
    }

    return makeFibNotFormedResult(
      message,
      latestAB,
      relevantInvalidated,
      latestCompleted,
      latestFailed,
      algorithm
    );
  }

  currentPatterns.sort((x, y) => {
    const byC = y.C.date.localeCompare(x.C.date);
    if (byC !== 0) return byC;

    const byB = y.B.date.localeCompare(x.B.date);
    if (byB !== 0) return byB;

    return y.A.date.localeCompare(x.A.date);
  });

  return buildFibPatternResult(
    currentPatterns[0],
    latestClose,
    latestCompleted,
    latestFailed,
    algorithm
  );
}

function evaluateFibonacciPatternLifecycle(candidate, sourceRows, pivots) {
  const A = candidate.A;
  const B = candidate.B;
  const AB = candidate.AB;

  let C = candidate.C;
  let retraceRatio = candidate.retraceRatio;
  const initialC = candidate.C;
  let cUpdateCount = 0;

  let breakoutRow = null;
  let target1618 = null;

  const stop764 = B.price - AB * 0.764;

  const pivotLowByDate = new Map(
    pivots
      .filter(pivot => pivot.type === "low" && pivot.date > initialC.date)
      .map(pivot => [pivot.date, pivot])
  );

  const rowsAfterInitialC = sourceRows.filter(row => row.date > initialC.date);

  for (const row of rowsAfterInitialC) {
    if (!breakoutRow) {
      if (row.low < A.price) {
        return {
          ...candidate,
          C,
          retraceRatio,
          initialC,
          cUpdateCount,
          status: "invalidated",
          confirmed: false,
          breakoutRow: null,
          completedRow: null,
          completedDate: null,
          completedHigh: null,
          failedRow: null,
          failedDate: null,
          failedClose: null,
          failedLow: null,
          stop764,
          target1618: null,
          invalidatedDate: row.date,
          invalidatedPrice: row.low,
          invalidatedReason:
            "C形成後、尚未突破B前價格跌破A，原A/B/C結構失效"
        };
      }

      const newPivotLow = pivotLowByDate.get(row.date);

      if (newPivotLow && newPivotLow.price < C.price) {
        const newRetraceRatio = (B.price - newPivotLow.price) / AB;

        if (
          newPivotLow.price <= A.price ||
          newRetraceRatio > FIB_MAX_RETRACE_OF_AB
        ) {
          return {
            ...candidate,
            C,
            retraceRatio,
            initialC,
            cUpdateCount,
            status: "invalidated",
            confirmed: false,
            breakoutRow: null,
            completedRow: null,
            completedDate: null,
            completedHigh: null,
            failedRow: null,
            failedDate: null,
            failedClose: null,
            failedLow: null,
            stop764,
            target1618: null,
            invalidatedDate: newPivotLow.date,
            invalidatedPrice: newPivotLow.price,
            invalidatedReason:
              newPivotLow.price <= A.price
                ? "新的Swing Low跌破或等於A，原A/B/C結構失效"
                : "新的Swing Low回撤超過允許上限，原A/B/C結構失效"
          };
        }

        if (newRetraceRatio >= FIB_MIN_RETRACE_OF_AB) {
          C = newPivotLow;
          retraceRatio = newRetraceRatio;
          cUpdateCount++;
        }
      }

      if (row.close > B.price) {
        breakoutRow = row;
        target1618 = C.price + AB * 1.618;

        if (row.high >= target1618) {
          return {
            ...candidate,
            C,
            retraceRatio,
            initialC,
            cUpdateCount,
            status: "completed",
            confirmed: true,
            breakoutRow,
            completedRow: row,
            completedDate: row.date,
            completedHigh: row.high,
            failedRow: null,
            failedDate: null,
            failedClose: null,
            failedLow: null,
            stop764,
            target1618,
            invalidatedDate: null,
            invalidatedPrice: null,
            invalidatedReason: null
          };
        }
      }

      continue;
    }

    if (row.high >= target1618) {
      return {
        ...candidate,
        C,
        retraceRatio,
        initialC,
        cUpdateCount,
        status: "completed",
        confirmed: true,
        breakoutRow,
        completedRow: row,
        completedDate: row.date,
        completedHigh: row.high,
        failedRow: null,
        failedDate: null,
        failedClose: null,
        failedLow: null,
        stop764,
        target1618,
        invalidatedDate: null,
        invalidatedPrice: null,
        invalidatedReason: null
      };
    }

    if (row.low < A.price) {
      return {
        ...candidate,
        C,
        retraceRatio,
        initialC,
        cUpdateCount,
        status: "failed",
        confirmed: false,
        breakoutRow,
        completedRow: null,
        completedDate: null,
        completedHigh: null,
        failedRow: row,
        failedDate: row.date,
        failedClose: row.close,
        failedLow: row.low,
        failureReason: "突破B後、尚未達1.618前，日K最低價跌破A，該組N字視為突破失敗",
        stop764,
        target1618,
        invalidatedDate: null,
        invalidatedPrice: null,
        invalidatedReason: null
      };
    }

    if (row.close < stop764) {
      return {
        ...candidate,
        C,
        retraceRatio,
        initialC,
        cUpdateCount,
        status: "failed",
        confirmed: false,
        breakoutRow,
        completedRow: null,
        completedDate: null,
        completedHigh: null,
        failedRow: row,
        failedDate: row.date,
        failedClose: row.close,
        failedLow: row.low,
        failureReason: "突破B後、尚未達1.618前，完成日K收盤跌破0.764深度風控位，該組N字視為突破失敗",
        stop764,
        target1618,
        invalidatedDate: null,
        invalidatedPrice: null,
        invalidatedReason: null
      };
    }
  }

  if (breakoutRow) {
    return {
      ...candidate,
      C,
      retraceRatio,
      initialC,
      cUpdateCount,
      status: "confirmed",
      confirmed: true,
      breakoutRow,
      completedRow: null,
      completedDate: null,
      completedHigh: null,
      failedRow: null,
      failedDate: null,
      failedClose: null,
      failedLow: null,
      stop764,
      target1618,
      invalidatedDate: null,
      invalidatedPrice: null,
      invalidatedReason: null
    };
  }

  return {
    ...candidate,
    C,
    retraceRatio,
    initialC,
    cUpdateCount,
    status: "forming",
    confirmed: false,
    breakoutRow: null,
    completedRow: null,
    completedDate: null,
    completedHigh: null,
    failedRow: null,
    failedDate: null,
    failedClose: null,
    failedLow: null,
    stop764,
    target1618: null,
    invalidatedDate: null,
    invalidatedPrice: null,
    invalidatedReason: null
  };
}

function findLatestActiveABPattern(pivots, sourceRows, afterDate = null) {
  let latestAB = null;

  for (let i = 0; i < pivots.length - 1; i++) {
    const A = pivots[i];
    const B = pivots[i + 1];

    if (A.type !== "low" || B.type !== "high") continue;
    if (afterDate && getPivotConfirmDate(A) <= afterDate) continue;

    const AB = B.price - A.price;
    const abPct = A.price > 0 ? AB / A.price : 0;

    if (AB <= 0 || abPct < FIB_MIN_AB_PCT) continue;

    const broken = sourceRows.some(
      row => row.date > B.date && row.low < A.price
    );

    if (broken) continue;

    latestAB = { A, B, AB, abPct };
  }

  return latestAB;
}

function buildFibPatternResult(
  pattern,
  latestClose,
  latestCompleted,
  latestFailed,
  algorithm
) {
  const A = pattern.A;
  const B = pattern.B;
  const C = pattern.C;
  const AB = pattern.AB;
  const retraceRatio = pattern.retraceRatio;
  const breakoutRow = pattern.breakoutRow || null;
  const confirmed = pattern.status === "confirmed";

  const retracement = {
    "0.382": round(B.price - AB * 0.382, 2),
    "0.500": round(B.price - AB * 0.5, 2),
    "0.618": round(B.price - AB * 0.618, 2),
    "0.764": round(B.price - AB * 0.764, 2)
  };

  const extension = {
    "1.000": round(C.price + AB * 1.0, 2),
    "1.272": round(C.price + AB * 1.272, 2),
    "1.382": round(C.price + AB * 1.382, 2),
    "1.618": round(C.price + AB * 1.618, 2),
    "2.000": round(C.price + AB * 2.0, 2),
    "2.618": round(C.price + AB * 2.618, 2)
  };

  const support618 = retracement["0.618"];
  const stop764 = retracement["0.764"];
  const target1618 = extension["1.618"];

  const close = Number.isFinite(Number(latestClose)) ? Number(latestClose) : null;

  const distanceToSupport618Pct =
    close && close > 0 ? ((close - support618) / close) * 100 : null;

  const distanceToTarget1618Pct =
    close && close > 0 ? ((target1618 - close) / close) * 100 : null;

  const risk = close !== null ? close - stop764 : null;
  const potentialReward = close !== null ? target1618 - close : null;

  const riskRewardRatio =
    risk !== null &&
    potentialReward !== null &&
    risk > 0 &&
    potentialReward > 0
      ? potentialReward / risk
      : null;

  return {
    status: confirmed ? "confirmed" : "forming",
    confirmed,
    message: confirmed
      ? "N字突破確認；1.618主要目標尚未完成。"
      : "N字形成中；延伸目標為預估／未確認。",

    A: round(A.price, 2),
    ADate: A.date,
    B: round(B.price, 2),
    BDate: B.date,
    C: round(C.price, 2),
    CDate: C.date,

    initialC: round(pattern.initialC.price, 2),
    initialCDate: pattern.initialC.date,
    cUpdateCount: pattern.cUpdateCount,

    AB: round(AB, 2),
    retraceDepthPct: round(retraceRatio * 100, 2),

    breakoutDate: breakoutRow ? breakoutRow.date : null,
    breakoutClose: breakoutRow ? round(breakoutRow.close, 2) : null,

    retracement,
    extension,
    support618,
    stop764,
    target1618,

    metrics: {
      distanceToSupport618Pct: round(distanceToSupport618Pct, 2),
      distanceToTarget1618Pct: round(distanceToTarget1618Pct, 2),
      risk: round(risk, 2),
      potentialReward: round(potentialReward, 2),
      riskRewardRatio: round(riskRewardRatio, 2),
      riskReward:
        riskRewardRatio !== null
          ? `1 : ${round(riskRewardRatio, 2).toFixed(2)}`
          : null
    },

    lastFailedFib: summarizeFailedFibPattern(latestFailed),
    lastCompletedFib: summarizeCompletedFibPattern(latestCompleted),
    algorithm
  };
}

function makeFibNotFormedResult(
  message,
  latestAB,
  latestInvalidated,
  latestCompleted,
  latestFailed,
  algorithm
) {
  return {
    status: "not_formed",
    confirmed: false,
    message,

    A: latestAB ? round(latestAB.A.price, 2) : null,
    ADate: latestAB ? latestAB.A.date : null,
    B: latestAB ? round(latestAB.B.price, 2) : null,
    BDate: latestAB ? latestAB.B.date : null,
    C: null,
    CDate: null,
    AB: latestAB ? round(latestAB.AB, 2) : null,

    retracement: null,
    extension: null,
    support618: null,
    stop764: null,
    target1618: null,
    metrics: null,

    lastInvalidation: latestInvalidated
      ? {
          date: latestInvalidated.invalidatedDate,
          price: round(latestInvalidated.invalidatedPrice, 2),
          reason: latestInvalidated.invalidatedReason,
          A: round(latestInvalidated.A.price, 2),
          ADate: latestInvalidated.A.date,
          B: round(latestInvalidated.B.price, 2),
          BDate: latestInvalidated.B.date,
          C: round(latestInvalidated.C.price, 2),
          CDate: latestInvalidated.C.date
        }
      : null,

    lastFailedFib: summarizeFailedFibPattern(latestFailed),
    lastCompletedFib: summarizeCompletedFibPattern(latestCompleted),
    algorithm
  };
}

function summarizeFailedFibPattern(pattern) {
  if (!pattern) return null;

  const stop764 =
    pattern.stop764 ?? pattern.B.price - pattern.AB * 0.764;

  const target1618 =
    pattern.target1618 ?? pattern.C.price + pattern.AB * 1.618;

  return {
    status: "failed",
    message: "上一組已確認N字在達成1.618前觸發突破後失敗條件，已退出目前有效N字。",
    A: round(pattern.A.price, 2),
    ADate: pattern.A.date,
    B: round(pattern.B.price, 2),
    BDate: pattern.B.date,
    C: round(pattern.C.price, 2),
    CDate: pattern.C.date,
    AB: round(pattern.AB, 2),
    breakoutDate: pattern.breakoutRow ? pattern.breakoutRow.date : null,
    breakoutClose: pattern.breakoutRow ? round(pattern.breakoutRow.close, 2) : null,
    stop764: round(stop764, 2),
    target1618: round(target1618, 2),
    failedDate: pattern.failedDate || null,
    failedClose: round(pattern.failedClose, 2),
    failedLow: round(pattern.failedLow, 2),
    reason: pattern.failureReason || null
  };
}

function summarizeCompletedFibPattern(pattern) {
  if (!pattern) return null;

  const target1618 =
    pattern.target1618 ?? pattern.C.price + pattern.AB * 1.618;

  return {
    status: "completed",
    message: "上一組N字已達1.618主要目標，已退出目前有效N字。",
    A: round(pattern.A.price, 2),
    ADate: pattern.A.date,
    B: round(pattern.B.price, 2),
    BDate: pattern.B.date,
    C: round(pattern.C.price, 2),
    CDate: pattern.C.date,
    AB: round(pattern.AB, 2),
    breakoutDate: pattern.breakoutRow ? pattern.breakoutRow.date : null,
    breakoutClose: pattern.breakoutRow ? round(pattern.breakoutRow.close, 2) : null,
    target1618: round(target1618, 2),
    completedDate: pattern.completedDate || null,
    completedHigh: round(pattern.completedHigh, 2)
  };
}

function detectSwingPivots(rows, left, right) {
  const pivots = [];

  for (let i = left; i < rows.length - right; i++) {
    const row = rows[i];
    const windowRows = rows.slice(i - left, i + right + 1);

    const minLow = Math.min(...windowRows.map(item => item.low));
    const maxHigh = Math.max(...windowRows.map(item => item.high));

    const isLow =
      row.low === minLow &&
      row.low < rows[i - 1].low &&
      row.low < rows[i + 1].low;

    const isHigh =
      row.high === maxHigh &&
      row.high > rows[i - 1].high &&
      row.high > rows[i + 1].high;

    if (isLow === isHigh) continue;

    if (isLow) {
      pivots.push({
        type: "low",
        price: row.low,
        date: row.date,
        index: i,
        confirmDate: rows[i + right]?.date || row.date
      });
    }

    if (isHigh) {
      pivots.push({
        type: "high",
        price: row.high,
        date: row.date,
        index: i,
        confirmDate: rows[i + right]?.date || row.date
      });
    }
  }

  return pivots.sort((a, b) => a.index - b.index);
}

function getPivotConfirmDate(pivot) {
  if (!pivot) return null;
  return pivot.confirmDate || pivot.date || null;
}

function normalizeSwingPivots(pivots) {
  const result = [];

  for (const pivot of pivots) {
    const last = result[result.length - 1];

    if (!last) {
      result.push(pivot);
      continue;
    }

    if (last.type !== pivot.type) {
      result.push(pivot);
      continue;
    }

    const shouldReplace =
      pivot.type === "low"
        ? pivot.price < last.price
        : pivot.price > last.price;

    if (shouldReplace) result[result.length - 1] = pivot;
  }

  return result;
}


// ============================================================
// V2.9.14.0｜盤後 Decision Layer
// 只使用已完成日K＋既有 Fib / volume / structure / 月線狀態。
// 不讀取、也不假裝存在隔日開盤、盤中 VWAP、第一根5分K等即時資料。
// ============================================================
function clampV29140(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function meanV29140(values) {
  const xs = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function smaAtV29140(rows, period, endIndex = null) {
  const source = Array.isArray(rows) ? rows : [];
  const end = endIndex === null ? source.length - 1 : endIndex;
  if (period <= 0 || end < period - 1) return null;
  const xs = source.slice(end - period + 1, end + 1).map(r => numberOrNull(r?.close)).filter(Number.isFinite);
  return xs.length === period ? meanV29140(xs) : null;
}

function maSlopePctV29140(rows, period, lookback = 5) {
  const source = Array.isArray(rows) ? rows : [];
  const now = smaAtV29140(source, period);
  const prev = smaAtV29140(source, period, source.length - 1 - lookback);
  return now !== null && prev !== null && prev !== 0 ? ((now - prev) / Math.abs(prev)) * 100 : null;
}

function scoreBandV29140(score) {
  const s = clampV29140(score);
  if (s >= 85) return { key: "PRIORITY", icon: "🔥", label: "優先作戰", range: "85～100" };
  if (s >= 70) return { key: "ACTIONABLE", icon: "🟢", label: "可以操作", range: "70～84" };
  if (s >= 55) return { key: "WATCH", icon: "🟡", label: "關注即可", range: "55～69" };
  return { key: "SKIP", icon: "⚪", label: "略過", range: "0～54" };
}

function scoreInputV29140(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return fallback;
  return value;
}

function scoreObjectV29140(score, evidence = [], risks = [], extra = {}) {
  const rounded = round(clampV29140(score), 0);
  return {
    score: rounded,
    ...scoreBandV29140(rounded),
    evidence: [...new Set((evidence || []).filter(Boolean))],
    risks: [...new Set((risks || []).filter(Boolean))],
    ...extra
  };
}

function buildMaSnapshotV29140(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const close = source.length ? numberOrNull(source[source.length - 1]?.close) : null;
  const out = { close };
  for (const p of [5, 10, 20, 60, 120, 240]) out[`ma${p}`] = smaAtV29140(source, p);
  out.ma20Slope5Pct = maSlopePctV29140(source, 20, 5);
  out.ma60Slope5Pct = maSlopePctV29140(source, 60, 5);
  out.ma120Slope10Pct = maSlopePctV29140(source, 120, 10);
  out.ma20GapPct = close !== null && out.ma20 ? ((close - out.ma20) / out.ma20) * 100 : null;
  out.ma5GapPct = close !== null && out.ma5 ? ((close - out.ma5) / out.ma5) * 100 : null;
  return out;
}

function buildTrendPersistenceV29140(rows, ma) {
  const source = Array.isArray(rows) ? rows : [];
  const close = numberOrNull(ma?.close);
  let score = 0;
  const evidence = [], risks = [];
  const add = (ok, pts, yes, no = null) => {
    if (ok) { score += pts; if (yes) evidence.push(yes); }
    else if (no) risks.push(no);
  };
  add(close !== null && ma.ma20 !== null && close > ma.ma20, 18, "收盤站上日20MA", "收盤未站上日20MA");
  add(close !== null && ma.ma60 !== null && close > ma.ma60, 10, "收盤站上日60MA", "收盤仍在日60MA下方");
  add(ma.ma5 !== null && ma.ma10 !== null && ma.ma20 !== null && ma.ma5 > ma.ma10 && ma.ma10 > ma.ma20, 18, "5MA＞10MA＞20MA", "短中期均線尚未完整多頭排列");
  add(ma.ma20Slope5Pct !== null && ma.ma20Slope5Pct > 0, 14, "20MA近5日仍上彎", "20MA斜率未向上");
  add(ma.ma60Slope5Pct !== null && ma.ma60Slope5Pct >= 0, 8, "60MA未轉下", "60MA已轉下");

  const last10 = source.slice(-10);
  if (last10.length >= 10 && ma.ma20 !== null) {
    const startIndex = source.length - last10.length;
    const aboveCount = last10.reduce((acc, r, j) => {
      const histMa20 = smaAtV29140(source, 20, startIndex + j);
      return acc + (histMa20 !== null && numberOrNull(r.close) !== null && r.close >= histMa20 ? 1 : 0);
    }, 0);
    const above = aboveCount / last10.length;
    score += above * 12;
    if (above >= 0.8) evidence.push("近10日大多守在20MA上方");
    else if (above < 0.5) risks.push("近10日站穩20MA比例偏低");
    const prev5 = last10.slice(0, 5), recent5 = last10.slice(5);
    const prevHigh = Math.max(...prev5.map(r => r.high)), recentHigh = Math.max(...recent5.map(r => r.high));
    const prevLow = Math.min(...prev5.map(r => r.low)), recentLow = Math.min(...recent5.map(r => r.low));
    if (recentHigh > prevHigh) { score += 10; evidence.push("近10日後5根高點高於前5根"); } else risks.push("近10日後5根高點未高於前5根");
    if (recentLow > prevLow) { score += 10; evidence.push("近10日後5根低點高於前5根"); } else risks.push("近10日後5根低點未高於前5根");
  }
  return scoreObjectV29140(score, evidence, risks, { rule: "均線排列＋斜率＋近10日高低點與站穩比例；只描述趨勢慣性，不保證延續。" });
}

function buildMaDeductionV29140(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const close = source.length ? numberOrNull(source[source.length - 1]?.close) : null;
  const periods = [5, 10, 20];
  const weights = { 5: 0.25, 10: 0.35, 20: 0.40 };
  const details = [];
  let weighted = 0, totalW = 0;
  for (const p of periods) {
    const ma = smaAtV29140(source, p);
    const oldIndex = source.length - p;
    const deduct = oldIndex >= 0 ? numberOrNull(source[oldIndex]?.close) : null;
    if (close === null || ma === null || deduct === null || deduct === 0) continue;
    const flatNextMa = ma + (close - deduct) / p;
    const pressurePct = ((close - deduct) / Math.abs(deduct)) * 100;
    let s = pressurePct >= 5 ? 95 : pressurePct >= 2 ? 85 : pressurePct >= 0.5 ? 72 : pressurePct >= 0 ? 62 : pressurePct >= -1 ? 50 : pressurePct >= -3 ? 35 : 18;
    weighted += s * weights[p]; totalW += weights[p];
    details.push({ period: p, currentMA: round(ma, 2), deductionClose: round(deduct, 2), flatPriceNextMA: round(flatNextMa, 2), pressurePct: round(pressurePct, 2), direction: flatNextMa > ma ? "UP" : flatNextMa < ma ? "DOWN" : "FLAT", score: s });
  }
  const score = totalW > 0 ? weighted / totalW : 50;
  const evidence = details.filter(d => d.direction === "UP").map(d => `MA${d.period}扣抵偏有利`);
  const risks = details.filter(d => d.direction === "DOWN").map(d => `MA${d.period}扣抵仍有壓力`);
  return scoreObjectV29140(score, evidence, risks, { details, rule: "用『若下一交易日價格先維持今日收盤』的中性假設，觀察舊收盤扣除後均線的自然壓力；不是預測明日收盤。" });
}

function buildVolumePriceHealthV29140(rows, volume) {
  const source = Array.isArray(rows) ? rows : [];
  const last20 = source.slice(-20);
  if (last20.length < 10) return scoreObjectV29140(50, [], ["量價歷史不足"], { relativeVolume20: null });
  const upVol = [], downVol = [];
  for (let i = Math.max(1, source.length - 20); i < source.length; i++) {
    const row = source[i], prev = source[i - 1];
    const v = numberOrNull(row?.volume), c = numberOrNull(row?.close), pc = numberOrNull(prev?.close);
    if (v === null || c === null || pc === null) continue;
    if (c > pc) upVol.push(v); else if (c < pc) downVol.push(v);
  }
  const upAvg = meanV29140(upVol), downAvg = meanV29140(downVol);
  const udRatio = upAvg !== null && downAvg !== null && downAvg > 0 ? upAvg / downAvg : null;
  const relVol = numberOrNull(volume?.latest?.relativeVolume20);
  const latest = source[source.length - 1], prev = source[source.length - 2];
  const range = latest ? Math.max(0, latest.high - latest.low) : 0;
  const body = latest ? Math.abs(latest.close - latest.open) : 0;
  const closePos = latest && range > 0 ? (latest.close - latest.low) / range : 0.5;
  const dayPct = latest && prev?.close ? ((latest.close - prev.close) / prev.close) * 100 : null;
  let score = 50;
  const evidence = [], risks = [];
  if (udRatio !== null) {
    const delta = clampV29140((udRatio - 0.6) / 1.0 * 35, -15, 35);
    score += delta;
    if (udRatio >= 1.15) evidence.push("上漲日平均量大於下跌日");
    else if (udRatio < 0.85) risks.push("下跌日量能相對偏大");
  }
  if (relVol !== null) {
    if (relVol >= 1.2 && relVol <= 2.5) { score += 12; evidence.push(`今日量比 ${round(relVol,2)}× 屬健康放量`); }
    else if (relVol >= 3) { score -= 8; risks.push(`今日量比 ${round(relVol,2)}× 偏爆量，需防滯漲`); }
    else if (relVol < 0.7) { score -= 6; risks.push("今日量能偏縮"); }
  }
  if (dayPct !== null && dayPct > 0 && closePos >= 0.65) { score += 8; evidence.push("上漲且收盤位置偏強"); }
  if (relVol !== null && relVol >= 2 && (closePos < 0.45 || body / Math.max(range, 0.0001) < 0.25)) { score -= 18; risks.push("高量但收盤／實體偏弱，疑似爆量滯漲"); }
  return scoreObjectV29140(score, evidence, risks, { relativeVolume20: round(relVol, 2), upDownAverageVolumeRatio: round(udRatio, 2), closePosition: round(closePos, 2), dayPct: round(dayPct, 2), rule: "上漲／下跌日量能、今日相對量與K棒收盤位置綜合；不推定主力意圖。" });
}

function buildReboundQualityV29140(rows, ma, volumeHealth, trendPersistence) {
  const source = Array.isArray(rows) ? rows : [];
  const close = numberOrNull(ma?.close), ma20 = numberOrNull(ma?.ma20);
  const evidence = [], risks = [];
  let crossedWithin10 = false, belowCount = 0;
  for (let i = Math.max(20, source.length - 10); i < source.length; i++) {
    const m = smaAtV29140(source, 20, i);
    const c = numberOrNull(source[i]?.close);
    const pm = smaAtV29140(source, 20, i - 1);
    const pc = numberOrNull(source[i - 1]?.close);
    if (m !== null && c !== null && c < m) belowCount++;
    if (m !== null && c !== null && pm !== null && pc !== null && c >= m && pc < pm) crossedWithin10 = true;
  }
  let score;
  let mode;
  if (close !== null && ma20 !== null && close >= ma20 && crossedWithin10) {
    mode = "REBOUND_TO_STRENGTH";
    score = 45 + scoreInputV29140(trendPersistence?.score, 0) * 0.25 + scoreInputV29140(volumeHealth?.score, 0) * 0.25;
    evidence.push("近10日曾由20MA下方重新站回");
    if (ma.ma20Slope5Pct > 0) evidence.push("20MA已重新上彎"); else risks.push("20MA尚未明顯轉上");
  } else if (close !== null && ma20 !== null && close >= ma20) {
    mode = "TREND_CONTINUATION";
    score = scoreInputV29140(trendPersistence?.score, 50) * 0.65 + scoreInputV29140(volumeHealth?.score, 50) * 0.35;
    evidence.push("目前較像趨勢延續，不是單純跌深反彈");
  } else {
    mode = "WEAK_REBOUND_OR_BELOW_MA";
    score = 25 + scoreInputV29140(volumeHealth?.score, 50) * 0.25;
    risks.push("收盤仍在20MA下方，反彈尚未轉成正式多方結構");
  }
  if (belowCount >= 5 && mode !== "REBOUND_TO_STRENGTH") risks.push("近10日多數時間仍受20MA壓制");
  return scoreObjectV29140(score, evidence, risks, { mode, crossedAboveMa20Within10: crossedWithin10, belowMa20DaysWithin10: belowCount, rule: "區分『弱反彈』與『站回趨勢後轉強／續強』，避免跌深彈一天就視為起漲。" });
}

function buildPressureMapV29140(rows, fib, ma) {
  const source = Array.isArray(rows) ? rows : [];
  const recent120 = source.slice(-120);
  const close = source.length ? numberOrNull(source[source.length - 1]?.close) : null;
  const raw = [];
  const lookbacks = {};
  const add = (value, label, type, strength = 1) => {
    const v = numberOrNull(value);
    if (v === null || close === null || v <= 0) return;
    raw.push({ value: v, label, type, strength });
  };
  add(fib?.B, "Fib B前高", "FIB_B", 5);
  add(fib?.C, "Fib C回檔低點", "FIB_C", 4);
  add(fib?.stop764, "Fib 0.764深度風控", "FIB_STOP", 5);
  add(fib?.target1618, "Fib 1.618目標", "FIB_TARGET", 5);
  add(ma?.ma20, "日20MA", "MA20", 4);
  add(ma?.ma60, "日60MA", "MA60", 3);
  const history = source.length > 1 ? source.slice(0, -1) : [];
  for (const p of [20, 60, 120]) {
    // 先排除今天，再取完整 p 根已完成歷史K；避免 120 日窗口被先裁成120後只剩119根。
    const slice = history.slice(-Math.min(p, history.length));
    const sufficient = slice.length >= p;
    lookbacks[p] = { requested: p, used: slice.length, sufficient, excludesCurrent: true };
    if (slice.length) {
      const coverage = sufficient ? `${p}日歷史` : `${p}日歷史（僅${slice.length}根）`;
      add(Math.max(...slice.map(r => r.high)), `${coverage}高點`, `HIGH_${p}`, p === 20 ? 4 : 3);
      add(Math.min(...slice.map(r => r.low)), `${coverage}低點`, `LOW_${p}`, p === 20 ? 4 : 3);
    }
  }
  // 大量K與缺口仍維持原本「最近最多120根（可含當日）」的窗口政策，避免修歷史高低點時連帶改變其他行為。
  const volumeBars = recent120.filter(r => Number.isFinite(r.volume)).sort((a, b) => b.volume - a.volume).slice(0, 5);
  for (const r of volumeBars) {
    // 無盤中逐筆VWAP時，以HLC3作為「大量K估算成本」代理，避免誤稱真實平均成交成本。
    add((r.high + r.low + r.close) / 3, `大量K估算成本｜${r.date}`, "HIGH_VOLUME_PROXY", 3);
  }
  for (let i = Math.max(1, recent120.length - 60); i < recent120.length; i++) {
    const prev = recent120[i - 1], cur = recent120[i];
    if (cur.low > prev.high) {
      add(prev.high, `向上缺口下緣｜${cur.date}`, "UP_GAP_LOW", 2);
      add(cur.low, `向上缺口上緣｜${cur.date}`, "UP_GAP_HIGH", 2);
    } else if (cur.high < prev.low) {
      add(cur.high, `向下缺口下緣｜${cur.date}`, "DOWN_GAP_LOW", 2);
      add(prev.low, `向下缺口上緣｜${cur.date}`, "DOWN_GAP_HIGH", 2);
    }
  }
  raw.sort((a, b) => a.value - b.value || b.strength - a.strength);
  const merged = [];
  for (const x of raw) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(x.value - last.value) / close <= 0.006) {
      if (!last.labels.includes(x.label)) last.labels.push(x.label);
      last.strength = Math.max(last.strength, x.strength);
      last.value = (last.value + x.value) / 2;
    } else {
      merged.push({ value: x.value, labels: [x.label], type: x.type, strength: x.strength });
    }
  }
  const above = merged.filter(x => x.value > close * 1.001).sort((a, b) => a.value - b.value).slice(0, 4)
    .map(x => ({ value: round(x.value, 2), label: x.labels.join("＋"), distancePct: round((x.value - close) / close * 100, 2), strength: x.strength }));
  const below = merged.filter(x => x.value < close * 0.999).sort((a, b) => b.value - a.value).slice(0, 4)
    .map(x => ({ value: round(x.value, 2), label: x.labels.join("＋"), distancePct: round((close - x.value) / close * 100, 2), strength: x.strength }));
  return { close: round(close, 2), resistance: above, support: below, nearestResistance: above[0] || null, nearestSupport: below[0] || null, lookbacks, rule: "前高低、Fib、MA、缺口與大量K HLC3估算成本的盤後壓力地圖；HLC3不是盤中真實VWAP。" };
}

function buildRemainingOpportunityV29140(rows, fib, pressureMap) {
  const source = Array.isArray(rows) ? rows : [];
  const close = source.length ? numberOrNull(source[source.length - 1]?.close) : null;
  if (close === null) return scoreObjectV29140(0, [], ["收盤價不足"], {});
  const nearR = pressureMap?.nearestResistance || null;
  const nearS = pressureMap?.nearestSupport || null;
  const fibTarget = numberOrNull(fib?.target1618);
  const candidates = [];
  if (nearR?.value > close) candidates.push({ value: nearR.value, label: nearR.label, role: "NEAREST_PRESSURE" });
  if (fibTarget !== null && fibTarget > close) candidates.push({ value: fibTarget, label: "Fib 1.618", role: "FIB_1618" });
  const conservative = candidates.length ? candidates.sort((a, b) => a.value - b.value)[0] : null;
  const upsidePct = conservative ? (conservative.value - close) / close * 100 : null;
  const downsidePct = nearS?.value < close ? (close - nearS.value) / close * 100 : null;
  const rr = upsidePct !== null && downsidePct !== null && downsidePct > 0 ? upsidePct / downsidePct : null;
  let score = upsidePct === null ? 35 : upsidePct >= 15 ? 100 : upsidePct >= 10 ? 88 : upsidePct >= 8 ? 78 : upsidePct >= 5 ? 65 : upsidePct >= 3 ? 52 : upsidePct >= 1.5 ? 35 : 18;
  if (rr !== null) score = score * 0.65 + (rr >= 3 ? 100 : rr >= 2 ? 82 : rr >= 1.5 ? 70 : rr >= 1 ? 50 : 25) * 0.35;
  const evidence = [], risks = [];
  if (upsidePct !== null && upsidePct >= 8) evidence.push(`下一有效壓力前約有 ${round(upsidePct,1)}% 空間`);
  if (rr !== null && rr >= 1.5) evidence.push(`中短波段空間比約 1:${round(rr,2)}`);
  if (upsidePct !== null && upsidePct < 3) risks.push("上方最近壓力太近，剩餘肉偏少");
  if (rr !== null && rr < 1) risks.push("上檔空間小於下檔風險");
  return scoreObjectV29140(score, evidence, risks, { target: conservative ? { value: round(conservative.value, 2), label: conservative.label, role: conservative.role } : null, support: nearS, upsidePct: round(upsidePct, 2), downsidePct: round(downsidePct, 2), riskRewardRatio: round(rr, 2), fib1618: round(fibTarget, 2), rule: "Decision Layer 以中短波段壓力地圖的最近有效壓力作保守目標，並與最近有效支撐比較；這是中短波段空間比，不是圖片右上角的近端戰術盈虧比，也不是勝率。" });
}

function buildChaseRiskV29140(rows, ma, dailyRsi5) {
  const source = Array.isArray(rows) ? rows : [];
  const close = numberOrNull(ma?.close), rsi = numberOrNull(dailyRsi5);
  const evidence = [], risks = [];
  let risk = 10;
  const g20 = numberOrNull(ma?.ma20GapPct), g5 = numberOrNull(ma?.ma5GapPct);
  if (rsi !== null) {
    if (rsi >= 88) { risk += 32; risks.push(`RSI ${round(rsi,1)} 極度過熱`); }
    else if (rsi >= 82) { risk += 22; risks.push(`RSI ${round(rsi,1)} 過熱`); }
    else if (rsi >= 75) { risk += 12; risks.push(`RSI ${round(rsi,1)} 偏高`); }
    else if (rsi >= 55 && rsi <= 72) evidence.push("RSI位於偏強但非極端區");
  }
  if (g20 !== null) {
    if (g20 >= 25) { risk += 30; risks.push(`距20MA +${round(g20,1)}% 過遠`); }
    else if (g20 >= 15) { risk += 18; risks.push(`距20MA +${round(g20,1)}% 偏遠`); }
    else if (g20 >= 8) risk += 7;
    else if (g20 >= 0) evidence.push("與20MA距離仍可控");
  }
  if (g5 !== null && g5 > 6) { risk += 10; risks.push("距5MA偏遠，短線容易追高"); }
  const last20 = source.slice(-20);
  if (close !== null && last20.length >= 10) {
    const h = Math.max(...last20.map(r => r.high));
    const dist = h > 0 ? (h - close) / h * 100 : null;
    if (dist !== null && dist <= 1) risk += 8;
  }
  if (rsi !== null && rsi >= 88 && g20 !== null && g20 >= 25) risk += 12;
  risk = clampV29140(risk);
  const band = risk >= 70 ? { key: "HIGH", icon: "🔴", label: "高" } : risk >= 40 ? { key: "MEDIUM", icon: "🟡", label: "中" } : { key: "LOW", icon: "🟢", label: "低" };
  return { score: round(risk,0), ...band, evidence, risks, rsi: round(rsi,2), ma20GapPct: round(g20,2), ma5GapPct: round(g5,2), rule: "RSI、MA20/MA5乖離與近期高點距離組成追價風險；高分代表風險高。" };
}

function buildExitRiskV29140(rows, fib, structure, ma, volumeHealth) {
  const source = Array.isArray(rows) ? rows : [];
  const close = numberOrNull(ma?.close), evidence = [], risks = [];
  let risk = 12;
  if (close !== null && ma.ma20 !== null && close < ma.ma20) { risk += 24; risks.push("收盤跌回20MA下方"); } else if (close !== null && ma.ma20 !== null) evidence.push("仍守20MA");
  if (ma.ma20Slope5Pct !== null && ma.ma20Slope5Pct < 0) { risk += 16; risks.push("20MA斜率轉下"); }
  if (ma.ma5 !== null && ma.ma10 !== null && ma.ma5 < ma.ma10) { risk += 10; risks.push("5MA跌破10MA"); }
  if (String(fib?.status || "").toLowerCase() === "failed") { risk += 35; risks.push("Fib N字已失效"); }
  const falseLevel = String(structure?.breakout?.falseBreakoutRisk?.level?.key || structure?.falseBreakoutRisk?.level?.key || "").toLowerCase();
  if (falseLevel === "high") { risk += 24; risks.push("突破假突破風險偏高"); }
  else if (falseLevel === "medium") risk += 8;
  if (scoreInputV29140(volumeHealth?.score, 50) < 40) { risk += 12; risks.push("量價健康度偏弱"); }
  const last6 = source.slice(-6);
  if (last6.length >= 6) {
    const prevLow = Math.min(...last6.slice(0,3).map(r => r.low));
    const recentLow = Math.min(...last6.slice(3).map(r => r.low));
    if (recentLow < prevLow) { risk += 8; risks.push("近6日後3根低點低於前3根"); } else evidence.push("近6日後3根低點未明顯低於前3根");
  }
  risk = clampV29140(risk);
  const band = risk >= 70 ? { key: "HIGH", icon: "🔴", label: "高" } : risk >= 40 ? { key: "MEDIUM", icon: "🟡", label: "中" } : { key: "LOW", icon: "🟢", label: "低" };
  return { score: round(risk,0), ...band, evidence, risks, rule: "趨勢失守、均線轉弱、Fib生命週期、假突破與量價共同判讀；高分代表轉弱／出場風險高。" };
}

function buildVolatilityLiquidityV29140(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const last = source[source.length - 1];
  if (!last) return { atr14Pct: null, avg5TradeValueTwd: null, volatilityScore: 40, liquidityScore: 0 };
  const trs = [];
  for (let i = Math.max(1, source.length - 14); i < source.length; i++) {
    const r = source[i], p = source[i - 1];
    const tr = Math.max(r.high - r.low, Math.abs(r.high - p.close), Math.abs(r.low - p.close));
    if (Number.isFinite(tr)) trs.push(tr);
  }
  const atr = meanV29140(trs), close = numberOrNull(last.close);
  const atrPct = atr !== null && close ? atr / close * 100 : null;
  let volatilityScore = atrPct === null ? 40 : atrPct >= 2 && atrPct <= 6 ? 100 : atrPct >= 1.2 && atrPct < 2 ? 75 : atrPct > 6 && atrPct <= 9 ? 80 : atrPct > 9 && atrPct <= 12 ? 55 : atrPct < 1.2 ? 35 : 30;
  const values = source.slice(-5).map(r => numberOrNull(r.close) !== null && numberOrNull(r.volume) !== null ? r.close * r.volume : null).filter(Number.isFinite);
  const avg5Value = meanV29140(values);
  let liquidityScore = avg5Value === null ? 0 : avg5Value >= 500_000_000 ? 100 : avg5Value >= 200_000_000 ? 90 : avg5Value >= 100_000_000 ? 80 : avg5Value >= 50_000_000 ? 70 : avg5Value >= 20_000_000 ? 50 : 25;
  return { atr14Pct: round(atrPct, 2), avg5TradeValueTwd: round(avg5Value, 0), volatilityScore, liquidityScore };
}

function buildEntryQualityV29140({ trend, maDeduction, volumeHealth, rebound, remaining, chaseRisk, exitRisk }) {
  const score = (trend.score || 0) * 0.20 + (maDeduction.score || 0) * 0.15 + (volumeHealth.score || 0) * 0.15 + (rebound.score || 0) * 0.15 + (remaining.score || 0) * 0.15 + (100 - (chaseRisk.score || 0)) * 0.12 + (100 - (exitRisk.score || 0)) * 0.08;
  const evidence = [...(trend.evidence || []).slice(0,2), ...(volumeHealth.evidence || []).slice(0,2), ...(remaining.evidence || []).slice(0,2)];
  const risks = [...(chaseRisk.risks || []).slice(0,2), ...(exitRisk.risks || []).slice(0,2)];
  return scoreObjectV29140(score, evidence, risks, { rule: "把趨勢、扣抵、量價、反彈品質、剩餘空間與追價/出場風險整合成『現在是不是好位置』，不等於股票本身強度。" });
}

const FACTOR_CONTRIBUTION_AUDIT_MODEL_V39B5 = "FACTOR_CONTRIBUTION_SHADOW_AUDIT_V0_1";

function factorPctMapV39B5(weights) {
  return Object.fromEntries(Object.entries(weights).map(([k,v]) => [k, round(v * 100, 2)]));
}

function expandedFactorWeightsV39B5(directWeights, entryWeights) {
  const out = {};
  const entryW = Number(directWeights.entryQuality || 0);
  const add = (key, weight) => { out[key] = (out[key] || 0) + Number(weight || 0); };
  for (const [key, weight] of Object.entries(directWeights)) {
    if (key === "entryQuality") continue;
    add(key, weight);
  }
  if (entryW > 0) {
    for (const [key, weight] of Object.entries(entryWeights)) add(key, entryW * weight);
  }
  return out;
}

function buildFactorContributionAuditV39B5({
  dayRaw, shortRaw, longRaw, dayFinal, shortFinal, longFinal,
  nearUpside, entryQuality, trend, maDeduction, volumeHealth, rebound, remaining,
  chaseRisk, exitRisk, liquidity, monthlyComponent
}) {
  const entryWeights = {
    trend: 0.20,
    maDeduction: 0.15,
    volumeHealth: 0.15,
    rebound: 0.15,
    remaining: 0.15,
    chaseSafety: 0.12,
    exitSafety: 0.08
  };
  const direct = {
    dayTradePreMarket: {
      entryQuality: 0.20, volumeHealth: 0.15, trend: 0.10, remaining: 0.10,
      chaseSafety: 0.15, rebound: 0.10, liquidity: 0.10, volatility: 0.10
    },
    shortSwing: {
      entryQuality: 0.22, trend: 0.18, maDeduction: 0.13, volumeHealth: 0.12,
      remaining: 0.25, exitSafety: 0.10
    },
    longSwing: {
      trend: 0.23, maDeduction: 0.13, volumeHealth: 0.09, remaining: 0.20,
      exitSafety: 0.15, monthly: 0.20
    }
  };
  const scoreValues = {
    entryQuality: scoreInputV29140(entryQuality?.score, 0),
    trend: scoreInputV29140(trend?.score, 0),
    maDeduction: scoreInputV29140(maDeduction?.score, 0),
    volumeHealth: scoreInputV29140(volumeHealth?.score, 0),
    rebound: scoreInputV29140(rebound?.score, 0),
    remaining: scoreInputV29140(remaining?.score, 0),
    chaseSafety: 100 - scoreInputV29140(chaseRisk?.score, 0),
    exitSafety: 100 - scoreInputV29140(exitRisk?.score, 0),
    liquidity: scoreInputV29140(liquidity?.liquidityScore, 0),
    volatility: scoreInputV29140(liquidity?.volatilityScore, 0),
    monthly: scoreInputV29140(monthlyComponent, 55)
  };
  const rawMap = { dayTradePreMarket: dayRaw, shortSwing: shortRaw, longSwing: longRaw };
  const finalMap = { dayTradePreMarket: dayFinal, shortSwing: shortFinal, longSwing: longFinal };
  const horizons = {};
  for (const key of Object.keys(direct)) {
    const directWeights = direct[key];
    const directPoints = {};
    for (const [factor, weight] of Object.entries(directWeights)) {
      directPoints[factor] = round((scoreValues[factor] || 0) * weight, 3);
    }
    const expanded = expandedFactorWeightsV39B5(directWeights, entryWeights);
    const repeated = [];
    const directFactorSet = new Set(Object.keys(directWeights).filter(x => x !== "entryQuality"));
    if ((directWeights.entryQuality || 0) > 0) {
      for (const factor of Object.keys(entryWeights)) if (directFactorSet.has(factor)) repeated.push(factor);
    }
    const entryW = Number(directWeights.entryQuality || 0);
    const reusedViaEntryWeight = repeated.reduce((sum, factor) => sum + entryW * Number(entryWeights[factor] || 0), 0);
    const directReconstruction = Object.values(directPoints).reduce((a,b)=>a+b,0);
    horizons[key] = {
      directWeightsPct: factorPctMapV39B5(directWeights),
      directPointContributions: directPoints,
      directReconstruction: round(directReconstruction, 3),
      rawScoreBeforePositionCap: round(rawMap[key], 3),
      finalScoreAfterPositionCap: round(clampV29140(finalMap[key]), 0),
      positionCapApplied: Math.abs(Number(rawMap[key]) - Number(finalMap[key])) > 1e-9,
      expandedNominalWeightsPct: factorPctMapV39B5(expanded),
      expandedWeightSumPct: round(Object.values(expanded).reduce((a,b)=>a+b,0) * 100, 2),
      nestedEntryQualityWeightPct: round(entryW * 100, 2),
      structuralReuse: {
        present: repeated.length > 0,
        factorIds: repeated,
        reusedViaEntryQualityWeightPct: round(reusedViaEntryWeight * 100, 2),
        interpretation: repeated.length
          ? "同一因子同時經entryQuality與直接權重進入本週期；這是結構性重用，不等於已證明重複計分錯誤。"
          : "本週期沒有透過entryQuality再重用同一因子的結構。"
      }
    };
  }
  return {
    modelId: FACTOR_CONTRIBUTION_AUDIT_MODEL_V39B5,
    shadowOnly: true,
    affectsScores: false,
    affectsRanking: false,
    purpose: "揭露三週期公式的直接權重、entryQuality巢狀重用與位置上限，不在本批改權重。",
    asOfPolicy: "POST_CLOSE_SAME_INPUTS_AS_THREE_HORIZON",
    nearUpsidePct: numberOrNull(nearUpside),
    entryQualityFormulaWeightsPct: factorPctMapV39B5(entryWeights),
    factorScoreSnapshot: Object.fromEntries(Object.entries(scoreValues).map(([k,v])=>[k, round(v,2)])),
    horizons,
    conclusion: "先揭露再驗證。結構性重用只代表相關訊息可能重複影響；是否需要降權，必須以消融測試與樣本外結果決定。",
    nextValidation: "ABLATION_AND_OUT_OF_SAMPLE_REQUIRED_BEFORE_WEIGHT_CHANGE"
  };
}



const ABLATION_SHADOW_MODEL_V39B6 = "THREE_HORIZON_ABLATION_SHADOW_V0_1";
const ABLATION_ENTRY_WEIGHTS_V39B6 = Object.freeze({
  trend: 0.20,
  maDeduction: 0.15,
  volumeHealth: 0.15,
  rebound: 0.15,
  remaining: 0.15,
  chaseSafety: 0.12,
  exitSafety: 0.08
});
const ABLATION_DIRECT_WEIGHTS_V39B6 = Object.freeze({
  dayTradePreMarket: Object.freeze({
    entryQuality: 0.20, volumeHealth: 0.15, trend: 0.10, remaining: 0.10,
    chaseSafety: 0.15, rebound: 0.10, liquidity: 0.10, volatility: 0.10
  }),
  shortSwing: Object.freeze({
    entryQuality: 0.22, trend: 0.18, maDeduction: 0.13, volumeHealth: 0.12,
    remaining: 0.25, exitSafety: 0.10
  }),
  longSwing: Object.freeze({
    trend: 0.23, maDeduction: 0.13, volumeHealth: 0.09, remaining: 0.20,
    exitSafety: 0.15, monthly: 0.20
  })
});

function applyThreeHorizonPositionCapV39B6(horizonKey, rawScore, nearUpside) {
  let score = Number(rawScore);
  if (!Number.isFinite(score)) return null;
  const u = numberOrNull(nearUpside);
  if (u === null) return score;
  if (u < 0.8) {
    if (horizonKey === "dayTradePreMarket" || horizonKey === "shortSwing") return Math.min(score, 54);
    if (horizonKey === "longSwing") return Math.min(score, 60);
  } else if (u < 1.5) {
    if (horizonKey === "dayTradePreMarket") return Math.min(score, 69);
    if (horizonKey === "shortSwing") return Math.min(score, 60);
    if (horizonKey === "longSwing") return Math.min(score, 65);
  } else if (u < 3) {
    if (horizonKey === "shortSwing" || horizonKey === "longSwing") return Math.min(score, 69);
  }
  return score;
}

function normalizedCounterfactualScoreV39B6(horizonKey, weights, scoreValues, nearUpside) {
  const entries = Object.entries(weights || {}).filter(([,w]) => Number.isFinite(Number(w)) && Number(w) > 0);
  const totalWeight = entries.reduce((s,[,w]) => s + Number(w), 0);
  if (!(totalWeight > 0)) return { rawScore: null, finalScore: null, normalizedWeightSumPct: 0 };
  let raw = 0;
  const normalizedWeightsPct = {};
  for (const [factor,w0] of entries) {
    const w = Number(w0) / totalWeight;
    const v = scoreInputV29140(scoreValues?.[factor], 0);
    raw += v * w;
    normalizedWeightsPct[factor] = round(w * 100, 2);
  }
  const capped = applyThreeHorizonPositionCapV39B6(horizonKey, raw, nearUpside);
  return {
    rawScore: round(raw, 3),
    finalScore: round(clampV29140(capped), 0),
    normalizedWeightSumPct: round(Object.values(normalizedWeightsPct).reduce((a,b)=>a+b,0), 2),
    normalizedWeightsPct
  };
}

function noNestedReuseWeightsV39B6(horizonKey) {
  const direct = ABLATION_DIRECT_WEIGHTS_V39B6[horizonKey] || {};
  const entryW = Number(direct.entryQuality || 0);
  const out = {};
  const directFactors = new Set(Object.keys(direct).filter(k => k !== "entryQuality"));
  for (const [k,w] of Object.entries(direct)) if (k !== "entryQuality") out[k] = Number(w || 0);
  if (entryW > 0) {
    // 只保留 entryQuality 中「沒有在本週期直接再出現」的獨有基礎因子；其餘巢狀重用路徑移除。
    for (const [factor,w] of Object.entries(ABLATION_ENTRY_WEIGHTS_V39B6)) {
      if (!directFactors.has(factor)) out[factor] = (out[factor] || 0) + entryW * Number(w || 0);
    }
  }
  return out;
}

function scaledEntryWeightsV39B6(horizonKey, scale) {
  const direct = ABLATION_DIRECT_WEIGHTS_V39B6[horizonKey] || {};
  const out = { ...direct };
  if (Object.prototype.hasOwnProperty.call(out,"entryQuality")) out.entryQuality = Number(out.entryQuality || 0) * Number(scale || 0);
  return out;
}

function counterfactualClassificationV39B6(score) {
  const s = numberOrNull(score);
  if (s === null) return "UNKNOWN";
  return s >= 85 ? "PRIORITY" : s >= 70 ? "ACTIONABLE" : s >= 55 ? "WATCH" : "SKIP";
}

function counterfactualPrimaryV39B6(scores) {
  const rows = Object.entries(scores || {}).map(([key,score])=>({key,score:numberOrNull(score)})).filter(x=>x.score!==null).sort((a,b)=>b.score-a.score);
  if (!rows.length || rows[0].score < 55) return { key:"NONE", score:rows[0]?.score??null };
  return { key:rows[0].key, score:rows[0].score };
}

function buildAblationShadowLabV39B6({
  dayRaw, shortRaw, longRaw, dayFinal, shortFinal, longFinal,
  nearUpside, entryQuality, trend, maDeduction, volumeHealth, rebound, remaining,
  chaseRisk, exitRisk, liquidity, monthlyComponent
}) {
  const scoreValues = {
    entryQuality: scoreInputV29140(entryQuality?.score, 0),
    trend: scoreInputV29140(trend?.score, 0),
    maDeduction: scoreInputV29140(maDeduction?.score, 0),
    volumeHealth: scoreInputV29140(volumeHealth?.score, 0),
    rebound: scoreInputV29140(rebound?.score, 0),
    remaining: scoreInputV29140(remaining?.score, 0),
    chaseSafety: 100 - scoreInputV29140(chaseRisk?.score, 0),
    exitSafety: 100 - scoreInputV29140(exitRisk?.score, 0),
    liquidity: scoreInputV29140(liquidity?.liquidityScore, 0),
    volatility: scoreInputV29140(liquidity?.volatilityScore, 0),
    monthly: scoreInputV29140(monthlyComponent, 55)
  };
  const formalRaw = { dayTradePreMarket: dayRaw, shortSwing: shortRaw, longSwing: longRaw };
  const formalFinal = { dayTradePreMarket: dayFinal, shortSwing: shortFinal, longSwing: longFinal };
  const horizons = {};
  const variantMatrix = {
    NO_NESTED_REUSE_RENORM: {},
    HALF_ENTRY_QUALITY_RENORM: {},
    NO_ENTRY_QUALITY_RENORM: {}
  };
  for (const horizonKey of Object.keys(ABLATION_DIRECT_WEIGHTS_V39B6)) {
    const baselineFinal = round(clampV29140(formalFinal[horizonKey]),0);
    const variants = {};
    const specs = {
      NO_NESTED_REUSE_RENORM: noNestedReuseWeightsV39B6(horizonKey),
      HALF_ENTRY_QUALITY_RENORM: scaledEntryWeightsV39B6(horizonKey,0.5),
      NO_ENTRY_QUALITY_RENORM: scaledEntryWeightsV39B6(horizonKey,0)
    };
    for (const [variantId,weights] of Object.entries(specs)) {
      const x = normalizedCounterfactualScoreV39B6(horizonKey,weights,scoreValues,nearUpside);
      variants[variantId] = {
        ...x,
        deltaVsFormal: x.finalScore===null?null:round(x.finalScore-baselineFinal,0),
        formalClassification: counterfactualClassificationV39B6(baselineFinal),
        shadowClassification: counterfactualClassificationV39B6(x.finalScore),
        classChanged: counterfactualClassificationV39B6(x.finalScore)!==counterfactualClassificationV39B6(baselineFinal)
      };
      variantMatrix[variantId][horizonKey] = x.finalScore;
    }

    const leaveOneOut = {};
    const direct = ABLATION_DIRECT_WEIGHTS_V39B6[horizonKey] || {};
    for (const factor of Object.keys(direct)) {
      const weights = { ...direct };
      delete weights[factor];
      const x = normalizedCounterfactualScoreV39B6(horizonKey,weights,scoreValues,nearUpside);
      leaveOneOut[factor] = {
        finalScore:x.finalScore,
        deltaVsFormal:x.finalScore===null?null:round(x.finalScore-baselineFinal,0),
        absDelta:x.finalScore===null?null:Math.abs(round(x.finalScore-baselineFinal,0))
      };
    }
    const sensitivity = Object.entries(leaveOneOut)
      .filter(([,x])=>x.absDelta!==null)
      .sort((a,b)=>b[1].absDelta-a[1].absDelta || String(a[0]).localeCompare(String(b[0])))
      .map(([factor,x])=>({factor,...x}));
    horizons[horizonKey] = {
      formal: {
        rawScoreBeforePositionCap: round(formalRaw[horizonKey],3),
        finalScoreAfterPositionCap: baselineFinal,
        classification: counterfactualClassificationV39B6(baselineFinal)
      },
      variants,
      directTermLeaveOneOut: leaveOneOut,
      maxDirectTermSensitivity: sensitivity[0] || null,
      sensitivityTop3: sensitivity.slice(0,3)
    };
  }
  const formalPrimary = counterfactualPrimaryV39B6(formalFinal);
  const primaryStability = {};
  for (const [variantId,scores] of Object.entries(variantMatrix)) {
    const primary = counterfactualPrimaryV39B6(scores);
    primaryStability[variantId] = {
      primary,
      changedFromFormal: primary.key !== formalPrimary.key,
      scores:Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,round(v,0)]))
    };
  }
  return {
    modelId: ABLATION_SHADOW_MODEL_V39B6,
    shadowOnly: true,
    affectsScores: false,
    affectsRanking: false,
    purpose: "以相同盤後輸入平行計算去巢狀重用、降低/移除entryQuality與直接項留一法；只測模型敏感度，不宣稱績效改善。",
    dataTiming: "POST_CLOSE_SAME_INPUTS_AS_FORMAL_MODEL",
    variantPolicy: {
      NO_NESTED_REUSE_RENORM: "移除entryQuality中與本週期直接因子重複的巢狀路徑，只保留獨有基礎因子，再將剩餘權重正規化為100%。",
      HALF_ENTRY_QUALITY_RENORM: "把entryQuality直接權重減半，其餘權重同比正規化；測試綜合進場品質降權敏感度。",
      NO_ENTRY_QUALITY_RENORM: "完全移除entryQuality直接項，其餘直接項正規化；測試模型對綜合進場品質依賴。",
      DIRECT_TERM_LEAVE_ONE_OUT: "逐一移除一個正式公式直接項並正規化；只表示局部敏感度，不代表該因子應刪除。"
    },
    formalPrimary,
    horizons,
    primaryStability,
    conclusion: "此批只有反事實敏感度。沒有歷史標籤/MFE/MAE與樣本外比較前，不得依Shadow分數調整正式權重或宣稱勝率改善。",
    nextValidation: "FIXED_HISTORICAL_SAMPLE_AND_OUT_OF_SAMPLE_PERFORMANCE_REQUIRED"
  };
}

function buildTradeabilityV29140({ rows, trend, maDeduction, volumeHealth, rebound, remaining, entryQuality, chaseRisk, exitRisk, monthlyActive, monthlyAvailable, includeResearchAudit = true }) {
  const vl = buildVolatilityLiquidityV29140(rows);
  let dayScore = entryQuality.score * 0.20 + volumeHealth.score * 0.15 + trend.score * 0.10 + remaining.score * 0.10 + (100 - chaseRisk.score) * 0.15 + rebound.score * 0.10 + vl.liquidityScore * 0.10 + vl.volatilityScore * 0.10;
  let shortScore = entryQuality.score * 0.22 + trend.score * 0.18 + maDeduction.score * 0.13 + volumeHealth.score * 0.12 + remaining.score * 0.25 + (100 - exitRisk.score) * 0.10;
  const monthlyComponent = monthlyAvailable ? (monthlyActive ? 100 : 35) : 55;
  let longScore = trend.score * 0.23 + maDeduction.score * 0.13 + volumeHealth.score * 0.09 + remaining.score * 0.20 + (100 - exitRisk.score) * 0.15 + monthlyComponent * 0.20;
  const dayScoreBeforePositionCap = dayScore;
  const shortScoreBeforePositionCap = shortScore;
  const longScoreBeforePositionCap = longScore;

  // 位置硬上限：盤後最近有效壓力太近時，不能只因趨勢很強就把「新進場適配度」打到優先作戰。
  const nearUpside = numberOrNull(remaining?.upsidePct);
  if (nearUpside !== null) {
    if (nearUpside < 0.8) { dayScore = Math.min(dayScore, 54); shortScore = Math.min(shortScore, 54); longScore = Math.min(longScore, 60); }
    else if (nearUpside < 1.5) { dayScore = Math.min(dayScore, 69); shortScore = Math.min(shortScore, 60); longScore = Math.min(longScore, 65); }
    else if (nearUpside < 3) { shortScore = Math.min(shortScore, 69); longScore = Math.min(longScore, 69); }
  }

  const dayEvidence = [...entryQuality.evidence.slice(0,2)];
  const dayRisks = [...entryQuality.risks.slice(0,2)];
  if (vl.avg5TradeValueTwd !== null) dayEvidence.push(`近5日平均成交金額約 ${round(vl.avg5TradeValueTwd / 1e8, 1)} 億`);
  if (vl.atr14Pct !== null) dayEvidence.push(`ATR14約 ${round(vl.atr14Pct,1)}%`);
  if (vl.liquidityScore < 50) dayRisks.push("成交金額偏低，當沖滑價／出場效率風險較高");
  if (vl.volatilityScore < 50) dayRisks.push("日內波動條件不理想");

  const day = scoreObjectV29140(dayScore, dayEvidence, dayRisks, {
    name: "明日當沖盤前適配度",
    keyName: "dayTradePreMarket",
    modelId: "THREE_HORIZON_DAYTRADE_PREMARKET_V1",
    frameworkId: "POST_CLOSE_THREE_HORIZON_FIT_V1",
    purpose: "INDIVIDUAL_STOCK_HORIZON_FIT",
    rankScope: "INDIVIDUAL_STOCK_ONLY",
    scoreSemantic: "FIT_SCORE_NOT_WIN_RATE",
    liquidity: vl,
    dataTiming: "POST_CLOSE",
    coverage: {
      dailyBars: Array.isArray(rows) ? rows.length : 0,
      liquidityAvailable: vl.avg5TradeValueTwd !== null,
      volatilityAvailable: vl.atr14Pct !== null
    },
    missingPolicy: "沿用V39基準各子模組的缺值/中性政策；metadata只揭露來源，不改分數。"
  });
  const short = scoreObjectV29140(shortScore, [...entryQuality.evidence.slice(0,3), ...maDeduction.evidence.slice(0,2)], [...entryQuality.risks.slice(0,3)], {
    name: "短波段適配度", keyName: "shortSwing",
    modelId: "THREE_HORIZON_SHORT_SWING_V1", frameworkId: "POST_CLOSE_THREE_HORIZON_FIT_V1",
    purpose: "INDIVIDUAL_STOCK_HORIZON_FIT", rankScope: "INDIVIDUAL_STOCK_ONLY",
    scoreSemantic: "FIT_SCORE_NOT_WIN_RATE", dataTiming: "POST_CLOSE"
  });
  const longRisks = [...exitRisk.risks.slice(0,2)];
  if (!monthlyAvailable) longRisks.push("官方月線暫不可用，長波段分數採中性月線權重");
  else if (!monthlyActive) longRisks.push("月線波段資格未成立");
  const long = scoreObjectV29140(longScore, [...trend.evidence.slice(0,3), ...maDeduction.evidence.slice(0,2)], longRisks, {
    name: "長波段適配度", keyName: "longSwing",
    modelId: "THREE_HORIZON_LONG_SWING_V1", frameworkId: "POST_CLOSE_THREE_HORIZON_FIT_V1",
    purpose: "INDIVIDUAL_STOCK_HORIZON_FIT", rankScope: "INDIVIDUAL_STOCK_ONLY",
    scoreSemantic: "FIT_SCORE_NOT_WIN_RATE", dataTiming: "POST_CLOSE", monthlyComponent
  });

  const horizons = [day, short, long].sort((a, b) => b.score - a.score);
  const primaryRaw = horizons[0], secondaryRaw = horizons[1];
  const primary = primaryRaw.score >= 55 ? { key: primaryRaw.keyName, name: primaryRaw.name, score: primaryRaw.score, icon: primaryRaw.icon, label: primaryRaw.label } : { key: "NONE", name: "暫無正式操作週期", score: primaryRaw.score, icon: "⚪", label: "最高分仍低於55" };
  const secondary = secondaryRaw && secondaryRaw.score >= 55 ? { key: secondaryRaw.keyName, name: secondaryRaw.name, score: secondaryRaw.score, icon: secondaryRaw.icon, label: secondaryRaw.label } : null;
  // B10 RC1：Factor Audit / Ablation Shadow 屬研究稽核，不讓 Market DeepScan 的 SCAN_LITE 每檔重算與攜帶。
  // 一般個股完整查詢與 Replay 仍保留；這個開關不參與正式分數、分界或 primary/secondary。
  const factorContributionAudit = includeResearchAudit ? buildFactorContributionAuditV39B5({
    dayRaw: dayScoreBeforePositionCap,
    shortRaw: shortScoreBeforePositionCap,
    longRaw: longScoreBeforePositionCap,
    dayFinal: dayScore,
    shortFinal: shortScore,
    longFinal: longScore,
    nearUpside,
    entryQuality,
    trend,
    maDeduction,
    volumeHealth,
    rebound,
    remaining,
    chaseRisk,
    exitRisk,
    liquidity: vl,
    monthlyComponent
  }) : null;
  const ablationShadowLab = includeResearchAudit ? buildAblationShadowLabV39B6({
    dayRaw: dayScoreBeforePositionCap,
    shortRaw: shortScoreBeforePositionCap,
    longRaw: longScoreBeforePositionCap,
    dayFinal: dayScore,
    shortFinal: shortScore,
    longFinal: longScore,
    nearUpside,
    entryQuality,
    trend,
    maDeduction,
    volumeHealth,
    rebound,
    remaining,
    chaseRisk,
    exitRisk,
    liquidity: vl,
    monthlyComponent
  }) : null;
  return {
    modelId: "POST_CLOSE_THREE_HORIZON_FIT_V1",
    modelVersion: "V1",
    framework: "post-close-three-horizon-fit-v1",
    purpose: "個股主動查詢的三週期適配；不參與DayTrade掃描榜排序",
    dataTiming: "POST_CLOSE",
    scoreSemantic: "FIT_SCORE_NOT_WIN_RATE",
    scoringRule: "85～100優先作戰｜70～84可以操作｜55～69關注即可｜0～54略過",
    dayTradePreMarket: day,
    shortSwing: short,
    longSwing: long,
    primaryHorizon: primary,
    secondaryHorizon: secondary,
    factorContributionAudit,
    ablationShadowLab,
    note: "三項都是盤後適配度，不是統計勝率。明日當沖分數只能代表盤前候選品質；實際開盤仍需人工確認，系統目前不具盤中即時行情。"
  };
}



const REPLAY_RESEARCH_MODEL_V39B7 = "HISTORICAL_REPLAY_DATASET_V0_2_CONTEXT";
// B9 research-only enrichment: append anchor-known liquidity/volatility/decision context to Replay records.
// No new fetch, no ranking/score change; context is derived from the same prefix-only Decision Layer.
const REPLAY_RESEARCH_MIN_HISTORY_V39B7 = 180;
const REPLAY_RESEARCH_HORIZONS_V39B7 = Object.freeze([1,3,5]);
const REPLAY_RESEARCH_DEFAULT_LIMIT_V39B7 = 24;
const REPLAY_RESEARCH_MAX_LIMIT_V39B7 = 60;
const REPLAY_RESEARCH_DEFAULT_STEP_V39B7 = 5;
const REPLAY_RESEARCH_MAX_STEP_V39B7 = 20;

function replayMonthKeyV39B7(date) {
  const s=String(date||"");
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(0,7).replace("-",""):null;
}
function replayRoundPctV39B7(v){return Number.isFinite(Number(v))?round(Number(v),3):null;}
function replayMonthlyStateV39B7(monthMap, rows, anchorIndex) {
  const anchor=rows?.[anchorIndex], next=rows?.[anchorIndex+1];
  const monthKey=replayMonthKeyV39B7(anchor?.date);
  const nextMonthKey=replayMonthKeyV39B7(next?.date);
  const isCompletedMonthEnd=!!monthKey && !!nextMonthKey && monthKey!==nextMonthKey;
  if(!isCompletedMonthEnd){
    return {available:false,comparable:false,isCompletedMonthEnd:false,monthKey,reason:"INTRAMONTH_OFFICIAL_MONTHLY_ASOF_UNAVAILABLE"};
  }
  const dbg=buildMonthlyRegimeTimelineDebug(monthMap,monthKey);
  const state=dbg?.state||{};
  const available=dbg?.evaluableMonths>0 && state.currentPass!==null && state.currentPass!==undefined;
  return {
    available,comparable:available,isCompletedMonthEnd:true,monthKey,
    monthlyActive:available?(state.currentPass===true&&state.startConfirmed===true):false,
    currentPass:available?state.currentPass:null,startMonth:state.startMonth||null,startConfirmed:!!state.startConfirmed,
    monthsAvailable:dbg?.monthsAvailable||0,evaluableMonths:dbg?.evaluableMonths||0,
    reason:available?"OFFICIAL_COMPLETED_MONTH_REPLAY":"OFFICIAL_MONTHLY_HISTORY_INSUFFICIENT"
  };
}
function replayOutcomeLabelsV39B7(rows, anchorIndex, fib) {
  const anchor=rows?.[anchorIndex], close=numberOrNull(anchor?.close);
  if(!anchor||close===null||!(close>0))return null;
  const B=numberOrNull(fib?.B);
  const out={};
  for(const h of REPLAY_RESEARCH_HORIZONS_V39B7){
    const future=rows.slice(anchorIndex+1,anchorIndex+1+h);
    if(future.length<h){out[`d${h}`]={available:false,bars:future.length};continue;}
    const highs=future.map(r=>numberOrNull(r.high)).filter(x=>x!==null),lows=future.map(r=>numberOrNull(r.low)).filter(x=>x!==null),closes=future.map(r=>numberOrNull(r.close)).filter(x=>x!==null);
    const lastClose=closes.length?closes[closes.length-1]:null;
    out[`d${h}`]={
      available:true,bars:future.length,
      startDate:future[0]?.date||null,endDate:future[future.length-1]?.date||null,
      closeReturnPct:lastClose===null?null:replayRoundPctV39B7((lastClose/close-1)*100),
      mfePct:highs.length?replayRoundPctV39B7((Math.max(...highs)/close-1)*100):null,
      maePct:lows.length?replayRoundPctV39B7((Math.min(...lows)/close-1)*100):null,
      maxCloseReturnPct:closes.length?replayRoundPctV39B7((Math.max(...closes)/close-1)*100):null,
      minCloseReturnPct:closes.length?replayRoundPctV39B7((Math.min(...closes)/close-1)*100):null,
      fibBKnown:B!==null,
      closeBelowFibBWithinWindow:B===null?null:future.some(r=>numberOrNull(r.close)!==null&&numberOrNull(r.close)<B),
      lowBelowFibBWithinWindow:B===null?null:future.some(r=>numberOrNull(r.low)!==null&&numberOrNull(r.low)<B)
    };
  }
  return out;
}
function replayFeatureRecordV39B7(rows, anchorIndex, monthMap) {
  const prefix=rows.slice(0,anchorIndex+1), anchor=prefix[prefix.length-1];
  if(prefix.length<REPLAY_RESEARCH_MIN_HISTORY_V39B7||!anchor)return null;
  const close=numberOrNull(anchor.close);if(close===null)return null;
  const fib=analyzeFibonacciNPattern(prefix,close);
  const volume=analyzeVolumeContext(prefix,fib);
  const structure=analyzeStructureQuality(prefix,fib,volume);
  const rsiSeries=calculateRSISeries(prefix.map(r=>r.close),RSI_PERIOD);
  const dailyRsi5=rsiSeries.length?rsiSeries[rsiSeries.length-1]:null;
  const monthly=replayMonthlyStateV39B7(monthMap,prefix.concat(rows.slice(anchorIndex+1,anchorIndex+2)),prefix.length-1);
  const decision=buildPostCloseDecisionLayerV29140({
    rows:prefix,fib,volume,structure,tactical:null,
    monthlyActive:monthly.monthlyActive===true,monthlyAvailable:monthly.available===true,dailyRsi5,
    includeResearchAudit:true
  });
  const t=decision?.tradeability||{}, ab=t?.ablationShadowLab||null, fa=t?.factorContributionAudit||null;
  const longComparable=monthly.comparable===true;
  const score=(x)=>numberOrNull(x?.score);
  const variantScores={};
  for(const id of ["NO_NESTED_REUSE_RENORM","HALF_ENTRY_QUALITY_RENORM","NO_ENTRY_QUALITY_RENORM"]){
    variantScores[id]={
      dayTradePreMarket:numberOrNull(ab?.horizons?.dayTradePreMarket?.variants?.[id]?.finalScore),
      shortSwing:numberOrNull(ab?.horizons?.shortSwing?.variants?.[id]?.finalScore),
      longSwing:longComparable?numberOrNull(ab?.horizons?.longSwing?.variants?.[id]?.finalScore):null
    };
  }
  const labels=replayOutcomeLabelsV39B7(rows,anchorIndex,fib);
  return {
    asOfDate:anchor.date,featureCutoffDate:anchor.date,labelStartDate:rows?.[anchorIndex+1]?.date||null,
    lookbackBarsUsed:prefix.length,close:round(close,2),dailyRsi5:round(dailyRsi5,2),
    formalScores:{
      dayTradePreMarket:score(t.dayTradePreMarket),shortSwing:score(t.shortSwing),
      longSwing:longComparable?score(t.longSwing):null,
      longSwingComparable:longComparable
    },
    formalClasses:{dayTradePreMarket:t?.dayTradePreMarket?.key||null,shortSwing:t?.shortSwing?.key||null,longSwing:longComparable?(t?.longSwing?.key||null):null},
    formalPrimary:{key:t?.primaryHorizon?.key||null,score:numberOrNull(t?.primaryHorizon?.score)},
    shadowVariants:variantScores,
    fib:{status:fib?.status||null,A:numberOrNull(fib?.A),B:numberOrNull(fib?.B),C:numberOrNull(fib?.C),breakoutDate:fib?.breakoutDate||null,confirmDate:fib?.confirmDate||null},
    factorAudit:{
      dayStructuralReusePct:numberOrNull(fa?.horizons?.dayTradePreMarket?.structuralReuse?.reusedViaEntryQualityWeightPct),
      shortStructuralReusePct:numberOrNull(fa?.horizons?.shortSwing?.structuralReuse?.reusedViaEntryQualityWeightPct),
      dayMaxSensitivity:ab?.horizons?.dayTradePreMarket?.maxDirectTermSensitivity||null,
      shortMaxSensitivity:ab?.horizons?.shortSwing?.maxDirectTermSensitivity||null
    },
    researchContext:{
      liquidity:{
        avg5TradeValueTwd:numberOrNull(t?.liquidity?.avg5TradeValueTwd),
        liquidityScore:numberOrNull(t?.liquidity?.liquidityScore),
        atr14Pct:numberOrNull(t?.liquidity?.atr14Pct),
        volatilityScore:numberOrNull(t?.liquidity?.volatilityScore)
      },
      decisionScores:{
        trendPersistence:numberOrNull(decision?.trendPersistence?.score),
        volumePriceHealth:numberOrNull(decision?.volumePriceHealth?.score),
        remainingOpportunity:numberOrNull(decision?.remainingOpportunity?.score),
        entryQuality:numberOrNull(decision?.entryQuality?.score),
        chaseRisk:numberOrNull(decision?.chaseRisk?.score),
        exitRisk:numberOrNull(decision?.exitRisk?.score)
      },
      sourceTiming:"ANCHOR_OR_EARLIER_ONLY"
    },
    monthly,
    labels,
    integrity:{
      featureRowsEndAtAnchor:true,futureRowsExcludedFromFeatures:true,labelsBeginAfterAnchor:!!labels,
      researchContextUsesAnchorOrEarlier:true,
      monthlyPolicy:longComparable?"OFFICIAL_MONTH_END_ONLY":"LONG_SWING_NOT_COMPARABLE_INTRAMONTH"
    }
  };
}
function replaySummaryV39B7(records){
  const vals=(path)=>records.map(r=>path(r)).filter(v=>Number.isFinite(Number(v))).map(Number);
  const avg=a=>a.length?round(a.reduce((s,x)=>s+x,0)/a.length,3):null;
  const summary={records:records.length,horizons:{}};
  for(const h of REPLAY_RESEARCH_HORIZONS_V39B7){
    summary.horizons[`d${h}`]={
      labeled:vals(r=>r?.labels?.[`d${h}`]?.available?1:NaN).length,
      avgCloseReturnPct:avg(vals(r=>r?.labels?.[`d${h}`]?.closeReturnPct)),
      avgMfePct:avg(vals(r=>r?.labels?.[`d${h}`]?.mfePct)),
      avgMaePct:avg(vals(r=>r?.labels?.[`d${h}`]?.maePct))
    };
  }
  summary.longSwingComparableRecords=records.filter(r=>r?.formalScores?.longSwingComparable===true).length;
  summary.researchContextCoverage={
    liquidityRecords:records.filter(r=>numberOrNull(r?.researchContext?.liquidity?.liquidityScore)!==null).length,
    avg5TradeValueRecords:records.filter(r=>numberOrNull(r?.researchContext?.liquidity?.avg5TradeValueTwd)!==null).length,
    decisionContextRecords:records.filter(r=>numberOrNull(r?.researchContext?.decisionScores?.entryQuality)!==null).length
  };
  return summary;
}
function buildHistoricalReplayDatasetV39B7(rows, monthMap, {limit=REPLAY_RESEARCH_DEFAULT_LIMIT_V39B7,step=REPLAY_RESEARCH_DEFAULT_STEP_V39B7}={}) {
  const source=Array.isArray(rows)?rows.filter(isValidDailyRow).sort((a,b)=>a.date.localeCompare(b.date)):[];
  const maxH=Math.max(...REPLAY_RESEARCH_HORIZONS_V39B7);
  const lastAnchor=source.length-1-maxH;
  const indices=[];
  for(let i=lastAnchor;i>=REPLAY_RESEARCH_MIN_HISTORY_V39B7-1&&indices.length<limit;i-=step)indices.push(i);
  indices.reverse();
  const records=indices.map(i=>replayFeatureRecordV39B7(source,i,monthMap)).filter(Boolean);
  return {
    modelId:REPLAY_RESEARCH_MODEL_V39B7,researchOnly:true,affectsScores:false,affectsRanking:false,
    generatedAt:new Date().toISOString(),
    policy:{
      featureCutoff:"anchor completed daily bar",labels:"future completed daily bars only",horizons:[...REPLAY_RESEARCH_HORIZONS_V39B7],
      minHistoryBars:REPLAY_RESEARCH_MIN_HISTORY_V39B7,step,limit,
      monthly:"longSwing only comparable on completed month-end anchors with sufficient official monthly history"
    },
    sourceBars:source.length,firstSourceDate:source[0]?.date||null,lastSourceDate:source[source.length-1]?.date||null,
    records,summary:replaySummaryV39B7(records),
    warning:"此資料集只建立時間隔離與原始結果標籤；單檔 Replay 不代表勝率或績效改善，仍需交由跨股票樣本外研究流程比較。"
  };
}

function buildPostCloseDecisionLayerV29140({ rows, fib, volume, structure, tactical, monthlyActive, monthlyAvailable, dailyRsi5, includeResearchAudit = true }) {
  const source = Array.isArray(rows) ? rows.filter(isValidDailyRow).sort((a,b) => a.date.localeCompare(b.date)) : [];
  const ma = buildMaSnapshotV29140(source);
  const trendPersistence = buildTrendPersistenceV29140(source, ma);
  const maDeduction = buildMaDeductionV29140(source);
  const volumePriceHealth = buildVolumePriceHealthV29140(source, volume);
  const reboundQuality = buildReboundQualityV29140(source, ma, volumePriceHealth, trendPersistence);
  const pressureMap = buildPressureMapV29140(source, fib, ma);
  const remainingOpportunity = buildRemainingOpportunityV29140(source, fib, pressureMap);
  const chaseRisk = buildChaseRiskV29140(source, ma, dailyRsi5);
  const exitRisk = buildExitRiskV29140(source, fib, structure, ma, volumePriceHealth);
  const entryQuality = buildEntryQualityV29140({ trend: trendPersistence, maDeduction, volumeHealth: volumePriceHealth, rebound: reboundQuality, remaining: remainingOpportunity, chaseRisk, exitRisk });
  const tradeability = buildTradeabilityV29140({ rows: source, trend: trendPersistence, maDeduction, volumeHealth: volumePriceHealth, rebound: reboundQuality, remaining: remainingOpportunity, entryQuality, chaseRisk, exitRisk, monthlyActive: !!monthlyActive, monthlyAvailable: monthlyAvailable !== false, includeResearchAudit });
  const actionGate = buildActionGateV40({ fib, tradeability, remainingOpportunity, pressureMap, chaseRisk });
  return {
    version: "R5.3.2.4.6-post-close-safety-contract",
    asOfDate: source[source.length - 1]?.date || null,
    timing: "POST_CLOSE_ONLY",
    maSnapshot: Object.fromEntries(Object.entries(ma).map(([k,v]) => [k, typeof v === "number" ? round(v,2) : v])),
    trendPersistence,
    maDeduction,
    volumePriceHealth,
    reboundQuality,
    pressureMap,
    remainingOpportunity,
    entryQuality,
    chaseRisk,
    exitRisk,
    tradeability,
    actionGate,
    sourcePolicy: "僅使用已完成日K＋既有Fib/量能/structure/月線狀態；不使用隔日盤中資料。"
  };
}

function buildActionGateV40({ fib, tradeability, remainingOpportunity, pressureMap, chaseRisk }) {
  const dayFit = numberOrNull(tradeability?.dayTradePreMarket?.score);
  const chase = numberOrNull(chaseRisk?.score);
  const B = numberOrNull(fib?.B);
  const breakoutConfirmed = fib?.confirmed === true || fib?.status === "confirmed";
  const firstResistanceSpacePct = numberOrNull(
    pressureMap?.nearestResistance?.distancePct ?? remainingOpportunity?.upsidePct
  );
  const liquidity = tradeability?.dayTradePreMarket?.liquidity || null;
  const liquidityReady = numberOrNull(liquidity?.avg5TradeValueTwd) !== null;
  const reasons = [];
  let key = "READY", icon = "🟢", label = "盤前條件通過", gradeCap = null;

  if (dayFit === null || !liquidityReady || firstResistanceSpacePct === null) {
    key = "DATA_INSUFFICIENT"; icon = "⚪"; label = "條件資料不足"; gradeCap = "B";
    reasons.push("個股完整盤後資料或第一壓力空間不足");
  } else if (dayFit < 55) {
    key = "CONDITIONS_INSUFFICIENT"; icon = "⚪"; label = "條件不足"; gradeCap = "B";
    reasons.push(`個股三週期盤前適配 ${round(dayFit, 0)} 分，未達55分`);
  } else if (chase !== null && chase >= 60) {
    key = "HIGH_CHASE_RISK"; icon = "🔴"; label = "追價風險高"; gradeCap = "B";
    reasons.push(`個股追價風險 ${round(chase, 0)} 分偏高`);
  } else if (firstResistanceSpacePct < 1.5) {
    key = "SPACE_INSUFFICIENT"; icon = "🟠"; label = "第一壓力空間不足"; gradeCap = "B";
    reasons.push(`距第一壓力僅 ${round(firstResistanceSpacePct, 2)}%`);
  } else if (B === null) {
    key = "WAIT_STRUCTURE"; icon = "🟡"; label = "等待結構建立"; gradeCap = "B";
    reasons.push("尚未形成可驗證的B點");
  } else if (!breakoutConfirmed) {
    key = "WAIT_BREAKOUT"; icon = "🟡"; label = "等待突破"; gradeCap = "B";
    reasons.push(`尚未以完整日K收盤突破B ${round(B, 2)}`);
  }

  const top3Eligible = key === "READY" && breakoutConfirmed && firstResistanceSpacePct >= 1.5;
  return {
    modelId: "V40_DAYTRADE_ACTION_GATE_V1",
    version: "R5.3.2.4.6", dataTiming: "POST_CLOSE", authority: "BASE_WORKER_GATE",
    key, icon, label, reasons, gradeCap, top3Eligible,
    originalScorePreserved: true,
    dayTradeFitScore: dayFit,
    B,
    breakoutConfirmed,
    firstResistanceSpacePct,
    firstResistance: pressureMap?.nearestResistance ?? remainingOpportunity?.target ?? null,
    chaseRiskScore: chase,
    liquidity,
    preMarketMeaning: "盤前適配只代表次一交易日的觀察資格，不是進場訊號。",
    openActivationRule: "盤後無法確認隔日盤中量能、觸發與站穩；需次日自行觀察後才可評估是否啟動。",
    rule: "條件不足／等待突破／追價風險高最高B級；B未突破或第一壓力小於1.5%不得進前三。原始分數保留。"
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  if (value === null || value === undefined) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function emptyMarketResult(debug = null) {
  return {
    rows: [],
    name: null,
    debug: debug || undefined
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jsonResponse(data, status, corsHeaders) {
  if (data?.stock && data?.dailySeriesMeta?.schema==='daily-ohlcv-v1') {
    data=globalThis.ShitouWorkerDataContractV1.seal(data,{evidence:data.dailySeriesMeta.volumeUnitSource});
    const audit=globalThis.ShitouWorkerDataContractV1.verify(data);
    if(!audit.ok){data={version:VERSION,stock:data.stock,market:data.market,error:'DATA_INVALID｜'+audit.reason,failureCode:'DATA_INVALID'};status=422;}
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export {buildDailySeriesMeta,serializeDailySeriesForFrontend,getCompletedDailyRows,projectScanLitePayloadV29130,jsonResponse};

export {assistantRecentDatesV47};
