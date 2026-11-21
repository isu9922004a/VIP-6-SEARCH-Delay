'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'/tmp/v913-acceptance');
fs.mkdirSync(out,{recursive:true});
function checkPng(b){assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),1284);assert.equal(b.readUInt32BE(20),2778);assert.ok(b.length>15000);}
(async()=>{
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
  if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(p,(err,b)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(b);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port+'/';
 let browser;
 const status={version:'V9.16',stock:{},market:{},errors:[]};
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const stock=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});
  stock.on('pageerror',e=>status.errors.push('stock: '+e.message));
  await stock.route('**/*',r=>new URL(r.request().url()).origin===new URL(origin).origin?r.continue():r.abort());
  await stock.goto(origin+'index.html',{waitUntil:'load'});
  await stock.evaluate(async()=>{
   const raw=await (await fetch('./data/research/2026-11-17/5013.json')).json();
   ShitouWorkspaceV831.select('stock');ShitouResearchIntegration.clearStockQuery();
   globalThis.shitouGetLastReportV82=()=>raw;
   document.getElementById('stockInput').value='5013';
   ShitouResearchIntegration.captureStockQuery(raw);
   ShitouResearchIntegration.mountStock(raw);
   document.getElementById('result').style.display='block';
   ShitouWorkspaceV831.renderSummary();
  });
  await stock.locator('#workspaceFourReportButton').click();
  await stock.locator('#workspaceLifeReportButton').click();
  await stock.waitForFunction(()=>document.getElementById('imagePreviewModal')?.classList.contains('show')&&ShitouLifeViewer94.getState()?.pages?.length>=3,{},{timeout:30000});
  const a=await stock.evaluate(()=>ShitouLifeViewer94.getState().pages.map(p=>JSON.parse(p.dataset.life98Audit)));
  assert.ok(a.length>=3,'must retain original two pages and risk appendix');assert.equal(a[2].explanationStatus,'VERIFIED_FROM_CORE');assert.equal(a[0].release,'V9.16');assert.equal(a[0].model.close,66.6);
  assert.equal(a[0].model.life913.selectedPrimaryEvent.lifeLinePrice,70.9);
  assert.equal(a[0].model.life913.selectedPrimaryEvent.side,'BEAR');
  assert.equal(a[0].model.life913.priceTrend,'偏強觀察');
  assert.match(a[0].model.life913.marketStatus,/櫃買指數/);
  for(let i=0;i<a.length;i++){
   const uri=await stock.evaluate(i=>ShitouLifeViewer94.getState().pages[i].renderExportRegion().toDataURL('image/png'),i);
   const bytes=Buffer.from(uri.split(',')[1],'base64');checkPng(bytes);fs.writeFileSync(path.join(out,'5013-'+(i+1)+'.png'),bytes);
  }
  await stock.screenshot({path:path.join(out,'5013-preview.png')});
  status.stock={date:a[0].model.date,close:a[0].model.close,life:a[0].model.life913.selectedPrimaryEvent.lifeLinePrice,pages:a.length};
  await stock.close();
  const market=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});
  market.on('pageerror',e=>status.errors.push('market: '+e.message));
  await market.route('**/*',r=>new URL(r.request().url()).origin===new URL(origin).origin?r.continue():r.abort());
  await market.route('**/data/index/TAIEX.json*',r=>r.fulfill({path:path.join(root,'scripts/fixtures/taiex-20261117-v913.json'),contentType:'application/json'}));
  await market.clock.install({time:new Date('2026-11-17T16:40:00+08:00')});
  await market.goto(origin+'market-outlook.html',{waitUntil:'domcontentloaded'});
  await market.waitForSelector('#marketLifeReportButton');
  await market.locator('#marketLifeReportButton').click();
  await market.waitForFunction(()=>document.getElementById('imagePreviewModal')?.classList.contains('show')&&ShitouLifeViewer94.getState()?.pages?.length>=3,{},{timeout:30000});
  const b=await market.evaluate(()=>ShitouLifeViewer94.getState().pages.map(p=>JSON.parse(p.dataset.marketLifeAudit)));
  assert.ok(b.length>=3,'must retain original two market pages and risk appendix');assert.equal(b[2].explanationStatus,'VERIFIED_FROM_CORE');assert.equal(b[0].release,'V9.16');assert.equal(b[0].model.close,40092.11);
  assert.equal(b[0].marketRisk.version,'MARKET_LIFE_RISK_V913');assert.equal(b[0].marketRisk.phase.confirmedAt,'2026-11-17');
  for(let i=0;i<b.length;i++){
   const uri=await market.evaluate(i=>ShitouLifeViewer94.getState().pages[i].renderExportRegion().toDataURL('image/png'),i);
   const bytes=Buffer.from(uri.split(',')[1],'base64');checkPng(bytes);fs.writeFileSync(path.join(out,'TAIEX-'+(i+1)+'.png'),bytes);
  }
  await market.screenshot({path:path.join(out,'TAIEX-preview.png')});
  status.market={date:b[0].model.date,close:b[0].model.close,phase:b[0].marketRisk.phase.state,pages:b.length};
  await market.close();
  assert.deepEqual(status.errors,[]);
  status.status='PASS';
  console.log('V913_BROWSER_PASS '+JSON.stringify(status));
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(status,null,2));if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});