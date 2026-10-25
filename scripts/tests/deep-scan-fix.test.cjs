'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../../deep-scan-health-v1.js'),D=require('../../selection-data-v2.js');
const fixture=require('../fixtures/9933-worker-responses-20261022.json');
const mk=(code,market)=>({code,q:{market,open:10,high:12,low:9,close:11,volume:100000,quoteDate:'2026-10-22'}});
const candidates=[mk('4526','TWSE'),mk('1101','TWSE'),mk('6173','TPEX'),mk('8039','TPEX'),mk('2330','TWSE'),mk('2317','TWSE'),mk('1815','TPEX'),mk('4939','TPEX')];
const valid=x=>({code:x.code,ok:true,data:{stock:x.code,closeDate:'2026-10-22',close:11,canonicalBars:[{date:'2026-10-22',close:11}]}});
function fetcher(part){return Promise.resolve({type:'MOMENTUM_DEEP_SCAN',results:part.map(x=>x.code==='4526'||x.code==='6173'?{code:x.code,ok:false,error:'資料不足｜共用日K：模擬單股契約或歷史序列異常',dataUnavailable:true}:valid(x))});}
test('market-specific replacement probes preserve DATA quarantines and allow non-certified scan',async()=>{
 const result=await H.preflight({items:candidates,targetDate:'2026-10-22',fetcher,delayMs:0,allowPartialService:true,allowPartialData:true});
 assert.equal(result.ok,true);assert.equal(result.degraded,true);assert.deepEqual(result.quarantinedCodes.sort(),['4526','6173']);
 assert.equal(result.verifiedProbes,4);assert.deepEqual(result.sampledCodes,['4526','1101','6173','8039','2330','1815']);
});
test('without isolated-DATA option the same 2 failures still halt',async()=>{
 await assert.rejects(H.preflight({items:candidates,targetDate:'2026-10-22',fetcher,delayMs:0,allowPartialService:true}),/盤後資料健康檢查未通過/);
});
test('even with option, without independent healthy peers the scan must stop',async()=>{
 const allBad=part=>Promise.resolve({type:'MOMENTUM_DEEP_SCAN',results:part.map(x=>({code:x.code,ok:false,error:'資料不足｜上游',dataUnavailable:true}))});
 await assert.rejects(H.preflight({items:candidates,targetDate:'2026-10-22',fetcher:allBad,delayMs:0,allowPartialService:true,allowPartialData:true}),/未通過/);
});
test('stale/price-invalid dates cannot be downgraded to acceptable partial data',async()=>{
 const wrong=part=>Promise.resolve({type:'MOMENTUM_DEEP_SCAN',results:part.map(x=>x.code==='4526'?{...valid(x),data:{...valid(x).data,closeDate:'2026-10-21'}}:valid(x))});
 await assert.rejects(H.preflight({items:candidates,targetDate:'2026-10-22',fetcher:wrong,delayMs:0,allowPartialService:true,allowPartialData:true}),/盤後資料健康檢查未通過/);
});
test('rebind to corrected same-day market quotes drops historical cache',()=>{
 D.reset();const rows=fixture.snapshot.rows;const bind=(quoteRows)=>D.bind({map:new Map(quoteRows.map(q=>[q.code,q])),meta:fixture.snapshot.meta,snapshotRows:quoteRows.length});
 bind(rows);D.remember(structuredClone(fixture.daily.results[0].data),'9933');assert.ok(D.get('9933'));
 const updated=rows.map(q=>q.code==='2330'?{...q,volume:Number(q.volume)+1}:q);
 bind(updated);assert.equal(D.get('9933'),null,'old shared bars must not survive rebind to a corrected same-date snapshot');
});
test('same quote, different verified historical bars cannot silently overwrite prior series',()=>{
 D.reset();D.bind({map:new Map(fixture.snapshot.rows.map(q=>[q.code,q])),meta:fixture.snapshot.meta,snapshotRows:fixture.snapshot.rows.length});
 const original=structuredClone(fixture.daily.results[0].data),p=D.remember(original,'9933');
 const modified=structuredClone(original);modified.dailySeries[0].low+=.01;
 assert.throws(()=>D.remember(modified,'9933'),/首筆差異.*low/);assert.equal(D.get('9933').fingerprint,p.fingerprint);
});
test('unsupported daily volume source gives specific provenance diagnostics',()=>{
 D.reset();D.bind({map:new Map(fixture.snapshot.rows.map(q=>[q.code,q])),meta:fixture.snapshot.meta,snapshotRows:fixture.snapshot.rows.length});
 const changed=structuredClone(fixture.daily.results[0].data);changed.dailySeriesMeta.source='CHANGED_SOURCE';
 assert.throws(()=>D.remember(changed,'9933'),/source=CHANGED_SOURCE/);
});
