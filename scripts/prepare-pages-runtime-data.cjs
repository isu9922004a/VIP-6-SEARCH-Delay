'use strict';
// Prune only the staged Pages copy. Preserve all dates referenced by live manifests/models.
const fs=require('node:fs'),path=require('node:path');
function prepare(site){site=path.resolve(site);const repo=path.resolve(__dirname,'..');if(site===repo||site===path.parse(site).root)throw Error('Refusing to prune the source repository');const research=path.join(site,'data/research'),manifest=JSON.parse(fs.readFileSync(path.join(research,'manifest.json'),'utf8')),keep=new Set(),date=d=>{if(/^\d{4}-\d{2}-\d{2}$/.test(d||''))keep.add(d);};date(manifest.date);if(!keep.size)throw Error('Research manifest has no valid current date');
 for(const e of Object.values(manifest.stocks||{})){const p=e.path;if(typeof p!=='string'||!/^\d{4}-\d{2}-\d{2}\/[\w.-]+\.json$/.test(p)||!fs.existsSync(path.join(research,p)))throw Error('Referenced current research file missing');date(p.split('/')[0]);}
 for(const file of ['data/market/latest.json','data/index/TAIEX.json','data/kronos/manifest.json','data/kronos-future/manifest.json']){const full=path.join(site,file);if(!fs.existsSync(full))continue;const m=JSON.parse(fs.readFileSync(full,'utf8'));date(m.asOf);date(m.closeDate);date(m.tradeDateIso);for(const group of [m.stocks,m.instruments])for(const e of Object.values(group||{}))date(e.asOf);}
 const removed=[];for(const d of fs.readdirSync(research,{withFileTypes:true}))if(d.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(d.name)&&!keep.has(d.name)){fs.rmSync(path.join(research,d.name),{recursive:true,force:true});removed.push(d.name);}
 let bytes=0;const count=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const full=path.join(p,e.name);if(e.isDirectory())count(full);else if(e.isFile())bytes+=fs.statSync(full).size;}};count(site);if(bytes>950000000)throw Error('Pages package exceeds the 950 MB safety budget: '+bytes);
 return {keptDates:[...keep].sort(),removedFromDeploymentOnly:removed.sort(),bytes};
}
if(require.main===module)console.log('PAGES_RUNTIME_DATA '+JSON.stringify(prepare(process.argv[2]||'/tmp/verified-site')));module.exports={prepare};
