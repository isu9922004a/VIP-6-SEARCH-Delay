'use strict';
// Synthetic test data only. These receipts are never loaded by the website.
function fixture({count=80,code='2330',market='TWSE'}={}){
 const C=require('../restaurant-filter-v1.js'),bars=[];
 for(let i=0;i<count;i++){const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),close=100+i*.05;bars.push({date,open:close-.1,high:close+.2,low:close-.2,close,volume:1000000});}
 const last=bars.at(-1),previous=bars.at(-2),limit=C.estimatedUpper(previous.close);
 Object.assign(last,{open:limit-.5,high:limit,low:limit-1,close:limit,volume:500000});
 const date=last.date,record={verified:true,date,code,market,source:'fixture://synthetic-only'},report={stock:code,name:'測試六項策略（合成資料）',market,closeDate:date,marketDate:date,completed:true,isComplete:true,dataTiming:'POST_CLOSE_ONLY',close:last.close,volumeUnit:'shares',dailySeries:bars,canonicalBars:structuredClone(bars),expectedTradingDates:bars.map(b=>b.date),priceAdjustment:{verified:true,basis:'FIXTURE_RAW'},restaurantEvidence:{limits:[{...record,limitUpPrice:limit}],mainNetBuyShare:{...record,definition:'MAIN_NET_BUY_VOLUME_OVER_TOTAL_VOLUME',valuePct:6},jma20:{...record,period:20,value:limit-1,formulaId:'FIXTURE_JMA20'}}};
 const quote={...last,quoteDate:date,code,name:report.name,market,tradeValue:last.close*last.volume,officialTradeValue:last.close*last.volume,tradeValueSource:'OFFICIAL_REPORTED',securityType:'COMMON',industryCode:'24',industryName:'半導體業'};
 const options={asOf:date,code,quote,meta:{targetTradeDate:date,completedTradeDate:date,marketCoverageReady:true,commonStockUniverseVerified:true},valueRank:50,valueRankVerified:true,baselineValueRank:50,eventWindow:1};
 return {report,options,date,quote};
}
function refresh(f){const last=f.report.dailySeries.at(-1);f.report.close=last.close;f.report.canonicalBars=structuredClone(f.report.dailySeries);Object.assign(f.options.quote,last,{quoteDate:f.date});return f;}
module.exports={fixture,refresh};
