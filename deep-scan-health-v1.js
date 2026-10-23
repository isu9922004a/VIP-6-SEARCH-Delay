/* HEALTH.2: isolate failed probes; retain strict date, identity and price checks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ShitouDeepScanHealthV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const normalizeDate=v=>{const m=String(v??'').trim().match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);if(!m)return null;const out=`${m[1]}-${m[2]}-${m[3]}`,d=new Date(out+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===out?out:null;};
const market=item=>String(item?.q?.market||item?.market||'').toUpperCase()==='TPEX'?'TPEX':'TWSE';
const codeOf=x=>String(x?.code||x?.data?.stock||x?.data?.code||'');
function sample(items,maxPerMarket=2){const selected=[],used=new Set();for(const m of ['TWSE','TPEX'])for(const item of items){if(selected.filter(x=>market(x)===m).length>=maxPerMarket)break;if(!item?.code||used.has(String(item.code))||market(item)!==m)continue;selected.push(item);used.add(String(item.code));}return selected;}
function examine(items,payload,targetDate){
 const expected=normalizeDate(targetDate),issues=[];if(!expected)throw Error('深掃健康檢查：市場目標日格式不正確');
 if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('深掃健康檢查：Worker 回傳格式不正確');
 for(const item of items){
  const code=String(item.code),hits=payload.results.filter(x=>codeOf(x)===code),x=hits.length===1?hits[0]:null;
  if(!x?.ok||!x?.data){issues.push({code,kind:x?.dataUnavailable===true?'DATA':'SERVICE',reason:hits.length!==1?'深掃股票未回傳或重複':String(x?.error||x?.reason||'Worker 未回傳有效個股行情')});continue;}
  const r=x.data,returned=String(r.stock||r.code||code),b=Array.isArray(r.canonicalBars)&&r.canonicalBars.length?r.canonicalBars:Array.isArray(r.dailySeries)?r.dailySeries:[],last=b.at(-1);
  if(returned!==code||r.completed===false||r.isComplete===false){issues.push({code,kind:'DATA',reason:'回傳代號不符或上游明示尚未完成日K'});continue;}
  const stockDate=normalizeDate(r.closeDate),barDate=normalizeDate(last?.date),quoteDate=normalizeDate(item.q?.quoteDate);
  if(stockDate!==expected||barDate!==expected||quoteDate!==expected){issues.push({code,kind:'STALE',reason:`市場／個股／日K／市場報價 ${expected}／${stockDate||'-'}／${barDate||'-'}／${quoteDate||'-'}`});continue;}
  const q=Number(item.q?.close),c=Number(last?.close),rClose=Number(r.close);
  if(!(q>0&&c>0&&rClose>0)||Math.abs(q-c)>Math.max(.02,q*.0001)||Math.abs(rClose-c)>Math.max(.02,c*.0001))issues.push({code,kind:'PRICE',reason:`同日市場／日K／報告收盤價未對齊（${q}／${c}／${rClose}）`});
 }
 return {ok:issues.length===0,expected,checked:items.length,issues};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function preflight({items,targetDate,fetcher,attempts=2,delayMs=850,onUpdate=()=>{},allowPartialService=false,allowHistoricalZeroData=false,shouldStop=()=>false}){
 const selection=sample(items),records=new Map();if(!selection.length)throw Error('深掃健康檢查：缺少抽樣股票');
 const expected=normalizeDate(targetDate);if(!expected)throw Error('深掃健康檢查：市場目標日格式不正確');
 const stop=()=>{if(shouldStop())throw Error('使用者停止掃描');};
 let last=null,used=0;
 async function request(part,attempt){
  stop();let payload;
  try{payload=await fetcher(part,{refresh:attempt>1,targetDate:expected,attempt});if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error(payload?.error||'Worker 回傳格式不正確');}
  catch(e){payload={results:part.map(item=>({code:String(item.code),ok:false,error:String(e?.message||e)}))};}
  stop();for(const item of part)records.set(String(item.code),payload.results.filter(x=>codeOf(x)===String(item.code)));
 }
 for(let attempt=1;attempt<=Math.max(1,attempts);attempt++){
  used=attempt;stop();
  const pending=last?selection.filter(item=>last.issues.some(x=>x.code===String(item.code))):selection;
  onUpdate(`DEEP_SCAN 日期健康檢查 ${attempt}/${attempts}：${attempt>1?'逐檔重試':'抽驗'} ${pending.map(x=>x.code).join('、')}，目標 ${expected}`);
  if(attempt===1)await request(pending,attempt);else for(const item of pending)await request([item],attempt);
  last=examine(selection,{type:'MOMENTUM_DEEP_SCAN',results:[...records.values()].flat()},expected);
  if(last.ok)return {...last,attempts:used,sampledCodes:selection.map(x=>String(x.code)),degraded:false};
  if(attempt<attempts){stop();await delay(delayMs);}
 }
 stop();
 const bad=new Set(last.issues.map(x=>x.code)),healthy=selection.filter(item=>!bad.has(String(item.code))),markets=[...new Set(selection.map(market))];
 // Only the scanner with per-stock failure accounting opts in. Only historical zero-volume DATA may be isolated explicitly; invalid/stale prices
 // or a completely unhealthy market still stop the scan. Failed probes are NOT excluded.
 if(allowPartialService&&last.issues.every(x=>x.kind==='SERVICE'||allowHistoricalZeroData&&x.kind==='DATA'&&/日K含零量/.test(x.reason))&&markets.every(m=>healthy.some(item=>market(item)===m))){
  onUpdate(`抽查部分股票資料暫缺（${[...bad].join('、')}）；上市／上櫃已有同日有效樣本，繼續逐檔驗證，異常股票仍計入服務失敗或資料不足。`);
  return {...last,ok:true,degraded:true,attempts:used,sampledCodes:selection.map(x=>String(x.code))};
 }
 const details=last.issues.slice(0,4).map(x=>`${x.code} ${x.kind}：${x.reason}`).join('；');
 const hint=last.issues.some(x=>x.kind!=='SERVICE')?'已停止掃描；日期、價格或資料完整性未通過，不使用過期或不一致日K。請檢查資料來源／快取後重試。':'已停止掃描；服務未回傳足夠有效樣本，無法確認深掃資料健康。請稍後重試或檢查資料服務；這不代表已證實資料過期。';
 throw Error(`DEEP_SCAN 盤後資料健康檢查未通過（${last.issues.length}/${last.checked} 檔抽樣異常，目標日 ${last.expected}）。${details}。${hint}`);
}
return Object.freeze({normalizeDate,sample,examine,preflight});
});
