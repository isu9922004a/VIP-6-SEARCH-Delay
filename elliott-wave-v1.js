/* Extension of unified-analysis wave research. No network, scores, ranks or orders. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon,node?require('./indicator-multi-v1.js'):root.ShitouIndicatorMultiV1,node?require('./structure-context-v1.js'):root.ShitouStructureContext,node?require('./worker-data-contract-v1.js'):root.ShitouWorkerDataContractV1,node?require('./shitou-wave-core-v48.js'):root.ShitouWaveCoreV48);if(node)module.exports=api;else root.ShitouElliottWave=api;})(globalThis,function(U,I,S,W,F){
'use strict';
const VERSION='ELLIOTT_VISUAL_RESEARCH_1',PARAM=Object.freeze({version:VERSION,pivotLeft:3,pivotRight:3,minBars:63,minLegATR:.75,trendSlopeATR:.03,volumeRatio5:1.2});
const flags={researchOnly:true,performanceValidated:false,affectsOriginalScore:false,affectsOriginalRanking:false,affectsOriginalEligibility:false};
const labels=['起點','1','2','3','4','5','A','B','C'],fmt=x=>Number.isFinite(x)?x.toFixed(2):'待核對';
function cleanPivots(pv){const out=[];for(const p of pv){if(out.at(-1)?.index===p.index)return {ok:false,points:[],reason:'同一天同時是重要高點與低點，日K無法知道先後。'};const last=out.at(-1);if(last?.type===p.type){if(p.type==='HIGH'?p.price>last.price:p.price<last.price)out[out.length-1]=p;}else out.push(p);}return {ok:true,points:out};}
function ruleChecks(points,direction){const sign=direction==='UP'?1:-1,v=points.map(p=>p.price*sign),confirmed=i=>!!points[i]?.confirmedAt;
 const check=(ready,pass)=>!ready?'PENDING':pass?'PASS':'FAIL';
 return {wave2AboveOrigin:check(points.length>=3,v[2]>v[0]),wave3NotShortest:check(points.length>=6&&confirmed(5),v[3]-v[2]>=Math.min(v[1]-v[0],v[5]-v[4])),wave4NoOverlap:check(points.length>=5,v[4]>v[1]),progression:check(points.length>=4,v[3]>v[1]&&(points.length<6||v[5]>v[3])),correction:check(points.length>=7,(points.length<8||v[7]<v[5]&&v[7]>v[6])&&(points.length<9||v[8]<v[6]))};
}
function trend(b,p=PARAM){const ma20=U.ma(b,20),old=U.ma(b,20,b.length-4),atr=U.atr(b,14),slope=ma20!==null&&old!==null?(ma20-old)/3:null,direction=slope===null||!(atr>0)?'UNKNOWN':slope>atr*p.trendSlopeATR?'UP':slope< -atr*p.trendSlopeATR?'DOWN':'RANGE';return {direction,ma20,ma60:U.ma(b,60),slope,atr,label:{UP:'上漲背景',DOWN:'下跌背景',RANGE:'橫盤整理',UNKNOWN:'資料不足'}[direction]};}
function evidence(b,points,direction,p){const z=b.at(-1),m=I.macd(b),last=m.at(-1),prev=m.at(-2),v5=U.mean(b.slice(-6,-1).map(x=>x.volume)),ratio=v5>0?z.volume/v5:null,sign=direction==='UP'?1:-1,p1=points[1],p3=points[3],p5=points[5];
 const rsiAt=i=>i>=14?U.rsi(b.slice(0,i+1),14):null,divergence=p3&&p5&&p3.index>=35&&p5.index>=35?{rsi:rsiAt(p3.index)!==null&&rsiAt(p5.index)!==null&&p5.price*sign>p3.price*sign&&rsiAt(p5.index)*sign<rsiAt(p3.index)*sign,macd:p5.price*sign>p3.price*sign&&m[p5.index].dif*sign<m[p3.index].dif*sign,volume:p5.price*sign>p3.price*sign&&U.mean(b.slice(Math.max(0,p5.index-4),p5.index+1).map(x=>x.volume))<U.mean(b.slice(Math.max(0,p3.index-4),p3.index+1).map(x=>x.volume))}:null;
 return {breakPreviousExtreme:!!p1&&z.close*sign>p1.price*sign,volumeRatio5:ratio,volumeIncreased:ratio!==null&&ratio>=p.volumeRatio5,macdGrowing:b.length>=35&&last&&prev?last.hist*sign>prev.hist*sign:null,rsi14:U.rsi(b,14),divergence};
}
function description(c,b,p){const stage=c.points.length-1,dir=c.direction,up=dir==='UP',e=c.evidence,tail=c.points.at(-1),forming=!tail.confirmedAt;
 let headline,plain;
 if(stage===2){headline=up?'疑似第 2 浪回檔，等待下一段':'疑似下跌第 2 浪反彈';plain='前一段走勢出現回頭整理，但還沒走出足夠的新一段，先不要提前當成第3浪。';}
 else if(stage===3){headline=up?'疑似第 3 浪主升':'疑似下跌第 3 浪延伸';plain=up?'前一段回檔沒有跌回起點，這一段已越過前高；仍要看成交量與動能能否跟上。':'反彈沒有越過原本起跌點，後續又走低；仍要核對成交量與下跌力道。';if(!e.volumeIncreased||!e.macdGrowing)plain+='目前成交量或動能還沒有一起支持，判讀仍待確認。';}
 else if(stage===4){headline=up?'疑似第 4 浪整理':'疑似下跌第 4 浪反彈整理';plain=up?'前面漲了一段，現在回頭休息；這次回檔還沒跌回第1段上漲的範圍，才保留這種數法。':'前面跌了一段，現在暫時反彈；這次還沒漲回第1段下跌的範圍，才保留這種數法。';}
 else if(stage===5){const weak=e.divergence&&(e.divergence.rsi||e.divergence.macd||e.divergence.volume);headline=up?(weak?'疑似第 5 浪末端，追高風險升高':'疑似第 5 浪延伸，留意追高風險'):'疑似下跌第 5 浪，留意反彈風險';plain=weak?(up?'股價雖然又創新高，但成交量或上漲力道沒有跟上，漲勢可能變慢；這不代表明天一定下跌。':'股價雖然又創新低，但成交量或下跌力道沒有跟上，跌勢可能變慢；這不代表明天一定反彈。'):'已經走過幾段漲跌，這一段可能接近後段；目前沒有足夠證據說一定會在這裡反轉。';}
 else {const key=labels[stage];headline='疑似艾略特 '+key+(up?' 修正浪':' 反彈修正浪');plain=up?'前面上漲後開始修正：A是第一段下跌、B是中途反彈、C是後續修正。這和原本N字的起漲點、前高、回低不同。':'前面下跌後開始反彈修正：A是第一段反彈、B是中途拉回、C是後續反彈；不能當成原本N字的ABC。';}
 if(forming)headline+='（仍待確認）';
 const boundary=stage>=6?c.points[5]:stage===5?c.points[4]:stage===4?c.points[1]:c.points[0];
 const turn=stage>=6?(up?'收盤重新站回 ':'收盤重新跌破 '):(up?'價格碰到或跌破 ':'價格碰到或漲過 ');
 return {headline,plain,clarity:c.rules.wave3NotShortest==='PENDING'||forming?'仍待確認':'較明確',reference:{label:'波浪參考價',price:boundary.price,date:boundary.pivotDate,meaning:turn+fmt(boundary.price)+'，這種數法要重新評估；不取代原本停損。'},mainScenario:'主要判讀：'+headline+'。'+plain,alternativeScenario:'備用判讀：這可能只是較大一段走勢中的小波段；'+turn+fmt(boundary.price)+'，重新檢查是否轉入修正或反彈。'};
}
function analyzeBars(b,pv=S.pivots(b),options={}){const p={...PARAM,...options.parameters},t=trend(b,p),asOf=b.at(-1)?.date,clean=cleanPivots(pv.filter(x=>x.confirmedAt&&x.confirmedAt<=asOf)),empty=(state,reason)=>({version:VERSION,state,headline:'目前無法確認波浪位置',reason,trend:t,points:[],counts:[],...flags});
 if(b.length<p.minBars)return empty('DATA_INSUFFICIENT','至少需要63根已核對的完成日K。');if(!clean.ok)return empty('UNCLEAR',clean.reason);if(t.direction==='RANGE'||t.direction==='UNKNOWN')return empty('UNCLEAR','大方向仍在橫盤或證據不足，先不硬套五浪。');
 const seq=clean.points,candidates=[],rejected=[];
 for(let start=Math.max(0,seq.length-10);start<seq.length-2;start++){
  let points=seq.slice(start).map(x=>({...x,pointStatus:'CONFIRMED'}));if(points.length>9)continue;
  const direction=points[0].type==='LOW'?'UP':'DOWN',sign=direction==='UP'?1:-1;
  const anchor=points[Math.min(3,points.length-1)],background=trend(b.slice(0,anchor.index+1),p);
  if(background.direction!==direction&&t.direction!==direction)continue;
  const last=points.at(-1),nextType=last.type==='LOW'?'HIGH':'LOW',key=nextType==='HIGH'?'high':'low',after=b.slice(last.index+1),chosen=after.reduce((best,z,i)=>!best||(nextType==='HIGH'?z[key]>best.price:z[key]<best.price)?{type:nextType,index:last.index+1+i,pivotDate:z.date,price:z[key],confirmedAt:null,pointStatus:'PENDING'}:best,null);
  const sameKey=last.type==='HIGH'?'high':'low',extension=after.reduce((best,z,i)=>(last.type==='HIGH'?z[sameKey]>best.price:z[sameKey]<best.price)?{...last,index:last.index+1+i,pivotDate:z.date,price:z[sameKey],confirmedAt:null,pointStatus:'PENDING'}:best,last);
  if(extension!==last)points[points.length-1]=extension;
  else if(points.length<9&&chosen&&(nextType==='HIGH'?chosen.price>last.price:chosen.price<last.price)&&Math.abs(chosen.price-last.price)>t.atr*p.minLegATR)points.push(chosen);
  if(points.length<3||points.slice(1).some((x,i)=>x.type===points[i].type||(x.type==='HIGH'?x.price<=points[i].price:x.price>=points[i].price)||Math.abs(x.price-points[i].price)<t.atr*p.minLegATR))continue;
  const rules=ruleChecks(points,direction);if(Object.values(rules).includes('FAIL')){rejected.push({origin:points[0].pivotDate,rules});continue;}
  const stage=points.length-1;if(stage===3&&points[3].price*sign<=points[1].price*sign)continue;
  const c={namespace:'ELLIOTT_WAVE',direction,points:points.map((x,i)=>({...x,label:labels[i],namespace:i>=6?'ELLIOTT_CORRECTION':'ELLIOTT_IMPULSE'})),rules,availableAt:asOf,evidence:evidence(b,points,direction,p)};
  const hardBoundary=stage===4?points[1].price:stage===5?points[4].price:stage===3?points[0].price:null;
  if(hardBoundary!==null&&b.slice(points.at(-1).index+1).some(z=>direction==='UP'?z.low<=hardBoundary:z.high>=hardBoundary)){rejected.push({origin:points[0].pivotDate,reason:'後續價格已碰到此數法不允許的邊界'});continue;}
  Object.assign(c,description(c,b,p));candidates.push(c);
 }
 candidates.sort((a,c)=>c.points.length-a.points.length||c.points.at(-1).index-a.points.at(-1).index||a.points[0].index-c.points[0].index);
 if(!candidates.length)return {...empty(rejected.length?'RULE_VIOLATION':'WAITING_PIVOTS',rejected.length?'目前數法違反標準浪規則，先不標浪；特殊對角線與複雜修正尚未建模。':'已確認的高低點還不足；新轉折需等待右側3根完成日K。'),rejected};
 const main=candidates[0],alternative=candidates.find(c=>c.points[0].index!==main.points[0].index)||null,disagreement=!!alternative&&alternative.direction!==main.direction||main.points.length===4&&(!main.evidence.volumeIncreased||!main.evidence.macdGrowing);
 const fibStart=main.points.length>=6?main.points[4]:main.points[0],fibEnd=main.points.length>=6?main.points[5]:main.points[1],swing={direction:main.direction,start:fibStart,end:fibEnd};
 const retracements=[.382,.5,.618,.786].map(ratio=>({ratio,price:F.fibLevelPrice(swing,ratio),label:'波浪回吐參考'}));
 return {version:VERSION,state:disagreement?'DISAGREEMENT':'RESEARCH_ONLY',date:asOf,trend:t,headline:main.headline,clarity:disagreement?'有不同解讀，先觀察':main.clarity,primary:main,alternative,counts:candidates.slice(0,2),points:main.points,rejected,retracements,fibNote:'這只是過去漲幅或跌幅回吐到哪裡，不代表碰到就一定止跌或反轉。',...flags};
}

function plainReason(reason){return String(reason||'每日資料還沒核對完整。').replace(/Worker資料契約|原本資料一致性檢查/g,'行情資料一致性檢查').replace(/OHLC/g,'開盤、最高、最低、收盤價').replace(/統計口徑|價格基準|價格調整基準/g,'計算方式').replace(/核驗/g,'核對').replace(/日K/g,'每日K線').replace(/合法跳動單位/g,'交易所允許的價格刻度');}
function evaluate(input,options={}){const r=U.normalizeInput(input),code=String(r.stock||r.code||r.instrumentType||r.index||''),date=options.asOf||r.closeDate||r.marketDate,index=['TAIEX','TPEX_INDEX'].includes(r.instrumentType||r.index),fail=reason=>U.freeze({version:VERSION,state:'DATA_INSUFFICIENT',code,date,headline:'目前無法確認波浪位置',reason:plainReason(reason),diagnosticReason:reason,points:[],bars:[],...flags});
 try{
  if(r.completed!==true||r.dailySeriesMeta?.onlyCompletedBars!==true||(r.canonicalBars||r.dailySeries||[]).some(z=>z.completed===false))return fail('尚未核對為完成日K，不使用盤中資料數浪。');
  if(options.asOf&&options.asOf!==(r.closeDate||r.marketDate))return fail('請提供截至該日的資料快照，不能用較晚資料代替。');
  let n;if(index){if(r.stock||r.code&&r.code!==r.instrumentType||r.provenance==='ILLUSTRATION')return fail('大盤身分或資料來源不一致。');n=S.confirmationInput({...r,instrumentType:r.instrumentType||r.index});if(!n.ok)return fail(n.reason);if(!n.volumeUsable)return fail('大盤成交量來源或計算範圍尚未核對。');}
  else {n=U.validate(r);if(!n.ok)return fail(n.reason);if(!r.dataContract||!W.verify(r).ok)return fail('個股行情還沒通過原本資料一致性檢查。');if(r.priceAdjustment?.verified!==true||r.priceAdjustmentConsistent===false||r.corporateActionUnresolved)return fail('價格或除權息基準還沒核對。');if(r.dailyBasisV2?.sourceVolumeWarning||r.sourceVolumeWarning||r.volumeSourceConflict||r.volumeScopeAudit?.formalVolumeEligible===false)return fail('股價與成交量來源有衝突，先停止數浪。');if(r.volumeUnit&&r.dailySeriesMeta?.volumeUnit&&r.volumeUnit!==r.dailySeriesMeta.volumeUnit)return fail('成交量股數、張數單位不一致。');const calendar=r.tradingCalendar;if(!calendar?.verified||!Array.isArray(calendar.dates)||JSON.stringify(calendar.dates.filter(d=>d>=n.bars[0].date&&d<=date))!==JSON.stringify(n.bars.map(z=>z.date)))return fail('每日資料與正式交易日曆還沒核對完整。');}
  const b=n.bars;if(!index&&b.some(z=>['open','high','low','close'].some(k=>!U.legal(z[k]))))return fail('價格不符合台股合法跳動單位。');if(!b?.length||b.at(-1).date!==date||b.at(-1).close!==r.close||b.some(z=>z.completed===false||z.volume<=0)||b.some((z,i)=>i&&Math.abs(z.close/b[i-1].close-1)>.3))return fail('收盤日期、成交量或價格連續性尚未核對。');
  const verifiedPivots=S.pivots(b);if(options.pivots&&U.hash(options.pivots)!==U.hash(verifiedPivots))return fail('轉折點與完成日K確認結果不一致。');
  const result=analyzeBars(b,verifiedPivots,options),warnings=!index&&r.priceAdjustment.corporateActionsVerified!==true?['除權息歷史未完整證實，只研究這份已核對、使用同一種計算方式的價格；遇價格斷點停止判讀。']:[];
  return U.freeze({...result,code,date,source:r.dailySeriesMeta?.source||n.source,priceBasis:r.priceAdjustment.basis,warnings,inputFingerprint:U.hash([code,r.market,date,b,r.priceAdjustment,r.dailySeriesMeta]),bars:b.map((z,i)=>({...z,index:i,ma5:U.ma(b,5,i),ma20:U.ma(b,20,i),ma60:U.ma(b,60,i)})),parameters:PARAM});
 }catch(_){return fail('波浪資料暫時無法核對，原本報告仍可使用。');}
}
// Backward-compatible fields consumed by existing unified research. One count engine only.
function legacy(b,pv,computed){const a=computed||analyzeBars(b,pv),c=a.primary,r=c?.rules,complete=c?.points.length>=6;return {version:'ELLIOTT_WAVE_STRUCTURE_RESEARCH_V1',waveCandidate:complete&&r.wave3NotShortest==='PASS'?'IMPULSE_FIVE_CANDIDATE':null,ruleValidation:r?Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v==='PENDING'?null:v==='PASS'])):null,pivots:a.points,alternativeCounts:c?.points.length>=7?['ABC_CORRECTION_CANDIDATE']:[],invalidation:c?.reference.price??null,divergence:{detected:!!c?.evidence.divergence&&(c.evidence.divergence.rsi||c.evidence.divergence.macd),peaks:[],confirmedAt:c?.points[5]?.confirmedAt||null},note:a.reason||c?.plain||a.headline,multiTimeframe:'UNKNOWN',affectsOriginalRanking:false};}
return Object.freeze({VERSION,PARAM,cleanPivots,ruleChecks,trend,analyzeBars,evaluate,legacy});
});
