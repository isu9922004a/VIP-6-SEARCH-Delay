/* Deterministic shadow research. Renderers consume this result, never rescore it. */
(function(r,f){const c=typeof module==='object'&&module.exports,a=f(c?require('./research-common-v1.js'):r.ShitouResearchCommon,c?require('./indicator-multi-v1.js'):r.ShitouIndicatorMultiV1,c?require('./structure-context-v1.js'):r.ShitouStructureContext);if(c)module.exports=a;else r.ShitouUnifiedAnalysis=a;})(globalThis,function(U,I,S){
'use strict';
const VERSION='UNIFIED_RESEARCH_R17',PARAM=Object.freeze({version:'R16_PARAMS_1',pivotLeft:3,pivotRight:3,volume:1.2,longWick:.5,weakClose:.6,zoneATR:.25,maxStopPct:8,minRR:1.5,minSpacePct:2,maxGapPct:5,maxExtensionATR:2,fee:.001425,feeDiscount:1,tax:.003,slippage:.001,redBodyMin:.25,redBodyMax:.65,redWickMax:.4,redVolumeMin:.7,redVolumeMax:1.5,setupDays:5});
const FLAGS=Object.freeze({unifiedResearchEnabled:true,oneThirdEnabled:true,postLimitupEnabled:true,waveEnabled:true,marketContextEnabled:true});
const statusZh={FAILED_BREAKOUT:'盤中一度漲過壓力，但收盤沒有站上',WAIT_TRIGGER:'尚未出現買點',PENDING_CONFIRMATION:'已觸及觀察價格但待確認',CONFIRMED:'技術條件已確認',INVALIDATED:'原本看好的理由已失效',DATA_INSUFFICIENT:'資料不足',ACCEPTABLE_FOR_EVALUATION:'風險可供評估',BLOCKED:'風險過高，阻擋進場',UNKNOWN:'必要風險未知'};
const fmt=n=>Number.isFinite(n)?n.toFixed(2):'未知';
function roundTick(p,d=0){if(!(p>0))return null;const t=U.tick(p),v=(d<0?Math.floor((p+1e-8)/t):d>0?Math.ceil((p-1e-8)/t):Math.round(p/t))*t;return +v.toFixed(2);}
function pivots(b,p=PARAM){const out=[];for(let i=p.pivotLeft;i+p.pivotRight<b.length;i++){const w=b.slice(i-p.pivotLeft,i+p.pivotRight+1),z=b[i];for(const [type,key,cmp] of [['HIGH','high',Math.max],['LOW','low',Math.min]])if(z[key]===cmp(...w.map(x=>x[key]))&&w.filter(x=>x[key]===z[key]).length===1)out.push({type,price:z[key],index:i,pivotDate:z.date,confirmedAt:b[i+p.pivotRight].date});}return out;}
function breakout(b,level,p=PARAM){if(b.length<21||!(level>0))return {status:'DATA_INSUFFICIENT'};const z=b.at(-1),prev=b.at(-2),range=z.high-z.low,volumeRatio5=z.volume/U.mean(b.slice(-6,-1).map(x=>x.volume)),volumeRatio20=z.volume/U.mean(b.slice(-21,-1).map(x=>x.volume)),upperWickRatio=range?(z.high-Math.max(z.open,z.close))/range:0,closeLocation=range?(z.close-z.low)/range:null;
 let status=z.close>level?'CLOSE_CONFIRMED':z.high>level?'FAILED_BREAKOUT':'NOT_BROKEN';if(z.completed===false)status=z.high>level?'PENDING_CLOSE':'NOT_BROKEN';else if(status==='CLOSE_CONFIRMED'&&volumeRatio5>=p.volume&&upperWickRatio<p.longWick&&closeLocation>=p.weakClose)status=prev.close>level&&z.low<=level*(1+.003)?'RETEST_CONFIRMED':'VOLUME_CONFIRMED';return {status,level,volumeRatio5,volumeRatio20,upperWickRatio,closeLocation,upperWick:z.high-Math.max(z.open,z.close),lowerWick:Math.min(z.open,z.close)-z.low,range};}
function oneThird(b,pv,p=PARAM){let pair=null;for(const hi of pv.filter(x=>x.type==='HIGH')){const lo=pv.filter(x=>x.type==='LOW'&&x.index<hi.index).at(-1);if(lo&&hi.price>lo.price)pair={a:lo,b:hi};}if(!pair)return {version:'ONE_THIRD_RETRACE_RESEARCH_V1',status:pv.length?'NOT_APPLICABLE':'DATA_INSUFFICIENT'};const {a,b:hi}=pair,raw=a.price+(hi.price-a.price)/3,price=roundTick(raw),after=b.slice(hi.index+p.pivotRight+1),z=b.at(-1),tol=U.atr(b)*p.zoneATR||price*.005,broken=after.find(x=>x.close<price-tol),tested=after.find(x=>x.low<=price+tol),confirmed=!broken&&tested&&z.close>price+tol&&z.close>z.open&&z.close>b.at(-2).close;return {version:'ONE_THIRD_RETRACE_RESEARCH_V1',status:broken?'SUPPORT_BROKEN':confirmed?'SUPPORT_CONFIRMED':Math.abs(z.close-price)<=tol?'TESTING_SUPPORT':z.close>price&&U.pct(z.close,price)<3?'APPROACHING_SUPPORT':'WAITING_FOR_RETRACE',A:a,B:hi,rawPrice:raw,price,distancePct:U.pct(z.close,price),confirmedAt:confirmed?z.date:null,invalidation:'完成日K收盤低於候選支撐帶下緣',volumeRatio5:z.volume/U.mean(b.slice(-6,-1).map(x=>x.volume)),note:'從低點向上三分之一的候選支撐，未驗證績效，碰到不等於買點。'};}
// Require an authoritative event rule for each date. Never infer legal limit from yesterday close.
function limitEvent(bar,rule){if(!rule?.verified||!rule.source||rule.date!==bar.date)return {status:'DATA_INSUFFICIENT'};if(rule.applicable===false)return {status:'NOT_APPLICABLE'};if(!(rule.reference>0)||!(rule.limitPct>0)||rule.adjustmentVerified!==true||rule.tickRule!=='TW_COMMON')return {status:'DATA_INSUFFICIENT'};const limit=roundTick(rule.reference*(1+rule.limitPct),-1);return {status:bar.close>=limit?'CLOSE_LIMITUP':bar.high>=limit?'TOUCHED_LIMITUP':'NO_EVENT',limit,locked:'UNKNOWN',source:rule.source};}
function postLimitup(b,r,p=PARAM){const events=b.map((bar,i)=>({i,date:bar.date,...limitEvent(bar,r.limitRules?.find(x=>x.date===bar.date))})),event=events.filter(x=>['CLOSE_LIMITUP','TOUCHED_LIMITUP'].includes(x.status)&&b.length-1-x.i<=p.setupDays+2).at(-1);if(!event)return {version:'POST_LIMITUP_BREAKOUT_RESEARCH_V1',status:events.some(x=>x.status==='NO_EVENT')?'NOT_APPLICABLE':'DATA_INSUFFICIENT',reason:'需逐日有效競價基準、制度與除權息驗證；日K無法確認整日鎖定'};let setup=null;for(let i=event.i+1;i<Math.min(b.length-1,event.i+p.setupDays+1);i++){const z=b[i],g=U.geometry(z),range=z.high-z.low,body=range?(z.close-z.open)/range:0,v=i>=5?z.volume/U.mean(b.slice(i-5,i).map(x=>x.volume)):null;if(body>=p.redBodyMin&&body<=p.redBodyMax&&g.upperRatio<=p.redWickMax&&(z.open-z.low)/range<=p.redWickMax&&z.close>=b[i-1].low&&z.close<=b[event.i].high&&v>=p.redVolumeMin&&v<=p.redVolumeMax)setup={date:z.date,price:z.high,low:z.low,volumeRatio5:v};}const br=setup?breakout(b,setup.price,p):null;return {version:'POST_LIMITUP_BREAKOUT_RESEARCH_V1',candidateVersion:'RED_MID_CANDLE_CANDIDATE_V1',status:!setup?'SETUP_FORMING':br.status==='FAILED_BREAKOUT'?'BREAKOUT_FAILED':['VOLUME_CONFIRMED','RETEST_CONFIRMED'].includes(br.status)?'BREAKOUT_CONFIRMED':br.status==='CLOSE_CONFIRMED'?'BREAKOUT_PENDING':'WAIT_BREAKOUT',event,setup,breakout:br,note:'可重現的自訂候選定義，非影片作者完整算法；僅輔助研究。'};}
function wave(b,pv){const alt=[];const seq=[];for(const x of pv){if(seq.at(-1)?.type===x.type){if(x.type==='HIGH'?x.price>seq.at(-1).price:x.price<seq.at(-1).price)seq[seq.length-1]=x;}else seq.push(x);}const s=seq.slice(-6);let candidate=null,rules=null;if(s.length===6&&s[0].type==='LOW'){const v=s.map(x=>x.price),w=[v[1]-v[0],v[3]-v[2],v[5]-v[4]];rules={wave2AboveOrigin:v[2]>v[0],wave3NotShortest:w[1]>=Math.min(w[0],w[2]),wave4NoOverlap:v[4]>v[1],higherHighs:v[3]>v[1]&&v[5]>v[3]};if(Object.values(rules).every(Boolean))candidate='IMPULSE_FIVE_CANDIDATE';}const abc=seq.slice(-4);if(abc.length===4&&abc[0].type==='HIGH'&&abc[2].price<abc[0].price&&abc[3].price<abc[1].price)alt.push('ABC_CORRECTION_CANDIDATE');const highs=pv.filter(x=>x.type==='HIGH').slice(-2),m=I.macd(b);const divergence=highs.length===2&&highs[1].index>=35&&highs[1].price>highs[0].price&&m[highs[1].index].dif<m[highs[0].index].dif;return {version:'ELLIOTT_WAVE_STRUCTURE_RESEARCH_V1',waveCandidate:candidate,ruleValidation:rules,pivots:s,alternativeCounts:alt,invalidation:candidate?s[4].price:null,divergence:{detected:divergence,peaks:highs,confirmedAt:divergence?highs[1].confirmedAt:null},note:candidate?'推動五浪候選，非未來預測；例外型態未建模。':'目前存在多種可能的波段結構，無法可靠判斷屬於第幾浪。',multiTimeframe:'UNKNOWN',affectsOriginalRanking:false};}
function riskReward(entry,stop,targets,p=PARAM){if(!(entry>0&&stop>0&&stop<entry)||!targets?.length)return {status:'UNKNOWN',rr:null};const fee=p.fee*p.feeDiscount,buy=entry*(1+p.slippage)*(1+fee),sell=n=>n*(1-p.slippage)*(1-fee-p.tax),risk=buy-sell(stop),reward=sell(targets[0])-buy;if(!(risk>0&&reward>0))return {status:'BLOCKED',rr:null,reason:'扣成本後無合理正報酬'};return {status:'KNOWN',entry,stop,target1:targets[0],target2:targets[1]??null,riskPerShare:risk,rewardPerShare:reward,rr:reward/risk,stopPct:(entry-stop)/entry*100,spacePct:U.pct(targets[0],entry),costs:{fee,tax:p.tax,slippage:p.slippage},note:'跳空或流動性不足可能使實際損失高於計畫；未套用個人資金設定。'};}
const stageText={BULL_START:'多頭起漲',BULL_CONTINUE:'多頭續強',HIGH_CONSOLIDATION:'高檔整理',PULLBACK:'回踩支撐',RANGE:'箱型整理',REBOUND:'跌深反彈',BEAR:'空頭走弱',FAILED:'突破失敗',INSUFFICIENT:'資料不足'};
function evaluate(input,options={}){
 const flags={...FLAGS,...options.flags},p={...PARAM,...options.parameters};
 if(!flags.unifiedResearchEnabled)return U.freeze({version:VERSION,state:'DISABLED'});
 const r=U.normalizeInput(input),n=U.validate(r);
 if(!n.ok||n.bars.length<63)return U.freeze({version:VERSION,state:'DATA_INSUFFICIENT',entryDecision:'CANNOT_EVALUATE',reason:n.reason||'至少需要63根已完成且通過健康檢查的日K',summary:[{title:'現在適合進場嗎？',value:'⚪ 資料不足，無法判斷；'+(n.reason||'歷史長度不足')}],details:[]});
 const b=n.bars,z=b.at(-1),prev=b.at(-2),f=U.features(b),pv=pivots(b,p),prior=b.slice(0,-1),priorPv=pivots(prior,p),atr=f.atr14,tol=atr*p.zoneATR;
 const context=S.evaluate(b,r,{pivots:pv,parameters:{...S.PARAM,volume:p.volume,zoneATR:p.zoneATR}}),volume=context.volume,event=context.breakoutEvent;
 const resistance=f.prior20High,support=f.prior20Low,br={...breakout(b,resistance,p),quality:context.breakout};
 const up=z.close>f.ma[20].value&&f.ma[20].value>f.ma[60].value&&f.ma[20].slope>0,down=z.close<f.ma[20].value&&f.ma[20].value<f.ma[60].value;
 const stage=event?.status==='INVALIDATED'?'FAILED':context.pullback.status==='CONFIRMED'?'PULLBACK':up&&z.close<f.ma[5].value?'PULLBACK':up&&f.rsi14>70?'HIGH_CONSOLIDATION':up?'BULL_CONTINUE':down&&z.close>prev.close?'REBOUND':down?'BEAR':z.close>f.ma[20].value&&prev.close>U.ma(prior,20)?'BULL_START':'RANGE';
 const levels=[];
 function level(price,source,kind,confirmedAt=z.date){if(!(price>0))return;levels.push({price,zoneLow:Math.max(0,price-tol),zoneHigh:price+tol,source,kind,timeframe:'DAILY',confirmationStatus:kind==='MA_REFERENCE'?'DYNAMIC_REFERENCE':'CONFIRMED_REFERENCE',asOfDate:z.date,confirmedAt,invalidationCondition:'參考關卡不等於已驗證支撐；依情境的完成收盤規則判斷'});}
 for(const k of [5,10,20,60])level(f.ma[k].value,'MA'+k,'MA_REFERENCE');
 level(resistance,'前20日區間上緣','RANGE_HIGH');level(support,'前20日區間下緣','RANGE_LOW');
 for(const v of pv.slice(-20))level(v.price,'已確認波段'+(v.type==='HIGH'?'高點':'低點'),'PIVOT_'+v.type,v.confirmedAt);
 const prior60=Math.max(...prior.slice(-60).map(x=>x.high));level(prior60,'前60日高點','RANGE_HIGH');
 if(r.originalBVerified===true)level(U.num(r.originalB),'原策略已核驗B價','STRATEGY_REFERENCE');
 if(U.geometry(z).upperRatio>=.25)level(z.high,'當日上影高點','INTRADAY_HIGH');
 const upper=levels.filter(x=>x.price>z.close+U.tick(z.close)/2).sort((a,b)=>a.price-b.price).filter((x,i,a)=>!i||Math.abs(x.price-a[i-1].price)>1e-8);
 const low=priorPv.filter(x=>x.type==='LOW'&&x.price<z.close).at(-1),defense=low?.price??(support<z.close?support:null),s=defense;
 const studies={oneThird:flags.oneThirdEnabled?oneThird(b,pv,p):null,postLimitup:flags.postLimitupEnabled?postLimitup(b,r,p):null,wave:flags.waveEnabled?wave(b,pv):null};
 if(studies.oneThird?.price)studies.oneThird.overlappingSources=levels.filter(x=>Math.abs(x.price-studies.oneThird.price)<=tol).map(x=>x.source);
 const risks=[];
 function warn(code,condition,evidence,explanation,clear,severity='HIGH'){if(condition)risks.push({code,evidence,severity,trigger:code,clearCondition:clear,explanation});}
 warn('VOLUME_UNVERIFIED',!volume.usable,{status:volume.status},volume.note,'核對來源、單位與統計範圍後重新計算');
 warn('VOLUME_UPPER_WICK',volume.usable&&br.volumeRatio5>=p.volume&&br.upperWickRatio>=p.longWick,{ratio:br.volumeRatio5,wick:br.upperWickRatio},'放量衝高後收回，上方賣壓值得注意；無法據此判定主力出貨。','後續收盤突破高點且量價恢復');
 warn('FAILED_BREAKOUT',br.status==='FAILED_BREAKOUT',{resistance,close:z.close},'盤中越過壓力但收盤未站穩；尚未成立的突破不等於已確認結構失效。','重新收盤越線並通過量價確認');
 warn('EXTENDED',s&&z.close-s>atr*p.maxExtensionATR,{support:s,atr},'股價離結構防守參考較遠，新進場可能承擔較大回撤。','回踩止跌或建立新結構');
 warn('GAP',U.pct(z.open,prev.close)>p.maxGapPct,{gapPct:U.pct(z.open,prev.close),fullRangeGap:context.gap.fullRangeUp},'大幅跳空後須重算進場與風險；開盤缺口不等於全區間缺口。','以實際成交價與結構重新計算');
 warn('MOMENTUM_DIVERGENCE',context.momentum.bearishDivergence,context.momentum,'股價已確認波峰創高、RSI14未同步，僅為背離研究，非立即賣出命令。','下一組確認波峰重新比較','MEDIUM');
 warn('SUPPORT_BROKEN',context.pullback.status==='INVALIDATED'||z.close<support-tol,{support:context.pullback.establishedSupport?.price||support,close:z.close},'完成收盤跌破已建立情境的防守／歷史區間，原理由須重新評估。','收復後建立新的確認情境');
 warn('NEAR_RESISTANCE',upper[0]&&U.pct(upper[0].price,z.close)<p.minSpacePct,{nextResistance:upper[0]?.price,source:upper[0]?.source},'最近上方關卡太近，不能跳過近壓、直接使用遠方目標美化報酬風險。','以最近關卡重新評估成本後空間');
 warn('LOW_VOLUME',volume.usable&&volume.ratio5<.7,{ratio:volume.ratio5},'成交量偏低；可能是供需減弱或流動性問題，不能單憑縮量認定洗盤。','依對應情境核對量能','MEDIUM');
 const activeEvent=event&&event.index<b.length-1?event:null,breakTrigger=activeEvent?.level??resistance;
 const w=context.patterns.find(x=>x.type==='DOUBLE_BOTTOM'),swingTrigger=priorPv.filter(x=>x.type==='HIGH').at(-1)?.price;
 const defs=[['BREAKOUT',breakTrigger,activeEvent?.level??defense,'有效突破壓力'],['PULLBACK',context.pullback.candidatePrice,context.pullback.establishedSupport?.price??context.pullback.candidatePrice,'多頭回檔再攻'],['RETEST',activeEvent?.level,activeEvent?.level,'突破後回測'],['BOX',resistance,support,'箱型向上突破'],['REVERSAL',w?.neckline??swingTrigger,w?Math.min(w.points[0].price,w.points[2].price):defense,'弱勢反轉確認']];
 const scenarios=defs.map(([id,trigger,guard,label])=>{
  const q=trigger>0?S.quality(b,trigger,volume,{...S.PARAM,volume:p.volume,zoneATR:p.zoneATR}):null;
  let signalStatus='WAIT_TRIGGER',applicable=true;
  if(!(trigger>0&&guard>0))signalStatus='DATA_INSUFFICIENT';
  else if(id==='PULLBACK'){
   applicable=context.pullback.trendUp;
   signalStatus=context.pullback.status==='INVALIDATED'?'INVALIDATED':context.pullback.closeRecovered&&volume.usable&&context.pullback.contracted&&z.volume>prev.volume?'CONFIRMED':context.pullback.touched?'PENDING_CONFIRMATION':'WAIT_TRIGGER';
  }else if(id==='RETEST'){
   signalStatus=activeEvent.status==='INVALIDATED'?'INVALIDATED':activeEvent.status==='RETEST_HELD'&&up&&z.close>prev.close&&q.status==='CONFIRMED'?'CONFIRMED':activeEvent.status==='RETEST_HELD'?'PENDING_CONFIRMATION':'WAIT_TRIGGER';
  }else{
   if(id==='BOX')applicable=U.pct(resistance,support)<15&&Math.abs(f.ma[20].slope)<2&&priorPv.filter(x=>x.index>=b.length-21&&x.type==='HIGH').length>=2&&priorPv.filter(x=>x.index>=b.length-21&&x.type==='LOW').length>=2;
   if(id==='REVERSAL'){
    const lows=priorPv.filter(x=>x.type==='LOW').slice(-2),stable=lows.length===2&&lows[1].price>=lows[0].price-tol;
    applicable=!down&&z.close>f.ma[20].value&&(w?.status==='CONFIRMED'||stable&&prev.close>U.ma(prior,20));
   }
   signalStatus=applicable?q.status:'WAIT_TRIGGER';
   if(id==='BREAKOUT'&&activeEvent?.status==='INVALIDATED')signalStatus='INVALIDATED';
  }
  // Technical confirmation and ability to execute are separate decisions.
  const guardTolerance=(id==='RETEST'||id==='BREAKOUT')&&activeEvent?activeEvent.tolerance:id==='PULLBACK'&&context.pullback.establishedSupport?context.pullback.establishedSupport.tolerance:tol;
  const invalidationPrice=guard>0?roundTick(guard-guardTolerance,-1):null,stop=invalidationPrice>0?roundTick(invalidationPrice-atr*.25,-1):null;
  const targets=upper.map(x=>x.price),rr=signalStatus==='INVALIDATED'?{status:'UNKNOWN',rr:null}:riskReward(z.close,stop,targets,p);
  const highRisk=risks.some(x=>x.severity==='HIGH'&&x.code!=='VOLUME_UNVERIFIED');
  const block=signalStatus==='INVALIDATED'||rr.status==='BLOCKED'||rr.status==='KNOWN'&&(rr.rr<p.minRR||rr.stopPct>p.maxStopPct||rr.spacePct<p.minSpacePct)||highRisk;
  const unknown=!volume.usable||!n.basisVerified||!n.calendarVerified||rr.status==='UNKNOWN';
  const riskDecision=block?'BLOCKED':unknown?'UNKNOWN':'ACCEPTABLE_FOR_EVALUATION';
  const entryDecision=signalStatus==='INVALIDATED'||riskDecision==='BLOCKED'?'DO_NOT_ENTER':signalStatus==='DATA_INSUFFICIENT'||riskDecision==='UNKNOWN'?'CANNOT_EVALUATE':signalStatus==='CONFIRMED'?'CONDITIONAL_ENTRY':'WAIT';
  const volumeRule=id==='PULLBACK'?'前日量低於更前5日均量，當日量較前日增加；排除當日作基準':`當日量／前5個完成日均量至少 ${p.volume} 倍，分母不含當日`;
  const confirmationRule=id==='PULLBACK'?`原多頭背景成立，回踩前日MA20 ${fmt(trigger)} 後收復前日高點；${volumeRule}`:id==='RETEST'?`事件日 ${activeEvent?.date||'未形成'} 的原突破線 ${fmt(trigger)} 回測後守住，再轉強；${volumeRule}`:`完成日K收盤高於 ${fmt(trigger)} 加 ${fmt(q?.buffer)} 緩衝；${volumeRule}，收盤位置至少 ${p.weakClose*100}%，上影比例低於 ${p.longWick}`;
  return {id,label,applicable,entryHypothesis:label+'後重新評估結構延續',triggerPrice:trigger??null,triggerSource:id==='RETEST'||id==='BREAKOUT'&&activeEvent?'固定事件突破線':id==='PULLBACK'?'前日MA20候選參考':id==='REVERSAL'?(w?'W底頸線':'已確認波段高點'):'前20日區間上緣',confirmationRule,volumeRule,
   defensePrice:guard??null,defenseStatus:signalStatus==='CONFIRMED'?'CONFIRMED_SCENARIO':context.pullback.establishedSupport&&id==='PULLBACK'?'PREVIOUSLY_CONFIRMED':'CANDIDATE_REFERENCE',
   invalidationPrice,invalidationRule:invalidationPrice>0?`完成日K收盤低於 ${fmt(invalidationPrice)}，此研究情境失效；非實際成交停損保證`:'防守結構未核實，暫不提供失效／停損組合',invalidationTimeframe:'DAILY_CLOSE',invalidationReason:'事先定義的情境防守不再成立',signalStatus,riskDecision,entryDecision,riskReward:signalStatus==='INVALIDATED'?null:rr,quality:q};
 });
 const confirmed=scenarios.filter(x=>x.signalStatus==='CONFIRMED'),good=confirmed.filter(x=>x.entryDecision==='CONDITIONAL_ENTRY');
 const essentialUnknown=!volume.usable||!n.basisVerified||!n.calendarVerified;
 const entryDecision=good.length?'CONDITIONAL_ENTRY':confirmed.some(x=>x.riskDecision==='BLOCKED')?'DO_NOT_ENTER':essentialUnknown||confirmed.some(x=>x.riskDecision==='UNKNOWN')?'CANNOT_EVALUATE':'WAIT';
 const headline={CONDITIONAL_ENTRY:'🟢 技術與風險條件可供評估，仍須按實際成交價重算',DO_NOT_ENTER:'🔴 技術觸發但風險不合格，目前不宜新進場',WAIT:'🟡 尚無已確認買點，等待對應情境成立',CANNOT_EVALUATE:'⚪ 必要資料或風險待核，無法確認新買點'}[entryDecision];
 const next=U.nextDate(r),conclusion=`${stageText[stage]}；${headline}。研究條件未驗證績效，原榜資格與新進場判斷分開。`;
 const summary=[{title:'現在適合進場嗎？',value:headline},{title:'進場確認條件',value:scenarios.map(x=>`${x.label}：${statusZh[x.signalStatus]}；${x.confirmationRule}`).join('\n')},{title:'看到什麼不要買？',value:risks.map(x=>x.explanation).join('\n')||'未觸發主要警示，仍須核對停損與成本後空間。'},{title:'關鍵價位與失效',value:`收盤 ${fmt(z.close)}；結構防守參考 ${fmt(s)}；突破線 ${fmt(breakTrigger)}；最近上方關卡 ${fmt(upper[0]?.price)}。`},{title:'一句話結論',value:conclusion}];
 const patternNames=context.patterns.map(x=>`${x.label}：${({FORMING:'形成中',PENDING_CONFIRMATION:'待確認',CONFIRMED:'技術確認',INVALIDATED:'已失效',BREAKDOWN_OBSERVED:'向下跌破觀察'})[x.status]||x.status}；${x.note}`).join('\n')||'尚未識別出符合研究定義的W底／三角，不強制畫型態。';
 const details=[
  {title:'行情階段與依據',value:`${stageText[stage]}；MA20 ${fmt(f.ma[20].value)}、MA60 ${fmt(f.ma[60].value)}；Wilder RSI5／10／14 ${fmt(f.rsi5)}/${fmt(f.rsi10)}/${fmt(f.rsi14)}。價格衍生指標非獨立勝率證據。`},
  {title:'價格與交易日證據',value:`價格口徑：${r.priceAdjustment?.verified?(r.priceAdjustment.basis==='UNADJUSTED_OFFICIAL_OHLC'?'官方未還原名目價格':r.priceAdjustment.basis):'尚未取得獨立核驗'}；${r.priceAdjustment?.method||r.researchEvidence?.priceBasis?.reason||'後端未提供完整價格口徑證據'}。${r.priceAdjustment?.matchedBars?'逐根比對 '+r.priceAdjustment.matchedBars+' 根OHLC。':''}\n交易日期：${n.calendarVerified?'已核對官方實際成交日期':'尚未接入可核驗的交易日期'}；${r.researchEvidence?.calendar?.reason||r.tradingCalendar?.source||'無來源'}。`},
  {title:'量能口徑與確認',value:`${volume.note}；日K量統一為股。當日量 ${z.volume} 股／前5根均量 ${fmt(volume.baseline5)} 股＝${fmt(volume.ratio5)} 倍；前20根量比 ${fmt(volume.ratio20)} 倍。分母排除當日。${p.volume} 倍為突破研究參數，未驗證績效，不通用套用回檔情境。`},
  {title:'情境觸發與確認',value:scenarios.map(x=>`${x.label}：${statusZh[x.signalStatus]}／${statusZh[x.riskDecision]}；${x.confirmationRule}`).join('\n')},
  {title:'支撐確認與失效',value:`${context.pullback.note}。${context.pullback.establishedSupport?`先前情境 ${context.pullback.establishedSupport.date}，固定參考 ${fmt(context.pullback.establishedSupport.price)}。`:'目前沒有先前已確認的MA20收復情境。'}\n`+scenarios.map(x=>`${x.label}：${x.invalidationRule}`).join('\n')},
  {title:'底部與三角研究',value:patternNames},
  {title:'K線位置與後續',value:context.candles.map(x=>`${x.eventDate} ${x.label}；${x.status==='CONFIRMED'?'下一根價格確認':x.status==='INVALIDATED'?'已失效':'待後續確認'}；附近參考 ${x.nearReferences.join('、')||'無'}；${x.note}`).join('\n')||'近期無符合定義的特殊K線；不強迫套用形態。'},
  {title:'目標與報酬風險',value:scenarios.map(x=>`${x.label}：${x.riskReward?.status==='KNOWN'?`以收盤假設進場；計畫失效 ${fmt(x.invalidationPrice)}、研究停損 ${fmt(x.riskReward.stop)}、最近關卡 ${fmt(x.riskReward.target1)}、扣成本R/R ${fmt(x.riskReward.rr)}`:'缺乏合理的防守／上方關卡或情境已失效，無法計算'}`).join('\n')+'\n型態量度投射不作為已核實壓力或R/R目標；跳空、漲停與滑價可能無法按計畫成交。'},
  {title:'主力敘事的資料邊界',value:'日K只能描述量價，不能確認吸籌／洗盤／出貨意圖、主力實際成本、封單撤單或對倒；換手15%不是通用出貨分界。沒有外部資金證據就標未知。'},
  {title:'既有輔助研究',value:Object.entries(studies).filter(([,v])=>v).map(([k,v])=>`${({oneThird:'三分之一回撤',postLimitup:'漲停後候選',wave:'波浪候選'})[k]}：${v.note||v.reason||'輔助研究，未驗證績效'}`).join('\n')},
  {title:'下一交易日觀察',value:`${next||(n.calendarVerified?'已核對完成交易日；下一交易日待公告核對':'正式日曆未核實，不推算下一交易日')}：突破看固定線 ${fmt(breakTrigger)}；回檔看候選參考 ${fmt(context.pullback.candidatePrice)}；上方最近關卡 ${fmt(upper[0]?.price)}。隔日開盤與盤中訊號尚未發生；跳空須重算。`}
 ];
 const chartBars=b.slice(-120).map((x,i)=>({...x,index:b.length-Math.min(120,b.length)+i,ma5:U.ma(b,5,b.length-Math.min(120,b.length)+i),ma20:U.ma(b,20,b.length-Math.min(120,b.length)+i),ma60:U.ma(b,60,b.length-Math.min(120,b.length)+i)}));
 return U.freeze({version:VERSION,schemaVersion:VERSION,state:'RESEARCH_ONLY',code:r.stock,date:z.date,close:z.close,sourceSnapshotId:r.dailyBasisV2?.fingerprint||U.hash(b),parameterVersion:p.version,parameters:p,flags,stage,stageLabel:stageText[stage],entryDecision,scenarios,levels,breakout:br,risks,studies,structureContext:context,summary,details,conclusion,nextTradingDate:next,
  chart:{bars:chartBars,patterns:context.patterns,levels,trigger:breakTrigger,invalidation:good[0]?.invalidationPrice??null,defenseReference:s,nextResistance:upper[0]||null,volume,priceBasis:r.priceAdjustment?.basis||'UNKNOWN',basisVerified:!!n.basisVerified,calendarVerified:!!n.calendarVerified},
  affectsOriginalEligibility:false,affectsOriginalScore:false,affectsOriginalRanking:false,performanceValidated:false});
}
function marketContext(stock,market){if(!market||stock.date!==market.date)return {version:'MARKET_CONTEXT_RESEARCH_V1',state:'UNKNOWN',note:'市場與個股日期未對齊，無法確認'};return {version:'MARKET_CONTEXT_RESEARCH_V1',state:'RESEARCH_ONLY',note:stock.stage.startsWith('BULL')&&market.stage==='BEAR'?'個股偏強但大盤偏弱，需要注意逆勢風險。':market.stage.startsWith('BULL')&&stock.stage==='BEAR'?'大盤強但個股尚未同步轉強，不能只因大盤上漲就買。':'依各自結構及風險判斷；市場背景不改排名。',affectsOriginalRanking:false};}
return Object.freeze({VERSION,PARAM,FLAGS,evaluate,pivots,breakout,oneThird,limitEvent,postLimitup,wave,riskReward,roundTick,marketContext});
});
