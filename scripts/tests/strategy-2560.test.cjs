'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../../strategy-2560-v1'),S=require('../../strategy-2560-scanner-v1'),{fixture,refresh}=require('../strategy-2560-fixture.cjs');
const run=f=>C.evaluate(f.report,f.options),check=(a,key)=>a.checks.find(x=>x.key===key);
test('V9.1 default requires completed MA25 new breakout, VMA5>VMA60, MA5>MA40',()=>{
 const f=fixture(),a=run(f),b=f.report.canonicalBars;
 assert.equal(a.status,'PASS');assert.equal(a.eligible,true);assert.equal(C.qualifies(a),true);assert.equal(a.checks.length,3);
 assert.deepEqual(C.CHECK_KEYS,['9041','9012','533']);
 for(const n of [5,25,40])assert.equal(a.features['ma'+n].today,b.slice(-n).reduce((s,x)=>s+x.close,0)/n);
 assert.equal(a.features.vma5,b.slice(-5).reduce((s,x)=>s+x.volume,0)/5);
 assert.equal(a.features.vma60,b.slice(-60).reduce((s,x)=>s+x.volume,0)/60);
 assert.equal(a.rule.volumeEvidence,'PARTIAL_VERIFIED_VMA5_GT_VMA60');
 assert.equal(a.score,null);assert.equal(a.exitWarning,null);
});
test('#9041 yesterday close below MA25 and today breakout passes',()=>{
 const x=[...Array(58).fill(100),99,110],a=run(fixture(x));
 assert.ok(a.features.previousClose<a.features.ma25.previous);assert.equal(check(a,'9041').pass,true);
});
test('#9041 yesterday close equal MA25 and today above passes',()=>{
 const a=run(fixture());assert.equal(a.features.previousClose,a.features.ma25.previous);assert.equal(check(a,'9041').pass,true);
});
test('#9041 yesterday already above MA25 is not new breakout',()=>{
 const a=run(fixture([...Array(58).fill(100),105,110]));assert.equal(check(a,'9041').pass,false);assert.equal(a.eligible,false);assert.equal(a.status,'FAIL');
});
test('#9041 today close exactly MA25 does not qualify',()=>{
 const a=run(fixture(Array(60).fill(100)));assert.equal(a.features.close,a.features.ma25.today);assert.equal(check(a,'9041').pass,false);
});
test('#533 strictly MA5>MA40, never demands today's new cross',()=>{
 const a=run(fixture());assert.equal(check(a,'533').pass,true);
 const equal=run(fixture(Array(60).fill(100))),below=run(fixture([...Array(59).fill(100),90]));
 assert.equal(equal.features.ma5.today,equal.features.ma40.today);
 assert.equal(check(equal,'533').pass,false);assert.ok(below.features.ma5.today<below.features.ma40.today);assert.equal(check(below,'533').pass,false);
});
test('#9012 VMA5 greater/equal/less than VMA60',()=>{
 const pass=run(fixture());assert.equal(check(pass,'9012').pass,true);
 for(const [v,expected] of [[1e6,false],[5e5,false]]){
  const f=fixture();f.report.canonicalBars.forEach((b,i)=>b.volume=i>=55?v:1e6);refresh(f);
  const a=run(f);assert.equal(check(a,'9012').pass,expected);
  if(v===1e6)assert.equal(a.features.vma5,a.features.vma60);
  else assert.ok(a.features.vma5<a.features.vma60);
  assert.equal(a.status,'FAIL');
 }
});
test('all three mandatory checks must pass; independent risk flags do not veto',()=>{
 const a=run(fixture());assert.equal(C.qualifies({...a,checks:a.checks.map(x=>({...x,pass:x.key==='9012'?false:x.pass}))}),false);
 assert.equal(run(fixture(Array(60).fill(100))).eligible,false);
 assert.equal(a.warnings.some(w=>w.includes('部分還原')),true);
 assert.equal(a.risk.volumeRuleCompleteness,'PARTIAL_VERIFIED');
});
test('old MA5 and MA25 simultaneous slope-up restriction is removed',()=>{
 const falling=[90,80,100,80,120,100,150,150,90,80,120,120,100,80,110,110,90,90,100,90,70,110,70,130,120,90,130,70,150,120,90,110,130,70,150,90,80,110,90,110,70,120,80,120,100,150,80,110,80,70,80,90,80,90,130,90,110,150,90,110];
 const a=run(fixture(falling));assert.equal(a.status,'PASS');assert.ok(a.features.ma5.today<a.features.ma5.previous);assert.ok(a.features.ma25.today<a.features.ma25.previous);
});
test('risk observations are descriptive, not auto-sell or secret eligibility gates',()=>{
 const a=run(fixture());assert.equal(a.exitWarning,null);assert.match(a.exitLabel,/尚未指定出場策略/);assert.ok(a.features.breakoutPct>0);assert.ok(a.features.volumeRatio>1);
 assert.ok(Number.isFinite(a.features.upperShadowShare));assert.ok(Number.isFinite(a.features.bodyShare));assert.equal(a.risk.supportObservation.guaranteed,false);
});
for(const [name,change,expected] of Object.entries({
 short:[f=>{f.report.canonicalBars.shift();f.report.dailySeries.shift();},'INSUFFICIENT_DATA'],
 calendar:[f=>delete f.report.expectedTradingDates,'INSUFFICIENT_DATA'],
 basis:[f=>f.report.priceAdjustment.verified=false,'DATA_ERROR'],
 unit:[f=>f.report.volumeUnit='lots','DATA_ERROR'],
 wrongCode:[f=>f.options.code='9999','DATA_ERROR'],
 wrongDate:[f=>f.options.quote.quoteDate='2020-01-01','DATA_ERROR'],
 unfinished:[f=>f.report.completed=false,'INSUFFICIENT_DATA'],
 quoteMismatch:[f=>f.options.quote.close+=.01,'DATA_ERROR'],
 unknownSector:[f=>f.options.sector={},'INSUFFICIENT_DATA'],
 wrongBar:[f=>f.report.canonicalBars.at(-1).stock='9999','DATA_ERROR'],
 future:[f=>f.report.canonicalBars.at(-1).date='2099-01-01','DATA_ERROR']
}))test('data firewall rejects '+name,()=>{const f=fixture();change(f);assert.equal(run(f).status,expected);assert.equal(run(f).eligible,false);});
test('financials and ETFs excluded; other five engines and industry exclusions unchanged',()=>{
 for(const sector of [{industryCode:'17'},{industryName:'金融保險'}]){const f=fixture();f.options.sector=sector;assert.equal(run(f).status,'EXCLUDED');}
 const f=fixture();f.options.quote.securityType='ETF';assert.equal(run(f).status,'EXCLUDED');
 const g=fixture();g.options.sector={industryCode:'22',industryName:'生技醫療'};assert.equal(run(g).status,'PASS');
});
test('repeatable frozen outputs never mutate caller data',()=>{
 const f=fixture(),before=JSON.stringify(f),a=run(f),b=run(f);assert.deepEqual(a,b);assert.equal(JSON.stringify(f),before);assert.equal(Object.isFrozen(a),true);assert.equal(Object.isFrozen(f.report),false);
});
test('scanner refuses prior V9.0 snapshots, tampering, duplicate codes and partial market claims',async()=>{
 const f=fixture(),g=fixture(undefined,'2317'),bundle={map:new Map([['2330',f.options.quote],['2317',g.options.quote],['9999',{...g.options.quote,code:'9999'}]]),sectorMap:new Map(['2330','2317','9999'].map(c=>[c,f.options.sector])),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:3};
 const p=S.pool(bundle);let calls=0;
 const scan=await S.scan({pool:p,batchSize:1,fetchBatch:async items=>{calls++;return {type:'MOMENTUM_DEEP_SCAN',results:items.map(i=>i.code==='9999'?{code:i.code,ok:false,error:'資料受限',failureCode:'DATA_INVALID'}:{code:i.code,ok:true,data:i.code==='2330'?f.report:g.report})};}});
 assert.equal(calls,3);assert.deepEqual(scan.candidates.map(c=>c.code),['2317','2330']);assert.equal(scan.complete,false);assert.equal(scan.release,'V9.1');
 assert.equal(scan.inputAccounting.input,scan.inputAccounting.excluded+scan.inputAccounting.processed+scan.inputAccounting.pending+scan.inputAccounting.deferred);
 S.assertSnapshot(scan);const bad=structuredClone(scan);bad.candidates[0].features.ma5.today++;assert.throws(()=>S.assertSnapshot(bad));assert.throws(()=>S.assertSnapshot({model:'2560-STRATEGY-V1.0'}));
});
test('certified zero and incomplete zero differ; never fill to eight',async()=>{
 for(const ok of [true,false]){const f=fixture(Array(60).fill(100)),p=S.pool({map:new Map([['2330',f.options.quote]]),sectorMap:new Map([['2330',f.options.sector]]),meta:{targetTradeDate:f.date,marketCoverageReady:true},snapshotRows:1}),s=await S.scan({pool:p,fetchBatch:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'2330',ok,data:ok?f.report:null,error:'未完成'}]})});assert.equal(s.candidates.length,0);assert.equal(s.fullMarketCertified,ok);assert.match(s.text,ok?/今日2560無符合條件的股票/:/不能代表全市場0檔/);}
});
test('protected five strategy engines and inline strategy code remain byte-identical',()=>{
 const crypto=require('node:crypto'),b=require('../fixtures/v90-protected-baseline.json'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 for(const[p,h]of Object.entries(b.sha256))assert.equal(hash(fs.readFileSync(p)),h,p);
 const html=fs.readFileSync('index.html','utf8'),inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.equal(hash(JSON.stringify(inline)),b.inlineSha256);
});
