'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../../selection-data-v2.js'),fixture=require('../fixtures/9933-worker-responses-20261022.json');
function bind(){D.reset();D.bind({map:new Map(fixture.snapshot.rows.map(q=>[q.code,q])),meta:fixture.snapshot.meta,snapshotRows:fixture.snapshot.rows.length});}
function historyOnly(){const raw=structuredClone(fixture.daily.results[0].data);raw.dailySeriesMeta.source='Yahoo Finance history (R4.9.3 DAILY_ONLY)';return raw;}
test('R4.9.3 named history-only Worker branch shares the verified serializer contract',()=>{
 bind();const raw=historyOnly(),before=JSON.stringify(raw),p=D.remember(raw,'9933');
 assert.equal(p.bars.length,160);assert.match(p.workerDataAudit.volumeUnitSource,/CONTRACT.*SAME_DAY/);assert.equal(p.workerDataAudit.source,raw.dailySeriesMeta.source);assert.equal(JSON.stringify(raw),before);D.reset();
});
for(const [name,mutate] of [
 ['unknown schema',r=>r.dailySeriesMeta.schema='unknown'],['other provider',r=>r.dailySeriesMeta.source='Generic Yahoo history'],['other mode',r=>r.scanMode='FULL'],['unknown declared unit',r=>r.volumeUnit='unknown'],['conflicting lots',r=>r.volumeUnit='lots'],['wrong ticker',r=>r.stock='2330'],['wrong market',r=>r.market='TPEX'],['unfinished',r=>r.dailySeriesMeta.onlyCompletedBars=false],['volume differs over 20%',r=>r.dailySeries.at(-1).volume*=2],['OHLC mismatch',r=>r.dailySeries.at(-1).close-=5]
])test('history-only variant still rejects '+name,()=>{bind();const raw=historyOnly();mutate(raw);assert.throws(()=>D.remember(raw,'9933'));assert.equal(D.get('9933'),null);D.reset();});
function brokerHarness(kind){
 const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8'),name=kind==='MAIN'?'runMomentumScanV3769':'runDayTradeScanV1';
 const start=html.indexOf('const '+name+'_KEY_BROKER_BASE='),end=html.indexOf('\n};',start)+3;assert.ok(start>=0&&end>start);
 const elements=new Map();for(const id of [kind==='MAIN'?'momentumScanButton':'dayTradeScanButton',kind==='MAIN'?'momentumStopButton':'dayTradeStopButton',kind==='MAIN'?'momentumImageMessage':'dayTradeImageMessage']){const set=new Set();elements.set(id,{disabled:false,textContent:'開始掃描',style:{},classList:{add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)}});}
 const scan={candidates:[{code:'9933',report:{code:'9933'}}]},root={momentumScanRunningV3762:false,dayTradeScanRunningV1:false,momentumScanAbortV3762:false,dayTradeScanAbortV1:false,lastMomentumScanDataV3762:scan,lastDayTradeScanDataV1:scan,document:{getElementById:id=>elements.get(id)},renderMomentumScanResultV3765(){},renderDayTradeScanResultV1(){},restoreDayTradeButtonsV53244(){elements.get('dayTradeScanButton').disabled=false;},keyBrokerEnrichCandidatesV377729:()=>new Promise((resolve,reject)=>{root.finish=resolve;root.fail=reject;})};
 root[name]=async()=>{};vm.runInNewContext(html.slice(start,end),root);return {root,scan,elements,name};
}
for(const kind of ['MAIN','DAYTRADE'])test(kind+' broker enrichment keeps the stop button available and restores controls after cancellation',async()=>{
 const h=brokerHarness(kind),job=h.root[h.name]();await new Promise(setImmediate);assert.equal(typeof h.root.fail,'function');
 const stop=h.elements.get(kind==='MAIN'?'momentumStopButton':'dayTradeStopButton'),button=h.elements.get(kind==='MAIN'?'momentumScanButton':'dayTradeScanButton');
 assert.equal(stop.classList.contains('show'),true);assert.equal(stop.disabled,false);assert.equal(button.disabled,true);
 h.root[kind==='MAIN'?'momentumScanAbortV3762':'dayTradeScanAbortV1']=true;h.root.fail(Error('已停止券商補充'));await job;
 assert.equal(button.disabled,false);assert.equal(stop.classList.contains('show'),false);assert.equal(h.scan.keyBrokerEnriched,undefined);
 assert.match(h.elements.get(kind==='MAIN'?'momentumImageMessage':'dayTradeImageMessage').textContent,/已停止/);
});
