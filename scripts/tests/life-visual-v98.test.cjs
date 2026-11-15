'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const V=require('../../life-line-visual-v98.js');
const R=require('../../kline-life-03-report-v1.js'),C=require('../../kline-life-03-core-v1.js'),F=require('../../four-models-research-v1.js');
const raw=require('../../data/research/2026-11-13/6925.json');
const study=R.inspect(C.withSource(F.evaluate(raw),raw));
const mock={createElement:()=>({})},inspect=(s,options={})=>V.build(s,{document:mock,source:raw,...options}).map(p=>JSON.parse(p.dataset.life98Audit));
test('V9.8 has exactly two independent 1284x2778 canvases and trophy, no portrait dependency',()=>{
 const before=JSON.stringify(study),a=inspect(study);assert.equal(V.RELEASE,'V9.8');assert.equal(a.length,2);
 for(const [i,p] of a.entries()){assert.equal(p.width,1284);assert.equal(p.height,2778);assert.equal(p.page,i+1);assert.equal(p.pages,2);assert.equal(p.trophy,true);assert.equal(p.model.code,'6925');assert.equal(p.model.date,'2026-11-13');assert.equal(p.originalEventId,study.event.eventId);assert.equal(p.affectsEligibility,false);assert.equal(p.affectsRanking,false);}
 assert.equal(JSON.stringify(study),before);
});
test('true close, life source, MA and volume must not be copied from visual mock-up',()=>{
 const a=inspect(study)[0],m=a.model;assert.equal(m.close,106.5);assert.equal(m.line,102.5);assert.equal(m.range.high,129);assert.equal(m.range.low,94.1);assert.ok(Math.abs(m.ma[5]-102.12)<1e-8);assert.ok(Math.abs(m.ma[10]-105.36)<1e-8);assert.ok(Math.abs(m.ma[20]-106.165)<1e-9);assert.ok(Math.abs(m.ma[60]-74.43916666666668)<1e-8);
 assert.equal(m.volume.last,3020013);assert.ok(Math.abs(m.volume.ratio-0.5030077401565141)<1e-8);assert.equal(m.chartBarDates.length,30);
 assert.deepEqual(m.markers.map(x=>x.label),['K3','K2','K1','K0']);assert.deepEqual(m.markers.map(x=>x.date),['2026-11-03','2026-11-04','2026-11-05','2026-11-06']);
});
test('historical reference, absent K0, and insufficient-source volume do not produce made-up status',()=>{
 const s=JSON.parse(JSON.stringify(study));s.event.referenceOnly=true;s.event.currentRole='HISTORICAL_REFERENCE';assert.equal(inspect(s)[0].model.referenceOnly,true);
 const absent=JSON.parse(JSON.stringify(study));absent.event=null;assert.equal(inspect(absent)[0].model.line,null);assert.equal(inspect(absent)[0].model.markers.length,0);
 const uncertain=JSON.parse(JSON.stringify(study));uncertain.sourceVolumeAudit={uncertain:true};assert.equal(inspect(uncertain)[0].model.volume.verified,false);
});
test('visual routing chooses V9.8, but original full legacy pages and event core remain available',()=>{
 const code=fs.readFileSync('research-integration-v1.js','utf8');assert.match(code,/ShitouLifeVisual98\.build/);
 assert.equal(V.build(study,{document:mock}).length,2);
 assert.ok(fs.readFileSync('life-line-visual-v972.js','utf8').includes('V9.7.2'));
});
