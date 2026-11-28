/* Strategy Enhancement Layer V1:
 * - Market Regime Filter (TAIEX MA20/MA60 + Market Breadth)
 * - Turnover-based Liquidity (NTD) & ATR risk sizing (prevents penalizing high-priced stocks)
 * - Transparent Multi-Factor Consensus Ranking (replaces ticker-code tie-breaking)
 * - Configurable Industry Inclusion (Financial / Biotech toggles)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShitouStrategyEnhanceV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'STRATEGY_ENHANCE_V1.0';
  const TRADE_COST_ROUNDTRIP_PCT = (0.001425 * 2 + 0.003 + 0.001) * 100; // ~0.685% Taiwan round-trip cost + slippage

  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(typeof v === 'string' ? v.replace(/,/g, '') : v);
    return Number.isFinite(n) ? n : null;
  };

  function sma(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) return null;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i++) {
      const v = num(values[i]);
      if (v === null) return null;
      sum += v;
    }
    return sum / period;
  }

  function median(values) {
    const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!clean.length) return null;
    const mid = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
  }

  function computeAtr14(bars) {
    if (!Array.isArray(bars) || bars.length < 15) return null;
    const trs = [];
    for (let i = bars.length - 14; i < bars.length; i++) {
      const cur = bars[i], prev = bars[i - 1];
      const h = num(cur?.high), l = num(cur?.low), pc = num(prev?.close);
      if (h === null || l === null || pc === null) return null;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }

  function formatTurnover(ntd) {
    const v = num(ntd);
    if (v === null || v <= 0) return '—';
    if (v >= 1e8) return (v / 1e8).toFixed(2) + ' 億';
    if (v >= 1e4) return Math.round(v / 1e4).toLocaleString('zh-TW') + ' 萬';
    return Math.round(v).toLocaleString('zh-TW') + ' 元';
  }

  function isExcludedIndustry(row, opts = {}) {
    const code = String(row?.industryCode ?? '').trim();
    const name = String(row?.industryName || row?.industry || '').trim();
    const isFinancial = code === '17' || /金融|銀行|保險|證券|金控/.test(name);
    const isBiotech = code === '22' || /生技|醫療|製藥|藥品|生物科技|醫材/.test(name);
    if (isFinancial && !opts.includeFinancial) return { excluded: true, kind: 'FINANCIAL' };
    if (isBiotech && !opts.includeBiotech) return { excluded: true, kind: 'BIOTECH' };
    return { excluded: false, kind: isFinancial ? 'FINANCIAL' : isBiotech ? 'BIOTECH' : 'NORMAL' };
  }

  function evaluateMarketRegime(taiexDoc, marketDoc) {
    const series = Array.isArray(taiexDoc?.dailySeries) ? taiexDoc.dailySeries : [];
    const closes = series.map((b) => num(b?.close)).filter((v) => v !== null);
    const latestBar = series.at(-1) || null;
    const prevBar = series.length >= 2 ? series.at(-2) : null;
    const close = num(taiexDoc?.close) ?? num(latestBar?.close);
    const prevClose = num(prevBar?.close);
    const taiexPct = close !== null && prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : null;
    const ma5 = sma(closes, 5);
    const ma20 = sma(closes, 20);
    const ma20Prev = closes.length >= 23 ? sma(closes.slice(0, -3), 20) : null;
    const ma60 = sma(closes, 60);
    const ma20SlopePct = ma20 && ma20Prev > 0 ? ((ma20 - ma20Prev) / ma20Prev) * 100 : null;
    const gap20Pct = close !== null && ma20 > 0 ? ((close - ma20) / ma20) * 100 : null;

    const rows = Array.isArray(marketDoc?.rows) ? marketDoc.rows : [];
    let advancers = 0, decliners = 0, unchanged = 0, strongUp = 0, strongDown = 0;
    const pcts = [];
    for (const r of rows) {
      const p = num(r?.pct);
      if (p === null) continue;
      pcts.push(p);
      if (p > 0.0001) advancers++;
      else if (p < -0.0001) decliners++;
      else unchanged++;
      if (p >= 3) strongUp++;
      if (p <= -3) strongDown++;
    }
    const active = advancers + decliners;
    const breadthRatio = active > 0 ? advancers / active : null;
    const medianPct = median(pcts);

    const aboveMa20 = close !== null && ma20 !== null ? close >= ma20 : null;
    const ma20Rising = ma20SlopePct !== null ? ma20SlopePct >= 0 : null;
    const aboveMa60 = close !== null && ma60 !== null ? close >= ma60 : null;

    let code = 'NEUTRAL_SELECTIVE';
    let label = '震盪輪動';
    let tone = 'neutral';
    let positionHint = '中性倉位（精選強勢領漲與健康回踩，控管追高乖離）';

    const bullPoints =
      (aboveMa20 === true ? 1 : 0) +
      (ma20Rising === true ? 1 : 0) +
      (aboveMa60 === true ? 1 : 0) +
      (breadthRatio !== null && breadthRatio >= 0.52 ? 1 : 0);
    const bearPoints =
      (aboveMa20 === false ? 1 : 0) +
      (ma20Rising === false ? 1 : 0) +
      (aboveMa60 === false ? 1 : 0) +
      (breadthRatio !== null && breadthRatio <= 0.42 ? 1 : 0);

    if (bullPoints >= 3 && aboveMa20 !== false) {
      code = 'BULL_TAILWIND';
      label = '順風偏多';
      tone = 'bull';
      positionHint = '順風格局（可積極關注突破發動與主升延續，仍須守好失效防守線）';
    } else if (bearPoints >= 3 || (aboveMa20 === false && breadthRatio !== null && breadthRatio < 0.45)) {
      code = 'BEAR_DEFENSIVE';
      label = '偏空防守';
      tone = 'bear';
      positionHint = '逆風防守（降低部位、避免追高突破，優先看量縮回踩支撐與防守價）';
    }

    return {
      version: VERSION,
      code,
      label,
      tone,
      positionHint,
      snapshotDate: marketDoc?.tradeDateIso || null,
      taiexDate: taiexDoc?.closeDate || latestBar?.date || null,
      taiexClose: close,
      taiexPct,
      ma5,
      ma20,
      ma60,
      gap20Pct,
      ma20SlopePct,
      totalStocks: rows.length,
      advancers,
      decliners,
      unchanged,
      strongUp,
      strongDown,
      breadthRatio,
      medianPct,
    };
  }

  function evaluateLiquidity(quote, bars) {
    const tradeValue =
      num(quote?.officialTradeValue) ??
      num(quote?.tradeValue) ??
      (num(quote?.close) && num(quote?.volume) ? num(quote.close) * num(quote.volume) : null);

    let avgTurnover5d = null;
    if (Array.isArray(bars) && bars.length >= 5) {
      const vals = bars.slice(-5).map((b) => {
        const c = num(b?.close), v = num(b?.volume);
        return c > 0 && v >= 0 ? c * v : null;
      });
      if (vals.every((x) => x !== null)) avgTurnover5d = vals.reduce((a, b) => a + b, 0) / 5;
    }
    const effectiveTurnover = avgTurnover5d ?? tradeValue;
    let tier = 'UNKNOWN';
    let label = '待確認';
    if (effectiveTurnover !== null) {
      if (effectiveTurnover >= 1e8) {
        tier = 'HIGH';
        label = '高流動性（≥1億）';
      } else if (effectiveTurnover >= 3e7) {
        tier = 'MEDIUM';
        label = '中流動性（3千萬～1億）';
      } else if (effectiveTurnover >= 1e7) {
        tier = 'FAIR';
        label = '基本流動性（1千萬～3千萬）';
      } else {
        tier = 'LOW';
        label = '低流動性（<1千萬，注意滑價）';
      }
    }
    return {
      todayTurnoverNtd: tradeValue,
      avgTurnover5dNtd: avgTurnover5d,
      effectiveTurnoverNtd: effectiveTurnover,
      formattedToday: formatTurnover(tradeValue),
      formattedAvg5d: formatTurnover(avgTurnover5d),
      tier,
      label,
      passesStandard: effectiveTurnover !== null && effectiveTurnover >= 1e7,
    };
  }

  function scoreAndRankCandidates(rows, options = {}) {
    const {
      minTurnoverNtd = 3e7,
      includeFinancial = false,
      includeBiotech = false,
      mode = 'BALANCED', // 'BALANCED' | 'MOMENTUM' | 'PULLBACK_SAFE'
      limit = 25,
      regime = null,
    } = options;

    if (!Array.isArray(rows) || !rows.length) {
      return { totalScanned: 0, passedCount: 0, mode, candidates: [], sectorMedians: {} };
    }

    const allPcts = rows.map((r) => num(r?.pct)).filter((v) => v !== null);
    const marketMedian = median(allPcts) ?? 0;

    const bySector = new Map();
    for (const r of rows) {
      const sec = String(r?.industryName || r?.industry || '其他').trim();
      const p = num(r?.pct);
      if (p === null) continue;
      if (!bySector.has(sec)) bySector.set(sec, []);
      bySector.get(sec).push(p);
    }
    const sectorMedians = {};
    for (const [sec, arr] of bySector.entries()) sectorMedians[sec] = median(arr) ?? marketMedian;

    const candidates = [];
    for (const r of rows) {
      const close = num(r?.close), open = num(r?.open), high = num(r?.high), low = num(r?.low);
      const pct = num(r?.pct);
      const volume = num(r?.volume);
      if (!(close > 0 && high > 0 && low > 0 && pct !== null && volume > 0)) continue;

      const indCheck = isExcludedIndustry(r, { includeFinancial, includeBiotech });
      if (indCheck.excluded) continue;

      const liq = evaluateLiquidity(r, null);
      if (liq.effectiveTurnoverNtd === null || liq.effectiveTurnoverNtd < minTurnoverNtd) continue;

      const closePos = num(r?.closePos) ?? (high > low ? (close - low) / (high - low) : 0.5);
      const rangePct = low > 0 ? ((high - low) / low) * 100 : 0;
      const bodyPct = open > 0 ? ((close - open) / open) * 100 : 0;
      const sector = String(r?.industryName || r?.industry || '其他').trim();
      const sectorMed = sectorMedians[sector] ?? marketMedian;
      const rsMarket = pct - marketMedian;
      const rsSector = pct - sectorMed;

      // Mode-specific entry filter
      if (mode === 'MOMENTUM') {
        if (pct < 2.0 || closePos < 0.65 || close < open) continue;
      } else if (mode === 'PULLBACK_SAFE') {
        if (pct < 0.5 || pct > 5.0 || closePos < 0.55 || close < open) continue;
      } else {
        // BALANCED: positive relative strength, healthy close, avoid extreme upper wick
        if (pct < 1.0 || pct > 9.5 || closePos < 0.55 || close < open) continue;
      }

      const signals = [];
      let score = 0;

      // 1. Relative strength vs market & sector
      if (rsMarket >= 2.0) { score += 22; signals.push('強於大盤'); }
      else if (rsMarket >= 0.8) { score += 14; signals.push('優於大盤'); }
      if (rsSector >= 1.5) { score += 16; signals.push('產業領漲'); }
      else if (rsSector >= 0.5) { score += 8; }

      // 2. Candle / close quality
      if (closePos >= 0.8) { score += 20; signals.push('收在最高區'); }
      else if (closePos >= 0.65) { score += 13; signals.push('收盤偏強'); }
      else { score += 5; }
      if (bodyPct >= 1.5 && bodyPct <= 6.5) { score += 12; signals.push('實體紅K健康'); }
      else if (bodyPct > 0) { score += 6; }

      // 3. Turnover liquidity (NTD-based, never penalizes high-price stocks)
      if (liq.effectiveTurnoverNtd >= 3e8) { score += 20; signals.push('主力大額流動性'); }
      else if (liq.effectiveTurnoverNtd >= 1e8) { score += 15; signals.push('億元流動性'); }
      else { score += 9; signals.push('達標流動性'); }

      // 4. Risk / chasing control
      const risks = [];
      if (pct >= 8.5) { score -= 12; risks.push('單日漲幅偏大注意追高'); }
      if (rangePct >= 8.0 && closePos < 0.65) { score -= 10; risks.push('振幅偏大上影壓力'); }
      if (regime?.code === 'BEAR_DEFENSIVE' && pct >= 6.0) { score -= 8; risks.push('大盤偏空不宜重倉追價'); }

      // Indicative structural levels from current bar (research reference)
      const triggerRef = Number(high.toFixed(2));
      const stopRef = Number(low.toFixed(2));
      const riskPct = close > 0 ? ((close - stopRef) / close) * 100 : null;

      candidates.push({
        code: String(r.code),
        name: String(r.name || r.code),
        market: String(r.market || ''),
        industry: sector,
        close,
        pct: Number(pct.toFixed(2)),
        closePos: Number(closePos.toFixed(2)),
        turnoverNtd: liq.effectiveTurnoverNtd,
        turnoverLabel: liq.formattedToday,
        rsMarket: Number(rsMarket.toFixed(2)),
        rsSector: Number(rsSector.toFixed(2)),
        consensusCount: signals.length,
        signals,
        risks,
        score: Math.max(0, Math.min(100, Math.round(score))),
        triggerRef,
        stopRef,
        riskPct: riskPct !== null ? Number(riskPct.toFixed(2)) : null,
      });
    }

    // Transparent multi-factor ranking: higher score -> fewer risks -> stronger RS -> higher turnover -> never ticker code first
    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        a.risks.length - b.risks.length ||
        b.rsMarket - a.rsMarket ||
        b.turnoverNtd - a.turnoverNtd ||
        a.code.localeCompare(b.code)
    );

    return {
      version: VERSION,
      totalScanned: rows.length,
      passedCount: candidates.length,
      mode,
      marketMedianPct: Number(marketMedian.toFixed(2)),
      candidates: candidates.slice(0, limit),
      sectorMedians,
    };
  }

  function buildExecutiveSummary(quote, bars, regime) {
    const close = num(quote?.close) ?? num(bars?.at(-1)?.close);
    const pct = num(quote?.pct);
    const liq = evaluateLiquidity(quote, bars);
    const atr14 = computeAtr14(bars);
    const closes = Array.isArray(bars) ? bars.map((b) => num(b?.close)).filter((v) => v !== null) : [];
    const ma5 = sma(closes, 5);
    const ma20 = sma(closes, 20);
    const ma60 = sma(closes, 60);

    const prior20 = Array.isArray(bars) && bars.length >= 21 ? bars.slice(-21, -1) : [];
    const prior20High = prior20.length ? Math.max(...prior20.map((b) => num(b?.high) ?? 0)) : null;
    const prior20Low = prior20.length ? Math.min(...prior20.map((b) => num(b?.low) ?? Infinity)) : null;

    const triggerPrice = prior20High && prior20High > 0 ? prior20High : num(quote?.high);
    const stopCandidates = [ma20, prior20Low, num(quote?.low)].filter((v) => v !== null && v > 0 && close !== null && v < close);
    const invalidationPrice = stopCandidates.length ? Math.max(...stopCandidates) : (prior20Low || num(quote?.low));

    const riskPct = close > 0 && invalidationPrice > 0 && invalidationPrice < close
      ? ((close - invalidationPrice) / close) * 100
      : null;

    const target2Atr = close > 0 && atr14 > 0 ? close + atr14 * 2 : null;
    const netRewardPct = target2Atr && close > 0 ? ((target2Atr - close) / close) * 100 - TRADE_COST_ROUNDTRIP_PCT : null;
    const rrEstimate = riskPct > 0.3 && netRewardPct > 0 ? netRewardPct / riskPct : null;
    const gap20Pct = close > 0 && ma20 > 0 ? ((close - ma20) / ma20) * 100 : null;

    const checks = [
      { key: 'TREND', label: '站上20MA', pass: close !== null && ma20 !== null ? close >= ma20 : null },
      { key: 'MID_TREND', label: '20MA>60MA', pass: ma20 !== null && ma60 !== null ? ma20 > ma60 : null },
      { key: 'LIQUIDITY', label: '成交金額達標', pass: liq.passesStandard },
      { key: 'CLOSE_STRENGTH', label: '收盤偏強', pass: num(quote?.closePos) !== null ? num(quote.closePos) >= 0.6 : null },
      { key: 'NOT_OVERHEATED', label: '未過度追高', pass: gap20Pct !== null ? gap20Pct <= 12 : (pct !== null ? pct < 8.5 : null) },
      { key: 'REGIME', label: '大盤順風', pass: regime ? regime.code !== 'BEAR_DEFENSIVE' : null },
    ];
    const verifiedChecks = checks.filter((c) => c.pass !== null);
    const passedChecks = verifiedChecks.filter((c) => c.pass === true);

    let headline = '觀察整理';
    let tone = 'neutral';
    if (gap20Pct !== null && gap20Pct > 15) {
      headline = '短線乖離偏高（警戒追價）';
      tone = 'warn';
    } else if (close !== null && prior20High && close > prior20High && liq.passesStandard) {
      headline = '突破前20日高點（強勢發動）';
      tone = 'bull';
    } else if (passedChecks.length >= 4 && verifiedChecks.length >= 5) {
      headline = '多頭結構健康（偏多觀察）';
      tone = 'bull';
    } else if (close !== null && ma20 !== null && close < ma20) {
      headline = '位於20MA下方（防守觀望）';
      tone = 'bear';
    }

    return {
      version: VERSION,
      code: String(quote?.code || ''),
      name: String(quote?.name || quote?.code || ''),
      industry: String(quote?.industryName || quote?.industry || '—'),
      market: String(quote?.market || ''),
      close,
      pct,
      liquidity: liq,
      ma5,
      ma20,
      ma60,
      atr14,
      gap20Pct,
      triggerPrice,
      invalidationPrice,
      riskPct,
      rrEstimate,
      checks,
      passedCount: passedChecks.length,
      verifiedCount: verifiedChecks.length,
      headline,
      tone,
    };
  }

  return Object.freeze({
    VERSION,
    TRADE_COST_ROUNDTRIP_PCT,
    formatTurnover,
    isExcludedIndustry,
    evaluateMarketRegime,
    evaluateLiquidity,
    scoreAndRankCandidates,
    buildExecutiveSummary,
  });
});
