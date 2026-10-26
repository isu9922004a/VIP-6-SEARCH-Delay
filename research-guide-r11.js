/* Read-only R11 explanations. Never feeds eligibility, scores or rankings. */
(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./research-common-v1.js'):r.ShitouResearchCommon);if(typeof module==='object'&&module.exports)module.exports=a;else r.ShitouResearchGuideR11=a;})(globalThis,function(U){
'use strict';
const PARAM=Object.freeze({version:'GUIDE_R11_1',retestBand:.01,heatRSI:75,gapPct:5,wickRatio:.3,volumeConfirm:1.2,contractVolume:.8,consolidationRange:.05,minRewardRisk:1,feeRate:.001425,taxRate:.003,slippageRate:.001});
const LABELS={NOT_BROKEN:'尚未突破',INITIAL:'突破初步成立',RETEST:'突破後回測',CONFIRMED:'回測確認',CONTINUATION:'趨勢延續',FAILED:'突破失敗',HIGH_RANGE:'高檔整理',INSUFFICIENT:'資料不足'};
const finite=Number.isFinite,fmt=n=>finite(n)?String(Number(n.toFixed(2))):'待驗證';
function riskReward(entry,target,invalid,{sourceVerified=false,tickVerified=false,...cost}={}){
 const p={...PARAM,...cost};
 if(![entry,target,invalid].every(x=>finite(x)&&x>0)||!(target>entry&&entry>invalid)||!sourceVerified||!tickVerified||![entry,target,invalid].every(U.legal)||![p.feeRate,p.taxRate,p.slippageRate].every(x=>finite(x)&&x>=0&&x<1))return {status:'資料不足',ratio:null,text:'尚無足夠條件計算報酬風險比。'};
 const reward=target-entry-entry*(p.feeRate+p.slippageRate)-target*(p.feeRate+p.taxRate+p.slippageRate),risk=entry-invalid+entry*(p.feeRate+p.slippageRate)+invalid*(p.feeRate+p.taxRate+p.slippageRate);
 return {status:reward>0?'可試算':'未符合',entry,target,invalidation:invalid,rewardPct:reward/entry*100,riskPct:risk/entry*100,ratio:reward/risk,costs:{feeRate:p.feeRate,taxRate:p.taxRate,slippageRate:p.slippageRate},text:`假設進場 ${fmt(entry)}、壓力參考 ${fmt(target)}、研究失效 ${fmt(invalid)}；含手續費、賣出稅及雙邊滑價，報酬風險比 ${fmt(reward/risk)}：1。不是勝率，停損不保證成交於指定價。`};
}
// Forward-only event machine. Each candidate uses the preceding 20 completed bars.
// A later retest session and a further reclaim session are both mandatory.
function phase(b,{volumeReliable=false,parameters=PARAM}={}){
 const p={...PARAM,...parameters};let event=null,transitions=[];
 for(let i=20;i<b.length;i++){
  const z=b[i],prior=b.slice(i-20,i),resistance=Math.max(...prior.map(x=>x.high));
  if(event){
   if(z.close<event.invalidation){event.state='FAILED';event.failedAt=z.date;}
   else if(event.state!=='FAILED'){
    if(z.close<event.price){event.state='FAILED';event.failedAt=z.date;}
    else if(i>event.index&&z.low<=event.price*(1+p.retestBand)&&z.high>=event.price*(1-p.retestBand)){
     if(!event.retest){event.retest={index:i,date:z.date,high:z.high,low:z.low,volume:z.volume};event.state='RETEST';}
    }
    const avg=U.mean(b.slice(i-5,i).map(x=>x.volume));
    if(event.retest&&i>event.retest.index&&z.close>event.retest.high&&z.close>b[i-1].close&&volumeReliable&&avg>0&&z.volume>=avg*p.volumeConfirm){event.state='CONFIRMED';event.confirmedAt=z.date;}
    else if(event.state==='INITIAL'&&i-event.index>=2){const m20=U.ma(b,20,i),m60=U.ma(b,60,i),old=U.ma(b,20,i-3);if(m60!==null&&old>0&&z.close>m20&&m20>m60&&m20>old&&volumeReliable&&z.close>b[i-1].close)event.state='CONTINUATION';}
   }
  }
  // A failed episode stays visible that day; a new episode can begin later.
  if((!event||event.state==='FAILED'&&event.failedAt<z.date)&&z.close>resistance){event={index:i,date:z.date,price:resistance,invalidation:Math.min(...prior.map(x=>x.low)),state:'INITIAL',retest:null};}
  if(event&&transitions.at(-1)?.state!==event.state)transitions.push({date:z.date,state:event.state,price:event.price});
 }
 if(b.length<21)return {state:'INSUFFICIENT',label:LABELS.INSUFFICIENT,event:null,transitions};
 let state=event?.state||'NOT_BROKEN';
 const z=b.at(-1),last=b.slice(-5),high=Math.max(...b.slice(-60).map(x=>x.high)),lo=Math.min(...last.map(x=>x.low)),hi=Math.max(...last.map(x=>x.high));
 if(!['FAILED','RETEST','CONFIRMED','INITIAL'].includes(state)&&b.length>=60&&z.close>=high*.95&&lo>0&&(hi-lo)/lo<=p.consolidationRange)state='HIGH_RANGE';
 return {state,label:LABELS[state],event,transitions};
}
function evaluate(a,input){
 const r=U.normalizeInput(input),n=U.validate(r),c=a.tradeContext;
 if(!n.ok||!a.features||!c)return U.freeze({version:PARAM.version,phase:{state:'INSUFFICIENT',label:LABELS.INSUFFICIENT},decision:'無法判定',validationStatus:'資料不足',summary:'行情資料不足或驗證不通過，先補齊資料再評估。',levels:[],risks:[],scenarios:[],holding:{enabled:false,text:'未提供持股成本，僅提供一般技術風險參考'},alert:{state:'尚未設定提醒',text:'尚未設定提醒；未啟用監控。'}});
 const b=n.bars,z=b.at(-1),f=a.features,provenance=c.provenance;
 const volumeReliable=!provenance.volumeConflict&&n.calendarVerified===true&&n.basisVerified===true&&provenance.volumeBasis!=='UNKNOWN'&&!!provenance.retrievedAt;
 const quality=provenance.volumeConflict?'來源衝突':n.calendarVerified&&n.basisVerified&&volumeReliable?'已驗證':'部分待驗';
 const marketPhase=n.calendarVerified&&n.basisVerified?phase(b,{volumeReliable}):{state:'INSUFFICIENT',label:LABELS.INSUFFICIENT,event:null,transitions:[]};
 const e=marketPhase.event,breakPrice=e?.price??f.prior20High,broken=finite(breakPrice)&&z.close>breakPrice;
 const invalid=finite(e?.invalidation)?e.invalidation:a.researchInvalidation;
 const level=(role,value,formula,status='已驗證')=>({role,value:U.num(value),formula,source:a.dataSource||provenance.source,date:a.date,snapshotId:a.sourceSnapshotId,status:finite(value)?status:'資料不足'});
 const levels=[level('近期突破價',breakPrice,e?'突破事件日前20根最高價，固定追蹤':'前20根最高價，不含當日',broken?'已突破，後續觀察是否守穩':'尚未突破'),level('突破後支撐觀察價',broken?breakPrice:null,'原突破價；需後續回測及轉強驗證',marketPhase.state==='CONFIRMED'?'已驗證':'待驗證'),level('當日最高價',z.high,'當日完成日K high；不是已確認的長期壓力'),level('短線突破觀察價',z.high,'當日高點；後續收盤及量價待確認','待驗證'),level('前波高點壓力',c.prior60,'前60根完成日K最高價，不含當日'),level('MA20均線參考',f.ma[20].value,'同一日K序列20日收盤均值；不保證支撐有效'),level('MA60均線參考',f.ma[60].value,'同一日K序列60日收盤均值；不保證支撐有效'),level('原策略B關鍵價',a.originalB,'沿用原策略獨立提供的價位',a.priceLevels?.originalB?.verified?'已驗證':'待驗證'),level('原策略失效價',a.originalInvalidation,'沿用原策略獨立失效規則',a.priceLevels?.originalInvalidation?.verified?'已驗證':'待驗證'),level('結構失效參考價',invalid,'突破事件前20日最低價；無事件時沿用研究失效價，收盤跌破失效'),level('最近低點觀察價',z.low,'當日低點，尚未確認為有效波段低點','待驗證')];
 const risk=(id,value,trigger)=>({id,value,status:value===null?'資料不足':trigger===null?'條件待驗':trigger?'已觸發風險':'尚未觸發'});
 const risks=[risk('RSI5短線偏熱',f.rsi5,finite(f.rsi5)?f.rsi5>=PARAM.heatRSI:null),risk('MA20正乖離',c.ma20GapPct,finite(c.ma20GapPct)?c.ma20GapPct>=PARAM.gapPct:null),risk('上影線占振幅',f.candle.upperRatio,finite(f.candle.upperRatio)?f.candle.upperRatio>=PARAM.wickRatio:null),risk('放量收盤回落',c.volumeRatioPrior5,volumeReliable?c.volumeRatioPrior5>=2&&f.candle.closeLocation<=.5:null),risk('量價背離',c.volumeRatioPrevious,volumeReliable?b.length>=6&&z.close> b.at(-6).close&&c.volumeRatioPrior5<1:null)];
 const pressure=levels.filter(x=>x.role==='前波高點壓力'&&x.status==='已驗證'&&x.value>z.close).sort((x,y)=>x.value-y.value)[0];
 const rr=riskReward(z.close,pressure?.value,invalid,{sourceVerified:quality==='已驗證',tickVerified:r.tickRuleVerified===true&&r.securityType==='COMMON'});
 const hot=risks.slice(0,2).some(x=>x.status==='已觸發風險'),failed=marketPhase.state==='FAILED',confirmed=marketPhase.state==='CONFIRMED';
 const decision=marketPhase.state==='INSUFFICIENT'||quality==='來源衝突'?'無法判定':failed||rr.ratio!==null&&rr.ratio<PARAM.minRewardRisk?'暫避':confirmed&&!hot&&rr.ratio>=PARAM.minRewardRisk?'條件符合':broken||finite(breakPrice)&&z.close>=breakPrice*.97?'觀察':'等待';
 const scenario=(type,price,status,conditions,invalidation,reason)=>({type,price,status,conditions,invalidation,reason,risk:'需確認量價、RSI與乖離、上影線及下一道壓力空間；研究失效不是個人停損。'});
 const scenarios=[scenario('回測確認型',breakPrice,!broken?'不適用':failed?'未符合':confirmed?'目前已符合':e?.retest?'待確認':'尚未符合',`突破後另日回測 ${fmt(breakPrice)} 附近（±1%），收盤守住；再於後續交易日收高於回測日高點及前日收盤，成交量至少前5日均量1.2倍且口徑已驗證。`,`收盤低於 ${fmt(breakPrice)} 為突破失守；低於 ${fmt(invalid)} 為結構失效。`,!broken?'尚未收盤突破，無法預先宣稱回測成功':!e?.retest?'尚未發生後續回測':'須分別核對支撐與再轉強'),scenario('突破確認型',pressure?.value??z.high,pressure?'待確認':'不適用',`收盤突破 ${fmt(pressure?.value??z.high)}，量至少前5日均量1.2倍，RSI5低於75、MA20正乖離低於5%、上影占振幅低於30%，且另有可驗證的上方壓力與報酬風險比至少1。`,`突破後收盤失守突破價須重新評估。`,pressure?'目前尚未收盤突破此壓力；下一道壓力空間仍待確認':'僅有當日高點，缺已驗證的上方壓力，不建立正式突破情境')];
 const check=(name,value)=>({name,status:value===null?'待驗證':value?'符合':'未符合'});
 scenarios[0].checks=[check('突破價有歷史來源',finite(breakPrice)),check('已收盤突破',broken),check('後續交易日發生回測',!!e?.retest),check('未收盤失守突破與結構失效價',e?!failed:null),check('回測後另日重新轉強',confirmed),check('成交量口徑已驗證',volumeReliable?true:null),check('報酬風險比至少1',rr.ratio===null?null:rr.ratio>=PARAM.minRewardRisk)];
 const avg=f.volumePrior5;
 scenarios[1].checks=[check('上方壓力有歷史來源',!!pressure),check('收盤有效突破觀察壓力',pressure?z.close>pressure.value:null),check('量能確認',volumeReliable&&avg>0?z.volume>=avg*PARAM.volumeConfirm:null),check('RSI與乖離未達偏熱門檻',finite(f.rsi5)&&finite(c.ma20GapPct)?!hot:null),check('無明顯上影線',finite(f.candle.upperRatio)?f.candle.upperRatio<PARAM.wickRatio:null),check('下一道壓力空間足夠',null),check('報酬風險比至少1',rr.ratio===null?null:rr.ratio>=PARAM.minRewardRisk)];
 if(scenarios[0].status==='目前已符合'&&scenarios[0].checks.some(x=>x.status!=='符合'))scenarios[0].status=scenarios[0].checks.some(x=>x.status==='待驗證')?'待確認':'未符合';
 const down=finite(breakPrice)?z.low<breakPrice&&z.close>=breakPrice?'盤中跌破後收盤重新站回':z.close<breakPrice?'收盤低於突破參考':z.low<breakPrice?'盤中短暫跌破':'尚未跌破突破參考':'資料不足';
 const holdingInput=r.holding,holdingValid=holdingInput&&finite(holdingInput.cost)&&holdingInput.cost>0&&Number.isInteger(holdingInput.shares)&&holdingInput.shares>0&&finite(holdingInput.maxLoss)&&holdingInput.maxLoss>0&&typeof holdingInput.horizon==='string'&&holdingInput.horizon.trim();
 const holding=holdingValid?{enabled:true,unrealized:(z.close-holdingInput.cost)*holdingInput.shares,scenarioLoss:Math.max(0,(holdingInput.cost-invalid)*holdingInput.shares),text:`持股 ${holdingInput.shares} 股、成本 ${fmt(holdingInput.cost)}；收盤失守 ${fmt(breakPrice)} 應重新評估，結構失效 ${fmt(invalid)}。依可承受損失 ${fmt(holdingInput.maxLoss)} 元及交易週期 ${holdingInput.horizon} 評估減碼；不自動設定個人停損。`}:{enabled:false,text:holdingInput?'持股資料不足，需成本、股數、可承受損失與交易週期；僅提供一般技術風險參考':'未提供持股成本，僅提供一般技術風險參考'};
 const alert={state:'尚未設定提醒',text:`尚未設定提醒；預設漲跌幅 ${a.foundation?.alertPlan?.dayGainPercentInput??5}%／${a.foundation?.alertPlan?.dayLossPercentInput??5}% 僅供手動設定，未啟用監控。`};
 const summary=decision==='無法判定'?'資料不足或來源待核對，暫無法判定進場條件。':decision==='暫避'?`目前${marketPhase.label}，先重新評估結構與報酬風險。`:`目前${marketPhase.label}${hot?'，短線偏熱仍有追價風險':''}。${confirmed?'回測條件已確認，仍需評估交易風險':`先觀察 ${fmt(breakPrice)} 是否守穩，等待後續確認，不單憑突破追價`}。`;
 return U.freeze({version:PARAM.version,parameters:PARAM,phase:marketPhase,decision,validationStatus:quality,provenance:{...provenance,snapshotId:a.sourceSnapshotId,market:r.market,calendarVerified:!!n.calendarVerified,priceBasisVerified:!!n.basisVerified},levels,risks,scenarios,rewardRisk:rr,holding,alert,downside:`${down}；收盤跌破 ${fmt(invalid)} 才符合本研究結構失效規則。支撐觀察價不是個人停損。`,upside:`當日高點 ${fmt(z.high)} 僅供短線突破觀察；前波壓力 ${fmt(c.prior60)}。接近壓力需看量、收盤位置與上影線，不能預設必達。`,summary,volumeReliable});
}
return Object.freeze({PARAM,LABELS,phase,riskReward,evaluate});
});
