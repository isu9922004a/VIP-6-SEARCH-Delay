(function(root){'use strict';
const C=root.ShitouRestaurantCore,S=root.ShitouRestaurantScanner,D=root.ShitouSelectionDataV2,F=root.ShitouStrongStockFilterV47;
if(!C||!S||!D||!F)throw Error('第五濾網共用模組未載入');
let running=false,stopped=false,last=null,requests=0;const controllers=new Set(),reportCache=new Map();
const by=id=>document.getElementById('restaurant'+id),el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
function note(text){const n=by('Message');if(n)n.textContent=text;}
function finishUI(){for(const key of ['Copy','Text','JSON','Image','AllImages']){const x=by(key);if(x)x.disabled=!last||(key==='Image'||key==='AllImages')&&!last.candidates.length;}}
function progress(done,total){const bar=by('ProgressBar'),ratio=total>0?Math.min(100,Math.max(0,done/total*100)):0;if(bar){bar.style.width=ratio+'%';bar.parentElement.setAttribute('aria-valuenow',String(Math.round(ratio)));}}
function loadNames(){
 let embedded={},official={};
 try{embedded=(typeof getEmbeddedStockDirectory==='function'?getEmbeddedStockDirectory():root.getEmbeddedStockDirectory?.())?.byCode||{};}catch(_){}
 try{official=(typeof readStockDirectoryCache==='function'?readStockDirectoryCache():root.readStockDirectoryCache?.())?.byCode||{};}catch(_){}
 const directory={...embedded};for(const [code,record] of Object.entries(official)){const name=String(record?.name||'').replace(/[-－]?(?:KY|DR)(?:\*)?$/i,'');if(/[\u3400-\u9fff]/.test(name)&&!/[\p{Script=Latin}]/u.test(name))directory[code]=record;}
 C.setNameDirectory(directory);
}
function render(scan){last=scan;const host=by('Result');if(!host)return;host.replaceChildren();by('ReportPanel').hidden=false;
 const title=el('div','⑤ 餐廳擠不進去｜候選觀察排行');title.className='section-title';host.appendChild(title);
 const meta=el('div',`${scan.date}｜處理 ${scan.attempted}/${scan.planned}｜待處理 ${scan.pending}｜未深掃 ${scan.deferred}｜${scan.complete?'本輪處理完成':'未完整完成'}｜${scan.fullMarketCertified?'完整市場資料認證':'非全市場完整排名'}`);meta.className='meta';host.appendChild(meta);
 const grid=el('div');grid.className='momentum-summary-grid';
 for(const [label,value] of [['均衡候選',scan.counts.CANDIDATE||0],['附警訊觀察',scan.counts.WATCH||0],['高風險旁列',scan.riskCandidates.length],['資料不足',scan.dataUnavailable],['服務失敗',scan.failed]]){const card=el('div'),k=el('div',label),v=el('div',String(value));card.className='momentum-summary-card';k.className='k';v.className='v';card.append(k,v);grid.appendChild(card);}host.appendChild(grid);
 const reminder=el('div',`原圖全部條件已核對符合 ${scan.sourceVerifiedMatches} 檔。缺主力或JMA資料不算原圖策略通過。候選先看風險與符合度；排序不是上漲機率。`);reminder.className='strong-stock-reminder';host.appendChild(reminder);
 const append=(rows,title)=>{host.appendChild(el('h3',title));if(!rows.length){host.appendChild(el('p','本輪沒有此類股票；不補出名單。'));return;}rows.forEach((c,i)=>{const detail=el('details'),summary=el('summary',`${c.eligible?'觀察序 #'+(i+1):'風險旁列'} 🏆${C.displayName(c.code,c)}（${c.code}）｜${c.label}｜${c.event?.kind==='OFFICIAL'?'官方漲停':'推估漲停'}`),p=el('p',C.lines(c).join('\n'));detail.className='strong-stock-row';p.style.whiteSpace='pre-wrap';detail.append(summary,p);const b=el('button','查詢此股');b.className='copy-btn newbie-copy-btn';b.type='button';b.onclick=()=>{const input=document.getElementById('stockInput');if(input){input.value=c.code;input.dispatchEvent(new Event('input',{bubbles:true}));if(typeof root.analyzeStock==='function')root.analyzeStock();}};detail.appendChild(b);host.appendChild(detail);});};
 append(scan.candidates,'候選與附警訊觀察｜依風險與符合度排序');append(scan.riskCandidates,'高風險旁列｜不列入候選');
 if(!scan.candidates.length)host.appendChild(el('p','可選全部有效股票或近5根窗口重新查詢；不會自動放寬，也不保證一定有候選。請先看資料不足與未處理筆數。'));
 const detail=el('details'),summary=el('summary','完整逐檔紀錄、未入選與失敗原因'),pre=el('pre',scan.text);detail.append(summary,pre);host.appendChild(detail);
 const run=root.ShitouIndicatorShadow?.capture('RESTAURANT',scan);if(run)root.ShitouIndicatorShadow.mount(run,'restaurantResult');progress(scan.attempted,scan.planned);finishUI();
}
async function request(part,date,attempt=1){
 const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),25000);requests++;
 try{const base=typeof MARKET_API_BASE_URL!=='undefined'?MARKET_API_BASE_URL:'https://shitou-taiwanmarket-api.d318426.workers.dev',codes=part.map(i=>i.code).join(','),markets=part.map(i=>String(i.q.market).toUpperCase()).join(',');
  const response=await fetch(`${base}/?market=DEEP_SCAN&profile=DAILY_ONLY&codes=${encodeURIComponent(codes)}&markets=${encodeURIComponent(markets)}&_restaurant_refresh=${Date.now()}_${attempt}`,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw Error('Worker HTTP '+response.status);const payload=await response.json();if(payload.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('第五策略深掃格式錯誤');
  const aligned=await root.ShitouSelectionDataV2.harmonize(part,payload,'DAILY_ONLY');
  for(const r of aligned.results||[]){if(!r.ok||!r.data)continue;const code=String(r.code||r.data.stock),p=D.get(code);if(p&&!p.error)reportCache.set(code,{key:p.key,fingerprint:p.fingerprint,report:r.data});}
  return aligned;
 }finally{clearTimeout(timer);controllers.delete(controller);}
}
async function remote(part,date){
 if(stopped)throw Error('使用者停止');let error;
 for(let attempt=1;attempt<=2&&!stopped;attempt++)try{const payload=await request(part,date,attempt);if(attempt===1&&payload.results.some(r=>!r.ok&&/日期|不同日|快照|過期/.test(String(r.error||''))))throw Error('資料日期仍未一致，重新取得一次');return payload;}catch(e){error=e;if(/HTTP (?:400|401|403|404|405|410|422)\b|格式錯誤/.test(String(e.message||e)))break;}
 if(part.length>1&&!stopped&&!/HTTP (?:400|401|403|404|405|410|422)\b|格式錯誤/.test(String(error?.message||error))){const results=[];for(let i=0;i<part.length&&!stopped;i+=2){const small=part.slice(i,i+2);try{const p=await request(small,date,3);results.push(...p.results);}catch(e){results.push(...small.map(x=>({code:x.code,ok:false,error:String(e.message||e)})));}}return {type:'MOMENTUM_DEEP_SCAN',results};}
 throw error||Error('使用者停止');
}
async function fetchBatch(part,date){
 const results=[],need=[];for(const item of part){const p=D.get(item.code),cached=reportCache.get(item.code);if(p&&!p.error&&cached?.key===p.key&&cached.fingerprint===p.fingerprint)try{results.push({code:item.code,ok:true,data:D.apply(cached.report,item.code)});continue;}catch(_){}need.push(item);}
 if(need.length){const payload=await remote(need,date);results.push(...payload.results);}return {type:'MOMENTUM_DEEP_SCAN',results};
}
function stop(){stopped=true;controllers.forEach(c=>c.abort());note('已要求停止；保留已完成結果，未處理股票不視為淘汰。');}
async function run(){
 if(running)return;const originalButtons=['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerRun'].map(id=>document.getElementById(id)).filter(Boolean);
 if(originalButtons.some(b=>b.disabled)){note('其他選股工作正在執行或尚未就緒，請完成後再啟動第五濾網。');return;}
 running=true;stopped=false;last=null;requests=0;loadNames();finishUI();progress(0,1);by('Error').textContent='';by('ReportPanel').hidden=true;const prior=originalButtons.map(b=>b.disabled);originalButtons.forEach(b=>b.disabled=true);by('Run').disabled=true;by('Stop').disabled=false;by('Window').disabled=true;by('Limit').disabled=true;by('Result').replaceChildren();
 try{note('核對最近完成交易日、產業與官方排除名單…');const bundle=await root.loadDayTradeMarketBundleV377736();if(stopped)return;
  const market=F.validateMarket(bundle.meta,bundle.snapshotRows,new Date());if(!market.ok)throw Error(market.reason);D.bind(bundle);
  const plan=S.pool(bundle,by('Limit').value),eventWindow=Number(by('Window').value);if(!plan.items.length)throw Error('共用排除與快照檢查後沒有可分析股票；請檢查排除名單及量價資料');
  note(`第五策略輕量日K掃描 0/${plan.items.length}｜近${eventWindow}根訊號｜不符合原圖不等於資料失敗`);
  const result=await S.scan({pool:plan,meta:bundle.meta,eventWindow,requestedMode:by('Limit').value,fetchBatch:items=>fetchBatch(items,market.date),shouldStop:()=>stopped,batchSize:4,onProgress:s=>{progress(s.attempted,s.planned);note(`處理 ${s.attempted}/${s.planned}｜候選 ${s.candidates.length}｜高風險 ${s.riskCandidates.length}｜服務請求 ${requests}`);}});
  render(result);note(result.breaker||`${result.stopped?'已停止':'本輪完成'}｜候選 ${result.candidates.length}｜原圖完整核對符合 ${result.sourceVerifiedMatches}｜資料缺口明示；未驗證績效。`);
 }catch(e){const message='第五濾網未完成：'+String(e.message||e);by('Error').textContent=message;note(message);}finally{running=false;controllers.forEach(c=>c.abort());controllers.clear();originalButtons.forEach((b,i)=>b.disabled=prior[i]);by('Run').disabled=false;by('Stop').disabled=true;by('Window').disabled=false;by('Limit').disabled=false;finishUI();}
}
function content(){if(!last)throw Error('請先完成第五濾網查詢');return last;}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function text(){const s=content();return root.ShitouIndicatorShadow?.appendText(s.text,'RESTAURANT',s)||s.text;}
async function copy(){try{await navigator.clipboard.writeText(text());note('已複製完整第五濾網文字；包含原圖未驗證項目。');}catch(e){note('複製未完成，請改下載文字檔：'+String(e.message||e));}}
function install(){
 if(document.getElementById('restaurantPanel'))return;
 loadNames();
 const panel=el('section');panel.id='restaurantPanel';panel.className='panel restaurant-panel';panel.innerHTML=`
 <div class="strong-stock-shortcut restaurant-controls">
  <div class="section-title">🍽️ 第五套｜餐廳擠不進去濾網（獨立策略）</div>
  <div class="section-subtitle">近期漲停後續強／量縮整理｜均衡量價觀察版</div>
  <div class="strong-stock-reminder">📌 明顯量價失效與複合過熱列高風險；單一乖離、量增、CMF偏弱列附警訊。成交值前100作排序參考，不硬性排除。</div>
  <div class="meta">資料採完成日K。原圖主力與JMA未提供時明示未驗證；本版趨勢採SMA20，推估漲停不等於官方確認。</div>
  <div class="rule restaurant-settings"><label for="restaurantWindow">訊號觀察窗口：</label><select id="restaurantWindow"><option value="3">近3根（預設均衡）</option><option value="1">近1根（較接近圖片）</option><option value="5">近5根（延長觀察）</option></select><div class="meta">只觀察完成日K；不會為了湊名單自動放寬窗口。</div></div>
  <div class="rule restaurant-settings"><label for="restaurantLimit">完整日K深入分析範圍：</label><select id="restaurantLimit"><option value="300">優先300檔</option><option value="100">優先100檔</option><option value="all">全部有效股票</option></select><div class="meta">優先依當日動能與成交值安排掃描；未掃描股票不視為淘汰。</div></div>
  <div class="strong-stock-actions"><button class="btn" type="button" id="restaurantRun">🍽️ 查詢餐廳擠不進去濾網</button><button class="momentum-stop-btn show" type="button" id="restaurantStop" disabled>■ 停止</button></div>
  <div class="strong-stock-progress" role="progressbar" aria-label="第五濾網掃描進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="restaurantProgressBar"></div></div>
  <div id="restaurantMessage" class="meta" role="status" aria-live="polite">等待盤後查詢…可用資料不足時不補猜，也不保證每天有候選。</div>
  <div id="restaurantError" class="error" role="alert"></div>
 </div>
 <section id="restaurantReportPanel" class="restaurant-report" hidden>
  <div id="restaurantResult"></div>
  <div class="strong-stock-image-actions"><button class="copy-btn" type="button" id="restaurantCopy" disabled>📋 一鍵複製全部文字報告</button><button class="copy-btn" type="button" id="restaurantText" disabled>📄 下載完整 TXT</button><button class="copy-btn" type="button" id="restaurantJSON" disabled>📄 下載 JSON 紀錄</button><button class="copy-btn image-btn" type="button" id="restaurantImage" disabled>🖼️ 前8強重點總覽（單張）</button><button class="copy-btn image-btn" type="button" id="restaurantAllImages" disabled>🖼️ 全部候選完整圖片報告（多頁ZIP）</button></div>
 </section>`;
 const tower=document.getElementById('towerGoldPanel'),footer=document.querySelector('footer');if(tower)tower.insertAdjacentElement('afterend',panel);else if(footer)footer.before(panel);else document.body.appendChild(panel);
 by('Run').onclick=run;by('Stop').onclick=stop;by('Copy').onclick=copy;
 by('Text').onclick=()=>{try{const s=content();download(new Blob([text()],{type:'text/plain;charset=utf-8'}),'餐廳擠不進去_'+s.date+'_'+root.ShitouReleaseV50.code+'.txt');}catch(e){note(e.message);}};
 by('JSON').onclick=()=>{try{const s=content();download(new Blob([JSON.stringify({release:root.ShitouReleaseV50.code,exportedAt:new Date().toISOString(),scan:s,rsiObservations:root.ShitouIndicatorShadow?.capture('RESTAURANT',s)?.rows||[]},null,2)],{type:'application/json'}),'餐廳擠不進去_'+s.date+'.json');}catch(e){note(e.message);}};
 for(const [key,all] of [['Image',false],['AllImages',true]])by(key).onclick=()=>{try{root.ShitouRestaurantReport.preview(content(),all).catch(e=>note('圖片未完成：'+e.message));}catch(e){note(e.message);}};
 const nav=document.getElementById('towerGoldShortcut')?.parentElement;if(nav){const a=el('a','⑤ 餐廳擠不進去');a.href='#restaurantPanel';a.className='restaurant-shortcut';nav.appendChild(a);}
 const style=el('style');style.textContent=`
 .restaurant-panel{scroll-margin-top:20px;box-sizing:border-box}
 .restaurant-controls{margin-top:0}
 .restaurant-settings{margin-top:12px}
 .restaurant-settings label{display:block;margin-bottom:7px}
 .restaurant-settings select{padding:9px;max-width:100%;border:1px solid var(--line);border-radius:8px;font-size:16px;background:var(--card);color:var(--text);min-height:44px}
 .restaurant-panel .strong-stock-reminder{margin:12px 0}
 .restaurant-panel .strong-stock-progress{margin-bottom:10px}
 .restaurant-report{border-top:5px solid #24628a;margin-top:20px;padding-top:18px}
 .restaurant-panel details{margin:12px 0;border:1px solid var(--line);border-left:5px solid #24628a;border-radius:8px;padding:13px;overflow-wrap:anywhere;background:var(--card);color:var(--text)}
 .restaurant-panel summary{cursor:pointer;font-weight:800;line-height:1.8}
 .restaurant-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;color:var(--text)}
 .restaurant-panel .strong-stock-row .copy-btn{min-width:0}
 body.dark-mode .restaurant-panel .strong-stock-reminder{background:#352c17;border-color:#7a6831;color:#f4e8bc}
 .restaurant-shortcut{display:inline-block;margin:8px;padding:12px;background:#fff4dc;color:#6b4704;border-radius:8px;text-decoration:none;font-weight:800}
 @media(max-width:600px){.restaurant-panel .strong-stock-actions .btn{flex:1;min-width:0}.restaurant-panel .strong-stock-image-actions{flex-direction:column}.restaurant-panel .copy-btn{min-width:0;width:100%;box-sizing:border-box}}
 `;document.head.appendChild(style);
}
root.ShitouRestaurantUI=Object.freeze({run,stop,render,fetchBatch,request,text,getLast:()=>last,isRunning:()=>running,install});install();
})(globalThis);
