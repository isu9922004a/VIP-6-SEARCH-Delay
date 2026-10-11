/* 石頭少爺 V50｜三策略共用：完成日K波段續強防追高／假突破風險閘。
 * 不更動月K20MA、突破品質0～10、原分級或原始分數；不查盤中／即時資料。
 * 這是基於價格與成交量的「疑似」隔日短沖風險代理，絕非券商分點真實證據。
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ShitouSwingAfterCloseGuardV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const VERSION='SWING_AFTERCLOSE_R1';
const RULE=Object.freeze({minBars:60,ma20Lookback:20,minAbove20Last5:4,minAbove20Last3:3,maxMa20GapPct:13,maxFiveDayRisePct:17,maxTenDayRisePct:27,hugeVolumeRatio:3.5,breakoutHoldDays:2});
const num=x=>{if(x===null||x===undefined||x==='')return null;const n=Number(typeof x==='string'?x.replace(/,/g,''):x);return Number.isFinite(n)?n:null;};
function iso(d){const m=String(d??'').replace(/\D/g,'');if(!/^\d{8}$/.test(m))return null;const s=`${m.slice(0,4)}-${m.slice(4,6)}-${m.slice(6)}`,t=new Date(s+'T00:00:00Z');return Number.isFinite(+t)&&t.toISOString().slice(0,10)===s?s:null;}
const avg=(a,k)=>{const v=a.slice(-k);return v.length===k&&v.every(x=>Number.isFinite(x))?v.reduce((x,y)=>x+y,0)/k:null;};
const change=(v,u)=>(u>0?(v/u-1)*100:null);
function barsOf(candidate){const rep=candidate?.report||candidate||{};const out=rep.dailySeries||rep.canonicalBars||candidate?.metrics?.bars||candidate?.wave?.bars;return Array.isArray(out)?out:null;}
function assess(candidate,options={}){
  const raw=barsOf(candidate),reasons=[],evidence=[];
  const result=(status,score=0)=>({status,score,eligible:status==='READY',reasons:[...new Set(reasons)],evidence,version:VERSION,onlyClosedDaily:true,proxyNotBrokerData:true,monthlyQualified:null});
  if(!raw||raw.length<RULE.minBars){reasons.push(`完整日K不足 ${RULE.minBars} 根，無法判斷波段續強`);return result('DATA');}
  const bars=[],set=new Set();for(const x of raw){const d=iso(x.date),o=num(x.open),h=num(x.high),l=num(x.low),c=num(x.close),v=num(x.volume);if(!d||set.has(d)||(bars.length&&d<=bars.at(-1).date)||![o,h,l,c,v].every(n=>n!==null)||o<=0||c<=0||l<=0||v<=0||h<Math.max(o,c,l)||l>Math.min(o,c,h)){reasons.push('日K日期、成交量或OHLC資料不完整');return result('DATA');}bars.push({date:d,open:o,high:h,low:l,close:c,volume:v});set.add(d);}
  const last=bars.at(-1),today=iso(options.marketDate),reported=iso((candidate?.report||candidate)?.closeDate),reportClose=num((candidate?.report||candidate)?.close);
  if(!today||last.date!==today||(reported&&reported!==today)||(reportClose!==null&&Math.abs(last.close-reportClose)>Math.max(.05,last.close*.001))){reasons.push(`非同日完整收盤資料：市場${today||'缺漏'}，日K${last.date}`);return result('DATA');}
  const ends=bars.map((_,i)=>i>=19?avg(bars.slice(i-19,i+1).map(r=>r.close),20):null),ma20=ends.at(-1),ma20Prev=ends.at(-6);
  if(!(ma20>0&&ma20Prev>0)){reasons.push('20日均線計算所需資料不足');return result('DATA');}
  const ma5=avg(bars.map(x=>x.close),5),close=last.close,gap20=change(close,ma20),fiveRise=change(close,bars.at(-6).close),tenRise=change(close,bars.at(-11).close);
  const vol5=avg(bars.slice(-6,-1).map(x=>x.volume),5),vol20=avg(bars.slice(-21,-1).map(x=>x.volume),20),volRatio=vol5>0?last.volume/vol5:null;
  const range=Math.max(last.high-last.low,1e-9),closePos=(close-last.low)/range,upperShadow=(last.high-Math.max(last.open,close))/range;
  const dayRise=change(close,bars.at(-2).close),above5=bars.slice(-5).filter((r,i)=>r.close>(ends[ends.length-5+i]||Infinity)).length,above3=bars.slice(-3).filter((r,i)=>r.close>(ends[ends.length-3+i]||Infinity)).length;
  const slope=change(ma20,ma20Prev),recentHigh=Math.max(...bars.slice(-21,-1).map(r=>r.high));
  // 每根K在當下只使用該K以前資料，避免事後誤把未完成突破當已確認。
  const priorBreaks=[];for(let i=Math.max(20,bars.length-11);i<bars.length;i++){
    const neck=Math.max(...bars.slice(i-20,i).map(r=>r.high));
    if(bars[i].close>neck*1.002&&bars[i-1].close<=neck*1.002)priorBreaks.push({i,neck});
  }
  const lastBreak=priorBreaks.at(-1)||null,age=lastBreak?bars.length-1-lastBreak.i:null;
  const failedBreak=priorBreaks.some(b=>b.i<bars.length-1&&bars.slice(b.i+1).some(r=>r.close<b.neck*.993));
  let risk=0,score=60;
  if(close<=ma20||slope<=0||ma5<ma20||above5<RULE.minAbove20Last5||above3<RULE.minAbove20Last3){risk+=3;reasons.push('日20MA未持續上彎／近5日站穩不足，非持續恆強');}
  else{score+=14;evidence.push(`日20MA上揚 ${slope.toFixed(1)}%，近5日有 ${above5} 日收在日20MA上方`);}
  if(gap20>RULE.maxMa20GapPct){risk+=2;reasons.push(`高檔延伸：距日20MA ${gap20.toFixed(1)}%，超過${RULE.maxMa20GapPct}%`);}else if(gap20>=0&&gap20<=9){score+=8;evidence.push(`日20MA乖離 ${gap20.toFixed(1)}%，未顯著遠離均線`);}
  if(fiveRise>RULE.maxFiveDayRisePct||tenRise>RULE.maxTenDayRisePct){risk+=2;reasons.push(`短期累計漲幅過大：5日 ${fiveRise.toFixed(1)}%／10日 ${tenRise.toFixed(1)}%`);}else if(fiveRise>0&&fiveRise<11){score+=6;evidence.push(`近5日上漲 ${fiveRise.toFixed(1)}%，不是連續急噴`);}
  if(failedBreak){risk+=4;reasons.push('近10日突破後再收盤跌回當時前20日高點以下（假突破已出現）');}
  if(lastBreak&&age<RULE.breakoutHoldDays){risk+=1;reasons.push(`突破才 ${age} 個完整交易日，未取得 ${RULE.breakoutHoldDays} 日收盤確認`);}
  if(close>recentHigh*1.002&&closePos<.67){risk+=2;reasons.push('創近期新高，但收盤落在當日區間偏下方（突破品質待確認）');}
  if(upperShadow>.43&&closePos<.65){risk+=2;reasons.push('長上影且收盤偏弱，疑似拉高後賣壓');}
  if(volRatio!==null&&volRatio>RULE.hugeVolumeRatio&&(closePos<.6||upperShadow>.34)){risk+=3;reasons.push(`異常放量 ${volRatio.toFixed(1)} 倍但收盤位置偏弱；疑似短線資金快速換手`);}
  if(dayRise>=7&&volRatio!==null&&volRatio>=2.5){risk+=1;reasons.push(`單日急漲 ${dayRise.toFixed(1)}% 且放量 ${volRatio.toFixed(1)} 倍，隔日獲利了結風險增加`);}
  // 日K OHLCV 無法辨認券商隔日沖：僅作風險代理指標，不標示確定隔日沖。
  if(volRatio!==null&&volRatio>=.65&&volRatio<=2.5)score+=6;
  if(vol20>0&&last.volume>=vol20*.7)score+=3;
  if(closePos>=.7)score+=3;
  if(lastBreak&&age>=RULE.breakoutHoldDays&&!failedBreak&&close>lastBreak.neck){score+=7;evidence.push(`突破後已維持 ${age} 個完整交易日，仍站上突破參考價`);}
  score=Math.max(0,Math.min(100,Math.round(score-risk*7)));
  const status=risk>=3?'BLOCK':risk>0?'WATCH':'READY';
  if(!reasons.length)evidence.push('沒有觸發本版假突破／急漲／過熱風險閘；不代表未來一定續漲');
  return {...result(status,score),measure:{date:last.date,close,ma20,ma20SlopePct:slope,ma20GapPct:gap20,ma5,fiveRisePct:fiveRise,tenRisePct:tenRise,dayRisePct:dayRise,volumeRatio5:volRatio,closePos,upperShadow,aboveMa20Last5:above5,breakoutAge:age,breakoutReference:lastBreak?.neck??null,volume20:vol20}};
}
function filter(list,options={}){
 const original=Array.isArray(list)?list:[],ready=[],watch=[],blocked=[],missing=[];
 for(const c of original){const guard=assess(c,options);c.swingAfterClose=guard;if(guard.status==='READY')ready.push(c);else if(guard.status==='WATCH')watch.push(c);else if(guard.status==='BLOCK')blocked.push(c);else missing.push(c);}
 const rank=(a,b)=>(b.swingAfterClose?.score??0)-(a.swingAfterClose?.score??0);
 ready.sort(rank);watch.sort(rank);
 return {ready,watch,blocked,missing,originalCount:original.length,version:VERSION,date:iso(options.marketDate),policy:'盤後收盤日K、持續強勢但避免高檔過熱；新增風險層不動原始分數'};
}
return Object.freeze({VERSION,RULE,iso,assess,filter});
});
