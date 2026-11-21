'use strict';
/* Render real 1284x2778 PNGs in Chromium from actual completed sessions. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const Core=require('../../kline-life-03-core-v1.js');
const rawStock=require('../../data/research/2026-11-20/8039.json');
const market=require('../fixtures/taiex-20261120-v915.json');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'/tmp/v915-browser');
fs.mkdirSync(out,{recursive:true});
const stockStudy=require('../../kline-life-03-report-v1.js').inspect(Core.withSource(require('../../four-models-research-v1.js').evaluate(rawStock),rawStock));
const marketStudy=require('../../market-life-report-v96.js').evaluate(market,{now:new Date('2026-11-21T03:00:00Z')});
// The isolated browser must initialize release metadata before the tower-line core.
const dependencies=[
 'version-v50.js','tower-line-core.js','research-common-v1.js','research-life-source-audit-v932.js',
 'kline-life-03-core-v1.js','research-chart-layout-v921.js','kline-life-03-report-v1.js',
 'life-line-visual-v972.js','life-line-intelligence-v913.js','market-life-risk-v910.js',
 'market-life-risk-v913.js','life-line-visual-v913.js','market-life-visual-v913.js'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const evidence=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
  for(const file of dependencies)await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>Promise.all([ShitouLifeVisual913.ready(document),ShitouMarketLifeVisual913.ready(document)]));
  for(const type of ['stock','market']){
   const payload=type==='stock'?stockStudy:marketStudy,source=type==='stock'?rawStock:market;
   const audit=await page.evaluate(({type,payload,source})=>{
    const maker=type==='stock'?ShitouLifeVisual913:ShitouMarketLifeVisual913;
    const pages=maker.build(payload,{document,source:type==='stock'?source:null});
    return pages.map(p=>{const key=type==='stock'?'life98Audit':'marketLifeAudit';return JSON.parse(p.dataset[key]);});
   },{type,payload,source});
   assert.equal(audit.length,2,type+' must create exactly two independent pages');
   assert.ok(audit.every(x=>x.release==='V9.15'&&x.width===1284&&x.height===2778));
   assert.equal(audit[0].model.date,'2026-11-20');
   assert.equal(audit[0].model.close,payload.close);
   assert.deepEqual(audit[0].model.markers.map(v=>v.date),[payload.event.k3Date,payload.event.k2Date,payload.event.k1Date,payload.event.k0Date]);
   for(const number of [1,2]){
    const result=await page.evaluate(({type,payload,source,number})=>{
     const maker=type==='stock'?ShitouLifeVisual913:ShitouMarketLifeVisual913;
     const pages=maker.build(payload,{document,source:type==='stock'?source:null});
     const canvas=pages[number-1].renderExportRegion(),url=canvas.toDataURL('image/png');
     return {filename:pages[number-1].filename,data:url.split(',')[1]};
    },{type,payload,source,number});
    for(const width of [375,390,428]){
     await page.setViewportSize({width,height:926});
     const size=await page.evaluate(async data=>{
      const img=new Image();img.src='data:image/png;base64,'+data;img.style.width='100%';img.style.display='block';
      document.body.style.margin='0';document.body.replaceChildren(img);await img.decode();
      return {width:img.clientWidth,height:img.clientHeight,scroll:document.documentElement.scrollWidth};
     },result.data);
     assert.equal(size.width,width);assert.equal(size.scroll,width);assert.ok(Math.abs(size.height-width*2778/1284)<1);
    }
    const png=Buffer.from(result.data,'base64');
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),1284);assert.equal(png.readUInt32BE(20),2778);
    assert.ok(png.length>15000);
    const name=(type==='stock'?'8039':'TAIEX')+'-P0'+number+'.png';
    fs.writeFileSync(path.join(out,name),png);
    evidence.push({type,page:number,bytes:png.length,filename:name,close:payload.close});
   }
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({status:'PASS',revision:'V9.15',evidence,errors},null,2));
  console.log('V915_BROWSER_2X2_PNG_PASS '+JSON.stringify(evidence));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});