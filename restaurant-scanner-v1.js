(function(root,factory){const N=typeof module==='object'&&module.exports,api=factory(N?require('./restaurant-filter-v1.js'):root.ShitouRestaurantCore,N?require('./scan-exclusions-rsi-v5328.js'):root.ShitouScanPolicy5328);if(N)module.exports=api;else root.ShitouRestaurantScanner=api;})(globalThis,function(C,P){
'use strict';
function pool(bundle,limit=300){
 if(!(bundle?.map instanceof Map))throw Error('沒有完整市場快照');
 const date=P.date(bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate),ordinary=[...bundle.map].filter(([code,q])=>/^[1-9]\d{3}$/.test(String(code))&&!q.isSpecialProduct&&!/^91\d{2}$/.test(String(code))&&!/ETF|ETN|DR|WARRANT|PREFERRED|BOND|FUND/.test(String(q.securityType||q.productType||'').toUpperCase())&&!/受益證券|權證|特別股|基金/.test(String(q.name||'')));
 const rankVerified=bundle.map.size===bundle.snapshotRows&&ordinary.every(([,q])=>C.number(q.tradeValue)!==null&&q.tradeValue>=0);
 const ranked=ordinary.slice().sort(([a,x],[b,y])=>(y.tradeValue||0)-(x.tradeValue||0)||String(a).localeCompare(String(b))),ranks=new Map(ranked.map(([code],i)=>[String(code),i+1]));
 const exclusions={},items=[],invalid=[];
 for(const [raw,q] of bundle.map){const code=String(raw),sector=bundle.sectorMap?.get(code)||{},d=P.classify(code,q,sector,bundle.meta);if(d.excluded){exclusions[d.key]=(exclusions[d.key]||0)+1;continue;}
  if(!['TWSE','TPEX'].includes(String(q.market).toUpperCase())||P.date(q.quoteDate)!==date||['open','high','low','close','volume'].some(k=>!(C.number(q[k])>0))){invalid.push({code,reason:'快照量價／日期／市場別無效'});continue;}
  items.push({code,name:q.name||code,q,sector,valueRank:rankVerified?ranks.get(code):null,valueRankVerified:rankVerified});
 }
 items.sort((a,b)=>(C.number(b.q.pct)>=9?1:0)-(C.number(a.q.pct)>=9?1:0)||(a.valueRank??99999)-(b.valueRank??99999)||(b.q.tradeValue||0)-(a.q.tradeValue||0)||a.code.localeCompare(b.code));
 const count=limit==='all'?items.length:[100,300].includes(Number(limit))?Number(limit):300;
 return {date,items:items.slice(0,count),deferred:items.slice(count),eligiblePool:items.length,exclusions,invalid,valueRankVerified:rankVerified,universe:bundle.snapshotRows,parsed:bundle.map.size,ordinaryCount:ordinary.length};
}
function finish(result){
 result.pending=result.planned-result.attempted;
 result.candidates=result.results.filter(c=>c.eligible).slice().sort(C.compare);
 result.riskCandidates=result.results.filter(c=>c.status==='NO_CHASE').slice().sort(C.compare);
 result.dataUnavailable=result.results.filter(c=>c.status==='DATA'&&!c.serviceFailure).length;
 result.failed=result.issues.filter(x=>x.kind==='SERVICE').length;result.success=result.results.filter(c=>c.status!=='DATA').length;
 result.complete=result.pending===0&&!result.stopped&&!result.breaker&&result.failed===0&&result.dataUnavailable===0;
 result.fullMarketCertified=result.complete&&result.requestedMode==='all'&&result.deferred===0&&result.invalidPool===0&&result.parsed===result.universe&&result.results.every(c=>c.status==='EXCLUDED'||c.indicator?.calendarVerified===true&&c.indicator?.basisVerified===true);
 result.counts=Object.fromEntries(Object.keys(C.LABELS).map(k=>[k,result.results.filter(c=>c.status===k).length]));
 result.sourceVerifiedMatches=result.results.filter(c=>c.sourceMatch===true).length;
 return result;
}
async function scan({pool:plan,meta,fetchBatch,eventWindow=3,requestedMode='300',shouldStop=()=>false,onProgress=()=>{},batchSize=8}){
 if(!plan?.date||!Array.isArray(plan.items)||typeof fetchBatch!=='function'||!Number.isInteger(batchSize)||batchSize<1||batchSize>8)throw Error('第五策略掃描參數不完整');
 if(new Set(plan.items.map(x=>x.code)).size!==plan.items.length)throw Error('股票代號重複');
 const result={model:C.MODEL,date:plan.date,dataDate:plan.date,createdAt:new Date().toISOString(),profile:'DAILY_ONLY',eventWindow:C.windowSize(eventWindow),requestedMode,universe:plan.universe,parsed:plan.parsed,planned:plan.items.length,eligiblePool:plan.eligiblePool,deferred:plan.deferred.length,invalidPool:plan.invalid.length,exclusionCounts:plan.exclusions,attempted:0,pending:plan.items.length,results:[],issues:[],stopped:false,breaker:null};
 let consecutiveService=0;
 for(let at=0;at<plan.items.length;at+=batchSize){
  if(shouldStop()){result.stopped=true;break;}const part=plan.items.slice(at,at+batchSize);let payload,error;
  try{payload=await fetchBatch(part);if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('深掃回傳格式錯誤');}catch(e){error=String(e?.message||e);}
  if(shouldStop()){result.stopped=true;break;}
  for(const item of part){result.attempted++;const matches=(payload?.results||[]).filter(x=>String(x.code||x.data?.stock||x.data?.code||'')===item.code),r=matches.length===1?matches[0]:null;
   if(error||!r?.ok||!r.data){const data=r?.dataUnavailable===true;result.issues.push({code:item.code,kind:data?'DATA':'SERVICE',reason:error||r?.error||'未回傳唯一有效個股'});result.results.push({model:C.MODEL,code:item.code,name:item.name,date:plan.date,status:'DATA',label:C.LABELS.DATA,eligible:false,serviceFailure:!data,reasons:[error||r?.error||'未回傳唯一有效個股'],warnings:[],riskCodes:[]});consecutiveService=data?0:consecutiveService+1;continue;}
   let c;try{c=C.evaluate({...r.data,name:r.data.name||item.name},{asOf:plan.date,code:item.code,quote:item.q,sector:item.sector,meta,valueRank:item.valueRank,valueRankVerified:item.valueRankVerified,eventWindow:result.eventWindow});}catch(e){c={model:C.MODEL,code:item.code,name:item.name,date:plan.date,status:'DATA',label:C.LABELS.DATA,eligible:false,reasons:['個股判讀未完成：'+String(e.message||e)],warnings:[],riskCodes:[]};}
   result.results.push(c);consecutiveService=0;
  }
  finish(result);onProgress(result);
  if(consecutiveService>=8){result.breaker='連續8檔行情服務未完成，停止本輪並保留部分結果';break;}
 }
 if(shouldStop())result.stopped=true;
 finish(result);result.text=text(result);return result;
}
function text(scan){return ['石頭少爺｜⑤ 餐廳擠不進去｜均衡量價觀察版',`版本 ${C.MODEL}｜行情 ${scan.date}｜事件窗口 ${scan.eventWindow} 根完成日K`,
 '圖片主力買超與JMA需獨立資料；未提供時保持未驗證。趨勢採SMA20，漲停可為明示的推估訊號。',
 `市場 ${scan.universe}｜解析 ${scan.parsed}｜共用排除 ${Object.values(scan.exclusionCounts).reduce((s,n)=>s+n,0)}｜快照不足 ${scan.invalidPool}｜符合快篩 ${scan.eligiblePool}｜規劃 ${scan.planned}｜處理 ${scan.attempted}｜未處理 ${scan.pending}｜未深掃 ${scan.deferred}`,`本輪完成 ${scan.complete?'是':'否'}｜${scan.fullMarketCertified?'完整市場資料認證':'部分範圍／資料未全驗證，非全市場完整排名'}｜原圖完整核對符合 ${scan.sourceVerifiedMatches}`,
 '排序：風險層級→警訊數→漲停來源可信度→量縮/SMA20/CMF/成交值符合度→事件新近度→乖離→成交值序位→代號；沒有歷史最佳權重。',
 '第一節：均衡候選及附警訊觀察',...(scan.candidates.length?scan.candidates.flatMap((c,i)=>[`觀察序 #${i+1}`,...C.lines(c)]):['本次沒有符合的已驗證量價觀察；不降低資料檢查或自動補出股票。']),
 '第二節：高風險旁列，不列入候選',...scan.riskCandidates.flatMap(C.lines),
 '第三節：未入選與資料不足',...scan.results.filter(c=>!c.eligible&&c.status!=='NO_CHASE').map(c=>`${c.code}｜${c.label}｜${c.reasons.join('；')}`),...scan.issues.map(x=>`${x.code}｜${x.kind}｜${x.reason}`),scan.breaker||'',
 '近漲停策略本身可能遇到末升段、假突破、隔日跳空及無法成交；上述規則只降低可觀察風險，沒有已驗證勝率。','END-RESTAURANT｜'+scan.attempted+'/'+scan.planned].filter(Boolean).join('\n');}
return Object.freeze({pool,scan,finish,text});
});
