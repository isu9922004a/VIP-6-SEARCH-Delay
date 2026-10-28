/* Causal price/volume context. No network, orders, formal gates, scores or ranks. */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon);
 if(node)module.exports=api;else root.ShitouStructureContext=api;
})(globalThis,function(U){
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
function candleContext(b,levels,p=PARAM){const out=[];
 for(let i=Math.max(5,b.length-3);i<b.length;i++){
  const z=b[i],prev=b[i-1],g=U.geometry(z),history=b.slice(Math.max(0,i-5),i),rise=history.at(-1).close>history[0].close,fall=history.at(-1).close<history[0].close;
  const near=levels.filter(x=>x.confirmedAt<=z.date&&Math.abs(z.close-x.price)<=Math.max(U.tick(z.close)*2,(U.atr(b.slice(0,i+1))||0)*.5)).map(x=>x.source);
  const add=(code,label,bias)=>{const next=b[i+1];const status=!next?'PENDING_CONFIRMATION':bias==='BULLISH'&&next.close>z.high?'CONFIRMED':bias==='BEARISH'&&next.close<z.low?'CONFIRMED':bias==='BULLISH'&&next.close<z.low||bias==='BEARISH'&&next.close>z.high?'INVALIDATED':'PENDING_CONFIRMATION';out.push({code,label,bias,eventDate:z.date,index:i,geometry:g,priorTrend:rise?'RISING':fall?'FALLING':'RANGE',nearReferences:near,status,confirmedAt:status==='CONFIRMED'?next.date:null,note:'形狀與位置僅作研究；下一完成K線確認也不保證趨勢反轉'});};
  if(g.longLower)add(fall?'HAMMER':rise?'HANGING_MAN':'LONG_LOWER',fall?'下跌後錘子候選':rise?'上漲後吊人候選':'長下影觀察',fall?'BULLISH':rise?'BEARISH':'NEUTRAL');
  if(g.longUpper)add(fall?'INVERTED_HAMMER':rise?'SHOOTING_STAR':'LONG_UPPER',fall?'下跌後倒錘候選':rise?'上漲後流星候選':'長上影觀察',fall?'BULLISH':rise?'BEARISH':'NEUTRAL');
  if(g.doji&&!g.longLower&&!g.longUpper)add('DOJI','十字觀察','NEUTRAL');
  if(fall&&prev.close<prev.open&&z.close>z.open&&z.open<=prev.close&&z.close>=prev.open)add('BULLISH_ENGULFING','陽線實體吞噬候選','BULLISH');
  if(rise&&prev.close>prev.open&&z.close<z.open&&z.open>=prev.close&&z.close<=prev.open)add('BEARISH_ENGULFING','陰線實體吞噬候選','BEARISH');
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
function evaluate(b,r={},options={}){const p={...PARAM,...options.parameters},pv=options.pivots||pivots(b,p),v=volume(b,r),z=b.at(-1);
 const levels=pv.map(x=>({price:x.price,source:'已確認波段'+(x.type==='HIGH'?'高點':'低點'),type:x.type,confirmedAt:x.confirmedAt,index:x.index,pivotDate:x.pivotDate}));
 const patterns=[triangle(b,pv,v,p),doubleBottom(b,pv,v,p)].filter(Boolean),priorHigh=b.length>=21?Math.max(...b.slice(-21,-1).map(x=>x.high)):null,event=breakoutEvent(b,p),pb=pullback(b,v,p);
 const highs=pv.filter(x=>x.type==='HIGH').slice(-2),rsis=highs.map(x=>U.rsi(b.slice(0,x.index+1),14)),divergence=highs.length===2&&rsis.every(finite)&&highs[1].price>highs[0].price&&rsis[1]<rsis[0];
 return U.freeze({version:VERSION,parameterVersion:p.version,parameters:p,date:z.date,volume:v,breakout:quality(b,priorHigh,v,p),breakoutEvent:event,pullback:pb,patterns,candles:candleContext(b,levels,p),pivots:pv,
  momentum:{formula:'Wilder RSI14；以已確認波峰對照，價格與RSI非獨立證據',rsi14:U.rsi(b,14),bearishDivergence:divergence,peaks:highs,values:rsis,confirmedAt:divergence?highs[1].confirmedAt:null},
  gap:{openingGapPct:U.pct(z.open,b.at(-2).close),fullRangeUp:z.low>b.at(-2).high,corporateActionBasisVerified:r.priceAdjustment?.verified===true&&r.priceAdjustment?.corporateActionsVerified===true,note:'開盤高於昨收不等於全區間缺口；未核實除權息不解讀為突破缺口'},
  unsupportedClaims:['主力成本與交易意圖','封單撤單與對倒','15%換手出貨分界'],researchOnly:true,performanceValidated:false,affectsOriginalEligibility:false,affectsOriginalScore:false,affectsOriginalRanking:false});
}
return Object.freeze({VERSION,PARAM,pivots,volume,quality,breakoutEvent,pullback,triangle,doubleBottom,evaluate,lineAt});
});
