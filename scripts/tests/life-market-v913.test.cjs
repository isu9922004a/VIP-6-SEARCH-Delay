'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../../four-models-research-v1.js');
const Core=require('../../kline-life-03-core-v1.js');
const Report=require('../../kline-life-03-report-v1.js');
const Info=require('../../life-line-intelligence-v913.js');
const StockPoster=require('../../life-line-visual-v913.js');
const Market=require('../../market-life-report-v96.js');
const Risk=require('../../market-life-risk-v913.js');
const MarketPoster=require('../../market-life-visual-v913.js');
const oldRaw=require('../../data/research/2026-11-16/5013.json');
const newRaw=require('../../data/research/2026-11-17/5013.json');
const index=require('../../data/index/TAIEX.json');
const study=raw=>Report.inspect(Core.withSource(F.evaluate(raw),raw));
const prior=study(oldRaw),today=study(newRaw);
const mock={createElement:()=>({})};
test('V9.14 preserves original 56.20 bull K3 event across snapshots',()=>{
 const x=Info.evaluate(prior,{securityMarket:'TPEX'}),y=Info.evaluate(today,{securityMarket:'TPEX'});
 const old=x.historicalReferenceEvents.concat(prior.events).find(e=>e.k3Date==='2026-11-02'&&e.k0Date==='2026-11-05'&&e.lifeLinePrice===56.2);
 assert.ok(old,'11/02 K3 support must remain visible in historical event set');
 assert.ok(y.historicalReferenceEvents.concat(today.events).some(e=>e.eventId===old.eventId&&e.lifeLinePrice===56.2));
 assert.equal(x.date,'2026-11-16');assert.equal(y.date,'2026-11-17');
 assert.equal(x.marketVerified,false);assert.match(y.marketStatus,/尚未核對/);
});
test('V9.14 identifies 11/17 bear K0 and does not call it a bullish breakout',()=>{
 const y=Info.evaluate(today,{securityMarket:'TPEX'});
 assert.equal(today.close,66.6);
 assert.equal(y.selectedPrimaryEvent?.lifeLinePrice,70.9);
 assert.equal(y.selectedPrimaryEvent?.k3Date,'2026-11-12');
 assert.equal(y.selectedPrimaryEvent?.k0Date,'2026-11-17');
 assert.equal(y.selectedPrimaryEvent?.side,'BEAR');
 assert.match(y.lifeStatus,/空方壓力K0剛成立/);
 assert.match(y.trendText,/尚未收盤突破/);
 assert.equal(y.priceTrend,'偏強觀察');
 assert.equal(y.affectsRanking,false);assert.equal(y.performanceValidated,false);
});
test('V9.14 refuses historical price corruption instead of displaying false K3',()=>{
 const broken=structuredClone(today);
 broken.events[0].lifeLinePrice+=0.5;
 assert.throws(()=>Info.evaluate(broken),/K3原始價格不一致/);
});
test('V9.14 stock phone report carries dual event audit and remains 1284x2778',()=>{
 const before=JSON.stringify(today);
 const pages=StockPoster.build(today,{document:mock,source:newRaw});
 assert.equal(pages.length,2);
 for(const p of pages){const a=JSON.parse(p.dataset.life98Audit);assert.equal(p.width,1284);assert.equal(p.height,2778);assert.equal(a.release,'V9.14');assert.equal(a.model.life913.lifeStatus,'空方壓力K0剛成立');}
 assert.equal(JSON.stringify(today),before);
});
test('V9.14 market completes shock-continuation analysis without altering V9.10 grades',()=>{
 const s=Market.evaluate(index,{now:new Date('2026-11-17T16:30:00+08:00')});
 assert.equal(s.close,40092.11);
 const snapshot=JSON.stringify(s),r=Risk.evaluate(s);
 assert.equal(r.date,'2026-11-17');
 assert.equal(r.sourceRiskLevel,r.risk.level);
 assert.equal(r.version,'MARKET_LIFE_RISK_V913');
 assert.ok(['ACTIVE_SHOCK','POST_SHOCK_WEAKNESS','REBOUND_ATTEMPT','NORMAL_OR_UNCONFIRMED'].includes(r.phase.state));
 assert.notEqual(r.phase.state,'RECOVERY_CONFIRMED');
 assert.ok(r.metrics.ma5>r.metrics.close&&r.metrics.ma20>r.metrics.close);
 assert.equal(JSON.stringify(s),snapshot);
 const pages=MarketPoster.build(s,{document:mock});
 assert.equal(pages.length,2);
 for(const p of pages){const a=JSON.parse(p.dataset.marketLifeAudit);assert.equal(a.release,'V9.14');assert.equal(a.marketRisk.phase.confirmedAt,'2026-11-17');}
});