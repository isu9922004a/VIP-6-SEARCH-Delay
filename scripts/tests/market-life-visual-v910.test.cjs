'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Market=require('../../market-life-report-v96.js'),Risk=require('../../market-life-risk-v910.js'),Visual=require('../../market-life-visual-v910.js'),Stock=require('../../life-line-visual-v98.js'),Outcome=require('../../market-life-outcome-v910.js');
const raw=require('../fixtures/taiex-20261113.json'),study=Market.evaluate(raw,{now:new Date('2026-11-14T08:00:00Z')});
const doc={createElement:()=>({})};
test('V9.10 renders two independent TAIEX reports with risk and original K3 identity',()=>{
 const before=JSON.stringify(study),pages=Visual.build(study,{document:doc}),audit=pages.map(p=>JSON.parse(p.dataset.marketLifeAudit));
 assert.equal(JSON.stringify(study),before);assert.equal(Stock.RELEASE,'V9.8');assert.equal(Visual.RELEASE,'V9.10');
 assert.equal(pages.length,2);
 assert.deepEqual(audit.map(x=>x.title),['大盤風險分析','生命線教學']);
 for(const [i,p] of pages.entries()){
  const a=audit[i];assert.equal(p.width,1284);assert.equal(p.height,2778);assert.equal(a.pages,2);
  assert.equal(a.instrumentType,'TAIEX');assert.equal(a.unit,'點');assert.equal(a.sourceVerified,true);
  assert.match(p.filename,/^石頭少爺_V9\.10_TAIEX_20261113_P0[12]_/);
  assert.equal(a.model.line,43741.54);assert.equal(a.model.close,43675.12);
  assert.equal(a.model.state,'BREAKOUT_FAILED');assert.deepEqual(a.model.markers.map(x=>x.label),['K3','K2','K1','K0']);
  assert.equal(a.marketRisk.activeScenario,a.marketRisk.scenarios.find(x=>x.active).id);
  assert.equal(a.marketRisk.risk.performanceValidated,false);
  assert.equal(a.volumeConfirmationAllowed,false);
  assert.equal(a.affectsEligibility,false);assert.equal(a.affectsRanking,false);
 }
});
test('no stock, unverified source or missing completed market bars can render',()=>{
 assert.throws(()=>Visual.build({...study,code:'2330'},{document:doc}),/加權指數|允許/);
 assert.throws(()=>Visual.build({...study,sourceVerified:false},{document:doc}),/核對|確認/);
 assert.throws(()=>Visual.build({...study,validatedBars:[]},{document:doc}),/日 K|不足/);
});
test('risk is a separate auditable research object and outcome is not future prediction',()=>{
 const r=Risk.evaluate(study),o=Outcome.snapshot(r);
 assert.equal(r.life.state,study.lifecycleState);
 assert.equal(r.rawEventId,study.event.eventId);
 assert.equal(o.studyDate,'2026-11-13');
 assert.equal(Outcome.compare(o,null).status,'PENDING');
});
