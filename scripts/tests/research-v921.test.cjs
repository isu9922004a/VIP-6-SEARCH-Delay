'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const L=require('../../research-chart-layout-v921.js'),C=require('../../four-models-research-v1.js'),Core=require('../../kline-life-03-core-v1.js'),R=require('../../kline-life-03-report-v1.js'),B=require('../fixtures/v921-protected-baseline.json');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('protected calculators and five existing scanners remain identical to the release baseline',()=>{
 for(const [name,oldExpected]of Object.entries(B.sources)){const expected=name==='kline-life-03-core-v1.js'?require('../fixtures/v932-life-baseline.json').coreSha256:oldExpected;assert.equal(sha(fs.readFileSync(name,'utf8').replaceAll('\r\n','\n')),expected,name);}
 const html=fs.readFileSync('index.html','utf8').replaceAll('\r\n','\n'),inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(sha(JSON.stringify(inline)),B.inlineSha256);
});
test('verified 4939 snapshot, all research values, rankings match the original evaluation; revised life events match the V9.3.2 regression baseline',()=>{
 const bytes=fs.readFileSync('data/research/2026-11-13/4939.json');assert.equal(sha(bytes),B.inputSha256);
 const a=C.evaluate(JSON.parse(bytes),{generatedAt:B.generatedAt});assert.equal(sha(JSON.stringify(a)),B.analysisSha256);assert.equal(sha(JSON.stringify(Core.evaluate(a))),require('../fixtures/v932-life-baseline.json').lifeSha256);
 assert.equal(a.date,'2026-11-13');assert.equal(a.sourceBars.at(-1).close,61.9);
});
const bars=Array.from({length:84},(_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),low:10,high:12,close:11,open:10.5})),event={side:'BULL',k3Date:bars[1].date,k2Date:bars[5].date,k1Date:bars[81].date,k0Date:bars[83].date};
test('event dates use exact visible candle dates and real plot coordinates',()=>{
 const v=bars.slice(-80),g=L.eventLayout(event,v,{x:120,width:1050,min:8,max:14});assert.equal(g.events[0].status,'OUT_OF_RANGE');assert.equal(g.events[1].index,1);assert.equal(g.events[2].index,77);assert.equal(g.events[3].index,79);
 for(const e of g.events.filter(e=>e.status==='VISIBLE'))assert.equal(e.anchorX,120+(e.index+.5)*1050/80);
 const sorted=g.labels;for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].x>=sorted[i-1].x+sorted[i-1].width+12);assert.ok(sorted.every(e=>e.x>=120&&e.x+e.width<=1170));
});
test('a missing event date is not replaced by a neighboring trading date',()=>{
 const g=L.eventLayout({...event,k1Date:bars[50].date,k0Date:null},bars.slice(-80).filter(b=>b.date!==bars[50].date),{min:8,max:14});assert.equal(g.events.find(e=>e.key==='K1').status,'MISSING_BAR');assert.equal(g.events.find(e=>e.key==='K0').status,'MISSING');assert.ok(!g.labels.some(e=>e.key==='K1'||e.key==='K0'));assert.deepEqual(L.eventLayout(null,bars,{min:8,max:14}).labels,[]);
});
test('partial and missing life-line data preserve missing states without invented prices',()=>{
 const s=Core.evaluate({code:'9001',date:'2026-11-13'}),text=R.lines(s).join('\n');assert.equal(s.event,null);assert.match(text,/資料不足/);assert.doesNotMatch(text,/NaN|Infinity|undefined/);
});
test('ABC renderer cannot evaluate life-line signals; life-line renderer cannot read ABC targets',()=>{
 const chart=fs.readFileSync('research-chart-v1.js','utf8'),life=fs.readFileSync('kline-life-03-report-v1.js','utf8');assert.doesNotMatch(chart,/ShitouKlineLife03|lifeAnchor/);assert.doesNotMatch(life,/nContinuation|unifiedResearch|projection\.price/);
 const html=fs.readFileSync('index.html','utf8');assert.ok(html.indexOf('research-chart-layout-v921.js?')<html.indexOf('kline-life-03-report-v1.js?'));assert.ok(html.includes('research-ui-v921.css?v=V9.4-LIFE94-1'));
});
