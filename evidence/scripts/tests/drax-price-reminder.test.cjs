'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../../drax-price-reminder-v1.js'),C=require('../../four-models-research-v1.js'),F=require('../research-fixtures.cjs');
function sample(code='6690',scale=1){const b=F.bars(160,()=>178);b[125].high=201;b[153].high=187;b[158]={...b[158],high:184,close:183,low:177};b[159]={...b[159],open:184,high:192.5,low:183.5,close:189};return C.evaluate(F.report(b.map(x=>({...x,open:x.open*scale,high:x.high*scale,low:x.low*scale,close:x.close*scale})),{stock:code,name:'合成測試股',originalB:201*scale}));}
test('reminders follow the queried stock short pressure and breakthrough support without changing research',()=>{
 for(const [code,scale] of [['6690',1],['4939',.5],['9003',2]]){const a=sample(code,scale),before=JSON.stringify(a),m=D.build(a);assert.equal(m.code,code);assert.equal(m.rows[0].value,192.5*scale);assert.equal(m.rows[1].value,187*scale);assert.equal(m.rows[2].value,5);assert.equal(m.rows[3].value,5);assert.ok(m.rows.every(r=>!r.enabled));assert.equal(D.validate(m),null);assert.equal(JSON.stringify(a),before);}
});
test('unbroken stocks use their own daily low; unverified B reference is not silently used',()=>{
 const a=structuredClone(sample()),z=a.sourceBars.at(-1);z.close=186;a.tradeContext.breakout.price=187;a.tradeContext.pressures=[{kind:'原策略B參考（待核驗）',price:186.5},{kind:'當日高點短壓',price:192.5}];
 const m=D.build(a);assert.equal(m.rows[0].value,192.5);assert.equal(m.rows[1].value,183.5);assert.equal(m.rows[1].basis,'當日低點');
});
test('invalid query does not invent prices and activated blank / bad values are rejected',()=>{
 const m=D.build(C.evaluate({stock:'9002',market:'TWSE'}));assert.equal(m.rows[0].value,null);assert.equal(m.rows[1].value,null);assert.equal(D.validate(m),null);
 m.rows[0].enabled=true;assert.match(D.validate(m),/先填入/);m.rows[0].value=-1;assert.match(D.validate(m),/大於0/);m.rows[0].value=25.123;assert.match(D.validate(m),/兩位/);m.rows[0].value=25.5;m.rows[2].value=101;assert.match(D.validate(m),/100%/);
});
