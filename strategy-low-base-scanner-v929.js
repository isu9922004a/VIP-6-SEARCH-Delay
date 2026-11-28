/* Candidate adapter for the existing completed-market snapshot and MOMENTUM_DEEP_SCAN contract. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./strategy-low-base-breakout-v929.js'):root.ShitouLowBaseBreakoutV929);if(node)module.exports=api;else root.ShitouLowBaseScannerV929=api;})(globalThis,function(C){
'use strict';
function pool(bundle,limit='all'){
 if(!(bundle?.map instanceof Map))throw Error('缺少正式市場快照');
 const date=bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate;
 if(!date)throw Error('缺少已完成交易日');
 const items=[...bundle.map].map(([code,q])=>({code:String(code),q,sector:bundle.sectorMap?.get(String(code))||{}})).sort((a,b)=>a.code.localeCompare(b.code));
 if(new Set(items.map(x=>x.code)).size!==items.length)throw Error('市場代號重複');
 const n=limit==='all'?items.length:[100,300].includes(Number(limit))?Number(limit):items.length;
 return {date,items:items.slice(0,n),deferred:Math.max(0,items.length-n),marketTotal:bundle.snapshotRows??items.length,marketCoverageReady:bundle.meta?.marketCoverageReady===true&&bundle.snapshotRows===items.length,marketSnapshotFingerprint:bundle.meta?.snapshotContentSha256||null};
}
function diagnostics(results){
 const statuses={},unavailableReasons={},gateCounts={},unavailableByCode=[];
 for(const row of results){
  statuses[row.status]=(statuses[row.status]||0)+1;
  if(row.status==='DATA_ERROR'||row.status==='INSUFFICIENT_DATA'){
   const reasons=row.reasons?.length?row.reasons:[row.reason||'原因待確認'];
   unavailableByCode.push({code:row.code,name:row.name,status:row.status,reasons});
   for(const reason of new Set(reasons))unavailableReasons[reason]=(unavailableReasons[reason]||0)+1;
  }
  for(const c of row.checks||[]){
   if(typeof c.pass!=='boolean')continue;
   const g=gateCounts[c.key]||(gateCounts[c.key]={evaluated:0,pass:0,fail:0});
   g.evaluated++;g[c.pass?'pass':'fail']++;
  }
 }
 return {statuses,unavailableReasons,unavailableByCode,gateCounts};
}
function finish(plan,results,stopped){
 const valid=results.filter(c=>c.eligible===true&&c.status==='PASS'&&Number.isFinite(c.quality?.score));
 const candidates=valid.slice().sort((a,b)=>b.quality.score-a.quality.score||a.code.localeCompare(b.code));
 const errors=results.filter(c=>c.status==='DATA_ERROR'||c.status==='INSUFFICIENT_DATA').length;
 const pending=plan.items.length-results.length;
 const fullMarketCertified=plan.marketCoverageReady&&pending===0&&!stopped&&errors===0&&(plan.deferred||0)===0&&plan.marketTotal===plan.items.length;
 return {model:C.MODEL,date:plan.date,marketSnapshotFingerprint:plan.marketSnapshotFingerprint,marketTotal:plan.marketTotal,diagnostics:diagnostics(results),planned:plan.items.length,deferred:plan.deferred||0,processed:results.length,pending,stopped,errors,fullMarketCertified,results:results.slice(),candidates,top8:candidates.filter(c=>c.quality.score>=60).slice(0,8),excluded:results.filter(c=>c.status==='EXCLUDED').length,notMatched:results.filter(c=>c.status==='FAIL').length,zeroConfirmed:fullMarketCertified&&candidates.length===0};
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
 results.push({...result,code:item.code,date:plan.date,name:String(item.q?.name||item.code)});
 }
 onProgress(finish(plan,results,false));
 }
 return finish(plan,results,stopped);
}
function lines(c){const f=c.features,q=c.quality,p=x=>Number.isFinite(x)?x.toFixed(2):'未確認';
 return [c.name+'（'+c.code+'）｜'+c.date+'｜'+c.status,...(f?[
 '收盤 '+p(f.close)+'｜MA5 '+p(f.ma5)+'｜MA10 '+p(f.ma10)+'｜MA20 '+p(f.ma20)+'｜MA60 '+p(f.ma60),
 '成交量 '+p(f.volume)+'股｜成交值 '+p(f.amount/1e8)+'億元',
 '昨日／前5日／前20日量比 '+[f.volumeRatioPrev,f.volumeRatio5,f.volumeRatio20].map(p).join('／'),
 '突破前20／60日漲幅 '+p(f.prior20Return)+'%／'+p(f.prior60Return)+'%｜5日整理振幅 '+p(f.prior5Range)+'%',
 'MA20／MA60乖離 '+p(f.deviation20)+'%／'+p(f.deviation60)+'%｜RSI5／14 '+p(f.rsi5)+'／'+p(f.rsi14),
 '紅K實體 '+p(f.bodyRatio*100)+'%｜上影 '+p(f.upperShadowRatio*100)+'%｜收盤位置 '+p(f.closeLocation*100)+'%',
 ...(q?['品質分 '+p(q.score)+'（'+q.grade+'級）｜基本面已核實 '+q.basicKnown+'/8｜可能上限 '+p(q.scoreUpper),...q.warnings,'初次突破候選；下一完成交易日才可確認續強。']:[]),
 ...(c.checks||[]).filter(x=>!x.pass).map(x=>'未通過：'+x.key)
 ]:(c.reasons||[c.reason||'資料待確認']))];}
function text(scan){return ['⑤ 主升段低位階帶量突破｜候選版',scan.date+'｜已處理 '+scan.processed+'/'+scan.planned+'｜未處理 '+scan.pending+'｜未掃描 '+scan.deferred+'｜資料待核對 '+scan.errors,'全市場完整性：'+(scan.fullMarketCertified?'已確認':'未完成')+'｜必要條件通過 '+scan.candidates.length+' 檔','TOP 8 依已核實分數排序；不足不補滿；非勝率預測。',...scan.results.flatMap(lines)].join('\n');}
return Object.freeze({pool,scan,finish,lines,text,diagnostics});
});
