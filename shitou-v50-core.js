'use strict';

/* V50 共用盤後分析結果：只使用完成日K。新增內容皆為解釋或研究影子，不改正式 Gate、分數、排序與停損。 */
(function(root,factory){
  let wave=root?.ShitouWaveCoreV48||null,book=root?.ShitoBookEvidenceR495||null,course=root?.ShitouXiaoMingDaoV52||null,version=root?.ShitouReleaseV50||null;
  if(typeof module==='object'&&module.exports){
    try{wave=require('./shitou-wave-core-v48.js');}catch(_){}
    try{book=require('./book-evidence-r495.js');}catch(_){}
    try{course=require('./xiaomingdao-course-v52.js');}catch(_){}
    try{version=require('./version-v50.js');}catch(_){}
  }
  const api=factory(wave,book,course,version);
  if(root)root.ShitouV50Core=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(W,B,X,V){
  const MODEL='SHITOU_V50_POST_CLOSE_ANALYSIS_V1';
  const DATA_TIMING='POST_CLOSE_ONLY';
  const RESEARCH_ROLE='SHADOW_ONLY';
  const RELEASE=V?.release||'石頭少爺 Agent V50 正式版';
  const FIB_RATIOS=Object.freeze([0,.236,.382,.5,.618,.786,1]);
  const cache=new WeakMap();
  const number=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(typeof value==='string'?value.replace(/,/g,''):value);return Number.isFinite(n)?n:null;};
  const round=(value,digits=6)=>{const n=number(value);return n===null?null:Number(n.toFixed(digits));};
  const average=values=>{const clean=values.map(number).filter(value=>value!==null);return clean.length?clean.reduce((sum,value)=>sum+value,0)/clean.length:null;};
  const unique=items=>[...new Set((items||[]).filter(Boolean))];
  const isoDate=value=>{const match=String(value??'').trim().match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);if(!match)return null;const text=`${match[1]}-${match[2]}-${match[3]}`,date=new Date(`${text}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===text?text:null;};
  const deepFreeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);return value;};

  function normalizeBars(source){return W.normalizeBars(source);}

  function confirmedPivots(source,left=3,right=3){
    const bars=normalizeBars(source),pivots=[];
    for(let index=left;index<bars.length-right;index++){
      let high=true,low=true;
      for(let cursor=index-left;cursor<=index+right;cursor++){
        if(cursor===index)continue;
        if(bars[cursor].high>=bars[index].high)high=false;
        if(bars[cursor].low<=bars[index].low)low=false;
      }
      if(high)pivots.push({type:'HIGH',index,date:bars[index].date,price:bars[index].high,confirmedAt:bars[index+right].date});
      if(low)pivots.push({type:'LOW',index,date:bars[index].date,price:bars[index].low,confirmedAt:bars[index+right].date});
    }
    pivots.sort((a,b)=>a.index-b.index||(a.type==='LOW'?-1:1));
    const alternating=[];
    for(const pivot of pivots){
      const previous=alternating.at(-1);
      if(previous?.type===pivot.type){
        const stronger=pivot.type==='HIGH'?pivot.price>previous.price:pivot.price<previous.price;
        if(stronger)alternating[alternating.length-1]=pivot;
      }else alternating.push(pivot);
    }
    return alternating;
  }

  function trendStructure(source){
    const pivots=confirmedPivots(source),highs=pivots.filter(p=>p.type==='HIGH').slice(-2),lows=pivots.filter(p=>p.type==='LOW').slice(-2);
    if(highs.length<2||lows.length<2)return {key:'INSUFFICIENT',label:'已確認轉折不足',plain:'目前尚無足夠已確認波段高低點，不硬判多空趨勢。',pivots,highs,lows};
    const higherHigh=highs[1].price>highs[0].price,higherLow=lows[1].price>lows[0].price,lowerHigh=highs[1].price<highs[0].price,lowerLow=lows[1].price<lows[0].price;
    if(higherHigh&&higherLow)return {key:'BULL',label:'多頭結構',plain:'已確認高點抬高、低點也抬高，也就是頭頭高、底底高。',pivots,highs,lows,higherHigh,higherLow,lowerHigh,lowerLow};
    if(lowerHigh&&lowerLow)return {key:'BEAR',label:'空頭結構',plain:'已確認高點降低、低點也降低，也就是頭頭低、底底低。',pivots,highs,lows,higherHigh,higherLow,lowerHigh,lowerLow};
    return {key:'SIDEWAYS',label:'盤整／方向尚未確認',plain:'高低點沒有同步抬高或同步降低，先視為盤整，等待區間或結構確認。',pivots,highs,lows,higherHigh,higherLow,lowerHigh,lowerLow};
  }

  function selectFibAnchor(source){
    const pivots=confirmedPivots(source);
    for(let index=pivots.length-1;index>=1;index--){
      const start=pivots[index-1],end=pivots[index];
      if(start.type==='LOW'&&end.type==='HIGH'&&end.price>start.price)return {direction:'UP',start,end,reason:'最近一組已由右側K棒確認的低點→高點完整波段'};
      if(start.type==='HIGH'&&end.type==='LOW'&&start.price>end.price)return {direction:'DOWN',start,end,reason:'最近一組已由右側K棒確認的高點→低點完整波段'};
    }
    return null;
  }

  function fibZone(depth){
    if(!Number.isFinite(depth))return {key:'DATA',label:'資料不足'};
    const percent=depth*100;
    if(percent<0)return {key:'EXTENSION',label:'已越過原波段終點'};
    if(percent<=23.6)return {key:'VERY_SHALLOW',label:'回吐／回補很淺'};
    if(percent<=38.2)return {key:'SHALLOW',label:'淺度回檔／反彈'};
    if(percent<=50)return {key:'NORMAL',label:'正常整理'};
    if(percent<=61.8)return {key:'MID_DEEP',label:'回檔／反彈開始偏深'};
    if(percent<=78.6)return {key:'DEEP',label:'深度回檔／反彈'};
    if(percent<=100)return {key:'MOSTLY_RETRACED',label:'原波段大部分已回吐／回補'};
    return {key:'BROKEN',label:'原波段已完全回吐／回補，失效風險提高'};
  }

  function calculateFibFromAnchor(anchor,currentClose,scale='LINEAR'){
    const current=number(currentClose),start=number(anchor?.start?.price??anchor?.startPrice),end=number(anchor?.end?.price??anchor?.endPrice),direction=anchor?.direction;
    if(!(current>0&&start>0&&end>0)||!['UP','DOWN'].includes(direction)||start===end)return {available:false,reason:'找不到可驗證的完整波段錨點'};
    const transform=scale==='LOG'?Math.log:value=>value;
    const startT=transform(start),endT=transform(end),currentT=transform(current),span=Math.abs(endT-startT);
    if(!(span>0))return {available:false,reason:'波段幅度不足'};
    const depth=direction==='UP'?(endT-currentT)/span:(currentT-endT)/span;
    const linearSpan=Math.abs(end-start),levels={};
    for(const ratio of FIB_RATIOS)levels[String(ratio)]=direction==='UP'?end-linearSpan*ratio:end+linearSpan*ratio;
    return {available:true,scale,direction,waveStart:{date:anchor?.start?.date||anchor?.startDate||null,price:start},waveEnd:{date:anchor?.end?.date||anchor?.endDate||null,price:end},waveLow:Math.min(start,end),waveHigh:Math.max(start,end),currentClose:current,retracementDepth:depth,retracementPct:depth*100,zone:fibZone(depth),levels,anchorReason:anchor?.reason||'已確認波段錨點',platformOrientationIndependent:true};
  }

  function fibAnalysis(source){
    const bars=normalizeBars(source),anchor=selectFibAnchor(bars);
    if(!anchor||!bars.length)return {available:false,reason:'目前沒有足夠已確認轉折點，波段回撤量尺不硬算。',linear:null,logResearch:null};
    const close=bars.at(-1).close,linear=calculateFibFromAnchor(anchor,close,'LINEAR'),logResearch=calculateFibFromAnchor(anchor,close,'LOG');
    return {available:linear.available,anchor,linear,logResearch:{...logResearch,role:RESEARCH_ROLE,enabled:false,note:'對數量尺只保留研究結果，正式畫面仍使用線性價格。'}};
  }

  function previousDayResearch(source,trend){
    const bars=normalizeBars(source);if(bars.length<2)return {available:false,role:RESEARCH_ROLE,reason:'至少需要兩個完成交易日'};
    const today=bars.at(-1),yesterday=bars.at(-2),base={available:true,role:RESEARCH_ROLE,todayDate:today.date,previousDate:yesterday.date,previousHigh:yesterday.high,previousLow:yesterday.low,formalStopChanged:false,formalSignalChanged:false};
    if(trend?.key==='BULL'){
      if(today.close<yesterday.low)return {...base,key:'BULL_CLOSE_BELOW_PREV_LOW',label:'收盤跌破昨日低點，短線結構轉弱候選',plain:'這是研究訊號，不取代原正式停損。'};
      if(today.low<yesterday.low)return {...base,key:'BULL_INTRADAY_BREACH_RECLAIM',label:'盤中一度跌破昨日低點，但收盤已收復',plain:'收盤沒有正式跌破，不把盤中情緒誤寫成結構失守。'};
      return {...base,key:'BULL_HELD_PREV_LOW',label:'今日收盤仍未正式跌破昨日低點',plain:'多頭短線持有結構仍待後續完成日K確認。'};
    }
    if(trend?.key==='BEAR'){
      if(today.close>yesterday.high)return {...base,key:'BEAR_CLOSE_ABOVE_PREV_HIGH',label:'收盤突破昨日高點，空頭結構轉弱候選',plain:'這是研究訊號，不直接產生買進。'};
      if(today.high>yesterday.high)return {...base,key:'BEAR_INTRADAY_BREAK_REJECTED',label:'盤中一度突破昨日高點，但收盤未站穩',plain:'收盤沒有正式突破，不把盤中情緒誤寫成空頭結構改變。'};
      return {...base,key:'BEAR_HELD_PREV_HIGH',label:'反彈收盤仍未正式突破昨日高點',plain:'空頭結構尚未由收盤資料推翻。'};
    }
    return {...base,key:'SIDEWAYS_CONTEXT',label:'盤整中，昨日高低點只作研究觀察',plain:'盤整容易反覆穿越昨日高低點，不用這一條規則直接下結論。'};
  }

  function candleEvidence(source,trend){
    const bars=normalizeBars(source);if(!bars.length)return {available:false,reason:'完成日K不足'};
    const bar=bars.at(-1),range=bar.high-bar.low;if(!(range>0))return {available:false,reason:'最新K棒高低相同，無法判讀影線比例'};
    const body=Math.abs(bar.close-bar.open),upper=bar.high-Math.max(bar.open,bar.close),lower=Math.min(bar.open,bar.close)-bar.low,closePosition=(bar.close-bar.low)/range;
    const labels=[];if(body/range<=.15)labels.push('小實體／近十字');if(upper/range>=.45)labels.push('長上影');if(lower/range>=.45)labels.push('長下影');if(bar.close>bar.open&&body/range>=.6)labels.push('長紅實體');if(bar.close<bar.open&&body/range>=.6)labels.push('長黑實體');
    const priorVolume=average(bars.slice(-6,-1).map(row=>row.volume)),volumeRatio=priorVolume>0?bar.volume/priorVolume:null;
    const recent=bars.slice(-20),rangeLow=Math.min(...recent.map(row=>row.low)),rangeHigh=Math.max(...recent.map(row=>row.high)),position=rangeHigh>rangeLow?(bar.close-rangeLow)/(rangeHigh-rangeLow):.5;
    let context='單根K棒只作情境證據，仍需後續收盤確認。';
    if(labels.includes('長上影')&&position>=.75&&volumeRatio>=1.5)context='相對高檔出現放量長上影，賣壓證據增加，但不能單憑一根K棒預言下跌。';
    else if(labels.includes('長下影')&&position<=.25&&bar.close>bar.low)context='相對低檔出現長下影承接，仍需後續收盤守住支撐才能確認。';
    return {available:true,date:bar.date,labels:labels.length?labels:['一般K棒'],bodyRatio:body/range,upperShadowRatio:upper/range,lowerShadowRatio:lower/range,closePosition,volumeRatio5:volumeRatio,rangePosition20:position,trendContext:trend?.label||'結構待確認',plain:context};
  }

  function movingAverageInertia(source){
    const bars=normalizeBars(source),items=[];
    for(const period of [5,10,20]){
      if(bars.length<period){items.push({period,available:false,label:`${period}日線資料不足`});continue;}
      const current=average(bars.slice(-period).map(row=>row.close)),outgoing=bars[bars.length-period].close;
      items.push({period,available:true,current,knownOutgoingClose:outgoing,nextCloseUnknown:true,plain:`下一個完成收盤若高於 ${outgoing.toFixed(2)}，${period}日線較容易上移；低於則較容易下移。明日收盤目前未知。`});
    }
    return {items,formalForecast:false};
  }

  function gapResearch(source){
    const bars=normalizeBars(source),gaps=[];
    for(let index=1;index<bars.length;index++){
      const previous=bars[index-1],current=bars[index];let direction=null,low=null,high=null;
      if(current.low>previous.high){direction='UP';low=previous.high;high=current.low;}
      else if(current.high<previous.low){direction='DOWN';low=current.high;high=previous.low;}
      if(!direction)continue;
      const later=bars.slice(index+1),filled=direction==='UP'?later.some(row=>row.low<=low):later.some(row=>row.high>=high);
      gaps.push({direction,date:current.date,low,high,filled,type:'缺口類型待確認',companyActionChecked:false});
    }
    return {role:RESEARCH_ROLE,formalScoreChanged:false,companyActionDataAvailable:false,gaps:gaps.slice(-6),plain:gaps.length?'缺口已列為支撐壓力候選；因缺少公司行動校正，不進正式分數。':'最近資料沒有可辨識的完整日K缺口。'};
  }

  function confluenceMap(source,fib,wave){
    const bars=normalizeBars(source);if(!bars.length)return {available:false,zones:[]};
    const close=bars.at(-1).close,pivots=confirmedPivots(bars).slice(-8),points=[];
    for(const pivot of pivots)points.push({price:pivot.price,source:pivot.type==='HIGH'?'已確認波段高點':'已確認波段低點'});
    if(fib?.linear?.available)for(const ratio of [.382,.5,.618,.786])points.push({price:fib.linear.levels[String(ratio)],source:`波段回撤量尺 ${(ratio*100).toFixed(1)}%`});
    for(const [key,label] of [['ma8','短線抱單線'],['ma21','強弱分界線'],['ma55','趨勢方向線']])if(number(wave?.[key])!==null)points.push({price:wave[key],source:label});
    const trueRanges=bars.slice(-14).map((row,index,array)=>index===0?row.high-row.low:Math.max(row.high-row.low,Math.abs(row.high-array[index-1].close),Math.abs(row.low-array[index-1].close))),atr=average(trueRanges)||close*.01,tolerance=Math.max(close*.005,atr*.35);
    points.sort((a,b)=>a.price-b.price);const clusters=[];
    for(const point of points){const last=clusters.at(-1);if(last&&Math.abs(point.price-last.center)<=tolerance){last.points.push(point);last.center=average(last.points.map(item=>item.price));}else clusters.push({center:point.price,points:[point]});}
    const zones=clusters.map(cluster=>({center:cluster.center,low:Math.min(...cluster.points.map(point=>point.price)),high:Math.max(...cluster.points.map(point=>point.price)),side:cluster.center>=close?'壓力候選':'支撐候選',evidence:unique(cluster.points.map(point=>point.source)),independentEvidenceCount:unique(cluster.points.map(point=>point.source)).length})).filter(zone=>zone.independentEvidenceCount>=2).sort((a,b)=>Math.abs(a.center-close)-Math.abs(b.center-close));
    return {available:true,tolerance,method:'ATR與0.5%取較大值作價位群聚；同源衍生價不重複計數',zones};
  }

  function dataQuality(report,bars,sourceLength){
    const finalDate=bars.at(-1)?.date||null,stockDate=isoDate(report?.closeDate||report?.dataDate),marketDate=isoDate(report?.marketDate||report?.marketDataDate),issues=[];
    if(!bars.length)issues.push('沒有可用的完成日K');
    if(sourceLength!==bars.length)issues.push('部分日K格式錯誤、重複或日期無效');
    if(bars.some(bar=>!Number.isFinite(bar.volume)||bar.volume<=0))issues.push('部分完成日K成交量為0或缺漏');
    if(stockDate&&finalDate&&stockDate!==finalDate)issues.push('股票資料最後日期與日K最後日期不一致');
    if(marketDate&&finalDate&&marketDate!==finalDate)issues.push('市場與個股資料日期不一致');
    const state=issues.some(issue=>issue.includes('不一致'))?'DATE_MISMATCH':issues.length?'PARTIAL':'READY';
    return {state,label:{READY:'資料完整',PARTIAL:'部分資料不足',STALE:'資料尚未更新',DATE_MISMATCH:'市場與個股資料日期不一致'}[state],finalDate,stockDate,marketDate,issues,stopSameDateModules:state==='DATE_MISMATCH'};
  }

  function formalSnapshot(input){
    const candidate=input&&typeof input==='object'?input:{};
    return {eligible:candidate.eligible,formalEligible:candidate.formalEligible,formalLaunchEligible:candidate.formalLaunchEligible,top3Eligible:candidate.top3Eligible,executionAllowed:candidate.executionAllowed,score:candidate.score,grade:candidate.grade,trigger:candidate.trigger,support:candidate.support,invalid:candidate.invalid};
  }

  function build(input){
    const candidate=input&&typeof input==='object'?input:{},report=candidate.report||candidate,source=report?.canonicalBars||report?.dailySeries||report?.rows||report?.history||candidate?.dailySeries||[],bars=normalizeBars(source),quality=dataQuality(report,bars,Array.isArray(source)?source.length:0),trend=trendStructure(bars),wave=bars.length>=60&&W?.analyzeBars?W.analyzeBars(bars):{ok:false,reason:'完整日K少於60根'},course=X?.analyze?X.analyze(candidate,wave):null,fib=fibAnalysis(bars),previousDay=previousDayResearch(bars,trend),candle=candleEvidence(bars,trend),opening=B?.analyze?B.analyze(report):null;
    const teacher=globalThis.ShitouTeacherThreePan.fromReport(candidate);const result={teacher,volumeAudit:report.volumeAudit||null,model:MODEL,release:RELEASE,dataTiming:DATA_TIMING,generatedAt:new Date().toISOString(),dataDate:quality.finalDate,quality,barsUsed:bars.length,latestClose:bars.at(-1)?.close??null,trend,wave,course,fib,previousDay,candle,movingAverageInertia:movingAverageInertia(bars),gaps:gapResearch(bars),confluence:confluenceMap(bars,fib,wave),openingDecision:opening,formalBefore:formalSnapshot(candidate),courseIntegration:{affectsStrongStockTieRank:true,teacherEligibility:true,affectsFormalExecutionGate:true,affectsStop:true,scoreSemantic:'CONDITION_COMPLETENESS_NOT_WIN_RATE'},research:{role:RESEARCH_ROLE,affectsFormalGate:false,affectsScore:false,affectsRanking:false,affectsStop:false,affectsObservationPrice:false},plain:{headline:trend.label,summary:trend.plain}};
    return deepFreeze(result);
  }

  function fingerprint(input){const r=input?.report||input||{};return JSON.stringify([r.canonicalBars||r.dailySeries||r.rows||r.history||[],r.close,r.closeDate,r.marketDate,r.marketDataDate,r.volumeAudit,input?.industryContext||r.industryContext,input?.relativeComparison||r.relativeComparison]);}
  function analyze(input){
    const key=input?.report&&typeof input.report==='object'?input.report:(input&&typeof input==='object'?input:null),mark=fingerprint(input);
    if(key){const saved=cache.get(key);if(saved?.fingerprint===mark)return saved.result;const result=build(input);cache.set(key,{fingerprint:mark,result});return result;}
    return build(input);
  }
  function attach(candidate){if(!candidate||typeof candidate!=='object')return candidate;candidate.v50AnalysisResult=analyze(candidate);return candidate;}
  function textBlock(input,title='V50 盤後結構與研究證據',options={}){
    const a=input?.model===MODEL?input:analyze(input),fib=a.fib?.linear,lines=[`【${title}】`,`資料日期：${a.dataDate||'資料不足'}｜${a.quality.label}`,`趨勢結構：${a.trend.label}｜${a.trend.plain}`];
    if(a.latestClose!==null)lines.push(`最新收盤：${a.latestClose.toFixed(2)}`);
    lines.push(`昨日高低點研究：${a.previousDay.label||a.previousDay.reason}`);
    lines.push(fib?.available?`波段回撤量尺：${fib.direction==='UP'?'上漲波段回吐':'下跌波段回補'} ${fib.retracementPct.toFixed(1)}%｜${fib.zone.label}｜起點 ${fib.waveStart.date||'-'} ${fib.waveStart.price.toFixed(2)} → 終點 ${fib.waveEnd.date||'-'} ${fib.waveEnd.price.toFixed(2)}。比例只描述幅度，不代表一定反轉。`:`波段回撤量尺：${a.fib.reason}`);
    if(a.candle.available)lines.push(`最新K棒：${a.candle.labels.join('、')}｜${a.candle.plain}`);
    if(!options.market&&a.course?.ok)lines.push(`量價適合度：${a.course.score}/100（條件完整度，不是勝率）｜${a.course.threePan.label}｜${a.course.label}`);
    if(options.market){
      lines.push(`大盤環境：${a.trend.label}｜以完成日K確認，不作個股操作指示。`);
    }else if(a.openingDecision?.headline){
      lines.push(`下一交易日：${a.openingDecision.headline.replace('明天開盤：','')}`);
    }
    lines.push('研究層聲明：昨日高低點、K棒、缺口與對數量尺不改正式 Gate、分數、排名、停損或觀察價。');
    return lines.join('\n');
  }

  return Object.freeze({MODEL,RELEASE,DATA_TIMING,RESEARCH_ROLE,FIB_RATIOS,number,normalizeBars,confirmedPivots,trendStructure,selectFibAnchor,fibZone,calculateFibFromAnchor,fibAnalysis,previousDayResearch,candleEvidence,movingAverageInertia,gapResearch,confluenceMap,dataQuality,analyze,attach,textBlock});
});
