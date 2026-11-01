/* V8.3.1 compact workspace B: presentation state only. Never mutates stock/market/scanner analyses. */
(function(root){
'use strict';
const doc=root.document;if(!doc)return;
const $=id=>doc.getElementById(id),el=(tag,cls,txt)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
const filters=[
 {key:'momentum',label:'① 主升段'},
 {key:'daytrade',label:'② 明日當沖'},
 {key:'strong',label:'③ 強勢飆股'},
 {key:'tower',label:'④ 寶塔線'},
 {key:'restaurant',label:'⑤ 餐廳量價'},
 {key:'structure',label:'⑥ 結構反轉'}
];
let currentTab='stock',currentFilter='momentum',lastFocus=null,openMode=null,observedCode='';
let tabs=[],filterButtons=[];
function setHidden(elm,flag){if(elm)elm.hidden=!!flag;}
function completeStock(){
 const report=root.shitouGetLastReportV82?.();
 const result=$('result');
 if(result?.style.display!=='block'||!report?.code||!report?.closeDate)return null;
 return report;
}
function researchStock(){
 const latest=root.ShitouResearchIntegration?.getCurrentStock?.();
 const report=completeStock();
 if(!report||String(latest?.analysis?.code||'')!==String(report.code)||String(latest?.analysis?.date||'')!==String(report.closeDate))return null;
 return latest.analysis;
}
function riskDescription(a,report){
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
function renderSummary(){
 const card=$('workspaceStockSummary');if(!card)return;
 const report=completeStock(),a=researchStock();
 if(!report){setHidden(card,true);observedCode='';return;}
 setHidden(card,false);
 const code=String(report.code);
 const name=String(report.name||'股票'+code);
 $('workspaceStockName').textContent=name+'（'+code+'）';
 $('workspaceStockDate').textContent='行情基準：'+String(report.closeDate)+'｜收盤 '+(Number.isFinite(Number(report.close))?Number(report.close)+' 元':'待核對');
 $('workspaceStockRisk').textContent=riskDescription(a,report);
 const hasResearch=!!(a&&$('researchStock')?.querySelector('.research-stock-card'));
 $('workspaceFourReportButton').disabled=!hasResearch;
 $('workspaceFourReportButton').title=hasResearch?'直接查看已產生的四策略研究，不重新計算':'研究報告尚未就緒，先查看原始技術報告';
 $('workspaceStockHelp').textContent=hasResearch?'研究報告已備妥。按鈕只開啟既有內容，不會重新查詢或計算。':'已保留原始個股技術報告；四策略研究尚未完成載入。';
 observedCode=code+'|'+report.closeDate;
}
function closeReport(){
 if(!openMode)return;
 const result=$('result');if(result){result.classList.remove('workspace-stock-open','workspace-four-only');result.removeAttribute('aria-modal');result.removeAttribute('role');}
 setHidden($('workspaceReportBackdrop'),true);setHidden($('workspaceReportToolbar'),true);
 doc.body.classList.remove('workspace-report-locked');
 openMode=null;
 if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
 lastFocus=null;
}
function openReport(mode){
 if(currentTab!=='stock')return;
 const r=completeStock();if(!r){renderSummary();return;}
 if(mode==='four'&&!researchStock()){renderSummary();return;}
 const result=$('result');if(!result)return;
 closeReport();lastFocus=doc.activeElement;openMode=mode;
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
 $('workspaceTabIntroduction').textContent=tab==='stock'?'輸入股票代號或名稱，完成查詢後即可查看研究、下載或分享圖片報告。':tab==='market'?'保留原本大盤行情與趨勢研究，僅顯示大盤相關入口。':'一次顯示一套選股工具；候選排行、停止及圖片匯出均保留。';
 if(tab==='stock')renderSummary();
 if(tab==='filters'&&currentFilter==='tower')$('towerGoldPanel')?.scrollIntoView({block:'nearest'});
}
function heading(title){const div=el('div','workspace-v831-header');div.append(el('span','workspace-v831-title',title),el('span','workspace-v831-version','V8.4｜研究工作台'));return div;}
function build(){
 const main=doc.querySelector('main.container'),first=main?.querySelector(':scope > section.panel');
 if(!first||$('workspaceV831'))return;
 first.id='workspaceSearchPanel';
 const nav=el('section');nav.id='workspaceV831';nav.setAttribute('aria-label','石頭少爺功能分頁');
 nav.append(heading('研究工作台'));
 const tabRow=el('div','workspace-v831-tabs');tabRow.setAttribute('role','tablist');tabRow.setAttribute('aria-label','研究分類');
 for(const [key,label] of [['stock','🔎 個股查詢'],['market','📈 大盤研究'],['filters','🚀 策略選股']]){
  const b=el('button','workspace-v831-tab',label);b.type='button';b.dataset.target=key;b.id='workspaceTab'+key;b.setAttribute('role','tab');b.setAttribute('aria-controls','workspaceSearchPanel');b.addEventListener('click',()=>select(key));tabs.push(b);tabRow.append(b);
 }
 tabRow.addEventListener('keydown',event=>{if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;event.preventDefault();const idx=tabs.findIndex(b=>b.dataset.target===currentTab),shift=event.key==='ArrowRight'?1:-1,next=tabs[(idx+tabs.length+shift)%tabs.length];select(next.dataset.target);next.focus();});
 nav.append(tabRow);
 const picker=el('div','workspace-v831-filter-tabs');picker.id='workspaceFilterPicker';picker.setAttribute('role','group');picker.setAttribute('aria-label','六套選股策略');
 for(const f of filters){const b=el('button','workspace-v831-filter',f.label);b.type='button';b.dataset.filter=f.key;b.addEventListener('click',()=>select('filters',f.key));filterButtons.push(b);picker.append(b);}
 nav.append(picker);
 const intro=el('p','workspace-v831-intro');intro.id='workspaceTabIntroduction';nav.append(intro);
 const advanced=el('details','workspace-v831-advanced'),summary=el('summary',null,'進階工具及版本資訊'),details=el('div','workspace-v831-advanced-content');
 const source=doc.querySelector('.header .version-pill');if(source)details.append(el('div',null,source.textContent||''));
 const tower=el('a',null,'前往寶塔線點金術');tower.href='#towerGoldPanel';tower.addEventListener('click',event=>{event.preventDefault();select('filters','tower');$('towerGoldPanel')?.scrollIntoView({block:'start'});});
 details.append(tower);
 const extra=el('button',null,'顯示策略研究附層與量價研究工具');extra.type='button';extra.id='workspaceAdvancedResearchToggle';
 extra.setAttribute('aria-pressed','false');
 extra.addEventListener('click',()=>{const on=doc.body.dataset.workspaceAdvancedV831!=='true';doc.body.dataset.workspaceAdvancedV831=String(on);extra.setAttribute('aria-pressed',String(on));extra.textContent=on?'隱藏策略研究附層與量價研究工具':'顯示策略研究附層與量價研究工具';if(on)select('filters');});
 details.append(extra);
 const theme=el('button',null,'切換日間／夜間模式');theme.type='button';theme.addEventListener('click',()=>$('themeToggleButton')?.click());details.append(theme);
 advanced.append(summary,details);nav.append(advanced);
 main.insertBefore(nav,first);
 const card=el('section');card.id='workspaceStockSummary';card.hidden=true;card.setAttribute('aria-label','個股查詢結果精簡摘要');
 const stockName=el('div','workspace-stock-name');stockName.id='workspaceStockName';
 const date=el('div','workspace-stock-date');date.id='workspaceStockDate';
 const risk=el('div','workspace-stock-risk');risk.id='workspaceStockRisk';risk.setAttribute('role','status');
 const actions=el('div','workspace-stock-actions'),four=el('button',null,'查看四策略研究報告'),full=el('button','workspace-secondary','查看完整個股技術明細');
 four.id='workspaceFourReportButton';full.id='workspaceFullReportButton';
 four.type=full.type='button';four.addEventListener('click',()=>openReport('four'));full.addEventListener('click',()=>openReport('full'));
 actions.append(four,full);const help=el('p','workspace-stock-help');help.id='workspaceStockHelp';
 card.append(stockName,date,risk,actions,help);
 first.after(card);
 const backdrop=el('div');backdrop.id='workspaceReportBackdrop';backdrop.hidden=true;backdrop.addEventListener('click',closeReport);
 const toolbar=el('div');toolbar.id='workspaceReportToolbar';toolbar.hidden=true;const caption=el('span',null,'報告');caption.id='workspaceReportCaption';const close=el('button',null,'✕ 關閉報告');close.id='workspaceReportClose';close.type='button';close.addEventListener('click',closeReport);toolbar.append(caption,close);
 doc.body.append(backdrop,toolbar);
 doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&openMode){e.stopPropagation();closeReport();}});
 const result=$('result');
 if(result){
  new MutationObserver(()=>renderSummary()).observe(result,{attributes:true,attributeFilter:['style'],childList:true});
 }
 const search=$('searchButton'),input=$('stockInput');
 function onSearchStart(){closeReport();setHidden(card,true);observedCode='';select('stock');}
 search?.addEventListener('click',onSearchStart,true);
 input?.addEventListener('keydown',e=>{if(e.key==='Enter')onSearchStart();},true);
 const shortcut=$('towerGoldShortcut');shortcut?.addEventListener('click',e=>{e.preventDefault();select('filters','tower');$('towerGoldPanel')?.scrollIntoView({block:'start'});});
 doc.body.classList.add('workspace-v831');
 select('stock');
 renderSummary();
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',build,{once:true});else build();
root.ShitouWorkspaceV831=Object.freeze({select,openReport,closeReport,renderSummary,getState:()=>({tab:currentTab,filter:currentFilter,modal:openMode,stock:observedCode})});
})(globalThis);
