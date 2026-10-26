/* HEALTH.2: isolate failed probes; retain strict date, identity and price checks. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./selection-data-v2.js'):root.ShitouSelectionDataV2);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ShitouDeepScanHealthV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D){
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
  if(!x?.ok||!x?.data){const failureCode=D.classifyFailure(x);issues.push({code,kind:['SOURCE_UNAVAILABLE','TRANSIENT_SERVICE_ERROR'].includes(failureCode)?'SERVICE':'DATA',failureCode,reason:hits.length!==1?'深掃股票未回傳或重複':String(x?.error||x?.reason||'Worker 未回傳有效個股行情')});continue;}
  const r=x.data,returned=String(r.stock||r.code||code),b=Array.isArray(r.canonicalBars)&&r.canonicalBars.length?r.canonicalBars:Array.isArray(r.dailySeries)?r.dailySeries:[],last=b.at(-1);
  if(returned!==code||r.completed===false||r.isComplete===false){issues.push({code,kind:'DATA',reason:'回傳代號不符或上游明示尚未完成日K'});continue;}
  const stockDate=normalizeDate(r.closeDate),barDate=normalizeDate(last?.date),quoteDate=normalizeDate(item.q?.quoteDate);
  if(stockDate!==expected||barDate!==expected||quoteDate!==expected){issues.push({code,kind:'STALE',reason:`市場／個股／日K／市場報價 ${expected}／${stockDate||'-'}／${barDate||'-'}／${quoteDate||'-'}`});continue;}
  const q=Number(item.q?.close),c=Number(last?.close),rClose=Number(r.close);
  if(!(q>0&&c>0&&rClose>0)||Math.abs(q-c)>Math.max(.02,q*.0001)||Math.abs(rClose-c)>Math.max(.02,c*.0001)){issues.push({code,kind:'PRICE',reason:`同日市場／日K／報告收盤價未對齊（${q}／${c}／${rClose}）`});continue;}
  try{D.validate(r,code);}catch(e){issues.push({code,kind:'DATA',failureCode:D.classifyFailure(e),reason:String(e.message||e)});}
 }
 for(const issue of issues)issue.failureCode=issue.failureCode||(issue.kind==='STALE'?'STALE_DATA':issue.kind==='PRICE'?'SNAPSHOT_CONFLICT':'DATA_INVALID');
 return {ok:issues.length===0,expected,checked:items.length,issues};
}
function verifiedProbeResults(checkedItems,records,issues){
 const failed=new Set(issues.map(x=>String(x.code)));
 const pinned=[];
 for(const item of checkedItems){
  const code=String(item.code);
  if(failed.has(code))continue;
  const hits=records.get(code)||[],hit=hits.length===1?hits[0]:null;
  const report=hit?.data,original=report?.dailyBasisV2,stored=D?.get?.(code);
  // Fake or incomplete preflight responses must NEVER be elevated into reusable research.
  if(!hit?.ok||!report||!original?.snapshotVerified||!original?.latestVolumeReconciled||
     !original?.fingerprint||stored?.fingerprint!==original.fingerprint||
     stored?.date!==original.date||String(report.stock||report.code||'')!==code)continue;
  pinned.push({code,ok:true,data:report});
 }
 return pinned;
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function preflight({items,targetDate,fetcher,attempts=2,delayMs=850,onUpdate=()=>{},allowPartialService=false,allowHistoricalZeroData=false,allowPartialData=false,shouldStop=()=>false}){
 attempts=Math.min(3,Math.max(1,Math.floor(Number(attempts)||1)));delayMs=Math.min(2000,Math.max(0,Number(delayMs)||0));
 const bound=D.getSnapshot();
 if(!bound||bound.date!==normalizeDate(targetDate))throw Object.assign(Error('深掃健康檢查：全市場快照無效或尚未驗證'),{failureCode:'SYSTEMIC_FAILURE'});
 const selection=sample(items),records=new Map(),checkedItems=[...selection];if(!selection.length)throw Error('深掃健康檢查：缺少抽樣股票');
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
  stop();
  const pending=last?selection.filter(item=>last.issues.some(x=>x.code===String(item.code)&&x.failureCode==='TRANSIENT_SERVICE_ERROR')):selection;
  if(!pending.length)break;
  used=attempt;
  onUpdate(`DEEP_SCAN 日期健康檢查 ${attempt}/${attempts}：${attempt>1?'逐檔重試':'抽驗'} ${pending.map(x=>x.code).join('、')}，目標 ${expected}`);
  if(attempt===1)await request(pending,attempt);else for(const item of pending)await request([item],attempt);
  last=examine(selection,{type:'MOMENTUM_DEEP_SCAN',results:[...records.values()].flat()},expected);
  if(last.ok&&[...new Set(items.map(market))].every(m=>selection.filter(x=>market(x)===m).length>=2))return {...last,attempts:used,sampledCodes:selection.map(x=>String(x.code)),degraded:false,fullMarketCertified:false,verifiedProbeResults:verifiedProbeResults(checkedItems,records,last.issues)};
  if(attempt<attempts){stop();await delay(delayMs);}
 }
 stop();
 // HEALTH-SAMPLE-ROTATE: an individual corrupt history / missing unit contract is not
 // proof that the entire TWSE or TPEx service failed. Probe different stocks in that
 // SAME market, but keep EVERY invalid stock failed and never alter its OHLCV.
 // No relaxation for systemic snapshot failures, cross-date or price inconsistencies.
 const systemicConflict=()=>last.issues.filter(x=>x.kind==='STALE'||x.kind==='PRICE').length>=2;
 if(allowPartialService&&allowPartialData&&last.issues.length&&!systemicConflict()){
  const excluded=new Set(checkedItems.map(x=>String(x.code)));
  const healthyCount=m=>checkedItems.filter(item=>market(item)===m&&!last.issues.some(e=>e.code===String(item.code))).length;
  for(const m of ['TWSE','TPEX']){
   let extra=0;
   while(healthyCount(m)<2&&extra<3){
    stop();const alternate=items.find(item=>item?.code&&!excluded.has(String(item.code))&&market(item)===m);
    if(!alternate)break;
    excluded.add(String(alternate.code));checkedItems.push(alternate);extra++;
    onUpdate(`DEEP_SCAN ${m} 抽樣補位：${alternate.code}（原異常股票仍列資料不足／服務失敗）`);
    await request([alternate],2);
    last=examine(checkedItems,{type:'MOMENTUM_DEEP_SCAN',results:[...records.values()].flat()},expected);
    if(systemicConflict())break;
   }
  }
 }
 stop();
 const bad=new Set(last.issues.map(x=>x.code)),healthy=checkedItems.filter(item=>!bad.has(String(item.code))),markets=[...new Set(selection.map(market))];
 const isolated=!systemicConflict()&&last.issues.every(x=>x.kind==='SERVICE'||allowPartialData||x.kind==='DATA'&&allowHistoricalZeroData&&/日K含零量/.test(x.reason));
 const marketQuorum=markets.every(m=>healthy.filter(item=>market(item)===m).length>=2);
 // A market-wide failure, unknown date, bad OHLC, or absent independent verified
 // peer remains a hard stop. Partial scan is never certified as full-market.
 if(allowPartialService&&isolated&&marketQuorum){
  onUpdate(`抽樣個別資料異常（${[...bad].join('、')}），上市／上櫃各有至少兩檔同日健康樣本；繼續逐檔嚴格驗證。異常股票不視為通過，全市場排名不得認證。`);
  return {...last,ok:true,degraded:true,fullMarketCertified:false,attempts:used,verifiedProbes:healthy.length,sampledCodes:checkedItems.map(x=>String(x.code)),quarantinedCodes:[...bad],verifiedProbeResults:verifiedProbeResults(checkedItems,records,last.issues)};
 }
 const details=last.issues.slice(0,4).map(x=>`${x.code} ${x.kind}：${x.reason}`).join('；');
 const hint=last.issues.some(x=>x.kind!=='SERVICE')?'已停止掃描；個股資料異常且無足夠同市場健康替代樣本。日期、價格或資料完整性未通過時不使用該檔日K，請檢查Worker來源契約及快取。':'已停止掃描；服務未回傳足夠有效樣本，無法確認深掃資料健康。請稍後重試或檢查資料服務；這不代表已證實資料過期。';
 throw Object.assign(Error(`DEEP_SCAN 盤後資料健康檢查未通過（${last.issues.length}/${last.checked} 檔抽樣異常，目標日 ${last.expected}）。${details}。${hint}`),{failureCode:'SYSTEMIC_FAILURE',issues:last.issues});
}
async function fetchWithQuarantine(items,audit,fetcher){
 const bad=new Set(audit?.quarantinedCodes||[]),healthy=items.filter(x=>!bad.has(String(x.code)));
 const payload=healthy.length?await fetcher(healthy):{type:'MOMENTUM_DEEP_SCAN',results:[]};
 return {...payload,results:[...(payload.results||[]).filter(x=>!bad.has(codeOf(x))),...items.filter(x=>bad.has(String(x.code))).map(x=>{const failureCode=audit.issues?.find(e=>e.code===String(x.code))?.failureCode||'DATA_INVALID',dataUnavailable=!['SOURCE_UNAVAILABLE','TRANSIENT_SERVICE_ERROR'].includes(failureCode);return {code:String(x.code),ok:false,dataUnavailable,failureKind:dataUnavailable?'DATA':'SERVICE',failureCode,retryable:false,error:'健康檢查已隔離；本輪不進入正式排名'};})]};
}
return Object.freeze({normalizeDate,sample,examine,preflight,fetchWithQuarantine});
});
