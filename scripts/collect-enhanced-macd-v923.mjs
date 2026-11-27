import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import Core from '../enhanced-macd-v923.js';
import { sourceUrl as archiveSource } from './build-official-research-history.mjs';
import { buildPostmarketBreadth, officialBreadthQuote } from './build-postmarket-breadth-v926.mjs';
import {
  SOURCES, normalizeMarketDate, extractTwseMiIndexRows, extractTpexDailyQuoteRows, normalizeQuote
} from './update-market-snapshot.mjs';

const markets = ['TWSE', 'TPEX'];
const comparisonCodes = new Set(['7788', '2451']);
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = /^[a-f\d]{64}$/;
const compact = date => date.replaceAll('-', '');
const iso = raw => {
  const date = normalizeMarketDate(raw);
  return date && date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6);
};
export function withinCollectionWindow(date, now) {
  const local = new Date(now.getTime() + 8 * 3_600_000).toISOString();
  const day = local.slice(0, 10);
  const time = local.slice(11, 16);
  const yesterday = new Date(Date.parse(day) - 86_400_000).toISOString().slice(0, 10);
  return (date === day && time >= '17:35') || (date === yesterday && time < '09:00');
}
const stockCode = value => String(value ?? '').trim();
const equityCode = /^[1-9]\d{3}$/;
const tdrCode = /^91\d{2}(?:\d{2})?$/;
const paths = {
  TWSE: {
    quotes: date => 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=' + compact(date) + '&type=ALLBUT0999&response=json',
    companies: SOURCES.twseCompanies,
    status: 'https://openapi.twse.com.tw/v1/exchangeReport/TWTAWU'
  },
  TPEX: {
    quotes: date => archiveSource('TPEX', date),
    companies: SOURCES.tpexCompanies,
    status: 'https://www.tpex.org.tw/openapi/v1/tpex_cmode'
  }
};

function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const code = stockCode(row[key]);
    if (!code || map.has(code)) throw Error('官方清單代號缺漏或重複 ' + code);
    map.set(code, row);
  }
  return map;
}

export async function readOfficial(source, fetcher) {
  // Earlier TPEx Worker requests could loop on redirects. Preserve the
  // official origin and fail immediately on any redirect.
  const attempts = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const evidence = { source, retrievedAt: new Date().toISOString() };
    try {
      const response = await fetcher(source, {
        redirect: 'manual', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000)
      });
      evidence.status = response.status;
      evidence.contentType = response.headers.get('content-type');
      const retryAfter = response.headers.get('retry-after');
      if (!response.ok) {
        const error = Error('官方資料 HTTP ' + response.status + ' ' + source);
        error.retryable = response.status >= 500 || [408, 429].includes(response.status);
        if (retryAfter) {
          const seconds = /^\d+$/.test(retryAfter) ? Number(retryAfter) :
            (Date.parse(retryAfter) - Date.now()) / 1000;
          if (Number.isFinite(seconds)) error.retryAfterMs = Math.max(0, seconds * 1000);
        }
        throw error;
      }
      if (response.url && response.url !== source) throw Error('官方資料網址不符 ' + source);
      const bytes = Buffer.from(await response.arrayBuffer());
      evidence.sha256 = sha(bytes);
      let rows;
      try {
        rows = JSON.parse(bytes);
      } catch {
        const error = Error('官方來源回傳非 JSON ' + source);
        error.retryable = true;
        throw error;
      }
      return { rows, receipt: { ...evidence, retrievedAt: new Date().toISOString(),
        ...(attempts.length ? { attempts } : {}) } };
    } catch (error) {
      attempts.push({ ...evidence, error: error.message });
      const retryable = error.retryable || ['TimeoutError', 'TypeError'].includes(error.name);
      if (attempt === 2 || !retryable || error.retryAfterMs > 15_000) {
        throw Error(error.message + '｜' + JSON.stringify(attempts), { cause: error });
      }
      await delay(Math.max(800 * 2 ** attempt, error.retryAfterMs ?? 0));
    }
  }
}

function parseCompanies(rows, market, sessions) {
  if (!Array.isArray(rows) || rows.length < (market === 'TWSE' ? 800 : 600)) throw Error('官方公司清單筆數不足');
  const listed = market === 'TWSE';
  const companyMap = indexBy(rows, listed ? '公司代號' : 'SecuritiesCompanyCode');
  const reportDates = new Set(rows.map(row => iso(listed ? row.出表日期 : row.Date)));
  const reportDate = [...reportDates][0];
  if (reportDates.size !== 1 || !Core.validDate(reportDate) || reportDate < sessions.at(-2) || reportDate > sessions.at(-1)) {
    throw Error('官方公司出表日期不在訊號日或上一交易日至訊號日之間');
  }
  const companies = new Map();
  for (const [code, row] of companyMap) {
    const name = (listed ? row.公司簡稱 : row.CompanyAbbreviation)?.trim();
    const listingDate = iso(listed ? row.上市日期 : row.DateOfListing);
    // TWSE lists TDRs in the same file. Its official DR-marked issue name and
    // 91-series identifier are both required for this product classification.
    const product = listed && tdrCode.test(code) && /[-－]DR$/i.test(name) ? 'OTHER' :
      equityCode.test(code) && !tdrCode.test(code) ? 'COMMON' : 'UNKNOWN';
    companies.set(code, {
      code, name, market, product, companyDate: reportDate, listingDate,
      capital: Core.wholeNumber(listed ? row.實收資本額 : row['Paidin.Capital.NTDollars']),
      industry: String((listed ? row.產業別 : row.SecuritiesIndustryCode) ?? '').trim()
    });
  }
  return { companies, reportDate };
}

function parseHalts(rows, market, date, retrievedAt) {
  if (!Array.isArray(rows) || !withinCollectionWindow(date, new Date(retrievedAt))) throw Error('官方停牌資料時間未對齊');
  if (market === 'TPEX') {
    if (!rows.length || rows.some(row => iso(row.Date) !== date || !Object.hasOwn(row, 'SuspensionOfTrading'))) {
      throw Error('櫃買停牌資料日期或欄位缺漏');
    }
    return new Set(rows.filter(row => /^Y$/i.test(String(row.SuspensionOfTrading).normalize('NFKC').trim()))
      .map(row => stockCode(row.SecuritiesCompanyCode)));
  }
  return new Set(rows.filter(row => {
    const start = iso(row.TradingHaltDate);
    const end = iso(row.TradingResumptionDate);
    return Core.validDate(start) && start <= date && (!end || end > date) &&
      (start < date || /^\d{6}$/.test(row.TradingHaltTime) && row.TradingHaltTime <= '090000');
  }).map(row => stockCode(row.Code)));
}

function parseQuotes(payload, market, date) {
  const listed = market === 'TWSE';
  const rows = (listed ? extractTwseMiIndexRows : extractTpexDailyQuoteRows)(payload, compact(date));
  if (rows.length < (listed ? 800 : 600) || rows.some(row => !Object.hasOwn(row, '成交股數'))) {
    throw Error('收盤行情日期、筆數或成交股數欄位未對齊');
  }
  return indexBy(rows, listed ? '證券代號' : '代號');
}

export async function readHistory(root, sessions, errors) {
  const histories = { TWSE: new Map(), TPEX: new Map() };
  await Promise.all(markets.flatMap(market => sessions.map(async date => {
    try {
      const file = await fs.readFile(path.join(root, 'data/research/days', market + '-' + date + '.json.gz'));
      const day = JSON.parse(gunzipSync(file));
      if (day.schema !== 'OFFICIAL_MARKET_DAY_V1' || day.market !== market || day.date !== date ||
          day.source !== archiveSource(market, date) || !hash.test(day.sourceSha256) ||
          day.volumeUnit !== 'shares' || !Array.isArray(day.rows) ||
          day.rows.length < (market === 'TWSE' ? 800 : 600) ||
          day.rows.some(row => !Core.validBar(row, date))) throw Error('歷史官方日 K 交易日、單位或來源未通過核對');
      histories[market].set(date, { rows: indexBy(day.rows, 'code'), source: day.source, date, sha256: day.sourceSha256 });
    } catch (error) {
      errors.push(market + ' ' + date + ' 歷史日 K：' + (error.code ?? error.message));
    }
  })));
  return histories;
}

export function parseTwseStockMonth(payload, code, date) {
  const month = date.slice(0, 7);
  const title = String(payload?.title ?? '').trim().split(/\s+/);
  const valueDate = iso(payload?.date);
  if (payload?.stat !== 'OK' || title[1] !== code || valueDate?.slice(0, 7) !== month ||
      !Array.isArray(payload.fields) || !Array.isArray(payload.data) || !payload.data.length ||
      !['日期', '成交股數', '開盤價', '最高價', '最低價', '收盤價'].every(field => payload.fields.includes(field))) {
    throw Error('證交所個股月報的股票代號、月份或欄位未核對');
  }
  const rows = payload.data.map(values => {
    if (!Array.isArray(values) || values.length !== payload.fields.length) throw Error('證交所個股月報欄位長度不符');
    const row = Object.fromEntries(payload.fields.map((field, i) => [field, values[i]]));
    const day = iso(row.日期);
    if (!Core.validDate(day) || day.slice(0, 7) !== month) throw Error('證交所個股月報含錯誤交易日');
    return { ...row, day, 證券代號: code };
  });
  return indexBy(rows, 'day');
}

async function reconcileMissingHistory(stocks, sessions, histories, fetcher) {
  const reports = new Map();
  const receipts = [];
  const pending = { TWSE: Promise.resolve(), TPEX: Promise.resolve() };
  const read = (market, date) => {
    const key = market + ':' + date;
    if (!reports.has(key)) {
      const request = pending[market].then(async () => {
        const sources = new Set([archiveSource(market, date), paths[market].quotes(date)]);
        const errors = [];
        for (const source of sources) {
          try {
            const { rows, receipt } = await readOfficial(source, fetcher);
            const quotes = parseQuotes(rows, market, date);
            if ([...histories[market].get(date).rows.keys()].some(code => !quotes.has(code))) {
              throw Error('指定日官方行情未涵蓋已核對的歷史代號');
            }
            receipts.push({ ...receipt, market, date, ...(errors.length ? { fallbackErrors: errors } : {}) });
            return quotes;
          } catch (error) {
            errors.push(error.message);
          }
        }
        throw Error(errors.join('／'));
      });
      reports.set(key, request);
      pending[market] = request.catch(() => {});
    }
    return reports.get(key);
  };

  const readStockMonth = (stock, date) => {
    const month = date.slice(0, 7);
    const key = stock.market + ':' + stock.code + ':' + month;
    if (!reports.has(key)) {
      const request = pending.TWSE.then(async () => {
        const errors = [];
        for (const endpoint of ['https://www.twse.com.tw/exchangeReport/STOCK_DAY',
          'https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY']) {
          const source = endpoint + '?response=json&date=' + compact(month) + '01&stockNo=' + stock.code;
          try {
            const { rows, receipt } = await readOfficial(source, fetcher);
            const quotes = parseTwseStockMonth(rows, stock.code, date);
            const overlap = sessions.filter(day => day < sessions.at(-1) && day.startsWith(month) &&
              histories.TWSE.get(day)?.rows.has(stock.code));
            if (!overlap.length || overlap.some(day => {
              const raw = quotes.get(day);
              const bar = raw && normalizeQuote(raw, 'TWSE', compact(day), new Map());
              const archived = histories.TWSE.get(day).rows.get(stock.code);
              return !bar || ['open', 'high', 'low', 'close', 'volume'].some(field => bar[field] !== archived[field]);
            })) throw Error('證交所個股月報與指定日歷史行情不符');
            receipts.push({ ...receipt, market: 'TWSE', month, code: stock.code,
              ...(errors.length ? { fallbackErrors: errors } : {}) });
            return quotes;
          } catch (error) {
            errors.push(error.message);
          }
        }
        throw Error(errors.join('／'));
      });
      reports.set(key, request);
      pending.TWSE = request.catch(() => {});
    }
    return reports.get(key);
  };

  async function recover(stock, date) {
    if (!histories[stock.market].has(date)) throw Error('指定日官方行情檔案未核對');
    let raw;
    try {
      raw = (await read(stock.market, date)).get(stock.code);
    } catch (error) {
      if (stock.market !== 'TWSE') throw error;
      try {
        const monthly = await readStockMonth(stock, date);
        raw = monthly.get(date);
        if (!raw) throw Error('證交所個股月報缺少指定日期');
      } catch (monthlyError) {
        throw Error(error.message + '／' + monthlyError.message);
      }
    }
    const volume = Core.shares(raw?.成交股數, 'shares');
    const normalized = raw && normalizeQuote(raw, stock.market, compact(date), new Map());
    const bar = normalized && volume !== null ? { ...normalized, date, volume } : null;
    if (Core.validBar(bar, date) && bar.volume > 0) {
      const recovered = { date, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume };
      stock.bars[sessions.indexOf(date)] = recovered;
      (stock.historyRecovered ??= []).push(recovered);
    } else {
      const fields = stock.market === 'TWSE' ? ['開盤價', '最高價', '最低價', '收盤價'] : ['開盤', '最高', '最低', '收盤'];
      const noPrices = raw && fields.every(field => /^-+$/.test(String(raw[field] ?? '').trim()));
      if (raw && (volume === null || (!noPrices && volume !== 0))) throw Error('指定日股數或開高低收欄位不完整');
      const type = !raw ? 'OFFICIAL_ABSENT' : noPrices ? 'OFFICIAL_NO_OHLC' : 'OFFICIAL_ZERO_VOLUME';
      (stock.historyGaps ??= []).push({ date, volume, type });
    }
  }

  await Promise.all(stocks.map(async stock => {
    const options = { inspectRejected: comparisonCodes.has(stock.code) };
    let row = Core.evaluate(stock, sessions, options);
    if (!row.missingHistoryDate) return;
    const failures = new Map();
    const dates = sessions.slice(-Core.WINDOW, -2).filter(date => {
      if (stock.listingDate && date < stock.listingDate) return false;
      const bar = histories[stock.market].get(date)?.rows.get(stock.code);
      return !Core.validBar(bar, date) || bar.volume === 0;
    }).reverse();
    const attempted = new Set();
    const attempt = async date => {
      if (attempted.has(date)) return;
      attempted.add(date);
      try {
        await recover(stock, date);
      } catch (error) {
        failures.set(date, error.message);
      }
    };
    for (const date of dates) await attempt(date);
    row = Core.evaluate(stock, sessions, options);
    while (row.missingHistoryDate && !attempted.has(row.missingHistoryDate)) {
      await attempt(row.missingHistoryDate);
      row = Core.evaluate(stock, sessions, options);
    }
    const failure = failures.get(row.missingHistoryDate);
    if (failure) stock.historyError = row.missingHistoryDate + '：' + failure;
  }));
  return receipts.sort((a, b) => (a.date ?? a.month).localeCompare(b.date ?? b.month) ||
    a.market.localeCompare(b.market) || a.source.localeCompare(b.source));
}

export async function collect(root, fetcher = fetch, now = new Date(), {captureBreadth = false} = {}) {
  const [calendar, snapshot] = await Promise.all([
    json(path.join(root, 'data/market/research-calendar.json')),
    json(path.join(root, 'data/market/latest.json'))
  ]);
  const date = snapshot.tradeDateIso;
  const sessions = calendar.dates?.slice(-Core.HISTORY_SESSIONS) ?? [];
  if (!Core.validDate(date) || snapshot.marketCoverageReady !== true || calendar.verified !== true ||
      calendar.source !== 'https://www.twse.com.tw/exchangeReport/FMTQIK' ||
      calendar.sourceSnapshotHash !== snapshot.contentSha256 ||
      calendar.sourceSnapshotDate !== date || sessions.at(-1) !== date ||
      !withinCollectionWindow(date, now)) {
    throw Error('等候已完成且仍在盤後收集時段的上市櫃官方快照與交易日曆');
  }

  const errors = [];
  const receipts = [];
  const feeds = {};
  const historyPromise = readHistory(root, sessions, errors);
  await Promise.all(markets.flatMap(market => Object.entries(paths[market]).map(async ([key, source]) => {
    try {
      feeds[market] ??= {};
      feeds[market][key] = await readOfficial(typeof source === 'function' ? source(date) : source, fetcher);
      receipts.push({ market, dataset: key, ...feeds[market][key].receipt });
    } catch (error) {
      errors.push(market + ' ' + key + '：' + error.message);
    }
  })));
  const histories = await historyPromise;
  const universe = [];
  const quoteStates = captureBreadth ? new Map() : null;
  for (const market of markets) {
    try {
      const { quotes, companies: companyFeed, status } = feeds[market];
      if (!quotes || !companyFeed || !status) continue;
      if ([quotes, companyFeed, status].some(feed => !withinCollectionWindow(date, new Date(feed.receipt.retrievedAt)))) {
        throw Error('官方資料未於訊號日取得');
      }
      const { companies, reportDate } = parseCompanies(companyFeed.rows, market, sessions);
      const quoteMap = parseQuotes(quotes.rows, market, date);
      const halted = parseHalts(status.rows, market, date, status.receipt.retrievedAt);
      receipts.find(receipt => receipt.market === market && receipt.dataset === 'companies').date = reportDate;
      receipts.find(receipt => receipt.market === market && receipt.dataset === 'quotes').date = date;
      receipts.find(receipt => receipt.market === market && receipt.dataset === 'status').date = date;
      const listed = market === 'TWSE';
      const keys = [...new Set([...companies.keys(), ...quoteMap.keys()].filter(code => equityCode.test(code) || companies.has(code)))].sort();
      for (const code of keys) {
        const raw = quoteMap.get(code);
        const company = companies.get(code);
        if (company?.listingDate > date && !raw) continue;
        const quoteName = listed ? raw?.證券名稱 : raw?.名稱;
        const stock = company ?? { code, market, name: quoteName || code, product: 'UNKNOWN' };
        const volume = Core.shares(raw?.成交股數, 'shares');
        const final = raw && normalizeQuote(raw, market, compact(date), new Map());
        const latest = final && volume !== null ? { ...final, date, volume } : null;
        const sameDay = histories[market].get(date)?.rows.get(code);
        const bars = sessions.map(session => histories[market].get(session)?.rows.get(code) ?? null);
        if (latest && sameDay && ['open', 'high', 'low', 'close', 'volume'].every(key => latest[key] === sameDay[key])) {
          bars[bars.length - 1] = latest;
        } else {
          bars[bars.length - 1] = null;
        }
        universe.push({ ...stock, name: stock.name || quoteName || code, suspended: halted.has(code) || volume === 0, quoteVolume: volume, bars });
        if (quoteStates) quoteStates.set(`${market}:${code}`,{...officialBreadthQuote(market,raw),halted:halted.has(code)});
      }
    } catch (error) {
      errors.push(market + '：' + error.message);
    }
  }
  // Reconcile the union of official company and quote rows with the existing
  // all-market snapshot. Keep additional companies, including suspended issues.
  const keys = new Set(universe.map(row => row.market + ':' + row.code));
  for (const market of markets) {
    const missing = snapshot.rows.filter(row => row.market === market && !keys.has(row.market + ':' + row.code));
    if (missing.length) {
      errors.push(market + ' 市場快照有 ' + missing.length + ' 檔代號未涵蓋：' +
        missing.slice(0, 10).map(row => row.code).join('、'));
    }
  }
  const recoverySources = await reconcileMissingHistory(universe, sessions, histories, fetcher);
  const result = Core.scan(universe, sessions, errors.sort());
  const diagnostics = new Map(universe.filter(stock => stock.historyError).map(stock => [stock.market + ':' + stock.code, stock.historyError]));
  for (const row of result.incomplete) {
    const detail = diagnostics.get(row.market + ':' + row.code);
    if (detail) row.reason += '｜' + detail;
  }
  // Preserve independently auditable gate outcomes for known comparison cases.
  // A missing/invalid MACD history must never be presented as a failed signal.
  const comparison = result.rows.filter(row => comparisonCodes.has(row.code)).map(row => {
    const stock = universe.find(item => item.market === row.market && item.code === row.code);
    const audit = Core.evaluate(stock, sessions, { inspectRejected: true });
    const gates = audit.gates ?? row.gates ?? {};
    const reasons = row.status === 'DATA' ? [row.reason] :
      row.status === 'EXCLUDED' || row.status === 'NO_TRADE' ? [row.reason] :
      [
        gates.capital === false ? '實收資本額不符合 0～50 億元' : null,
        gates.volume === false ? '成交量不符合 2,000～10,000 張' : null,
        gates.cross === false ? '最新完成交易日 MACD 未黃金交叉' : null,
        audit.status === 'DATA' ? stock.historyError ?? audit.reason : null
      ].filter(Boolean);
    return {
      code: row.code, name: row.name, market: row.market, date: row.date,
      status: row.status, reasons, gates,
      capital: row.capital ?? stock?.capital ?? null,
      volume: row.volume ?? stock?.quoteVolume ?? null,
      product: stock.product, industry: stock.industry, historyBars: audit.historyBars ?? null,
      macd: audit.macd ?? null, previousMacd: audit.previousMacd ?? null
    };
  });
  for (const code of comparisonCodes) {
    if (!comparison.some(row => row.code === code)) {
      comparison.push({ code, status: 'DATA', reasons: ['官方股票池未涵蓋此代號，不能判定不符合'] });
    }
  }
  result.comparison = comparison;
  result.pool = Object.fromEntries(markets.map(market => {
    const stocks = universe.filter(stock => stock.market === market);
    return [market, { total: stocks.length, common: stocks.filter(stock => stock.product === 'COMMON').length }];
  }));
  const historySources = markets.flatMap(market => [...histories[market].values()].map(({ rows, ...receipt }) => ({ ...receipt, market })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market));
  const generatedAt = new Date().toISOString();
  const artifact = {
    schema: 'ENHANCED_MACD_SCAN_V2', version: Core.VERSION, generatedAt, date,
    snapshotHash: snapshot.contentSha256, calendarSource: calendar.source, sessions,
    priceBasis: 'UNADJUSTED_OFFICIAL_OHLC', volumeUnit: 'shares', capitalUnit: 'NTD',
    sources: receipts.sort((a, b) => a.market.localeCompare(b.market) || a.dataset.localeCompare(b.dataset)),
    historySources, recoverySources, result
  };
  const breadth = quoteStates && result.complete ? buildPostmarketBreadth({date,snapshotHash:snapshot.contentSha256,
    sessions,receipts,universe,quoteStates}) : null;
  return { artifact, universe, breadth };
}

async function writeAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  await fs.writeFile(temp, JSON.stringify(data) + '\n');
  await fs.rename(temp, file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [target = 'data/enhanced-macd/latest.json', archive, breadthTarget] = process.argv.slice(2);
  try {
    const { artifact, universe, breadth } = await collect(process.cwd(),fetch,new Date(),{captureBreadth:!!breadthTarget});
    const { result } = artifact;
    const productionTarget = path.resolve(target) === path.resolve('data/enhanced-macd/latest.json');
    if (result.complete || !productionTarget) {
      await writeAtomic(target, { ...artifact, result: { ...result, rows: undefined } });
    }
    if (archive) await writeAtomic(archive, { ...artifact, universe: universe.map(({ bars, ...stock }) => stock) });
    if (breadth) await writeAtomic(breadthTarget,breadth);
    console.log(JSON.stringify({
      date: artifact.date, complete: result.complete, universe: result.total,
      qualified: result.qualified.length, incomplete: result.incomplete, errors: result.errors
    }));
    if (!result.complete) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
