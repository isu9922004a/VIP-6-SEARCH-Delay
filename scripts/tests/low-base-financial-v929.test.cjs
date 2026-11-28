'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Q=require('../../strategy-low-base-financial-v929.cjs');
const asOf='2026-11-28',receipt={source:Q.sources.TWSE.income,status:200,retrievedAt:'2026-11-28T09:00:00Z',sha256:'a'.repeat(64)};
const rows=Array.from({length:800},(_,i)=>({'公司代號':String(1000+i),'出表日期':'1151128','年度':'115','季別':'3','營業收入':'300','營業成本':'220','營業毛利（毛損）':'80','本期淨利（淨損）':'40','基本每股盈餘（元）':'3'}));
test('latest cumulative report is not single-quarter or full-year EPS',()=>{
 const r=Q.parse(rows,'TWSE','income',receipt).records[0];
 assert.deepEqual(Q.evaluate([r],{code:r.code,market:'TWSE',asOf}),{});
 assert.deepEqual(Q.evaluate([r],{code:r.code,market:'TWSE',asOf:'2026-11-27'}),{});
 assert.throws(()=>Q.parse(rows,'TWSE','income',{...receipt,source:'https://example.org'}));
});
test('single-quarter margins subtract preceding cumulative statement; annual EPS uses last-year Q4',()=>{
 const r=Q.parse(rows,'TWSE','income',receipt).records[0];
 const prior={...r,quarter:2,periodEnd:'2026-06-30',revenue:200,cost:150,grossProfit:50,netIncome:30};
 const annual={...r,year:2025,quarter:4,periodEnd:'2025-12-31',eps:2};
 const x=Q.evaluate([r,prior,annual],{code:r.code,market:'TWSE',asOf});
 assert.equal(x.grossMarginAbove1787.value,30);assert.equal(x.netMarginAbove873.value,10);assert.equal(x.epsAbove1.pass,true);
 assert.equal(x.inventoryTurnoverAbove1,undefined);assert.equal(x.grossMargin8qHigh,undefined);
});
test('turnover is nonannualized and needs both balance dates',()=>{
 const r=Q.parse(rows,'TWSE','income',receipt).records[0],prev={...r,quarter:2,periodEnd:'2026-06-30',revenue:200,cost:150,grossProfit:50,netIncome:30};
 const bal={...r,kind:'balance',basis:'PERIOD_END',source:Q.sources.TWSE.balance,inventory:40},old={...bal,quarter:2,periodEnd:'2026-06-30',inventory:60};
 const x=Q.evaluate([r,prev,bal,old],{code:r.code,market:'TWSE',asOf});assert.equal(x.inventoryTurnoverAbove1.value,1.4);
 assert.equal(Q.evaluate([r,prev,bal],{code:r.code,market:'TWSE',asOf}).inventoryTurnoverAbove1,undefined);
});
