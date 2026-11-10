'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const U=require('../kronos-future-update-status.cjs'),R=require('../retry-transient.cjs'),P=require('../../kronos-future-report-v1');
const base={date:'2026-11-09',identity:'frozen-source',runId:'123',repository:'owner/repo',stage:'INFERENCE',now:'2026-11-09T10:00:00Z'};
test('ready requires the exact market date and frozen source identity',()=>{
 assert.throws(()=>U.build({...base,state:'READY',catalog:{asOf:base.date,identity:'different'}}),/mismatched/);
 assert.throws(()=>U.build({...base,state:'READY',catalog:{asOf:'2026-11-06',identity:base.identity}}),/mismatched/);
 const ready=U.build({...base,state:'READY',catalog:{asOf:base.date,identity:base.identity}});assert.equal(ready.modelDate,base.date);assert.equal(ready.runUrl,'https://github.com/owner/repo/actions/runs/123');
});
test('delayed jobs and old attempts cannot overwrite a newer update status',()=>{
 const old=U.build({...base,state:'RUNNING',runId:'125',runAttempt:2});
 assert.equal(U.mayReplace(old,U.build({...base,state:'FAILED',runId:'124'})),false);
 assert.equal(U.mayReplace(old,U.build({...base,state:'FAILED',runId:'125',runAttempt:1})),false);
 assert.equal(U.mayReplace(old,U.build({...base,state:'READY',date:'2026-11-06',catalog:{asOf:'2026-11-06',identity:base.identity}})),false);
 assert.equal(U.mayReplace(old,U.build({...base,state:'RUNNING',runId:'126'})),true);
});
test('temporary transport failures retry three times with unchanged arguments',async()=>{
 const calls=[],delays=[];let n=0;
 const status=await R.retry('python',['kronos/future.py','--samples','150'],{run:(c,a)=>{calls.push([c,[...a]]);return ++n<3?{status:1,stderr:'ConnectionError: HTTP 503'}:{status:0,stdout:'OK'};},sleep:async n=>delays.push(n),write:()=>{}});
 assert.equal(status,0);assert.equal(calls.length,3);assert.deepEqual(calls[0],calls[2]);assert.deepEqual(delays,[20000,40000]);
});
test('validation failures do not retry or hide the original failure',async()=>{
 let calls=0;assert.equal(await R.retry('node',['verify'],{run:()=>{calls++;return {status:2,stderr:'Future inputs changed before publish'};},sleep:()=>assert.fail('must not wait'),write:()=>{}}),2);assert.equal(calls,1);
 let tries=0;assert.equal(await R.retry('node',['fetch'],{run:()=>{tries++;return {status:1,stderr:'fetch failed'};},sleep:async()=>{},write:()=>{}}),1);assert.equal(tries,3);
});
test('stock and market mismatch messages distinguish running, failure, unknown and expired status',()=>{
 const now=Date.parse(base.now)+1000,catalog={asOf:'2026-11-06'},u=U.build({...base,state:'RUNNING'});
 assert.match(P.updateMessage(base.date,catalog,u,now),/正在計算/);
 assert.match(P.updateMessage(base.date,catalog,{...u,state:'FAILED'},now),/更新失敗/);
 assert.match(P.updateMessage(base.date,catalog,null,now),/尚無可確認/);
 assert.match(P.updateMessage(base.date,catalog,u,now+7*3600000),/尚無可確認/);
 assert.match(P.updateMessage(base.date,catalog,{...u,marketDate:'2026-11-06'},now),/尚無可確認/);
 assert.match(P.updateMessage(base.date,catalog,{...u,updatedAt:'2026-11-10T10:00:00Z'},now),/尚無可確認/);
 for(const state of ['RUNNING','FAILED']){const message=P.updateMessage(base.date,catalog,{...u,state},now);assert.match(message,/2026-11-09/);assert.match(message,/2026-11-06/);}
});
test('market update directly calls independent 20-day pipeline without changing one-day pipeline',()=>{
 const root=path.resolve(__dirname,'../..'),market=fs.readFileSync(path.join(root,'.github/workflows/update-market-snapshot.yml'),'utf8'),future=fs.readFileSync(path.join(root,'.github/workflows/kronos-future.yml'),'utf8');
 assert.match(market,/future-forecast:\s+needs: \[prepare, update-market-snapshot\][\s\S]*?uses: \.\/\.github\/workflows\/kronos-future.yml/);
 assert.match(market,/uses: \.\/\.github\/workflows\/kronos-forecast.yml/);
 assert.match(future,/node scripts\/retry-transient.cjs python kronos\/future.py --all --index --samples 150 --batch-size 30 --threads 2 --shards 16/);
 assert.match(future,/Future inputs changed before publish/);
 assert.ok(future.indexOf('rm -rf data/kronos-future')<future.indexOf('node scripts/retry-transient.cjs python kronos/future.py'));
 assert.match(future,/always\(\).*needs\.sources\.result == 'success'.*needs\.sources\.outputs\.needed == 'false'/);
});
