'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),F=require('../../research-v83/forecast-engine.js'),M=require('../../research-v83/market-engine.js');
const root=path.resolve(__dirname,'../..');
test('real Kronos samples match each independent input and reject demo, other ticker and altered history',()=>{
 for(const code of ['1569','2330','8039','TAIEX']){
 const f=require('../../data/kronos/'+(code==='TAIEX'?'TAIEX.json':'stocks/'+code+'.json')),source=require('../../'+(code==='TAIEX'?'data/index/TAIEX.json':'data/research/'+f.asOf+'/'+code+'.json'));
 const input=code==='TAIEX'?M.analyze(source).input:{symbol:code,market:source.market,asOf:source.closeDate,bars:source.dailySeries};
 const result=F.evaluate(input,f);assert.equal(result.state,'MODEL_SAMPLE',code+': '+result.reason);assert.equal(result.sampleCount,32);assert.equal(result.tradeAllowed,false);assert.equal(f.performanceValidated,false);assert.equal(f.calibratedWinProbability,null);assert.ok(Math.abs(result.bullish+result.bearish+result.flat-1)<1e-12);
 for(const change of [g=>g.kind='ILLUSTRATION',g=>g.symbol='9999',g=>g.historySignature='tampered',g=>g.targetDates=[input.asOf],g=>g.samples[0][0].close=NaN]){const bad=structuredClone(f);change(bad);assert.equal(F.evaluate(input,bad).state,'UNAVAILABLE');}
 assert.equal(F.evaluate({...input,bars:input.bars.map((b,i)=>i?b:{...b,close:b.close+.01})},f).state,'UNAVAILABLE');
 }
});
test('production entry points use real loader, independent index page, and no preview generator',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/\.\/preview\/|allStocks:true/);assert.match(html,/research-v83\/kronos-data.js/);assert.match(html,/market-outlook.html/);assert.match(html,/id="stockSimpleAnalysisButton"/);
 const js=fs.readFileSync(path.join(root,'research-v83/market.js'),'utf8');assert.doesNotMatch(js,/function demo\(|market-demo|data\/research\//);assert.match(js,/data\/index\/TAIEX.json/);
});
