'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Market=require('../../market-life-report-v96.js');
const Visual=require('../../market-life-visual-v98.js');
const Stock=require('../../life-line-visual-v98.js');
const raw=require('../../data/index/TAIEX.json');
const now=new Date('2026-11-14T08:00:00Z');
const doc={createElement:()=>({})};
const study=Market.evaluate(raw,{now});
const inspect=(s=study)=>Visual.build(s,{document:doc}).map(p=>JSON.parse(p.dataset.marketLifeAudit));
test('V9.9 market report shares stock two-page layout and preserves original index model',()=>{
 const before=JSON.stringify(study),pages=Visual.build(study,{document:doc}),audit=pages.map(p=>JSON.parse(p.dataset.marketLifeAudit));
 assert.equal(Visual.RELEASE,Stock.RELEASE);
 assert.equal(JSON.stringify(study),before);
 assert.equal(pages.length,2);
 assert.deepEqual(audit.map(a=>a.title),['大盤分析','生命線形成教學']);
 for(const [i,p] of pages.entries()){
  const a=audit[i];
  assert.equal(p.width,1284);assert.equal(p.height,2778);assert.equal(a.pages,2);
  assert.equal(a.instrumentType,'TAIEX');assert.equal(a.unit,'點');assert.equal(a.sourceVerified,true);
  assert.match(p.filename,/石頭少爺_V9.9_TAIEX_20261113_P0[12]_/);
  assert.equal(a.model.close,43675.12);assert.equal(a.model.line,43741.54);
  assert.equal(a.model.date,'2026-11-13');assert.equal(a.model.code,'TAIEX');
  assert.equal(a.model.state,'BREAKOUT_FAILED');
  assert.equal(a.model.volume.verified,false);
  assert.equal(a.volumeConfirmationAllowed,false);
  assert.equal(a.model.chartBarDates.length,30);
  assert.deepEqual(a.model.markers.map(x=>x.label),['K3','K2','K1','K0']);
  assert.equal(a.reportOnly,true);assert.equal(a.affectsEligibility,false);assert.equal(a.affectsRanking,false);
 }
});
test('market copy uses index points and exchange turnover, not stock trading language',()=>{
 assert.match(Visual.convert('個股收盤 143.50 元，股價仍須觀察；追價風險'),/大盤收盤 143.50 點，指數仍須觀察；短線過熱風險/);
 assert.doesNotMatch(Visual.convert('最高價、最低價、成交量、主力真實持股成本'),/最高價|最低價|成交量|主力真實持股成本/);
 assert.equal(inspect()[0].marketVolumeMeaning,'集中市場成交股數');
});
test('visual refuses stock identity, unverified index, and empty completed history',()=>{
 assert.throws(()=>inspect({...study,code:'2330'}),/加權指數|個股|核對/);
 assert.throws(()=>inspect({...study,sourceVerified:false}),/核對/);
 assert.throws(()=>inspect({...study,validatedBars:[]}),/不足/);
});
test('V9.6 market engine and stock V9.9 visual remain separate modules',()=>{
 const report=require('../../market-life-report-v96.js');
 assert.equal(report.VERSION,'MARKET_LIFE_REPORT_V96');
 assert.equal(typeof Stock.build,'function');
 assert.equal(typeof Visual.build,'function');
});
