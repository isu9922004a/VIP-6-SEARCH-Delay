/* Beginner-facing read-only explanations for the standalone tower reports.
   Never modify T3/T5, scanner eligibility, monthly-20MA gates or risk exclusions.
   Price candidates below are computed only from supplied, completed daily OHLCV. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouTowerBeginner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const fmt=v=>finite(v)?Number(v).toFixed(2):'資料不足';
const trend=k=>({STRONG_BULL:'A 強勢延續',BULL_CONTINUATION:'偏多觀察',EARLY_STRENGTH:'B 剛轉強',RANGE:'C 區間整理',EARLY_WEAKNESS:'D 開始轉弱',BEAR:'E 偏弱下跌',DATA:'資料不足'})[k]||'資料不足';
const color=c=>c==='RED'?'紅線（偏多）':c==='BLACK'?'黑線（偏空）':'資料不足';
const pct=(top,base)=>finite(top)&&finite(base)&&Number(base)>0?(Number(top)/Number(base)-1)*100:null;

/* Risk adapter's 60-bar nearest high/20-bar nearest low are *single-session*
   OHLC references, not independently confirmed structural support/resistance.
   For an optional second overhead level, look for a confirmed local swing high
   (two completed bars either side), no guesses and no current-bar lookahead. */
function observedLevels(t,r){
 const bars=Array.isArray(t?.bars)?t.bars:[],last=bars.at(-1),close=last?.close;
 if(!t?.ok||!r?.ok||!finite(close))return {first:null,second:null,support:null,firstSource:'資料不足',secondSource:'資料不足',supportSource:'資料不足',distancePct:null};
 const history=bars.slice(Math.max(0,bars.length-61),-1),eps=Math.max(1,close)*1e-9;
 const firstCandidates=history.map(b=>b.high).filter(v=>finite(v)&&v>close+eps);
 const first=firstCandidates.length?Math.min(...firstCandidates):null;
 const lowerCandidates=bars.slice(-21,-1).map(b=>b.low).filter(v=>finite(v)&&v<close-eps);
 const support=lowerCandidates.length?Math.max(...lowerCandidates):null;
 // Stronger (but still only candidate) reference: a local pivot high clearly above first.
 const swing=[];
 for(let i=2;i<history.length-2;i++){
  const h=history[i].high;
  if(!finite(h)||!(h>close+eps)||!(first===null||h>first+eps))continue;
  if([1,2].every(d=>h>history[i-d].high+eps&&h>history[i+d].high+eps))swing.push({value:h,date:history[i].date});
 }
 swing.sort((a,b)=>a.value-b.value||(a.date>b.date?1:-1));
 const second=swing[0]||null;
 const firstRows=first===null?[]:history.filter(b=>Math.abs(b.high-first)<=eps).map(b=>b.date);
 const supportRows=support===null?[]:bars.slice(-21,-1).filter(b=>Math.abs(b.low-support)<=eps).map(b=>b.date);
 return {first,second:second?.value??null,support,firstDate:firstRows.at(-1)||null,secondDate:second?.date||null,supportDate:supportRows.at(-1)||null,
  firstSource:first===null?'過去60根完整日K沒有高於收盤的已知高點':`前60根完整日K中，高於收盤最近的單日最高價（${firstRows.at(-1)||'日期未提供'}）；候選壓力，非確認突破`,
  secondSource:second?`前60根完整日K的局部高點（${second.date}；左右各2根的高點較低）；轉折壓力候選`:'沒有符合左右各2根確認條件的第二道局部高點，不自行設定',
  supportSource:support===null?'前20根完整日K無低於現價的單日低點候選':`前20根完整日K中，低於收盤最近的單日最低價（${supportRows.at(-1)||'日期未提供'}）；不是已確認守住的支撐`,
  distancePct:first===null?null:pct(first,close)};
}
function guide(a){
 const t=a?.tower||{},s=t.states?.[3]||{},s5=t.states?.[5]||{},r=a?.risk||{},f=r.features||{},bar=t.bars?.at(-1);
 const ready=!!(t.ok&&r.ok&&bar&&t.completed),c=bar?.close,low=bar?.low;
 const l=ready?observedLevels(t,r):observedLevels(null,null);
 const pastHigh=s.referenceHigh,pastLow=s.referenceLow,nextHigh=s.nextRedAbove,nextLow=s.nextBlackBelow;
 const flipRed=s.flip==='BLACK_TO_RED',flipBlack=s.flip==='RED_TO_BLACK';
 const heat=[];if(finite(f.rsi5)&&f.rsi5>=80)heat.push(`RSI5 ${fmt(f.rsi5)} 已偏熱`);else if(finite(f.rsi5)&&f.rsi5>=70)heat.push(`RSI5 ${fmt(f.rsi5)} 偏高`);
 if(finite(f.gap20Pct)&&f.gap20Pct>=8)heat.push(`高於日20MA ${Number(f.gap20Pct).toFixed(1)}%，追價距離較遠`);
 if(finite(f.return5d)&&f.return5d>=15)heat.push(`近5日漲 ${Number(f.return5d).toFixed(1)}%，留意急漲後回檔`);
 const nearPressure=l.distancePct!==null&&l.distancePct<=4&&l.distancePct>=0;
 if(nearPressure)heat.push(`距第一道歷史高點 ${fmt(l.first)} 約 ${l.distancePct.toFixed(1)}%，上方空間不大`);
 const explicitHeat=!!r.families?.HEAT,modelHigh=a?.status==='NO_CHASE'||a?.status==='REJECT';
 const elevated=explicitHeat||modelHigh||heat.some(x=>x.includes('已偏熱')||x.includes('較遠')||x.includes('急漲'))||(nearPressure&&heat.length>1);
 const chaseRisk=!ready?'無法評估':elevated?'偏高':heat.length?'需留意':'仍需確認';
 const dailyRisk=heat.length?heat.join('；')+'。屬觀察提醒，不是明天必跌。':'目前未觸發新增的短線熱度提醒；不表示現在追價安全。';
 const modelRisk=!ready?'資料未確認，無法判斷原模型':explicitHeat?'原模型已觸發 HEAT 過熱警示':'原模型未觸發 HEAT 硬性警示（不代表不熱）';
 const intro=!ready?'完成日K或風險資料不足，暫不確認趨勢。':flipBlack?'今天紅翻黑，屬於開始轉弱；先觀察有沒有跌破支撐。':flipRed?'今天黑翻紅，屬於剛轉強，還需要下一交易日的收盤確認。':s.color==='RED'?'目前持續紅線，走勢偏多；漲得強不代表價格划算。':'目前偏弱，先等待價格重新站上壓力。';
 const buy=!ready?'資料不足，暫不依此安排進場。':elevated?'趨勢可能很強，但追價風險偏高；不要只因翻紅就追，先等收盤與量價再確認。':heat.length?'有上方壓力或熱度提醒，先觀察，不要把翻紅當買點。':'先列入觀察，尚未證明隔日開盤是好買點。';
 const volume=finite(f.volumeRatio20)?`今日量約為前20日均量 ${fmt(f.volumeRatio20)} 倍；量增不等於法人必買`:'20日成交量比資料不足';
 const rsi=finite(f.rsi5)?`RSI5 ${fmt(f.rsi5)}（短線力道指標，高檔不表示明天必跌）`:'RSI5 資料不足';
 const first=l.first!==null?`${fmt(l.first)}（第一道：單日高點候選）`:'沒有可驗證的第一道上方壓力';
 const second=l.second!==null?`${fmt(l.second)}（第二道：局部轉折高點候選）`:'未找到符合條件的第二道轉折壓力';
 const support=l.support!==null?`${fmt(l.support)}（單日低點候選，未驗證反覆支撐）`:'沒有可驗證的歷史低點候選';
 const flipToday=ready?(flipRed?`今天收盤 ${fmt(c)} > 今天以前3根最高 ${fmt(pastHigh)}；符合 T3 黑翻紅。`:flipBlack?`今天收盤 ${fmt(c)} < 今天以前3根最低 ${fmt(pastLow)}；符合 T3 紅翻黑。`:`今天沒有新 T3 翻色；當日門檻上 ${fmt(pastHigh)}／下 ${fmt(pastLow)}。`):'當日翻色資訊尚未通過完成收盤與資料檢查。';
 const next=ready?`下一交易日 T3：上緣 ${fmt(nextHigh)}／下緣 ${fmt(nextLow)}（都由包含今天的最近3根計算）；上緣是寶塔續強條件，不等於突破第一／第二道壓力；下緣也不是個人停損。`:'下一日 T3 上下緣資料不足，暫不填數字。';
 const firstUp=l.first!==null?`再收盤高於第一壓力 ${fmt(l.first)} 才算進一步挑戰上方關卡`:'尚無已知壓力，不自行預測上漲目標';
 const secondUp=l.second!==null?`若之後也收盤突破第二道 ${fmt(l.second)}，才算再跨過前波轉折關卡`:'第二道高點資料不足，不能宣稱突破前波高點';
 const up=ready?`A 續強：下一個完整收盤 > ${fmt(nextHigh)} 只是比寶塔上緣更強；${firstUp}；${secondUp}。每一階段仍查量能與是否站穩，盤中衝過不算。`:'A 續強：等待下一個完整收盤，暫不預設股價路徑。';
 const sideways=ready?`B 整理：若收盤未高於 ${fmt(nextHigh)}，先看 ${fmt(low)}（今天最低價）一帶；守住一天不保證轉強，且 ${fmt(l.support)} 的歷史低點候選也不能直接當買點。`:'B 整理：日K資料不足，暫不設定支撐。';
 const down=ready?`C 轉弱：若失守今天低點 ${fmt(low)}，短線先提高警戒；若下一完整收盤 < ${fmt(nextLow)}，才達下一日 T3 下緣跌破條件，兩者不能混為一談。`:'C 轉弱：缺少完成日K，先不給精確跌破價。';
 const explainNoChase=!ready?'行情未完成或資料缺漏，不能下判斷。':[
  flipRed?'今天才剛黑翻紅，隔日還沒證明能站穩。':s.color==='RED'?'寶塔偏多，但紅線不代表開盤追高划算。':'目前非已確認多方強勢，先看支撐壓力。',
  heat.length?heat.join('；')+'。':'尚未取得足夠證據證明當下追價划算。',
  `下一日高於 ${fmt(nextHigh)} 僅代表 T3 上緣條件，${l.first!==null?'仍需另過第一壓力 '+fmt(l.first):'沒有上方壓力資料不可推定安全'}。`
 ].join(' ');
 const priceSteps=ready?[
  `下一日 T3 續強參考 ${fmt(nextHigh)}（含今天的3根；不是直接買點）`,
  `第一壓力 ${first}`,`第二壓力 ${second}`,
  `今日低點 ${fmt(low)}（短線警戒；非正式翻黑價）`,
  `歷史低點 ${support}`,
  `下一日 T3 下緣 ${fmt(nextLow)}（完成收盤跌破才觸發）`
 ]:['資料不足，不製作精確價位階梯。'];
 return Object.freeze({ready,category:trend(a?.trend?.key),intro,buy,color3:color(s.color),color5:color(s5.color),todayFlip:flipToday,nextThreshold:next,
  pastHigh:fmt(pastHigh),pastLow:fmt(pastLow),nextHigh:fmt(nextHigh),nextLow:fmt(nextLow),dayLow:fmt(ready?low:null),support,pressure:first,
  resistance1:fmt(l.first),resistance2:fmt(l.second),resistance1Source:l.firstSource,resistance2Source:l.secondSource,supportSource:l.supportSource,
  price:fmt(c),volume,rsi,chaseRisk,heat:ready?dailyRisk:'資料不足，暫不評估熱度。',modelHeat:modelRisk,heatFlag:ready&&(heat.length>0||explicitHeat),
  outlook:ready?(elevated?'趨勢偏多也可能追在高點，優先等待收盤突破與量價確認。':'方向可以觀察，但還需要可驗證的進場條件。'):'缺完整行情，不推論可否買進。',
  explainNoChase,priceSteps,up,sideways,down,
  holder:ready?`已持有：先看今天低點 ${fmt(low)} 的短線警戒，再看下一日 T3 下緣 ${fmt(nextLow)}；不把兩者當成個人停損。`:'已持有：先核實行情與既有停損規則。',
  empty:ready?`尚未買：${buy} 明天是否可成交、會否跳空，今天無法預知。`:'尚未買：行情資料不足，先不依此報告下單。',
  limitation:'以上價位僅依目前可得已完成日K推算；歷史單日高低點是候選關卡，未經反覆測試驗證。當日與下一日的3T取樣期間不同；所有突破／跌破須看完整收盤。'
 });
}
return Object.freeze({guide,fmt,trend,observedLevels});
});
