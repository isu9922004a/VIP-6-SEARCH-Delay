'use strict';
/* V9.21 real Chromium PNG and visual text assertions for stock and market appendices. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..');
const out=path.resolve(process.argv[2]||'/tmp/v921-ha-risk');
const stock=require('../../data/research/2026-11-20/8039.json').dailySeries;
const market=require('../fixtures/taiex-20261120-v915.json').dailySeries;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
  await page.addScriptTag({path:path.join(root,'heikin-ashi-life-v920.js')});
  for(const [type,bars,code] of [['stock',stock,'8039'],['market',market,'TAIEX']]){
   const result=await page.evaluate(({type,bars,code})=>{
    const sample=bars.map(({date,open,high,low,close})=>({date,open,high,low,close}));
    const model={bars:sample,code,name:code==='8039'?'台虹':'加權指數',date:sample.at(-1).date,close:sample.at(-1).close,currentRole:'BEAR'};
    const calls=[],original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(t,x,y,...rest){
     calls.push({text:String(t),x,y,width:this.measureText(String(t)).width});
     return original.call(this,t,x,y,...rest);
    };
    try{
     const api=window.ShitouHeikinAshi920;
     const computed=api.read({instrumentType:code==='TAIEX'?'TAIEX':'STOCK'},model);
     const report=api.page({instrumentType:code==='TAIEX'?'TAIEX':'STOCK'},model,{document,release:'V9.21'});
     const canvas=report.renderExportRegion(),dataURL=canvas.toDataURL('image/png');
     return {type,code,computed:{ma5:computed.ma5,support:computed.support,priceState:computed.priceState,ma5GapPct:computed.ma5GapPct},
      filename:report.filename,width:canvas.width,height:canvas.height,calls,png:dataURL.slice(dataURL.indexOf(',')+1)};
    }finally{CanvasRenderingContext2D.prototype.fillText=original;}
   },{type,bars,code});
   assert.equal(result.width,1284);assert.equal(result.height,2778);
   assert.equal(result.code,code);
   const texts=result.calls.map(x=>x.text).join('\n');
   assert.match(texts,/前20日低點（不含當日）/);
   assert.match(texts,/距5日均價/);
   assert.match(texts,/止跌觀察/);
   assert.match(texts,/轉強觀察/);
   assert.ok(result.calls.every(c=>c.x>=0&&c.y>=0&&c.y<2778&&c.x+c.width<=1268),'No canvas text overflows right edge');
   if(type==='stock'){
    assert.equal(result.computed.priceState,'BELOW_PRIOR_LOW');
    assert.match(texts,/已跌破前20日低點/);
    assert.match(texts,/-16\.82%/);
   }
   const png=Buffer.from(result.png,'base64');
   assert.equal(png.subarray(1,4).toString(),'PNG');
   assert.ok(png.length>20000);
   fs.writeFileSync(path.join(out,code+'-V921-PRICE-RISK.png'),png);
   const dims=await page.evaluate(async pngBase64=>{
    const img=new Image();img.src='data:image/png;base64,'+pngBase64;img.style.width='100%';img.style.display='block';
    document.body.style.margin='0';document.body.replaceChildren(img);await img.decode();
    return {width:img.clientWidth,height:img.clientHeight,scroll:document.documentElement.scrollWidth};
   },result.png);
   assert.equal(dims.width,428);assert.equal(dims.scroll,428);
   assert.ok(Math.abs(dims.height-428*2778/1284)<2);
   console.log('V921_HEIKIN_PNG_PASS '+JSON.stringify({type,code,bytes:png.length,priceState:result.computed.priceState,dims}));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
