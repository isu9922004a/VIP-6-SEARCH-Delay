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
 const row=(code,score)=>({code,date:plan.date,eligible:true,status:'PASS',quality:{score}});
 const x=S.finish(plan,[row('1002',71),row('1001',81),{code:'1003',date:plan.date,status:'DATA_ERROR'}],false);
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

test('wrong-date duplicate and foreign scan records cannot certify full coverage or enter ranking',()=>{
 const date='2026-11-27',plan={date,items:[{code:'1001'},{code:'1002'}],marketTotal:2,marketCoverageReady:true};
 const row=(code,d=date)=>({code,date:d,eligible:true,status:'PASS',quality:{score:80}});
 for(const rows of [[row('1001'),row('1001')],[row('1001'),row('1002','2026-11-26')],[row('1001'),row('9999')]]){
  const x=S.finish(plan,rows,false);assert.equal(x.fullMarketCertified,false);assert.equal(x.zeroConfirmed,false);assert.ok(x.identityErrors>0);assert.ok(x.pending>0);
  assert.ok(x.candidates.every(c=>c.code==='1001'&&c.date===date));
 }
 const x=S.finish(plan,[row('1001'),row('1002')],false);assert.equal(x.fullMarketCertified,true);assert.equal(x.pending,0);
});
test('initial breakout levels are rendered with explicit no-followup claim',()=>{
 const date='2026-11-27',c={...C.compute(fixture(),620000000),date,code:'1001',name:'測試',levels:{state:'INITIAL',signalDate:date,breakoutPrice:104,breakoutLow:98.5,ma20:100,lifeLine:100,pressure20:105,followup:'尚待下一完成交易日核對'}};
 const lines=S.lines(c).join('\n');assert.match(lines,/突破收盤價 104.00/);assert.match(lines,/收盤失效參考：跌破 100.00/);assert.match(lines,/前20日最高價壓力 105.00/);assert.match(lines,/尚待下一完成交易日核對/);
});

test('follow-up source failure does not convert today candidate or imply a confirmed zero',async()=>{
 const plan={date:'2026-11-27',items:[{code:'1001'}],marketTotal:1,marketCoverageReady:true};
 const archive={state:'UNAVAILABLE',dates:[],snapshots:new Map(),errors:[{date:plan.date,reason:'缺少封存'}]};
 const x=await S.scan({plan,archive,reviewFollowup:()=>({state:'UNAVAILABLE',checked:0,unavailable:5,entries:[]}),fetchBatch:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'1001',ok:true,data:{}}]})});
 assert.equal(x.followupReview.state,'UNAVAILABLE');assert.equal(x.followupReview.unavailable,5);assert.equal(x.fullMarketCertified,false);
});
test('follow-up entries are independent of today hard-gate ranking',()=>{
 const date='2026-11-27',plan={date,items:[{code:'1001'}],marketTotal:1,marketCoverageReady:true};
 const followup={code:'1001',name:'測試',signalDate:'2026-11-26',age:1,state:'CONFIRMED',close:105,breakoutPrice:104,breakoutLow:99,ma20:100,lifeLine:100,volumeFloor:1000,lastVolumeHealthy:true};
 const x=S.finish(plan,[{code:'1001',date,status:'FAIL',eligible:false,followupReview:{checked:5,unavailable:0,entries:[followup]}}],false,{state:'READY',dates:['2026-11-26'],errors:[]});
 assert.equal(x.candidates.length,0);assert.equal(x.followups.length,1);assert.match(S.text(x),/隔日確認/);assert.match(S.text(x),/不列入今日新突破TOP 8/);
});
test('archive rejects future or mismatched source date and cannot fabricate evidence',async()=>{
 await assert.rejects(L.verifyArchive({tradeDateIso:'2026-11-28'},'2026-11-27'),/封存日期或市場範圍不符/);
 const x=await L.loadArchives('2026-11-27',null,{fetcher:async()=>{throw Error('unexpected fetch');}});
 assert.equal(x.state,'UNAVAILABLE');assert.equal(x.snapshots.size,0);
});

test('risk context rejects future data and never fabricates an unconfirmed N target',()=>{
 const {b,signal}=lifecycleFixture();
 assert.equal(C.riskContext(b,signal.date).state,'RESEARCH_ONLY');
 assert.equal(C.riskContext(b,signal.date).projection,null);
 assert.equal(C.riskContext(b,'2026-09-01').state,'UNAVAILABLE');
 assert.equal(C.riskContext(b,signal.date).affectsScore,false);
});
test('N projection and historical daily price-volume proxy are labelled non-execution evidence',()=>{
 const result=S.riskLines({state:'RESEARCH_ONLY',projection:{A:{price:100},B:{price:120},C:{price:110},target:142.36},pressureZones:[{low:115,high:120,sharePct:12}],warnings:['測試']}).join('\n');
 assert.match(result,/1.618理論投射 142.36/);assert.match(result,/非實際套牢籌碼/);assert.match(result,/不改原分數或排名/);
});
