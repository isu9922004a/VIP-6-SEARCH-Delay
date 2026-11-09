'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),A=require('../kronos-future-automation.cjs'),F=require('../../research-v83/forecast-engine'),forecast=require('../fixtures/kronos-future-TAIEX-20261106.json'),source=require('../fixtures/taiex-wave-20261106.json');
test('publication requires every shard and exactly one result for each expected instrument',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'future-shards-')),input={jobs:new Map([['TAIEX',{}],['4743',{}]]),unavailable:{'5904':'有效日K不足'},lock:{codeCommit:'test'},date:'2026-11-06',identity:'test'};
 const write=(i,results)=>fs.writeFileSync(path.join(dir,'status-'+i+'.json'),JSON.stringify({schema:'kronos-future-status-v1',codeCommit:'test',results}));
 try{write(0,[{code:'TAIEX',state:'UNAVAILABLE',reason:'not ready'}]);assert.throws(()=>A.validate(input,dir,2),/ENOENT/);write(1,[]);assert.throws(()=>A.validate(input,dir,2),/尚未完整返回/);write(1,[{code:'TAIEX',state:'UNAVAILABLE',reason:'duplicate'}]);assert.throws(()=>A.validate(input,dir,2),/重複/);write(1,[{code:'4743',state:'UNAVAILABLE',reason:''}]);assert.throws(()=>A.validate(input,dir,2),/缺少失敗原因/);write(1,[{code:'4743',state:'UNAVAILABLE',reason:'資料不足'}]);assert.throws(()=>A.validate(input,dir,2),/沒有通過核對/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a valid public forecast cannot be published with different original samples or runtime',()=>{
 const input={jobs:new Map([['TAIEX',{signature:forecast.historySignature}]]),runtime:forecast.execution.runtimeSHA256,targetDates:forecast.targetDates,date:forecast.asOf};
 const raw={...forecast,samples:Array.from({length:150},()=>forecast.candlePath.bars)};
 assert.throws(()=>A.verify(forecast,raw,source,input,'TAIEX'),/原始模型取樣/);
 assert.throws(()=>A.verify(forecast,raw,source,{...input,runtime:'wrong'},'TAIEX'),/本期模型參數/);
 raw.execution={...forecast.execution,rawSamplesSignature:F.rawSignature(raw.samples)};
 assert.throws(()=>A.verify(forecast,raw,source,input,'TAIEX'),/原始模型取樣/);
});
test('cached publication requires a matching complete catalog and files with the expected digest',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'future-plan-')),input={identity:'same',date:'2026-11-06',jobs:new Map([['TAIEX',{}],['4743',{}]])},file=JSON.stringify(forecast),catalog={schema:'shitou-kronos-future-catalog-v1',identity:'same',asOf:input.date,instruments:{TAIEX:{path:'TAIEX.json',sha256:crypto.createHash('sha256').update(file).digest('hex')}},unavailable:{4743:'歷史不足'}};
 const save=()=>fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(catalog));
 try{assert.equal(A.plan(input,dir),true);save();assert.equal(A.plan(input,dir),true);fs.writeFileSync(path.join(dir,'TAIEX.json'),file);assert.equal(A.plan(input,dir),false);fs.appendFileSync(path.join(dir,'TAIEX.json'),' ');assert.equal(A.plan(input,dir),true);fs.writeFileSync(path.join(dir,'TAIEX.json'),file);delete catalog.unavailable['4743'];save();assert.equal(A.plan(input,dir),true);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('all multiline future workflow shell blocks pass bash syntax validation',()=>{
 const cp=require('node:child_process');for(const name of ['kronos-future.yml','kronos-future-review.yml']){
 const rows=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows',name),'utf8').split('\n');
 for(let i=0;i<rows.length;i++){const m=rows[i].match(/^(\s*)run:\s*\|\s*$/);if(!m)continue;const indent=m[1].length,block=[];for(i++;i<rows.length;i++){if(rows[i].trim()&&rows[i].match(/^\s*/)[0].length<=indent){i--;break;}block.push(rows[i].slice(indent+2));}cp.execFileSync('bash',['-n'],{input:block.join('\n')+'\n'});}
 }
});
