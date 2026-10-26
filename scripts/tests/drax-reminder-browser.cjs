'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/multi-stock-worker-responses-20261022.json'),out=path.resolve(process.argv[2]||'/workspace/drax-browser');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(err,b)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html');res.end(b);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const rows=[],errors=[];
 try{browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));const byCode=new Map(fixture.records.map(x=>[x.code,x]));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();const reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 if(u.hostname==='shitou-agent-fib-api.d318426.workers.dev'&&byCode.has(u.searchParams.get('stock')))return reply(byCode.get(u.searchParams.get('stock')).full);
 if(u.hostname==='shitou-taiwanmarket-api.d318426.workers.dev'){if(u.searchParams.get('market')==='ALL_STOCKS')return reply(fixture.snapshot);if(u.searchParams.get('profile')==='DAILY_ONLY'){const codes=(u.searchParams.get('codes')||'').split(',');if(codes.every(c=>byCode.has(c)))return reply({type:'MOMENTUM_DEEP_SCAN',results:codes.map(code=>({ok:true,code,data:byCode.get(code).daily}))});}}return route.abort();});
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
 assert.equal(await page.locator('#researchCsv').textContent(),'DRAX 價格對應提醒');assert.ok(await page.locator('#researchCsv').isDisabled());
 await page.evaluate(names=>{globalThis.resolveStockInput=async()=>{const code=document.getElementById('stockInput').value;return {code,officialName:names[code],directory:{}};};globalThis.loadShitoAssistantEvidenceV47=async()=>null;globalThis.__shares=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files?.length===1&&files[0].type==='image/png'});Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{__shares.push({keys:Object.keys(payload),name:payload.files[0].name,type:payload.files[0].type,size:payload.files[0].size,active:navigator.userActivation.isActive});}});},Object.fromEntries(fixture.snapshot.rows.map(x=>[x.code,x.name])));
 for(const r of fixture.records){
  if(await page.locator('.drax-reminder-dialog').count())await page.locator('.drax-reminder-header button').click();
  await page.locator('#stockInput').fill(r.code);await page.locator('#searchButton').click();await page.waitForFunction(c=>ShitouResearchIntegration.getCurrentStock()?.analysis.code===c,r.code,{timeout:25000});assert.equal(await page.locator('.drax-reminder-dialog').count(),0);
  const before=await page.evaluate(()=>JSON.stringify(ShitouResearchReport.view(ShitouResearchIntegration.getCurrentStock().analysis)));
  await page.locator('#researchCsv').click();await page.waitForFunction(()=>ShitouDraxPriceReminder.getCurrent()?.ready);
  const state=await page.evaluate(()=>ShitouDraxPriceReminder.getCurrent());assert.equal(state.model.code,r.code);assert.ok(state.filename.includes(r.code));assert.ok(state.model.rows.every(x=>!x.enabled));
  const overflow=await page.locator('.drax-reminder-dialog').evaluate(x=>x.scrollWidth>x.clientWidth);assert.equal(overflow,false);
  const expected=await page.evaluate(()=>ShitouDraxPriceReminder.build(ShitouResearchIntegration.getCurrentStock().analysis));assert.deepEqual(state.model,expected);
  await page.locator('.drax-reminder-actions button').click();const sent=await page.evaluate(()=>__shares.at(-1));assert.ok(sent.name.includes(r.code));assert.equal(sent.type,'image/png');assert.ok(sent.size>10000);assert.ok(sent.active);assert.deepEqual(sent.keys,['files']);
  await page.locator('#drax-reminder-above').fill('123.45');await page.locator('.drax-reminder-switch input').first().check();await page.waitForFunction(()=>ShitouDraxPriceReminder.getCurrent()?.ready&&ShitouDraxPriceReminder.getCurrent().model.rows[0].value===123.45);assert.equal((await page.evaluate(()=>ShitouDraxPriceReminder.getCurrent().model.rows[0])).basis,'自行輸入');
  if(r.code==='4939'){
   await page.screenshot({path:path.join(out,'4939-dialog.png'),fullPage:false});const url=await page.locator('.drax-reminder-image').getAttribute('src');const bytes=await page.evaluate(async u=>Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())),url);fs.writeFileSync(path.join(out,'4939-reminder.png'),Buffer.from(bytes));
   await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('cancel','AbortError'))}));await page.locator('.drax-reminder-actions button').click();await page.waitForFunction(()=>document.querySelector('.drax-reminder-dialog [role=status]').textContent.includes('已取消'));
   await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));await page.locator('.drax-reminder-actions button').click();assert.ok(await page.locator('.drax-reminder-actions a').getAttribute('href'));assert.equal(await page.locator('.drax-reminder-dialog details').getAttribute('open'),'');
   await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>__shares.push({keys:Object.keys(payload),name:payload.files[0].name,type:payload.files[0].type,size:payload.files[0].size,active:navigator.userActivation.isActive})});});
  }
  await page.locator('#drax-reminder-above').fill('');await page.waitForFunction(()=>!ShitouDraxPriceReminder.getCurrent()?.ready);assert.ok(await page.locator('.drax-reminder-actions button').isDisabled());assert.equal(await page.locator('.drax-reminder-actions a').getAttribute('href'),null);
  await page.locator('#drax-reminder-above').fill('125');await page.waitForFunction(()=>ShitouDraxPriceReminder.getCurrent()?.ready);
  const after=await page.evaluate(()=>JSON.stringify(ShitouResearchReport.view(ShitouResearchIntegration.getCurrentStock().analysis)));assert.equal(before,after);
  rows.push({code:r.code,defaults:expected.rows,sharing:sent,reportUnchanged:before===after});
 }
 // A new query / clear must close the previous sheet and retire its image.
 await page.evaluate(()=>ShitouResearchIntegration.clearStockQuery());assert.equal(await page.locator('.drax-reminder-dialog').count(),0);assert.equal(await page.evaluate(()=>ShitouDraxPriceReminder.getCurrent()),null);assert.ok(await page.locator('#researchCsv').isDisabled());assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',stockCount:rows.length,rows,errors,nativeLineAppDelivery:'Not tested; native share was stubbed. User chooses LINE in the OS share sheet.'},null,2));console.log(JSON.stringify({status:'PASS',stocks:rows.length,errors}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
