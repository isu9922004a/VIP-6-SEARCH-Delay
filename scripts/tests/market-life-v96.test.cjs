'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../../market-life-report-v96.js'),Core=require('../../kline-life-03-core-v1.js'),Structure=require('../../structure-context-v1.js');
const raw=require('../../data/index/TAIEX.json'),now=new Date('2026-11-14T08:00:00Z'),copy=()=>structuredClone(raw);
const document={createElement:()=>({getContext:()=>({font:'',measureText(value){const size=Number(this.font.match(/(\d+)px/)?.[1]||32);return {width:[...value].reduce((s,ch)=>s+(/[\x00-\x7f]/.test(ch)?.55:1)*size,0)};}})})};
const study=M.evaluate(raw,{now});
test('verified official index adapter reuses exactly the stock life-line state machine',()=>{
 assert.equal(M.validate(raw,{now}).ok,true);const bars=Structure.confirmationInput(raw).bars;
 const direct=Core.evaluate({code:'TAIEX',name:'台灣加權指數',date:raw.closeDate,sourceBars:bars,validation:{technicalModelAvailable:true},expectedTradingDates:raw.tradingCalendar.dates,priceAdjustment:raw.priceAdjustment,dataSource:raw.dailySeriesMeta.source,dataQuality:{complete:true,missing:[]},sourceVolumeAudit:M.sourceAudit(raw),completed:true});
 for(const key of Object.keys(direct))assert.deepEqual(study[key],direct[key],key);
 assert.equal(study.close,43675.12);assert.equal(study.event.lifeLinePrice,43741.54);assert.equal(study.lifecycleState,'BREAKOUT_FAILED');assert.equal(study.researchOnly,true);assert.equal(study.affectsEligibility,false);assert.equal(study.affectsRanking,false);assert.equal(study.automaticTrade,false);assert.equal(study.performanceValidated,false);
});
for(const [name,mutate]of [
 ['stock identity',x=>x.code='2330'],['wrong index',x=>x.symbol='TPEX'],['wrong market',x=>x.market='TPEX_INDEX'],['prediction',x=>x.kind='KRONOS_INFERENCE'],['illustration',x=>x.provenance='ILLUSTRATION'],['uncompleted day',x=>x.completed=false],['uncompleted bar',x=>x.dailySeries.at(-1).completed=false],['suspension',x=>x.dailySeries.at(-1).suspended=true],['duplicate bar',x=>x.dailySeries.at(-1).date=x.dailySeries.at(-2).date],['missing day',x=>x.dailySeries.splice(60,1)],['calendar not verified',x=>x.tradingCalendar.verified=false],['price basis not verified',x=>x.priceAdjustment.verified=false],['wrong volume unit',x=>x.volumeUnit='currency'],['volume source failure',x=>x.dailySeriesMeta.volumeFetchError='HTTP 500'],['no source receipt',x=>delete x.sourceReceipt],['inconsistent closing level',x=>x.close+=1],['mixed stock candle',x=>x.dailySeries.at(-1).code='2330'],
])test('rejects '+name+' without fabricated prices',()=>{const x=copy();mutate(x);assert.equal(M.validate(x,{now}).ok,false);const result=M.evaluate(x,{now});assert.equal(result.sourceVerified,false);assert.equal(result.lifecycleState,'INSUFFICIENT_DATA');assert.ok(result.close==null);assert.equal(result.event,null);});
test('stale and premature closing data cannot masquerade as a completed session',()=>{assert.equal(M.validate(raw,{now:new Date('2026-11-16T08:00:00Z')}).ok,false);assert.equal(M.validate(raw,{now:new Date('2026-11-13T03:00:00Z')}).ok,false);assert.equal(M.validate(raw,{now:new Date('2026-11-13T08:00:00Z')}).ok,true);});
test('historical asOf uses only the same known prefix without future pivot confirmation',()=>{
 const asOf=raw.dailySeries.at(-12).date,a=M.evaluate(raw,{now,asOf}),x=copy(),cut=x.dailySeries.findIndex(b=>b.date===asOf);x.dailySeries=x.dailySeries.slice(0,cut+1);x.closeDate=asOf;x.close=x.dailySeries.at(-1).close;Object.assign(x.dailySeriesMeta,{lastDate:asOf,returnedBars:x.dailySeries.length});
 const b=M.evaluate(x,{now:new Date(asOf+'T08:00:00Z')});for(const k of ['events','event','currentTrend','chaseRisk','scenario','lifecycleState'])assert.deepEqual(a[k],b[k],k);assert.ok(a.validatedBars.every(b=>b.date<=asOf));assert.equal(M.validate(raw,{now,asOf:'2026-11-15'}).ok,false);
});
test('index V9.8 report mirrors the stock two-page visual while preserving exact TAIEX audit',()=>{
 const before=JSON.stringify(study),ps=M.pages(study,{document}),audits=ps.map(p=>JSON.parse(p.dataset.marketLifeAudit));
 assert.equal(JSON.stringify(study),before);
 assert.equal(ps.length,2);
 assert.deepEqual(audits.map(a=>a.title),['大盤分析','生命線形成教學']);
 for(const [i,p] of ps.entries()){
  const a=audits[i];
  assert.equal(p.width,1284);assert.equal(p.height,2778);assert.equal(a.pages,2);
  assert.equal(a.instrumentType,'TAIEX');assert.equal(a.unit,'點');assert.equal(a.sourceVerified,true);
  assert.match(p.filename,/石頭少爺_V9.8_TAIEX_20261113_P0[12]_/);
  assert.equal(a.model.close,43675.12);assert.equal(a.model.line,43741.54);
  assert.equal(a.model.date,'2026-11-13');assert.equal(a.model.code,'TAIEX');
  assert.equal(a.model.referenceOnly,false);
  assert.equal(a.model.volume.verified,false);
  assert.equal(a.volumeConfirmationAllowed,false);
  assert.equal(a.model.chartBarDates.length,30);
  assert.deepEqual(a.model.markers.map(x=>x.label),['K3','K2','K1','K0']);
  assert.equal(a.reportOnly,true);assert.equal(a.affectsEligibility,false);assert.equal(a.affectsRanking,false);
 }
 const V=require('../../market-life-visual-v98.js');
 assert.match(V.convert('個股收盤 143.50 元，股價仍須觀察；追價風險'),/大盤收盤 143.50 點，指數仍須觀察；短線過熱風險/);
 assert.doesNotMatch(V.convert('最高價、最低價、成交量、主力真實持股成本'),/最高價|最低價|成交量|主力真實持股成本/);
 assert.throws(()=>M.pages({...study,code:'2330'}, {document}),/加權指數|個股|核對/);
 assert.throws(()=>M.pages({...study,sourceVerified:false},{document}),/核對/);
});

test('short valid history reports missing indicators rather than inventing MA20 or ATR',()=>{const x=copy();x.dailySeries=x.dailySeries.slice(-4);Object.assign(x.dailySeriesMeta,{firstDate:x.dailySeries[0].date,returnedBars:4});const a=M.evaluate(x,{now});assert.equal(a.sourceVerified,true);assert.equal(a.currentTrend.ma20,null);assert.equal(a.currentTrend.atr14,null);assert.equal(a.chaseRisk.level,'UNDETERMINED');assert.match(M.fields(a).overview.trendSummary,/資料不足/);});

test('display describes a failed breakout as already failed while preserving core scenarios',()=>{const before=JSON.stringify(study.scenario),f=M.fields(study);assert.match(f.scenario.bearish,/原突破已失守/);assert.match(f.scenario.bullish,/不是首次突破/);assert.equal(JSON.stringify(study.scenario),before);assert.equal(f.details[4].value,f.scenario.bearish);});
test('both entries load the index adapter once after all required dependencies',()=>{const fs=require('node:fs');for(const file of ['index.html','market-outlook.html']){const s=fs.readFileSync(file,'utf8');for(const name of ['market-life-report-v96.js','market-life-ui-v96.js'])assert.equal(s.split(name+'?').length-1,1);for(const name of ['kline-life-03-core-v1.js','kline-life-03-report-v1.js','structure-context-v1.js','research-v83/market-freshness.js'])assert.ok(s.indexOf(name+'?')<s.indexOf('market-life-report-v96.js?'),file+': '+name);assert.ok(s.indexOf('market-life-report-v96.js?')<s.indexOf('market-life-ui-v96.js?'));}});

test('official price and volume witnesses are reproducible and suppress conflicted volume confirmation',()=>{const fs=require('node:fs'),z=require('node:zlib'),crypto=require('node:crypto'),a=require('../../market-life-source-audit-v96.js');for(const s of a.sources){const bytes=z.gunzipSync(fs.readFileSync('scripts/fixtures/'+s.fixture));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),s.sha256);const official=JSON.parse(bytes);assert.equal(official.stat,'OK');assert.deepEqual(official.data.find(r=>r[0]==='115/11/13'),s.row);}assert.equal(a.priceMatches,10);assert.deepEqual(a.priceDifferences,[]);assert.equal(study.sourceVolumeAudit.uncertain,true);assert.equal(study.currentTrend.volumeRatio,null);assert.match(JSON.stringify(M.fields(study)),/成交量待核對，暫不作量能確認/);assert.equal(M.sourceAudit({...raw,closeDate:'2026-11-12'}),null);});
