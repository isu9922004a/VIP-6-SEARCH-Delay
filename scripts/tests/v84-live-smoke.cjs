'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=path.resolve(__dirname,'../../evidence/v84-live');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[],errors=[];
try{const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://isu9922004a.github.io/VIP-6-SEARCH-Delay/?audit=V8.4',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>globalThis.ShitouReleaseV50?.displayCode==='V8.4',{},{timeout:15000});
 checks.push({version:await page.evaluate(()=>ShitouReleaseV50.displayCode)});console.log('PASS deployed V8.4');
 const assetFailures=await page.evaluate(async()=>{const urls=[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e=>e.src||e.href).filter(u=>u.startsWith(location.origin));return (await Promise.all(urls.map(async url=>{try{return {url,status:(await fetch(url)).status};}catch(e){return {url,error:e.message};}}))).filter(r=>r.error||r.status!==200);});assert.deepEqual(assetFailures,[]);
 await page.locator('#stockInput').fill('2313');await page.locator('#searchButton').click();
 await page.waitForFunction(()=>shitouGetLastReportV82()?.code==='2313'||document.querySelector('#error')?.textContent.trim(),{},{timeout:120000});
 const state=await page.evaluate(()=>({code:shitouGetLastReportV82()?.code,date:shitouGetLastReportV82()?.closeDate,error:document.querySelector('#error')?.textContent}));assert.equal(state.code,'2313',JSON.stringify(state));checks.push(state);console.log('PASS live query',state);
 await page.evaluate(()=>ShitouWorkspaceV831.openReport('full'));
 // V8.4.1 layout regression: two image cards must not overlap or overflow
 // when nested inside the desktop two-column copy-actions grid.
 for(const spec of [{width:1440,expectTwo:true,maxWidth:null},{width:1440,expectTwo:false,maxWidth:460},{width:428,expectTwo:false,maxWidth:null}]){
  await page.setViewportSize({width:spec.width,height:926});
  const layout=await page.evaluate(maxWidth=>{
   const actions=document.querySelector('#stockReportActionsPanel .copy-actions'),grid=actions?.querySelector('.stock-image-generator-grid');
   if(!grid)throw Error('Stock image generator grid is missing');
   grid.style.maxWidth=maxWidth?maxWidth+'px':'';
   const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   const cards=[...grid.querySelectorAll(':scope > .stock-image-generator-card')],buttons=cards.flatMap(c=>[...c.querySelectorAll('.stock-image-generator-actions button')].map(b=>({button:box(b),card:box(c)})));
   const cr=cards.map(box),inside=buttons.every(({button,card})=>button.width>0&&button.left>=card.left-2&&button.right<=card.right+2),separated=cr.length===2&&!(Math.min(cr[0].right,cr[1].right)-Math.max(cr[0].left,cr[1].left)>2&&Math.min(cr[0].bottom,cr[1].bottom)-Math.max(cr[0].top,cr[1].top)>2);
   return {cardCount:cards.length,buttonCount:buttons.length,inside,separated,twoColumns:cr.length===2&&Math.abs(cr[0].top-cr[1].top)<3,gridWidth:box(grid).width,outerWidth:box(actions).width,gridOverflow:grid.scrollWidth>grid.clientWidth+2};
  },spec.maxWidth);
  assert.equal(layout.cardCount,2,JSON.stringify(layout));assert.equal(layout.buttonCount,4,JSON.stringify(layout));
  assert.equal(layout.inside,true,'image buttons must stay inside their cards '+JSON.stringify(layout));
  assert.equal(layout.separated,true,'stock image cards must not overlap '+JSON.stringify(layout));
  assert.equal(layout.gridOverflow,false,'stock image grid must not overflow '+JSON.stringify(layout));
  assert.equal(layout.twoColumns,spec.expectTwo,'incorrect responsive card count '+JSON.stringify({spec,layout}));
  if(spec.expectTwo)assert.ok(layout.gridWidth>=layout.outerWidth-4,'nested grid must span both desktop columns: '+JSON.stringify(layout));
  const label=spec.maxWidth?'narrow-container':spec.width+'px';
  await page.locator('#stockReportActionsPanel .stock-image-generator-grid').screenshot({path:path.join(out,'export-cards-'+label+'.png')});
  checks.push({layout:label,...layout});console.log('PASS export card layout',label);
 }
 for(const id of ['generateStockProfessionalImageButton','generateStockProfessionalWatermarkImageButton']){
  await page.locator('#'+id).click();await page.waitForFunction(()=>document.querySelector('#imagePreviewModal')?.classList.contains('show')&&document.querySelector('#imageDownloadLink')?.href.startsWith('blob:'),{},{timeout:45000});
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#imageDownloadLink').click()]);const file=path.join(out,id+'.png');await download.saveAs(file);const bytes=fs.readFileSync(file);assert.equal(bytes.readUInt32BE(16),1284);assert.equal(bytes.readUInt32BE(20),2778);checks.push({button:id,bytes:bytes.length});await page.evaluate(()=>closeInfographicPreviewV3328());console.log('PASS live report',id);
 }
 await page.goto('https://isu9922004a.github.io/VIP-6-SEARCH-Delay/market-outlook.html?audit=V8.4',{waitUntil:'networkidle'});await page.waitForFunction(()=>independentMarketState()?.state==='AVAILABLE',{},{timeout:45000});
 for(const id of ['marketSimpleAnalysisButton','marketSimpleAnalysisWatermarkButton']){
  await page.locator('#'+id).click();await page.waitForFunction(()=>document.querySelector('#simpleMarketReportDialog')?.open);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#simpleMarketReportDialog a[download]').click()]);await download.saveAs(path.join(out,id+'.png'));checks.push({button:id,version:await page.locator('#simpleMarketReportDialog').evaluate(d=>JSON.parse(d.dataset.reportAudit).version)});await page.evaluate(()=>ShitouMarketSimpleReport.close());console.log('PASS live market',id);
 }
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checks,errors,network:'Real deployed website and services; no response substitution'},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
