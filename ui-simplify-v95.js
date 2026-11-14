/* V9.5: entry points and presentation only. Existing query/scan handlers own all data. */
(function(root){
'use strict';
const doc=root.document;if(!doc)return;
function install(){
 if(doc.documentElement.dataset.uiSimplifyV95)return;
 doc.documentElement.dataset.uiSimplifyV95='ready';
 // Preserve the research workbench, including its default tab and all handlers.
 const scanIds=['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerRun','restaurantRun','structureRun'];
 for(const id of scanIds){
  const button=doc.getElementById(id);if(!button)continue;
  let initiated=false,resetTimer=0;
  const sync=()=>{const busy=initiated&&button.disabled;button.setAttribute('aria-busy',String(busy));const text=busy?'處理中…':'開始掃描';if(button.textContent!==text)button.textContent=text;if(button.disabled&&resetTimer){clearTimeout(resetTimer);resetTimer=0;}
   if(!button.disabled&&initiated&&!resetTimer)resetTimer=setTimeout(()=>{resetTimer=0;if(!button.disabled)initiated=false;},0);};
  button.addEventListener('click',()=>{initiated=true;setTimeout(sync,0);},true);
  new MutationObserver(sync).observe(button,{attributes:true,attributeFilter:['disabled'],childList:true});sync();
 }
 // A scan's progress must remain visible while the explanatory fold is closed.
 const progress=doc.getElementById('strongStockProgressText');
 const strong=doc.getElementById('strongStockShortcut');
 if(progress&&strong)strong.append(progress);
 // Only these existing candidate controls start a stock query. Keep the original
 // handlers; select the visible stock pane before they change the input/query.
 for(const id of ['towerGoldPanel','restaurantResult']){
  const host=doc.getElementById(id);if(!host)continue;
  host.addEventListener('click',event=>{
   const button=event.target.closest('button');
   if(!button||!host.contains(button)||button.disabled)return;
   if(!button.hasAttribute('data-tower-code')&&!button.matches('.newbie-copy-btn'))return;
   root.ShitouWorkspaceV831?.select('stock');
   root.ShitouWorkspaceV831?.closeReport();
  },true);
 }
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(globalThis);
