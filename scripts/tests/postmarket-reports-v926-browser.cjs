'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {performance}=require('node:perf_hooks');
const {chromium}=require('playwright-core');
const MarketLife=require('../../market-life-report-v96.js');
const MarketRisk=require('../../market-life-risk-v913.js');
const FourModels=require('../../four-models-research-v1.js');
const StockLife=require('../../kline-life-03-core-v1.js');

const root=path.resolve(__dirname,'../..');
const out=path.resolve(process.argv[2]||'/tmp/v926-archive-reports');
const market=require('../../data/index/TAIEX.json');
const manifest=require('../../data/research/manifest.json');
const stock=require('../../data/research/2026-11-26/2330.json');
const sources=[['TAIEX',market,true],['2330',stock,false]];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};

async function run() {
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
  fs.mkdirSync(out,{recursive:true});
  try {
    const page=await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true,acceptDownloads:true});
    const errors=[], media=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!=='https://v926.test')return route.abort();
      const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const filename=path.resolve(root,relative);
      return filename.startsWith(root+path.sep)&&fs.existsSync(filename)
        ? route.fulfill({path:filename,contentType:mime[path.extname(filename)]})
        : route.fulfill({status:404});
    });
    const navigationStart=performance.now();
    await page.goto('https://v926.test/');
    const loadMs=performance.now()-navigationStart;
    for(const [symbol,source,index] of sources) {
      const analysis= index ? null : FourModels.evaluate(source,{generatedAt:manifest.generatedAt});
      const study=index ? MarketLife.evaluate(source,{now:new Date(source.closeDate+'T10:00:00Z')}) : StockLife.evaluate(analysis);
      assert.equal(study.dataAsOf||study.date,source.closeDate);
      const marketRisk=index ? MarketRisk.evaluate(study) : null;
      const quality=analysis?.models?.A?.breakoutQuality?.score;
      for(const watermark of [false,true]) {
        const result=await page.evaluate(async input=>{
          const start=performance.now();
          const {makeStudyPage}=await import('./postmarket-preview-v926.js');
          const rendered=await makeStudyPage(input);
          const renderTime=performance.now()-start;
          const audit=JSON.parse(rendered.dataset.postmarket926Audit);
          const encodeAt=performance.now();
          await ShitouImageShareV1.show(rendered,rendered.filename,rendered.title);
          const encodeTime=performance.now()-encodeAt;
          await document.querySelector('#imagePreviewImg').decode();
          const resolved=new URL(document.querySelector('#imageDownloadLink').href);
          return {audit,renderTime,encodeTime,imageSize:[document.querySelector('#imagePreviewImg').naturalWidth,
            document.querySelector('#imagePreviewImg').naturalHeight],blob:resolved.protocol==='blob:'};
        }, {source,study,analysis,index,marketRisk,quality,watermark,dataAsOf:index?undefined:manifest.generatedAt});
        assert.equal(result.audit.code,symbol);
        assert.equal(result.audit.date,source.closeDate);
        assert.deepEqual(result.imageSize,[1284,2778]);
        assert.equal(result.audit.watermark,watermark);
        assert.ok(result.audit.noClipping&&result.audit.barCount>0&&result.blob);
        assert.ok(result.audit.lines[0].text.includes(new Intl.NumberFormat('zh-TW').format(source.close)));
        for(const point of result.audit.points) {
          assert.equal(source.dailySeries.slice(-45)[point.barIndex].date,point.date);
          assert.ok(point.x>=105&&point.x<=1180&&point.y>=359&&point.y<=912);
        }
        const previewText=page.locator('#postmarketPreviewText');
        await previewText.locator('summary').click();
        assert.deepEqual(await previewText.locator('dt').allTextContents(),result.audit.lines.map(line=>line.label));
        assert.deepEqual(await previewText.locator('dd').allTextContents(),result.audit.lines.map(line=>line.text));
        const deliverable=page.waitForEvent('download');
        await page.locator('#imageDownloadLink').click();
        const file=await deliverable;
        const filename=path.join(out,file.suggestedFilename());
        await file.saveAs(filename);
        const png=fs.readFileSync(filename);
        assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1284,2778]);
        media.push({symbol,filename,watermark,close:source.close,marketRisk:marketRisk?.risk?.level??null,...result});
        await page.locator('.image-modal-close').click();
        assert.equal(await previewText.count(),0);
      }
    }
    await page.clock.setFixedTime(new Date(market.closeDate+'T10:00:00Z'));
    await page.goto('https://v926.test/market-outlook.html?postmarket-study=1');
    await page.locator('#marketLifeReportButton').click();
    await page.waitForFunction(()=>ShitouLifeViewer94.getState()?.pages.some(p=>p.dataset.postmarket926Audit) &&
      !document.getElementById('marketLifeReportButton').disabled,null,{timeout:30000});
    await page.evaluate(()=>ShitouLifeViewer94.select(ShitouLifeViewer94.getState().pages.length-1));
    assert.match(await page.locator('#imagePreviewTitle').textContent(),/盤後趨勢研究/);
    assert.match(await page.locator('#imageDownloadLink').getAttribute('download'),/V9\.26_TAIEX/);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'archive-reports.json'),JSON.stringify({source:'committed official OHLCV archives',loadMs,media,
      independentMarketStudyPage:true,errors},null,2));
    console.log(JSON.stringify({status:'PASS',loadMs,reports:media.map(({symbol,close,watermark,renderTime,encodeTime})=>
      ({symbol,close,watermark,renderTime,encodeTime}))}));
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
