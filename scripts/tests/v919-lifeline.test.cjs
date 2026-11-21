'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Info=require('../../life-line-intelligence-v913.js');
function fixture(ma5){
 const bars=Array.from({length:30},(_,i)=>({date:'2026-10-'+String(i+1).padStart(2,'0'),close:200-i,low:190-i,high:205-i}));
 bars.at(-2).close=150;bars.at(-1).close=137.5;bars.at(-1).low=137.5;
 return {bars,maSeries:{5:Array(30).fill(ma5)},ma:{5:ma5,10:190.65,20:214.35},events:[],referenceOnly:true,range:{high:235,low:137.5},close:137.5,trend:{state:'WEAK'}};
}
test('V9.19 latest completed MA5 is dynamic and distinct from confirmed historical pressure',()=>{
 const intel={activeResistanceEvent:{lifeLinePrice:181.5}};
 const a=Info.observe(fixture(165.3),intel),b=Info.observe(fixture(160.2),intel);
 assert.equal(a.shortTerm.ma5,165.3);assert.equal(b.shortTerm.ma5,160.2);
 assert.equal(a.shortTerm.historicalResistance,181.5);
 assert.match(a.rebound,/5日均價165\.30 元/);assert.match(b.rebound,/5日均價160\.20 元/);
 assert.match(a.shortTerm.note,/單日站回不等於趨勢轉強/);
 assert.match(a.scenarios[0].text,/當日重算的5日均價/);
});
test('V9.19 stock and index posters separate MA5 and historical levels',()=>{
 for(const f of ['life-line-visual-v913.js','market-life-visual-v913.js']){
  const poster=fs.readFileSync(path.join(__dirname,'../..',f),'utf8');
  for(const word of ['短線5日均價','已確認歷史壓力','反彈不等於轉強','ma5-watch'])assert.ok(poster.includes(word),f+' missing '+word);
 }
});