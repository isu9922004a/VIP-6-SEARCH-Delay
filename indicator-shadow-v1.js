/* OBSERVE.1 — deterministic, prefix-only research. No scores, gates or ranking. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouIndicatorShadowCore=api;})(globalThis,function(){
'use strict';
const MODEL='RSI_OBV_SAR_SHADOW_1';
const POLICY=Object.freeze({rsiPeriod:14,rsiWindow:10,obvWindow:20,sarStep:0.02,sarMax:0.2,sarWarmup:60,contextMA:20,weights:null,rankingChanged:false});
const n=v=>v===null||v===undefined||String(v).trim()===''||typeof v==='boolean'||typeof v==='object'?null:Number.isFinite(Number(v))?Number(v):null;
function date(v){const m=String(v||'').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);if(!m)return null;const d=m[1]+'-'+m[2]+'-'+m[3],t=new Date(d+'T00:00:00Z');return Number.isFinite(+t)&&t.toISOString().slice(0,10)===d?d:null;}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function normalize(source,asOf){
 if(!Array.isArray(source)||!source.length)return {ok:false,reason:'沒有逐日日K'};
 const bars=[];let previous='';
 for(const r of source){const b={date:date(r?.date)};for(const k of ['open','high','low','close','volume'])b[k]=n(r?.[k]);
  if(!b.date||b.date<=previous||b.date>asOf||r.completed===false||r.isComplete===false||r.suspended===true||['open','high','low','close'].some(k=>!(b[k]>0))||b.volume===null||b.volume<0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high))return {ok:false,reason:'日K順序、日期、完成狀態或OHLCV無效；未自動刪列／排序'};
  bars.push(b);previous=b.date;
 }
 return previous===asOf?{ok:true,bars}:{ok:false,reason:'最後日K與觀察交易日不同'};
}
function fingerprint(value){const s=JSON.stringify(value);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function rsiSeries(bars,period=POLICY.rsiPeriod){
 const out=Array(bars.length).fill(null);if(!Number.isInteger(period)||period<1||bars.length<=period)return out;
 let gain=0,loss=0;for(let i=1;i<=period;i++){const d=bars[i].close-bars[i-1].close;gain+=Math.max(d,0)/period;loss+=Math.max(-d,0)/period;}
 const value=()=>loss===0?(gain===0?50:100):100-100/(1+gain/loss);out[period]=value();
 for(let i=period+1;i<bars.length;i++){const d=bars[i].close-bars[i-1].close;gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period;out[i]=value();}
 return out;
}
function rsi(bars){
 const series=rsiSeries(bars),values=series.slice(-POLICY.rsiWindow);if(values.length<POLICY.rsiWindow||values.some(v=>v===null))return {available:false,reason:'RSI14需至少24根日K供最近10值比較'};
 const value=values.at(-1),previous=values.at(-2),above50=values.filter(v=>v>=50).length/POLICY.rsiWindow;
 let crosses50=0;for(let i=1;i<values.length;i++)if((values[i]>=50)!==(values[i-1]>=50))crosses50++;
 const ma20=mean(bars.slice(-20).map(b=>b.close)),old20=mean(bars.slice(-21,-1).map(b=>b.close)),last=bars.at(-1);
 const context=bars.length<21?'UNCONFIRMED':last.close>ma20&&ma20>old20?'PRICE_UP':last.close<ma20&&ma20<old20?'PRICE_DOWN':'MIXED';
 const state=crosses50>=4?'OSCILLATING':context==='PRICE_UP'&&above50>=0.8?'UP_CONTEXT':context==='PRICE_DOWN'&&above50<=0.2?'DOWN_CONTEXT':'MIXED';
 const labels={UP_CONTEXT:'偏多情境',DOWN_CONTEXT:'偏空情境',OSCILLATING:'50軸反覆穿越',MIXED:'動能情境混合'};
 return {available:true,period:14,smoothing:'WILDER_RMA_ALPHA_1_14',seed:'前14個收盤價差的算術平均',flatRule:'平均漲跌皆0時為50',value,previous,delta:value-previous,above50Ratio10:above50,crosses50In10:crosses50,context,state,label:labels[state],extreme:value>=70?'HIGH':value<=30?'LOW':'MID',recovered30:previous<30&&value>=30,lost70:previous>=70&&value<70,meaning:'情境描述與極端值分開；不改既有RSI5與買點門檻'};
}
function obvSeries(bars){const values=bars.length?[0]:[];for(let i=1;i<bars.length;i++)values.push(values.at(-1)+Math.sign(bars[i].close-bars[i-1].close)*bars[i].volume);return values;}
function obv(bars){
 if(bars.length<21)return {available:false,reason:'OBV20需至少21根日K'};
 const values=obvSeries(bars),last=bars.at(-1),prior=bars.slice(-21,-1),volume=bars.slice(-20).reduce((s,b)=>s+b.volume,0);
 if(!(volume>0))return {available:false,reason:'20日成交量分母為0'};
 const delta20=values.at(-1)-values.at(-21),normalized20=delta20/volume,newHigh20=values.at(-1)>Math.max(...values.slice(-21,-1)),priceNewHigh20=last.close>Math.max(...prior.map(b=>b.close));
 const state=priceNewHigh20&&!newHigh20?'PRICE_HIGH_NOT_CONFIRMED':newHigh20?'OBV_NEW_HIGH':normalized20>0?'POSITIVE':normalized20<0?'NEGATIVE':'FLAT';
 const labels={PRICE_HIGH_NOT_CONFIRMED:'價格創高，OBV未確認',OBV_NEW_HIGH:'OBV創20日新高',POSITIVE:'20日帶符號量偏正',NEGATIVE:'20日帶符號量偏負',FLAT:'20日帶符號量持平'};
 return {available:true,initialValue:0,directionRule:'今收對昨收；平盤增量0',deltaToday:values.at(-1)-values.at(-2),delta20,normalized20,newHigh20,priceNewHigh20,state,label:labels[state],meaning:'成交量方向代理；不是資金淨流入、主力身分或對倒偵測'};
}
function sarSeries(bars,step=POLICY.sarStep,max=POLICY.sarMax){
 if(bars.length<2)return [];
 // Seed uses only bars 0 and 1. Ties start BULL. Reversal uses strict H/L crossing.
 let side=bars[1].close>=bars[0].close?'BULL':'BEAR',af=step;
 let value=side==='BULL'?Math.min(bars[0].low,bars[1].low):Math.max(bars[0].high,bars[1].high);
 let ep=side==='BULL'?Math.max(bars[0].high,bars[1].high):Math.min(bars[0].low,bars[1].low);
 const out=[null,{value,side,af,ep,flip:'NONE'}];
 for(let i=2;i<bars.length;i++){
  const b=bars[i],a=bars[i-1],p=bars[i-2];let next=value+af*(ep-value),flip='NONE';
  if(side==='BULL'){
   next=Math.min(next,a.low,p.low);
   if(b.low<next){side='BEAR';next=Math.max(ep,b.high);ep=b.low;af=step;flip='BULL_TO_BEAR';}
   else if(b.high>ep){ep=b.high;af=Math.min(max,af+step);}
  }else{
   next=Math.max(next,a.high,p.high);
   if(b.high>next){side='BULL';next=Math.min(ep,b.low);ep=b.high;af=step;flip='BEAR_TO_BULL';}
   else if(b.low<ep){ep=b.low;af=Math.min(max,af+step);}
  }
  value=next;out.push({value,side,af,ep,flip});
 }
 return out;
}
function sar(bars){
 if(bars.length<POLICY.sarWarmup)return {available:false,reason:'SAR初始狀態敏感，研究版需至少60根日K'};
 const series=sarSeries(bars),s=series.at(-1),flips20=series.slice(-20).filter(x=>x&&x.flip!=='NONE').length;
 return {...s,available:true,step:0.02,max:0.2,seed:'首兩根收盤決定初始方向（相同採多）；其高低價決定SAR與EP',crossing:'high/low嚴格穿越；相等不翻轉；先限制前兩根高低再檢查反轉',distancePct:(bars.at(-1).close/s.value-1)*100,flips20,label:s.flip==='BEAR_TO_BULL'?'今日SAR翻多':s.flip==='BULL_TO_BEAR'?'今日SAR翻空':s.side==='BULL'?'SAR多方追蹤':'SAR空方追蹤',meaning:'移動追蹤參考；震盪可反覆觸發，非明日價格預測'};
}
function evaluate(input,options={}){
 const report=input?.report||input||{},asOf=date(options.asOf||report.marketDate||report.closeDate||report.dataDate||report.date);
 const base={model:MODEL,policy:POLICY,date:asOf,status:'DATA',available:false,reasons:[],warnings:[],scoreChanged:false,rankingChanged:false,eligibilityChanged:false};
 const missing=reason=>({...base,reasons:[reason]});
 if(!asOf)return missing('缺明確目標交易日');
 if(report.completed===false||report.isComplete===false||options.completed===false)return missing('上游明示行情尚未完成');
 if(!(options.completed===true||report.completed===true||report.isComplete===true||report.dataTiming==='POST_CLOSE_ONLY'))return missing('未確認盤後行情完成狀態');
 for(const v of [report.marketDate,report.closeDate,report.dataDate])if(v&&date(v)!==asOf)return missing('報告日期與目標日衝突');
 if(report.corporateActionUnresolved===true||report.priceAdjustmentConsistent===false)return missing('價格調整口徑未解決');
 const source=Array.isArray(report.canonicalBars)&&report.canonicalBars.length?report.canonicalBars:Array.isArray(report.dailySeries)&&report.dailySeries.length?report.dailySeries:report.tower?.bars;
 const checked=normalize(source,asOf);if(!checked.ok)return missing(checked.reason);
 const bars=checked.bars,last=bars.at(-1),close=n(report.close);
 if(close!==null&&Math.abs(close-last.close)>Math.max(0.02,last.close*0.0001))return missing('報告收盤與最後日K不一致');
 if(last.volume===0)return missing('最後一日成交量為0；不推論可交易');
 const calendar=report.expectedTradingDates;
 if(Array.isArray(calendar)){
  const dates=calendar.map(date),actual=new Set(bars.map(b=>b.date));
  if(dates.some((d,i)=>!d||(i&&d<=dates[i-1]))||bars.some(b=>!dates.includes(b.date))||dates.some(d=>d>=bars[0].date&&d<=asOf&&!actual.has(d)))return missing('日K與交易日曆不符／漏日');
 }
 if(Array.isArray(report.corporateActions)&&report.priceAdjustment?.verified!==true&&report.corporateActions.some(e=>!date(e.date)||(date(e.date)>=bars[0].date&&date(e.date)<=asOf)))return missing('歷史公司行動調整未確認');
 const r=rsi(bars),o=obv(bars),s=sar(bars),warnings=[];
 if(!Array.isArray(calendar))warnings.push('交易日曆未驗證');
 if(report.priceAdjustment?.verified!==true)warnings.push('歷史調整口徑未驗證');
 if(bars.some(b=>b.volume===0))warnings.push('歷史含零量日');
 const available=r.available&&o.available&&s.available;
 return {...base,status:available?'OK':'PARTIAL',available,rowsUsed:bars.length,historyFingerprint:fingerprint(bars),signalBar:{...last},calendarVerified:Array.isArray(calendar),basisVerified:report.priceAdjustment?.verified===true,warnings,rsi:r,obv:o,sar:s,reasons:[r,o,s].filter(x=>!x.available).map(x=>x.reason)};
}
const fmt=(v,d=2)=>n(v)===null?'不足':Number(v).toFixed(d);
function lines(e){
 if(!e||e.status==='DATA')return ['RSI／OBV／SAR：資料不足｜'+(e?.reasons||['尚未計算']).join('；'),'僅並行記錄，不影響原名次、原分數及資格'];
 return [`RSI14 ${fmt(e.rsi?.value)}｜${e.rsi?.label||e.rsi?.reason}｜Wilder平滑`,e.rsi?.available?`近10值 ≥50 占 ${fmt(e.rsi.above50Ratio10*100,0)}%｜穿越50共 ${e.rsi.crosses50In10} 次｜高值不直接等於轉弱`:'RSI情境資料不足',e.obv?.available?`OBV20正規化 ${fmt(e.obv.normalized20,3)}｜${e.obv.label}`:`OBV：${e.obv?.reason||'不足'}`,e.sar?.available?`${e.sar.label} ${fmt(e.sar.value)}｜近20日翻轉 ${e.sar.flips20} 次｜步長0.02／上限0.20`:`SAR：${e.sar?.reason||'不足'}`,'量價代理不等於主力進場；描述狀態非上漲機率',...(e.warnings.length?[e.warnings.join('；')]:[]),'僅並行記錄，不影響原名次、原分數及資格'];
}
function nextOutcome(observation,input){
 const report=input?.report||input||{},asOf=date(report.marketDate||report.closeDate||report.dataDate),raw=report.canonicalBars?.length?report.canonicalBars:report.dailySeries;
 const unavailable=(status,reason)=>({status,reason,evaluatedAsOf:asOf});
 if(observation.market&&report.market&&observation.market!==report.market)return unavailable('DATA','市場別不一致');
 if(observation.code&&String(report.stock||report.code||'')!==observation.code)return unavailable('DATA','股票代號不一致');
 if(!asOf||asOf<=observation.date)return unavailable('PENDING','等待後續完成交易日');
 if([report.marketDate,report.closeDate,report.dataDate].some(d=>d&&date(d)!==asOf))return unavailable('DATA','後續報告日期衝突');
 if(report.completed===false||report.isComplete===false||!(report.completed===true||report.isComplete===true||report.dataTiming==='POST_CLOSE_ONLY'))return unavailable('PENDING','後續行情完成狀態未確認');
 const check=normalize(raw,asOf);if(!check.ok)return unavailable('DATA',check.reason);
 if(n(report.close)!==null&&Math.abs(n(report.close)-check.bars.at(-1).close)>Math.max(.02,check.bars.at(-1).close*.0001))return unavailable('DATA','後續報告收盤與日K不同');
 const at=check.bars.findIndex(b=>b.date===observation.date);if(at<0)return unavailable('DATA','後續歷史未包含訊號日');
 const signal=check.bars[at],old=observation.evidence?.signalBar;
 if(!old)return unavailable('DATA','原紀錄沒有有效訊號日K');
 if(['open','high','low','close'].some(k=>Math.abs(signal[k]-old[k])>1e-8))return unavailable('REVISED_HISTORY','訊號日價格已修訂／調整，不混算績效');
 const next=check.bars[at+1];if(!next)return unavailable('PENDING','沒有訊號日後的完成日K');
 if((report.corporateActions||[]).some(e=>!date(e.date)||(date(e.date)>observation.date&&date(e.date)<=next.date))||report.corporateActionUnresolved===true||report.priceAdjustmentConsistent===false)return unavailable('CORPORATE_ACTION','訊號日至觀察日存在公司行動／口徑問題，排除比較');
 const calendar=Array.isArray(report.expectedTradingDates)?report.expectedTradingDates.map(date):null;
 if(!calendar||calendar.some((d,i)=>!d||(i&&d<=calendar[i-1]))||!calendar.includes(observation.date))return unavailable('CALENDAR_UNVERIFIED','只有下一筆觀測；未驗證為次一市場交易日，不計入隔日統計');
 const expected=calendar.find(d=>d>observation.date);
 if(expected!==next.date)return unavailable('SESSION_GAP','次一市場交易日日K缺漏／停牌，不以後日代替');
 if(!(next.volume>0))return unavailable('NOT_TRADABLE','次一交易日零量，不推論可成交');
 return {status:'COMPLETE',date:next.date,evaluatedAsOf:asOf,closeToClosePct:(next.close/old.close-1)*100,openToCloseGrossPct:(next.close/next.open-1)*100,signalClose:old.close,nextOpen:next.open,nextClose:next.close,executionVerified:false,meaning:'歷史價差觀測；未驗證可成交、未扣稅費與滑價，不是實盤報酬'};
}
function summary(observations,topN=10){
 const seen=new Set(),ordered=observations.slice().sort((a,b)=>String(a.capturedAt).localeCompare(String(b.capturedAt))),rows=ordered.filter(r=>{const key=[r.strategy,r.date,r.code,r.subtype||''].join('|');if(seen.has(key)||r.origin!=='LIVE_CAPTURE'||!Number.isFinite(Date.parse(r.capturedAt)))return false;seen.add(key);return r.baselineRank>=1&&r.baselineRank<=topN&&r.outcome?.status==='COMPLETE'&&r.evidence?.available&&Date.parse(r.capturedAt)<Date.parse(r.outcome.date+'T09:00:00+08:00');});
 const tests=[['BASELINE','原榜同一TopN全部',()=>true],['RSI','RSI偏多情境',r=>r.evidence.rsi.state==='UP_CONTEXT'],['OBV','OBV20正規化>0',r=>r.evidence.obv.normalized20>0],['SAR','SAR多方狀態',r=>r.evidence.sar.side==='BULL']];
 const stats=list=>({n:list.length,dates:new Set(list.map(r=>r.date)).size,upRate:list.length?list.filter(r=>r.outcome.closeToClosePct>0).length/list.length:null,meanCloseToClosePct:mean(list.map(r=>r.outcome.closeToClosePct)),meanOpenToCloseGrossPct:mean(list.map(r=>r.outcome.openToCloseGrossPct))});
 return {model:MODEL,topN,design:'原榜固定TopN；逐項條件分組，不改排序；同策略同日同股採最早前瞻紀錄',caveat:'描述性分組，非因果增益或樣本外勝率認證；不同策略／寶塔A與B需分開比較。未確認成交、未扣成本。',groups:tests.map(([key,label,test])=>({key,label,match:stats(rows.filter(test)),other:key==='BASELINE'?null:stats(rows.filter(r=>!test(r)))}))};
}
return Object.freeze({MODEL,POLICY,date,normalize,fingerprint,rsiSeries,obvSeries,sarSeries,evaluate,lines,nextOutcome,summary});
});
