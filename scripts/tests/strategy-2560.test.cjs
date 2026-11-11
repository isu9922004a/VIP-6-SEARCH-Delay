'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../../strategy-2560-v1'),S=require('../../strategy-2560-scanner-v1'),{fixture,refresh}=require('../strategy-2560-fixture.cjs');
const run=f=>C.evaluate(f.report,f.options);
const prices=(arr)=>fixture(arr);
const sixty=Array(60).fill(100);
const check=(c,key)=>c.checks.find(x=>x.key===key)?.pass;
function volume(f,change){for(let i=0;i<f.report.canonicalBars.length;i++)f.report.canonicalBars[i].volume=change(i,f.report.canonicalBars.length);return refresh(f);}
test('V9.1 three rules use independent SMA and volume means and keep 2560 name',()=>{
 const f=fixture(),a=run(f),b=f.report.canonicalBars;
 assert.equal(C.MODEL,'2560-STRATEGY-V2.0');assert.equal(C.RULE.minBars,60);assert.equal(C.RULE.exit,null);assert.equal(C.RULE.volumeRule9012Complete,false);
 assert.equal(a.status,'PASS');assert.equal(C.qualifies(a),true);assert.deepEqual(a.checks.map(c=>c.key),['9041','9012','533']);assert.equal(a.volumeRuleComplete,false);
 for(const n of [5,25,40]){assert.equal(a.features['ma'+n].today,b.slice(-n).reduce((s,x)=>s+x.close,0)/n);assert.equal(a.features['ma'+n].previous,b.slice(-n-1,-1).reduce((s,x)=>s+x.close,0)/n);}
 for(const n of [5,60])assert.equal(a.features['vma'+n],b.slice(-n).reduce((s,x)=>s+x.volume,0)/n);
 assert.equal(a.features.breakoutPct,(a.features.close-a.features.ma25.today)/a.features.ma25.today*100);
 assert.equal(a.features.volumeRatio,a.features.vma5/a.features.vma60);assert.equal(a.exitWarning,null);assert.equal(a.score,null);
});
test('#9041: yesterday below MA25 and today above passes',()=>{const a=run(prices([...Array(59).fill(100),90,130]));assert.equal(check(a,'9041'),true);});
test('#9041: yesterday equal MA25 and today above passes',()=>{const a=run(prices([...sixty,130]));assert.equal(a.features.closePrev,a.features.ma25.previous);assert.equal(check(a,'9041'),true);});
test('#9041: yesterday already above MA25 does not pass',()=>{const a=run(prices([...Array(59).fill(100),120,130]));assert.equal(check(a,'9041'),false);assert.equal(a.eligible,false);});
test('#9041: close equal MA25 is not a new close breakout',()=>{const a=run(prices([...sixty,100]));assert.equal(check(a,'9041'),false);});
test('#533 MA5 > MA40 passes even when MA5 was above yesterday; no same-day golden-cross requirement',()=>{const a=run(fixture());assert.ok(a.features.ma5.previous>a.features.ma40.previous);assert.equal(check(a,'533'),true);assert.equal(C.qualifies(a),true);});
test('#533 equality fails',()=>{const a=run(prices([...sixty,100]));assert.equal(a.features.ma5.today,a.features.ma40.today);assert.equal(check(a,'533'),false);});
test('#533 below fails',()=>{const a=run(prices([...Array(56).fill(200),100,100,100,100,100]));assert.ok(a.features.ma5.today<a.features.ma40.today);assert.equal(check(a,'533'),false);});
test('#9012 volume expansion strictly greater passes',()=>{const a=run(fixture());assert.equal(check(a,'9012'),true);});
test('#9012 equal VMA5/VMA60 fails',()=>{const a=run(volume(fixture(),()=>1000000));assert.equal(a.features.vma5,a.features.vma60);assert.equal(check(a,'9012'),false);});
test('#9012 below VMA60 fails',()=>{const a=run(volume(fixture(),(i,n)=>i>=n-5?500000:1000000));assert.ok(a.features.vma5<a.features.vma60);assert.equal(check(a,'9012'),false);});
test('any one failed gate blocks PASS; all three must pass',()=>{const pass=run(fixture());assert.equal(pass.status,'PASS');for(const candidate of [
 prices([...Array(59).fill(100),120,130]),
 volume(fixture(),()=>1000000),
 prices([...sixty,100])
 ]){const a=run(candidate);assert.equal(a.status,'FAIL');assert.equal(a.eligible,false);assert.equal(C.qualifies(a),false);}
});
test('below 60 completed sessions is INSUFFICIENT_DATA and never passes',()=>{const f=fixture(Array(59).fill(100));const a=run(f);assert.equal(a.status,'INSUFFICIENT_DATA');assert.equal(a.eligible,false);});
test('unfinished daily candle is never eligible',()=>{const f=fixture();f.report.completed=false;const a=run(f);assert.equal(a.eligible,false);assert.equal(a.status,'INSUFFICIENT_DATA');});
test('same-day MA5/MA25 slope is not an entry gate',()=>{
 const a=run(prices([...Array(35).fill(100),150,...Array(20).fill(60),100,100,100,60,120]));
 assert.equal(check(a,'9041'),true);assert.equal(check(a,'9012'),true);assert.equal(check(a,'533'),true);assert.equal(a.eligible,true);
 assert.ok(a.features.ma25.today<a.features.ma25.previous);
});
test('risk indications and unusual volume do not become pass/fail gates',()=>{const a=run(fixture());assert.equal(a.status,'PASS');assert.equal(a.risk.unusualVolume,false);assert.ok(a.risk.supportObservation.every(x=>Number.isFinite(x)));assert.ok(a.warnings.some(x=>x.includes('部分還原')));});
for(const[name,change]of Object.entries({
 calendar:f=>delete f.report.expectedTradingDates,basis:f=>f.report.priceAdjustment.verified=false,
 unit:f=>f.report.volumeUnit='lots',wrongCode:f=>f.options.code='9999',
 wrongDate:f=>f.options.quote.quoteDate='2020-01-01',quoteMismatch:f=>f.options.quote.close+=.01,
 unknownSector:f=>f.options.sector={},wrongBar:f=>f.report.canonicalBars.at(-1).stock='9999',
 future:f=>f.report.canonicalBars.at(-1).date='2099-01-01'
}))test('data firewall excludes '+name,()=>{const f=fixture();change(f);const a=run(f);assert.equal(a.eligible,false);assert.ok(['INSUFFICIENT_DATA','DATA_ERROR'].includes(a.status));});
test('financials and ETFs excluded; other scanner sector policies not silently added',()=>{for(const sector of [{industryCode:'17'},{industryName:'金融保險'}]){const f=fixture();f.options.sector=sector;assert.equal(run(f).status,'EXCLUDED');}const f=fixture();f.options.quote.securityType='ETF';assert.equal(run(f).status,'EXCLUDED');const g=fixture();g.options.sector={industryCode:'22',industryName:'生技醫療'};assert.equal(run(g).eligible,true);});
test('frozen results do not mutate input objects',()=>{const f=fixture(),before=JSON.stringify(f),a=run(f),b=run(f);assert.deepEqual(a,b);assert.equal(JSON.stringify(f),before);assert.equal(Object.isFrozen(f.report.priceAdjustment),false);assert.equal(Object.isFrozen(a),true);});
test('full scan skips no entries, retains partial failures, and refuses stale/tampered snapshots',async()=>{
 const f=fixture(),g=fixture(undefined,'2317'),bundle={map:new Map([['2330',f.options.quote],['2317',g.options.quote],['9999',{...g.options.quote,code:'9999'}]]),sectorMap:new Map(['2330','2317','9999'].map(c=>[c,f.options.sector])),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:3},p=S.pool(bundle);
 const scan=await S.scan({pool:p,batchSize:1,fetchBatch:async items=>({type:'MOMENTUM_DEEP_SCAN',results:items.map(i=>i.code==='9999'?{code:i.code,ok:false,error:'資料受限',failureCode:'DATA_INVALID'}:{code:i.code,ok:true,data:i.code==='2330'?f.report:g.report})})});
 assert.deepEqual(scan.candidates.map(c=>c.code),['2317','2330']);assert.equal(scan.failed,1);assert.equal(scan.complete,false);assert.equal(scan.inputAccounting.input,scan.inputAccounting.excluded+scan.inputAccounting.processed+scan.inputAccounting.pending+scan.inputAccounting.deferred);
 assert.equal(scan.release,'V9.1');S.assertSnapshot(scan);const bad=structuredClone(scan);bad.candidates[0].features.ma5.today++;assert.throws(()=>S.assertSnapshot(bad));
 assert.throws(()=>S.assertSnapshot({...scan,model:'2560-STRATEGY-V1.0'}));});
test('zero-qualified complete market differs from incomplete and never invents eight',async()=>{
 for(const ok of [true,false]){const f=fixture(Array(61).fill(100)),p=S.pool({map:new Map([['2330',f.options.quote]]),sectorMap:new Map([['2330',f.options.sector]]),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:1}),s=await S.scan({pool:p,fetchBatch:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'2330',ok,data:ok?f.report:null,error:'未完成'}]})});
 assert.equal(s.candidates.length,0);assert.equal(s.fullMarketCertified,ok);assert.match(s.text,ok?/今日2560無符合條件的股票/:/不能代表全市場0檔/);
 }});
test('other five and archived restaurant engines remain byte-identical to baseline',()=>{const crypto=require('node:crypto'),b=require('../fixtures/v90-protected-baseline.json'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');for(const[p,h]of Object.entries(b.sha256))assert.equal(hash(fs.readFileSync(p)),h,p);const html=fs.readFileSync('index.html','utf8'),inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(hash(JSON.stringify(inline)),b.inlineSha256);});
