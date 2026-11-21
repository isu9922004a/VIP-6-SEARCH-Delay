'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

module.exports=async function expectedLiveRelease(){
 if(process.env.GITHUB_EVENT_NAME!=='pull_request')return require('../../version-v50.js').displayCode;
 const {pull_request:pr}=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const {sha,repo}=pr.base;
 assert.match(sha,/^[0-9a-f]{40}$/);
 assert.equal(repo.full_name,process.env.GITHUB_REPOSITORY);
 const response=await fetch('https://raw.githubusercontent.com/'+repo.full_name+'/'+sha+'/version-v50.js');
 assert.equal(response.status,200,'讀取 PR 基準版本');
 const display=/\bDISPLAY='(V\d+(?:\.\d+)+)'/.exec(await response.text());
 assert.ok(display,'PR 基準提交必須有正式版本名稱');
 return display[1];
};
