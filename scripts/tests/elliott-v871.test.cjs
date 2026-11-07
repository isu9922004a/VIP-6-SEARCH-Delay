'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../../elliott-wave-v1'),V=require('../../elliott-wave-visual-v1'),S=require('../../structure-context-v1'),F=require('./elliott-fixtures.cjs'),B=require('./engulf-range-fixtures.cjs'),actual=require('../fixtures/taiex-wave-20261106.json');
function noisy(count=109){const b=F.rows(count);for(const [i,c] of [[70,139.5],[71,135],[72,136],[73,125]])Object.assign(b[i],{open:c-.5,close:c,high:c+.5,low:c-.5});return B.report(b);}
test('larger existing pivots recover a valid count that minor turns interrupt, preserving hard rules',()=>{
 const r=noisy(),a=E.evaluate(r);assert.equal(a.scaleComparisons[0].hasCandidate,false);assert.equal(a.selectedScale.pivotRight,5);assert.ok(a.primary);assert.match(a.headline,/修正浪/);
 for(const k of ['wave2AboveOrigin','wave3NotShortest','wave4NoOverlap'])assert.equal(a.primary.rules[k],'PASS');
 assert.deepEqual(a.scaleComparisons.map(x=>x.scale.pivotRight),[3,5,8]);
 for(const p of a.points.filter(x=>x.confirmedAt)){assert.equal(p.confirmedAt,r.dailySeries[p.index+5].date);assert.ok(p.confirmedAt<=r.closeDate);assert.equal(p.price,r.dailySeries[p.index][p.type==='HIGH'?'high':'low']);}
});
test('conflicting short and large waves are retained and explicitly described without merging their points',()=>{
 const a=E.evaluate(noisy(94));assert.equal(a.state,'DISAGREEMENT');assert.equal(a.scaleDisagreement,true);assert.equal(a.selectedScale.pivotRight,3);assert.equal(a.scaleAlternative.scale.pivotRight,5);assert.notEqual(a.primary.points.at(-1).label,a.scaleAlternative.points.at(-1).label);assert.ok(V.linesFor(a).some(s=>s.includes('大小波段的解讀不同')));
});
test('complete historical five survives later sideways prices and remains separate from the current state',()=>{
 const before=E.evaluate(F.report(99,{completeFive:true})),after=E.evaluate(F.report(145,{completeFive:true}));assert.equal(after.state,'UNCLEAR');assert.equal(after.primary,undefined);assert.deepEqual(after.points,[]);assert.equal(after.historicalCounts.length,1);assert.deepEqual(after.historicalCounts[0],before.historicalCounts[0]);
 const h=after.historicalCounts[0];assert.equal(h.status,'HISTORICAL_RULES_PASSED');assert.equal(h.interpretationConfirmed,false);assert.equal(h.turnsConfirmed,true);assert.deepEqual(h.points.map(p=>p.label),['起點','1','2','3','4','5']);assert.ok(h.points.every(p=>p.namespace==='ELLIOTT_HISTORICAL'&&p.confirmedAt<=h.availableAt));assert.ok(V.linesFor(after).some(x=>/歷史五段.*不代表目前在第5浪/.test(x)));
});
test('historical record waits for its own right-side bars and never uses later ATR to validate the past',()=>{
 const early=E.evaluate(F.report(98,{completeFive:true})),ready=E.evaluate(F.report(99,{completeFive:true}));assert.equal(early.historicalCounts.length,0);assert.equal(ready.historicalCounts.length,1);assert.equal(ready.historicalCounts[0].availableAt,F.rows(99).at(-1).date);
 const long=F.rows(145,{completeFive:true});long.at(-1).volume*=10;long.at(-1).high+=20;const later=E.evaluate(B.report(long));assert.ok(later.historicalCounts.some(h=>h.availableAt===ready.historicalCounts[0].availableAt&&JSON.stringify(h)===JSON.stringify(ready.historicalCounts[0])));
});
test('requested larger confirmation windows are honored and cannot accept default-scale injected pivots',()=>{
 const r=F.report(109),a=E.evaluate(r,{parameters:{scaleWindows:[5]}});assert.equal(a.selectedScale.pivotRight,5);for(const p of a.points.filter(p=>p.confirmedAt))assert.equal(p.confirmedAt,r.dailySeries[p.index+5].date);
 assert.equal(E.evaluate(r,{parameters:{scaleWindows:[5]},pivots:S.pivots(r.dailySeries)}).state,'DATA_INSUFFICIENT');for(const q of [{scaleWindows:[0]},{scaleWindows:[13]},{scaleWindows:[]},{pivotRight:-1}])assert.equal(E.evaluate(r,{parameters:q}).state,'DATA_INSUFFICIENT');
});
test('actual November 6 TAIEX still does not manufacture a five after comparing all scales',()=>{
 const a=E.evaluate(actual);assert.equal(a.date,'2026-11-06');assert.equal(a.state,'RULE_VIOLATION');assert.equal(a.primary,undefined);assert.deepEqual(a.points,[]);assert.deepEqual(a.historicalCounts,[]);assert.equal(a.scaleComparisons.length,3);assert.ok(a.scaleComparisons.every(s=>!s.hasCandidate));assert.ok(a.diagnostics.length);
 for(const d of a.diagnostics.filter(d=>d.observed)){const row=actual.dailySeries.find(b=>b.date===d.observed.date);assert.ok(row);assert.equal(d.observed.price,row[d.direction==='UP'?'low':'high']);assert.ok(d.observed.date<=a.date);assert.match(d.text,new RegExp(d.observed.date));assert.ok(d.text.includes(d.boundary.toFixed(2)));}
 const lines=V.linesFor(a);assert.ok(lines.some(x=>x.includes('大小波段比較')));assert.ok(lines.some(x=>x.includes('2026-10-13')&&x.includes('48066.36')));assert.doesNotMatch(lines.join(' '),/RULE_VIOLATION|wave4NoOverlap|特殊對角線|複雜修正尚未建模/);
});
test('all new research fields stop on a source conflict and do not change the report',()=>{
 const r=F.report(145,{completeFive:true,extra:{volumeSourceConflict:true}}),before=JSON.stringify(r),a=E.evaluate(r);assert.equal(a.state,'DATA_INSUFFICIENT');assert.deepEqual(a.historicalCounts,[]);assert.deepEqual(a.scaleComparisons,[]);assert.deepEqual(a.diagnostics,[]);assert.equal(JSON.stringify(r),before);
});
test('same prefix yields identical current, scale and historical decisions after unrelated future changes',()=>{
 const all=F.rows(145,{completeFive:true}),prefix=all.slice(0,109),a=E.evaluate(B.report(prefix));all[130].high+=100;all[140].low-=50;assert.deepEqual(E.evaluate(B.report(all.slice(0,109))),a);assert.equal(E.evaluate(B.report(all),{asOf:prefix.at(-1).date}).state,'DATA_INSUFFICIENT');assert.deepEqual(E.evaluate(structuredClone(B.report(prefix))),a);
});
