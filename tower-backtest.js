/* Prefix-only replay. Indicative next-open executions require explicit metadata.
   Independent event-study returns are NOT a portfolio and do not imply live fills. */
(function(root,factory){const N=typeof module==='object'&&module.exports,api=factory(N?require('./tower-trend-classifier.js'):root.ShitouTowerTrend);if(N)module.exports=api;else root.ShitouTowerBacktest=api;})(typeof globalThis!=='undefined'?globalThis:this,function(A){
'use strict';
const mean=a=>a.length?a.reduce((a,b)=>a+b,0)/a.length:null;
function execute(b,index,horizon,cost){
 if(index+horizon>=b.length)return {status:'UNFINISHED'};
 const entry=b[index+1],exit=b[index+horizon];
 if(!entry||!exit||entry.tradable!==true||exit.tradable!==true||entry.limitLocked===true||exit.limitLocked===true||!(entry.volume>0&&exit.volume>0))return {status:'UNAVAILABLE',reason:'成交性、漲跌停或停牌資訊未確認'};
 if(!cost||!['commissionRate','sellTaxRate','slippageRate','shares','minimumCommission'].every(k=>Number.isFinite(cost[k])&&cost[k]>=0)||!(cost.shares>0))return {status:'UNAVAILABLE',reason:'缺明示交易成本設定'};
 const buy=entry.open*(1+cost.slippageRate),sell=exit.close*(1-cost.slippageRate),cash=buy*cost.shares,buyFee=Math.max(cost.minimumCommission,cash*cost.commissionRate),revenue=sell*cost.shares,sellFee=Math.max(cost.minimumCommission,revenue*cost.commissionRate),tax=revenue*cost.sellTaxRate;
 if(!(buy>0&&sell>0)||buy>entry.high||buy<entry.low||sell>exit.high||sell<exit.low)return {status:'UNAVAILABLE',reason:'滑價後價格在當日高低之外'};
 const future=b.slice(index+1,index+horizon+1),net=((revenue-sellFee-tax)/(cash+buyFee)-1)*100,mae=(Math.min(...future.map(r=>r.low))/buy-1)*100;
 return {status:'COMPLETE',entryDate:entry.date,exitDate:exit.date,horizon,buy,sell,grossPct:(sell/buy-1)*100,netPct:net,maePct:mae,cost:{buyFee,sellFee,tax},method:'訊號次日開盤→第N日收盤；獨立事件研究'};
}
function stats(trades){const n=trades.length;return {signals:n,winRate:n?trades.filter(t=>t.netPct>0).length/n:null,expectancyPct:mean(trades.map(t=>t.netPct)),meanGrossPct:mean(trades.map(t=>t.grossPct)),worstMAEPct:n?Math.min(...trades.map(t=>t.maePct)):null,maxPortfolioDrawdown:null,drawdownReason:'重疊訊號獨立事件研究，未配置資金與持倉組合，不虛構组合最大回撤'};}
function replay(report,options={}){
 const b=report.dailySeries||[],horizons=options.horizons||[1,3,5,10],streams={},skips={},signals=[];
 const keys=['ORIGINAL_MAIN','MAIN_OBSERVATION','MAIN_RISK','ORIGINAL_DAYTRADE','DAYTRADE_OBSERVATION','DAYTRADE_RISK','ORIGINAL_STRONG','STRONG_OBSERVATION','STRONG_RISK','TOWER_A_RAW','TOWER_A_RISK','TOWER_B_RAW','TOWER_B_RISK'];
 for(const k of keys){streams[k]={};skips[k]={};for(const h of horizons){streams[k][h]=[];skips[k][h]=0;}}
 if(b.length<61)return {status:'UNAVAILABLE',reason:'不足60根暖機加隔日開盤；不產生績效',bars:b.length,streams};
 if(report.priceAdjustment?.verified!==true||options.pointInTimeUniverse!==true)return {status:'UNAVAILABLE',reason:'缺可追溯除權息調整或歷史當時股票母體，無法排除存活者偏差',bars:b.length,streams};
 for(let i=59;i<b.length-1;i++){
  const prefix=b.slice(0,i+1),date=b[i].date,monthly=options.monthlyAt?.(date)||{};
  const past={stock:report.stock,code:report.code,name:report.name,priceAdjustment:report.priceAdjustment,dailySeriesMeta:report.dailySeriesMeta,corporateActions:(report.corporateActions||[]).filter(e=>e.date<=date),...monthly,dailySeries:prefix,close:b[i].close,closeDate:date,expectedTradingDates:report.expectedTradingDates?.filter(d=>d<=date)};
  // Do not reuse final-report monthly eligibility, market context or pivots in history.
  for(const k of ['entry','monthlyPass','startMonth','startMonthConfirmed','latestMA','marketDate','canonicalBars','decisionLayer','pressureMap','supportMap','abc','tacticalN'])delete past[k];
  Object.assign(past,monthly);
  const market=options.marketAt?.(date),a=A.analyze(past,{asOf:date,completed:true,marketTower:market});
  if(!a.tower.ok||!a.risk.ok)continue;
  const chosen=[],riskOK=!['NO_CHASE','REJECT','DATA_UNAVAILABLE'].includes(a.risk.status);
  if(a.type){chosen.push('TOWER_'+a.type+'_RAW');if(riskOK)chosen.push('TOWER_'+a.type+'_RISK');}
  for(const [kind,label]of [['main','MAIN'],['dayTrade','DAYTRADE'],['strong','STRONG']]){
   const evaluate=options.originalEvaluators?.[kind];if(!evaluate)continue;
   const original=evaluate(structuredClone(past),date);if(original?.eligible){chosen.push('ORIGINAL_'+label,label+'_OBSERVATION');if(riskOK)chosen.push(label+'_RISK');}
  }
  signals.push({date,type:a.type,status:a.status,redDays:a.tower.states[3].redDays,t3t5Aligned:a.tower.trendAligned,rsi5:a.risk.features.rsi5,regime:market?.regime||'UNAVAILABLE',streams:chosen});
  for(const k of chosen)for(const h of horizons){const t=execute(b,i,h,options.cost);if(t.status==='COMPLETE')streams[k][h].push({...t,signalDate:date});else skips[k][h]++;}
 }
 const summary=Object.fromEntries(keys.map(k=>[k,Object.fromEntries(horizons.map(h=>[h,{...stats(streams[k][h]),skipped:skips[k][h],signalCount:signals.filter(s=>s.streams.includes(k)).length}]))]));
 return {status:'EVENT_STUDY',signals,streams,summary,missingOriginalEvaluators:['main','dayTrade','strong'].filter(k=>!options.originalEvaluators?.[k]),limitations:['未含組合倉位與最大回撤','成交性標記需外部歷史來源佐證','樣本外切分需另提供固定訓練／驗證區間','當沖策略用日K僅驗證隔日事件，不等於盤中策略回測']};
}
return Object.freeze({execute,stats,replay});
});
