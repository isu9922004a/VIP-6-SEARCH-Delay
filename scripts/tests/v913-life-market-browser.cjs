'use strict';
/* Render real 1284x2778 PNGs in Chromium from actual completed sessions. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const Core=require('../../kline-life-03-core-v1.js');
const rawStock=require('../../data/research/2026-11-17/5013.json');
const market=require('../fixtures/taiex-20261117-v913.json');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'/tmp/v913-browser');
fs.mkdirSync(out,{recursive:true});
const stockStudy=Core.evaluate(rawStock);
const coreMarket=Core.evaluate({code:'TAIEX',name:'台灣加權指數',date:market.closeDate,sourceBars:market.dailySeries,validation:{technicalModelAvailable:true},completed:true,priceAdjustment:market.priceAdjustment});
const marketStudy={...coreMarket,instrumentType:'TAIEX',sourceVerified:true};
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
  await page.setContent('<html lang="zh-Hant"><head><meta charset="utf-8"></head><body></body></html>');
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
   assert.ok(audit.every(x=>x.release==='V9.13'&&x.width===1284&&x.height===2778));
   if(type==='stock'){
    assert.equal(audit[0].model.life913.activeSupportEvent.lifeLinePrice,56.2);
    assert.equal(audit[0].model.life913.activeResistanceEvent.lifeLinePrice,70.9);
    assert.match(audit[0].model.life913.lifeStatus,/空方壓力K0剛成立/);
   }else{
    assert.equal(audit[0].marketRisk.risk.level,3);
    assert.equal(audit[0].marketRisk.phase.state,'POST_SHOCK_WEAKNESS');
   }
   for(const number of [1,2]){
    const result=await page.evaluate(({type,payload,source,number})=>{
     const maker=type==='stock'?ShitouLifeVisual913:ShitouMarketLifeVisual913;
     const pages=maker.build(payload,{document,source:type==='stock'?source:null});
     const canvas=pages[number-1].renderExportRegion(),url=canvas.toDataURL('image/png');
     return {filename:pages[number-1].filename,data:url.split(',')[1]};
    },{type,payload,source,number});
    const png=Buffer.from(result.data,'base64');
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),1284);assert.equal(png.readUInt32BE(20),2778);
    assert.ok(png.length>15000);
    const name=type+'-V913-P0'+number+'.png';
    fs.writeFileSync(path.join(out,name),png);
    evidence.push({type,page:number,bytes:png.length,filename:name,close:payload.close});
   }
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({status:'PASS',revision:'V9.13',evidence,errors},null,2));
  console.log('V913_BROWSER_2X2_PNG_PASS '+JSON.stringify(evidence));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});