'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tests=fs.readdirSync(path.join(__dirname,'tests')).filter(file=>/\.test\.(?:mjs|cjs)$/.test(file)).sort().map(file=>'scripts/tests/'+file);
const result=cp.spawnSync(process.execPath,['--test','datasync-test.mjs',...tests],{cwd:root,stdio:'inherit'});
if(result.error)console.error(result.error);
process.exitCode=result.status??1;
