'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js'),D=require('../../selection-data-v2.js');
const fixture=require('../fixtures/multi-stock-worker-responses-20261022.json');
const {report,bars}=require('../research-fixtures.cjs');
const summaryTitles=['現在方向與資料狀態','還沒買，先等什麼？','已有持股，看懂價位用途','下一交易日，開盤怎麼看？','想放空？目前也先等','還缺什麼確認？'];
const document={createElement:()=>({getContext:()=>({font:'',measureText(s){return {width:[...s].length*56};}})})};
function audits(a,options={}){return R.pages(a,{document,...options}).map(x=>JSON.parse(x.dataset.researchAudit));}
function squeeze(s){return s.replace(/[\s｜]/g,'');}
test('all seven recorded stocks and seven filter adapters share the same read-only presentation schema',()=>{
 D.reset();D.bind({map:new Map(fixture.snapshot.rows.map(q=>[q.code,q])),meta:fixture.snapshot.meta,snapshotRows:fixture.snapshot.rows.length});
 for(const record of fixture.records){
  let input;
  try{D.remember(record.daily,record.code);input=D.apply(record.full,record.code);}
  catch(e){input={...record.full,researchInputErrors:[e.message]};}
  const a=C.evaluate(input),before=JSON.stringify(a),view=R.view(a);
  assert.deepEqual(view.summary.map(x=>x.title),summaryTitles);
  assert.equal(view.stage,R.stageLabel(a));
  assert.equal(view.details.find(x=>x.title==='目前行情階段').value,view.stage);
  assert.deepEqual(audits(a).flatMap(x=>x.fields.map(y=>y.title.replace('（續）',''))).filter((v,i,all)=>i===0||v!==all[i-1]),summaryTitles);
  const full=audits(a,{detail:true}),printed=full.flatMap(x=>x.fields);
  for(const field of [...view.summary,...view.details]){
   const chunks=printed.filter(x=>x.title===field.title||x.title===field.title+'（續）');
   assert.ok(chunks.length,`${record.code} missing ${field.title}`);
   assert.equal(squeeze(chunks.map(x=>x.value).join('')),squeeze(field.value),`${record.code} truncated ${field.title}`);
  }
  for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){
   const candidate={code:record.code,report:input,kind,score:93,eligible:false};
   assert.deepEqual(R.view(C.evaluate(candidate)),view);
  }
  assert.equal(JSON.stringify(a),before);assert.ok(full.every(x=>x.noClipping));
 }
 D.reset();
});
test('2059 no-signal models retain observable weakness and independently report every condition',()=>{
 const record=fixture.records.find(x=>x.code==='2059');assert.ok(record);
 D.bind({map:new Map(fixture.snapshot.rows.map(q=>[q.code,q])),meta:fixture.snapshot.meta,snapshotRows:fixture.snapshot.rows.length});
 D.remember(record.daily,'2059');const a=C.evaluate(D.apply(record.full,'2059')),v=R.view(a);
 assert.equal(a.state,'OBSERVATION');assert.equal(v.stage,a.unifiedResearch.stageLabel);assert.equal(R.technicalOutlook(a).label,'短線偏弱');
 assert.match(v.details.find(x=>x.title==='技術現況').value,/低於MA20.*低於MA60.*下彎/);
 assert.match(v.summary[0].value,/短線偏弱/);
 assert.match(v.details.find(x=>x.title==='風險').value,/低於MA20/);
 for(const [key,m] of Object.entries(a.models)){
  const field=v.details.find(x=>x.title.startsWith('策略'+({A:'一',B:'二',C:'三',D:'四'}[key])+'｜'));
  assert.match(field.value,/已確認：.*\n未成立：.*\n待驗證：/);
  assert.ok(m.checks.some(x=>x.status==='FAIL'||x.status==='UNKNOWN'));
 }
 assert.match(v.details.find(x=>x.title==='研究A/B').value,/未符合|待驗證/);
 assert.doesNotMatch(v.details.find(x=>x.title==='研究A/B').value,/研究符合/);
 D.reset();
});
test('failed plus unknown dual checks cannot be presented as research match from a partial PASS',()=>{
 const a=C.evaluate(report()),b={...a,foundation:{...a.foundation,dualScanContext:{modeA:{checks:[{id:'RSI_GT_65',status:'PASS'},{id:'CHIP_GT_20',status:'UNKNOWN'}]},modeB:{checks:[{id:'RSI_GT_70',status:'PASS'},{id:'MA20_CLOSE_CROSS',status:'FAIL'}]}}}};
 const text=R.view(b).details.find(x=>x.title==='研究A/B').value;
 assert.match(text,/A 待驗證/);assert.match(text,/B 未符合：無新穿越/);assert.doesNotMatch(text,/研究符合/);
});
test('an indicator phase cannot replace the four-strategy situation in one output only',()=>{
 const a=C.evaluate(report()),b={...a,state:'BREAKOUT_FAILURE',compactStateLabel:'結構失敗',indicatorStudy:{...a.indicatorStudy,phase:'多頭續強'}};
 const v=R.view(b);assert.equal(v.stage,'結構失敗');
 assert.equal(v.details.find(x=>x.title==='目前行情階段').value,'結構失敗');
 assert.match(v.details.find(x=>x.title==='策略意見與衝突').value,/多頭續強.*結構失敗.*風險優先/);
 assert.ok(audits(b).every(x=>x.stage==='結構失敗'));
});
test('invalid bars do not get false completed models or invented K/D and levels',()=>{
 const a=C.evaluate({stock:'9001',name:'測試',market:'TWSE',closeDate:'2026-10-22',close:100,completed:true}),v=R.view(a);
 assert.equal(a.validation.technicalModelAvailable,false);assert.match(v.summary[0].value,/先不下單/);assert.match(v.summary[0].value,/日線還沒確認完整|日線只有|日線天數不足/);
 assert.ok(v.details.filter(x=>/^策略[一二三四]｜/.test(x.title)).every(x=>/無法判定/.test(x.value)));
 assert.match(v.details.find(x=>x.title==='關鍵支撐價位').value,/無法核驗/);
 assert.match(v.details.find(x=>x.title==='日週月週期研判').value,/資料不足/);
});
test('multiline condition lists remain whole paragraphs rather than regex-truncated CSV values',()=>{
 const a=C.evaluate(report(bars())),v=R.view(a),text=R.text(a);
 for(const field of v.details)assert.ok(text.includes(`【${field.title}】${field.value}`));
 assert.ok(v.details.some(x=>x.value.includes('\n')));
 assert.equal(new Set([...v.summary,...v.details].map(x=>x.title)).size,v.summary.length+v.details.length);
});

