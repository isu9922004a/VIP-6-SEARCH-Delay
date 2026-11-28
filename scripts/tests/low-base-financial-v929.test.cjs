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

test('actual TPEx Season identity and missing inventory field are explicitly handled',()=>{
 const tpex=rows.map(r=>({...r,Date:r['出表日期'],Year:r['年度'],Season:r['季別'],SecuritiesCompanyCode:r['公司代號'],'公司代號':undefined,'出表日期':undefined,'年度':undefined,'季別':undefined}));
 const x=Q.parse(tpex,'TPEX','income',{...receipt,source:Q.sources.TPEX.income});
 assert.equal(x.records.length,800);assert.equal(x.records[0].quarter,3);
 const b=rows.map(r=>({...r,'流動資產':'1000'}));
 assert.throws(()=>Q.parse(b,'TWSE','balance',{...receipt,source:Q.sources.TWSE.balance}),/未提供存貨明細/);
});

test('shared browser and node scoring receive identical quarter evidence; reject missing receipt and future dates',()=>{
 const F=require('../../strategy-low-base-fundamentals-v929.js'),r=Q.parse(rows,'TWSE','income',receipt).records[0],prior={...r,quarter:2,periodEnd:'2026-06-30',revenue:200,grossProfit:50,netIncome:30},snapshotHash='b'.repeat(64);
 const bundle={schema:F.SCHEMA,date:asOf,snapshotHash,receipts:[],records:[],financialReceipts:[{...receipt,market:'TWSE',kind:'income',observedDate:asOf}],financialRecords:[r,prior]};
 const x=F.indexBundle(bundle,{asOf,snapshotHash});
 assert.equal(x.get(r.code,'TWSE').grossMarginAbove1787.value,30);
 assert.deepEqual(x.get(r.code,'TWSE'),Q.evaluate([r,prior],{code:r.code,market:'TWSE',asOf}));
 assert.throws(()=>F.indexBundle({...bundle,financialReceipts:[]},{asOf,snapshotHash}),/季度財報個股資料不符/);
 assert.throws(()=>F.indexBundle({...bundle,date:'2026-11-27'},{asOf:'2026-11-27',snapshotHash}),/季度財報收據不符/);
 assert.throws(()=>F.indexBundle({...bundle,financialRecords:[r,r]},{asOf,snapshotHash}),/季度財報個股資料不符/);
});
