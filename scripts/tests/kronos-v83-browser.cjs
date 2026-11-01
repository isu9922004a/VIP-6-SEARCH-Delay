'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),out=process.argv[2]||path.join(root,'evidence/kronos-v83');fs.mkdirSync(out,{recursive:true});
(async()=>{const server=http.createServer((req,res)=>{const u=decodeURIComponent(new URL(req.url,'http://localhost').pathname),f=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});const p=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:1,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const base='http://127.0.0.1:'+server.address().port;await p.clock.setFixedTime(new Date(require('../../data/kronos/TAIEX.json').asOf+'T11:00:00Z'));await p.goto(base+'/',{waitUntil:'networkidle'});assert.equal(await p.evaluate(()=>ShitouReleaseV50.displayCode),'V8.3');await p.waitForFunction(()=>!!globalThis.ShitouResearchIntegration&&!!globalThis.ShitouSimpleStockReport);
const checks=[];for(const code of ['1569','2330','8039']){const raw=JSON.parse(fs.readFileSync(path.join(root,'data/research',require('../../data/kronos/stocks/'+code+'.json').asOf,code+'.json'),'utf8'));await p.locator('#stockInput').fill(code);const audit=await p.evaluate(async raw=>{ShitouResearchIntegration.captureStockQuery(raw,{activate:true});const a=ShitouResearchIntegration.getCurrentStock().analysis;const card=document.querySelector('.research-stock-card[data-code="'+a.code+'"]'),guide=card?.querySelector('.research-action-guide'),open=card?.querySelector('.research-opening-calculator input');if(open)open.value='123';await ShitouKronosData.ensure(a);if(card&&!card.isConnected||guide&&!guide.isConnected||open&&open.value!=='123')throw Error('Model refresh discarded existing card or opening input');await document.fonts.ready;const simple=ShitouSimpleStockReport.page(a),four=ShitouResearchReport.pages(a)[0];return {simple:JSON.parse(simple.dataset.researchAudit),four:JSON.parse(four.dataset.researchAudit),reason:ShitouKronosData.reasonFor(a),signature:a.sourceSnapshotId};},raw);assert.equal(audit.simple.sourceState,'MODEL_SAMPLE',JSON.stringify(audit));assert.equal(audit.simple.noClipping,true);assert.equal(audit.four.firstFourPreserved,true);assert.equal(audit.four.noClipping,true);checks.push({code,...audit});}
await p.click('#stockSimpleAnalysisButton');await p.waitForFunction(()=>document.querySelector('#simpleStockReportDialog')?.open);
assert.equal(await p.locator('#simpleStockLineShareButton').count(),1,'share-to-LINE button missing');
await p.evaluate(()=>{
 Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'});
 Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>data.files?.length===1});
 Object.defineProperty(navigator,'share',{configurable:true,value:data=>{const file=data.files?.[0];window.__compactLineShare={size:file?.size,type:file?.type,name:file?.name,fileCount:data.files?.length,url:data.url||null};return Promise.resolve();}});
});
await p.click('#simpleStockLineShareButton');
await p.waitForFunction(()=>window.__compactLineShare?.size>0);
const lineAudit=await p.evaluate(()=>window.__compactLineShare);
assert.equal(lineAudit.fileCount,1,'must share exactly one report PNG');
assert.equal(lineAudit.type,'image/png','must share real image file instead of URL');
assert.equal(lineAudit.url,null,'web page link is not the report');
assert.match(lineAudit.name,/個股精簡分析_8039_.*\.png$/,'filename should identify stock');
await p.waitForFunction(()=>!document.querySelector('#simpleStockLineShareButton')?.disabled);
await p.evaluate(()=>{
 Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (X11; Linux x86_64) Chrome/135.0.0.0 Safari/537.36'});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:items=>{window.__compactLineClipboard={count:items.length,types:items[0]?.types||[]};return Promise.resolve();}}});
});
await p.click('#simpleStockLineShareButton');
await p.waitForFunction(()=>window.__compactLineClipboard?.count===1);
const clipboardAudit=await p.evaluate(()=>window.__compactLineClipboard);
assert.ok(clipboardAudit.types.includes('image/png'),'desktop copy should preserve PNG');
await p.screenshot({path:path.join(out,'stock-mobile.png'),fullPage:false});
await p.goto(base+'/market-outlook.html',{waitUntil:'networkidle'});await p.waitForFunction(()=>independentMarketState()?.state==='AVAILABLE');assert.match(await p.locator('#market-next').textContent(),/Kronos指數實跑/);assert.equal(await p.locator('#market-chart svg').count(),1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(out,'market-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checks,errors,market:await p.locator('#market-next').textContent()},null,2));console.log('PASS actual Kronos loader, three stocks, complete images, independent index and mobile width');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
