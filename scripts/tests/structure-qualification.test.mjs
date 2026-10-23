import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../../structure-reversal-core-v1.js');
const S=require('../../structure-reversal-scanner-v1.js');
const DAY='2026-10-22';
function meta(size){return {targetTradeDate:DAY,completedTradeDate:DAY,expectedTradeDate:DAY,twseQuoteDate:DAY,tpexQuoteDate:DAY,marketCoverageReady:true,industryCoverageReady:true,snapshotTimelinessReady:true,exclusionCoverageReady:true,exclusionDate:DAY,total:size};}
function quote(code,extra={}){return {code:String(code),name:'測試普通個股',market:'TWSE',industryCode:'05',industryName:'電機機械',open:100,high:104,low:98,close:102,volume:1000000,tradeValue:102000000,quoteDate:DAY,...extra};}
function classify(q,m={}){return C.classify(q.code,q,q,{...meta(1949),snapshotRowCount:1949,...m});}

test('未傳入公司主檔額外欄位但行情及產業官方覆蓋完整：允許研究、不虛構普通股認證',()=>{
 const x=classify(quote('2330'));
 assert.equal(x.excluded,false);
 assert.equal(x.provisional,true);
 assert.equal(x.ordinaryVerified,false);
 assert.match(x.qualificationSource,/僅供研究/);
});
test('受正式普通股欄位認證者可核驗；不得讓備援掩飾不完整或過期快照',()=>{
 assert.equal(classify(quote('2330',{securityType:'COMMON_STOCK'})).ordinaryVerified,true);
 assert.equal(classify(quote('2330'),{industryCoverageReady:false}).key,'UNKNOWN');
 assert.equal(classify(quote('2330',{quoteDate:'2026-10-21'})).key,'UNKNOWN');
 assert.equal(classify(quote('2330'),{snapshotRowCount:1948}).key,'UNKNOWN');
});
test('排除順序及特殊證券不因資格備援放寬',()=>{
 assert.equal(classify(quote('2881',{industryCode:'17',industryName:'金融保險'})).key,'FINANCIAL');
 assert.equal(classify(quote('1781',{industryCode:'22',industryName:'生技醫療'})).key,'BIOTECH');
 assert.equal(classify(quote('2501',{industryCode:'14',industryName:'建材營造'})).key,'CONSTRUCTION');
 assert.equal(classify(quote('1569',{name:'普通-KY'})).key,'KY');
 assert.equal(classify(quote('9101')).key,'DR');
 assert.equal(classify(quote('2330',{securityType:'ETF'})).key,'SPECIAL');
 assert.equal(classify(quote('2330',{name:'台股ETN'})).key,'SPECIAL');
 assert.equal(classify(quote('2330',{volume:50000})).key,'ILLIQUID');
 assert.equal(classify(quote('2330',{industryName:'',industryCode:''})).key,'UNKNOWN');
 assert.equal(classify(quote('2603',{industryName:'航運業',industryCode:'15'})).cyclical,true);
});
test('再現實際 1949 檔完整市場、沒有 securityType 時，不應出現全部 UNKNOWN 或初篩零檔',()=>{
 const map=new Map(),sectorMap=new Map();
 for(let i=0;i<1949;i++){
   const code=String(i+1000);
   const q=quote(code,{market:i%2?'TWSE':'TPEX'});
   map.set(code,q);sectorMap.set(code,q);
 }
 const plan=S.pool({map,sectorMap,meta:meta(1949),snapshotRows:1949});
 assert.equal(plan.universe,1949);
 assert.equal(plan.parsed,1949);
 assert.equal(plan.items.length,1949);
 assert.equal(plan.counts.UNKNOWN||0,0);
 assert.equal(plan.items[0].qualification.provisional,true);
});
test('上游資料真缺失時停止掃描，不把初篩失效報成完整市場零檔結果',()=>{
 const map=new Map(),sectorMap=new Map();
 for(let i=0;i<1949;i++){const code=String(i+1000),q=quote(code);map.set(code,q);sectorMap.set(code,q);}
 assert.throws(()=>S.pool({map,sectorMap,meta:{...meta(1949),industryCoverageReady:false},snapshotRows:1949}),/市場初篩異常/);
});
test('資格尚待核驗即使日 K 基準可驗證也不應變成正式進場信號',()=>{
 const q=quote('2330');const qualifier=classify(q);
 let days=[];for(let t=Date.parse(DAY+'T00:00:00Z');days.length<90;t-=86400000){const d=new Date(t).getUTCDay();if(d&&d!==6)days.unshift(new Date(t).toISOString().slice(0,10));}
 const bars=days.map((date,i)=>({date,open:100+i*.05,high:102+i*.05,low:98+i*.05,close:101+i*.05,volume:1000000}));
 const final=bars.at(-1),report={stock:'2330',code:'2330',market:'TWSE',closeDate:DAY,close:final.close,completed:true,dailySeries:bars,volumeUnit:'shares',priceAdjustment:{verified:true},expectedTradingDates:days};
 const cand=C.evaluate(report,{mode:'A',asOf:DAY,code:'2330',name:'測試',qualification:qualifier});
 assert.equal(cand.eligible,false);
 if(cand.quality)assert.equal(cand.quality.qualificationVerified,false);
});
