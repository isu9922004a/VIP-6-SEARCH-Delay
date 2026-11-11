'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../../strategy-2560-v1'),S=require('../../strategy-2560-scanner-v1'),{fixture,refresh}=require('../strategy-2560-fixture.cjs');
const run=f=>C.evaluate(f.report,f.options);
const check=(a,key)=>a.checks.find(x=>x.key===key);
function changeVolumes(f,fn){f.report.canonicalBars.forEach((b,i)=>b.volume=fn(i));refresh(f);return f;}
test('V9.1 strategy retains public name 2560 with only three required gates',()=>{
 const a=run(fixture());assert.equal(C.MODEL,'2560-STRATEGY-V2.0');assert.equal(a.status,'PASS');assert.equal(a.eligible,true);assert.equal(C.qualifies(a),true);
 assert.deepEqual(a.checks.map(x=>x.key),['9041','9012','533']);assert.equal(a.checks.length,3);assert.equal(a.score,null);assert.equal(a.exitWarning,null);assert.equal(a.volumeRuleComplete,false);assert.match(a.volumeRuleNote,/部分還原/);
});
test('#9041 yesterday below MA25 and today closes above',()=>{
 const a=run(fixture());assert.ok(a.features.closePrev<a.features.ma25.previous);assert.ok(a.features.close>a.features.ma25.today);assert.equal(check(a,'9041').pass,true);
 assert.equal(a.features.breakoutPct,(a.features.close-a.features.ma25.today)/a.features.ma25.today*100);
});
test('#9041 yesterday exactly equals MA25 may break above',()=>{
 const a=run(fixture([...Array(60).fill(100),130]));assert.equal(a.features.closePrev,100);assert.equal(a.features.ma25.previous,100);assert.equal(check(a,'9041').pass,true);assert.equal(a.status,'PASS');
});
test('#9041 already above MA25 yesterday does not count as new breakout',()=>{
 const a=run(fixture([...Array(59).fill(100),120,130]));assert.ok(a.features.closePrev>a.features.ma25.previous);assert.equal(check(a,'9041').pass,false);assert.equal(a.status,'FAIL');assert.equal(C.qualifies(a),false);
});
test('#9041 today close equals MA25 is NOT a breakout',()=>{
 const a=run(fixture(Array(61).fill(100)));assert.equal(a.features.close,a.features.ma25.today);assert.equal(check(a,'9041').pass,false);assert.equal(a.status,'FAIL');
});
test('#533 MA5 above MA40 passes without today MA5/MA40 crossover',()=>{
 const a=run(fixture());assert.ok(a.features.ma5.previous>a.features.ma40.previous);assert.ok(a.features.ma5.today>a.features.ma40.today);assert.equal(check(a,'533').pass,true);assert.equal(a.status,'PASS');
});
test('#533 equality and below MA40 fail',()=>{
 const same=run(fixture(Array(61).fill(100))),below=run(fixture([...Array(60).fill(100),90]));
 assert.equal(same.features.ma5.today,same.features.ma40.today);assert.equal(check(same,'533').pass,false);
 assert.ok(below.features.ma5.today<below.features.ma40.today);assert.equal(check(below,'533').pass,false);
});
test('#9012 five-day average exceeds sixty-day average, with 60-session independent arithmetic',()=>{
 const a=run(fixture()),b=fixture().report.canonicalBars,vol=b.map(x=>x.volume);
 assert.equal(a.features.vma5,vol.slice(-5).reduce((x,y)=>x+y,0)/5);
 assert.equal(a.features.vma60,vol.slice(-60).reduce((x,y)=>x+y,0)/60);
 assert.equal(check(a,'9012').pass,true);assert.ok(a.features.volumeRatio>1);assert.equal(a.features.latestVolume,b.at(-1).volume);
});
test('#9012 equal VMA5/VMA60 fails',()=>{
 const a=run(changeVolumes(fixture(),()=>1e6));assert.equal(a.features.vma5,a.features.vma60);assert.equal(check(a,'9012').pass,false);assert.equal(a.status,'FAIL');
});
test('#9012 VMA5 below VMA60 fails',()=>{
 const a=run(changeVolumes(fixture(),i=>i>=56?1e6:2e6));assert.ok(a.features.vma5<a.features.vma60);assert.equal(check(a,'9012').pass,false);
});
test('all three required conditions must pass; no one-condition exception',()=>{
 const a=run(fixture());assert.ok(a.checks.every(x=>x.pass));
 for(const f of [fixture([...Array(59).fill(100),120,130]),changeVolumes(fixture(),()=>1e6),fixture(Array(61).fill(100))]){const result=run(f);assert.equal(result.status,'FAIL');assert.equal(result.eligible,false);}
});
test('fewer than 60 valid daily bars never pass',()=>{
 const a=run(fixture(Array(59).fill(100)));assert.equal(a.status,'INSUFFICIENT_DATA');assert.equal(a.eligible,false);
});
test('unfinished daily session is not a signal',()=>{
 const f=fixture();f.report.completed=false;const a=run(f);assert.equal(a.status,'INSUFFICIENT_DATA');assert.equal(a.eligible,false);
});
test('the former simultaneous rising MA5/MA25 rule is NOT a gate',()=>{
 const a=run(fixture([...Array(54).fill(100),150,120,150,140,85,85,120]));
 assert.equal(a.status,'PASS');assert.equal(a.features.ma5.today,a.features.ma5.previous);assert.ok(a.features.ma5.today>a.features.ma40.today);assert.equal(C.qualifies(a),true);
});
test('risk alerts, high MA5 deviation and upper wick never alter the three-gate PASS decision',()=>{
 const f=fixture();const last=f.report.canonicalBars.at(-1);last.high=200;refresh(f);
 const a=run(f);assert.equal(a.status,'PASS');assert.ok(a.features.deviationMA5>6);assert.ok(a.risk.upperShadowRatio>.4);assert.ok(a.warnings.length>=3);assert.equal(a.exitWarning,null);assert.equal(a.rule.exit,null);
});
for(const[name,change,expected]of [
 ['calendar',f=>delete f.report.expectedTradingDates,'INSUFFICIENT_DATA'],
 ['basis',f=>f.report.priceAdjustment.verified=false,'INSUFFICIENT_DATA'],
 ['unit',f=>f.report.volumeUnit='lots','INSUFFICIENT_DATA'],
 ['wrongCode',f=>f.options.code='9999','DATA_ERROR'],
 ['wrongDate',f=>f.options.quote.quoteDate='2020-01-01','DATA_ERROR'],
 ['quoteMismatch',f=>f.options.quote.close+=.01,'DATA_ERROR'],
 ['unknownSector',f=>f.options.sector={},'INSUFFICIENT_DATA'],
 ['future',f=>f.report.canonicalBars.at(-1).date='2099-01-01','DATA_ERROR']
])test('data firewall rejects '+name,()=>{const f=fixture();change(f);const a=run(f);assert.equal(a.status,expected);assert.equal(a.eligible,false);});
test('financials and ETFs excluded, legacy universe boundaries unchanged',()=>{
 for(const sector of [{industryCode:'17'},{industryName:'金融保險'}]){const f=fixture();f.options.sector=sector;assert.equal(run(f).status,'EXCLUDED');}
 const f=fixture();f.options.quote.securityType='ETF';assert.equal(run(f).status,'EXCLUDED');
 const g=fixture();g.options.sector={industryCode:'22',industryName:'生技醫療'};assert.equal(run(g).eligible,true);
});
test('repeated results are immutable and caller input is never mutated',()=>{
 const f=fixture(),before=JSON.stringify(f),a=run(f),b=run(f);assert.deepEqual(a,b);assert.equal(JSON.stringify(f),before);assert.equal(Object.isFrozen(a),true);assert.equal(Object.isFrozen(f.report.priceAdjustment),false);
});
test('full batch preserves code order, partial failures and fingerprint protection',async()=>{
 const f=fixture(),g=fixture(undefined,'2317'),q={...g.options.quote,code:'9999'},bundle={map:new Map([['2330',f.options.quote],['2317',g.options.quote],['9999',q]]),sectorMap:new Map(['2330','2317','9999'].map(c=>[c,f.options.sector])),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:3},p=S.pool(bundle);let calls=0;
 const scan=await S.scan({pool:p,batchSize:1,fetchBatch:async items=>{calls++;return {type:'MOMENTUM_DEEP_SCAN',results:items.map(i=>i.code==='9999'?{code:i.code,ok:false,error:'服務失敗',failureCode:'DATA_INVALID'}:{code:i.code,ok:true,data:i.code==='2330'?f.report:g.report})};}});
 assert.equal(calls,3);assert.deepEqual(scan.candidates.map(c=>c.code),['2317','2330']);assert.equal(scan.failed,1);assert.equal(scan.complete,false);
 assert.equal(scan.inputAccounting.input,scan.inputAccounting.excluded+scan.inputAccounting.processed+scan.inputAccounting.pending+scan.inputAccounting.deferred);
 S.assertSnapshot(scan);const bad=structuredClone(scan);bad.candidates[0].features.ma5.today++;assert.throws(()=>S.assertSnapshot(bad));assert.throws(()=>S.assertSnapshot({model:'2560-STRATEGY-V1.0'}));
});
test('zero full scan vs partial scan, and never fabricate eight candidates',async()=>{
 for(const ok of [true,false]){const f=fixture(Array(61).fill(100)),p=S.pool({map:new Map([['2330',f.options.quote]]),sectorMap:new Map([['2330',f.options.sector]]),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:1}),scan=await S.scan({pool:p,fetchBatch:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'2330',ok,data:ok?f.report:null,error:'未完成'}]})});
 assert.equal(scan.candidates.length,0);assert.equal(scan.fullMarketCertified,ok);assert.match(scan.text,ok?/今日2560無符合條件的股票/:/不能代表全市場0檔/);}
});
test('all other five selection engines, archived restaurant and inline script engines match retained baseline bytewise',()=>{
 const crypto=require('node:crypto'),b=require('../fixtures/v90-protected-baseline.json'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 for(const[p,h]of Object.entries(b.sha256))assert.equal(hash(fs.readFileSync(p)),h,p);
 const html=fs.readFileSync('index.html','utf8'),inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(hash(JSON.stringify(inline)),b.inlineSha256);
});
