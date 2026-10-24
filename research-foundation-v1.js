(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./research-common-v1.js'):r.ShitouResearchCommon);if(typeof module==='object'&&module.exports)module.exports=a;else r.ShitouResearchFoundation=a;})(globalThis,function(U){
'use strict';
const {ma,pct,mean,check,geometry,PARAM:P}=U,VERSION='3DAY-STRUCTURE.1-GRANVILLE.1-CANDLE-REVERSAL.1-DRAX-ALERT.1-DUALSCAN.1';
function threeDay(b,r){
 if(b.length<24)return {state:'INSUFFICIENT_DATA',label:'資料不足',events:[]};
 let event=null;const events=[];
 for(let i=20;i<b.length;i++){
  const z=b[i],h=b.slice(i-20,i),m=ma(b,20,i),g=geometry(z),v=mean(h.slice(-5).map(x=>x.volume));
  if(event){const age=i-event.index;
   if(age>0&&z.close<event.invalidation){event={...event,state:'FAILED',label:'結構失效',failedDate:z.date};}
   else if(event.state==='D1_LAUNCH'&&age===1){
    if(z.close<z.open&&z.volume>=event.launch.volume*P.d2Volume){event={...event,state:'D2_PULLBACK',label:'放量回檔／多空未確認',d2:z,d2Index:i,supporting:['尚守發動低點'],contrary:[g.closeLocation<.3?'收近低點，賣壓警戒':'放量黑K不能證明洗盤']};}
    else event=null;
   }else if(event.state==='D2_PULLBACK'&&i===event.d2Index+1){
    if(z.volume<event.d2.volume*P.d3Volume&&z.low>=event.d2.low&&z.close>z.open&&z.close>=event.d2.close&&z.close<=event.d2.open&&z.close>=m)event={...event,state:'D3_STABILIZING',label:'縮量止跌／再攻待確認',d3:z,d3Index:i,trigger:z.high,invalidation:Math.max(event.invalidation,event.d2.low)};
    else event=null;
   }else if(event.state==='D3_STABILIZING'&&i>event.d3Index){
    if(i-event.d3Index>P.confirmBars)event=null;
    else if(z.close>event.trigger&&z.volume>=v*P.volumeConfirm)event={...event,state:'D4_CONFIRMED',label:'再次突破已確認',confirmedDate:z.date};
   }else if(event.state==='D4_CONFIRMED'&&i-event.d3Index>5)event=null;
  }
  if(!event||event.state==='FAILED'){
   const priorHigh=Math.max(...h.map(x=>x.high)),gain=pct(z.close,b[i-1].close),limit=r.limitUpHistory?.find(x=>x.date===z.date&&x.verified&&x.source&&x.unadjusted===true),strict=!!(limit&&U.num(limit.price)!==null&&z.close===limit.price);
   if(z.close>priorHigh&&[5,10,20].every(n=>z.close>ma(b,n,i))&&ma(b,20,i)>ma(b,20,i-1)&&z.volume>=v*P.volumeConfirm&&(strict||gain>=P.d1GainPct))event={state:'D1_LAUNCH',label:strict?'漲停發動（已核驗）':'強勢發動（RELAXED研究）',mode:strict?'STRICT':'RELAXED',index:i,signalDate:z.date,launch:z,trigger:priorHigh,invalidation:z.low,supporting:['收盤突破前20根高點','均線與量能支持'],contrary:[...(g.longUpper?['長上影風險']:[]),...(!limit?['實際漲停制度資料未驗證']:[])]};
  }
  if(event)events.push({date:z.date,state:event.state});
 }
 return {version:'THREE_DAY_STRUCTURE_V1',...(event||{state:'NOT_FORMED',label:'未形成'}),asOfDate:b.at(-1).date,events};
}
function granville(b,f){
 const signals=[],periods={};if(b.length<24)return {state:'GRANVILLE_INSUFFICIENT_DATA',signals,periods};
 for(const n of [5,10,20,60,120,200]){const v=f.ma[n];if(v.slope===null)continue;const i=b.length-1,z=b[i],p=b[i-1],a=ma(b,n,i-1),old=ma(b,n,i-4),slope=v.slope,tol=Math.max(U.tick(z.close), (f.atr14||0)*.3),dist=v.distance;
  const priorAbove=p.close>a,above=z.close>v.value,turn=old!==null&&a<=old&&slope>=0,up=slope>0,down=slope<0;
  const add=(code,label,confirmed=true)=>signals.push({code,label,maPeriod:n,date:z.date,confirmed,value:v.value,slope,distance:dist});
  if(!priorAbove&&above&&turn)add('G1','均線轉強突破');
  if(up&&above&&b.slice(-4,-1).some((x,j)=>x.close<ma(b,n,b.length-4+j)))add('G2','上升均線跌破後收復');
  if(up&&z.low<=v.value+tol&&z.close>=v.value&&z.close>z.open&&z.volume<(f.volumePrior5||0))add('G3','上升均線縮量回踩');
  if(dist<-P.maGapPct&&z.close>p.close)add('G4','超跌反彈／未證明反轉',false);
  if(priorAbove&&!above&&slope<=0)add('G5','跌破均線轉弱');
  const priorCross=b.slice(-4,-1).some((x,j)=>x.close>ma(b,n,b.length-4+j));
  if(down&&priorCross&&!above)add('G6','下降均線穿越後再失守');
  else if(down&&!priorAbove&&above)add('G6','下降均線反彈穿越／待確認',false);
  if(down&&!above&&z.high>=v.value-tol&&z.close<p.close)add('G7','下降均線反彈遇壓');
  const atrDistance=f.atr14>0?(z.close-v.value)/f.atr14:null;
  if(dist>P.maGapPct&&atrDistance>P.atrGap)add('G8','高乖離追價警戒',false);
  let aboveDays=0,belowDays=0;for(let k=i;k>=n-1;k--){if(b[k].close>ma(b,n,k)&&belowDays===0)aboveDays++;else if(b[k].close<ma(b,n,k)&&aboveDays===0)belowDays++;else break;}
  periods[n]={...v,tolerance:tol,atrDistance,aboveDays,belowDays,retests:b.slice(-10).filter((x,j)=>{const mm=ma(b,n,b.length-10+j);return mm!==null&&x.low<=mm+tol&&x.close>=mm;}).length};
 }
 return {version:'GRANVILLE_CONTEXT_V1',state:signals.length?'GRANVILLE_CONTEXT':'GRANVILLE_NEUTRAL',signals,periods,parameterVersion:P.version};
}
function candles(b){
 if(b.length<24)return {state:'INSUFFICIENT_DATA',patterns:[]};const patterns=[];
 for(let i=Math.max(20,b.length-4);i<b.length;i++){
  const z=b[i],h=b.slice(i-20,i),g=geometry(z),hi=Math.max(...h.map(x=>x.high)),lo=Math.min(...h.map(x=>x.low)),location=hi>lo?(z.close-lo)/(hi-lo):null,slope=pct(ma(b,10,i-1),ma(b,10,i-4)),trend=slope>0?'UP':slope<0?'DOWN':'SIDEWAYS_CONTEXT',low=trend==='DOWN'&&location<=.35,high=trend==='UP'&&location>=.65;
  if(g.flat)continue;const shapes=[];
  if(g.longLower&&low)shapes.push(['C1','久跌長下影','HAMMER','UP']);
  if(g.doji&&low)shapes.push(['C2','低位十字星','DOJI','UP']);
  if(g.longUpper&&high&&g.closeLocation<=.5)shapes.push(['C3','高位射擊之星','SHOOTING_STAR','DOWN']);
  if(g.doji&&high)shapes.push(['C4','高位十字星','DOJI','DOWN']);
  if(g.longLower&&high&&g.closeLocation>=.6)shapes.push(['C5','高位吊頸線','HANGING_MAN','DOWN']);
  if(low&&!g.doji&&!g.longLower&&g.bodyRatio<=.3&&g.upperRatio>=.25&&g.lowerRatio>=.25)shapes.push(['C6','底部小實體長影','SPINNING_TOP','UP']);
  else if(low&&g.longUpper&&!g.doji)shapes.push(['C6','低位倒錘頭候選','INVERTED_HAMMER_CANDIDATE','UP']);
  for(const [code,label,shape,direction] of shapes){let stage='AWAIT_CONFIRMATION',confirmedDate=null,failedDate=null;for(let j=i+1;j<b.length&&j<=i+P.confirmBars;j++){const x=b[j];if(x.high>z.high&&x.low<z.low){stage='AMBIGUOUS';break;}const success=direction==='UP'?x.close>z.high:x.close<z.low,failure=direction==='UP'?x.close<z.low:x.close>z.high;if(failure){stage='FAILED';failedDate=x.date;break;}if(success){stage='CONFIRMED';confirmedDate=x.date;break;}}
   if(stage==='AWAIT_CONFIRMATION'&&b.length-1-i>=P.confirmBars)stage='EXPIRED';
   patterns.push({patternCode:code,patternLabelZh:label,shape,shapeMetrics:g,priorTrend:trend,priceLocation:location,asOfDate:b.at(-1).date,signalDate:z.date,stage,confirmedDate,failedDate,direction,confirmTrigger:direction==='UP'?z.high:z.low,invalidationTrigger:direction==='UP'?z.low:z.high,volumeEvidence:{volume:z.volume,prior5:mean(h.slice(-5).map(x=>x.volume))},sourceOHLCV:{...z},parameterVersion:P.version,explanationZh:direction==='UP'?'低位反彈觀察；不能直接取得主升資格':'高位警戒；不能由單根型態認定必跌'});
  }
 }
 return {version:'CANDLE_REVERSAL_V1',state:patterns.length?'DETECTED':'NOT_FORMED',patterns};
}
function dual(b,r,f){
 const e=r.researchSources||{},period=e.rsi?.period,validRsi=e.rsi?.verified===true&&e.rsi.timeframe==='1D'&&e.rsi.formula==='WILDER_RMA'&&Number.isInteger(period)&&period>0&&e.rsi.source,rsi=validRsi?U.rsi(b,period):null,z=b.at(-1),p=b.at(-2),date=z.date;
 const source=x=>U.available(x,r)&&x.asOf===date;
 const chip=e.chipConcentration,chipOK=source(chip)&&chip.window==='1D'&&chip.denominator&&U.num(chip.valuePct)!==null;
 const d=e.turnoverDenominator,denOK=source(d)&&d.definitionVerified===true&&['ISSUED','OUTSTANDING','LISTED'].includes(d.type)&&d.effectiveDate<=date&&d.validThrough>=date&&d.unit==='shares'&&d.shares>0;
 const rank=e.tradeValueRank,rankOK=source(rank)&&rank.sourceType==='OFFICIAL_REPORTED'&&rank.completeUniverse===true&&rank.originalPlatformUniverseVerified===true&&rank.universe==='TWSE_TPEX_COMMON'&&Number.isInteger(rank.rank)&&rank.rank>0;
 const a=[check('RSI_GT_65',rsi===null?null:rsi>65,'原平台期數未核實時為UNKNOWN'),check('MA20_CLOSE_CROSS',b.length>=21?p.close<=ma(b,20,b.length-2)&&z.close>ma(b,20):null),check('CHIP_GT_20',chipOK?chip.valuePct>20:null,'須有同日公式、分母、發布時間與來源')];
 const turnover=denOK?z.volume/d.shares*100:null,bb=[check('RSI_GT_70',rsi===null?null:rsi>70),check('TURNOVER_GT_10',turnover===null?null:turnover>10),check('OFFICIAL_VALUE_TOP100',rankOK?rank.rank<=100:null)];
 const state=x=>x.some(c=>c.status==='FAIL')?'RESEARCH_NOT_MATCH':x.some(c=>c.status==='UNKNOWN')?'DATA_UNVERIFIED':'RESEARCH_MATCH';
 return {version:'DUAL_SHORT_TERM_SCAN_V1',marketDate:date,modeA:{status:state(a),checks:a,rsi:{period:validRsi?period:null,value:rsi,verified:!!validRsi},ma20Cross:{previousClose:p?.close,previousMA20:ma(b,20,b.length-2),todayMA20:f.ma[20].value,intradayOnly:z.high>f.ma[20].value&&z.close<=f.ma[20].value},chipConcentration:chipOK?chip:null},modeB:{status:state(bb),checks:bb,turnoverPct:turnover,denominator:denOK?d:null,tradeValueRank:rankOK?rank:null},researchOnly:true,affectsOriginalEligibility:false,affectsOriginalScore:false,affectsOriginalRanking:false};
}
function alert(r,three){
 const z=(r.canonicalBars||r.dailySeries)?.at(-1),b=U.num(r.originalB),valid=!!(z&&r.completed===true&&!r.suspended),rule=r.tickRuleVerified===true&&['TWSE','TPEX'].includes(r.market),fallback=three?.state==='D3_STABILIZING'?three.trigger:null,raw=b>0?b:fallback,above=valid&&rule&&U.legal(raw)?raw:null,low=U.num(r.originalInvalidation),below=valid&&rule&&U.legal(low)?low:null;
 // Unknown DRAX operators: preserve a clearly marked draft; never claim exact first notification.
 return {version:'DRAX_ALERT_PLAN_V1',provider:'DRAX',providerUrl:'https://drax.tw/',stockCode:String(r.stock||r.code||''),analysisMarketDate:r.marketDate||r.closeDate||r.dataDate,nextTradingDate:valid?U.nextDate(r):null,priceAbove:{input:above,desiredFirstTrigger:above===null?null:U.step(above),basis:b>0?'原策略B價':fallback?'D3高點':null,operatorVerified:false,alreadyCrossed:above!==null&&z.close>above},priceBelow:{input:below,desiredFirstTrigger:below===null?null:U.step(below,-1),basis:below===null?null:'原策略失效線',operatorVerified:false,alreadyCrossed:below!==null&&z.close<below},dayGainPercentInput:valid?5:null,dayLossPercentInput:valid?5:null,appEntryStatus:'NOT_VERIFIED',providerIntegrationStatus:'MANUAL_ONLY',notificationStatus:'UNVERIFIED',operatorStatus:'OPERATOR_UNVERIFIED',note:'待手動輸入並核對平台語意；行情與通知可能延遲。日期未知時須先確認交易日，過時提醒須手動修改。'};
}
function joint(t,g,c){const signals=g?.signals||[],up=signals.some(x=>['G1','G2','G3'].includes(x.code)),down=signals.some(x=>['G5','G6','G7'].includes(x.code)&&x.confirmed),heat=signals.some(x=>x.code==='G8'),strong=['D1_LAUNCH','D3_STABILIZING','D4_CONFIRMED'].includes(t?.state),high=c?.patterns.some(x=>x.direction==='DOWN'&&!['FAILED','EXPIRED'].includes(x.stage));return {state:heat?'OVEREXTENSION_WARNING':(up||strong)&&(down||high)?'MIXED_SIGNALS':down||t?.state==='FAILED'?'BEARISH_ALIGNMENT':up&&strong?'STRONG_ALIGNMENT':up||strong?'PARTIAL_ALIGNMENT':'INSUFFICIENT_DATA',affectsScore:false,evidenceFamilies:['PRICE_STRUCTURE','TREND_MA','CANDLE_GEOMETRY','MOMENTUM','VOLUME','RISK','DATA_QUALITY']};}
function evaluate(r,options={}){r=structuredClone(r);const flags=U.flags(options.flags),n=U.validate(r);if(!n.ok)return U.freeze({version:VERSION,state:'INSUFFICIENT_DATA',reason:n.reason,flags});const b=n.bars,f=options.features||U.features(b),t=flags.threeDayStructureEnabled?threeDay(b,r):null,g=flags.granvilleContextEnabled?granville(b,f):null,c=flags.candlePatternEnabled?candles(b):null;return U.freeze({version:VERSION,state:'RESEARCH_ONLY',threeDayStructure:t,granvilleContext:g,candlePatternContext:c,jointValidation:flags.jointValidationEnabled?joint(t,g,c):null,dualScanContext:flags.dualScanEnabled?dual(b,r,f):null,alertPlan:flags.alertPlanEnabled?alert(r,t):null,flags});}
return Object.freeze({VERSION,threeDay,granville,candles,dual,alert,joint,evaluate});
});
