#!/usr/bin/env node
// 石頭少爺 Agent V50｜DATASYNC.1-CLOSE.1｜官方臨時休市保護修正版
// 修正：交易日判斷改讀 TWSE 官方開休市日曆；休市日保留最近完成交易日，不再把星期一～五一律視為必須有當日行情。
// 若官方日曆暫時抓取失敗，2026 年使用已核對的官方休市日備援；其他年份維持保守拒絕，不補造行情。
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {updateScanExclusions} from './update-scan-exclusions.mjs';

const ROOT = process.cwd();
const LATEST_PATH = path.join(ROOT, 'data/market/latest.json');
const ARCHIVE_DIR = path.join(ROOT, 'data/market/archive');
const MAX_ARCHIVES = 30;

// The annual TWSE holiday API does not necessarily include an emergency
// closure announced on the preceding day. Keep manually verified exceptions
// separate from scheduled holidays; NEVER infer a closure from missing quotes.
// A repository maintainer must add each new exceptional closure with an
// independently verifiable TWSE/TPEx announcement URL.
const EMERGENCY_CLOSURES_PATH = fileURLToPath(new URL('../config/verified-market-closures.json', import.meta.url));
function readVerifiedEmergencyClosures() {
  const entries = JSON.parse(readFileSync(EMERGENCY_CLOSURES_PATH, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Verified emergency market closures must be a JSON array');
  const dates = new Map();
  for (const entry of entries) {
    const date = String(entry?.date || '');
    const name = String(entry?.name || '').trim();
    const source = String(entry?.source || '').trim();
    const iso = /^\d{8}$/.test(date) ? `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}` : '';
    const validDate = !!iso && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) &&
      new Date(`${iso}T00:00:00Z`).toISOString().slice(0,10) === iso;
    if (!validDate || !name || !/^https:\/\//i.test(source) || dates.has(date)) {
      throw new Error(`Invalid/duplicate verified emergency closure: ${date || '(empty)'}`);
    }
    dates.set(date, Object.freeze({ date, name, source }));
  }
  return dates;
}
const VERIFIED_EMERGENCY_CLOSURES = readVerifiedEmergencyClosures();

export const SOURCES = Object.freeze({
  twseQuotes: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
  twseQuotesByDateBase: 'https://www.twse.com.tw/exchangeReport/MI_INDEX',
  tpexQuotes: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes',
  tpexQuotesByDateBase: 'https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes',
  twseCompanies: 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L',
  tpexCompanies: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O',
  twseHolidaySchedule: 'https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule'
});

const TAIWAN_INDUSTRY_NAME_MAP = Object.freeze({
  '01':'水泥工業','02':'食品工業','03':'塑膠工業','04':'紡織纖維','05':'電機機械',
  '06':'電器電纜','08':'玻璃陶瓷','09':'造紙工業','10':'鋼鐵工業','11':'橡膠工業',
  '12':'汽車工業','14':'建材營造','15':'航運業','16':'觀光餐旅','17':'金融保險',
  '18':'貿易百貨','20':'其他','21':'化學工業','22':'生技醫療','23':'油電燃氣',
  '24':'半導體業','25':'電腦及週邊設備業','26':'光電業','27':'通信網路業','28':'電子零組件業',
  '29':'電子通路業','30':'資訊服務業','31':'其他電子業','32':'文化創意業','33':'農業科技業',
  '34':'電子商務','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活'
});

function firstAny(row, keys) {
  for (const key of keys) {
    const v = row?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/[＋+]/g, '')
    .replace(/[－−]/g, '-')
    .replace(/[%％]/g, '')
    .trim();
  if (!cleaned || cleaned === '--' || cleaned === '---' || /^N\/?A$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const f = 10 ** digits;
  return Math.round(Number(value) * f) / f;
}

export function normalizeMarketDate(value) {
  const s = String(value ?? '').replace(/[^\d]/g, '').trim();
  if (/^\d{7}$/.test(s)) {
    const year = Number(s.slice(0, 3)) + 1911;
    return `${String(year).padStart(4, '0')}${s.slice(3)}`;
  }
  if (/^\d{8}$/.test(s)) return s;
  return null;
}

export function latestMarketQuoteDate(rows) {
  const counts = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const raw = r?.Date ?? r?.date ?? r?.日期 ?? r?.TradeDate ?? r?.TradingDate ?? r?.['交易日期'] ?? '';
    const d = normalizeMarketDate(raw);
    if (!d) continue;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  if (!counts.size) return null;
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || b[0].localeCompare(a[0]))[0][0];
}

function isOrdinaryCode(code) {
  return /^[1-9]\d{3}$/.test(String(code || '').trim());
}

function normalizeIndustry(raw) {
  const text = String(raw || '').trim();
  let code = '';
  const m = text.match(/(?:^|\D)(\d{2})(?:\D|$)/);
  if (m && TAIWAN_INDUSTRY_NAME_MAP[m[1]]) code = m[1];
  if (!code) {
    for (const [k, name] of Object.entries(TAIWAN_INDUSTRY_NAME_MAP)) {
      if (text.includes(name)) { code = k; break; }
    }
  }
  return {
    industryCode: code,
    industryName: code ? TAIWAN_INDUSTRY_NAME_MAP[code] : text,
    industryRaw: text
  };
}

export function buildIndustryMap(rows, market) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = String(firstAny(row, [
      '公司代號','CompanyCode','SecuritiesCompanyCode','SecuritiesCode','Code','股票代號','證券代號'
    ]) || '').trim();
    if (!isOrdinaryCode(code)) continue;
    const values = [];
    for (const [k, v] of Object.entries(row || {})) {
      if (/產業|industry/i.test(k) && v !== null && v !== undefined && String(v).trim()) values.push(String(v).trim());
    }
    const ind = normalizeIndustry(values.join('｜'));
    map.set(code, { market, ...ind });
  }
  return map;
}

export function normalizeQuote(row, market, tradeDate, industryMap) {
  const code = String(firstAny(row, [
    'Code','SecuritiesCompanyCode','SecuritiesCode','CompanyCode','股票代號','證券代號','代號'
  ]) || '').trim();
  if (!/^\d{4}$/.test(code)) return null;

  const name = String(firstAny(row, [
    'Name','CompanyName','SecuritiesCompanyName','公司名稱','證券名稱','名稱','公司簡稱'
  ]) || '').trim();

  const close = num(firstAny(row, ['ClosingPrice','Close','ClosePrice','LatestPrice','收盤價','成交價','收盤']));
  const open = num(firstAny(row, ['OpeningPrice','Open','OpenPrice','開盤價','開盤']));
  const high = num(firstAny(row, ['HighestPrice','High','HighPrice','最高價','最高']));
  const low = num(firstAny(row, ['LowestPrice','Low','LowPrice','最低價','最低']));
  const volume = num(firstAny(row, ['TradeVolume','TradingShares','TradingVolume','Volume','成交股數','成交量']));
  const rawTradeValue = num(firstAny(row, ['TradeValue','TransactionAmount','TradingAmount','成交金額']));
  const change = num(firstAny(row, ['Change','ChangeAmount','PriceChange','漲跌價差','漲跌']));

  if (![open, high, low, close].every(v => Number.isFinite(v) && v > 0)) return null;
  if (!(high >= low && high >= open && high >= close && low <= open && low <= close)) return null;

  let pct = null;
  if (close !== null && change !== null) {
    const prev = close - change;
    if (prev > 0) pct = change / prev * 100;
  }
  const closePos = high > low ? (close - low) / (high - low) : null;
  const tradeValue = rawTradeValue !== null && rawTradeValue > 0
    ? rawTradeValue
    : (volume !== null && close !== null ? volume * close : null);

  const industry = industryMap?.get(code) || { industryCode:'', industryName:'', industryRaw:'' };
  return {
    code,
    name,
    market,
    quoteDate: tradeDate,
    close: round(close, 4),
    open: round(open, 4),
    high: round(high, 4),
    low: round(low, 4),
    volume: volume === null ? null : Math.round(volume),
    tradeValue: tradeValue === null ? null : Math.round(tradeValue),
    officialTradeValue: rawTradeValue !== null && rawTradeValue > 0 ? Math.round(rawTradeValue) : null,
    estimatedTradeValue: volume !== null && close !== null ? Math.round(volume * close) : null,
    tradeValueSource: rawTradeValue !== null && rawTradeValue > 0 ? 'OFFICIAL_REPORTED' : 'ESTIMATED_CLOSE_X_VOLUME',
    researchSchemaVersion: 'V8.1',
    change: round(change, 4),
    pct: round(pct, 4),
    closePos: round(closePos, 6),
    industry: industry.industryName || '',
    industryCode: industry.industryCode || '',
    industryName: industry.industryName || '',
    industryRaw: industry.industryRaw || ''
  };
}

export async function fetchJsonArray(url, label, retries = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      // Timeout covers both connection and response-body download.
      const freshUrl = new URL(url); freshUrl.searchParams.set('_shitou_update', `${Date.now()}_${attempt}`);
      const res = await fetch(freshUrl.toString(), { method:'GET', signal: controller.signal, redirect:'follow', cache:'no-store', headers:{Accept:'application/json','Cache-Control':'no-cache'} });
      const finalUrl = res.url || url;
      const contentType = String(res.headers.get('content-type') || '');
      const text = await res.text();
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}｜${finalUrl}`);
      if (/\/errors(?:[/?#]|$)/i.test(finalUrl)) throw new Error(`${label} 被導向 /errors｜${finalUrl}`);
      if (/text\/html|application\/xhtml/i.test(contentType) || text.trim().startsWith('<')) {
        throw new Error(`${label} 回傳 HTML 而非 JSON｜${finalUrl}`);
      }
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error(`${label} JSON 非陣列`);
      return { rows:data, finalUrl, status:res.status, contentType, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`${label} 取得失敗`);
}

export async function fetchJsonValue(url, label, retries = 5) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      // Timeout covers both connection and response-body download.
      const freshUrl = new URL(url); freshUrl.searchParams.set('_shitou_update', `${Date.now()}_${attempt}`);
      const res = await fetch(freshUrl.toString(), { method:'GET', signal: controller.signal, redirect:'follow', cache:'no-store', headers:{Accept:'application/json','Cache-Control':'no-cache'} });
      const finalUrl = res.url || url;
      const contentType = String(res.headers.get('content-type') || '');
      const text = await res.text();
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}｜${finalUrl}`);
      if (/\/errors(?:[/?#]|$)/i.test(finalUrl)) throw new Error(`${label} 被導向 /errors｜${finalUrl}`);
      if (/text\/html|application\/xhtml/i.test(contentType) || text.trim().startsWith('<')) {
        throw new Error(`${label} 回傳 HTML 而非 JSON｜${finalUrl}`);
      }
      const data = JSON.parse(text);

      return { data, finalUrl, status:res.status, contentType, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`${label} 取得失敗`);
}

function signedTwseChange(row) {
  const raw = num(row?.['漲跌價差']);
  if (raw === null) return null;
  const sign = String(row?.['漲跌(+/-)'] ?? row?.['漲跌(+／-)'] ?? row?.['漲跌'] ?? '').trim();
  if (sign.includes('-') || sign.includes('－') || sign.includes('−')) return -Math.abs(raw);
  if (sign.includes('+') || sign.includes('＋')) return Math.abs(raw);
  return raw;
}

function makeObjectsFromFields(fields, data, tradeDate) {
  if (!Array.isArray(fields) || !Array.isArray(data)) return [];
  const fieldNames = fields.map(x => String(x ?? '').trim());
  const joined = fieldNames.join('|');
  if (!/證券代號/.test(joined) || !/收盤價/.test(joined) || !/開盤價/.test(joined) || !/最高價/.test(joined) || !/最低價/.test(joined)) return [];
  return data.map(values => {
    if (!Array.isArray(values)) return null;
    const row = { Date:tradeDate };
    for (let i=0;i<fieldNames.length;i++) row[fieldNames[i]] = values[i];
    const signed = signedTwseChange(row);
    if (signed !== null) row.Change = signed;
    return row;
  }).filter(Boolean);
}

export function extractTwseMiIndexRows(payload, targetDate) {
  const candidates = [];
  if (!payload || typeof payload !== 'object') return candidates;
  // DATASYNC.1: requested date is not proof of the returned data date.
  if (normalizeMarketDate(payload.date) !== targetDate) return candidates;

  // Newer TWSE JSON shape: tables:[{title,fields,data}, ...]
  if (Array.isArray(payload.tables)) {
    for (const table of payload.tables) {
      const rows = makeObjectsFromFields(table?.fields, table?.data, targetDate);
      if (rows.length) candidates.push(rows);
    }
  }

  // Legacy TWSE JSON shape: fields8/data8, fields9/data9, etc.
  for (const [key, fields] of Object.entries(payload)) {
    const m = key.match(/^fields(\d*)$/i);
    if (!m) continue;
    const suffix = m[1] || '';
    const data = payload[`data${suffix}`];
    const rows = makeObjectsFromFields(fields, data, targetDate);
    if (rows.length) candidates.push(rows);
  }

  // Some responses expose one direct fields/data table.
  const direct = makeObjectsFromFields(payload.fields, payload.data, targetDate);
  if (direct.length) candidates.push(direct);

  if (!candidates.length) return [];
  return candidates.sort((a,b) => b.length-a.length)[0];
}

function twseMiIndexUrl(date) {
  const u = new URL(SOURCES.twseQuotesByDateBase);
  u.searchParams.set('response','json');
  u.searchParams.set('date',date);
  u.searchParams.set('type','ALLBUT0999');
  return u.toString();
}

async function fetchTwseQuotesByDate(date) {
  const url = twseMiIndexUrl(date);
  const res = await fetchJsonValue(url, `TWSE MI_INDEX ${date}`);
  const rows = extractTwseMiIndexRows(res.data, date);
  if (rows.length < 800) {
    const stat = String(res.data?.stat || res.data?.status || '').trim();
    throw new Error(`TWSE 指定日 ${date} 行情解析不足：${rows.length} 筆${stat ? `｜stat ${stat}` : ''}`);
  }
  return { rows, finalUrl:res.finalUrl, status:res.status, contentType:res.contentType, attempt:res.attempt, source:'MI_INDEX_BY_DATE' };
}

function slashDate(date) {
  return /^\d{8}$/.test(String(date || ''))
    ? `${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`
    : '';
}

function tpexDailyQuotesUrl(date) {
  const u = new URL(SOURCES.tpexQuotesByDateBase);
  u.searchParams.set('date', slashDate(date));
  u.searchParams.set('type', 'EW');
  u.searchParams.set('response', 'json');
  return u.toString();
}

export function extractTpexDailyQuoteRows(payload, targetDate) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.tables)) return [];
  const payloadDate = normalizeMarketDate(payload.date);
  if (!payloadDate || payloadDate !== targetDate) return [];
  const candidates = [];
  for (const table of payload.tables) {
    const fields = Array.isArray(table?.fields) ? table.fields.map(x => String(x ?? '').trim()) : [];
    const data = Array.isArray(table?.data) ? table.data : [];
    const joined = fields.join('|');
    if (!/代號/.test(joined) || !/收盤/.test(joined) || !/開盤/.test(joined) || !/最高/.test(joined) || !/最低/.test(joined) || !/成交股數/.test(joined)) continue;
    const rows = data.map(values => {
      if (!Array.isArray(values)) return null;
      const row = { Date:targetDate };
      for (let i=0;i<fields.length;i++) row[fields[i]] = values[i];
      return row;
    }).filter(Boolean);
    if (rows.length) candidates.push(rows);
  }
  if (!candidates.length) return [];
  return candidates.sort((a,b) => b.length-a.length)[0];
}

async function fetchTpexQuotesByDate(date) {
  const url = tpexDailyQuotesUrl(date);
  const res = await fetchJsonValue(url, `TPEx dailyQuotes ${date}`);
  const stat = String(res.data?.stat || res.data?.status || '').trim();
  if (stat && !/^ok$/i.test(stat)) throw new Error(`TPEx 指定日 ${date} 尚無完整行情｜stat ${stat}`);
  const rows = extractTpexDailyQuoteRows(res.data, date);
  if (rows.length < 600) throw new Error(`TPEx 指定日 ${date} 行情解析不足：${rows.length} 筆${stat ? `｜stat ${stat}` : ''}`);
  return { rows, finalUrl:res.finalUrl, status:res.status, contentType:res.contentType, attempt:res.attempt, source:'TPEX_DAILY_QUOTES_BY_DATE' };
}

const FALLBACK_TWSE_CLOSED_2026 = Object.freeze({
  '20260101':'中華民國開國紀念日','20260212':'市場無交易','20260213':'市場無交易',
  '20260216':'農曆春節','20260217':'農曆春節','20260218':'農曆春節','20260219':'農曆春節','20260220':'農曆春節',
  '20260227':'和平紀念日補假','20260403':'兒童節補假','20260406':'清明節補假','20260501':'勞動節',
  '20260619':'端午節','20260925':'中秋節','20260928':'教師節','20261009':'國慶日補假',
  '20261026':'臺灣光復暨金門古寧頭大捷紀念日補假','20261225':'行憲紀念日'
});
export function buildTwseMarketCalendar(rows, source=SOURCES.twseHolidaySchedule) {
  const closures=[], specialTradingDates=[];
  for (const row of Array.isArray(rows)?rows:[]) {
    const date=normalizeMarketDate(row?.Date ?? row?.date); if(!date) continue;
    const name=String(row?.Name ?? row?.name ?? '').trim();
    const description=String(row?.Description ?? row?.description ?? '').replace(/<br\s*\/?\s*>/gi,' ').trim();
    const explicitTrading=/開始交易日|最後交易日|補行交易/.test(name) && !/無交易|休市/.test(name);
    if(explicitTrading) specialTradingDates.push({date,name,description});
    else closures.push({date,name:name||'官方休市日',description});
  }
  const officialReady=closures.length>0;
  // Retain the announced emergency closures in the published metadata, too.
  for (const entry of VERIFIED_EMERGENCY_CLOSURES.values()) {
    const existing=closures.find(x=>x.date===entry.date);
    if (existing) { existing.source=entry.source; continue; }
    closures.push({...entry,description:'經交易所公開公告確認之臨時休市'});
  }
  return {ready:officialReady,source,closures,specialTradingDates};
}
export function marketCalendarClosure(calendar,date) {
  const d=normalizeMarketDate(date); if(!d) return null;
  const hit=(Array.isArray(calendar?.closures)?calendar.closures:[]).find(x=>normalizeMarketDate(x?.date)===d);
  if(hit) return {date:d,name:String(hit.name||'官方休市日'),source:hit.source||calendar?.source||SOURCES.twseHolidaySchedule};
  const emergency=VERIFIED_EMERGENCY_CLOSURES.get(d);
  if(emergency) return {...emergency};
  const fallback=FALLBACK_TWSE_CLOSED_2026[d];
  return fallback?{date:d,name:fallback,source:'TWSE 2026 官方休市日備援'}:null;
}

export function taipeiMarketClock(now = new Date(), calendar = null) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(now);
  const get = type => String(parts.find(p => p.type === type)?.value || '');
  const today = `${get('year')}${get('month')}${get('day')}`;
  const weekday = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`).getUTCDay();
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const closure=marketCalendarClosure(calendar,today);
  const isWeekend=weekday===0||weekday===6;
  return { today, weekday, minutes, officialClosure:closure, marketClosed:isWeekend||!!closure,
    weekdayTradingCandidate:weekday >= 1 && weekday <= 5 && !closure, afterCutoff:minutes >= 17 * 60 + 35 };
}

export function expectedCompletedDate(calendar=null, now=new Date()) {
  const clock=taipeiMarketClock(now,calendar);
  const start=new Date(`${clock.today.slice(0,4)}-${clock.today.slice(4,6)}-${clock.today.slice(6,8)}T00:00:00Z`);
  for(let back=0;back<=30;back++){
    if(back===0&&!clock.afterCutoff)continue;
    const dt=new Date(+start-back*86400000),day=dt.getUTCDay(),date=dt.toISOString().slice(0,10).replace(/-/g,'');
    const special=(calendar?.specialTradingDates||[]).some(x=>normalizeMarketDate(x.date)===date);
    if(special||day!==0&&day!==6&&!marketCalendarClosure(calendar,date))return date;
  }
  throw Error('無法驗證最近完成交易日');
}

export async function reconcileLatestTradeDate(twseQuotes, tpexQuotes, options = {}) {
  let twse = twseQuotes;
  let tpex = tpexQuotes;
  let twseDate = latestMarketQuoteDate(twse.rows);
  let tpexDate = latestMarketQuoteDate(tpex.rows);
  const events = [];
  const fetchTwseByDate = options.fetchTwseByDate || fetchTwseQuotesByDate;
  const fetchTpexByDate = options.fetchTpexByDate || fetchTpexQuotesByDate;
  const clock = taipeiMarketClock(options.now || new Date(), options.calendar || null);
  if (!twseDate || !tpexDate) return { twse, tpex, twseDate, tpexDate, events, clock };

  // 先處理兩市場 latest 來源彼此不同日。
  if (twseDate < tpexDate) {
    events.push(`TWSE latest ${twseDate} 落後 TPEx ${tpexDate}，改查 TWSE 指定日 ${tpexDate}`);
    const upgraded = await fetchTwseByDate(tpexDate);
    const upgradedDate = latestMarketQuoteDate(upgraded.rows);
    if (upgradedDate === tpexDate) { twse = upgraded; twseDate = upgradedDate; events.push(`TWSE 指定日校正成功：${twseDate}`); }
    else events.push(`TWSE 指定日校正未對齊：${upgradedDate || '未知'}`);
  } else if (tpexDate < twseDate) {
    events.push(`TPEx latest ${tpexDate} 落後 TWSE ${twseDate}，改查 TPEx 指定日 ${twseDate}`);
    const upgraded = await fetchTpexByDate(twseDate);
    const upgradedDate = latestMarketQuoteDate(upgraded.rows);
    if (upgradedDate === twseDate) { tpex = upgraded; tpexDate = upgradedDate; events.push(`TPEx 指定日校正成功：${tpexDate}`); }
    else events.push(`TPEx 指定日校正未對齊：${upgradedDate || '未知'}`);
  }

  // R4.7 核心：兩邊 latest 可能「一起」停在昨天。平日盤後不可因為兩邊相等就誤認完整。
  // 主動查今天的官方指定日資料；只有 TWSE + TPEx 都完整且同日，才一起升級。
  const expected=expectedCompletedDate(options.calendar||null,options.now||new Date());
  if (twseDate === tpexDate && twseDate < expected) {
    events.push(`兩市場 latest 同停 ${twseDate}，台灣 ${clock.today} 已過 17:35；主動補查今天 TWSE＋TPEx 指定日行情`);
    const [twseToday, tpexToday] = await Promise.all([fetchTwseByDate(expected), fetchTpexByDate(expected)]);
    const twseTodayDate = latestMarketQuoteDate(twseToday.rows);
    const tpexTodayDate = latestMarketQuoteDate(tpexToday.rows);
    if (twseTodayDate !== expected || tpexTodayDate !== expected) {
      throw new Error(`今天指定日補抓未對齊｜TWSE ${twseTodayDate || '未知'}｜TPEx ${tpexTodayDate || '未知'}｜目標 ${clock.today}`);
    }
    twse = twseToday;
    tpex = tpexToday;
    twseDate = twseTodayDate;
    tpexDate = tpexTodayDate;
    events.push(`雙市場今天指定日補抓成功：${clock.today}`);
  }

  return { twse, tpex, twseDate, tpexDate, events, clock };
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isoDate(ymd) {
  return /^\d{8}$/.test(ymd || '') ? `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}` : null;
}

async function readJsonIfExists(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

// Validate a persisted snapshot before reusing it on a confirmed closed day.
// Do not mistake a JSON file with only a date label for genuine complete quotes.
export function verifyMarketSnapshotCoverage(snapshot) {
  const tradeDate=normalizeMarketDate(snapshot?.tradeDate);
  const counts=snapshot?.counts;
  if (!tradeDate || snapshot?.marketCoverageReady!==true || !counts ||
      !Number.isInteger(counts.twseRows) || counts.twseRows<800 ||
      !Number.isInteger(counts.tpexRows) || counts.tpexRows<600 ||
      !Array.isArray(snapshot.rows) ||
      snapshot.rows.length!==counts.totalRows ||
      counts.totalRows!==counts.twseRows+counts.tpexRows) {
    throw new Error('Snapshot market coverage incomplete; cannot reuse or publish');
  }
  let twseCount=0, tpexCount=0;
  for (const quote of snapshot.rows) {
    if (!isOrdinaryCode(quote?.code) || normalizeMarketDate(quote?.quoteDate)!==tradeDate) {
      throw new Error(`Persisted stock quote date/code invalid: ${quote?.code||'unknown'}`);
    }
    if (quote.market==='TWSE') twseCount++;
    else if (quote.market==='TPEX') tpexCount++;
    else throw new Error(`Unknown quote market: ${quote?.market}`);
  }
  if (twseCount!==counts.twseRows || tpexCount!==counts.tpexRows) {
    throw new Error('Persisted market counts do not agree with stock rows');
  }
  return {tradeDate,twseRows:twseCount,tpexRows:tpexCount};
}

// 防止 GitHub Actions「執行成功」卻只把上週五資料重新標為今天產出的檔案。
// 沒有交易所休市日行事曆時採保守拒絕；不會補造不存在的當日成交資料。
export function verifySnapshotAdvancement(snapshot, previous, now = new Date()) {
  const date = normalizeMarketDate(snapshot?.tradeDate);
  const old = normalizeMarketDate(previous?.tradeDate);
  if (!date) throw new Error('盤後快照缺少有效交易日；拒絕發布');
  if (old && date < old) throw new Error(`資料來源交易日倒退：新的 ${date} 早於現有 ${old}；保留上一份快照`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(now);
  const get = type => String(parts.find(p => p.type === type)?.value || '');
  const today = `${get('year')}${get('month')}${get('day')}`;
  const weekday = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`).getUTCDay();
  const afterCutoff = Number(get('hour')) * 60 + Number(get('minute')) >= 17 * 60 + 35;
  const closure=marketCalendarClosure(snapshot?.marketCalendar,today);
  if (date > today) throw new Error(`來源交易日 ${date} 晚於台灣今天 ${today}；拒絕發布`);
  if (date === today && !afterCutoff) throw new Error(`台灣 ${today} 尚未達 17:35 盤後保守發布時段；拒絕發布`);
  const expected=expectedCompletedDate(snapshot?.marketCalendar,now);
  if(date!==expected)throw new Error(`快照 ${date} 並非最近已完成交易日 ${expected}；保留上一份快照，稍後重試`);

  return { tradeDate:date, expectedTradeDate:expected, taipeiToday:today, priorDate:old, changed:date!==old, marketClosed:!!closure, marketClosureName:closure?.name||null };
}

async function cleanupArchives() {
  await fs.mkdir(ARCHIVE_DIR, { recursive:true });
  const names = (await fs.readdir(ARCHIVE_DIR)).filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
  const remove = names.slice(0, Math.max(0, names.length - MAX_ARCHIVES));
  await Promise.all(remove.map(name => fs.unlink(path.join(ARCHIVE_DIR, name))));
}

// 不能用全市場「多數日期」取代每一檔的原始日期；避免少數前一日行情被重新貼上今日標籤。
export function assertSourceQuoteDates(rows, market, targetDate) {
  let checked = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = String(firstAny(row, [
      'Code','SecuritiesCompanyCode','SecuritiesCode','CompanyCode','股票代號','證券代號','代號'
    ]) ?? '').trim();
    if (!isOrdinaryCode(code)) continue;
    const rawDate = row?.Date ?? row?.date ?? row?.日期 ?? row?.TradeDate ?? row?.TradingDate ?? row?.['交易日期'];
    const date = normalizeMarketDate(rawDate);
    if (!date || date !== targetDate) {
      throw new Error(`${market} 官方逐檔日期驗證失敗｜${code}｜來源 ${date || '缺少日期'}｜目標 ${targetDate}；不發布混日快照`);
    }
    checked++;
  }
  return checked;
}

export async function buildSnapshot({twseQuoteRows,tpexQuoteRows,twseCompanyRows,tpexCompanyRows,sourceMeta={},marketCalendar=null}) {
  const twseDate = latestMarketQuoteDate(twseQuoteRows);
  const tpexDate = latestMarketQuoteDate(tpexQuoteRows);
  if (!twseDate || !tpexDate) throw new Error(`市場日期無法判斷｜TWSE ${twseDate || '未知'}｜TPEx ${tpexDate || '未知'}`);
  if (twseDate !== tpexDate) throw new Error(`兩市場最新完成交易日不同｜TWSE ${twseDate}｜TPEx ${tpexDate}｜保留上一份完整快照`);
  assertSourceQuoteDates(twseQuoteRows, 'TWSE', twseDate);
  assertSourceQuoteDates(tpexQuoteRows, 'TPEx', tpexDate);

  if (twseQuoteRows.length < 800) throw new Error(`TWSE 原始行情筆數不足：${twseQuoteRows.length}`);
  if (tpexQuoteRows.length < 300) throw new Error(`TPEx 原始行情筆數不足：${tpexQuoteRows.length}`);
  if (twseCompanyRows.length < 700) throw new Error(`TWSE 公司清單筆數不足：${twseCompanyRows.length}`);
  if (tpexCompanyRows.length < 300) throw new Error(`TPEx 公司清單筆數不足：${tpexCompanyRows.length}`);

  const twseIndustry = buildIndustryMap(twseCompanyRows, 'TWSE');
  const tpexIndustry = buildIndustryMap(tpexCompanyRows, 'TPEX');
  const tpexOrdinary = new Set([...tpexIndustry.keys()]);

  const twse = twseQuoteRows
    .map(r => normalizeQuote(r, 'TWSE', twseDate, twseIndustry))
    .filter(r => r && isOrdinaryCode(r.code));
  const tpex = tpexQuoteRows
    .map(r => normalizeQuote(r, 'TPEX', tpexDate, tpexIndustry))
    .filter(r => r && isOrdinaryCode(r.code) && (tpexOrdinary.size < 300 || tpexOrdinary.has(r.code)));

  if (twse.length < 800) throw new Error(`TWSE 清洗後一般個股不足：${twse.length}`);
  if (tpex.length < 600) throw new Error(`TPEx 清洗後一般個股不足：${tpex.length}`);

  const rows = [...twse, ...tpex].sort((a,b) => a.code.localeCompare(b.code, 'zh-TW', {numeric:true}));
  const core = {
    schemaVersion: 1,
    tradeDate: twseDate,
    tradeDateIso: isoDate(twseDate),
    marketCoverageReady: true,
    marketCalendar: marketCalendar?.ready?marketCalendar:null,
    rows,
    counts: {
      twseRawQuotes: twseQuoteRows.length,
      tpexRawQuotes: tpexQuoteRows.length,
      twseRows: twse.length,
      tpexRows: tpex.length,
      totalRows: rows.length,
      twseCompanies: twseCompanyRows.length,
      tpexCompanies: tpexCompanyRows.length,
      industryReadyRows: rows.filter(r => r.industryCode).length
    },
    officialSources: {
      twseQuotes: SOURCES.twseQuotes,
      twseQuotesByDateBase: SOURCES.twseQuotesByDateBase,
      tpexQuotes: SOURCES.tpexQuotes,
      tpexQuotesByDateBase: SOURCES.tpexQuotesByDateBase,
      twseCompanies: SOURCES.twseCompanies,
      tpexCompanies: SOURCES.tpexCompanies,
      twseHolidaySchedule: SOURCES.twseHolidaySchedule
    },
    sourceMeta
  };
  const contentSha256 = sha256Json(core);
  return {
    ...core,
    generatedAt: new Date().toISOString(),
    contentSha256,
    note: '由 GitHub Actions 直接抓取 TWSE＋TPEx 官方公開資料；只有兩市場同一交易日且完整時才更新 latest.json。'
  };
}

export async function main() {
  // When an already-published snapshot matches a confirmed closed-day
  // expectation, avoid pointless network requests and preserve its bytes.
  // This is ONLY safe after validating the previous snapshot's coverage.
  const now=new Date();
  const clock=taipeiMarketClock(now);
  const prior=await readJsonIfExists(LATEST_PATH);
  if (clock.marketClosed && prior) {
    try {
      verifyMarketSnapshotCoverage(prior);
      const audit=verifySnapshotAdvancement(prior,null,now);
      console.log(`CONFIRMED_MARKET_CLOSED: ${clock.today}｜${clock.officialClosure?.name || '週末'}｜保留已驗證 ${audit.tradeDate} 行情，不覆蓋也不補造`);
      return;
    } catch (error) {
      console.log(`Existing snapshot not reusable: ${error?.message||error}. Re-fetching official data.`);
    }
  }
  if (clock.officialClosure) {
    console.log(`CONFIRMED_MARKET_CLOSED: ${clock.today}｜${clock.officialClosure.name}｜來源 ${clock.officialClosure.source}`);
  }
  console.log('Fetching official TWSE / TPEx market snapshot...');
  const [twseLatest,tpexQuotes,twseCompanies,tpexCompanies] = await Promise.all([
    fetchJsonArray(SOURCES.twseQuotes, 'TWSE STOCK_DAY_ALL'),
    fetchJsonArray(SOURCES.tpexQuotes, 'TPEx daily_close_quotes'),
    fetchJsonArray(SOURCES.twseCompanies, 'TWSE company list'),
    fetchJsonArray(SOURCES.tpexCompanies, 'TPEx company list')
  ]);
  let marketCalendar={ready:false,source:SOURCES.twseHolidaySchedule,closures:[],specialTradingDates:[]};
  try {
    const holiday=await fetchJsonArray(SOURCES.twseHolidaySchedule,'TWSE holiday schedule');
    marketCalendar=buildTwseMarketCalendar(holiday.rows,SOURCES.twseHolidaySchedule);
    console.log(`TWSE market calendar: closures ${marketCalendar.closures.length}｜special trading dates ${marketCalendar.specialTradingDates.length}`);
  } catch (error) {
    console.warn(`TWSE market calendar unavailable; 2026 fallback only｜${error?.message||error}`);
  }

  const initialTwseDate = latestMarketQuoteDate(twseLatest.rows);
  const initialTpexDate = latestMarketQuoteDate(tpexQuotes.rows);
  console.log(`Latest source dates: TWSE ${initialTwseDate || 'unknown'}｜TPEx ${initialTpexDate || 'unknown'}`);

  let reconciled;
  try {
    reconciled = await reconcileLatestTradeDate(twseLatest, tpexQuotes, {calendar:marketCalendar});
  } catch (error) {
    throw new Error(`完成交易日校正失敗｜TWSE ${initialTwseDate || '未知'}｜TPEx ${initialTpexDate || '未知'}｜${error?.message || error}`);
  }
  for (const line of reconciled.events) console.log(`Trade-date reconciliation: ${line}`);

  const finalTwseDate = latestMarketQuoteDate(reconciled.twse.rows);
  const finalTpexDate = latestMarketQuoteDate(reconciled.tpex.rows);
  if (!finalTwseDate || !finalTpexDate) {
    throw new Error(`市場日期無法判斷｜TWSE ${finalTwseDate || '未知'}｜TPEx ${finalTpexDate || '未知'}`);
  }
  if (finalTwseDate !== finalTpexDate) {
    throw new Error(`兩市場最新完成交易日仍不同｜TWSE ${finalTwseDate}｜TPEx ${finalTpexDate}｜不覆蓋上一份完整快照`);
  }

  const snapshot = await buildSnapshot({
    marketCalendar,
    twseQuoteRows: reconciled.twse.rows,
    tpexQuoteRows: reconciled.tpex.rows,
    twseCompanyRows: twseCompanies.rows,
    tpexCompanyRows: tpexCompanies.rows,
    sourceMeta: {
      twseQuotes: {
        status:reconciled.twse.status,
        finalUrl:reconciled.twse.finalUrl,
        attempt:reconciled.twse.attempt,
        source:reconciled.twse.source || 'STOCK_DAY_ALL',
        initialDate:initialTwseDate,
        finalDate:finalTwseDate
      },
      tpexQuotes: {
        status:reconciled.tpex.status,
        finalUrl:reconciled.tpex.finalUrl,
        attempt:reconciled.tpex.attempt,
        source:reconciled.tpex.source || 'tpex_mainboard_daily_close_quotes',
        initialDate:initialTpexDate,
        finalDate:finalTpexDate
      },
      twseCompanies: { status:twseCompanies.status, finalUrl:twseCompanies.finalUrl, attempt:twseCompanies.attempt },
      tpexCompanies: { status:tpexCompanies.status, finalUrl:tpexCompanies.finalUrl, attempt:tpexCompanies.attempt },
      reconciliation: reconciled.events
    }
  });

  const previous = await readJsonIfExists(LATEST_PATH);
  verifySnapshotAdvancement(snapshot, previous);
  try {
    snapshot.exclusionStatus = await updateScanExclusions(snapshot.tradeDate,ROOT);
  } catch (error) {
    const previousExclusionDate = String(previous?.exclusionStatus?.date || '').replace(/\D/g,'');
    if (previousExclusionDate === snapshot.tradeDate) snapshot.exclusionStatus = previous.exclusionStatus;
    console.warn(`EXCLUSION_SYNC_DEFERRED: ${error?.message || error}`);
  }
  const exclusionIdentity = value => value ? JSON.stringify([value.date,value.twseCodes,value.tpexCodes,value.specialCodes]) : null;
  if (previous?.contentSha256 === snapshot.contentSha256 && exclusionIdentity(previous?.exclusionStatus) === exclusionIdentity(snapshot.exclusionStatus)) {
    console.log(`No content change. Current complete trade date remains ${snapshot.tradeDate}.`);
    return;
  }

  await fs.mkdir(path.dirname(LATEST_PATH), { recursive:true });
  await fs.mkdir(ARCHIVE_DIR, { recursive:true });
  const payload = JSON.stringify(snapshot);
  await fs.writeFile(LATEST_PATH, payload + '\n', 'utf8');
  await fs.writeFile(path.join(ARCHIVE_DIR, `${snapshot.tradeDateIso}.json`), payload + '\n', 'utf8');
  await cleanupArchives();
  console.log(`Updated complete market snapshot: ${snapshot.tradeDate}｜TWSE ${snapshot.counts.twseRows}｜TPEx ${snapshot.counts.tpexRows}｜total ${snapshot.counts.totalRows}`);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch(error => {
    console.error(`SNAPSHOT_UPDATE_FAILED: ${error?.stack || error}`);
    process.exitCode = 1;
  });
}
