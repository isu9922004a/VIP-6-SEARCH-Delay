'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js');
const {report,bars}=require('../research-fixtures.cjs');
const titles=['現在方向與資料狀態','多方｜什麼價格考慮買？','多單｜跌到哪裡要停損？','空方｜跌破價與回補停損','開盤後怎麼判斷？'];
function example(code='6690',scale=1){const b=bars(160,()=>178);b[125].high=201;b[153].high=187;b[158]={...b[158],open:181,low:180,high:184,close:183,volume:201000};b[159]={...b[159],open:184,low:183.5,high:192.5,close:189,volume:643000};return report(b.map(x=>({...x,open:x.open*scale,high:x.high*scale,low:x.low*scale,close:x.close*scale})),{stock:code,name:code==='6690'?'安碁資訊':'合成測試股',originalB:201*scale});}
test('reference guide preserves five sections and conditional R18 scenario evidence',()=>{
 const a=C.evaluate(example()),before=JSON.stringify(a),v=R.view(a),text=v.summary.map(x=>x.value).join('\n');
 assert.deepEqual(v.summary.map(x=>x.title),titles);assert.equal(a.beginner,undefined);
 assert.equal(a.tradeContext.recent,187);assert.equal(a.tradeContext.prior60,201);
 assert.match(v.summary[1].value,/192.5 元.*守穩/);
 assert.match(v.summary[2].value,/201 元/);
 assert.match(v.summary[2].value,/停損試算/);assert.match(v.guideNote,/不是已確認支撐/);
 assert.equal(a.openingPlan.entryRange,null);assert.equal(a.openingPlan.candidateEntry,193);assert.equal(a.openingPlan.stop,183);assert.ok(a.openingPlan.maximumEntry<193);
 assert.doesNotMatch(v.summary[0].value,/🟢/);assert.match(v.summary[4].value,/先等|不急著買/);assert.match(v.guideNote,/未驗證績效/);
 assert.match(v.details.find(x=>x.title==='追價風險檢查').value,/RSI5/);assert.match(v.details.find(x=>x.title==='原策略價位').value,/201.00.*來源待核/);
 assert.equal(JSON.stringify(a),before);assert.ok(v.details.some(x=>x.title==='研究A/B'));
});
test('all ticker identities use their own scaled prices, no fixed example text',()=>{
 for(const [code,scale] of [['9001',.5],['9002',2],['9003',10]]){
  const a=C.evaluate(example(code,scale)),v=R.view(a),text=v.summary.map(x=>x.value).join('\n');
  assert.match(v.summary[1].value,new RegExp(String(192.5*scale)+' 元'));
  assert.equal(a.openingPlan.watch,192.5*scale);assert.ok(v.summary[2].value.includes(String(201*scale)+' 元'));
  assert.equal(a.sourceBars.at(-1).low,183.5*scale);assert.doesNotMatch(text,/已確認支撐為當日低點/);
  assert.equal(v.code,code);assert.doesNotMatch(text,/安碁資訊|6690/);
  for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B'])assert.deepEqual(R.view(C.evaluate({code,report:example(code,scale),kind})),v);
 }
});
test('weak, unbroken, invalid, disabled and short-history stocks retain the format without false buying claims',()=>{
 const weak=bars(160,i=>200-i/2),a=C.evaluate(report(weak));assert.match(R.view(a).summary[0].value,/短線偏弱/);assert.match(R.view(a).summary[4].value,/守穩轉強/);assert.doesNotMatch(R.view(a).summary[4].value,/短線偏強/);
 for(const x of [C.evaluate(report(bars(160))),C.evaluate(report(bars(10))),C.evaluate({stock:'9001',market:'TWSE'}),C.evaluate(example(),{flags:{fourModelsEnabled:false}})]){
  const v=R.view(x);assert.deepEqual(v.summary.map(f=>f.title),titles);assert.doesNotMatch(v.summary.map(f=>f.value).join(''),/資料不足|— 元|undefined|NaN|買進訊號已確認/);
 }
});
test('volume conflicts remain visible and missing upper levels do not become targets',()=>{
 const a=C.evaluate(example()),c=structuredClone(a);c.tradeContext.provenance.volumeConflict=true;
 assert.match(R.view(c).summary[0].value,/成交量有差/);assert.doesNotMatch(R.view(c).summary[0].value,/🟢/);
 const b=bars(160,()=>100);b.at(-1).close=110;b.at(-1).high=110;const high=C.evaluate(report(b,{originalB:999}));
 assert.match(R.view(high).summary[2].value,/上方歷史關卡不足/);assert.doesNotMatch(R.view(high).summary[3].value,/999|一定會漲到 \d/);
});
module.exports={example};

