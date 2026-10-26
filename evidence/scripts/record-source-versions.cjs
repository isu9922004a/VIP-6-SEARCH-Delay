'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files={stock:'C:/Users/d3184/.codex/attachments/142bf23d-fd3e-4817-af8e-4520ed97d59b/貼上的文字.txt',market:'C:/Users/d3184/.codex/attachments/878a6217-439c-488a-bd66-ec90bfed7a24/貼上的文字.txt'};
const baseline=fs.existsSync('evidence/source-versions.json')?JSON.parse(fs.readFileSync('evidence/source-versions.json','utf8')).baseline:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const evidence={baseline,remoteMain:cp.execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim(),deploymentSourceByteIdentity:'UNVERIFIED_NO_CLOUDFLARE_SOURCE_ACCESS',attachments:{},zip:{sha256:hash(fs.readFileSync('C:/Users/d3184/Downloads/VIP-BOWTOWER-4-SEARCH-main.zip'))}};
for(const [name,file] of Object.entries(files)){
 const b=fs.readFileSync(file),s=b.toString('utf8');evidence.attachments[name]={attachment:file.split('/').slice(-2).join('/'),sha256:hash(b),lineCount:s.split('\n').length,version:s.match(/const VERSION = "([^"]+)"/)?.[1]};
 let diff=cp.spawnSync('git',['diff','--no-index','--ignore-space-at-eol','--',file,`workers/${name}-worker.mjs`],{encoding:'utf8',maxBuffer:8e6}).stdout;
 diff=diff.replace(/^diff --git .*$/m,`diff --git a/workers/${name}-worker.mjs b/workers/${name}-worker.mjs`).replace(/^--- .*$/m,`--- a/workers/${name}-worker.mjs`).replace(/^\+\+\+ .*$/m,`+++ b/workers/${name}-worker.mjs`);
 fs.writeFileSync(`docs/R9-${name}-worker.patch`,diff);
}
const zipHashes=JSON.parse(fs.readFileSync('evidence/zip-entry-hashes.json','utf8').replace(/^\uFEFF/,''));
let matched=0;const differences=[];for(const entry of zipHashes){const p=cp.spawnSync('git',['show',`${baseline}:${entry.path}`],{maxBuffer:8e6});if(p.status===0&&hash(p.stdout)===entry.sha256)matched++;else differences.push({path:entry.path,status:p.status===0?'DIFFERENT_FROM_MAIN':'NOT_IN_MAIN'});}
evidence.zip={...evidence.zip,files:zipHashes.length,byteMatchesWithMain:matched,differences};
const live=require('../evidence/daily.json');evidence.live={marketVersion:live.version,stockVersions:[...new Set(live.results.map(x=>x.data?.version))],frontend:/DISPLAY='([^']+)'/.exec(fs.readFileSync('evidence/page.js','utf8'))?.[1],capturedAt:require('../evidence/production-capture.json').capturedAt};
fs.writeFileSync('evidence/source-versions.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
