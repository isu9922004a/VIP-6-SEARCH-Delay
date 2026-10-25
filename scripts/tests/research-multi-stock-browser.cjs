'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/multi-stock-worker-responses-20261022.json'),out=path.resolve(process.argv[2]||path.join(root,'../multi-stock-browser'));
const byCode=new Map(fixture.records.map(r=>[r.code,r]));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');res.end(bytes);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const results=[],errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();const reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(url.hostname==='shitou-agent-fib-api.d318426.workers.dev'&&byCode.has(url.searchParams.get('stock')))return reply(byCode.get(url.searchParams.get('stock')).full);
   if(url.hostname==='shitou-taiwanmarket-api.d318426.workers.dev'){
    if(url.searchParams.get('market')==='ALL_STOCKS')return reply(fixture.snapshot);
    if(url.searchParams.get('market')==='DEEP_SCAN'&&url.searchParams.get('profile')==='DAILY_ONLY'){
     const codes=(url.searchParams.get('codes')||'').split(',');if(codes.every(code=>byCode.has(code)))return reply({type:'MOMENTUM_DEEP_SCAN',results:codes.map(code=>({ok:true,code,data:byCode.get(code).daily}))});
    }
   }return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  await page.evaluate(names=>{globalThis.__testOfficialNames=names;globalThis.resolveStockInput=async()=>{const code=document.getElementById('stockInput').value;return {code,officialName:__testOfficialNames[code],directory:{}};};globalThis.loadShitoAssistantEvidenceV47=async()=>null;},Object.fromEntries(fixture.snapshot.rows.map(q=>[q.code,q.name])));
  for(const record of fixture.records){
   await page.evaluate(()=>{ShitouResearchIntegration.clearStockQuery();ShitouSelectionDataV2.reset();});
   await page.locator('#stockInput').fill(record.code);await page.locator('#searchButton').click();
   await page.waitForFunction(code=>ShitouResearchIntegration.getCurrentStock()?.analysis.code===code,record.code,{timeout:25000});
   const row=await page.evaluate(code=>{
    const I=ShitouResearchIntegration,R=ShitouResearchReport,stock=I.getCurrentStock().analysis,raw=shitouGetLastReportV82();
    const core=a=>({code:a.code,date:a.date,state:a.state,models:a.models,features:a.features,families:a.families,risks:a.risks,breakout:a.researchBreakoutPrice,invalidation:a.researchInvalidation,quality:a.dataQuality});
    const baseline=JSON.stringify(core(stock)),text=JSON.stringify(R.lines(stock)),entries=[];
    for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){
     // Research adapter envelopes only; this never asserts formal scanner eligibility.
     const candidate={code,report:raw,score:88,eligible:false},before=JSON.stringify(candidate),a=I.forReport(candidate);
     I.baseline(kind,{date:stock.date,candidates:[candidate]},[candidate]);
     entries.push({kind,sameCore:JSON.stringify(core(a))===baseline,sameSummary:JSON.stringify(R.lines(a))===text,inputUnchanged:JSON.stringify(candidate)===before});
    }
    return {code,name:stock.name,date:stock.date,state:stock.state,label:stock.compactStateLabel,bars:stock.validation.historyBarCount,technicalAvailable:stock.validation.technicalModelAvailable,breakout:stock.researchBreakoutPrice,invalidation:stock.researchInvalidation,reason:stock.reason,entries};
   },record.code);
   assert.equal(row.code,record.code);assert.equal(row.date,record.full.closeDate);
   assert.ok(row.entries.every(x=>x.sameCore&&x.sameSummary&&x.inputUnchanged),JSON.stringify(row));
   if(record.code==='2330'){
    const quote=fixture.snapshot.rows.find(q=>q.code==='2330'),volume=record.daily.dailySeries.at(-1).volume;
    assert.ok(Math.abs(volume-quote.volume)/quote.volume>.2);assert.equal(row.technicalAvailable,false);assert.equal(row.state,'INSUFFICIENT_DATA');
    row.volumeConflict={workerShares:volume,snapshotShares:quote.volume,differencePct:Math.abs(volume-quote.volume)/quote.volume*100,existingTolerancePct:20};
   }else{assert.equal(row.technicalAvailable,true);assert.equal(row.bars,record.daily.dailySeries.length);}
   results.push(row);console.log(JSON.stringify({code:row.code,name:row.name,state:row.state,sameEntries:row.entries.length,technicalAvailable:row.technicalAvailable}));
  }
  assert.deepEqual(errors,[]);assert.ok(new Set(results.map(row=>row.state)).size>1,'Different stock data must not be forced into one identical state');
  fs.writeFileSync(path.join(out,'multi-stock-results.json'),JSON.stringify({status:'PASS',scope:'Six real API-response recordings through actual stock-query button; seven research envelope adapters per stock, not full scanner universe/eligibility verification',capturedAt:fixture.capturedAt,stockCount:results.length,entryComparisons:results.reduce((n,row)=>n+row.entries.length,0),results,errors},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
