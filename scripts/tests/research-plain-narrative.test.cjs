'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../four-models-research-v1.js'),O=require('../../research-opening-plan-v1.js'),R=require('../../research-report-v1.js');
const fixture=require('../fixtures/plain-narrative-20261030.json'),{report}=require('../research-fixtures.cjs');
function actual(code='8039'){const r=fixture.records[code];return C.evaluate(report(structuredClone(r.bars),{stock:r.stock,name:r.name,market:r.market}));}
const clone=x=>structuredClone(x);
test('weak-price summary uses the actual daily average and preserves a small slope as a small move',()=>{
 const a=actual(),v=R.view(a);assert.match(v.summary[0].value,/收盤245 元.*低於最近20個交易日平均287.8 元/);assert.match(v.summary[0].value,/略往下/);assert.doesNotMatch(v.summary[0].value,/大幅|MA20|14.87%/);
 assert.match(v.details.find(x=>x.title==='現在的股價，用白話怎麼看').value,/14.87%.*3個交易日前減少0.09%/);
});
test('yesterday volume and prior-five-session mean remain distinct and do not imply a washout',()=>{
 const a=actual(),x=O.plainContext(a);assert.match(x.volumeShort,/昨天少約13%.*收盤仍近低點/);assert.match(x.volumeDetail,/昨天少13.19%.*前5天平均的0.47倍.*不含今天/);assert.match(x.volumeDetail,/不能直接確認洗盤或出貨/);
 const v=R.view(a);assert.match(v.summary[4].value,/253 元.*收盤站上/);assert.equal(a.openingPlan.entryRange,null);assert.doesNotMatch(v.summary.map(x=>x.value).join(''),/洗盤完成|主力買進|即將大漲/);
});
test('rising-average pullbacks and strong closes do not inherit the weak-close wording',()=>{
 const a=clone(actual());a.features.ma[20].slope=.3;assert.match(O.plainContext(a).direction,/平均價仍往上，但股價還沒站回/);
 const strong=actual('7704'),v=R.view(strong);assert.match(O.plainContext(strong).volumeShort,/多約126%.*接近高點/);assert.doesNotMatch(v.summary[1].value,/站回/);assert.doesNotMatch(v.summary[4].value,/站回/);assert.doesNotMatch(v.summary[0].value,/🟢/);
});
test('unverified or conflicting volume cannot acquire a numerical volume story',()=>{
 for(const status of ['UNKNOWN','CONFLICT']){const a=clone(actual());a.unifiedResearch.structureContext.volume={...a.unifiedResearch.structureContext.volume,status,usable:false};const x=O.plainContext(a);assert.equal(x.volumeVerified,false);assert.doesNotMatch(x.volumeShort+x.volumeDetail,/13%|0.47倍|量縮|主力買進/);assert.match(x.volumeDetail,/尚未|對齊/);}
});
test('missing or mismatched price data cannot become a factual price narrative',()=>{
 const a=clone(actual());a.features.ma[20]={value:null,slope:null};assert.equal(O.plainContext(a).direction,'');a.validation.technicalModelAvailable=false;assert.equal(O.plainContext(a),null);a.validation.technicalModelAvailable=true;a.date='2026-10-29';assert.equal(O.plainContext(a),null);
});
test('unverified history keeps the data-first summary despite a computable trend',()=>{
 const a=clone(actual());a.unifiedResearch.chart.basisVerified=false;a.openingPlan=O.evaluate(a);const v=R.view(a);assert.equal(a.openingPlan.state,'DATA');assert.match(v.summary[0].value,/先不下單/);assert.doesNotMatch(v.summary[0].value,/最近20天平均/);assert.doesNotMatch(v.summary[4].value,/昨天少約13%/);
});
test('presentation leaves the analysis, plan, states, prices and original summary fields untouched',()=>{
 const a=actual(),before=JSON.stringify(a),prior=Array.from({length:5},(_,i)=>({title:String(i),value:'old'})),original=JSON.stringify(prior);O.summary(a.openingPlan,prior,a);R.view(a);assert.equal(JSON.stringify(a),before);assert.equal(JSON.stringify(prior),original);assert.equal(R.view(a).summary.length,5);
});

test('a blocked 8039 plan labels historical references without implying entry, reduction or universal stops',()=>{
 const a=actual(),v=R.view(a),text=v.summary.map(x=>x.value).join('\n');
 assert.equal(a.openingPlan.entryRange,null);assert.match(v.summary[1].value,/碰到觀察價不等於買點.*尚無符合條件/);
 assert.match(v.summary[2].value,/上方參考關卡：254 元/);assert.match(v.summary[2].value,/防守試算：243 元.*不是統一賣出價/);
 assert.doesNotMatch(text,/第一減碼|若買進後跌到|漲到要買回|放空觀察區間|🟢/);
 assert.match(v.summary[4].value,/當日低點243.5 元/);assert.match(v.guideNote,/依標示日期的收盤資料.*非即時/);
});

test('short research stays in its own detail section with unconfirmed borrow and no executable order',()=>{
 const v=R.view(actual()),short=v.details.find(x=>x.title==='空方情境｜尚未成立可執行計畫');
 assert.ok(short);assert.match(short.value,/獨立的空方試算.*不能和多方/);assert.match(short.value,/單次跌破不等於放空訊號/);
 assert.match(short.value,/240.5 元～243 元/);assert.match(short.value,/空單停損試算 257 元/);assert.match(short.value,/券源、放空資格與借券費尚未確認/);
 assert.doesNotMatch(v.summary.map(x=>x.value).join(''),/放空|空單|257 元|240.5 元/);
});

function conditional(){
 const a=clone(actual());a.state='BREAKOUT_LAUNCH';a.entryDirection.entry='EVALUATE';a.entryDirection.direction={code:'BULL',label:'偏多'};a.features.ma[20].value=200;
 a.unifiedResearch.levels=[{price:300,source:'已確認高點'}];a.unifiedResearch.scenarios=[{applicable:true,signalStatus:'CONFIRMED',riskDecision:'ACCEPTABLE_FOR_EVALUATION',triggerPrice:245,riskReward:{status:'KNOWN',stop:243}}];
 a.openingPlan=O.evaluate(a);return a;
}
const planView=a=>({summary:O.summary(a.openingPlan,Array.from({length:5},()=>({value:''})),a),details:O.details(a.openingPlan)});
test('qualified plans retain their own entry, stop and target but require the actual intraday confirmation',()=>{
 const a=conditional(),p=a.openingPlan,v=planView(a);assert.equal(p.state,'CONDITIONAL');assert.ok(p.entryRange);
 assert.match(v.summary[0].value,/盤後條件通過，仍須盤中確認/);assert.ok(v.summary[1].value.includes(p.entryRange.low+' 元～'+p.entryRange.high+' 元'));
 assert.match(v.summary[2].value,/本次新買計畫：停損試算243 元；減碼參考256.5 元/);
 const open=O.atOpen(p,p.entryRange.low);assert.equal(open.state,'WAIT_CONFIRMATION');assert.match(open.text,/至少一根5分鐘K.*回落守住.*越過前一根5分鐘K高點/);assert.match(open.text,/本頁沒有即時5分鐘行情/);
 assert.match(v.details.find(x=>x.title==='下一交易日開盤怎麼判斷').value,/先等至少一根5分鐘K/);
});

test('a calculable price interval without direction confirmation never becomes an active buying plan',()=>{
 const a=conditional();a.entryDirection.entry='WAIT';a.openingPlan=O.evaluate(a);const p=a.openingPlan,v=planView(a);assert.equal(p.state,'WAIT');assert.ok(p.entryRange);
 assert.match(v.summary[1].value,/尚無符合條件的新買進計畫/);assert.doesNotMatch(v.summary[2].value,/減碼參考|本次新買計畫/);
 assert.match(O.atOpen(p,p.entryRange.low).text,/盤後條件尚未完成，目前沒有成立的新買進計畫/);
 assert.doesNotMatch(v.details.find(x=>x.title==='下一交易日開盤怎麼判斷').value,/才在這個範圍內評估/);
});

test('failed structures keep the cancellation visible even when a price interval remains calculable',()=>{
 const a=conditional();a.state='BREAKOUT_FAILURE';a.openingPlan=O.evaluate(a);const v=planView(a);assert.ok(a.openingPlan.entryRange);assert.equal(a.openingPlan.state,'NO_TRADE');
 assert.match(v.summary[0].value,/原買進理由已失效/);assert.match(v.summary[1].value,/尚無符合條件的新買進計畫/);assert.match(v.summary[4].value,/先等新的條件形成/);
 assert.doesNotMatch(v.summary.map(x=>x.value).join(''),/本次新買計畫|才評估/);
});

test('data failures suppress trial levels and price stories instead of turning them into orders',()=>{
 const a=clone(actual());a.unifiedResearch.chart.basisVerified=false;a.openingPlan=O.evaluate(a);const v=R.view(a);
 assert.equal(a.openingPlan.state,'DATA');for(const field of v.summary.slice(1))assert.doesNotMatch(field.value,/253 元|254 元|243 元|13%/);
 assert.match(v.summary[2].value,/暫不列防守與上方價位/);assert.match(v.details.find(x=>x.title==='空方情境｜尚未成立可執行計畫').value,/暫不列空方價位/);
});

test('the opening calculator never tells existing holders to sell from a blocked new-entry trial',()=>{
 const a=actual(),x=O.atOpen(a.openingPlan,243);assert.equal(x.state,'CANCEL');assert.match(x.text,/沒有成立的新買進計畫.*不是既有持股的賣出指令/);
 assert.doesNotMatch(x.text,/按計畫賣出|要賣出|原買進計畫取消/);
});
