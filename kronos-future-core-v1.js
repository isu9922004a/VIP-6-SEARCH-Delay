/* Independent 20-session model validation and description; never changes entry gates. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./research-v83/forecast-engine'):root.ShitouForecastPreview);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouKronosFutureCore=api;})(globalThis,function(F){
'use strict';
const VERSION='KRONOS_FUTURE_CORE_1',HORIZON=20,MODEL='NeoQuasar/Kronos-small',REVISION='901c26c1332695a2a8f243eb2f37243a37bea320',TOKENIZER='0e0117387f39004a9016484a186a908917e22426',CODE='67b630e67f6a18c9e9be918d9b4337c960db1e9a';
const positive=x=>Number.isFinite(x)&&x>0,iso=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||''),hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),bad=reason=>({state:'UNAVAILABLE',reason,modelRun:false,tradeAllowed:false});
function displaySignature(paths,candle){let h=2166136261;const view=new DataView(new ArrayBuffer(8));const add=value=>{view.setFloat64(0,value,false);for(let i=0;i<8;i++)h=Math.imul(h^view.getUint8(i),16777619);};for(const p of paths)for(const v of p)add(v);add(candle?candle.sampleIndex:-1);if(candle)for(const b of candle.bars)for(const k of ['open','high','low','close'])add(b[k]);return(h>>>0).toString(16).padStart(8,'0');}
function executionVerified(f){try{const e=f?.execution;return !!(e&&e.schema==='kronos-future-execution-v1'&&e.backend==='PYTORCH_KRONOS'&&e.simulation===false&&e.completed===true&&e.mode==='LIVE_POST_CLOSE_20D'&&e.inferenceAlgorithm==='CAUSAL_KV_CACHE_1'&&e.horizonTradingDays===HORIZON&&e.sampleCountPerRow===1&&e.sampleCount===f.sampleCount&&e.symbol===f.symbol&&e.asOf===f.asOf&&e.inputLastDate===f.asOf&&e.historySignature===f.historySignature&&JSON.stringify(e.targetDates)===JSON.stringify(f.targetDates)&&e.inputCutoff===f.asOf+'T13:30:00+08:00'&&positive(e.runtimeSeconds)&&e.completedAt===f.generatedAt&&e.startedAt<=e.completedAt&&['modelWeightsSHA256','tokenizerWeightsSHA256','runtimeSHA256','baseRuntimeSHA256','upstreamCodeSHA256','inputTensorSHA256','rawSamplesSHA256'].every(k=>hex(e[k]))&&e.displaySignature===displaySignature(f.closePaths,f.candlePath));}catch{return false;}}
function isFresh(f,now=new Date()){
 if(f?.kind!=='KRONOS_FUTURE_INFERENCE'||!iso(f.targetDates?.[0]))return false;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now),get=k=>parts.find(p=>p.type===k)?.value,today=[get('year'),get('month'),get('day')].join('-');
 return f.targetDates[0]>today||f.targetDates[0]===today&&Number(get('hour'))<15;
}
function evaluate(source,f){
 if(!source||source.completed!==true||source.isComplete===false||source.dailySeriesMeta?.onlyCompletedBars===false||source.corporateActionUnresolved||source.priceAdjustmentConsistent===false||source.priceAdjustment?.verified!==true)return bad('完成日K或價格基準尚未核對，先看原行情報告。');
 if(source.volumeSourceConflict||source.sourceVolumeWarning||source.dailyBasisV2?.sourceVolumeWarning||source.volumeScopeAudit?.formalVolumeEligible===false)return bad('成交量來源或統計範圍尚未核對，先不使用這份模型。');
 const original=source.canonicalBars||source.dailySeries||[],window=F.inputWindow(original),bars=window.bars,date=source.closeDate,code=String(source.stock||source.code||source.instrumentType||''),market=source.instrumentType==='TAIEX'?'TWSE_INDEX':source.market;
 if(bars.length<63)return bad('目前只有'+bars.length+'根可用日K，20日模型至少需要63根；不跨越價格斷點補值。');
 if(!iso(date)||bars.at(-1).date!==date||bars.at(-1).close!==source.close||bars.some((b,i)=>!F.validBar(b)||!iso(b.date)||i&&b.date<=bars[i-1].date))return bad('行情日期、價格或日K順序未對齊。');
 const calendar=source.tradingCalendar;if(!calendar?.verified||!Array.isArray(calendar.dates)||JSON.stringify(calendar.dates.filter(d=>d>=bars[0].date&&d<=date))!==JSON.stringify(bars.map(b=>b.date)))return bad('有效日K與正式交易日曆尚未對齊。');
 if(!f)return bad('這檔股票的20日模型尚未完成更新，請稍後再試。');
 if(f.schema!=='shitou-kronos-future-v1'||f.kind!=='KRONOS_FUTURE_INFERENCE'||f.representation!=='CLOSE_PATHS_AND_ONE_RAW_CANDLE_PATH'||f.symbol!==code||f.market!==market||f.asOf!==date||f.frequency!=='1d'||f.horizonTradingDays!==HORIZON||f.historySignature!==F.signature(bars))return bad('模型與這次股票、日期或歷史日K不同，暫不使用舊結果。');
 if(f.model?.id!==MODEL||f.model.revision!==REVISION||f.tokenizer?.id!=='NeoQuasar/Kronos-Tokenizer-base'||f.tokenizer.revision!==TOKENIZER||f.codeCommit!==CODE)return bad('模型來源或權重版本尚未通過核對。');
 const dates=f.targetDates,fc=f.calendar;if(!fc?.verified||!fc.source||!Array.isArray(fc.dates)||fc.dates.some((d,i)=>!iso(d)||i&&d<=fc.dates[i-1])||!Array.isArray(dates)||dates.length!==HORIZON||JSON.stringify(dates)!==JSON.stringify(fc.dates.filter(d=>d>date).slice(0,HORIZON)))return bad('未來20個正式交易日尚未完整核對。');
 const paths=f.closePaths,n=f.sampleCount;if(!Number.isInteger(n)||n<20||n>150||!Array.isArray(paths)||paths.length!==n||paths.some(p=>!Array.isArray(p)||p.length!==HORIZON||p.some(v=>!positive(v))))return bad('模型路徑數量、長度或價格有缺漏。');
 const q=f.outputQuality,c=f.candlePath;if(!q?.rawSamplesPreserved||!Number.isInteger(q.invalidOhlcCount)||q.invalidOhlcCount<0||q.invalidOhlcCount>n*HORIZON||!Number.isInteger(q.validOhlcPathCount)||q.validOhlcPathCount<0||q.validOhlcPathCount>n)return bad('原始模型取樣或K棒品質紀錄不完整。');
 if(c&&(!Number.isInteger(c.sampleIndex)||c.sampleIndex<0||c.sampleIndex>=n||!Array.isArray(c.bars)||c.bars.length!==HORIZON||c.bars.some((b,i)=>!F.validBar(b)||b.close!==paths[c.sampleIndex][i]))||!c&&q.validOhlcPathCount!==0||c&&q.validOhlcPathCount===0)return bad('模擬K棒沒有對應到一條完整、合格的原始路徑。');
 if(!executionVerified(f))return bad('模型執行紀錄或取樣指紋未通過核對。');
 const bands=dates.map((date,i)=>{const values=paths.map(p=>p[i]);return {date,p10:F.quantile(values,.1),p25:F.quantile(values,.25),median:F.quantile(values,.5),p75:F.quantile(values,.75),p90:F.quantile(values,.9)};});
 const first=bands.slice(0,5).reduce((s,b)=>s+b.median,0)/5,last=bands.at(-1).median,close=source.close;
 const direction=last>close?'UP':last<close?'DOWN':'FLAT';
 const summary=first<close&&last>close?'中間走法是先回落、後回升，仍有其他可能。':first>close&&last<first?'中間走法前段反彈、後段回落，仍要觀察。':direction==='UP'?'多種走法的中間位置往上，但不保證上漲。':direction==='DOWN'?'多種走法的中間位置往下，先留意風險。':'多種走法的中間位置大致持平，先等方向清楚。';
 return {version:VERSION,state:'READY',modelRun:true,executionVerified:true,code,market,date,close,history:original,modelBars:bars.length,targetDates:dates,sampleCount:n,closePaths:paths,bands,candlePath:c,validCandlePaths:q.validOhlcPathCount,invalidOhlcBars:q.invalidOhlcCount,summary,direction,
  reading:['說明：藍線是多種收盤走法的中間位置，不是保證路線。','深色帶涵蓋中間一半走法，淺色帶涵蓋中間八成走法。',c?'框線K棒只是一條完整模擬路徑，不代表每天會照著走。':'本批沒有完整合格的模擬K棒，先看藍線與色帶。','色帶越寬，表示走法越分散；50%／80%不是實際勝率。'],
  researchOnly:true,performanceValidated:false,tradeAllowed:false,affectsOriginalEligibility:false,affectsOriginalRanking:false,personalStop:null,identity:[code,market,date,f.historySignature,f.execution.displaySignature].join('|')};
}
return Object.freeze({VERSION,HORIZON,evaluate,isFresh,executionVerified,displaySignature});
});
