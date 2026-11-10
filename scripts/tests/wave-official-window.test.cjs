'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const H=require('../../research-official-history-v1'),D=require('../../selection-data-v2'),C=require('../../four-models-research-v1'),E=require('../../elliott-wave-v1'),V=require('../../elliott-wave-visual-v1'),R=require('../../elliott-wave-report-v1');
test('signed official post-reset window survives a warm legacy cache; altered full history cannot borrow it',async()=>{
 const file=path.resolve(__dirname,'../../data/research/2026-11-09/5386.json'),text=fs.readFileSync(file,'utf8'),raw=JSON.parse(text),code=raw.stock,date=raw.closeDate,sessions=raw.dailySeries.map(b=>b.date),sha=crypto.createHash('sha256').update(text).digest('hex');
 const manifest={schema:'OFFICIAL_RESEARCH_MANIFEST_V1',verified:true,date,calendarSource:'https://www.twse.com.tw/exchangeReport/FMTQIK',sourceDays:sessions.length*2,researchSessions:sessions,universe:1,stocks:{[code]:{code,name:raw.name,market:raw.market,path:date+'/'+code+'.json',sha256:sha,bars:raw.dailySeries.length}}};
 const previous={fetch:global.fetch,official:global.ShitouOfficialResearchHistory,integration:global.ShitouResearchIntegration};
 try{
  H.reset();D.reset();global.ShitouOfficialResearchHistory=H;
  global.fetch=async url=>{const s=String(url),body=s.includes('research-calendar.json')?fs.readFileSync(path.resolve(__dirname,'../../data/market/research-calendar.json'),'utf8'):s.includes('manifest.json')?JSON.stringify(manifest):text;return {ok:true,status:200,text:async()=>body,json:async()=>JSON.parse(body)};};
  D.bind({map:new Map([[code,{...raw.dailySeries.at(-1),code,market:raw.market,quoteDate:date,volumeUnit:'shares'}]]),snapshotRows:1,meta:{total:1,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true}});await D.prepareResearchEvidence();
  const legacy={...structuredClone(raw),code,priceAdjustment:{verified:false,basis:'UNKNOWN'},dailySeriesMeta:{...raw.dailySeriesMeta,source:'TEST_UNVERIFIED_WORKER_CACHE'}};delete legacy.officialArchiveEvidence;legacy.elliottWave=E.evaluate(legacy);D.remember(legacy,code);
  const prepared=await D.prepareResearchSource(legacy,code),analysis=C.evaluate(prepared),wave=analysis.elliottWave;global.ShitouResearchIntegration={getCurrentStock:()=>({analysis,source:prepared})};
  assert.ok(analysis.evidenceDiagnostics.analysisWindow.cutoff);assert.ok(wave.bars.length>=63&&wave.bars.length<prepared.dailySeries.length);assert.notEqual(wave.state,'DATA_INSUFFICIENT');
  assert.equal(E.matchesSnapshot(prepared,wave),true);assert.equal(V.result(legacy),wave);assert.equal(R.buildModel(legacy).wave,wave);assert.equal(R.buildModel(prepared).wave,wave);
  assert.equal(E.evaluate(prepared).state,'DATA_INSUFFICIENT','full history still cannot cross the price reset');
  for(const edit of [r=>r.canonicalBars[0].high+=1,r=>r.canonicalBars.at(-1).high+=1,r=>r.priceAdjustment.verified=false,r=>r.closeDate='2026-11-06',r=>r.stock='2330']){const changed=structuredClone(prepared);edit(changed);assert.equal(E.matchesSnapshot(changed,wave),false);}
  const forged=structuredClone(wave);assert.equal(E.matchesSnapshot(prepared,forged),false);
 }finally{global.fetch=previous.fetch;global.ShitouOfficialResearchHistory=previous.official;global.ShitouResearchIntegration=previous.integration;D.reset();H.reset();}
});
