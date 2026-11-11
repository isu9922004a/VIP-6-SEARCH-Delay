'use strict';
// Renderer replay of verified historical snapshots; never substitute these
// dates or counts into the live application. Interactive bindings are covered
// separately by elliott-browser and the live production checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const W=require('../../elliott-wave-report-v1'),root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'/tmp/wave-hierarchy-browser');
const sources=[['stock',require('../fixtures/wave-hierarchy-1709-20261110.json')],['market',require('../fixtures/taiex-wave-20261106.json')]];
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const images=[],errors=[];try{
 const page=await browser.newPage({viewport:{width:428,height:926}});page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html lang="zh-Hant"><head><meta charset="utf-8"></head><body style="margin:0"></body></html>');
 for(const f of ['report-beginner-copy-v88.js','elliott-wave-visual-v1.js','report-watermark-v84.js','elliott-wave-stock-beginner-v1.js','elliott-wave-market-beginner-v1.js'])await page.addScriptTag({path:path.join(root,f)});
 await page.evaluate(()=>document.fonts.ready);
 for(const[kind,source]of sources){
  const model=W.buildModel(source,{kind}),before=JSON.stringify(model);let clean;
  for(const marked of [false,true]){
   const r=await page.evaluate(({model,kind,marked})=>{const before=JSON.stringify(model),renderer=kind==='stock'?ShitouWaveStockBeginner:ShitouWaveMarketBeginner,c=renderer.render(model,{watermarked:marked});if(JSON.stringify(model)!==before)throw Error('Renderer mutated shared analysis');return {png:c.toDataURL('image/png'),audit:JSON.parse(c.dataset.waveReportAudit)};},{model,kind,marked}),a=r.audit;
   assert.deepEqual([a.width,a.height],[1284,2778]);for(const key of ['noClipping','noOverlap','noCardOverflow','noTextOverlap'])assert.equal(a[key],true,key);
   assert.deepEqual(a.interpretation,model.wave.interpretation);assert.equal(a.date,source.closeDate);assert.equal(a.close,source.close);assert.equal(a.chart.chartReady,true);
   assert.ok(a.textBoxes.every(t=>!/^([）】。；，、]+)$/.test(t.text.trim())),'orphan punctuation row');
   if(kind==='stock'){assert.equal(a.interpretation.status,'NESTED_DEGREES');assert.ok(a.textBoxes.some(t=>t.text.includes('較大波段回調')));assert.ok(a.textBoxes.some(t=>t.text.includes('10-19～10-27')));assert.ok(a.textBoxes.every(t=>!t.text.includes('可能在第3段下跌')));assert.equal(a.beginner.reading.depth.ratioPct,58.20895522388063);}
   if(marked){assert.deepEqual(a.textBoxes,clean.textBoxes);assert.deepEqual(a.chart,clean.chart);}else clean=a;
   const bytes=Buffer.from(r.png.split(',')[1],'base64');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[1284,2778]);const file=kind+(marked?'-marked':'')+'.png';fs.writeFileSync(path.join(out,file),bytes);images.push({file,kind,marked,audit:a});
   if(!marked){await page.evaluate(png=>{const i=document.createElement('img');i.id='phone-preview';i.src=png;i.style.cssText='display:block;width:100%;max-width:428px;height:auto';document.getElementById('phone-preview')?.remove();document.body.append(i);return i.decode();},r.png);for(const width of [390,428,768,1440]){await page.setViewportSize({width,height:926});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(await page.locator('#phone-preview').evaluate(i=>[i.naturalWidth,i.naturalHeight]),[1284,2778]);}await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,kind+'-phone-390.png'),fullPage:true});}
  }
  assert.equal(JSON.stringify(model),before);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',historicalReplay:true,images,errors},null,2));console.log('WAVE_HIERARCHY_BROWSER_PASS '+JSON.stringify({reports:images.length,widths:[390,428,768,1440],errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
