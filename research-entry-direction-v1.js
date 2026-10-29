/* Causal second-pass research filter. Never changes source rankings or orders. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon,node?require('./structure-context-v1.js'):root.ShitouStructureContext);if(node)module.exports=api;else root.ShitouEntryDirection=api;})(globalThis,function(U,S){
'use strict';
const VERSION='ENTRY_DIRECTION_8_2_5',PARAM=Object.freeze({bodyMax:.35,wickBody:2,shortWickMax:.15,trendDays:5,trendATR:.5,nearATR:.5,signalAge:3});
const LABELS=Object.freeze({EVALUATE:'可評估多方新買',WAIT:'先等價格確認',AVOID:'目前不宜新買',DATA:'必要資料待核',ALL:'全部研究股票'});
const money=x=>Number.isFinite(x)?String(+x.toFixed(2))+'元':'尚未確認';
function knownLevels(b){const p=S.pivots(b),levels=p.map(x=>({price:x.price,type:x.type,source:'已確認波段'+(x.type==='HIGH'?'高點':'低點'),knownAt:x.confirmedAt}));if(b.length>=20)for(const [type,key,op] of [['HIGH','high',Math.max],['LOW','low',Math.min]])levels.push({price:op(...b.slice(-20).map(x=>x[key])),type,source:'前20天'+(type==='HIGH'?'高點':'低點'),knownAt:b.at(-1).date});return levels;}
function candles(b,p=PARAM){const out=[];
 for(let i=Math.max(p.trendDays+15,b.length-p.signalAge-1);i<b.length;i++){
  const z=b[i],prior=b.slice(0,i),history=prior.slice(-p.trendDays),atr=U.atr(prior),g=U.geometry(z),move=history.at(-1).close-history[0].close,threshold=Math.max(U.tick(z.close),(atr||0)*p.trendATR),trend=move>threshold?'UP':move< -threshold?'DOWN':'FLAT';
  const small=g.range>=2*g.tickSize&&g.bodyRatio<=p.bodyMax,lower=small&&g.lower>=p.wickBody*Math.max(g.body,g.tickSize)&&g.upper/g.range<=p.shortWickMax,upper=small&&g.upper>=p.wickBody*Math.max(g.body,g.tickSize)&&g.lower/g.range<=p.shortWickMax;
  if(!lower&&!upper)continue;
  const type=lower?(trend==='DOWN'?'HAMMER':trend==='UP'?'HANGING_MAN':'LOWER_WICK'):(trend==='UP'?'SHOOTING_STAR':trend==='DOWN'?'INVERTED_HAMMER':'UPPER_WICK'),bias=trend==='FLAT'?'NEUTRAL':trend==='DOWN'?'BULLISH':'BEARISH',levelType=bias==='BULLISH'?'LOW':'HIGH',tol=Math.max(g.tickSize,(atr||0)*p.nearATR);
  const refs=knownLevels(prior).filter(x=>x.type===levelType&&Math.abs((levelType==='LOW'?z.low:z.high)-x.price)<=tol),next=b[i+1];
  let status='PENDING',knownAt=null;
  if(next&&bias!=='NEUTRAL'){if(bias==='BULLISH'?next.close>z.high:next.close<z.low){status='CONFIRMED';knownAt=next.date;}else if(bias==='BULLISH'?next.close<z.low:next.close>z.high){status='INVALIDATED';knownAt=next.date;}else if(b.length-1-i>=p.signalAge)status='EXPIRED';}
  if(status==='CONFIRMED'&&b.slice(i+2).some(x=>bias==='BULLISH'?x.close<z.low:x.close>z.high))status='INVALIDATED';
  const label={HAMMER:'下跌後的錘子線',SHOOTING_STAR:'上漲後的流星線',HANGING_MAN:'上漲後長下影，先留意風險',INVERTED_HAMMER:'下跌後長上影，止跌仍待確認',LOWER_WICK:'盤整中的長下影',UPPER_WICK:'盤整中的長上影'}[type];
  out.push({type,label,bias,eventDate:z.date,eventIndex:i,knownAt,status,positionConfirmed:refs.length>0,references:refs,high:z.high,low:z.low,geometry:g,priorTrend:trend,confirmationRule:bias==='BULLISH'?`下一個交易日收盤高過${money(z.high)}才算價格確認`:bias==='BEARISH'?`下一個交易日收盤低於${money(z.low)}才算轉弱確認`:'盤整位置不明，不能只靠形狀判多空',note:'紅綠不決定方向；位置與後續收盤才是判讀依據，單根影線不能辨認主力意圖'});
 }
 return out;
}
function direction(b){const f=U.features(b),z=b.at(-1),prev=b.at(-2),m20=f.ma[20],m60=f.ma[60];let code='SIDEWAYS',label='多空拉鋸，方向還不清楚';
 if(z.close>m20.value&&m20.value>m60.value&&m20.slope>0){code='BULL';label='偏多，價格與均價方向一致';}
 else if(z.close<m20.value&&z.close>m60.value&&m60.slope>0){code='PULLBACK';label='中期偏多，短線正在回落';}
 else if(z.close<m20.value&&z.close<m60.value){code=z.close>prev.close?'REBOUND':'BEAR';label=code==='REBOUND'?'短線反彈，仍在兩條均價下方':m20.slope<0?'偏空，價格在下彎均價下方':'價格偏弱，低於20日與60日均價';}
 else if(z.close>m20.value&&m20.value<m60.value){code='REBOUND';label='正在反彈，尚未轉成穩定多頭';}
 return {code,label,close:z.close,ma20:m20.value,ma60:m60.value,ma20Slope:m20.slope,reason:`收盤${money(z.close)}；20日均價${money(m20.value)}${m20.slope>0?'上彎':m20.slope<0?'下彎':'走平'}；60日均價${money(m60.value)}。`};
}
function evaluate(input,options={}){
 if(options.enabled===false)return U.freeze({version:VERSION,state:'DISABLED',entry:'DATA',label:'進場二次檢查已關閉',signals:[],candles:[]});
 const r=U.normalizeInput(input),v=U.validate(r),p={...PARAM,...options.parameters};
 if(!Number.isInteger(p.trendDays)||p.trendDays<3||p.trendDays>20||!Number.isInteger(p.signalAge)||p.signalAge<1||p.signalAge>10||!['bodyMax','wickBody','shortWickMax','trendATR','nearATR'].every(k=>Number.isFinite(p[k])&&p[k]>0)||p.bodyMax>=.5||p.shortWickMax>=.5||p.wickBody<1)return U.freeze({version:VERSION,state:'DATA_INSUFFICIENT',entry:'DATA',label:LABELS.DATA,reason:'影線研究參數無效',signals:[],candles:[]});
 if(!v.ok||v.bars.length<63)return U.freeze({version:VERSION,state:'DATA_INSUFFICIENT',entry:'DATA',label:LABELS.DATA,reason:v.reason||'至少需要63根完成日K',signals:[],candles:[]});
 const b=v.bars,z=b.at(-1),prior=b.slice(0,-1),u=options.unified,context=u?.structureContext||S.evaluate(b,r),vol=context.volume,dir=direction(b),events=candles(b,p),fresh=events.filter(x=>b.length-1-x.eventIndex<=p.signalAge),refs=knownLevels(prior),atr=U.atr(prior),buffer=Math.max(U.tick(z.close),(atr||0)*S.PARAM.breakATR),signals=[];
 const high=Math.max(...prior.slice(-20).map(x=>x.high)),low=Math.min(...prior.slice(-20).map(x=>x.low)),event=context.breakoutEvent;
 const add=(code,condition,label,explanation)=>{if(condition)signals.push({code,label,explanation});};
 add('SUPPORT_BROKEN',z.close<low-buffer||context.pullback.status==='INVALIDATED','已收盤跌破既有防守或前低','原本觀察的支撐沒有守住，先重查買進理由。');
 add('FAILED_RETEST',event?.status==='INVALIDATED','先前突破後又跌回去','不是正常回測已確認；不能直接當成加碼機會。');
 add('INTRADAY_REJECTION',z.high>high&&z.close<=high,'盤中漲過前高，收盤卻退回','只是盤中嘗試，尚不是站穩突破。');
 add('BREAKOUT',context.breakout.status==='CONFIRMED','放量收盤越過前高','價格與研究量能條件通過；還要看最近壓力與買進風險。');
 add('RETEST',event?.status==='RETEST_HELD','突破後回來測試，暫時守住','有回測紀錄才討論守穩；是否能新買仍看成本後風險。');
 add('BOX',u?.scenarios?.find(x=>x.id==='BOX')?.applicable&&context.breakout.status!=='CONFIRMED','在整理區內來回','上下都還有關卡，先等方向，不把盤整當成買點。');
 for(const pattern of context.patterns||[])add(pattern.type,pattern.status==='CONFIRMED'||pattern.status==='BREAKDOWN_OBSERVED',pattern.label,pattern.status==='BREAKDOWN_OBSERVED'?'已向下跌破，不能因圖形名稱而偏多。':'只確認符合已定義的圖形，仍需獨立檢查進場風險。');
 function observation(type){const candidates=refs.filter(x=>x.type===type&&(type==='LOW'?x.price<=z.close:x.price>=z.close)).sort((a,c)=>Math.abs(a.price-z.close)-Math.abs(c.price-z.close)),reference=candidates[0];if(!reference)return null;const tol=Math.max(U.tick(z.close),(atr||0)*p.nearATR),dates=[];let last=-3;for(let i=Math.max(0,b.length-21);i<b.length-1;i++){const x=b[i],touch=Math.abs((type==='LOW'?x.low:x.high)-reference.price)<=tol;if(touch&&i-last>=2){dates.push(x.date);last=i;}}return {price:reference.price,knownAt:reference.knownAt,testDates:dates,nearNow:Math.abs((type==='LOW'?z.low:z.high)-reference.price)<=tol,source:reference.source};}
 const supportObservation=observation('LOW'),resistanceObservation=observation('HIGH');
 add('SUPPORT_TEST',supportObservation?.nearNow&&supportObservation.testDates.length>=2,'多次回到低點附近，暫未收盤跌破','只是支撐測試觀察，不等於可直接買進或加碼。');
 add('RESISTANCE_TEST',resistanceObservation?.nearNow&&resistanceObservation.testDates.length>=2,'多次接近上方關卡，還沒跨過','先等真正收盤越過，不因測試次數多就保證會突破。');
 const bear=fresh.find(x=>x.bias==='BEARISH'&&x.status==='CONFIRMED'),warning=fresh.find(x=>x.bias==='BEARISH'&&x.status==='PENDING'),bull=fresh.find(x=>x.bias==='BULLISH'&&x.status==='CONFIRMED');
 const blockers=[];if(['BEAR','REBOUND','SIDEWAYS'].includes(dir.code))blockers.push('目前不是已轉強的多方趨勢');if(bear)blockers.push(bear.label+'已出現後續轉弱收盤');if(signals.some(x=>['SUPPORT_BROKEN','FAILED_RETEST'].includes(x.code)))blockers.push('既有支撐或突破情境已失效');
 if(u?.entryDecision==='DO_NOT_ENTER')blockers.push('原有進場風險檢查未通過');
 const missing=[];if(!v.basisVerified)missing.push('價格計算方式');if(!v.calendarVerified)missing.push('有無漏掉交易日');if(!vol.usable)missing.push('交易量來源與單位');if(r.tickRuleVerified===false||r.tickRuleVerified!==true&&!['COMMON','COMMON_STOCK','ORDINARY'].includes(String(r.securityType||'')))missing.push('股票每次可跳動的價格');if(u?.state!=='RESEARCH_ONLY')missing.push('完整的情境與成本後風險檢查');
 const good=u?.scenarios?.filter(x=>x.applicable!==false&&x.signalStatus==='CONFIRMED'&&x.riskDecision==='ACCEPTABLE_FOR_EVALUATION'&&x.riskReward?.status==='KNOWN')||[];
 let entry=missing.length?'DATA':blockers.length?'AVOID':warning||!good.length||u.entryDecision!=='CONDITIONAL_ENTRY'?'WAIT':'EVALUATE';
 let why=entry==='EVALUATE'?'多方方向、價格確認與原有成本後風險均通過，仍須按實際成交價重算。':'尚無同時通過價格與風險確認的買法，先等。';
 if(missing.length)why='先補核：'+missing.join('、')+'。';else if(blockers.length)why=blockers[0]+'。';else if(warning)why='出現上漲後的風險影線，先等下一根收盤確認。';
 const nearest=u?.chart?.nextResistance||null;
 return U.freeze({version:VERSION,state:'RESEARCH_ONLY',code:r.stock,date:z.date,direction:dir,entry,label:LABELS[entry],reason:why,blockers,missing,signals,supportObservation,resistanceObservation,candles:events,bullishCandle:bull||null,bearishCandle:bear||null,pendingBearishCandle:warning||null,nearestResistance:nearest,knownLevels:refs,parameters:p,conditionalScenarios:good.map(x=>x.id),filterScope:'本次已取得的個股與原策略候選之多方進場二次篩選，非全市場績效認證',performanceValidated:false,affectsOriginalScore:false,affectsOriginalRanking:false});
}
function select(analyses,mode='EVALUATE'){return analyses.map((analysis,index)=>({analysis,index})).filter(x=>mode==='ALL'||(x.analysis.entryDirection?.entry||'DATA')===mode);}
function counts(analyses){const out={ALL:analyses.length,EVALUATE:0,WAIT:0,AVOID:0,DATA:0};for(const a of analyses)out[a.entryDirection?.entry||'DATA']++;return out;}
function fields(a){const d=a.entryDirection;if(d?.state!=='RESEARCH_ONLY')return [];
 return [{title:'多空方向與現在能不能買',value:`方向：${d.direction.label}。${d.direction.reason}\n現在：${d.label}。${d.reason}${a.unifiedResearch?.stage==='BULL_START'?'\n原模型的「多頭起漲」只表示初步條件，現在能不能買仍要通過上面的方向與風險檢查。':''}\n走勢偏多不代表現在就划算；偏空也不是要求放空。`},
 {title:'這檔K線在說什麼',value:d.candles.map(x=>`${x.eventDate} ${x.label}：${({CONFIRMED:'後續收盤已確認',INVALIDATED:'這個形狀的理由已被破壞',PENDING:'還要等後續收盤',EXPIRED:'沒有按時確認，先不採用'})[x.status]}。\n${x.confirmationRule}。${x.positionConfirmed?'附近有當時已知的高低點參考：'+x.references.map(y=>money(y.price)).join('、'):'附近沒有可核驗的對應支撐／壓力，不能只靠形狀加分'}。`).join('\n\n')||'最近沒有符合定義的特殊影線，不硬套錘子線或流星線。'},
 {title:'支撐壓力與進場步驟',value:(d.signals.map(x=>x.label+'：'+x.explanation).join('\n')||'目前沒有已確認的新突破／回測事件，先看最近的支撐壓力。')+'\n順序：先看方向→再等收盤確認→檢查最近壓力與防守→最後重算買進成本。回測守住不是自動加碼；加碼還要重算整體部位風險。'},
 {title:'空手與持股要分開看',value:d.entry==='AVOID'?'空手：先不依此新買。已持股：檢查原先防守與減碼計畫；影線或偏空提醒不等於系統已替你賣出。':'空手：確認方向、收盤與風險條件後再評估。已持股：回測守住不是自動加碼，還要看原本成本與整體可承受損失。'},
 {title:'影線參數白話說明',value:`實體是開盤到收盤的距離；上影是衝高後退回，下影是下探後拉回。此研究把實體不超過當日高低差${Math.round(d.parameters.bodyMax*100)}%、長影至少為實體${d.parameters.wickBody}倍、另一邊影線不超過${Math.round(d.parameters.shortWickMax*100)}%作為形狀門檻。\n先看前${d.parameters.trendDays}個交易日首尾收盤，變動超過平均波動的${d.parameters.trendATR}倍才暫認為有方向；離先前高低點不超過平均波動的${d.parameters.nearATR}倍才列為附近參考。影線最多觀察${d.parameters.signalAge}個交易日，不無限延後確認。錘子線要出現在下跌後，流星線要出現在上漲後；紅綠都可能出現。下一個交易日收盤越過訊號高點／低點才算價格確認，沒有保證勝率。`}];
}
return Object.freeze({VERSION,PARAM,LABELS,knownLevels,candles,direction,evaluate,select,counts,fields});
});
