/* Shared completed-bar research primitives. No network, gates, scores or orders. */
(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./tower-line-core.js'):r.ShitouTowerCore);if(typeof module==='object'&&module.exports)module.exports=a;else r.ShitouResearchCommon=a;})(globalThis,function(T){
'use strict';
const VERSION='RESEARCH_COMMON_1';
const DEFAULTS=Object.freeze({threeDayStructureEnabled:true,granvilleContextEnabled:true,candlePatternEnabled:true,jointValidationEnabled:true,experimentalRankingEnabled:false,dualScanEnabled:true,dualScanExperimentalRankingEnabled:false,dualScanStrictValidationEnabled:true,alertPlanEnabled:true,directAlertIntegrationEnabled:false,webPushEnabled:false,fourModelsEnabled:true});
const PARAM=Object.freeze({version:'RESEARCH_PARAMS_1',slopeBars:3,trendWindow:20,doji:.10,wickRatio:.50,wickBody:2,confirmBars:3,d1GainPct:3,d2Volume:1.1,d3Volume:.7,volumeConfirm:1.2,maGapPct:8,atrGap:2,breakoutReturnMin:5,breakoutReturnMax:15,volumeGrowth:1.15,volumeDeltaLots:1000});
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const mean=a=>a.length&&a.every(v=>num(v)!==null)?a.reduce((s,v)=>s+v,0)/a.length:null;
const ma=(b,n,i=b.length-1)=>i+1>=n?mean(b.slice(i-n+1,i+1).map(x=>x.close)):null;
const pct=(a,b)=>num(a)!==null&&b>0?(a/b-1)*100:null;
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function hash(x){const s=JSON.stringify(x);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}
const flags=x=>({...DEFAULTS,...x,directAlertIntegrationEnabled:false,webPushEnabled:false});
function validate(r){
 if(r.completed!==true||r.isComplete===false||r.suspended===true)return {ok:false,reason:'未確認已完成日K／停牌'};
 const n=T.normalize(r,{asOf:r.marketDate||r.closeDate||r.dataDate,completed:true});if(!n.ok)return n;
 if(r.corporateActionUnresolved||r.priceAdjustmentConsistent===false)return {ok:false,reason:'價格還原口徑衝突'};
 const unit=r.volumeUnit||r.dailySeriesMeta?.volumeUnit;
 if(!['shares','lots','thousand_shares'].includes(unit))return {ok:false,reason:'成交量單位未驗證'};
 n.bars=n.bars.map(b=>({...b,volume:b.volume*(unit==='shares'?1:1000)}));
 if(n.bars.some(b=>b.volume<=0))return {ok:false,reason:'零量或停牌'};
 return n;
}
function rsi(b,n=14){if(b.length<=n)return null;let g=0,l=0;for(let i=1;i<=n;i++){const d=b[i].close-b[i-1].close;g+=Math.max(d,0);l+=Math.max(-d,0);}g/=n;l/=n;for(let i=n+1;i<b.length;i++){const d=b[i].close-b[i-1].close;g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;}return g===0&&l===0?50:l===0?100:100-100/(1+g/l);}
function atr(b,n=14){if(b.length<=n)return null;const tr=[];for(let i=1;i<b.length;i++)tr.push(Math.max(b[i].high-b[i].low,Math.abs(b[i].high-b[i-1].close),Math.abs(b[i].low-b[i-1].close)));let v=mean(tr.slice(0,n));for(let i=n;i<tr.length;i++)v=(v*(n-1)+tr[i])/n;return v;}
function tick(p){return p<10?.01:p<50?.05:p<100?.1:p<500?.5:p<1000?1:5;}
function legal(p){return p>0&&Math.abs(p/tick(p)-Math.round(p/tick(p)))<1e-7;}
function step(p,d=1){if(!legal(p)||![1,-1].includes(d))return null;const c=Math.round(p*100);for(let k=1;k<=500;k++){const q=(c+d*k)/100;if(legal(q))return q;}return null;}
function geometry(b){const range=b.high-b.low,body=Math.abs(b.close-b.open),upper=b.high-Math.max(b.open,b.close),lower=Math.min(b.open,b.close)-b.low,t=tick(b.close);return {range,body,upper,lower,bodyRatio:range?body/range:null,upperRatio:range?upper/range:null,lowerRatio:range?lower/range:null,closeLocation:range?(b.close-b.low)/range:null,tickSize:t,flat:range<t,doji:range>=2*t&&body/range<=PARAM.doji,longLower:range>=2*t&&lower>=PARAM.wickBody*Math.max(body,t)&&lower/range>=PARAM.wickRatio&&upper<lower/2,longUpper:range>=2*t&&upper>=PARAM.wickBody*Math.max(body,t)&&upper/range>=PARAM.wickRatio&&lower<upper/2};}
function features(b){const z=b.at(-1),p=b.at(-2),m={};for(const n of [5,10,20,60,120,200]){const v=ma(b,n),old=ma(b,n,b.length-1-PARAM.slopeBars);m[n]={value:v,slope:pct(v,old),distance:pct(z.close,v)};}return {ma:m,rsi5:rsi(b,5),rsi10:rsi(b,10),rsi14:rsi(b,14),atr14:atr(b),return5:b.length>5?pct(z.close,b.at(-6).close):null,return3:b.length>3?pct(z.close,b.at(-4).close):null,volumePrior5:b.length>=6?mean(b.slice(-6,-1).map(x=>x.volume)):null,volumeLatest5:b.length>=5?mean(b.slice(-5).map(x=>x.volume)):null,prior20High:b.length>20?Math.max(...b.slice(-21,-1).map(x=>x.high)):null,prior20Low:b.length>20?Math.min(...b.slice(-21,-1).map(x=>x.low)):null,red:z.close>z.open,bodyDeclinePct:pct(z.close,z.open),candle:geometry(z),volumeChangeLots:p?(z.volume-p.volume)/1000:null};}
function cutoff(r){const date=r.marketDate||r.closeDate||r.dataDate,s=r.signalAt||(date+'T13:35:00+08:00'),valid=typeof s==='string'&&/[T].*(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));return valid&&new Date(Date.parse(s)+8*3600000).toISOString().slice(0,10)===date?s:null;}
function available(x,r){const t=cutoff(r);return !!(x?.verified===true&&x.source&&x.formula&&t&&typeof x.publishedAt==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x.publishedAt)&&Number.isFinite(Date.parse(x.publishedAt))&&Date.parse(x.publishedAt)<=Date.parse(t));}
function check(id,value,detail=''){return {id,status:value===null||value===undefined?'UNKNOWN':value?'PASS':'FAIL',detail};}
function status(checks){return checks.some(c=>c.status==='FAIL')?'不符合':checks.some(c=>c.status==='UNKNOWN')?'資料不足':'符合';}
function nextDate(r){const c=r.tradingCalendar,d=r.marketDate||r.closeDate||r.dataDate;if(r.suspended||!c?.verified||!c.source||!Array.isArray(c.dates)||c.dates.some((x,i)=>!T.date(x)||i&&x<=c.dates[i-1])||!c.dates.includes(d))return null;const next=c.dates.find(x=>x>d);return next&&c.start<=d&&c.end>=next?next:null;}
function weeks(b,r){
 const c=r.tradingCalendar,asOf=b.at(-1).date;
 if(!c?.verified||!c.source||!Array.isArray(c.dates)||!c.start||!c.end||c.end<asOf||c.dates.some((d,i)=>!T.date(d)||i&&d<=c.dates[i-1]))return {value:null,reason:'缺已核驗正式交易日曆，不能以100日MA代替20週MA',bars:[]};
 const groups=new Map();for(const z of b){const d=new Date(z.date+'T00:00:00Z'),w=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-w);const monday=d.toISOString().slice(0,10);if(!groups.has(monday))groups.set(monday,[]);groups.get(monday).push(z);}
 const rows=[];for(const [m,g] of groups){const dt=new Date(m+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()+4);const fri=dt.toISOString().slice(0,10);if(m<c.start||fri>c.end)continue;const expected=c.dates.filter(d=>d>=m&&d<=fri);if(expected.at(-1)>asOf)continue;if(!expected.length||JSON.stringify(expected)!==JSON.stringify(g.map(x=>x.date)))return {value:null,reason:'已完成週日K缺漏／與日曆不符',bars:[]};rows.push({week:m,end:g.at(-1).date,close:g.at(-1).close});}
 return {value:rows.length>=20?mean(rows.slice(-20).map(x=>x.close)):null,reason:rows.length<20?'已完成正式週K不足20週':null,bars:rows};
}
return Object.freeze({VERSION,DEFAULTS,PARAM,T,num,mean,ma,pct,freeze,hash,flags,validate,rsi,atr,tick,legal,step,geometry,features,cutoff,available,check,status,nextDate,weeks});
});
