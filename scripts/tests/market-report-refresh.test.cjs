'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../market-report-refresh-v864.js'),'utf8'),snapshot=require('../../data/index/TAIEX.json'),S=require('../../structure-context-v1'),F=require('../../research-v83/market-freshness');
const freshTime=new Date(snapshot.closeDate+'T14:00:00Z');
async function harness(initial=null){
 const calls=[],renders=[],context={URL,AbortController,setTimeout,clearTimeout,Date,console,lastMarketReportData:initial,document:{baseURI:'https://example.org/site/'},renderMarketWorkerData:d=>renders.push(d),ShitouStructureContext:S,ShitouMarketFreshness:F};
 vm.runInNewContext(source,context);const api=context.ShitouMarketReportRefresh,calculator=(await import('../../market-worker.mjs')).buildTaiexReportFromHistory;
 const fetcher=(history=snapshot)=>async(url,options)=>{calls.push({url:String(url),options});return {ok:true,json:async()=>structuredClone(history)};};
 const refresh=options=>api.refresh({now:freshTime,calculator,...options});return {api,context,calls,renders,fetcher,refresh,calculator};
}
test('fingerprint includes prices and indicators, excluding transport timestamps',async()=>{
 const h=await harness(),base={close:42000,ma20:43000,fib:{A:40000}};
 assert.equal(h.api.fingerprint({...base,generatedAt:'one'}),h.api.fingerprint({...base,generatedAt:'two'}));
 for(const patch of [{close:42001},{closeDate:'2026-11-06'},{dailyRsi5:50},{ma20:42000},{fib:{A:40001}}])assert.notEqual(h.api.fingerprint(base),h.api.fingerprint({...base,...patch}));
});
test('May screenshot is replaced by verified completed index; initial lookup and PNG share one calculation',async()=>{
 const h=await harness({index:'TAIEX',closeDate:'2026-05-29',close:44732.94,ma20:41932.92,fib:{A:1}});
 const job=h.refresh({fetcher:h.fetcher()}),same=h.refresh({fetcher:()=>assert.fail('coalesce pending')});assert.equal(job,same);const r=await job;
 const expected=h.calculator({rows:snapshot.dailySeries,dailySeries:snapshot.dailySeries,dailySeriesMeta:snapshot.dailySeriesMeta});
 assert.equal(r.ready,true);assert.equal(r.changed,true);assert.equal(r.data.closeDate,snapshot.closeDate);assert.equal(r.data.close,snapshot.close);
 for(const key of ['ma5','ma10','ma20','ma60','dailyRsi5','change','changePct','N_STATUS'])assert.equal(r.data[key],expected[key]);assert.deepEqual(r.data.fib,expected.fib);
 assert.equal(r.data.dailySeries.at(-1).date,r.data.closeDate);assert.equal(r.data.dailySeries.at(-1).close,r.data.close);assert.equal(r.data.calculationWindowBars,snapshot.dailySeries.length);
 assert.equal(h.calls.length,1);assert.match(h.calls[0].url,/data\/index\/TAIEX.json.*_report_update=/);assert.equal(h.calls[0].options.cache,'no-store');assert.equal(h.renders.length,1);
 const first=await harness();assert.equal((await first.refresh({fetcher:first.fetcher()})).ready,true);
});
test('same-day verified corrections update every derived value without merging old indicators',async()=>{
 const h=await harness();await h.refresh({fetcher:h.fetcher()});const before=h.context.lastMarketReportData,corrected=structuredClone(snapshot),last=corrected.dailySeries.at(-1);last.close=+(last.close+.01).toFixed(2);last.high=Math.max(last.high,last.close);corrected.close=last.close;
 const r=await h.refresh({fetcher:h.fetcher(corrected)});assert.equal(r.ready,true);assert.notEqual(r.data.ma20,undefined);assert.notEqual(r.data.close,before.close);assert.equal(r.data.close,corrected.close);assert.equal(snapshot.close,before.close);
});
test('reject stale dates, future dates, missing sessions, incomplete candles and conflicting source evidence',async()=>{
 const mutations=[h=>{h.closeDate=h.dailySeries.at(-2).date;h.dailySeries.pop();h.close=h.dailySeries.at(-1).close;h.dailySeriesMeta.lastDate=h.closeDate;},h=>h.completed=false,h=>h.dailySeries.splice(-9,1),h=>h.dailySeries.at(-1).completed=false,h=>h.volumeUnit='lots',h=>h.market='TPEX_INDEX',h=>h.priceAdjustment.verified=false,h=>h.volumeSourceConflict=true,h=>h.close+=1,h=>h.dailySeriesMeta.lastDate='2026-05-29',h=>h.dailySeries.at(-1).volume=0,h=>h.tradingCalendar.verified=false,h=>h.provenance='ILLUSTRATION'];
 for(const mutate of mutations){const h=await harness(),bad=structuredClone(snapshot);mutate(bad);const r=await h.refresh({fetcher:h.fetcher(bad)});assert.equal(r.ready,false);assert.equal(h.context.lastMarketReportData,null);assert.equal(h.renders.length,0);}
});
test('never roll back a newer report or let a late request overwrite a different query',async()=>{
 const existing={index:'TAIEX',closeDate:'2099-12-31',close:43000},h=await harness(existing),r=await h.refresh({fetcher:h.fetcher()});assert.equal(r.ready,false);assert.match(r.error,/較早/);assert.equal(h.context.lastMarketReportData,existing);
 const x=await harness();let finish;const wait=new Promise(r=>finish=r),job=x.refresh({fetcher:async()=>{await wait;return {ok:true,json:async()=>snapshot};}});x.context.lastMarketReportData=existing;finish();assert.equal((await job).ready,false);assert.equal(x.context.lastMarketReportData,existing);
});
test('connection failure retries without negative caching and never marks an old quote current',async()=>{
 const old={index:'TAIEX',closeDate:'2026-05-29',close:44732.94},h=await harness(old);let count=0;const failed=await h.refresh({fetcher:async()=>{count++;throw Error('aborted');}});assert.equal(count,2);assert.equal(failed.ready,false);assert.match(failed.notice,/暫未核對/);assert.equal(h.context.lastMarketReportData,old);
 assert.equal((await h.refresh({fetcher:h.fetcher()})).ready,true);assert.equal(h.api.intervalMs,300000);
});
test('weekends keep last verified trading date; a pending weekday requires its actual completed daily bar',async()=>{
 const h=await harness(),cal=structuredClone(snapshot);cal.tradingCalendar.dates=[...cal.tradingCalendar.dates];
 const next=cal.tradingCalendar.dates.find(d=>d>cal.closeDate);assert.ok(next);const after=new Date(next+'T14:00:00Z');assert.equal((await h.refresh({fetcher:h.fetcher(cal),now:after})).ready,false);
 // A verified holiday/weekend is not filled with a fabricated bar.
 const end=new Date(cal.closeDate+'T14:00:00Z');end.setUTCDate(end.getUTCDate()+1);if(end.toISOString().slice(0,10)<next)assert.equal((await h.refresh({fetcher:h.fetcher(cal),now:end})).ready,true);
});
test('actual query delegates to the verified loader and export blocks an unverified refresh',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8'),query=html.slice(html.indexOf('async function analyzeMarketIndex(){'),html.indexOf('async function copyMarketReport(){'));
 assert.match(query,/ShitouMarketReportRefresh.refresh/);assert.match(query,/if\(!refreshed.ready\)throw/);assert.doesNotMatch(query,/fetch\(/);
 const suite=fs.readFileSync(path.join(__dirname,'../../r45-report-suite.js'),'utf8');assert.match(suite,/if\(!fresh.ready\)throw new Error/);
});
