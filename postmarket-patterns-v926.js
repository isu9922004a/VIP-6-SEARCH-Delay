/* Independent post-close research. It shares price primitives, never strategy gates. */
(function(root, factory) {
  const common = typeof module === 'object' && module.exports ? require('./research-common-v1.js') : root.ShitouResearchCommon;
  const api = factory(common);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShitouPostmarketPatterns926 = api;
})(globalThis, function(U) {
'use strict';

const PARAMETERS = Object.freeze({
  version: 'V9.26-RESEARCH-2',
  doji: .10, wick: .50, surgeDoji: .15, surgeDojiOpen: .005, surgeBody: .65, surgeReturn: .07,
  highZone: .98, heavyVolume: 1.5, smallMoveAtr: .35, distanceAtr: 2, slowEfficiency: .65,
  stallLookback: 10, stallHighDays: 4, stallRecent: 3, stallRange: .65, stallVolume: .85, stallShadowPenalty: 5,
  nextHorizon: 5, breakoutWindow: 5, breakoutBufferAtr: .10, breakoutLookbacks: Object.freeze([5, 10, 20]),
  fvgScanSessions: 10, fvgExpiry: 8, fvgStopPct: .005, fvgStopAtr: .1,
  indexSelloff: -.01, relativeNear: .01, relativeStrong: .03, atrPeriod: 14,
  historyLimit: 160, minTrend: 36
});
const P = PARAMETERS;
const round = (value, places = 8) => Number(value.toFixed(places));
const high = bars => Math.max(...bars.map(x => x.high));
const low = bars => Math.min(...bars.map(x => x.low));
const prior = (bars, index, width) => bars.slice(Math.max(0, index - width), index);
const enough = (bars, width) => bars.length >= width;
const unavailable = (...missingFields) => ({status:'DATA_INSUFFICIENT',missingFields});
const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
  && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
const timestamp = x => typeof x === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x) ? Date.parse(x) : NaN;
const taipeiDate = time => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
const orderedDates = dates => Array.isArray(dates)&&dates.every((d,i)=>validDate(d)&&(!i||d>dates[i-1]));

function extendTradingCalendar(history,schedule,analysisDate,dataAsOf) {
  const dates=history?.dates, published=timestamp(schedule?.generatedAt);
  if (!validDate(analysisDate) || history?.verified!==true || !orderedDates(dates) || dates.at(-1)!==analysisDate ||
      schedule?.verified!==true || schedule.source!=='https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule' ||
      !/^[a-f0-9]{64}$/.test(schedule.sourceSha256 ?? '') || !orderedDates(schedule.dates) ||
      schedule.coverageYear!==analysisDate.slice(0,4) ||
      !(published<=Math.min(timestamp(dataAsOf),Date.parse(analysisDate+'T23:59:59.999+08:00')))) return history;
  const aligned=schedule.dates.filter(day=>day>=dates[0]&&day<=analysisDate);
  if (aligned.length!==dates.length || aligned.some((day,i)=>day!==dates[i])) return history;
  const next=schedule.dates.filter(day=>day>analysisDate&&day.startsWith(schedule.coverageYear+'-')).slice(0,P.nextHorizon);
  if (!next.length) return history;
  return {...history,dates:[...dates,...next],futureReceipt:{source:schedule.source,sha256:schedule.sourceSha256,
    availableAt:schedule.generatedAt,coverageYear:schedule.coverageYear}};
}

function validBar(row) {
  return row?.completed !== false && row?.isComplete !== false && row?.suspended !== true && row?.noTrades !== true &&
    ['open','high','low','close','volume'].every(key => Number.isFinite(row?.[key]) && row[key] > 0) &&
    row.low <= Math.min(row.open, row.close) && row.high >= Math.max(row.open, row.close);
}

function createContext(snapshot) {
  const {analysisDate, dataAsOf, source, calendar, instrument, bars, actionByDate = {}} = snapshot;
  const cutoff = timestamp(dataAsOf);
  if (!validDate(analysisDate) || !Number.isFinite(cutoff) || taipeiDate(cutoff) < analysisDate ||
      !source || snapshot.complete !== true || !Array.isArray(bars)) return unavailable('已完成盤後來源及資料時間');
  if (!instrument || !['TWSE','TPEX','TAIEX','TPEX_INDEX'].includes(instrument.market) || !instrument.code ||
      !['UNADJUSTED_OFFICIAL_OHLC','OFFICIAL_INDEX_LEVEL','POINT_IN_TIME_ADJUSTED'].includes(instrument.basis)) return unavailable('商品、市場及價格口徑');
  const dates = calendar?.verified === true && calendar.source ? calendar.dates : null;
  if (!orderedDates(dates)) return unavailable('已核對的正式交易日曆');
  const position = dates.indexOf(analysisDate);
  if (position < 0) return unavailable('行情日不在正式交易日曆');
  const knownAt = Math.min(cutoff, Date.parse(analysisDate + 'T23:59:59.999+08:00'));
  const rows = new Map();
  for (const row of bars) {
    if (!validDate(row?.date) || row.date > analysisDate || (row.availableAt && !(timestamp(row.availableAt) <= knownAt))) continue;
    if (rows.has(row.date)) return unavailable('同日行情有多個版本，需要指定當時版本');
    const identityOk = (!row.market || row.market === instrument.market) &&
      (!row.code || String(row.code) === String(instrument.code));
    rows.set(row.date, identityOk && validBar(row) ? row : null);
  }
  const index = ['TAIEX','TPEX_INDEX'].includes(instrument.market);
  const sampleDates = dates.slice(Math.max(0, position - P.historyLimit + 1), position + 1);
  const sessions = sampleDates.map(date => rows.get(date) || null);
  const last = sessions.at(-1);
  if (!last) return unavailable('指定日缺少已完成有效 OHLCV，可能停牌、無成交或資料缺漏');
  let start = sessions.length - 1;
  while (start > 0 && sessions[start - 1]) start--;
  const contiguous = sessions.slice(start);
  const action = date => {
    if (index) return 'NONE';
    const event = actionByDate?.[date];
    if (!event?.verified || !event.source || !(timestamp(event.publishedAt) <= knownAt)) return 'UNKNOWN';
    return ['NONE','MECHANICAL'].includes(event.status) ? event.status : 'UNKNOWN';
  };
  // Confirmed mechanical resets break raw-price indicator history.
  const afterReset = contiguous.findLastIndex(b => action(b.date) === 'MECHANICAL');
  const trendBars = afterReset < 0 ? contiguous : contiguous.slice(afterReset);
  return {
    status:'AVAILABLE', analysisDate, dataAsOf, source, instrument, index, rows, bars:contiguous, trendBars, action,
    nextSession:dates[position + 1] || null, nextDates:dates.slice(position+1,position+1+P.nextHorizon), calendarReceipt:calendar.futureReceipt,knownAt, coverage:{valid:sessions.filter(Boolean).length,
    expected:sessions.length, contiguous:contiguous.length, sinceKnownReset:trendBars.length},
    warnings:snapshot.pointInTime === true ? [] : ['來源未證明為行情日當時可見版本，歷史研究可能受補正影響。']
  };
}

function doji(bar, threshold = P.doji) {
  const range = bar.high - bar.low;
  return range > 0 && Math.abs(bar.close - bar.open) <= range * threshold;
}

function reversalWatch(ctx) {
  const bars = ctx.bars, today = bars.at(-1), surge = bars.at(-2);
  if (!enough(bars, 21)) return unavailable('21 根連續完成日K');
  const highRef = high(bars.slice(-21,-1));
  const todayRange = today.high - today.low;
  const qualifies = todayRange > 0 && (doji(today, P.surgeDoji) ||
    Math.abs(today.close - today.open) <= today.open * P.surgeDojiOpen);
  if (!qualifies || today.high < highRef * P.highZone || surge.high === surge.low ||
      surge.close - surge.open < (surge.high - surge.low) * P.surgeBody) return {status:'NO_PATTERN'};
  if (ctx.action(today.date) === 'MECHANICAL' || ctx.action(surge.date) === 'MECHANICAL') return {status:'INVALIDATED',reason:'公司行動改變價格基準'};
  if (ctx.action(today.date) !== 'NONE' || ctx.action(surge.date) !== 'NONE') return unavailable('長紅與十字兩日的公司行動證據');
  const reference = surge.reference;
  if (!reference?.verified || !reference.source || !Number.isFinite(reference.price) || reference.price <= 0 ||
      !(timestamp(reference.publishedAt) <= ctx.knownAt)) return unavailable('前一交易日官方有效參考價');
  const change = surge.close / reference.price - 1;
  const upper = reference.upperLimit;
  const limit = Number.isFinite(upper) && upper > 0 && surge.close === upper;
  if (change < P.surgeReturn - 1e-12 && !limit) return {status:'NO_PATTERN'};
  return {
    pattern:'HIGH_DOJI_AFTER_SURGE', signalDate:today.date, nextSessionDate:ctx.nextSession, instrument:{code:ctx.instrument.code,market:ctx.instrument.market},
    nextDayOpenDefensePrice:today.close, status:'WATCH_NEXT_OPEN',
    evidence:{surgeDate:surge.date, referencePrice:reference.price, referenceSource:reference.source, change, limit, highRef},
    summary:`前一天大漲，今天高檔十字。下一交易日若開盤低於 ${today.close} 元，留意短線轉弱。`
  };
}

function confirmDefense(watch, snapshot) {
  if (watch?.status !== 'WATCH_NEXT_OPEN') return {status:'INVALIDATED',reason:'缺少原開盤防線事件'};
  if (!snapshot?.instrument || String(watch.instrument?.code)!==String(snapshot.instrument.code) ||
      watch.instrument?.market!==snapshot.instrument.market) return {status:'INVALIDATED',reason:'開盤防線的商品與市場不符'};
  const confirmationDate = watch.nextSessionDate;
  const signalDate = watch.signalDate, defensePrice = watch.nextDayOpenDefensePrice;
  if (!Number.isFinite(defensePrice) || defensePrice <= 0 || !validDate(signalDate)) return {status:'INVALIDATED',signalDate};
  const pending = {status:'UNCONFIRMED',signalDate,confirmationDate};
  if (!confirmationDate) return {...pending,reason:'下一交易日曆尚未確認'};
  if (snapshot.analysisDate < confirmationDate) return {...pending,status:'WATCH_NEXT_OPEN'};
  const ctx = createContext(snapshot);
  if (ctx.status !== 'AVAILABLE') return {...pending,reason:'確認行情不足'};
  const actualDate = snapshot.calendar.dates.includes(signalDate)
    ? snapshot.calendar.dates[snapshot.calendar.dates.indexOf(signalDate) + 1] : null;
  if (actualDate !== confirmationDate) return {...pending,status:'INVALIDATED',reason:'交易日曆不一致'};
  const row = ctx.rows.get(confirmationDate);
  if (ctx.action(confirmationDate) === 'MECHANICAL') return {...pending,status:'INVALIDATED',reason:'公司行動改變防線口徑'};
  if (!row || ctx.action(confirmationDate) !== 'NONE') return {...pending,
    status:snapshot.analysisDate === confirmationDate ? 'UNCONFIRMED' : 'EXPIRED',
    reason:'指定確認日沒有完整可比行情，期限為該日收盤'};
  return {...pending, open:row.open, defensePrice, status:row.open < defensePrice ? 'TRIGGERED_WEAK' : 'OPEN_DEFENSE_HELD'};
}

function momentumStall(bars) {
  const {stallLookback:n,stallHighDays:m,stallRecent:r} = P;
  if (!enough(bars,n + m + 6)) return {...unavailable('鈍化與前期趨勢所需連續日K'),isStalling:null};
  const referenceHigh = Math.max(...bars.slice(-n-m,-m).map(x => x.close));
  const ranges = bars.slice(-n-r).map((b,i) => (b.high - b.low) / bars.at(-n-r-1+i).close);
  const volume = bars.slice(-n-r).map(b => b.volume);
  const rangeRef = U.mean(ranges.slice(0,n)), volumeRef = U.mean(volume.slice(0,n));
  if (!(rangeRef > 0 && volumeRef > 0)) return {...unavailable('振幅或均量基準為零'),isStalling:null};
  const rangeRatio = U.mean(ranges.slice(-r)) / rangeRef, volumeRatio = U.mean(volume.slice(-r)) / volumeRef;
  // Consecutive closes below or at the frozen reference within the four-session check.
  let stallingDays = 0;
  for (const bar of bars.slice(-m).reverse()) {
    if (bar.close > referenceHigh) break;
    stallingDays++;
  }
  const background = bars.slice(-n-m-5,-m), trendContext = U.pct(background.at(-1).close, background[0].close);
  const recent = bars.slice(-n-m,-m);
  const close = bars.at(-1).close, upper = high(recent), lower = low(recent);
  const position = upper > lower ? (close - lower) / (upper - lower) : null;
  const isStalling = stallingDays === m && rangeRatio < P.stallRange && volumeRatio < P.stallVolume;
  const status = isStalling ? (trendContext > 0 && position >= .8 ? 'HIGH_LEVEL_STALL' :
    trendContext < 0 && position !== null && position <= .2 ? 'LOW_LEVEL_STALL' : 'MOMENTUM_STALL') :
    trendContext > 0 && position !== null && position >= .5 && rangeRatio < 1 && volumeRatio < 1 ? 'HEALTHY_CONSOLIDATION' : 'NO_STALL';
  return {
    status, isStalling, stallingDays, rangeRatio, volumeRatio, referenceHigh, trendContext,
    actionTag:isStalling ? '止漲盤整・續強待確認' : null,
    evidence:{rangeRef,volumeRef,position,upper,lower},
    summary:isStalling ? '近四天收盤沒突破前高，近三天振幅和成交量也比基準低。' : null
  };
}

function breakoutHistory(bars, tick, anchors = []) {
  const {breakoutWindow:w,breakoutLookbacks:lookbacks,atrPeriod} = P;
  if (!enough(bars, Math.max(...lookbacks) + w + 1)) return unavailable('連續突破基準與觀察日K');
  const events = [];
  for (let i = bars.length - 1 - w; i < bars.length; i++) {
    const bar = bars[i], before = bars[i-1];
    const atr = U.atr(bars.slice(0,i), atrPeriod);
    const ranges = lookbacks.flatMap(window=>{
      const history = prior(bars,i,window);
      return [{direction:'BULL',level:high(history),window},{direction:'BEAR',level:low(history),window}];
    });
    const known = anchors.filter(anchor=>anchor.knownDate<bar.date && (!anchor.invalidatedDate || anchor.invalidatedDate>bar.date));
    for (const {direction,level,window = null,kind,knownDate,source} of [...ranges,...known]) {
      const sign = direction === 'BULL' ? 1 : -1;
      const buffer = Math.max(tick(level), (atr || 0) * P.breakoutBufferAtr);
      const margin = value => (value - level) * sign;
      if (margin(bar.close) <= buffer || margin(before.close) > buffer) continue;
      let status = 'INITIAL_BREAKOUT', retestDate = null, confirmationDate = null, failureDate = null;
      for (const after of bars.slice(i+1)) {
        const contact = margin(sign === 1 ? after.low : after.high) <= buffer;
        if (margin(after.close) < -buffer) { status='FAILED_BREAKOUT'; failureDate=after.date; break; }
        const continued = ((after.close - bar.close) * sign) > buffer;
        if (retestDate && after.date > retestDate && continued) {
          status='RETEST_CONTINUATION'; confirmationDate ||= after.date;
        } else if (contact && !confirmationDate) {
          retestDate ||= after.date;
          status = 'RETEST_HELD';
        } else if (continued && !retestDate) {
          status='DIRECT_CONTINUATION'; confirmationDate ||= after.date;
        } else if (status === 'INITIAL_BREAKOUT') status='AWAITING_CONFIRMATION';
      }
      events.push({status,direction,level,window,buffer,eventDate:bar.date,retestDate,confirmationDate,failureDate,
        ...(kind ? {anchor:{kind,knownDate,source}} : {}),observationSessions:w,windowClosed:bars.length - 1 - i >= w});
    }
  }
  const ordered = events.sort((a,b) => b.eventDate.localeCompare(a.eventDate) || Number(!!b.anchor)-Number(!!a.anchor) ||
    (b.anchor?.knownDate||'').localeCompare(a.anchor?.knownDate||'') || (b.window||0) - (a.window||0));
  return {status:ordered[0]?.status || 'NOT_BREAKOUT', selected:ordered[0] || null, events:ordered};
}

function resolveFvg(zone, following, expiry) {
  const {direction,zoneLow,zoneHigh} = zone, bull = direction === 'BULL';
  let firstContactDate = null, fullyFilledDate = null, invalidatedDate = null, retestedDate = null;
  let maxFill = 0, lastClose = null, retestState = 'AWAITING_RETEST', followThrough = 'AWAITING_CONFIRMATION';
  const width = zoneHigh - zoneLow;
  for (const bar of following) {
    const fill = (bull ? zoneHigh - bar.low : bar.high - zoneLow) / width;
    if (fill >= 0) firstContactDate ||= bar.date;
    maxFill = Math.max(maxFill,Math.min(1,fill));
    if (fill >= 1) fullyFilledDate ||= bar.date;
    if (bull ? bar.close < zoneLow : bar.close > zoneHigh) invalidatedDate ||= bar.date;
    lastClose = bar.close;
    const inside = bar.close >= zoneLow && bar.close <= zoneHigh;
    const extended = bull ? bar.close > zone.formationHigh : bar.close < zone.formationLow;
    if (invalidatedDate) { retestState='INVALIDATED'; followThrough='FAILED_BREAKOUT'; }
    else if (fullyFilledDate) retestState='FILLED';
    else if (inside) retestState='IN_RETEST_ZONE';
    else if (firstContactDate === bar.date) retestState='RETEST_TOUCHED';
    else if (firstContactDate) {
      if (extended && retestedDate) {
        retestState='RETEST_CONFIRMED'; followThrough='RETEST_CONFIRMED';
      } else if (retestState !== 'RETEST_CONFIRMED') {
        retestState='RETEST_HELD'; retestedDate ||= bar.date;
      }
    } else if (extended) followThrough='DIRECT_CONTINUATION';
  }
  const expired = following.length >= expiry;
  const status = invalidatedDate ? 'INVALIDATED' : fullyFilledDate ? 'FULL_FILL' :
    expired ? 'EXPIRED' : maxFill > 0 ? 'PARTIAL_FILL' : 'OPEN';
  return {...zone,status,firstContactDate,fullyFilledDate,invalidatedDate,fillRatio:round(maxFill),
    active:!invalidatedDate && !fullyFilledDate && !expired,lastClose,retestState,followThrough};
}

function fvgAnalysis(ctx, tick) {
  const bars = ctx.bars, events = [], gaps = [];
  if (!enough(bars,P.fvgScanSessions+2)) return unavailable('FVG 掃描需最近十日及前兩個正式交易日');
  for (let i=bars.length-P.fvgScanSessions; i<bars.length; i++) {
    const [a,b,c] = bars.slice(i-2,i+1);
    const gap = c.low > b.high ? 'BULL' : c.high < b.low ? 'BEAR' : null;
    const actions = [a,b,c].map(row => ctx.action(row.date));
    const verified = actions.every(action => action === 'NONE');
    if (gap && !actions.includes('MECHANICAL')) gaps.push({date:c.date,direction:gap,status:verified?'VERIFIED':'CORPORATE_ACTION_UNCONFIRMED'});
    const bull = c.low > a.high && b.close > b.open;
    const bear = c.high < a.low && b.close < b.open;
    if ((!bull && !bear) || actions.includes('MECHANICAL')) continue;
    const direction = bull ? 'BULL' : 'BEAR';
    const zone = {direction,formedDate:c.date,zoneLow:bull?a.high:c.high,zoneHigh:bull?c.low:a.low,
      formationHigh:c.high,formationLow:c.low};
    const after = bars.slice(i+1,i+1+P.fvgExpiry);
    const firstAction = after.findIndex(row => ctx.action(row.date) !== 'NONE');
    const available = firstAction === -1 ? after : after.slice(0,firstAction);
    const comparison = [i-1,i].filter(j=>j>=10);
    const quality = comparison.some(j=>{
      const window=prior(bars,j,10), level=bull?high(window):low(window);
      return window.every(row=>ctx.action(row.date)==='NONE') &&
        (bull?bars[j].close-level:level-bars[j].close)>=tick(level);
    }) ? 'CONFIRMED_FVG' : 'WEAK_OR_UNCONFIRMED';
    const result = resolveFvg({...zone,fvgBreakoutQuality:quality},available,P.fvgExpiry);
    if (!verified || firstAction !== -1) {
      const action = after[firstAction] && ctx.action(after[firstAction].date);
      events.push({...result,status:action==='MECHANICAL'?'INVALIDATED':'DATA_INSUFFICIENT',
        active:false,retestState:action==='MECHANICAL'?'INVALIDATED':'INSUFFICIENT_DATA',
        followThrough:action==='MECHANICAL'?'FAILED_BREAKOUT':'DATA_INSUFFICIENT',
        corporateActionDate:action==='MECHANICAL'?after[firstAction].date:null});
    } else events.push(result);
  }
  const selected = events.findLast(event=>event.active) || null;
  return {
    status:selected?'ACTIVE':events.some(event=>event.status==='DATA_INSUFFICIENT')?'DATA_INSUFFICIENT':'NO_ACTIVE_FVG',
    selected, events, traditionalGaps:gaps, selection:'最新有效未完全回補區'
  };
}

function roundPrice(price, dir, index) {
  if (!(price > 0) || !Number.isFinite(price)) return null;
  const tick = index ? .01 : U.tick(price);
  const count = dir < 0 ? Math.floor(price/tick+1e-9) : Math.ceil(price/tick-1e-9);
  const result = round(count*tick,2);
  return result > 0 && (index || U.legal(result)) ? result : null;
}

function fvgPlan(zone, {index = false, tickVerified = false, nextLimit, atr} = {}) {
  if (!zone?.active) return {status:'NO_ACTIVE_FVG'};
  if (!index && tickVerified !== true) return unavailable('當時商品合法跳動單位');
  const bull = zone.direction === 'BULL', sign = bull ? 1 : -1, {zoneLow:l,zoneHigh:h} = zone;
  const mid = (l+h)/2;
  const entryRef = [roundPrice(mid,-1,index),roundPrice(mid,1,index)]
    .filter(x=>x!==null&&x>=l&&x<=h).sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid))[0];
  const stopRef = roundPrice(bull?l*(1-P.fvgStopPct):h*(1+P.fvgStopPct),-sign,index);
  const risk = entryRef && stopRef ? round(sign*(entryRef-stopRef)) : 0;
  if (!(risk>0)) return unavailable('合法區間參考價或有效風險');
  // Round targets away from entry and disclose the resulting R.
  const target2R=roundPrice(entryRef+sign*2*risk,sign,index), target3R=roundPrice(entryRef+sign*3*risk,sign,index);
  if (!target2R || !target3R) return unavailable('合法正值目標價');
  const beyond = value => nextLimit?.verified && Number.isFinite(nextLimit.lower) && Number.isFinite(nextLimit.upper)
    ? value < nextLimit.lower || value > nextLimit.upper : null;
  return {
    status:'RESEARCH_ONLY',direction:zone.direction,entryZone:[l,h],entryRef,stopRef,risk,target2R,target3R,
    actualR2:round(sign*(target2R-entryRef)/risk),actualR3:round(sign*(target3R-entryRef)/risk),
    crossSession2R:index?null:beyond(target2R),crossSession3R:index?null:beyond(target3R),
    atrStop:Number.isFinite(atr)&&atr>0?roundPrice(bull?l-atr*P.fvgStopAtr:h+atr*P.fvgStopAtr,-sign,index):null,
    summary:'依假設價位試算承受 1 份風險時的 2 份及 3 份價格空間。'
  };
}

return {PARAMETERS,createContext,extendTradingCalendar,validBar,doji,reversalWatch,confirmDefense,momentumStall,breakoutHistory,
  fvgAnalysis,fvgPlan,roundPrice,unavailable,high,low,enough};
});
