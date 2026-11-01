(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouIndependentMarket=api;})(globalThis,function(){
'use strict';
function analyze(data){
 const fail=reason=>({state:'UNAVAILABLE',reason});
 if(!data||!['TAIEX','TPEX_INDEX'].includes(data.instrumentType))return fail('請載入加權指數或櫃買指數本身的日K。');
 const bars=data.dailySeries,meta=data.dailySeriesMeta;
 if(!Array.isArray(bars)||bars.length<63||data.completed!==true||!meta?.source||meta.onlyCompletedBars!==true)return fail('指數完成日K至少63根，並保留資料來源。');
 if(bars.some((b,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||i&&b.date<=bars[i-1].date||!['open','high','low','close'].every(k=>Number.isFinite(b[k])&&b[k]>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)))return fail('指數日K日期或開高低收有誤。');
 const last=bars.at(-1);if(last.date!==data.closeDate)return fail('指數歷史截止日不符。');
 const avg=(n,offset=0)=>bars.slice(-n-offset,offset?-offset:undefined).reduce((s,b)=>s+b.close,0)/n;
 const ma5=avg(5),ma20=avg(20),ma60=avg(60),slope20=ma20-avg(20,3),prior=bars.slice(-21,-1),resistance=Math.max(...prior.map(b=>b.high)),support=Math.min(...prior.map(b=>b.low));
 const trend=last.close>ma20&&ma20>ma60&&slope20>0?'偏多':last.close<ma20&&ma20<ma60&&slope20<0?'偏空':'震盪整理';
 return {state:'AVAILABLE',instrumentType:data.instrumentType,date:last.date,close:last.close,ma5,ma20,ma60,slope20,resistance,support,trend,
  illustration:data.provenance==='ILLUSTRATION',input:{symbol:data.instrumentType,market:data.instrumentType==='TAIEX'?'TWSE_INDEX':'TPEX_INDEX',asOf:last.date,bars},
  conclusion:`目前${trend}；收盤${last.close>=ma20?'高於':'低於'}20日均線，20日均線${slope20>0?'上揚':slope20<0?'下彎':'走平'}。${last.close<support?'已跌破前20日低點，短線偏弱，先看能否收回原關卡。':last.close>resistance?'已越過前20日高點，仍須觀察能否站穩。':''}這是大盤歷史技術判讀；隔日方向須另看指數模型結果。`};
}
return {analyze};
});
