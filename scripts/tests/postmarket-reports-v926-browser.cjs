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
const site=path.resolve(process.env.REPORT_PAGES_STAGE || root);
const out=path.resolve(process.argv[2]||'/tmp/v926-archive-reports');
const market=require('../../data/index/TAIEX.json');
const manifest=require('../../data/research/manifest.json');
const stock=require(path.join(root,'data/research',manifest.stocks['2330'].path));
const calendar=require('../../data/kronos/calendar.json');
const Patterns=require('../../postmarket-patterns-v926.js');
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
      const filename=path.resolve(site,relative);
      return filename.startsWith(site+path.sep)&&fs.existsSync(filename)
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
      if(!index) {
        const modelRows=await page.evaluate(async ({source,analysis})=>{
          const archive=await ShitouOfficialResearchHistory.load(source.stock,{date:source.closeDate,market:source.market});
          const {modelPreviewReading}=await import('./postmarket-preview-v926.js');
          const render=await modelPreviewReading(archive,{analysis});
          return [...render().querySelectorAll('dd')].map(row=>row.textContent);
        },{source,analysis});
        const selected=media.find(entry=>entry.symbol===symbol).audit.lines;
        const schedule=Patterns.extendTradingCalendar(source.tradingCalendar,calendar,source.closeDate,manifest.generatedAt);
        const upcoming=schedule.dates.filter(date=>date>source.closeDate);
        if(upcoming.length)assert.ok(selected.some(row=>row.label==='下一交易日收盤情境 '+upcoming[0]));
        assert.deepEqual(modelRows,selected.filter(row=>['盤後研究','關鍵價位','開盤觀察'].includes(row.label)||
          row.label.startsWith('下一交易日收盤情境')).map(row=>row.text));
      }
    }
    await page.clock.setFixedTime(new Date(market.sourceReceipt.retrievedAt));
    await page.goto('https://v926.test/market-outlook.html?postmarket-study=1');
    await page.locator('#futureMarketCleanButton').click();
    const modelReading=page.locator('#simpleMarketReportDialog #postmarketPreviewText');
    await modelReading.locator('summary').click({timeout:30000});
    assert.match(await modelReading.locator('summary').innerText(),/盤後條件與價位/);
    const marketLines=media.find(entry=>entry.symbol==='TAIEX').audit.lines;
    assert.deepEqual(await modelReading.locator('dd').allTextContents(),
      marketLines.filter(row=>['盤後研究','關鍵價位','開盤觀察'].includes(row.label)||
        row.label.startsWith('下一交易日收盤情境')).map(row=>row.text));
    await page.locator('#simpleMarketReportDialog .compact-preview-head button').click();
    await page.locator('#marketLifeReportButton').click();
    await page.waitForFunction(()=>ShitouLifeViewer94.getState()?.pages.some(p=>p.dataset.postmarket926Audit) &&
      !document.getElementById('marketLifeReportButton').disabled,null,{timeout:30000});
    await page.evaluate(()=>ShitouLifeViewer94.select(ShitouLifeViewer94.getState().pages.length-1));
    assert.match(await page.locator('#imagePreviewTitle').textContent(),/盤後趨勢研究/);
    assert.match(await page.locator('#imageDownloadLink').getAttribute('download'),/V9\.26_TAIEX/);
    // Inject separately from the archived market reports. These are browser fixture counts.
    const date=market.closeDate;
    const sourcesFor=(market,host)=>['companies','quotes','status'].map(dataset=>({market,dataset,date,
      retrievedAt:`${date}T18:00:00+08:00`,source:`https://${host}/${dataset}`,sha256:'a'.repeat(64)}));
    const sidecar={schema:'OFFICIAL_POSTMARKET_BREADTH_V1',priceBasis:'UNADJUSTED_OFFICIAL_OHLC',date,snapshotHash:'b'.repeat(64),markets:{
      TWSE:{sources:sourcesFor('TWSE','www.twse.com.tw'),counts:{up:1,down:2,flat:1,above20:2,newHigh:1,newLow:2},
        coverage:{official:5,suspended:1,noTrades:0,noComparison:0,eligible:4,quote:4,history:4}},
      TPEX:{sources:sourcesFor('TPEX','www.tpex.org.tw'),counts:{up:1,down:0,flat:0,above20:1,newHigh:0,newLow:0},
        coverage:{official:4,suspended:0,noTrades:0,noComparison:0,eligible:4,quote:1,history:1}}
    }};
    let breadthCalls=0;
    await page.route('**/data/postmarket-breadth/latest.json',route=>{breadthCalls++;return route.fulfill({json:sidecar});});
    await page.reload();
    assert.equal(breadthCalls,0);
    const projected=await page.evaluate(async ({source,study})=>{
      const {makeStudyReport}=await import('./postmarket-preview-v926.js?v=V9.26-RESEARCH-2B');
      const reports=await Promise.all([makeStudyReport({source,study,index:true}),makeStudyReport({source,study,index:true})]);
      return reports.map(report=>report.lines.find(row=>row.label==='市場廣度').text);
    },{source:market,study:MarketLife.evaluate(market,{now:new Date(market.sourceReceipt.retrievedAt)})});
    assert.equal(breadthCalls,1);
    assert.equal(projected[0],projected[1]);
    assert.match(projected[0],/上市 1 漲 25%、2 跌 50%、1 平 25%.*4\/4 家已核對/);
    assert.match(projected[0],/上櫃廣度資料不足｜1\/4 家已核對/);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'archive-reports.json'),JSON.stringify({source:'committed official OHLCV archives',loadMs,media,
      independentMarketStudyPage:true,modelReadingMatchesStudy:true,breadthBrowserFixture:true,errors},null,2));
    console.log(JSON.stringify({status:'PASS',loadMs,reports:media.map(({symbol,close,watermark,renderTime,encodeTime})=>
      ({symbol,close,watermark,renderTime,encodeTime}))}));
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
