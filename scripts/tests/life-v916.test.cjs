'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Transparency=require('../../life-risk-transparency-v916');
const MarketReport=require('../../market-life-report-v96');
const MarketRisk=require('../../market-life-risk-v913');
const MarketVisual=require('../../market-life-visual-v913');
const StockInfo=require('../../life-line-intelligence-v913');
const StockVisual=require('../../life-line-visual-v913');
const Core=require('../../kline-life-03-core-v1');
const Report=require('../../kline-life-03-report-v1');
const F=require('../../four-models-research-v1');
const indexSource=require('../fixtures/taiex-20261120-v915.json');
const stockSource=require('../../data/research/2026-11-20/8039.json');
const market=MarketReport.evaluate(indexSource,{now:new Date('2026-11-21T03:00:00Z')});
const stock=Report.inspect(Core.withSource(F.evaluate(stockSource),stockSource));
const risk=MarketRisk.evaluate(market);

test('V9.16 reproduces existing market level without changing V9.15 numbers',()=>{
 assert.equal(market.sourceVerified,true);
 assert.equal(risk.risk.level,3);
 const m=MarketVisual.model(market),intel=StockInfo.evaluate(market),obs=StockInfo.observe(m,intel,true,risk);
 const current=Transparency.market(market,risk,obs);
 assert.equal(current.sourceRiskLevel,risk.risk.level);
 assert.equal(current.date,market.date);
 assert.equal(current.close,market.close);
 assert.equal(current.type,'market');
 assert.match(current.headline,/第3級／共4級/);
 assert.match(JSON.stringify(current.sections),/第4級必須同時符合/);
 assert.match(JSON.stringify(current.sections),/14日平均波動/);
 assert.match(JSON.stringify(current.sections),/不保證降級/);
 const fake={...risk,risk:{...risk.risk,level:4}};
 assert.throws(()=>Transparency.market(market,fake,obs),/禁止輸出不一致報告/);
});
test('V9.16 stock does not invent market risk levels or change K3 and other core events',()=>{
 const before=JSON.stringify(stock.events);
 const m=StockVisual.model(stock,{source:stockSource}),i=StockInfo.evaluate(stock,{securityMarket:stockSource.market,market:risk});
 const o=StockInfo.observe(m,i,false);
 const r=Transparency.stock(stock,i,o,m,risk);
 assert.equal(r.type,'stock');
 assert.equal(r.close,stock.close);
 assert.equal(r.date,stock.date);
 assert.match(r.headline,/既有強弱模型（不是四級風險）/);
 assert.ok(!/第[1-4]級／共4級/.test(r.headline));
 assert.equal(JSON.stringify(stock.events),before);
 assert.equal(r.marketVerified,stockSource.market==='TWSE');
});
test('V9.16 market/stock linkage forbids borrowing TAIEX for a TPEX stock',()=>{
 const m=StockVisual.model(stock,{source:stockSource});
 const i=StockInfo.evaluate(stock,{securityMarket:'TPEX',market:risk});
 const r=Transparency.stock(stock,i,StockInfo.observe(m,i,false),m,risk);
 assert.equal(r.marketVerified,false);
 assert.match(JSON.stringify(r.sections),/不拿加權指數代替櫃買指數/);
});
test('V9.16 inputs must use matching completed sessions',()=>{
 const m=StockVisual.model(stock,{source:stockSource});
 const i=StockInfo.evaluate(stock,{securityMarket:stockSource.market});
 assert.throws(()=>Transparency.stock(stock,{...i,date:'2026-11-19'},StockInfo.observe(m,i,false),m,null),/資料日期不一致/);
});
