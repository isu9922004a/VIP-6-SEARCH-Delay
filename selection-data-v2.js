/* One DAILY_ONLY history per verified market snapshot and stock, shared by all four scanners.
 * Never infer completion merely from a date. No private Stock Digger API is used.
 */
(function(root,factory){const E=typeof module==='object'&&module.exports?require('./selection-evidence-v1.js'):root.ShitouSelectionEvidenceV1;const api=factory(E);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouSelectionDataV2=api;})(globalThis,function(E){
'use strict';
const MODEL='CANONICAL_DAILY_ONLY_REVIEW_2',cache=new Map(),pending=new Map(),months=new Map();let snapshot=null,fetcher=null;
const num=E? v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null:()=>null;
const fail=reason=>{throw Error('資料不足｜共用日K：'+reason);};
const market=v=>String(v||'').toUpperCase()==='TPEX'?'TPEX':String(v||'').toUpperCase()==='TWSE'?'TWSE':null;
function fingerprint(rows){const text=JSON.stringify(rows);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return rows.length+'-'+(h>>>0).toString(16);}
function bind(bundle){
 const meta=bundle?.meta||{},dates=[meta.targetTradeDate,meta.completedTradeDate,meta.expectedTradeDate,meta.twseQuoteDate,meta.tpexQuoteDate].map(E.date);
 if(meta.marketCoverageReady!==true||meta.industryCoverageReady!==true||meta.snapshotTimelinessReady!==true||dates.some(d=>!d)||new Set(dates).size!==1||!(bundle.map instanceof Map)||num(meta.total)!==num(bundle.snapshotRows??bundle.map.size)||bundle.map.size>num(meta.total)||bundle.map.size===0)fail('市場快照完整性、最新交易日或筆數未通過');
 const map=new Map();for(const [code,q] of bundle.map){const m=market(q.market);if(!m)fail('市場別缺失 '+code);if(q.quoteDate&&E.date(q.quoteDate)!==dates[0])fail('市場報價日期衝突 '+code);map.set(String(code),{...q,market:m,quoteDate:dates[0],volumeUnit:'shares'});}
 if(snapshot?.date!==dates[0]){cache.clear();pending.clear();months.clear();}
 snapshot={date:dates[0],map,meta};return {...bundle,map};
}
function context(code){const q=snapshot?.map.get(String(code));if(!q)fail('尚未取得此股票同日市場快照 '+code);return {q,date:snapshot.date,key:[snapshot.date,String(code),q.market,q.open,q.high,q.low,q.close,q.volume].join('|')};}
function get(code){try{return cache.get(context(code).key)||null;}catch{return null;}}
function validate(report,code){
 const c=context(code),q=c.q;
 if(String(report?.stock||report?.code||'')!==String(code))fail('回傳代號不符 '+code);
 if(report.completed===false||report.isComplete===false)fail('上游明示尚未收盤 '+code);
 if(report.market&&market(report.market)!==q.market)fail('個股市場別與快照不同 '+code);
 if(E.date(report.closeDate||report.dataDate)!==c.date)fail('股票與快照日期不一致 '+code);
 const rows=Array.isArray(report.dailySeries)&&report.dailySeries.length?report.dailySeries:report.canonicalBars;
 const checked=E.normalize(rows,c.date);if(!checked.ok)fail(checked.reason+' '+code);
 const b=checked.bars;if(b.some(x=>x.volume===0))fail('日K含零量，不視為可成交歷史 '+code);const last=b.at(-1),eq=(a,b)=>num(a)!==null&&num(b)!==null&&Math.abs(Number(a)-Number(b))<=Math.max(.02,Number(b)*.0001);
 if(!eq(report.close,last.close)||!['open','high','low','close'].every(k=>eq(q[k],last[k])))fail('同日市場與日K的OHLC未對齊 '+code);
 if(!(q.volume>0&&last.volume>0)||Math.abs(q.volume-last.volume)/q.volume>.2)fail('市場與日K成交量差異超過20% '+code);
 const sourceVolume=last.volume;last.volume=q.volume;
 return {bars:b,date:c.date,q,key:c.key,fingerprint:fingerprint(b),sourceVolume,sourceMeta:report.dailySeriesMeta||{},priceAdjustment:report.priceAdjustment||{verified:false,basis:'UNKNOWN'},expectedTradingDates:report.expectedTradingDates,corporateActions:report.corporateActions};
}
function remember(report,code){const p=validate(report,code),old=cache.get(p.key);if(old&&old.fingerprint!==p.fingerprint)fail('同一快照收到不同歷史序列；請重新整理後統一重掃 '+code);cache.set(p.key,p);return p;}
async function ensure(items){
 const need=[];for(const i of items){const c=context(i.code);if((!cache.has(c.key)||cache.get(c.key)?.error)&&!pending.has(c.key))need.push({...i,q:c.q});}
 if(need.length){
  if(!fetcher)fail('共用DAILY_ONLY取得函式未載入');
  for(let start=0;start<need.length;start+=8){const part=need.slice(start,start+8),keys=part.map(i=>context(i.code).key);
   const job=(async()=>{const p=await fetcher(part);if(p?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(p.results))fail('DAILY_ONLY格式錯誤');
    for(const item of part){const found=p.results.filter(x=>String(x.code||x.data?.stock||'')===String(item.code));try{if(found.length!==1||!found[0]?.ok)fail(found[0]?.error||'未回傳唯一個股 '+item.code);remember(found[0].data,item.code);}catch(e){cache.set(context(item.code).key,{error:String(e.message||e)});}}
   })();keys.forEach(k=>pending.set(k,job));try{await job;}finally{keys.forEach(k=>pending.delete(k));}
  }
 }
 for(const item of items){const c=context(item.code);if(pending.has(c.key))await pending.get(c.key);const p=cache.get(c.key);if(!p||p.error)fail(p?.error||'尚未取得共用日K '+item.code);}
}
function apply(report,code){
 const c=context(code),p=cache.get(c.key);if(!p||p.error)fail(p?.error||'共用日K未完成 '+code);
 if(String(report.stock||report.code||'')!==String(code)||report.market&&market(report.market)!==p.q.market)fail('原報告代號／市場別不同 '+code);
 if(report.completed===false||report.isComplete===false||E.date(report.closeDate||report.dataDate)!==p.date)fail('原報告完成狀態／日期不符 '+code);
 if(!(num(report.close)>0)||Math.abs(Number(report.close)-p.q.close)>Math.max(.02,p.q.close*.0001))fail('原報告收盤價不同 '+code);
 const bars=p.bars.map(b=>({...b})),provenance={model:MODEL,profile:'DAILY_ONLY',date:p.date,fingerprint:p.fingerprint,bars:bars.length,snapshotVerified:true,latestVolumeReconciled:true,sourceVolume:p.sourceVolume};
 return {...report,stock:String(code),code:String(code),market:p.q.market,marketDate:p.date,completed:true,isComplete:true,dataTiming:'POST_CLOSE_ONLY',dailySeries:bars,canonicalBars:bars,close:p.q.close,volumeUnit:'shares',dailyRsi5:E.rsi(bars),dailyBasisV2:provenance,
  monthlyReviewV2:months.get(c.key)||{status:'UNAVAILABLE',source:'NO_FULL_MONTHLY',verified:false,date:p.date},priceAdjustment:{...p.priceAdjustment},dailySeriesMeta:{...p.sourceMeta,volumeUnit:'shares',source:'共用DAILY_ONLY；同日市場OHLC驗證，最新量以快照校正'},expectedTradingDates:p.expectedTradingDates,corporateActions:p.corporateActions||report.corporateActions};
}
async function harmonize(items,payload,profile='FULL'){
 if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))fail('深掃回傳格式錯誤');
 const codes=items.map(i=>String(i.code));if(new Set(codes).size!==codes.length)fail('請求代號重複');
 const daily=String(profile).toUpperCase()==='DAILY_ONLY',good=items.filter(i=>payload.results.filter(x=>String(x.code||x.data?.stock||'')===String(i.code)).length===1&&payload.results.find(x=>String(x.code||x.data?.stock||'')===String(i.code))?.ok);
 if(!daily){try{await ensure(good);}catch(e){/* Keep per-stock DATA while retaining successfully verified peers. */}}
 const results=payload.results.filter(x=>!codes.includes(String(x.code||x.data?.stock||'')));
 for(const item of items){const found=payload.results.filter(x=>String(x.code||x.data?.stock||'')===String(item.code));const x=found.length===1?found[0]:null;
  if(!x?.ok){results.push(x||{code:String(item.code),ok:false,error:'資料不足｜回傳缺失或重複'});continue;}
  try{if(daily)remember(x.data,item.code);let aligned=apply(x.data,item.code);if(String(profile).toUpperCase()==='FULL'){months.set(context(item.code).key,{status:E.monthly({...x.data,monthlyReviewV2:undefined}),source:'FULL_EXPLICIT_FIELDS',verified:true,date:aligned.marketDate});aligned=apply(x.data,item.code);}results.push({...x,code:String(item.code),data:aligned});}catch(e){results.push({...x,ok:false,error:String(e.message||e),data:undefined,dataUnavailable:true});}
 }
 return {...payload,results};
}
function fromUrl(url){const u=new URL(url,'https://local.invalid'),codes=(u.searchParams.get('codes')||'').split(',').filter(Boolean);return {items:codes.map(code=>({code,q:snapshot?.map.get(code)})),profile:u.searchParams.get('profile')||'FULL'};}
return Object.freeze({MODEL,bind,context,get,validate,remember,ensure,apply,harmonize,fromUrl,fingerprint,setFetcher:f=>{fetcher=f;},getSnapshot:()=>snapshot,reset:()=>{snapshot=null;cache.clear();pending.clear();months.clear();}});
});
