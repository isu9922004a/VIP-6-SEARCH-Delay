/* V9.2 life-line read-only, point-in-time fixed-horizon study; no execution signal. */
(function(root,factory){
 const node=typeof module==='object'&&!!module.exports;
 const api=factory(node?require('./kline-life-03-core-v1.js'):root.ShitouKlineLife03);
 if(node)module.exports=api;else root.ShitouKlineLife03Backtest=api;
})(globalThis,function(Life){
'use strict';
const VERSION='LIFE03_BACKTEST_V1';
const COST=Object.freeze({buyFeePct:.1425,sellFeePct:.1425,sellTaxPct:.3,slippagePct:.05});
const pct=(a,b)=>b>0?(a/b-1)*100:null;
function replay(dataset,{testStart,testEnd,cost=COST}={}){
 const reject=reason=>({version:VERSION,state:'NOT_VALIDATED',reason,performanceValidated:false,trades:[],records:[],cost});
 if(!dataset?.pointInTimeUniverseVerified||!dataset?.priceHistoryVerified||!dataset?.calendarVerified||!dataset?.corporateActionsVerified)return reject('缺少時點股票母體、價格歷史、交易日曆或除權息驗證');
 if(!testStart||!testEnd||testStart>testEnd)return reject('尚未固定樣本外研究期間');
 if(!['buyFeePct','sellFeePct','sellTaxPct','slippagePct'].every(k=>Number.isFinite(cost[k])&&cost[k]>=0))return reject('買賣成本假設無效');
 const records=[],trades=[],unverified=[];
 for(const series of dataset.series||[]){
  const bars=series.report?.canonicalBars||series.bars||[],code=String(series.code||series.report?.stock||'');
  if(!/^\d{4,6}$/.test(code)||bars.length<5){unverified.push({code,reason:'完成日K不足'});continue;}
  if(bars.some((b,i)=>!Number.isFinite(b.open)||!Number.isFinite(b.close)||!Number.isFinite(b.low)||!Number.isFinite(b.high)||b.low<=0||b.high<b.low||i>0&&bars[i-1].date>=b.date)){unverified.push({code,reason:'日K不合法或日期有缺口'});continue;}
  for(let i=4;i<bars.length;i++){
   const b=bars[i];if(b.date<testStart||b.date>testEnd)continue;
   const report={code,stock:code,name:series.name||'',date:b.date,sourceBars:bars.slice(0,i+1),validation:{technicalModelAvailable:true}};
   const a=Life.evaluate(report);
   records.push({code,date:b.date,status:a.state,eventId:a.event?.eventId||null});
   if(a.state==='INSUFFICIENT_DATA'){unverified.push({code,date:b.date,reason:a.reason});continue;}
   if(!['TURNING_STRONG','TURNING_WEAK'].includes(a.state))continue;
   const next=bars[i+1],costOpen=next?.open;
   if(!(costOpen>0)||next.date>testEnd){unverified.push({code,date:b.date,reason:'隔日開盤缺失或超出期間'});continue;}
   const entry=costOpen*(1+(cost.buyFeePct+cost.slippagePct)/100),outcomes={};
   for(const n of [1,3,5]){
    const future=bars[i+n],range=bars.slice(i+1,i+n+1);
    if(!future||future.date>testEnd||range.length!==n){outcomes[n]=null;continue;}
    const exit=future.close*(1-(cost.sellFeePct+cost.sellTaxPct+cost.slippagePct)/100);
    outcomes[n]={date:future.date,entryDate:next.date,netPct:pct(exit,entry),grossPct:pct(future.close,costOpen),
      mfePct:pct(Math.max(...range.map(z=>z.high)),costOpen),maePct:pct(Math.min(...range.map(z=>z.low)),costOpen)};
   }
   trades.push({code,signalDate:b.date,signal:a.state,entryDate:next.date,entryOpen:costOpen,outcomes,
    researchOnly:true,actualExecution:false,exitRule:'FIXED_HORIZON_ONLY'});
  }
 }
 return {version:VERSION,state:'RESEARCH_ONLY',performanceValidated:false,studiedSignals:trades.length,
  records,trades,unverified,cost,testStart,testEnd,
  methodology:'樣本外期間僅用訊號日當時已知日K辨識生命線；隔日開盤僅作假設買入；固定1/3/5日研究；不代表可交易策略',
  note:'尚未取得時間外推驗證及信賴區間，不能宣稱V9.2比V9.1更會選股或有已證實勝率'};
}
return Object.freeze({VERSION,COST,replay});
});
