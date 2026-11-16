/* V9.10 pre-registered market risk outcome audit: never fabricate a historical forecast. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouMarketLifeOutcome910=api;
})(globalThis,function(){
 'use strict';
 const VERSION='MARKET_LIFE_OUTCOME_V910',freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 function snapshot(risk){
  if(!risk||risk.instrumentType!=='TAIEX'||risk.sourceVerified!==true||risk.mode!=='POST_CLOSE_ONLY'||!risk.date||!risk.activeScenario)throw Error('事前研究資料尚未核對；不能製作結果紀錄。');
  return freeze({version:VERSION,studyDate:risk.date,instrumentType:'TAIEX',close:risk.metrics.close,atr14:risk.metrics.atr14,lifeLine:risk.life.referencePrice,eventId:risk.rawEventId,sourceSnapshot:risk.sourceSnapshot,sourceReceipt:risk.sourceReceipt,riskLevel:risk.risk.level,decision:risk.activeScenario,preRegistered:true,createdFromCompletedBar:true});
 }
 function compare(earlier,later){
  if(!earlier?.preRegistered||earlier.instrumentType!=='TAIEX')throw Error('缺少不可變的事前大盤研究快照。');
  if(!later)return freeze({status:'PENDING',label:'尚未確認',date:null,reason:'等待下一個經核對完成日 K。'});
  if(later.instrumentType!=='TAIEX'||later.sourceVerified!==true||later.completed!==true||typeof later.date!=='string'||later.date<=earlier.studyDate||!Number.isFinite(later.close)||later.close<=0||!later.sourceReceipt)throw Error('未核對完成日來源或日期順序錯誤；不能宣稱預測命中。');
  const pct=(later.close/earlier.close-1)*100,vol=earlier.atr14;
  let status,reason;
  if(earlier.decision==='A'){status=pct>0?'MATCH':pct<0?'MISS':'PARTIAL';reason='偏強情境與下一個完成日收盤方向對照。';}
  else if(earlier.decision==='C'){status=pct<0?'MATCH':pct>0?'MISS':'PARTIAL';reason='弱勢警示與下一個完成日收盤方向對照。';}
  else if(earlier.decision==='B'){
   if(!Number.isFinite(vol)||vol<=0)return freeze({status:'INSUFFICIENT',label:'資料不足',date:later.date,reason:'沒有事前波動基準，不能把寬價位區間當成功。'});
   status=Math.abs(later.close-earlier.close)<=vol?'MATCH':'MISS';reason='整理情境僅以事前 ATR14 對照實際波動，不使用事後高低價重設區間。';
  }else return freeze({status:'INSUFFICIENT',label:'資料不足',date:later.date,reason:'事前情境不合法。'});
  return freeze({status,label:({MATCH:'方向符合',MISS:'方向不符合',PARTIAL:'部分符合'})[status],date:later.date,studyDate:earlier.studyDate,decision:earlier.decision,returnPct:Number(pct.toFixed(2)),reason,realizedClose:later.close,sourceReceipt:later.sourceReceipt});
 }
 function walkForward(archive){
  // Only historically archived, timestamped decisions; never regenerate old labels from today's completed data.
  if(!Array.isArray(archive))throw Error('必須提供事前封存的研究快照。');
  const results=archive.map(x=>compare(x.snapshot,x.nextCompletedSession||null));
  const known=results.filter(x=>['MATCH','MISS','PARTIAL'].includes(x.status)),match=known.filter(x=>x.status==='MATCH').length,miss=known.filter(x=>x.status==='MISS').length;
  return freeze({version:VERSION,archivedSamples:archive.length,verifiedSamples:known.length,matched:match,missed:miss,partial:known.length-match-miss,notVerified:archive.length-known.length,performanceValidated:known.length>=40,notice:known.length>=40?'歷史對照不等於未來保證；需與基準方法比較。':'可用事前封存資料不足；不得報稱預測勝率。',results});
 }
 return Object.freeze({VERSION,snapshot,compare,walkForward});
});