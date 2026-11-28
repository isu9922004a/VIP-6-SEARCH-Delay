import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
function harness(){
 const ui={};
 for(const id of ['lineSharePanel','lineShareImg','lineShareSave','lineSharePrev','lineShareNext','imageShareButton','lineShareStatus'])ui[id]={id,disabled:false,style:{},textContent:'',removeAttribute(){}};
 const drawings=[];
 const ctx={font:'20px sans-serif',textBaseline:'alphabetic',textAlign:'left',fillStyle:'white',
  setTransform(...params){drawings.push(['transform',...params]);},fillRect(...params){drawings.push(['rect',...params]);},fillText(...params){drawings.push(['text',...params]);},
  measureText(s){const px=Number(this.font.match(/(\d+)px/)?.[1]||20);return {width:[...String(s)].reduce((v,c)=>v+(/\p{Script=Han}/u.test(c)?px:px*.59),0)};},
  drawImage(source){assert.fail('A lazy image descriptor must be rendered through renderExportRegion, not drawImage(descriptor)');}};
 let requestedShare=0;
 const root={Blob,File,Date,Number,Math,Promise,JSON,URL:{createObjectURL:()=>`blob:mock-${Math.random()}`,revokeObjectURL:()=>{}},setTimeout,
  document:{getElementById:id=>ui[id]||null,createElement(type){assert.equal(type,'canvas');return {width:0,height:0,dataset:{},getContext:()=>ctx,toBlob(callback,type='image/png'){callback(new Blob([new Uint8Array([1,2,3,4])],{type}));}}}},
  navigator:{userAgent:'Mock',canShare:d=>d?.files?.[0]?.type==='image/jpeg',share:async()=>{requestedShare++;}}};
 vm.runInNewContext(source('mobile-image-share-v1.js'),root);
 return {root,ctx,ui,drawings,shares:()=>requestedShare};
}
function structure(h){
 const r=h.root;
 r.ShitouStructureCore={top8Decision:()=>({allowed:true}),lines:c=>[c.code,c.name]};
 r.ShitouStructureScanner={assertSnapshot(s){assert.ok(s.modeResults);}};
 vm.runInNewContext(source('structure-reversal-report-v1.js'),r);
 const c={code:'9917',name:'中保科',confirmed:true,eligible:false,label:'回測守住',monthlyStatus:'UNAVAILABLE',quality:{source:'DAILY_ONLY',snapshotHash:'abc',basisVerified:false},score:{total:100},tradeFitness:{score:80,grade:'WATCHABLE'},risk:{gapTriggerPct:.94,structureRiskPct:1.4,reasons:[],currentWarnings:[]},event:{trigger:106.5,invalidation:106,signalDate:'2026-10-07',confirmedDate:'2026-10-12',retestDate:'2026-10-22'},features:{close:107.5,ma20:106.83,tradeValue:36258812,volumeRatio5:1.08,rsi5:54.59,candle:{position:1}}};
 const scan={id:'abc',date:'2026-10-22',release:'R5.3.2.8.1-STRUCTURECARD.1-FIXPACK.2-LINESHARE.1',planned:740,attempted:740,fullMarketCertified:false,modeResults:{A:{top8:[c],counts:{confirmed:36,data:26}}}};
 return r.ShitouStructureReport.pages(scan,{kind:'top8',mode:'A'})[0];
}
function restaurant(h){
 const r=h.root;
 r.ShitouRestaurantCore={MODEL:'RESTAURANT_BALANCED_1',number:v=>Number.isFinite(v)?v:null,price:v=>Number.isFinite(v)?v.toFixed(2):'未驗證',displayName:(code,c)=>c.name,lines:c=>[c.name,c.code]};
 r.ShitouRestaurantScanner={assertSnapshot(s){assert.ok(s.candidates);}};
 r.ShitouIndicatorShadow={wrapImageText:(ctx,s)=>[s],capture:()=>({rows:[]})};
 vm.runInNewContext(source('restaurant-report-v1.js'),r);
 const c={code:'1709',name:'和益',status:'WATCH',label:'附警訊觀察',sourceCheckState:'UNVERIFIED',monthlyStatus:'UNAVAILABLE',reasons:['觀察','弱收盤'],validation:{id:'abc',date:'2026-10-22',market:'TWSE',basisVerified:false,closeLocation:{status:'OK',position:1,midpoint:56,belowMidpoint:false},invalidation:{status:'OK',close:55.3,threshold:51.3,relation:'>',breached:false}},levels:{invalidation:51.3,pressure:66.3},features:{volumeRatio5:.78,volumeRatio20:.61,gap20Pct:.01,cmf20:.16,ma20:55.29,return10Pct:-8.14},event:{kind:'ESTIMATED',date:'2026-10-20',age:2}};
 const scan={date:'2026-10-22',release:'R5.3.2.8.1-STRUCTURECARD.1-FIXPACK.2-LINESHARE.1',snapshotId:'abc',attempted:773,planned:773,candidates:[c],dataUnavailable:29,sourceVerifiedMatches:0,fullMarketCertified:false};
 return r.ShitouRestaurantReport.pages(scan,{limit:8})[0];
}
for(const [name,build] of [['第六濾網單張',structure],['第五濾網單張',restaurant]]){
 test(`${name}: PNG and iPhone JPEG sharing adapter agree and LINE button is enabled`,async()=>{
  const h=harness(),descriptor=build(h);
  assert.equal(descriptor.width,1284);assert.equal(descriptor.height,2778);
  assert.equal(typeof descriptor.renderExportRegion,'function');
  const tile=descriptor.renderExportRegion({top:512,height:512,scale:.5});
  assert.equal(tile.width,642);assert.equal(tile.height,256);
  assert.ok(h.drawings.some(op=>op[0]==='transform'&&op[1]===.5&&op[6]===-256));
  const state=await h.root.ShitouImageShareV1.prepare(descriptor,{filename:'TEST_TOP8.png'});
  assert.ok(state?.files?.length===1);
  assert.equal(state.files[0].type,'image/jpeg');assert.equal(h.ui.imageShareButton.disabled,false);
  assert.match(h.ui.imageShareButton.textContent,/分享目前圖片到 LINE/);
  await h.root.ShitouImageShareV1.shareCurrent();
  assert.equal(h.shares(),1);
  let png=null;descriptor.toBlob(x=>png=x,'image/png');assert.equal(png?.type,'image/png');
 });
}
