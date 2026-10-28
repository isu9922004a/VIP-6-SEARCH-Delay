'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../../research-n-continuation-v1.js'),C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js'),U=require('../../research-common-v1.js');
const {bars,report}=require('../research-fixtures.cjs');
const noCost={...N.PARAM,fee:0,tax:0,slippage:0};
function snap(b){return {id:'FIXED_PATTERN',parentId:null,A:{index:40,price:100,pivotDate:b[40].date,knownAt:b[43].date,knownAtIndex:43},B:{index:44,price:120,pivotDate:b[44].date,knownAt:b[47].date,knownAtIndex:47},C:{index:48,price:110,pivotDate:b[48].date,knownAt:b[51].date,knownAtIndex:51},knownAt:b[51].date,knownAtIndex:51,provisional:false};}
function fixture(n=55){return bars(n,()=>115);}
function set(b,i,x){b[i]={...b[i],...x};}
function actual(){const f=require('../fixtures/research-source-r17-8039.json');return report(structuredClone(f.daily.results[0].data.dailySeries),{stock:'8039',name:'台虹',priceAdjustment:{verified:false,basis:'UNKNOWN'},tradingCalendar:{verified:false},expectedTradingDates:undefined});}
test('video per-unit arithmetic is 2.625R, 5.75R and 0.8R, while missing stop is unknown',()=>{
 assert.equal(N.rewardRisk(3958,3942,4000,noCost).grossRR,2.625);assert.equal(N.rewardRisk(3958,3942,4050,noCost).grossRR,5.75);assert.equal(N.rewardRisk(4002,3942,4050,noCost).grossRR,.8);
 assert.equal(N.rewardRisk(4005,null,4050,noCost).status,'UNKNOWN');assert.ok(N.rewardRisk(3958,3942,4050).rr<5.75);
});
test('confirmed pivots never become usable on the earlier pivot date',()=>{
 const b=bars(80,i=>100+Math.sin(i*.45)*7),pv=N.pivots(b);
 assert.ok(pv.length>4);for(const x of pv){assert.equal(x.knownAt,b[x.index+3].date);assert.equal(x.knownAtIndex,x.index+3);assert.ok(x.knownAt>x.pivotDate);}
 for(let end=25;end<b.length;end++){const prefix=b.slice(0,end),x=N.evaluate(report(prefix));if(x.history)assert.ok(x.history.every(p=>p.knownAt<=prefix.at(-1).date));}
});
test('future bars do not rewrite previously emitted ABC snapshots',()=>{
 const b=bars(100,i=>100+Math.sin(i*.4)*5+i*.06),prefix=b.slice(0,75),a=N.evaluate(report(prefix)),z=N.evaluate(report(b));
 for(const old of a.history||[]){const found=z.history.find(x=>x.id===old.id);if(found)for(const k of ['A','B','C','knownAt'])assert.deepEqual(found[k],old[k]);}
});
test('a new lower confirmed C has a new identity and retains the original snapshot',()=>{
 const b=fixture(65),mk=(type,index,price)=>({type,index,price,pivotDate:b[index].date,knownAtIndex:index+3,knownAt:b[index+3].date});
 const pv=[mk('LOW',40,100),mk('HIGH',44,120),mk('LOW',48,112),mk('LOW',54,110)],a=N.snapshots(b,pv,'9001').records;
 assert.equal(a.length,2);assert.notEqual(a[0].id,a[1].id);assert.equal(a[1].parentId,a[0].id);assert.equal(a[0].C.price,112);assert.equal(a[1].C.price,110);
});
test('equal or below-A C and C at or above B are not accepted as rising N',()=>{
 const b=fixture(60),mk=(type,index,price)=>({type,index,price,pivotDate:b[index].date,knownAtIndex:index+1,knownAt:b[index+1].date});
 for(const cp of [99,100,120,121])assert.equal(N.snapshots(b,[mk('LOW',40,100),mk('HIGH',44,120),mk('LOW',48,cp)],'9001').records.length,0);
});
test('C entry is unavailable before C confirmation and cannot invent a stop',()=>{
 const b=fixture(54),x=snap(b);x.provisional=true;x.C.knownAt=null;x.knownAtIndex=53;x.knownAt=b[53].date;const p=N.lifecycle(x,b,N.PARAM);
 const entries=N.cases(p,b,[{price:120}],{priceBasisVerified:true,calendarVerified:true,volumeUsable:true,volumeRatio5:2,tickRuleVerified:true},N.PARAM);
 assert.equal(p.stage,'C_CANDIDATE');assert.equal(entries[0].planStop,null);assert.equal(entries[0].riskReward.status,'UNKNOWN');assert.notEqual(entries[0].entryDecision,'CONDITIONAL_RESEARCH');
});
test('a touch of B by high alone is not a completed-close breakout',()=>{
 const b=fixture(53);set(b,52,{high:121,close:119,open:118,low:115});assert.equal(N.lifecycle(snap(b),b,N.PARAM).breakout,null);
 set(b,52,{high:122,close:121,open:118,low:115});const p=N.lifecycle(snap(b),b,N.PARAM);assert.equal(p.breakout.date,b[52].date);assert.equal(p.breakoutThreshold,120.5);
});
test('new C plan loss is distinct from the lower A structural invalidation',()=>{
 const b=fixture(54);set(b,53,{open:112,high:116,low:109,close:115});const p=N.lifecycle(snap(b),b,N.PARAM);assert.equal(p.stage,'WAIT_NEW_C');assert.equal(p.A.price,100);
 set(b,53,{open:112,high:116,low:99,close:110});assert.equal(N.lifecycle(snap(b),b,N.PARAM).stage,'INVALIDATED');
});
test('the fixed C stop does not move when subsequent ATR increases',()=>{
 const b=fixture(60),early=N.lifecycle(snap(b),b.slice(0,53),N.PARAM);set(b,59,{open:115,high:125,low:111,close:118});assert.equal(N.lifecycle(snap(b),b,N.PARAM).stopC,early.stopC);
});
test('a retest needs a later completed bar and later reclaim; no retest means no retest RR',()=>{
 const b=fixture(55);set(b,52,{open:119,high:122,low:118,close:121});set(b,53,{open:121,high:122,low:120,close:121});set(b,54,{open:121,high:125,low:120.5,close:124});
 const pending=N.lifecycle(snap(b),b.slice(0,54),N.PARAM);assert.equal(pending.retest.status,'PENDING');
 const done=N.lifecycle(snap(b),b,N.PARAM);assert.equal(done.retest.status,'CONFIRMED');assert.equal(done.retest.confirmedAt,b[54].date);assert.ok(done.retest.stop<done.retest.low);
 const fresh=N.lifecycle(snap(b),b.slice(0,53),N.PARAM),entries=N.cases(fresh,b.slice(0,53),[{price:125}],{priceBasisVerified:true,calendarVerified:true,volumeUsable:true,volumeRatio5:2,tickRuleVerified:true},N.PARAM);
 assert.equal(entries[2].planStop,null);assert.equal(entries[2].riskReward.status,'UNKNOWN');
});
test('same-bar target and plan-stop touch is ambiguous, and entry-bar lows do not predate close entry',()=>{
 const b=fixture(55);set(b,52,{low:99,high:135,close:115});assert.equal(N.planPath(b,51,105,130).status,'AMBIGUOUS');
 assert.equal(N.planPath(b.slice(0,53),52,105,130).status,'OPEN');assert.equal(N.lifecycle(snap(b),b,N.PARAM).stage,'AMBIGUOUS');
});
test('stop and target observed on separate later dates retain the actual first-touch date',()=>{
 const b=fixture(56);set(b,52,{low:104,high:118,close:115});set(b,54,{low:110,high:132,close:125});assert.equal(N.planPath(b,51,105,130).status,'STOP_TOUCHED');
 set(b,52,{low:110,high:132,close:125});assert.equal(N.planPath(b,51,105,130).status,'TARGET_TOUCHED');
});
test('a projection cannot fill an absent verified upper barrier',()=>{
 const b=fixture(53);set(b,52,{open:119,high:122,low:118,close:121});const q=N.lifecycle(snap(b),b,N.PARAM),entries=N.cases(q,b,[],{priceBasisVerified:true,calendarVerified:true,volumeUsable:true,volumeRatio5:2,tickRuleVerified:true},N.PARAM);
 const x=entries[1];assert.equal(x.nearestVerifiedBarrier,null);assert.equal(x.riskReward.status,'UNKNOWN');assert.equal(x.entryDecision,'CANNOT_EVALUATE');assert.equal(x.projectionScenarioRR.usedForEligibility,false);assert.ok(x.projectionScenarioRR.grossRR>0);
});
test('known technical confirmation does not override low RR or missing price/calendar/volume evidence',()=>{
 const b=fixture(53);set(b,52,{open:119,high:122,low:118,close:121});const q=N.lifecycle(snap(b),b,N.PARAM),g={priceBasisVerified:true,calendarVerified:true,volumeUsable:true,volumeRatio5:2,tickRuleVerified:true};
 assert.equal(N.cases(q,b,[{price:122}],g,N.PARAM)[1].entryDecision,'DO_NOT_ENTER');
 for(const key of ['priceBasisVerified','calendarVerified','volumeUsable','tickRuleVerified'])assert.notEqual(N.cases(q,b,[{price:150}],{...g,[key]:false},N.PARAM)[1].entryDecision,'CONDITIONAL_RESEARCH');
});
test('volume readiness remains separate from the structural close breakout',()=>{
 const b=fixture(53);set(b,52,{open:119,high:122,low:118,close:121});const q=N.lifecycle(snap(b),b,N.PARAM),g={priceBasisVerified:true,calendarVerified:true,volumeUsable:true,volumeRatio5:.5,tickRuleVerified:true};
 const x=N.cases(q,b,[{price:160}],g,{...N.PARAM,maxStopPct:50})[1];assert.equal(x.signalStatus,'CONFIRMED');assert.equal(x.entryDecision,'WAIT');assert.ok(x.unmetConditions.length);
});
test('38.2 to 61.8 is descriptive, not a mandatory retracement rejection',()=>{
 const b=fixture(53),x=snap(b);x.C.price=105;const p=N.lifecycle(x,b,N.PARAM);assert.equal(p.commonRetracementBand,false);assert.equal(p.retracementPct,75);assert.notEqual(p.stage,'INVALIDATED');
});
test('Taiwan tick rounding crosses price buckets with valid legal plans',()=>{
 for(const raw of [9.999,10.001,49.999,50.001,99.999,100.001,499.999,500.001,999.999,1000.001])for(const d of [-1,1]){const p=N.price(raw,d);assert.ok(U.legal(p));assert.ok(d<0?p<=raw:p>=raw);}
});
test('invalid base data and explicitly disabled N do not fabricate cases',()=>{
 assert.equal(N.evaluate({stock:'9001'}).state,'DATA_INSUFFICIENT');assert.equal(N.evaluate(actual(),{enabled:false}).state,'DISABLED');
 assert.equal(N.evaluate(actual(),{parameters:{pivotRight:0}}).state,'DATA_INSUFFICIENT');
});
test('normal and saved fallback report modes carry the same N evidence without changing rank inputs',()=>{
 const input=actual(),before=JSON.stringify(input),a=C.evaluate(input),off=C.evaluate(input,{flags:{unifiedResearchEnabled:false}});
 assert.deepEqual(a.nContinuation,off.nContinuation);assert.equal(a.nContinuation.affectsOriginalRanking,false);assert.equal(JSON.stringify(input),before);
 for(const x of [a,off]){const v=R.view(x);assert.ok(v.details.some(x=>x.title==='N字三種進場比較'));assert.match(R.text(x),/等幅1.0/);}
 for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B'])assert.deepEqual(C.evaluate({report:input,code:input.stock,kind}).nContinuation,a.nContinuation);
});
test('N chart audit preserves dated points and never adds projection to verified pressure levels',()=>{
 const a=C.evaluate(actual()),before=JSON.stringify(a),fake={createElement:()=>({getContext:()=>null})},page=R.candlePage(a,{document:fake}),audit=JSON.parse(page.dataset.researchAudit);
 assert.ok(a.nContinuation.pattern);assert.equal(audit.nContinuation.id,a.nContinuation.pattern.id);assert.equal(audit.nContinuation.projection.countsAsVerifiedResistance,false);assert.equal(JSON.stringify(a),before);
 assert.ok(a.nContinuation.levels.every(x=>x.kind!=='UNVALIDATED_MEASURED_PROJECTION'));
});
