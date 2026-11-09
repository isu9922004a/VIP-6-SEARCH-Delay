'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../../elliott-wave-v1'),U=require('../../research-common-v1'),I=require('../../indicator-multi-v1'),F=require('./elliott-fixtures.cjs');
const points=prices=>prices.map((price,index)=>({price,index,confirmedAt:'2025-01-02',pointStatus:'CONFIRMED'}));
test('standard impulse equality and floating noise do not loosen touch guards; equal wave lengths pass',()=>{
 assert.equal(E.ruleChecks(points([100,120,100+1e-12]),'UP').wave2AboveOrigin,'FAIL');
 assert.equal(E.ruleChecks(points([100,120,110,140,120+1e-12]),'UP').wave4NoOverlap,'FAIL');
 assert.equal(E.ruleChecks(points([100,120,110,130,125,145]),'UP').wave3NotShortest,'PASS');
 assert.equal(E.ruleChecks(points([100,120,110,120]),'UP').progression,'FAIL');
 for(const values of [[100,120,99],[100,120,110,125,122,145],[100,120,110,145,120]]){
  const up=E.ruleChecks(points(values),'UP'),down=E.ruleChecks(points(values.map(v=>500-v)),'DOWN');assert.deepEqual(up,down);
 }
});
test('third length waits for all six endpoints and their availability, not just the fifth endpoint',()=>{
 const p=points([100,120,110,125,122,145]);p[3].confirmedAt='2025-01-05';
 assert.equal(E.ruleChecks(p,'UP',{asOf:'2025-01-04'}).wave3NotShortest,'PENDING');
 assert.equal(E.ruleChecks(p,'UP',{asOf:'2025-01-05'}).wave3NotShortest,'FAIL');
 p[5].pointStatus='PENDING';assert.equal(E.ruleChecks(p,'UP').wave3NotShortest,'PENDING');
 assert.ok(Object.values(E.ruleChecks(p,'UP',{patternType:'DIAGONAL'})).every(s=>s==='UNSUPPORTED_PATTERN'));
});
test('unmodelled flat or truncated corrections are unsupported, not generic Elliott failures',()=>{
 assert.equal(E.ruleChecks(points([100,120,110,150,130,160,140,165]),'UP').correction,'UNSUPPORTED_PATTERN');
 assert.equal(E.ruleChecks(points([100,120,110,150,130,160,140,150,145]),'UP').correction,'UNSUPPORTED_PATTERN');
 assert.equal(E.ruleChecks(points([100,120,110,150,130,160,140,150,130]),'UP').correction,'PASS');
});
test('all current and historical pivots have causal availability, status, and actual price source',()=>{
 for(const count of [72,94,99,129,145]){const a=E.evaluate(F.report(count,{completeFive:count===99||count===145}));
  for(const p of [...a.points,...a.historicalCounts.flatMap(h=>h.points)]){assert.ok(p.availableAt<=a.date);assert.ok(p.pivotDate<=p.availableAt);assert.equal(p.availableAt,p.confirmedAt||a.date);assert.equal(p.priceSource,p.type==='HIGH'?'high':'low');assert.equal(p.pointStatus,p.confirmedAt?'CONFIRMED':'PENDING');assert.equal(p.price,a.bars[p.index][p.priceSource]);}
 }
});
test('each wave uses its interval volume and equal-duration prior reference rather than latest volume',()=>{
 const a=E.evaluate(F.report(99,{completeFive:true})),p=a.points,w=a.perWaveEvidence['3'],rows=a.bars.slice(p[2].index+1,p[3].index+1),prior=a.bars.slice(p[2].index-rows.length+1,p[2].index+1);
 assert.equal(w.meanVolume,U.mean(rows.map(b=>b.volume)));assert.equal(w.relativeVolume,w.meanVolume/U.mean(prior.map(b=>b.volume)));assert.equal(w.durationSessions,rows.length);assert.equal(w.availableAt,p[3].confirmedAt);
 const m=I.macd(a.bars);assert.equal(w.macdPeak,Math.max(...m.slice(p[2].index+1,p[3].index+1).map(z=>z.dif)));
 assert.deepEqual(w.macd,{dif:m[p[3].index].dif,dea:m[p[3].index].signal,hist:m[p[3].index].hist});assert.equal(w.atrMethod,'WILDER_14');
});
test('absent waves and insufficient warmup return unavailable/null instead of fake zero readings',()=>{
 const a=E.evaluate(F.report(72));assert.equal(a.perWaveEvidence['5'].state,'UNAVAILABLE');assert.equal(a.perWaveEvidence.C.state,'UNAVAILABLE');
 const b=F.rows(12),p=[E.pointMetadata({index:0,pivotDate:b[0].date,price:b[0].low,type:'LOW',confirmedAt:b[3].date},b.at(-1).date),E.pointMetadata({index:5,pivotDate:b[5].date,price:b[5].high,type:'HIGH',confirmedAt:b[8].date},b.at(-1).date)],w=E.perWaveEvidence(b,p,'UP')['1'];
 assert.equal(w.macd,null);assert.equal(w.atr14,null);assert.equal(w.relativeVolume,null);assert.equal(w.relativeVolumeState,'UNAVAILABLE');assert.equal(w.bollinger.state,'UNAVAILABLE');
});
test('forming fifth never declares divergence; confirmed comparison is reproducible from segment peaks',()=>{
 const forming=E.evaluate(F.report(94));assert.equal(forming.primary.evidence.divergence.state,'PENDING');assert.equal(forming.primary.evidence.divergence.macd,false);
 const ready=E.evaluate(F.report(99,{completeFive:true})),d=ready.primary.evidence.divergence;assert.ok(d.availableAt<=ready.date);assert.equal(d.third.macdPeak,ready.perWaveEvidence['3'].macdPeak);assert.equal(d.fifth.macdPeak,ready.perWaveEvidence['5'].macdPeak);
 const p=structuredClone(ready.points);p[5].price=p[3].price;assert.equal(E.divergenceEvidence(p,ready.perWaveEvidence,'UP',ready.date).state,'NOT_APPLICABLE');
});
test('Bollinger uses population sigma (20,2); zero-width percentB is unavailable and upper band is no sell signal',()=>{
 const b=F.rows(30).map(z=>({...z,close:100})),flat=E.bollinger(b);assert.equal(flat.middle,100);assert.equal(flat.bandwidth,0);assert.equal(flat.percentB,null);
 b.at(-1).close=120;const bb=E.bollinger(b),values=b.slice(-20).map(z=>z.close),mean=U.mean(values),sigma=Math.sqrt(U.mean(values.map(v=>(v-mean)**2)));assert.equal(bb.upper,mean+2*sigma);assert.equal(bb.lower,mean-2*sigma);
 const facts=E.confirmationEvidence(b,'UP');assert.match(facts.lines[2],/不代表一定回跌/);assert.equal(facts.tradeAllowed,undefined);assert.equal(facts.affectsOriginalEligibility,false);
});
test('mixed identities, per-bar volume units and declared price/version conflicts stop all added evidence',()=>{
 for(const edit of [r=>r.dailySeries[20].code='2330',r=>r.dailySeries[20].volumeUnit='lots',r=>r.dailySeriesMeta.priceBasis='OTHER',r=>r.sourceVersionConflict=true]){const r=F.report(94);edit(r);const a=E.evaluate(r);assert.equal(a.state,'DATA_INSUFFICIENT');assert.equal(a.primary,undefined);assert.deepEqual(a.points,[]);}
});
test('prefix evidence cannot be rewritten by later bars, retains namespaces and all research firewalls',()=>{
 const raw=F.report(129),before=JSON.stringify(raw),a=E.evaluate(raw),all=F.rows(145);all[140].high+=1000;
 assert.deepEqual(E.evaluate(F.report(129)),a);assert.equal(JSON.stringify(raw),before);assert.equal(E.evaluate(F.report(145),{asOf:raw.closeDate}).state,'DATA_INSUFFICIENT');
 for(const key of ['performanceValidated','affectsOriginalScore','affectsOriginalRanking','affectsOriginalEligibility'])assert.equal(a[key],false);assert.equal(a.researchOnly,true);
 assert.ok(a.points.slice(6).every(p=>p.namespace==='ELLIOTT_CORRECTION'));assert.doesNotMatch(JSON.stringify(a),/第6推動浪|第 6 浪/);
 assert.ok(a.primary.evidence.ruleEvidence.every(f=>f.category==='HARD_RULE'));assert.ok(a.confirmationEvidence.facts.every(f=>['SUPPORTING','RISK','NOT_AVAILABLE'].includes(f.category)));
});
test('a trusted independent index reuses its exact wave object; changed history and forged cached objects do not',()=>{
 const M=require('../../research-v83/market-engine'),V=require('../../elliott-wave-visual-v1'),source=require('../../data/index/TAIEX.json'),a=M.analyze(source);
 assert.equal(E.matchesSnapshot(a,a.elliottWave),true);assert.equal(V.result(a),a.elliottWave);
 const changed={...a,input:{...a.input,bars:structuredClone(a.input.bars)}};changed.input.bars[20].high+=1;
 assert.equal(E.matchesSnapshot(changed,a.elliottWave),false);assert.equal(V.result(changed).state,'DATA_INSUFFICIENT');
 const forged=structuredClone(a);assert.equal(E.matchesSnapshot(forged,forged.elliottWave),false);
 const r=F.report(94),wave=E.evaluate(r),edit=structuredClone(r);edit.dailySeries[20].high+=.5;assert.equal(E.matchesSnapshot(edit,wave),false);
});
test('TXT, JSON and CSV export the same computed wave model and original trade references',()=>{
 const R=require('../../elliott-wave-report-v1'),m=R.buildModel(F.report(99,{completeFive:true})),before=JSON.stringify(m),x=R.exportAnalysis(m),j=JSON.parse(x.json);
 assert.deepEqual(j.wave,m.wave);assert.equal(j.identity,m.identity);assert.deepEqual(j.originalLevels,m.levels);assert.equal(JSON.stringify(m),before);assert.equal(x.csv.split('\n').length,9);assert.ok(x.txt.includes(m.wave.confirmationEvidence.lines[0]));
});
