/* Causal three-bars-back price structure. Research observations, never calibrated odds. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouStructureStrength=api;})(globalThis,function(){
'use strict';
const VERSION='STRUCTURE_STRENGTH_8_6_3',PARAM=Object.freeze({maPeriod:20,slopeBars:3,referenceBars:3,maxAge:20,minBars:24});
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const unavailable=reason=>freeze({version:VERSION,state:'UNAVAILABLE',label:'資料還沒確認，暫時無法判斷股價強弱',reason,support:null,resistance:null,researchOnly:true,performanceValidated:false,affectsOriginalScore:false,affectsOriginalRanking:false,tradeAllowed:false,parameters:PARAM});
const mean=(b,end)=>b.slice(end-19,end+1).reduce((s,z)=>s+z.close,0)/20;
function scan(rows,asOf){
 if(!Array.isArray(rows)||rows.length<PARAM.minBars)return unavailable('至少需要24天已核對、沒有缺日且能互相比較的每日價格資料，才能判斷。');
 if(rows.some((z,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(z.date)||i&&z.date<=rows[i-1].date||!['open','high','low','close'].every(k=>Number.isFinite(z[k])&&z[k]>0)||z.low>Math.min(z.open,z.close)||z.high<Math.max(z.open,z.close))||rows.at(-1).date!==asOf)return unavailable('每日價格的內容、先後順序或日期還沒核對，先不判斷。');
 // A price-basis discontinuity cannot create an artificial support/resistance.
 let cut=0;for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].open/rows[i-1].close-1)>.30)cut=i;
 const b=rows.slice(cut);if(b.length<PARAM.minBars)return unavailable('股價曾出現大幅跳動，跳動之後的完整資料不足24天，暫時無法判斷。');
 let support=null,resistance=null;
 for(let i=23;i<b.length;i++){
  const z=b[i],p=b[i-1],older=b[i-2],ref=b[i-3],m=mean(b,i-1),old=mean(b,i-4);
  if(support?.status==='HOLDING'&&z.close<support.price)support={...support,status:'BROKEN',brokenAt:z.date};
  if(resistance?.status==='HOLDING'&&z.close>resistance.price)resistance={...resistance,status:'BROKEN',brokenAt:z.date};
  else if(resistance?.status==='BROKEN'&&z.date>resistance.brokenAt&&z.close<resistance.price)resistance={...resistance,status:'FAILED',failedAt:z.date};
  const base={signalDate:z.date,knownAt:z.date,referenceDate:ref.date,index:i,source:'以轉折線索出現日往前數第三個交易日的價格為參考',confirmation:'CLOSE_ONLY'};
  if(p.close>m&&m>old&&z.high<=p.high&&p.high>older.high){
   if(!support||i-support.index>PARAM.maxAge||p.high>support.pivot&&ref.low>=support.price)support={...base,type:'SUPPORT',price:ref.low,pivot:p.high,status:z.close<ref.low?'BROKEN':'HOLDING',brokenAt:z.close<ref.low?z.date:null};
  }
  if(p.close<m&&m<old&&z.low>=p.low&&p.low<older.low){
   if(!resistance||i-resistance.index>PARAM.maxAge||p.low<resistance.pivot&&ref.high<=resistance.price)resistance={...base,type:'RESISTANCE',price:ref.high,pivot:p.low,status:z.close>ref.high?'BROKEN':'HOLDING',brokenAt:z.close>ref.high?z.date:null};
  }
 }
 const recent=e=>e&&b.length-1-e.index<=PARAM.maxAge?{...e,age:b.length-1-e.index}:null;
 support=recent(support);resistance=recent(resistance);
 // Crossing old references cannot be presented as an ordered price range.
 if(support&&resistance&&support.price>=resistance.price){if(support.index>=resistance.index)resistance=null;else support=null;}
 const primary=[support,resistance].filter(Boolean).sort((a,b)=>b.index-a.index)[0];
 let state='NOT_FORMED',label='目前找不到明確的轉強或轉弱線索';
 if(primary?.type==='SUPPORT'){state=primary.status==='HOLDING'?'BULL_HOLDING':'BULL_WEAKENED';label=state==='BULL_HOLDING'?'股價有拉回，但還守住重要價位，能否再漲仍要觀察':'股價曾跌破重要價位，還不能確定已經轉強';}
 if(primary?.type==='RESISTANCE'){state=primary.status==='BROKEN'?'TURNING_UP':primary.status==='FAILED'?'BREAKOUT_FAILED':'BEAR_REBOUND';label=state==='TURNING_UP'?'股價已漲過重要關卡，還要看後續能否守住':state==='BREAKOUT_FAILED'?'股價漲過重要關卡後又跌回，需留意再跌風險':'股價有回升，但轉強還沒確認，先別急著追買';}
 return freeze({version:VERSION,state,label,date:asOf,close:b.at(-1).close,support,resistance,reason:primary?'先看前一天收盤價是否高於最近20天平均價，以及平均價比3個交易日前上升或下降；再比較當天與前一天的最高、最低價。價格相同不算漲過或跌破前一天。':'最近20個交易日沒有找到符合這套方法的明確線索，先不列價位。',researchOnly:true,performanceValidated:false,affectsOriginalScore:false,affectsOriginalRanking:false,tradeAllowed:false,parameters:PARAM});
}
function fromAnalysis(a){
 const input=a?.kronosInput;
 if(a?.validation?.technicalModelAvailable!==true||!input||String(input.symbol)!==String(a.code)||input.asOf!==a.date||input.market!==a.validation.market||input.bars?.at(-1)?.close!==a.sourceBars?.at(-1)?.close)return unavailable('這檔股票的歷史價格、交易市場或日期還沒核對，先不猜重要價位。');
 return scan(input.bars,a.date);
}
return {VERSION,PARAM,scan,fromAnalysis};
});

