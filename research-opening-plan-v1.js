/* Completed-day preparation, never a prediction of tomorrow's opening price. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./research-common-v1.js'):root.ShitouResearchCommon);if(node)module.exports=api;else root.ShitouOpeningPlan=api;})(globalThis,function(U){
'use strict';
const sourceName=x=>String(x||'歷史觀察價').replace(/MA(\d+)/g,'$1日平均價');
const VERSION='OPENING_PLAN_8_2_9',finite=Number.isFinite,price=x=>finite(x)?String(+x.toFixed(2))+' 元':'暫時算不出';
function legal(raw,side=1){if(!(raw>0&&finite(raw)))return null;const cents=side>0?Math.ceil(raw*100-1e-7):Math.floor(raw*100+1e-7);for(let n=0;n<600;n++){const x=(cents+side*n)/100;if(x>0&&U.legal(x))return x;}return null;}
function failureReason(reason){const s=String(reason||'');
 if(/日K含零量|零量或停牌/.test(s))return '研究期間有零成交量或停牌紀錄，暫停這次技術判讀';
 if(/超時|逾時|timeout|連線|服務失敗/i.test(s))return '行情服務暫時沒有回應，日線尚未取得完成';
 if(/OHLC未對齊|價格.*不同|收盤價不同/.test(s))return '兩個來源的同日價格不同，先不計算買點';
 if(/指紋|不同歷史|歷史版本/.test(s))return '回傳的歷史版本不一致，系統已暫停這次研究';
 if(/日期|不同日|HISTORY_AHEAD|STALE/i.test(s))return '個股與市場資料日期不一致，請重新取得同一天的行情';
 if(/少於|需至少|完成日K不足|歷史.*不足|HISTORY_TOO_SHORT/.test(s))return '可用的完整日線天數不足，暫時不能判斷完整趨勢';
 return s?'歷史行情未通過檢查：'+s.replace(/^資料不足[｜：:]?共用日K[：:]?/,'').trim():'日線還沒確認完整，無法安全計算買賣價';
}
function issues(a){const e=a.evidenceDiagnostics||{},v=a.validation,s=v?.verifiedDataSources?.find(x=>x.scope==='VALIDATED_DAILY_OHLCV'),u=a.unifiedResearch,list=[];
 const add=(code,reason,detail)=>list.push({code,reason,detail:detail||null});
 if(v?.technicalModelAvailable!==true)add('HISTORY',failureReason(a.reason),a.reason);
 else if(finite(v.historyBarCount)&&v.historyBarCount<63)add('HISTORY',`已完成日線只有${v.historyBarCount}天，判斷趨勢至少需要63天`,a.reason);
 else {
  if(!(u?.chart?.basisVerified??s?.priceBasisVerified))add('PRICE','系統還沒完成歷史價格比對',e.priceBasis?.reason||'還沒取得可比對的交易所逐日價格。');
  if(!(u?.chart?.calendarVerified??s?.calendarVerified))add('CALENDAR','系統還沒確認日線有沒有漏掉交易日',e.calendar?.reason||'交易日期表尚未和這次行情對齊。');
  if(a.tradeContext?.provenance?.volumeConflict||u?.structureContext?.volume?.status==='CONFLICT')add('VOLUME_CONFLICT',`兩個來源的成交量有差${finite(a.tradeContext?.provenance?.sourceVolumeDiffPct)?'（相差'+a.tradeContext.provenance.sourceVolumeDiffPct.toFixed(2)+'%）':''}，暫不靠放量訊號決定買點`,`同日成交量相差${finite(a.tradeContext?.provenance?.sourceVolumeDiffPct)?a.tradeContext.provenance.sourceVolumeDiffPct.toFixed(2)+'%':'尚未算出差距'}；股數單位已知，差異仍需系統比對，並非要求使用者補填。`);
  else if(u?.state==='RESEARCH_ONLY'&&!u.structureContext?.volume?.usable)add('VOLUME','系統還沒確認成交量的來源與單位',u.structureContext?.volume?.note);
 }
 if(e.acquisitionError)add('SERVICE','補充行情暫時沒有取得，主畫面價格仍可閱讀',e.acquisitionError);
 if(a.entryDirection?.missing?.some(x=>x.includes('跳動')))add('TICK','系統還沒確認這檔商品適用的價格跳動規則','不能只看代號就假設普通股；這是系統要核對的商品資料。');
 return list;
}
function evaluateLong(a){const z=a.sourceBars?.at(-1),u=a.unifiedResearch,p=u?.parameters||{},errors=issues(a),base={version:VERSION,code:a.code,date:a.date,dataIssues:errors,performanceValidated:false,liveIntradayAvailable:false,openingPriceKnown:false,close:finite(z?.close)?z.close:a.quote?.verified===true&&finite(a.quote.close)?a.quote.close:null};
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
 const reason=a.state==='BREAKOUT_FAILURE'?'原本看好的走勢沒有守住，這組買進理由已失效，下一交易日先不買':errors.length?errors.map(x=>x.reason).join('；'):!target?'上方歷史關卡不足，算不出合理的減碼目標，先不買':!usable?'最近上方關卡太近，或買價到停損的距離太大，這個買法不划算':state==='CONDITIONAL'?'盤後條件通過；下一交易日還要等開盤後回落守住、再轉強，不能開盤直接買':weak?'短線偏弱；先等結構轉強，不急著買':'價格或風險條件還沒完成，先觀察，不急著買';
 const volumeRatio=u?.chart?.volume?.ratio5??(f?.volumePrior5>0?z.volume/f.volumePrior5:null);
 return U.freeze({...base,state,reason,watch,watchSource:approved?'已確認情境的觀察線':sourceName(first?.source||'今天最高價'),entryRange,candidateEntry:minimum,maximumEntry:cap,stop,stopSource:approved?'已確認情境的研究停損':'今天最低價下方一格，僅作新買損失試算',target,targetSource:resistance?sourceName(resistance.source):null,usablePriceRange:usable,weak,trendText:weak?'短線偏弱':a.entryDirection?.direction?.label||'方向還不清楚',volumeText:finite(volumeRatio)?'今天交易量約為前5天平均的 '+volumeRatio.toFixed(2)+' 倍':'',rrAtCandidate:rr,costs:{fee,tax,slippage,minRR,minSpacePct:minSpace,maxStopPct:maxStop},currentLow:z.low,openingRules:[{kind:'LOWER',text:`開盤低於${price(stop)}：原計畫取消，不接下跌中的價格。`},{kind:'INSIDE',text:entryRange?`開盤在${price(entryRange.low)}～${price(entryRange.high)}：先等至少一根5分鐘K收完；回落守住${price(watch)}後，再越過前一根5分鐘K高點，才在這個範圍內評估。`:'目前沒有同時滿足價格與風險的買價範圍，開盤先不買。'},{kind:'HIGHER',text:entryRange?`開盤高於${price(entryRange.high)}：不追價；等回落後建立新計畫。`:`即使開盤漲過${price(watch)}，也只代表漲過觀察線，不能直接買。`}],note:'明日實際開盤與5分鐘行情尚未出現，本頁未提供即時盤中確認；請用券商畫面核對。已有持股者另按成本、部位與可承受損失訂計畫。'});
}
function atOpen(plan,value){const open=typeof value==='number'?value:Number(String(value).trim());if(!(open>0&&finite(open)))return {state:'INVALID',text:'請輸入有效的實際開盤價。'};
 const good=plan.state==='CONDITIONAL'&&!!plan.entryRange;
 if(plan.stop>0&&open<=plan.stop)return {state:'CANCEL',text:good?`開盤${price(open)}已到或低於停損試算${price(plan.stop)}，原買進計畫取消；不先買再等反彈。`:`開盤${price(open)}已到或低於防守試算${price(plan.stop)}。目前沒有成立的新買進計畫；這不是既有持股的賣出指令。`};
 if(plan.state==='DATA')return {state:'WAIT_DATA',text:`開盤${price(open)}；${plan.reason}。目前不提供可下單的買價範圍。`};
 if(!plan.entryRange)return {state:'NO_TRADE',text:`開盤${price(open)}；${plan.reason}。今天先觀察。`};
 if(open>plan.entryRange.high)return {state:'NO_CHASE',text:`開盤${price(open)}高於${good?'買價上限':'價格試算上限'}${price(plan.entryRange.high)}，不要追價。${good?'':'盤後條件尚未完成，這不是可執行的買進計畫。'}`};
 if(open<plan.entryRange.low)return {state:'WAIT_RECLAIM',text:`開盤${price(open)}尚未到${price(plan.entryRange.low)}，不能因為便宜就先買。${good?'仍須依完整計畫核對回落與再轉強條件。':'盤後條件尚未完成，先觀察。'}`};
 return {state:'WAIT_CONFIRMATION',text:good?`開盤${price(open)}在試算範圍內，仍不是直接買進訊號。先等至少一根5分鐘K收完；回落守住${price(plan.watch)}，再越過前一根5分鐘K高點，才在${price(plan.entryRange.low)}～${price(plan.entryRange.high)}評估。停損試算${price(plan.stop)}；減碼參考${price(plan.target)}。本頁沒有即時5分鐘行情。`:`開盤${price(open)}在價格試算範圍內，但盤後條件尚未完成，目前沒有成立的新買進計畫。`};
}
function bearishPlan(a,long){
 const b=a.sourceBars||[],z=b.at(-1);if(!z||a.validation?.technicalModelAvailable!==true)return {state:'DATA',watch:null,entryRange:null,stop:null,target:null};
 const refs=a.entryDirection?.knownLevels||[],lower=[...refs,{type:'LOW',price:z.low,source:'當日低點，僅作轉弱觀察'}].filter(x=>x.type==='LOW'&&x.price<=z.close).sort((x,y)=>y.price-x.price),watch=lower[0]?.price??Math.min(...b.slice(-20).map(x=>x.low));
 const entry=U.step(legal(watch,-1),-1),upper=refs.filter(x=>x.type==='HIGH'&&x.price>z.close).sort((x,y)=>x.price-y.price);
 const stop=U.step(legal(Math.max(upper[0]?.price??z.high,z.high),1),1),target=lower.find(x=>x.price<entry)?.price??null,c=long.costs||{},fee=(c.fee??.001425),tax=c.tax??.003,slip=c.slippage??.001,rr=c.minRR??1.5,space=c.minSpacePct??2,maxStop=c.maxStopPct??8,proceeds=(1-slip)*(1-fee-tax),cover=(1+slip)*(1+fee);
 const minimum=target>0&&stop>entry?legal(Math.max(cover*(target+rr*stop)/((1+rr)*proceeds),target/(1-space/100),stop/(1+maxStop/100)),1):null;
 const entryRange=minimum>0&&minimum<=entry&&!long.dataIssues.length?{low:minimum,high:entry}:null,dir=a.entryDirection?.direction?.code;
 return {state:long.dataIssues.length?'DATA':!entryRange?'NO_TRADE':['BEAR','REBOUND'].includes(dir)?'WATCH':'COUNTER_TREND',watch,entryRange,stop,target,borrowVerified:false,borrowCostIncluded:false,costs:{fee,tax,slippage:slip,minRR:rr,minSpacePct:space,maxStopPct:maxStop},note:'空單是先賣後買；漲到停損價要買回。券源、放空資格與借券費尚未確認，這是情境試算。'};
}
function evaluate(a){const long=evaluateLong(a);return U.freeze({...long,bear:bearishPlan(a,long),historyBars:a.validation?.historyBarCount||0,directionCode:a.entryDirection?.direction?.code||'UNKNOWN',directionLabel:a.entryDirection?.direction?.label||long.trendText||'方向暫時無法判斷',officialHistory:!!a.evidenceDiagnostics?.officialHistoryEvidence});}
// Read-only wording from the same validated bars. These descriptions never gate a trade.
function plainContext(a){
 if(a?.validation?.technicalModelAvailable!==true)return null;
 const b=a.sourceBars||[],z=b.at(-1),previous=b.at(-2),m=a.features?.ma?.[20];
 if(!z||!finite(z.close)||z.close<=0||a.date&&z.date!==a.date)return null;
 let direction='',directionDetail='';
 if(finite(m?.value)&&m.value>0){
  const gap=z.close-m.value,near=Math.abs(gap)<.005,relation=near?'接近':gap>0?'高於':'低於',slope=m.slope;
  const trend=!finite(slope)?'平均價的方向還缺少資料。':slope<0?(Math.abs(slope)<1?'平均價還略往下走，轉強仍需確認。':'平均價仍往下走，先等價格回穩。'):slope>0?(gap<0?'平均價仍往上，但股價還沒站回。':'平均價也在往上，仍要看價格能否守穩。'):'平均價大致持平，先等方向更清楚。';
  direction=`收盤${price(z.close)}，${relation}最近20個交易日平均${price(m.value)}。\n${trend}`;
  directionDetail=direction+`\n這是最近20個交易日收盤價的平均。${near?'兩者接近。':`相差${price(Math.abs(gap))}，約${(Math.abs(gap)/m.value*100).toFixed(2)}%。`}`+(finite(slope)?`平均價比${U.PARAM.slopeBars}個交易日前${slope>0?'增加':slope<0?'減少':'持平'}${Math.abs(slope).toFixed(2)}%。`:'');
 }
 const v=a.unifiedResearch?.structureContext?.volume,conflict=v?.status==='CONFLICT'||a.tradeContext?.provenance?.volumeConflict;
 if(conflict||v?.usable!==true)return U.freeze({direction,directionDetail,volumeShort:conflict?'成交量來源有差異，先不解讀量增減。':'成交量來源還沒核對，先不解讀量增減。',volumeDetail:conflict?'兩個來源或單位尚未對齊，不能只靠其中一個量比判斷回穩。':'成交量來源或單位尚未通過核對；保留價格觀察，不推測買賣力道。',volumeVerified:false});
 const day=previous?.volume>0&&finite(z.volume)?(z.volume/previous.volume-1)*100:null,ratio=finite(v.ratio5)?v.ratio5:null;
 const change=finite(day)?Math.round(Math.abs(day))===0?'量和昨天差不多':`量比昨天${day>0?'多':'少'}約${Math.round(Math.abs(day))}%`:finite(ratio)?`量約為前5天平均的${ratio.toFixed(2)}倍`:'交易量還缺少比較基準';
 const location=a.features?.candle?.closeLocation,down=previous&&z.close<previous.close;
 const observation=finite(location)&&location<=.25?(down?'收盤仍近低點':'收盤靠近低點'):finite(location)&&location>=.75?'收盤接近高點':down?'價格仍比昨天下跌':previous&&z.close>previous.close?'價格比昨天高':'價格方向仍待確認';
 const interpretation=finite(location)&&location<=.25&&down?'交易量變少或變多，都還沒改變收盤偏弱的現況；先看價格能否回穩。':down?'今天仍較昨天下跌；量能變化需搭配後續價格一起看。':'收盤位置只說明今天的價格表現，後續仍需守穩並確認原有條件。';
 const volumeDetail=(finite(day)?day===0?'今天量與昨天相同。':`今天量比昨天${day>0?'多':'少'}${Math.abs(day).toFixed(2)}%。`:'昨天成交量不足，無法比較。')+(finite(ratio)?`約為前5天平均的${ratio.toFixed(2)}倍，平均不含今天。`:'前5天均量尚未取得。')+`\n${observation}。${interpretation}\n成交量本身無法辨認是誰買賣，也不能直接確認洗盤或出貨。`;
 return U.freeze({direction,directionDetail,volumeShort:change+'，'+observation+'。',volumeDetail,volumeVerified:true});
}
function summary(plan,prior,a){if(!plan)return prior;
 const fields=prior.map(x=>({...x})),issues=plan.dataIssues||[],failed=/買進理由已失效/.test(plan.reason||'');
 const good=plan.state==='CONDITIONAL'&&!!plan.entryRange&&!failed&&!issues.length,data=plan.state==='DATA';
 const context=!data?plainContext(a):null;
 const decision=failed?'🔴 原買進理由已失效，先不買':data?'⚪ 先不下單：'+(issues[0]?.reason||plan.reason):good?'🟠 盤後條件通過，仍須盤中確認':plan.weak?'🔴 短線偏弱，先觀察':'🟠 先觀察，尚無新買進計畫';
 fields[0]={title:'目前股價是什麼狀況？',value:decision+'\n'+(context?.direction||(data&&plan.weak?'可計算部分顯示短線偏弱；':'')+(plan.directionLabel||'方向尚未確認')+'；'+(data?'行情尚未完成核對。':`${plan.historyBars}天日線已核對。`))};
 const watch=plan.watch>0?plan.close<plan.watch?`先看收盤能否站回${price(plan.watch)}。\n後續若又跌回，就還沒站穩。`:`先看${price(plan.watch)}能否守穩，後續是否跌回下方。`:'先等價格方向更清楚。';
 fields[1]={title:'還沒買，接下來看什麼？',value:data?(a?.quote?.verified===true&&plan.close>0?`同日官方收盤${price(plan.close)}已取得，但完整日線尚未通過，暫不列買價。`:'行情尚未核對完成，暫不列買價。'):good?`僅在盤中確認後，才評估${price(plan.entryRange.low)}～${price(plan.entryRange.high)}；超過不追。\n完整確認方式見研究明細。`:`${watch}\n碰到觀察價不等於買點，目前尚無符合條件的新買進計畫。`};
 fields[2]={title:'圖上的價位代表什麼？',value:data?'行情尚未通過，暫不列防守與上方價位。':good?`本次新買計畫：停損試算${price(plan.stop)}；減碼參考${price(plan.target)}。\n已有持股，仍依自己的原計畫管理。`:(plan.target>0?`上方參考關卡：${price(plan.target)}。`:'上方歷史關卡不足，不預設目標。')+'\n'+(plan.stop>0?`防守試算：${price(plan.stop)}，不是統一賣出價。`:'暫不列防守試算。')+'\n已有持股，仍依自己的原計畫管理。'};
 fields[3]={title:'交易量變了，代表什麼？',value:data?'行情尚未核對完成，先不解讀量增減。':context?context.volumeShort+(context.volumeVerified?'\n單憑量增減，不能確認轉強或洗盤。':''): '成交量缺少可核對的比較基準，先不推測買賣力道。'};
 fields[4]={title:'下一個交易日觀察什麼？',value:data?'先等系統完成行情核對，再重新評估。':failed?'原買進理由已失效，先等新的條件形成。':good?`先等至少一根5分鐘K收完，再核對回落與再轉強條件；不能開盤直接買。本頁沒有即時盤中確認。`:(plan.watch>0?plan.close<plan.watch?`往上：先等${price(plan.watch)}收盤站上。`:`往上：先看${price(plan.watch)}能否繼續守住。`:'先等價格回穩。')+(plan.currentLow>0?`\n往下：若跌破當日低點${price(plan.currentLow)}，觀察是否繼續走低。`:'')};
 return fields;
}
function plainDetails(a){const context=plainContext(a);return context?[{title:'現在的股價，用白話怎麼看',value:context.directionDetail||'20天平均價尚未取得，暫不比較。'},{title:'交易量變了，代表什麼',value:context.volumeDetail}]:[];}
function details(plan){if(!plan)return [];
 const data=plan.state==='DATA',good=plan.state==='CONDITIONAL'&&!!plan.entryRange&&!plan.dataIssues.length,bear=plan.bear;
 const levels=data?'行情尚未完成核對，暫不列價位。':(good?'以下停損與減碼僅適用於本次條件式新買計畫。':'目前沒有成立的新買進計畫，以下是觀察與試算，不能拼成買賣指令。')+'\n'+(plan.watch>0?`觀察關卡 ${price(plan.watch)}（${plan.watchSource}）；碰到不等於買點。\n`:'')+(plan.target>0?`上方參考關卡 ${price(plan.target)}（${plan.targetSource}）；${good?'只作本次計畫的減碼參考':'目前不稱為減碼點，也不保證形成賣壓'}。`:'上方歷史關卡不足，不預設目標。');
 const opening=data?'行情尚未核對完成，先不依此建立買進計畫。':good?(plan.openingRules||[]).map(x=>x.text).join('\n'):'目前沒有成立的新買進計畫。即使開盤越過觀察價，或落在價格試算範圍內，也不能直接買進。\n原因：'+plan.reason+'。';
 return [{title:'觀察價、買價與減碼價怎麼分',value:levels},
 {title:'防守試算與既有持股怎麼分',value:data?'行情未通過，暫不列防守試算。':`防守試算 ${price(plan.stop)}；${plan.stopSource}。\n這不是已確認支撐，也不是所有持股者共同的停損價。已有持股，仍依自己的成本、部位與原本計畫管理。`},
 ...(bear?[{title:'空方情境｜尚未成立可執行計畫',value:data?'行情未通過，暫不列空方價位。':'這是獨立的空方試算，不能和多方價位混成同一套計畫。\n'+(bear.watch>0?`若跌破 ${price(bear.watch)}，觀察是否繼續走低；單次跌破不等於放空訊號。\n`:'')+(bear.entryRange&&bear.state==='WATCH'?`價格與風險試算區間 ${price(bear.entryRange.low)}～${price(bear.entryRange.high)}；仍需依空方條件確認，不能碰到就放空。\n`:'目前沒有同時符合方向、價格與風險的放空觀察區間。\n')+(bear.stop>0?`空單停損試算 ${price(bear.stop)}${bear.target>0?'；獲利回補參考 '+price(bear.target):''}，僅適用於這套空方假設。\n`:'')+'券源、放空資格與借券費尚未確認，目前不能視為可執行的放空計畫。'}]:[]),
 {title:'下一交易日開盤怎麼判斷',value:opening+'\n'+(plan.note||'本頁沒有即時盤中確認。')},
 {title:'這次買進條件通過了嗎',value:plan.dataIssues.length?plan.dataIssues.map(x=>x.reason+'：'+(x.detail||'系統會在下次查詢重新比對。')).join('\n'):good?'盤後條件已通過，但下一交易日仍須核對盤中條件，本頁不會自動確認買進訊號。':'尚未成立新買進計畫。原因：'+plan.reason+'。'}];
}
return Object.freeze({VERSION,evaluate,failureReason,issues,atOpen,bearishPlan,summary,details,plainContext,plainDetails,legal,price});
});
