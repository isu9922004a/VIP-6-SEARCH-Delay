'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../../worker-data-contract-v1.js'),D=require('../../selection-data-v2.js'),H=require('../../deep-scan-health-v1.js');
const captured=require('../../evidence/daily.json'),snapshot=require('../../evidence/snapshot.json');
const clone=x=>structuredClone(x),root=path.resolve(__dirname,'../..');
const bindCaptured=()=>{D.reset();D.bind({map:new Map(snapshot.rows.map(q=>[q.code,q])),meta:snapshot.meta,snapshotRows:snapshot.rows.length});};
const base=()=>clone(captured.results.find(x=>x.code==='4526').data);
const sealed=()=>C.seal(base(),{evidence:C.unitEvidence(['YAHOO_CHART','TWSE_MIS'])});
const worker=()=>import('../../market-worker.mjs');
function simulatedSeries(target='2026-10-22',calendar={closures:[]}){
 // Explicit simulated fixture; prices/volume are not actual market evidence.
 const fallback=new Set(['2026-10-09','2026-09-25','2026-09-28','2026-10-23','2026-10-26','2026-01-01']);
 const closed=new Set([...fallback,...calendar.closures.map(x=>x.date.replace(/-/g,''))]);
 const rows=[];for(let t=Date.parse(target+'T00:00:00Z');rows.length<60;t-=86400000){const d=new Date(t),date=d.toISOString().slice(0,10);if(d.getUTCDay()%6&&!closed.has(date)&&!closed.has(date.replace(/-/g,'')))rows.unshift({date,open:10,high:12,low:9,close:11,volume:100000});}return rows;
}
function simulatedReport(rows,code='1101',market='TWSE'){
 return {stock:code,market,scanMode:'DAILY_ONLY',dailyOnly:true,closeDate:rows.at(-1).date,close:rows.at(-1).close,dailySeries:clone(rows),canonicalBars:clone(rows),dailySeriesMeta:{schema:'daily-ohlcv-v1',mode:'DAILY_ONLY',source:'Yahoo Finance history (R4.9.3 DAILY_ONLY)',returnedBars:rows.length,completedDailyRowsAvailable:rows.length,completeOhlcvRowsAvailable:rows.length,firstDate:rows[0].date,lastDate:rows.at(-1).date,ascending:true,onlyCompletedBars:true}};
}
function bridge(rows,calendar={closures:[]}){return {ready:true,marketCalendar:calendar,rows:new Map([['1101',{...rows.at(-1),market:'TWSE'}]])};}
test('captured production responses are real evidence, without claiming the historic failure reproduced',()=>{
 bindCaptured();for(const x of captured.results){assert.equal(x.ok,true);if(x.code==='6173')assert.throws(()=>D.validate(x.data,x.code),/歷史成交量非正整數|日K含零量/);else assert.doesNotThrow(()=>D.validate(x.data,x.code));}
 const evidence=require('../../evidence/production-capture.json');assert.equal(evidence.readOnly,true);assert.equal(evidence.responses.daily.status,200);
});
test('structured unit contract accepts a changed display source and preserves raw input',()=>{
 bindCaptured();const r=sealed();r.dailySeriesMeta.source+=' + verified official historical gap recovery';const before=JSON.stringify(r),p=D.remember(r,r.stock);
 assert.equal(JSON.stringify(r),before);assert.equal(p.originalHistoryFingerprint,C.fingerprint(r.originalDailySeries));assert.equal(p.responseHistoryFingerprint,C.fingerprint(r.dailySeries));assert.ok(Object.isFrozen(p.rawBars[0]));
});
for(const [name,mutate] of [
 ['unknown adapter',r=>r.dataContract.volumeUnitSource[0].adapter='UNVERIFIED'],
 ['source-only recovery claim',r=>{r.dataContract.officialRecoveryApplied=true;r.dailySeriesMeta.source+=' + verified official historical gap recovery';}],
 ['forged recovery row',r=>{r.dataContract.officialRecoveryApplied=true;r.dataContract.officialRecoveryEvidence=[{date:r.closeDate,stock:r.stock,market:'TPEX',adapter:'VERIFIED_LATEST_SNAPSHOT',volumeUnit:'shares',rowFingerprint:'fake'}];}],
 ['source unit conflict',r=>r.dataContract.volumeUnitSource[0].inputUnit='lots'],
 ['unknown series schema',r=>r.dailySeriesMeta.schema='unknown'],['mode conflict',r=>r.dataContract.sourceMode='FULL'],
 ['report unit conflict',r=>r.volumeUnit='lots'],['wrong stock',r=>r.stock='1101'],['wrong market',r=>r.market='TPEX'],
 ['date conflict',r=>r.closeDate='2026-10-21'],['uncompleted',r=>r.dataContract.completed=false],
 ['immutable original changed',r=>r.originalDailySeries[0].volume++],['normalized history changed',r=>r.dailySeries[0].volume++],
 ['over 20% volume difference',r=>{r.dailySeries.at(-1).volume*=2;r.dataContract.normalizedHistoryFingerprint=C.fingerprint(r.dailySeries);}],
 ['OHLC mismatch',r=>{r.dailySeries.at(-1).close-=2;r.dataContract.normalizedHistoryFingerprint=C.fingerprint(r.dailySeries);}]
])test('structured contract rejects '+name,()=>{bindCaptured();const r=sealed();mutate(r);assert.throws(()=>D.remember(r,'4526'));assert.equal(D.get('4526'),null);});
test('a raw final-volume update below 20% is detected even if normalized volume is identical',()=>{
 bindCaptured();const a=base(),old=D.remember(a,a.stock),b=clone(a);b.dailySeries.at(-1).volume++;
 assert.throws(()=>D.remember(b,b.stock),/同一快照收到不同歷史序列.*volume/);assert.equal(D.get(a.stock),old);
});
test('canonical receipts can be revalidated without losing original volume identity',()=>{
 bindCaptured();const r=sealed(),p=D.remember(r,r.stock),aligned=D.apply(r,r.stock);assert.notEqual(aligned.dailyBasisV2.originalHistoryFingerprint,undefined);
 assert.equal(D.remember(aligned,r.stock).responseHistoryFingerprint,p.responseHistoryFingerprint);
 assert.equal(D.apply(aligned,r.stock).dailyBasisV2.responseHistoryFingerprint,p.responseHistoryFingerprint);
});
test('legacy FULL receipts retain their DAILY_ONLY origin across repeated application and cache restoration',()=>{
 const f=require('../fixtures/9933-worker-responses-20261022.json');D.reset();D.bind({map:new Map(f.snapshot.rows.map(q=>[q.code,q])),meta:f.snapshot.meta,snapshotRows:f.snapshot.rows.length});
 D.remember(clone(f.daily.results[0].data),'9933');const receipt=D.apply(clone(f.stock),'9933'),again=D.apply(receipt,'9933');
 assert.equal(again.dailyBasisV2.responseHistoryFingerprint,receipt.dailyBasisV2.responseHistoryFingerprint);assert.doesNotThrow(()=>D.remember(receipt,'9933'));
});
test('FULL cannot borrow valid canonical history to conceal corrupt supplied OHLC',()=>{
 bindCaptured();const r=base();D.remember(r,r.stock);const invalid=clone(r);invalid.dailySeries[5].low=invalid.dailySeries[5].high+1;assert.throws(()=>D.apply(invalid,r.stock),/OHLCV無效/);assert.ok(D.get(r.stock));
});
test('a bare shares declaration or unknown provider cannot manufacture source evidence',()=>{
 bindCaptured();const r=base();delete r.dailySeriesMeta.schema;r.volumeUnit='shares';r.completed=true;assert.throws(()=>D.remember(r,r.stock),/單位.*來源契約/);
 const unknown=base();unknown.volumeUnit='shares';unknown.dailySeriesMeta.source='UNKNOWN_PROVIDER';assert.throws(()=>D.remember(unknown,unknown.stock),/來源契約/);
 r.workerDataAudit={volumeUnitSource:'FORGED'};assert.throws(()=>D.remember(r,r.stock),/來源契約/);
});
test('concurrent acquisition coalesces requests and does not mutate caller reports',async()=>{
 bindCaptured();const r=base(),before=JSON.stringify(r);let calls=0,release;D.setFetcher(()=>{calls++;return new Promise(resolve=>release=resolve);});
 const a=D.ensure([{code:r.stock}]),b=D.ensure([{code:r.stock}]);assert.equal(calls,1);release({type:'MOMENTUM_DEEP_SCAN',results:[{code:r.stock,ok:true,data:r}]});await Promise.all([a,b]);assert.equal(JSON.stringify(r),before);
});
test('snapshot rebind cancels old acquisition without deleting a newer pending request',async()=>{
 bindCaptured();const r=base(),jobs=[];D.setFetcher(()=>new Promise(resolve=>jobs.push(resolve)));
 const old=D.ensure([{code:r.stock}]);const rejection=assert.rejects(old,/快照已改變/);
 const updated=clone(snapshot);updated.meta.snapshotContentSha256='new-content-revision';D.bind({map:new Map(updated.rows.map(q=>[q.code,q])),meta:updated.meta,snapshotRows:updated.rows.length});
 const fresh=D.ensure([{code:r.stock}]);jobs[0]({type:'MOMENTUM_DEEP_SCAN',results:[{code:r.stock,ok:true,data:r}]});await rejection;assert.equal(D.get(r.stock),null);
 const also=D.ensure([{code:r.stock}]);assert.equal(jobs.length,2);jobs[1]({type:'MOMENTUM_DEEP_SCAN',results:[{code:r.stock,ok:true,data:r}]});await Promise.all([fresh,also]);assert.ok(D.get(r.stock));
});
test('an async conflicting response cannot overwrite an independently remembered valid cache',async()=>{
 bindCaptured();const r=base();let finish;D.setFetcher(()=>new Promise(resolve=>finish=resolve));const job=D.ensure([{code:r.stock}]);const valid=D.remember(r,r.stock),bad=clone(r);bad.dailySeries[0].volume++;
 finish({type:'MOMENTUM_DEEP_SCAN',results:[{code:r.stock,ok:true,data:bad}]});await assert.rejects(job,/不同歷史序列/);assert.equal(D.get(r.stock),valid);
});
for(const removed of ['2026-10-24','2026-10-23','2026-10-26'])test('verified weekend/holiday cleanup '+removed+' synchronizes all metadata',async()=>{
 const W=await worker(),rows=simulatedSeries(),r=simulatedReport(rows);r.dailySeries.push({date:removed,open:11,high:11,low:11,close:11,volume:0});r.canonicalBars=clone(r.dailySeries);r.closeDate=removed;
 r.dailySeriesMeta.returnedBars=r.dailySeriesMeta.completedDailyRowsAvailable=r.dailySeriesMeta.completeOhlcvRowsAvailable=61;
 const out=await W.applyVerifiedDailyBridgeV2(r,'1101','TWSE',bridge(rows),null,{});assert.equal(out.ok,true,out.status);
 const d=out.data,m=d.dailySeriesMeta;for(const k of ['returnedBars','completedDailyRowsAvailable','completeOhlcvRowsAvailable','dailySeriesCount','canonicalBarCount'])assert.equal(m[k],60,k);
 assert.equal(d.canonicalBars.length,60);assert.equal(m.lastDate,'2026-10-22');assert.equal(C.verify(d).ok,true);assert.equal(d.originalDailySeries.length,61);
});
test('temporary verified closure inside history is removed; a zero-volume trading day is retained',async()=>{
 const W=await worker(),calendar={source:'SIMULATED_OFFICIAL_CALENDAR',closures:[{date:'20261021',name:'模擬臨時休市'}]},rows=simulatedSeries('2026-10-22',calendar),r=simulatedReport(rows);
 r.dailySeries.splice(-1,0,{date:'2026-10-21',open:11,high:11,low:11,close:11,volume:0});r.dailySeries[0].volume=0;
 const out=await W.applyVerifiedDailyBridgeV2(r,'1101','TWSE',bridge(rows,calendar),null,{});assert.equal(out.ok,true,out.status);assert.equal(out.data.dailySeries[0].volume,0);assert.ok(!out.data.dailySeries.some(b=>b.date==='2026-10-21'));
});
test('newer actual session and nonflat closed-session bars cannot be stripped',async()=>{
 const W=await worker(),rows=simulatedSeries();for(const row of [{date:'2026-10-27',open:10,high:12,low:9,close:11,volume:100},{date:'2026-10-24',open:10,high:12,low:9,close:11,volume:0}]){const r=simulatedReport([...rows,row]);const out=await W.applyVerifiedDailyBridgeV2(r,'1101','TWSE',bridge(rows),null,{});assert.equal(out.ok,false);}
});
test('latest verified snapshot repairs a missing bar with row evidence and exact metadata',async()=>{
 const W=await worker(),rows=simulatedSeries(),r=simulatedReport(rows.slice(0,-1)),out=await W.applyVerifiedDailyBridgeV2(r,'1101','TWSE',bridge(rows),null,{});
 assert.equal(out.ok,true,out.status);assert.equal(out.data.dailySeries.length,60);assert.equal(out.data.dataContract.officialRecoveryApplied,true);assert.equal(C.verify(out.data).ok,true);
 assert.match(out.data.dailySeriesMeta.source,/verified official historical/);
 const b=bridge(rows).rows.get('1101');D.reset();D.bind({map:new Map([['1101',{...b,quoteDate:b.date}]]),snapshotRows:1,meta:{total:1,targetTradeDate:b.date,completedTradeDate:b.date,expectedTradeDate:b.date,twseQuoteDate:b.date,tpexQuoteDate:b.date,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true}});assert.doesNotThrow(()=>D.remember(out.data,'1101'));
});
test('exact duplicate dates collapse; conflicting duplicate dates are rejected',async()=>{
 const W=await worker(),rows=simulatedSeries();for(const conflict of [false,true]){const r=simulatedReport(rows),duplicate=clone(rows[10]);if(conflict)duplicate.volume++;r.dailySeries.splice(11,0,duplicate);const out=await W.applyVerifiedDailyBridgeV2(r,'1101','TWSE',bridge(rows),null,{});assert.equal(out.ok,!conflict,out.status);}
});
test('interior official recovery creates a new identity only with a matching predecessor and immutable existing bars',async()=>{
 bindCaptured();const full=base(),missing=full.dailySeries[30],old=clone(full);old.dailySeries.splice(30,1);for(const k of ['returnedBars','completedDailyRowsAvailable','completeOhlcvRowsAvailable'])old.dailySeriesMeta[k]--;
 const prior=D.remember(old,old.stock),r=C.seal(full,{originalRows:old.dailySeries,evidence:C.unitEvidence(['YAHOO_CHART','TWSE_STOCK_DAY']),predecessor:prior.responseHistoryFingerprint,officialRecoveryEvidence:[{date:missing.date,stock:full.stock,market:'TWSE',adapter:'TWSE_STOCK_DAY',volumeUnit:'shares',rowFingerprint:C.fingerprint([missing])}]});
 const next=D.remember(r,r.stock);assert.notEqual(next.historyIdentity,prior.historyIdentity);assert.equal(next.rawBars.length,prior.rawBars.length+1);
 const changed=clone(r);changed.dailySeries[0].volume++;changed.dataContract.normalizedHistoryFingerprint=C.fingerprint(changed.dailySeries);assert.throws(()=>D.remember(changed,r.stock),/不同歷史序列/);assert.equal(D.get(r.stock),next);
});
test('official interior gap request has a bounded source failure and can recover authentic rows without interpolation',async()=>{
 const W=await worker(),rows=simulatedSeries(),removed=rows[30],r=simulatedReport(rows.filter(b=>b.date!==removed.date)),saved=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async url=>{calls++;assert.ok(String(url).includes('stockNo=1101'));return new Response(JSON.stringify({stat:'OK',data:[[removed.date,String(removed.volume),'1100000',removed.open,removed.high,removed.low,removed.close]]}),{headers:{'Content-Type':'application/json'}});};
  const out=await W.applyVerifiedDailyBridgeV2(r,'1101','TWSE',bridge(rows),null,{});assert.equal(out.ok,true,out.status);assert.equal(calls,1);assert.deepEqual(out.data.dailySeries.find(b=>b.date===removed.date),removed);assert.equal(C.verify(out.data).ok,true);
  globalThis.fetch=async()=>new Response('unavailable',{status:503});const fail=await W.applyVerifiedDailyBridgeV2(r,'1101','TWSE',bridge(rows),null,{});assert.equal(fail.ok,false);assert.match(fail.status,/SOURCE_UNAVAILABLE/);
 }finally{globalThis.fetch=saved;}
});
test('calendar gap selection respects cross-month/cross-year and known closure',async()=>{
 const W=await worker(),rows=simulatedSeries('2026-01-08'),calendar={closures:[{date:'20260101',name:'元旦'}]};assert.deepEqual(W.dailyBridgeMissingSessionsV2(rows,'2026-01-08',calendar),[]);
 const missing=rows.at(-4).date;assert.deepEqual(W.dailyBridgeMissingSessionsV2(rows.filter(b=>b.date!==missing),'2026-01-08',calendar),[missing]);
});
test('FULL and DAILY_ONLY serializer metadata distinguish upstream count from returned count',async()=>{
 const S=await import('../../stock-worker.mjs'),rows=simulatedSeries().map(b=>({...b,volumeAdapter:'YAHOO_CHART'})),returned=rows.slice(-30),m=S.buildDailySeriesMeta(rows,returned,'SIMULATED_SOURCE');
 assert.equal(m.returnedBars,30);assert.equal(m.completedDailyRowsAvailable,30);assert.equal(m.upstreamHistoryCounts.completedDailyRowsAvailable,60);
 const response=S.jsonResponse({...simulatedReport(returned),scanMode:'FULL',dailySeriesMeta:m},200,{}),body=await response.json();assert.equal(C.verify(body).ok,true);
});
test('FIB_API routes FULL / CORE / DAILY_ONLY / MOMENTUM_LITE without live network or mode mixing',async()=>{
 const W=await worker();for(const profile of ['FULL','CORE','DAILY_ONLY','MOMENTUM_LITE']){let calls=0;const env={FIB_API:{fetch:async(url)=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('stock'),'6173');assert.equal(u.searchParams.get('mode'),profile==='FULL'?null:profile==='CORE'?'SCAN_LITE':profile);if(profile==='CORE')assert.equal(u.searchParams.get('profile'),'CORE');if(['DAILY_ONLY','MOMENTUM_LITE'].includes(profile))assert.equal(u.searchParams.get('marketHint'),'TPEX');return new Response(JSON.stringify({stock:'6173',scanMode:profile}),{headers:{'Content-Type':'application/json'}});}}};
 const result=await W.fetchStockAnalysisViaProxyV265('6173','stock',env,profile,null,'TPEx');assert.equal(calls,1);assert.equal(result.data.stock,'6173');}
 await assert.rejects(W.fetchStockAnalysisViaProxyV265('6173','stock',{},'DAILY_ONLY'),/SERVICE_BINDING_MISSING/);
});
test('volume/amount range conflict is a scope uncertainty, never a fraud claim or fabricated volume',()=>{
 const q={open:10,high:12,low:9,close:11,volume:100000,tradeValue:2000000,tradeValueSource:'OFFICIAL_REPORTED'},a=C.auditQuote(q);assert.equal(a.volumeScopeAudit.formalVolumeEligible,false);assert.equal(a.volume,q.volume);assert.equal(a.tradeValue,q.tradeValue);assert.match(a.volumeScopeAudit.reason,/口徑待查證/);
 const estimated=C.auditQuote({...q,tradeValueSource:'ESTIMATED_CLOSE_X_VOLUME'});assert.equal(estimated.volumeScopeAudit.status,'AMOUNT_UNAVAILABLE');
});
test('quarantined stocks are never refetched or returned as successful in the same scan',async()=>{
 let calls=0;const audit={quarantinedCodes:['1101'],issues:[{code:'1101',failureCode:'HISTORY_CONFLICT'}]},items=[{code:'1101'},{code:'2330'}];
 const p=await H.fetchWithQuarantine(items,audit,async part=>{calls++;assert.deepEqual(part,[{code:'2330'}]);return {type:'MOMENTUM_DEEP_SCAN',results:[{code:'2330',ok:true,data:{}}]};});assert.equal(calls,1);assert.equal(p.results.find(x=>x.code==='1101').ok,false);assert.equal(p.results.find(x=>x.code==='1101').failureCode,'HISTORY_CONFLICT');
});
test('failure categories distinguish service/source/date/history and insufficient data',()=>{
 for(const [error,code] of [['SOURCE_UNAVAILABLE','SOURCE_UNAVAILABLE'],['HTTP 503','TRANSIENT_SERVICE_ERROR'],['HISTORY_CONFLICT','HISTORY_CONFLICT'],['日期不一致','STALE_DATA'],['HISTORY_TOO_SHORT','INSUFFICIENT_HISTORY'],['資料不足｜單位衝突','DATA_INVALID']])assert.equal(D.classifyFailure({error}),code);
 assert.equal(D.isDataFailure({failureCode:'SOURCE_UNAVAILABLE',error:'DATA_HISTORY_GAP｜HISTORY_GAP_SOURCE_UNAVAILABLE'}),false);
});
test('invalid market snapshot and missing same-market quorum cannot authorize scanning',async()=>{
 D.reset();await assert.rejects(H.preflight({items:[{code:'1101'}],targetDate:'2026-10-22',fetcher:async()=>({})}),e=>e.failureCode==='SYSTEMIC_FAILURE');
 bindCaptured();const x=captured.results[0],q=D.context(x.code).q;await assert.rejects(H.preflight({items:[{code:x.code,q}],targetDate:'2026-10-22',attempts:1,delayMs:0,fetcher:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[x]})}),e=>e.failureCode==='SYSTEMIC_FAILURE');
});
test('both complete Workers embed exactly the shared browser contract',()=>{
 const shared=fs.readFileSync(path.join(root,'worker-data-contract-v1.js'),'utf8');for(const file of ['stock-worker.mjs','market-worker.mjs'])assert.ok(fs.readFileSync(path.join(root,file),'utf8').startsWith('// BEGIN EMBEDDED DAILY CONTRACT\n'+shared+'\n// END EMBEDDED DAILY CONTRACT\n'));
});
