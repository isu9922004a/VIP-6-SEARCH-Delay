import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Core from '../enhanced-macd-v923.js';
import { readHistory } from './collect-enhanced-macd-v923.mjs';

const horizons = [1, 3, 5];
const fee = 0.001425;
const tax = 0.003;
const slippage = [0, 0.001, 0.0025];
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const closeReturn = (price, entry) => (price / entry - 1) * 100;
const ratio = (numerator, denominator) => denominator ? numerator / denominator * 100 : null;

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

export function outcomes(signal, bars) {
  const entry = bars[0]?.open;
  return Object.fromEntries(horizons.map(horizon => {
    const window = bars.slice(0, horizon);
    if (window.length < horizon || !window.every((bar, index) =>
      Core.validBar(bar, bar?.date) && Core.validDate(bar.date) && bar.volume > 0 &&
      (index ? bar.date > window[index - 1].date : bar.date > signal.date))) return [horizon, null];
    const exit = window.at(-1).close;
    return [horizon, {
      signalCloseReturn: closeReturn(exit, signal.close),
      gross: closeReturn(exit, entry),
      adverse: Math.min(0, closeReturn(Math.min(...window.map(bar => bar.low)), entry)),
      net: slippage.map(slip => closeReturn(exit * (1 - slip) * (1 - fee - tax), entry * (1 + slip) * (1 + fee)))
    }];
  }));
}

function statistics(rows) {
  return Object.fromEntries(horizons.map(horizon => {
    const present = rows.map(row => row.outcomes[horizon]).filter(Boolean);
    return [horizon, {
      samples: present.length, missingForward: rows.length - present.length,
      meanSignalCloseReturn: average(present.map(row => row.signalCloseReturn)),
      signalClosePositivePct: ratio(present.filter(row => row.signalCloseReturn > 0).length, present.length),
      meanGross: average(present.map(row => row.gross)),
      grossPositivePct: ratio(present.filter(row => row.gross > 0).length, present.length),
      worstAdverse: present.length ? Math.min(...present.map(row => row.adverse)) : null,
      meanAdverse: average(present.map(row => row.adverse)),
      meanNet: slippage.map((_, index) => average(present.map(row => row.net[index]))),
      netPositivePct: slippage.map((_, index) => ratio(present.filter(row => row.net[index] > 0).length, present.length))
    }];
  }));
}

function summarize(rows) {
  const observed = rows.filter(row => row.falseBreakout !== null);
  return {
    signals: rows.length, horizons: statistics(rows),
    industries: Object.fromEntries([...groupBy(rows, row => row.industry)].map(([key, group]) => [key, group.length])),
    marketRegimes: Object.fromEntries([...groupBy(rows, row => row.regime)].map(([key, group]) => [key, statistics(group)])),
    highFalseBreakout: {
      samples: observed.length, count: observed.filter(row => row.falseBreakout).length,
      pct: ratio(observed.filter(row => row.falseBreakout).length, observed.length)
    }
  };
}

function receiptValid(receipt, date) {
  if (!receipt || !/^https:\/\/(?:[a-z]+\.twse\.com\.tw|www\.tpex\.org\.tw)\//.test(receipt.source) ||
      !/^[a-f\d]{64}$/.test(receipt.sha256) || !Number.isFinite(Date.parse(receipt.retrievedAt))) return false;
  return new Date(Date.parse(receipt.retrievedAt) + 8 * 3_600_000).toISOString().slice(0, 10) === date;
}

export async function backtest(root, files) {
  const calendar = JSON.parse(await fs.readFile(path.join(root, 'data/market/research-calendar.json')));
  const index = JSON.parse(await fs.readFile(path.join(root, 'data/index/TAIEX.json')));
  const indexBars = index.dailySeries ?? index.rows ?? [];
  const calendarDays = calendar.verified === true ? calendar.dates : [];
  const a = [];
  const b = [];
  const bTop8 = [];
  const audited = [];
  const skipped = [];
  const seen = new Set();

  for (const file of files) {
    const archive = JSON.parse(await fs.readFile(file));
    const { date, sessions, universe, result, sources } = archive;
    if (seen.has(date)) throw Error('重複的訊號日期 ' + date);
    seen.add(date);
    const day = calendarDays.indexOf(date);
    if (archive.schema !== 'ENHANCED_MACD_SCAN_V1' || archive.version !== Core.VERSION || result?.complete !== true ||
        !Array.isArray(universe) || result.total !== universe.length || day < Core.WINDOW - 1 ||
        !Array.isArray(archive.recoverySources) || archive.recoverySources.some(receipt => !receiptValid(receipt, date)) ||
        ['TWSE', 'TPEX'].some(market => ['quotes', 'companies', 'status'].some(dataset =>
          !receiptValid(sources?.find(receipt => receipt.market === market && receipt.dataset === dataset), date))) ||
        JSON.stringify(sessions) !== JSON.stringify(calendarDays.slice(Math.max(0, day - Core.HISTORY_SESSIONS + 1), day + 1))) {
      skipped.push({ date, reason: '缺少訊號當日可查得的完整公司、商品或行情檔案' });
      continue;
    }

    const future = calendarDays.slice(day + 1, day + 6);
    const errors = [];
    const forwardErrors = [];
    const [history, forward] = await Promise.all([readHistory(root, sessions, errors), readHistory(root, future, forwardErrors)]);
    const stocks = universe.map(stock => ({ ...stock, bars: sessions.map(session =>
      stock.historyRecovered?.find(bar => bar.date === session) ?? history[stock.market].get(session)?.rows.get(stock.code) ?? null) }));
    const scan = Core.scan(stocks, sessions, errors);
    if (!scan.complete) {
      skipped.push({ date, reason: '交易日原始日 K 或交易資格無法重算', errors });
      continue;
    }
    const idx = indexBars.findIndex(bar => bar.date === date);
    const regime = idx >= 19 && indexBars[idx].close > 0 ?
      (indexBars[idx].close >= average(indexBars.slice(idx - 19, idx + 1).map(bar => bar.close)) ? '大盤在月線上' : '大盤在月線下') : '大盤資料不足';
    const rank = new Set(scan.top8.map(row => row.market + ':' + row.code));
    for (const signal of scan.rows.filter(row => row.qualifiesA)) {
      const bars = future.map(session => forward[signal.market].get(session)?.rows.get(signal.code) ?? null);
      const stats = outcomes(signal, bars);
      // A high breakout is eligible for this statistic after a >20% 20-day
      // rise and a close above the preceding 20-session range. A close back
      // below that range within 3 sessions marks a failed breakout.
      const falseBreakout = signal.gain20 > 20 && signal.resistance === null && stats[3] !== null ?
        bars.slice(0, 3).some(bar => bar.close < signal.priorHigh) : null;
      const entry = { ...signal, outcomes: stats, regime, falseBreakout };
      a.push(entry);
      if (signal.qualifiesB) b.push(entry);
      if (rank.has(signal.market + ':' + signal.code)) bTop8.push(entry);
    }
    audited.push({ date, universe: scan.total, forwardSessions: future.length, forwardErrors });
  }

  return {
    audited, skipped, A: summarize(a), B: summarize(b), BTop8: summarize(bTop8),
    C: { status: '資料不足', reason: 'V9.22 歷史官方券資比及同日流通在外普通股數未完整核驗' },
    assumptions: {
      feeEachSidePct: fee * 100, sellTaxPct: tax * 100, slippageEachSidePct: slippage.map(value => value * 100),
      entry: '訊號下一個交易日開盤', exit: '訊號後第 1、3、5 個交易日收盤',
      price: '官方未還原 OHLC。跨公司行動的報酬需要額外核對。',
      A: '同一官方普通股池與產業排除，比較前三個核心條件，MACD 採 12、26、9',
      marketRegime: '只用訊號當日與之前的 TAIEX 收盤和月線',
      falseBreakout: '近 20 日漲超過 20% 且收盤突破此前 20 日最高價的訊號，3 日內有收盤跌回該價位下方'
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await backtest(process.cwd(), process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
