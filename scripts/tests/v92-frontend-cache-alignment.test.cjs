'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const release=require('../../version-v50.js');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
test('V9.2 current market/report scripts use canonical cache identity, not detached image cache',()=>{
 assert.equal(release.displayCode,'V9.2');
 assert.equal(release.life03Version,'KLINE_LIFE_03_V1');
 assert.match(release.cacheVersion,/^V9\.2-/);
 for(const name of ['market-report-comfort-v864.js','market-report-refresh-v864.js']){
  const exact='./'+name+'?v='+release.cacheVersion;
  assert.ok(html.includes(exact),name+' must use canonical V9.2 cache key');
  assert.equal(html.split(exact).length-1,1,name+' must appear exactly once');
  assert.ok(!html.includes('./'+name+'?v=V9.2-LIFE03-1'),name+' must not reuse detached old tag');
 }
 assert.ok(html.indexOf('market-report-comfort-v864.js?')<html.indexOf('market-report-refresh-v864.js?'));
});
