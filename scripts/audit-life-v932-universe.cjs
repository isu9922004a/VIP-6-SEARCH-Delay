'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const F=require('../four-models-research-v1'),C=require('../kline-life-03-core-v1'),R=require('../kline-life-03-report-v1'),Official=require('../research-official-history-v1');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),root=path.resolve(__dirname,'..');
function oracle(e,bars){
 const rows=bars.slice(e.k0Index),p=e.lifeLinePrice;
 if(e.side==='BEAR'){
  const first=rows.find(b=>b.close>p)?.date||null;
  let start=rows.length;while(start>0&&rows[start-1].close>p)start--;
  const count=rows.length-start;
  const retested=rows.slice(start+2).some((b,j)=>{const prev=rows[start+j+1];return prev.low>p*1.005&&b.low>=p*.995&&b.low<=p*1.005;});
  return {state:count===0?(first?'BREAKOUT_FAILED':'RESISTANCE_WATCH'):count===1?'BREAKOUT_INITIAL':retested?'RETEST_HELD':'BREAKOUT_HELD',firstBreakoutDate:first,firstBreakdownDate:null};
 }
 const first=rows.findIndex(b=>b.close<p),relevant=first<0?null:rows.slice(first).filter(b=>b.close!==p).at(-1);
 return {state:first<0?'SUPPORT_WATCH':relevant.close<p?'SUPPORT_BROKEN':'SUPPORT_RECLAIMED',firstBreakoutDate:null,firstBreakdownDate:first<0?null:rows[first].date};
}
function audit({out='/tmp/v932-all-stocks',officialFiles=null}={}){
 fs.mkdirSync(out,{recursive:true});const m=Official.inspectManifest(JSON.parse(fs.readFileSync(path.join(root,'data/research/manifest.json')))),rows=[],failures=[],sourceDifferences=[],states={},roles={},studies=[];
 const datedFiles=Object.fromEntries(['TWSE','TPEX'].map(market=>[market,path.join(root,'scripts/fixtures','v932-source-'+m.date+'-'+market+'.json.gz')]));
 if(!officialFiles&&Object.values(datedFiles).every(f=>fs.existsSync(f)))officialFiles=datedFiles;
 const officialQuotes=officialFiles?loadQuotes(officialFiles,m.date):null;
 for(const code of Object.keys(m.stocks).sort()){
  let study;try{
   const item=m.stocks[code],bytes=fs.readFileSync(path.join(root,'data/research',item.path));assert.equal(sha(bytes),item.sha256,'published source digest');
   const raw=Official.inspectReport(JSON.parse(bytes),m,code);
   let volumeDifference=null;if(officialQuotes){const quote=officialQuotes.get(item.market+'|'+code);assert.ok(quote,'latest official exchange row missing');const last=raw.dailySeries.at(-1);for(const k of ['open','high','low','close'])assert.ok(quote[k]!==null&&Math.abs(quote[k]-last[k])<.005,code+' latest '+k+' differs: '+quote[k]+' / '+last[k]);if(quote.volume!==last.volume){volumeDifference={code,market:item.market,date:m.date,archivedVolume:last.volume,latestOfficialVolume:quote.volume};sourceDifferences.push(volumeDifference);}}
   const analysis=F.evaluate(raw),bound=C.withSource(analysis,raw);study=C.evaluate(bound);
   assert.equal(study.code,code);assert.equal(study.date,m.date);assert.equal(study.researchOnly,true);assert.equal(study.affectsEligibility,false);assert.equal(study.affectsRanking,false);assert.equal(study.automaticTrade,false);assert.equal(study.performance,'NOT_VALIDATED');
   const display=R.fields(study),text=R.lines(study).join('\n');if(volumeDifference&&study.state!=='INSUFFICIENT_DATA'){assert.equal(study.sourceVolumeAudit?.uncertain,true,'different volume must be disclosed');assert.equal(study.sourceVolumeAudit.latestOfficialVolume,volumeDifference.latestOfficialVolume,'source revision proof must match the actual official response');assert.equal(study.currentTrend.volumeRatio,null,'unresolved volume cannot confirm strength');assert.equal(study.indicators.volumeRatio,null);assert.match(text,/成交量.*待核對|成交量來源版本有差異/);assert.ok(!study.confirmationEvidence.some(v=>v.startsWith('當日量為')));}assert.doesNotMatch(text,/NaN|Infinity|undefined|BULL_|BEAR_|FLOW_FUNDAMENTAL_|MOMENTUM_CONTINUATION_|UNADJUSTED_/);
   assert.ok(display.teaching.length>=4);assert.ok(display.teaching.map(x=>x.value).join(' ').includes('K0：'));
   if(study.state==='INSUFFICIENT_DATA'){assert.equal(study.event,null);assert.equal(study.scenario,undefined);assert.ok(study.reason);}
   else{
    const bars=study.validatedBars;assert.equal(bars.at(-1).date,m.date);
    for(const e of study.events){const expected=oracle(e,bars);assert.equal(e.lifecycleState,expected.state,'closing-path oracle');assert.equal(e.firstBreakoutDate,expected.firstBreakoutDate);assert.equal(e.firstBreakdownDate,expected.firstBreakdownDate);assert.equal(e.lifeLinePrice,e.side==='BULL'?bars[e.k3Index].low:bars[e.k3Index].high);assert.equal(e.dataAsOf,m.date);assert.equal(e.k0Index-e.k3Index,3);assert.equal(e.originalEvent.eventId,e.eventId);if(e.lastTransition)assert.ok(!/INTRADAY|ATTEMPT|_TEST$/.test(e.lastTransition.transitionReason));}
    const e=study.event;if(e){if(e.side==='BEAR'&&e.events.filter(v=>v.kind==='BREAKOUT_CONFIRMED').length>1)assert.match(display.details[2].value,/再次收盤突破/);if(!e.referenceOnly&&e.lifecycleState==='BREAKOUT_INITIAL'&&e.confirmedAt!==e.firstBreakoutDate){assert.match(study.scenario.bullish,/再次突破/);assert.doesNotMatch(study.scenario.bullish,/已首次突破/);}if(['BREAKOUT_HELD','RETEST_HELD'].includes(e.lifecycleState))assert.doesNotMatch(display.summary.value,/尚未突破|還沒.*突破/);if(e.referenceOnly){assert.equal(e.currentRole,'HISTORICAL_REFERENCE');assert.equal(e.isCurrentResistance,false);assert.equal(e.isCurrentSupport,false);assert.doesNotMatch(display.summary.value,/未解除的上方壓力/);}
     const earlier=C.evaluate(bound,{asOf:e.k0Date});const same=earlier.events.find(x=>x.eventId===e.eventId);assert.ok(same);assert.deepEqual(same.originalEvent,e.originalEvent);assert.equal(earlier.sourceVolumeAudit,null,'past replay cannot use a later source revision');assert.ok(!same.firstBreakoutDate||same.firstBreakoutDate<=earlier.date);
    }
   }
   const key=study.event?.lifecycleState||study.lifecycleState;states[key]=(states[key]||0)+1;roles[study.currentRole||'NONE']=(roles[study.currentRole||'NONE']||0)+1;
   rows.push({code,name:raw.name,date:m.date,state:study.state,lifecycleState:key,currentRole:study.currentRole,referenceOnly:study.referenceOnly,line:study.line??null,close:study.close??null,firstBreakoutDate:study.event?.firstBreakoutDate||null,bars:study.historyBarCount||0,sourceSha256:item.sha256,volumeComparison:volumeDifference?'DECLARED_DIFFERENCE':officialQuotes?'MATCH':'ARCHIVE_ONLY',result:'PASS',reason:study.reason});studies.push(study);
  }catch(e){failures.push({code,reason:e.message,stack:e.stack});rows.push({code,result:'FAIL',reason:e.message});}
  if(rows.length%100===0)console.log('LIFE_UNIVERSE_PROGRESS '+rows.length+'/'+m.universe+' failures='+failures.length);
 }
 const result={version:'V9.3.2',date:m.date,universe:m.universe,checked:rows.length,states,roles,officialLatestCompared:!!officialQuotes,source:'published official exchange archive, per-file SHA256 + closing-path oracle + point-in-time replay',researchOnly:true,performanceValidated:false,sourceDifferences,failures,status:failures.length?'FAIL':'PASS',rows};
 fs.writeFileSync(path.join(out,'core-universe.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'studies.json'),JSON.stringify(studies));fs.writeFileSync(path.join(out,'core-universe.csv'),'code,name,result,state,lifecycleState,currentRole,referenceOnly,line,close,firstBreakoutDate,bars\n'+rows.map(r=>[r.code,r.name,r.result,r.state,r.lifecycleState,r.currentRole,r.referenceOnly,r.line,r.close,r.firstBreakoutDate,r.bars].map(v=>JSON.stringify(v??null)).join(',')).join('\n'));
 if(failures.length)throw Error('Life-line full-universe failures: '+failures.length+'; see '+out+'/core-universe.json');console.log('LIFE_UNIVERSE_PASS '+JSON.stringify({...result,rows:undefined}));return result;
}
const {loadQuotes}=require('./life-official-quotes-v932.cjs');
if(require.main===module){const out=process.argv[2]||'/tmp/v932-all-stocks';audit({out,officialFiles:process.argv[3]&&process.argv[4]?{TWSE:process.argv[3],TPEX:process.argv[4]}:null});}
module.exports={audit,oracle,loadQuotes};
