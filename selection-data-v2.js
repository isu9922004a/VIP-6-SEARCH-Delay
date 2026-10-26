/* One DAILY_ONLY history per verified market snapshot and stock, shared by all four scanners.
 * Never infer completion merely from a date. No private Stock Digger API is used.
 */
(function(root,factory){const E=typeof module==='object'&&module.exports?require('./selection-evidence-v1.js'):root.ShitouSelectionEvidenceV1;const api=factory(E);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouSelectionDataV2=api;})(globalThis,function(E){
'use strict';
const MODEL='CANONICAL_DAILY_ONLY_REVIEW_2',cache=new Map(),pending=new Map(),months=new Map();let snapshot=null,fetcher=null;
const C=typeof module==='object'&&module.exports?require('./worker-data-contract-v1.js'):globalThis.ShitouWorkerDataContractV1;
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function classifyFailure(record){
 const message=String(record?.error||record?.reason||record?.message||record||'');
 const allowed=['DATA_INVALID','SOURCE_UNAVAILABLE','TRANSIENT_SERVICE_ERROR','STALE_DATA','SNAPSHOT_CONFLICT','HISTORY_CONFLICT','INSUFFICIENT_HISTORY','SYSTEMIC_FAILURE'];
 if(allowed.includes(record?.failureCode))return record.failureCode;
 if(/同一快照收到不同歷史|HISTORY_CONFLICT|歷史版本衝突/.test(message))return 'HISTORY_CONFLICT';
 if(/快照已改變|SNAPSHOT_CONFLICT|市場.*(?:OHLC|收盤價|價格).*未對齊/.test(message))return 'SNAPSHOT_CONFLICT';
 if(/SOURCE_UNAVAILABLE|NO_HISTORY|來源無法|來源不可用/.test(message))return 'SOURCE_UNAVAILABLE';
 if(/HISTORY_TOO_SHORT|INSUFFICIENT_HISTORY|HISTORY_GAP|歷史.*不足|需至少/.test(message))return 'INSUFFICIENT_HISTORY';
 if(/日期.*(?:不一致|不符)|STALE_DATA|HISTORY_AHEAD/.test(message))return 'STALE_DATA';
 if(/SOURCE_UNAVAILABLE|NO_HISTORY|來源無法|來源不可用/.test(message))return 'SOURCE_UNAVAILABLE';
 if(record?.dataUnavailable===true||/資料不足｜|共用日K[：:]|DATA_INVALID|契約|OHLC|成交量單位/.test(message))return 'DATA_INVALID';
 return 'TRANSIENT_SERVICE_ERROR';
}
const num=E? v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null:()=>null;
const fail=reason=>{throw Error('資料不足｜共用日K：'+reason);};
function isDataFailure(record){
 const reason=typeof record==='string'?record:String(record?.error||record?.reason||'');
 if(['SOURCE_UNAVAILABLE','TRANSIENT_SERVICE_ERROR'].includes(record?.failureCode)||/SOURCE_UNAVAILABLE/.test(reason))return false;
 if(['DATA_INVALID','STALE_DATA','SNAPSHOT_CONFLICT','HISTORY_CONFLICT','INSUFFICIENT_HISTORY','SYSTEMIC_FAILURE'].includes(record?.failureCode))return true;
 return record?.dataUnavailable===true||/\b(?:DATA_HISTORY_GAP|HISTORY_AHEAD_OF_OFFICIAL_SNAPSHOT|HISTORY_TOO_SHORT|INSUFFICIENT_HISTORY|NO_HISTORY|DATA_UNAVAILABLE|HISTORY_GAP_[A-Z_]+|CLOSED_BAR_[A-Z_]+)\b|資料不足｜|共用日K[：:]/i.test(reason);
}
function failureRecord(record){if(!record||record.ok)return record;const failureCode=classifyFailure(record),data=!['SOURCE_UNAVAILABLE','TRANSIENT_SERVICE_ERROR'].includes(failureCode);return {...record,failureCode,dataUnavailable:data,failureKind:data?'DATA':'SERVICE',retryable:failureCode==='TRANSIENT_SERVICE_ERROR'};}

const market=v=>String(v||'').toUpperCase()==='TPEX'?'TPEX':String(v||'').toUpperCase()==='TWSE'?'TWSE':null;
function fingerprint(rows){const text=JSON.stringify(rows);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return rows.length+'-'+(h>>>0).toString(16);}
function inspectSnapshot(bundle){
 const meta=bundle?.meta||{},dates=[meta.targetTradeDate,meta.completedTradeDate,meta.expectedTradeDate,meta.twseQuoteDate,meta.tpexQuoteDate].map(E.date);
 const issues=[],names=['目標交易日','完成交易日','預期交易日','上市報價日','上櫃報價日'],isMap=bundle?.map instanceof Map,total=num(meta.total),rows=num(bundle?.snapshotRows??bundle?.map?.size);
 if(meta.marketCoverageReady!==true)issues.push('上市／上櫃完整性未通過');
 if(meta.industryCoverageReady!==true)issues.push('產業覆蓋未通過');
 if(meta.snapshotTimelinessReady!==true)issues.push('最新交易日核對未通過（snapshotTimelinessReady）');
 dates.forEach((d,i)=>{if(!d)issues.push(names[i]+'缺失或無效');});
 if(dates.every(Boolean)&&new Set(dates).size!==1)issues.push('交易日不一致：'+dates.join('／'));
 if(!isMap)issues.push('市場快照Map未提供');
 if(total!==rows)issues.push(`原始快照筆數不符：宣告 ${meta.total??'未提供'}／收到 ${rows??'未提供'}`);
 if(isMap&&(bundle.map.size>total||bundle.map.size===0))issues.push(`有效快照筆數異常：${bundle.map.size}／${meta.total??'未提供'}`);
 return {ok:issues.length===0,date:dates[0],issues,source:meta.source||bundle?.source||'未提供',total,rows,parsed:isMap?bundle.map.size:null};
}
function bind(bundle){
 const audit=inspectSnapshot(bundle);if(!audit.ok)fail('市場快照完整性、最新交易日或筆數未通過｜'+audit.issues.join('；'));
 const meta=bundle.meta,dates=[audit.date];
 const map=new Map();for(const [code,q] of bundle.map){const m=market(q.market);if(!m)fail('市場別缺失 '+code);if(q.volumeUnit&&!['shares','股'].includes(q.volumeUnit))fail('市場成交量單位衝突 '+code);if(q.quoteDate&&E.date(q.quoteDate)!==dates[0])fail('市場報價日期衝突 '+code);map.set(String(code),C.auditQuote({...q,market:m,quoteDate:dates[0],volumeUnit:'shares'}));}
 const identity=dates[0]+'|'+fingerprint([...map].sort(([a],[b])=>a.localeCompare(b)).map(([code,q])=>[code,q.market,q.quoteDate,q.open,q.high,q.low,q.close,q.volume,q.tradeValue,q.volumeSource,q.volumeScope,q.tradeValueScope]))+'|'+String(meta.snapshotContentSha256||meta.snapshotGeneratedAt||'');
 // A corrected same-date market snapshot is a NEW identity. Old history cannot be reused.
 if(snapshot?.identity!==identity){cache.clear();pending.clear();months.clear();}
 snapshot={date:dates[0],identity,map,meta};globalThis.ShitouPriceActionIntegration?.bind(snapshot);try{globalThis.ShitouResearchIntegration?.bind(snapshot);}catch(e){console.warn("研究快照未綁定",e);}return {...bundle,map};
}
function context(code){const q=snapshot?.map.get(String(code));if(!q)fail('尚未取得此股票同日市場快照 '+code);return {q,date:snapshot.date,key:[snapshot.identity,String(code),q.market,q.open,q.high,q.low,q.close,q.volume].join('|')};}
function get(code){try{return cache.get(context(code).key)||null;}catch{return null;}}
// Project Worker daily-ohlcv-v1 uses explicit completion metadata, not a top-level
// completed flag. FULL declares shares at volume.unit. Its R4.9.3 DAILY_ONLY
// sibling declares the same shares field through the named source contract.
// Its verified Worker branch also returns history alone when MIS is unavailable;
// both branches use the same serializeDailySeriesForFrontend share-volume field.
// The latter is accepted only after the independent same-day snapshot matches.
// Unknown schemas, explicit conflicts, and generic missing units still fail.
function normalizeWorkerReport(report,code){
 if(report?.dailyBasisV2?.model===MODEL&&report.sourceDailySeries){
  const basis=report.dailyBasisV2;
  if(C.fingerprint(report.sourceDailySeries)!==basis.responseHistoryFingerprint||C.fingerprint(report.dailySeries)!==basis.normalizedHistoryFingerprint)fail('標準化研究收據指紋不符 '+code);
  const sourceMeta=report.sourceDailySeriesMeta||{...report.dailySeriesMeta,source:report.workerDataAudit?.source||report.dailySeriesMeta?.source},sourceMode=report.upstreamDataContract?.sourceMode||sourceMeta.mode||'FULL';
  report={...report,dailyBasisV2:undefined,dailySeries:structuredClone(report.sourceDailySeries),canonicalBars:structuredClone(report.sourceDailySeries),dailySeriesMeta:structuredClone(sourceMeta),dataContract:report.upstreamDataContract||undefined,scanMode:sourceMode,dailyOnly:sourceMode==='DAILY_ONLY'};
 }
 const meta=report?.dailySeriesMeta;
 if(report?.dataContract){const checked=C.verify(report);if(!checked.ok)fail(checked.reason+' '+code);}
 if(meta?.schema!=='daily-ohlcv-v1')return report;
 const r={...report},rows=Array.isArray(r.dailySeries)&&r.dailySeries.length?r.dailySeries:r.canonicalBars;
 if(r.completed===false||r.isComplete===false||meta.onlyCompletedBars!==true)fail('Worker未確認完成日K '+code);
 if(!Array.isArray(rows)||!rows.length||meta.ascending!==true||meta.returnedBars!==rows.length||meta.completedDailyRowsAvailable!==rows.length||meta.completeOhlcvRowsAvailable!==rows.length||E.date(meta.firstDate)!==E.date(rows[0].date)||E.date(meta.lastDate)!==E.date(rows.at(-1).date))fail('Worker日K完成根數／首末日期未對齊 '+code);
 const declarations=[['volumeUnit',r.volumeUnit],['dailySeriesMeta.volumeUnit',meta.volumeUnit],['volume.unit',r.volume?.unit],['dailySeriesMeta.volume.unit',meta.volume?.unit]].filter(([,v])=>v!==undefined&&v!==null&&v!=='');
 const legacyDaily=r.dailyOnly===true&&r.scanMode==='DAILY_ONLY'&&meta.mode==='DAILY_ONLY'&&/^Yahoo Finance history(?: \+ (?:TWSE|TPEx|TPEX) MIS latest completed daily)? \(R4\.9\.3 DAILY_ONLY\)$/.test(meta.source||'');
 const legacyFull=r.dailyOnly!==true&&/^(?:Yahoo Finance history(?: \+ TWSE MIS latest completed daily)?(?: \(monthly degraded\))?|TWSE Official daily history(?: \+ Yahoo tail bridge)?(?: \+ TWSE MIS latest completed daily)?)$/.test(meta.source||'');
 let unitSource;
 if(r.dataContract)unitSource='STRUCTURED_VOLUME_CONTRACT_V1 + SAME_DAY_MARKET_CHECK';
 if(declarations.length){
  if(!r.dataContract&&!legacyDaily&&!legacyFull)fail('Worker成交量缺少可核驗的來源契約 '+code);
  if(declarations.some(([,v])=>!['shares','股'].includes(v)))fail('Worker成交量單位未知或互相衝突 '+code);
  unitSource=unitSource||declarations.map(([key])=>key).join(' + ');
  // Never let a string declaring 'shares' override observed volume evidence.
  // If an independently sourced quote disagrees materially, fail as DATA.
  const c=context(code),latest=num(rows.at(-1)?.volume),official=num(c.q.volume);
  if(!(latest>0&&official>0)||Math.abs(latest-official)/official>.2)
    fail('Worker已宣告股數，但日K與同日市場成交量無法交叉驗證 '+code);
 }else{
  const c=context(code),last=rows.at(-1),known=r.dailyOnly===true&&r.scanMode==='DAILY_ONLY'&&meta.mode==='DAILY_ONLY'&&/^Yahoo Finance history(?: \+ (?:TWSE|TPEx|TPEX) MIS latest completed daily)? \(R4\.9\.3 DAILY_ONLY\)$/.test(meta.source||'');
  const volume=num(last.volume),quote=num(c.q.volume);
  const reasons=[];
  if(!known)reasons.push('未提供可識別的DAILY_ONLY股數來源契約（source='+String(meta.source||'缺失').slice(0,95)+'；scanMode='+String(r.scanMode||'缺失')+'；meta.mode='+String(meta.mode||'缺失')+'；dailyOnly='+String(r.dailyOnly??'缺失')+'）；請由Worker明示volume.unit=shares並提供來源證據');
  if(String(r.stock||r.code||'')!==String(code))reasons.push('股票代號不符');
  if(market(r.market)!==c.q.market)reasons.push('市場別不符');
  if(E.date(r.closeDate)!==c.date||E.date(last.date)!==c.date)reasons.push('日K／快照交易日不符');
  if(!(quote>0&&volume>0))reasons.push('當日市場量或日K量無效');
  if(rows.some(b=>!Number.isInteger(num(b.volume))||!(num(b.volume)>0)))reasons.push('歷史成交量非正整數股數');
  if(reasons.length)fail('DAILY_ONLY成交量缺少可核驗的股數來源契約 '+code+'｜'+reasons.join('；'));

  if(Math.abs(volume-quote)/quote>.2)fail(`同日市場與日K成交量差異 ${(Math.abs(volume-quote)/quote*100).toFixed(2)}%，超過20%（日K ${volume}股／市場 ${quote}股） ${code}`);
  unitSource='PROJECT_R4.9.3_DAILY_ONLY_SHARES_CONTRACT + SAME_DAY_MARKET_VOLUME_CHECK';
 }
 if(rows.some(b=>b.volumeUnit&&!['shares','股'].includes(b.volumeUnit)))fail('Worker日K列成交量單位衝突 '+code);
 if(r.dataContract&&Array.isArray(r.canonicalBars)&&r.canonicalBars.length&&C.fingerprint(r.canonicalBars)!==C.fingerprint(rows))fail('Worker兩個日K陣列範圍或內容衝突 '+code);
 return {...r,completed:true,isComplete:true,volumeUnit:'shares',dailySeriesMeta:{...meta,volumeUnit:'shares'},workerDataAudit:{schema:meta.schema,completionSource:'dailySeriesMeta.onlyCompletedBars + completedDailyRowsAvailable + completeOhlcvRowsAvailable',historyBarCount:rows.length,volumeUnit:'shares',volumeUnitSource:unitSource,source:meta.source,sourceDate:E.date(meta.lastDate),originalCompleted:r.completed??null,originalVolumeUnit:r.volumeUnit??null}};
}
function validate(report,code){
 report=normalizeWorkerReport(report,code);
 if(!report.dataContract&&(report.dailySeriesMeta?.schema!=='daily-ohlcv-v1'||!report.workerDataAudit?.volumeUnitSource))fail('DAILY_ONLY成交量單位缺少可核驗來源契約 '+code);
 const c=context(code),q=c.q;
 if(q.volumeScopeAudit?.formalVolumeEligible===false)fail('成交量與成交金額統計範圍未確認，隔離正式量價判斷 '+code);
 if(String(report?.stock||report?.code||'')!==String(code))fail('回傳代號不符 '+code);
 if(report.completed!==true&&report.isComplete!==true)fail('未確認完成日K '+code);
 if(report.completed===false||report.isComplete===false)fail('上游明示尚未收盤 '+code);
 if(report.market&&market(report.market)!==q.market)fail('個股市場別與快照不同 '+code);
 if(E.date(report.closeDate||report.dataDate)!==c.date)fail('股票與快照日期不一致 '+code);
 if([report.marketDate,report.closeDate,report.dataDate].filter(Boolean).some(d=>E.date(d)!==c.date))fail('個股行情日期欄位衝突 '+code);
 const unit=report.volumeUnit||report.dailySeriesMeta?.volumeUnit;
 if(!['shares','股'].includes(unit)||report.dailySeriesMeta?.volumeUnit&&!['shares','股'].includes(report.dailySeriesMeta.volumeUnit))fail('DAILY_ONLY成交量單位未確認為股 '+code);
 const rows=Array.isArray(report.dailySeries)&&report.dailySeries.length?report.dailySeries:report.canonicalBars;
 if([...(Array.isArray(rows)?rows:[]),...(Array.isArray(report.canonicalBars)?report.canonicalBars:[])].some(b=>b.stock&&String(b.stock)!==String(code)||b.code&&String(b.code)!==String(code)||b.market&&market(b.market)!==q.market))fail('日K股票代號／市場別不符 '+code);
 const checked=E.normalize(rows,c.date);if(!checked.ok)fail(checked.reason+' '+code);
 const b=checked.bars;if(b.some(x=>x.volume===0))fail('日K含零量，不視為可成交歷史 '+code);const last=b.at(-1),eq=(a,b)=>num(a)!==null&&num(b)!==null&&Math.abs(Number(a)-Number(b))<=Math.max(.02,Number(b)*.0001);
 if(!eq(report.close,last.close)||!['open','high','low','close'].every(k=>eq(q[k],last[k])))fail('同日市場與日K的OHLC未對齊 '+code);
 if(!(q.volume>0&&last.volume>0)||Math.abs(q.volume-last.volume)/q.volume>.2)fail('市場與日K成交量差異超過20% '+code);
 const rawBars=structuredClone(b),sourceVolume=last.volume,responseHistoryFingerprint=C.fingerprint(rawBars),originalHistoryFingerprint=report.dataContract?.originalHistoryFingerprint||responseHistoryFingerprint;
 // Original response and source volume are preserved BEFORE snapshot reconciliation.
 if(q.volumeScopeVerified===true&&q.volumeScope==='DAILY_OHLCV_EQUIVALENT')last.volume=q.volume;
 return freeze({bars:b,rawBars,originalBars:structuredClone(report.originalDailySeries||rawBars),date:c.date,q:structuredClone(q),key:c.key,fingerprint:fingerprint(b),originalHistoryFingerprint,responseHistoryFingerprint,normalizedHistoryFingerprint:C.fingerprint(b),historyIdentity:[snapshot.identity,String(code),report.dataContract?.sourceVersion||report.version||'LEGACY',originalHistoryFingerprint,responseHistoryFingerprint].join('|'),dataContract:structuredClone(report.dataContract||null),sourceVolume,sourceMeta:structuredClone(report.dailySeriesMeta||{}),workerDataAudit:structuredClone(report.workerDataAudit||null),priceAdjustment:structuredClone(report.priceAdjustment||{verified:false,basis:'UNKNOWN'}),expectedTradingDates:structuredClone(report.expectedTradingDates),corporateActions:structuredClone(report.corporateActions)});
}
function historyMismatch(a,b){
 const length=Math.min(a.length,b.length);
 for(let i=0;i<length;i++){
  const fields=['date','open','high','low','close','volume'];
  const changed=fields.filter(k=>a[i]?.[k]!==b[i]?.[k]);
  if(changed.length)return `首筆差異 ${a[i]?.date||b[i]?.date||i}／${changed.join(',')}（舊${a.length}根／新${b.length}根）`;
 }
 return `日K根數不同（舊${a.length}根／新${b.length}根）`;
}
function verifiedRevision(old,p){
 const contract=p.dataContract,revision=contract?.revision;
 if(!contract?.officialRecoveryApplied||revision?.reason!=='OFFICIAL_GAP_RECOVERY'||revision.predecessor!==old.responseHistoryFingerprint||p.originalHistoryFingerprint!==old.originalHistoryFingerprint)return false;
 const prior=new Map(old.rawBars.map(b=>[b.date,b])),evidence=new Set(contract.officialRecoveryEvidence.map(e=>e.date));
 // Only evidenced inserted sessions may change the sequence. Existing bars are immutable.
 return p.rawBars.every(b=>prior.has(b.date)?C.fingerprint([b])===C.fingerprint([prior.get(b.date)]):evidence.has(b.date))&&old.rawBars.every(b=>p.rawBars.some(x=>x.date===b.date));
}
function remember(report,code){const p=validate(report,code),old=cache.get(p.key);
 if(old&&!old.error&&(old.originalHistoryFingerprint!==p.originalHistoryFingerprint||old.responseHistoryFingerprint!==p.responseHistoryFingerprint||old.fingerprint!==p.fingerprint)&&!verifiedRevision(old,p))fail('同一快照收到不同歷史序列 '+code+'｜'+historyMismatch(old.rawBars,p.rawBars)+'｜舊日K指紋 '+old.originalHistoryFingerprint+'／新日K指紋 '+p.originalHistoryFingerprint+'｜來源 '+String(old.sourceMeta?.source||'未提供').slice(0,90)+'／'+String(p.sourceMeta?.source||'未提供').slice(0,90)+'；請由Worker固定歷史版本，已隔離新序列，未覆蓋已驗證快取');
 cache.set(p.key,p);return p;
}
async function ensure(items){
 const requestedIdentity=snapshot?.identity;
 const acquisitionErrors=new Map();
 const assertCurrent=()=>{if(snapshot?.identity!==requestedIdentity)fail('取得日K期間市場快照已改變，請重新查詢');};
 const need=[];for(const i of items){const c=context(i.code);if((!cache.has(c.key)||cache.get(c.key)?.error)&&!pending.has(c.key))need.push({...i,q:c.q});}
 if(need.length){
  if(!fetcher)fail('共用DAILY_ONLY取得函式未載入');
  for(let start=0;start<need.length;start+=8){const part=need.slice(start,start+8),keys=part.map(i=>context(i.code).key);
   const job=(async()=>{const p=await fetcher(part);assertCurrent();if(p?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(p.results))fail('DAILY_ONLY格式錯誤');
    for(const item of part){const found=p.results.filter(x=>String(x.code||x.data?.stock||'')===String(item.code));try{if(found.length!==1||!found[0]?.ok)fail(found[0]?.error||'未回傳唯一個股 '+item.code);remember(found[0].data,item.code);}catch(e){const key=context(item.code).key;acquisitionErrors.set(key,String(e.message||e));if(!cache.has(key)||cache.get(key)?.error)cache.set(key,freeze({error:String(e.message||e),failureCode:classifyFailure(e)}));}}
   })();keys.forEach(k=>pending.set(k,job));try{await job;}finally{keys.forEach(k=>{if(pending.get(k)===job)pending.delete(k);});}
  }
 }
 assertCurrent();for(const item of items){const c=context(item.code);if(pending.has(c.key))await pending.get(c.key);assertCurrent();if(acquisitionErrors.has(c.key))fail(acquisitionErrors.get(c.key));const p=cache.get(c.key);if(!p||p.error)fail(p?.error||'尚未取得共用日K '+item.code);}
}
function apply(report,code){
 const c=context(code),p=cache.get(c.key);if(!p||p.error)fail(p?.error||'共用日K未完成 '+code);
 if(String(report.stock||report.code||'')!==String(code)||report.market&&market(report.market)!==p.q.market)fail('原報告代號／市場別不同 '+code);
 if(report.completed===false||report.isComplete===false||E.date(report.closeDate||report.dataDate)!==p.date)fail('原報告完成狀態／日期不符 '+code);
 if(!(num(report.close)>0)||Math.abs(Number(report.close)-p.q.close)>Math.max(.02,p.q.close*.0001))fail('原報告收盤價不同 '+code);
 if(report.dailySeries?.length||report.canonicalBars?.length)report=normalizeWorkerReport(report,code);
 if(report.dailySeries?.length||report.canonicalBars?.length)validate(report,code);
 const bars=p.bars.map(b=>({...b})),sourceVolDiffPct=(p.q.volume>0&&p.sourceVolume>0)?Math.abs(p.q.volume-p.sourceVolume)/p.q.volume*100:null,provenance={model:MODEL,profile:'DAILY_ONLY',date:p.date,fingerprint:p.fingerprint,originalHistoryFingerprint:p.originalHistoryFingerprint,responseHistoryFingerprint:p.responseHistoryFingerprint,normalizedHistoryFingerprint:p.normalizedHistoryFingerprint,historyIdentity:p.historyIdentity,bars:bars.length,snapshotVerified:true,latestVolumeReconciled:true,sourceVolume:p.sourceVolume,snapshotVolume:p.q.volume,sourceVolumeDiffPct:sourceVolDiffPct,sourceVolumeWarning:sourceVolDiffPct!==null&&sourceVolDiffPct>.5,sourceVolumeUnit:'shares',snapshotVolumeApplied:p.q.volumeScopeVerified===true&&p.q.volumeScope==='DAILY_OHLCV_EQUIVALENT',volumeBasis:'已核驗日K來源量；市場量僅交叉驗證，統計範圍未核對時不覆寫'};
 const rsiSourceAudit=report.rsiSourceAudit||{source:report.dailyBasisV2?'PRIOR_CANONICAL_UNVERIFIED':'UPSTREAM_REPORT',value:report.dailyRsi5??report.dailyRsi??null,date:E.date(report.dailyRsi5Date||report.rsiDate||report.closeDate||report.dataDate),code:String(report.stock||report.code||''),market:report.market||p.q.market,meta:report.rsi5Meta||null};
 return {...report,dataContract:undefined,upstreamDataContract:structuredClone(p.dataContract),originalDailySeries:structuredClone(p.originalBars),sourceDailySeries:structuredClone(p.rawBars),sourceDailySeriesMeta:structuredClone(p.sourceMeta),rsiSourceAudit,workerDataAudit:p.workerDataAudit||report.workerDataAudit||null,stock:String(code),code:String(code),market:p.q.market,marketDate:p.date,completed:true,isComplete:true,dataTiming:'POST_CLOSE_ONLY',dailySeries:bars,canonicalBars:bars,close:p.q.close,volumeUnit:'shares',dailyRsi5:E.rsi(bars),dailyBasisV2:provenance,
  monthlyReviewV2:months.get(c.key)||{status:'UNAVAILABLE',source:'NO_FULL_MONTHLY',verified:false,date:p.date},priceAdjustment:{...p.priceAdjustment},dailySeriesMeta:{...p.sourceMeta,returnedBars:bars.length,completedDailyRowsAvailable:bars.length,completeOhlcvRowsAvailable:bars.length,dailySeriesCount:bars.length,canonicalBarCount:bars.length,firstDate:bars[0]?.date,lastDate:bars.at(-1)?.date,countScope:'RETURNED_SERIES',volumeUnit:'shares',source:'共用DAILY_ONLY；同日市場OHLC與成交量交叉驗證'},expectedTradingDates:p.expectedTradingDates,corporateActions:p.corporateActions||report.corporateActions};
}
async function harmonize(items,payload,profile='FULL'){
 const requestedSnapshot=snapshot;
 if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))fail('深掃回傳格式錯誤');
 const codes=items.map(i=>String(i.code));if(new Set(codes).size!==codes.length)fail('請求代號重複');
 const daily=String(profile).toUpperCase()==='DAILY_ONLY',good=items.filter(i=>payload.results.filter(x=>String(x.code||x.data?.stock||'')===String(i.code)).length===1&&payload.results.find(x=>String(x.code||x.data?.stock||'')===String(i.code))?.ok);
 if(!daily){try{await ensure(good);}catch(e){/* Keep per-stock DATA while retaining successfully verified peers. */}}
 if(snapshot!==requestedSnapshot)fail('深掃期間市場快照已改變，禁止套用舊回應');
 const results=payload.results.filter(x=>!codes.includes(String(x.code||x.data?.stock||'')));
 for(const item of items){const found=payload.results.filter(x=>String(x.code||x.data?.stock||'')===String(item.code));const x=found.length===1?found[0]:null;
  if(!x?.ok){results.push(failureRecord(x||{code:String(item.code),ok:false,error:'資料不足｜回傳缺失或重複'}));continue;}
  try{if(daily)remember(x.data,item.code);let aligned=apply(x.data,item.code);if(String(profile).toUpperCase()==='FULL'){months.set(context(item.code).key,{status:E.monthly({...x.data,monthlyReviewV2:undefined}),source:'FULL_EXPLICIT_FIELDS',verified:true,date:aligned.marketDate});aligned=apply(x.data,item.code);}results.push({...x,code:String(item.code),data:aligned});}catch(e){results.push(failureRecord({...x,ok:false,error:String(e.message||e),data:undefined,dataUnavailable:true}));}
 }
 if(snapshot===requestedSnapshot){globalThis.ShitouPriceActionIntegration?.capture({snapshot,items,results});try{globalThis.ShitouResearchIntegration?.capture({snapshot,items,results});}catch(e){console.warn("研究附層未完成，原結果保留",e);}}
 return {...payload,results};
}
function fromUrl(url){const u=new URL(url,'https://local.invalid'),codes=(u.searchParams.get('codes')||'').split(',').filter(Boolean);return {items:codes.map(code=>({code,q:snapshot?.map.get(code)})),profile:u.searchParams.get('profile')||'FULL'};}
return Object.freeze({MODEL,classifyFailure,isDataFailure,failureRecord,inspectSnapshot,bind,context,get,normalizeWorkerReport,validate,remember,ensure,apply,harmonize,fromUrl,fingerprint,setFetcher:f=>{fetcher=f;},getSnapshot:()=>snapshot,reset:()=>{snapshot=null;cache.clear();pending.clear();months.clear();globalThis.ShitouPriceActionIntegration?.bind(null);try{globalThis.ShitouResearchIntegration?.bind(null);}catch(_){}}});
});
