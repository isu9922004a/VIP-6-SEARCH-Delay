/* V9.26 shadow research. No market calls, strategy mutations, or production score. */
(function(root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./research-common-v1.js') : root.ShitouResearchCommon,
    node ? require('./postmarket-patterns-v926.js') : root.ShitouPostmarketPatterns926,
    node ? require('./enhanced-macd-v923.js') : root.ShitouEnhancedMacd);
  if (node) module.exports = api;
  else root.ShitouPostmarketTrend926 = api;
})(globalThis, function(U, Patterns, MACD) {
'use strict';

const {PARAMETERS:P, unavailable, high, low, enough} = Patterns;
const MODE = 'SHADOW_ONLY';
const positive = value => Number.isFinite(value) && value > 0;
const GROUPS = Object.freeze({candle:20, persistence:20, volumePrice:20, momentum:15, structure:25});
const round = value => Math.round(value * 10000) / 10000;
const cutoffOk = (published, ctx) => typeof published === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(published)
  && Date.parse(published) <= Math.min(Date.parse(ctx.dataAsOf), Date.parse(ctx.analysisDate + 'T23:59:59.999+08:00'));

const stages = Object.freeze({
  INITIAL_BULL:'初升轉強', BULL_CONTINUATION:'主升延續', LATE_BULL:'末升警戒',
  HIGH_LEVEL_STALL:'高檔滯漲', BULL_STRUCTURE_BROKEN:'多頭結構破壞',
  INITIAL_BEAR:'初跌轉弱', BEAR_CONTINUATION:'主跌延續', LATE_BEAR:'末跌警戒',
  LOW_LEVEL_BASE_CANDIDATE:'低檔止跌候選', BEAR_STRUCTURE_REPAIRED:'空頭結構修復',
  HEALTHY_CONSOLIDATION:'健康整理', RANGE:'區間盤整', CONFLICT:'多空訊號衝突',
  UNCONFIRMED:'方向未確認', DATA_INSUFFICIENT:'資料不足'
});

function verifiedLevels(ctx, levels = {}) {
  return Object.fromEntries(['lifeLine','support','resistance'].map(key=>{
    const row = levels?.[key];
    const valid = row?.date===ctx.analysisDate && String(row.code)===String(ctx.instrument.code) &&
      row.market===ctx.instrument.market && row.verified===true && row.source && cutoffOk(row.publishedAt,ctx) && positive(row.price);
    return [key,valid?{price:row.price,date:row.date,source:row.source}:null];
  }));
}

function trendGeometry(bars, levels) {
  if (!enough(bars, P.minTrend)) return unavailable('完整趨勢、MACD 與 ATR 所需連續日K');
  const close = bars.at(-1).close, previous = bars.at(-2).close;
  const ma20 = U.ma(bars,20), ma20Prior = U.ma(bars,20,bars.length-4);
  const atr = U.atr(bars,P.atrPeriod);
  if (!positive(atr)) return unavailable('ATR 正值');
  const last = bars.slice(-5), before = bars.slice(-10,-5), earlier = bars.slice(-15,-10);
  const higher = high(last)>high(before) && low(last)>low(before);
  const lower = high(last)<high(before) && low(last)<low(before);
  const priorUp = high(before)>high(earlier) && low(before)>low(earlier);
  const priorDown = high(before)<high(earlier) && low(before)<low(earlier);
  const life = levels.lifeLine?.price ?? null;
  const result = {status:'AVAILABLE',close,previous,atr,ma20,maSlope:ma20-ma20Prior,higher,lower,priorUp,priorDown,life,
    support:levels.support?.price ?? low(bars.slice(-11,-1)),
    resistance:levels.resistance?.price ?? high(bars.slice(-11,-1)),
    previousHigh:high(bars.slice(-21,-1)),previousLow:low(bars.slice(-21,-1)),
    usualVolume:U.mean(bars.slice(-21,-1).map(b=>b.volume))};
  const macd = MACD.macd(bars.map(b=>b.close));
  return {...result, histogram:macd.slice(-3).map(x=>x?.histogram ?? null)};
}

function exhaustion(bars, trend, stall, reversal, previousDefense, direction) {
  if (trend.status!=='AVAILABLE') return unavailable(...trend.missingFields);
  const current = bars.at(-1), sign = direction==='BULL'?1:-1;
  const bull = sign===1, opposite = value => sign*value;
  const extreme = bull ? current.high >= trend.previousHigh * P.highZone
    : current.low <= trend.previousLow / P.highZone;
  const candle = U.geometry(current);
  const noProgress = bull ? high(bars.slice(-3)) <= high(bars.slice(-23,-3))
    : low(bars.slice(-3)) >= low(bars.slice(-23,-3));
  const efficiency = sample => {
    const path = sample.slice(1).reduce((sum,b,i)=>sum+Math.abs(b.close-sample[i].close),0);
    const change = opposite(sample.at(-1).close - sample[0].close);
    return path > 0 ? {ratio:change/path, atrMove:change/trend.atr} : null;
  };
  const recent = efficiency(bars.slice(-4)), previous = efficiency(bars.slice(-8,-4));
  const slows = recent && previous && previous.atrMove >= 1 && recent.atrMove < previous.atrMove*P.slowEfficiency &&
    recent.ratio < previous.ratio;
  const hist = trend.histogram.map(h=>h===null?null:opposite(h));
  const shrinks = hist.every(h=>h!==null&&h>0) && hist[0]>hist[1] && hist[1]>hist[2];
  const life = trend.life===null ? null : opposite(trend.close-trend.life);
  const brokeStructure = life===null?null:life<0 && (bull?trend.close<trend.support:trend.close>trend.resistance);
  const wick = bull?candle.upperRatio:candle.lowerRatio;
  const contextual = extreme || (bull?trend.priorUp:trend.priorDown);
  const groups = {
    candle:[['doji',extreme&&Patterns.doji(current),12],['longWick',extreme&&wick!==null&&wick>=P.wick,15],
      ['surgeDoji',bull&&reversal.status==='WATCH_NEXT_OPEN',20]],
    persistence:[['noNewExtreme',contextual&&noProgress,9],['lowerEfficiency',contextual&&!!slows,12],
      ['stall',bull ? stall.status==='HIGH_LEVEL_STALL' : stall.status==='LOW_LEVEL_STALL',20]],
    volumePrice:[['highVolumeWeakMove',contextual&&current.volume>trend.usualVolume*P.heavyVolume&&
      opposite(current.close-trend.previous)/trend.atr<P.smallMoveAtr,20]],
    momentum:[['shorteningHistogram',hist.every(h=>h!==null)&&shrinks,15]],
    structure:[['lifeLineDistance',life===null?null:life/trend.atr>=P.distanceAtr,10],
      ['lifeLineAndStructureLost',brokeStructure,25],
      ['openingDefenseLost',bull&&previousDefense?.status==='TRIGGERED_WEAK',18]]
  };
  const evidence = [], missingFields = [];
  let score = 0;
  for (const [group,items] of Object.entries(groups)) {
    for (const [id,on] of items) if (on) evidence.push({id,group,date:current.date});
    if (group==='structure'&&life===null) missingFields.push('原生命線及分界是否失守');
    // Within each group, count the strongest correlated observation once.
    score += Math.min(GROUPS[group],Math.max(0,...items.filter(([,on])=>on).map(([,weight])=>weight)));
  }
  return {
    status:missingFields.length?'PARTIAL_DATA':'RESEARCH_ONLY', direction, score:null,
    researchScore:missingFields.length?null:score, coverage:{available:5-missingFields.length,expected:5}, evidence,missingFields,
    tier:missingFields.length?null:score>=75?'高度警戒':score>=50?'明顯':score>=25?'初步':'低',
    summary:evidence.length>=2 ? (bull?'還沒確認走空，但開始漲不太動。':'下跌力道減弱，但尚未確認反轉。') : null
  };
}

function lifecycle(trend, stall, breakout, bullWarning, bearWarning) {
  if (trend.status!=='AVAILABLE') return {status:'DATA_INSUFFICIENT',direction:'UNKNOWN',label:stages.DATA_INSUFFICIENT,missingFields:trend.missingFields};
  const {higher,lower,close,life,priorUp,priorDown,maSlope,ma20}=trend;
  const above = life===null ? null : close>life, below = life===null ? null : close<life;
  const up = close>ma20 && maSlope>0, down = close<ma20 && maSlope<0;
  const event = breakout.selected;
  const clean = event && !['FAILED_BREAKOUT','DATA_INSUFFICIENT'].includes(event.status);
  const longBreak = clean && event.direction==='BULL', shortBreak = clean && event.direction==='BEAR';
  const slowing = bullWarning.evidence?.length>=2, easing = bearWarning.evidence?.length>=2;
  let status = 'RANGE', direction = 'NEUTRAL';
  // Confirmed structure change precedes stall, exhaustion, continuation and range.
  if (priorUp && below && close<trend.support && lower) {status='BULL_STRUCTURE_BROKEN';direction='BEAR';}
  else if (priorDown && above && close>trend.resistance && higher) {status='BEAR_STRUCTURE_REPAIRED';direction='BULL';}
  else if (up && below || down && above || up && lower || down && higher) {status='CONFLICT';direction='MIXED';}
  else if (up) {
    direction='BULL';
    if (stall.status==='HIGH_LEVEL_STALL' && slowing) status='HIGH_LEVEL_STALL';
    else if (slowing) status='LATE_BULL';
    else if (priorUp && higher && above) status='BULL_CONTINUATION';
    else if (!priorUp && longBreak && higher) status='INITIAL_BULL';
    else status=stall.status==='HEALTHY_CONSOLIDATION'?'HEALTHY_CONSOLIDATION':'UNCONFIRMED';
  } else if (down) {
    direction='BEAR';
    if (stall.status==='LOW_LEVEL_STALL' && easing && !lower) status='LOW_LEVEL_BASE_CANDIDATE';
    else if (easing) status='LATE_BEAR';
    else if (priorDown && lower && below) status='BEAR_CONTINUATION';
    else if (!priorDown && shortBreak && lower) status='INITIAL_BEAR';
    else status='UNCONFIRMED';
  } else if (longBreak || shortBreak) {status='UNCONFIRMED';}
  return {status,direction,label:stages[status], alert:direction==='BULL'?bullWarning.summary:direction==='BEAR'?bearWarning.summary:null,
    evidence:{higher,lower,above,below,ma20,maSlope,priorUp,priorDown,breakout:event?.status??null},
    invalidation:direction==='BULL'?trend.support:direction==='BEAR'?trend.resistance:null,
    missingFields:life===null?['原生命線']:[]};
}

function marketRegime(ctx, trend, lifecycle, fvg, breakout) {
  const bars = ctx.bars, today=bars.at(-1), prev=bars.at(-2);
  if (!enough(bars,21)) return unavailable('大盤防禦所需 21 根連續日K');
  const before=bars.slice(-5,-1), streak=before.slice(1).every((b,i)=>b.close>before[i].close);
  const prior20=high(bars.slice(-21,-1)), highArea=today.high>=P.highZone*prior20;
  const pressure=(streak||highArea)&&Patterns.doji(today,P.surgeDoji);
  const change=today.close/prev.close-1, selloff=change<=P.indexSelloff+1e-12;
  const previous10=bars.slice(-11,-1), support=low(previous10), resistance=high(previous10);
  const hadRecentFvg=fvg.events?.some(e=>e.active&&bars.slice(-5).some(b=>b.date===e.formedDate));
  const inside=today.close>=support&&today.close<=resistance;
  const noDirection=lifecycle.direction==='NEUTRAL' && trend.life!==null && Math.abs(today.close-trend.life)<=trend.atr;
  const wait=inside&&breakout.status==='NOT_BREAKOUT'&&!hadRecentFvg&&
    ['ACTIVE','NO_ACTIVE_FVG'].includes(fvg.status)&&!pressure&&!selloff&&noDirection;
  const status=pressure||selloff?'DEFENSE_WATCH':wait?'NO_TRADE_CONSOLIDATION':
    trend.status!=='AVAILABLE'||trend.life===null||fvg.status==='DATA_INSUFFICIENT'?'DATA_INSUFFICIENT':'OBSERVE';
  return {status,openDefenseLevel:pressure?today.close:null,
    openDefense:pressure?{status:'WATCH_NEXT_OPEN',signalDate:today.date,nextSessionDate:ctx.nextSession,nextDayOpenDefensePrice:today.close,
      instrument:{code:ctx.instrument.code,market:ctx.instrument.market}}:null,
    selloff,change,missingFields:status==='DATA_INSUFFICIENT'?['生命線或 FVG 所需資料']:[],
    evidence:{streak,highArea,prior20,inside,support,resistance,hadRecentFvg:hadRecentFvg??null},
    summary:wait?'區間無方向・等待方向確認。':pressure?'高檔十字，下一交易日開盤可先觀察今天收盤點位。':
      selloff?'已完成交易日跌幅達 1%，留意下一交易日能否守住支撐。':null};
}

function relativeStrength(ctx, reference) {
  if (!reference || !['TWSE','TPEX'].includes(ctx.instrument.market)) return unavailable('個股對應市場指數');
  const index = Patterns.createContext(reference);
  const expected = ctx.instrument.market==='TWSE'?'TAIEX':'TPEX_INDEX';
  if (index.status!=='AVAILABLE'||index.instrument.market!==expected||index.analysisDate!==ctx.analysisDate||
      !enough(ctx.bars,22)||!enough(index.bars,22)||Date.parse(index.dataAsOf)>Date.parse(ctx.dataAsOf)) {
    return unavailable('同日、同區間的 5/20 日個股及對應指數');
  }
  const b=ctx.bars.slice(-22), r=index.bars.slice(-22);
  if (b.some((bar,i)=>bar.date!==r[i].date||ctx.action(bar.date)!=='NONE')) return unavailable('交易日對齊與可比較的公司行動口徑');
  const delta = (n,end) => {
    const stock=b[end].close/b[end-n].close-1, market=r[end].close/r[end-n].close-1;
    return {stock:round(stock),market:round(market),spread:round(stock-market)};
  };
  const five=delta(5,21), twenty=delta(20,21);
  const spread=(five.spread+twenty.spread)/2;
  const status=spread>=P.relativeStrong?'STRONG':spread>=P.relativeNear?'SLIGHTLY_STRONG':
    spread<=-P.relativeStrong?'WEAK':spread<=-P.relativeNear?'SLIGHTLY_WEAK':'SIMILAR';
  return {status,five,twenty,change5:round(five.spread-delta(5,20).spread),change20:round(twenty.spread-delta(20,20).spread),
    labels:{STRONG:'明顯強',SLIGHTLY_STRONG:'略強',SIMILAR:'接近',SLIGHTLY_WEAK:'略弱',WEAK:'明顯弱'}[status],
    source:index.source,dates:{start:r[1].date,end:r.at(-1).date}};
}

function marketBreadth(ctx, breadth) {
  if (!breadth || breadth.date!==ctx.analysisDate || breadth.verified!==true || !breadth.source ||
      !cutoffOk(breadth.publishedAt,ctx) || !Array.isArray(breadth.members)) return unavailable('當日官方普通股母體及各市場行情');
  const markets = {};
  for (const market of ['TWSE','TPEX']) {
    const members = breadth.members.filter(row=>row?.market===market&&row.securityType==='COMMON');
    if (!members.length || new Set(members.map(row=>row.code)).size!==members.length ||
        !members.every(row=>row.code) || members.length!==breadth.expected?.[market]) {
      markets[market]=unavailable('完整且不重複的當日普通股母體');
      continue;
    }
    const eligible=members.filter(row=>row.sessionStatus!=='SUSPENDED'&&row.sessionStatus!=='NO_TRADES');
    const quote=eligible.filter(row=>row.date===ctx.analysisDate&&row.completed===true&&Number.isFinite(row.change));
    const history=quote.filter(row=>row.historyVerified===true&&positive(row.close)&&positive(row.ma20)&&
      positive(row.high)&&positive(row.low)&&positive(row.prior20High)&&positive(row.prior20Low));
    const up=quote.filter(row=>row.change>0).length, down=quote.filter(row=>row.change<0).length, flat=quote.length-up-down;
    const above20=history.filter(row=>row.close>row.ma20).length;
    const newHigh=history.filter(row=>row.high>row.prior20High).length, newLow=history.filter(row=>row.low<row.prior20Low).length;
    const coverage={official:members.length,eligible:eligible.length,excluded:members.length-eligible.length,
      quote:quote.length,history:history.length,missingQuotes:eligible.length-quote.length,missingHistory:eligible.length-history.length};
    const indexChange=breadth.indices?.[market];
    markets[market]={status:quote.length===eligible.length&&history.length===eligible.length&&eligible.length?'AVAILABLE':'DATA_INSUFFICIENT',
      coverage, counts:{up,down,flat,above20,newHigh,newLow},
      proportions:quote.length&&quote.length===eligible.length?{up:up/quote.length,down:down/quote.length,flat:flat/quote.length}:null,
      above20Ratio:history.length&&history.length===eligible.length?above20/history.length:null,
      divergence:quote.length&&quote.length===eligible.length&&indexChange?.date===ctx.analysisDate&&indexChange?.verified&&
        Number.isFinite(indexChange.change)?indexChange.change>0&&down>up:null};
  }
  return {status:Object.values(markets).every(m=>m.status==='AVAILABLE')?'AVAILABLE':'DATA_INSUFFICIENT',source:breadth.source,markets};
}

function nextSessionScenario(ctx, trend, life, reversal, regime, fvgPlan) {
  if (trend.status!=='AVAILABLE') return unavailable('關鍵位置所需已完成價格');
  const {close, support, resistance} = trend;
  const unit = ctx.index?' 點':' 元';
  const valid = positive(support)&&positive(resistance)&&support<resistance;
  const defense=reversal.nextDayOpenDefensePrice??regime.openDefenseLevel??null;
  const evidence={priceDate:ctx.analysisDate,support:'原結構支撐或前 10 正式交易日最低',
    resistance:'原結構壓力或前 10 正式交易日最高',close:'指定交易日收盤',lifeLine:life?.source??null};
  const bear = positive(life?.price)&&life.price<=close?Math.max(support,life.price):support;
  const bull = positive(life?.price)&&life.price>=close?Math.min(resistance,life.price):resistance;
  if (!ctx.nextSession || !valid || !(bear<bull)) return {...unavailable('尚無明確位置或下一交易日曆未確認'),
    levels:{close,lifeLine:life?.price??null,openingDefense:defense},evidence};
  return {
    status:'HYPOTHETICAL',nextSessionDate:ctx.nextSession,levels:{continuation:resistance,close,lifeLine:life?.price??null,support,resistance,
      openingDefense:defense,fvg:fvgPlan.status==='RESEARCH_ONLY'?fvgPlan:null},evidence,
    opening:defense===null?null:`若開盤低於 ${defense}${unit}，留意短線轉弱。`,
    conditions:[
      {state:'BULL',operator:'>',price:bull,summary:`若收盤高於 ${bull}${unit}，且量價或結構改善，再觀察是否轉強。`},
      {state:'BEAR',operator:'<',price:bear,summary:`若收盤低於 ${bear}${unit}，留意支撐轉弱。`},
      {state:'RANGE',lower:bear,upper:bull,inclusive:true,summary:`若收盤仍在 ${bear} 至 ${bull}${unit}，先看整理。`}
    ]
  };
}

function analyze(snapshot, {levels={}, benchmark, breadth, previousWatch, shadowScore, nextLimit} = {}) {
  const raw = snapshot || {};
  const ctx = Patterns.createContext(raw);
  const envelope = {
    status:ctx.status,mode:MODE,analysisDate:raw.analysisDate??null,dataAsOf:raw.dataAsOf??null,
    parameters:P,engineVersion:P.version,source:raw.source??null,dataCoverage:ctx.coverage??null,
    pointInTimeVerified:raw.pointInTime===true,missingFields:ctx.missingFields??[],warnings:ctx.warnings??[]
  };
  if (ctx.status!=='AVAILABLE') return envelope;
  const keyLevels=verifiedLevels(ctx,levels);
  const tick = level => ctx.index ? .01 : U.tick(level);
  const trend=trendGeometry(ctx.trendBars,keyLevels);
  const momentumStall=Patterns.momentumStall(ctx.trendBars);
  const reversalWatch=ctx.index?{status:'NOT_APPLICABLE'}:Patterns.reversalWatch(ctx);
  const openingConfirmation=previousWatch?Patterns.confirmDefense(previousWatch,raw):null;
  const breakoutConfirmation=Patterns.breakoutHistory(ctx.trendBars,tick);
  const fvgAnalysis=Patterns.fvgAnalysis(ctx,tick);
  const legalTick=ctx.instrument.securityType==='COMMON'&&ctx.instrument.tickRuleVerified===true;
  const verifiedLimit=nextLimit?.date===ctx.nextSession&&nextLimit.source&&cutoffOk(nextLimit.publishedAt,ctx)?nextLimit:null;
  const fvgPlan=fvgAnalysis.status==='DATA_INSUFFICIENT'?unavailable('未確認有效 FVG'):
    Patterns.fvgPlan(fvgAnalysis.selected,{index:ctx.index,tickVerified:legalTick,nextLimit:verifiedLimit,atr:trend.atr});
  const bull=exhaustion(ctx.trendBars,trend,momentumStall,reversalWatch,openingConfirmation,'BULL');
  const bear=exhaustion(ctx.trendBars,trend,momentumStall,reversalWatch,openingConfirmation,'BEAR');
  const trendLifecycle=lifecycle(trend,momentumStall,breakoutConfirmation,bull,bear);
  const regime=ctx.index?marketRegime(ctx,trend,trendLifecycle,fvgAnalysis,breakoutConfirmation):{status:'NOT_APPLICABLE'};
  const relative=ctx.index?{status:'NOT_APPLICABLE'}:relativeStrength(ctx,benchmark);
  const scenario=nextSessionScenario(ctx,trend,keyLevels.lifeLine,reversalWatch,regime,fvgPlan);
  let stallAdjustedScore=null;
  if (Number.isFinite(shadowScore)&&momentumStall.isStalling!==null) {
    // Study a five-point penalty, independent of the formal ranking.
    stallAdjustedScore=momentumStall.isStalling?Math.max(0,shadowScore-P.stallShadowPenalty):shadowScore;
  }
  const evidence={keyLevels,latestDate:ctx.analysisDate,previousDate:ctx.bars.at(-2)?.date??null};
  const continuation=trend.status!=='AVAILABLE'?'DATA_INSUFFICIENT':trendLifecycle.direction==='MIXED'?'WAITING_CONFIRMATION':
    bull.evidence.length>=2||momentumStall.isStalling?'INSUFFICIENT':
    ['RETEST_CONTINUATION','DIRECT_CONTINUATION'].includes(breakoutConfirmation.status)&&
      breakoutConfirmation.selected.direction==='BULL'&&trendLifecycle.direction==='BULL'?'SUFFICIENT':
    trendLifecycle.direction==='BULL'?'ORDINARY':'WAITING_CONFIRMATION';
  return {...envelope,evidence,facts:{close:ctx.bars.at(-1).close,change:ctx.bars.length>1?
      round(ctx.bars.at(-1).close/ctx.bars.at(-2).close-1):null},
    trendLifecycle,momentumExhaustion:{bull,bear},continuation,reversalWatch,openingConfirmation,momentumStall,stallAdjustedScore,
    breakoutConfirmation,fvgAnalysis,fvgPlan,fvgBreakoutQuality:fvgAnalysis.selected?.fvgBreakoutQuality??null,
    marketRegime:regime,openDefenseLevel:regime.openDefenseLevel??null,
    marketBreadth:ctx.index?marketBreadth(ctx,breadth):{status:'NOT_APPLICABLE'},relativeStrength:relative,nextSessionScenario:scenario,
    beginnerExplanation:{
      direction:trendLifecycle.label,
      momentum:trendLifecycle.alert??momentumStall.summary??null,
      breakout:breakoutConfirmation.status==='FAILED_BREAKOUT'?'突破關卡後，收盤又回到原區間。':
        breakoutConfirmation.status==='RETEST_HELD'?'突破後回來測試關卡，暫時守住。':null,
      pattern:reversalWatch.summary??regime.summary??null,
      next:scenario.conditions?.map(c=>c.summary)??['目前尚無明確位置。']
    }};
}

return {MODE,PARAMETERS:P,analyze,relativeStrength,marketBreadth,confirmDefense:Patterns.confirmDefense};
});
