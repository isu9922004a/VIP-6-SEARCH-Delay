'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const U=require('../../research-common-v1.js'),C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js'),D=require('../../selection-data-v2.js'),Tower=require('../../tower-trend-classifier.js'),Structure=require('../../structure-reversal-core-v1.js');
const {fixture9933}=require('../research-v822-fixture.cjs');
function core(a){return {state:a.state,models:a.models,features:a.features,families:a.families,risks:a.risks,researchBreakoutPrice:a.researchBreakoutPrice,researchInvalidation:a.researchInvalidation,dataQuality:a.dataQuality,foundation:a.foundation};}
function bind(r){const z=r.canonicalBars.at(-1),date=r.marketDate;D.reset();D.bind({map:new Map([[r.stock,{...z,market:r.market,code:r.stock,name:r.name,quoteDate:date}]]),snapshotRows:1,meta:{total:1,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true}});}
test('9933 / 2026-10-22 SYNTHETIC: seven entry envelopes share identical technical research',()=>{
 const r=fixture9933(),a=C.evaluate(r);assert.equal(a.date,'2026-10-22');
 for(const kind of ['MAIN','DAYTRADE','STRONG','TOWER','RESTAURANT','STRUCTURE_A','STRUCTURE_B']){
  const row={code:r.stock,date:r.marketDate,kind,report:r,rsiObservationSource:{stock:r.stock,closeDate:r.marketDate,dailyRsi5:74.82}};
  assert.deepEqual(core(C.evaluate(row)),core(a),kind);
 }
});
test('RSI-only observation never hides the full OHLCV, units, calendar or external evidence',()=>{
 const r=fixture9933();r.researchSources={sentinel:'kept'};
 const n=U.normalizeInput({code:'9933',report:r,rsiObservationSource:{dailyRsi:80}});
 assert.equal(n.canonicalBars,r.canonicalBars);assert.equal(n.researchSources,r.researchSources);assert.equal(n.volumeUnit,'shares');assert.ok(C.evaluate(n).models.A);
});
test('actual tower result owns its full research source',()=>{
 const r=fixture9933(),out=Tower.analyze(r,{asOf:r.marketDate,completed:true});
 assert.ok(out.researchSource);assert.deepEqual(core(C.evaluate(out)),core(C.evaluate(r)));
});
test('actual structure A and B results own full research input without changing eligibility',()=>{
 const r=fixture9933();for(const mode of ['A','B']){
  const out=Structure.evaluate(r,{mode,qualification:{excluded:false,ordinaryVerified:true,reasons:[]},asOf:r.marketDate});
  assert.ok(out.researchSource);const before=JSON.stringify(out);assert.deepEqual(core(C.evaluate(out)),core(C.evaluate(r)));assert.equal(JSON.stringify(out),before);
 }
});
test('original B, research breakout and independent invalidation retain formulas and sources',()=>{
 const a=C.evaluate(fixture9933());assert.equal(a.originalB,120);assert.notEqual(a.researchBreakoutPrice,120);
 assert.notEqual(a.researchInvalidation,90);assert.match(a.priceLevels.researchBreakout.formula,/t-20/);assert.equal(a.priceLevels.originalB.verified,false);
 assert.match(R.text(a),/研究失效/);assert.match(R.text(a),/原策略失效 90.00/);
});
test('missing B is explicitly unavailable; never copied from research breakout',()=>{
 const r=fixture9933();delete r.originalB;const a=C.evaluate(r);assert.equal(a.originalB,null);assert.match(R.text(a),/原策略B價未提供／不適用/);
});
test('price+RSI without bars cannot claim model completion or verified risk absence',()=>{
 const a=C.evaluate({stock:'9933',name:'中鼎',market:'TWSE',closeDate:'2026-10-22',completed:true,close:44.65,dailyRsi5:74.82});
 assert.equal(a.validation.technicalModelAvailable,false);assert.equal(a.validation.historyBarCount,0);assert.deepEqual(a.models,{});
 assert.match(R.text(a),/完成日K/);assert.doesNotMatch(R.text(a),/暫無額外警訊|未啟用/);
});
test('short history preserves calculable RSI and marks MA20 / MA60 UNKNOWN',()=>{
 const a=C.evaluate(fixture9933(15));assert.ok(a.features.rsi5!==null);assert.equal(a.features.ma[20].value,null);assert.equal(a.features.ma[60].value,null);
 assert.equal(a.models.A.checks[0].status,'UNKNOWN');assert.equal(a.validation.validationStatus,'HISTORY_INSUFFICIENT');assert.match(R.text(a),/15\/60|15根/);
});
test('missing chips and revenues stay UNKNOWN while technical models remain available',()=>{
 const a=C.evaluate(fixture9933());assert.equal(a.validation.technicalModelAvailable,true);assert.equal(a.validation.externalEvidenceAvailable,false);
 for(const id of ['D3','D4','D5'])assert.equal(a.models.D.checks.find(x=>x.id===id).status,'UNKNOWN');assert.match(R.text(a),/外部條件未完整核驗/);
});
for(const [name,mutate,reason] of [
 ['date mismatch',r=>r.dataDate='2026-10-21',/行情日期/],
 ['wrong identity',r=>r.code='2330',/代號/],
 ['unknown market',r=>r.market='UNKNOWN',/市場別/],
 ['unknown volume unit',r=>{r.volumeUnit='unknown';r.dailySeriesMeta.volumeUnit='unknown';},/成交量單位/],
 ['unfinished day',r=>r.completed=false,/完成日K/],
 ['unfinished bar',r=>r.canonicalBars.at(-1).completed=false,/完成狀態/],
 ['other ticker in bars',r=>r.canonicalBars[0].code='2330',/其他股票/],
 ['unresolved action',r=>r.corporateActionUnresolved=true,/價格還原/]
])test(`invalid ${name}: stop dependent models and explain why`,()=>{const r=fixture9933();mutate(r);const a=C.evaluate(r);assert.equal(a.state,'INSUFFICIENT_DATA');assert.deepEqual(a.models,{});assert.match(a.reason,reason);assert.equal(a.validation.validationStatus,'BASE_DATA_INVALID');});
test('mismatched RSI stock/date cannot silently replace evidence',()=>{
 const r=fixture9933();const a=C.evaluate({report:r,rsiObservationSource:{stock:'2330',closeDate:r.closeDate}});assert.deepEqual(a.models,{});assert.match(a.reason,/RSI觀察/);
});
test('a candidate ticker cannot manufacture missing report identity; empty canonical arrays do not hide real daily history',()=>{
 const r=fixture9933(),bad={...r};delete bad.stock;delete bad.code;
 assert.equal(C.evaluate({code:'9933',report:bad}).validation.technicalModelAvailable,false);
 assert.deepEqual(core(C.evaluate({...r,canonicalBars:[]})),core(C.evaluate(r)));
});
test('canonical ensure obtains DAILY_ONLY once and rejects same-code stale reports',async()=>{
 const r=fixture9933();bind(r);let calls=0;D.setFetcher(async items=>{calls++;assert.equal(items[0].code,'9933');return {type:'MOMENTUM_DEEP_SCAN',results:[{ok:true,code:'9933',data:r}]};});
 await D.ensure([{code:'9933'}]);await D.ensure([{code:'9933'}]);assert.equal(calls,1);assert.equal(D.apply(r,'9933').canonicalBars.length,130);
 assert.throws(()=>D.apply({...r,closeDate:'2026-10-21'},'9933'),/日期不符/);D.reset();
});
test('snapshot change during in-flight DAILY_ONLY cannot poison another day cache',async()=>{
 const r=fixture9933();bind(r);let release;D.setFetcher(()=>new Promise(resolve=>release=resolve));
 const pending=D.ensure([{code:'9933'}]);D.reset();release({type:'MOMENTUM_DEEP_SCAN',results:[{ok:true,code:'9933',data:r}]});
 await assert.rejects(pending,/快照已改變/);assert.equal(D.get('9933'),null);
});
test('shared canonical cache rejects unknown volume units and mixed ticker rows before reconciliation',()=>{
 const r=fixture9933();bind(r);
 for(const bad of [{...r,volumeUnit:'unknown'},{...r,dailySeriesMeta:{...r.dailySeriesMeta,volumeUnit:'lots'}},{...r,dataDate:'2026-10-21'}])assert.throws(()=>D.remember(bad,'9933'),/單位|日期/);
 const other=structuredClone(r);other.canonicalBars[0].stock='2330';assert.throws(()=>D.remember(other,'9933'),/代號/);assert.equal(D.get('9933'),null);D.reset();
});
test('both images keep identical section order/core content, no independent metric cards',()=>{
 const a=C.evaluate(fixture9933()),ctx={font:'',measureText(s){const px=Number(this.font.match(/(\d+)px/)?.[1]||56);return {width:[...String(s)].length*px};}},document={createElement:()=>({getContext:()=>ctx})};
 const filter=R.pages(a,{document}),stock=R.pages(a,{document,stockMode:true});assert.equal(filter.length,stock.length);
 for(let i=0;i<filter.length;i++){const x=JSON.parse(filter[i].dataset.researchAudit),y=JSON.parse(stock[i].dataset.researchAudit);assert.deepEqual(x.summary,y.summary);assert.equal(x.width,1284);assert.equal(x.height,2778);assert.ok(x.noClipping&&y.noClipping);assert.doesNotMatch(x.summary.join('\n'),/【個股收盤】|【日RSI5】|【日MA20】|【報價來源】/);}
});
test('extremely long missing-data explanations paginate without shrinking type or clipping',()=>{
 const a=C.evaluate(fixture9933());const long={...a,validation:{...a.validation,technicalModelAvailable:false},dataQuality:{complete:false,missing:['具體缺漏原因'.repeat(2500)]}};
 const ctx={font:'',measureText:s=>({width:[...String(s)].length*56})},document={createElement:()=>({getContext:()=>ctx})};
 const pages=R.pages(long,{document,detail:true});assert.ok(pages.length>3);for(const p of pages){const x=JSON.parse(p.dataset.researchAudit);assert.ok(x.noClipping);assert.equal(x.minFont,56);}
});
