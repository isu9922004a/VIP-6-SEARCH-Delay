/* Refresh the approved market picture from complete, dated Worker snapshots. Never combine dates. */
(function(root){'use strict';
const INTERVAL=300000;let pending=null,lastAttempt=0,lastResult=null;
const current=()=>typeof lastMarketReportData!=='undefined'?lastMarketReportData:null;
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>!/^(generatedAt|fetchedAt|retrievedAt|updatedAt|requestId|cacheHit|cacheAge|timestamp)$/i.test(k)).map(k=>[k,stable(value[k])]));return value;}
function fingerprint(value){return JSON.stringify(stable(value));}
async function json(url,fetcher){let error;for(let attempt=0;attempt<2;attempt++){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetcher(url,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){error=e;}finally{clearTimeout(timer);}}throw error;}
function valid(data){return data?.completed!==false&&data?.dailySeriesMeta?.onlyCompletedBars!==false&&String(data?.index||'').toUpperCase()==='TAIEX'&&/^\d{4}-\d{2}-\d{2}$/.test(data.closeDate||'')&&data.close!==null&&data.close!==''&&Number.isFinite(Number(data.close))&&Number(data.close)>0;}
function refresh({fetcher=root.fetch?.bind(root)}={}){
 if(pending)return pending;const previous=current();if(!previous)return Promise.resolve({changed:false,ready:false,notice:'請先完成大盤分析。'});
 lastAttempt=Date.now();
 pending=(async()=>{try{
  const endpoint=typeof MARKET_API_BASE_URL!=='undefined'?MARKET_API_BASE_URL:'https://shitou-taiwanmarket-api.d318426.workers.dev',url=new URL(endpoint);url.searchParams.set('market','TAIEX');url.searchParams.set('_report_update',Date.now());
  const mirror=new URL('./data/index/TAIEX.json',document.baseURI);mirror.searchParams.set('_report_update',Date.now());
  const [worker,official]=await Promise.allSettled([json(url,fetcher),json(mirror,fetcher)]);
  if(worker.status!=='fulfilled'||!valid(worker.value))throw Error('完整大盤行情暫未載入');
  if(current()!==previous)return {changed:false,ready:false,notice:'查詢已切換，略過舊請求。'};
  const incoming=worker.value;let notice='';
  if(incoming.closeDate<previous.closeDate)return lastResult={changed:false,ready:false,data:previous,notice:`服務返回較早資料，保留 ${previous.closeDate} 盤後。`};
  if(official.status==='fulfilled'){
   const history=official.value,timeliness=root.ShitouMarketFreshness?.historyStatus(history),expected=[history.closeDate,timeliness?.expectedDate].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')).sort().at(-1);
   if(expected&&incoming.closeDate<expected)notice=`盤後資料應至 ${expected}，目前仍為 ${incoming.closeDate}。`;
  }else notice='官方日期暫未核對；目前顯示資料的實際日期。';
  const changed=fingerprint(incoming)!==fingerprint(previous);
  if(changed){lastMarketReportData=incoming;if(typeof renderMarketWorkerData==='function')renderMarketWorkerData(incoming);}
  lastResult={changed,ready:!notice,notice,data:current(),checkedAt:Date.now()};return lastResult;
 }catch(e){lastResult={changed:false,ready:false,data:current(),notice:'最新行情暫未核對，暫用畫面所示日期的資料。',error:e.message,checkedAt:Date.now()};return lastResult;}finally{pending=null;}})();return pending;
}
async function checkVisible(){
 if(!current()||document.visibilityState==='hidden')return null;
 const modal=document.getElementById('imagePreviewModal'),epoch=root.ShitouReportPreviewEpoch,result=await refresh();
 if(modal?.classList.contains('show')&&modal.dataset.marketReader==='true'&&epoch===root.ShitouReportPreviewEpoch&&current()===result.data&&(result.changed||(modal.dataset.marketFreshnessNotice||'')!==result.notice)){
  const view=modal.dataset.marketView,scroll=modal.scrollTop;
  await root.generateMarketInfographicV3328(modal.dataset.marketWatermarked==='true',{recheck:false,notice:result.notice});
  if(current()===result.data&&modal.classList.contains('show')&&modal.dataset.marketReader==='true'&&root.ShitouReportPreviewEpoch===epoch+1){modal.dataset.marketView=view;modal.scrollTop=scroll;const toggle=document.getElementById('marketReaderToggle');if(toggle){toggle.textContent=view==='reading'?'完整圖片':'文字閱讀';toggle.setAttribute('aria-pressed',String(view==='reading'));}}
 }
 return result;
}
function onFocus(){if(Date.now()-lastAttempt>60000)checkVisible().catch(()=>{});}
if(root.addEventListener){root.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);setInterval(()=>checkVisible().catch(()=>{}),INTERVAL);}
const api={refresh,checkVisible,fingerprint,valid,intervalMs:INTERVAL,getStatus:()=>lastResult};root.ShitouMarketReportRefresh=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
