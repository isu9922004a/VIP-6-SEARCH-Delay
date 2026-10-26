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
// 石頭少爺 Agent V49｜R5.3.2.4.26-R4.9.3：休市日備援＋DAILY_ONLY＋MOMENTUM_LITE 輕量批次掃描。
// 修正：即使 latest.json 的 marketCalendar 尚未同步，2026 官方休市日也不會被誤判成必須取得當日行情。
// 石頭少爺 Agent V47｜R5.3.2.4.13-R4.1：沿用 .13 五本教材策略母版；市場掃描改讀 isu9922004a/VIP-BOWTOWER-4-SEARCH 由 GitHub Actions 產生的 TWSE＋TPEx 官方完整盤後快照，Cloudflare 不再直連 TPEx。
// 石頭少爺 Agent V40 正式版｜市場深入分析支援精簡與完整模式，預設維持完整相容。
// ============================================================
// 石頭少爺 Agent｜台股大盤＋全市場掃描專用雲端資料服務
// 正式顯示版本：石頭少爺 Agent V40 正式版
// V40 Action Gate 契約：profile=CORE 固定使用 mode=SCAN_LITE；profile=FULL 改取真正完整個股結果，
// 供最終候選與個股頁共用同一 Action Gate。TPEx／Cache+KV／TAIEX／全市場快篩不變。
// V2.6.17：TPEx 先以公司清單過濾＋OHLC 驗證＋四碼普通股去重，只有「乾淨快照」達完整性門檻才可保存/採用；last-good 改存約 880+ 檔有效行情，不再存 10,000+ 原始 CSV 列。
// V2.6.16：TPEx last-good 改為 Cache API＋可選 KV 雙層持久備援；同交易日 date-key；只保存足夠完整的上櫃行情。
// V2.6.15：新增政府資料開放平臺所指向的 TPEx「上櫃股票收盤行情」otc_quotes_no1430 歷史全市場端點；盤前以 TWSE 最新交易日轉民國日期查詢。
// V2.6.13：TPEx 三層容錯（OpenAPI → TWSE MIS OTC → 同交易日 last-good 快取）＋不快取不完整市場快照＋force=1 真正強制刷新
//
// 路由：
// 1) ?market=TAIEX
//    - TWSE 官方 TAIEX 日線 OHLC
//    - FMTQIK 市場成交股數
//    - MA5/10/20/60、RSI5、MA20斜率/乖離
//    - pivot-abc-v2.4 A/B/C、N字生命週期
//    - 最近最多120根 dailySeries OHLCV
//
// 2) ?market=ALL_STOCKS
//    ?market=SCAN
//    ?market=MOMENTUM
//    - Worker 代理 TWSE + TPEx 全市場行情
//    - 同步取得公司產業資料
//    - 統一回傳 code/name/market/OHLC/volume/tradeValue/pct/industry
//    - Cloudflare edge cache 300 秒
//    - 給前端主升動能掃描第一階段使用
//
// 測試：
// https://你的worker.workers.dev/?market=TAIEX
// https://你的worker.workers.dev/?market=TAIEX&debug=1
// https://你的worker.workers.dev/?market=ALL_STOCKS
// https://你的worker.workers.dev/?market=ALL_STOCKS&debug=1
// V2.6.1 meta.marketCoverageReady=true 才允許前端產生正式排行
// ============================================================

const VERSION = "石頭少爺 Agent V49｜R5.3.2.4.26-R4.9.3-DATEGATE.1-CLOSED-BAR.1-CONTRACT.1｜盤後交易日完整性修補";

// V2.6.21｜全市場相對強弱 Context
// - 保留 V2.6.20 Key Broker / Big5、V2.6.17 全市場完整性、V2.6.9 Service Binding DeepScan。
// - ALL_STOCKS 每檔新增：相對全市場、相對產業、產業上漲家數比、全市場上漲家數比。
// - 只用同一盤後快照做橫向比較，不改 Fib / ABC / DeepScan / 三榜核心。

// ------------------------------
// TAIEX 核心參數
// ------------------------------
const RSI_PERIOD = 5;
const FIB_LOOKBACK_DAYS = 360;
const FIB_PIVOT_LEFT = 3;
const FIB_PIVOT_RIGHT = 3;
const FIB_MIN_AB_PCT = 0.06;
const FIB_MIN_RETRACE_OF_AB = 0.15;
const FIB_MAX_RETRACE_OF_AB = 0.85;
const TAIWAN_COMPLETED_BAR_HOUR = 14;
const TAIWAN_COMPLETED_BAR_MINUTE = 30;
const FETCH_TIMEOUT_MS = 8000;
const TAIEX_FETCH_MONTHS = 24;
const TAIEX_BATCH_SIZE = 4;
const B_RETEST_TOLERANCE_PCT = 1.5;
const TAIEX_DAILY_SERIES_RETURN_BARS = 120;
const TAIEX_DAILY_SERIES_MIN_RECOMMENDED_BARS = 60;
const TAIEX_VOLUME_FETCH_MONTHS = 8;

// ------------------------------
// ALL_STOCKS 批次行情參數
// V2.5.1：主升掃描只保留一般四碼個股；ETF/ETN/權證等 0 開頭或非純四碼代號不進快照。
// 產業欄位標準化為 industryCode / industryName / industryRaw，方便前端用代碼做硬性排除。
// ------------------------------
const TWSE_ALL_QUOTES_V25 = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_ALL_QUOTES_V25 = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes";
const TWSE_COMPANY_V25 = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const TPEX_COMPANY_V25 = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";
const ALL_STOCKS_CACHE_SECONDS_V25 = 300;
const ALL_STOCKS_TIMEOUT_MS_V25 = 12000;

// V2.6｜第二階段深度分析代理：由 Market Worker 代替 Safari 呼叫個股分析 Worker。
// V2.6.10：移除舊 2330 四模式健康 Probe，Service Binding 存在即直接用 ?stock= 測真正要求的股票。
// V2.6.9：DeepScan 改走 Cloudflare Service Binding（變數名稱固定 FIB_API）。
// TWSE／TPEx／MIS 等既有外部 fetch 保持原樣，只改個股分析 Worker 的呼叫。
const STOCK_ANALYSIS_API_V26 = "https://shitou-agent-fib-api.d318426.workers.dev";
// V2.6.11：1597 直得已證實個股 Worker 可直接正常回傳；Market Worker 原 22 秒 AbortController 會過早中止慢股。
// 本版只把單次 DeepScan 等待提高到 65 秒，並取消同一檔的重複重試，避免 22秒×2 造成約44秒後仍失敗。
// V2.6.12：單檔 1597、3094 均已證實可成功；大量掃描失敗集中在多檔同時執行。
// 因此只把 DeepScan 內部併行數由 4 降到 2，降低個股 Worker / 上游資料源瞬間壓力。
// 65 秒 timeout、單次嘗試、Service Binding、TWSE/TPEx/MIS、MOMENTUM_FAST 邏輯全部保持不變。
const DEEP_SCAN_MAX_CODES_V26 = 20;
const DEEP_SCAN_CONCURRENCY_V26 = 2;
// R4.9 DAILY_ONLY 每檔只做完成日K，允許較高但仍保守的服務綁定併行。
const DEEP_SCAN_DAILY_ONLY_CONCURRENCY_R49 = 4;
const DEEP_SCAN_DAILY_ONLY_TIMEOUT_MS_R49 = 25000;
// R4.9.3 主升MOMENTUM_LITE只做日線Fib/量價/structure，避開官方月K與Decision Layer。
const DEEP_SCAN_MOMENTUM_LITE_CONCURRENCY_R493 = 3;
const DEEP_SCAN_MOMENTUM_LITE_TIMEOUT_MS_R493 = 32000;
const DEEP_SCAN_TIMEOUT_MS_V26 = 65000;
const DEEP_SCAN_RETRIES_V26 = 1;
// V2.6.5｜DeepScan 個股 Worker 相容偵測／健康檢查
const DEEP_SCAN_HEALTH_CODES_V265 = ["2330", "2327"];
const DEEP_SCAN_DIAGNOSTIC_PREVIEW_V265 = 320;
const DEEP_SCAN_COMPAT_TTL_MS_V265 = 10 * 60 * 1000;
let deepScanCompatStateV265 = { mode: null, checkedAt: 0, diagnostic: null };

const TPEX_ALL_QUOTES_FALLBACK_V26 = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";
// V2.6.2｜TPEx 行情 Adapter：OpenAPI 純 GET + 新版 afterTrading dailyQuotes JSON/CSV + 舊版備援。
const TPEX_DAILY_LEGACY_DATA_V261 = "https://www.tpex.org.tw/web/stock/aftertrading/DAILY_CLOSE_quotes/stk_quote_result.php?l=zh-tw&o=data";
const TPEX_DAILY_LEGACY_JSON_V261 = "https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json&s=0,asc,0";
const TPEX_COMPANY_CSV_V261 = "https://mopsfin.twse.com.tw/opendata/t187ap03_O.csv";
const TPEX_MIN_QUOTE_ROWS_V261 = 300;
const TPEX_MIN_COMPANY_ROWS_V261 = 300;
const TPEX_DAILY_WEB_JSON_V262 = "https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?response=json";
const TPEX_DAILY_WEB_CSV_V262 = "https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?response=csv";
const TPEX_OTC_1430_JSON_V2615 = "https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&o=json&s=0,asc,0&se=EW";
// V2.6.4｜TPEx 官網對 Cloudflare 回 302 /errors 時，改走 TWSE MIS 的 OTC 即時/收盤快照。
// 這仍是交易所體系公開行情通道，不需要 API Key。
const TWSE_MIS_STOCKINFO_V264 = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";
const TPEX_MIS_SHARD_SIZE_V264 = 70;
const TPEX_MIS_CONCURRENCY_V264 = 3;
const TPEX_MIS_TIMEOUT_MS_V264 = 12000;

// V2.6.13｜TPEx 完整性容錯
// 1) live TPEx 成功時保存「最後一份完整上櫃行情」到 Cache API
// 2) live TPEx / MIS 暫時失敗時，只有在「快取交易日 == TWSE 最新交易日」時才允許回補
// 3) 不再把不完整 ALL_STOCKS 快照寫進 5 分鐘快取，避免一次暫時故障污染後續掃描
const TPEX_LAST_GOOD_CACHE_SECONDS_V2613 = 5 * 24 * 60 * 60;
const TPEX_LAST_GOOD_MAX_AGE_MS_V2613 = 5 * 24 * 60 * 60 * 1000;

// V2.6.17｜乾淨快照 persistent last-good。
// 若 Cloudflare Worker 綁定 KV namespace，Binding 名稱請設為 MARKET_KV。
// 沒有 KV 時程式仍可運作，只會退回既有 Cache API；有 KV 才能跨 POP / instance 穩定回補。
const TPEX_LAST_GOOD_KV_BINDING_V2617 = "MARKET_KV";
const TPEX_LAST_GOOD_KV_PREFIX_V2617 = "shitou:tpex:last-good"; // 沿用 key，V2.6.17 讀到舊 V2.6.16 raw snapshot 時會即時清洗。
const TPEX_LAST_GOOD_KV_TTL_SECONDS_V2617 = 7 * 24 * 60 * 60;

// 不再只用舊 300 檔門檻判斷「可保存 last-good」。
// 以公司清單推估完整上櫃普通股數，至少需達 72%，且不得低於 650 檔；
// 若公司清單本身異常不足，才退回舊門檻，避免誤把 300~500 檔的殘缺資料存成 last-good。
const TPEX_STRONG_MIN_ROWS_V2616 = 650;
const TPEX_EXPECTED_RATIO_V2616 = 0.72;


// ============================================================
// V2.6.20｜關鍵外資券商 Top10 標註資料代理｜Big5＋雙格式解析修正版
// 修正重點：
// 1) 富邦舊頁可能是 Big5/CP950，不再使用 Response.text() 直接假設 UTF-8。
// 2) 以 arrayBuffer + TextDecoder('big5') / UTF-8 雙解碼評分，自動挑選可讀中文版本。
// 3) 同時支援「桌機10欄詳細表」與「手機4欄精簡表」。
// 4) 日期同時支援「最後更新日：YYYY/MM/DD」與「更新日期：MM/DD」。
// 5) parsedRows 未達10或日期無法取得時，一律 available=false，不准誤寫成『並無買進』。
// 6) 顯示張數採『淨買超／淨賣超張數』；連續天數以每日淨額正負判斷。
// ============================================================
const KEY_BROKER_TOP_URLS_V2620 = code => [
  `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco_${encodeURIComponent(code)}_2.djhtm`,
  `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco.djhtm?a=${encodeURIComponent(code)}`
];
const KEY_BROKER_HISTORY_URL_V2620 = (code,bhid) => `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco0/zco0.djhtm?A=${encodeURIComponent(code)}&BHID=${encodeURIComponent(bhid)}&b=${encodeURIComponent(bhid)}&C=0&ver=V3`;
const KEY_BROKER_MAX_CODES_V2620 = 10;
const KEY_BROKER_CONCURRENCY_V2620 = 2;
const KEY_BROKER_TIMEOUT_MS_V2620 = 12000;
const KEY_BROKER_CACHE_TTL_V2620 = 600;
const KEY_BROKERS_V2620 = Object.freeze([
  {key:"MS", display:"摩根士丹利", bhid:"1470", aliases:["台灣摩根士丹利","臺灣摩根士丹利","摩根士丹利"]},
  {key:"GS", display:"美商高盛", bhid:"1480", aliases:["美商高盛","高盛"]},
  {key:"UBS", display:"新加坡商瑞銀", bhid:"1650", aliases:["新加坡商瑞銀","新加坡商瑞銀行","瑞銀"]}
]);

function keyBrokerDecodeHtmlV2620(v){
  return String(v??"")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<br\s*\/?>/gi," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&#(\d+);/g,(_,d)=>{try{return String.fromCodePoint(Number(d));}catch{return _;}})
    .replace(/<[^>]+>/g," ")
    .replace(/[\u00a0\t\r\n]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function keyBrokerNumV2620(v){
  const x=Number(String(v??"").replace(/,/g,"").replace(/%/g,"").replace(/\+/g,"").trim());
  return Number.isFinite(x)?x:null;
}
function keyBrokerDateKeyV2620(v){return String(v??"").replace(/[^0-9]/g,"").slice(0,8);}
function keyBrokerTaipeiTodayV2620(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=t=>Number(parts.find(x=>x.type===t)?.value||0);
  return {year:get("year"),month:get("month"),day:get("day")};
}
function keyBrokerNormalizeDateV2620(raw){
  const s=String(raw??"").trim();
  let m=s.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if(m)return `${m[1]}/${String(m[2]).padStart(2,"0")}/${String(m[3]).padStart(2,"0")}`;
  m=s.match(/(?:^|\D)(\d{1,2})[\/-](\d{1,2})(?:\D|$)/);
  if(!m)return null;
  const now=keyBrokerTaipeiTodayV2620();
  let y=now.year,mo=Number(m[1]),d=Number(m[2]);
  if(!(mo>=1&&mo<=12&&d>=1&&d<=31))return null;
  const candidate=Date.UTC(y,mo-1,d),today=Date.UTC(now.year,now.month-1,now.day);
  if(candidate-today>45*86400000)y-=1;
  return `${y}/${String(mo).padStart(2,"0")}/${String(d).padStart(2,"0")}`;
}
function keyBrokerAliasV2620(name){
  const raw=String(name??"").replace(/\s+/g,"").replace(/臺/g,"台");
  return KEY_BROKERS_V2620.find(k=>k.aliases.some(a=>raw.includes(String(a).replace(/\s+/g,"").replace(/臺/g,"台"))))||null;
}
function keyBrokerCellsV2620(rowHtml){
  return [...String(rowHtml||"").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>keyBrokerDecodeHtmlV2620(m[1])).filter(x=>x!=="");
}
function keyBrokerLooksNameV2620(v){
  const s=String(v??"").trim();
  return !!s && keyBrokerNumV2620(s)===null && /[A-Za-z\u3400-\u9fff]/.test(s) && !/買超|賣超|券商名稱|買進|賣出|成交比重|合計|平均|日期|單位/.test(s);
}
function keyBrokerExtractDateV2620(plain){
  const s=String(plain||"");
  let m=s.match(/(?:最後更新日|更新日期)[：:]?\s*((?:20\d{2}[\/-])?\d{1,2}[\/-]\d{1,2})/);
  if(!m)m=s.match(/(?:最後更新|更新)[：:]?\s*((?:20\d{2}[\/-])?\d{1,2}[\/-]\d{1,2})/);
  return m?keyBrokerNormalizeDateV2620(m[1]):null;
}
function keyBrokerParseTopV2620(html){
  const plain=keyBrokerDecodeHtmlV2620(html);
  const asOfDate=keyBrokerExtractDateV2620(plain);
  const buy=[],sell=[];
  const rows=[...String(html||"").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for(const rm of rows){
    const cells=keyBrokerCellsV2620(rm[1]);
    let found=null;

    // 桌機詳細表：買超券商｜買進｜賣出｜買超｜%｜賣超券商｜買進｜賣出｜賣超｜%
    if(cells.length>=10){
      for(let o=0;o<=cells.length-10;o++){
        const bName=cells[o],sName=cells[o+5];
        const nums=[cells[o+1],cells[o+2],cells[o+3],cells[o+4],cells[o+6],cells[o+7],cells[o+8],cells[o+9]].map(keyBrokerNumV2620);
        if(keyBrokerLooksNameV2620(bName)&&keyBrokerLooksNameV2620(sName)&&nums.every(x=>x!==null)){
          found={kind:"DETAIL",bName,sName,bBuy:nums[0],bSell:nums[1],bNet:Math.abs(nums[2]),bPct:nums[3],sBuy:nums[4],sSell:nums[5],sNet:Math.abs(nums[6]),sPct:nums[7]};
          break;
        }
      }
    }

    // 手機精簡表：買超券商｜買超張數｜賣超張數｜賣超券商
    if(!found&&cells.length>=4){
      for(let o=0;o<=cells.length-4;o++){
        const bName=cells[o],bNet=keyBrokerNumV2620(cells[o+1]),sNet=keyBrokerNumV2620(cells[o+2]),sName=cells[o+3];
        if(keyBrokerLooksNameV2620(bName)&&keyBrokerLooksNameV2620(sName)&&bNet!==null&&sNet!==null&&bNet>=0&&sNet>=0){
          found={kind:"COMPACT",bName,sName,bBuy:null,bSell:null,bNet:Math.abs(bNet),bPct:null,sBuy:null,sSell:null,sNet:Math.abs(sNet),sPct:null};
          break;
        }
      }
    }

    if(!found)continue;
    buy.push({rank:buy.length+1,name:found.bName,buyLots:found.bBuy,sellLots:found.bSell,netBuyLots:found.bNet,sharePct:found.bPct,layout:found.kind});
    sell.push({rank:sell.length+1,name:found.sName,buyLots:found.sBuy,sellLots:found.sSell,netSellLots:found.sNet,sharePct:found.sPct,layout:found.kind});
  }
  return {asOfDate,buyTop10:buy.slice(0,10),sellTop10:sell.slice(0,10),parsedRows:Math.min(buy.length,sell.length),rawBuyRows:buy.length,rawSellRows:sell.length};
}
function keyBrokerParseHistoryV2620(html){
  const rows=[];
  for(const rm of [...String(html||"").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]){
    const c=keyBrokerCellsV2620(rm[1]);
    if(c.length<5)continue;
    let found=null;
    for(let o=0;o<=c.length-5;o++){
      const date=keyBrokerNormalizeDateV2620(c[o]);
      if(date){
        const nums=[c[o+1],c[o+2],c[o+3],c[o+4]].map(keyBrokerNumV2620);
        if(nums.every(x=>x!==null)){found={date,buyLots:nums[0],sellLots:nums[1],totalLots:nums[2],netLots:nums[3]};break;}
      }
    }
    if(found)rows.push(found);
  }
  rows.sort((a,b)=>keyBrokerDateKeyV2620(b.date).localeCompare(keyBrokerDateKeyV2620(a.date)));
  return rows;
}
function keyBrokerByteAsciiProbeV2620(buf){
  const u8=new Uint8Array(buf);let out="";const step=8192;
  for(let i=0;i<u8.length;i+=step){out+=String.fromCharCode(...u8.subarray(i,Math.min(u8.length,i+step)));}
  return out;
}
function keyBrokerDecodeScoreV2620(text){
  const s=String(text||"");
  let score=0;
  const tokens=["買超券商","賣超券商","券商分點","買進","賣出","最後更新日","更新日期","台灣摩根士丹利","美商高盛","新加坡商瑞銀"];
  tokens.forEach((t,i)=>{if(s.includes(t))score+=(i<3?600:180);});
  const cjk=(s.match(/[\u3400-\u9fff]/g)||[]).length;
  const bad=(s.match(/\uFFFD/g)||[]).length;
  score+=Math.min(500,cjk/4)-bad*20;
  return score;
}
function keyBrokerDecodeBufferV2620(buf,contentType=""){
  const ascii=keyBrokerByteAsciiProbeV2620(buf);
  const declared=(String(contentType).match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]||ascii.match(/charset\s*=\s*["']?([^;"'\s/>]+)/i)?.[1]||"").toLowerCase();
  const labels=[];
  const add=x=>{if(x&&!labels.includes(x))labels.push(x);};
  if(/big5|950|cp950|ms950/.test(declared))add("big5");
  if(/utf-?8/.test(declared))add("utf-8");
  add("big5");add("utf-8");
  let best={text:"",encoding:"unknown",score:-Infinity};
  for(const label of labels){
    try{
      const text=new TextDecoder(label,{fatal:false}).decode(buf);
      const score=keyBrokerDecodeScoreV2620(text);
      if(score>best.score)best={text,encoding:label,score};
    }catch(_){/* 某些舊 compatibility date 若不支援 legacy label，繼續試其他解碼 */}
  }
  if(!best.text)best={text:new TextDecoder().decode(buf),encoding:"utf-8-fallback",score:0};
  return {...best,declaredCharset:declared||null};
}
async function keyBrokerFetchDecodedV2620(url,externalSignal=null){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),KEY_BROKER_TIMEOUT_MS_V2620);
  const abortFromExternal=()=>ctl.abort(externalSignal?.reason);
  if(externalSignal?.aborted)abortFromExternal();
  else externalSignal?.addEventListener?.("abort",abortFromExternal,{once:true});
  try{
    const res=await fetch(url,{headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"Mozilla/5.0 (compatible; ShitouAgent/2.6.20)"},signal:ctl.signal,cf:{cacheTtl:KEY_BROKER_CACHE_TTL_V2620,cacheEverything:true}});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const buf=await res.arrayBuffer();
    const decoded=keyBrokerDecodeBufferV2620(buf,res.headers.get("content-type")||"");
    return {...decoded,url,httpStatus:res.status,contentType:res.headers.get("content-type")||null,bytes:buf.byteLength};
  }finally{clearTimeout(timer);externalSignal?.removeEventListener?.("abort",abortFromExternal);}
}
async function keyBrokerFetchTopV2620(code,externalSignal=null){
  let best=null,lastErr=null;
  for(const url of KEY_BROKER_TOP_URLS_V2620(code)){
    try{
      const fetched=await keyBrokerFetchDecodedV2620(url,externalSignal);
      const parsed=keyBrokerParseTopV2620(fetched.text);
      const quality=(parsed.asOfDate?100:0)+Math.min(parsed.parsedRows,10)*10+fetched.score/1000;
      const candidate={...fetched,parsed,quality};
      if(!best||candidate.quality>best.quality)best=candidate;
      if(parsed.asOfDate&&parsed.parsedRows>=10)break;
    }catch(e){if(externalSignal?.aborted)throw e;lastErr=e;}
  }
  if(!best)throw lastErr||new Error("券商Top10頁讀取失敗");
  return best;
}
function keyBrokerCurrentStreakV2620(history,direction,asOfDate){
  const want=direction==="BUY"?1:-1;
  const rows=Array.isArray(history)?history:[];
  const todayKey=keyBrokerDateKeyV2620(asOfDate);
  let streak=0,i=0;
  if(!rows.length||keyBrokerDateKeyV2620(rows[0].date)!==todayKey)streak=1;
  for(;i<rows.length;i++){
    const sign=rows[i].netLots>0?1:rows[i].netLots<0?-1:0;
    if(sign===want)streak++;else break;
  }
  return {days:Math.max(1,streak),historyAsOfDate:rows[0]?.date||null,historyRows:rows.length};
}
async function keyBrokerProfileOneV2620(code,externalSignal=null){
  const topFetch=await keyBrokerFetchTopV2620(code,externalSignal);
  const top=topFetch.parsed;
  if(!top.asOfDate)throw new Error(`券商Top10頁日期解析失敗｜encoding=${topFetch.encoding}`);
  if(top.parsedRows<10)throw new Error(`券商Top10頁僅解析 ${top.parsedRows} 列，未達Top10完整門檻｜encoding=${topFetch.encoding}`);
  const keyBuyers=[],keySellers=[];
  for(const side of ["BUY","SELL"]){
    const source=side==="BUY"?top.buyTop10:top.sellTop10;
    for(const row of source){
      const cfg=keyBrokerAliasV2620(row.name);if(!cfg)continue;
      let streak={days:1,historyAsOfDate:null,historyRows:0},historyEncoding=null,historyError=null;
      try{
        const histFetch=await keyBrokerFetchDecodedV2620(KEY_BROKER_HISTORY_URL_V2620(code,cfg.bhid),externalSignal);
        historyEncoding=histFetch.encoding;
        const hist=keyBrokerParseHistoryV2620(histFetch.text);
        streak=keyBrokerCurrentStreakV2620(hist,side,top.asOfDate);
      }catch(e){if(externalSignal?.aborted)throw e;historyError=e?.message||String(e);}
      const signedNet=side==="BUY"?Math.abs(Number(row.netBuyLots)||0):-Math.abs(Number(row.netSellLots)||0);
      const item={
        key:cfg.key,name:cfg.display,sourceName:row.name,rank:row.rank,direction:side,
        buyLots:row.buyLots,sellLots:row.sellLots,netLots:signedNet,
        netAbsLots:Math.abs(signedNet),sharePct:row.sharePct,streakDays:streak.days,
        historyAsOfDate:streak.historyAsOfDate,historyRows:streak.historyRows,historyEncoding,historyError
      };
      (side==="BUY"?keyBuyers:keySellers).push(item);
    }
  }
  return {
    code,available:true,asOfDate:top.asOfDate,
    buyTop10:top.buyTop10,sellTop10:top.sellTop10,
    keyBuyers,keySellers,keyBuyerCount:keyBuyers.length,keySellerCount:keySellers.length,
    source:"富邦 eBroker｜券商分點進出明細",sourceUrl:topFetch.url,
    sourceEncoding:topFetch.encoding,sourceCharsetDeclared:topFetch.declaredCharset,
    parsedRows:top.parsedRows,
    rule:"僅認今日買超Top10／賣超Top10；顯示淨買超/淨賣超張數；連續天數以單一券商歷史『買賣超正負』計算"
  };
}
async function handleKeyBrokersV2620(request,corsHeaders,debugMode=false){
  const u=new URL(request.url);
  const codes=String(u.searchParams.get("codes")||u.searchParams.get("stock")||"")
    .split(",").map(x=>x.trim()).filter(x=>/^\d{4}$/.test(x)).slice(0,KEY_BROKER_MAX_CODES_V2620);
  if(!codes.length)return jsonResponse({version:VERSION,type:"KEY_BROKER_SCAN",error:"請提供 codes，例如 ?market=KEY_BROKERS&codes=2330,2454"},400,corsHeaders);
  const results=new Array(codes.length);let cursor=0;
  async function loop(){
    while(true){
      const i=cursor++;if(i>=codes.length)break;const code=codes[i];
      try{results[i]={code,ok:true,data:await keyBrokerProfileOneV2620(code,request.signal)};}
      catch(e){results[i]={code,ok:false,error:e?.message||String(e),data:{code,available:false,error:e?.message||String(e)}};}
    }
  }
  await Promise.all(Array.from({length:Math.min(KEY_BROKER_CONCURRENCY_V2620,codes.length)},loop));
  const success=results.filter(x=>x?.ok).length;
  return jsonResponse({
    version:VERSION,type:"KEY_BROKER_SCAN",source:`富邦 eBroker 公開券商分點資料｜${VERSION}`,
    generatedAt:new Date().toISOString(),requested:codes.length,success,failed:codes.length-success,results,
    ...(debugMode?{config:{top10:true,minParsedRows:10,maxCodes:KEY_BROKER_MAX_CODES_V2620,concurrency:KEY_BROKER_CONCURRENCY_V2620,cacheTtl:KEY_BROKER_CACHE_TTL_V2620,decoder:"arrayBuffer → Big5/UTF-8 scored decode"}}:{})
  },200,corsHeaders);
}


export default {
  async fetch(request, env) {
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
      return jsonResponse({ version: VERSION, error: "僅支援 GET 請求。" }, 405, corsHeaders);
    }

    const url = new URL(request.url);
    const market = String(
      url.searchParams.get("market") ||
      url.searchParams.get("index") ||
      "TAIEX"
    ).trim().toUpperCase();

    const debugMode = url.searchParams.get("debug") === "1";

    // V2.6：全市場掃描快照與第二階段深度分析代理。
    if (["ALL_STOCKS", "SCAN", "MOMENTUM", "MOMENTUM_FAST", "FAST_SCAN", "FAST"].includes(market)) {
      return handleAllStocksSnapshotV264(request, corsHeaders, debugMode, env);
    }
    if (["DEEP_HEALTH", "DEEP_DIAG", "MOMENTUM_HEALTH"].includes(market)) {
      return handleDeepHealthV265(request, corsHeaders, true, env);
    }
    if (["DEEP_SCAN", "DEEP", "MOMENTUM_DEEP"].includes(market)) {
      return handleDeepScanProxyV265(request, corsHeaders, debugMode, env);
    }
    if (["KEY_BROKERS", "BROKER_TOP10", "BROKER_SCAN"].includes(market)) {
      return jsonResponse({
        version: VERSION,
        type: "KEY_BROKER_SCAN",
        available: false,
        status: "unavailable",
        source: "官方公開資料檢查",
        message: "關鍵分點：官方資料不足，本項不計分。",
        reason: "本版只接受免登入、免金鑰且可確認授權與穩定性的官方資料；舊版非官方券商頁面路徑已停用。",
        results: []
      }, 200, corsHeaders);
    }

    if (!["TAIEX", "TWII", "^TWII"].includes(market)) {
      return jsonResponse({
        version: VERSION,
        error: "目前僅支援 TAIEX、ALL_STOCKS/SCAN/MOMENTUM、MOMENTUM_FAST、DEEP_SCAN、DEEP_HEALTH 或 KEY_BROKERS。",
        market
      }, 400, corsHeaders);
    }

    return handleTaiexV25(request, corsHeaders, debugMode, market);
  },

  // R5｜Cloudflare Cron 主動同步層
  // Cron 本身不複製一套 TWSE/TPEx 正規化邏輯；
  // 它先檢查 GitHub latest.json，若盤後仍舊檔或讀取失敗，
  // 就主動 dispatch GitHub Actions 的 update-market-snapshot.yml。
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(handleMarketSyncCronR5(controller, env));
  }
};

// ============================================================
// 路由 A｜TAIEX
// ============================================================
async function handleTaiexV25(request, corsHeaders, debugMode, market) {
  const debug = { version: VERSION, market, steps: [] };

  try {
    const [history, marketVolumeHistory] = await Promise.all([
      fetchTaiexHistoryOfficial(TAIEX_FETCH_MONTHS, debugMode),
      fetchTaiexMarketVolumeOfficial(TAIEX_VOLUME_FETCH_MONTHS, debugMode)
        .catch(error => ({
          rows: [],
          monthKeys: [],
          error: error?.message || String(error),
          debug: debugMode ? [{ error: error?.message || String(error) }] : undefined
        }))
    ]);

    const rawRowsCount = history.rows.length;
    const rows = getCompletedDailyRows(history.rows);

    if (debugMode) {
      debug.steps.push({
        step: "completed-daily-filter",
        rawRows: rawRowsCount,
        completedRows: rows.length,
        filteredRows: rawRowsCount - rows.length
      });
    }

    if (rows.length < 80) {
      return jsonResponse({
        version: VERSION,
        error: "有效加權指數日線不足，暫時無法完成 MA60 與 N 字分析。",
        rowsFetched: rows.length,
        ...(debugMode ? { debug } : {})
      }, 422, corsHeaders);
    }

    const dailySeries = buildTaiexDailySeries(
      rows,
      marketVolumeHistory.rows,
      TAIEX_DAILY_SERIES_RETURN_BARS
    );

    const dailySeriesMeta = buildTaiexDailySeriesMeta(
      rows,
      marketVolumeHistory.rows,
      dailySeries,
      marketVolumeHistory.error || null
    );

    if (debugMode) {
      debug.steps.push({
        step: "daily-ohlcv-merge",
        taiexOhlcRows: rows.length,
        fmtqikVolumeRows: marketVolumeHistory.rows.length,
        returnedBars: dailySeries.length,
        firstDate: dailySeries[0]?.date || null,
        lastDate: dailySeries[dailySeries.length - 1]?.date || null,
        readyForTrident: dailySeriesMeta.readyForTrident
      });
    }

    const latest = rows[rows.length - 1];
    const previous = rows.length >= 2 ? rows[rows.length - 2] : null;
    const closes = rows.map(row => row.close);

    const dailyRsiSeries = calculateRSISeries(closes, RSI_PERIOD);
    const dailyRsi5 = dailyRsiSeries.length
      ? dailyRsiSeries[dailyRsiSeries.length - 1]
      : null;

    const ma5 = simpleMovingAverage(closes, 5);
    const ma10 = simpleMovingAverage(closes, 10);
    const ma20 = simpleMovingAverage(closes, 20);
    const ma60 = simpleMovingAverage(closes, 60);
    const ma20Series = simpleMovingAverageSeries(closes, 20);
    const ma20Slope5Pct = calculateSeriesSlopePct(ma20Series, 5);
    const ma20GapPct = ma20 && ma20 > 0
      ? ((latest.close - ma20) / ma20) * 100
      : null;

    const fibBase = analyzeFibonacciNPattern(rows, latest.close);
    const fib = augmentTaiexFibLevels(fibBase);
    const state = deriveTaiexNState(fib, latest);

    const change = previous ? latest.close - previous.close : null;
    const changePct = previous && previous.close
      ? (change / previous.close) * 100
      : null;

    const trend = classifyTaiexTrend({
      close: latest.close,
      ma5,
      ma10,
      ma20,
      ma60,
      ma20Slope5Pct
    });

    const result = {
      version: VERSION,
      type: "MARKET_INDEX",
      market: "TWSE",
      index: "TAIEX",
      symbol: "TAIEX",
      name: "臺灣加權股價指數",
      source: dailySeries.length >= 2
        ? "TWSE Official｜TAIEX OHLC + FMTQIK 市場成交股數"
        : "TWSE Official｜TAIEX OHLC（FMTQIK量能暫不可用）",
      dailySeries,
      dailySeriesMeta,
      close: round(latest.close, 2),
      open: round(latest.open, 2),
      high: round(latest.high, 2),
      low: round(latest.low, 2),
      closeDate: latest.date,
      latestDailyHigh: round(latest.high, 2),
      latestDailyLow: round(latest.low, 2),
      previousClose: previous ? round(previous.close, 2) : null,
      change: round(change, 2),
      changePct: round(changePct, 2),
      dailyRsi5: round(dailyRsi5, 2),
      ma5: round(ma5, 2),
      ma10: round(ma10, 2),
      ma20: round(ma20, 2),
      ma60: round(ma60, 2),
      ma20Slope5Pct: round(ma20Slope5Pct, 2),
      ma20GapPct: round(ma20GapPct, 2),
      trend,
      nStatus: state.nStatus,
      N_STATUS: state.nStatus,
      nPhase: state.nPhase,
      N_PHASE: state.nPhase,
      fib,
      historyRows: rows.length,
      historyMonthsRequested: TAIEX_FETCH_MONTHS,
      logic: {
        data: "TWSE 官方發行量加權股價指數歷史資料（日 OHLC）",
        completedDaily: "台灣時間 14:30 前不把當日日K視為正式完成日K",
        volume: "大盤V使用TWSE官方FMTQIK集中市場每日成交股數；僅供量價與三叉戟判讀，不改TAIEX指數核心OHLC",
        dailySeries: "最近最多120根已完成交易日OHLCV，依日期合併 TAIEX OHLC + FMTQIK 成交股數",
        fib: "pivot-abc-v2.4：lookback 360 日、pivot 3/3、A→B 至少 6%、C 回檔 15%～85%",
        retracement: "回檔價 = B - (B - A) × 回檔比例",
        extension: "延伸目標 = C + (B - A) × 延伸倍數"
      },
      ...(debugMode ? {
        debug: {
          ...debug,
          requestedMonthKeys: history.monthKeys,
          monthFetch: history.debug || null,
          volumeMonthFetch: marketVolumeHistory.debug || null,
          volumeFetchError: marketVolumeHistory.error || null,
          recentRows: rows.slice(-10),
          recentDailySeries: dailySeries.slice(-10)
        }
      } : {})
    };

    return jsonResponse(result, 200, corsHeaders);
  } catch (error) {
    debug.fatal = { message: error?.message || String(error) };
    return jsonResponse({
      version: VERSION,
      error: "大盤加權指數分析失敗",
      message: error?.message || String(error),
      ...(debugMode ? { debug } : {})
    }, 500, corsHeaders);
  }
}

// ============================================================
const TAIWAN_INDUSTRY_NAME_MAP_V251 = Object.freeze({
  "01":"水泥工業","02":"食品工業","03":"塑膠工業","04":"紡織纖維","05":"電機機械",
  "06":"電器電纜","08":"玻璃陶瓷","09":"造紙工業","10":"鋼鐵工業","11":"橡膠工業",
  "12":"汽車工業","14":"建材營造","15":"航運業","16":"觀光餐旅","17":"金融保險",
  "18":"貿易百貨","20":"其他","21":"化學工業","22":"生技醫療","23":"油電燃氣",
  "24":"半導體業","25":"電腦及週邊設備業","26":"光電業","27":"通信網路業","28":"電子零組件業",
  "29":"電子通路業","30":"資訊服務業","31":"其他電子業","32":"文化創意業","33":"農業科技業",
  "34":"電子商務","35":"綠能環保","36":"數位雲端","37":"運動休閒","38":"居家生活"
});

function isOrdinaryFourDigitStockCodeV251(code) {
  return /^[1-9]\d{3}$/.test(String(code || "").trim());
}

function normalizeIndustryV251(raw) {
  const text = String(raw || "").trim();
  let code = "";
  const m = text.match(/(?:^|\D)(\d{2})(?:\D|$)/);
  if (m && TAIWAN_INDUSTRY_NAME_MAP_V251[m[1]]) code = m[1];
  if (!code) {
    for (const [k, name] of Object.entries(TAIWAN_INDUSTRY_NAME_MAP_V251)) {
      if (text.includes(name)) { code = k; break; }
    }
  }
  const name = code ? TAIWAN_INDUSTRY_NAME_MAP_V251[code] : text;
  return { industryCode: code, industryName: name || "", industryRaw: text };
}

function hasValidOhlcV251(q) {
  return !!q && Number.isFinite(q.open) && Number.isFinite(q.high) && Number.isFinite(q.low) &&
    Number.isFinite(q.close) && q.open > 0 && q.high > 0 && q.low > 0 && q.close > 0 &&
    q.high >= q.low && q.high >= q.open && q.high >= q.close && q.low <= q.open && q.low <= q.close;
}


// V2.6.8｜主升動能漏斗式快篩：只做低成本 Gate，不假裝已完成 MA20 / RSI / ABC / 盈虧比。
const MOMENTUM_FAST_MIN_TRADE_VALUE_V268=15000000;
const MOMENTUM_FAST_MIN_VOLUME_V268=150000;
const MOMENTUM_FAST_MIN_CLOSE_V268=8;
const MOMENTUM_FAST_MIN_CLOSE_POS_V268=0.50;
const MOMENTUM_FAST_MIN_PCT_V268=-1.50;

function momentumFastScoreV268(q){
  if(!q||!(q.close>0))return -Infinity;
  let s=0;
  const pct=Number.isFinite(Number(q.pct))?Number(q.pct):null;
  const cp=Number.isFinite(Number(q.closePos))?Number(q.closePos):null;
  const tv=Number.isFinite(Number(q.tradeValue))?Number(q.tradeValue):0;
  const o=Number(q.open),h=Number(q.high),l=Number(q.low),c=Number(q.close);
  if(pct!==null){
    if(pct>=2&&pct<5)s+=24; else if(pct>=0&&pct<2)s+=18;
    else if(pct>=5&&pct<8)s+=20; else if(pct>=8)s+=12; else if(pct>=-1.5)s+=6;
  }
  if(cp!==null)s+=Math.max(0,Math.min(24,cp*24));
  if(tv>0)s+=Math.max(0,Math.min(28,(Math.log10(tv)-7)*18));
  if(Number.isFinite(o)&&c>=o)s+=10; else s-=4;
  if(Number.isFinite(h)&&Number.isFinite(l)&&l>0&&h>l){
    const rp=(h-l)/l*100; if(rp<=6)s+=6; else if(rp>=12)s-=6;
  }
  return Math.round(s*100)/100;
}
function buildMomentumFastRowsV268(rows,limit=60){
  const st={input:Array.isArray(rows)?rows.length:0,excludedFinancial:0,excludedBiotech:0,excludedLiquidity:0,excludedPrice:0,excludedWeakClose:0,excludedWeakPct:0,passedGate:0,returned:0};
  const passed=[];
  for(const q of Array.isArray(rows)?rows:[]){
    const ic=String(q?.industryCode||"").trim();
    if(ic==="17"){st.excludedFinancial++;continue;}
    if(ic==="22"){st.excludedBiotech++;continue;}
    const c=Number(q?.close),v=Number(q?.volume),tv=Number(q?.tradeValue),cp=Number(q?.closePos),pct=Number(q?.pct);
    if(!(c>=MOMENTUM_FAST_MIN_CLOSE_V268)){st.excludedPrice++;continue;}
    if(!(v>=MOMENTUM_FAST_MIN_VOLUME_V268)||!(tv>=MOMENTUM_FAST_MIN_TRADE_VALUE_V268)){st.excludedLiquidity++;continue;}
    if(!Number.isFinite(cp)||cp<MOMENTUM_FAST_MIN_CLOSE_POS_V268){st.excludedWeakClose++;continue;}
    if(!Number.isFinite(pct)||pct<MOMENTUM_FAST_MIN_PCT_V268){st.excludedWeakPct++;continue;}
    const fastScore=momentumFastScoreV268(q); if(!Number.isFinite(fastScore))continue;
    st.passedGate++; passed.push({...q,fastScore});
  }
  passed.sort((a,b)=>(b.fastScore||0)-(a.fastScore||0)||(b.tradeValue||0)-(a.tradeValue||0));
  const out=passed.slice(0,limit); st.returned=out.length; return {rows:out,stats:st};
}


// 路由 B｜ALL_STOCKS 全市場快照
// ============================================================
// R5.3.2.4.13-R4｜GitHub Actions 官方完整盤後快照架構
// - Cloudflare Market Worker 不再直接向 TPEx 取全市場行情或公司清單。
// - GitHub Actions 直接抓 TWSE＋TPEx 官方資料，兩市場同一交易日且完整才更新 latest.json。
// - Worker 每次 ALL_STOCKS / MOMENTUM_FAST 只需讀取一份 GitHub Raw 靜態快照。
// - MARKET_SNAPSHOT_URL 可用 Worker 環境變數覆寫；預設直接指向實際 repo：isu9922004a/VIP-BOWTOWER-4-SEARCH。
// - 使用 raw.githubusercontent.com 可避開 GitHub Pages 發布延遲；資料仍由同一 GitHub Actions 產生。
// ============================================================
const MARKET_SNAPSHOT_DEFAULT_URL_R13R4 = "https://raw.githubusercontent.com/isu9922004a/VIP-BOWTOWER-4-SEARCH/main/data/market/latest.json";
const MARKET_SNAPSHOT_MIN_TWSE_ROWS_R13R4 = 800;
const MARKET_SNAPSHOT_MIN_TPEX_ROWS_R13R4 = 600;
const MARKET_SNAPSHOT_MAX_AGE_DAYS_R13R4 = 14;

// ============================================================
// R5｜Cloudflare Cron 主動同步層
// 架構：
// Cloudflare Cron（主動喚醒）→ GitHub workflow_dispatch
// GitHub Actions schedule（第二層備援）
// 瀏覽器 GitHub Raw / Pages fallback（第三層）
//
// 安全原則：
// - 不把 GitHub Token 寫死在程式碼。
// - Token 只讀 Cloudflare Secret：GITHUB_ACTIONS_TOKEN。
// - Cron 先檢查 latest.json；只有交易日盤後仍舊檔／快照讀取失敗才 dispatch。
// - MARKET_KV 已綁定時，會保存最後 dispatch 狀態並做冷卻；未綁 KV 仍可運作。
// ============================================================
const MARKET_SYNC_GITHUB_REPO_R5 = "isu9922004a/VIP-BOWTOWER-4-SEARCH";
const MARKET_SYNC_GITHUB_WORKFLOW_R5 = "update-market-snapshot.yml";
const MARKET_SYNC_GITHUB_REF_R5 = "main";
const MARKET_SYNC_STATE_KEY_R5 = "shitou:market-sync:last-dispatch:v1";
const MARKET_SYNC_COOLDOWN_MS_R5 = 8 * 60 * 1000;

function marketSyncConfigR5(env) {
  const repo = String(env?.GITHUB_REPO || MARKET_SYNC_GITHUB_REPO_R5).trim();
  const workflow = String(env?.GITHUB_WORKFLOW || MARKET_SYNC_GITHUB_WORKFLOW_R5).trim();
  const ref = String(env?.GITHUB_REF || MARKET_SYNC_GITHUB_REF_R5).trim();
  const token = String(env?.GITHUB_ACTIONS_TOKEN || "").trim();
  return { repo, workflow, ref, token };
}

async function readMarketSyncStateR5(env) {
  if (!env?.MARKET_KV?.get) return null;
  try {
    const raw = await env.MARKET_KV.get(MARKET_SYNC_STATE_KEY_R5);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

async function writeMarketSyncStateR5(env, state) {
  if (!env?.MARKET_KV?.put) return;
  try {
    await env.MARKET_KV.put(
      MARKET_SYNC_STATE_KEY_R5,
      JSON.stringify(state),
      { expirationTtl: 24 * 60 * 60 }
    );
  } catch (_) {
    // 狀態保存失敗不能阻斷正式同步。
  }
}

async function githubWorkflowBusyR5(env) {
  const cfg = marketSyncConfigR5(env);
  if (!cfg.token || !cfg.repo || !cfg.workflow) return null;

  const api =
    `https://api.github.com/repos/${cfg.repo}/actions/workflows/` +
    `${encodeURIComponent(cfg.workflow)}/runs?branch=${encodeURIComponent(cfg.ref)}&per_page=10`;

  try {
    const res = await fetch(api, {
      method: "GET",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${cfg.token}`,
        "User-Agent": "Shitou-Market-Cron/1.0",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!res.ok) return null;

    const data = await res.json();
    const runs = Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
    const busy = runs.find(r =>
      ["queued", "in_progress", "waiting", "requested", "pending"].includes(
        String(r?.status || "").toLowerCase()
      )
    );

    return busy ? {
      id: busy.id,
      status: busy.status,
      event: busy.event,
      createdAt: busy.created_at || null,
      url: busy.html_url || null
    } : false;
  } catch (_) {
    return null;
  }
}

async function dispatchMarketSnapshotWorkflowR5(env, reason, expectedTradeDate) {
  const cfg = marketSyncConfigR5(env);
  if (!cfg.token) {
    throw new Error(
      "Cloudflare Secret GITHUB_ACTIONS_TOKEN 尚未設定；Cron 無法 dispatch GitHub Actions。"
    );
  }
  if (!cfg.repo || !cfg.workflow || !cfg.ref) {
    throw new Error("GitHub dispatch 設定不完整。");
  }

  const api =
    `https://api.github.com/repos/${cfg.repo}/actions/workflows/` +
    `${encodeURIComponent(cfg.workflow)}/dispatches`;

  const res = await fetch(api, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      "User-Agent": "Shitou-Market-Cron/1.0",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ ref: cfg.ref })
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `GitHub workflow_dispatch HTTP ${res.status}` +
      (body ? `｜${body.slice(0, 300)}` : "")
    );
  }

  const state = {
    dispatchedAt: new Date().toISOString(),
    expectedTradeDate: expectedTradeDate || null,
    reason: String(reason || "stale-snapshot"),
    workflow: cfg.workflow,
    ref: cfg.ref,
    repo: cfg.repo,
    status: res.status
  };
  await writeMarketSyncStateR5(env, state);
  return state;
}

async function handleMarketSyncCronR5(controller, env) {
  const scheduledAt = new Date(
    Number(controller?.scheduledTime) || Date.now()
  );

  const loaded = await fetchMarketSnapshotR13R4(env);
  const snapshot = loaded.snapshot || {};
  const targetDate = normalizeMarketDateV2613(
    snapshot.tradeDate || snapshot.tradeDateIso || ""
  );
  const freshness = marketSnapshotTimelinessR42(
    targetDate,
    snapshot.marketCalendar,
    scheduledAt
  );

  const diagnostic = {
    event: "MARKET_SYNC_CRON_R5",
    cron: controller?.cron || null,
    scheduledAt: scheduledAt.toISOString(),
    targetDate,
    taipeiToday: freshness.today,
    afterCutoff: freshness.afterCutoff,
    expectedTradeDate: freshness.expectedTradeDate,
    todayMarketClosed: freshness.todayMarketClosed,
    snapshotOk: loaded.ok,
    snapshotError: loaded.diag?.error || null,
    freshnessReady: freshness.ready,
    freshnessReason: freshness.reason || null
  };

  // 休市日 / 週末：保留最近完整交易日，不 dispatch。
  if (freshness.todayMarketClosed) {
    console.log(JSON.stringify({
      ...diagnostic,
      action: "SKIP_MARKET_CLOSED"
    }));
    return;
  }

  // Cron 即使被誤設到盤中，也不在 17:35 前觸發盤後更新。
  if (!freshness.afterCutoff) {
    console.log(JSON.stringify({
      ...diagnostic,
      action: "SKIP_BEFORE_POST_CLOSE_CUTOFF"
    }));
    return;
  }

  // 今天完整資料已經存在，不再重跑 GitHub Actions。
  if (loaded.ok && freshness.ready) {
    console.log(JSON.stringify({
      ...diagnostic,
      action: "SKIP_ALREADY_FRESH"
    }));
    return;
  }

  const expectedTradeDate = freshness.expectedTradeDate || freshness.today;

  // 若同一個 GitHub workflow 已經 queued / in_progress，
  // Cloudflare Cron 不再重複 dispatch，避免 concurrency 把前一輪取消掉。
  const busyRun = await githubWorkflowBusyR5(env);
  if (busyRun) {
    console.log(JSON.stringify({
      ...diagnostic,
      action: "SKIP_GITHUB_WORKFLOW_BUSY",
      busyRun
    }));
    return;
  }

  const prior = await readMarketSyncStateR5(env);
  const priorAt = Date.parse(prior?.dispatchedAt || "");

  if (
    prior?.expectedTradeDate === expectedTradeDate &&
    Number.isFinite(priorAt) &&
    Date.now() - priorAt < MARKET_SYNC_COOLDOWN_MS_R5
  ) {
    console.log(JSON.stringify({
      ...diagnostic,
      action: "SKIP_DISPATCH_COOLDOWN",
      priorDispatch: prior
    }));
    return;
  }

  const reason =
    loaded.diag?.error ||
    freshness.reason ||
    `盤後 ${expectedTradeDate} 快照尚未完成`;

  try {
    const dispatch = await dispatchMarketSnapshotWorkflowR5(
      env,
      reason,
      expectedTradeDate
    );
    console.log(JSON.stringify({
      ...diagnostic,
      action: "DISPATCH_GITHUB_ACTIONS",
      dispatch
    }));
  } catch (error) {
    console.error(JSON.stringify({
      ...diagnostic,
      action: "DISPATCH_FAILED",
      error: String(error?.message || error)
    }));
    throw error;
  }
}


function marketSnapshotUrlR13R4(env){
  const custom=String(env?.MARKET_SNAPSHOT_URL||"").trim();
  return /^https:\/\//i.test(custom)?custom:MARKET_SNAPSHOT_DEFAULT_URL_R13R4;
}
function marketSnapshotAgeDaysR13R4(tradeDate){
  const s=String(tradeDate||"").replace(/\D/g,"");
  if(!/^\d{8}$/.test(s))return null;
  const d=new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00+08:00`);
  if(!Number.isFinite(d.getTime()))return null;
  return (Date.now()-d.getTime())/86400000;
}
// GitHub 的「最後一份完整快照」不等於今天的「最新盤後快照」。
// 17:35 只是保守閘門（非保證發布時間）。R4.9.2：官方 marketCalendar 優先；若欄位尚未同步，
// 2026 年使用已核對的 TWSE 官方休市日備援，避免 9/25、9/28 這類平日休市被誤判為資料過期。
const TWSE_CLOSED_FALLBACK_R492=Object.freeze({
  '20260101':'中華民國開國紀念日','20260212':'市場無交易','20260213':'市場無交易',
  '20260215':'農曆除夕及春節','20260216':'農曆除夕及春節','20260217':'農曆除夕及春節','20260218':'農曆除夕及春節','20260219':'農曆除夕及春節','20260220':'農曆除夕及春節',
  '20260227':'和平紀念日補假','20260228':'和平紀念日','20260403':'兒童節補假','20260404':'兒童節','20260405':'清明節','20260406':'清明節補假',
  '20260501':'勞動節','20260619':'端午節','20260925':'中秋節','20260928':'孔子誕辰紀念日／教師節',
  '20261023':'薔琵颱風：TWSE／TPEx 全日臨時休市（https://eshop.twse.com.tw/zh/home/index）',
  '20261009':'國慶日補假','20261010':'國慶日','20261025':'臺灣光復暨金門古寧頭大捷紀念日','20261026':'紀念日補假','20261225':'行憲紀念日'
});
function marketCalendarClosureR48(calendar,date){
  const d=normalizeMarketDateV2613(date);if(!d)return null;
  const rows=Array.isArray(calendar?.closures)?calendar.closures:[];
  const hit=rows.find(x=>normalizeMarketDateV2613(x?.date)===d);
  if(hit)return {date:d,name:String(hit?.name||"官方休市日"),source:String(calendar?.source||"TWSE holiday schedule")};
  const fallback=TWSE_CLOSED_FALLBACK_R492[d];
  return fallback?{date:d,name:fallback,source:'TWSE 2026 官方休市日備援 R4.9.2'}:null;
}
// 2026-10-17 DATA-GATE. Determine the latest *completed trading session* on
// weekends/holidays and before the 17:35 conservatively completed-bar cutoff.
// Do not conflate a coherent old snapshot with the latest eligible session.
function marketExpectedCompletedSessionR202610(calendar, now, hour, minute){
  const local = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=k=>String(local.find(p=>p.type===k)?.value||"");
  const todayUtc=Date.UTC(Number(part("year")), Number(part("month"))-1, Number(part("day")));
  const afterCutoff=hour*60+minute>=17*60+35;
  for(let back=0;back<=30;back++){
    if(back===0&&!afterCutoff)continue;
    const dt=new Date(todayUtc-back*86400000),weekday=dt.getUTCDay();
    if(weekday===0||weekday===6)continue;
    const compact=dt.toISOString().slice(0,10).replace(/-/g,"");
    if(marketCalendarClosureR48(calendar,compact))continue;
    return compact;
  }
  return null;
}
function marketSnapshotTimelinessR42(tradeDate, calendar=null, now = new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const get=k=>String(parts.find(p=>p.type===k)?.value||"");
  const today=`${get("year")}${get("month")}${get("day")}`;
  const weekday=new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`).getUTCDay();
  const isWeekday=weekday>=1&&weekday<=5;
  const isWeekend=weekday===0||weekday===6;
  const closure=marketCalendarClosureR48(calendar,today);
  const todayMarketClosed=isWeekend||!!closure;
  const hour=Number(get("hour")),minute=Number(get("minute"));
  const afterCutoff=hour*60+minute>=17*60+35;
  const date=normalizeMarketDateV2613(tradeDate);
  const expectedTradeDate=marketExpectedCompletedSessionR202610(calendar,now,hour,minute);
  let reason=null;
  if(!date)reason="市場快照缺少有效交易日";
  else if(date>today)reason=`快照日期 ${date} 晚於台灣今天 ${today}`;
  else if(date===today&&!afterCutoff&&!todayMarketClosed)reason=`當日 ${today} 尚在保守盤後整理時段，17:35 後再核對`;
  else if(!expectedTradeDate)reason="無法確定最近已完成交易日，暫停正式掃描";
  else if(date!==expectedTradeDate)reason=`快照 ${date} 並非最近已完成交易日 ${expectedTradeDate}；需同步盤後資料`;
  return {ready:!reason,reason,today,expectedTradeDate,afterCutoff,isWeekday,todayMarketClosed,
    marketClosureName:closure?.name||(isWeekend?"週末":null),calendarReady:Array.isArray(calendar?.closures)&&calendar.closures.length>0,calendarSource:calendar?.source||null};
}

function marketSnapshotObservedDateR42(rows){
  const dates=new Map();
  for(const row of rows){
    const d=normalizeMarketDateV2613(row?.quoteDate);
    if(d)dates.set(d,(dates.get(d)||0)+1);
  }
  return [...dates.entries()].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]))[0]?.[0]||null;
}
async function fetchMarketSnapshotR13R4(env){
  const base=marketSnapshotUrlR13R4(env);
  const url=`${base}${base.includes("?")?"&":"?"}_=${Date.now()}`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  const diag={label:"GitHub Repo 官方完整盤後快照",url:base,status:null,finalUrl:null,contentType:null,error:null};
  try{
    const res=await fetch(url,{method:"GET",signal:controller.signal,cf:{cacheTtl:30,cacheEverything:true}});
    diag.status=res.status;diag.finalUrl=res.url||base;diag.contentType=String(res.headers.get("content-type")||"");
    const text=await res.text();
    if(!res.ok){diag.error=`快照 HTTP ${res.status}`;return {ok:false,snapshot:null,diag};}
    if(/text\/html|application\/xhtml/i.test(diag.contentType)||text.trim().startsWith("<")){
      diag.error="快照回傳 HTML，latest.json 尚未產生或 GitHub Raw 尚未更新";return {ok:false,snapshot:null,diag};
    }
    let data=null;try{data=JSON.parse(text);}catch(_){diag.error="快照 JSON 解析失敗";return {ok:false,snapshot:null,diag};}
    if(!data||typeof data!=="object"||!Array.isArray(data.rows)){diag.error="快照格式錯誤：缺少 rows";return {ok:false,snapshot:data,diag};}
    return {ok:true,snapshot:data,diag};
  }catch(e){
    diag.error=e?.name==="AbortError"?"快照讀取 timeout":String(e?.message||e||"快照讀取失敗");
    return {ok:false,snapshot:null,diag};
  }finally{clearTimeout(timer);}
}

async function handleAllStocksSnapshotV264(request, corsHeaders, debugMode = false, env = {}) {
  const requestUrl=new URL(request.url);
  const marketMode=String(requestUrl.searchParams.get("market")||"ALL_STOCKS").toUpperCase();
  const fastMode=["MOMENTUM_FAST","FAST_SCAN","FAST"].includes(marketMode);
  const requestedLimit=Number(requestUrl.searchParams.get("limit"));
  const fastLimit=Number.isFinite(requestedLimit)?Math.max(20,Math.min(120,Math.round(requestedLimit))):60;
  const startedAt=Date.now();

  const loaded=await fetchMarketSnapshotR13R4(env);
  const snap=loaded.snapshot||{};
  const targetDate=normalizeMarketDateV2613(snap.tradeDate||snap.tradeDateIso||"");
  const inputRows=Array.isArray(snap.rows)?snap.rows:[];
  const twseRows=inputRows.filter(r=>String(r?.market||"").toUpperCase()==="TWSE");
  const tpexRows=inputRows.filter(r=>String(r?.market||"").toUpperCase()==="TPEX");
  const dateMismatchRows=inputRows.filter(r=>{
    const qd=normalizeMarketDateV2613(r?.quoteDate);return !!targetDate&&!!qd&&qd!==targetDate;
  }).length;
  const dateMissingRows=inputRows.filter(r=>!normalizeMarketDateV2613(r?.quoteDate)).length;
  const twseObservedDate=marketSnapshotObservedDateR42(twseRows);
  const tpexObservedDate=marketSnapshotObservedDateR42(tpexRows);
  const twseSourceDate=normalizeMarketDateV2613(snap?.sourceMeta?.twseQuotes?.finalDate)||twseObservedDate;
  const tpexSourceDate=normalizeMarketDateV2613(snap?.sourceMeta?.tpexQuotes?.finalDate)||tpexObservedDate;
  const sourceDateMismatch=!!targetDate&&([twseSourceDate,tpexSourceDate].some(d=>!!d&&d!==targetDate)||
    (twseSourceDate&&twseObservedDate&&twseSourceDate!==twseObservedDate)||
    (tpexSourceDate&&tpexObservedDate&&tpexSourceDate!==tpexObservedDate));
  const isoDateMismatch=!!snap.tradeDateIso&&normalizeMarketDateV2613(snap.tradeDateIso)!==targetDate;
  const declaredCountsMismatch=!!snap.counts&&[
    [snap.counts.totalRows,inputRows.length],
    [snap.counts.twseRows,twseRows.length],
    [snap.counts.tpexRows,tpexRows.length]
  ].some(([declared,actual])=>declared!==undefined&&declared!==null&&Number(declared)!==actual);
  const twseUsable=twseRows.filter(r=>isOrdinaryFourDigitStockCodeV251(r?.code)&&hasValidOhlcV251(r)).length;
  const tpexUsable=tpexRows.filter(r=>isOrdinaryFourDigitStockCodeV251(r?.code)&&hasValidOhlcV251(r)).length;
  const freshness=marketSnapshotTimelinessR42(targetDate,snap.marketCalendar);
  const ageDays=marketSnapshotAgeDaysR13R4(targetDate);
  const ageReady=ageDays!==null&&ageDays>=0&&ageDays<=MARKET_SNAPSHOT_MAX_AGE_DAYS_R13R4;
  const twseReady=twseUsable>=MARKET_SNAPSHOT_MIN_TWSE_ROWS_R13R4;
  const tpexReady=tpexUsable>=MARKET_SNAPSHOT_MIN_TPEX_ROWS_R13R4;
  const snapshotDeclaredReady=snap.marketCoverageReady===true;
  const schemaReady=Number(snap.schemaVersion)>=1&&!!targetDate&&dateMismatchRows===0&&dateMissingRows===0&&
    !!twseObservedDate&&!!tpexObservedDate&&!sourceDateMismatch&&!isoDateMismatch&&!declaredCountsMismatch;
  const marketReady=loaded.ok&&snapshotDeclaredReady&&schemaReady&&ageReady&&freshness.ready&&twseReady&&tpexReady;

  if(!marketReady){
    const reason=[
      loaded.diag?.error,
      !targetDate?"快照缺少有效交易日":null,
      dateMismatchRows?`快照內有 ${dateMismatchRows} 檔日期不一致`:null,
      dateMissingRows?`快照內有 ${dateMissingRows} 檔缺少交易日期`:null,
      sourceDateMismatch?`來源日期與快照不一致：快照 ${targetDate||"未知"}／上市 ${twseSourceDate||"未知"}／上櫃 ${tpexSourceDate||"未知"}`:null,
      isoDateMismatch?"快照 tradeDate 與 tradeDateIso 不一致":null,
      declaredCountsMismatch?"快照 counts 與實際行情筆數不一致":null,
      freshness.reason,
      !ageReady&&ageDays!==null?`快照交易日距今 ${roundV25(ageDays,1)} 天，超過安全上限或日期不合理`:null,
      !twseReady?`上市可用行情不足 ${twseUsable}/${MARKET_SNAPSHOT_MIN_TWSE_ROWS_R13R4}（原始 ${twseRows.length}）`:null,
      !tpexReady?`上櫃可用行情不足 ${tpexUsable}/${MARKET_SNAPSHOT_MIN_TPEX_ROWS_R13R4}（原始 ${tpexRows.length}）`:null,
      snap.marketCoverageReady===false?"GitHub Action 標記市場不完整":null
    ].filter(Boolean).join("｜")||"市場快照未達完整門檻";
    return jsonResponseV25({
      version:VERSION,type:"MARKET_SCAN_SNAPSHOT",mode:fastMode?"MOMENTUM_FAST":"ALL_STOCKS",rows:[],error:reason,
      meta:{
        total:0,returnedRows:0,targetTradeDate:targetDate,completedTradeDate:targetDate,
        twseQuotes:twseRows.length,tpexQuotes:tpexRows.length,twseQuoteDate:twseSourceDate,tpexQuoteDate:tpexSourceDate,
        tpexQuoteSource:"GitHub Actions｜TPEx 官方 daily_close_quotes → 靜態完整快照",
        tpexQuoteAttempts:[{...loaded.diag,label:"GitHub Repo latest.json",rows:tpexRows.length,date:targetDate,error:reason}],
        marketCoverageReady:false,industryCoverageReady:false,
        missingMarkets:[...(twseReady?[]:["TWSE"]),...(tpexReady?[]:["TPEX"]),...(!schemaReady?["SNAPSHOT_SCHEMA"]:[]),...(!ageReady||!freshness.ready?["STALE_SNAPSHOT"]:[])],
        quoteSourcesReady:{twse:twseReady&&twseSourceDate===targetDate,tpex:tpexReady&&tpexSourceDate===targetDate},
        companySourcesReady:{twse:!!snap?.counts?.twseCompanies,tpex:!!snap?.counts?.tpexCompanies},
        expectedTradeDate:freshness.expectedTradeDate,taipeiToday:freshness.today,snapshotTimelinessReady:freshness.ready,todayMarketClosed:freshness.todayMarketClosed,marketClosureName:freshness.marketClosureName,marketCalendarReady:freshness.calendarReady,marketCalendarSource:freshness.calendarSource,
        snapshotDateMismatchRows:dateMismatchRows,snapshotDateMissingRows:dateMissingRows,
        snapshotDeclaredCountsMismatch:declaredCountsMismatch,snapshotIsoDateMismatch:isoDateMismatch,
        twseUsableQuotes:twseUsable,tpexUsableQuotes:tpexUsable,
        snapshotUrl:marketSnapshotUrlR13R4(env),snapshotGeneratedAt:snap.generatedAt||null,snapshotContentSha256:snap.contentSha256||null,
        snapshotAgeDays:roundV25(ageDays,2),subrequestPolicy:"R13R4_ONE_GITHUB_SNAPSHOT_FETCH_NO_DIRECT_TPEX_R492_HOLIDAY_FALLBACK",plannedExternalFetchMax:1,
        elapsedMs:Date.now()-startedAt,
        ...(debugMode?{snapshotCounts:snap.counts||null,diagnostic:loaded.diag}:{})
      }
    },200,corsHeaders,0);
  }

  let rows=inputRows.filter(r=>isOrdinaryFourDigitStockCodeV251(r?.code)).filter(hasValidOhlcV251).map(r=>{
    const ind=normalizeIndustryV251(r?.industryRaw||r?.industryName||r?.industry||"");
    return {
      ...r,
      market:String(r.market||"").toUpperCase()==="TWSE"?"TWSE":"TPEx",
      quoteDate:normalizeMarketDateV2613(r.quoteDate),
      industry:ind.industryName||String(r?.industryName||r?.industry||""),
      industryCode:ind.industryCode||String(r?.industryCode||""),
      industryName:ind.industryName||String(r?.industryName||r?.industry||""),
      industryRaw:ind.industryRaw||String(r?.industryRaw||"")
    };
  }).sort((a,b)=>String(a.code).localeCompare(String(b.code),"zh-TW",{numeric:true}));
  rows=enrichSnapshotRelativeContextV2621(rows);

  const fastBundle=fastMode?buildMomentumFastRowsV268(rows,fastLimit):null;
  const responseRows=fastBundle?fastBundle.rows:rows;
  const industryRate=rows.length?rows.filter(r=>r.industryCode).length/rows.length:0;
  const industryReady=rows.length>0&&industryRate>=0.85;
  const payload={
    version:VERSION,type:"MARKET_SCAN_SNAPSHOT",
    source:fastMode?`${VERSION}｜.13策略主升快篩｜GitHub官方完整快照`:`${VERSION}｜.13策略｜GitHub官方完整快照`,
    generatedAt:new Date().toISOString(),cached:false,mode:fastMode?"MOMENTUM_FAST":"ALL_STOCKS",rows:responseRows,
    meta:{
      total:rows.length,returnedRows:responseRows.length,targetTradeDate:targetDate,completedTradeDate:targetDate,
      fastFilter:fastMode?{...fastBundle.stats,limit:fastLimit,thresholds:{minTradeValue:MOMENTUM_FAST_MIN_TRADE_VALUE_V268,minVolume:MOMENTUM_FAST_MIN_VOLUME_V268,minClose:MOMENTUM_FAST_MIN_CLOSE_V268,minClosePos:MOMENTUM_FAST_MIN_CLOSE_POS_V268,minPct:MOMENTUM_FAST_MIN_PCT_V268},note:"快篩不計 MA20/RSI/ABC/盈虧比；這些保留給 DeepScan。"}:null,
      twseQuotes:twseRows.length,tpexQuotes:tpexRows.length,twseQuoteDate:twseSourceDate,tpexQuoteDate:tpexSourceDate,
      twseCompanyRows:Number(snap?.counts?.twseCompanies)||null,tpexCompanyRows:Number(snap?.counts?.tpexCompanies)||null,
      rawQuoteTotal:inputRows.length,nonOrdinaryExcluded:inputRows.length-rows.length,invalidOhlcExcluded:0,ordinaryValidTotal:rows.length,
      industryMapped:rows.filter(r=>r.industryCode).length,industryCodeReady:rows.filter(r=>r.industryCode).length,
      financialIndustryCount:rows.filter(r=>r.industryCode==="17").length,biotechIndustryCount:rows.filter(r=>r.industryCode==="22").length,
      industryCoverageRate:roundV25(industryRate,4),marketCoverageReady:true,industryCoverageReady:industryReady,
      missingMarkets:[],quoteSourcesReady:{twse:true,tpex:true},companySourcesReady:{twse:true,tpex:true},
      expectedTradeDate:freshness.expectedTradeDate,taipeiToday:freshness.today,snapshotTimelinessReady:true,todayMarketClosed:freshness.todayMarketClosed,marketClosureName:freshness.marketClosureName,marketCalendarReady:freshness.calendarReady,marketCalendarSource:freshness.calendarSource,
      snapshotDateMismatchRows:0,snapshotDateMissingRows:0,
      snapshotDeclaredCountsMismatch:false,snapshotIsoDateMismatch:false,
      twseUsableQuotes:twseUsable,tpexUsableQuotes:tpexUsable,
      tpexQuoteSource:"GitHub Actions｜TPEx 官方 daily_close_quotes → 靜態完整快照",
      tpexQuoteAttempts:[{label:"GitHub Repo latest.json",ok:true,rows:tpexRows.length,date:targetDate,status:loaded.diag?.status,finalUrl:loaded.diag?.finalUrl,contentType:loaded.diag?.contentType,error:null}],
      snapshotUrl:marketSnapshotUrlR13R4(env),snapshotGeneratedAt:snap.generatedAt||null,snapshotContentSha256:snap.contentSha256||null,
      snapshotAgeDays:roundV25(ageDays,2),subrequestPolicy:"R13R4_ONE_GITHUB_SNAPSHOT_FETCH_NO_DIRECT_TPEX_R492_HOLIDAY_FALLBACK",plannedExternalFetchMax:1,
      cacheApiCalls:0,kvCalls:0,misShardCalls:0,historicalFallbackCalls:0,directTpexCalls:0,
      elapsedMs:Date.now()-startedAt,
      ...(debugMode?{snapshotCounts:snap.counts||null,diagnostic:loaded.diag}:{})
    }
  };
  return jsonResponseV25(payload,200,corsHeaders,industryReady?60:0);
}

async function fetchJsonArrayV25(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALL_STOCKS_TIMEOUT_MS_V25);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}｜${url}`);
    const text = await res.text();
    if (text.trim().startsWith("<")) throw new Error(`HTML response｜${url}`);
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error(`JSON 非陣列｜${url}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function addIndustryRowsV25(map, rows, market) {
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = String(firstAnyV25(row, [
      "公司代號", "CompanyCode", "SecuritiesCompanyCode", "SecuritiesCode",
      "Code", "股票代號", "證券代號"
    ]) || "").trim();
    if (!isOrdinaryFourDigitStockCodeV251(code)) continue;

    const values = [];
    for (const [k, v] of Object.entries(row || {})) {
      if (/產業|industry/i.test(k) && v !== null && v !== undefined && String(v).trim()) {
        values.push(String(v).trim());
      }
    }
    map.set(code, { market, industry: values.join("｜") });
  }
}


function medianV2621(values) {
  const xs=(Array.isArray(values)?values:[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!xs.length)return null;
  const m=Math.floor(xs.length/2);
  return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}

function enrichSnapshotRelativeContextV2621(rows) {
  const source=Array.isArray(rows)?rows:[];
  if(!source.length)return source;
  const marketPcts=source.map(r=>Number(r?.pct)).filter(Number.isFinite);
  const marketMedian=medianV2621(marketPcts);
  const marketBreadth=marketPcts.length?marketPcts.filter(x=>x>0).length/marketPcts.length*100:null;
  const sectorMap=new Map();
  for(const r of source){
    const key=String(r?.industryCode||r?.industryName||"UNKNOWN");
    if(!sectorMap.has(key))sectorMap.set(key,[]);
    if(Number.isFinite(Number(r?.pct)))sectorMap.get(key).push(Number(r.pct));
  }
  const sectorStats=new Map();
  for(const [key,xs] of sectorMap.entries()){
    sectorStats.set(key,{
      medianPct:medianV2621(xs),
      breadthPct:xs.length?xs.filter(x=>x>0).length/xs.length*100:null,
      count:xs.length
    });
  }
  return source.map(r=>{
    const pct=Number.isFinite(Number(r?.pct))?Number(r.pct):null;
    const key=String(r?.industryCode||r?.industryName||"UNKNOWN");
    const sec=sectorStats.get(key)||{medianPct:null,breadthPct:null,count:0};
    const relM=pct!==null&&marketMedian!==null?pct-marketMedian:null;
    const relS=pct!==null&&sec.medianPct!==null?pct-sec.medianPct:null;
    let label="中性";
    if(relM!==null&&relS!==null){
      if(relM>=1&&relS>=0.5)label="明顯相對強";
      else if(relM>=0.3&&relS>=0)label="相對偏強";
      else if(relM<=-1&&relS<=-0.5)label="明顯相對弱";
      else if(relM<=-0.3&&relS<=0)label="相對偏弱";
    }
    return {
      ...r,
      marketContext:{
        marketMedianPct:roundV25(marketMedian,2),
        marketBreadthPct:roundV25(marketBreadth,1),
        relativeToMarketPct:roundV25(relM,2),
        sectorMedianPct:roundV25(sec.medianPct,2),
        sectorBreadthPct:roundV25(sec.breadthPct,1),
        relativeToSectorPct:roundV25(relS,2),
        sectorSampleSize:sec.count,
        label,
        timing:"POST_CLOSE_SNAPSHOT",
        rule:"同一交易日漲跌幅相對全市場／同產業中位數；不是多日歷史RS，也不是盤中即時訊號。"
      }
    };
  });
}

function normalizeQuoteV25(row, market) {
  const code = String(firstAnyV25(row, [
    "Code", "SecuritiesCompanyCode", "SecuritiesCode", "CompanyCode", "股票代號", "證券代號", "代號"
  ]) || "").trim();
  if (!/^\d{4}$/.test(code)) return null;

  const name = String(firstAnyV25(row, [
    "Name", "CompanyName", "SecuritiesCompanyName", "公司名稱", "證券名稱", "名稱", "公司簡稱"
  ]) || "").trim();

  const close = numV25(firstAnyV25(row, ["ClosingPrice", "Close", "ClosePrice", "LatestPrice", "收盤價", "成交價", "收盤"]));
  const open = numV25(firstAnyV25(row, ["OpeningPrice", "Open", "OpenPrice", "開盤價", "開盤"]));
  const high = numV25(firstAnyV25(row, ["HighestPrice", "High", "HighPrice", "最高價", "最高"]));
  const low = numV25(firstAnyV25(row, ["LowestPrice", "Low", "LowPrice", "最低價", "最低"]));
  const volume = numV25(firstAnyV25(row, ["TradeVolume", "TradingShares", "TradingVolume", "Volume", "成交股數", "成交量"]));
  const rawTradeValue = numV25(firstAnyV25(row, ["TradeValue", "TransactionAmount", "TradingAmount", "成交金額"]));
  const change = numV25(firstAnyV25(row, ["Change", "ChangeAmount", "PriceChange", "漲跌價差", "漲跌"]));

  let pct = null;
  if (close !== null && change !== null) {
    const prev = close - change;
    if (prev > 0) pct = change / prev * 100;
  }

  let closePos = null;
  if (close !== null && high !== null && low !== null && high > low) {
    closePos = (close - low) / (high - low);
  }

  const tradeValue = rawTradeValue !== null && rawTradeValue > 0
    ? rawTradeValue
    : (volume !== null && close !== null ? volume * close : null);

  return {
    code,
    name,
    market,
    close: roundV25(close, 4),
    open: roundV25(open, 4),
    high: roundV25(high, 4),
    low: roundV25(low, 4),
    volume: volume === null ? null : Math.round(volume),
    tradeValue: tradeValue === null ? null : Math.round(tradeValue),
    change: roundV25(change, 4),
    pct: roundV25(pct, 4),
    closePos: roundV25(closePos, 6)
  };
}

function firstAnyV25(row, keys) {
  for (const key of keys) {
    const v = row?.[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function numV25(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[＋+]/g, "")
    .replace(/[－−]/g, "-")
    .trim();
  if (!cleaned || cleaned === "--" || cleaned === "---" || /^N\/?A$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function roundV25(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const f = 10 ** digits;
  return Math.round(Number(value) * f) / f;
}

function jsonResponseV25(data, status, corsHeaders, cacheSeconds = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheSeconds > 0
        ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
        : "no-store",
      "X-Shitou-Cache": "MISS"
    }
  });
}

// ============================================================
// TAIEX 官方資料
// ============================================================
async function fetchTaiexHistoryOfficial(monthsCount, withDebug = false) {
  const monthKeys = getRecentMonthKeys(monthsCount);
  const rows = [];
  const debugRows = [];

  for (let i = 0; i < monthKeys.length; i += TAIEX_BATCH_SIZE) {
    const batch = monthKeys.slice(i, i + TAIEX_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(monthKey => fetchTaiexMonthOfficial(monthKey, withDebug))
    );

    results.forEach((item, index) => {
      rows.push(...item.rows);
      if (withDebug) debugRows.push({ month: batch[index], ...(item.debug || {}) });
    });

    if (i + TAIEX_BATCH_SIZE < monthKeys.length) await sleep(50);
  }

  const byDate = new Map();
  for (const row of rows) {
    if (isValidDailyRow(row)) byDate.set(row.date, row);
  }

  return {
    rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    monthKeys,
    debug: withDebug ? debugRows : undefined
  };
}

async function fetchTaiexMonthOfficial(monthKey, withDebug = false) {
  const urls = [
    "https://www.twse.com.tw/indicesReport/MI_5MINS_HIST",
    "https://wwwc.twse.com.tw/indicesReport/MI_5MINS_HIST"
  ];

  let lastError = null;

  for (const baseUrl of urls) {
    const apiUrl = `${baseUrl}?response=json&date=${monthKey}01`;
    const debug = { url: apiUrl };

    try {
      const response = await fetchWithTimeout(apiUrl, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        redirect: "follow"
      });
      const text = await response.text();
      debug.status = response.status;
      debug.preview = text.slice(0, 180);

      if (!response.ok || text.trim().startsWith("<")) {
        lastError = new Error(`TWSE TAIEX HTTP ${response.status}`);
        continue;
      }

      const payload = JSON.parse(text);
      if (!payload || !Array.isArray(payload.data)) {
        lastError = new Error("TWSE TAIEX JSON 缺少 data");
        continue;
      }

      const rows = payload.data.map(parseTaiexOfficialRow).filter(Boolean);
      return {
        rows,
        debug: withDebug ? {
          ...debug,
          stat: payload.stat || null,
          rowCount: rows.length,
          title: payload.title || null
        } : undefined
      };
    } catch (error) {
      lastError = error;
      debug.error = error?.message || String(error);
    }
  }

  return {
    rows: [],
    debug: withDebug ? { error: lastError?.message || "unknown" } : undefined
  };
}

async function fetchTaiexMarketVolumeOfficial(monthsCount, withDebug = false) {
  const monthKeys = getRecentMonthKeys(monthsCount);
  const rows = [];
  const debugRows = [];

  for (let i = 0; i < monthKeys.length; i += TAIEX_BATCH_SIZE) {
    const batch = monthKeys.slice(i, i + TAIEX_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(monthKey => fetchTaiexMarketVolumeMonthOfficial(monthKey, withDebug))
    );

    results.forEach((item, index) => {
      rows.push(...item.rows);
      if (withDebug) debugRows.push({ month: batch[index], ...(item.debug || {}) });
    });

    if (i + TAIEX_BATCH_SIZE < monthKeys.length) await sleep(50);
  }

  const byDate = new Map();
  for (const row of rows) {
    if (row && typeof row.date === "string" && Number.isFinite(row.volume) && row.volume >= 0) {
      byDate.set(row.date, row);
    }
  }

  return {
    rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    monthKeys,
    debug: withDebug ? debugRows : undefined
  };
}

async function fetchTaiexMarketVolumeMonthOfficial(monthKey, withDebug = false) {
  const urls = [
    "https://www.twse.com.tw/exchangeReport/FMTQIK",
    "https://wwwc.twse.com.tw/exchangeReport/FMTQIK"
  ];
  let lastError = null;

  for (const baseUrl of urls) {
    const apiUrl = `${baseUrl}?response=json&date=${monthKey}01`;
    const debug = { url: apiUrl };

    try {
      const response = await fetchWithTimeout(apiUrl, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        redirect: "follow"
      });
      const text = await response.text();
      debug.status = response.status;
      debug.preview = text.slice(0, 180);

      if (!response.ok || text.trim().startsWith("<")) {
        lastError = new Error(`TWSE FMTQIK HTTP ${response.status}`);
        continue;
      }

      const payload = JSON.parse(text);
      const raw = Array.isArray(payload?.data) ? payload.data : [];
      if (!raw.length) {
        lastError = new Error("TWSE FMTQIK JSON 缺少 data");
        continue;
      }

      const rows = raw.map(parseFmtqikVolumeRow).filter(Boolean);
      return {
        rows,
        debug: withDebug ? {
          ...debug,
          stat: payload.stat || null,
          rowCount: rows.length,
          title: payload.title || null,
          fields: payload.fields || null
        } : undefined
      };
    } catch (error) {
      lastError = error;
      debug.error = error?.message || String(error);
    }
  }

  return {
    rows: [],
    debug: withDebug ? { error: lastError?.message || "unknown" } : undefined
  };
}

function parseFmtqikVolumeRow(row) {
  if (!Array.isArray(row) || row.length < 2) return null;
  const date = taiwanIndexDateToISO(row[0]);
  const volume = parsePrice(row[1]);
  if (!date || volume === null || !Number.isFinite(volume) || volume < 0) return null;
  return { date, volume: Math.round(volume) };
}

function buildTaiexDailySeries(ohlcRows, volumeRows, limit = TAIEX_DAILY_SERIES_RETURN_BARS) {
  const volumeByDate = new Map();
  for (const row of Array.isArray(volumeRows) ? volumeRows : []) {
    if (row && typeof row.date === "string" && Number.isFinite(row.volume)) {
      volumeByDate.set(row.date, row.volume);
    }
  }

  const merged = [];
  for (const row of Array.isArray(ohlcRows) ? ohlcRows : []) {
    if (!isValidDailyRow(row)) continue;
    const volume = volumeByDate.get(row.date);
    if (!Number.isFinite(volume) || volume < 0) continue;
    merged.push({
      date: row.date,
      open: round(row.open, 2),
      high: round(row.high, 2),
      low: round(row.low, 2),
      close: round(row.close, 2),
      volume: Math.round(volume)
    });
  }

  const safeLimit = Math.max(
    2,
    Math.min(TAIEX_DAILY_SERIES_RETURN_BARS, Number(limit) || TAIEX_DAILY_SERIES_RETURN_BARS)
  );
  return merged.slice(-safeLimit);
}

function buildTaiexDailySeriesMeta(ohlcRows, volumeRows, dailySeries, volumeError = null) {
  return {
    schema: "taiex-daily-ohlcv-v1",
    requestedBars: TAIEX_DAILY_SERIES_RETURN_BARS,
    minRecommendedBars: TAIEX_DAILY_SERIES_MIN_RECOMMENDED_BARS,
    returnedBars: dailySeries.length,
    taiexOhlcRowsAvailable: Array.isArray(ohlcRows) ? ohlcRows.length : 0,
    fmtqikVolumeRowsAvailable: Array.isArray(volumeRows) ? volumeRows.length : 0,
    firstDate: dailySeries[0]?.date || null,
    lastDate: dailySeries[dailySeries.length - 1]?.date || null,
    ascending: true,
    onlyCompletedBars: true,
    readyForTrident: dailySeries.length >= 2,
    recommendedWindowReady: dailySeries.length >= TAIEX_DAILY_SERIES_MIN_RECOMMENDED_BARS,
    volumeMeaning: "TWSE集中市場每日成交股數（FMTQIK）",
    volumeSource: "TWSE Official FMTQIK",
    priceSource: "TWSE Official MI_5MINS_HIST",
    volumeFetchError: volumeError,
    note: dailySeries.length >= TAIEX_DAILY_SERIES_MIN_RECOMMENDED_BARS
      ? "大盤逐日OHLCV已可供真實日K、量能柱與三叉戟使用。"
      : dailySeries.length >= 2
        ? "大盤逐日OHLCV可啟用三叉戟，但歷史不足60根，較長週期型態請保守解讀。"
        : "FMTQIK量能尚未成功與TAIEX OHLC合併；大盤核心分析仍可使用，但真實量能／三叉戟暫停。"
  };
}

function parseTaiexOfficialRow(row) {
  if (!Array.isArray(row) || row.length < 5) return null;
  const date = taiwanIndexDateToISO(row[0]);
  const open = parsePrice(row[1]);
  const high = parsePrice(row[2]);
  const low = parsePrice(row[3]);
  const close = parsePrice(row[4]);

  if (!date || open === null || high === null || low === null || close === null) return null;
  return { date, open, high, low, close };
}

function taiwanIndexDateToISO(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, "");

  let match = text.match(/^(\d{2,3})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (match) {
    const year = Number(match[1]) + 1911;
    const month = String(Number(match[2])).padStart(2, "0");
    const day = String(Number(match[3])).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  match = text.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (match) {
    return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
  }

  return null;
}

// ============================================================
// 指標
// ============================================================
function simpleMovingAverage(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(-period);
  if (slice.some(value => !Number.isFinite(Number(value)))) return null;
  return slice.reduce((sum, value) => sum + Number(value), 0) / period;
}

function simpleMovingAverageSeries(values, period) {
  const result = new Array(Array.isArray(values) ? values.length : 0).fill(null);
  if (!Array.isArray(values) || period <= 0) return result;

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    if (!Number.isFinite(value)) sum = NaN;
    else sum += value;

    if (i >= period) {
      const leaving = Number(values[i - period]);
      if (Number.isFinite(leaving)) sum -= leaving;
    }

    if (i >= period - 1 && Number.isFinite(sum)) result[i] = sum / period;
  }
  return result;
}

function calculateSeriesSlopePct(series, barsBack = 5) {
  if (!Array.isArray(series) || series.length < barsBack + 1) return null;
  const latest = numberOrNull(series[series.length - 1]);
  const previous = numberOrNull(series[series.length - 1 - barsBack]);
  if (latest === null || previous === null || previous === 0) return null;
  return ((latest - previous) / previous) * 100;
}

function classifyTaiexTrend({ close, ma5, ma10, ma20, ma60, ma20Slope5Pct }) {
  const above20 = ma20 !== null && close >= ma20;
  const above60 = ma60 !== null && close >= ma60;
  const slopeUp = ma20Slope5Pct !== null && ma20Slope5Pct > 0;
  const shortBull = ma5 !== null && ma10 !== null && ma20 !== null && ma5 >= ma10 && ma10 >= ma20;

  let state = "中性整理";
  let risk = "中";

  if (above20 && above60 && slopeUp && shortBull) {
    state = "偏多";
    risk = "低";
  } else if (above20 && (above60 || slopeUp)) {
    state = "多方整理";
    risk = "中";
  } else if (!above20 && ma20Slope5Pct !== null && ma20Slope5Pct < 0) {
    state = "偏弱";
    risk = "高";
  }

  return {
    state,
    risk,
    description: state === "偏多"
      ? "加權指數位於主要均線之上，MA20斜率向上。"
      : state === "多方整理"
        ? "中期結構仍有支撐，但短線未完全多頭排列。"
        : state === "偏弱"
          ? "加權指數跌在MA20下方且MA20轉弱，個股新進與加碼宜提高門檻。"
          : "多空條件交錯，個股操作宜降低追價。"
  };
}

function calculateRSISeries(closes, period = 5) {
  const result = Array(Array.isArray(closes) ? closes.length : 0).fill(null);
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

// ============================================================
// N字顯示狀態
// ============================================================
function augmentTaiexFibLevels(fib) {
  if (!fib || typeof fib !== "object") return fib;

  const A = numberOrNull(fib.A);
  const B = numberOrNull(fib.B);
  const C = numberOrNull(fib.C);
  const AB = A !== null && B !== null ? B - A : null;

  const retracement = A !== null && B !== null && AB > 0 ? {
    "0.236": round(B - AB * 0.236, 2),
    "0.382": round(B - AB * 0.382, 2),
    "0.500": round(B - AB * 0.5, 2),
    "0.618": round(B - AB * 0.618, 2),
    "0.764": round(B - AB * 0.764, 2)
  } : null;

  const extension = C !== null && AB !== null && AB > 0 ? {
    "1.000": round(C + AB * 1.0, 2),
    "1.272": round(C + AB * 1.272, 2),
    "1.382": round(C + AB * 1.382, 2),
    "1.618": round(C + AB * 1.618, 2),
    "2.000": round(C + AB * 2.0, 2),
    "2.618": round(C + AB * 2.618, 2)
  } : null;

  return {
    ...fib,
    retracement: retracement || fib.retracement || null,
    extension: extension || fib.extension || null,
    support618: retracement ? retracement["0.618"] : fib.support618 ?? null,
    stop764: retracement ? retracement["0.764"] : fib.stop764 ?? null,
    target1618: extension ? extension["1.618"] : fib.target1618 ?? null
  };
}

function deriveTaiexNState(fib, latestRow) {
  const close = numberOrNull(latestRow?.close);
  const low = numberOrNull(latestRow?.low);
  const B = numberOrNull(fib?.B);
  const C = numberOrNull(fib?.C);

  if (fib?.status === "confirmed" || fib?.confirmed === true) {
    if (B !== null && close !== null) {
      const distancePct = Math.abs(((close - B) / B) * 100);
      if (close < B) return { nStatus: "CONFIRMED", nPhase: "WEAKENING" };
      if ((low !== null && low <= B && close >= B) || distancePct <= B_RETEST_TOLERANCE_PCT) {
        return { nStatus: "CONFIRMED", nPhase: "RETESTING" };
      }
    }
    return { nStatus: "CONFIRMED", nPhase: "EXTENDING" };
  }

  if (AorBPresent(fib) && C !== null) {
    return { nStatus: "ABC_READY", nPhase: "WAIT_BREAKOUT" };
  }

  if (fib?.lastFailedFib && !AorBPresent(fib)) {
    return { nStatus: "FAILED", nPhase: "FAILED" };
  }

  return { nStatus: "FORMING", nPhase: "WAIT_C" };
}

function AorBPresent(fib) {
  return numberOrNull(fib?.A) !== null || numberOrNull(fib?.B) !== null;
}

// ============================================================
// pivot-abc-v2.4
// ============================================================
function analyzeFibonacciNPattern(rows, latestClose) {
  const sourceRows = Array.isArray(rows)
    ? rows.filter(isValidDailyRow).sort((a, b) => a.date.localeCompare(b.date)).slice(-FIB_LOOKBACK_DAYS)
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
    invalidationRule: "尚未突破B前，任一已完成日K最低價 < A，該組A/B/C立即失效並重新尋找新的N字",
    cUpdateRule: "尚未突破B前，如後續形成更低的Swing Low，且仍滿足A < C < B及15%～85%回撤規則，C更新為新的較低Swing Low",
    completionRule: "突破B後，任一已完成日K最高價 >= 1.618延伸目標，該組N字標記completed並退出目前有效N字",
    postBreakFailureRule: "突破B後、尚未達1.618前，若任一已完成日K收盤價 < 0.764深度風控位，或日K最低價 < A，該組N字標記failed並退出目前有效N字",
    selectionRule: "completed或failed的N字不再當目前N字；目前有效N字的A之Swing確認日必須晚於最近一次completed/failed終止日"
  };

  const minimumRows = FIB_PIVOT_LEFT + FIB_PIVOT_RIGHT + 7;
  if (sourceRows.length < minimumRows) {
    return makeFibNotFormedResult("N字尚未形成：有效日K資料不足。", null, null, null, null, algorithm);
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
    if (retraceRatio < FIB_MIN_RETRACE_OF_AB || retraceRatio > FIB_MAX_RETRACE_OF_AB) continue;

    const lifecycle = evaluateFibonacciPatternLifecycle(
      { A, B, C, AB, abPct, retraceRatio },
      sourceRows,
      pivots
    );

    if (lifecycle.status === "invalidated") {
      if (!latestInvalidated || lifecycle.invalidatedDate > latestInvalidated.invalidatedDate) {
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
    return byDate !== 0 ? byDate : y.C.date.localeCompare(x.C.date);
  });

  failedPatterns.sort((x, y) => {
    const xDate = x.failedDate || x.C.date;
    const yDate = y.failedDate || y.C.date;
    const byDate = yDate.localeCompare(xDate);
    return byDate !== 0 ? byDate : y.C.date.localeCompare(x.C.date);
  });

  const latestCompleted = completedPatterns[0] || null;
  const latestFailed = failedPatterns[0] || null;
  const terminalEvents = [];

  if (latestCompleted?.completedDate) {
    terminalEvents.push({ type: "completed", date: latestCompleted.completedDate, pattern: latestCompleted });
  }
  if (latestFailed?.failedDate) {
    terminalEvents.push({ type: "failed", date: latestFailed.failedDate, pattern: latestFailed });
  }
  terminalEvents.sort((a, b) => b.date.localeCompare(a.date));

  const latestTerminal = terminalEvents[0] || null;
  const afterDate = latestTerminal ? latestTerminal.date : null;
  const currentPatterns = afterDate
    ? activePatterns.filter(pattern => getPivotConfirmDate(pattern.A) > afterDate)
    : activePatterns;

  if (currentPatterns.length === 0) {
    const latestAB = findLatestActiveABPattern(pivots, sourceRows, afterDate);
    const relevantInvalidated = latestInvalidated && (!afterDate || latestInvalidated.invalidatedDate > afterDate)
      ? latestInvalidated
      : null;

    let message;
    if (latestAB) message = "N字尚未形成：目前只有新的有效 A → B，尚未出現符合規則的 C。";
    else if (relevantInvalidated) message = "N字尚未形成：最近一組 A → B → C 已失效，系統正在等待新的有效N字。";
    else if (latestTerminal?.type === "failed") message = "上一組已確認N字已觸發突破後失敗條件；目前尚無新的有效N字。";
    else if (latestTerminal?.type === "completed") message = "上一組N字已完成1.618目標；目前尚無新的有效N字。";
    else message = "N字尚未形成：尚未找到符合規則的有效 A → B。";

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
    return byB !== 0 ? byB : y.A.date.localeCompare(x.A.date);
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
          ...candidate, C, retraceRatio, initialC, cUpdateCount,
          status: "invalidated", confirmed: false,
          breakoutRow: null, completedRow: null, completedDate: null, completedHigh: null,
          failedRow: null, failedDate: null, failedClose: null, failedLow: null,
          stop764, target1618: null,
          invalidatedDate: row.date,
          invalidatedPrice: row.low,
          invalidatedReason: "C形成後、尚未突破B前價格跌破A，原A/B/C結構失效"
        };
      }

      const newPivotLow = pivotLowByDate.get(row.date);
      if (newPivotLow && newPivotLow.price < C.price) {
        const newRetraceRatio = (B.price - newPivotLow.price) / AB;

        if (newPivotLow.price <= A.price || newRetraceRatio > FIB_MAX_RETRACE_OF_AB) {
          return {
            ...candidate, C, retraceRatio, initialC, cUpdateCount,
            status: "invalidated", confirmed: false,
            breakoutRow: null, completedRow: null, completedDate: null, completedHigh: null,
            failedRow: null, failedDate: null, failedClose: null, failedLow: null,
            stop764, target1618: null,
            invalidatedDate: newPivotLow.date,
            invalidatedPrice: newPivotLow.price,
            invalidatedReason: newPivotLow.price <= A.price
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
            ...candidate, C, retraceRatio, initialC, cUpdateCount,
            status: "completed", confirmed: true, breakoutRow,
            completedRow: row, completedDate: row.date, completedHigh: row.high,
            failedRow: null, failedDate: null, failedClose: null, failedLow: null,
            stop764, target1618,
            invalidatedDate: null, invalidatedPrice: null, invalidatedReason: null
          };
        }
      }
      continue;
    }

    if (row.high >= target1618) {
      return {
        ...candidate, C, retraceRatio, initialC, cUpdateCount,
        status: "completed", confirmed: true, breakoutRow,
        completedRow: row, completedDate: row.date, completedHigh: row.high,
        failedRow: null, failedDate: null, failedClose: null, failedLow: null,
        stop764, target1618,
        invalidatedDate: null, invalidatedPrice: null, invalidatedReason: null
      };
    }

    if (row.low < A.price) {
      return {
        ...candidate, C, retraceRatio, initialC, cUpdateCount,
        status: "failed", confirmed: false, breakoutRow,
        completedRow: null, completedDate: null, completedHigh: null,
        failedRow: row, failedDate: row.date, failedClose: row.close, failedLow: row.low,
        failureReason: "突破B後、尚未達1.618前，日K最低價跌破A，該組N字視為突破失敗",
        stop764, target1618,
        invalidatedDate: null, invalidatedPrice: null, invalidatedReason: null
      };
    }

    if (row.close < stop764) {
      return {
        ...candidate, C, retraceRatio, initialC, cUpdateCount,
        status: "failed", confirmed: false, breakoutRow,
        completedRow: null, completedDate: null, completedHigh: null,
        failedRow: row, failedDate: row.date, failedClose: row.close, failedLow: row.low,
        failureReason: "突破B後、尚未達1.618前，完成日K收盤跌破0.764深度風控位，該組N字視為突破失敗",
        stop764, target1618,
        invalidatedDate: null, invalidatedPrice: null, invalidatedReason: null
      };
    }
  }

  if (breakoutRow) {
    return {
      ...candidate, C, retraceRatio, initialC, cUpdateCount,
      status: "confirmed", confirmed: true, breakoutRow,
      completedRow: null, completedDate: null, completedHigh: null,
      failedRow: null, failedDate: null, failedClose: null, failedLow: null,
      stop764, target1618,
      invalidatedDate: null, invalidatedPrice: null, invalidatedReason: null
    };
  }

  return {
    ...candidate, C, retraceRatio, initialC, cUpdateCount,
    status: "forming", confirmed: false,
    breakoutRow: null, completedRow: null, completedDate: null, completedHigh: null,
    failedRow: null, failedDate: null, failedClose: null, failedLow: null,
    stop764, target1618: null,
    invalidatedDate: null, invalidatedPrice: null, invalidatedReason: null
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

    const broken = sourceRows.some(row => row.date > B.date && row.low < A.price);
    if (broken) continue;

    latestAB = { A, B, AB, abPct };
  }

  return latestAB;
}

function buildFibPatternResult(pattern, latestClose, latestCompleted, latestFailed, algorithm) {
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
  const distanceToSupport618Pct = close && close > 0 ? ((close - support618) / close) * 100 : null;
  const distanceToTarget1618Pct = close && close > 0 ? ((target1618 - close) / close) * 100 : null;
  const risk = close !== null ? close - stop764 : null;
  const potentialReward = close !== null ? target1618 - close : null;
  const riskRewardRatio = risk !== null && potentialReward !== null && risk > 0 && potentialReward > 0
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
      riskReward: riskRewardRatio !== null ? `1 : ${round(riskRewardRatio, 2).toFixed(2)}` : null
    },
    lastFailedFib: summarizeFailedFibPattern(latestFailed),
    lastCompletedFib: summarizeCompletedFibPattern(latestCompleted),
    algorithm
  };
}

function makeFibNotFormedResult(message, latestAB, latestInvalidated, latestCompleted, latestFailed, algorithm) {
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
    lastInvalidation: latestInvalidated ? {
      date: latestInvalidated.invalidatedDate,
      price: round(latestInvalidated.invalidatedPrice, 2),
      reason: latestInvalidated.invalidatedReason,
      A: round(latestInvalidated.A.price, 2),
      ADate: latestInvalidated.A.date,
      B: round(latestInvalidated.B.price, 2),
      BDate: latestInvalidated.B.date,
      C: round(latestInvalidated.C.price, 2),
      CDate: latestInvalidated.C.date
    } : null,
    lastFailedFib: summarizeFailedFibPattern(latestFailed),
    lastCompletedFib: summarizeCompletedFibPattern(latestCompleted),
    algorithm
  };
}

function summarizeFailedFibPattern(pattern) {
  if (!pattern) return null;
  const stop764 = pattern.stop764 ?? (pattern.B.price - pattern.AB * 0.764);
  const target1618 = pattern.target1618 ?? (pattern.C.price + pattern.AB * 1.618);
  return {
    status: "failed",
    message: "上一組已確認N字在達成1.618前觸發突破後失敗條件，已退出目前有效N字。",
    A: round(pattern.A.price, 2), ADate: pattern.A.date,
    B: round(pattern.B.price, 2), BDate: pattern.B.date,
    C: round(pattern.C.price, 2), CDate: pattern.C.date,
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
  const target1618 = pattern.target1618 ?? (pattern.C.price + pattern.AB * 1.618);
  return {
    status: "completed",
    message: "上一組N字已達1.618主要目標，已退出目前有效N字。",
    A: round(pattern.A.price, 2), ADate: pattern.A.date,
    B: round(pattern.B.price, 2), BDate: pattern.B.date,
    C: round(pattern.C.price, 2), CDate: pattern.C.date,
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

    const isLow = row.low === minLow && row.low < rows[i - 1].low && row.low < rows[i + 1].low;
    const isHigh = row.high === maxHigh && row.high > rows[i - 1].high && row.high > rows[i + 1].high;

    if (isLow === isHigh) continue;

    if (isLow) {
      pivots.push({
        type: "low", price: row.low, date: row.date, index: i,
        confirmDate: rows[i + right]?.date || row.date
      });
    }

    if (isHigh) {
      pivots.push({
        type: "high", price: row.high, date: row.date, index: i,
        confirmDate: rows[i + right]?.date || row.date
      });
    }
  }

  return pivots.sort((a, b) => a.index - b.index);
}

function getPivotConfirmDate(pivot) {
  return pivot ? (pivot.confirmDate || pivot.date || null) : null;
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

    const shouldReplace = pivot.type === "low"
      ? pivot.price < last.price
      : pivot.price > last.price;
    if (shouldReplace) result[result.length - 1] = pivot;
  }
  return result;
}

// ============================================================
// 通用日期／資料工具
// ============================================================
function getCompletedDailyRows(rows) {
  if (!Array.isArray(rows)) return [];

  const now = getTaipeiDateTimeParts();
  const cutoffMinutes = TAIWAN_COMPLETED_BAR_HOUR * 60 + TAIWAN_COMPLETED_BAR_MINUTE;
  const currentMinutes = now.hour * 60 + now.minute;

  const sorted = rows
    .filter(isValidDailyRow)
    .sort((a, b) => a.date.localeCompare(b.date));

  const byDate = new Map();
  for (const row of sorted) {
    if (row.date > now.date) continue;
    if (row.date === now.date && currentMinutes < cutoffMinutes) continue;
    byDate.set(row.date, row);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function getTaipeiDateTimeParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const get = type => parts.find(part => part.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function getRecentMonthKeys(count) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());

  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  const result = [];

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    result.push(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function isValidDailyRow(row) {
  return row &&
    typeof row.date === "string" &&
    Number.isFinite(row.open) &&
    Number.isFinite(row.high) &&
    Number.isFinite(row.low) &&
    Number.isFinite(row.close);
}

function parsePrice(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[＋+]/g, "")
    .replace(/[－−]/g, "-")
    .trim();
  if (cleaned === "" || cleaned === "--" || cleaned === "---" || cleaned === "N/A") return null;
  return numberOrNull(cleaned);
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}



// ============================================================
// V2.6.17｜TPEx Clean-Snapshot Persistent Last-Good（Cache API + KV）
// ============================================================
function tpexLastGoodKvV2617(env) {
  const kv = env?.[TPEX_LAST_GOOD_KV_BINDING_V2617];
  return kv && typeof kv.get === "function" && typeof kv.put === "function" ? kv : null;
}

function tpexLastGoodKvKeyV2617(quoteDate) {
  const d = normalizeMarketDateV2613(quoteDate) || "latest";
  return `${TPEX_LAST_GOOD_KV_PREFIX_V2617}:${d}`;
}

function tpexLastGoodCacheKeyDateV2617(request, quoteDate) {
  const u = new URL(request.url);
  const d = normalizeMarketDateV2613(quoteDate) || "latest";
  u.search = `?internal=TPEX_LAST_GOOD&schema=2617&date=${encodeURIComponent(d)}`;
  return new Request(u.toString(), { method: "GET" });
}

function toTpexSnapshotRowV2617(q, quoteDate) {
  return {
    Date: normalizeMarketDateV2613(quoteDate) || null,
    Code: q.code,
    Name: q.name || "",
    ClosingPrice: q.close,
    OpeningPrice: q.open,
    HighestPrice: q.high,
    LowestPrice: q.low,
    TradeVolume: q.volume,
    TradeValue: q.tradeValue,
    Change: q.change
  };
}

function buildCleanTpexSnapshotV2617(rows, ordinaryCodes, quoteDate) {
  const input = Array.isArray(rows) ? rows : [];
  const allowed = new Set((Array.isArray(ordinaryCodes) ? ordinaryCodes : [])
    .map(x => String(x || "").trim()).filter(isOrdinaryFourDigitStockCodeV251));
  const byCode = new Map();
  let normalizedCandidates = 0;
  let invalidOhlc = 0;
  let notInCompanyList = 0;

  for (const row of input) {
    const q = normalizeQuoteV25(row, "TPEx");
    if (!q) continue;
    normalizedCandidates++;
    if (!isOrdinaryFourDigitStockCodeV251(q.code)) continue;
    if (allowed.size && !allowed.has(q.code)) {
      notInCompanyList++;
      continue;
    }
    if (!hasValidOhlcV251(q)) {
      invalidOhlc++;
      continue;
    }
    // 與既有 byCode 行為一致：同代碼重複列以後出現的有效列覆蓋前一列。
    byCode.set(q.code, q);
  }

  const date = normalizeMarketDateV2613(quoteDate) || latestMarketQuoteDateV2613(input) || null;
  const cleanRows = [...byCode.values()]
    .sort((a, b) => a.code.localeCompare(b.code, "zh-TW", { numeric: true }))
    .map(q => toTpexSnapshotRowV2617(q, date));

  return {
    rows: cleanRows,
    rawRows: input.length,
    cleanRows: cleanRows.length,
    normalizedCandidates,
    duplicateOrFilteredRows: Math.max(0, normalizedCandidates - cleanRows.length),
    invalidOhlc,
    notInCompanyList,
    quoteDate: date
  };
}

function validateTpexLastGoodPayloadV2617(data, twseQuoteDate, minRows, ordinaryCodes) {
  const storedRows = Array.isArray(data?.rows) ? data.rows : [];
  // 相容 V2.6.16：即使 KV 裡仍是 10,000+ raw rows，讀取時也先清洗成唯一有效普通股。
  const cleaned = buildCleanTpexSnapshotV2617(
    storedRows,
    ordinaryCodes,
    data?.quoteDate || twseQuoteDate
  );
  const rows = cleaned.rows;
  const savedAtMs = Date.parse(data?.savedAt || "");
  const ageMs = Number.isFinite(savedAtMs) ? Math.max(0, Date.now() - savedAtMs) : Infinity;
  const ageMinutes = Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null;
  const cachedDate =
    normalizeMarketDateV2613(data?.quoteDate) ||
    cleaned.quoteDate ||
    latestMarketQuoteDateV2613(rows);
  const targetDate = normalizeMarketDateV2613(twseQuoteDate);
  const dateMatchedTwse = !!(targetDate && cachedDate && targetDate === cachedDate);
  const ageOk = ageMs <= TPEX_LAST_GOOD_MAX_AGE_MS_V2613;
  const threshold = Math.max(TPEX_MIN_QUOTE_ROWS_V261, Number(minRows || 0));
  const rowsOk = rows.length >= threshold;
  const dateOk = targetDate ? dateMatchedTwse : ageOk;
  const ok = rowsOk && dateOk && ageOk;

  return {
    ok,
    rows: ok ? rows : [],
    cachedDate: cachedDate || null,
    ageMinutes,
    dateMatchedTwse,
    ageOk,
    rowsOk,
    rawRows: Number(data?.rawRowCount ?? storedRows.length),
    storedRows: storedRows.length,
    normalizedRows: rows.length
  };
}

async function saveTpexLastGoodV2617(cache, env, request, rows, source, twseQuoteDate, minRows, rawRowCount) {
  // 傳入 rows 理論上已是 clean snapshot，再驗一次，避免未來呼叫端改動時把 raw rows 寫回 KV。
  const cleaned = buildCleanTpexSnapshotV2617(rows, null, twseQuoteDate);
  const cleanRows = cleaned.rows;
  const tpexDate = cleaned.quoteDate || normalizeMarketDateV2613(twseQuoteDate);
  const threshold = Math.max(TPEX_MIN_QUOTE_ROWS_V261, Number(minRows || 0));
  const rawRows = Math.max(Number(rawRowCount || 0), Array.isArray(rows) ? rows.length : 0);

  if (cleanRows.length < threshold || !tpexDate) {
    return {
      used: false, cacheHit: false, saved: false,
      cachedDate: tpexDate || null, ageMinutes: 0,
      storage: null,
      rawRows,
      normalizedRows: cleanRows.length,
      reason: `LAST_GOOD_NOT_SAVED｜rawRows=${rawRows}｜normalizedRows=${cleanRows.length}｜threshold=${threshold}｜date=${tpexDate || "null"}`
    };
  }

  const payload = {
    schema: 2617,
    version: VERSION,
    savedAt: new Date().toISOString(),
    source: source || null,
    quoteDate: tpexDate,
    twseQuoteDate: normalizeMarketDateV2613(twseQuoteDate),
    rawRowCount: rawRows,
    normalizedRowCount: cleanRows.length,
    rowCount: cleanRows.length,
    rows: cleanRows
  };
  const json = JSON.stringify(payload);

  let cacheSaved = false;
  let kvSaved = false;
  const errors = [];

  try {
    const response = new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${TPEX_LAST_GOOD_CACHE_SECONDS_V2613}, s-maxage=${TPEX_LAST_GOOD_CACHE_SECONDS_V2613}`
      }
    });
    await cache.put(tpexLastGoodCacheKeyDateV2617(request, tpexDate), response.clone());
    await cache.put(tpexLastGoodCacheKeyDateV2617(request, "latest"), response.clone());
    cacheSaved = true;
  } catch (e) {
    errors.push(`CACHE_SAVE_FAILED:${e?.message || e}`);
  }

  const kv = tpexLastGoodKvV2617(env);
  if (kv) {
    try {
      await Promise.all([
        kv.put(
          tpexLastGoodKvKeyV2617(tpexDate),
          json,
          { expirationTtl: TPEX_LAST_GOOD_KV_TTL_SECONDS_V2617 }
        ),
        kv.put(
          tpexLastGoodKvKeyV2617("latest"),
          json,
          { expirationTtl: TPEX_LAST_GOOD_KV_TTL_SECONDS_V2617 }
        )
      ]);
      kvSaved = true;
    } catch (e) {
      errors.push(`KV_SAVE_FAILED:${e?.message || e}`);
    }
  }

  return {
    used: false,
    cacheHit: false,
    saved: cacheSaved || kvSaved,
    cachedDate: tpexDate,
    ageMinutes: 0,
    storage: kvSaved ? "Cache+KV" : (cacheSaved ? "Cache" : null),
    rawRows,
    normalizedRows: cleanRows.length,
    reason: cacheSaved || kvSaved
      ? `LIVE_TPEX_OK｜clean last-good已保存｜rawRows=${rawRows}｜normalizedRows=${cleanRows.length}｜threshold=${threshold}｜storage=${kvSaved ? "Cache+KV" : "Cache"}`
      : `LAST_GOOD_SAVE_FAILED｜${errors.join("|") || "unknown"}`
  };
}

async function loadTpexLastGoodV2617(cache, env, request, twseQuoteDate, minRows, ordinaryCodes) {
  const targetDate = normalizeMarketDateV2613(twseQuoteDate);
  const threshold = Math.max(TPEX_MIN_QUOTE_ROWS_V261, Number(minRows || 0));
  const reasons = [];

  // 1) 先讀 V2.6.17 clean-snapshot Cache API。
  const cacheKeys = targetDate
    ? [tpexLastGoodCacheKeyDateV2617(request, targetDate)]
    : [tpexLastGoodCacheKeyDateV2617(request, "latest")];

  for (const key of cacheKeys) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.json();
        const v = validateTpexLastGoodPayloadV2617(data, targetDate, threshold, ordinaryCodes);
        if (v.ok) {
          return {
            ok: true,
            rows: v.rows,
            meta: {
              used: true, cacheHit: true, saved: false,
              cachedDate: v.cachedDate, ageMinutes: v.ageMinutes,
              dateMatchedTwse: v.dateMatchedTwse,
              storage: "Cache",
              rawRows: v.rawRows,
              normalizedRows: v.normalizedRows,
              reason: `LIVE_TPEX_FAIL｜同交易日 clean last-good Cache 回補成功｜normalizedRows=${v.normalizedRows}`
            }
          };
        }
        reasons.push(`CACHE_REJECTED:rawRows=${v.rawRows},normalizedRows=${v.normalizedRows},dateMatched=${v.dateMatchedTwse},ageOk=${v.ageOk}`);
      } else {
        reasons.push("CACHE_MISS");
      }
    } catch (e) {
      reasons.push(`CACHE_READ_FAILED:${e?.message || e}`);
    }
  }

  // 2) Cache miss 時讀 KV。沿用 V2.6.16 的 KV key，因此舊 raw snapshot 可直接清洗後救援。
  const kv = tpexLastGoodKvV2617(env);
  if (kv) {
    const kvKeys = targetDate
      ? [tpexLastGoodKvKeyV2617(targetDate)]
      : [tpexLastGoodKvKeyV2617("latest")];

    for (const key of kvKeys) {
      try {
        const data = await kv.get(key, { type: "json" });
        if (!data) {
          reasons.push("KV_MISS");
          continue;
        }

        const v = validateTpexLastGoodPayloadV2617(data, targetDate, threshold, ordinaryCodes);
        if (!v.ok) {
          reasons.push(`KV_REJECTED:rawRows=${v.rawRows},normalizedRows=${v.normalizedRows},dateMatched=${v.dateMatchedTwse},ageOk=${v.ageOk}`);
          continue;
        }

        // KV 命中後，把已清洗的 2617 snapshot 回暖 Cache，並順便覆寫同一 KV key 完成舊資料遷移。
        const migratedPayload = {
          schema: 2617,
          version: VERSION,
          savedAt: data?.savedAt || new Date().toISOString(),
          source: data?.source || "migrated-last-good",
          quoteDate: v.cachedDate,
          twseQuoteDate: targetDate,
          rawRowCount: v.rawRows,
          normalizedRowCount: v.normalizedRows,
          rowCount: v.normalizedRows,
          rows: v.rows
        };
        const migratedJson = JSON.stringify(migratedPayload);

        try {
          const warm = new Response(migratedJson, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": `public, max-age=${TPEX_LAST_GOOD_CACHE_SECONDS_V2613}, s-maxage=${TPEX_LAST_GOOD_CACHE_SECONDS_V2613}`
            }
          });
          await cache.put(
            tpexLastGoodCacheKeyDateV2617(request, v.cachedDate || targetDate || "latest"),
            warm.clone()
          );
          await kv.put(key, migratedJson, { expirationTtl: TPEX_LAST_GOOD_KV_TTL_SECONDS_V2617 });
        } catch (_) {}

        return {
          ok: true,
          rows: v.rows,
          meta: {
            used: true, cacheHit: false, saved: false,
            cachedDate: v.cachedDate, ageMinutes: v.ageMinutes,
            dateMatchedTwse: v.dateMatchedTwse,
            storage: "KV",
            rawRows: v.rawRows,
            normalizedRows: v.normalizedRows,
            reason: `LIVE_TPEX_FAIL｜同交易日 persistent clean last-good KV 回補成功｜normalizedRows=${v.normalizedRows}`
          }
        };
      } catch (e) {
        reasons.push(`KV_READ_FAILED:${e?.message || e}`);
      }
    }
  } else {
    reasons.push("KV_BINDING_MISSING:MARKET_KV");
  }

  return {
    ok: false,
    rows: [],
    meta: {
      used: false,
      cacheHit: false,
      saved: false,
      cachedDate: null,
      ageMinutes: null,
      dateMatchedTwse: false,
      storage: null,
      rawRows: 0,
      normalizedRows: 0,
      reason: `LAST_GOOD_MISS｜threshold=${threshold}｜${reasons.join("|")}`
    }
  };
}

// ============================================================
// V2.6.13｜TPEx last-good Cache API 容錯
// ============================================================
function normalizeMarketDateV2613(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "").trim();
  if (/^\d{7}$/.test(s)) {
    const y = Number(s.slice(0, 3)) + 1911;
    return `${String(y).padStart(4, "0")}${s.slice(3)}`;
  }
  if (/^\d{8}$/.test(s)) return s;
  return null;
}

function latestMarketQuoteDateV2613(rows) {
  const counts = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const raw =
      r?.Date ?? r?.date ?? r?.日期 ?? r?.TradeDate ??
      r?.TradingDate ?? r?.["交易日期"] ?? "";
    const d = normalizeMarketDateV2613(raw);
    if (!d) continue;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  if (!counts.size) return null;
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || b[0].localeCompare(a[0]))[0][0];
}

function tpexLastGoodCacheKeyV2613(request) {
  const u = new URL(request.url);
  u.search = "?internal=TPEX_LAST_GOOD&schema=2613";
  return new Request(u.toString(), { method: "GET" });
}

async function saveTpexLastGoodV2613(cache, request, rows, source, twseQuoteDate) {
  const tpexDate = latestMarketQuoteDateV2613(rows);
  const payload = {
    version: VERSION,
    savedAt: new Date().toISOString(),
    source: source || null,
    quoteDate: tpexDate || null,
    twseQuoteDate: twseQuoteDate || null,
    rows
  };
  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${TPEX_LAST_GOOD_CACHE_SECONDS_V2613}, s-maxage=${TPEX_LAST_GOOD_CACHE_SECONDS_V2613}`
    }
  });
  try {
    await cache.put(tpexLastGoodCacheKeyV2613(request), response);
    return {
      used: false, cacheHit: false, saved: true,
      cachedDate: tpexDate || null,
      ageMinutes: 0,
      reason: "LIVE_TPEX_OK｜已更新 last-good 快取"
    };
  } catch (e) {
    return {
      used: false, cacheHit: false, saved: false,
      cachedDate: tpexDate || null,
      ageMinutes: 0,
      reason: `LAST_GOOD_SAVE_FAILED｜${e?.message || e}`
    };
  }
}

async function loadTpexLastGoodV2613(cache, request, twseQuoteDate) {
  try {
    const hit = await cache.match(tpexLastGoodCacheKeyV2613(request));
    if (!hit) {
      return {
        ok: false, rows: [],
        meta: { used: false, cacheHit: false, saved: false, cachedDate: null, ageMinutes: null, reason: "LAST_GOOD_MISS" }
      };
    }

    const data = await hit.json();
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const savedAtMs = Date.parse(data?.savedAt || "");
    const ageMs = Number.isFinite(savedAtMs) ? Math.max(0, Date.now() - savedAtMs) : Infinity;
    const ageMinutes = Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null;
    const cachedDate = data?.quoteDate || latestMarketQuoteDateV2613(rows);
    const dateMatchedTwse = !!(twseQuoteDate && cachedDate && twseQuoteDate === cachedDate);
    const ageOk = ageMs <= TPEX_LAST_GOOD_MAX_AGE_MS_V2613;
    const rowsOk = rows.length >= TPEX_MIN_QUOTE_ROWS_V261;

    // 有 TWSE 日期時採「交易日必須一致」的硬 Gate；
    // 沒有日期可比時，才退回 age 限制，避免把數日前行情冒充最新盤後資料。
    const dateOk = twseQuoteDate ? dateMatchedTwse : ageOk;
    const ok = rowsOk && dateOk && ageOk;

    return {
      ok,
      rows: ok ? rows : [],
      meta: {
        used: ok,
        cacheHit: true,
        saved: false,
        cachedDate: cachedDate || null,
        ageMinutes,
        dateMatchedTwse,
        reason: ok
          ? "LIVE_TPEX_FAIL｜同交易日 last-good 回補成功"
          : `LAST_GOOD_REJECTED｜rows=${rows.length}｜dateMatchedTwse=${dateMatchedTwse}｜ageOk=${ageOk}`
      }
    };
  } catch (e) {
    return {
      ok: false, rows: [],
      meta: { used: false, cacheHit: false, saved: false, cachedDate: null, ageMinutes: null, reason: `LAST_GOOD_READ_FAILED｜${e?.message || e}` }
    };
  }
}

// ============================================================
// V2.6.1｜TPEx 多來源容錯
// 1. TPEx OpenAPI mainboard_quotes
// 2. TPEx OpenAPI daily_close_quotes
// 3. TPEx 官方盤後 legacy/data CSV
// 公司產業：OpenAPI 失敗時改讀 MOPS 官方 t187ap03_O.csv
// ============================================================
async function fetchTpexQuotesV2614(twseQuoteDate) {
  const errors = [];
  const attempts = [];
  const record = (label, ok, rows = 0, error = null, extra = {}) => {
    attempts.push({
      label,
      ok: !!ok,
      rows: Number(rows) || 0,
      error: error ? String(error).slice(0, 360) : null,
      ...extra
    });
  };

  const dateInfo = tpexDateInfoV2614(twseQuoteDate);

  // 第一層：最新 OpenAPI。
  const latestSources = [
    [TPEX_ALL_QUOTES_V25, "TPEx OpenAPI mainboard_quotes latest", "json-array"],
    [TPEX_ALL_QUOTES_FALLBACK_V26, "TPEx OpenAPI daily_close_quotes latest", "json-array"]
  ];

  for (const [url, label, parser] of latestSources) {
    try {
      const r = await fetchTpexRawManualV2614(url, label);
      const rows = parseTpexRawByModeV2614(r, parser);
      if (rows.length >= TPEX_MIN_QUOTE_ROWS_V261) {
        record(label, true, rows.length, null, r.meta);
        return {
          rows,
          source: label,
          errors,
          attempts,
          historicalFallbackUsed: false,
          historicalDate: dateInfo?.adSlash || null
        };
      }
      const msg = `rows too few ${rows.length}`;
      errors.push(`${label}: ${msg}`);
      record(label, false, rows.length, msg, r.meta);
    } catch (e) {
      const msg = e?.message || String(e);
      errors.push(`${label}: ${msg}`);
      record(label, false, 0, msg, e?.meta || {});
    }
  }

  // 第二層：用 TWSE 最新交易日「明確指定日期」。
  // 這層就是為盤前/週末設計，避免 TPEx「最新」網址在非交易時段被導向 /errors。
  if (dateInfo) {
    const datedSources = [
      [
        `${TPEX_OTC_1430_JSON_V2615}&d=${encodeURIComponent(dateInfo.rocSlash)}`,
        `TPEx official otc_quotes_no1430 explicit date ${dateInfo.rocSlash}`,
        "modern-json"
      ],
      [
        `${TPEX_DAILY_WEB_JSON_V262}&date=${encodeURIComponent(dateInfo.adSlash)}`,
        `TPEx modern dailyQuotes explicit date ${dateInfo.adSlash}`,
        "modern-json"
      ],
      [
        `${TPEX_DAILY_LEGACY_JSON_V261}&d=${encodeURIComponent(dateInfo.rocSlash)}`,
        `TPEx legacy JSON explicit date ${dateInfo.rocSlash}`,
        "legacy-json"
      ],
      [
        `${TPEX_DAILY_LEGACY_DATA_V261}&d=${encodeURIComponent(dateInfo.rocSlash)}`,
        `TPEx legacy CSV explicit date ${dateInfo.rocSlash}`,
        "csv"
      ],
      [
        `${TPEX_DAILY_WEB_CSV_V262}&date=${encodeURIComponent(dateInfo.adSlash)}`,
        `TPEx modern CSV explicit date ${dateInfo.adSlash}`,
        "csv"
      ]
    ];

    for (const [url, label, parser] of datedSources) {
      try {
        const r = await fetchTpexRawManualV2614(url, label);
        const rows = parseTpexRawByModeV2614(r, parser);
        if (rows.length >= TPEX_MIN_QUOTE_ROWS_V261) {
          record(label, true, rows.length, null, r.meta);
          return {
            rows,
            source: label,
            errors,
            attempts,
            historicalFallbackUsed: true,
            historicalDate: dateInfo.adSlash
          };
        }
        const msg = `rows too few ${rows.length}`;
        errors.push(`${label}: ${msg}`);
        record(label, false, rows.length, msg, r.meta);
      } catch (e) {
        const msg = e?.message || String(e);
        errors.push(`${label}: ${msg}`);
        record(label, false, 0, msg, e?.meta || {});
      }
    }
  }

  return {
    rows: [],
    source: null,
    errors,
    attempts,
    historicalFallbackUsed: false,
    historicalDate: dateInfo?.adSlash || null
  };
}

function tpexDateInfoV2614(yyyymmdd) {
  const s = String(yyyymmdd || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  if (!Number.isFinite(y) || y < 1912) return null;
  return {
    adSlash: `${y}/${m}/${d}`,
    rocSlash: `${y - 1911}/${m}/${d}`,
    yyyymmdd: s
  };
}

async function fetchTpexRawManualV2614(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALL_STOCKS_TIMEOUT_MS_V25);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Accept": "application/json,text/csv,text/plain,*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
        "Referer": "https://www.tpex.org.tw/",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });

    const location = res.headers.get("location");
    const meta = {
      httpStatus: res.status,
      redirected: res.status >= 300 && res.status < 400,
      location: location || null,
      url
    };

    if (res.status >= 300 && res.status < 400) {
      const err = new Error(`${label} redirect blocked｜HTTP ${res.status}｜location=${location || "-"}`);
      err.meta = meta;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`${label} HTTP ${res.status}`);
      err.meta = meta;
      throw err;
    }

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    const body = await res.text();
    return { body, contentType, meta };
  } finally {
    clearTimeout(timer);
  }
}

function parseTpexRawByModeV2614(raw, mode) {
  const body = String(raw?.body || "");
  if (!body.trim()) return [];

  try {
    if (mode === "csv") return parseTpexDailyCsvV262(body);

    const data = JSON.parse(body);
    if (mode === "json-array") return Array.isArray(data) ? data : [];
    if (mode === "legacy-json") return mapTpexLegacyAaDataV261(data);
    if (mode === "modern-json") return mapTpexModernDailyQuotesV262(data);
  } catch (_) {
    // 某些 TPEx 端點 content-type 可能不標準；JSON 解析失敗就退回 CSV parser。
    if (mode === "csv") return parseTpexDailyCsvV262(body);
  }
  return [];
}

async function fetchTpexJsonManualV263(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALL_STOCKS_TIMEOUT_MS_V25);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Accept": "application/json,text/plain,*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
        "Referer": "https://www.tpex.org.tw/",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });
    const location = res.headers.get("location") || null;
    const meta = { httpStatus: res.status, redirected: res.status >= 300 && res.status < 400, location };
    if (res.status >= 300 && res.status < 400) {
      const err = new Error(`${label} redirect blocked｜HTTP ${res.status}｜location=${location || "(none)"}`); err.meta = meta; throw err;
    }
    if (!res.ok) { const err = new Error(`${label} HTTP ${res.status}`); err.meta = meta; throw err; }
    const text = await res.text();
    meta.contentType = res.headers.get("content-type") || null; meta.bytes = text.length;
    if (text.trim().startsWith("<")) { const err = new Error(`${label} HTML response blocked`); err.meta = meta; throw err; }
    try { return { data: JSON.parse(text), meta }; }
    catch (e) { const err = new Error(`${label} JSON parse failed｜${e?.message || e}`); err.meta = meta; throw err; }
  } finally { clearTimeout(timer); }
}

function normalizeHeaderV262(v) {
  return String(v ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, "").trim();
}

function objectFromFieldsV262(fields, row) {
  if (!Array.isArray(fields) || !Array.isArray(row)) return null;
  const o = {};
  fields.forEach((f, i) => {
    let key = f;
    if (f && typeof f === "object") key = f.title ?? f.name ?? f.key ?? f.data ?? f.field ?? "";
    key = normalizeHeaderV262(key);
    if (key) o[key] = row[i];
  });
  return o;
}

function looksLikeTpexQuoteObjectV262(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const keys = Object.keys(o).map(normalizeHeaderV262).join("|");
  const hasCode = /SecuritiesCompanyCode|SecuritiesCode|Code|代號|證券代號/.test(keys);
  const hasClose = /Close|ClosingPrice|收盤/.test(keys);
  return hasCode && hasClose;
}

function mapTpexModernDailyQuotesV262(data) {
  const out = [];
  const seen = new Set();
  const pushObj = (o) => {
    if (!looksLikeTpexQuoteObjectV262(o)) return;
    const clean = {};
    for (const [k, v] of Object.entries(o)) clean[normalizeHeaderV262(k)] = v;
    const code = String(firstAnyV25(clean, ["SecuritiesCompanyCode","SecuritiesCode","Code","證券代號","代號"]) || "").trim();
    if (!/^\d{4}$/.test(code)) return;
    const sig = code + "|" + String(firstAnyV25(clean, ["Date","日期"]) || "");
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(clean);
  };

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.length && node.every(x => x && typeof x === "object" && !Array.isArray(x))) {
        node.forEach(pushObj);
      }
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;

    // TPEx 新站常見 tables:[{fields:[...],data:[[...]]}] 結構。
    const fields = node.fields ?? node.columns ?? node.columnNames ?? node.titles ?? node.headers;
    const rows = node.data ?? node.rows ?? node.aaData;
    if (Array.isArray(fields) && Array.isArray(rows)) {
      for (const r of rows) {
        if (Array.isArray(r)) pushObj(objectFromFieldsV262(fields, r));
        else if (r && typeof r === "object") pushObj(r);
      }
    }

    pushObj(node);
    for (const v of Object.values(node)) walk(v);
  };

  walk(data);
  return out;
}

function parseTpexDailyCsvV262(text) {
  const all = parseCsvRowsRawV262(text);
  if (!all.length) return [];

  // 找包含「代號/名稱/收盤」的真正標題列；前面有報表日期、說明文字也不影響。
  let hi = all.findIndex(r => {
    const line = r.map(normalizeHeaderV262).join("|");
    return /代號|證券代號|SecuritiesCompanyCode|Code/.test(line) &&
           /名稱|公司名稱|CompanyName|Name/.test(line) &&
           /收盤|Close|ClosingPrice/.test(line);
  });
  if (hi < 0) return [];

  const headers = all[hi].map(normalizeHeaderV262);
  return all.slice(hi + 1).map(r => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = String(r[i] ?? "").replace(/^=/, "").trim(); });
    return o;
  }).filter(looksLikeTpexQuoteObjectV262);
}

function parseCsvRowsRawV262(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  if (!src.trim()) return [];
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell.trim()); cell = ""; }
      else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
      else if (ch !== '\r') cell += ch;
    }
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(x => String(x || "").trim()));
}

async function fetchTpexCompaniesV261() {
  const errors = [];
  try {
    const rows = await fetchJsonArrayV25(TPEX_COMPANY_V25);
    if (Array.isArray(rows) && rows.length >= TPEX_MIN_COMPANY_ROWS_V261) return { rows, source: "TPEx OpenAPI mopsfin_t187ap03_O", errors };
    errors.push(`TPEx company OpenAPI rows too few: ${Array.isArray(rows) ? rows.length : 0}`);
  } catch (e) { errors.push(`TPEx company OpenAPI: ${e?.message || e}`); }

  try {
    const text = await fetchTextV261(TPEX_COMPANY_CSV_V261);
    const rows = parseCsvObjectsV261(text);
    if (rows.length >= TPEX_MIN_COMPANY_ROWS_V261) return { rows, source: "MOPS official t187ap03_O.csv", errors };
    errors.push(`MOPS company CSV rows too few: ${rows.length}`);
  } catch (e) { errors.push(`MOPS company CSV: ${e?.message || e}`); }

  throw new Error(`TPEx company data unavailable｜${errors.join("｜")}`);
}

async function fetchTextV261(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALL_STOCKS_TIMEOUT_MS_V25);
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json,text/csv,text/plain,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; ShitouAgent/2.6.1)",
        "Referer": "https://www.tpex.org.tw/"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}｜${url}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

function parseCsvObjectsV261(text) {
  const src = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!src) return [];
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell.trim()); cell = ""; }
      else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
      else if (ch !== '\r') cell += ch;
    }
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  if (!rows.length) return [];

  // 找真正標題列，兼容檔案前面可能有說明文字。
  let hi = rows.findIndex(r => r.some(x => /代號|公司代號/.test(String(x))) && r.some(x => /名稱|公司名稱/.test(String(x))));
  if (hi < 0) hi = 0;
  const headers = rows[hi].map(x => String(x || "").replace(/^=|"$/g, "").trim());
  return rows.slice(hi + 1).filter(r => r.some(x => String(x || "").trim())).map(r => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = String(r[i] ?? "").replace(/^=/, "").trim(); });
    return o;
  });
}

function mapTpexLegacyAaDataV261(data) {
  const aa = Array.isArray(data?.aaData) ? data.aaData : [];
  return aa.map(r => {
    if (!Array.isArray(r)) return null;
    return {
      "代號": r[0], "名稱": r[1], "收盤": r[2], "漲跌": r[3],
      "開盤": r[4], "最高": r[5], "最低": r[6], "均價": r[7],
      "成交股數": r[8], "成交金額": r[9], "成交筆數": r[10]
    };
  }).filter(Boolean);
}


// ============================================================
// V2.6.4｜TPEx Quote 備援：TWSE MIS OTC 批次快照
// ============================================================
function extractTpexOrdinaryCodesV264(companyRows) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(companyRows) ? companyRows : []) {
    const code = String(
      r?.["公司代號"] ?? r?.["公司代碼"] ?? r?.["SecuritiesCompanyCode"] ??
      r?.["Code"] ?? r?.["股票代號"] ?? ""
    ).trim();
    if (/^[1-9]\d{3}$/.test(code) && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

async function fetchTpexQuotesViaTwseMisV264(codes) {
  const ordinary = [...new Set((codes || []).filter(c => /^[1-9]\d{3}$/.test(String(c))))];
  const shards = [];
  for (let i = 0; i < ordinary.length; i += TPEX_MIS_SHARD_SIZE_V264) {
    shards.push(ordinary.slice(i, i + TPEX_MIS_SHARD_SIZE_V264));
  }

  const results = new Array(shards.length);
  let cursor = 0;
  async function loop() {
    while (true) {
      const idx = cursor++;
      if (idx >= shards.length) break;
      results[idx] = await fetchOneTpexMisShardV264(shards[idx], idx + 1);
    }
  }
  await Promise.all(Array.from({ length: Math.min(TPEX_MIS_CONCURRENCY_V264, shards.length || 1) }, loop));

  const rows = [];
  const errors = [];
  const attempts = [];
  for (const r of results.filter(Boolean)) {
    attempts.push(r.attempt);
    if (r.ok) rows.push(...r.rows);
    else errors.push(r.error);
  }

  // 代碼去重，避免 MIS 偶發重複。
  const byCode = new Map();
  for (const r of rows) {
    const code = String(r?.SecuritiesCompanyCode || "").trim();
    if (code) byCode.set(code, r);
  }
  return {
    rows: [...byCode.values()],
    source: "TWSE MIS official OTC batch snapshot",
    errors,
    attempts,
    requestedCodes: ordinary.length
  };
}

async function fetchOneTpexMisShardV264(codes, shardNo) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TPEX_MIS_TIMEOUT_MS_V264);
  const exCh = codes.map(c => `otc_${c}.tw`).join("|");
  const u = new URL(TWSE_MIS_STOCKINFO_V264);
  u.searchParams.set("ex_ch", exCh);
  u.searchParams.set("json", "1");
  u.searchParams.set("delay", "0");
  u.searchParams.set("_", String(Date.now() + shardNo));

  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://mis.twse.com.tw/stock/index.jsp"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let obj;
    try { obj = JSON.parse(body); }
    catch { throw new Error(`JSON parse failed｜${body.slice(0, 120)}`); }

    const msgArray = Array.isArray(obj?.msgArray) ? obj.msgArray : [];
    const rows = msgArray.map(normalizeTwseMisOtcRowV264).filter(Boolean);
    return {
      ok: rows.length > 0,
      rows,
      error: rows.length ? null : `TWSE MIS shard ${shardNo} returned 0 usable rows`,
      attempt: {
        label: `TWSE MIS OTC shard ${shardNo}`,
        ok: rows.length > 0,
        requested: codes.length,
        msgArrayRows: msgArray.length,
        usableRows: rows.length,
        rows: rows.length,
        httpStatus: res.status
      }
    };
  } catch (e) {
    const error = `TWSE MIS OTC shard ${shardNo}｜${e?.name === "AbortError" ? "timeout" : (e?.message || String(e))}`;
    return {
      ok: false, rows: [], error,
      attempt: { label: `TWSE MIS OTC shard ${shardNo}`, ok: false, requested: codes.length, rows: 0, error }
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTwseMisOtcRowV264(r) {
  if (!r || typeof r !== "object") return null;
  const code = String(r.c || r.code || "").trim();
  if (!/^[1-9]\d{3}$/.test(code)) return null;

  const num = (v) => {
    const s = String(v ?? "").replace(/,/g, "").trim();
    if (!s || s === "-" || s === "--") return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const prev = num(r.y);
  let close = num(r.z);
  const open = num(r.o);
  const high = num(r.h);
  const low = num(r.l);

  // 收盤後部分商品 z 可能為 "-"；若有完整 OHLC，使用最後可驗證價格：
  // 優先 z，否則 prev 不可冒充今日 close，因此直接棄列。
  if (!Number.isFinite(close) || close <= 0) return null;
  if (![open, high, low].every(n => Number.isFinite(n) && n > 0)) return null;

  const lots = num(r.v);
  const volume = Number.isFinite(lots) && lots >= 0 ? Math.round(lots * 1000) : 0;
  const change = Number.isFinite(prev) && prev > 0 ? close - prev : NaN;

  return {
    Date: String(r.d || "").trim(),
    SecuritiesCompanyCode: code,
    CompanyName: String(r.n || r.nf || "").trim(),
    Close: close,
    Change: Number.isFinite(change) ? change : "",
    Open: open,
    High: high,
    Low: low,
    TradingShares: volume,
    TransactionAmount: "",
    TransactionNumber: ""
  };
}

// ============================================================
// V2.6｜第二階段深度分析代理
// 前端每次最多送 20 檔；Safari 只需呼叫 Market Worker，
// Market Worker 再以 server-to-server 方式呼叫既有個股分析 Worker。
// ============================================================

function explainCloudflare1042V267(text = "") {
  const s = String(text || "");
  if (/error code:\s*1042/i.test(s) || /\b1042\b/.test(s)) {
    return "SERVICE_BINDING_ROUTE_ERROR｜Cloudflare 1042：目前 DeepScan 應走 FIB_API Service Binding，請檢查 Binding 是否已部署";
  }
  return null;
}

// ============================================================
// SHITOU-DAILY-BRIDGE-1 | 2026-10-13 | DAILY_ONLY 官方補K安全層
// 1. 市場行情以同交易日的完整 GitHub 快照為唯一補K來源。
// 2. 必須核對市場/股票代號/交易日/OHLC/成交量；不修改選股策略或歷史日K。
// 3. 僅在 Yahoo/MIS 最後日K落後快照時追加；資料不足/不符則一律不補。
// 4. 不信任使用者提供的任意 query/header OHLCV，杜絕外部偽造行情。
// ============================================================
let verifiedDailyBridgeCacheV1 = { until: 0, promise: null };

function officialBridgeISODateV1(compactDate) {
  const d = normalizeMarketDateV2613(compactDate);
  if (!d || !/^20\d{6}$/.test(d)) return null;
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

async function loadVerifiedDailyBridgeSnapshotV1(env) {
  // 45 秒記憶體暫存僅為減少批次間重抓；仍需經過嚴格快照驗證。
  if (verifiedDailyBridgeCacheV1.promise && Date.now() < verifiedDailyBridgeCacheV1.until) {
    return verifiedDailyBridgeCacheV1.promise;
  }
  const task = (async () => {
    const loaded = await fetchMarketSnapshotR13R4(env);
    const snap = loaded.snapshot;
    const day = officialBridgeISODateV1(snap?.tradeDate);
    const rows = Array.isArray(snap?.rows) ? snap.rows : [];
    const fail = status => ({ ready: false, status, tradeDate: day, rows: new Map() });
    if (!loaded.ok || snap?.marketCoverageReady !== true || Number(snap?.schemaVersion) < 1 || !day) {
      return fail('INVALID_SNAPSHOT');
    }
    if (snap.tradeDateIso && officialBridgeISODateV1(snap.tradeDateIso) !== day) {
      return fail('SNAPSHOT_DATE_MISMATCH');
    }
    const quoteByCode = new Map();
    let listed = 0, otc = 0;
    for (const r of rows) {
      const code = String(r?.code || '').trim();
      const market = String(r?.market || '').trim().toUpperCase();
      if (!/^[1-9]\d{3}$/.test(code) || !['TWSE', 'TPEX'].includes(market)) continue;
      if (officialBridgeISODateV1(r.quoteDate) !== day) return fail('ROW_DATE_MISMATCH');
      if (!hasValidOhlcV251(r)) return fail('ROW_OHLC_INVALID');
      const volume = Number(r.volume);
      if (!Number.isFinite(volume) || volume < 0) return fail('ROW_VOLUME_INVALID');
      if (quoteByCode.has(code)) return fail('DUPLICATE_STOCK_CODE');
      quoteByCode.set(code, {
        code, market, date: day,
        open: Number(r.open), high: Number(r.high), low: Number(r.low),
        close: Number(r.close), volume: Math.round(volume)
      });
      if (market === 'TWSE') listed++; else otc++;
    }
    if (listed < MARKET_SNAPSHOT_MIN_TWSE_ROWS_R13R4 || otc < MARKET_SNAPSHOT_MIN_TPEX_ROWS_R13R4) {
      return fail('SNAPSHOT_MARKETS_INCOMPLETE');
    }
    // 與現行 ALL_STOCKS 一致：來源聲明的市場日期必須一致。
    for (const key of ['twseQuotes', 'tpexQuotes']) {
      const declared = snap?.sourceMeta?.[key]?.finalDate;
      if (declared && officialBridgeISODateV1(declared) !== day) return fail('SOURCE_DATE_MISMATCH');
    }
    return { ready: true, status: 'VERIFIED', tradeDate: day, rows: quoteByCode, marketCalendar: snap.marketCalendar || null };
  })().catch(e => ({ready:false,status:`FETCH_FAILED:${String(e?.message || e).slice(0,100)}`, tradeDate:null,rows:new Map()}));
  verifiedDailyBridgeCacheV1 = { until: Date.now() + 45000, promise: task };
  return task;
}

function isOnlyMissingOneMarketTradingDayV1(lastDailyDate, officialDate, calendar) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(lastDailyDate) || !/^20\d{2}-\d{2}-\d{2}$/.test(officialDate)) return false;
  const start = Date.parse(lastDailyDate + 'T00:00:00Z');
  const end = Date.parse(officialDate + 'T00:00:00Z');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 15 * 86400000) return false;
  let tradingSessions = 0;
  for (let at = start + 86400000; at <= end; at += 86400000) {
    const d = new Date(at);
    const day = d.getUTCDay();
    if (day < 1 || day > 5) continue;
    const compact = d.toISOString().slice(0, 10).replace(/-/g, '');
    if (marketCalendarClosureR48(calendar, compact)) continue;
    tradingSessions++;
    if (tradingSessions > 1) return false;
  }
  return tradingSessions === 1;
}

// SHITOU-DAILY-BRIDGE-2 | ONLY DAILY_ONLY: check up to 60 recent market sessions.
// Use verified exchange historical OHLCV for interior gaps; never interpolate prices.
// Failure is explicit and excludes a stock from a verified ranking.
const DAILY_BRIDGE_V2_CHECK_SESSIONS = 60;
const DAILY_BRIDGE_V2_MAX_GAPS = 4; // bounded official requests; never silently pass larger gaps
const DAILY_BRIDGE_V2_TIMEOUT_MS = 10000;

function dailyBridgeNumericV2(value) {
  const s = String(value ?? '').replace(/,/g, '').replace(/[＋+]/g, '').replace(/[－−]/g, '-').trim();
  if (!s || s === '--' || s === '---' || s === 'N/A') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function dailyBridgeDateV2(value) {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{2,4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!m) return null;
  let y = Number(m[1]);
  if (m[1].length <= 3) y += 1911;
  const iso = `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  return officialBridgeISODateV1(iso) || null;
}
function dailyBridgeRowV2(raw, market) {
  if (!Array.isArray(raw) || raw.length < 7) return null;
  const date = dailyBridgeDateV2(raw[0]);
  const open = dailyBridgeNumericV2(raw[3]);
  const high = dailyBridgeNumericV2(raw[4]);
  const low = dailyBridgeNumericV2(raw[5]);
  const close = dailyBridgeNumericV2(raw[6]);
  const qty = dailyBridgeNumericV2(raw[1]);
  const volume = qty === null ? null : (market === 'TPEX' ? Math.round(qty * 1000) : Math.round(qty));
  if (!date || ![open,high,low,close,volume].every(Number.isFinite) ||
    !(open > 0 && high > 0 && low > 0 && close > 0 && high >= low &&
      high >= open && high >= close && low <= open && low <= close && volume >= 0)) return null;
  return {date,open,high,low,close,volume};
}

function dailyBridgeMissingSessionsV2(series, lastOfficialDate, calendar) {
  const first = series[0]?.date;
  const result = [];
  const present = new Set(series.map(r=>r.date));
  // 60 market sessions back from the verified latest market close, not calendar days.
  let sessions = 0;
  let stamp = Date.parse(`${lastOfficialDate}T00:00:00Z`);
  let loops = 0;
  while (Number.isFinite(stamp) && sessions < DAILY_BRIDGE_V2_CHECK_SESSIONS && loops++ < 160) {
    const d = new Date(stamp);
    const date = d.toISOString().slice(0,10);
    if (date < first) break; // do not invent pre-IPO / pre-history bars
    const weekday = d.getUTCDay();
    if (weekday >= 1 && weekday <= 5 && !marketCalendarClosureR48(calendar,date.replace(/-/g,''))) {
      sessions++;
      if (!present.has(date)) result.push(date);
    }
    stamp -= 86400000;
  }
  return result.sort();
}

// SHITOU-DAILY-BRIDGE-2.1 | Only TPEx official history request fallback for HTTP 302/blocked routes.
// Keep TWSE original route and all DAILY_ONLY data validation, scoring, other profiles unchanged.
async function fetchOfficialHistoryForDailyBridgeV2(code, market, monthKey, signal) {
  const isTwse = market === 'TWSE';
  const primary = isTwse
    ? new URL('https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY')
    : new URL('https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock');
  if (isTwse) {
    primary.searchParams.set('date', monthKey+'01');
    primary.searchParams.set('stockNo', code);
  } else {
    primary.searchParams.set('date', `${monthKey.slice(0,4)}/${monthKey.slice(4,6)}/01`);
    primary.searchParams.set('code', code);
  }
  primary.searchParams.set('response', 'json');
  const candidates = [{url: primary, name: isTwse ? 'TWSE_STOCK_DAY' : 'TPEX_TRADING_STOCK'}];
  if (!isTwse) {
    // Legacy TPEx monthly per-stock OHLCV endpoint. d uses ROC year/month.
    // A 302 from the modern route is never interpreted as a successful response.
    const legacy = new URL('https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php');
    legacy.searchParams.set('d', `${Number(monthKey.slice(0,4))-1911}/${monthKey.slice(4,6)}`);
    legacy.searchParams.set('stkno', code);
    candidates.push({url: legacy, name: 'TPEX_ST43_LEGACY'});
  }
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), DAILY_BRIDGE_V2_TIMEOUT_MS);
  const onAbort = ()=>controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener?.('abort', onAbort, {once:true});
  const errors=[];
  try {
    for (const candidate of candidates) {
      if (controller.signal.aborted) break;
      try {
        const res = await fetch(candidate.url.toString(), {
          headers:{Accept:'application/json,text/plain,*/*', ...(isTwse ? {} : {Referer:'https://www.tpex.org.tw/zh-tw/mainboard/trading/info/pricing.html'})},
          signal: controller.signal,
          cf:{cacheTtl:0},
          redirect:'manual'
        });
        if (!res.ok || (res.status>=300 && res.status<400)) {
          errors.push(`${candidate.name}:OFFICIAL_HTTP_${res.status}`);
          continue;
        }
        const body = await res.text();
        if (body.trim().startsWith('<')) {
          errors.push(`${candidate.name}:OFFICIAL_HTML_OR_GATEWAY_BLOCK`);
          continue;
        }
        let payload;
        try { payload = JSON.parse(body); }
        catch { errors.push(`${candidate.name}:OFFICIAL_JSON_INVALID`); continue; }
        const rawRows = isTwse ? payload?.data
          : (payload?.tables?.[0]?.data || payload?.aaData || payload?.data);
        if (!Array.isArray(rawRows) || rawRows.length===0) {
          errors.push(`${candidate.name}:OFFICIAL_MONTH_EMPTY`);
          continue;
        }
        const all = rawRows.map(r=>dailyBridgeRowV2(r,market)).filter(Boolean);
        if (!all.length) {
          errors.push(`${candidate.name}:OFFICIAL_ROWS_INVALID`);
          continue;
        }
        if (all.some(r=>r.date.replace(/-/g,'').slice(0,6)!==monthKey)) {
          errors.push(`${candidate.name}:OFFICIAL_MONTH_MISMATCH`);
          continue;
        }
        if (new Set(all.map(r=>r.date)).size !== all.length) {
          errors.push(`${candidate.name}:OFFICIAL_DUPLICATE_DATE`);
          continue;
        }
        return {ok:true,status:'OFFICIAL_MONTH_VERIFIED',rows:all,source:candidate.name};
      } catch(e) {
        errors.push(`${candidate.name}:${e?.name==='AbortError'?'OFFICIAL_TIMEOUT':`OFFICIAL_REQUEST_FAILED:${String(e?.message||e).slice(0,60)}`}`);
        if (controller.signal.aborted) break;
      }
    }
    if (controller.signal.aborted) errors.push('OFFICIAL_TIMEOUT_OR_CANCELLED');
    return {ok:false,status:errors.join('|')||'OFFICIAL_REQUEST_FAILED',rows:[]};
  } finally { clearTimeout(timer); signal?.removeEventListener?.('abort',onAbort); }
}
// SHITOU-DAILY-BRIDGE-2.2 | ONLY TPEx DAILY_ONLY archived-snapshot fallback.
// The existing GitHub Actions writes verified TWSE+TPEx per-session snapshots under
// data/market/archive/YYYY-MM-DD.json. Use this SAME configured source only if
// both direct official TPEx historical endpoints fail. No price interpolation.
const DAILY_BRIDGE_ARCHIVE_V22_TTL_MS = 120000;
const DAILY_BRIDGE_ARCHIVE_V22_FAIL_TTL_MS = 15000;
const DAILY_BRIDGE_ARCHIVE_V22_TIMEOUT_MS = 12000;
const DAILY_BRIDGE_ARCHIVE_V22_MAX_BYTES = 6000000;
const dailyBridgeArchiveV22Cache = new Map();
function dailyBridgeArchiveUrlV22(env,date) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || officialBridgeISODateV1(date)!==date) return null;
  let url;
  try {url = new URL(marketSnapshotUrlR13R4(env));} catch (_) {return null;}
  // Do not allow query-controlled URLs or arbitrary domains; only the existing
  // configured HTTPS GitHub Raw latest.json data source can supply archived rows.
  if (url.protocol!=='https:' || url.hostname!=='raw.githubusercontent.com' ||
      !url.pathname.endsWith('/data/market/latest.json')) return null;
  url.pathname=url.pathname.slice(0,-'latest.json'.length)+`archive/${date}.json`;
  url.search='';url.hash='';
  return url.toString();
}
async function loadOfficialDailyArchiveV22(date,env,signal) {
  const url=dailyBridgeArchiveUrlV22(env,date);
  if (!url) return {ok:false,status:'ARCHIVE_URL_NOT_CONFIGURED'};
  const now=Date.now(),cached=dailyBridgeArchiveV22Cache.get(url);
  if(cached && cached.until>now) return cached.promise;
  // Avoid retaining unbounded archive dates in long-lived isolates.
  for(const [key,v] of dailyBridgeArchiveV22Cache) if(v.until<=now)dailyBridgeArchiveV22Cache.delete(key);
  if(dailyBridgeArchiveV22Cache.size>16)dailyBridgeArchiveV22Cache.clear();
  const task=(async()=>{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),DAILY_BRIDGE_ARCHIVE_V22_TIMEOUT_MS);
    const onAbort=()=>ctl.abort();
    if(signal?.aborted)ctl.abort();
    else signal?.addEventListener?.('abort',onAbort,{once:true});
    try {
      const res=await fetch(url,{method:'GET',signal:ctl.signal,redirect:'manual',headers:{Accept:'application/json'},cf:{cacheTtl:60,cacheEverything:true}});
      if(!res.ok || res.status>=300) return {ok:false,status:`ARCHIVE_HTTP_${res.status}`};
      const contentType=String(res.headers.get('content-type')||'');
      if(contentType && !/json|octet-stream|text\/plain/i.test(contentType))return {ok:false,status:'ARCHIVE_NON_JSON_CONTENT_TYPE'};
      const len=Number(res.headers.get('content-length')||0);
      if(len>DAILY_BRIDGE_ARCHIVE_V22_MAX_BYTES)return {ok:false,status:'ARCHIVE_TOO_LARGE'};
      const raw=await res.text();
      if(raw.length>DAILY_BRIDGE_ARCHIVE_V22_MAX_BYTES || raw.trim().startsWith('<')) return {ok:false,status:'ARCHIVE_HTML_OR_TOO_LARGE'};
      let doc;try{doc=JSON.parse(raw);}catch(_){return {ok:false,status:'ARCHIVE_INVALID_JSON'};}
      if(Number(doc?.schemaVersion)<1 || doc?.marketCoverageReady!==true ||
         officialBridgeISODateV1(doc?.tradeDate)!==date ||
         (doc?.tradeDateIso && officialBridgeISODateV1(doc.tradeDateIso)!==date)) return {ok:false,status:'ARCHIVE_INVALID_TRADE_DAY_OR_COVERAGE'};
      for(const key of ['twseQuotes','tpexQuotes']) {
        const meta=doc?.sourceMeta?.[key]?.finalDate;
        if(!meta || officialBridgeISODateV1(meta)!==date)return {ok:false,status:'ARCHIVE_SOURCE_DATE_MISMATCH'};
      }
      const rows=doc?.rows;
      if(!Array.isArray(rows))return {ok:false,status:'ARCHIVE_NO_ROWS'};
      const byCode=new Map();let twse=0,tpex=0;
      for(const rawRow of rows){
        const code=String(rawRow?.code||'').trim(), market=String(rawRow?.market||'').toUpperCase();
        if(!/^[1-9]\d{3}$/.test(code)||!['TWSE','TPEX'].includes(market))continue;
        if(byCode.has(code))return {ok:false,status:'ARCHIVE_DUPLICATE_CODE'};
        if(officialBridgeISODateV1(rawRow.quoteDate)!==date || !hasValidOhlcV251(rawRow)) return {ok:false,status:'ARCHIVE_BAD_ROW_DATE_OR_OHLC'};
        const vol=Number(rawRow.volume);
        if(!Number.isSafeInteger(vol) || vol<0)return {ok:false,status:'ARCHIVE_BAD_VOLUME'};
        byCode.set(code,{date,code,market,open:Number(rawRow.open),high:Number(rawRow.high),low:Number(rawRow.low),close:Number(rawRow.close),volume:vol});
        if(market==='TWSE')twse++;else tpex++;
      }
      if(twse<MARKET_SNAPSHOT_MIN_TWSE_ROWS_R13R4 || tpex<MARKET_SNAPSHOT_MIN_TPEX_ROWS_R13R4) return {ok:false,status:'ARCHIVE_MARKET_INCOMPLETE'};
      return {ok:true,rows:byCode,status:'VERIFIED_ARCHIVED_DAILY_SNAPSHOT'};
    }catch(e){return {ok:false,status:e?.name==='AbortError'?'ARCHIVE_TIMEOUT':`ARCHIVE_FETCH_FAILED:${String(e?.message||e).slice(0,80)}`};}
    finally{clearTimeout(timer);signal?.removeEventListener?.('abort',onAbort);}
  })();
  dailyBridgeArchiveV22Cache.set(url,{promise:task,until:now+DAILY_BRIDGE_ARCHIVE_V22_TTL_MS});
  task.then(result=>{const hit=dailyBridgeArchiveV22Cache.get(url);if(hit?.promise===task&&!result.ok)hit.until=Date.now()+DAILY_BRIDGE_ARCHIVE_V22_FAIL_TTL_MS;});
  return task;
}
async function recoverTpexMonthlyGapsFromArchivedSnapshotsV22(code,month,dates,env,signal){
  const recovered=[];
  for(const date of dates){
    if(date.slice(0,7).replace('-','')!==month)return {ok:false,status:'ARCHIVE_MONTH_MISMATCH'};
    const snapshot=await loadOfficialDailyArchiveV22(date,env,signal);
    if(!snapshot.ok)return {ok:false,status:`${date}:${snapshot.status}`};
    const row=snapshot.rows.get(code);
    if(!row || row.market!=='TPEX' || row.date!==date)return {ok:false,status:`${date}:ARCHIVE_STOCK_MISSING_OR_MARKET_MISMATCH`};
    recovered.push({date,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume});
  }
  return {ok:true,rows:recovered,source:'GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE'};
}
async function applyVerifiedDailyBridgeImplementationR9(data, code, marketHint, bridge, signal, env) {
  const unchanged = (status, ok = true, additional = {}) => ({data,status,ok,...additional});
  if (!bridge?.ready) return unchanged(bridge?.status || 'NO_VERIFIED_SNAPSHOT',false);
  if (!data || String(data.stock||'')!==code || data.scanMode!=='DAILY_ONLY') return unchanged('UPSTREAM_CONTRACT_MISMATCH',false);
  const quote = bridge.rows.get(code);
  if (!quote) return unchanged('STOCK_NOT_IN_VERIFIED_SNAPSHOT',false);
  if (marketHint && quote.market !== String(marketHint).toUpperCase()) return unchanged('MARKET_HINT_MISMATCH',false);
  if (data.market && String(data.market).toUpperCase() !== quote.market) return unchanged('UPSTREAM_MARKET_MISMATCH',false);
  const series = Array.isArray(data.dailySeries)?data.dailySeries:[];
  if (series.length < 55) return unchanged('HISTORY_TOO_SHORT',false);
  let previousDate='';
  for(const row of series) {
    if (!row || officialBridgeISODateV1(row.date)!==row.date || (previousDate && row.date<=previousDate) ||
      ![row.open,row.high,row.low,row.close,row.volume].every(v=>Number.isFinite(Number(v))) ||
      !(Number(row.open)>0 && Number(row.high)>=Number(row.low) && Number(row.low)>0 && Number(row.close)>0 &&
        Number(row.high)>=Number(row.open) && Number(row.high)>=Number(row.close) &&
        Number(row.low)<=Number(row.open) && Number(row.low)<=Number(row.close) && Number(row.volume)>=0)) return unchanged('HISTORY_INVALID',false);
    previousDate=row.date;
  }
  const latest=series.at(-1).date;
  if (latest>quote.date) {
    // Only strip a verified non-session placeholder; never discard a newer real trading session.
    const after=series.filter(row=>row.date>quote.date);
    const placeholder=row=>{
      const d=new Date(row.date+'T00:00:00Z'),w=d.getUTCDay();
      return (w===0||w===6||marketCalendarClosureR48(bridge.marketCalendar,row.date.replace(/-/g,''))) &&
        Number(row.volume)===0 && Number(row.open)===Number(row.high) && Number(row.high)===Number(row.low) && Number(row.low)===Number(row.close);
    };
    if (!after.every(placeholder)) return unchanged('HISTORY_AHEAD_OF_OFFICIAL_SNAPSHOT',false);
    const retained=series.filter(row=>row.date<=quote.date),last=retained.at(-1);
    if(retained.length<55||last?.date!==quote.date)return unchanged('CLOSED_BAR_ANCHOR_MISSING',false);
    if(!['open','high','low','close'].every(k=>Math.abs(Number(last[k])-Number(quote[k]))<=Math.max(.02,Number(quote[k])*.0001)))return unchanged('CLOSED_BAR_OFFICIAL_OHLC_MISMATCH',false);
    const clean={...data,closeDate:quote.date,close:Number(last.close),dailySeries:retained,dailySeriesMeta:{...data.dailySeriesMeta,lastDate:quote.date,firstDate:retained[0].date,returnedBars:retained.length,closedSessionCleanup:{revision:'CLOSED-BAR.1',removedDates:after.map(row=>row.date),basis:'VERIFIED_EXCHANGE_CLOSURE_AND_ZERO_VOLUME_FLAT_PLACEHOLDER'}}};
    const checked=await applyVerifiedDailyBridgeImplementationR9(clean,code,marketHint,bridge,signal,env);
    return checked.ok?{...checked,status:'CLOSED_SESSION_PLACEHOLDER_REMOVED|'+checked.status}:checked;
  }
  if (data.closeDate && data.closeDate!==latest) return unchanged('UPSTREAM_CLOSE_DATE_MISMATCH',false);
  const missing = dailyBridgeMissingSessionsV2(series,quote.date,bridge.marketCalendar);
  if (!missing.length) return unchanged('ALREADY_CURRENT_OR_AHEAD');
  if (missing.length>DAILY_BRIDGE_V2_MAX_GAPS) return unchanged(`HISTORY_GAP_TOO_MANY:${missing.length}`,false,{missingDates:missing.slice(0,12)});

  const additions=[];
  const sources=[];
  const historic=missing.filter(d=>d!==quote.date);
  const months=[...new Set(historic.map(d=>d.slice(0,7).replace('-','')))];
  // 3 distinct months max is deliberately bounded and protects the free Workers quota.
  if (months.length>3) return unchanged('HISTORY_GAP_TOO_MANY_MONTHS',false,{missingDates:missing});
  const byDate=new Map();
  const sourceByMonth=new Map();
  for(const month of months) {
    let fetched=await fetchOfficialHistoryForDailyBridgeV2(code,quote.market,month,signal);
    // TPEx official origin can return HTTP 302 from BOTH historical endpoints
    // when called by Cloudflare. Fall back only to per-day archives written by
    // the SAME configured GitHub Actions official-source snapshot pipeline.
    if (!fetched.ok && quote.market==='TPEX') {
      const dates=historic.filter(d=>d.slice(0,7).replace('-','')===month);
      const archived=await recoverTpexMonthlyGapsFromArchivedSnapshotsV22(code,month,dates,env,signal);
      if(archived.ok) fetched=archived;
      else return unchanged(`HISTORY_GAP_SOURCE_UNAVAILABLE:${fetched.status}|GITHUB_ARCHIVE:${archived.status}`,false,{missingDates:missing});
    }
    if (!fetched.ok) return unchanged(`HISTORY_GAP_SOURCE_UNAVAILABLE:${fetched.status}`,false,{missingDates:missing});
    sourceByMonth.set(month, fetched.source || 'TWSE_TPEX_OFFICIAL_MONTH_HISTORY');
    for(const row of fetched.rows) byDate.set(row.date,row);
  }
  for(const date of missing) {
    const row=date===quote.date?quote:byDate.get(date);
    if (!row) return unchanged(`HISTORY_GAP_NOT_VERIFIED:${date}`,false,{missingDates:missing});
    additions.push({date:row.date,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume});
    sources.push({date,source:date===quote.date?'VERIFIED_LATEST_SNAPSHOT':(sourceByMonth.get(date.slice(0,7).replace('-','')) || 'TWSE_TPEX_OFFICIAL_MONTH_HISTORY')});
  }
  const merged=[...series,...additions].sort((a,b)=>a.date.localeCompare(b.date));
  if(new Set(merged.map(r=>r.date)).size!==merged.length) return unchanged('HISTORY_GAP_DUPLICATE_AFTER_MERGE',false);
  const newest=merged.at(-1);
  if(!newest || newest.date!==quote.date) return unchanged('HISTORY_GAP_FINAL_DATE_MISMATCH',false);
  // The official latest snapshot is the only source of the current final close.
  if (Math.abs(newest.close-quote.close)>1e-8) return unchanged('HISTORY_GAP_LATEST_CLOSE_MISMATCH',false);
  const finalSeries=merged.slice(-160);
  const meta=data.dailySeriesMeta||{};
  const updatedMeta={...meta,firstDate:finalSeries[0].date,lastDate:quote.date,returnedBars:finalSeries.length,
    completedDailyRowsAvailable:Math.max(Number(meta.completedDailyRowsAvailable)||0,finalSeries.length),
    completeOhlcvRowsAvailable:Math.max(Number(meta.completeOhlcvRowsAvailable)||0,finalSeries.length),
    source:`${meta.source||'Yahoo/MIS'} + verified official historical gap recovery`,
    verifiedOfficialHistoryRepair:{applied:true,originalLastDate:latest,officialTradeDate:quote.date,stock:code,market:quote.market,inserted:sources}};
  return {ok:true,status:`HISTORY_GAP_REPAIRED:${missing.join(',')}`,
    data:{...data,closeDate:quote.date,close:quote.close,dailySeries:finalSeries,dailySeriesMeta:updatedMeta}};
}


// CONTRACT.1: validate, clean and seal once, after every bridge operation.
async function applyVerifiedDailyBridgeV2(data,code,marketHint,bridge,signal,env){
 const C=globalThis.ShitouWorkerDataContractV1,original=data;
 if(data?.dataContract&&!C.verify(data).ok)return {data,status:'UPSTREAM_DATA_CONTRACT_INVALID',ok:false};
 if(!bridge?.ready||!Array.isArray(data?.dailySeries))return applyVerifiedDailyBridgeImplementationR9(data,code,marketHint,bridge,signal,env);
 const kept=[],seen=new Map(),removed=[];
 for(const row of data.dailySeries){
  const date=officialBridgeISODateV1(row?.date);if(!date)return {data,status:'HISTORY_INVALID',ok:false};
  const w=new Date(date+'T00:00:00Z').getUTCDay();
  const closed=w===0||w===6||marketCalendarClosureR48(bridge.marketCalendar,date.replace(/-/g,''));
  if(closed&&Number(row.volume)===0&&['open','high','low'].every(k=>Number(row[k])===Number(row.close))){removed.push(date);continue;}
  if(closed)return {data,status:'NON_SESSION_REAL_BAR_CONFLICT',ok:false};
  if(seen.has(date)){if(C.fingerprint([row])!==C.fingerprint([seen.get(date)]))return {data,status:'HISTORY_CONFLICT_DUPLICATE_DATE',ok:false};continue;}
  seen.set(date,row);kept.push(row);
 }
 data=C.refresh(data,kept,removed.length?{closedSessionCleanup:{revision:'CONTRACT.1',removedDates:removed,basis:'VERIFIED_EXCHANGE_CLOSURE_AND_ZERO_VOLUME_FLAT_PLACEHOLDER'}}:{});
 if(removed.length){data.closeDate=kept.at(-1)?.date;data.close=kept.at(-1)?.close;}
 const result=await applyVerifiedDailyBridgeImplementationR9(data,code,marketHint,bridge,signal,env);
 if(!result.ok)return result;
 const quote=bridge.rows.get(code),out=result.data,last=out.dailySeries.at(-1);
 if(!quote||last?.date!==quote.date||!['open','high','low','close'].every(k=>Math.abs(Number(last[k])-Number(quote[k]))<=Math.max(.02,Number(quote[k])*.0001)))return {data:original,status:'SNAPSHOT_CONFLICT_OHLC',ok:false};
 if(!(last.volume>0&&quote.volume>0)||Math.abs(last.volume-quote.volume)/quote.volume>.2)return {data:original,status:'SNAPSHOT_CONFLICT_VOLUME',ok:false};
 const evidence=(out.dailySeriesMeta?.verifiedOfficialHistoryRepair?.inserted||[]).filter(e=>out.dailySeries.some(b=>b.date===e.date)).map(e=>{
  const adapter=e.source==='VERIFIED_LATEST_SNAPSHOT'||e.source==='GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE'?e.source:quote.market==='TWSE'?'TWSE_STOCK_DAY':'TPEX_DAILY_HISTORY';
  return {date:e.date,stock:code,market:quote.market,source:e.source,adapter,volumeUnit:'shares',rowFingerprint:C.fingerprint([out.dailySeries.find(b=>b.date===e.date)])};
 });
 // Legacy upstream versions may be bridged, but only an exact known serializer source
 // plus independent OHLCV checks can supply its missing unit evidence.
 let units=original.dataContract?.volumeUnitSource||original.dailySeriesMeta?.volumeUnitSource;
 if(!units?.length&&/^Yahoo Finance history(?: \+ (?:TWSE|TPEx|TPEX) MIS latest completed daily)? \(R4\.9\.3 DAILY_ONLY\)$/.test(original.dailySeriesMeta?.source||''))units=C.unitEvidence(['YAHOO_CHART',...(original.dailySeriesMeta.source.includes('MIS')?['TWSE_MIS']:[])]);
 if(!units?.length)return {data:original,status:'VOLUME_UNIT_EVIDENCE_MISSING',ok:false};
 return {...result,data:C.seal(out,{originalRows:original.originalDailySeries||original.dailySeries,evidence:[...units,...C.unitEvidence(evidence.map(e=>e.adapter))],officialRecoveryEvidence:evidence,snapshotVerified:true,predecessor:evidence.length?C.fingerprint(original.dailySeries):null})};
}

async function handleDeepScanProxyV265(request, corsHeaders, debugMode = false, env) {
  const url = new URL(request.url);
  const rawCodes = String(url.searchParams.get("codes") || "");
  const rawCodeList = rawCodes.split(",").map(x => x.trim());
  const rawMarketList = String(url.searchParams.get("markets") || "").split(",").map(x => x.trim().toUpperCase());
  const seenCodes = new Set();
  const codeEntries = [];
  for (let i = 0; i < rawCodeList.length && codeEntries.length < DEEP_SCAN_MAX_CODES_V26; i++) {
    const code = rawCodeList[i];
    if (!/^[1-9]\d{3}$/.test(code) || seenCodes.has(code)) continue;
    seenCodes.add(code);
    const rawMarket = rawMarketList[i] || "";
    const marketHint = rawMarket === "TPEX" ? "TPEx" : (rawMarket === "TWSE" ? "TWSE" : null);
    codeEntries.push({ code, marketHint });
  }
  const codes = codeEntries.map(x => x.code);
  const marketHints = new Map(codeEntries.map(x => [x.code, x.marketHint]));
  // R4.9：DAILY_ONLY 供強勢飆股全市場批次；CORE/FULL 維持既有主升/當沖/個股相容。
  const requestedProfile = String(url.searchParams.get("profile") || "FULL").trim().toUpperCase();
  const scanProfile = requestedProfile === "DAILY_ONLY" ? "DAILY_ONLY" : (requestedProfile === "MOMENTUM_LITE" ? "MOMENTUM_LITE" : (requestedProfile === "CORE" ? "CORE" : "FULL"));

  if (!codes.length) {
    return jsonResponseV25({
      version: VERSION,
      type: "MOMENTUM_DEEP_SCAN",
      error: "請提供 codes，例如 ?market=DEEP_SCAN&codes=2330,2454"
    }, 400, corsHeaders, 0);
  }

  const startedAt = Date.now();

  // SHITOU-DAILY-BRIDGE-1: DAILY_ONLY 以 GitHub 官方同日完整快照補 Yahoo/MIS 的最後一根缺漏日K。
  // 無法驗證快照時完全不補K，仍由前端健康檢查停止掃描。
  const dailyBridge = scanProfile === "DAILY_ONLY"
    ? await loadVerifiedDailyBridgeSnapshotV1(env)
    : null;

  // 先做一次相容層健檢。若連基準股票都無法取得，就不浪費 20 檔 downstream subrequests。
  const health = await ensureDeepScanCompatV265(false, env);
  if (!health.ok) {
    const results = codes.map(code => ({
      code,
      ok: false,
      error: `DEEP_COMPAT_FAIL｜個股Worker相容層未通過｜${health.summary}`,
      diagnostic: health
    }));
    return jsonResponseV25({
      version: VERSION,
      type: "MOMENTUM_DEEP_SCAN",
      source: `${VERSION}｜內部個股資料連線｜${scanProfile==="DAILY_ONLY"?"輕量完成日K":scanProfile==="MOMENTUM_LITE"?"主升日線輕量分析":scanProfile==="CORE"?"精簡掃描":"完整個股分析"}｜批次代理`,
      generatedAt: new Date().toISOString(),
      requested: codes.length,
      success: 0,
      failed: codes.length,
      successRate: 0,
      elapsedMs: Date.now() - startedAt,
      health,
      results
    }, 200, corsHeaders, 0);
  }

  const results = new Array(codes.length);
  let cursor = 0;
  async function workerLoop() {
    while (true) {
      const i = cursor++;
      if (i >= codes.length) break;
      const code = codes[i];
      try {
        const fetched = await fetchStockAnalysisViaProxyV265(
          code,
          health.mode,
          env,
          scanProfile,
          request.signal,
          marketHints.get(code) || null
        );
        const bridged = scanProfile === "DAILY_ONLY"
          ? await applyVerifiedDailyBridgeV2(fetched.data, code, marketHints.get(code) || null, dailyBridge, request.signal, env)
          : { data: fetched.data, status: "NOT_APPLICABLE", ok: true };
        results[i] = {
          code,
          ok: bridged.ok !== false,
          ...(bridged.ok === false ? {error: `DATA_HISTORY_GAP｜${bridged.status}`,dataUnavailable:!/SOURCE_UNAVAILABLE/.test(bridged.status),failureKind:/SOURCE_UNAVAILABLE/.test(bridged.status)?'SERVICE':'DATA',failureCode:/SOURCE_UNAVAILABLE/.test(bridged.status)?'SOURCE_UNAVAILABLE':/SNAPSHOT_CONFLICT/.test(bridged.status)?'SNAPSHOT_CONFLICT':/HISTORY_CONFLICT/.test(bridged.status)?'HISTORY_CONFLICT':/TOO_SHORT|TOO_MANY|NOT_VERIFIED/.test(bridged.status)?'INSUFFICIENT_HISTORY':'DATA_INVALID',retryable:false} : {}),
          recovered: fetched.recovered,
          compatMode: health.mode,
          ...(bridged.ok === false ? {} : {data: bridged.data}),
          ...(debugMode ? { diagnostic: { ...fetched.diagnostic, dailyBridge: bridged.status,
            ...(bridged.missingDates ? { missingDates: bridged.missingDates } : {}) } } : {})
        };
      } catch (e) {
        results[i] = {
          code,
          ok: false,
          error: e?.message || String(e),
          diagnostic: e?.diagnostic || null
        };
      }
    }
  }

  const activeConcurrency = scanProfile === "DAILY_ONLY"
    ? DEEP_SCAN_DAILY_ONLY_CONCURRENCY_R49
    : scanProfile === "MOMENTUM_LITE"
      ? DEEP_SCAN_MOMENTUM_LITE_CONCURRENCY_R493
      : DEEP_SCAN_CONCURRENCY_V26;
  await Promise.all(Array.from({ length: Math.min(activeConcurrency, codes.length) }, workerLoop));
  const success = results.filter(x => x?.ok).length;
  const failed = results.length - success;

  return jsonResponseV25({
    version: VERSION,
    type: "MOMENTUM_DEEP_SCAN",
    source: `${VERSION}｜內部個股資料連線｜${scanProfile==="DAILY_ONLY"?"輕量完成日K":scanProfile==="MOMENTUM_LITE"?"主升日線輕量分析":scanProfile==="CORE"?"精簡掃描":"完整個股分析"}｜批次代理`,
    generatedAt: new Date().toISOString(),
    requested: codes.length,
    success,
    failed,
    successRate: codes.length ? success / codes.length : 0,
    elapsedMs: Date.now() - startedAt,
    health,
    results,
    ...(debugMode ? { dailyBridge: dailyBridge ? { ready: dailyBridge.ready, tradeDate: dailyBridge.tradeDate || null, status: dailyBridge.status, rowCount: dailyBridge.rows?.size || 0 } : null } : {}),
    ...(debugMode ? { config: {
      concurrency: activeConcurrency,
      retries: DEEP_SCAN_RETRIES_V26,
      timeoutMs: scanProfile === "DAILY_ONLY" ? DEEP_SCAN_DAILY_ONLY_TIMEOUT_MS_R49 : (scanProfile === "MOMENTUM_LITE" ? DEEP_SCAN_MOMENTUM_LITE_TIMEOUT_MS_R493 : DEEP_SCAN_TIMEOUT_MS_V26),
      compatMode: health.mode,
      scanLite: scanProfile === "CORE",
      dailyOnly: scanProfile === "DAILY_ONLY",
      momentumLite: scanProfile === "MOMENTUM_LITE",
      scanProfile
    } } : {})
  }, 200, corsHeaders, 0);
}

async function handleDeepHealthV265(request, corsHeaders, debugMode = true, env) {
  // force=1 可強制重新偵測，不使用 isolate 暫存
  const url = new URL(request.url);
  if (url.searchParams.get("force") === "1") {
    deepScanCompatStateV265 = { mode: null, checkedAt: 0, diagnostic: null };
  }
  const startedAt = Date.now();
  const health = await ensureDeepScanCompatV265(true, env);
  return jsonResponseV25({
    version: VERSION,
    type: "MOMENTUM_DEEP_HEALTH",
    generatedAt: new Date().toISOString(),
    ok: health.ok,
    elapsedMs: Date.now() - startedAt,
    health
  }, 200, corsHeaders, 0);
}

async function ensureDeepScanCompatV265(forceVerbose = false, env) {
  // V2.6.10：
  // Service Binding 已經由 Cloudflare Bindings 保證目標 Worker。
  // 不再用 2330 連續測 stock / stock-browser / code-browser / symbol-browser。
  // 舊四模式健康檢查每次最多 22 秒，失敗時會先卡約 88 秒，
  // 而且會在真正要求的股票（例如 6584）執行前就把 DeepScan 擋掉。
  if (!env?.FIB_API || typeof env.FIB_API.fetch !== "function") {
    return {
      ok: false,
      mode: null,
      cached: false,
      summary: "SERVICE_BINDING_MISSING｜找不到 FIB_API Service Binding",
      diagnostic: forceVerbose ? {
        binding: "FIB_API",
        available: false,
        strategy: "service-binding-direct-stock"
      } : undefined
    };
  }

  return {
    ok: true,
    mode: "stock",
    cached: false,
    summary: "FIB_API Service Binding 已連接｜DAILY_ONLY只取完成日K；MOMENTUM_LITE只跑日線Fib/量價/structure；CORE使用SCAN_LITE；FULL使用完整個股模式",
    diagnostic: forceVerbose ? {
      binding: "FIB_API",
      available: true,
      mode: "stock",
      strategy: "service-binding-profile-aware",
      note: "已停用舊版2330四模式相容性Probe；DAILY_ONLY走完成日K；MOMENTUM_LITE走日線主升輕量分析；CORE走SCAN_LITE；FULL走完整個股模式。"
    } : undefined
  };
}
function compatModeSpecV265(modeKey) {
  switch (modeKey) {
    case "stock-browser": return { key: modeKey, param: "stock", browserLike: true };
    case "code-browser": return { key: modeKey, param: "code", browserLike: true };
    case "symbol-browser": return { key: modeKey, param: "symbol", browserLike: true };
    default: return { key: "stock", param: "stock", browserLike: false };
  }
}

async function probeStockAnalysisV265(code, mode, env) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEP_SCAN_TIMEOUT_MS_V26);
  const u = new URL(STOCK_ANALYSIS_API_V26 + "/");
  u.searchParams.set(mode.param, code);
  u.searchParams.set("mode", "SCAN_LITE");

  const headers = { Accept: "application/json" };
  if (mode.browserLike) {
    headers["User-Agent"] = "Mozilla/5.0";
    headers["Referer"] = "https://isu9922004a.github.io/";
    headers["Origin"] = "https://isu9922004a.github.io";
  }

  try {
    if (!env?.FIB_API || typeof env.FIB_API.fetch !== "function") {
      return {
        code,
        mode: mode.key,
        requestUrl: u.toString(),
        ok: false,
        httpStatus: null,
        contentType: null,
        preview: null,
        error: "SERVICE_BINDING_MISSING｜找不到 FIB_API Service Binding"
      };
    }

    const res = await env.FIB_API.fetch(u.toString(), {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal
    });
    const text = await res.text();
    const ct = res.headers.get("content-type") || "";
    const preview = text.slice(0, DEEP_SCAN_DIAGNOSTIC_PREVIEW_V265);
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    const ok = res.ok && parsed && typeof parsed === "object" &&
      !parsed.error && !parsed.errors;

    return {
      code,
      mode: mode.key,
      requestUrl: u.toString(),
      ok,
      httpStatus: res.status,
      redirected: res.status >= 300 && res.status < 400,
      location: res.headers.get("location") || null,
      contentType: ct,
      preview,
      payloadKeys: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 20) : [],
      error: ok ? null : (
        parsed?.error || parsed?.message ||
        (res.ok ? "payload rejected by compatibility health check" : `HTTP ${res.status}`)
      )
    };
  } catch (e) {
    return {
      code,
      mode: mode.key,
      requestUrl: u.toString(),
      ok: false,
      httpStatus: null,
      contentType: null,
      preview: null,
      error: e?.name === "AbortError" ? "timeout" : (e?.message || String(e))
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStockAnalysisViaProxyV265(code, modeKey, env, scanProfile = "FULL", externalSignal = null, marketHint = null) {
  let lastErr = null;
  const mode = compatModeSpecV265(modeKey);
  const diagnostics = [];

  for (let attempt = 1; attempt <= DEEP_SCAN_RETRIES_V26; attempt++) {
    const controller = new AbortController();
    const profileTimeoutMs = scanProfile === "DAILY_ONLY" ? DEEP_SCAN_DAILY_ONLY_TIMEOUT_MS_R49 : (scanProfile === "MOMENTUM_LITE" ? DEEP_SCAN_MOMENTUM_LITE_TIMEOUT_MS_R493 : DEEP_SCAN_TIMEOUT_MS_V26);
    const timer = setTimeout(() => controller.abort(), profileTimeoutMs);
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abortFromExternal();
    else externalSignal?.addEventListener?.("abort", abortFromExternal, { once: true });
    const u = new URL(STOCK_ANALYSIS_API_V26 + "/");
    u.searchParams.set(mode.param, code);
    if (scanProfile === "DAILY_ONLY") {
      u.searchParams.set("mode", "DAILY_ONLY");
      if (marketHint) u.searchParams.set("marketHint", marketHint === "TPEx" ? "TPEX" : "TWSE");
    } else if (scanProfile === "MOMENTUM_LITE") {
      u.searchParams.set("mode", "MOMENTUM_LITE");
      if (marketHint) u.searchParams.set("marketHint", marketHint === "TPEx" ? "TPEX" : "TWSE");
    } else if (scanProfile === "CORE") {
      u.searchParams.set("mode", "SCAN_LITE");
      u.searchParams.set("profile", "CORE");
    }

    const headers = { Accept: "application/json" };
    if (mode.browserLike) {
      headers["User-Agent"] = "Mozilla/5.0";
      headers["Referer"] = "https://isu9922004a.github.io/";
      headers["Origin"] = "https://isu9922004a.github.io";
    }

    try {
      if (!env?.FIB_API || typeof env.FIB_API.fetch !== "function") {
        const err = new Error("SERVICE_BINDING_MISSING｜找不到 FIB_API Service Binding");
        err.diagnostic = { code, mode: mode.key, attempts: diagnostics };
        throw err;
      }

      const res = await env.FIB_API.fetch(u.toString(), {
        method: "GET",
        headers,
        redirect: "manual",
        signal: controller.signal
      });
      const text = await res.text();
      const contentType = res.headers.get("content-type") || "";
      const preview = text.slice(0, DEEP_SCAN_DIAGNOSTIC_PREVIEW_V265);

      const d = {
        attempt,
        mode: mode.key,
        requestUrl: u.toString(),
        httpStatus: res.status,
        redirected: res.status >= 300 && res.status < 400,
        location: res.headers.get("location") || null,
        contentType,
        preview,
        scanProfile,
        marketHint
      };
      diagnostics.push(d);

      if (!res.ok) {
        const flagHint = explainCloudflare1042V267(preview);
        const err = new Error(flagHint ? `${flagHint}｜${code}` : `DEEP_UPSTREAM_HTTP｜${code}｜HTTP ${res.status}｜${preview}`);
        err.diagnostic = { code, mode: mode.key, attempts: diagnostics };
        // 400/404 是確定性錯誤，不做無意義重試；429/5xx/timeout 才重試。
        if ([400, 404].includes(res.status)) throw err;
        throw err;
      }

      let data;
      try { data = JSON.parse(text); }
      catch {
        const err = new Error(`DEEP_UPSTREAM_FORMAT｜${code}｜JSON parse failed｜${preview}`);
        err.diagnostic = { code, mode: mode.key, attempts: diagnostics };
        throw err;
      }

      if (!data || typeof data !== "object") {
        const err = new Error(`DEEP_UPSTREAM_EMPTY｜${code}｜empty stock analysis payload`);
        err.diagnostic = { code, mode: mode.key, attempts: diagnostics };
        throw err;
      }
      if (data.error || data.errors) {
        const msg = data.error || data.message || JSON.stringify(data.errors).slice(0, 180);
        const err = new Error(`DEEP_UPSTREAM_DATA｜${code}｜${msg}`);
        err.diagnostic = { code, mode: mode.key, attempts: diagnostics, payloadKeys: Object.keys(data).slice(0, 20) };
        throw err;
      }

      return {
        data,
        recovered: attempt > 1,
        diagnostic: { code, mode: mode.key, attempts: diagnostics, payloadKeys: Object.keys(data).slice(0, 20) }
      };
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const deterministic = /HTTP (400|404)|DEEP_UPSTREAM_DATA/.test(msg);
      const cancelledByClient = externalSignal?.aborted === true;
      if (!deterministic && !cancelledByClient && attempt < DEEP_SCAN_RETRIES_V26) {
        await sleepV26(350 * attempt + Math.floor(Math.random() * 250));
      } else {
        break;
      }
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener?.("abort", abortFromExternal);
    }
  }

  if (lastErr && !lastErr.diagnostic) {
    lastErr.diagnostic = { code, mode: mode.key, attempts: diagnostics };
  }
  throw lastErr || new Error("stock analysis failed");
}

function sleepV26(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export {applyVerifiedDailyBridgeV2,dailyBridgeMissingSessionsV2,dailyBridgeRowV2,fetchStockAnalysisViaProxyV265};
