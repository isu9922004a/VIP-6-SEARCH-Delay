/* One projection for the research webpage, PNG canvas, and its share file. */
(function(root,factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(root,node ? require('./postmarket-patterns-v926.js') : root.ShitouPostmarketPatterns926);
  if (node) module.exports = api;
  else root.ShitouPostmarketReport926 = api;
})(globalThis,function(root,Patterns) {
'use strict';

const WIDTH = 1284, HEIGHT = 2778;
const VALUE = new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2});
const unitPrice = (x,unit) => Number.isFinite(x) ? VALUE.format(x) + unit : '尚無明確位置';
const DIRECTION = {BULL:'偏多',BEAR:'偏空',NEUTRAL:'盤整',MIXED:'訊號衝突',UNKNOWN:'待確認'};
const CONTINUATION = {SUFFICIENT:'充足',ORDINARY:'普通',INSUFFICIENT:'不足',WAITING_CONFIRMATION:'等待確認',DATA_INSUFFICIENT:'資料不足'};
const FVG = {CONFIRMED_FVG:'形成時已突破關卡',WEAK_OR_UNCONFIRMED:'突破力道待確認',
  AWAITING_RETEST:'待回測',IN_RETEST_ZONE:'收盤在區間內',RETEST_TOUCHED:'已碰到區間',RETEST_HELD:'回測暫時守住',RETEST_CONFIRMED:'回測後續強確認'};

function archiveInput(source,{dataAsOf,index=false} = {}) {
  const evidence = source?.officialArchiveEvidence;
  const certified = source?.completed===true && source?.dailySeriesMeta?.onlyCompletedBars===true &&
    source?.priceAdjustment?.verified===true && source?.dailySeries?.at(-1)?.date===source?.closeDate &&
    source?.dailySeries?.at(-1)?.close===source?.close;
  const identity = index ? source?.symbol==='TAIEX' && source?.market==='TWSE_INDEX' &&
    source?.priceAdjustment?.basis==='OFFICIAL_INDEX_LEVEL' :
    evidence?.schema==='OFFICIAL_RESEARCH_ARCHIVE_V1' && evidence.stock===source?.stock &&
    evidence.date===source?.closeDate && evidence.market===source?.market && !!evidence.historyFingerprint;
  const instrument = {code:index?'TAIEX':source?.stock,name:source?.name,market:index?'TAIEX':source?.market,
    securityType:source?.securityType,tickRuleVerified:source?.tickRuleVerified,basis:source?.priceAdjustment?.basis};
  return {
    analysisDate:source?.closeDate,dataAsOf:source?.sourceReceipt?.retrievedAt || dataAsOf || null,
    source:source?.dailySeriesMeta?.source,calendar:source?.tradingCalendar,pointInTime:false,
    instrument,complete:certified&&identity,bars:source?.dailySeries
  };
}

function view(snapshot,result,{riskLabel,originalQuality,syntheticCrossRead} = {}) {
  const ctx=Patterns.createContext(snapshot);
  const {instrument={}}=snapshot;
  const index=['TAIEX','TPEX_INDEX'].includes(instrument.market),unit=index?' 點':' 元';
  const title=index?instrument.name||'臺灣加權股價指數':
    `${instrument.name||'個股'}（${instrument.code||'代號待核對'}）`;
  const values=result.nextSessionScenario?.levels||{};
  const current=result.status==='AVAILABLE', stage=result.trendLifecycle;
  const quote=current?`收盤 ${unitPrice(result.facts.close,unit)}，${result.facts.change===null?'漲跌待核對':
    `${result.facts.change>=0?'+':''}${(result.facts.change*100).toFixed(2)}%`}`:'完成日 K 或來源資料不足';
  const factLine=current?`已驗證日 K ${result.dataCoverage.valid}/${result.dataCoverage.expected} 根，最近連續 ${result.dataCoverage.contiguous} 根`
    : (result.missingFields||[]).join('、');
  const selected=result.fvgAnalysis?.selected, plan=result.fvgPlan;
  const fvgText=selected?`${selected.direction==='BULL'?'多方':'空方'} ${selected.formedDate}｜${unitPrice(selected.zoneLow,unit)} 至 ${unitPrice(selected.zoneHigh,unit)}｜${FVG[selected.fvgBreakoutQuality]}｜${FVG[selected.retestState]||'待確認'}`
    :result.fvgAnalysis?.status==='NO_ACTIVE_FVG'?'目前無有效未完全回補區':'形成區間或公司行動證據不足';
  const market = result.marketBreadth?.markets;
  const health = ['TWSE','TPEX'].map(key => {
    const breadth=market?.[key], label=key==='TWSE'?'上市':'上櫃';
    if (!breadth?.proportions) return label+'廣度資料不足';
    const {counts,proportions,coverage}=breadth;
    const ratio = value => VALUE.format(value*100)+'%';
    const ma = breadth.above20Ratio===null ? '20 日均線資料不足' :
      `站上 20MA ${ratio(breadth.above20Ratio)}，創高 ${counts.newHigh} 家，創低 ${counts.newLow} 家`;
    return `${label} ${counts.up} 漲 ${ratio(proportions.up)}、${counts.down} 跌 ${ratio(proportions.down)}、${counts.flat} 平 ${ratio(proportions.flat)}｜${coverage.quote}/${coverage.eligible} 家已核對｜${ma}`+
      (breadth.divergence?'。指數上漲，許多股票卻沒有一起漲。':'');

  });
  const strength=result.relativeStrength;
  const relative=strength?.labels?`${strength.labels}｜5 日差 ${VALUE.format(strength.five.spread*100)} 個百分點｜20 日差 ${VALUE.format(strength.twenty.spread*100)} 個百分點`:'相對大盤資料不足';
  const lines = [
    {label:'已確認行情',text:quote+'｜'+factLine},
    {label:'盤後研究',text:stage?`${DIRECTION[stage.direction]}｜${stage.label}${index?'':'｜續強條件 '+CONTINUATION[result.continuation]}`:'資料不足'},
    {label:index?'原四級風險':'原突破品質',text:index?(riskLabel||'請見原生命線報告'):
      Number.isFinite(originalQuality)?`${originalQuality} / 10`:'請見原個股報告'},
    {label:'力道觀察',text:result.beginnerExplanation?.momentum||result.beginnerExplanation?.breakout||'等收盤與重要關卡提供更多證據'},
    {label:index?'市場廣度':'相對大盤',text:index?health.join('｜'):relative},
    {label:'關鍵價位',text:[['續強關卡',values.continuation],['今日收盤',values.close??result.facts?.close],
      ['原生命線',values.lifeLine],['結構支撐',values.support],['結構壓力',values.resistance]]
      .map(([name,price])=>name+' '+unitPrice(price,unit)).join('｜')},
    {label:'開盤觀察',text:result.nextSessionScenario?.opening||result.beginnerExplanation?.pattern||'目前無已確認開盤防線'},
    {label:'三根 K 棒形成的價格失衡區（FVG）',text:fvgText},
    ...(plan?.status==='RESEARCH_ONLY'?[{label:'FVG 假設價格試算',text:[['參考',plan.entryRef],['防守',plan.stopRef],
      ['2R',plan.target2R],['3R',plan.target3R]].map(([label,price])=>label+' '+unitPrice(price,unit)).join('｜')+
      '。依假設承受 1 份風險試算價格空間。'}]:[]),
    {label:`下一交易日收盤情境 ${result.nextSessionScenario?.nextSessionDate||''}`,text:result.beginnerExplanation?.next.join('\n')||'尚無明確位置'},
    ...(!index&&syntheticCrossRead?[{label:'神奇 K 線交叉核對',text:syntheticCrossRead}]:[]),
    {label:'資料來源',text:(result.source||'來源未確認')+'｜'+(result.warnings?.length?'歷史資料版本待核對':'行情完整性如上')}
  ];
  const bars=current&&ctx.status==='AVAILABLE'?ctx.bars.slice(-45):[];
  const event=result.breakoutConfirmation?.selected;
  const markers=[
    event&&{date:event.eventDate,price:event.level,label:event.direction==='BULL'?'向上突破':'向下跌破'},
    event?.failureDate&&{date:event.failureDate,price:event.level,label:'回到原區間'},
    event?.retestDate&&!event.failureDate&&{date:event.retestDate,price:event.level,label:'回測'},
    result.reversalWatch?.signalDate&&{date:result.reversalWatch.signalDate,price:result.reversalWatch.nextDayOpenDefensePrice,label:'高檔十字'},
    result.marketRegime?.openDefense?.signalDate&&{date:result.analysisDate,price:result.openDefenseLevel,label:'開盤防線'}
  ].filter(Boolean).filter(marker=>bars.some(bar=>bar.date===marker.date)&&Number.isFinite(marker.price)).slice(-3);
  return {title,unit,lines,bars,markers,zone:selected||null,lifeLine:values.lifeLine??null,asOf:result.dataAsOf,
    date:result.analysisDate,engineVersion:result.engineVersion,code:instrument.code,source:result.source,mode:result.mode};
}

function wrap(ctx, text, width) {
  const result=[];
  for (const block of text.split('\n')) {
    let buffer='';
    for(const character of block) {
      if (buffer && ctx.measureText(buffer+character).width>width) {result.push(buffer);buffer='';}
      buffer+=character;
    }
    result.push(buffer);
  }
  return result;
}

function chart(ctx, report) {
  const {bars,markers,zone,lifeLine}=report, top=359,left=105,width=1075,height=553;
  if (!bars.length) return [];
  const extrema=bars.flatMap(bar=>[bar.high,bar.low]);
  if(Number.isFinite(lifeLine)) extrema.push(lifeLine);
  if(zone) extrema.push(zone.zoneLow,zone.zoneHigh);
  for(const mark of markers) extrema.push(mark.price);
  const min=Math.min(...extrema),max=Math.max(...extrema);
  const pad=Math.max((max-min)*.07,max*.001);
  const y=price=>top+height*(max+pad-price)/(max-min+2*pad);
  const dx=width/bars.length,x=i=>left+(i+.5)*dx;
  ctx.fillStyle='#102c45';ctx.fillRect(left,top,width,height);
  const line=(color,x0,y0,x1,y1)=>{
    ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
  };
  if(zone) {
    const formed = bars.findIndex(bar=>bar.date===zone.formedDate);
    const start = formed<0 ? left : x(formed)-dx/2;
    ctx.fillStyle='#654e29';
    ctx.fillRect(start,y(zone.zoneHigh),left+width-start,y(zone.zoneLow)-y(zone.zoneHigh));
  }
  if(Number.isFinite(lifeLine)) {ctx.setLineDash([11,7]);line('#ffc463',left,y(lifeLine),left+width,y(lifeLine));ctx.setLineDash([]);}
  const volumeMax=Math.max(...bars.map(bar=>bar.volume));
  for(const [i,b] of bars.entries()) {
    const tone=b.close>=b.open?'#f27578':'#4bd9a8';
    ctx.lineWidth=3;line(tone,x(i),y(b.high),x(i),y(b.low));
    ctx.fillStyle=tone;
    ctx.fillRect(x(i)-dx*.28,y(Math.max(b.open,b.close)),dx*.56,Math.max(2,Math.abs(y(b.open)-y(b.close))));
    ctx.fillRect(x(i)-dx*.28,1000-60*b.volume/volumeMax,dx*.56,60*b.volume/volumeMax);
    if(i>=20) {
      const average=j=>bars.slice(j-19,j+1).reduce((sum,z)=>sum+z.close,0)/20;
      line('#8ac2ff',x(i-1),y(average(i-1)),x(i),y(average(i)));
    }
  }
  ctx.font='27px sans-serif';ctx.fillStyle='#d7e8f4';
  ctx.fillText(bars[0].date,left,1041);
  ctx.fillText(bars.at(-1).date,left+width-156,1041);
  return markers.map((mark,i)=>{
    const idx=bars.findIndex(b=>b.date===mark.date);
    const point={...mark,barIndex:idx,x:x(idx),y:y(mark.price)};
    ctx.fillStyle='#ffe9ac';ctx.beginPath();ctx.arc(point.x,point.y,8,0,2*Math.PI);ctx.fill();
    ctx.fillText(String(i+1),Math.max(left,point.x-16),Math.max(top+24,point.y-12));
    return point;
  });
}

function page(report,{document:doc=root.document,watermark=false}={}) {
  const canvas=doc.createElement('canvas');
  canvas.width=WIDTH;canvas.height=HEIGHT;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#091e31';ctx.fillRect(0,0,WIDTH,HEIGHT);
  const text=(value,x,y,size,color)=>{
    ctx.font=`600 ${size}px "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif`;
    ctx.fillStyle=color;ctx.fillText(value,x,y);
  };
  text('石頭少爺｜V9.26 盤後趨勢研究',60,93,49,'#f2f6ff');
  text(report.title,60,172,54,'#ffffff');
  text(`行情 ${report.date||'待確認'}｜更新 ${report.asOf||'待核對'}`,60,233,32,'#c9dbea');
  text('研究試行｜已完成日 K、原生命線與 20 日均線',60,316,32,'#a9dcff');
  const points=chart(ctx,report);
  let y=report.bars.length?1100:400;
  if(points.length) {
    const legend=points.map((point,i)=>`${i+1} ${point.date.slice(5)} ${point.label} ${unitPrice(point.price,report.unit)}`);
    for(const line of legend) {text(line,60,y,30,'#ffeab6');y+=39;}
    y+=13;
  }
  for(const {label,value,text:body} of report.lines) {
    text(label,60,y,34,'#a6d6ff');y+=43;
    ctx.font='600 31px "Noto Sans CJK TC", sans-serif';
    for(const line of wrap(ctx,body||value||'待確認',WIDTH-120)) {text(line,60,y,31,'#eef6fc');y+=40;}
    y+=16;
  }
  if(y>HEIGHT-102) throw Error('盤後研究圖片內容超出頁面安全區');
  text('技術分析供研究參考。條件與試算有不確定性，投資風險自負。',60,HEIGHT-62,30,'#bcd1e5');
  if(watermark) root.ShitouReportWatermark.apply(canvas,report.code==='TAIEX'?'market':'stock');
  canvas.dataset.postmarket926Audit=JSON.stringify({date:report.date,asOf:report.asOf,code:report.code,
    source:report.source,version:report.engineVersion,points,lines:report.lines,barCount:report.bars.length,
    noClipping:true,width:WIDTH,height:HEIGHT,watermark});
  canvas.dataset.fullBleed='true';
  canvas.dataset.shareAsSingleImage='true';
  canvas.title='盤後趨勢研究';
  canvas.filename=`石頭少爺_V9.26_${report.code}_${report.date?.replaceAll('-','')||'待核對'}_盤後趨勢研究${watermark?'_浮水印':''}.png`;
  return canvas;
}

return {archiveInput,view,page};
});
