'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),F=require('../../strategy-low-base-fundamentals-v929.js');
const receipt={source:F.SOURCES.TWSE,status:200,sha256:'a'.repeat(64),retrievedAt:'2026-11-28T09:00:00Z'};
const rows=Array.from({length:800},(_,i)=>({'公司代號':String(1000+i),'資料年月':'11510','出表日期':'1151128','營業收入-當月營收':'1,200','營業收入-去年當月營收':'1,000'}));
test('official ROC month and date, numeric validation, strict source',()=>{
 assert.equal(F.roc('11510',true),'2026-10');assert.equal(F.roc('1150229'),null);
 const r=F.parse(rows,'TWSE',receipt);assert.equal(r.records.length,800);
 assert.throws(()=>F.parse(rows,'TWSE',{...receipt,source:'https://example.org'}));
 const x=F.evidence(r.records,{code:'1000',market:'TWSE',asOf:'2026-11-28'});assert.equal(x.revenueYoYPositive.pass,true);assert.equal(x.revenueYoYPositive.publishedAt,'2026-11-28');assert.equal(x.revenueYoYPositive.availabilityBasis,'OBSERVED_OFFICIAL_SNAPSHOT_NOT_ORIGINAL_FILING');assert.equal(x.revenue12High,undefined);
 assert.deepEqual(F.evidence(r.records,{code:'1000',market:'TWSE',asOf:'2026-11-27'}),{});
});
test('12 and 3 month calculations require distinct continuous observed months',()=>{
 const r=F.parse(rows,'TWSE',receipt).records[0];
 const history=Array.from({length:12},(_,i)=>({...r,period:new Date(Date.UTC(2026,9-i,1)).toISOString().slice(0,7),current:1200-i*10,priorYear:1000}));
 const x=F.evidence(history,{code:'1000',market:'TWSE',asOf:'2026-11-28'});
 assert.equal(x.revenue12High.pass,true);assert.equal(x.revenue3mYoYPositive.pass,true);assert.equal(x.revenue12High.sources.length,12);
 const missing=F.evidence(history.filter((_,i)=>i!==1),{code:'1000',market:'TWSE',asOf:'2026-11-28'});assert.equal(missing.revenue12High,undefined);assert.equal(missing.revenue3mYoYPositive,undefined);
});
test('stale, future, duplicate and wrong-market data fail closed',()=>{
 const r=F.parse(rows,'TWSE',receipt).records[0];
 assert.deepEqual(F.evidence([r],{code:'1000',market:'TPEX',asOf:'2026-11-28'}),{});
 assert.deepEqual(F.evidence([r],{code:'1000',market:'TWSE',asOf:'2027-02-01'}),{});
 assert.ok(!F.parse([...rows,rows[0]],'TWSE',receipt).records.some(x=>x.code==='1000'));
 assert.equal(F.evidence([{...r,priorYear:0}],{code:'1000',market:'TWSE',asOf:'2026-11-28'}).revenueYoYPositive,undefined);
});

test('session-bound evidence package validates receipts and forbids future observations',()=>{
 const parsed=F.parse(rows,'TWSE',receipt),r=parsed.records[0],snapshotHash='b'.repeat(64);
 const bundle={schema:F.SCHEMA,date:'2026-11-28',snapshotHash,receipts:[{...receipt,market:'TWSE',observedDate:'2026-11-28'}],records:[r]};
 const idx=F.indexBundle(bundle,{asOf:bundle.date,snapshotHash});
 assert.equal(idx.get(r.code,'TWSE').revenueYoYPositive.pass,true);
 assert.throws(()=>F.indexBundle({...bundle,date:'2026-11-27'},{asOf:'2026-11-27',snapshotHash}));
 assert.throws(()=>F.indexBundle({...bundle,receipts:[]},{asOf:bundle.date,snapshotHash}));
 assert.throws(()=>F.indexBundle({...bundle,records:[r,r]},{asOf:bundle.date,snapshotHash}));
});
