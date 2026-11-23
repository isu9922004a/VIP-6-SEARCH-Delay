'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const C = require('../../high-volatility-v922.js');
const { date, stocks, fixture } = require('../fixtures/high-volatility-v922.cjs');
const assess = ({ snapshot, inputs }, options) => C.scan(snapshot.rows, snapshot.meta, inputs, date, options);

test('both strict gates, all allowed industries, current safety exclusions and unit conversions', async () => {
  const scan = await assess(fixture());
  assert.deepEqual(scan.qualified.map(x => x.code), ['1101', '1201', '1240', '1301', '1401', '2002', '2330', '2601', '3030']);
  assert.equal(scan.top8.length, 8);
  assert.deepEqual(scan.top8, scan.qualified.slice(0, 8));
  assert.deepEqual(scan.qualified[0].shares, { marginShares: 100000, shortShares: 31000, tradedShares: 35000, turnoverBaseShares: 100000 });
  const status = code => scan.rows.find(x => x.code === code).status;
  for (const code of ['1305', '1307', '1402', '1403']) assert.equal(status(code), 'NOT_QUALIFIED', code);
  for (const code of ['1701', '2801', '2501', '0050', '9110', '1213', '2314']) assert.equal(status(code), 'EXCLUDED', code);
  for (const code of ['1503', '1504', '1506', '1507', '1513', '9991']) assert.equal(status(code), 'UNVERIFIED', code);
  assert.match(C.textReport(scan), /V9\.22[\s\S]*券資比 31%｜單日週轉率 35%[\s\S]*資料未驗證清單/);
});

test('threshold uses exact integer units even just one share above the cutoff', async () => {
  const stock = { ...stocks[0], volume: '3000000001', outstanding: '10000000000' };
  const scan = await assess(fixture([stock]));
  assert.equal(scan.qualified.length, 1);
  assert.equal(C.percent(scan.qualified[0].turnover), '略高於 30%');
});

test('only verified full scans can conclude zero, including zero short balance', async () => {
  const validZero = await assess(fixture([{ ...stocks[0], short: '0' }]));
  assert.equal(C.summary(validZero), '合格 0 檔');
  assert.equal(validZero.rows[0].shortRatio.value, 0);
  const unavailable = await assess(fixture([{ ...stocks[0], margin: '0' }]));
  assert.equal(unavailable.rows[0].shortRatio, null);
  assert.match(C.summary(unavailable), /合格檔數未確認/);
  assert.doesNotMatch(C.summary(unavailable), /合格 0 檔/);
});

test('missing, stale, duplicated or issued-share data fails closed, as does unknown trading status', async () => {
  for (const mutate of [
    data => { delete data.inputs.listedShares; },
    data => { data.inputs.listedShares.scope = 'OUTSTANDING_ORDINARY_SHARES'; },
    data => { data.inputs.listedShares.date = '2026-11-19'; },
    data => { data.inputs.listedShares.unit = 'lots'; },
    data => { data.inputs.listedShares.rows.push(data.inputs.listedShares.rows[0]); },
    data => { data.inputs.markets.TWSE.margin.date = '2026-11-19'; },
    data => { data.inputs.markets.TWSE.volume.unit = 'lots'; },
    data => { data.inputs.markets.TWSE.status.date = null; },
    data => { data.snapshot.meta.companySourcesReady.twse = false; }
  ]) {
    const data = fixture([stocks[0]]);
    mutate(data);
    const scan = await assess(data);
    assert.equal(scan.unverified.length, 1);
    assert.equal(scan.qualified.length, 0);
    assert.equal(scan.complete, false);
  }
});

test('stop retains completed verification and reports pending rows', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => ({ ...stocks[0], code: String(3000 + i) }));
  const controller = new AbortController();
  const scan = await assess(fixture(rows), {
    signal: controller.signal,
    onProgress: done => { if (done > 0) controller.abort(); }
  });
  assert.equal(scan.qualified.length, 100);
  assert.equal(scan.pending, 1);
  assert.equal(scan.stopped, true);
  assert.equal(scan.complete, false);
});

test('production entry loads only the replacement and uses the release version', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.doesNotMatch(html, /<script src="[^"]*structure-reversal/);
  assert.match(html, /high-volatility-v922\.js\?v=V9\.22/);
  assert.equal(C.VERSION, require('../../version-v50.js').displayCode);
});

test('official TPEx denominator and displayed rate are required, exact >30 cutoff remains', async()=>{
  const stock = { ...stocks.find(x=>x.code==='1240'),volume:'30001',outstanding:'100000' };
  const good = await assess(fixture([stock]));
  assert.equal(good.qualified.length,1);
  const wrong = fixture([stock]);
  wrong.inputs.markets.TPEX.volume.rows[0][3]=31;
  const rejected=await assess(wrong);
  assert.equal(rejected.qualified.length,0);
  assert.equal(rejected.unverified.length,1);
  const missing=fixture([stock]);
  missing.inputs.markets.TPEX.volume.rows[0]=['1240','30001'];
  const blocked=await assess(missing);
  assert.equal(blocked.qualified.length,0);
  assert.equal(blocked.unverified.length,1);
});
