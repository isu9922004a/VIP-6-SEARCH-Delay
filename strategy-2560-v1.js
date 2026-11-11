/* Only filter ⑤. The other five engines and the old restaurant implementation remain intact. */
(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./kline-attack-v90.js'):r.ShitouKlineAttack,N?require('./restaurant-filter-v1.js'):r.ShitouRestaurantCore,N?require('./research-common-v1.js'):r.ShitouResearchCommon,N?require('./strategy-2560-config-v90.js'):r.ShitouFifthStrategyConfig);if(N)module.exports=a;else r.ShitouStrategy2560=a;})(globalThis,function(K,Old,U,Config){
'use strict';
const MODEL=Config.strategyVersion,REVISION=MODEL,RULE=Object.freeze({version:MODEL,minBars:41,averages:[5,25,40],method:'SMA_PRICE',freshCrossOnly:true,ranking:Config.ranking,universe:'LEGACY_FIFTH_COMMON_STOCKS_EX_FINANCIAL_ETF',exit:'CLOSE_LT_MA5',exitAffectsEntry:false});
const LABELS=Object.freeze({NEW_CROSS:'今天新交叉，條件通過',AFTER_CROSS_OBSERVE:'交叉後觀察，今天不是新訊號',TREND_MISMATCH:'兩條均線還沒一起向上',NOT_MATCH:'今天沒有新交叉',EXCLUDED:'不在本策略範圍',DATA:'資料不足'});
const CHECK_KEYS=['CROSS','MA5_UP','MA25_UP'];
function universe(code,q={},sector={}){if(!Old.ordinary(String(code),q))return {ok:false,state:'EXCLUDED',reason:'本策略只看上市櫃普通股，ETF及其他商品不套用'};
 const industry=String(sector.industryName||sector.industry||q.industryName||q.industry||''),ic=String(sector.industryCode||q.industryCode||'').padStart(2,'0');
 if(ic==='17'||/金融|銀行|保險|證券|金控/.test(industry))return {ok:false,state:'EXCLUDED',reason:'2560戰法排除金融股'};
 if(!industry&&(ic==='00'||!ic))return {ok:false,state:'DATA',reason:'缺少官方產業分類，暫時不能確認是否為金融股'};
 return {ok:true,industry,industryCode:ic,classificationSource:sector.source||q.industrySource||'既有官方產業對照表'};
}
function evaluate(report,options={}){
 const code=String(report?.stock||report?.code||''),date=options.asOf||report?.marketDate||report?.closeDate||report?.dataDate,naming=Old.nameInfo(code,report),base={model:MODEL,revision:REVISION,code,name:naming.name,nameSource:naming.source,nameFallback:naming.fallback,date,rule:RULE,eligible:false,score:null,sourceMatch:false,reasons:[],warnings:[],riskCodes:[],checks:[],exitWarning:null};
 const missing=reason=>K.freeze({...base,status:'DATA',label:LABELS.DATA,reasons:[reason],sourceMatch:null});
 const q=options.quote;if(!q)return missing('缺少同一天的市場快照');
 const u=universe(code,q,options.sector);if(!u.ok)return u.state==='DATA'?missing(u.reason):K.freeze({...base,status:'EXCLUDED',label:LABELS.EXCLUDED,reasons:[u.reason],universe:u});
 const v=K.validate(report,{asOf:date,code:options.code||code,minBars:RULE.minBars,type:'stock',quote:q});if(!v.ok)return missing(v.reason);
 const ma=n=>({today:U.ma(v.bars,n),previous:U.ma(v.bars,n,v.bars.length-2)}),features={ma5:ma(5),ma25:ma(25),ma40:ma(40),close:v.bars.at(-1).close};
 const cross=features.ma5.previous<=features.ma40.previous&&features.ma5.today>features.ma40.today,up5=features.ma5.today>features.ma5.previous,up25=features.ma25.today>features.ma25.previous;
 const eligible=cross&&up5&&up25,status=eligible?'NEW_CROSS':!up5||!up25?'TREND_MISMATCH':features.ma5.today>features.ma40.today?'AFTER_CROSS_OBSERVE':'NOT_MATCH';
 const checks=[{key:'CROSS',pass:cross,label:'今天MA5剛從MA40下方或相等處穿到上方'},{key:'MA5_UP',pass:up5,label:'MA5比前一交易日高'},{key:'MA25_UP',pass:up25,label:'MA25比前一交易日高'}],exitWarning=features.close<features.ma5.today,canonicalBars=JSON.parse(JSON.stringify(v.bars)),source={...JSON.parse(JSON.stringify(report)),canonicalBars,dailySeries:canonicalBars},kline=K.evaluate(source,{asOf:v.asOf,code,type:'stock'});
 const validation={revision:REVISION,code,date:v.asOf,market:report.market,historyFingerprint:v.historyFingerprint,checksFingerprint:Old.fingerprint(checks),quote:JSON.parse(JSON.stringify(q)),basis:v.basis,volumeUnit:v.volumeUnit,sourceFingerprint:report.observationBasis?.fingerprint||report.dailyBasisV2?.fingerprint||null};validation.id=Old.fingerprint(validation);
 return K.freeze({...base,date:v.asOf,status,label:LABELS[status],eligible,sourceMatch:eligible,sourceCheckState:'VERIFIED',universe:u,features,checks,exitWarning,exitLabel:exitWarning?'收盤跌破MA5出場警示：已有持股者核對原計畫，未假設已成交':'收盤未低於MA5；不代表沒有其他風險',report:source,kline,validation,indicator:{calendarVerified:true,basisVerified:true},reasons:checks.filter(c=>!c.pass).map(c=>c.label+'：尚未符合')});
}
function qualifies(c){return c?.model===MODEL&&c.eligible===true&&c.status==='NEW_CROSS'&&c.checks?.length===3&&CHECK_KEYS.every(k=>c.checks.filter(c=>c.key===k&&c.pass===true).length===1);}
function lines(c){const f=c.features,p=K.fmt;return [`🌟2560戰法｜${c.name}（${c.code}）｜${c.date}`,c.label,...(f?[`MA5 ${p(f.ma5.today)}元／前日 ${p(f.ma5.previous)}元：${f.ma5.today>f.ma5.previous?'向上':f.ma5.today<f.ma5.previous?'下彎':'持平'}。`,`MA25 ${p(f.ma25.today)}元／前日 ${p(f.ma25.previous)}元：${f.ma25.today>f.ma25.previous?'向上':f.ma25.today<f.ma25.previous?'下彎':'持平'}。`,`MA40 ${p(f.ma40.today)}元／前日 ${p(f.ma40.previous)}元。`,...c.checks.map(x=>(x.pass?'通過：':'未通過：')+x.label),c.exitLabel]:c.reasons),...(c.kline?.lines||[]),'盤後確認，沒有假設當日已成交。代號排序不是強弱排名。'];}
return Object.freeze({MODEL,REVISION,RULE,LABELS,CHECK_KEYS,evaluate,universe,qualifies,lines,compare:(a,b)=>a.code.localeCompare(b.code),fingerprint:Old.fingerprint,number:Old.number,nameInfo:Old.nameInfo,displayName:Old.displayName,setNameDirectory:Old.setNameDirectory,ordinary:Old.ordinary,price:Old.price,windowSize:()=>1});
});
