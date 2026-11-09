'use strict';
// A matching date alone cannot detect an older same-day model catalog in the CDN.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function compare(expected,actual){
 try{const a=JSON.parse(expected),b=JSON.parse(actual);if(a.schema!=='shitou-kronos-future-catalog-v1'||b.schema!==a.schema)return {ready:false,reason:'模型目錄格式不符'};if(a.asOf!==b.asOf)return {ready:false,reason:'模型日期尚未同步'};if(a.identity!==b.identity)return {ready:false,reason:'同日模型版本尚未同步'};if(sha(expected)!==sha(actual))return {ready:false,reason:'模型目錄內容尚未完整同步'};return {ready:true,date:b.asOf,identity:b.identity,readyModels:Object.keys(b.instruments||{}).length,unavailable:Object.keys(b.unavailable||{}).length};}catch{return {ready:false,reason:'模型目錄尚未完整載入'};}
}
async function verify(expected,{base,fetcher=fetch,maxWaitMs=600000,intervalMs=10000,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,log=console.log}={}){
 const deadline=now()+maxWaitMs;let result;
 do{try{const u=new URL('data/kronos-future/manifest.json',base);u.searchParams.set('verified-batch',String(now()));const response=await fetcher(u,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});result=response.ok?compare(expected,await response.text()):{ready:false,reason:'模型目錄 HTTP '+response.status};}catch(e){result={ready:false,reason:'模型目錄連線尚未完成：'+e.message};}
  log('FUTURE_DATA_DEPLOYMENT '+JSON.stringify(result));if(result.ready)return result;if(now()>=deadline)break;await sleep(intervalMs);
 }while(now()<=deadline);
 throw Error('網站尚未提供本批已核驗模型，不宣告更新完成：'+result.reason);
}
if(require.main===module){const repo=process.env.GITHUB_REPOSITORY||'isu9922004a/VIP-6-SEARCH-Delay',base=process.env.RESEARCH_BROWSER_ORIGIN||'https://'+repo.split('/')[0].toLowerCase()+'.github.io/'+repo.split('/')[1]+'/',expected=fs.readFileSync(process.argv[2]||path.resolve(__dirname,'../data/kronos-future/manifest.json'),'utf8');verify(expected,{base}).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={compare,verify};
