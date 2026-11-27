'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '../..');
const stage = process.env.REPORT_PAGES_STAGE;
const out = path.resolve(process.argv[2] || '/tmp/report-preview-v926');
const webkitRun = process.argv.includes('--webkit');
const sizes = [[320, 568], [375, 667], [390, 844], [414, 896], [428, 926], [430, 932], [768, 1024], [1440, 900], [926, 428], [568, 320]];
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json'};

async function openReport(page, scenario = {}) {
  await page.evaluate(async ({filename = '強勢飆股_2330_20261126.png', color = '#163c58', height = 6800, standalone = false}) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1284;
    canvas.height = height;
    canvas.dataset.fullBleed = 'true';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '65px sans-serif';
    for (let y = 140; y < height; y += 650) ctx.fillText('Preview layout sample', 60, y);
    const show = standalone ? ShitouImageShareV1.show : showInfographicPreviewV3328;
    await show(canvas, filename, '強勢飆股濾網｜台積電（2330）｜第 1/2 頁');
    await document.querySelector('#imagePreviewImg').decode();
  }, scenario);
}

async function assertFixedControls(page) {
  const geometry = await page.evaluate(() => {
    const modal = document.querySelector('#imagePreviewModal');
    const scroll = modal.querySelector('.image-preview-wrap');
    const footer = modal.querySelector('.image-modal-footer');
    const buttons = ['#imageShareButton', '#imageDownloadLink', '.image-modal-close'].map(selector => {
      const button = modal.querySelector(selector);
      const {top, bottom, left, right, width} = button.getBoundingClientRect();
      return {top, bottom, left, right, width, visible: button.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2))};
    });
    const close = modal.querySelector('.image-modal-close');
    return {buttons, width: innerWidth, height: innerHeight, modalWidth: modal.scrollWidth, scrollWidth: scroll.scrollWidth,
      scrollClientWidth: scroll.clientWidth, footerBottom: footer.getBoundingClientRect().bottom, closeWhiteSpace: getComputedStyle(close).whiteSpace};
  });
  for (const button of geometry.buttons) {
    assert.ok(button.top >= 0 && button.bottom <= geometry.height && button.left >= 0 &&
      button.right <= geometry.width && button.width > 0 && button.visible, JSON.stringify(geometry));
  }
  assert.ok(geometry.modalWidth <= geometry.width);
  assert.ok(geometry.scrollWidth <= geometry.scrollClientWidth);
  assert.ok(geometry.footerBottom <= geometry.height);
  assert.equal(geometry.closeWhiteSpace, 'nowrap');
}

async function installMocks(page) {
  await page.addInitScript(() => {
    window.shareRecords = [];
    window.shareMode = 'unsupported';
    Object.defineProperty(navigator, 'canShare', {configurable:true, value: data => {
      if (shareMode === 'unsupported' || shareMode === 'reject-file') return false;
      return data.files[0] instanceof File && data.files[0].type === 'image/jpeg';
    }});
    const mockShare = async data => {
      const file = data.files[0];
      const record = {name: file.name, type: file.type, size: file.size, keys: Object.keys(data), activation: navigator.userActivation?.isActive};
      if (shareMode === 'cancel') throw new DOMException('cancel', 'AbortError');
      if (shareMode === 'system') throw new DOMException('failure', 'DataError');
      if (shareMode === 'gesture') throw new DOMException('permission', 'NotAllowedError');
      if (shareMode === 'pending') await new Promise(resolve => { window.finishShare = resolve; });
      const bytes = new Uint8Array(await file.arrayBuffer());
      record.signature = Array.from(bytes.slice(0, 3));
      const image = new Image();
      const url = URL.createObjectURL(file);
      try {
        image.src = url;
        await image.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        const ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0);
        record.pixel = [...ctx.getImageData(0, 0, 1, 1).data];
      } finally {
        URL.revokeObjectURL(url);
      }
      shareRecords.push(record);
    };
    Object.defineProperty(navigator, 'share', {configurable:true, get: () => shareMode === 'unsupported' ? undefined : mockShare});
  });
}

async function verifyShare(page) {
  const share = page.locator('#imageShareButton');
  const status = page.locator('#lineShareStatus');
  await share.click();
  assert.match(await status.textContent(), /不支援直接分享圖片/);
  await page.evaluate(() => {shareMode = 'reject-file';});
  await share.click();
  assert.match(await status.textContent(), /拒絕分享這個圖片檔/);
  for (const [link,signature,extension] of [
    ['#imageDownloadLink',[137,80,78,71],'.png'], ['#lineShareSave',[255,216,255],'.jpg']
  ]) {
    const downloading=page.waitForEvent('download');
    await page.locator(link).click();
    const download=await downloading;
    assert.ok(download.suggestedFilename().endsWith(extension));
    const bytes=fs.readFileSync(await download.path());
    assert.deepEqual([...bytes.subarray(0,signature.length)],signature);
  }
  for (const [mode, expected] of [['cancel', /分享已取消/], ['system', /系統分享未完成/], ['gesture', /未允許分享/]]) {
    await page.evaluate(mode => {shareMode = mode;}, mode);
    await share.click();
    assert.match(await status.textContent(), expected);
  }
  assert.equal(await page.evaluate(() => shareRecords.length), 0);
  await page.evaluate(() => {shareMode = 'success';});
  await page.locator('#lineShareNext').click();
  await share.click();
  await page.waitForFunction(() => shareRecords.length === 1);
  const record = await page.evaluate(() => shareRecords[0]);
  assert.match(record.name, /2330_20261126_2-2\.jpg$/);
  assert.deepEqual(record.signature, [255, 216, 255]);
  assert.deepEqual(record.keys, ['files']);
  assert.ok(record.size > 0);
  if (record.activation !== undefined) assert.ok(record.activation);
  assert.match(await status.textContent(), /已交由系統分享，請確認 LINE 傳送結果/);

  await page.evaluate(() => {
    const slow = document.createElement('canvas');
    slow.width = slow.height = 20;
    const encode = slow.toBlob.bind(slow);
    slow.toBlob = (callback, mime, ...options) => {
      if (mime === 'image/png') window.finishOldPng = () => encode(callback, mime, ...options);
      else encode(callback, mime, ...options);
    };
    window.oldPreview = showInfographicPreviewV3328(slow, '一般_2330_20261125.png', '舊報告');
  });
  assert.equal(await share.isDisabled(), true);
  assert.equal(await page.locator('#imageDownloadLink').getAttribute('href'), null);
  await openReport(page, {filename:'浮水印_2317_20261126_P02.png', color:'#bf2727', height:2778});
  await page.evaluate(async () => {finishOldPng(); if (await oldPreview) throw Error('Old PNG replaced new report');});
  await share.click();
  await page.waitForFunction(() => shareRecords.length === 2);
  const latest = await page.evaluate(() => shareRecords.at(-1));
  assert.match(latest.name, /浮水印_2317_20261126_P02\.jpg$/);
  assert.ok(latest.pixel[0] > 160 && latest.pixel[1] < 65 && latest.pixel[2] < 65);
  assert.equal(await page.locator('#imageDownloadLink').getAttribute('download'), '浮水印_2317_20261126_P02.png');

  await page.evaluate(() => {shareMode = 'pending';});
  await share.click();
  assert.ok(await share.isDisabled());
  await page.locator('.image-modal-close').click();
  assert.equal(await page.locator('#imagePreviewModal').isVisible(), false);
  await openReport(page, {filename:'大盤_TAIEX_20261126.png', height:2778});
  await page.evaluate(() => {finishShare();});
  await page.waitForFunction(() => !document.querySelector('#imageShareButton').disabled);
  assert.doesNotMatch(await status.textContent(), /已交由系統分享/);
  const failed=await page.evaluate(async () => {
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=20;
    const encode=canvas.toBlob.bind(canvas);
    canvas.toBlob=(done,mime,...options)=>mime==='image/jpeg'?done(null):encode(done,mime,...options);
    return showInfographicPreviewV3328(canvas,'png-fallback.png','編碼備援');
  });
  assert.equal(failed,true);
  assert.equal(await share.isDisabled(),false);
  assert.ok(await page.locator('#imageDownloadLink').getAttribute('href'));
  assert.equal(await page.locator('#lineShareSave').getAttribute('href'),null);
  await share.click();
  assert.match(await status.textContent(),/JPG 編碼失敗/);
  assert.equal(await page.evaluate(() => shareRecords.length),3);
}

async function main() {
  fs.mkdirSync(out, {recursive:true});
  const browser = webkitRun ? await webkit.launch() : await chromium.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args:['--no-sandbox']
  });
  const errors = [], results = [];
  try {
    const page = await browser.newPage({viewport:{width:428,height:926},isMobile:true,hasTouch:true});
    page.on('pageerror', error => errors.push(error.message));
    await installMocks(page);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://v926.test') return route.abort();
      const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const base = stage || root;
      const file = path.resolve(base, name);
      if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return route.fulfill({status:404});
      }
      return route.fulfill({path:file,contentType:mime[path.extname(file)]});
    });
    await page.goto('https://v926.test/');
    await openReport(page);
    for (const [width, height] of sizes) {
      await page.setViewportSize({width, height});
      for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({colorScheme});
        await assertFixedControls(page);
        const scroll = page.locator('.image-preview-wrap');
        const scrolled = await scroll.evaluate(element => {
          element.scrollTop = element.scrollHeight;
          return element.scrollTop;
        });
        assert.ok(scrolled > 0);
        await assertFixedControls(page);
        await scroll.evaluate(element => {element.scrollTop = 0;});
        results.push({width,height,colorScheme});
      }
    }
    await page.setViewportSize({width:428,height:926});
    await page.emulateMedia({colorScheme:'light'});
    await page.screenshot({path:path.join(out,'428x926.png')});
    await verifyShare(page);
    assert.deepEqual(errors, []);
    await page.goto('https://v926.test/market-outlook.html');
    await openReport(page, {standalone:true, height:2778});
    await assertFixedControls(page);
    await page.locator('#marketLifeClose').click();
    assert.equal(await page.locator('#imagePreviewModal').isVisible(), false);
    fs.writeFileSync(path.join(out,'results.json'), JSON.stringify({mode:stage?'pages build':'source',browser:webkitRun?'webkit':'chromium',results,errors,standalone:true}, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {console.error(error);process.exitCode=1;});
