/* REVIEW.2: verified common DAILY_ONLY history, real decisions, and all report paths. */
(function(root){'use strict';
const E=root.ShitouSelectionEvidenceV1,D=root.ShitouSelectionDataV2,G=root.ShitouSelectionDecisionV2;
if(!E||!D||!G)throw Error('四策略共用資料／決策模組未載入');
function wrap(name,fn){const base=root[name];if(typeof base==='function')root[name]=function(...args){return fn.call(this,base,...args);};}
wrap('loadMarketBundleFromWorkerV3766',async function(base,...args){return D.bind(await base.apply(this,args));});
const transport=root.fetchDeepBatchViaMarketWorkerV3768;
if(typeof transport==='function'){
 D.setFetcher(items=>{if(typeof scanAbortRequestedV39B12OPT==='function'&&scanAbortRequestedV39B12OPT())throw Error('使用者停止掃描');return transport.call(root,items,'DAILY_ONLY');});
 root.fetchDeepBatchViaMarketWorkerV3768=async function(items,profile='FULL'){return D.harmonize(items,await transport.call(this,items,profile),profile);};
}
const labels={READY:'正式條件候選',WATCH:'等待確認',NO_CHASE:'不追價觀察',DATA:'資料不足',EXCLUDE:'風險排除'};
function review(c,kind,original={}){
 const r=c.report||{},code=String(r.stock||r.code||c.code||'');let canonical=r,error=null,q=null;
 try{canonical=D.apply(r,code);q=D.context(code).q;}catch(e){error=String(e.message||e);}
 c.selectionEvidence=error?{model:E.MODEL,date:E.date(r.closeDate),state:'DATA',label:'資料不足',reasons:[error],warnings:[],monthlyStatus:G.monthly(r),features:null}:E.evaluate(canonical,{asOf:canonical.marketDate,quote:q,completed:true});
 c.selectionDecision=G.evaluate(kind,c.selectionEvidence,original);
 return c.selectionDecision;
}
function gateFields(c,d,baseGate={}){
 if(d.state==='READY')return baseGate;
 const category=d.state==='EXCLUDE'?'HARD_REJECT':d.state==='DATA'?'DATA_INSUFFICIENT':'CONDITIONAL',key=d.state==='DATA'?'DATA_INSUFFICIENT':d.state==='EXCLUDE'?'HARD_REJECT':d.state==='NO_CHASE'?'NO_CHASE':'REVIEW2_WATCH',blocker={key,label:labels[d.state],category,reasons:d.reasons};
 return {...baseGate,key,selectionDecisionKey:'REVIEW2_'+d.state,label:labels[d.state],icon:d.state==='EXCLUDE'?'🔴':d.state==='DATA'?'⚪':'🟡',category,executionReadiness:{...(baseGate.executionReadiness||{}),actionable:false,baseActionable:false,label:labels[d.state]},formalEligible:false,top3Eligible:false,conditionalEligible:category==='CONDITIONAL',reasons:[...new Set([...d.reasons,...(baseGate.reasons||[])])],primaryBlocker:blocker,safetyState:{...(baseGate.safetyState||{}),riskClass:category,hardReject:d.state==='EXCLUDE',noChase:d.state==='NO_CHASE',formalEligible:false,top3Eligible:false,conditionalEligible:category==='CONDITIONAL',primaryBlocker:blocker}};
}
for(const name of ['momentumCandidateV3768','dayTradeCandidateV1'])wrap(name,function(base,report,quote,...args){
 const c=base.call(this,report,quote,...args);if(!c||!c.report)return c;
 const kind=name.startsWith('momentum')?'MAIN':'DAYTRADE';
 c.selectionOriginalV2={eligible:c.eligible===true,formal:c.formalLaunchEligible===true&&!c.earlyWatchOnly,score:c.score};
 const d=review(c,kind,{dataInvalid:c.reason==='DATA_INVALID'||!!c.error,dataReasons:c.hardFails,formal:kind==='MAIN'?c.selectionOriginalV2.formal:undefined,hardReject:c.fake?.hardReject===true||c.dayTradeRiskState?.hardReject===true,noChase:c.dayTradeRiskState?.noChase===true});
 if(d.state==='DATA'){c.eligible=false;c.waitingC=false;c.reason='DATA_INVALID';c.hardGateFail=false;c.baseFilterFail=false;c.formalLaunchEligible=false;}
 else if(d.state==='EXCLUDE'){c.eligible=false;c.waitingC=false;c.hardGateFail=true;c.reason='REVIEW2_RISK_EXCLUDE';c.hardFails=[...(c.hardFails||[]),...d.reasons];c.formalLaunchEligible=false;}
 else if(d.state!=='READY'){c.formalLaunchEligible=false;c.safeEligible=false;c.top3Eligible=false;if(c.safeProfile)c.safeProfile={...c.safeProfile,eligible:false};c.warnings=[...new Set([...(c.warnings||[]),G.describe(d)])];}
 return c;
});
wrap('dayTradeActionGateV40',function(base,c,...args){const g=base.call(this,c,...args),d=review(c,'DAYTRADE',{dataInvalid:g.category==='DATA_INSUFFICIENT',dataReasons:g.reasons,formal:g.formalEligible===true,hardReject:g.category==='HARD_REJECT',noChase:g.key==='NO_CHASE'});return gateFields(c,d,g);});
for(const name of ['momentumLaunchCompareV37617','dayTradeCompareV1'])wrap(name,function(base,a,b,...args){const difference=(a.selectionDecision?.rank??9)-(b.selectionDecision?.rank??9);return difference||base.call(this,a,b,...args);});
function prepare(scan,kind){
 if(!scan)return;
 const rows=scan.candidates||[];
 for(const c of rows){
  if(kind==='DAYTRADE'&&typeof root.applyDayTradeActionGateV40==='function')root.applyDayTradeActionGateV40(c);
  else{const original=c.selectionOriginalV2||{formal:c.formalLaunchEligible===true};const d=review(c,'MAIN',{dataInvalid:c.reason==='DATA_INVALID'||!!c.error,dataReasons:c.hardFails,formal:original.formal});c.formalLaunchEligible=original.formal===true&&d.state==='READY';if(d.state!=='READY'){c.formalLaunchEligible=false;c.safeEligible=false;if(c.safeProfile)c.safeProfile={...c.safeProfile,eligible:false};}}
 }
 const compare=kind==='MAIN'?root.momentumLaunchCompareV37617:root.dayTradeCompareV1;if(typeof compare==='function')rows.sort(compare);
 if(kind==='MAIN'){
  scan.formalLaunchCandidates=rows.filter(c=>c.formalLaunchEligible===true&&c.selectionDecision?.state==='READY');scan.launchCandidates=rows.slice();
  if(Array.isArray(scan.safeCandidates))scan.safeCandidates=scan.safeCandidates.filter(c=>c.formalLaunchEligible===true&&c.selectionDecision?.state==='READY');
 }
 const counts={READY:0,WATCH:0,NO_CHASE:0,DATA:0,EXCLUDE:0};for(const c of rows)counts[c.selectionDecision?.state||'DATA']++;
 scan.selectionDecisionAudit={model:G.MODEL,counts,originalCandidates:rows.length,scope:'本輪候選；不是全市場',performanceValidated:false};
}
const marker='【四策略正式篩選｜共用日K與新買決策】';
function text(scan){return marker+'\n判讀採共用DAILY_ONLY日K；正式／等待／不追價／排除分開，原分數公式保留，資料修正可改變分數。\n'+(scan?.candidates||[]).map(c=>`${c.name||c.report?.name||''}（${c.code||c.report?.stock||c.report?.code||'-'}）｜${G.describe(c.selectionDecision)}\n${E.describe(c.selectionEvidence)}｜資料基準 ${c.report?.dailyBasisV2?.fingerprint||'未核對'}`).join('\n');}
function panel(scan,id){
 const host=document.getElementById(id);if(!host)return;document.getElementById(id+'SelectionEvidence')?.remove();
 const section=document.createElement('section');section.id=id+'SelectionEvidence';section.className='rule';
 const title=document.createElement('h3');title.textContent='四策略正式篩選｜共用日K與新買決策';section.appendChild(title);
 const audit=scan.selectionDecisionAudit?.counts||{},note=document.createElement('p');note.textContent=`正式 ${audit.READY||0}｜等待 ${audit.WATCH||0}｜不追價 ${audit.NO_CHASE||0}｜資料不足 ${audit.DATA||0}。月線缺資料不算通過；工程篩選規則尚未驗證績效。`;section.appendChild(note);
 for(const c of scan.candidates||[]){const detail=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p');summary.textContent=`${c.name||c.report?.name||''}（${c.code||c.report?.stock||'-'}）｜${labels[c.selectionDecision?.state]||'資料不足'}`;p.textContent=G.describe(c.selectionDecision)+'\n'+E.describe(c.selectionEvidence);detail.appendChild(summary);detail.appendChild(p);section.appendChild(detail);}
 host.appendChild(section);
}
for(const name of ['buildMomentumScanTextReportV3763','buildMomentumScanCompactTextReportV377713','buildDayTradeTextReportV1'])wrap(name,function(base,scan,...args){prepare(scan,name.includes('DayTrade')?'DAYTRADE':'MAIN');const out=base.call(this,scan,...args);return String(out).includes(marker)?out:String(out)+'\n\n'+text(scan);});
for(const [name,id,kind] of [['renderMomentumScanResultV3762','momentumResult','MAIN'],['renderMomentumScanResultV3765','momentumResult','MAIN'],['renderDayTradeScanResultV1','dayTradeResult','DAYTRADE']])wrap(name,function(base,scan,...args){prepare(scan,kind);const out=base.call(this,scan,...args);panel(scan,id);return out;});
// All three persisted daily/market reports use the canonical release; algorithms keep their model IDs.
root.document.title=root.ShitouReleaseV50.release;document.documentElement.dataset.releaseVersion=root.ShitouReleaseV50.code;
root.ShitouSelectionEvidenceIntegration=Object.freeze({text,panel,prepare,review,gateFields,model:G.MODEL});
})(typeof window!=='undefined'?window:globalThis);
