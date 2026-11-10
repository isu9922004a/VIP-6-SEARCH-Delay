'use strict';
// Same official URLs, parsers, completed-day filter and report builder as the Worker.
const WORKER='https://shitou-taiwanmarket-api.d318426.workers.dev/?market=TAIEX';
async function json(url,{fetcher=fetch}={}){
 const r=await fetcher(url,{signal:AbortSignal.timeout(60000),headers:{Accept:'application/json'}});if(!r.ok)throw Error(new URL(url).host+' HTTP '+r.status);
 const text=await r.text();if(/^\s*</.test(text))throw Error('TEMPORARY_NON_JSON '+new URL(url).host+' returned an HTML error page');
 return JSON.parse(text);
}
async function official({workerModule,expected}={}){
 const W=workerModule||await import('../market-worker.mjs');
 const [history,volume]=await Promise.all([W.fetchTaiexHistoryOfficial(24,true),W.fetchTaiexMarketVolumeOfficial(8,true)]),rows=W.getCompletedDailyRows(history.rows),dailySeries=W.buildTaiexDailySeries(rows,volume.rows,120);
 if(!dailySeries.length||dailySeries.at(-1).date!==expected||dailySeries.some(b=>!(b.volume>0)))throw Error('官方大盤價格與成交股數未完整對齊 '+expected);
 const raw=W.buildTaiexReportFromHistory({rows,dailySeries,dailySeriesMeta:W.buildTaiexDailySeriesMeta(rows,volume.rows,dailySeries)});
 raw.officialSourceRecovery={schema:'TAIEX_OFFICIAL_SOURCE_RECOVERY_V1',priceSource:'https://www.twse.com.tw/indicesReport/MI_5MINS_HIST',volumeSource:'https://www.twse.com.tw/exchangeReport/FMTQIK',priceMonths:history.monthKeys,volumeMonths:volume.monthKeys};
 return raw;
}
async function load({expected,fetcher=fetch,fallback=official}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expected||''))throw Error('Expected completed index date required');
 let failure;
 try{const raw=await json(WORKER,{fetcher});if(raw.index!=='TAIEX'||raw.type!=='MARKET_INDEX'||raw.closeDate!==expected||!Array.isArray(raw.dailySeries)||raw.dailySeries.at(-1)?.date!==expected)throw Error('Worker index has not reached '+expected);return raw;}catch(e){failure=e.message;}
 const raw=await fallback({expected});if(raw?.index!=='TAIEX'||raw.type!=='MARKET_INDEX'||raw.closeDate!==expected||raw.dailySeries?.at(-1)?.date!==expected)throw Error('Official index recovery date mismatch');
 return {...raw,officialSourceRecovery:{...raw.officialSourceRecovery,workerFailure:failure}};
}
module.exports={json,official,load,WORKER};
