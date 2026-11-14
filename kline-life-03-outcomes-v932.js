/* Independent descriptive study. Never changes selection, ranking or existing backtests. */
'use strict';
const Core=require('./kline-life-03-core-v1.js');
function study(inputs,{testStart,testEnd}={}){
 const records=[],rejected=[];
 if(!testStart||!testEnd||testStart>testEnd)return {performanceValidated:false,state:'INSUFFICIENT_DATA',records,rejected};
 for(const input of inputs){const valid=Core.validate(input);if(!valid.ok){rejected.push({code:input.code||input.stock,reason:valid.reason});continue;}
 const bars=valid.bars;
 // Detection only uses bars up to each observation date; future bars are used solely as labeled outcomes.
 for(let i=4;i<bars.length;i++){
  const date=bars[i].date;if(date<testStart||date>testEnd)continue;
  const past=Core.evaluate(input,{asOf:date});
  for(const event of past.events){
   const trigger=event.events.find(e=>e.date===date&&e.confirmedAt&&['BREAKOUT_CONFIRMED','BREAKOUT_HELD','BREAKOUT_FAILED'].includes(e.kind));if(!trigger)continue;
   const t=past.currentTrend,atrPct=t.atr14?100*t.atr14/bars[i].close:null,outcomes={};
   for(const horizon of [1,3,5]){const range=bars.slice(i+1,i+horizon+1),end=bars[i+horizon];const matured=!!end&&end.date<=testEnd;
    outcomes[horizon]=matured?{state:'COMPLETED',endDate:end.date,closeReturnPct:(end.close/bars[i].close-1)*100,maxDrawdownPct:(Math.min(...range.map(b=>b.low))/bars[i].close-1)*100}:{state:'NOT_MATURED',endDate:null,closeReturnPct:null,maxDrawdownPct:null};}
   records.push({code:valid.code,eventId:event.eventId,date,trigger:trigger.kind,rsi5:t.rsi5,deviation5:t.deviation5,atrPct,overheated:t.rsi5!==null?t.rsi5>=80:null,highDeviation:t.deviation5!==null&&atrPct!==null?t.deviation5>2*atrPct:null,outcomes});
  }
 }
 }
 const groups={};
 for(const field of ['trigger','overheated','highDeviation'])for(const value of [...new Set(records.map(r=>r[field]))]){
  const selected=records.filter(r=>r[field]===value),key=field+':'+String(value);
  groups[key]=Object.fromEntries([1,3,5].map(n=>{const completed=selected.map(r=>r.outcomes[n]).filter(o=>o.state==='COMPLETED');return [n,{completed:completed.length,pending:selected.length-completed.length,sampleState:completed.length<30?'INSUFFICIENT_SAMPLE':'DESCRIPTIVE_ONLY',meanCloseReturnPct:completed.length?completed.reduce((s,o)=>s+o.closeReturnPct,0)/completed.length:null,meanDrawdownPct:completed.length?completed.reduce((s,o)=>s+o.maxDrawdownPct,0)/completed.length:null}];}));
 }
 for(const label of ['BELOW_6_PCT','AT_LEAST_6_PCT','UNKNOWN']){
  const selected=records.filter(r=>label==='UNKNOWN'?r.atrPct===null:label==='BELOW_6_PCT'?r.atrPct!==null&&r.atrPct<6:r.atrPct!==null&&r.atrPct>=6);
  groups['volatility:'+label]={events:selected.length,failedBreakouts:selected.filter(r=>r.trigger==='BREAKOUT_FAILED').length,sampleState:selected.length<30?'INSUFFICIENT_SAMPLE':'DESCRIPTIVE_ONLY'};
 }
 return {version:'LIFE03_OUTCOMES_V932',groups,state:'DESCRIPTIVE_ONLY',performanceValidated:false,performance:'NOT_VALIDATED',outOfSampleValidated:false,sampleAdequacy:'NOT_ESTABLISHED',testStart,testEnd,records,rejected,completed:Object.fromEntries([1,3,5].map(n=>[n,records.filter(r=>r.outcomes[n].state==='COMPLETED').length])),note:'收盤後價格研究，不含成本與成交可行性；未建立可靠樣本外驗證，不得宣稱勝率提高。'};
}
module.exports={study};
