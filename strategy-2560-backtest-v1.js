/* Independent research only. Never fills at an already elapsed signal-day close. */
(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./strategy-2560-v1'):r.ShitouStrategy2560);if(N)module.exports=a;else r.ShitouStrategy2560Backtest=a;})(globalThis,function(C){
'use strict';
const COST=Object.freeze({buyFeePct:.1425,sellFeePct:.1425,taxPct:.3,slippagePct:.05,version:'RESEARCH_COST_ASSUMPTION_1'});
function replay(dataset,{testStart,testEnd,cost=COST}={}){const fail=reason=>({state:'NOT_VALIDATED',reason,performanceValidated:false,trades:[],strategy:C.MODEL});
 if(!dataset?.pointInTimeUniverseVerified||!dataset?.priceHistoryVerified||!dataset?.calendarVerified||!dataset?.corporateActionsVerified)return fail('缺少當時的股票母體、完成日K、日曆或公司行動證明，不能回報正式績效');
 if(!testStart||!testEnd||testStart>testEnd)return fail('缺少事先固定的樣本外測試日期');
 if(!['buyFeePct','sellFeePct','taxPct','slippagePct'].every(k=>Number.isFinite(cost[k])&&cost[k]>=0))return fail('交易成本未完整定義');
 const records=[],restricted=[],trades=[];
 for(const series of dataset.series||[]){let holding=null;const bars=series.report.canonicalBars;
  for(let i=59;i<bars.length;i++){const b=bars[i],next=bars[i+1];if(b.date>testEnd)break;
   if(holding&&holding.exitSignal){holding.exitDate=b.date;holding.exit= b.open;holding.netReturnPct=(holding.exit*(1-(cost.sellFeePct+cost.taxPct+cost.slippagePct)/100)/holding.entryCost-1)*100;trades.push(holding);holding=null;}
   const sector=series.sectorsByDate?.[b.date];if(!sector){restricted.push({code:series.report.stock,date:b.date,reason:'缺少當日產業分類'});continue;}
   const prefix=bars.slice(0,i+1),report={...series.report,closeDate:b.date,marketDate:b.date,dataDate:b.date,close:b.close,canonicalBars:prefix,dailySeries:prefix,expectedTradingDates:series.report.expectedTradingDates.filter(d=>d<=b.date)},quote={...b,code:report.stock,market:report.market,quoteDate:b.date,securityType:'COMMON_STOCK'},a=C.evaluate(report,{asOf:b.date,quote,sector});
   if(b.date<testStart)continue;records.push({code:report.stock,signalDate:b.date,status:a.status,eligible:a.eligible,exitWarning:a.exitWarning});
   if(a.status==='DATA'){restricted.push({code:report.stock,date:b.date,reason:a.reasons.join('；')});continue;}
   // V9.1 has no defined exit signal; MA5 deviations never trigger a liquidation.
   if(!holding&&a.eligible&&next&&next.date<=testEnd){const buy=next.open,entryCost=buy*(1+(cost.buyFeePct+cost.slippagePct)/100),outcomes={};for(const h of [1,3,5]){const z=bars[i+h];outcomes[h]=z&&z.date<=testEnd?{date:z.date,entryDate:next.date,grossPct:(z.close/buy-1)*100,netPct:(z.close*(1-(cost.sellFeePct+cost.taxPct+cost.slippagePct)/100)/entryCost-1)*100,mfePct:(Math.max(...bars.slice(i+1,i+h+1).map(x=>x.high))/buy-1)*100,maePct:(Math.min(...bars.slice(i+1,i+h+1).map(x=>x.low))/buy-1)*100}:null;}holding={code:report.stock,signalDate:b.date,entryDate:next.date,entry:buy,entryCost,outcomes,exitSignal:null};}
  }if(holding)trades.push({...holding,open:true});
 }
 const complete=trades.filter(x=>!x.open),values=complete.map(x=>x.netReturnPct);return {state:'RESEARCH_ONLY',strategy:C.MODEL,testStart,testEnd,cost,records,restricted,trades,sampleSize:complete.length,meanNetReturnPct:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,winShare:values.length?values.filter(x=>x>0).length/values.length:null,performanceValidated:false,limitations:['未完成與原餐廳策略的同股同日樣本外比較','仍需市場階段、換手、信賴區間與組合回撤驗證','成本為研究假設；未模擬委託排隊、停牌或漲跌停成交限制']};
}
return Object.freeze({COST,replay});
});
