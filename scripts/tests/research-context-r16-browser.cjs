'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(root,'evidence/r16/browser'));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/multi-stock-worker-responses-20261022.json'))),byCode=new Map(fixture.records.map(x=>[x.code,x]));
fs.mkdirSync(out,{recursive:true});
const normalize=s=>String(s).replace(/[\s｜]/g,'');
(async()=>{
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true,deviceScaleFactor:3}),origin='http://127.0.0.1:'+server.address().port,errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(origin))missing.push({url:r.url(),status:r.status()});});
  await page.route('**/*',route=>{const url=new URL(route.request().url()),reply=x=>route.fulfill({contentType:'application/json',body:JSON.stringify(x)});if(url.origin===origin)return route.continue();
   if(url.hostname==='shitou-agent-fib-api.d318426.workers.dev'&&byCode.has(url.searchParams.get('stock')))return reply(byCode.get(url.searchParams.get('stock')).full);
   if(url.hostname==='shitou-taiwanmarket-api.d318426.workers.dev'){
    if(url.searchParams.get('market')==='ALL_STOCKS')return reply(fixture.snapshot);
    if(url.searchParams.get('market')==='DEEP_SCAN'){const codes=(url.searchParams.get('codes')||'').split(',');if(codes.every(x=>byCode.has(x)))return reply({type:'MOMENTUM_DEEP_SCAN',results:codes.map(code=>({ok:true,code,data:byCode.get(code).daily}))});}
   }return route.abort();
  });
  await page.goto(origin,{waitUntil:'load'});
  const version=await page.evaluate(()=>({display:ShitouReleaseV50.displayCode,badge:document.querySelector('.version-pill').textContent,title:document.title,chart:ShitouResearchChart.VERSION,context:ShitouStructureContext.VERSION}));
  assert.equal(version.display,'V8.2.2-R16');assert.ok(version.badge.includes('V8.2.2-R16'));assert.ok(version.title.includes('V8.2.2-R16'));
  const controls=await page.evaluate(()=>['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerRun','restaurantRun','structureRun'].map(id=>!!document.getElementById(id)));assert.ok(controls.every(Boolean));
  await page.evaluate(names=>{globalThis.__names=names;globalThis.resolveStockInput=async()=>{const code=document.getElementById('stockInput').value;return {code,officialName:__names[code],directory:{}};};globalThis.loadShitoAssistantEvidenceV47=async()=>null;},Object.fromEntries(fixture.snapshot.rows.map(x=>[x.code,x.name])));
  const results=[];
  for(const record of fixture.records){
   await page.evaluate(()=>{ShitouResearchIntegration.clearStockQuery();ShitouSelectionDataV2.reset();});
   await page.locator('#stockInput').fill(record.code);await page.locator('#searchButton').click();
   await page.waitForFunction(code=>ShitouResearchIntegration.getCurrentStock()?.analysis.code===code,record.code,{timeout:25000});
   const result=await page.evaluate(()=>{
    const a=ShitouResearchIntegration.getCurrentStock().analysis,R=ShitouResearchReport,v=R.view(a),raw=shitouGetLastReportV82(),before=JSON.stringify(a),entries=[];
    for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){
     const row={code:a.code,kind,score:{total:88},eligible:false,report:raw},old=JSON.stringify(row),x=ShitouResearchIntegration.forReport(row);
     ShitouResearchIntegration.baseline(kind,{date:a.date,candidates:[row]},[row]);
     entries.push({kind,inputUnchanged:JSON.stringify(row)===old,sameReport:JSON.stringify(R.view(x))===JSON.stringify(v)});
    }
    const dom=[...document.querySelectorAll('#researchStock .research-card-field')].map(e=>({title:e.querySelector('.research-card-label').textContent,value:e.querySelector('.research-card-value').textContent}));
    const summary=R.pages(a,{stockMode:true}),full=R.pages(a,{stockMode:true,detail:true}),chart=R.candlePage(a),pages=[...summary,...full,...(chart?[chart]:[])],printed=[],overflow=[];
    const proto=CanvasRenderingContext2D.prototype,old=proto.fillText;proto.fillText=function(text,x,y,...rest){const w=this.measureText(String(text)).width;if(x<0||x+w>1284.5||y<0||y>2778)overflow.push({text:String(text),x,y,width:w});printed.push(String(text));return old.call(this,text,x,y,...rest);};
    try{for(const p of pages){const c=p.renderExportRegion();c.width=c.height=1;}}finally{proto.fillText=old;}
    return {code:a.code,date:a.date,state:a.state,entry:a.unifiedResearch?.entryDecision,entries,dom,expected:[...v.summary,...v.details],summaryExpected:v.summary,summary:summary.map(x=>JSON.parse(x.dataset.researchAudit)),full:full.map(x=>JSON.parse(x.dataset.researchAudit)),chart:chart?JSON.parse(chart.dataset.researchAudit):null,overflow,unchanged:before===JSON.stringify(a),summaryCount:summary.length};
   });
   assert.ok(result.entries.every(x=>x.inputUnchanged&&x.sameReport));assert.deepEqual(result.dom,result.expected);assert.ok(result.unchanged);assert.deepEqual(result.overflow,[]);
   for(const [pages,expected] of [[result.summary,result.summaryExpected],[result.full,result.expected]]){
    assert.ok(pages.every(x=>x.noClipping));for(const field of expected){const s=pages.flatMap(x=>x.fields).filter(x=>x.title.replace('（續）','')===field.title).map(x=>x.value).join('');assert.equal(normalize(s),normalize(field.value),record.code+' lost image field '+field.title);}
   }
   if(result.chart){
    assert.equal(result.chart.date,result.date);assert.equal(result.chart.lastDate,result.date);assert.ok(result.chart.barCount>=60&&result.chart.barCount<=120);
    await page.evaluate(()=>{globalThis.__selected=[];globalThis.__originalPreview=strongStockShowPagesV47;globalThis.strongStockShowPagesV47=(pages,opts)=>__selected.push({title:opts.title,prefix:opts.prefix,audits:pages.map(x=>JSON.parse(x.dataset.researchAudit))});});
    const card=page.locator('#researchStock');await card.getByRole('button',{name:'查看結構證據圖',exact:true}).click();await page.waitForFunction(()=>__selected.length===1);
    const selected=await page.evaluate(()=>{const out=__selected[0];globalThis.strongStockShowPagesV47=__originalPreview;return out;});assert.equal(selected.title,'四策略研究｜結構證據圖');assert.ok(selected.prefix.includes('V8.2.2-R16'));assert.deepEqual(selected.audits,[result.chart]);
    if(['2059','9933'].includes(record.code)){
     const images=await page.evaluate(()=>{const a=ShitouResearchIntegration.getCurrentStock().analysis,R=ShitouResearchReport;return {chart:R.candlePage(a).renderExportRegion().toDataURL('image/png'),summary:R.pages(a,{stockMode:true})[0].renderExportRegion().toDataURL('image/png')};});
     for(const [kind,url] of Object.entries(images))fs.writeFileSync(path.join(out,`${record.code}-${kind}.png`),Buffer.from(url.split(',')[1],'base64'));
    }
   }
   const bounds=await page.evaluate(()=>[...document.querySelectorAll('#researchStock,#researchPanel,.version-pill')].map(x=>({id:x.id,left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right,scroll:x.scrollWidth,width:x.clientWidth})));assert.ok(bounds.every(x=>x.left>=0&&x.right<=428.5&&x.scroll<=x.width+1),JSON.stringify(bounds));
   console.log(JSON.stringify({code:result.code,state:result.state,summaryPages:result.summaryCount,chart:!!result.chart,entry:result.entry}));results.push(result);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',version,scope:'Seven recorded historical API responses through actual stock lookup button; seven research adapters each; original candidate objects preserved; mobile Chromium emulation, not native iPhone Safari; no full-market scan or profitability test',results,errors,missing},null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
