/* Read-only sidecar: old return values, candidate arrays and prices are never rewritten. */
(function(root){'use strict';
const C=root.ShitouFourModels,U=root.ShitouResearchCommon,R=root.ShitouResearchReport,Entry=root.ShitouEntryDirection;
if(!C||!U||!R)return;
let identity=null,date=null,revision=0,scheduled=false,activeKind='STRONG',latestStockQuery=null,stockQuerySerial=0,previewSerial=0;const sourceRecords=new Map(),records=new Map(),baselines=new Map(),cache=new Map(),seen=new Map();
const entryModes=new Map();
let flags=U.flags();try{const saved=JSON.parse(localStorage.getItem('shitou-research-flags-v1')||'null');if(saved)flags=U.flags(saved);}catch(_){}
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;},by=id=>document.getElementById(id),LABEL={MAIN:'① 主升段',DAYTRADE:'② 當沖盤前',STRONG:'③ 強勢飆股',TOWER:'④ 寶塔點金',RESTAURANT:'⑤ 餐廳量價',STRUCTURE_A:'⑥ 結構A',STRUCTURE_B:'⑥ 結構B',STOCK_QUERY:'⑦ 個股查詢｜專屬研究'};
function safely(fn){try{return fn();}catch(e){console.warn('研究附層暫停：'+e.message);return null;}}
function briefLine(a,label){const line=R.lines(a).find(x=>x.startsWith('【'+label+'】'));return line?line.slice(label.length+2):'—';}
// An individual lookup is NOT an additional scanner candidate or a formal rank.
// Preserve only the latest successfully completed user search, independent of scan snapshots.
const stockNum=value=>{if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value)))return Number(value);return null;};
const stockFmt=value=>{const n=stockNum(value);return n===null?'—':n.toFixed(2);};
function stockMetrics(report,analysis){
 const raw=report||{},rawRsi=stockNum(raw.rsiSourceAudit?.value??raw.dailyRsi??raw.dailyRsi5),rsi=stockNum(analysis?.features?.rsi5)??rawRsi,close=stockNum(raw.close);
 const v=analysis?.features||{},ma20=stockNum(v.ma?.[20]?.value);
 return Object.freeze({close,ma20,rsi5:rsi!==null&&rsi>=0&&rsi<=100?rsi:null,rawRsi5:rawRsi,rsiSource:analysis?.features?.rsi5!=null?'VALIDATED_CANONICAL_DAILY':'UPSTREAM_UNVERIFIED',
  marketDate:String(raw.closeDate||raw.marketDate||raw.dataDate||analysis?.date||'日期待核對'),
  source:String(raw.source||analysis?.dataSource||'資料來源未標示'),
  researchStatus:analysis?.state||'INSUFFICIENT_DATA',
  verifiedDailyResearch:analysis?.state!=='INSUFFICIENT_DATA'&&!!analysis?.models?.A,
  priceBasisNote:'有有效完成日K時，RSI5與MA20使用同一日K計算；原報告RSI另存rawRsi5供核對。'});
}
function stockQueryIntro(stock){
 const box=el('div');box.className='research-stock-intro';
 const heading=el('h4',`${stock.analysis.name}（${stock.analysis.code}）｜個股專屬研究`);
 const row=el('div');row.className='research-stock-metrics';
 for(const [name,value] of [['收盤價',stockFmt(stock.metrics.close)],['日RSI5',stockFmt(stock.metrics.rsi5)],['日MA20',stockFmt(stock.metrics.ma20)]]){
  const cell=el('div');cell.className='research-stock-metric';cell.append(el('span',name),el('strong',value));row.append(cell);
 }
 const meta=el('p',`行情 ${stock.metrics.marketDate}｜${stock.metrics.verifiedDailyResearch?'完成日K研究':'研究資料尚未完整'}｜非原濾網排名`);
 meta.className='research-stock-meta';
 box.append(heading,row,meta);return box;
}
function captureStockQuery(input,{activate=false}={}){
 const raw=input?.report||input||{};
 const analysis=forReport(input),code=String(analysis.code||raw.code||raw.stock||'').trim();
 if(!/^\d{4,6}$/.test(code))return null;
 root.ShitouDraxPriceReminder?.clear();
 latestStockQuery={analysis,metrics:stockMetrics(raw,analysis)};
 if(activate)activeKind='STOCK_QUERY';
 const selector=by('researchKind');if(selector)selector.value=activeKind;
 render();return latestStockQuery;
}
function clearStockQuery(){root.ShitouDraxPriceReminder?.clear();previewSerial++;latestStockQuery=null;root.closeInfographicPreviewV3328?.();root.ShitouImageShareV1?.clear();by('researchStock')?.remove();if(activeKind==='STOCK_QUERY')render();}
function researchCard(a,number,prefix='研究',expanded=false){
 const details=el('details');details.className='research-stock-card';details.open=expanded;
 details.dataset.code=String(a.code||'');details.dataset.researchState=String(a.state||'');
 const summary=el('summary');summary.className='research-card-summary';
 const heading=el('span');heading.className='research-card-heading';
 const title=el('span',prefix==='個股'?`個股｜${a.name||'名稱待核對'}`:`${prefix} #${number} ${a.name||'名稱待核對'}`);title.className='research-card-name';
 const code=el('span',`（${a.code||'—'}）`);code.className='research-card-code';
 heading.append(title,code);
 const stage=el('span',a.entryDirection?.direction?.label||R.stageLabel(a));
 stage.className='research-card-stage '+(['AVOID','DATA'].includes(a.entryDirection?.entry)||['OVEREXTENDED','BREAKOUT_FAILURE','INSUFFICIENT_DATA'].includes(a.state)||a.state==='OBSERVATION'&&['短線偏弱','短線回檔','均線下方整理','反彈仍遇中期壓力','MA20下方整理'].includes(R.stageLabel(a))?'research-card-stage-warn':'research-card-stage-neutral');
 const report=R.view(a);
 const glance=el('span',report.summary[0]?.value.split('\n')[0]||R.stageLabel(a));
 glance.className='research-card-glance';
 summary.append(heading,stage,glance);details.append(summary);
 const body=el('div');body.className='research-card-body';
 details.dataset.reportSchema=report.schemaVersion;
 const guide=el('section');guide.className='research-entry-guide';
 const intro=el('div');intro.className='research-guide-header';intro.append(el('span','四策略研究｜新手進出場指南'),el('strong',`${a.name}（${a.code}）`),el('span',`行情基準 ${(a.date||'待核驗').replaceAll('-','/')}｜${Number.isFinite(a.sourceBars?.at(-1)?.close)?'收盤 '+R.fmt(a.sourceBars.at(-1).close)+' 元':'價格待核對'}`));guide.append(intro);
 function field(item,guideIndex){
  const row=el('div');row.className='research-card-field'+(guideIndex!==undefined?' research-guide-field research-guide-section-'+guideIndex:'');
  const key=el('span',item.title);key.className='research-card-label';
  const value=el('span',item.value);value.className='research-card-value';
  if(guideIndex===0){value.textContent='';const parts=item.value.split('\n');value.append(el('strong',parts.shift()),document.createTextNode('\n'),el('span',parts.join('\n')));}
  row.append(key,value);return row;
 }
 report.summary.forEach((item,i)=>guide.append(field(item,i)));
 const note=el('p',report.guideNote);note.className='research-guide-note';guide.append(note);body.append(guide);
 const evidence=el('details');evidence.className='research-guide-evidence';evidence.append(el('summary','查看完整研究與資料驗證'));
 for(const item of report.details)evidence.append(field(item));body.append(evidence);
 const actions=el('div');actions.className='research-card-actions';
 const button=el('button','查看摘要圖片');button.type='button';button.onclick=()=>preview([a]);actions.append(button);
 const fullButton=el('button','查看完整研究圖片');fullButton.type='button';fullButton.onclick=()=>preview([a],{stockMode:prefix==='個股',detail:true});actions.append(fullButton);
 if(a.unifiedResearch?.chart||a.nContinuation?.chart){const chartButton=el('button','查看結構證據圖');chartButton.type='button';chartButton.onclick=()=>preview([a],{stockMode:prefix==='個股',chartOnly:true});actions.append(chartButton);}
 if(a.foundation?.alertPlan)actions.append(alertControls(a));
 body.append(actions);details.append(body);return details;
}

function bind(snapshot){if(snapshot?.identity!==identity){identity=snapshot?.identity||null;date=snapshot?.date||null;records.clear();sourceRecords.clear();baselines.clear();seen.clear();cache.clear();revision++;schedule();}}
function source(input){const raw=U.normalizeInput(input),r={...raw};
 const D=root.ShitouSelectionDataV2,code=String(r.stock||r.code||''),sourceDate=r.marketDate||r.closeDate||r.dataDate;
 // Only the verified canonical cache may supply history. A same ticker in an old
 // scan is insufficient evidence: apply also checks date, market, close and completion.
 if(D?.get(code)&&D.getSnapshot()?.date===sourceDate){
  const canonical=D.get(code);
  // A failed canonical acquisition belongs to the shared snapshot, regardless
  // of whether the caller came through the async stock lookup or a scan adapter.
  // Re-validating FULL here used to produce a second, different generic error.
  if(canonical.error){
   r.researchInputErrors=[...new Set([...(r.researchInputErrors||[]),canonical.error])];
   r.researchAcquisitionError=canonical.error;
  }else try{Object.assign(r,D.apply(r,code));}catch(e){r.researchInputErrors=[...new Set([...(r.researchInputErrors||[]),e.message])];}
 }
 if(U.num(r.originalB)===null){const state=safely(()=>root.stockInfographicStateV3328?.(raw));if(state?.B>0){r.originalB=state.B;r.originalBSource='stockInfographicStateV3328(report).B';}}
 // Candidate levels.invalidation is a research/strategy-specific field, not proof
 // of the original strategy's invalidation. Keep it out of originalInvalidation.
 // Tick rules are limited to independently identified ordinary TWSE/TPEx shares.
 if(['COMMON','COMMON_STOCK','ORDINARY'].includes(String(r.securityType||input?.qualification?.securityType||'').toUpperCase()))r.tickRuleVerified=true;
 return r;
}
async function prepareStockQuery(input){
 const raw=U.normalizeInput(input),D=root.ShitouSelectionDataV2,code=String(raw.stock||''),date=raw.marketDate||raw.closeDate||raw.dataDate;
 if(!D||!/^\d{4,6}$/.test(code))return raw;
 // Explicitly unfinished or suspended input cannot be upgraded by cached history.
 if(raw.completed===false||raw.isComplete===false||raw.suspended)return raw;
 try{
  if(!D.getSnapshot()){
   if(typeof root.loadMarketBundleFromWorkerV3766!=='function')throw Error('共用市場快照載入器未載入');
   await root.loadMarketBundleFromWorkerV3766('?market=ALL_STOCKS');
  }
  if(D.getSnapshot()?.date!==date)throw Error(`查詢日期 ${date||'未知'} 與共用快照 ${D.getSnapshot()?.date||'未知'} 不同，不跨日補值`);
  await D.prepareResearchEvidence?.();
  const q=D.context(code).q;
  if(raw.market&&raw.market!==q.market)throw Error('查詢與共用快照市場別不符');
  if(!D.get(code)||D.get(code).error)await D.ensure([{code,name:raw.name,q}]);
  return D.apply(raw,code);
 }catch(e){
  // ensure() adds an aggregate error prefix. Prefer the same bound per-stock
  // failure used by every scan adapter, preserving independent input errors.
  const reason=D.getSnapshot()?.date===date&&D.get(code)?.error||String(e.message||e);
  return {...raw,researchAcquisitionError:reason,researchInputErrors:[...new Set([...(raw.researchInputErrors||[]),reason])]};
 }
}
function forReport(input){const r=source(input),key=U.hash([root.ShitouUnifiedAnalysis.VERSION,r,flags]);if(!cache.has(key)){if(cache.size>=512)cache.delete(cache.keys().next().value);const result=C.evaluate(r,{flags});cache.set(key,result);if(result.unifiedResearch?.code)try{root.ShitouResearchHistory?.append(localStorage,result.unifiedResearch);}catch(e){console.warn('歷史研究快照未保存：'+e.message);}}return cache.get(key);}
function capture({snapshot,items,results}){if(!snapshot?.identity)return;bind(snapshot);for(const item of items){const code=String(item.code),matches=results.filter(x=>String(x.code||x.data?.stock||x.data?.code||'')===code),x=matches.length===1?matches[0]:null;let a;if(x?.ok&&x.data){sourceRecords.set(code,structuredClone(x.data));a=safely(()=>forReport(x.data));}else sourceRecords.delete(code);if(!a)a=C.evaluate({stock:code,name:item.name||code,closeDate:date,completed:false});records.set(code,a);}revision++;schedule();}
function baseline(kind,scan,rows){
 if(!scan||!Array.isArray(rows))return;const d=U.T.date(scan.dataDate||scan.date||scan.marketBundleMeta?.targetTradeDate||scan.marketBundleMeta?.completedTradeDate);if(!d||date&&d!==date)return;
 const entries=rows.map((c,i)=>({code:String(c.code||c.stock||c.report?.stock||c.report?.code||''),rank:i+1,score:structuredClone(c.score??null),eligible:c.eligible??c.formalLaunchEligible??null}));
 const host=by(({MAIN:'momentumResult',DAYTRADE:'dayTradeResult',STRONG:'strongStockResult',TOWER:'towerGoldPanel',RESTAURANT:'restaurantResult',STRUCTURE_A:'structureResult',STRUCTURE_B:'structureResult'})[kind]);
 const signature=U.hash([d,entries,scan.id||scan.snapshotId||null,revision,flags]),unchanged=seen.get(kind)===signature;
 // Legacy renderers replace their result DOM again after broker enrichment or
 // mode changes. The same data signature does not prove our section survived.
 const attached=by('researchInline'+kind);
 if(unchanged&&(!host||attached&&host.contains(attached)))return;
 const analyses=unchanged&&baselines.has(kind)?baselines.get(kind).analyses:rows.map(c=>safely(()=>forReport(c))).filter(Boolean);
 seen.set(kind,signature);baselines.set(kind,U.freeze({date:d,entries,analyses,scope:'僅目前已查詢／該策略輸出，非全市場認證'}));
 if(host){let section=by('researchInline'+kind);if(!section){section=el('details');section.id='researchInline'+kind;section.className='research-inline';host.appendChild(section);}const summary=el('summary',LABEL[kind]+'｜研究摘要'),p=el('p','原榜保留，詳細資料點選卡片查看。'),list=el('div');list.className='research-card-grid';section.replaceChildren(summary,p,list);
  const draw=()=>{list.replaceChildren();const selected=Entry.select(analyses,entryMode(kind));for(const {analysis,index} of selected)list.append(researchCard(analysis,index+1,'原榜'));if(!selected.length)list.append(el('p','目前沒有符合這項進場檢查的股票；可切換「全部」查看每檔等待或風險原因。'));};
  p.textContent='原榜分數不等於現在能買。下方是多方進場二次篩選；先確認資料、價格與風險。';
  section.insertBefore(entryControls(analyses,kind,()=>{draw();render();}),list);draw();
 }
 schedule();
}
function sync(){
 const main=typeof lastMomentumScanDataV3762!=='undefined'?lastMomentumScanDataV3762:null,day=typeof lastDayTradeScanDataV1!=='undefined'?lastDayTradeScanDataV1:null;
 safely(()=>baseline('MAIN',main,main?.candidates));safely(()=>baseline('DAYTRADE',day,day?.candidates));
 for(const [kind,provider] of [['STRONG',root.STRONG_STOCK_TEST_API_V47],['TOWER',root.ShitouTowerIntegration],['RESTAURANT',root.ShitouRestaurantUI]]){const s=provider?.getLast?.();safely(()=>baseline(kind,s,s?.candidates));}
 const s=root.ShitouStructureUI?.getLast?.();for(const mode of ['A','B'])safely(()=>baseline('STRUCTURE_'+mode,s,s?.modeResults?.[mode]?.ranked));
}
function ranking(){const base=baselines.get(activeKind),kind=activeKind.startsWith('STRUCTURE')?'STRUCTURE':activeKind,all=new Map(records);for(const a of base?.analyses||[])all.set(a.code,a);return C.rank([...all.values()].filter(a=>!date||a.date===date),{kind,baselineCodes:base?.entries.map(x=>x.code)||[]});}
function entryMode(kind=activeKind){return flags.entryDirectionEnabled===false?'ALL':entryModes.get(kind)||'EVALUATE';}
function researchPool(){return baselines.get(activeKind)?.analyses||[...records.values()].filter(a=>!date||a.date===date);}
function selectedRows(){return Entry.select(researchPool(),entryMode()).map(x=>({analysis:x.analysis,rank:x.index+1}));}
function entryControls(analyses,kind,onChange){const box=el('div');box.className='research-tools';const label=el('label','多方進場二次篩選：'),select=el('select');select.setAttribute('aria-label','多方進場二次篩選');select.className='research-entry-selector';select.style.maxWidth='100%';
 for(const mode of ['EVALUATE','WAIT','AVOID','DATA','BULL','BEAR','ALL']){const option=el('option',Entry.LABELS[mode]);option.value=mode;select.append(option);}select.value=entryMode(kind);select.disabled=flags.entryDirectionEnabled===false;select.onchange=()=>{entryModes.set(kind,select.value);onChange();};label.append(select);box.append(label);
 const c=Entry.counts(analyses);box.append(el('p',`可評估 ${c.EVALUATE}｜先等 ${c.WAIT}｜不宜新買 ${c.AVOID}｜待核 ${c.DATA}。只檢查本次已取得的股票，不是全市場買進名單。`));return box;}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;safely(sync);safely(render);},100);}
function save(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function exportChineseResearchCsv(){
 const studies=activeKind==='STOCK_QUERY'?(latestStockQuery?[latestStockQuery.analysis]:[]):selectedRows().map(x=>x.analysis);
 const titles=[...new Set(studies.flatMap(a=>{const report=R.view(a);return [...report.summary,...report.details].map(f=>f.title);}))];
 const headers=['股票代碼','股票名稱','行情日期',...titles];
 const safeSheetCell=x=>{const s=String(x??'');return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;};
 const quote=x=>'"'+safeSheetCell(x).replaceAll('"','""')+'"';
 const rows=[headers,...studies.map(a=>{const report=R.view(a),found=new Map([...report.summary,...report.details].map(f=>[f.title,f.value]));return [a.code,a.name,a.date,...headers.slice(3).map(h=>found.get(h)||'資料不足，暫無法判斷')];})];
 const csv='\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
 save(new Blob([csv],{type:'text/csv;charset=utf-8'}),`石頭少爺_${root.ShitouReleaseV50.displayCode}_${activeKind==='STOCK_QUERY'?'個股':'濾網'}_繁體中文研究表.csv`);
 return {records:studies.length,format:'中文研究表'};
}
function exportData(type='json'){
 if(type==='csv-zh')return exportChineseResearchCsv();
 if(activeKind==='STOCK_QUERY'){
  if(!latestStockQuery)return null;
  const {analysis:a,metrics:m}=latestStockQuery;
  const data={version:root.ShitouReleaseV50.code,mode:'SINGLE_STOCK_RESEARCH',analysis:a,report:R.view(a),metrics:m,formalRank:null,performance:'NOT_VALIDATED'};
  if(type==='json')save(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`石頭少爺_${root.ShitouReleaseV50.displayCode}_${a.code}_個股研究.json`);
  else if(type==='csv'){const p=a.foundation?.alertPlan,esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';const rows=[['code','date','priceAbove','priceBelow','dayGainPercent','dayLossPercent','status'],[a.code,a.date,p?.priceAbove?.input,p?.priceBelow?.input,p?.dayGainPercentInput,p?.dayLossPercentInput,'MANUAL_ONLY']];save(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`石頭少爺_${root.ShitouReleaseV50.displayCode}_${a.code}_到價提醒.csv`);}
  else save(new Blob([`個股專屬研究｜${a.name}（${a.code}）\n行情 ${m.marketDate}｜收盤 ${stockFmt(m.close)}｜日RSI5 ${stockFmt(m.rsi5)}｜日MA20 ${stockFmt(m.ma20)}\n${R.text(a)}\n僅當次個股查詢，不參與原榜排名。`],{type:'text/plain;charset=utf-8'}),`石頭少爺_${root.ShitouReleaseV50.displayCode}_${a.code}_個股研究.txt`);
  return data;
 }
 const rank=ranking(),data={version:root.ShitouReleaseV50.code,identity,date,flags,baseline:[...baselines].map(([kind,b])=>({kind,...b})),experimental:rank,entryFilter:{mode:entryMode(),counts:Entry.counts(researchPool()),selectedCodes:selectedRows().map(x=>x.analysis.code)},queried:[...records.values()],performance:'NOT_VALIDATED'};
 if(type==='json')save(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`石頭少爺_${root.ShitouReleaseV50.displayCode}_研究比較.json`);
 else if(type==='csv'){const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"',rows=[['code','date','priceAbove','priceBelow','dayGainPercent','dayLossPercent','nextTradingDate','status'],...[...records.values()].map(a=>{const p=a.foundation?.alertPlan;return [a.code,a.date,p?.priceAbove.input,p?.priceBelow.input,p?.dayGainPercentInput,p?.dayLossPercentInput,p?.nextTradingDate,'MANUAL_ONLY'];})];save(new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`石頭少爺_${root.ShitouReleaseV50.displayCode}_DRAX.csv`);}
 else save(new Blob([[root.ShitouReleaseV50.release,'多方進場二次篩選：'+Entry.LABELS[entryMode()],...selectedRows().map(x=>R.text(x.analysis))].join('\n\n')],{type:'text/plain;charset=utf-8'}),`石頭少爺_${root.ShitouReleaseV50.displayCode}_研究戰報.txt`);
 return data;
}
async function copy(value,button){try{await navigator.clipboard.writeText(String(value));button.textContent='已複製';}catch(_){const box=el('textarea',String(value));box.readOnly=true;button.after(box);box.select();button.textContent='請長按選取複製';}}
function alertControls(a){const plan=a.foundation.alertPlan,box=el('div');box.className='research-alerts';for(const [label,value] of [['價格高於',plan.priceAbove.input],['價格低於',plan.priceBelow.input],['單日漲幅超過',plan.dayGainPercentInput],['單日跌幅超過',plan.dayLossPercentInput]]){const button=el('button',label+'：'+(value===null?'尚無有效價位':label.startsWith('價格')?R.fmt(value):String(value)));button.type='button';button.disabled=value===null;button.onclick=()=>copy(label.startsWith("價格")?R.fmt(value):value,button);box.appendChild(button);}const all=el('button','複製四欄'),link=el('a','開啟 DRAX');all.type='button';all.onclick=()=>copy([`股票 ${a.code}｜${a.date}`,`價格高於 ${R.fmt(plan.priceAbove.input)}`,`價格低於 ${R.fmt(plan.priceBelow.input)}`,`單日漲幅超過 ${plan.dayGainPercentInput??'未知'}`,`單日跌幅超過 ${plan.dayLossPercentInput??'未知'}`,'平台語意待確認；待手動設定'].join('\n'),all);link.href='https://drax.tw/';link.target='_blank';link.rel='noopener noreferrer';box.append(all,link);return box;}
async function preview(analyses,{stockMode=false,detail=false,chartOnly=false}={}){if(!analyses.length)return;const token=++previewSerial,query=stockQuerySerial;root.ShitouImageShareV1?.clear();if(document.fonts?.ready)await document.fonts.ready;if(token!==previewSerial||query!==stockQuerySerial)return null;
 const pages=analyses.flatMap(a=>{const metrics=stockMode&&latestStockQuery?.analysis===a?latestStockQuery.metrics:null;
 if(chartOnly){const c=R.candlePage(a,{displayCode:root.ShitouReleaseV50.displayCode});return c?[c]:[];}
 return R.pages(a,{displayCode:root.ShitouReleaseV50.displayCode,stockMetrics:metrics,stockMode,detail});});
 return root.strongStockShowPagesV47(pages,{title:chartOnly?'四策略研究｜結構證據圖':'四策略研究｜新手進出場指南',prefix:root.ShitouReleaseV50.displayCode+(stockMode?'_個股研究':'_研究')+(chartOnly?'_結構圖':''),date:analyses[0].date,kind:'v8-research',note:stockMode?'個股研究不列入濾網排名｜非買進訊號':'精簡摘要僅供研究觀察；原榜資格與排序保留。'});}
function mountStock(input){const host=by('result');if(!host)return;by('researchStock')?.remove();const a=forReport(input);if(!Object.values(flags).some((v,i)=>v&&Object.keys(flags)[i].endsWith('Enabled')))return;const box=el('section');box.id='researchStock';box.className='research-inline';const card=researchCard(a,1,'個股',true);card.querySelector('.research-card-actions>button').onclick=()=>preview([a],{stockMode:true});box.append(el('h3','四策略研究摘要'),card);host.append(box);}
function setFlags(next){flags=U.flags({...flags,...next});cache.clear();seen.clear();records.clear();revision++;try{localStorage.setItem('shitou-research-flags-v1',JSON.stringify(flags));}catch(_){}const snapshot=root.ShitouSelectionDataV2?.getSnapshot?.();if(snapshot){const results=[...sourceRecords].map(([code,data])=>({ok:true,code,data}));capture({snapshot,items:results.map(x=>({code:x.code})),results});}if(typeof lastReportData!=='undefined'&&lastReportData){captureStockQuery(lastReportData);mountStock(lastReportData);}schedule();return {...flags};}
function render(){const panel=by('researchPanel');if(!panel)return;
 if(by('researchCsv')){by('researchCsv').disabled=!latestStockQuery;by('researchCsv').title=latestStockQuery?`製作 ${latestStockQuery.analysis.name}（${latestStockQuery.analysis.code}）提醒圖片`:'請先完成個股查詢';}
 if(activeKind==='STOCK_QUERY'){
  const stock=latestStockQuery,host=by('researchRows');by('researchEntryTools')?.replaceChildren();by('researchToggle').checked=flags.fourModelsEnabled;
  host.classList.add('research-card-grid');host.replaceChildren();
  by('researchScope').textContent=stock?`個股查詢：${stock.analysis.name}（${stock.analysis.code}）｜行情 ${stock.metrics.marketDate}`:'請先在「個股查詢」輸入股票代號並完成分析。';
  by('researchBaseline').textContent='此模式只顯示最新一次成功查詢的股票，不參與六套原濾網的排名。';
  by('researchFunnel').textContent=stock?(stock.metrics.verifiedDailyResearch?'已顯示該股四模型研究與關鍵價位；資料認證另查。':'個股行情可供觀察；四模型所需完整日K資料不足，不補猜訊號。'):'查詢成功後可展開手機卡片、查看圖片及匯出文字摘要。';
  if(stock){host.append(stockQueryIntro(stock));const card=researchCard(stock.analysis,1,'個股',true);host.append(card);
   const button=card.querySelector('.research-card-actions>button');if(button)button.onclick=()=>preview([stock.analysis],{stockMode:true});}
  by('researchPreview').disabled=!stock;
  by('researchPreview').textContent='四策略研究｜個股查詢摘要圖';
  return;
 }
 by('researchPreview').textContent='目前篩選前八檔附圖';
 const rank=ranking(),base=baselines.get(activeKind),selected=selectedRows();by('researchEntryTools').replaceChildren(entryControls(researchPool(),activeKind,render));by('researchToggle').checked=flags.fourModelsEnabled;by('researchScope').textContent=`行情 ${date||'待查詢'}｜本策略取得 ${researchPool().length} 檔｜二次篩選顯示 ${selected.length} 檔。`;
 by('researchBaseline').textContent=base?`${LABEL[activeKind]} 原榜：${base.entries.map(x=>'#'+x.rank+' '+x.code).join('、')||'0檔'}。原排序保留。`:'此策略目前只有研究摘要，尚無可比較原榜。';const host=by('researchRows');host.replaceChildren();
 host.classList.add('research-card-grid');
 for(const row of selected.slice(0,8))host.append(researchCard(row.analysis,row.rank,'原榜位置'));if(!selected.length)host.append(el('p','目前沒有符合所選進場檢查的股票。請切換查看「先等」「待核」或「全部」，不要為了湊名單放寬條件。'));
 const risk=el('p',`補充：風險觀察 ${rank.risks.length} 檔｜資料不足 ${rank.dataInsufficient.length} 檔。`);risk.className='research-card-note';host.append(risk);by('researchPreview').disabled=!selected.length;
 const dual=[...records.values()].map(a=>a.foundation?.dualScanContext).filter(Boolean);by('researchFunnel').textContent=`模式一符合 ${dual.filter(x=>x.modeA.status==='RESEARCH_MATCH').length}｜待驗證 ${dual.filter(x=>x.modeA.status==='DATA_UNVERIFIED').length}；模式二符合 ${dual.filter(x=>x.modeB.status==='RESEARCH_MATCH').length}｜待驗證 ${dual.filter(x=>x.modeB.status==='DATA_UNVERIFIED').length}。`;
}
function mount(){const panel=el('section');panel.id='researchPanel';panel.className='research-inline';panel.innerHTML='<h3>四策略研究</h3><p>原榜保留；新增「⑦ 個股查詢」可查看剛完成的單股專屬研究摘要。</p><div class="research-tools"><label><input id="researchToggle" type="checkbox">四模型研究</label><button id="researchRollback" type="button">一鍵關閉新增研究</button><button id="researchRestore" type="button">恢復研究顯示</button><select id="researchKind" aria-label="比較原策略"></select></div><p id="researchScope" role="status"></p><p id="researchBaseline"></p><p id="researchFunnel"></p><div id="researchEntryTools"></div><div id="researchRows"></div><div class="research-tools"><button type="button" id="researchPreview">研究前八強附圖</button><button type="button" id="researchTxt">匯出文字報告（TXT）</button><button type="button" id="researchCsvZh">匯出繁體中文研究表（CSV）</button><button type="button" id="researchJson">原始研究資料（JSON）</button><button type="button" id="researchCsv">DRAX 價格對應提醒</button></div>';
 const target=by('priceActionPanel')||by('towerGoldPanel');if(target)target.after(panel);else document.body.append(panel);for(const [k,v] of Object.entries(LABEL)){const o=el('option',v);o.value=k;by('researchKind').append(o);}by('researchKind').value=activeKind;by('researchKind').onchange=e=>{activeKind=e.target.value;render();};by('researchToggle').onchange=e=>setFlags({fourModelsEnabled:e.target.checked});by('researchRollback').onclick=()=>setFlags(Object.fromEntries(Object.keys(U.DEFAULTS).filter(k=>k.endsWith('Enabled')).map(k=>[k,false])));by('researchRestore').onclick=()=>setFlags(U.DEFAULTS);by('researchPreview').onclick=()=>activeKind==='STOCK_QUERY'?latestStockQuery&&preview([latestStockQuery.analysis],{stockMode:true}):preview(selectedRows().slice(0,8).map(x=>x.analysis));by('researchTxt').onclick=()=>exportData('txt');by('researchCsvZh').onclick=()=>exportData('csv-zh');by('researchJson').onclick=()=>exportData('json');by('researchCsv').onclick=()=>{if(latestStockQuery)root.ShitouDraxPriceReminder?.open(latestStockQuery.analysis,by('researchCsv'));};
}
for(const name of ['buildReportText','buildReportTextV32','buildLegacyReportText']){const old=root[name];if(typeof old==='function')root[name]=function(input,...args){const out=old.call(this,input,...args);if(!flags.fourModelsEnabled&&!flags.threeDayStructureEnabled&&!flags.granvilleContextEnabled&&!flags.candlePatternEnabled&&!flags.dualScanEnabled&&!flags.alertPlanEnabled)return out;return typeof out==='string'&&!out.includes('【V8研究附錄】')?out+'\n\n【V8研究附錄】\n'+R.text(forReport(input)):out;};}
const oldAnalyze=root.analyzeStock;if(typeof oldAnalyze==='function')root.analyzeStock=async function(...args){
 if(by('searchButton')?.disabled)return;
 const seq=++stockQuerySerial;
 const stockInput=by('stockInput'),hasSearch=!!(stockInput?.value?.trim()||!stockInput);
 const previous=typeof lastReportData!=='undefined'?lastReportData:null;
 clearStockQuery();
 try{
  const result=await oldAnalyze.apply(this,args);
  const newest=typeof lastReportData!=='undefined'?lastReportData:null;
  // The original UI can return before resetting lastReportData on empty input.
  // Never re-use an older query after a failed or empty search.
  if(seq===stockQuerySerial&&hasSearch&&newest&&newest!==previous&&by('result')?.style.display==='block'){
   let prepared;
   try{prepared=await root.ShitouQueryRuntime.deadline(()=>prepareStockQuery(newest),22000,'研究補充資料超時，主結果仍可閱讀；可稍後重新分析。');}
   catch(e){prepared={...newest,researchAcquisitionError:e.message,researchInputErrors:[...(newest.researchInputErrors||[]),e.message]};}
   if(seq===stockQuerySerial)safely(()=>{captureStockQuery(prepared,{activate:true});mountStock(prepared);});
  }
  return result;
 }catch(e){if(seq===stockQuerySerial)clearStockQuery();throw e;}
};
function active(){return flags.fourModelsEnabled||flags.threeDayStructureEnabled||flags.granvilleContextEnabled||flags.candlePatternEnabled||flags.dualScanEnabled||flags.alertPlanEnabled;}
function appendScanText(kind,scan,out,rows=scan?.candidates||[]){if(!active()||typeof out!=='string'||out.includes('【V8研究附錄】'))return out;const list=rows.map(c=>safely(()=>forReport(c))).filter(Boolean);return out+'\n\n【V8研究附錄】\n'+list.map(R.text).join('\n\n');}
function pagesForScan(kind,scan,options={}){if(!active())return [];const rows=options.rows||scan?.candidates||[],limit=options.limit===undefined?rows.length:options.limit;return rows.slice(0,limit).flatMap(c=>{const a=safely(()=>forReport(c));return a?R.pages(a,{displayCode:root.ShitouReleaseV50.displayCode,watermark:options.watermark}):[];});}
root.ShitouResearchIntegration=Object.freeze({appendScanText,pagesForScan,bind,capture,forReport,prepareStockQuery,mountStock,baseline,ranking,selectedRows,exportData,preview,captureStockQuery,clearStockQuery,getCurrentStock:()=>latestStockQuery&&({analysis:latestStockQuery.analysis,metrics:latestStockQuery.metrics}),setFlags,getFlags:()=>({...flags}),getState:()=>({identity,date,records:[...records.values()],baselines:[...baselines],cacheSize:cache.size}),sync,render});
mount();const snapshot=root.ShitouSelectionDataV2?.getSnapshot?.();if(snapshot)bind(snapshot);
for(const id of ['momentumResult','dayTradeResult','strongStockResult','towerGoldPanel','restaurantResult','structureResult']){const host=by(id);if(host)new MutationObserver(changes=>{if(changes.some(c=>!c.target.closest?.('.research-inline')))schedule();}).observe(host,{childList:true,subtree:true});}
render();
})(globalThis);

