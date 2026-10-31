'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js'),U=require('../../research-common-v1.js');
const {bars,report}=require('../research-fixtures.cjs');
const recorded=require('../fixtures/research-source-r17-8039.json');
const text=a=>R.view(a).summary.map(x=>x.value).join('\n');
function replay(fallback){return C.evaluate(report(structuredClone(recorded.daily.results[0].data.dailySeries),{stock:'8039',name:'台虹',priceAdjustment:{verified:false,basis:'UNKNOWN'},expectedTradingDates:undefined,tradingCalendar:{verified:false},originalB:331.5}),{flags:{unifiedResearchEnabled:!fallback}});}
test('recorded 8039 OHLCV has the same ordered nearby references in normal and disabled-unified modes',()=>{
 for(const fallback of [false,true]){
  const a=replay(fallback),before=JSON.stringify(a),g=R.guideContext(a),v=R.view(a);
  assert.deepEqual(g.upper.slice(0,5).map(x=>+x.price.toFixed(2)),[274.12,275,276.5,285.5,288.85]);
  assert.equal(a.openingPlan.state,'DATA');assert.match(v.summary[1].value,/暫不列買價/);assert.match(v.details.find(x=>x.title==='關卡順序與來源').value,/274.12/);assert.doesNotMatch(v.summary[1].value,/331.5|先等價格重新站穩 MA20/);
  assert.match(a.openingPlan.volumeText,/前5天平均的 0.36 倍/);assert.equal(g.baseline5,49423231.8);
  assert.ok(Math.abs(g.ratioPrevious-.7283391832384756)<1e-12);assert.equal(JSON.stringify(a),before);
  assert.ok(v.details.some(x=>x.title==='關卡順序與來源'));assert.ok(v.details.some(x=>x.title==='研究模式與邊界'));
  assert.doesNotMatch(text(a),/🟢/);
 }
});
test('stock below a rising MA20 is described separately from a declining moving average',()=>{
 for(const fallback of [false,true]){const a=replay(fallback),g=R.guideContext(a),m=g.averages.find(x=>x.period===20);assert.equal(m.position,'BELOW');assert.ok(m.slope>0);
  assert.equal(m.previous,288.05);assert.equal(m.value,288.85);assert.match(R.view(a).details.find(x=>x.title==='多空位置與均線方向').value,/低於MA20 288.85；該線較前一交易日上升/);}
});
test('opening above prior close without a full-range gap is not labelled a breakout gap',()=>{
 const a=replay(true),g=R.guideContext(a);assert.ok(g.openingAboveClose);assert.equal(g.fullRangeGap,false);
 assert.match(R.view(a).details.find(x=>x.title==='動能與反轉確認').value,/區間重疊，不稱全區間突破缺口/);
 assert.match(R.view(a).details.find(x=>x.title==='風險觀察與支撐確認').value,/259.00.*253.00.*不因低點出現就認定支撐/);
});
test('volume baselines exclude current day and include real missing-history guards',()=>{
 const b=bars(80);b.at(-1).volume=9e6;const a=C.evaluate(report(b),{flags:{unifiedResearchEnabled:false}}),g=R.guideContext(a);
 assert.equal(g.baseline5,1500000);assert.equal(g.ratio5,6);assert.equal(g.baseline20,1500000);
 const short={...a,sourceBars:b.slice(-3),reportBars:b.slice(-3)};assert.equal(R.guideContext(short).baseline5,null);assert.equal(R.guideContext(short).ratio5,null);
});
test('disabled-unified mode never grants a green entry or silently enables the saved flag',()=>{
 const a=replay(true),before=JSON.stringify(a);assert.equal(a.flags.unifiedResearchEnabled,false);assert.equal(a.unifiedResearch.state,'DISABLED');
 assert.doesNotMatch(text(a),/🟢|條件可供評估/);assert.match(R.view(a).details.find(x=>x.title==='研究模式與邊界').value,/未啟用/);
 assert.equal(JSON.stringify(a),before);
});
test('unknown strategy B is retained as a reference without becoming a fabricated upper target',()=>{
 const b=bars(160,()=>100);b[b.length-1]={...b.at(-1),open:105,high:110,low:104,close:110};
 for(const enabled of [true,false]){const a=C.evaluate(report(b,{originalB:999}),{flags:{unifiedResearchEnabled:enabled}}),g=R.guideContext(a);
  assert.deepEqual(g.upper,[]);assert.match(R.view(a).summary[2].value,/上方歷史關卡不足/);assert.doesNotMatch(R.view(a).summary[3].value,/999/);
  assert.match(R.view(a).details.find(x=>x.title==='原策略價位').value,/999.00.*來源待核/);}
});
test('TWSE and TPEX prices from sub-ten to high-priced shares preserve monotonic references in both modes',()=>{
 for(const market of ['TWSE','TPEX'])for(const scale of [.03,.2,1,5,25])for(const enabled of [true,false]){
  const b=bars(90,i=>i<75?120:110);b[b.length-1]={...b.at(-1),open:104,low:103,high:113,close:112};
  const scaled=b.map(x=>({...x,open:x.open*scale,high:x.high*scale,low:x.low*scale,close:x.close*scale}));
  const a=C.evaluate(report(scaled,{market}),{flags:{unifiedResearchEnabled:enabled}}),g=R.guideContext(a);
  assert.ok(g.upper.every((x,i)=>x.price>a.sourceBars.at(-1).close&&(!i||x.price>g.upper[i-1].price)));
  assert.equal(R.view(a).summary.length,5);assert.doesNotMatch(text(a),/NaN|undefined|— 元/);
 }
});
test('every supplied market ticker and quote price uses the shared presentation invariants (synthetic history)',()=>{
 const snapshot=require('../../data/market/latest.json'),seed=C.evaluate(report(bars(80,i=>i<65?120:110)),{flags:{unifiedResearchEnabled:false}}),markets=new Set();
 let count=0;
 for(const q of snapshot.rows){if(!(q.close>0))continue;markets.add(q.market.toUpperCase());const factor=q.close/110;
  const b=seed.reportBars.map(x=>({...x,open:x.open*factor,high:x.high*factor,low:x.low*factor,close:x.close*factor})),f=U.features(b);
  const a={...seed,code:q.code,name:q.name,sourceBars:b.slice(-20),reportBars:b,features:f,tradeContext:U.tradeContext(b,f,{},null)},before=JSON.stringify(a),g=R.guideContext(a),v=R.entryGuide(a);
  assert.ok(g.upper.every((x,i)=>x.price>b.at(-1).close&&(!i||x.price>g.upper[i-1].price)),q.code);
  assert.equal(v.fields.length,5,q.code);assert.doesNotMatch(v.fields.map(x=>x.value).join(''),/NaN|undefined|— 元|🟢/,q.code);
  assert.equal(JSON.stringify(a),before,q.code);count++;
 }
 assert.equal(count,snapshot.rows.filter(x=>x.close>0).length);assert.ok(count>1900);assert.ok(markets.has('TWSE')&&markets.has('TPEX'));
});

