'use strict';
const fs=require('node:fs'),path=require('node:path');
const SCHEMA='shitou-kronos-future-update-v1';
const FAILURE_REASONS={SOURCES:'行情、歷史、大盤或日曆未完成同日核對，或來源取得失敗。',INFERENCE:'模型分片未全部成功返回，尚不能發布完整批次。',VERIFICATION:'模型結果或來源指紋未通過發布核對。',DEPLOYMENT:'模型更新流程的網站發布失敗，尚未確認同步完成。'};
function build({state,date,identity=null,stage,runId,runAttempt=1,repository,now=new Date().toISOString(),catalog=null}){
 if(!['RUNNING','READY','FAILED'].includes(state)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d+$/.test(String(runId))||!/^[-\w]+\/[-\w]+$/.test(repository))throw Error('Invalid future update status');
 if(state==='READY'&&(!catalog||catalog.asOf!==date||catalog.identity!==identity))throw Error('Cannot mark mismatched models ready');
 return {schema:SCHEMA,state,marketDate:date,modelDate:catalog?.asOf||null,identity,stage,runId:String(runId),runAttempt:Number(runAttempt),updatedAt:now,runUrl:`https://github.com/${repository}/actions/runs/${runId}`,reason:state==='FAILED'?(FAILURE_REASONS[stage]||'本次更新未完成，請查看執行紀錄。'):null};
}
// An independently completed live-browser verification may finish after a
// newer run has already recorded VERIFIED_CACHE for the *same* model identity.
// Preserve the newer update receipt's runId while attaching the actual
// verification run. Never promote another date, model identity or failed state.
function promoteVerifiedLive(old,next){
 if(old?.schema!==SCHEMA||old.marketDate!==next.marketDate||old.identity!==next.identity||old.modelDate!==next.modelDate||old.state!=='READY'||next.state!=='READY'||next.stage!=='VERIFIED_LIVE'||old.stage==='VERIFIED_LIVE')return next;
 if(!/^\d+$/.test(String(old.runId||''))||BigInt(old.runId)<=BigInt(next.runId))return next;
 return {...next,runId:old.runId,runAttempt:old.runAttempt,runUrl:old.runUrl,
  verifiedByRunId:next.runId,verifiedByRunAttempt:next.runAttempt,verifiedByRunUrl:next.runUrl};
}
function mayReplace(old,next){
 if(old?.schema!==SCHEMA)return true;
 if(old.marketDate!==next.marketDate)return old.marketDate<next.marketDate;
 if(old.state==='READY'&&old.stage==='VERIFIED_LIVE'&&old.identity&&old.identity===next.identity&&old.modelDate===next.modelDate&&next.stage!=='VERIFIED_LIVE')return false;
 if(BigInt(old.runId)!==BigInt(next.runId))return BigInt(old.runId)<BigInt(next.runId);
 if(old.runAttempt!==next.runAttempt)return old.runAttempt<next.runAttempt;
 if(old.state==='READY'&&old.stage==='VERIFIED_LIVE'&&next.state!=='READY')return false;
 const rank={SOURCES:1,INFERENCE:2,VERIFIED_CACHE:3,VERIFIED_PUBLICATION:4,DEPLOYMENT:5,VERIFIED_LIVE:6};
 if(old.state==='RUNNING'&&next.state==='RUNNING'&&(rank[old.stage]||0)>(rank[next.stage]||0))return false;
 return true;
}
function main(root=path.resolve(__dirname,'..')){
 const file=path.join(root,'data/kronos-future/update-status.json'),market=JSON.parse(fs.readFileSync(path.join(root,'data/market/latest.json'))),catalogFile=path.join(root,'data/kronos-future/manifest.json'),catalog=fs.existsSync(catalogFile)?JSON.parse(fs.readFileSync(catalogFile)):null;
 const next=build({state:process.argv[2],stage:process.argv[3]||'UNKNOWN',date:process.env.FUTURE_DATE||market.tradeDateIso,identity:process.env.EXPECTED_IDENTITY||null,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,repository:process.env.GITHUB_REPOSITORY,catalog});
 const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
 const promoted=promoteVerifiedLive(old,next);
 if(!mayReplace(old,promoted)){console.log('Newer future update already recorded; status unchanged.');return false;}
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(promoted)+'\n');console.log(JSON.stringify(promoted));return true;
}
if(require.main===module)main();
module.exports={SCHEMA,build,promoteVerifiedLive,mayReplace,main};
