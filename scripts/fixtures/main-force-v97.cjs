'use strict';
// Explicit synthetic unit/UI fixtures; never used by the production scanner or real-data audit.
function sample({close=10.2,volume=1000000,industryCode='24',industryName='半導體業'}={}){
 const sessions=require('../../data/research/manifest.json').researchSessions.slice(-30),bars=sessions.map(date=>({date,open:10,high:10.1,low:9.9,close:10,volume}));
 const four=[{open:10.05,high:10.4,low:10,close:10.2},{open:10.2,high:10.6,low:10.1,close:10.3},{open:10.3,high:10.8,low:10.1,close:10.4},{open:10.2,high:10.5,low:Math.min(10.1,close),close}];four.forEach((b,i)=>Object.assign(bars[bars.length-4+i],b));
 const date=sessions.at(-1),raw={stock:'9001',code:'9001',name:'合成測試股票',market:'TWSE',date,closeDate:date,marketDate:date,close,completed:true,securityType:'COMMON',priceAdjustment:{verified:true,basis:'UNADJUSTED_OFFICIAL_OHLC',corporateActionsVerified:false},sourceBars:bars,validation:{technicalModelAvailable:true},expectedTradingDates:sessions};
 const quote={code:raw.stock,name:raw.name,market:'TWSE',quoteDate:date,industryCode,industryName,...bars.at(-1)};
 return {raw,quote,targetDate:date,sessions,exclusions:{ready:true,date,sources:['https://www.twse.com.tw/exchangeReport/TWT85U?response=json&date='+date.replaceAll('-',''),'https://www.tpex.org.tw/openapi/v1/tpex_cmode'],twseCodes:[],tpexCodes:[],specialCodes:[]},liquidity:{code:raw.stock,market:raw.market,date,verified:true,tradeValue:60000000,...bars.at(-1),security:{code:raw.stock,market:raw.market,asOf:date,listingDate:'2000-01-01',type:'COMMON',cfi:'ESVUFR',industryName}},proof:{sha256:'a'.repeat(64),snapshotId:'UNIT_TEST_ONLY'}};
}
module.exports={sample};
