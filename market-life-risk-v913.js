/* V9.13 market state research: wraps tested V9.10 four levels without altering historical K events. */
(function(root,factory){
 const node=typeof module==='object'&&!!module.exports;
 const api=factory(node?require('./market-life-risk-v910.js'):root.ShitouMarketLifeRisk910);
 if(node)module.exports=api;else root.ShitouMarketLifeRisk913=api;
})(globalThis,function(Base){
 'use strict';
 if(!Base||typeof Base.evaluate!=='function')throw Error('V9.13 需要 V9.10 大盤風險核心');
 const VERSION='MARKET_LIFE_RISK_V913';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
 const ma=(bars,n,at=bars.length-1)=>at+1>=n?bars.slice(at+1-n,at+1).reduce((a,b)=>a+b.close,0)/n:null;
 function evaluate(study,opts={}){
  const base=Base.evaluate(study,opts),bars=study.validatedBars,at=bars.length-1,last=bars[at],ma5=ma(bars,5),ma10=ma(bars,10),ma20=ma(bars,20),ma5prev=ma(bars,5,at-1);
  const under=last.close<ma5&&last.close<ma20,falling=ma5<ma5prev;
  // Three to five completed bars give context; current shock is independent of past shocks.
  const shocks=[];
  for(let i=Math.max(15,at-4);i<=at;i++){
   const slice=bars.slice(0,i+1),v=Base.atr(slice),prev=bars[i-1],now=bars[i];
   const normalized=finite(v)&&v>0?(prev.close-now.close)/v:0;
   if(normalized>=1.4&&now.close<prev.close)shocks.push({date:now.date,atrMultiple:Number(normalized.toFixed(2))});
  }
  const currentShock=base.risk.level===4,priorShock=shocks.some(s=>s.date!==last.date);
  const weakBars=bars.slice(-5).filter(b=>b.close<(ma20||Infinity)).length;
  const recentLow=bars.slice(-5).map(b=>b.low);
  const decliningLows=recentLow.length>=3&&recentLow.at(-1)<Math.min(...recentLow.slice(0,-1));
  let state='NORMAL_OR_UNCONFIRMED',label='多空尚待確認',reason='未達足夠條件，不能判定市場已經恢復正常。';
  if(currentShock){state='ACTIVE_SHOCK';label='當日急跌風險';reason='今日完成日跌幅達到原風險模型的波動門檻。';}
  else if(under&&(priorShock||base.risk.level>=3||weakBars>=4)&&falling){state='POST_SHOCK_WEAKNESS';label='弱勢仍在延續';reason='近期偏弱，指數收盤低於 MA5、MA20，不能因今天跌幅較小就說風險解除。';}
  else if(last.close>bars[at-1].close&&last.close<ma20){state='REBOUND_ATTEMPT';label='反彈嘗試，尚未轉強';reason='收盤回升但仍在中期均線下方，不等於已確認反轉。';}
  else if(last.close>ma5&&last.close>ma20&&ma5>=ma10&&ma5>=ma5prev&&base.risk.level===1){state='RECOVERY_CONFIRMED';label='完成日條件顯示改善';reason='收盤、均線方向與原風險分級一致；仍不代表未來保證上漲。';}
  const phase={state,label,reason,previousShocks:shocks,weakClosesBelow20:weakBars,fallingShortMA:falling,newFiveDayLow:decliningLows,confirmedAt:last.date};
  const explain=state==='POST_SHOCK_WEAKNESS'?'目前仍在弱勢階段，不是一般盤整。':state==='ACTIVE_SHOCK'?'今日波動異常，先確認收盤結構。':reason;
  const scenarios=base.scenarios.map(s=>({...s,text:s.id==='B'&&['POST_SHOCK_WEAKNESS','ACTIVE_SHOCK'].includes(state)?'目前市場已經偏弱，不能單純稱為盤整；需等待收盤重新站回重要關卡與均線。':s.text}));
  return freeze({...base,version:VERSION,phase,risk:{...base.risk,phaseLabel:label,plainExplanation:explain},scenarios,sourceRiskVersion:base.version,sourceRiskLevel:base.risk.level,researchOnly:true,performanceValidated:false});
 }
 return Object.freeze({VERSION,evaluate});
});