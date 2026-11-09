/* Extension of unified-analysis wave research. No network, scores, ranks or orders. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon,node?require('./indicator-multi-v1.js'):root.ShitouIndicatorMultiV1,node?require('./structure-context-v1.js'):root.ShitouStructureContext,node?require('./worker-data-contract-v1.js'):root.ShitouWorkerDataContractV1,node?require('./shitou-wave-core-v48.js'):root.ShitouWaveCoreV48);if(node)module.exports=api;else root.ShitouElliottWave=api;})(globalThis,function(U,I,S,W,F){
'use strict';
const VERSION='ELLIOTT_VISUAL_RESEARCH_3',PARAM=Object.freeze({version:VERSION,pivotLeft:3,pivotRight:3,minBars:63,minLegATR:.75,trendSlopeATR:.03,volumeRatio5:1.2,bollingerPeriod:20,bollingerDeviation:2,extensionDistanceATR:3});
const flags={researchOnly:true,performanceValidated:false,affectsOriginalScore:false,affectsOriginalRanking:false,affectsOriginalEligibility:false};
const verifiedAnalyses=new WeakSet();
const labels=['起點','1','2','3','4','5','A','B','C'],fmt=x=>Number.isFinite(x)?x.toFixed(2):'待核對';
function cleanPivots(pv){const out=[];for(const p of pv){if(out.at(-1)?.index===p.index)return {ok:false,points:[],reason:'同一天同時是重要高點與低點，日K無法知道先後。'};const last=out.at(-1);if(last?.type===p.type){if(p.type==='HIGH'?p.price>last.price:p.price<last.price)out[out.length-1]=p;}else out.push(p);}return {ok:true,points:out};}
function ruleChecks(points,direction,{asOf=null,patternType='STANDARD_IMPULSE'}={}){const sign=direction==='UP'?1:-1,v=points.map(p=>p.price*sign),confirmed=i=>!!points[i]?.confirmedAt&&points[i].pointStatus!=='PENDING'&&(!asOf||points[i].confirmedAt<=asOf),epsilon=Math.max(1e-9,...v.map(n=>Math.abs(n)*Number.EPSILON*32));
 const check=(ready,pass)=>!ready?'PENDING':pass?'PASS':'FAIL';
 if(patternType!=='STANDARD_IMPULSE')return Object.fromEntries(['wave2AboveOrigin','wave3NotShortest','wave4NoOverlap','progression','correction'].map(k=>[k,'UNSUPPORTED_PATTERN']));
 return {wave2AboveOrigin:check(points.length>=3,v[2]-v[0]>epsilon),wave3NotShortest:check(points.length>=6&&[0,1,2,3,4,5].every(confirmed),v[3]-v[2]+epsilon>=Math.min(v[1]-v[0],v[5]-v[4])),wave4NoOverlap:check(points.length>=5,v[4]-v[1]>epsilon),progression:check(points.length>=4,v[3]-v[1]>epsilon),correction:points.length<7?'PENDING':(points.length>=8&&!(v[7]<v[5]-epsilon&&v[7]>v[6]+epsilon)||points.length>=9&&!(v[8]<v[6]-epsilon))?'UNSUPPORTED_PATTERN':'PASS'};
}
function pointMetadata(p,asOf,namespace){return {...p,availableAt:p.confirmedAt||asOf,pointStatus:p.confirmedAt?'CONFIRMED':'PENDING',priceSource:p.type==='HIGH'?'high':'low',...(namespace?{namespace}:{})};}
function bollinger(b,index=b.length-1){
 if(index<19)return {state:'UNAVAILABLE',reason:'布林通道需要20根完成K線'};
 const values=b.slice(index-19,index+1).map(z=>z.close),middle=U.mean(values),sigma=Math.sqrt(U.mean(values.map(n=>(n-middle)**2))),upper=middle+2*sigma,lower=middle-2*sigma,prior=index>=20?b.slice(index-20,index).map(z=>z.close):null,priorMiddle=prior?U.mean(prior):null,priorUpper=prior?priorMiddle+2*Math.sqrt(U.mean(prior.map(n=>(n-priorMiddle)**2))):null;
 return {state:'AVAILABLE',period:20,deviation:2,date:b[index].date,middle,upper,lower,bandwidth:middle>0?(upper-lower)/middle:null,percentB:upper>lower?(b[index].close-lower)/(upper-lower):null,position:b[index].close>upper?'ABOVE_UPPER':b[index].close<lower?'BELOW_LOWER':'INSIDE',middleDirection:index>=20?(middle-U.mean(b.slice(index-20,index).map(z=>z.close))>0?'UP':middle-U.mean(b.slice(index-20,index).map(z=>z.close))<0?'DOWN':'FLAT'):'UNKNOWN',returnedInsideUpper:index>=20&&b[index-1].close>priorUpper&&b[index].close<=upper};
}
function indicatorSnapshot(b,index,macdSeries){
 const prefix=b.slice(0,index+1),last=prefix.at(-1),ma5=U.ma(prefix,5),ma10=U.ma(prefix,10),old5=U.ma(prefix,5,index-1),old10=U.ma(prefix,10,index-1);
 return {date:last?.date||null,ma5,ma10,ma5Slope:ma5!==null&&old5!==null?ma5-old5:null,ma10Slope:ma10!==null&&old10!==null?ma10-old10:null,macd:index>=34?{dif:macdSeries[index].dif,dea:macdSeries[index].signal,hist:macdSeries[index].hist}:null,rsi14:U.rsi(prefix,14),atr14:U.atr(prefix,14),atrMethod:'WILDER_14',bollinger:bollinger(b,index)};
}
// One evidence layer attached to the existing count, not another wave detector.
function perWaveEvidence(b,points,direction,asOf=b.at(-1)?.date){
 const m=I.macd(b),sign=direction==='DOWN'?-1:1,result={};
 for(const [j,label] of labels.slice(1).entries()){
  const from=points[j],to=points[j+1];
  if(!from||!to){result[label]={state:'UNAVAILABLE',reason:'尚無這一段可核對的端點',label};continue;}
  const rows=b.slice(from.index+1,to.index+1),prior=b.slice(Math.max(0,from.index-rows.length+1),from.index+1),availableAt=to.confirmedAt||asOf;
  if(!rows.length||!availableAt||availableAt>asOf||from.confirmedAt&&from.confirmedAt>asOf){result[label]={state:'UNAVAILABLE',reason:'端點在本訊號日尚不可得',label};continue;}
  const snapshot=indicatorSnapshot(b,to.index,m),meanVolume=U.mean(rows.map(z=>z.volume)),referenceVolume=prior.length===rows.length&&prior.every(z=>z.volume>0)?U.mean(prior.map(z=>z.volume)):null,macdRows=rows.map((_,i)=>({index:from.index+1+i})).filter(z=>z.index>=34),rsiRows=rows.map((_,i)=>U.rsi(b.slice(0,from.index+i+2),14)).filter(Number.isFinite);
  result[label]={state:to.confirmedAt?'CONFIRMED_INTERVAL':'FORMING_INTERVAL',label,fromDate:from.pivotDate,toDate:to.pivotDate,confirmedAt:to.confirmedAt||null,availableAt,pointStatus:to.pointStatus,priceSource:to.priceSource,durationSessions:rows.length,priceChange:to.price-from.price,changePct:(to.price/from.price-1)*100,range:Math.max(...rows.map(z=>z.high))-Math.min(...rows.map(z=>z.low)),meanVolume,referenceVolume,relativeVolume:referenceVolume>0?meanVolume/referenceVolume:null,relativeVolumeState:referenceVolume>0?'AVAILABLE':'UNAVAILABLE',referenceVolumeMethod:'PRECEDING_EQUAL_DURATION_INCLUSIVE_OF_START',...snapshot,macdPeakDefinition:'DIF_DIRECTIONAL_INTERVAL_EXTREME',macdPeak:macdRows.length===rows.length?Math.max(...macdRows.map(z=>m[z.index].dif*sign))*sign:null,rsiExtreme:rsiRows.length===rows.length?(sign===1?Math.max(...rsiRows):Math.min(...rsiRows)):null};
 }
 return result;
}
function divergenceEvidence(points,perWave,direction,asOf){
 const p3=points[3],p5=points[5],third=perWave['3'],fifth=perWave['5'],sign=direction==='UP'?1:-1;
 if(!p3||!p5||!p3.confirmedAt||!p5.confirmedAt||p3.confirmedAt>asOf||p5.confirmedAt>asOf||third.state!=='CONFIRMED_INTERVAL'||fifth.state!=='CONFIRMED_INTERVAL')return {state:'PENDING',rsi:false,macd:false,volume:false,reason:'第3與第5段高低點都確認後，才能比較背離'};
 if(!(p5.price*sign>p3.price*sign))return {state:'NOT_APPLICABLE',rsi:false,macd:false,volume:false,reason:'價格未創同方向新高低，不宣稱背離'};
 const available=Number.isFinite(third.macdPeak)&&Number.isFinite(fifth.macdPeak)&&Number.isFinite(third.rsiExtreme)&&Number.isFinite(fifth.rsiExtreme),macd=available?fifth.macdPeak*sign<third.macdPeak*sign:false,rsi=available?fifth.rsiExtreme*sign<third.rsiExtreme*sign:false,volume=Number.isFinite(third.relativeVolume)&&Number.isFinite(fifth.relativeVolume)?fifth.relativeVolume<third.relativeVolume:false;
 return {state:!available?'UNAVAILABLE':macd||rsi||volume?'CANDIDATE':'NOT_DETECTED',macd,rsi,volume,availableAt:[p3.confirmedAt,p5.confirmedAt].sort().at(-1),priceNewExtreme:true,third:{macdPeak:third.macdPeak,rsiExtreme:third.rsiExtreme,relativeVolume:third.relativeVolume},fifth:{macdPeak:fifth.macdPeak,rsiExtreme:fifth.rsiExtreme,relativeVolume:fifth.relativeVolume},reason:'比較各段同口徑峰值與相對量；候選背離不保證反轉'};
}
function confirmationEvidence(b,direction,p=PARAM){
 if(!b.length)return {state:'UNAVAILABLE',facts:[],lines:['說明：完成行情不足，先不作量價確認。']};
 const sign=direction==='DOWN'?-1:1,i=b.length-1,z=b[i],snapshot=indicatorSnapshot(b,i,I.macd(b)),previous=i>=35?I.macd(b)[i-1]:null,v5=b.length>=6?U.mean(b.slice(-6,-1).map(z=>z.volume)):null,ratio=v5>0?z.volume/v5:null,facts=[];
 const add=(key,known,support,value,reason)=>facts.push({key,category:!known?'NOT_AVAILABLE':support?'SUPPORTING':'RISK',state:!known?'UNAVAILABLE':support?'SUPPORT':'CAUTION',value:known?value:null,reason,availableAt:z.date});
 add('VOLUME',ratio!==null,ratio>=p.volumeRatio5,ratio,ratio===null?'量能資料不足':ratio>=p.volumeRatio5?'成交量比前5日均量增加':'成交量未達研究放大門檻');
 const maKnown=[snapshot.ma5,snapshot.ma10,snapshot.ma5Slope,snapshot.ma10Slope].every(Number.isFinite),maSupport=maKnown&&sign*(z.close-snapshot.ma5)>0&&sign*(snapshot.ma5-snapshot.ma10)>=0&&sign*snapshot.ma5Slope>0&&sign*snapshot.ma10Slope>0;
 add('MA5_10',maKnown,maSupport,{ma5:snapshot.ma5,ma10:snapshot.ma10,ma5Slope:snapshot.ma5Slope,ma10Slope:snapshot.ma10Slope},maKnown?maSupport?(sign===1?'5日與10日均價一起向上':'5日與10日均價一起向下'):'5日與10日均價還沒一起支持':'均價暖機資料不足');
 const momentumKnown=!!snapshot.macd&&!!previous,momentum=momentumKnown&&sign*(snapshot.macd.hist-previous.hist)>0;
 add('MACD',momentumKnown,momentum,snapshot.macd,momentumKnown?momentum?(sign===1?'上漲力道增加':'下跌力道增加'):(sign===1?'上漲力道未增加':'下跌力道未增加'):'動能暖機資料不足');
 const previousBar=b[i-1],completedTurn=!!previousBar&&sign*(z.close-(sign===1?previousBar.high:previousBar.low))>0;add('COMPLETED_BAR_TURN',!!previousBar,completedTurn,previousBar?{close:z.close,previousHigh:previousBar.high,previousLow:previousBar.low}:null,completedTurn?(sign===1?'完成K收盤越過前日高點，僅是轉強線索':'完成K收盤低於前日低點，僅是轉弱線索'):'完成K還沒越過前日反向關卡，不先認定轉折');
 const bb=snapshot.bollinger;add('BOLLINGER',bb.state==='AVAILABLE',bb.state==='AVAILABLE'&&sign*(z.close-bb.middle)>=0,bb,bb.state!=='AVAILABLE'?'布林資料不足':bb.returnedInsideUpper?'收盤從上軌外回到軌內，先觀察':bb.position==='ABOVE_UPPER'?'沿上緣偏強，不代表一定回跌':bb.position==='BELOW_LOWER'?'跌到下緣外，不代表一定反彈':'收盤仍在布林通道內');
 const find=k=>facts.find(f=>f.key===k),volume=find('VOLUME'),ma=find('MA5_10'),macd=find('MACD');
 return {state:'AVAILABLE',direction,date:z.date,indicators:snapshot,facts,lines:['說明：量能'+(ratio===null?'資料不足':ratio>=p.volumeRatio5?'增加（約'+ratio.toFixed(2)+'倍）':'尚未放大（約'+ratio.toFixed(2)+'倍）')+'，只作輔助。',(direction==='DOWN'?'下跌':direction==='UP'?'上漲':'短線')+'力道'+(macd.state==='UNAVAILABLE'?'資料不足':macd.state==='SUPPORT'?'增加':'未增加')+'；短期均價'+(ma.state==='UNAVAILABLE'?'資料不足':ma.state==='SUPPORT'?(sign===1?'向上':'向下'):'仍待配合')+'。','價格通道：'+(bb.state!=='AVAILABLE'?'資料不足':bb.returnedInsideUpper?'從上緣回到範圍內，先觀察':bb.position==='ABOVE_UPPER'?'沿上緣走，不代表一定回跌':bb.position==='BELOW_LOWER'?'跌到下緣外，不代表一定反彈':'收盤仍在範圍內，先看方向')+'。'],researchOnly:true,...flags};
}
function trend(b,p=PARAM){const ma20=U.ma(b,20),old=U.ma(b,20,b.length-4),atr=U.atr(b,14),slope=ma20!==null&&old!==null?(ma20-old)/3:null,direction=slope===null||!(atr>0)?'UNKNOWN':slope>atr*p.trendSlopeATR?'UP':slope< -atr*p.trendSlopeATR?'DOWN':'RANGE';return {direction,ma20,ma60:U.ma(b,60),slope,atr,label:{UP:'上漲背景',DOWN:'下跌背景',RANGE:'橫盤整理',UNKNOWN:'資料不足'}[direction]};}
function evidence(b,points,direction,p){const z=b.at(-1),sign=direction==='UP'?1:-1,p1=points[1],confirmation=confirmationEvidence(b,direction,p),perWave=perWaveEvidence(b,points,direction),ratio=confirmation.facts.find(f=>f.key==='VOLUME')?.value??null;
 return {breakPreviousExtreme:!!p1&&z.close*sign>p1.price*sign,volumeRatio5:ratio,volumeIncreased:ratio!==null&&ratio>=p.volumeRatio5,macdGrowing:confirmation.facts.find(f=>f.key==='MACD')?.state==='UNAVAILABLE'?null:confirmation.facts.find(f=>f.key==='MACD')?.state==='SUPPORT',rsi14:confirmation.indicators.rsi14,divergence:divergenceEvidence(points,perWave,direction,z.date),perWaveEvidence:perWave,confirmation,hardRulesOnlyFor:'STANDARD_IMPULSE'};
}
function description(c,b,p){const stage=c.points.length-1,dir=c.direction,up=dir==='UP',e=c.evidence,tail=c.points.at(-1),forming=!tail.confirmedAt;
 let headline,plain;
 if(stage===2){headline=up?'疑似第 2 浪回檔，等待下一段':'疑似下跌第 2 浪反彈';plain='前一段走勢出現回頭整理，但還沒走出足夠的新一段，先不要提前當成第3浪。';}
 else if(stage===3){headline=up?'疑似第 3 浪主升':'疑似下跌第 3 浪延伸';plain=up?'前一段回檔沒有跌回起點，這一段已越過前高；仍要看成交量與動能能否跟上。':'反彈沒有越過原本起跌點，後續又走低；仍要核對成交量與下跌力道。';if(!e.volumeIncreased||!e.macdGrowing)plain+='目前成交量或動能還沒有一起支持，判讀仍待確認。';}
 else if(stage===4){headline=up?'疑似第 4 浪整理':'疑似下跌第 4 浪反彈整理';plain=up?'前面漲了一段，現在回頭休息；這次回檔還沒跌回第1段上漲的範圍，才保留這種數法。':'前面跌了一段，現在暫時反彈；這次還沒漲回第1段下跌的範圍，才保留這種數法。';}
 else if(stage===5){const weak=e.divergence&&(e.divergence.rsi||e.divergence.macd||e.divergence.volume);headline=up?(weak?'疑似第 5 浪末端，追高風險升高':'疑似第 5 浪延伸，留意追高風險'):'疑似下跌第 5 浪，留意反彈風險';plain=weak?(up?'股價雖然又創新高，但成交量或上漲力道沒有跟上，漲勢可能變慢；這不代表明天一定下跌。':'股價雖然又創新低，但成交量或下跌力道沒有跟上，跌勢可能變慢；這不代表明天一定反彈。'):'已經走過幾段漲跌，這一段可能接近後段；目前沒有足夠證據說一定會在這裡反轉。';}
 else {const key=labels[stage];headline='疑似艾略特 '+key+(up?' 修正浪':' 反彈修正浪');plain=up?'前面上漲後的簡單A/B/C修正候選：A先回落、B反彈、C再回落；不是所有修正都這樣走，與N字ABC不同。':'前面下跌後的簡單A/B/C修正候選：A先反彈、B回落、C再反彈；不是所有修正都這樣走，與N字ABC不同。';if(stage===8)plain+=up?'C段只觀察修正是否放緩，仍須收盤站回參考價與結構改善，不能提前認定底部。':'C段只觀察反彈是否放緩，仍須收盤跌回參考價與結構改善，不能提前認定頂部。';}
 if(forming)headline+='（仍待確認）';
 const boundary=stage>=6?c.points[5]:stage===5?c.points[4]:stage===4?c.points[1]:c.points[0];
 const turn=stage>=6?(up?'收盤重新站回 ':'收盤重新跌破 '):(up?'價格碰到或跌破 ':'價格碰到或漲過 ');
 return {headline,plain,clarity:c.rules.wave3NotShortest==='PENDING'||forming?'仍待確認':'較明確',reference:{label:'波浪參考價',price:boundary.price,date:boundary.pivotDate,meaning:turn+fmt(boundary.price)+'，這種數法要重新評估；不取代原本停損。'},mainScenario:'主要判讀：'+headline+'。'+plain,alternativeScenario:'備用判讀：這可能只是較大一段走勢中的小波段；'+turn+fmt(boundary.price)+'，重新檢查是否轉入修正或反彈。'};
}
// All scales reuse structure-context pivots and the same rules. Longer scales wait longer.
function scaleConfigs(options={}){
 const q=options.parameters||{};
 if(q.pivotRight!==undefined&&(!Number.isInteger(q.pivotRight)||q.pivotRight<1||q.pivotRight>12))throw Error('轉折確認需要1到12根完成日K。');
 const windows=q.scaleWindows||(q.pivotLeft||q.pivotRight?[q.pivotLeft||q.pivotRight]:[3,5,8]);
 if(!Array.isArray(windows)||!windows.length||windows.length>4||windows.some(n=>!Number.isInteger(n)||n<1||n>12))throw Error('波段比較設定無效，請使用1到12根完成日K。');
 return [...new Set(windows)].map((n,i)=>({id:'SCALE_'+n,label:windows.length===3?['小波段','中波段','大波段'][i]:'前後各'+n+'天的波段',pivotLeft:n,pivotRight:q.pivotRight&&windows.length===1&&Number.isInteger(q.pivotRight)&&q.pivotRight>=1&&q.pivotRight<=12?q.pivotRight:n}));
}
function pathRules(points,b,direction){
 const sign=direction==='UP'?1:-1,extreme=z=>sign*(sign===1?z.low:z.high),pass=(from,to,level)=>b.slice(from+1,to+1).every(z=>extreme(z)-sign*level>Math.max(1e-9,Math.abs(level)*Number.EPSILON*32));
 return {wave2AboveOrigin:points.length<3||pass(points[1].index,points[2].index,points[0].price)?'PASS':'FAIL',wave4NoOverlap:points.length<5||pass(points[3].index,points[4].index,points[1].price)?'PASS':'FAIL'};
}
function rejection(points,rules,direction,asOf,scale,b){
 const failures=[],up=direction==='UP',point=i=>points[i]&&({date:points[i].pivotDate,price:points[i].price,type:points[i].type});
 const violation=(from,to,boundary)=>b?.slice(points[from].index+1,points[to].index+1).find(z=>up?z.low<=boundary:z.high>=boundary);
 const two=points[2]&&(violation(1,2,points[0].price)||{date:points[2].pivotDate,low:points[2].price,high:points[2].price}),four=points[4]&&(violation(3,4,points[1].price)||{date:points[4].pivotDate,low:points[4].price,high:points[4].price});
 const add=(key,text,indices,observed,boundary)=>{if(rules[key]==='FAIL')failures.push({key,text,direction,points:indices.map(point).filter(Boolean),...(observed?{observed:{date:observed.date,price:up?observed.low:observed.high},boundary}:{} )});};
 add('wave2AboveOrigin',two?two.date+' 的'+(up?'低點 ':'高點 ')+fmt(up?two.low:two.high)+' 已碰到或越過這種分段方式的起點 '+fmt(points[0].price)+'，這種分段方式先不採用。':'起點條件未通過。',[0,2],two,points[0].price);
 add('wave4NoOverlap',four?four.date+' 的'+(up?'低點 ':'高點 ')+fmt(up?four.low:four.high)+' 已碰回第1段的價格範圍 '+fmt(points[1].price)+'，不能當成標準的五段走法。':'回檔範圍未通過。',[1,4],four,points[1]?.price);
 add('wave3NotShortest','這組第3段的長度，比第1段和第5段都短，因此不採用。',[0,1,2,3,4,5]);
 add('progression','這組後續高低點沒有延續原方向，尚不採用這種數法。',[1,3,5]);
 add('correction','後面的反彈或回檔，不符合目前支援的簡單修正走法。',[5,6,7,8]);
 return {origin:points[0].pivotDate,rules,failures,availableAt:asOf,scale:{label:scale.label||'目前波段',pivotLeft:scale.pivotLeft,pivotRight:scale.pivotRight}};
}
function historicalImpulses(b,pv,p,scale){
 const result=[],seen=new Set();
 // Replay each confirmation date. Later, higher same-type pivots must not erase an earlier record.
 for(const known of [...new Set(pv.map(z=>z.confirmedAt))].sort()){
  const cleaned=cleanPivots(pv.filter(z=>z.confirmedAt<=known));if(!cleaned.ok||cleaned.points.length<6)continue;
  const points=cleaned.points.slice(-6),key=points.map(z=>z.pivotDate+':'+z.price).join('|');if(seen.has(key))continue;
  const direction=points[0].type==='LOW'?'UP':'DOWN',end=b.findIndex(z=>z.date===points[5].confirmedAt),prefix=b.slice(0,end+1);
  if(end<0||prefix.length<p.minBars)continue;
  const rules=ruleChecks(points,direction,{asOf:known}),path=pathRules(points,prefix,direction);for(const key of Object.keys(path))if(path[key]==='FAIL')rules[key]='FAIL';
  if(['wave2AboveOrigin','wave3NotShortest','wave4NoOverlap','progression'].some(k=>rules[k]!=='PASS')||(points[5].price-points[3].price)*(direction==='UP'?1:-1)<=0)continue;
  const atr=U.atr(prefix,14);if(!(atr>0)||points.slice(1).some((x,j)=>Math.abs(x.price-points[j].price)<atr*p.minLegATR))continue;
  const background=trend(prefix.slice(0,points[3].index+1),p);if(background.direction!==direction&&trend(prefix,p).direction!==direction)continue;
  seen.add(key);result.push({namespace:'ELLIOTT_HISTORICAL',status:'HISTORICAL_RULES_PASSED',interpretationConfirmed:false,turnsConfirmed:true,direction,points:points.map((x,j)=>({...pointMetadata(x,known,'ELLIOTT_HISTORICAL'),label:labels[j],viewStatus:'HISTORICAL'})),rules,availableAt:points[5].confirmedAt,completedDate:points[5].pivotDate,scale,headline:'歷史五段參考：'+points[0].pivotDate+' 至 '+points[5].pivotDate+'；不代表目前走到第幾浪。'});
 }
 return result;
}
function analyzeScales(b,options={}){
 const configs=scaleConfigs(options),results=configs.map(scale=>{const pv=S.pivots(b,scale).map(p=>pointMetadata(p,b.at(-1).date)),parameters={...PARAM,...options.parameters,...scale},a=analyzeBars(b,pv,{parameters});return {scale,a,historical:historicalImpulses(b,pv,parameters,scale)};});
 const chosen=results.find(x=>x.a.primary)||results[0],out={...chosen.a},seen=new Set(),history=[];
 for(const entry of results)for(const h of entry.historical){const key=h.points.map(z=>z.pivotDate+':'+z.price).join('|');if(!seen.has(key)){seen.add(key);history.push(h);}}
 history.sort((a,c)=>c.availableAt.localeCompare(a.availableAt)||a.scale.pivotRight-c.scale.pivotRight);
 out.historicalCounts=history.slice(0,3);out.selectedScale=chosen.scale;
 out.scaleComparisons=results.map(({scale,a})=>({scale,state:a.state,headline:a.headline,hasCandidate:!!a.primary,candidateCount:a.counts?.length||0,failedConditions:[...new Set((a.rejected||[]).flatMap(r=>Object.entries(r.rules||{}).filter(([,v])=>v==='FAIL').map(([k])=>k)))]}));
 const other=results.find(x=>x!==chosen&&x.a.primary&&(JSON.stringify(x.a.primary.points.map(p=>[p.pivotDate,p.price,p.type]))!==JSON.stringify(out.primary?.points.map(p=>[p.pivotDate,p.price,p.type]))));
 if(other){out.scaleAlternative={scale:other.scale,...other.a.primary};out.scaleDisagreement=true;if(out.primary){out.state='DISAGREEMENT';out.clarity='大小波段有不同解讀，先觀察';}}
 const rejected=results.flatMap(({a,scale})=>(a.rejected||[]).map(r=>({...r,scale}))).sort((a,c)=>c.origin.localeCompare(a.origin)||a.scale.pivotRight-c.scale.pivotRight);
 out.diagnostics=rejected.flatMap(r=>(r.failures||[]).map(f=>({...f,origin:r.origin,scale:r.scale,availableAt:r.availableAt}))).filter((f,i,all)=>all.findIndex(z=>z.key===f.key&&z.origin===f.origin)===i).slice(0,3);
 if(!out.primary){out.rejected=rejected;if(rejected.length&&out.state!=='UNSUPPORTED_PATTERN'){out.state='RULE_VIOLATION';out.reason='已比較不同大小的波段，目前還不能合理標出1到5，先等新的價格轉折。';}out.pendingNote='最近的高低點還需要後續完成日K確認，不能先當成第1浪或反轉成功。';}
 out.confirmationEvidence=out.primary?.evidence.confirmation||confirmationEvidence(b,out.trend.direction);
 return out;
}
function analyzeBars(b,pv=S.pivots(b),options={}){const p={...PARAM,...options.parameters},t=trend(b,p),asOf=b.at(-1)?.date,clean=cleanPivots(pv.filter(x=>x.confirmedAt&&x.confirmedAt<=asOf)),empty=(state,reason)=>({version:VERSION,state,headline:'目前無法確認波浪位置',reason,trend:t,points:[],counts:[],...flags});
 if(b.length<p.minBars)return empty('DATA_INSUFFICIENT','至少需要63根已核對的完成日K。');if(!clean.ok)return empty('UNCLEAR',clean.reason);if(t.direction==='RANGE'||t.direction==='UNKNOWN')return empty('UNCLEAR','大方向仍在橫盤或證據不足，先不硬套五浪。');
 const seq=clean.points,candidates=[],rejected=[],unsupported=[];
 for(let start=Math.max(0,seq.length-10);start<seq.length-2;start++){
  let points=seq.slice(start).map(x=>pointMetadata(x,asOf));if(points.length>9)continue;
  const direction=points[0].type==='LOW'?'UP':'DOWN',sign=direction==='UP'?1:-1;
  const anchor=points[Math.min(3,points.length-1)],background=trend(b.slice(0,anchor.index+1),p);
  if(background.direction!==direction&&t.direction!==direction)continue;
  const last=points.at(-1),nextType=last.type==='LOW'?'HIGH':'LOW',key=nextType==='HIGH'?'high':'low',after=b.slice(last.index+1),chosen=after.reduce((best,z,i)=>!best||(nextType==='HIGH'?z[key]>best.price:z[key]<best.price)?{type:nextType,index:last.index+1+i,pivotDate:z.date,price:z[key],confirmedAt:null,pointStatus:'PENDING'}:best,null);
  const sameKey=last.type==='HIGH'?'high':'low',extension=after.reduce((best,z,i)=>(last.type==='HIGH'?z[sameKey]>best.price:z[sameKey]<best.price)?{...last,index:last.index+1+i,pivotDate:z.date,price:z[sameKey],confirmedAt:null,pointStatus:'PENDING'}:best,last);
  if(extension!==last)points[points.length-1]=extension;
  else if(points.length<9&&chosen&&(nextType==='HIGH'?chosen.price>last.price:chosen.price<last.price)&&Math.abs(chosen.price-last.price)>t.atr*p.minLegATR)points.push(chosen);
  if(points.length<3||points.slice(1).some((x,i)=>x.type===points[i].type||(x.type==='HIGH'?x.price<=points[i].price:x.price>=points[i].price)||Math.abs(x.price-points[i].price)<t.atr*p.minLegATR))continue;
  points=points.map(x=>pointMetadata(x,asOf));const rules=ruleChecks(points,direction,{asOf}),path=pathRules(points,b,direction);for(const key of Object.keys(path))if(path[key]==='FAIL')rules[key]='FAIL';if(Object.values(rules).includes('FAIL')){rejected.push(rejection(points,rules,direction,asOf,p,b));continue;}
  if(rules.correction==='UNSUPPORTED_PATTERN'||points.length>=6&&points[5].confirmedAt&&(points[5].price-points[3].price)*sign<=0){unsupported.push({origin:points[0].pivotDate,availableAt:asOf,state:'UNSUPPORTED_PATTERN',reason:rules.correction==='UNSUPPORTED_PATTERN'?'修正不是本版支援的簡單A/B/C候選；平台與複雜修正尚未建模':'第5段未越過第3段端點；截斷或其他型態尚未建模'});continue;}
  const stage=points.length-1;if(stage===3&&points[3].price*sign<=points[1].price*sign)continue;
  const c={namespace:'ELLIOTT_WAVE',patternType:'STANDARD_IMPULSE',direction,points:points.map((x,i)=>({...x,label:labels[i],namespace:i>=6?'ELLIOTT_CORRECTION':'ELLIOTT_IMPULSE'})),rules,availableAt:asOf,evidence:evidence(b,points,direction,p)};
  c.evidence.ruleEvidence=Object.entries(rules).map(([key,state])=>({key,state,category:'HARD_RULE',scope:key==='correction'?'SIMPLE_ABC_CANDIDATE':'STANDARD_IMPULSE',availableAt:asOf}));
  const distance=Math.abs(b.at(-1).close-U.ma(b,10))/t.atr;
  c.evidence.phaseContext={stage:labels[stage],state:stage===3?(distance>p.extensionDistanceATR?'EXTENDED_FAR_FROM_REFERENCE':points[3].confirmedAt?'EXTENDING':'EARLY_CANDIDATE'):stage===2?(points[2].confirmedAt?'TURN_CONFIRMED':'WAITING_TURN'):stage===8?'WAITING_REVERSAL_CONFIRMATION':'OBSERVATION',distanceFromMA10ATR:distance,retracementOfWave1:stage>=2?(points[1].price-points[2].price)/(points[1].price-points[0].price):null,availableAt:asOf,wave2OriginHeld:rules.wave2AboveOrigin==='PASS',wave2EndpointConfirmed:!!points[2]?.confirmedAt,completedBarTurn:c.evidence.confirmation.facts.find(f=>f.key==='COMPLETED_BAR_TURN')?.state||'UNAVAILABLE',tradeAllowed:false};
  const hardBoundary=stage===4?points[1].price:stage===5?points[4].price:stage===3?points[0].price:null;
  if(hardBoundary!==null&&b.slice(points.at(-1).index+1).some(z=>direction==='UP'?z.low<=hardBoundary:z.high>=hardBoundary)){rejected.push({origin:points[0].pivotDate,reason:'後續價格已碰到此數法不允許的邊界'});continue;}
  Object.assign(c,description(c,b,p));candidates.push(c);
 }
 candidates.sort((a,c)=>c.points.length-a.points.length||c.points.at(-1).index-a.points.at(-1).index||a.points[0].index-c.points[0].index);
 if(!candidates.length&&unsupported.length)return {...empty('UNSUPPORTED_PATTERN','這段可能是尚未支援的修正或特殊型態，先不指定浪號。'),unsupported,rejected};
 if(!candidates.length)return {...empty(rejected.length?'RULE_VIOLATION':'WAITING_PIVOTS',rejected.length?'目前數法違反標準浪規則，先不標浪；特殊對角線與複雜修正尚未建模。':'已確認的高低點還不足；新轉折需等待右側3根完成日K。'),rejected};
 const main=candidates[0],alternative=candidates.find(c=>c.points[0].index!==main.points[0].index)||null,disagreement=!!alternative&&alternative.direction!==main.direction||main.points.length===4&&(!main.evidence.volumeIncreased||!main.evidence.macdGrowing);
 const fibStart=main.points.length>=6?main.points[4]:main.points[0],fibEnd=main.points.length>=6?main.points[5]:main.points[1],swing={direction:main.direction,start:fibStart,end:fibEnd};
 const retracements=[.382,.5,.618,.786].map(ratio=>({ratio,price:F.fibLevelPrice(swing,ratio),label:'波浪回吐參考'}));
 return {version:VERSION,state:disagreement?'DISAGREEMENT':'RESEARCH_ONLY',date:asOf,trend:t,headline:main.headline,clarity:disagreement?'有不同解讀，先觀察':main.clarity,primary:main,alternative,counts:candidates.slice(0,2),points:main.points,rejected,unsupported,perWaveEvidence:main.evidence.perWaveEvidence,confirmationEvidence:main.evidence.confirmation,patternType:'STANDARD_IMPULSE',correctionPattern:main.points.length>=7?'SIMPLE_ABC_CANDIDATE':null,retracements,fibNote:'這只是過去漲幅或跌幅回吐到哪裡，不代表碰到就一定止跌或反轉。',...flags};
}

function plainReason(reason){return String(reason||'每日資料還沒核對完整。').replace(/Worker資料契約|原本資料一致性檢查/g,'行情資料一致性檢查').replace(/OHLC/g,'開盤、最高、最低、收盤價').replace(/統計口徑|價格基準|價格調整基準/g,'計算方式').replace(/核驗/g,'核對').replace(/日K/g,'每日K線').replace(/合法跳動單位/g,'交易所允許的價格刻度');}
function evaluate(input,options={}){const r=U.normalizeInput(input),code=String(r.stock||r.code||r.instrumentType||r.index||''),date=options.asOf||r.closeDate||r.marketDate,index=['TAIEX','TPEX_INDEX'].includes(r.instrumentType||r.index),fail=reason=>U.freeze({version:VERSION,state:'DATA_INSUFFICIENT',code,date,headline:'目前無法確認波浪位置',reason:plainReason(reason),diagnosticReason:reason,points:[],bars:[],historicalCounts:[],scaleComparisons:[],diagnostics:[],...flags});
 try{
  const inputRows=r.canonicalBars||r.dailySeries||[],basis=r.priceAdjustment?.basis,meta=r.dailySeriesMeta||{},unit=r.volumeUnit||meta.volumeUnit;
  if(inputRows.some(z=>z.stock&&String(z.stock)!==code||z.code&&String(z.code)!==code||z.instrumentType&&z.instrumentType!==code))return fail('每日資料混入不同標的，先停止判讀。');
  if(r.dataVersionConflict||r.sourceVersionConflict||r.priceBasisConflict||meta.priceBasis&&basis&&meta.priceBasis!==basis||r.dataVersion&&meta.dataVersion&&r.dataVersion!==meta.dataVersion||inputRows.some(z=>z.priceBasis&&basis&&z.priceBasis!==basis||z.dataVersion&&meta.dataVersion&&z.dataVersion!==meta.dataVersion||z.volumeUnit&&unit&&z.volumeUnit!==unit))return fail('每日資料的單位、價格口徑或版本不一致。');
  if(r.completed!==true||r.dailySeriesMeta?.onlyCompletedBars!==true||(r.canonicalBars||r.dailySeries||[]).some(z=>z.completed===false))return fail('尚未核對為完成日K，不使用盤中資料數浪。');
  if(options.asOf&&options.asOf!==(r.closeDate||r.marketDate))return fail('請提供截至該日的資料快照，不能用較晚資料代替。');
  let n;if(index){if(r.stock||r.code&&r.code!==r.instrumentType||r.provenance==='ILLUSTRATION')return fail('大盤身分或資料來源不一致。');n=S.confirmationInput({...r,instrumentType:r.instrumentType||r.index});if(!n.ok)return fail(n.reason);if(!n.volumeUsable)return fail('大盤成交量來源或計算範圍尚未核對。');}
  else {n=U.validate(r);if(!n.ok)return fail(n.reason);const receipt=typeof module==='object'&&module.exports?require('./selection-data-v2.js'):globalThis.ShitouSelectionDataV2;const contractOk=r.dataContract?W.verify(r).ok:receipt?.verifyResearchReceipt?.(r)?.ok===true;if(!contractOk)return fail('個股行情的來源收據或內容指紋尚未核對，請重新分析。');if(r.priceAdjustment?.verified!==true||r.priceAdjustmentConsistent===false||r.corporateActionUnresolved)return fail('價格或除權息基準還沒核對。');if(r.dailyBasisV2?.sourceVolumeWarning||r.sourceVolumeWarning||r.volumeSourceConflict||r.volumeScopeAudit?.formalVolumeEligible===false)return fail('股價與成交量來源有衝突，先停止數浪。');if(r.volumeUnit&&r.dailySeriesMeta?.volumeUnit&&r.volumeUnit!==r.dailySeriesMeta.volumeUnit)return fail('成交量股數、張數單位不一致。');const calendar=r.tradingCalendar;if(!calendar?.verified||!Array.isArray(calendar.dates)||JSON.stringify(calendar.dates.filter(d=>d>=n.bars[0].date&&d<=date))!==JSON.stringify(n.bars.map(z=>z.date)))return fail('每日資料與正式交易日曆還沒核對完整。');}
  const b=n.bars;if(!index&&b.some(z=>['open','high','low','close'].some(k=>!U.legal(z[k]))))return fail('價格不符合台股合法跳動單位。');if(!b?.length||b.at(-1).date!==date||b.at(-1).close!==r.close||b.some(z=>z.completed===false||z.volume<=0)||b.some((z,i)=>i&&Math.abs(z.close/b[i-1].close-1)>.3))return fail('收盤日期、成交量或價格連續性尚未核對。');
  const verifiedPivots=S.pivots(b,scaleConfigs(options)[0]);if(options.pivots&&U.hash(options.pivots)!==U.hash(verifiedPivots))return fail('轉折點與完成日K確認結果不一致。');
  const result=analyzeScales(b,options),warnings=!index&&r.priceAdjustment.corporateActionsVerified!==true?['除權息歷史未完整證實，只研究這份已核對、使用同一種計算方式的價格；遇價格斷點停止判讀。']:[];
  const analysis=U.freeze({...result,code,date,confirmationEvidence:result.confirmationEvidence,source:r.dailySeriesMeta?.source||n.source,volumeUnit:r.volumeUnit||r.dailySeriesMeta?.volumeUnit||null,priceBasis:r.priceAdjustment.basis,warnings,inputFingerprint:U.hash([code,r.market,date,b,r.priceAdjustment,r.dailySeriesMeta]),bars:b.map((z,i)=>({...z,index:i,ma5:U.ma(b,5,i),ma10:U.ma(b,10,i),ma20:U.ma(b,20,i),ma60:U.ma(b,60,i)})),parameters:{...PARAM,...options.parameters,pivotLeft:result.selectedScale.pivotLeft,pivotRight:result.selectedScale.pivotRight,scaleWindows:result.scaleComparisons.map(x=>x.scale.pivotRight)}});verifiedAnalyses.add(analysis);return analysis;
 }catch(_){return fail('波浪資料暫時無法核對，原本報告仍可使用。');}
}
// Backward-compatible fields consumed by existing unified research. One count engine only.
function matchesSnapshot(input,analysis){try{
 if(!verifiedAnalyses.has(analysis))return false;
 // The independent index engine owns this exact verified object plus its original bars.
 // A deserialized/forged cached analysis cannot take this shortcut.
 if(verifiedAnalyses.has(analysis)&&input?.elliottWave===analysis&&input.input?.completed===true&&input.input.symbol===analysis.code&&input.input.asOf===analysis.date&&input.input.close===analysis.bars.at(-1).close&&input.input.source===analysis.source&&input.input.calendar?.verified===true&&Array.isArray(input.input.calendar.dates)&&JSON.stringify(input.input.calendar.dates.filter(d=>d>=analysis.bars[0].date&&d<=analysis.date))===JSON.stringify(analysis.bars.map(b=>b.date))&&(!input.priceAdjustment||input.priceAdjustment.verified===true&&input.priceAdjustment.basis===analysis.priceBasis)&&!input.input.bars.some(z=>z.completed===false||z.stock&&String(z.stock)!==analysis.code||z.code&&String(z.code)!==analysis.code||z.volumeUnit&&z.volumeUnit!==analysis.volumeUnit||z.priceBasis&&z.priceBasis!==analysis.priceBasis)){const values=rows=>rows.map(z=>[z.date,z.open,z.high,z.low,z.close,z.volume]);return JSON.stringify(values(input.input.bars))===JSON.stringify(values(analysis.bars));}
 const r=U.normalizeInput(input),code=String(r.stock||r.code||r.instrumentType||r.index||''),date=r.closeDate||r.marketDate,index=['TAIEX','TPEX_INDEX'].includes(r.instrumentType||r.index),n=index?S.confirmationInput({...r,instrumentType:r.instrumentType||r.index}):U.validate(r);
 return n.ok&&analysis?.version===VERSION&&analysis.code===code&&analysis.date===date&&analysis.inputFingerprint===U.hash([code,r.market,date,n.bars,r.priceAdjustment,r.dailySeriesMeta]);
}catch(_){return false;}}
function legacy(b,pv,computed){const a=computed||analyzeScales(b),c=a.primary,r=c?.rules,complete=c?.points.length>=6;return {version:'ELLIOTT_WAVE_STRUCTURE_RESEARCH_V1',waveCandidate:complete&&r.wave3NotShortest==='PASS'?'IMPULSE_FIVE_CANDIDATE':null,ruleValidation:r?Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v==='PENDING'?null:v==='PASS'])):null,pivots:a.points,alternativeCounts:c?.points.length>=7?['ABC_CORRECTION_CANDIDATE']:[],invalidation:c?.reference.price??null,divergence:{detected:!!c?.evidence.divergence&&(c.evidence.divergence.rsi||c.evidence.divergence.macd),peaks:[],confirmedAt:c?.points[5]?.confirmedAt||null},note:a.reason||c?.plain||a.headline,multiTimeframe:'UNKNOWN',affectsOriginalRanking:false};}
return Object.freeze({VERSION,PARAM,cleanPivots,ruleChecks,pointMetadata,bollinger,perWaveEvidence,divergenceEvidence,confirmationEvidence,trend,analyzeBars,analyzeScales,evaluate,matchesSnapshot,legacy});
});
