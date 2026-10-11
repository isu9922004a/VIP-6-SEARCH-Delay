(function(root,factory){const C=typeof module==='object'&&module.exports?require('./tower-line-core.js'):root.ShitouTowerCore;const api=factory(C);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouTowerRisk=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function sma(b,n,end=b.length){return end>=n?mean(b.slice(end-n,end).map(r=>r.close)):null;}
function rsi(b,n=5){if(b.length<n+1)return null;let g=0,l=0;for(let i=1;i<=n;i++){const d=b[i].close-b[i-1].close;g+=Math.max(d,0)/n;l+=Math.max(-d,0)/n;}for(let i=n+1;i<b.length;i++){const d=b[i].close-b[i-1].close;g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;}return l?100-100/(1+g/l):g?100:50;}
function evidence(tower,context={}){
 if(!tower.ok)return {ok:false,status:'DATA_UNAVAILABLE',reasonCodes:tower.reasonCodes||['INVALID_DATA'],groups:[],quality:null};
 const b=tower.bars,r=b.at(-1),prior=b.slice(-21,-1),ma20=sma(b,20),ma60=sma(b,60),old20=sma(b,20,b.length-5),atr=b.length>=15?mean(b.slice(-14).map((r,k)=>{const p=b[b.length-15+k].close;return Math.max(r.high-r.low,Math.abs(r.high-p),Math.abs(r.low-p));})):null;
 if(ma20===null||ma60===null||atr===null)return {ok:false,status:'DATA_UNAVAILABLE',reasonCodes:['QUALITY_HISTORY_LT_60'],groups:[],quality:null};
 const high=Math.max(...prior.map(r=>r.high)),range=r.high-r.low,clv=range?(r.close-r.low)/range:.5,upper=range?(r.high-Math.max(r.open,r.close))/range:0,vol5=mean(b.slice(-6,-1).map(r=>r.volume)),vol20=mean(prior.map(r=>r.volume)),vr=vol20>0?r.volume/vol20:null,rs=rsi(b),gap=(r.close/ma20-1)*100,extension=atr>0?(r.close-ma20)/atr:null;
 const ret=n=>b.length>n?(r.close/b.at(-1-n).close-1)*100:null,ret5=ret(5),ret10=ret(10),ret20=ret(20);
 const groups=[],add=(code,family,severity,detail)=>groups.push({code,family,severity,detail});
 const epsilon=Math.max(1,r.close)*1e-12,failed=r.high>high+epsilon&&r.close<high-epsilon;
 // A tiny wick over a previous high is not a hard rejection of a healthy leader.
 if(failed)add('INTRADAY_BREAKOUT_FAILED','BREAKOUT',atr>0&&(r.high-high)/atr>=.25&&(high-r.close)/atr>=.1&&clv<.6?'HIGH':'MEDIUM',`盤中高點 ${r.high.toFixed(2)} 突破前20日高 ${high.toFixed(2)}，收盤 ${r.close.toFixed(2)} 跌回；按ATR穿越深度與弱收盤分級`);
 const climax=vr!==null&&vr>=3&&upper>=.3&&clv<.5;
 if(climax)add('CLIMAX_WEAK_CLOSE','EXHAUSTION','HIGH',`量比 ${vr.toFixed(2)}、上影 ${(upper*100).toFixed(1)}%、收盤位置 ${(clv*100).toFixed(1)}%`);
 const hot=gap>=12||extension>=3.5||ret5>=20||ret20>=35;
 if(hot)add('EXTENDED_PRICE','HEAT',upper>=.25||clv<.55||climax?'HIGH':'MEDIUM',`日20MA乖離 ${gap.toFixed(1)}%、ATR延伸 ${extension?.toFixed(2)}、5日 ${ret5?.toFixed(1)}%、20日 ${ret20?.toFixed(1)}%`);
 if(rs>=90&&!hot)add('HIGH_RSI_HEALTH_CHECK','HEAT','LOW',`RSI5 ${rs.toFixed(1)}；高RSI單獨不否決`);
 const s=tower.states[3];if(s.flip==='RED_TO_BLACK')add('T3_RED_TO_BLACK','TREND','HIGH',`T=3今日正式紅翻黑 ${tower.date}`);
 if(tower.patterns.threeFlatTop&&s.color==='BLACK')add('THREE_FLAT_TOP_WEAKENING','EXHAUSTION','HIGH','三柱平頂研究型態且T=3轉弱');
 if(tower.flipCount20>=4)add('REPEATED_TOWER_FLIPS','CHOP','MEDIUM',`20根內翻轉 ${tower.flipCount20} 次，須檢查盤整假訊號`);
 if(!tower.trendAligned)add('T3_T5_CONFLICT','BACKGROUND','MEDIUM',`T=3 ${s.color}，T=5 ${tower.states[5].color}`);
 const market=context.marketTower;if(market?.ok){if(market.date!==tower.date)add('MARKET_DATE_MISMATCH','DATA','HIGH','大盤與個股不同日');else if(market.states[3].color==='BLACK'&&s.color==='RED')add('STOCK_MARKET_CONFLICT','MARKET','MEDIUM','個股紅線而同日大盤黑線');}else add('MARKET_BACKGROUND_UNAVAILABLE','MARKET','MEDIUM','缺同日大盤日K，不能確認大盤共振');
 const supports=prior.map(r=>r.low).filter(v=>v<r.close),support=supports.length?Math.max(...supports):null;
 // Historical highs only. No ATR-multiplier target is presented as a real resistance.
 const resistances=b.slice(-61,-1).map(r=>r.high).filter(v=>v>r.close),resistance=resistances.length?Math.min(...resistances):null;
 const invalidation=s.nextBlackBelow,entry=r.close,risk=invalidation!==null?entry-invalidation:null,reward=resistance!==null?resistance-entry:null,rr=risk>0&&reward>0?reward/risk:null;
 if(rr!==null&&rr<1.5)add('LIMITED_OBSERVED_ROOM','ROOM','MEDIUM',`歷史壓力 ${resistance.toFixed(2)}、T3失效 ${invalidation.toFixed(2)}、參考RR ${rr.toFixed(2)}`);
 if(resistance===null)add('TARGET_UNAVAILABLE','ROOM','MEDIUM','觀測區間上方無已知壓力，不虛構目標價或預期漲幅');
 if(!context.isIndex&&(r.volume<150000||r.close*r.volume<15000000))add('ILLIQUID','LIQUIDITY','HIGH','未達原共用流動性門檻（15萬股／估算1500萬元）');
 if(!tower.completed)add('POST_CLOSE_UNCONFIRMED','DATA','HIGH','未取得完整市場盤後完成確認');
 if(tower.warnings?.includes('CALENDAR_UNVERIFIED'))add('CALENDAR_UNVERIFIED','CONFIDENCE','MEDIUM','缺歷史交易日曆，無法證實沒有漏日或非交易日');
 if(tower.warnings?.includes('ADJUSTMENT_BASIS_UNKNOWN'))add('ADJUSTMENT_BASIS_UNKNOWN','CONFIDENCE','MEDIUM','未附歷史除權息與價格調整基準，保留研究觀察');
 if(tower.warnings?.includes('PRICE_BASIS_UNVERIFIED'))add('PRICE_BASIS_UNVERIFIED','CONFIDENCE','MEDIUM','價格基準尚未取得來源驗證');
 const families=Object.fromEntries([...new Set(groups.map(g=>g.family))].map(f=>[f,groups.filter(g=>g.family===f).reduce((acc,g)=>({LOW:1,MEDIUM:2,HIGH:3}[g.severity]>{LOW:1,MEDIUM:2,HIGH:3}[acc.severity]?g:acc))]));
 const highRisk=Object.values(families).some(g=>g.severity==='HIGH'&&['BREAKOUT','HEAT','EXHAUSTION'].includes(g.family)),dataBad=!!families.DATA;
 const status=dataBad?'DATA_UNAVAILABLE':s.color==='BLACK'||families.LIQUIDITY?'REJECT':highRisk?'NO_CHASE':groups.some(g=>g.severity==='MEDIUM')?'CONDITIONAL_WATCH':'FORMAL_CANDIDATE';
 const efficiency=b.length>10?Math.abs(r.close-b.at(-11).close)/Math.max(.0001,b.slice(-10).reduce((sum,x,i)=>sum+Math.abs(x.close-b[b.length-11+i].close),0)):null;
 return {ok:!dataBad,status,groups,families,reasonCodes:groups.map(g=>g.code),features:{ma20,ma60,ma20Slope:ma20-old20,rsi5:rs,atr14:atr,atrMethod:'14日TR算術平均',gap20Pct:gap,atrExtension:extension,return5d:ret5,return10d:ret10,return20d:ret20,volumeRatio20:vr,volumeRatio5:vol5>0?r.volume/vol5:null,clv,upperShadowRatio:upper,efficiency,prior20High:high,breakoutFailed:failed},levels:{support,resistance,invalidation,turnAbove:s.nextRedAbove,entryReference:entry,riskReward:rr},scoreMeaning:'工程研究品質分，不是上漲機率；參考RR用訊號收盤，非隔日可成交價'};
}
return Object.freeze({evidence,sma,rsi});
});

