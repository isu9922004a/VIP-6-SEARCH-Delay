'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),P=require('../../scan-exclusions-rsi-v5328.js');
const source=fs.readFileSync(require.resolve('../../scan-report-rsi-v5328.js'),'utf8'),saved=JSON.parse(fs.readFileSync(require.resolve('../../data/market/latest.json'),'utf8'));
function setup({stale=false}={}){
 const snapshot=structuredClone(saved),day=String(saved.tradeDate).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3'),now=Date.parse(day+'T11:00:00Z');
 if(stale){snapshot.tradeDate='20260105';snapshot.tradeDateIso='2026-01-05';}
 snapshot.exclusionStatus={ready:true,date:day,twseCodes:[],tpexCodes:[],specialCodes:[]};
 let workerCalls=0,requests=0;
 class FixedDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const root={ShitouScanPolicy5328:P,loadMarketBundleFromWorkerV3766:async(_path,options)=>{workerCalls++;assert.equal(options.researchOnly,true);throw Error('測試：兩市場日期尚未對齊');},fetch:async()=>{requests++;return {ok:true,json:async()=>structuredClone(snapshot)};},location:{protocol:'https:'},document:{querySelector:()=>null,createElement:()=>({}),head:{appendChild(){}}},AbortSignal,Date:FixedDate,Intl,URL,Map,Promise,setTimeout:()=>{throw Error('單股研究不可走掃描器的10秒/20秒等待');}};
 vm.runInNewContext(source,root);return {root,counts:()=>({workerCalls,requests}),day};
}
test('individual research immediately uses a verified same-date official static snapshot when the full-market worker is synchronizing',async()=>{const x=setup(),b=await x.root.loadMarketBundleFromWorkerV3766('?market=ALL_STOCKS',{researchOnly:true});assert.equal(b.meta.source,'GITHUB_SNAPSHOT_FALLBACK');assert.equal(b.meta.targetTradeDate,x.day);assert.equal(b.meta.marketCoverageReady,true);assert.equal(b.map.size,saved.rows.length);assert.equal(x.counts().workerCalls,1);assert.equal(x.counts().requests,2);});
test('fast research fallback keeps date/coverage guards and never upgrades a stale snapshot',async()=>{const x=setup({stale:true});await assert.rejects(x.root.loadMarketBundleFromWorkerV3766('?market=ALL_STOCKS',{researchOnly:true}),/行情還沒確認完整/);assert.equal(x.counts().workerCalls,1);});
