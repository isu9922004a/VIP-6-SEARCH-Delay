'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'/tmp/future-limit-audit'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p))),c=read('data/kronos-future/manifest.json'),h=read('data/research/manifest.json'),cache=new Map(),rows=[];
assert.equal(c.asOf,h.date);fs.mkdirSync(out,{recursive:true});
for(const[code,reason]of Object.entries(c.unavailable)){
 const e=h.stocks[code],s=read('data/research/'+e.path);if(s.securityType==='DR')continue;
 const original=s.originalDailySeries||[],gap=s.officialArchiveEvidence?.excludedEarlierSessions?.at(-1)||null;
 let diagnosis=e.ready?(/價格基準斷點/.test(reason)?'PRICE_BASIS_RESET':'MODEL_OUTPUT_CHECK'):'UNVERIFIED_QUOTE_GAP',archiveRow=null;
 if(!e.ready&&gap){const key=s.market+'-'+gap;if(!cache.has(key)){const f=path.join(root,'data/research/days',key+'.json.gz');cache.set(key,fs.existsSync(f)?JSON.parse(zlib.gunzipSync(fs.readFileSync(f))):null);}const day=cache.get(key);if(day){assert.equal(day.market,s.market);assert.equal(day.date,gap);archiveRow=day.rows.find(r=>r.code===code)||null;if(archiveRow)diagnosis=archiveRow.volume===0?'VERIFIED_ZERO_VOLUME_ROW':'ARCHIVE_HAS_QUOTE_RECHECK';else diagnosis='NO_VALID_QUOTE_IN_ARCHIVE';}}
 rows.push({code,name:s.name,date:s.closeDate,diagnosis,reason,currentBars:s.dailySeries.length,originalBars:original.length,has63OriginalBars:original.length>=63,lastGap:gap,archiveRow});
}
const counts={};for(const r of rows)counts[r.diagnosis]=(counts[r.diagnosis]||0)+1;const result={date:c.asOf,checked:rows.length,counts,rows};fs.writeFileSync(path.join(out,'history-audit.json'),JSON.stringify(result,null,2));console.log('FUTURE_LIMIT_HISTORY '+JSON.stringify({date:c.asOf,checked:rows.length,counts,has63OriginalBars:rows.filter(r=>r.has63OriginalBars).length,rechecks:rows.filter(r=>r.diagnosis==='ARCHIVE_HAS_QUOTE_RECHECK')}));
