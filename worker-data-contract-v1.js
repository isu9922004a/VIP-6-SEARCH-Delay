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
