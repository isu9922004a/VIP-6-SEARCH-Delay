/* 石頭少爺 V50 共用量價波段核心：盤後完成日K，不預測、不偷看未來；新增費波回撤「量尺」層，只量位置，不把比例當反轉保證。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ShitouWaveCoreV48=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const T=typeof module==='object'&&module.exports?require('./teacher-three-pan-core.js'):globalThis.ShitouTeacherThreePan;
const MODEL='SHITOU_WAVE_CORE_V50_FIB_RETRACE';
const RELEASE='石頭少爺 Agent V50 正式版｜R5.3.2.7｜三盤量價與個股報告優化版';
const FIB_RATIOS=Object.freeze([0,.236,.382,.5,.618,.786,1]);
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(typeof v==='string'?v.replace(/,/g,''):v);return Number.isFinite(n)?n:null;};
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sma=(rows,key,n,end=rows.length)=>end>=n?avg(rows.slice(end-n,end).map(x=>num(x?.[key])).filter(Number.isFinite)):null;
const pct=(a,b)=>a!==null&&b>0?(a/b-1)*100:null;
const arrow=v=>v>0?'↑':v<0?'↓':'→';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function normalizeBars(source){const v=T.validate(source);return v.ok?v.bars:[];}
function confirmedPivots(bars,left=3,right=3){
  const out=[];if(!Array.isArray(bars)||bars.length<left+right+3)return out;
  for(let i=left;i<bars.length-right;i++){
    const h=bars[i].high,l=bars[i].low;let ph=true,pl=true;
    for(let j=i-left;j<=i+right;j++){if(j===i)continue;if(bars[j].high>=h)ph=false;if(bars[j].low<=l)pl=false;}
    if(ph)out.push({type:'H',index:i,date:bars[i].date,price:h});
    if(pl)out.push({type:'L',index:i,date:bars[i].date,price:l});
  }
  out.sort((a,b)=>a.index-b.index||(a.type==='L'?-1:1));
  const clean=[];
  for(const p of out){
    const prev=clean.at(-1);
    if(prev&&prev.type===p.type){
      if((p.type==='H'&&p.price>prev.price)||(p.type==='L'&&p.price<prev.price))clean[clean.length-1]=p;
    }else clean.push(p);
  }
  return clean;
}
function selectCompletedSwing(bars){
  const pivots=confirmedPivots(bars,3,3);if(pivots.length<2)return null;
  for(let i=pivots.length-1;i>=1;i--){
    const a=pivots[i-1],b=pivots[i];if(a.type===b.type||b.index-a.index<2)continue;
    if(a.type==='L'&&b.type==='H'&&b.price>a.price)return {direction:'UP',start:a,end:b,pivots};
    if(a.type==='H'&&b.type==='L'&&a.price>b.price)return {direction:'DOWN',start:a,end:b,pivots};
  }
  return null;
}
function fibLevelPrice(swing,ratio){
  const span=Math.abs(swing.end.price-swing.start.price);if(!(span>0))return null;
  return swing.direction==='UP'?swing.end.price-span*ratio:swing.end.price+span*ratio;
}
function fibZone(direction,ratioPct){
  if(!Number.isFinite(ratioPct))return {key:'NA',label:'資料不足',risk:'unknown'};
  if(ratioPct<0)return direction==='UP'?{key:'BEYOND',label:'已突破前波高點',risk:'strong'}:{key:'BEYOND',label:'已跌破前波低點',risk:'weak'};
  if(ratioPct<=23.6)return {key:'VERY_SHALLOW',label:direction==='UP'?'回吐很淺':'反彈很淺',risk:'low'};
  if(ratioPct<=38.2)return {key:'SHALLOW',label:direction==='UP'?'淺度回檔':'淺度反彈',risk:'low'};
  if(ratioPct<=50)return {key:'NORMAL',label:direction==='UP'?'正常整理':'中等反彈',risk:'normal'};
  if(ratioPct<=61.8)return {key:'MID_DEEP',label:direction==='UP'?'回檔偏深':'反彈偏深',risk:'watch'};
  if(ratioPct<=78.6)return {key:'DEEP',label:direction==='UP'?'深度回檔':'深度反彈',risk:'watch'};
  if(ratioPct<=100)return {key:'STRUCTURE_RISK',label:direction==='UP'?'原波段優勢大多已回吐':'原跌勢大多已回補',risk:'high'};
  return {key:'BROKEN',label:direction==='UP'?'原上漲波段已完全回吐':'原下跌波段已被完全回補',risk:'high'};
}
function analyzeFib(bars,context={}){
  const swing=selectCompletedSwing(bars);if(!swing)return {ok:false,reason:'找不到已確認的完整波段高低點'};
  const close=bars.at(-1).close,span=Math.abs(swing.end.price-swing.start.price);if(!(span>0))return {ok:false,reason:'波段幅度為0'};
  const ratioPct=swing.direction==='UP'?(swing.end.price-close)/span*100:(close-swing.end.price)/span*100;
  const levels={};for(const r of FIB_RATIOS)levels[String(r)]=fibLevelPrice(swing,r);
  const z=fibZone(swing.direction,ratioPct);
  const inRange=ratioPct>=0&&ratioPct<=100;
  let band=null;
  if(inRange){
    const bounded=ratioPct/100;
    let lower=0,upper=.236;
    for(let i=0;i<FIB_RATIOS.length-1;i++){if(bounded>=FIB_RATIOS[i]&&bounded<=FIB_RATIOS[i+1]){lower=FIB_RATIOS[i];upper=FIB_RATIOS[i+1];break;}}
    const p1=fibLevelPrice(swing,lower),p2=fibLevelPrice(swing,upper);
    const zoneLow=Math.min(p1,p2),zoneHigh=Math.max(p1,p2);
    const bandText=`${(lower*100).toFixed(lower===0?0:1)}%～${(upper*100).toFixed(1)}%`;
    band={lower,upper,label:bandText,low:zoneLow,high:zoneHigh,inRange:true};
  }
  const priceConfirm=swing.direction==='UP'
    ?!!(context.threeBreakout||(context.ma8!==null&&close>context.ma8&&context.maSlope?.ma8>=0&&context.mvSlope?.mv5>0))
    :!!(context.threeBreakdown||(context.ma8!==null&&close<context.ma8&&context.maSlope?.ma8<=0));
  let ratioText,positionText,directionText,plain;
  if(ratioPct<0){
    const ext=Math.abs(ratioPct).toFixed(1);
    directionText=swing.direction==='UP'?'上漲波段突破延伸':'下跌波段跌破延伸';
    ratioText=`已超越原波段端點 ${ext}%`;
    positionText='已離開0%～100%回撤區，進入突破／延伸階段';
    plain=swing.direction==='UP'
      ?`前一段從 ${swing.start.price.toFixed(2)} 漲到 ${swing.end.price.toFixed(2)}，最新收盤已突破前波高點並向上延伸；不再用「回吐幾%」描述，也不硬套回撤區間。`
      :`前一段從 ${swing.start.price.toFixed(2)} 跌到 ${swing.end.price.toFixed(2)}，最新收盤已跌破前波低點並向下延伸；不再用「反彈回補幾%」描述，也不硬套回撤區間。`;
  }else if(ratioPct>100){
    const over=(ratioPct-100).toFixed(1);
    directionText=swing.direction==='UP'?'上漲波段結構失守':'下跌波段完全回補';
    ratioText=`已超過原波段100%端點 ${over}%`;
    positionText=swing.direction==='UP'?'已完全回吐原上漲波段並跌破起漲點':'已完全回補原下跌波段並突破起跌點';
    plain=swing.direction==='UP'
      ?`前一段從 ${swing.start.price.toFixed(2)} 漲到 ${swing.end.price.toFixed(2)}，最新收盤已把原上漲波段全部吐回，並跌破原波段起點；不再顯示78.6%～100%的回撤區。`
      :`前一段從 ${swing.start.price.toFixed(2)} 跌到 ${swing.end.price.toFixed(2)}，最新收盤已把原跌勢全部回補，並突破原波段起跌點；不再顯示78.6%～100%的回補區。`;
  }else{
    directionText=swing.direction==='UP'?'上漲波段回吐':'下跌波段反彈回補';
    ratioText=`${ratioPct.toFixed(1)}%`;
    positionText=`目前位於 ${band?.label||'-'} 回撤區`;
    plain=swing.direction==='UP'
      ?`前一段從 ${swing.start.price.toFixed(2)} 漲到 ${swing.end.price.toFixed(2)}，目前約回吐 ${ratioText}，屬於「${z.label}」。這只是量尺，不代表到某個比例就一定反彈。`
      :`前一段從 ${swing.start.price.toFixed(2)} 跌到 ${swing.end.price.toFixed(2)}，目前約反彈回補 ${ratioText}，屬於「${z.label}」。這只是量尺，不代表到某個比例就一定反轉。`;
  }
  return {ok:true,direction:swing.direction,directionText,start:swing.start,end:swing.end,span,ratioPct,ratioText,zone:z,levels,band,inRange,positionText,priceConfirm,plain};
}
function fibTieRank(fib){
  if(!fib?.ok)return 6;if(fib.zone.key==='BROKEN')return 9;if(fib.zone.key==='STRUCTURE_RISK')return 7;
  if(fib.zone.key==='BEYOND')return fib.priceConfirm?0:2;
  if(['VERY_SHALLOW','SHALLOW'].includes(fib.zone.key))return 1;
  if(fib.zone.key==='NORMAL')return 2;if(fib.zone.key==='MID_DEEP')return 3;if(fib.zone.key==='DEEP')return 4;return 5;
}
function analyzeBars(source){
 const a=T.analyze(source);if(!a.ok||a.bars.length<60)return {ok:false,model:MODEL,reason:a.reason||'完整日K少於60根',teacher:a};
 const bars=a.bars,c=bars.at(-1),range=c.high-c.low,ma8=a.ma[8],ma21=a.ma[21],ma55=a.ma[55],mv5=a.mv[5],mv13=a.mv[13],mv34=a.mv[34];
 const maSlope={ma8:a.maSlope[8],ma21:a.maSlope[21],ma55:a.maSlope[55]},mvSlope={mv5:a.mvSlope[5],mv13:a.mvSlope[13],mv34:a.mvSlope[34]};
 const threeBreakout=a.signal.key==='UP',threeBreakdown=a.signal.key==='DOWN',threeBreakoutConfirmed=threeBreakout&&a.volumeStart&&a.strongEnvironment;
 const fib=analyzeFib(bars,{threeBreakout,threeBreakdown,ma8,ma21,ma55,maSlope,mvSlope});
 return {ok:true,model:MODEL,release:RELEASE,date:a.date,close:a.close,phase:a.phase,phaseLabel:a.phaseLabel,plain:a.plain,tone:threeBreakdown?'risk':a.formalEligible?'strong':'watch',score:a.score,
 ma8,ma21,ma55,mv5,mv13,mv34,maSlope,mvSlope,prior5Volume:a.prior5Volume,threePanVolumeRatio:a.threePanVolumeRatio,
 maText:`控盤線8 ${ma8.toFixed(2)}${arrow(maSlope.ma8)}｜中繼線21 ${ma21.toFixed(2)}${arrow(maSlope.ma21)}｜生命線55 ${ma55.toFixed(2)}${arrow(maSlope.ma55)}`,
 mvText:`攻擊量5 ${arrow(mvSlope.mv5)}｜潮汐量13 ${arrow(mvSlope.mv13)}｜趨勢量34 ${arrow(mvSlope.mv34)}`,
 threeBreakout,threeBreakdown,threeBreakoutConfirmed,threeBreakoutUnconfirmed:threeBreakout&&!threeBreakoutConfirmed,threeBreakdownConfirmed:threeBreakdown,threeBreakdownUnconfirmed:false,
 prior2High:a.signal.high,prior2Low:a.signal.low,priceStack:a.priceStack,volumeStack:a.volumeStack,volumeStart:a.volumeStart,healthyPullback:a.healthyPullback,
 anomalyStrong:threeBreakout&&a.longKey==='BEAR_ENV',anomalyWeak:threeBreakdown&&a.longKey==='BULL_ENV',gap21Pct:pct(c.close,ma21),gap55Pct:pct(c.close,ma55),
 fiveDayReturnPct:pct(c.close,bars.at(-6).close),fiveMvChangePct:pct(mv5,sma(bars,'volume',5,bars.length-1)),closePosition:range>0?(c.close-c.low)/range:null,
 support:a.next.low,trigger:a.next.high,evidence:a.evidence,risk:a.risk,fib,fibTieRank:0,bars,teacher:a,formalEligible:a.formalEligible};
}
function analyzeReport(report){return analyzeBars(report?.dailySeries||report?.bars||report?.history||[]);}
function grade(a){if(!a?.ok)return {key:'DATA',label:'資料不足'};if(a.threeBreakdown||a.phase==='WEAKENING')return {key:'REJECT',label:'三盤轉弱排除'};if(!a.formalEligible)return {key:'WATCH',label:'觀察／未取得強勢資格'};if(a.teacher?.tideRising&&a.teacher?.bars.at(-1).low>a.ma8)return {key:'S',label:'強中強'};return {key:'A',label:'量價波段條件通過'};}
function fibText(fib){if(!fib?.ok)return '波段量尺：找不到已確認的完整波段，這一層不硬算。';const pos=fib.inRange&&fib.band?`📍目前落在 ${fib.band.label} 區間（約 ${fib.band.low.toFixed(2)}～${fib.band.high.toFixed(2)}）`:`📍${fib.positionText||'已離開0%～100%回撤區'}`;return `波段量尺：${fib.directionText} ${fib.ratioText}｜${fib.zone.label}｜${pos}｜${fib.priceConfirm?'✅ 已有價格確認':'🟡 仍要等價格確認'}；比例只是量尺，不是反轉保證。`;}
function textBlock(a,title='量價波段白話判讀'){if(!a?.ok)return `【${title}】\n資料不足：${a?.reason||'無法計算'}`;return T.text(a.teacher);}
return Object.freeze({MODEL,RELEASE,FIB_RATIOS,num,sma,normalizeBars,confirmedPivots,selectCompletedSwing,fibLevelPrice,fibZone,analyzeFib,fibTieRank,analyzeBars,analyzeReport,grade,fibText,textBlock});
});
