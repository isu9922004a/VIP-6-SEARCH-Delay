'use strict';

/* 量價判讀層
 * 來源是使用者提供的上、下集字幕。字幕有辨識錯字，因此只採用可由完成日 K
 * 客觀重算的原則：量、價、時間、角度、相對強弱、三盤與風險先行。
 */
(function(root,factory){
  let wave=root?.ShitouWaveCoreV48||null;
  if(typeof module==='object'&&module.exports)try{wave=require('./shitou-wave-core-v48.js');}catch(_){}
  const api=factory(wave);if(root)root.ShitouXiaoMingDaoV52=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(W){
  const MODEL='XIAOMINGDAO_VOLUME_PRICE_V52';
  const ROLE='SELECTION_TIE_RANK_AND_EXPLANATION';
  const SOURCE_EVIDENCE=Object.freeze([
    Object.freeze({file:'量價分析上集.srt',time:'00:49:28–00:50:14',principle:'三盤是日線風險保險；遇到風險可先退出，之後再買回。'}),
    Object.freeze({file:'量價分析上集.srt',time:'01:11:55–01:12:21',principle:'型態突破或跌破要靠量，突破前常先量縮整理。'}),
    Object.freeze({file:'量價分析上集.srt',time:'01:00:38–01:00:52',principle:'角度平緩、量能不配合的突破要防假突破。'}),
    Object.freeze({file:'量價分析下集.srt',time:'00:00:04–00:00:32',principle:'個股要和產業、大盤比較相對強弱。'}),
    Object.freeze({file:'量價分析下集.srt',time:'00:35:09–00:35:22',principle:'不要只把前低或均線當支撐，必須回到量價結構。'}),
    Object.freeze({file:'量價分析下集.srt',time:'01:14:51–01:15:23',principle:'判讀由量、價、時間、角度共同組成。'}),
    Object.freeze({file:'量價分析下集.srt',time:'00:41:08–00:41:29',principle:'先避免套牢；可控制的小損失優先於硬等反彈。'})
  ]);
  const num=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const reportOf=input=>input?.report||input||{};
  function relativeStrengthOf(input){
    const report=reportOf(input),values=[input?.industryContext?.relativeStrength,report?.industryContext?.relativeStrength,input?.relativeStrength,report?.relativeStrength];
    return values.map(num).find(value=>value!==null)??null;
  }
  function threePanState(w){
    if(w?.threeBreakdown)return {key:'BREAKDOWN_CONFIRMED',icon:'🔴',label:'三盤跌破／波段風控',plain:'收盤一破二；量縮或均線偏多均不能解除已發生的跌破。'};
    if(w?.threeBreakoutConfirmed)return {key:'BREAKOUT_CONFIRMED',icon:'✅',label:'三盤發動／量潮接力',plain:'收盤一過二，攻擊量與較大潮配合；仍需下日重新查核。'};
    if(w?.threeBreakout)return {key:'BREAKOUT_UNCONFIRMED',icon:'🟠',label:'三盤向上／發動證據待接力',plain:'價格訊號成立，量潮背景仍待確認；不足不直接稱假突破。'};
    return {key:'NO_TURN',icon:'⚪',label:'無新三盤轉折',plain:'沒有新的三盤訊號；既有波段是否延續、盤整是否成立須分別判讀。'};
  }
  function component(key,label,earned,max,plain,available=true){return {key,label,earned:available?clamp(Math.round(earned),0,max):null,max,available,plain};}
  function analyze(input,waveAnalysis=null){
    const report=reportOf(input),w=waveAnalysis?.ok?waveAnalysis:W?.analyzeReport?.(report),T=globalThis.ShitouTeacherThreePan;
    if(!w?.ok)return {ok:false,model:MODEL,role:ROLE,score:null,label:'資料不足',reason:w?.reason||'核心未載入',components:[],sourceEvidence:SOURCE_EVIDENCE};
    const a=T.fromReport({...report,dailySeries:w.bars,canonicalBars:w.bars,industryContext:input?.industryContext||report.industryContext,relativeComparison:input?.relativeComparison||report.relativeComparison});
    if(!a.ok)return {ok:false,model:MODEL,reason:a.reason,components:[]};
    const pan=threePanState(w),relative=a.relative.industryVsMarket,relativeAvailable=relative!==null;
    const components=[component('PRICE','價格環境',[a.priceStack,a.priceRising].filter(Boolean).length,2,a.longLabel),component('THREE_PAN','當前波段資格',a.formalEligible?1:0,1,a.plain),component('VOLUME','量潮接力',[a.volumeStack,a.tideRising,a.volumeStart].filter(Boolean).length,3,a.volumePhase)];
    const score=a.score,key=a.signal.key==='DOWN'||a.exhaustion?'AVOID':a.formalEligible?'CONDITIONAL':'WATCH',icon=key==='AVOID'?'🔴':key==='CONDITIONAL'?'🟢':'🟡';
    const openingChecklist=[`價格：下一根收盤高於 ${T.fmt(a.next.high)} 才是新三盤向上；已建立波段另看延續。`,`成交量：追蹤攻擊量與13／34日量潮；量縮創高與量縮止漲分開。`,`風險：下一根收盤低於 ${T.fmt(a.next.low)} 更新三盤風控；當前跌破不等明日確認。`];
    return {ok:true,model:MODEL,role:ROLE,score,key,icon,label:a.phaseLabel,coverageMax:6,coveragePct:100,earned:a.completeness,threePan:pan,components,openingChecklist,trigger:a.next.high,defense:a.next.low,relativeStrength:relative,relativeAvailable,teacher:a,rankingUse:'先通過三盤波段資格，再按量潮條件覆蓋排序；分數不是勝率',notWinRate:true,sourceEvidence:SOURCE_EVIDENCE};
  }
  function textBlock(input){
    const a=input?.model===MODEL?input:analyze(input);if(!a.ok)return `【量價判讀】\n資料不足：${a.reason}`;
    return [`【量價判讀｜量價波段狀態】`,`${a.icon} ${a.label}｜${a.score}/100（條件完整度，不是勝率）`,`三盤白話：${a.threePan.plain}`,'條件覆蓋（工程描述）：',...a.components.map(item=>`- ${item.label}：${item.available?`${item.earned}/${item.max}`:'資料不足'}｜${item.plain}`),'下一根完成日K觀察：',...a.openingChecklist.map((item,index)=>`${index+1}. ${item}`),`定位：${a.rankingUse}。`].join('\n');
  }
  return Object.freeze({MODEL,ROLE,SOURCE_EVIDENCE,num,relativeStrengthOf,threePanState,analyze,textBlock});
});
