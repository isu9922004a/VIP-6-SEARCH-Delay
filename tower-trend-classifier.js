(function(root,factory){const N=typeof module==='object'&&module.exports;const api=factory(N?require('./tower-line-core.js'):root.ShitouTowerCore,N?require('./tower-risk-adapter.js'):root.ShitouTowerRisk);if(N)module.exports=api;else root.ShitouTowerTrend=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,R){
'use strict';
const E=typeof module==='object'&&module.exports?require('./selection-evidence-v1.js'):globalThis.ShitouSelectionEvidenceV1;
const G=typeof module==='object'&&module.exports?require('./selection-decision-v2.js'):globalThis.ShitouSelectionDecisionV2;
const LABELS={STRONG_BULL:'強勢多頭',BULL_CONTINUATION:'偏多續強',EARLY_STRENGTH:'初步轉強',RANGE:'盤整震盪',EARLY_WEAKNESS:'初步轉弱',BEAR:'空頭偏弱',DATA:'資料不足'};
function classify(t,r){let key='DATA';if(t.ok&&r.ok){const a=t.states[3],b=t.states[5],f=r.features;if(a.flip==='RED_TO_BLACK')key='EARLY_WEAKNESS';else if(t.flipCount20>=4&&Math.abs(f.return10d||0)<8)key='RANGE';else if(a.flip==='BLACK_TO_RED')key='EARLY_STRENGTH';else if(a.color==='BLACK')key='BEAR';else if(b.color==='RED'&&a.redDays>=3&&f.ma20Slope>0&&t.bars.at(-1).close>f.ma60&&f.volumeRatio20>=.8&&f.clv>=.6&&!r.families.EXHAUSTION)key='STRONG_BULL';else key='BULL_CONTINUATION';}
 return {key,label:LABELS[key],directionConflict:t.ok&&!t.trendAligned,entryRisk:r.status||'DATA_UNAVAILABLE',evidence:r.reasonCodes||t.reasonCodes||[],plain:key==='DATA'?`資料不足：${t.reason||r.reasonCodes?.join('、')}`:`${LABELS[key]}。T=3 ${t.states[3].color}／T=5 ${t.states[5].color}${t.trendAligned?'方向一致':'方向有衝突'}；進場分類 ${r.status}。${r.groups.map(g=>g.detail).join('；')}`};
}
function monthly(report){return {status:G.monthly(report),ma20:C.number(report.latestMA),startMonth:report.startMonth||null,definition:'沿用明示月線欄位；缺少確認不判為未通過'};}
function score(t,r,type){if(!r.ok)return null;const f=r.features,s=t.states[3],parts=type==='A'?{trend:t.trendAligned?20:8,stability:Math.min(15,s.redDays*3),volume:f.volumeRatio20>=.8&&f.volumeRatio20<=3?15:5,structure:f.ma20Slope>0?15:5,close:f.clv>=.7?10:4,room:r.levels.riskReward>=1.5?15:3,efficiency:f.efficiency>=.4?10:4}:{flip:s.flip==='BLACK_TO_RED'?25:0,position:f.gap20Pct<=8?15:5,close:f.clv>=.7?20:6,volume:f.volumeRatio20>=1&&f.volumeRatio20<=3?15:5,room:r.levels.riskReward>=1.5?15:3,background:t.states[5].color==='RED'?10:3};
 const penalties=Object.values(r.families).filter(g=>!['ROOM','BACKGROUND','MARKET'].includes(g.family)).reduce((n,g)=>n+({HIGH:20,MEDIUM:8,LOW:0}[g.severity]||0),0);
 return {value:Math.max(0,Math.min(100,Object.values(parts).reduce((a,b)=>a+b,0)-penalties)),parts,penalties,meaning:'未校準研究品質分；非勝率'};
}
function analyze(report,options={}){
 const input=report?.report||report||{},t=C.analyze(input,options),r=R.evidence(t,options),trend=classify(t,r),m=monthly(input),s=t.states[3];
 const type=t.ok&&s.flip==='BLACK_TO_RED'&&s.lastRedDate===t.date?'B':t.ok&&s.color==='RED'&&s.previousColor==='RED'&&s.redDays>=2?'A':null;
 let status=!t.ok||!r.ok?'DATA_UNAVAILABLE':!type?'REJECT':r.status;
 if(type&&status==='FORMAL_CANDIDATE'&&m.status!=='PASS')status='CONDITIONAL_WATCH';
 const reasonCodes=[...(t.reasonCodes||[]),...(r.reasonCodes||[]),...(m.status==='PASS'?[]:['MONTHLY_'+m.status]),...(!type?['NO_T3_SUBSTRATEGY']:[])];
 const selectionEvidence=E.evaluate(input,{asOf:t.date||options.asOf,bars:t.bars,completed:t.completed===true,market:input.market,benchmark:options.benchmark});
 const selectionDecision=G.evaluate(type==='B'?'TOWER_B':'TOWER_A',selectionEvidence,{dataInvalid:status==='DATA_UNAVAILABLE',formal:status==='FORMAL_CANDIDATE',noChase:status==='NO_CHASE',hardReject:status==='REJECT'});
 if(type){status={READY:'FORMAL_CANDIDATE',WATCH:'CONDITIONAL_WATCH',NO_CHASE:'NO_CHASE',EXCLUDE:'REJECT',DATA:'DATA_UNAVAILABLE'}[selectionDecision.state];reasonCodes.push('REVIEW2_'+selectionDecision.state);}
 const subtype=type?type+(status==='FORMAL_CANDIDATE'?1:status==='NO_CHASE'?3:status==='DATA_UNAVAILABLE'||status==='REJECT'?4:2):null;
 const lev=r.levels||{},fmt=x=>x===null||x===undefined?'資料不足':x.toFixed(2);
 const scenarios={bull:`下一完成收盤 > ${fmt(lev.turnAbove)} 並確認量能；隔日盤中條件尚未知。`,range:`價格未克服 ${fmt(lev.turnAbove)}，維持觀察；訊號不等於開盤買點。`,weak:`完成收盤 < ${fmt(lev.invalidation)}，T3空方門檻被跌破，重新評估多方假設。`};
 return {selectionEvidence,selectionDecision,model:C.MODEL,release:C.RELEASE,date:t.date||C.date(options.asOf||input.closeDate),code:String(input.stock||input.code||''),name:String(input.name||''),tower:t,risk:r,trend,monthly:m,type,subtype,strategy:'TOWER_GOLD',subStrategy:type==='A'?'TOWER_RED_CONTINUATION':type==='B'?'TOWER_BLACK_TO_RED':null,rawSignal:!!type,status,formalCandidate:!!type&&status==='FORMAL_CANDIDATE'&&m.status==='PASS',quality:type?score(t,r,type):null,reasonCodes:[...new Set(reasonCodes)],scenarios,holder:trend.key==='EARLY_WEAKNESS'||trend.key==='BEAR'?'持有者重新檢查趨勢失效與原有風控。':'持有者追蹤失效參考價；紅線不免除風控。',nonHolder:status==='NO_CHASE'?'空手者避免追價，等待價格與量能重新確認。':'空手者先觀察下一交易日可成交條件，盤後名單不代表進場確認。'};
}
function breadth(results,date,universe){const valid=results.filter(a=>a.date===date&&a.tower.ok),total=valid.length,red=valid.filter(a=>a.tower.states[3].color==='RED').length,black=valid.filter(a=>a.tower.states[3].color==='BLACK').length,flip=valid.filter(a=>a.type==='B').length;return {date,universe,valid:total,invalid:results.length-total,observed:results.length,red,black,blackToRed:flip,redPct:total?red/total*100:null,blackPct:total?black/total*100:null,blackToRedPct:total?flip/total*100:null,scope:results.length===universe?'全母體行情樣本（仍檢查有效數）':'已深掃快篩樣本；非全市場廣度'};}
return Object.freeze({LABELS,classify,monthly,score,analyze,breadth});
});
