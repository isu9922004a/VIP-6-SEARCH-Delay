'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../postclose-recovery.cjs'),U=require('../kronos-future-update-status.cjs'),Fresh=require('../../research-v83/market-freshness'),Release=require('../../version-v50'),fs=require('node:fs'),path=require('node:path');
const date='2026-11-10',base=()=>({expected:date,market:{tradeDateIso:date,marketCoverageReady:true,contentSha256:'verified'},history:{date,verified:true,snapshotContentSha256:'verified'},index:{closeDate:date,completed:true},catalog:{asOf:date},modelNeeded:false,update:{marketDate:date,state:'READY',stage:'VERIFIED_LIVE'},published:true});
test('complete same-day sources/model/live publication skip both fetch and inference',()=>assert.equal(R.decide(base()).action,'NONE'));
test('a new trading day or mismatched history fingerprint refreshes market before the model',()=>{
 for(const edit of [x=>x.market.tradeDateIso='2026-11-09',x=>x.market.marketCoverageReady=false,x=>x.history.date='2026-11-09',x=>x.history.snapshotContentSha256='other']){const x=base();edit(x);assert.equal(R.decide(x).action,'MARKET');}
});
test('aligned market with missing/stale index or model recovers the existing model pipeline',()=>{
 for(const edit of [x=>x.index.closeDate='2026-11-09',x=>x.catalog=null,x=>x.catalog.asOf='2026-11-09',x=>x.modelNeeded=true]){const x=base();edit(x);assert.equal(R.decide(x).action,'MODEL');}
});
test('a publication failure recovers publication without recomputing qualified models',()=>{
 for(const edit of [x=>x.published=false,x=>x.update.state='FAILED',x=>x.update.stage='VERIFIED_PUBLICATION',x=>x.update=null]){const x=base();edit(x);assert.equal(R.decide(x).action,'DEPLOY');assert.equal(x.modelNeeded,false);}
});
test('an actually active current run waits; stale-day running records cannot suppress recovery',()=>{
 const x=base();x.active=true;x.update.state='RUNNING';assert.equal(R.decide(x).action,'WAIT');x.expected='2026-11-11';assert.equal(R.decide(x).action,'MARKET');
});
test('the actual GitHub run state decides liveness, not an old RUNNING label',async()=>{
 let calls=0;const options={repository:'owner/repo',token:'test-only',fetcher:async()=>{calls++;return {ok:true,json:async()=>({status:'completed'})};}},u={state:'RUNNING',runId:'123'};
 assert.equal(await R.running(u,options),false);assert.equal(calls,1);
 assert.equal(await R.running(u,{...options,fetcher:async()=>({ok:true,json:async()=>({status:'in_progress'})})}),true);
 await assert.rejects(R.running(u,{...options,fetcher:async()=>({ok:false,status:503})}),/503/);
});
test('backend and browser share the 15:00 Taipei cutoff without weakening source checks',async()=>{
 const {expectedCompletedDate}=await import('../update-market-snapshot.mjs');assert.equal(Release.postcloseDataCutoffMinutes,900);
 const calendar={ready:true,closures:[],specialTradingDates:[]},history={closeDate:'2026-11-09',tradingCalendar:{verified:true,dates:['2026-11-09','2026-11-10','2026-11-11']}};
 for(const [hour,day] of [['14:59','2026-11-09'],['15:00','2026-11-10'],['18:54','2026-11-10']]){const now=new Date('2026-11-10T'+hour+':00+08:00');assert.equal(expectedCompletedDate(calendar,now),day.replaceAll('-',''));assert.equal(Fresh.historyStatus(history,now).expectedDate,day);}
 assert.equal(expectedCompletedDate(calendar,new Date('2026-11-14T19:00:00+08:00')),'20261113');
 const closed={...calendar,closures:[{date:'20261110',name:'TEST verified closure'}]};assert.equal(expectedCompletedDate(closed,new Date('2026-11-10T19:00:00+08:00')),'20261109');
});
test('later stages and a verified live result cannot be overwritten by delayed same-attempt callbacks',()=>{
 const args={date,identity:'source',runId:'123',runAttempt:1,repository:'owner/repo',catalog:{asOf:date,identity:'source'}},live=U.build({...args,state:'READY',stage:'VERIFIED_LIVE'});
 assert.equal(U.mayReplace(live,U.build({...args,state:'FAILED',stage:'DEPLOYMENT'})),false);
 assert.equal(U.mayReplace(live,U.build({...args,state:'FAILED',stage:'SOURCES',runId:'124'})),true);
 const computing=U.build({...args,state:'RUNNING',stage:'INFERENCE'});assert.equal(U.mayReplace(computing,U.build({...args,state:'RUNNING',stage:'SOURCES'})),false);
});
test('public current date alone cannot hide a different same-day model identity or market fingerprint',async()=>{
 const root=fs.mkdtempSync('/tmp/postclose-probe-');try{
  const records=[{tradeDateIso:date,contentSha256:'market'},{date,snapshotContentSha256:'market'},{asOf:date,identity:'current'}],files=['data/market/latest.json','data/research/manifest.json','data/kronos-future/manifest.json'];
  files.forEach((p,i)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(records[i]));});
  const probe=async values=>R.published(root,{base:'https://example.invalid/',fetcher:async url=>({ok:true,json:async()=>values[files.indexOf(new URL(url).pathname.slice(1))]})});
  assert.equal(await probe(records),true);const changed=structuredClone(records);changed[2].identity='old-same-day';assert.equal(await probe(changed),false);changed[2]=records[2];changed[0].contentSha256='old';assert.equal(await probe(changed),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('the watchdog calls the same pipeline and retains independent index and all-market verification',()=>{
 const root=path.resolve(__dirname,'../..'),watch=fs.readFileSync(path.join(root,'.github/workflows/postclose-recovery.yml'),'utf8'),market=fs.readFileSync(path.join(root,'.github/workflows/update-market-snapshot.yml'),'utf8'),deploy=fs.readFileSync(path.join(root,'.github/workflows/deploy-data-pages.yml'),'utf8');
 assert.match(watch,/workflow_run:/);assert.match(watch,/Update independent index and its model/);assert.match(watch,/uses: \.\/\.github\/workflows\/update-market-snapshot.yml/);
 assert.match(market,/workflow_call:/);assert.match(market,/scripts\/build-official-research-history.mjs/);assert.match(market,/uses: \.\/\.github\/workflows\/kronos-future.yml/);assert.match(market,/record READY VERIFIED_LIVE/);assert.match(market,/postclose-live-browser.cjs/);assert.match(deploy,/timeout-minutes: 40/);
});
