import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const C=require('../../structure-reversal-core-v1.js');
const S=require('../../structure-reversal-scanner-v1.js');
const repoText=fs.readFileSync(path.join(ROOT,'structure-reversal-report-v1.js'),'utf8');
const qualified={ordinaryVerified:true,provisional:false};
function mk(code,state='WATCH',extra={}){
 const event={state,signalDate:'2026-10-21',signalIndex:69,age:1,trigger:102,invalidation:94,failedDate:null,stale:false,confirmedNow:false,confirmedHistorically:false,ohlcv:{open:105,high:106,low:94,close:95,volume:100000},midpoint:{state:'NOT_RECLAIMED',level:100,sourceThrough:'2026-10-20',history:[],labels:{NOT_RECLAIMED:'尚未站回'}},structure:{confluenceSources:[]},history:[{date:'2026-10-21',state:'FALLING'},{date:'2026-10-22',state}]};
 return {code,name:'測試'+code,mode:'B',date:'2026-10-22',market:'TWSE',eligible:false,confirmed:false,historicalConfirmed:false,score:{total:55},status:state,label:state==='WATCH'?'止跌觀察（未突破）':'下跌警示（未止跌）',event,qualification:qualified,quality:{source:'DAILY_ONLY',basisVerified:false},monthlyStatus:'UNAVAILABLE',warnings:['價格基準待驗證'],tradeFitness:{grade:'WATCHABLE',score:null,warnings:[]},risk:{gapTriggerPct:-3.1,structureRiskPct:4.8,currentWarnings:[],reasons:[]},structure:{midpoint:100,low:90,high:110,sourceThrough:'2026-10-21',fib:[]},features:{close:99,volumeRatio5:1.05,ma20:110,tradeValue:65000000,candle:{position:.7,longBear:false,weak:false},rsi5:31},...extra};
}
function sample(){const w=mk('5001'),w2=mk('5002','WATCH',{score:{total:42}}),f=mk('5003','FALLING'),exp=mk('5004','EXPIRED',{event:{...mk('5004').event,state:'EXPIRED',age:3}}),failed=mk('5005','WATCH',{event:{...mk('5005').event,failedDate:'2026-10-22'}}),longBear=mk('5006','WATCH',{features:{...mk('5006').features,candle:{position:.1,longBear:true,weak:true}}});const s={model:'STRUCTURE_REVERSAL_V1',date:'2026-10-22',release:'FIXPACK.2-LINESHARE.1-BPREWATCH.1',createdAt:'2026-10-24',pending:0,planned:6,attempted:6,stopped:false,breaker:null,issues:[],unparsed:0,universe:6,parsed:6,audit:[qualified],exclusionCounts:{},results:{A:[],B:[w,w2,f,exp,failed,longBear]},snapshotHash:'test'};return S.snapshot(s);}
function reportFixture(){const drawing=[];const ctx={font:'',textAlign:'left',fillStyle:'',fillRect(...x){drawing.push(['rect',...x]);},fillText(...x){drawing.push(['text',...x]);},setTransform(){},measureText(value){return {width:String(value).length*10}}};const root={document:{fonts:{ready:Promise.resolve()},createElement(tag){assert.equal(tag,'canvas');return {width:1284,height:2778,dataset:{},getContext:()=>ctx,toBlob:cb=>cb({size:123456,type:'image/png'})};}},navigator:{userAgent:'desktop'},ShitouStructureCore:C,ShitouStructureScanner:S};vm.runInNewContext(repoText,root);return {root,drawing};}
test('only finished-day B WATCH evidence enters separate prewatch, not continuing drops',()=>{
 const s=sample();assert.deepEqual(s.modeResults.B.prewatch.map(c=>c.code),['5001','5002']);assert.equal(s.modeResults.B.counts.prewatch,2);
 assert.deepEqual(s.modeResults.B.falling.map(c=>c.code),['5003']);assert.equal(s.modeResults.B.top8.length,0);assert.equal(s.modeResults.B.formal.length,0);
 assert.equal(S.assertSnapshot(s),s);assert.match(s.text.B,/B止跌準備榜/);assert.match(s.text.B,/急跌觀察起點/);
 assert.doesNotMatch(s.text.A,/B止跌準備榜/);
});
test('B prewatch does not change original confirmation window, rank formula or other modes',()=>{
 assert.equal(C.C.confirmBars,3);assert.equal(C.C.confirmVolumeB,1.5);assert.equal(C.C.top8.minVolumeRatio5,.8);
 for(const state of ['FALLING','INVALID','FAILED','EXPIRED','CONFIRMED'])assert.equal(C.bPrewatchDecision(mk('5007',state)).allowed,false,state);
 assert.equal(C.bPrewatchDecision(mk('5001')).allowed,true);
 assert.equal(C.bPrewatchDecision(mk('5008','WATCH',{features:{...mk('5008').features,close:93}})).allowed,false);
 assert.equal(C.bPrewatchDecision(mk('5009','WATCH',{event:{...mk('5009').event,age:3}})).allowed,false);
 assert.equal(C.bPrewatchDecision(mk('5010','WATCH',{event:{...mk('5010').event,history:[]}})).allowed,false);
});
test('B prewatch exports exactly one iPhone card, rejects A and refuses absent list',()=>{
 const s=sample(),{root,drawing}=reportFixture(),out=root.ShitouStructureReport.pages(s,{mode:'B',kind:'prewatch'});
 assert.equal(out.length,1);assert.equal(out[0].width,1284);assert.equal(out[0].height,2778);
 const audit=JSON.parse(out[0].dataset.structureOverviewAudit);assert.equal(audit.count,2);assert.equal(audit.mode,'B');assert.equal(audit.kind,'prewatch');assert.deepEqual(Array.from(audit.codes),['5001','5002']);
 const text=JSON.parse(decodeURIComponent(out[0].dataset.reportText));assert.ok(text.some(t=>t.includes('急跌觀察起點')));
 assert.ok(audit.blocks.every(b=>b.lines.some(l=>l.fullText.includes('仍未放量突破'))));
 assert.equal(audit.blocks[0].fields[2][0],'距突破關卡');assert.equal(audit.blocks[0].fields[2][1],'3.03%');
 let blob;out[0].toBlob(b=>blob=b);assert.ok(blob?.size>0);
 const tile=out[0].renderExportRegion({top:0,height:100,scale:.5});assert.equal(tile.width,642);assert.equal(tile.height,50);
 assert.throws(()=>root.ShitouStructureReport.pages(s,{mode:'A',kind:'prewatch'}),/只適用B/);
 const s0=S.snapshot({...JSON.parse(JSON.stringify(s)),results:{A:[],B:[mk('5003','FALLING')]}});
 assert.equal(s0.modeResults.B.prewatch.length,0);assert.throws(()=>root.ShitouStructureReport.pages(s0,{mode:'B',kind:'prewatch'}),/尚無初步止跌證據/);
 assert.ok(drawing.some(x=>x[0]==='text'&&String(x[1]).includes('止跌準備')));
});
test('full TXT keeps all B preparation candidates even when single-card picture shows only first eight',()=>{
 const rows=Array.from({length:11},(_,i)=>mk(String(5100+i),'WATCH',{score:{total:70-i}}));
 const base={model:'STRUCTURE_REVERSAL_V1',date:'2026-10-22',release:'BPREWATCH.1',createdAt:'2026-10-24',pending:0,planned:11,attempted:11,stopped:false,breaker:null,issues:[],unparsed:0,universe:11,parsed:11,audit:[qualified],exclusionCounts:{},results:{A:[],B:rows},snapshotHash:'test'};
 const snap=S.snapshot(base);
 assert.equal(snap.modeResults.B.prewatch.length,11);
 assert.equal(snap.modeResults.B.prewatchTop8.length,8);
 assert.ok(snap.text.B.includes('5109'), '9th and later candidates must remain in full TXT');
 assert.ok(snap.text.B.includes('5110'), '11th candidate must remain in full TXT');
 assert.equal(snap.modeResults.B.top8.length,0);
});
