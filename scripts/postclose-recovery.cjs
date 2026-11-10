'use strict';
// Orchestration only: reuse the existing calendar, source guards and real model planner.
const fs=require('node:fs'),path=require('node:path'),A=require('./kronos-future-automation.cjs'),U=require('./kronos-future-update-status.cjs');
const read=(root,p)=>{try{return JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));}catch{return null;}};
function decide({expected,market,history,index,catalog,modelNeeded=true,update,active=false,published=false}){
 const dates={expected,market:market?.tradeDateIso||null,history:history?.date||null,index:index?.closeDate||null,model:catalog?.asOf||null};
 const answer=(action,reason)=>({action,reason,dates});
 if(active&&update?.marketDate===expected)return answer('WAIT','本交易日的更新工作仍在執行，保留原批次，不重複推論。');
 if(market?.tradeDateIso!==expected||market.marketCoverageReady!==true||history?.verified!==true||history.date!==expected||history.snapshotContentSha256!==market.contentSha256)return answer('MARKET','行情或官方歷史尚未同日核對，先修復行情，再接續模型。');
 if(index?.closeDate!==expected||index.completed!==true||catalog?.asOf!==expected||modelNeeded)return answer('MODEL','行情已核對；補上同批大盤來源及合格20日模型，保留既有公式。');
 if(!published||update?.marketDate!==expected||update.state!=='READY'||update.stage!=='VERIFIED_LIVE')return answer('DEPLOY','本地模型已合格；核對正式網站及實際產圖，再記錄完成。');
 return answer('NONE','本交易日的行情、歷史、模型及正式網站均已核對，略過重算。');
}
async function expectedDate(root,now=new Date()){
 const market=read(root,'data/market/latest.json');
 if(market?.marketCalendar?.ready!==true)throw Error('缺少已核對交易日曆，不能猜測更新日期。');
 const {expectedCompletedDate}=await import('./update-market-snapshot.mjs'),d=expectedCompletedDate(market.marketCalendar,now);
 return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6);
}
async function published(root,{fetcher=fetch,repository=process.env.GITHUB_REPOSITORY||'isu9922004a/VIP-6-SEARCH-Delay',base=process.env.RESEARCH_BROWSER_ORIGIN}={}){
 base=base||'https://'+repository.split('/')[0].toLowerCase()+'.github.io/'+repository.split('/')[1]+'/';
 try{const files=['data/market/latest.json','data/research/manifest.json','data/kronos-future/manifest.json'];
  const records=await Promise.all(files.map(async file=>{const url=new URL(file,base);url.searchParams.set('postclose-check',String(Date.now()));const r=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}));
  const [m,h,c]=records,market=read(root,files[0]),history=read(root,files[1]),catalog=read(root,files[2]);
  return !!(market&&history&&catalog&&m.tradeDateIso===market.tradeDateIso&&m.contentSha256===market.contentSha256&&h.date===history.date&&h.snapshotContentSha256===history.snapshotContentSha256&&c.asOf===catalog.asOf&&c.identity===catalog.identity);
 }catch{return false;}
}
async function running(update,{fetcher=fetch,repository=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN}={}){
 if(!(update?.state==='RUNNING'||update?.state==='READY'&&update.stage!=='VERIFIED_LIVE')||!/^\d+$/.test(update.runId||'')||!repository||!token)return false;
 const r=await fetcher('https://api.github.com/repos/'+repository+'/actions/runs/'+update.runId,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('更新工作狀態暫時無法查核 HTTP '+r.status);
 const job=await r.json();return ['queued','pending','waiting','in_progress','requested'].includes(job.status);
}
async function plan(root,{now=new Date(),fetcher=fetch,online=true}={}){
 const expected=await expectedDate(root,now),market=read(root,'data/market/latest.json'),history=read(root,'data/research/manifest.json'),index=read(root,'data/index/TAIEX.json'),catalog=read(root,'data/kronos-future/manifest.json'),update=read(root,'data/kronos-future/update-status.json');
 let modelNeeded=true;try{modelNeeded=A.plan(A.inputs(root),path.join(root,'data/kronos-future'));}catch{}
 const active=online&&update?.marketDate===expected?await running(update,{fetcher}):false;
 const isPublished=online&&!modelNeeded?await published(root,{fetcher}):false;
 return decide({expected,market,history,index,catalog,modelNeeded,update,active,published:isPublished});
}
async function record(root,state,stage){
 const date=await expectedDate(root),catalog=read(root,'data/kronos-future/manifest.json');let identity=null;
 if(state==='READY'){const input=A.inputs(root);if(A.plan(input,path.join(root,'data/kronos-future')))throw Error('未取得本批完整合格模型，不可標完成');identity=input.identity;}
 const next=U.build({state,stage,date,identity,catalog,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,repository:process.env.GITHUB_REPOSITORY}),file=path.join(root,'data/kronos-future/update-status.json'),old=read(root,'data/kronos-future/update-status.json');
 if(state==='FAILED'&&old?.state==='FAILED'&&old.runId===next.runId&&old.runAttempt===next.runAttempt&&old.marketDate===date)return false;
 if(!U.mayReplace(old,next))return false;
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next)+'\n');console.log('POSTCLOSE_STATUS '+JSON.stringify(next));return true;
}
async function main(root=path.resolve(__dirname,'..')){
 if(process.argv[2]==='record')return record(root,process.argv[3],process.argv[4]);
 const result=await plan(root);console.log('POSTCLOSE_RECOVERY '+JSON.stringify(result));
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'action='+result.action+'\nexpected='+result.dates.expected+'\n');
 return result;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={decide,expectedDate,published,running,plan,record,main};
