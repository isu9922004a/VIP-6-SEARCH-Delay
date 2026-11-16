'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Market=require('../../market-life-report-v96.js');
const Risk=require('../../market-life-risk-v910.js');
const Outcome=require('../../market-life-outcome-v910.js');
// Frozen official completed-session fixture: production data/index/TAIEX.json must advance daily.
const raw=require('../fixtures/taiex-20261113.json');
const study=Market.evaluate(raw,{now:new Date('2026-11-14T08:00:00Z')});
test('V9.10 reads verified completed TAIEX only and preserves every original K event',()=>{
 const before=JSON.stringify(study),r=Risk.evaluate(study);
 assert.equal(r.date,'2026-11-13');
 assert.equal(r.metrics.close,43675.12);
 assert.equal(r.life.referencePrice,43741.54);
 assert.equal(r.life.state,'BREAKOUT_FAILED');
 assert.equal(r.life.role.code,'RECLAIM_WATCH');
 assert.equal(r.volume.verified,false);
 assert.equal(r.risk.performanceValidated,false);
 assert.deepEqual(r.scenarios.map(x=>x.id),['A','B','C']);
 assert.equal(r.scenarios.filter(x=>x.active).length,1);
 assert.equal(r.rawEventId,study.event.eventId);
 assert.equal(JSON.stringify(study),before);
 assert.equal(Object.isFrozen(r),true);
});
test('four levels have actual explanations, cannot turn low-verified volume into strength',()=>{
 const r=Risk.evaluate(study);assert.ok([1,2,3,4].includes(r.risk.level));
 assert.ok(r.risk.reasons.length);assert.ok(r.metrics.baselineSample>=15);
 assert.equal(r.metrics.ma20,44634.4);
 assert.equal(r.scenarios.filter(x=>x.active)[0].id,r.activeScenario);
 const sparse={...study,validatedBars:study.validatedBars.slice(-4)};
 assert.equal(Risk.evaluate(sparse).risk.level,0);
});
test('a user supplied 11/16 intraday screenshot cannot masquerade as completed official bar',()=>{
 const snapshot=Risk.evaluate(study);
 const x={...study,close:41445.15,validatedBars:[...study.validatedBars,{date:'2026-11-16',open:43512,high:43512,low:41445.15,close:41445.15,completed:false}],dataAsOf:'2026-11-16'};
 assert.throws(()=>Risk.evaluate(x),/日期|完成日/);
 assert.equal(snapshot.date,'2026-11-13');assert.equal(snapshot.metrics.close,43675.12);
});
test('TAIEX official identity is mandatory, no stock or unverified index is accepted',()=>{
 for(const extra of [{code:'2330'},{sourceVerified:false},{instrumentType:'TPEX'}])assert.throws(()=>Risk.evaluate({...study,...extra}),/加權指數|核對/);
});
test('risk triggers C independently of distant ten-day lows; event stays unchanged',()=>{
 const x=structuredClone(study);const b=x.validatedBars.at(-1);b.close=b.low+1;x.close=b.close;
 const r=Risk.evaluate(x);
 assert.equal(r.activeScenario,'C');assert.notEqual(r.risk.level,1);assert.equal(r.life.state,study.lifecycleState);
 assert.equal(x.event.eventId,study.event.eventId);
});
test('a historical audit requires a frozen preregistered decision and genuine later completed close',()=>{
 const registered=Outcome.snapshot(Risk.evaluate(study));assert.equal(Object.isFrozen(registered),true);
 const pending=Outcome.compare(registered,null);assert.equal(pending.status,'PENDING');
 assert.throws(()=>Outcome.compare(registered,{instrumentType:'TAIEX',date:'2026-11-16',close:41445.15,completed:false,sourceVerified:true,sourceReceipt:'test'}),/完成日/);
 const verdict=Outcome.compare(registered,{instrumentType:'TAIEX',date:'2026-11-16',close:41445.15,completed:true,sourceVerified:true,sourceReceipt:'fixture-only'});
 assert.ok(['MATCH','MISS','PARTIAL'].includes(verdict.status));
 const s=Outcome.walkForward([{snapshot:registered,nextCompletedSession:null}]);assert.equal(s.performanceValidated,false);assert.equal(s.verifiedSamples,0);
});
