import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTwseStockMonth, readOfficial, withinCollectionWindow } from '../collect-enhanced-macd-v923.mjs';
import { outcomes } from '../backtest-enhanced-macd-v923.mjs';
import Core from '../../enhanced-macd-v923.js';

test('TPEx redirects fail immediately and a valid response records a source digest', async () => {
  const tpex = 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O';
  let calls = 0;
  await assert.rejects(readOfficial(tpex, async (url, options) => {
    calls++;
    assert.equal(url, tpex);
    assert.equal(options.redirect, 'manual');
    return new Response('', { status: 302, headers: { location: tpex } });
  }), /HTTP 302/);
  assert.equal(calls, 1);
  const { receipt, rows } = await readOfficial(tpex, async () => new Response('[1]'));
  assert.deepEqual(rows, [1]);
  assert.equal(receipt.source, tpex);
  assert.match(receipt.sha256, /^[a-f\d]{64}$/);
  assert.ok(Number.isFinite(Date.parse(receipt.retrievedAt)));
});

test('backtest uses next session open and keeps missing prices and costs visible', () => {
  const signal = { close: 90, date: '2026-11-23' };
  const bars = [24, 25, 26, 27, 30].map((day, i) => ({
    date: '2026-11-' + day, open: 100, high: 115, low: 95 - i, close: 102 + i, volume: 3_000_000
  }));
  const found = outcomes(signal, bars);
  assert.ok(Math.abs(found[1].gross - 2) < 1e-9);
  assert.ok(Math.abs(found[3].gross - 4) < 1e-9);
  assert.ok(Math.abs(found[5].adverse + 9) < 1e-9);
  assert.ok(found[1].signalCloseReturn > found[1].gross);
  assert.ok(found[5].net[2] < found[5].net[1] && found[5].net[1] < found[5].net[0] && found[5].net[0] < found[5].gross);
  assert.equal(outcomes(signal, [bars[0], null, ...bars.slice(2)])[3], null);
  assert.deepEqual(outcomes(signal, []), { 1: null, 3: null, 5: null });
  assert.equal(Core.validBar(null, undefined), false);
});

test('TWSE stock month retains explicit zero volume and verifies identity and calendar', () => {
  const data = {
    stat: 'OK', date: '20260701', title: '115年07月 2254 巨鎧精密-創 各日成交資訊',
    fields: ['日期', '成交股數', '開盤價', '最高價', '最低價', '收盤價'],
    data: [
      ['115/07/01', '3,000', '59.60', '59.60', '59.60', '59.60'],
      ['115/07/21', '0', '--', '--', '--', '--']
    ]
  };
  const date = '2026-07-21';
  const parsed = parseTwseStockMonth(data, '2254', date);
  assert.equal(parsed.get(date).成交股數, '0');
  assert.equal(parsed.get(date).收盤價, '--');
  assert.equal(parsed.has('2026-07-22'), false);
  assert.throws(() => parseTwseStockMonth(data, '2330', date), /代號/);
  assert.throws(() => parseTwseStockMonth(data, '2254', '2026-08-18'), /月份/);
  assert.throws(() => parseTwseStockMonth({ ...data, data: [data.data[1], data.data[1]] }, '2254', date), /重複/);
});


test('a verified session may finish collection until the next Taipei market open', () => {
  const date = '2026-11-23';
  for (const [time, expected] of [
    ['2026-11-23T09:34:59Z', false],
    ['2026-11-23T09:35:00Z', true],
    ['2026-11-23T16:00:00Z', true],
    ['2026-11-24T00:59:59Z', true],
    ['2026-11-24T01:00:00Z', false],
    ['2026-11-24T12:00:00Z', false]
  ]) assert.equal(withinCollectionWindow(date, new Date(time)), expected, time);
});

test('retries non-JSON and a bounded rate limit while retaining response evidence', async () => {
  const source = 'https://www.twse.com.tw/exchangeReport/STOCK_DAY';
  const responses = [
    new Response('<html>Temporary error</html>', { headers: { 'content-type': 'text/html' } }),
    new Response(null, { status: 429, headers: { 'retry-after': '1' } }),
    new Response('{"stat":"OK"}', { headers: { 'content-type': 'application/json' } })
  ];
  const { rows, receipt } = await readOfficial(source, async () => responses.shift());
  assert.equal(rows.stat, 'OK');
  assert.equal(responses.length, 0);
  assert.deepEqual(receipt.attempts.map(attempt => attempt.status), [200, 429]);
  assert.equal(receipt.attempts[0].contentType, 'text/html');
  assert.match(receipt.attempts[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(receipt.attempts.every(attempt => attempt.source === source && Date.parse(attempt.retrievedAt)));
  await assert.rejects(readOfficial(source, async () =>
    new Response(null, { status: 429, headers: { 'retry-after': '3600' } })), /HTTP 429/);
});

test('a persistent network timeout fails closed after three attempts', async () => {
  let attempts = 0;
  await assert.rejects(readOfficial('https://www.twse.com.tw/', async (_url, { signal }) => {
    assert.ok(signal instanceof AbortSignal);
    attempts++;
    throw new DOMException('request timed out', 'TimeoutError');
  }), /request timed out/);
  assert.equal(attempts, 3);
});
