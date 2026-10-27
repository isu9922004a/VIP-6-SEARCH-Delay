import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTwseMarketCalendar,
  expectedCompletedDate,
  marketCalendarClosure,
  reconcileLatestTradeDate,
  verifySnapshotAdvancement,
  verifyMarketSnapshotCoverage
} from '../update-market-snapshot.mjs';

function twTime(day, hour='20:00') {return new Date(`${day}T${hour}:00+08:00`);}
function quoteRows(day) {return [{Code:'2330',Date:day}];}
const latest = date => ({rows:quoteRows(date)});
const calendar = buildTwseMarketCalendar([
  {Date:'20261026',Name:'臺灣光復暨金門古寧頭大捷紀念日補假'},
  {Date:'20261022',Name:'農曆春節前最後交易日'},
  {Date:'20260101',Name:'中華民國開國紀念日'}
]);

test('confirmed typhoon closure is loaded even though absent from annual holiday API',()=>{
  const c=marketCalendarClosure(calendar,'20261023');
  assert.match(c?.name||'',/颱風/);
  assert.ok(c.source.startsWith('https://'));
  assert.ok(calendar.closures.some(x=>x.date==='20261023'));
});

test('latest complete trading day over long typhoon holiday and Monday makeup holiday',()=>{
  const cases=[
    ['2026-10-22','20:00','20261022'],
    ['2026-10-23','20:00','20261022'],
    ['2026-10-24','20:00','20261022'],
    ['2026-10-25','20:00','20261022'],
    ['2026-10-26','20:00','20261022'],
    ['2026-10-27','10:00','20261022'],
    ['2026-10-27','18:00','20261027']
  ];
  for (const [date,time,expected] of cases) {
    assert.equal(expectedCompletedDate(calendar,twTime(date,time)),expected,`${date} ${time}`);
  }
});

test('on Oct 23 closure, same-dated latest feeds require no by-date fetch',async()=>{
  let calls=0;
  const rejectFetch=async()=>{ calls++; throw Error('by-date request must be skipped');};
  const outcome=await reconcileLatestTradeDate(latest('20261022'),latest('20261022'),{
    calendar,now:twTime('2026-10-23'),fetchTwseByDate:rejectFetch,fetchTpexByDate:rejectFetch
  });
  assert.equal(outcome.twseDate,'20261022');
  assert.equal(outcome.tpexDate,'20261022');
  assert.equal(calls,0);
});

test('on a real trading day, stale latest feeds still trigger verified by-date fetch',async()=>{
  let calls=[];
  const fetchTwseByDate=async date=>{calls.push(`twse:${date}`);return latest(date);};
  const fetchTpexByDate=async date=>{calls.push(`tpex:${date}`);return latest(date);};
  const outcome=await reconcileLatestTradeDate(latest('20261022'),latest('20261022'),{
    calendar,now:twTime('2026-10-27','20:00'),fetchTwseByDate,fetchTpexByDate
  });
  assert.deepEqual(calls,['twse:20261027','tpex:20261027']);
  assert.equal(outcome.twseDate,'20261027');
  assert.equal(outcome.tpexDate,'20261027');
});

test('closed-day expected snapshot passes, but stale snapshot fails on first active day',()=>{
  const snapshot={tradeDate:'20261022',marketCalendar:calendar};
  assert.equal(verifySnapshotAdvancement(snapshot,null,twTime('2026-10-23')).expectedTradeDate,'20261022');
  assert.equal(verifySnapshotAdvancement(snapshot,null,twTime('2026-10-26')).expectedTradeDate,'20261022');
  assert.throws(()=>verifySnapshotAdvancement(snapshot,null,twTime('2026-10-27','20:00')),/最近已完成交易日/);
  assert.throws(()=>verifySnapshotAdvancement({tradeDate:'20261027',marketCalendar:calendar},null,twTime('2026-10-23')),/晚於/);
});

test('previously persisted snapshot must have genuine matching stock dates and counts',()=>{
  const rows=[
    ...Array.from({length:800},(_,i)=>({code:String(1000+i),market:'TWSE',quoteDate:'20261022'})),
    ...Array.from({length:600},(_,i)=>({code:String(2000+i),market:'TPEX',quoteDate:'20261022'}))
  ];
  const snapshot={tradeDate:'20261022',marketCoverageReady:true,counts:{twseRows:800,tpexRows:600,totalRows:1400},rows};
  assert.equal(verifyMarketSnapshotCoverage(snapshot).tradeDate,'20261022');
  assert.throws(()=>verifyMarketSnapshotCoverage({...snapshot,rows:[...rows.slice(0,-1),{...rows.at(-1),quoteDate:'20261021'}]}),/date\/code invalid/);
  assert.throws(()=>verifyMarketSnapshotCoverage({...snapshot,counts:{twseRows:800,tpexRows:601,totalRows:1401}}),/incomplete/);
});

const {loadOfficialQuotePair}=await import('../update-market-snapshot.mjs');
test('latest source outage independently recovers only that market by expected completed date',async()=>{
 const calls=[];
 const pair=await loadOfficialQuotePair({calendar,now:twTime('2026-10-27'),
  fetchLatest:async(_,label)=>{if(label.startsWith('TPEx'))throw Error('HTTP 503');return latest('20261027');},
  fetchTpexByDate:async d=>{calls.push(d);return latest(d);},fetchTwseByDate:async()=>{throw Error('must not refetch TWSE');}});
 assert.deepEqual(calls,['20261027']);assert.equal(pair.tpex.recoveryFromLatestFailure,'HTTP 503');
 assert.equal(pair.twse.rows[0].Date,'20261027');
});
test('a dated recovery cannot relabel an old response as today',async()=>{
 await assert.rejects(loadOfficialQuotePair({calendar,now:twTime('2026-10-27'),fetchLatest:async()=>{throw Error('offline');},fetchTwseByDate:async()=>latest('20261022'),fetchTpexByDate:async()=>latest('20261027')}),/recovery mismatch/);
});
test('intraday fallback still requests the previous verified completed session',async()=>{
 const calls=[];const dated=async d=>{calls.push(d);return latest(d);};
 await loadOfficialQuotePair({calendar,now:twTime('2026-10-27','10:00'),fetchLatest:async()=>{throw Error('offline');},fetchTwseByDate:dated,fetchTpexByDate:dated});
 assert.deepEqual(calls,['20261022','20261022']);
});
