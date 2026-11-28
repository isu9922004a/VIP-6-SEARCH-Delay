import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,allowed,taipei,expectedSession,summarize,getStrategy,response,forecastText} from './core.mjs';
import worker from './worker.mjs';
const now=new Date('2026-11-28T02:00:00Z'),date='2026-11-27';
const index={tradingCalendar:{verified:true,coverageYear:'2026',dates:['2026-11-27','2026-11-30']}};
test('commands and allowlist strict',()=>{assert.deepEqual(parse('/stock 2330'),{type:'stock',code:'2330'});assert.equal(parse('/stock ../../x').type,'help');assert.equal(parse('2330').code,'2330');assert.equal(parse('/strategy 7').type,'help');assert.equal(allowed('12,34',12),true);assert.equal(allowed('12,34',2),false);});
test('completed Taipei sessions weekend and cutoff',()=>{assert.equal(taipei(now).date,'2026-11-28');assert.equal(expectedSession(index,now),date);assert.equal(expectedSession(index,new Date('2026-11-30T05:00:00Z')),date);assert.equal(expectedSession(index,new Date('2026-11-30T08:00:00Z')),'2026-11-30');assert.throws(()=>expectedSession({},now));});
test('strict date and OHLC guards',()=>{const rows=Array.from({length:27},(_,i)=>({date:'2026-11-'+String(i+1).padStart(2,'0'),open:10,high:11,low:9,close:10}));const obj={completed:true,closeDate:date,close:10,dailySeriesMeta:{onlyCompletedBars:true},dailySeries:rows};assert.equal(summarize(obj,date,'TAIEX').ma20,10);assert.throws(()=>summarize(obj,'2026-11-30','TAIEX'));assert.throws(()=>summarize({...obj,close:11},date,'TAIEX'));assert.throws(()=>summarize({...obj,completed:false},date,'TAIEX'));});
test('unavailable strategy never fabricates ranking',async()=>{const r=await getStrategy(1,date,()=>{throw Error('unexpected fetch')});assert.equal(r.ready,false);assert.match(r.text,/尚未取得/);});
test('stale source fail closed and model missing not manufactured',async()=>{assert.match(await response({type:'market'},async()=>new Response('{}'),now),/尚未核驗/);assert.match(forecastText({},null,date),/暫/);});
test('webhook secret and allowlist gates',async()=>{const env={TELEGRAM_BOT_TOKEN:'test',TELEGRAM_WEBHOOK_SECRET:'secret',TELEGRAM_CHAT_IDS:'123'};const u='https://example.com/telegram/webhook';assert.equal((await worker.fetch(new Request(u,{method:'POST',body:'{}'}),env,{})).status,404);const req=new Request(u,{method:'POST',headers:{'x-telegram-bot-api-secret-token':'secret'},body:JSON.stringify({update_id:1,message:{chat:{id:456,type:'private'},from:{id:456},text:'/market'}})});assert.equal((await worker.fetch(req,env,{})).status,200);});

test('real archived data integration: market, stock and original MACD Top8',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {getMarket,getStock}=await import('./core.mjs');
 const f=async u=>{const p=new URL(u).pathname.replace('/VIP-6-SEARCH-Delay/','');try{return new Response(await readFile(new URL('../'+p,import.meta.url)),{status:200});}catch{return new Response('',{status:404});}};
 const ix=JSON.parse(await readFile(new URL('../data/index/TAIEX.json',import.meta.url),'utf8'));
 const current=ix.closeDate;
 const cutoff=new Date(current+'T09:00:00Z');
 const market=await getMarket(f,cutoff);
 assert.equal(market.date,current);
 assert.match(market.text,/Kronos .*模擬收盤中位/s,'official current Kronos receipt and input must agree');
 const stock=await getStock('2330',current,f);
 assert.match(stock,/2330/);
 const rank=await getStrategy(6,current,f);
 assert.equal(rank.ready,true);
 assert.match(rank.text,/強化 MACD/);
});


test('Cloudflare fetch options and redirect fail closed',async()=>{const {read}=await import('./core.mjs');const fetcher=async(url,opts)=>{assert.equal(typeof url,'string');assert.equal(opts.redirect,'manual','workerd does not support error redirect mode');assert.ok(!('cache' in opts));return new Response('{"ok":true}');};assert.deepEqual((await read('data/index/TAIEX.json',fetcher)).data,{ok:true});await assert.rejects(()=>read('data/index/TAIEX.json',async()=>new Response(null,{status:302,headers:{location:'https://example.org/'}})),/REDIRECT_REJECTED_302/);});
