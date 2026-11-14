'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});
  const page=await browser.newPage({viewport:{width:428,height:926},deviceScaleFactor:3,isMobile:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.ShitouKlineLife03&&!!window.ShitouKlineLife03Report&&!!window.ShitouReleaseV50,{timeout:15000});
  const result=await page.evaluate(()=>{
   const days=['2026-11-02','2026-11-03','2026-11-04','2026-11-05'],raw=[[10,12,9,11],[11,13,10,12],[12,14,11,13],[12,13,10.5,12.5]];
   const a={code:'2330',name:'測試個股',date:days.at(-1),validation:{technicalModelAvailable:true},sourceBars:raw.map((x,i)=>({date:days[i],open:x[0],high:x[1],low:x[2],close:x[3],volume:1000000}))};
   const life=ShitouKlineLife03.evaluate(a),card=ShitouKlineLife03Report.fields(life),page=ShitouKlineLife03Report.page(life,{document,bars:a.sourceBars,displayCode:'V9.3.2'});
   const c=page.renderExportRegion(),data=c.toDataURL('image/png'),audit=JSON.parse(c.dataset.life03Audit);
   return {version:ShitouReleaseV50.displayCode,model:life.model,lifePrice:life.line,status:life.state,card:card.summary.value,width:c.width,height:c.height,audit,png:data.slice(0,30)};
  });
  assert.equal(result.version,require('../../version-v50.js').displayCode);assert.equal(result.model,'V9.2-KLINE-LIFE03');assert.equal(result.lifePrice,9);assert.equal(result.status,'STRONG');
  assert.equal(result.width,1284);assert.ok(result.height>=2778);assert.equal(result.audit.noClipping,true);assert.match(result.png,/^data:image\/png;base64,/);
  console.log(JSON.stringify({browser:true,result,nonCriticalPageErrors:errors.slice(0,3)}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
