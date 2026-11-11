'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../../strategy-2560-v1'),S=require('../../strategy-2560-scanner-v1'),{fixture,refresh}=require('../strategy-2560-fixture.cjs');
const run=f=>C.evaluate(f.report,f.options);
const check=(c,k)=>c.checks.find(x=>x.key===k)?.pass;
test('V9.1 2560 strict completed MA25 breakout + 5/60 volume + MA5 above MA40',()=>{
 const f=fixture(),a=run(f),bars=f.report.canonicalBars;
 assert.equal(a.status,'PASS');assert.equal(a.eligible,true);assert.equal(C.qualifies(a),true);
 for(const n of [5,25,40])assert.equal(a.features['ma'+n].today,bars.slice(-n).reduce((sum,b)=>sum+b.close,0)/n);
 assert.deepEqual(a.checks.map(x=>x.key),['9041','9012','533']);assert.equal(a.score,null);
 assert.equal(a.exitWarning,null);assert.equal(a.rule.exit,'UNSPECIFIED');
 assert.equal(a.volumeRuleCompleteness,'PARTIAL_VERIFIED_VMA5_GT_VMA60');
 assert.ok(a.features.volumeRatio>1);assert.ok(a.features.breakoutPct>0);
});
test('9041 yesterday below MA25 and today above passes; previous equality also passes',()=>{
 const below=run(fixture([...Array(59).fill(100),99,115]));assert.equal(check(below,'9041'),true);
 const equal=run(fixture());assert.equal(equal.features.previousClose,equal.features.ma25.previous);assert.equal(check(equal,'9041'),true);
});
test('9041 yesterday already above MA25 does not count; today equal to MA25 fails',()=>{
 const prior=run(fixture([...Array(59).fill(100),110,115]));assert.equal(check(prior,'9041'),false);assert.equal(prior.status,'FAIL');
 const same=run(fixture(Array(61).fill(100)));assert.equal(check(same,'9041'),false);assert.equal(same.status,'FAIL');
});
test('533 strictly MA5>MA40, equality and below are rejected',()=>{
 const up=run(fixture());assert.equal(check(up,'533'),true);
 const equal=run(fixture(Array(61).fill(100)));assert.equal(check(equal,'533'),false);
 const below=run(fixture([...Array(55).fill(100),...Array(6).fill(90)]));assert.equal(check(below,'533'),false);
});
test('9012 VMA5 strictly greater VMA60, equality and below fail',()=>{
 const positive=run(fixture());assert.equal(check(positive,'9012'),true);
 const eq=fixture();eq.report.canonicalBars.forEach(b=>b.volume=1000000);refresh(eq);
 assert.equal(check(run(eq),'9012'),false);
 const lower=fixture();lower.report.canonicalBars.slice(-5).forEach(b=>b.volume=500000);refresh(lower);
 assert.equal(check(run(lower),'9012'),false);
});
test('exact 60 valid sessions required; incomplete sessions and mismatched quotes excluded',()=>{
 const short=fixture();short.report.canonicalBars.splice(0,2);short.report.dailySeries.splice(0,2);
 assert.equal(run(short).status,'INSUFFICIENT_DATA');
 const unfinished=fixture();unfinished.report.completed=false;assert.equal(run(unfinished).status,'DATA_ERROR');
 const mismatch=fixture();mismatch.options.quote.close+=1;assert.equal(run(mismatch).status,'DATA_ERROR');
});
test('old requirement of rising MA5 and MA25 is not a fifth-filter gate',()=>{
 const prices=Array(61).fill(100);prices[35]=200;prices[55]=130;for(let i=56;i<60;i++)prices[i]=102;prices[60]=120;
 const a=run(fixture(prices));assert.equal(a.status,'PASS');assert.equal(a.features.ma5.today<a.features.ma5.previous,true);assert.equal(a.features.ma25.today<a.features.ma25.previous,true);
});
test('independent risk metrics do not disqualify a passing selection',()=>{
 const a=run(fixture());assert.equal(a.eligible,true);assert.equal(a.risk.highDeviation,true);
 assert.ok(a.warnings.length);assert.equal(a.features.volumeRatio,a.features.vma5/a.features.vma60);
 assert.match(C.lines(a).join('\n'),/#9012量能規則部分還原/);
});
test('universe rejects financial and ETF but preserves original fifth scanner scope',()=>{
 for(const sector of [{industryCode:'17'},{industryName:'金融保險'}]){const f=fixture();f.options.sector=sector;assert.equal(run(f).status,'EXCLUDED');}
 const etf=fixture();etf.options.quote.securityType='ETF';assert.equal(run(etf).status,'EXCLUDED');
 const biotech=fixture();biotech.options.sector={industryCode:'22',industryName:'生技醫療'};assert.equal(run(biotech).status,'PASS');
});
test('frozen 2560 evaluation is repeatable, source remains untouched',()=>{
 const f=fixture(),before=JSON.stringify(f),a=run(f),b=run(f);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(f),before);assert.equal(Object.isFrozen(a),true);
});
test('scanner accounts for all entries, rejects tampered snapshots and never fills Top8',async()=>{
 const f=fixture(),g=fixture(undefined,'2317'),bundle={map:new Map([['2330',f.options.quote],['2317',g.options.quote],['9999',{...g.options.quote,code:'9999'}]]),sectorMap:new Map(['2330','2317','9999'].map(c=>[c,f.options.sector])),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:3},p=S.pool(bundle);let calls=0;
 const scan=await S.scan({pool:p,batchSize:1,fetchBatch:async items=>{calls++;return {type:'MOMENTUM_DEEP_SCAN',results:items.map(i=>i.code==='9999'?{code:i.code,ok:false,error:'資料受限',failureCode:'DATA_INVALID'}:{code:i.code,ok:true,data:i.code==='2330'?f.report:g.report})};}});
 assert.equal(calls,3);assert.deepEqual(scan.candidates.map(c=>c.code),['2317','2330']);assert.equal(scan.dataUnavailable,1);assert.equal(scan.complete,false);
 assert.equal(scan.inputAccounting.input,scan.inputAccounting.excluded+scan.inputAccounting.processed+scan.inputAccounting.pending+scan.inputAccounting.deferred);
 S.assertSnapshot(scan);const tampered=structuredClone(scan);tampered.candidates[0].features.ma5.today++;assert.throws(()=>S.assertSnapshot(tampered));
});
test('full-market empty result differs from incomplete empty result',async()=>{
 for(const ok of [true,false]){const f=fixture(Array(61).fill(100)),p=S.pool({map:new Map([['2330',f.options.quote]]),sectorMap:new Map([['2330',f.options.sector]]),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:1}),s=await S.scan({pool:p,fetchBatch:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'2330',ok,data:ok?f.report:null,error:'未完成'}]})});
 assert.equal(s.candidates.length,0);assert.equal(s.fullMarketCertified,ok);assert.match(s.text,ok?/今日2560無符合條件的股票/:/不能代表全市場0檔/);}
});
const negativeCases={
 calendar:f=>delete f.report.expectedTradingDates,
 basis:f=>f.report.priceAdjustment.verified=false,
 unit:f=>f.report.volumeUnit='lots',
 wrongCode:f=>f.options.code='9999',
 wrongDate:f=>f.options.quote.quoteDate='2020-01-01',
 quoteMismatch:f=>f.options.quote.close+=.01,
 unknownSector:f=>f.options.sector={},
 wrongBar:f=>f.report.canonicalBars.at(-1).stock='9999',
 future:f=>f.report.canonicalBars.at(-1).date='2099-01-01'
};
for(const [name,change] of Object.entries(negativeCases))test('V9.1 retains V9.0 data firewall: '+name,()=>{
 const f=fixture();assert.equal(run(f).status,'PASS');change(f);
 const a=run(f);assert.equal(a.eligible,false);
 assert.equal(a.status,'DATA_ERROR');
});
test('protected five selection engines, inline engines and archived restaurant sources remain byte identical to the release baseline',()=>{const crypto=require('node:crypto'),b=require('../fixtures/v90-protected-baseline.json'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');for(const[p,h]of Object.entries(b.sha256))assert.equal(hash(fs.readFileSync(p)),h,p);const html=fs.readFileSync('index.html','utf8'),inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(hash(JSON.stringify(inline)),b.inlineSha256);});
