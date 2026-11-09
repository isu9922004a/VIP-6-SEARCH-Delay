'use strict';
// Every current instrument, both real PNG variants; compare with the deployed renderer.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright-core'),S=require('../../kronos-future-shares-v873');
const root=path.resolve(__dirname,'../..'),dataRoot=path.resolve(process.env.FUTURE_TEST_DATA_ROOT||root),out=path.resolve(process.argv[2]||'/tmp/future-classification'),read=p=>JSON.parse(fs.readFileSync(path.join(dataRoot,p))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const catalog=read('data/kronos-future/manifest.json'),research=read('data/research/manifest.json'),market=read('data/market/latest.json'),index=read('data/index/TAIEX.json'),shard=Number(process.env.CLASSIFICATION_SHARD||0),shards=Number(process.env.CLASSIFICATION_SHARDS||4),baseline=process.env.CLASSIFICATION_BASELINE;
assert.ok(baseline&&fs.existsSync(baseline),'Frozen deployed renderer required');assert.ok(Number.isInteger(shard)&&shard>=0&&shard<shards);assert.equal(catalog.asOf,research.date);assert.equal(catalog.asOf,market.tradeDateIso);assert.equal(index.closeDate,catalog.asOf);
const all=['TAIEX',...market.rows.map(q=>q.code)].sort(),published=[...Object.keys(catalog.instruments),...Object.keys(catalog.unavailable)];assert.equal(catalog.sourceCount,all.length);assert.equal(new Set(published).size,all.length);assert.deepEqual([...published].sort(),all);
const selected=all.filter((_,i)=>i%shards===shard);fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let page;const records=[],errors=[];try{
 const load=async()=>{page=await browser.newPage({viewport:{width:428,height:926}});page.on('pageerror',e=>errors.push(e.message));await page.setContent('<html lang="zh-Hant"><head><meta charset="utf-8"></head><body></body></html>');for(const p of ['research-v83/forecast-engine.js','elliott-wave-visual-v1.js','report-watermark-v84.js','kronos-future-core-v1.js','kronos-future-share-config-v873.js','kronos-future-shares-v873.js'])await page.addScriptTag({path:path.join(root,p)});await page.addScriptTag({path:baseline});await page.evaluate(()=>{globalThis.DeployedFutureRenderer=ShitouKronosFutureReport;});await page.addScriptTag({path:path.join(root,'kronos-future-report-v1.js')});await page.evaluate(()=>document.fonts.ready);};await load();
 for(const code of selected){const source=code==='TAIEX'?index:read('data/research/'+research.stocks[code].path),kind=S.typeOf(source);if(source.securityType==='DR'){records.push({code,state:'EXCLUDED',reason:'User excluded depositary receipts'});continue;}
  if(kind.type==='unsupported'){records.push({code,state:'UNSUPPORTED',reason:kind.reason});continue;}
  const entry=catalog.instruments[code];if(!entry){assert.ok(catalog.unavailable[code]);records.push({code,state:'LIMITED',reason:catalog.unavailable[code]});continue;}
  const bytes=fs.readFileSync(path.join(dataRoot,'data/kronos-future',entry.path));assert.equal(sha(bytes),entry.sha256);const forecast=JSON.parse(bytes);
  try{const r=await page.evaluate(({source,forecast})=>{
   const sourceBefore=JSON.stringify(source),modelBefore=JSON.stringify(forecast),old=DeployedFutureRenderer.render(source,forecast),original=JSON.parse(old.dataset.futureReportAudit),images=[];let first=null;
   for(const watermarked of [false,true]){const c=ShitouKronosFutureReport.render(source,forecast,{watermarked}),a=JSON.parse(c.dataset.futureReportAudit),text=a.logicalTexts.join('\n');
    if(c.width!==1284||c.height!==2778||!a.noClipping||!a.noOverlap||!a.noCardOverflow||!a.noTextOverlap)throw Error('Canvas/text bounds');
    if(JSON.stringify(a.baseline)!==JSON.stringify(original.baseline)||JSON.stringify(a.shares)!==JSON.stringify(original.shares))throw Error('Original numbers, labels or statistics changed');
    if(first&&JSON.stringify(first.logicalTexts)!==JSON.stringify(a.logicalTexts))throw Error('Watermark changed the explanation');
    if(/預覽|尚未上線|說明預覽/.test(text))throw Error('Preview label shipped');
    if(a.shares.state==='READY'){const n=v=>a.kind==='market'?v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):v.toFixed(2),lo=n(a.shares.band.lower),hi=n(a.shares.band.upper),unit=a.shares.instrument.unit;
     for(const line of ['本次分類範圍固定為 '+lo+'～'+hi+' '+unit,'高於'+hi+unit+'，列為「偏多」。','介於'+lo+'～'+hi+unit+'（含上下緣），列為「盤整」。','低於'+lo+unit+'，列為「偏空」。'])if(!a.logicalTexts.includes(line))throw Error('Missing dynamic classification explanation');
     if(!text.includes('占比非實際勝率或市場保證')||!text.includes('中途仍可能大漲大跌，不是低買高賣的獲利區間')||!text.includes('原停損'))throw Error('Missing risk/position warning');
     if(a.kind==='market'&&!text.includes('不等於每一檔股票的漲跌機率'))throw Error('Missing index warning');
     if(!a.logicalTexts.includes('明天收盤：'+a.shares.rows[0].denominator+'種模擬中，有'+a.shares.rows[0].counts[1]+'種在範圍內；三排共用此範圍。'))throw Error('Missing actual-sample beginner explanation');
     for(const row of a.shares.rows)if(row.counts.reduce((x,y)=>x+y,0)!==row.denominator||row.displayUnits.reduce((x,y)=>x+y,0)!==1000)throw Error('Invalid share counts');
    }
    if(!watermarked){const p=old.getContext('2d').getImageData(0,465,1284,1075).data,q=c.getContext('2d').getImageData(0,465,1284,1075).data;for(let i=0;i<p.length;i++)if(p[i]!==q[i])throw Error('Chart pixels changed');first=a;}
    images.push({watermarked,png:c.toDataURL('image/png')});c.width=c.height=1;
   }
   old.width=old.height=1;if(sourceBefore!==JSON.stringify(source)||modelBefore!==JSON.stringify(forecast))throw Error('Input mutated');return {state:first.shares.state==='READY'?'COMPLETE':'STATISTICS_LIMITED',reason:first.shares.reason||null,images,shares:first.shares};
  },{source,forecast});
   const images=[];for(const image of r.images){const bytes=Buffer.from(image.png.split(',')[1],'base64');assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[1284,2778]);const file=path.join(image.watermarked?'watermarked':'normal',code+'_'+catalog.asOf+'.png');fs.mkdirSync(path.join(out,file,'..'),{recursive:true});fs.writeFileSync(path.join(out,file),bytes);if(['4939','TAIEX'].includes(code)){fs.mkdirSync(path.join(out,'review'),{recursive:true});fs.copyFileSync(path.join(out,file),path.join(out,'review',code+(image.watermarked?'-marked':'')+'.png'));}images.push({file,sha256:sha(bytes),bytes:bytes.length});}
   records.push({code,state:r.state,reason:r.reason,images,chartPixelsIdentical:true,statisticsIdentical:true});
  }catch(e){records.push({code,state:'ERROR',reason:e.stack||String(e)});}
  if(records.length%40===0){console.log('CLASSIFICATION_PROGRESS '+shard+' '+records.length+'/'+selected.length+' errors='+records.filter(r=>r.state==='ERROR').length);await page.close();await load();}
 }
 const summary={date:catalog.asOf,shard,shards,input:all.length,checked:records.length,complete:records.filter(r=>r.state==='COMPLETE').length,limited:records.filter(r=>['LIMITED','STATISTICS_LIMITED','UNSUPPORTED'].includes(r.state)).length,excluded:records.filter(r=>r.state==='EXCLUDED').length,pngs:records.reduce((n,r)=>n+(r.images?.length||0),0),errors:records.filter(r=>r.state==='ERROR'),consoleErrors:errors};fs.writeFileSync(path.join(out,'audit-'+shard+'.json'),JSON.stringify({summary,records},null,2));console.log('CLASSIFICATION_BATCH '+JSON.stringify(summary));assert.deepEqual(summary.errors,[]);assert.deepEqual(errors,[]);assert.equal(summary.checked,summary.complete+summary.limited+summary.excluded);
 }finally{await page?.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
