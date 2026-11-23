import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import Core from '../enhanced-macd-v923.js';
import { sourceUrl as archiveSource } from './build-official-research-history.mjs';
import {
  SOURCES, normalizeMarketDate, extractTwseMiIndexRows, extractTpexDailyQuoteRows, normalizeQuote
} from './update-market-snapshot.mjs';

const markets = ['TWSE', 'TPEX'];
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = /^[a-f\d]{64}$/;
const compact = date => date.replaceAll('-', '');
const iso = raw => {
  const date = normalizeMarketDate(raw);
  return date && date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6);
};
const taipeiDay = now => new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(source, {
        redirect: 'manual', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) {
        const error = Error('官方資料 HTTP ' + response.status + ' ' + source);
        error.retryable = response.status >= 500 || [408, 429].includes(response.status);
        throw error;
      }
      if (response.url && response.url !== source) throw Error('官方資料網址不符 ' + source);
      const bytes = Buffer.from(await response.arrayBuffer());
      return { rows: JSON.parse(bytes), receipt: { source, sha256: sha(bytes), retrievedAt: new Date().toISOString() } };
    } catch (error) {
      if (attempt === 2 || !(error.retryable || ['TimeoutError', 'TypeError'].includes(error.name))) throw error;
      await delay(800 * (attempt + 1));
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
  if (!Array.isArray(rows) || taipeiDay(new Date(retrievedAt)) !== date) throw Error('官方停牌資料時間未對齊');
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

export async function collect(root, fetcher = fetch, now = new Date()) {
  const [calendar, snapshot] = await Promise.all([
    json(path.join(root, 'data/market/research-calendar.json')),
    json(path.join(root, 'data/market/latest.json'))
  ]);
  const date = snapshot.tradeDateIso;
  const sessions = calendar.dates?.slice(-Core.WINDOW) ?? [];
  const taipeiTime = new Date(now.getTime() + 8 * 3_600_000).toISOString();
  if (!Core.validDate(date) || snapshot.marketCoverageReady !== true || calendar.verified !== true ||
      calendar.source !== 'https://www.twse.com.tw/exchangeReport/FMTQIK' ||
      calendar.sourceSnapshotHash !== snapshot.contentSha256 ||
      calendar.sourceSnapshotDate !== date || sessions.at(-1) !== date ||
      date !== taipeiTime.slice(0, 10) || taipeiTime.slice(11, 16) < '17:35') {
    throw Error('等候同日 17:35 後已完成的上市櫃官方快照與交易日曆');
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
  for (const market of markets) {
    try {
      const { quotes, companies: companyFeed, status } = feeds[market];
      if (!quotes || !companyFeed || !status) continue;
      if ([quotes, companyFeed, status].some(feed => taipeiDay(new Date(feed.receipt.retrievedAt)) !== date)) {
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
  const result = Core.scan(universe, sessions, errors.sort());
  const historySources = markets.flatMap(market => [...histories[market].values()].map(({ rows, ...receipt }) => ({ ...receipt, market })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market));
  const generatedAt = new Date().toISOString();
  const artifact = {
    schema: 'ENHANCED_MACD_SCAN_V1', version: Core.VERSION, generatedAt, date,
    snapshotHash: snapshot.contentSha256, calendarSource: calendar.source, sessions,
    priceBasis: 'UNADJUSTED_OFFICIAL_OHLC', volumeUnit: 'shares', capitalUnit: 'NTD',
    sources: receipts.sort((a, b) => a.market.localeCompare(b.market) || a.dataset.localeCompare(b.dataset)),
    historySources, result
  };
  return { artifact, universe };
}

async function writeAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  await fs.writeFile(temp, JSON.stringify(data) + '\n');
  await fs.rename(temp, file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [target = 'data/enhanced-macd/latest.json', archive] = process.argv.slice(2);
  try {
    const { artifact, universe } = await collect(process.cwd());
    const { result } = artifact;
    await writeAtomic(target, { ...artifact, result: { ...result, rows: undefined } });
    if (archive) await writeAtomic(archive, { ...artifact, universe: universe.map(({ bars, ...stock }) => stock) });
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
