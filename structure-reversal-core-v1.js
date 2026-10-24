(function(r,f){const n=typeof module==='object'&&module.exports,a=f(n?require('./structure-reversal-config-v1.js'):r.ShitouStructureConfig,n?require('./scan-exclusions-rsi-v5328.js'):r.ShitouScanPolicy5328,n?require('./selection-evidence-v1.js'):r.ShitouSelectionEvidenceV1);if(n)module.exports=a;else r.ShitouStructureCore=a;})(globalThis,function(C,P,E){'use strict';
const LABEL={PATTERN:'型態出現',FALLING:'下跌警示（未止跌）',WATCH:'止跌觀察（未突破）',STALE_CONFIRMED:'歷史確認（訊號逾期）',CONFIRMED:'突破確認',RETEST_HELD:'回測守住',CONTINUING:'續強',FAILED:'反轉失敗',INVALID:'跌破失效',EXPIRED:'超過觀察期限',NONE:'尚無符合型態',DATA:'資料不足'};
const REASONS={FINANCIAL:'金融保險',BIOTECH:'生技醫療',CONSTRUCTION:'建材營造',KY:'KY',DR:'TDR／DR',SPECIAL:'非一般普通股／特殊商品',UNKNOWN:'產業或商品資格無法驗證',LIQUIDITY_DATA:'流動性資料不足',ILLIQUID:'流動性不足',STATUS:'特殊交易狀態／未核對',QUOTE:'日期或量價無效'};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null,num=P.number,date=P.date,yes=P.yes,fmt=(v,d=2)=>num(v)===null?'未驗證':Number(v).toFixed(d);
const ma=(b,n,end=b.length)=>end>=n?mean(b.slice(end-n,end).map(x=>x.close)):null,pct=(a,b)=>b>0?(a/b-1)*100:null;
function hash(value){const s=JSON.stringify(value);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
function classify(code,q={},sector={},meta={}){
 code=String(code);const r={...sector,...q},ic=String(sector.industryCode||q.industryCode||'').padStart(2,'0'),industry=String(sector.industryName||sector.industry||q.industryName||q.industry||''),kind=String(r.securityType||r.productType||r.instrumentType||'').normalize('NFKC').toUpperCase(),name=String(r.name||'').normalize('NFKC'),market=String(r.market||'').toUpperCase(),reasons=[],add=(k,test)=>{if(test)reasons.push(k);};
 add('FINANCIAL',ic==='17'||/金融|銀行|保險|證券|金控/.test(industry));add('BIOTECH',ic==='22'||/生技|醫療|製藥|藥品|醫材/.test(industry));add('CONSTRUCTION',ic==='14'||/建材營造|營建|營造|建設|不動產/.test(industry));
 add('KY',yes(r.isKY)||yes(r.ky)||/^(KY|CYM|CAYMAN|開曼群島)$/i.test(String(r.incorporationCountry||r.jurisdiction||''))||/(?:-|－|\s)KY\*?$/i.test(name));add('DR',/^(TDR|DR|DEPOSITARY_RECEIPT)$/.test(kind)||/^91\d{2,4}$/.test(code)||/(?:-|－|\s)(?:TDR|DR)\*?$/i.test(name));
 const common=/^(COMMON_STOCK|COMMON STOCK|COMMON|EQUITY|STOCK|ORDINARY|普通股|股票)$/.test(kind);
 const specialName=/ETF|ETN|REIT|WARRANT|FUND|PREFERRED|BOND|BENEFICIARY|受益證券|受益憑證|權證|指數投資|特別股|存託憑證|存托憑證|基金/.test(kind+' '+name);
 add('SPECIAL',!!kind&&!common||!/^[1-9]\d{3}$/.test(code)||yes(r.isSpecialProduct)||yes(r.isPreferredStock)||specialName);
 // Some verified ALL_STOCKS Worker rows do not carry a securityType or the
 // separate companySourcesReady/ordinaryValidTotal contract.  The former
 // STRICT check excluded virtually every otherwise classifiable stock.
 // A complete, same-date official quote+industry snapshot may be used to
 // *research* four-digit stock candidates, but is NOT proof of ordinary-stock
 // status.  Never advertise them as independently verified securities.
 const target=date(meta.targetTradeDate||meta.completedTradeDate);
 const marketSnapshotReady=meta.marketCoverageReady===true&&meta.industryCoverageReady===true&&
   meta.snapshotTimelinessReady===true&&num(meta.total)>=1000&&
   num(meta.total)===num(meta.snapshotRowCount)&&
   target!==null&&date(meta.expectedTradeDate)===target&&
   date(meta.twseQuoteDate)===target&&date(meta.tpexQuoteDate)===target&&
   date(q.quoteDate)===target;
 const companyVerified=meta.companySourcesReady?.[market==='TWSE'?'twse':'tpex']===true&&
   num(meta.ordinaryValidTotal)!==null&&num(meta.ordinaryValidTotal)===num(meta.total)&&
   /^[1-9]\d{3}$/.test(code)&&!!sector.industryCode;
 const ordinaryVerified=common||r.ordinaryStockVerified===true||companyVerified;
 const provisional=!ordinaryVerified&&!kind&&marketSnapshotReady&&/^[1-9]\d{3}$/.test(code)&&
   !specialName&&!yes(r.isSpecialProduct)&&!yes(r.isPreferredStock)&&
   ['TWSE','TPEX'].includes(market)&&!!industry&&/^\d{2}$/.test(ic)&&ic!=='00';
 add('UNKNOWN',!['TWSE','TPEX'].includes(market)||!industry||!/^\d{2}$/.test(ic)||ic==='00'||!(ordinaryVerified||provisional));
 const v=num(q.volume),tv=num(q.tradeValue);add('LIQUIDITY_DATA',v===null||tv===null);add('ILLIQUID',v!==null&&tv!==null&&(v<P.RULE.minVolume||tv<P.RULE.minTradeValue||num(q.avg5Volume)!==null&&q.avg5Volume<P.RULE.minVolume||num(q.avg5Lots)!==null&&q.avg5Lots<P.RULE.minVolume/1000));
 const statusKnown=meta.exclusionCoverageReady===true&&date(meta.exclusionDate)===target||r.fullDelivery===false&&date(r.fullDeliveryDate)===target;
 add('STATUS',yes(r.fullDelivery)||yes(r.isFullDelivery)||yes(r.alteredTrading)||yes(r.AlteredTrading)||yes(r.ManagedStock)||yes(r.SuspensionOfTrading)||/全額交割|變更交易|停止交易/.test(String(r.tradingStatus||r.tradingMethod||''))||!target||!statusKnown);
 add('QUOTE',date(q.quoteDate)!==target||['open','high','low','close','volume'].some(k=>!(num(q[k])>0))||q.high<Math.max(q.open,q.close,q.low)||q.low>Math.min(q.open,q.close,q.high));
 const cyclical=['01','03','10','15','21'].includes(ic)||/航運|鋼鐵|塑膠|化學|石化|水泥/.test(industry);
 return {code,key:reasons[0]||'OK',excluded:reasons.length>0,reasons,reason:REASONS[reasons[0]]||'',industry,industryCode:ic,cyclical,ordinaryVerified,provisional,qualificationSource:ordinaryVerified?(common?'明示普通股證券類型':'已驗證普通股主檔'):provisional?'官方同日行情及產業快照／四碼代號備援，普通股身分尚未獨立驗證（僅供研究）':'未驗證'};
}
function candle(b){const range=b.high-b.low,body=Math.abs(b.close-b.open),upper=b.high-Math.max(b.open,b.close),lower=Math.min(b.open,b.close)-b.low;return {range,body,upper,lower,position:range?(b.close-b.low)/range:.5,longUpper:range>0&&upper/range>=C.wickShare&&upper>=body*C.wickBody&&upper>=lower*C.wickDominance,longLower:range>0&&lower/range>=C.wickShare&&lower>=body*C.wickBody&&lower>=upper*C.wickDominance,doji:range>0&&body/range<=C.dojiShare,longBull:b.close>b.open&&range>0&&body/range>=C.longBodyShare,longBear:b.close<b.open&&range>0&&body/range>=C.longBodyShare,strong:range>0&&(b.close-b.low)/range>=C.closePosition,weak:range>0&&(b.close-b.low)/range<.5};}
function atr(b){const a=[];for(let i=Math.max(1,b.length-C.atrDays);i<b.length;i++)a.push(Math.max(b[i].high-b[i].low,Math.abs(b[i].high-b[i-1].close),Math.abs(b[i].low-b[i-1].close)));return mean(a);}
function structure(h,b){const w=h.slice(-C.structureBars),lo=Math.min(...w.map(x=>x.low)),hi=Math.max(...w.map(x=>x.high)),tol=Math.max(b.close*C.nearPricePct,(atr(h)||0)*C.nearATR),levels=[{source:'RANGE_LOW',label:'前20根低點',value:lo},{source:'RANGE_HIGH',label:'前20根高點',value:hi},{source:'MIDPOINT',label:'前20根50%中線',value:(hi+lo)/2}];
 for(const n of [5,10,20,60])if(ma(h,n)!==null)levels.push({source:'MA'+n,label:n+'日均線',value:ma(h,n)});
 const pivots=[];for(let i=C.pivotSide;i<h.length-C.pivotSide;i++){const neighbors=h.slice(i-C.pivotSide,i+C.pivotSide+1).filter((_,j)=>j!==C.pivotSide);for(const kind of ['low','high'])if(neighbors.every(x=>kind==='low'?x.low>h[i].low:x.high<h[i].high))pivots.push({kind,value:h[i][kind],date:h[i].date,confirmedAt:h[i+C.pivotSide].date});}
 for(const k of ['low','high']){const p=pivots.findLast(x=>x.kind===k);if(p)levels.push({source:'PIVOT_'+k,label:'已確認轉折'+(k==='low'?'低':'高')+'點',...p});}
 let wave=null;for(let i=pivots.length-1;i>=0;i--){const high=pivots[i];if(high.kind!=='high')continue;const low=pivots.slice(0,i).findLast(p=>p.kind==='low'&&p.value<high.value);if(low){wave={low:low.value,high:high.value,lowDate:low.date,highDate:high.date,confirmedAt:high.confirmedAt};break;}}
 const fib=wave?[.382,.5,.618].map(r=>{const value=wave.high-(wave.high-wave.low)*r;return {ratio:r,value,touched:b.low<=value+tol&&b.high>=value-tol,overlap:levels.filter(l=>Math.abs(l.value-value)<=tol).map(l=>l.source)};}):[];
 const touched=levels.filter(l=>b.low<=l.value+tol&&b.high>=l.value-tol),clusters=[];for(const l of levels.slice().sort((a,z)=>a.value-z.value)){if(!clusters.some(p=>Math.abs(p.value-l.value)<=tol))clusters.push(l);}
 return {low:lo,high:hi,midpoint:(lo+hi)/2,sourceThrough:h.at(-1).date,tolerance:tol,atr:atr(h),levels,touched,pivots:pivots.slice(-6),wave,fib,confluence:clusters.filter(l=>Math.abs(l.value-b.close)<=tol).length,confluenceSources:[...new Set(touched.map(l=>l.source.startsWith('MA')?'MA':'PRICE_STRUCTURE'))],volumeProfile:'未提供可驗證歷史成交價分布，不推估量價密集區'};
}
const volumeRatio=(b,i)=>{const base=mean(b.slice(i-C.volumeBaselineBars,i).map(x=>x.volume));return {baseline:base,ratio:base>0?b[i].volume/base:null};};
function seeds(b,i,mode){const h=b.slice(0,i),x=b[i],s=structure(h,x),k=candle(x),v=volumeRatio(b,i),out=[],base={mode,signalIndex:i,signalDate:x.date,ohlcv:{...x},structure:s,baselineVolume:v.baseline,anchorVolumeRatio:v.ratio,trigger:x.high,invalidation:x.low};
 if(mode==='A'){const bull=ma(h,20)>ma(h,60)&&ma(h,20)>ma(h,20,h.length-C.trendSlopeBars)&&h.at(-1).close>=ma(h,60),support=s.touched.filter(l=>l.source==='MIDPOINT'||l.source==='MA20'||l.source==='PIVOT_low'),reclaim=support.some(l=>h.at(-1).close<=l.value&&x.close>l.value);if(bull&&support.length&&(k.longLower||reclaim)&&x.close>=Math.min(...support.map(l=>l.value))-s.tolerance)out.push({...base,kind:'BULL_PULLBACK',bullProof:{ma20:ma(h,20),ma60:ma(h,60),priorMA20:ma(h,20,h.length-C.trendSlopeBars)},support});}
 else {const fall=pct(x.close,b[i-C.declineBars].close),decline=ma(h,5)<ma(h,20)&&ma(h,20)<ma(h,20,h.length-C.trendSlopeBars),bodyPct=(x.open-x.close)/x.open,prior=h.slice(-(C.anchorCompareBars-1)).map(y=>(y.open-y.close)/y.open);if(decline&&fall<=C.fall10Pct&&k.longBear&&k.body>=s.atr*C.anchorATR&&bodyPct>Math.max(0,...prior)&&v.ratio<=C.anchorVolume)out.push({...base,kind:'SHRINKING_BEAR',fall10Pct:fall,declineProof:{ma5:ma(h,5),ma20:ma(h,20),priorMA20:ma(h,20,h.length-C.trendSlopeBars)}});}
 return out;
}
function midpointTrack(b,seed){const mid=seed.structure.midpoint,tol=seed.structure.tolerance,history=[];let state='NOT_RECLAIMED',above=false,confirmed=false;for(let i=seed.signalIndex;i<b.length;i++){const x=b[i],v=volumeRatio(b,i);let next=state,why='';if(x.close<mid-tol&&above){next=confirmed?'INVALID':'RETEST_FAILED';why='完成收盤失守固定中線容差';}else if(x.close>mid&&!above){next='FIRST_RECLAIM';why='首次完成收盤站回固定中線';above=true;}else if(above&&x.close>mid&&x.low<=mid+tol&&v.ratio<=C.confirmVolumeA){next='RETEST_HELD';why='縮量回測中線且收盤守住';confirmed=true;}else if(above&&x.close>mid&&x.close>x.open&&v.ratio>=C.confirmVolumeA){next='BREAKOUT_CONFIRMED';why='後續完成日K放量維持中線之上';confirmed=true;}if(next!==state){state=next;history.push({date:x.date,state,condition:why,level:mid});}if(['INVALID','RETEST_FAILED'].includes(state))break;}return {state,level:mid,sourceThrough:seed.structure.sourceThrough,history,labels:{NOT_RECLAIMED:'尚未站回',FIRST_RECLAIM:'首次站回',BREAKOUT_CONFIRMED:'突破確認',RETEST_HELD:'回測守住',RETEST_FAILED:'回測失敗',INVALID:'跌破失效'}};}
function follow(b,seed){const start=seed.mode==='B'?'FALLING':'PATTERN';const e={...seed,state:start,confirmedDate:null,lastStrengthDate:null,failedDate:null,retestDate:null,confirmationVolume:null,consolidationDays:0,history:[{date:seed.signalDate,state:start,condition:seed.mode==='B'?'僅符合超跌長黑條件，尚無止跌證據':'型態符合，等待後續完成日K',trigger:seed.trigger,invalidation:seed.invalidation}]};let confirmedIndex=null;
 const change=(state,x,condition)=>{if(e.state!==state){e.state=state;e.history.push({date:x.date,state,condition,close:x.close,trigger:e.trigger,invalidation:e.invalidation});}};
 for(let j=seed.signalIndex+1;j<b.length;j++){const x=b[j],age=j-seed.signalIndex,k=candle(x),v=volumeRatio(b,j);if(['FAILED','INVALID','EXPIRED'].includes(e.state))break;
 // No intraday path is inferred: invalidation has priority over confirmation.
 if(seed.mode==='B'&&age===1&&x.low<seed.invalidation){e.failedDate=x.date;change('FAILED',x,'次根低點再創低；不推測盤中順序');break;}
 if(x.close<seed.invalidation){e.failedDate=x.date;change('INVALID',x,'完成收盤跌破結構失效價');break;}
 if(!e.confirmedDate){if(x.close>seed.trigger&&x.close>x.open&&k.strong&&v.ratio>=(seed.mode==='A'?C.confirmVolumeA:C.confirmVolumeB)){e.confirmedDate=x.date;confirmedIndex=j;e.confirmationVolume=x.volume;e.confirmationBaseline=v.baseline;e.confirmationRatio=v.ratio;e.consolidationDays=age-1;e.lastStrengthDate=x.date;change('CONFIRMED',x,'收盤放量突破訊號棒高點，日期不前移');}else if(age>=C.confirmBars)change('EXPIRED',x,'確認期限內未完成放量突破');else if(seed.mode==='B'){const prior=b[j-1],stabilized=x.close>prior.close&&x.low>=seed.invalidation&&(k.strong||k.longLower||k.position>=.5);change(stabilized?'WATCH':'FALLING',x,stabilized?'已有初步止跌K棒，仍待收盤放量突破':'仍在下跌／弱收盤，尚未取得止跌證據');}else change('WATCH',x,'尚待收盤及成交量確認');}
 else if(x.close<=seed.trigger){e.failedDate=x.date;change('FAILED',x,'已確認後收盤失守突破點，假突破不自動復活');}
 else if(x.low<=seed.trigger+seed.structure.tolerance&&x.volume<=b[confirmedIndex].volume){e.retestDate=x.date;e.lastStrengthDate=x.date;change('RETEST_HELD',x,'突破後縮量回測，完成收盤仍守住');}
 else if(x.close>b[j-1].high){e.lastStrengthDate=x.date;change('CONTINUING',x,'收盤超過前一完成日高點且未失守');}
 }
 e.midpoint=midpointTrack(b,seed);e.age=b.length-1-seed.signalIndex;
 // Freshness is counted in *completed trading bars* (not calendar days).
 const lastPositive=e.lastStrengthDate||e.confirmedDate;
 const lastIndex=lastPositive?b.findIndex(x=>x.date===lastPositive):-1;
 e.barsSinceEvidence=lastIndex>=0?b.length-1-lastIndex:null;
 e.confirmedHistorically=!!e.confirmedDate;
 e.stale=!!e.confirmedDate&&e.barsSinceEvidence>C.currentEvidenceBars&&['CONFIRMED','RETEST_HELD','CONTINUING'].includes(e.state);
 if(e.stale){e.historicalState=e.state;e.state='STALE_CONFIRMED';e.history.push({date:b.at(-1).date,state:e.state,condition:'距最後有效確認／續強證據已超過'+C.currentEvidenceBars+'根完成日K，不列當前確認榜',trigger:e.trigger,invalidation:e.invalidation});}
 e.confirmedNow=['CONFIRMED','RETEST_HELD','CONTINUING'].includes(e.state);e.label=LABEL[e.state];return e;
}
function validate(report,o){const asOf=date(o.asOf||report.closeDate),rows=report.canonicalBars||report.dailySeries;if(!asOf||report.completed!==true||report.isComplete===false||report.dailySeriesMeta?.onlyCompletedBars===false)return {ok:false,reason:'未確認盤後完成日K'};if(date(report.closeDate||report.dataDate)!==asOf)return {ok:false,reason:'個股與市場日期不一致'};const n=E.normalize(rows,asOf);if(!n.ok)return n;if(n.bars.length<C.minBars||n.bars.some(x=>!(x.volume>0)))return {ok:false,reason:'需65根正量完成日K；零量或缺漏不得刪列補值'};
 if(report.volumeUnit&&!['shares','股'].includes(report.volumeUnit))return {ok:false,reason:'成交量單位非股，未驗證'};
 if(report.corporateActionUnresolved===true||report.priceAdjustmentConsistent===false)return {ok:false,reason:'價格調整口徑有衝突'};
 if(Array.isArray(report.corporateActions)&&report.corporateActions.some(x=>!date(x.date)||date(x.date)>=n.bars[0].date&&date(x.date)<=asOf)&&report.priceAdjustment?.verified!==true)return {ok:false,reason:'公司行動期間價格調整未驗證'};
 const calendar=report.expectedTradingDates;if(calendar){if(!Array.isArray(calendar))return {ok:false,reason:'交易日曆格式無效'};const d=calendar.map(date),set=new Set(n.bars.map(b=>b.date));if(d.some((x,i)=>!x||i>0&&x<=d[i-1])||n.bars.some(b=>!d.includes(b.date))||d.some(x=>x>=n.bars[0].date&&x<=asOf&&!set.has(x)))return {ok:false,reason:'交易日曆與日K不一致'};}
 if(o.quote?.code&&String(o.quote.code)!==String(report.stock||report.code))return {ok:false,reason:'市場主檔與日K代號不一致'};const last=n.bars.at(-1),q=o.quote,eq=(a,b)=>num(a)!==null&&Math.abs(Number(a)-b)<=Math.max(.02,b*.0001);if(!eq(report.close,last.close)||q&&(['open','high','low','close'].some(k=>!eq(q[k],last[k]))||date(q.quoteDate)!==asOf||Math.abs(q.volume-last.volume)/q.volume>.2||!(q.volume>0)||String(q.market)!==String(report.market)))return {ok:false,reason:'快照與日K日期／量價／市場別不同'};
 return {...n,asOf,basisVerified:report.priceAdjustment?.verified===true,calendarVerified:Array.isArray(calendar)&&calendar.length>0};
}
function risk(b,e,s,mode='A'){
 const x=b.at(-1),prior=b.at(-2),k=candle(x),v=volumeRatio(b,b.length-1),trigger=e?.trigger,invalid=e?.invalidation;
 const gap=pct(x.close,trigger),ma20=ma(b,20),ma10=ma(b,10),ma5=ma(b,5),maGap=pct(x.close,ma20);
 const riskPct=invalid>0?(x.close-invalid)/x.close*100:null;
 const resistance=s.levels.filter(l=>/HIGH|high/.test(l.source)&&l.value>=x.close&&l.value-x.close<=s.tolerance);
 const reasons=[],currentWarnings=[],confirmed=e?.confirmedNow===true;
 if(e&&['FAILED','INVALID','EXPIRED','STALE_CONFIRMED'].includes(e.state))reasons.push(e.label);
 if(mode==='A'){
  if(confirmed&&x.close<ma20)currentWarnings.push('最新收盤跌破MA20（歷史突破不代表仍強勢）');
  if(confirmed&&k.longBear&&k.weak)currentWarnings.push('最新長黑弱收，當前轉強品質下降');
  if(confirmed&&x.close<ma10)currentWarnings.push('最新收盤跌破MA10');
  if(gap!==null&&gap>C.maxTriggerGapPct)reasons.push('距確認點 '+fmt(gap)+'% 超過研究追價門檻');
  if(maGap!==null&&maGap>C.maxMA20GapPct)reasons.push('20日乖離 '+fmt(maGap)+'%');
  if(riskPct!==null&&riskPct>C.maxStructureRiskPct)reasons.push('結構失效距離 '+fmt(riskPct)+'%');
 }else{
  if(e&&!e.confirmedHistorically){
   currentWarnings.push(e.state==='WATCH'?'已有初步止跌跡象，仍未突破確認價':'仍是下跌警示，尚未觀察到止跌反轉K棒');
   if(k.longBear&&k.weak)currentWarnings.push('最新長黑弱收，不能僅憑RSI超賣推斷反轉');
   if(riskPct!==null&&riskPct<1)currentWarnings.push('收盤貼近結構失效價（未確認前不視為低風險）');
  }
  if(confirmed&&x.close<ma5)currentWarnings.push('突破後再度跌破MA5');
  if(confirmed&&k.longBear&&k.weak)currentWarnings.push('突破後長黑弱收');
  if(confirmed&&gap>C.maxTriggerGapPct)reasons.push('距確認點 '+fmt(gap)+'% 超過研究追價門檻');
 }
 if(resistance.length&&k.longUpper&&k.weak)reasons.push('既有壓力附近長上影弱收');
 if(v.ratio!==null&&v.ratio>=C.climaxVolume&&prior&&pct(x.close,prior.close)<=C.weakAdvancePct)reasons.push('爆量但價格推進不足');
 const critical=confirmed&&(mode==='A'?(x.close<ma20||(k.longBear&&k.weak)):(x.close<ma5||(k.longBear&&k.weak)));
 if(critical)reasons.push('最新日K高風險：保留歷史確認，移出當前確認榜');
 return {label:critical?'最新日K高風險':e?.stale?'歷史訊號逾期':e?.state==='FALLING'?'下跌警示（不得視為反轉）':e?.state==='WATCH'?'止跌觀察（未突破）':reasons.length?'追價警戒':!confirmed?'觀察中':gap>C.nearTriggerGapPct?'等待回測':'可持續觀察',critical,reasons,currentWarnings,gapTriggerPct:gap,gap20Pct:maGap,structureRiskPct:riskPct,invalidation:invalid??null,resistance};
}
function score(mode,b,e,s,r){
 const w=C.weights[mode],k=candle(b.at(-1)),last=b.at(-1),prior=b.at(-2);
 const facts={structure:mode==='A'?[ma(b,20)>ma(b,60),ma(b,20)>ma(b,20,b.length-C.trendSlopeBars)]:[e?.fall10Pct<=C.fall10Pct,e?.anchorVolumeRatio<=C.anchorVolume],confirmation:mode==='A'?[!!e,!!e?.confirmedDate,e?.confirmedNow===true,['RETEST_HELD','CONTINUING'].includes(e?.state)]:[e?.state==='WATCH'||!!e?.confirmedDate,!!e?.confirmedDate,e?.confirmedNow===true,['RETEST_HELD','CONTINUING'].includes(e?.state)],volume:[e?.anchorVolumeRatio!==null&&e?.anchorVolumeRatio<=(mode==='B'?C.anchorVolume:1),e?.confirmationRatio>=(mode==='A'?C.confirmVolumeA:C.confirmVolumeB)],confluence:[e?.structure?.confluenceSources?.includes('PRICE_STRUCTURE')===true,e?.structure?.confluenceSources?.includes('MA')===true],risk:mode==='A'?[r.reasons.length===0&&!r.currentWarnings.length,r.gapTriggerPct!==null&&r.gapTriggerPct<=C.nearTriggerGapPct,r.structureRiskPct!==null&&r.structureRiskPct<=5]:[e?.confirmedNow===true&&!r.critical,e?.confirmedNow===true&&(last.close>=ma(b,5)),e?.confirmedNow===true&&r.structureRiskPct!==null&&r.structureRiskPct<=5]};
 const parts=Object.entries(w).map(([key,weight])=>({key,weight,passed:facts[key].filter(Boolean).length,total:facts[key].length,points:weight*facts[key].filter(Boolean).length/facts[key].length,tests:facts[key],inputs:{close:last.close,ma20:ma(b,20),ma60:ma(b,60),fall10Pct:e?.fall10Pct??null,anchorVolumeRatio:e?.anchorVolumeRatio,confirmationRatio:e?.confirmationRatio??null,state:e?.state,confluence:e?.structure?.confluence,triggerGapPct:r.gapTriggerPct,structureRiskPct:r.structureRiskPct}}));
 const historicalTotal=Math.round(parts.reduce((v,p)=>v+p.points,0)*100)/100,penalties=[];
 const deduct=(name,points,when)=>{if(when)penalties.push({name,points});};
 if(mode==='A'){
  deduct('最新日K長黑且弱收',20,k.longBear&&k.weak);
  deduct('最新收盤跌破MA20',25,last.close<ma(b,20));
  deduct('最新收盤跌破MA10',10,last.close<ma(b,10));
  deduct('歷史確認逾期',30,!!e?.stale);
 }else{
  deduct('仍屬下跌警示',5,e?.state==='FALLING');
  deduct('最新長黑弱收',6,k.longBear&&k.weak);
  if(!e?.confirmedNow){
   // Linear penalties make two equally oversold stocks distinguishable; these are
   // transparent engineering heuristics, NOT calibrated probabilities.
   deduct('收盤靠近日內低點',Math.round(Math.max(0,.5-k.position)*10*100)/100,k.position<.5);
   deduct('距突破確認價仍遠',Math.round(Math.min(8,Math.max(0,-(r.gapTriggerPct??0))*.75)*100)/100,(r.gapTriggerPct??0)<0);
  }
 }
 if(e&&['FAILED','INVALID','EXPIRED'].includes(e.state))deduct('型態失效或確認到期',30,true);
 const raw=Math.max(0,historicalTotal-penalties.reduce((sum,p)=>sum+p.points,0));
 const cap=e?.stale?35:mode==='B'&&!e?.confirmedNow?(e?.state==='WATCH'?69:49):100;
 const total=Math.round(Math.min(raw,cap)*100)/100;
 return {total,historicalTotal,penalties,cap,parts,basis:'研究用分層風險調整：初始工程權重／扣分未經樣本外績效校準；分數不是上漲機率或買進建議'};
}
// Independent *research* metric.  This is NOT a buy signal or historical win probability.
// Missing OHLCV / trading amount is never rewarded; only completed-day data is used.
function tradeFitness(mode,b,e,r,tradeValue){
 const last=b.at(-1),k=candle(last),v=volumeRatio(b,b.length-1),rsi=E.rsi(b),gap20=pct(last.close,ma(b,20)),gapTrigger=r?.gapTriggerPct;
 const amount=num(tradeValue);
 const available=[amount,v.ratio,k.position,rsi,gap20,r?.structureRiskPct,gapTrigger].every(x=>Number.isFinite(x));
 if(!available)return {score:null,grade:'DATA',label:'交易適配資料不足',parts:[],warnings:['成交金額／量能／收盤位置／動能或風險距離無法完整驗證'],assumptions:'盤後研究適配度，無績效校準'};
 const parts=[],warnings=[];
 const add=(name,value,max,reason)=>{parts.push({name,value,max,reason});};
 add('成交金額',amount>=3e8?20:amount>=1e8?15:amount>=5e7?10:amount>=2e7?5:0,20,'當日正式成交金額（元）');
 if(amount<5e7)warnings.push('正式成交金額低於5千萬元，短線成交適配偏弱');
 const vr=v.ratio;
 add('最新量能',vr>=1.2&&vr<=2.5?20:vr>=1?15:vr>=.8?10:vr>=.5?5:vr>2.5?8:0,20,'最新量／前五根均量');
 if(vr<.8)warnings.push('最新量比低於0.8，動能尚未延續');
 if(vr>2.5)warnings.push('最新量比超過2.5，須留意爆量失速');
 const pos=k.position;
 add('收盤強度',pos>=.75?25:pos>=.55?18:pos>=.35?10:pos>=.2?5:0,25,'當日收盤於高低區間之位置');
 if(pos<.25)warnings.push('當日收盤位置低於25%，弱收盤');
 const stretch=rsi>=90||gap20>=10?0:rsi>=85||gap20>=8?4:rsi>=80||gap20>=5?10:rsi<35?8:20;
 add('過熱與乖離',stretch,20,'RSI5及收盤對MA20乖離');
 if(rsi>=85)warnings.push('RSI5達85以上，短線追高警戒');
 if(gap20>=8)warnings.push('MA20正乖離達8%以上，追價風險高');
 if(gapTrigger>5)warnings.push('距突破確認價超過5%，不宜把歷史確認當新買點');
 const lossDistance=r.structureRiskPct;
 add('失效風險距離',lossDistance>0&&lossDistance<=5?15:lossDistance>0&&lossDistance<=8?9:lossDistance>0&&lossDistance<=10?3:0,15,'收盤至結構失效價之距離');
 if(lossDistance>8)warnings.push('距結構失效價超過8%，可能不符短線停損預算');
 const score=Math.round(parts.reduce((sum,p)=>sum+p.value,0)*100)/100;
 // Trading suitability is independent of pattern confirmation and data certification.
 // High risk is removed from the current top-eight, but retained for transparent audit.
 const highRisk=rsi>=90||gap20>=10||gapTrigger>8||(k.longBear&&pos<.2);
 const grade=highRisk?'HIGH_RISK':score>=75&&warnings.length===0?'WATCHABLE':warnings.length?'WARNING':'NEUTRAL';
 const label={HIGH_RISK:'不宜追價（高風險）',WATCHABLE:'短線觀察適配較佳',WARNING:'追價警戒',NEUTRAL:'中性／等待確認'}[grade];
 return {score,grade,label,parts,warnings,inputs:{tradeValue:amount,volumeRatio:vr,closePosition:pos,rsi5:rsi,ma20GapPct:gap20,triggerGapPct:gapTrigger,structureRiskPct:lossDistance},assumptions:'0–100為未回測之研究排序分；不代表漲幅、勝率、隔日可成交或投資建議'};
}
function evaluate(report,o={}){const mode=o.mode==='B'?'B':'A',code=String(o.code||report.stock||report.code||''),identity={model:C.model,mode,code,name:String(o.name||report.nameZhTW||report.name||code),market:report.market,date:date(o.asOf||report.closeDate)},qualification=o.qualification||classify(code,o.quote||{},o.sector||{},o.meta||{}),base={...identity,qualification,eligible:false,confirmed:false,performanceValidated:false};if(qualification.excluded)return {...base,status:'EXCLUDED',label:qualification.reason,reasons:qualification.reasons,score:null};
 if(String(report.stock||report.code)!==code)return {...base,status:'DATA',label:LABEL.DATA,reasons:['個股代號不一致'],score:null};const v=validate(report,o);if(!v.ok)return {...base,status:'DATA',label:LABEL.DATA,reasons:[v.reason],score:null};const b=v.bars,liquidity=P.liquidity({dailySeries:b,volumeUnit:'shares'});if(!liquidity.ok)return {...base,status:liquidity.known?'EXCLUDED':'DATA',label:liquidity.reason,reasons:[liquidity.reason],score:null};
 const events=[];for(let i=Math.max(C.minBars-1,b.length-C.eventLookback);i<b.length;i++)for(const seed of seeds(b,i,mode))events.push(follow(b,seed));
 const active=events.filter(e=>e.confirmedNow).sort((a,z)=>z.signalDate.localeCompare(a.signalDate)),event=active[0]||events.at(-1)||null,x=b.at(-1),s=structure(b.slice(0,-1),x),r=risk(b,event,s,mode),state=event?.state||'NONE';
 const warnings=[...(qualification.ordinaryVerified!==true?['普通股商品資格尚未獨立核驗，僅供研究觀察']:[]),...(report.sharedCacheMetadataIncomplete?['跨濾網快取未保留完整公司行動狀態，僅列研究觀察']:[]),...(!v.basisVerified?['價格還原基準未驗證，僅列研究觀察']:[]),...(!v.calendarVerified?['完整交易日曆未驗證，僅列研究觀察']:[])],certified=qualification.ordinaryVerified===true&&v.basisVerified&&v.calendarVerified&&!report.sharedCacheMetadataIncomplete,historicalConfirmed=event?.confirmedHistorically===true,confirmed=event?.confirmedNow===true&&!r.critical,eligible=confirmed&&certified&&r.reasons.length===0;
 const result={...base,status:state,label:LABEL[state],eligible,confirmed,historicalConfirmed,tradeFitness:tradeFitness(mode,b,event,r,o.quote?.tradeValue),researchOnly:!certified||!eligible,quality:{qualificationVerified:qualification.ordinaryVerified===true,basisVerified:v.basisVerified,calendarVerified:v.calendarVerified,metadataVerified:!report.sharedCacheMetadataIncomplete,source:report.dailySeriesMeta?.source||'未提供',historyHash:hash(b),snapshotHash:o.snapshotHash||null},warnings,reasons:r.reasons,event,events,risk:r,structure:s,score:event?score(mode,b,event,s,r):null,features:{close:x.close,ma5:ma(b,5),ma10:ma(b,10),ma20:ma(b,20),ma60:ma(b,60),atr14:atr(b),volume:x.volume,avg5Volume:mean(b.slice(-6,-1).map(x=>x.volume)),volumeRatio5:volumeRatio(b,b.length-1).ratio,rsi5:E.rsi(b),candle:candle(x),tradeValue:o.quote?.tradeValue??null},monthlyStatus:E.monthly(report),conclusion:!event?'未出現本模式定義型態':event.stale?'此為歷史確認，已超過最新有效證據期限，不列當前確認榜':r.critical?'曾經完成突破，但最新日K顯示高風險；不列當前確認榜':!confirmed?(mode==='B'?'尚未完成止跌＋放量突破，不得把超賣當反轉':'尚未完成有效突破，保留觀察／失效紀錄'):!certified?'日K條件已確認，商品資格／資料基準未完整驗證，僅研究觀察':r.reasons.length?'已確認但有追價／失效風險，等待條件改善':'確認條件成立，可持續觀察；盤後訊號不等於隔日可成交'};
 result.top8Review=top8Decision(result);if(!result.top8Review.allowed){result.eligible=false;result.researchOnly=true;if(confirmed)result.conclusion=result.top8Review.kind==='DATA'?'突破已確認，但當前追價資料不足；不列前8強':'突破已確認，但當前追價門檻未通過；先等待回測或量價改善。';}return result;
}
/* Rank admission is separate from historical confirmation and data certification.
 * Research-qualified stocks retain warnings; no missing evidence is promoted.
 */
function top8Decision(c){
 const decision=(allowed,kind,reasons,inputs={})=>({allowed,kind,reasons,inputs,revision:C.revision,researchOnly:c.quality?!(c.quality.qualificationVerified&&c.quality.basisVerified&&c.quality.calendarVerified&&c.quality.metadataVerified):true});
 if(!c.confirmed)return decision(false,'UNCONFIRMED',['尚未完成當前日K確認']);
 const f=c.features||{},r=c.risk||{},fit=c.tradeFitness||{},inputs={triggerGapPct:r.gapTriggerPct,ma20GapPct:r.gap20Pct,structureRiskPct:r.structureRiskPct,rsi5:f.rsi5,volumeRatio5:f.volumeRatio5,closePosition:f.candle?.position};
 if(!Object.values(inputs).every(Number.isFinite)||!Number.isFinite(c.score?.total)||!Number.isFinite(fit.score)||!['WATCHABLE','WARNING','HIGH_RISK'].includes(fit.grade)||!Number.isFinite(f.close)||!Number.isFinite(f.tradeValue)||!(f.close>0)||!(f.tradeValue>0)||c.score.total<0||c.score.total>100||fit.score<0||fit.score>100)return decision(false,'DATA',['前8強所需結構分、量價或追價資料不足'],inputs);
 if(inputs.rsi5<0||inputs.rsi5>100||inputs.closePosition<0||inputs.closePosition>1||inputs.volumeRatio5<=0||inputs.structureRiskPct<=0)return decision(false,'DATA',['前8強量價／失效距離數值不合理'],inputs);
 const reasons=[];
 if(c.event?.stale||c.status==='STALE_CONFIRMED')reasons.push('歷史確認逾期');
 if(r.critical)reasons.push('最新日K高風險');
 if(inputs.triggerGapPct<=0)reasons.push('收盤未維持在突破確認價之上');
 if(inputs.triggerGapPct>C.maxTriggerGapPct)reasons.push('距確認點 '+fmt(inputs.triggerGapPct)+'% 超過 '+C.maxTriggerGapPct+'% 追價上限');
 if(inputs.ma20GapPct>=C.maxMA20GapPct)reasons.push('20日正乖離達 '+C.maxMA20GapPct+'% 追價上限');
 if(inputs.structureRiskPct>C.maxStructureRiskPct)reasons.push('距結構失效價超過 '+C.maxStructureRiskPct+'%');
 if(inputs.rsi5>=C.top8.maxRsi5)reasons.push('RSI5達 '+C.top8.maxRsi5+'，先等待降溫');
 if(inputs.volumeRatio5<C.top8.minVolumeRatio5)reasons.push('最新量比低於 '+C.top8.minVolumeRatio5+'，等待量能延續');
 if(inputs.closePosition<C.top8.minClosePosition)reasons.push('最新收盤位置低於 '+C.top8.minClosePosition*100+'%，弱收盤');
 if(fit.grade==='HIGH_RISK')reasons.push('短線交易適配列高風險');
 reasons.push(...(Array.isArray(r.reasons)?r.reasons:[]));
 const unique=[...new Set(reasons)];return decision(unique.length===0,unique.length?'WAIT':'PASS',unique.length?unique:['當前確認與追價門檻通過；資料認證仍須另查'],inputs);
}
// PREWATCH is a parallel, non-tradable observation layer. It NEVER grants
// confirmed / eligible status, changes scoring or widens the 3-bar confirmation window.
// Only the existing completed-day WATCH evidence can qualify: an acute-fall
// anchor by itself (FALLING), a failed/expired event or a weak new low cannot.
function bPrewatchDecision(c){
 const e=c?.event,f=c?.features||{},r=c?.risk||{};
 const decision=(allowed,reason)=>({allowed,kind:allowed?'OBSERVE':'NOT_READY',reason,researchOnly:true,
  trigger:e?.trigger??null,invalidation:e?.invalidation??null,age:e?.age??null,
  distanceToTriggerPct:Number.isFinite(f.close)&&Number.isFinite(e?.trigger)&&f.close>0?(e.trigger-f.close)/f.close*100:null});
 if(c?.mode!=='B'||c?.confirmed||c?.eligible||c?.historicalConfirmed||c?.status!=='WATCH'||e?.state!=='WATCH')return decision(false,'不是B模式當前止跌觀察階段');
 if(!Number.isInteger(e.age)||e.age<1||e.age>=C.confirmBars||e.failedDate||e.stale)return decision(false,'急跌觀察起點已失效或超過原確認期限');
 if(![f.close,e.trigger,e.invalidation,f.volumeRatio5,f.candle?.position].every(Number.isFinite))return decision(false,'價量或訊號資料不足');
 if(!(f.close>e.invalidation&&f.close<=e.trigger&&f.volumeRatio5>0))return decision(false,'失效價未守住或價格已非等待區間');
 if(f.candle?.longBear&&f.candle?.weak||r.critical)return decision(false,'最新長黑弱收或高風險，不得包裝成止跌');
 if(!Array.isArray(e.history)||!e.history.some(h=>h.state==='WATCH'))return decision(false,'沒有完成日K止跌證據');
 return decision(true,'已有初步止跌完成日K，尚未放量突破確認價；僅觀察，不可當買點');
}
function compare(a,b){
 const tier=x=>x.eligible?4:x.confirmed?3:x.historicalConfirmed?1:['PATTERN','WATCH','FALLING'].includes(x.status)?2:0;
 const admission=x=>{const g=top8Decision(x);return g.allowed?2:g.kind==='WAIT'?1:0;};
 return tier(b)-tier(a)||((a.confirmed&&b.confirmed)?admission(b)-admission(a):0)||(a.mode==='B'&&b.mode==='B'&&!a.confirmed&&!b.confirmed?((b.status==='WATCH')-(a.status==='WATCH')):0)||(b.score?.total??-1)-(a.score?.total??-1)||((a.confirmed&&b.confirmed)?((b.tradeFitness?.score??-1)-(a.tradeFitness?.score??-1)):0)||String(b.event?.lastStrengthDate||b.event?.confirmedDate||b.event?.signalDate||'').localeCompare(String(a.event?.lastStrengthDate||a.event?.confirmedDate||a.event?.signalDate||''))||Math.abs(a.risk?.gapTriggerPct??Infinity)-Math.abs(b.risk?.gapTriggerPct??Infinity)||(b.features?.tradeValue||0)-(a.features?.tradeValue||0)||a.code.localeCompare(b.code);
}
function lines(c){const f=c.features,e=c.event,q=c.qualification;return [c.name+'（'+c.code+'）｜'+(({TWSE:'上市',TPEX:'上櫃'})[c.market]||'未驗證')+'｜'+c.mode+'模式｜'+(q?.industry||'產業未驗證'),q?.cyclical?'產業屬性：景氣循環股':'',q?.cyclical?'注意原物料、運價或產業景氣循環變化，技術轉強不等於基本面復甦。':'','階段：'+c.label+'｜最新風險調整分 '+(c.score?fmt(c.score.total)+'/100':'不評分')+(c.score?'（原始條件分 '+fmt(c.score.historicalTotal)+'/100）':'')+'｜'+(c.eligible?'資料與確認通過':'研究／觀察，非正式進場資格'),c.confirmed?`前8強資格：${top8Decision(c).allowed?'通過追價門檻（資料認證另列）':'未通過，移至等待／資料不足'}｜${top8Decision(c).reasons.join('；')}`:'',c.tradeFitness?`短線交易適配（同結構分次排序）：${c.confirmed&&c.tradeFitness.score!==null?fmt(c.tradeFitness.score)+'/100':'不適用（未完成當前日K確認或資料不足）'}｜${c.confirmed?c.tradeFitness.label:'不得視為進場訊號'}｜與型態分獨立，非勝率`:'',...(c.confirmed?c.tradeFitness?.warnings||[]:[]).map(x=>'短線適配警戒：'+x),...(c.confirmed?c.tradeFitness?.parts||[]:[]).map(p=>`短線適配明細 ${p.name}：${fmt(p.value)}/${fmt(p.max)}｜${p.reason}`),f?`收盤 ${fmt(f.close)}｜MA5 ${fmt(f.ma5)}／10 ${fmt(f.ma10)}／20 ${fmt(f.ma20)}／60 ${fmt(f.ma60)}｜RSI5 ${fmt(f.rsi5)}`:'',f?`成交量 ${fmt(f.volume/1000)}張｜前5日均量 ${fmt(f.avg5Volume/1000)}張｜量比 ${fmt(f.volumeRatio5)}｜正式成交金額 ${fmt(f.tradeValue,0)}元`:'',f?`K棒：${Object.entries(f.candle).filter(([k,v])=>typeof v==='boolean'&&v).map(([k])=>({longUpper:'長上影',longLower:'長下影',doji:'十字線',longBull:'長陽',longBear:'長陰',strong:'強收盤',weak:'弱收盤'})[k]).join('／')||'一般K棒'}｜收盤位置 ${fmt(f.candle.position*100)}%`:'',e?`${c.mode==='B'?'急跌觀察起點':'訊號'} ${e.signalDate}｜確認 ${e.confirmedDate||'尚未'}｜回測 ${e.retestDate||'尚未'}｜失效 ${e.failedDate||'未發生'}｜整理 ${e.consolidationDays}根｜距最新有效轉強證據 ${e.barsSinceEvidence??'尚未確認'}根交易日K`:'',e?`${c.mode==='B'?'急跌起始K棒':'訊號棒'} 開${fmt(e.ohlcv.open)} 高${fmt(e.ohlcv.high)} 低${fmt(e.ohlcv.low)} 收${fmt(e.ohlcv.close)} 量${fmt(e.ohlcv.volume,0)}股｜基準 ${fmt(e.baselineVolume,0)}股｜比例 ${fmt(e.anchorVolumeRatio)}`:'',e?`收復當日量 ${fmt(e.confirmationVolume,0)}股｜前5日基準 ${fmt(e.confirmationBaseline,0)}股｜放量倍數 ${fmt(e.confirmationRatio)}`:'',e?`確認價 ${fmt(e.trigger)}｜結構失效價 ${fmt(e.invalidation)}｜距確認點 ${fmt(c.risk.gapTriggerPct)}%｜風險距離 ${fmt(c.risk.structureRiskPct)}%`:'',c.structure?`目前區間50%中線 ${fmt(c.structure.midpoint)}｜前低 ${fmt(c.structure.low)}／前高 ${fmt(c.structure.high)}｜錨點資料截至 ${c.structure.sourceThrough}`:'',e?`${c.mode==='B'?'急跌起點50%階段':'訊號錨點50%階段'}：${e.midpoint.labels[e.midpoint.state]}｜固定中線 ${fmt(e.midpoint.level)}｜來源截至 ${e.midpoint.sourceThrough}`:'',c.structure?`費波：${c.structure.fib.length?c.structure.fib.map(l=>fmt(l.ratio,3)+'='+fmt(l.value)+(l.touched?'（接近）':'')+(l.overlap.length?'；結構重合 '+l.overlap.join('/'):'')).join('｜'):'無訊號日前已確認波段，不補猜'}；單一比例不計確認`:'',c.risk?`最新風險判讀：${c.risk.label}｜${[...c.risk.currentWarnings,...c.risk.reasons].join('；')||'本輪無額外警訊，仍須確認成交條件'}`:'',...(c.score?.penalties||[]).map(p=>`最新風險扣分：${p.name} -${fmt(p.points)}分`),`月線資格：${({PASS:'通過',NOT_PASS:'未通過',UNCONFIRMED:'尚待確認',UNAVAILABLE:'資料不足'})[c.monthlyStatus]||'未取得'}（獨立顯示，不改原五套條件）`,...(c.score?.parts||[]).map(p=>`評分 ${({structure:'價格結構',confirmation:'確認程度',volume:'成交量',confluence:'關鍵價位共振',risk:'追價及失效風險'})[p.key]||p.key}：${fmt(p.points)}/${p.weight}｜條件 ${p.passed}/${p.total}`),...(e?.midpoint?.history||[]).map(h=>`${h.date} → 50% ${e.midpoint.labels[h.state]}：${h.condition}｜${fmt(h.level)}`),...(e?.history||[]).map(h=>`${h.date} → ${LABEL[h.state]}：${h.condition}｜確認 ${fmt(h.trigger)}／失效 ${fmt(h.invalidation)}`),...(c.warnings||[]),...(c.status==='DATA'||c.status==='EXCLUDED'?c.reasons||[]:[]),c.quality?`來源 ${c.quality.source}｜歷史 ${c.quality.historyHash}｜快照 ${c.quality.snapshotHash||'未提供'}`:'',c.conclusion||'','結構評分不等於上漲或漲停機率；僅使用完成日K，不能推斷盤中順序。'].filter(Boolean);}
return Object.freeze({C,LABEL,REASONS,num,date,fmt,ma,hash,freeze,classify,candle,structure,seeds,follow,validate,risk,score,tradeFitness,evaluate,top8Decision,bPrewatchDecision,compare,lines});});


