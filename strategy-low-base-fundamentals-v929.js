/* V9.29 point-in-time monthly revenue input. Table issue date is NOT issuer announcement time. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouLowBaseFundamentalsV929=api;})(globalThis,function(){
'use strict';
const SOURCES=Object.freeze({TWSE:'https://openapi.twse.com.tw/v1/opendata/t187ap05_L',TPEX:'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O'});
const ISO=/^\d{4}-\d{2}-\d{2}$/,HEX=/^[a-f0-9]{64}$/;
const date=x=>{if(typeof x!=='string'||!ISO.test(x))return false;const n=Date.parse(x+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===x;};
function roc(raw,monthly=false){const s=String(raw??'').trim();if(!/^\d+$/.test(s)||![monthly?5:7,monthly?6:8].includes(s.length))return null;
 const y=s.length===(monthly?5:7)?Number(s.slice(0,3))+1911:Number(s.slice(0,4)),tail=s.slice(monthly?-2:-4),m=Number(tail.slice(0,2)),d=monthly?1:Number(tail.slice(2));
 const result=String(y)+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');return date(result)?monthly?result.slice(0,7):result:null;}
function number(raw){const s=String(raw??'').trim().replaceAll(',','');if(!/^-?\d+(?:\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
function taipei(timestamp){if(typeof timestamp!=='string'||!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)||!Number.isFinite(Date.parse(timestamp)))return null;return new Date(Date.parse(timestamp)+28800000).toISOString().slice(0,10);}
function parse(rows,market,receipt){
 if(!Object.hasOwn(SOURCES,market)||receipt?.source!==SOURCES[market]||receipt.status!==200||!HEX.test(receipt.sha256||'')||!taipei(receipt.retrievedAt)||!Array.isArray(rows)||rows.length<(market==='TWSE'?800:600))throw Error('官方月營收來源、收據或筆數不足');
 const observedDate=taipei(receipt.retrievedAt),map=new Map(),errors=[];
 for(const raw of rows){
  const code=String(raw?.['公司代號']??'').trim(),period=roc(raw?.['資料年月'],true),tableDate=roc(raw?.['出表日期']);
  if(!/^[1-9]\d{3}$/.test(code))continue;
  if(!period||!tableDate||tableDate>observedDate||period>=observedDate.slice(0,7)){errors.push({code,reason:'營收年月或出表日期不符'});continue;}
  const current=number(raw['營業收入-當月營收']),priorYear=number(raw['營業收入-去年當月營收']);
  if(current===null||priorYear===null||current<0||priorYear<0){errors.push({code,period,reason:'營收金額缺失或異常'});continue;}
  const key=code+'|'+period;
  if(map.has(key)){map.set(key,null);errors.push({code,period,reason:'同代號月份重複'});continue;}
  map.set(key,{code,market,period,tableDate,current,priorYear,unit:'NTD_THOUSAND',source:receipt.source,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt,observedDate});
 }
 const records=[...map.values()].filter(Boolean);
 if(records.length<(market==='TWSE'?700:500))throw Error('可用公司月營收資料筆數不足');
 return {records,errors,observedDate,market,receipt};
}
const monthIndex=s=>Number(s.slice(0,4))*12+Number(s.slice(5,7))-1;
function evidence(records,{code,market,asOf}={}){
 if(!date(asOf)||!Object.hasOwn(SOURCES,market)||!Array.isArray(records))return {};
 const latest=new Map();
 for(const r of records){
  if(r.code!==String(code)||r.market!==market||r.source!==SOURCES[market]||r.unit!=='NTD_THOUSAND'||!HEX.test(r.sourceSha256||'')||!date(r.observedDate)||taipei(r.retrievedAt)!==r.observedDate||r.observedDate>asOf||!date(r.tableDate)||r.tableDate>r.observedDate||!date(r.period+'-01')||r.period>=asOf.slice(0,7)||![r.current,r.priorYear].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0))continue;
  const old=latest.get(r.period);
  if(!old||Date.parse(r.retrievedAt)>Date.parse(old.retrievedAt))latest.set(r.period,r);
 }
 const b=[...latest.values()].sort((a,b)=>b.period.localeCompare(a.period)),z=b[0];
 if(!z||monthIndex(asOf.slice(0,7))-monthIndex(z.period)>2)return {};
 const e=(pass,rows,formula,value)=>({verified:true,publishedAt:rows.map(r=>r.observedDate).sort().at(-1),availableAt:rows.map(r=>r.retrievedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1),pass,formula,value,period:z.period,sources:rows.map(r=>({period:r.period,source:r.source,sourceSha256:r.sourceSha256,tableDate:r.tableDate,observedAt:r.retrievedAt})),availabilityBasis:'OBSERVED_OFFICIAL_SNAPSHOT_NOT_ORIGINAL_FILING'});
 const out={};
 if(z.priorYear>0){const yoy=(z.current/z.priorYear-1)*100;out.revenueYoYPositive=e(yoy>0,[z],'(當月營收/去年同月營收-1)*100',yoy);}
 const continuous=n=>b.length>=n&&b.slice(0,n).every((r,i)=>monthIndex(z.period)-monthIndex(r.period)===i);
 if(continuous(3)){const rows=b.slice(0,3),sum=key=>rows.reduce((n,r)=>n+r[key],0),prev=sum('priorYear');if(prev>0){const yoy=(sum('current')/prev-1)*100;out.revenue3mYoYPositive=e(yoy>0,rows,'(近三月營收合計/去年同期三月營收合計-1)*100',yoy);}}
 if(continuous(12)){const rows=b.slice(0,12);out.revenue12High=e(z.current>=Math.max(...rows.map(r=>r.current)),rows,'最新月營收不低於近12個連續月最高營收（同高亦通過）',z.current);}
 return out;
}

const financial=(function(F){
const sources=Object.freeze({
 TWSE:{income:'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci',balance:'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_ci'},
 TPEX:{income:'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap06_O_ci',balance:'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap07_O_ci'}
});
const hex=/^[a-f0-9]{64}$/,iso=/^\d{4}-\d{2}-\d{2}$/;
function parse(rows,market,kind,receipt){
 if(!sources[market]?.[kind]||receipt?.source!==sources[market][kind]||receipt.status!==200||!hex.test(receipt.sha256||'')||!F.taipei(receipt.retrievedAt)||!Array.isArray(rows)||rows.length<(market==='TWSE'?700:500))throw Error('財報來源收據或筆數不足');
 if(kind==='balance'&&!rows.some(r=>Object.hasOwn(r,'存貨')))throw Error('官方資產負債摘要未提供存貨明細；不得使用流動資產替代');
 const observedDate=F.taipei(receipt.retrievedAt),records=new Map(),errors=[];
 for(const row of rows){
  // Only use the explicitly documented identity aliases. Inspect actual schemas before expanding.
  const code=String(row['公司代號']??row.SecuritiesCompanyCode??'').trim(),rawYear=String(row['年度']??row.Year??'').trim(),q=Number(row['季別']??row.Season??row.Quarter),tableDate=F.roc(row['出表日期']??row.Date),year=/^\d{3}$/.test(rawYear)?Number(rawYear)+1911:/^\d{4}$/.test(rawYear)?Number(rawYear):null;
  if(!/^[1-9]\d{3}$/.test(code))continue;
  const periodEnd=year&&[1,2,3,4].includes(q)?new Date(Date.UTC(year,q*3,0)).toISOString().slice(0,10):null;
  if(!periodEnd||periodEnd>=observedDate||!tableDate||tableDate>observedDate){errors.push({code,reason:'財報期間或表列日期無效'});continue;}
  const field=(...names)=>{for(const n of names)if(Object.hasOwn(row,n)&&row[n]!==null&&String(row[n]).trim()!=='')return F.number(row[n]);return null;};
  const values=kind==='income'?{revenue:field('營業收入'),cost:field('營業成本'),grossProfit:field('營業毛利（毛損）淨額','營業毛利（毛損）'),netIncome:field('本期淨利（淨損）'),eps:field('基本每股盈餘（元）')}:{inventory:field('存貨')};
  if(kind==='income'&&(!Number.isFinite(values.revenue)||values.revenue<=0)||kind==='balance'&&(!Number.isFinite(values.inventory)||values.inventory<0)){errors.push({code,reason:'必要金額未核對'});continue;}
  const key=[code,year,q].join('|');
  if(records.has(key)){records.set(key,null);errors.push({code,reason:'重複財報身分'});continue;}
  records.set(key,{code,market,kind,year,quarter:q,periodEnd,observedDate,tableDate,retrievedAt:receipt.retrievedAt,source:receipt.source,sourceSha256:receipt.sha256,unit:'NTD_THOUSAND',basis:kind==='income'?'YEAR_TO_DATE':'PERIOD_END',...values});
 }
 const out=[...records.values()].filter(Boolean);
 if(out.length<(market==='TWSE'?600:400))throw Error('財報有效筆數不足；請先檢查欄位與來源');
 return {records:out,errors,observedDate,market,kind};
}
const idx=r=>r.year*4+r.quarter;
function evaluate(rows,{code,market,asOf}={}){
 if(!iso.test(asOf||'')||!sources[market]||!Array.isArray(rows))return {};
 const maps={income:new Map(),balance:new Map()};
 for(const r of rows){
  if(r.code!==String(code)||r.market!==market||!maps[r.kind]||r.source!==sources[market][r.kind]||!hex.test(r.sourceSha256||'')||r.unit!=='NTD_THOUSAND'||r.observedDate>asOf||F.taipei(r.retrievedAt)!==r.observedDate||!iso.test(r.tableDate||'')||r.tableDate>r.observedDate||!Number.isInteger(r.year)||![1,2,3,4].includes(r.quarter)||r.periodEnd!==new Date(Date.UTC(r.year,r.quarter*3,0)).toISOString().slice(0,10)||r.periodEnd>=r.observedDate||r.basis!==(r.kind==='income'?'YEAR_TO_DATE':'PERIOD_END'))continue;
  const m=maps[r.kind],old=m.get(idx(r));if(!old||Date.parse(r.retrievedAt)>Date.parse(old.retrievedAt))m.set(idx(r),r);
 }
 const output={},latest=[...maps.income.values()].sort((a,b)=>idx(b)-idx(a))[0];
 const e=(pass,value,formula,records)=>({verified:true,pass,value,formula,publishedAt:records.map(x=>x.observedDate).sort().at(-1),availableAt:records.map(x=>x.retrievedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1),sources:records.map(x=>({source:x.source,sourceSha256:x.sourceSha256,periodEnd:x.periodEnd,observedAt:x.retrievedAt})),availabilityBasis:'OBSERVED_OFFICIAL_SNAPSHOT_NOT_ORIGINAL_FILING'});
 const annual=maps.income.get((Number(asOf.slice(0,4))-1)*4+4);
 if(annual&&Number.isFinite(annual.eps))output.epsAbove1=e(annual.eps>1,annual.eps,'去年度Q4累計基本EPS', [annual]);
 if(!latest)return output;
 const single=r=>{
  const prev=r.quarter===1?null:maps.income.get(idx(r)-1);
  if(r.quarter!==1&&(!prev||prev.year!==r.year||prev.basis!==r.basis))return null;
  const value=k=>Number.isFinite(r[k])&&(!prev||Number.isFinite(prev[k]))?r[k]-(prev?prev[k]:0):null;
  const revenue=value('revenue');if(!(revenue>0))return null;
  return {revenue,cost:value('cost'),gross:value('grossProfit'),net:value('netIncome'),records:prev?[r,prev]:[r]};
 };
 const q=single(latest);
 if(!q)return output;
 if(Number.isFinite(q.gross)){const rate=q.gross/q.revenue*100;output.grossMarginAbove1787=e(rate>17.87,rate,'單季營業毛利／單季營業收入×100',q.records);}
 if(Number.isFinite(q.net)){const rate=q.net/q.revenue*100;output.netMarginAbove873=e(rate>8.73,rate,'單季本期淨利／單季營業收入×100',q.records);}
 const inventory=maps.balance.get(idx(latest)),prior=maps.balance.get(idx(latest)-1);
 if(inventory&&prior&&[inventory.inventory,prior.inventory,q.cost].every(Number.isFinite)&&inventory.inventory>=0&&prior.inventory>=0&&q.cost>=0&&inventory.inventory+prior.inventory>0){
  const turnover=q.cost/((inventory.inventory+prior.inventory)/2);
  output.inventoryTurnoverAbove1=e(turnover>1,turnover,'單季營業成本／期初期末平均存貨（未年化）',[...q.records,inventory,prior]);
 }
 const eight=Array.from({length:8},(_,i)=>maps.income.get(idx(latest)-i)).map(r=>r?single(r):null);
 if(eight.every(x=>x&&Number.isFinite(x.gross))){
  const rates=eight.map(x=>x.gross/x.revenue*100);
  output.grossMargin8qHigh=e(rates.slice(1).every(v=>rates[0]>v),rates[0],'最新單季毛利率嚴格高於前7季',eight.flatMap(x=>x.records));
 }
 return output;
}
return Object.freeze({sources,parse,evaluate});

})({taipei,roc,number});
const SCHEMA='V929_FUNDAMENTAL_EVIDENCE_V1';
async function digest(bytes){return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
function indexBundle(bundle,{asOf,snapshotHash}={}){
 if(bundle?.schema!==SCHEMA||bundle.date!==asOf||!date(asOf)||!HEX.test(snapshotHash||'')||bundle.snapshotHash!==snapshotHash||!Array.isArray(bundle.records)||!Array.isArray(bundle.receipts))throw Error('基本面日期或市場指紋不符');
 const proofs=new Map(),groups=new Map(),ids=new Set();
 for(const p of bundle.receipts){if(p?.source!==SOURCES[p.market]||p.status!==200||!HEX.test(p.sha256||'')||!date(p.observedDate)||p.observedDate>asOf||taipei(p.retrievedAt)!==p.observedDate)throw Error('基本面來源收據不符');const key=[p.market,p.sha256,p.retrievedAt].join('|');if(proofs.has(key))throw Error('基本面收據重複');proofs.set(key,p);}
 for(const x of bundle.records){const key=[x.market,x.sourceSha256,x.retrievedAt].join('|'),p=proofs.get(key),id=[x.market,x.code,x.period,x.retrievedAt].join('|');
  if(!p||ids.has(id)||!(/^[1-9]\d{3}$/.test(x.code||''))||x.source!==p.source||x.observedDate!==p.observedDate||x.unit!=='NTD_THOUSAND'||!date(x.period+'-01')||!date(x.tableDate)||x.tableDate>x.observedDate||x.period>=x.observedDate.slice(0,7)||![x.current,x.priorYear].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0))throw Error('基本面個股紀錄未核對');
  ids.add(id);const group=x.market+'|'+x.code;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(x);
 }

 const financialProofs=new Map(),financialGroups=new Map(),financialIds=new Set();
 if(bundle.financialReceipts!==undefined||bundle.financialRecords!==undefined){
  if(!Array.isArray(bundle.financialReceipts)||!Array.isArray(bundle.financialRecords))throw Error('季度財報封存格式無效');
  for(const p of bundle.financialReceipts){
   if(!financial.sources[p.market]?.[p.kind]||p.source!==financial.sources[p.market][p.kind]||p.status!==200||!HEX.test(p.sha256||'')||!date(p.observedDate)||p.observedDate>asOf||taipei(p.retrievedAt)!==p.observedDate)throw Error('季度財報收據不符');
   const k=[p.market,p.kind,p.sha256,p.retrievedAt].join('|');if(financialProofs.has(k))throw Error('季度財報收據重複');financialProofs.set(k,p);
  }
  for(const x of bundle.financialRecords){
   const k=[x.market,x.kind,x.sourceSha256,x.retrievedAt].join('|'),p=financialProofs.get(k),id=[x.market,x.code,x.kind,x.year,x.quarter,x.retrievedAt].join('|');
   if(!p||financialIds.has(id)||!(/^[1-9]\d{3}$/.test(x.code||''))||x.source!==p.source||x.observedDate!==p.observedDate||x.unit!=='NTD_THOUSAND'||!Number.isInteger(x.year)||![1,2,3,4].includes(x.quarter)||x.periodEnd!==new Date(Date.UTC(x.year,x.quarter*3,0)).toISOString().slice(0,10)||x.periodEnd>=x.observedDate||!date(x.tableDate)||x.tableDate>x.observedDate||x.basis!==(x.kind==='income'?'YEAR_TO_DATE':'PERIOD_END'))throw Error('季度財報個股資料不符');
   const fields=x.kind==='income'?['revenue','cost','grossProfit','netIncome','eps']:['inventory'];
   if(fields.some(k=>x[k]!==null&&!(typeof x[k]==='number'&&Number.isFinite(x[k])))||x.kind==='income'&&!(x.revenue>0)||x.kind==='balance'&&!(x.inventory>=0&&x.inventory!==null))throw Error('季度財報金額無效');
   financialIds.add(id);const group=x.market+'|'+x.code;if(!financialGroups.has(group))financialGroups.set(group,[]);financialGroups.get(group).push(x);
  }
 }
 return {get:(code,market)=>({...evidence(groups.get(market+'|'+code)||[],{code,market,asOf}),...financial.evaluate(financialGroups.get(market+'|'+code)||[],{code,market,asOf})}),records:bundle.records.length,receipts:proofs.size,companies:new Set([...groups.keys(),...financialGroups.keys()]).size,financialRecords:financialIds.size,financialReceipts:financialProofs.size};

}
async function loadBundle({asOf,snapshotHash,fetcher=globalThis.fetch,signal}={}){
 const get=async path=>{const res=await fetcher(path,{cache:'no-store',signal});if(!res.ok)throw Error('基本面封存 HTTP '+res.status);return res;};
 try{
  const rank=await (await get('data/low-base-breakout/latest.json')).json();
  if(rank?.schema!=='LOW_BASE_BREAKOUT_ARCHIVE_V1'||rank.date!==asOf||rank.snapshotHash!==snapshotHash||rank.fundamentalsConnected!==true||!HEX.test(rank.fundamentalEvidenceHash||''))throw Error('同日基本面封存尚未發布');
  const bytes=await (await get('data/low-base-breakout/fundamentals/'+asOf+'.json')).arrayBuffer();
  if(await digest(bytes)!==rank.fundamentalEvidenceHash)throw Error('基本面封存指紋不符');
  const idx=indexBundle(JSON.parse(new TextDecoder().decode(bytes)),{asOf,snapshotHash});
  return {state:'READY',hash:rank.fundamentalEvidenceHash,...idx};
 }catch(e){return {state:'UNAVAILABLE',reason:String(e.message||e),get:()=>({}),companies:0};}
}

return Object.freeze({SOURCES,SCHEMA,roc,number,taipei,parse,evidence,indexBundle,loadBundle,financial});
});
