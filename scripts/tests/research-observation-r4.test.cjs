 'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../../four-models-research-v1.js'),Report=require('../../research-report-v1.js');
const {report}=require('../research-fixtures.cjs');
function input(kind){
 const bars=[],day=new Date('2026-10-22T00:00:00Z');
 while(bars.length<160){if(day.getUTCDay()>0&&day.getUTCDay()<6){
  const i=159-bars.length,close=kind==='bear'?90-i*.1:kind==='bull'?50+i*.1:100;
  const open=kind==='bear'?close+.5:kind==='bull'?close-.1:close;
  const high=kind==='bull'&&i===159?close+.5:close+1;
  const low=kind==='bear'?close-.1:kind==='bull'?close-.25:close-1;
  bars.unshift({date:day.toISOString().slice(0,10),open:+open.toFixed(2),high:+high.toFixed(2),low:+low.toFixed(2),close:+close.toFixed(2),volume:1500000});
 }day.setUTCDate(day.getUTCDate()-1);}
 return report(bars,{stock:'9001',code:'9001',name:'合成測試股',securityType:'COMMON',volumeUnit:'shares'});
}
test('R4: bearish 160 validated bars receive useful market context without changing original observation model',()=>{
 const a=Core.evaluate(input('bear'));
 assert.equal(a.validation.technicalModelAvailable,true);
 assert.equal(a.validation.historyBarCount,160);
 assert.equal(a.state,'OBSERVATION');
 assert.equal(a.compactStateLabel,'觀察中');
 assert.equal(Report.stageLabel(a),'短線偏弱');
 assert.match(Report.text(a),/【技術現況】收盤 .*低於MA20.*低於MA60.*MA20下彎/);
 assert.match(Report.text(a),/【風險】.*低於MA20/);
 assert.match(Report.text(a),/【四模型驗證】A突破.*B回踩.*C動能.*D資金/);
 assert.doesNotMatch(Report.text(a),/【風險】暫無額外警訊/);
 const before=JSON.stringify(a);Report.lines(a);assert.equal(JSON.stringify(a),before);
});
test('R4: rising and flat 160 validated bars get grounded technical context without overriding model verdicts',()=>{
 for(const [kind,want] of [['bull','偏多整理'],['flat','均線附近整理']]){
  const a=Core.evaluate(input(kind));
  assert.equal(Report.technicalOutlook(a)?.label,want,kind);
  if(kind==='flat'){assert.equal(a.state,'OBSERVATION');assert.equal(Report.stageLabel(a),want);}
  else assert.equal(a.state,'OVEREXTENDED');
  assert.match(Report.text(a),/【技術現況】收盤/);
 }
});
test('R4: invalid data stays unverified, with no invented technical verdict',()=>{
 const r=input('bear');r.volumeUnit='unknown';
 const a=Core.evaluate(r),t=Report.text(a);
 assert.equal(a.state,'INSUFFICIENT_DATA');assert.equal(Report.technicalOutlook(a),null);
 assert.match(t,/【技術現況】無法核驗/);
 assert.match(t,/【四模型驗證】基礎日K未通過/);
 assert.doesNotMatch(t,/【現況】短線偏弱/);
});
test('R4: image and text use the same summary for filter and individual stock',()=>{
 const a=Core.evaluate(input('bear'));
 const ctx={font:'',measureText(s){const px=Number(this.font.match(/(\d+)px/)?.[1]||56);return {width:[...String(s)].length*px}}};
 const document={createElement:()=>({getContext:()=>ctx})};
 const scan=Report.pages(a,{document}),stock=Report.pages(a,{document,stockMode:true});
 assert.equal(scan.length,stock.length);
 for(let i=0;i<scan.length;i++){
  const x=JSON.parse(scan[i].dataset.researchAudit),y=JSON.parse(stock[i].dataset.researchAudit);
  assert.deepEqual(x.summary,y.summary);assert.equal(x.noClipping,true);assert.equal(y.noClipping,true);
  assert.match(x.summary.join('\n'),/短線偏弱/);
 }
});

test('R4: all 1,949 supplied market-snapshot short names survive normal lookup, including numeric-prefix and starred KY names',()=>{
 const snapshot=require('../../data/market/latest.json');
 assert.equal(snapshot.rows.length,1949);
 for(const row of snapshot.rows){
  const a=Core.evaluate({stock:row.code,name:row.name,market:row.market,closeDate:snapshot.tradeDateIso,completed:true});
  assert.equal(a.name,row.name,`${row.code}: ${row.name} -> ${a.name}`);
  // Quote-only snapshot does not certify technical history; no fabricated signal.
  assert.equal(a.state,'INSUFFICIENT_DATA',row.code);
 }
});
