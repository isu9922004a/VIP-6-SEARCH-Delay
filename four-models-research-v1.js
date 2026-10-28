(function(r,f){const n=typeof module==='object'&&module.exports,a=f(n?require('./research-common-v1.js'):r.ShitouResearchCommon,n?require('./research-foundation-v1.js'):r.ShitouResearchFoundation,n?require('./indicator-multi-v1.js'):r.ShitouIndicatorMultiV1,n?require('./unified-analysis-v1.js'):r.ShitouUnifiedAnalysis);if(n)module.exports=a;else r.ShitouFourModels=a;})(globalThis,function(U,F,I,Unified){
'use strict';
const VERSION='CONTEXT.R17-BREAKOUT.1-PULLBACK.1-MOMENTUM.1-FLOW.1',RANK='PRECISION_RESEARCH_RANK_V1';
const {ma,mean,pct,check,status,PARAM:P}=U;
const FILTERS=Object.freeze({MAIN:['A','C','D'],DAYTRADE:['A','C'],STRONG:['A','B','C','D'],TOWER:['D'],RESTAURANT:['A','B'],STRUCTURE:['B']});
const rsiMomentumPass=value=>U.num(value)!==null&&value>65+1e-10&&value<85-1e-10;
// Official TWSE/TPEx short names may be Chinese, English or mixed (GIS-KY, 眾達-KY).
// Never infer the language from the stock code, and never use a long English
// corporation name in place of a verified market short name.
function resolveDisplayName(record,code){
 const clean=v=>String(v??'').trim().replace(/[\s　]+/g,' ');
 const id=clean(code),raw=clean(record?.name||record?.stockName||record?.companyName);
 const valid=n=>!!n&&n!==id&&!/[\uFFFD\u0000-\u001F\u007F]/.test(n)
  &&!new RegExp('^(?:股票|代號)\\s*'+id+'(?:\\s*[（(]名稱待核對[）)])?$').test(n)
  &&!/(?:名稱待核對|待核對名稱|unknown|undefined|null)/i.test(n)
  &&!/(?:\b(?:Inc\.?|Incorporated|Corporation|Corp\.?|Holdings|Holding|Limited|Ltd\.?|Company|Co\.?)\b)/i.test(n);
 const shortName=n=>valid(n)&&(/[\u3400-\u9fff]/.test(n)||/^[a-zA-Z0-9][a-zA-Z0-9&.+*\-]{1,27}$/.test(n));
 // Verified daily-market snapshot (same completed date) takes precedence.
 try{
  const snap=globalThis.ShitouSelectionDataV2?.getSnapshot?.();
  const date=record?.marketDate||record?.closeDate||record?.dataDate;
  if(snap?.date&&snap.date===date){const marketName=clean(snap.map?.get(id)?.name);if(shortName(marketName))return marketName;}
 }catch(_){}
 // Existing built-in Taiwan stock-name directory is keyed by ticker code.
 try{
  const fn=globalThis.momentumSafeStockNameV377712;
  if(typeof fn==='function'){
   const name=clean(fn({code:id,name:raw}));
   if(shortName(name))return name;
  }
 }catch(_){}
 // Only short names are acceptable as fallback; a corporate English full name
 // cannot be presumed to be the Taiwan exchange short name.
 if(shortName(raw))return raw;
 return id?`股票${id}（名稱待核對）`:'名稱待核對';
}
function compactStateLabel(state){
 return state==='BREAKOUT_LAUNCH'?'突破發動':state==='HEALTHY_PULLBACK'?'健康回踩':state==='MOMENTUM_CONTINUATION'?'強勢延續':state==='FLOW_CONFIRMATION'?'資金確認':state==='OVEREXTENDED'?'短線過熱':state==='BREAKOUT_FAILURE'?'結構失敗':state==='INSUFFICIENT_DATA'?'資料不足':state==='DISABLED'?'已關閉':'觀察中';
}
function model(id,checks,extra){return {id,checks,status:status(checks),...extra};}
function evaluate(r,options={}){r=structuredClone(U.normalizeInput(r));
 const flags=U.flags(options.flags),n=U.validate(r),validation=U.validationResult(r,n),code=String(r.stock||r.code||''),displayName=resolveDisplayName(r,String(r.stock||r.code||''));
 if(!n.ok)return U.freeze({quote:r.quoteEvidence?.verified?r.quoteEvidence:null,version:VERSION,code,name:displayName,date:r.marketDate||r.closeDate||r.dataDate,state:'INSUFFICIENT_DATA',compactStateLabel:'基礎資料待核驗',reason:n.reason,validation,models:{},families:{},risks:[],dataQuality:{complete:false,missing:[...new Set([...validation.missingFields,...(r.researchAcquisitionError?[r.researchAcquisitionError]:[])])]},originalB:U.num(r.originalB),originalInvalidation:U.num(r.originalInvalidation),researchOnly:true,flags});
 const b=n.bars,z=b.at(-1),p=b.at(-2),f=U.features(b),foundation=F.evaluate(r,{flags,features:f}),date=z.date;
 const unifiedResearch=Unified.evaluate(r,{flags:options.flags,parameters:options.parameters}),context=unifiedResearch.structureContext;
 if(!flags.fourModelsEnabled)return U.freeze({version:VERSION,code,name:displayName,date,state:'DISABLED',compactStateLabel:compactStateLabel('DISABLED'),validation,models:{},families:{},risks:[],foundation,flags,researchOnly:true});
 const weekly=U.weeks(b,r),volOld=b.length>=25?mean(b.slice(-25,-20).map(x=>x.volume)):null,volumeGrowth=volOld>0?f.volumeLatest5/volOld:null;
 const breakout=f.prior20High!==null&&z.close>f.prior20High,failed=f.prior20High!==null&&z.high>f.prior20High&&z.close<=f.prior20High;
 const previousBreak=b.length>=22&&p.close>Math.max(...b.slice(-22,-2).map(x=>x.high));
 const closePosition=f.candle.closeLocation,volumeRatio=f.volumePrior5>0?z.volume/f.volumePrior5:null,atrDistance=f.atr14>0&&f.prior20High!==null?(z.close-f.prior20High)/f.atr14:null;
 const risks=[];if(failed)risks.push('盤中越壓但收盤未站穩');if(f.candle.longUpper)risks.push('長上影');if(volumeRatio>=2&&p&&z.close<=p.close)risks.push('爆量滯漲');
 const hot=f.rsi14>=85||(f.ma[20].distance>P.maGapPct&&f.atr14>0&&(z.close-f.ma[20].value)/f.atr14>P.atrGap)||atrDistance>P.atrGap;
 if(hot)risks.push('追高警戒');if(f.ma[5].distance>5)risks.push('MA5乖離偏高');
 const A=model('BREAKOUT_ACCELERATION_V1',[
  check('A1',f.ma[60].value===null?null:f.ma[20].value>f.ma[60].value),check('A2',weekly.value===null?null:z.close>weekly.value,weekly.reason||'收盤比較正式已完成20週MA'),check('A3',f.return5===null?null:f.return5>=P.breakoutReturnMin&&f.return5<=P.breakoutReturnMax,'close[t]/close[t-5]-1；5%與15%含邊界'),check('A4',volumeGrowth===null?null:volumeGrowth>=P.volumeGrowth,'t-4..t 對 t-24..t-20'),check('A5',f.volumeChangeLots===null?null:f.volumeChangeLots>=P.volumeDeltaLots,'(volume[t]-volume[t-1])/1000；研究口徑，原圖量定義待查'),check('A6',f.prior20High===null?null:breakout,'前20根high，排除當日')
 ],{label:failed?'盤中越壓待確認':hot&&breakout?'過熱突破':breakout?(previousBreak?'延續突破':'初次突破'):'突破待確認',weeklyMA20:weekly.value,weeklyBars:weekly.bars,volumeGrowth,optionalPriceRange:z.close>=30&&z.close<=2000,sourceDefinitionVerified:false,breakoutQuality:context?.breakout||null});
 const ordered=f.ma[60].value===null?null:[5,10,20].every((n,i)=>f.ma[n].value>f.ma[[10,20,60][i]].value),black=b.length>=3?b.slice(-3,-1).some(x=>x.close<x.open*.97-1e-10):null;
 const supports=[5,10,20].map(n=>({period:n,value:ma(b,n,b.length-2)})).filter(x=>x.value!==null),touched=supports.filter(x=>p&&p.low<=x.value&&p.high>=x.value),held=touched.filter(x=>p.close>=x.value&&z.low>=x.value&&z.close>=x.value),reclaim=p?z.close>p.high:null;
 const up=f.ma[60].slope===null?null:f.ma[20].slope>0&&f.ma[60].slope>0,contract=b.length>=7?b.slice(-3,-1).every(x=>x.volume<f.volumePrior5):null,improve=p?z.volume>p.volume&&z.close>p.close:null;
 const supportBroken=context?.pullback?.status==='INVALIDATED';
 if(supportBroken)risks.push('已建立的回踩情境收盤失效');
 const B=model('BULL_PULLBACK_RECLAIM_V1',[
  check('B1',ordered),check('B2',up,'(MA[t]/MA[t-3]-1)*100'),check('B3',black,'前兩根任一：(close/open-1)*100 < -3'),check('B4',f.red,'close > open'),check('B5',f.volumePrior5===null?null:f.volumePrior5/1000>1000,'t-5..t-1，張'),check('B6',supports.length?held.length>0:null,'前日觸及前日MA；前日收盤、今日低點與收盤皆守住'),check('B7',contract===null?null:contract&&improve),check('B8',reclaim),check('B9',null,'UNVERIFIED：衝刺指標無正式公式')
 ],{label:f.ma[60].value!==null&&z.close<f.ma[60].value?'多頭趨勢已破壞':supportBroken?'回檔失效':held.length&&reclaim?'回踩支撐已確認':held.length?'候選支撐待再攻確認':f.red?'反彈未突破':'回踩待確認',supportLines:held,supportStatus:supportBroken?'INVALIDATED':held.length&&reclaim?'CONFIRMED':'PENDING_CONFIRMATION',pullbackContext:context?.pullback||null,sprintStatus:'UNVERIFIED',crossDiagnosis:{threeDay:foundation.threeDayStructure?.state||'DISABLED',granville:foundation.granvilleContext?.signals.filter(x=>['G2','G3'].includes(x.code))||[]}});
 const red3=b.length>=3?b.slice(-3).every(x=>x.close>x.open):null;
 const breaks3=b.length>=23?[b.length-3,b.length-2,b.length-1].every(i=>b[i].close>Math.max(...b.slice(i-20,i).map(x=>x.high))):null;
 let upDays=0;for(let i=b.length-1;i>0&&b[i].close>b[i-1].close;i--)upDays++;
 const divergence=volumeRatio>=1.5&&b.length>=6&&z.high<=Math.max(...b.slice(-6,-1).map(x=>x.high));if(divergence)risks.push('量增未創高');
 const C=model('MOMENTUM_CONTINUATION_V1',[
  check('C1',f.ma[10].value===null?null:f.ma[5].value>f.ma[10].value),check('C2',red3,'紅K=close>open，不等同較昨日收漲'),check('C3',f.rsi14===null?null:rsiMomentumPass(f.rsi14),'Wilder RSI14，嚴格邊界'),check('C4',f.volumePrior5===null?null:f.volumePrior5/1000>1000),check('C5_RESEARCH_PRIOR20_CLOSE_BREAK_3',breaks3,'研究替代定義：各日close突破各自前20根high，非原圖已核驗公式'),check('C6',null,'UNVERIFIED：無參數均線定義不明／同名嚴格比較可能矛盾')
 ],{label:hot?'加速過熱':divergence?'量價背離':risks.length?'追高警戒':red3&&breaks3?'強勢延續':'轉弱待確認',upDays,return3:f.return3,atrDistance,sourceDefinitionVerified:false,momentumContext:context?.momentum||null});
 const obv=[];let value=0;for(let i=0;i<b.length;i++){if(i)value+=Math.sign(b[i].close-b[i-1].close)*b[i].volume;obv.push(value);}const obvHigh=b.length>=56?obv.at(-1)>Math.max(...obv.slice(-56,-1)):null;
 const tower=U.T.compute(b,3),towerFlip=tower.history.length>=3?tower.history.slice(-3).some(x=>x.flip==='BLACK_TO_RED'):null;
 const ext=r.researchSources||{},revenues=(Array.isArray(ext.revenues)?ext.revenues:[]).filter(x=>U.available(x,r)&&/^\d{4}-\d{2}$/.test(x.period)&&x.period<=date.slice(0,7)&&U.num(x.yoyPct)!==null).sort((a,b)=>b.period.localeCompare(a.period)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)),rev=revenues[0];
 const flow=x=>U.available(x,r)&&x.asOf===date&&x.definitionVerified===true;
 const buy=ext.mainBuy,branches=ext.branchDifference,capital=ext.capital;
 const D=model('FLOW_FUNDAMENTAL_CONFIRM_V1',[
  check('D1',obvHigh,'OBV：平收不累加；最新值嚴格高於前55根值'),check('D2',towerFlip,'沿用既有T3 BLACK_TO_RED，含訊號日最近3根'),check('D3',rev?rev.yoyPct>0:null,'只能使用訊號時間前已公布營收'),check('D4',flow(buy)&&typeof buy.pass==='boolean'?buy.pass:null,'不可由OBV／CMF冒充主力大買'),check('D5',flow(branches)&&branches.signVerified===true&&branches.window==='1D'&&U.num(branches.value)!==null?branches.value<0:null,'分公司家數差來源與負值方向需核實')
 ],{label:flow(buy)&&flow(branches)&&rev?'資金與營收待交叉確認':'技術子集觀察／外部資料未完整',verification:{technical:b.length>=56?'TECHNICAL_VERIFIED':'UNVERIFIED',fundamental:rev?'FUNDAMENTAL_VERIFIED':'UNVERIFIED',flow:flow(buy)&&flow(branches)?'FLOW_VERIFIED':'UNVERIFIED',overall:rev&&flow(buy)&&flow(branches)&&b.length>=56?'VERIFIED':'PARTIALLY_VERIFIED'},revenue:rev||null,capital:flow(capital)&&capital.kind==='PAID_IN_CAPITAL'&&capital.unit==='NTD'?capital:null,capitalStatus:flow(capital)&&capital.kind==='PAID_IN_CAPITAL'&&capital.unit==='NTD'?'FUNDAMENTAL_VERIFIED':'UNVERIFIED',optionalPriceRange:z.close>=20&&z.close<=9999,obv55High:obvHigh,towerFlip});
 const families={PRICE_STRUCTURE:breakout&&!failed||held.length>0&&reclaim&&!supportBroken,TREND_MA:ordered===true||f.ma[60].value!==null&&f.ma[20].value>f.ma[60].value,VOLUME:volumeRatio>=P.volumeConfirm,MOMENTUM:red3===true&&rsiMomentumPass(f.rsi14),FLOW:flow(buy)&&buy.pass===true&&flow(branches)&&branches.signVerified===true&&branches.value<0,FUNDAMENTAL:!!rev&&rev.yoyPct>0,DATA_QUALITY:n.calendarVerified&&n.basisVerified};
 const models={A,B,C,D},missing=Object.values(models).flatMap(m=>m.checks.filter(x=>x.status==='UNKNOWN').map(x=>m.id+':'+x.id));
 const stage=context?.breakoutEvent?.status==='INVALIDATED'||supportBroken?'BREAKOUT_FAILURE':hot?'OVEREXTENDED':breakout?'BREAKOUT_LAUNCH':held.length&&reclaim?'HEALTHY_PULLBACK':red3&&breaks3?'MOMENTUM_CONTINUATION':D.status==='符合'?'FLOW_CONFIRMATION':b.length<60?'INSUFFICIENT_DATA':'OBSERVATION';
 const structureInvalidation=held.length?Math.max(...held.map(x=>x.value)):f.prior20Low;
 validation.externalEvidenceAvailable=D.verification.overall==='VERIFIED';
 validation.externalEvidenceStatus=D.verification.overall;
 for(const [id,value] of [['D3',rev],['D4',buy],['D5',branches]])if(value&&D.checks.find(c=>c.id===id)?.status!=='UNKNOWN')validation.verifiedDataSources.push({scope:id,source:value.source,sourceDate:value.asOf||value.period,formula:value.formula,publishedAt:value.publishedAt,conditionStatus:D.checks.find(c=>c.id===id).status});
 validation.modelUnknownConditions=missing;
 if(b.length>=60)validation.validationStatus=missing.length?'TECHNICAL_PARTIAL':'RESEARCH_COMPLETE';
 const level=(value,formula,source,reason)=>({value,source,sourceDate:date,formula,verified:value!==null,unavailableReason:value===null?reason:null});
 const priceLevels={originalB:level(U.num(r.originalB),'原策略獨立提供；不從研究突破價複製',r.originalBSource||'LEGACY_STRATEGY','原策略B價未提供／不適用'),originalInvalidation:level(U.num(r.originalInvalidation),'原策略獨立失效線',r.originalInvalidationSource||'LEGACY_STRATEGY','原策略失效線未提供'),researchBreakout:level(f.prior20High,'max(high[t-20..t-1])',n.source,'需至少21根完成日K'),researchInvalidation:level(structureInvalidation,held.length?'max(已守住的前日MA5/10/20)':'min(low[t-20..t-1])',n.source,'支撐尚未確認且完成日K不足21根')};
 priceLevels.originalB.verified=r.originalBVerified===true&&priceLevels.originalB.value!==null;
 priceLevels.originalInvalidation.verified=r.originalInvalidationVerified===true&&priceLevels.originalInvalidation.value!==null;
 const indicatorStudy=I?.study(n.bars,{calendar:r.tradingCalendar})||null;
 return U.freeze({unifiedResearch,tradeContext:U.tradeContext(b,f,r,structureInvalidation),indicatorStudy,version:VERSION,rankModel:RANK,parameterVersion:P.version,code,name:displayName,date,generatedAt:options.generatedAt||new Date().toISOString(),sourceSnapshotId:r.dailyBasisV2?.fingerprint||U.hash(b),dataSource:r.dailySeriesMeta?.source||n.source,sourceBars:b.slice(-20),state:stage,compactStateLabel:stage==='INSUFFICIENT_DATA'?`歷史日K不足（${b.length}/60根）`:compactStateLabel(stage),validation,priceLevels,models,features:f,families,risks:[...new Set(risks)],foundation,originalB:U.num(r.originalB),originalInvalidation:U.num(r.originalInvalidation),researchBreakoutPrice:f.prior20High,researchInvalidation:structureInvalidation,nextTradingDate:U.nextDate(r),dataQuality:{complete:missing.length===0&&!!n.basisVerified&&!!n.calendarVerified,missing:[...validation.missingFields,...missing],warnings:n.warnings||[]},researchOnly:true,affectsOriginalEligibility:false,affectsOriginalScore:false,affectsOriginalRanking:false,flags});
}
function candidate(a,kind='STRONG',enabledModels=FILTERS[kind]||FILTERS.STRONG){
 if(['DISABLED','INSUFFICIENT_DATA','BREAKOUT_FAILURE','OVEREXTENDED'].includes(a.state))return false;
 return enabledModels.some(k=>{const m=a.models[k];if(!m)return false;const c=id=>m.checks.find(x=>x.id===id)?.status==='PASS';return k==='A'?a.state==='BREAKOUT_LAUNCH'&&c('A1')&&c('A6'):k==='B'?a.state==='HEALTHY_PULLBACK'&&c('B1')&&c('B6')&&c('B8'):k==='C'?c('C1')&&c('C2')&&c('C3')&&c('C5_RESEARCH_PRIOR20_CLOSE_BREAK_3'):c('D1')&&c('D2');});
}
function rank(analyses,{kind='STRONG',enabledModels=FILTERS[kind]||FILTERS.STRONG,baselineCodes=[]}={}){
 const dates=new Set(analyses.map(a=>a.date));if(dates.size>1)throw Error('研究榜不可混用不同日期');
 const ids=new Set();for(const a of analyses){if(ids.has(a.code))throw Error('研究榜股票代碼重複');ids.add(a.code);}
 const rows=analyses.filter(a=>candidate(a,kind,enabledModels));
 // Transparent lexicographic rules, no fitted weights, probabilities or composite score.
 const count=a=>Object.values(a.families).filter(x=>x===true).length;
 rows.sort((a,b)=>a.risks.length-b.risks.length||Number(b.dataQuality.complete)-Number(a.dataQuality.complete)||count(b)-count(a)||a.code.localeCompare(b.code));
 const codes=rows.map(a=>a.code),comparison=[...new Set([...baselineCodes,...codes])].map(code=>({code,baselineRank:baselineCodes.indexOf(code)<0?null:baselineCodes.indexOf(code)+1,researchRank:codes.indexOf(code)<0?null:codes.indexOf(code)+1}));
 return U.freeze({model:RANK,date:analyses[0]?.date||null,kind,enabledModels:[...enabledModels],rows:rows.map((analysis,i)=>({rank:i+1,analysis,verifiedFamilies:count(analysis)})),top8:codes.slice(0,8),comparison,risks:analyses.filter(a=>['BREAKOUT_FAILURE','OVEREXTENDED'].includes(a.state)),dataInsufficient:analyses.filter(a=>a.state==='INSUFFICIENT_DATA'),status:!analyses.length?'NOT_QUERIED':analyses.every(a=>a.state==='INSUFFICIENT_DATA')?'INSUFFICIENT_DATA':rows.length?'RESEARCH_CANDIDATES':'NO_CANDIDATES',performanceValidated:false,method:'先風險數少，再資料完整，再已驗證家族數多，最後代碼；每家族最多一次。僅技術子集研究，非完整原圖策略。'});
}
return Object.freeze({VERSION,RANK,FILTERS,rsiMomentumPass,evaluate,candidate,rank});
});
