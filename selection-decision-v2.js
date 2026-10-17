/* Actual selection decisions. Existing scores are kept as scores, never called probabilities. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouSelectionDecisionV2=api;})(globalThis,function(){
'use strict';
const MODEL='FOUR_STRATEGY_DECISION_REVIEW_2',rank={READY:0,WATCH:1,NO_CHASE:2,DATA:3,EXCLUDE:4};
function monthly(r={}){
 if(r.monthlyReviewV2){const x=r.monthlyReviewV2;return x.verified===true&&['PASS','NOT_PASS','UNCONFIRMED','UNAVAILABLE'].includes(x.status)?x.status:'UNAVAILABLE';}
 if(r.officialMonthlyUnavailable===true)return 'UNAVAILABLE';
 if(r.monthlyPass===false)return 'NOT_PASS';
 if(r.entry===true&&r.startMonthConfirmed===true)return 'PASS';
 if(r.monthlyPass===true)return r.startMonthConfirmed===true?'PASS':'UNCONFIRMED';
 // A missing field or entry=false is not evidence that the monthly MA20 failed.
 return 'UNCONFIRMED';
}
function evaluate(kind,e,original={}){
 const reasons=[],result=state=>({model:MODEL,kind,state,rank:rank[state],formalEligible:state==='READY',reasons:[...new Set(reasons)],affectsSelection:true,affectsScore:false,performanceValidated:false});
 if(original.dataInvalid===true){reasons.push(...(original.dataReasons?.length?original.dataReasons:['原策略必要資料不足，不提升為條件候選']));return result('DATA');}
 if(!e||e.state==='DATA'){reasons.push(...(e?.reasons||['共用日K或完成狀態未通過']));return result('DATA');}
 const f=e.features||{},below=e.phase==='BELOW_VOLUME_LOW';
 if(original.hardReject===true||(f.weakClimax&&(f.failedVolumeHigh||f.flowDivergence||below))){reasons.push('多項轉弱證據同時成立，排除正式與條件候選',...e.reasons);return result('EXCLUDE');}
 if(original.noChase===true||e.state==='CAUTION'){if(original.noChase===true)reasons.push('原策略已有不追價風險條件，保留觀察並取消正式順位');if(e.state==='CAUTION')reasons.push(...e.reasons);return result('NO_CHASE');}
 if(e.monthlyStatus!=='PASS')reasons.push(e.monthlyStatus==='NOT_PASS'?'月20MA條件未通過，等待重新確認':'月線尚未驗證；等待完整個股月線資料');
 if(original.formal===false)reasons.push('原策略正式資格尚未成立，不由新檢查提升');
 if(e.state==='WATCH')reasons.push(...e.reasons);
 if(kind==='TOWER_B')reasons.push('今日翻紅是起漲觀察訊號，隔日延續尚未驗證');
 if(kind==='MAIN'&&e.phase==='BREAKOUT_TODAY')reasons.push('主升突破當日先等待下一根完成日K');
 if(!reasons.length)reasons.push('原策略資格、共用量價與月線條件通過；仍需下一交易日確認成交條件');
 return result(reasons.length===1&&reasons[0].startsWith('原策略資格')?'READY':'WATCH');
}
function describe(d){const labels={READY:'正式條件候選',WATCH:'等待確認',NO_CHASE:'不追價觀察',DATA:'資料不足',EXCLUDE:'風險排除'};return !d?'選股決策尚未完成':`${labels[d.state]}｜${d.reasons.join('；')}｜本層實際影響候選分類，工程規則未驗證績效。`;}
return Object.freeze({MODEL,rank,monthly,evaluate,describe});
});
