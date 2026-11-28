// Capture actual official bytes and retrieval receipts. Candidate collection never publishes to main.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import F from '../strategy-low-base-fundamentals-v929.js';
const out=process.argv[2]||'/tmp/v929-fundamentals';await fs.mkdir(out,{recursive:true});
const summaries=[],records=[];
for(const [market,source] of Object.entries(F.SOURCES)){
 try{
 const res=await fetch(source,{redirect:'manual',headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(30000)});
 if(res.status!==200||res.url!==source)throw Error('official HTTP '+res.status+' or redirect');
 const bytes=Buffer.from(await res.arrayBuffer()),receipt={source,status:res.status,retrievedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 await fs.writeFile(path.join(out,market+'.raw.json'),bytes);await fs.writeFile(path.join(out,market+'.receipt.json'),JSON.stringify(receipt,null,2));
 const parsed=F.parse(JSON.parse(bytes),market,receipt);
 records.push(...parsed.records);
 summaries.push({market,ready:true,observedDate:parsed.observedDate,records:parsed.records.length,periods:[...new Set(parsed.records.map(x=>x.period))].sort(),errors:parsed.errors.length,receipt});
 }catch(e){summaries.push({market,ready:false,error:String(e.message||e),source});}
}
const date=F.taipei(new Date().toISOString()),known=records.reduce((n,r)=>n+Number(!!F.evidence([r],{code:r.code,market:r.market,asOf:date}).revenueYoYPositive),0);
const result={schema:'V929_MONTHLY_REVENUE_CAPTURE_V1',observedDate:date,coverage:summaries,verifiedCurrentYoY:known,records,availabilityBasis:'Actual retrieval timestamp; no historical backfill or use before observation',scoreIntegration:false};
await fs.writeFile(path.join(out,'monthly-revenue.json'),JSON.stringify(result,null,2));
console.log('V929_FUNDAMENTAL_CAPTURE '+JSON.stringify({date,known,coverage:summaries}));
if(!summaries.some(s=>s.ready))process.exitCode=1;
