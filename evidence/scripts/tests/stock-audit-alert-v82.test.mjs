import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../../stock-audit-alert-v82.js');
const snap=JSON.parse(fs.readFileSync(new URL('../../data/market/latest.json',import.meta.url),'utf8'));
const q=snap.rows.find(x=>x.code==='4939');
const sample={code:'4939',closeDate:'2026-10-22',market:'TPEX',close:72.2,volumeUnit:'shares',dailySeries:[{date:'2026-10-22',open:q.open,high:q.high,low:q.low,close:q.close,volume:8782000}]};
test('V8.2 detects real 4939 same-day volume split without changing source',()=>{
 const before=JSON.stringify(sample),audit=M.check(sample,snap);
 assert.equal(audit.status,'VOLUME_MISMATCH');
 assert.equal(audit.rawVolumeLots,8782);
 assert.equal(audit.snapshotVolumeLots,8896.195);
 assert.ok(audit.relativeDiffPct>1.2&&audit.relativeDiffPct<1.4);
 assert.equal(JSON.stringify(sample),before);
});
test('V8.2 strict threshold normalization respects TWSE/TPEX price steps',()=>{
 const plan=M.alertPlan({code:'4939',marketDate:'2026-10-22',close:72.2,turn:77.13,pressure:73.8,defense:70});
 assert.equal(plan.priceAbove.input,77.1);
 assert.equal(plan.priceAbove.firstStrictTrigger,77.2);
 assert.equal(plan.earlyAbove.input,73.8);
 assert.equal(plan.priceBelow.input,70);
 assert.equal(plan.priceBelow.firstStrictTrigger,69.9);
 assert.equal(plan.providerIntegrationStatus,'MANUAL_ONLY');
 assert.equal(M.nextTick(99.9,1),100);
 assert.equal(M.nextTick(100,-1),99.9);
});
test('V8.2 does not cross-match stale quotes or mismatched OHLC/unknown units',()=>{
 assert.equal(M.check({...sample,closeDate:'2026-10-21'},snap).status,'DATE_MISMATCH');
 assert.equal(M.check({...sample,close:70.0},snap).status,'PRICE_MISMATCH');
 assert.equal(M.check({...sample,volumeUnit:'unknown'},snap).status,'UNKNOWN_VOLUME_UNIT');
 assert.equal(M.check({...sample,dailySeries:[{...sample.dailySeries[0],low:60}]},snap).status,'OHLC_MISMATCH');
});
test('V8.2 absence of a trustworthy source cannot be presented as certified',()=>{
 assert.equal(M.check(sample,{...snap,marketCoverageReady:false}).status,'NOT_VERIFIED');
 assert.equal(M.check(sample,{...snap,rows:[]}).status,'NOT_VERIFIED');
 assert.equal(M.alertPlan({turn:null,defense:undefined}).priceAbove.input,null);
});
test('V8.2.2-R13 frontend/version preserves six-filter legacy entries',()=>{
 const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 const v=fs.readFileSync(new URL('../../version-v50.js',import.meta.url),'utf8');
 const t=fs.readFileSync(new URL('../../r45-report-suite.js',import.meta.url),'utf8');
 assert.match(html,/stock-audit-alert-v82\.js\?v=V8\.2\.2-R13/);
 assert.match(v,/DISPLAY='V8\.2\.2-R13'/);
 assert.match(t,/收盤與量能須再次確認/);
 for(const x of ['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerGoldPanel','restaurant'])assert.ok(html.includes(x));
});
