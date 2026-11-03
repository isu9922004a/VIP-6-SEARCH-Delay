(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouForecastPreview=api;})(globalThis,function(){
'use strict';
const entries=new Map();
const finite=Number.isFinite, mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const quantile=(a,p)=>{const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*p;return s[Math.floor(i)]+(s[Math.ceil(i)]-s[Math.floor(i)])*(i%1);};
function signature(bars){const s=bars.map(b=>[b.date,...['open','high','low','close','volume','amount'].map(k=>Number(b[k]||0).toFixed(6))].join(',')).join('\n');let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
function validBar(b){return b&&['open','high','low','close'].every(k=>finite(b[k])&&b[k]>0)&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close)&&b.low<=b.high;}
function evaluate(input,forecast=null){
 const bars=input.bars||[],last=bars.at(-1),bad=reason=>({state:'UNAVAILABLE',label:'尚無模型方向',reason,modelRun:false,tradeAllowed:false});
 if(bars.length<60||bars.some((b,i)=>!validBar(b)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||i&&b.date<=bars[i-1].date)||last.date!==input.asOf)return bad('完整歷史或資料日期未對齊，先不產生推演。');
 if(!forecast)return bad('Kronos 尚未執行；目前只有歷史技術判讀。');
 if(forecast.kind!=='KRONOS_INFERENCE')return bad('無法辨認推論來源。');
 if(forecast.schema!=='shitou-kronos-v1'||forecast.symbol!==input.symbol||forecast.market!==input.market||forecast.asOf!==input.asOf||forecast.frequency!=='1d'||forecast.historySignature!==signature(bars))return bad('模型與個股／市場／日期／K線指紋不符，拒用舊結果。');
 const demo=false,dates=forecast.targetDates;
 if(!Array.isArray(dates)||!dates.length||dates.length>5||dates.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||d<=(i?dates[i-1]:input.asOf)))return bad('預測日期不完整或包含已知日，拒用結果。');
 if(!demo&&(!forecast.calendar?.verified||!forecast.calendar.source||!dates.every(d=>forecast.calendar.dates?.includes(d))))return bad('預測交易日尚未核驗，不以平日代替交易所日曆。');
 if(!demo&&(!forecast.model?.revision||!forecast.tokenizer?.revision||!forecast.codeCommit||forecast.sampleCount!==forecast.samples?.length))return bad('模型修訂、程式版本或取樣筆數缺少紀錄。');
 const paths=forecast.samples;
 const sampleValid=b=>b&&['open','high','low','close'].every(k=>finite(b[k])&&b[k]>0);
 if(!Array.isArray(paths)||paths.length<20||paths.length>1000||paths.some(p=>!Array.isArray(p)||p.length!==dates.length||p.some(b=>!sampleValid(b))))return bad('至少需要20條完整有效獨立路徑；不使用平均線冒充機率。');
 const invalid=paths.reduce((n,p)=>n+p.filter(b=>!validBar(b)).length,0);
 if(invalid&&(forecast.outputQuality?.invalidOhlcCount!==invalid||forecast.outputQuality?.rawSamplesPreserved!==true||forecast.outputQuality?.use!=='OPEN_CLOSE_DISTRIBUTION_ONLY'))return bad('預測OHLC結構異常且缺少原樣保留紀錄。');
 const os=paths.map(p=>p[0].open),cs=paths.map(p=>p[0].close),threshold=.003,change=(x,b)=>(x/b-1),stats=values=>({low:quantile(values,.1),median:quantile(values,.5),high:quantile(values,.9)});
 const bullish=cs.filter(x=>change(x,last.close)>threshold).length/paths.length,bearish=cs.filter(x=>change(x,last.close)<-threshold).length/paths.length,flat=1-bullish-bearish;
 const direction=bullish>=.65?'BULL':bearish>=.65?'BEAR':'MIXED',labels={BULL:'偏多劇本',BEAR:'偏空劇本',MIXED:'震盪／分歧'};
 const candleBull=paths.filter(p=>change(p[0].close,p[0].open)>threshold).length/paths.length;
 return {state:demo?'ILLUSTRATION':'MODEL_SAMPLE',modelRun:!demo,tradeAllowed:false,label:labels[direction],direction,opening:stats(os),closing:stats(cs),bullish,bearish,flat,candleBull,sampleCount:paths.length,dates,
  openingLabel:mean(os)>last.close*1.003?'傾向開高':mean(os)<last.close*.997?'傾向開低':'接近平開',
  daily:dates.map((date,i)=>({date,...stats(paths.map(p=>p[i].close))})),reason:demo?'人工設計路徑，僅檢視版面與條件反應；沒有執行 Kronos。':'取樣占比尚未經台股校準，不能當成實際勝率。',
  provenance:forecast};
}
function key(input){return [input.symbol,input.market,input.asOf].join('|');}
function fifth(a,plan,pending,context){const item=entries.get([String(a.code),a.validation?.market,a.date].join('|')),usable=item&&globalThis.ShitouKronosData?.isFresh(item.forecast)!==false;const f=usable?evaluate(item.input,item.forecast):{state:'UNAVAILABLE',modelRun:false,reason:globalThis.ShitouKronosData?.reasonFor(a)||'尚未取得此個股自己的Kronos結果。'};const api=typeof module==='object'&&module.exports?require('./stock-fifth-module.js'):globalThis.ShitouStockFifthModule;return api?.build(a,plan,f,pending,usable?item.input:null,context)||null;}
return {evaluate,signature,quantile,validBar,fifth,configure(){},enabled(){return true;},register(input,forecast){const result=evaluate(input,forecast);if(result.state!=='MODEL_SAMPLE')return {ok:false,reason:result.reason};entries.set(key(input),{input,forecast});return {ok:true};},clear(){entries.clear();}};
});
