'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../strategy-low-base-breakout-v929.js');
function fixture(){
 const bars=Array.from({length:61},(_,i)=>{const close=i%2===0?99:101;return {open:close,high:close+.5,low:close-.5,close,volume:i>=56?1800000:3000000};});
 bars.push({open:99,high:104.5,low:98.5,close:104,volume:6000000});
 return bars;
}
const check=(r,k)=>r.checks.find(x=>x.key===k).pass;
test('requires 62 completed bars and official turnover',()=>{
 assert.equal(C.compute(fixture().slice(1),620000000).status,'INSUFFICIENT_DATA');
 assert.equal(C.compute(fixture(),null).status,'INSUFFICIENT_DATA');
});
test('breakout fixture uses preceding volume windows and all gates',()=>{
 const x=C.compute(fixture(),620000000);
 assert.equal(x.features.vma5,1800000);
 assert.equal(x.features.vma20,2700000);
 assert.equal(x.checks.length,21);
 assert.equal(x.eligible,true,JSON.stringify(x.reasons));
});
test('5 hundred million turnover is a strict boundary',()=>{
 const x=C.compute(fixture(),500000000);
 assert.equal(check(x,'TRADE_VALUE'),false);
 assert.equal(x.eligible,false);
});
test('upper shadow and close location reject weak close',()=>{
 const b=fixture();b.at(-1).high=112;
 const x=C.compute(b,620000000);
 assert.equal(check(x,'SHADOW'),false);
 assert.equal(check(x,'CLOSE_LOCATION'),false);
 assert.equal(x.eligible,false);
});
test('exact twofold prior volume does not qualify',()=>{
 const b=fixture();b.at(-1).volume=3600000;
 const x=C.compute(b,620000000);
 assert.equal(check(x,'VOLUME_PREV'),false);
});
test('zero-range and malformed OHLCV do not qualify',()=>{
 const b=fixture();Object.assign(b.at(-1),{open:104,high:104,low:104,close:104});
 assert.equal(C.compute(b,620000000).status,'FAIL');
 b[0].volume=NaN;
 assert.equal(C.compute(b,620000000).status,'DATA_ERROR');
});
