'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../../research-beginner-v1.js'),C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js');
const {bars,report}=require('../research-fixtures.cjs');
test('a measurable volume ratio cannot erase conflicting or unknown source evidence',()=>{
 for(const status of ['CONFLICT','UNKNOWN']){const v=B.volumeText({ratio5:.36,status,usable:false});assert.match(v.ratio,/36%（0.36倍）/);assert.match(v.caution,/不能確認|還沒確認/);}
 assert.doesNotMatch(B.volumeText({}).text,/0倍|0%/);
});
test('beginner reward explanations distinguish unknown, net loss and risk from success rate',()=>{
 assert.match(B.riskText({status:'UNKNOWN',rr:null}),/算不出/);
 assert.match(B.riskText({status:'BLOCKED',rr:-.001}),/沒有正的預估報酬/);
 assert.match(B.riskText({status:'KNOWN',rr:1.7}),/每承擔1元風險.*1.7元.*不是勝率/);
});
test('custom research thresholds and costs are explained from that stock rather than fixed defaults',()=>{
 const a=C.evaluate(report(bars(160,i=>100+i*.1))),before=JSON.stringify(a);
 const custom={...a,nContinuation:{...a.nContinuation,parameters:{pivotLeft:2,pivotRight:4,zoneATR:.4,volume:1.6,minRR:2,maxStopPct:6,minSpacePct:3,fee:.001,feeDiscount:.5,tax:.003,slippage:.002}}};
 const text=B.parameterFields(custom).at(-1).value;
 for(const word of ['前2天和後4天','0.4倍','1.6倍','2倍','6%','3%','0.05%','0.3%','0.2%'])assert.ok(text.includes(word),word);
 assert.equal(JSON.stringify(a),before);
});
test('all research entry points share the same stock-specific explanations without modifying source or decisions',()=>{
 for(const [code,quote] of [['2330',1200],['8039',270],['9001',15]]){
  const raw=report(bars(160,i=>quote+i*.1),{stock:code}),before=JSON.stringify(raw),a=C.evaluate(raw),v=R.view(a);
  assert.ok(v.details.some(x=>x.title==='均線與成交量怎麼看'));
  assert.match(v.details.find(x=>x.title==='N字結構與來源').value,/漲一段|日K資料不足/);
  assert.doesNotMatch(JSON.stringify(v),/undefined|NaN/);
  for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B'])assert.deepEqual(R.view(C.evaluate({code,kind,eligible:false,score:17,report:raw})),v);
  assert.equal(a.affectsOriginalRanking,false);assert.equal(JSON.stringify(raw),before);
 }
});
