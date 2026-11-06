'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),source=fs.readFileSync(require('node:path').join(__dirname,'../../market-report-refresh-v864.js'),'utf8');
const report=(date='2026-11-05',close=41574.72)=>({index:'TAIEX',closeDate:date,close,dailySeriesMeta:{onlyCompletedBars:true},ma20:46640,fib:{A:null},dailyRsi5:9.02});
function harness(initial=report()){
 const calls=[],renders=[],context={URL,AbortController,setTimeout,clearTimeout,Date,console,lastMarketReportData:initial,document:{baseURI:'https://example.org/site/'},renderMarketWorkerData:d=>renders.push(d),ShitouMarketFreshness:{historyStatus:()=>({expectedDate:'2026-11-05'})}};
 vm.runInNewContext(source,context);const api=context.ShitouMarketReportRefresh;
 const fetcher=(incoming,history={closeDate:'2026-11-05'})=>async(url,options)=>{calls.push({url:String(url),options});return {ok:true,json:async()=>String(url).includes('workers.dev')?incoming:history};};
 return {api,context,calls,renders,fetcher};
}
test('fingerprint tracks corrected prices, indicators, dates and ABC, excluding transport timestamps',()=>{
 const h=harness(),base=report();assert.equal(h.api.fingerprint({...base,generatedAt:'one'}),h.api.fingerprint({...base,generatedAt:'two'}));
 for(const patch of [{close:42000},{closeDate:'2026-11-06'},{dailyRsi5:50},{ma20:42000},{fib:{A:40000}},{N_STATUS:'CONFIRMED'}])assert.notEqual(h.api.fingerprint(base),h.api.fingerprint({...base,...patch}));
});
test('export refresh bypasses HTTP cache and accepts same-day corrections without combining snapshots',async()=>{
 const h=harness(),next={...report(),close:41580,ma20:46641,dailyRsi5:10};const a=h.api.refresh({fetcher:h.fetcher(next)}),b=h.api.refresh({fetcher:()=>assert.fail('pending refresh must be shared')});assert.equal(a,b);const result=await a;
 assert.equal(result.changed,true);assert.equal(h.context.lastMarketReportData,next);assert.equal(h.renders.length,1);assert.equal(h.calls.length,2);assert.ok(h.calls.every(c=>c.options.cache==='no-store'&&c.url.includes('_report_update=')));
});
test('older and incomplete snapshots do not replace the current complete report',async()=>{
 const current=report('2026-11-06',42001),h=harness(current);const old=await h.api.refresh({fetcher:h.fetcher(report())});assert.equal(old.ready,false);assert.match(old.notice,/較早/);assert.equal(h.context.lastMarketReportData,current);
 const incomplete={...report('2026-11-06',43000),dailySeriesMeta:{onlyCompletedBars:false}};const partial=await h.api.refresh({fetcher:h.fetcher(incomplete)});assert.equal(partial.ready,false);assert.equal(h.context.lastMarketReportData,current);assert.equal(h.renders.length,0);
});
test('official newer date is labelled instead of relabelling an older quote',async()=>{
 const h=harness(),r=await h.api.refresh({fetcher:h.fetcher(report(),{closeDate:'2026-11-06'})});assert.equal(r.ready,false);assert.match(r.notice,/2026-11-06/);assert.equal(h.context.lastMarketReportData.closeDate,'2026-11-05');
});
test('late response cannot overwrite a manually replaced market query',async()=>{
 const h=harness();let finish;const wait=new Promise(r=>finish=r),next=report('2026-11-06',42000);
 const job=h.api.refresh({fetcher:async url=>{if(String(url).includes('workers.dev'))await wait;return {ok:true,json:async()=>String(url).includes('workers.dev')?next:{closeDate:'2026-11-05'}};}});
 const manual=report('2026-11-06',42500);h.context.lastMarketReportData=manual;finish();const result=await job;assert.equal(result.changed,false);assert.equal(h.context.lastMarketReportData,manual);assert.equal(h.renders.length,0);
});
test('temporary connection failures retain the real date, recover without caching failure, and retry',async()=>{
 const h=harness(),old=h.context.lastMarketReportData;let count=0;const failed=await h.api.refresh({fetcher:async()=>{count++;throw Error('aborted');}});assert.equal(failed.ready,false);assert.match(failed.notice,/暫未核對/);assert.equal(h.context.lastMarketReportData,old);assert.equal(count,4);
 const next=report('2026-11-06',42000),ok=await h.api.refresh({fetcher:h.fetcher(next)});assert.equal(ok.ready,true);assert.equal(h.context.lastMarketReportData,next);assert.equal(h.api.intervalMs,300000);
});
