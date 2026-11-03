(function(root,factory){const N=typeof module==='object'&&module.exports,api=factory(N?require('./restaurant-filter-v1.js'):root.ShitouRestaurantCore,N?require('./scan-exclusions-rsi-v5328.js'):root.ShitouScanPolicy5328,N?require('./version-v50.js'):root.ShitouReleaseV50,N?require('./selection-data-v2.js'):root.ShitouSelectionDataV2);if(N)module.exports=api;else root.ShitouRestaurantScanner=api;})(globalThis,function(C,P,R,D){
'use strict';
// Freeze a detached completed run, so later market binds cannot rewrite reports.
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}
function snapshot(scan){
 const copy=JSON.parse(JSON.stringify(scan));delete copy.snapshotId;
 copy.revision=C.REVISION;copy.model=C.MODEL;copy.eventWindow=1;
 copy.release=R.code;
 copy.text=globalThis.ShitouResearchIntegration?.appendScanText('RESTAURANT',copy,text(copy))??text(copy);copy.snapshotId=C.fingerprint(copy);
 return deepFreeze(copy);
}
function assertSnapshot(scan){
 const {snapshotId,...body}=scan||{};
 if(!snapshotId||body.revision!==C.REVISION||snapshotId!==C.fingerprint(body))throw Error('資料不足｜餐廳結果快照缺失或已變動，請重新掃描');
 for(const c of [...(scan.candidates||[]),...(scan.riskCandidates||[])]){
  const v=c.validation,{id,...audit}=v||{};
  if(!C.qualifies(c)||c.model!==C.MODEL||!v||v.checksFingerprint!==C.fingerprint(c.checks)||id!==C.fingerprint(audit)||v.date!==scan.date||v.code!==c.code||v.historyFingerprint!==C.fingerprint(c.report?.canonicalBars)||v.quoteFingerprint!==C.fingerprint(v.quote)||v.invalidation.close!==c.report?.close||v.invalidation.threshold!==c.levels?.invalidation)throw Error('資料不足｜餐廳候選未通過本版六項驗證或與來源不同，請重新掃描');
 }
 return scan;
}
function certifyRanking(bundle,source){
 const date=P.date(bundle?.meta?.targetTradeDate||bundle?.meta?.completedTradeDate),rows=source?.rows,hash=bundle?.meta?.snapshotContentSha256;
 if(!(bundle?.map instanceof Map)||source?.schemaVersion!==1||source.marketCoverageReady!==true||source.tradeDateIso!==date||!/^[a-f0-9]{64}$/.test(hash||'')||source.contentSha256!==hash||!Array.isArray(rows)||source.counts?.totalRows!==rows.length||bundle.snapshotRows!==rows.length||bundle.map.size!==rows.length)throw Error('同日官方排名快照與市場來源、日期或完整筆數不符');
 const seen=new Set(),counts={TWSE:0,TPEX:0};
 for(const r of rows){const code=String(r.code),q=bundle.map.get(code);if(seen.has(code)||!q||!Object.hasOwn(counts,r.market)||P.date(r.quoteDate)!==date||q.market!==r.market||P.date(q.quoteDate)!==date||r.tradeValueSource!=='OFFICIAL_REPORTED'||q.tradeValueSource!=='OFFICIAL_REPORTED'||C.number(r.officialTradeValue)===null||C.number(r.officialTradeValue)<0||['open','high','low','close','volume','tradeValue','officialTradeValue'].some(k=>C.number(r[k])!==C.number(q[k]))||C.number(r.tradeValue)!==C.number(r.officialTradeValue))throw Error('官方排名母體含重複、錯日、估計成交值或不同股票數據');seen.add(code);counts[r.market]++;}
 if(!counts.TWSE||!counts.TPEX||counts.TWSE!==source.counts.twseRows||counts.TPEX!==source.counts.tpexRows)throw Error('上市／上櫃排名母體未完整對齊');
 return {...bundle,meta:{...bundle.meta,restaurantRankingProof:{verified:true,date,contentSha256:hash,rows:rows.length,scope:C.RULE.rankScope}}};
}
function pool(bundle,limit='all'){
 if(!(bundle?.map instanceof Map))throw Error('沒有完整市場快照');
 const date=P.date(bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate),ordinary=[...bundle.map].filter(([code,q])=>C.ordinary(code,q));
 const baselineRankKnown=bundle.map.size===bundle.snapshotRows&&ordinary.every(([,q])=>C.number(q.tradeValue)!==null&&q.tradeValue>=0);
 const proof=bundle.meta?.restaurantRankingProof,rankVerified=bundle.meta?.marketCoverageReady===true&&(bundle.meta?.commonStockUniverseVerified===true||proof?.verified===true&&proof.date===date&&proof.scope===C.RULE.rankScope&&proof.contentSha256===bundle.meta.snapshotContentSha256&&proof.rows===bundle.snapshotRows)&&bundle.map.size===bundle.snapshotRows&&ordinary.length>0&&ordinary.every(([,q])=>q.quoteDate===date&&q.tradeValueSource==='OFFICIAL_REPORTED'&&C.number(q.officialTradeValue)!==null&&q.officialTradeValue>=0&&q.tradeValue===q.officialTradeValue);
 const ranked=ordinary.slice().sort(([a,x],[b,y])=>(y.tradeValue||0)-(x.tradeValue||0)||String(a).localeCompare(String(b))),ranks=new Map(ranked.map(([code],i)=>[String(code),i+1]));
 const exclusions={},items=[],invalid=[];
 for(const [raw,q] of bundle.map){const code=String(raw),sector=bundle.sectorMap?.get(code)||{};if(!C.ordinary(code,q)){exclusions.NON_COMMON=(exclusions.NON_COMMON||0)+1;continue;}
  if(!['TWSE','TPEX'].includes(String(q.market).toUpperCase())||P.date(q.quoteDate)!==date||['open','high','low','close','volume'].some(k=>!(C.number(q[k])>0))){invalid.push({code,reason:'快照量價／日期／市場別無效'});continue;}
  const naming=C.nameInfo(code,q);items.push({code,name:naming.name,nameSource:naming.source,nameFallback:naming.fallback,nameZhTW:naming.fallback?null:naming.name,q,sector,baselineValueRank:baselineRankKnown?ranks.get(code):null,valueRank:rankVerified?ranks.get(code):null,valueRankVerified:rankVerified});
 }
 items.sort((a,b)=>(a.baselineValueRank??99999)-(b.baselineValueRank??99999)||a.code.localeCompare(b.code));
 const count=limit==='all'?items.length:[100,300].includes(Number(limit))?Number(limit):300;
 return {date,items:items.slice(0,count),deferred:items.slice(count),eligiblePool:items.length,exclusions,invalid,valueRankVerified:rankVerified,universe:bundle.snapshotRows,parsed:bundle.map.size,ordinaryCount:ordinary.length};
}
function finish(result){
 result.pending=result.planned-result.attempted;
 result.candidates=result.results.filter(c=>c.eligible===true&&C.qualifies(c)).slice().sort(C.compare);
 result.riskCandidates=[];
 result.riskWarnings=result.candidates.filter(c=>c.riskCodes?.length);
 result.unverified=result.results.filter(c=>c.status==='UNVERIFIED').length;
 result.notMatched=result.results.filter(c=>c.status==='NOT_MATCH').length;
 result.dataUnavailable=result.results.filter(c=>c.status==='DATA'&&!c.serviceFailure).length;
 result.failed=result.issues.filter(x=>x.kind==='SERVICE').length;result.success=result.results.filter(c=>c.status!=='DATA').length;
 result.complete=result.pending===0&&!result.stopped&&!result.breaker&&result.failed===0&&result.dataUnavailable===0;
 result.verificationComplete=result.complete&&result.unverified===0;
 result.fullMarketCertified=result.verificationComplete&&result.requestedMode==='all'&&result.deferred===0&&result.invalidPool===0&&result.parsed===result.universe&&result.results.every(c=>c.status==='EXCLUDED'||c.rankPrecheck===true||c.indicator?.calendarVerified===true&&c.indicator?.basisVerified===true);
 result.counts=Object.fromEntries(Object.keys(C.LABELS).map(k=>[k,result.results.filter(c=>c.status===k).length]));
 result.sourceVerifiedMatches=result.candidates.length;
 return result;
}
async function scan({pool:plan,meta,fetchBatch,eventWindow=1,requestedMode='all',shouldStop=()=>false,onProgress=()=>{},batchSize=8}){
 if(!plan?.date||!Array.isArray(plan.items)||typeof fetchBatch!=='function'||!Number.isInteger(batchSize)||batchSize<1||batchSize>8)throw Error('第五策略掃描參數不完整');
 if(new Set(plan.items.map(x=>x.code)).size!==plan.items.length)throw Error('股票代號重複');
 const result={model:C.MODEL,date:plan.date,dataDate:plan.date,createdAt:new Date().toISOString(),profile:'DAILY_ONLY',eventWindow:C.windowSize(eventWindow),requestedMode,rankingReason:meta?.restaurantRankError||null,universe:plan.universe,parsed:plan.parsed,planned:plan.items.length,eligiblePool:plan.eligiblePool,deferred:plan.deferred.length,invalidPool:plan.invalid.length,exclusionCounts:plan.exclusions,attempted:0,pending:plan.items.length,results:[],issues:[],stopped:false,breaker:null};
 let consecutiveService=0;
 for(let at=0;at<plan.items.length;at+=batchSize){
  if(shouldStop()){result.stopped=true;break;}const part=plan.items.slice(at,at+batchSize),needed=part.filter(x=>!(x.valueRankVerified===true&&x.valueRank>100));let payload,error;
  if(needed.length)try{payload=await fetchBatch(needed);if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('深掃回傳格式錯誤');}catch(e){error=String(e?.message||e);}
  if(shouldStop()){result.stopped=true;break;}
  for(const item of part){result.attempted++;
   if(item.valueRankVerified===true&&item.valueRank>100){result.results.push({model:C.MODEL,code:item.code,name:item.name,date:plan.date,status:'NOT_MATCH',label:C.LABELS.NOT_MATCH,eligible:false,sourceMatch:false,sourceCheckState:'NOT_MATCH',reasons:[`#9091 同日官方成交值排名 ${item.valueRank}，不在前100；已可判定未符合，其餘條件未深掃`],warnings:[],riskCodes:[],rankPrecheck:true,checks:C.CHECK_KEYS.map(key=>({key,label:key==='VALUE'?'#9091 當日成交值排名前100':key,pass:key==='VALUE'?false:null,note:key==='VALUE'?`上市櫃普通股合併序位 ${item.valueRank}`:'成交值已未符合，本項未取得，不宣稱通過'}))});continue;}
   const matches=(payload?.results||[]).filter(x=>String(x.code||x.data?.stock||x.data?.code||'')===item.code),r=matches.length===1?matches[0]:null;
   if(error||!r?.ok||!r.data){const data=D.isDataFailure(r||error);result.issues.push({code:item.code,kind:data?'DATA':'SERVICE',reason:error||r?.error||'未回傳唯一有效個股'});result.results.push({model:C.MODEL,code:item.code,name:C.displayName(item.code,item),nameSource:item.nameSource,nameFallback:item.nameFallback,date:plan.date,status:'DATA',label:C.LABELS.DATA,eligible:false,serviceFailure:!data,reasons:[error||r?.error||'未回傳唯一有效個股'],warnings:[],riskCodes:[]});consecutiveService=data?0:consecutiveService+1;continue;}
   let c;try{c=C.evaluate({...r.data,name:item.name,nameZhTW:item.nameZhTW||r.data.nameZhTW},{asOf:plan.date,code:item.code,quote:item.q,sector:item.sector,meta,valueRank:item.valueRank,valueRankVerified:item.valueRankVerified,baselineValueRank:item.baselineValueRank,eventWindow:result.eventWindow});}catch(e){c={model:C.MODEL,code:item.code,name:C.displayName(item.code,item),nameSource:item.nameSource,nameFallback:item.nameFallback,date:plan.date,status:'DATA',label:C.LABELS.DATA,eligible:false,reasons:['個股判讀未完成：'+String(e.message||e)],warnings:[],riskCodes:[]};}
   result.results.push(c);consecutiveService=0;
  }
  finish(result);onProgress(result);
  if(consecutiveService>=8){const reasons=[...new Set(result.issues.filter(x=>x.kind==='SERVICE').slice(-8).map(x=>x.reason))];result.breaker='連續8檔行情服務未完成，停止本輪並保留部分結果｜'+reasons.slice(0,2).map(x=>String(x).slice(0,180)).join('；');break;}
 }
 if(shouldStop())result.stopped=true;
 finish(result);return snapshot(result);
}
function text(scan){return ['石頭少爺｜⑤ 餐廳擠不進去｜六項條件嚴格版',`版本 ${scan.release||C.REVISION}｜模型 ${C.MODEL}｜行情 ${scan.date}｜固定近1根完成日K`,
 '#904 當日收盤漲停；#9072 主力買超占成交量 >5%；#932 當日量 < 5日均量；#9291 收盤 > JMA20；#9091 同日成交值排名 ≤100；#802 CMF >0。六項全部通過才入選。',scan.rankingReason?'排名來源待驗證：'+scan.rankingReason:'',
 '計算口徑：5日均量含當日、CMF採20日、成交值採上市櫃普通股合併全市場。截圖未列出的公式與母體仍待原App核對。主力／JMA／官方漲停來源不足列待驗證，不以SMA、OBV或推估價格代替。',
 `市場 ${scan.universe}｜解析 ${scan.parsed}｜非普通股 ${Object.values(scan.exclusionCounts||{}).reduce((s,n)=>s+n,0)}｜快照不足 ${scan.invalidPool}｜範圍 ${scan.eligiblePool}｜規劃 ${scan.planned}｜處理 ${scan.attempted}｜未處理 ${scan.pending}｜未深掃 ${scan.deferred}`,
 `六項通過 ${scan.candidates.length}｜條件未符合 ${scan.notMatched||0}｜條件待驗證 ${scan.unverified||0}｜行情不足 ${scan.dataUnavailable||0}｜服務失敗 ${scan.failed||0}｜處理完成 ${scan.complete?'是':'否'}｜條件驗證完成 ${scan.verificationComplete?'是':'否'}`,
 '入選依官方成交值序位、代號排列；乖離、急漲、OBV與價格結構僅為額外風險提醒，不另加淘汰條件。',
 '第一節：六項全數通過名單',...(scan.candidates.length?scan.candidates.flatMap((c,i)=>[`入選 #${i+1}`,...C.lines(c)]):[scan.unverified?'尚有條件資料待驗證，不能把目前無入選解讀為全市場0檔符合。':'目前已核對範圍內沒有六項全數通過者；請一併查看未處理與行情不足筆數。']),
 '第二節：待驗證及條件未符合',...scan.results.filter(c=>!c.eligible).flatMap(C.lines),...(scan.issues||[]).map(x=>`${x.code}｜${x.kind}｜${x.reason}`),scan.breaker||'',
 '入選不等於買進許可，收盤漲停不代表下一交易日可成交；目前沒有已驗證的策略勝率。','END-RESTAURANT｜'+scan.attempted+'/'+scan.planned].filter(Boolean).join('\n');}
return Object.freeze({certifyRanking,pool,scan,finish,text,snapshot,assertSnapshot});
});
