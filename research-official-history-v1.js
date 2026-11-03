/* Trusted published exchange history, checked before it can supply research bars. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./worker-data-contract-v1.js'):root.ShitouWorkerDataContractV1);if(node)module.exports=api;else root.ShitouOfficialResearchHistory=api;})(globalThis,function(C){
'use strict';
const BASE=globalThis.document?.currentScript?.src?new URL('./data/research/',globalThis.document.currentScript.src).href:'https://raw.githubusercontent.com/isu9922004a/VIP-6-SEARCH-Delay/main/data/research/',loaded=new Map(),pending=new Map(),coverageJobs=new Map();let manifestJob=null,manifestAt=0;
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
async function digest(text){const raw=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function inspectManifest(m,date){
 if(m?.schema!=='OFFICIAL_RESEARCH_MANIFEST_V1'||m.verified!==true||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||date&&m.date!==date||m.calendarSource!=='https://www.twse.com.tw/exchangeReport/FMTQIK'||!Array.isArray(m.researchSessions)||m.researchSessions.at(-1)!==m.date||m.researchSessions.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||i&&d<=m.researchSessions[i-1])||m.sourceDays!==m.researchSessions.length*2||!m.stocks||Object.keys(m.stocks).length!==m.universe||m.universe<1)throw Error('官方研究套件的日期、交易日或全市場筆數未通過檢查');
 return m;
}
function inspectReport(report,m,code){
 const item=m.stocks[code],c=C.verify(report);if(!item||item.code!==code||item.path!==m.date+'/'+code+'.json'||!c.ok||c.contract.stock!==code||c.contract.market!==item.market||c.contract.closeDate!==m.date||c.contract.sourceMode!=='DAILY_ONLY'||c.contract.volumeUnitSource.length!==1||c.contract.volumeUnitSource[0].adapter!=='GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE')throw Error('官方日線的股票、日期、來源或內容指紋不符');
 const e=report.officialArchiveEvidence,rows=report.dailySeries;
 if(e?.schema!=='OFFICIAL_RESEARCH_ARCHIVE_V1'||e.stock!==code||e.market!==item.market||e.date!==m.date||e.historyFingerprint!==C.fingerprint(rows)||e.sourceDays?.length!==rows.length||rows.length!==item.bars)throw Error('官方逐日來源證據未對齊');
 for(let i=0;i<rows.length;i++){
  const b=rows[i],s=e.sourceDays[i],date=b.date,compact=date.replaceAll('-',''),source=item.market==='TWSE'?`https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${compact}&type=ALLBUT0999`:`https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${date.replaceAll('-','/')}&type=EW&response=json`;
  if(!m.researchSessions.includes(date)||i&&date<=rows[i-1].date||s.date!==date||s.source!==source||!/^[a-f0-9]{64}$/.test(s.sourceSha256)||!['open','high','low','close'].every(k=>Number.isFinite(b[k])&&b[k]>0)||!Number.isFinite(b.volume)||b.volume<0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||b.low>b.high)throw Error('官方逐日價格、股數或來源日期無效');
 }
 return report;
}
async function getManifest({fetch:fetcher=globalThis.fetch,base=BASE,date}={}){
 if(!manifestJob||Date.now()-manifestAt>60000){manifestAt=Date.now();manifestJob=(async()=>{const response=await fetcher(base+'manifest.json?fresh='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('官方研究套件尚未發布（HTTP '+response.status+'）');return inspectManifest(await response.json());})();manifestJob.catch(()=>{manifestJob=null;});}
 return inspectManifest(await manifestJob,date);
}
async function load(code,options={}){
 code=String(code);if(!/^\d{4,6}$/.test(code))throw Error('股票代號不符');const m=await getManifest(options),item=m.stocks[code];if(!item)throw Error('本次官方市場沒有此股票');if(item.code!==code||item.path!==m.date+'/'+code+'.json'||!/^[a-f0-9]{64}$/.test(item.sha256)||!['TWSE','TPEX'].includes(item.market))throw Error('官方研究清單的股票路徑或指紋無效');
 if(options.market&&String(options.market).toUpperCase()!==item.market)throw Error('官方研究市場別不符');const key=m.date+'|'+code+'|'+item.sha256;
 if(!pending.has(key))pending.set(key,(async()=>{const response=await (options.fetch||globalThis.fetch)((options.base||BASE)+item.path+'?revision='+item.sha256,{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error('官方個股歷史尚未取得');const text=await response.text();if(await digest(text)!==item.sha256)throw Error('官方日線檔案與發布清單的SHA256不符');const report=inspectReport(JSON.parse(text),m,code);const proof=freeze({date:m.date,code,market:item.market,sha256:item.sha256,historyFingerprint:C.fingerprint(report.dailySeries),sourceDays:report.officialArchiveEvidence.sourceDays,manifestUniverse:m.universe});const coverage=report.dailySeries.length<63?await loadCoverage(m,code,options):null;loaded.set(m.date+'|'+code,{report:freeze(report),proof,item:freeze(item),coverage:freeze(coverage)});return report;})());
 try{return await pending.get(key);}catch(e){pending.delete(key);throw e;}
}
function get(code,date){return loaded.get(date+'|'+String(code))?.report||null;}
function proof(report){const found=loaded.get(report?.closeDate+'|'+String(report?.stock));return found&&found.proof.historyFingerprint===C.fingerprint(report.dailySeries)&&found.report.dataContract.normalizedHistoryFingerprint===report.dataContract?.normalizedHistoryFingerprint?found.proof:null;}
async function loadCoverage(m,code,options){
 const entry=m.historyCoverage;if(entry?.path!=='history-coverage.json'||!/^[a-f0-9]{64}$/.test(entry.sha256||''))return null;
 const key=m.date+'|'+entry.sha256;
 if(!coverageJobs.has(key))coverageJobs.set(key,(async()=>{const response=await (options.fetch||globalThis.fetch)((options.base||BASE)+entry.path+'?revision='+entry.sha256,{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('歷史限制說明暫未取得');const text=await response.text();if(await digest(text)!==entry.sha256)throw Error('歷史限制說明指紋不符');const data=JSON.parse(text);if(data.schema!=='OFFICIAL_HISTORY_COVERAGE_V1'||data.date!==m.date)throw Error('歷史限制說明日期不符');return data;})());
 try{const data=await coverageJobs.get(key),s=data.stocks?.[code];return s&&s.code===code&&s.market===m.stocks[code].market&&s.reportSha256===m.stocks[code].sha256?s:null;}catch(_){coverageJobs.delete(key);return null;}
}
function availability(report,{quote=null}={}){
 const code=String(report?.stock||report?.code||''),date=report?.closeDate,found=loaded.get(date+'|'+code),rows=report?.canonicalBars||report?.dailySeries;
 if(!found||report.code&&String(report.code)!==code||report.market!==found.proof.market||report.completed!==true||report.isComplete===false||report.suspended||report.corporateActionUnresolved||report.priceAdjustmentConsistent===false||report.researchInputErrors?.length||!Array.isArray(rows)||!rows.length||C.fingerprint(rows)!==found.proof.historyFingerprint||report.close!==found.report.close||report.marketDate&&report.marketDate!==date||report.dataDate&&report.dataDate!==date)return null;
 const raw=found.report,e=raw.officialArchiveEvidence,coverage=found.coverage,z=rows.at(-1),previous=rows.at(-2),count=rows.length;
 if(report.volumeUnit!=='shares'||report.dailySeriesMeta?.volumeUnit!=='shares'||report.dataContract&&!C.verify(report).ok)return null;
 for(const set of [report.dailySeries,report.canonicalBars,report.sourceDailySeries].filter(Array.isArray))if(C.fingerprint(set)!==found.proof.historyFingerprint||set.some(b=>b.stock&&String(b.stock)!==code||b.code&&String(b.code)!==code||b.market&&b.market!==report.market||b.suspended||b.completed===false||b.isComplete===false))return null;
 const expected=report.expectedTradingDates;
 if(expected&&(!Array.isArray(expected)||expected.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||i&&d<=expected[i-1])||JSON.stringify(expected.filter(d=>d>=rows[0].date&&d<=date))!==JSON.stringify(raw.expectedTradingDates)))return null;
 if(quote&&(String(quote.code)!==code||quote.market!==report.market||String(quote.quoteDate).replaceAll('-','')!==date.replaceAll('-','')||['open','high','low','close'].some(k=>!Number.isFinite(quote[k])||Math.abs(quote[k]-z[k])>.011)))return null;
 const scopeConflict=quote?.volumeScopeAudit?.formalVolumeEligible===false,dr=raw.securityType==='DR',restriction=count<63?'SHORT_HISTORY':scopeConflict?'VOLUME_SCOPE':dr?'DR_RULES':null;
 if(!restriction)return null;
 const mean=n=>count>=n?rows.slice(-n).reduce((s,b)=>s+b.close,0)/n:null;
 const gapDate=e.excludedEarlierSessions?.at(-1)||null,listing=coverage?.listing||null,gap=coverage?.latestGap||null;
 const explanation=restriction==='VOLUME_SCOPE'?'官方日線已核驗；市場快照的成交金額與股數口徑未對齊，暫不產生量價訊號。':restriction==='DR_RULES'?'此檔為存託憑證（DR）；專屬價格跳動與交易規則尚未核驗，先提供已核驗行情觀察。':listing?.date&&raw.originalDailySeries.length<63&&listing.date<=rows[0].date?`本市場掛牌日 ${listing.date}；目前有 ${count} 根連續有效日線（自 ${rows[0].date} 起）。`:gap?.status==='OFFICIAL_NO_TRADE'?`${gap.date} 官方記錄為零成交、沒有有效開高低收；其後有 ${count} 根連續日線。`:gap?.status==='OFFICIAL_NO_OHLC'?`${gap.date} 官方有成交股數但未提供開高低收，不能補成K棒；其後有 ${count} 根連續日線。`:gap?.status==='OFFICIAL_NO_SESSION'?`${gap.date} 官方日報與個股月報均無有效行情；保留中斷，其後有 ${count} 根連續日線。`:gapDate?`最近缺少有效報價日 ${gapDate}；其後有 ${count} 根連續日線，缺日原因尚未完成核對。`:`目前已核驗 ${count} 根連續日線，尚未滿足完整趨勢所需的 63 根。`;
 return freeze({verified:true,mode:'LIMITED_OBSERVATION',restriction,scopeConflict,code,market:found.proof.market,date,close:z.close,open:z.open,high:z.high,low:z.low,volume:z.volume,firstDate:rows[0].date,consecutiveBars:count,originalBars:e.originalHistoryBars??raw.originalDailySeries.length,requiredBars:63,additionalConsecutiveBars:Math.max(0,63-count),gapDate,listing,gap,explanation,ma5:mean(5),ma20:mean(20),previousDate:previous?.date||null,previousClose:previous?.close??null,changePct:previous?(z.close/previous.close-1)*100:null,source:'交易所官方逐日成交資料',sha256:found.proof.sha256,executionAllowed:false});
}
return Object.freeze({VERSION:'OFFICIAL_RESEARCH_8_6_1_HISTORY',load,get,proof,availability,inspectManifest,inspectReport,digest,reset(){loaded.clear();pending.clear();coverageJobs.clear();manifestJob=null;manifestAt=0;}});
});
