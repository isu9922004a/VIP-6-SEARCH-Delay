'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),B=require('../../strategy-2560-backtest-v1'),{fixture}=require('../strategy-2560-fixture.cjs');
test('without point-in-time evidence a reported performance number is forbidden',()=>{
 const a=B.replay({series:[]},{testStart:'2026-01-01',testEnd:'2026-12-31'});assert.equal(a.state,'NOT_VALIDATED');assert.equal(a.winShare,undefined);assert.deepEqual(a.trades,[]);
});
test('V9.1 signal-day close is not a fill; observational 1/3/5 day outcomes use actual next sessions, not forced MA5 exits',()=>{
 const f=fixture(),last=f.report.canonicalBars.at(-1),nextDates=[];let d=new Date(last.date+'T00:00:00Z');
 while(nextDates.length<5){d.setUTCDate(d.getUTCDate()+1);if(![0,6].includes(d.getUTCDay()))nextDates.push(d.toISOString().slice(0,10));}
 for(let i=0;i<5;i++)f.report.canonicalBars.push({date:nextDates[i],open:120+i,high:125+i,low:118+i,close:122+i,volume:1e6});
 f.report.expectedTradingDates.push(...nextDates);
 const sectorsByDate=Object.fromEntries(f.report.expectedTradingDates.map(date=>[date,f.options.sector]));
 const a=B.replay({pointInTimeUniverseVerified:true,priceHistoryVerified:true,calendarVerified:true,corporateActionsVerified:true,series:[{report:f.report,sectorsByDate}]},{testStart:last.date,testEnd:nextDates.at(-1)});
 assert.equal(a.trades[0].entry,120);assert.notEqual(a.trades[0].entry,last.close);assert.equal(a.trades[0].entryDate,nextDates[0]);
 assert.equal(a.trades[0].outcomes[1].date,nextDates[0]);assert.ok(a.trades[0].outcomes[1].netPct<a.trades[0].outcomes[1].grossPct);
 assert.equal(a.trades[0].open,true);assert.equal(a.trades[0].exitSignal,null);assert.equal(a.performanceValidated,false);
});
