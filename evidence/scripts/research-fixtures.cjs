function futureDates(date){const rows=[],d=new Date(date+'T00:00:00Z');for(let n=0;n<14;n++){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()>0&&d.getUTCDay()<6)rows.push(d.toISOString().slice(0,10));}return rows;}
/* Explicit synthetic fixtures, never production prices or exchange calendar. */
function bars(n=130,fn=i=>100){const a=[];let d=new Date('2025-01-06T00:00:00Z');while(a.length<n){if(d.getUTCDay()>0&&d.getUTCDay()<6){const close=fn(a.length);a.push({date:d.toISOString().slice(0,10),open:close-.1,high:close+1,low:close-1,close,volume:1500000});}d.setUTCDate(d.getUTCDate()+1);}return a;}
function report(a=bars(),extra={}){const d=a.at(-1).date;return {stock:'9001',name:'合成測試股',market:'TWSE',securityType:'COMMON',tickRuleVerified:true,completed:true,isComplete:true,closeDate:d,marketDate:d,close:a.at(-1).close,canonicalBars:a,volumeUnit:'shares',dailySeriesMeta:{source:'SYNTHETIC_FIXTURE',volumeUnit:'shares'},priceAdjustment:{verified:true,basis:'SYNTHETIC'},expectedTradingDates:a.map(x=>x.date),tradingCalendar:{verified:true,source:'SYNTHETIC_FIXTURE',start:a[0].date,end:futureDates(d).at(-1),dates:[...a.map(x=>x.date),...futureDates(d)]},...extra};}
const W=require('../worker-data-contract-v1.js');
const unsealedReport=report;
function contractReport(a,extra){const r=unsealedReport(a,extra);r.dailySeries=r.dailySeries||r.canonicalBars;r.dailySeriesMeta={...r.dailySeriesMeta,schema:'daily-ohlcv-v1',onlyCompletedBars:r.completed===true};return W.seal(r,{evidence:W.unitEvidence(['YAHOO_CHART'])});}
module.exports={bars,report:contractReport};
