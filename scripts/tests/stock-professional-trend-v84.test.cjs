'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../stock-professional-v84.js'),'utf8');
const sandbox={};vm.runInNewContext(source,sandbox,{filename:'stock-professional-v84.js'});
const {trendFor,tone}=sandbox.ShitouProfessionalV84;
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
test('failed ABC is distinct from overall 20MA slope and trading eligibility',()=>{
 const report=base(),stateFailed=state(true,'up','failed');
 assert.equal(trendFor(report,adapter('UNDETERMINED'),stateFailed).label,'結構受損');
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
