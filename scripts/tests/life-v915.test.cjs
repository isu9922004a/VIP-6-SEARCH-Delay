'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {observe,historyFields}=require('../../life-line-intelligence-v913');
const raw=require('../../data/research/2026-11-20/8039.json');
const market=require('../fixtures/taiex-20261120-v915.json');
const Market=require('../../market-life-report-v96');
const Stock=require('../../life-line-visual-v913');
const MarketPoster=require('../../market-life-visual-v913');
const Core=require('../../kline-life-03-core-v1');
const Report=require('../../kline-life-03-report-v1');
const Four=require('../../four-models-research-v1');

function model(closes,line=100){
 const bars=closes.map((close,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),open:close,close,low:close-1,high:close+1,volume:100-i}));
 const series=Object.fromEntries([5,10,20].map(n=>[n,closes.map((c,i)=>i+1<n?null:closes.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n)]));
 return {bars,close:closes.at(-1),line,event:{signalDate:bars[0].date},events:[],range:{low:Math.min(...bars.slice(-10).map(b=>b.low)),high:Math.max(...bars.slice(-10).map(b=>b.high))},maSeries:series,ma:Object.fromEntries(Object.entries(series).map(([n,s])=>[n,s.at(-1)])),trend:{state:'STRONG'}};
}
const prior=Array(25).fill(102);
for(const [name,tail,stage] of [
 ['跌破後續創新低，量縮', [99,97,94],'還在走弱'],
 ['低點暫穩',[90,91,91],'開始止跌觀察'],
 ['連兩日回升',[90,92,94],'正在反彈'],
 ['假反彈',[90,92,88],'還在走弱'],
 ['立即站回只有一天',[99,104],'方向還不明確'],
 ['站回後守住兩天',[99,104,105],'逐漸變強'],
 ['連續走強',[99,104,105,106],'持續走強']
]){
 test(name,()=>{const o=observe(model([...prior,...tail]),{});assert.equal(o.stage,stage);});
}
test('資料不足及逐日比較基準',()=>{
 assert.equal(observe(model([90,89]),{}).stage,'方向還不明確');
 const before=observe(model([...prior,99]),{}),after=observe(model([...prior,99,130,80]),{});
 assert.deepEqual(after.history.slice(0,before.history.length),before.history);
 assert.deepEqual(before.history.at(-1),{date:before.history.at(-1).date,maBreak:true,closedBelowLow:true,lowerLow:true});
 const intraday=model([...prior,102]);intraday.bars.at(-1).low=90;
 assert.equal(observe(intraday,{}).history.at(-1).closedBelowLow,false);
});
test('台虹及加權指數的原始欄位、價位順序、假日資料日',()=>{
 const stock=Report.inspect(Core.withSource(Four.evaluate(raw),raw));
 const index=Market.evaluate(market,{now:new Date('2026-11-21T04:00:00Z')});
 for(const [study,poster,high,close,date,line] of [[stock,Stock,183,175,'2026-11-17',181.5],[index,MarketPoster,43512.42,41040.08,'2026-11-16',41930.03]]){
  const m=poster.model(study),o=observe(m,{},study===index),row=historyFields(m,o).find(r=>r.label==='跌破');
  assert.deepEqual(row,{date,label:'跌破',field:'收盤價',value:close});
  assert.equal(m.bars.find(b=>b.date===date).high,high);
  assert.equal(m.date,'2026-11-20');assert.equal(m.line,line);
  assert.equal(o.stage,'還在走弱');assert.ok(o.targets.every((v,i)=>v>m.close&&(!i||v>o.targets[i-1])));
  assert.ok(o.scenarios.every(s=>s.text.startsWith('若')));
 }
});
test('大盤逐日成交股數與官方收據一致才啟用量比',()=>{
 const study=Market.evaluate(market,{now:new Date('2026-11-21T04:00:00Z')});
 function volume(s){return JSON.parse(MarketPoster.build(s,{document:{createElement(){}}})[0].dataset.marketLifeAudit).model.volume;}
 const v=volume(study);assert.equal(v.verified,true);assert.equal(v.ratio,v.last/v.average5);
 const changed=structuredClone(study);changed.indexSource.receipt.confirmedShares[study.date]++;
 assert.deepEqual(volume(changed),{verified:false,last:null,average5:null,ratio:null});
});
