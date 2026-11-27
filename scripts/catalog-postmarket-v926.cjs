'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const get=file=>require(path.join(root,file));
const Trend=get('postmarket-trend-v926.js'),Patterns=get('postmarket-patterns-v926.js'),Report=get('postmarket-report-v926.js');
const Four=get('four-models-research-v1.js'),Stock=get('kline-life-03-core-v1.js'),Market=get('market-life-report-v96.js');
const days=['2026-11-24','2026-11-25','2026-11-26'];
const cases={}, totals={}, examined={stock:0,index:0};
const categories=({r})=>[
  ['趨勢',r.trendLifecycle?.status], ['鈍化',r.momentumStall?.status], ['突破',r.breakoutConfirmation?.status],
  ['長紅十字',r.reversalWatch?.status], ['大盤防禦',r.marketRegime?.status],
  ...((r.fvgAnalysis?.events||[]).map(e=>['FVG',e.direction+' '+e.status+' '+e.retestState,e])),
  ...((r.breakoutConfirmation?.events||[]).map(e=>['突破事件',e.direction+' '+e.status,e])),
  ...(r.marketRegime?.selloff?[['大盤', '重挫']]:[]),
  ...(r.openDefenseLevel?[['大盤', '開盤防線']]:[]),
  ['開盤防線結果',r.openingConfirmation?.status]
];
function audit(file,source,asOf,index,life,options={}) {
  const context=Report.archiveInput(source,{dataAsOf:asOf,index});
  const event=life?.event;
  const levels=Number.isFinite(event?.lifeLinePrice)&&!event.referenceOnly&&event.k0Date<=context.analysisDate ? {
    lifeLine:{date:context.analysisDate,code:context.instrument.code,market:context.instrument.market,verified:true,
      source:'原 0～3 號 K 生命線',publishedAt:new Date(Math.min(Date.parse(context.dataAsOf),Date.parse(context.analysisDate+'T23:59:59.999+08:00'))).toISOString(),price:event.lifeLinePrice}
  }:{};
  const r=Trend.analyze(context,{levels,...options});
  const lane=index?'index':'stock'; examined[lane]++;
  const projection=Report.view(context,r);
  for(const [kind,status,evidence] of categories({r})) {
    if(!status)continue;
    const signature=[lane,kind,status].join('/'); totals[signature]=(totals[signature]||0)+1;
    if(cases[signature])continue;
    const archive=fs.readFileSync(path.join(root,file)), bars=context.bars.slice(-45);
    cases[signature]={code:context.instrument.code,market:context.instrument.market,date:context.analysisDate,dataAsOf:context.dataAsOf,
      rawArchive:file,sha256:crypto.createHash('sha256').update(archive).digest('hex'),dataSource:context.source,bars,
      conditions:{stage:r.trendLifecycle,stall:r.momentumStall,breakout:r.breakoutConfirmation?.selected,fvg:r.fvgAnalysis?.selected,
        defense:r.reversalWatch,openingConfirmation:r.openingConfirmation,regime:r.marketRegime,lifeLine:levels.lifeLine,
        cover:r.dataCoverage},event:evidence??null,observed:status,expected:'尚待獨立逐案核對',status:'NOT_VERIFIED',screenText:projection.lines};
  }
  return r;
}
for(const day of days) {
  const manifest=get('data/research/manifest.json');
  const dirname=`data/research/${day}`;
  for(const name of fs.readdirSync(path.join(root,dirname)).sort()){
    if(!/^\d+\.json$/.test(name))continue;
    const file=dirname+'/'+name, source=JSON.parse(fs.readFileSync(path.join(root,file)));
    const asOf=manifest.date===day?manifest.generatedAt:day+'T23:59:59.999+08:00';
    const analysis=Four.evaluate(source,{generatedAt:asOf});
    audit(file,source,asOf,false,Stock.evaluate(analysis));
  }
}
const filename='data/index/TAIEX.json', source=get(filename);
let previousWatch;
for(const [index,b] of source.dailySeries.entries()) {
  if(index<35)continue;
  const date=b.date, asOf=date===source.closeDate?source.sourceReceipt.retrievedAt:date+'T23:59:59.999+08:00';
  const indexReport={...source,closeDate:date,close:b.close,sourceReceipt:{retrievedAt:asOf},dailySeries:source.dailySeries.slice(0,index+1)};
  const original= date===source.closeDate ? Market.evaluate(source,{now:new Date(asOf)}) : null;
  const r=audit(filename,indexReport,asOf,true,original,{previousWatch});
  previousWatch=r.marketRegime?.openDefense;
}
function verify(c, expected, values) {
  c.expected=expected;
  c.independentCheck=values;
  c.status='PASS';
}
for(const c of Object.values(cases)) {
  if(c.market!=='TAIEX') continue;
  const latest=c.bars.at(-1), prior=c.bars.at(-2);
  if(c.observed==='重挫') {
    const change=(latest.close-prior.close)/prior.close;
    assert.ok(change<=-.01);
    verify(c,'收盤較前一交易日至少下跌 1%',{change,previousClose:prior.close,close:latest.close});
  } else if(['OPEN_DEFENSE_HELD','TRIGGERED_WEAK'].includes(c.observed)) {
    const saw=c.conditions.openingConfirmation;
    assert.equal(saw.signalDate,prior.date);
    assert.equal(saw.confirmationDate,latest.date);
    assert.equal(saw.defensePrice,prior.close);
    assert.equal(saw.open,latest.open);
    const isWeak=latest.open<prior.close;
    assert.equal(c.observed,isWeak?'TRIGGERED_WEAK':'OPEN_DEFENSE_HELD');
    verify(c,isWeak?'下一正式交易日開盤低於原收盤':'下一正式交易日開盤等於或高於原收盤',
      {signalDate:prior.date,defensePrice:prior.close,nextSession:latest.date,open:latest.open});
  } else if(c.event?.formedDate&&c.observed.endsWith('FULL_FILL FILLED')) {
    const e=c.event, i=c.bars.findIndex(bar=>bar.date===e.formedDate), [first,middle,formed]=c.bars.slice(i-2,i+1);
    const bull=e.direction==='BULL';
    assert.ok(bull?formed.low>first.high&&middle.close>middle.open:formed.high<first.low&&middle.close<middle.open);
    const low=bull?first.high:formed.high, high=bull?formed.low:first.low;
    assert.equal(e.zoneLow,low);
    assert.equal(e.zoneHigh,high);
    const firstFill=c.bars.slice(i+1).find(bar=>bull?bar.low<=low:bar.high>=high);
    assert.equal(e.fullyFilledDate,firstFill.date);
    assert.equal(e.active,false);
    verify(c,'區間已完全回補並停止作為有效方案',{start:e.formedDate,low,high,filled:firstFill.date,
      touchedPrice:bull?firstFill.low:firstFill.high});
  }
}
const out={status:'EXPLORATORY_CASE_CATALOG',engineVersion:Patterns.PARAMETERS.version,stockArchiveDates:days,examined,totals,cases,
  boundaries:['個股封存未提供可核實的公司行動和官方參考價。','較早個股與加權資料的 dataAsOf 是回放截點；歷史當時版與發布時間待核對。','每組列一個代表案例。重複被觀察到的同一事件包含在次數中。PASS 只標示相應價格與時序已獨立核算。']};
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({examined,caseCategories:Object.keys(cases).length,totals}));
