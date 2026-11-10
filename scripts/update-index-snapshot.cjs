'use strict';
// Independent index publication: never waits for individual-stock history/model jobs.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const iso=value=>{const s=String(value??'').replace(/\D/g,'');if(s.length===7)return `${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5)}`;if(s.length===8)return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`;throw Error('Invalid official index date');};
const num=v=>Number(String(v).replaceAll(',','').trim());
function inspectMonth(payload,month){
 if(payload?.stat!=='OK'||String(payload.date).slice(0,6)!==month.replace('-','')||!Array.isArray(payload.data)||!payload.data.length)throw Error('官方大盤月份、狀態或資料未對齊');
 const fields=payload.fields||[],date=fields.indexOf('日期'),volume=fields.indexOf('成交股數'),close=fields.indexOf('發行量加權股價指數');if([date,volume,close].some(i=>i<0))throw Error('官方大盤欄位不完整');
 const rows=payload.data.map(r=>({date:iso(r[date]),volume:num(r[volume]),close:num(r[close])}));if(rows.some((r,i)=>r.date.slice(0,7)!==month||!(r.volume>0&&r.close>0)||i&&r.date<=rows[i-1].date))throw Error('官方大盤成交資料無效');return rows;
}
function build(raw,template,realized,monthly,expectedDate){
 const date=raw?.closeDate,bars=raw?.dailySeries;
 if(raw?.index!=='TAIEX'||raw.type!=='MARKET_INDEX'||date!==expectedDate||raw.dailySeriesMeta?.onlyCompletedBars!==true||!Array.isArray(bars)||bars.length<63||bars.at(-1)?.date!==date||raw.close!==bars.at(-1).close)throw Error(`大盤未更新到最近完成交易日 ${expectedDate}；拒絕發布舊資料`);
 if(template?.verified!==true||!Array.isArray(template.dates)||realized?.verified!==true||!Array.isArray(realized.dates)||realized.end>date)throw Error('缺少已驗證的大盤交易日曆');
 const newDays=monthly.flatMap(m=>inspectMonth(m.payload,m.month)),latest=newDays.find(d=>d.date===date),last=bars.at(-1);
 if(!latest||Math.abs(latest.close-last.close)>.011||Math.abs(latest.volume-last.volume)>1)throw Error('大盤末日指數或成交股數與官方FMTQIK不一致');
 const missing=newDays.filter(d=>d.date>realized.end&&d.date<=date).map(d=>d.date),past=[...realized.dates.filter(d=>d<=date),...missing].sort();
 const dates=[...new Set([...past,...template.dates.filter(d=>d>date)])].sort(),expected=dates.filter(d=>d>=bars[0].date&&d<=date);
 if(JSON.stringify(expected)!==JSON.stringify(bars.map(b=>b.date)))throw Error('大盤日線與官方實際交易日不完整，拒絕補造缺日');
 if(!bars.every((b,i)=>['open','high','low','close'].every(k=>Number.isFinite(b[k])&&b[k]>0)&&Number.isFinite(b.volume)&&b.volume>0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&(!i||b.date>bars[i-1].date)))throw Error('官方大盤OHLCV無效');
 const calendar={...template,dates,end:date,historicalSource:'https://www.twse.com.tw/exchangeReport/FMTQIK',independentIndexCalendar:true,generatedAt:new Date().toISOString()},future=dates.find(d=>d>date);if(!future)throw Error('下一交易日尚未核驗');
 return {instrumentType:'TAIEX',symbol:'TAIEX',market:'TWSE_INDEX',name:'臺灣加權股價指數',closeDate:date,close:last.close,completed:true,dailySeries:bars,dailySeriesMeta:{...raw.dailySeriesMeta,source:raw.source},volumeUnit:'shares',priceAdjustment:{verified:true,basis:'OFFICIAL_INDEX_LEVEL',corporateActionsVerified:null},tradingCalendar:calendar,sourceReceipt:{url:raw.officialSourceRecovery?.priceSource||'https://shitou-taiwanmarket-api.d318426.workers.dev/?market=TAIEX',officialRecovery:raw.officialSourceRecovery||null,retrievedAt:new Date().toISOString(),sha256:sha(JSON.stringify(raw)),officialChecks:monthly.map(m=>({month:m.month,url:m.url,sha256:sha(JSON.stringify(m.payload))})),expectedCompletedDate:expectedDate}};
}
const json=require('./taiex-source-recovery.cjs').json;
async function main(){
 const get=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8')),market=get('data/market/latest.json'),realized=get('data/market/research-calendar.json'),template=get('data/kronos/calendar.json');
 const capture=process.argv.indexOf('--capture'),captured=capture>=0?JSON.parse(fs.readFileSync(process.argv[capture+1],'utf8')):null;
 const {expectedCompletedDate}=await import('./update-market-snapshot.mjs'),expected=expectedCompletedDate(market.marketCalendar),expectedIso=iso(expected),raw=captured?.market||await require('./taiex-source-recovery.cjs').load({expected:expectedIso});
 const monthly=[];let month=realized.end.slice(0,7);while(month<=expectedIso.slice(0,7)){const url='https://www.twse.com.tw/exchangeReport/FMTQIK?response=json&date='+month.replace('-','')+'01',payload=captured?.months?.[month]||await json(url);monthly.push({month,url,payload});const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);month=d.toISOString().slice(0,7);}
 const index=build(raw,template,realized,monthly,expectedIso),old=get('data/index/TAIEX.json');if(old.closeDate>index.closeDate)throw Error('大盤日期倒退，拒絕覆蓋');
 fs.writeFileSync(path.join(ROOT,'data/index/TAIEX.json'),JSON.stringify(index,null,2)+'\n');console.log(JSON.stringify({indexDate:index.closeDate,close:index.close,nextSession:index.tradingCalendar.dates.find(d=>d>index.closeDate),independentOfStocks:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={iso,inspectMonth,build,main};
