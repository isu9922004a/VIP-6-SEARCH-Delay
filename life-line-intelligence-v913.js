/* V9.13 stock life-line intelligence. The V9.2 K3-K0 detector stays immutable. */
(function(root,factory){
 const node=typeof module==='object'&&!!module.exports;
 const api=factory();
 if(node)module.exports=api;else root.ShitouLifeIntelligence913=api;
})(globalThis,function(){
 'use strict';
 const VERSION='LIFE_INTELLIGENCE_V913';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const fmt=n=>finite(n)?n.toFixed(2):'未確認';
 const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
 function evaluate(study,{market=null,securityMarket=null}={}){
  if(!study||!Array.isArray(study.validatedBars)||!study.validatedBars.length||!Array.isArray(study.events))throw Error('缺少已驗證的完成日日K與生命線事件');
  const bars=study.validatedBars,date=study.dataAsOf||study.date,latest=bars.at(-1);
  if(!date||latest.date!==date||latest.close!==study.close||bars.some((b,i)=>b.date>date||(i&&b.date<=bars[i-1].date)))throw Error('個股行情日期或收盤不一致');
  const byDate=new Map(bars.map(b=>[b.date,b])),events=study.events.map(e=>{
   const k3=byDate.get(e.k3Date);
   if(!k3||!['BULL','BEAR'].includes(e.side)||e.k0Date>date||e.signalDate>date)throw Error('生命線K3或K0日期資料不一致');
   const expected=e.side==='BULL'?k3.low:k3.high;
   if(!finite(e.lifeLinePrice)||Math.abs(expected-e.lifeLinePrice)>1e-7)throw Error('生命線與K3原始價格不一致：'+e.eventId);
   return e;
  });
  const supports=events.filter(e=>!e.referenceOnly&&e.currentRole==='SUPPORT'&&e.lifeLinePrice<=latest.close).sort((a,b)=>latest.close-a.lifeLinePrice-(latest.close-b.lifeLinePrice)||b.k0Index-a.k0Index);
  const resistances=events.filter(e=>!e.referenceOnly&&e.currentRole==='RESISTANCE'&&e.lifeLinePrice>=latest.close).sort((a,b)=>a.lifeLinePrice-b.lifeLinePrice||b.k0Index-a.k0Index);
  const activeSupportEvent=supports[0]||null,activeResistanceEvent=resistances[0]||null;
  const historicalReferenceEvents=events.filter(e=>e.referenceOnly||e.currentRole==='HISTORICAL_REFERENCE'||e.currentRole==='SUPPORT'&&e.lifeLinePrice>latest.close||e.currentRole==='RESISTANCE'&&e.lifeLinePrice<latest.close);
  const selectedPrimaryEvent=study.event||null;
  if(selectedPrimaryEvent&&!events.some(e=>e.eventId===selectedPrimaryEvent.eventId))throw Error('主要事件不屬於經核對的事件紀錄');
  const ma5=study.currentTrend?.ma5,ma10=study.currentTrend?.ma10,ma20=study.currentTrend?.ma20;
  const above5=finite(ma5)&&latest.close>ma5,above20=finite(ma20)&&latest.close>ma20;
  const priceTrend=above5&&above20&&finite(ma10)&&ma5>=ma10?'偏強觀察':!above5&&!above20?'偏弱觀察':'盤整待確認';
  const resistance=activeResistanceEvent?.lifeLinePrice, support=activeSupportEvent?.lifeLinePrice;
  const upper=finite(resistance)?'上方空方生命線 '+fmt(resistance)+' 元尚未收盤突破':'尚無已確認且有效的上方生命線壓力';
  const lower=finite(support)?'下方多方支撐 '+fmt(support)+' 元需以收盤守住':'下方有效多方生命線待確認';
  const status=selectedPrimaryEvent?.signalDate===date?(selectedPrimaryEvent.side==='BEAR'?'空方壓力K0剛成立':'多方支撐K0剛成立'):(study.lifecycleState||'資料不足');
  const marketName=securityMarket==='TPEX'?'櫃買指數':securityMarket==='TWSE'?'加權指數':'所屬市場';
  const marketValid=!!market&&market.sourceVerified===true&&market.date===date&&(securityMarket==='TPEX'?market.instrumentType==='TPEX':securityMarket==='TWSE'?market.instrumentType==='TAIEX':false);
  const marketStatus=marketValid?market.risk?.label||'市場已核對':'所屬'+marketName+'風險資料尚未核對';
  const riskReasons=[];
  const recent=bars.at(-2);
  if(recent&&latest.close/recent.close-1>=.08)riskReasons.push('單日漲幅較大，漲停不等於明天續漲');
  if(finite(resistance)&&resistance>latest.close&&(resistance/latest.close-1)<.1)riskReasons.push('上方不遠處仍有尚未突破的壓力');
  if(study.chaseRisk?.level==='ELEVATED')riskReasons.push('近期波動或技術指標提示追價風險');
  if(marketValid&&market.risk?.level>=3)riskReasons.push('所屬市場偏弱，個股強勢不代表市場安全');
  const trendText='短線價格'+priceTrend+'；'+upper+'。'+lower+'。';
  const context=marketValid?'所屬市場：'+marketName+'，'+marketStatus+'。':'所屬市場：'+marketName+'尚無經確認的同日風險資料，不拿其他市場代替。';
  const scenarios=[
   {id:'A',title:'續強確認',text:finite(resistance)?'完成日收盤高於 '+fmt(resistance)+' 元，再檢查均線與量能；盤中穿越不算。':'先確認有效壓力、均線及量能，不補造突破價。'},
   {id:'B',title:'整理觀察',text:'觀察 '+(finite(ma5)?'MA5 '+fmt(ma5)+' 元（會隨行情改變）':'短期均線')+'，以及上下方已確認的生命線；弱勢失守時不稱為整理。'},
   {id:'C',title:'轉弱警示',text:finite(ma5)?'收盤跌回 MA5 '+fmt(ma5)+' 元之下，檢查短線轉弱；'+lower+'。':'等待有效完成日與下方支撐，不製造停損價。'}
  ];
  return freeze({version:VERSION,date,code:study.code,close:latest.close,priceTrend,lifeStatus:status,selectedPrimaryEvent,activeSupportEvent,activeResistanceEvent,historicalReferenceEvents,marketStatus,marketVerified:marketValid,securityMarket:securityMarket||'UNKNOWN',relativeStrengthStatus:marketValid&&finite(market.metrics?.returnPct)?((latest.close/(recent?.close||latest.close)-1)*100-market.metrics.returnPct):null,riskReasons,trendText,context,scenarios,researchOnly:true,performanceValidated:false,affectsEligibility:false,affectsRanking:false});
 }
 return Object.freeze({VERSION,evaluate});
});