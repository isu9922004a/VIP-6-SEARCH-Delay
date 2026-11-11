/* V9.1: completed MA25 breakout, 5/60 volume expansion, MA5 above MA40. */
(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./kline-attack-v90.js'):r.ShitouKlineAttack,N?require('./restaurant-filter-v1.js'):r.ShitouRestaurantCore,N?require('./research-common-v1.js'):r.ShitouResearchCommon,N?require('./strategy-2560-config-v90.js'):r.ShitouFifthStrategyConfig);if(N)module.exports=a;else r.ShitouStrategy2560=a;})(globalThis,function(K,Old,U,Config){
'use strict';
const MODEL=Config.strategyVersion,REVISION=MODEL;
const RULE=Object.freeze({version:MODEL,minBars:60,averages:[5,25,40],volumeAverages:[5,60],method:'SMA_CLOSE_AND_VOLUME',freshMA25BreakoutOnly:true,ranking:Config.ranking,universe:'LEGACY_FIFTH_COMMON_STOCKS_EX_FINANCIAL_ETF',exit:'UNSPECIFIED',exitAffectsEntry:false,volume9012Partial:true});
const LABELS=Object.freeze({PASS:'三項必要條件全部通過',FAIL:'至少一項必要條件未通過',INSUFFICIENT_DATA:'必要歷史資料不足',DATA_ERROR:'資料或收盤口徑異常',EXCLUDED:'不在本策略範圍'});
const CHECK_KEYS=['9041','9012','533'];
function universe(code,q={},sector={}){
 if(!Old.ordinary(String(code),q))return {ok:false,state:'EXCLUDED',reason:'本策略只看上市櫃普通股，ETF及其他商品不套用'};
 const industry=String(sector.industryName||sector.industry||q.industryName||q.industry||''),ic=String(sector.industryCode||q.industryCode||'').padStart(2,'0');
 if(ic==='17'||/金融|銀行|保險|證券|金控/.test(industry))return {ok:false,state:'EXCLUDED',reason:'2560戰法排除金融股'};
 if(!industry&&(ic==='00'||!ic))return {ok:false,state:'DATA_ERROR',reason:'缺少官方產業分類，無法核對股票母體'};
 return {ok:true,industry,industryCode:ic,classificationSource:sector.source||q.industrySource||'既有官方產業對照表'};
}
function evaluate(report,options={}){
 const code=String(report?.stock||report?.code||''),date=options.asOf||report?.marketDate||report?.closeDate||report?.dataDate,naming=Old.nameInfo(code,report);
 const base={model:MODEL,revision:REVISION,code,name:naming.name,nameSource:naming.source,nameFallback:naming.fallback,date,rule:RULE,eligible:false,score:null,sourceMatch:false,reasons:[],warnings:[],riskCodes:[],checks:[],exitWarning:null,exitLabel:'2560尚未指定專屬出場規則，不產生自動買賣指令',volumeRuleCompleteness:'PARTIAL_VERIFIED_VMA5_GT_VMA60',volumeRuleNote:'#9012量能規則部分還原，待確認'};
 const invalid=(reason,status='DATA_ERROR')=>K.freeze({...base,status,label:LABELS[status],sourceMatch:null,reasons:[reason]});
 const q=options.quote;if(!q)return invalid('缺少同一天的市場快照');
 const u=universe(code,q,options.sector);if(!u.ok)return u.state==='EXCLUDED'?K.freeze({...base,status:'EXCLUDED',label:LABELS.EXCLUDED,universe:u,reasons:[u.reason]}):invalid(u.reason);
 const v=K.validate(report,{asOf:date,code:options.code||code,minBars:RULE.minBars,type:'stock',quote:q});
 if(!v.ok)return invalid(v.reason,/完成日K只有.*根|需要至少.*根/.test(v.reason)?'INSUFFICIENT_DATA':'DATA_ERROR');
 const ma=n=>({today:U.ma(v.bars,n),previous:U.ma(v.bars,n,v.bars.length-2)}),ma5=ma(5),ma25=ma(25),ma40=ma(40);
 const last=v.bars.at(-1),prev=v.bars.at(-2),closeToday=last.close,closePrev=prev.close;
 const vma=n=>v.bars.slice(-n).reduce((sum,b)=>sum+b.volume,0)/n,vma5=vma(5),vma60=vma(60);
 const values=[closeToday,closePrev,ma5.today,ma5.previous,ma25.today,ma25.previous,ma40.today,ma40.previous,vma5,vma60,last.volume];
 if(values.some(x=>!Number.isFinite(x)||x<=0))return invalid('必要價格、均線或成交量異常');
 const rule9041=closePrev<=ma25.previous&&closeToday>ma25.today,volumeRule9012=vma5>vma60,rule533=ma5.today>ma40.today;
 const checks=[{key:'9041',pass:rule9041,label:'#9041：昨日收盤≤昨日MA25，今日完成收盤>今日MA25'}, {key:'9012',pass:volumeRule9012,label:'#9012：VMA5>VMA60（部分還原，其他週期待確認）'}, {key:'533',pass:rule533,label:'#533：今日MA5>今日MA40，不要求今天剛黃金交叉'}];
 const eligible=rule9041&&volumeRule9012&&rule533,status=eligible?'PASS':'FAIL';
 const breakoutPct=(closeToday-ma25.today)/ma25.today*100,deviationMA5=(closeToday-ma5.today)/ma5.today*100,deviationMA25=breakoutPct,volumeRatio=vma5/vma60;
 const candleRange=last.high-last.low,upperShadow=Math.max(0,last.high-Math.max(last.open,last.close)),body=Math.abs(last.close-last.open);
 const upperShadowPct=candleRange>0?upperShadow/candleRange*100:null,bodyPct=candleRange>0?body/candleRange*100:null;
 const previous20=v.bars.slice(-21,-1),previousHigh=Math.max(...previous20.map(b=>b.high)),distanceToPreviousHighPct=(previousHigh-closeToday)/previousHigh*100;
 const abnormalVolume=last.volume>vma5*3,chaseLevel=deviationMA5>6?'高乖離警示':deviationMA5>3?'留意追價':deviationMA5>=0?'觀察區':'MA5下方，另查風險';
 const risk={chaseLevel,highDeviation:deviationMA5>6,abnormalVolume,abnormalVolumeBasis:'最新量>VMA5×3為暫行提醒，非驗證後門檻',upperShadowPct,bodyPct,nearPreviousHigh:Math.abs(distanceToPreviousHighPct)<=3,previous20High:previousHigh,distanceToPreviousHighPct,qualityNote:'收盤相對MA25、上影、實體、量能及前20日高點供判讀；未納入選股資格',supportObservation:'MA5／MA25是動態觀察價，不保證停損成交'};
 const features={ma5,ma25,ma40,close:closeToday,previousClose:closePrev,latestVolume:last.volume,vma5,vma60,breakoutPct,deviationMA5,deviationMA25,volumeRatio,volumeRule9012,rule9041,rule533,upperShadowPct,bodyPct,previous20High:previousHigh,distanceToPreviousHighPct};
 const canonicalBars=JSON.parse(JSON.stringify(v.bars)),source={...JSON.parse(JSON.stringify(report)),canonicalBars,dailySeries:canonicalBars},kline=K.evaluate(source,{asOf:v.asOf,code,type:'stock'});
 const validation={revision:REVISION,code,date:v.asOf,market:report.market,historyFingerprint:v.historyFingerprint,checksFingerprint:Old.fingerprint(checks),quote:JSON.parse(JSON.stringify(q)),basis:v.basis,volumeUnit:v.volumeUnit,sourceFingerprint:report.observationBasis?.fingerprint||report.dailyBasisV2?.fingerprint||null};validation.id=Old.fingerprint(validation);
 const warnings=[base.volumeRuleNote,...(risk.highDeviation?['MA5高乖離，留意追價']:[]),...(risk.abnormalVolume?['最新日成交量異常擴張']:[]),...(risk.nearPreviousHigh?['接近前20日高點，留意壓力']:[])];
 return K.freeze({...base,date:v.asOf,status,label:LABELS[status],eligible,sourceMatch:eligible,sourceCheckState:'VERIFIED_PARTIAL_9012',universe:u,features,checks,risk,warnings,riskCodes:[...(risk.highDeviation?['HIGH_MA5_DEVIATION']:[]),...(risk.abnormalVolume?['ABNORMAL_VOLUME']:[])],report:source,kline,validation,indicator:{calendarVerified:true,basisVerified:true},reasons:checks.filter(c=>!c.pass).map(c=>c.label+'：未符合')});
}
function qualifies(c){return c?.model===MODEL&&c.eligible===true&&c.status==='PASS'&&c.checks?.length===3&&CHECK_KEYS.every(k=>c.checks.filter(x=>x.key===k&&x.pass===true).length===1);}
function lines(c){
 const f=c.features,p=K.fmt;if(!f)return ['2560戰法｜25日均線突破',c.name+'（'+c.code+'）｜'+(c.date||'日期待確認'),c.label,...c.reasons];
 const fmt=x=>Number.isFinite(x)?x.toFixed(2):'未提供',pass=k=>c.checks.find(x=>x.key===k)?.pass?'通過':'未通過';
 return ['2560戰法｜25日均線突破｜'+c.name+'（'+c.code+'）','資料日期 '+c.date+'｜'+c.status+'｜'+c.label,'收盤 '+p(f.close)+'元｜前收 '+p(f.previousClose)+'元','MA5 '+p(f.ma5.today)+'元｜MA25 '+p(f.ma25.today)+'元｜MA40 '+p(f.ma40.today)+'元','#9041 '+pass('9041')+'：昨日收盤≤昨日MA25且今日收盤>今日MA25','#9012 '+pass('9012')+'：VMA5>VMA60（部分還原）','#533 '+pass('533')+'：MA5>MA40','MA25突破幅度 '+fmt(f.breakoutPct)+'%（不是隔日獲利預估）','VMA5 '+fmt(f.vma5)+'股｜VMA60 '+fmt(f.vma60)+'股','量能擴張比 '+fmt(f.volumeRatio)+'倍｜最新日量 '+fmt(f.latestVolume)+'股','MA5乖離率 '+fmt(f.deviationMA5)+'%｜距MA25 '+fmt(f.deviationMA25)+'%','突破K棒：上影 '+fmt(f.upperShadowPct)+'%｜實體 '+fmt(f.bodyPct)+'%','前20日高點 '+fmt(f.previous20High)+'元｜距前高 '+fmt(f.distanceToPreviousHighPct)+'%','追價風險：'+c.risk.chaseLevel+'；異常放量：'+(c.risk.abnormalVolume?'是':'否'),'突破品質：'+c.risk.qualityNote,'支撐觀察：'+c.risk.supportObservation,c.volumeRuleNote,'三項已確認規則皆通過才入選；風險提醒不改入選資格。'];
}
return Object.freeze({MODEL,REVISION,RULE,LABELS,CHECK_KEYS,evaluate,universe,qualifies,lines,compare:(a,b)=>a.code.localeCompare(b.code),fingerprint:Old.fingerprint,number:Old.number,nameInfo:Old.nameInfo,displayName:Old.displayName,setNameDirectory:Old.setNameDirectory,ordinary:Old.ordinary,price:Old.price,windowSize:()=>1});
});
