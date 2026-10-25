const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||(fs.existsSync(path.resolve(__dirname,'../../node_modules/playwright-core'))?'playwright-core':path.resolve(__dirname,'../../../browser-runtime/package'))),{bars,report}=require('../research-fixtures.cjs');
const {fixture9933}=require('../research-v822-fixture.cjs');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(root,'../v8-browser'));fs.mkdirSync(out,{recursive:true});const results=[],pageErrors=[];
async function check(name,fn){try{const detail=await fn();results.push({name,status:'PASS',detail});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',actual:e.message});console.log('FAIL',name,e.message);}}
(async()=>{const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const f=p===root?path.join(p,'index.html'):p;fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/json');res.end(b);});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:3,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'});page.on('pageerror',e=>pageErrors.push(e.message));await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
await check('application scripts and research API load',async()=>{assert.equal(await page.evaluate(()=>!!ShitouResearchIntegration&&!!ShitouFourModels),true);assert.deepEqual(pageErrors,[]);});
await check('short frontend code, details preserve full cumulative identity',async()=>{const v=await page.evaluate(()=>({code:ShitouReleaseV50.code,badge:document.querySelector('.version-pill').textContent,details:document.querySelector('#releaseDetails code').textContent,title:document.title,meta:document.querySelector('meta[name=viewport]').content}));assert.equal(v.badge,'V8.2.2-R8｜四策略研究');assert.equal(v.details,v.code);assert.ok(v.code.endsWith('MULTITF.1-DATASOURCE.1-UNIFIED-REPORT.1-LIVE-AUDIT.1'));assert.ok(v.title.length<30);assert.ok(v.meta.includes('viewport-fit=cover'));return v;});
await check('all six original filter controls remain mounted',async()=>{const a=await page.evaluate(()=>({nav:document.querySelectorAll('.filter-navigation a').length,buttons:['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerRun','restaurantRun','structureRun'].map(id=>!!document.getElementById(id))}));assert.equal(a.nav,6);assert.ok(a.buttons.every(Boolean));});
const fixture=report(bars(),{originalB:110,originalInvalidation:95});
async function bind(r){return page.evaluate(async r=>{const D=ShitouSelectionDataV2,z=r.canonicalBars.at(-1),q={...z,code:r.stock,name:r.name,market:r.market,quoteDate:r.closeDate,tradeValue:150000000,officialTradeValue:150000000,tradeValueSource:'OFFICIAL_REPORTED',industryCode:'28',industryName:'電子零組件業'};const meta={total:1,targetTradeDate:r.closeDate,completedTradeDate:r.closeDate,expectedTradeDate:r.closeDate,twseQuoteDate:r.closeDate,tpexQuoteDate:r.closeDate,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true,exclusionCoverageReady:true,exclusionDate:r.closeDate};D.reset();D.bind({meta,snapshotRows:1,map:new Map([[r.stock,q]])});await D.harmonize([{code:r.stock,name:r.name}],{type:'MOMENTUM_DEEP_SCAN',results:[{ok:true,code:r.stock,data:r}]},'DAILY_ONLY');ShitouResearchIntegration.render();return ShitouResearchIntegration.getState();},r);}
await check('shared canonical pipeline captures immutable same-date analysis',async()=>{const s=await bind(fixture);assert.equal(s.records.length,1);assert.equal(s.records[0].code,fixture.stock);assert.equal(s.records[0].originalB,110);});
await check('individual text, four copy controls and PNG share the same plan',async()=>{const a=await page.evaluate(r=>{document.getElementById('result').style.display='block';ShitouResearchIntegration.mountStock(r);const a=ShitouResearchIntegration.forReport(r);const pages=ShitouResearchReport.pages(a);window.__v8Pages=pages;window.__v8Analysis=a;return {frozen:Object.isFrozen(a),text:ShitouResearchReport.text(a),buttons:[...document.querySelectorAll('#researchStock .research-alerts button')].map(b=>b.textContent),audits:pages.map(p=>JSON.parse(p.dataset.researchAudit))};},fixture);assert.equal(a.frozen,true);assert.ok(a.text.includes('價格高於：110.00'));assert.ok(a.buttons.some(x=>x==='價格高於：110.00'));assert.ok(a.audits.every(x=>x.width===1284&&x.height===2778&&x.noClipping&&x.alertPlan.priceAbove.input===110));return {pages:a.audits.length,audits:a.audits};});
await check('compact study suppresses the optional extra candle page only',async()=>{const value=await page.evaluate(()=>ShitouResearchReport.candlePage(__v8Analysis));assert.equal(value,null);});
await check('PNG encoder uses image/png and correct iPhone resolution',async()=>{const payload=await page.evaluate(async()=>{const c=__v8Pages[0].renderExportRegion(),b=await new Promise(resolve=>c.toBlob(resolve,'image/png'));return {type:b.type,url:c.toDataURL('image/png'),w:c.width,h:c.height};});assert.equal(payload.type,'image/png');assert.equal(payload.w,1284);assert.equal(payload.h,2778);const bytes=Buffer.from(payload.url.split(',')[1],'base64');assert.equal(bytes.readUInt32BE(16),1284);assert.equal(bytes.readUInt32BE(20),2778);fs.writeFileSync(path.join(out,'V8.2.2-R4-研究圖卡.png'),bytes);});
await check('mobile card and version details stay within 428px viewport',async()=>{await page.locator('#releaseDetails').evaluate(e=>e.open=true);const bounds=await page.evaluate(()=>[...document.querySelectorAll('#researchStock,#researchPanel,.version-pill,#releaseDetails')].map(e=>({id:e.id,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,scroll:e.scrollWidth,width:e.clientWidth})));assert.ok(bounds.every(x=>x.left>=0&&x.right<=428.5&&x.scroll<=x.width+1),JSON.stringify(bounds));return bounds;});
await check('baseline candidate objects and order remain byte-identical',async()=>{const a=await page.evaluate(r=>{const rows=[{code:r.stock,report:r,score:73,eligible:true}],scan={date:r.closeDate,candidates:rows},before=JSON.stringify(scan);ShitouResearchIntegration.baseline('STRONG',scan,rows);ShitouResearchIntegration.ranking();return {same:before===JSON.stringify(scan),rank:ShitouResearchIntegration.getState().baselines[0][1].entries[0]};},fixture);assert.equal(a.same,true);assert.equal(a.rank.score,73);assert.equal(a.rank.rank,1);});
await check('six baseline sidecars preserve scores, eligibility and source ordering',async()=>{const a=await page.evaluate(r=>{const rows=[{code:r.stock,report:r,score:{total:73},eligible:true},{code:'9002',report:{...r,stock:'9002'},score:{total:99},eligible:false}],scan={date:r.closeDate,candidates:rows},before=JSON.stringify(scan);for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A'])ShitouResearchIntegration.baseline(kind,scan,rows);return {same:before===JSON.stringify(scan),scoresUnfrozen:rows.every(x=>!Object.isFrozen(x.score)),kinds:ShitouResearchIntegration.getState().baselines.map(([kind,x])=>({kind,codes:x.entries.map(x=>x.code),scores:x.entries.map(x=>x.score.total)}))};},fixture);assert.equal(a.same,true);assert.equal(a.scoresUnfrozen,true);assert.equal(a.kinds.length,6);for(const x of a.kinds){assert.deepEqual(x.codes,['9001','9002']);assert.deepEqual(x.scores,[73,99]);}});
await check('turning four models off preserves V7 and exact original B',async()=>{const a=await page.evaluate(r=>{ShitouResearchIntegration.setFlags({fourModelsEnabled:false});const x=ShitouResearchIntegration.forReport(r);ShitouResearchIntegration.setFlags({fourModelsEnabled:true});return {state:x.state,three:!!x.foundation.threeDayStructure,above:x.foundation.alertPlan.priceAbove.input};},fixture);assert.equal(a.state,'DISABLED');assert.equal(a.three,true);assert.equal(a.above,110);});
await check('tower ZIP accepts original observation and lazy research pages together',async()=>{const v=await page.evaluate(async r=>{const a=ShitouTowerIntegration.get(r),scan={date:r.closeDate,candidates:[a],attempted:1,planned:1,success:1,dataUnavailable:0,failed:0,text:'SYNTHETIC_FIXTURE',complete:true};const result=await ShitouTowerScanExport.zip(scan);return {type:result.blob.type,bytes:result.blob.size,details:result.audits.length};},fixture);assert.ok(v.bytes>0);assert.ok(v.details>0);return v;});
await check('failed response removes stale research signals',async()=>{const a=await page.evaluate(async()=>{const D=ShitouSelectionDataV2;await D.harmonize([{code:'9001'}],{type:'MOMENTUM_DEEP_SCAN',results:[{code:'9001',ok:false,error:'HTTP 503'}]},'DAILY_ONLY');return ShitouResearchIntegration.getState();});assert.equal(a.records[0].state,'INSUFFICIENT_DATA');});
await check('sharing preview offers download fallback without navigator.share',async()=>{await bind(fixture);const a=await page.evaluate(async r=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'canShare',{configurable:true,value:undefined});await ShitouResearchIntegration.preview([ShitouResearchIntegration.forReport(r)]);return {title:document.getElementById('imagePreviewTitle')?.textContent,text:document.getElementById('imagePreviewModal')?.textContent};},fixture);assert.ok(a.title.includes('四策略'));assert.ok(/下載|儲存/.test(a.text));return {title:a.title};});
await page.evaluate(()=>{if(typeof closeInfographicPreviewV3328==='function')closeInfographicPreviewV3328();});await page.locator('#researchStock').screenshot({path:path.join(out,'iPhone12ProMax-研究區.png')});await page.evaluate(()=>{document.getElementById("releaseDetails").open=false;scrollTo(0,0);});await page.screenshot({path:path.join(out,'iPhone12ProMax-首頁.png'),fullPage:false});
await check('individual display fits 390px and desktop without overflow',async()=>{for(const width of [390,1280]){await page.setViewportSize({width,height:926});const b=await page.locator('#researchStock').evaluate(e=>({right:e.getBoundingClientRect().right,w:innerWidth}));assert.ok(b.right<=b.w+.5);} });
const zfixture=fixture9933();
await check('9933 SYNTHETIC actual seven entry paths preserve identical core research',async()=>{
 await bind(zfixture);
 const x=await page.evaluate(r=>{
  const I=ShitouResearchIntegration,core=a=>JSON.stringify({state:a.state,models:a.models,features:a.features,families:a.families,risks:a.risks,breakout:a.researchBreakoutPrice,invalidation:a.researchInvalidation,quality:a.dataQuality,foundation:a.foundation}),expected=core(I.forReport(r)),results=[];
  const tower=ShitouTowerTrend.analyze(r,{asOf:r.marketDate,completed:true});
  const structure=mode=>ShitouStructureCore.evaluate(r,{mode,asOf:r.marketDate,qualification:{excluded:false,ordinaryVerified:true,reasons:[]}});
  for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){
   const c=kind==='TOWER'?tower:kind.startsWith('STRUCTURE')?structure(kind.endsWith('A')?'A':'B'):{code:r.stock,report:r,rsiObservationSource:{stock:r.stock,closeDate:r.marketDate,dailyRsi:74.82},score:73,eligible:true};
   const before=JSON.stringify(c);I.baseline(kind,{date:r.marketDate,candidates:[c]},[c]);const a=I.forReport(c);
   results.push({kind,same:core(a)===expected,unchanged:JSON.stringify(c)===before});
  }return results;
 },zfixture);assert.ok(x.every(r=>r.same&&r.unchanged),JSON.stringify(x));return x;
});
await check('single lookup without history automatically ensures canonical DAILY_ONLY and captures full research',async()=>{
 const value=await page.evaluate(async r=>{
  const D=ShitouSelectionDataV2,I=ShitouResearchIntegration,s=D.getSnapshot();D.reset();D.bind({map:s.map,meta:s.meta,snapshotRows:s.map.size});
  let calls=0;D.setFetcher(async items=>{calls++;return {type:'MOMENTUM_DEEP_SCAN',results:items.map(x=>({code:x.code,ok:true,data:r}))};});
  const raw={stock:r.stock,code:r.stock,name:r.name,market:r.market,closeDate:r.closeDate,close:r.close,dailyRsi:74.82,originalB:r.originalB,originalInvalidation:r.originalInvalidation,tradingCalendar:r.tradingCalendar};
  const prepared=await I.prepareStockQuery(raw);I.captureStockQuery(prepared,{activate:true});I.mountStock(prepared);
  const a=I.getCurrentStock().analysis;return {calls,count:a.validation.historyBarCount,available:a.validation.technicalModelAvailable,model:!!a.models.A,fields:ShitouResearchReport.lines(a)};
 },zfixture);assert.equal(value.calls,1);assert.equal(value.count,130);assert.ok(value.available&&value.model);return value;
});
await check('lookup refuses cross-day, cross-market and unfinished canonical cache adoption',async()=>{
 const x=await page.evaluate(async r=>{const I=ShitouResearchIntegration,rows=[];for(const raw of [{...r,closeDate:'2026-10-21',marketDate:'2026-10-21'},{...r,market:'TPEX'},{...r,completed:false}]){const p=await I.prepareStockQuery(raw),a=I.forReport(p);rows.push({state:a.state,available:a.validation.technicalModelAvailable,error:p.researchAcquisitionError,reason:a.reason});}return rows;},zfixture);
 assert.ok(x.every(r=>r.state==='INSUFFICIENT_DATA'&&!r.available),JSON.stringify(x));return x;
});
await check('9933 SYNTHETIC both image modes encode identical summaries and real PNG pages',async()=>{
 const x=await page.evaluate(r=>{
  const a=ShitouResearchIntegration.forReport(r),R=ShitouResearchReport,values=[];
  for(const stockMode of [false,true])for(const [i,p] of R.pages(a,{stockMode}).entries()){
   const c=p.renderExportRegion(),ctx=c.getContext('2d');ctx.fillStyle='#ffdf93';ctx.font='bold 38px "Microsoft JhengHei"';ctx.fillText('合成資料測試｜非真實行情',54,580);
   values.push({stockMode,index:i+1,audit:JSON.parse(p.dataset.researchAudit),url:c.toDataURL('image/png')});c.width=c.height=1;
  }return values;
 },zfixture);
 const f=x.filter(x=>!x.stockMode),s=x.filter(x=>x.stockMode);assert.equal(f.length,s.length);
 for(let i=0;i<f.length;i++){assert.deepEqual(f[i].audit.summary,s[i].audit.summary);assert.ok(f[i].audit.noClipping&&s[i].audit.noClipping);}
 for(const p of x){const bytes=Buffer.from(p.url.split(',')[1],'base64');assert.equal(bytes.readUInt32BE(16),1284);assert.equal(bytes.readUInt32BE(20),2778);fs.writeFileSync(path.join(out,`9933-SYNTHETIC-${p.stockMode?'stock':'filter'}-${p.index}.png`),bytes);}
 return {pagesPerMode:f.length,summary:f[0].audit.summary};
});
await check('single-stock inline image button chooses the stock title even without latest-query object identity',async()=>{
 const x=await page.evaluate(async r=>{const I=ShitouResearchIntegration,old=globalThis.strongStockShowPagesV47;let selected;
  globalThis.strongStockShowPagesV47=(pages,opts)=>selected={title:opts.title,mode:JSON.parse(pages[0].dataset.researchAudit).mode};
  try{I.mountStock({...r});document.querySelector('#researchStock .research-card-actions>button').click();await new Promise(resolve=>setTimeout(resolve,30));return selected;}finally{globalThis.strongStockShowPagesV47=old;}
 },zfixture);assert.equal(x.mode,'SINGLE_STOCK');assert.equal(x.title,'四策略研究｜個股查詢摘要');return x;
});
await check('sharing prepares image-only files and never reuses previous report bytes',async()=>{
 const x=await page.evaluate(async r=>{
  const a=ShitouResearchIntegration.forReport(r),share=ShitouImageShareV1,p=ShitouResearchReport.pages(a)[0];
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});let sent;
  Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{sent=payload;}});
  await share.prepare(p,{filename:'9933_first.png'});const old=share.getState().files[0];
  await share.prepare(p,{filename:'9933_second.png'});const fresh=share.getState().files[0];await share.shareCurrent();
  const actual=sent.files[0],ok=old!==fresh&&actual===fresh&&fresh.size>0&&fresh.type==='image/jpeg'&&Object.keys(sent).length===1;
  share.clear();return {ok,cleared:share.getState()===null,size:fresh.size,type:fresh.type};
 },zfixture);assert.ok(x.ok&&x.cleared);return x;
});
await check('real canvas text remains within horizontal safety bounds across long fields and continuation pages',async()=>{
 const x=await page.evaluate(r=>{
  const I=ShitouResearchIntegration,R=ShitouResearchReport,a=I.forReport(r),proto=CanvasRenderingContext2D.prototype,old=proto.fillText,overflows=[];
  proto.fillText=function(text,x,y,...args){const w=this.measureText(String(text)).width;if(x+w>1230.5)overflows.push({text:String(text),x,w,y});return old.call(this,text,x,y,...args);};
  try{
   const long={...a,name:'很長的測試股票名稱'.repeat(12),validation:{...a.validation,technicalModelAvailable:false},dataQuality:{missing:['完整日K缺漏原因'.repeat(200)],complete:false}};
   for(const value of [a,I.forReport({...r,canonicalBars:r.canonicalBars.slice(-15),dailySeries:r.dailySeries.slice(-15),expectedTradingDates:r.expectedTradingDates.slice(-15)}),long])for(const p of R.pages(value,{stockMode:true})){const c=p.renderExportRegion();c.width=c.height=1;}
   return overflows;
  }finally{proto.fillText=old;}
 },zfixture);assert.deepEqual(x,[]);return {overflows:x.length};
});
await check('seven research sections recover when legacy rerenders remove unchanged sidecars',async()=>{
 const results=await page.evaluate(r=>{const I=ShitouResearchIntegration,rows=[{code:r.stock,report:r,score:81,eligible:true}],scan={date:r.closeDate,candidates:rows},before=JSON.stringify(rows),result=[];
  for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){I.baseline(kind,scan,rows);const id='researchInline'+kind,first=document.getElementById(id);if(!first)throw Error('missing initial '+kind);first.remove();I.baseline(kind,scan,rows);const after=document.getElementById(id);result.push({kind,restored:!!after,cards:after?.querySelectorAll('.research-stock-card').length,sameInput:JSON.stringify(rows)===before});}return result;
 },zfixture);assert.equal(results.length,7);assert.ok(results.every(x=>x.restored&&x.cards===1&&x.sameInput),JSON.stringify(results));return results;
});
await check('actual legacy MAIN compact metadata dates and report-owned tickers mount their research baseline',async()=>{
 const result=await page.evaluate(r=>{const I=ShitouResearchIntegration,rows=[{report:r,score:81,eligible:true}],scan={marketBundleMeta:{targetTradeDate:r.closeDate.replaceAll('-','')},candidates:rows},before=JSON.stringify(scan);document.getElementById('researchInlineMAIN')?.remove();I.baseline('MAIN',scan,rows);const state=I.getState().baselines.find(([kind])=>kind==='MAIN')?.[1];return {cards:document.querySelectorAll('#researchInlineMAIN .research-stock-card').length,date:state?.date,code:state?.entries[0]?.code,unchanged:JSON.stringify(scan)===before};},zfixture);
 assert.deepEqual(result,{cards:1,date:zfixture.closeDate,code:zfixture.stock,unchanged:true});return result;
});
await check('all five scanner lazy observation image adapters prepare real JPEG share files',async()=>{
 const result=await page.evaluate(async r=>{const I=ShitouResearchIntegration,a=I.forReport(r),raw=r,results=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT']){const scan={date:raw.closeDate,dataDate:raw.closeDate,candidates:[{code:raw.stock,name:raw.name,report:raw,score:77,eligible:false}]},p=ShitouIndicatorShadow.pagesForScan(kind,scan).find(x=>x.dataset.indicatorShadowAudit);if(!p)throw Error('no lazy observation page '+kind);const tile=p.renderExportRegion({top:512,height:512,scale:.5}),region={width:tile.width,height:tile.height};tile.width=tile.height=1;
   const prepared=await ShitouImageShareV1.prepare(p,{filename:'audit_9933.png'});results.push({kind,region,prepared:!!prepared,bytes:prepared?.files[0]?.size,type:prepared?.files[0]?.type});}
  ShitouImageShareV1.clear();return results;
 },zfixture);assert.equal(result.length,5);for(const row of result){assert.deepEqual(row.region,{width:642,height:256});assert.ok(row.prepared&&row.bytes>1000);assert.equal(row.type,'image/jpeg');}return result;
});
await check('lazy observation watermarks survive both PNG download and JPEG rendering',async()=>{
 const result=await page.evaluate(async r=>{const previous=globalThis.applyAntiTheftWatermarkV3761;let calls=0;globalThis.applyAntiTheftWatermarkV3761=c=>{calls++;const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,64,64);};
  try{const scan={date:r.closeDate,dataDate:r.closeDate,candidates:[{code:r.stock,report:r,score:77}]},p=ShitouIndicatorShadow.pagesForScan('MAIN',scan,{watermark:true}).find(x=>x.dataset.indicatorShadowAudit),tile=p.renderExportRegion(),pixel=[...tile.getContext('2d').getImageData(5,5,1,1).data];tile.width=tile.height=1;const blob=await new Promise(resolve=>p.toBlob(resolve,'image/png')),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=canvas.height=64;canvas.getContext('2d').drawImage(bitmap,0,0);const pngPixel=[...canvas.getContext('2d').getImageData(5,5,1,1).data];bitmap.close();canvas.width=canvas.height=1;return {calls,pixel,pngPixel,type:blob.type,watermark:p.dataset.watermark};}finally{globalThis.applyAntiTheftWatermarkV3761=previous;}
 },zfixture);assert.equal(result.watermark,'enabled');assert.equal(result.calls,2);assert.deepEqual(result.pixel,[255,0,0,255]);assert.deepEqual(result.pngPixel,[255,0,0,255]);assert.equal(result.type,'image/png');return result;
});
await check('no additional JavaScript errors during report and toggle actions',async()=>assert.deepEqual(pageErrors,[]));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({engine:'Desktop Chrome with iPhone viewport/user-agent; not physical Safari',viewport:'428x926 CSS at 3x',results,pageErrors},null,2));if(results.some(x=>x.status==='FAIL'))process.exitCode=1;}})().catch(e=>{console.error(e);process.exitCode=1;});
