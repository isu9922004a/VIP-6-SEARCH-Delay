'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const U=require('../../research-common-v1.js'),C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js');
const {bars,report}=require('../research-fixtures.cjs');
function example(){const b=bars(160,()=>178);b[125].high=201;b[153].high=187;b[158]={...b[158],open:181,low:180,high:184,close:183,volume:201000};b[159]={...b[159],open:184,low:183.5,high:192.5,close:189,volume:643000};return b;}
test('generic 187/201 layered breakout, independent B verification and risk arithmetic',()=>{
 const b=example(),a=C.evaluate(report(b,{originalB:201})),c=a.tradeContext;
 assert.equal(c.recent,187);assert.equal(c.prior60,201);assert.equal(c.breakout.status,'INITIAL_CLOSE');assert.equal(c.originalBStatus,'UNVERIFIED');
 assert.equal(c.volumeRatioPrevious,643/201);assert.ok(c.cautions.some(x=>x.includes('RSI5')));assert.ok(c.cautions.some(x=>x.includes('上影')));
 const numeric=U.tradeContext(b,{...a.features,ma:{...a.features.ma,20:{value:179,distance:(189/179-1)*100}}},{originalB:201,originalBVerified:true},174);
 assert.equal(numeric.originalBStatus,'NOT_BROKEN');assert.equal(numeric.rewardRisk.ratio,.8);
 assert.equal(numeric.scenarios.find(x=>x.price===192.5).changePct.toFixed(2),'1.85');
 assert.equal(numeric.scenarios.find(x=>x.price===174).changePct.toFixed(2),'-7.94');
 assert.match(R.text(a),/尚未突破參考價/);assert.match(R.text(a),/非交易停損/);
 // No ticker-specific branch; equivalent scale and identity retain the diagnosis.
 const scaled=b.map(x=>({...x,open:x.open*2,high:x.high*2,low:x.low*2,close:x.close*2}));
 const other=C.evaluate(report(scaled,{stock:'9002',name:'其他合成股',originalB:402}));
 assert.equal(other.tradeContext.breakout.status,c.breakout.status);assert.equal(other.tradeContext.recent,374);
 assert.equal(other.tradeContext.rewardRisk.ratio,c.rewardRisk.ratio);
});
test('breakout hold uses the original fixed pressure, detects failure and never future bars',()=>{
 const b=example(),base=U.tradeContext(b,U.features(b),{},174);assert.equal(base.breakout.status,'INITIAL_CLOSE');
 const next={...b.at(-1),date:'2025-08-18',open:189,low:188,close:190,high:191};
 const held=[...b,next],c=U.tradeContext(held,U.features(held),{},174);assert.equal(c.breakout.status,'HELD_CLOSES');assert.equal(c.breakout.price,187);assert.equal(c.breakout.heldSessions,2);
 const fail=[...b,{...next,low:185,close:186}];assert.equal(U.tradeContext(fail,U.features(fail),{},174).breakout.status,'FAILED');
 assert.deepEqual(U.tradeContext(b,U.features(b),{},174),base);
});
test('intraday-only breakout, missing B, missing history and invalid OHLC do not invent confirmation',()=>{
 const b=example();b.at(-1).close=186;const c=U.tradeContext(b,U.features(b),{},174);
 assert.equal(c.breakout.status,'INTRADAY_REJECTED');assert.equal(c.originalBStatus,'UNAVAILABLE');
 const short=bars(10),a=C.evaluate(report(short));assert.equal(a.tradeContext.recent,null);assert.equal(a.tradeContext.rewardRisk.ratio,null);
 const bad=C.evaluate({stock:'9002',market:'TWSE'});assert.equal(bad.tradeContext,undefined);assert.match(R.text(bad),/待核驗/);
});
test('volume discrepancy and missing timestamps remain explicit across all presentation entrances',()=>{
 const r=report(example(),{dailyBasisV2:{sourceVolumeWarning:true,sourceVolume:643000,snapshotVolume:614000,volumeBasis:'來源成交量範圍待核'}}),a=C.evaluate(r);
 assert.equal(a.tradeContext.provenance.volumeQualification,'REVIEW_REQUIRED');assert.equal(a.tradeContext.provenance.retrievedAt,null);
 assert.match(R.text(a),/量差異待複核/);assert.match(R.text(a),/非全部驗證/);
 for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B'])assert.deepEqual(R.view(C.evaluate({code:r.stock,report:r,kind})),R.view(a));
});
