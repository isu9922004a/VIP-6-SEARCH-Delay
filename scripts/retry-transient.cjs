'use strict';
// Retry transport failures only. Validation/model failures keep their original exit status.
const {spawnSync}=require('node:child_process');
const TRANSIENT=/(?:fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ConnectTimeoutError|ReadTimeout|ConnectionError|Connection reset|Connection timed out|Temporary failure in name resolution|Max retries exceeded|HTTP(?: Error)?[ :]+(?:429|500|502|503|504)\b|(?:429|500|502|503|504) (?:Client|Server) Error|remote end hung up)/i;
async function retry(command,args,{run=(c,a)=>spawnSync(c,a,{encoding:'utf8',maxBuffer:32*1024*1024}),sleep=ms=>new Promise(r=>setTimeout(r,ms)),write=s=>process.stdout.write(s),attempts=3}={}){
 for(let attempt=1;attempt<=attempts;attempt++){
  const result=run(command,args),output=(result.stdout||'')+(result.stderr||'');write(output);
  if(result.status===0)return 0;
  if(result.error||!TRANSIENT.test(output)||attempt===attempts)return result.status||1;
  write(`::warning::Temporary transport failure; retry ${attempt+1}/${attempts} with unchanged inputs.\n`);
  await sleep(attempt*20000);
 }
 return 1;
}
if(require.main===module){const [command,...args]=process.argv.slice(2);if(!command)throw Error('Command required');retry(command,args).then(code=>{process.exitCode=code;});}
module.exports={retry,TRANSIENT};
