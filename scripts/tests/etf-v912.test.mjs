import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CODES,ENDPOINT,parseMonth,monthsBack,build} from '../build-etf-research-v912.mjs';
const sample=(month,rows)=>({stat:'OK',fields:['日期','成交股數','成交金額','開盤價','最高價','最低價','收盤價','漲跌價差','成交筆數','註記'],data:rows});
test('V9.12 ETF feed uses official TWSE monthly source, never stock scanner',()=>{
 assert.match(ENDPOINT,/twse\.com\.tw\/rwd\/zh\/afterTrading\/STOCK_DAY$/);
 assert.deepEqual(Object.keys(CODES).sort(),['0050','0056','006208','00878','00919'].sort());
 const src=fs.readFileSync('research-integration-v1.js','utf8');
 assert.match(src,/etf912Load\(code\)/);assert.match(src,/selectionEligible!==false/);assert.match(src,/sha256/);
 assert.match(src,/etfResearchOnly!==true/);assert.match(src,/securityType!=='ETF'/);
 assert.match(src,/ETF 盤後技術研究/);assert.match(src,/不含淨值、折溢價/);
 for(const path of ['strategy-2560-v1.js','strong-stock-filter-v47.js','main-force-lifeline-core-v97.js','structure-reversal-core-v1.js'])assert.ok(fs.existsSync(path));
});
test('TWSE ROC date, share unit and field name mapping are exact',()=>{
 const rows=parseMonth(sample('2026-11',[['115/11/16','1,234,567','', '20.10','21.00','19.95','20.80','','','']]),'00878','2026-11');
 assert.deepEqual(rows,[{date:'2026-11-16',open:20.1,high:21,low:19.95,close:20.8,volume:1234567}]);
 assert.throws(()=>parseMonth(sample('2026-11',[['115/11/17','500','','19','20','21','19','','','']]),'00878','2026-11'),/無效/);
 assert.throws(()=>parseMonth(sample('2026-11',[['115/11/16','--','','20','21','19','20','','','']]),'00878','2026-11'),/無效/);
 assert.throws(()=>parseMonth(sample('2026-11',[['115/10/16','100','','20','21','19','20','','','']]),'00878','2026-11'),/月份/);
});
test('only completed sessions, 63 required, no fake future prices and no strategy entry',()=>{
 const calendar=Array.from({length:70},(_,i)=>{const d=new Date('2026-08-01T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
 const make=dates=>({month:'2026-10',source:'https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=20261001&stockNo=00878&response=json',sha256:'f'.repeat(64),bars:dates.map((date,i)=>({date,open:20+i*.1,high:20.3+i*.1,low:19.8+i*.1,close:20.1+i*.1,volume:1000000+i}))});
 const raw=make(calendar),out=build('00878','國泰永續高股息',calendar.at(-1),calendar,[raw]);
 assert.equal(out.ready,true);assert.equal(out.report.dailySeries.length,70);
 assert.equal(out.report.close,out.report.dailySeries.at(-1).close);
 assert.equal(out.report.securityType,'ETF');assert.equal(out.report.etfResearchOnly,true);
 assert.equal(out.report.monthlyPass,null);assert.equal(out.report.entry,null);
 assert.equal(out.report.priceAdjustment.corporateActionsVerified,false);
 const future={...raw,bars:[...raw.bars,{date:'2026-12-01',open:99,high:100,low:99,close:100,volume:1}]};
 assert.equal(build('00878','國泰永續高股息',calendar.at(-1),calendar,[future]).report.dailySeries.length,70);
 const incomplete=build('00878','國泰永續高股息',calendar.at(-1),calendar,[make(calendar.slice(-50))]);
 assert.equal(incomplete.ready,false);assert.equal(incomplete.report.dailySeries.length,50);
 assert.equal(monthsBack('2026-11-16',11).at(-1),'2026-11');
});
