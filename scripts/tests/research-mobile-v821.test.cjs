'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),C=require('../../four-models-research-v1.js'),R=require('../../research-report-v1.js');
const fixture={stock:'6690',name:'Acer Cyber Security Inc.',closeDate:'2026-10-22',completed:false};
test('English corporate full name never leaks to four-strategy display fallback',()=>{
 const had=globalThis.momentumSafeStockNameV377712,raw=C.evaluate(fixture);
 assert.equal(raw.name,'股票6690（名稱待核對）');
 globalThis.momentumSafeStockNameV377712=()=> '安碁資訊';
 try {const localized=C.evaluate(fixture);assert.equal(localized.name,'安碁資訊');assert.match(R.text(localized),/^安碁資訊（6690）/);}
 finally{if(had===undefined)delete globalThis.momentumSafeStockNameV377712;else globalThis.momentumSafeStockNameV377712=had;}
});
test('compact report prints essential information and retains manually entered alert hints',()=>{
 const a={name:'安碁資訊',code:'6690',date:'2026-10-22',state:'OVEREXTENDED',families:{PRICE_STRUCTURE:true,TREND_MA:true},originalB:77.13,researchBreakoutPrice:78.40,originalInvalidation:70,risks:['追高警戒'],dataQuality:{complete:false},foundation:{alertPlan:{priceAbove:{input:77.1,alreadyCrossed:true},priceBelow:{input:70},dayGainPercentInput:5,dayLossPercentInput:5}}};
 const text=R.text(a);for(const field of ['現況','研究重點','關鍵價位','風險','資料狀態','摘要結論','盤後已越過原價位'])assert.ok(text.includes(field),field);
 assert.ok(!text.includes('undefined'));assert.ok(!text.includes('Acer Cyber Security'));
});
test('full-bleed iPhone image layout keeps enlarged text inside safe bounds',()=>{
 const ctx={font:'',measureText(s){const n=/\b(\d+)px/.exec(this.font),size=Number(n?.[1]||56);return {width:[...String(s)].reduce((w,c)=>w+(/[^\x00-\xff]/.test(c)?size:size*.65),0)}}};
 const doc={createElement(name){assert.equal(name,'canvas');return {getContext:()=>ctx}}};
 const a={name:'安碁資訊',code:'6690',date:'2026-10-22',state:'HEALTHY_PULLBACK',families:{PRICE_STRUCTURE:true,TREND_MA:true,VOLUME:true},originalB:185,researchBreakoutPrice:191.5,originalInvalidation:172.5,risks:['高乖離追價風險','成交量仍需確認','長上影'],dataQuality:{complete:false},foundation:{dualScanContext:{modeA:{checks:[]},modeB:{checks:[]}},alertPlan:{priceAbove:{input:185},priceBelow:{input:172.5},dayGainPercentInput:5,dayLossPercentInput:5}}};
 const p=R.pages(a,{document:doc,displayCode:'V8.2.2-R4'});
 assert.ok(p.length>=1&&p.length<=3);
 p.forEach(page=>{const audit=JSON.parse(page.dataset.researchAudit);assert.equal(audit.width,1284);assert.equal(audit.height,2778);assert.equal(audit.minFont,56);assert.equal(audit.noClipping,true);assert.ok(audit.bodyBottom<=2430);});
});
test('frontend displays V8.2.2-R8 and busts all local script/style caches',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const v=require('../../version-v50.js');
 assert.equal(v.displayCode,'V8.2.2-R8');assert.equal(v.fileVersion,'V8.2.2-R8');
 assert.match(html,/<title>石頭少爺 V8\.2\.2-R8/);
 for(const entry of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\.\/[^"\s]+)"/g)){
  const url=entry[1];if(/\.(?:js|css)\?v=/.test(url))assert.match(url,/\?v=V8\.2\.2-R8$/,url);
 }
 const css=fs.readFileSync(path.join(root,'research-mobile-v1.css'),'utf8');assert.match(css,/research-stock-card/);assert.match(css,/@media\(max-width:600px\)/);
});
