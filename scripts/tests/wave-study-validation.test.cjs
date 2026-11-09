'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),V=require('../../research-validation-v1'),E=require('../../elliott-wave-v1'),F=require('./elliott-fixtures.cjs'),K=require('../../kronos-future-core-v1');
function snapshot(){const raw=F.report(94),wave=E.evaluate(raw),future=F.rows(100).slice(94,99),a={code:raw.stock,market:raw.market,date:raw.closeDate,sourceBars:raw.dailySeries,elliottWave:wave,researchBreakoutPrice:wave.points[1].price,state:'OBSERVATION'};return {snapshotId:'TEST_ONLY_WAVE_PIT',date:raw.closeDate,signalAt:raw.closeDate+'T10:00:00Z',inputsAvailableAt:raw.closeDate+'T09:00:00Z',pointInTimeVerified:true,historicalUniverseVerified:true,sourceSnapshotHash:crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex'),analyses:[a],baselineCodes:[raw.stock],outcomes:[{code:raw.stock,signalClose:raw.close,futureBars:future,expectedTradingDates:future.map(z=>z.date),nextTradingDate:future[0].date,nextTradingDateVerified:true,ohlcvVerified:true}]};}
test('paired wave background preserves exact original codes and absent executions never become profits',()=>{
 const s=snapshot(),before=JSON.stringify(s),r=V.compareWaveEvidence(s);assert.deepEqual(r.groups.BASELINE.codes,s.baselineCodes);assert.deepEqual(r.groups.WITH_WAVE_BACKGROUND,r.groups.BASELINE);assert.equal(JSON.stringify(s),before);
 for(const group of Object.values(r.groups))for(const h of [1,3,5]){assert.equal(group.horizons[h].netRealizedReturnPct,null);assert.equal(group.horizons[h].verifiedRealizedTradeCount,0);}
 assert.equal(r.performanceValidated,false);assert.equal(r.events[0].sourceSnapshotHash,s.sourceSnapshotHash);assert.equal(r.events[0].availableAt,s.inputsAvailableAt);assert.equal(r.events[0].outcome.code,s.baselineCodes[0]);
});
test('ledger refuses missing snapshot hash, mismatched code/date/revision and future confirmation',()=>{
 for(const edit of [s=>delete s.sourceSnapshotHash,s=>s.analyses[0].elliottWave.code='2330',s=>s.analyses[0].elliottWave.version='old',s=>s.analyses[0].elliottWave.points[0].availableAt='2099-01-01']){const s=structuredClone(snapshot());edit(s);assert.throws(()=>V.waveEvents(s));}
});
test('walk-forward is fixed-parameter and refuses overlap, duplicate pairs, or fabricated performance claims',()=>{
 const s=snapshot();assert.throws(()=>V.walkForwardWave([s],{trainEnd:s.date,testStart:s.date}),/重疊/);assert.throws(()=>V.walkForwardWave([s,s],{trainEnd:'2024-01-01',testStart:'2025-01-01'}),/重複/);
 const r=V.walkForwardWave([s],{trainEnd:'2024-01-01',testStart:'2025-01-01'});assert.equal(r.status,'INSUFFICIENT_OUT_OF_SAMPLE_DATA');assert.equal(r.testCount,1);assert.equal(r.performanceValidated,false);
});
test('verified exits and explicit round-trip costs are required at each exact horizon',()=>{
 const s=snapshot(),row=s.outcomes[0],b=row.futureBars[0];row.execution={verified:true,filled:true,date:b.date,price:b.open,roundTripCostsVerified:true,buyFeePct:.1,sellFeePct:.1,taxPct:.3,slippagePct:.2,exits:[{horizon:1,verified:true,filled:true,date:b.date,price:b.close}]};
 const r=V.compareWaveEvidence(s).groups.BASELINE.horizons;assert.equal(r[1].verifiedRealizedTradeCount,1);assert.ok(Math.abs(r[1].netRealizedReturnPct-((b.close/b.open-1)*100-.7))<1e-10);assert.equal(r[3].netRealizedReturnPct,null);
 row.execution.date=s.date;assert.equal(V.compareWaveEvidence(s).groups.BASELINE.horizons[1].netRealizedReturnPct,null);
});
test('first, third, fifth and twentieth close distributions use actual distinct trading dates and raw paths',()=>{
 const source=require('../fixtures/postclose-4743-20261106.json'),forecast=require('../fixtures/kronos-future-4743-20261106.json'),before=JSON.stringify(forecast),r=K.horizonDistributions(source,forecast),m=K.evaluate(source,forecast);
 assert.equal(r.state,'READY');assert.equal(r.sampleCount,forecast.closePaths.length);assert.deepEqual(r.rows.map(z=>z.horizon),[1,3,5,20]);
 for(const row of r.rows){assert.equal(row.date,forecast.targetDates[row.horizon-1]);assert.equal(row.p10,m.bands[row.horizon-1].p10);assert.equal(row.p90,m.bands[row.horizon-1].p90);assert.equal(row.intradayRange,false);assert.equal(row.profitRange,false);}
 assert.equal(JSON.stringify(forecast),before);const missing=K.horizonDistributions(source,null);assert.match(missing.reason,/未取得隔日模型區間/);assert.deepEqual(missing.rows,[]);
});
