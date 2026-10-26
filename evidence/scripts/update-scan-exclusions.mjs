import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const P=createRequire(import.meta.url)('../scan-exclusions-rsi-v5328.js');

export async function updateScanExclusions(tradeDate,root=process.cwd(),fetchImpl=fetch){
 const date=P.date(tradeDate);if(!date)throw Error('排除名單交易日期格式錯誤');const compact=date.replace(/-/g,'');
 const urls=[`https://www.twse.com.tw/exchangeReport/TWT85U?response=json&date=${compact}`,'https://www.tpex.org.tw/openapi/v1/tpex_cmode'];
 const fetchOfficial=async(url,retries=5)=>{
  let lastError=null;
  for(let attempt=1;attempt<=retries;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
   try{
    const r=await fetchImpl(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    const text=await r.text();
    if(!r.ok)throw Error('變更交易來源HTTP '+r.status);
    return JSON.parse(text);
   }catch(error){
    lastError=error;
    if(attempt<retries)await new Promise(resolve=>setTimeout(resolve,2000*attempt));
   }finally{clearTimeout(timer);}
  }
  throw lastError||Error('變更交易來源取得失敗');
 };
 const values=await Promise.all(urls.map(url=>fetchOfficial(url)));
 const status={...P.parseOfficial(...values,date),fetchedAt:new Date().toISOString(),sources:urls},text=JSON.stringify(status);
 const marketDir=path.join(root,'data/market');await fs.mkdir(marketDir,{recursive:true});
 const archive=path.join(marketDir,'exclusions',date+'.json');await fs.mkdir(path.dirname(archive),{recursive:true});
 await fs.writeFile(archive,text+'\n','utf8');
 await fs.writeFile(path.join(marketDir,'scan-exclusions.json'),text+'\n','utf8');
 await fs.writeFile(path.join(marketDir,'scan-exclusions.js'),'globalThis.ShitouOfflineScanExclusions5328='+text+';\n','utf8');
 return status;
}

async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e?.code==='ENOENT')return null;throw e;}}
async function runCli(){
 const root=process.cwd(),marketDir=path.join(root,'data/market'),latestPath=path.join(marketDir,'latest.json');
 const latest=await readJson(latestPath);const requested=process.argv[2]||latest?.tradeDate;
 if(!requested)throw Error('找不到行情交易日；請先更新 data/market/latest.json');
 const status=await updateScanExclusions(requested,root);
 const wanted=P.date(requested),latestDate=P.date(latest?.tradeDate||latest?.tradeDateIso);
 if(latest&&latestDate===wanted){
  latest.exclusionStatus=status;
  const payload=JSON.stringify(latest)+'\n';
  await fs.writeFile(latestPath,payload,'utf8');
  const archivePath=path.join(marketDir,'archive',wanted+'.json');
  try{await fs.access(archivePath);await fs.writeFile(archivePath,payload,'utf8');}catch(e){if(e?.code!=='ENOENT')throw e;}
 }
 console.log(`Updated scan exclusions: ${status.date}｜TWSE ${status.twseCodes.length}｜TPEx ${status.tpexCodes.length}｜special ${status.specialCodes.length}`);
}
const isDirect=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isDirect)runCli().catch(error=>{console.error(`SCAN_EXCLUSION_UPDATE_FAILED: ${error?.stack||error}`);process.exitCode=1;});
