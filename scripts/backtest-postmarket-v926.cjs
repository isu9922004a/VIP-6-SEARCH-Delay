'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {performance} = require('node:perf_hooks');
const Engine = require('../postmarket-trend-v926.js');
const Patterns = require('../postmarket-patterns-v926.js');
const Common = require('../research-common-v1.js');
const protocol = require('./fixtures/postmarket-study-v926.cjs');

const root = path.resolve(__dirname, '..');
const output = process.argv[2];
const manifest = require('../data/research/manifest.json');
const officialCalendar = require('../data/kronos/calendar.json');
const durations = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mean = entries => entries.length ? entries.reduce((sum,n)=>sum+n,0)/entries.length : null;
const q = (ordered,p) => ordered[Math.max(0,Math.ceil(ordered.length*p)-1)] ?? null;
const countBy = (list,key) => Object.fromEntries([...new Set(list.map(key))].map(name=>[name,list.filter(row=>key(row)===name).length]));

function checkOutcome(rows, index) {
  const next = rows[index+1], firstPrice = next.open;
  return Object.fromEntries(protocol.horizons.map(period => {
    const forward = rows.slice(index+1,index+period+1);
    const highs = forward.map(row=>row.high/firstPrice-1), lows = forward.map(row=>row.low/firstPrice-1);
    return [period,{observedReturn:forward.at(-1).close/firstPrice-1,
      upperExcursion:Math.max(...highs),lowerExcursion:Math.min(...lows)}];
  }));
}

function evaluation(samples, rule, horizon, direction) {
  const observed = samples.filter(row=>rule(row)===direction);
  const sign = direction==='BULL'?1:-1;
  const values = observed.map(row=>sign*row.outcomes[horizon].observedReturn);
  const positive = values.filter(value=>value>0).length;
  const actual = samples.filter(row=>sign*row.outcomes[horizon].observedReturn>0).length;
  return {signalCount:observed.length,sampleCoverage:samples.length?observed.length/samples.length:null,
    precision:observed.length?positive/observed.length:null,recall:actual?positive/actual:null,
    meanDirectionalObservation:mean(values),
    favorableExcursion:mean(observed.map(row=>direction==='BULL'?row.outcomes[horizon].upperExcursion:-row.outcomes[horizon].lowerExcursion)),
    adverseExcursion:mean(observed.map(row=>direction==='BULL'?row.outcomes[horizon].lowerExcursion:-row.outcomes[horizon].upperExcursion))};
}

function retests(samples) {
  const active = samples.filter(row=>row.fvg);
  const breakout = samples.filter(row=>row.breakout);
  return {fvgObservations:active.length,fvgContact:active.filter(row=>row.fvg.contact).length,
    fvgFullFill:active.filter(row=>row.fvg.fill).length,fvgInvalidated:active.filter(row=>row.fvg.invalidated).length,
    target2RObserved:active.filter(row=>row.fvg.target2R).length,target3RObserved:active.filter(row=>row.fvg.target3R).length,
    defenseObserved:active.filter(row=>row.fvg.stop).length,ambiguousTouchOrder:active.filter(row=>row.fvg.bothInSession).length,
    breakoutObservations:breakout.length,failedBreakout:breakout.filter(row=>row.breakout.failed).length,
    openingDefenseObserved:samples.filter(row=>row.opening!==null).length,
    openingDefenseTriggered:samples.filter(row=>row.opening===true).length};
}

function summarize(samples) {
  return {samples:samples.length, signalStages:countBy(samples,row=>row.stage),retention:retests(samples),
    metrics:Object.fromEntries(protocol.horizons.map(horizon=>[horizon,Object.fromEntries(['BULL','BEAR'].map(direction=>[direction,{
      baseline:evaluation(samples,row=>row.baseline,horizon,direction),
      shadow:evaluation(samples,row=>row.direction,horizon,direction)
    }]))]))};
}

function study({symbol,path:filename}) {
  const bytes=fs.readFileSync(path.join(root,filename)), archive=JSON.parse(bytes);
  const rows=archive.dailySeries, index=symbol==='TAIEX';
  const calendar=index?archive.tradingCalendar:{...officialCalendar,dates:archive.tradingCalendar.dates};
  const orderedRelevant=calendar.dates.filter(date=>date>=rows[0].date && date<=archive.closeDate);
  const byDate=new Map(rows.map(row=>[row.date,row]));
  const aligned=orderedRelevant.map(date=>byDate.get(date));
  const instrument={market:index?'TAIEX':archive.market,code:symbol,
    basis:archive.priceAdjustment.basis,tickRuleVerified:archive.tickRuleVerified,securityType:archive.securityType};
  const source=archive.dailySeriesMeta.source;
  const samples=[];
  for (let i=Engine.PARAMETERS.minTrend-1;i<aligned.length-5;i++) {
    if (!aligned.slice(i-Engine.PARAMETERS.minTrend+1,i+6).every(Patterns.validBar)) continue;
    const date=aligned[i].date, forward=aligned.slice(i+1,i+6);
    // Historical archive replay has no transaction-time snapshots. The cutoff is a replay parameter.
    const snapshot={analysisDate:date,dataAsOf:date+'T23:59:59+08:00',pointInTime:false,complete:true,
      bars:rows,source,calendar,instrument};
    const start=performance.now();
    const result=Engine.analyze(snapshot);
    durations.push(performance.now()-start);
    if (result.status!=='AVAILABLE') continue;
    const baseline=aligned[i].close>Common.ma(aligned.slice(i-19,i+1),20)?'BULL':'BEAR';
    const def=result.openDefenseLevel??result.reversalWatch.nextDayOpenDefensePrice??null;
    const fvg=result.fvgAnalysis.selected, plan=result.fvgPlan, event=result.breakoutConfirmation.selected;
    const bull=fvg?.direction==='BULL';
    const fvgObservation=fvg?{
      contact:forward.some(b=>bull?b.low<=fvg.zoneHigh:b.high>=fvg.zoneLow),
      fill:forward.some(b=>bull?b.low<=fvg.zoneLow:b.high>=fvg.zoneHigh),
      invalidated:forward.some(b=>bull?b.close<fvg.zoneLow:b.close>fvg.zoneHigh),
      target2R:Number.isFinite(plan.target2R)&&forward.some(b=>bull?b.high>=plan.target2R:b.low<=plan.target2R),
      target3R:Number.isFinite(plan.target3R)&&forward.some(b=>bull?b.high>=plan.target3R:b.low<=plan.target3R),
      stop:Number.isFinite(plan.stopRef)&&forward.some(b=>bull?b.low<=plan.stopRef:b.high>=plan.stopRef),
      bothInSession:Number.isFinite(plan.stopRef)&&Number.isFinite(plan.target2R)&&
        forward.some(b=>bull?b.low<=plan.stopRef&&b.high>=plan.target2R:b.high>=plan.stopRef&&b.low<=plan.target2R)
    }:null;
    const breakout=event?.eventDate===date?{failed:forward.some(b=>event.direction==='BULL'?
      b.close<event.level-event.buffer:b.close>event.level+event.buffer)}:null;
    samples.push({date,index:i,stage:result.trendLifecycle.status,direction:result.trendLifecycle.direction,baseline,
      opening:def===null?null:forward[0].open<def,fvg:fvgObservation,breakout,outcomes:checkOutcome(aligned,i)});
  }
  const split=Math.floor(aligned.length*protocol.trainFraction);
  const holdout=samples.filter(row=>row.index>=split+protocol.purgeSessions);
  const width=Math.ceil((aligned.length-split)/protocol.holdoutBlocks);
  const walkForward=Array.from({length:protocol.holdoutBlocks},(_,i)=>{
    const start=split+i*width,end=Math.min(aligned.length,start+width);
    return {startDate:orderedRelevant[start],endDate:orderedRelevant[end-1],historyAvailableUntil:orderedRelevant[start-1],
      test:summarize(samples.filter(row=>row.index>=start+protocol.purgeSessions && row.index<end-protocol.purgeSessions))};
  });
  const current=Engine.analyze({analysisDate:archive.closeDate,dataAsOf:archive.sourceReceipt?.retrievedAt||
    manifest.generatedAt, bars:rows,calendar,instrument,source,complete:archive.completed===true});
  return {symbol,market:instrument.market,archive:filename,sha256:hash(bytes),source,
    period:[orderedRelevant[0],orderedRelevant.at(-1)],historicalSessions:aligned.length,validSessions:aligned.filter(Patterns.validBar).length,
    completedOutcomeSampleCount:samples.length, sandboxStockSimulation:null,
    training:summarize(samples.filter(row=>row.index<split-protocol.purgeSessions)),
    holdout:summarize(holdout),walkForward,current,
    currentBar:rows.at(-1),selectedCases:samples.filter(x=>x.opening!==null||x.breakout||x.fvg).slice(-8)};
}

const studies=protocol.instruments.map(study);
durations.sort((a,b)=>a-b);
const cpu={p50Ms:q(durations,.5),p95Ms:q(durations,.95),samples:durations.length,method:'Node performance.now(), pure analysis wall time, I/O excluded'};
const report={status:'EXPLORATORY_NOT_VALIDATED',protocol,protocolSha256:hash(fs.readFileSync(require.resolve('./fixtures/postmarket-study-v926.cjs'))),
  pointInTimeVerified:false,productionScoreEnabled:false,studies,
  performance:{cpu,externalRequests:0,residentMiB:process.memoryUsage.rss()/1024**2,environment:{node:process.version,platform:process.platform}},
  limitations:[
    '檔案為倉庫已保存的官方行情，缺多年當時可見版本與歷史全市場成員，無法排除更正和存活者偏差。',
    '個股缺可逐日核對的公司行動、合法參考價、停牌分類及成交與放空限制。無法驗證正式策略影子排序效益。',
    '未建立可成交模型。指數觀察、FVG 價格接觸與樣本方向報酬不作投資績效。',
    '保留資料缺失附近的隔離。未調整模型或門檻以適應樣本外結果。'
  ]};
if (output) fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,performance:report.performance,
  studies:studies.map(s=>({symbol:s.symbol,period:s.period,samples:s.completedOutcomeSampleCount,holdout:s.holdout.samples}))}));
