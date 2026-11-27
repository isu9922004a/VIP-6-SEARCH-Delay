'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('V9.24 frontend split preserves source exactly and defers only the four declared future modules',()=>{
 const {build}=require('../build-frontend-v924.cjs');
 const source=read('index.html'),plain=build(source),deferred=build(source,{deferFuture:true});
 assert.equal(plain.manifest.originalReconstructionIdentical,true);
 assert.equal(plain.manifest.js,13);
 assert.equal(plain.manifest.css,2);
 assert.equal(plain.files.length,15);
 assert.equal(deferred.manifest.deferred.length,4);
 assert.ok(plain.manifest.htmlBytes<plain.manifest.sourceBytes/5);
 assert.deepEqual(plain.files,deferred.files);
 assert.equal((plain.html.match(/<script\b[^>]*\bdefer\b[^>]*>/g)||[]).length+4,(deferred.html.match(/<script\b[^>]*\bdefer\b[^>]*>/g)||[]).length);
 for(const f of plain.files)assert.ok(plain.html.includes('./'+f.name+'?v=V9.24-PERF1-'+f.sha256.slice(0,12)+'"'));
});
test('institutional daily lookups are bounded, retain original candidate priority and tolerate missing sources',async()=>{
 const S=await import('../../stock-worker.mjs');
 const originalFetch=globalThis.fetch;
 let active=0,maxActive=0,calls=0;
 const dates=S.assistantRecentDatesV47(14);
 const missing=new Set([dates[1],dates[3]]);
 try {
  globalThis.fetch=async url=>{
   active++;maxActive=Math.max(maxActive,active);calls++;
   const date=new URL(url).searchParams.get('date');
   const iso=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6);
   const index=dates.indexOf(iso);
   await new Promise(resolve=>setTimeout(resolve,index%2===0?15:1));
   active--;
   if(iso===dates[3])throw Error('simulated network failure');
   const row=Array(20).fill('0');row[0]='2330';row[4]=String(index+100);row[10]='7';row[11]='8';row[18]='9';
   return new Response(JSON.stringify({stat:'OK',data:missing.has(iso)?[]:[row]}));
  };
  const rows=await S.fetchInstitutionFiveDaysV47('2330','TWSE');
  const expected=dates.filter(x=>!missing.has(x)).slice(0,5).sort();
  assert.deepEqual(rows.map(x=>x.date),expected);
  assert.deepEqual(rows.map(x=>x.foreign),expected.map(d=>dates.indexOf(d)+100));
  assert.equal(maxActive,2);
  assert.ok(calls<=8);
 }finally{globalThis.fetch=originalFetch;}
});
test('market edge only reuses current verified snapshot, expires, bypasses and never serves stale success',async()=>{
 const W=(await import('../../market-worker.mjs')).default;
 const originalFetch=globalThis.fetch,OriginalDate=globalThis.Date,cacheDesc=Object.getOwnPropertyDescriptor(globalThis,'caches');
 const snapshot=JSON.parse(read('data/market/archive/2026-11-13.json'));
 let clock=OriginalDate.parse('2026-11-13T11:00:00Z'),calls=0,puts=0,fail=false;
 const entries=new Map(),pending=[];
 const ctx={waitUntil(p){pending.push(p)}};
 const env={MARKET_SNAPSHOT_URL:'https://raw.githubusercontent.com/isu9922004a/VIP-6-SEARCH-Delay/main/data/market/latest.json'};
 const request=(query='market=ALL_STOCKS')=>new Request('https://worker-test.invalid/?'+query);
 const run=async query=>{const res=await W.fetch(request(query),env,ctx);await Promise.all(pending.splice(0));return {body:await res.json(),headers:res.headers};};
 try{
  globalThis.Date=class extends OriginalDate{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}};
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{async match(key){return entries.get(key.url)?.clone();},async put(key,value){puts++;entries.set(key.url,value.clone());}}}});
  globalThis.fetch=async()=>{calls++;return fail?new Response('bad upstream',{status:503}):new Response(JSON.stringify(snapshot),{headers:{'Content-Type':'application/json'}});};
  const first=await run();
  assert.equal(first.body.meta.marketCoverageReady,true,first.body.error);
  assert.equal(first.body.meta.industryCoverageReady,true);
  assert.equal(first.body.cached,false);assert.equal(calls,1);assert.equal(puts,1);
  const second=await run();
  assert.equal(calls,1);assert.equal(second.body.cached,true);
  assert.deepEqual(second.body.rows,first.body.rows);
  for(const key of ['targetTradeDate','expectedTradeDate','snapshotContentSha256','total'])assert.deepEqual(second.body.meta[key],first.body.meta[key],key);
  const forced=await run('market=ALL_STOCKS&nocache=1');
  assert.equal(calls,2);assert.equal(puts,1);assert.equal(forced.body.cached,false);assert.equal(forced.headers.get('Cache-Control'),'no-store');
  clock+=21000;fail=true;
  const expired=await run();
  assert.equal(calls,3);assert.equal(puts,1);
  assert.equal(expired.body.meta.marketCoverageReady,false);assert.deepEqual(expired.body.rows,[]);
  assert.equal(expired.headers.get('Cache-Control'),'no-store');
  entries.clear();fail=false;clock=OriginalDate.parse('2026-11-16T09:34:59Z');
  const preCutoff=await run();assert.equal(preCutoff.body.meta.marketCoverageReady,true,preCutoff.body.error);
  clock+=2000;fail=true;
  const postCutoff=await run();
  assert.equal(postCutoff.body.meta.marketCoverageReady,false);assert.deepEqual(postCutoff.body.rows,[]);
 }finally{
  globalThis.fetch=originalFetch;globalThis.Date=OriginalDate;
  if(cacheDesc)Object.defineProperty(globalThis,'caches',cacheDesc);else delete globalThis.caches;
 }
});
test('incomplete assistant responses are never cached; cache failures do not block lookup',async()=>{
 const W=(await import('../../stock-worker.mjs')).default;
 const oldFetch=globalThis.fetch,cacheDesc=Object.getOwnPropertyDescriptor(globalThis,'caches');
 let reads=0,writes=0,calls=0;
 try{
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{async match(){reads++;throw Error('cache unavailable');},async put(){writes++;}}}});
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify([]));};
  const req=new Request('https://stock-test.invalid/?stock=2330&assistant=1&market=TWSE');
  const res=await W.fetch(req,{}, {waitUntil(){}});
  const data=await res.json();
  assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');
  assert.equal(data.data.sourceStatus.institution,'partial');assert.equal(reads,1);assert.equal(writes,0);assert.ok(calls>0);
 }finally{
  globalThis.fetch=oldFetch;
  if(cacheDesc)Object.defineProperty(globalThis,'caches',cacheDesc);else delete globalThis.caches;
 }
});
