'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const shared=fs.readFileSync(path.join(root,'worker-data-contract-v1.js'),'utf8');
const start='// BEGIN EMBEDDED DAILY CONTRACT\n',end='// END EMBEDDED DAILY CONTRACT\n';
for(const name of ['stock-worker.mjs','market-worker.mjs']){
 const file=path.join(root,'workers',name);let text=fs.readFileSync(file,'utf8');
 if(text.startsWith(start))text=text.slice(text.indexOf(end)+end.length);
 fs.writeFileSync(file,start+shared+'\n'+end+text);
}
