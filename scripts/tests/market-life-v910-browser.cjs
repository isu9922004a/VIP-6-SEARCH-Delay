'use strict';
/* V9.10: execute the complete existing real Chromium PNG/ZIP/share/multi-entry regression, then verify evidence. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'/tmp/v910-market-life');
const child=cp.spawnSync(process.execPath,[path.join(__dirname,'market-life-v96-browser.cjs'),out],{stdio:'inherit',env:process.env,timeout:300000});
if(child.error)throw child.error;
assert.equal(child.status,0,'V9.10 兩頁大盤圖片完整驗收未通過');
const x=JSON.parse(fs.readFileSync(path.join(out,'browser-results.json'),'utf8'));
assert.equal(x.status,'PASS');assert.ok(x.checks.length>=5);
const posterChecks=x.checks.filter(c=>typeof c.entry==='string');
assert.ok(posterChecks.length>=5,'必須涵蓋兩個入口與手機／桌面尺寸');
assert.ok(posterChecks.every(c=>c.pages>=3&&c.dimensions==='1284x2778'&&c.sourceVerified),'所有大盤實際輸出皆須驗證雙頁尺寸及官方資料');
assert.ok(x.checks.some(c=>Array.isArray(c.stockDefaultPNGs)&&c.stockDefaultPNGs.every(v=>v.byteIdentical)),'個股圖片保護比較不得被略過');
console.log('MARKET_LIFE_V910_BROWSER_PASS '+JSON.stringify({entries:x.checks.length,pages:'V9.16>=3',size:'1284x2778'}));
