/* Keep deployment boundaries. Do not manufacture missing index metadata. */
(function(r){
'use strict';
const M=r.ShitouMarketResearch,R=r.ShitouResearchReport;
if(!M||!R)return;
const cache=new WeakMap();
function analysis(data){if(!cache.has(data))cache.set(data,M.evaluate({...data,instrumentType:data.instrumentType||(data.symbol==='^TWII'?'TAIEX':null)}));return cache.get(data);}
function report(data){const a=analysis(data);return {name:data.name||'台股大盤研究',code:data.instrumentType==='TPEX_INDEX'?'TPEX_INDEX':'TAIEX',date:data.closeDate,sourceSnapshotId:a.sourceSnapshotId,unifiedResearch:a,models:{}};}
const oldText=r.buildMarketWorkerReportText,oldImage=r.renderMarketInfographicV3328;
if(oldText)r.buildMarketWorkerReportText=function(data){if(r.ShitouResearchIntegration?.getFlags().marketContextEnabled===false)return oldText(data);const a=analysis(data);return a.state==='RESEARCH_ONLY'?R.text(report(data)):oldText(data)+'\n\n【R13新增研究資料狀態】'+a.summary.map(x=>x.value).join('；');};
r.ShitouMarketResearchIntegration=Object.freeze({analysis,report});
})(globalThis);
