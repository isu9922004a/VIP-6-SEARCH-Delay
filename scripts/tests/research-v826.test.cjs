'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const E=require('../../research-entry-direction-v1.js'),C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js'),Q=require('../../stock-query-runtime-v826.js'),{bars,report}=require('../research-fixtures.cjs');
const approved={state:'RESEARCH_ONLY',entryDecision:'CONDITIONAL_ENTRY',scenarios:[{id:'BREAKOUT',applicable:true,signalStatus:'CONFIRMED',riskDecision:'ACCEPTABLE_FOR_EVALUATION',riskReward:{status:'KNOWN',rr:2}}]};
const calm=()=>bars(160,i=>100+i*.05+Math.sin(i*1.4));
test('a calm bullish setup can pass, while an overheated nominal setup must wait',()=>{
 const a=E.evaluate(report(calm()),{unified:approved});assert.equal(a.direction.code,'BULL');assert.equal(a.entry,'EVALUATE');
 const b=E.evaluate(report(bars(160,i=>100+i*.1)),{unified:approved});assert.equal(b.entry,'WAIT');assert.ok(b.cautions.some(x=>x.includes('強弱值')));
});
test('intraday rejection and an unfinished retest never become entry-ready',()=>{
 const b=calm();b.at(-1).high=130;const a=E.evaluate(report(b),{unified:approved});assert.equal(a.entry,'WAIT');assert.ok(a.signals.some(x=>x.code==='INTRADAY_REJECTION'));
});
test('bull/bear review filters partition direction without changing rankings',()=>{
 const a=['BULL','PULLBACK','BEAR','REBOUND','SIDEWAYS'].map((code,i)=>({score:50+i,entryDirection:{direction:{code},entry:'WAIT'}})),before=JSON.stringify(a);
 assert.deepEqual(E.select(a,'BULL').map(x=>x.index),[0,1]);assert.deepEqual(E.select(a,'BEAR').map(x=>x.index),[2,3]);assert.equal(E.select(a,'ALL').length,5);assert.equal(JSON.stringify(a),before);
});
test('every model condition and real parameter is translated in the shared stock report',()=>{
 const a=C.evaluate(report(calm())),v=R.view(a),text=R.text(a);assert.ok(v.details.some(x=>x.title==='四策略每個條件為什麼通過或沒通過'));
 for(const x of ['20日均價','1000張','不是上漲機率','主力買進需要外部來源','進場濾網與成本參數','這檔的進場步驟'])assert.ok(text.includes(x),x);
 assert.doesNotMatch(text,/undefined|NaN/);
});
test('unresolved optional work has a deadline and does not block the next call',async()=>{
 await assert.rejects(Q.deadline(()=>new Promise(()=>{}),5,'逾時'),/逾時/);assert.equal(await Q.deadline(()=>42,50),42);
});
test('directory timeout aborts fetch and successful JSON remains usable',async()=>{
 const original=global.fetch;let signal;
 try{global.fetch=async(_,options)=>{signal=options.signal;return new Promise(()=>{});};await assert.rejects(Q.json('https://example.invalid',5),/名稱資料/);assert.equal(signal.aborted,true);global.fetch=async()=>({ok:true,json:async()=>[{code:'2330'}]});assert.deepEqual(await Q.json('https://example.invalid',20),[{code:'2330'}]);}finally{global.fetch=original;}
});
test('a stalled market loader cannot delay entering the original stock lookup',async()=>{
 const original=fs.readFileSync(require.resolve('../../tower-integration.js'),'utf8');assert.doesNotMatch(original,/wrap\('analyzeStock'[\s\S]*?await root\.loadDayTradeMarketBundle/);
});
