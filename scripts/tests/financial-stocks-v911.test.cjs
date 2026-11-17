'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),M=JSON.parse(fs.readFileSync(path.join(ROOT,'data/research/manifest.json'),'utf8'));
const market=JSON.parse(fs.readFileSync(path.join(ROOT,'data/market/latest.json'),'utf8'));
const V=require('../../life-line-visual-v98.js'),Life=require('../../kline-life-03-core-v1.js'),Report=require('../../kline-life-03-report-v1.js'),F=require('../../four-models-research-v1.js');
const P=require('../../scan-exclusions-rsi-v5328.js'),S=require('../../strong-stock-filter-v47.js');
const Fifth=require('../../strategy-2560-v1.js'),Structure=require('../../structure-reversal-core-v1.js');
const document={createElement:()=>({})};
const financial=market.rows.filter(q=>String(q.industryCode)==='17');
const json=(code)=>JSON.parse(fs.readFileSync(path.join(ROOT,'data/research',M.stocks[code].path),'utf8'));
test('financial universe is official, dated, complete enough to audit, but never a scanner selection',()=>{
 assert.equal(market.tradeDateIso,M.date);
 assert.ok(financial.length>=20,'financial industry coverage unexpectedly missing');
 assert.ok(financial.every(q=>M.stocks[q.code]&&M.stocks[q.code].market===q.market));
 for(const q of financial){
   const sector={industryCode:'17',industryName:'金融保險'};
   const status=P.classify(q.code,{...q,fullDelivery:false,fullDeliveryDate:M.date},sector,{targetTradeDate:M.date,completedTradeDate:M.date,exclusionCoverageReady:true,exclusionDate:M.date});
   assert.equal(status.excluded,true,q.code+' must not become a scanner candidate');
   assert.ok(['FINANCIAL','SPECIAL'].includes(status.key),q.code+' unexpected exclusion '+status.key);
   if(status.key==='SPECIAL')assert.match(String(q.name),/基金/,q.code+' special-name precedence only');
   assert.equal(S.officialIndustry(sector).key,'FINANCIAL',q.code);
   assert.equal(Fifth.universe(q.code,q,sector).ok,false,q.code+' not excluded from 2560');
   assert.equal(Structure.classify(q.code,q,sector,{}).excluded,true,q.code+' not excluded from structure');
 }
});
test('all listed financial stock archives can supply manual life-line pages; limited rows stay limited',()=>{
 const failures=[];
 for(const q of financial){
  try{
   const item=M.stocks[q.code],raw=json(q.code),bars=raw.dailySeries;
   assert.equal(raw.stock,q.code);assert.equal(raw.market,q.market);
   assert.equal(raw.closeDate,M.date);assert.equal(raw.marketDate,M.date);
   assert.equal(raw.completed,true);assert.equal(raw.isComplete,true);
   assert.equal(raw.volumeUnit,'shares');assert.equal(bars.length,item.bars);
   assert.equal(bars.at(-1).date,M.date);assert.equal(bars.at(-1).close,raw.close);
   assert.ok(['READY','PENDING'].includes(item.ready?'READY':'PENDING'));
   const study=Report.inspect(Life.withSource(F.evaluate(raw),raw));
   const outputs=V.build(study,{document,source:raw}),audits=outputs.map(x=>JSON.parse(x.dataset.life98Audit));
   assert.equal(outputs.length,2);
   for(const a of audits){assert.equal(a.width,1284);assert.equal(a.height,2778);assert.equal(a.model.code,q.code);assert.equal(a.model.date,M.date);assert.equal(a.affectsEligibility,false);assert.equal(a.affectsRanking,false);assert.equal(a.chartBars,Math.min(30,study.validatedBars?.length||0));}
   if(item.ready){assert.equal(audits[0].model.close,raw.close);assert.ok(bars.length>=63);assert.ok(Number.isFinite(audits[0].model.ma[60]),'ready history must have MA60');}
   else{assert.equal(item.ready,false);assert.ok(bars.length<63,'pending must not be silently promoted');}
  }catch(e){failures.push({code:q.code,name:q.name,error:e.stack||e.message});}
 }
 assert.deepEqual(failures,[]);
});
test('manual financial fallback is scoped to verified same-day archives, never modifying scanners',()=>{
 const src=fs.readFileSync(path.join(ROOT,'research-integration-v1.js'),'utf8');
 assert.match(src,/verifiedFinancialDaily\(report,q,code,date\)/);
 assert.match(src,/archive\?\.load\(code,\{date,market:q\.market\}\)/);
 assert.match(src,/financialOfficialDailyOnly:true/);
 assert.match(src,/archive\?\.proof\?\.\(report\)/);
 assert.match(src,/quoteEvidence:D\.quoteEvidence/);
 assert.match(src,/monthlyPass:null,entry:null,startMonthConfirmed:false/);
 assert.match(src,/if\(!trustedObservation&&!trustedFinancialDaily&&D\?\.get\(code\)/);
});
