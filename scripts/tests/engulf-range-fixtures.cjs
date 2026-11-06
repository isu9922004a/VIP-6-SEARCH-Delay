'use strict';
const W=require('../../worker-data-contract-v1.js');
function dates(count){const out=[],d=new Date('2025-01-02T00:00:00Z');while(out.length<count){if(d.getUTCDay()!==0&&d.getUTCDay()!==6)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}return out;}
function bars(count=35){return dates(count).map(date=>({date,open:20,high:21,low:19,close:20,volume:100000,completed:true}));}
function append(rows,values){const date=dates(rows.length+1).at(-1);rows.push({date,completed:true,...values});return rows;}
function report(rows=bars(),extra={}){const day=rows.at(-1).date;return W.seal({stock:'9001',code:'9001',market:'TWSE',securityType:'COMMON',name:'合成測試',tickRuleVerified:true,completed:true,isComplete:true,closeDate:day,marketDate:day,close:rows.at(-1).close,volumeUnit:'shares',expectedTradingDates:rows.map(x=>x.date),tradingCalendar:{verified:true,source:'SYNTHETIC_TEST_CALENDAR',dates:rows.map(x=>x.date),start:rows[0].date,end:day},priceAdjustment:{verified:true,corporateActionsVerified:true,basis:'SYNTHETIC_TEST_BASIS'},scanMode:'DAILY_ONLY',dailySeries:rows.map(x=>({...x})),dailySeriesMeta:{schema:'daily-ohlcv-v1',source:'SYNTHETIC_TEST_OFFICIAL_ADAPTER',mode:'DAILY_ONLY',onlyCompletedBars:true,volumeUnit:'shares'},...extra},{evidence:W.unitEvidence(['TWSE_STOCK_DAY']),snapshotVerified:true});}
function bullish({full=true,volume=150000,price=true}={}){const b=bars();b[b.length-1]={...b.at(-1),open:20.5,close:20,high:21,low:19.5};append(b,{open:19.95,close:price?21.1:20.75,high:21.2,low:full?19.4:19.8,volume});return b;}
function bearish(){const b=bars();b[b.length-1]={...b.at(-1),open:20,close:20.5,high:21,low:19.9};append(b,{open:20.6,close:19.8,high:21.1,low:19.7,volume:150000});return b;}
function breakout({up=true,volume=150000}={}){const b=bars();return append(b,up?{open:20.6,high:22,low:20.5,close:21.8,volume}:{open:19.3,high:19.4,low:18,close:18.2,volume});}
module.exports={dates,bars,append,report,bullish,bearish,breakout};
