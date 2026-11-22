// V9.22 read-only TPEx official source probe and dated test snapshot.
// No Cloudflare writes, no GitHub branch commits, no production release.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const expected = '2026-11-20';
const outIndex = process.argv.indexOf('--out');
const outDir = outIndex < 0 ? null : process.argv[outIndex + 1];
if (outIndex >= 0 && !outDir) throw Error('missing --out directory');
const feeds = [
  ['volume', 'tpex_daily_turnover', ['Date', 'SecuritiesCompanyCode', 'TradingShares'], 'shares'],
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
    if (label === 'volume') {
      console.log('TPEX_OFFICIAL_TURNOVER_FIELDS ' +
        JSON.stringify(Object.fromEntries(Object.entries(body[0]).map(([k,v]) => [k, String(v).slice(0,90)]))));
    }
    if (label === 'volume') {
      const valid = body.filter(row => /^[1-9]\d{3}$/.test(String(row.SecuritiesCompanyCode).trim()));
      const checked = valid.map(row => {
        const shares=Number(String(row.TradingShares).replace(/,/g,'')),
              issued=Number(String(row.Capitalization).replace(/,/g,'')),
              reported=Number(String(row.TurnoverRatio).replace(/,/g,''));
        return { code:String(row.SecuritiesCompanyCode).trim(), shares, issued, reported,
          computed: issued>0 ? shares/issued*100 : null };
      });
      const missing=checked.filter(row=>!Number.isFinite(row.issued)||row.issued<=0||
        !Number.isFinite(row.reported)||!Number.isFinite(row.computed));
      const mismatched=checked.filter(row=>row.computed!==null &&
        Number.isFinite(row.reported) && Math.abs(row.computed-row.reported) > 0.011);
      const top=checked.filter(row=>row.reported>30).sort((a,b)=>b.reported-a.reported)
        .slice(0,10).map(row=>({code:row.code,officialTurnoverRatio:row.reported,computed:row.computed}));
      console.log('TPEX_OFFICIAL_TURNOVER_PROOF '+JSON.stringify({
        checked:checked.length,missing:missing.length,missingSamples:missing.slice(0,5),
        mismatched:mismatched.length,mismatchSamples:mismatched.slice(0,5),
        above30:checked.filter(row=>row.reported>30).length,top}));
    }
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
        if (value === null) ++invalidNumbers;
        tuples.push([code, value]);
      } else if (label === 'margin') {
        const margin = integerOrNull(row.MarginPurchaseBalance);
        const short = integerOrNull(row.ShortSaleBalance);
        if (margin === null || short === null) ++invalidNumbers;
        tuples.push([code, margin, short]);
      } else if ([row.AlteredTrading, row.ManagedStock, row.SuspensionOfTrading].some(flagged)) {
        tuples.push(code);
      }
    }
    if ((label === 'volume' || label === 'margin') && tuples.length < 500) {
      throw Error('insufficient ordinary stock coverage ' + tuples.length);
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
  console.log('TPEX_SOURCE_PROBE_PASS date=' + expected +
    ' from GitHub-hosted runner only; Cloudflare egress is NOT verified.');
  if (outDir) {
    const receipt = {
      schema: 'V922_TPEX_SOURCE_PROBE_V1', date: expected,
      asOf: new Date().toISOString(), verification: 'DATE_FIELDS_NUMBERS_ONLY',
      publisher: 'GitHub Actions test artifact, NOT production market feed',
      markets: { TPEX: responseFeeds }
    };
    const payload = JSON.stringify(receipt);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, expected + '.json'), payload + '\n');
    console.log('TPEX_SNAPSHOT_ARTIFACT_SHA256 ' + sha256(payload));
  }
}
