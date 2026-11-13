'use strict';
// Synthetic holiday records are test fixtures only; formal data stays unchanged.
const test=require('node:test'),assert=require('node:assert/strict');
const {calendar}=require('../update-kronos-sources.cjs');
const saved=require('../../data/kronos/calendar.json');
const completed=require('../../data/market/research-calendar.json');
const rolled=Array.from({length:12},(_,i)=>({Date:'11601'+String(i+1).padStart(2,'0'),Name:'年度測試資料'}));
const sourceDay='2026-11-13',closures=[{date:'20261023'}];
test('official 2027 calendar with real 2026 source only reuses independently verified 2026 dates',()=>{
 const c=calendar(rolled,sourceDay,closures,saved);
 assert.equal(c.coverageYear,'2026');
 assert.equal(c.annualSourceStatus,'VERIFIED_SAME_YEAR_CACHE');
 assert.equal(c.officialEndpointCoverageYear,'2027');
 assert.equal(c.sourceSha256,saved.sourceSha256);
 assert.deepEqual(c.dates.filter(x=>x<=sourceDay),completed.dates);
 assert.equal(c.dates.find(x=>x>sourceDay),'2026-11-16');
 assert.ok(!c.dates.includes('2026-10-23'));
});
test('annual-source rollover never invents current-year dates without verified historical evidence',()=>{
 for(const previous of [null,{...saved,verified:false},{...saved,coverageYear:'2027'},{...saved,sourceSha256:'fake'},
  {...saved,dates:saved.dates.slice(0,10)},{...saved,generatedAt:'2027-01-01T00:00:00Z'}])
  assert.throws(()=>calendar(rolled,sourceDay,closures,previous),/Verified current-year calendar unavailable/);
});
test('annual-source rollover rejects conflicting session chronology and known market closure',()=>{
 assert.throws(()=>calendar(rolled,sourceDay,closures,{...saved,dates:[...saved.dates].reverse()}),/chronological validation/);
 assert.throws(()=>calendar(rolled,sourceDay,[{date:'20261116'}],saved),/conflicts with verified closures/);
 assert.throws(()=>calendar(rolled,sourceDay,closures,{...saved,dates:saved.dates.filter(d=>d<=sourceDay)}),/no verified next session/);
});
test('only the immediate next-year official schedule is eligible for cached-year fallback',()=>{
 const 2028=rolled.map(x=>({...x,Date:'117'+x.Date.slice(3)}));
 assert.throws(()=>calendar(2028,sourceDay,closures,saved),/Calendar year does not match source date/);
 const mixed=[...rolled.slice(0,11),{Date:'1151211'}];
 assert.throws(()=>calendar(mixed,sourceDay,closures,saved),/Calendar year does not match source date/);
});
test('official schedule for matching source year remains the primary source',()=>{
 const c=calendar(rolled,'2027-11-13',[],null);
 assert.equal(c.coverageYear,'2027');
 assert.notEqual(c.annualSourceStatus,'VERIFIED_SAME_YEAR_CACHE');
 assert.equal(c.source,'https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule');
 assert.ok(c.dates.some(d=>d>'2027-11-13'));
});
