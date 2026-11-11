'use strict';
function fixture(prices=[...Array(60).fill(100),115],code='2330'){
 const dates=[];let d=new Date('2026-06-03T00:00:00Z');while(dates.length<prices.length){if(![0,6].includes(d.getUTCDay()))dates.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}
 const bars=prices.map((close,i)=>({date:dates[i],open:close,high:close+1,low:close-1,close,volume:i>=prices.length-5?2000000:1000000})),date=dates.at(-1),report={stock:code,name:'測試股票',market:'TWSE',closeDate:date,close:prices.at(-1),completed:true,volumeUnit:'shares',priceAdjustment:{verified:true,basis:'TEST_UNADJUSTED'},expectedTradingDates:dates,canonicalBars:bars,dailySeries:structuredClone(bars)},quote={...bars.at(-1),code,market:'TWSE',quoteDate:date,volumeUnit:'shares'};
 return {report,options:{asOf:date,code,quote,sector:{industryCode:'24',industryName:'半導體',source:'TEST_ONLY'}},date};
}
function refresh(f){const last=f.report.canonicalBars.at(-1);f.report.dailySeries=structuredClone(f.report.canonicalBars);f.report.close=last.close;Object.assign(f.options.quote,last);return f;}
module.exports={fixture,refresh};
