(function(root){'use strict';
const C=root.ShitouRestaurantCore,S=root.ShitouRestaurantScanner,D=root.ShitouSelectionDataV2,F=root.ShitouStrongStockFilterV47;
if(!C||!S||!D||!F)throw Error('第五濾網共用模組未載入');
let running=false,stopped=false,last=null,requests=0;const controllers=new Set(),reportCache=new Map();
const by=id=>document.getElementById('restaurant'+id),el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
function note(text){const n=by('Message');if(n)n.textContent=text;}
function finishUI(){for(const key of ['Copy','Text','JSON','Image','AllImages']){const x=by(key);if(x)x.disabled=!last||(key==='Image'||key==='AllImages')&&!last.candidates.length;}}
function render(scan){last=scan;const host=by('Result');if(!host)return;host.replaceChildren();
 host.appendChild(el('p',`${scan.date}｜處理 ${scan.attempted}/${scan.planned}｜待處理 ${scan.pending}｜未深掃 ${scan.deferred}｜資料不足 ${scan.dataUnavailable}｜服務失敗 ${scan.failed}｜${scan.complete?'本輪處理完成':'未完整完成'}｜${scan.fullMarketCertified?'完整市場資料認證':'非全市場完整排名'}`));
 host.appendChild(el('p',`均衡候選 ${scan.counts.CANDIDATE||0}｜附警訊 ${scan.counts.WATCH||0}｜高風險旁列 ${scan.riskCandidates.length}｜原圖全部條件已核對符合 ${scan.sourceVerifiedMatches}。缺主力或JMA資料不算原圖策略通過。`));
 const append=(rows,title)=>{host.appendChild(el('h3',title));if(!rows.length){host.appendChild(el('p','本輪沒有此類股票；不補出名單。'));return;}rows.forEach((c,i)=>{const detail=el('details'),summary=el('summary',`${c.eligible?'觀察序 #'+(i+1):'風險旁列'} ${c.name}（${c.code}）｜${c.label}｜${c.event?.kind==='OFFICIAL'?'官方漲停':'推估漲停'}`),p=el('p',C.lines(c).join('\n'));p.style.whiteSpace='pre-wrap';detail.appendChild(summary);detail.appendChild(p);const b=el('button','查詢此股');b.type='button';b.onclick=()=>{const input=document.getElementById('stockInput');if(input){input.value=c.code;input.dispatchEvent(new Event('input',{bubbles:true}));if(typeof root.analyzeStock==='function')root.analyzeStock();}};detail.appendChild(b);host.appendChild(detail);});};
 append(scan.candidates,'候選與附警訊觀察｜依風險與符合度排序');append(scan.riskCandidates,'高風險旁列｜不列入候選');
 if(!scan.candidates.length)host.appendChild(el('p','可選全部有效股票或近5根窗口重新查詢；不會自動放寬，也不保證一定有候選。請先看資料不足與未處理筆數。'));
 const detail=el('details'),summary=el('summary','完整逐檔紀錄、未入選與失敗原因'),pre=el('pre',scan.text);detail.appendChild(summary);detail.appendChild(pre);host.appendChild(detail);
 const run=root.ShitouIndicatorShadow?.capture('RESTAURANT',scan);if(run)root.ShitouIndicatorShadow.mount(run,'restaurantResult');finishUI();
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
 running=true;stopped=false;last=null;requests=0;finishUI();const prior=originalButtons.map(b=>b.disabled);originalButtons.forEach(b=>b.disabled=true);by('Run').disabled=true;by('Stop').disabled=false;by('Window').disabled=true;by('Limit').disabled=true;by('Result').replaceChildren();
 try{note('核對最近完成交易日、產業與官方排除名單…');const bundle=await root.loadDayTradeMarketBundleV377736();if(stopped)return;
  const market=F.validateMarket(bundle.meta,bundle.snapshotRows,new Date());if(!market.ok)throw Error(market.reason);D.bind(bundle);
  const plan=S.pool(bundle,by('Limit').value),eventWindow=Number(by('Window').value);if(!plan.items.length)throw Error('共用排除與快照檢查後沒有可分析股票；請檢查排除名單及量價資料');
  note(`第五策略輕量日K掃描 0/${plan.items.length}｜近${eventWindow}根訊號｜不符合原圖不等於資料失敗`);
  const result=await S.scan({pool:plan,meta:bundle.meta,eventWindow,requestedMode:by('Limit').value,fetchBatch:items=>fetchBatch(items,market.date),shouldStop:()=>stopped,batchSize:4,onProgress:s=>note(`處理 ${s.attempted}/${s.planned}｜候選 ${s.candidates.length}｜高風險 ${s.riskCandidates.length}｜服務請求 ${requests}`)});
  render(result);note(result.breaker||`${result.stopped?'已停止':'本輪完成'}｜候選 ${result.candidates.length}｜原圖完整核對符合 ${result.sourceVerifiedMatches}｜資料缺口明示；未驗證績效。`);
 }catch(e){note('第五濾網未完成：'+String(e.message||e));}finally{running=false;controllers.forEach(c=>c.abort());controllers.clear();originalButtons.forEach((b,i)=>b.disabled=prior[i]);by('Run').disabled=false;by('Stop').disabled=true;by('Window').disabled=false;by('Limit').disabled=false;finishUI();}
}
function content(){if(!last)throw Error('請先完成第五濾網查詢');return last;}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function text(){const s=content();return root.ShitouIndicatorShadow?.appendText(s.text,'RESTAURANT',s)||s.text;}
async function copy(){try{await navigator.clipboard.writeText(text());note('已複製完整第五濾網文字；包含原圖未驗證項目。');}catch(e){note('複製未完成，請改下載文字檔：'+String(e.message||e));}}
function install(){
 if(document.getElementById('restaurantPanel'))return;
 const panel=el('section');panel.id='restaurantPanel';panel.className='panel restaurant-panel';panel.innerHTML=`<h2>⑤ 餐廳擠不進去｜均衡量價觀察版</h2><p>近期漲停後續強／量縮整理。原圖主力與JMA未提供時明示未驗證；本版趨勢採SMA20，推估漲停不等於官方確認。</p><p>明顯量價失效與複合過熱列高風險；單一乖離、量增、CMF偏弱列附警訊。成交值前100作排序參考，不硬性排除。</p><label>訊號窗口 <select id="restaurantWindow"><option value="3">近3根（預設均衡）</option><option value="1">近1根（較接近圖片）</option><option value="5">近5根（延長觀察）</option></select></label> <label>深入範圍 <select id="restaurantLimit"><option value="300">優先300檔</option><option value="100">優先100檔</option><option value="all">全部有效股票</option></select></label><div class="restaurant-actions"><button type="button" id="restaurantRun">啟動第五濾網</button><button type="button" id="restaurantStop" disabled>停止</button><button type="button" id="restaurantCopy" disabled>複製完整文字</button><button type="button" id="restaurantText" disabled>下載TXT</button><button type="button" id="restaurantJSON" disabled>下載JSON紀錄</button><button type="button" id="restaurantImage" disabled>前8檔完整圖片</button><button type="button" id="restaurantAllImages" disabled>全部候選圖片／ZIP</button></div><p id="restaurantMessage" role="status" aria-live="polite">尚未掃描。可用資料不足時不補猜，也不保證每天有候選。</p><div id="restaurantResult"></div>`;
 const tower=document.getElementById('towerGoldPanel'),footer=document.querySelector('footer');if(tower)tower.insertAdjacentElement('afterend',panel);else if(footer)footer.before(panel);else document.body.appendChild(panel);
 by('Run').onclick=run;by('Stop').onclick=stop;by('Copy').onclick=copy;
 by('Text').onclick=()=>{try{const s=content();download(new Blob([text()],{type:'text/plain;charset=utf-8'}),'餐廳擠不進去_'+s.date+'_'+root.ShitouReleaseV50.code+'.txt');}catch(e){note(e.message);}};
 by('JSON').onclick=()=>{try{const s=content();download(new Blob([JSON.stringify({release:root.ShitouReleaseV50.code,exportedAt:new Date().toISOString(),scan:s},null,2)],{type:'application/json'}),'餐廳擠不進去_'+s.date+'.json');}catch(e){note(e.message);}};
 for(const [key,all] of [['Image',false],['AllImages',true]])by(key).onclick=()=>{try{root.ShitouRestaurantReport.preview(content(),all).catch(e=>note('圖片未完成：'+e.message));}catch(e){note(e.message);}};
 const nav=document.getElementById('towerGoldShortcut')?.parentElement;if(nav){const a=el('a','⑤ 餐廳擠不進去');a.href='#restaurantPanel';a.className='restaurant-shortcut';nav.appendChild(a);}
 const style=el('style');style.textContent='.restaurant-panel{scroll-margin-top:20px;color:#18334d;background:#f4f8fc;max-width:1320px;margin:22px auto;box-sizing:border-box}.restaurant-panel p,.restaurant-panel pre,.restaurant-panel summary,.restaurant-panel label{color:#18334d}.restaurant-panel select,.restaurant-panel button{min-height:44px;font-size:16px;padding:10px;max-width:100%}.restaurant-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.restaurant-panel details{margin:12px 0;border:1px solid #b6c8d8;border-radius:8px;padding:12px;overflow-wrap:anywhere}.restaurant-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}.restaurant-shortcut{display:inline-block;margin:8px;padding:12px;background:#fff4dc;color:#6b4704;border-radius:8px;text-decoration:none;font-weight:800}';document.head.appendChild(style);
}
root.ShitouRestaurantUI=Object.freeze({run,stop,render,fetchBatch,request,text,getLast:()=>last,isRunning:()=>running,install});install();
})(globalThis);
