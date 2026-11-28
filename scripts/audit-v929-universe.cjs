'use strict';
// Replay the official archived completed session, never synthetic history.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const C=require('../strategy-low-base-breakout-v929.js'),S=require('../strategy-low-base-scanner-v929.js'),H=require('../research-official-history-v1'),D=require('../selection-data-v2'),Old=require('../restaurant-filter-v1');
(async()=>{
 const root=path.resolve(__dirname,'..'),market=require('../data/market/latest.json'),manifest=require('../data/research/manifest.json'),date=market.tradeDateIso;
 assert.equal(manifest.date,date);assert.equal(manifest.snapshotContentSha256,market.contentSha256);assert.equal(manifest.verified,true);
 assert.ok(market.rows.length>0);assert.equal(new Set(market.rows.map(q=>String(q.code))).size,market.rows.length);
 const out=path.resolve(process.argv[2]||'/tmp/v929-universe');fs.mkdirSync(out,{recursive:true});
 global.ShitouOfficialResearchHistory=H;
 global.fetch=async url=>{const s=String(url),p=s.includes('research-calendar.json')?'data/market/research-calendar.json':'data/research/'+new URL(s).pathname.split('/data/research/')[1],t=fs.readFileSync(path.join(root,p),'utf8');return {ok:true,status:200,text:async()=>t,json:async()=>JSON.parse(t)};};
 const bundle={map:new Map(market.rows.map(q=>[String(q.code),q])),snapshotRows:market.rows.length,meta:{total:market.rows.length,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:market.marketCoverageReady===true||market.coverage?.marketCoverageReady===true,industryCoverageReady:true,snapshotTimelinessReady:true,snapshotContentSha256:market.contentSha256}};
 D.bind({...bundle,meta:{...bundle.meta,marketCoverageReady:true}});await D.prepareResearchEvidence();
 const plan=S.pool(bundle),records=[];
 let fundamentals=null,fundamentalEvidenceHash=null;
 if(process.env.V929_FUNDAMENTAL_EVIDENCE){
  const bytes=fs.readFileSync(process.env.V929_FUNDAMENTAL_EVIDENCE);
  fundamentals=require('../strategy-low-base-fundamentals-v929.js').indexBundle(JSON.parse(bytes),{asOf:date,snapshotHash:market.contentSha256});
  fundamentalEvidenceHash=crypto.createHash('sha256').update(bytes).digest('hex');
 }
 for(const item of plan.items){
 const {code,q}=item;let result,hash=null;
 const ic=String(q.industryCode||'').padStart(2,'0'),industry=String(q.industryName||q.industry||'');
 if(!Old.ordinary(code,q)||['17','22','14'].includes(ic)||/金融|銀行|保險|證券|金控|生技|營建|建材營造/.test(industry))result={status:'EXCLUDED',eligible:false,reasons:['不在新策略範圍']};
 else try{
 const m=manifest.stocks[code];assert.ok(m,'官方歷史清單缺少標的');
 const bytes=fs.readFileSync(path.join(root,'data/research',m.path));hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(hash,m.sha256);
 const report=await D.prepareResearchSource(JSON.parse(bytes),code);
 result=C.evaluate(report,{asOf:date,code,quote:D.context(code).q,sector:q,fundamentals:fundamentals?.get(code,q.market)});
 }catch(e){result={status:'DATA_ERROR',eligible:false,reasons:[String(e.message||e)]};}
 records.push({...result,code,name:q.name,date,sourceHash:hash});
 if(records.length%200===0)console.log('V929_PROGRESS '+records.length+'/'+plan.items.length);
 }
 const scan=S.finish(plan,records,false),counts={};
 for(const row of records)counts[row.status]=(counts[row.status]||0)+1;
 assert.equal(records.length,market.rows.length);assert.equal(new Set(records.map(r=>r.code)).size,records.length);
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),records.length);
 assert.ok(scan.top8.length<=8);assert.ok(scan.candidates.every(c=>c.checks.length===21&&c.checks.every(k=>k.pass)));
 const diagnostics=scan.diagnostics;
 const A=require('../strategy-low-base-archive-v929.js');
 const historyManifestHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/research/manifest.json'))).digest('hex');
 const archive=A.build({...scan,marketCoverageReady:plan.marketCoverageReady},{snapshotHash:market.contentSha256,historyManifestHash,fundamentalEvidenceHash});
 fs.writeFileSync(path.join(out,'rank-archive.json'),JSON.stringify(archive)+'\n');
 console.log('V929_RANK_ARCHIVE '+JSON.stringify({date:archive.date,total:archive.total,counts:archive.counts,complete:archive.complete,zeroConfirmed:archive.zeroConfirmed,top8:archive.top8}));
 const summary={model:C.MODEL,date,marketSnapshot:market.contentSha256,input:records.length,counts,top8:scan.top8.map(c=>({code:c.code,name:c.name,score:c.quality.score})),candidateCount:scan.candidates.length,fullMarketCertified:scan.fullMarketCertified,zeroConfirmed:scan.zeroConfirmed,source:'GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE',fundamentalsConnected:fundamentals!==null,fundamentalEvidenceHash,performanceBacktest:false,unavailableReasons:diagnostics.unavailableReasons,gateCounts:diagnostics.gateCounts};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({summary,diagnostics,records},null,2));
 console.log('V929_ARCHIVE_REPLAY '+JSON.stringify(summary));
 console.log('V929_UNAVAILABLE_BY_CODE '+JSON.stringify(diagnostics.unavailableByCode));
})().catch(e=>{console.error(e);process.exitCode=1;});
