/* Evidence bridge: preserve source bars; enrich only with independently checked evidence. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./worker-data-contract-v1.js'):root.ShitouWorkerDataContractV1);if(node)module.exports=api;else root.ShitouResearchSourceEvidence=api;})(globalThis,function(C){
'use strict';
const VERSION='RESEARCH_SOURCE_EVIDENCE_R17',SCHEMA='TW_RESEARCH_SESSIONS_V1',requests=new Map();
const iso=x=>{const s=String(x||'').replace(/[-/]/g,'');if(!/^\d{8}$/.test(s))return null;const d=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);const dt=new Date(d+'T00:00:00Z');return Number.isFinite(+dt)&&dt.toISOString().slice(0,10)===d?d:null;};
function calendar(payload,snapshot){
 const date=iso(snapshot?.date||snapshot?.meta?.targetTradeDate),hash=snapshot?.meta?.snapshotContentSha256;
 if(payload?.schema!==SCHEMA||payload.verified!==true||!/^\d{4}-01-01$/.test(payload.start||'')||!date||payload.sourceSnapshotDate!==date||hash&&payload.sourceSnapshotHash!==hash)return {status:'UNKNOWN',reason:'研究日曆版本、日期或快照指紋未對齊'};
 if(payload.source!=='https://www.twse.com.tw/exchangeReport/FMTQIK'||!Array.isArray(payload.months)||!payload.months.length||!Array.isArray(payload.dates)||!payload.dates.length)return {status:'UNKNOWN',reason:'缺少官方實際交易日期來源'};
 const dates=payload.dates;if(dates.at(-1)!==date||dates.some((d,i)=>iso(d)!==d||i&&d<=dates[i-1])||payload.end!==date||payload.start>dates[0])return {status:'UNKNOWN',reason:'官方交易日期範圍不完整'};
 const months=payload.months.map(x=>x.month),start=payload.start.slice(0,7),last=date.slice(0,7),expected=[];let cursor=start;
 while(cursor<=last){expected.push(cursor);const d=new Date(cursor+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);cursor=d.toISOString().slice(0,7);}
 if(JSON.stringify(months)!==JSON.stringify(expected))return {status:'UNKNOWN',reason:'官方交易月份有缺漏'};
 const flat=[];for(const m of payload.months){const url='https://www.twse.com.tw/exchangeReport/FMTQIK?response=json&date='+m.month.replace('-','')+'01';if(m.source!==url||m.status!=='OK'||!/^[a-f0-9]{64}$/.test(m.sha256||'')||!Array.isArray(m.dates)||!m.dates.length||m.dates.some((d,i)=>!iso(d)||d.slice(0,7)!==m.month||i&&d<=m.dates[i-1]))return {status:'UNKNOWN',reason:'官方月份證據無效'};flat.push(...m.dates.filter(d=>d<=date));}
 if(JSON.stringify(flat)!==JSON.stringify(dates))return {status:'UNKNOWN',reason:'交易日期與月份證據不一致'};
 return {status:'VERIFIED',value:{verified:true,source:payload.source,start:payload.start,end:payload.end,dates:[...dates],asOfDate:date,sourceSnapshotHash:payload.sourceSnapshotHash,method:'官方實際成交日期，非僅以星期或缺報價推定休市'},reason:null};
}
async function loadCalendar(snapshot,{fetch:fetcher=globalThis.fetch,url='./data/market/research-calendar.json',timeoutMs=8000}={}){
 if(!snapshot?.date||typeof fetcher!=='function')return {status:'UNKNOWN',reason:'官方研究日曆尚未接入'};
 const key=snapshot.identity||snapshot.date+'|'+snapshot.meta?.snapshotContentSha256;
 if(!requests.has(key)){
  if(requests.size>8)requests.delete(requests.keys().next().value);
  requests.set(key,(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetcher(url+'?asof='+snapshot.date,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return calendar(await response.json(),snapshot);}catch(e){return {status:'UNKNOWN',reason:'官方研究日曆未取得：'+String(e.message||e)};}finally{clearTimeout(timer);}})());
 }
 return requests.get(key);
}
function officialPriceBasis(bars,reference,quote){
 const unknown=reason=>({status:'UNKNOWN',reason});if(!reference?.dataContract)return unknown('後端未提供可核驗的價格來源契約');
 const checked=C.verify(reference);if(!checked.ok)return unknown('完整行情契約未通過：'+checked.reason);
 const c=checked.contract,source=reference.dailySeriesMeta?.source||'',adapters=c.volumeUnitSource.map(x=>x.adapter);
 // Yahoo includeAdjustedClose=false does not prove its split adjustment policy.
 // Only the audited official TWSE daily-history branch supplies this proof.
 if(c.market!=='TWSE'||c.sourceMode!=='FULL'||!/^TWSE Official daily history(?: \+ TWSE MIS latest completed daily)?$/.test(source)||!adapters.includes('TWSE_STOCK_DAY')||adapters.some(x=>!['TWSE_STOCK_DAY','TWSE_MIS','GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE','VERIFIED_LATEST_SNAPSHOT'].includes(x)))return unknown('此來源尚無獨立官方歷史可核對價格口徑');
 if(!bars?.length||c.stock!==String(quote?.code)||iso(c.closeDate)!==iso(quote?.quoteDate))return unknown('官方參考的股票或日期未對齊');
 const map=new Map(reference.dailySeries.map(x=>[x.date,x])),mismatches=[];
 for(const b of bars){const official=map.get(b.date),last=b.date===iso(quote.quoteDate)?quote:official;if(!official||!last||['open','high','low','close'].some(k=>!Number.isFinite(b[k])||!Number.isFinite(last[k])||Math.abs(b[k]-last[k])>.00500001||Math.abs(b[k]-official[k])>.00500001))mismatches.push(b.date);}
 if(mismatches.length)return {status:'CONFLICT',reason:'共用日K與官方完整歷史的OHLC不一致',dates:mismatches};
 return {status:'VERIFIED',value:{verified:true,basis:'UNADJUSTED_OFFICIAL_OHLC',source,method:'共用序列每一根OHLC皆與官方完整歷史一致，末日再核對同日官方市場快照',matchedBars:bars.length,firstDate:bars[0].date,lastDate:bars.at(-1).date,referenceFingerprint:c.normalizedHistoryFingerprint,referenceSourceVersion:c.sourceVersion,corporateActionsVerified:false},reason:null};
}
function inspectGaps(bars,cal){if(!cal?.verified||!bars?.length||cal.start>bars[0].date||cal.end<bars.at(-1).date)return {status:'UNKNOWN',reason:'官方實際交易日期涵蓋範圍不足',missing:[],extra:[]};const actual=new Set(bars.map(x=>x.date)),expected=cal.dates.filter(d=>d>=bars[0].date&&d<=bars.at(-1).date),expectedSet=new Set(expected);const missing=expected.filter(x=>!actual.has(x)),extra=[...actual].filter(x=>!expectedSet.has(x));return {status:missing.length||extra.length?'CONFLICT':'VERIFIED',missing,extra,expectedBars:expected.length};}
return Object.freeze({VERSION,SCHEMA,calendar,loadCalendar,officialPriceBasis,inspectGaps});
});
