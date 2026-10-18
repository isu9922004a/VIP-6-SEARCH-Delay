/* Observer only. Loaded after all legacy wrappers. Never sorts/mutates a scan. */
(function(root){'use strict';
const C=root.ShitouIndicatorShadowCore;if(!C)return;
const VERSION=root.ShitouReleaseV50?.code||C.MODEL,DB='shitou-indicator-shadow-v1',STORE='runs';
const LABELS={MAIN:'① 主升段',DAYTRADE:'② 當沖盤前',STRONG:'③ 強勢飆股',TOWER:'④ 寶塔點金'};
const runs=new Map(),latest=new Map(),cache=new Map(),seenReports=new Map(),pendingSaves=new Set(),pendingReports=new Map();
let persistence='載入本機紀錄中',dbPromise=null,ready=false,renderTimer=null,selected='MAIN',topN=10;
const el=(tag,text,className)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(className)x.className=className;return x;};
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const fmt=(v,d=2)=>num(v)===null?'—':Number(v).toFixed(d);
function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{if(!root.indexedDB){reject(Error('瀏覽器未提供IndexedDB'));return;}const q=root.indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE,{keyPath:'id'});q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('本機紀錄被其他分頁占用'));q.onsuccess=()=>{q.result.onversionchange=()=>q.result.close();resolve(q.result);};});return dbPromise;}
async function persist(run){if(!ready){pendingSaves.add(run.id);return;}try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(run);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});persistence='已儲存在此瀏覽器；請定期下載JSON備份';}catch(e){persistence='本機保存失敗，本次仍可匯出JSON：'+String(e?.message||e);}schedule();}
async function load(){try{const db=await openDB(),stored=await new Promise((resolve,reject)=>{const q=db.transaction(STORE,'readonly').objectStore(STORE).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});for(const r of stored){if(r.model!==C.MODEL)continue;const current=runs.get(r.id);if(!current||r.capturedAt<current.capturedAt)runs.set(r.id,r);}persistence='已載入此瀏覽器的紀錄；請定期下載JSON備份';}catch(e){persistence='本機保存不可用，本次仍可匯出JSON：'+String(e?.message||e);}ready=true;latest.clear();for(const r of [...runs.values()].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)))latest.set(r.strategy,r);for(const id of pendingSaves){const r=runs.get(id);if(r)persist(r);}pendingSaves.clear();processReports([...pendingReports.values()]);pendingReports.clear();reconcileLoaded();schedule();}
function canonical(candidate,asOf){
 const original=candidate?.report||candidate||{},code=String(original.stock||original.code||candidate?.code||'');
 let r=original;
 try{const D=root.ShitouSelectionDataV2,p=D?.get(code);if(p&&!p.error)r=D.apply({...original,stock:code,closeDate:original.closeDate||asOf,close:original.close??candidate?.tower?.bars?.at(-1)?.close},code);}catch(_){/* Evaluate the original honestly; do not fetch or fix data here. */}
 if(!r.dailySeries&&!r.canonicalBars&&candidate?.tower?.bars)r={stock:code,closeDate:asOf,close:candidate.tower.bars.at(-1)?.close,canonicalBars:candidate.tower.bars,completed:candidate.tower.completed===true,priceAdjustment:{verified:candidate.tower.basisVerified===true}};
 return r;
}
function evidence(report,asOf){
 const source=report.canonicalBars?.length?report.canonicalBars:report.dailySeries;
 const key=C.fingerprint([asOf,source,report.close,report.completed,report.isComplete,report.dataTiming,report.marketDate,report.closeDate,report.dataDate,report.expectedTradingDates,report.priceAdjustment,report.corporateActions,report.corporateActionUnresolved,report.priceAdjustmentConsistent]);
 if(cache.has(key))return cache.get(key);
 const e=C.evaluate(report,{asOf});cache.set(key,e);if(cache.size>1500)cache.delete(cache.keys().next().value);return e;
}
function makeRow(candidate,index,kind,asOf,ranked,now){
 const report=canonical(candidate,asOf),code=String(candidate?.code||report.stock||report.code||''),e=evidence(report,asOf);
 return {code,name:String(candidate?.name||report.name||code),market:report.market||null,strategy:kind,date:asOf,subtype:kind==='TOWER'?(candidate.type||'NONE'):String(candidate.setup?.key||candidate.entryFamily||''),baselineRank:ranked?index+1:null,baselineScore:num(candidate.score),baselineQuality:num(candidate.quality?.value),baselineCourseScore:num(candidate.courseSuitabilityScore),baselineGrade:candidate.grade||candidate.status||null,baselineDecision:candidate.selectionDecision?.state||candidate.actionGate?.key||null,baselineFormalRank:num(candidate.formalRank),baselineEligible:candidate.eligible??candidate.formalCandidate??null,monthlyStatus:candidate.monthly?.status||candidate.selectionEvidence?.monthlyStatus||report.monthlyReviewV2?.status||'UNVERIFIED',capturedAt:now,origin:'LIVE_CAPTURE',evidence:e,outcome:{status:'PENDING',reason:'等待後續完成交易日及日曆核對'}};
}
function processReports(reports){
 if(!ready){for(const r of reports)pendingReports.set(String(r.stock||r.code||''),r);return;}
 const changed=new Set();
 for(const r of reports){const code=String(r.stock||r.code||''),asOf=C.date(r.marketDate||r.closeDate||r.dataDate);if(!code||!asOf)continue;
  const key=C.fingerprint([asOf,r.market,r.canonicalBars||r.dailySeries,r.expectedTradingDates,r.priceAdjustment,r.corporateActions,r.completed,r.isComplete,r.dataTiming,r.corporateActionUnresolved,r.priceAdjustmentConsistent]);if(seenReports.get(code)===key)continue;seenReports.set(code,key);
  for(const run of runs.values())for(const row of run.rows){if(row.code!==code||row.date>=asOf)continue;const next=C.nextOutcome(row,r);if(row.outcome?.status==='COMPLETE'&&['PENDING','DATA','CALENDAR_UNVERIFIED','SESSION_GAP'].includes(next.status))continue;if(JSON.stringify(row.outcome)!==JSON.stringify(next)){row.outcome=next;changed.add(run);}}
 }
 changed.forEach(run=>persist(run));if(changed.size)schedule();
}
function capture(kind,scan){
 if(!scan||!LABELS[kind])return null;
 const asOf=C.date(scan.dataDate||scan.date||scan.marketBundleMeta?.targetTradeDate||scan.marketBundleMeta?.completedTradeDate);if(!asOf)return null;
 const now=new Date().toISOString(),ranked=Array.isArray(scan.candidates)?scan.candidates:[],extras=kind==='TOWER'?(scan.riskCandidates||[]):kind==='STRONG'?(scan.selectionParked||[]):[];
 const rows=ranked.map((c,i)=>makeRow(c,i,kind,asOf,true,now)),codes=new Set(rows.map(r=>r.code));
 extras.forEach(c=>{const code=String(c.code||c.report?.stock||'');if(code&&!codes.has(code)){rows.push(makeRow(c,0,kind,asOf,false,now));codes.add(code);}});
 const scope={candidateCount:ranked.length,parkedCount:rows.length-ranked.length,planned:scan.planned??scan.total??null,processed:scan.attempted??scan.done??null,pending:scan.pending??null,complete:scan.complete===true||scan.completed===true,fullMarketCertified:scan.fullMarketCertified===true,profile:scan.profile||scan.analysisProfile||null};
 // Deduplicate report re-renders and downloads without rewriting the first observed time.
 const id=[kind,asOf,C.fingerprint([scope,rows.map(({capturedAt,outcome,...r})=>r)])].join('|');
 let run=runs.get(id);if(!run){run={id,model:C.MODEL,release:VERSION,policy:C.POLICY,strategy:kind,date:asOf,capturedAt:now,scope,rows};runs.set(id,run);persist(run);}
 const previous=latest.get(kind);if(!previous||previous.capturedAt<=run.capturedAt)latest.set(kind,run);
 selected=kind;processReports([...ranked,...extras].map(c=>canonical(c,asOf)));schedule();return run;
}
function appendText(base,kind,scan){
 const marker='【RSI／OBV／SAR並行觀察｜不參與原排序】';if(typeof base!=='string'||base.includes(marker))return base;
 const run=capture(kind,scan);if(!run)return base;
 return base+'\n\n'+[marker,`模型 ${C.MODEL}｜版本 ${VERSION}｜交易日 ${run.date}`,`原候選 ${run.scope.candidateCount}｜風險旁列 ${run.scope.parkedCount}｜${run.scope.fullMarketCertified?'沿用原市場覆蓋認證':'非全市場完整排名'}`,'RSI14 Wilder／OBV20正規化／SAR 0.02–0.20；不新增權重，不改原分數、資格與名次。',...run.rows.flatMap(r=>[`${r.baselineRank?'原序 #'+r.baselineRank:'風險旁列'} ${r.name}（${r.code}）${r.subtype?'｜'+r.subtype:''}｜原分 ${r.baselineScore??r.baselineQuality??'未提供'}`,C.lines(r.evidence).join('｜')]),'後續結果與逐項分組請下載並行紀錄JSON／CSV；尚未驗證績效。'].join('\n');
}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function exported(){return {schema:C.MODEL,exportedAt:new Date().toISOString(),policy:C.POLICY,notes:['原排序未改；每個觀察版本均保留原序與分數','結果僅對後續重新取得的股票自動補對；未取得者不補猜','隔日需日曆核對；歷史回填與次日09:00後才記錄者不進前瞻比較','價差未扣稅費／滑價、未驗證成交；不是已驗證勝率','同日同策略同股統計採最早紀錄，避免重掃挑結果'],runs:[...runs.values()].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt))};}
function exportJSON(){download(new Blob([JSON.stringify(exported(),null,2)],{type:'application/json'}),'石頭少爺_指標並行紀錄_'+new Date().toISOString().slice(0,10)+'.json');}
function csv(){
 const columns=['strategy','date','code','name','subtype','baselineRank','baselineScore','baselineQuality','baselineCourseScore','baselineGrade','monthlyStatus','capturedAt','origin','scopeComplete','fullMarketCertified','dataStatus','rsi14','rsiState','obvNormalized20','obvState','sar','sarSide','sarFlip','outcomeStatus','outcomeDate','closeToClosePct','openToCloseGrossPct','executionVerified'];
 const safe=v=>{let s=String(v??'');if(typeof v!=='number'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const rows=[columns,...exported().runs.flatMap(run=>run.rows.map(r=>[r.strategy,r.date,r.code,r.name,r.subtype,r.baselineRank,r.baselineScore,r.baselineQuality,r.baselineCourseScore,r.baselineGrade,r.monthlyStatus,r.capturedAt,r.origin,run.scope.complete,run.scope.fullMarketCertified,r.evidence.status,r.evidence.rsi?.value,r.evidence.rsi?.state,r.evidence.obv?.normalized20,r.evidence.obv?.state,r.evidence.sar?.value,r.evidence.sar?.side,r.evidence.sar?.flip,r.outcome.status,r.outcome.date,r.outcome.closeToClosePct,r.outcome.openToCloseGrossPct,r.outcome.executionVerified]))];
 return '\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n');
}
function exportCSV(){download(new Blob([csv()],{type:'text/csv;charset=utf-8'}),'石頭少爺_指標並行紀錄.csv');}
function outcomeLabel(r){const x=r.outcome;if(x.status==='COMPLETE')return `隔日收漲跌 ${fmt(x.closeToClosePct)}%｜開收價差 ${fmt(x.openToCloseGrossPct)}%（非淨報酬／未確認成交）`;return {PENDING:'等待後續資料',CALENDAR_UNVERIFIED:'交易日曆未驗證',SESSION_GAP:'次一交易日缺資料',REVISED_HISTORY:'訊號日價格已修訂',CORPORATE_ACTION:'公司行動待核對',NOT_TRADABLE:'次日零量',DATA:'後續資料不足'}[x.status]||'待核對';}
function rowsNode(run,limit=30){
 const box=el('div');if(!run.rows.length)box.appendChild(el('p','本次原榜沒有候選；沒有補出股票或變更資格。'));
 run.rows.slice(0,limit).forEach(r=>{const detail=el('details'),title=el('summary',`${r.baselineRank?'原序 #'+r.baselineRank:'風險旁列'} ${r.name}（${r.code}）${r.subtype?'｜'+r.subtype:''}`);detail.appendChild(title);const p=el('p',C.lines(r.evidence).join('\n'));p.style.whiteSpace='pre-wrap';detail.appendChild(p);detail.appendChild(el('p',outcomeLabel(r)));box.appendChild(detail);});
 if(run.rows.length>limit)box.appendChild(el('p',`畫面先列 ${limit}／${run.rows.length} 檔；JSON／CSV保留本次所有並行紀錄。`));return box;
}
function mount(run,hostId){const host=document.getElementById(hostId);if(!host||!run)return;let box=document.getElementById(hostId+'IndicatorShadow');if(!box){box=el('section',undefined,'rule indicator-shadow-box');box.id=hostId+'IndicatorShadow';host.appendChild(box);}box.replaceChildren(el('h3','RSI／OBV／SAR並行觀察｜原序保留'),el('p',`${run.date}｜RSI14 Wilder／OBV20／SAR 0.02–0.20。僅記錄，未參與計分／排序。`),rowsNode(run,12));}
function schedule(){if(renderTimer!==null)return;renderTimer=setTimeout(()=>{renderTimer=null;try{dashboard();}catch(e){console.warn('並行觀察顯示未完成',e);}},120);}
function reportRows(){return [...runs.values()].flatMap(r=>r.rows);}
function dashboard(){
 let host=document.getElementById('indicatorShadowDashboard');if(!host){host=el('section',undefined,'card indicator-shadow-box');host.id='indicatorShadowDashboard';const footer=document.querySelector('footer');if(footer)footer.before(host);else document.body.appendChild(host);}
 const title=el('h2','RSI／OBV／SAR 並行觀察'),intro=el('p','四策略原排序保留。新增狀態不加權、不改資格；日後用同一原榜逐項比較。'),note=el('p',`${persistence}｜共 ${runs.size} 批紀錄。此區獨立於既有報告。`),controls=el('div',undefined,'indicator-shadow-controls');
 const select=el('select');select.setAttribute('aria-label','並行觀察策略');for(const [k,v] of Object.entries(LABELS)){const op=el('option',v);op.value=k;select.appendChild(op);}select.value=selected;select.onchange=()=>{selected=select.value;dashboard();};controls.appendChild(select);
 for(const [text,fn] of [['下載並行JSON',exportJSON],['下載逐股CSV',exportCSV],['另開觀察圖片',()=>previewLatest().catch(showError)],['補對已載入行情',()=>{reconcileLoaded();schedule();}]]){const b=el('button',text);b.type='button';b.onclick=fn;controls.appendChild(b);}
 const run=latest.get(selected),content=el('div');if(run){content.appendChild(el('p',`${LABELS[selected]}｜${run.date}｜原候選 ${run.scope.candidateCount}｜${run.scope.fullMarketCertified?'沿用原覆蓋認證':'樣本內觀察，非全市場完整排名'}`));content.appendChild(rowsNode(run));}else content.appendChild(el('p','完成此策略掃描後，自動建立並行紀錄。'));
 const selectN=el('select');selectN.setAttribute('aria-label','固定原榜TopN');for(const v of [5,10,20]){const op=el('option','原榜 Top '+v);op.value=String(v);selectN.appendChild(op);}selectN.value=String(topN);selectN.onchange=()=>{topN=Number(selectN.value);dashboard();};
 const compare=el('div');compare.appendChild(el('h3','逐項比較｜固定原榜，不另選最佳權重'));compare.appendChild(selectN);
 const kinds=selected==='TOWER'?['A','B']:[''];for(const subtype of kinds){const rows=reportRows().filter(r=>r.strategy===selected&&(!subtype||r.subtype===subtype));const s=C.summary(rows,topN);if(subtype)compare.appendChild(el('h4',subtype==='A'?'A 紅線續強':'B 今日黑翻紅'));const wrap=el('div',undefined,'indicator-shadow-table'),table=el('table'),thead=el('thead'),head=el('tr');for(const t of ['單項條件','符合筆數／日期數','收漲比例','平均前收→次收','平均次開→次收','不符筆數／平均前收→次收'])head.appendChild(el('th',t));thead.appendChild(head);table.appendChild(thead);const body=el('tbody');for(const g of s.groups){const tr=el('tr');for(const t of [g.label,`${g.match.n}／${g.match.dates}`,g.match.upRate===null?'未驗證':fmt(g.match.upRate*100,1)+'%',g.match.meanCloseToClosePct===null?'—':fmt(g.match.meanCloseToClosePct)+'%',g.match.meanOpenToCloseGrossPct===null?'—':fmt(g.match.meanOpenToCloseGrossPct)+'%',g.other?`${g.other.n}／${fmt(g.other.meanCloseToClosePct)}%`:'—'])tr.appendChild(el('td',t));body.appendChild(tr);}table.appendChild(body);wrap.appendChild(table);compare.appendChild(wrap);}
 compare.appendChild(el('p','只納入次日09:00前已記錄、日曆確認且指標完整的最早同股紀錄。樣本少時不下有效性結論；不同日期／股票彼此相關。價差未扣成本、未驗證成交；分組差異不代表因果或已證實改善。'));
 host.replaceChildren(title,intro,note,controls,content,compare);
}
function reconcileLoaded(){const D=root.ShitouSelectionDataV2,s=D?.getSnapshot();if(!s?.map)return;const reports=[];for(const code of s.map.keys()){const p=D.get(String(code));if(!p?.bars)continue;reports.push({stock:String(code),marketDate:p.date,closeDate:p.date,completed:true,canonicalBars:p.bars,expectedTradingDates:p.expectedTradingDates,priceAdjustment:p.priceAdjustment,corporateActions:p.corporateActions});}processReports(reports);}
function showError(e){const x=document.getElementById('indicatorShadowDashboard');if(x)x.appendChild(el('p','觀察圖未完成：'+String(e?.message||e)));}
function imagePage(run,rows,offset,page,total){
 const canvas=document.createElement('canvas');canvas.width=1284;canvas.height=2778;const ctx=canvas.getContext('2d');ctx.fillStyle='#edf3f8';ctx.fillRect(0,0,1284,2778);
 function text(s,x,y,w,size=30,color='#18334d'){ctx.font=`700 ${size}px sans-serif`;ctx.fillStyle=color;ctx.textBaseline='top';let line='',cy=y;for(const ch of String(s)){if(ch==='\n'||ctx.measureText(line+ch).width>w){ctx.fillText(line,x,cy);cy+=size*1.42;line=ch==='\n'?'':ch;}else line+=ch;}if(line){ctx.fillText(line,x,cy);cy+=size*1.42;}return cy;}
 ctx.fillStyle='#123a5a';ctx.fillRect(0,0,1284,300);text('RSI／OBV／SAR 並行觀察',36,30,1212,46,'#fff');text(`${LABELS[run.strategy]}｜${run.date}｜第${page}/${total}頁`,36,108,1212,32,'#fff');text('原名次／原分數保留｜新增狀態不參與排序',36,162,1212,30,'#ffe7a2');text(`${VERSION}`,36,218,1212,22,'#d9e8f7');
 const sections=[];rows.forEach((r,i)=>{const y=325+i*720;ctx.fillStyle='#fff';ctx.fillRect(24,y,1236,700);let cy=text(`${r.baselineRank?'原序 #'+r.baselineRank:'風險旁列'} ${r.name}（${r.code}）${r.subtype?'｜'+r.subtype:''}`,48,y+20,1188,40);cy=text(`原分 ${r.baselineScore??r.baselineQuality??'未提供'}｜月線 ${r.monthlyStatus}｜${r.evidence.status}`,48,cy+10,1188,29);for(const line of C.lines(r.evidence))cy=text(line,48,cy+10,1188,29);cy=text(outcomeLabel(r),48,cy+10,1188,28,'#754c08');if(cy>y+680)throw Error('觀察圖內容超出區塊，拒絕裁切');sections.push({code:r.code,top:y,bottom:cy});});
 text('量價代理不等於主力進場；未建立上漲機率。',36,2510,1212,30);text('隔日價差未扣成本／滑價，亦未確認可成交。',36,2566,1212,30);text(`本頁 ${rows.length} 檔｜全批 ${run.rows.length} 檔｜獨立附圖`,36,2622,1212,28);canvas.dataset.indicatorShadowAudit=JSON.stringify({page,total,width:1284,height:2778,codes:rows.map(r=>r.code),offset,sections});return canvas;
}
async function previewLatest(){const run=latest.get(selected);if(!run?.rows.length)throw Error('先完成策略掃描，再開啟觀察附圖');if(document.fonts?.ready)await document.fonts.ready;const total=Math.ceil(run.rows.length/3),pages=[];for(let i=0;i<run.rows.length;i+=3)pages.push(imagePage(run,run.rows.slice(i,i+3),i,pages.length+1,total));if(root.strongStockShowPagesV47)return root.strongStockShowPagesV47(pages,{title:LABELS[selected]+'｜指標並行觀察附圖',prefix:'INDICATOR_SHADOW_'+VERSION,date:run.date,kind:'indicator-shadow',note:'原報告保留，獨立附圖完整列出本批紀錄；原序未改。'});const blob=await new Promise(resolve=>pages[0].toBlob(resolve));if(!blob)throw Error('PNG輸出失敗');download(blob,'指標並行觀察_第1頁.png');}
function safe(fn,fallback){try{return fn();}catch(e){persistence='並行觀察未完成：'+String(e?.message||e);schedule();return fallback;}}
function wrap(name,after){const base=root[name];if(typeof base!=='function')return;root[name]=function(...args){const out=base.apply(this,args);return safe(()=>after(out,args),out);};}
for(const [name,kind,id] of [['renderMomentumScanResultV3762','MAIN','momentumResult'],['renderMomentumScanResultV3765','MAIN','momentumResult'],['renderDayTradeScanResultV1','DAYTRADE','dayTradeResult']])wrap(name,(out,[scan])=>{mount(capture(kind,scan),id);return out;});
for(const [name,kind] of [['buildMomentumScanTextReportV3763','MAIN'],['buildMomentumScanCompactTextReportV377713','MAIN'],['buildDayTradeTextReportV1','DAYTRADE']])wrap(name,(out,[scan])=>appendText(out,kind,scan));
// Capture later canonical reports for old candidates even if they fall out of the next list.
if(root.ShitouSelectionDataV2){const D=root.ShitouSelectionDataV2;root.ShitouSelectionDataV2=Object.freeze({...D,async harmonize(...args){const payload=await D.harmonize(...args);safe(()=>processReports((payload.results||[]).filter(x=>x.ok&&x.data).map(x=>x.data)));return payload;}});}
const transport=root.fetchDeepBatchViaMarketWorkerV3768;if(typeof transport==='function')root.fetchDeepBatchViaMarketWorkerV3768=async function(...args){const payload=await transport.apply(this,args);safe(()=>processReports((payload?.results||[]).filter(x=>x.ok&&x.data).map(x=>x.data)));return payload;};
wrap('renderBeginnerCommandCenterV46',(out,[report])=>{const e=evidence(canonical(report,C.date(report?.closeDate)),C.date(report?.closeDate||report?.marketDate));const target=document.getElementById('beginnerCommandCenterV46');if(target){let box=document.getElementById('stockIndicatorShadow');if(!box){box=el('section',undefined,'rule indicator-shadow-box');box.id='stockIndicatorShadow';target.appendChild(box);}box.replaceChildren(el('h3','個股指標觀察｜不改原判讀'),el('p',C.lines(e).join('｜')));}return out;});
for(const name of ['buildReportText','buildReportTextV32','buildLegacyReportText'])wrap(name,(out,[report])=>typeof out!=='string'||out.includes('【個股指標並行觀察】')?out:out+'\n【個股指標並行觀察】\n'+C.lines(evidence(canonical(report,C.date(report?.closeDate)),C.date(report?.closeDate||report?.marketDate))).join('\n'));
const style=el('style');style.textContent='.indicator-shadow-box{margin:20px auto;padding:20px;max-width:1320px;box-sizing:border-box;border:1px solid #9ab2ca;border-radius:16px;background:#f4f8fc;color:#18334d;line-height:1.7;overflow-wrap:anywhere}.indicator-shadow-box p,.indicator-shadow-box summary{color:#18334d}.indicator-shadow-controls{display:flex;flex-wrap:wrap;gap:10px}.indicator-shadow-box button,.indicator-shadow-box select{min-height:44px;font-size:16px;padding:8px 12px;max-width:100%}.indicator-shadow-box details{margin:10px 0;border-top:1px solid #bdcddd;padding-top:8px}.indicator-shadow-table{overflow-x:auto}.indicator-shadow-box table{border-collapse:collapse;min-width:780px;width:100%}.indicator-shadow-box th,.indicator-shadow-box td{padding:10px;border:1px solid #a8bdd1;text-align:left;color:#18334d}';document.head.appendChild(style);
root.ShitouIndicatorShadow=Object.freeze({capture:(kind,scan)=>safe(()=>capture(kind,scan),null),appendText:(base,kind,scan)=>safe(()=>appendText(base,kind,scan),base),mount:(...args)=>safe(()=>mount(...args)),processReports,reconcileLoaded,exported,csv,imagePage,previewLatest,exportJSON,exportCSV,getLatest:k=>latest.get(k),getRuns:()=>[...runs.values()],getPersistence:()=>persistence,whenReady:()=>ready,core:C});
load();
})(typeof window!=='undefined'?window:globalThis);
