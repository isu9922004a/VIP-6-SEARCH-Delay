/* 2560 V9.1: fifth strategy only; retain unrelated engines unchanged. */
(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./kline-attack-v90.js'):r.ShitouKlineAttack,N?require('./restaurant-filter-v1.js'):r.ShitouRestaurantCore,N?require('./research-common-v1.js'):r.ShitouResearchCommon,N?require('./strategy-2560-config-v90.js'):r.ShitouFifthStrategyConfig);if(N)module.exports=a;else r.ShitouStrategy2560=a;})(globalThis,function(K,Old,U,Config){
'use strict';
const MODEL=Config.strategyVersion,REVISION=MODEL;
const RULE=Object.freeze({version:MODEL,minBars:60,priceAverages:[5,25,40],volumeAverages:[5,60],method:'SMA_CLOSE_VOLUME',breakout:'CLOSE_PREV_LE_MA25_PREV_AND_CLOSE_GT_MA25',volume:'VMA5_GT_VMA60',trend:'MA5_GT_MA40',volumeEvidence:'PARTIAL_VERIFIED_VMA5_GT_VMA60',ranking:Config.ranking,universe:'LEGACY_FIFTH_COMMON_STOCKS_EX_FINANCIAL_ETF',exit:'NOT_SPECIFIED',exitAffectsEntry:false});
const LABELS=Object.freeze({PASS:'三項核心條件通過（#9012部分還原）',FAIL:'至少一項核心條件未通過',INSUFFICIENT_DATA:'必要歷史資料不足',DATA_ERROR:'資料驗證異常',EXCLUDED:'不在本策略母體'});
const CHECK_KEYS=['9041','9012','533'];
function universe(code,q={},sector={}){if(!Old.ordinary(String(code),q))return {ok:false,state:'EXCLUDED',reason:'本策略只看上市櫃普通股，ETF及其他商品不套用'};
 const industry=String(sector.industryName||sector.industry||q.industryName||q.industry||''),ic=String(sector.industryCode||q.industryCode||'').padStart(2,'0');
 if(ic==='17'||/金融|銀行|保險|證券|金控/.test(industry))return {ok:false,state:'EXCLUDED',reason:'2560戰法排除金融股'};
 if(!industry&&(ic==='00'||!ic))return {ok:false,state:'DATA',reason:'缺少官方產業分類，暫時不能確認是否為金融股'};
 return {ok:true,industry,industryCode:ic,classificationSource:sector.source||q.industrySource||'既有官方產業對照表'};
}
function dataState(reason){return /只有\d+根|需要至少60根|缺少同一天|缺少.*資料|缺少.*日曆|尚未確認收盤|歷史.*不足|尚未取得/.test(String(reason))?'INSUFFICIENT_DATA':'DATA_ERROR';}
function evaluate(report,options={}){
 const code=String(report?.stock||report?.code||''),date=options.asOf||report?.marketDate||report?.closeDate||report?.dataDate,naming=Old.nameInfo(code,report);
 const base={model:MODEL,revision:REVISION,code,name:naming.name,nameSource:naming.source,nameFallback:naming.fallback,date,rule:RULE,eligible:false,score:null,sourceMatch:false,sourceCheckState:'UNVERIFIED',reasons:[],warnings:[],riskCodes:[],checks:[],exitWarning:null,exitLabel:'2560尚未指定出場策略；風險觀察不構成自動停損或賣出'};
 const missing=(reason,status=dataState(reason))=>K.freeze({...base,status,label:LABELS[status],reasons:[reason],sourceMatch:null});
 const q=options.quote;if(!q)return missing('缺少同一天的市場快照','INSUFFICIENT_DATA');
 const u=universe(code,q,options.sector);if(!u.ok)return u.state==='DATA'?missing(u.reason,'INSUFFICIENT_DATA'):K.freeze({...base,status:'EXCLUDED',label:LABELS.EXCLUDED,reasons:[u.reason],universe:u});
 const v=K.validate(report,{asOf:date,code:options.code||code,minBars:RULE.minBars,type:'stock',quote:q});
 if(!v.ok)return missing(v.reason);
 const bars=v.bars,last=bars.at(-1),prev=bars.at(-2);
 const ma=n=>({today:U.ma(bars,n),previous:U.ma(bars,n,bars.length-2)});
 const volumeMean=n=>bars.slice(-n).reduce((sum,b)=>sum+b.volume,0)/n;
 const ma5=ma(5),ma25=ma(25),ma40=ma(40),vma5=volumeMean(5),vma60=volumeMean(60);
 if([ma5.today,ma25.today,ma40.today,ma25.previous,vma5,vma60].some(x=>!Number.isFinite(x)||x<=0))return missing('移動平均數值無效，資料異常','DATA_ERROR');
 const rule9041=prev.close<=ma25.previous&&last.close>ma25.today,rule9012=vma5>vma60,rule533=ma5.today>ma40.today;
 const checks=[
  {key:'9041',code:'#9041',pass:rule9041,label:'昨日收盤≤昨日MA25，今日收盤>今日MA25（只算今日新突破）'},
  {key:'9012',code:'#9012',pass:rule9012,label:'VMA5>VMA60；原規則其他週期未確認',completeness:'PARTIAL_VERIFIED'},
  {key:'533',code:'#533',pass:rule533,label:'今日MA5>今日MA40（不要求今日剛黃金交叉）'}
 ];
 const eligible=checks.every(x=>x.pass),status=eligible?'PASS':'FAIL';
 const breakoutPct=(last.close-ma25.today)/ma25.today*100,deviationMA5=(last.close-ma5.today)/ma5.today*100,volumeRatio=vma5/vma60;
 const range=last.high-last.low,bodyShare=range?Math.abs(last.close-last.open)/range:null,upperShadowShare=range?(last.high-Math.max(last.open,last.close))/range:null;
 const previousHigh20=Math.max(...bars.slice(-21,-1).map(b=>b.high)),nearPreviousHighPct=(last.close-previousHigh20)/previousHigh20*100;
 const volumeVsPrevious=last.volume/prev.volume,volumeAnomaly=last.volume>=vma5*3;
 const chaseRisk=deviationMA5>6?'HIGH':deviationMA5>3?'CAUTION':'OBSERVE';
 const warnings=[];
 if(deviationMA5>6)warnings.push('MA5乖離>6%：高乖離，不宜把突破幅度當隔日報酬');
 else if(deviationMA5>3)warnings.push('MA5乖離3%～6%：留意追價');
 else if(deviationMA5<0)warnings.push('收盤低於MA5：僅列價格位置，不是出場指令');
 if(upperShadowShare!==null&&upperShadowShare>=.4)warnings.push('上影線佔當日振幅至少40%，留意沖高回落');
 if(bodyShare!==null&&bodyShare<.25)warnings.push('K棒實體小於當日振幅25%，突破動能尚待觀察');
 if(volumeAnomaly)warnings.push('今日成交量≥VMA5三倍（包含今日）：異常放量觀察門檻，未經回測');
 if(Math.abs(nearPreviousHighPct)<=3)warnings.push('收盤距前20根最高價不超過3%，留意前高壓力／突破確認');
 warnings.push('#9012僅確認VMA5>VMA60，其餘原始均量條件未還原；通過不代表完全符合截圖');
 const features={ma5,ma25,ma40,close:last.close,previousClose:prev.close,volumeToday:last.volume,vma5,vma60,volumeRatio,volumeVsPrevious,volumeAnomaly,breakoutPct,deviationMA5,bodyShare,upperShadowShare,previousHigh20,nearPreviousHighPct};
 const risk={level:chaseRisk,warnings,breakoutCandle:{closedAboveMA25:last.close>ma25.today,bodyShare,upperShadowShare,volumeVsPrevious,previousHigh20,nearPreviousHighPct},supportObservation:{ma5:ma5.today,ma25:ma25.today,guaranteed:false},volumeRuleCompleteness:'PARTIAL_VERIFIED'};
 const canonicalBars=JSON.parse(JSON.stringify(bars)),source={...JSON.parse(JSON.stringify(report)),canonicalBars,dailySeries:canonicalBars},kline=K.evaluate(source,{asOf:v.asOf,code,type:'stock'});
 const validation={revision:REVISION,code,date:v.asOf,market:report.market,historyFingerprint:v.historyFingerprint,checksFingerprint:Old.fingerprint(checks),quote:JSON.parse(JSON.stringify(q)),basis:v.basis,volumeUnit:v.volumeUnit,sourceFingerprint:report.observationBasis?.fingerprint||report.dailyBasisV2?.fingerprint||null};validation.id=Old.fingerprint(validation);
 return K.freeze({...base,date:v.asOf,status,label:LABELS[status],eligible,sourceMatch:eligible,sourceCheckState:'VERIFIED',universe:u,features,risk,checks,warnings,report:source,kline,validation,indicator:{calendarVerified:true,basisVerified:true},reasons:checks.filter(c=>!c.pass).map(c=>c.code+' 未通過：'+c.label)});
}
function qualifies(c){return c?.model===MODEL&&c.eligible===true&&c.status==='PASS'&&c.checks?.length===3&&CHECK_KEYS.every(k=>c.checks.filter(x=>x.key===k&&x.pass===true).length===1);}
function lines(c){
 const f=c.features,p=K.fmt;if(!f)return ['2560戰法｜'+(c.name||c.code)+'（'+c.code+'）｜'+(c.date||'日期待核對'),c.label,...(c.reasons||[])];
 const fixed=x=>Number.isFinite(x)?x.toFixed(2):'資料不足';
 return [
  '2560戰法｜25日均線突破｜'+c.name+'（'+c.code+'）｜'+c.date,
  '最終選股：'+c.status+'｜'+c.label+'｜三條核心皆須通過',
  '收盤 '+p(f.close)+'元｜昨收 '+p(f.previousClose)+'元',
  'MA5 '+p(f.ma5.today)+'｜MA25 '+p(f.ma25.today)+'｜MA40 '+p(f.ma40.today)+' 元',
  '昨日MA25 '+p(f.ma25.previous)+'元｜今日突破幅度 '+fixed(f.breakoutPct)+'%（非預期獲利）',
  ...c.checks.map(x=>(x.pass?'✓ 通過 ':'✗ 未通過 ')+x.code+' '+x.label),
  '#9012量能規則部分還原，待確認；不可宣稱原始截圖完全一致',
  'VMA5 '+fixed(f.vma5)+' 股｜VMA60 '+fixed(f.vma60)+' 股｜量能擴張 '+fixed(f.volumeRatio)+'倍',
  '今日成交量 '+fixed(f.volumeToday)+' 股｜較昨日 '+fixed(f.volumeVsPrevious)+'倍'+(f.volumeAnomaly?'｜異常放量提示':''),
  'MA5乖離 '+fixed(f.deviationMA5)+'%｜追價風險：'+c.risk.level,
  '突破K棒：實體佔振幅 '+fixed(f.bodyShare===null?null:f.bodyShare*100)+'%｜上影線佔振幅 '+fixed(f.upperShadowShare===null?null:f.upperShadowShare*100)+'%',
  '前20根最高 '+p(f.previousHigh20)+'元｜收盤相對前高 '+fixed(f.nearPreviousHighPct)+'%',
  '潛在支撐觀察：MA5 '+p(f.ma5.today)+'元、MA25 '+p(f.ma25.today)+'元；非保證停損成交價',
  ...c.risk.warnings.map(x=>'風險觀察：'+x),
  c.exitLabel,
  ...(c.kline?.lines||[]),
  '盤後確認，未使用未完成K棒；代號排序非強弱排名。'
 ];
}
return Object.freeze({MODEL,REVISION,RULE,LABELS,CHECK_KEYS,evaluate,universe,qualifies,lines,compare:(a,b)=>a.code.localeCompare(b.code),fingerprint:Old.fingerprint,number:Old.number,nameInfo:Old.nameInfo,displayName:Old.displayName,setNameDirectory:Old.setNameDirectory,ordinary:Old.ordinary,price:Old.price,windowSize:()=>1});
});
