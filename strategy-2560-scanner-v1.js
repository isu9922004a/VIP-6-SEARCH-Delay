(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./strategy-2560-v1.js'):r.ShitouStrategy2560,N?require('./kline-attack-v90.js'):r.ShitouKlineAttack);if(N)module.exports=a;else r.ShitouStrategy2560Scanner=a;})(globalThis,function(C,K){
'use strict';
function pool(bundle,limit='all'){if(!(bundle?.map instanceof Map))throw Error('尚未取得完整市場快照');const date=bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate,items=[],invalid=[],exclusions={},excluded=[];
 for(const[raw,q]of bundle.map){const code=String(raw),sector=bundle.sectorMap?.get(code)||{},u=C.universe(code,q,sector),name=C.displayName(code,q);if(!u.ok&&u.state==='EXCLUDED'){exclusions[u.reason]=(exclusions[u.reason]||0)+1;excluded.push({code,name,status:'EXCLUDED',reason:u.reason});continue;}items.push({code,name,nameZhTW:name,q,sector});}
 items.sort(C.compare);const n=limit==='all'?items.length:[100,300].includes(Number(limit))?Number(limit):items.length;
 return {date,items:items.slice(0,n),deferred:items.slice(n),invalid,exclusions,excluded,universe:bundle.snapshotRows??bundle.map.size,parsed:bundle.map.size,eligiblePool:items.length,marketSnapshotFingerprint:bundle.meta?.snapshotContentSha256||null,marketCoverageReady:bundle.meta?.marketCoverageReady===true&&bundle.snapshotRows===bundle.map.size};
}
function finish(r){
 r.pending=r.planned-r.attempted;r.candidates=r.results.filter(C.qualifies).sort(C.compare);r.riskCandidates=[];r.riskWarnings=r.candidates.filter(c=>c.riskCodes?.length);r.sourceVerifiedMatches=r.candidates.length;r.unverified=0;
 r.dataUnavailable=r.results.filter(c=>c.status==='INSUFFICIENT_DATA').length;r.failed=r.results.filter(c=>c.status==='DATA_ERROR').length;r.notMatched=r.results.filter(c=>c.status==='FAIL').length;r.serviceFailures=r.results.filter(c=>c.serviceFailure===true).length;
 r.complete=r.pending===0&&!r.stopped&&!r.failed&&!r.dataUnavailable;r.verificationComplete=r.complete;
 r.fullMarketCertified=r.complete&&r.requestedMode==='all'&&r.marketCoverageReady===true&&r.deferred===0&&r.parsed===r.universe;
 r.statusCounts=Object.fromEntries(Object.keys(C.LABELS).map(k=>[k,r.results.filter(x=>x.status===k).length]));
 r.inputAccounting={input:r.parsed,excluded:r.excluded.length,processed:r.attempted,pending:r.pending,deferred:r.deferred};
 const valid=r.results.filter(c=>['PASS','FAIL'].includes(c.status)&&c.checks?.length===4&&C.CHECK_KEYS.every(k=>c.checks.filter(x=>x.key===k).length===1));
 const pass=(c,k)=>c.checks.find(x=>x.key===k)?.pass===true;
 const independent=Object.fromEntries(C.CHECK_KEYS.map(k=>[k,valid.filter(c=>pass(c,k)).length]));
 const pairs={};for(let i=0;i<C.CHECK_KEYS.length;i++)for(let j=i+1;j<C.CHECK_KEYS.length;j++){const a=C.CHECK_KEYS[i],b=C.CHECK_KEYS[j];pairs[a+'+'+b]=valid.filter(c=>pass(c,a)&&pass(c,b)).length;}
 const combinations={};for(const c of valid){const bits=C.CHECK_KEYS.map(k=>pass(c,k)?'1':'0').join('');combinations[bits]=(combinations[bits]||0)+1;}
 const breakoutAge=Object.fromEntries([0,1,2].map(age=>[age,r.candidates.filter(c=>c.breakoutAge===age).length]));
 r.diagnostics={marketTotal:r.universe,excluded:r.excluded.length,eligiblePool:r.eligiblePool,validIndicators:valid.length,independent,pairs,combinations,allPassed:r.candidates.length,breakoutAge,insufficient:r.dataUnavailable,dataErrors:r.failed,serviceFailures:r.serviceFailures,attempted:r.attempted,planned:r.planned,pending:r.pending,deferred:r.deferred,fullMarketCertified:r.fullMarketCertified};
 return r;
}
function text(r){const d=r.diagnostics||{},g=d.independent||{},age=d.breakoutAge||{};return [
 '石頭少爺V9.18｜⑤ 2560戰法｜近3交易日突破續強','最近3個完成交易日曾新突破MA25，最新收盤仍高於MA25，量能及均線持續轉強。',
 '行情 '+r.date+'｜策略 '+C.MODEL,
 '核心：#9041 最近3日曾新突破MA25；最新收盤>MA25；#9012 VMA5>VMA60；#5331 MA5>MA40。四項全通過才入選。',
 '忽略無參數的其他三個均量條件；風險提示不更改入選資格。',
 '全市場 '+r.universe+'｜排除 '+r.excluded.length+'｜可掃描 '+r.eligiblePool+'｜已處理 '+r.attempted+'/'+r.planned+'｜未掃描 '+r.pending+'｜延後 '+r.deferred,
 '已完整計算四項指標 '+(d.validIndicators||0)+'｜獨立通過：近3日突破 '+(g['9041']||0)+'、最新守MA25 '+(g.MA25_HOLD||0)+'、VMA5>VMA60 '+(g['9012']||0)+'、MA5>MA40 '+(g['533']||0),
 '四條共同通過 '+r.candidates.length+'｜距突破0/1/2交易日 '+(age['0']||0)+'/'+(age['1']||0)+'/'+(age['2']||0)+'｜行情不足 '+r.dataUnavailable+'｜資料異常 '+r.failed+'｜其中服務失敗 '+r.serviceFailures,
 '各條規則通過數是獨立統計，不能相加當成候選數；需完整驗證的股票才計入。',
 !r.candidates.length?(r.fullMarketCertified?'今日全市場2560沒有符合四項條件的股票；不表示市場沒有強勢股。':'本輪沒有可確認入選股票，但掃描或資料未完整，不能宣稱全市場0檔。'):'',
 '依代號排序，非強弱排名；不湊滿8檔。',
 ...r.results.flatMap(C.lines)].filter(Boolean).join('\n');}
function snapshot(scan){const s=JSON.parse(JSON.stringify(scan));delete s.snapshotId;s.model=C.MODEL;s.revision=C.REVISION;s.release='V9.18';s.text=text(s);s.snapshotId=C.fingerprint(s);return K.freeze(s);}
function assertSnapshot(s){const {snapshotId,...body}=s||{};if(!snapshotId||s.model!==C.MODEL||s.revision!==C.REVISION||C.fingerprint(body)!==snapshotId)throw Error('2560結果已變更或版本不同，請重新查詢');for(const c of s.candidates){const{id,...a}=c.validation||{};if(!C.qualifies(c)||id!==C.fingerprint(a)||c.date!==s.date||c.validation.signalDate!==c.signalDate||c.validation.breakoutAge!==c.breakoutAge||c.validation.code!==c.code||c.validation.historyFingerprint!==C.fingerprint(c.report?.canonicalBars)||c.validation.checksFingerprint!==C.fingerprint(c.checks))throw Error('2560候選與原始資料不同，停止匯出');const fresh=C.evaluate(c.report,{asOf:c.date,quote:c.validation.quote,sector:c.universe,code:c.code});if(!C.qualifies(fresh)||fresh.signalDate!==c.signalDate||fresh.breakoutAge!==c.breakoutAge||C.fingerprint(fresh.features)!==C.fingerprint(c.features))throw Error('2560候選無法由同一份資料重算通過');}return s;}
async function scan({pool:inputPlan,fetchBatch,requestedMode='all',shouldStop=()=>false,onProgress=()=>{},batchSize=4}){const plan=K.freeze(JSON.parse(JSON.stringify(inputPlan||null)));if(!plan?.date||!Array.isArray(plan.items)||typeof fetchBatch!=='function'||!Number.isInteger(batchSize)||batchSize<1||batchSize>8||new Set(plan.items.map(i=>i.code)).size!==plan.items.length)throw Error('2560掃描參數或代號重複');
 const r={model:C.MODEL,date:plan.date,dataDate:plan.date,createdAt:new Date().toISOString(),profile:'DAILY_ONLY',eventWindow:3,requestedMode,marketSnapshotFingerprint:plan.marketSnapshotFingerprint,marketCoverageReady:plan.marketCoverageReady===true,universe:plan.universe,parsed:plan.parsed,planned:plan.items.length,eligiblePool:plan.eligiblePool,deferred:plan.deferred.length,invalidPool:0,exclusionCounts:plan.exclusions,excluded:plan.excluded,attempted:0,results:[],issues:[],stopped:false,breaker:null};
 for(let i=0;i<plan.items.length;i+=batchSize){if(shouldStop()){r.stopped=true;break;}const part=plan.items.slice(i,i+batchSize);let payload,problem;try{payload=await fetchBatch(part);if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('行情回傳格式錯誤');}catch(e){problem=String(e.message||e);}if(shouldStop()){r.stopped=true;break;}
  for(const item of part){r.attempted++;const hits=(payload?.results||[]).filter(x=>String(x.code||x.data?.stock||'')===item.code),hit=hits.length===1?hits[0]:null;let c;if(problem||!hit?.ok||!hit.data){const reason=problem||hit?.error||'未回傳唯一有效個股';c={model:C.MODEL,code:item.code,name:item.name,date:plan.date,status:'DATA_ERROR',label:C.LABELS.DATA_ERROR,eligible:false,reasons:[reason],serviceFailure:!!problem||hit?.failureCode==='TRANSIENT_SERVICE_ERROR'};r.issues.push({code:item.code,reason});}else try{c=C.evaluate({...hit.data,name:item.name},{asOf:plan.date,code:item.code,quote:item.q,sector:item.sector});}catch(e){c={model:C.MODEL,code:item.code,name:item.name,date:plan.date,status:'DATA_ERROR',label:C.LABELS.DATA_ERROR,eligible:false,reasons:[String(e.message||e)]};}r.results.push(c);}
  finish(r);onProgress(r);
 }finish(r);return snapshot(r);
}
return Object.freeze({pool,scan,finish,snapshot,assertSnapshot,text});
});
