/* Descriptive completed-session statistics only. No scores, entries or wave-count rules. */
(function(root,factory){const api=factory(root,typeof module==='object'&&module.exports?require('./worker-data-contract-v1'):root.ShitouWorkerDataContractV1);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouWavePostclose=api;})(globalThis,function(root,W){
'use strict';
const VERSION='WAVE_POSTCLOSE_CONTEXT_1',cache=new Map(),inflight=new Map(),TTL=300000;
const positive=x=>Number.isFinite(x)&&x>0,iso=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||''),pct=x=>(x>0?'+':'')+x.toFixed(2)+'%',missing=reason=>({status:'UNAVAILABLE',reason});
function source(m,raw,evidence){
 const s=raw.input||raw,bars=s.canonicalBars||s.dailySeries||s.bars||m.wave?.bars||[],calendar=s.tradingCalendar||s.calendar||raw.tradingCalendar||(m.kind==='market'&&evidence?.benchmark?.closeDate===m.date?evidence.benchmark.tradingCalendar:null);
 let reason=null;
 if(s.completed===false||s.isComplete===false||s.dailySeriesMeta?.onlyCompletedBars===false)reason='尚未確認完成日K';
 else if(s.corporateActionUnresolved||s.priceAdjustmentConsistent===false)reason='分割或除權息的價格基準尚未釐清';
 else if(s.dataContract&&!W.verify(s).ok)reason='日K來源契約未通過核對';
 else if(!(s.priceAdjustment?.verified===true||m.wave?.state&&m.wave.state!=='DATA_INSUFFICIENT'))reason='價格來源尚未核對';
 else if((s.closeDate||s.date||s.asOf||raw.closeDate||raw.date)!==m.date||(s.stock||s.code)&&String(s.stock||s.code)!==String(m.code)||(s.close!==undefined&&s.close!==m.close)||!bars.length||bars.at(-1).date!==m.date||bars.at(-1).close!==m.close)reason='行情身分、日期或收盤價不一致';
 else if(!calendar?.verified||!Array.isArray(calendar.dates))reason='正式交易日曆尚未核對';
 const dates=(calendar?.dates||[]).filter(d=>d<=m.date);
 if(!reason&&(!iso(m.date)||!dates.includes(m.date)||dates.some((d,i)=>!iso(d)||i&&d<=dates[i-1])))reason='交易日曆日期不完整';
 return {bars,dates,reason,volumeUsable:!s.volumeSourceConflict&&!s.sourceVolumeWarning&&!s.dailyBasisV2?.sourceVolumeWarning&&s.volumeScopeAudit?.formalVolumeEligible!==false&&((s.volumeUnit||s.dailySeriesMeta?.volumeUnit)==='shares'||m.kind==='market'&&m.wave?.state&&m.wave.state!=='DATA_INSUFFICIENT'),priceBasis:s.priceAdjustment?.basis||'VERIFIED_SOURCE',corporateActionsVerified:s.priceAdjustment?.corporateActionsVerified===true};
}
function window(s,n){
 if(s.reason)return missing(s.reason);
 if(s.bars.length<n)return missing('只有'+s.bars.length+'根，這項需要'+n+'根');
 const b=s.bars.slice(-n),expected=s.dates.slice(-n);
 if(expected.length!==n||b.some((r,i)=>r.date!==expected[i]))return missing('計算區間有未核對的交易日缺口');
 if(b.some(r=>!positive(r.close)))return missing('收盤價缺少或不合法');
 return {status:'MEASURED',bars:b};
}
function relative(s,benchmark,n,date){
 const w=window(s,n+1);if(w.status!=='MEASURED')return w;
 if(benchmark?.instrumentType!=='TAIEX'||benchmark.completed!==true||benchmark.closeDate!==date||benchmark.dailySeriesMeta?.onlyCompletedBars!==true||benchmark.priceAdjustment?.basis!=='OFFICIAL_INDEX_LEVEL'||benchmark.priceAdjustment?.verified!==true)return missing('同日大盤比較資料尚未更新');
 const rows=benchmark.dailySeries;if(!Array.isArray(rows)||rows.some((b,i)=>!iso(b.date)||i&&b.date<=rows[i-1].date)||rows.at(-1)?.close!==benchmark.close)return missing('大盤比較資料日期或價格不一致');
 const map=new Map(rows.map(b=>[b.date,b])),matched=w.bars.map(b=>map.get(b.date));
 if(matched.some(b=>!b||!positive(b.close)))return missing('同區間大盤資料有缺日');
 const own=(w.bars.at(-1).close/w.bars[0].close-1)*100,market=(matched.at(-1).close/matched[0].close-1)*100;
 return {status:'MEASURED',periods:n,startDate:w.bars[0].date,endDate:date,priceChangePct:own,benchmarkPriceChangePct:market,excessPercentagePoints:own-market};
}
function contraction(s){
 const w=window(s,15);if(w.status!=='MEASURED')return w;
 if(w.bars.some(b=>!positive(b.open)||!positive(b.high)||!positive(b.low)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)))return missing('高低價與開收盤未對齊');
 const volumeUsable=s.volumeUsable&&w.bars.every(b=>positive(b.volume));
 const groups=Array.from({length:3},(_,i)=>{const b=w.bars.slice(i*5,i*5+5),high=Math.max(...b.map(r=>r.high)),low=Math.min(...b.map(r=>r.low));return {startDate:b[0].date,endDate:b.at(-1).date,high,low,rangePct:(high/low-1)*100,averageVolumeShares:volumeUsable?b.reduce((n,r)=>n+r.volume,0)/5:null};});
 return {status:'MEASURED',groups,progressivelyNarrower:groups[0].rangePct>groups[1].rangePct&&groups[1].rangePct>groups[2].rangePct,volumeStatus:volumeUsable?'MEASURED':'UNAVAILABLE',latestVsPreviousVolumePct:volumeUsable?(groups[2].averageVolumeShares/groups[1].averageVolumeShares-1)*100:null,definition:'連續三組各5根完成日K；範圍＝（最高價÷最低價−1）×100%，不是完整VCP判定'};
}
function breadth(snapshots,dates){
 const days=dates.map(date=>{const s=snapshots?.[date];if(!s||s.tradeDateIso!==date||s.marketCoverageReady!==true||!Array.isArray(s.rows))return {date,...missing('該日完整市場快照尚未更新')};
  const rows=s.rows.filter(r=>r.market==='TWSE');if(!rows.length||rows.length!==s.counts?.twseRows||new Set(rows.map(r=>r.code)).size!==rows.length)return {date,...missing('上市快照覆蓋數量未通過核對')};
  const valid=rows.filter(r=>r.quoteDate===date.replaceAll('-','')&&Number.isFinite(r.pct)&&positive(r.close)&&positive(r.volume));if(valid.length!==rows.length)return {date,...missing('上市漲跌或成交資料不完整')};
  return {date,status:'MEASURED',up:valid.filter(r=>r.pct>0).length,down:valid.filter(r=>r.pct<0).length,flat:valid.filter(r=>r.pct===0).length,valid:valid.length,upSharePct:valid.filter(r=>r.pct>0).length/valid.length*100};
 });
 return {status:days.length===3&&days.every(d=>d.status==='MEASURED')?'MEASURED':'UNAVAILABLE',days,scope:'當日快照涵蓋的上市普通股；依官方漲跌幅，含平盤為分母'};
}
function evaluate(m,raw,evidence=cache.get(m.date)?.value){
 const s=source(m,raw,evidence),market=m.kind==='market',r20=relative(s,evidence?.benchmark,20,m.date),r60=relative(s,evidence?.benchmark,60,m.date),range=contraction(s),distribution=breadth(evidence?.snapshots,s.dates.slice(-3)),lines=[];
 if(market&&distribution.status==='MEASURED'){
  lines.push('上市上漲占比：'+distribution.days.map(d=>d.upSharePct.toFixed(1)+'%').join(' → ')+'。');const d=distribution.days.at(-1);lines.push('最新：上漲'+d.up+'／下跌'+d.down+'／平盤'+d.flat+'檔。');
 }else if(!market)for(const r of [r20,r60])if(r.status==='MEASURED')lines.push('近'+r.periods+'日：本股'+pct(r.priceChangePct)+'，大盤'+pct(r.benchmarkPriceChangePct)+'。');
 if(range.status==='MEASURED'){
  lines.push('三組波動：'+range.groups.map(g=>g.rangePct.toFixed(1)+'%').join(' → ')+'，'+(range.progressivelyNarrower?'逐組變小。':'未逐組變小。'));
  if(range.volumeStatus==='MEASURED'){const v=range.latestVsPreviousVolumePct;lines.push('近5日均量'+(v>0?'增加'+v.toFixed(1)+'%':v<0?'減少'+(-v).toFixed(1)+'%':'大致持平')+'，'+(v>=0?'未見量縮整理。':'仍須核對價格。'));}
 }
 if(lines.length){let explanation='數據只作觀察，仍須符合原買進條件。';if(market&&distribution.status==='MEASURED'){const d=distribution.days,p=d.map(x=>x.upSharePct);explanation=p[2]<p[1]&&p[1]<p[0]?'上漲股票變少，還沒看到普遍轉強。':p[2]>p[1]&&p[1]>p[0]?'上漲占比增加，個股買進條件仍要另看。':'漲跌分布未持續改善，先觀察。';}else if(!market&&r20.status==='MEASURED'&&r20.priceChangePct<0&&r20.excessPercentagePoints>0)explanation='只是比大盤少跌，不能當成已轉強。';lines.push('說明：'+explanation);}
 const hidden=[!market&&r20.status!=='MEASURED'?'20日比較：'+r20.reason:null,!market&&r60.status!=='MEASURED'?'60日比較：'+r60.reason:null,market&&distribution.status!=='MEASURED'?'三日市場分布尚未齊全':null,range.status!=='MEASURED'?'波動：'+range.reason:null].filter(Boolean);
 return {version:VERSION,date:m.date,code:m.code,rs20:r20,rs60:r60,contraction:range,breadth:distribution,lines,title:market?'明天大盤先看：有沒有普遍轉強？':'明天規劃：有沒有比較強、整理穩？',visible:lines.length>0,hidden,notes:[s.priceBasis==='OFFICIAL_INDEX_LEVEL'?'指數依官方點位與成交股數計算。':'未還原價格比較，不是含息報酬或買進通知。',range.status==='MEASURED'?'三組各5日；範圍＝最高價÷最低價−1。':null,hidden.length?'略過未齊欄位：'+hidden.map(x=>x.split('：')[0]).join('、')+'。':null].filter(Boolean),researchOnly:true,affectsOriginalEligibility:false,affectsOriginalRanking:false,formalSignal:false};
}
async function prepare(raw,{fetcher=root.fetch,timeout=8000}={}){
 const s=raw.input||raw,date=raw.closeDate||raw.date||s.closeDate||s.asOf,initialCalendar=s.tradingCalendar||s.calendar||raw.tradingCalendar;
 if(!iso(date)||typeof fetcher!=='function')return null;
 const old=cache.get(date);if(old?.complete&&Date.now()-old.at<TTL)return old.value;if(inflight.has(date))return inflight.get(date);
 const read=async p=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const base=root.document?.baseURI||'https://wave-postclose.invalid/',u=new URL('./'+p,base);u.searchParams.set('postclose',String(Date.now()));const response=await fetcher(u.href,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.json();}finally{clearTimeout(timer);}};
 const task=(async()=>{
  let benchmark=null;const benchmarkJob=read('data/index/TAIEX.json').catch(()=>null);
  let calendar=initialCalendar;if(!calendar?.verified||!Array.isArray(calendar.dates)){benchmark=await benchmarkJob;calendar=benchmark?.closeDate===date?benchmark.tradingCalendar:null;}
  const dates=(calendar?.verified&&Array.isArray(calendar.dates)?calendar.dates:[]).filter(d=>d<=date).slice(-3),results=await Promise.allSettled(dates.map(d=>read('data/market/archive/'+d+'.json'))),snapshots={};
  benchmark=benchmark||await benchmarkJob;dates.forEach((d,i)=>{if(results[i].status==='fulfilled')snapshots[d]=results[i].value;});
  const value={benchmark,snapshots},complete=benchmark?.closeDate===date&&benchmark.completed===true&&breadth(snapshots,dates).status==='MEASURED';
  cache.set(date,{value,complete,at:Date.now()});while(cache.size>2)cache.delete(cache.keys().next().value);return value;
 })();inflight.set(date,task);try{return await task;}finally{inflight.delete(date);}
}

return Object.freeze({VERSION,source,window,relative,contraction,breadth,evaluate,prepare,reset(){cache.clear();inflight.clear();}});
});
