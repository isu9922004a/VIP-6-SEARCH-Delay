// Read-only official V9.22 live Worker acceptance; runs from GitHub runner.
// Does not write, configure or deploy the production Worker.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const market = JSON.parse(readFileSync('data/market/research-calendar.json','utf8'));
assert.equal(market.verified,true);
const date=market.dates.at(-1);
assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
const api=new URL('https://shitou-taiwanmarket-api.d318426.workers.dev/');
api.searchParams.set('market','HIGH_VOLATILITY_INPUTS');
api.searchParams.set('date',date);
const response=await fetch(api, {redirect:'manual',signal:AbortSignal.timeout(25000)});
if(response.status!==200) throw Error('Live worker HTTP '+response.status);
const data=await response.json();
assert.equal(data?.type,'HIGH_VOLATILITY_INPUTS');
assert.equal(data.date,date);
const report={date, status:response.status, type:data.type, sources: {}, complete:false};
for(const market of ['TWSE','TPEX']){
  for(const key of ['volume','margin','status']){
    const feed=data.markets?.[market]?.[key];
    const name=market+'.'+key;
    const valid=feed?.date===date && typeof feed.source==='string' &&
      /^https:\/\//.test(feed.source) && Array.isArray(feed.rows) &&
      (key==='status' || feed.rows.length>0) && !feed.error;
    report.sources[name]={
      valid, count:Array.isArray(feed?.rows)?feed.rows.length:null,
      date:feed?.date??null, error:feed?.error??null,
      source:feed?.source??null
    };
  }
}
const o=data.outstanding;
const hasOutstanding=o?.date===date && /^https:\/\//.test(o.source??'') &&
  o.scope==='OUTSTANDING_ORDINARY_SHARES' &&
  o.unit==='shares' && Array.isArray(o.rows) && o.rows.length>0 && !o.error;
report.sources.outstanding={valid:hasOutstanding,count:Array.isArray(o?.rows)?o.rows.length:null,
  date:o?.date??null,error:o?.error??null,scope:o?.scope??null,source:o?.source??null};
report.complete=Object.values(report.sources).every(x=>x.valid);
console.log('V922_LIVE_WORKER_READ_ONLY '+JSON.stringify(report));
if(!report.complete){
  console.log('V922_LIVE_WORKER_NOT_VERIFIED: all seven sources must pass before accepting Top 8');
  if(process.argv.includes('--require-ready')) process.exitCode=1;
} else console.log('V922_LIVE_WORKER_7_SOURCES_READY_FOR_MANUAL_OFFICIAL_COMPARISON');

const publicSite='https://isu9922004a.github.io/VIP-6-SEARCH-Delay/';
const check=async path=>{
  const url=publicSite+path;
  try{
    const reply=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(16000),headers:{'Cache-Control':'no-cache'}});
    const body=reply.status===200?await reply.text():'';
    return { status:reply.status,body };
  }catch(error){return{status:null,body:'',error:error.message};}
};
const [manifestReply,uiReply,coreReply]=await Promise.all([
  check('data/high-volatility/tpex/manifest.json'),
  check('high-volatility-ui-v922.js'),
  check('high-volatility-v922.js')
]);
let parsed=null;
try{parsed=JSON.parse(manifestReply.body);}catch{}
console.log('V922_LIVE_PAGES_PUBLISH_CHECK '+JSON.stringify({
  date,
  manifestStatus:manifestReply.status,
  manifestSchema:parsed?.schema??null,
  manifestDate:parsed?.date??null,
  uiStatus:uiReply.status,
  uiVerifiedV2Recovery:uiReply.body.includes('V922_TPEX_OFFICIAL_MANIFEST_V2') &&
    uiReply.body.includes('上櫃官方同日快照校驗'),
  coreStatus:coreReply.status,
  coreOfficialDenominator:coreReply.body.includes('OFFICIAL_TWSE_LISTED_SHARES') &&
    coreReply.body.includes('TPEx 發行股數'),
  liveWorkerTwseListedPresent:Object.hasOwn(data,'listedShares'),
  liveWorkerTwseListedVerified:data.listedShares?.date===date &&
    data.listedShares?.scope==='OFFICIAL_TWSE_LISTED_SHARES'
}));
