'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../../research-action-guide-v1.js'),O=require('../../research-opening-plan-v1.js'),C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js');
const fixture=require('../fixtures/plain-narrative-20261030.json'),{report}=require('../research-fixtures.cjs');
function actual(code='8039'){const r=fixture.records[code];return C.evaluate(report(structuredClone(r.bars),{stock:r.stock,name:r.name,market:r.market}));}
function reference(scale=1){
 const a=structuredClone(actual());a.code='9001';a.name='合成高價測試股';
 const p={...O.evaluate(a),code:a.code,close:2370*scale,watch:2380*scale,stop:2355*scale,target:2399*scale,bear:{watch:2360*scale,stop:2385*scale,entryRange:null},entryRange:null,state:'NO_TRADE',dataIssues:[]};
 return {a,p};
}
test('the supplied template prices produce the correct gross 19-versus-25 comparison without authorizing a buy',()=>{
 const {a,p}=reference(),before=JSON.stringify({a,p}),g=A.build(a,p,null),c=g.comparison;
 assert.deepEqual([c.entry,c.target,c.stop,c.reward,c.risk],[2380,2399,2355,19,25]);assert.equal(c.ratio,19/25);assert.equal(c.costsIncluded,false);
 assert.match(g.summary[1].value,/到 2399 元只有 19 元；到 2355 元相差 25 元/);assert.match(g.summary[1].value,/未扣成本，上方價差小於向下風險/);assert.match(g.summary[1].value,/2380 元並非已核准買價/);
 assert.equal(JSON.stringify({a,p}),before);
});
test('all five numbered sections use supplied stock prices and preserve the template order',()=>{
 for(const scale of [.1,1,2]){const {a,p}=reference(scale),g=A.build(a,p,null);assert.equal(g.summary.length,6);assert.deepEqual(g.summary.map(f=>f.title),A.TITLES);assert.deepEqual(g.sections.map(s=>s.number),['01','02','03','04','05']);
  assert.equal(g.sections[0].rows[0].price,A.price(2380*scale));assert.equal(g.sections[1].rows[0].price,A.price(2355*scale));assert.equal(g.sections[1].rows[1].price,A.price(2399*scale)+'附近');assert.equal(g.sections[3].rows[1].price,A.price(2385*scale));assert.ok(Math.abs(g.comparison.reward-19*scale)<1e-10);
 }
});
test('existing-holder guidance distinguishes defence, profitable sales and an unprofitable holding',()=>{
 const {a,p}=reference(),g=A.build(a,p,null),text=g.summary[2].value;
 assert.match(text,/不是每位持股者通用的停損價/);assert.match(text,/已經獲利者，可評估是否先賣出一部分/);assert.match(text,/尚未獲利者，不能把這裡一律當成停利點/);assert.match(text,/不要因期待反彈，就把原停損往下移/);
});
test('opening bands use the weaker-price observation, rather than substituting the long stop',()=>{
 const {a,p}=reference(),g=A.build(a,p,null),rows=g.sections[2].rows;
 assert.deepEqual(rows.map(r=>r.price),['高於 2380 元','2360～2380 元','低於 2360 元']);assert.doesNotMatch(g.summary[3].value,/2355/);assert.match(g.summary[3].value,/目前沒有合適的新買計畫/);
});
test('verified, unknown and conflicting volume keep their distinct evidence states',()=>{
 const a=actual(),verified=A.build(a,O.evaluate(a),O.plainContext(a));assert.match(verified.summary[5].value,/已完成本次核對/);assert.match(verified.summary[5].value,/昨天少約13%/);assert.doesNotMatch(verified.summary[5].value,/成交量來源尚未核對/);
 for(const status of ['UNKNOWN','CONFLICT']){const b=structuredClone(a);b.unifiedResearch.structureContext.volume={...b.unifiedResearch.structureContext.volume,status,usable:false};const g=A.build(b,O.evaluate(b),O.plainContext(b));assert.doesNotMatch(g.summary[5].value,/昨天少約13%|已完成本次核對/);assert.match(g.summary[5].value,/尚未核對|還沒核對|來源有差異/);assert.match(g.summary[5].value,/不能據此判定/);}
});
test('qualified, pending and failed plans never share an unconditional buy instruction',()=>{
 const {a,p}=reference();p.state='CONDITIONAL';p.entryRange={low:2385,high:2390};const qualified=A.build(a,p,null);assert.match(qualified.summary[0].value,/盤後條件通過，盤中仍須確認/);assert.match(qualified.summary[1].value,/2385 元～2390 元/);assert.doesNotMatch(qualified.summary[3].value,/沒有合適的新買計畫/);
 p.state='WAIT';const pending=A.build(a,p,null);assert.match(pending.summary[1].value,/目前沒有通過檢查的買價區間/);assert.doesNotMatch(pending.summary[1].value,/確認後才評估/);
 a.state='BREAKOUT_FAILURE';p.state='NO_TRADE';const failed=A.build(a,p,null);assert.match(failed.summary[0].value,/原買進理由已失效/);assert.match(failed.summary[3].value,/不沿用原計畫/);
});
test('absent targets, invalid history and inverted bands do not create fictional trade levels',()=>{
 const {a,p}=reference();p.target=null;const g=A.build(a,p,null);assert.equal(g.comparison,undefined);assert.match(g.summary[2].value,/上方歷史關卡不足/);assert.doesNotMatch(g.summary[1].value,/假設買在/);
 p.bear.watch=2500;const inverted=A.build(a,p,null);assert.doesNotMatch(inverted.summary[3].value,/2500.*2380/);
 const invalid=C.evaluate({stock:'9001',market:'TWSE'}),missing=A.build(invalid,O.evaluate(invalid),O.plainContext(invalid));assert.equal(missing.summary.length,6);assert.doesNotMatch(missing.summary.map(f=>f.value).join(''),/NaN|undefined|2399 元/);assert.match(missing.summary[0].value,/先不下單/);
});
test('a strong stock is not told to reclaim a price it has already reached',()=>{
 const a=actual('7704'),g=R.view(a).actionGuide;assert.doesNotMatch(g.summary[1].value,/未站回|為什麼站回/);assert.match(g.summary[0].value,/高於最近20天平均/);
});
test('web and export share the action schema without mutating model results',()=>{
 const a=actual(),before=JSON.stringify(a),v=R.view(a);assert.equal(v.presentation,'ACTION_GUIDE_8_2_10');assert.deepEqual(v.summary,v.actionGuide.summary);assert.equal(JSON.stringify(a),before);
 const document={createElement:()=>({getContext:()=>({font:'',measureText:s=>({width:[...s].length*34})})})},pages=R.pages(a,{document,stockMode:true});assert.equal(pages.length,1);const audit=JSON.parse(pages[0].dataset.researchAudit);assert.deepEqual(audit.fields,v.summary);assert.ok(audit.noClipping);assert.ok(audit.bodyBottom<=audit.height-150);assert.equal(JSON.stringify(a),before);
});
test('V8.2.10 loads the shared guide and includes the new assets in deployment verification',()=>{
 const version=require('../../version-v50.js'),html=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8'),verifier=fs.readFileSync(require('node:path').join(__dirname,'../verify-deployed-frontend.py'),'utf8');assert.equal(version.displayCode,'V8.2.10');assert.equal(version.fileVersion,'V8.2.10');assert.ok(html.indexOf('research-action-guide-v1.js?')<html.indexOf('research-report-v1.js?'));assert.ok(verifier.includes('research-action-guide-v1.js'));assert.ok(verifier.includes('research-mobile-v1.css'));
});
