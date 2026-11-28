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

test('fundamental evidence after as-of never adds points',()=>{
 const f={revenue12High:{verified:true,publishedAt:'2026-11-28',pass:true},epsAbove1:{verified:true,publishedAt:'2026-11-26',pass:true}};
 const q=C.compute(fixture(),620000000,f,'2026-11-27').quality;
 assert.equal(q.basic.revenue12High,null);
 assert.equal(q.basic.epsAbove1,true);
 assert.equal(q.basicKnown,1);
 assert.equal(q.points.fundamentals,.625);
 assert.ok(q.score>=0&&q.scoreUpper<=100&&q.scoreUpper>=q.score);
});
test('fundamentals cannot rescue hard gate failure',()=>{
 const f=Object.fromEntries(C.BASIC_KEYS.map(k=>[k,{verified:true,publishedAt:'2026-11-26',pass:true}]));
 assert.equal(C.compute(fixture(),500000000,f,'2026-11-27').eligible,false);
});
const L=require('../../strategy-low-base-lifecycle-v929.js');
function lifecycleFixture(){
 const b=fixture().map((z,i)=>({...z,date:new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10)}));
 const signal={...C.compute(b,620000000),date:b.at(-1).date};
 return {b,signal};
}
test('lifecycle cannot see future bars and validates signal identity',()=>{
 const {b,signal}=lifecycleFixture();
 assert.equal(L.track(signal,b,signal.date).state,'INITIAL');
 const next={date:'2026-10-02',open:104,high:106,low:103,close:105,volume:3000000};
 assert.equal(L.track(signal,[...b,next],signal.date).state,'UNAVAILABLE');
 assert.equal(L.track(signal,[...b,next],next.date).state,'CONFIRMED');
 assert.equal(L.track({...signal,features:{...signal.features,close:1}},b,signal.date).state,'UNAVAILABLE');
});
test('failed breakout remains failed for the tracked signal',()=>{
 const {b,signal}=lifecycleFixture();
 const next={date:'2026-10-02',open:103,high:104,low:96,close:97,volume:3000000};
 const recovery={date:'2026-10-03',open:100,high:105,low:99,close:104,volume:3000000};
 const x=L.track(signal,[...b,next,recovery],recovery.date);
 assert.equal(x.state,'FAILED');
 assert.equal(x.failureDate,next.date);
});

const S=require('../../strategy-low-base-scanner-v929.js');
test('rank by conservative quality score, never pad top eight or certify incomplete market',()=>{
 const plan={date:'2026-11-27',items:[{code:'1001'},{code:'1002'},{code:'1003'}],marketTotal:3,marketCoverageReady:true};
 const row=(code,score)=>({code,eligible:true,status:'PASS',quality:{score}});
 const x=S.finish(plan,[row('1002',71),row('1001',81),{code:'1003',status:'DATA_ERROR'}],false);
 assert.deepEqual(x.top8.map(z=>z.code),['1001','1002']);
 assert.equal(x.fullMarketCertified,false);
 assert.equal(x.zeroConfirmed,false);
});
test('missing or duplicate deep scan records cannot be treated as nonmatches',async()=>{
 const plan={date:'2026-11-27',items:[{code:'1001'},{code:'1002'}],marketTotal:2,marketCoverageReady:true};
 const x=await S.scan({plan,fetchBatch:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'1001',ok:true,data:{}},{code:'1001',ok:true,data:{}}]})});
 assert.equal(x.errors,2);
 assert.equal(x.zeroConfirmed,false);
});

test('missing data reason counts are separate from independent gate failures',()=>{
 const d=S.diagnostics([{code:'1001',status:'INSUFFICIENT_DATA',reasons:['歷史不足','歷史不足']},{code:'1002',status:'DATA_ERROR',reasons:['成交金額未核對']},{code:'1003',status:'FAIL',checks:[{key:'CROSS20',pass:false},{key:'RED',pass:true}]}]);
 assert.equal(d.unavailableByCode.length,2);
 assert.equal(d.unavailableReasons['歷史不足'],1);
 assert.deepEqual(d.gateCounts.CROSS20,{evaluated:1,pass:0,fail:1});
 assert.deepEqual(d.gateCounts.RED,{evaluated:1,pass:1,fail:0});
 assert.equal(d.statuses.FAIL,1);
});

test('follow-up volume must hold the pre-breakout five-session average',()=>{
 const {b,signal}=lifecycleFixture();
 const next={date:'2026-10-02',open:104,high:106,low:103,close:105,volume:900000};
 const x=L.track(signal,[...b,next],next.date);
 assert.equal(x.state,'WATCH');assert.equal(x.lastVolumeHealthy,false);
 assert.equal(x.volumeFloor,signal.features.vma5);
});
test('expiry is bounded to five completed trading sessions and cannot be reversed by a later fall',()=>{
 const {b,signal}=lifecycleFixture();
 const next=Array.from({length:6},(_,i)=>({date:'2026-10-'+String(i+2).padStart(2,'0'),open:104,high:106,low:i===5?80:103,close:i===5?81:104,volume:3000000}));
 assert.equal(L.track(signal,[...b,...next],next.at(-1).date).state,'EXPIRED');
});
