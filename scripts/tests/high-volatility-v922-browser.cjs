'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const { date, stocks, fixture } = require('../fixtures/high-volatility-v922.cjs');

const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || 'evidence/high-volatility-v922');
const origin = 'https://v922.test';
const rows = [...stocks, ...Array.from({ length: 1000 - stocks.length }, (_, index) =>
  ({ ...stocks[0], code: String(4000 + index), name: '測試樣本', short: '0' }))];
const replay = fixture(rows);
const errors = [];

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox'] });
  try {
    const phone = { width: 390, height: 844 };
    const page = await browser.newPage({ viewport: phone, isMobile: true, hasTouch: true, acceptDownloads: true });
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-22T11:00:00Z'));
    let inputs = replay.inputs;
    let snapshotReceipt = null;
    function validTpexReceipt() {
      const source = {
        volume: 'https://www.tpex.org.tw/openapi/v1/tpex_daily_turnover',
        margin: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_margin_balance',
        status: 'https://www.tpex.org.tw/openapi/v1/tpex_cmode'
      };
      const codes = Array.from({ length: 505 }, (_, i) => String(1000 + i));
      const feed = (key, rows, unit) => ({
        date, source: source[key], rows, ...(unit ? { unit } : {}),
        sourceRecords: rows.length, ordinaryRows: rows.length, invalidNumbers: 0,
        rawResponseSha256: 'a'.repeat(64)
      });
      const streams = {
        volume: feed('volume', codes.map(code => [code, 35000]), 'shares'),
        margin: feed('margin', codes.map(code => [code, 100, 31]), 'lots'),
        status: feed('status', [], null)
      };
      const data = {
        schema: 'V922_TPEX_OFFICIAL_INPUTS_V1', date,
        verification: 'OFFICIAL_DATE_FIELDS_COUNTS_AND_UNITS',
        markets: { TPEX: streams }
      };
      const payload = JSON.stringify(data) + '\n';
      const manifest = {
        schema: 'V922_TPEX_OFFICIAL_MANIFEST_V1', date, file: date + '.json',
        verification: data.verification,
        officialCalendarSource: 'https://www.twse.com.tw/exchangeReport/FMTQIK',
        completedMarketSnapshot: 'c'.repeat(64),
        sha256: createHash('sha256').update(payload).digest('hex'),
        sources: Object.fromEntries(Object.entries(streams).map(([key, stream]) =>
          [key, { url: stream.source, unit: stream.unit ?? null,
            records: stream.sourceRecords, ordinaryRows: stream.ordinaryRows,
            sha256: stream.rawResponseSha256 }]))
      };
      return { payload, manifest };
    }

    let releaseInputs;
    let delayInput = false;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const market = url.searchParams.get('market');
      if (snapshotReceipt && url.origin === origin && url.pathname.endsWith('/data/high-volatility/tpex/manifest.json')) {
        return route.fulfill({ json: snapshotReceipt.manifest });
      }
      if (snapshotReceipt && url.origin === origin && url.pathname.endsWith('/data/high-volatility/tpex/' + date + '.json')) {
        return route.fulfill({ body: snapshotReceipt.payload, contentType: 'application/json' });
      }
      if (url.origin === origin) {
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          return route.fulfill({ status: 404 });
        }
        const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
        return route.fulfill({ contentType: mime[path.extname(file)], path: file });
      }
      const reply = data => route.fulfill({ json: data });
      if (market === 'ALL_STOCKS') return reply(replay.snapshot);
      if (market === 'HIGH_VOLATILITY_INPUTS') {
        assert.equal(url.searchParams.get('date'), date);
        if (delayInput) await new Promise(resolve => { releaseInputs = resolve; });
        return reply(inputs).catch(() => {});
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
    assert.equal(await page.locator('[data-filter="structure"]').innerText(), '⑥ 高波動超夯選股');
    assert.equal(await page.locator('#structureMode, #structurePrewatchImage').count(), 0);
    assert.equal(await page.locator('#researchKind option[value^="STRUCTURE"]').count(), 0);

    async function scan() {
      await page.locator('#structureRun').click();
      await page.waitForFunction(() => !ShitouHighVolatilityUI.isRunning());
      return page.evaluate(() => {
        const result = ShitouHighVolatilityUI.getLast();
        return { qualified: result.qualified.length, top8: result.top8.length, missing: result.unverified.length };
      });
    }

    const positive = await scan();
    assert.deepEqual(positive, { qualified: 9, top8: 8, missing: 6 });

    // The live Worker can fail TPEx while GitHub Pages has an independently
    // verified same-day receipt. Recovered results must match the original.
    const originalInputs = inputs;
    snapshotReceipt = validTpexReceipt();
    inputs = {
      ...inputs, markets: { ...inputs.markets,
        TPEX: Object.fromEntries(['volume', 'margin', 'status'].map(key =>
          [key, { date: null, rows: [], error: 'Cloudflare TPEx timeout' }])) }
    };
    const recovered = await scan();
    assert.deepEqual(recovered, { qualified: 9, top8: 8, missing: 6 });
    assert.match(await page.locator('#structureResult').innerText(), /上櫃官方同日快照校驗/);
    const otcRecovered = await page.evaluate(() => ShitouHighVolatilityUI.getLast().rows.find(x => x.code === '1240'));
    assert.equal(otcRecovered.status, 'QUALIFIED');
    // A tampered receipt must fail closed and must not restore the OTC candidate.
    snapshotReceipt.manifest.sha256 = 'f'.repeat(64);
    const tampered = await scan();
    assert.equal(tampered.qualified, 8);
    assert.match(await page.locator('#structureResult').innerText(), /SHA-256/);
    const otcBlocked = await page.evaluate(() => ShitouHighVolatilityUI.getLast().rows.find(x => x.code === '1240'));
    assert.equal(otcBlocked.status, 'UNVERIFIED');
    snapshotReceipt = null;
    inputs = originalInputs;

    assert.equal(await page.locator('#structureProgress').getAttribute('value'), '100');
    assert.match(await page.locator('#structureResult').innerText(), /交易日 2026-11-20｜版本 V9\.22[\s\S]*券資比 31%｜單日週轉率 35%/);
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
      assert.match(download.suggestedFilename(), /V9\.22\.png$/);
      await download.saveAs(path.join(out, file));
      const png = fs.readFileSync(path.join(out, file));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 1284);
      assert.equal(png.readUInt32BE(20), 2778);
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
    assert.match(fs.readFileSync(path.join(out, 'report.txt'), 'utf8'), /V9\.22[\s\S]*成交／流通在外普通股[\s\S]*融資餘額為 0/);

    inputs = { ...inputs, outstanding: { date: null, rows: [], error: '同日來源未設定' } };
    const unavailable = await scan();
    assert.equal(unavailable.qualified, 0);
    assert.match(await page.locator('#structureResult').innerText(), /全市場合格檔數未確認/);
    assert.doesNotMatch(await page.locator('#structureResult').innerText(), /合格 0 檔/);
    await page.screenshot({ path: path.join(out, 'mobile-unverified.png') });

    delayInput = true;
    const pendingRequest = page.waitForRequest(request => request.url().includes('market=HIGH_VOLATILITY_INPUTS'));
    await page.locator('#structureRun').click();
    await pendingRequest;
    assert.equal(await page.locator('#structureStop').isEnabled(), true);
    await page.locator('#structureStop').click();
    await page.waitForFunction(() => !ShitouHighVolatilityUI.isRunning());
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
