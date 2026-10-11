/* Beginner-facing explanation only. Do not change tower T3/T5, scan eligibility,
   original risk exclusions, monthly-20MA rules, or historical data here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouTowerBeginner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const fmt=v=>finite(v)?Number(v).toFixed(2):'資料不足';
const trend=k=>({STRONG_BULL:'A 強勢延續',BULL_CONTINUATION:'偏多觀察',EARLY_STRENGTH:'B 剛轉強',RANGE:'C 區間整理',EARLY_WEAKNESS:'D 開始轉弱',BEAR:'E 偏弱下跌',DATA:'資料不足'})[k]||'資料不足';
const color=c=>c==='RED'?'紅線（偏多）':c==='BLACK'?'黑線（偏空）':'資料不足';
function guide(a){
 const t=a?.tower||{},s=t.states?.[3]||{},s5=t.states?.[5]||{},r=a?.risk||{},f=r.features||{},l=r.levels||{},bar=t.bars?.at(-1),before=t.bars?.at(-2);
 const ready=!!(t.ok&&r.ok&&bar),c=bar?.close,low=bar?.low;
 const pastHigh=s.referenceHigh,pastLow=s.referenceLow,nextHigh=s.nextRedAbove,nextLow=s.nextBlackBelow;
 const isFlip=s.flip==='BLACK_TO_RED',isWeak=s.flip==='RED_TO_BLACK';
 const heat=[];if(finite(f.rsi5)&&f.rsi5>=80)heat.push(`RSI5 ${fmt(f.rsi5)} 已偏熱`);else if(finite(f.rsi5)&&f.rsi5>=70)heat.push(`RSI5 ${fmt(f.rsi5)} 偏高`);
 if(finite(f.gap20Pct)&&f.gap20Pct>=8)heat.push(`離日20日線 ${fmt(f.gap20Pct)}%，追價距離偏大`);
 if(finite(f.return5d)&&f.return5d>=15)heat.push(`近5日漲 ${fmt(f.return5d)}%，留意急漲後震盪`);
 const explicitHeat=!!r.families?.HEAT;
 const caution=ready&&(heat.length>0||explicitHeat||a.status==='NO_CHASE'||a.status==='REJECT');
 const dailyRisk=heat.length?heat.join('；')+'。這是提醒，不代表明天一定跌。':'目前沒有額外觸發 RSI／乖離／短期急漲提醒；不代表追價安全。';
 const modelRisk=!ready?'風險資料不足，無法判斷模型是否過熱':explicitHeat?'原模型已發出過熱警示':'原模型未觸發硬性過熱規則';
 const intro=!ready?'資料不足，暫停確認走勢；不可把缺值當成安全。':isWeak?'今天由紅轉黑，先注意轉弱與支撐。':isFlip?'今天由黑轉紅，屬於剛轉強；還需要下一交易日驗證。':s.color==='RED'?'目前是紅線，趨勢偏多；但連紅不表示現在適合追價。':'目前偏弱，先等待重新站上關鍵價。';
 const buy=!ready?'先補齊同日期的完成日K，不作進場建議。':caution?'現在不宜只因翻紅就追高，先等下一交易日的價格與量能確認。':'可以列入觀察名單，但今天的訊號不等於明天開盤就能買。';
 const nearDefense=ready?low:null;
 const volume=finite(f.volumeRatio20)?`今日成交量約為前20日平均的 ${fmt(f.volumeRatio20)} 倍`:'20日成交量比資料不足';
 const rsi=finite(f.rsi5)?`RSI5 ${fmt(f.rsi5)}（短線動能指標，不是隔日漲跌保證）`:'RSI5 資料不足';
 const pressure=finite(l.resistance)?`${fmt(l.resistance)}（歷史高點推算的候選壓力）`:'未取得可驗證的上方歷史壓力，不設目標價';
 const support=finite(l.support)?fmt(l.support):'資料不足';
 const flipToday=ready?(isFlip?`今天收盤 ${fmt(c)} > 昨日前3根最高 ${fmt(pastHigh)}；符合 T3 黑翻紅。`:isWeak?`今天收盤 ${fmt(c)} < 昨日前3根最低 ${fmt(pastLow)}；符合 T3 紅翻黑。`:`今天沒有新的 T3 翻色；當日參考上緣 ${fmt(pastHigh)}／下緣 ${fmt(pastLow)}。`):'當天收盤與前3根門檻尚未確認。';
 const next=`下一日 T3（包含今天的最近3根）：收盤 > ${fmt(nextHigh)} 為上緣突破條件；收盤 < ${fmt(nextLow)} 為下緣跌破條件（中間保留原狀態）。`;
 const up=ready?`A 續強：下一個完整收盤 > ${fmt(nextHigh)}，再確認量能與是否站穩；若隔日盤中衝高又跌回，不算收盤突破。`:'A 續強：等待下一根完整日K與量能。';
 const sideways=ready?`B 回測：如果沒站上 ${fmt(nextHigh)}，先看當日低點 ${fmt(nearDefense)} 一帶能否守住；單靠守住一天仍不能保證轉強。`:'B 回測：價位資料不足，暫不指定支撐。';
 const down=ready?`C 轉弱：若失守當日低點 ${fmt(nearDefense)}，先提高警戒；若下一完整收盤 < ${fmt(nextLow)}，才符合下一日 T3 下緣跌破條件。`:'C 轉弱：下緣資料不足，先觀察。';
 return Object.freeze({ready,category:trend(a?.trend?.key),intro,buy,color3:color(s.color),color5:color(s5.color),todayFlip:flipToday,nextThreshold:next,
  pastHigh:fmt(pastHigh),pastLow:fmt(pastLow),nextHigh:fmt(nextHigh),nextLow:fmt(nextLow),dayLow:fmt(nearDefense),support,pressure,
  price:fmt(c),volume,rsi,heat:ready?dailyRisk:'資料不足，暫不評估 RSI 或乖離風險。',modelHeat:modelRisk,heatFlag:heat.length>0||explicitHeat,
  outlook:ready?(caution?'訊號偏強也可能追高受傷；等待明確收盤與量能條件。':'趨勢可觀察；買點必須另外確認。'):'不完整的行情不能判定買賣。',
  up,sideways,down,holder:ready?`已持有：觀察 ${fmt(nearDefense)} 的短線風險，並追蹤 T3 下緣 ${fmt(nextLow)}；這些是不同層級的觀察點，不等於個人停損。`:'已持有：先核對行情與原本風控。',
  empty:ready?`尚未買：${buy} 不要把今天的翻紅或研究分數當成保證。`:'尚未買：資料不足，先不要依這份圖表做決定。',
  limitation:'今日觸發門檻＝今天以前3根；明日觀察門檻＝包含今天在內的最近3根。完整收盤才算，不能把兩者混寫。'
 });
}
return Object.freeze({guide,fmt,trend});
});
