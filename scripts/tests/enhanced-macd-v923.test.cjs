'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../../enhanced-macd-v923.js');
const { sessions, stock } = require('../fixtures/enhanced-macd-v923.cjs');
const evaluate = row => C.evaluate(row, sessions);

test('EMA seeds with the period SMA and applies the specified smoothing factor', () => {
  assert.deepEqual(C.ema([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  const flat = C.macd(Array(100).fill(100));
  assert.equal(flat[32], null);
  assert.deepEqual(flat[33], { dif: 0, signal: 0, histogram: 0 });
  const result = evaluate(stock());
  const fast = 2 / 13;
  const slow = 2 / 27;
  const expectedDif = fast * (3 + fast) - slow * (3 + slow);
  const expectedSignal = 0.8 * 0.2 * (slow - fast) + 0.2 * expectedDif;
  assert.ok(Math.abs(result.macd.dif - expectedDif) < 1e-10);
  assert.ok(Math.abs(result.macd.signal - expectedSignal) < 1e-10);
  assert.equal(result.macd.histogram, result.macd.dif - result.macd.signal);
});

test('only crosses on the latest completed day, including prior equality', () => {
  const equal = { dif: 0, signal: 0 };
  const higher = { dif: 1, signal: 0 };
  assert.equal(C.crosses(equal, higher), true);
  assert.equal(C.crosses(higher, higher), false);
  assert.equal(C.crosses(equal, equal), false);
  assert.equal(evaluate(stock()).gates.cross, true);
  const earlier = stock();
  earlier.bars[98] = { ...earlier.bars[99], date: sessions.at(-2) };
  assert.equal(evaluate(earlier).gates.cross, false);
});

test('volume conversion and inclusive share bounds do not accept unidentified units', () => {
  assert.equal(C.shares('2,000', 'lots'), 2_000_000);
  assert.equal(C.shares('10,000,000', 'shares'), 10_000_000);
  for (const unit of ['NTD', 'thousands', undefined]) assert.equal(C.shares(2000, unit), null);
  for (const [volume, expected] of [[1_999_999, false], [2_000_000, true], [10_000_000, true], [10_000_001, false]]) {
    const row = stock();
    row.bars.at(-1).volume = volume;
    assert.equal(evaluate(row).gates.volume, expected);
  }
});

test('exact capital and dated official company, industry and product boundaries', () => {
  assert.equal(evaluate({ ...stock(), capital: 4_999_999_999 }).gates.capital, true);
  assert.equal(evaluate({ ...stock(), capital: 5_000_000_000 }).gates.capital, false);
  for (const extra of [{ capital: 0 }, { capital: null }, { companyDate: '' }, { companyDate: '2026-11-24' },
    { companyDate: '2026-11-21' }, { industry: '00' }, { product: 'UNKNOWN' }]) {
    assert.equal(evaluate({ ...stock(), ...extra }).status, 'DATA');
  }
  for (const industry of ['14', '17', '22']) assert.equal(evaluate({ ...stock(), industry }).status, 'EXCLUDED');
  assert.equal(evaluate({ ...stock(), product: 'OTHER' }).status, 'EXCLUDED');
  assert.equal(evaluate({ ...stock(), suspended: true }).status, 'NO_TRADE');
  for (const industry of ['01', '24', '31']) assert.equal(evaluate({ ...stock(), industry }).status, 'QUALIFIED');
});

test('three entry gates, previous-five volume equality, and MA20 window', () => {
  const row = stock();
  const pass = evaluate(row);
  assert.equal(pass.ma20, 100.15);
  assert.equal(pass.averageVolume, 2_000_000);
  assert.equal(pass.volumeRatio, 1.5);
  assert.deepEqual(pass.gates, { cross: true, volume: true, aboveMa20: true, strongerVolume: true, capital: true });
  assert.equal(pass.qualifiesB, true);
  row.bars.at(-1).volume = 2_000_000;
  const equalVolume = evaluate(row);
  assert.equal(equalVolume.gates.strongerVolume, false);
  assert.equal(equalVolume.qualifiesA, true);
  assert.equal(equalVolume.qualifiesB, false);
  assert.equal(equalVolume.status, 'QUALIFIED');
  row.bars.at(-1).volume++;
  assert.equal(evaluate(row).qualifiesB, true);

  const weak = stock();
  for (let index = 0; index < weak.bars.length; index++) {
    const close = index === 99 ? 58 : 100 - Math.max(0, Math.min(96, index) - 55);
    Object.assign(weak.bars[index], { close, open: close, high: close, low: close });
  }
  const below = evaluate(weak);
  assert.equal(below.gates.aboveMa20, false);
  assert.equal(below.qualifiesB, false);
  assert.equal(below.status, 'QUALIFIED');
});

test('history continuity and malformed current bars fail closed', () => {
  for (const mutate of [
    row => row.bars.shift(), row => { row.bars[51] = null; },
    row => { row.bars[91].date = row.bars[90].date; }, row => { row.bars[75].volume = 0; },
    row => { row.bars[99].completed = false; }, row => { row.bars[99].volume = null; }
  ]) {
    const row = stock();
    mutate(row);
    const result = C.scan([row, stock('1235')], sessions);
    assert.equal(result.complete, false);
    assert.equal(result.qualified.length, 1);
    assert.equal(result.top8.length, 0);
    assert.equal(result.incomplete.length, 1);
    assert.match(C.summary(result), /掃描未完成/);
    assert.doesNotMatch(C.summary(result), /0 檔/);
  }
  assert.equal(C.summary(C.scan([{ ...stock(), capital: 5_000_000_000 }], sessions)), '合格 0 檔');
  assert.equal(C.scan([stock()], sessions, ['來源失敗']).complete, false);
  assert.throws(() => C.scan([stock(), stock()], sessions), /重複代號/);
});

test('35/25/25/15 weights, scale invariance, and deterministic Top 8', () => {
  assert.deepEqual(C.quality({ close: 100, histogram: 0.4, previousHistogram: -0.4,
    gap: 3, slope: 3, volumeRatio: 1.6, riskCount: 0, closePosition: 1 }),
  { momentum: 100, trend: 100, volume: 100, breakout: 100, total: 100 });
  const weighted = C.quality({ close: 100, histogram: 0.2, previousHistogram: -0.2,
    gap: 3, slope: 0, volumeRatio: 3.2, riskCount: 3, closePosition: 0.6 });
  assert.deepEqual(weighted, { momentum: 50, trend: 70, volume: 0, breakout: 40, total: 41 });
  const unit = stock();
  const scaled = stock();
  for (const bar of scaled.bars) for (const key of ['open', 'high', 'low', 'close']) bar[key] *= 10;
  assert.deepEqual(evaluate(unit).score, evaluate(scaled).score);
  const rows = Array.from({ length: 10 }, (_, index) => stock(String(1009 - index)));
  assert.deepEqual(C.scan(rows, sessions).top8.map(row => row.code),
    Array.from({ length: 8 }, (_, index) => String(1000 + index)));
  const risky = stock();
  risky.bars.at(-1).high = 150;
  assert.ok(evaluate(risky).riskFlags.includes('長上影線'));
  assert.ok(evaluate(risky).score.total < evaluate(unit).score.total);
  assert.equal(evaluate(risky).qualifiesB, true);
});

test('entry point loads only the current sixth strategy', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.doesNotMatch(html, /<script src="[^"]*(?:structure-reversal|high-volatility)/);
  assert.match(html, /enhanced-macd-v923\.js\?v=V9\.23/);
  const release = require('../../version-v50.js');
  assert.equal(C.VERSION, release.sixthStrategyDataVersion);
  assert.equal(release.displayCode, 'V9.25');
});

test('verified older no-close days extend warm-up and never replace the prior exchange session', () => {
  const row = stock();
  const earlier = '2026-08-15';
  const days = [earlier, ...sessions];
  row.bars.unshift({ ...row.bars[0], date: earlier });
  row.bars[40] = null;
  assert.equal(C.evaluate(row, days).status, 'DATA');
  row.historyGaps = [{ date: days[40], volume: 0, type: 'OFFICIAL_NO_OHLC' }];
  assert.equal(C.evaluate(row, days).status, 'QUALIFIED');
  assert.equal(C.evaluate(row, days).historyBars, 100);
  row.bars[days.length - 2] = null;
  row.historyGaps.push({ date: days.at(-2), volume: 0, type: 'OFFICIAL_NO_OHLC' });
  assert.equal(C.evaluate(row, days).status, 'DATA');
});

test('recent listings must have a complete history since listing to use the shorter warm-up', () => {
  const row = stock();
  row.listingDate = sessions[47];
  row.bars.fill(null, 0, 47);
  assert.equal(evaluate(row).historyBars, 53);
  assert.equal(evaluate(row).status, 'QUALIFIED');
  row.bars[50] = null;
  assert.equal(evaluate(row).status, 'DATA');
  row.listingDate = sessions[51];
  assert.equal(evaluate(row).status, 'DATA');
});

test('five-day volume stays in exchange-date order and missing recent closes never certify MA20', () => {
  const row = stock();
  const earlier = '2026-08-15';
  const days = [earlier, ...sessions];
  row.bars.unshift({ ...row.bars[0], date: earlier });
  const gap = days.length - 5;
  row.bars[gap] = null;
  row.historyGaps = [{ date: days[gap], volume: 10_000_000, type: 'OFFICIAL_NO_OHLC' }];
  assert.equal(C.evaluate(row, days).gates.strongerVolume, false);
  assert.equal(C.evaluate(row, days).status, 'QUALIFIED');
  row.historyGaps[0].volume = 0;
  assert.equal(C.evaluate(row, days).status, 'QUALIFIED');
  row.historyGaps[0].volume = null;
  assert.equal(C.evaluate(row, days).status, 'QUALIFIED');
  assert.equal(C.evaluate(row, days).score.volume, 0);
  assert.equal(C.evaluate(row, days).qualifiesB, null);
});


test('comparison can calculate the crossover for a rejected stock without admitting it', () => {
  const aboveCapitalLimit = { ...stock(), capital: 5_000_000_000 };
  assert.equal(evaluate(aboveCapitalLimit).gates.cross, undefined);
  const audit = C.evaluate(aboveCapitalLimit, sessions, { inspectRejected: true });
  assert.equal(audit.gates.cross, true);
  assert.equal(audit.gates.capital, false);
  assert.equal(audit.status, 'REJECTED');
  assert.equal(C.scan([aboveCapitalLimit], sessions).qualified.length, 0);
});
