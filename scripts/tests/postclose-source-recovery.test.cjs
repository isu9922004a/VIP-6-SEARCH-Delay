'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../taiex-source-recovery.cjs'),Retry=require('../retry-transient.cjs');
const date='2026-11-10',raw={index:'TAIEX',type:'MARKET_INDEX',closeDate:date,dailySeries:[{date}]},response=x=>({ok:true,text:async()=>JSON.stringify(x)});
test('an HTML success-status error page is a retryable transport failure, not JSON market data',async()=>{
 await assert.rejects(R.json('https://example.invalid/',{fetcher:async()=>({ok:true,text:async()=>'<html>temporarily unavailable</html>'})}),/TEMPORARY_NON_JSON/);
 let count=0;const sleeps=[];assert.equal(await Retry.retry('node',['source'],{run:()=>++count<3?{status:1,stderr:'TEMPORARY_NON_JSON source returned HTML'}:{status:0},sleep:async n=>sleeps.push(n),write:()=>{}}),0);assert.deepEqual(sleeps,[20000,40000]);
 await assert.rejects(R.json('https://example.invalid/',{fetcher:async()=>({ok:true,text:async()=>'{broken json'})}),SyntaxError);
});
test('a verified current Worker response does not trigger redundant recovery',async()=>{
 assert.deepEqual(await R.load({expected:date,fetcher:async()=>response(raw),fallback:()=>assert.fail('already current')}),raw);
});
test('HTML and stale Worker responses recover only the expected official session',async()=>{
 for(const fetcher of [async()=>({ok:true,text:async()=>'<html>error</html>'}),async()=>response({...raw,closeDate:'2026-11-09'})]){const out=await R.load({expected:date,fetcher,fallback:async()=>({...raw,officialSourceRecovery:{priceSource:'https://www.twse.com.tw/indicesReport/MI_5MINS_HIST'}})});assert.equal(out.closeDate,date);assert.ok(out.officialSourceRecovery.workerFailure);}
 await assert.rejects(R.load({expected:date,fetcher:async()=>response({...raw,closeDate:'2026-11-09'}),fallback:async()=>({...raw,closeDate:'2026-11-09'})}),/recovery date mismatch/);
});
test('official recovery reuses the original Worker OHLC/volume builders without synthetic candles',async()=>{
 const W=await import('../../market-worker.mjs'),f=require('../fixtures/taiex-wave-20261106.json'),bars=f.dailySeries,expected=bars.at(-1).date;
 const module={...W,fetchTaiexHistoryOfficial:async()=>({rows:bars,monthKeys:['202611']}),fetchTaiexMarketVolumeOfficial:async()=>({rows:bars.map(b=>({date:b.date,volume:b.volume})),monthKeys:['202611']})};
 const out=await R.official({workerModule:module,expected});assert.equal(out.index,'TAIEX');assert.equal(out.closeDate,expected);assert.deepEqual(out.dailySeries,W.buildTaiexDailySeries(bars,bars.map(b=>({date:b.date,volume:b.volume})),120));assert.equal(out.close,bars.at(-1).close);assert.equal(out.officialSourceRecovery.priceSource,'https://www.twse.com.tw/indicesReport/MI_5MINS_HIST');
 await assert.rejects(R.official({workerModule:{...module,fetchTaiexMarketVolumeOfficial:async()=>({rows:[],monthKeys:[]})},expected}),/未完整對齊/);
});
test('rerun publication uses distinct artifacts and supported action timeouts',()=>{
 const fs=require('node:fs'),path=require('node:path'),s=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows/deploy-data-pages.yml'),'utf8');
 assert.equal((s.match(/artifact_name: \$\{\{ inputs.artifact-name \}\}-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/g)||[]).length,3);assert.match(s,/name: \$\{\{ inputs.artifact-name \}\}-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);assert.doesNotMatch(s,/timeout: 1200000/);assert.match(s,/timeout: 600000/);
});
