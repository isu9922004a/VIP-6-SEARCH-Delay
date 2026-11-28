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
return Object.freeze({SOURCES,roc,number,taipei,parse,evidence});
});
