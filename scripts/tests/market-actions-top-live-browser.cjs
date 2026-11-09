'use strict';
// Real website + original button handlers. No model/date substitutions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const base=process.env.RESEARCH_BROWSER_ORIGIN||'https://isu9922004a.github.io/VIP-6-SEARCH-Delay/',out=path.resolve(process.argv[2]||'/tmp/market-actions-top-live');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[],exports=[];try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 if(process.env.FUTURE_NODE_HTTPS==='1')await page.route(new URL(base).origin+'/**',async route=>{try{const r=await fetch(route.request().url());await route.fulfill({status:r.status,headers:Object.fromEntries([...r.headers].filter(([k])=>!['content-encoding','content-length'].includes(k))),body:Buffer.from(await r.arrayBuffer())});}catch{await route.abort();}});
 await page.goto(base+'?market-toolbar='+Date.now(),{waitUntil:'load',timeout:60000});await page.evaluate(()=>document.fonts.ready);
 await page.locator('#workspaceTabmarket').click();await page.locator('#marketAnalyzeButton').click();await page.waitForFunction(()=>document.getElementById('marketResult').style.display==='block',null,{timeout:60000});
 assert.equal(await page.locator('#marketResult > :first-child').getAttribute('id'),'marketReportActionsPanel');
 const ids=['generateMarketImageButton','generateMarketWatermarkImageButton','waveMarketCleanButton','waveMarketMarkedButton','futureMarketCleanButton','futureMarketMarkedButton'];
 const source=await page.evaluate(async()=>{const history=await fetch('./data/index/TAIEX.json?toolbar='+Date.now(),{cache:'no-store'}).then(r=>r.json()),catalog=await fetch('./data/kronos-future/manifest.json?toolbar='+Date.now(),{cache:'no-store'}).then(r=>r.json());return {date:history.closeDate,modelDate:catalog.asOf,futureAligned:history.closeDate===catalog.asOf};});
 for(const id of ids){
  assert.equal(await page.locator('#'+id).count(),1);assert.equal(await page.locator('#marketReportActionsPanel #'+id).count(),1);
  await page.locator('#'+id).click();
  if(id.startsWith('future')&&!source.futureAligned){await page.waitForFunction(()=>!document.getElementById('futureMarketCleanButton').disabled);const message=await page.locator('#futureMarketStatus').innerText();assert.match(message,/更新|核對|同步/);assert.equal(await page.locator('#imagePreviewModal').evaluate(m=>m.classList.contains('show')),false);exports.push({id,blocked:true,reason:message});continue;}
  await page.waitForFunction(()=>document.getElementById('imagePreviewModal').classList.contains('show'),null,{timeout:60000});await page.locator('#imagePreviewImg').evaluate(i=>i.decode());assert.deepEqual(await page.locator('#imagePreviewImg').evaluate(i=>[i.naturalWidth,i.naturalHeight]),[1284,2778]);
  const[d]=await Promise.all([page.waitForEvent('download'),page.locator('#imageDownloadLink').click()]);await d.saveAs(path.join(out,id+'.png'));exports.push({id,png:true,width:1284,height:2778});await page.evaluate(()=>closeInfographicPreviewV3328());
 }
 const toolbar=page.locator('#marketReportActionsPanel');for(const width of [360,390,428,768,1280]){await page.setViewportSize({width,height:844});const panel=await toolbar.boundingBox();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));for(const id of ids){const b=await page.locator('#'+id).boundingBox();assert.ok(b&&b.height>=44&&b.width>=44&&b.x>=panel.x&&b.x+b.width<=panel.x+panel.width+1,id+' bounds');assert.ok(await page.locator('#'+id).evaluate(e=>e.scrollWidth<=e.clientWidth+1),id+' text');}}
 await page.setViewportSize({width:390,height:844});await toolbar.scrollIntoViewIfNeeded();await toolbar.screenshot({path:path.join(out,'market-toolbar-390.png')});assert.deepEqual(errors,[]);
 const result={status:'PASS',source,buttons:ids.length,pngs:exports.filter(x=>x.png).length,pendingFuture:exports.filter(x=>x.blocked).length,exports,consoleErrors:errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log('MARKET_TOP_LIVE_PASS '+JSON.stringify(result));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
