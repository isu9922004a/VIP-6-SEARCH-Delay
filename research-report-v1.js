(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.ShitouResearchReport=a;})(globalThis,function(){
'use strict';
const Z=globalThis.ShitouResearchZhTW||(typeof require==='function'?require('./research-zh-tw-v1.js'):null);
const chinese=value=>Z?Z.humanize(value):String(value??'—');
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'—';
const STAGES={BREAKOUT_LAUNCH:'突破發動',HEALTHY_PULLBACK:'健康回踩',MOMENTUM_CONTINUATION:'強勢延續',FLOW_CONFIRMATION:'資金確認',OVEREXTENDED:'短線過熱',BREAKOUT_FAILURE:'結構失敗',INSUFFICIENT_DATA:'資料不足',OBSERVATION:'觀察中',DISABLED:'已關閉'};
const STATES={PASS:'符合',FAIL:'不符合',UNKNOWN:'待驗證',RESEARCH_MATCH:'研究符合',RESEARCH_NOT_MATCH:'未符合',DATA_UNVERIFIED:'資料待補',AWAIT_CONFIRMATION:'待確認',CONFIRMED:'已確認',FAILED:'已失效',EXPIRED:'已逾期',AMBIGUOUS:'先後不明',STRONG_ALIGNMENT:'一致轉強',PARTIAL_ALIGNMENT:'部分轉強',MIXED_SIGNALS:'訊號矛盾',BEARISH_ALIGNMENT:'一致轉弱',OVEREXTENSION_WARNING:'過熱警戒',INSUFFICIENT_DATA:'暫無共同訊號'};
const CONDITION_NAMES={RSI_GT_65:'日線RSI＞65',RSI_GT_70:'日線RSI＞70',MA20_CLOSE_CROSS:'收盤穿越站上MA20',CHIP_GT_20:'籌碼集中＞20%',TURNOVER_GT_10:'周轉率＞10%',OFFICIAL_VALUE_TOP100:'成交值前100'};
// Read-only market context: never changes a.state, check.status, ranking or research levels.
// Even when no model fires, validated OHLCV can still describe observable direction.
function technicalOutlook(a){
 if(a?.validation?.technicalModelAvailable!==true||!a?.features)return null;
 const f=a.features,z=a.sourceBars?.at(-1),m20=f.ma?.[20]?.value,m60=f.ma?.[60]?.value;
 if(!z||!Number.isFinite(z.close))return null;
 const close=z.close,slope=f.ma?.[20]?.slope;
 let label='技術方向待確認';
 if(Number.isFinite(m20)&&Number.isFinite(m60)){
  if(close<m20&&close<m60)label=slope!==null&&slope<0?'短線偏弱':'均線下方整理';
  else if(close>m20&&close>m60)label=slope!==null&&slope>0?'偏多整理':'均線上方整理';
  else if(close>m20&&close<m60)label='反彈仍遇中期壓力';
  else if(close<m20&&close>m60)label='短線回檔';
  else label='均線附近整理';
 }else if(Number.isFinite(m20))label=close<m20?'MA20下方整理':close>m20?'MA20上方整理':'貼近MA20';
 const details=[`收盤 ${fmt(close)}`],cautions=[];
 for(const [n,ma] of [[20,m20],[60,m60]]){
  if(!Number.isFinite(ma))continue;
  const relation=close>ma?'高於':close<ma?'低於':'等於';
  details.push(`${relation}MA${n} ${fmt(ma)}`);
  if(close<ma)cautions.push(`收盤低於MA${n}`);
 }
 if(Number.isFinite(slope)){
  details.push(`MA20${slope>0?'上彎':slope<0?'下彎':'走平'}`);
  if(slope<0)cautions.push('MA20下彎');
 }
 const closeLoc=f.candle?.closeLocation;
 if(z.close<z.open){
  details.push(closeLoc!==null&&Number.isFinite(closeLoc)&&closeLoc<=.25?'當日收黑且收近低點':'當日收黑');
  if(closeLoc!==null&&Number.isFinite(closeLoc)&&closeLoc<=.25)cautions.push('收黑且收近當日低點');
 }else if(z.close>z.open)details.push('當日收紅');
 const ratio=f.volumePrior5>0?z.volume/f.volumePrior5:null;
 if(Number.isFinite(ratio))details.push(`相對前5日均量 ${ratio.toFixed(2)}倍${ratio>=1.5?'（放量）':ratio<=.8?'（量縮）':''}`);
 return {label,details,cautions,volumeRatio:ratio};
}
function stageLabel(a){if(a?.state==='BREAKOUT_LAUNCH'&&a.tradeContext)return a.tradeContext.breakout.status==='HELD_CLOSES'?'突破後收盤守穩':'短線突破初步成立';return a?.state==='OBSERVATION'?(technicalOutlook(a)?.label||'觀察中（未觸發四模型）'):(a?.compactStateLabel||STAGES[a?.state]||(a?.state?chinese(a.state):'觀察中'));}
function modelSummary(a){
 if(!a?.models||!Object.keys(a.models).length)return '基礎日K未通過，四模型不可判定';
 const labels={A:'策略一｜突破',B:'策略二｜回踩',C:'策略三｜動能',D:'策略四｜資金'};
 return ['A','B','C','D'].map(k=>{
  const m=a.models[k];if(!m)return `${labels[k]} 待驗證`;
  const passed=m.checks.filter(x=>x.status==='PASS').length;
  const unknown=m.checks.filter(x=>x.status==='UNKNOWN').length;
  return `${labels[k]} ${chinese(m.status)} ${passed}/${m.checks.length}${unknown?`（待驗${unknown}）`:''}${k==='D'&&m.verification?.overall!=='VERIFIED'?'；僅技術子集，資金未完整核實':''}`;
 }).join('｜');
}
function evidenceSummary(a){
 if(a?.validation?.technicalModelAvailable===false)return '基礎日K待核驗，暫無法判讀技術現況';
 const t=technicalOutlook(a);
 if(t)return t.details.filter(x=>!x.startsWith('相對')&&!x.startsWith('當日')).join('；');
 return '技術現況待核驗；不可由未觸發訊號推定多空';
}
function riskSummary(a){
 if(a?.validation?.technicalModelAvailable===false)return '基礎資料未通過，風險尚無法完整判斷';
 const structural=a?.risks||[],context=[...(technicalOutlook(a)?.cautions||[])];
 if(context.includes('收盤低於MA20')&&context.includes('收盤低於MA60')){context.splice(context.indexOf('收盤低於MA60'),1);context[context.indexOf('收盤低於MA20')]='收盤低於MA20與MA60';}
 const urgent=structural.filter(x=>/失敗|收回|未通過/.test(x));
 const combined=[...new Set([...urgent,...(a.tradeContext?.cautions||[]),...structural,...context])].slice(0,3);
 return combined.map(chinese).join('、')||'未觸發預設風險條件；不代表無風險';
}
function dataSummary(a){
 const v=a?.validation;if(!v)return a?.dataQuality?.complete?'資料較完整':'部分資料待驗證';
 if(!v.technicalModelAvailable)return [...new Set(a.dataQuality?.missing||v.validationErrors)].map(chinese).join('；')||'行情資料不足，無法判斷';
 const notes=[`完成日K ${v.historyBarCount}根可計算；證據分項核驗`];
 if(v.historyBarCount<63)notes.push(`MA60斜率需63根（目前${v.historyBarCount}根）`);
 if(!v.externalEvidenceAvailable)notes.push('籌碼／營收等外部條件未完整核驗');
 if(a.models?.B?.sprintStatus==='UNVERIFIED'||a.models?.C?.sourceDefinitionVerified===false)notes.push('部分策略公式待核驗');
 if(a.models?.A?.checks.some(x=>x.id==='A2'&&x.status==='UNKNOWN'))notes.push('20週MA待核驗');
 const warnings={CALENDAR_UNVERIFIED:'正式交易日曆未核驗',ADJUSTMENT_BASIS_UNKNOWN:'價格還原口徑未知',PRICE_BASIS_UNVERIFIED:'價格基準未核驗'};
 for(const w of a.dataQuality?.warnings||[])notes.push(warnings[w]||chinese(w));
 return notes.join('；');
}
function actionSummary(a){
 switch(a?.state){
  case 'BREAKOUT_LAUNCH': {const c=a.tradeContext;if(!c)return '觀察是否續強，未確認前不追價。';return `先看 ${fmt(c.breakout.price)} 能否守穩${c.nearest?`、${fmt(c.nearest.price)} 能否突破`:''}；${c.breakout.status==='HELD_CLOSES'?'收盤守穩仍須量價延續':'初步突破待確認'}，非買進訊號。`;}
  case 'HEALTHY_PULLBACK': return '先看支撐是否守住，再等重新轉強。';
  case 'MOMENTUM_CONTINUATION': return '強勢延續中，留意量價是否維持。';
  case 'FLOW_CONFIRMATION': return '可列入觀察，但仍要回到原策略檢查。';
  case 'OVEREXTENDED': return '短線偏熱，先不急追。';
  case 'BREAKOUT_FAILURE': return '結構轉弱，先保守。';
  case 'INSUFFICIENT_DATA': return a?.validation?.technicalModelAvailable?'保留已可計算的技術結果；補足歷史日K後再確認完整訊號。':'先補齊並核驗基礎行情，再判斷現況。';
  case 'OBSERVATION': {const t=technicalOutlook(a);return t?(t.cautions.length?'先確認支撐能否守住，再等價量轉強。':'等待價量與關鍵壓力確認，再評估訊號。'):'四模型暫未觸發，先確認資料與下一個交易日訊號。';}
  default: return '先觀察，等待更完整訊號。';
 }
}
function dualSummary(d,analysis){
 if(!d)return analysis?.flags?.dualScanEnabled===false?'研究A/B：已關閉':'研究A/B：基礎日K待核驗';
 const part=(mode,label)=>{
  const checks=mode?.checks||[],failed=checks.filter(x=>x.status==='FAIL'),unknown=checks.filter(x=>x.status==='UNKNOWN');
  if(!checks.length)return label+' 待驗證';
  if(failed.some(x=>x.id==='MA20_CLOSE_CROSS'))return label+' 未符合：收盤穿越站上MA20未成立（未發生新穿越，非均線下方判定）'+(unknown.length?'；部分待驗':'');
  if(failed.length)return label+' 未符合：'+(CONDITION_NAMES[failed[0].id]||chinese(failed[0].id))+'未成立'+(unknown.length?'（部分待驗）':'');
  if(unknown.length)return label+' 待驗證';
  return label+' 研究符合';
 };
 return part(d.modeA,'A')+'｜'+part(d.modeB,'B');
}
function alertSummary(p,a){
 if(!p)return a?.flags?.alertPlanEnabled===false?'到價提醒：已關閉':'基礎行情未通過，暫不建立提醒';
 return `上破 ${fmt(p.priceAbove?.input)}｜下破 ${fmt(p.priceBelow?.input)}｜漲跌幅 ${p.dayGainPercentInput??'—'}% / ${p.dayLossPercentInput??'—'}%`;
}
const CHECK_NAMES={
 A1:'MA20高於MA60',A2:'收盤高於完成20週MA',A3:'近5日報酬5%～15%',A4:'近5日均量較前期增至少15%',A5:'單日量增至少1000張',A6:'收盤突破前20日高點',
 B1:'MA5／10／20／60多頭排列',B2:'MA20與MA60斜率向上',B3:'前兩日出現跌逾3%黑K',B4:'當日收紅',B5:'前5日均量逾1000張',B6:'回踩均線並守住',B7:'縮量整理後價量改善',B8:'收盤收復前日高點',B9:'衝刺指標公式',
 C1:'MA5高於MA10',C2:'連續3根紅K',C3:'RSI14介於65與85',C4:'前5日均量逾1000張',C5_RESEARCH_PRIOR20_CLOSE_BREAK_3:'連3日突破各自前20日高點',C6:'原圖未定義均線公式',
 D1:'OBV創55日新高',D2:'寶塔近3日翻紅',D3:'已公布營收年增率為正',D4:'已核驗主力買超',D5:'已核驗分公司家數差為負'
};
function modelFields(a){
 const names={A:'策略一｜突破研究',B:'策略二｜回踩研究',C:'策略三｜動能研究',D:'策略四｜資金研究'};
 return ['A','B','C','D'].map(key=>{
  const m=a.models?.[key];
  if(!m)return {title:names[key],value:a.state==='DISABLED'?'四模型研究已關閉':'基礎日K未通過，無法判定'};
  const group=status=>m.checks.filter(x=>x.status===status).map(x=>CHECK_NAMES[x.id]||chinese(x.id)).join('、');
  return {title:names[key],value:[`${chinese(m.status)}；${chinese(m.label)}${key==='D'&&m.verification?.overall!=='VERIFIED'?'；技術子集不等於完整資金確認':''}`,`已確認：${group('PASS')||'無'}`,`未成立：${group('FAIL')||'無'}`,`待驗證：${group('UNKNOWN')||'無'}`].join('\n')};
 });
}
function compactDataSummary(a){
 if(a?.validation?.technicalModelAvailable!==true)return dataSummary(a);
 const c=a.tradeContext,pending=[];
 if(!a.validation.externalEvidenceAvailable)pending.push('籌碼／營收');
 if(!a.dataQuality?.complete)pending.push('策略／口徑');
 if(c?.provenance.volumeConflict)pending.push('成交量差異');
 if(!c?.provenance.retrievedAt)pending.push('來源擷取時間');
 return `日K ${a.validation.historyBarCount}根可算，非全部驗證；${c?.provenance.volumeConflict?'量差／口徑待核':'策略／口徑詳見完整報告'}`;
}
function priceSummary(a){
 const c=a.tradeContext;
 if(!c)return `近期突破 ${fmt(a.researchBreakoutPrice)}｜研究失效 ${fmt(a.researchInvalidation)}`;
 return `近期壓力 ${shortPrice(c.recent)}｜短壓 ${shortPrice(c.nearest?.price)}｜策略B ${shortPrice(c.originalB)}${c.originalB===null?'未提供':c.originalBVerified?'':'待核'}`;
}
function breakoutSummary(a){
 const c=a.tradeContext;if(!c)return '基礎日K待核驗';
 const labels={INITIAL_CLOSE:'已收盤突破，首次成立；後續守穩待確認',HELD_CLOSES:'後續收盤守穩；仍須觀察量價延續',FAILED:'突破後收盤失守',INTRADAY_REJECTED:'盤中越壓、收盤未突破',NOT_BROKEN:'尚未收盤突破近期壓力'};
 return `近期壓力 ${fmt(c.recent)}；${labels[c.breakout.status]}${c.breakout.eventDate?`（事件 ${c.breakout.eventDate}，固定參考 ${fmt(c.breakout.price)}，連續守穩${c.breakout.heldSessions}根）`:''}；前60日高點 ${fmt(c.prior60)}；${c.originalB===null?'原策略B價未提供／不適用':`原策略B價 ${fmt(c.originalB)}：${c.originalBStatus==='UNVERIFIED'?'價位來源待核；'+(a.sourceBars.at(-1).close>c.originalB?'收盤在參考價之上':'尚未突破參考價'):c.originalBStatus==='CLOSE_ABOVE'?'收盤已在門檻之上（不等於B資格符合）':'尚未突破'}`}；不以近期突破代替完整波段突破或策略資格`;
}
function scenarioSummary(a){
 const c=a.tradeContext;if(!c)return '行情未核驗，無法計算';
 const sign=v=>v===null?'—':`${v>0?'+':''}${v.toFixed(2)}%`;
 const rr=c.rewardRisk;
 return [`以收盤 ${fmt(rr.entry)} 假設進場`,...c.scenarios.map(x=>`${x.kind} ${fmt(x.price)}：${sign(x.changePct)}`),
  rr.ratio===null?'報酬風險比不適用：需上方目標及低於收盤的研究失效價':`假設目標 ${fmt(rr.target)}／研究失效 ${fmt(rr.invalidation)}，報酬風險比 ${rr.ratio.toFixed(2)}：1`,rr.assumption].join('；');
}
function provenanceSummary(a){
 const c=a.tradeContext;if(!c)return '日K來源待核驗';const p=c.provenance;
 return `來源 ${p.source||'未提供'}；行情日 ${p.sourceDate}；擷取時間 ${p.retrievedAt||'未提供／待核'}；價格口徑 ${p.priceBasis}；量統一為股，統計範圍 ${p.volumeBasis}；來源量 ${p.sourceVolume??'—'}／市場快照量 ${p.snapshotVolume??'未提供'}；${p.volumeConflict?'量差異待複核，尚不可宣稱量能資格完整驗證':'跨來源量口徑尚未完整核驗'}；同一快照計算MA20／MA60；${p.rsiFormula}`;
}
const shortPrice=v=>typeof v==='number'&&Number.isFinite(v)?String(Number(v.toFixed(2))):'—';
function glanceEvidence(a){
 if(!a.tradeContext)return evidenceSummary(a);
 return `收 ${shortPrice(a.sourceBars?.at(-1)?.close??a.quote?.close)}｜MA20 ${shortPrice(a.features.ma[20].value)}｜MA60 ${shortPrice(a.features.ma[60].value)}`;
}
function glanceRisk(a){
 if(!a.tradeContext)return riskSummary(a);
 const c=a.tradeContext,parts=[];
 if(a.state==='BREAKOUT_FAILURE')parts.push('結構失守警戒');
 const t=technicalOutlook(a);if(t?.cautions.includes('收盤低於MA20'))parts.push(t.cautions.includes('收盤低於MA60')?'收盤低於MA20與MA60':'收盤低於MA20');
 if(c.rsi5>=75)parts.push(`RSI5 ${shortPrice(c.rsi5)}偏熱`);
 if(c.ma20GapPct>=5)parts.push(`MA20乖離 ${shortPrice(c.ma20GapPct)}%`);
 if(c.upperWickRatio>=.3)parts.push('高點回落有上影');
 if(c.provenance.volumeConflict)parts.push('量差待核');
 if(!parts.length&&c.nearest&&c.nearest.price/a.sourceBars.at(-1).close<=1.03)parts.push('接近上方短壓');
 return parts.slice(0,2).join('；')||riskSummary(a);
}
function glanceDual(a){
 const d=a.foundation?.dualScanContext;if(!d)return dualSummary(d,a);
 return [['A',d.modeA],['B',d.modeB]].map(([key,m])=>{
 const checks=m?.checks||[];
 if(checks.some(x=>x.id==='MA20_CLOSE_CROSS'&&x.status==='FAIL'))return `${key} 未符合：無新穿越`;
 return `${key} ${checks.some(x=>x.status==='FAIL')?'未符合':!checks.length||checks.some(x=>x.status==='UNKNOWN')?'待驗證':'研究符合'}`;
 }).join('｜');
}
function glanceAction(a){
 const c=a.tradeContext;
 return a.state==='BREAKOUT_LAUNCH'&&c?`觀察守穩 ${shortPrice(c.breakout.price)}${c.nearest?`、再過 ${shortPrice(c.nearest.price)}`:''}；不單憑突破追價。`:actionSummary(a);
}
// R10 calculations remain unchanged. This schema drives every stock entrance.
const GUIDE_NOTE='以上為歷史行情的條件式研究示例，非已觸發的買進訊號；持股者需依成本與風險上限另行評估。';
function entryGuide(a){
 const valid=a.validation?.technicalModelAvailable===true,c=a.tradeContext,z=a.sourceBars?.at(-1),f=a.features;
 const titles=['現在適合進場嗎？','什麼情況可以考慮買？','什麼情況要小心？','漲到哪裡要注意？','一句話結論'];
 const none=['先核對行情，再評估進場\n'+(a.state==='DISABLED'?'四策略研究已關閉，暫不產生進出場情境。':a.reason?'原因：'+chinese(a.reason):'完成日K待核驗或驗證未通過，目前無法確認進場條件。'),
  '先補齊同一日期、同一來源的日K與價格口徑，再觀察支撐、突破及量價條件。',
  '資料未核驗前，不能確認支撐與風險價位；尚未核驗不代表沒有風險。',
  '上方壓力尚無足夠資料確認，不預設目標價。',
  '先確認行情資料，再評估進場風險。'];
 if(!valid||!c||!z||!f)return {fields:titles.map((title,i)=>({title,value:none[i]})),note:GUIDE_NOTE};
 const price=shortPrice;
 if(!Number.isFinite(c.recent))return {fields:titles.map((title,i)=>({title,value:[
  `先觀察，等待價量確認\n收盤 ${price(z.close)} 元；當日區間 ${price(z.low)}～${price(z.high)} 元。`,
  `① 觀察 ${price(z.low)} 元附近能否守穩並出現轉強。\n② 再看收盤能否突破 ${price(z.high)} 元，確認量價及上方空間。`,
  `${price(z.low)} 元為當日低點，失守須重新評估；尚不能把這個價位當成已確認的波段支撐。`,
  `${price(z.high)} 元為當日高點，先觀察能否突破；較長期間壓力仍待後續日K核對。`,
  '先依當日價量觀察，等支撐、突破與上方空間確認，再評估進場風險。'
 ][i]})),note:GUIDE_NOTE};
 const close=z.close,bp=c.breakout.price??c.recent,hasBreak=Number.isFinite(bp)&&close>bp;
 const weak=a.state==='BREAKOUT_FAILURE'||c.breakout.status==='FAILED'||Number.isFinite(f.ma[20].value)&&close<f.ma[20].value;
 const hot=Number.isFinite(c.rsi5)&&c.rsi5>=75||Number.isFinite(c.ma20GapPct)&&c.ma20GapPct>=5;
 // Values always come from this stock's validated snapshot. A legacy B reference
 // stays labelled as unverified unless corroborated by a computed high.
 const pressures=[];
 for(const item of [...c.pressures].sort((x,y)=>x.price-y.price)){
  if(!pressures.some(x=>Math.abs(x.price-item.price)<1e-8))pressures.push(item);
 }
 const upper=pressures.slice(0,2),next=upper[0],second=upper[1];
 const label=x=>x.kind.includes('待核驗')?'（策略參考待核）':'';
 const above=upper.length?`上方還有 ${upper.map(x=>price(x.price)+label(x)).join(' 與 ')} 元壓力。`:'更上方壓力仍待確認。';
 const conflict=c.provenance.volumeConflict;
 const headline=weak?'先觀察，等待結構轉強':'先觀察，不急著追價';
 const fact=hasBreak?`已突破 ${price(bp)} 元${hot?'，但 '+(c.rsi5>=75?'RSI 偏熱':'均線乖離偏大'):''}，${above}`:
  `尚未收盤突破 ${price(c.recent)} 元${weak?'，短線結構仍偏弱':''}；${above}`;
 const buy=weak?`① 先等價格重新站穩${Number.isFinite(f.ma[20].value)?' MA20 '+price(f.ma[20].value)+' 元':'支撐'}，確認結構轉強。\n② 再觀察${next?' '+price(next.price)+' 元突破與':' '}量價確認，並評估報酬風險。`:
  `① ${hasBreak?`回測 ${price(bp)} 元附近，確認支撐有效並出現轉強訊號。`:Number.isFinite(f.ma[20].value)&&f.ma[20].value<close?`回測 MA20 ${price(f.ma[20].value)} 元附近，確認支撐有效並出現轉強訊號。`:`先等收盤突破 ${price(c.recent)} 元，確認守穩與量價配合。`}\n② ${next?`或收盤有效突破 ${price(next.price)} 元${label(next)}，且量價確認、報酬風險合理。`:'再確認下一道壓力與報酬風險，不在缺乏上方參考時追價。'}`;
 const lower=Number.isFinite(z.low)&&z.low<close&&(!hasBreak||z.low<bp)?z.low:null;
 const risk=(hasBreak?`${price(bp)} 元失守且無法收復，代表突破轉弱，需重新評估。`:
  weak?'結構尚未轉強，反彈不等於突破確認。':`尚未站上 ${price(c.recent)} 元前，不把盤中上漲當成突破確認。`)+
  (lower!==null?`${price(lower)} 元為當日低點，可列為${hasBreak?'下一層':'短線'}風險觀察價。`:'研究失效價僅供風險觀察，不直接作為個人停損。');
 const upside=next?`${price(next.price)} 元看能否突破${label(next)}；${second?`${price(second.price)} 元為${second.kind==='前60日高點'?'近60日較大壓力':second.kind.includes('待核驗')?'策略參考（待核）':'上方壓力'}。`:'更上方壓力待確認。'}接近壓力時注意量能與賣壓，不能預設一定會漲到。`:
  '目前缺乏高於收盤的歷史壓力參考；後續看量價與新高能否守穩，不能預設一定續漲。';
 const bullish=Number.isFinite(f.ma[20].value)&&Number.isFinite(f.ma[60].value)&&close>f.ma[20].value&&close>f.ma[60].value;
 const conclusion=weak?'股票短線結構仍待改善。先等支撐守穩、價格與量能重新轉強，再評估進場風險。':
  `${bullish?'股票短線偏強，但還沒到非買不可的程度。':'目前先列入觀察，不急著進場。'}先等${hasBreak?'支撐確認或壓力突破':'突破與量價確認'}，再評估進場風險。`;
 return {fields:titles.map((title,i)=>({title,value:[headline+'\n'+fact+(conflict?'成交量口徑待核，量價條件須複核。':''),buy,risk,upside,conclusion][i]})),note:GUIDE_NOTE};
}
// R14: Read-only, single-card beginner wording shared by stock lookup and all filters.
// Never convert a research-only scenario into an unconditional trading signal.
function compactUnifiedGuide(a,u){
 const base=entryGuide(a);
 if(u?.state!=='RESEARCH_ONLY'||a?.validation?.technicalModelAvailable!==true||!a.tradeContext)return base;
 const z=a.sourceBars?.at(-1),c=a.tradeContext,scenarios=u.scenarios||[];
 if(!z||!Number.isFinite(z.close))return base;
 const price=v=>Number.isFinite(v)&&v>0?shortPrice(v)+' 元':null;
 const volume=u.structureContext?.volume,volumeUnknown=c.provenance?.volumeConflict||!volume?.usable;
 const good=scenarios.filter(x=>x.signalStatus==='CONFIRMED'&&x.riskDecision==='ACCEPTABLE_FOR_EVALUATION'&&x.riskReward?.status==='KNOWN');
 const blocked=scenarios.filter(x=>x.signalStatus==='CONFIRMED'&&x.riskDecision==='BLOCKED');
 const buyReady=u.entryDecision==='CONDITIONAL_ENTRY'&&good.length>0&&!volumeUnknown;
 const weak=a.state==='BREAKOUT_FAILURE'||['BEAR','FAILED','REBOUND'].includes(u.stage)||z.close<a.features.ma[20].value;
 const trend=weak?'短線偏弱':u.stage==='HIGH_CONSOLIDATION'?'偏多高檔整理':['BULL_START','BULL_CONTINUE'].includes(u.stage)?'短線偏強':u.stage==='PULLBACK'?'多頭回檔':u.stage==='RANGE'?'區間整理':'方向待確認';
 const decision=buyReady?'🟢 條件可供評估，須重算實際成交風險':volumeUnknown||u.entryDecision==='CANNOT_EVALUATE'?'⚪ 必要資料待核，尚無法確認新買點':blocked.length||u.entryDecision==='DO_NOT_ENTER'?'🔴 風險未通過，目前不宜新進場':'🟠 先觀察，尚未確認買點';
 const check=good[0]||scenarios.find(x=>x.id==='PULLBACK'&&x.signalStatus==='PENDING_CONFIRMATION'&&x.applicable)||scenarios.find(x=>x.id==='BREAKOUT')||scenarios[0];
 const pending=volumeUnknown?'量能來源／口徑待核':!u.chart?.basisVerified?'價格口徑待核':!u.chart?.calendarVerified?'完成交易日曆待核':null;
 const reason=weak?'股價結構尚待改善':'仍須完成價格確認與風險檢查';
 let condition='先建立可核驗的觸發與防守位置';
 if(check?.triggerPrice>0){
  condition=check.id==='PULLBACK'?`回踩 ${price(check.triggerPrice)}附近後收復前日高點`:
   check.id==='RETEST'?`回測原突破線 ${price(check.triggerPrice)}守穩再轉強`:
   check.triggerPrice>=z.close?`完成收盤越過 ${price(check.triggerPrice)}及緩衝`:`原突破線 ${price(check.triggerPrice)}續守，仍須量價確認`;
 }
 const volumeCondition=check?.id==='PULLBACK'?'前日量縮、今日價量改善':`當日量／前5日均量至少 ${u.parameters.volume} 倍（分母不含當日）`;
 const near=(u.levels||[]).filter(x=>x.price>z.close+.000001).sort((a,b)=>a.price-b.price)[0];
 if(weak&&near&&check?.triggerPrice>near.price*1.02)condition=`先觀察收盤收復 ${price(near.price)}近壓，且結構轉強`;
 const buyText=`① ${condition}。\n② ${pending?pending+'；核實後再驗證':volumeCondition}，並確認防守及成本後空間。`;
 const riskNames={LOW_VOLUME:'低量不等於洗盤',NEAR_RESISTANCE:'最近上方關卡太近',VOLUME_UPPER_WICK:'放量上影',FAILED_BREAKOUT:'突破後收回',EXTENDED:'離結構防守較遠',GAP:'跳空須重算',SUPPORT_BROKEN:'已建立防守失效',MOMENTUM_DIVERGENCE:'動能背離觀察'};
 const riskWords=[...new Set((u.risks||[]).map(x=>riskNames[x.code]).filter(Boolean))].slice(0,2);
 const defense=good[0]?.invalidationPrice;
 const guard=check?.defensePrice;
 const danger=`${pending?pending+'；':''}${riskWords.join('；')||'留意假突破與執行價格'}。${defense>0?`此情境收盤失效 ${price(defense)}，非成交停損保證。`:guard>0?`候選防守參考 ${price(guard)}，尚非已確認支撐；暫不提供停損組合。`:'防守位置未核實，無法計算報酬風險。'}`;
 const upper=(u.levels||[]).filter(x=>x.price>z.close+.000001).sort((a,b)=>a.price-b.price).filter((x,i,all)=>!i||Math.abs(x.price-all[i-1].price)>1e-8);
 const one=upper[0],two=upper[1];
 const resistance=one?`${price(one.price)}為最近上方關卡（${one.source}）${two?`；再看 ${price(two.price)}`:''}。不可跳過近壓或預設必達。`:'上方歷史關卡不足，暫不設定停利目標。';
 const conclusion=buyReady?`僅取得附帶條件的評估資格；依實際進場價重算。`:`目前${trend}，${pending?'先補核資料':weak?'先等結構轉強':'等待對應情境確認'}；不急著買。`;
 return {fields:[
  {title:'現在適合進場嗎？',value:`${decision}\n趨勢：${trend}。${pending||reason}。`},
  {title:'什麼情況可以考慮買？',value:buyText},
  {title:'什麼情況要小心？',value:danger},
  {title:'漲到哪裡要注意？',value:resistance},
  {title:'一句話結論',value:conclusion}
 ],note:'盤後條件研究，未驗證績效；入榜不等於可新買，跳空須重算。來源與確認條件見完整研究。'};
}
function conflictSummary(a){
 if(a.validation?.technicalModelAvailable!==true)return '基礎日K未通過，不能比較策略意見';
 const pass=Object.entries(a.models||{}).filter(([,m])=>m.status==='符合').map(([k])=>k);
 const fail=Object.entries(a.models||{}).filter(([,m])=>m.status==='不符合').map(([k])=>k);
 const study=a.indicatorStudy;
 return [pass.length&&fail.length?`研究條件分歧：${pass.join('／')}符合；${fail.join('／')}不符合`:'各模型門檻不同，未全數符合不等同看空',
  study?.status==='已確認'?`KD／MACD參考為「${study.phase}」；四策略現況為「${stageLabel(a)}」，指標尺度不同，以結構及風險優先`:'KD／MACD尚未具備足夠資料',
  '四模型僅技術子集研究；非完整原圖策略，未驗證勝率'].join('；');
}
// A single read-only presentation schema owns web cards, TXT/CSV and every image.
// Additional indicator studies do not silently override the four-model situation.
function view(a){
 const d=a.foundation?.dualScanContext,p=a.foundation?.alertPlan,t=technicalOutlook(a),f=a.features,valid=a.validation?.technicalModelAvailable===true,study=a.indicatorStudy;
 const technicalSummary=[
  {title:'研究重點',value:glanceEvidence(a)},
  {title:'關鍵價位',value:priceSummary(a)},
  {title:'風險',value:glanceRisk(a)},
  {title:'研究A/B',value:glanceDual(a)},
  {title:'到價提醒',value:p&&p.priceAbove?.input==null&&p.priceBelow?.input==null?`價格未設定｜漲跌幅 ${p.dayGainPercentInput??'—'}%／${p.dayLossPercentInput??'—'}%`:alertSummary(p,a)},
  {title:'資料狀態',value:compactDataSummary(a)},
  {title:'摘要結論',value:glanceAction(a)}
 ];
 const period=(x,label)=>x?.status==='已確認'?`${label} KD ${fmt(x.kd?.k)}／${fmt(x.kd?.d)}；DIF ${fmt(x.macd?.dif)}；OSC ${fmt(x.macd?.hist)}`:`${label} 待驗證：${chinese(x?.reason||'完成週期歷史或交易日曆不足')}`;
 const medium=!valid?'資料不足，暫無法判斷':!Number.isFinite(f?.ma?.[20]?.value)||!Number.isFinite(f?.ma?.[60]?.value)?'均線資料不足':f.ma[20].value>f.ma[60].value?'MA20高於MA60；週線方向仍需獨立核驗':f.ma[20].value<f.ma[60].value?'MA20低於MA60；中期仍有壓力':'MA20與MA60接近，方向待確認';
 const level=(key,label)=>{const item=a.priceLevels?.[key],formula=key==='researchBreakout'?'前20根完成日K最高價（不含當日）':item?.formula?.startsWith('max(')?'已守住的前日均線支撐最高值':'前20根完成日K最低價（不含當日）';return item?.verified&&Number.isFinite(item.value)?`${label} ${fmt(item.value)}；${formula}；行情 ${item.sourceDate}`:'資料不足，暫無法核驗價位';};
 const favourable=!valid?'基礎日K未通過，無法核驗有利依據':Object.entries(a.families||{}).filter(([k,v])=>v===true&&k!=='DATA_QUALITY').map(([k])=>({PRICE_STRUCTURE:'突破／結構',TREND_MA:'均線趨勢',VOLUME:'量能',MOMENTUM:'動能',FLOW:'資金',FUNDAMENTAL:'基本面'}[k])).filter(Boolean).join('、')||'尚無正向家族共振；仍可依已知價量判讀現況';
 const details=[
  ...technicalSummary,
  {title:'目前行情階段',value:stageLabel(a)},
  {title:'突破層級與確認',value:breakoutSummary(a)},
  {title:'原策略價位',value:`${a.originalB==null?'原策略B價未提供／不適用':`原策略B價 ${fmt(a.originalB)}（${a.priceLevels?.originalB?.verified?'已核驗':'來源待核'}）`}；${a.originalInvalidation==null?'原策略失效價未提供':`原策略失效 ${fmt(a.originalInvalidation)}`}；研究失效 ${fmt(a.researchInvalidation)}，非預設交易停損`},
  {title:'追價風險檢查',value:a.tradeContext?`RSI5 ${fmt(a.tradeContext.rsi5)}／RSI10 ${fmt(a.tradeContext.rsi10)}；MA20乖離 ${fmt(a.tradeContext.ma20GapPct)}%；前日量比 ${fmt(a.tradeContext.volumeRatioPrevious)}倍／前5日均量比 ${fmt(a.tradeContext.volumeRatioPrior5)}倍；${a.tradeContext.cautions.join('；')||'未觸發研究警戒門檻，不代表無風險'}`:'行情待核驗'},
  {title:'空間與風險情境',value:scenarioSummary(a)},
  {title:'資料來源與口徑',value:provenanceSummary(a)},
  {title:'技術現況',value:t?.details.join('；')||(a.reason?`無法核驗：${chinese(a.reason)}`:'有效日K不足，技術現況待核驗')},
  {title:'短線動能研判',value:study?.status==='已確認'?`日KD ${fmt(study.day.kd.k)}／${fmt(study.day.kd.d)}；DIF ${fmt(study.day.macd.dif)}；OSC ${fmt(study.day.macd.hist)}（DIF－訊號線，倍率1）`:'日KD／MACD資料不足，保留已可計算的價量資訊'},
  {title:'中期趨勢方向',value:medium},
  {title:'日週月週期研判',value:study?.status==='已確認'?[period(study.week,'週線'),period(study.month,'月線'),'僅使用已完成週月K；缺週月資料時不宣稱共振'].join('\n'):'日週月研究資料不足，暫無法判斷共振'},
  {title:'指標型態確認',value:study?.status==='已確認'?study.patterns.map(x=>`${x.label}：${x.status}${x.eventDate?'（'+x.eventDate+'）':''}`).join('\n'):'五種型態資料不足，尚未完成驗證'},
  {title:'四模型驗證',value:modelSummary(a)},
  ...modelFields(a),
  {title:'四策略綜合結果',value:modelSummary(a)},
  {title:'策略意見與衝突',value:conflictSummary(a)},
  {title:'多方有利依據',value:favourable},
  {title:'空方風險因素',value:riskSummary(a)},
  {title:'關鍵支撐價位',value:level('researchInvalidation','研究失效參考')},
  {title:'關鍵壓力價位',value:level('researchBreakout','前20日高點')},
  {title:'進場觀察條件',value:!valid?'先取得已核驗的完成日K':actionSummary(a)+'；研究失效價不是預設交易停損'},
  {title:'判斷失效條件',value:level('researchInvalidation','研究失效參考')+'；研究失效價非交易停損；正式風控仍以原策略為準'},
  {title:'空手操作建議',value:actionSummary(a)},
  {title:'持股風險提醒',value:riskSummary(a)+'；依原策略檢查防守條件'},
  {title:'雙模式研究',value:dualSummary(d,a)},
  ...(p?[{title:'提醒設定',value:`價格高於：${fmt(p.priceAbove?.input)}｜價格低於：${fmt(p.priceBelow?.input)}；漲跌幅 ${p.dayGainPercentInput??'—'}%／${p.dayLossPercentInput??'—'}%；僅供手動設定`},
    ...(p.priceAbove?.alreadyCrossed||p.priceBelow?.alreadyCrossed?[{title:'提醒狀態',value:'盤後已越過原價位，請重新檢查通知門檻。'}]:[])]:[]),
  {title:'行情資料完整性',value:dataSummary(a)},
  {title:'研究來源',value:`行情 ${a.date||'待核驗'}；${a.validation?.technicalModelAvailable?'使用同一份已核驗日K計算':'日K尚未通過核驗'}；僅盤後研究，訊號尚未驗證績效`}
 ];
 const unified=a.unifiedResearch,compact=compactUnifiedGuide(a,unified),summary=compact.fields;
 if(unified&&unified.state==='RESEARCH_ONLY')return {presentation:'BEGINNER_GUIDE_R17',guideNote:compact.note,schemaVersion:'UNIFIED_RESEARCH_R17',code:a.code,name:a.name,date:a.date,sourceSnapshotId:a.sourceSnapshotId,stage:unified.stageLabel||'資料不足',summary,details:[...unified.details,{title:'風險觸發與解除',value:unified.risks.map(x=>x.explanation+' 解除：'+x.clearCondition).join('\n')||'未觸發研究警示，仍需確認實際成交與風險。'},...details.filter(x=>['提醒設定','提醒狀態','雙模式研究','四模型驗證','日週月週期研判','指標型態確認','資料來源與口徑','行情資料完整性'].includes(x.title)),...modelFields(a),{title:'原策略來源',value:'四策略為不同模型來源；原資格、分數、排名未改動。'}]};
 return {presentation:'BEGINNER_GUIDE_R12',guideNote:compact.note,schemaVersion:'UNIFIED_RESEARCH_REPORT_R12_GUIDE1',code:a.code,name:a.name,date:a.date,sourceSnapshotId:a.sourceSnapshotId||null,stage:stageLabel(a),summary,details};
}
function lines(a){
 const v=view(a);
 return [globalThis.ShitouReleaseV50?.displayRelease||'石頭少爺 V8.2.2-R17｜四策略研究',`${a.name}（${a.code}）｜${a.date||'日期待確認'}`,`【現況】${v.stage}`,...[...v.summary,...v.details].map(f=>`【${f.title}】${f.value}`),'原榜分數、資格與排序保留；本區僅提供研究摘要。'];
}
function text(a){return lines(a).join('\n');}
function wrap(ctx,s,width){const out=[];for(const p of String(s).split('\n')){let row='';for(const token of p.match(/[A-Za-z0-9][A-Za-z0-9._/%+\-]*[，。！？；：、）】」』]?|[\s\S][，。！？；：、）】」』]?/g)||[]){
 if(ctx.measureText(token).width>width){for(const ch of token){if(row&&ctx.measureText(row+ch).width>width){out.push(row);row=ch;}else row+=ch;}continue;}
 if(row&&ctx.measureText(row+token).width>width){out.push(row);row=token;}else row+=token;
 }out.push(row);}return out;}
function roundRectPath(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function pages(a,{document:doc=globalThis.document,displayCode=globalThis.ShitouReleaseV50?.displayCode||'V8.2.2-R17',watermark=false,stockMetrics=null,stockMode=!!stockMetrics,detail=false}={}){
 const W=1284,H=2778,M=54,FIELD_FONT=56,FIELD_LINE=77,LABEL_FONT=40,MAX_BOTTOM=2430;
 const ctx=doc.createElement('canvas').getContext('2d');
 if(!ctx)throw Error('Canvas 2D unavailable');
 // Summary first, followed by complete research; no field is silently filtered out.
 const report=view(a);if(!detail)return guidePages(a,report,{doc,displayCode,watermark,stockMode});
 const strings=lines(a),fields=[...report.summary.map(f=>({...f,group:'SUMMARY'})),...(detail?report.details.map(f=>({...f,group:'DETAIL'})):[])];
 function measuredWrap(value,font,width){
  ctx.font=font;
  if(String(value).includes('\n'))return String(value).split('\n').flatMap(p=>measuredWrap(p,font,width));
  const fragments=String(value).split('｜').map(x=>x.trim()).filter(Boolean),out=[];
  let line='';
  for(const fragment of fragments){
   const combined=line?line+'｜'+fragment:fragment;
   if(ctx.measureText(combined).width<=width){line=combined;continue;}
   if(line){out.push(line);line='';}
   if(ctx.measureText(fragment).width<=width){line=fragment;continue;}
   // Even a single logical fragment is too long: only then use character wrapping.
   const inner=wrap(ctx,fragment,width);
   out.push(...inner.slice(0,-1));line=inner.at(-1)||'';
  }
  if(line)out.push(line);
  return out.length?out:['—'];
 }
 const boxes=fields.flatMap(m=>{
  const body=measuredWrap(m.value,`700 ${FIELD_FONT}px "Microsoft JhengHei",sans-serif`,W-2*M-82);
  // Split a single oversized field too; a long data error must not escape the page.
  const chunks=[];for(let i=0;i<body.length;i+=20){const part=body.slice(i,i+20);chunks.push({title:m.title+(i?'（續）':''),group:m.group,body:part,size:90+part.length*FIELD_LINE});}return chunks;
 });
 const plans=[];let items=[],y=580;
 for(const box of boxes){
  if((items.length&&box.group!==items[0].box.group)||y+box.size+12>MAX_BOTTOM){if(items.length)plans.push(items);items=[];y=365;}
  items.push({box,y});y+=box.size+12;
 }
 if(items.length||!plans.length)plans.push(items);
 function stockTitle(x,suffix=''){
  let name=String(a.name||'名稱待核對'),value=`${name}（${a.code||'—'}）${suffix}`;
  while(name.length>1&&x.measureText(value).width>W-2*M){name=name.slice(0,-1);value=`${name}…（${a.code||'—'}）${suffix}`;}return value;
 }
 function paint(x,plan,index){
  x.fillStyle='#0f2032';x.fillRect(0,0,W,H);
  x.fillStyle='#173958';x.fillRect(0,0,W,210);
  x.fillStyle='#fff';x.font='850 70px "Microsoft JhengHei",sans-serif';x.fillText(stockMode?'四策略研究｜個股查詢摘要':'四策略研究｜現況摘要',M,96);
  x.font='650 38px "Microsoft JhengHei",sans-serif';x.fillStyle='#cae6fa';x.fillText(`${displayCode}｜${a.date||'日期待核對'}｜${index+1}/${plans.length}`,M,166);
  if(index===0){
   x.fillStyle='#fff';x.font='850 77px "Microsoft JhengHei",sans-serif';
   x.fillText(stockTitle(x),M,322);
   x.fillStyle='#245676';roundRectPath(x,M,382,W-2*M,144,23);x.fill();
   x.fillStyle='#fff';x.font='850 60px "Microsoft JhengHei",sans-serif';x.fillText(`現況：${stageLabel(a)}`,M+29,476);
  }else{
   x.fillStyle='#fff';x.font='800 58px "Microsoft JhengHei",sans-serif';
   x.fillText(stockTitle(x,'｜續頁'),M,320);
  }
  for(const {box,y:top} of plan){
   x.fillStyle='#1b364d';roundRectPath(x,M,top,W-2*M,box.size,18);x.fill();
   x.fillStyle='#8dd4ff';x.fillRect(M,top+14,7,box.size-28);
   x.font=`800 ${LABEL_FONT}px "Microsoft JhengHei",sans-serif`;
   x.fillStyle='#9fdbff';x.fillText(box.title,M+33,top+53);
   x.font=`700 ${FIELD_FONT}px "Microsoft JhengHei",sans-serif`;
   x.fillStyle='#f4f8ff';
   box.body.forEach((line,i)=>x.fillText(line,M+33,top+117+i*FIELD_LINE));
  }
  x.fillStyle='#173958';x.fillRect(0,2530,W,248);
  x.fillStyle='#ffdf93';x.font='700 37px "Microsoft JhengHei",sans-serif';
  x.fillText('僅供盤後研究｜未證明隔日勝率',M,2605);
  x.fillStyle='#d1e5f5';x.font='650 34px "Microsoft JhengHei",sans-serif';
  x.fillText(stockMode?'單股查詢不列入濾網排名':'原榜、原分數與原資格維持不變',M,2671);
  x.fillText('資料不足須核驗；價格提醒非買進訊號',M,2732);
 }
 return plans.map((plan,index)=>{
  const bodyBottom=plan.length?Math.max(...plan.map(x=>x.y+x.box.size)):0;
  const dataset={researchAudit:JSON.stringify({code:a.code,date:a.date,sourceSnapshotId:a.sourceSnapshotId,originalB:a.originalB,alertPlan:a.foundation?.alertPlan,width:W,height:H,index:index+1,total:plans.length,minFont:FIELD_FONT,bodyBottom,noClipping:bodyBottom<=MAX_BOTTOM,mode:stockMode?'SINGLE_STOCK':'FILTER_RESEARCH',schemaVersion:report.schemaVersion,stage:report.stage,fields:plan.map(x=>({title:x.box.title,value:x.box.body.join('\n')})),section:plan[0]?.box.group||'SUMMARY',summary:strings}),release:a.version,fullBleed:'true'};
  const render=({top=0,height=H,scale=1}={})=>{
   const c=doc.createElement('canvas');c.width=Math.floor(W*scale);c.height=Math.floor(height*scale);
   const x=c.getContext('2d');x.setTransform(scale,0,0,scale,0,-top*scale);paint(x,plan,index);
   Object.assign(c.dataset,dataset);return c;
  };
  return {width:W,height:H,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){
   const c=render();if(watermark&&globalThis.applyAntiTheftWatermarkV3761)globalThis.applyAntiTheftWatermarkV3761(c,'all');
   c.toBlob(b=>{c.width=c.height=1;callback(b);},type);
  }};
 });
}
function guidePages(a,report,{doc,displayCode,watermark,stockMode}){
 const W=1284,H=2778,M=54,FONT=56,LINE=76,MAX=2420,ctx=doc.createElement('canvas').getContext('2d');
 ctx.font='850 76px "Microsoft JhengHei",sans-serif';
 const names=wrap(ctx,`${a.name}（${a.code}）`,W-2*M-80),headerBottom=300+(names.length-1)*88;
 ctx.font=`700 ${FONT}px "Microsoft JhengHei",sans-serif`;
 const boxes=report.summary.flatMap((f,section)=>{
  const body=String(f.value).split('\n').flatMap((line,i)=>{ctx.font=`${section===0&&i===0?'850 66':'700 '+FONT}px "Microsoft JhengHei",sans-serif`;return wrap(ctx,line,W-2*M-80).map(value=>({value,bold:section===0&&i===0}));});
  const chunks=[];for(let i=0;i<body.length;i+=20){const part=body.slice(i,i+20);chunks.push({title:f.title+(i?'（續）':''),section,body:part,size:102+part.length*LINE});}return chunks;
 });
 const plans=[];let items=[],top=headerBottom+45;
 for(const box of boxes){if(items.length&&top+box.size>MAX){plans.push(items);items=[];top=headerBottom+45;}items.push({box,top});top+=box.size+25;}if(items.length)plans.push(items);
 function icon(x,section,cx,cy){
  x.save();x.strokeStyle=['#e5c77a','#6ac7b8','#e5bc79','#9cccf2'][section]||'#9cccf2';x.lineWidth=4;
  if(section===2){x.beginPath();x.moveTo(cx,cy-18);x.lineTo(cx+17,cy-9);x.lineTo(cx+15,cy+10);x.lineTo(cx,cy+22);x.lineTo(cx-15,cy+10);x.lineTo(cx-17,cy-9);x.closePath();x.stroke();}
  else {x.beginPath();x.arc(cx,cy,18,0,Math.PI*2);x.stroke();if(section===3){x.beginPath();x.arc(cx,cy,10,0,Math.PI*2);x.stroke();x.beginPath();x.arc(cx,cy,3,0,Math.PI*2);x.stroke();}else if(section===1){x.beginPath();x.moveTo(cx-10,cy);x.lineTo(cx-2,cy+8);x.lineTo(cx+11,cy-9);x.stroke();}else{x.beginPath();x.moveTo(cx,cy-9);x.lineTo(cx,cy+4);x.stroke();}}
  x.restore();
 }
 function paint(x,plan,index){
  x.fillStyle='#102235';x.fillRect(0,0,W,H);x.fillStyle='#1b3c59';roundRectPath(x,M,36,W-2*M,headerBottom-36,34);x.fill();
  x.fillStyle='#b7d9ed';x.font='700 42px "Microsoft JhengHei",sans-serif';x.fillText('四策略研究｜新手進出場指南',M+40,100);
  x.fillStyle='#fff';x.font='850 76px "Microsoft JhengHei",sans-serif';names.forEach((v,i)=>x.fillText(v,M+40,195+i*88));
  x.fillStyle='#b7d9ed';x.font='650 40px "Microsoft JhengHei",sans-serif';x.fillText(`行情基準 ${(a.date||'待核驗').replaceAll('-','/')}｜${Number.isFinite(a.sourceBars?.at(-1)?.close??a.quote?.close)?'收盤 '+shortPrice(a.sourceBars?.at(-1)?.close??a.quote?.close)+' 元':'價格待核對'}`,M+40,headerBottom-35);
  for(const {box,top:y} of plan){const decision=box.section===0,last=box.section===4;
   if(decision||last){x.fillStyle=decision?'#2a4c63':'#1b364c';roundRectPath(x,M,y,W-2*M,box.size,28);x.fill();}
   x.font=`800 ${decision||last?43:54}px "Microsoft JhengHei",sans-serif`;x.fillStyle=decision||last?'#b7d9ed':'#f2f6fa';
   if(!decision&&!last)icon(x,box.section,M+22,y+41);
   x.fillText(box.title,M+40+(decision||last?0:28),y+58);
   x.fillStyle='#f4f8ff';box.body.forEach((line,i)=>{x.font=`${line.bold?'850 66':'700 '+FONT}px "Microsoft JhengHei",sans-serif`;if(/^[①②]/.test(line.value)){const cy=y+115+i*LINE;x.strokeStyle='#c3d5e2';x.lineWidth=2;x.beginPath();x.arc(M+62,cy,21,0,Math.PI*2);x.stroke();x.save();x.font='650 34px sans-serif';x.fillText(line.value[0]==='①'?'1':'2',M+52,cy+12);x.restore();x.fillText(line.value.slice(1).trimStart(),M+96,y+135+i*LINE);}else x.fillText(line.value,M+40,y+135+i*LINE);});
   if(!decision&&!last){x.strokeStyle='#385b70';x.lineWidth=2;x.beginPath();x.moveTo(M+10,y+box.size+12);x.lineTo(W-M-10,y+box.size+12);x.stroke();}
  }
  x.fillStyle='#adbfce';x.font='650 37px "Microsoft JhengHei",sans-serif';
  const notes=wrap(x,report.guideNote,W-2*M);notes.forEach((v,i)=>x.fillText(v,M,2495+i*48));
  x.font='650 30px "Microsoft JhengHei",sans-serif';x.fillText(`${displayCode}｜${index+1}/${plans.length}`,M,2740);
 }
 return plans.map((plan,index)=>{const bodyBottom=Math.max(...plan.map(x=>x.top+x.box.size)),dataset={researchAudit:JSON.stringify({code:a.code,date:a.date,sourceSnapshotId:a.sourceSnapshotId,originalB:a.originalB,alertPlan:a.foundation?.alertPlan,width:W,height:H,index:index+1,total:plans.length,minFont:FONT,bodyBottom,noClipping:bodyBottom<=MAX,mode:stockMode?'SINGLE_STOCK':'FILTER_RESEARCH',schemaVersion:report.schemaVersion,stage:report.stage,fields:plan.map(x=>({title:x.box.title,value:x.box.body.map(l=>l.value).join('\n')})),section:'SUMMARY',summary:lines(a)}),release:a.version,fullBleed:'true'};
  const render=({top=0,height=H,scale=1}={})=>{const canvas=doc.createElement('canvas');canvas.width=Math.floor(W*scale);canvas.height=Math.floor(height*scale);const x=canvas.getContext('2d');x.setTransform(scale,0,0,scale,0,-top*scale);paint(x,plan,index);Object.assign(canvas.dataset,dataset);return canvas;};
  return {width:W,height:H,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){const canvas=render();if(watermark&&globalThis.applyAntiTheftWatermarkV3761)globalThis.applyAntiTheftWatermarkV3761(canvas,'all');canvas.toBlob(blob=>{canvas.width=canvas.height=1;callback(blob);},type);}};
 });
}
function candlePage(a,options={}){const chart=typeof module==='object'&&module.exports?require('./research-chart-v1.js'):globalThis.ShitouResearchChart;return chart?.page(a,options)||null;}
return Object.freeze({entryGuide,GUIDE_NOTE,breakoutSummary,scenarioSummary,provenanceSummary,fmt,STAGES,stageLabel,technicalOutlook,modelSummary,view,lines,text,wrap,pages,candlePage,STATES});
});
