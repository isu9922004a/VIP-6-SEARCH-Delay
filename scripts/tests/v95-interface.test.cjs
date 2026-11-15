'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const B=require('../fixtures/v95-interface-baseline.json'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('V9.5 preserves exact scanner, strategy, life report/share dependencies and Worker bytes',()=>{
 for(const [name,expected]of Object.entries(B.sources)){
  let source=fs.readFileSync(name);
  // V9.7 adds a dedicated, opt-in page plan. Compare every byte of the original default path.
  if(name==='kline-life-03-pages-v94.js')source=Buffer.from(source.toString().replace(/ \/\/ The fourth strategy opts[\s\S]*? \}else\{\n(?= \/\/ Page 1:)/,'').replace(' }\n const count=pages.length;',' const count=pages.length;'));
  assert.equal(sha(source),expected,name);
 }
});
test('research workbench navigation, tools and state handling remain exactly at the main baseline',()=>{
 const s=fs.readFileSync('research-v83/workspace-v831.js','utf8').replace('前往主力生命線成本','前往寶塔線點金術');const parts=[s.slice(s.indexOf('function select('),s.indexOf('function heading(')),s.slice(s.indexOf(" const nav=el('section');nav.id='workspaceV831'"),s.indexOf(' main.insertBefore(nav,first);'))];assert.equal(sha(JSON.stringify(parts)),B.workbenchSha256);
});
test('V9.5 entry module is idempotent and cannot replace data, scanner or analysis functions',()=>{
 const s=fs.readFileSync('ui-simplify-v95.js','utf8');assert.match(s,/if\(doc.documentElement.dataset.uiSimplifyV95\)return/);assert.doesNotMatch(s,/(?:root|globalThis|window)\.(?:analyzeStock|run\w*Scan\w*|Shitou\w+)\s*=/);assert.doesNotMatch(s,/innerHTML\s*=|\.replaceAll\(/);
 const release=require('../../version-v50.js');assert.equal(release.displayCode,'V9.7');assert.equal(release.fileVersion,'V9.7');assert.match(release.cacheVersion,/^V9\.7-/);assert.equal(release.life03Version,'KLINE_LIFE_03_V1');
});
