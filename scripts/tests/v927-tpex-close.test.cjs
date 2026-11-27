'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{isoDate,parseMonth,months,fetchMonth}=require('../collect-v927-tpex-close.cjs');
const p={stat:'ok',tables:[{fields:['日 期','成交張數','金額（仟元）','筆數','櫃買指數','漲/跌'],data:[['115/11/02','100','200','30','285.77','+1.0'],['115/11/03','100','200','30','284.12','-1.65']]}]};
test('date and official closing-index columns only, never synthesize OHLC',()=>{
 assert.deepEqual(parseMonth(p,'2026-11'),[{date:'2026-11-02',close:285.77},{date:'2026-11-03',close:284.12}]);
 assert.equal(isoDate('2026/11/2'),'2026-11-02');assert.throws(()=>isoDate('115/02/30'));
 assert.deepEqual(months('2025-12','2026-02'),['2025-12','2026-01','2026-02']);
});
test('reject wrong date, ambiguous table, bad status, malformed close and duplicate dates',()=>{
 for(const patch of [{stat:'error'},{tables:[...p.tables,...p.tables]}, {tables:[{...p.tables[0],data:[['115/10/30',0,0,0,285,0]]}]},{tables:[{...p.tables[0],data:[['115/11/02',0,0,0,'--',0]]}]},{tables:[{...p.tables[0],data:[p.tables[0].data[0],p.tables[0].data[0]]}]}])assert.throws(()=>parseMonth({...p,...patch},'2026-11'));
});
test('receipt uses actual bytes and retries a failed response',async()=>{
 let count=0;const raw=JSON.stringify(p);
 const r=await fetchMonth('2026-11',{delay:async()=>{},fetcher:async u=>{assert.match(u,/^https:\/\/www\.tpex\.org\.tw\/www\/zh-tw\/afterTrading\/tradingIndex\?/);return ++count===1?new Response('',{status:503}):new Response(raw);}});
 assert.equal(count,2);assert.equal(r.raw.toString(),raw);assert.equal(r.receipt.sha256,require('node:crypto').createHash('sha256').update(raw).digest('hex'));assert.equal(r.rows.length,2);
});
