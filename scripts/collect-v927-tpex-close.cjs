'use strict';
// Retrospective official closing-index evidence, not OHLC and not point-in-time publication proof.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function isoDate(value){
 const m=String(value??'').trim().match(/^(\d{3,4})[/-](\d{1,2})[/-](\d{1,2})$/);
 if(!m)throw Error('Invalid official date: '+value);
 const y=Number(m[1])+(m[1].length===3?1911:0),date=[y,m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-');
 const t=new Date(date+'T00:00:00Z');if(!Number.isFinite(+t)||t.toISOString().slice(0,10)!==date)throw Error('Invalid calendar date: '+value);
 return date;
}
function parseMonth(payload,month){
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month))throw Error('Invalid requested month');
 if(String(payload?.stat??'').trim().toUpperCase()!=='OK')throw Error('Official response did not confirm OK');
 const tables=Array.isArray(payload.tables)?payload.tables:[payload];
 const norm=v=>String(v??'').normalize('NFKC').replace(/\s/g,'');
 const matches=tables.filter(t=>Array.isArray(t.fields)&&Array.isArray(t.data)&&t.fields.some(f=>norm(f)==='櫃買指數')&&t.fields.some(f=>['日期','交易日期'].includes(norm(f))));
 if(matches.length!==1)throw Error('Exactly one official date / TPEX closing index table required');
 const t=matches[0],cols=t.fields.map(norm),di=cols.findIndex(f=>['日期','交易日期'].includes(f)),ci=cols.indexOf('櫃買指數');
 if(cols.filter(f=>f==='櫃買指數').length!==1||cols.filter(f=>['日期','交易日期'].includes(f)).length!==1||!t.data.length)throw Error('Ambiguous or empty official index table');
 const rows=t.data.map(row=>{
  if(!Array.isArray(row))throw Error('Unexpected official row');
  const date=isoDate(row[di]),v=String(row[ci]??'').normalize('NFKC').trim().replaceAll(',','');
  if(date.slice(0,7)!==month||!/^\d+(?:\.\d+)?$/.test(v)||!Number.isFinite(Number(v))||Number(v)<=0)throw Error('Official month or closing index mismatch: '+date);
  return {date,close:Number(v)};
 });
 if(rows.some((r,i)=>i&&r.date<=rows[i-1].date))throw Error('Official index dates duplicated or out of sequence');
 return rows;
}
const url=month=>'https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingIndex?date='+encodeURIComponent(month.replace('-','/')+'/01')+'&response=json';
async function fetchMonth(month,{fetcher=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let error;
 for(let i=0;i<2;i++){
  try{
   const res=await fetcher(url(month),{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)});
   if(!res.ok)throw Error('HTTP '+res.status);
   const raw=Buffer.from(await res.arrayBuffer()),retrievedAt=new Date().toISOString(),rows=parseMonth(JSON.parse(raw.toString('utf8')),month);
   return {raw,receipt:{month,url:url(month),retrievedAt,sha256:sha(raw),rows:rows.length},rows};
  }catch(e){error=e;if(i===0)await delay(2000);}
 }
 throw error;
}
function months(start,end){
 const out=[];let m=start;
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(start)||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(end)||start>end)throw Error('Invalid range');
 while(m<=end){out.push(m);if(out.length>60)throw Error('At most 60 months per audit');const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);m=d.toISOString().slice(0,7);}
 return out;
}
async function main(){
 const [out,start,end,cutoff]=process.argv.slice(2);if(!out||!cutoff||isoDate(cutoff)!==cutoff||end!==cutoff.slice(0,7))throw Error('Output, range and explicit completed-session cutoff required');
 fs.mkdirSync(out,{recursive:true});
 const receipts=[],rows=[],failures=[];
 for(const month of months(start,end)){
  try{const item=await fetchMonth(month);fs.writeFileSync(path.join(out,month+'.json'),item.raw);receipts.push(item.receipt);rows.push(...item.rows.filter(r=>r.date<=cutoff));console.log(month+' '+item.rows.length+' '+item.receipt.sha256);}
  catch(e){failures.push({month,error:e.message,url:url(month)});console.error(month+' '+e.message);}
  await new Promise(r=>setTimeout(r,1200));
 }
 const calendar=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/index/TAIEX.json'))).tradingCalendar;
 const overlap=calendar?.verified===true&&Array.isArray(calendar.dates)?calendar.dates.filter(d=>d>=rows[0]?.date&&d<=cutoff&&d<=calendar.end):[];
 const present=new Set(rows.map(r=>r.date)),missingSharedCalendar=overlap.filter(d=>!present.has(d));
 const report={schema:'V927_TPEX_CLOSE_EVIDENCE_V1',instrument:'TPEX_INDEX',sourceScope:'OFFICIAL_CLOSING_INDEX_ONLY',start,end,cutoff,rows,receipts,failures,missingSharedCalendar,sharedCalendarOverlap:overlap.length,pointInTimeVerified:false,ohlcAvailable:false,productionReady:false,status:failures.length||missingSharedCalendar.length||rows.at(-1)?.date!==cutoff?'INCOMPLETE':'RETRIEVED_REQUIRES_INDEPENDENT_VALIDATION'};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,rows:rows.length,months:receipts.length,failures,missingSharedCalendar,latest:rows.at(-1)}));
 if(report.status==='INCOMPLETE')process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={isoDate,parseMonth,months,fetchMonth};
