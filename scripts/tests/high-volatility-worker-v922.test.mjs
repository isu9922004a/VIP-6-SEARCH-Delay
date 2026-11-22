import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Worker from '../../market-worker.mjs';

const date = '2026-11-20';
const compact = '20261120';
const url = 'https://example.test/?market=HIGH_VOLATILITY_INPUTS&date=' + date;
const source = 'https://example.test/exchange-receipt';
const twseMarginFields = ['代號', '名稱', '買進', '賣出', '現金償還', '前日餘額', '今日餘額', '次一營業日限額',
  '買進', '賣出', '現券償還', '前日餘額', '今日餘額', '次一營業日限額', '資券互抵', '註記'];

test('the added route leaves all existing Market Worker handlers byte-identical', () => {
  const legacy = readFileSync(new URL('../../market-worker.mjs', import.meta.url), 'utf8')
    .replace(/\n    if \(market === "HIGH_VOLATILITY_INPUTS"\) \{\n      return handleHighVolatilityInputs\(url, corsHeaders, env\);\n    \}\n/, '')
    .replace(/\nasync function handleHighVolatilityInputs\([\s\S]*?\n\}\n(?=\n\/\/ =)/, '');
  assert.equal(createHash('sha256').update(legacy).digest('hex'),
    '7811eccb157d76fc5a70df5016fff8154058849a343963924e65e519e3b4eb53');
});

test('Worker projects only official same-day volume, current balance and status fields', async t => {
  const feed = {
    MI_INDEX: { stat: 'OK', date: compact, tables: [
      { fields: ['證券代號', '證券名稱', '成交股數'], data: [['1101', '台泥', '40,001']] }
    ] },
    MI_MARGN: { stat: 'OK', date: compact, tables: [
      { fields: twseMarginFields, data: [
        ['1101', '台泥', '723', '3', '6', '89', '100', '600', '4', '7', '8', '29', '31', '300', '9', '']
      ] }
    ] },
    TWT85U: { stat: 'OK', date: compact, fields: ['證券代號', '證券名稱'], data: [['1213', '測試']] },
    tpex_daily_turnover: [{ Date: '1151120', SecuritiesCompanyCode: '1240', TradingShares: '39500', Capitalization: '100000' }],
    tpex_mainboard_margin_balance: [{ Date: '1151120', SecuritiesCompanyCode: '1240',
      MarginPurchaseBalance: '100', ShortSaleBalance: '35', ShortSaleBalanceBelongSecuritiesFinanceEnterprise: '842' }],
    tpex_cmode: [{ Date: '1151120', SecuritiesCompanyCode: '2067', AlteredTrading: 'Ｙ', ManagedStock: '', SuspensionOfTrading: '' }]
  };
  t.mock.method(globalThis, 'fetch', async address => Response.json(feed[new URL(address).pathname.split('/').at(-1)]));
  const env = {
    HIGH_VOLATILITY_OUTSTANDING_SOURCE: source,
    HIGH_VOLATILITY_OUTSTANDING_KV: { async get(key, format) {
      assert.equal(key, date);
      assert.equal(format, 'json');
      return { date, source, unit: 'shares', scope: 'OUTSTANDING_ORDINARY_SHARES', rows: [['TWSE', '1101', 100000]] };
    } }
  };
  const response = await Worker.fetch(new Request(url), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  const data = await response.json();
  assert.deepEqual(data.markets.TWSE.margin.rows, [['1101', '100', '31']]);
  assert.deepEqual(data.markets.TWSE.volume.rows, [['1101', '40,001']]);
  assert.deepEqual(data.markets.TWSE.status.rows, ['1213']);
  assert.deepEqual(data.markets.TPEX.margin.rows, [['1240', '100', '35']]);
  assert.deepEqual(data.markets.TPEX.volume.rows, [['1240', '39500']]);
  assert.deepEqual(data.markets.TPEX.status.rows, ['2067']);
  assert.deepEqual(data.outstanding.rows, [['TWSE', '1101', 100000]]);

  feed.tpex_mainboard_margin_balance[0].Date = '1151119';
  feed.MI_MARGN.tables[0].fields = [...twseMarginFields.slice(0, 12), '錯誤欄位'];
  env.HIGH_VOLATILITY_OUTSTANDING_KV.get = async () => ({
    date, source, unit: 'shares', scope: 'ISSUED_SHARES', rows: [['TPEX', '1240', 100000]]
  });
  const stale = await (await Worker.fetch(new Request(url), env)).json();
  assert.equal(stale.markets.TPEX.margin.date, null);
  assert.deepEqual(stale.markets.TPEX.margin.rows, []);
  assert.equal(stale.markets.TWSE.margin.date, null);
  assert.equal(stale.outstanding.date, null);
  assert.deepEqual(stale.outstanding.rows, []);
  const unconfigured = await (await Worker.fetch(new Request(url), {})).json();
  assert.match(unconfigured.outstanding.error, /尚未設定/);
  assert.equal((await Worker.fetch(new Request(url.replace(date, '2026-02-30')), env)).status, 400);
});

test('TPEx redirects fail closed without burning the full Worker subrequest budget', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (address, options) => {
    requests.push({ url: String(address), redirect: options?.redirect });
    if (String(address).startsWith('https://www.tpex.org.tw/')) {
      return new Response(null, {
        status: 302,
        headers: { Location: 'https://www.tpex.org.tw/errors' }
      });
    }
    return Response.json({ stat: 'UNAVAILABLE', date: compact });
  });
  const response = await Worker.fetch(new Request(url), {});
  assert.equal(response.status, 200);
  const result = await response.json();
  const tpexRequests = requests.filter(row => row.url.startsWith('https://www.tpex.org.tw/'));
  assert.equal(tpexRequests.length, 3, 'each of three TPEx feeds makes exactly one attempt');
  assert.ok(tpexRequests.every(row => row.redirect === 'manual'));
  for (const feed of Object.values(result.markets.TPEX)) {
    assert.equal(feed.date, null);
    assert.deepEqual(feed.rows, []);
    assert.match(feed.error, /TPEx 官方來源回傳 HTTP 302 重新導向/);
  }
  assert.match(result.outstanding.error, /尚未設定/);
});

test('opt-in official Pages snapshot verifies byte SHA and never requests TPEx from Cloudflare', async t => {
  const base = 'https://isu9922004a.github.io/VIP-6-SEARCH-Delay/data/high-volatility/tpex/';
  const codes = Array.from({ length: 505 }, (_, i) => String(1000 + i));
  const source = {
    volume: 'https://www.tpex.org.tw/openapi/v1/tpex_daily_turnover',
    margin: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_margin_balance',
    status: 'https://www.tpex.org.tw/openapi/v1/tpex_cmode'
  };
  const feeds = {
    volume: { source: source.volume, date, unit: 'shares', rows: codes.map(c => [c, 50000]) },
    margin: { source: source.margin, date, unit: 'lots', rows: codes.map(c => [c, 100, 35]) },
    status: { source: source.status, date, rows: ['1401'] }
  };
  for (const feed of Object.values(feeds)) Object.assign(feed, {
    rawResponseSha256: 'a'.repeat(64), sourceRecords: feed.rows.length,
    ordinaryRows: feed.rows.length, invalidNumbers: 0
  });
  const snapshot = {
    schema: 'V922_TPEX_OFFICIAL_INPUTS_V1', date,
    verification: 'OFFICIAL_DATE_FIELDS_COUNTS_AND_UNITS',
    markets: { TPEX: feeds }
  };
  const payload = JSON.stringify(snapshot) + '\n';
  const digest = createHash('sha256').update(payload).digest('hex');
  const manifest = {
    schema: 'V922_TPEX_OFFICIAL_MANIFEST_V1', date, file: date + '.json',
    verification: snapshot.verification, sha256: digest,
    completedMarketSnapshot: 'c'.repeat(64),
    officialCalendarSource: 'https://www.twse.com.tw/exchangeReport/FMTQIK',
    sources: Object.fromEntries(Object.entries(feeds).map(([key, feed]) =>
      [key, {url:feed.source, unit:feed.unit ?? null, sha256:feed.rawResponseSha256,
        records:feed.sourceRecords, ordinaryRows:feed.ordinaryRows}]))
  };
  const urls = [];
  t.mock.method(globalThis, 'fetch', async address => {
    urls.push(String(address));
    if (String(address) === base + 'manifest.json') return Response.json(manifest);
    if (String(address) === base + date + '.json') return new Response(payload);
    return Response.json({ stat: 'UNAVAILABLE', date: compact });
  });
  const env = { HIGH_VOLATILITY_TPEX_SNAPSHOT_BASE_URL: base };
  const response = await Worker.fetch(new Request(url), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.markets.TPEX.volume.date, date);
  assert.equal(result.markets.TPEX.volume.rows.length, 505);
  assert.equal(result.markets.TPEX.margin.rows.length, 505);
  assert.deepEqual(result.markets.TPEX.status.rows, ['1401']);
  assert.ok(urls.every(url => !url.startsWith('https://www.tpex.org.tw/')));
  manifest.sha256 = 'f'.repeat(64);
  const corrupted = await (await Worker.fetch(new Request(url), env)).json();
  for (const feed of Object.values(corrupted.markets.TPEX)) {
    assert.equal(feed.date, null);
    assert.deepEqual(feed.rows, []);
    assert.match(feed.error, /SHA-256/);
  }
});
