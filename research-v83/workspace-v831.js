/* V8.3.1 compact workspace B: presentation state only. Never mutates stock/market/scanner analyses. */
(function(root){
'use strict';
const doc=root.document;if(!doc)return;
const $=id=>doc.getElementById(id),el=(tag,cls,txt)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
const filters=[
 {key:'chips',label:'籌碼板塊'},
 {key:'momentum',label:'① 主升段'},
 {key:'daytrade',label:'② 明日當沖'},
 {key:'strong',label:'③ 強勢飆股'},
 {key:'macdplus',label:'④ 強化 MACD+'},
 {key:'mainforce',label:'⑤ 主力生命線成本'},
 {key:'lowbase',label:'⑥ 主升段低位階帶量突破'}
];
let currentTab='market',currentFilter='momentum',lastFocus=null,openMode=null,observedCode='';
let tabs=[],filterButtons=[];
function setHidden(elm,flag){if(elm&&elm.hidden!==!!flag)elm.hidden=!!flag;}
function completeStock(){
 const report=root.shitouGetLastReportV82?.();
 const result=$('result');
 if(result?.style.display!=='block'||$('searchButton')?.disabled||!(report?.code||report?.stock)||!report?.closeDate)return null;
 return report;
}
function researchStock(){
 const latest=root.ShitouResearchIntegration?.getCurrentStock?.();
 const report=completeStock();
 if(!report||String(latest?.analysis?.code||'')!==String(report.code||report.stock)||String(latest?.analysis?.date||'')!==String(report.closeDate))return null;
 return latest.analysis;
}
function riskDescription(a,report){
 if(a?.limitedHistory?.verified)return '官方行情已核驗｜短期觀察：'+a.limitedHistory.explanation;
 if(!a)return '報告已完成，但四策略研究尚未備妥；請查看原始技術明細，風險條件仍須核對。';
 const terms=[];
 const stage=root.ShitouResearchReport?.stageLabel?.(a);
 if(stage)terms.push('趨勢：'+stage);
 const entry=String(a.entryDirection?.entry||'');
 if(entry==='DATA'||a.state==='INSUFFICIENT_DATA')terms.push('資料不足：不能視為買進訊號');
 else if(entry==='AVOID'||['BREAKOUT_FAILURE','OVEREXTENDED'].includes(a.state))terms.push('風險偏高：先觀望並檢查失效條件');
 const date=String(report.closeDate||'');
 if(date&&a.date!==date)terms.push('行情日期待核對');
 if(!terms.length)terms.push('已備妥研究報告；關鍵價位仍需收盤確認，不能碰到價位就當買點。');
 return terms.join('｜');
}
// Reparent the original actions, keeping button IDs, handlers and export state.
function positionStockActions(report=completeStock()){
 const panel=$('stockReportActionsPanel'),slot=$('workspaceStockActionsSlot'),result=$('result');if(!panel||!slot||!result)return;
 if(openMode){if(panel.parentElement!==result||result.firstElementChild!==panel)result.prepend(panel);}
 else if(panel.parentElement!==slot)slot.append(panel);
 setHidden(panel,!report||currentTab!=='stock');
 const context=$('workspaceStockActionsIdentity');if(context&&report){const value=(report.name||'股票')+'（'+String(report.code||report.stock)+'）｜行情 '+report.closeDate;if(context.textContent!==value)context.textContent=value;}
}
function renderSummary(){
 const card=$('workspaceStockSummary');
 const report=completeStock();
 positionStockActions(report);
 // Inline stock full analysis replaces #workspaceStockSummary card directly on Tab 2.
 if(card)setHidden(card,true);
 if(!report||currentTab!=='stock'){if(!report)observedCode='';return;}
 const code=String(report.code||report.stock);
 const nextCode=code+'|'+report.closeDate,newResult=observedCode!==nextCode;observedCode=nextCode;
 if(newResult&&currentTab==='stock'&&!openMode)$('stockReportActionsPanel')?.scrollIntoView({block:'start',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'});
}
function closeReport(){
 if(!openMode)return;
 const result=$('result');if(result){result.classList.remove('workspace-stock-open','workspace-four-only');result.removeAttribute('aria-modal');result.removeAttribute('role');}
 setHidden($('workspaceReportBackdrop'),true);setHidden($('workspaceReportToolbar'),true);
 doc.body.classList.remove('workspace-report-locked');
 openMode=null;positionStockActions();
 if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
 lastFocus=null;
}
function openReport(mode){
 if(currentTab!=='stock')return;
 const r=completeStock();if(!r){renderSummary();return;}
 if(mode==='four'&&!researchStock()){renderSummary();return;}
 const result=$('result');if(!result)return;
 closeReport();lastFocus=doc.activeElement;openMode=mode;positionStockActions(r);
 result.classList.add('workspace-stock-open');result.classList.toggle('workspace-four-only',mode==='four');
 result.setAttribute('role','dialog');result.setAttribute('aria-modal','true');result.setAttribute('aria-label',mode==='four'?'四策略研究完整報告':'個股完整技術報告');
 setHidden($('workspaceReportBackdrop'),false);setHidden($('workspaceReportToolbar'),false);
 $('workspaceReportCaption').textContent=mode==='four'?'四策略研究｜完整報告':'個股完整技術明細';
 doc.body.classList.add('workspace-report-locked');
 result.scrollTop=0;$('workspaceReportClose')?.focus({preventScroll:true});
}
function select(tab,filter){
 if(!['stock','market','filters'].includes(tab))return;
 closeReport();
 currentTab=tab;
 if(filter&&filters.some(f=>f.key===filter))currentFilter=filter;
 doc.body.dataset.workspaceV831=tab;doc.body.dataset.workspaceFilterV831=currentFilter;
 for(const b of tabs){const yes=b.dataset.target===tab;b.setAttribute('aria-selected',String(yes));b.tabIndex=yes?0:-1;}
 for(const b of filterButtons)b.setAttribute('aria-pressed',String(b.dataset.filter===currentFilter));
 setHidden($('workspaceFilterPicker'),tab!=='filters');
 const introEl=$('workspaceTabIntroduction');
 if(introEl)introEl.textContent=tab==='stock'?'輸入股票代號或名稱，完成查詢後即可查看研究、下載或分享圖片報告。':tab==='market'?'保留原本大盤行情與趨勢研究，僅顯示大盤相關入口。':'一次顯示一套選股工具；候選排行、停止及圖片匯出均保留。';
 renderSummary();
}
function build(){
 const main=doc.querySelector('main.container'),first=main?.querySelector(':scope > section.panel');
 if(!first||$('workspaceStockSummary'))return;
 first.id='workspaceSearchPanel';
 const card=el('section');card.id='workspaceStockSummary';card.hidden=true;card.setAttribute('aria-label','個股查詢結果精簡摘要');
 const stockName=el('div','workspace-stock-name');stockName.id='workspaceStockName';
 const date=el('div','workspace-stock-date');date.id='workspaceStockDate';
 const risk=el('div','workspace-stock-risk');risk.id='workspaceStockRisk';risk.setAttribute('role','status');
 const actions=el('div','workspace-stock-actions'),full=el('button','workspace-secondary','查看完整個股技術明細');
 full.id='workspaceFullReportButton';
 full.type='button';full.addEventListener('click',()=>openReport('full'));
 actions.append(full);const help=el('p','workspace-stock-help');help.id='workspaceStockHelp';
 card.append(stockName,date,risk,actions,help);
 const actionSlot=el('div');actionSlot.id='workspaceStockActionsSlot';first.after(actionSlot);actionSlot.after(card);
 const exportPanel=$('stockReportActionsPanel');if(exportPanel){
  const title=exportPanel.querySelector('.section-title');if(title)title.textContent='個股圖片報告與複製';
  const context=el('p','workspace-stock-actions-identity');context.id='workspaceStockActionsIdentity';if(title)title.after(context);else exportPanel.prepend(context);
  const commands=exportPanel.querySelector(':scope > .copy-actions'),grid=commands?.querySelector('.stock-image-generator-grid');if(grid)commands.prepend(grid);
  const note=exportPanel.querySelector(':scope > .hint');if(note){const notes=el('details','workspace-export-notes'),summary=el('summary',null,'價位與資料使用說明');notes.append(summary,note);exportPanel.append(notes);}
  positionStockActions();
 }

 const backdrop=el('div');backdrop.id='workspaceReportBackdrop';backdrop.hidden=true;backdrop.addEventListener('click',closeReport);
 const toolbar=el('div');toolbar.id='workspaceReportToolbar';toolbar.hidden=true;const caption=el('span',null,'報告');caption.id='workspaceReportCaption';const close=el('button',null,'✕ 關閉報告');close.id='workspaceReportClose';close.type='button';close.addEventListener('click',closeReport);toolbar.append(caption,close);
 doc.body.append(backdrop,toolbar);
 doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&openMode){e.stopPropagation();closeReport();}});
 const result=$('result');
 if(result){
  new MutationObserver(()=>renderSummary()).observe(result,{attributes:true,attributeFilter:['style'],childList:true});
 }
 const search=$('searchButton'),input=$('stockInput');
 function onSearchStart(){closeReport();select('stock');setHidden(card,true);setHidden($('stockReportActionsPanel'),true);observedCode='';}
 search?.addEventListener('click',onSearchStart,true);
 if(search)new MutationObserver(()=>renderSummary()).observe(search,{attributes:true,attributeFilter:['disabled']});
 input?.addEventListener('keydown',e=>{if(e.key==='Enter')onSearchStart();},true);
 doc.body.classList.add('workspace-v831');
 select('market');
 renderSummary();
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',build,{once:true});else build();
root.ShitouWorkspaceV831=Object.freeze({select,openReport,closeReport,renderSummary,getState:()=>({tab:currentTab,filter:currentFilter,modal:openMode,stock:observedCode})});
})(globalThis);
