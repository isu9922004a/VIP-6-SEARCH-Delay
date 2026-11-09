'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),C=require('../kronos-future-core-v1'),F=require('../research-v83/forecast-engine');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function inputs(root,sourceDir=null){
 const market=read(path.join(root,'data/market/latest.json')),manifest=read(path.join(root,'data/research/manifest.json')),
  index=read(sourceDir?path.join(sourceDir,'index/TAIEX.json'):path.join(root,'data/index/TAIEX.json')),
  calendar=read(sourceDir?path.join(sourceDir,'kronos/calendar.json'):path.join(root,'data/kronos/calendar.json')),lock=read(path.join(root,'kronos/model-lock.json')),date=market.tradeDateIso;
 if(!market.marketCoverageReady||!manifest.verified||manifest.date!==date||manifest.snapshotContentSha256!==market.contentSha256||index.closeDate!==date||index.completed!==true||!calendar.verified)throw Error('20日模型的行情、歷史、大盤或日曆尚未同日核對完成');
 const targetDates=calendar.dates.filter(d=>d>date).slice(0,20);if(targetDates.length!==20)throw Error('未來20個正式交易日尚未完整取得');
 const jobs=new Map([['TAIEX',{market:'TWSE_INDEX',source:index}]]),unavailable={};
 for(const[code,e]of Object.entries(manifest.stocks)){
  if(!e.ready){unavailable[code]=e.reason||'完整歷史尚未齊全';continue;}
  const file=path.join(root,'data/research',e.path),text=fs.readFileSync(file,'utf8'),s=JSON.parse(text);if(sha(text)!==e.sha256||s.stock!==code||s.market!==e.market||s.closeDate!==date)throw Error('研究來源身分或指紋不符 '+code);
  jobs.set(code,{market:e.market,file,signature:F.signature(F.inputWindow(s.dailySeries).bars)});
 }
 jobs.get('TAIEX').signature=F.signature(F.inputWindow(index.dailySeries).bars);
 const runtime=sha(fs.readFileSync(path.join(root,'kronos/future.py'))+fs.readFileSync(path.join(root,'kronos/future_cache.py'))),identity=sha(JSON.stringify({date,targetDates,stocks:manifest.stocks,index:jobs.get('TAIEX').signature,runtime,lock,samples:150}));
 return {date,targetDates,jobs,unavailable,identity,runtime,lock};
}
function verify(packed,raw,source,input,code){
 const v=C.evaluate(source,packed);if(v.state!=='READY')throw Error(code+'：'+v.reason);
 if(packed.sampleCount!==150||packed.historySignature!==input.jobs.get(code).signature||packed.execution.runtimeSHA256!==input.runtime||JSON.stringify(packed.targetDates)!==JSON.stringify(input.targetDates))throw Error('本期模型參數、來源或執行程式不符 '+code);
 if(raw.kind!=='KRONOS_FUTURE_INFERENCE'||raw.asOf!==input.date||raw.symbol!==code||raw.sampleCount!==150||!Array.isArray(raw.samples)||raw.samples.length!==150||raw.samples.some(p=>p.length!==20)||F.rawSignature(raw.samples)!==raw.execution.rawSamplesSignature||raw.execution.rawSamplesSignature!==packed.execution.rawSamplesSignature||raw.execution.rawSamplesSHA256!==packed.execution.rawSamplesSHA256)throw Error('原始模型取樣收據不符 '+code);
 if(JSON.stringify(raw.samples.map(p=>p.map(b=>b.close)))!==JSON.stringify(packed.closePaths))throw Error('收盤路徑不是原始模型輸出 '+code);
 const valid=raw.samples.map((p,i)=>p.every(F.validBar)?i:null).filter(i=>i!==null),invalid=raw.samples.reduce((n,p)=>n+p.filter(b=>!F.validBar(b)).length,0);
 if(valid.length!==packed.outputQuality.validOhlcPathCount||invalid!==packed.outputQuality.invalidOhlcCount)throw Error('模型K棒品質紀錄不符 '+code);
 if(packed.candlePath&&(!valid.includes(packed.candlePath.sampleIndex)||JSON.stringify(raw.samples[packed.candlePath.sampleIndex])!==JSON.stringify(packed.candlePath.bars)))throw Error('展示K棒不是一條完整原始路徑 '+code);
 return v;
}
function validate(input,dir,shards=16){
 const results=new Map();for(let i=0;i<shards;i++){const status=read(path.join(dir,'status-'+i+'.json'));if(status.schema!=='kronos-future-status-v1'||status.codeCommit!==input.lock.codeCommit||!Array.isArray(status.results))throw Error('20日模型分片缺少執行紀錄 '+i);for(const r of status.results){if(!input.jobs.has(r.code)||results.has(r.code)||!['SUCCESS','UNAVAILABLE'].includes(r.state))throw Error('20日模型分片身分重複或不符');results.set(r.code,r);}}
 if(results.size!==input.jobs.size)throw Error('20日模型分片尚未完整返回');
 const instruments={},unavailable={...input.unavailable};
 for(const[code,job]of input.jobs){const r=results.get(code);if(r.state==='UNAVAILABLE'){if(!r.reason)throw Error('缺少失敗原因 '+code);unavailable[code]=r.reason;continue;}
  const relative=code==='TAIEX'?'TAIEX.json':'stocks/'+code+'.json',file=path.join(dir,relative),text=fs.readFileSync(file),f=JSON.parse(text),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'raw',code+'.json.gz')))),source=job.source||read(job.file);
  verify(f,raw,source,input,code);instruments[code]={asOf:input.date,targetDates:input.targetDates,path:relative,sha256:sha(text),sampleCount:f.sampleCount,validCandlePaths:f.outputQuality.validOhlcPathCount};
 }
 if(!Object.keys(instruments).length)throw Error('沒有通過核對的20日模型結果');
 return {schema:'shitou-kronos-future-catalog-v1',asOf:input.date,targetDates:input.targetDates,identity:input.identity,generatedAt:new Date().toISOString(),instruments,unavailable,sourceCount:input.jobs.size+Object.keys(input.unavailable).length};
}
function plan(input,dir){try{const c=read(path.join(dir,'manifest.json'));return c.identity!==input.identity||[...input.jobs.keys()].some(code=>!c.instruments[code]&&!c.unavailable[code]);}catch{return true;}}
function main(root=path.resolve(__dirname,'..'),args=process.argv.slice(2)){
 const input=inputs(root,args[3]||null),dir=path.join(root,'data/kronos-future');
 if(args[0]==='plan'){const needed=plan(input,dir);console.log(JSON.stringify({needed,date:input.date,stocks:input.jobs.size,samples:150,days:20}));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`needed=${needed}\nidentity=${input.identity}\n`);return;}
 if(args[0]!=='publish'||args[2]!==input.identity)throw Error('20日模型來源已變更，等待下一輪重算');
 const catalog=validate(input,args[1]);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(path.join(dir,'stocks'),{recursive:true});
 for(const entry of Object.values(catalog.instruments))fs.copyFileSync(path.join(args[1],entry.path),path.join(dir,entry.path));
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(catalog)+'\n');console.log('FUTURE_PUBLISHED '+JSON.stringify({date:catalog.asOf,ready:Object.keys(catalog.instruments).length,unavailable:Object.keys(catalog.unavailable).length}));
}
if(require.main===module)try{main();}catch(e){console.error(e);process.exitCode=1;}
module.exports={inputs,verify,validate,plan,main};
