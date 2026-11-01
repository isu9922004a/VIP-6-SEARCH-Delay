'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../stock-professional-v84.js'),'utf8');
const sandbox={};vm.runInNewContext(source,sandbox,{filename:'stock-professional-v84.js'});
const {trendFor,shortTermFor,trendSummary,tone}=sandbox.ShitouProfessionalV84;
const base=()=>({close:100,closeDate:'2026-10-30',fib:{status:'forming'}});
const state=(above,slope,abc='forming')=>({nStatus:abc,nPhase:'WAIT_C',s:{maCtx:{value:above?95:105,slope:slope==='up'?1:slope==='down'?-1:0,above,slopeClass:{key:slope}}}});
const adapter=waveKey=>({label:'⚪ 階段待確認',sourceState:{waveKey,nStatus:'FORMING',nPhase:'WAIT_C'}});
const cases=[
 ['偏多',true,'up','MAIN_ADVANCE'],['強勢上行',true,'up','LATE_EXTENSION'],
 ['拉回整理',false,'up','UNDETERMINED'],['反彈觀察',true,'down','UNDETERMINED'],
 ['盤整',true,'flat','UNDETERMINED'],['弱勢整理',false,'flat','UNDETERMINED'],['偏空',false,'down','UNDETERMINED']
];
for(const [label,above,slope,wave] of cases)test('V8.4 verified trend '+label,()=>{
 const report=base(),before=JSON.stringify(report),result=trendFor(report,adapter(wave),state(above,slope));
 assert.equal(result.label,label);assert.equal(result.verified,true);
 assert.ok(result.detail.includes('ABC'));assert.equal(/階段待確認/.test(result.label),false);
 assert.equal(JSON.stringify(report),before,'trend presentation must not mutate analysis');
});
test('ABC not confirmed does not erase a verified bullish trend',()=>{
 assert.equal(trendFor(base(),adapter('UNDETERMINED'),state(true,'up','forming')).label,'偏多');
});
test('failed ABC does not erase independent medium-term MA20 context',()=>{
 const report=base(),stateFailed=state(true,'up','failed'),medium=trendFor(report,adapter('UNDETERMINED'),stateFailed);
 assert.equal(medium.label,'偏多');
 assert.equal(shortTermFor({...report,dailySeries:sequence([99,100,101,102,101,100])},medium,stateFailed).label,'結構受損');
});
test('insufficient daily MA or slope must not be guessed as consolidation',()=>{
 const report=base();
 for(const s of [null,{s:{maCtx:{value:95,above:true,slope:null,slopeClass:{key:'flat'}}}},state(true,'up')]){
  if(s?.s?.maCtx?.value===95&&s.s.maCtx.slope===1)report.closeDate='';
  assert.equal(trendFor(report,adapter('UNDETERMINED'),s).label,'資料不足');
 }
});
test('professional palette maintains 4.5:1 white background text contrast',()=>{
 const luminance=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 for(const [name,color] of Object.entries(tone))assert.ok(1.05/(luminance(color)+.05)>=4.5,name+' '+color+' contrast too low');
});

function sequence(prices,volumes=prices.map((_,i)=>2000+i*100)){
 return prices.map((close,i)=>({date:['2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'][i],close,volume:volumes[i]}));
}
test('6756 reference: MA20 bullish but short-term sharp decline below verified MA5',()=>{
 const report={close:120,closeDate:'2026-10-30',dailySeries:sequence([122,125,126,129.5,132.5,120],[1000,1700,2400,2600,3660,2195])};
 const medium=trendFor(report,adapter('UNDETERMINED'),state(true,'up'));
 const short=shortTermFor(report,medium,state(true,'up'));
 assert.equal(medium.label,'偏多');assert.equal(short.label,'急跌轉弱');
 assert.equal(short.ma5,126.6);assert.ok(Math.abs(short.changePct+9.43396)<.001);
 assert.ok(short.volumeChangePct< -39&&short.volumeChangePct> -41);
 const summary=trendSummary(medium,short);
 assert.ok(summary.includes('9.43%'));assert.ok(summary.includes('126.60'));assert.ok(summary.includes('日量較前日減40%'));
});
test('independent short state distinguishes improving, pullback, rebound and decline',()=>{
 const medium=trendFor(base(),adapter('UNDETERMINED'),state(true,'up'));
 for(const [prices,expected] of [
 [[90,93,95,98,100,105],'短線續強'],
 [[99,100,101,102,103,102],'回檔觀察'],
 [[105,105,105,105,103,104],'反彈觀察'],
 [[101,101,101,101,102,100],'短線轉弱'],
 [[110,110,110,110,100,100],'弱勢整理']
 ]){
  const report={close:prices[5],closeDate:'2026-10-30',dailySeries:sequence(prices)};
  assert.equal(shortTermFor(report,medium,state(true,'up')).label,expected,prices.join(','));
 }
});
test('short-term data mismatch, missing bars or unavailable previous close remain unknown',()=>{
 const medium=trendFor(base(),adapter('UNDETERMINED'),state(true,'up'));
 for(const r of [
  {close:120,closeDate:'2026-10-30',dailySeries:sequence([122,125,126,129.5,132.5,120]).slice(-5)},
  {close:120,closeDate:'2026-10-30',dailySeries:sequence([122,125,126,129.5,132.5,119])},
  {close:120,closeDate:'2026-10-29',dailySeries:sequence([122,125,126,129.5,132.5,120])},
  {close:120,closeDate:'2026-10-30',dailySeries:sequence([122,125,126,129.5,null,120])}
 ])assert.equal(shortTermFor(r,medium,state(true,'up')).label,'短線資料不足');
});
test('short-term ABC failure appears in short-term status without modifying medium term',()=>{
 const report={close:100,closeDate:'2026-10-30',dailySeries:sequence([99,100,101,102,101,100])};
 const mid=trendFor(report,adapter('UNDETERMINED'),state(true,'up','failed'));
 const short=shortTermFor(report,mid,state(true,'up','failed'));
 assert.equal(mid.label,'偏多');assert.equal(short.label,'結構受損');
});
