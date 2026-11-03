'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const F=require('../research-v83/forecast-engine.js');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function signature(bars){let h=2166136261;const text=bars.map(b=>[b.date,...['open','high','low','close','volume','amount'].map(k=>Number(b[k]??0).toFixed(6))].join(',')).join('\n');for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16).padStart(8,'0');}
function inputs(root){
 const get=p=>read(path.join(root,p)),market=get('data/market/latest.json'),research=get('data/research/manifest.json'),index=get('data/index/TAIEX.json'),calendar=get('data/kronos/calendar.json'),lock=get('kronos/model-lock.json');
 const asOf=market.tradeDateIso;
 if(market.marketCoverageReady!==true||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||research.verified!==true||research.date!==asOf||research.snapshotContentSha256!==market.contentSha256||index.completed!==true||index.closeDate!==asOf||calendar.verified!==true)throw Error('行情、官方研究日K與大盤尚未更新到同一完成交易日；等待下輪更新，不發布混合日期。');
 const targetDate=calendar.dates?.find(d=>d>asOf);
 if(!targetDate)throw Error('下一個交易日尚未核對');
 const stocks=Object.entries(research.stocks).filter(([,e])=>e.ready===true);
 if(!stocks.length)throw Error('沒有已核對的個股歷史');
 const jobs=new Map([['TAIEX',{market:'TWSE_INDEX',bars:index.dailySeries}]]);
 for(const [code,e] of stocks){
  if(e.path!==`${asOf}/${code}.json`)throw Error('研究日K路徑與日期不符 '+code);
  const file=path.join(root,'data/research',e.path),text=fs.readFileSync(file,'utf8'),source=JSON.parse(text);
  if(crypto.createHash('sha256').update(text).digest('hex')!==e.sha256||source.stock!==code||source.market!==e.market||source.closeDate!==asOf||source.completed!==true)throw Error('研究日K指紋或股票日期不符 '+code);
  jobs.set(code,{market:e.market,bars:source.dailySeries});
 }
 for(const [code,j] of jobs){j.signature=signature(j.bars.slice(-160));if(j.bars.at(-1)?.date!==asOf)throw Error('歷史截止日不符 '+code);}
 const identity=hash({asOf,targetDate,manifest:{date:research.date,snapshot:research.snapshotContentSha256,stocks:research.stocks,sessions:research.researchSessions},lock,index:jobs.get('TAIEX').signature,calendar:calendar.dates,runtime:fs.readFileSync(path.join(root,'kronos/run.py'),'utf8')});
 return {asOf,targetDate,identity,jobs,lock};
}
function verifyForecast(f,code,j,input){
 if(!F.executionVerified(f))throw Error('缺少有效模型執行收據 '+code);
 if(f.kind!=='KRONOS_INFERENCE'||f.symbol!==code||f.market!==j.market||f.asOf!==input.asOf||f.targetDates?.length!==1||f.targetDates[0]!==input.targetDate||f.historySignature!==j.signature||f.sampleCount!==32||f.samples?.length!==32||f.codeCommit!==input.lock.codeCommit||['model','tokenizer'].some(k=>f[k]?.id!==input.lock[k].id||f[k]?.revision!==input.lock[k].revision)||f.samples.some(p=>p.length!==1||!['open','high','low','close'].every(k=>Number.isFinite(p[0][k])&&p[0][k]>0)))throw Error('模型輸出與本期來源、版本或取樣不符 '+code);
}
function validateBatch(input,dir,shards=16){
 const rows=new Map();
 for(let shard=0;shard<shards;shard++){
  const status=read(path.join(dir,`status-${shard}.json`));
  if(status.modelRun!==true||!Array.isArray(status.results)||status.codeCommit!==input.lock.codeCommit)throw Error('模型分片紀錄無效 '+shard);
  for(const row of status.results){if(!input.jobs.has(row.code)||rows.has(row.code)||!['SUCCESS','UNAVAILABLE'].includes(row.state))throw Error('模型分片股票缺失、重複或非本期標的 '+row.code);rows.set(row.code,row);}
 }
 if(rows.size!==input.jobs.size)throw Error('模型分片尚未完整返回');
 const unavailable={};let successCount=0;
 for(const [code,j] of input.jobs){const row=rows.get(code);if(!row)throw Error('模型分片缺少 '+code);
  if(row.state==='UNAVAILABLE'){if(!row.reason)throw Error('缺少不可用原因 '+code);unavailable[code]=row.reason;continue;}
  if(row.asOf!==input.asOf)throw Error('分片來源日期不符 '+code);
  verifyForecast(read(path.join(dir,code==='TAIEX'?'TAIEX.json':`stocks/${code}.json`)),code,j,input);successCount++;
 }
 if(!successCount)throw Error('本期無任何成功的模型結果');
 return {schema:'KRONOS_AUTOMATION_V1',identity:input.identity,asOf:input.asOf,targetDate:input.targetDate,generatedAt:new Date().toISOString(),successCount,unavailable};
}
function needsRun(input,dir){
 try{const receipt=read(path.join(dir,'automation.json'));if(receipt.identity!==input.identity)return true;
  const checked=validateBatch(input,dir);return hash(checked.unavailable)!==hash(receipt.unavailable)||checked.successCount!==receipt.successCount;
 }catch{return true;}
}
function main(root=path.resolve(__dirname,'..'),argv=process.argv.slice(2)){
 const input=inputs(root),dir=path.join(root,'data/kronos');
 if(argv[0]==='plan'){
  const needed=needsRun(input,dir);const message=`行情基準 ${input.asOf}；推演 ${input.targetDate}；${needed?'需要更新模型':'同一期模型已完成，略過重複計算'}`;
  console.log(message);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,message+'\n');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`needed=${needed}\nas_of=${input.asOf}\nidentity=${input.identity}\n`);
 }else if(argv[0]==='publish'){
  if(argv[2]!==input.identity)throw Error('推論期間行情／歷史／模型版本已變更；下輪重算，不發布舊結果');
  const source=argv[1],receipt=validateBatch(input,source);
  function archive(f){if(f?.kind!=='KRONOS_INFERENCE'||f.symbol!=='TAIEX'||!/^\d{4}-\d{2}-\d{2}$/.test(f.asOf))return;const folder=path.join(dir,'archive',f.asOf);fs.mkdirSync(folder,{recursive:true});const content=JSON.stringify(f),file=path.join(folder,'TAIEX-'+hash(f)+'.json');if(!fs.existsSync(file))fs.writeFileSync(file,content+'\n');const first=path.join(folder,'TAIEX.json');if(!fs.existsSync(first))fs.writeFileSync(first,content+'\n');}
  if(fs.existsSync(path.join(dir,'TAIEX.json')))archive(read(path.join(dir,'TAIEX.json')));
  if(fs.existsSync(path.join(source,'TAIEX.json')))archive(read(path.join(source,'TAIEX.json')));
  fs.rmSync(path.join(dir,'stocks'),{recursive:true,force:true});fs.rmSync(path.join(dir,'TAIEX.json'),{force:true});
  for(const file of fs.readdirSync(dir))if(/^status.*\.json$/.test(file))fs.rmSync(path.join(dir,file));
  fs.cpSync(source,dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'automation.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(`模型完成 ${receipt.successCount}；資料不可用 ${Object.keys(receipt.unavailable).length}（保留原因，不沿用舊結果）`);
 }else throw Error('Usage: kronos-automation.cjs plan | publish <results-directory> <expected-identity>');
}
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={hash,signature,inputs,verifyForecast,validateBatch,needsRun,main};
