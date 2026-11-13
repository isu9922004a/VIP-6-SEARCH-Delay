'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright-core'),root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'evidence/v921/browser');fs.mkdirSync(out,{recursive:true});
const Release=require('../../version-v50.js'),raw=require('../../data/research/2026-11-13/4939.json');
const overlap=(a,b)=>a.x<b.x+b.width-1&&a.x+a.width>b.x+1&&a.y<b.y+b.height-1&&a.y+a.height>b.y+1;
(async()=>{const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json'});res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true,deviceScaleFactor:3,acceptDownloads:true}),base=process.env.RESEARCH_BROWSER_ORIGIN||'http://127.0.0.1:'+server.address().port+'/',origin=new URL(base).origin,errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
await page.goto(base,{waitUntil:'load'});await page.waitForFunction(()=>!!globalThis.ShitouChartLayout921&&!!globalThis.ShitouResearchIntegration);await page.evaluate(()=>document.fonts.ready);
assert.equal(await page.evaluate(()=>ShitouReleaseV50.displayCode),Release.displayCode);
const result=await page.evaluate(raw=>{
 const a=ShitouFourModels.evaluate(raw,{generatedAt:'2026-11-13T14:31:08Z'}),before=JSON.stringify(a),life=ShitouKlineLife03Report.inspect(a),outputs=[];
 function render(label,p){const text=[],proto=CanvasRenderingContext2D.prototype,old=proto.fillText;proto.fillText=function(v,x,y,...rest){const m=this.measureText(String(v));text.push({text:String(v),x:x-m.actualBoundingBoxLeft,y:y-m.actualBoundingBoxAscent,width:m.actualBoundingBoxLeft+m.actualBoundingBoxRight,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,font:this.font});return old.call(this,v,x,y,...rest);};let c;try{c=p.renderExportRegion();}finally{proto.fillText=old;}outputs.push({label,width:c.width,height:c.height,png:c.toDataURL('image/png'),text,audit:JSON.parse(c.dataset.life03Audit||c.dataset.researchAudit)});}
 render('4939-structure',ShitouResearchChart.page(a));render('4939-life',ShitouKlineLife03Report.page(life,{bars:a.sourceBars}));
 const scenarios={bull:[[10,12,9,11],[11,13,10,12],[12,14,11,13],[12,13,10.5,12.5]],bear:[[21,22,19,20],[20,21,18,19],[19,20,17,18],[18,20,17.5,18.5]],none:Array(4).fill([10,11,9,10]),insufficient:[]};
 for(const [key,rows]of Object.entries(scenarios)){const bars=rows.map((v,i)=>({date:'2026-11-'+String(2+i).padStart(2,'0'),open:v[0],high:v[1],low:v[2],close:v[3],volume:1000000})),s=ShitouKlineLife03.evaluate({code:'9001',name:'合成測試｜'+key,date:bars.at(-1)?.date||'2026-11-05',sourceBars:bars,validation:{technicalModelAvailable:true}});render('TEST-'+key,ShitouKlineLife03Report.page(s,{bars}));}
 const long={...life,riskWarnings:Array(16).fill('合成長內容測試：保留完整風險與確認條件，不裁切最後一段。')};render('TEST-long',ShitouKlineLife03Report.page(long,{bars:a.sourceBars}));
 for(const [label,patch]of Object.entries({outside:{k3Date:'2026-01-02'},partial:{k1Date:null}})){const s={...life,code:'9001',name:'合成測試｜'+label,event:{...life.event,...patch}};render('TEST-'+label,ShitouKlineLife03Report.page(s,{bars:a.sourceBars}));}
 return {outputs,unchanged:before===JSON.stringify(a),analysis:a,life,fonts:document.fonts.check('34px "Microsoft JhengHei"')};
},raw);
assert.ok(result.unchanged);assert.ok(result.fonts);assert.equal(result.life.line,50.2);assert.equal(result.life.state,'NEUTRAL');assert.equal(result.life.event.k3Date,'2026-11-06');
for(const r of result.outputs){assert.equal(r.width,1284);assert.ok(r.height>=2778);const buf=Buffer.from(r.png.split(',')[1],'base64');assert.equal(buf.readUInt32BE(16),1284);assert.equal(buf.readUInt32BE(20),r.height);assert.ok(buf.length>20000);fs.writeFileSync(path.join(out,r.label+'.png'),buf);
 const bounds=r.text.filter(t=>t.width&& (t.x<-.5||t.x+t.width>1284.5||t.y<-.5||t.y+t.height>r.height+.5));assert.deepEqual(bounds,[],r.label+' text clipped');assert.ok(!r.text.some(t=>/NaN|Infinity|undefined/.test(t.text)),r.label);
 if(r.label.includes('structure')){assert.equal(r.audit.life03,null);assert.ok(!r.text.some(t=>/^K[0-3]$|固定生命線/.test(t.text)));const tags=r.audit.levelLabels;for(let i=0;i<tags.length;i++)for(let j=i+1;j<tags.length;j++)assert.ok(!overlap({...tags[i],x:94,width:42},{...tags[j],x:94,width:42}));}
 else{const g=r.audit.geometry;for(const e of g.events.filter(e=>e.status==='VISIBLE')){assert.equal(r.audit.barDates[e.index],e.date);assert.equal(e.anchorX,g.plot.x+(e.index+.5)*g.dx);}for(let i=0;i<g.labels.length;i++){const b=g.labels[i];assert.ok(b.x>=0&&b.x+b.width<=1284);for(let j=i+1;j<g.labels.length;j++)assert.ok(!overlap(b,g.labels[j]));}assert.ok(!r.text.some(t=>/試算價（D）|A起漲|B前高|C回低/.test(t.text)));}
 const major=r.text.filter(t=>r.label.includes('structure')?t.y>1730:t.y<550||t.y>1740||/^K[0-3]$|^2026-/.test(t.text));for(let i=0;i<major.length;i++)for(let j=i+1;j<major.length;j++)assert.ok(!overlap(major[i],major[j]),r.label+' text overlap '+JSON.stringify([major[i],major[j]]));
 delete r.png;
}
assert.ok(result.outputs.find(r=>r.label==='TEST-long').height>result.outputs.find(r=>r.label==='4939-life').height);
await page.evaluate(raw=>{globalThis.shitouGetLastReportV82=()=>raw;ShitouResearchIntegration.captureStockQuery(raw);ShitouResearchIntegration.mountStock(raw);document.getElementById('result').style.display='block';ShitouWorkspaceV831.openReport('four');document.querySelectorAll('#researchStock details').forEach(d=>d.open=true);},raw);
// Rendered card retains all detail fields; risks remain visible before opening details.
const card=page.locator('#researchStock');assert.match(await card.textContent(),/4939/);assert.match(await card.textContent(),/2026-11-13/);assert.match(await card.textContent(),/50.20/);assert.match(await card.textContent(),/ATR|波動/);
const bounds=await card.evaluate(e=>({scroll:e.scrollWidth,width:e.clientWidth}));assert.ok(bounds.scroll<=bounds.width+1);
await card.screenshot({path:path.join(out,'iphone-research-card.png')});
await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{globalThis.__shared=files.map(f=>({name:f.name,size:f.size,type:f.type}));}});});
for(const label of ['查看結構證據圖','查看生命線研究圖片']){
 await card.getByRole('button',{name:label,exact:true}).click();await page.locator('#imagePreviewImg').waitFor({state:'visible'});await page.evaluate(()=>document.getElementById('imagePreviewImg').decode());
 const img=await page.locator('#imagePreviewImg').evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight}));assert.equal(img.width,1284);assert.ok(img.height>=2778);
 await page.screenshot({path:path.join(out,(label.includes('生命線')?'life':'structure')+'-preview.png')});
 await page.waitForFunction(()=>ShitouImageShareV1.getState()?.files?.length>0);
 assert.equal(await page.evaluate(()=>ShitouImageShareV1.getState().singleImage),true);
 await page.locator('#imageShareButton').click();assert.ok((await page.evaluate(()=>globalThis.__shared))?.every(f=>f.size>0));
 // The original full-resolution PNG remains downloadable through the preview.
 const download=page.waitForEvent('download');await page.locator('#imageDownloadLink').click();const file=await download;await file.saveAs(path.join(out,(label.includes('生命線')?'life':'structure')+'-download.png'));
 await page.evaluate(()=>closeInfographicPreviewV3328());
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({site:base,version:Release.displayCode,sourceDate:raw.closeDate,inputSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/research/2026-11-13/4939.json'))).digest('hex'),...result,pageErrors:errors},null,2));
assert.deepEqual(errors,[]);console.log('V9.2.1 real Canvas, date geometry, model isolation, card and preview checks passed');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
