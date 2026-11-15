'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'/tmp/v98-life');
fs.mkdirSync(out,{recursive:true});
const png=b=>{assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),1284);assert.equal(b.readUInt32BE(20),2778);assert.ok(b.length>15000);};
(async()=>{
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.json')?'application/json':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=process.env.V98_LIVE_ORIGIN||'http://127.0.0.1:'+server.address().port+'/';
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(origin).origin?r.continue():r.abort());
  await page.goto(origin+'index.html',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>ShitouReleaseV50.displayCode),'V9.8');
  await page.evaluate(()=>ShitouLifeVisual98.ready(document));
  for(const code of ['6925','8099','2330']){
   await page.evaluate(async(code)=>{
    const raw=await(await fetch('./data/research/2026-11-13/'+code+'.json')).json();
    ShitouWorkspaceV831.select('stock');ShitouResearchIntegration.clearStockQuery();
    globalThis.shitouGetLastReportV82=()=>raw;document.getElementById('stockInput').value=code;
    ShitouResearchIntegration.captureStockQuery(raw);ShitouResearchIntegration.mountStock(raw);
    document.getElementById('result').style.display='block';ShitouWorkspaceV831.renderSummary();
   },code);
   await page.locator('#workspaceFourReportButton').click();await page.locator('#workspaceLifeReportButton').click();
   await page.waitForFunction(()=>document.getElementById('imagePreviewModal').classList.contains('show')&&document.getElementById('life94Status')?.textContent.includes('備妥'));
   const a=await page.evaluate(()=>ShitouLifeViewer94.getState().pages.map(p=>JSON.parse(p.dataset.life98Audit)));
   assert.equal(a.length,2);assert.equal(a[0].model.code,code);assert.equal(a[0].model.date,'2026-11-13');assert.equal(a[0].chartBars,30);
   const p=await page.evaluate(async()=>{const c=ShitouLifeViewer94.getState().pages[0].renderExportRegion();const png=c.toDataURL('image/png');c.width=c.height=1;return png;});
   const data=Buffer.from(p.split(',')[1],'base64');png(data);fs.writeFileSync(path.join(out,code+'-V98-P01.png'),data);
   if(code==='6925'){assert.equal(a[0].model.close,106.5);assert.equal(a[0].model.line,102.5);assert.ok(Math.abs(a[0].model.ma[5]-102.12)<1e-8);assert.equal(a[0].model.chartMa60Available,30,'official full 160-day data should draw 30 MA60 points');assert.equal(a[0].model.volume.last,3020013);}
   if(code==='2330')assert.equal(a[0].model.volume.verified,false);
   await page.locator('#life94Next').click();await page.waitForFunction(()=>document.getElementById('life94Status')?.textContent.includes('備妥')&&ShitouLifeViewer94.getState().index===1);
   const p2=await page.evaluate(()=>ShitouLifeViewer94.getState().pages[1].renderExportRegion().toDataURL('image/png'));const b2=Buffer.from(p2.split(',')[1],'base64');png(b2);if(code==='6925')fs.writeFileSync(path.join(out,code+'-V98-P02.png'),b2);
   await page.evaluate(()=>closeInfographicPreviewV3328());
  }
  await page.setViewportSize({width:428,height:926});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  fs.writeFileSync(path.join(out,'v98-results.json'),JSON.stringify({status:'PASS',codes:['6925','8099','2330'],pages:2,size:[1284,2778],errors},null,2));
  assert.deepEqual(errors,[]);
  console.log('V98_LIFE_BROWSER_PASS 6925 8099 2330 2-page 1284x2778 PNG');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
