'use strict';
// Fifth-filter browser regression: V9.29 replaces 2560; preserve mobile and PNG acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'../..'),out=process.argv[2]||'/tmp/restaurant-strict-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{const server=http.createServer((req,res)=>{const u=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});
 const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:1,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!!globalThis.ShitouLowBaseUIV929&&!!globalThis.ShitouLowBaseReportV929);
 assert.equal(await page.locator('#restaurantPanel').getAttribute('data-strategy'),'LOW_BASE_V929');
 assert.equal(await page.locator('#restaurantLimit').inputValue(),'all');
 assert.equal(await page.evaluate(()=>!!globalThis.ShitouStrategy2560UI),false);
 const render=async mode=>page.evaluate(mode=>{
 const C=ShitouLowBaseBreakoutV929,S=ShitouLowBaseScannerV929,date='2026-11-27',code='1001';
 const bars=Array.from({length:61},(_,i)=>{const close=i%2===0?99:101;return {open:close,high:close+.5,low:close-.5,close,volume:i>=56?1800000:3000000};});
 bars.push({open:99,high:104.5,low:98.5,close:104,volume:6000000});
 if(mode==='shadow')bars.at(-1).high=112;
 const c={...C.compute(mode==='missing'?bars.slice(1):bars,mode==='fail'?500000000:620000000),code,name:'合成測試',date};
 const scan=S.finish({date,items:[{code}],marketTotal:1,marketCoverageReady:false},[c],false);scan.testOnly=true;
 ShitouLowBaseUIV929.render(scan);globalThis.__strictScan=scan;
 return {status:c.status,checks:c.checks,candidates:scan.candidates.length,top8:scan.top8.length,errors:scan.errors,zeroConfirmed:scan.zeroConfirmed};
 },mode);
 const passed=await render('pass');assert.equal(passed.status,'PASS');assert.equal(passed.candidates,1);assert.equal(passed.top8,1);assert.equal(passed.checks.length,21);assert.ok(passed.checks.every(x=>x.pass===true));
 assert.equal(await page.locator('#restaurantImage').isEnabled(),true);
 const image=await page.evaluate(()=>{const p=ShitouLowBaseReportV929.pages(__strictScan,{testOnly:true})[0],c=p.renderExportRegion();return {audit:JSON.parse(p.dataset.klineAudit),png:c.toDataURL('image/png')};});
 assert.equal(image.audit.width,1284);assert.ok(image.audit.height>=2778);assert.equal(image.audit.noClipping,true);assert.equal(image.audit.noOverlap,true);
 const bytes=Buffer.from(image.png.split(',')[1],'base64');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[image.audit.width,image.audit.height]);fs.writeFileSync(path.join(out,'v929-low-base-passed.png'),bytes);
 const missing=await render('missing');assert.equal(missing.status,'INSUFFICIENT_DATA');assert.equal(missing.errors,1);assert.equal(missing.zeroConfirmed,false);assert.equal(await page.locator('#restaurantImage').isEnabled(),false);
 assert.match(await page.locator('#restaurantResult').innerText(),/不得宣稱全市場0檔/);
 const failed=await render('fail');assert.equal(failed.status,'FAIL');assert.equal(failed.candidates,0);assert.equal(await page.locator('#restaurantImage').isEnabled(),false);
 const shadow=await render('shadow');assert.equal(shadow.status,'FAIL');assert.equal(shadow.checks.find(x=>x.key==='SHADOW').pass,false);
 for(const width of [390,428,1440]){await page.setViewportSize({width,height:926});await page.evaluate(()=>ShitouWorkspaceV831.select('filters','restaurant'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow at '+width);}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed,missing,failed,shadow,errors,source:'SYNTHETIC_TEST_ONLY'},null,2));console.log('PASS V9.29 fifth filter 21 gates, missing data, hard rejection, mobile and PNG export');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
