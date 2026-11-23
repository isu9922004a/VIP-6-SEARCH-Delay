'use strict';

const Core = require('../../enhanced-macd-v923.js');

const sessions = Array.from({ length: 100 }, (_, index) =>
  new Date(Date.UTC(2026, 10, 23 - 99 + index)).toISOString().slice(0, 10));
const date = sessions.at(-1);
const stock = (code = '1234') => ({
  code, name: '測試普通股', market: 'TWSE', product: 'COMMON', industry: '24',
  companyDate: date, capital: 2_400_000_000,
  bars: sessions.map((day, index) => {
    const close = index === 99 ? 104 : index === 98 ? 99 : 100;
    return { date: day, open: close - 0.25, high: close + 0.5, low: close - 0.5, close,
      volume: index === 99 ? 3_000_000 : 2_000_000 };
  })
});

function replay() {
  const stocks = Array.from({ length: 1000 }, (_, index) => {
    const row = stock(String(1200 + index));
    if (index >= 9) row.capital = 5_000_000_000;
    return row;
  });
  const result = Core.scan(stocks, sessions);
  const snapshot = {
    type: 'MARKET_SCAN_SNAPSHOT', mode: 'ALL_STOCKS', rows: stocks.map(({ code, market }) => ({ code, market })),
    meta: { total: stocks.length, targetTradeDate: date, completedTradeDate: date, expectedTradeDate: date,
      twseQuoteDate: date, tpexQuoteDate: date, marketCoverageReady: true, industryCoverageReady: true,
      snapshotTimelinessReady: true, snapshotContentSha256: 'synthetic' }
  };
  const artifact = { schema: 'ENHANCED_MACD_SCAN_V2', version: Core.VERSION, date, sessions, snapshotHash: 'synthetic',
    priceBasis: 'UNADJUSTED_OFFICIAL_OHLC', volumeUnit: 'shares', capitalUnit: 'NTD',
    historySources: sessions.flatMap(day => ['TWSE', 'TPEX'].map(market => ({ market, date: day }))),
    sources: ['TWSE', 'TPEX'].flatMap(market => ['quotes', 'companies', 'status'].map(dataset => ({
      market, dataset, date, source: 'https://www.twse.com.tw/'
    }))), result: { ...result, rows: undefined } };
  return { snapshot, artifact };
}
module.exports = { sessions, date, stock, replay };
