'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),V=require('../verify-deployed-future-data.cjs');
const expected=JSON.stringify({schema:'shitou-kronos-future-catalog-v1',asOf:'2026-11-09',identity:'new-runtime-and-source',instruments:{'2221':{sha256:'actual-new-file'}},unavailable:{'3441':'invalid close'}})+'\n';
test('same-date older catalogs and partial catalogs are not accepted as a finished deployment',()=>{
 const old=JSON.parse(expected);old.identity='old-runtime';assert.match(V.compare(expected,JSON.stringify(old)).reason,/同日模型版本/);
 const partial=JSON.parse(expected);delete partial.instruments['2221'];assert.equal(V.compare(expected,JSON.stringify(partial)).ready,false);
 assert.equal(V.compare(expected,expected).ready,true);assert.equal(V.compare(expected,'not json').ready,false);
});
test('waits for the exact verified catalog rather than accepting an older same-date result',async()=>{
 let time=0,calls=0;const old=JSON.stringify({...JSON.parse(expected),identity:'old'});
 const r=await V.verify(expected,{base:'https://example.invalid/',now:()=>time,intervalMs:10,maxWaitMs:50,sleep:async n=>{time+=n;},log:()=>{},fetcher:async()=>({ok:true,text:async()=>++calls<3?old:expected})});assert.equal(r.ready,true);assert.equal(calls,3);
});
test('a persistent old or unavailable catalog times out without a success claim',async()=>{
 let time=0;await assert.rejects(V.verify(expected,{base:'https://example.invalid/',now:()=>time,intervalMs:10,maxWaitMs:20,sleep:async n=>{time+=n;},log:()=>{},fetcher:async()=>({ok:false,status:404})}),/不宣告更新完成/);
});
