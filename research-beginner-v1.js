/* Shared explanations only: no recalculation of signals, eligibility or ranking. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./research-common-v1.js'):root.ShitouResearchCommon);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouResearchBeginner=api;})(globalThis,function(U){
'use strict';
const VERSION='BEGINNER_EXPLANATIONS_8_2_7',finite=Number.isFinite;
const number=x=>finite(x)?String(+x.toFixed(2)):'尚無資料',money=x=>finite(x)?number(x)+'元':'尚未確認';
const percent=x=>finite(x)?String(+(x*100).toFixed(4))+'%':'尚未設定';
const stages={NOT_FORMED:'還找不到清楚的「漲一段、退一些、再上攻」走勢',AB_CONFIRMED:'已看到第一段上漲，還要等回落後止跌',C_CANDIDATE:'可能正在止跌，還沒有足夠後續日K確認',C_CONFIRMED:'回落低點已確認，接下來看能否越過前高',WAIT_NEW_C:'前次回落低點已被跌破，先等新的止跌位置',BREAKOUT_CONFIRMED:'收盤已越過前高，仍要檢查成交量與追價風險',RETEST_PENDING:'越過前高後正在回來測試，還要等守穩',RETEST_CONFIRMED:'回來測試後已再轉強，仍須檢查買進風險',RETEST_FAILED:'回來測試時沒有守住，原買進想法要重查',PROJECTION_TOUCHED:'曾碰到試算價，這不代表真的成交或賺到',INVALIDATED:'已跌到起漲低點，原本的上漲走勢假設不成立',AMBIGUOUS:'同一天碰到風險價與試算價，日K看不出先後'};
const dead=q=>q&&['WAIT_NEW_C','RETEST_FAILED','INVALIDATED','AMBIGUOUS','PROJECTION_TOUCHED'].includes(q.stage);
function stage(n){return stages[n?.stage]||(n?.state==='DISABLED'?'這項走勢研究已關閉':n?.state==='DATA_INSUFFICIENT'?'日K資料不足或未確認，現在無法判讀':'暫時無法判讀這項走勢');}
function volumeText(v={}){
 const ratio=finite(v.ratio5)?`今天交易量約為前5天平均的 ${number(v.ratio5*100)}%（${number(v.ratio5)}倍）。`:'資料不足，現在算不出今天比平常熱絡多少。';
 const caution=v.status==='CONFLICT'?'來源數字尚未對齊，不能確認放量或縮量。':v.usable?'平均不含今天；量多不代表一定上漲，也不能證明主力買進。':'交易量來源還沒確認，暫不用它判斷買點。';
 return {ratio,caution,text:ratio+caution};
}
function riskText(rr){
 if(!rr||rr.status==='UNKNOWN'||!finite(rr.rr))return '防守價或上方關卡不足，現在算不出這筆買進是否划算。';
 if(rr.status==='BLOCKED'||rr.rr<=0)return '扣掉交易成本後，到最近壓力前已沒有正的預估報酬，不適合靠這個空間買進。';
 return `每承擔1元風險，到最近壓力的預估報酬約${number(rr.rr)}元（已扣交易成本）。這是風險報酬比，不是勝率。`;
}
function projectionText(n){const q=n?.pattern;if(!q)return '沒有清楚的三個轉折點，先不猜測上漲目標。';return `${dead(q)?'舊走勢的':'假設再漲第一段的距離，'}試算價（D）為${money(q.projection.price)}。${dead(q)?'原計畫已停止採用，不能把它當成本次目標。':'只是估算，不是保證會到的目標，也不是已確認的壓力。'}`;}
function chartContext(a,d){const n=a.nContinuation,q=n?.pattern;
 const definitions=[['這段走勢的突破觀察價',d.trigger,'收盤跨過後仍要守穩；漲到這裡前，也要先留意最近上方壓力。'],['原買進想法何時要重查',d.invalidation,'這是該情境的失效線，不保證能在此成交停損。'],['下跌先觀察哪裡',d.defenseReference,'先觀察能否守住；尚不能當成已確認支撐或直接設停損。'],['最近上方壓力',d.nextResistance?.price,'漲近這裡可能遇到賣壓，要先看能否過關。']];
 const levels=definitions.map(([title,price,explanation],i)=>({title,price:finite(price)?price:null,explanation:finite(price)?explanation:i===1?'尚無已確認的買進情境，所以沒有可直接沿用的失效線。':'資料不足，先不猜價位。'}));
 const points=q?`A ${money(q.A.price)}＝第一段起漲低點；B ${money(q.B.price)}＝那一段高點；C ${money(q.C.price)}＝後來回落低點${q.provisional?'（還待確認）':''}。`:'A是起漲低點、B是那一段高點、C是後來回落低點；這檔目前沒有完整三點。';
 return {levels,volume:volumeText(d.volume),stage:stage(n),points,projection:projectionText(n)};
}
function parameterFields(a){const n=a.nContinuation,p=n?.parameters,z=a.sourceBars?.at(-1),f=a.features,valid=a.validation?.technicalModelAvailable===true;
 const ma=[5,20,60].map(k=>{const v=f?.ma?.[k]?.value;return `${k}日均價（MA${k}）：${valid?money(v):'資料待確認'}。把最近${k}個交易日收盤價取平均，${k===5?'看最近幾天':k===20?'看近一個月':'看近一季'}的方向${valid&&finite(v)&&finite(z?.close)?`；目前收盤在它${z.close>v?'上方':z.close<v?'下方':'附近'}`:''}。`;}).join('\n');
 const v=a.unifiedResearch?.chart?.volume||n?.chart?.volume||{};
 const fields=[...strategyParameters(a),{title:'均線與成交量怎麼看',value:ma+'\n'+volumeText(v).text+'\n日K一根代表一個交易日；此圖紅色表示收盤高於或等於開盤，綠色表示低於開盤。虛線是觀察用參考，碰到線不等於買賣訊號。'},
 {title:'其他技術數字怎麼看',value:'RSI（強弱值）：看近期漲跌力道；數字高可能強，也可能已漲多，不能只看高低買進。\nKD：看收盤在近期高低範圍的位置；K、D交叉只是一個線索。MACD看不同天期均價的差距；DIF是快慢均價差，訊號線是DIF的平滑值，OSC是兩者差額。都要搭配價格走勢。\n乖離：股價離均價多遠，以百分比表示；離太遠要留意追價。ATR：最近平均波動，用來留一點價格緩衝，不代表最大可能損失。\n支撐是可能出現買盤的位置；壓力是可能遇到賣壓的位置，都可能被突破。跳空是開盤和前一天價格有落差，原本的進場試算要重算。'}];
 if(p)fields.push({title:'這檔N字試算規則怎麼看',value:`轉折確認：比較前${p.pivotLeft}天和後${p.pivotRight}天的高低點，所以低點發生當天還不能立刻確認。回測範圍與防守緩衝採平均波動的${number(p.zoneATR)}倍；突破B還要跨過這檔股票可交易的下一格價格，不能只碰到前高。\n突破／回測的量能條件：至少是前5天平均的${number(p.volume)}倍，${number(p.volume)}倍就是比平常${p.volume>=1?"多":"少"}${number(Math.abs(p.volume-1)*100)}%；C點止跌則看今天是否比昨天多。這些是研究門檻，達到也不代表一定漲。\n到最近壓力的成本後報酬，至少要是風險的${number(p.minRR)}倍；假設停損距離不超過買價的${number(p.maxStopPct)}%，到最近壓力至少還有${number(p.minSpacePct)}%空間。資料未確認或條件不足，就先等。\n成本假設：每次手續費${percent(p.fee*p.feeDiscount)}；賣出稅${percent(p.tax)}；買賣各預留${percent(p.slippage)}的成交價偏差。實際費率和成交價因人而異，買前要重算。`});
 return fields;
}
function strategyParameters(a){const f=a.features,p=U.PARAM,u=a.unifiedResearch,params=u?.parameters;
 const row=(label,value,meaning)=>`${label}：${number(value)}。${meaning}`;
 const observed=f?[row('5日漲幅（%）',f.return5,'今天收盤和5個交易日前比較；已漲太多要小心追高。'),row('14日強弱值（RSI14）',f.rsi14,'0～100，越高表示近期上漲力道越強，也可能過熱；不是上漲機率。'),row('平均日波動（ATR14，元）',f.atr14,'把最近14天的日內範圍與跳空一起估算；只是平常波動大小，不是最多只會跌這麼多。'),row('量增減（張）',f.volumeChangeLots,'今天比昨天多或少的交易張數；1張＝1000股，和成交金額不同。')].join('\n'):'日K尚未核實，不解讀未確認的數值。';
 const definitions={A1:'20日均價高於60日均價：近一個月比近一季強。',A2:'收盤高於已完成20週均價：週線也要核對；本週尚未收完不算。',A3:`5日漲幅介於${p.breakoutReturnMin}%～${p.breakoutReturnMax}%（含兩端）：找已有力道但未過度急漲的股票。`,A4:`最近5天平均量至少是較早5天的${p.volumeGrowth}倍：交易是否變熱絡，並非只比較昨天。`,A5:`今天比昨天至少多${p.volumeDeltaLots}張：看新增成交量，不是今天總量。`,A6:'今天收盤高過此前20天最高價：排除今天，才不會拿自己比自己。',B1:'5、10、20、60日均價由短到長依序較高：檢查是不是多頭排列。',B2:`20日與60日均價都比${p.slopeBars}天前高：檢查均價是否往上。`,B3:'前兩天至少有一天收盤比當天開盤跌超過3%：辨認較明顯的回落。',B4:'今天收盤高於今天開盤：有拉回來，但不等於比昨天上漲。',B5:'前5天平均量超過1000張：先看交易是否足夠活絡。',B6:'昨天碰到均價，昨天收盤、今天最低與收盤都守住：避免只看盤中碰到就說有支撐。',B7:'回落時量較小，今天量與收盤比昨天增加：檢查是否恢復力道，不能直接稱作洗盤。',B8:'今天收盤越過昨天最高價：回落後要再攻，不能只有暫時止跌。',B9:'原始衝刺指標缺少可核驗公式：標為未知，不當作已通過。',C1:'5日均價高於10日均價：最近幾天較強。',C2:'連續3天收盤高於當天開盤：不是連續3天比昨天上漲，兩者不同。',C3:'RSI14嚴格大於65且小於85：看力道，也排除過熱端點；不是65%～85%勝率。',C4:'前5天平均量超過1000張：檢查流動性。',C5_RESEARCH_PRIOR20_CLOSE_BREAK_3:'最近3天各自收盤越過各自前20天最高價：只是自訂研究替代條件。',C6:'原始無參數均線公式尚未核實：保留未知，不自行猜公式。',D1:'量價累積值（OBV）高過前55天：漲日加量、跌日減量，平收不加；無法知道是誰買。',D2:'最近3天有T3寶塔由黑翻紅：表示寶塔轉強，仍要另看壓力與買進風險。',D3:'最新已公布月營收年增率大於0：比去年同月多；不能使用當時還沒公布的資料。',D4:'主力買進需要外部來源與定義確認：不能拿成交量或OBV當成主力資料。',D5:'分公司買賣家數差需確認當日來源與正負方向：未知就不硬猜。'};
 const models=Object.entries(a.models||{}).map(([k,m])=>`${({A:'突破研究：找跨過前高',B:'回踩研究：找拉回後再轉強',C:'動能研究：看強勢能否延續',D:'資金研究：另核對買盤與公司資料'})[k]}\n`+(m.checks||[]).map(c=>`${({PASS:'通過',FAIL:'未通過',UNKNOWN:'資料待確認'})[c.status]||'待確認'}｜${definitions[c.id]||'此項定義尚待核對。'}`).join('\n')).join('\n\n');
 const limits=params?`一般突破量至少是前5天平均的${number(params.volume)}倍（多${number((params.volume-1)*100)}%），平均不含今天；收盤要在當天高低範圍靠上${number(params.weakClose*100)}%以上，上影小於全日高低差的${number(params.longWick*100)}%。\n防守附近緩衝採平均波動的${number(params.zoneATR)}倍；突破另留至少一格可交易價格或平均波動5%的緩衝。回踩買法看縮量後再增量，不一律硬套放量突破。\n成本後預估報酬至少為風險${number(params.minRR)}倍；研究停損距離不超過買價${number(params.maxStopPct)}%，最近上方壓力前至少留${number(params.minSpacePct)}%空間。超過${number(params.maxGapPct)}%跳空要重算；這些都是研究門檻，並非交易保證。\n成本假設：每邊手續費${percent(params.fee*params.feeDiscount)}、賣出稅${percent(params.tax)}、買賣各預留${percent(params.slippage)}成交偏差。真實費率、跳空與漲跌停可能讓結果更差。`:'情境資料還沒核對完整，先不套用買進門檻。';
 const dp=a.entryDirection?.parameters,heat=dp?`\n新買額外提醒：20日均價正乖離達${dp.maxBiasPct}%、5天漲幅達${dp.maxReturn5}%或RSI5達${dp.maxRSI5}，任一出現先等，不把「很強」直接翻成「現在適合追」。這些值不是勝率，也未經績效認證。`:'';
 return [{title:'這檔的技術數字，逐項翻白話',value:observed},{title:'四策略每個條件為什麼通過或沒通過',value:models||'基礎日K不足，四策略無法確認。'},{title:'進場濾網與成本參數怎麼看',value:limits+heat}];
}
function nFields(a){const n=a.nContinuation;if(!n)return [];if(n.state!=='RESEARCH_ONLY')return [{title:'N字結構與來源',value:stage(n)}];const q=n.pattern;
 const names={A:'第一段起漲低點',B:'第一段上漲高點',C:'後來回落低點'};
 const points=q?['A','B','C'].map(k=>`${names[k]}（${k}）：${money(q[k].price)}。出現在${q[k].pivotDate}；${q[k].knownAt?'到'+q[k].knownAt+'才有足夠日K確認':'還沒有足夠後續日K確認'}。`).join('\n'):'這檔目前找不到清楚的三個轉折點，所以先不套這個走勢。';
 const state={CONFIRMED:'價格條件已出現',WAIT_TRIGGER:'價格條件還沒出現',PENDING_CONFIRMATION:'還要等後續價格確認',INVALIDATED:'原計畫已停止採用'},decision={DO_NOT_ENTER:'風險不合適，先不要依此新買',CANNOT_EVALUATE:'資料還沒確認，先等',CONDITIONAL_RESEARCH:'可進一步評估，仍要依實際買價重算',WAIT:'先觀察'};
 const rules={C_OBSERVATION:'比較早觀察：回落低點確認後，收盤先高過昨天最高價，並留在前高下方；此時還不算突破前高。',BREAKOUT:'等漲過前高：用收盤價確認跨過B點，不能只看盤中一度漲過。',RETEST:'等漲過後回來測試：先跨過B點，再退回附近守住，之後還要收盤高過前一天最高價。沒有真正回測，就沒有可用的回測防守價。'};
 const missing={'價格口徑':'價格是否使用相同的還原／未還原方式','交易日曆':'日K是否漏掉交易日','量能來源／口徑':'交易量來源與單位是否一致','交易跳動規則':'這檔股票每次可跳動多少價格','情境防守':'這種買法的防守價','上方可核驗關卡':'最近上方壓力'};
 const cases=(n.cases||[]).map(x=>`${({C_OBSERVATION:'一、低點止跌後觀察',BREAKOUT:'二、收盤越過前高後觀察',RETEST:'三、越過前高、回來測試後觀察'})[x.id]}\n目前：${state[x.signalStatus]||'還待確認'}；${decision[x.entryDecision]||'先觀察'}。\n${rules[x.id]}\n以本日收盤${money(x.entryAssumption)}假設買進。${dead(q)?'舊計畫的':'這種買法的'}防守價：${money(x.planStop)}；最近上方壓力：${money(x.nearestVerifiedBarrier)}。${riskText(x.riskReward)}${finite(x.riskReward?.stopPct)?`買價到防守價約差${number(x.riskReward.stopPct)}%；到最近壓力約有${number(x.riskReward.spacePct)}%空間。`:''}\n${finite(x.projectionScenarioRR?.grossRR)?`若只看到較遠的試算價，未扣成本的報酬／風險約${number(x.projectionScenarioRR.grossRR)}倍；不能跳過最近壓力就認為划算。`:'到試算價的報酬／風險也暫時算不出來。'}${x.missingEvidence?.length?'\n還缺確認：'+x.missingEvidence.map(k=>missing[k]||k).join('、')+'。':''}${x.unmetConditions?.length?'\n量能條件還沒達到；先看交易是否恢復熱絡。':''}`).join('\n\n')||'目前沒有可比較的三種買法，先等走勢清楚，不硬填買價或停損。';
 return [{title:'N字結構與來源',value:'N字就是「先漲一段、退一些、再嘗試上漲」，不是看到形狀就能買。這裡的B是這一段前高，與另一模型的「原策略B價」不一定相同。\n目前：'+stage(n)+'。\n'+points+(q?`\n第一段漲幅：${money(q.AB)}；後來退回了這段漲幅的${number(q.retracementPct)}%。影片提到常見退回38.2%～61.8%，只是觀察範圍，不是超出就一定失敗。`:'')+(n.inverse?'\n另外出現較弱的相反走勢：'+(n.inverse.stage==='BREAKDOWN_CONFIRMED'?'已跌破前低，多方要更小心。':'還在形成，不能直接認定會跌。'):'')},
 {title:'N字三種進場比較',value:cases},
 {title:'N字投射與失效',value:projectionText(n)+(q?`\n算法是C＋（B－A），也叫等幅1.0：把第一段的漲幅加在回落低點上。與舊版1.618倍算法不同，不能混用。\nA ${money(q.A.price)}是整個走勢的起點；各種買法的防守價是另一回事。跌破C後要等新的止跌位置，不把舊計畫的防守價往下搬。\n突破後的歷史觀察：${({UNKNOWN:'還沒有收盤突破紀錄',OPEN:'仍在觀察',STOP_TOUCHED:'後來曾碰到原計畫防守價',TARGET_TOUCHED:'後來曾碰到試算價，但不等於真的成交獲利',AMBIGUOUS:'同一天碰到防守價和試算價，日K看不出誰先，不當成獲利'})[q.historicalBreakoutObservation.status]||'資料不足'}。`:'')},
 {title:'濾網N字補充理由',value:'突破研究：有沒有真的越過前高，現在買是否太接近壓力。\n回踩研究：上漲後退回來能否守住；要分清是第一次回落，還是突破後回來測試。\n動能研究：續漲力道是否延續，有沒有追太高。\n資金研究：仍要另外確認法人、籌碼等資料，不能光靠K線猜主力買賣。\n這些說明適用各個股，只補充判讀理由；既有篩選分數與排序不變，也未證明能提高勝率。'}];
}
return Object.freeze({VERSION,number,money,stage,volumeText,riskText,projectionText,chartContext,parameterFields,strategyParameters,nFields});
});

