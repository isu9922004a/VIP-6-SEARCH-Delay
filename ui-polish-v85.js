/* Optional UI layer. No analysis functions, report generators or original handlers are replaced. */
(function(){
'use strict';
try{
 const doc=document,safe=fn=>function(...args){try{return fn.apply(this,args);}catch(_){/* UI enhancement must never interrupt the application. */}};
 const query=(selector,scope=doc)=>scope.querySelector(selector),all=(selector,scope=doc)=>Array.from(scope.querySelectorAll(selector));
 const entries=[
  {label:'個股',selector:'.search-row',tab:'stock',fallback:'upSearch'},
  {label:'大盤',selector:'.market-shortcut',tab:'market',fallback:'upMarket'},
  {label:'主升',selector:'.momentum-shortcut',tab:'filters',filter:'momentum',fallback:'upMomentum'},
  {label:'當沖',selector:'.daytrade-shortcut',tab:'filters',filter:'daytrade',fallback:'upDaytrade'},
  {label:'飆股',selector:'#strongStockShortcut',tab:'filters',filter:'strong'},
  {label:'寶塔線',selector:'#towerGoldPanel',tab:'filters',filter:'tower'},
  {label:'餐廳',selector:'#restaurantPanel',tab:'filters',filter:'restaurant'},
  {label:'結構',selector:'#structurePanel',tab:'filters',filter:'structure'}
 ];
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
 let nav=null,frame=0,scrollFrame=0;
 function targetFor(entry){const node=query(entry.selector);return entry.tab==='stock'?node?.closest('.panel'):node;}
 function setActive(entry){
  for(const item of entries){if(!item.link)continue;const active=item===entry;item.link.classList.toggle('is-active',active);
   if(active)item.link.setAttribute('aria-current','location');else item.link.removeAttribute('aria-current');}
 }
 function highlight(){
  // The existing workspace deliberately hides other sections. Respect its UI state.
  const state=globalThis.ShitouWorkspaceV831?.getState?.();
  if(state){setActive(entries.find(e=>e.tab===state.tab&&(e.tab!=='filters'||e.filter===state.filter))||entries[0]);return;}
  if(scrollY<80){setActive(entries[0]);return;}
  let active=entries[0];for(const entry of entries){const node=targetFor(entry);if(node?.getClientRects().length&&node.getBoundingClientRect().top<=140)active=entry;}setActive(active);
 }
 const scheduleHighlight=safe(()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(safe(()=>{scrollFrame=0;highlight();}));});
 function buildNav(){
  const header=query('.header');if(!header)return;
  if(!nav){nav=doc.createElement('nav');nav.className='up-nav';nav.setAttribute('aria-label','研究與六套策略快速導覽');
   const links=doc.createElement('div');links.className='up-nav-links';nav.append(links);header.after(nav);}
  for(const entry of entries){const target=targetFor(entry);if(!target)continue;
   if(!target.id&&entry.fallback)target.id=entry.fallback;
   if(!target.id)continue;target.classList.add('up-anchor');
   if(!entry.link){const a=doc.createElement('a');a.textContent=entry.label;a.href='#'+target.id;
    a.addEventListener('click',safe(event=>{event.preventDefault();
     // Reuse the existing presentation API; scanning/querying is never started here.
     globalThis.ShitouWorkspaceV831?.select?.(entry.tab,entry.filter);
     requestAnimationFrame(safe(()=>{const node=targetFor(entry);node?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});setActive(entry);}));
    }));entry.link=a;
   }else entry.link.href='#'+target.id;
  }
  // Preserve the intended order even if an externally created panel appears late.
  const host=query('.up-nav-links',nav);for(const entry of entries)if(entry.link)host.append(entry.link);
  highlight();
 }
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
 function refresh(){buildNav();enhance();watchResults();}
 function init(){
  if(query('.up-nav'))return;refresh();
  addEventListener('scroll',scheduleHighlight,{passive:true});addEventListener('resize',scheduleHighlight,{passive:true});
  new MutationObserver(scheduleHighlight).observe(doc.body,{attributes:true,attributeFilter:['data-workspace-v831','data-workspace-filter-v831']});
  const late=safe(()=>{setTimeout(safe(refresh),800);setTimeout(safe(refresh),2500);});
  if(doc.readyState==='complete')late();else addEventListener('load',late,{once:true});
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',safe(init),{once:true});else safe(init)();
}catch(_){/* Optional presentation layer: retain the original working interface on failure. */}
})();
