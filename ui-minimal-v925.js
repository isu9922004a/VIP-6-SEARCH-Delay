/* V9.25: hide exact idle placeholders only; preserve active/failure messages. */
(function(root){
'use strict';
const doc=root.document;if(!doc)return;
const idle=new Map([
 ['momentumProgressText',new Set(['等待開始...'])],
 ['dayTradeProgressText',new Set(['等待開始...'])],
 ['strongStockProgressText',new Set(['等待盤後查詢…','等待盤後查詢...'])],
 ['cost971Date',new Set(['尚未開始掃描'])],
 ['cost97Status',new Set(['選擇開始盤後掃描。','選擇開始盤後掃描'])],
 ['structureMessage',new Set(['等待盤後查詢。','等待盤後查詢…'])]
]);
const installed=new WeakSet();
function watch(node){
 if(!node||installed.has(node))return;
 installed.add(node);
 const update=()=>{
  if(node.id==='restaurantMessage'&&node.textContent.trim()==='等待盤後查詢…可用資料不足時不補猜，也不保證每天有候選。')node.textContent='可用資料不足時不補猜，也不保證每天有候選。';
  if(idle.get(node.id)?.has(node.textContent.trim())===true)node.dataset.v925Idle='true';else node.removeAttribute('data-v925-idle');
 };
 update();new MutationObserver(update).observe(node,{childList:true,characterData:true,subtree:true});
}
function install(){
 if(doc.documentElement.dataset.uiMinimalV925==='ready')return;
 doc.documentElement.dataset.uiMinimalV925='ready';
 const ids=[...idle.keys(),'restaurantMessage'];
 for(const id of ids)watch(doc.getElementById(id));
 new MutationObserver(records=>{for(const record of records)for(const n of record.addedNodes){if(n.nodeType!==1)continue;for(const id of ids){if(n.id===id)watch(n);watch(n.querySelector('#'+id));}}}).observe(doc.body,{childList:true,subtree:true});
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(globalThis);
