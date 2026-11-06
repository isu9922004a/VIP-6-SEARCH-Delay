/* Causal price/volume context. No network, orders, formal gates, scores or ranks. */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon,node?require('./worker-data-contract-v1.js'):root.ShitouWorkerDataContractV1);
 if(node)module.exports=api;else root.ShitouStructureContext=api;
})(globalThis,function(U,W){
'use strict';
const VERSION='STRUCTURE_CONTEXT_R16',PARAM=Object.freeze({version:'R16_CONTEXT_1',zoneATR:.25,breakATR:.05,volume:1.2,closeLocation:.6,wickMax:.5,pivotLeft:3,pivotRight:3});
const finite=Number.isFinite;
function pivots(b,p=PARAM){const out=[];for(let i=p.pivotLeft;i+p.pivotRight<b.length;i++){
 const w=b.slice(i-p.pivotLeft,i+p.pivotRight+1);
 for(const [type,key,op] of [['HIGH','high',Math.max],['LOW','low',Math.min]])if(b[i][key]===op(...w.map(x=>x[key]))&&w.filter(x=>x[key]===b[i][key]).length===1)
  out.push({type,price:b[i][key],index:i,pivotDate:b[i].date,confirmedAt:b[i+p.pivotRight].date});
}return out;}
function volume(b,r){const z=b.at(-1),basis=r.dailyBasisV2||{},meta=r.dailySeriesMeta||{};
 const baseline5=b.length>=6?U.mean(b.slice(-6,-1).map(x=>x.volume)):null,baseline20=b.length>=21?U.mean(b.slice(-21,-1).map(x=>x.volume)):null;
 const unitMismatch=r.volumeUnit&&meta.volumeUnit&&((r.volumeUnit==='shares')!==(meta.volumeUnit==='shares'));
 const conflict=unitMismatch||basis.sourceVolumeWarning===true||r.sourceVolumeWarning===true||r.volumeScopeAudit?.formalVolumeEligible===false;
 const source=meta.source||r.dataSource||null,unit=r.volumeUnit||meta.volumeUnit;
 const status=conflict?'CONFLICT':source&&['shares','lots','thousand_shares'].includes(unit)&&baseline20>0?'VERIFIED_SOURCE':'UNKNOWN';
 return {status,usable:status==='VERIFIED_SOURCE',source,inputUnit:unit||null,unit:'shares',baseline5,baseline20,ratio5:baseline5>0?z.volume/baseline5:null,ratio20:baseline20>0?z.volume/baseline20:null,
  baselineRule:'當日量／前5或20根完成日K均量，分母排除當日',crossSourceVerified:basis.snapshotVolumeApplied===true&&!conflict,
  note:conflict?`來源量與市場量${Number.isFinite(basis.sourceVolumeDiffPct)?'差 '+basis.sourceVolumeDiffPct.toFixed(2)+'%':''}，統計範圍待核，暫停量能確認`:status==='UNKNOWN'?'量能來源或單位待核，暫停量能確認':'僅確認同一來源日K量；不代表跨來源統計範圍一致，也不能辨識主力身分'};
}
function quality(b,level,v,p=PARAM){const z=b.at(-1),g=U.geometry(z),atr=U.atr(b),buffer=Math.max(U.tick(level||z.close),atr>0?atr*p.breakATR:0);
 const priceStatus=!(level>0)?'DATA_INSUFFICIENT':z.close>level+buffer?'CLOSE_ABOVE':z.high>level&&z.close<=level?'REJECTED':z.high>level?'PENDING':'NOT_BROKEN';
 const confirmed=priceStatus==='CLOSE_ABOVE'&&v.usable&&v.ratio5>=p.volume&&g.closeLocation>=p.closeLocation&&g.upperRatio<p.wickMax;
 return {status:priceStatus==='DATA_INSUFFICIENT'?'DATA_INSUFFICIENT':priceStatus==='REJECTED'?'FAILED_BREAKOUT':confirmed?'CONFIRMED':priceStatus==='CLOSE_ABOVE'||priceStatus==='PENDING'?'PENDING_CONFIRMATION':'WAIT_TRIGGER',
  level:level??null,buffer,priceStatus,volumeStatus:v.status,volumeRatio5:v.ratio5,volumeRatio20:v.ratio20,closeLocation:g.closeLocation,upperWickRatio:g.upperRatio,confirmedAt:confirmed?z.date:null,
  definition:'完成收盤越過關卡及跳動／ATR緩衝，量比與收盤位置通過研究參數；非已驗證獲利規則'};
}
function breakoutEvent(b,p=PARAM){let event=null;const end=b.length-1;
 for(let i=Math.max(20,end-9);i<=end;i++){
  const level=Math.max(...b.slice(i-20,i).map(x=>x.high)),atr=U.atr(b.slice(0,i+1)),buffer=Math.max(U.tick(level),(atr||0)*p.breakATR);
  if(b[i].close>level+buffer&&(!event||b.slice(event.index,i).some(x=>x.close<event.level-event.tolerance)))
   event={index:i,date:b[i].date,level,tolerance:(atr||0)*p.zoneATR,source:'事件日前20根最高價（排除事件當日）'};
 }
 if(!event)return null;
 const after=b.slice(event.index+1),z=b.at(-1),broken=after.some(x=>x.close<event.level-event.tolerance),tested=after.some(x=>x.low<=event.level+event.tolerance),held=after.length>0&&after.every(x=>x.close>=event.level-event.tolerance);
 return {...event,status:broken?'INVALIDATED':tested&&held?'RETEST_HELD':held?'HELD_CLOSES':'INITIAL_BREAKOUT',confirmedAt:tested&&held?z.date:null,locked:'UNKNOWN'};
}
function pullback(b,v,p=PARAM){const z=b.at(-1),prev=b.at(-2),last=b.length-1,atr=U.atr(b),tol=(atr||0)*p.zoneATR;
 let established=null;
 // A failure is meaningful only after a previously completed reclaim event.
 for(let i=Math.max(63,last-7);i<last;i++){
  const line=U.ma(b,20,i-1),slow=U.ma(b,60,i-1),old=U.ma(b,20,i-4),a=b[i-1],c=b[i],eventTolerance=(U.atr(b.slice(0,i+1))||0)*p.zoneATR;
  if(line>slow&&line>old&&a.low<=line+eventTolerance&&a.high>=line-eventTolerance&&c.close>line+eventTolerance&&c.close>a.high)
   established={price:line,tolerance:eventTolerance,date:c.date,index:i,source:'MA20回踩後收復前日高點',confirmedAt:c.date};
 }
 const line=U.ma(b,20,last-1),slow=U.ma(b,60,last-1),old=U.ma(b,20,last-4),trendUp=line>slow&&line>old&&z.close>U.ma(b,60),touched=line>0&&prev.low<=line+tol&&prev.high>=line-tol;
 const priorVolume=b.length>=7?U.mean(b.slice(-7,-2).map(x=>x.volume)):null,contracted=priorVolume>0?prev.volume<priorVolume:null;
 const closeRecovered=touched&&trendUp&&z.close>line+tol&&z.close>prev.high&&z.close>z.open;
 const broken=established&&z.close<established.price-established.tolerance;
 const state=broken?'INVALIDATED':closeRecovered?'CONFIRMED':touched?'PENDING_CONFIRMATION':'WAIT_TRIGGER';
 return {status:state,trendUp,candidatePrice:line,source:'前一完成日MA20；候選參考，非自動確認支撐',tolerance:tol,touched,
  contracted,contractionRatio:priorVolume>0?prev.volume/priorVolume:null,contractionRule:'前日量／更前5根均量，排除前日與當日',
  closeRecovered,undercutReclaim:closeRecovered&&Math.min(prev.low,z.low)<line-tol,establishedSupport:established,
  confirmedAt:closeRecovered?z.date:null,volumeUsable:v.usable,
  note:broken?'已建立的收復情境收盤失效':closeRecovered?'多頭背景下回踩後收復前日高點；量能與風險仍需另驗':'未確認守穩，不等同已確認支撐失效'};
}
function candleContext(b,levels,p=PARAM,research=null){const out=[];
 for(let i=Math.max(5,b.length-3);i<b.length;i++){
  const z=b[i],prev=b[i-1],g=U.geometry(z),history=b.slice(Math.max(0,i-5),i),rise=history.at(-1).close>history[0].close,fall=history.at(-1).close<history[0].close;
  const near=levels.filter(x=>x.confirmedAt<=z.date&&Math.abs(z.close-x.price)<=Math.max(U.tick(z.close)*2,(U.atr(b.slice(0,i+1))||0)*.5)).map(x=>x.source);
  const add=(code,label,bias)=>{const next=b[i+1];const status=!next?'PENDING_CONFIRMATION':bias==='BULLISH'&&next.close>z.high?'CONFIRMED':bias==='BEARISH'&&next.close<z.low?'CONFIRMED':bias==='BULLISH'&&next.close<z.low||bias==='BEARISH'&&next.close>z.high?'INVALIDATED':'PENDING_CONFIRMATION';out.push({code,label,bias,eventDate:z.date,index:i,geometry:g,priorTrend:rise?'RISING':fall?'FALLING':'RANGE',nearReferences:near,status,confirmedAt:status==='CONFIRMED'?next.date:null,note:'形狀與位置僅作研究；下一完成K線確認也不保證趨勢反轉'});};
  if(g.longLower)add(fall?'HAMMER':rise?'HANGING_MAN':'LONG_LOWER',fall?'下跌後錘子候選':rise?'上漲後吊人候選':'長下影觀察',fall?'BULLISH':rise?'BEARISH':'NEUTRAL');
  if(g.longUpper)add(fall?'INVERTED_HAMMER':rise?'SHOOTING_STAR':'LONG_UPPER',fall?'下跌後倒錘候選':rise?'上漲後流星候選':'長上影觀察',fall?'BULLISH':rise?'BEARISH':'NEUTRAL');
  if(g.doji&&!g.longLower&&!g.longUpper)add('DOJI','十字觀察','NEUTRAL');
  const engulf=engulfingShape(prev,z);
  if(engulf.bodyEngulfed&&(engulf.direction==='BULLISH'&&fall||engulf.direction==='BEARISH'&&rise)){
   const e=research?.events?.find(e=>e.signalDate===z.date&&e.patternType==='BODY_ENGULFING');
   out.push({code:engulf.direction==='BULLISH'?'BULLISH_ENGULFING':'BEARISH_ENGULFING',label:engulf.label,bias:engulf.direction,eventDate:z.date,index:i,geometry:g,priorTrend:rise?'RISING':fall?'FALLING':'RANGE',nearReferences:near,status:e?.status==='FOLLOW_THROUGH_CONFIRMED'?'CONFIRMED':e?.status==='FAILED'?'INVALIDATED':'PENDING_CONFIRMATION',confirmedAt:e?.confirmationDate||null,patternType:'BODY_ENGULFING',researchEventId:e?.id||null,confirmation:e||null,dataStatus:research?.state||'DATA_INSUFFICIENT',note:e?'沿用同一吞沒三關及生命週期；型態不等同Kronos預判':'僅為OHLC實體形狀候選；缺少完整來源或公司行動證據，未作確認'});
  }


 }
 return out;
}
function fit(points){const mx=U.mean(points.map(x=>x.index)),my=U.mean(points.map(x=>x.price)),den=points.reduce((s,x)=>s+(x.index-mx)**2,0);if(!den)return null;const slope=points.reduce((s,x)=>s+(x.index-mx)*(x.price-my),0)/den;return {slope,intercept:my-slope*mx,points};}
const lineAt=(line,index)=>line.intercept+line.slope*index;
function triangle(b,pv,v,p=PARAM){const end=b.length-1,known=pv.filter(x=>x.confirmedAt<b.at(-1).date&&x.index>=end-60),h=known.filter(x=>x.type==='HIGH').slice(-3),l=known.filter(x=>x.type==='LOW').slice(-3);
 if(h.length<3||l.length<3)return null;
 const top=fit(h),bottom=fit(l),start=Math.min(h[0].index,l[0].index),span=end-start,atr=U.atr(b),tol=(atr||0)*p.zoneATR;
 if(!top||!bottom||span<10||[...h.map(x=>Math.abs(x.price-lineAt(top,x.index))),...l.map(x=>Math.abs(x.price-lineAt(bottom,x.index)))].some(x=>x>tol))return null;
 const widthStart=lineAt(top,start)-lineAt(bottom,start),widthEnd=lineAt(top,end)-lineAt(bottom,end),flat=tol/Math.max(span,1);
 const type=Math.abs(top.slope)<=flat&&bottom.slope>flat?'ASCENDING_TRIANGLE':top.slope< -flat&&Math.abs(bottom.slope)<=flat?'DESCENDING_TRIANGLE':top.slope< -flat&&bottom.slope>flat?'SYMMETRICAL_TRIANGLE':null;
 if(!type||!(widthStart>0&&widthEnd>0&&widthEnd<widthStart*.8))return null;
 const contained=b.slice(start,-1).filter((x,k)=>x.close<=lineAt(top,start+k)+tol&&x.close>=lineAt(bottom,start+k)-tol).length/Math.max(1,end-start);
 if(contained<.9)return null;
 const upper=lineAt(top,end),lower=lineAt(bottom,end),q=quality(b,upper,v,p),z=b.at(-1),down=z.close<lower-Math.max(U.tick(lower),(atr||0)*p.breakATR),prev=b.at(-2);
 const failed=prev.close>lineAt(top,end-1)&&z.close<upper-tol||prev.close<lineAt(bottom,end-1)&&z.close>lower+tol;
 return {type,label:{ASCENDING_TRIANGLE:'上升三角研究',DESCENDING_TRIANGLE:'下降三角研究',SYMMETRICAL_TRIANGLE:'對稱三角研究'}[type],status:failed?'INVALIDATED':down?'BREAKDOWN_OBSERVED':q.status==='CONFIRMED'?'CONFIRMED':z.close>upper?'PENDING_CONFIRMATION':'FORMING',direction:down?'DOWN':z.close>upper?'UP':'UNDECIDED',
  upper,lower,top,bottom,startIndex:start,endIndex:end,formedAt:[...h,...l].map(x=>x.confirmedAt).sort().at(-1),confirmedAt:q.status==='CONFIRMED'?z.date:null,
  projectedTarget:z.close>upper?upper+widthStart:null,targetKind:'UNVALIDATED_MEASURED_PROJECTION',quality:q,note:'三組已確認高低點擬合；方向依實際突破，量度投射不是已核實壓力或必達目標'};
}
function doubleBottom(b,pv,v,p=PARAM){pv=pv.filter(x=>x.confirmedAt<=b.at(-1).date&&x.index<b.length);const lows=pv.filter(x=>x.type==='LOW'&&x.index>=b.length-65).slice(-2);if(lows.length!==2)return null;
 const [a,c]=lows,between=pv.filter(x=>x.type==='HIGH'&&x.index>a.index&&x.index<c.index),neck=between.sort((x,y)=>y.price-x.price)[0],atr=U.atr(b);
 if(!neck||c.index-a.index<5||Math.abs(a.price-c.price)>(atr||0)||neck.price-Math.max(a.price,c.price)<(atr||0))return null;
 const prior=b.slice(Math.max(0,a.index-15),a.index);if(prior.length<5||prior.at(-1).close>=prior[0].close||Math.max(...prior.map(x=>x.high))<a.price+(atr||0)*2)return null;
 const q=quality(b,neck.price,v,p),z=b.at(-1),floor=Math.min(a.price,c.price),broken=z.close<floor-(atr||0)*p.zoneATR||b.at(-2).close>neck.price&&z.close<neck.price-(atr||0)*p.zoneATR;
 return {type:'DOUBLE_BOTTOM',label:'W底研究',status:broken?'INVALIDATED':q.status==='CONFIRMED'?'CONFIRMED':z.close>neck.price?'PENDING_CONFIRMATION':'FORMING',
  points:[a,neck,c],neckline:neck.price,invalidation:floor-(atr||0)*p.zoneATR,formedAt:[a,neck,c].map(x=>x.confirmedAt).sort().at(-1),confirmedAt:!broken&&q.status==='CONFIRMED'?z.date:null,quality:q,note:'已確認波段低高低與頸線；不是相鄰兩根平底，也不代表已驗證的買進規則'};
}
// ENGULF_RANGE_1: one shared causal research core. Formal strategy gates are not consumers.
const CONFIRM_PARAM=Object.freeze({version:'ENGULF_RANGE_PARAMS_1',confirmBars:3,volumeRatio5:1.2,rangeMin:8,rangeMax:20,rangeATR:2.5,touchATR:.25,minTouches:2,touchSeparation:2,maSlopeBars:3,maxMaSlopeATR:.2,maxDriftWidth:.6,maxDirectionalShare:.8,closeLocation:.6,rangeConfirmBars:3,rangeMaxAge:20});
const RESEARCH_FLAGS=Object.freeze({researchOnly:true,performanceValidated:false,affectsOriginalEligibility:false,affectsOriginalScore:false,affectsOriginalRanking:false,executionAllowed:false});
const cents=x=>Math.round(x*100),eqPrice=(a,b)=>cents(a)===cents(b);
function instrument(r){return ['TAIEX','TPEX_INDEX'].includes(r.instrumentType)?'INDEX':'STOCK';}
function legalPrice(value,r){return instrument(r)==='INDEX'?value>0&&Math.abs(value*100-Math.round(value*100))<1e-5:U.legal(value);}
function nextLegal(value,direction,r){return instrument(r)==='INDEX'?+(value+direction*.01).toFixed(2):U.step(value,direction);}
function strictAbove(a,b,r){const threshold=nextLegal(b,1,r);return threshold!==null&&cents(a)>=cents(threshold);}
function strictBelow(a,b,r){const threshold=nextLegal(b,-1,r);return threshold!==null&&cents(a)<=cents(threshold);}
function confirmationInput(input,options={}){
 const r=U.normalizeInput(input),index=instrument(r)==='INDEX';let n;
 const bad=reason=>({ok:false,reason,report:r,bars:[]});
 if(index){
  if(r.market!==(r.instrumentType==='TAIEX'?'TWSE_INDEX':'TPEX_INDEX')||r.code&&r.code!==r.instrumentType||r.completed!==true||r.dailySeriesMeta?.onlyCompletedBars!==true)return bad('指數身分或完成日K未核驗');
  n=U.T.normalize(r,{asOf:options.asOf||r.closeDate,completed:true,isIndex:true});
 }else{n=U.validate(r);if(!n.ok)return bad(n.reason);}
 if(!n.ok)return bad(n.reason);
 if(index&&(r.canonicalBars||r.dailySeries||[]).some(z=>(z.code||z.stock||z.instrumentType)&&String(z.code||z.stock||z.instrumentType)!==r.instrumentType||z.market&&z.market!==r.market))return bad('指數日K包含其他商品或市場');
 const b=n.bars,asOf=options.asOf||r.marketDate||r.closeDate||r.dataDate;
 if(asOf!==n.date||b.at(-1).date!==asOf||!eqPrice(r.close,b.at(-1).close))return bad('研究日期與完成日K不符');
 const calendar=r.tradingCalendar;
 if(!calendar?.verified||!calendar.source||!Array.isArray(calendar.dates))return bad('缺少已核驗交易日曆，不能確認日K連續');
 const expected=calendar.dates.filter(d=>d>=b[0].date&&d<=asOf);
 if(JSON.stringify(expected)!==JSON.stringify(b.map(z=>z.date)))return bad('日K與正式交易日曆不連續');
 if(!index&&!['COMMON','COMMON_STOCK','ORDINARY'].includes(String(r.securityType||'').toUpperCase()))return bad('普通股商品類型／跳動制度未核驗');
 if(!index&&!r.tickRuleVerified)return bad('台股普通股合法跳動規則未驗證');
 if(b.some(z=>['open','high','low','close'].some(k=>!legalPrice(z[k],r))))return bad('OHLC 不符此商品合法跳動單位');
 if(r.priceAdjustment?.verified!==true||r.priceAdjustmentConsistent===false||r.corporateActionUnresolved)return bad('除權息或價格調整基準尚未核驗');
 if(index){if(r.priceAdjustment.basis!=='OFFICIAL_INDEX_LEVEL')return bad('指數價格基準未核驗');}
 else if(r.priceAdjustment.corporateActionsVerified!==true)return bad('歷史公司行動尚未完整核驗，不宣稱吞沒或箱體確認');
 if(r.dataContract){const wire=W?.verify(r);if(!wire?.ok)return bad('Worker資料契約：'+(wire?.reason||'驗證器不可用'));}
 else if(!index)return bad('缺少原系統已驗證Worker資料契約');
 if(index&&!/TWSE|TPEX|證交所|櫃買/i.test(r.dailySeriesMeta?.source||''))return bad('指數官方來源未核驗');
 const units=[r.volumeUnit,r.dailySeriesMeta?.volumeUnit,...(r.canonicalBars||r.dailySeries||[]).map(z=>z.volumeUnit)].filter(Boolean).map(x=>String(x).replaceAll('-','_'));
 if(new Set(units).size>1)return bad('成交量單位衝突');
 if(!['shares','lots','thousand_shares'].includes(units[0]))return bad('成交量單位未核驗');
 const officialVolume=new Set(['TWSE_STOCK_DAY','TPEX_DAILY_HISTORY','GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE','VERIFIED_LATEST_SNAPSHOT']);
 const scopeVerified=index?/FMTQIK|TPEX/i.test(r.dailySeriesMeta?.volumeSource||''):r.volumeScopeVerified===true||r.dailySeriesMeta?.volumeScopeVerified===true||r.dataContract?.volumeUnitSource?.length>0&&r.dataContract.volumeUnitSource.every(e=>officialVolume.has(e.adapter));
 const volumeConflict=r.dailyBasisV2?.sourceVolumeWarning===true||r.sourceVolumeWarning===true||r.volumeScopeAudit?.formalVolumeEligible===false||r.volumeSourceConflict===true;
 return {ok:true,report:r,bars:b,asOf,index,volumeUsable:!volumeConflict&&!!scopeVerified,volumeStatus:volumeConflict?'CONFLICT':scopeVerified?'VERIFIED_SOURCE':'UNKNOWN_SCOPE',source:r.dailySeriesMeta?.source||n.source,calendarVerified:true,priceBasis:r.priceAdjustment.basis};
}
function confirmationVolume(b,index,context,p=CONFIRM_PARAM){
 const previous=b[index-1],current=b[index],prior=b.slice(Math.max(0,index-5),index),baseline=prior.length===5?U.mean(prior.map(z=>z.volume)):null;
 const usable=context.volumeUsable===true&&previous?.volume>0&&current?.volume>0&&baseline>0;
 const ratioPrevious=usable?current.volume/previous.volume:null,ratio5=usable?current.volume/baseline:null;
 return {status:!context.volumeUsable?'SOURCE_UNVERIFIED':!usable?'DATA_INSUFFICIENT':'VERIFIED_SOURCE',usable,ratioPrevious,ratio5,baseline5:baseline,greaterThanPrevious:usable?current.volume>previous.volume:null,passed:usable&&current.volume>previous.volume&&ratio5>=p.volumeRatio5,source:context.source,unit:'shares',baselineRule:'前五根完成日K均量，不含訊號當日'};
}
function engulfingShape(previous,current,r={}){
 if(!previous||!current||[previous,current].some(z=>['open','high','low','close'].some(k=>!Number.isFinite(z[k])||!legalPrice(z[k],r))||z.high<Math.max(z.open,z.close)||z.low>Math.min(z.open,z.close)||z.low>z.high))return {bodyEngulfed:false,fullRangeEngulfed:false,direction:null,label:'資料不足',dataStatus:'DATA_INSUFFICIENT'};
 const bull=cents(previous.close)<cents(previous.open)&&cents(current.close)>cents(current.open),bear=cents(previous.close)>cents(previous.open)&&cents(current.close)<cents(current.open);
 const body=(bull||bear)&&cents(Math.min(current.open,current.close))<=cents(Math.min(previous.open,previous.close))&&cents(Math.max(current.open,current.close))>=cents(Math.max(previous.open,previous.close));
 const full=body&&strictAbove(current.high,previous.high,r)&&strictBelow(current.low,previous.low,r);
 return {bodyEngulfed:body,fullRangeEngulfed:full,direction:body?(bull?'BULLISH':'BEARISH'):null,bodyBoundaryEquality:'INCLUSIVE',rangeBoundaryEquality:'STRICT_NEXT_LEGAL_TICK',label:body?(bull?'多頭吞沒（紅K吞綠K）':'空頭吞沒（綠K吞紅K）'):'無明確型態'};
}
function eventLocation(history,current){
 if(history.length<20)return {state:'DATA_INSUFFICIENT',position:null};
 const prior=history.slice(-20),high=Math.max(...prior.map(z=>z.high)),low=Math.min(...prior.map(z=>z.low)),position=high>low?(current.close-low)/(high-low):null;
 return {state:position===null?'DATA_INSUFFICIENT':position<=.35?'LOW':position>=.65?'HIGH':'WITHIN_RANGE',position,high,low,sourceThrough:history.at(-1).date};
}
function intrabarOrder(bar,{direction='BULLISH',invalidationLevel,targetLevel}={}){
 if(!(invalidationLevel>0&&targetLevel>0))return {status:'NOT_EVALUATED',stopTouched:null,targetTouched:null};
 const bullish=direction==='BULLISH'||direction==='UP',stopTouched=bullish?bar.low<=invalidationLevel:bar.high>=invalidationLevel,targetTouched=bullish?bar.high>=targetLevel:bar.low<=targetLevel;
 return {status:stopTouched&&targetTouched?'ORDER_UNKNOWN':'DAILY_TOUCH_ONLY',stopTouched,targetTouched,realizedProfit:null,note:'日K不能辨識先碰目標或停損；碰觸不等同成交'};
}
function engulfingSeed(b,index,context,p=CONFIRM_PARAM){
 if(index<1)return [];const r=context.report,previous=b[index-1],current=b[index],shape=engulfingShape(previous,current,r);if(!shape.bodyEngulfed)return [];
 const bullish=shape.direction==='BULLISH',volume=confirmationVolume(b,index,context,p),priceConfirmed=bullish?strictAbove(current.close,previous.high,r):strictBelow(current.close,previous.low,r),location=eventLocation(b.slice(0,index),current);
 return ['BODY_ENGULFING',...(shape.fullRangeEngulfed?['FULL_RANGE_ENGULFING']:[])].map(patternType=>({
  id:[r.stock||r.code||r.instrumentType,current.date,shape.direction,patternType].join(':'),stockCode:String(r.stock||r.code||r.instrumentType),market:r.market,signalDate:current.date,signalIndex:index,patternType,direction:shape.direction,label:shape.label,previousCandle:{...previous},currentCandle:{...current},bodyEngulfed:true,fullRangeEngulfed:shape.fullRangeEngulfed,priceConfirmed,volumeConfirmed:volume.passed,volumeRatioPrevious:volume.ratioPrevious,volumeRatio5:volume.ratio5,volumeEvidence:volume,location,
  confirmTrigger:bullish?current.high:current.low,invalidationLevel:bullish?current.low:current.high,targetLevel:p.targetLevel??null,confirmationDate:null,failureDate:null,status:!volume.usable?'DATA_INSUFFICIENT':priceConfirmed&&volume.passed?'STRICT_CONDITIONS_PASSED':'PATTERN_APPEARED',failureReason:null,dataSource:context.source,parameterVersion:p.version,strictConditionsPassed:priceConfirmed&&volume.passed,followThroughConfirmed:false,bodyBoundaryEquality:shape.bodyBoundaryEquality,rangeBoundaryEquality:shape.rangeBoundaryEquality,availableAt:current.date,observationLimit:p.confirmBars,executionEvidence:[]
 }));
}
function followEngulfing(b,seed,context,p=CONFIRM_PARAM){
 const e={...seed,signalStatus:seed.status,executionEvidence:[],history:[{date:seed.signalDate,status:seed.status}]},bullish=e.direction==='BULLISH';
 for(let i=seed.signalIndex+1;i<b.length;i++){
  if(e.status==='FAILED'||e.status==='EXPIRED')break;
  const z=b[i],age=i-seed.signalIndex,order=intrabarOrder(z,e);if(order.status==='ORDER_UNKNOWN')e.executionEvidence.push({date:z.date,...order});
  if(bullish?strictBelow(z.close,e.invalidationLevel,context.report):strictAbove(z.close,e.invalidationLevel,context.report)){e.status='FAILED';e.failureDate=z.date;e.failureReason=bullish?'完成收盤跌破多頭吞沒失效價':'完成收盤突破空頭吞沒失效價';const opposite=engulfingShape(b[i-1],z,context.report);if(opposite.bodyEngulfed&&opposite.direction!==e.direction)e.failureReason+='；出現反向吞沒';e.history.push({date:z.date,status:e.status});break;}
  const continuation=bullish?strictAbove(z.close,e.confirmTrigger,context.report):strictBelow(z.close,e.confirmTrigger,context.report);
  if(!e.confirmationDate&&age<=p.confirmBars&&continuation){e.followThroughConfirmed=true;e.followThroughDate??=z.date;if(e.strictConditionsPassed){e.confirmationDate=z.date;e.status='FOLLOW_THROUGH_CONFIRMED';}}
  if(!e.confirmationDate){if(age>=p.confirmBars){e.status='EXPIRED';e.expirationDate=z.date;}else if(e.status!=='DATA_INSUFFICIENT')e.status='WAITING_CONFIRMATION';}
  e.history.push({date:z.date,status:e.status});
 }
 e.asOf=b.at(-1).date;e.executionStatus=e.executionEvidence.length?'ORDER_UNKNOWN':'NO_VERIFIED_EXECUTION';return e;
}
function separatedTouches(rows,key,level,tolerance,p){const dates=[];let previous=-Infinity;for(let i=0;i<rows.length;i++)if(Math.abs(rows[i][key]-level)<=tolerance&&i-previous>=p.touchSeparation){dates.push(rows[i].date);previous=i;}return dates;}
function rangeBefore(b,index,context,p=CONFIRM_PARAM){
 const history=b.slice(0,index);if(history.length<Math.max(15,p.rangeMin))return null;
 const atr=U.atr(history,14);if(!(atr>0))return null;
 const end=history.length-1,ma10=U.ma(history,10),old=U.ma(history,10,end-p.maSlopeBars);if(old===null)return null;
 for(let length=Math.min(p.rangeMax,history.length);length>=p.rangeMin;length--){
  const rows=history.slice(-length),high=Math.max(...rows.map(z=>z.high)),low=Math.min(...rows.map(z=>z.low)),width=high-low,tick=nextLegal(high,1,context.report)-high,tolerance=Math.max(tick,atr*p.touchATR),drift=Math.abs(rows.at(-1).close-rows[0].close),ma10Slope=(ma10-old)/p.maSlopeBars;
  const moves=rows.slice(1).map((z,i)=>Math.sign(cents(z.close)-cents(rows[i].close))).filter(Boolean),directional=moves.length?Math.max(moves.filter(x=>x>0).length,moves.filter(x=>x<0).length)/moves.length:0;
  if(directional>=p.maxDirectionalShare&&drift>=Math.max(tick*2,atr*.25))continue;
  if(!(width>0)||width/atr>p.rangeATR||Math.abs(ma10Slope)/atr>p.maxMaSlopeATR||drift/width>p.maxDriftWidth)continue;
  const upper=separatedTouches(rows,'high',high,tolerance,p),lower=separatedTouches(rows,'low',low,tolerance,p);
  if(upper.length<p.minTouches||lower.length<p.minTouches)continue;
  // Slope of the complete candidate window also rejects a steady staircase hidden by a late flat MA10.
  const fitLine=fit(rows.map((z,i)=>({index:i,price:z.close})));if(Math.abs(fitLine.slope)*(length-1)/width>p.maxDriftWidth)continue;
  return {type:'RANGE_CONSOLIDATION',boxStartDate:rows[0].date,boxEndDate:rows.at(-1).date,boxHigh:high,boxLow:low,boxWidthPct:width/((high+low)/2)*100,boxAtrRatio:width/atr,upperTouches:upper.length,lowerTouches:lower.length,upperTouchDates:upper,lowerTouchDates:lower,atr14:atr,tolerance,ma10,ma10Slope,ma10SlopePct:U.pct(ma10,old),sourceThrough:rows.at(-1).date,formationIndex:index,parameterVersion:p.version,rangeStatus:'RANGE_CANDIDATE',breakoutLevel:high,retestObservationLevel:high,invalidationLevel:low};
 }
 return null;
}
function rangeTrack(b,context,p=CONFIRM_PARAM){
 const records=[];let active=null;
 for(let i=Math.max(15,p.rangeMin);i<b.length;i++){
  const z=b[i];
  if(active&&(['FAILED_BREAKOUT','FAILED_BREAKDOWN','EXPIRED'].includes(active.rangeStatus)||!active.signalDate&&i-active.formationIndex>p.rangeMaxAge))active=null;
  if(!active){const box=rangeBefore(b,i,context,p);if(!box)continue;active={...box,id:[context.report.stock||context.report.instrumentType,box.boxStartDate,box.boxEndDate].join(':'),stockCode:String(context.report.stock||context.report.instrumentType),direction:null,signalDate:null,confirmationDate:null,failureDate:null,volumeRatio5:null,volumeEvidence:null,evidence:[],executionEvidence:[],nextCondition:'等待完成收盤越過箱頂／箱底及量能確認'};records.push(active);}
  const e=active,volume=confirmationVolume(b,i,context,p),g=U.geometry(z),above=strictAbove(z.close,e.boxHigh,context.report),below=strictBelow(z.close,e.boxLow,context.report);
  e.asOf=z.date;e.currentVolumeRatio5=volume.ratio5;
  if(e.signalDate){
   const fail=e.direction==='UP'?z.close<=e.boxHigh:z.close>=e.boxLow;
   if(z.date>e.signalDate&&fail){if(p.targetLevel){const order=intrabarOrder(z,{direction:e.direction,invalidationLevel:e.invalidationLevel,targetLevel:p.targetLevel});if(order.status==='ORDER_UNKNOWN')e.executionEvidence.push({date:z.date,...order});}e.rangeStatus=e.direction==='UP'?'FAILED_BREAKOUT':'FAILED_BREAKDOWN';e.failureDate=z.date;e.failureReason=e.direction==='UP'?'突破後完成收盤重新跌回箱內':'跌破後完成收盤重新站回箱內';e.nextCondition='舊訊號已失效，等待新的箱體與量價證據';e.evidence.push({date:z.date,state:e.rangeStatus,close:z.close});continue;}
   const quality=(e.direction==='UP'?above&&g.closeLocation>=p.closeLocation:below&&g.closeLocation<=1-p.closeLocation)&&volume.passed;
   if(!e.qualificationDate&&quality){e.qualificationDate=z.date;e.qualifiedVolume=volume;}
   if(e.qualificationDate&&z.date>e.qualificationDate&&(e.direction==='UP'?above:below)){
    e.confirmationDate??=z.date;const tested=e.direction==='UP'?z.low<=e.boxHigh+e.tolerance:z.high>=e.boxLow-e.tolerance;
    e.rangeStatus=tested&&volume.usable?'RETEST_HELD':e.direction==='UP'?'BREAKOUT_CONFIRMED':'BREAKDOWN_CONFIRMED';if(e.rangeStatus==='RETEST_HELD')e.retestDate=z.date;e.nextCondition='追蹤完成收盤是否仍守住原箱體邊界；原策略風控不變';
   }else if(!e.confirmationDate&&i-e.signalIndex>=p.rangeConfirmBars){e.rangeStatus='EXPIRED';e.expirationDate=z.date;e.nextCondition='確認期限已過，等待新訊號';}
  }else if(above||below){
   e.direction=above?'UP':'DOWN';e.signalDate=z.date;e.signalIndex=i;e.breakoutLevel=above?e.boxHigh:e.boxLow;e.retestObservationLevel=e.breakoutLevel;e.invalidationLevel=above?e.boxLow:e.boxHigh;e.failureBoundary=e.breakoutLevel;e.volumeRatio5=volume.ratio5;e.volumeEvidence=volume;e.closeLocation=g.closeLocation;e.rangeStatus=above?'BREAKOUT_PENDING':'BREAKDOWN_PENDING';
   const quality=volume.passed&&(above?g.closeLocation>=p.closeLocation:g.closeLocation<=1-p.closeLocation);if(quality){e.qualificationDate=z.date;e.qualifiedVolume=volume;}
   e.nextCondition=!volume.usable?'先核對成交量來源及統計口徑':!volume.passed?'價格已越線，等待可靠量能；不能稱強勢突破':!quality?'收盤位置未達研究門檻，等待更完整證據':'等待後續完成日K仍收在同一關卡之外';
  }else if(z.high>e.boxHigh||z.low<e.boxLow){e.rangeStatus='INTRADAY_REJECTION';e.rejectionDate=z.date;e.rejectedDirection=z.high>e.boxHigh&&z.low<e.boxLow?'BOTH':z.high>e.boxHigh?'UP':'DOWN';e.nextCondition='盤中刺穿、收盤未突破；等待完成收盤與量能';}else e.rangeStatus='RANGE_CANDIDATE';
  if(e.signalDate&&p.targetLevel){const order=intrabarOrder(z,{direction:e.direction,invalidationLevel:e.invalidationLevel,targetLevel:p.targetLevel});if(order.status==='ORDER_UNKNOWN')e.executionEvidence.push({date:z.date,...order});}
  e.asOf=z.date;e.evidence.push({date:z.date,state:e.rangeStatus,close:z.close,volumeStatus:volume.status,volumeRatio5:volume.ratio5});
 }
 return records;
}
function confirmationResearch(input,options={}){
 const p={...CONFIRM_PARAM,...options.parameters};
 for(const k of ['confirmBars','rangeMin','rangeMax','rangeConfirmBars','minTouches','touchSeparation','maSlopeBars','rangeMaxAge'])if(!Number.isInteger(p[k])||p[k]<1)throw Error('研究參數必須是正整數：'+k);
 if(p.minTouches<2||p.maxDirectionalShare<=.5||p.maxDirectionalShare>1||p.closeLocation<.5||p.rangeMin<8||p.rangeMax>20||p.rangeMax<p.rangeMin||![p.volumeRatio5,p.rangeATR,p.touchATR,p.maxMaSlopeATR,p.maxDriftWidth,p.maxDirectionalShare,p.closeLocation].every(x=>Number.isFinite(x)&&x>0)||p.closeLocation>=1)throw Error('箱體／量價研究參數無效');
 p.version=String(p.version).split(':')[0]+':'+U.hash(Object.fromEntries(Object.entries(p).filter(([key])=>key!=='version')));
 const base={version:'ENGULF_RANGE_RESEARCH_1',parameterVersion:p.version,parameters:p,...RESEARCH_FLAGS};
 if(options.enabled===false)return U.freeze({...base,state:'DISABLED',events:[],rangeEvents:[],range:null});
 const context=confirmationInput(input,options);if(!context.ok)return U.freeze({...base,state:'DATA_INSUFFICIENT',reason:context.reason,stockCode:String(input?.stock||input?.code||input?.instrumentType||''),date:options.asOf||input?.closeDate||null,events:[],rangeEvents:[],range:null,rangeStatus:'DATA_INSUFFICIENT',contradictions:[]});
 const b=context.bars;if(b.length<6)return U.freeze({...base,state:'DATA_INSUFFICIENT',reason:'至少需前五根均量與當日完成K',date:context.asOf,events:[],rangeEvents:[],range:null,rangeStatus:'DATA_INSUFFICIENT',contradictions:[]});
 const events=[];for(let i=1;i<b.length;i++)for(const seed of engulfingSeed(b,i,context,p))events.push(followEngulfing(b,seed,context,p));
 const rangeEvents=rangeTrack(b,context,p),range=rangeEvents.at(-1)||null,z=b.at(-1),ma20=U.ma(b,20),rsi=U.rsi(b,5),contradictions=[];
 const latest=events.filter(e=>e.signalDate>=b[Math.max(0,b.length-1-p.confirmBars)].date);
 if(latest.some(e=>e.direction==='BULLISH')&&ma20!==null&&z.close<ma20)contradictions.push('出現多頭吞沒，但收盤仍在20日均線下；不等同中期轉強');
 if(latest.some(e=>e.direction==='BEARISH')&&ma20!==null&&z.close>ma20)contradictions.push('出現空頭吞沒，但仍在20日均線上；短線警訊不等同中期翻空');
 if(rsi!==null&&rsi>=75&&(latest.some(e=>e.direction==='BULLISH')||range?.direction==='UP'))contradictions.push('新訊號偏多，但RSI偏熱；仍需遵守原追價風險檢查');
 if(latest.some(e=>e.direction==='BULLISH'&&e.strictConditionsPassed)&&latest.some(e=>e.direction==='BEARISH'&&e.strictConditionsPassed))contradictions.push('近期多頭與空頭吞沒互相衝突；應逐一追蹤失效，不合成更高信心');
 if(latest.some(e=>e.direction==='BULLISH'&&e.status==='FOLLOW_THROUGH_CONFIRMED')&&['FAILED_BREAKOUT','BREAKDOWN_CONFIRMED'].includes(range?.rangeStatus))contradictions.push('吞沒後續與箱體證據不一致；仍以失效或原策略風控為優先');
 if(input.originalInvalidation!=null)contradictions.push('研究失效價與原策略停損分開記錄，研究訊號不覆寫原停損');
 return U.freeze({...base,state:'RESEARCH_ONLY',stockCode:String(context.report.stock||context.report.instrumentType),market:context.report.market,date:context.asOf,close:z.close,historyBarCount:b.length,observationStartDate:b[Math.max(0,b.length-1-p.confirmBars)].date,source:context.source,priceBasis:context.priceBasis,volumeStatus:context.volumeStatus,events,rangeEvents,range,rangeStatus:range?.rangeStatus||(b.length<15?'DATA_INSUFFICIENT':'NOT_FORMED'),contradictions,ma:{ma5:U.ma(b,5),ma10:U.ma(b,10),ma20},rsi5:rsi,location:eventLocation(b.slice(0,-1),z),limitations:['OHLCV聚集區不是委託簿，不能證明買賣掛單、主力成本或交易意圖','固定研究門檻尚未證實有預測改善，訊號不得提高正式排名或資格']});
}
// Presentation only: keep raw evidence, state identifiers and thresholds unchanged.
const EVENT_ZH={PATTERN_APPEARED:'型態已出現，還要等後續表現',STRICT_CONDITIONS_PASSED:'訊號當天的價格與成交量已過關，還要等後續收盤確認',FOLLOW_THROUGH_CONFIRMED:'後續收盤已通過確認條件',WAITING_CONFIRMATION:'等待後續收盤確認',FAILED:'已失效：原本的方向沒有守住',EXPIRED:'已逾期：觀察時間內沒有確認',DATA_INSUFFICIENT:'資料不足，暫時不能確認'};
const RANGE_ZH={RANGE_CANDIDATE:'股價在一段範圍內來回，先觀察',BREAKOUT_PENDING:'收盤已漲出區間，成交量或後續表現還要確認',BREAKOUT_CONFIRMED:'漲出區間後，後續收盤仍守在上方',BREAKDOWN_PENDING:'收盤已跌出區間，成交量或後續表現還要確認',BREAKDOWN_CONFIRMED:'跌出區間後，後續收盤仍在下方',RETEST_HELD:'回到原本邊界附近後，收盤仍守在突破方向',INTRADAY_REJECTION:'盤中曾越過邊界，收盤卻沒站出去',FAILED_BREAKOUT:'突破失敗警戒：漲出去後，收盤又退回邊界或區間內',FAILED_BREAKDOWN:'跌破失敗警戒：跌出去後，收盤又回到邊界或區間內',DATA_INSUFFICIENT:'資料不足，先不要判斷',EXPIRED:'等候時間已過，這次先不算確認'};
const CONFIRM_PLAIN_TEXT={
 '等待完成收盤越過箱頂／箱底及量能確認':'等收盤真正漲過區間上緣或跌破下緣，成交量也要通過檢查。',
 '舊訊號已失效，等待新的箱體與量價證據':'這次訊號已失效，先等新的整理區間與價格、成交量證據。',
 '追蹤完成收盤是否仍守住原箱體邊界；原策略風控不變':'繼續看收盤能否留在突破的那一側，仍照原本的風險與停損計畫。',
 '確認期限已過，等待新訊號':'等候時間已過，先等新的訊號。',
 '先核對成交量來源及統計口徑':'先核對成交量來自哪裡，以及股數、張數和計算範圍是否一致。',
 '價格已越線，等待可靠量能；不能稱強勢突破':'收盤雖然越過邊界，成交量還沒過關，先不要當成強勢突破。',
 '收盤位置未達研究門檻，等待更完整證據':'收盤還不夠靠近當天突破方向的高點或低點，先繼續觀察。',
 '等待後續完成日K仍收在同一關卡之外':'等下一個交易日收盤，看看是否還留在突破的那一側。',
 '盤中刺穿、收盤未突破；等待完成收盤與量能':'盤中曾越線，但收盤沒站出去；要等收盤與成交量都過關。',
 '出現多頭吞沒，但收盤仍在20日均線下；不等同中期轉強':'有反彈跡象，但股價仍低於最近20天平均價，還不能說整體已轉強。',
 '出現空頭吞沒，但仍在20日均線上；短線警訊不等同中期翻空':'短線有轉弱跡象，但股價仍高於最近20天平均價，還不能說整體已轉空。',
 '新訊號偏多，但RSI偏熱；仍需遵守原追價風險檢查':'雖有上漲跡象，但短時間可能漲得太急（RSI偏高），仍要小心追高。',
 '近期多頭與空頭吞沒互相衝突；應逐一追蹤失效，不合成更高信心':'最近上漲與下跌訊號都有出現，方向還不一致，不能因此提高把握。',
 '吞沒後續與箱體證據不一致；仍以失效或原策略風控為優先':'K線訊號和整理區間的走勢不同，先處理失效警訊與原本的風險。',
 '研究失效價與原策略停損分開記錄，研究訊號不覆寫原停損':'這裡的「觀察失效價」只用來追蹤訊號，原本的停損計畫照舊。'
};
function confirmationPlainReason(reason){
 const s=String(reason||'');
 if(/股票或日期不一致/.test(s))return '這份報告的股票或日期和研究資料對不上，請重新查詢。';
 if(/其他股票|其他商品|股票代號|商品類型|指數身分|市場別|其他.*市場/.test(s))return '股票、指數或上市櫃市場資料還沒核對一致。';
 if(/公司行動|除權息|還原|價格調整|價格基準/.test(s))return '除權息、減資等紀錄還沒核對完整，價格可能不能直接前後比較。';
 if(/日曆|不連續|缺漏/.test(s))return '交易日或每日資料還沒核對完整，可能有缺日，先不要判斷。';
 if(/成交量單位衝突/.test(s))return '成交量的股數、張數單位對不上，先不能用來確認。';
 if(/成交量單位/.test(s))return '成交量是用股數還是張數，還沒核對清楚。';
 if(/OHLC|跳動|價格.*合法/.test(s))return '開盤、最高、最低或收盤價還沒通過價格規則檢查。';
 if(/前五根|不足|日K太少|沒有.*日K/.test(s))return '可用的每日資料還不夠，先等歷史資料補齊。';
 if(/零量|停牌/.test(s))return '有沒有成交或是否停牌還需要核對，先不要用這段資料確認。';
 if(/完成|日期/.test(s))return '資料日期或是否已收盤還沒核對一致，先不要當成完整盤後結果。';
 if(/Worker|契約/.test(s))return '行情資料還沒通過系統的一致性檢查，先等待可靠資料。';
 return '可用的盤後資料還沒核對完整，暫時不能確認。';
}
function confirmationView(research,original={}){
 const mismatched=research&&original.code&&(research.stockCode&&String(original.code)!==research.stockCode||original.date&&research.date!==original.date);
 const a=mismatched?{state:'DATA_INSUFFICIENT',reason:'報告與研究的股票或日期不一致',date:original.date}:research,fmt=v=>Number.isFinite(v)?v.toFixed(2):'尚未取得',unavailable=!a||['DISABLED','DATA_INSUFFICIENT'].includes(a.state);
 if(unavailable)return U.freeze({title:'K線吞沒與箱體突破確認',wordingVersion:'ENGULF_RANGE_PLAIN_1',state:a?.state||'DATA_INSUFFICIENT',date:a?.date||null,fields:[{title:'結論',value:a?.state==='DISABLED'?'這項額外觀察目前已關閉。':'資料不足：'+confirmationPlainReason(a?.reason)},{title:'下一步',value:'先把股票、收盤日期、每日價格、成交量與除權息紀錄核對好，再看是否出現訊號。'}],research:a||null});
 const events=a.events.filter(e=>e.signalDate===a.date),recent=a.events.filter(e=>e.signalDate>=a.observationStartDate&&!['EXPIRED','FAILED','DATA_INSUFFICIENT'].includes(e.status)),e=events.findLast(x=>x.patternType==='FULL_RANGE_ENGULFING')||events.at(-1)||recent.at(-1),range=a.range,position={LOW:'低位',HIGH:'高位',WITHIN_RANGE:'區間內',DATA_INSUFFICIENT:'資料不足'}[e?.location?.state||a.location?.state]||'資料不足';
 const failed=e?.status==='FAILED'||['FAILED_BREAKOUT','FAILED_BREAKDOWN'].includes(range?.rangeStatus),originalBlocked=['AVOID','DATA'].includes(original.entryDirection?.entry)||['DO_NOT_ENTER','CANNOT_EVALUATE'].includes(original.unifiedResearch?.entryDecision);
 const bull=e?.direction==='BULLISH',closeBoundary=e?(bull?e.previousCandle.high:e.previousCandle.low):null;
 const step=range?(CONFIRM_PLAIN_TEXT[range.nextCondition]||'等接下來的收盤價與成交量都符合條件。'):e?(['FAILED','EXPIRED'].includes(e.status)?'這次訊號已結束，先等新的訊號。':e.status==='DATA_INSUFFICIENT'?'先核對成交量資料，再看收盤是否通過確認價。':e.status==='FOLLOW_THROUGH_CONFIRMED'?'持續看收盤是否維持原方向，仍照原本停損計畫。':'從訊號隔天起，最多觀察'+e.observationLimit+'個交易日：收盤要'+(bull?'漲過 ':'跌破 ')+fmt(e.confirmTrigger)+'。'+(bull?'收盤跌破 ':'收盤漲過 ')+fmt(e.invalidationLevel)+'，這次觀察就失效。'):'等新的K線訊號，並核對價格位置、收盤與成交量。';
 const fields=[{title:'K線型態',value:e?(e.signalDate===a.date?'今天出現：':'追蹤先前訊號：')+e.label+'。'+(e.patternType==='FULL_RANGE_ENGULFING'?'整根高低範圍也包住前一天（全幅吞沒）。':'只包住開盤到收盤的實體，影線不一定包住。')+'日期 '+e.signalDate:'無明確吞沒型態'},{title:'位置',value:position+'：與訊號出現前的股價比較，不能當成已找到最低點或最高點。'},{title:'收盤',value:e?'訊號日收盤'+(e.priceConfirmed?'已':'還沒')+(bull?'漲過前一天最高價 ':'跌破前一天最低價 ')+fmt(closeBoundary)+'。':'沒有吞沒訊號，先不判斷這一關。'},{title:'成交量',value:e?(e.volumeEvidence.usable?(e.volumeConfirmed?'通過初步檢查':'還沒通過初步檢查')+'：是前一天的 '+fmt(e.volumeRatioPrevious)+' 倍、前5天平均的 '+fmt(e.volumeRatio5)+' 倍。':'來源待核：成交量資料還沒核對好，不能說這一關已通過。'):'等出現訊號，再比較當天與之前的成交量。'},{title:'吞沒進度',value:e?(EVENT_ZH[e.status]||'資料不足，暫時不能確認')+'。'+(e.confirmationDate?'確認日期 '+e.confirmationDate+'。':'')+(e.failureDate?'失效日期 '+e.failureDate+'：收盤已越過觀察失效價。'+(/反向吞沒/.test(e.failureReason||'')?'也出現了反方向的吞沒K線。':''):'')+'後續確認價 '+fmt(e.confirmTrigger)+'；觀察失效價 '+fmt(e.invalidationLevel)+'。'+(e.executionStatus==='ORDER_UNKNOWN'?'同一天碰到目標與失效價，無法知道先後，不能算已獲利。':''):'先等新的吞沒訊號。'},{title:'箱體',value:range?(RANGE_ZH[range.rangeStatus]||'資料不足')+'。箱頂（上緣）'+fmt(range.boxHigh)+'／箱底（下緣）'+fmt(range.boxLow)+'；收盤 '+fmt(a.close)+(a.close>range.boxHigh?' 在上方':a.close<range.boxLow?' 在下方':' 在區間內')+'。整理期間 '+range.boxStartDate+'～'+range.boxEndDate:'還沒找到符合條件、上下來回的整理區間。'},{title:'突破／回測／失效',value:range?'越過邊界看 '+fmt(range.breakoutLevel)+'；回到邊界附近觀察 '+fmt(range.retestObservationLevel)+'；觀察失效價 '+fmt(range.invalidationLevel)+'。沿用突破前區間，不跟著當天價格移動。':'還沒有可靠的整理區間，先不填這些價格。'},{title:'結論',value:failed?'失效警戒：原本的方向沒守住，先不要當成強勢突破。':originalBlocked?'風險過高或資料待核，原本買進檢查仍有阻擋；不能因新訊號就進場。':a.volumeStatus!=='VERIFIED_SOURCE'?'資料不足：成交量資料還沒核對好，現在不能確認。':e?.status==='FOLLOW_THROUGH_CONFIRMED'||['BREAKOUT_CONFIRMED','BREAKDOWN_CONFIRMED','RETEST_HELD'].includes(range?.rangeStatus)?'後續收盤已符合這項觀察條件，仍要通過原本的趨勢、風險與買進檢查。':'先觀察、等確認，不要只看到一根上漲紅K就追買。'},{title:'下一步',value:step}];
 if(originalBlocked)fields.push({title:'原策略仍有阻擋',value:'原本的買進或資料檢查還沒通過，原因請看主報告；這項新訊號不會自動放行。'});
 if(range?.executionEvidence?.length)fields.push({title:'日K先後限制',value:'同一天碰到目標與觀察失效價，單看日K不知道先到哪裡，不能算已成交或已獲利。'});
 const plan=original.unifiedResearch?.scenarios?.find(x=>x.riskReward?.status==='KNOWN')?.riskReward;
 fields.push({title:'均線與風險報酬',value:'最近5／10／20天平均價：'+fmt(a.ma.ma5)+'／'+fmt(a.ma.ma10)+'／'+fmt(a.ma.ma20)+'。'+(plan?.rr>0?'原計畫預期獲利約為預計風險的 '+fmt(plan.rr)+' 倍，仍須計入成本並照原停損。':'可能賺多少、可能賠多少，仍看原本計畫；資料不足就先不估目標。')});
 if(a.contradictions.length)fields.push({title:'與原策略的差異',value:a.contradictions.map(s=>CONFIRM_PLAIN_TEXT[s]||'新訊號和原本檢查結果不同，仍先遵守原本的風險限制。').join('')});
 fields.push({title:'研究限制',value:'這是額外觀察，效果還沒證實；不調高分數、不更動前8名、買進條件、原停損或電腦模型預測。整理區間來自過去成交資料，看不到現在掛著的買賣單。'});
 return U.freeze({title:'K線吞沒與箱體突破確認',wordingVersion:'ENGULF_RANGE_PLAIN_1',state:'RESEARCH_ONLY',date:a.date,fields,research:a});
}

function evaluate(b,r={},options={}){const p={...PARAM,...options.parameters},pv=options.pivots||pivots(b,p),v=volume(b,r),z=b.at(-1);
 const levels=pv.map(x=>({price:x.price,source:'已確認波段'+(x.type==='HIGH'?'高點':'低點'),type:x.type,confirmedAt:x.confirmedAt,index:x.index,pivotDate:x.pivotDate}));
 const research=confirmationResearch(r,{enabled:options.researchEnabled,parameters:options.confirmationParameters}),patterns=[triangle(b,pv,v,p),doubleBottom(b,pv,v,p)].filter(Boolean),priorHigh=b.length>=21?Math.max(...b.slice(-21,-1).map(x=>x.high)):null,event=breakoutEvent(b,p),pb=pullback(b,v,p);
 const highs=pv.filter(x=>x.type==='HIGH').slice(-2),rsis=highs.map(x=>U.rsi(b.slice(0,x.index+1),14)),divergence=highs.length===2&&rsis.every(finite)&&highs[1].price>highs[0].price&&rsis[1]<rsis[0];
 return U.freeze({version:VERSION,parameterVersion:p.version,parameters:p,date:z.date,volume:v,breakout:quality(b,priorHigh,v,p),breakoutEvent:event,pullback:pb,patterns,candles:candleContext(b,levels,p,research),pivots:pv,confirmationResearch:research,
  momentum:{formula:'Wilder RSI14；以已確認波峰對照，價格與RSI非獨立證據',rsi14:U.rsi(b,14),bearishDivergence:divergence,peaks:highs,values:rsis,confirmedAt:divergence?highs[1].confirmedAt:null},
  gap:{openingGapPct:U.pct(z.open,b.at(-2).close),fullRangeUp:z.low>b.at(-2).high,corporateActionBasisVerified:r.priceAdjustment?.verified===true&&r.priceAdjustment?.corporateActionsVerified===true,note:'開盤高於昨收不等於全區間缺口；未核實除權息不解讀為突破缺口'},
  unsupportedClaims:['主力成本與交易意圖','封單撤單與對倒','15%換手出貨分界'],researchOnly:true,performanceValidated:false,affectsOriginalEligibility:false,affectsOriginalScore:false,affectsOriginalRanking:false});
}
return Object.freeze({VERSION,PARAM,CONFIRM_PARAM,confirmationInput,confirmationVolume,engulfingShape,engulfingSeed,followEngulfing,rangeBefore,rangeTrack,intrabarOrder,confirmationResearch,confirmationView,EVENT_ZH,RANGE_ZH,candleContext,pivots,volume,quality,breakoutEvent,pullback,triangle,doubleBottom,evaluate,lineAt});
});
