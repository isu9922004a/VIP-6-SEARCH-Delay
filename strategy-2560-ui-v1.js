(function(root){'use strict';
const TRANSPORT_VERSION='RESTAURANT_TRANSPORT.2',REQUEST_TIMEOUT_MS=95000,BATCH_BUDGET_MS=150000;
// Retry transport failures per ticker, retaining verified peers and stopping on data errors.
async function recoverBatch(items,{request,classify,shouldStop=()=>false,pause=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now()}){
 const records=new Map(),deadline=now()+BATCH_BUDGET_MS;let pending=items.slice();
 const cancelled=()=>{if(shouldStop())throw Object.assign(Error('使用者停止'),{name:'AbortError'});};
 const retryable=r=>r?.retryable!==false&&classify(r)==='TRANSIENT_SERVICE_ERROR'&&!/SERVICE_BINDING|HTTP (?:400|401|403|404|405|410|422)\b|格式錯誤/.test(String(r?.error||''));
 for(let round=0;round<3&&pending.length;round++){
  cancelled();if(round)await pause(350*round);cancelled();const next=[],size=round===0?items.length:round===1?2:1;
  for(let at=0;at<pending.length;at+=size){cancelled();const part=pending.slice(at,at+size),remaining=deadline-now();
   if(remaining<=0){for(const item of pending.slice(at))records.set(String(item.code),{code:String(item.code),ok:false,failureCode:'TRANSIENT_SERVICE_ERROR',retryable:false,error:'本批服務重試時間已用完；未完成股票不視為策略淘汰'});break;}
   let payload,problem;
   try{payload=await request(part,round+1,Math.min(REQUEST_TIMEOUT_MS,remaining));if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('第五策略深掃格式錯誤');}catch(e){cancelled();problem=e;}
   cancelled();
   for(const item of part){const code=String(item.code),hits=(payload?.results||[]).filter(x=>String(x.code||x.data?.stock||x.data?.code||'')===code);
    const failure=problem?{code,ok:false,error:problem.name==='AbortError'?'行情服務逾時，尚未完成':String(problem.message||problem)}:hits.length!==1?{code,ok:false,failureCode:'DATA_INVALID',retryable:false,error:'深掃回傳缺失或重複，禁止當成有效股票'}:hits[0];
    const value={...failure,code};records.set(code,value);
    if(!value.ok&&round<2&&retryable(value))next.push(item);
   }
  }
  pending=next;
 }
 return {type:'MOMENTUM_DEEP_SCAN',transportVersion:TRANSPORT_VERSION,results:items.map(i=>records.get(String(i.code))||{code:String(i.code),ok:false,error:'服務未完成',retryable:false})};
}
if(typeof module==='object'&&module.exports){module.exports={recoverBatch,REQUEST_TIMEOUT_MS,BATCH_BUDGET_MS,TRANSPORT_VERSION};return;}
if(root.ShitouFifthStrategyConfig?.active!=='2560')return;
const C=root.ShitouStrategy2560,S=root.ShitouStrategy2560Scanner,D=root.ShitouSelectionDataV2,F=root.ShitouStrongStockFilterV47;
if(!C||!S||!D||!F)throw Error('第五濾網共用模組未載入');
let running=false,stopped=false,last=null,requests=0;const controllers=new Set(),reportCache=new Map();
const by=id=>document.getElementById('restaurant'+id),el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
function note(text){const n=by('Message');if(n)n.textContent=text;}
function finishUI(){for(const key of ['Copy','Text','JSON','Image','AllImages','MarkedImage','AllMarkedImages']){const x=by(key);if(x)x.disabled=!last||(['Image','AllImages','MarkedImage','AllMarkedImages'].includes(key))&&!last.candidates.length;}}
function progress(done,total){const bar=by('ProgressBar'),ratio=total>0?Math.min(100,Math.max(0,done/total*100)):0;if(bar){bar.style.width=ratio+'%';bar.parentElement.setAttribute('aria-valuenow',String(Math.round(ratio)));}}
function loadNames(){
 let embedded={},official={};
 try{embedded=(typeof getEmbeddedStockDirectory==='function'?getEmbeddedStockDirectory():root.getEmbeddedStockDirectory?.())?.byCode||{};}catch(_){}
 try{official=(typeof readStockDirectoryCache==='function'?readStockDirectoryCache():root.readStockDirectoryCache?.())?.byCode||{};}catch(_){}
 const directory={...embedded};for(const [code,record] of Object.entries(official)){const name=String(record?.name||'').replace(/[-－]?(?:KY|DR)(?:\*)?$/i,'');if(/[\u3400-\u9fff]/.test(name)&&!/[\p{Script=Latin}]/u.test(name))directory[code]=record;}
 C.setNameDirectory(directory);
}
function render(scan){S.assertSnapshot(scan);last=scan;const host=by('Result');if(!host)return;host.replaceChildren();by('ReportPanel').hidden=false;
 const title=el('div','⑤ 2560戰法｜近3個完成交易日突破續強');title.className='section-title';host.appendChild(title);
 const meta=el('div',`${scan.date}｜處理 ${scan.attempted}/${scan.planned}｜待處理 ${scan.pending}｜未深掃 ${scan.deferred}｜${scan.complete?'本輪處理完成':'未完整完成'}｜${scan.fullMarketCertified?'完整市場資料認證':'非全市場完整排名'}`);meta.className='meta';host.appendChild(meta);
 const grid=el('div');grid.className='momentum-summary-grid';
 for(const [label,value] of [['四條全部通過',scan.candidates.length],['有效指標股票',scan.diagnostics?.validIndicators||0],['條件未符合',scan.notMatched||0],['行情不足',scan.dataUnavailable],['資料異常',scan.failed],['其中服務失敗',scan.serviceFailures||0]]){const card=el('div'),k=el('div',label),v=el('div',String(value));card.className='momentum-summary-card';k.className='k';v.className='v';card.append(k,v);grid.appendChild(card);}host.appendChild(grid);
 const reminder=el('div',`近3個完成交易日曾突破MA25、最新仍站穩MA25、VMA5>VMA60、MA5>MA40，四條全部符合才入選。入選 ${scan.sourceVerifiedMatches} 檔。資料不完整不宣稱全市場0檔；風險提醒不改入選條件。`);reminder.className='strong-stock-reminder';host.appendChild(reminder);
 const d=scan.diagnostics||{},ind=d.independent||{},age=d.breakoutAge||{},diagnostic=el('section');diagnostic.className='strong-stock-diagnostic';
 diagnostic.appendChild(el('h3','2560零候選診斷｜各條獨立通過數'));
 for(const [label,value] of [['市場快照總數',d.marketTotal??scan.universe],['排除金融／ETF等',d.excluded??scan.excluded.length],['可掃描普通股',d.eligiblePool??scan.eligiblePool],['成功計算全部指標',d.validIndicators??0],['近3日曾突破MA25',ind['9041']??0],['最新收盤高於MA25',ind.MA25_HOLD??0],['VMA5大於VMA60',ind['9012']??0],['MA5大於MA40',ind['533']??0],['四條同時通過',d.allPassed??0],['突破當日／前1日／前2日',`${age['0']||0}／${age['1']||0}／${age['2']||0}`],['資料不足',d.insufficient??0],['資料異常',d.dataErrors??0],['服務失敗（含於異常）',d.serviceFailures??0],['未處理／未深掃',`${d.pending||0}／${d.deferred||0}`],['完整市場確認',scan.fullMarketCertified?'已認證':'未完成／非全市場']]){const line=el('div');line.className='strong-stock-diagnostic-line';line.append(el('span',label),el('strong',String(value)));diagnostic.appendChild(line);}
 diagnostic.appendChild(el('p','獨立通過數不代表同時通過；資料不足和API失敗不算選股規則淘汰。'));host.appendChild(diagnostic);
 const append=(rows,title)=>{host.appendChild(el('h3',title));if(!rows.length){host.appendChild(el('p','本輪沒有此類股票；不補出名單。'));return;}rows.forEach((c,i)=>{const detail=el('details'),summary=el('summary',`${c.eligible?'入選 #'+(i+1):'待驗證'} 🏆${C.displayName(c.code,c)}（${c.code}）｜${c.label}｜${c.riskCodes?.length?'注意追價與K棒風險':'風險提示不改入選條件'}`),p=el('p',C.lines(c).join('\n'));detail.className='strong-stock-row';p.style.whiteSpace='pre-wrap';detail.append(summary,p);const b=el('button','查詢此股');b.className='copy-btn newbie-copy-btn';b.type='button';b.onclick=()=>{const input=document.getElementById('stockInput');if(input){input.value=c.code;input.dispatchEvent(new Event('input',{bubbles:true}));if(typeof root.analyzeStock==='function')root.analyzeStock();}};detail.appendChild(b);host.appendChild(detail);});};
 append(scan.candidates,'四條全部通過｜K線提醒不改入選資格');append(scan.results.filter(c=>c.status==='INSUFFICIENT_DATA'||c.status==='DATA_ERROR'),'條件資料待驗證｜不列入選名單');
 if(!scan.candidates.length)host.appendChild(el('p',scan.fullMarketCertified?'全市場已完成：本次2560無符合四條續強條件的股票。':'掃描或資料未完整，不能宣稱全市場2560符合0檔。'));
 const detail=el('details'),summary=el('summary','完整逐檔紀錄、未入選與失敗原因'),pre=el('pre',scan.text);detail.append(summary,pre);host.appendChild(detail);
 const run=root.ShitouIndicatorShadow?.capture('RESTAURANT',scan);if(run)root.ShitouIndicatorShadow.mount(run,'restaurantResult');progress(scan.attempted,scan.planned);finishUI();
}
async function request(part,date,attempt=1,timeoutMs=REQUEST_TIMEOUT_MS){
 const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),Math.min(REQUEST_TIMEOUT_MS,timeoutMs));requests++;
 try{const base=typeof MARKET_API_BASE_URL!=='undefined'?MARKET_API_BASE_URL:'https://shitou-taiwanmarket-api.d318426.workers.dev',codes=part.map(i=>i.code).join(','),markets=part.map(i=>String(i.q.market).toUpperCase()).join(',');
  const response=await fetch(`${base}/?market=DEEP_SCAN&profile=DAILY_ONLY&codes=${encodeURIComponent(codes)}&markets=${encodeURIComponent(markets)}&_restaurant_refresh=${Date.now()}_${attempt}`,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw Error('Worker HTTP '+response.status);const payload=await response.json();if(payload.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('第五策略深掃格式錯誤');
  // The shared archive-first acquisition performs canonical validation exactly once.
  return payload;
 }finally{clearTimeout(timer);controllers.delete(controller);}
}
async function remote(part,date){
 return recoverBatch(part,{request:(items,attempt,timeout)=>request(items,date,attempt,timeout),classify:D.classifyFailure,shouldStop:()=>stopped});
}
async function fetchBatch(part,date){
 const results=[],need=[];for(const item of part){const p=D.get(item.code),cached=reportCache.get(item.code);if(p&&!p.error&&cached?.key===p.key&&cached.fingerprint===p.fingerprint)try{results.push({code:item.code,ok:true,data:D.apply(cached.report,item.code)});continue;}catch(_){}need.push(item);}
 if(need.length){
  const payload=await D.acquireDailyBatch(need,missing=>remote(missing,date));
  for(const row of payload.results||[]){if(!row.ok||!row.data)continue;const code=String(row.code||row.data.stock),p=D.get(code);if(p&&!p.error)reportCache.set(code,{key:p.key,fingerprint:p.fingerprint,report:row.data});}
  results.push(...payload.results);
 }return {type:'MOMENTUM_DEEP_SCAN',results};
}
function stop(){stopped=true;controllers.forEach(c=>c.abort());note('已要求停止；保留已完成結果，未處理股票不視為淘汰。');}
async function run(){
 if(running)return;const originalButtons=['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerRun'].map(id=>document.getElementById(id)).filter(Boolean);
 if(originalButtons.some(b=>b.disabled)){note('其他選股工作正在執行或尚未就緒，請完成後再啟動第五濾網。');return;}
 running=true;stopped=false;last=null;requests=0;loadNames();finishUI();progress(0,1);by('Error').textContent='';by('ReportPanel').hidden=true;const prior=originalButtons.map(b=>b.disabled);originalButtons.forEach(b=>b.disabled=true);by('Run').disabled=true;by('Stop').disabled=false;by('Limit').disabled=true;by('Result').replaceChildren();
 try{note('核對最近完成交易日與普通股資料…');let bundle=await root.loadDayTradeMarketBundleV377736();if(stopped)return;
  const market=F.validateMarket(bundle.meta,bundle.snapshotRows,new Date());if(!market.ok)throw Error(market.reason);D.bind(bundle);
  const plan=S.pool(bundle,by('Limit').value);if(!plan.items.length)throw Error('普通股與快照檢查後沒有可分析股票；請檢查同日量價資料');
  note(`2560條件核對 0/${plan.items.length}｜近3交易日曾突破MA25 × 最新仍守MA25 × VMA5>VMA60 × MA5>MA40`);
  const result=await S.scan({pool:plan,meta:bundle.meta,requestedMode:by('Limit').value,fetchBatch:items=>fetchBatch(items,market.date),shouldStop:()=>stopped,batchSize:4,onProgress:s=>{progress(s.attempted,s.planned);note(`處理 ${s.attempted}/${s.planned}｜候選 ${s.candidates.length}｜風險提醒 ${s.riskWarnings.length}｜服務請求 ${requests}`);}});
  render(result);note(result.breaker||`${result.stopped?'已停止':'本輪完成'}｜候選 ${result.candidates.length}｜核心四條通過 ${result.sourceVerifiedMatches}｜條件待核對 ${result.unverified||0}｜缺資料不宣稱0檔符合。`);
 }catch(e){const message='第五濾網未完成：'+String(e.message||e);by('Error').textContent=message;note(message);}finally{running=false;controllers.forEach(c=>c.abort());controllers.clear();originalButtons.forEach((b,i)=>b.disabled=prior[i]);by('Run').disabled=false;by('Stop').disabled=true;by('Limit').disabled=false;finishUI();}
}
function content(){if(!last)throw Error('請先完成第五濾網查詢');const current=D.getSnapshot?.();if(current&&(current.date!==last.date||last.marketSnapshotFingerprint&&current.meta?.snapshotContentSha256!==last.marketSnapshotFingerprint))throw Error('行情已更新，請重新查詢2560戰法，再產生目前這一批報告');return S.assertSnapshot(last);}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function text(){const s=content();return root.ShitouIndicatorShadow?.appendText(s.text,'RESTAURANT',s)||s.text;}
async function copy(){try{await navigator.clipboard.writeText(text());note('已複製完整第五濾網文字；包含同一批日K的均線與K線說明。');}catch(e){note('複製未完成，請改下載文字檔：'+String(e.message||e));}}
function install(){
 if(document.getElementById('restaurantPanel')?.dataset.strategy==='2560')return;document.getElementById('restaurantPanel')?.remove();document.querySelectorAll('.restaurant-shortcut').forEach(n=>n.remove());
 loadNames();
 const panel=el('section');panel.id='restaurantPanel';panel.dataset.strategy='2560';panel.className='panel restaurant-panel';panel.innerHTML=`
 <div class="strong-stock-shortcut restaurant-controls">
  <div class="section-title">🌟 第五套｜2560戰法｜近3日突破續強</div>
  <div class="section-subtitle">最近3個完成交易日突破 × 最新守住MA25 × 量能轉強 × 均線多頭</div>
  <div class="strong-stock-reminder">#9041 最近3個完成交易日曾新突破MA25 × 最新收盤仍高於MA25 × #9012 VMA5高於VMA60 × #5331 MA5高於MA40，四項全通過才入選。其餘三項未設定日均量不計入。</div>
  <div class="meta">乖離、影線、量能及前高僅為風險提醒；未設定2560專屬出場或自動賣出。金融股及ETF不適用，其他五套不變。</div>
  <div class="rule restaurant-settings"><label for="restaurantLimit">查詢範圍：</label><select id="restaurantLimit"><option value="all">全部適用普通股（預設）</option><option value="300">依代號先查300檔（部分範圍）</option><option value="100">依代號先查100檔（部分範圍）</option></select><div class="meta">依代號固定排序，非強弱排名；不足8檔不補滿。部分範圍不能代表全市場。</div></div>
  <div class="strong-stock-actions"><button class="btn" type="button" id="restaurantRun">🌟 查詢2560戰法</button><button class="momentum-stop-btn show" type="button" id="restaurantStop" disabled>■ 停止</button></div>
  <div class="strong-stock-progress" role="progressbar" aria-label="第五濾網掃描進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="restaurantProgressBar"></div></div>
  <div id="restaurantMessage" class="meta" role="status" aria-live="polite">等待盤後查詢…可用資料不足時不補猜，也不保證每天有候選。</div>
  <div id="restaurantError" class="error" role="alert"></div>
 </div>
 <section id="restaurantReportPanel" class="restaurant-report" hidden>
  <div id="restaurantResult"></div>
  <div class="strong-stock-image-actions"><button class="copy-btn" type="button" id="restaurantCopy" disabled>📋 一鍵複製全部文字報告</button><button class="copy-btn" type="button" id="restaurantText" disabled>📄 下載完整 TXT</button><button class="copy-btn" type="button" id="restaurantJSON" disabled>📄 下載 JSON 紀錄</button><button class="copy-btn image-btn" type="button" id="restaurantImage" disabled>🖼️ 前8檔總覽＋K線說明（分頁）</button><button class="copy-btn image-btn" type="button" id="restaurantAllImages" disabled>🖼️ 全部候選完整圖片報告（多頁ZIP）</button><button class="copy-btn image-btn" type="button" id="restaurantMarkedImage" disabled>浮水印版前8檔＋K線說明</button><button class="copy-btn image-btn" type="button" id="restaurantAllMarkedImages" disabled>浮水印版完整圖片</button></div>
 </section>`;
 const tower=document.getElementById('towerGoldPanel'),footer=document.querySelector('footer');if(tower)tower.insertAdjacentElement('afterend',panel);else if(footer)footer.before(panel);else document.body.appendChild(panel);
 by('Run').onclick=run;by('Stop').onclick=stop;by('Copy').onclick=copy;
 by('Text').onclick=()=>{try{const s=content();download(new Blob([text()],{type:'text/plain;charset=utf-8'}),'2560戰法_'+s.date+'_'+root.ShitouReleaseV50.code+'.txt');}catch(e){note(e.message);}};
 by('JSON').onclick=()=>{try{const s=content();download(new Blob([JSON.stringify({release:root.ShitouReleaseV50.code,exportedAt:new Date().toISOString(),scan:s,rsiObservations:root.ShitouIndicatorShadow?.capture('RESTAURANT',s)?.rows||[]},null,2)],{type:'application/json'}),'2560戰法_'+s.date+'.json');}catch(e){note(e.message);}};
 for(const [key,all,marked] of [['Image',false,false],['AllImages',true,false],['MarkedImage',false,true],['AllMarkedImages',true,true]])by(key).onclick=()=>{try{root.ShitouStrategy2560Report.preview(content(),all,marked).catch(e=>note('圖片未完成：'+e.message));}catch(e){note(e.message);}};
 const nav=document.getElementById('towerGoldShortcut')?.parentElement;if(nav){const a=el('a','⑤ 🌟2560戰法');a.href='#restaurantPanel';a.className='restaurant-shortcut';nav.appendChild(a);}
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
 .restaurant-panel .strong-stock-diagnostic{border:1px solid var(--line);border-radius:12px;padding:12px;margin:14px 0;background:var(--card);color:var(--text)}
 .restaurant-panel .strong-stock-diagnostic-line{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);padding:7px 0;overflow-wrap:anywhere}
 .restaurant-panel .strong-stock-diagnostic-line strong{text-align:right;min-width:0;color:var(--text)}
 .restaurant-panel .strong-stock-row .copy-btn{min-width:0}
 body.dark-mode .restaurant-panel .strong-stock-reminder{background:#352c17;border-color:#7a6831;color:#f4e8bc}
 .restaurant-shortcut{display:inline-block;margin:8px;padding:12px;background:#fff4dc;color:#6b4704;border-radius:8px;text-decoration:none;font-weight:800}
 @media(max-width:600px){.restaurant-panel .strong-stock-actions .btn{flex:1;min-width:0}.restaurant-panel .strong-stock-image-actions{flex-direction:column}.restaurant-panel .copy-btn{min-width:0;width:100%;box-sizing:border-box}}
 `;document.head.appendChild(style);
}
root.ShitouRestaurantUI=root.ShitouStrategy2560UI=Object.freeze({transportVersion:TRANSPORT_VERSION,requestTimeoutMs:REQUEST_TIMEOUT_MS,run,stop,render,fetchBatch,request,text,getLast:()=>last,isRunning:()=>running,install});install();
})(globalThis);
