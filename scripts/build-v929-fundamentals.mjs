// Build one session-bound evidence package from actual raw official captures, preserving receipt timestamps.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import F from '../strategy-low-base-fundamentals-v929.js';
const [fresh,out,archiveRoot='data/low-base-breakout/fundamental-raw']=process.argv.slice(2);
if(!fresh||!out)throw Error('capture directory and output required');
const market=JSON.parse(await fs.readFile('data/market/latest.json','utf8')),asOf=market.tradeDateIso;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),receipts=[],records=[],seen=new Set();
async function add(m,bytes,receipt){
 assert.equal(hash(bytes),receipt.sha256,'official raw checksum mismatch');
 const parsed=F.parse(JSON.parse(bytes),m,receipt);
 if(parsed.observedDate>asOf)return;
 const id=[m,receipt.sha256,receipt.retrievedAt].join('|');if(seen.has(id))return;seen.add(id);
 receipts.push({...receipt,market:m,observedDate:parsed.observedDate});records.push(...parsed.records);
}
let days=[];try{days=await fs.readdir(archiveRoot);}catch(e){if(e.code!=='ENOENT')throw e;}
for(const day of days.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&x<=asOf).sort()){
 for(const m of Object.keys(F.SOURCES)){
  const dir=path.join(archiveRoot,day);let bytes,receipt;
  try{bytes=zlib.gunzipSync(await fs.readFile(path.join(dir,m+'.json.gz')));receipt=JSON.parse(await fs.readFile(path.join(dir,m+'.receipt.json'),'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  assert.equal(F.taipei(receipt.retrievedAt),day);await add(m,bytes,receipt);
 }
}
const staged=path.join(path.dirname(out),'raw-stage');
for(const m of Object.keys(F.SOURCES)){
 let bytes,receipt;try{bytes=await fs.readFile(path.join(fresh,m+'.raw.json'));receipt=JSON.parse(await fs.readFile(path.join(fresh,m+'.receipt.json'),'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
 const day=F.taipei(receipt.retrievedAt);
 if(day>asOf)continue;
 await add(m,bytes,receipt);
 const dir=path.join(staged,day);await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(dir,m+'.json.gz'),zlib.gzipSync(bytes));
 await fs.writeFile(path.join(dir,m+'.receipt.json'),JSON.stringify(receipt)+'\n');
}
// Preserve earliest observed data for each month/code and material later changes; avoid daily duplicate expansion.
const grouped=new Map();
for(const x of records.sort((a,b)=>Date.parse(a.retrievedAt)-Date.parse(b.retrievedAt))){
 const k=[x.market,x.code,x.period].join('|'),last=grouped.get(k)?.at(-1);
 if(last&&last.current===x.current&&last.priorYear===x.priorYear)continue;
 if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(x);
}
const compact=[...grouped.values()].flat(),used=new Set(compact.map(x=>[x.market,x.sourceSha256,x.retrievedAt].join('|')));
const bundle={schema:F.SCHEMA,date:asOf,snapshotHash:market.contentSha256,receipts:receipts.filter(x=>used.has([x.market,x.sha256,x.retrievedAt].join('|'))),records:compact};
const idx=F.indexBundle(bundle,{asOf,snapshotHash:market.contentSha256});
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(bundle)+'\n');
console.log('V929_FUNDAMENTAL_BUNDLE '+JSON.stringify({asOf,companies:idx.companies,records:idx.records,receipts:idx.receipts,sha256:hash(await fs.readFile(out))}));
