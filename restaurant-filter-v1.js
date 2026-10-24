/* Restaurant 1: transparent long-side adaptation of the supplied screenshot.
 * It is not a reproduction of the source's JMA or proprietary main-broker data.
 */
(function(root,factory){const N=typeof module==='object'&&module.exports,api=factory(N?require('./selection-evidence-v1.js'):root.ShitouSelectionEvidenceV1,N?require('./indicator-shadow-v1.js'):root.ShitouIndicatorShadowCore,N?require('./scan-exclusions-rsi-v5328.js'):root.ShitouScanPolicy5328,N?require('./version-v50.js'):root.ShitouReleaseV50);if(N)module.exports=api;else root.ShitouRestaurantCore=api;})(globalThis,function(E,I,P,R){
'use strict';
const PA=typeof module==='object'&&module.exports?require('./price-action-context-v1.js'):globalThis.ShitouPriceActionV1;
const MODEL='RESTAURANT_BALANCED_1',RULE=Object.freeze({eventWindow:3,minBars:26,volumeSoftMax:1.2,belowMAWatchPct:3,lateGapPct:15,lateReturn10Pct:30,extremeGapPct:20,extremeReturn10Pct:35,exhaustionVolume:3,exhaustionShadow:.35,weakClose:.4,rankPreferred:100,priceTrend:'SMA20_NOT_JMA',ranking:'RISK_THEN_FIT_NO_WEIGHT_SEARCH'});
const REVISION='RESTAURANT_BUGFIX_1';
function number(v){
 if(typeof v!=='number'&&typeof v!=='string')return null;
 if(typeof v==='string'){
  v=v.trim();if(!v)return null;
  if(v.includes(',')){if(!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(v))return null;v=v.replace(/,/g,'');}
 }
 return Number.isFinite(Number(v))?Number(v):null;
}
function price(v){const n=number(v);return n===null?'資料不足':n.toFixed(2);}
function comparePrice(close,threshold){
 const lhs=number(close),rhs=number(threshold),ok=lhs>0&&rhs>0;
 return {key:'EVENT_LOW_BROKEN',operator:'<',close:lhs,threshold:rhs,status:ok?'OK':'DATA',breached:ok?lhs<rhs:null,relation:ok?(lhs<rhs?'<':lhs>rhs?'>':'='):null};
}
function closeLocation(bar,asOf){
 const b={date:E.date(bar?.date)};for(const k of ['open','high','low','close'])b[k]=number(bar?.[k]);
 if(!b.date||b.date!==E.date(asOf)||['open','high','low','close'].some(k=>!(b[k]>0))||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high))return {status:'DATA',belowMidpoint:null,position:null,reason:'同日日K的日期或OHLC無效'};
 const flat=b.high===b.low,midpoint=(b.high+b.low)/2;
 return {status:'OK',...b,midpoint,flat,position:flat?.5:(b.close-b.low)/(b.high-b.low),belowMidpoint:b.close<midpoint};
}
// Restaurant-only ingestion: shared strategy parsers and their gates stay unchanged.
function numericRecord(row,preserveReportVolume=false){const out={...row};for(const k of ['open','high','low','close','volume','tradeValue'])if(Object.hasOwn(out,k)&&!(k==='volume'&&preserveReportVolume&&out[k]&&typeof out[k]==='object'))out[k]=number(out[k]);return out;}
function levelLine(c){
 const x=c.validation?.invalidation;
 if(!x||x.status!=='OK')return '量價防守線：資料不足；請重新掃描，不沿用舊判斷';
 const state=x.breached?'已跌破訊號日低點':x.relation==='='?'接觸訊號日低點，未嚴格跌破':'未跌破訊號日低點';
 return `量價防守：${state}（${price(x.close)} ${x.relation} ${price(x.threshold)}）｜跌破才失效`;
}
function validationLines(c){
 const v=c.validation;if(!v)return ['資料基準：待確認，請重新掃描'];
 const p=v.closeLocation;
 return [levelLine(c),p?.status==='OK'?`日內位置：收盤 ${price(p.close)} ${p.belowMidpoint?'<':p.close===p.midpoint?'=':'>'} 中點 ${price(p.midpoint)}${p.flat?'｜高低價相同，無日內區間':p.belowMidpoint?'｜下半部':'｜非下半部'}`:'日內位置：資料不足',`資料基準 ${v.date}｜${v.market}｜${v.revision}｜${v.id}｜調整口徑${v.basisVerified?'已驗證':'待確認'}`];
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const LABELS=Object.freeze({CANDIDATE:'均衡量價候選',WATCH:'附警訊觀察',NO_CHASE:'高風險旁列',NO_SIGNAL:'未見近期訊號',DATA:'資料不足',EXCLUDED:'共用排除'});
// Display names only: no changes to qualification, risk rules or comparison.
let nameDirectory=null;
const nameKeys=['name','stockName','companyName','shortName','nameZhTW','nameZh','name_zh_tw'];
function setNameDirectory(directory){nameDirectory=Object.assign(Object.create(null),directory?.byCode||directory||{});}
function chineseName(value,allowSuffix=false){
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))return null;
 let text=value.trim().normalize('NFKC');
 if(allowSuffix)text=text.replace(/[-－]?(?:KY|DR)(?:\*)?$/i,'').trim();
 return text&&/[\u3400-\u9fff]/.test(text)&&!/[\p{Script=Latin}]/u.test(text)&&!/[<>]/.test(text)?text:null;
}
function nameInfo(code,record={}){
 code=String(code||'').replace(/[^0-9]/g,'');
 const entry=nameDirectory?.[code],mapped=typeof entry==='string'?entry:entry?.name;
 const local=chineseName(mapped,true);
 if(local)return {name:local,source:'TRADITIONAL_DIRECTORY',fallback:false};
 if(['TRADITIONAL_DIRECTORY','EXPLICIT_ZH_TW','CHINESE_INPUT'].includes(record?.nameSource)&&record.nameFallback!==true){const trusted=chineseName(record.name);if(trusted)return {name:trusted,source:record.nameSource,fallback:false};}
 for(const key of ['nameZhTW','name_zh_tw']){const value=chineseName(record?.[key]);if(value)return {name:value,source:'EXPLICIT_ZH_TW',fallback:false};}
 // Standalone core callers may already supply Chinese test/source names. In the
 // app, unindexed generic names are not presumed to be Traditional Chinese.
 if(nameDirectory===null){for(const key of nameKeys){const value=chineseName(record?.[key]);if(value)return {name:value,source:'CHINESE_INPUT',fallback:false};}}
 return {name:'股票'+code,source:'CODE_ONLY',fallback:true};
}
function displayName(code,record){return nameInfo(code,record).name;}
function namedReport(report,name){const copy={...report,name};for(const key of nameKeys)if(Object.hasOwn(copy,key))copy[key]=name;for(const key of ['englishName','nameEn','name_en','companyNameEn','stockNameEn'])delete copy[key];return copy;}
function tick(p){return p<10?.01:p<50?.05:p<100?.1:p<500?.5:p<1000?1:5;}
function estimatedUpper(reference){if(!(reference>=1))return null;const raw=reference*1.1,t=tick(raw);return Math.round(Math.floor((raw+1e-9)/t)*t*100)/100;}
const equal=(a,b)=>Math.abs(a-b)<=1e-6;
function windowSize(v){return [1,3,5].includes(Number(v))?Number(v):RULE.eventWindow;}
function supplemental(record,report,asOf){return record?.verified===true&&E.date(record.date)===asOf&&String(record.code)===String(report.stock||report.code)&&String(record.market).toUpperCase()===String(report.market).toUpperCase()&&typeof record.source==='string'&&record.source.trim().length>0;}
function limitAt(report,bars,index){
 const bar=bars[index],prior=bars[index-1];if(!prior)return {kind:'UNKNOWN',date:bar.date};
 const evidence=report.restaurantEvidence||{},records=Array.isArray(evidence.limits)?evidence.limits:[];
 const hits=records.filter(r=>E.date(r.date)===bar.date&&supplemental(r,report,bar.date));
 if(hits.length>1)return {kind:'UNKNOWN',date:bar.date,reason:'官方漲停欄位重複'};
 const official=hits[0];
 if(official?.noPriceLimit===true)return {kind:'NO_LIMIT',date:bar.date};
 if(official&&number(official.limitUpPrice)>0){const price=number(official.limitUpPrice);if(bar.high>price+1e-6)return {kind:'UNKNOWN',date:bar.date,reason:'日K超過提供的漲停價'};return {kind:'OFFICIAL',date:bar.date,price,closed:equal(bar.close,price),touched:equal(bar.high,price),source:official.source};}
 if(report.noPriceLimit===true||report.noDailyLimit===true||(report.corporateActions||[]).some(e=>!E.date(e.date)||E.date(e.date)===bar.date))return {kind:'UNKNOWN',date:bar.date,reason:'公司行動或無漲跌幅限制，不以前收推估'};
 const price=estimatedUpper(prior.close);if(!price||bar.high>price+1e-6)return {kind:'UNKNOWN',date:bar.date,reason:'非標準10%範圍或參考價不足'};
 return {kind:'ESTIMATED',date:bar.date,price,closed:equal(bar.close,price),touched:equal(bar.high,price),source:'前收×1.1依普通股升降單位向下取整；非官方競價基準'};
}
function evaluate(report,options={}){
 const asOf=E.date(options.asOf),code=String(report?.stock||report?.code||''),q=options.quote&&numericRecord(options.quote),window=windowSize(options.eventWindow);
 if(report){report=numericRecord(report,true);for(const key of ['canonicalBars','dailySeries'])if(Array.isArray(report[key]))report[key]=report[key].map(r=>numericRecord(r));}
 const naming=nameInfo(code,report);
 const base={model:MODEL,code,name:naming.name,nameSource:naming.source,nameFallback:naming.fallback,date:asOf,status:'DATA',eligible:false,sourceMatch:null,sourceCheckState:'UNVERIFIED',monthlyStatus:E.monthly(report||{}),reasons:[],warnings:[],riskCodes:[],rule:{...RULE,eventWindow:window},score:null};
 const missing=reason=>({...base,label:LABELS.DATA,reasons:[reason]});
 if(!report||!asOf||!q)return missing('缺少目標交易日或同日市場報價');
 if(!(number(report.close)>0))return missing('報告收盤價缺失或無效');
 if([q.code,q.stock].some(v=>v&&String(v)!==code))return missing('市場報價股票代號不符');
 if(report.completed===false||report.isComplete===false||!(report.completed===true||report.isComplete===true||report.dataTiming==='POST_CLOSE_ONLY'))return missing('完成盤後狀態未確認');
 if(String(options.code||code)!==code||!/^\d{4}$/.test(code))return missing('個股代號不符或非普通股代號');
 if(String(report.market).toUpperCase()!==String(q.market).toUpperCase()||!['TWSE','TPEX'].includes(String(report.market).toUpperCase()))return missing('市場別不符／未提供');
 const decision=P.classify(code,q,options.sector||{},options.meta||{});
 if(decision.excluded)return {...base,status:'EXCLUDED',label:LABELS.EXCLUDED,reasons:[decision.reason]};
 if(report.canonicalBars?.length&&report.dailySeries?.length){const a=E.normalize(report.canonicalBars,asOf),b=E.normalize(report.dailySeries,asOf);if(!a.ok||!b.ok||I.fingerprint(a.bars)!==I.fingerprint(b.bars))return missing('canonicalBars與dailySeries不同快照，請重新取得共用日K');}
 const indicator=I.evaluate(report,{asOf});if(indicator.status==='DATA')return missing(indicator.reasons.join('；'));
 const check=E.normalize(report.canonicalBars||report.dailySeries,asOf);if(!check.ok)return missing(check.reason);
 const b=check.bars,last=b.at(-1),prev=b.at(-2);
 const sourceClose=report.close;report={...report,close:last.close};
 const basis=report.priceAdjustment?.basis;
 if((report.canonicalBars||report.dailySeries).some(r=>r.priceAdjustmentBasis&&basis&&r.priceAdjustmentBasis!==basis)||q.priceAdjustmentBasis&&basis&&q.priceAdjustmentBasis!==basis)return missing('日K與快照價格調整基準不一致');
 if(E.date(q.quoteDate)!==asOf||['open','high','low','close'].some(k=>!(number(q[k])>0)||Math.abs(q[k]-last[k])>Math.max(.02,last[k]*.0001))||!(number(q.volume)>0)||Math.abs(q.volume-last.volume)/q.volume>.2)return missing('市場與日K日期、OHLC或量未對齊');
 const liquid=P.liquidity(report);if(!liquid.known)return missing(liquid.reason);if(!liquid.ok)return {...base,status:'EXCLUDED',label:LABELS.EXCLUDED,reasons:[liquid.reason]};
 const priceAction=PA.evaluate(report,{asOf,bars:b,quote:q,completed:true});if(priceAction.state==='DATA')return missing(priceAction.reason);
 const ma20=mean(b.slice(-20).map(x=>x.close)),v5=mean(b.slice(-6,-1).map(x=>x.volume)),v20=mean(b.slice(-21,-1).map(x=>x.volume));
 if(!(v5>0&&v20>0))return missing('歷史成交量分母不足');
 const volume5=last.volume/v5,volume20=last.volume/v20,range=last.high-last.low,location=closeLocation(last,asOf),pos=location.position,shadow=range?(last.high-Math.max(last.open,last.close))/range:0;
 const gap=(last.close/ma20-1)*100,return10=(last.close/b.at(-11).close-1)*100,cmf20=E.cmf(b),priorHigh=Math.max(...b.slice(-21,-1).map(x=>x.high));
 const trail=b.slice(-5).map((_,j)=>{const i=b.length-5+j;return {...limitAt(report,b,i),index:i,low:b[i].low,high:b[i].high};});
 const events=trail.slice(-window).filter(x=>x.closed),event=events.at(-1),opened=trail.at(-1).touched&&!trail.at(-1).closed;
 let streak=0;for(let i=trail.length-1;i>=0&&trail[i].closed;i--)streak++;
 const main=report.restaurantEvidence?.mainNetBuyShare,jma=report.restaurantEvidence?.jma20;
 const mainValid=supplemental(main,report,asOf)&&main.definition==='MAIN_NET_BUY_VOLUME_OVER_TOTAL_VOLUME'&&number(main.valuePct)!==null&&Math.abs(main.valuePct)<=100;
 const jmaValid=supplemental(jma,report,asOf)&&jma.period===20&&number(jma.value)>0&&typeof jma.formulaId==='string'&&jma.formulaId.trim();
 const rankKnown=options.valueRankVerified===true&&Number.isInteger(options.valueRank)&&options.valueRank>0;
 const checks=[{key:'TODAY_LIMIT',label:'圖片：今日至少1天漲停',pass:trail.at(-1).kind==='OFFICIAL'?trail.at(-1).closed:null,note:trail.at(-1).kind==='OFFICIAL'?'已提供官方漲停價':'未取得官方漲停價；推估不算原條件驗證'},
  {key:'MAIN',label:'圖片：主力買超占量 >5%',pass:mainValid?main.valuePct>5:null,note:mainValid?`${main.valuePct}%｜${main.source}`:'未提供同日可驗證的原始主力定義資料；OBV／CMF不替代'},
  {key:'VOLUME',label:'今日量 < 前5日均量',pass:volume5<1,note:'比較均量排除今日；與來源平台窗口口徑尚未核對'},
  {key:'JMA',label:'圖片：收盤 > JMA20',pass:jmaValid?last.close>jma.value:null,note:jmaValid?`${jma.formulaId}｜${jma.source}`:'未取得原公式／值；本版趨勢另用SMA20，不冒稱JMA'},
  {key:'VALUE',label:'上市櫃普通股成交值前100',pass:rankKnown?options.valueRank<=100:null,note:rankKnown?`同日完整市場普通股序位 ${options.valueRank}`:'完整排名母體或成交值不足'},
  {key:'CMF',label:'CMF20 >0',pass:cmf20===null?null:cmf20>0,note:'20根日K收盤位置乘成交量的統計，不是主力身分'}];
 const unknown=checks.filter(x=>x.pass===null).map(x=>x.key),failed=checks.filter(x=>x.pass===false).map(x=>x.key),risks=[],hard=[],warnings=[...indicator.warnings];
 if(!event)return {...base,status:'NO_SIGNAL',label:LABELS.NO_SIGNAL,reasons:[`近${window}根完成日K未見收盤漲停／推估漲停事件`],checks,indicator,event:null,sourceCheckState:unknown.length?'UNVERIFIED':failed.length?'NOT_MATCH':'VERIFIED_MATCH',sourceMatch:failed.length?false:unknown.length?null:true};
 const age=b.length-1-event.index;
 const invalidation=comparePrice(last.close,event.low),riskChecks=[];
 const recordRisk=(key,triggered,isHard=false)=>{triggered=triggered===true;riskChecks.push({key,triggered,kind:isHard?'HARD':'WARNING'});if(triggered)(isHard?hard:risks).push(key);};
 if(event.kind!=='OFFICIAL')warnings.push('漲停事件採前收與普通股升降單位推估，尚未官方確認');
 if(unknown.length)warnings.push('圖片原條件尚未完整驗證：'+unknown.map(k=>({TODAY_LIMIT:'官方漲停價',MAIN:'主力買超',JMA:'JMA20',VALUE:'完整成交值排名',CMF:'CMF20'}[k]||k)).join('／'));
 recordRisk('EVENT_LOW_BROKEN',invalidation.breached,true);
 recordRisk('BREAKOUT_FAILED_WEAK_CLOSE',last.high>priorHigh&&last.close<priorHigh&&volume20>=1.5&&pos<RULE.weakClose,true);
 recordRisk('EXHAUSTION_WEAK_CLOSE',volume20>=RULE.exhaustionVolume&&shadow>=RULE.exhaustionShadow&&pos<=RULE.weakClose,true);
 recordRisk('EXTREME_EXTENSION',gap>RULE.extremeGapPct&&(return10>RULE.extremeReturn10Pct||streak>=3),true);
 recordRisk('BELOW_MA20_3PCT',gap<-RULE.belowMAWatchPct,true);
 recordRisk('EXTENDED_MA20',gap>RULE.lateGapPct);
 recordRisk('FAST_RISE_10D',return10>RULE.lateReturn10Pct);
 recordRisk('MANY_LIMIT_EVENTS',trail.filter(x=>x.closed).length>=3);
 recordRisk('NOT_CONTRACTING',volume5>RULE.volumeSoftMax);
 recordRisk('BELOW_MA20',last.close<ma20);
 recordRisk('CMF_NOT_POSITIVE',cmf20===null||cmf20<=0);
 recordRisk('MAIN_NOT_CONFIRMED',mainValid&&main.valuePct<=5);
 recordRisk('BELOW_JMA20',jmaValid&&last.close<=jma.value);
 recordRisk('WEAK_CLOSE',location.belowMidpoint);
 recordRisk('LIMIT_OPENED',opened);
 recordRisk('OBV_DIVERGENCE',indicator.obv?.state==='PRICE_HIGH_NOT_CONFIRMED');
 recordRisk('PRICE_ACTION_CAUTION',priceAction.state==='CAUTION',true);
 recordRisk('PRICE_ACTION_WAIT',priceAction.state==='WATCH');
 const status=hard.length?'NO_CHASE':risks.length?'WATCH':'CANDIDATE';
 const riskTexts={PRICE_ACTION_CAUTION:priceAction.concerns.join('；'),PRICE_ACTION_WAIT:priceAction.waiting.join('；'),EVENT_LOW_BROKEN:'收盤跌破最近訊號日低點',BREAKOUT_FAILED_WEAK_CLOSE:'放量越過前20日高點後，收盤退回且偏弱',EXHAUSTION_WEAK_CLOSE:'量達前20日均量3倍，長上影且弱收盤',EXTREME_EXTENSION:'乖離逾20%，且短期急漲／連續訊號，末升段風險偏高',BELOW_MA20_3PCT:'收盤低於SMA20超過3%',EXTENDED_MA20:'離SMA20逾15%，追價距離偏大',FAST_RISE_10D:'10日漲幅逾30%',MANY_LIMIT_EVENTS:'近5根至少3次漲停／推估漲停，留意末升段',NOT_CONTRACTING:'量／前5日均量大於1.2倍，尚非量縮整理',BELOW_MA20:'尚未站回SMA20',CMF_NOT_POSITIVE:cmf20===null?'CMF20資料不足':'CMF20未偏正',WEAK_CLOSE:'收盤在日內區間下半部',LIMIT_OPENED:'今日觸及漲停／推估上限，收盤未鎖住',OBV_DIVERGENCE:'股價創高而OBV未確認',MAIN_NOT_CONFIRMED:'已提供的主力買超占量未超過5%',BELOW_JMA20:'已提供的JMA20條件尚未站上'};
 const validation={revision:REVISION,release:R.code,date:asOf,market:String(report.market).toUpperCase(),code,historyFingerprint:I.fingerprint(b),snapshot:report.dailyBasisV2||null,quote:{...q},quoteFingerprint:I.fingerprint(q),marketSnapshot:{date:asOf,source:options.meta?.source||null,contentSha256:options.meta?.snapshotContentSha256||null,generatedAt:options.meta?.snapshotGeneratedAt||null},sourceClose,basis:report.priceAdjustment||{verified:false,basis:'UNKNOWN'},basisVerified:report.priceAdjustment?.verified===true,invalidation,closeLocation:location,riskChecks};
 validation.id=I.fingerprint(validation);
 const localFit=[volume5<1,last.close>ma20,cmf20>0,(options.baselineValueRank??(rankKnown?options.valueRank:null))>0&&(options.baselineValueRank??options.valueRank)<=100].filter(Boolean).length;
 return {...base,priceAction,status,label:LABELS[status],eligible:status==='CANDIDATE'||status==='WATCH',sourceMatch:failed.length?false:unknown.length?null:true,sourceCheckState:unknown.length?'UNVERIFIED':failed.length?'NOT_MATCH':'VERIFIED_MATCH',
  reasons:[`近${window}根內${event.kind==='OFFICIAL'?'官方':'推估'}收盤漲停事件 ${event.date}（距今${age}根）`,...[...hard,...risks].map(k=>riskTexts[k])],warnings,checks,riskCodes:[...hard,...risks],hardRiskCodes:hard,indicator,event:{...event,age,streak},
  validation,features:{ma20,gap20Pct:gap,return10Pct:return10,volumeRatio5:volume5,volumeRatio20:volume20,closePosition:pos,upperShadow:shadow,cmf20,valueRank:rankKnown?options.valueRank:null,valueRankVerified:rankKnown,tradeValue:q.tradeValue,baselineValueRank:options.baselineValueRank??(rankKnown?options.valueRank:null),localFit,sourcePassed:checks.filter(x=>x.pass===true).length,sourceUnknown:unknown.length},
  levels:{support:event.low,invalidation:event.low,pressure:Math.max(event.high,priorHigh),source:`最近訊號日 ${event.date} 低點；與SMA20分開`},
  report:{...namedReport(report,base.name),canonicalBars:b,dailySeries:b},meaning:'多方均衡觀察版；原圖主力與JMA若未驗證，不宣稱原策略成立。風險規則不能消除末升段或假突破。'};
}
function compare(a,b){const order={CANDIDATE:0,WATCH:1,NO_CHASE:2,NO_SIGNAL:3,DATA:4,EXCLUDED:5};return (order[a.status]??9)-(order[b.status]??9)||(a.riskCodes?.length??99)-(b.riskCodes?.length??99)||(a.event?.kind==='OFFICIAL'?0:1)-(b.event?.kind==='OFFICIAL'?0:1)||(b.features?.localFit??-1)-(a.features?.localFit??-1)||(a.event?.age??99)-(b.event?.age??99)||Math.abs(a.features?.gap20Pct??999)-Math.abs(b.features?.gap20Pct??999)||(a.features?.baselineValueRank??a.features?.valueRank??99999)-(b.features?.baselineValueRank??b.features?.valueRank??99999)||a.code.localeCompare(b.code);}
function lines(c){const f=c.features,fmt=v=>number(v)===null?'資料不足':Number(v).toFixed(2);return [`🏆${displayName(c.code,c)}（${c.code}）｜${c.label}｜原圖核對：${({UNVERIFIED:'尚未完整核對',NOT_MATCH:'條件不完全符合',VERIFIED_MATCH:'六項輸入核對符合'})[c.sourceCheckState]||'資料不足'}`, ...c.reasons,...(c.nameFallback?['名稱索引尚無可核對的繁體中文名，暫以股票代號識別；不自行翻譯。']:[]),c.monthlyStatus==='PASS'?'月線明示通過':c.monthlyStatus==='NOT_PASS'?'月線條件未通過；本濾網僅列當沖量價觀察':'月線尚未驗證；日SMA20不替代月20MA資格',...(f?[`💰收盤 ${price(c.validation?.invalidation?.close)}｜SMA20 ${fmt(f.ma20)}｜乖離 ${fmt(f.gap20Pct)}%｜10日 ${fmt(f.return10Pct)}%`,`量／前5均量 ${fmt(f.volumeRatio5)}｜量／前20均量 ${fmt(f.volumeRatio20)}｜CMF20 ${fmt(f.cmf20)}`,...validationLines(c),`防守線 ${price(c.levels.invalidation)}｜壓力 ${price(c.levels.pressure)}｜${c.levels.source}`,`下一交易日：收盤維持訊號日低點上方、觀察能否站穩壓力；盤中進場與跳空尚未確認。`]:[]),...(c.checks||[]).map(x=>`${x.pass===null?'未驗證':x.pass?'符合':'不符合'}｜${x.label}｜${x.note}`),...c.warnings,...(c.priceAction?[PA.describe(c.priceAction)]:[]),'風險排序不是上漲機率；收盤鎖漲停不代表隔日買得到。'];}
return Object.freeze({MODEL,REVISION,fingerprint:I.fingerprint,RULE,LABELS,number,price,comparePrice,closeLocation,levelLine,validationLines,tick,estimatedUpper,windowSize,limitAt,evaluate,compare,lines,setNameDirectory,nameInfo,displayName});
});
