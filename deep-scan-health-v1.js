/* SHADOW.5.1 | DEEP_SCAN preflight. No strategy, rankings or quote values are changed. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ShitouDeepScanHealthV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const normalizeDate=v=>{const m=String(v??'').trim().match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;};
const market=item=>String(item?.q?.market||item?.market||'').toUpperCase()==='TPEX'?'TPEX':'TWSE';
function sample(items,maxPerMarket=2){
  const selected=[],used=new Set();
  for(const m of ['TWSE','TPEX']){
    for(const item of items){
      if(selected.filter(x=>market(x)===m).length>=maxPerMarket)break;
      if(!item?.code||used.has(item.code)||market(item)!==m)continue;
      selected.push(item);used.add(item.code);
    }
  }
  return selected;
}
function examine(items,payload,targetDate){
  const expected=normalizeDate(targetDate),issues=[];
  if(!expected)throw Error('深掃健康檢查：市場目標日格式不正確');
  if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('深掃健康檢查：Worker 回傳格式不正確');
  for(const item of items){
    const hits=payload.results.filter(x=>String(x?.code||x?.data?.stock||x?.data?.code||'')===item.code);
    const x=hits.length===1?hits[0]:null;
    if(!x?.ok||!x?.data){issues.push({code:item.code,kind:'SERVICE',reason:hits.length!==1?'深掃股票未回傳或重複':'Worker 未回傳有效個股行情'});continue;}
    const r=x.data,b=(Array.isArray(r.canonicalBars)&&r.canonicalBars.length?r.canonicalBars:Array.isArray(r.dailySeries)?r.dailySeries:[]),last=b.at(-1);
    const stockDate=normalizeDate(r.closeDate),barDate=normalizeDate(last?.date),quoteDate=normalizeDate(item.q?.quoteDate);
    if(stockDate!==expected||barDate!==expected||quoteDate!==expected){
      issues.push({code:item.code,kind:'STALE',reason:`市場／個股／日K／市場報價 ${expected}／${stockDate||'-'}／${barDate||'-'}／${quoteDate||'-'}`});continue;
    }
    const q=Number(item.q?.close),c=Number(last?.close),rClose=Number(r.close);
    if(!(q>0&&c>0&&rClose>0)||Math.abs(q-c)>Math.max(.02,q*.0001)||Math.abs(rClose-c)>Math.max(.02,c*.0001))
      issues.push({code:item.code,kind:'PRICE',reason:`同日市場／日K／報告收盤價未對齊（${q}／${c}／${rClose}）`});
  }
  return {ok:issues.length===0,expected,checked:items.length,issues};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function preflight({items,targetDate,fetcher,attempts=2,delayMs=850,onUpdate=()=>{}}){
  const selection=sample(items);
  if(!selection.length)throw Error('深掃健康檢查：缺少抽樣股票');
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    onUpdate(`DEEP_SCAN 日期健康檢查 ${attempt}/${attempts}：抽驗 ${selection.map(x=>x.code).join('、')}，目標 ${targetDate}`);
    try{last=examine(selection,await fetcher(selection,{refresh:attempt>1,targetDate,attempt}),targetDate);}
    catch(e){last={ok:false,checked:selection.length,expected:normalizeDate(targetDate),issues:[{code:'Worker',kind:'SERVICE',reason:String(e?.message||e)}]};}
    if(last.ok)return {...last,attempts:attempt,sampledCodes:selection.map(x=>x.code)};
    if(attempt<attempts)await delay(delayMs);
  }
  const details=last.issues.slice(0,4).map(x=>`${x.code} ${x.kind}：${x.reason}`).join('；');
  throw Error(`DEEP_SCAN 盤後資料健康檢查未通過（${last.issues.length}/${last.checked} 檔抽樣異常，目標日 ${last.expected}）。${details}。已停止全量掃描，避免將過期日K誤作本交易日；請檢查並更新 Cloudflare Worker 的日K資料來源／快取，再重試。`);
}
return Object.freeze({normalizeDate,sample,examine,preflight});
});
