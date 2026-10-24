(function(root,factory){const N=typeof module==='object'&&module.exports,api=factory(N?require('./tower-trend-classifier.js'):root.ShitouTowerTrend,N?require('./tower-line-core.js'):root.ShitouTowerCore);if(N)module.exports=api;else root.ShitouTowerScanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(A,C){
'use strict';
const compare=(a,b)=>(a.selectionDecision?.rank??9)-(b.selectionDecision?.rank??9)||(b.quality?.value??-1)-(a.quality?.value??-1)||a.code.localeCompare(b.code);
function buildText(scan){
 const a=scan.results.filter(r=>r.type==='A'&&['FORMAL_CANDIDATE','CONDITIONAL_WATCH'].includes(r.status)).sort(compare),b=scan.results.filter(r=>r.type==='B'&&['FORMAL_CANDIDATE','CONDITIONAL_WATCH'].includes(r.status)).sort(compare),line=r=>`${r.name}（${r.code}）｜${r.subtype||'無訊號'} ${r.status}｜收盤 ${r.tower.bars?.at(-1)?.close??'-'}｜品質 ${r.quality?.value??'-'}/100（非勝率）｜${r.trend.label}｜T3 ${r.tower.states[3]?.color||'不足'}／T5 ${r.tower.states[5]?.color||'不足'}｜連紅 ${r.tower.states[3]?.redDays??'-'} 日／翻紅 ${r.tower.states[3]?.lastRedDate||'-'}｜月線 ${r.monthly.status}｜${r.reasonCodes.join('、')}\n  支撐 ${r.risk.levels?.support??'不足'}／壓力 ${r.risk.levels?.resistance??'無可靠目標'}／失效 ${r.risk.levels?.invalidation??'不足'}\n  續強：${r.scenarios.bull}；失效：${r.scenarios.weak}\n  ${globalThis.ShitouSelectionDecisionV2?.describe(r.selectionDecision)||(typeof require==='function'?require('./selection-decision-v2.js').describe(r.selectionDecision):'')}\n  ${globalThis.ShitouSelectionEvidenceV1?.describe(r.selectionEvidence)||(typeof require==='function'?require('./selection-evidence-v1.js').describe(r.selectionEvidence):'共用研究檢查未載入')}`;
 const breadth=A.breadth(scan.results,scan.date,scan.universe);
 return [C.RELEASE+'｜④ 寶塔線點金術｜SHADOW研究報告',`第一節：市場概況｜資料 ${scan.date}｜有效 ${breadth.valid}／觀測 ${breadth.observed}／原始母體 ${breadth.universe}｜红 ${breadth.red}／黑 ${breadth.black}／今日黑翻紅 ${breadth.blackToRed}｜${breadth.scope}`,
 '第二節：紅線恆強候選排行',...(a.length?a.map(line):['無已驗證A訊號']), '第三節：今日黑翻紅候選排行',...(b.length?b.map(line):['無已驗證B訊號']),
 '第四節：正式技術候選與條件觀察（SHADOW未啟用交易）',...scan.results.filter(r=>['FORMAL_CANDIDATE','CONDITIONAL_WATCH'].includes(r.status)&&r.type).sort(compare).map(line),
 '第五節：假突破及過熱警示',...scan.results.filter(r=>r.status==='NO_CHASE').map(line), '第六節：隔日關鍵條件','全部價位只由已完成行情計算；跳空、VWAP、盤中成交性尚未確認。強勢不代表可以追價。',
 '第七節：資料完整性及掃描數量',`模型 ${C.MODEL}｜版本 ${C.RELEASE}｜使用者模式 ${scan.requestedMode}／實際模式 ${scan.actualMode}｜子策略 ${scan.subset}｜行情模式 ${scan.profile}`,`原始 ${scan.universe}｜已解析 ${scan.parsed}｜快篩 ${scan.quick}｜排除 ${scan.excluded}｜預計深掃 ${scan.planned}｜實際 ${scan.attempted}｜成功 ${scan.success}｜失敗 ${scan.failed}｜資料不足 ${scan.dataUnavailable}｜未處理 ${scan.pending}｜A ${a.length}／B ${b.length}`,
 `完成狀態 ${scan.complete?'完整處理完成':'未完整完成'}｜市場覆蓋認證 ${scan.fullMarketCertified?'通過':'未通過；禁止宣稱全市场完整排名'}`, ...scan.issues.map(i=>`${i.code||'-'}｜${i.reason}`),`END-OF-TOWER-GOLD｜${scan.attempted}/${scan.planned}`].join('\n');
}
async function scan({items,universe,parsed=universe,excluded=0,date,fetchBatch,subset='ALL',requestedMode='all',profile='FULL',marketTower=null,onProgress=()=>{},shouldStop=()=>false,batchSize=8}){
 if(!C.date(date)||!Array.isArray(items)||!Number.isInteger(batchSize)||batchSize<1)throw new Error('掃描合約不完整');
 if(new Set(items.map(i=>i.code)).size!==items.length)throw new Error('重複股票代碼');
 const result={date,model:C.MODEL,release:C.RELEASE,universe,parsed,excluded,quick:items.length,planned:items.length,requestedMode,actualMode:'all',profile,subset,attempted:0,success:0,failed:0,dataUnavailable:0,pending:items.length,results:[],issues:[],complete:false,fullMarketCertified:false};
 for(let offset=0;offset<items.length&&!shouldStop();offset+=batchSize){
  const batch=items.slice(offset,offset+batchSize);let payload,error;
  for(let attempt=0;attempt<2&&!shouldStop();attempt++){try{payload=await fetchBatch(batch,profile);error=null;break;}catch(e){error=e;}}
  if(shouldStop())break;
  for(const item of batch){result.attempted++;const matches=payload?.results?.filter(x=>String(x.code||x.data?.stock||x.data?.code||'')===item.code)||[],x=matches.length===1?matches[0]:null;
   if(error||!x?.ok||!x.data){if(x?.dataUnavailable===true)result.dataUnavailable++;else result.failed++;result.issues.push({code:item.code,reason:String(error?.message||x?.error||(matches.length>1?'重複回傳':'未回傳該股行情'))});continue;}
   const report=x.data;if(String(report.stock||report.code||'')!==item.code){result.dataUnavailable++;result.issues.push({code:item.code,reason:'回傳股票代號不符／缺失'});continue;}
   const q=item.q,last=(report.canonicalBars||report.dailySeries)?.at(-1);
   if(q&&(!last||C.date(q.quoteDate)!==date||C.date(last.date)!==date||Math.abs(Number(q.close)-Number(last.close))>Math.max(.02,Number(q.close)*.0001)||!(Number(q.volume)>0)||!(Number(last.volume)>0)||Math.abs(Number(q.volume)-Number(last.volume))/Number(q.volume)>.2)){result.dataUnavailable++;result.issues.push({code:item.code,reason:'市場快照與日K同日同價同量未核對'});continue;}
   const rows=(report.canonicalBars||report.dailySeries)?.map(r=>({...r}));if(q&&rows?.length)rows.at(-1).volume=Number(q.volume);
   const a=A.analyze({...report,name:item.name||report.name,canonicalBars:rows},{asOf:date,completed:true,marketTower});
   if(!a.tower.ok||!a.risk.ok||a.status==='DATA_UNAVAILABLE'){result.dataUnavailable++;result.issues.push({code:item.code,reason:a.trend.plain});}else result.success++;
   result.results.push(a);
  }
  result.pending=result.planned-result.attempted;onProgress(result);
 }
 result.pending=result.planned-result.attempted;
 const balanced=result.attempted===result.success+result.failed+result.dataUnavailable&&result.quick+result.excluded===result.parsed&&result.parsed===result.universe;
 result.complete=balanced&&result.pending===0&&result.failed===0&&result.dataUnavailable===0;
 result.fullMarketCertified=result.complete&&requestedMode==='all'&&result.results.every(a=>a.tower.calendarVerified&&a.tower.basisVerified&&a.tower.basis!=='UNKNOWN');
 result.candidates=result.results.filter(r=>r.type&&['FORMAL_CANDIDATE','CONDITIONAL_WATCH'].includes(r.status)&&(subset==='ALL'||subset===r.type)).sort(compare);result.riskCandidates=result.results.filter(r=>r.type&&['NO_CHASE','REJECT','DATA_UNAVAILABLE'].includes(r.status)&&(subset==='ALL'||subset===r.type)).sort(compare);
 result.text=globalThis.ShitouResearchIntegration?.appendScanText('TOWER',result,buildText(result))??buildText(result);return result;
}
return Object.freeze({scan,compare,buildText});
});
