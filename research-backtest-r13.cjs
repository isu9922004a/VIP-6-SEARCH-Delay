'use strict';
// Caller supplies point-in-time universe and ORIGINAL eligibility/rank receipts.
// Missing historical universe prevents any survivorship-free performance claim.
const A=require('./unified-analysis-v1.js');
const variants={A:{unifiedResearchEnabled:false},B:{oneThirdEnabled:true,postLimitupEnabled:false,waveEnabled:false},C:{oneThirdEnabled:false,postLimitupEnabled:true,waveEnabled:false},D:{oneThirdEnabled:false,postLimitupEnabled:false,waveEnabled:true},E:{}};
function replay({dates,universeAt,reportAt,baselineAt}){
 if(!Array.isArray(dates)||!universeAt||!baselineAt||!reportAt)throw Error('需逐時點交易日、原始母體與排名');
 const rows=[];
 for(const date of dates){const universe=universeAt(date),baseline=baselineAt(date);if(!universe?.verified||!baseline?.verified)throw Error('缺少歷史母體或原版排名證據，停止績效宣稱');for(const code of baseline.codes){if(!universe.codes.includes(code))throw Error('原版名單不在當時母體');const r=reportAt(code,date);if(r.closeDate!==date||(r.canonicalBars||r.dailySeries).some(b=>b.date>date))throw Error('禁止未來資料');for(const [variant,flags] of Object.entries(variants))rows.push({date,code,variant,research:A.evaluate(r,{flags}),originalRank:baseline.codes.indexOf(code)+1});}}
 return {status:'SHADOW_REPLAY_ONLY',rows,rankingChanged:false,performance:null,reason:'研究特徵未改正式名單；交易績效另依成交模擬，不能將收盤漲跌稱為勝率。'};
}
function trade({entryBar,future,stop,target,limitEvidence,costs=A.PARAM}){if(!limitEvidence?.verified)return {status:'UNVERIFIABLE_FILL'};if(limitEvidence.lockedUp||!(entryBar.open>stop&&target>entryBar.open))return {status:'NO_FILL'};const entry=entryBar.open;let exit=future.at(-1)?.close,reason='TIME_EXIT';for(const b of [entryBar,...future]){if(b.open<stop){exit=b.open;reason='GAP_STOP';break;}if(b.low<=stop){exit=stop;reason='STOP_FIRST_IF_BOTH';break;}if(b.high>=target){exit=target;reason='TARGET';break;}}if(!Number.isFinite(exit))return {status:'DATA_INSUFFICIENT'};const net=exit*(1-costs.slippage)*(1-costs.fee*costs.feeDiscount-costs.tax)-entry*(1+costs.slippage)*(1+costs.fee*costs.feeDiscount);return {status:'SIMULATED',entry,exit,reason,netPerShare:net,notWinRate:true};}
module.exports={variants,replay,trade};
