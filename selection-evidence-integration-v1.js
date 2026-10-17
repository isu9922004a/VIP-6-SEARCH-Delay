/* Shared post-close research for main/daytrade. Strong and tower attach at their actual evaluation sites. */
(function(root){'use strict';
const E=root.ShitouSelectionEvidenceV1;if(!E)throw Error('四策略共用研究檢查未載入');
function wrap(name,fn){const base=root[name];if(typeof base==='function')root[name]=function(...args){return fn.call(this,base,...args);};}
for(const name of ['momentumCandidateV3768','dayTradeCandidateV1'])wrap(name,function(base,report,quote,...args){
 const c=base.call(this,report,quote,...args),target=quote?.quoteDate||report?.marketDate||report?.closeDate||report?.dataDate;
 const complete=c?.towerShadow?.tower?.completed===true||report?.completed===true||report?.dataTiming==='POST_CLOSE_ONLY';
 return E.attach(c,report,{asOf:target,quote,completed:complete});
});
const marker='【四策略共用｜新買條件研究檢查】';
function evidence(c,scan){
 const report=c.report;if(!report)return null;
 const target=scan?.dataDate||scan?.marketDate||scan?.date||report.marketDate||report.closeDate||report.dataDate;
 if(c.selectionEvidence?.date===E.date(target))return c.selectionEvidence;
 return E.evaluate(report,{asOf:target,completed:c?.towerShadow?.tower?.completed===true||report.completed===true||report.dataTiming==='POST_CLOSE_ONLY'});
}
function text(scan){return marker+'\n只統計本次候選，不是全市場排名；研究檢查沒有改寫原策略分數與資格。\n'+(scan?.candidates||[]).map(c=>`${c.name||c.report?.name||''}（${c.code||c.report?.stock||c.report?.code||'代號不足'}）｜${E.describe(evidence(c,scan))}`).join('\n');}
for(const name of ['buildMomentumScanTextReportV3763','buildMomentumScanCompactTextReportV377713','buildDayTradeTextReportV1'])wrap(name,function(base,scan,...args){const out=base.call(this,scan,...args);return String(out).includes(marker)?out:String(out)+'\n\n'+text(scan);});
function panel(scan,id){
 const host=document.getElementById(id);if(!host)return;const old=document.getElementById(id+'SelectionEvidence');if(old)old.remove();
 const section=document.createElement('section');section.id=id+'SelectionEvidence';section.className='rule';
 const title=document.createElement('h3');title.textContent='四策略共用｜原訊號與新買風險分開';section.appendChild(title);
 const note=document.createElement('p');note.textContent='以下只看完成日K；研究分層不代表勝率，不改原名次。最大量日不含訊號當天；月線與指數缺資料會明確標示。';section.appendChild(note);
 for(const c of scan?.candidates||[]){const detail=document.createElement('details'),summary=document.createElement('summary'),e=evidence(c,scan);summary.textContent=`${c.name||c.report?.name||''}（${c.code||c.report?.stock||c.report?.code||'-'}）｜${e?.label||'資料不足'}`;const p=document.createElement('p');p.textContent=E.describe(e);detail.appendChild(summary);detail.appendChild(p);section.appendChild(detail);}
 host.appendChild(section);
}
for(const [name,id] of [['renderMomentumScanResultV3762','momentumResult'],['renderMomentumScanResultV3765','momentumResult'],['renderDayTradeScanResultV1','dayTradeResult']])wrap(name,function(base,scan,...args){const out=base.call(this,scan,...args);panel(scan,id);return out;});
root.ShitouSelectionEvidenceIntegration=Object.freeze({text,panel,model:E.MODEL});
})(typeof window!=='undefined'?window:globalThis);
