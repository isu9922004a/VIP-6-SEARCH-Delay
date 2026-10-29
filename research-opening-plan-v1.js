/* Completed-day preparation, never a prediction of tomorrow's opening price. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon);if(node)module.exports=api;else root.ShitouOpeningPlan=api;})(globalThis,function(U){
'use strict';
const VERSION='OPENING_PLAN_8_2_7',finite=Number.isFinite,price=x=>finite(x)?String(+x.toFixed(2))+' 元':'暫時算不出';
function legal(raw,side=1){if(!(raw>0&&finite(raw)))return null;const cents=side>0?Math.ceil(raw*100-1e-7):Math.floor(raw*100+1e-7);for(let n=0;n<600;n++){const x=(cents+side*n)/100;if(x>0&&U.legal(x))return x;}return null;}
function issues(a){const e=a.evidenceDiagnostics||{},v=a.validation,s=v?.verifiedDataSources?.find(x=>x.scope==='VALIDATED_DAILY_OHLCV'),u=a.unifiedResearch,list=[];
 const add=(code,reason,detail)=>list.push({code,reason,detail:detail||null});
 if(v?.technicalModelAvailable!==true)add('HISTORY','日線還沒確認完整，無法安全計算買賣價',a.reason);
 else if(finite(v.historyBarCount)&&v.historyBarCount<63)add('HISTORY',`已完成日線只有${v.historyBarCount}天，判斷趨勢至少需要63天`,a.reason);
 else {
  if(!(u?.chart?.basisVerified??s?.priceBasisVerified))add('PRICE','系統還沒完成歷史價格比對',e.priceBasis?.reason||'還沒取得可比對的交易所逐日價格。');
  if(!(u?.chart?.calendarVerified??s?.calendarVerified))add('CALENDAR','系統還沒確認日線有沒有漏掉交易日',e.calendar?.reason||'交易日期表尚未和這次行情對齊。');
  if(a.tradeContext?.provenance?.volumeConflict||u?.structureContext?.volume?.status==='CONFLICT')add('VOLUME_CONFLICT','兩個來源的成交量有差，暫不靠放量訊號決定買點',`同日成交量相差${finite(a.tradeContext?.provenance?.sourceVolumeDiffPct)?a.tradeContext.provenance.sourceVolumeDiffPct.toFixed(2)+'%':'尚未算出差距'}；股數單位已知，差異仍需系統比對，並非要求使用者補填。`);
  else if(u?.state==='RESEARCH_ONLY'&&!u.structureContext?.volume?.usable)add('VOLUME','系統還沒確認成交量的來源與單位',u.structureContext?.volume?.note);
 }
 if(e.acquisitionError)add('SERVICE','補充行情暫時沒有取得，主畫面價格仍可閱讀',e.acquisitionError);
 if(a.entryDirection?.missing?.some(x=>x.includes('跳動')))add('TICK','系統還沒確認這檔商品適用的價格跳動規則','不能只看代號就假設普通股；這是系統要核對的商品資料。');
 return list;
}
function evaluate(a){const z=a.sourceBars?.at(-1),u=a.unifiedResearch,p=u?.parameters||{},errors=issues(a),base={version:VERSION,code:a.code,date:a.date,dataIssues:errors,performanceValidated:false,liveIntradayAvailable:false,openingPriceKnown:false,close:finite(z?.close)?z.close:null};
 if(!z||a.validation?.technicalModelAvailable!==true)return U.freeze({...base,state:'DATA',reason:a.state==='DISABLED'?'四策略研究已關閉，暫不產生買賣價位。':errors[0]?.reason||'日線尚未準備完成，今天先不要依此下單',entryRange:null,stop:null,target:null,watch:null,openingRules:[]});
 const f=a.features,upper=(u?.levels||[]).filter(x=>finite(x.price)&&x.price>z.close).sort((a,b)=>a.price-b.price);
 for(const [k,m] of Object.entries(f?.ma||{}))if([5,10,20,60].includes(+k)&&m.value>z.close)upper.push({price:m.value,source:k+'日平均價'});
 if(z.high>z.close)upper.push({price:z.high,source:'今天最高價'});upper.sort((a,b)=>a.price-b.price);
 const scenarios=u?.scenarios||[],approved=scenarios.find(x=>x.applicable!==false&&x.signalStatus==='CONFIRMED'&&x.riskDecision==='ACCEPTABLE_FOR_EVALUATION'&&x.riskReward?.status==='KNOWN');
 const weak=['BEAR','REBOUND','SIDEWAYS'].includes(a.entryDirection?.direction?.code)||z.close<f?.ma?.[20]?.value;
 const first=upper[0],watch=approved?.triggerPrice>0?Math.max(approved.triggerPrice,z.close):first?.price??z.high;
 const roundedWatch=legal(watch,1),minimum=approved?legal(Math.max(watch,z.close),1):roundedWatch>watch?roundedWatch:U.step(roundedWatch,1);
 // The low is an explicit hypothetical loss boundary, never promoted into proven support.
 const stop=approved?.riskReward?.stop>0?approved.riskReward.stop:U.step(legal(z.low,-1),-1);
 const resistance=upper.find(x=>x.price>watch+1e-7),target=resistance?.price??null;
 const fee=(p.fee??.001425)*(p.feeDiscount??1),tax=p.tax??.003,slippage=p.slippage??.001,minRR=p.minRR??1.5,minSpace=p.minSpacePct??2,maxStop=p.maxStopPct??8,bc=(1+slippage)*(1+fee),sc=(1-slippage)*(1-fee-tax);
 const cap=target>stop&&stop>0?legal(Math.min(sc*(target+minRR*stop)/(bc*(1+minRR)),target/(1+minSpace/100),stop/(1-maxStop/100)),-1):null;
 const usable=finite(minimum)&&finite(cap)&&stop<minimum&&minimum<=cap,entryRange=usable&&!errors.length?{low:minimum,high:cap}:null;
 const costRisk=minimum>stop?minimum*bc-stop*sc:null,costReward=target>0?target*sc-minimum*bc:null,rr=costRisk>0&&costReward>0?costReward/costRisk:null;
 let state=a.state==='BREAKOUT_FAILURE'?'NO_TRADE':errors.length?'DATA':!usable?'NO_TRADE':a.entryDirection?.entry==='EVALUATE'&&approved&&!weak&&a.state!=='BREAKOUT_FAILURE'?'CONDITIONAL':'WAIT';
 const reason=a.state==='BREAKOUT_FAILURE'?'原本看好的走勢沒有守住，這組買進理由已失效，明天先不買':errors.length?errors.map(x=>x.reason).join('；'):!target?'上方歷史關卡不足，算不出合理的減碼目標，先不買':!usable?'最近上方關卡太近，或買價到停損的距離太大，這個買法不划算':state==='CONDITIONAL'?'盤後條件通過；明天還要等開盤後回落守住、再轉強，不能開盤直接買':weak?'短線偏弱；先等結構轉強，不急著買':'價格或風險條件還沒完成，先觀察，不急著買';
 const volumeRatio=u?.chart?.volume?.ratio5??(f?.volumePrior5>0?z.volume/f.volumePrior5:null);
 return U.freeze({...base,state,reason,watch,watchSource:approved?'已確認情境的觀察線':first?.source||'今天最高價',entryRange,candidateEntry:minimum,maximumEntry:cap,stop,stopSource:approved?'已確認情境的研究停損':'今天最低價下方一格，僅作新買損失試算',target,targetSource:resistance?.source||null,usablePriceRange:usable,weak,trendText:weak?'短線偏弱':a.entryDirection?.direction?.label||'方向還不清楚',volumeText:finite(volumeRatio)?'今天交易量約為前5天平均的 '+volumeRatio.toFixed(2)+' 倍':'',rrAtCandidate:rr,costs:{fee,tax,slippage,minRR,minSpacePct:minSpace,maxStopPct:maxStop},currentLow:z.low,openingRules:[{kind:'LOWER',text:`開盤低於${price(stop)}：原計畫取消，不接下跌中的價格。`},{kind:'INSIDE',text:entryRange?`開盤在${price(entryRange.low)}～${price(entryRange.high)}：先等至少一根5分鐘K收完；回落守住${price(watch)}後，再越過前一根5分鐘K高點，才在這個範圍內評估。`:'目前沒有同時滿足價格與風險的買價範圍，開盤先不買。'},{kind:'HIGHER',text:entryRange?`開盤高於${price(entryRange.high)}：不追價；等回落後建立新計畫。`:`即使開盤漲過${price(watch)}，也只代表漲過觀察線，不能直接買。`}],note:'明日實際開盤與5分鐘行情尚未出現，本頁未提供即時盤中確認；請用券商畫面核對。已有持股者另按成本、部位與可承受損失訂計畫。'});
}
function atOpen(plan,value){const open=typeof value==='number'?value:Number(String(value).trim());if(!(open>0&&finite(open)))return {state:'INVALID',text:'請輸入有效的實際開盤價。'};
 if(plan.stop>0&&open<=plan.stop)return {state:'CANCEL',text:`開盤${price(open)}已到或低於停損試算${price(plan.stop)}，原買進計畫取消；不先買再等反彈。`};
 if(plan.state==='DATA')return {state:'WAIT_DATA',text:`開盤${price(open)}；${plan.reason}。目前不提供可下單的買價範圍。`};
 if(!plan.entryRange)return {state:'NO_TRADE',text:`開盤${price(open)}；${plan.reason}。今天先觀察。`};
 if(open>plan.entryRange.high)return {state:'NO_CHASE',text:`開盤${price(open)}高於買價上限${price(plan.entryRange.high)}，不要追價。`};
 if(open<plan.entryRange.low)return {state:'WAIT_RECLAIM',text:`開盤${price(open)}尚未到${price(plan.entryRange.low)}，先等站回觀察線並回落守住，不能因為便宜就先買。`};
 return {state:'WAIT_CONFIRMATION',text:`開盤${price(open)}在試算範圍內；${plan.state==='CONDITIONAL'?'仍須確認開盤後守穩再轉強':'但盤後條件尚未完成，現在先不買'}。若之後符合條件，買價不超過${price(plan.entryRange.high)}；停損試算${price(plan.stop)}，第一個減碼觀察${price(plan.target)}。`};
}
function summary(plan,prior){if(!plan)return prior;const fields=prior.map(x=>({...x}));
 const status=plan.state==='CONDITIONAL'?'🟢 可列入明天觀察，開盤仍要等確認':plan.state==='DATA'?'⚪ 行情還沒確認完整，明天先不掛買單':plan.state==='NO_TRADE'?'🔴 這個買法不划算，明天先不買':'🟠 明天先觀察，現在還沒有買點';
 const evidence=plan.dataIssues.map(x=>x.reason).join('；');
 fields[0].value=status+'\n'+(plan.trendText?'方向：'+plan.trendText+'。':'')+plan.reason+(plan.volumeText?'\n'+plan.volumeText:'');
 fields[1].value=!plan.watch?'歷史日線尚未確認完整，目前不能列出買進觀察價。':plan.entryRange?`先看${price(plan.watch)}能否守住。只有確認守穩再轉強，且其他條件通過時，才評估${price(plan.entryRange.low)}～${price(plan.entryRange.high)}；超過上限不追。\n${plan.state==='CONDITIONAL'?'不是明天開盤直接掛單的價格。':'目前條件還沒完成，以上只是觀察試算。'}`:`先觀察${price(plan.watch)}能否重新站上並守穩。\n目前沒有合適的買價範圍，明天開盤先不買。`;
 if(plan.stop>0)fields[2].value=`新買停損試算：${price(plan.stop)}（${plan.stopSource}，這不是已確認支撐）。若按此計畫買進，盤中跌到此價就執行原先的退出計畫，不等收盤；跳空可能以更差價格成交。\n沒有買進就不會因碰到此價而自動賣出。`;
 fields[3].value=plan.target>0?`第一個減碼觀察：${price(plan.target)}（${plan.targetSource}）。到附近先看是否受阻，不預設一定到。${plan.entryRange?'':`\n以${price(plan.candidateEntry)}買、${price(plan.stop)}停損，最近關卡前的空間不足，所以不採用這組買法。`}`:'上方歷史關卡不足，不猜停利價；先不建立新的買進計畫。';
 fields[4].value=plan.state==='CONDITIONAL'?`買價不超過${price(plan.entryRange.high)}、停損試算${price(plan.stop)}；先等開盤後守穩再轉強。`:evidence?evidence+'；這是系統要完成的比對，不需要你補填資料。明天先不買。':plan.reason+'；先等結構轉強，不急著買。';
 return fields;
}
function details(plan){if(!plan)return [];return [{title:'明天開盤怎麼判斷',value:(plan.openingRules||[]).map(x=>x.text).join('\n')+'\n'+(plan.note||'日線尚未確認完整，不建立買進計畫。')},{title:'為什麼現在不能下單',value:plan.dataIssues.length?plan.dataIssues.map(x=>x.reason+'：'+(x.detail||'系統會在下次查詢重新比對。')).join('\n'):'目前沒有未完成的基本行情比對。若仍不能買，是價格、趨勢或風險條件沒有通過，不是請使用者補資料。'}];}
return Object.freeze({VERSION,evaluate,issues,atOpen,summary,details,legal,price});
});
