// Reproducible review of limited histories against downloaded official sources.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {extractTwseMiIndexRows,extractTpexDailyQuoteRows,normalizeQuote} from './update-market-snapshot.mjs';
const folder=process.argv[2];if(!folder)throw Error('Provide a directory containing the captured official sources.');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),root=process.cwd(),manifest=JSON.parse(fs.readFileSync('data/research/manifest.json')),stocks={};
const masters={TWSE:{file:'twse-companies.json',source:'https://openapi.twse.com.tw/v1/opendata/t187ap03_L',code:'公司代號',date:'上市日期'},TPEX:{file:'tpex-companies.json',source:'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O',code:'SecuritiesCompanyCode',date:'DateOfListing'}};
for(const m of Object.values(masters)){const raw=fs.readFileSync(path.join(folder,m.file));m.rows=JSON.parse(raw);m.sha256=sha(raw);}
const iso=v=>{const s=String(v||'').replace(/\D/g,'');if(s.length===8)return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`;if(s.length===7)return `${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5)}`;return null;};
let monthly=[];try{monthly=JSON.parse(fs.readFileSync(path.join(folder,'monthly-review.json')));}catch(_){}
const quotes=new Map(JSON.parse(fs.readFileSync('data/market/latest.json')).rows.map(q=>[q.code,q]));
const scopeConflict=q=>q&&q.volume>0&&q.officialTradeValue>0&&(q.officialTradeValue/q.volume<q.low-.02||q.officialTradeValue/q.volume>q.high+.02);
for(const item of Object.values(manifest.stocks).filter(x=>x.bars<63||/^91/.test(x.code)||scopeConflict(quotes.get(x.code)))){
 const report=JSON.parse(fs.readFileSync(path.join(root,'data/research',item.path))),original=report.originalDailySeries||[],gapDate=report.officialArchiveEvidence.excludedEarlierSessions.at(-1)||null;
 const master=masters[item.market],company=master.rows.find(x=>String(x[master.code])===item.code),listingDate=iso(company?.[master.date]);
 const listing=listingDate?{date:listingDate,source:master.source,sourceSha256:master.sha256}:null;
 let latestGap=gapDate?{date:gapDate,status:'UNVERIFIED',reason:'缺少有效報價日的原始官方回應尚未核對'}:null;
 if(gapDate&&original.length>=63){
  try{const file=path.join(folder,item.market+'-'+gapDate+'.json'),raw=fs.readFileSync(file),payload=JSON.parse(raw),rows=(item.market==='TWSE'?extractTwseMiIndexRows:extractTpexDailyQuoteRows)(payload,gapDate.replaceAll('-',''));if(rows.length<(item.market==='TWSE'?800:600))throw Error('Returned date or table size mismatch');const row=rows.find(r=>String(r.Code||r['證券代號']||r['代號']).trim()===item.code),volume=row?Number(String(row.TradeVolume??row['成交股數']??'').replaceAll(',','')):null;
   latestGap={date:gapDate,status:row&&volume===0?'OFFICIAL_NO_TRADE':row&&!normalizeQuote(row,item.market,gapDate.replaceAll('-',''),new Map())?'OFFICIAL_NO_OHLC':row?'OFFICIAL_VALID_ROW_FOUND':'ABSENT_FROM_OFFICIAL_TABLE',volume,source:item.market==='TWSE'?`https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${gapDate.replaceAll('-','')}&type=ALLBUT0999`:`https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${gapDate.replaceAll('-','/')}&type=EW&response=json`,sourceSha256:sha(raw)};
  }catch(error){latestGap.reason=error.message;}
 }
 if(latestGap?.status==='ABSENT_FROM_OFFICIAL_TABLE')try{
  const entry=monthly.find(x=>x.code===item.code&&x.date===gapDate&&!x.error);if(entry){const raw=fs.readFileSync(entry.path),m=JSON.parse(raw),rows=Array.isArray(m.data)?m.data:(m.tables||[]).flatMap(t=>t.data||[]),month=gapDate.slice(0,7),identity=item.market==='TWSE'?String(m.title||'').includes(item.code):String(m.code)===item.code;
   if(sha(raw)===entry.sourceSha256&&String(m.stat).toUpperCase()==='OK'&&identity&&String(m.date).replaceAll('/','').slice(0,6)===month.replace('-','')&&rows.length&&!rows.some(r=>iso(r[0])===gapDate))latestGap={...latestGap,status:'OFFICIAL_NO_SESSION',secondarySource:entry.source,secondarySourceSha256:entry.sourceSha256,reason:'官方全市場日報與個股月報均無該日有效行情'};
  }
 }catch(_){}
 stocks[item.code]={code:item.code,name:item.name,market:item.market,reportSha256:item.sha256,originalBars:original.length,consecutiveBars:report.dailySeries.length,listing,latestGap,classification:/^91/.test(item.code)?'DR_RULES':scopeConflict(quotes.get(item.code))?'VOLUME_SCOPE':listingDate&&original.length<63&&listingDate<=report.dailySeries[0]?.date&&listingDate>=manifest.researchSessions[0]?'RECENT_MARKET_LISTING':['OFFICIAL_NO_TRADE','OFFICIAL_NO_OHLC','OFFICIAL_NO_SESSION'].includes(latestGap?.status)?latestGap.status:original.length<63?'SHORT_HISTORY':'GAP_REVIEW_REQUIRED'};
}
const out={schema:'OFFICIAL_HISTORY_COVERAGE_V1',date:manifest.date,generatedAt:new Date().toISOString(),count:Object.keys(stocks).length,stocks},text=JSON.stringify(out)+'\n';fs.writeFileSync('data/research/history-coverage.json',text);manifest.historyCoverage={path:'history-coverage.json',sha256:sha(text),date:manifest.date};fs.writeFileSync('data/research/manifest.json',JSON.stringify(manifest)+'\n');
console.log(JSON.stringify({checked:out.count,categories:Object.values(stocks).reduce((a,s)=>(a[s.classification]=(a[s.classification]||0)+1,a),{})}));
