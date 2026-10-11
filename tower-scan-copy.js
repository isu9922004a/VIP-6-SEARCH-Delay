(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./version-v50.js'):root.ShitouReleaseV50);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.ShitouTowerScanCopy=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(V){'use strict';
const VERSION=V.code;
const stateLabels={FORMAL_CANDIDATE:'技術候選',CONDITIONAL_WATCH:'條件觀察',NO_CHASE:'追價風險高',REJECT:'風險排除',DATA_UNAVAILABLE:'資料不足'};
const trendLabels={STRONG_BULL:'強勢多頭',BULL_CONTINUATION:'偏多續強',EARLY_STRENGTH:'初步轉強',RANGE:'盤整震盪',EARLY_WEAKNESS:'初步轉弱',BEAR:'空頭偏弱',DATA:'資料不足'};
const monthLabels={PASS:'月線通過',UNCONFIRMED:'月線尚未確認',NOT_PASS:'月線未通過',UNAVAILABLE:'月線資料不足'};
const reasons={
 MARKET_BACKGROUND_UNAVAILABLE:'缺同日大盤資料，尚未確認與大盤同步',
 LIMITED_OBSERVED_ROOM:'上方空間相對下跌風險有限',
 CALENDAR_UNVERIFIED:'歷史交易日尚未核對完整',
 ADJUSTMENT_BASIS_UNKNOWN:'除權息與價格調整基準尚未確認',
 PRICE_BASIS_UNVERIFIED:'歷史價格基準尚未驗證',
 INTRADAY_BREAKOUT_FAILED:'盤中突破後收盤跌回，留意假突破',
 CLIMAX_WEAK_CLOSE:'爆量、上影偏長且收盤偏弱',
 EXTENDED_PRICE:'漲幅或均線乖離偏大，留意追高',
 HIGH_RSI_HEALTH_CHECK:'短線熱度高，仍需檢查量價續強',
 T3_RED_TO_BLACK:'短線寶塔今日翻黑',
 THREE_FLAT_TOP_WEAKENING:'平頂且短線寶塔轉弱',
 REPEATED_TOWER_FLIPS:'近期反覆翻紅翻黑，留意假訊號',
 T3_T5_CONFLICT:'3日與5日寶塔方向不同',
 STOCK_MARKET_CONFLICT:'個股紅線但同日大盤黑線',
 MARKET_DATE_MISMATCH:'個股與大盤資料日期不同',
 TARGET_UNAVAILABLE:'上方沒有可靠歷史壓力，暫不估目標',
 ILLIQUID:'成交量或成交金額不足',
 POST_CLOSE_UNCONFIRMED:'盤後資料尚未完成確認',
 MONTHLY_NOT_PASS:'月線關卡未通過',
 MONTHLY_UNCONFIRMED:'月線起始月尚未確認',
 MONTHLY_UNAVAILABLE:'月線資料不足',
 NO_T3_SUBSTRATEGY:'尚無紅線延續或今日翻紅訊號',
 QUALITY_HISTORY_LT_60:'有效歷史資料少於60根',
 INVALID_OHLCV:'日線價格或成交量資料不完整',
 UNINITIALIZED_TREND:'尚未建立可確認的寶塔方向'
};
const sharedDataCodes=['MARKET_BACKGROUND_UNAVAILABLE','CALENDAR_UNVERIFIED','ADJUSTMENT_BASIS_UNKNOWN','PRICE_BASIS_UNVERIFIED'];
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const price=v=>{const n=number(v);return n!==null&&n>0?n.toFixed(2):'資料不足';};
const count=v=>{const n=number(v);return n!==null&&n>=0?String(n):'未記錄';};
const clean=s=>String(s??'').replace(/[\r\n\t]+/g,' ').trim();
const color=s=>s==='RED'?'紅線':s==='BLACK'?'黑線':'未確認';
const codes=a=>Array.from(new Set(a.reasonCodes||[]));
const chineseReason=code=>reasons[code]||'其他條件尚待核對';
function stockLines(a,index,date,shared=[]){
 const t=a.tower||{},s=t.states?.[3]||{},five=t.states?.[5]||{},l=a.risk?.levels||{};
 const dated=!!date&&a.date===date,valid=t.ok===true&&a.risk?.ok===true&&dated&&a.status!=='DATA_UNAVAILABLE';
 const up=valid?number(l.turnAbove):null,down=valid?number(l.invalidation):null;
 const zone=up!==null&&down!==null&&up>0&&down>0&&down<=up?`${price(down)}～${price(up)} 元（尚無新突破／跌破）`:'資料不足，暫不列整理價位';
 const today=valid&&a.type==='B'&&s.color==='RED'&&s.flip==='BLACK_TO_RED'&&s.lastRedDate===date;
 const strategy=today?'今日黑翻紅':valid&&a.type==='A'&&s.color==='RED'?'紅線延續':a.type==='B'?'翻紅日期待核對':'訊號待確認';
 const score=number(a.quality?.value),trend=dated?(trendLabels[a.trend?.key]||(/\p{Script=Han}/u.test(a.trend?.label||'')&&!/[A-Za-z_]/.test(a.trend.label)?clean(a.trend.label):'趨勢待確認')):'資料日期待核對';
 const notices=codes(a).filter(c=>!shared.includes(c)&&!c.startsWith('MONTHLY_')).map(chineseReason);
 const note=Array.from(new Set(notices)).join('；')||(a.status==='DATA_UNAVAILABLE'?'先補齊資料再判讀':a.status==='NO_CHASE'?'暫不追價，等待量價重新確認':a.status==='REJECT'?'本次未通過原候選條件':'仍須確認量能與下一交易日條件');
 const redDays=number(s.redDays),blackDays=number(s.blackDays),run=valid?(s.color==='RED'?`連紅 ${count(redDays)} 天`:s.color==='BLACK'?`連黑 ${count(blackDays)} 天`:'持續天數未確認'):'持續狀態未確認';
 const event=valid&&s.flip==='RED_TO_BLACK'?'今日翻黑':valid&&s.lastRedDate?`最近翻紅 ${clean(s.lastRedDate)}`:'最近翻紅未確認';
 return [
  `第${index+1}名｜${clean(a.name)||'名稱未提供'}（${clean(a.code)||'代號未提供'}）`,
  `趨勢：${trend}｜${strategy}｜${stateLabels[a.status]||'條件待確認'}${score===null?'':`｜品質 ${score}/100`}`,
  `股價：${price(t.bars?.at(-1)?.close)} 元｜向上轉強：${up!==null&&up>0?'收盤 > '+price(up)+' 元':'資料不足'}｜向下轉弱：${down!==null&&down>0?'收盤 < '+price(down)+' 元':'資料不足'}`,
  `整理觀察：${zone}`,
  `寶塔：3日${valid?color(s.color):'未確認'}／5日${valid?color(five.color):'未確認'}｜${run}｜${event}｜${monthLabels[a.monthly?.status]||'月線尚未提供確認'}`,
  `留意：${note}`
 ];
}
function format(scan){
 if(!scan)return '請先完成寶塔線點金術掃描。';
 const list=Array.isArray(scan.candidates)?scan.candidates:[],date=clean(scan.date)||'未確認';
 const shared=sharedDataCodes.filter(code=>list.length&&list.every(a=>codes(a).includes(code)));
 const lines=['④ 寶塔線點金術｜選股排名戰報',`版本：${V.displayCode}`,
  `資料日：${date}｜本次排名 ${list.length} 檔｜研究觀察版`,
  `深掃：${count(scan.attempted)}／${count(scan.planned)}｜成功 ${count(scan.success)}｜失敗 ${count(scan.failed)}｜資料不足 ${count(scan.dataUnavailable)}｜未處理 ${count(scan.pending)}`,
  `${scan.complete?'本次掃描已處理完成':'本次掃描尚未完整完成'}；${scan.fullMarketCertified?'原完整市場資料認證通過':'僅列已掃描樣本，非全市場完整排名'}。`,
  '沿用畫面原排名；研究品質分不是勝率。',''];
 if(!list.length)lines.push('本次沒有可列出的候選；缺資料、失敗或未處理者不能視為已排除。');
 list.forEach((a,i)=>lines.push(...stockLines(a,i,scan.date,shared),''));
 if(shared.length)lines.push('共同資料提醒：'+shared.map(chineseReason).join('；')+'。');
 lines.push('價位以完成收盤確認；大於才轉強、小於才轉弱，相等仍觀察。整理區間僅表示尚無新翻轉，不等於已確認盤整。',
  '突破後仍須確認量能；盤後名單不是直接進場訊號。');
 return lines.join('\n');
}
function install(root){
 const button=root.document?.getElementById('towerCopy'),integration=root.ShitouTowerIntegration;
 if(!button||!integration)return;
 button.textContent='📋 複製選股排名戰報';
 button.onclick=async()=>{const scan=integration.getLast();if(!scan||button.disabled)return;button.disabled=true;
  try{const text=format(scan);if(root.navigator.clipboard?.writeText)await root.navigator.clipboard.writeText(text);else{const field=root.document.createElement('textarea');field.value=text;root.document.body.appendChild(field);field.select();const ok=root.document.execCommand('copy');field.remove();if(!ok)throw Error('請允許瀏覽器使用剪貼簿。');}button.title=`已複製本次 ${scan.candidates?.length||0} 檔排名戰報。`;}
  catch(_){const message=root.document.getElementById('towerSummary');if(message)message.textContent='排名戰報複製未完成，請允許瀏覽器使用剪貼簿後重試。';}
  finally{if(button.isConnected&&integration.getLast()===scan)button.disabled=false;}
 };
}
return Object.freeze({VERSION,format,stockLines,install});
});
