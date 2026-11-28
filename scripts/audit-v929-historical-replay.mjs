// Candidate multi-session replay using each date's archived official market universe. NOT a validated performance backtest.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {extractTwseMiIndexRows,extractTpexDailyQuoteRows,normalizeQuote,verifyMarketSnapshotCoverage} from './update-market-snapshot.mjs';
import {sourceUrl} from './build-official-research-history.mjs';
const require=createRequire(import.meta.url),C=require('../strategy-low-base-breakout-v929.js'),L=require('../strategy-low-base-lifecycle-v929.js'),Old=require('../restaurant-filter-v1.js');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const m=await read('data/research/manifest.json'),snapshot=await read('data/market/latest.json');
assert.equal(m.verified,true);assert.equal(snapshot.marketCoverageReady,true);assert.equal(m.date,snapshot.tradeDateIso);assert.equal(m.snapshotContentSha256,snapshot.contentSha256);
const sessions=m.researchSessions;
assert.ok(sessions.length>=72&&sessions.at(-1)===m.date&&sessions.every((d,i)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&(!i||d>sessions[i-1])));
const markets=['TWSE','TPEX'],archive=new Map();
for(const market of markets)for(const date of sessions){
 const day=JSON.parse(zlib.gunzipSync(await fs.readFile('data/research/days/'+market+'-'+date+'.json.gz')));
 assert.equal(day.schema,'OFFICIAL_MARKET_DAY_V1');assert.equal(day.market,market);assert.equal(day.date,date);assert.equal(day.source,sourceUrl(market,date));assert.match(day.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(day.volumeUnit,'shares');assert.ok(Array.isArray(day.rows));
 const rows=new Map();for(const {code,...b} of day.rows){assert.ok(!rows.has(String(code)));assert.equal(b.date,date);rows.set(String(code),b);}
 archive.set(market+'|'+date,rows);
}
const valid=b=>b&&['open','high','low','close','volume'].every(k=>Number.isFinite(b[k])&&b[k]>0)&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close);
const equal=(a,b)=>['open','high','low','close','volume'].every(k=>a?.[k]===b?.[k]);
const bar=(q,i)=>archive.get(q.market+'|'+sessions[i])?.get(String(q.code));
function prefix(q,t){
 const result=[];for(let i=t;i>=0&&result.length<160;i--){const b=bar(q,i);if(!valid(b))break;if(result.length&&Math.abs(result[0].open/b.close-1)>.30)break;result.unshift(b);}return result;
}
const scope=q=>Number.isFinite(q?.officialTradeValue)&&q.officialTradeValue>0&&q.volume>0&&q.officialTradeValue/q.volume>=q.low-.02&&q.officialTradeValue/q.volume<=q.high+.02&&q.tradeValueSource==='OFFICIAL_REPORTED';
const included=q=>Old.ordinary(String(q.code),q)&&!['17','22','14'].includes(String(q.industryCode||'').padStart(2,'0'))&&!/金融|銀行|保險|證券|金控|生技|營建|建材營造/.test(q.industryName||q.industry||'')&&(q.industryName||q.industry||q.industryCode);
function verifyDatedSnapshot(s,date){
 verifyMarketSnapshotCoverage(s);
 assert.equal(s.tradeDateIso,date);assert.equal(s.tradeDate,date.replaceAll('-',''));
 assert.equal(new Set(s.rows.map(q=>String(q.code))).size,s.rows.length);
 const keys=['schemaVersion','tradeDate','tradeDateIso','marketCoverageReady','marketCalendar','rows','counts','officialSources','sourceMeta'];
 const core=Object.fromEntries(keys.map(k=>[k,s[k]]));
 assert.equal(sha(JSON.stringify(core)),s.contentSha256,'指定日封存快照指紋不符');
 for(const market of ['twseQuotes','tpexQuotes']){
  const meta=s.sourceMeta?.[market];
  assert.equal(meta?.status,200);assert.equal(meta?.finalDate,s.tradeDate,'官方來源日期不符');
 }
 assert.ok(Number.isFinite(Date.parse(s.generatedAt)));
 const published=Date.parse(s.generatedAt),afterClose=Date.parse(date+'T13:30:00+08:00'),nextDay=Date.parse(date+'T00:00:00+08:00')+86400000;
 assert.ok(published>=afterClose&&published<nextDay,'封存快照非指定交易日盤後發布');
 return s;
}
async function dated(market,date){
 const url=sourceUrl(market,date);let error;
 for(let i=0;i<2;i++)try{
 const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(!res.ok)throw Error('HTTP '+res.status);
 const raw=await res.text(),data=JSON.parse(raw),compact=date.replaceAll('-',''),rows=(market==='TWSE'?extractTwseMiIndexRows:extractTpexDailyQuoteRows)(data,compact);
 if(rows.length<(market==='TWSE'?800:600))throw Error('指定日官方來源日期或筆數不符');
 const map=new Map();for(const row of rows){const q=normalizeQuote(row,market,compact,new Map());if(!q)continue;if(map.has(q.code))throw Error('重複代號');map.set(q.code,q);}
 return {ok:true,url,sha256:sha(raw),rows:map};
 }catch(e){error=String(e.message||e);}
 return {ok:false,url,error};
}
const dates=sessions.slice(-11),sources=[],signals=[],perDay=[],snapshotEvidence=[];
for(const date of dates){
 const t=sessions.indexOf(date),daily=verifyDatedSnapshot(await read('data/market/archive/'+date+'.json'),date),universe=daily.rows.filter(included),official=new Map(await Promise.all(markets.map(async market=>[market,await dated(market,date)])));
 snapshotEvidence.push({date,contentSha256:daily.contentSha256,generatedAt:daily.generatedAt,universe:universe.length,total:daily.rows.length});
 for(const [market,s] of official)sources.push({market,date,url:s.url,sha256:s.sha256??null,ready:s.ok,error:s.error??null});
 const counts={PASS:0,FAIL:0,INSUFFICIENT_DATA:0,DATA_ERROR:0},reasons={},amountSources={},gates={};
 const missing=reason=>{counts.INSUFFICIENT_DATA++;reasons[reason]=(reasons[reason]||0)+1;};
 for(const q of universe){
 const b=prefix(q,t);if(b.length<C.MIN_BARS){missing('連續有效日K不足');continue;}
 const fresh=official.get(q.market),freshQuote=fresh?.rows?.get(String(q.code)),last=b.at(-1);
 const archivedMatches=equal(q,last),freshMatches=fresh?.ok&&equal(freshQuote,last);
 const archivedUsable=archivedMatches&&scope(q),freshUsable=freshMatches&&scope(freshQuote);
 if(archivedUsable&&freshUsable&&q.officialTradeValue!==freshQuote.officialTradeValue){missing('官方同口徑成交金額不一致');continue;}
 let quote,proof;
 if(archivedUsable){quote=q;proof={kind:'DATED_ARCHIVED_SNAPSHOT',sha256:daily.contentSha256};}
 else if(freshUsable&&(!archivedMatches||q.officialTradeValue==null)){quote=freshQuote;proof={kind:'DATED_OFFICIAL_RECHECK',sha256:fresh.sha256};}
 else{missing(!archivedMatches&&!freshMatches?'指定日OHLCV與封存不符或缺失':(archivedMatches?q:freshQuote)?.officialTradeValue==null?'官方成交金額缺失':'成交值口徑未核對');continue;}
 amountSources[proof.kind]=(amountSources[proof.kind]||0)+1;
 const result=C.compute(b,quote.officialTradeValue,null,date);assert.ok(Object.hasOwn(counts,result.status));counts[result.status]++;
 for(const check of result.checks||[]){const g=gates[check.key]||(gates[check.key]={pass:0,fail:0});g[check.pass?'pass':'fail']++;}
 if(!result.eligible)continue;
 assert.equal(result.checks.length,21);assert.ok(result.checks.every(x=>x.pass));assert.equal(b.at(-1).date,date);
 const signal={...result,code:String(q.code),name:q.name,market:q.market,date};
 const horizon=Math.min(t+5,sessions.length-1),after=b.slice(),observations=[];
 for(let i=t;i<=horizon;i++){
  if(i>t){const next=bar(q,i);if(!valid(next)||Math.abs(next.open/after.at(-1).close-1)>.30){observations.push({date:sessions[i],age:i-t,state:'UNAVAILABLE',reason:'後續交易日缺失或價格基準中斷'});break;}after.push(next);}
  const state=L.track(signal,after,sessions[i]);
  observations.push({date:sessions[i],age:i-t,state:state.state,close:after.at(-1).close,grossCloseChangePct:(after.at(-1).close/signal.features.close-1)*100,volumeHealthy:state.lastVolumeHealthy,breakoutPrice:state.breakoutPrice,breakoutLow:state.breakoutLow,ma20:state.ma20,confirmedAt:state.confirmedAt,failureDate:state.failureDate});
 }
 signals.push({code:signal.code,name:signal.name,market:q.market,date,score:result.quality.score,grade:result.quality.grade,sourceSha256:proof.sha256,amountSource:proof.kind,features:result.features,observations});
 }
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),universe.length);
 perDay.push({date,universe:universe.length,counts,reasons,amountSources,gates});
 console.log('V929_HISTORICAL_SESSION '+JSON.stringify({date,universe:universe.length,counts,reasons,amountSources}));
}
const summary={model:C.MODEL,asOf:m.date,dates,universeByDate:snapshotEvidence.map(x=>({date:x.date,count:x.universe})),signalCount:signals.length,perDay,sourceFailures:sources.filter(s=>!s.ready).length,pointInTimeFundamentals:false,historicalUniverseVerified:true,performanceBacktest:false,policy:'依各交易日已封存且校驗指紋的市場快照建立母體及產業分類；僅使用截至當日連續官方日K、相符的官方成交金額；封存與重查金額衝突時不採用。後續收盤變化僅為觀察，不是可成交報酬；未計手續費、滑價、停牌與除權息，尚未完成正式績效回測。'};
const out=process.argv[2]||'/tmp/v929-universe/historical-replay.json';
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify({summary,snapshotEvidence,sources,signals},null,2));console.log('V929_HISTORICAL_REPLAY '+JSON.stringify(summary));
