'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const { date, replay } = require('../fixtures/enhanced-macd-v923.cjs');

const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || '/tmp/enhanced-macd-v923');
const origin = 'https://v923.test';
const sample = replay();
const errors = [];

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox'] });
  try {
    const phone = { width: 390, height: 844 };
    const page = await browser.newPage({ viewport: phone, isMobile: true, hasTouch: true, acceptDownloads: true });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.macdShare = null;
      Object.defineProperty(navigator, 'canShare', {configurable:true,value:({files})=>files[0] instanceof File});
      Object.defineProperty(navigator, 'share', {configurable:true,value:async ({files:[file]})=>{
        const bytes = new Uint8Array(await file.arrayBuffer());
        window.macdShare = {name:file.name, type:file.type, signature:[...bytes.slice(0,3)]};
      }});
    });
    await page.clock.setFixedTime(new Date(date + 'T11:00:00Z'));
    let inputs = sample.artifact;
    let releaseInputs;
    let delayInput = false;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const market = url.searchParams.get('market');
      const reply = data => route.fulfill({ json: data });
      if (market === 'ALL_STOCKS') return reply(sample.snapshot);
      if (url.origin === origin) {
        if (url.pathname.endsWith('/data/enhanced-macd/latest.json')) {
          if (delayInput) await new Promise(resolve => { releaseInputs = resolve; });
          return reply(inputs).catch(() => {});
        }
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          return route.fulfill({ status: 404 });
        }
        const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
        return route.fulfill({ contentType: mime[path.extname(file)], path: file });
      }
      return route.abort();
    });
    await page.goto(origin, { waitUntil: 'load' });
    await page.locator('#workspaceTabfilters').click();
    for (const [key, id] of [
      ['momentum', 'momentumScanButton'], ['daytrade', 'dayTradeScanButton'], ['strong', 'strongStockScanButton'],
      ['tower', 'towerRun'], ['restaurant', 'restaurantRun'], ['structure', 'structureRun']
    ]) {
      await page.locator('[data-filter="' + key + '"]').click();
      assert.equal(await page.locator('#' + id).isVisible(), true, key);
    }
    assert.equal(await page.locator('[data-filter="structure"]').innerText(), '⑥ 強化 MACD+');
    assert.equal(await page.locator('#structureMode, #structurePrewatchImage').count(), 0);
    assert.equal(await page.locator('#researchKind option[value^="STRUCTURE"]').count(), 0);

    async function scan() {
      await page.locator('#structureRun').click();
      await page.waitForFunction(() => !ShitouEnhancedMacdUI.isRunning());
      return page.evaluate(() => {
        const result = ShitouEnhancedMacdUI.getLast();
        return { qualified: result.qualified.length, top8: result.top8.length, missing: result.incomplete.length };
      });
    }

    const positive = await scan();
    assert.deepEqual(positive, { qualified: 9, top8: 8, missing: 0 });
    assert.equal(await page.locator('#structureProgress').getAttribute('value'), '100');
    assert.match(await page.locator('#structureResult').innerText(), /交易日 2026-11-23｜版本 V9\.23[\s\S]*當日剛黃金交叉[\s\S]*成交量 3,000 張/);
    assert.match(await page.locator('.enhanced-macd-list strong').first().innerText(), /^測試普通股（1200）$/);
    await page.locator('.enhanced-macd-rules summary').click();
    assert.match(await page.locator('.enhanced-macd-rules').innerText(), /供解讀與排名/);
    for (const width of [360, 390, 428, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.setViewportSize(phone);
    await page.screenshot({ path: path.join(out, 'mobile-scan.png'), fullPage: true });

    async function exportImage(id, file) {
      await page.locator('#' + id).click();
      const img = page.locator('#imagePreviewImg');
      await page.waitForFunction(() => document.getElementById('imagePreviewImg').naturalWidth === 1284 &&
        document.getElementById('imagePreviewModal').classList.contains('show'));
      assert.equal(await img.evaluate(node => node.naturalHeight), 2778);
      assert.ok(await img.evaluate(node => node.getBoundingClientRect().width <= innerWidth));
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#imageDownloadLink').click()]);
      assert.match(download.suggestedFilename(), /V9\.26\.png$/);
      await download.saveAs(path.join(out, file));
      const png = fs.readFileSync(path.join(out, file));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 1284);
      assert.equal(png.readUInt32BE(20), 2778);
      await page.waitForFunction(()=>!!ShitouImageShareV1.getState());
      const expected = await page.evaluate(()=>{window.macdShare=null;return ShitouImageShareV1.getState().files[0].name;});
      await page.locator('#imageShareButton').click();
      await page.waitForFunction(()=>window.macdShare!==null);
      assert.deepEqual(await page.evaluate(()=>window.macdShare),
        {name:expected,type:'image/jpeg',signature:[255,216,255]});
    }
    await exportImage('structureImage', 'top-8.png');
    await page.evaluate(() => closeInfographicPreviewV3328());
    await exportImage('structureAllImages', 'qualified-1.png');
    const [zip] = await Promise.all([page.waitForEvent('download'), page.locator('#r45PreviewZip').click()]);
    await zip.saveAs(path.join(out, 'qualified.zip'));
    assert.equal(fs.readFileSync(path.join(out, 'qualified.zip')).subarray(0, 2).toString(), 'PK');
    await page.evaluate(() => closeInfographicPreviewV3328());
    const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#structureText').click()]);
    await file.saveAs(path.join(out, 'report.txt'));
    assert.match(fs.readFileSync(path.join(out, 'report.txt'), 'utf8'), /V9\.23[\s\S]*當日剛黃金交叉[\s\S]*實收資本額/);

    const complete = inputs;
    inputs = { ...complete, result: { ...complete.result, complete: false, errors: ['官方資料缺日'] } };
    const unavailable = await scan();
    assert.equal(unavailable.top8, 0);
    assert.match(await page.locator('#structureResult').innerText(), /掃描未完成/);
    assert.doesNotMatch(await page.locator('#structureResult').innerText(), /合格 0 檔/);
    assert.equal(await page.locator('#structureImage').isEnabled(), false);
    await page.screenshot({ path: path.join(out, 'mobile-unverified.png') });
    inputs = { ...complete, result: { ...complete.result, qualified: [], top8: [] } };
    assert.deepEqual(await scan(), { qualified: 0, top8: 0, missing: 0 });
    assert.match(await page.locator('#structureResult').innerText(), /合格 0 檔/);
    inputs = { ...complete, snapshotHash: 'stale' };
    await page.locator('#structureRun').click();
    await page.waitForFunction(() => !ShitouEnhancedMacdUI.isRunning());
    assert.match(await page.locator('#structureMessage').innerText(), /官方快照不一致/);

    delayInput = true;
    const pendingRequest = page.waitForRequest(request => request.url().includes('/data/enhanced-macd/latest.json'));
    await page.locator('#structureRun').click();
    await pendingRequest;
    assert.equal(await page.locator('#structureStop').isEnabled(), true);
    await page.locator('#structureStop').click();
    await page.waitForFunction(() => !ShitouEnhancedMacdUI.isRunning());
    releaseInputs?.();
    assert.match(await page.locator('#structureMessage').innerText(), /已停止/);
    assert.deepEqual(errors, []);
    const evidence = { synthetic: true, date, positive, unavailable, widths: [360, 390, 428, 1440],
      navigation: 6, progress: true, stop: true, top8Png: '1284x2778', qualifiedZip: true, textDownload: true, errors };
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
