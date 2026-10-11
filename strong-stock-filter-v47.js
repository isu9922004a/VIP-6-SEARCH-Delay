/* 強勢飆股濾網 V50 R5.3.2.5.6.3.1：圖片版面一致性；三盤、價格三線、量能三線與費波規則不變。
   沿用官方市場成交量校正與同級執行品質次排序；S/A/B資格與原條件分不變。 */
(function(root,factory){const api=factory(root?.ShitouWaveCoreV48,root?.ShitouXiaoMingDaoV52);if(typeof module==='object'&&module.exports){let W=null,X=null;try{W=require('./shitou-wave-core-v48.js');}catch(_){}try{X=require('./xiaomingdao-course-v52.js');}catch(_){}module.exports=factory(W,X);}else if(root)root.ShitouStrongStockFilterV47=api;})(typeof globalThis!=='undefined'?globalThis:null,function(W,X){
'use strict';
const MODEL='STRONG_STOCK_FILTER_V50_WAVE_FIB';
const RULE=Object.freeze({minTradeValue:10000000,maxGap21Pct:18,minBars:60});
const invalid=reason=>({status:'DATA',eligible:false,reason});
const number=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(typeof v==='string'?v.replace(/,/g,''):v);return Number.isFinite(n)?n:null;};
function date(value){const m=String(value??'').trim().match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);if(!m)return null;const out=`${m[1]}-${m[2]}-${m[3]}`,d=new Date(out+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===out?out:null;}
const FALLBACK_TWSE_CLOSED_V49=Object.freeze({
  '2026-01-01':'中華民國開國紀念日','2026-02-12':'春節休市','2026-02-13':'春節休市',
  '2026-02-16':'農曆春節','2026-02-17':'農曆春節','2026-02-18':'農曆春節','2026-02-19':'農曆春節','2026-02-20':'農曆春節',
  '2026-02-27':'和平紀念日補假','2026-04-03':'兒童節補假','2026-04-06':'清明節補假','2026-05-01':'勞動節',
  '2026-06-19':'端午節','2026-09-25':'中秋節','2026-09-28':'教師節','2026-10-09':'國慶日補假',
  '2026-10-26':'臺灣光復暨金門古寧頭大捷紀念日補假','2026-12-25':'行憲紀念日'
});
function marketClosedStateV49(meta,today){
  const weekday=new Date(today+'T00:00:00Z').getUTCDay();
  if(weekday===0||weekday===6)return {closed:true,name:'週末'};
  if(meta?.todayMarketClosed===true)return {closed:true,name:String(meta?.marketClosureName||'官方休市日')};
  const closures=Array.isArray(meta?.marketCalendar?.closures)?meta.marketCalendar.closures:[];
  const compact=today.replace(/-/g,'');
  const hit=closures.find(x=>String(x?.date||'').replace(/-/g,'')===compact);
  if(hit)return {closed:true,name:String(hit?.name||'官方休市日')};
  const name=FALLBACK_TWSE_CLOSED_V49[today];
  return name?{closed:true,name}:{closed:false,name:null};
}
function validateMarket(meta,marketRowCount,now=new Date()){
  if(!meta||meta.marketCoverageReady!==true||meta.industryCoverageReady!==true)return {ok:false,reason:'上市、上櫃完整市場或官方產業覆蓋尚未確認'};
  const target=date(meta.targetTradeDate||meta.completedTradeDate),completed=date(meta.completedTradeDate||meta.targetTradeDate),twse=date(meta.twseQuoteDate),tpex=date(meta.tpexQuoteDate);
  if(!target||!completed||!twse||!tpex||new Set([target,completed,twse,tpex]).size!==1)return {ok:false,reason:'市場、上市、上櫃交易日不一致或日期缺失'};
  const count=number(meta.total);if(count===null||count!==marketRowCount||count<1000)return {ok:false,reason:'市場快照筆數不足或與中繼資料不一致'};
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),get=k=>parts.find(p=>p.type===k)?.value,today=`${get('year')}-${get('month')}-${get('day')}`,minutes=Number(get('hour'))*60+Number(get('minute'));
  const closed=marketClosedStateV49(meta,today);
  if(today===target&&minutes<17*60+35&&!closed.closed)return {ok:false,reason:'當日盤後資料整理期間；建議 17:35 後再查詢'};
  if(target>today)return {ok:false,reason:'市場快照日期在未來'};
  // The same validator treats 17:35 as the end of the official post-close
  // preparation window. Do not demand today's snapshot at 15:00 while that
  // window is still open; the last fully aligned completed snapshot remains
  // usable and is reported under its own verified date.
  if(target!==today&&minutes>=17*60+35&&!closed.closed){const weekday=new Date(today+'T00:00:00Z').getUTCDay();if(weekday>=1&&weekday<=5)return {ok:false,reason:`目前仍是 ${target} 舊市場快照，尚未取得 ${today} 最新盤後資料`};}
  return {ok:true,date:target,marketClosed:closed.closed,marketClosureName:closed.name};
}
function officialIndustry(record){const code=String(record?.industryCode??'').trim(),name=String(record?.industryName||record?.industry||'').trim();if(!code&&!name)return {key:'UNKNOWN',reason:'官方產業別缺失'};if(code==='17'||/金融|銀行|保險|證券|金控/.test(name))return {key:'FINANCIAL'};if(code==='22'||/生技|醫療|製藥|藥品|生物科技|醫材/.test(name))return {key:'BIOTECH'};return {key:'OK'};}
function normalize(report,snapshotDate,quote){const source=report?.dailySeries;if(!Array.isArray(source)||source.length<RULE.minBars)return invalid(`完整已收盤日K少於${RULE.minBars}根`);const rows=[];let previous='';for(const item of source){const d=date(item?.date),open=number(item?.open),high=number(item?.high),low=number(item?.low),close=number(item?.close),volume=number(item?.volume);if(!d||d<=previous||!(open>0&&high>0&&low>0&&close>0&&volume!==null&&volume>=0)||high<Math.max(open,low,close)||low>Math.min(open,high,close))return invalid('日K日期、順序或OHLCV資料不完整／不合理');rows.push({date:d,open,high,low,close,volume});previous=d;}
 const final=rows.at(-1),reportDate=date(report?.closeDate),marketDate=date(snapshotDate);if(!reportDate||!marketDate||final.date!==reportDate||reportDate!==marketDate)return invalid(`市場／個股／日K資料日期不一致：${marketDate||'-'}／${reportDate||'-'}／${final.date}`);const displayed=number(report?.close),market=number(quote?.close),quoteDate=date(quote?.quoteDate);if(!(displayed>0&&market>0)||quoteDate!==marketDate||Math.abs(displayed-final.close)>Math.max(.02,final.close*.0001)||Math.abs(market-final.close)>Math.max(.02,final.close*.0001))return invalid('市場報價、個股收盤與日K收盤不同價／不同日');const qv=number(quote?.volume);if(!(qv>0)||!(final.volume>0))return invalid(`同日成交量缺失：${marketDate}`);
 const sourceVolume=final.volume,ratio=qv/sourceVolume,diffPct=Math.abs(qv-sourceVolume)/qv*100;
 // R4.9.3：同日、同收盤已驗證後，以市場完整快照成交量作「最新一根日K」正式口徑。
 // 小幅來源差異不再把整檔股票丟成 DATA；差異越大只降低資料信心。極端差異仍停止，避免單位/來源錯置。
 if(!Number.isFinite(ratio)||ratio<=0||ratio>=10||ratio<=0.1||diffPct>20){return invalid(`同日市場與個股日K成交量差異過大：市場 ${qv} 股／日K ${sourceVolume} 股（差異 ${diffPct.toFixed(1)}%，比值 ${ratio.toFixed(3)}）；為避免成交量單位或來源錯置，本檔停止判讀`);}
 const confidence=diffPct<=5?'HIGH':diffPct<=12?'MEDIUM':'LOW';
 final.volume=qv;
 const volumeAudit={officialVolume:qv,sourceVolume,diffPct,ratio,confidence,reconciled:Math.abs(qv-sourceVolume)>Math.max(100,qv*.001),note:confidence==='HIGH'?'成交量來源差異小，已用市場快照校正':confidence==='MEDIUM'?'成交量來源有中度差異，已用市場快照校正並降低同級排序信心':'成交量來源差異偏大但仍在容許範圍，已用市場快照校正並明確降權'};
 return {status:'OK',rows,date:marketDate,volumeAudit};}
function detect(rows){if(!W?.analyzeBars)return {status:'DATA',eligible:false,reason:'新版量價波段核心未載入'};const a=W.analyzeBars(rows);if(!a.ok)return {status:'DATA',eligible:false,reason:a.reason,wave:a};const g=W.grade(a);if(g.key==='REJECT')return {status:'REJECT',eligible:false,reason:a.risk.join('、')||'量價結構轉弱',wave:a};if(g.key==='WATCH')return {status:'REJECT',eligible:false,reason:'目前仍在等待區，三盤／量潮／均線條件尚未同時成熟',wave:a};const risk=[...(a.risk||[])];if((a.gap21Pct||0)>12&&!risk.some(x=>/追價距離偏大/.test(x)))risk.push(`追價距離偏大：最新收盤離強弱分界線 ${a.gap21Pct.toFixed(1)}%`);return {status:g.key,label:g.label,eligible:true,reason:a.plain,wave:a,score:a.score,close:a.close,trigger:a.trigger,support:a.support,referenceHigh:a.prior2High,volumeMultiple:a.mv5>0?a.bars.at(-1).volume/a.mv5:null,ma21GapPct:a.gap21Pct,ma20GapPct:a.gap21Pct,closePosition:a.closePosition,phase:a.phase,phaseLabel:a.phaseLabel,threeBreakout:a.threeBreakout,threeBreakdown:a.threeBreakdown,maText:a.maText,mvText:a.mvText,fib:a.fib,fibTieRank:a.fibTieRank,evidence:a.evidence,risk};}
function executionQuality(found,volumeAudit){
  if(!found?.eligible)return null;
  let q=50;
  const gap=Math.max(0,number(found.ma21GapPct)??0),vol=number(found.volumeMultiple),trigger=number(found.trigger),close=number(found.close),pos=number(found.closePosition);
  q+=gap<=8?18:gap<=12?10:gap<=15?4:-4;
  if(vol!==null)q+=vol>=1&&vol<=3?15:vol>=.8?8:vol>=.6?2:-8;
  const slopes=found.wave?.mvSlope||{};q+=[slopes.mv5>0,slopes.mv13>0,slopes.mv34>0].filter(Boolean).length*4;
  if(found.threeBreakout)q+=10;
  if(trigger>0&&close>0){const ext=(close/trigger-1)*100;q+=ext>=0&&ext<=2?8:ext<=5?4:ext<=8?0:-6;}
  if(pos!==null)q+=pos>=.7?5:pos>=.5?2:0;

  if(volumeAudit?.confidence==='HIGH')q+=5;else if(volumeAudit?.confidence==='MEDIUM')q+=1;else if(volumeAudit?.confidence==='LOW')q-=7;
  return Math.round(Math.max(0,Math.min(100,q)));
}
function evaluate(report,marketDate,quote){const verified=normalize(report,marketDate,quote);if(verified.status!=='OK')return verified;report={...report,dailySeries:verified.rows,canonicalBars:verified.rows,marketDate:verified.date,volumeAudit:verified.volumeAudit};const P=globalThis.ShitouScanPolicy5328||(typeof require==='function'?require('./scan-exclusions-rsi-v5328.js'):null),liquid=P?.liquidity(report);if(liquid?.known&&!liquid.ok)return {status:'REJECT',eligible:false,reason:liquid.reason,volumeAudit:verified.volumeAudit};const found=detect(verified.rows);if(!found.eligible)return {...found,volumeAudit:verified.volumeAudit||null};const eq=executionQuality(found,verified.volumeAudit),course=X?.analyze?X.analyze(report,found.wave):null;return {...found,model:MODEL,date:verified.date,code:String(report.stock||report.code||''),name:String(report.name||report.stock||report.code||''),report,volumeAudit:verified.volumeAudit||null,dataConfidence:verified.volumeAudit?.confidence||'UNKNOWN',executionQuality:eq,courseV52:course,courseSuitabilityScore:course?.score??null};}
function compare(a,b){const pri={S:0,A:1,B:2};const confidence={HIGH:0,MEDIUM:1,LOW:2};return (confidence[a.dataConfidence]??3)-(confidence[b.dataConfidence]??3)||(pri[a.status]??9)-(pri[b.status]??9)||(b.courseSuitabilityScore??-1)-(a.courseSuitabilityScore??-1)||b.score-a.score||(b.executionQuality??-1)-(a.executionQuality??-1)||((b.wave?.volumeStart?1:0)-(a.wave?.volumeStart?1:0))||a.code.localeCompare(b.code);}
function backtest(bars,signalIndex,horizon=5){if(!Array.isArray(bars)||signalIndex<2||signalIndex>=bars.length-1||!(horizon>0))return {status:'UNAVAILABLE',reason:'缺少下一交易日開盤價'};if(signalIndex+1+horizon-1>=bars.length)return {status:'UNFINISHED',reason:'後續完整交易日未達觀察期間'};const entry=number(bars[signalIndex+1]?.open),exit=number(bars[signalIndex+horizon]?.close);if(!(entry>0&&exit>0))return {status:'UNAVAILABLE',reason:'進出場量價缺失'};return {status:'COMPLETE',entryDate:date(bars[signalIndex+1].date),entry,exit,horizon,returnPct:(exit/entry-1)*100,method:'訊號次一交易日開盤→第N交易日收盤；未含成本與滑價'};}
return Object.freeze({MODEL,RULE,number,date,validateMarket,marketClosedStateV49,officialIndustry,normalize,detect,evaluate,compare,backtest});
});
