'use strict';
// Read-only reference inventory; absence of a literal is NOT permission to archive.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../frontend-v924-audit.json'));
const tracked=cp.execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:64*1024*1024}).toString('utf8').split('\0').filter(Boolean);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const entry=['index.html','market-outlook.html','stock-worker.mjs','market-worker.mjs','package.json'];
const sources=Object.fromEntries(entry.map(p=>[p,read(p)]));
const assets=[...sources['index.html'].matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)].map(m=>({url:m[1],tag:m[0]})).filter(x=>/\.(?:js|css)(?:\?|$)/i.test(x.url));
const roots=tracked.filter(p=>!p.includes('/')&&/\.(?:js|css|mjs|cjs)$/.test(p)&&!entry.includes(p));
const candidates=roots.filter(p=>!Object.values(sources).some(s=>s.includes(p))).map(p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,refs:[]}));
const skipped=[];
for(const p of tracked){
  if(!/\.(?:js|mjs|cjs|ts|css|html|json|yaml|yml|py|sh|md|txt|toml)$/i.test(p))continue;
  // Market/research payloads are not dependency declarations. Keep code under data.
  if(/^(?:data|evidence)\//.test(p)&&!/(\.js|\.mjs|\.cjs|\.py|\.html|\.css)$/.test(p))continue;
  const stat=fs.statSync(path.join(root,p));if(stat.size>10*1024*1024){skipped.push(p);continue;}
  const content=read(p);
  for(const c of candidates){
    if(p===c.path)continue;
    const stem=c.path.replace(/\.[^.]+$/,'');
    const escaped=stem.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g,'\\$&');
    if(content.includes(c.path)||new RegExp('(?:[/"\\x27])'+escaped+'(?:["\\x27]|\\.)').test(content))c.refs.push(p);
  }
}
const report={entry,js:assets.filter(x=>/\.js(?:\?|$)/.test(x.url)),css:assets.filter(x=>/\.css(?:\?|$)/.test(x.url)),directlyUnreferenced:candidates,reviewCandidates:candidates.filter(x=>!x.refs.length),skipped,warning:'Static name search only. Dynamic/generated imports, external callers and archival fixtures require separate review. No files moved.'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({js:report.js.length,css:report.css.length,directlyUnreferenced:candidates.length,reviewCandidates:report.reviewCandidates,skipped},null,2));
