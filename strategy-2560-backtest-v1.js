/* Independent, read-only fixed-horizon research. V9.1 does not define an exit. */
(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./strategy-2560-v1'):r.ShitouStrategy2560);if(N)module.exports=a;else r.ShitouStrategy2560Backtest=a;})(globalThis,function(C){
'use strict';
const COST=Object.freeze({buyFeePct:.1425,sellFeePct:.1425,taxPct:.3,slippagePct:.05,version:'RESEARCH_COST_ASSUMPTION_1'});
function replay(dataset,{testStart,testEnd,cost=COST}={}){
 const fail=reason=>({state:'NOT_VALIDATED',reason,performanceValidated:false,trades:[],strategy:C.MODEL});
 if(!dataset?.pointInTimeUniverseVerified||!dataset?.priceHistoryVerified||!dataset?.calendarVerified||!dataset?.corporateActionsVerified)return fail('缺少當時的股票母體、完成日K、日曆或公司行動證明，不能回報正式績效');
 if(!testStart||!testEnd||testStart>testEnd)return fail('缺少事先固定的樣本外測試日期');
 if(!['buyFeePct','sellFeePct','taxPct','slippagePct'].every(k=>Number.isFinite(cost[k])&&cost[k]>=0))return fail('交易成本未完整定義');
 const records=[],restricted=[],trades=[];
 for(const series of dataset.series||[]){
  const bars=series.report?.canonicalBars||[];
  for(let i=59;i<bars.length;i++){const b=bars[i],next=bars[i+1];if(b.date>testEnd)break;
   const sector=series.sectorsByDate?.[b.date];if(!sector){restricted.push({code:series.report.stock,date:b.date,reason:'缺少當日產業分類'});continue;}
   const prefix=bars.slice(0,i+1),report={...series.report,closeDate:b.date,marketDate:b.date,dataDate:b.date,close:b.close,canonicalBars:prefix,dailySeries:prefix,expectedTradingDates:series.report.expectedTradingDates.filter(d=>d<=b.date)},quote={...b,code:report.stock,market:report.market,quoteDate:b.date,securityType:'COMMON_STOCK'},a=C.evaluate(report,{asOf:b.date,quote,sector});
   if(b.date<testStart)continue;
   records.push({code:report.stock,signalDate:b.date,status:a.status,eligible:a.eligible,exitRule:'NOT_DEFINED'});
   if(['INSUFFICIENT_DATA','DATA_ERROR'].includes(a.status)){restricted.push({code:report.stock,date:b.date,reason:a.reasons.join('；')});continue;}
   if(!a.eligible||!next||next.date>testEnd)continue;
   const buy=next.open;if(!Number.isFinite(buy)||buy<=0){restricted.push({code:report.stock,date:b.date,reason:'下一交易日開盤價不可驗證'});continue;}
   const entryCost=buy*(1+(cost.buyFeePct+cost.slippagePct)/100),outcomes={};
   for(const h of [1,3,5]){
    const z=bars[i+h],range=bars.slice(i+1,i+h+1);
    outcomes[h]=z&&z.date<=testEnd&&range.length===h&&range.every(x=>Number.isFinite(x.close)&&Number.isFinite(x.low)&&Number.isFinite(x.high))
    ?{date:z.date,entryDate:next.date,grossPct:(z.close/buy-1)*100,netPct:(z.close*(1-(cost.sellFeePct+cost.taxPct+cost.slippagePct)/100)/entryCost-1)*100,mfePct:(Math.max(...range.map(x=>x.high))/buy-1)*100,maePct:(Math.min(...range.map(x=>x.low))/buy-1)*100}:null;
   }
   trades.push({code:report.stock,signalDate:b.date,entryDate:next.date,entry:buy,entryCost,outcomes,researchHypothesisOnly:true,actualExecution:false,exitRule:'NOT_DEFINED',autoExit:false});
  }
 }
 return {state:'RESEARCH_ONLY',strategy:C.MODEL,testStart,testEnd,cost,records,restricted,trades,sampleSize:trades.length,meanNetReturnPct:null,winShare:null,performanceValidated:false,limitations:['固定1/3/5交易日假設，僅研究情境；無正式出場規則與自動賣出','成本為假設；沒有任何成交保證，也不把訊號日收盤當成交價','未完成正式樣本外研究、信賴區間與原餐廳策略公平比較']};
}
return Object.freeze({COST,replay});
});
