'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifiedRows,replayRows}=require('../audit-v927-abc-prefix.cjs');
for(const code of ['2330','8099'])test('original ABC prefix replay '+code,async()=>{
 const a=require('../../data/research/2026-11-26/'+code+'.json'),rows=verifiedRows(a),cut=rows[rows.length-20].date;
 const full=await replayRows(rows),early=await replayRows(rows,cut),truncated=await replayRows(rows.slice(0,rows.length-19));
 assert.deepEqual(early,truncated);
 assert.deepEqual(full.timeline.filter(x=>x.date<=cut),early.timeline);
 assert.equal(full.pointInTimeVerified,false);assert.equal(full.productionAnchorsEnabled,false);
 for(const row of full.timeline)if(row.activeABC){
  assert.ok(row.firstObservedOn<=row.date);
  for(const k of ['A','B','C'])assert.ok(row.activeABC[k+'Date']<row.activeABC[k+'PivotConfirmedDate']&&row.activeABC[k+'PivotConfirmedDate']<=row.firstObservedOn);
 }
 const changed=structuredClone(a);changed.dailySeries[0].low-=1;
 assert.throws(()=>verifiedRows(changed),/fingerprint/);
 const missing=structuredClone(a);missing.officialArchiveEvidence.sourceDays=missing.officialArchiveEvidence.sourceDays.filter(x=>x.date!==rows[0].date);
 assert.throws(()=>verifiedRows(missing),/unreceipted/);
});
