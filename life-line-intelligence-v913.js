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
 const labels=Object.freeze({SUPPORT_WATCH:'觀察下方支撐能否守住',RESISTANCE_WATCH:'觀察上方壓力能否突破',RETEST_HELD:'回測後仍守住支撐',INSUFFICIENT_DATA:'資料不足，暫時無法判斷',RECOVERY_CONFIRMED:'收盤與均線顯示走勢改善',BREAKOUT_HELD:'突破後仍守住支撐',BREAKOUT_FAILED:'突破後又跌回去',SUPPORT_BROKEN:'已跌破重要支撐',SUPPORT_RECLAIMED:'已重新站回重要價位',BREAKOUT_INITIAL:'剛突破重要價位',BREAKOUT_CONFIRMED:'收盤確認突破',SUPPORT_HELD:'仍守住重要支撐',RESISTANCE_HELD:'尚未突破上方壓力',HISTORICAL_REFERENCE:'僅供歷史參考',NO_EVENT:'尚無確認的生命線',POST_SHOCK_WEAKNESS:'大跌後仍未恢復強勢',ACTIVE_SHOCK:'目前波動異常',REBOUND_ATTEMPT:'正在嘗試反彈',NORMAL_OR_UNCONFIRMED:'方向仍待確認'});
 function statusLabel(value,fallback='生命線狀態待確認'){
  if(typeof value==='string'&&Object.prototype.hasOwnProperty.call(labels,value))return labels[value];
  return typeof value==='string'&&/[\u3400-\u9fff]/.test(value)&&!/[A-Z]{2,}_[A-Z0-9_]+/.test(value)?value:fallback;
 }
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
  const status=selectedPrimaryEvent?.signalDate===date?(selectedPrimaryEvent.side==='BEAR'?'空方壓力K0剛成立':'多方支撐K0剛成立'):statusLabel(study.lifecycleState);
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
 // Only validated completed bars enter this report. Each historical comparison
 // uses the moving average or trailing low available at that session.
 function observe(m,intel,market=false,marketRisk=null){
  const bars=m.bars, last=bars.at(-1), prev=bars.at(-2), ma=m.maSeries[5];
  const unit=market?' 點':' 元', subject=market?'指數':'股價';
  const price=value=>fmt(value)+unit;
  const activeLine=!!m.event&&!m.referenceOnly&&finite(m.line);
  const broken=m.events.filter(e=>e.kind==='SUPPORT_BROKEN'&&e.confirmedAt===e.date).at(-1);
  const reclaimed=m.events.find(e=>e.kind==='SUPPORT_RECLAIMED'&&e.confirmedAt===e.date&&broken&&e.date>broken.date);
  const recentStart=Math.max(10,bars.length-30);
  const history=[];
  for(let i=recentStart;i<bars.length;i++){
   const previous=bars.slice(Math.max(0,i-10),i);
   const floor=Math.min(...previous.map(b=>b.low));
   history.push({date:bars[i].date,maBreak:ma[i-1]!=null&&bars[i-1].close>=ma[i-1]&&bars[i].close<ma[i],
    lowerLow:bars[i].low<floor,closedBelowLow:bars[i].close<floor});
  }
  const lastLow=history.filter(h=>h.lowerLow).at(-1);
  const fresh=!!lastLow&&lastLow.date===last?.date;
  const priorWeakness=history.slice(-10).some(h=>h.maBreak||h.closedBelowLow)||!!broken;
  const noNewLow=history.length>=2&&history.slice(-2).every(h=>!h.lowerLow);
  const targets=[...new Set([m.ma[5],m.ma[10],m.ma[20],activeLine?m.line:null,intel.activeResistanceEvent?.lifeLinePrice,m.range.high].filter(v=>finite(v)&&v>m.close))].sort((a,b)=>a-b);
  const below=activeLine&&!!last&&last.close<m.line;
  const held=activeLine&&m.currentRole!=='RESISTANCE'&&prev&&prev.date>=m.event.signalDate&&[prev,last].every((b,i)=>b.close>m.line&&finite(ma.at(i-2))&&b.close>ma.at(i-2));
  let stage='方向還不明確',reason='目前的收盤與均價尚未指向同一方向。',tip='等待方向更明確';
  if(!last||!prev||!finite(m.ma[20])){reason='完成交易日不足，方向尚未確認。';}
  else if(fresh&&last.close<m.ma[5]&&last.close<m.ma[20]){
   stage='還在走弱';reason=subject+'低於五日與二十日均價，今天又出現更低價位。';tip='注意可能繼續下跌';
  }else if(marketRisk?.rebound.code==='REBOUND_FAILURE_WARNING'||marketRisk?.phase.state==='ACTIVE_SHOCK'){
   stage='還在走弱';reason=marketRisk.rebound.code==='REBOUND_FAILURE_WARNING'?'先前回升時未站回生命線，最新收盤又下跌。':'指數跌幅已超過近期波動門檻。';tip='注意市場下跌風險';
  }else if(held&&m.close>m.ma[20]&&noNewLow){
   stage=m.trend.state==='STRONG'&&bars.slice(-3).every(b=>b.date>=m.event.signalDate&&b.close>m.line)?'持續走強':'逐漸變強';
   reason='連兩日收在生命線及五日均價之上。';tip='觀察明天能否守住';
  }else if(priorWeakness&&below&&noNewLow&&last.close>prev.close&&prev.close>bars.at(-3).close){
   stage='正在反彈';reason='收盤連兩日回升，仍低於原本生命線。';tip='反彈仍要看能否守住';
  }else if(priorWeakness&&noNewLow&&below){
   stage='開始止跌觀察';reason='近兩日沒有再跌出新低，尚未收復生命線。';tip='觀察能不能守住低點';
  }else if(m.trend.state==='WEAK'&&last.close<m.ma[5]&&last.close<m.ma[20]){
   stage='還在走弱';reason='收盤仍低於五日與二十日均價。';tip='先不要急著搶反彈';
  }
  const signal=below&&broken?'已跌破原本支撐':activeLine&&reclaimed&&m.close>m.line?'已重新站回重要價位':activeLine&&last&&last.low<=m.line&&last.high>=m.line?'正在測試重要價位':'尚未確認轉強';
  const lineText=activeLine?('收盤'+(m.close<m.line?'低於':m.close>m.line?'高於':'等於')+'生命線 '+price(m.line)+'。'):'有效生命線尚未確認。';
  // V9.19 presentation-only, data-bound MA5 from latest validated completed session.
  const currentMA5=finite(m.ma[5])?m.ma[5]:null;
  const historicalResistance=intel?.activeResistanceEvent?.lifeLinePrice;
  const shortTerm=Object.freeze({
   date:last?.date||null,ma5:currentMA5,
   label:finite(currentMA5)?(m.close<currentMA5?'短線先看能否站回5日均價':'短線觀察能否守住5日均價'):'5日均價資料不足',
   note:finite(currentMA5)?'截至 '+(last?.date||'最新完成日')+' 的5日均價 '+price(currentMA5)+'；下一完成交易日會重新計算。單日站回不等於趨勢轉強。':'5日均價待核對，不能推測反彈關卡。',
   historicalResistance:finite(historicalResistance)?historicalResistance:null
  });
  const rebound=finite(currentMA5)?'先看5日均價'+price(currentMA5)+'（每日重算）'+(finite(historicalResistance)&&historicalResistance>m.close?'；再看歷史壓力'+price(historicalResistance):'；站穩還要核對20日均價'):'5日均價資料不足，短線關卡待核對';
  const low=m.range.low, floor=price(low);
  const upper=targets[0], hold=activeLine&&!below?m.line:m.ma[5];
  const scenarios=[
   {title:'開始變好',text:finite(currentMA5)?(m.close<currentMA5?'若收盤站回當日重算的5日均價，再看隔日能否守住；仍非轉強確認。':'若連續守住當日重算的5日均價，再核對20日均價與生命線。'):'短線5日均價尚未核對，暫不能確認反彈。'},
   {title:'還不確定',text:finite(low)&&finite(upper)?'若收在 '+floor+' 至 '+price(upper)+' 之間，方向仍待確認。':finite(low)?'若守住 '+floor+' 但收盤未上漲，仍要留意轉弱。':'近期區間尚未確認。'},
   {title:'繼續變弱',text:finite(low)?'若收盤低於 '+floor+'，下跌風險可能擴大。':'近期低點尚未確認。'}];
  const firstMA=history.find(h=>h.maBreak);
  const currentBreak=last&&last.close<m.ma[5]?history.filter(h=>h.maBreak).at(-1):null;
  const firstLow=history.find(h=>h.closedBelowLow&&(!currentBreak||h.date>=currentBreak.date));
  const timeline='近30日首度收破五日均價：'+(firstMA?.date.slice(5)||'未觀察到')+'。本波收破五日均價：'+(currentBreak?.date.slice(5)||'未確認')+'。收破前低：'+(firstLow?.date.slice(5)||'未觀察到')+'。';
  const summary=stage+'。'+(fresh?'今天再創近期低點。':noNewLow?'近兩日未再創低。':'止跌仍待觀察。')+(broken&&lastLow&&lastLow.date>broken.date?'跌破生命線後又出現更低價位。':'')+'明天先看'+(finite(low)?floor+'能否守住。':'低點能否確認。');
  return {stage,reason,tip,signal,lineText,targets,rebound,shortTerm,scenarios,history,timeline,summary,broken,reclaimed};
 }
 function historyFields(m,observation){
  const labels={high:'最高價',low:'最低價',close:'收盤價'};
  const rows=m.four.map((v,i)=>{
   const field=i===3?'close':(i===0)===(m.event.side==='BULL')?'low':'high';
   return {date:v.date,label:v.label,field:labels[field],value:v.bar?.[field]};
  });
  for(const [label,event] of [['跌破',observation.broken],['站回',observation.reclaimed]]){
   rows.push({date:event?.date,label:!event&&label==='站回'?'尚未站回':label,field:labels.close,value:m.bars.find(b=>b.date===event?.date)?.close});
  }
  return rows;
 }
 return Object.freeze({VERSION,evaluate,statusLabel,observe,historyFields});
});