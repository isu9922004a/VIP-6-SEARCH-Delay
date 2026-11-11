'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const engine=require(path.join(root,'research-v83/market-engine.js'));
const forecasts=require(path.join(root,'research-v83/forecast-engine.js'));
const report=require(path.join(root,'research-v83/market-simple-report.js'));
const history=require(path.join(root,'data/index/TAIEX.json'));
const inference=require(path.join(root,'data/kronos/TAIEX.json'));
const R=require('../../research-v86/market-regime.js');
const analysis=engine.analyze(history),forecast=forecasts.evaluate(analysis.input,inference);
const snapshot={analysis,forecast,source:{name:history.name,source:history.dailySeriesMeta.source}};
function fakeDocument(){
 const context={
  measureText(value){return {width:Array.from(String(value)).reduce((sum,c)=>sum+(/[ -~]/.test(c)?17:32),0)};},
  moveTo(){},lineTo(){},rect(){},clip(){},setLineDash(){},save(){},restore(){},setTransform(){},translate(){},rotate(){},beginPath(){},roundRect(){},fill(){},stroke(){},fillRect(){},fillText(){},
  set font(v){this._font=v;},get font(){return this._font;}
 };
 return {createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,dataset:{},getContext:()=>context,toBlob(cb){cb({size:1024,type:'image/png'});}};}};
}
test('official TAIEX history produces complete 1284x2778 independent PNG',()=>{
 assert.equal(analysis.state,'AVAILABLE');
 const output=report.model(snapshot),p=report.page(snapshot,{document:fakeDocument()}),audit=JSON.parse(p.dataset.researchAudit);
 assert.equal(output.date,history.closeDate);assert.equal(output.close,history.dailySeries.at(-1).close);
 assert.equal(p.width,1284);assert.ok(p.height>=2778&&p.height<=8192);assert.equal(audit.noClipping,true);
 assert.ok(audit.bodyBottom<=audit.safeBottom);assert.equal(audit.completeNarrative,true);
 assert.deepEqual(audit.levels,R.analyze(analysis.input,forecast).levels);assert.equal(audit.sections,7);assert.equal(audit.chart.chartReady,true);assert.ok(audit.chart.barCount>=63);
 assert.ok(output.blocks.some(b=>b.text.includes('① 下一交易日')));
 assert.ok(output.blocks.some(b=>b.text.includes('⑤ 明日三種可能走法')));
});
test('V8.7.2 market clean and watermark variants keep exactly the same analysis',()=>{
 const clean=report.model(snapshot,{watermarked:false});
 const watermarked=report.model(snapshot,{watermarked:true});
 assert.equal(clean.title,'大盤精簡分析');
 assert.equal(watermarked.title,'大盤精簡分析');
 assert.deepEqual(watermarked.blocks,clean.blocks);
 assert.deepEqual(watermarked.levels,clean.levels);
 assert.ok(clean.blocks.some(b=>b.text.includes('⑦ 一句話總結')));
 for(const mode of [false,true]){
  const canvas=report.page(snapshot,{document:fakeDocument(),watermarked:mode}),audit=JSON.parse(canvas.dataset.researchAudit);
  assert.equal(audit.watermarked,mode);
  assert.equal(audit.title,mode?watermarked.title:clean.title);
  assert.equal(audit.version,require('../../version-v50.js').displayCode);
  assert.equal(canvas.width,1284);assert.ok(canvas.height>=2778&&canvas.height<=8192);
  assert.equal(audit.noClipping,true);
 }
});
test('no valid Kronos means history-only, never invent sampled percentages',()=>{
 const without={...snapshot,forecast:{state:'UNAVAILABLE',reason:'尚未實跑'}};
 const reportModel=report.model(without),audit=JSON.parse(report.page(without,{document:fakeDocument()}).dataset.researchAudit);
 assert.equal(reportModel.modelRun,false);assert.equal(reportModel.nextTradeDate,null);
 assert.equal(audit.modelRun,false);
 assert.ok(reportModel.blocks.some(b=>b.text.includes('僅呈現歷史技術劇本')));
 assert.ok(reportModel.blocks.every(b=>!/偏多 \d+\.\d+%/.test(b.text)));
});
test('reject missing data, illustration, mismatched date and overflowing report',()=>{
 assert.throws(()=>report.model(null),/已核驗|完成/);
 assert.throws(()=>report.model({...snapshot,analysis:{...analysis,illustration:true}}),/示意/);
 assert.throws(()=>report.model({...snapshot,analysis:{...analysis,date:'2026-01-01'}}),/日期/);
 assert.throws(()=>report.page({...snapshot,source:{...snapshot.source,source:'TWSE來源'.repeat(2000)}},{document:fakeDocument()}),/安全範圍/);
});

