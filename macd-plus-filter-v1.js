/* 強化 MACD+ 策略核心引擎 (UMD: Browser + Node)
 * 規格：
 * - MACD (12, 26, 9) 在最新完成市場交易日剛黃金交叉（嚴格比較最近兩個市場交易日）
 * - 成交量 2,000 至 10,000 張（含上下限，1 張 = 1,000 股）
 * - 官方實收資本額 > 0 元且 < 50 億元（未取得或無效時 fail-closed 排除）
 * - 交易所未還原收盤價；標準取最近 100 根有效日 K（不補無收盤日）；新掛牌股至少 50 根且自掛牌日完整核對
 * - 新版 V9.23 篩選：排除生技醫療、金融保險、建材營造及非一般普通股商品
 * - MA20 取最近 20 根有效日 K；前 5 個交易日均量資料不足時量能項目計 0 分
 * - 排名權重：MACD 動能 35%｜月線趨勢 25%｜成交量增強 25%｜突破與追高風險 15%
 * - Top 8 供隔日到 5 個交易日研究參考（回測資料不足｜尚無可驗證的歷史報酬樣本）
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./enhanced-macd-v923.js') : root.ShitouEnhancedMacd);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShitouMacdPlusFilterV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Enhanced) {
  'use strict';

  const SCHEMA = 'shitou-macd-plus-v1';
  const MAX_CAPITAL_NTD = 5_000_000_000; // 50 億元（嚴格小於）
  const MIN_LOTS = 2000;
  const MAX_LOTS = 10000;
  const STANDARD_MIN_BARS = 100;
  const NEW_LISTING_MIN_BARS = 50;
  const MA20_PERIOD = 20;
  const PREV_VOL_DAYS = 5;
  const WEIGHTS = Object.freeze({
    macd: 0.35,
    ma20: 0.25,
    volume: 0.25,
    breakoutRisk: 0.15,
  });
  const EXCLUDED_INDUSTRY_CODES = new Set(['14', '17', '22']);
  const EXCLUDED_INDUSTRY_RX = /生技醫療|金融保險|建材營造/;

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function round(v, digits = 2) {
    if (!Number.isFinite(v)) return null;
    const f = 10 ** digits;
    return Math.round(v * f) / f;
  }

  function clamp(v, lo = 0, hi = 100) {
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function normalizeIsoDate(raw) {
    const s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const digits = s.replace(/[^\d]/g, '');
    if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    if (/^\d{7}$/.test(digits)) {
      const y = Number(digits.slice(0, 3)) + 1911;
      return `${String(y).padStart(4, '0')}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
    }
    return null;
  }

  function isExcludedUniverse(stockMeta) {
    const code = String(stockMeta?.code || stockMeta?.stock || '').trim();
    const industryCode = String(stockMeta?.industryCode || '').padStart(2, '0');
    if (stockMeta?.securityProduct === 'OTHER' || stockMeta?.isEtf === true || stockMeta?.isSpecialProduct === true || !/^[1-9]\d{3}$/.test(code)) return { excluded: true, reason: 'NON_COMMON_PRODUCT' };
    if (stockMeta?.securityProduct !== 'COMMON') return { excluded: true, reason: 'PRODUCT_UNVERIFIED' };
    if (EXCLUDED_INDUSTRY_CODES.has(industryCode) || EXCLUDED_INDUSTRY_RX.test(String(stockMeta?.industryName || stockMeta?.industry || ''))) return { excluded: true, reason: 'EXCLUDED_INDUSTRY' };
    return { excluded: false, reason: null };
  }

  function checkCapitalAndVolumePreFilter(quote, capitalEntry) {
    const uni = isExcludedUniverse(quote);
    if (uni.excluded) return { pass: false, reason: uni.reason };

    const capNtd = num(capitalEntry?.paidInCapitalNtd ?? quote?.paidInCapitalNtd);
    if (capNtd === null || capNtd <= 0) return { pass: false, reason: 'CAPITAL_UNAVAILABLE' };
    if (capNtd >= MAX_CAPITAL_NTD) return { pass: false, reason: 'CAPITAL_OVER_LIMIT' };

    const rawVol = num(quote?.volume);
    if (rawVol === null || rawVol <= 0) return { pass: false, reason: 'VOLUME_UNAVAILABLE' };
    const lots = rawVol / 1000;
    if (lots < MIN_LOTS || lots > MAX_LOTS) return { pass: false, reason: 'VOLUME_OUT_OF_RANGE' };

    return {
      pass: true,
      reason: null,
      paidInCapitalNtd: capNtd,
      paidInCapitalYi: round(capNtd / 1e8, 2),
      lots: round(lots, 1),
    };
  }

  // Standard EMA with SMA seed for the first `period` points
  function computeEmaSeries(values, period) {
    const out = new Array(values.length).fill(null);
    if (!Array.isArray(values) || values.length < period) return out;
    let sum = 0;
    for (let i = 0; i < period; i++) {
      if (!Number.isFinite(values[i])) return out;
      sum += values[i];
    }
    const k = 2 / (period + 1);
    let ema = sum / period;
    out[period - 1] = ema;
    for (let i = period; i < values.length; i++) {
      if (!Number.isFinite(values[i])) return out;
      ema = values[i] * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  // MACD (12, 26, 9)
  function computeMacd12269(closes) {
    if (!Array.isArray(closes) || closes.length < 34) return null;
    const ema12 = computeEmaSeries(closes, 12);
    const ema26 = computeEmaSeries(closes, 26);
    const dif = new Array(closes.length).fill(null);
    const validDif = [];
    const validDifIdx = [];
    for (let i = 0; i < closes.length; i++) {
      if (ema12[i] !== null && ema26[i] !== null) {
        const d = ema12[i] - ema26[i];
        dif[i] = d;
        validDif.push(d);
        validDifIdx.push(i);
      }
    }
    if (validDif.length < 9) return null;
    const deaCompact = computeEmaSeries(validDif, 9);
    const dea = new Array(closes.length).fill(null);
    const osc = new Array(closes.length).fill(null);
    for (let j = 0; j < validDif.length; j++) {
      const idx = validDifIdx[j];
      if (deaCompact[j] !== null) {
        dea[idx] = deaCompact[j];
        osc[idx] = dif[idx] - deaCompact[j];
      }
    }
    const lastIdx = closes.length - 1;
    const prevIdx = closes.length - 2;
    if (
      dif[lastIdx] === null ||
      dea[lastIdx] === null ||
      dif[prevIdx] === null ||
      dea[prevIdx] === null
    ) {
      return null;
    }
    return {
      dif,
      dea,
      osc,
      latest: {
        dif: dif[lastIdx],
        dea: dea[lastIdx],
        osc: osc[lastIdx],
      },
      prev: {
        dif: dif[prevIdx],
        dea: dea[prevIdx],
        osc: osc[prevIdx],
      },
    };
  }

  function extractValidBars(rawBars) {
    if (!Array.isArray(rawBars)) return [];
    const byDate = new Map();
    for (const b of rawBars) {
      const date = normalizeIsoDate(b?.date);
      const close = num(b?.close);
      if (!date || close === null || close <= 0) continue;
      // Verified no-close / synthetic placeholder rows must not be forward-filled
      if (b?.synthetic === true || b?.filled === true || b?.noClose === true) continue;
      const open = num(b?.open);
      const high = num(b?.high);
      const low = num(b?.low);
      const volume = num(b?.volume);
      byDate.set(date, {
        date,
        open: open !== null && open > 0 ? open : close,
        high: high !== null && high > 0 ? high : close,
        low: low !== null && low > 0 ? low : close,
        close,
        volume: volume !== null && volume >= 0 ? volume : 0,
      });
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function checkNewListingCoverage(validBars, listingDateIso, calendarDates, latestMarketDate) {
    if (!listingDateIso || !Array.isArray(calendarDates) || !calendarDates.length || !latestMarketDate) {
      return false;
    }
    const expected = calendarDates.filter((d) => d >= listingDateIso && d <= latestMarketDate);
    if (expected.length < NEW_LISTING_MIN_BARS) return false;
    // Allow complete verification from listing date (every market session since listing has a verified bar)
    const barDates = new Set(validBars.map((b) => b.date));
    let present = 0;
    for (const d of expected) {
      if (barDates.has(d)) present++;
    }
    return present === expected.length && validBars.length >= NEW_LISTING_MIN_BARS;
  }

  function scoreMacdMomentum(macd, close) {
    const currOsc = macd.latest.osc;
    const prevOsc = macd.prev.osc;
    const currDif = macd.latest.dif;
    const prevDif = macd.prev.dif;
    const currDea = macd.latest.dea;
    const prevDea = macd.prev.dea;

    // 1. Histogram acceleration normalized by price (%)
    const oscDeltaPct = ((currOsc - prevOsc) / close) * 100;
    const accelScore = clamp((oscDeltaPct / 0.85) * 45, 5, 45);

    // 2. Fresh cross strength above signal line normalized by price (%)
    const crossStrengthPct = (currOsc / close) * 100;
    const crossScore = clamp((crossStrengthPct / 0.45) * 20, 4, 20);

    // 3. Zero-axis position: crossing near/above zero is cleanest short-term momentum
    const difPct = (currDif / close) * 100;
    let axisScore = 16;
    if (difPct >= 0 && difPct <= 3.5) axisScore = 25;
    else if (difPct > 3.5) axisScore = clamp(25 - (difPct - 3.5) * 3, 12, 25);
    else if (difPct >= -2.0) axisScore = 22;
    else if (difPct >= -5.0) axisScore = 17;
    else axisScore = 12;

    // 4. DIF & DEA slope bonus
    const difUp = currDif > prevDif ? 6 : 0;
    const deaUp = currDea >= prevDea ? 4 : 1;

    return round(clamp(accelScore + crossScore + axisScore + difUp + deaUp, 0, 100), 1);
  }

  function scoreMa20Trend(validBars, ma20Now, ma20Prev5) {
    const close = validBars.at(-1).close;
    const biasPct = ((close - ma20Now) / ma20Now) * 100;

    // 1. Price vs MA20 (0..55)
    let posScore = 20;
    if (biasPct >= 0 && biasPct <= 6) {
      posScore = 55;
    } else if (biasPct > 6 && biasPct <= 12) {
      posScore = clamp(55 - (biasPct - 6) * 2.5, 38, 55);
    } else if (biasPct > 12) {
      posScore = clamp(38 - (biasPct - 12) * 2, 18, 38);
    } else if (biasPct >= -3) {
      posScore = clamp(42 + biasPct * 5, 25, 42);
    } else {
      posScore = clamp(25 + (biasPct + 3) * 3, 5, 25);
    }

    // 2. MA20 slope over 5 valid sessions (0..45)
    let slopeScore = 20;
    if (Number.isFinite(ma20Prev5) && ma20Prev5 > 0) {
      const slopePct = ((ma20Now - ma20Prev5) / ma20Prev5) * 100;
      if (slopePct >= 1.5) slopeScore = 45;
      else if (slopePct >= 0.3) slopeScore = 36 + ((slopePct - 0.3) / 1.2) * 9;
      else if (slopePct >= -0.3) slopeScore = 25 + ((slopePct + 0.3) / 0.6) * 11;
      else if (slopePct >= -2.0) slopeScore = clamp(25 + (slopePct + 0.3) * 8, 8, 25);
      else slopeScore = 6;
    }

    return {
      score: round(clamp(posScore + slopeScore, 0, 100), 1),
      biasPct: round(biasPct, 2),
      ma20SlopePct:
        Number.isFinite(ma20Prev5) && ma20Prev5 > 0 ? round(((ma20Now - ma20Prev5) / ma20Prev5) * 100, 2) : null,
    };
  }

  function scoreVolumeExpansion(latestVol, prev5Bars) {
    // Spec: 均量資料不足時量能項目計 0 分
    if (!Array.isArray(prev5Bars) || prev5Bars.length < PREV_VOL_DAYS) {
      return { score: 0, prev5AvgLots: null, volRatio5: null, insufficientPrev5Vol: true };
    }
    const vols = prev5Bars.map((b) => num(b?.volume));
    if (vols.some((v) => v === null || v <= 0)) {
      return { score: 0, prev5AvgLots: null, volRatio5: null, insufficientPrev5Vol: true };
    }
    const avgVol = vols.reduce((a, b) => a + b, 0) / PREV_VOL_DAYS;
    if (!(avgVol > 0)) {
      return { score: 0, prev5AvgLots: null, volRatio5: null, insufficientPrev5Vol: true };
    }
    const ratio = latestVol / avgVol;
    let score = 0;
    if (ratio >= 1.5 && ratio <= 2.6) {
      score = 88 + ((Math.min(ratio, 2.2) - 1.5) / 0.7) * 12;
    } else if (ratio > 2.6 && ratio <= 4.0) {
      score = clamp(92 - (ratio - 2.6) * 10, 72, 92);
    } else if (ratio > 4.0) {
      score = clamp(72 - (ratio - 4.0) * 6, 48, 72);
    } else if (ratio >= 1.1) {
      score = 62 + ((ratio - 1.1) / 0.4) * 26;
    } else if (ratio >= 0.8) {
      score = 38 + ((ratio - 0.8) / 0.3) * 24;
    } else {
      score = clamp(ratio * 45, 10, 38);
    }
    return {
      score: round(clamp(score, 0, 100), 1),
      prev5AvgLots: round(avgVol / 1000, 1),
      volRatio5: round(ratio, 2),
      insufficientPrev5Vol: false,
    };
  }

  function scoreBreakoutAndChaseRisk(validBars, ma20BiasPct) {
    const last = validBars.at(-1);
    const prev = validBars.at(-2);
    const pct = prev && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;

    // 1. Intraday close strength & upper-shadow check (0..40)
    const range = last.high - last.low;
    const closePos = range > 0 ? (last.close - last.low) / range : 0.65;
    const upperShadow = range > 0 ? (last.high - Math.max(last.open, last.close)) / range : 0;
    let candleScore = clamp(closePos * 40, 8, 40);
    if (upperShadow > 0.45) candleScore -= 12;

    // 2. 20-day high proximity / clean breakout (0..30)
    const recent20 = validBars.slice(-20);
    const prev19High = Math.max(...recent20.slice(0, -1).map((b) => b.high));
    const isBreakout20 = last.close > prev19High;
    const distHighPct = prev19High > 0 ? ((last.close - prev19High) / prev19High) * 100 : 0;
    let breakoutScore = 16;
    if (isBreakout20 && distHighPct <= 6) breakoutScore = 30;
    else if (isBreakout20) breakoutScore = 22;
    else if (distHighPct >= -5) breakoutScore = 25;
    else if (distHighPct >= -12) breakoutScore = 18;
    else breakoutScore = 11;

    // 3. Anti-chasing safety (0..30)
    let safetyScore = 30;
    if (pct >= 8.8) safetyScore -= 14;
    else if (pct >= 6.5) safetyScore -= 6;
    else if (pct < 0) safetyScore -= 8;

    if (ma20BiasPct > 14) safetyScore -= 14;
    else if (ma20BiasPct > 9) safetyScore -= 7;

    let riskLabel = '低';
    if (ma20BiasPct > 12 || pct >= 8.5 || upperShadow > 0.45) riskLabel = '高';
    else if (ma20BiasPct > 7 || pct >= 5.5 || upperShadow > 0.3) riskLabel = '中';

    return {
      score: round(clamp(candleScore + breakoutScore + clamp(safetyScore, 0, 30), 0, 100), 1),
      dailyPct: round(pct, 2),
      closePos: round(closePos, 2),
      isBreakout20,
      riskLabel,
    };
  }

  /**
   * Evaluate a single stock for 強化 MACD+
   * @param {object} input
   *   - quote: { code, name, market, close, volume, pct, industry, industryCode, industryName, fullDelivery, isSpecialProduct }
   *   - capital: { paidInCapitalNtd, listingDate }
   *   - dailySeries: array of verified exchange unadjusted daily bars [{ date, open, high, low, close, volume }]
   *   - marketCalendarDates: sorted ISO dates array of official completed market trading days
   */
  function evaluateMacdPlus(input) {
    const q = input?.quote || {}, cap = input?.capital || {};
    const sessions = [...new Set((input?.marketCalendarDates || []).map(normalizeIsoDate).filter(Boolean))].sort().slice(-Enhanced.HISTORY_SESSIONS);
    const identity = { code: String(q.code || ''), name: q.name || q.code, market: String(q.market).toUpperCase() === 'TPEX' ? 'TPEx' : 'TWSE', industry: q.industryName || q.industry || '' };
    const fail = (reason, detail, status = 'REJECTED') => ({ ...identity, eligible: false, rejectReason: reason, rejectDetail: detail, status });
    if (sessions.length < 2) return fail('CALENDAR_UNAVAILABLE', '缺少最近兩個市場交易日', 'DATA');
    const pre = checkCapitalAndVolumePreFilter(q, cap);
    if (!pre.pass) return fail(pre.reason, pre.reason, ['PRODUCT_UNVERIFIED','CAPITAL_UNAVAILABLE','VOLUME_UNAVAILABLE'].includes(pre.reason) ? 'DATA' : 'EXCLUDED');
    const byDate = new Map((input.dailySeries || []).filter(b => b.synthetic !== true && b.filled !== true && b.noClose !== true).map(b => [normalizeIsoDate(b.date), b]));
    const latest = byDate.get(sessions.at(-1));
    if (!latest || ['open','high','low','close','volume'].some(k => q[k] != null && Number(q[k]) !== latest[k])) return fail('DATA_UNAVAILABLE', '最新日 K 與同日市場快照不一致', 'DATA');
    const stock = { code: identity.code, name: identity.name, market: String(q.market).toUpperCase(), product: q.securityProduct, industry: String(q.industryCode || '').padStart(2, '0'), suspended: q.suspended === true,
      capital: cap.paidInCapitalNtd, companyDate: cap.companyDate, listingDate: cap.listingDate,
      quoteVolume: q.volume, bars: sessions.map(date => byDate.get(date) || null), historyGaps: input.historyGaps || [] };
    const row = Enhanced.evaluate(stock, sessions);
    if (!row.qualifiesA) return fail(row.status === 'DATA' ? 'DATA_UNAVAILABLE' : row.status === 'EXCLUDED' ? 'EXCLUDED_INDUSTRY' : 'NO_FRESH_GOLDEN_CROSS', row.reason || '未同時通過新版三條件', row.status);
    return convertEnhancedCandidate(row, identity.industry, sessions.at(-2));
  }

  function convertEnhancedCandidate(row, industry = '', previousDate = null) {
    if (row?.qualifiesA !== true || !Number.isFinite(row.score?.total) || ['cross','volume','capital'].some(key => row.gates?.[key] !== true)) throw Error('新版候選尚未通過三條件');
    const identity = { code: row.code, name: row.name, market: String(row.market).toUpperCase() === 'TPEX' ? 'TPEx' : 'TWSE', industry };
    const score = row.score.total;
    return { ...identity, eligible: true, rejectReason: null, status: row.status,
      tradeDate: row.date, prevTradeDate: previousDate, close: row.close, pct: row.change, lots: row.volume / 1000, volumeShares: row.volume,
      paidInCapitalNtd: row.capital, paidInCapitalYi: round(row.capital / 1e8, 2), barsUsed: row.historyBars, isNewListingEligible: row.historyBars < Enhanced.WINDOW,
      macd: { dif: row.macd.dif, dea: row.macd.signal, osc: row.macd.histogram, prevDif: row.previousMacd.dif, prevDea: row.previousMacd.signal, prevOsc: row.previousMacd.histogram },
      ma20: round(row.ma20, 2), ma20BiasPct: round(row.gap, 2), ma20SlopePct: round(row.slope, 2), prev5AvgLots: row.averageVolume === null ? null : round(row.averageVolume / 1000, 1),
      volRatio5: row.volumeRatio === null ? null : round(row.volumeRatio, 2), insufficientPrev5Vol: row.volumeRatio === null,
      isBreakout20: row.close > row.priorHigh, riskLabel: row.riskFlags.length >= 3 ? '高' : row.riskFlags.length ? '中' : '低',
      scores: { macd: row.score.momentum, ma20: row.score.trend, volume: row.score.volume, breakoutRisk: row.score.breakout }, weights: WEIGHTS, totalScore: score,
      grade: score >= 80 ? 'S' : score >= 65 ? 'A' : 'B', summary: row.axis + '｜' + (row.riskFlags.join('、') || '目前未觸發新版風險警示'), enhancedResult: row };
  }

  function rankMacdPlusCandidates(candidates, topLimit = 8) {
    const valid = (Array.isArray(candidates) ? candidates : []).filter((c) => c && c.eligible);
    valid.sort((a, b) => b.totalScore - a.totalScore || String(a.code).localeCompare(String(b.code), 'en') || String(a.market).localeCompare(String(b.market), 'en'));
    return {
      all: valid,
      top: valid.slice(0, topLimit),
    };
  }

  // Render clean 1284px-wide KACHI x GOLD (勝色金箔風格) Top 8 PNG report
  function renderMacdPlusInfographicCanvas(report) {
    if (typeof document === 'undefined') return null;
    const items = Array.isArray(report?.top) ? report.top.slice(0, 8) : [];
    const W = 1284;
    const cardH = 228;
    const headerH = 390;
    const footerH = 190;
    const listH = items.length ? items.length * (cardH + 22) : 220;
    const H = Math.max(1180, headerH + listH + footerH);

    const canvas = document.createElement('canvas');
    canvas.dataset.kachiNative = '1';
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Kachi Indigo primary background (#12162E -> #0D1024)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#161B38');
    bgGrad.addColorStop(0.5, '#12162E');
    bgGrad.addColorStop(1, '#0D1024');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle champagne gold top glow
    const glow = ctx.createRadialGradient(W * 0.5, 0, 40, W * 0.5, 0, 740);
    glow.addColorStop(0, 'rgba(201, 162, 63, 0.20)');
    glow.addColorStop(1, 'rgba(201, 162, 63, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 520);

    // Subtle outer gold hairline frame
    ctx.strokeStyle = 'rgba(201, 162, 63, 0.36)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const M = 56;
    // Header
    ctx.fillStyle = '#E8CC7D';
    ctx.font = '700 28px "Noto Serif TC", "Noto Sans TC", "Microsoft JhengHei", serif';
    ctx.fillText('石頭少爺Agent V9.30｜強化 MACD+ 獨立策略', M, 76);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 54px "Noto Serif TC", "Noto Sans TC", "Microsoft JhengHei", serif';
    ctx.fillText('強化 MACD+｜Top 8 候選排行', M, 150);

    ctx.fillStyle = '#DCE0EA';
    ctx.font = '600 26px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.fillText(
      `行情基準 ${report?.tradeDate || '—'}｜符合 ${report?.totalQualified ?? items.length} 檔（全市場核對 ${report?.totalUniverse ?? '—'} 檔）`,
      M,
      202
    );

    // Criteria pills strip
    roundRect(M, 230, W - M * 2, 118, 18);
    ctx.fillStyle = 'rgba(24, 29, 59, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 162, 63, 0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 24px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.fillText('入選口徑：MACD(12,26,9) 剛黃金交叉｜成交量 2,000～10,000 張｜官方股本 < 50 億元', M + 26, 276);
    ctx.fillStyle = '#DCE0EA';
    ctx.font = '500 22px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.fillText('權重：MACD 動能 35%｜月線趨勢 25%｜成交量增強 25%｜突破與追高風險 15%（隔日～5日參考）', M + 26, 320);

    let y = headerH;
    if (!items.length) {
      roundRect(M, y, W - M * 2, 160, 20);
      ctx.fillStyle = 'rgba(24, 29, 59, 0.94)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(201, 162, 63, 0.36)';
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 32px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.fillText('本交易日無同時符合 MACD 剛金叉、量 2,000～10,000 張與股本 < 50 億之標的', M + 32, y + 92);
    } else {
      items.forEach((item, idx) => {
        roundRect(M, y, W - M * 2, cardH, 20);
        ctx.fillStyle = 'rgba(24, 29, 59, 0.96)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(201, 162, 63, 0.34)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Grade accent bar on left (Wa-Gold / Champagne / Jade)
        const accent = item.grade === 'S' ? '#F6E2A1' : item.grade === 'A' ? '#C9A23F' : '#4FE0A8';
        roundRect(M, y, 12, cardH, 6);
        ctx.fillStyle = accent;
        ctx.fill();

        // Rank & Stock Name (pure crisp white)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 38px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(`#${idx + 1}  ${item.code} ${item.name}`, M + 36, y + 58);

        // Industry + Market tag
        ctx.fillStyle = '#DCE0EA';
        ctx.font = '600 24px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(
          `${item.market === 'TPEx' ? '上櫃' : '上市'}${item.industry ? `・${item.industry}` : ''}｜股本 ${item.paidInCapitalYi} 億`,
          M + 36,
          y + 98
        );

        // Score badge on right (restrained gold accent)
        roundRect(W - M - 210, y + 22, 184, 78, 14);
        ctx.fillStyle = item.grade === 'B' ? 'rgba(79, 224, 168, 0.14)' : 'rgba(201, 162, 63, 0.18)';
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.font = '800 38px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.grade}｜${item.totalScore}`, W - M - 118, y + 74);
        ctx.textAlign = 'left';

        // Key Metrics Row 1
        const pctStr = `${item.pct >= 0 ? '+' : ''}${item.pct}%`;
        ctx.fillStyle = item.pct >= 0 ? '#FF7588' : '#4FE0A8';
        ctx.font = '700 27px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(`收盤 ${item.close} 元（${pctStr}）`, M + 36, y + 148);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 25px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        const volText = item.insufficientPrev5Vol
          ? `量 ${item.lots} 張（前5日均量不足）`
          : `量 ${item.lots} 張（5日量比 ${item.volRatio5}x）`;
        ctx.fillText(`${volText}｜MA20 ${item.ma20}（${item.ma20BiasPct >= 0 ? '+' : ''}${item.ma20BiasPct}%）`, M + 380, y + 148);

        // Row 2: MACD + 4-Factor Subscores (bright white-silver for max legibility)
        ctx.fillStyle = '#E8ECF5';
        ctx.font = '600 21px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(
          `MACD 金叉：DIF ${item.macd.dif} / DEA ${item.macd.dea} / OSC +${item.macd.osc}  ｜  動能 ${item.scores.macd}・月線 ${item.scores.ma20}・量能 ${item.scores.volume}・風險 ${item.scores.breakoutRisk}（追高：${item.riskLabel}）`,
          M + 36,
          y + 194,
          W - M * 2 - 64
        );

        y += cardH + 22;
      });
    }

    // Footer disclaimer
    ctx.fillStyle = '#F6E2A1';
    ctx.font = '700 23px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.fillText('⚠️ 回測資料不足｜尚無可驗證的歷史報酬樣本。除權息或拆併股可能影響訊號。', M, H - 102);

    ctx.fillStyle = '#DCE0EA';
    ctx.font = '500 21px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.fillText('資料口徑：交易所未還原官方收盤價與官方實收資本額；僅供隔日到 5 個交易日研究參考，不構成投資建議。', M, H - 56);

    return canvas;
  }

  return Object.freeze({
    SCHEMA,
    MAX_CAPITAL_NTD,
    MIN_LOTS,
    MAX_LOTS,
    STANDARD_MIN_BARS,
    NEW_LISTING_MIN_BARS,
    WEIGHTS,
    isExcludedUniverse,
    checkCapitalAndVolumePreFilter,
    computeEmaSeries,
    computeMacd12269,
    extractValidBars,
    evaluateMacdPlus,
    convertEnhancedCandidate,
    rankMacdPlusCandidates,
    renderMacdPlusInfographicCanvas,
  });
});
