'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('../four-models-research-v1');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'data/research/manifest.json'))),out=path.resolve(process.argv[2]||'/tmp/wave-formal-isolation.json');
const keys=['state','models','features','families','priceLevels','originalB','originalInvalidation','researchBreakoutPrice','researchInvalidation','entryDirection','openingPlan','kronosInput','risks'],failures=[],skipped=[];let checked=0,usable=0;
for(const [code,item] of Object.entries(manifest.stocks)){
 const raw=JSON.parse(fs.readFileSync(path.join(root,'data/research',item.path)));if(raw.securityType==='DR'){skipped.push(code);continue;}
 const before=JSON.stringify(raw),a=C.evaluate(raw,{flags:{waveEnabled:true}}),b=C.evaluate(raw,{flags:{waveEnabled:false}});if(a.state!=='INSUFFICIENT_DATA')usable++;
 try{for(const key of keys)assert.deepEqual(a[key],b[key],key);assert.equal(JSON.stringify(raw),before);}catch(e){failures.push({code,reason:e.message});}
 checked++;if(checked%100===0)console.log('WAVE_FORMAL_PROGRESS '+checked+' failures='+failures.length);
}
const report={status:failures.length?'FAIL':'PASS',date:manifest.date,checked,usable,skipped,keys,failures};fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log('WAVE_FORMAL_ISOLATION '+JSON.stringify(report));if(failures.length)process.exitCode=1;
