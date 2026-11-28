import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import Q from '../strategy-low-base-financial-v929.cjs';
const dir=process.argv[2]||'/tmp/v929-financial';await fs.mkdir(dir,{recursive:true});
const results=[];
for(const [market,sources] of Object.entries(Q.sources))for(const [kind,source] of Object.entries(sources)){
 try{
 const res=await fetch(source,{redirect:'manual',headers:{accept:'application/json'},signal:AbortSignal.timeout(25000)});
 if(res.status!==200||res.url!==source)throw Error('HTTP '+res.status+' or redirect');
 const bytes=Buffer.from(await res.arrayBuffer()),receipt={source,status:200,retrievedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 const rows=JSON.parse(bytes),prefix=path.join(dir,market+'-'+kind);
 await fs.writeFile(prefix+'.raw.json',bytes);await fs.writeFile(prefix+'.receipt.json',JSON.stringify(receipt)+'\n');
 const keys=Array.isArray(rows)&&rows.length?Object.keys(rows[0]):[];
 try{const p=Q.parse(rows,market,kind,receipt);await fs.writeFile(prefix+'.normalized.json',JSON.stringify(p.records));results.push({market,kind,ready:true,rows:p.records.length,periods:[...new Set(p.records.map(x=>x.periodEnd))].sort(),errors:p.errors.length,keys,receipt});}
 catch(e){results.push({market,kind,ready:false,rawRows:rows?.length,keys,reason:e.message,receipt});}
 }catch(e){results.push({market,kind,ready:false,reason:String(e.message||e)});}
}
await fs.writeFile(path.join(dir,'summary.json'),JSON.stringify(results,null,2));
console.log('V929_FINANCIAL_PROBE '+JSON.stringify(results));
if(!results.some(x=>x.ready))process.exitCode=1;
