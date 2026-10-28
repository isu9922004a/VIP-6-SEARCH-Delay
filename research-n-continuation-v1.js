/* Read-only N research. Confirmed pivots are usable only on knownAt, never on their earlier pivot date. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon,node?require('./structure-context-v1.js'):root.ShitouStructureContext);if(node)module.exports=api;else root.ShitouNContinuation=api;})(globalThis,function(U,S){
'use strict';
const VERSION='N_EQUAL_CONTINUATION_8_2_3',PARAM=Object.freeze({pivotLeft:3,pivotRight:3,zoneATR:.25,volume:1.2,minRR:1.5,maxStopPct:8,minSpacePct:2,fee:.001425,feeDiscount:1,tax:.003,slippage:.001});
const LABELS=Object.freeze({NOT_FORMED:'尚未找到可核驗N字',AB_CONFIRMED:'首波A/B已確認，等待回調',C_CANDIDATE:'C低點候選，尚未確認',C_CONFIRMED:'C已確認，尚未突破B',WAIT_NEW_C:'原C計畫失效，等待新C',BREAKOUT_CONFIRMED:'已收盤突破B',RETEST_PENDING:'突破後回測待確認',RETEST_CONFIRMED:'突破後回測已確認',RETEST_FAILED:'回測計畫已失效',PROJECTION_TOUCHED:'等幅投射曾觸及，非獲利認定',INVALIDATED:'A結構已失效',AMBIGUOUS:'同根K觸及投射與失效，先後不明'});
const finite=Number.isFinite,plain=x=>JSON.parse(JSON.stringify(x));
function price(raw,direction=-1){if(!(finite(raw)&&raw>0))return null;const cents=direction<0?Math.floor(raw*100+1e-7):Math.ceil(raw*100-1e-7);for(let i=0;i<=600;i++){const p=(cents+direction*i)/100;if(p>0&&U.legal(p))return p;}return null;}
function pivots(b,p=PARAM){const out=[];for(let i=p.pivotLeft;i+p.pivotRight<b.length;i++){
 const w=b.slice(i-p.pivotLeft,i+p.pivotRight+1);for(const [type,key,fn] of [['LOW','low',Math.min],['HIGH','high',Math.max]])if(b[i][key]===fn(...w.map(x=>x[key]))&&w.filter(x=>x[key]===b[i][key]).length===1)out.push({type,index:i,price:b[i][key],pivotDate:b[i].date,knownAtIndex:i+p.pivotRight,knownAt:b[i+p.pivotRight].date});
 }return out.sort((a,b)=>a.knownAtIndex-b.knownAtIndex||a.index-b.index);}
function snapshots(b,pv,code){const seq=[],out=[],ids=new Set();for(const x of pv){
 const last=seq.at(-1);if(last?.type===x.type){if(x.type==='HIGH'?x.price<=last.price:x.price>=last.price)continue;seq[seq.length-1]=x;}else seq.push(x);
 if(seq.length<3||x.type!=='LOW')continue;const [A,B,C]=seq.slice(-3);if(A.type!=='LOW'||B.type!=='HIGH'||!(A.index<B.index&&B.index<C.index&&A.price<C.price&&C.price<B.price))continue;
 const id=[VERSION,code,A.pivotDate,B.pivotDate,C.pivotDate,C.knownAt].join('|');if(ids.has(id))continue;
 ids.add(id);const previous=out.filter(y=>y.A.pivotDate===A.pivotDate&&y.B.pivotDate===B.pivotDate).at(-1);out.push({id,parentId:previous?.id||null,A:{...A},B:{...B},C:{...C},knownAt:C.knownAt,knownAtIndex:C.knownAtIndex,provisional:false});
 }return {records:out,sequence:seq};}
function planPath(b,entryIndex,stop,target){if(!(stop>0&&target>stop)||!Number.isInteger(entryIndex))return {status:'UNKNOWN',date:null};for(let i=entryIndex+1;i<b.length;i++){
 const loss=b[i].low<=stop,hit=b[i].high>=target;if(loss&&hit)return {status:'AMBIGUOUS',date:b[i].date,note:'日K無法判定先停損或先觸及投射，不計為獲利'};if(loss)return {status:'STOP_TOUCHED',date:b[i].date};if(hit)return {status:'TARGET_TOUCHED',date:b[i].date,note:'只描述價格觸及，不代表已按該價成交'};
 }return {status:'OPEN',date:null};}
function rewardRisk(entry,stop,target,p=PARAM){if(!(finite(entry)&&finite(stop)&&finite(target)&&0<stop&&stop<entry&&target>entry))return {status:'UNKNOWN',grossRR:null,rr:null};
 const fee=p.fee*p.feeDiscount;if([fee,p.tax,p.slippage].some(x=>!finite(x)||x<0||x>=.1))return {status:'UNKNOWN',grossRR:null,rr:null};
 const buy=entry*(1+p.slippage)*(1+fee),sell=n=>n*(1-p.slippage)*(1-fee-p.tax),risk=buy-sell(stop),reward=sell(target)-buy;
 return {status:reward>0&&risk>0?'KNOWN':'BLOCKED',entry,stop,target,grossRR:(target-entry)/(entry-stop),rr:risk>0?reward/risk:null,riskPerShare:risk,rewardPerShare:reward,stopPct:(entry-stop)/entry*100,spacePct:(target/entry-1)*100,costs:{fee,tax:p.tax,slippage:p.slippage},assumption:'以本日完成收盤作假設成交價；未含個人部位設定'};
}
function lifecycle(snapshot,b,p){const x=plain(snapshot),AB=x.B.price-x.A.price,atr=U.atr(b.slice(0,x.knownAtIndex+1)),tolerance=finite(atr)&&atr>0?atr*p.zoneATR:U.tick(x.B.price),threshold=U.step(price(x.B.price,1),1);
 const projection=x.C.price+AB,stopC=price(x.C.price-tolerance,-1);let stage=x.provisional?'C_CANDIDATE':'C_CONFIRMED',breakout=null,retest=null,projectionTouched=null,invalidatedAt=null;
 for(let i=x.knownAtIndex;i<b.length;i++){const z=b[i];
  if(z.low<=x.A.price&&z.high>=projection){stage='AMBIGUOUS';invalidatedAt=z.date;break;}
  if(z.low<=x.A.price){stage='INVALIDATED';invalidatedAt=z.date;break;}
  if(!breakout){if(z.low<x.C.price&&i>x.knownAtIndex){stage='WAIT_NEW_C';invalidatedAt=z.date;break;}if(!x.provisional&&threshold!==null&&z.close>=threshold){breakout={index:i,date:z.date,close:z.close,threshold};stage='BREAKOUT_CONFIRMED';}else continue;}
  if(z.high>=projection){projectionTouched=projectionTouched||z.date;}
  if(i<=breakout.index)continue;
  if(z.low<x.C.price){stage='WAIT_NEW_C';invalidatedAt=z.date;break;}
  if(retest&&retest.status!=='INVALIDATED'&&(z.close<x.B.price-tolerance||z.low<retest.low-tolerance)){retest.status='INVALIDATED';retest.invalidatedAt=z.date;stage='RETEST_FAILED';break;}
  if(retest?.status==='PENDING'&&i>retest.index&&z.close>b[i-1].high&&z.close>=threshold){retest.status='CONFIRMED';retest.confirmedAt=z.date;retest.confirmedIndex=i;stage='RETEST_CONFIRMED';}
  if(!retest&&z.low<=x.B.price+tolerance&&z.low>=x.B.price-tolerance&&z.close>=x.B.price){retest={index:i,date:z.date,low:z.low,knownAt:z.date,status:'PENDING',stop:price(z.low-tolerance,-1),confirmedAt:null};stage='RETEST_PENDING';}
 }
 if(projectionTouched&&!['INVALIDATED','AMBIGUOUS','WAIT_NEW_C','RETEST_FAILED'].includes(stage))stage='PROJECTION_TOUCHED';
 return {...x,stage,label:LABELS[stage],AB,retracementPct:(x.B.price-x.C.price)/AB*100,commonRetracementBand:x.C.price<=x.B.price-AB*.382&&x.C.price>=x.B.price-AB*.618,tolerance,breakoutThreshold:threshold,projection:{price:projection,multiplier:1,kind:'UNVALIDATED_MEASURED_PROJECTION',basedOnKnownAt:x.knownAt,countsAsVerifiedResistance:false},stopC,breakout,retest,projectionTouched,invalidatedAt,historicalBreakoutObservation:breakout?planPath(b,breakout.index,stopC,projection):{status:'UNKNOWN',date:null}};
}
function cases(pattern,b,levels,gates,p){const z=b.at(-1),prev=b.at(-2),q=pattern,dead=['INVALIDATED','AMBIGUOUS','WAIT_NEW_C','RETEST_FAILED','PROJECTION_TOUCHED'].includes(q.stage),target=levels.find(x=>x.price>z.close)?.price??null;
 const definitions=[{id:'C_OBSERVATION',label:'C點止跌觀察',stop:q.provisional?null:q.stopC,signal:q.provisional?'PENDING_CONFIRMATION':!q.breakout&&prev&&z.close>prev.high&&z.close<q.B.price?'CONFIRMED':'WAIT_TRIGGER',rule:'C已到確認日，完成收盤收復前日高點且尚未越過B；這是日K研究，不冒充小週期止跌'},
 {id:'BREAKOUT',label:'收盤突破B',stop:q.provisional?null:q.stopC,signal:q.breakout&&z.close>=q.breakoutThreshold?'CONFIRMED':'WAIT_TRIGGER',rule:'C確認日以後，完成收盤高於固定B並達合法跳動緩衝；保留既有量能與風險核驗'},
 {id:'RETEST',label:'突破後回測B',stop:q.retest?.status==='CONFIRMED'?q.retest.stop:null,signal:q.retest?.status==='CONFIRMED'&&z.close>=q.breakoutThreshold?'CONFIRMED':q.retest?'PENDING_CONFIRMATION':'WAIT_TRIGGER',rule:'突破後另一根完成K回測B帶，再有後續完成收盤收復前日高點；未形成回測低點就不提供停損或R/R'}];
 return definitions.map(d=>{const rr=rewardRisk(z.close,d.stop,target,p),projectionRR=rewardRisk(z.close,d.stop,q.projection.price,p),missing=[];
  if(!gates.priceBasisVerified)missing.push('價格口徑');if(!gates.calendarVerified)missing.push('交易日曆');if(!gates.volumeUsable)missing.push('量能來源／口徑');if(!gates.tickRuleVerified)missing.push('交易跳動規則');if(!d.stop)missing.push('情境防守');if(!target)missing.push('上方可核驗關卡');
  const volumeReady=d.id==='C_OBSERVATION'?!!prev&&z.volume>prev.volume:gates.volumeRatio5>=p.volume,unmetConditions=volumeReady?[]:[d.id==='C_OBSERVATION'?'止跌後量能尚未較前日改善':'當日量／前5日均量未達研究參數 '+p.volume+' 倍'];
  const signal=dead?'INVALIDATED':d.signal,blocked=dead||rr.status==='BLOCKED'||rr.status==='KNOWN'&&(rr.rr<p.minRR||rr.stopPct>p.maxStopPct||rr.spacePct<p.minSpacePct),decision=blocked?'DO_NOT_ENTER':missing.length?'CANNOT_EVALUATE':signal==='CONFIRMED'&&volumeReady?'CONDITIONAL_RESEARCH':'WAIT';
  return {...d,signalStatus:signal,entryAssumption:z.close,entryDate:z.date,planStop:d.stop,nearestVerifiedBarrier:target,structuralInvalidation:q.A.price,riskReward:rr,projectionScenarioRR:{...projectionRR,targetKind:q.projection.kind,usedForEligibility:false},missingEvidence:missing,unmetConditions,entryDecision:decision,positionSize:null,note:'投射R/R與最近關卡R/R分開；未驗證勝率，並非下單指令'};
 });
}
function evaluate(input,options={}){const r=U.normalizeInput(input),p={...PARAM,...options.parameters};if(options.enabled===false)return U.freeze({version:VERSION,state:'DISABLED',stage:'DISABLED',label:'N字研究已關閉',cases:[]});
 if(!Number.isInteger(p.pivotLeft)||!Number.isInteger(p.pivotRight)||p.pivotLeft<1||p.pivotRight<1||p.pivotLeft>20||p.pivotRight>20)return U.freeze({version:VERSION,state:'DATA_INSUFFICIENT',label:'N字端點參數無效',cases:[]});
 const n=U.validate(r);if(!n.ok||n.bars.length<Math.max(15,p.pivotLeft+p.pivotRight+4))return U.freeze({version:VERSION,state:'DATA_INSUFFICIENT',label:'N字日K待核驗',reason:n.reason||'完成日K不足',cases:[]});
 const b=n.bars,z=b.at(-1),pv=pivots(b,p),book=snapshots(b,pv,String(r.stock)),all=book.records.map(x=>lifecycle(x,b,p));let pattern=all.at(-1)||null;
 const seq=book.sequence,last2=seq.slice(-2),ab=last2.length===2&&last2[0].type==='LOW'&&last2[1].type==='HIGH'?last2:null;
 if(ab){const [A,B]=ab,after=b.slice(B.index+1);if(after.length){const min=Math.min(...after.map(x=>x.low)),index=b.findIndex((x,i)=>i>B.index&&x.low===min);if(min>A.price&&min<B.price&&(!pattern||index>pattern.C.index))pattern=lifecycle({id:[VERSION,r.stock,A.pivotDate,B.pivotDate,'CANDIDATE'].join('|'),parentId:null,A:{...A},B:{...B},C:{type:'LOW',price:min,index,pivotDate:b[index].date,knownAt:null,knownAtIndex:null},knownAt:z.date,knownAtIndex:b.length-1,provisional:true},b,p);}}
 const levels=[];const add=(value,source)=>{if(finite(value)&&value>z.close&& !levels.some(x=>Math.abs(x.price-value)<1e-8))levels.push({price:value,source,kind:'OBSERVED_REFERENCE'});};
 for(const k of [5,10,20,60])add(U.ma(b,k),'MA'+k);for(const x of pv)add(x.price,'已確認波段'+(x.type==='HIGH'?'高點':'低點'));if(b.length>20)add(Math.max(...b.slice(-21,-1).map(x=>x.high)),'前20日高點');if(b.length>60)add(Math.max(...b.slice(-61,-1).map(x=>x.high)),'前60日高點');if(r.originalBVerified===true)add(U.num(r.originalB),'原策略已核驗B價');if(U.geometry(z).upperRatio>=.25)add(z.high,'當日上影高點');levels.sort((a,b)=>a.price-b.price);
 const volume=S.volume(b,r),gates={priceBasisVerified:!!n.basisVerified,calendarVerified:!!n.calendarVerified,volumeUsable:volume.usable===true,volumeRatio5:volume.ratio5,tickRuleVerified:r.tickRuleVerified!==false&&(r.tickRuleVerified===true||['COMMON','COMMON_STOCK','ORDINARY'].includes(String(r.securityType||'')))},stage=pattern?.stage||(ab?'AB_CONFIRMED':'NOT_FORMED');
 const latest3=seq.slice(-3),inverse=latest3.length===3&&latest3[0].type==='HIGH'&&latest3[1].type==='LOW'&&latest3[2].type==='HIGH'&&latest3[2].price<latest3[0].price&&latest3[2].price>latest3[1].price?{stage:z.close<latest3[1].price?'BREAKDOWN_CONFIRMED':'FORMING',points:latest3.map(x=>({...x})),note:'反N僅作多方風險觀察，非放空指令'}:null;
 const entries=pattern?cases(pattern,b,levels,gates,p):[],start=Math.max(0,b.length-120),chartBars=b.slice(start).map((x,i)=>({...x,index:start+i,ma5:U.ma(b,5,start+i),ma20:U.ma(b,20,start+i),ma60:U.ma(b,60,start+i)}));
 return U.freeze({version:VERSION,state:'RESEARCH_ONLY',code:r.stock,date:z.date,sourceSnapshotId:r.dailyBasisV2?.fingerprint||U.hash(b),stage,label:LABELS[stage],pattern,cases:entries,inverse,gates,levels,history:all.slice(-12).map(x=>({id:x.id,parentId:x.parentId,A:x.A,B:x.B,C:x.C,knownAt:x.knownAt,stage:x.stage,invalidatedAt:x.invalidatedAt})),parameters:p,chart:{bars:chartBars,patterns:[],levels,trigger:pattern?.B.price??null,invalidation:null,defenseReference:pattern?.C.price??null,nextResistance:levels[0]||null,volume,priceBasis:r.priceAdjustment?.basis||'UNKNOWN',basisVerified:!!n.basisVerified,calendarVerified:!!n.calendarVerified},affectsOriginalEligibility:false,affectsOriginalScore:false,affectsOriginalRanking:false,performanceValidated:false,note:'獨立等幅1.0研究；不取代既有Fibonacci 1.618或前三高戰術N；38.2%–61.8%僅描述回撤，非硬濾網'});
}
return Object.freeze({VERSION,PARAM,LABELS,price,pivots,snapshots,planPath,rewardRisk,lifecycle,cases,evaluate});
});
