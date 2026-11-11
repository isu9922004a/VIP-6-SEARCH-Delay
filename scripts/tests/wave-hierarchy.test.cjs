'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../../elliott-wave-v1'),W=require('../../elliott-wave-report-v1'),V=require('../../elliott-wave-visual-v1'),S=require('../../structure-context-v1');
const actual=require('../fixtures/wave-hierarchy-1709-20261110.json');
const asOf='2026-01-20',date=i=>'2026-01-'+String(i+1).padStart(2,'0');
function candidate(scale,values,direction='UP'){
 return {scale:{id:'S'+scale,pivotRight:scale,pivotLeft:scale},direction,points:values.map(([index,price],i)=>({index,price,type:(direction==='UP')===(i%2===0)?'LOW':'HIGH',pivotDate:date(index),confirmedAt:date(index+1),availableAt:date(index+1),pointStatus:'CONFIRMED',priceSource:(direction==='UP')===(i%2===0)?'low':'high',label:i?String(i):'起點'}))};
}
test('real 1709 snapshot keeps its exact pivots, pending rules and geometry while exposing nested degrees',()=>{
 const before=JSON.stringify(actual),a=E.evaluate(actual);assert.equal(a.code,'1709');assert.equal(a.date,'2026-11-10');
 assert.deepEqual(a.primary.points.map(p=>[p.pivotDate,p.price]),[['2026-10-14',63.8],['2026-10-19',50.4],['2026-10-27',58.2],['2026-11-06',41.25]]);
 assert.equal(a.primary.points.at(-1).confirmedAt,null);assert.equal(a.primary.rules.wave3NotShortest,'PENDING');assert.equal(a.primary.rules.wave4NoOverlap,'PENDING');
 assert.equal(a.scaleDisagreement,false);assert.equal(a.interpretation.status,'NESTED_DEGREES');assert.equal(a.interpretation.parentScale.pivotRight,8);
 assert.ok(a.interpretation.relations.filter(r=>r.childScale==='SCALE_3').every(r=>r.relation==='NESTED'));
 const alt=a.interpretation.correctionAlternatives[0];assert.deepEqual(alt.points.map(p=>p.price),a.primary.points.map(p=>p.price));assert.deepEqual(alt.points.map(p=>p.label),['起點','A','B','C']);assert.equal(alt.subwaveComposition,'UNVERIFIED');assert.equal(alt.confirmed,false);assert.equal(alt.tradeAllowed,false);assert.equal(alt.namespace,'ELLIOTT_CORRECTION_RESEARCH');
 assert.ok(a.interpretation.unsupportedPatterns.includes('WXY'));assert.match(a.interpretation.limitations.join(''),/尚未完整建模/);assert.equal(JSON.stringify(actual),before);
});
test('contained counter-swings use actual time and price bounds and work in both market directions',()=>{
 const parent=candidate(8,[[0,90],[5,130],[9,100]]),child=candidate(3,[[5,130],[6,112],[7,123],[8,105]],'DOWN');
 const r=E.compareScaleCandidates(child,parent,{asOf,lastIndex:9});assert.equal(r.relation,'NESTED');assert.equal(r.childScale,'S3');
 const mirror=c=>({...c,direction:c.direction==='UP'?'DOWN':'UP',points:c.points.map(p=>({...p,price:300-p.price,type:p.type==='HIGH'?'LOW':'HIGH',priceSource:p.type==='HIGH'?'low':'high'}))});
 assert.equal(E.compareScaleCandidates(mirror(child),mirror(parent),{asOf,lastIndex:9}).relation,'NESTED');
 const escaped=structuredClone(child);escaped.points[1].price=99;assert.notEqual(E.compareScaleCandidates(escaped,parent,{asOf,lastIndex:9}).relation,'NESTED');
 const late=structuredClone(child);late.points.at(-1).index=10;late.points.at(-1).pivotDate=date(10);assert.notEqual(E.compareScaleCandidates(late,parent,{asOf,lastIndex:10}).relation,'NESTED');
});
test('identical current legs with different wave labels are compatible, not a numerical-label conflict',()=>{
 const a=candidate(3,[[3,100],[5,120],[7,110],[9,140]]),b=candidate(8,[[0,80],[1,100],[2,90],[5,120],[7,110],[9,140]]);
 assert.equal(E.compareScaleCandidates(a,b,{asOf,lastIndex:9}).relation,'SHARED_CURRENT_LEG');
 assert.equal(E.compareScaleCandidates(a,{...a,scale:b.scale},{asOf,lastIndex:9}).relation,'SAME_POINTS');
});
test('opposing overlapping counts remain competing and separate windows are not falsely joined',()=>{
 const down=candidate(3,[[2,130],[4,110],[6,125],[8,108]],'DOWN'),up=candidate(8,[[0,90],[5,120],[6,105],[9,140]]);
 assert.equal(E.compareScaleCandidates(down,up,{asOf,lastIndex:9}).relation,'COMPETING');
 const later=candidate(8,[[10,100],[12,120],[14,110],[16,140]]);assert.equal(E.compareScaleCandidates(down,later,{asOf,lastIndex:16}).relation,'DIFFERENT_WINDOWS');
});
test('future confirmation dates and missing endpoint types cannot certify nesting or ABC alternatives',()=>{
 const a=candidate(3,[[1,100],[3,120],[5,110],[7,140]]),b=candidate(8,[[0,90],[9,150]]);
 a.points.at(-1).confirmedAt='2026-01-25';assert.equal(E.compareScaleCandidates(a,b,{asOf,lastIndex:9}).relation,'UNRESOLVED');assert.equal(E.threeLegCorrection(a,asOf),null);
 a.points.at(-1).confirmedAt=date(8);a.points.at(-1).availableAt='2026-01-25';assert.equal(E.threeLegCorrection(a,asOf),null);
 a.points.at(-1).availableAt=date(8);a.points[1].type='LOW';assert.equal(E.threeLegCorrection(a,asOf),null);assert.equal(E.threeLegCorrection(a),null);
});
test('three-leg alternatives never relax B/origin and C/progression boundaries or assert internal subwaves',()=>{
 for(const direction of ['UP','DOWN']){
  const reflect=n=>direction==='UP'?n:300-n,make=values=>candidate(3,values.map((p,i)=>[i+1,reflect(p)]),direction);
  const good=E.threeLegCorrection(make([100,120,110,140]),asOf);assert.equal(good.state,'UNCONFIRMED');assert.equal(good.subwaveComposition,'UNVERIFIED');assert.equal(good.confirmed,false);
  for(const values of [[100,120,100,140],[100,120,99,140],[100,120,110,120],[100,120,110,119]])assert.equal(E.threeLegCorrection(make(values),asOf),null);
 }
});
test('missing volume/momentum support remains a caution, not an invented competing count',()=>{
 const a=E.evaluate(actual),p={...E.PARAM,pivotLeft:3,pivotRight:3},single=E.analyzeBars(a.bars,S.pivots(a.bars,p),{parameters:p});
 assert.equal(single.counts.length,1);assert.equal(single.primary.evidence.volumeIncreased,false);assert.equal(single.state,'RESEARCH_ONLY');assert.equal(single.primary.rules.wave3NotShortest,'PENDING');
});
test('stock and index templates use the same interpretation and date historical retracement without changing values',()=>{
 const m=W.buildModel(actual,{kind:'stock'}),b=m.beginner;assert.equal(b.phase,m.wave.interpretation.positionSummary);assert.ok(!b.phase.includes('可能在第3段下跌'));
 assert.equal(b.reading.depth.ratioPct,58.20895522388063);assert.deepEqual(b.reading.depth.period,{startDate:'2026-10-19',endDate:'2026-10-27',asOf:'2026-11-10',context:'HISTORICAL_PRECEDING_SWING'});
 assert.match(b.reading.depth.text,/先前反彈（10-19～10-27）/);assert.match(b.reading.depth.text,/13.40.*7.80.*58.2%/);
 assert.ok(V.linesFor(m.wave).some(t=>t.includes('兩者可以同時成立')));assert.ok(V.linesFor(m.wave).some(t=>t.includes('W-X-Y')));
 const index=W.buildModel(require('../fixtures/taiex-wave-20261106.json'),{kind:'market'});assert.equal(index.code,'TAIEX');assert.equal(index.marketBeginner.phase,require('../../elliott-wave-stock-beginner-v1').waveReading(index).phase);assert.equal(index.marketBeginner.entryEnabled,false);
 assert.equal(b.personalStop,null);assert.equal(m.wave.affectsOriginalScore,false);assert.equal(m.wave.affectsOriginalRanking,false);assert.equal(m.wave.affectsOriginalEligibility,false);
});
