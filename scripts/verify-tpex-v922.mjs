// Offline integrity gate for V9.22's official TPEx date-bound source receipt.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sha256 = payload => createHash('sha256').update(payload).digest('hex');
export const ENDPOINTS = Object.freeze({
  volume: 'https://www.tpex.org.tw/openapi/v1/tpex_daily_turnover',
  margin: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_margin_balance',
  status: 'https://www.tpex.org.tw/openapi/v1/tpex_cmode'
});
export function verifyV922Tpex({ manifest, payload, market, calendar }) {
  assert.equal(manifest?.schema, 'V922_TPEX_OFFICIAL_MANIFEST_V2');
  assert.equal(manifest?.date, market?.tradeDateIso, 'market session mismatch');
  assert.equal(calendar?.verified, true, 'calendar unverified');
  assert.equal(calendar?.dates?.at(-1), manifest.date, 'calendar session mismatch');
  assert.match(manifest.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(manifest.file, manifest.date + '.json');
  assert.equal(manifest.completedMarketSnapshot, market.contentSha256);
  assert.equal(manifest.officialCalendarSource, calendar.source);
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(sha256(payload), manifest.sha256, 'snapshot bytes are tampered or truncated');
  const snapshot = JSON.parse(payload);
  assert.equal(snapshot.schema, 'V922_TPEX_OFFICIAL_INPUTS_V2');
  assert.equal(snapshot.date, manifest.date);
  assert.equal(snapshot.verification, 'OFFICIAL_DATE_FIELDS_COUNTS_AND_UNITS_AND_ISSUED_TURNOVER');
  assert.equal(manifest.verification, snapshot.verification);
  const feeds = snapshot.markets?.TPEX;
  assert.deepEqual(Object.keys(feeds ?? {}).sort(), Object.keys(ENDPOINTS).sort());
  for (const [key, source] of Object.entries(ENDPOINTS)) {
    const f = feeds[key], meta = manifest.sources?.[key];
    assert.equal(f?.date, manifest.date);
    assert.equal(f?.source, source);
    assert.equal(meta?.url, source);
    assert.match(f.rawResponseSha256, /^[a-f0-9]{64}$/);
    assert.equal(meta.sha256, f.rawResponseSha256);
    assert.equal(f.invalidNumbers, 0, key + ' has missing/invalid numeric data');
    assert.equal(f.unit ?? null, key === 'volume' ? 'shares' : key === 'margin' ? 'lots' : null);
    assert.equal(meta.unit, f.unit ?? null);
    assert.ok(Array.isArray(f.rows), key + ' missing rows');
    assert.equal(meta.ordinaryRows, f.rows.length);
    assert.equal(f.ordinaryRows, f.rows.length);
    assert.equal(meta.records, f.sourceRecords);
    assert.ok(Number.isInteger(f.sourceRecords) && f.sourceRecords >= f.rows.length);
    if (key !== 'status') assert.ok(f.rows.length >= 500, key + ' incomplete market coverage');
    const seen = new Set();
    for (const row of f.rows) {
      const code = key === 'status' ? row : row?.[0];
      assert.match(String(code), /^[1-9]\d{3}$/, key + ' invalid ordinary stock code');
      assert.ok(!seen.has(code), key + ' duplicate code');
      seen.add(code);
      if (key !== 'status') {
        assert.equal(row.length, key === 'volume' ? 4 : 3, key + ' wrong tuple width');
        for (const count of row.slice(1, key === 'volume' ? 3 : undefined)) {
          assert.ok(Number.isSafeInteger(count) && count >= 0, key + ' invalid count');
        }
        if (key === 'volume') {
          assert.ok(row[2] > 0 && Number.isFinite(row[3]) && row[3] >= 0,
            'official issued shares or reported turnover invalid');
          assert.ok(Math.abs(row[1] / row[2] * 100 - row[3]) <= 0.011,
            'reported official turnover differs from exact share ratio');
        }
      }
    }
  }
  return { date: snapshot.date, volume: feeds.volume.rows.length,
    margin: feeds.margin.rows.length, flagged: feeds.status.rows.length,
    sha256: manifest.sha256 };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync('data/high-volatility/tpex/manifest.json','utf8'));
  const payload = readFileSync('data/high-volatility/tpex/' + manifest.file,'utf8');
  const market = JSON.parse(readFileSync('data/market/latest.json','utf8'));
  const calendar = JSON.parse(readFileSync('data/market/research-calendar.json','utf8'));
  console.log('V922_TPEX_SOURCE_VERIFY_PASS', JSON.stringify(verifyV922Tpex({manifest,payload,market,calendar})));
}
