#!/usr/bin/env node
// Publish actual exchange sessions. Never infer a market closure from a missing stock bar.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const BASE='https://www.twse.com.tw/exchangeReport/FMTQIK',SCHEMA='TW_RESEARCH_SESSIONS_V1';
export function parseDate(value){const s=String(value||'').trim(),m=s.match(/^(\d{2,4})[\/-](\d{1,2})[\/-](\d{1,2})$/);if(!m)return null;let year=+m[1];if(year<1911)year+=1911;const date=`${year}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const dt=new Date(date+'T00:00:00Z');return Number.isFinite(+dt)&&dt.toISOString().slice(0,10)===date?date:null;}
export function parseMonth(payload,month,raw=JSON.stringify(payload)){
 if(String(payload?.stat).toUpperCase()!=='OK'||!Array.isArray(payload.data)||!payload.data.length)throw Error('官方交易月份尚無完整資料 '+month);
 const dates=payload.data.map(x=>parseDate(x[0]));if(dates.some((d,i)=>!d||d.slice(0,7)!==month||i&&d<=dates[i-1]))throw Error('官方交易日期無效 '+month);
 return {month,source:BASE+'?response=json&date='+month.replace('-','')+'01',status:'OK',sha256:crypto.createHash('sha256').update(raw).digest('hex'),dates};
}
export function buildCalendar(snapshot,months){
 const date=snapshot.tradeDateIso;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!snapshot.contentSha256||snapshot.marketCoverageReady!==true)throw Error('市場快照未完成');
 const dates=months.flatMap(x=>x.dates.filter(d=>d<=date));if(dates.at(-1)!==date)throw Error('官方交易月份尚未追上快照 '+date);
 return {schema:SCHEMA,verified:true,source:BASE,sourceSnapshotDate:date,sourceSnapshotHash:snapshot.contentSha256,start:date.slice(0,4)+'-01-01',end:date,dates,months,method:'官方FMTQIK實際成交日期；未出現的日期不補股票K棒',futureSessionStatus:'UNKNOWN'};
}
export async function updateResearchCalendar(root=process.cwd(),fetcher=fetch){
 const folder=path.join(root,'data/market'),snapshot=JSON.parse(await fs.readFile(path.join(folder,'latest.json'),'utf8')),file=path.join(folder,'research-calendar.json');let old=null;try{old=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
 if(old?.schema===SCHEMA&&old.sourceSnapshotDate===snapshot.tradeDateIso&&old.sourceSnapshotHash===snapshot.contentSha256){console.log('Research calendar unchanged '+old.sourceSnapshotDate);return old;}
 const end=snapshot.tradeDateIso.slice(0,7),months=[];
 for(let n=1;n<=Number(end.slice(-2));n++){
  const month=end.slice(0,4)+'-'+String(n).padStart(2,'0'),cached=old?.months?.find(x=>x.month===month);
  if(month<end&&cached?.status==='OK'&&cached.sha256&&cached.dates?.length){months.push(cached);continue;}
  const url=BASE+'?response=json&date='+month.replace('-','')+'01';const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Research calendar HTTP '+response.status);const raw=await response.text();months.push(parseMonth(JSON.parse(raw),month,raw));
 }
 const result=buildCalendar(snapshot,months);await fs.writeFile(file,JSON.stringify(result)+'\n','utf8');console.log('Research calendar verified '+result.sourceSnapshotDate+'; '+result.dates.length+' sessions');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))updateResearchCalendar().catch(e=>{console.error('RESEARCH_CALENDAR_UNAVAILABLE: '+e.message);process.exitCode=1;});
