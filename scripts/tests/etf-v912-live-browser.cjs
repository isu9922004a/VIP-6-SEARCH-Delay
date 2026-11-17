'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const base=process.env.RESEARCH_BROWSER_ORIGIN||'https://isu9922004a.github.io/VIP-6-SEARCH-Delay/';
const loc=p=>new URL(p,base.endsWith('/')?base:base+'/').toString(),out=path.resolve(process.argv[2]||'/tmp/etf-v912-live');
fs.mkdirSync(out,{recursive:true});
async function json(p){
 const r=await fetch(loc(p),{headers:{Accept:'application/json','Cache-Control':'no-cache'}});
 assert.equal(r.status,200,p);assert.match(r.headers.get('content-type')||'',/json/i,p);
 return r.json();
}
(async()=>{
 const m=await json('data/etf/manifest.json'),market=await json('data/research/manifest.json');
 assert.equal(m.schema,'SHITOU_ETF_MANIFEST_V912');assert.equal(m.verified,true);assert.equal(m.date,market.date);
 assert.equal(m.selectionEligible,false);assert.equal(m.scannerUniverseModified,false);
 const entry=m.instruments['00878'];assert.ok(entry?.ready,'00878 must have sufficient official daily history');
 const raw=await json('data/etf/'+entry.path);assert.equal(raw.securityType,'ETF');
 assert.equal(raw.stock,'00878');assert.equal(raw.closeDate,m.date);
 let browser;
 const errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(loc('index.html'),{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>ShitouReleaseV50.displayCode),'V9.13');
  await page.evaluate(()=>{document.getElementById('stockInput').value='00878';});
  await page.evaluate(()=>globalThis.analyzeStock());
  await page.waitForFunction(()=>ShitouResearchIntegration.getCurrentStock()?.analysis?.code==='00878');
  const result=await page.evaluate(()=>{
   const x=ShitouResearchIntegration.getCurrentStock(),source=x.source;
   return {name:x.analysis.name,code:x.analysis.code,date:x.analysis.date,close:x.metrics.close,
     type:source.securityType,etfResearchOnly:source.etfResearchOnly,monthlyPass:source.monthlyPass,
     notice:document.getElementById('etf912Notice')?.textContent,
     visible:document.getElementById('result')?.style.display,
     buttonDisabled:document.getElementById('workspaceLifeReportButton')?.disabled};
  });
  assert.equal(result.type,'ETF');assert.equal(result.etfResearchOnly,true);assert.equal(result.monthlyPass,null);
  assert.equal(result.code,'00878');assert.equal(result.date,m.date);assert.equal(result.close,raw.close);
  assert.match(result.notice,/不是主力成本/);assert.equal(result.visible,'block');assert.equal(result.buttonDisabled,false);
  // The life-image action lives inside the stock research dialog; open it through the visible user entry first.
  await page.locator('#workspaceFourReportButton').click();
  await page.locator('#workspaceLifeReportButton').click();
  await page.waitForFunction(()=>document.getElementById('life94Status')?.textContent.includes('備妥'));
  const pages=await page.evaluate(async()=>{
   const list=ShitouLifeViewer94.getState().pages,arr=[];
   for(const p of list){const audit=JSON.parse(p.dataset.life98Audit),canvas=p.renderExportRegion();
    const blob=await new Promise(ok=>canvas.toBlob(ok,'image/png'));if(!blob)throw Error('No PNG');
    const v=new DataView(await blob.arrayBuffer());arr.push({width:v.getUint32(16),height:v.getUint32(20),bytes:blob.size,audit});canvas.width=canvas.height=1;}
   return arr;
  });
  assert.equal(pages.length,2);
  for(const p of pages){assert.equal(p.width,1284);assert.equal(p.height,2778);assert.ok(p.bytes>15000);
   assert.equal(p.audit.model.code,'00878');assert.equal(p.audit.model.date,m.date);assert.equal(p.audit.model.close,raw.close);
   assert.equal(p.audit.affectsEligibility,false);assert.equal(p.audit.affectsRanking,false);}
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'etf-live.json'),JSON.stringify({result,pages:pages.map(x=>({width:x.width,height:x.height,bytes:x.bytes,page:x.audit.page})),errors,status:'PASS'},null,2));
  console.log('V912_ETF_LIVE_PASS 00878 date='+m.date+' 2 real 1284x2778 PNG');
 }finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
