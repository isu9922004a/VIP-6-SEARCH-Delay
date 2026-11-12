/* Only the fifth filter is changed. Other five engines and archived restaurant source remain untouched. */
(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./kline-attack-v90.js'):r.ShitouKlineAttack,N?require('./restaurant-filter-v1.js'):r.ShitouRestaurantCore,N?require('./research-common-v1.js'):r.ShitouResearchCommon,N?require('./strategy-2560-config-v90.js'):r.ShitouFifthStrategyConfig);if(N)module.exports=a;else r.ShitouStrategy2560=a;})(globalThis,function(K,Old,U,Config){
'use strict';
const MODEL=Config.strategyVersion,REVISION=MODEL;
const RULE=Object.freeze({version:MODEL,minBars:60,averages:[5,25,40],volumeAverages:[5,60],method:'SMA_PRICE_AND_VOLUME',newCloseBreakout:true,volumeRule9012Complete:true,analysisSessionOffsets:[0,1],ranking:Config.ranking,universe:'LEGACY_FIFTH_COMMON_STOCKS_EX_FINANCIAL_ETF',exit:null,exitAffectsEntry:false});
const LABELS=Object.freeze({PASS:'三條核心條件通過',FAIL:'核心條件未全部符合',INSUFFICIENT_DATA:'必要歷史或盤後資料不足',DATA_ERROR:'行情或來源資料異常',EXCLUDED:'不在本策略範圍'});
const CHECK_KEYS=['9041','9012','533'];
function universe(code,q={},sector={}){if(!Old.ordinary(String(code),q))return {ok:false,state:'EXCLUDED',reason:'本策略只看上市櫃普通股，ETF及其他商品不套用'};
 const industry=String(sector.industryName||sector.industry||q.industryName||q.industry||''),ic=String(sector.industryCode||q.industryCode||'').padStart(2,'0');
 if(ic==='17'||/金融|銀行|保險|證券|金控/.test(industry))return {ok:false,state:'EXCLUDED',reason:'2560戰法排除金融股'};
 if(!industry&&(ic==='00'||!ic))return {ok:false,state:'INSUFFICIENT_DATA',reason:'缺少官方產業分類，暫時不能確認是否為金融股'};
 return {ok:true,industry,industryCode:ic,classificationSource:sector.source||q.industrySource||'既有官方產業對照表'};
}
function evaluate(report,options={}){
 const code=String(report?.stock||report?.code||''),date=options.asOf||report?.marketDate||report?.closeDate||report?.dataDate,naming=Old.nameInfo(code,report),sessionOffset=Number(options.sessionOffset||0);
 const base={model:MODEL,revision:REVISION,code,name:naming.name,nameSource:naming.source,nameFallback:naming.fallback,date,rule:RULE,eligible:false,score:null,sourceMatch:false,reasons:[],warnings:[],riskCodes:[],checks:[],sessionOffset,signalDate:null,exitWarning:null,exitLabel:'2560沒有指定出場或自動交易規則',volumeRuleComplete:true,volumeRuleNote:'#9012只使用VMA5>VMA60；三個無參數均量依使用者要求忽略'};
 const unavailable=(reason,status='INSUFFICIENT_DATA')=>K.freeze({...base,status,label:LABELS[status],reasons:[reason],sourceMatch:null});
 if(!Number.isInteger(sessionOffset)||sessionOffset<0||sessionOffset>1)return unavailable('訊號交易日參數無效','DATA_ERROR');const q=options.quote;if(!q)return unavailable('缺少同一天的市場快照');
 const u=universe(code,q,options.sector);if(!u.ok)return u.state==='EXCLUDED'?K.freeze({...base,status:'EXCLUDED',label:LABELS.EXCLUDED,reasons:[u.reason],universe:u}):unavailable(u.reason);
 const v=K.validate(report,{asOf:date,code:options.code||code,minBars:RULE.minBars+sessionOffset,type:'stock',quote:q});
 if(!v.ok)return unavailable(v.reason,/只有\d+根|至少\d+根|尚未確認收盤|缺少|不足|還沒核對/.test(v.reason)?'INSUFFICIENT_DATA':'DATA_ERROR');
 const allBars=v.bars,bars=allBars.slice(0,allBars.length-sessionOffset),at=bars.length-1,last=bars[at],prev=bars[at-1],ma=n=>({today:U.ma(bars,n),previous:U.ma(bars,n,at-1)});
 const ma5=ma(5),ma25=ma(25),ma40=ma(40),vma=n=>bars.slice(-n).reduce((s,b)=>s+b.volume,0)/n,vma5=vma(5),vma60=vma(60);
 const prices=[ma5.today,ma5.previous,ma25.today,ma25.previous,ma40.today,ma40.previous,last.close,prev.close];
 if(!prices.every(x=>Number.isFinite(x)&&x>0)||![vma5,vma60,last.volume].every(x=>Number.isFinite(x)&&x>0))return unavailable('均線、收盤價或成交量無法計算','DATA_ERROR');
 const rule9041=prev.close<=ma25.previous&&last.close>ma25.today,volumeRule9012=vma5>vma60,rule533=ma5.today>ma40.today;
 const checks=[{key:'9041',pass:rule9041,label:'#9041 '+(sessionOffset?'前一完成交易日':'最新完成交易日')+'收盤新突破MA25（前一日未站上）'},{key:'9012',pass:volumeRule9012,label:'#9012 VMA5 > VMA60（忽略無參數均量）'},{key:'533',pass:rule533,label:'#533 MA5 > MA40（不要求今天才交叉）'}];
 const breakoutPct=(last.close-ma25.today)/ma25.today*100,deviationMA5=(last.close-ma5.today)/ma5.today*100,volumeRatio=vma5/vma60,latestVolumeRatio=last.volume/vma60;
 const highLow=last.high-last.low,upperShadowRatio=highLow>0?(last.high-Math.max(last.open,last.close))/highLow:null,bodyRatio=highLow>0?Math.abs(last.close-last.open)/highLow:null;
 const priorHigh=Math.max(...bars.slice(-21,-1).map(b=>b.high)),nearPriorHigh=priorHigh>0&&last.close>=priorHigh*0.97,unusualVolume=latestVolumeRatio>=2;
 const warnings=[base.volumeRuleNote];if(deviationMA5>6)warnings.push('MA5乖離大於6%：高乖離，留意追高');else if(deviationMA5>3)warnings.push('MA5乖離3%～6%：留意追價');else if(deviationMA5>=0)warnings.push('MA5乖離0%～3%：初步觀察區（非勝率保證）');else warnings.push('收盤低於MA5：僅觀察，不是強制出場');
 if(upperShadowRatio!==null&&upperShadowRatio>=0.4)warnings.push('上影線占K棒振幅至少40%：留意收盤賣壓');
 if(unusualVolume)warnings.push('最新日成交量至少是VMA60的2倍：異常放量觀察（非入選條件）');
 if(nearPriorHigh)warnings.push('接近前20根完成日K高點：留意壓力與追價');
 const supportObservation=[ma5.today,ma25.today].filter(x=>x<=last.close).sort((a,b)=>b-a);
 const features={ma5,ma25,ma40,close:last.close,closePrev:prev.close,vma5,vma60,latestVolume:last.volume,breakoutPct,deviationMA5,volumeRatio};
 const risk={upperShadowRatio,bodyRatio,priorHigh,nearPriorHigh,unusualVolume,latestVolumeRatio,supportObservation,warningBasis:'乖離3%／6%、影線40%、單日量2倍、前高3%均為提示門檻，尚未回測；均線不是保證成交或停損價格'};
 const eligible=checks.every(c=>c.pass),status=eligible?'PASS':'FAIL',canonicalBars=JSON.parse(JSON.stringify(allBars)),source={...JSON.parse(JSON.stringify(report)),canonicalBars,dailySeries:canonicalBars},kline=K.evaluate(source,{asOf:v.asOf,code,type:'stock'});
 const validation={revision:REVISION,code,date:v.asOf,signalDate:last.date,sessionOffset,market:report.market,historyFingerprint:v.historyFingerprint,checksFingerprint:Old.fingerprint(checks),quote:JSON.parse(JSON.stringify(q)),basis:v.basis,volumeUnit:v.volumeUnit,sourceFingerprint:report.observationBasis?.fingerprint||report.dailyBasisV2?.fingerprint||null};validation.id=Old.fingerprint(validation);
 return K.freeze({...base,date:v.asOf,signalDate:last.date,status,label:LABELS[status],eligible,sourceMatch:eligible,sourceCheckState:'VERIFIED',universe:u,features,checks,warnings,risk,riskCodes:warnings.slice(1),report:source,kline,validation,indicator:{calendarVerified:true,basisVerified:true},reasons:checks.filter(c=>!c.pass).map(c=>c.label+'：尚未符合')});
}
function qualifies(c){return c?.model===MODEL&&c.revision===REVISION&&c.eligible===true&&c.status==='PASS'&&c.checks?.length===3&&CHECK_KEYS.every(k=>c.checks.filter(x=>x.key===k&&x.pass===true).length===1);}
function lines(c){const f=c.features,p=K.fmt;return ['🌟2560戰法｜25日均線突破｜'+c.name+'（'+c.code+'）｜'+c.date+'｜訊號日 '+(c.signalDate||c.date)+(c.sessionOffset?'（前一完成交易日對照，非今日新訊號）':''),c.label,...(f?[
 '訊號日收盤 '+p(f.close)+'元；訊號前一交易日收盤 '+p(f.closePrev)+'元',
 'MA5 '+p(f.ma5.today)+'／MA25 '+p(f.ma25.today)+'／MA40 '+p(f.ma40.today)+'元',
 ...c.checks.map(x=>(x.pass?'通過：':'未通過：')+x.label),
 'MA25突破幅度 '+p(f.breakoutPct)+'%（非隔日預測獲利）',
 'VMA5 '+p(f.vma5)+'股／VMA60 '+p(f.vma60)+'股；擴張比 '+p(f.volumeRatio)+'倍；當日量 '+p(f.latestVolume)+'股',
 'MA5乖離 '+p(f.deviationMA5)+'%；突破K棒上影比例 '+(c.risk?.upperShadowRatio===null?'無法計算':p(c.risk.upperShadowRatio*100)+'%')+'；實體比例 '+(c.risk?.bodyRatio===null?'無法計算':p(c.risk.bodyRatio*100)+'%'),
 '前20日高 '+p(c.risk.priorHigh)+'元；均線支撐觀察 '+(c.risk.supportObservation.map(x=>p(x)+'元').join('、')||'目前無下方觀察均線'),
 ...c.warnings,
 '結果：'+c.status+'；#9012僅採用5日均量>60日均量，無自動出場設定'
 ]:c.reasons),...(c.sessionOffset?['以下K線研究以最新完成交易日為基準，與前一日2560入選訊號不同日。']:[]),...(c.kline?.lines||[]),'盤後完成日K；風險提醒不改入選資格；代號排序不是強弱或勝率排名。'];}
return Object.freeze({MODEL,REVISION,RULE,LABELS,CHECK_KEYS,evaluate,universe,qualifies,lines,compare:(a,b)=>a.code.localeCompare(b.code),fingerprint:Old.fingerprint,number:Old.number,nameInfo:Old.nameInfo,displayName:Old.displayName,setNameDirectory:Old.setNameDirectory,ordinary:Old.ordinary,price:Old.price,windowSize:()=>1});
});
