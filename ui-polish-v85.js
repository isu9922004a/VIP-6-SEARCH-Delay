/* Optional UI layer. No analysis functions, report generators or original handlers are replaced. */
(function(){
'use strict';
try{
 const doc=document,safe=fn=>function(...args){try{return fn.apply(this,args);}catch(_){/* UI enhancement must never interrupt the application. */}};
 const query=(selector,scope=doc)=>scope.querySelector(selector),all=(selector,scope=doc)=>Array.from(scope.querySelectorAll(selector));
 const noteStates=new WeakMap(),exportStates=new WeakMap(),versionNodes=new WeakSet(),observedRoots=new WeakSet();
 const exportSelector='.momentum-image-actions,.daytrade-image-actions,.strong-stock-image-actions';
 const valueSelector='.momentum-summary-card .v,.daytrade-summary-card .v,.card .value,.fib-point .point-price,.market-level .price';
 const versionSelector='.version-pill,.momentum-hero .meta,.daytrade-hero .meta,.market-hero .meta';
 const noteSelector=[
  '.market-shortcut .hint','.momentum-shortcut .section-subtitle','.momentum-shortcut .hint',
  '.daytrade-shortcut .section-subtitle','.daytrade-shortcut .hint','.strong-stock-shortcut .section-subtitle',
  '.strong-stock-shortcut .hint','.momentum-shortcut .momentum-reminder','.daytrade-shortcut .momentum-reminder',
  '.strong-stock-reminder','.daytrade-query-time-note','.momentum-shortcut .rule .meta',
  '.daytrade-shortcut .rule .meta','.strong-stock-shortcut .rule .meta','.strong-stock-shortcut > .meta',
  '.quick-actions + .hint','.momentum-result .momentum-reminder'
 ].join(',');
 let frame=0;
 function decorateNote(node){
  if(noteStates.has(node)||node.textContent.trim().length<70||query('button,a,input,select,textarea,summary,[role="button"]',node))return;
  const button=doc.createElement('button');button.type='button';button.className='up-note-toggle';button.textContent='展開說明 ▾';button.setAttribute('aria-expanded','false');
  const toggle=safe(()=>{const open=!node.classList.contains('is-open');node.classList.toggle('is-open',open);node.setAttribute('aria-expanded',String(open));button.setAttribute('aria-expanded',String(open));button.textContent=open?'收合說明 ▴':'展開說明 ▾';});
  button.addEventListener('click',toggle);node.addEventListener('click',safe(event=>{if(!getSelection()?.toString()&&!event.target.closest('a,button,input'))toggle();}));
  node.after(button);node.classList.add('up-note');node.setAttribute('aria-expanded','false');noteStates.set(node,{button});
 }
 function decorateExports(container){
  const buttons=all(':scope > button:not(.up-more-btn)',container);if(buttons.length<5)return;
  let state=exportStates.get(container);
  if(!state){const more=doc.createElement('button');more.type='button';more.className='up-more-btn';more.setAttribute('aria-expanded','false');
   more.addEventListener('click',safe(()=>{const open=!container.classList.contains('is-open');container.classList.toggle('is-open',open);more.setAttribute('aria-expanded',String(open));updateMore(container,more);}));
   container.append(more);state={more};exportStates.set(container,state);}
  for(const button of buttons){const text=button.textContent||'';
   const secondary=/分段複製|浮水印|防盜|全部(選股|候選)|ZIP|複製前8檔|複製.*圖片/i.test(text);
   button.classList.toggle('up-secondary',secondary);
  }
  updateMore(container,state.more);container.classList.add('up-export');
 }
 function updateMore(container,button){
  const count=all(':scope > .up-secondary',container).length,label=(container.classList.contains('is-open')?'收合匯出選項':'更多匯出選項')+'（'+count+'）'+(container.classList.contains('is-open')?' ▴':' ▾');
  if(button.textContent!==label)button.textContent=label;button.hidden=count===0;
 }
 function compactVersion(node){
  let changed=false;const original=node.textContent,walker=doc.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text;
  while((text=walker.nextNode())){const next=text.nodeValue.replace(/｜R[0-9A-Za-z.\-]{20,}(?=｜)/g,'');if(next!==text.nodeValue){text.nodeValue=next;changed=true;}}
  if(changed)node.title=original;
 }
 function watchVersions(){
  for(const node of all(versionSelector)){compactVersion(node);if(versionNodes.has(node))continue;versionNodes.add(node);
   new MutationObserver(safe(()=>compactVersion(node))).observe(node,{childList:true,subtree:true,characterData:true});}
 }
 function refreshValues(scope){for(const node of all(valueSelector,scope)){const text=node.textContent.trim(),empty=!text||text==='-'||text==='—';if(node.classList.contains('is-empty')!==empty)node.classList.toggle('is-empty',empty);}}
 function enhance(scope=doc){
  all(noteSelector,scope).forEach(safe(decorateNote));all(exportSelector,scope).forEach(safe(decorateExports));refreshValues(scope);watchVersions();
 }
 const pending=new Set();
 const schedule=safe(scope=>{pending.add(scope);if(frame)return;frame=requestAnimationFrame(safe(()=>{frame=0;for(const host of pending)if(host.isConnected)enhance(host);pending.clear();}));});
 function watchResults(){
  for(const selector of ['#momentumResult','#dayTradeResult','#marketResult','#result','#strongStockResult','#towerGoldPanel','#restaurantPanel','#structurePanel']){
   const host=query(selector);if(!host||observedRoots.has(host))continue;observedRoots.add(host);
   // Observe content changes only. Our own class/ARIA updates cannot retrigger this observer.
   new MutationObserver(safe(records=>{if(records.some(r=>r.type==='characterData'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1||n.nodeType===3)))schedule(host);})).observe(host,{childList:true,subtree:true,characterData:true});
  }
 }
 function refresh(){enhance();watchResults();}
 function init(){
  refresh();
  const late=safe(()=>{setTimeout(safe(refresh),800);setTimeout(safe(refresh),2500);});
  if(doc.readyState==='complete')late();else addEventListener('load',late,{once:true});
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',safe(init),{once:true});else safe(init)();
}catch(_){/* Optional presentation layer: retain the original working interface on failure. */}
})();
