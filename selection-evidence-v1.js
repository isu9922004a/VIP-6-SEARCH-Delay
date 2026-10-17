/* Independent, prefix-only daily evidence. No strategy score, eligibility or price is rewritten.
 * Inspired by visible Stock Digger rule categories; this is NOT their formula or data API.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouSelectionEvidenceV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MODEL='SELECTION_EVIDENCE_2';
const LABELS=Object.freeze({DATA:'資料不足',CAUTION:'新買風險提醒',WATCH:'等待條件確認',OBSERVE:'續強條件觀察'});
const n=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function date(v){const m=String(v??'').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);if(!m)return null;const d=m[1]+'-'+m[2]+'-'+m[3],t=new Date(d+'T00:00:00Z');return Number.isFinite(t.getTime())&&t.toISOString().slice(0,10)===d?d:null;}
function normalize(source,asOf){
 if(!Array.isArray(source)||source.length<26)return {ok:false,reason:'需至少26根完成日K；不補齊缺漏'};
 const bars=[];let last='';
 for(const row of source){const d=date(row.date),b={date:d};for(const k of ['open','high','low','close','volume'])b[k]=n(row[k]);
  if(row.suspended===true||!d||d<=last||d>asOf||row.completed===false||row.isComplete===false||['open','high','low','close'].some(k=>!(b[k]>0))||b.volume===null||b.volume<0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high))return {ok:false,reason:'日K日期、順序、完成狀態或OHLCV無效；不排序、不刪錯誤列'};
  bars.push(b);last=d;
 }
 return last===asOf?{ok:true,bars}:{ok:false,reason:'最後完成日K與目標交易日不一致'};
}
function cmf(bars,end=bars.length,nDays=20){const a=bars.slice(end-nDays,end);if(a.length<nDays)return null;const volume=a.reduce((s,b)=>s+b.volume,0);return volume>0?a.reduce((s,b)=>s+(b.high===b.low?0:(2*b.close-b.high-b.low)/(b.high-b.low))*b.volume,0)/volume:null;}
function rsi(bars,period=5){let g=0,l=0;for(let i=1;i<=period;i++){const d=bars[i].close-bars[i-1].close;g+=Math.max(0,d)/period;l+=Math.max(0,-d)/period;}for(let i=period+1;i<bars.length;i++){const d=bars[i].close-bars[i-1].close;g=(g*(period-1)+Math.max(0,d))/period;l=(l*(period-1)+Math.max(0,-d))/period;}return l?100-100/(1+g/l):g?100:50;}
function relativeStrength(bars,benchmark,market){
 const unavailable=reason=>({available:false,reason});
 if(!benchmark)return unavailable('未提供同日同市場指數歷史；不拿今日漲幅冒充20日相對強弱');
 if(!['TWSE','TPEX'].includes(market)||benchmark.market!==market)return unavailable('上市／上櫃指數市場未核對');
 const rows=benchmark.bars||benchmark.dailySeries,check=normalize(rows,bars.at(-1).date);
 if(!check.ok)return unavailable('指數日K日期或完整性不足');
 const map=new Map(check.bars.map(b=>[b.date,b])),window=bars.slice(-21);
 if(window.some(b=>!map.has(b.date)))return unavailable('個股與指數觀察期間交易日未完全對齊');
 const last=bars.at(-1),out={available:true,market,date:last.date,method:'同日起訖個股報酬率減指數報酬率（百分點）；不是RS百分位或Mansfield RS'};
 for(const h of [5,20]){const start=bars.at(-1-h),a=map.get(start.date),z=map.get(last.date);out['return'+h+'d']=(last.close/start.close-1)*100;out['index'+h+'d']=(z.close/a.close-1)*100;out['excess'+h+'d']=out['return'+h+'d']-out['index'+h+'d'];}
 out.winningDays20=window.slice(1).filter((b,i)=>b.close/window[i].close>map.get(b.date).close/map.get(window[i].date).close).length;
 return out;
}
function monthly(r={}){if(r.monthlyReviewV2){const x=r.monthlyReviewV2;return x.verified===true&&['PASS','NOT_PASS','UNCONFIRMED','UNAVAILABLE'].includes(x.status)?x.status:'UNAVAILABLE';}if(r.officialMonthlyUnavailable===true)return 'UNAVAILABLE';if(r.monthlyPass===false)return 'NOT_PASS';if(r.entry===true&&r.startMonthConfirmed===true)return 'PASS';if(r.monthlyPass===true)return r.startMonthConfirmed===true?'PASS':'UNCONFIRMED';return 'UNCONFIRMED';}
function evaluate(input,options={}){
 const report=input?.report||input||{},asOf=date(options.asOf||report.marketDate||report.closeDate||report.dataDate);
 const base={model:MODEL,date:asOf,dataTiming:'POST_CLOSE_ONLY',role:'RESEARCH_ONLY',affectsEligibility:false,affectsScore:false,affectsRanking:false,executionAllowed:false,monthlyStatus:monthly(report),brokerEvidence:'未接分點與持股原始資料；CMF與OBV只是日K量價統計'};
 const missing=reason=>({...base,state:'DATA',label:LABELS.DATA,reasons:[reason],warnings:[],relative:{available:false,reason:'個股資料未通過'},features:null});
 if(!asOf)return missing('缺有效目標交易日');
 if(options.completed!==true||report.completed===false||report.isComplete===false)return missing('未確認是完成盤後行情');
 const stockDate=date(report.closeDate||report.dataDate);if(stockDate!==asOf)return missing('個股資料日與市場目標日不一致');
 if((report.marketDate&&date(report.marketDate)!==asOf)||(report.marketDataDate&&date(report.marketDataDate)!==asOf))return missing('報告附帶的市場日期與目標日不一致');
 if(report.corporateActionUnresolved===true||report.priceAdjustmentConsistent===false)return missing('除權息／價格調整口徑有待解決');
 const source=Array.isArray(options.bars)?options.bars:Array.isArray(report.canonicalBars)&&report.canonicalBars.length?report.canonicalBars:report.dailySeries;
 const verified=normalize(source,asOf);if(!verified.ok)return missing(verified.reason);
 const b=verified.bars,last=b.at(-1),prev=b.at(-2),q=options.quote;
 const calendar=report.expectedTradingDates;
 if(Array.isArray(calendar)){
  const dates=calendar.map(date),actual=new Set(b.map(x=>x.date));
  if(!dates.length||dates.some((d,i)=>!d||(i>0&&d<=dates[i-1]))||b.some(x=>!dates.includes(x.date))||dates.some(d=>d>=b[0].date&&d<=asOf&&!actual.has(d)))return missing('交易日曆與日K缺漏或順序不一致');
 }
 if(Array.isArray(report.corporateActions)&&report.priceAdjustment?.verified!==true&&report.corporateActions.some(e=>!date(e.date)||(date(e.date)>=b[0].date&&date(e.date)<=asOf)))return missing('觀察期間有公司行動，歷史價格調整未驗證');
 if(n(report.close)!==null&&Math.abs(n(report.close)-last.close)>Math.max(.02,last.close*.0001))return missing('報告收盤價與完成日K不一致');
 if(q&&(date(q.quoteDate)!==asOf||!(n(q.close)>0)||Math.abs(n(q.close)-last.close)>Math.max(.02,last.close*.0001)))return missing('市場報價與個股同日同價未核對');
 if(last.volume<=0)return missing('最後完成日K無成交量，不推論可成交');
 const prior=b.slice(-21,-1),maxVolume=Math.max(...prior.map(x=>x.volume));
 if(!(maxVolume>0))return missing('前20日成交量不足，無法建立最大量日關卡');
 // Exclude the signal day. Equal-volume anchors use the latest date, explicitly.
 const anchor=prior.filter(x=>x.volume===maxVolume).at(-1),range=last.high-last.low;
 const closePosition=range?(last.close-last.low)/range:.5,upperShadow=range?(last.high-Math.max(last.open,last.close))/range:0;
 const avg5=avg(b.slice(-6,-1).map(x=>x.volume)),avg20=avg(prior.map(x=>x.volume));
 const ratio5=avg5>0?last.volume/avg5:null,ratio20=avg20>0?last.volume/avg20:null;
 const above=last.close>anchor.high,below=last.close<anchor.low;
 const phase=above?(prev.close<=anchor.high?'BREAKOUT_TODAY':'ABOVE_VOLUME_HIGH'):below?'BELOW_VOLUME_LOW':'INSIDE_VOLUME_BAR';
 const failed=last.high>anchor.high&&last.close<=anchor.high;
 const cmf20=cmf(b),cmf20Prior=cmf(b,b.length-1),cmf20ThreeAgo=cmf(b,b.length-3);
 let obv=0;const obvs=[0];for(let i=1;i<b.length;i++){obv+=Math.sign(b[i].close-b[i-1].close)*b[i].volume;obvs.push(obv);}
 const obvNewHigh20=obv>Math.max(...obvs.slice(-21,-1)),newClosingHigh20=last.close>Math.max(...prior.map(x=>x.close));
 const weakClimax=ratio20>=3&&upperShadow>=.3&&closePosition<.5;
 const flowDivergence=newClosingHigh20&&!obvNewHigh20&&cmf20!==null&&cmf20<0;
 const reasons=[];
 if(below)reasons.push('收盤低於前20日最大量日低點，該量能關卡尚未收復');
 if(failed)reasons.push('盤中越過最大量日高點，收盤未守在上方；不直接斷言是假突破');
 if(weakClimax)reasons.push('量達前20日均量3倍以上，且長上影、弱收盤同時出現');
 if(flowDivergence)reasons.push('收盤創20日新高，但OBV未創新高且CMF20<0；量價證據有分歧');
 const caution=reasons.length>0;
 if(phase==='BREAKOUT_TODAY')reasons.push('今天才收盤越過量能關卡，隔日站穩尚無證據');
 if(phase==='INSIDE_VOLUME_BAR')reasons.push('收盤仍在最大量日高低區間內，尚未站上其高點');
 if(cmf20===null||cmf20<=0)reasons.push('CMF20尚未偏正；只是收盤位置乘成交量的統計');
 const warnings=[];
 if(report.priceAdjustment?.verified!==true)warnings.push('歷史價格調整基準未驗證，結果只供研究');
 if(!Array.isArray(calendar))warnings.push('未附交易日曆，無法證實觀察期間沒有漏日');
 if(base.monthlyStatus!=='PASS')warnings.push(base.monthlyStatus==='NOT_PASS'?'月線條件未通過':'月線尚未驗證；日K條件不能替代月20MA資格');
 const market=String(options.market||q?.market||report.market||'').toUpperCase();
 const relative=relativeStrength(b,options.benchmark,market);
 if(!relative.available)warnings.push(relative.reason);
 const state=caution?'CAUTION':reasons.length?'WATCH':'OBSERVE';
 return {...base,state,label:LABELS[state],reasons:reasons.length?reasons:['量能關卡已越過；仍只列下一交易日條件觀察'],warnings,relative,
  anchor:{date:anchor.date,high:anchor.high,low:anchor.low,volume:anchor.volume,window:20,excludesSignalDay:true,tieRule:'相同最大量採最近日'},
  phase,features:{close:last.close,closePosition,upperShadow,volumeRatio5:ratio5,volumeRatio20:ratio20,cmf20,cmf20Prior,cmf20ThreeAgo,cmfRising3:cmf20!==null&&cmf20ThreeAgo!==null?cmf20>cmf20ThreeAgo:null,obvNewHigh20,newClosingHigh20,rsi5:rsi(b),failedVolumeHigh:failed,weakClimax,flowDivergence},
  meaning:'原訊號與新買風險分開；不重複加分，不代表勝率或可直接買進'};
}
const fmt=v=>n(v)===null?'資料不足':Number(v).toFixed(2);
function describe(e){if(!e)return '四策略共用研究檢查：尚未執行';return `新買條件研究｜${e.label}｜${e.date||'日期不足'}${e.anchor?`｜前20日最大量日 ${e.anchor.date} 高${fmt(e.anchor.high)}／低${fmt(e.anchor.low)}`:''}${e.features?`｜CMF20 ${fmt(e.features.cmf20)}｜OBV20日新高 ${e.features.obvNewHigh20?'是':'否'}`:''}｜${e.reasons.join('；')}｜月線 ${e.monthlyStatus}${e.warnings.length?'｜'+e.warnings.join('；'):''}｜量價證據交由正式篩選層分類；條件分不是勝率，非直接進場許可。`;}
function attach(candidate,report,options){if(candidate&&typeof candidate==='object')candidate.selectionEvidence=evaluate(report||candidate,options);return candidate;}
return Object.freeze({MODEL,LABELS,date,normalize,cmf,rsi,monthly,relativeStrength,evaluate,attach,describe});
});
