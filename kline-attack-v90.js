/* Read-only, completed-bar evidence. Pattern thresholds are proposed research rules,
 * never eligibility, scores, orders, holdings or a claim of improved performance. */
(function(r,f){const N=typeof module==='object'&&module.exports,a=f(N?require('./price-action-context-v1.js'):r.ShitouPriceActionV1,N?require('./indicator-shadow-v1.js'):r.ShitouIndicatorShadowCore);if(N)module.exports=a;else r.ShitouKlineAttack=a;})(globalThis,function(P,I){
'use strict';
const VERSION='KLINE_ATTACK_RESEARCH_1',RULE=Object.freeze({version:VERSION,approval:'RESEARCH_PROPOSED',researchOnly:true,affectsOriginalScore:false,affectsOriginalRanking:false,affectsOriginalEligibility:false,trendSessions:5,smallBodyShare:.35,dojiShare:.10,wickBody:2,oppositeWickShare:.10,longBodyShare:.55,starBodyRatio:.5,confirmationSessions:3});
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const fmt=(v,type='stock')=>num(v)===null?'未取得':type==='index'?v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):v.toFixed(2);
function validate(report,{asOf=report?.marketDate||report?.closeDate||report?.dataDate,minBars=2,code=report?.stock||report?.code,type=report?.type||'stock',quote}={}){
 const fail=reason=>({ok:false,reason});asOf=I.date(asOf);
 if(!report||!asOf||!code||String(code)!==String(report.stock||report.code)||!['stock','index'].includes(type))return fail('代號、類型或行情日期尚未核對');
 if(!(report.completed===true||report.isComplete===true||report.dataTiming==='POST_CLOSE_ONLY')||report.completed===false||report.isComplete===false)return fail('這一天尚未確認收盤，先不計算');
 if([report.marketDate,report.closeDate,report.dataDate].some(d=>d&&I.date(d)!==asOf))return fail('行情日期不一致，請重新查詢');
 if(report.canonicalError||report.corporateActionUnresolved===true||report.priceAdjustmentConsistent===false)return fail(report.canonicalError||'除權息或價格口徑仍待核對');
 const rows=report.canonicalBars?.length?report.canonicalBars:report.dailySeries,c=I.normalize(rows,asOf);
 if(!c.ok)return fail(c.reason);if(c.bars.length<minBars)return fail(`完成日K只有${c.bars.length}根，需要至少${minBars}根`);
 if(rows.some(b=>b.stock&&String(b.stock)!==String(code)||b.code&&String(b.code)!==String(code)||b.market&&report.market&&b.market!==report.market))return fail('日K混入其他代號或市場');
 if(report.canonicalBars?.length&&report.dailySeries?.length){const d=I.normalize(report.dailySeries,asOf);if(!d.ok||I.fingerprint(c.bars)!==I.fingerprint(d.bars))return fail('兩份日K不是同一批資料');}
 const basis=report.priceAdjustment?.basis;if(report.priceAdjustment?.verified!==true||!basis)return fail('價格調整方式還沒核對完成');
 if(rows.some(b=>b.priceAdjustmentBasis&&b.priceAdjustmentBasis!==basis))return fail('歷史價格口徑不同，這次不混算');
 const unit=report.volumeUnit||report.dailySeriesMeta?.volumeUnit;
 if(!unit||rows.some(b=>b.volumeUnit&&b.volumeUnit!==unit)||type==='stock'&&!['shares','股'].includes(unit))return fail('成交量單位還沒核對完成');
 const dates=report.expectedTradingDates;if(!Array.isArray(dates)||!dates.length)return fail('缺少已核對的交易日曆');
 const ds=dates.map(I.date),actual=new Set(c.bars.map(b=>b.date));
 if(ds.some((d,i)=>!d||i&&d<=ds[i-1])||c.bars.some(b=>!ds.includes(b.date))||ds.some(d=>d>=c.bars[0].date&&d<=asOf&&!actual.has(d)))return fail('交易日或停牌資料有缺口，先不跨過缺口計算');
 if(c.bars.some(b=>b.volume<=0))return fail('歷史含未成交或零量日，這次不跨過去計算');
 const last=c.bars.at(-1);if(num(report.close)===null||report.close!==last.close)return fail('報告收盤和日K收盤不同');
 if(quote&&(String(quote.code||quote.stock||code)!==String(code)||quote.market!==report.market||I.date(quote.quoteDate)!==asOf||['open','high','low','close','volume'].some(k=>quote[k]!==last[k])||quote.priceAdjustmentBasis&&quote.priceAdjustmentBasis!==basis))return fail('市場快照和完成日K的代號、日期、價量或口徑不同');
 return {ok:true,asOf,code:String(code),type,bars:c.bars,historyFingerprint:I.fingerprint(c.bars),basis,volumeUnit:unit};
}
function candle(b,prev){const c=P.candle(b),range=c.range,body=c.body;return {...c,direction:b.close>b.open?'UP':b.close<b.open?'DOWN':'FLAT',bodyShare:range?body/range:null,upperShare:range?c.upper/range:null,lowerShare:range?c.lower/range:null,position:range?(b.close-b.low)/range:null,previousBodyMid:prev?(prev.open+prev.close)/2:null,brokePreviousHigh:prev?b.high>prev.high:null,brokePreviousLow:prev?b.low<prev.low:null,touchedBoth:prev?b.high>=prev.high&&b.low<=prev.low:null,closedAbovePreviousHigh:prev?b.close>prev.high:null,closedBelowPreviousLow:prev?b.close<prev.low:null,previousBodyRecovery:prev&&prev.close<prev.open?(b.close-prev.close)/(prev.open-prev.close):null,previousBodyRetracement:prev&&prev.close>prev.open?(prev.close-b.close)/(prev.close-prev.open):null};}
function trend(bars,i){if(i<RULE.trendSessions)return 'UNKNOWN';const prior=bars.slice(i-RULE.trendSessions,i),delta=prior.at(-1).close-prior[0].close;return delta>0?'UP':delta<0?'DOWN':'RANGE';}
const NAMES={HAMMER:'下跌後，下影線較長',INVERTED_HAMMER:'下跌後，上影線較長',SHOOTING_STAR:'上漲後，上影線較長',DOJI:'開收接近，方向還不明',BULL_ENGULF:'今日上漲實體包住昨日下跌實體',BEAR_ENGULF:'今日下跌實體包住昨日上漲實體',DARK_CLOUD:'漲後回吐超過昨日實體一半',PIERCING:'跌後收復超過昨日實體一半',MORNING_STAR:'下跌後，三根K線出現回升線索'};
function patternsAt(bars,i,{variant='STRICT'}={}){
 const b=bars[i],a=bars[i-1],z=bars[i-2],c=candle(b,a),t=trend(bars,i),out=[];
 if(!a||!(c.range>0))return out;
 const ac=candle(a),up=b.close>b.open,down=b.close<b.open,au=a.close>a.open,ad=a.close<a.open;
 const add=(kind,direction,first=i)=>{const block=bars.slice(first,i+1);out.push({kind,label:NAMES[kind],variant,ruleVersion:VERSION,ruleApproval:RULE.approval,researchOnly:true,direction,signalDate:b.date,availableAt:b.date,trigger:direction==='UP'?Math.max(...block.map(x=>x.high)):direction==='DOWN'?Math.min(...block.map(x=>x.low)):null,invalidation:direction==='UP'?Math.min(...block.map(x=>x.low)):direction==='DOWN'?Math.max(...block.map(x=>x.high)):null,signalIndex:i,state:'WAITING',stateLabel:'研究候選，等後續收盤確認'});};
 if(c.bodyShare<=RULE.dojiShare)add('DOJI','NEUTRAL');
 const small=c.body>0&&c.bodyShare<=RULE.smallBodyShare;
 if(small&&c.lower>=RULE.wickBody*c.body&&c.upperShare<=RULE.oppositeWickShare&&t==='DOWN')add('HAMMER','UP');
 if(small&&c.upper>=RULE.wickBody*c.body&&c.lowerShare<=RULE.oppositeWickShare){if(t==='DOWN')add('INVERTED_HAMMER','UP');if(t==='UP')add('SHOOTING_STAR','DOWN');}
 if(up&&ad&&b.open<=a.close&&b.close>=a.open&&(b.open<a.close||b.close>a.open))add('BULL_ENGULF','UP',i-1);
 if(down&&au&&b.open>=a.close&&b.close<=a.open&&(b.open>a.close||b.close<a.open))add('BEAR_ENGULF','DOWN',i-1);
 if(t==='UP'&&au&&down&&(variant==='STRICT'?b.open>a.high:b.open>=a.close)&&b.close<(a.open+a.close)/2&&b.close>a.open)add('DARK_CLOUD','DOWN',i-1);
 if(t==='DOWN'&&ad&&up&&(variant==='STRICT'?b.open<a.low:b.open<=a.close)&&b.close>(a.open+a.close)/2&&b.close<a.open)add('PIERCING','UP',i-1);
 if(z&&trend(bars,i-2)==='DOWN'&&z.close<z.open&&candle(z).bodyShare>=RULE.longBodyShare&&ac.body<=candle(z).body*RULE.starBodyRatio&&ac.bodyShare<=RULE.smallBodyShare&&up&&b.close>(z.open+z.close)/2&&(variant==='STRICT'?Math.max(a.open,a.close)<z.close&&b.open>Math.max(a.open,a.close):true))add('MORNING_STAR','UP',i-2);
 return out;
}
function follow(bars,event){const e={...event,confirmedAt:null,failedAt:null};if(e.direction==='NEUTRAL'){e.state='WAITING';return e;}
 for(let j=e.signalIndex+1;j<bars.length;j++){const b=bars[j],invalid=e.direction==='UP'?b.close<e.invalidation:b.close>e.invalidation,confirm=e.direction==='UP'?b.close>e.trigger:b.close<e.trigger;
  if(invalid){e.state='INVALID';e.stateLabel='原本的型態已失效';e.failedAt=b.date;break;}
  if(e.confirmedAt)continue;
  if(confirm){e.state=e.direction==='UP'?'CONFIRMED_UP':'CONFIRMED_DOWN';e.stateLabel=e.direction==='UP'?'後續收盤已向上確認':'後續收盤已向下確認';e.confirmedAt=b.date;}
  else if(j-e.signalIndex>=RULE.confirmationSessions){e.state='EXPIRED';e.stateLabel='等待已超過3個交易日，這次不追認';break;}
 }return e;
}
function evaluate(report,options={}){const v=validate(report,options),base={version:VERSION,rule:RULE,type:options.type||report?.type||'stock',code:String(options.code||report?.stock||report?.code||''),date:options.asOf||report?.marketDate||report?.closeDate||report?.dataDate||null,researchOnly:true,affectsOriginalScore:false,affectsOriginalRanking:false,affectsOriginalEligibility:false};
 if(!v.ok)return freeze({...base,state:'DATA_INSUFFICIENT',reason:v.reason,lines:['K線攻防：資料還沒核對齊。',v.reason,'先照原風險計畫處理，這次不補猜價位。']});
 const b=v.bars,last=b.at(-1),prev=b.at(-2),c=candle(last,prev),t=trend(b,b.length-1),struct=b.length>=26?P.structure(b.slice(0,-1),last):null;
 const unit=v.type==='index'?'點':'元',p=x=>fmt(x,v.type)+unit,events=[];
 for(let i=Math.max(1,b.length-10);i<b.length;i++)for(const e of patternsAt(b,i))events.push(follow(b,e));
 const simplified=[];for(const e of patternsAt(b,b.length-1,{variant:'SIMPLIFIED'}))if(!events.some(s=>s.signalDate===e.signalDate&&s.kind===e.kind))simplified.push(e);
 const state=c.touchedBoth?'雙邊震盪':c.closedAbovePreviousHigh?'收盤已站上昨日高點':c.brokePreviousHigh?'盤中越過昨日高點，收盤沒守住':c.closedBelowPreviousLow?'收盤已跌破昨日低點':c.longUpper?'上影較長，上方有壓力':c.longLower?'下影較長，低處有收復':'收盤仍在昨日範圍內';
 const active=events.filter(e=>!['INVALID','EXPIRED'].includes(e.state)),latest=active.filter(e=>e.signalDate===last.date),lines=[`K線攻防：${state}。`,`前一交易日 ${prev.date}：高點 ${p(prev.high)}／低點 ${p(prev.low)}。`,`前根開收中間價 ${p(c.previousBodyMid)}，只是比較用。`,`近5個交易日：${{UP:'向上',DOWN:'向下',RANGE:'橫向整理',UNKNOWN:'資料還不夠'}[t]}；不等於整段趨勢已反轉。`];
 if(c.touchedBoth)lines.push('昨日高低點都被碰到；只看日K，無法知道先漲還是先跌。');
 if(latest.length)for(const e of latest.slice(0,2))lines.push(`研究候選：${e.label}；${e.stateLabel}。${e.trigger===null?'':`之後收盤${e.direction==='UP'?'高於':'低於'} ${p(e.trigger)}才確認；${e.direction==='UP'?'跌破':'站回'} ${p(e.invalidation)}則失效。`}`);
 else lines.push('本日未發現明確型態；不用勉強替K線取名字。');
 if(struct){lines.push(`前20根高低範圍：${p(struct.low)}～${p(struct.high)}；和昨日高低點分開看。`);}
 for(const e of active.filter(e=>e.confirmedAt).slice(-1))lines.push(`先前線索：${e.label}，${e.confirmedAt}收盤確認；仍要核對原本條件。`);
 lines.push(v.type==='index'?'先看大盤有沒有轉強，再核對每檔股票；大盤點位不是個股買賣價。':'還沒買：先等原條件通過。已持有：原停損與部位計畫優先。','型態與參考價只幫助觀察；沒有證據保證明天上漲或下跌。');
 return freeze({...base,state:'AVAILABLE',date:v.asOf,historyFingerprint:v.historyFingerprint,sourceFingerprint:report.sourceSnapshotId||report.observationBasis?.fingerprint||report.dailyBasisV2?.fingerprint||null,priceBasis:v.basis,volumeUnit:v.volumeUnit,close:last.close,canonicalBars:clone(b),candle:c,trend:t,context:struct,events,simplifiedResearch:simplified,status:state,levels:{previousDate:prev.date,previousHigh:prev.high,previousLow:prev.low,previousBodyMid:c.previousBodyMid,swingHigh:struct?.high??null,swingLow:struct?.low??null},lines});
}
return Object.freeze({VERSION,RULE,NAMES,validate,candle,patternsAt,follow,evaluate,fmt,freeze});
});
