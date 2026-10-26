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
    const report=R.view(stock),baseline=JSON.stringify(core(stock)),text=JSON.stringify(R.lines(stock)),entries=[];
    for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){
     // Research adapter envelopes only; this never asserts formal scanner eligibility.
     const candidate={code,report:raw,score:88,eligible:false},before=JSON.stringify(candidate),a=I.forReport(candidate);
     I.baseline(kind,{date:stock.date,candidates:[candidate]},[candidate]);
     entries.push({kind,sameCore:JSON.stringify(core(a))===baseline,sameSummary:JSON.stringify(R.lines(a))===text,sameView:JSON.stringify(R.view(a))===JSON.stringify(report),inputUnchanged:JSON.stringify(candidate)===before});
    }
    const fields=[...document.querySelectorAll('#researchStock .research-card-field')].map(x=>({title:x.querySelector('.research-card-label').textContent,value:x.querySelector('.research-card-value').textContent}));
    const summary=R.pages(stock,{stockMode:true}).map(p=>JSON.parse(p.dataset.researchAudit));
    const full=R.pages(stock,{stockMode:true,detail:true}).map(p=>JSON.parse(p.dataset.researchAudit));
    return {code,name:stock.name,date:stock.date,state:stock.state,label:R.stageLabel(stock),bars:stock.validation.historyBarCount,technicalAvailable:stock.validation.technicalModelAvailable,breakout:stock.researchBreakoutPrice,invalidation:stock.researchInvalidation,reason:stock.reason,entries,fields,summaryFields:report.summary,expectedFields:[...report.summary,...report.details],summary,full};
   },record.code);
   assert.equal(row.code,record.code);assert.equal(row.date,record.full.closeDate);
   assert.ok(row.entries.every(x=>x.sameCore&&x.sameSummary&&x.sameView&&x.inputUnchanged),JSON.stringify(row));
   assert.deepEqual(row.fields,row.expectedFields,`web card lost a report field for ${record.code}`);
   const normalize=x=>x.replace(/[\s｜]/g,'');
   for(const [pages,expected] of [[row.summary,row.summaryFields],[row.full,row.expectedFields]]){
    assert.ok(pages.every(x=>x.noClipping&&x.stage===row.label));
    for(const field of expected){const value=pages.flatMap(x=>x.fields).filter(x=>x.title.replace('（續）','')===field.title).map(x=>x.value).join('');assert.equal(normalize(value),normalize(field.value),`${record.code}: image lost ${field.title}`);}
   }
   // Exercise both actual inline image buttons; intercept only final preview display.
   await page.evaluate(()=>{globalThis.__imageSelections=[];globalThis.__previewOriginal=strongStockShowPagesV47;globalThis.strongStockShowPagesV47=(pages,opts)=>__imageSelections.push({title:opts.title,audits:pages.map(p=>JSON.parse(p.dataset.researchAudit))});});
   await page.locator('#researchStock .research-card-actions>button').nth(0).click();
   await page.waitForFunction(()=>__imageSelections.length===1);
   await page.locator('#researchStock .research-card-actions>button').nth(1).click();
   await page.waitForFunction(()=>__imageSelections.length===2);
   const selected=await page.evaluate(()=>{const x=__imageSelections;globalThis.strongStockShowPagesV47=__previewOriginal;return x;});
   assert.deepEqual(selected[0].audits,row.summary);assert.deepEqual(selected[1].audits,row.full);
   row.previewButtonsVerified=true;
   const exported=await page.evaluate(async()=>{
    const I=ShitouResearchIntegration,a=I.getCurrentStock().analysis,report=ShitouResearchReport.view(a),blobs=[];
    const oldUrl=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{blobs.push(blob);return oldUrl.call(URL,blob);};HTMLAnchorElement.prototype.click=function(){};
    try{I.exportData('csv-zh');const json=I.exportData('json');return {csv:await blobs[0].text(),report:json.report,expected:report};}
    finally{URL.createObjectURL=oldUrl;HTMLAnchorElement.prototype.click=oldClick;}
   });
   assert.deepEqual(exported.report,exported.expected);
   for(const field of [...exported.expected.summary,...exported.expected.details]){
    const quoted='"'+field.value.replaceAll('"','""')+'"';assert.ok(exported.csv.includes(quoted),`CSV truncated ${record.code} ${field.title}`);
   }
   row.csvAndJsonVerified=true;
   row.fullCanvas=await page.evaluate(()=>{
    const a=ShitouResearchIntegration.getCurrentStock().analysis,R=ShitouResearchReport,proto=CanvasRenderingContext2D.prototype,old=proto.fillText,printed=[],overflows=[];
    proto.fillText=function(text,x,y,...rest){printed.push(String(text));if(x+this.measureText(String(text)).width>1230.5)overflows.push({text:String(text),x,y});return old.call(this,text,x,y,...rest);};
    try{const pages=R.pages(a,{detail:true,stockMode:true});for(const p of pages){const c=p.renderExportRegion();c.width=c.height=1;}return {pageCount:pages.length,printed,overflows};}finally{proto.fillText=old;}
   });
   assert.deepEqual(row.fullCanvas.overflows,[]);
   for(const field of row.expectedFields)assert.ok(row.fullCanvas.printed.some(x=>x===field.title),`canvas omitted ${field.title}`);
   if(['9933','2059'].includes(record.code)){
    const images=await page.evaluate(()=>{const a=ShitouResearchIntegration.getCurrentStock().analysis,R=ShitouResearchReport,result=[];for(const stockMode of [true,false]){const pages=R.pages(a,{stockMode,displayCode:ShitouReleaseV50.displayCode});for(const [i,p] of pages.entries()){const canvas=p.renderExportRegion();result.push({mode:stockMode?'stock':'filter',index:i+1,url:canvas.toDataURL('image/png')});canvas.width=canvas.height=1;}}if(a.code==='2059'){const pages=R.pages(a,{stockMode:true,detail:true,displayCode:ShitouReleaseV50.displayCode});for(const [i,p] of pages.entries()){const canvas=p.renderExportRegion();result.push({mode:'full',index:i+1,url:canvas.toDataURL('image/png')});canvas.width=canvas.height=1;}}return result;});
    for(const image of images)fs.writeFileSync(path.join(out,`${record.code}-${image.mode}-${image.index}.png`),Buffer.from(image.url.split(',')[1],'base64'));
   }
   if(record.code==='2330'){
    const quote=fixture.snapshot.rows.find(q=>q.code==='2330'),volume=record.daily.dailySeries.at(-1).volume;
    assert.ok(Math.abs(volume-quote.volume)/quote.volume>.2);assert.equal(row.technicalAvailable,false);assert.equal(row.state,'INSUFFICIENT_DATA');
    row.volumeConflict={workerShares:volume,snapshotShares:quote.volume,differencePct:Math.abs(volume-quote.volume)/quote.volume*100,existingTolerancePct:20};
   }else{assert.equal(row.technicalAvailable,true);assert.equal(row.bars,record.daily.dailySeries.length);}
   results.push(row);console.log(JSON.stringify({code:row.code,name:row.name,state:row.state,sameEntries:row.entries.length,technicalAvailable:row.technicalAvailable}));
  }
  // Synthetic reference for visual comparison; never used as live market data.
  const {bars,report}=require('../research-fixtures.cjs'),C=require('../../four-models-research-v1.js');
  const ref=bars(160,()=>178);ref[125].high=201;ref[153].high=187;ref[158]={...ref[158],open:181,low:180,high:184,close:183,volume:201000};ref[159]={...ref[159],open:184,low:183.5,high:192.5,close:189,volume:643000};
  const reference=C.evaluate(report(ref,{stock:'6690',name:'安碁資訊',originalB:201}));
  const sample=await page.evaluate(a=>{const p=ShitouResearchReport.pages(a,{stockMode:true});return {pages:p.length,audit:JSON.parse(p[0].dataset.researchAudit),url:p[0].renderExportRegion().toDataURL('image/png')};},reference);
  assert.equal(sample.pages,1);assert.ok(sample.audit.noClipping);fs.writeFileSync(path.join(out,'synthetic-reference-6690.png'),Buffer.from(sample.url.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);assert.ok(new Set(results.map(row=>row.state)).size>1,'Different stock data must not be forced into one identical state');
  fs.writeFileSync(path.join(out,'multi-stock-results.json'),JSON.stringify({status:'PASS',scope:'Seven real API-response recordings through actual stock-query button; seven research envelope adapters per stock; actual card fields, summary/full images and preview buttons; not full scanner universe/eligibility verification',capturedAt:fixture.capturedAt,stockCount:results.length,entryComparisons:results.reduce((n,row)=>n+row.entries.length,0),results,errors},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
