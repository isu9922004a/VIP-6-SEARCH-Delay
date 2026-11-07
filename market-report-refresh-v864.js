/* Refresh the approved market picture from complete, dated Worker snapshots. Never combine dates. */
(function(root){'use strict';
const INTERVAL=300000;let pending=null,lastAttempt=0,lastResult=null;
const current=()=>typeof lastMarketReportData!=='undefined'?lastMarketReportData:null;
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>!/^(generatedAt|fetchedAt|retrievedAt|updatedAt|requestId|cacheHit|cacheAge|timestamp)$/i.test(k)).map(k=>[k,stable(value[k])]));return value;}
function fingerprint(value){return JSON.stringify(stable(value));}
async function json(url,fetcher){let error;for(let attempt=0;attempt<2;attempt++){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetcher(url,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){error=e;}finally{clearTimeout(timer);}}throw error;}
// The main page and its PNG now consume the same verified, completed index snapshot.
// Reuse the original Worker calculator as a static ES module; no second ABC/N engine or API call.
function valid(data){return !!data&&data.index==='TAIEX'&&data.completed===true&&data.dailySeriesMeta?.onlyCompletedBars===true&&/^\d{4}-\d{2}-\d{2}$/.test(data.closeDate||'')&&Number.isFinite(data.close)&&data.close>0;}
function verifyHistory(history,now=new Date()){
 if(history?.instrumentType!=='TAIEX'||history.symbol!=='TAIEX'||history.market!=='TWSE_INDEX'||history.volumeUnit!=='shares'||history.provenance==='ILLUSTRATION')throw Error('大盤行情身分或成交量單位尚未核對');
 const checked=root.ShitouStructureContext?.confirmationInput(history);
 if(!checked?.ok||!checked.volumeUsable||checked.bars.length<80||checked.bars.some(b=>!(b.volume>0)||b.completed===false)||history.dailySeriesMeta?.volumeFetchError)throw Error(checked?.reason||'大盤完整日K與成交量尚未核對');
 const status=root.ShitouMarketFreshness?.historyStatus(history,now),today=root.ShitouMarketFreshness?.taipei(now).date,calendar=history.tradingCalendar;
 if(!status?.expectedDate||calendar.dates.at(-1)<today||history.closeDate>today||status.stale)throw Error(status?.message||'尚未核對最近完成交易日');
 if(history.dailySeriesMeta.lastDate!==history.closeDate||history.close!==history.dailySeries.at(-1).close)throw Error('行情日期、收盤與日K未對齊');
 return status;
}
async function fromHistory(history,{now,calculator}={}){
 const status=verifyHistory(history,now);
 const build=calculator||(await import('./market-worker.mjs?v=V8.7-MARKETFRESH1')).buildTaiexReportFromHistory;
 const report=build({rows:history.dailySeries,dailySeries:history.dailySeries,dailySeriesMeta:history.dailySeriesMeta});
 // Evidence belongs to this exact history, never to an earlier Worker response.
 Object.assign(report,{version:(root.ShitouReleaseV50?.displayCode||'V8.7')+'｜已核驗大盤歷史重算',historyMonthsRequested:null,completed:true,volumeUnit:history.volumeUnit,priceAdjustment:history.priceAdjustment,tradingCalendar:history.tradingCalendar,sourceReceipt:history.sourceReceipt,reportOrigin:'VERIFIED_INDEX_SNAPSHOT',calculationWindowBars:history.dailySeries.length});
 report.dailySeriesMeta={...history.dailySeriesMeta};
 report.logic={...report.logic,historyWindow:`使用這份已核驗的 ${history.dailySeries.length} 根完成日K；不沿用舊服務的指標或ABC價位。`};
 if(!valid(report)||report.closeDate!==history.closeDate||report.close!==history.close)throw Error('大盤計算結果與行情不一致');
 return {report,status};
}
function refresh({fetcher=root.fetch?.bind(root),now,calculator}={}){
 if(pending)return pending;const previous=current();lastAttempt=Date.now();
 pending=(async()=>{try{
  const mirror=new URL('./data/index/TAIEX.json',document.baseURI);mirror.searchParams.set('_report_update',Date.now());
  const history=await json(mirror,fetcher);
  if(previous&&history?.closeDate<previous.closeDate)throw Error(`服務返回較早資料，保留 ${previous.closeDate} 盤後。`);
  const {report:incoming,status}=await fromHistory(history,{now,calculator});
  if(current()!==previous)return {changed:false,ready:false,notice:'查詢已切換，略過舊請求。'};
  if(previous&&incoming.closeDate<previous.closeDate)throw Error(`服務返回較早資料，保留 ${previous.closeDate} 盤後。`);
  const changed=fingerprint(incoming)!==fingerprint(previous);
  if(changed){lastMarketReportData=incoming;if(typeof renderMarketWorkerData==='function')renderMarketWorkerData(incoming);}
  root.ShitouElliottVisual?.bindIndex?.(current(),history);
  return lastResult={changed,ready:true,notice:'',data:current(),checkedAt:Date.now(),expectedDate:status.expectedDate};
 }catch(e){return lastResult={changed:false,ready:false,data:current(),notice:`最新行情暫未核對，暫用畫面所示日期的資料。${e.message}`,error:e.message,checkedAt:Date.now()};}finally{pending=null;}})();return pending;
}
async function checkVisible(){
 if(!current()||document.visibilityState==='hidden')return null;
 const modal=document.getElementById('imagePreviewModal'),epoch=root.ShitouReportPreviewEpoch;
 if(modal?.classList.contains('show')&&modal.dataset.marketReader==='true')modal.dataset.marketExportBlocked='true';
 const result=await refresh();
 if(modal?.classList.contains('show')&&modal.dataset.marketReader==='true'){
  modal.dataset.marketFreshnessNotice=result.notice||'';
  modal.dataset.marketExportBlocked=String(!result.ready);
  const note=document.getElementById('imagePreviewNote');if(note&&!result.ready)note.textContent='暫停下載與分享：'+result.notice;
 }
 if(result.ready&&modal?.classList.contains('show')&&modal.dataset.marketReader==='true'&&epoch===root.ShitouReportPreviewEpoch&&current()===result.data&&(result.changed||(modal.dataset.marketFreshnessNotice||'')!==result.notice)){
  const view=modal.dataset.marketView,scroll=modal.scrollTop;
  await root.generateMarketInfographicV3328(modal.dataset.marketWatermarked==='true',{recheck:false,notice:result.notice});
  if(current()===result.data&&modal.classList.contains('show')&&modal.dataset.marketReader==='true'&&root.ShitouReportPreviewEpoch===epoch+1){modal.dataset.marketView=view;modal.scrollTop=scroll;const toggle=document.getElementById('marketReaderToggle');if(toggle){toggle.textContent=view==='reading'?'完整圖片':'文字閱讀';toggle.setAttribute('aria-pressed',String(view==='reading'));}}
 }
 return result;
}
function onFocus(){if(Date.now()-lastAttempt>60000)checkVisible().catch(()=>{});}
if(root.addEventListener){root.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);
 document.addEventListener('click',event=>{
  const control=event.target.closest?.('#imageDownloadLink,#imageShareButton,#lineShareSave,#r45PreviewZip'),modal=document.getElementById('imagePreviewModal');
  if(control&&modal?.classList.contains('show')&&modal.dataset.marketReader==='true'&&modal.dataset.marketExportBlocked==='true'){
   event.preventDefault();event.stopImmediatePropagation();const note=document.getElementById('imagePreviewNote');if(note)note.textContent='最新行情尚未核對，請重新載入大盤後再下載或分享。';
  }
 },true);setInterval(()=>checkVisible().catch(()=>{}),INTERVAL);}
const api={refresh,checkVisible,fingerprint,valid,verifyHistory,fromHistory,intervalMs:INTERVAL,getStatus:()=>lastResult};root.ShitouMarketReportRefresh=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
