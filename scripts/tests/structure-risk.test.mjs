import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {confirmedCandidate} from '../structure-confirmed-fixture.mjs';
const require=createRequire(import.meta.url);
const C=require('../../structure-reversal-core-v1.js');
const S=require('../../structure-reversal-scanner-v1.js');
const dates=[];let d=new Date('2026-03-02T00:00:00Z');while(dates.length<100){if(d.getUTCDay()>0&&d.getUTCDay()<6)dates.push(d.toISOString().slice(0,10));d=new Date(d.getTime()+86400000);}
const bar=(i,o=100,c=100.2,l=99.6,h=101.1,v=1000000)=>({date:dates[i],open:o,close:c,low:l,high:h,volume:v});
const base=()=>dates.map((_,i)=>bar(i));
const structure={midpoint:100,tolerance:1,sourceThrough:dates[78],levels:[{source:'MA20',value:100}],confluenceSources:['MA','PRICE_STRUCTURE']};
const seed=(mode,index=85)=>({mode,kind:mode==='A'?'BULL_PULLBACK':'SHRINKING_BEAR',signalIndex:index,signalDate:dates[index],ohlcv:bar(index),structure,baselineVolume:1000000,anchorVolumeRatio:.6,trigger:102,invalidation:95,fall10Pct:-15});
const scorer=(b,e,mode='A')=>{const s=C.structure(b.slice(0,-1),b.at(-1));const r=C.risk(b,e,s,mode);return {r,score:C.score(mode,b,e,s,r)};};

test('A: confirmation within 3 days and >5 completed bars without positive evidence becomes historical, not current',()=>{
 const b=base();b[85]=bar(85,99,100,98,102,.6e6);b[86]=bar(86,102,104,101,105,2e6);for(let i=87;i<b.length;i++)b[i]=bar(i,103.6,103.4,103.1,104,1e6);
 const fresh=C.follow(b.slice(0,87),seed('A'));assert.equal(fresh.confirmedNow,true);assert.equal(fresh.stale,false);
 const stale=C.follow(b,seed('A'));assert.equal(stale.confirmedHistorically,true);assert.equal(stale.stale,true);assert.equal(stale.confirmedNow,false);assert.equal(stale.state,'STALE_CONFIRMED');
 assert.match(C.lines({name:'測試',code:'2330',mode:'A',market:'TWSE',label:stale.label,qualification:{industry:'電子'},score:scorer(b,stale).score,event:stale,risk:scorer(b,stale).r}).join('\n'),/歷史確認逾期/);
});

test('A: recent long bearish close below moving averages triggers critical risk and lowers latest score',()=>{
 const b=base();b[98]=bar(98,100,102,99,103);b[99]=bar(99,102,96,95,103);
 const e={...seed('A',97),confirmedNow:true,confirmedHistorically:true,confirmedDate:dates[98],lastStrengthDate:dates[98],state:'CONFIRMED',confirmationRatio:2};
 const {r,score}=scorer(b,e);assert.equal(r.critical,true);assert.ok(score.total<score.historicalTotal);assert.ok(score.penalties.some(p=>p.name.includes('長黑')));assert.ok(score.penalties.some(p=>p.name.includes('MA20')));
});

test('B: mere oversold long black K is falling warning, never a confirmed reversal',()=>{
 const b=base();b[99]=bar(99,108,94,93,110,.6e6);const e=C.follow(b,seed('B',99));
 assert.equal(e.state,'FALLING');assert.equal(e.confirmedNow,false);assert.equal(e.confirmedHistorically,false);
 const {r,score}=scorer(b,e,'B');assert.match(r.label,/下跌警示/);assert.ok(score.total<=49);
});

test('B: weak and stronger reversal-watch candidates have different risk-adjusted scores',()=>{
 const b1=base();b1[99]=bar(99,108,94,93,110,.6e6);
 const b2=base();b2[99]=bar(99,104,99,98.5,105,.6e6);
 const e1=C.follow(b1,seed('B',99)),e2=C.follow(b2,seed('B',99));
 const a=scorer(b1,e1,'B').score,z=scorer(b2,e2,'B').score;
 assert.ok(a.total<z.total,`weak ${a.total} < less-weak ${z.total}`);
});

test('B: first sign of stabilization remains watch; still not breakout-confirmed',()=>{
 const b=base();b[97]=bar(97,101,98,96,102,.6e6);b[98]=bar(98,98,99.5,97,100,.9e6);b[99]=bar(99,99.5,100,98,101,.8e6);
 const e=C.follow(b,seed('B',97));assert.equal(e.state,'WATCH');assert.equal(e.confirmedNow,false);
 assert.match(C.risk(b,e,C.structure(b.slice(0,-1),b.at(-1)),'B').label,/止跌觀察/);
});

test('B: true bullish high close + volume can still confirm, no thresholds loosened',()=>{
 const b=base();b[97]=bar(97,101,98,96,102,.6e6);b[98]=bar(98,102.5,104.5,102.1,105,1.8e6);b[99]=bar(99,104.5,106,103,107,1.1e6);
 const e=C.follow(b,seed('B',97));assert.equal(e.confirmedNow,true);assert.equal(e.confirmedDate,dates[98]);
});

test('ranking and top8: stale and critical-risk historical confirmations never mix with current confirmed',()=>{
 const qual={ordinaryVerified:false,provisional:true};
 const good=confirmedCandidate({code:'1001',event:{signalDate:dates[97],confirmedDate:dates[98]},score:{total:65},qualification:qual});
 assert.equal(C.top8Decision(good).allowed,true);assert.equal(C.top8Decision(good).researchOnly,true);
 const critical={code:'1002',eligible:false,confirmed:false,historicalConfirmed:true,status:'CONFIRMED',event:{signalDate:dates[97],confirmedDate:dates[98]},score:{total:95},qualification:qual};
 const stale={code:'1003',eligible:false,confirmed:false,historicalConfirmed:true,status:'STALE_CONFIRMED',event:{signalDate:dates[85],confirmedDate:dates[86],stale:true},score:{total:100},qualification:qual};
 const falling={code:'1004',eligible:false,confirmed:false,historicalConfirmed:false,status:'FALLING',event:{signalDate:dates[99]},score:{total:45},qualification:qual};
 const s={pending:0,planned:4,attempted:4,stopped:false,breaker:null,issues:[],unparsed:0,audit:[qual],results:{A:[good,critical,stale,falling],B:[]}};
 S.finish(s);assert.deepEqual(s.modeResults.A.top8.map(c=>c.code),['1001']);assert.deepEqual(s.modeResults.A.review.map(c=>c.code),['1002']);assert.deepEqual(s.modeResults.A.historic.map(c=>c.code),['1003']);assert.deepEqual(s.modeResults.A.watch.map(c=>c.code),['1004']);
});
