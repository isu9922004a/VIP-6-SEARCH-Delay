'use strict';
// Publish only actually executed repair outputs; all existing samples are rechecked.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),A=require('./kronos-automation.cjs'),F=require('../research-v83/forecast-engine.js');
const root=path.resolve(__dirname,'..'),input=A.inputs(root),dir=path.join(root,'data/kronos'),codes=process.argv.slice(2),statuses=[];
if(!codes.length)throw Error('Provide the codes whose real inference files were regenerated.');
for(let i=0;i<16;i++){const file=path.join(dir,`status-${i}.json`);statuses.push({file,data:JSON.parse(fs.readFileSync(file,'utf8')),changed:false});}
function rowFor(code){const found=statuses.flatMap(s=>s.data.results.filter(r=>r.code===code).map(row=>({s,row})));assert.equal(found.length,1,'unique shard row required: '+code);return found[0];}
for(const code of codes){const j=input.jobs.get(code);assert.ok(j,'unknown inference job');const file=path.join(dir,'stocks',code+'.json'),f=JSON.parse(fs.readFileSync(file,'utf8'));A.verifyForecast(f,code,j,input);const {s,row}=rowFor(code);Object.assign(row,{state:'SUCCESS',asOf:f.asOf,seconds:f.runtimeSeconds});delete row.reason;s.changed=true;}
for(const [code,j] of input.jobs){const w=F.inputWindow(j.bars);if(w.cutoff&&w.bars.length<63){const {s,row}=rowFor(code);assert.equal(row.state,'UNAVAILABLE','do not silently discard an existing inference');row.reason=`${w.cutoff} 價格基準斷點後只有${w.bars.length}根日線，尚需${63-w.bars.length}根；不混用斷點前價格`;s.changed=true;}}
for(const s of statuses)if(s.changed){s.data.successCount=s.data.results.filter(r=>r.state==='SUCCESS').length;s.data.failedCount=s.data.results.length-s.data.successCount;fs.writeFileSync(s.file,JSON.stringify(s.data)+'\n');}
const receipt=A.validateBatch(input,dir);fs.writeFileSync(path.join(dir,'automation.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({repaired:codes,successCount:receipt.successCount,unavailable:receipt.unavailable}));
