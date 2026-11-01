'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(root,'evidence/v84'));
const fixture=require('../fixtures/multi-stock-worker-responses-20261022.json'),records=new Map(fixture.records.map(r=>[r.code,r]));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[],errors=[];
 try{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.url().startsWith('blob:'))console.log('BLOB FAILED',r.url(),r.failure());});
 await page.route('**/*',route=>{
  const u=new URL(route.request().url()),reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(u.hostname==='127.0.0.1'){
   // A test-only seed seam; export handlers and report drawing remain production code.
   if(/\/(strong-stock-ui-v47|tower-integration)\.js$/.test(u.pathname)){
    const source=fs.readFileSync(path.join(root,path.basename(u.pathname)),'utf8').replace('getLast:()=>last','setTestScan:s=>{last=s;render(s);},getLast:()=>last');
    return route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:source});
   }return route.continue();
  }
  if(u.hostname==='shitou-agent-fib-api.d318426.workers.dev'&&records.has(u.searchParams.get('stock')))return reply(records.get(u.searchParams.get('stock')).full);
  if(u.hostname==='shitou-taiwanmarket-api.d318426.workers.dev'){
   if(u.searchParams.get('market')==='ALL_STOCKS')return reply(fixture.snapshot);
   if(u.searchParams.get('market')==='DEEP_SCAN')return reply({type:'MOMENTUM_DEEP_SCAN',results:(u.searchParams.get('codes')||'').split(',').map(code=>({ok:true,code,data:records.get(code)?.daily}))});
  }return route.abort();
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!!globalThis.ShitouResearchIntegration,{},{timeout:10000}).catch(e=>{console.log('LOAD ERRORS',errors);throw e;});
 assert.equal(await page.evaluate(()=>applyAntiTheftWatermarkV3761.toString().includes('ShitouReportWatermark')),true,'legacy watermark entrypoint must delegate to reference style');
 await page.evaluate(names=>{globalThis.__testNames=names;globalThis.resolveStockInput=async()=>{const code=document.getElementById('stockInput').value;return {code,officialName:__testNames[code],directory:{}};};globalThis.loadShitoAssistantEvidenceV47=async()=>null;},Object.fromEntries(fixture.snapshot.rows.map(q=>[q.code,q.name])));
 for(const record of process.env.V84_SCAN_ONLY?[]:fixture.records){
  await page.evaluate(()=>{ShitouResearchIntegration.clearStockQuery();ShitouSelectionDataV2.reset();ShitouWorkspaceV831.select('stock');});
  await page.locator('#stockInput').fill(record.code);await page.locator('#searchButton').click();
  await page.waitForFunction(code=>shitouGetLastReportV82()?.code===code&&ShitouResearchIntegration.getCurrentStock()?.analysis.code===code,record.code,{timeout:30000});
  const result=await page.evaluate(async()=>{
   await document.fonts.ready;const raw=shitouGetLastReportV82(),before=JSON.stringify(raw),base=renderStockProfessionalBaseV51(raw),current=renderStockProfessionalInfographicV51(raw);
   const clean=current.toDataURL('image/png');applyAntiTheftWatermarkV3761(current,'stock');const marked=current.toDataURL('image/png');
   return {code:raw.code,name:raw.name,date:raw.closeDate,close:raw.close,width:current.width,height:current.height,audit:current.dataset.layoutAudit,base:base.toDataURL('image/png'),clean,marked,unchanged:before===JSON.stringify(raw)};
  });
  assert.ok(result.unchanged);assert.notEqual(result.clean,result.marked,'watermark must change real pixels');
  const audit=JSON.parse(decodeURIComponent(result.audit));
  assert.equal(audit.trend?.verified,true,'verified worker MA should produce an actual trend for '+record.code+': '+JSON.stringify(audit.trend));
  assert.ok(!/階段待確認/.test(audit.trend.label),'stage placeholder must not obscure the trend');
  assert.ok(['偏多','偏空','拉回整理','弱勢整理','盤整','反彈觀察','強勢上行','結構受損'].includes(audit.trend.label),JSON.stringify(audit.trend));
  assert.equal(audit.noOverlap,true,'professional report section geometry must remain intact');
  assert.equal(audit.shortTrend?.verified,true,'completed OHLCV bars should yield a short-term state for '+record.code);
  assert.ok(!/待確認/.test(audit.shortTrend.label),'short trend must be a real condition rather than a generic placeholder');
  const lastBars=record.full.dailySeries.slice(-5),prior=record.full.dailySeries.at(-2);
  const ma5=lastBars.reduce((sum,bar)=>sum+bar.close,0)/5,change=(record.full.close/prior.close-1)*100;
  assert.ok(Math.abs(audit.shortTrend.ma5-ma5)<.02,'short MA5 must match completed OHLCV for '+record.code);
  assert.ok(Math.abs(audit.shortTrend.changePct-change)<.02,'short daily change must match completed OHLCV for '+record.code);
  if(change<=-5&&record.full.close<ma5)assert.equal(audit.shortTrend.label,'急跌轉弱','sharp drop below MA5 should be prominent');
  assert.ok(decodeURIComponent(result.audit).includes('shortTrend'));
  result.trend=audit.trend;result.shortTrend=audit.shortTrend;
  for(const key of ['base','clean','marked']){const bytes=Buffer.from(result[key].split(',')[1],'base64');fs.writeFileSync(path.join(out,record.code+'-'+key+'.png'),bytes);delete result[key];}
  checks.push(result);console.log('PASS professional PNG',record.code,result.width,result.height);
  if(record.code==='9933'&&!process.env.V84_RENDER_ONLY){
   await page.evaluate(()=>ShitouWorkspaceV831.openReport('full'));
   for(const id of ['generateStockBeginnerImageButton','generateStockBeginnerWatermarkImageButton','generateStockProfessionalImageButton','generateStockProfessionalWatermarkImageButton','generateThreePanImageButton','generateThreePanWatermarkImageButton','generateTowerStockImageButton','generateTowerStockWatermarkImageButton']){
    await page.locator('#'+id).click();
    await page.waitForFunction(()=>document.querySelector('#imagePreviewModal')?.classList.contains('show')&&document.querySelector('#imagePreviewImg')?.complete&&document.querySelector('#imageDownloadLink')?.href.startsWith('blob:'),{},{timeout:30000});
    
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.locator('#imageDownloadLink').click({timeout:7000})]);
    const file=path.join(out,id+'.png');await download.saveAs(file);const bytes=fs.readFileSync(file);
    assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.readUInt32BE(16)>=1152);if(/Professional|ThreePan|TowerStock/.test(id))assert.equal(bytes.readUInt32BE(16),1284);
    checks.push({button:id,status:'PASS',bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
    await page.evaluate(()=>closeInfographicPreviewV3328());console.log('PASS button download',id);
   }
   await page.evaluate(()=>ShitouWorkspaceV831.closeReport());
  }
 }
 if(process.env.V84_RENDER_ONLY){assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report-checks.json'),JSON.stringify({checks,errors,scope:'Seven stocks; final reference professional renderer and real PNG pixel differences'},null,2));return;}
 const scans=JSON.parse(require('zlib').gunzipSync(fs.readFileSync(path.join(root,'scripts/fixtures/v84-scan-recordings.json.gz'))));
 await page.evaluate(s=>{
  lastMomentumScanDataV3762=s.main;lastDayTradeScanDataV1=s.daytrade;
  STRONG_STOCK_TEST_API_V47.setTestScan(s.strong);ShitouTowerIntegration.setTestScan(s.tower);
  document.querySelectorAll('#strongStockResult .watermark-image-btn').forEach((b,i)=>b.id='testStrongWatermark'+i);ShitouRestaurantUI.render(ShitouRestaurantScanner.snapshot(s.restaurant));ShitouStructureUI.render(ShitouStructureScanner.snapshot(s.structure));
 },scans);
 for(const [filter,ids] of [
  ['momentum',['generateMomentumImageButton','generateMomentumWatermarkImageButton','downloadMomentumAllCandidatesImageButton','downloadMomentumAllCandidatesImageWatermarkButton']],
  ['daytrade',['generateDayTradeImageButton','generateDayTradeWatermarkImageButton','downloadDayTradeAllCandidatesImageButton','downloadDayTradeAllCandidatesImageWatermarkButton']],
  ['strong',['strongStockTopImage','strongStockAllImage','testStrongWatermark0','testStrongWatermark1']],['tower',['towerImage']]
 ]){
  await page.evaluate(filter=>{ShitouWorkspaceV831.select('filters',filter);const ids={momentum:'momentumResult',daytrade:'dayTradeResult',strong:'strongStockResult',tower:'towerGoldPanel'};document.getElementById(ids[filter]).style.display='block';},filter);
  for(const id of ids){
   await page.locator('#'+id).click();
   await page.waitForFunction(()=>document.querySelector('#imagePreviewModal')?.classList.contains('show')&&document.querySelector('#imageDownloadLink')?.href.startsWith('blob:'),{},{timeout:45000});
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#imageDownloadLink').click()]);const file=path.join(out,id+'.png');await download.saveAs(file);const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(1,4).toString(),'PNG');
   checks.push({button:id,status:'PASS',bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});await page.evaluate(()=>closeInfographicPreviewV3328());console.log('PASS scan button',id);
  }
 }
 for(const filter of ['restaurant','structure']){
  await page.evaluate(filter=>ShitouWorkspaceV831.select('filters',filter),filter);
  for(const id of filter==='restaurant'?['restaurantImage','restaurantAllImages']:['structureImage','structurePrewatchImage']){assert.equal(await page.locator('#'+id).isEnabled(),false);checks.push({button:id,status:'PASS_EMPTY_GUARD'});}
 }
 // Positive fixtures explicitly use synthetic names and unverified-source labels.
 await page.evaluate(s=>{
  const restaurant={...s.restaurant,date:s.restaurantPositive.date,dataDate:s.restaurantPositive.date,results:[s.restaurantPositive],candidates:[s.restaurantPositive],planned:1,attempted:1};
  ShitouRestaurantUI.render(ShitouRestaurantScanner.snapshot(ShitouRestaurantScanner.finish(restaurant)));
  const structure={...s.structure,results:{A:[s.structurePositive],B:[s.structurePrewatch]},planned:1,attempted:1};
  ShitouStructureUI.render(ShitouStructureScanner.snapshot(structure));
  lastMarketReportData=s.market;
 },scans);
 for(const [filter,id] of [['restaurant','restaurantImage'],['restaurant','restaurantAllImages'],['structure','structureImage'],['structure','structureAllImages'],['structureB','structurePrewatchImage'],['market','generateMarketImageButton'],['market','generateMarketWatermarkImageButton']]){
  await page.evaluate(filter=>{ShitouWorkspaceV831.select(filter==='market'?'market':'filters',filter==='structureB'?'structure':filter);if(filter==='structureB'){document.querySelector('#structureMode').value='B';document.querySelector('#structureMode').dispatchEvent(new Event('change'));}if(filter==='market')document.getElementById('marketResult').style.display='block';},filter);
  await page.locator('#'+id).click();await page.waitForFunction(()=>document.querySelector('#imagePreviewModal')?.classList.contains('show')&&document.querySelector('#imageDownloadLink')?.href.startsWith('blob:'),{},{timeout:30000});
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#imageDownloadLink').click()]);await download.saveAs(path.join(out,id+'.png'));checks.push({button:id,status:'PASS',fixture:filter.startsWith('structure')||filter==='restaurant'?'SYNTHETIC':'RECORDED'});console.log('PASS additional button',id);
  if(id==='structureAllImages'){
   const [zip]=await Promise.all([page.waitForEvent('download'),page.locator('#r45PreviewZip').click()]);const file=path.join(out,'structure-complete.zip');await zip.saveAs(file);assert.equal(fs.readFileSync(file).subarray(0,2).toString(),'PK');checks.push({button:'r45PreviewZip',status:'PASS'});
  }
  await page.evaluate(()=>closeInfographicPreviewV3328());
 }
 await page.evaluate(()=>{globalThis.__clipboardPng=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const blob=await items[0].getType('image/png');if(blob.size>0)globalThis.__clipboardPng++;}}});ShitouWorkspaceV831.select('filters','daytrade');});
 for(const id of ['copyDayTradeTop8ImageButton','copyDayTradeTop8ImageWatermarkButton','copyDayTradeAllCandidatesImageButton','copyDayTradeAllCandidatesImageWatermarkButton']){
  const before=await page.evaluate(()=>__clipboardPng);await page.locator('#'+id).click();await page.waitForFunction(before=>__clipboardPng>before,before);checks.push({button:id,status:'PASS_PNG_CLIPBOARD'});await page.evaluate(()=>closeInfographicPreviewV3328());console.log('PASS image clipboard',id);
 }
 await page.evaluate(()=>ShitouWorkspaceV831.select('filters','tower'));
 const [towerZip]=await Promise.all([page.waitForEvent('download'),page.locator('#towerZip').click()]);const zipPath=path.join(out,'tower-complete.zip');await towerZip.saveAs(zipPath);assert.equal(fs.readFileSync(zipPath).subarray(0,2).toString(),'PK');checks.push({button:'towerZip',status:'PASS'});
 for(const width of [390,428,1440]){await page.setViewportSize({width,height:926});await page.evaluate(()=>ShitouWorkspaceV831.select('stock'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'viewport overflow '+width);await page.screenshot({path:path.join(out,'home-'+width+'.png')});}
 await page.screenshot({path:path.join(out,'home-mobile.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report-checks.json'),JSON.stringify({checks,errors,scope:'Recorded worker responses through real query buttons; report renderers and PNG pixels'},null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
