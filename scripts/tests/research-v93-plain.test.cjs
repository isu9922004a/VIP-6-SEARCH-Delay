'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../../research-chart-layout-v921.js'),Core=require('../../kline-life-03-core-v1.js'),C=require('../../four-models-research-v1.js'),R=require('../../kline-life-03-report-v1.js'),raw=require('../../data/research/2026-11-13/4939.json');
test('beginner sentences retain prices, dates, percentages and confirmation conditions',()=>{
 const samples=['下一完成日K若收盤高於63.80元，才確認壓力突破','下一完成日K若收盤低於50.20元，構成生命線失守','2026-11-13｜收盤61.90元；距生命線23.31%','若守住50.2元並突破已確認前高，才觀察多方延續'];
 for(const s of samples){const v=P.plain(s);assert.deepEqual(v.match(/\d{4}-\d\d-\d\d|\d+(?:\.\d+)?(?:元|%)/g),s.match(/\d{4}-\d\d-\d\d|\d+(?:\.\d+)?(?:元|%)/g));assert.equal(P.plain(v),v);}
 assert.match(P.plain(samples[0]),/收盤高於63.80元.*才算/);assert.match(P.plain(samples[1]),/收盤低於50.20元/);
});
test('confirmed, pending and missing states keep their separate meanings',()=>{
 assert.match(P.lifeState('NEUTRAL'),/還要等確認/);assert.match(P.lifeState('TURNING_STRONG'),/已確認轉強/);assert.match(P.lifeState('INSUFFICIENT_DATA'),/資料不足/);
 assert.match(P.eventState('BREAKOUT_FAILED'),/又掉回來/);assert.match(P.eventState('SUPPORT_BROKEN'),/收盤已跌破/);assert.match(P.patternState('FORMING'),/尚未確認/);
});
test('actual 4939 fields are readable while the complete study and prices remain immutable',()=>{
 const a=C.evaluate(raw),life=Core.evaluate(a),before=JSON.stringify({a,life}),fields=R.fields(life),text=R.lines(life).join('\n');
 assert.match(text,/50.20 元/);assert.match(text,/61.90 元/);assert.match(text,/2026-11-06/);assert.match(text,/20日平均價（MA20）/);assert.match(text,/股價起伏較大（ATR）/);assert.match(text,/獲利表現還沒驗證/);
 assert.doesNotMatch(text,/BULL_SUPPORT_WATCH|NOT_VALIDATED|NaN|Infinity|undefined/);assert.equal(JSON.stringify({a,life}),before);assert.equal(life.state,'NEUTRAL');assert.equal(life.performance,'NOT_VALIDATED');assert.equal(fields.details.length,9);
});
test('wrapped dates, prices and short indicator explanations retain complete text',()=>{
 const ctx={font:'',measureText:s=>({width:[...s].length*20})},s='收盤仍低於20日平均價（MA20），行情2026-11-13，收盤61.90 元';
 const rows=P.wrap(ctx,s,260);assert.equal(rows.join(''),s);assert.ok(rows.some(x=>x.includes('（MA20）')));assert.ok(rows.some(x=>x.includes('2026-11-13')));assert.ok(rows.some(x=>x.includes('61.90 元')));
});
test('risk explanations are idempotent and never become promises',()=>{
 for(const s of Core.evaluate(C.evaluate(raw)).riskWarnings){const v=P.plain(s);assert.equal(P.plain(v),v);assert.match(v,/不.*保證/);assert.doesNotMatch(v,/保證獲利|一定上漲/);}
});
