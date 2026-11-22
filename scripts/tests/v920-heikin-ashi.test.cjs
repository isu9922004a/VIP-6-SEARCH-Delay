'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const HA=require('../../heikin-ashi-life-v920.js');
function row(i,open,high,low,close){
 return {date:'2026-11-'+String(i+1).padStart(2,'0'),open,high,low,close};
}
test('V9.20 standard Heikin-Ashi open/close/high/low and color are deterministic',()=>{
 const s=HA.calculate([row(0,100,110,90,108),row(1,108,112,98,110)]);
 assert.equal(s[0].open,104);
 assert.equal(s[0].close,102);
 assert.equal(s[0].high,110);
 assert.equal(s[0].low,90);
 assert.equal(s[0].color,'綠K');
 assert.equal(s[1].open,103);
 assert.equal(s[1].close,107);
 assert.equal(s[1].high,112);
 assert.equal(s[1].low,98);
 assert.equal(s[1].color,'紅K');
});
test('V9.20 history is causal, stable, and never mutates real OHLC',()=>{
 const input=Array.from({length:30},(_,i)=>row(i,100+i,103+i,99+i,102+i));
 const original=JSON.stringify(input),first=HA.calculate(input);
 const longer=HA.calculate([...input,row(30,130,134,129,133)]);
 assert.deepEqual(first,longer.slice(0,first.length));
 assert.equal(JSON.stringify(input),original);
 assert.equal(first.at(-1).realClose,input.at(-1).close);
});
test('V9.20 rejects incomplete, duplicate, contradictory and unsorted bars',()=>{
 assert.throws(()=>HA.calculate([]),/資料不足/);
 assert.throws(()=>HA.calculate([row(0,100,110,90,108),row(0,100,111,89,108)]),/日期/);
 assert.throws(()=>HA.calculate([row(0,100,99,90,108)]),/不合理/);
 assert.throws(()=>HA.calculate([row(0,100,110,90,108),row(2,100,110,90,108),row(1,100,110,90,108)]),/日期/);
});
test('V9.20 signal is non-promissory and uses relative trend strength',()=>{
 const rising=Array.from({length:15},(_,i)=>row(i,100+i*3,104+i*3,100+i*3,103+i*3));
 const a=HA.classify(HA.calculate(rising));
 assert.ok(['BULL_STRENGTH','BULL_WEAKENING','UNCERTAIN'].includes(a.code),a.code);
 assert.doesNotMatch(a.description,/保證|一定賺|必漲/);
 const s=HA.calculate(rising);
 assert.equal(HA.classify(s.slice(0,4)).code,'INSUFFICIENT');
});
test('V9.20 appendix keeps originals untouched, research-only, 1284x2778',()=>{
 const input=Array.from({length:30},(_,i)=>row(i,100+i,104+i,99+i,102+i));
 const model={bars:input,date:input.at(-1).date,code:'8039',name:'台虹',close:input.at(-1).close,ma:{5:128},currentRole:'SUPPORT'};
 const ctx={measureText:s=>({width:String(s).length*22}),beginPath(){},roundRect(){},fillRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(){}};
 const doc={createElement:()=>({dataset:{},getContext:()=>ctx})};
 const p=HA.page({},model,{document:doc,release:'V9.20'});
 assert.equal(p.width,1284);assert.equal(p.height,2778);
 const audit=JSON.parse(p.dataset.heikinAshiAudit);
 assert.equal(audit.date,model.date);
 assert.equal(audit.page,4);assert.equal(audit.pages,4);
 assert.equal(audit.model.close,model.close);
 assert.equal(audit.affectsEligibility,false);
 assert.equal(audit.affectsRanking,false);
 assert.equal(audit.automaticTrade,false);
 assert.equal(p.renderExportRegion().height,2778);
 assert.match(p.filename,/V9\.20.*8039.*神奇K線/);
});

const taihongHistory=require('../../data/research/2026-11-20/8039.json').dailySeries.map(({date,open,high,low,close})=>({date,open,high,low,close}));
const taihongModel=(bars=taihongHistory)=>({bars,code:'8039',name:'台虹',date:bars.at(-1).date,close:bars.at(-1).close,currentRole:'BEAR'});
test('V9.21 real 8039 2026-11-20 archived input preserves HA signal and price risk',()=>{
 const input=taihongHistory,copy=JSON.stringify(input),r=HA.read({},taihongModel());
 assert.equal(r.date,'2026-11-20');
 assert.equal(r.realClose,137.5);
 assert.equal(r.ma5,165.3);
 assert.equal(r.support,152.5);
 assert.equal(r.resistance,315);
 assert.equal(r.priorDays,20);
 assert.equal(r.priceState,'BELOW_PRIOR_LOW');
 assert.ok(Math.abs(r.ma5GapPct+16.81790683605566)<1e-8);
 assert.ok(Math.abs(r.breakPct+9.836065573770492)<1e-8);
 assert.equal(r.signal.code,'BEAR_STRENGTH');
 assert.equal(r.signal.count,5);
 assert.deepEqual(r.series.slice(-5).map(x=>x.color),Array(5).fill('綠K'));
 assert.equal(JSON.stringify(input),copy,'read-only verification must not change archived OHLC');
});
test('V9.21 never mislabels 5-19 preceding days as a full 20-day reference',()=>{
 const short=taihongHistory.slice(-20),r=HA.read({},taihongModel(short));
 assert.equal(r.priorDays,19);
 assert.equal(r.ma5,165.3);
 assert.equal(r.support,null);
 assert.equal(r.resistance,null);
 assert.equal(r.priceState,'INSUFFICIENT');
 assert.match(r.risk,/資料不足/);
 const complete=HA.read({},taihongModel(taihongHistory.slice(-21)));
 assert.equal(complete.priorDays,20);
 assert.equal(complete.support,152.5);
 assert.equal(complete.priceState,'BELOW_PRIOR_LOW');
});
test('V9.21 independently distinguishes historical high breakout and in-range status',()=>{
 const bars=Array.from({length:21},(_,i)=>({date:'2026-11-'+String(i+1).padStart(2,'0'),open:100,high:120,low:80,close:100}));
 bars[bars.length-1]={date:'2026-11-21',open:130,high:135,low:125,close:130};
 const up=HA.read({},taihongModel(bars));
 assert.equal(up.priceState,'ABOVE_PRIOR_HIGH');
 assert.equal(up.resistance,120);
 assert.ok(up.breakPct>0);
 bars[bars.length-1]={date:'2026-11-21',open:100,high:105,low:85,close:100};
 const within=HA.read({},taihongModel(bars));
 assert.equal(within.priceState,'IN_RANGE');
 assert.equal(within.breakPct,null);
});
test('V9.21 real 8039 rendered report explicitly shows prior-window label and gap',()=>{
 const calls=[];
 const ctx={measureText:s=>({width:[...String(s)].length*18}),beginPath(){},roundRect(){},fillRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(s,x,y){calls.push({s:String(s),x,y});}};
 const document={createElement:()=>({dataset:{},getContext:()=>ctx})};
 const p=HA.page({},taihongModel(),{document});
 assert.equal(p.width,1284);assert.equal(p.height,2778);
 p.renderExportRegion();
 const all=calls.map(x=>x.s).join('\n');
 assert.match(all,/前20日低點（不含當日）/);
 assert.match(all,/距5日均價：-16\.82%/);
 assert.match(all,/已跌破前20日低點/);
 assert.match(all,/止跌觀察/);
 assert.match(all,/轉強觀察/);
 assert.ok(calls.every(x=>x.x>=0&&x.y>=0&&x.y<2778));
});
