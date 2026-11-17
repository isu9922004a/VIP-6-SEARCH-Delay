'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'/tmp/financial-v911');
const market=JSON.parse(fs.readFileSync(path.join(root,'data/market/latest.json'))),manifest=JSON.parse(fs.readFileSync(path.join(root,'data/research/manifest.json')));
const finance=market.rows.filter(q=>String(q.industryCode)==='17');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(e,bytes)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':'application/octet-stream'});res.end(e?'':bytes);});
});
(async()=>{
 assert.ok(finance.length>=20);assert.equal(manifest.date,market.tradeDateIso);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
 const output=[],errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port+'/';
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(base+'index.html',{waitUntil:'load'});
  await page.evaluate(()=>ShitouLifeVisual98.ready(document));
  for(const q of finance){
   const item=manifest.stocks[q.code];assert.ok(item&&item.path,q.code);
   const raw=JSON.parse(fs.readFileSync(path.join(root,'data/research',item.path)));
   try{
    const result=await page.evaluate(async ({raw})=>{
      const analysis=ShitouResearchIntegration.forReport(raw),study=ShitouKlineLife03Report.inspect(analysis);
      const pages=ShitouLifeVisual98.build(study,{document,source:raw}),audits=[],pn=[];
      for(const p of pages){
       const canvas=p.renderExportRegion();
       const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
       if(!blob)throw Error('PNG export returned null');
       const buffer=await blob.arrayBuffer(),view=new DataView(buffer);
       pn.push({bytes:blob.size,width:view.getUint32(16),height:view.getUint32(20)});
       audits.push(JSON.parse(p.dataset.life98Audit));
       canvas.width=canvas.height=1;
      }
      return {analysedCode:analysis.code,studyCode:study.code,date:study.date,state:study.state,close:study.close,
       pages:audits.map((a,i)=>({page:a.page,code:a.model.code,date:a.model.date,close:a.model.close,chartBars:a.chartBars,ma60:a.model.ma[60],affectsEligibility:a.affectsEligibility,affectsRanking:a.affectsRanking,png:pn[i]}))};
    },{raw});
    assert.equal(result.analysedCode,q.code);assert.equal(result.studyCode,q.code);
    assert.equal(result.pages.length,2);
    for(const p of result.pages){assert.equal(p.code,q.code);assert.equal(p.date,manifest.date);assert.equal(p.png.width,1284);assert.equal(p.png.height,2778);assert.ok(p.png.bytes>10000);assert.equal(p.affectsEligibility,false);assert.equal(p.affectsRanking,false);}
    if(item.ready){assert.equal(result.pages[0].close,raw.close);assert.ok(Number.isFinite(result.pages[0].ma60));}
    output.push({code:q.code,status:'PASS',ready:item.ready,history:item.bars,close:result.close});
   }catch(e){output.push({code:q.code,status:'FAIL',error:e.stack||e.message});}
   if(output.length%10===0)console.log('FINANCIAL_REPORT_PROGRESS '+output.length+'/'+finance.length+' failed='+output.filter(x=>x.status==='FAIL').length);
  }
  fs.writeFileSync(path.join(out,'financial-acceptance.json'),JSON.stringify({date:manifest.date,checked:output.length,passed:output.filter(x=>x.status==='PASS').length,failed:output.filter(x=>x.status==='FAIL'),rows:output,errors},null,2));
  assert.deepEqual(output.filter(x=>x.status==='FAIL'),[],'some financial reports failed');
  assert.deepEqual(errors,[],'browser page errors');
  console.log('V911_FINANCIAL_REPORT_BROWSER_PASS '+output.length+' financial stocks x 2 PNG pages');
 }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
