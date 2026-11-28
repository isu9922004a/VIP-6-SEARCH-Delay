import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getStrategy} from '../telegram-bot/core.mjs';
const root=new URL('../',import.meta.url),archive=process.argv[2];
if(!archive)throw Error('need generated rank archive');
const rank=JSON.parse(await readFile(archive,'utf8'));
const fetcher=async url=>{
 const p=new URL(url).pathname.replace('/VIP-6-SEARCH-Delay/','');
 if(p==='data/low-base-breakout/latest.json')return new Response(await readFile(archive));
 try{return new Response(await readFile(new URL(p,root)));}catch{return new Response('',{status:404});}
};
const bot=await getStrategy(5,rank.date,fetcher);
assert.equal(bot.ready,true,bot.text);
assert.equal(bot.complete,rank.complete);assert.equal(bot.zeroConfirmed,rank.zeroConfirmed);
if(!rank.zeroConfirmed&&!rank.candidates.length)assert.match(bot.text,/不可宣稱全市場零入選/);
for(const code of rank.top8)assert.ok(bot.text.includes(code));
console.log('V929_TELEGRAM_ARCHIVE '+JSON.stringify({date:rank.date,ready:bot.ready,complete:bot.complete,zeroConfirmed:bot.zeroConfirmed,top8:rank.top8}));
