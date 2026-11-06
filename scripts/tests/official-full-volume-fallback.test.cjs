'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../../research-official-history-v1.js'),D=require('../../selection-data-v2.js'),F=require('../../four-models-research-v1.js');
const root=path.resolve(__dirname,'../..'),snapshot=require('../../data/market/archive/2026-11-03.json'),date=snapshot.tradeDateIso;
const full=require('../fixtures/2330-full-mis-20261103.json');
function setup(){H.reset();D.reset();global.ShitouOfficialResearchHistory=H;
 global.fetch=async url=>{const s=String(url);if(s.includes('/data/research/manifest.json'))return {ok:true,text:async()=>JSON.stringify(require('../fixtures/2330-official-archive-manifest-20261103.json')),json:async()=>require('../fixtures/2330-official-archive-manifest-20261103.json')};const file=s.includes('research-calendar.json')?'data/market/research-calendar.json':'data/research/'+new URL(s).pathname.split('/data/research/')[1],text=fs.readFileSync(path.join(root,file),'utf8');return {ok:true,text:async()=>text,json:async()=>JSON.parse(text)};};
 D.bind({map:new Map(snapshot.rows.map(q=>[q.code,q])),meta:{total:snapshot.rows.length,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true}});
}
test('real 2330 FULL MIS volume mismatch cannot block verified official research',async()=>{
 setup();await D.prepareResearchEvidence();const archive=await H.load('2330',{date});D.remember(archive,'2330');
 assert.throws(()=>D.validate(full,'2330'),/成交量無法交叉驗證/);
 const before=JSON.stringify(full),prepared=D.apply(full,'2330'),a=F.evaluate(prepared);
 assert.equal(a.validation.technicalModelAvailable,true);assert.equal(a.validation.historyBarCount,160);
 assert.equal(prepared.dailySeries.at(-1).volume,46137336);assert.equal(full.dailySeries.at(-1).volume,36567000);
 assert.match(prepared.referenceHistoryAudit.referenceWarning,/成交量無法交叉驗證/);assert.equal(JSON.stringify(full),before);
});
test('unproved archive, wrong stock, market, date and close remain blocked',async()=>{
 setup();const archive=require('../../data/research/2026-11-03/2330.json');D.remember(archive,'2330');
 assert.throws(()=>D.apply(full,'2330'),/成交量無法交叉驗證/);
 const verified=await H.load('2330',{date});D.remember(verified,'2330');
 for(const change of [{stock:'8039'},{market:'TPEX'},{closeDate:'2026-11-02'},{close:1}])assert.throws(()=>D.apply({...full,...change},'2330'));
});
