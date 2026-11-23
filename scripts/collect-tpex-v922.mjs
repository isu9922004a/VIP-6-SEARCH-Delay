// V9.22 authenticated-public-feed collector. Input is TWSE verified completed-session calendar.
// Never publish if TPEx's three source bodies, dates, units or coverage fail.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const market = JSON.parse(await (await import('node:fs/promises')).readFile('data/market/latest.json', 'utf8'));
const calendar = JSON.parse(await (await import('node:fs/promises')).readFile('data/market/research-calendar.json','utf8'));
const expected = market.tradeDateIso;
if (!/^\d{4}-\d{2}-\d{2}$/.test(expected || '') || calendar.verified !== true ||
    !calendar.dates.includes(expected) || expected !== calendar.dates.at(-1)) {
  throw Error('Official completed-session snapshot and verified calendar are not aligned');
}
const nowTaipei = new Date(Date.now() + 8 * 3600000).toISOString();
if (expected > nowTaipei.slice(0, 10)) throw Error('Future trading date is forbidden');
if (expected < nowTaipei.slice(0, 10) && calendar.end !== expected) {
  throw Error('Latest completed session not verifiable');
}
const outIndex = process.argv.indexOf('--out');
const outDir = outIndex < 0 ? 'data/high-volatility/tpex' : process.argv[outIndex + 1];
if (!outDir) throw Error('missing --out directory');
const feeds = [
  ['volume', 'tpex_daily_turnover', ['Date', 'SecuritiesCompanyCode', 'TradingShares', 'Capitalization', 'TurnoverRatio'], 'shares'],
  ['margin', 'tpex_mainboard_margin_balance', ['Date', 'SecuritiesCompanyCode', 'MarginPurchaseBalance', 'ShortSaleBalance'], 'lots'],
  ['status', 'tpex_cmode', ['Date', 'SecuritiesCompanyCode', 'AlteredTrading', 'ManagedStock', 'SuspensionOfTrading'], null]
];
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
function dateKey(raw) {
  const numeric = String(raw ?? '').replace(/\D/g, '');
  if (numeric.length === 7) return String(Number(numeric.slice(0, 3)) + 1911) + numeric.slice(3);
  return numeric.length === 8 ? numeric : null;
}
function integerOrNull(value) {
  const text = String(value ?? '').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;
  const val = Number(text.replace(/,/g, ''));
  return Number.isSafeInteger(val) && val >= 0 ? val : null;
}
const codeOf = row => String(row.SecuritiesCompanyCode ?? '').trim();
const flagged = value => /^(Y|YES|TRUE|1|是)$/i.test(String(value ?? '').normalize('NFKC').trim());
const responseFeeds = {};
let failures = 0;

for (const [label, name, keys, unit] of feeds) {
  const source = 'https://www.tpex.org.tw/openapi/v1/' + name;
  try {
    const response = await fetch(source, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      throw Error('HTTP ' + response.status + ' redirect to ' +
        (location ? new URL(location, source).hostname : 'missing Location'));
    }
    if (!response.ok) throw Error('HTTP ' + response.status);
    const text = await response.text();
    const body = JSON.parse(text);
    if (!Array.isArray(body) || !body.length) throw Error('empty or invalid JSON array');
    const dates = [...new Set(body.map(row => dateKey(row.Date)))];
    const fieldsValid = body.every(row => row && keys.every(key => Object.hasOwn(row, key)));
    if (!fieldsValid || dates.length !== 1 || dates[0] !== expected.replace(/-/g, '')) {
      throw Error('date/fields mismatch: dates=' + dates.join(',') + ', fields=' + fieldsValid);
    }

    const tuples = [], seen = new Set();
    let invalidNumbers = 0;
    for (const row of body) {
      const code = codeOf(row);
      if (!/^[1-9]\d{3}$/.test(code)) continue;
      if (seen.has(code)) throw Error('duplicate ordinary code ' + code);
      seen.add(code);
      if (label === 'volume') {
        const value = integerOrNull(row.TradingShares);
        const issued = integerOrNull(row.Capitalization);
        const percent = Number(String(row.TurnoverRatio ?? '').replace(/,/g, ''));
        const computed = issued > 0 ? value / issued * 100 : NaN;
        // Official ratio is displayed to 2 decimals, with minor rounding/truncation variance.
        if (value === null || !issued || !Number.isFinite(percent) ||
            Math.abs(computed - percent) > 0.011) ++invalidNumbers;
        tuples.push([code, value, issued, percent]);
      } else if (label === 'margin') {
        const margin = integerOrNull(row.MarginPurchaseBalance);
        const short = integerOrNull(row.ShortSaleBalance);
        if (margin === null || short === null) ++invalidNumbers;
        tuples.push([code, margin, short]);
      } else if ([row.AlteredTrading, row.ManagedStock, row.SuspensionOfTrading].some(flagged)) {
        tuples.push(code);
      }
    }
    if (invalidNumbers || ((label === 'volume' || label === 'margin') && tuples.length < 500)) {
      throw Error('unverified official feed: coverage ' + tuples.length + ', invalidNumbers ' + invalidNumbers);
    }
    tuples.sort((a, b) => String(Array.isArray(a) ? a[0] : a)
      .localeCompare(String(Array.isArray(b) ? b[0] : b)));
    responseFeeds[label] = {
      source, date: expected, rows: tuples,
      ...(unit ? { unit } : {}),
      rawResponseSha256: sha256(text),
      sourceRecords: body.length, ordinaryRows: tuples.length, invalidNumbers
    };
    console.log(JSON.stringify({ feed: label, status: response.status, records: body.length,
      ordinaryRows: tuples.length, dates, expected, fieldsValid: true, invalidNumbers, valid: true }));
  } catch (error) {
    ++failures;
    console.error(JSON.stringify({ feed: label, source, failure: String(error.message) }));
  }
}
if (failures) {
  console.error('TPEX_SOURCE_PROBE_FAILED ' + failures + '/' + feeds.length +
    '. Do not publish incomplete market data.');
  process.exitCode = 1;
} else {
  console.log('TPEX_SOURCE_COLLECT_PASS date=' + expected +
    ' from GitHub runner; Cloudflare egress is NOT verified.');
  if (outDir) {
    const receipt = {
      schema: 'V922_TPEX_OFFICIAL_INPUTS_V2',
      date: expected, verification: 'OFFICIAL_DATE_FIELDS_COUNTS_AND_UNITS_AND_ISSUED_TURNOVER',
      publisher: 'GitHub Actions verified TPEx origin collector',
      markets: { TPEX: responseFeeds }
    };
    const payload = JSON.stringify(receipt) + '\n';
    const digest = sha256(payload);
    const manifest = {
      schema: 'V922_TPEX_OFFICIAL_MANIFEST_V2', date: expected,
      file: expected + '.json', sha256: digest,
      verification: receipt.verification,
      sources: Object.fromEntries(Object.entries(responseFeeds).map(([key, feed]) =>
        [key, { url: feed.source, sha256: feed.rawResponseSha256,
          records: feed.sourceRecords, ordinaryRows: feed.ordinaryRows, unit: feed.unit ?? null }])),
      completedMarketSnapshot: market.contentSha256,
      officialCalendarSource: calendar.source
    };
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, expected + '.json'), payload);
    await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest) + '\n');
    console.log('TPEX_SNAPSHOT_ARTIFACT_SHA256 ' + digest);
  }
}
