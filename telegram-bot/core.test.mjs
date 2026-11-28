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

 test('strategy menu and clickable shortcuts work without market reads',async()=>{assert.deepEqual(parse('/strategy'),{type:'strategy_menu'});for(let i=1;i<=6;i++)assert.deepEqual(parse('/s'+i),{type:'strategy',number:i});assert.equal(parse('/s6 bad').type,'help');const nofetch=()=>{throw Error('unexpected fetch');};assert.match(await response(parse('/strategy'),nofetch,now),/\/s6 強化 MACD/);assert.match(await response(parse('/s1'),nofetch,now),/尚未取得/);});

test('native keyboard exposes only known callbacks and authorized private chats',async()=>{
 const {mainKeyboard,keyboardFor,callbackCommand,commands}=await import('./core.mjs');const {authorizedUpdate}=await import('./worker.mjs');
 const env={TELEGRAM_CHAT_IDS:'123,456'};
 const q={id:'callback-1',from:{id:123},message:{chat:{id:123,type:'private'}},data:'/s6'};
 assert.equal(authorizedUpdate({update_id:1,callback_query:q},env).text,'/s6');
 assert.equal(authorizedUpdate({update_id:1,callback_query:{...q,from:{id:999}}},env),null);
 assert.equal(authorizedUpdate({update_id:1,callback_query:{...q,from:{id:999},message:{chat:{id:999,type:'private'}}}},env),null);
 assert.equal(authorizedUpdate({update_id:1,callback_query:{...q,message:{chat:{id:123,type:'group'}}}},env),null);
 assert.equal(authorizedUpdate({update_id:1,callback_query:{...q,data:'/arbitrary'}},env),null);
 for(const row of mainKeyboard.inline_keyboard)for(const b of row)if(b.callback_data){assert.equal(callbackCommand(b.callback_data),b.callback_data);assert.notEqual(parse(b.callback_data).type,'help');}
 assert.equal(keyboardFor(parse('/start')),mainKeyboard);assert.ok(commands.some(x=>x.command==='daily'));
 assert.deepEqual(parse('台積電'),{type:'stock_name',name:'台積電'});
});
test('subscriptions are opt-in per storage and disabled release remains explicit',async()=>{
 const {preferenceReply}=await import('./worker.mjs');const map=new Map();const s={put:async(k,v)=>map.set(k,v)};
 assert.match(await preferenceReply(parse('/subscribe'),s,{ALLOW_PARTIAL_PUSH:'0'},'123'),/尚未啟用/);
 assert.equal(map.get('subscribed'),true);
 assert.match(await preferenceReply(parse('/unsubscribe'),s,{},'123'),/取消/);assert.equal(map.get('subscribed'),false);
 assert.match(await preferenceReply(parse('/myid'),s,{},'123'),/123/);
});
test('stock name and daily use verified archive only',async()=>{
 const {getStockByName}=await import('./core.mjs');const {readFile}=await import('node:fs/promises');
 const f=async u=>{const p=new URL(u).pathname.replace('/VIP-6-SEARCH-Delay/','');try{return new Response(await readFile(new URL('../'+p,import.meta.url)));}catch{return new Response('',{status:404});}};
 const ix=JSON.parse(await readFile(new URL('../data/index/TAIEX.json',import.meta.url),'utf8'));const d=ix.closeDate;
 assert.match(await getStockByName('台積電',d,f),/2330/);
 assert.match(await response(parse('/daily'),f,new Date(d+'T09:00:00Z')),/部分功能/);
});