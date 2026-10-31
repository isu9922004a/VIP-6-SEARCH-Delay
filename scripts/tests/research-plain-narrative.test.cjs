'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../four-models-research-v1.js'),O=require('../../research-opening-plan-v1.js'),R=require('../../research-report-v1.js');
const fixture=require('../fixtures/plain-narrative-20261030.json'),{report}=require('../research-fixtures.cjs');
function actual(code='8039'){const r=fixture.records[code];return C.evaluate(report(structuredClone(r.bars),{stock:r.stock,name:r.name,market:r.market}));}
const clone=x=>structuredClone(x);
test('weak-price summary uses the actual daily average and preserves a small slope as a small move',()=>{
 const a=actual(),v=R.view(a);assert.match(v.summary[0].value,/收盤245 元.*低於最近20天平均287.8 元/);assert.match(v.summary[0].value,/略往下/);assert.doesNotMatch(v.summary[0].value,/大幅|MA20|14.87%/);
 assert.match(v.details.find(x=>x.title==='現在的股價，用白話怎麼看').value,/14.87%.*3個交易日前減少0.09%/);
});
test('yesterday volume and prior-five-session mean remain distinct and do not imply a washout',()=>{
 const a=actual(),x=O.plainContext(a);assert.match(x.volumeShort,/昨天少約13%.*收盤仍近低點/);assert.match(x.volumeDetail,/昨天少13.19%.*前5天平均的0.47倍.*不含今天/);assert.match(x.volumeDetail,/不能直接確認洗盤或出貨/);
 const v=R.view(a);assert.match(v.summary[1].value,/253 元[\s\S]*未站回/);assert.equal(a.openingPlan.entryRange,null);assert.doesNotMatch(v.summary.map(x=>x.value).join(''),/洗盤完成|主力買進|即將大漲/);
});
test('rising-average pullbacks and strong closes do not inherit the weak-close wording',()=>{
 const a=clone(actual());a.features.ma[20].slope=.3;assert.match(O.plainContext(a).direction,/平均價仍往上，但股價還沒站回/);
 const strong=actual('7704'),v=R.view(strong);assert.match(O.plainContext(strong).volumeShort,/多約126%.*接近高點/);assert.doesNotMatch(v.summary[1].value,/站回/);assert.doesNotMatch(v.summary[4].value,/站回/);assert.doesNotMatch(v.summary[0].value,/🟢/);
});
test('unverified or conflicting volume cannot acquire a numerical volume story',()=>{
 for(const status of ['UNKNOWN','CONFLICT']){const a=clone(actual());a.unifiedResearch.structureContext.volume={...a.unifiedResearch.structureContext.volume,status,usable:false};const x=O.plainContext(a);assert.equal(x.volumeVerified,false);assert.doesNotMatch(x.volumeShort+x.volumeDetail,/13%|0.47倍|量縮|主力買進/);assert.match(x.volumeDetail,/尚未|對齊/);}
});
test('missing or mismatched price data cannot become a factual price narrative',()=>{
 const a=clone(actual());a.features.ma[20]={value:null,slope:null};assert.equal(O.plainContext(a).direction,'');a.validation.technicalModelAvailable=false;assert.equal(O.plainContext(a),null);a.validation.technicalModelAvailable=true;a.date='2026-10-29';assert.equal(O.plainContext(a),null);
});
test('unverified history keeps the data-first summary despite a computable trend',()=>{
 const a=clone(actual());a.unifiedResearch.chart.basisVerified=false;a.openingPlan=O.evaluate(a);const v=R.view(a);assert.equal(a.openingPlan.state,'DATA');assert.match(v.summary[0].value,/先不下單/);assert.doesNotMatch(v.summary[0].value,/最近20天平均/);assert.doesNotMatch(v.summary[4].value,/昨天少約13%/);
});
test('presentation leaves the analysis, plan, states, prices and original summary fields untouched',()=>{
 const a=actual(),before=JSON.stringify(a),prior=Array.from({length:5},(_,i)=>({title:String(i),value:'old'})),original=JSON.stringify(prior);O.summary(a.openingPlan,prior,a);R.view(a);assert.equal(JSON.stringify(a),before);assert.equal(JSON.stringify(prior),original);assert.equal(R.view(a).summary.length,6);
});
