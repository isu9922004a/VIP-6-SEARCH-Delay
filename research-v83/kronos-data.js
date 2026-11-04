/* Same-origin, same-history Kronos results only. Missing or stale data stays unavailable. */
(function(root){'use strict';
const states=new Map(),BASE=new URL('../',document.currentScript.src),F=root.ShitouForecastPreview;
let catalog=null,catalogAt=0;
function catalogFor(){if(!catalog||Date.now()-catalogAt>600000){catalogAt=Date.now();catalog=json('data/kronos/manifest.json').catch(e=>{catalog=null;throw e;});}return catalog;}
const key=a=>[a.code,a.validation?.market,a.date,a.kronosInput?F.signature(a.kronosInput.bars):a.sourceSnapshotId].join('|');
function isFresh(f,now=new Date()){if(f?.kind!=='KRONOS_INFERENCE'||!f.targetDates?.length)return false;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now),get=k=>parts.find(p=>p.type===k)?.value,today=[get('year'),get('month'),get('day')].join('-');return f.targetDates[0]>today||f.targetDates[0]===today&&Number(get('hour'))<15;}
const transient=e=>e?.temporary===true||['AbortError','TimeoutError','TypeError','SyntaxError'].includes(e?.name)||/fetch.*abort|failed to fetch|load failed|network|timed? ?out/i.test(String(e?.message||''));
const pause=ms=>new Promise(resolve=>typeof root.setTimeout==='function'?root.setTimeout(resolve,ms):resolve());
function timeout(){if(typeof root.AbortSignal?.timeout==='function')return {signal:root.AbortSignal.timeout(15000),clear(){}};const controller=new root.AbortController(),timer=root.setTimeout(()=>controller.abort(),15000);return {signal:controller.signal,clear:()=>root.clearTimeout(timer)};}
async function json(relative){
 for(let attempt=1;attempt<=2;attempt++){
  const clock=timeout();
  try{const response=await fetch(new URL(relative,BASE),{cache:'no-store',signal:clock.signal,headers:{Accept:'application/json'}});
   if(!response.ok){const e=Error(response.status===404?'尚無此個股本期模型結果。':'模型資料暫時無法取得。');e.temporary=response.status===408||response.status===429||response.status>=500;throw e;}
   return await response.json();
  }catch(e){if(!transient(e))throw e;if(attempt<2){await pause(300);continue;}const failure=Error('模型資料載入中斷或逾時，已自動重試；請按「重新載入模型」再試一次。');failure.temporary=true;throw failure;
  }finally{clock.clear();}
 }
}
function statusFor(a){const s=states.get(key(a));return {status:s?.status||'NOT_REQUESTED',retryable:s?.status==='TEMPORARY_ERROR',reason:s?.reason||''};}
function cachedHistory(a){const H=root.ShitouOfficialResearchHistory;try{const h=H?.get(a.code,a.date);return h&&H.proof(h)?h:null;}catch(_){return null;}}

function reasonFor(a){return states.get(key(a))?.reason||(a?.validation?.technicalModelAvailable!==true?'行情尚未通過核對：'+(a?.validation?.validationErrors?.join('；')||a?.evidenceDiagnostics?.acquisitionError||'完整日K尚未同步')+'。自動更新完成後請重新查詢。':'尚未取得此個股自己的Kronos結果，等待本期自動更新。');}
async function ensure(a){if(!a||!/^\d{4,6}$/.test(String(a.code))||a.validation?.technicalModelAvailable!==true&&a.validation?.modelInputAvailable!==true)return false;const k=key(a),old=states.get(k);if(old?.promise)return old.promise;if(old?.ready===true&&Date.now()-old.at<600000&&isFresh(old.forecast))return true;const state={at:Date.now(),status:'LOADING',reason:'正在載入並核對此個股的模型資料。'};states.set(k,state);state.promise=(async()=>{try{const list=await catalogFor(),entry=list.stocks?.[a.code];if(!entry||entry.asOf!==a.date){catalog=null;catalogAt=0;throw Error(list.asOf===a.date&&list.unavailable?.[a.code]?'本期模型暫不可用：'+list.unavailable[a.code]:`行情基準 ${a.date}；模型基準 ${entry?.asOf||'尚無'}。等待同日行情與模型自動更新後，請重新查詢。`);}const cached=cachedHistory(a),[history,forecast]=await Promise.all([cached?Promise.resolve(cached):json('data/research/'+a.date+'/'+a.code+'.json'),json('data/kronos/stocks/'+a.code+'.json')]);if(forecast.kind!=='KRONOS_INFERENCE'||forecast.model?.id!=='NeoQuasar/Kronos-small'||forecast.tokenizer?.id!=='NeoQuasar/Kronos-Tokenizer-base'||forecast.codeCommit!=='67b630e67f6a18c9e9be918d9b4337c960db1e9a')throw Error('模型來源或版本未核對，不採用。');if(!isFresh(forecast))throw Error('此模型結果已過期，等待收盤後自動更新下一期；完成後請重新查詢。');const input=a.kronosInput;if(!input||input.symbol!==String(a.code)||input.market!==a.validation.market||input.asOf!==a.date||String(history.stock)!==input.symbol||history.market!==input.market||history.closeDate!==input.asOf)throw Error('模型與目前查詢的股票、市場或日期不同，暫不採用。');const expected=F.inputWindow?F.inputWindow(history.dailySeries).bars:Array.isArray(history.dailySeries)?history.dailySeries.slice(-160):[];if(expected.length<63||input.bars.length!==expected.length||input.bars.length>160)throw Error(`模型需63～160根已核驗日線；官方${expected.length}根、本次查詢${input.bars.length}根，歷史長度未對齊。`);if(F.signature(input.bars)!==F.signature(expected))throw Error(`模型使用的近${expected.length}根日線與本次查詢不同，暫不採用；請更新行情後重新查詢。`);const registered=F.register(input,forecast);if(!registered.ok)throw Error(registered.reason);state.reason='';state.ready=true;state.forecast=forecast;state.status='READY';state.at=Date.now();return true;}catch(e){state.status=e.temporary===true?'TEMPORARY_ERROR':'UNAVAILABLE';state.reason=e.message;return false;}finally{state.promise=null;}})();return state.promise;}
root.ShitouKronosData=Object.freeze({ensure,isFresh,reasonFor,statusFor});
})(globalThis);


