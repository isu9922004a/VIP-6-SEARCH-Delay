'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const base=process.env.RESEARCH_BROWSER_ORIGIN;
assert.ok(base&&/^https:\/\//.test(base),'Set live HTTPS RESEARCH_BROWSER_ORIGIN');
const dir=path.resolve(process.argv[2]||'/tmp/v911-financial-live');fs.mkdirSync(dir,{recursive:true});
const url=p=>new URL(p,base.endsWith('/')?base:base+'/').toString();
async function published(p){
 const r=await fetch(url(p),{headers:{Accept:'application/json','Cache-Control':'no-cache'}});
 assert.equal(r.status,200,'Published file must exist: '+p);
 assert.match(r.headers.get('content-type')||'',/json/i,'Must be JSON: '+p);
 return r.json();
}
(async()=>{
 const manifest=await published('data/research/manifest.json');
 assert.equal(manifest.verified,true);assert.match(manifest.date,/^\d{4}-\d{2}-\d{2}$/);
 const inputs=[];
 for(const code of ['2881','2882','2891','5880','8099']){
  const e=manifest.stocks?.[code];
  assert.ok(e?.path?.startsWith(manifest.date+'/'),'Missing current official file: '+code);
  const raw=await published('data/research/'+e.path);
  assert.equal(raw.stock,code);assert.equal(raw.market,e.market);
  assert.equal(raw.closeDate,manifest.date);assert.equal(raw.marketDate,manifest.date);
  assert.equal(raw.completed,true);assert.equal(raw.isComplete,true);assert.equal(raw.volumeUnit,'shares');
  assert.ok(raw.dailySeries?.length>=63,code+' has incomplete history');
  assert.equal(raw.dailySeries.at(-1).date,manifest.date);assert.equal(raw.dailySeries.at(-1).close,raw.close);
  inputs.push({code,raw});
 }
 let browser;
 const rows=[],errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(url('index.html'),{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>ShitouReleaseV50.displayCode),'V9.13');
  assert.equal(await page.evaluate(()=>ShitouLifeVisual98.RELEASE),'V9.8');
  await page.evaluate(()=>ShitouLifeVisual98.ready(document));
  for(const {code,raw} of inputs){
   await page.evaluate(raw=>{
    ShitouWorkspaceV831.select('stock');ShitouResearchIntegration.clearStockQuery();
    globalThis.shitouGetLastReportV82=()=>raw;
    document.getElementById('stockInput').value=raw.stock;
    ShitouResearchIntegration.captureStockQuery(raw);ShitouResearchIntegration.mountStock(raw);
    document.getElementById('result').style.display='block';ShitouWorkspaceV831.renderSummary();
   },raw);
   await page.locator('#workspaceFourReportButton').click();
   await page.locator('#workspaceLifeReportButton').click();
   await page.waitForFunction(()=>document.getElementById('imagePreviewModal').classList.contains('show')&&document.getElementById('life94Status')?.textContent.includes('備妥'));
   const pages=await page.evaluate(async()=>{
    const out=[];
    for(const item of ShitouLifeViewer94.getState().pages){
     const audit=JSON.parse(item.dataset.life98Audit),canvas=item.renderExportRegion();
     const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
     if(!blob)throw Error('PNG encode returned null');
     const buffer=await blob.arrayBuffer(),view=new DataView(buffer);
     out.push({audit,bytes:blob.size,width:view.getUint32(16),height:view.getUint32(20)});
     canvas.width=canvas.height=1;
    }
    return out;
   });
   assert.equal(pages.length,2,code);
   for(const p of pages){
    assert.equal(p.audit.model.code,code);assert.equal(p.audit.model.date,manifest.date);
    assert.equal(p.audit.model.close,raw.close);assert.equal(p.width,1284);assert.equal(p.height,2778);
    assert.ok(p.bytes>15000);assert.equal(p.audit.affectsEligibility,false);
    assert.equal(p.audit.affectsRanking,false);
   }
   rows.push({code,date:manifest.date,close:raw.close,pages:2,status:'PASS'});
   await page.evaluate(()=>closeInfographicPreviewV3328());
  }
  assert.deepEqual(errors,[],'Live browser script errors');
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({date:manifest.date,site:base,rows,errors},null,2));
  console.log('V911_FINANCIAL_LIVE_PAGES_PASS '+rows.length+' stocks x 2 PNG pages');
 }finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
