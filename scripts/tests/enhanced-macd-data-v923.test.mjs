import test from 'node:test';
import assert from 'node:assert/strict';
import { readOfficial } from '../collect-enhanced-macd-v923.mjs';
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
