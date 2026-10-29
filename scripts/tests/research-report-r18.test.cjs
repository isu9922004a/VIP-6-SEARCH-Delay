'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js');
const {bars,report}=require('../research-fixtures.cjs');
const document={createElement:()=>({getContext:()=>({font:'',measureText:s=>({width:[...String(s)].length*56})})})};
const field=(v,title)=>{const x=v.details.find(x=>x.title===title);assert.ok(x,'Missing full report field: '+title);return x.value;};
test('full report preserves independent original strategy levels and their evidence status',()=>{
 const input=report(bars(160),{originalB:123,originalBSource:'SYNTHETIC_ORIGINAL_B',originalInvalidation:88,originalInvalidationSource:'SYNTHETIC_ORIGINAL_GUARD'}),before=JSON.stringify(input),a=C.evaluate(input),v=R.view(a);
 assert.match(field(v,'原策略價位'),/原策略B價 123.00.*原策略失效 88.00/);
 assert.notEqual(a.originalB,a.researchBreakoutPrice);assert.notEqual(a.originalInvalidation,a.researchInvalidation);
 for(const title of ['突破層級與確認','技術現況','策略意見與衝突','研究A/B','雙模式研究','四模型驗證','行情資料完整性'])field(v,title);
 assert.equal(new Set([...v.summary,...v.details].map(x=>x.title)).size,v.summary.length+v.details.length);
 assert.equal(JSON.stringify(input),before);
});
test('absent original levels remain explicit instead of borrowing a research price',()=>{
 const a=C.evaluate(report(bars(160))),v=R.view(a);
 assert.match(field(v,'原策略價位'),/原策略B價未提供／不適用.*原策略失效價未提供/);
 assert.equal(a.originalB,null);assert.equal(a.originalInvalidation,null);
});
test('stage label, text and every image page agree with the unified scenario stage',()=>{
 const a=C.evaluate(report(bars(160,i=>200-i*.5))),before=JSON.stringify(a),v=R.view(a);
 assert.equal(R.stageLabel(a),a.unifiedResearch.stageLabel);assert.equal(v.stage,R.stageLabel(a));
 assert.equal(field(v,'目前行情階段'),v.stage);assert.ok(field(v,'行情階段與依據').startsWith(v.stage+'；'));
 assert.ok(R.text(a).includes('【現況】'+v.stage));
 for(const p of R.pages(a,{document,detail:true}))assert.equal(JSON.parse(p.dataset.researchAudit).stage,v.stage);
 assert.equal(JSON.stringify(a),before);
});
test('explicit structure failure takes precedence over stale favorable scenario and indicator labels',()=>{
 const a=C.evaluate(report(bars(160))),b={...a,state:'BREAKOUT_FAILURE',compactStateLabel:'結構失敗',indicatorStudy:{...a.indicatorStudy,phase:'多頭續強'}};
 const v=R.view(b);assert.equal(v.stage,'結構失敗');assert.equal(field(v,'目前行情階段'),v.stage);
 assert.ok(field(v,'行情階段與依據').startsWith(v.stage+'；'));assert.match(v.summary[0].value,/買進理由已失效/);assert.doesNotMatch(v.summary[0].value,/🟢/);
 assert.match(field(v,'策略意見與衝突'),/多頭續強.*結構失敗.*風險優先/);
});
test('full exported image retains every original-level explanation across pagination',()=>{
 const a=C.evaluate(report(bars(160),{originalB:123,originalInvalidation:88})),v=R.view(a),audit=R.pages(a,{document,detail:true}).map(x=>JSON.parse(x.dataset.researchAudit));
 const chunks=audit.flatMap(x=>x.fields).filter(x=>x.title.replace('（續）','')==='原策略價位').map(x=>x.value).join('');
 assert.equal(chunks.replace(/\s/g,''),field(v,'原策略價位').replace(/\s/g,''));assert.ok(audit.every(x=>x.noClipping));
});

