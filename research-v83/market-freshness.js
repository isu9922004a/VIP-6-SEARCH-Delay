'use strict';
(function(root){
 function taipei(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};
 }
 function check(model,history,now){
  const t=taipei(now),target=model?.targetDates?.[0];
  if(model?.kind!=='KRONOS_INFERENCE'||model.model?.id!=='NeoQuasar/Kronos-small'||model.codeCommit!=='67b630e67f6a18c9e9be918d9b4337c960db1e9a'||model.asOf!==history?.closeDate||!/^\d{4}-\d{2}-\d{2}$/.test(target||''))return {ready:false,reason:'大盤模型與行情日期或來源尚未核對，等待自動更新。'};
  if(target<t.date||target===t.date&&t.hour>=15)return {ready:false,reason:`大盤行情截至 ${history.closeDate}，模型推演日 ${target} 已結束，等待盤後自動更新。`};
  return {ready:true};
 }
 async function getJSON(url,{fetcher=globalThis.fetch,attempts=3,timeout=20000,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  let last;for(let i=0;i<attempts;i++){
   try{const r=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(timeout)});if(!r.ok){const e=Error('HTTP '+r.status);e.status=r.status;throw e;}return await r.json();}
   catch(e){last=e;if(e.status&&![408,429].includes(e.status)&&e.status<500)break;if(i+1<attempts)await delay(300*(i+1));}
  }throw last;
 }
 const api={taipei,check,getJSON};root.ShitouMarketFreshness=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
