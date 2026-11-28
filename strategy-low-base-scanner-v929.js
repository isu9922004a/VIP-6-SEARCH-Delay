/* Candidate adapter for the existing completed-market snapshot and MOMENTUM_DEEP_SCAN contract. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./strategy-low-base-breakout-v929.js'):root.ShitouLowBaseBreakoutV929);if(node)module.exports=api;else root.ShitouLowBaseScannerV929=api;})(globalThis,function(C){
'use strict';
function pool(bundle){
 if(!(bundle?.map instanceof Map))throw Error('缺少正式市場快照');
 const date=bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate;
 if(!date)throw Error('缺少已完成交易日');
 const items=[...bundle.map].map(([code,q])=>({code:String(code),q,sector:bundle.sectorMap?.get(String(code))||{}})).sort((a,b)=>a.code.localeCompare(b.code));
 if(new Set(items.map(x=>x.code)).size!==items.length)throw Error('市場代號重複');
 return {date,items,marketTotal:bundle.snapshotRows??items.length,marketCoverageReady:bundle.meta?.marketCoverageReady===true&&bundle.snapshotRows===items.length,marketSnapshotFingerprint:bundle.meta?.snapshotContentSha256||null};
}
function finish(plan,results,stopped){
 const valid=results.filter(c=>c.eligible===true&&c.status==='PASS'&&Number.isFinite(c.quality?.score));
 const candidates=valid.slice().sort((a,b)=>b.quality.score-a.quality.score||a.code.localeCompare(b.code));
 const errors=results.filter(c=>c.status==='DATA_ERROR'||c.status==='INSUFFICIENT_DATA').length;
 const pending=plan.items.length-results.length;
 const fullMarketCertified=plan.marketCoverageReady&&pending===0&&!stopped&&errors===0;
 return {model:C.MODEL,date:plan.date,marketSnapshotFingerprint:plan.marketSnapshotFingerprint,marketTotal:plan.marketTotal,planned:plan.items.length,processed:results.length,pending,stopped,errors,fullMarketCertified,results:results.slice(),candidates,top8:candidates.filter(c=>c.quality.score>=60).slice(0,8),excluded:results.filter(c=>c.status==='EXCLUDED').length,notMatched:results.filter(c=>c.status==='FAIL').length,zeroConfirmed:fullMarketCertified&&candidates.length===0};
}
async function scan({plan,fetchBatch,shouldStop=()=>false,onProgress=()=>{},batchSize=4}){
 if(!plan?.date||!Array.isArray(plan.items)||typeof fetchBatch!=='function'||!Number.isInteger(batchSize)||batchSize<1||batchSize>8||new Set(plan.items.map(x=>x.code)).size!==plan.items.length)throw Error('掃描參數不合法');
 plan=JSON.parse(JSON.stringify(plan));
 const results=[];let stopped=false;
 for(let i=0;i<plan.items.length;i+=batchSize){
 if(shouldStop()){stopped=true;break;}
 const part=plan.items.slice(i,i+batchSize);let payload,problem;
 try{payload=await fetchBatch(part);if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('深掃格式異常');}catch(e){problem=String(e.message||e);}
 if(shouldStop()){stopped=true;break;}
 for(const item of part){
 const failure=reason=>({model:C.MODEL,code:item.code,date:plan.date,status:'DATA_ERROR',eligible:false,reasons:[reason]});
 const hits=(payload?.results||[]).filter(z=>String(z.code||z.data?.stock||z.data?.code||'')===item.code);
 let result;
 if(problem||hits.length!==1||!hits[0]?.ok||!hits[0]?.data)result=failure(problem||hits[0]?.error||'缺少唯一有效個股回傳');
 else try{result=C.evaluate(hits[0].data,{asOf:plan.date,code:item.code,quote:item.q,sector:item.sector});}catch(e){result=failure(String(e.message||e));}
 results.push({...result,code:item.code,date:plan.date});
 }
 onProgress(finish(plan,results,false));
 }
 return finish(plan,results,stopped);
}
return Object.freeze({pool,scan,finish});
});
