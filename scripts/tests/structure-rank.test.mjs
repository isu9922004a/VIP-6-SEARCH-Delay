import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../../structure-reversal-core-v1.js');
const S=require('../../structure-reversal-scanner-v1.js');
const b=Array.from({length:75},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:100+(i*.06),high:102+(i*.06),low:99+(i*.06),close:101+(i*.06),volume:1e6}));
const e={signalDate:'2026-02-01',trigger:103,invalidation:98,confirmedNow:true,confirmedHistorically:true,state:'CONFIRMED'};
const r={gapTriggerPct:1.5,structureRiskPct:4.5};

test('same confirmed pattern score: a strong close with active volume out-ranks weak close and thin turnover in trade fitness',()=>{
 const good=b.map(x=>({...x})),weak=b.map(x=>({...x}));
 const old=good.at(-1);good[74]={...old,open:104,high:108,low:102,close:107.5,volume:1.5e6};
 weak[74]={...old,open:107,high:108,low:101,close:101.2,volume:.55e6};
 const g=C.tradeFitness('A',good,e,r,500e6),w=C.tradeFitness('A',weak,e,r,35e6);
 assert.ok(g.score>w.score,`${g.score}>${w.score}`);
 assert.ok(w.warnings.some(x=>x.includes('弱收盤')));
 assert.ok(w.warnings.some(x=>x.includes('成交金額')));
 assert.equal(g.parts.reduce((v,p)=>v+p.value,0),g.score);
});

test('short-term overheating is signaled separately without falsifying historical confirmation',()=>{
 const strong=b.map(x=>({...x}));
 const x=strong.at(-1);strong[74]={...x,open:107.9,high:114,low:107.5,close:113.9,volume:3e6};
 const fit=C.tradeFitness('A',strong,e,{...r,gapTriggerPct:9},900e6);
 assert.equal(fit.grade,'HIGH_RISK');
 assert.ok(fit.warnings.some(x=>x.includes('突破確認價')));
});

test('no made-up trade fitness when data are incomplete',()=>{
 const fit=C.tradeFitness('A',b,e,r,null);
 assert.equal(fit.grade,'DATA');
 assert.equal(fit.score,null);
});

test('confirmed top8 order follows independent short-term fitness, not raw historical score alone',()=>{
 const q={ordinaryVerified:false,provisional:true};
 const candidate=(code,raw,fit,grade='WATCHABLE')=>({code,name:code,mode:'A',eligible:false,confirmed:true,historicalConfirmed:true,status:'CONFIRMED',event:{signalDate:'2026-10-20',confirmedDate:'2026-10-21'},qualification:q,score:{total:raw},tradeFitness:{score:fit,grade},features:{tradeValue:400e6}});
 const a=candidate('1001',100,30,'WARNING'),better=candidate('1002',85,90),hot=candidate('1003',100,99,'HIGH_RISK'),missing=candidate('1004',99,null,'DATA');
 const s={pending:0,planned:4,attempted:4,stopped:false,breaker:null,issues:[],unparsed:0,audit:[q],results:{A:[a,better,hot,missing],B:[]}};
 S.finish(s);
 assert.deepEqual(s.modeResults.A.top8.map(x=>x.code),['1002','1001']);
 assert.deepEqual(s.modeResults.A.tradeRisk.map(x=>x.code),['1003']);
 assert.equal(s.modeResults.A.counts.confirmed,4);
 assert.deepEqual(s.modeResults.A.tradeData.map(x=>x.code),['1004']);
});

test('B watch and B falling are separate; neither can appear in confirmed top8',()=>{
 const q={ordinaryVerified:false,provisional:true};
 const candidate=(code,status)=>({code,name:code,mode:'B',eligible:false,confirmed:false,historicalConfirmed:false,status,event:{signalDate:'2026-10-22'},qualification:q,score:{total:45}});
 const s={pending:0,planned:2,attempted:2,stopped:false,breaker:null,issues:[],unparsed:0,audit:[q],results:{A:[],B:[candidate('2001','FALLING'),candidate('2002','WATCH')]}};
 S.finish(s);
 assert.deepEqual(s.modeResults.B.stabilizing.map(c=>c.code),['2002']);
 assert.deepEqual(s.modeResults.B.falling.map(c=>c.code),['2001']);
 assert.deepEqual(s.modeResults.B.top8,[]);
 const empty={...s,results:{A:[],B:[]}};S.finish(empty);
 assert.ok(S.text({...empty,model:'X',release:'RANK.1',date:'2026-10-22',createdAt:'2026-10-23',snapshotHash:'hash',universe:2,parsed:2,exclusionCounts:{}},'B').includes('B持續下跌警示'));
});

test('upstream recognized HISTORY_TOO_SHORT is data insufficiency, not an API/service outage',async()=>{
 const x={code:'2330',name:'測試',q:{market:'TWSE'},qualification:{ordinaryVerified:false,provisional:true}};
 const scan=await S.scan({plan:{date:'2026-10-22',items:[x],audit:[x.qualification],counts:{},parsed:1,universe:1,unparsed:0,snapshotHash:'unit'},release:'RANK.1',fetchBatch:async()=>({type:'MOMENTUM_DEEP_SCAN',results:[{code:'2330',ok:false,error:'DATA_HISTORY_GAP | HISTORY_TOO_SHORT'}]})});
 assert.equal(scan.issues[0].kind,'DATA');
 assert.equal(scan.modeResults.A.counts.data,1);
 assert.equal(scan.text.A.includes('服務失敗 0'),true);
 assert.equal(scan.text.A.includes('歷史資料缺漏 1'),true);
});

test('existing qualification and risk model revision is updated without changing core confirmation thresholds',()=>{
 const cfg=C.C;
 assert.equal(cfg.revision,'STRUCTURE-RANK.1');
 assert.equal(cfg.confirmVolumeA,1.2);
 assert.equal(cfg.confirmVolumeB,1.5);
 assert.equal(cfg.confirmBars,3);
});
