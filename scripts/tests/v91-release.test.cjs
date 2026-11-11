'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const release=require('../../version-v50.js'),core=require('../../strategy-2560-v1.js');
test('V9.1 labels and cache keys consistent across stock and market',()=>{
 const index=fs.readFileSync('index.html','utf8'),market=fs.readFileSync('market-outlook.html','utf8');
 assert.equal(release.displayCode,'V9.1');assert.equal(release.fileVersion,'V9.1');
 assert.equal(release.cacheVersion,'V9.1-2560-MA25-VOL5-60-1');assert.equal(release.fifthStrategyVersion,core.MODEL);
 assert.equal(core.MODEL,'2560-STRATEGY-V2.0');assert.equal(core.RULE.exit,'UNSPECIFIED');
 for(const html of [index,market]){assert.match(html,/V9\.1/);assert.ok(html.includes('version-v50.js?v='+release.cacheVersion));assert.equal(html.includes('V9.0-2560-KLINE1'),false);}
 for(const path of ['research-v83/stock-simple-report.js','research-v83/market-simple-report.js'])assert.ok(fs.readFileSync(path,'utf8').includes("VERSION='V9.1'"));
 assert.ok(fs.readFileSync('strategy-2560-report-v1.js','utf8').includes("prefix:'2560_V9.1'"));
 assert.equal(fs.readFileSync('strategy-2560-ui-v1.js','utf8').includes('MA5今天剛從MA40'),false);
});
