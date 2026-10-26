'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Z=require('../../research-zh-tw-v1.js');
const I=require('../../indicator-multi-v1.js');
const R=require('../../research-report-v1.js');
const C=require('../../four-models-research-v1.js');
const root=path.resolve(__dirname,'../..');
function bars(n=160){const rows=[],d=new Date('2026-10-22T00:00:00Z');while(rows.length<n){if(d.getUTCDay()!==0&&d.getUTCDay()!==6){const t=n-1-rows.length,close=90+t*.24;rows.unshift({date:d.toISOString().slice(0,10),open:close-.35,high:close+1,low:close-1,close,volume:1000000+10*t});}d.setUTCDate(d.getUTCDate()-1);}return rows;}
test('every new user-facing research field and A–E pattern has a Traditional Chinese label',()=>{
 const keys=['multiTimeframeResearch','indicatorPatternResearch','marketPhaseResearch','riskEvidence','researchDataHealth','supportResistance','strategyResults','researchVersion'];
 keys.forEach(k=>assert.match(Z.field(k),/[\u4e00-\u9fff]/));
 assert.equal(Object.keys(Z.PATTERNS).length,5);
 for(const text of Object.values(Z.PATTERNS))assert.match(text,/指標型態[一二三四五]｜/);
});
test('internal state codes localize without leaking unknown uppercase enum tokens',()=>{
 for(const v of ['PASS','FAIL','UNKNOWN','INSUFFICIENT_DATA','INVALID_DATA','UNVERIFIED','HISTORY_INSUFFICIENT','NOT_VALIDATED'])assert.doesNotMatch(Z.humanize(v),/[A-Z]{3,}/,v);
 assert.equal(Z.humanize('DATA_QUALITY:BREAKOUT_ACCELERATION_V1'),'內部狀態待核對:突破研究模型');
 assert.match(Z.humanize('MACD與RSI5確認'),/MACD與RSI5確認/);
});
test('daily study computes seeded K/D, DIF, histogram and five read-only patterns',()=>{
 const b=bars(),before=JSON.stringify(b),a=I.study(b);
 assert.equal(JSON.stringify(b),before);
 assert.equal(a.status,'已確認');assert.equal(a.patterns.length,5);
 assert.equal(a.researchOnly,true);assert.equal(a.affectsOriginalRank,false);
 assert.ok(a.day.kd.k>=0&&a.day.kd.k<=100);
 assert.ok(Number.isFinite(a.day.macd.dif));
 assert.ok(Math.abs(a.day.macd.dif-a.day.macd.signal-a.day.macd.hist)<.0002);
 assert.equal(a.week.status,'資料不足');assert.equal(a.month.status,'資料不足');
 assert.ok(a.patterns.every(p=>p.performanceValidated===false));
});
test('study cannot claim complete higher-timeframe history without verifiable calendar',()=>{
 const b=bars(400),dateList=b.map(x=>x.date),calendar={verified:true,source:'測試交易日曆',start:dateList[0],end:dateList.at(-1),dates:dateList};
 const a=I.study(b,{calendar}),short=I.study(b.slice(0,70),{calendar});
 assert.equal(a.week.status,'已確認');
 assert.equal(a.month.status,'已確認');
 assert.ok(a.week.last<b.at(-1).date);
 assert.ok(a.month.last<b.at(-1).date);
 // Historical cutoff is respected: study never sees last period's final day.
 assert.ok(short.day.kd.k>=0&&short.day.kd.k<=100);
});
test('validated short OHLCV is not promoted into verified long history',()=>{
 assert.equal(I.study(bars(20)).status,'資料不足');
 assert.deepEqual(I.study(bars(20)).patterns,[]);
});
test('four-model report uses Chinese sections while retaining legacy client interface',()=>{
 const a={code:'2330',name:'台積電',date:'2026-10-22',state:'OBSERVATION',risks:['UNVERIFIED'],dataQuality:{complete:false,missing:['HISTORY_INSUFFICIENT']}};
 const original=JSON.stringify(a),text=R.text(a);
 assert.equal(JSON.stringify(a),original);
 for(const label of ['目前行情階段','短線動能研判','中期趨勢方向','日週月週期研判','指標型態確認','四策略綜合結果','多方有利依據','空方風險因素','關鍵支撐價位','關鍵壓力價位','進場觀察條件','判斷失效條件','空手操作建議','持股風險提醒','行情資料完整性'])assert.ok(text.includes('【'+label+'】'),label);
 assert.doesNotMatch(text,/UNVERIFIED|HISTORY_INSUFFICIENT/);
 assert.match(text,/【技術現況】/);
});
test('frontend loads research localization before report, indicator study before research model, and updates visible version',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.indexOf('indicator-multi-v1.js')<html.indexOf('four-models-research-v1.js'));
 assert.ok(html.indexOf('research-zh-tw-v1.js')<html.indexOf('research-report-v1.js'));
 assert.match(html,/<title>石頭少爺 V8\.2\.2-R12/);
 const js=fs.readFileSync(path.join(root,'research-integration-v1.js'),'utf8');
 assert.match(js,/匯出繁體中文研究表（CSV）/);
 assert.match(js,/匯出文字報告（TXT）/);
 assert.match(js,/DRAX 價格對應提醒/);
});
