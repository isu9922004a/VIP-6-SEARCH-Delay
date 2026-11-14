/* V9.2 read-only 0..3 K life-line research. All decisions are point-in-time. */
(function(root,factory){
  const node=typeof module==='object'&&!!module.exports;
  const api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon);
  if(node)module.exports=api;else root.ShitouKlineLife03=api;
})(globalThis,function(U){
'use strict';
const VERSION='KLINE_LIFE_03_V1',MODEL='V9.2-KLINE-LIFE03';
const DEFAULT=Object.freeze({minBars:4,maxEventAge:20,maxEvents:100,trendBars:3,strictExtremes:true,requireComplete:true,holdBars:2,retestTolerancePct:0.5});
const LIFECYCLE_STATES=Object.freeze(['RESISTANCE_WATCH','BREAKOUT_INITIAL','BREAKOUT_HELD','BREAKOUT_FAILED','SUPPORT_WATCH','SUPPORT_BROKEN','SUPPORT_RECLAIMED','RETEST_HELD','HISTORICAL_REFERENCE','INSUFFICIENT_DATA']);
const LABELS=Object.freeze({STRONG:'偏強',WEAK:'偏弱',TURNING_STRONG:'轉強確認',TURNING_WEAK:'轉弱確認',NEUTRAL:'盤整／待確認',INSUFFICIENT_DATA:'資料不足'});
const STATES=Object.freeze({BULL_SUPPORT_WATCH:'多方支撐觀察',BEAR_RESISTANCE_WATCH:'空方壓力觀察',SUPPORT_BROKEN:'多方支撐失守',SUPPORT_RECLAIMED:'失守後收復',BREAKOUT_CONFIRMED:'空方壓力已突破',BREAKOUT_FAILED:'突破後失守'});
const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
const pct=(a,b)=>validNumber(a)&&validNumber(b)&&b>0?(a/b-1)*100:null;
const freeze=obj=>{if(obj&&typeof obj==='object'&&!Object.isFrozen(obj)){Object.values(obj).forEach(freeze);Object.freeze(obj);}return obj;};
function validate(input,asOf){
 const report=input?.report||input||{};
 if(report.sourceBindingError===true)return {ok:false,reason:'來源日期、股票或價格窗口不一致'};
 if(report.suspended===true||report.completed===false||report.isComplete===false||report.corporateActionUnresolved===true||report.priceAdjustmentConsistent===false)return {ok:false,reason:'停牌、未完成行情或價格口徑未一致'};
 const analysis=Array.isArray(report.sourceBars);
 let rows,datum;
 if(analysis){
  if(report.validation?.technicalModelAvailable!==true)return {ok:false,reason:'研究日K尚未取得完整來源認證'};
  rows=report.sourceBars;datum=report.date;
  if(Array.isArray(report.reportBars)&&report.reportBars.length>=rows.length){
   const tail=report.reportBars.slice(-rows.length);
   if(!rows.every((b,i)=>['date','open','high','low','close','volume'].every(k=>b[k]===tail[i]?.[k])))return {ok:false,reason:'歷史窗口與近期行情不同步'};
   rows=report.reportBars;
  }
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
 if(bars.some((b,i)=>!validNumber(b.open)||!validNumber(b.high)||!validNumber(b.low)||!validNumber(b.close)||!validNumber(b.volume)||b.suspended===true||b.completed===false||b.isComplete===false||b.open<=0||b.low<=0||b.volume<=0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high)||i>0&&bars[i-1].date>=b.date))return {ok:false,reason:'日K日期、OHLC或成交量不合法'};
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
function trace(seed,bars,params={}){
 const p={...DEFAULT,...params},x={...seed,events:[],lastTransition:null},price=x.lifeLinePrice;
 let state=x.side==='BULL'?'SUPPORT_WATCH':'RESISTANCE_WATCH',streak=0,cycle=0;
 x.firstBreakoutDate=null;x.firstBreakdownDate=null;x.latestConfirmationDate=null;
 const move=(next,b,i,kind=next)=>{const previous=state;state=next;
  const event={kind,date:b.date,confirmedAt:b.date,price,barIndex:i,eventId:x.eventId+'|'+cycle+'|'+kind+'|'+b.date};
  x.events.push(event);x.latestConfirmationDate=b.date;
  if(previous!==next)x.lastTransition={previousState:previous,currentState:next,transitionDate:b.date,transitionReason:kind};
 };
 // At the completed K0 close both the pattern and its price evidence are known.
 for(let i=x.k0Index;i<bars.length;i++){
  const b=bars[i],above=b.close>price,below=b.close<price;
  const note=kind=>x.events.push({kind,date:b.date,confirmedAt:null,price,barIndex:i});
  if(x.side==='BEAR'){
   if(b.high>price&&!above)note('BREAKOUT_ATTEMPT');
   if(above){
    streak++;
    if(streak>=p.holdBars)x.latestConfirmationDate=b.date;
    if(streak===1){cycle++;move('BREAKOUT_INITIAL',b,i,'BREAKOUT_CONFIRMED');x.confirmedAt=b.date;x.firstBreakoutDate??=b.date;}
    else if(streak===p.holdBars)move('BREAKOUT_HELD',b,i);
    // A later bar must actually return near the line from above; standing above is not a retest.
    else if(streak>p.holdBars&&bars[i-1].low>price*(1+p.retestTolerancePct/100)&&b.low<=price*(1+p.retestTolerancePct/100)&&b.low>=price*(1-p.retestTolerancePct/100))move('RETEST_HELD',b,i);
   }else{if(streak>0){move('BREAKOUT_FAILED',b,i);x.invalidationDate=b.date;}streak=0;}
  }else{
   if(b.low<price&&!below)note('SUPPORT_RECLAIMED_INTRADAY');
   if(below&&state!=='SUPPORT_BROKEN'){move('SUPPORT_BROKEN',b,i);x.invalidationDate=b.date;x.firstBreakdownDate??=b.date;}
   else if(above&&state==='SUPPORT_BROKEN')move('SUPPORT_RECLAIMED',b,i);
  }
  if(b.close===price)note(x.side==='BEAR'?'RESISTANCE_TEST':'SUPPORT_TEST');
 }
 x.lifecycleState=state;
 x.status=({SUPPORT_WATCH:'BULL_SUPPORT_WATCH',RESISTANCE_WATCH:'BEAR_RESISTANCE_WATCH',BREAKOUT_INITIAL:'BREAKOUT_CONFIRMED',BREAKOUT_HELD:'BREAKOUT_CONFIRMED',RETEST_HELD:'BREAKOUT_CONFIRMED'})[state]||state;
 x.eventAgeBars=bars.length-1-x.k0Index;x.dataAsOf=bars.at(-1).date;
 x.lastTransitionDate=x.lastTransition?.transitionDate||null;
 x.distanceFromCurrentPricePct=pct(bars.at(-1).close,price);
 x.isHistoricallyValid=true;
 const window=bars.slice(-10),atr=bars.length>=15?U.atr(bars,14):null;
 const remote=atr>0&&Math.abs(bars.at(-1).close-price)>atr*3&&!window.some(b=>b.low<=price&&b.high>=price);
 const transitionAge=x.lastTransitionDate?bars.length-1-bars.findIndex(b=>b.date===x.lastTransitionDate):x.eventAgeBars;
 x.referenceOnly=(x.eventAgeBars>p.maxEventAge&&transitionAge>p.maxEventAge)||remote;
 x.originalEvent={eventId:seed.eventId,signalDate:seed.signalDate,k3Date:seed.k3Date,k2Date:seed.k2Date,k1Date:seed.k1Date,k0Date:seed.k0Date,side:seed.side,lifeLinePrice:price,evidence:'K3至K1嚴格高點遞增或低點遞減；K0停止同方向創新極值；排除雙向同時成立'};
 x.currentRole=x.referenceOnly?'HISTORICAL_REFERENCE':['BREAKOUT_INITIAL','BREAKOUT_HELD','RETEST_HELD','SUPPORT_WATCH','SUPPORT_RECLAIMED'].includes(state)?'SUPPORT':state==='SUPPORT_BROKEN'?'RESISTANCE':'RESISTANCE';
 x.isCurrentResistance=x.currentRole==='RESISTANCE';x.isCurrentSupport=x.currentRole==='SUPPORT';
 x.statusReason=x.lastTransition?x.lastTransition.transitionDate+' 收盤確認 '+state:'自 '+x.signalDate+' 成立後，尚無收盤觸發狀態轉換';
 return x;
}
function evidence(bars,event){
 const z=bars.at(-1),ma=n=>bars.length>=n?(U?.ma?U.ma(bars,n):bars.slice(-n).reduce((s,b)=>s+b.close,0)/n):null;
 const m5=ma(5),m20=ma(20),m60=ma(60);
 const v5=bars.length>=6?bars.slice(-6,-1).reduce((s,b)=>s+b.volume,0)/5:null;
 const ratio=v5>0?z.volume/v5:null;
 const rsi=bars.length>=15&&U?.rsi?U.rsi(bars,14):null,atr=bars.length>=15&&U?.atr?U.atr(bars,14):null;
 const confirming=[],contradictions=[],risk=[];
 if(event.currentRole==='SUPPORT'){
  if(m20!==null&&z.close>=m20)confirming.push('收盤高於MA20');
  if(m20!==null&&z.close<m20)contradictions.push('生命線尚有效，但收盤低於MA20');
  if(m5!==null&&bars.length>=6&&m5<U.ma(bars.slice(0,-1),5))contradictions.push('短期MA5已下彎');
 }else if(event.currentRole==='RESISTANCE'){
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
 const v=validate(input,options.asOf),empty={version:VERSION,model:MODEL,code:String(input?.code||input?.stock||''),date:options.asOf||input?.date||input?.closeDate||null,state:'INSUFFICIENT_DATA',lifecycleState:'INSUFFICIENT_DATA',currentRole:null,referenceOnly:null,performanceValidated:false,label:LABELS.INSUFFICIENT_DATA,events:[],event:null,confirmationEvidence:[],contradictions:[],riskWarnings:[],performance:'NOT_VALIDATED',researchOnly:true,affectsEligibility:false,affectsRanking:false,automaticTrade:false};
 if(!v.ok)return freeze({...empty,reason:v.reason});
 const p={...DEFAULT,...options,code:v.code},bars=v.bars;
 const events=detect(bars,p).map(e=>trace(e,bars,p)),recent=events.filter(e=>!e.referenceOnly);
 const trans=recent.filter(e=>e.lastTransition?.transitionDate===v.date);
 // Prefer current nearby levels, then recent structure changes. Preserve old events as references.
 const ranked=recent.slice().sort((a,b)=>{
  const score=e=>Math.abs(e.distanceFromCurrentPricePct)+(e.eventAgeBars/p.maxEventAge)*5-(e.lastTransitionDate===v.date?10:0);
  return score(a)-score(b)||b.k0Index-a.k0Index;
 });
 const latest=ranked[0]||events.at(-1)||null;
 const opposing=!!latest&&recent.some(e=>e!==latest&&e.currentRole!==latest.currentRole&&Math.abs(e.lifeLinePrice-latest.lifeLinePrice)<=latest.lifeLinePrice*p.retestTolerancePct/100);
 const ev=latest&&{...latest,k0Index:latest.k0Index,k1Index:latest.k1Index,k2Index:latest.k2Index,k3Index:latest.k3Index};
 const info=ev?evidence(bars,ev):{confirmationEvidence:[],contradictions:[],riskWarnings:[],indicators:{}};
 let state='NEUTRAL';
 if(ev&&!opposing){
  if(ev.lastTransition?.transitionDate===v.date&&ev.status==='SUPPORT_BROKEN')state='TURNING_WEAK';
  else if(ev.lastTransition?.transitionDate===v.date&&ev.lastTransition.transitionReason==='BREAKOUT_CONFIRMED')state='TURNING_STRONG';
  else if(ev.side==='BULL'&&ev.status==='BULL_SUPPORT_WATCH'&&bars.at(-1).close>=ev.lifeLinePrice)state='STRONG';
  else if(ev.side==='BEAR'&&ev.status==='BEAR_RESISTANCE_WATCH'&&bars.at(-1).close<=ev.lifeLinePrice)state='WEAK';
 }
 if(['STRONG','WEAK'].includes(state)&&info.contradictions.length)state='NEUTRAL';
 const close=bars.at(-1).close,line=ev?.lifeLinePrice||null;
 const currentTrend=currentEvidence(bars);
 const scenario=ev?observe(ev,bars,currentTrend.currentTrend):null;
 if(opposing){info.riskWarnings.push('附近同時有支撐與壓力，不能只依單一生命線判斷。');scenario.summary='附近生命線的支撐與壓力互相衝突，先觀察近期高低點與收盤，不先確認轉強或轉弱。';}
 return freeze({...empty,code:v.code,name:v.name,date:v.date,state,label:LABELS[state],
   reason:opposing?'近期多空事件互相衝突':ev?'固定生命線屬於價位結構研究，不是隔日報酬預測':'沒有可確認的0號K事件',
   event:ev,events:events.slice(-p.maxEvents),close,line,distancePct:line?pct(close,line):null,
   previousState:ev?.lastTransition?.previousState||null,currentState:ev?.status||null,
   transitionDate:ev?.lastTransition?.transitionDate||null,transitionReason:ev?.lastTransition?.transitionReason||null,
   ...info,...currentTrend,validatedBars:bars.map(b=>({...b})),dataSource:input?.dataSource||input?.priceAdjustment?.source||null,priceAdjustment:input?.priceAdjustment||null,dataCompleteness:input?.dataQuality||{complete:true,missing:[]},scenario,lifecycleState:ev?.lifecycleState||"INSUFFICIENT_DATA",currentRole:ev?.currentRole||null,referenceOnly:ev?.referenceOnly??null,opposing,dataAsOf:v.date,performanceValidated:false,historyBarCount:bars.length,validatedAsOf:v.date});
}
function withSource(analysis,raw){
 if(analysis?.validation?.technicalModelAvailable!==true)return analysis;
 const rows=raw?.canonicalBars||raw?.dailySeries,selected=analysis.reportBars||analysis.sourceBars;
 const match=String(raw?.stock||raw?.code||'')===String(analysis.code)&&String(raw?.closeDate||raw?.marketDate||'')===analysis.date&&Array.isArray(rows)&&Array.isArray(selected)&&selected.every(b=>{const r=rows.find(r=>r.date===b.date);return r&&['date','open','high','low','close','volume'].every(k=>r[k]===b[k]);});
 if(!match)return freeze({...analysis,sourceBindingError:true});
 return freeze({...analysis,priceAdjustment:raw.priceAdjustment?{...raw.priceAdjustment}:null,expectedTradingDates:raw.expectedTradingDates?.slice(),suspended:raw.suspended,corporateActionUnresolved:raw.corporateActionUnresolved,priceAdjustmentConsistent:raw.priceAdjustmentConsistent});
}
function currentEvidence(bars){
 const z=bars.at(-1),mean=n=>bars.length>=n?bars.slice(-n).reduce((s,b)=>s+b.close,0)/n:null;
 const ma5=mean(5),ma10=mean(10),ma20=mean(20),rsi5=bars.length>=6?U.rsi(bars,5):null,rsi14=bars.length>=15?U.rsi(bars,14):null,atr14=bars.length>=15?U.atr(bars,14):null;
 const recent=bars.slice(-10),previous=recent,high=Math.max(...previous.map(b=>b.high)),low=Math.min(...previous.map(b=>b.low));
 const swingHigh=[],swingLow=[];
 for(let i=2;i<bars.length-2;i++){const w=bars.slice(i-2,i+3),b=bars[i];if(w.every(c=>c===b||c.high<b.high))swingHigh.push({date:b.date,price:b.high,confirmedAt:bars[i+2].date});if(w.every(c=>c===b||c.low>b.low))swingLow.push({date:b.date,price:b.low,confirmedAt:bars[i+2].date});}
 const bias=ma5!==null&&ma20!==null?(z.close>ma5&&ma5>ma20?'STRONG':z.close<ma5&&ma5<ma20?'WEAK':'NEUTRAL'):'INSUFFICIENT_DATA';
 const volumeBase=bars.length>=6?bars.slice(-6,-1).reduce((s,b)=>s+b.volume,0)/5:null,volumeRatio=volumeBase?z.volume/volumeBase:null;
 const deviation5=pct(z.close,ma5),deviation20=pct(z.close,ma20),atrPct=atr14?atr14/z.close*100:null;
 const risk=[rsi5>=80?'最近5日漲得急，追高後可能回落':null,deviation5!==null&&atrPct!==null&&deviation5>atrPct*2?'股價離5日平均價超過兩倍近期平均波動，追價風險較高':null,atrPct>=6?'近期平均每日波動較大，價格可能快速上下變動':null].filter(Boolean);
 return {currentTrend:{state:bias,label:LABELS[bias],dataAsOf:z.date,ma5,ma10,ma20,deviation5,deviation20,rsi5,rsi14,atr14,volumeRatio,recentHigh:high||null,recentLow:low||null,swingHigh:swingHigh.at(-1)||null,swingLow:swingLow.at(-1)||null,recentBarCount:recent.length},chaseRisk:{level:risk.length?'ELEVATED':'UNDETERMINED',reasons:risk.length?risk:['目前未觸發急漲提醒，仍不代表追價安全']}};
}
function observe(e,bars,structure=currentEvidence(bars).currentTrend){
 const p=e.lifeLinePrice,s=e.lifecycleState;
 const descriptions={RESISTANCE_WATCH:'股價還沒正式站上 '+p+' 元，接下來觀察收盤能不能突破。',BREAKOUT_INITIAL:'股價已經收盤站上 '+p+' 元，接下來觀察能不能繼續守住。',BREAKOUT_HELD:'股價已連續收盤站在 '+p+' 元上方，接下來要看近期高低點和成交量。',RETEST_HELD:'股價回頭測試 '+p+' 元附近後仍守住，仍要留意近期走勢。',BREAKOUT_FAILED:'股價之前曾突破 '+p+' 元，但現在又跌回關卡，代表原本的突破已經失守。',SUPPORT_WATCH:'股價尚未收盤跌破 '+p+' 元支撐，繼續觀察能不能守住。',SUPPORT_BROKEN:'股價收盤跌破 '+p+' 元支撐，需要觀察能不能重新站回。',SUPPORT_RECLAIMED:'股價已經重新站回 '+p+' 元上方，但還需要其他證據確認是否真的轉強。'};
 const summary=e.referenceOnly?'這條 '+p+' 元生命線現在主要作為以前的重要價位參考。'+(e.firstBreakoutDate?'股價曾於 '+e.firstBreakoutDate+' 首次收盤突破。':''):(descriptions[s]||'目前資料不足，暫時無法確認這條生命線的最新狀態。');
 const bullish=e.referenceOnly||['BREAKOUT_HELD','RETEST_HELD'].includes(s)?'觀察收盤能否站上近期高點 '+structure.recentHigh+' 元，並配合成交量；不能只看以前的生命線。':s==='RESISTANCE_WATCH'||s==='BREAKOUT_FAILED'?'觀察完成日 K 收盤能否高於 '+p+' 元；盤中漲過不算確認。':s==='BREAKOUT_INITIAL'?'已首次突破，觀察下一完成日 K 收盤能否繼續高於 '+p+' 元。':'觀察收盤能否守住 '+p+' 元，再配合近期高點與成交量。';
 return {summary,bullish,bearish:e.referenceOnly?'觀察近期低點 '+structure.recentLow+' 元與短期平均價是否失守。':['SUPPORT_WATCH','SUPPORT_RECLAIMED'].includes(s)?'若完成日 K 收盤低於 '+p+' 元，才算支撐失守；相等不算跌破。':s==='SUPPORT_BROKEN'?'若收盤仍無法高於 '+p+' 元，支撐尚未重新站回。':'若收盤回到 '+p+' 元或以下，突破便未繼續守住。',neutral:'等於關卡不算突破或收復；支撐收盤相等不算跌破，突破後相等則算失守。',falseBreak:'盤中漲過但收盤未站上，不算正式突破。',falseBreakdown:'盤中跌破但收盤站回，不算正式跌破。',confirmed:e.events.filter(x=>x.confirmedAt).map(x=>({kind:x.kind,date:x.date,price:x.price})),pending:s==='BREAKOUT_INITIAL'?['後續連續收盤是否守住']:['近期高低點與成交量是否配合']};
}
return Object.freeze({VERSION,MODEL,DEFAULT,LABELS,STATES,LIFECYCLE_STATES,validate,detect,trace,evaluate,withSource,currentEvidence,observe});
});
