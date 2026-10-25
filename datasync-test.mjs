import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {expectedCompletedDate,verifySnapshotAdvancement,reconcileLatestTradeDate,extractTwseMiIndexRows,extractTpexDailyQuoteRows,fetchJsonArray,fetchJsonValue} from './scripts/update-market-snapshot.mjs';

// A declared test calendar, not verification of actual exchange closures.
const calendar={ready:true,source:'SYNTHETIC_TEST_CALENDAR',closures:[{date:'20261023',name:'合成臨時休市'},{date:'20261026',name:'合成休市'}],specialTradingDates:[]};
const now=new Date('2026-10-27T20:00:00+08:00'),snap=date=>({tradeDate:date,marketCalendar:calendar}),rows=date=>({rows:[{Date:date,Code:'2330'}]});
test('stale 10/22 snapshot cannot pass on completed trading day 10/27',()=>assert.throws(()=>verifySnapshotAdvancement(snap('20261022'),null,now),/20261027/));
test('same-date completed trading day snapshot is accepted',()=>assert.equal(verifySnapshotAdvancement(snap('20261027'),null,now).expectedTradeDate,'20261027'));
test('before cutoff requires previous completed session across closures',()=>assert.equal(expectedCompletedDate(calendar,new Date('2026-10-27T10:00:00+08:00')),'20261022'));
test('weekend uses most recent open Friday',()=>assert.equal(expectedCompletedDate(calendar,new Date('2026-11-07T20:00:00+08:00')),'20261106'));
test('weekend rejects an older Thursday',()=>assert.throws(()=>verifySnapshotAdvancement(snap('20261105'),null,new Date('2026-11-07T20:00:00+08:00')),/20261106/));
test('consecutive declared closures retain the last completed session',()=>{
 for(const day of ['23','24','25','26'])assert.equal(expectedCompletedDate(calendar,new Date(`2026-10-${day}T20:00:00+08:00`)),'20261022');
});
test('future and backwards snapshots are rejected',()=>{assert.throws(()=>verifySnapshotAdvancement(snap('20261028'),null,now),/晚於/);assert.throws(()=>verifySnapshotAdvancement(snap('20261022'),snap('20261027'),now),/倒退/);});
const fields=['證券代號','開盤價','最高價','最低價','收盤價'],data=[['2330','100','102','99','101']];
test('TWSE wrong returned date is not relabelled',()=>assert.deepEqual(extractTwseMiIndexRows({date:'20261022',fields,data},'20261027'),[]));
test('TWSE missing returned date is rejected',()=>assert.deepEqual(extractTwseMiIndexRows({fields,data},'20261027'),[]));
test('TWSE valid dated rows are accepted',()=>assert.equal(extractTwseMiIndexRows({date:'20261027',fields,data},'20261027')[0].Date,'20261027'));
test('TPEx missing date is rejected',()=>assert.deepEqual(extractTpexDailyQuoteRows({tables:[]},'20261027'),[]));
test('stale simultaneous latest feeds are upgraded together on an open day',async()=>{
 const calls=[];const r=await reconcileLatestTradeDate(rows('20261022'),rows('20261022'),{calendar,now,fetchTwseByDate:async date=>{calls.push(date);return rows(date);},fetchTpexByDate:async date=>{calls.push(date);return rows(date);}});
 assert.deepEqual(calls,['20261027','20261027']);assert.equal(r.twseDate,'20261027');assert.equal(r.tpexDate,'20261027');
});
test('weekend stale feeds request the open Friday, never Saturday',async()=>{
 const calls=[];await reconcileLatestTradeDate(rows('20261105'),rows('20261105'),{calendar,now:new Date('2026-11-07T20:00:00+08:00'),fetchTwseByDate:async d=>{calls.push(d);return rows(d);},fetchTpexByDate:async d=>{calls.push(d);return rows(d);}});assert.deepEqual(calls,['20261106','20261106']);
});
test('unavailable dated upstream data never fabricates quotes',async()=>{
 await assert.rejects(reconcileLatestTradeDate(rows('20261022'),rows('20261022'),{calendar,now,fetchTwseByDate:async()=>{throw Error('official unavailable');},fetchTpexByDate:async()=>rows('20261027')}),/official unavailable/);
});
test('HTTP requests bypass intermediary cached URLs',async()=>{
 const native=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(url.includes('array')?'[]':'{}',{headers:{'Content-Type':'application/json'}});};
 try{await fetchJsonArray('https://example.test/array','test',1);await fetchJsonValue('https://example.test/value?date=20261027','test',1);assert(calls.every(x=>new URL(x.url).searchParams.has('_shitou_update')&&x.options.cache==='no-store'));assert.equal(new URL(calls[1].url).searchParams.get('date'),'20261027');}finally{globalThis.fetch=native;}
});
test('workflow cannot silently succeed after three failures',()=>{
 const workflow=fs.readFileSync(new URL('./.github/workflows/update-market-snapshot.yml',import.meta.url),'utf8');assert(workflow.includes('cancel-in-progress: false'));assert.match(workflow,/::error::[\s\S]*?exit 1/);assert(workflow.includes('git add -- data/market'));assert(workflow.includes('push:'));
});
