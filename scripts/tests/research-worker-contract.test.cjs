'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../../selection-data-v2.js'),C=require('../../four-models-research-v1.js');
const data=require('../fixtures/9933-worker-responses-20261022.json'),full=data.stock,daily=data.daily.results[0].data;
const clone=x=>structuredClone(x);
function bind(){D.reset();D.bind({map:new Map(data.snapshot.rows.map(q=>[q.code,q])),meta:data.snapshot.meta,snapshotRows:data.snapshot.rows.length});}
const core=a=>({state:a.state,models:a.models,features:a.features,families:a.families,risks:a.risks,breakout:a.researchBreakoutPrice,invalidation:a.researchInvalidation,quality:a.dataQuality});
test('recorded real FULL response has 392 bars but legacy top-level completion is absent',()=>{
 assert.equal(full.dailySeries.length,392);assert.equal(full.completed,undefined);assert.equal(full.dailySeriesMeta.onlyCompletedBars,true);assert.equal(full.volume.unit,'shares');assert.equal(C.evaluate(full).state,'INSUFFICIENT_DATA');
 bind();const r=D.normalizeWorkerReport(full,'9933');assert.equal(r.completed,true);assert.equal(r.volumeUnit,'shares');assert.equal(r.workerDataAudit.volumeUnitSource,'volume.unit');assert.equal(full.completed,undefined);
});
test('recorded DAILY_ONLY contract + independent snapshot yields shared 160-bar technical research',async()=>{
 bind();D.setFetcher(async()=>clone(data.daily));await D.ensure([{code:'9933'}]);
 const inputBefore=JSON.stringify(full),single=C.evaluate(D.apply(full,'9933')),filter=C.evaluate(D.apply(daily,'9933'));
 assert.deepEqual(core(single),core(filter));assert.equal(single.validation.historyBarCount,160);assert.equal(single.state,'HEALTHY_PULLBACK');assert.equal(single.researchBreakoutPrice,48.75);assert.equal(single.researchInvalidation,43);
 assert.equal(JSON.stringify(full),inputBefore);assert.equal(single.validation.externalEvidenceAvailable,false);assert.equal(single.models.D.checks.find(c=>c.id==='D4').status,'UNKNOWN');assert.equal(single.dataQuality.complete,false);
 assert.match(single.validation.workerDataAudit.volumeUnitSource,/CONTRACT/);assert.equal(D.get('9933').sourceVolume,8139000);assert.equal(single.sourceBars.at(-1).volume,8265954);
});
for(const [name,change] of [
 ['explicit unfinished report',r=>r.completed=false],['explicit unfinished marker',r=>r.isComplete=false],['metadata not completed',r=>r.dailySeriesMeta.onlyCompletedBars=false],
 ['completed count mismatch',r=>r.dailySeriesMeta.completedDailyRowsAvailable--],['OHLCV count mismatch',r=>r.dailySeriesMeta.completeOhlcvRowsAvailable--],
 ['metadata last date mismatch',r=>r.dailySeriesMeta.lastDate='2026-10-21'],['explicit unknown unit',r=>r.volumeUnit='unknown'],
 ['explicit lots conflict',r=>r.dailySeriesMeta.volumeUnit='lots'],['row unit conflict',r=>r.dailySeries[0].volumeUnit='lots'],
 ['unsupported source contract',r=>r.dailySeriesMeta.source='UNRECOGNIZED_SOURCE'],['unsupported schema',r=>r.dailySeriesMeta.schema='unknown'],
 ['other ticker',r=>r.stock='2330'],['other market',r=>r.market='TPEX'],['snapshot unit scale mismatch',r=>r.dailySeries.at(-1).volume/=1000],
 ['invalid OHLC',r=>r.dailySeries.at(-1).high=1]
])test(`Worker adapter never promotes ${name}`,()=>{bind();const r=clone(daily);change(r);assert.throws(()=>D.remember(r,'9933'));assert.equal(D.get('9933'),null);});
test('generic reports cannot acquire units merely by resembling snapshot volume',()=>{bind();const r=clone(daily);delete r.dailySeriesMeta.schema;r.completed=true;assert.throws(()=>D.remember(r,'9933'),/單位/);});
test('FULL may not borrow DAILY_ONLY unit contract when volume.unit is absent',()=>{bind();const r=clone(full);delete r.volume.unit;assert.throws(()=>D.remember(r,'9933'),/來源契約/);});
test('same invalid data has identical missing reasons regardless of acquisition-error duplicate',()=>{
 const r={stock:'2330',market:'TWSE',closeDate:'2026-10-22',researchInputErrors:['SAME_VERIFICATION_FAILURE']},a=C.evaluate(r),b=C.evaluate({...r,researchAcquisitionError:'SAME_VERIFICATION_FAILURE'});
 assert.deepEqual(a.dataQuality,b.dataQuality);assert.equal(b.dataQuality.missing.filter(x=>x==='SAME_VERIFICATION_FAILURE').length,1);
});
