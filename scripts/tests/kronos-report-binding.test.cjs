'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../../four-models-research-v1'),F=require('../../research-v83/forecast-engine');
const forecast=require('../../data/kronos/stocks/6148.json'),history=require('../../data/research/'+forecast.asOf+'/6148.json');
function loader(h=history,f=forecast,code='6148'){
 const requests=[],registered=[];
 class Clock extends Date{constructor(...args){super(...(args.length?args:[h.closeDate+'T11:00:00Z']));}static now(){return new Date(h.closeDate+'T11:00:00Z').getTime();}}
 const context={URL,Intl,Date:Clock,AbortSignal,document:{currentScript:{src:'https://test.local/research-v83/kronos-data.js'}},ShitouForecastPreview:{signature:F.signature,inputWindow:F.inputWindow,register(input,raw){const r=F.evaluate(input,raw);registered.push(r);return {ok:r.state==='MODEL_SAMPLE',reason:r.reason};}},fetch:async url=>{requests.push(String(url));return {ok:true,json:async()=>String(url).includes('manifest')?{stocks:{[code]:{asOf:h.closeDate}}}:String(url).includes('/research/')?h:f};}};
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
 for(const field of ['close','volume','amount']){const changed=structuredClone(a);changed.kronosInput.bars[0][field]+=1;assert.equal(await l.api.ensure(changed),false);assert.match(l.api.reasonFor(changed),/近160根日線/);}
 assert.equal(l.registered.length,1);
});
test('wrong ticker, date, market, model signature, and altered raw samples stay unavailable',async()=>{
 for(const change of [h=>h.stock='2330',h=>h.closeDate='2026-11-02',h=>h.market='TWSE']){const h=structuredClone(history);change(h);const l=loader(h);assert.equal(await l.api.ensure(C.evaluate(history)),false);assert.equal(l.registered.length,0);}
 for(const change of [f=>f.historySignature='bad',f=>f.samples[0][0].close+=1]){const f=structuredClone(forecast);change(f);assert.equal(await loader(history,f).api.ensure(C.evaluate(history)),false);}
});
test('real 5013 uses its matching shorter model; 160 is a maximum lookback, not a minimum',async()=>{
 const f=require('../../data/kronos/stocks/5013.json'),h=require('../../data/research/'+f.asOf+'/5013.json'),a=C.evaluate(h),l=loader(h,f,'5013');
 assert.ok(a.kronosInput.bars.length>=63&&a.kronosInput.bars.length<160);assert.equal(F.signature(a.kronosInput.bars),f.historySignature);assert.equal(await l.api.ensure(a),true,l.api.reasonFor(a));assert.equal(l.registered[0].state,'MODEL_SAMPLE');
 const changed=structuredClone(a);changed.kronosInput.bars[0].volume++;assert.equal(await l.api.ensure(changed),false);assert.match(l.api.reasonFor(changed),new RegExp('近'+a.kronosInput.bars.length+'根日線'));
});
test('shorter histories still reject missing rows, fewer than 63 bars and altered model receipts',async()=>{
 const f=require('../../data/kronos/stocks/5013.json'),h=require('../../data/research/'+f.asOf+'/5013.json'),a=C.evaluate(h),changed=structuredClone(a);changed.kronosInput.bars.shift();const l=loader(h,f,'5013');assert.equal(await l.api.ensure(changed),false);assert.match(l.api.reasonFor(changed),/歷史長度未對齊/);assert.equal(l.registered.length,0);
 const short=structuredClone(h);short.dailySeries=short.dailySeries.slice(-62);const input=structuredClone(a);input.kronosInput.bars=input.kronosInput.bars.slice(-62);const tooShort=loader(short,f,'5013');assert.equal(await tooShort.api.ensure(input),false);assert.equal(tooShort.registered.length,0);
 const bad=structuredClone(f);bad.execution.historySignature='tampered';assert.equal(await loader(h,bad,'5013').api.ensure(a),false);
});
test('market report describes uncertainty and limitations in Chinese',()=>{
 const M=require('../../research-v83/market-engine'),S=require('../../research-v83/market-simple-report'),source=require('../../data/index/TAIEX.json'),raw=require('../../data/kronos/TAIEX.json'),analysis=M.analyze(source),f=F.evaluate(analysis.input,raw);
 const snapshot={analysis,source:{name:'加權指數',source:'官方行情'},forecast:f};
 const text=S.model(snapshot).blocks.map(b=>b.text).join('\n');assert.doesNotMatch(text,/HIGH|MODERATE|Amount|OHLC|ATR|V8\.6較V8\.6|AI預測可信度/);assert.match(text,/不代表明天實際漲跌的機率/);assert.match(text,/平均每日波動/);
 const unavailable=S.model({...snapshot,forecast:null}).blocks.map(b=>b.text).join('\n');assert.doesNotMatch(unavailable,/多 \d+\.\d+%/);
});
