'use strict';

// Frozen before replay. The archived stock cohort is exploratory and has no point-in-time
// market-wide membership history. Never use its results to enable production research.
module.exports = Object.freeze({
  protocolVersion:'V9.26-STUDY-1',
  horizons:[1,3,5],
  purgeSessions:5,
  trainFraction:.55,
  holdoutBlocks:3,
  minimumOverall:100,
  minimumPerEvent:30,
  minimumPrecisionLift:.05,
  roundTripStockBps:60,
  cpuBudgetP95Ms:8,
  releaseGate:'REQUIRES_INDEPENDENT_POINT_IN_TIME_MULTI_YEAR_STOCK_AND_INDEX_STUDY',
  instruments:[
    {symbol:'TAIEX',path:'data/index/TAIEX.json'},
    {symbol:'2330',path:'data/research/2026-11-26/2330.json'},
    {symbol:'8099',path:'data/research/2026-11-26/8099.json'}
  ],
  outcomes:{
    directional:'Next official session open to the close 1, 3 or 5 official sessions later. Positive for long, negative for short.',
    defense:'The exact next completed session opened below the frozen price. The result does not use a later substitute.',
    failure:'Within five subsequent sessions, a close crossed back through the frozen breakout level and tolerance.',
    baseline:'Same-date price vs MA20 sign, with identical outcome windows.',
    fill:'For an active FVG follow-up records zone touch. Index levels are observations and unknown stock fills are excluded.'
  }
});
