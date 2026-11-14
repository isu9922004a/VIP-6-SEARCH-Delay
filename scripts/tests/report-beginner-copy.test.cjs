'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Copy=require('../../report-beginner-copy-v88.js');
test('copy is idempotent and preserves every price, ratio, date, direction and identity',()=>{
 const values=[...Object.keys(Copy.headings),'前一段從100.00漲到120.00，目前約回吐50.0%。','下降段先跌20.00元，反彈回補10.00元（50.0%）。','2026-11-09｜TAIEX｜收盤39,701.64點','偏多占比53.4%／盤整占比7.3%／偏空占比39.3%','台虹（8039）','高於63.97元列為偏多；低於53.63元列為偏空。'];
 for(const input of values){const output=Copy.line(input);assert.equal(Copy.line(output),output);assert.deepEqual(output.match(/[A-Za-z0-9]+(?:[.,%-][0-9]+)*/g),input.match(/[A-Za-z0-9]+(?:[.,%-][0-9]+)*/g));}
 assert.equal(Copy.line('下降段先跌20.00元，反彈回補10.00元（50.0%）。'),'下降段先跌20.00元，跌後漲回10.00元（50.0%）。');
});
test('presentation fields are cloned; risk caveats and unavailable values survive unchanged',()=>{
 const original=Object.freeze({title:'原結構失效價',value:'未取得；不是交易停損，原停損計畫優先。',price:null,verified:false});
 const result=Copy.field(original);assert.notEqual(result,original);assert.equal(result.title,'原看法重查價');assert.equal(result.value,original.value);assert.equal(result.price,null);assert.equal(result.verified,false);
 assert.match(Copy.fibNote,/不是股價跌幅/);assert.match(Copy.fibNote,/不能直接買/);assert.match(Copy.fibRatios,/不保證反轉/);assert.match(Copy.fibRatios,/50%是常用中間位置/);
});
test('both entry points load one shared copy module without changing existing script order or bindings',()=>{
 const crypto=require('node:crypto'),root=path.resolve(__dirname,'../..'),baseline=require('../fixtures/report-copy-entry-baseline.json');
 for(const file of ['index.html','market-outlook.html']){
  const after=fs.readFileSync(path.join(root,file),'utf8');
  const scripts=[...after.matchAll(/<script[^>]+src="([^"?]+)/g)].map(m=>m[1]);
  assert.deepEqual(scripts.filter(s=>!['./ui-simplify-v95.js','./kline-life-03-pages-v94.js','./kline-life-03-viewer-v94.js','./research-life-source-audit-v932.js','./research-chart-layout-v921.js','./kline-life-03-core-v1.js','./kline-life-03-report-v1.js'].includes(s)).filter(s=>!s.includes('report-beginner-copy-v88')&&!/\/(?:kline-attack(?:-report)?-v90|strategy-2560(?:-config-v90|-v1|-scanner-v1|-report-v1|-ui-v1))\.js$/.test(s)).filter((s,i,all)=>!(file==='market-outlook.html'&&['./price-action-context-v1.js','./selection-evidence-v1.js','./rsi-extended-v1.js','./indicator-shadow-v1.js'].includes(s))),baseline[file].scripts);
  assert.equal(scripts.filter(s=>s.includes('report-beginner-copy-v88')).length,1);if(file==='index.html'){assert.equal(scripts.filter(s=>s==='./ui-simplify-v95.js').length,1);assert.ok(scripts.indexOf('./ui-simplify-v95.js')>scripts.indexOf('./research-v83/workspace-v831.js'));assert.equal(scripts.filter(s=>s==='./research-life-source-audit-v932.js').length,1);for(const name of ['./kline-life-03-pages-v94.js','./kline-life-03-viewer-v94.js']){assert.equal(scripts.filter(s=>s===name).length,1);assert.ok(scripts.indexOf(name)<scripts.indexOf('./kline-life-03-report-v1.js'));}assert.ok(scripts.indexOf('./research-life-source-audit-v932.js')<scripts.indexOf('./kline-life-03-core-v1.js'));}
  const bindings=[...after.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]).join('\n');assert.equal(crypto.createHash('sha256').update(bindings).digest('hex'),baseline[file].buttonBindingsSha256);
 }
});
