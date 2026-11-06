'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../../structure-context-v1.js'),R=require('../../engulf-range-report-v1.js'),F=require('./engulf-range-fixtures.cjs');
const field=(v,title)=>v.fields.find(f=>f.title===title)?.value;
test('plain stock report explains signal-day versus later confirmation and retains exact evidence',()=>{
 const source=F.report(F.bullish()),research=S.confirmationResearch(source,{parameters:{confirmBars:4}}),before=JSON.stringify(research),a={code:source.stock,date:research.date,engulfRangeResearch:research};
 const v=S.confirmationView(research,a),imageView=R.view(a);
 assert.deepEqual(imageView.fields,v.fields);assert.equal(v.research,research);assert.equal(JSON.stringify(research),before);
 assert.match(field(v,'吞沒進度'),/當天.*還要等後續收盤/);assert.match(field(v,'收盤'),/漲過前一天最高價 21\.00/);
 const noBox={...research,range:null},next=field(S.confirmationView(noBox,a),'下一步');assert.match(next,/4個交易日/);assert.match(next,/21\.20/);assert.match(next,/19\.40/);
});
test('plain bearish wording keeps downside direction and body versus full-range distinction',()=>{
 const bearish=S.confirmationResearch(F.report(F.bearish())),v=S.confirmationView(bearish);
 assert.match(field(v,'K線型態'),/空頭吞沒（綠K吞紅K）/);assert.match(field(v,'收盤'),/跌破前一天最低價/);
 const body=S.confirmationResearch(F.report(F.bullish({full:false}))),bodyView=S.confirmationView(body);
 assert.match(field(bodyView,'K線型態'),/只包住開盤到收盤的實體/);assert.doesNotMatch(field(bodyView,'K線型態'),/全幅吞沒/);
});
test('plain missing-data explanation retains raw audit reason and never turns missing proof into confirmation',()=>{
 const source=F.report(F.bullish());source.priceAdjustment.corporateActionsVerified=false;
 const research=S.confirmationResearch(source),before=JSON.stringify(research),v=S.confirmationView(research);
 assert.equal(v.state,'DATA_INSUFFICIENT');assert.match(field(v,'結論'),/除權息、減資.*還沒核對完整/);assert.match(v.research.reason,/公司行動/);assert.equal(JSON.stringify(research),before);
 const wrong=S.confirmationView(research,{code:'2330',date:research.date});assert.match(field(wrong,'結論'),/股票或日期.*對不上/);
});
