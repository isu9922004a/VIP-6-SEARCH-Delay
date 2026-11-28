/* V9.29 post-close lifecycle candidate. Inputs must be independently verified completed daily bars. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouLowBaseLifecycleV929=api;})(globalThis,function(){
'use strict';
function track(signal,bars,asOf){
 const unavailable=reason=>({state:'UNAVAILABLE',reason,asOf});
 if(signal?.eligible!==true||!signal.date||!Array.isArray(bars)||!asOf||signal.date>asOf)return unavailable('缺少已確認突破訊號或指定交易日');
 if(bars.some((b,i)=>!b.date||b.date>asOf||i>0&&b.date<=bars[i-1].date||!['open','high','low','close','volume'].every(k=>Number.isFinite(b[k]))||b.low<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.volume<=0))return unavailable('日K順序、日期或價量無效');
 if(bars.at(-1)?.date!==asOf)return unavailable('缺少指定日完成行情');
 const i=bars.findIndex(b=>b.date===signal.date);
 if(i<19||i!==bars.findLastIndex(b=>b.date===signal.date))return unavailable('缺少突破日或歷史資料');
 const s=bars[i],ma=(n,j)=>j>=n-1?bars.slice(j-n+1,j+1).reduce((a,c)=>a+c.close,0)/n:null;
 if(!Number.isFinite(signal.features?.ma20)||!Number.isFinite(signal.features?.vma5)||signal.features.vma5<=0||s.close!==signal.features?.close||s.volume!==signal.features?.volume||Math.abs(ma(20,i)-signal.features.ma20)>1e-8)return unavailable('突破日行情與原始訊號不一致');
 // Candidate definition: follow-up volume must be at least the pre-signal five-session mean. This threshold is not calibrated by performance research.
 const volumeFloor=signal.features.vma5;
 let state='INITIAL',failureDate=null,lastVolumeHealthy=null,confirmedAt=null;
 for(let j=i+1;j<bars.length&&j-i<=5;j++){
 const b=bars[j],m=ma(20,j),m60=ma(60,j),age=j-i;
 if(b.close<s.low||b.close<m){state='FAILED';failureDate=b.date;break;}
 if(b.close/m-1>.08||m60!==null&&b.close/m60-1>.20){state='OVERHEATED';continue;}
 lastVolumeHealthy=b.volume>=volumeFloor;
 if(age===1&&b.close>=s.close&&lastVolumeHealthy){state='CONFIRMED';confirmedAt=b.date;}
 else if(age>=2&&b.close>=s.close&&b.close>=bars[j-1].close&&lastVolumeHealthy){state='DEVELOPING';confirmedAt??=b.date;}
 else state='WATCH';
 }
 const age=bars.length-1-i;
 if(age>5&&state!=='FAILED')state='EXPIRED';
 return {state,age,asOf,signalDate:s.date,breakoutPrice:s.close,breakoutLow:s.low,ma20:ma(20,bars.length-1),failureDate,confirmedAt,volumeFloor,lastVolumeHealthy,scope:'盤後候選追蹤，並非買賣指令'};
}

const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const SNAP_KEYS=['schemaVersion','tradeDate','tradeDateIso','marketCoverageReady','marketCalendar','rows','counts','officialSources','sourceMeta'];
async function hash(value){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)throw Error('瀏覽器缺少安全資料指紋驗證');
 return Array.from(new Uint8Array(await subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function verifyArchive(s,date){
 const compact=date.replaceAll('-',''),n=s?.counts;
 if(!day(date)||s?.tradeDateIso!==date||s.tradeDate!==compact||s.marketCoverageReady!==true||!Array.isArray(s.rows)||!n||n.twseRows<800||n.tpexRows<600||n.totalRows!==s.rows.length||n.totalRows!==n.twseRows+n.tpexRows)throw Error('封存日期或市場範圍不符');
 const map=new Map(),counts={TWSE:0,TPEX:0};
 for(const q of s.rows){
  if(!q||!(/^\d{4}$/.test(String(q.code)))||map.has(String(q.code))||!Object.hasOwn(counts,q.market)||String(q.quoteDate).replaceAll('-','')!==compact)throw Error('封存代號、市場或行情日期不符');
  map.set(String(q.code),q);counts[q.market]++;
 }
 if(counts.TWSE!==n.twseRows||counts.TPEX!==n.tpexRows)throw Error('封存市場筆數不符');
 const generated=Date.parse(s.generatedAt),close=Date.parse(date+'T13:30:00+08:00'),end=Date.parse(date+'T00:00:00+08:00')+86400000;
 if(!(generated>=close&&generated<end))throw Error('不是指定日盤後封存');
 for(const k of ['twseQuotes','tpexQuotes'])if(s.sourceMeta?.[k]?.status!==200||s.sourceMeta[k].finalDate!==compact)throw Error('官方來源日期未核對');
 const core=Object.fromEntries(SNAP_KEYS.map(k=>[k,s[k]])),fingerprint=await hash(core);
 if(fingerprint!==s.contentSha256)throw Error('封存快照指紋不一致');
 return {date,fingerprint,map};
}
async function loadArchives(asOf,currentFingerprint,{fetcher=globalThis.fetch,signal}={}){
 const unavailable=reason=>({state:'UNAVAILABLE',asOf,dates:[],snapshots:new Map(),errors:[{date:asOf,reason}]});
 try{
  if(!day(asOf)||!(/^[a-f0-9]{64}$/.test(currentFingerprint||'')))return unavailable('缺少目前市場快照指紋');
  const get=async url=>{const local=new AbortController(),timer=setTimeout(()=>local.abort(),8000),abort=()=>local.abort();if(signal?.aborted)local.abort();signal?.addEventListener('abort',abort,{once:true});try{const res=await fetcher(url,{cache:'no-store',signal:local.signal});if(!res.ok)throw Error('封存 HTTP '+res.status);return await res.json();}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}};
  const calendar=await get('data/market/research-calendar.json'),dates=calendar.dates;
  if(calendar.verified!==true||calendar.sourceSnapshotDate!==asOf||calendar.sourceSnapshotHash!==currentFingerprint||!Array.isArray(dates)||dates.at(-1)!==asOf||dates.length<6||dates.some((d,i)=>!day(d)||i&&d<=dates[i-1]))return unavailable('交易日曆與當日市場指紋未對齊');
  const prior=dates.slice(-6,-1),snapshots=new Map(),errors=[];
  await Promise.all(prior.map(async date=>{try{snapshots.set(date,await verifyArchive(await get('data/market/archive/'+date+'.json'),date));}catch(e){errors.push({date,reason:String(e.message||e)});}}));
  return {state:errors.length?(snapshots.size?'PARTIAL':'UNAVAILABLE'):'READY',asOf,dates:prior,snapshots,errors:errors.sort((a,b)=>a.date.localeCompare(b.date))};
 }catch(e){return unavailable(String(e.message||e));}
}
function replay(report,{code,quote,asOf,archive,C,K}={}){
 const unavailable=reason=>({state:'UNAVAILABLE',checked:0,unavailable:archive?.dates?.length||5,entries:[],reasons:[reason]});
 if(!archive||archive.asOf!==asOf||!Array.isArray(archive.dates)||!(archive.snapshots instanceof Map)||!C||!K)return unavailable('前5日官方封存未就緒');
 const v=K.validate(report,{asOf,code,quote,type:'stock',minBars:C.MIN_BARS});
 if(!v.ok)return unavailable(v.reason);
 const entries=[],reasons=[];let checked=0,missing=0;
 for(const date of archive.dates){
  const skip=reason=>{missing++;reasons.push(date+' '+reason);};
  const s=archive.snapshots.get(date),i=v.bars.findIndex(x=>x.date===date),q=s?.map.get(String(code));
  if(!s||!q||q.market!==quote.market||i<C.MIN_BARS-1||date>=asOf){skip('缺同日封存、代號或連續日K');continue;}
  const prefix=v.bars.slice(0,i+1),last=prefix.at(-1);
  if(!['open','high','low','close','volume'].every(k=>q[k]===last[k])){skip('封存與日K價量不一致');continue;}
  if(q.tradeValueSource!=='OFFICIAL_REPORTED'||!Number.isFinite(q.officialTradeValue)||q.officialTradeValue<=0||q.volume<=0||q.officialTradeValue/q.volume<q.low-.02||q.officialTradeValue/q.volume>q.high+.02){skip('官方成交金額未核對');continue;}
  // Do not reuse the current day's completion metadata or industry classification on an earlier date.
  const prior={stock:String(code),market:q.market,marketDate:date,closeDate:date,close:last.close,completed:true,canonicalBars:prefix,dailySeries:prefix,expectedTradingDates:report.expectedTradingDates.filter(d=>d<=date),priceAdjustment:{verified:true,basis:v.basis},volumeUnit:v.volumeUnit};
  const signal=C.evaluate(prior,{asOf:date,code,quote:q,sector:q});
  if(!['PASS','FAIL','EXCLUDED'].includes(signal.status)){skip(signal.reasons?.join('、')||'先前訊號資料不足');continue;}
  checked++;
  if(!signal.eligible)continue;
  const state=track(signal,v.bars,asOf);
  if(state.state==='UNAVAILABLE'){skip(state.reason);checked--;continue;}
  entries.push({...state,code:String(code),name:q.name||String(code),signalScore:signal.quality.score,signalGrade:signal.quality.grade,close:v.bars.at(-1).close,lifeLine:Math.max(state.breakoutLow,state.ma20),sourceFingerprint:s.fingerprint,historyFingerprint:signal.historyFingerprint});
 }
 return {state:missing?'PARTIAL':'READY',checked,unavailable:missing,entries,reasons,scope:'當前已核實歷史日K重建前5日訊號；不等同當時已保存訊號或可成交績效'};
}
return Object.freeze({track,verifyArchive,loadArchives,replay});

});
