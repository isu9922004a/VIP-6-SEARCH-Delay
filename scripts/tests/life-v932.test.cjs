'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../../kline-life-03-core-v1'),R=require('../../kline-life-03-report-v1'),F=require('../../four-models-research-v1');
const bear=[[21,22,19,20],[20,21,18,19],[19,20,17,18],[18,20,17.5,18.5]],bull=[[10,12,9,11],[11,13,10,12],[12,14,11,13],[12,13,10.5,12.5]];
function make(rows){const sourceBars=rows.map((r,i)=>({date:new Date(Date.UTC(2026,7,3+i)).toISOString().slice(0,10),open:r[0],high:r[1],low:r[2],close:r[3],volume:1000}));return {code:'9999',date:sourceBars.at(-1).date,sourceBars,validation:{technicalModelAvailable:true}};}
const trace=(rows)=>{const a=make(rows);return C.trace(C.detect(a.sourceBars)[0],a.sourceBars);};
test('close transitions: waiting, first breakout, held, equal failure, repeated breakout retains cycles',()=>{
 const stages=[[],[[21,24,20,23]],[[21,24,20,23],[23,25,23,24]],[[21,24,20,23],[23,25,22,22]],[[21,24,20,23],[23,25,22,22],[22,24,21,23]]];
 const expected=['RESISTANCE_WATCH','BREAKOUT_INITIAL','BREAKOUT_HELD','BREAKOUT_FAILED','BREAKOUT_INITIAL'];
 stages.forEach((rows,i)=>assert.equal(trace([...bear,...rows]).lifecycleState,expected[i]));
 const x=trace([...bear,...stages[4]]);assert.equal(x.events.filter(e=>e.kind==='BREAKOUT_CONFIRMED').length,2);assert.equal(new Set(x.events.filter(e=>e.eventId).map(e=>e.eventId)).size,3);assert.equal(x.firstBreakoutDate,'2026-08-07');
});
test('support: intraday test and equality cannot reclaim a broken support; strict close above can',()=>{
 assert.equal(trace([...bull,[10,11,8,9]]).lifecycleState,'SUPPORT_WATCH');
 assert.equal(trace([...bull,[10,11,8,8.5],[9,10,8,9]]).lifecycleState,'SUPPORT_BROKEN');
 assert.equal(trace([...bull,[10,11,8,8.5],[9,10,8,9.5]]).lifecycleState,'SUPPORT_RECLAIMED');
});
test('retest requires later return from away and tolerance, never simply two closes above',()=>{
 const rows=[...bear,[21,24,20,23],[23,25,23,24]];
 assert.equal(trace(rows).lifecycleState,'BREAKOUT_HELD');
 assert.equal(trace([...rows,[23,25,22,23]]).lifecycleState,'RETEST_HELD');
 assert.equal(trace([...rows,[23,25,21,23]]).lifecycleState,'BREAKOUT_HELD');
});
test('transition reason comes from confirmed transition, not preceding intraday note',()=>{
 const x=trace([...bull,[10,11,8,8.5],[9,10,8,9.5]]);assert.equal(x.lastTransition.transitionReason,'SUPPORT_RECLAIMED');
});
test('point in time reproduces original immutable event with no future swing confirmation',()=>{
 const a=make([...bear,[21,24,20,23],[23,25,23,24]]),past=C.evaluate(a,{asOf:a.sourceBars[3].date}),seed=C.evaluate(make(bear));
 assert.deepEqual(past.event.originalEvent,seed.event.originalEvent);assert.equal(past.event.firstBreakoutDate,null);assert.equal(past.event.lifecycleState,'RESISTANCE_WATCH');assert.equal(past.currentTrend.swingHigh,null);
});
test('verified 8099 archive regression: historical breakout, independent present trend and risks',()=>{
 const a=C.evaluate(F.evaluate(require('../../data/research/2026-11-13/8099.json')));
 assert.equal(a.line,70.9);assert.equal(a.event.k3Date,'2026-10-16');assert.equal(a.event.k0Date,'2026-10-21');assert.equal(a.event.firstBreakoutDate,'2026-10-22');assert.equal(a.close,182);assert.equal(a.event.lifecycleState,'BREAKOUT_HELD');assert.equal(a.referenceOnly,true);assert.equal(a.currentRole,'HISTORICAL_REFERENCE');assert.equal(a.currentTrend.state,'STRONG');assert.equal(a.chaseRisk.level,'ELEVATED');
 assert.equal(a.currentTrend.ma5,155.1);assert.equal(a.currentTrend.ma10,147.65);assert.equal(a.currentTrend.ma20,113.925);
 assert.doesNotMatch(a.scenario.bullish+a.scenario.bearish,/突破 70.9|70.9 元或以下/);assert.doesNotMatch(R.fields(a).summary.value,/還沒.*突破/);
});
test('every report includes complete teaching and never leaks enum codes or future claims',()=>{
 for(const rows of [bear,bull,[...bear,[21,24,20,23],[23,25,23,24]],[...bull,[9,10,8,8.5]]]){
 const a=C.evaluate(make(rows)),s=R.lines(a).join('\n');for(const term of ['K3：','K2：','K1：','K0：','回測守住','重新站回','突破失敗','歷史參考價','追價','連續 2 根'])assert.ok(s.includes(term),term);
 assert.doesNotMatch(s,/BREAKOUT_|SUPPORT_|undefined|NaN|Infinity/);if(a.event.lifecycleState==='BREAKOUT_HELD')assert.doesNotMatch(R.fields(a).summary.value,/尚未突破|還沒.*突破/);
 }
});
test('insufficient and missing sessions cannot produce confirmed state; inputs reject unresolved basis/suspension',()=>{
 const a=make(bear);a.expectedTradingDates=[a.sourceBars[0].date,'2026-08-10',a.date];a.sourceBars.splice(1,1);assert.equal(C.evaluate(a).state,'INSUFFICIENT_DATA');
 for(const input of [{code:'1'}, {...make(bear),suspended:true},{...make(bear),corporateActionUnresolved:true}])assert.equal(C.evaluate(input).state,'INSUFFICIENT_DATA');
});
module.exports={make,bear,bull};
test('independent outcome research reports unmatured samples and never claims validated performance',()=>{
 const {study}=require('../../kline-life-03-outcomes-v932');const input=make([...bear,[21,24,20,23],[23,25,23,24],[23,25,22,22]]),out=study([input],{testStart:input.sourceBars[0].date,testEnd:input.date});
 assert.equal(out.performanceValidated,false);assert.equal(out.outOfSampleValidated,false);assert.ok(out.records.length>=3);assert.equal(out.records.at(-1).outcomes[5].state,'NOT_MATURED');assert.equal(out.records[0].outcomes[1].state,'COMPLETED');assert.equal(out.records.at(-1).outcomes[5].closeReturnPct,null);
});
test('V9.3 pattern detection, immutable event IDs and raw anchors remain exactly unchanged',()=>{
 const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..'),sandbox={module:{exports:{}},require:require('module').createRequire(path.join(root,'kline-life-03-core-v1.js'))};require('vm').runInNewContext(fs.readFileSync(path.join(root,'scripts/fixtures/v93-life/core.txt'),'utf8'),sandbox);const old=sandbox.module.exports;
 for(const code of ['8099','4939','2330']){const a=F.evaluate(require('../../data/research/2026-11-13/'+code+'.json'));assert.equal(JSON.stringify(C.detect(a.sourceBars,{code})),JSON.stringify(old.detect(a.sourceBars,{code})));}
});
test('nearby opposing roles are detected across different K0 dates and disclose conflict',()=>{
 const {sourceBars}=require('../fixtures/v932-conflicting-levels.json'),a=C.evaluate({code:'9999',date:sourceBars.at(-1).date,sourceBars,validation:{technicalModelAvailable:true}});assert.equal(a.opposing,true);assert.equal(a.state,'NEUTRAL');assert.match(a.scenario.summary,/互相衝突/);assert.match(a.reason,/衝突/);
});
test('held confirmation cannot duplicate the original backtest breakout trigger',()=>{
 const initial=C.evaluate(make([...bear,[21,24,20,23]])),held=C.evaluate(make([...bear,[21,24,20,23],[23,25,23,24]])),later=trace([...bear,[21,24,20,23],[23,25,23,24],[24,26,23,25]]);
 assert.equal(initial.state,'TURNING_STRONG');assert.notEqual(held.state,'TURNING_STRONG');assert.equal(held.lifecycleState,'BREAKOUT_HELD');assert.equal(later.latestConfirmationDate,later.dataAsOf);
});
test('validated long window preserves events older than the 20-bar presentation and refuses mismatched windows',()=>{
 const full=make([...bear,...Array.from({length:50},()=>[23,25,23,24])]),input={...full,sourceBars:full.sourceBars.slice(-20),reportBars:full.sourceBars};const a=C.evaluate(input);assert.equal(a.historyBarCount,54);assert.ok(a.events.length>0);assert.equal(a.event.eventAgeBars,50);assert.equal(a.referenceOnly,true);assert.equal(a.event.lifecycleState,'BREAKOUT_HELD');
 const bad={...input,reportBars:input.reportBars.map(b=>({...b}))};bad.reportBars.at(-1).close=23.9;assert.equal(C.evaluate(bad).state,'INSUFFICIENT_DATA');assert.equal(Object.isFrozen(input.reportBars),false);
});
test('source binding carries actual adjustment and calendar, rejects another stock and translates missing evidence',()=>{
 const raw=require('../../data/research/2026-11-13/8099.json'),a=F.evaluate(raw),bound=C.withSource(a,raw),result=C.evaluate(bound);assert.equal(Object.isFrozen(bound),true);assert.equal(Object.isFrozen(bound.priceAdjustment),true);assert.equal(bound.priceAdjustment.basis,'UNADJUSTED_OFFICIAL_OHLC');assert.equal(result.priceAdjustment.basis,'UNADJUSTED_OFFICIAL_OHLC');assert.equal(C.evaluate(C.withSource(a,{...raw,stock:'2330'})).state,'INSUFFICIENT_DATA');
 const text=R.lines(result).join('\n');assert.match(text,/交易所未還原成交價格/);assert.match(text,/除權息事件尚未完整核對/);assert.doesNotMatch(text,/BULL_PULLBACK_|MOMENTUM_CONTINUATION_|FLOW_FUNDAMENTAL_|UNADJUSTED_/);
});
test('a completed K0 already beyond its line confirms immediately without waiting for another first breakout',()=>{
 const up=trace([...bear.slice(0,3),[23,24,23,24]]),down=trace([...bull.slice(0,3),[8,10,7,8]]);assert.equal(up.lifecycleState,'BREAKOUT_INITIAL');assert.equal(up.firstBreakoutDate,up.signalDate);assert.equal(down.lifecycleState,'SUPPORT_BROKEN');assert.equal(down.firstBreakdownDate,down.signalDate);
});
test('a dated official volume revision is declared without rewriting source bars or selection analysis',()=>{
 const raw=require('../../data/research/2026-11-13/2330.json'),before=JSON.stringify(raw),a=F.evaluate(raw),analysisBefore=JSON.stringify(a),s=C.evaluate(C.withSource(a,raw));assert.equal(s.sourceVolumeAudit.uncertain,true);assert.equal(s.sourceVolumeAudit.latestOfficialVolume,30973127);assert.equal(s.currentTrend.volumeRatio,null);assert.equal(s.indicators.volumeRatio,null);assert.ok(!s.confirmationEvidence.some(v=>v.startsWith('當日量為')));assert.match(R.lines(s).join('\n'),/成交量來源版本有差異/);assert.equal(JSON.stringify(raw),before);assert.equal(JSON.stringify(a),analysisBefore);assert.equal(s.affectsEligibility,false);assert.equal(s.affectsRanking,false);const past=C.evaluate(C.withSource(a,raw),{asOf:a.date});assert.equal(past.sourceVolumeAudit,null);assert.notEqual(past.currentTrend.volumeRatio,null);
});
test('independent outcomes include an immediately confirmed completed K0 crossing',()=>{
 const input=make([...bear.slice(0,3),[23,24,23,24],[24,26,23,25]]),out=require('../../kline-life-03-outcomes-v932').study([input],{testStart:input.sourceBars[0].date,testEnd:input.date});assert.ok(out.records.some(r=>r.date===input.sourceBars[3].date&&r.trigger==='BREAKOUT_CONFIRMED'&&r.outcomes[1].state==='COMPLETED'));assert.equal(out.performanceValidated,false);
});
test('repeated breakout copy preserves the first confirmation and names the new cycle correctly',()=>{
 const a=C.evaluate(make([...bear,[21,24,20,23],[23,25,22,22],[22,24,21,23]])),confirmed=R.fields(a).details[2].value;assert.equal(a.lifecycleState,'BREAKOUT_INITIAL');assert.match(a.scenario.bullish,/再次突破/);assert.equal((confirmed.match(/首次收盤突破/g)||[]).length,1);assert.equal((confirmed.match(/再次收盤突破/g)||[]).length,1);
});
test('a valid price window without K0 is described as no pattern, separately from insufficient data',()=>{
 const a=C.evaluate(make(Array.from({length:25},()=>[10,11,9,10]))),f=R.fields(a);assert.equal(a.state,'NEUTRAL');assert.equal(a.event,null);assert.match(f.title,/尚未出現/);assert.match(f.details[5].value,/形成符合規則的 K0/);assert.doesNotMatch(f.details[3].value+f.details[4].value+f.details[5].value,/資料不足|資料是否完整/);
});
