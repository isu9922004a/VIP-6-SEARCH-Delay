'use strict';
/* V9.13 frozen complete-day regression against real historical reports, no mocked price outcomes. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../../kline-life-03-core-v1.js');
const Info=require('../../life-line-intelligence-v913.js');
const RiskOld=require('../../market-life-risk-v910.js');
const RiskNew=require('../../market-life-risk-v913.js');
const raw16=require('../../data/research/2026-11-16/5013.json');
const raw17=require('../../data/research/2026-11-17/5013.json');
const official=require('../fixtures/taiex-20261117-v913.json');
const stock16=Core.evaluate(raw16),stock17=Core.evaluate(raw17);
const indexCore=Core.evaluate({code:'TAIEX',name:'臺灣加權股價指數',date:official.closeDate,sourceBars:official.dailySeries,validation:{technicalModelAvailable:true},completed:true,priceAdjustment:official.priceAdjustment});
const index={...indexCore,instrumentType:'TAIEX',sourceVerified:true};
function event(s,k0,side,price){return s.events.find(e=>e.k0Date===k0&&e.side===side&&e.lifeLinePrice===price);}
test('V9.13 2026-11-16 strong-new original bull K3 stays fixed 56.20',()=>{
 assert.equal(stock16.date,'2026-11-16');assert.equal(stock16.close,60.60);
 assert.equal(stock16.event.k0Date,'2026-11-05');assert.equal(stock16.event.k3Date,'2026-11-02');
 assert.equal(stock16.event.lifeLinePrice,56.20);
 const k3=raw16.dailySeries.find(b=>b.date==='2026-11-02');
 assert.equal(k3.high,60.60);assert.equal(k3.low,56.20);
 const i=Info.evaluate(stock16,{securityMarket:'TPEX'});
 assert.equal(i.activeSupportEvent?.lifeLinePrice,56.2);
 assert.equal(i.marketVerified,false);
});
test('V9.13 2026-11-17 bear K0 70.90 is new pressure, not buy breakout',()=>{
 assert.equal(stock17.date,'2026-11-17');assert.equal(stock17.close,66.60);
 const i=Info.evaluate(stock17,{securityMarket:'TPEX'});
 assert.equal(i.selectedPrimaryEvent?.k3Date,'2026-11-12');
 assert.equal(i.selectedPrimaryEvent?.k0Date,'2026-11-17');
 assert.equal(i.selectedPrimaryEvent?.side,'BEAR');
 assert.equal(i.selectedPrimaryEvent?.lifeLinePrice,70.90);
 assert.equal(i.activeResistanceEvent?.lifeLinePrice,70.90);
 assert.equal(i.activeSupportEvent?.lifeLinePrice,56.20);
 assert.match(i.lifeStatus,/空方壓力K0剛成立/);
 assert.equal(i.priceTrend,'偏強觀察');
 assert.match(i.scenarios[0].text,/70.90/);
 assert.doesNotMatch(i.trendText,/突破成功|主升段確認/);
 assert.equal(i.riskReasons.some(s=>s.includes('漲停不等於')),true);
});
test('V9.13 preserve original historical event IDs and levels, prevent future-lookahead',()=>{
 const past=event(stock16,'2026-11-05','BULL',56.20),now=event(stock17,'2026-11-05','BULL',56.20);
 assert.ok(past);assert.ok(now);
 assert.equal(past.eventId,now.eventId);assert.equal(past.originalEvent.lifeLinePrice,56.20);
 assert.equal(now.originalEvent.lifeLinePrice,56.20);
 assert.equal(stock16.events.some(e=>e.k0Date==='2026-11-17'),false);
 assert.equal(stock17.events.some(e=>e.k0Date==='2026-11-17'),true);
});
test('V9.13 reject corrupted K3 value, cross-date market and unconfirmed foreign-market data',()=>{
 const changed=structuredClone(stock17);changed.events[changed.events.length-1].lifeLinePrice=71.0;
 assert.throws(()=>Info.evaluate(changed),/K3原始價格/);
 const notTpex={date:'2026-11-17',instrumentType:'TAIEX',sourceVerified:true,risk:{level:3,label:'偏弱'},metrics:{returnPct:-2.31}};
 const no=Info.evaluate(stock17,{market:notTpex,securityMarket:'TPEX'});
 assert.equal(no.marketVerified,false);
 assert.match(no.context,/不拿其他市場代替/);
 const tpex={...notTpex,instrumentType:'TPEX',metrics:{returnPct:-3.92}};
 const ok=Info.evaluate(stock17,{market:tpex,securityMarket:'TPEX'});
 assert.equal(ok.marketVerified,true);
 assert.ok(ok.relativeStrengthStatus>0);
 const stale=Info.evaluate(stock17,{market:{...tpex,date:'2026-11-16'},securityMarket:'TPEX'});
 assert.equal(stale.marketVerified,false);
});
test('V9.13 market frozen verified 11/17 data remains valid and clearly weak',()=>{
 assert.equal(indexCore.close,40092.11);
 assert.equal(indexCore.validatedBars.length,120);
 const prior=RiskOld.evaluate(index),after=RiskNew.evaluate(index);
 assert.equal(after.risk.level,prior.risk.level);
 assert.equal(after.risk.level,3);
 assert.equal(after.phase.state,'POST_SHOCK_WEAKNESS');
 assert.equal(after.activeScenario,'C');
 assert.equal(after.metrics.ma5,42431.27);
 assert.equal(after.metrics.ma20,43986.95);
 assert.equal(after.phase.weakClosesBelow20,5);
 assert.ok(after.phase.previousShocks.some(x=>x.date==='2026-11-16'));
 assert.match(after.scenarios.find(x=>x.id==='B').text,/不能單純稱為盤整/);
 assert.equal(after.performanceValidated,false);
 assert.equal(after.affectsEligibility,false);
});
test('V9.13 both research layers are read-only; not authorized to rank or trade',()=>{
 const bs=JSON.stringify(stock17),bm=JSON.stringify(index);
 const s=Info.evaluate(stock17,{securityMarket:'TPEX'}),m=RiskNew.evaluate(index);
 assert.equal(JSON.stringify(stock17),bs);
 assert.equal(JSON.stringify(index),bm);
 assert.equal(s.affectsRanking,false);assert.equal(s.affectsEligibility,false);
 assert.equal(m.researchOnly,true);
 assert.equal(Object.isFrozen(s),true);assert.equal(Object.isFrozen(m),true);
});
test('V9.15 beginner labels never expose raw lifecycle codes',()=>{
 for(const code of ['SUPPORT_WATCH','RESISTANCE_WATCH','RETEST_HELD','INSUFFICIENT_DATA','RECOVERY_CONFIRMED','BREAKOUT_INITIAL','BREAKOUT_FAILED','SUPPORT_BROKEN','SUPPORT_RECLAIMED','ACTIVE_SHOCK','REBOUND_ATTEMPT','NORMAL_OR_UNCONFIRMED']){
  assert.notEqual(Info.statusLabel(code),'生命線狀態待確認',code);
  assert.match(Info.statusLabel(code),/[\u3400-\u9fff]/);
 }
 assert.equal(Info.statusLabel('BREAKOUT_HELD'),'突破後仍守住支撐');
 assert.equal(Info.statusLabel('POST_SHOCK_WEAKNESS'),'大跌後仍未恢復強勢');
 assert.equal(Info.statusLabel('UNKNOWN_FUTURE_STATE'),'生命線狀態待確認');
 assert.equal(Info.statusLabel('SUPPORT_BROKEN'),'已跌破重要支撐');
 assert.equal(Info.statusLabel('SUPPORT_RECLAIMED'),'已重新站回重要價位');
 assert.doesNotMatch(Info.evaluate(stock16).lifeStatus,/[A-Z]{2,}_[A-Z0-9_]+/);
});
