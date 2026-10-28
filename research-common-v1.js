/* Shared completed-bar research primitives. No network, gates, scores or orders. */
(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./tower-line-core.js'):r.ShitouTowerCore);if(typeof module==='object'&&module.exports)module.exports=a;else r.ShitouResearchCommon=a;})(globalThis,function(T){
'use strict';
const VERSION='RESEARCH_COMMON_1';
const DEFAULTS=Object.freeze({threeDayStructureEnabled:true,granvilleContextEnabled:true,candlePatternEnabled:true,jointValidationEnabled:true,experimentalRankingEnabled:false,dualScanEnabled:true,dualScanExperimentalRankingEnabled:false,dualScanStrictValidationEnabled:true,alertPlanEnabled:true,directAlertIntegrationEnabled:false,webPushEnabled:false,fourModelsEnabled:true,unifiedResearchEnabled:true,nContinuationEnabled:true,oneThirdEnabled:true,postLimitupEnabled:true,waveEnabled:true,marketContextEnabled:true});
const PARAM=Object.freeze({version:'RESEARCH_PARAMS_1',slopeBars:3,trendWindow:20,doji:.10,wickRatio:.50,wickBody:2,confirmBars:3,d1GainPct:3,d2Volume:1.1,d3Volume:.7,volumeConfirm:1.2,maGapPct:8,atrGap:2,breakoutReturnMin:5,breakoutReturnMax:15,volumeGrowth:1.15,volumeDeltaLots:1000});
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const mean=a=>a.length&&a.every(v=>num(v)!==null)?a.reduce((s,v)=>s+v,0)/a.length:null;
const ma=(b,n,i=b.length-1)=>i+1>=n?mean(b.slice(i-n+1,i+1).map(x=>x.close)):null;
const pct=(a,b)=>num(a)!==null&&b>0?(a/b-1)*100:null;
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function hash(x){const s=JSON.stringify(x);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}
const flags=x=>({...DEFAULTS,...x,directAlertIntegrationEnabled:false,webPushEnabled:false});
// A scanner row is an envelope, not a replacement for its full report. RSI-only
// observation objects must never take ownership of OHLCV or external evidence.
function normalizeInput(input={}){
 input=input||{};
 const primary=input.report||input.researchSource||input,r={...primary},errors=[...(primary.researchInputErrors||[])];
 const code=String(primary.stock||primary.code||'').trim();r.stock=code;
 if(r.market)r.market=String(r.market).toUpperCase();
 for(const k of ['marketDate','closeDate','dataDate'])if(r[k])r[k]=T.date(r[k])||r[k];
 if(Array.isArray(r.canonicalBars)&&!r.canonicalBars.length&&Array.isArray(r.dailySeries)&&r.dailySeries.length)delete r.canonicalBars;
 const date=r.marketDate||r.closeDate||r.dataDate;
 if((input.report||input.researchSource)&&input.code&&String(input.code)!==code)errors.push('候選與報告股票代號不符');
 if((input.report||input.researchSource)&&(input.date&&T.date(input.date)!==date||input.market&&r.market&&String(input.market).toUpperCase()!==r.market))errors.push('候選與報告市場／日期不符');
 const observation=input.rsiObservationSource;
 if(observation){
  const id=String(observation.stock||observation.code||''),d=T.date(observation.marketDate||observation.closeDate||observation.dataDate);
  if(id&&id!==code||d&&date&&d!==date||observation.market&&r.market&&observation.market!==r.market)errors.push('RSI觀察資料的代號／市場／日期不符');
  else if(id===code&&d===date)for(const k of ['dailyRsi','dailyRsi5','rsiSourceAudit'])if(r[k]==null&&observation[k]!=null)r[k]=observation[k];
 }
 r.researchInputErrors=errors;
 r.researchInputSources=primary.researchInputSources||{report:input.report?'report':input.researchSource?'researchSource':'input',history:Array.isArray(r.canonicalBars)&&r.canonicalBars.length?'canonicalBars':Array.isArray(r.dailySeries)&&r.dailySeries.length?'dailySeries':null,rsi:primary.dailyRsi!=null||primary.dailyRsi5!=null?'report':r.dailyRsi!=null||r.dailyRsi5!=null?'same-date observation':null,externalEvidence:r.researchSources?'report.researchSources':null};
 return r;
}
function validate(r){
 if(r.researchInputErrors?.length)return {ok:false,reason:r.researchInputErrors.join('；')};
 const code=String(r.stock||r.code||'');
 if(!/^\d{4,6}$/.test(code)||r.stock&&r.code&&String(r.stock)!==String(r.code))return {ok:false,reason:'股票代號缺失或衝突'};
 if(!['TWSE','TPEX'].includes(r.market))return {ok:false,reason:'市場別未驗證（須為TWSE或TPEX）'};
 const dates=[r.marketDate,r.closeDate,r.dataDate].filter(Boolean).map(T.date);
 if(!dates.length||dates.some(d=>!d)||new Set(dates).size!==1)return {ok:false,reason:'行情日期缺失或不一致'};
 if(r.completed!==true||r.isComplete===false||r.suspended===true)return {ok:false,reason:'未確認已完成日K／停牌'};
 if(r.expectedTradingDates&&!Array.isArray(r.expectedTradingDates))return {ok:false,reason:'交易日曆格式無效'};
 const rows=r.canonicalBars||r.dailySeries;
 if(Array.isArray(rows)&&rows.some(b=>b.stock&&String(b.stock)!==code||b.code&&String(b.code)!==code||b.market&&b.market!==r.market))return {ok:false,reason:'日K包含其他股票或市場資料'};
 const n=T.normalize(r,{asOf:r.marketDate||r.closeDate||r.dataDate,completed:true});if(!n.ok)return n;
 if(r.corporateActionUnresolved||r.priceAdjustmentConsistent===false)return {ok:false,reason:'價格還原口徑衝突'};
 const unit=r.volumeUnit||r.dailySeriesMeta?.volumeUnit;
 if(!['shares','lots','thousand_shares'].includes(unit))return {ok:false,reason:'成交量單位未驗證'};
 n.bars=n.bars.map(b=>({...b,volume:b.volume*(unit==='shares'?1:1000)}));
 n.warnings=(n.warnings||[]).filter(w=>w!=='VOLUME_UNIT_ASSUMED_SHARES');
 if(n.bars.some(b=>b.volume<=0))return {ok:false,reason:'零量或停牌'};
 return n;
}
function validationResult(r,n){
 const raw=r.canonicalBars||r.dailySeries,count=n.ok?n.bars.length:Array.isArray(raw)?raw.length:0;
 const missing=[];
 if(!n.ok)missing.push(n.reason);
 if(count<60)missing.push(`完成日K ${count}/60 根；MA20需20根、前20日突破需21根、MA60斜率需63根`);
 if(!r.researchSources?.revenues?.length)missing.push('營收證據未提供');
 if(!r.researchSources?.mainBuy||!r.researchSources?.branchDifference)missing.push('主力／分公司籌碼證據未提供');
 return {stockCode:String(r.stock||r.code||''),market:r.market||null,marketDate:r.marketDate||r.closeDate||r.dataDate||null,validationStatus:!n.ok?'BASE_DATA_INVALID':count<60?'HISTORY_INSUFFICIENT':'TECHNICAL_AVAILABLE',missingFields:missing,validationErrors:n.ok?[]:[n.reason],verifiedDataSources:n.ok?[{source:n.source,date:n.date,scope:'VALIDATED_DAILY_OHLCV',volumeUnit:'shares',calendarVerified:!!n.calendarVerified,priceBasisVerified:!!n.basisVerified}]:[],historyBarCount:count,technicalModelAvailable:!!n.ok,externalEvidenceAvailable:false,externalEvidenceStatus:'UNVERIFIED',inputSources:r.researchInputSources||null,workerDataAudit:r.workerDataAudit||null};
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
 const rows=[];for(const [m,g] of groups){const dt=new Date(m+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()+4);const fri=dt.toISOString().slice(0,10);if(m<c.start||fri>c.end)continue;const expected=c.dates.filter(d=>d>=m&&d<=fri);if(expected[0]<b[0].date)continue;if(expected.at(-1)>asOf)continue;if(!expected.length||JSON.stringify(expected)!==JSON.stringify(g.map(x=>x.date)))return {value:null,reason:'已完成週日K缺漏／與日曆不符',bars:[]};rows.push({week:m,end:g.at(-1).date,close:g.at(-1).close});}
 return {value:rows.length>=20?mean(rows.slice(-20).map(x=>x.close)):null,reason:rows.length<20?'已完成正式週K不足20週':null,bars:rows};
}
// Read-only context shared by every stock and report entrance. Thresholds are
// research cautions, not eligibility rules or a validated trading system.
function tradeContext(b,f,r,invalid){
 const z=b.at(-1),p=b.at(-2),recent=f.prior20High;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const prior60=b.length>=61?Math.max(...b.slice(-61,-1).map(x=>x.high)):null;
 // Track up to five completed sessions from a genuine close breakout, keeping
 // that event's original pressure fixed for the subsequent hold check.
 let event=null;
 for(let i=Math.max(20,b.length-5);i<b.length;i++){
  const price=Math.max(...b.slice(i-20,i).map(x=>x.high));
  if(b[i].close>price&&(!event||b.slice(event.index,i+1).some(x=>x.close<=event.price)))event={index:i,date:b[i].date,price};
 }
 const held=event?b.slice(event.index).every(x=>x.close>event.price):false;
 const sessions=event?b.length-event.index:0;
 const status=event?(held?(sessions>=2?'HELD_CLOSES':'INITIAL_CLOSE'):'FAILED'):finite(recent)&&z.high>recent&&z.close<=recent?'INTRADAY_REJECTED':'NOT_BROKEN';
 const originalB=num(r.originalB),bVerified=r.originalBVerified===true;
 const pressures=[{kind:'當日高點短壓',price:z.high},{kind:'前60日高點',price:prior60},
  {kind:bVerified?'原策略B門檻':'原策略B參考（待核驗）',price:originalB}].filter(x=>finite(x.price)&&x.price>z.close);
 pressures.sort((a,b)=>a.price-b.price);
 const nearest=pressures[0]||null;
 const scenario=(kind,price)=>({kind,price,changePct:pct(price,z.close)});
 const scenarios=[...pressures.map(x=>scenario(x.kind,x.price)),
  ...(finite(recent)?[scenario('近期突破參考',recent)]:[]),
  ...(finite(f.ma[20].value)?[scenario('MA20支撐參考',f.ma[20].value)]:[]),
  ...(finite(invalid)?[scenario('研究失效參考（非交易停損）',invalid)]:[])];
 const target=finite(originalB)&&originalB>z.close?originalB:finite(prior60)&&prior60>z.close?prior60:null;
 const rr=finite(target)&&finite(invalid)&&invalid<z.close?(target-z.close)/(z.close-invalid):null;
 const volumeRatio=f.volumePrior5>0?z.volume/f.volumePrior5:null;
 const gap=f.ma[20].distance,upper=f.candle.upperRatio;
 const cautions=[];
 if(finite(f.rsi5)&&f.rsi5>=75)cautions.push(`RSI5 ${f.rsi5.toFixed(2)}，短線偏熱`);
 if(finite(gap)&&gap>=5)cautions.push(`MA20正乖離 ${gap.toFixed(2)}%`);
 if(finite(upper)&&upper>=.3)cautions.push(`${volumeRatio>=2?'放量伴隨':''}高點回落，上影占振幅 ${(upper*100).toFixed(0)}%`);
 if(nearest&&pct(nearest.price,z.close)<=3)cautions.push(`距${nearest.kind}僅 ${pct(nearest.price,z.close).toFixed(2)}%`);
 if(rr!==null&&rr<1)cautions.push(`假設報酬風險比 ${rr.toFixed(2)}：1，低於1`);
 const basis=r.dailyBasisV2||{},meta=r.dailySeriesMeta||{};
 const volumeConflict=basis.sourceVolumeWarning===true||r.sourceVolumeWarning===true;
 if(volumeConflict)cautions.push('成交量來源差異待核對，量能資格須複核');
 return {version:'TRADE_CONTEXT_1',recent,prior60,originalB,originalBVerified:bVerified,
  originalBStatus:originalB===null?'UNAVAILABLE':!bVerified?'UNVERIFIED':z.close>originalB?'CLOSE_ABOVE':'NOT_BROKEN',
  breakout:{status,eventDate:event?.date||null,price:event?.price||recent,heldSessions:held?sessions:0,confirmation:'至少連續2根完成日K收盤守在同一突破價上；不代表未來續漲'},
  rsi5:f.rsi5,rsi10:f.rsi10,ma20GapPct:gap,upperWickRatio:upper,volumeRatioPrior5:volumeRatio,
  volumeRatioPrevious:p?.volume>0?z.volume/p.volume:null,pressures,nearest,scenarios,
  rewardRisk:{entry:z.close,target,invalidation:invalid,ratio:rr,assumption:'以收盤假設進場、上方B參考或60日高點為目標、研究失效為風險情境；非交易停損建議'},cautions,
  provenance:{source:meta.source||r.dataSource||null,sourceDate:z.date,
   retrievedAt:meta.fetchedAt||meta.retrievedAt||r.fetchedAt||r.retrievedAt||null,
   priceBasis:r.priceAdjustment?.basis||'UNKNOWN',volumeUnit:'shares',
   volumeBasis:basis.volumeBasis||meta.volumeScope||meta.volumeBasis||'UNKNOWN',
   sourceVolume:basis.sourceVolume??z.volume,snapshotVolume:basis.snapshotVolume??null,sourceVolumeDiffPct:basis.sourceVolumeDiffPct??null,
   volumeConflict,volumeQualification:volumeConflict?'REVIEW_REQUIRED':'SOURCE_ONLY_NOT_CROSS_VERIFIED',
   historyBars:b.length,maPeriods:[20,60],rsiFormula:'Wilder RSI5／RSI10；可能與資料商初始化不同'}};
}
return Object.freeze({tradeContext,VERSION,DEFAULTS,PARAM,T,num,mean,ma,pct,freeze,hash,flags,normalizeInput,validate,validationResult,rsi,atr,tick,legal,step,geometry,features,cutoff,available,check,status,nextDate,weeks});
});
