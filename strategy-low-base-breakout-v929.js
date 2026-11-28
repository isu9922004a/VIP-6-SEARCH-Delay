/* V9.29 candidate: hard gates, deterministic quality score and verified initial breakout levels. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./kline-attack-v90.js'):root.ShitouKlineAttack,node?require('./restaurant-filter-v1.js'):root.ShitouRestaurantCore,node?require('./research-n-continuation-v1.js'):root.ShitouNContinuation);
 if(node)module.exports=api;else root.ShitouLowBaseBreakoutV929=api;
})(globalThis,function(K,Old,N){
'use strict';
const MODEL='LOW_BASE_VOLUME_BREAKOUT_V1',MIN_BARS=62;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const mean=(a,k)=>a.reduce((s,x)=>s+x[k],0)/a.length;
const pct=(a,b)=>(a/b-1)*100;
function rsi(b,n){
 if(b.length<=n)return null;
 let g=0,l=0;
 for(let i=1;i<=n;i++){let d=b[i].close-b[i-1].close;g+=Math.max(d,0);l+=Math.max(-d,0);}
 g/=n;l/=n;
 for(let i=n+1;i<b.length;i++){let d=b[i].close-b[i-1].close;g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;}
 return l===0?(g===0?50:100):100-100/(1+g/l);
}
const clamp=x=>Math.max(0,Math.min(1,x));
const BASIC_KEYS=['revenue12High','revenueYoYPositive','revenue3mYoYPositive','epsAbove1','grossMarginAbove1787','netMarginAbove873','inventoryTurnoverAbove1','grossMargin8qHigh'];
function quality(f,b,fundamentals=null,asOf=null){
 const t=b.length-1,last=b[t],prev=b[t-1];
 const ma60Prev=t>=64?mean(b.slice(t-64,t-4),'close'):null;
 const points={
 base:25*(.3*clamp(1-Math.max(0,f.prior20Return)/20)+.25*clamp(1-Math.max(0,f.prior60Return)/40)+.25*clamp(1-f.prior5Range/12)+.2*clamp(1-f.vma5/f.vma20)),
 breakout:25*(.4*clamp(f.bodyRatio)+.3*clamp(f.closeLocation)+.15*clamp(1-f.upperShadowRatio/.3)+.15*Number(last.close>f.prior5High)),
 lifecycle:20*(.3*clamp(1-Math.max(0,f.return5)/15)+.3*clamp(1-Math.max(0,f.deviation60)/20)+.25*clamp(1-Math.max(0,f.deviation20)/8)+.15*clamp((80-f.rsi5)/30)),
 volume:15*(.4*clamp((f.volumeRatio20-1)/1.5)+.35*clamp((f.volumeRatio5-1)/1.5)+.25*clamp((f.volumeRatioPrev-1)/2)),
 trend:10*(.35*Number(f.ma5>f.ma10)+.35*Number(f.ma20>=f.ma20Ago5)+.15*Number(last.close>f.ma60)+.15*Number(ma60Prev!==null&&f.ma60>=ma60Prev)),
 fundamentals:0
 };
 const warnings=[];
 if(f.volumeRatio20>=4&&f.bodyRatio<.65)warnings.push('異常放量且實體偏弱');
 const prior20High=Math.max(...b.slice(t-20,t).map(z=>z.high));
 if(prior20High>last.close&&prior20High/last.close<=1.03)warnings.push('上方3%內有前20日高點反壓');
 const last3=b.slice(t-2,t+1),ret=(a,c)=>c.close/a.close-1;
 if(last3[0].volume<last3[1].volume&&last3[1].volume<last3[2].volume&&ret(last3[0],last3[1])>ret(last3[1],last3[2])&&last.close>prev.close)warnings.push('量增但單日漲幅收斂');
 const penalty=Math.min(points.lifecycle,warnings.length*2);
 points.lifecycle-=penalty;
 const basic=Object.fromEntries(BASIC_KEYS.map(k=>{const e=fundamentals?.[k];return [k,asOf&&e?.verified===true&&typeof e.publishedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.publishedAt)&&e.publishedAt<=asOf&&typeof e.pass==='boolean'?e.pass:null];}));
 const known=Object.values(basic).filter(z=>z!==null).length;
 points.fundamentals=5*Object.values(basic).filter(z=>z===true).length/BASIC_KEYS.length;
 const score=Math.round(Object.values(points).reduce((a,c)=>a+c,0)*100)/100;
 const scoreUpper=Math.round((score+5*(BASIC_KEYS.length-known)/BASIC_KEYS.length)*100)/100;
 const grade=n=>n>=90?'S':n>=80?'A':n>=70?'B':n>=60?'C':'D';
 return {score,scoreUpper,grade:grade(score),gradeUpper:grade(scoreUpper),points,penalty,warnings,basic,basicKnown:known,scoreBasis:'未驗證的基本面不加分；顯示可能分數上限；門檻及權重尚未回測'};
}
function compute(b,amount,fundamentals=null,asOf=null){
 if(!Array.isArray(b)||b.length<MIN_BARS)return {status:'INSUFFICIENT_DATA',eligible:false,reason:'至少62根有效日K'};
 if(!finite(amount)||amount<0)return {status:'INSUFFICIENT_DATA',eligible:false,reason:'缺少官方成交值'};
 if(b.some(x=>!['open','high','low','close','volume'].every(k=>finite(x[k]))||x.low<=0||x.high<Math.max(x.open,x.close)||x.low>Math.min(x.open,x.close)||x.volume<=0))return {status:'DATA_ERROR',eligible:false,reason:'OHLCV不合法'};
 const t=b.length-1,last=b[t],prev=b[t-1],ma=(n,i=t)=>mean(b.slice(i-n+1,i+1),'close'),prior=n=>b.slice(t-n,t),vma=n=>mean(prior(n),'volume'),p5=prior(5),range=last.high-last.low,priorLow=Math.min(...p5.map(x=>x.low)),priorHigh=Math.max(...p5.map(x=>x.high));
 if(range<=0)return {status:'FAIL',eligible:false,reason:'當日K線無振幅，無法確認突破品質'};
 const f={close:last.close,closePrev:prev.close,amount,volume:last.volume,ma5:ma(5),ma10:ma(10),ma20:ma(20),ma20Prev:ma(20,t-1),ma20Ago5:ma(20,t-5),ma60:ma(60),prior5Range:pct(priorHigh,priorLow),prior20Return:pct(prev.close,b[t-21].close),prior60Return:pct(prev.close,b[t-61].close),return5:pct(last.close,b[t-5].close),vma5:vma(5),vma20:vma(20),volumeRatioPrev:last.volume/prev.volume,volumeRatio5:last.volume/vma(5),volumeRatio20:last.volume/vma(20),bodyRatio:(last.close-last.open)/range,upperShadowRatio:(last.high-Math.max(last.open,last.close))/range,closeLocation:(last.close-last.low)/range,rsi5:rsi(b,5),rsi14:rsi(b,14),prior5High:priorHigh};
 f.deviation20=pct(last.close,f.ma20);f.deviation60=pct(last.close,f.ma60);
 const e=1e-9;
 const checks=Object.entries({
 PRIOR20:f.prior20Return<=20+e,PRIOR60:f.prior60Return<=40+e,BASE5:f.prior5Range<=12+e,DRY_VOLUME:f.vma5<f.vma20,DEVIATION20:f.deviation20<=8+e,
 CROSS20:last.close>f.ma20&&prev.close<=f.ma20Prev,MA5_10:f.ma5>f.ma10,MA20_SLOPE:f.ma20>=f.ma20Ago5,
 VOLUME_PREV:f.volumeRatioPrev>2,TRADE_VALUE:amount>500000000,VOLUME5:f.volumeRatio5>1.5,VOLUME20:f.volumeRatio20>1.5,VOLUME_CAP:f.volumeRatio20<=5,
 RED:last.close>last.open,BODY:f.bodyRatio>=.5,SHADOW:f.upperShadowRatio<=.3,CLOSE_LOCATION:f.closeLocation>=.75,
 RSI5:f.rsi5<=80+e,RSI14:f.rsi14<=75+e,RETURN5:f.return5<=15+e,DEVIATION60:f.deviation60<=20+e
 }).map(([key,pass])=>({key,pass}));
 const eligible=checks.every(x=>x.pass);
 return {model:MODEL,status:eligible?'PASS':'FAIL',eligible,checks,features:f,quality:eligible?quality(f,b,fundamentals,asOf):null,extra:{breaksPrior5High:last.close>priorHigh,aboveMA60:last.close>f.ma60},reasons:checks.filter(x=>!x.pass).map(x=>x.key)};
}

/* Only completed daily OHLCV. Aggregated typical-price zones are not transaction-at-price records. */
function riskContext(b,asOf){
 const bad=reason=>({state:'UNAVAILABLE',reason,asOf,projection:null,pressureZones:[],warnings:[]});
 if(!Array.isArray(b)||b.length<MIN_BARS||!asOf||b.at(-1)?.date!==asOf||b.some((x,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')||x.date>asOf||i&&x.date<=b[i-1].date||!['open','high','low','close','volume'].every(k=>finite(x[k])&&x[k]>0)||x.high<Math.max(x.open,x.close)||x.low>Math.min(x.open,x.close)))return bad('完成日K或日期未核對');
 if(!N?.pivots||!N?.snapshots)return bad('共用N字轉折模組未載入');
 const z=b.at(-1),pv=N.pivots(b),book=N.snapshots(b,pv,'LOW_BASE_V929'),confirmed=book.records.filter(p=>p.knownAt<=asOf&&p.A.price<p.C.price&&p.C.price<p.B.price);
 const latest=confirmed.at(-1);
 let projection=null;
 if(latest){
  const {A,B,C}=latest,amplitude=B.price-A.price,retracement=(B.price-C.price)/amplitude;
  const active=b.slice(C.knownAtIndex).every(x=>x.low>=C.price);
  if(active&&amplitude/A.price>=.06&&retracement>=.15&&retracement<=.85){
   const target=C.price+amplitude*1.618,seen=b.slice(C.knownAtIndex).some(x=>x.high>=target);
   projection={A:{price:A.price,date:A.pivotDate,knownAt:A.knownAt},B:{price:B.price,date:B.pivotDate,knownAt:B.knownAt},C:{price:C.price,date:C.pivotDate,knownAt:C.knownAt},confirmedAt:C.knownAt,ratio:1.618,target,remainingPct:(target/z.close-1)*100,touched:seen,near:z.close>=target*.97,kind:'UNVALIDATED_N_1_618_PROJECTION',note:'已確認A/B/C後的理論延伸，不是已證實阻力或獲利目標'};
  }
 }
 const warnings=[];
 if(projection?.touched||projection?.near)warnings.push('已接近或曾觸及N字1.618理論延伸，留意末升段');
 const peaks=pv.filter(x=>x.type==='HIGH'&&x.knownAt<=asOf).slice(-2),values=peaks.map(x=>rsi(b.slice(0,x.index+1),14));
 if(peaks.length===2&&values.every(finite)&&peaks[1].price>peaks[0].price&&values[1]<values[0])warnings.push('兩個已確認波峰出現價格創高但RSI14下降');
 const prior=b.slice(-61,-1),last3=b.slice(-4),gains=last3.slice(1).map((x,i)=>pct(x.close,last3[i].close));
 if(gains.length===3&&gains.every(x=>x>=3))warnings.push('連續三個交易日漲幅至少3%，留意追高');
 const low=Math.min(...prior.map(x=>x.low)),high=Math.max(...prior.map(x=>x.high)),width=(high-low)/20,bins=Array.from({length:20},(_,i)=>({low:low+width*i,high:low+width*(i+1),volume:0,days:0}));
 if(width>0)for(const day of prior){const typical=(day.high+day.low+day.close)/3,i=Math.max(0,Math.min(19,Math.floor((typical-low)/width)));bins[i].volume+=day.volume;bins[i].days++;}
 const total=prior.reduce((n,x)=>n+x.volume,0);
 const zones=bins.filter(x=>width>0&&x.high>z.close&&x.days>=3&&x.volume/total>=.1).sort((a,b)=>a.low-b.low).slice(0,3).map(x=>({...x,sharePct:x.volume/total*100,kind:'DAILY_TYPICAL_PRICE_VOLUME_PROXY'}));
 if(zones.some(x=>x.low<=z.close*1.03))warnings.push('收盤上方3%內存在歷史日K量價聚集區，僅作可能反壓觀察');
 return {state:'RESEARCH_ONLY',asOf,projection,pressureZones:zones,warnings,method:'前60日，按(H+L+C)/3將每日日量歸入20個等寬價格區間；至少3日且占總量10%；僅顯示收盤以上最多3區',limitations:'日K量價代理，不是逐筆成交量分布、真實套牢籌碼、委託單或主力成本；工程門檻未回測，額外觀察不改現有分數、資格與排名',affectsScore:false};
}

function evaluate(report,options={}){
 const code=String(options.code||report?.stock||report?.code||''),q=options.quote,date=options.asOf||report?.marketDate||report?.closeDate||report?.dataDate,sector=options.sector||{};
 const fail=(status,reason)=>({model:MODEL,code,date,status,eligible:false,reasons:[reason]});
 if(!q||!date)return fail('INSUFFICIENT_DATA','缺少同日盤後快照');
 if(!Old.ordinary(code,q))return fail('EXCLUDED','非上市櫃普通股');
 const industry=String(sector.industryName||sector.industry||q.industryName||q.industry||''),ic=String(sector.industryCode||q.industryCode||'').padStart(2,'0');
 if(['17','22','14'].includes(ic)||/金融|銀行|保險|證券|金控|生技|營建|建材營造/.test(industry))return fail('EXCLUDED','排除金融、生技、營建');
 if(!industry&&ic==='00')return fail('INSUFFICIENT_DATA','官方產業分類不足');
 const v=K.validate(report,{asOf:date,code,minBars:MIN_BARS,type:'stock',quote:q});
 if(!v.ok)return fail('INSUFFICIENT_DATA',v.reason);
 if(q.volumeScopeAudit?.formalVolumeEligible===false||q.tradeValueSource==='ESTIMATED_CLOSE_X_VOLUME'&&q.officialTradeValue==null)return fail('INSUFFICIENT_DATA','成交量與成交金額口徑未核實');
 const amount=q.officialTradeValue??q.tradeValue;
 const result=compute(v.bars,amount,options.fundamentals,v.asOf);
 const last=v.bars.at(-1),levels=result.eligible?{state:'INITIAL',signalDate:v.asOf,breakoutPrice:last.close,breakoutLow:last.low,ma20:result.features.ma20,lifeLine:Math.max(last.low,result.features.ma20),pressure20:Math.max(...v.bars.slice(-21,-1).map(b=>b.high)),followup:'尚待下一完成交易日核對'}:null;
 return {...result,model:MODEL,code,date:v.asOf,historyFingerprint:v.historyFingerprint,levels,riskContext:result.eligible?riskContext(v.bars,v.asOf):null};
}
return Object.freeze({MODEL,MIN_BARS,compute,evaluate,rsi,quality,riskContext,BASIC_KEYS:Object.freeze(BASIC_KEYS)});
});
