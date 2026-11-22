'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'/tmp/v916-evidence');
const raw=require('../../data/research/2026-11-20/8039.json');
const Core=require('../../kline-life-03-core-v1'),Report=require('../../kline-life-03-report-v1'),Four=require('../../four-models-research-v1');
const stock=Report.inspect(Core.withSource(Four.evaluate(raw),raw));
const snapshot=require('../fixtures/taiex-20261120-v915.json');
const market=require('../../market-life-report-v96').evaluate(snapshot,{now:new Date('2026-11-21T03:00:00Z')});
const marketRisk=require('../../market-life-risk-v913').evaluate(market);
const deps=['version-v50.js','tower-line-core.js','research-common-v1.js','research-life-source-audit-v932.js',
 'kline-life-03-core-v1.js','research-chart-layout-v921.js','kline-life-03-report-v1.js',
 'life-line-visual-v972.js','life-line-intelligence-v913.js','market-life-risk-v910.js','market-life-risk-v913.js',
 'life-risk-transparency-v916.js','heikin-ashi-life-v920.js','life-line-visual-v913.js','market-life-visual-v913.js'];
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const records=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  page.on('pageerror',err=>errors.push(err.message));
  await page.setContent('<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
  for(const file of deps)await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(async()=>{await Promise.all([ShitouLifeVisual913.ready(document),ShitouMarketLifeVisual913.ready(document)]);});
  for(const type of ['market','stock']){
   const study=type==='market'?market:stock;
   const pages=await page.evaluate(({type,study,source,marketRisk})=>{
    const maker=type==='market'?ShitouMarketLifeVisual913:ShitouLifeVisual913;
    const built=maker.build(study,{document,source:type==='stock'?source:null,market:type==='stock'?marketRisk:null,v916:true});
    return built.map((item,i)=>{
     const key=type==='market'?'marketLifeAudit':'life98Audit';
     const audit=JSON.parse(item.dataset[key]);
     const rendered=item.renderExportRegion();
     return {index:i+1,width:item.width,height:item.height,audit,filename:item.filename,png:rendered.toDataURL('image/png').split(',')[1]};
    });
   },{type,study,source:raw,marketRisk});
   assert.equal(pages.length,4,type+' must preserve V9.16 appendix and add V9.20 HA page');
   assert.equal(pages[0].audit.release,require('../../version-v50.js').displayCode);
   assert.equal(pages[1].audit.release,require('../../version-v50.js').displayCode);
   for(const p of pages){
    assert.equal(p.width,1284);assert.equal(p.height,2778);
    assert.equal(p.audit.date||p.audit.model?.date,'2026-11-20');
    assert.equal(p.audit.close??p.audit.model?.close,study.close);
    const file=(type==='market'?'TAIEX':'8039')+'-P0'+p.index+'.png',bin=Buffer.from(p.png,'base64');
    assert.equal(bin.readUInt32BE(16),1284);assert.equal(bin.readUInt32BE(20),2778);
    assert.ok(bin.length>15000,'PNG image must be real: '+file);
    fs.writeFileSync(path.join(out,file),bin);
    if(p.index===3){
     assert.equal(p.audit.release,require('../../version-v50.js').displayCode);
     assert.equal(p.audit.explanationStatus,'VERIFIED_FROM_CORE');
     assert.ok(p.audit.sections.length>0);
     assert.ok(p.audit.sections.some(x=>x.title.includes('為什麼')||x.title.includes('風險')));
    }
    if(p.index===4){assert.equal(p.audit.pageType,'HEIKIN_ASHI_APPENDIX');assert.equal(p.audit.affectsRanking,false);assert.ok(p.audit.signalText);}
    records.push({type,page:p.index,date:study.date,width:p.width,height:p.height,file,bytes:bin.length});
   }
   const first=pages[0];
   for(const width of [375,390,428]){
    await page.setViewportSize({width,height:926});
    const size=await page.evaluate(async({base64})=>{
     const img=new Image();img.src='data:image/png;base64,'+base64;img.style.width='100%';img.style.display='block';
     document.body.style.margin='0';document.body.replaceChildren(img);await img.decode();
     return {width:img.clientWidth,scroll:document.documentElement.scrollWidth};
    },{base64:first.png});
    assert.equal(size.width,width);assert.equal(size.scroll,width);
   }
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({version:'V9.16',status:'PASS',records,errors},null,2));
  console.log('V916_REAL_BROWSER_PNG_PASS '+JSON.stringify(records));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
