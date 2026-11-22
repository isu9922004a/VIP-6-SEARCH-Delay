(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShitouHighVolatility = api;
})(globalThis, function () {
  'use strict';

  const TITLE = '⑥ 高波動超夯選股';
  const VERSION = 'V9.22';
  const EXCLUDED_INDUSTRIES = { '14': '建材營造', '17': '金融保險', '22': '生技醫療' };
  const MARKET_NAMES = { TWSE: '上市', TPEX: '上櫃' };
  const STATUS = { QUALIFIED: '已驗證｜合格', NOT_QUALIFIED: '已驗證｜未達門檻', UNVERIFIED: '資料未驗證', EXCLUDED: '排除' };
  const SHORT_SOURCE = { TWSE: 'TWSE MI_MARGN', TPEX: 'TPEx 上櫃融資融券餘額' };
  const VOLUME_SOURCE = { TWSE: 'TWSE 每日收盤行情', TPEX: 'TPEx 個股週轉率排行總成交股數' };

  function count(value, unit) {
    const raw = String(value ?? '').trim();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)) return null;
    const shares = Number(raw.replace(/,/g, '')) * (unit === 'lots' ? 1000 : 1);
    return Number.isSafeInteger(shares) ? shares : null;
  }

  function keyed(rows, getKey = row => row[0]) {
    const result = new Map();
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const key = getKey(row);
      result.set(key, result.has(key) ? null : row);
    }
    return result;
  }

  function feedReady(feed, date) {
    return feed?.date === date && !feed.error && /^https:\/\//.test(feed.source || '') && Array.isArray(feed.rows);
  }

  function prepare(inputs, date) {
    if (inputs?.type !== 'HIGH_VOLATILITY_INPUTS' || inputs.date !== date) {
      throw Error('第六套官方資料回應與最近完成交易日不一致');
    }
    const markets = {};
    for (const market of Object.keys(MARKET_NAMES)) {
      const { volume, margin, status } = inputs.markets?.[market] || {};
      markets[market] = {
        volume: feedReady(volume, date) && volume.unit === 'shares' ? keyed(volume.rows) : null,
        margin: feedReady(margin, date) && margin.unit === 'lots' ? keyed(margin.rows) : null,
        excluded: feedReady(status, date) ? new Set(status.rows) : null
      };
    }
    const outstanding = inputs.outstanding;
    const outstandingReady = feedReady(outstanding, date) &&
      outstanding.scope === 'OUTSTANDING_ORDINARY_SHARES' && outstanding.unit === 'shares';
    return {
      markets,
      outstanding: outstandingReady ? keyed(outstanding.rows, row => row[0] + ':' + row[1]) : null,
      sources: [
        ...Object.keys(MARKET_NAMES).flatMap(market => [
          [SHORT_SOURCE[market], inputs.markets?.[market]?.margin],
          [VOLUME_SOURCE[market], inputs.markets?.[market]?.volume],
          [MARKET_NAMES[market] + '交易狀態', inputs.markets?.[market]?.status]
        ]),
        ['流通在外普通股數', outstanding]
      ].map(([label, feed]) => ({ label, source: feed?.source, date: feed?.date, error: feed?.error }))
    };
  }

  function exceedsThirty(numerator, denominator) {
    return BigInt(numerator) * 10n > BigInt(denominator) * 3n;
  }

  function ratio(numerator, denominator) {
    if (numerator === null || !(denominator > 0)) return null;
    return { value: numerator / denominator * 100, exceeds: exceedsThirty(numerator, denominator) };
  }

  function assess(stock, meta, data, date) {
    const { code, quoteDate } = stock;
    const market = String(stock.market || '').toUpperCase();
    const name = String(stock.name || code).normalize('NFKC');
    const industry = String(stock.industryCode || '').padStart(2, '0');
    const kind = String(stock.securityType || stock.productType || stock.instrumentType || '').normalize('NFKC').toUpperCase();
    const common = /^(COMMON_STOCK|COMMON STOCK|COMMON|EQUITY|STOCK|ORDINARY|普通股|股票)$/.test(kind);
    const sources = data.markets[market];
    const row = { code, name, market, date, shortRatio: null, turnover: null, reason: '' };
    const exit = (status, reason) => ({ ...row, status, reason });

    if (!/^[1-9]\d{3}$/.test(code) || /^91\d{2}$/.test(code) || (kind && !common) ||
        stock.isSpecialProduct === true || stock.isPreferredStock === true ||
        /ETF|ETN|REIT|權證|特別股|受益證券|受益憑證|基金|存託憑證|存托憑證|[-－\s](?:TDR|DR)\*?$/i.test(name)) {
      return exit('EXCLUDED', 'ETF／特殊商品／存託憑證');
    }
    if (stock.isKY === true || stock.ky === true || /[-\s]KY\*?$/i.test(name) ||
        /^(KY|CYM|CAYMAN|開曼群島)$/i.test(stock.incorporationCountry || stock.jurisdiction || '')) {
      return exit('EXCLUDED', '既有 KY 商品資格排除');
    }
    if (EXCLUDED_INDUSTRIES[industry]) return exit('EXCLUDED', EXCLUDED_INDUSTRIES[industry]);
    if (sources?.excluded?.has(code) ||
        [stock.fullDelivery, stock.isFullDelivery, stock.alteredTrading, stock.AlteredTrading, stock.ManagedStock, stock.SuspensionOfTrading]
          .some(value => /^(Y|YES|TRUE|1|是)$/i.test(String(value ?? '').normalize('NFKC').trim())) ||
        /全額交割|變更交易|停止交易/.test(stock.tradingStatus || stock.tradingMethod || '')) {
      return exit('EXCLUDED', '全額交割／變更或停止交易');
    }

    const board = market === 'TWSE' ? 'twse' : 'tpex';
    const officialCompany = meta.companySourcesReady?.[board] === true &&
      meta.total === meta.ordinaryValidTotal;
    if (!sources || !/^\d{2}$/.test(industry) || industry === '00' ||
        !(common || stock.ordinaryStockVerified === true || officialCompany)) {
      return exit('UNVERIFIED', '普通股身分或產業未確認');
    }
    if (quoteDate !== date) return exit('UNVERIFIED', '行情交易日不一致');

    const margin = sources.margin?.get(code);
    const volume = sources.volume?.get(code);
    const outstanding = data.outstanding?.get(market + ':' + code);
    const marginShares = count(margin?.[1], 'lots');
    const shortShares = count(margin?.[2], 'lots');
    const tradedShares = count(volume?.[1], 'shares');
    const outstandingShares = count(outstanding?.[2], 'shares');
    row.shortRatio = ratio(shortShares, marginShares);
    row.turnover = ratio(tradedShares, outstandingShares);
    row.shares = { marginShares, shortShares, tradedShares, outstandingShares };

    const missing = [];
    if (!sources.excluded) missing.push('同日交易資格未確認');
    if (!row.shortRatio) missing.push(marginShares === 0 ? '融資餘額為 0' : '同日融資融券餘額未確認');
    if (tradedShares === null) missing.push('同日成交股數未確認');
    if (!(outstandingShares > 0)) missing.push('同日流通在外普通股數未確認');
    if (missing.length) return exit('UNVERIFIED', missing.join('、'));
    return exit(row.shortRatio.exceeds && row.turnover.exceeds ? 'QUALIFIED' : 'NOT_QUALIFIED', '');
  }

  async function scan(stocks, meta, inputs, date, { signal, onProgress = () => {} } = {}) {
    const data = prepare(inputs, date);
    const rows = [];
    const total = stocks.length;
    onProgress(0, total);
    for (let start = 0; start < total && !signal?.aborted; start += 100) {
      rows.push(...stocks.slice(start, start + 100).map(stock => assess(stock, meta, data, date)));
      onProgress(rows.length, total);
      if (rows.length < total) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const qualified = rows.filter(row => row.status === 'QUALIFIED')
      .sort((a, b) => b.turnover.value - a.turnover.value || b.shortRatio.value - a.shortRatio.value || a.code.localeCompare(b.code));
    const unverified = rows.filter(row => row.status === 'UNVERIFIED');
    const pending = total - rows.length;
    const complete = total > 0 && !pending && !signal?.aborted && !unverified.length;
    return { date, rows, total, qualified, top8: qualified.slice(0, 8), unverified, complete, pending,
      stopped: !!signal?.aborted, sources: data.sources };
  }

  function percent(metric) {
    if (!metric) return '未驗證';
    const value = metric.value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    if (value === '30' && metric.exceeds) return '略高於 30%';
    if (value === '30' && metric.value < 30) return '略低於 30%';
    return value + '%';
  }

  function summary(result) {
    if (result.complete) return '合格 ' + result.qualified.length + ' 檔';
    const known = result.qualified.length ? '已驗證合格 ' + result.qualified.length + ' 檔｜' : '';
    const pending = result.pending ? '｜待處理 ' + result.pending + ' 檔' : '';
    return known + '全市場合格檔數未確認｜資料未驗證 ' + result.unverified.length + ' 檔' + pending;
  }

  function metrics(row) {
    return '券資比 ' + percent(row.shortRatio) + '｜單日週轉率 ' + percent(row.turnover);
  }

  function textReport(result) {
    const lines = row => [
      row.code + ' ' + row.name + '｜' + row.date + '｜' + STATUS[row.status] + (row.reason ? '｜' + row.reason : ''),
      metrics(row),
      row.shares ? '融資／融券／成交／流通在外普通股（股） ' +
        Object.values(row.shares).map(value => value ?? '未驗證').join('／') : ''
    ].filter(Boolean);
    return [
      '石頭少爺 ' + VERSION + '｜' + TITLE,
      '交易日 ' + result.date + '｜' + summary(result),
      '券資比與單日週轉率均須 > 30%。Top 8 依週轉率、券資比、代號排序。',
      'Top 8', ...result.top8.flatMap(lines),
      '合格清單', ...result.qualified.flatMap(lines),
      '資料未驗證清單', ...result.unverified.flatMap(lines),
      '資料來源', ...result.sources.map(feed => [feed.label, feed.date || '未驗證', feed.source, feed.error].filter(Boolean).join('｜'))
    ].join('\n');
  }

  return Object.freeze({ TITLE, VERSION, STATUS, scan, percent, summary, metrics, textReport });
});
