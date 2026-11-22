// Read-only, non-production egress probe for the official TPEx inputs used by V9.22.
// Does not upload data or touch the Cloudflare Worker.
const expected = '2026-11-20';
const feeds = [
  ['volume', 'tpex_daily_turnover', ['Date', 'SecuritiesCompanyCode', 'TradingShares']],
  ['margin', 'tpex_mainboard_margin_balance', ['Date', 'SecuritiesCompanyCode', 'MarginPurchaseBalance', 'ShortSaleBalance']],
  ['status', 'tpex_cmode', ['Date', 'SecuritiesCompanyCode', 'AlteredTrading', 'ManagedStock', 'SuspensionOfTrading']]
];
function dateKey(raw) {
  const numeric = String(raw ?? '').replace(/\D/g, '');
  if (numeric.length === 7) return String(Number(numeric.slice(0, 3)) + 1911) + numeric.slice(3);
  return numeric.length === 8 ? numeric : null;
}
let failures = 0;
for (const [label, name, keys] of feeds) {
  const source = 'https://www.tpex.org.tw/openapi/v1/' + name;
  try {
    const response = await fetch(source, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      throw new Error('HTTP ' + response.status + ' redirect to ' +
        (location ? new URL(location, source).hostname : 'missing Location'));
    }
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.json();
    if (!Array.isArray(body) || !body.length) throw new Error('empty or invalid JSON array');
    const dates = [...new Set(body.map(row => dateKey(row.Date)))];
    const fieldsValid = body.every(row => keys.every(key => Object.hasOwn(row, key)));
    const valid = dates.length === 1 && dates[0] === expected.replace(/-/g, '') && fieldsValid;
    console.log(JSON.stringify({ feed: label, status: response.status, records: body.length,
      dates, expected, fieldsValid, valid }));
    if (!valid) ++failures;
  } catch (error) {
    ++failures;
    console.error(JSON.stringify({ feed: label, source, failure: String(error.message) }));
  }
}
if (failures) {
  console.error('TPEX_SOURCE_PROBE_FAILED ' + failures + '/' + feeds.length +
    '. Do not use this as verified market data.');
  process.exitCode = 1;
} else {
  console.log('TPEX_SOURCE_PROBE_PASS date=' + expected +
    ' from GitHub-hosted runner only; Cloudflare egress is NOT verified.');
}
