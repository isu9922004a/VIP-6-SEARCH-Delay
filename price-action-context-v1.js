/* PACTX.1: deterministic completed-bar events, with fixed engineering thresholds.
 * No future bars, intent/order-flow inference, probability score, or automatic promotion.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouPriceActionV1=api;})(globalThis,function(){
'use strict';
const MODEL='PRICE_ACTION_CONTEXT_1';
const RULE=Object.freeze({minBars:26,structureWindow:20,pivotSide:2,eventLookback:10,confirmBars:3,atrDays:14,nearATR:.5,nearPricePct:.005,wickShare:.4,wickBody:2,wickDominance:1.5,dojiShare:.1,confirmVolume:1.2,closePosition:.6,dojiVolume:1.2,highPosition:.8,extendedMA20Pct:8,fall10Pct:-10,anchorBodyShare:.6,anchorATR:1,anchorVolume:.8,reversalVolume:1.5});
const STATES=Object.freeze({SIGNAL:'訊號出現，等待確認',CONFIRMED:'已收復關卡，追蹤延續',RETEST_HELD:'回測守住',CONFIRMATION_LOST:'確認關卡失守，重新等待',FAILED:'條件已失效',EXPIRED:'確認期限已過'});
const TYPES=Object.freeze({SUPPORT_WICK:'支撐附近下影觀察',MIDPOINT_RECLAIM:'區間中點站回觀察',DEEP_REVERSAL:'跌深縮量轉強觀察'});
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function date(v){const m=String(v??'').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);if(!m)return null;const d=m[1]+'-'+m[2]+'-'+m[3],t=new Date(d+'T00:00:00Z');return Number.isFinite(+t)&&t.toISOString().slice(0,10)===d?d:null;}
const fmt=v=>num(v)===null?'資料不足':Number(v).toFixed(2);
function validate(report,options){
 const asOf=date(options.asOf||report.marketDate||report.closeDate||report.dataDate),rows=options.bars||report.canonicalBars||report.dailySeries;
 if(!asOf||options.completed!==true||report.completed===false||report.isComplete===false)return {ok:false,reason:'未確認完成日K或目標交易日'};
 if(date(report.closeDate||report.dataDate||asOf)!==asOf)return {ok:false,reason:'個股與目標日不同'};
 if(report.corporateActionUnresolved===true||report.priceAdjustmentConsistent===false)return {ok:false,reason:'公司行動或價格調整口徑未解決'};
 if(!Array.isArray(rows)||rows.length<RULE.minBars)return {ok:false,reason:'需至少26根完成日K'};
 const bars=[];let previous='';for(const r of rows){const b={date:date(r.date)};for(const k of ['open','high','low','close','volume'])b[k]=num(r[k]);
  if(!b.date||b.date<=previous||b.date>asOf||r.completed===false||r.isComplete===false||r.suspended===true||['open','high','low','close','volume'].some(k=>!(b[k]>0))||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high))return {ok:false,reason:'日K日期、完成狀態或OHLCV無效；不刪列、不補值'};
  bars.push(b);previous=b.date;
 }
 const last=bars.at(-1),eq=(a,b)=>num(a)!==null&&Math.abs(Number(a)-b)<=Math.max(.02,b*.0001);
 if(last.date!==asOf||!eq(report.close??last.close,last.close))return {ok:false,reason:'最後日K與目標日或報告收盤不同'};
 const q=options.quote;if(q&&[q.code,q.stock].some(code=>code&&String(code)!==String(report.stock||report.code||'')))return {ok:false,reason:'市場快照與個股代號不同'};
 if(q?.market&&report.market&&String(q.market).toUpperCase()!==String(report.market).toUpperCase())return {ok:false,reason:'市場快照與個股市場別不同'};
 if(q&&(date(q.quoteDate)!==asOf||!['open','high','low','close'].every(k=>eq(q[k],last[k]))||!(num(q.volume)>0)||Math.abs(q.volume-last.volume)/q.volume>.2))return {ok:false,reason:'市場快照與日K不同日／價／量'};
 if(Array.isArray(report.expectedTradingDates)){const dates=report.expectedTradingDates.map(date),set=new Set(bars.map(b=>b.date));if(dates.some((d,i)=>!d||i&&d<=dates[i-1])||bars.some(b=>!dates.includes(b.date))||dates.some(d=>d>=bars[0].date&&d<=asOf&&!set.has(d)))return {ok:false,reason:'交易日曆與日K缺漏或順序不同'};}
 if(Array.isArray(report.corporateActions)&&report.priceAdjustment?.verified!==true&&report.corporateActions.some(e=>!date(e.date)||date(e.date)>=bars[0].date&&date(e.date)<=asOf))return {ok:false,reason:'觀察期間公司行動的歷史價格調整未驗證'};
 return {ok:true,bars,asOf};
}
function candle(b){const range=b.high-b.low,body=Math.abs(b.close-b.open),upper=b.high-Math.max(b.open,b.close),lower=Math.min(b.open,b.close)-b.low;return {range,body,upper,lower,position:range?(b.close-b.low)/range:.5,doji:range>0&&body/range<=RULE.dojiShare,longUpper:range>0&&upper/range>=RULE.wickShare&&upper>=RULE.wickBody*body&&upper>=RULE.wickDominance*lower,longLower:range>0&&lower/range>=RULE.wickShare&&lower>=RULE.wickBody*body&&lower>=RULE.wickDominance*upper};}
function atr(bars){const start=Math.max(1,bars.length-RULE.atrDays),a=[];for(let i=start;i<bars.length;i++)a.push(Math.max(bars[i].high-bars[i].low,Math.abs(bars[i].high-bars[i-1].close),Math.abs(bars[i].low-bars[i-1].close)));return mean(a);}
function pivots(history){const out=[],s=RULE.pivotSide;for(let i=s;i<history.length-s;i++){const b=history[i],neighbors=history.slice(i-s,i+s+1).filter((_,j)=>j!==s);if(neighbors.every(x=>b.low<x.low))out.push({kind:'LOW',value:b.low,date:b.date,index:i,confirmedAt:history[i+s].date});if(neighbors.every(x=>b.high>x.high))out.push({kind:'HIGH',value:b.high,date:b.date,index:i,confirmedAt:history[i+s].date});}return out;}
function structure(history,current){
 const window=history.slice(-RULE.structureWindow),low=Math.min(...window.map(b=>b.low)),high=Math.max(...window.map(b=>b.high)),ma20=mean(window.map(b=>b.close)),a=atr(history),tolerance=Math.max(current.close*RULE.nearPricePct,(a||0)*RULE.nearATR);
 const ps=pivots(history),support=[{kind:'PRIOR_LOW',label:'前20根低點候選',value:low,date:window.findLast(b=>b.low===low).date}],resistance=[{kind:'PRIOR_HIGH',label:'前20根高點候選',value:high,date:window.findLast(b=>b.high===high).date}];
 const pl=ps.findLast(p=>p.kind==='LOW'),ph=ps.findLast(p=>p.kind==='HIGH');if(pl)support.push({...pl,label:'已確認轉折低點候選'});if(ph)resistance.push({...ph,label:'已確認轉折高點候選'});
 const ma={kind:'MA20',label:'前一完成日20MA',value:ma20,date:history.at(-1).date};(current.close>=ma20?support:resistance).push(ma);
 let swing=null;for(let i=ps.length-1;i>=0;i--){const h=ps[i];if(h.kind!=='HIGH')continue;const l=ps.slice(0,i).findLast(p=>p.kind==='LOW'&&p.value<h.value);if(l){swing={low:l.value,high:h.value,lowDate:l.date,highDate:h.date,confirmedAt:h.confirmedAt};break;}}
 const fib=swing?{...swing,levels:[.382,.5,.618].map(r=>({ratio:r,value:swing.high-(swing.high-swing.low)*r})),source:'訊號日前已確認低→高波段；不使用未來轉折'}:null;
 if(fib)for(const l of fib.levels){l.overlap=[...support,...resistance].filter(x=>Math.abs(x.value-l.value)<=tolerance).map(x=>({kind:x.kind,label:x.label,value:x.value,date:x.date}));l.touched=current.low<=l.value+tolerance&&current.high>=l.value-tolerance;}
 const touched=x=>current.low<=x.value+tolerance&&current.high>=x.value-tolerance;
 return {low,high,midpoint:(low+high)/2,ma20,atr14:a,tolerance,position:high>low?(current.close-low)/(high-low):null,support:support.filter(touched),resistance:resistance.filter(touched),fib,anchorsBeforeSignal:true};
}
const volumeRatio=(bars,i)=>{const a=mean(bars.slice(Math.max(0,i-5),i).map(b=>b.volume));return a>0?bars[i].volume/a:null;};
function eventSeed(bars,i){
 const b=bars[i],h=bars.slice(0,i);if(h.length<25)return [];
 const s=structure(h,b),c=candle(b),out=[];
 const seed=(type,trigger,invalidation,extra={})=>out.push({id:type+':'+b.date,type,label:TYPES[type],signalDate:b.date,signalIndex:i,trigger,invalidation,tolerance:s.tolerance,anchors:{rangeLow:s.low,rangeHigh:s.high,ma20:s.ma20,sourceThrough:h.at(-1).date},...extra});
 if(c.longLower&&s.support.length&&b.close>=Math.min(...s.support.map(x=>x.value))-s.tolerance)seed('SUPPORT_WICK',b.high,b.low,{location:s.support});
 if(s.high>s.low&&h.at(-1).close<=s.midpoint&&b.close>s.midpoint)seed('MIDPOINT_RECLAIM',s.midpoint,s.midpoint-s.tolerance,{location:[{label:'訊號日前20根區間中點',value:s.midpoint}],note:'50%只是區間位置，不當作買賣力量各半或自動買點'});
 const ten=bars[i-10],fall=ten?(b.close/ten.close-1)*100:null,bodyDrop=(b.open-b.close)/b.open,priorDrops=h.slice(-9).map(x=>(x.open-x.close)/x.open),vr=volumeRatio(bars,i);
 if(b.close<b.open&&fall!==null&&fall<=RULE.fall10Pct&&c.range>0&&c.body/c.range>=RULE.anchorBodyShare&&c.body>=(s.atr14||Infinity)*RULE.anchorATR&&bodyDrop>Math.max(0,...priorDrops)&&vr!==null&&vr<=RULE.anchorVolume)seed('DEEP_REVERSAL',b.high,b.low,{fall10Pct:fall,anchorVolumeRatio5:vr,note:'近10根最大陰線實體比例，且跌深縮量；不是已知底部'});
 return out;
}
function follow(bars,seed){
 const e={...seed,state:'SIGNAL',confirmedDate:null,retestDate:null,failedDate:null,expiresAfter: RULE.confirmBars},start=seed.signalIndex;
 for(let j=start+1;j<bars.length;j++){
  const b=bars[j],age=j-start,c=candle(b),vr=volumeRatio(bars,j);
  if(e.state==='FAILED'||e.state==='EXPIRED')break;
  if(seed.type==='DEEP_REVERSAL'&&age===1&&b.low<seed.invalidation){e.state='FAILED';e.failedDate=b.date;e.failureReason='訊號次根低點再創低';break;}
  if(b.close<seed.invalidation){e.state='FAILED';e.failedDate=b.date;e.failureReason='完成收盤跌破失效價';break;}
  const holds=b.low<=seed.trigger+seed.tolerance&&b.close>seed.trigger;
  if(!e.confirmedDate){
   if(seed.type==='MIDPOINT_RECLAIM'&&holds&&vr!==null&&vr<=RULE.confirmVolume){e.state='RETEST_HELD';e.confirmedDate=b.date;e.retestDate=b.date;}
   else if(b.close>seed.trigger&&b.close>b.open&&c.position>=RULE.closePosition&&vr!==null&&vr>=(seed.type==='DEEP_REVERSAL'?RULE.reversalVolume:RULE.confirmVolume)){e.state='CONFIRMED';e.confirmedDate=b.date;}
   else if(age>=RULE.confirmBars)e.state='EXPIRED';
  }else if(b.close<=seed.trigger)e.state='CONFIRMATION_LOST';
  else if(holds){e.state='RETEST_HELD';e.retestDate=b.date;}
  else e.state=e.retestDate?'RETEST_HELD':'CONFIRMED';
 }
 e.statusLabel=STATES[e.state];e.asOf=bars.at(-1).date;e.age=bars.length-1-start;e.confirmedNow=['CONFIRMED','RETEST_HELD'].includes(e.state);return e;
}
function evaluate(input,options={}){
 const report=input?.report||input||{},base={model:MODEL,performanceValidated:false,affectsScore:false,automaticPromotion:false,executionAllowed:false,thresholdBasis:'固定工程定義，未做績效調參'},v=validate(report,options);
 if(!v.ok)return {...base,state:'DATA',date:date(options.asOf||report.closeDate),reason:v.reason,concerns:[],waiting:[],events:[],reversal:[]};
 const b=v.bars,last=b.at(-1),s=structure(b.slice(0,-1),last),c=candle(last),vr=volumeRatio(b,b.length-1),gap=(last.close/s.ma20-1)*100;
 const highLocation=(s.position!==null&&s.position>=RULE.highPosition)||gap>=RULE.extendedMA20Pct;
 const concerns=[],waiting=[];
 if(highLocation&&s.resistance.length&&((c.longUpper&&c.position<.5)||(c.doji&&vr!==null&&vr>=RULE.dojiVolume)))concerns.push('漲高且接近既有壓力候選，長上影弱收／放量十字顯示收盤未延續；新買先等待');
 const events=[];for(let i=Math.max(25,b.length-RULE.eventLookback);i<b.length;i++)for(const seed of eventSeed(b,i))events.push(follow(b,seed));
 events.sort((a,z)=>z.signalDate.localeCompare(a.signalDate)||a.type.localeCompare(z.type));
 const continuation=events.filter(e=>e.type!=='DEEP_REVERSAL'),reversal=events.filter(e=>e.type==='DEEP_REVERSAL');
 const types=[...new Set(continuation.map(e=>e.type))];
 for(const type of types){const group=continuation.filter(e=>e.type===type),latest=group[0],risk=group.find(e=>e.state==='CONFIRMATION_LOST'||e.state==='FAILED'&&last.close<e.invalidation);
  if(risk)concerns.push(risk.label+'：'+risk.statusLabel+'；完成收盤 '+fmt(last.close)+'，失效參考 '+fmt(risk.invalidation));
  else if(latest.state==='SIGNAL'&&!group.some(e=>e.confirmedNow))waiting.push(latest.label+'尚未確認，不能因單根K棒或比例位置取得正式資格');
 }
 const fibText=s.fib?s.fib.levels.filter(l=>l.touched).map(l=>({ratio:l.ratio,level:l.value,structuralOverlap:l.overlap,meaning:l.overlap.length?'與既有結構候選重合，仍需價格確認':'只有比例接近，無獨立結構佐證'})):[];
 return {...base,state:concerns.length?'CAUTION':waiting.length?'WATCH':'OBSERVE',date:v.asOf,concerns,waiting,events,continuation,reversal,
  candle:c,location:{priorLow:s.low,priorHigh:s.high,midpoint:s.midpoint,priorMA20:s.ma20,position:s.position,gap20Pct:gap,support:s.support,resistance:s.resistance,tolerance:s.tolerance,atr14:s.atr14},fib:{available:!!s.fib,anchor:s.fib?{lowDate:s.fib.lowDate,highDate:s.fib.highDate,confirmedAt:s.fib.confirmedAt}:null,touched: fibText,changesEligibility:false},volumeRatio5:vr,
  warnings:[...(report.priceAdjustment?.verified!==true?['價格還原基準未驗證，僅供研究']:[]),...(!Array.isArray(report.expectedTradingDates)?['未附完整交易日曆']:[]),'日K不能證明盤中路徑、主力意圖或多空力量各半'],
  meaning:'風險與等待條件可降低正式資格；反轉另列觀察，不提高分數、不提升原策略資格'};
}
function eventText(e){return `${e.label}｜${e.statusLabel}｜訊號 ${e.signalDate}${e.confirmedDate?'／確認 '+e.confirmedDate:''}${e.retestDate?'／回測 '+e.retestDate:''}${e.failedDate?'／失效 '+e.failedDate:''}｜確認關卡 ${fmt(e.trigger)}／失效價 ${fmt(e.invalidation)}${e.failureReason?'｜'+e.failureReason:''}`;}
function describe(a){if(!a||a.state==='DATA')return '位置量價確認：資料不足｜'+(a?.reason||'未計算');const events=a.events.slice(0,4);return ['位置量價確認｜'+a.date,...a.concerns,...a.waiting,...events.map(eventText),...(a.fib.touched.length?a.fib.touched.map(l=>`比例 ${(l.ratio*100).toFixed(1)}%／${fmt(l.level)}：${l.meaning}`):['比例位置不單獨加分']), '反轉訊號僅列獨立觀察；工程門檻尚未驗證命中率'].join('；');}
return Object.freeze({MODEL,RULE,STATES,TYPES,date,validate,candle,structure,pivots,eventSeed,follow,evaluate,eventText,describe});
});
