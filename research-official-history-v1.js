/* Trusted published exchange history, checked before it can supply research bars. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./worker-data-contract-v1.js'):root.ShitouWorkerDataContractV1);if(node)module.exports=api;else root.ShitouOfficialResearchHistory=api;})(globalThis,function(C){
'use strict';
const BASE='https://raw.githubusercontent.com/isu9922004a/VIP-BOWTOWER-4-SEARCH/main/data/research/',loaded=new Map(),pending=new Map();let manifestJob=null,manifestAt=0;
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
 if(!pending.has(key))pending.set(key,(async()=>{const response=await (options.fetch||globalThis.fetch)((options.base||BASE)+item.path+'?revision='+item.sha256,{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error('官方個股歷史尚未取得');const text=await response.text();if(await digest(text)!==item.sha256)throw Error('官方日線檔案與發布清單的SHA256不符');const report=inspectReport(JSON.parse(text),m,code);const proof=freeze({date:m.date,code,market:item.market,sha256:item.sha256,historyFingerprint:C.fingerprint(report.dailySeries),sourceDays:report.officialArchiveEvidence.sourceDays,manifestUniverse:m.universe});loaded.set(m.date+'|'+code,{report:freeze(report),proof,item:freeze(item)});return report;})());
 try{return await pending.get(key);}catch(e){pending.delete(key);throw e;}
}
function get(code,date){return loaded.get(date+'|'+String(code))?.report||null;}
function proof(report){const found=loaded.get(report?.closeDate+'|'+String(report?.stock));return found&&found.proof.historyFingerprint===C.fingerprint(report.dailySeries)&&found.report.dataContract.normalizedHistoryFingerprint===report.dataContract?.normalizedHistoryFingerprint?found.proof:null;}
return Object.freeze({VERSION:'OFFICIAL_RESEARCH_8_2_9',load,get,proof,inspectManifest,inspectReport,digest,reset(){loaded.clear();pending.clear();manifestJob=null;manifestAt=0;}});
});
