'use strict';
const {report}=require('./research-fixtures.cjs');
// All prices and weekday dates below are synthetic. This is NOT exchange history.
function fixture9933(n=130){
 const dates=[],d=new Date('2026-10-22T00:00:00Z');
 while(dates.length<n){if(d.getUTCDay()>0&&d.getUTCDay()<6)dates.unshift(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()-1);}
 const b=dates.map((date,i)=>{const close=100+i*.05+Math.sin(i)*.25;return {date,open:close-.1,high:close+1,low:close-1,close,volume:1500000};});
 return report(b,{stock:'9933',code:'9933',name:'中鼎',dailySeries:b,dailySeriesMeta:{source:'SYNTHETIC_9933_NOT_REAL_MARKET_DATA',volumeUnit:'shares'},originalB:120,originalInvalidation:90});
}
module.exports={fixture9933};
