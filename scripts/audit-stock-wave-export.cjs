'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),H=require('../research-official-history-v1'),D=require('../selection-data-v2'),C=require('../four-models-research-v1'),E=require('../elliott-wave-v1'),V=require('../elliott-wave-visual-v1'),R=require('../elliott-wave-report-v1');
(async()=>{
 const root=path.resolve(__dirname,'..'),manifest=require('../data/research/manifest.json'),snapshot=require('../data/market/latest.json'),date=snapshot.tradeDateIso,rows=process.env.AUDIT_CODES?snapshot.rows.filter(q=>process.env.AUDIT_CODES.split(',').includes(q.code)):snapshot.rows;
 global.ShitouOfficialResearchHistory=H;global.fetch=async url=>{const s=String(url),file=s.includes('research-calendar.json')?'data/market/research-calendar.json':'data/research/'+new URL(s).pathname.split('/data/research/')[1],text=fs.readFileSync(path.join(root,file),'utf8');return {ok:true,status:200,text:async()=>text,json:async()=>JSON.parse(text)};};
 D.bind({map:new Map(snapshot.rows.map(q=>[q.code,q])),snapshotRows:snapshot.rows.length,meta:{total:snapshot.rows.length,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true,snapshotContentSha256:snapshot.contentSha256}});await D.prepareResearchEvidence();
 let current=null;global.ShitouResearchIntegration={getCurrentStock:()=>current};const results=[];
 for(const q of rows){
  const item=manifest.stocks[q.code],text=fs.readFileSync(path.join(root,'data/research',item.path),'utf8');assert.equal(crypto.createHash('sha256').update(text).digest('hex'),item.sha256);
  const raw=JSON.parse(text),legacy={...structuredClone(raw),code:q.code,priceAdjustment:{verified:false,basis:'UNKNOWN'},dailySeriesMeta:{...raw.dailySeriesMeta,source:'AUDIT_UNVERIFIED_WORKER_CACHE'}};delete legacy.officialArchiveEvidence;legacy.elliottWave=E.evaluate(legacy);let seeded=false;try{D.remember(legacy,q.code);seeded=true;}catch(_){}
  let result={code:q.code,name:q.name,market:q.market,date,seededWarmCache:seeded};
  try{
   const prepared=await D.prepareResearchSource(legacy,q.code),analysis=C.evaluate(prepared);current={analysis,source:prepared};
   const wave=V.result(legacy),model=R.buildModel(prepared),limited=!!analysis.limitedHistory;
   assert.equal(model.code,q.code);assert.equal(model.date,date);assert.equal(model.close,q.close);
   // A legacy failure must never override a usable verified query result.
   const usable=wave.state!=='DATA_INSUFFICIENT'&&wave.bars.length>=63;if(!limited&&wave.state==='DATA_INSUFFICIENT')throw Error('Unexpected wave data block: '+wave.reason);const legacyModel=R.buildModel(legacy);assert.equal(legacyModel.wave.state,model.wave.state);assert.equal(legacyModel.wave.bars.length,model.wave.bars.length);
   if(!limited&&analysis.elliottWave?.state!=='DATA_INSUFFICIENT'&&analysis.elliottWave?.bars?.length>=63)assert.ok(usable,'verified source lost in export');
   if(usable){assert.equal(wave.bars.at(-1).date,date);assert.equal(wave.bars.at(-1).close,q.close);assert.equal(wave.inputFingerprint,analysis.elliottWave.inputFingerprint);}
   const first=JSON.stringify(model),again=R.buildModel(prepared);assert.equal(JSON.stringify(again),first);
   result={...result,status:usable?'CHART_AVAILABLE':'GENUINE_RESTRICTION',waveState:wave.state,bars:wave.bars.length,reason:usable?wave.reason||null:wave.reason||analysis.reason,restriction:analysis.limitedHistory?.restriction||null,priceVerified:prepared.priceAdjustment?.verified===true,sourceFingerprint:wave.inputFingerprint||null};
  }catch(e){result={...result,status:'ERROR',reason:String(e.message||e)};}
  results.push(result);if(results.length%100===0)console.log('WAVE_EXPORT_PROGRESS '+results.length+'/'+rows.length);
 }
 const counts={},restrictions={};for(const r of results){counts[r.status]=(counts[r.status]||0)+1;if(r.status!=='CHART_AVAILABLE')restrictions[r.restriction||r.reason]=(restrictions[r.restriction||r.reason]||0)+1;}
 const summary={date,checked:results.length,expected:rows.length,warmCacheSeeded:results.filter(r=>r.seededWarmCache).length,counts,restrictions,unexpectedErrors:results.filter(r=>r.status==='ERROR').length,unknownPriceAfterVerification:results.filter(r=>r.priceVerified&&/價格或除權息基準還沒核對/.test(r.reason||'')).length,selected:results.filter(r=>['1815','1101','2330','8039'].includes(r.code))};
 fs.mkdirSync(path.join(root,'evidence'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/stock-wave-export-all.json'),JSON.stringify({summary,results},null,2));const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';fs.writeFileSync(path.join(root,'evidence/stock-wave-export-all.csv'),'\uFEFF'+[['代號','名稱','市場','日期','狀態','波浪狀態','日K根數','限制','原因'],...results.map(r=>[r.code,r.name,r.market,r.date,r.status,r.waveState,r.bars,r.restriction,r.reason])].map(row=>row.map(quote).join(',')).join('\n')+'\n');console.log('STOCK_WAVE_EXPORT_AUDIT='+JSON.stringify(summary));assert.equal(summary.checked,rows.length);assert.equal(summary.unexpectedErrors,0);assert.equal(summary.unknownPriceAfterVerification,0);
})().catch(e=>{console.error(e);process.exitCode=1;});
