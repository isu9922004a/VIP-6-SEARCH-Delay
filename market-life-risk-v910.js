/* V9.10 TAIEX-only, completed-day risk research. Read-only: never modify K3-K0 or selection. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ShitouMarketLifeRisk910=api;
})(globalThis,function(){
 'use strict';
 const VERSION='MARKET_LIFE_RISK_V910';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const round=(v,n=2)=>finite(v)?Number(v.toFixed(n)):null;
 const num=v=>finite(v)?v.toFixed(2):'資料不足';
 const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
 const quantile=(values,p)=>{const xs=values.filter(finite).sort((a,b)=>a-b);if(!xs.length)return null;const pos=(xs.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return xs[lo]+(xs[hi]-xs[lo])*(pos-lo);};
 function ma(bars,period,at=bars.length-1){if(at<period-1)return null;return bars.slice(at-period+1,at+1).reduce((n,b)=>n+b.close,0)/period;}
 function tr(bars,i){if(i<1)return null;const b=bars[i],prior=bars[i-1].close;return Math.max(b.high-b.low,Math.abs(b.high-prior),Math.abs(b.low-prior));}
 function atr(bars,at=bars.length-1,period=14){if(at<period)return null;let total=0;for(let i=at-period+1;i<=at;i++)total+=tr(bars,i);return total/period;}
 function ema(values,period){if(values.length<period)return null;const k=2/(period+1);let v=values.slice(0,period).reduce((a,b)=>a+b,0)/period;const out=Array(period-1).fill(null);out.push(v);for(let i=period;i<values.length;i++){v=(values[i]-v)*k+v;out.push(v);}return out;}
 function momentum(bars){
  const close=bars.map(b=>b.close);
  if(close.length<35)return {rsi5:null,macdDiff:null,macdSignal:null,macdHistogram:null,formula:'RSI5（Wilder）；MACD EMA12,26,9',available:false};
  function rsi(n){if(close.length<n+1)return null;let g=0,l=0;for(let i=1;i<=n;i++){const d=close[i]-close[i-1];g+=Math.max(0,d);l+=Math.max(0,-d);}g/=n;l/=n;for(let i=n+1;i<close.length;i++){const d=close[i]-close[i-1];g=(g*(n-1)+Math.max(0,d))/n;l=(l*(n-1)+Math.max(0,-d))/n;}return l===0?(g===0?50:100):100-100/(1+g/l);}
  const e12=ema(close,12),e26=ema(close,26),dif=e12.map((v,i)=>finite(v)&&finite(e26[i])?v-e26[i]:null),macdValues=dif.filter(finite),signal=ema(macdValues,9),last=macdValues.at(-1),sig=signal?.at(-1);
  return {rsi5:round(rsi(5)),macdDiff:round(last),macdSignal:round(sig),macdHistogram:finite(last)&&finite(sig)?round(last-sig):null,formula:'RSI5（Wilder）；MACD EMA12,26,9（DIF − 訊號線）',available:finite(last)&&finite(sig)};
 }
 function labelRole(study,close,line){
  const e=study.event||{};
  if(!finite(line))return {code:'UNKNOWN',label:'尚無有效生命線',explanation:'沒有已確認 K3 價格，不能自行補造。'};
  if(study.referenceOnly||e.referenceOnly)return {code:'HISTORICAL_REFERENCE',label:'僅供歷史參考',explanation:'原始價位已不是可直接沿用的現行支撐。'};
  const state=study.lifecycleState||e.lifecycleState;
  if(close<line&&['BREAKOUT_FAILED','SUPPORT_BROKEN'].includes(state))return {code:'RECLAIM_WATCH',label:'等待重新站回',explanation:'先前突破沒有守住，原始生命線現在是重新站回的觀察關卡。'};
  if(close<line)return {code:'ACTIVE_RESISTANCE',label:'目前為上方壓力',explanation:'收盤低於原始生命線，要重新站回才算改善。'};
  if(close>line&&e.currentRole==='RESISTANCE')return {code:'ACTIVE_RESISTANCE',label:'歷史壓力待核對',explanation:'收盤雖在關卡上方，仍須依原始事件確認是否有效站穩。'};
  if(close>=line)return {code:'ACTIVE_SUPPORT',label:'目前是守住觀察',explanation:'指數在生命線上方，但不代表支撐一定有效。'};
  return {code:'UNKNOWN',label:'角色待核對',explanation:'需要完成日 K 才能確認角色。'};
 }
 function rebound(bars,line,lifeState,at){
  if(!finite(line)||at<3||!['BREAKOUT_FAILED','SUPPORT_BROKEN'].includes(lifeState))return {code:'NONE',label:'沒有已確認反彈失敗',explanation:'不能只因一根上影線就判定反彈失敗。'};
  const last=bars[at],p=bars[at-1],q=bars[at-2],vol=atr(bars,at);
  const near=finite(vol)?Math.max(vol*.65,line*.006):line*.006;
  const attempted=p.close>q.close&&p.high>=line-near;
  if(attempted&&p.close<=line&&last.close<p.close&&last.close<line)return {code:'REBOUND_FAILURE_WARNING',label:'反彈失敗已確認',explanation:'前次反彈靠近生命線後沒有站回，最近完成日再度轉弱。'};
  if(p.close>q.close&&last.high>=line-near&&last.close<=line)return {code:'RESISTANCE_REJECTION',label:'反彈受阻',explanation:'反彈碰到重要壓力，但尚不能直接說已確認轉強。'};
  if(last.close>p.close&&last.close<line)return {code:'REBOUND_ATTEMPT',label:'反彈嘗試中',explanation:'指數回升但還在原始生命線下方。'};
  return {code:'NONE',label:'尚無反彈失敗確認',explanation:'未達反彈失敗的連續收盤條件。'};
 }
 function evaluate(study,{profile={}}={}){
  if(study?.code!=='TAIEX'||study?.instrumentType!=='TAIEX'||study?.sourceVerified!==true)throw Error('僅接受已核對的大盤加權指數完成日 K。');
  const bars=study.validatedBars;
  if(!Array.isArray(bars)||bars.length<2)throw Error('已核對大盤日 K 不足，不能評估風險。');
  const date=study.dataAsOf,latest=bars.at(-1);
  if(!date||latest.date!==date||study.close!==latest.close||bars.some((b,i)=>b.date>date||i&&b.date<=bars[i-1].date||b.completed===false||b.isComplete===false||!['open','high','low','close'].every(k=>finite(b[k]))))throw Error('日期或完成日行情不一致；禁止盤中資料混入。');
  const close=latest.close,prior=bars.at(-2).close,line=study.event?.lifeLinePrice,ma5=ma(bars,5),ma10=ma(bars,10),ma20=ma(bars,20),ma60=ma(bars,60),ma5prev=ma(bars,5,bars.length-2),atr14=atr(bars),delta=round((close/prior-1)*100),dropATR=finite(atr14)&&atr14>0?round(Math.max(0,prior-close)/atr14):null;
  const prevRatios=[];
  for(let i=Math.max(15,bars.length-61);i<bars.length-1;i++){const a=atr(bars,i);if(finite(a)&&a>0)prevRatios.push(Math.max(0,bars[i-1].close-bars[i].close)/a);}
  const sample=prevRatios.length,percentile=sample>=15?quantile(prevRatios,0.9):null;
  // ATR-normalized candidate, not a backtested winning threshold. Never tune against the target event.
  const floor=finite(profile.atrFloor)&&profile.atrFloor>=1&&profile.atrFloor<=5?profile.atrFloor:1.4;
  const shockThreshold=finite(percentile)?Math.max(floor,percentile):null;
  const loss=finite(dropATR)&&finite(shockThreshold)&&dropATR>=shockThreshold&&delta<0;
  const belowLine=finite(line)&&close<line,below5=finite(ma5)&&close<ma5,below20=finite(ma20)&&close<ma20,failed=['BREAKOUT_FAILED','SUPPORT_BROKEN'].includes(study.lifecycleState);
  const weakReasons=[];
  if(belowLine)weakReasons.push('收盤仍低於 K3 原始生命線 '+num(line)+' 點');
  if(below20)weakReasons.push('指數低於 MA20 '+num(ma20)+' 點');
  if(below5)weakReasons.push('指數低於 MA5 '+num(ma5)+' 點');
  if(failed)weakReasons.push('先前生命線突破已確認失守');
  if(finite(ma5)&&finite(ma20)&&ma5<ma20)weakReasons.push('MA5 仍在 MA20 下方');
  const role=labelRole(study,close,line),reb=rebound(bars,line,study.lifecycleState,bars.length-1),level=(()=>{
   if(bars.length<21||!finite(atr14)||!finite(ma20)||!finite(ma5))return 0;
   if(loss&&(belowLine||below5)&&weakReasons.length>=2)return 4;
   if((failed||belowLine)&&weakReasons.length>=2||weakReasons.length>=4)return 3;
   if(close>ma5&&close>ma20&&finite(ma10)&&ma5>=ma10&&(!finite(line)||close>=line)&&!failed)return 1;
   return 2;
  })();
  const names={0:'資料不足',1:'偏強觀察',2:'盤整待確認',3:'弱勢偏空',4:'急跌風險'},colors={0:'#B8C5D0',1:'#6FE8AC',2:'#FFE16B',3:'#FFAC5A',4:'#FF7890'};
  const label=names[level];
  const reasons=level===4?['單日跌幅超過事前波動基準：'+num(dropATR)+' 倍 ATR14（觀察門檻 '+num(shockThreshold)+' 倍）',...weakReasons]:level===3?weakReasons:level===1?['收盤在 MA5 與 MA20 之上','短期平均點位方向支持偏強觀察']:level===2?['目前多空條件尚未同向，先看下一根完成日 K']:['資料未達計算門檻（至少21根完成日 K 與可用 ATR14）'];
  const active=level>=3?'C':level===1?'A':'B';
  const p=num(line),m5=num(ma5),m20=num(ma20);
  const scenarios=[
   {id:'A',title:'轉強嘗試',active:active==='A',text:finite(line)?'完成日收盤站回 '+p+' 點，再檢查 MA5 與 MA20；站回不等於已確認趨勢反轉。':'先等有效生命線形成，再觀察均線。',invalidation:'再度收盤低於關卡，轉強嘗試失效。'},
   {id:'B',title:'震盪待確認',active:active==='B',text:'只有方向證據不足時才算整理；若已符合弱勢或急跌條件，不可僅因落在近期高低點之間就稱整理。',invalidation:'偏強或轉弱條件出現後，停止以整理描述。'},
   {id:'C',title:'弱勢延續',active:active==='C',text:finite(line)?'收盤仍在 '+p+' 點下方且短期結構偏弱，先看 MA5 '+m5+' 與 MA20 '+m20+'；不必等跌破近10日低點。':'無生命線時仍須以已確認的均線及跌幅判讀。',invalidation:'完成日收盤重新站回關卡並改善均線狀態，重新評估。'}
  ];
  const lastRange=bars.slice(-10),res={version:VERSION,instrumentType:'TAIEX',date,sourceVerified:true,sourceSnapshot:study.snapshotKey||null,sourceReceipt:study.indexSource?.receipt?.sha256||null,mode:'POST_CLOSE_ONLY',trend:{state:study.currentTrend?.state||'UNKNOWN',label:({STRONG:'偏強',NEUTRAL:'盤整',WEAK:'偏弱'})[study.currentTrend?.state]||'資料不足'},life:{state:study.lifecycleState||'INSUFFICIENT_DATA',eventId:study.event?.eventId||null,role,referencePrice:finite(line)?line:null},risk:{level,label,color:colors[level],reasons,signal:level===4?'盤後確認急跌':level===3?'弱勢延續需留意':level===1?'偏強仍須確認':'等待完成日方向',performanceValidated:false},rebound:reb,metrics:{close,previousClose:prior,returnPct:delta,atr14:round(atr14),dropATR,shockThreshold:round(shockThreshold),baselineSample:sample,ma5:round(ma5),ma10:round(ma10),ma20:round(ma20),ma60:round(ma60),distanceLifePct:finite(line)?round((close/line-1)*100):null,distanceMa5Pct:finite(ma5)?round((close/ma5-1)*100):null,distanceMa20Pct:finite(ma20)?round((close/ma20-1)*100):null,range10High:Math.max(...lastRange.map(b=>b.high)),range10Low:Math.min(...lastRange.map(b=>b.low))},volume:{verified:study.sourceVolumeAudit?.uncertain!==true&&study.currentTrend?.volumeRatio!=null,meaning:'集中市場成交股數',notice:study.sourceVolumeAudit?.uncertain?'成交股數來源待核對，暫不進行量能確認。':'量能僅指集中市場成交股數，不是指數本身的交易量。'},momentum:momentum(bars),scenarios,activeScenario:active,rawEventId:study.event?.eventId||null,affectsEligibility:false,affectsRanking:false,researchOnly:true,performanceValidated:false};
  return freeze(res);
 }
 return Object.freeze({VERSION,ma,atr,quantile,momentum,labelRole,evaluate});
});