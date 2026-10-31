'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(root,'evidence/r16/browser'));
const fixture=JSON.parse(fs.readFileSync(process.env.RESEARCH_BROWSER_FIXTURE||path.join(root,'scripts/fixtures/multi-stock-worker-responses-20261022.json'))),byCode=new Map(fixture.records.map(x=>[x.code,x]));
fs.mkdirSync(out,{recursive:true});
const currentVersion=require('../../version-v50.js').displayCode;
const normalize=s=>String(s).replace(/[\s｜]/g,'');
(async()=>{
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true,deviceScaleFactor:3}),base=process.env.RESEARCH_BROWSER_ORIGIN||'http://127.0.0.1:'+server.address().port,origin=new URL(base).origin,errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(origin))missing.push({url:r.url(),status:r.status()});});
  await page.route('**/*',route=>{const url=new URL(route.request().url()),reply=x=>route.fulfill({contentType:'application/json',body:JSON.stringify(x)});if(url.origin===origin)return route.continue();
   if(url.hostname==='shitou-agent-fib-api.d318426.workers.dev'&&byCode.has(url.searchParams.get('stock')))return reply(byCode.get(url.searchParams.get('stock')).full);
   if(url.hostname==='shitou-taiwanmarket-api.d318426.workers.dev'){
    if(url.searchParams.get('market')==='ALL_STOCKS')return reply(fixture.snapshot);
    if(url.searchParams.get('market')==='DEEP_SCAN'){const codes=(url.searchParams.get('codes')||'').split(',');if(codes.every(x=>byCode.has(x)))return reply({type:'MOMENTUM_DEEP_SCAN',results:codes.map(code=>({ok:true,code,data:byCode.get(code).daily}))});}
   }return route.abort();
  });
  // Replay the completed market day, rather than comparing a historical API
  // recording with today's freshness gate. Timers continue to run normally.
  const recordedDate=String(fixture.snapshot.meta.targetTradeDate).replace(/-/g,'');
  const replayDate=recordedDate.slice(0,4)+'-'+recordedDate.slice(4,6)+'-'+recordedDate.slice(6,8);
  await page.clock.setFixedTime(new Date(replayDate+'T11:00:00Z'));
  if(process.env.RESEARCH_FALLBACK==='1')await page.addInitScript(()=>localStorage.setItem('shitou-research-flags-v1',JSON.stringify({unifiedResearchEnabled:false})));
  await page.goto(base,{waitUntil:'load'});await page.evaluate(()=>{globalThis.ShitouOfficialResearchHistory=undefined;});
  if(process.env.RESEARCH_FALLBACK==='1')assert.equal(await page.evaluate(()=>ShitouResearchIntegration.getFlags().unifiedResearchEnabled),false);
  const version=await page.evaluate(()=>({display:ShitouReleaseV50.displayCode,badge:document.querySelector('.version-pill').textContent,title:document.title,chart:ShitouResearchChart.VERSION,context:ShitouStructureContext.VERSION}));
  assert.equal(version.display,currentVersion);assert.ok(version.badge.includes(currentVersion));assert.ok(version.title.includes(currentVersion));
  const controls=await page.evaluate(()=>['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerRun','restaurantRun','structureRun'].map(id=>!!document.getElementById(id)));assert.ok(controls.every(Boolean));
  await page.evaluate(names=>{globalThis.__names=names;globalThis.resolveStockInput=async()=>{const code=document.getElementById('stockInput').value;return {code,officialName:__names[code],directory:{}};};globalThis.loadShitoAssistantEvidenceV47=async()=>null;},Object.fromEntries(fixture.snapshot.rows.map(x=>[x.code,x.name])));
  const results=[];let openingChecks=0;
  for(const record of fixture.records){
   await page.evaluate(()=>{ShitouResearchIntegration.clearStockQuery();ShitouSelectionDataV2.reset();});
   await page.locator('#stockInput').fill(record.code);await page.locator('#searchButton').click();
   await page.waitForFunction(code=>ShitouResearchIntegration.getCurrentStock()?.analysis.code===code,record.code,{timeout:25000});
   const result=await page.evaluate(()=>{
    const a=ShitouResearchIntegration.getCurrentStock().analysis,R=ShitouResearchReport,v=R.view(a),raw=shitouGetLastReportV82(),before=JSON.stringify(a),entries=[];
    for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){
     const row={code:a.code,kind,score:{total:88},eligible:false,report:raw},old=JSON.stringify(row),x=ShitouResearchIntegration.forReport(row);
     ShitouResearchIntegration.baseline(kind,{date:a.date,candidates:[row]},[row]);
     entries.push({kind,inputUnchanged:JSON.stringify(row)===old,sameReport:JSON.stringify(R.view(x))===JSON.stringify(v),diff:R.view(x).details.filter((f,i)=>JSON.stringify(f)!==JSON.stringify(v.details[i]))});
    }
    const dom=[...document.querySelectorAll('#researchStock .research-card-field')].map(e=>({title:e.querySelector('.research-card-label').textContent,value:e.querySelector('.research-card-value').textContent}));
    const summary=R.pages(a,{stockMode:true}),full=R.pages(a,{stockMode:true,detail:true}),chart=R.candlePage(a),pages=[...summary,...full,...(chart?[chart]:[])],printed=[],overflow=[];
    let activeHeight=2778;const proto=CanvasRenderingContext2D.prototype,old=proto.fillText;proto.fillText=function(text,x,y,...rest){const w=this.measureText(String(text)).width;if(x<0||x+w>1284.5||y<0||y>activeHeight)overflow.push({text:String(text),x,y,width:w});printed.push(String(text));return old.call(this,text,x,y,...rest);};
    try{for(const p of pages){activeHeight=p.height;const c=p.renderExportRegion();c.width=c.height=1;}}finally{proto.fillText=old;}
    return {guideEvidence:R.guideContext(a),code:a.code,date:a.date,state:a.state,priceBasis:a.unifiedResearch?.chart?.basisVerified,calendarVerified:a.unifiedResearch?.chart?.calendarVerified,entry:a.unifiedResearch?.entryDecision,entries,dom,expected:[...v.summary,...v.details],summaryExpected:v.summary,summary:summary.map(x=>JSON.parse(x.dataset.researchAudit)),full:full.map(x=>JSON.parse(x.dataset.researchAudit)),chart:chart?JSON.parse(chart.dataset.researchAudit):null,overflow,unchanged:before===JSON.stringify(a),summaryCount:summary.length};
   });
   if(result.guideEvidence){const g=result.guideEvidence;assert.ok(g.upper.every((x,i)=>!i||x.price>g.upper[i-1].price));if(process.env.RESEARCH_FALLBACK==='1')assert.equal(g.active,false);}
   assert.ok(result.entries.every(x=>x.inputUnchanged&&x.sameReport),JSON.stringify({entries:result.entries,expected:result.expected.filter(x=>['價格與交易日證據','資料狀態','行情資料完整性','技術現況'].includes(x.title))}));assert.deepEqual(result.dom,result.expected);assert.ok(result.unchanged);assert.deepEqual(result.overflow,[]);
   for(const [pages,expected] of [[result.summary,result.summaryExpected],[result.full,result.expected]]){
    assert.ok(pages.every(x=>x.noClipping));for(const field of expected){const s=pages.flatMap(x=>x.fields).filter(x=>x.title.replace('（續）','')===field.title).map(x=>x.value).join('');assert.equal(normalize(s),normalize(field.value),record.code+' lost image field '+field.title);}
   }
   if(result.chart){
    assert.equal(result.chart.date,result.date);assert.equal(result.chart.lastDate,result.date);assert.ok(result.chart.barCount>=60&&result.chart.barCount<=120);
    await page.evaluate(()=>{globalThis.__selected=[];globalThis.__originalPreview=strongStockShowPagesV47;globalThis.strongStockShowPagesV47=(pages,opts)=>__selected.push({title:opts.title,prefix:opts.prefix,audits:pages.map(x=>JSON.parse(x.dataset.researchAudit))});});
    const card=page.locator('#researchStock');await card.getByRole('button',{name:'查看結構證據圖',exact:true}).click();await page.waitForFunction(()=>__selected.length===1);
    const selected=await page.evaluate(()=>{const out=__selected[0];globalThis.strongStockShowPagesV47=__originalPreview;return out;});assert.equal(selected.title,'四策略研究｜結構證據圖');assert.ok(selected.prefix.includes(currentVersion));assert.deepEqual(selected.audits,[result.chart]);
    if(['2059','9933','8039'].includes(record.code)){
     const images=await page.evaluate(()=>{const a=ShitouResearchIntegration.getCurrentStock().analysis,R=ShitouResearchReport;const full=R.pages(a,{stockMode:true,detail:true}),levels=full.find(p=>JSON.parse(p.dataset.researchAudit).fields.some(f=>f.title==='原策略價位'));const nPages=full.filter(p=>JSON.parse(p.dataset.researchAudit).fields.some(f=>f.title.replace('（續）','')==='N字三種進場比較'));return {...Object.fromEntries(nPages.map((p,i)=>['n-comparison-'+(i+1),p.renderExportRegion().toDataURL('image/png')])),chart:R.candlePage(a).renderExportRegion().toDataURL('image/png'),summary:R.pages(a,{stockMode:true})[0].renderExportRegion().toDataURL('image/png'),...(levels?{'strategy-levels':levels.renderExportRegion().toDataURL('image/png')}:{})};});
     for(const [kind,url] of Object.entries(images))fs.writeFileSync(path.join(out,`${record.code}-${kind}.png`),Buffer.from(url.split(',')[1],'base64'));
    }
   }
   if(!result.chart&&record.code==='8039'){const url=await page.evaluate(()=>ShitouResearchReport.pages(ShitouResearchIntegration.getCurrentStock().analysis,{stockMode:true})[0].renderExportRegion().toDataURL('image/png'));fs.writeFileSync(path.join(out,'8039-summary.png'),Buffer.from(url.split(',')[1],'base64'));}
   const bounds=await page.evaluate(()=>[...document.querySelectorAll('#researchStock,#researchPanel,.version-pill')].map(x=>({id:x.id,left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right,scroll:x.scrollWidth,width:x.clientWidth})));assert.ok(bounds.every(x=>x.left>=0&&x.right<=428.5&&x.scroll<=x.width+1),JSON.stringify(bounds));
   const openingInput=page.locator('#researchStock input[aria-label="計畫交易日實際開盤價"]');if(await openingInput.count()){await page.locator('#researchStock .research-opening-calculator').evaluate(e=>e.open=true);await openingInput.fill(String(record.full.close));assert.match(await page.locator('#researchStock .research-opening-calculator [role=status]').textContent(),/開盤/);openingChecks++;}
   console.log(JSON.stringify({code:result.code,state:result.state,summaryPages:result.summaryCount,chart:!!result.chart,entry:result.entry}));results.push(result);
  }
  assert.ok(openingChecks>0,'actual opening-price calculator was exercised');
  await page.selectOption('#researchKind','STRONG');
  for(const mode of ['EVALUATE','WAIT','AVOID','DATA','ALL']){
   await page.selectOption('#researchEntryTools select',mode);
   const checked=await page.evaluate(mode=>{const I=ShitouResearchIntegration,base=I.getState().baselines.find(([k])=>k==='STRONG')?.[1]?.analyses||[],expected=ShitouEntryDirection.select(base,mode).map(x=>x.analysis.code),actual=[...document.querySelectorAll('#researchRows details.research-stock-card')].map(x=>x.dataset.code);return {expected,actual,selected:I.selectedRows().map(x=>x.analysis.code),disabled:document.querySelector('#researchPreview').disabled};},mode);
   assert.deepEqual(checked.actual,checked.expected.slice(0,8));assert.deepEqual(checked.selected,checked.expected);assert.equal(checked.disabled,!checked.expected.length);
  }
  await page.selectOption('#researchKind','STOCK_QUERY');
  assert.equal(await page.evaluate(()=>ShitouResearchIntegration.getCurrentStock().analysis.code),fixture.records.at(-1).code);
  const fixtureBuilder=require('../research-fixtures.cjs'),oldBars=fixtureBuilder.bars(200,i=>100+i*.05);oldBars[2].volume=0;
  const referenceFull=fixtureBuilder.report(oldBars,{stock:'9001',name:'合成舊歷史測試股'}),canonicalDaily=fixtureBuilder.report(oldBars.slice(-160),{stock:'9001',name:'合成舊歷史測試股',scanMode:'DAILY_ONLY',dailyOnly:true});
  const windowCheck=await page.evaluate(async ({full,daily})=>{const D=ShitouSelectionDataV2,z=daily.dailySeries.at(-1),date=z.date.replaceAll('-',''),q={...z,code:'9001',name:full.name,market:'TWSE',quoteDate:z.date,volumeUnit:'shares',tradeValue:z.close*z.volume,industryCode:'28'};D.reset();D.bind({map:new Map([['9001',q]]),snapshotRows:1,meta:{total:1,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true}});D.setFetcher(async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'9001',ok:true,data:daily}]}));globalThis.resolveStockInput=async()=>({code:'9001',officialName:full.name,directory:{}});globalThis.__realQueryTransportV828=globalThis.fetchStockAnalysisV3742;globalThis.fetchStockAnalysisV3742=async()=>({response:{ok:true,status:200},data:full});document.getElementById('stockInput').value='9001';await analyzeStock();const a=ShitouResearchIntegration.getCurrentStock().analysis;return {technical:a.validation.technicalModelAvailable,bars:a.validation.historyBarCount,audit:a.evidenceDiagnostics.referenceHistoryAudit,summary:ShitouResearchReport.view(a).summary};},{full:referenceFull,daily:canonicalDaily});
  assert.equal(windowCheck.technical,true);assert.equal(windowCheck.bars,160);assert.equal(windowCheck.audit.zeroVolumeOutsideResearch.length,1);assert.doesNotMatch(windowCheck.summary.map(x=>x.value).join(''),/日線還沒確認完整|無法安全計算買賣價|明天/);
  console.log('REFERENCE_WINDOW_BROWSER='+JSON.stringify(windowCheck));
  const fallbackCheck=await page.evaluate(async daily=>{const D=ShitouSelectionDataV2,snapshot=D.getSnapshot();D.reset();D.bind({...snapshot,snapshotRows:snapshot.meta.total});let redundantDailyRequests=0;D.setFetcher(async()=>{redundantDailyRequests++;throw Error('測試：不得重查已取得的日線');});const oldFetch=globalThis.fetch;let fullRequests=0,dailyRequests=0;globalThis.fetchStockAnalysisV3742=globalThis.__realQueryTransportV828;globalThis.fetch=async(url,options)=>{const u=new URL(String(url),location.href);if(u.hostname==='shitou-agent-fib-api.d318426.workers.dev'&&u.searchParams.get('stock')==='9001'&&!u.searchParams.has('assistant')){if(u.searchParams.get('mode')==='DAILY_ONLY'){dailyRequests++;return new Response(JSON.stringify(daily),{status:200,headers:{'Content-Type':'application/json'}});}fullRequests++;return new Response(JSON.stringify({error_code:1102,error_name:'worker_exceeded_resources',retryable:false,title:'Worker exceeded resource limits'}),{status:503,headers:{'Content-Type':'application/json'}});}return oldFetch(url,options);};try{document.getElementById('stockInput').value='9001';await analyzeStock();const r=shitouGetLastReportV82(),a=ShitouResearchIntegration.getCurrentStock().analysis;return {fullRequests,dailyRequests,redundantDailyRequests,technical:a.validation.technicalModelAvailable,fallback:r.technicalOnlyFallback,monthly:r.monthlyStatus,entry:r.entry};}finally{globalThis.fetch=oldFetch;}},canonicalDaily);
  assert.equal(fallbackCheck.fullRequests,1);assert.equal(fallbackCheck.dailyRequests,1);assert.equal(fallbackCheck.redundantDailyRequests,0);assert.equal(fallbackCheck.technical,true);assert.equal(fallbackCheck.fallback.active,true);assert.equal(fallbackCheck.monthly,'UNAVAILABLE');assert.equal(fallbackCheck.entry,null);console.log('RESOURCE_FALLBACK_BROWSER='+JSON.stringify(fallbackCheck));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',version,fallback:process.env.RESEARCH_FALLBACK==='1',scope:'Recorded API responses through actual stock lookup button; seven research adapters each; original candidate objects preserved; mobile Chromium emulation, not native iPhone Safari; no full-market scan or profitability test',results,errors,missing},null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

