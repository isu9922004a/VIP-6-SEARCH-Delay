/* Post-close selection overlay. Original monthly gates and all scores are read-only. */
(function(root,factory){const api=factory();root.ShitouSwingRisk5329=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,function(){
'use strict';
const POLICY=Object.freeze({version:'R5.3.2.9',minBars:65,trend:20,background:60,persistence:5,maxGap:8,maxRsi:75});
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function date(v){let s=String(v??'').replace(/\D/g,'');if(s.length===7)s=String(Number(s.slice(0,3))+1911)+s.slice(3);if(s.length!==8)return null;const d=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);return !Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:null;}
const sma=(b,i,n,k='close')=>i+1<n?null:b.slice(i+1-n,i+1).reduce((s,r)=>s+r[k],0)/n;
function evaluate(input,targetDate,quote){
 const r=input?.report||input||{},source=r.dailySeries||r.canonicalBars,asOf=date(targetDate||r.closeDate||r.dataDate),bad=reason=>({key:'DATA',pass:false,date:asOf,reasons:[reason],model:POLICY.version,dataTiming:'POST_CLOSE_ONLY'});
 if(!asOf||!Array.isArray(source)||source.length<POLICY.minBars)return bad('至少65根完成日K與明確盤後資料日才可檢查波段持續性');
 let previous='';const bars=[];
 for(const row of source){const d=date(row.date),b={date:d};for(const k of ['open','high','low','close','volume'])b[k]=num(row[k]);
  if(!d||d<=previous||d>asOf||row.completed===false||row.isComplete===false||['open','high','low','close'].some(k=>!(b[k]>0))||b.volume===null||b.volume<0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close))return bad('日K日期、完成狀態或OHLCV不完整；不補值、不使用未來資料');
  bars.push(b);previous=d;
 }
 const i=bars.length-1,b=bars[i],p=bars[i-1];if(b.date!==asOf||date(r.closeDate||r.dataDate)!==asOf)return bad('市場與個股完成日K日期不同');
 if(quote&&(date(quote.quoteDate)!==asOf||num(quote.close)!==b.close))return bad('快照與個股日期／收盤不一致');
 if(r.priceAdjustmentConsistent===false||r.corporateActionUnresolved===true)return bad('除權息／價格調整口徑未完成核對');
 const ma20=sma(bars,i,20),ma60=sma(bars,i,60),gap=(b.close/ma20-1)*100,run5=(b.close/bars[i-5].close-1)*100;
 let gain=0,loss=0;for(let j=1;j<=5;j++){const d=bars[j].close-bars[j-1].close;gain+=Math.max(0,d)/5;loss+=Math.max(0,-d)/5;}
 for(let j=6;j<=i;j++){const d=bars[j].close-bars[j-1].close;gain=(gain*4+Math.max(0,d))/5;loss=(loss*4+Math.max(0,-d))/5;}
 const rsi=loss===0?(gain===0?50:100):100-100/(1+gain/loss),avg5=sma(bars,i-1,5,'volume');if(!(avg5>0&&b.volume>0))return bad('成交量不足，無法檢查量價效率');
 const volumeRatio=b.volume/avg5,range=b.high-b.low,pos=range>0?(b.close-b.low)/range:.5,upper=range>0?(b.high-Math.max(b.open,b.close))/range:0;
 const reasons=[],wait=[];let held=0;
 for(let j=i-4;j<=i;j++)if(bars[j].close>=sma(bars,j,20))held++;
 if(!(b.close>ma20&&ma20>sma(bars,i-5,20)))reasons.push('收盤未站上上彎20日線');
 if(!(b.close>=ma60&&ma60>=sma(bars,i-5,60)))wait.push('60日趨勢背景尚未轉強');
 if(held<5)wait.push(`近5個完成交易日僅${held}日守住各自20日線；等待持續性`);
 if(gap>POLICY.maxGap||rsi>POLICY.maxRsi)reasons.push(`超出既有強勢延續上限：20日乖離${gap.toFixed(2)}%／RSI5 ${rsi.toFixed(2)}`);
 if(run5>15&&gap>=8)reasons.push('近5日急漲且遠離20日線');
 if(upper>=.35&&pos<.65)reasons.push('長上影且收盤位置偏弱');
 if(volumeRatio>=3&&((b.close/p.close-1)*100<2||pos<.6))reasons.push('大量但價格未能推進；不推測主力行為');
 let event=null,failed=null;for(let j=Math.max(20,i-19);j<=i;j++){
  const level=Math.max(...bars.slice(j-20,j).map(x=>x.high));
  if(event&&bars[j].close<=event.level){failed={...event,failedDate:bars[j].date,failedIndex:j};event=null;}
  // Retain the first still-valid breakout anchor. Successive highs do not reset confirmation to day zero.
  if(!event&&bars[j].close>level){event={date:bars[j].date,index:j,level};failed=null;}
  if(j===i&&b.high>level&&b.close<=level)reasons.push('盤中越過前20日高點，但完成收盤未守住');
 }
 let lifecycle='整理中';if(event){if(event.index===i){lifecycle='突破當日';wait.push('只有突破當日證據；等待下一根完成日K，不能預判隔日站穩');}else if(b.low<=event.level){lifecycle='回測成功';}else lifecycle='突破確認中';}else if(failed&&failed.failedIndex>=i-4){lifecycle='突破失敗';reasons.push(`${failed.failedDate}收盤跌回${failed.date}突破關卡${failed.level.toFixed(2)}；等待新結構`);}
 const key=reasons.length?'REJECT':wait.length?'WAIT':'PASS';
 return {model:POLICY.version,key,pass:key==='PASS',date:asOf,dataTiming:'POST_CLOSE_ONLY',reasons:[...reasons,...wait],ma20,ma60,gap,rsi,run5,volumeRatio,closePosition:pos,heldDays:held,lifecycle,event:event?{date:event.date,level:event.level}:null,invalidation:event?`完成收盤<=${event.level.toFixed(2)}`:'完成收盤跌回20日線／趨勢不再延續',identity:'隔日沖身分資料未提供；僅觀察日K量價風險',adjustment:r.priceAdjustment||r.adjustmentMode||'來源調整口徑未提供，不作績效推論'};
}
function apply(candidate,target,quote){if(!candidate)return candidate;const x=evaluate(candidate,target,quote);candidate.swingRisk5329=x;if(candidate.eligible===true&&!x.pass){candidate.eligible=false;candidate.formalLaunchEligible=false;candidate.safeEligible=false;candidate.reason=x.reasons.join('；');candidate.baseFilterFail=x.key!=='DATA';candidate.hardGateFail=false;candidate.baseFails=[...(candidate.baseFails||[]),...x.reasons];candidate.status=x.key==='DATA'?'DATA':'REJECT';}return candidate;}
function describe(x){return !x?'波段風險資料不足':`盤後波段檢查 ${x.key}｜${x.date||'日期不足'}｜${x.lifecycle||'未判斷'}｜${x.reasons.length?x.reasons.join('；'):'5日守20日線、60日背景與防過熱檢查通過'}｜隔日沖身分未提供`;
}
return Object.freeze({POLICY,evaluate,apply,describe,sma});
});
