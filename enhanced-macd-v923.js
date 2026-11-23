(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShitouEnhancedMacd = api;
})(globalThis, function () {
  'use strict';

  const VERSION = 'V9.23';
  const TITLE = '⑥ 強化 MACD+';
  const SUBTITLE = '尋找 MACD 剛黃金交叉、成交量適中且股本低於 50 億元的短線候選股。';
  const WINDOW = 100;
  const HISTORY_SESSIONS = 120;
  const MIN_LISTING_BARS = 50;
  const CAP_LIMIT = 5_000_000_000;
  const MIN_VOLUME = 2_000_000;
  const MAX_VOLUME = 10_000_000;
  const INDUSTRIES = new Set('01 02 03 04 05 06 08 09 10 11 12 14 15 16 17 18 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38'.split(' '));
  const EXCLUDED = new Map([['14', '建材營造'], ['17', '金融保險'], ['22', '生技醫療']]);
  const RULES = [
    'MACD（12、26、9）在最新完成交易日剛黃金交叉',
    '成交量 2,000 至 10,000 張，含上下限（1 張 = 1,000 股）',
    '官方實收資本額大於 0 元且小於 50 億元'
  ];

  const sum = values => values.reduce((total, value) => total + value, 0);
  const mean = values => sum(values) / values.length;
  const clamp = value => Math.min(1, Math.max(0, value));
  const pct = (value, reference) => (value / reference - 1) * 100;
  const ticks = value => Math.round(value * 10_000);
  const rounded = (value, digits = 4) => Number(value.toFixed(digits));
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

  function wholeNumber(value) {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(String(value))) return null;
    const quantity = Number(String(value).replace(/,/g, ''));
    return Number.isSafeInteger(quantity) ? quantity : null;
  }

  function shares(value, unit) {
    const quantity = wholeNumber(value);
    if (quantity === null) return null;
    if (unit === 'shares') return quantity;
    if (unit === 'lots' && Number.isSafeInteger(quantity * 1000)) return quantity * 1000;
    return null;
  }

  // Seed each EMA with its first full window's SMA. Each evaluation uses the
  // most recent 100 official prices, or the full verified history from a recent listing.
  function ema(values, period) {
    const result = Array(values.length).fill(null);
    if (values.length < period) return result;
    const alpha = 2 / (period + 1);
    result[period - 1] = mean(values.slice(0, period));
    for (let index = period; index < values.length; index++) {
      result[index] = result[index - 1] + alpha * (values[index] - result[index - 1]);
    }
    return result;
  }

  function macd(closes) {
    const fast = ema(closes, 12);
    const slow = ema(closes, 26);
    const dif = slow.slice(25).map((value, index) => fast[index + 25] - value);
    const signal = ema(dif, 9);
    return [
      ...Array(Math.min(25, closes.length)).fill(null),
      ...dif.map((value, index) => signal[index] === null ? null :
        { dif: value, signal: signal[index], histogram: value - signal[index] })
    ];
  }

  function crosses(previous, current) {
    return !!previous && !!current && previous.dif <= previous.signal && current.dif > current.signal;
  }

  function validBar(bar, date) {
    return !!bar && bar.date === date && bar.completed !== false &&
      [bar.open, bar.high, bar.low, bar.close].every(value =>
        Number.isFinite(value) && value > 0 && ticks(value) <= Number.MAX_SAFE_INTEGER / 20 &&
        Math.abs(value * 10_000 - ticks(value)) < 1e-6) &&
      bar.high >= Math.max(bar.open, bar.low, bar.close) && bar.low <= Math.min(bar.open, bar.close) &&
      Number.isSafeInteger(bar.volume) && bar.volume >= 0;
  }

  function quality({ close, histogram, previousHistogram, gap, slope, volumeRatio, riskCount, closePosition }) {
    // Each component is on 0–100. Normalize histogram and its change by signal
    // close, use a 3% MA gap target and a 1.6× relative volume target.
    const momentum = 60 * clamp(histogram / close / 0.004) +
      40 * clamp((histogram - previousHistogram) / close / 0.008);
    const trend = 70 * clamp(1 - Math.abs(gap - 3) / 12) + 30 * clamp(slope / 3);
    const volume = volumeRatio === null ? 0 : 100 * clamp(1 - Math.abs(volumeRatio - 1.6) / 1.6);
    const breakout = 100 * clamp(0.7 + 0.3 * closePosition - 0.16 * riskCount);
    return {
      momentum: rounded(momentum), trend: rounded(trend), volume: rounded(volume), breakout: rounded(breakout),
      total: rounded(0.35 * momentum + 0.25 * trend + 0.25 * volume + 0.15 * breakout)
    };
  }

  function analyze(bars, precedingVolumes = bars.slice(-6, -1).map(bar => bar.volume)) {
    const closes = bars.map(bar => bar.close);
    const series = macd(closes);
    const today = bars.at(-1);
    const previous = bars.at(-2);
    const current = series.at(-1);
    const prior = series.at(-2);
    // Compare share counts as integers. This preserves strict equality at the
    // five-day mean without introducing an intermediate rounding step.
    const priorVolumeTotal = precedingVolumes.every(volume => Number.isSafeInteger(volume) && volume >= 0) ?
      precedingVolumes.reduce((total, volume) => total + BigInt(volume), 0n) : null;
    const averageVolume = priorVolumeTotal === null ? null : Number(priorVolumeTotal) / 5;
    const ma20Ticks = sum(closes.slice(-20).map(ticks));
    const ma20 = ma20Ticks / 20 / 10_000;
    const gap = pct(today.close, ma20);
    const slope = pct(ma20, mean(closes.slice(-25, -5)));
    const volumeRatio = averageVolume > 0 ? today.volume / averageVolume : null;
    const prior20 = bars.slice(-21, -1);
    const high20 = Math.max(...prior20.map(bar => bar.high));
    const low20 = Math.min(...prior20.map(bar => bar.low));
    const gain20 = pct(today.close, prior20[0].close);
    const range = today.high - today.low;
    const closePosition = range ? (today.close - today.low) / range : 0.5;
    const upperWick = range ? (today.high - Math.max(today.open, today.close)) / range : 0;
    const change = pct(today.close, previous.close);
    const pressureDistance = pct(high20, today.close);
    const priorPeakIndex = closes.lastIndexOf(Math.max(...closes.slice(-21, -1)), closes.length - 2);
    const riskFlags = [
      [gap > 8, '離月線超過 8%'],
      [gain20 > 20, '近 20 日上漲超過 20%'],
      [upperWick >= 0.45, '長上影線'],
      [volumeRatio !== null && volumeRatio >= 2.5 && change <= 1, '爆量但漲幅不超過 1%'],
      [range > 0 && closePosition <= 0.35, '收盤落在當日振幅下段'],
      [pressureDistance >= 0 && pressureDistance <= 3, '距前 20 日高點不超過 3%'],
      [today.close > closes[priorPeakIndex] &&
        series[priorPeakIndex] !== null && current.dif / today.close < series[priorPeakIndex].dif / closes[priorPeakIndex], '股價創高但標準化 DIF 未同步創高']
    ].filter(([flag]) => flag).map(([, label]) => label);
    const zeroBand = today.close * 0.002;
    const axis = Math.max(current.dif, current.signal) < -zeroBand ? '零軸下方' :
      Math.min(current.dif, current.signal) > zeroBand ? '零軸上方' : '零軸附近';
    const gates = {
      cross: crosses(prior, current),
      volume: today.volume >= MIN_VOLUME && today.volume <= MAX_VOLUME,
      aboveMa20: 20 * ticks(today.close) > ma20Ticks,
      strongerVolume: priorVolumeTotal === null ? null : 5n * BigInt(today.volume) > priorVolumeTotal
    };
    return {
      gates, close: today.close, change, macd: current, previousMacd: prior, axis,
      volume: today.volume, averageVolume, volumeRatio, ma20, gap, slope, gain20,
      closePosition, upperWick, riskFlags, priorHigh: high20,
      support: low20 < today.close ? low20 : null, resistance: high20 >= today.close ? high20 : null,
      score: quality({
        close: today.close, histogram: current.histogram, previousHistogram: prior.histogram,
        gap, slope, volumeRatio, riskCount: riskFlags.length, closePosition
      })
    };
  }

  function evaluate(stock, sessions) {
    const date = sessions.at(-1);
    const base = { code: stock.code, name: stock.name, market: stock.market, date };
    const result = (status, reason) => ({ ...base, status, reason });
    if (stock.product === 'OTHER') return result('EXCLUDED', '官方商品分類為非普通股');
    if (stock.product !== 'COMMON') return result('DATA', '普通股身分未確認');
    if (!INDUSTRIES.has(stock.industry)) return result('DATA', '官方產業不明');
    if (EXCLUDED.has(stock.industry)) return result('EXCLUDED', EXCLUDED.get(stock.industry));
    if (stock.suspended === true) return result('NO_TRADE', '官方資料顯示停牌或當日無交易');
    if (!Number.isSafeInteger(stock.capital) || stock.capital <= 0 ||
        !validDate(stock.companyDate) || stock.companyDate < sessions.at(-2) || stock.companyDate > date) {
      return result('DATA', '實收資本額或官方公司資料日期未核對');
    }

    const latest = stock.bars?.at(-1);
    const capitalOk = stock.capital < CAP_LIMIT;
    const latestBarValid = validBar(latest, date);
    const tradeVolume = latestBarValid ? latest.volume : stock.quoteVolume;
    if (!Number.isSafeInteger(tradeVolume) || tradeVolume < 0) return result('DATA', '最新完成日成交股數缺漏／異常');
    const volumeOk = tradeVolume >= MIN_VOLUME && tradeVolume <= MAX_VOLUME;
    if (!capitalOk || !volumeOk) {
      return {
        ...result('REJECTED', latestBarValid ? '實收資本額或成交量未達門檻' :
          '日 K 缺少完整價格，官方成交股數或股本已可確認未達門檻'),
        volume: tradeVolume, gates: { capital: capitalOk, volume: volumeOk }
      };
    }
    if (!latestBarValid) return result('DATA', '最新完成日 K 缺漏、異常或與指定日行情不符');

    const data = reason => result('DATA', reason);
    if (stock.bars.length !== sessions.length || !validBar(stock.bars.at(-2), sessions.at(-2)) || stock.bars.at(-2).volume === 0) {
      return data('前一交易日缺少有效收盤價，無法核對當日交叉');
    }
    const gaps = new Map((stock.historyGaps ?? []).filter(gap => validDate(gap.date) &&
      ['OFFICIAL_NO_OHLC', 'OFFICIAL_ABSENT', 'OFFICIAL_ZERO_VOLUME'].includes(gap.type)).map(gap => [gap.date, gap]));
    const valid = [];
    let fromListing = false;
    for (let index = sessions.length - 1; index >= 0 && valid.length < WINDOW; index--) {
      const day = sessions[index];
      if (validDate(stock.listingDate) && day < stock.listingDate) {
        fromListing = true;
        break;
      }
      const bar = stock.bars[index];
      if (validBar(bar, day) && bar.volume > 0) {
        valid.push(bar);
      } else if (!gaps.has(day)) {
        return { ...data('官方歷史日 K 尚待核對｜' + day), missingHistoryDate: day };
      }
    }
    if (valid.length < WINDOW && (!fromListing || valid.length < MIN_LISTING_BARS)) {
      return data('有效日 K 不足｜已核對 ' + valid.length + ' 根');
    }
    const precedingVolumes = sessions.slice(-6, -1).map((day, offset) => {
      const bar = stock.bars[sessions.length - 6 + offset];
      return validBar(bar, day) ? bar.volume : gaps.get(day)?.volume;
    });
    const metrics = analyze(valid.reverse(), precedingVolumes);
    const gates = { ...metrics.gates, capital: capitalOk };
    const qualifiesA = gates.cross && gates.volume && gates.capital;
    // Keep the former five-condition comparison for the historical backtest.
    const verifiedMa20 = sessions.slice(-20).every((day, offset) => {
      const bar = stock.bars[sessions.length - 20 + offset];
      return validBar(bar, day) && bar.volume > 0;
    });
    const failsFormerGate = gates.strongerVolume === false || (verifiedMa20 && !gates.aboveMa20);
    const formerGatesKnown = verifiedMa20 && gates.strongerVolume !== null;
    const qualifiesB = !qualifiesA || failsFormerGate ? false : formerGatesKnown ? true : null;
    return {
      ...base, ...metrics, gates, qualifiesA, qualifiesB, industry: stock.industry,
      capital: stock.capital, companyDate: stock.companyDate, historyBars: valid.length,
      status: qualifiesA ? 'QUALIFIED' : 'REJECTED'
    };
  }

  function scan(stocks, sessions, errors = []) {
    if ((sessions.length < WINDOW || sessions.length > HISTORY_SESSIONS) || !sessions.every((date, index) =>
      validDate(date) && (!index || date > sessions[index - 1]))) throw Error('共同交易日曆未驗證');
    const keys = new Set(stocks.map(stock => stock.market + ':' + stock.code));
    if (keys.size !== stocks.length) throw Error('股票池含重複代號');
    const rows = stocks.map(stock => evaluate(stock, sessions));
    const qualified = rows.filter(row => row.qualifiesA).sort((a, b) =>
      b.score.total - a.score.total || a.code.localeCompare(b.code, 'en') || a.market.localeCompare(b.market, 'en'));
    const incomplete = rows.filter(row => row.status === 'DATA');
    const complete = stocks.length > 0 && !errors.length && !incomplete.length;
    return {
      date: sessions.at(-1), complete, total: stocks.length, errors, incomplete,
      rows, qualified, top8: complete ? qualified.slice(0, 8) : []
    };
  }

  function summary(result) {
    return result.complete ? '合格 ' + result.qualified.length + ' 檔' :
      '資料不足／掃描未完成' + (result.incomplete.length ? '｜' + result.incomplete.length + ' 檔待核對' : '');
  }

  return Object.freeze({
    VERSION, TITLE, SUBTITLE, WINDOW, HISTORY_SESSIONS, RULES, validDate, wholeNumber, shares, ema, macd, crosses, validBar,
    quality, analyze, evaluate, scan, summary
  });
});
