/* V9.6 index adapter. The existing life-line core remains the only signal calculator. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./kline-life-03-core-v1.js'):root.ShitouKlineLife03,node?require('./kline-life-03-report-v1.js'):root.ShitouKlineLife03Report,node?require('./structure-context-v1.js'):root.ShitouStructureContext,node?require('./research-v83/market-freshness.js'):root.ShitouMarketFreshness,node?require('./market-life-source-audit-v96.js'):root.ShitouMarketLifeSourceAudit96);if(node)module.exports=api;else root.ShitouMarketLife96=api;})(globalThis,function(Core,Report,Structure,Freshness,Audit){
'use strict';
const VERSION='MARKET_LIFE_REPORT_V96',INSTRUMENT='TAIEX';
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function plain(value){return String(value??'').replaceAll('目前股價方向','目前大盤方向').replaceAll('股價','指數').replaceAll('個股分析','大盤分析').replaceAll('股票完整名稱','指數完整名稱').replaceAll('最高價','最高點').replaceAll('最低價','最低點').replaceAll('追價風險','短線過熱風險').replaceAll('追價與波動風險','短線過熱與波動風險').replaceAll('近期平均每日波動金額','近期平均每日波動點數').replaceAll('不能保證在指定價成交','不代表未來一定在某個點位停住').replaceAll('呈現版本 V9.4','呈現版本 V9.6').replaceAll('交易所未還原成交價格','官方指數點位').replaceAll('OFFICIAL_INDEX_LEVEL','官方指數點位').replaceAll('原始價位','原始點位').replaceAll('下方：成交量（股數）','下方：集中市場成交股數').replaceAll('價格口徑','指數點位口徑').replaceAll(' 元',' 點');}
function fingerprint(history){let hash=2166136261;for(const c of JSON.stringify(history.dailySeries||[])){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return INSTRUMENT+'|'+history.closeDate+'|'+(hash>>>0).toString(16);}
function sourceAudit(history){
 if(!Audit||Audit.instrumentType!==INSTRUMENT||Audit.date!==history?.closeDate||Audit.historyFingerprint!==fingerprint(history)||Audit.archiveSourceSha256!==history.sourceReceipt?.sha256)return null;
 const row=Audit.volumeDifferences.find(r=>r.date===history.closeDate);
 return {date:history.closeDate,uncertain:Audit.volumeDifferences.length>0,archiveLastVolume:history.dailySeries.at(-1).volume,latestOfficialVolume:row?.latest??history.dailySeries.at(-1).volume,latestRetrievedAt:Audit.sources.find(s=>s.kind==='volume')?.retrievedAt,source:Audit.sources.find(s=>s.kind==='volume')?.url,priceDifferences:Audit.priceDifferences,volumeDifferences:Audit.volumeDifferences};
}
function validate(history,{now=new Date(),asOf}={}){
 const fail=reason=>({ok:false,reason});
 if(!history||history.instrumentType!==INSTRUMENT||history.symbol!==INSTRUMENT||history.market!=='TWSE_INDEX'||history.code&&history.code!==INSTRUMENT||history.stock&&history.stock!==INSTRUMENT)return fail('請使用台灣加權指數本身的官方日 K，不能混入個股或其他指數。');
 if(history.provenance==='ILLUSTRATION'||history.kind==='KRONOS_INFERENCE'||history.prediction===true)return fail('示意資料或模型預測不能當成大盤真實行情。');
 if(history.volumeUnit!=='shares'||history.dailySeriesMeta?.volumeFetchError)return fail('集中市場成交股數的來源或單位尚未核對。');
 if(!history.sourceReceipt||!/^[a-f0-9]{64}$/i.test(history.sourceReceipt.sha256||''))return fail('缺少大盤行情來源收據，暫不確認生命線。');
 const revision=sourceAudit(history);if(revision?.priceDifferences?.length)return fail('官方指數點位出現版本差異，請先核對，暫不確認生命線。');
 const checked=Structure.confirmationInput(history);
 if(!checked.ok||!checked.volumeUsable)return fail(checked.reason||'集中市場成交股數待核對，暫不確認生命線。');
 const rows=history.dailySeries||[];
 if(checked.bars.length!==rows.length||rows.some((b,i)=>b.completed===false||b.isComplete===false||b.suspended===true||i&&b.date<=rows[i-1].date||!Number.isFinite(b.volume)||b.volume<=0))return fail('日 K 重複、未完成、停牌或成交股數不足。');
 if(history.dailySeriesMeta.lastDate!==history.closeDate||history.close!==rows.at(-1)?.close||history.dailySeriesMeta.firstDate&&history.dailySeriesMeta.firstDate!==rows[0]?.date||history.dailySeriesMeta.returnedBars!==undefined&&history.dailySeriesMeta.returnedBars!==rows.length)return fail('大盤日期、收盤點位與日 K 範圍不一致。');
 const timing=Freshness.historyStatus(history,now),today=Freshness.taipei(now).date;
 if(!timing.expectedDate||history.tradingCalendar.dates.at(-1)<today||history.closeDate>today||history.closeDate>timing.expectedDate||timing.stale)return fail(timing.message||'尚未核對最近完成交易日。');
 if(asOf&&(!/^\d{4}-\d\d-\d\d$/.test(asOf)||asOf>history.closeDate||!rows.some(b=>b.date===asOf)))return fail('指定研究日沒有已完成的大盤行情。');
 return {ok:true,bars:checked.bars,timing};
}
function evaluate(history,options={}){
 const checked=validate(history,options);
 const identity={code:INSTRUMENT,name:'台灣加權指數',date:options.asOf||history?.closeDate||null};
 if(!checked.ok)return freeze({...Core.evaluate(identity),...identity,instrumentType:INSTRUMENT,unit:'點',marketAdapterVersion:VERSION,reason:checked.reason,sourceVerified:false});
 const source={...identity,date:history.closeDate,sourceBars:checked.bars,validation:{technicalModelAvailable:true},expectedTradingDates:history.tradingCalendar.dates,priceAdjustment:history.priceAdjustment,dataSource:history.dailySeriesMeta.source,dataQuality:{complete:checked.bars.length>=20,missing:checked.bars.length<20?['少於20根完成日 K，部分平均價與風險指標無法計算']:[]},completed:history.completed};
 source.sourceVolumeAudit=sourceAudit(history);
 const study=Core.evaluate(source,options.asOf?{asOf:options.asOf}:{});
 return freeze({...study,instrumentType:INSTRUMENT,unit:'點',marketAdapterVersion:VERSION,sourceVerified:true,snapshotKey:fingerprint(history),indexSource:{price:history.dailySeriesMeta.priceSource||history.dailySeriesMeta.source,volume:history.dailySeriesMeta.volumeSource,volumeMeaning:history.dailySeriesMeta.volumeMeaning||'TWSE集中市場每日成交股數',receipt:history.sourceReceipt,expectedDate:checked.timing.expectedDate,priceBasis:history.priceAdjustment.basis}});
}
function fields(study){
 const convert=value=>typeof value==='string'?plain(value):Array.isArray(value)?value.map(convert):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,convert(v)])):value;
 const f=convert(Report.fields(study));
 f.scenario=convert(study.scenario||{});
 // Describe an already completed failure as a current fact, never as a future first failure.
 if(study.event&&!study.referenceOnly&&['BREAKOUT_FAILED','SUPPORT_BROKEN'].includes(study.lifecycleState)){
  const line=study.event.lifeLinePrice.toFixed(2)+' 點',low=study.currentTrend?.recentLow;
  f.scenario.bullish='觀察完成日 K 收盤能否重新高於 '+line+'；這是重新站回的觀察，不是首次突破，盤中漲過不算確認。';
  f.scenario.bearish='目前已'+(study.lifecycleState==='BREAKOUT_FAILED'?'跌回 '+line+' 或以下，原突破已失守。':'收盤跌破 '+line+' 支撐。')+(Number.isFinite(low)?'接下來留意近期低點 '+low.toFixed(2)+' 點；這是觀察位置，不保證守得住。':'目前沒有可確認的新關卡，先觀察下一個收盤。');
  f.details[3].value=f.scenario.bullish;f.details[4].value=f.scenario.bearish;
 }
 f.overview.trendSummary=({STRONG:'大盤目前偏強，但不代表所有個股同步走強，仍要留意拉回。',WEAK:'大盤目前偏弱，先觀察指數收盤能不能重新站回重要點位。',NEUTRAL:'大盤目前上下整理，等待完成日 K 提供更清楚的方向。'})[study.currentTrend?.state]||'完成日 K 或平均點位資料不足，暫時無法確認大盤方向。';
 f.teaching[0].value='大盤生命線是從加權指數過去的日 K，找出重要參考點位；用完成日 K 的收盤觀察突破或跌破，不是個股買賣指令。';
 if(study.sourceVolumeAudit?.uncertain){f.details[6].value='成交量待核對，暫不作量能確認。\n'+f.details[6].value;f.scenario.pending=['近期高低點與平均價是否配合；成交股數待核對，暫不作量能確認。'];f.details[5].value=f.scenario.pending.join('；')+'\n'+(f.scenario.neutral||'');}
 f.details[6].value+='\n量能使用集中市場成交股數，不是指數本身的交易量，也不能推論每檔個股都有相同買盤。';
 f.details[8].value+='\n指數：TAIEX／台灣加權指數；單位：點。\n點位來源：'+(study.indexSource?.price||'未核對')+'；量能來源：'+(study.indexSource?.volume||'未核對')+'。\n資料擷取時間：'+(study.indexSource?.receipt?.retrievedAt||'未提供')+'。\n大盤方向不等於每檔個股方向；只供研究，不影響選股資格、排序或自動交易。';
 return f;
}
async function ready(doc=globalThis.document){
 if(typeof module==='object'&&module.exports)return require('./market-life-visual-v98.js').ready(doc);
 if(!doc?.createElement)throw Error('大盤圖片需要瀏覽器繪圖環境。');
 const dependencies=[
  ['ShitouLifeVisual972','life-line-visual-v972.js'],
  ['ShitouLifeVisual98','life-line-visual-v98.js'],
  ['ShitouMarketLifeVisual98','market-life-visual-v98.js']
 ];
 for(const [key,file] of dependencies){
  if(globalThis[key])continue;
  await new Promise((resolve,reject)=>{
   const script=doc.createElement('script');
   script.src=new URL('./'+file+'?v=V9.8-MARKETLIFE1',doc.baseURI).href;
   script.async=false;
   script.onload=()=>globalThis[key]?resolve():reject(Error(file+' 載入後未提供繪圖模組'));
   script.onerror=()=>reject(Error(file+' 載入失敗'));
   doc.head.appendChild(script);
  });
 }
 return globalThis.ShitouMarketLifeVisual98.ready(doc);
}
function pages(study,options={}){
 if(study.instrumentType!==INSTRUMENT||study.sourceVerified!==true)throw Error('大盤生命線不能使用未核對行情或個股研究物件。');
 const P=typeof module==='object'&&module.exports?require('./market-life-visual-v98.js'):globalThis.ShitouMarketLifeVisual98;
 if(!P)throw Error('V9.8 大盤圖片尚未載入，請先呼叫 ready()。');
 return P.build(study,options);
}
return Object.freeze({VERSION,INSTRUMENT,validate,evaluate,fields,pages,plain,fingerprint,sourceAudit,ready});
});
