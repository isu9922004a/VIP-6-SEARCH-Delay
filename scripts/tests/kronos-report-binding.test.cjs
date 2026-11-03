'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../../four-models-research-v1'),F=require('../../research-v83/forecast-engine');
const history=require('../../data/research/2026-11-03/6148.json'),forecast=require('../../data/kronos/stocks/6148.json');
function loader(h=history,f=forecast){
 const requests=[],registered=[];
 const context={URL,Intl,Date,AbortSignal,document:{currentScript:{src:'https://test.local/research-v83/kronos-data.js'}},ShitouForecastPreview:{signature:F.signature,register(input,raw){const r=F.evaluate(input,raw);registered.push(r);return {ok:r.state==='MODEL_SAMPLE',reason:r.reason};}},fetch:async url=>{requests.push(String(url));return {ok:true,json:async()=>String(url).includes('manifest')?{stocks:{6148:{asOf:h.closeDate}}}:String(url).includes('/research/')?h:f};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../research-v83/kronos-data.js'),'utf8'),context);
 return {api:context.ShitouKronosData,requests,registered};
}
test('6148 attaches its real model to identical validated bars without a selection cache or matching object fingerprints',async()=>{
 const a=C.evaluate({...history,dailyBasisV2:{fingerprint:'different-object-metadata'}}),l=loader();
 assert.equal(a.kronosInput.bars.length,160);assert.notEqual(a.sourceSnapshotId,C.evaluate(history).sourceSnapshotId);
 assert.equal(await l.api.ensure(a),true,l.api.reasonFor(a));assert.equal(l.registered[0].state,'MODEL_SAMPLE');
 const count=l.requests.length;assert.equal(await l.api.ensure(a),true,l.api.reasonFor(a));assert.equal(l.requests.length,count);
});
test('same ticker and date with changed historical price or volume cannot use an earlier result',async()=>{
 const a=C.evaluate(history),l=loader();assert.equal(await l.api.ensure(a),true,l.api.reasonFor(a));
 for(const field of ['close','volume','amount']){const changed=structuredClone(a);changed.kronosInput.bars[0][field]+=1;assert.equal(await l.api.ensure(changed),false);assert.match(l.api.reasonFor(changed),/近160天行情/);}
 assert.equal(l.registered.length,1);
});
test('wrong ticker, date, market, model signature, and altered raw samples stay unavailable',async()=>{
 for(const change of [h=>h.stock='2330',h=>h.closeDate='2026-11-02',h=>h.market='TWSE']){const h=structuredClone(history);change(h);const l=loader(h);assert.equal(await l.api.ensure(C.evaluate(history)),false);assert.equal(l.registered.length,0);}
 for(const change of [f=>f.historySignature='bad',f=>f.samples[0][0].close+=1]){const f=structuredClone(forecast);change(f);assert.equal(await loader(history,f).api.ensure(C.evaluate(history)),false);}
});
test('market report describes uncertainty and limitations in Chinese',()=>{
 const M=require('../../research-v83/market-engine'),S=require('../../research-v83/market-simple-report'),source=require('../../data/index/TAIEX.json'),raw=require('../../data/kronos/TAIEX.json'),analysis=M.analyze(source),f=F.evaluate(analysis.input,raw);
 const snapshot={analysis,source:{name:'加權指數',source:'官方行情'},forecast:f};
 const text=S.model(snapshot).blocks.map(b=>b.text).join('\n');assert.doesNotMatch(text,/HIGH|MODERATE|Amount|OHLC|ATR|V8\.6較V8\.6|AI預測可信度/);assert.match(text,/不代表明天實際漲跌的機率/);assert.match(text,/平均每日波動/);
 const unavailable=S.model({...snapshot,forecast:null}).blocks.map(b=>b.text).join('\n');assert.doesNotMatch(unavailable,/多 \d+\.\d+%/);
});
