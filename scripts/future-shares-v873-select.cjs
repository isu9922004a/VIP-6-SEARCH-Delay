'use strict';
const fs=require('node:fs'),path=require('node:path'),{sha}=require('./future-shares-v873-audit.cjs');
function select(frozen){const batch=JSON.parse(fs.readFileSync(path.join(frozen,'batch.json'),'utf8')),all=batch.records.map(r=>JSON.parse(fs.readFileSync(path.join(frozen,r.path),'utf8'))).filter(r=>r.type==='stock'&&r.raw),sort=(fn,ascending=false)=>[...all].sort((a,b)=>(ascending?1:-1)*(fn(a)-fn(b))||a.code.localeCompare(b.code)),digits=r=>(r.display.header.match(/收盤\s+([\d,.]+)/)?.[1]||'').length,relativeWidth=r=>(r.raw.p90-r.raw.p10)/r.close,distance=r=>Math.abs(r.raw.median-r.close)/r.close,seed='v873-g4-'+batch.batchId;
 return {seed,G1:{longestNames:sort(r=>[...r.name].length).slice(0,3).map(r=>r.code),mostPriceDigits:sort(digits).slice(0,3).map(r=>r.code)},G2:{widest:sort(relativeWidth)[0].code,narrowest:sort(relativeWidth,true)[0].code,largestMedianDistance:sort(distance)[0].code},G4:{stocks:[...all].sort((a,b)=>sha(seed+'|'+a.code).localeCompare(sha(seed+'|'+b.code))||a.code.localeCompare(b.code)).slice(0,5).map(r=>r.code),index:'TAIEX'}};
}
module.exports={select};
