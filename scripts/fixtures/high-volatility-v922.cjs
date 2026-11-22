'use strict';

const date = '2026-11-20';
const stocks = [
  { code: '1101', name: '水泥測試', industryCode: '01' },
  { code: '1201', name: '食品測試', industryCode: '02' },
  { code: '1301', name: '塑膠測試', industryCode: '03' },
  { code: '1401', name: '紡織測試', industryCode: '04' },
  { code: '2002', name: '鋼鐵測試', industryCode: '10' },
  { code: '2601', name: '航運測試', industryCode: '15' },
  { code: '2330', name: '半導體測試', industryCode: '24' },
  { code: '3030', name: '電子測試', industryCode: '28' },
  { code: '1240', name: '其他傳產測試', industryCode: '33', market: 'TPEX' },
  { code: '1305', name: '券資比等於門檻', industryCode: '03', short: '30' },
  { code: '1402', name: '週轉率等於門檻', industryCode: '04', volume: '30,000' },
  { code: '1307', name: '低券資比測試', industryCode: '03', short: '29' },
  { code: '1403', name: '低週轉率測試', industryCode: '04', volume: '29,999' },
  { code: '1701', name: '生技測試', industryCode: '22' },
  { code: '2801', name: '金融測試', industryCode: '17' },
  { code: '2501', name: '營建測試', industryCode: '14' },
  { code: '0050', name: 'ETF測試', industryCode: '01', securityType: 'ETF' },
  { code: '9110', name: '存託憑證測試', industryCode: '01' },
  { code: '1213', name: '變更交易測試', industryCode: '02' },
  { code: '2314', name: '停止交易測試', industryCode: '02', SuspensionOfTrading: 'Ｙ' },
  { code: '1503', name: '融資為零測試', industryCode: '05', margin: '0' },
  { code: '1504', name: '融資缺值測試', industryCode: '05', margin: '' },
  { code: '1506', name: '融券缺值測試', industryCode: '05', short: '--' },
  { code: '1507', name: '缺分母測試', industryCode: '05', outstanding: '' },
  { code: '1513', name: '過期行情測試', industryCode: '05', quoteDate: '2026-11-19' },
  { code: '9991', name: '未分類商品', industryCode: '00' }
].map(stock => ({ market: 'TWSE', quoteDate: date, volume: '35,000', margin: '100', short: '31', outstanding: '100,000', ...stock }));

function fixture(rows = stocks) {
  const meta = {
    targetTradeDate: date, completedTradeDate: date, expectedTradeDate: date, twseQuoteDate: date,
    tpexQuoteDate: date, total: rows.length, ordinaryValidTotal: rows.length, marketCoverageReady: true,
    industryCoverageReady: true, snapshotTimelinessReady: true, companySourcesReady: { twse: true, tpex: true }
  };
  const feed = (name, data, unit) => ({ date, source: 'https://example.test/' + name, rows: data, unit });
  const markets = Object.fromEntries(['TWSE', 'TPEX'].map(board => {
    const members = rows.filter(row => row.market === board);
    return [board, {
      volume: feed(board + '/volume', members.map(row => {
        if (board === 'TWSE') return [row.code, row.volume];
        const traded = Number(String(row.volume).replace(/,/g, ''));
        const issued = Number(String(row.outstanding).replace(/,/g, ''));
        return [row.code, row.volume, row.outstanding,
          issued > 0 && Number.isFinite(traded) ? traded / issued * 100 : null];
      }), 'shares'),
      margin: feed(board + '/margin', members.map(row => [row.code, row.margin, row.short]), 'lots'),
      status: feed(board + '/status', board === 'TWSE' ? ['1213'] : [])
    }];
  }));
  const listedShares = {
    ...feed('listed', rows.filter(row => row.market === 'TWSE')
      .map(row => [row.code, row.outstanding]), 'shares'),
    scope: 'OFFICIAL_TWSE_LISTED_SHARES'
  };
  return {
    snapshot: { type: 'MARKET_SCAN_SNAPSHOT', mode: 'ALL_STOCKS', rows, meta },
    inputs: { type: 'HIGH_VOLATILITY_INPUTS', date, markets, listedShares }
  };
}

module.exports = { date, stocks, fixture };
