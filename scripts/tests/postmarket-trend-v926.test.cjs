'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../../postmarket-patterns-v926.js');
const R=require('../../postmarket-trend-v926.js');
const Common=require('../../research-common-v1.js');
const days=require('../../data/market/research-calendar.json').dates.slice(-83);
const date=(i)=>days[i];
const asOf=d=>d+'T19:00:00+08:00';
function candle(i,close=100,options={}) {
  return {date:date(i),open:close,high:close+1,low:close-1,close,volume:100000,...options};
}
function bundle(n=70,market='TAIEX',bars=Array.from({length:n},(_,i)=>candle(i))) {
  const index=market==='TAIEX'||market==='TPEX_INDEX';
  const end=date(n-1);
  return {analysisDate:end,dataAsOf:asOf(end),pointInTime:true,complete:true,source:'synthetic unit fixture',
    instrument:{code:index?market:'2317',market,basis:index?'OFFICIAL_INDEX_LEVEL':'UNADJUSTED_OFFICIAL_OHLC',
      securityType:index?'INDEX':'COMMON',tickRuleVerified:!index},
    calendar:{verified:true,source:'fixture of real session dates',dates:days},
    bars,actionByDate:Object.fromEntries(days.map(d=>[d,{verified:true,source:'test',publishedAt:asOf(d),status:'NONE'}]))};
}
const tick=()=>.01;
const context=snapshot=>P.createContext(snapshot);

test('analysis shape is isolated and future rows, action announcements and universe revisions cannot change T',()=>{
  const base=bundle();
  const options={breadth:{verified:false,date:date(69),members:[]}};
  const actual=R.analyze(base,options);
  assert.equal(actual.mode,'SHADOW_ONLY');
  assert.equal(actual.analysisDate,date(69));
  assert.equal(actual.dataCoverage.contiguous,70);
  assert.equal(actual.momentumExhaustion.bull.score,null);
  assert.equal(actual.momentumExhaustion.bull.researchScore,null);
  const future={...base,bars:[...base.bars,candle(70,320),candle(71,280),candle(72,290,{completed:false})],
    actionByDate:{...base.actionByDate,[date(70)]:{status:'MECHANICAL',publishedAt:asOf(date(70)),verified:true}}};
  assert.deepEqual(R.analyze(future,{breadth:{date:date(70),verified:true,members:[{code:'2222'}]}}),actual);
  const stock=bundle(70,'TWSE');
  const changed={...stock,actionByDate:{...stock.actionByDate,[date(55)]:{status:'MECHANICAL',verified:true,source:'late revision',publishedAt:asOf(date(70))}}};
  const original={...stock,actionByDate:{...stock.actionByDate,[date(55)]:undefined}};
  assert.deepEqual(R.analyze(changed),R.analyze(original));
  assert.equal(R.analyze({...base,analysisDate:'2026-10-03'}).status,'DATA_INSUFFICIENT');
  for(const malformed of [null,NaN,Infinity,0]) {
    const bars=base.bars.with(-1,candle(69,100,{volume:malformed}));
    assert.equal(R.analyze({...base,bars}).status,'DATA_INSUFFICIENT');
  }
  for(const bad of [{completed:false},{noTrades:true},{suspended:true},{low:101},{high:99},{code:'OTHER'}]) {
    assert.equal(R.analyze({...base,bars:base.bars.with(-1,candle(69,100,bad))}).status,'DATA_INSUFFICIENT');
  }
  const duplicate={...base,bars:[...base.bars,base.bars.at(-1)]};
  assert.equal(R.analyze(duplicate).status,'DATA_INSUFFICIENT');
  assert.equal(P.doji({open:10,close:10,low:10,high:10}),false);
});

test('surge/doji waits for the exact T+1 completed bar and cannot be confirmed by a later session',()=>{
  const s=bundle(70,'TWSE');
  s.bars[68]=candle(68,108,{open:100,low:99,high:109,
    reference:{verified:true,source:'test',price:100,upperLimit:110,publishedAt:date(68)+'T09:00:00+08:00'}});
  s.bars[69]=candle(69,108.5,{open:108.5,low:106,high:110});
  const computed=R.analyze(s);
  const w=computed.reversalWatch;
  assert.equal(w.status,'WATCH_NEXT_OPEN');
  assert.equal(w.nextSessionDate,date(70));
  assert.equal(w.nextDayOpenDefensePrice,108.5);
  const withNext=bars=>bundle(71,'TWSE',[...s.bars,...bars]);
  assert.equal(R.confirmDefense(w,s).status,'WATCH_NEXT_OPEN');
  assert.equal(R.confirmDefense(w,withNext([candle(70,109,{open:108})])).status,'TRIGGERED_WEAK');
  assert.equal(R.confirmDefense(w,withNext([candle(70,109,{open:108.5})])).status,'OPEN_DEFENSE_HELD');
  assert.equal(R.confirmDefense(w,withNext([candle(70,109,{open:108,completed:false})])).status,'UNCONFIRMED');
  const missing=bundle(72,'TWSE',[...s.bars,candle(71,100,{open:99})]);
  assert.equal(R.confirmDefense(w,missing).status,'EXPIRED');
  assert.equal(R.analyze({...s,bars:[...s.bars,candle(70,100)]}).reversalWatch.status,'WATCH_NEXT_OPEN');
  s.bars[68].reference=null;
  assert.equal(R.analyze(s).reversalWatch.status,'DATA_INSUFFICIENT');
});

test('stall uses non-overlapping windows and a frozen highest closing price',()=>{
  const s=bundle();
  for(let i=56;i<=65;i++) s.bars[i]=candle(i,100+(i-56),{volume:120000});
  for(let i=66;i<70;i++) s.bars[i]=candle(i,108,{high:108.2,low:107.8,volume:60000});
  const a=R.analyze(s,{shadowScore:80});
  assert.equal(a.momentumStall.status,'HIGH_LEVEL_STALL');
  assert.equal(a.momentumStall.referenceHigh,109);
  assert.equal(a.momentumStall.stallingDays,4);
  assert.ok(a.momentumStall.rangeRatio<.65);
  assert.ok(a.momentumStall.volumeRatio<.85);
  assert.equal(a.stallAdjustedScore,75);
  s.bars[68]=candle(68,110);
  assert.equal(R.analyze(s).momentumStall.isStalling,false);
  assert.equal(R.analyze({...s,bars:s.bars.filter(row=>row.date!==date(59))}).momentumStall.isStalling,null);
});

test('pre-breakout window excludes the trigger bar and retest only becomes continuation after the touch day',()=>{
  const s=bundle();
  s.bars[68]=candle(68,104,{open:100,low:99,high:105});
  const prefix=bundle(69,'TAIEX',s.bars.slice(0,69));
  const initial=R.analyze(prefix).breakoutConfirmation;
  assert.equal(initial.status,'INITIAL_BREAKOUT');
  assert.equal(initial.selected.level,101);
  s.bars[69]=candle(69,102,{low:101,high:104});
  const retest=R.analyze(s).breakoutConfirmation;
  assert.equal(retest.status,'RETEST_HELD');
  assert.equal(retest.selected.confirmationDate,null);
  const after=b=>R.analyze(bundle(71,'TAIEX',[...s.bars,b])).breakoutConfirmation.events.find(e=>e.eventDate===date(68)&&e.window===20);
  assert.equal(after(candle(70,106)).status,'RETEST_CONTINUATION');
  assert.equal(after(candle(70,99)).status,'FAILED_BREAKOUT');
  s.bars[69]=candle(69,106);
  assert.equal(R.analyze(s).breakoutConfirmation.events.find(e=>e.eventDate===date(68)).status,'DIRECT_CONTINUATION');
});

test('FVG formation, contact, partial/full fill, invalidation, and company action are distinct',()=>{
  const seed=bundle();
  seed.bars[67]=candle(67,100,{low:99,high:101});
  seed.bars[68]=candle(68,105,{open:101,low:100,high:106});
  seed.bars[69]=candle(69,108,{open:107,low:106.5,high:109});
  const formative=ctx=>P.fvgAnalysis(context(ctx),tick).events.find(e=>e.formedDate===date(69));
  const formed=formative(seed);
  assert.equal(formed.status,'OPEN');
  assert.equal(formed.firstContactDate,null);
  assert.equal(formed.zoneLow,101);
  assert.equal(formed.zoneHigh,106.5);
  assert.equal(formed.fvgBreakoutQuality,'CONFIRMED_FVG');
  const withBar=bar=>bundle(71,'TAIEX',[...seed.bars,bar]);
  const edge = formative(withBar(candle(70,108,{low:106.5})));
  assert.equal(edge.fillRatio,0);
  assert.equal(edge.firstContactDate,date(70));
  assert.equal(edge.retestState,'RETEST_TOUCHED');
  const partial=formative(withBar(candle(70,105,{low:104})));
  assert.equal(partial.status,'PARTIAL_FILL');
  assert.ok(partial.fillRatio>0&&partial.fillRatio<1);
  assert.equal(partial.retestState,'IN_RETEST_ZONE');
  const invalid=formative(withBar(candle(70,100,{low:99})));
  assert.equal(invalid.invalidatedDate,date(70));
  assert.equal(invalid.fullyFilledDate,date(70));
  assert.equal(invalid.active,false);
  const stock=bundle(70,'TWSE',seed.bars);
  stock.actionByDate[date(68)].status='MECHANICAL';
  assert.equal(formative(stock),undefined);
  stock.actionByDate[date(68)].status='UNKNOWN';
  assert.equal(formative(stock).status,'DATA_INSUFFICIENT');
  const gap=bundle(70,'TAIEX',seed.bars.filter(b=>b.date!==date(68)));
  assert.equal(R.analyze(gap).fvgAnalysis.status,'DATA_INSUFFICIENT');
});

test('bearish and bullish plans respect legal ticks and enforce stop and targets away from entry',()=>{
  for(const direction of ['BEAR','BULL']) {
    const zone={active:true,zoneLow:995,zoneHigh:1005,direction};
    const plan=P.fvgPlan(zone,{tickVerified:true,atr:8,nextLimit:{verified:true,upper:1010,lower:990}});
    assert.equal(plan.status,'RESEARCH_ONLY');
    assert.ok([plan.entryRef,plan.stopRef,plan.target2R,plan.target3R].every(Common.legal));
    assert.ok(plan.actualR2>=2 && plan.actualR3>=3);
    assert.equal(plan.crossSession2R,true);
    assert.equal(P.fvgPlan(zone,{tickVerified:false}).status,'DATA_INSUFFICIENT');
  }
  assert.equal(P.fvgPlan({active:true,direction:'BEAR',zoneLow:.01,zoneHigh:5},{tickVerified:true}).status,'DATA_INSUFFICIENT');
  assert.equal(P.roundPrice(9.999,1,false),10);
  assert.equal(P.roundPrice(10.001,-1,false),10);
  assert.equal(P.roundPrice(49.991,1,false),50);
  assert.equal(P.roundPrice(999.99,1,false),1000);
});

test('market breadth requires date-bound membership; partial market bars never yield a market-wide fraction',()=>{
  const s=bundle();
  const mk=(code,market,change)=>({code,market,change,securityType:'COMMON',completed:true,date:date(69),
    close:10,high:11,low:9,historyVerified:true,ma20:9.5,prior20High:12,prior20Low:9.5});
  const feed={date:date(69),verified:true,source:'synthetic full member list',publishedAt:asOf(date(69)),expected:{TWSE:2,TPEX:1},
    members:[mk('1000','TWSE',-1),mk('2000','TWSE',0),mk('3000','TPEX',1)],
    indices:{TWSE:{verified:true,date:date(69),change:.02}}};
  const full=R.analyze(s,{breadth:feed}).marketBreadth;
  assert.equal(full.status,'AVAILABLE');
  assert.equal(full.markets.TWSE.proportions.down,.5);
  assert.equal(full.markets.TWSE.divergence,true);
  feed.members[1].completed=false;
  const partial=R.analyze(s,{breadth:feed}).marketBreadth;
  assert.equal(partial.status,'DATA_INSUFFICIENT');
  assert.equal(partial.markets.TWSE.coverage.missingQuotes,1);
  assert.equal(partial.markets.TWSE.proportions,null);
  assert.equal(partial.markets.TPEX.proportions.up,1);
});

test('relative return uses corresponding market and the same trading-date window',()=>{
  const stock=bundle(70,'TWSE',Array.from({length:70},(_,i)=>candle(i,100+i)));
  const tpex=bundle(70,'TPEX_INDEX'), taiex=bundle();
  assert.equal(R.analyze(stock,{benchmark:tpex}).relativeStrength.status,'DATA_INSUFFICIENT');
  assert.equal(R.analyze(stock,{benchmark:taiex}).relativeStrength.status,'STRONG');
  stock.actionByDate[date(63)].status='MECHANICAL';
  assert.equal(R.analyze(stock,{benchmark:taiex}).relativeStrength.status,'DATA_INSUFFICIENT');
});

test('historical scenario contains three disjoint close ranges and uses no next-session OHLCV',()=>{
  const s=bundle();
  s.bars[69]=candle(69,98,{high:101,low:97});
  const a=R.analyze(s);
  assert.equal(a.marketRegime.selloff,true);
  assert.equal(a.nextSessionScenario.status,'HYPOTHETICAL');
  const [bull,bear,range]=a.nextSessionScenario.conditions;
  assert.equal(bull.operator,'>');
  assert.equal(bear.operator,'<');
  assert.equal(range.lower,bear.price);
  assert.equal(range.upper,bull.price);
  assert.equal(range.inclusive,true);
  assert.match(a.beginnerExplanation.next[0],new RegExp(String(bull.price)));
  const noFuture={...s,calendar:{...s.calendar,dates:days.slice(0,70)}};
  assert.equal(R.analyze(noFuture).nextSessionScenario.status,'DATA_INSUFFICIENT');
});

test('market consolidation waits for verified flat structure and never upgrades the legacy risk',()=>{
  const s=bundle();
  s.bars[69]=candle(69,100,{open:99.3});
  const level={date:date(69),publishedAt:asOf(date(69)),verified:true,source:'test 0–3 K event',market:'TAIEX',code:'TAIEX',price:100};
  assert.equal(R.analyze(s,{levels:{lifeLine:level}}).marketRegime.status,'NO_TRADE_CONSOLIDATION');
  assert.equal(R.analyze(s).marketRegime.status,'DATA_INSUFFICIENT');
  const indexWatch=R.analyze(bundle()).marketRegime.openDefense;
  assert.equal(indexWatch.status,'WATCH_NEXT_OPEN');
  const withBar=bundle(71,'TAIEX',[...s.bars,candle(70,99,{open:99})]);
  assert.equal(R.confirmDefense(indexWatch,withBar).status,'TRIGGERED_WEAK');
  assert.equal(R.confirmDefense(indexWatch,bundle(71,'TWSE')).status,'INVALIDATED');
});

test('bearish FVG bounds and direct continuation use completed closes after formation',()=>{
  const base=bundle();
  base.bars[67]=candle(67,102,{low:101,high:104});
  base.bars[68]=candle(68,98,{open:102,low:96,high:103});
  base.bars[69]=candle(69,94,{open:95,low:93,high:95});
  const event=raw=>R.analyze(raw).fvgAnalysis.events.find(row=>row.formedDate===date(69));
  const result=event(base);
  assert.equal(result.direction,'BEAR');
  assert.deepEqual([result.zoneLow,result.zoneHigh],[95,101]);
  assert.equal(result.firstContactDate,null);
  const next=bundle(71,'TAIEX',[...base.bars,candle(70,91,{low:90,high:92})]);
  assert.equal(event(next).followThrough,'DIRECT_CONTINUATION');
  const touched=bundle(71,'TAIEX',[...base.bars,candle(70,96,{high:100,low:94})]);
  assert.equal(event(touched).status,'PARTIAL_FILL');
  assert.equal(event(touched).retestState,'IN_RETEST_ZONE');
});

test('legacy breakout references are frozen before the event and honor their original publication dates',()=>{
  const s=bundle();
  s.bars[68]=candle(68,105,{open:100,high:106,low:99});
  s.bars[69]=candle(69,107,{open:105,high:108,low:104});
  const anchor={kind:'NECKLINE',price:103,code:'TAIEX',market:'TAIEX',basis:'OFFICIAL_INDEX_LEVEL',
    knownDate:date(66),publishedAt:asOf(date(67)),verified:true,source:'confirmed fixture neckline'};
  const matched=result=>result.breakoutConfirmation.events.find(event=>event.anchor?.kind==='NECKLINE');
  const result=R.analyze(s,{anchors:[anchor,{...anchor}]});
  const event=matched(result);
  assert.equal(result.breakoutConfirmation.events.filter(e=>e.anchor).length,1);
  assert.equal(event.eventDate,date(68));
  assert.equal(event.anchor.knownDate,date(67));
  assert.equal(event.level,103);
  assert.equal(event.status,'DIRECT_CONTINUATION');
  for (const change of [
    {publishedAt:asOf(date(68))},{publishedAt:asOf(date(70))},{knownDate:date(69)},
    {market:'TWSE'},{basis:'UNADJUSTED_OFFICIAL_OHLC'},{invalidatedDate:date(67)},
    {source:null},{publishedAt:undefined}
  ]) assert.equal(matched(R.analyze(s,{anchors:[{...anchor,...change}]})),undefined);
  const derived={...anchor,publishedAt:undefined,availability:'DERIVED_FROM_COMPLETED_SESSION'};
  assert.equal(matched(R.analyze(s,{anchors:[derived]})).anchor.knownDate,date(66));
  assert.deepEqual(result.nextSessionScenario.observationDates,days.slice(70,75));
});
