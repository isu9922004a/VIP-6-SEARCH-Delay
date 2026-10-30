// Actual exchange OHLCV for every current stock. No interpolation or adjusted Yahoo rows.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {extractTwseMiIndexRows,extractTpexDailyQuoteRows,normalizeQuote} from './update-market-snapshot.mjs';
const require=createRequire(import.meta.url),C=require('../worker-data-contract-v1.js');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const compact=d=>d.replaceAll('-','');
export const sourceUrl=(market,date)=>market==='TWSE'?`https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${compact(date)}&type=ALLBUT0999`:`https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${date.replaceAll('-','/')}&type=EW&response=json`;
export async function fetchDay(market,date,fetcher=fetch){
 const url=sourceUrl(market,date);let last;
 for(let attempt=0;attempt<3;attempt++)try{
  const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)});
  const raw=await response.text();if(!response.ok)throw Error('HTTP '+response.status);
  const data=JSON.parse(raw),parsed=(market==='TWSE'?extractTwseMiIndexRows:extractTpexDailyQuoteRows)(data,compact(date));
  if(parsed.length<(market==='TWSE'?800:600))throw Error('官方指定日日期或筆數未通過 '+parsed.length);
  const rows=parsed.map(r=>normalizeQuote(r,market,compact(date),new Map())).filter(q=>q&&/^[1-9]\d{3}$/.test(q.code)&&Number.isFinite(q.volume)&&q.volume>=0).map(q=>({code:q.code,date,open:q.open,high:q.high,low:q.low,close:q.close,volume:q.volume}));
  if(new Set(rows.map(q=>q.code)).size!==rows.length)throw Error('官方代號重複');
  return {schema:'OFFICIAL_MARKET_DAY_V1',market,date,source:url,sourceSha256:sha(raw),volumeUnit:'shares',rows};
 }catch(e){last=e;if(attempt<2)await new Promise(r=>setTimeout(r,1500*(attempt+1)));}
 throw Error(market+' '+date+'：'+last.message);
}
export function makeReport(q,days,calendar,date){
 const bars=[],sources=[];
 for(const day of days){const b=day.rows.find(x=>x.code===q.code);if(!b)continue;const {code,...row}=b;bars.push(row);sources.push({date:day.date,source:day.source,sourceSha256:day.sourceSha256});}
 const expected=calendar.dates.filter(d=>bars.length&&d>=bars[0].date&&d<=date),actual=new Set(bars.map(x=>x.date)),missing=expected.filter(d=>!actual.has(d)),zero=bars.filter(x=>x.volume===0).map(x=>x.date),last=bars.at(-1);
 const ohlcMatch=last?.date===date&&['open','high','low','close'].every(k=>Math.abs(last[k]-q[k])<=.011);
 const ready=bars.length>=63&&!missing.length&&!zero.length&&ohlcMatch;
 const reason=!last?'尚無可用的官方交易紀錄':!ohlcMatch?'最新日線與官方市場收盤資料尚未對齊':bars.length<63?`可用官方日線只有${bars.length}天，完整趨勢需要63天`:missing.length?'此股票部分交易日沒有有效成交日線：'+missing.join('、'):zero.length?'研究期間有零成交量：'+zero.join('、'):null;
 let report={stock:q.code,name:q.name,market:q.market,scanMode:'DAILY_ONLY',dailyOnly:true,closeDate:date,marketDate:date,close:last?.close??q.close,completed:true,isComplete:true,securityType:'COMMON',tickRuleVerified:true,volumeUnit:'shares',dailySeries:bars,canonicalBars:bars,dailySeriesMeta:{schema:'daily-ohlcv-v1',source:'Verified official exchange daily archive',mode:'DAILY_ONLY',onlyCompletedBars:true},officialArchiveEvidence:{schema:'OFFICIAL_RESEARCH_ARCHIVE_V1',stock:q.code,market:q.market,date,sourceDays:sources,historyFingerprint:C.fingerprint(bars),missingSessions:missing,zeroVolumeDates:zero},tradingCalendar:{verified:true,source:calendar.source,start:calendar.start,end:date,dates:calendar.dates.filter(d=>d<=date)},expectedTradingDates:expected,priceAdjustment:{verified:true,basis:'UNADJUSTED_OFFICIAL_OHLC',source:'交易所指定日未還原成交價格',corporateActionsVerified:false}};
 if(bars.length)report=C.seal(report,{evidence:C.unitEvidence(['GITHUB_VERIFIED_OFFICIAL_DAILY_ARCHIVE'])});
 return {report,ready,reason,bars:bars.length,missing:missing.length,zero:zero.length};
}
export async function main(){
 const root=process.cwd(),folder=path.join(root,'data/research'),dayFolder=path.join(folder,'days');await fs.mkdir(dayFolder,{recursive:true});
 const snapshot=JSON.parse(await fs.readFile('data/market/latest.json','utf8')),calendar=JSON.parse(await fs.readFile('data/market/research-calendar.json','utf8')),date=snapshot.tradeDateIso;
 if(snapshot.marketCoverageReady!==true||calendar.verified!==true||calendar.sourceSnapshotDate!==date||calendar.dates.at(-1)!==date)throw Error('官方市場快照與實際交易日曆未對齊');
 const dates=calendar.dates.slice(-160),tasks=['TWSE','TPEX'].flatMap(market=>dates.map(date=>({market,date}))),days=new Map(),errors=[];let cursor=0,done=0;
 async function worker(){while(cursor<tasks.length){const task=tasks[cursor++],key=task.market+'-'+task.date,file=path.join(dayFolder,key+'.json.gz');try{let day;try{day=JSON.parse(zlib.gunzipSync(await fs.readFile(file)));if(day.schema!=='OFFICIAL_MARKET_DAY_V1'||day.market!==task.market||day.date!==task.date||day.source!==sourceUrl(task.market,task.date)||!/^[a-f0-9]{64}$/.test(day.sourceSha256))throw Error('cache');}catch{day=await fetchDay(task.market,task.date);await fs.writeFile(file,zlib.gzipSync(JSON.stringify(day)));}days.set(key,day);}catch(e){errors.push(e.message);}done++;if(done%10===0)console.log('OFFICIAL_DAYS '+done+'/'+tasks.length+' errors='+errors.length);}}
 await Promise.all([worker(),worker(),worker()]);
 if(errors.length){console.log('OFFICIAL_DAY_FAILURES='+JSON.stringify(errors));throw Error('官方歷史尚未完整取得，拒絕發布缺日套件');}
 const out=path.join(folder,date);await fs.mkdir(out,{recursive:true});const stocks={},counts={READY:0,PENDING:0};
 for(const q of snapshot.rows){const selected=dates.map(d=>days.get(q.market+'-'+d)),x=makeReport(q,selected,calendar,date),content=JSON.stringify(x.report)+'\n',file=q.code+'.json';await fs.writeFile(path.join(out,file),content);stocks[q.code]={code:q.code,name:q.name,market:q.market,path:date+'/'+file,sha256:sha(content),bars:x.bars,ready:x.ready,reason:x.reason,missing:x.missing,zero:x.zero};counts[x.ready?'READY':'PENDING']++;}
 const manifest={schema:'OFFICIAL_RESEARCH_MANIFEST_V1',verified:true,date,generatedAt:new Date().toISOString(),snapshotContentSha256:snapshot.contentSha256,calendarSource:calendar.source,sourceDays:tasks.length,researchSessions:dates,universe:snapshot.rows.length,counts,stocks};await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest)+'\n');
 await fs.mkdir('evidence',{recursive:true});await fs.writeFile('evidence/official-research-universe-'+date+'.json',JSON.stringify({date,checked:manifest.universe,sourceDays:tasks.length,counts,results:Object.values(stocks)},null,2));
 console.log('OFFICIAL_HISTORY_FINAL='+JSON.stringify({date,checked:manifest.universe,counts,sourceDays:tasks.length,selected:['8039','7704'].map(c=>stocks[c])}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
