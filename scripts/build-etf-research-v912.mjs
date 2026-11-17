// V9.12: official TWSE ETF completed-session OHLCV; never a strategy candidate.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const CODES=Object.freeze({'0050':'元大台灣50','0056':'元大高股息','006208':'富邦台50','00878':'國泰永續高股息','00919':'群益台灣精選高息'});
const ENDPOINT='https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY';
const num=x=>{const s=String(x??'').replaceAll(',','').trim();return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null;};
const roc=s=>{const m=String(s).trim().match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);if(!m)throw Error('官方交易日期格式異常 '+s);const d=(+m[1]+1911)+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');if(new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw Error('不合理日期 '+d);return d;};
function parseMonth(json,code,month){
 if(json?.stat!=='OK'||!Array.isArray(json.fields)||!Array.isArray(json.data))throw Error(code+' '+month+' 官方月資料未成功');
 const f=json.fields.map(v=>String(v).replace(/<[^>]+>/g,'').trim()),ix=keys=>f.findIndex(x=>keys.some(k=>x.includes(k)));
 const i={date:ix(['日期']),volume:ix(['成交股數']),open:ix(['開盤價']),high:ix(['最高價']),low:ix(['最低價']),close:ix(['收盤價'])};
 if(Object.values(i).some(k=>k<0))throw Error(code+' '+month+' 官方欄位不完整：'+f.join(','));
 const rows=[];
 for(const row of json.data){
  const date=roc(row[i.date]);if(date.slice(0,7)!==month)throw Error(code+' 意外交易月份 '+date);
  const b={date,open:num(row[i.open]),high:num(row[i.high]),low:num(row[i.low]),close:num(row[i.close]),volume:num(row[i.volume])};
  if(Object.values(b).slice(1).some(x=>!Number.isFinite(x))||b.low<=0||b.high<b.low||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||!Number.isInteger(b.volume)||b.volume<0)throw Error(code+' '+date+' 無效開高低收或成交股數');
  rows.push(b);
 }
 if(new Set(rows.map(x=>x.date)).size!==rows.length)throw Error(code+' '+month+' 日期重複');
 return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
async function requestMonth(code,month,fetcher=fetch){
 const u=new URL(ENDPOINT);u.searchParams.set('response','json');u.searchParams.set('date',month.replace('-','')+'01');u.searchParams.set('stockNo',code);
 let last;
 for(let a=0;a<3;a++)try{
  const response=await fetcher(u.toString(),{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36','Referer':'https://www.twse.com.tw/zh/trading/historical/stock-day.html'},signal:AbortSignal.timeout(23000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const raw=await response.text();if(!/json/i.test(response.headers.get('content-type')||''))throw Error('非JSON回應');
  return {bars:parseMonth(JSON.parse(raw),code,month),source:u.toString(),sha256:sha(raw)};
 }catch(e){last=e;if(a<2)await new Promise(resolve=>setTimeout(resolve,1200*(a+1)));}
 throw Error(code+' '+month+' 來源失敗 '+last.message);
}
function monthsBack(date,n=11){const d=new Date(date.slice(0,7)+'-01T00:00:00Z');return Array.from({length:n},(_,i)=>{const z=new Date(d);z.setUTCMonth(z.getUTCMonth()-i);return z.toISOString().slice(0,7)}).reverse();}
function build(code,name,date,calendar,months){
 const map=new Map(),sources=[];
 for(const m of months)for(const b of m.bars){if(b.date>date)continue;if(map.has(b.date))throw Error(code+' 同日重複');map.set(b.date,b);}
 const expected=calendar.filter(d=>d<=date).slice(-160);
 let cut=null;for(const d of expected)if(!map.has(d)||map.get(d).volume<=0)cut=d;
 let bars=expected.map(d=>map.get(d)).filter(b=>b&&b.volume>0&&(!cut||b.date>cut)).slice(-160);
 const ready=bars.length>=63&&bars.at(-1)?.date===date;
 const reason=ready?null:'官方完成日 K 有效連續資料只有 '+bars.length+' 根，至少需要63根且最後一日須為 '+date;
 const used=new Set(bars.map(b=>b.date.slice(0,7)));
 for(const m of months.filter(m=>used.has(m.month)))sources.push({month:m.month,source:m.source,sourceSha256:m.sha256});
 const report={schema:'SHITOU_ETF_DAILY_RESEARCH_V912',stock:code,code,name,market:'TWSE',securityType:'ETF',scanMode:'DAILY_ONLY',dailyOnly:true,closeDate:date,marketDate:date,close:bars.at(-1)?.close??null,completed:true,isComplete:true,volumeUnit:'shares',dailySeries:bars,canonicalBars:bars,dailySeriesMeta:{schema:'daily-ohlcv-v1',mode:'DAILY_ONLY',source:'TWSE_STOCK_DAY_OFFICIAL_ETF',onlyCompletedBars:true,volumeUnit:'shares'},priceAdjustment:{verified:true,basis:'UNADJUSTED_OFFICIAL_OHLC',source:'TWSE每日原始成交價',corporateActionsVerified:false},etfResearchOnly:true,monthlyPass:null,entry:null,officialMonthlyUnavailable:true,etfSourceAudit:{type:'TWSE_OFFICIAL_ETF',asOf:date,sourceMonths:sources,historyBars:bars.length,completed:true,noSyntheticPrices:true,distributionAndNAVNotVerified:true},expectedTradingDates:calendar.filter(d=>bars.length&&d>=bars[0].date&&d<=date)};
 return {report,ready,reason,bars:bars.length};
}
async function main({fetcher=fetch,root=process.cwd()}={}){
 const market=JSON.parse(await fs.readFile(root+'/data/market/latest.json','utf8')),date=market.tradeDateIso;
 const calendar=JSON.parse(await fs.readFile(root+'/data/market/research-calendar.json','utf8'));
 if(!market.marketCoverageReady||!calendar.verified||calendar.sourceSnapshotDate!==date||calendar.dates.at(-1)!==date)throw Error('ETF需等待已完成的官方交易日與市場日曆一致');
 const out=root+'/data/etf/'+date;await fs.mkdir(out,{recursive:true});
 const instruments={},months=monthsBack(date),failed=[];
 for(const [code,name] of Object.entries(CODES)){
  try{
   const source=[];for(const month of months){const m=await requestMonth(code,month,fetcher);source.push({...m,month});await new Promise(resolve=>setTimeout(resolve,1000));}
   const x=build(code,name,date,calendar.dates,source),raw=JSON.stringify(x.report)+'\n';
   await fs.writeFile(out+'/'+code+'.json',raw);
   instruments[code]={code,name,type:'ETF',market:'TWSE',path:date+'/'+code+'.json',sha256:sha(raw),ready:x.ready,bars:x.bars,reason:x.reason,close:x.report.close};
   console.log('ETF_OFFICIAL_'+code+' '+x.bars+' bars '+(x.ready?'READY':'PENDING'));
  }catch(e){failed.push(code+': '+e.message);console.error('ETF_SOURCE_FAILURE '+code+' '+e.message);}
 }
 if(failed.length||Object.keys(instruments).length!==Object.keys(CODES).length)throw Error('ETF官方資料未全數核驗，拒絕發布：'+failed.join('；'));
 const manifest={schema:'SHITOU_ETF_MANIFEST_V912',verified:true,date,generatedAt:new Date().toISOString(),source:'TWSE_STOCK_DAY_OFFICIAL_ETF',securityType:'ETF',selectionEligible:false,scannerUniverseModified:false,instruments};
 await fs.writeFile(root+'/data/etf/manifest.json',JSON.stringify(manifest)+'\n');
 console.log('ETF_V912_PUBLISHED '+JSON.stringify({date,codes:Object.keys(instruments),ready:Object.values(instruments).filter(x=>x.ready).length}));
}
export {CODES,ENDPOINT,parseMonth,requestMonth,monthsBack,build,main};
if(process.argv[1]?.endsWith('build-etf-research-v912.mjs'))main().catch(e=>{console.error(e);process.exitCode=1;});
