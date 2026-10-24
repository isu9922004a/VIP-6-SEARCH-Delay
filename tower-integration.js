(function(root){'use strict';
const C=root.ShitouTowerCore,A=root.ShitouTowerTrend,S=root.ShitouTowerScanner,R=root.ShitouTowerReport,V=root.ShitouTowerDesign;
if(!C||!A||!S||!R)throw Error('寶塔線相依模組未載入');
let last=null,running=false,stopped=false,marketTower=null,verifiedDate=null,verifiedSnapshot=null;
const by=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function completed(report){if(report.completed===false||report.isComplete===false)return false;const d=C.date(report.closeDate||report.dataDate);if(d&&d===verifiedDate)return true;if(report.completed===true||report.dataTiming==='POST_CLOSE_ONLY')return true;return false;}
function get(report,extra={}){let r=report?.report||report||{};try{if(root.ShitouSelectionDataV2?.get(String(r.stock||r.code||'')))r=root.ShitouSelectionDataV2.apply(r,String(r.stock||r.code||''));}catch(e){return A.analyze({...r,completed:false},{completed:false,asOf:extra.asOf||r.closeDate});}const date=C.date(extra.asOf||r.marketDate||r.closeDate||r.dataDate),q=verifiedSnapshot?.map?.get(String(r.stock||r.code||''));
 if(!extra.isIndex&&q&&date===verifiedDate){const last=(r.canonicalBars||r.dailySeries)?.at(-1);if(!last||C.date(q.quoteDate)!==date||Math.abs(Number(q.close)-Number(last.close))>Math.max(.02,Number(q.close)*.0001)||!(Number(q.volume)>0)||!(Number(last.volume)>0)||Math.abs(Number(q.volume)-Number(last.volume))/Number(q.volume)>.2)return A.analyze({...r,completed:false},{asOf:date,completed:false,...extra});const rows=(r.canonicalBars||r.dailySeries).map(b=>({...b}));rows.at(-1).volume=Number(q.volume);r={...r,canonicalBars:rows};}
 return A.analyze(r,{asOf:date,completed:completed(r),marketTower:marketTower?.date===date?marketTower:null,...extra});}
function mount(report,id,hostId,extra={}){const host=by(hostId);if(!host)return;let box=by(id);if(!box){box=document.createElement('div');box.id=id;host.appendChild(box);}box.innerHTML=R.html(get(report,extra));}
function wrap(name,fn){const old=root[name];if(typeof old==='function')root[name]=function(...args){return fn.call(this,old,...args);};}
function appendScanText(text,scan){const list=scan?.candidates||[],results=list.filter(c=>c.report).map(c=>get(c.report));return text+'\n\n【寶塔線SHADOW觀察層｜原資格、計分与排名保留】\n'+results.map(a=>`${a.name}（${a.code}） ${a.trend.label}／${a.status}｜${a.reasonCodes.join('、')}｜日期 ${a.date}｜${root.ShitouReleaseV50.displayCode}`).join('\n');}
function mountScan(scan,hostId){const host=by(hostId);if(!host)return;let box=by(hostId+'TowerShadow');if(!box){box=document.createElement('section');box.id=hostId+'TowerShadow';host.appendChild(box);}box.innerHTML='<h3>寶塔線SHADOW觀察層｜原排序保留</h3>'+(scan?.candidates||[]).filter(c=>c.report).map(c=>R.html(get(c.report))).join('');}
for(const loader of ['loadDayTradeMarketBundleV377736','loadMomentumMarketBundleV377737'])wrap(loader,async function(old,...args){const b=await old.apply(this,args),v=root.ShitouStrongStockFilterV47.validateMarket(b.meta,b.snapshotRows);if(v.ok){verifiedDate=v.date;verifiedSnapshot=b;}return b;});
wrap('analyzeStock',async function(old,...args){try{await root.loadDayTradeMarketBundleV377736();}catch(_){verifiedDate=null;verifiedSnapshot=null;}return old.apply(this,args);});
for(const name of ['momentumCandidateV3768','dayTradeCandidateV1'])wrap(name,function(old,report,...args){const c=old.call(this,report,...args);if(c&&typeof c==='object')c.towerShadow=get(report);return c;});
for(const name of ['buildMomentumScanTextReportV3763','buildMomentumScanCompactTextReportV377713','buildDayTradeTextReportV1'])wrap(name,function(old,scan,...args){return appendScanText(old.call(this,scan,...args),scan);});
for(const name of ['renderMomentumScanResultV3762','renderMomentumScanResultV3765','renderDayTradeScanResultV1'])wrap(name,function(old,scan,...args){const out=old.call(this,scan,...args);mountScan(scan,name.includes('Momentum')?'momentumList':'dayTradeList');return out;});
wrap('runStrongStockScanV47',async function(old,...args){const out=await old.apply(this,args);mountScan(root.STRONG_STOCK_TEST_API_V47?.getLast(),'strongStockList');return out;});
wrap('buildMarketWorkerReportText',function(old,report,...args){const a=get(report,{isIndex:true});return old.call(this,report,...args)+'\n\n【寶塔線多空趨勢診斷】\n'+R.lines(a).join('\n')+'\n明天三種走法\n'+Object.values(a.scenarios).join('\n');});
wrap('renderMarketWorkerData',function(old,report,...args){const out=old.call(this,report,...args),a=get(report,{isIndex:true});marketTower=a.tower.ok?a.tower:null;mount(report,'towerMarketDiagnosis','marketStatusBox',{isIndex:true});return out;});
// Individual tower reports have their own fixed phone canvas and panel.
// Keep the index report and all scan evidence on their existing paths.
wrap('renderMarketInfographicV3328',function(old,report,...args){return R.extend(old.call(this,report,...args),get(report,{isIndex:true}));});
const strong=root.STRONG_STOCK_TEST_API_V47;if(strong){root.STRONG_STOCK_TEST_API_V47=Object.freeze({...strong,evaluateResponse(item,x,date){const c=strong.evaluateResponse(item,x,date);if(c?.report)c.towerShadow=get(c.report,{asOf:date,completed:true});return c;},buildText(scan){return appendScanText(strong.buildText(scan),scan);}});}
// The third UI owns private closures. Modify its existing evaluate/text sites separately
// so real scan output receives the same shadow data, not only the test API.
function healthNote(scan){return scan.healthAudit?.degraded?'【健康抽查部分資料暫缺】'+scan.healthAudit.issues.map(x=>x.code+' '+x.kind+'：'+x.reason).join('；')+'。異常股票保留在逐檔資料不足／失敗統計，未視為通過。':'';}
function exportText(scan){let text=root.ShitouTowerScanCopy?.format?root.ShitouTowerScanCopy.format(scan):scan.text;if(healthNote(scan)&&!text.includes('【健康抽查部分資料暫缺】'))text+='\n'+healthNote(scan);return root.ShitouIndicatorShadow?.appendText(text,'TOWER',scan)??text;}
function render(scan){const summary=by('towerSummary'),list=by('towerList');if(summary)summary.textContent=`${scan.complete?'處理完成':'部分處理／尚未完整'}｜${scan.date}｜原始${scan.universe}／快篩${scan.quick}／深掃${scan.attempted}/${scan.planned}｜成功${scan.success}／失敗${scan.failed}／資料不足${scan.dataUnavailable}｜${scan.fullMarketCertified?'完整市場資料認證':'非全市場完整排名'}｜SHADOW未啟用交易`;
 if(list)list.innerHTML=V.cards(scan);V.summary(scan);
 const shadowRun=root.ShitouIndicatorShadow?.capture('TOWER',scan);
 if(shadowRun){root.ShitouIndicatorShadow.mount(shadowRun,'towerList');scan.text=root.ShitouIndicatorShadow.appendText(scan.text,'TOWER',scan);}
 if(scan.healthAudit?.degraded&&summary)summary.textContent+='｜抽查個別資料暫缺：'+scan.healthAudit.issues.map(x=>x.code+' '+(x.kind==='DATA'?'資料不足':'服務失敗')).join('、')+'（已納入逐檔統計）';
 if(scan.fastAudit&&summary)summary.textContent+='｜⚠️ 加速研究版：未全量FULL等價認證';by('towerReportText').textContent=exportText(scan);by('towerCopy').disabled=false;by('towerDownload').disabled=false;by('towerImage').disabled=!scan.candidates.length;by('towerZip').disabled=!scan.candidates.length;
}
// TOWER-NETWORK-RETRY.1: only the fourth strategy's data transport and health probes.
// This does not alter the stock universe, score/rank calculations, day-K values or gates.
const towerPause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const towerTransientError=e=>!/Worker HTTP (?:400|401|403|404|405|410|422)\b|深掃格式錯誤/i.test(String(e?.message||e));
async function fetchBatch(items,profile,options={}){
 const endpoint=typeof MARKET_API_BASE_URL!=='undefined'?MARKET_API_BASE_URL:'https://shitou-taiwanmarket-api.d318426.workers.dev';
 const timeoutMs=Number.isFinite(Number(options.timeoutMs))?Math.max(4000,Math.min(45000,Number(options.timeoutMs))):32000;
 const controller=new AbortController();let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 try{
  const codes=items.map(i=>i.code).join(','),markets=items.map(i=>String(i.q?.market).toUpperCase()==='TPEX'?'TPEX':'TWSE').join(',');
  const extra=options.refresh?`&_deep_guard_refresh=${encodeURIComponent(String(Date.now()))}`:'';
  const res=await fetch(`${endpoint}/?market=DEEP_SCAN&profile=${profile}&codes=${encodeURIComponent(codes)}&markets=${encodeURIComponent(markets)}${extra}`,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if(!res.ok)throw Error('Worker HTTP '+res.status);
  const p=await res.json();
  if(p.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(p.results))throw Error('深掃格式錯誤');
  return root.ShitouSelectionDataV2.harmonize(items,p,profile);
 }catch(e){
  if(options.towerNetworkDiagnostic&&(timedOut||e?.name==='AbortError'))throw Error('TOWER_REQUEST_TIMEOUT：'+profile+'，請求超過 '+Math.ceil(timeoutMs/1000)+' 秒');
  if(options.towerNetworkDiagnostic&&/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(String(e?.message||e)))throw Error('TOWER_NETWORK_ERROR：'+profile+'，網路、跨網域連線或 Worker 暫時無法回應');
  throw e;
 }finally{clearTimeout(timer);}
}
function towerSingleRecord(items,payload,item){
 if(!Array.isArray(payload?.results))return null;
 const matches=payload.results.filter(x=>String(x?.code||x?.data?.stock||x?.data?.code||'')===String(item.code));
 return matches.length===1?matches[0]:null;
}
function towerServiceRecord(item,reason){return {code:String(item.code),ok:false,error:'TOWER_SERVICE_UNAVAILABLE：'+String(reason||'行情服務回應不足')};}
// Fail closed: never synthesize or modify OHLCV. Failed single-stock requests stay ok:false.
async function fetchTowerReliableBatch(items,profile,options={}){
 const deadline=Number(options.deadline)||Date.now()+90000;
 const stage=options.stage||'SCAN';
 const problems=[];
 const request=async(part,attempts=1)=>{
  let err=null;
  for(let n=1;n<=attempts;n++){
   const timeLeft=deadline-Date.now();
   if(timeLeft<4500)return {payload:null,error:'TOWER_REQUEST_BUDGET_EXCEEDED：'+stage+'，重試時間預算已用盡'};
   try{
    const timeoutMs=Math.min(stage==='PREFLIGHT'?36000:32000,timeLeft-1200);
    const payload=await fetchBatch(part,profile,{refresh:options.refresh||n>1,timeoutMs,towerNetworkDiagnostic:true});
    return {payload,error:null};
   }catch(e){
    err=String(e?.message||e);problems.push(err);
    if(!towerTransientError(e))break;
    if(n<attempts)await towerPause(350*n);
   }
  }
  return {payload:null,error:err||'Worker 無法回傳'};
 };
 const first=items.length>2&&stage==='PREFLIGHT'?{payload:null,error:'PREFLIGHT_2X2_SPLIT'}:await request(items,1);
 const out=[];
 const getSolo=async(item,precedingError)=>{
  const one=await request([item],2);
  const record=towerSingleRecord([item],one.payload,item);
  if(record?.dataUnavailable===true||record?.ok&&record.data)return record;
  return towerServiceRecord(item,record?.error||one.error||precedingError);
 };
 if(first.payload){
  for(const item of items){
   const r=towerSingleRecord(items,first.payload,item);
   if(r?.dataUnavailable===true||r?.ok&&r.data)out.push(r);
   else out.push(await getSolo(item,r?.error||'Worker 遺漏個股回應'));
  }
 }else{
  // A transport failure must not abort all four probes or eight scan stocks.
  // Split into two-stock requests first, and then isolate only unresolved stocks.
  if(items.length>2){
   for(let i=0;i<items.length;i+=2){
    const part=items.slice(i,i+2),sub=await request(part,1);
    for(const item of part){
     const r=towerSingleRecord(part,sub.payload,item);
     out.push(r?.dataUnavailable===true||r?.ok&&r.data?r:await getSolo(item,r?.error||sub.error||first.error));
    }
   }
  }else{
   for(const item of items)out.push(await getSolo(item,first.error));
  }
 }
 if(out.length!==items.length||new Set(out.map(r=>String(r.code))).size!==items.length)throw Error('TOWER_RESPONSE_INTEGRITY：回傳代號數量不一致');
 if(out.some(x=>!x.ok)&&typeof options.onFailure==='function')options.onFailure({stage,profile,errors:[...new Set([...problems,...out.filter(x=>!x.ok).map(x=>x.error).filter(Boolean)])].slice(-4),failed:out.filter(x=>!x.ok&&x.dataUnavailable!==true).map(x=>x.code),dataUnavailable:out.filter(x=>!x.ok&&x.dataUnavailable===true).map(x=>x.code)});
 return {type:'MOMENTUM_DEEP_SCAN',results:out};
}
// Single shared time budget across the health checker’s two validation rounds.
async function fetchTowerPreflightBatch(items,profile,options={}){
 return fetchTowerReliableBatch(items,profile,{...options,stage:'PREFLIGHT'});
}
async function exportImages(all){const scan=last;if(!scan?.candidates?.length)return;const buttons=[by('towerImage'),by('towerZip')];buttons.forEach(b=>b.disabled=true);try{if(all){const result=await root.ShitouTowerScanExport.zip(scan,(i,n)=>by('towerSummary').textContent=`完整圖片打包 ${i}/${n} 頁`),url=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=url;a.download=`TOWER_GOLD_${scan.date}_${root.ShitouReleaseV50.displayCode}_完整PNG.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);by('towerSummary').textContent=`已打包 ${scan.candidates.length} 檔／${result.audits.length+result.overviewAudits.length} 頁，含總覽、完整診斷、TXT與數量核對。`;}else await root.ShitouTowerScanExport.preview(scan);}catch(e){by('towerSummary').textContent='圖片未完成：'+e.message;}finally{buttons.forEach(b=>b.disabled=false);}}
async function run(){if(running||root.dayTradeScanRunningV1||root.momentumScanRunningV3762||by('strongStockScanButton')?.disabled)return;running=true;stopped=false;last=null;V.reset();by('towerList').innerHTML='';by('towerReportText').textContent='';by('towerCopy').disabled=true;by('towerDownload').disabled=true;by('towerImage').disabled=true;by('towerZip').disabled=true;
 const buttons=['towerRun','momentumScanButton','dayTradeScanButton','strongStockScanButton'].map(by).filter(Boolean),prior=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);by('towerSummary').textContent='核對完整市場與上市上櫃日期…';
 let towerStage='市場完整快照',towerFailures=[];const healthDeadline=Date.now()+110000;
 try{const bundle=await root.loadDayTradeMarketBundleV377736(),market=root.ShitouStrongStockFilterV47.validateMarket(bundle.meta,bundle.snapshotRows);if(!market.ok)throw Error(market.reason);const pool=strong.marketPool(bundle,'all'),health=root.ShitouDeepScanHealthV1;if(!health)throw Error('深掃健康檢查模組未載入');towerStage='DEEP_SCAN 完成日K健康檢查';by('towerSummary').textContent='核對深掃個股日K日期…';const healthAudit=await health.preflight({items:pool.deep,targetDate:market.date,allowPartialService:by('towerProfile').value!=='FAST_A',allowHistoricalZeroData:by('towerProfile').value!=='FAST_A',shouldStop:()=>stopped,fetcher:(items,options)=>fetchTowerPreflightBatch(items,by('towerProfile').value==='FAST_A'?'DAILY_ONLY':by('towerProfile').value,{...options,deadline:healthDeadline,onFailure:f=>{if(f.failed.length){towerFailures.push(f);by('towerSummary').textContent='健康檢查服務重試中｜'+f.failed.join('、');}else by('towerSummary').textContent='健康檢查個股資料不足｜'+(f.dataUnavailable||[]).join('、');}}),onUpdate:message=>{by('towerSummary').textContent=message;}});if(by('towerProfile').value==='FAST_A'&&!root.ShitouTowerFastA)throw Error('方案A模組未載入，不可降級為FULL或默默換模式');towerStage='第四套全量日K資料取得';const excluded=Object.values(pool.audit).reduce((a,b)=>a+b,0);last=await (by('towerProfile').value==='FAST_A'?root.ShitouTowerFastA.scan:S.scan)({items:pool.deep,universe:bundle.snapshotRows,parsed:bundle.map.size,excluded,date:market.date,fetchBatch:(items,profile,opts={})=>fetchTowerReliableBatch(items,profile,{...opts,stage:'SCAN'}),subset:by('towerSubset').value,profile:by('towerProfile').value,marketTower:marketTower?.date===market.date?marketTower:null,shouldStop:()=>stopped,onProgress:s=>{if(s.phase){V.progress({attempted:s.processed,planned:s.planned});by('towerSummary').textContent=`方案A ${s.phase==='FAST'?'輕量初篩':'FULL覆核'} ${s.processed}/${s.planned}｜初篩排除${s.fastRejected}｜待FULL${s.fullNeeded}`;}else{V.progress(s);by('towerSummary').textContent=`深掃 ${s.attempted}/${s.planned}｜成功${s.success}／失敗${s.failed}／資料不足${s.dataUnavailable}`;}}});last.healthAudit=healthAudit;if(healthNote(last))last.text+='\n'+healthNote(last);render(last);}catch(e){const hint=towerFailures.length?'｜已嘗試拆批／逐檔重試，仍失敗：'+towerFailures.at(-1).failed.join('、')+'（'+(towerFailures.at(-1).errors.at(-1)||'資料服務異常')+'）':'';by('towerSummary').textContent='掃描未完成（'+towerStage+'）：'+String(e?.message||e)+hint;}finally{running=false;buttons.forEach((b,i)=>b.disabled=prior[i]);}}
function download(){if(!last)return;const url=URL.createObjectURL(new Blob([exportText(last)],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`TOWER_GOLD_${last.date}_${root.ShitouReleaseV50.displayCode}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function install(){const host=by('strongStockShortcut')||by('strongStockResult');const panel=document.createElement('section');panel.id='towerGoldPanel';panel.className='strong-stock-shortcut tower-gold-control';panel.innerHTML=V.controls();if(host)host.insertAdjacentElement('afterend',panel);else (document.querySelector('main')||document.body).appendChild(panel);by('towerRun').onclick=run;by('towerStop').onclick=()=>{stopped=true;};by('towerCopy').onclick=async()=>{try{if(last)await navigator.clipboard.writeText(exportText(last));}catch(e){by('towerSummary').textContent='剪貼簿不可用；請下載TXT。';}};by('towerDownload').onclick=download;by('towerImage').onclick=()=>exportImages(false);by('towerZip').onclick=()=>exportImages(true);
 panel.addEventListener('click',e=>{const code=e.target.dataset?.towerCode;if(code){const input=by('stockInput');if(input){input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}));input.scrollIntoView({behavior:'smooth'});if(typeof root.analyzeStock==='function')root.analyzeStock();}}});

}
root.ShitouTowerIntegration=Object.freeze({get,run,render,appendScanText,completed,exportImages,getLast:()=>last,getVerifiedDate:()=>verifiedDate,getSnapshot:()=>verifiedSnapshot});
install();
})(typeof window!=='undefined'?window:globalThis);


