// Read-only candidate evidence: never splice or invent a missing session.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {extractTwseMiIndexRows,extractTpexDailyQuoteRows,normalizeQuote} from './update-market-snapshot.mjs';
import {sourceUrl} from './build-official-research-history.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const root=process.cwd();
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const compact=d=>d.replaceAll('-','');
const codeOf=r=>String(r.Code??r.SecuritiesCompanyCode??r.SecuritiesCode??r.CompanyCode??r['股票代號']??r['證券代號']??r['代號']??'').trim();
const rawVolume=r=>{const x=r.TradeVolume??r.TradingShares??r.TradingVolume??r.Volume??r['成交股數']??r['成交量'];return x!=null&&String(x).trim()!==''&&/^[\d,]+$/.test(String(x).trim())?Number(String(x).replaceAll(',','')):null;};
const inRange=q=>q?.officialTradeValue>0&&q.volume>0&&q.officialTradeValue/q.volume>=q.low-.02&&q.officialTradeValue/q.volume<=q.high+.02;
const replay=await read(process.argv[2]||'/tmp/v929-universe/results.json');
const manifest=await read('data/research/manifest.json'),snapshot=await read('data/market/latest.json');
assert.equal(replay.summary.date,manifest.date);assert.equal(replay.summary.marketSnapshot,snapshot.contentSha256);assert.equal(manifest.snapshotContentSha256,snapshot.contentSha256);
const quotes=new Map(snapshot.rows.map(q=>[String(q.code),q])),jobs=new Map(),records=[];
for(const item of replay.records.filter(r=>['DATA_ERROR','INSUFFICIENT_DATA'].includes(r.status))){
 const q=quotes.get(item.code),m=manifest.stocks[item.code],rec={code:item.code,name:item.name,market:q?.market,replayReasons:item.reasons||[item.reason],archiveBars:m?.bars??null};
 records.push(rec);
 try{
  assert.ok(q&&m&&m.path===manifest.date+'/'+item.code+'.json');
  const raw=await fs.readFile(path.join(root,'data/research',m.path));assert.equal(sha(raw),m.sha256);
  if(item.sourceHash)assert.equal(sha(raw),item.sourceHash);
  const a=JSON.parse(raw);assert.equal(a.stock,item.code);assert.equal(a.market,q.market);assert.equal(a.closeDate,manifest.date);
  rec.originalBars=a.originalDailySeries?.length??null;rec.latestGap=a.officialArchiveEvidence?.excludedEarlierSessions?.at(-1)??null;
  rec.kind=(item.reasons||[]).some(x=>String(x).includes('成交量與成交金額'))?'VOLUME_SCOPE':'SHORT_HISTORY';
  rec.checkDate=rec.kind==='VOLUME_SCOPE'?manifest.date:rec.latestGap;
  if(!rec.checkDate){rec.status='NO_GAP_DATE_REQUIRES_LISTING_CHECK';continue;}
  assert.ok(manifest.researchSessions.includes(rec.checkDate));
  const key=q.market+'|'+rec.checkDate;rec.key=key;if(!jobs.has(key))jobs.set(key,{market:q.market,date:rec.checkDate});
 }catch(e){rec.status='ARCHIVE_EVIDENCE_ERROR';rec.error=String(e.message||e);}
}
const entries=[...jobs],answers=new Map();let cursor=0;
async function worker(){
 while(cursor<entries.length){const [key,{market,date}]=entries[cursor++],url=sourceUrl(market,date);let last;
  for(let attempt=0;attempt<2;attempt++)try{
   const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(18000),cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const raw=await response.text(),data=JSON.parse(raw),rows=(market==='TWSE'?extractTwseMiIndexRows:extractTpexDailyQuoteRows)(data,compact(date));
   if(rows.length<(market==='TWSE'?800:600))throw Error('指定日日期或官方全表筆數未通過');
   const map=new Map();for(const row of rows){const code=codeOf(row);if(!code)continue;const prior=map.get(code)||[];prior.push(row);map.set(code,prior);}
   answers.set(key,{url,sha256:sha(raw),rowCount:rows.length,map});last=null;break;
  }catch(e){last=String(e.message||e);}
  if(last)answers.set(key,{url,error:last});
 }
}
await Promise.all([worker(),worker(),worker()]);
for(const rec of records){
 if(rec.status)continue;const a=answers.get(rec.key);
 if(!a||a.error){rec.status='OFFICIAL_SOURCE_UNAVAILABLE';rec.error=a?.error||'未取得來源';continue;}
 rec.source=a.url;rec.sourceSha256=a.sha256;rec.sourceRows=a.rowCount;
 const matches=a.map.get(rec.code)||[];
 if(!matches.length){rec.status='ABSENT_FROM_OFFICIAL_DAILY_TABLE';continue;}
 if(matches.length!==1){rec.status='OFFICIAL_ROW_DUPLICATE';continue;}
 const row=matches[0],vol=rawVolume(row),fresh=normalizeQuote(row,rec.market,compact(rec.checkDate),new Map());
 rec.officialVolume=vol;
 if(vol===0){rec.status='OFFICIAL_NO_TRADE';continue;}
 if(!fresh||!Number.isFinite(fresh.volume)||fresh.volume<=0){rec.status='OFFICIAL_OHLCV_UNAVAILABLE';continue;}
 rec.officialRow={open:fresh.open,high:fresh.high,low:fresh.low,close:fresh.close,volume:fresh.volume,officialTradeValue:fresh.officialTradeValue};
 if(rec.kind==='SHORT_HISTORY'){rec.status='OFFICIAL_VALID_GAP_ROW_FOUND';continue;}
 const q=quotes.get(rec.code);
 rec.snapshot={open:q.open,high:q.high,low:q.low,close:q.close,volume:q.volume,officialTradeValue:q.officialTradeValue};
 rec.sameSnapshot=['open','high','low','close','volume','officialTradeValue'].every(k=>fresh[k]===q[k]);
 rec.impliedAverage=fresh.officialTradeValue>0?fresh.officialTradeValue/fresh.volume:null;
 rec.status=!rec.sameSnapshot?'OFFICIAL_ROW_DIFFERS_FROM_SNAPSHOT':inRange(fresh)?'SCOPE_RECHECK_IN_RANGE':'SCOPE_CONFLICT_PERSISTS';
}
const counts={};for(const x of records)counts[x.status]=(counts[x.status]||0)+1;
const result={date:manifest.date,marketSnapshot:snapshot.contentSha256,checked:records.length,uniqueOfficialRequests:jobs.size,counts,records,policy:'Read-only evidence. Absent row is not proof of zero trade; candidate recovered rows require full calendar, source and adjustment verification before any archive update.'};
const output=process.argv[3]||'/tmp/v929-universe/history-gap-review.json';
await fs.writeFile(output,JSON.stringify(result,null,2));console.log('V929_GAP_REVIEW '+JSON.stringify({date:result.date,checked:result.checked,uniqueOfficialRequests:result.uniqueOfficialRequests,counts}));
