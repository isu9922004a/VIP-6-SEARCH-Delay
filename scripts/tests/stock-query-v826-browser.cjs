'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),out=process.argv[2]||'/tmp/v826-query';fs.mkdirSync(out,{recursive:true});
const fixture=require('../fixtures/multi-stock-worker-responses-20261022.json'),record=fixture.records.find(x=>x.code==='2330')||fixture.records[0];
(async()=>{const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0,workerMode='hold',releaseWorker,releaseMarket;const mainBarrier=new Promise(r=>releaseWorker=r),marketBarrier=new Promise(r=>releaseMarket=r);
 const base=process.env.RESEARCH_BROWSER_ORIGIN||'http://127.0.0.1:'+server.address().port,origin=new URL(base).origin;
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='shitou-agent-fib-api.d318426.workers.dev'){
  if(u.searchParams.get('assistant')==='1')return route.abort();requests++;if(workerMode==='hold')await mainBarrier;
  return route.fulfill({status:workerMode==='error'?400:200,contentType:'application/json',body:JSON.stringify(workerMode==='error'?{error:'測試：資料暫時不可用'}:record.full)});
 }if(u.hostname==='shitou-taiwanmarket-api.d318426.workers.dev'){await marketBarrier;return route.abort();}if(u.origin===origin)return route.continue();return route.abort();});
 await page.clock.setFixedTime(new Date(fixture.snapshot.meta.targetTradeDate.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3')+'T11:00:00Z'));
 await page.goto(base,{waitUntil:'load'});await page.locator('#stockInput').fill(record.code);await page.locator('#searchButton').click();
 await page.waitForFunction(()=>document.getElementById('searchButton').disabled,null,{timeout:3000});
 await page.evaluate(()=>{document.getElementById('stockInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));analyzeStock();});
 await page.waitForFunction(()=>document.getElementById('loading').textContent.includes('秒'),null,{timeout:3000});assert.equal(requests,1,'one worker request despite repeated Enter/click');
 releaseWorker();await page.waitForFunction(()=>document.getElementById('result').style.display==='block'&&!document.getElementById('searchButton').disabled,null,{timeout:7000});
 assert.equal(await page.evaluate(()=>ShitouReleaseV50.displayCode),'V8.2.7');assert.match(await page.title(),/V8.2.7/);
 // The market snapshot is still stalled: it must not block the primary report.
 assert.equal(requests,1);releaseMarket();await page.waitForFunction(()=>!!ShitouResearchIntegration.getCurrentStock(),null,{timeout:25000});
 // With the market intentionally unavailable, incomplete history must not fabricate a calculator.
 assert.match(await page.locator('#researchStock').textContent(),/行情還沒確認完整|日線還沒確認完整|無法安全計算/);
 workerMode='error';await page.locator('#searchButton').click();await page.waitForFunction(()=>document.getElementById('error').style.display==='block'&&!document.getElementById('searchButton').disabled,null,{timeout:7000});
 assert.match(await page.locator('#error').textContent(),/資料暫時不可用/);assert.equal(await page.evaluate(()=>ShitouResearchIntegration.getCurrentStock()),null);
 workerMode='ok';await page.locator('#searchButton').click();await page.waitForFunction(()=>document.getElementById('result').style.display==='block'&&!document.getElementById('searchButton').disabled,null,{timeout:7000});
 await page.locator('#stockInput').fill('');await page.locator('#searchButton').click();await page.waitForFunction(()=>document.getElementById('error').textContent.includes('請輸入'));assert.equal(await page.locator('#searchButton').isEnabled(),true);
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'query-recovery.png')});const result={status:'PASS',version:'V8.2.7',code:record.code,workerRequests:requests,checks:['stalled market does not block query','immediate loading feedback','duplicate Enter ignored','primary report before enrichment','error is visible and button recovers','retry after failure succeeds','empty query is actionable'],pageErrors:errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
