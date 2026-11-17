'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Core=require('../../kline-life-03-core-v1.js');
const Report=require('../../kline-life-03-report-v1.js');
const F=require('../../four-models-research-v1.js');
const StockIntel=require('../../life-line-intelligence-v913.js');
const StockPoster=require('../../life-line-visual-v913.js');
const Market=require('../../market-life-report-v96.js');
const Risk=require('../../market-life-risk-v913.js');
const MarketPoster=require('../../market-life-visual-v913.js');
const s16=require('../../data/research/2026-11-16/5013.json');
const s17=require('../../data/research/2026-11-17/5013.json');
const taiex=require('../../data/index/TAIEX.json');
const buildStock=raw=>Report.inspect(Core.withSource(F.evaluate(raw),raw));
const mock={createElement:()=>({})};

test('V9.13 11/16 real strong-new snapshot must retain immutable bull K3 56.20',()=>{
 const s=buildStock(s16);
 assert.equal(s.date,'2026-11-16');
 assert.equal(s.close,60.6);
 const e=s.events.find(e=>e.k3Date==='2026-11-02'&&e.k0Date==='2026-11-05'&&e.side==='BULL');
 assert.ok(e,'Missing original support event');
 assert.equal(e.lifeLinePrice,56.2);
 assert.equal(s16.dailySeries.find(b=>b.date===e.k3Date).low,56.2);
 const x=StockIntel.evaluate(s,{securityMarket:s16.market});
 assert.equal(x.date,'2026-11-16');
 assert.ok(!x.selectedPrimaryEvent?.eventId.includes('2026-11-17'));
 assert.equal(x.marketVerified,false);
});

test('V9.13 11/17 actual 70.90 is new bearish pressure, not a rewrite of the 56.20 history',()=>{
 const before=JSON.stringify(s17),s=buildStock(s17),i=StockIntel.evaluate(s,{securityMarket:s17.market});
 assert.equal(s.close,66.6);
 assert.equal(i.lifeStatus,'空方壓力K0剛成立');
 assert.equal(i.selectedPrimaryEvent.side,'BEAR');
 assert.equal(i.selectedPrimaryEvent.k3Date,'2026-11-12');
 assert.equal(i.selectedPrimaryEvent.k0Date,'2026-11-17');
 assert.equal(i.selectedPrimaryEvent.lifeLinePrice,70.9);
 assert.ok(s.events.some(e=>e.k3Date==='2026-11-02'&&e.side==='BULL'&&e.lifeLinePrice===56.2));
 assert.ok(s.close<i.selectedPrimaryEvent.lifeLinePrice);
 assert.equal(i.priceTrend,'偏強觀察');
 assert.equal(i.scenarios.length,3);
 assert.equal(JSON.stringify(s17),before);
 assert.equal(i.marketVerified,false,'TPEX stock must never borrow TAIEX context');
});

test('V9.13 historical K3 OHLC labels and event prices agree with source bars',()=>{
 const s=buildStock(s17);
 for(const e of s.events){
  const k3=s.validatedBars.find(b=>b.date===e.k3Date);
  assert.ok(k3,'K3 missing '+e.k3Date);
  assert.equal(e.lifeLinePrice,e.side==='BULL'?k3.low:k3.high);
 }
 assert.equal(s17.dailySeries.find(b=>b.date==='2026-11-02').high,60.6);
 assert.equal(s17.dailySeries.find(b=>b.date==='2026-11-03').high,66.6);
 assert.equal(s17.dailySeries.find(b=>b.date==='2026-11-12').high,70.9);
});

test('V9.13 stock reports preserve 1284x2778 pages and original K3 source',()=>{
 const s=buildStock(s17),pages=StockPoster.build(s,{document:mock,source:s17});
 assert.equal(StockPoster.RELEASE,'V9.13');
 assert.equal(pages.length,2);
 for(const p of pages){
  const a=JSON.parse(p.dataset.life98Audit);
  assert.equal(p.width,1284);assert.equal(p.height,2778);
  assert.equal(a.model.close,66.6);
  assert.equal(a.model.life913.selectedPrimaryEvent.lifeLinePrice,70.9);
  assert.equal(a.affectsEligibility,false);
  assert.ok(p.filename.includes('V9.13'));
 }
});
test('V9.13 market risk does not erase multi-session weakness when one-day drop is smaller',()=>{
 const s=Market.evaluate(taiex,{now:new Date('2026-11-17T09:00:00Z')});
 assert.equal(s.sourceVerified,true,s.reason);
 assert.equal(s.close,40092.11);
 const r=Risk.evaluate(s);
 assert.equal(r.date,'2026-11-17');
 assert.equal(r.metrics.ma5,42431.27);
 assert.equal(r.metrics.ma20,43986.95);
 assert.ok(r.risk.level>=3);
 assert.ok(['ACTIVE_SHOCK','POST_SHOCK_WEAKNESS'].includes(r.phase.state),r.phase.state);
 assert.equal(r.performanceValidated,false);
 assert.ok(r.phase.weakClosesBelow20>=1);
 const pages=MarketPoster.build(s,{document:mock});
 assert.equal(MarketPoster.RELEASE,'V9.13');assert.equal(pages.length,2);
 for(const p of pages){const x=JSON.parse(p.dataset.marketLifeAudit);assert.equal(x.marketRisk.phase.state,r.phase.state);assert.equal(x.unit,'點');assert.equal(p.width,1284);assert.equal(p.height,2778);}
});
test('V9.13 actual front-end wiring must use new renderers, not legacy V9.8 / V9.10',()=>{
 const s=fs.readFileSync('research-integration-v1.js','utf8'),m=fs.readFileSync('market-life-ui-v96.js','utf8');
 assert.ok(s.includes('ShitouLifeVisual913.build'));assert.ok(m.includes('ShitouMarketLifeVisual913.build'));
 assert.ok(s.includes('life-line-intelligence-v913.js'));
 assert.ok(m.includes('market-life-risk-v913.js'));
});
