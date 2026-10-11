/* Source: supplied book pp.52–67 (single-colour bodies), 70–74 (T-day OHLC range).
   Initial colour, equality and missing-data policies are explicit engineering conventions.
   No seeded RED/BLACK and no future bars. */
(function(root,factory){const N=typeof module==='object'&&module.exports,api=factory(N?require('./version-v50.js'):root.ShitouReleaseV50);if(N)module.exports=api;else root.ShitouTowerCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(V){
'use strict';
const MODEL='TOWER_OHLC_RANGE_SINGLE_COLOR_1.0.0',RELEASE=V.code;
const number=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(String(v).replace(/,/g,'')))?Number(String(v).replace(/,/g,'')):null;
function date(v){const s=String(v??'').replace(/[-/]/g,'');if(!/^\d{8}$/.test(s))return null;const d=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6),x=new Date(d+'T00:00:00Z');return Number.isFinite(+x)&&x.toISOString().slice(0,10)===d?d:null;}
function unavailable(codes,detail){return {ok:false,model:MODEL,release:RELEASE,reasonCodes:[...new Set(codes)],reason:detail||codes.join('、'),states:{},bars:[]};}
function normalize(source,options={}){
 const report=Array.isArray(source)?{dailySeries:source}:source?.report||source||{},raw=report.canonicalBars||report.dailySeries;
 const asOf=date(options.asOf||report.marketDate||report.closeDate||report.dataDate);
 if(!asOf)return unavailable(['DATE_MISSING'],'缺少完整交易日基準');
 if(options.completed===false||report.completed===false||report.isComplete===false)return unavailable(['POST_CLOSE_UNCONFIRMED'],'盤後尚未完成');
 if(!Array.isArray(raw)||raw.length<2)return unavailable(['INSUFFICIENT_BARS'],'完成日K不足');
 const rows=[];let prev='';
 for(const r of raw){const d=date(r.date),o=number(r.open),h=number(r.high),l=number(r.low),c=number(r.close),v=number(r.volume);
  if(!d||d<=prev||![o,h,l,c].every(x=>x>0)||h<Math.max(o,l,c)||l>Math.min(o,h,c)||(!options.isIndex&&(v===null||v<0))||r.completed===false||r.isComplete===false)return unavailable(['INVALID_OHLCV'],'日期順序、完成狀態或OHLCV缺失／不合理');
  if(d>asOf)return unavailable(['FUTURE_BAR'],'含有基準日以後的行情');
  if(r.suspended===true||(!options.isIndex&&v===0))return unavailable(['SUSPENSION_OR_ZERO_VOLUME'],'停牌或零成交量，暫停確認訊號');
  rows.push({date:d,open:o,high:h,low:l,close:c,volume:v});prev=d;
 }
 if(prev!==asOf||report.closeDate&&date(report.closeDate)!==asOf)return unavailable(['DATE_MISMATCH'],'個股／基準日／日K不同日');
 const shown=number(report.close);if(shown!==null&&Math.abs(shown-rows.at(-1).close)>Math.max(.02,shown*.0001))return unavailable(['PRICE_MISMATCH'],'報告價格與日K不同價');
 const expected=options.expectedTradingDates||report.expectedTradingDates;
 if(expected){const dates=expected.map(date);if(dates.some(d=>!d)||dates.some((d,i)=>i&&d<=dates[i-1]))return unavailable(['INVALID_CALENDAR']);const actual=new Set(rows.map(r=>r.date));if(dates.filter(d=>d>=rows[0].date&&d<=asOf).some(d=>!actual.has(d))||rows.some(r=>!dates.includes(r.date)))return unavailable(['MISSING_TRADING_DAY'],'交易日曆與行情缺漏或含非交易日');}
 const events=report.corporateActions||[],basis=report.priceAdjustment?.basis||report.dailySeriesMeta?.adjustmentBasis||'UNKNOWN';
 if(events.some(e=>{const d=date(e.date);return !d||d>=rows[0].date&&d<=asOf;})&&report.priceAdjustment?.verified!==true)return unavailable(['CORPORATE_ACTION_UNVERIFIED'],'含除權息／分割事件且價格基準未驗證');
 const warnings=[];if(!expected)warnings.push('CALENDAR_UNVERIFIED');if(basis==='UNKNOWN')warnings.push('ADJUSTMENT_BASIS_UNKNOWN');if(report.priceAdjustment?.verified!==true)warnings.push('PRICE_BASIS_UNVERIFIED');if(!options.isIndex&&!report.dailySeriesMeta?.volumeUnit)warnings.push('VOLUME_UNIT_ASSUMED_SHARES');
 return {ok:true,bars:rows,date:asOf,warnings,basis,basisVerified:report.priceAdjustment?.verified===true,source:options.source||report.dailySeriesMeta?.source||report.dataSource||'原系統完成日K（未附來源URL）',completed:options.completed===true,calendarVerified:!!expected};
}
function compute(rows,T){
 if(!Number.isInteger(T)||T<1)throw new RangeError('T must be a positive integer');
 const history=[];let color='UNKNOWN',red=0,black=0,lastRed=null,lastBlack=null,runStart=null;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],previous=color,reference=i>=T?rows.slice(i-T,i):[],upper=reference.length?Math.max(...reference.map(r=>r.high)):null,lower=reference.length?Math.min(...reference.map(r=>r.low)):null;
  const epsilon=Math.max(1,Math.abs(r.close))*1e-12;
  let reason='WARMUP';if(upper!==null){if(r.close>upper+epsilon){color='RED';reason='CLOSE_ABOVE_PRIOR_T_HIGH';}else if(r.close<lower-epsilon){color='BLACK';reason='CLOSE_BELOW_PRIOR_T_LOW';}else reason='RANGE_HOLD_COLOR';}
  const flip=previous!=='UNKNOWN'&&color!==previous?previous+'_TO_'+color:null;
  if(flip==='BLACK_TO_RED')lastRed=r.date;if(flip==='RED_TO_BLACK')lastBlack=r.date;
  if(color!==previous)runStart=r.date;
  red=color==='RED'?red+1:0;black=color==='BLACK'?black+1:0;
  const start=i?rows[i-1].close:r.close;
  history.push({date:r.date,T,color,previousColor:previous,flip,reasonCode:reason,start,end:r.close,bodyHigh:Math.max(start,r.close),bodyLow:Math.min(start,r.close),referenceHigh:upper,referenceLow:lower,redDays:red,blackDays:black,runStart,lastRedDate:lastRed,lastBlackDate:lastBlack,flatClose:start===r.close});
 }
 const last=history.at(-1);const next=rows.slice(-T);
 return {...last,history,ready:!!last&&last.color!=='UNKNOWN',nextRedAbove:next.length===T?Math.max(...next.map(r=>r.high)):null,nextBlackBelow:next.length===T?Math.min(...next.map(r=>r.low)):null};
}
function patterns(history,tolerance=0){
 const tail=history.slice(-3);if(tail.length<3)return {flatTop:false,flatBottom:false,threeFlatTop:false,threeFlatBottom:false,tolerance};
 const near=values=>Math.max(...values)-Math.min(...values)<=tolerance;
 const tops=tail.map(r=>r.bodyHigh),bottoms=tail.map(r=>r.bodyLow),pair=tail.slice(-2);
 return {flatTop:pair[0].color==='RED'&&pair[1].end<pair[1].start&&near(pair.map(r=>r.bodyHigh)),flatBottom:pair[0].color==='BLACK'&&pair[1].end>pair[1].start&&near(pair.map(r=>r.bodyLow)),threeFlatTop:tail[0].color==='RED'&&near(tops)&&tail.some(r=>r.end<r.start),threeFlatBottom:tail[0].color==='BLACK'&&near(bottoms)&&tail.some(r=>r.end>r.start),top:near(tops)?tops[0]:null,bottom:near(bottoms)?bottoms[0]:null,tolerance,definition:'柱體端點平頂平底；三柱規則與容差為工程研究定義'};
}
function analyze(source,options={}){
 const n=normalize(source,options);if(!n.ok)return n;
 const states={};for(const T of [2,3,5])states[T]=compute(n.bars,T);
 if(!states[3].ready||!states[5].ready)return {...unavailable(['UNINITIALIZED_TREND'],'尚無足夠突破建立T=3／T=5方向'),...n,ok:false,model:MODEL,release:RELEASE,states,reasonCodes:['UNINITIALIZED_TREND']};
 const recent=states[3].history.slice(-20),flips=recent.filter(r=>r.flip).length;
 return {...n,ok:true,model:MODEL,release:RELEASE,states,reasonCodes:[],patterns:patterns(states[3].history,options.flatTolerance||0),flipCount20:flips,trendAligned:states[3].color===states[5].color,code:String(source?.stock||source?.code||source?.report?.stock||''),name:String(source?.name||source?.report?.name||'')};
}
return Object.freeze({MODEL,RELEASE,number,date,normalize,compute,patterns,analyze,unavailable});
});
