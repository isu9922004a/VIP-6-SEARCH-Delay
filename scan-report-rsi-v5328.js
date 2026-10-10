(function(root){'use strict';const P=root.ShitouScanPolicy5328;if(!P)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusCache=new Map(),pending=new Map();
function validStatus(s,d){return s?.ready===true&&P.date(s.date)===d&&['twseCodes','tpexCodes','specialCodes'].every(k=>Array.isArray(s[k])&&s[k].every(c=>typeof c==='string'&&/^\d{4,6}$/.test(c)));}
function embeddedStatus(){try{return JSON.parse(document.querySelector('meta[name="shitou-scan-exclusions"]')?.content||'null');}catch(_){return null;}}
const CANONICAL_MARKET_BASE='https://raw.githubusercontent.com/isu9922004a/-VIP-AUTO-SEARCH-N-/main/data/market/';
const LOCAL_MARKET_LATEST='./data/market/latest.json';
const FRESHNESS_RETRY_DELAYS=[0,10000,20000];

function taipeiClock(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {compact:String(parts.year||'')+String(parts.month||'')+String(parts.day||''),weekday:parts.weekday||'',minutes:Number(parts.hour||0)*60+Number(parts.minute||0)};
}
function snapshotDateCompact(s){return String(s?.tradeDate||s?.tradeDateIso||'').replace(/\D/g,'');}
function validMarketSnapshot(s){
 const total=Number(s?.counts?.totalRows),rows=Array.isArray(s?.rows)?s.rows:[];
 return s?.marketCoverageReady===true&&/^\d{8}$/.test(snapshotDateCompact(s))&&rows.length>=1000&&Number.isFinite(total)&&total===rows.length;
}
function shouldRequireToday(s){
 const t=taipeiClock(),closures=Array.isArray(s?.marketCalendar?.closures)?s.marketCalendar.closures:[],special=Array.isArray(s?.marketCalendar?.specialTradingDates)?s.marketCalendar.specialTradingDates:[];
 const same=x=>String(x?.date||'').replace(/\D/g,'')===t.compact;
 if(special.some(same))return t.minutes>=17*60+35;
 if(closures.some(same)||['Sat','Sun'].includes(t.weekday))return false;
 return t.minutes>=17*60+35;
}
function snapshotBundle(s,url){
 const d=snapshotDateCompact(s),iso=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6),rows=s.rows||[];
 const map=new Map(rows.map(q=>[String(q.code),{...q,quoteDate:P.date(q.quoteDate||d)||iso}]));
 const sectorMap=new Map(rows.map(q=>[String(q.code),{industry:q.industry||q.industryName||'',industryCode:q.industryCode||'',industryName:q.industryName||q.industry||''}]));
 const total=rows.length,industryReady=Number(s?.counts?.industryReadyRows||0);
 return {
  map,sectorMap,snapshotRows:total,snapshotDropped:0,exclusionStatus:s.exclusionStatus||null,
  meta:{
   marketCoverageReady:true,
   industryCoverageReady:industryReady>=Math.max(1000,total-20),
   targetTradeDate:iso,completedTradeDate:iso,twseQuoteDate:iso,tpexQuoteDate:iso,total,
   marketCalendar:s.marketCalendar||null,
   snapshotUrl:url,
   snapshotContentSha256:s.contentSha256||null,
   snapshotGeneratedAt:s.generatedAt||null,
   source:'GITHUB_SNAPSHOT_FALLBACK',
   twseRows:Number(s?.counts?.twseRows||0),
   tpexRows:Number(s?.counts?.tpexRows||0)
  }
 };
}
async function fetchSnapshotCandidate(url){
 const join=url.includes('?')?'&':'?',requestUrl=url+join+'_fresh='+Date.now();
 const r=await fetch(requestUrl,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)return null;
 const s=await r.json();
 if(!validMarketSnapshot(s))return null;
 return {snapshot:s,url};
}
async function freshGithubBundleFallback(originalError){
 for(let i=0;i<FRESHNESS_RETRY_DELAYS.length;i++){
  const delay=FRESHNESS_RETRY_DELAYS[i];if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  for(const url of [CANONICAL_MARKET_BASE+'latest.json',LOCAL_MARKET_LATEST]){
   try{
    const hit=await fetchSnapshotCandidate(url);if(!hit)continue;
    const required=shouldRequireToday(hit.snapshot),today=taipeiClock().compact,current=snapshotDateCompact(hit.snapshot);
    if(required&&current!==today)continue;
    return snapshotBundle(hit.snapshot,hit.url);
   }catch(_){/* 下一來源／下一輪 */}
  }
 }
 throw originalError;
}
function remoteStatusUrls(bundle,d){
 // 手機版只讀 GitHub Pages / 受信任的 GitHub Raw 靜態快照，不依賴本機 .cmd / localhost。
 const bases=[CANONICAL_MARKET_BASE];
 try{
  const u=new URL(bundle.meta?.snapshotUrl);
  if(u.origin==='https://raw.githubusercontent.com'&&/^\/isu9922004a\/-VIP-AUTO-SEARCH-N-\/[^/]+\/data\/market\/latest\.json$/.test(u.pathname)){
   bases.unshift(new URL('./',u).href);
  }
 }catch(_){/* snapshotUrl 可省略；仍使用固定受信任 Repo */}
 const urls=[];
 for(const base of [...new Set(bases)]){
  const u=new URL(base);
  urls.push(new URL('exclusions/'+d+'.json',u).href,new URL('scan-exclusions.json',u).href,new URL('latest.json',u).href);
 }
 return [...new Set(urls)];
}
async function statusFor(bundle){
 const d=P.date(bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate);if(!d)throw Error('市場日期缺失，不能確認全額交割排除');
 for(const s of [bundle.exclusionStatus,statusCache.get(d),root.ShitouOfflineScanExclusions5328,embeddedStatus()])if(validStatus(s,d)){statusCache.set(d,s);return s;}
 if(pending.has(d))return pending.get(d);
 const promise=(async()=>{
  const diagnostics=[];
  const localUrls=root.location?.protocol==='file:'?[]:['./data/market/exclusions/'+d+'.json','./data/market/scan-exclusions.json'];
  async function load(url){
   try{
    const join=url.includes('?')?'&':'?',requestUrl=url+join+'_fresh='+Date.now();
    const r=await fetch(requestUrl,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!r.ok){diagnostics.push('HTTP '+r.status);return null;}
    const payload=await r.json(),s=payload?.exclusionStatus||payload;
    if(validStatus(s,d)){statusCache.set(d,s);return s;}
    diagnostics.push('名單日期 '+(P.date(s?.date)||'未提供'));
   }catch(e){diagnostics.push(e?.name==='TimeoutError'?'連線逾時':'資料同步中');}
   return null;
  }
  for(const url of [...localUrls,...remoteStatusUrls(bundle,d)]){const s=await load(url);if(s)return s;}
  const extra=diagnostics.length?'｜'+[...new Set(diagnostics)].join('／'):'';
  throw Error('全額交割排除名單尚未完成同步（行情日 '+d+'）。手機版會直接讀取 GitHub Pages／GitHub Actions 自動更新的同日官方名單，無需另開本機程式。請稍後重新查詢'+extra+'；資料日期一致後會自動恢復掃描。');
 })();pending.set(d,promise);try{return await promise;}finally{if(pending.get(d)===promise)pending.delete(d);}
}
const loader=root.loadMarketBundleFromWorkerV3766;
if(typeof loader==='function')root.loadMarketBundleFromWorkerV3766=async function(...args){
 let b;
 try{b=await loader.apply(this,args);}
 catch(error){b=await freshGithubBundleFallback(error);}
 try{
  const meta=b?.meta||{},target=P.date(meta.targetTradeDate||meta.completedTradeDate),today=P.date(taipeiClock().compact);
  if(shouldRequireToday({marketCalendar:meta.marketCalendar})&&target&&today&&target!==today)b=await freshGithubBundleFallback(new Error('今日盤後市場快照尚未同步'));
 }catch(_){/* 由後續正式驗證處理 */}
 return P.applyStatus(b,await statusFor(b));
};
function restricted(bundle){const groups={},map=new Map();for(const [code,q] of bundle.map){const decision=P.classify(code,q,bundle.sectorMap?.get(code),bundle.meta);if(decision.excluded){(groups[decision.key]||(groups[decision.key]=[])).push({code,name:q.name||code,reason:decision.reason});}else map.set(code,q);}return {bundle:{...bundle,map},groups};}
function poolHook(name,daytrade){const original=root[name];if(typeof original!=='function')return;root[name]=function(bundle,...args){const f=restricted(bundle),result=original.call(this,f.bundle,...args),g=f.groups;result.exclusionAudit=Object.fromEntries(Object.entries(g).map(([key,rows])=>[key,rows.length]));(root.ShitouScanAudits5328||(root.ShitouScanAudits5328={}))[daytrade?'daytrade':'momentum']={date:P.date(bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate),counts:result.exclusionAudit};for(const [key,group] of [['FINANCIAL','financial'],['BIOTECH','biotech'],['ILLIQUID',daytrade?'liquidity':null]])if(group)result[group]=[...(result[group]||[]),...(g[key]||[]).map(x=>x.code)];if(!daytrade){for(const rows of Object.values(g))for(const row of rows){result.rejected.push(row);result.breakdown[row.reason]=(result.breakdown[row.reason]||0)+1;}result.nonOrdinary.push(...Object.entries(g).filter(([k])=>['DR','SPECIAL','FULL_DELIVERY','CONSTRUCTION','STATUS_UNKNOWN','UNKNOWN'].includes(k)).flatMap(([,rows])=>rows.map(x=>x.code)));}return result;};}
poolHook('buildMomentumPoolV377737',false);poolHook('buildDayTradePhase1PoolV1',true);
for(const name of ['momentumCandidateV3768','dayTradeCandidateV1']){const original=root[name];if(typeof original==='function')root[name]=function(report,...args){const c=original.call(this,report,...args),l=P.liquidity(report);if(!c||!l.known||l.ok)return c;return {...c,eligible:false,formalLaunchEligible:false,safeEligible:false,hardGateFail:name==='momentumCandidateV3768',baseFilterFail:name==='dayTradeCandidateV1',reason:l.reason,baseFails:[...(c.baseFails||[]),l.reason],hardFails:[...(c.hardFails||[]),l.reason]};};}
function candidates(scan){const seen=new Set();return ['candidates','launchCandidates','safeCandidates','strengthCandidates'].flatMap(key=>Array.isArray(scan?.[key])?scan[key]:[]).filter(c=>{const code=String(c.report?.stock||c.report?.code||c.code||'');if(!code||seen.has(code))return false;seen.add(code);return true;});}
function reportText(text,input){if(typeof text!=='string'||!input)return text;const list=candidates(input);if(list.length){const rows=list.map(c=>`${c.name||c.report?.name||''}（${c.report?.stock||c.report?.code||c.code}）｜${P.rsiText(c,true)}\n${P.volumeText(c)}`);const block='【各股 RSI 5T 與收盤成交量】\n'+rows.join('\n');return text.includes(block)?text:text+'\n\n'+block+(input.sharedExclusionAudit?'\n共用排除：'+Object.entries(input.sharedExclusionAudit.counts).map(([key,n])=>(P.LABELS[key]||key)+' '+n+' 檔').join('｜'):'');}if(input.dailySeries||input.report||input.code||input.stock){const x=P.rsiStatus(input),line=P.rsiText(input,true);return text.includes('【RSI 5T 數值】')?text:'【RSI 5T 數值】'+line+'\n'+P.volumeText(input)+'\n'+x.maText+'\n'+x.note+'\n'+text;}return text;}
for(const name of ['buildNewbieLookHereV3318','buildTradeabilityTextV377733','buildMoneyFlowRadarTextV45','buildReportText','buildReportTextV32','buildReportTextV321','buildReportTextV322','buildReportTextV325','buildReportTextV326','buildLegacyReportText','buildMomentumScanTextReportV3763','buildMomentumScanCompactTextReportV377713','buildDayTradeTextReportV1','buildMarketWorkerReportText']){const original=root[name];if(typeof original==='function')root[name]=function(input,...args){return reportText(original.call(this,input,...args),input);};}
function decorateRows(container,scan){const list=candidates(scan);if(!container)return;const cards=[...container.children];cards.forEach(card=>{const c=list.find(c=>card.textContent.includes(String(c.report?.stock||c.report?.code||c.code||'###')));if(!c)return;let badge=card.querySelector('.rsi-5328');if(!badge){badge=document.createElement('div');badge.className='rsi-5328';card.appendChild(badge);}badge.innerHTML=esc(P.rsiText(c,true))+'<br>'+esc(P.volumeText(c));badge.dataset.rsiKey=P.rsiStatus(c).key;badge.dataset.code=c.report?.stock||c.report?.code||c.code;});}
for(const [name,id] of [['renderMomentumScanResultV3762','momentumList'],['renderMomentumScanResultV3765','momentumList'],['renderDayTradeScanResultV1','dayTradeList']]){const original=root[name];if(typeof original==='function')root[name]=function(scan,...args){const result=original.call(this,scan,...args),audit=root.ShitouScanAudits5328?.[id==='dayTradeList'?'daytrade':'momentum'];if(audit&&audit.date===P.date(scan.dataDate||scan.marketBundleMeta?.targetTradeDate||scan.marketBundleMeta?.completedTradeDate)){scan.sharedExclusionAudit=audit;const target=document.getElementById(id);let note=document.getElementById(id+'Policy5328');if(!note&&target){note=document.createElement('div');note.id=id+'Policy5328';note.className='meta';target.before(note);}if(note)note.textContent='共用排除：'+Object.entries(audit.counts).map(([key,n])=>(P.LABELS[key]||key)+' '+n+' 檔').join('｜');}decorateRows(document.getElementById(id),scan);return result;};}
const style=document.createElement('style');style.id='report-contrast-r5328';style.textContent=`
:root{--muted:#384f67;--yellow:#7b4d08;--green:#0d6547;--red:#a01f37}
body:not(.dark):not(.dark-mode) .meta,body:not(.dark):not(.dark-mode) .sub,body:not(.dark):not(.dark-mode) .label{color:#354c63}
body:not(.dark):not(.dark-mode) pre,body:not(.dark):not(.dark-mode) textarea{color:#152f48}
.rsi-5328{margin-top:9px;padding:8px 12px;font-weight:850;background:#fff3dc;color:#754307;border:1px solid #d8b981;border-radius:9px;line-height:1.55}
.rsi-5328[data-rsi-key="OVERHEAT"],.rsi-5328[data-rsi-key="LOST_70"]{background:#fff0f2;color:#a01f37;border-color:#d7a2ae}
body.dark .rsi-5328,body.dark-mode .rsi-5328{background:#24384c;color:#ffdfa0;border-color:#58728b}
body.dark .meta,body.dark-mode .meta,body.dark .sub,body.dark-mode .sub,body.dark .label,body.dark-mode .label{color:#e0eaf4}
`;document.head.appendChild(style);
// Only text paints are remapped: chart candles, backgrounds and other graphics keep their colors.
const contrast={'#60748a':'#3d536b','#66758a':'#3d5269','#677386':'#3b4e65','#536174':'#354c62','#5c6d80':'#354c63','#64748b':'#354c63','#9b6509':'#764605','#a65f08':'#804506','#926020':'#754607','#198357':'#096b43'};
if(root.CanvasRenderingContext2D){const proto=root.CanvasRenderingContext2D.prototype;for(const method of ['fillText','strokeText']){const original=proto[method];proto[method]=function(...args){const saved=this.fillStyle;let replacement=typeof saved==='string'?contrast[saved.toLowerCase()]:null;const color=String(saved),match=String(args[0]).match(/RSI 5T\s+(\d+(?:\.\d+)?)/);if(match&&/^#[0-9a-f]{6}$/i.test(color)&&parseInt(color.slice(1,3),16)+parseInt(color.slice(3,5),16)+parseInt(color.slice(5,7),16)<420)replacement=String(args[0]).includes('跌回70')?'#a01f37':P.rsiStatus({dailyRsi5:Number(match[1])}).color;if(replacement)this.fillStyle=replacement;try{return original.apply(this,args);}finally{this.fillStyle=saved;}};}}
root.ShitouScanReport5328=Object.freeze({restricted,reportText,decorateRows,statusFor});
})(typeof globalThis!=='undefined'?globalThis:this);
