/* Causal three-bars-back price structure. Research observations, never calibrated odds. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouStructureStrength=api;})(globalThis,function(){
'use strict';
const VERSION='STRUCTURE_STRENGTH_8_6_3',PARAM=Object.freeze({maPeriod:20,slopeBars:3,referenceBars:3,maxAge:20,minBars:24});
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const unavailable=reason=>freeze({version:VERSION,state:'UNAVAILABLE',label:'結構強弱尚未確認',reason,support:null,resistance:null,researchOnly:true,performanceValidated:false,affectsOriginalScore:false,affectsOriginalRanking:false,tradeAllowed:false,parameters:PARAM});
const mean=(b,end)=>b.slice(end-19,end+1).reduce((s,z)=>s+z.close,0)/20;
function scan(rows,asOf){
 if(!Array.isArray(rows)||rows.length<PARAM.minBars)return unavailable('至少需要24根已核驗、連續且價格基準一致的完成日K。');
 if(rows.some((z,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(z.date)||i&&z.date<=rows[i-1].date||!['open','high','low','close'].every(k=>Number.isFinite(z[k])&&z[k]>0)||z.low>Math.min(z.open,z.close)||z.high<Math.max(z.open,z.close))||rows.at(-1).date!==asOf)return unavailable('日K內容、順序或行情日期尚未核對。');
 // A price-basis discontinuity cannot create an artificial support/resistance.
 let cut=0;for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].open/rows[i-1].close-1)>.30)cut=i;
 const b=rows.slice(cut);if(b.length<PARAM.minBars)return unavailable('價格斷點後的連續日K不足24根，先不跨價格基準判讀結構。');
 let support=null,resistance=null;
 for(let i=23;i<b.length;i++){
  const z=b[i],p=b[i-1],older=b[i-2],ref=b[i-3],m=mean(b,i-1),old=mean(b,i-4);
  if(support?.status==='HOLDING'&&z.close<support.price)support={...support,status:'BROKEN',brokenAt:z.date};
  if(resistance?.status==='HOLDING'&&z.close>resistance.price)resistance={...resistance,status:'BROKEN',brokenAt:z.date};
  else if(resistance?.status==='BROKEN'&&z.date>resistance.brokenAt&&z.close<resistance.price)resistance={...resistance,status:'FAILED',failedAt:z.date};
  const base={signalDate:z.date,knownAt:z.date,referenceDate:ref.date,index:i,source:'不創高／低訊號往前第三根完成日K',confirmation:'CLOSE_ONLY'};
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
 let state='NOT_FORMED',label='尚未形成可核對的三根回溯結構';
 if(primary?.type==='SUPPORT'){state=primary.status==='HOLDING'?'BULL_HOLDING':'BULL_WEAKENED';label=state==='BULL_HOLDING'?'多方結構仍在，回落續強待確認':'多方支撐曾失守，結構重建待確認';}
 if(primary?.type==='RESISTANCE'){state=primary.status==='BROKEN'?'TURNING_UP':primary.status==='FAILED'?'BREAKOUT_FAILED':'BEAR_REBOUND';label=state==='TURNING_UP'?'結構壓力已突破，轉強仍待確認':state==='BREAKOUT_FAILED'?'反彈突破後失守，轉弱風險增加':'空方反彈尚未突破結構壓力';}
 return freeze({version:VERSION,state,label,date:asOf,close:b.at(-1).close,support,resistance,reason:primary?'趨勢以前一日收盤相對20日均線及其3日方向判定；不創高／低比較前一根，等高／低算未創新。':'最近20個交易日內尚無符合趨勢條件的有效訊號，不硬補價位。',researchOnly:true,performanceValidated:false,affectsOriginalScore:false,affectsOriginalRanking:false,tradeAllowed:false,parameters:PARAM});
}
function fromAnalysis(a){
 const input=a?.kronosInput;
 if(a?.validation?.technicalModelAvailable!==true||!input||String(input.symbol)!==String(a.code)||input.asOf!==a.date||input.market!==a.validation.market||input.bars?.at(-1)?.close!==a.sourceBars?.at(-1)?.close)return unavailable('完整日K、市場別或價格基準尚未核驗，不猜測結構價位。');
 return scan(input.bars,a.date);
}
return {VERSION,PARAM,scan,fromAnalysis};
});
