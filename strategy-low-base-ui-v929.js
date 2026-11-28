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
   try{payload=await request(part,round+1,Math.min(REQUEST_TIMEOUT_MS,remaining));if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('低位階策略深掃格式錯誤');}catch(e){cancelled();problem=e;}
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
if(!root.ShitouLowBaseBreakoutV929||!root.ShitouLowBaseScannerV929)return;
const C=root.ShitouRestaurantCore,S=root.ShitouLowBaseScannerV929,D=root.ShitouSelectionDataV2,F=root.ShitouStrongStockFilterV47;
if(!C||!S||!D||!F)throw Error('低位階突破共用模組未載入');
let running=false,stopped=false,last=null,requests=0;const controllers=new Set(),reportCache=new Map();
const by=id=>document.getElementById('lowBase'+id),el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
function note(text){const n=by('Message');if(n)n.textContent=text;}
function finishUI(){for(const key of ['Copy','Text','JSON','Image','AllImages','MarkedImage','AllMarkedImages']){const x=by(key);if(x)x.disabled=!last||(['Image','AllImages','MarkedImage','AllMarkedImages'].includes(key))&&!(key==='Image'||key==='MarkedImage'?last.top8:last.candidates).length;}}
function progress(done,total){const bar=by('ProgressBar'),ratio=total>0?Math.min(100,Math.max(0,done/total*100)):0;if(bar){bar.style.width=ratio+'%';bar.parentElement.setAttribute('aria-valuenow',String(Math.round(ratio)));}}
function loadNames(){
 let embedded={},official={};
 try{embedded=(typeof getEmbeddedStockDirectory==='function'?getEmbeddedStockDirectory():root.getEmbeddedStockDirectory?.())?.byCode||{};}catch(_){}
 try{official=(typeof readStockDirectoryCache==='function'?readStockDirectoryCache():root.readStockDirectoryCache?.())?.byCode||{};}catch(_){}
 const directory={...embedded};for(const [code,record] of Object.entries(official)){const name=String(record?.name||'').replace(/[-－]?(?:KY|DR)(?:\*)?$/i,'');if(/[\u3400-\u9fff]/.test(name)&&!/[\p{Script=Latin}]/u.test(name))directory[code]=record;}
 C.setNameDirectory(directory);
}
function render(scan){
 last=scan;const host=by('Result');if(!host)return;host.replaceChildren();by('ReportPanel').hidden=false;
 const title=el('div','⑥ 主升段低位階帶量突破');title.className='section-title';host.appendChild(title);
 const meta=el('div',scan.date+'｜已處理 '+scan.processed+'/'+scan.planned+'｜未處理 '+scan.pending+'｜未深掃 '+scan.deferred+'｜'+(scan.fullMarketCertified?'完整市場已確認':'非完整市場排名'));meta.className='meta';host.appendChild(meta);
 const grid=el('div');grid.className='momentum-summary-grid';
 for(const [label,value] of [['必要條件通過',scan.candidates.length],['TOP 8',scan.top8.length],['未符合',scan.notMatched],['資料待核對',scan.errors],['排除',scan.excluded]]){const card=el('div');card.className='momentum-summary-card';const k=el('div',label),v=el('div',String(value));k.className='k';v.className='v';card.append(k,v);grid.appendChild(card);}host.appendChild(grid);
 const reminder=el('div','只使用完成日K；21項必要條件全通過才列入候選。基本面未核實不加分，初次突破不代表隔日續強。');reminder.className='strong-stock-reminder';host.appendChild(reminder);
 if(scan.fundamentalReview)host.appendChild(el('p',scan.fundamentalReview.state==='READY'?'基本面封存已核對 '+scan.fundamentalReview.companies+' 家；缺少的個別條件不加分。':'V9.29核心版：基本面暫不加分；完整基本面預定V9.30。'));
 const diag=scan.diagnostics;
 if(diag){const panel=el('details'),summary=el('summary','逐項選股條件與資料不足原因'),body=el('div');panel.append(summary,body);
 for(const [key,g] of Object.entries(diag.gateCounts||{}))body.appendChild(el('p',S.gateLabel(key)+'：通過 '+g.pass+'／未通過 '+g.fail+'／已計算 '+g.evaluated));
 for(const [reason,n] of Object.entries(diag.unavailableReasons||{}))body.appendChild(el('p',reason+'：'+n+' 檔'));
 body.appendChild(el('p','各條件獨立統計，不能相加當成入選數。未核實資料不視為選股淘汰。'));host.appendChild(panel);}
 const append=(rows,title)=>{host.appendChild(el('h3',title));if(!rows.length){host.appendChild(el('p','本輪沒有此類股票，不補名單。'));return;}rows.forEach((c,i)=>{const detail=el('details'),summary=el('summary',(i+1)+'. '+c.name+'（'+c.code+'）｜'+(c.quality?c.quality.score+'分／'+c.quality.grade+'級':c.status)),p=el('p',S.lines(c).join('\n'));detail.className='strong-stock-row';p.style.whiteSpace='pre-wrap';detail.append(summary,p);const b=el('button','查詢此股');b.className='copy-btn';b.type='button';b.onclick=()=>{const input=document.getElementById('stockInput');if(input){input.value=c.code;input.dispatchEvent(new Event('input',{bubbles:true}));if(typeof root.analyzeStock==='function')root.analyzeStock();}};detail.appendChild(b);host.appendChild(detail);});};
 append(scan.top8,'TOP 8｜依突破品質排序');append(scan.candidates,'完整符合條件榜單（含低分候選）');
 if(scan.followupReview){const section=el('details'),summary=el('summary','前5日突破生命週期追蹤（'+(scan.followups?.length||0)+'筆）');section.appendChild(summary);const f=scan.followupReview;section.appendChild(el('p','歷史封存來源：'+({READY:'已核對',PARTIAL:'部分不足',UNAVAILABLE:'未取得'}[f.state]||f.state)+'｜已核對 '+f.checked+'筆｜資料不足 '+f.unavailable+'筆｜未追蹤股票 '+f.notReviewed+'檔。此區不列入今日新突破排名。'));for(const e of f.sourceErrors||[])section.appendChild(el('p',e.date+'：'+e.reason));for(const x of scan.followups||[]){const p=el('p',S.followupLines(x).join('\n'));p.style.whiteSpace='pre-wrap';section.appendChild(p);}if(!scan.followups?.length)section.appendChild(el('p','目前未確認前5日突破追蹤訊號；資料不足不等同無訊號。'));host.appendChild(section);}
 if(!scan.candidates.length)host.appendChild(el('p',scan.zeroConfirmed?'全市場完整核對，本日無符合必要條件股票。':'資料或掃描未完整，不得宣稱全市場0檔。'));
 const detail=el('details'),summary=el('summary','完整逐檔紀錄、未入選與失敗原因'),pre=el('pre',S.text(scan));detail.append(summary,pre);host.appendChild(detail);
 progress(scan.processed,scan.planned);finishUI();
}
async function request(part,date,attempt=1,timeoutMs=REQUEST_TIMEOUT_MS){
 const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),Math.min(REQUEST_TIMEOUT_MS,timeoutMs));requests++;
 try{const base=typeof MARKET_API_BASE_URL!=='undefined'?MARKET_API_BASE_URL:'https://shitou-taiwanmarket-api.d318426.workers.dev',codes=part.map(i=>i.code).join(','),markets=part.map(i=>String(i.q.market).toUpperCase()).join(',');
  const response=await fetch(`${base}/?market=DEEP_SCAN&profile=DAILY_ONLY&codes=${encodeURIComponent(codes)}&markets=${encodeURIComponent(markets)}&_restaurant_refresh=${Date.now()}_${attempt}`,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw Error('Worker HTTP '+response.status);const payload=await response.json();if(payload.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('低位階策略深掃格式錯誤');
  const aligned=await root.ShitouSelectionDataV2.harmonize(part,payload,'DAILY_ONLY');
  for(const r of aligned.results||[]){if(!r.ok||!r.data)continue;const code=String(r.code||r.data.stock),p=D.get(code);if(p&&!p.error)reportCache.set(code,{key:p.key,fingerprint:p.fingerprint,report:r.data});}
  return aligned;
 }finally{clearTimeout(timer);controllers.delete(controller);}
}
async function remote(part,date){
 return recoverBatch(part,{request:(items,attempt,timeout)=>request(items,date,attempt,timeout),classify:D.classifyFailure,shouldStop:()=>stopped});
}
async function fetchBatch(part,date){
 const H=root.ShitouOfficialResearchHistory;
 const results=[],need=[];
 for(const item of part){if(stopped)break;try{const cached=H.get(item.code,date),raw=await H.load(item.code,{date,market:item.q.market});if(!cached)H.release(item.code,date);results.push({code:item.code,ok:true,data:raw});}catch(_){need.push(item);}}
 const remotePart=need.splice(0);
 for(const item of remotePart){const p=D.get(item.code),cached=reportCache.get(item.code);if(p&&!p.error&&cached?.key===p.key&&cached.fingerprint===p.fingerprint)try{results.push({code:item.code,ok:true,data:D.apply(cached.report,item.code)});continue;}catch(_){}need.push(item);}
 if(need.length){const payload=await remote(need,date);results.push(...payload.results);}return {type:'MOMENTUM_DEEP_SCAN',results};
}
function stop(){stopped=true;controllers.forEach(c=>c.abort());note('已要求停止；保留已完成結果，未處理股票不視為淘汰。');}
async function run(){
 if(running)return;const originalButtons=['momentumScanButton','dayTradeScanButton','strongStockScanButton','towerRun','macdPlusScanButton','mainForceLifelineRun'].map(id=>document.getElementById(id)).filter(Boolean);
 if(originalButtons.some(b=>b.disabled)){note('其他選股工作正在執行或尚未就緒，請完成後再啟動低位階突破。');return;}
 running=true;stopped=false;last=null;requests=0;loadNames();finishUI();progress(0,1);by('Error').textContent='';by('ReportPanel').hidden=true;const prior=originalButtons.map(b=>b.disabled);originalButtons.forEach(b=>b.disabled=true);by('Run').disabled=true;by('Stop').disabled=false;by('Limit').disabled=true;by('Result').replaceChildren();
 try{note('核對最近完成交易日與普通股資料…');let bundle=await root.ShitouStrategyExtensionsV1.loadBundle();if(stopped)return;
  const market=F.validateMarket(bundle.meta,bundle.snapshotRows,new Date());if(!market.ok)throw Error(market.reason);D.bind(bundle);
  const plan=S.pool(bundle,by('Limit').value);if(!plan.items.length)throw Error('普通股與快照檢查後沒有可分析股票；請檢查同日量價資料');
  const L=root.ShitouLowBaseLifecycleV929,K=root.ShitouKlineAttack,controller=new AbortController();controllers.add(controller);
  let archive=null;try{if(L&&K){note('核對前5日封存行情，準備生命週期追蹤…');archive=await L.loadArchives(plan.date,plan.marketSnapshotFingerprint,{signal:controller.signal});}}finally{controllers.delete(controller);}if(stopped)return;
  const fundamentals={state:'DEFERRED_V930',companies:0,reason:'V9.29核心版不使用未完整驗證基本面',get:()=>({})};
  note('低位階帶量突破｜正在核對 '+plan.items.length+' 檔');
  const result=await S.scan({plan,archive,fundamentals,reviewFollowup:archive?(report,opts)=>L.replay(report,{...opts,C:root.ShitouLowBaseBreakoutV929,K}):null,fetchBatch:items=>fetchBatch(items,market.date),shouldStop:()=>stopped,batchSize:4,onProgress:s=>{progress(s.processed,s.planned);note('處理 '+s.processed+'/'+s.planned+'｜候選 '+s.candidates.length+'｜資料待核對 '+s.errors+'｜服務請求 '+requests);}});
  render(result);note((result.stopped?'已停止':'本輪完成')+'｜必要條件通過 '+result.candidates.length+'｜資料待核對 '+result.errors+'｜'+(result.fullMarketCertified?'全市場完整':'非完整市場'));
 }catch(e){const message='低位階突破未完成：'+String(e.message||e);by('Error').textContent=message;note(message);}finally{running=false;controllers.forEach(c=>c.abort());controllers.clear();originalButtons.forEach((b,i)=>b.disabled=prior[i]);by('Run').disabled=false;by('Stop').disabled=true;by('Limit').disabled=false;finishUI();}
}
function content(){if(!last)throw Error('請先完成低位階突破查詢');const current=D.getSnapshot?.();if(current&&(current.date!==last.date||last.marketSnapshotFingerprint&&current.meta?.snapshotContentSha256!==last.marketSnapshotFingerprint))throw Error('行情已更新，請重新查詢主升段低位階帶量突破，再產生目前這一批報告');return last;}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function text(){const s=content();return S.text(s);}
async function copy(){try{await navigator.clipboard.writeText(text());note('已複製完整低位階突破文字；包含同一批日K的均線與K線說明。');}catch(e){note('複製未完成，請改下載文字檔：'+String(e.message||e));}}
function install(){
 if(document.getElementById('lowBasePanel')?.dataset.strategy==='LOW_BASE_V929')return;document.getElementById('lowBasePanel')?.remove();document.querySelectorAll('.lowbase-shortcut').forEach(n=>n.remove());
 loadNames();
 const panel=el('section');panel.id='lowBasePanel';panel.dataset.strategy='LOW_BASE_V929';panel.className='panel lowbase-panel';panel.innerHTML=`
 <div class="strong-stock-shortcut lowbase-controls">
  <div class="section-title">🌟 新增策略｜主升段低位階帶量突破</div>
  <div class="section-subtitle">低位階整理 × 帶量突破 × 收盤品質 × 防末升段</div>
  <div class="strong-stock-reminder">21項必要濾網：前20／60日漲幅、5日量縮整理、收盤新突破MA20、有效放量、K線品質、RSI及乖離率。成交值須大於5億元。</div>
  <div class="meta">金融、生技、營建及非普通股排除。只用完成日K；未核實基本面不加分。</div>
  <div class="rule lowbase-settings"><label for="lowBaseLimit">查詢範圍：</label><select id="lowBaseLimit"><option value="all">全部適用普通股（預設）</option><option value="300">依代號先查300檔（部分範圍）</option><option value="100">依代號先查100檔（部分範圍）</option></select><div class="meta">依品質分數排序；不足8檔不補滿。部分範圍不能代表全市場。</div></div>
  <div class="strong-stock-actions"><button class="btn" type="button" id="lowBaseRun">🌟 查詢主升段低位階帶量突破</button><button class="momentum-stop-btn show" type="button" id="lowBaseStop" disabled>■ 停止</button></div>
  <div class="strong-stock-progress" role="progressbar" aria-label="低位階突破掃描進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="lowBaseProgressBar"></div></div>
  <div id="lowBaseMessage" class="meta" role="status" aria-live="polite">等待盤後查詢…可用資料不足時不補猜，也不保證每天有候選。</div>
  <div id="lowBaseError" class="error" role="alert"></div>
 </div>
 <section id="lowBaseReportPanel" class="lowbase-report" hidden>
  <div id="lowBaseResult"></div>
  <div class="strong-stock-image-actions"><button class="copy-btn" type="button" id="lowBaseCopy" disabled>📋 一鍵複製全部文字報告</button><button class="copy-btn" type="button" id="lowBaseText" disabled>📄 下載完整 TXT</button><button class="copy-btn" type="button" id="lowBaseJSON" disabled>📄 下載 JSON 紀錄</button><button class="copy-btn image-btn" type="button" id="lowBaseImage" disabled>🖼️ TOP 8 品質明細（分頁）</button><button class="copy-btn image-btn" type="button" id="lowBaseAllImages" disabled>🖼️ 全部候選完整圖片報告（多頁ZIP）</button><button class="copy-btn image-btn" type="button" id="lowBaseMarkedImage" disabled>浮水印版TOP 8</button><button class="copy-btn image-btn" type="button" id="lowBaseAllMarkedImages" disabled>浮水印版完整圖片</button></div>
 </section>`;
 const tower=document.getElementById('mainForceLifelinePanel'),footer=document.querySelector('footer');if(tower)tower.insertAdjacentElement('afterend',panel);else if(footer)footer.before(panel);else document.body.appendChild(panel);
 by('Run').onclick=run;by('Stop').onclick=stop;by('Copy').onclick=copy;
 by('Text').onclick=()=>{try{const s=content();download(new Blob([text()],{type:'text/plain;charset=utf-8'}),'主升段低位階帶量突破_'+s.date+'_'+root.ShitouReleaseV50.code+'.txt');}catch(e){note(e.message);}};
 by('JSON').onclick=()=>{try{const s=content();download(new Blob([JSON.stringify({release:root.ShitouReleaseV50.code,exportedAt:new Date().toISOString(),scan:s,strategy:'LOW_BASE_VOLUME_BREAKOUT_V1'},null,2)],{type:'application/json'}),'主升段低位階帶量突破_'+s.date+'.json');}catch(e){note(e.message);}};
 for(const [key,all,marked] of [['Image',false,false],['AllImages',true,false],['MarkedImage',false,true],['AllMarkedImages',true,true]])by(key).onclick=()=>{try{root.ShitouLowBaseReportV929.preview(content(),all,marked).catch(e=>note('圖片未完成：'+e.message));}catch(e){note(e.message);}};
 const nav=document.getElementById('towerGoldShortcut')?.parentElement;if(nav){const a=el('a','⑥ 🌟主升段低位階帶量突破');a.href='#lowBasePanel';a.className='lowbase-shortcut';nav.appendChild(a);}
 const style=el('style');style.textContent=`
 .lowbase-panel{scroll-margin-top:20px;box-sizing:border-box}
 .lowbase-controls{margin-top:0}
 .lowbase-settings{margin-top:12px}
 .lowbase-settings label{display:block;margin-bottom:7px}
 .lowbase-settings select{padding:9px;max-width:100%;border:1px solid var(--line);border-radius:8px;font-size:16px;background:var(--card);color:var(--text);min-height:44px}
 .lowbase-panel .strong-stock-reminder{margin:12px 0}
 .lowbase-panel .strong-stock-progress{margin-bottom:10px}
 .lowbase-report{border-top:5px solid #24628a;margin-top:20px;padding-top:18px}
 .lowbase-panel details{margin:12px 0;border:1px solid var(--line);border-left:5px solid #24628a;border-radius:8px;padding:13px;overflow-wrap:anywhere;background:var(--card);color:var(--text)}
 .lowbase-panel summary{cursor:pointer;font-weight:800;line-height:1.8}
 .lowbase-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;color:var(--text)}
 .lowbase-panel .strong-stock-diagnostic{border:1px solid var(--line);border-radius:12px;padding:12px;margin:14px 0;background:var(--card);color:var(--text)}
 .lowbase-panel .strong-stock-diagnostic-line{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);padding:7px 0;overflow-wrap:anywhere}
 .lowbase-panel .strong-stock-diagnostic-line strong{text-align:right;min-width:0;color:var(--text)}
 .lowbase-panel .strong-stock-row .copy-btn{min-width:0}
 body.dark-mode .lowbase-panel .strong-stock-reminder{background:#352c17;border-color:#7a6831;color:#f4e8bc}
 .lowbase-shortcut{display:inline-block;margin:8px;padding:12px;background:#fff4dc;color:#6b4704;border-radius:8px;text-decoration:none;font-weight:800}
 @media(max-width:600px){.lowbase-panel .strong-stock-actions .btn{flex:1;min-width:0}.lowbase-panel .strong-stock-image-actions{flex-direction:column}.lowbase-panel .copy-btn{min-width:0;width:100%;box-sizing:border-box}}
 `;document.head.appendChild(style);
}
root.ShitouLowBaseUIV929=Object.freeze({transportVersion:TRANSPORT_VERSION,requestTimeoutMs:REQUEST_TIMEOUT_MS,run,stop,render,fetchBatch,request,text,getLast:()=>last,isRunning:()=>running,install});install();
})(globalThis);
