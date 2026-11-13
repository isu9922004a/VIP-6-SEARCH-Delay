'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {annualCalendar,annualRecords,calendar}=require('../update-kronos-sources.cjs');
const target='2026', fixture={stat:'ok',queryYear:2026,data:[
 ['2026-01-01','元旦','休市'],['2026-01-02','國曆新年開始交易日','開始交易'],
 ['2026-02-11','農曆春節前最後交易日','最後交易日'],['2026-02-12','市場無交易','結算'],
 ['2026-02-13','市場無交易','結算'],['2026-02-16','農曆春節','放假'],
 ['2026-02-17','農曆春節','放假'],['2026-02-18','農曆春節','放假'],
 ['2026-02-19','農曆春節','放假'],['2026-02-20','農曆春節','放假']
]};
test('year-pinned official calendar query rejects a silently rolled-over future year',async()=>{
 const years=[];const result=await annualCalendar('2026-11-13',async url=>{years.push(url);return fixture;});
 assert.match(years[0],/date=2026/);assert.match(years[0],/twse.com.tw/);assert.equal(result.records.length,10);
 assert.throws(()=>annualRecords({...fixture,queryYear:2027},target),/requested year/);
 assert.throws(()=>annualRecords({...fixture,data:[...fixture.data.slice(0,9),['2027-01-01','wrong year','']]},target),/invalid/);
});
test('official last trading day remains a trading day, and closed days remain excluded',()=>{
 const cal=calendar(annualRecords(fixture,target),'2026-01-02',[],'OFFICIAL_YEAR_PINNED_FIXTURE');
 assert.ok(cal.dates.includes('2026-02-11'));
 assert.ok(!cal.dates.includes('2026-02-12'));
 assert.ok(!cal.dates.includes('2026-02-13'));
 assert.equal(cal.coverageYear,target);
 assert.equal(cal.source,'OFFICIAL_YEAR_PINNED_FIXTURE');
});
