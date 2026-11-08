/* Stock-only beginner view. All decisions and prices come from the existing engines. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(root,node?require('./elliott-wave-visual-v1'):root.ShitouElliottVisual);if(node)module.exports=api;else root.ShitouWaveStockBeginner=api;})(globalThis,function(root,V){
'use strict';
const VERSION='STOCK_WAVE_BEGINNER_3',W=1284,H=2778,P=V.PHONE_PALETTE;
const positive=n=>Number.isFinite(n)&&n>0,fmt=n=>positive(n)?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'這次未提供';
const captions={ORIGINAL_B:'原突破',ORIGINAL_C:'原回檔',ORIGINAL_A:'原失效',MA20:'20日均價',DAY_HIGH:'當日高點',WATCH_ONLY:'新買觀察',LATEST_CLOSE:'收盤',DAY_LOW_WARNING:'當日低點'};
// Exact values only: equal-looking rounded prices and different trading ticks stay separate.
function groupPrices(levels){
 const groups=[];
 for(const level of levels.filter(l=>positive(l.price))){const member={...level},old=groups.find(g=>g.price===level.price);if(old)old.members.push(member);else groups.push({...level,members:[member]});}
 return groups.map(g=>({...g,label:g.members.length>3?'同價：'+g.members.length+'項參考':[...new Set(g.members.map(l=>captions[l.role]||l.label))].join('／'),lineMode:g.members.some(l=>l.lineMode!=='ENDPOINT')?'FULL':'ENDPOINT',sourceLabel:g.members.map(l=>l.sourceLabel||l.label).join('／')}));
}
function watchSentence(close,watch){
 if(!positive(watch))return {relation:'UNAVAILABLE',text:'新買觀察價尚未提供，先等原條件齊全。'};
 const relation=close<watch?'BELOW':close>watch?'ABOVE':'AT';
 return {relation,text:'新買觀察'+fmt(watch)+'元：'+(relation==='BELOW'?'先等收盤站回，再看能否守穩。':relation==='AT'?'收盤剛好在這裡，還要看後續能否守穩。':'收盤已在上方，仍要看後續能否守穩。')};
}
function reasonFor(plan,analysis,m,ready){
 const all=plan?.dataIssues||[],issue=all[0],names={PRICE:'歷史價格還沒核對完整。',CALENDAR:'交易日期還沒核對完整，需確認是否缺日。',VOLUME_CONFLICT:'不同來源的成交量不一致，需先比對。',VOLUME:'成交量的來源或單位還沒核對完整。',TICK:'每次報價能跳多少錢，還沒核對。',SERVICE:'補充行情暫時未取得，稍後可重試。'};
 const source=issue?.reason||plan?.reason||analysis?.limitedHistory?.explanation||m.dataReason||analysis?.reason||'';
 if(issue?.code==='HISTORY'){const n=analysis?.limitedHistory?.consecutiveBars??analysis?.validation?.historyBarCount;return {code:'HISTORY',text:Number.isFinite(n)?'目前有'+n+'根可用日線，尚未達原策略要求。':'可用的完整日線不足，暫不做完整買進判斷。',source,issues:all};}
 if(ready&&!plan)return {code:'PLAN_UNAVAILABLE',text:'這次尚未取得同檔、同日的可用買進判斷。',source,issues:all};
 if(names[issue?.code])return {code:issue.code,text:names[issue.code],source,issues:all};
 if(!ready&&analysis?.limitedHistory){const n=analysis.limitedHistory.consecutiveBars;return {code:'LIMITED_HISTORY',text:Number.isFinite(n)?'已核對'+n+'根連續日線，完整策略條件仍不足。':'行情已核對，但完整策略條件仍不足。',source,issues:all};}
 if(!ready)return {code:'QUOTE_OR_HISTORY',text:/日期|不同日|STALE/.test(source)?'行情日期尚未對齊，請重新查詢。':/價格|除權|基準/.test(source)?'歷史價格或調整基準尚未核對。':/量|volume/i.test(source)?'成交量資料尚未通過核對。':'完整日線尚未通過核對，這次不猜買價。',source,issues:all};
 if(plan?.state==='DATA'||all.length)return {code:issue?.code||'PLAN_DATA',text:/[\u3400-\u9fff]/u.test(source)?source.slice(0,42)+(source.length>42?'…':''):'買進判斷仍缺必要資料，詳見文字報告。',source,issues:all};
 if(/失效|沒有守住|沒守住|買進理由/.test(source))return {code:'FAILED_SETUP',text:'原本的買進理由已失效，先等新結構。',source,issues:all};
 if(!positive(plan?.target))return {code:'UPPER_REFERENCE',text:'上方可核對的價位不足，暫不列買價。',source,issues:all};
 if(/太近|太大|不划算|風險較大/.test(source))return {code:'RISK_SPACE',text:'上方空間近，或買進後需承擔的風險太大。',source,issues:all};
 if(plan?.weak)return {code:'WEAK_SETUP',text:'原進場檢查仍判定偏弱，先等轉強。',source,issues:all};
 return {code:'WAIT_CONDITIONS',text:'原本的價格、量能或風險條件尚未通過。',source,issues:all};
}
function waveReading(m,quoteVerified=false){
 const wave=m.wave,last=wave.bars?.at(-1),primary=wave.primary,end=primary?.points?.at(-1),ready=wave.state!=='DATA_INSUFFICIENT'&&last?.date===m.date&&last?.close===m.close;
 const direction=m.currentDirection?.state,summary=direction==='DATA_INSUFFICIENT'?(quoteVerified?'行情已核對，完整判讀仍有資料限制':'行情尚未核對完整，先不判斷多空'):direction==='BULLISH'?'近期走勢偏強，買進條件仍要另外確認':direction==='UPTREND_PULLBACK'?'整體偏強，最近回落，留意能否守穩':direction==='DOWNTREND_REBOUND'?'整體仍偏弱，最近出現反彈':direction==='BEARISH'?'目前走勢偏弱，先觀察是否止跌':direction==='SHORT_BULLISH'?'最近有反彈，是否轉強仍要等確認':direction==='SHORT_BEARISH'?'最近往下回落，先看能否停住':direction==='RANGE'?m.currentDirection.recentDirection==='UP'?'短線有上漲，整體仍在來回波動':m.currentDirection.recentDirection==='DOWN'?'短線有回落，整體仍在來回波動':'目前來回整理，先等方向清楚':'漲跌線索不一致，先等方向清楚';
 let phase='目前看不出第幾浪，先看真實價格。',waveTitle='這次為什麼沒有浪號？',waveLines;
 if(!ready){phase='資料還不夠，這次先不標第幾浪。';waveLines=['完整行情尚未核對，這次先不標浪號。','先處理圖區說明的資料限制，再重新判讀。','不使用猜測或缺漏的價格補畫波浪。'];}
 else if(primary&&end){
  waveTitle='圖上的浪號，怎麼看？';const up=primary.direction==='UP',number=/^[1-5]$/.test(end.label),map=up?{'1':'可能在第1段上漲，還要等後續確認。','2':'可能在第2段回落，要再看能否守住。','3':'可能在第3段上漲，還要等價格確認。','4':'可能在第4段整理，還不能直接當成買點。','5':'可能在第5段上漲後段，先留意追高風險。'}:{'1':'可能在第1段下跌，先看能否停住。','2':'下跌後出現反彈，仍要等轉強確認。','3':'可能在第3段下跌，還不能確定已經跌完。','4':'可能在第4段反彈，還要看能否漲回關卡。','5':'可能在下跌後段，止跌仍要等價格確認。'};
  phase=number?map[end.label]:'可能在'+end.label+'段修正，仍要等價格確認。';
  if(m.currentDirection?.legDirection!=='UNKNOWN'&&m.currentDirection?.recentDirection!=='FLAT'&&m.currentDirection?.recentDirection!==m.currentDirection?.legDirection)phase=m.wavePosition.replace(/^波浪位置：/,'').replace(/浪/g,'段').replace(/候選/g,'仍在觀察');
  const definitions=up?{'1':'先上漲','2':'中間回落','3':'接續上漲','4':'再次整理','5':'上漲後段'}:{'1':'先下跌','2':'中間反彈','3':'接續下跌','4':'再次反彈','5':'下跌後段'};
  const shown=primary.points.filter(p=>/^[1-5]$/.test(p.label)).map(p=>p.label+'＝'+definitions[p.label]);
  waveLines=[number?(up?'上漲分段：':'下跌分段：')+shown.slice(-3).join('；')+'。':'A、B、C是修正分段，與原本ABC/N字不同。',!end.confirmedAt?end.label+'待確認：還不能確定這段已經結束。':wave.scaleDisagreement?'不同大小波段的看法不一致，先當觀察。':'實線確認高低點，數浪仍可能改變。','浪號用來理解走勢，不能單靠數字決定買賣。'];
 }else if(wave.historicalCounts?.length){waveTitle='圖上是過去的分段';phase='灰藍數字是過去走法，不能當目前位置。';waveLines=['灰藍數字只回顧過去，不能當目前第幾浪。','目前分段尚未確認，先等新的高低點。','先看真實價格、均價與原方法的條件。'];}
 else{if(wave.state==='RULE_VIOLATION')phase='這段走勢暫時不適用目前的數浪規則。';waveLines=[wave.state==='RULE_VIOLATION'?'這段走勢不符合目前採用的數浪規則。':'高低點還沒有形成清楚、可採用的排列。','這次先不標1～5，仍可觀察已核對的行情。','沒有浪號，並不是買進或賣出的訊號。'];}
 return {summary,phase,waveTitle,waveLines};
}
// Measurements for explanation only. Existing pivots, evidence and trade gates stay authoritative.
function retraceMeasure(start,end,current,direction,{unit='元',label='前波',estimated=false,source='CONFIRMED_SWING'}={}){
 const sign=direction==='UP'?1:direction==='DOWN'?-1:0,span=sign*(end?.price-start?.price),amount=sign*(end?.price-current?.price);
 if(!sign||![start?.price,end?.price,current?.price].every(positive)||![span,amount].every(Number.isFinite)||span<=0)return {status:'UNAVAILABLE',ratioPct:null,text:'回吐深度：沒有可靠的波段端點，這次先不算。'};
 const ratioPct=amount/span*100,pct=ratioPct.toFixed(1),verb=direction==='UP'?'漲':'跌',back=direction==='UP'?'退':'收回';
 const text=amount>span?label+'：前波'+verb+fmt(span)+unit+'已全'+(direction==='UP'?'退回，還跌過起點。':'收回，還漲過起點。'):amount<0?label+'：已'+(direction==='UP'?'超過前波高點，沒有回吐。':'低於前波低點，尚非反彈。'):label+(estimated?'暫估':'')+'：先'+verb+fmt(span)+unit+'，'+back+fmt(amount)+unit+'（'+pct+'%）。';
 return {status:amount<0?'EXTENDED':estimated?'ESTIMATED':'MEASURED',direction,source,start:{...start},end:{...end},current:{...current},span,amount,ratioPct,estimated,text,meaning:'百分比的分母是前一段漲跌幅，不是股價；不代表碰到比例就反轉。'};
}
function readingEvidence(m){
 const w=m.wave,bars=w.bars||[],last=bars.at(-1),unit=m.kind==='market'?'點':'元',p=w.primary,tail=p?.points?.at(-1),ready=w.state!=='DATA_INSUFFICIENT'&&last?.date===m.date&&last?.close===m.close;
 const empty={status:'UNAVAILABLE',ratioPct:null,text:'回吐深度：完整行情尚未核對，這次先不算。'};
 if(!ready)return {version:'WAVE_READING_EVIDENCE_1',depth:empty,checks:[],invalidation:null,lines:['資料不足，先不指定目前第幾浪。',empty.text,'已有線索：先保留已核對的原始行情。','仍缺確認：完整日K或資料來源核對。','數浪界線：資料未齊，這次不猜價。'],researchOnly:true,affectsOriginalEligibility:false};
 const right=w.parameters?.pivotRight??w.selectedScale?.pivotRight,left=w.parameters?.pivotLeft??w.selectedScale?.pivotLeft;
 const verified=(point,confirmed=true)=>{const r=bars[point?.index],key=point?.type==='HIGH'?'high':point?.type==='LOW'?'low':null;return !!r&&!!key&&r.date===point.pivotDate&&r[key]===point.price&&r.date<=m.date&&(!confirmed||Number.isInteger(right)&&right>0&&point.confirmedAt===bars[point.index+right]?.date&&point.confirmedAt<=m.date);};
 let depth=empty,a,z,c,direction=p?.direction,label,estimated=false,source;
 if(p&&tail){const stage=p.points.length-1;if(stage===2||stage===3){[a,z,c]=p.points.slice(0,3);label='第2段回檔';source='WAVE_2_OVER_WAVE_1';}else if(stage===4||stage===5){[a,z,c]=p.points.slice(2,5);label='第4段回檔';source='WAVE_4_OVER_WAVE_3';}else if(stage>=6){a=p.points[0];z=p.points[5];c=tail;label='五段後修正';source='CORRECTION_OVER_IMPULSE';}
  if(direction==='DOWN'&&label)label=label.replace('回檔','反彈');
  estimated=!!c&&!c.confirmedAt;
  if(a&&z&&c&&verified(a)&&verified(z)&&verified(c,!estimated))depth=retraceMeasure(a,z,c,direction,{unit,label,estimated,source});else depth={...empty,text:'回吐深度：波段端點尚未確認，這次先不算。'};
 }else if(Number.isInteger(right)&&right>0&&Number.isInteger(left)&&left>0){
  const E=typeof module==='object'&&module.exports?require('./elliott-wave-v1'):root.ShitouElliottWave,S=typeof module==='object'&&module.exports?require('./structure-context-v1'):root.ShitouStructureContext,clean=E.cleanPivots(S.pivots(bars,{pivotLeft:left,pivotRight:right}));
  if(clean.ok&&clean.points.length>=2){[a,z]=clean.points.slice(-2);direction=a.type==='LOW'?'UP':'DOWN';c={price:last.close,pivotDate:last.date,index:bars.length-1,type:'CLOSE',confirmedAt:last.date};if(verified(a)&&verified(z))depth=retraceMeasure(a,z,c,direction,{unit,label:direction==='UP'?'前波回吐':'前波反彈',source:'LATEST_CONFIRMED_SWING_TO_CLOSE'});}
  if(depth.status==='UNAVAILABLE')depth={...empty,text:'回吐深度：還沒有可核對的完整波段。'};
 }
 const checks=[],met=[],missing=[],add=(key,status,good,bad,unknown,value)=>{checks.push({key,status,value});(status==='MET'?met:missing).push(status==='MET'?good:status==='NOT_MET'?bad:unknown);};
 if(p){const e=p.evidence||{},first=p.points?.[1],up=p.direction==='UP';
  add('PRICE',verified(first)&&typeof e.breakPreviousExtreme==='boolean'?(e.breakPreviousExtreme?'MET':'NOT_MET'):'UNKNOWN',up?'收盤越過第1段高點':'收盤低於第1段低點',up?'收盤未過第1段高點':'收盤未破第1段低點','前段端點待確認',e.breakPreviousExtreme);
  const volumeKnown=Number.isFinite(e.volumeRatio5)&&e.volumeRatio5>0&&Number.isFinite(w.parameters?.volumeRatio5)&&typeof e.volumeIncreased==='boolean';
  add('VOLUME',volumeKnown?(e.volumeIncreased?'MET':'NOT_MET'):'UNKNOWN','量能達研究門檻','量能未達研究門檻','量能資料待核',volumeKnown?{ratio5:e.volumeRatio5,threshold:w.parameters.volumeRatio5}:null);
  add('MOMENTUM',typeof e.macdGrowing==='boolean'?(e.macdGrowing?'MET':'NOT_MET'):'UNKNOWN',up?'上漲動能增強':'下跌動能增強',up?'上漲動能未增強':'下跌動能未增強','動能資料待核',e.macdGrowing??null);
  if(e.divergence&&(e.divergence.rsi||e.divergence.macd||e.divergence.volume)){checks.push({key:'DIVERGENCE',status:'WARNING',value:{...e.divergence}});missing.unshift(up?'創高力道沒跟上':'創低力道減弱');}
  if(!tail.confirmedAt){checks.push({key:'TURN',status:'PENDING'});missing.push('最新轉折未確認');}
  if(p.rules?.wave3NotShortest==='PENDING'){checks.push({key:'WAVE3_LENGTH',status:'PENDING'});missing.push('第3段長度待驗證');}
 }else{met.push(m.close>w.trend?.ma20?'收盤在20日均線上方':m.close<w.trend?.ma20?'收盤在20日均線下方':'收盤接近20日均線');missing.push(w.state==='RULE_VIOLATION'?'目前數法未過規則':'尚無合理浪型');}
 const ref=p?.reference,refPoint=p?.points?.find(x=>x.pivotDate===ref?.date&&x.price===ref?.price),refOk=positive(ref?.price)&&verified(refPoint),stage=p?.points?.length-1;
 const invalidation=refOk?{...ref,direction:p.direction,trigger:stage>=6?(p.direction==='UP'?'CLOSE_AT_OR_ABOVE':'CLOSE_AT_OR_BELOW'):(p.direction==='UP'?'TOUCH_OR_BELOW':'TOUCH_OR_ABOVE'),personalStop:false}:null;
 const waveLine=p?(/^[1-5]$/.test(tail.label)?(p.direction==='UP'?'上漲數法：1、3、5上漲；2、4回落。':'下跌數法：1、3、5下跌；2、4反彈。'):'A、B、C是修正分段，與原N字ABC不同。'):w.historicalCounts?.length?'灰藍浪號只回顧過去，不代表目前位置。':'目前沒有合理浪號，先看已核對的行情。';
 const joined=(items,n=2)=>items.slice(0,n).join('、')+(items.length>n?'等':''),guard=invalidation?'數浪界線'+fmt(ref.price)+unit+'：'+(stage>=6?(p.direction==='UP'?'收盤站回':'收盤跌破'):(p.direction==='UP'?'碰到或跌破':'碰到或漲過'))+'要重看，非持股停損。':'數浪界線：目前沒有可用數法，先不猜價。';
 return {version:'WAVE_READING_EVIDENCE_1',depth,checks,invalidation,lines:[waveLine,depth.text,(p?'已有線索：':'已知行情：')+(met.length?joined(met):'目前尚無同向支持')+'。','仍缺確認：'+(missing.length?joined(missing):'仍要核對原買進條件')+'。',guard],researchOnly:true,affectsOriginalEligibility:false};
}
function model(m,analysis){
 const wave=m.wave,last=wave.bars?.at(-1),primary=wave.primary,end=primary?.points?.at(-1),ready=wave.state!=='DATA_INSUFFICIENT'&&last?.date===m.date&&last?.close===m.close;
 const candidate=analysis?.openingPlan,plan=ready&&candidate?.code===m.code&&candidate.date===m.date&&candidate.close===m.close?candidate:null;
 const limited=analysis?.limitedHistory,quoteVerified=limited?.verified===true&&limited.code===m.code&&limited.date===m.date&&limited.close===m.close;
 const direction=m.currentDirection?.state,{summary,phase,waveTitle,waveLines}=waveReading(m,quoteVerified);
 const issues=plan?.dataIssues?.length,range=plan?.entryRange,rangeValid=positive(range?.low)&&positive(range?.high)&&range.low<=range.high&&positive(plan?.stop)&&plan.stop<range.low&&positive(plan?.target)&&plan.target>range.high;
 const enabled=ready&&!issues&&plan?.state==='CONDITIONAL'&&!plan.weak&&rangeValid,watch=ready&&positive(plan?.watch)?plan.watch:null,stop=ready&&positive(plan?.stop)?plan.stop:null,target=ready&&positive(plan?.target)?plan.target:null,low=ready&&positive(last?.low)?last.low:null;
 const reason=reasonFor(plan,analysis,m,ready),observation=watchSentence(m.close,watch),oldPullback=positive(m.levels[1]?.price)?m.levels[1].price:null;
 const sourceNote=watch&&oldPullback&&watch!==oldPullback?'原回檔'+fmt(oldPullback)+'元與新買觀察'+fmt(watch)+'元，用途不同。':'觀察價不是買價，仍要核對價格、量能與原條件。';
 let entryState,answer,entryLines;
 if(!ready||!plan||plan.state==='DATA'||issues){entryState='DATA';answer=ready?'行情可閱讀，買進判斷仍有資料待核對。':quoteVerified?'可看已核對行情，完整買進判斷仍待補齊。':'行情尚未核對完整，這次先不判斷買價。';entryLines=[answer,'主要原因：'+reason.text+(reason.issues.length>1?'（另'+(reason.issues.length-1)+'項待核對）':''),'這次不列買價；可用參考價只供觀察。','等必要資料核對完成，再檢查原本進場條件。'];}
 else if(enabled){entryState='CONDITIONAL';answer='有條件可評估，仍要等開盤後確認。';entryLines=[answer,'可評估範圍：'+fmt(range.low)+'～'+fmt(range.high)+'元；超過上限不追。','先等觀察價'+fmt(watch)+'元回落守住，再確認轉強。','新買防守'+fmt(stop)+'元；上方觀察'+fmt(target)+'元，並非保證。'];}
 else{entryState=plan.state==='WAIT'?'WAIT':'NO_TRADE';answer=entryState==='WAIT'?'目前先等，買進條件還沒完成。':'現在先觀察，買進條件還沒通過。';entryLines=[answer,observation.text,'原因：'+reason.text,sourceNote];}
 const invalidation=ready&&positive(m.levels[2]?.price)?m.levels[2].price:null;
 const holdingTitle=!ready?'已經持有：先看原計畫，暫不新增價位':['BEARISH','SHORT_BEARISH','DOWNTREND_REBOUND'].includes(direction)?'已經持有：先檢查原持股理由與停損':'已經持有：留意回落，原停損計畫優先';
 const holdingLines=['已有停損計畫：核對原訂條件，依計畫處理。',!ready?'行情有資料限制，這次不新增持股警戒價。':invalidation?(m.close<invalidation?'收盤已低於原失效參考'+fmt(invalidation)+'元，需重看原分析。':'原失效參考'+fmt(invalidation)+'元：收盤跌破時重看原分析。'):low?'當日低點'+fmt(low)+'元：後續收盤跌破，要重新檢查風險。':'可用低點尚未核對，先不猜持股風險價。',enabled?'新買防守'+fmt(stop)+'元只適用這次新買計畫。':'目前未啟用新買計畫，不列新買停損試算。','圖上參考不是你的認賠價，須依買價與可承受虧損設定。'];
 const originalLevels=[0,1,2].map(i=>({label:['原方法：突破觀察','原方法：回檔觀察','原方法：結構失效'][i],price:positive(m.levels[i]?.price)?m.levels[i].price:null})),known=originalLevels.filter(l=>l.price!==null).length;
 let rawChartLevels=[];
 if(ready){rawChartLevels=(m.chartLevels||[]).filter(l=>l.role!=='LATEST_CLOSE'&&l.role!=='MA20').map(l=>({...l}));if(!known)rawChartLevels.push({role:'DAY_HIGH',label:'當日高點',price:last.high,color:P.amber,date:m.date,lineMode:'FULL'});if(watch&&plan.state!=='DATA'&&!issues)rawChartLevels.push({role:'WATCH_ONLY',label:'新買觀察',price:watch,color:P.teal,date:m.date,lineMode:'FULL'});rawChartLevels.push({role:'LATEST_CLOSE',label:'最新收盤',price:m.close,color:P.ink,date:m.date,lineMode:'ENDPOINT'});if(!known)rawChartLevels.push({role:'DAY_LOW_WARNING',label:'當日低點',price:low,color:P.bull,date:m.date,lineMode:'FULL'});rawChartLevels.push({role:'MA20',label:'20日均價',price:wave.trend?.ma20,color:P.blue,date:m.date,lineMode:'ENDPOINT'});}
 const chartLevels=groupPrices(rawChartLevels),originalTitle=known?'原方法的觀察價，各有用途':'原方法的三條價位：這次未提供';
 const reading=readingEvidence(m),compactEntryLines=enabled?[entryLines[0],entryLines[1],'觀察'+fmt(watch)+'元守穩再轉強；新買防守'+fmt(stop)+'元，上方'+fmt(target)+'元非保證。']:entryState==='DATA'?[entryLines[0],entryLines[1],'資料核對完成後，再檢查原本買進條件。']:[entryLines[0],entryLines[1],entryLines[2]];
 const compactHoldingLines=['原停損計畫優先，依原條件處理。',!ready?'行情仍待核對，這次不新增認賠價。':invalidation?(m.close<invalidation?'已低於原失效'+fmt(invalidation)+'元，重看原持股理由。':'原失效'+fmt(invalidation)+'元：收盤跌破要重看。'):low?'當日低點'+fmt(low)+'元：收盤跌破先檢查風險。':'可用低點未核對，先不猜持股風險價。','圖上參考不是你的停損；仍依成本與原計畫。'];
 return {reading,compactEntryLines,compactHoldingLines,version:VERSION,code:m.code,date:m.date,ready,quoteVerified,summary,phase,waveTitle,waveLines,entryTitle:'還沒買的人：現在可以買嗎？',entryState,entryEnabled:enabled,entryLines,holdingTitle,holdingLines,chartLevels,rawChartLevels,watch,watchRelation:observation.relation,reason,trialStop:stop,upperObservation:target,dayLow:low,entryRange:enabled?{...range}:null,planState:plan?.state||'DATA',personalStop:null,originalLevels,knownOriginalLevels:known,originalTitle,originalEmptyLines:['突破、回檔與結構失效參考，這次尚未提供。','先等原方法提供價位，不自己填入買賣數字。'],originalNote:known?'原方法參考、新買觀察與個人停損，請分開使用。':'沒有原方法價位，仍可觀察行情；目前不據此安排買賣。',sourcePlanVersion:plan?.version||null,researchOnly:true,affectsOriginalEligibility:false,affectsOriginalRanking:false};
}
function render(m,{document:doc=root.document,watermarked=false}={}){
 const b=m.beginner;if(!b||b.version!==VERSION)throw Error('個股白話版資料尚未準備完整');const c=doc.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),M=40,CW=W-80,boxes=[],textBoxes=[];
 const font=(size,bold)=>{x.font=`${bold?750:500} ${size}px "Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;x.textAlign='left';x.textBaseline='top';};
 const wrap=(s,width,size,bold)=>{font(size,bold);const lines=[];for(const p of String(s).split('\n')){let line='';for(const token of p.match(/\d{4}-\d{2}-\d{2}|\d+(?:,\d{3})*(?:\.\d+)?|[A-Za-z]+|[\s\S]/g)||[]){if(line&&x.measureText(line+token).width>width){lines.push(line);line=token;}else line+=token;}lines.push(line);}return lines;};
 const draw=(text,left,top,width,size=38,color=P.ink,bold=false)=>{const rows=wrap(text,width,size,bold),line=size+12;font(size,bold);x.fillStyle=color;for(let i=0;i<rows.length;i++){x.fillText(rows[i],left,top+i*line);textBoxes.push({text:rows[i],top:top+i*line,bottom:top+i*line+size,left,right:left+x.measureText(rows[i]).width,size});}return top+rows.length*line;};
 const card=(name,y,h,fill='#fff',border=P.border)=>{x.fillStyle=fill;x.strokeStyle=border;x.lineWidth=2;x.beginPath();x.roundRect(M,y,CW,h,25);x.fill();x.stroke();boxes.push({name,top:y,bottom:y+h});};
 const heading=(text,y,color=P.ink)=>{for(const size of [45,43,41,39])if(wrap(text,CW-68,size,true).length===1)return draw(text,M+34,y,CW-68,size,color,true);throw Error('個股白話標題超出範圍');};
 const body=(lines,y,bottom,{emphasis=false,color=P.ink}={})=>{for(const base of [40,38,36,34,32]){const sizes=lines.map((_,i)=>emphasis&&i===0?base+2:base),height=lines.reduce((n,t,i)=>n+wrap(t,CW-68,sizes[i],emphasis&&i===0).length*(sizes[i]+12)+(i?3:0),0);if(y+height>bottom)continue;let at=y;for(let i=0;i<lines.length;i++){at=draw(lines[i],M+34,at,CW-68,sizes[i],emphasis&&i===0?color:P.ink,emphasis&&i===0)+3;}return at;}throw Error('個股白話內文超出範圍：'+lines.join('／'));};
 x.fillStyle=P.canvas;x.fillRect(0,0,W,H);draw('石頭少爺・個股波浪分析',44,38,900,34,P.teal,true);draw(m.release,1035,44,205,30,P.teal,true);
 const identity=m.name+'（'+m.code+'）';let titleSize=65;while(titleSize>40&&wrap(identity,1196,titleSize,true).length>1)titleSize-=3;draw(identity,44,100,1196,titleSize,P.ink,true);draw(m.date+' '+(b.ready?'盤後':b.quoteVerified?'行情觀察':'資料待核對')+'｜收盤 '+fmt(m.close)+' 元',44,186,1196,38);
 card('position',255,190);heading(b.summary,283,b.ready?(m.currentDirection.recentDirection==='UP'?P.bull:P.teal):P.muted);let phaseSize=36;while(phaseSize>32&&(wrap(b.phase,CW-68,phaseSize,false).length-1)*(phaseSize+12)+phaseSize>79)phaseSize-=2;draw(b.phase,M+34,356,CW-68,phaseSize);
 const chart=V.chart(x,m.wave,{x:M,y:462,width:CW,height:866,annotate:true,priceLabels:true,wavePrices:true,vivid:true,beginner:true,levels:b.chartLevels});
 if(chart.chartReady)boxes.push({name:'chart',top:462,bottom:1328});else{card('chart',462,866,'#f5f8fb');heading(b.quoteVerified?'行情有資料限制，這次先不數浪。':'資料未核對完整，暫時不畫波浪。',722,P.muted);body([String(m.dataReason||'完成行情尚未準備完整。').slice(0,220),'先重新查詢這檔股票，原有風險計畫仍要遵守。'],810,1260);}
 card('wave-reading',1340,350);heading('回檔多深？哪些線索支持？',1360);body(b.reading.lines,1410,1680);
 card('not-owned',1708,346,'#f7fbff','#8eb4d0');heading(b.entryTitle,1730,P.teal);body(b.compactEntryLines,1794,2044,{emphasis:true,color:b.entryEnabled?P.teal:P.bull});
 card('owned',2072,286,'#fffaf2','#d5b78a');heading(b.holdingTitle,2094,P.amber);body(b.compactHoldingLines,2159,2348,{emphasis:true});
 card('prices',2376,238);heading(b.originalTitle,2397);if(b.knownOriginalLevels){for(let i=0;i<3;i++){draw(b.originalLevels[i].label,M+34,2464+i*44,740,36);draw(fmt(b.originalLevels[i].price),W-316,2464+i*44,236,36,P.muted,true);}}else body(b.originalEmptyLines,2464,2604);
 draw(b.originalNote,44,2635,1196,32,P.muted);draw(m.release+'｜行情 '+m.date+'｜1284×2778 單張白話版',44,2683,1196,31,P.muted);draw('波浪只是輔助，進場與持股處理仍依原條件及風險計畫。',44,2727,1196,31,P.teal,true);
 if(watermarked)(root.ShitouReportWatermark||(typeof require==='function'?require('./report-watermark-v84.js'):null)).apply(c,'stock');
 const noCardOverflow=boxes.every(b=>textBoxes.filter(t=>t.top>=b.top&&t.top<b.bottom).every(t=>t.bottom<=b.bottom)),noClipping=textBoxes.every(t=>t.top>=0&&t.bottom<=H&&t.left>=0&&t.right<=W),noOverlap=boxes.every((r,i)=>!i||r.top>=boxes[i-1].bottom);if(!noClipping||!noOverlap||!noCardOverflow)throw Error('個股波浪白話版超出圖片安全範圍');
 const audit={version:m.version,template:VERSION,release:m.release,kind:m.kind,code:m.code,date:m.date,close:m.close,width:W,height:H,trendTitle:m.trendTitle,trendReason:m.trendReason,wavePosition:m.wavePosition,waveReason:m.waveReason,currentDirection:m.currentDirection,chartLevels:b.chartLevels,priceGuides:m.priceGuides,state:m.wave.state,dataReason:m.dataReason,explanation:m.explanation,scales:m.scales,next:m.next,observations:m.observations,originalLevels:m.levels,waveReference:m.wave.primary?.reference||null,beginner:b,chart,watermarked:!!watermarked,boxes,textBoxes,noClipping,noOverlap,noCardOverflow,identity:m.identity};
 c.dataset.waveReportAudit=JSON.stringify(audit);c.dataset.researchAudit=JSON.stringify(audit);c.dataset.iphoneFullScreen='1284x2778';c.dataset.shareAsSingleImage='true';return c;
}
return Object.freeze({VERSION,model,render,groupPrices,watchSentence,waveReading,readingEvidence,retraceMeasure});
});
