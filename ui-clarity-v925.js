/* V9.25 presentation only. Original nodes, handlers, data and formulas stay intact. */
(function(){
'use strict';
const doc=document,by=id=>doc.getElementById(id);
const idle=new Map([
 ['momentumProgressText',new Set(['等待開始...','等待開始…'])],
 ['dayTradeProgressText',new Set(['等待開始...','等待開始…'])],
 ['strongStockProgressText',new Set(['等待盤後查詢…','等待盤後查詢...','等待盤後查詢。'])],
 ['cost971Date',new Set(['尚未開始掃描'])],
 ['cost97Status',new Set(['選擇開始盤後掃描。','選擇開始盤後掃描'])],
 ['structureMessage',new Set(['等待盤後查詢。','等待盤後查詢…','等待盤後查詢...'])]
]);
function install(){
 if(doc.documentElement.dataset.uiClarityV925)return;
 const tools=doc.querySelector('#workspaceSearchPanel > .quick-actions');if(!tools)return;
 const exports=doc.createElement('div');exports.className='v925-export-actions';
 exports.setAttribute('role','group');exports.setAttribute('aria-label','圖片報告匯出');
 tools.setAttribute('role','group');tools.setAttribute('aria-label','查詢工具');
 for(const id of ['stockSimpleAnalysisButton','stockSimpleAnalysisWatermarkButton']){
  const button=by(id);if(button)exports.append(button);
 }
 if(exports.childElementCount)tools.after(exports);
 const input=by('stockInput');if(input&&!input.hasAttribute('aria-label'))input.setAttribute('aria-label','股票代號或中文名稱');
 for(const [id,values] of idle){
  const node=by(id);if(!node)continue;
  const sync=()=>{if(values.has(node.textContent.trim()))node.dataset.v925Idle='true';else delete node.dataset.v925Idle;};
  sync();new MutationObserver(sync).observe(node,{childList:true,subtree:true,characterData:true});
 }
 // Preserve the genuine warning, removing only the redundant idle prefix.
 const restaurant=by('restaurantMessage');
 if(restaurant&&restaurant.textContent.trim()==='等待盤後查詢…可用資料不足時不補猜，也不保證每天有候選。')restaurant.textContent='可用資料不足時不補猜，也不保證每天有候選。';
 doc.documentElement.dataset.uiClarityV925='ready';
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
