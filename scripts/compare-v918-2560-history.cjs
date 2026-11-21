'use strict';
// Exploratory comparison on verified contemporary research history, NOT a point-in-time universe backtest.
// Both strategies use the same verified bars, costs, and strictly subsequent execution assumptions.
const COST=Object.freeze({buyFeePct:.1425,sellFeePct:.1425,taxPct:.3,slippagePerSidePct:.05,description:'研究假設：買賣手續費各0.1425%、賣出稅0.3%、買賣滑價各0.05%'});
function avg(rows,i,n,key){if(i+1<n)return null;let total=0;for(let j=i-n+1;j<=i;j++){const x=rows[j]?.[key];if(!Number.isFinite(x)||x<=0)return null;total+=x;}return total/n;}
function breakout(rows,i){const before=avg(rows,i-1,25,'close'),now=avg(rows,i,25,'close');return !!(before&&now&&rows[i-1]?.close<=before&&rows[i].close>now);}
function study({lookback=120,cost=COST}={}){
 if(!Number.isInteger(lookback)||lookback<30)throw Error('研究回看期間不足');
 const results={original:[],continuation:[]};let stocks=0,barDates=new Set(),oldSignals=0,newSignals=0;
 function add(code,bars){
  if(!Array.isArray(bars)||bars.length<65)return;stocks++;
  const seenOriginal=new Set(),seenContinuation=new Set(),start=Math.max(59,bars.length-lookback);
  for(let i=start;i+5<bars.length;i++){
   const ma25=avg(bars,i,25,'close'),ma5=avg(bars,i,5,'close'),ma40=avg(bars,i,40,'close'),vma5=avg(bars,i,5,'volume'),vma60=avg(bars,i,60,'volume');
   if(!(ma25&&ma5&&ma40&&vma5&&vma60&&bars[i].close>ma25&&ma5>ma40&&vma5>vma60))continue;
   let latestBreakout=null;for(let j=i;j>=i-2;j--)if(breakout(bars,j)){latestBreakout=j;break;}
   if(latestBreakout===null)continue;
   for(const [mode,enabled,seen]of [['continuation',true,seenContinuation],['original',latestBreakout===i,seenOriginal]]){
    if(!enabled||seen.has(latestBreakout))continue;seen.add(latestBreakout);
    const entry=bars[i+1]?.open;if(!(Number.isFinite(entry)&&entry>0))continue;
    const data={code,signalDate:bars[i].date,breakoutDate:bars[latestBreakout].date,breakoutAge:i-latestBreakout,entryDate:bars[i+1].date,outcomes:{}};
    const buy=entry*(1+(cost.buyFeePct+cost.slippagePerSidePct)/100);
    for(const horizon of [1,3,5]){
     const end=bars[i+horizon],held=bars.slice(i+1,i+horizon+1);
     if(!end||held.length!==horizon||held.some(b=>!(b.open>0&&b.low>0&&b.close>0)))continue;
     const sell=end.close*(1-(cost.sellFeePct+cost.taxPct+cost.slippagePerSidePct)/100);
     data.outcomes[horizon]={netPct:(sell/buy-1)*100,grossPct:(end.close/entry-1)*100,maePct:(Math.min(...held.map(b=>b.low))/entry-1)*100};
    }
    results[mode].push(data);barDates.add(bars[i].date);
    if(mode==='original')oldSignals++;else newSignals++;
   }
  }
 }
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,median=a=>{const v=a.slice().sort((x,y)=>x-y),m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;};
 function report(){
  const modes={};for(const [mode,trades] of Object.entries(results)){
   const horizons={};for(const h of [1,3,5]){const v=trades.map(x=>x.outcomes[h]).filter(Boolean),returns=v.map(x=>x.netPct),adverse=v.map(x=>x.maePct);
    horizons[h]=v.length?{sampleSize:v.length,winRatePct:returns.filter(x=>x>0).length/v.length*100,averageNetPct:mean(returns),medianNetPct:median(returns),averageAdversePct:mean(adverse),worstAdversePct:Math.min(...adverse)}:{sampleSize:0,winRatePct:null,averageNetPct:null,medianNetPct:null,averageAdversePct:null,worstAdversePct:null};
   }
   modes[mode]={signals:trades.length,horizons,breakoutAgeCounts:Object.fromEntries([0,1,2].map(age=>[age,trades.filter(x=>x.breakoutAge===age).length]))};
  }
  const dates=[...barDates].sort();
  return {version:'V9.18',state:'EXPLORATORY_HISTORICAL_COMPARISON_NOT_VALIDATED',strategy:'2560',oldDefinition:'當日收盤新突破MA25+最新守MA25+VMA5>VMA60+MA5>MA40',newDefinition:'最近3個完成日K內新突破MA25+最新守MA25+VMA5>VMA60+MA5>MA40',
   lookbackRequestedSessions:lookback,stocksWithAtLeast65Bars:stocks,signalDateFirst:dates[0]||null,signalDateLast:dates.at(-1)||null,uniqueSignalDates:dates.length,cost,modes,
   limitations:['採目前可驗證的股票母體與歷史日K，未取得所有歷史日期的逐日市場母體與當時產業分類，存在存活者偏差','同一突破事件每個模式只計第一次同時符合的訊號，避免連日重複計算','訊號收盤後下一交易日開盤為假設進場，持有1/3/5交易日後收盤假設出場，未檢查撮合與漲跌停成交限制','所有收益已扣估計交易費用、稅及滑價；未驗證未來績效，亦非正式樣本外測試','不宣稱最大投資組合回撤：並無資金配置或持倉重疊處理，僅提供單筆最大不利波動']};
 }
 return Object.freeze({add,report});
}
module.exports={study,COST,avg,breakout};
