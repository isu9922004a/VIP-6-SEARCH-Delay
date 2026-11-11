'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),C=require('../strategy-2560-v1'),K=require('../kline-attack-v90'),H=require('../research-official-history-v1'),D=require('../selection-data-v2');
(async()=>{const root=path.resolve(__dirname,'..'),market=require('../data/market/latest.json'),manifest=require('../data/research/manifest.json'),date=market.tradeDateIso;
 assert.equal(manifest.date,date);assert.equal(manifest.snapshotContentSha256,market.contentSha256);assert.equal(manifest.verified,true);
 const out=path.resolve(process.argv[2]||'/tmp/v90-universe');fs.mkdirSync(out,{recursive:true});
 global.ShitouOfficialResearchHistory=H;global.fetch=async url=>{const s=String(url),p=s.includes('research-calendar.json')?'data/market/research-calendar.json':'data/research/'+new URL(s).pathname.split('/data/research/')[1],t=fs.readFileSync(path.join(root,p),'utf8');return {ok:true,status:200,text:async()=>t,json:async()=>JSON.parse(t)};};
 D.bind({map:new Map(market.rows.map(q=>[q.code,q])),snapshotRows:market.rows.length,meta:{total:market.rows.length,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true,snapshotContentSha256:market.contentSha256}});await D.prepareResearchEvidence();
 const records=[],selected=[];
 for(const q of market.rows){const code=q.code,u=C.universe(code,q,q);if(!u.ok&&u.state==='EXCLUDED'){records.push({code,name:q.name,state:'EXCLUDED',reason:u.reason});continue;}
  const m=manifest.stocks[code];let a,k,raw,prepared,sourceHash;
  try{assert.ok(m,'官方歷史清單缺少標的');const bytes=fs.readFileSync(path.join(root,'data/research',m.path));sourceHash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(sourceHash,m.sha256);raw=JSON.parse(bytes);prepared=await D.prepareResearchSource(raw,code);a=C.evaluate(prepared,{asOf:date,code,quote:D.context(code).q,sector:q});k=a.kline||K.evaluate(prepared);}
  catch(e){a={status:'DATA_ERROR',eligible:false,reasons:[String(e.message||e)]};k={state:'DATA_INSUFFICIENT',reason:a.reasons[0]};}
  const baseline={code,name:q.name,date,sourceHash,marketSnapshot:market.contentSha256,core:raw?{close:raw.close,originalBars:raw.canonicalBars.length,priceAdjustment:raw.priceAdjustment}:null};
  const row={...baseline,state:a.status,eligible:a.eligible,reason:a.reasons?.join('；')||null,features:a.features||null,riskLevel:a.risk?.level??null,volumeRuleCompleteness:a.risk?.volumeRuleCompleteness??null,klineState:k.state,klineReason:k.reason||null,canonicalFingerprint:a.validation?.historyFingerprint||null};records.push(row);
  if(a.eligible||['1709','2330','8039'].includes(code)){if(selected.length<12||['1709','2330','8039'].includes(code)){selected.push({candidate:a,source:prepared||raw,baseline});}}
  if(records.length%200===0)console.log('V91_PROGRESS '+records.length+'/'+market.rows.length);
 }
 const indexRaw=require('../data/index/TAIEX.json');assert.equal(indexRaw.closeDate,date);const indexReport={...indexRaw,stock:'TAIEX',type:'index',expectedTradingDates:indexRaw.tradingCalendar?.verified?indexRaw.tradingCalendar.dates:null},index=K.evaluate(indexReport,{type:'index'});
 const counts={};for(const r of records)counts[r.state]=(counts[r.state]||0)+1;
 const summary={version:'V9.1',strategyVersion:C.MODEL,date,input:market.rows.length,counts,qualified:records.filter(r=>r.eligible).length,dataRestricted:records.filter(r=>['INSUFFICIENT_DATA','DATA_ERROR'].includes(r.state)).length,klineAvailable:records.filter(r=>r.klineState==='AVAILABLE').length,indexState:index.state,indexReason:index.reason||null,ranking:'CODE_ASC',otherFive:'PROTECTED_SOURCE_AND_INLINE_SHA256',volume9012:'PARTIAL_VERIFIED_VMA5_GT_VMA60',performance:'NOT_VALIDATED'};
 assert.equal(Object.values(counts).reduce((s,n)=>s+n,0),summary.input);assert.equal(new Set(records.map(r=>r.code)).size,summary.input);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({summary,records},null,2));fs.writeFileSync(path.join(out,'preview-input.json'),JSON.stringify({date,selected,indexReport,index},null,2));console.log('V91_UNIVERSE_PASS '+JSON.stringify(summary));
})().catch(e=>{console.error(e);process.exitCode=1;});
