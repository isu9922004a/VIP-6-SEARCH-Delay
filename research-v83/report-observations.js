/* Completed-bar observations for reports only. No model reweighting or trading gates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouReportObservations=api;})(globalThis,function(){
'use strict';
const VERSION='REPORT_OBSERVATIONS_8_6_4',PARAM=Object.freeze({minBars:63,rangeBars:20,pivotLeft:2,pivotRight:2,pivotWarmup:35,maxPivotAge:10,maxPairDistance:40,eventAge:20,epsilonRatio:1e-6});
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const unavailable=reason=>freeze({version:VERSION,state:'UNAVAILABLE',reason,momentum:null,divergence:null,levels:[],action:null,researchOnly:true,performanceValidated:false,tradeAllowed:false,affectsOriginalScore:false,affectsOriginalRanking:false,parameters:PARAM});
function ema(values,n){let x=values[0];return values.map((v,i)=>i?(x+=(v-x)*2/(n+1)):x);}
function macd(bars){const c=bars.map(z=>z.close),fast=ema(c,12),slow=ema(c,26),dif=fast.map((x,i)=>x-slow[i]),signal=ema(dif,9);return dif.map((x,i)=>({date:bars[i].date,dif:x,signal:signal[i],hist:x-signal[i]}));}
function momentum(m,epsilon){const z=m.at(-1),change=z.dif-m.at(-2).dif,histogramChange=z.hist-m.at(-2).hist;let code,text,short;
 if(Math.abs(z.dif)<=epsilon){code='BALANCED';text='上漲和下跌的力道接近，方向還不清楚。';short='多空力道接近';}
 else if(Math.abs(change)<=epsilon){code=z.dif>0?'UP_STEADY':'DOWN_STEADY';text=z.dif>0?'目前仍偏向上漲，但力道與昨天差不多，仍要看價格能否守住。':'目前仍偏向下跌，但力道與昨天差不多，仍要留意價格是否繼續走弱。';short=z.dif>0?'上漲力道與昨天接近':'下跌力道與昨天接近';}
 else if(z.dif>0&&change>0){code='UP_GROWING';text='上漲力道比昨天增強，仍要看價格能否繼續站穩，不能保證明天上漲。';short='上漲力道增強';}
 else if(z.dif>0){code='UP_SLOWING';text='上漲力道比昨天放慢，先看後續能否繼續上漲；這不代表已經轉跌。';short='上漲力道放慢，還不是轉跌確認';}
 else if(change>0){code='DOWN_EASING';text='下跌力道比昨天減弱，但還不能直接說已經止跌，先看價格能否站穩。';short='下跌力道減弱，還不是止跌確認';}
 else{code='DOWN_GROWING';text='下跌力道比昨天增強，先留意重要價位是否繼續跌破。';short='下跌力道增強';}
 return {...z,change,histogramChange,definition:'DIF_SIGN_AND_DAILY_CHANGE',code,text,short};
}
function divergence(b,m,epsilon){const highs=[],lows=[];for(let i=PARAM.pivotWarmup-1;i<b.length-2;i++){const near=[b[i-2],b[i-1],b[i+1],b[i+2]];if(near.every(z=>b[i].high>z.high))highs.push(i);if(near.every(z=>b[i].low<z.low))lows.push(i);}
 const candidates=[];for(const [kind,indices,key] of [['UP_WEAKENING',highs,'high'],['DOWN_EASING',lows,'low']]){const j=indices.at(-1),i=indices.filter(i=>i<=j-3&&j-i<=PARAM.maxPairDistance).at(-1);if(i===undefined||j===undefined||b.length-1-(j+2)>PARAM.maxPivotAge)continue;
  const up=kind==='UP_WEAKENING',matches=up?b[j].high>b[i].high+epsilon&&m[i].dif>epsilon&&m[j].dif>epsilon&&m[j].dif<m[i].dif-epsilon:b[j].low<b[i].low-epsilon&&m[i].dif< -epsilon&&m[j].dif< -epsilon&&m[j].dif>m[i].dif+epsilon;
  if(!matches)continue;
  // Once the old momentum extreme is recovered, do not keep a stale warning.
  const later=m.slice(j+2);if(later.some(z=>up?z.dif>=m[i].dif:z.dif<=m[i].dif))continue;
  candidates.push({code:kind,firstDate:b[i].date,secondDate:b[j].date,knownAt:b[j+2].date,firstPrice:b[i][key],secondPrice:b[j][key],firstDIF:m[i].dif,secondDIF:m[j].dif,text:up?'股價曾創更高點，但當時上漲力道沒跟上，先留意是否漲不動；這不代表明天一定下跌。':'股價曾跌到更低點，但當時下跌力道減弱；先看能否站穩，不能直接認定已止跌。'});
 }return candidates.sort((x,y)=>y.knownAt.localeCompare(x.knownAt))[0]||null;
}
function levels(b,unit){const last=b.at(-1),money=x=>String(+x.toFixed(2))+' '+unit;let up=null,down=null;
 for(let i=20;i<b.length;i++){const z=b[i],prior=b.slice(i-20,i),hi=Math.max(...prior.map(x=>x.high)),lo=Math.min(...prior.map(x=>x.low));
  if(up&&i-up.index>PARAM.eventAge)up=null;if(down&&i-down.index>PARAM.eventAge)down=null;
  if(up?.status==='HELD'&&z.close<up.price)up={...up,status:'FAILED',changedAt:z.date};
  if(down?.status==='BELOW'&&z.close>=down.price)down={...down,status:'RECLAIMED',changedAt:z.date};
  if(z.close>hi&&(!up||up.status!=='HELD'))up={price:hi,index:i,date:z.date,knownAt:z.date,referenceDate:prior.filter(x=>x.high===hi).at(-1).date,status:'HELD'};
  if(z.close<lo&&(!down||down.status!=='BELOW'))down={price:lo,index:i,date:z.date,knownAt:z.date,referenceDate:prior.filter(x=>x.low===lo).at(-1).date,status:'BELOW'};
 }
 const prior=b.slice(-21,-1),hi=Math.max(...prior.map(x=>x.high)),lo=Math.min(...prior.map(x=>x.low)),out=[];
 const add=(code,price,text,anchor)=>out.push({code,price,text,date:last.date,knownAt:last.date,referenceDate:anchor?.referenceDate||prior.filter(x=>x[code.startsWith('UP_')?'high':'low']===price).at(-1).date,referenceRule:anchor?'FIXED_FIRST_CLOSE_BREAK':'PRIOR_20_COMPLETED_BARS'});
 if(up?.status==='FAILED'&&up.changedAt===last.date)add('UP_BREAK_FAILED',up.price,`先前收盤漲過 ${money(up.price)}，今天又跌回下方，原本轉強的判斷要重新檢查。`,up);
 else if(last.high>hi&&last.close<=hi)add('UP_INTRADAY_REJECTED',hi,`盤中漲過 ${money(hi)}，但收盤沒有站上，先別只看盤中上漲就追買。`);
 else if(up?.status==='HELD')add(up.date===last.date?'UP_FIRST_CLOSE':'UP_HELD',up.price,up.date===last.date?`收盤已站上 ${money(up.price)}，先看之後能否守住；漲過一天還不能保證持續上漲。`:`收盤仍守住先前漲過的 ${money(up.price)} 這個價位；若再收盤跌回下方，就要重新評估。`,up);
 if(down?.status==='RECLAIMED'&&down.changedAt===last.date)add('DOWN_RECLAIMED',down.price,`先前跌破 ${money(down.price)}，今天收盤已漲回這個價位，仍要看後續能否守住。`,down);
 else if(last.low<lo&&last.close>=lo)add('DOWN_INTRADAY_RECLAIMED',lo,`盤中跌破 ${money(lo)}，但收盤已收回這個價位；先看明天能否守住，還不能直接說已止跌。`);
 else if(down?.status==='BELOW')add('DOWN_CLOSE_LOST',down.price,`收盤仍低於先前跌破的 ${money(down.price)}，先留意走勢是否繼續變弱。`,down);
 return out;
}
function analyze(input,{unit='元'}={}){
 const rows=input?.bars;if(input?.verified!==true||input.completed!==true||!Array.isArray(rows)||rows.length<PARAM.minBars)return unavailable('完整歷史價格還沒核對，先不判斷漲跌力道或關卡是否站穩。');
 if(rows.some((z,i)=>!z||!/^\d{4}-\d{2}-\d{2}$/.test(z.date)||i&&z.date<=rows[i-1].date||z.completed===false||!['open','high','low','close'].every(k=>Number.isFinite(z[k])&&z[k]>0)||z.high<Math.max(z.open,z.close)||z.low>Math.min(z.open,z.close))||rows.at(-1).date!==input.asOf||Number.isFinite(input.close)&&rows.at(-1).close!==input.close)return unavailable('價格、日期或收盤資料不一致，先不補上分析。');
 if(input.calendar&&(!input.calendar.verified||!Array.isArray(input.calendar.dates)||input.calendar.dates.filter(d=>d>=rows[0].date&&d<=input.asOf).join('|')!==rows.map(z=>z.date).join('|')))return unavailable('交易日期還沒核對，先不使用可能缺日的價格做判斷。');
 let cut=0;for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].open/rows[i-1].close-1)>.30)cut=i;const b=rows.slice(cut);if(b.length<PARAM.minBars)return unavailable('股價大幅跳動之後的完整資料還不夠，暫不比較前後漲跌力道。');
 const m=macd(b),epsilon=Math.max(1e-8,b.at(-1).close*PARAM.epsilonRatio),force=momentum(m,epsilon),weak=divergence(b,m,epsilon),observations=levels(b,unit),rejected=observations.some(x=>['UP_BREAK_FAILED','UP_INTRADAY_REJECTED'].includes(x.code)),reclaimed=observations.some(x=>['DOWN_RECLAIMED','DOWN_INTRADAY_RECLAIMED'].includes(x.code));
 const action=rejected?'先等價格重新站穩上方關卡，別只看到盤中上漲就追買。':reclaimed?'先看收回的價位能否守住；暫時回升還不等於已經轉強。':weak?.code==='UP_WEAKENING'?'上漲力道沒跟上時，先等價格與成交量再確認，別只靠模型偏多追買。':weak?.code==='DOWN_EASING'?'跌勢放慢只是初步線索，仍要等價格站穩，再核對原本的買進條件。':null;
 return freeze({version:VERSION,state:'AVAILABLE',date:input.asOf,momentum:force,divergence:weak,levels:observations,action,compact:[force.short,weak?'前後兩次高低點的價格與力道沒有同步，仍須等價格確認':null,observations.find(x=>['UP_BREAK_FAILED','UP_INTRADAY_REJECTED','DOWN_RECLAIMED','DOWN_INTRADAY_RECLAIMED'].includes(x.code))?.text].filter(Boolean).join('；'),researchOnly:true,performanceValidated:false,tradeAllowed:false,affectsOriginalScore:false,affectsOriginalRanking:false,parameters:PARAM});
}
function fromStock(a){const x=a?.kronosInput,proof=a?.validation?.verifiedDataSources?.find(e=>e.scope==='VALIDATED_DAILY_OHLCV');if(proof?.calendarVerified!==true||proof?.priceBasisVerified!==true||proof.date!==a.date||a?.validation?.technicalModelAvailable!==true||!x||String(x.symbol)!==String(a.code)||x.market!==a.validation.market||x.asOf!==a.date||!a.sourceBars?.length||x.bars?.at(-1)?.close!==a.sourceBars.at(-1).close)return unavailable('這檔股票的完整價格與日期還沒核對，先不補上分析。');return analyze({...x,verified:true,completed:true,close:a.sourceBars?.at(-1)?.close});}
function fromMarket(input){if(input?.calendar?.verified!==true)return unavailable('大盤交易日期還沒核對，先不補上分析。');return analyze({...input,verified:true},{unit:'點'});}
return {VERSION,PARAM,analyze,fromStock,fromMarket,macd};
});
