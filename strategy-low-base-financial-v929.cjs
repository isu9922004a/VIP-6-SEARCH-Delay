/* General-industry cumulative official financial statements. No as-of backfill. */
'use strict';
const F=require('./strategy-low-base-fundamentals-v929.js');
const sources=Object.freeze({
 TWSE:{income:'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci',balance:'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_ci'},
 TPEX:{income:'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap06_O_ci',balance:'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap07_O_ci'}
});
const hex=/^[a-f0-9]{64}$/,iso=/^\d{4}-\d{2}-\d{2}$/;
function parse(rows,market,kind,receipt){
 if(!sources[market]?.[kind]||receipt?.source!==sources[market][kind]||receipt.status!==200||!hex.test(receipt.sha256||'')||!F.taipei(receipt.retrievedAt)||!Array.isArray(rows)||rows.length<(market==='TWSE'?700:500))throw Error('財報來源收據或筆數不足');
 const observedDate=F.taipei(receipt.retrievedAt),records=new Map(),errors=[];
 for(const row of rows){
  // Only use the explicitly documented identity aliases. Inspect actual schemas before expanding.
  const code=String(row['公司代號']??row.SecuritiesCompanyCode??'').trim(),rawYear=String(row['年度']??row.Year??'').trim(),q=Number(row['季別']??row.Quarter),tableDate=F.roc(row['出表日期']??row.Date),year=/^\d{3}$/.test(rawYear)?Number(rawYear)+1911:/^\d{4}$/.test(rawYear)?Number(rawYear):null;
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
module.exports=Object.freeze({sources,parse,evaluate});
