'use strict';
/* Offline research only: reproduce the original ABC worker on successive completed-day prefixes.
   No historical publication-time proof is inferred from a retrospective archive. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Contract=require('../worker-data-contract-v1.js');
const root=path.resolve(__dirname,'..'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let engine;
async function originalEngine(){
 if(!engine){
  const bytes=fs.readFileSync(path.join(root,'stock-worker.mjs'));
  // Export the exact existing implementation in an isolated Node module, without changing production Worker.
  const source=bytes.toString('utf8')+'\nexport {analyzeFibonacciNPattern as auditLegacyABC,FIB_PIVOT_RIGHT as auditPivotRight};\n';
  const m=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  engine={evaluate:m.auditLegacyABC,right:m.auditPivotRight,workerSha256:hash(bytes)};
 }
 return engine;
}
function verifiedRows(a){
 const rows=a?.dailySeries,e=a?.officialArchiveEvidence,cal=a?.tradingCalendar;
 if(a?.completed!==true||a?.dailySeriesMeta?.onlyCompletedBars!==true||a?.priceAdjustment?.verified!==true||a.priceAdjustment.basis!=='UNADJUSTED_OFFICIAL_OHLC'||!['TWSE','TPEX'].includes(a.market)||!Array.isArray(rows)||!rows.length||
    e?.schema!=='OFFICIAL_RESEARCH_ARCHIVE_V1'||e.stock!==a.stock||e.market!==a.market||e.date!==a.closeDate||e.historyFingerprint!==Contract.fingerprint(rows)||
    cal?.verified!==true||!cal.source||!Array.isArray(cal.dates)||rows.at(-1).date!==a.closeDate||rows.at(-1).close!==a.close)
   throw Error('Archive identity, completed sessions, price basis or fingerprint unverified');
 const dates=cal.dates.filter(d=>d>=rows[0].date&&d<=a.closeDate);
 const receipts=new Map((e.sourceDays||[]).map(d=>[d.date,d]));
 if(dates.length!==rows.length||rows.some((r,i)=>r.date!==dates[i]||(i>0&&r.date<=rows[i-1].date)||!['open','high','low','close','volume'].every(k=>Number.isFinite(r[k])&&r[k]>0)||r.high<Math.max(r.open,r.close)||r.low>Math.min(r.open,r.close)||r.high<r.low||!receipts.get(r.date)?.source||! /^[a-f0-9]{64}$/i.test(receipts.get(r.date)?.sourceSha256||'')))
  throw Error('Missing, invalid, or unreceipted completed session');
 return rows;
}
async function replayRows(rows,asOf=rows.at(-1)?.date){
 const {evaluate,right,workerSha256}=await originalEngine(),end=rows.findIndex(r=>r.date===asOf);
 if(end<0)throw Error('Cutoff must be an exact completed session');
 const timeline=[],intervals=[];let active=null;
 for(let i=0;i<=end;i++){
  const prefix=rows.slice(0,i+1),date=prefix.at(-1).date,f=evaluate(prefix,prefix.at(-1).close);
  const full=['forming','confirmed'].includes(f.status)&&['A','B','C'].every(k=>Number.isFinite(f[k])&&typeof f[k+'Date']==='string');
  let tuple=null;
  if(full){
   const indices=['A','B','C'].map(k=>prefix.findIndex(r=>r.date===f[k+'Date']));
   const exact=indices.every((n,j)=>n>=0&&n+right<=i&&Math.round(prefix[n][j===1?'high':'low']*100)/100===f[['A','B','C'][j]]);
   if(exact&&indices[0]<indices[1]&&indices[1]<indices[2])tuple=Object.fromEntries(['A','B','C'].flatMap((k,j)=>[[k,f[k]],[k+'Date',f[k+'Date']],[k+'PivotConfirmedDate',prefix[indices[j]+right].date]]));
  }
  const key=tuple?JSON.stringify(tuple):null;
  if(active&&active.key!==key){active.firstAbsentOn=date;active=null;}
  if(key&&!active){active={key,...tuple,firstObservedOn:date,firstAbsentOn:null};intervals.push(active);}
  timeline.push({date,status:f.status,activeABC:tuple,firstObservedOn:active?.firstObservedOn??null,reportedBreakoutDate:f.breakoutDate??null});
 }
 return {asOf,workerSha256,timeline,intervals:intervals.map(({key,...x})=>x),scope:'RETROSPECTIVE_PREFIX_REPLAY',pointInTimeVerified:false,productionAnchorsEnabled:false};
}
async function auditArchive(filename){
 const bytes=fs.readFileSync(filename),a=JSON.parse(bytes),rows=verifiedRows(a);
 return {stock:a.stock,market:a.market,archiveSha256:hash(bytes),priceBasis:a.priceAdjustment.basis,...await replayRows(rows,a.closeDate)};
}
if(require.main===module)(async()=>{
 const output=process.argv[2];if(!output)throw Error('Output path required');
 const studies=await Promise.all(['2330','8099'].map(code=>auditArchive(path.join(root,'data/research/2026-11-26',code+'.json'))));
 fs.writeFileSync(output,JSON.stringify({status:'RESEARCH_ONLY',pointInTimeVerified:false,productionAnchorsEnabled:false,studies},null,2)+'\n');
 console.log(JSON.stringify(studies.map(s=>({stock:s.stock,days:s.timeline.length,intervals:s.intervals.length}))));
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={verifiedRows,replayRows,auditArchive};
