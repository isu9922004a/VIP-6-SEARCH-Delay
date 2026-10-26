'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(process.env.RESEARCH_ROOT_OVERRIDE||path.join(__dirname,'../..'));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/9933-worker-responses-20261022.json'),'utf8'));
const out=path.resolve(process.argv[2]||path.join(root,'../worker-browser')),before=process.argv.includes('--before'),live=process.env.LIVE_WORKER_NETWORK==='1';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,name==='/'?'index.html':'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');res.end(bytes);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const errors=[],requests=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:3,isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();requests.push(url.href);
   const respond=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(url.hostname==='shitou-agent-fib-api.d318426.workers.dev'&&url.searchParams.get('stock')==='9933')return live?route.continue():respond(fixture.stock);
   if(url.hostname==='shitou-taiwanmarket-api.d318426.workers.dev'){
    if(url.searchParams.get('market')==='ALL_STOCKS')return live?route.continue():respond(fixture.snapshot);
    if(url.searchParams.get('market')==='DEEP_SCAN'&&url.searchParams.get('codes')==='9933'&&url.searchParams.get('profile')==='DAILY_ONLY')return live?route.continue():respond(fixture.daily);
   }return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  // Only stock-name resolution and unrelated external assistant fetches are stubbed.
  // The real search button, stock response mapping, wrappers, canonical fetch,
  // validation, research and image button all execute the application's own code.
  await page.evaluate(()=>{globalThis.resolveStockInput=async()=>({code:'9933',officialName:'中鼎',directory:{}});globalThis.loadShitoAssistantEvidenceV47=async()=>null;});
  await page.locator('#stockInput').fill('9933');await page.locator('#searchButton').click();
  await page.waitForFunction(()=>!!globalThis.ShitouResearchIntegration?.getCurrentStock(),{},{timeout:live?120000:25000});
  const current=await page.evaluate(()=>({analysis:ShitouResearchIntegration.getCurrentStock().analysis,metrics:ShitouResearchIntegration.getCurrentStock().metrics,summary:ShitouResearchReport.lines(ShitouResearchIntegration.getCurrentStock().analysis),version:ShitouReleaseV50.displayCode}));
  if(before){assert.equal(current.analysis.state,'INSUFFICIENT_DATA');}
  else{
   assert.equal(current.analysis.state,'HEALTHY_PULLBACK',current.analysis.reason);assert.equal(current.analysis.validation.historyBarCount,fixture.daily.results[0].data.dailySeries.length);
   assert.equal(current.analysis.researchBreakoutPrice,48.75);assert.equal(current.analysis.researchInvalidation,43);assert.ok(current.analysis.models.A&&current.analysis.models.B&&current.analysis.models.C&&current.analysis.models.D);
   const stockTechnical=await page.evaluate(()=>{const I=ShitouResearchIntegration,a=I.getCurrentStock().analysis,raw=shitouGetLastReportV82(),core=x=>({state:x.state,models:x.models,features:x.features,families:x.families,risks:x.risks,breakout:x.researchBreakoutPrice,invalidation:x.researchInvalidation,quality:x.dataQuality});return {single:core(a),filter:core(I.forReport({code:'9933',report:raw}))};});assert.deepEqual(stockTechnical.single,stockTechnical.filter);
   assert.match(current.analysis.validation.workerDataAudit.volumeUnitSource,/CONTRACT/);
   assert.equal(current.analysis.models.D.verification.overall,'PARTIALLY_VERIFIED');
   const images=await page.evaluate(()=>{const a=ShitouResearchIntegration.getCurrentStock().analysis,result=[];for(const stockMode of [true,false])for(const [i,p] of ShitouResearchReport.pages(a,{displayCode:ShitouReleaseV50.displayCode,stockMode}).entries()){const c=p.renderExportRegion(),ctx=c.getContext('2d');ctx.font='bold 32px "Microsoft JhengHei"';ctx.fillStyle='#ffdf93';ctx.fillText('2026-10-22 API回應重播｜非即時行情',54,580);result.push({mode:stockMode?'stock':'filter',index:i+1,url:c.toDataURL('image/png'),audit:JSON.parse(p.dataset.researchAudit)});c.width=c.height=1;}return result;});
   for(const img of images){assert.equal(img.audit.width,1284);assert.equal(img.audit.height,2778);assert.ok(img.audit.noClipping);fs.writeFileSync(path.join(out,`9933-RECORDED-${img.mode}-${img.index}.png`),Buffer.from(img.url.split(',')[1],'base64'));}
   assert.deepEqual(images.filter(x=>x.mode==='stock').map(x=>x.audit.summary),images.filter(x=>x.mode==='filter').map(x=>x.audit.summary));
  }
  let clicked;
  await page.evaluate(()=>{globalThis.__capturedResearchPreview=null;globalThis.strongStockShowPagesV47=(pages,options)=>{globalThis.__capturedResearchPreview={title:options.title,audits:pages.map(p=>JSON.parse(p.dataset.researchAudit))};};});
  await page.locator('#researchStock .research-card-actions>button').first().click();await page.waitForFunction(()=>!!globalThis.__capturedResearchPreview);clicked=await page.evaluate(()=>globalThis.__capturedResearchPreview);
  assert.equal(clicked.title,'四策略研究｜個股查詢摘要');assert.equal(clicked.audits[0].mode,'SINGLE_STOCK');assert.deepEqual(clicked.audits[0].summary,current.summary);assert.deepEqual(errors,[]);
  assert.ok(requests.some(url=>url.includes('profile=DAILY_ONLY')));assert.ok(requests.some(url=>url.includes('market=ALL_STOCKS')));
  fs.writeFileSync(path.join(out,'recorded-worker-results.json'),JSON.stringify({status:'PASS',before,live,scope:live?'Actual UI search / live project Worker network, desktop Chromium, not physical Safari':'Actual UI search / captured real Worker responses, not a physical Safari or live browser API call',capturedAt:live?new Date().toISOString():fixture.capturedAt,current,requests,errors,clicked},null,2));
  console.log(JSON.stringify({status:'PASS',before,version:current.version,state:current.analysis.state,barCount:current.analysis.validation.historyBarCount,breakout:current.analysis.researchBreakoutPrice,invalidation:current.analysis.researchInvalidation,reason:current.analysis.reason,requests:requests.length,errors}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
