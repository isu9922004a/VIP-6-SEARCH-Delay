'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..'),W=require('../../worker-data-contract-v1.js');
const Policy=require('../../scan-exclusions-rsi-v5328.js'),Fifth=require('../../strategy-2560-v1.js'),Structure=require('../../structure-reversal-core-v1.js');
const {bars,report}=require('../research-fixtures.cjs');
const code=fs.readFileSync(path.join(ROOT,'research-integration-v1.js'),'utf8'),from=code.indexOf('function isEtfManualCode('),to=code.indexOf('function source(input)',from);
assert.ok(from>0&&to>from,'ETF verifier must be present in production research integration');
const etf=vm.runInNewContext(code.slice(from,to)+'\n({isEtfManualCode,verifiedEtfDaily})',{root:{ShitouWorkerDataContractV1:W}});
function signed(stock='0050'){
 const r=report(bars(160),{stock,market:'TWSE',scanMode:'DAILY_ONLY',dailyOnly:true});
 r.dailySeriesMeta.mode='DAILY_ONLY';
 return W.seal(r,{evidence:W.unitEvidence(['YAHOO_CHART'])});
}
test('ETF symbols are manual-only; financial/common-stock strategy gates remain untouched',()=>{
 for(const code of ['0050','0056','00878','006208','00919']){
  assert.equal(etf.isEtfManualCode(code),true,code);
  const q={code,name:'ETF test',securityType:'ETF',volume:9999999,tradeValue:999999999};
  assert.equal(Policy.classify(code,q,{industryName:'其他'},{targetTradeDate:'2026-11-16'}).key,'SPECIAL');
  assert.equal(Fifth.universe(code,q,{industryName:'其他'}).ok,false);
  assert.equal(Structure.classify(code,q,{industryName:'其他'},{}).excluded,true);
 }
 assert.equal(etf.isEtfManualCode('2330'),false);
 assert.equal(etf.isEtfManualCode('2882'),false);
 assert.equal(etf.isEtfManualCode('00400A'),false,'alphanumeric ETF requires a different, supported endpoint');
});
test('signed same-date completed ETF daily bars work without the ordinary-stock snapshot',()=>{
 const r=signed(),v=W.verify(r);assert.equal(v.ok,true);
 assert.equal(etf.verifiedEtfDaily(r,'0050',r.closeDate),true);
 for(const change of [
  x=>{x.stock='0056';},x=>{x.marketDate='2026-11-13';},
  x=>{x.dailySeries[0].close+=2;},
  x=>{x.dailySeries.at(-1).date='2026-11-13';},
  x=>{x.dailySeriesMeta.onlyCompletedBars=false;},
  x=>{x.dataContract=null;},
  x=>{x.completed=false;}
 ]){
  const tampered=structuredClone(r);change(tampered);
  assert.equal(etf.verifiedEtfDaily(tampered,'0050',r.closeDate),false);
 }
});
test('actual stock search routes ETF directly to signed DAILY_ONLY and displays truthful scope',()=>{
 const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 assert.match(index,/if\(\/\^00\\d\{2,4\}\$\/\.test\(String\(stock\)\)\)return fetchStockDailyFallbackV828\(stock/);
 assert.match(index,/ETF個別研究：完成日K已核驗；不適用六套策略、月線資格或淨值判讀/);
 assert.match(index,/<title>石頭少爺 V9\.12/);
});
test('ETF bypasses scanner cache and excludes monthly / eligibility promotion',()=>{
 assert.match(code,/if\(!trustedObservation&&!trustedFinancialDaily&&D\?\.get\(code\)&&D\.getSnapshot\(\)\?\.date===sourceDate&&!isEtfManualCode\(code,r\)\)/);
 assert.match(code,/if\(isEtfManualCode\(code,raw\)\)/);
 assert.match(code,/etfManualOnly:true,etfDailyValidated:true/);
 assert.match(code,/monthlyStatus:'UNAVAILABLE',monthlyPass:null,entry:null,startMonthConfirmed:false/);
 assert.match(code,/formalLaunchEligible:false,scanEligible:false,strategyEligible:false/);
 assert.match(code,/ETF完成日K來源尚未核驗/);
});
