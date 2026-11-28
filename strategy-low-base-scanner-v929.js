/* Candidate adapter for the existing completed-market snapshot and MOMENTUM_DEEP_SCAN contract. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./strategy-low-base-breakout-v929.js'):root.ShitouLowBaseBreakoutV929);if(node)module.exports=api;else root.ShitouLowBaseScannerV929=api;})(globalThis,function(C){
'use strict';
const GATE_LABELS=Object.freeze({PRIOR20:'突破前20日漲幅不超過20%',PRIOR60:'突破前60日漲幅不超過40%',BASE5:'突破前5日整理振幅不超過12%',DRY_VOLUME:'前5日均量低於前20日均量',DEVIATION20:'月線正乖離不超過8%',CROSS20:'今日收盤新突破月線',MA5_10:'5日均線高於10日均線',MA20_SLOPE:'月線走平或翻揚',VOLUME_PREV:'成交量大於昨日2倍',TRADE_VALUE:'成交值大於5億元',VOLUME5:'成交量大於前5日均量1.5倍',VOLUME20:'成交量大於前20日均量1.5倍',VOLUME_CAP:'成交量不超過前20日均量5倍',RED:'收紅K',BODY:'紅K實體至少占振幅50%',SHADOW:'上影線不超過振幅30%',CLOSE_LOCATION:'收盤位於振幅上方25%',RSI5:'RSI5不超過80',RSI14:'RSI14不超過75',RETURN5:'最近5日漲幅不超過15%',DEVIATION60:'季線正乖離不超過20%'});
const gateLabel=key=>GATE_LABELS[key]||key;
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
function finish(plan,results,stopped,archive=null){
 const expected=new Set(plan.items.map(x=>String(x.code))),seen=new Set(),badCodes=new Set();
 for(const row of results){const code=String(row.code);if(!expected.has(code)||row.date!==plan.date||seen.has(code))badCodes.add(code);seen.add(code);}
 const identityErrors=results.filter(row=>badCodes.has(String(row.code))).length;
 const valid=results.filter(c=>expected.has(String(c.code))&&!badCodes.has(String(c.code))&&c.eligible===true&&c.status==='PASS'&&Number.isFinite(c.quality?.score));
 const candidates=valid.slice().sort((a,b)=>b.quality.score-a.quality.score||a.code.localeCompare(b.code));
 const followups=results.filter(c=>expected.has(String(c.code))&&!badCodes.has(String(c.code))).flatMap(c=>c.followupReview?.entries||[]).sort((a,b)=>b.signalDate.localeCompare(a.signalDate)||a.code.localeCompare(b.code));
 const followupReview={state:archive?.state||'UNAVAILABLE',dates:archive?.dates||[],sourceErrors:archive?.errors||[],checked:results.reduce((n,c)=>n+(c.followupReview?.checked||0),0),unavailable:results.reduce((n,c)=>n+(c.followupReview?.unavailable||0),0),notReviewed:results.filter(c=>c.status!=='EXCLUDED'&&!c.followupReview).length};
 const errors=results.filter(c=>c.status==='DATA_ERROR'||c.status==='INSUFFICIENT_DATA').length;
 const pending=plan.items.filter(item=>!seen.has(String(item.code))||badCodes.has(String(item.code))).length;
 const fullMarketCertified=plan.marketCoverageReady&&pending===0&&identityErrors===0&&!stopped&&errors===0&&(plan.deferred||0)===0&&plan.marketTotal===plan.items.length;
 return {model:C.MODEL,date:plan.date,marketSnapshotFingerprint:plan.marketSnapshotFingerprint,marketTotal:plan.marketTotal,followups,followupReview,diagnostics:diagnostics(results),planned:plan.items.length,deferred:plan.deferred||0,processed:plan.items.length-pending,pending,stopped,errors,identityErrors,fullMarketCertified,results:results.slice(),candidates,top8:candidates.filter(c=>c.quality.score>=60).slice(0,8),excluded:results.filter(c=>c.status==='EXCLUDED').length,notMatched:results.filter(c=>c.status==='FAIL').length,zeroConfirmed:fullMarketCertified&&candidates.length===0};
}
async function scan({plan,fetchBatch,shouldStop=()=>false,onProgress=()=>{},batchSize=4,archive=null,reviewFollowup=null}){
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
 let followupReview=null;
 if(archive&&typeof reviewFollowup==='function'&&result.status!=='EXCLUDED'&&hits.length===1&&hits[0]?.ok&&hits[0]?.data)try{followupReview=reviewFollowup(hits[0].data,{code:item.code,quote:item.q,asOf:plan.date,archive});}catch(e){followupReview={state:'UNAVAILABLE',checked:0,unavailable:archive.dates?.length||5,entries:[],reasons:[String(e.message||e)]};}
 results.push({...result,code:item.code,date:plan.date,name:String(item.q?.name||item.code),...(followupReview?{followupReview}:{})});
 }
 onProgress(finish(plan,results,false,archive));
 }
 return finish(plan,results,stopped,archive);
}
function riskLines(r){const p=x=>Number.isFinite(x)?x.toFixed(2):'未確認';
 if(r.state!=='RESEARCH_ONLY')return ['N字與量價壓力：'+(r.reason||'尚未核對')];
 const n=r.projection;return [n?'已確認N字 A '+p(n.A.price)+'／B '+p(n.B.price)+'／C '+p(n.C.price)+'｜1.618理論投射 '+p(n.target)+'（非保證目標）':'尚無符合條件的已確認N字，不提供推算價位',
 ...(r.pressureZones||[]).map(x=>'上方日K量價聚集 '+p(x.low)+'～'+p(x.high)+'｜量占比 '+p(x.sharePct)+'%（非實際套牢籌碼）'),
 ...(r.warnings||[]).map(x=>'額外風險：'+x),'額外N字及量價觀察尚未回測，不改原分數或排名。'];}
function lines(c){const f=c.features,q=c.quality,l=c.levels,p=x=>Number.isFinite(x)?x.toFixed(2):'未確認';
 return [c.name+'（'+c.code+'）｜'+c.date+'｜'+c.status,...(f?[
 '收盤 '+p(f.close)+'｜MA5 '+p(f.ma5)+'｜MA10 '+p(f.ma10)+'｜MA20 '+p(f.ma20)+'｜MA60 '+p(f.ma60),
 '成交量 '+p(f.volume)+'股｜成交值 '+p(f.amount/1e8)+'億元',
 '昨日／前5日／前20日量比 '+[f.volumeRatioPrev,f.volumeRatio5,f.volumeRatio20].map(p).join('／'),
 '突破前20／60日漲幅 '+p(f.prior20Return)+'%／'+p(f.prior60Return)+'%｜5日整理振幅 '+p(f.prior5Range)+'%',
 'MA20／MA60乖離 '+p(f.deviation20)+'%／'+p(f.deviation60)+'%｜RSI5／14 '+p(f.rsi5)+'／'+p(f.rsi14),
 '紅K實體 '+p(f.bodyRatio*100)+'%｜上影 '+p(f.upperShadowRatio*100)+'%｜收盤位置 '+p(f.closeLocation*100)+'%',
 ...(l?['突破收盤價 '+p(l.breakoutPrice)+'｜突破K低點 '+p(l.breakoutLow),'收盤失效參考：跌破 '+p(l.lifeLine)+'（突破K低點與月線取高值；月線隨後續日K更新）',l.pressure20>f.close?'前20日最高價壓力 '+p(l.pressure20):'收盤已不低於前20日最高價；不代表上方沒有其他壓力', '生命週期：初次突破，'+l.followup]:[]),
 ...(c.riskContext?riskLines(c.riskContext):[]),
 ...(q?['品質分 '+p(q.score)+'（'+q.grade+'級）｜基本面已核實 '+q.basicKnown+'/8｜可能上限 '+p(q.scoreUpper),...q.warnings,'初次突破候選；下一完成交易日才可確認續強。']:[]),
 ...(c.checks||[]).filter(x=>!x.pass).map(x=>'未通過：'+gateLabel(x.key))
 ]:(c.reasons||[c.reason||'資料待確認']))];}
const FOLLOWUP_LABELS={INITIAL:'初次突破',CONFIRMED:'隔日確認',DEVELOPING:'續強發展',WATCH:'觀察中',OVERHEATED:'過熱',FAILED:'突破失效',EXPIRED:'追蹤期滿',UNAVAILABLE:'資料不足'};
function followupLines(x){const p=n=>Number.isFinite(n)?n.toFixed(2):'未確認';return [x.name+'（'+x.code+'）｜'+x.signalDate+' 突破｜T+'+x.age+'｜'+(FOLLOWUP_LABELS[x.state]||x.state),'今日收盤 '+p(x.close)+'｜原突破收盤 '+p(x.breakoutPrice)+'｜原突破K低點 '+p(x.breakoutLow)+'｜月線 '+p(x.ma20),'收盤失效參考 '+p(x.lifeLine)+'｜後續量能門檻 '+p(x.volumeFloor)+'股｜'+(x.lastVolumeHealthy===null?'量能待核對':x.lastVolumeHealthy?'量能達標':'量能未達標'),...(x.failureDate?['失效日期 '+x.failureDate]:[]),'此為歷史訊號追蹤，不列入今日新突破TOP 8。'];}
function text(scan){return ['⑤ 主升段低位階帶量突破｜候選版',scan.date+'｜已處理 '+scan.processed+'/'+scan.planned+'｜未處理 '+scan.pending+'｜未掃描 '+scan.deferred+'｜資料待核對 '+scan.errors+'｜結果身分異常 '+(scan.identityErrors||0),'全市場完整性：'+(scan.fullMarketCertified?'已確認':'未完成')+'｜必要條件通過 '+scan.candidates.length+' 檔','TOP 8 依已核實分數排序；不足不補滿；非勝率預測。','前5日突破追蹤｜來源 '+(scan.followupReview?.state||'UNAVAILABLE')+'｜已核對 '+(scan.followupReview?.checked||0)+'筆｜資料不足 '+(scan.followupReview?.unavailable||0)+'筆｜未追蹤股票 '+(scan.followupReview?.notReviewed||0)+'檔',...(scan.followups||[]).flatMap(followupLines),...scan.results.flatMap(lines)].join('\n');}
return Object.freeze({pool,scan,finish,lines,text,diagnostics,gateLabel,GATE_LABELS,followupLines,riskLines});
});
