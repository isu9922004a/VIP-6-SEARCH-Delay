'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..'),dir=process.argv[2]||'/tmp/v92-life03-browser';fs.mkdirSync(dir,{recursive:true});
(async()=>{
const server=http.createServer((req,res)=>{
 const uri=new URL(req.url,'http://localhost'),decoded=decodeURIComponent(uri.pathname),name=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
 if(!name.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(name,(err,data)=>{if(err){res.writeHead(404);return res.end('Missing file');}const ext=path.extname(name);res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json'})[ext]||'application/octet-stream');res.end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
 const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:3,isMobile:true});
 const jsErrors=[];page.on('pageerror',e=>jsErrors.push(String(e.message)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'?route.continue():route.abort();});
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!globalThis.ShitouKlineLife03&&!!globalThis.ShitouKlineLife03Report&&!!globalThis.ShitouResearchReport,null,{timeout:60000});
 const result=await page.evaluate(()=>{
  const inp=[[10,12,9,11],[11,13,10,12],[12,14,11,13],[12,13,10.5,12.5]];
  const bars=inp.map((b,i)=>({date:'2026-11-'+String(2+i).padStart(2,'0'),open:b[0],high:b[1],low:b[2],close:b[3],volume:1000000}));
  const a={code:'2330',name:'測試股票',date:bars.at(-1).date,sourceBars:bars,validation:{technicalModelAvailable:true}};
  const study=ShitouKlineLife03.evaluate(a),lifePage=ShitouKlineLife03Report.page(study,{document,bars:a.sourceBars,displayCode:'V9.2.1'});
  const canvas=lifePage.renderExportRegion(),audit=JSON.parse(canvas.dataset.life03Audit);
  return {study:{state:study.state,line:study.line,code:study.code,date:study.date},audit,width:canvas.width,height:canvas.height,png:canvas.toDataURL('image/png'),display:ShitouReleaseV50?.displayCode||null,header:document.title};
 });
 assert.equal(result.display,'V9.2.1');assert.equal(result.study.state,'STRONG');assert.equal(result.study.line,9);
 assert.equal(result.width,1284);assert.ok(result.height>=2778);assert.equal(result.audit.noClipping,true);
 assert.equal(result.audit.k3Date,'2026-11-02');assert.ok(result.header.includes('V9.2.1'));
 const buf=Buffer.from(result.png.split(',')[1],'base64');assert.equal(buf.readUInt32BE(16),1284);assert.equal(buf.readUInt32BE(20),result.height);
 fs.writeFileSync(path.join(dir,'v92-life03.png'),buf);
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({display:result.display,audit:result.audit,pageErrors:jsErrors},null,2));
 assert.deepEqual(jsErrors.filter(e=>/life-03|Life03|ShitouKlineLife03/i.test(e)),[]);
 console.log('V9.2 browser image, module, release and anchor evidence passed');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
})().catch(err=>{console.error(err);process.exitCode=1;});
