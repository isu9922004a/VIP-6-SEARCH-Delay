/* V9.2 read-only 0..3 K life-line research. All decisions are point-in-time. */
(function(root,factory){
  const node=typeof module==='object'&&!!module.exports;
  const api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon);
  if(node)module.exports=api;else root.ShitouKlineLife03=api;
})(globalThis,function(U){
'use strict';
const VERSION='KLINE_LIFE_03_V1',MODEL='V9.2-KLINE-LIFE03';
const DEFAULT=Object.freeze({minBars:4,maxEventAge:20,maxEvents:100,trendBars:3,strictExtremes:true,requireComplete:true});
const LABELS=Object.freeze({STRONG:'偏強',WEAK:'偏弱',TURNING_STRONG:'轉強確認',TURNING_WEAK:'轉弱確認',NEUTRAL:'盤整／待確認',INSUFFICIENT_DATA:'資料不足'});
const STATES=Object.freeze({BULL_SUPPORT_WATCH:'多方支撐觀察',BEAR_RESISTANCE_WATCH:'空方壓力觀察',SUPPORT_BROKEN:'多方支撐失守',SUPPORT_RECLAIMED:'失守後收復',BREAKOUT_CONFIRMED:'空方壓力已突破',BREAKOUT_FAILED:'突破後失守'});
const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
const pct=(a,b)=>validNumber(a)&&validNumber(b)&&b>0?(a/b-1)*100:null;
const freeze=obj=>{if(obj&&typeof obj==='object'&&!Object.isFrozen(obj)){Object.values(obj).forEach(freeze);Object.freeze(obj);}return obj;};
function validate(input,asOf){
 const report=input?.report||input||{},analysis=Array.isArray(report.sourceBars);
 let rows,datum;
 if(analysis){
  if(report.validation?.technicalModelAvailable!==true)return {ok:false,reason:'研究日K尚未取得完整來源認證'};
  rows=report.sourceBars;datum=report.date;
 }else{
  if(report.completed!==true||report.isComplete===false||report.suspended===true)return {ok:false,reason:'尚未確認盤後完成日K'};
  if(report.priceAdjustment?.verified!==true||!report.priceAdjustment.basis)return {ok:false,reason:'除權息價格口徑尚未核驗'};
  const checked=U?.validate?.(report);if(!checked?.ok)return {ok:false,reason:checked?.reason||'日K來源未核驗'};
  rows=checked.bars;datum=report.marketDate||report.closeDate||report.dataDate;
 }
 if(!Array.isArray(rows)||!rows.length)return {ok:false,reason:'沒有已核驗的日K'};
 if(!/^\d{4}-\d\d-\d\d$/.test(String(datum||''))||rows.at(-1)?.date!==datum)return {ok:false,reason:'行情日期與最後完成日K不一致'};
 if(asOf&&(!/^\d{4}-\d\d-\d\d$/.test(String(asOf))||asOf>datum))return {ok:false,reason:'研究日期無效或超出已完成行情'};
 const bars=rows.filter(x=>!asOf||x.date<=asOf);
 if(!bars.length||asOf&&bars.at(-1).date!==asOf)return {ok:false,reason:'指定研究日期沒有完成日K'};
 if(bars.some((b,i)=>!validNumber(b.open)||!validNumber(b.high)||!validNumber(b.low)||!validNumber(b.close)||!validNumber(b.volume)||b.open<=0||b.low<=0||b.volume<=0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high)||i>0&&bars[i-1].date>=b.date))return {ok:false,reason:'日K日期、OHLC或成交量不合法'};
 if(bars.length<4)return {ok:false,reason:'至少需要4根已完成日K'};
 const expected=report.expectedTradingDates;
 if(Array.isArray(expected)&&expected.length){const d=new Set(bars.map(x=>x.date));if(expected.some(x=>x>=bars[0].date&&x<=bars.at(-1).date&&!d.has(x)))return {ok:false,reason:'已核對的交易日曆存在缺口'};}
 return {ok:true,bars,date:bars.at(-1).date,code:String(report.code||report.stock||''),name:report.name||''};
}
function detect(bars,params={}){
 const p={...DEFAULT,...params},events=[];
 for(let i=3;i<bars.length;i++){
  const a=bars[i-3],b=bars[i-2],c=bars[i-1],z=bars[i];
  const bull=a.high<b.high&&b.high<c.high&&!(a.low>b.low&&b.low>c.low)&&z.high<=c.high;
  const bear=a.low>b.low&&b.low>c.low&&!(a.high<b.high&&b.high<c.high)&&z.low>=c.low;
  for(const side of (bull?['BULL']:bear?['BEAR']:[])){
   const value=side==='BULL'?a.low:a.high,type=side==='BULL'?'SUPPORT':'RESISTANCE';
   const code=String(p.code||'');
   const id=[MODEL,code,side,z.date,a.date,String(value)].join('|');
   events.push({eventId:id,detectedAt:z.date,signalDate:z.date,confirmedAt:null,
     k0Date:z.date,k1Date:c.date,k2Date:b.date,k3Date:a.date,k0Index:i,k1Index:i-1,k2Index:i-2,k3Index:i-3,
     lifeLinePrice:value,lifeLineType:type,side,status:side==='BULL'?'BULL_SUPPORT_WATCH':'BEAR_RESISTANCE_WATCH',
     invalidationDate:null,dataVersion:MODEL,events:[],lastTransition:null});
  }
 }
 return events;
}
function trace(seed,bars){
 const x={...seed,events:[],lastTransition:null},price=x.lifeLinePrice;
 let broken=false,confirmed=false;
 for(let i=x.k0Index+1;i<bars.length;i++){
  const b=bars[i],prev=bars[i-1],ev=[],was=x.status;
  if(x.side==='BULL'){
   if(b.low<price&&b.close>=price)ev.push('SUPPORT_RECLAIMED_INTRADAY');
   if(b.close===price)ev.push('SUPPORT_TEST');
   if(b.close<price&&!broken){broken=true;x.status='SUPPORT_BROKEN';x.invalidationDate=b.date;ev.push('SUPPORT_BROKEN');}
   else if(broken&&b.close>=price){broken=false;x.status='SUPPORT_RECLAIMED';ev.push('SUPPORT_RECLAIMED');}
   else if(!broken&&x.status==='SUPPORT_RECLAIMED'&&b.close>price){x.status='BULL_SUPPORT_WATCH';}
   if(!broken&&b.low<=price&&b.close>=price&&prev.close>=price)ev.push('RETEST_HELD');
  }else{
   if(b.high>price&&b.close<=price)ev.push('BREAKOUT_ATTEMPT');
   if(b.close===price)ev.push('RESISTANCE_TEST');
   if(b.close>price&&!confirmed){confirmed=true;x.status='BREAKOUT_CONFIRMED';x.confirmedAt=b.date;ev.push('BREAKOUT_CONFIRMED');}
   else if(confirmed&&b.close<=price){confirmed=false;x.status='BREAKOUT_FAILED';x.invalidationDate=b.date;ev.push('BREAKOUT_FAILED');}
   else if(!confirmed&&x.status==='BREAKOUT_FAILED'&&b.close<price){x.status='BEAR_RESISTANCE_WATCH';}
   if(confirmed&&b.low<=price&&b.close>price)ev.push('RETEST_HELD');
  }
  for(const kind of ev){const e={kind,date:b.date,confirmedAt:kind==='SUPPORT_BROKEN'||kind==='BREAKOUT_CONFIRMED'||kind==='BREAKOUT_FAILED'?b.date:null,price,barIndex:i};x.events.push(e);}
  if(was!==x.status)x.lastTransition={previousState:was,currentState:x.status,transitionDate:b.date,transitionReason:ev[0]||'生命線條件變化'};
 }
 return x;
}
function evidence(bars,event){
 const z=bars.at(-1),ma=n=>bars.length>=n?(U?.ma?U.ma(bars,n):bars.slice(-n).reduce((s,b)=>s+b.close,0)/n):null;
 const m5=ma(5),m20=ma(20),m60=ma(60);
 const v5=bars.length>=6?bars.slice(-6,-1).reduce((s,b)=>s+b.volume,0)/5:null;
 const ratio=v5>0?z.volume/v5:null;
 const rsi=bars.length>=15&&U?.rsi?U.rsi(bars,14):null,atr=bars.length>=15&&U?.atr?U.atr(bars,14):null;
 const confirming=[],contradictions=[],risk=[];
 if(event.side==='BULL'){
  if(m20!==null&&z.close>=m20)confirming.push('收盤高於MA20');
  if(m20!==null&&z.close<m20)contradictions.push('生命線尚有效，但收盤低於MA20');
  if(m5!==null&&bars.length>=6&&m5<U.ma(bars.slice(0,-1),5))contradictions.push('短期MA5已下彎');
 }else{
  if(m20!==null&&z.close<=m20)confirming.push('收盤低於MA20');
  if(m20!==null&&z.close>m20)contradictions.push('壓力尚有效，但收盤高於MA20');
 }
 if(ratio!==null&&ratio>=1.2)confirming.push('當日量為前5日均量'+ratio.toFixed(2)+'倍');
 if(rsi!==null&&rsi>=75)risk.push('RSI14偏熱，注意追價與回落');
 if(atr!==null&&z.close>0&&atr/z.close>.06)risk.push('ATR波動較大，生命線不是保證成交的停損價');
 const candleRange=z.high-z.low;
 if(candleRange>0&&(z.high-Math.max(z.open,z.close))/candleRange>=.4)risk.push('上影線較長，觀察收盤賣壓');
 return {confirmationEvidence:confirming,contradictions,riskWarnings:risk,indicators:{ma5:m5,ma20:m20,ma60:m60,volumeRatio:ratio,rsi14:rsi,atr14:atr}};
}
function evaluate(input,options={}){
 const v=validate(input,options.asOf),empty={version:VERSION,model:MODEL,code:String(input?.code||input?.stock||''),date:options.asOf||input?.date||input?.closeDate||null,state:'INSUFFICIENT_DATA',label:LABELS.INSUFFICIENT_DATA,events:[],event:null,confirmationEvidence:[],contradictions:[],riskWarnings:[],performance:'NOT_VALIDATED',researchOnly:true,affectsEligibility:false,affectsRanking:false,automaticTrade:false};
 if(!v.ok)return freeze({...empty,reason:v.reason});
 const p={...DEFAULT,...options,code:v.code},bars=v.bars;
 const events=detect(bars,p).map(e=>trace(e,bars)),recent=events.filter(e=>bars.length-1-e.k0Index<=p.maxEventAge);
 const trans=recent.filter(e=>e.lastTransition?.transitionDate===v.date);
 const latest=(trans.length?trans:recent).at(-1)||null;
 const opposing=!!latest&&recent.some(e=>e!==latest&&e.side!==latest.side&&e.k0Date===latest.k0Date);
 const ev=latest&&{...latest,k0Index:latest.k0Index,k1Index:latest.k1Index,k2Index:latest.k2Index,k3Index:latest.k3Index};
 const info=ev?evidence(bars,ev):{confirmationEvidence:[],contradictions:[],riskWarnings:[],indicators:{}};
 let state='NEUTRAL';
 if(ev&&!opposing){
  if(ev.lastTransition?.transitionDate===v.date&&ev.status==='SUPPORT_BROKEN')state='TURNING_WEAK';
  else if(ev.lastTransition?.transitionDate===v.date&&ev.status==='BREAKOUT_CONFIRMED')state='TURNING_STRONG';
  else if(ev.side==='BULL'&&ev.status==='BULL_SUPPORT_WATCH'&&bars.at(-1).close>=ev.lifeLinePrice)state='STRONG';
  else if(ev.side==='BEAR'&&ev.status==='BEAR_RESISTANCE_WATCH'&&bars.at(-1).close<=ev.lifeLinePrice)state='WEAK';
 }
 if(['STRONG','WEAK'].includes(state)&&info.contradictions.length)state='NEUTRAL';
 const close=bars.at(-1).close,line=ev?.lifeLinePrice||null;
 const scenario=ev?{
   bullish:ev.side==='BEAR'?'下一完成日K若收盤高於'+line+'元，才確認壓力突破':'若守住'+line+'元並突破已確認前高，才觀察多方延續',
   bearish:ev.side==='BULL'?'下一完成日K若收盤低於'+line+'元，構成生命線失守':'若仍在'+line+'元下方，空方壓力尚未解除',
   neutral:'收盤剛好等於關卡，或反覆往返時，維持觀察',
   falseBreak:'盤中高於壓力但收盤未站上、或突破後又收回，須標示失敗候選',
   falseBreakdown:'盤中低於支撐而收盤重新站回，不視為已確認轉弱'
 }:null;
 return freeze({...empty,code:v.code,name:v.name,date:v.date,state,label:LABELS[state],
   reason:ev?'固定生命線屬於價位結構研究，不是隔日報酬預測':opposing?'近期多空事件互相衝突':'沒有可確認的0號K事件',
   event:ev,events:events.slice(-p.maxEvents),close,line,distancePct:line?pct(close,line):null,
   previousState:ev?.lastTransition?.previousState||null,currentState:ev?.status||null,
   transitionDate:ev?.lastTransition?.transitionDate||null,transitionReason:ev?.lastTransition?.transitionReason||null,
   ...info,scenario,historyBarCount:bars.length,validatedAsOf:v.date});
}
return Object.freeze({VERSION,MODEL,DEFAULT,LABELS,STATES,validate,detect,trace,evaluate});
});
