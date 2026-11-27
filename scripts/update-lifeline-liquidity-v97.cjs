/* Dated, official turnover facts for both exchanges. Never estimate turnover. */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),path=require('node:path');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const number=s=>{const v=Number(String(s??'').replaceAll(',',''));return Number.isFinite(v)?v:null;};
function parseSecurities(bytes,market){
 const text=new TextDecoder('big5').decode(bytes),asOf=text.match(/最近更新日期[:：]\s*(\d{4})\/(\d\d)\/(\d\d)/)?.slice(1).join('-');if(!asOf)throw Error('官方商品主檔缺少更新日期');
 const records={};for(const tr of text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1].replace(/<[^>]*>/g,'').replace(/&nbsp;|&#12288;/g,' ').trim());if(cells.length<6)continue;const code=cells[0].split(/[\s\u3000]+/)[0];if(!/^\d{4,6}$/.test(code)||cells[3]!==({'TWSE':'上市','TPEX':'上櫃'})[market])continue;records[code]={code,market,cfi:cells[5],isin:cells[1],listingDate:cells[2].replaceAll('/','-'),industryName:cells[4],asOf,type:cells[5]==='ESVUFR'?'COMMON':'OTHER'};}
 if(Object.keys(records).length<500)throw Error('官方商品主檔不完整');return {records,source:{market,asOf,url:'https://isin.twse.com.tw/isin/C_public.jsp?strMode='+(market==='TWSE'?2:4),sha256:digest(bytes)}};
}
function parse(text,market,date){
 const data=JSON.parse(text),actual=String(data.date||'').replaceAll('/','').replaceAll('-',''),roc=String(Number(date.slice(0,4))-1911)+date.slice(5).replace('-','');
 if(String(data.stat).toUpperCase()!=='OK'||![date.replaceAll('-',''),roc].includes(actual))throw Error('官方成交金額回應日期或狀態錯誤：'+market);
 const table=data.tables?.find(t=>t.fields?.includes(market==='TWSE'?'證券代號':'代號')&&t.fields?.includes(market==='TWSE'?'成交金額':'成交金額(元)'));if(!table)throw Error('官方日報缺少成交金額欄位');
 const names=market==='TWSE'?{code:'證券代號',open:'開盤價',high:'最高價',low:'最低價',close:'收盤價',volume:'成交股數',tradeValue:'成交金額'}:{code:'代號',open:'開盤',high:'最高',low:'最低',close:'收盤',volume:'成交股數',tradeValue:'成交金額(元)'};
 const source=market==='TWSE'?`https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${date.replaceAll('-','')}&type=ALLBUT0999`:`https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${date.replaceAll('-','/')}&type=EW&response=json`;
 const records={};for(const row of table.data||[]){const code=String(row[table.fields.indexOf(names.code)]).trim();if(!/^\d{4,6}$/.test(code))continue;const r={code,market,date,verified:true};for(const k of ['open','high','low','close','volume','tradeValue'])r[k]=number(row[table.fields.indexOf(names[k])]);if(['open','high','low','close','volume','tradeValue'].every(k=>r[k]>0))records[code]=r;}
 return {records,source:{url:source,sha256:digest(text),date,market,count:Object.keys(records).length}};
}
// Bound retries per official source; never publish unverified or estimated facts.
async function fetchOfficial(url,{timeout=30000,kind='official',fetcher=globalThis.fetch,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),log=message=>console.error(message)}={}){
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const response=await fetcher(url,{signal:AbortSignal.timeout(timeout)});
   if(!response.ok){const error=Error('HTTP '+response.status);error.retryable=[408,429].includes(response.status)||response.status>=500;throw error;}
   return Buffer.from(await response.arrayBuffer());
  }catch(error){
   const retryable=error.retryable===true||['TimeoutError','AbortError','TypeError'].includes(error.name);
   const message=kind+' '+url+' attempt '+attempt+'/2: '+error.message;
   log(message);
   if(attempt===2||!retryable)throw Error(message,{cause:error});
   await delay(1500);
  }
 }
}
async function main(){
 const root=path.resolve(__dirname,'..'),snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/market/latest.json'))),date=snapshot.tradeDateIso;
 if(snapshot.marketCoverageReady!==true)throw Error('保留前次檔案：官方市場快照尚未完整');
 const results=[],securitySources=[];for(const market of ['TWSE','TPEX']){
  let text;if(process.env.V97_OFFICIAL_FIXTURES==='1')text=zlib.gunzipSync(fs.readFileSync(path.join(root,`scripts/fixtures/v932-source-${date}-${market}.json.gz`))).toString();
  else{const url=market==='TWSE'?`https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${date.replaceAll('-','')}&type=ALLBUT0999`:`https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${date.replaceAll('-','/')}&type=EW&response=json`;text=(await fetchOfficial(url,{timeout:30000,kind:market+' 日報'})).toString('utf8');}
  const parsed=parse(text,market,date);let masterBytes;
  if(process.env.V97_OFFICIAL_FIXTURES==='1')masterBytes=zlib.gunzipSync(fs.readFileSync(path.join(root,`scripts/fixtures/v97-isin-2026-11-15-${market}.html.gz`)));
  else{masterBytes=await fetchOfficial('https://isin.twse.com.tw/isin/C_public.jsp?strMode='+(market==='TWSE'?2:4),{timeout:60000,kind:market+' 商品主檔'});}
  const master=parseSecurities(masterBytes,market);if(master.source.asOf<date)throw Error('商品主檔落後於掃描日');securitySources.push(master.source);for(const r of Object.values(parsed.records))r.security=master.records[r.code]||null;
  results.push(parsed);
 }
 const records=Object.assign({},...results.map(r=>r.records));for(const q of snapshot.rows){const r=records[q.code];if(!r||r.market!==q.market||['open','high','low','close'].some(k=>r[k]!==q[k]))throw Error('保留前次檔案：來源價格與市場快照不一致 '+q.code);}
 const selected=Object.fromEntries(snapshot.rows.map(q=>[q.code,records[q.code]]));
 const out={schema:'LIFELINE_OFFICIAL_TURNOVER_V97',verified:true,date,snapshotContentSha256:snapshot.contentSha256,sources:results.map(r=>r.source),securitySources,records:selected};
 const target=path.join(root,'lifeline-liquidity-v97.json'),body=JSON.stringify(out)+'\n';fs.writeFileSync(target+'.tmp',body);fs.renameSync(target+'.tmp',target);console.log(JSON.stringify({date,records:Object.keys(records).length,sha256:digest(body)}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={parse,parseSecurities,digest,fetchOfficial};
