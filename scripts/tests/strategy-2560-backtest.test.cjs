'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),B=require('../../strategy-2560-backtest-v1'),{fixture}=require('../strategy-2560-fixture.cjs');
function nextDates(last,n){const a=[],d=new Date(last+'T00:00:00Z');while(a.length<n){d.setUTCDate(d.getUTCDate()+1);if(![0,6].includes(d.getUTCDay()))a.push(d.toISOString().slice(0,10));}return a;}
test('no PIT evidence means unavailable, not fabricated zero win rate',()=>{const a=B.replay({series:[]},{testStart:'2026-01-01',testEnd:'2026-12-31'});assert.equal(a.state,'NOT_VALIDATED');assert.equal(a.winShare,undefined);assert.deepEqual(a.trades,[]);});
test('V9.1 offers research-only horizons; never implies MA5 liquidation or signal-date fill',()=>{
 const f=fixture(),last=f.report.canonicalBars.at(-1),future=nextDates(last.date,5);
 for(let i=0;i<5;i++)f.report.canonicalBars.push({date:future[i],open:120+i,high:125+i,low:118+i,close:122+i,volume:1000000});
 f.report.expectedTradingDates.push(...future);
 const sectorsByDate=Object.fromEntries(f.report.expectedTradingDates.map(d=>[d,f.options.sector]));
 const a=B.replay({pointInTimeUniverseVerified:true,priceHistoryVerified:true,calendarVerified:true,corporateActionsVerified:true,series:[{report:f.report,sectorsByDate}]},{testStart:last.date,testEnd:future.at(-1)});
 assert.equal(a.state,'RESEARCH_ONLY');assert.equal(a.trades[0].entry,120);assert.notEqual(a.trades[0].entry,last.close);
 assert.equal(a.trades[0].entryDate,future[0]);assert.equal(a.trades[0].outcomes[1].date,future[0]);
 assert.ok(a.trades[0].outcomes[1].netPct<a.trades[0].outcomes[1].grossPct);
 assert.equal(a.trades[0].exitRule,'NOT_DEFINED');assert.equal(a.trades[0].autoExit,false);
 assert.equal(a.trades[0].actualExecution,false);assert.equal(a.performanceValidated,false);
 assert.equal(a.winShare,null);
});
