/* Current-report context only. No parallel history or comparison dashboard. Never sorts/mutates a scan. */
(function(root){'use strict';
const C=root.ShitouIndicatorShadowCore;if(!C)return;
const VERSION=root.ShitouReleaseV50?.code||C.MODEL;
const LABELS={MAIN:'① 主升段',DAYTRADE:'② 當沖盤前',STRONG:'③ 強勢飆股',TOWER:'④ 寶塔點金',RESTAURANT:'⑤ 餐廳量價',STOCK:'個股分析'};
const cache=new Map();
const el=(tag,text,className)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(className)x.className=className;return x;};
const num=v=>v===null||v===undefined||typeof v==='boolean'||typeof v==='object'||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
function canonical(candidate,asOf){
 let original=candidate?.rsiObservationSource||candidate?.report||candidate||{};const code=String(original.stock||original.code||candidate?.code||'');
 if((candidate?.code&&(original.stock||original.code)&&String(candidate.code)!==String(original.stock||original.code))||(candidate?.market&&original.market&&String(candidate.market).toUpperCase()!==String(original.market).toUpperCase()))return {...original,completed:false,canonicalError:'候選與來源報告代號／市場別不同'};
 if(!candidate?.rsiObservationSource&&!candidate?.report&&!original.dailySeries&&!original.canonicalBars&&candidate?.tower?.bars){
  const t=candidate.tower,sourceDate=C.date(t.date||candidate.date);
  if(!sourceDate||t.date&&candidate.date&&C.date(t.date)!==C.date(candidate.date))return {stock:code,completed:false,canonicalError:'寶塔來源日期缺失或衝突'};
  original={stock:code,name:candidate.name,market:candidate.market,closeDate:sourceDate,close:t.bars.at(-1)?.close,canonicalBars:t.bars,completed:t.completed===true,priceAdjustment:{verified:t.basisVerified===true}};
 }
 if(candidate?.rsiObservationSource&&candidate?.tower){const sourceDate=C.date(original.closeDate||original.dataDate);if((!candidate.tower.date&&!candidate.date)||[candidate.tower.date,candidate.date].some(d=>d&&C.date(d)!==sourceDate)||String(original.stock||original.code||'')!==code)return {...original,completed:false,canonicalError:'寶塔觀察來源代號／日期缺失或衝突'};}
 let r=original;
 try{const D=root.ShitouSelectionDataV2,p=D?.get(code);
  if(p&&!p.error)r=D.apply({...original,stock:code},code);
  else if(D?.getSnapshot?.()?.map?.has(code)){
   // Read-only validation against an independently certified completed market snapshot.
   // Do not remember/apply into the scanner cache or manufacture a close date.
   const verified=D.validate({...original,stock:code},code);
   r={...original,stock:code,market:verified.q.market,marketDate:verified.date,completed:true,dataTiming:'POST_CLOSE_ONLY',canonicalBars:verified.bars,expectedTradingDates:verified.expectedTradingDates,priceAdjustment:verified.priceAdjustment,corporateActions:verified.corporateActions,observationBasis:{source:'READ_ONLY_SNAPSHOT_OHLCV_CHECK',fingerprint:verified.fingerprint}};
  }
 }catch(error){return {...original,completed:false,canonicalError:String(error?.message||error)};}
 if((candidate?.code&&String(candidate.code)!==String(r.stock||r.code||code))||(candidate?.market&&r.market&&String(candidate.market).toUpperCase()!==String(r.market).toUpperCase()))return {...r,completed:false,canonicalError:'共用來源與候選代號／市場別不同'};
 return {...r,rsiLegacyAudit:original.rsiLegacyAudit||{value:num(original.dailyRsi5??original.dailyRsi),date:C.date(original.dailyRsi5Date||original.rsiDate||original.closeDate||original.dataDate),source:'ORIGINAL_REPORT_VALUE'}};
}
function evidence(report,asOf){
 const source=report.canonicalBars?.length?report.canonicalBars:report.dailySeries;
 const key=C.fingerprint([asOf,source,report.close,report.completed,report.isComplete,report.dataTiming,report.marketDate,report.closeDate,report.dataDate,report.expectedTradingDates,report.priceAdjustment,report.corporateActions,report.corporateActionUnresolved,report.priceAdjustmentConsistent,report.stock,report.market,report.monthlyReviewV2,report.monthlyPass,report.entry,report.startMonthConfirmed,report.officialMonthlyUnavailable,report.canonicalError,report.rsiSourceAudit,report.rsiLegacyAudit,report.dailyRsi5,report.dailyRsi,report.dailyRsi5Date,report.rsiDate,report.rsi5Meta,report.dailySeriesMeta]);
 if(cache.has(key))return cache.get(key);
 const e=C.evaluate(report,{asOf});cache.set(key,e);if(cache.size>1500)cache.delete(cache.keys().next().value);return e;
}
function makeRow(candidate,index,kind,asOf,ranked,now){
 const report=canonical(candidate,asOf),code=String(candidate?.code||report.stock||report.code||''),e=evidence(report,asOf);
 const monthly=e.volume?.monthlyStatus||candidate.monthly?.status||candidate.selectionEvidence?.monthlyStatus||report.monthlyReviewV2?.status||'UNVERIFIED';
 const observation=C.extended.advice(e,candidate,kind,monthly);
 return {code,name:displayName(code,candidate?.name||report.name),baselineModel:candidate.model||'LEGACY_'+kind,baselineRelease:VERSION.split('-RSICTX.')[0],baselineScores:JSON.parse(JSON.stringify({score:candidate.score??null,launchScore:candidate.launchScore??null,strengthScore:candidate.strengthScore??null,rankingScore:candidate.rankingScore??null,quality:candidate.quality??null,courseSuitabilityScore:candidate.courseSuitabilityScore??null})),rsiExtended:e.rsiExtended,observation,market:report.market||null,strategy:kind,date:asOf,subtype:kind==='TOWER'?(candidate.type||'NONE'):String(candidate.setup?.key||candidate.entryFamily||candidate.mainAdvanceStage?.key||candidate.stage?.key||''),...(kind==='RESTAURANT'?{strategyEvidence:{model:candidate.model,rule:candidate.rule,status:candidate.status,event:candidate.event,features:candidate.features,levels:candidate.levels,riskCodes:candidate.riskCodes,checks:candidate.checks,sourceMatch:candidate.sourceMatch}}:{}),baselineRank:ranked?index+1:null,baselineScore:num(candidate.score?.final??candidate.score),baselineQuality:num(candidate.quality?.value),baselineCourseScore:num(candidate.courseSuitabilityScore),baselineGrade:candidate.grade||candidate.status||null,baselineDecision:candidate.selectionDecision?.state||candidate.actionGate?.key||null,baselineFormalRank:num(candidate.formalRank??candidate.displayRankV40),baselineEligible:candidate.eligible??candidate.formalCandidate??null,monthlyStatus:e.volume?.monthlyStatus||candidate.monthly?.status||candidate.selectionEvidence?.monthlyStatus||report.monthlyReviewV2?.status||'UNVERIFIED',strategyContext:C.strategyContext(e,kind,kind==='TOWER'?candidate.type:''),capturedAt:now,origin:'LIVE_CAPTURE',evidence:e,outcome:{status:'NOT_TRACKED',reason:'本版不追蹤後續績效'}};
}
function displayName(code,value){
 let mapped;try{const entry=root.getEmbeddedStockDirectory?.()?.byCode?.[code];mapped=typeof entry==='string'?entry:entry?.name;}catch(_){}
 const clean=v=>typeof v==='string'&&/[\u3400-\u9fff]/.test(v)&&!/[\p{Script=Latin}\u0000-\u001f<>]/u.test(v)?v:null;
 return root.ShitouRestaurantCore?.displayName(code,{name:value})||clean(mapped?.replace(/[-－]?(?:KY|DR)(?:\*)?$/i,''))||clean(value)||'股票'+code;
}
function rowContext(r){return [...C.contextLines(r.evidence,r.strategy,r.subtype),...(r.observation?.lines||['買賣情境：未計算（保留舊紀錄）'])];}
function capture(kind,scan){
 if(!scan||!LABELS[kind]||kind==='STOCK')return null;
 const asOf=C.date(scan.dataDate||scan.date||scan.marketBundleMeta?.targetTradeDate||scan.marketBundleMeta?.completedTradeDate);if(!asOf)return null;
 const now=new Date().toISOString(),ranked=Array.isArray(scan.candidates)?scan.candidates:[],extras=(kind==='TOWER'||kind==='RESTAURANT')?(scan.riskCandidates||[]):kind==='STRONG'?(scan.selectionParked||[]):[];
 const rows=ranked.map((c,i)=>makeRow(c,i,kind,asOf,true,now)),codes=new Set(rows.map(r=>r.code));
 extras.forEach(c=>{const code=String(c.code||c.report?.stock||'');if(code&&!codes.has(code)){rows.push(makeRow(c,0,kind,asOf,false,now));codes.add(code);}});
 const scope={candidateCount:ranked.length,parkedCount:rows.length-ranked.length,planned:scan.planned??scan.total??null,processed:scan.attempted??scan.done??null,pending:scan.pending??null,complete:scan.complete===true||scan.completed===true,fullMarketCertified:scan.fullMarketCertified===true,profile:scan.profile||scan.analysisProfile||null};
 // Build only this report's serializable context; do not retain scan history.
 const id=[kind,asOf,C.fingerprint([scope,rows.map(({capturedAt,outcome,...r})=>r)])].join('|');
 return {id,model:C.MODEL,release:VERSION,policy:C.POLICY,strategy:kind,date:asOf,capturedAt:now,scope,rows};
}
function appendText(base,kind,scan){
 const marker='【RSI／OBV／SAR並行觀察｜不參與原排序】';if(typeof base!=='string'||base.includes(marker))return base;
 const run=capture(kind,scan);if(!run)return base;
 return base+'\n\n'+[marker,`模型 ${C.MODEL}｜版本 ${VERSION}｜交易日 ${run.date}`,`原候選 ${run.scope.candidateCount}｜風險旁列 ${run.scope.parkedCount}｜${run.scope.fullMarketCertified?'沿用原市場覆蓋認證':'非全市場完整排名'}`,'RSI5／10／14同源Wilder；來源原值另列／OBV20正規化／SAR 0.02–0.20；不新增權重，不改原分數、資格與名次。',...run.rows.flatMap(r=>[`${r.baselineRank?'原序 #'+r.baselineRank:'風險旁列'} ${r.name}（${r.code}）${r.subtype?'｜'+r.subtype:''}｜原分 ${r.baselineScore??r.baselineQuality??'未提供'}`,[...C.lines(r.evidence),...rowContext(r)].join('｜')]),'技術情境僅供當次報告參考；尚未驗證績效。'].join('\n');
}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function rowsNode(run,limit=30){
 const box=el('div');if(!run.rows.length)box.appendChild(el('p','本次原榜沒有候選；沒有補出股票或變更資格。'));
 run.rows.slice(0,limit).forEach(r=>{const detail=el('details'),title=el('summary',`${r.baselineRank?'原序 #'+r.baselineRank:'風險旁列'} ${r.name}（${r.code}）${r.subtype?'｜'+r.subtype:''}`);detail.appendChild(title);const p=el('p',[...C.lines(r.evidence),...rowContext(r)].join('\n'));p.style.whiteSpace='pre-wrap';detail.appendChild(p);box.appendChild(detail);});
 if(run.rows.length>limit)box.appendChild(el('p',`畫面先列 ${limit}／${run.rows.length} 檔；完整情境請看該策略文字／圖片報告。`));return box;
}
function mount(run,hostId){const host=document.getElementById(hostId);if(!host||!run)return;let box=document.getElementById(hostId+'IndicatorShadow');if(!box){box=el('section',undefined,'rule indicator-shadow-box');box.id=hostId+'IndicatorShadow';host.appendChild(box);}box.replaceChildren(el('h3','動能與量價情境｜原序保留'),el('p',`${run.date}｜RSI5／10極端事件、RSI14持續性／OBV／SAR／空手與持股情境。僅供當次報告參考，未參與計分／排序。`),rowsNode(run,12));}
function wrapImageText(ctx,value,width=1188,size=42){
 ctx.font=`700 ${size}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;const out=[];
 for(const paragraph of String(value).split('\n')){let line='';const tokens=paragraph.match(/[+-]?[A-Za-z0-9]+(?:[._:/%+-][A-Za-z0-9]+)*|[\s\S]/gu)||[];for(const token of tokens){const parts=ctx.measureText(token).width>width?[...token]:[token];for(const part of parts){if(line&&ctx.measureText(line+part).width>width){out.push(line);line='';}if(ctx.measureText(part).width>width)throw Error('單字寬度超出版面');line+=part;}}out.push(line);}return out;
}
function monthLabel(s){return s==='PASS'?'月線已驗證通過':s==='NOT_PASS'?'月線未通過':'月線尚未驗證';}
function rowImageLines(r){return [`${r.name}（${r.code}）${r.subtype?'｜'+r.subtype:''}`,r.strategy==='STOCK'?monthLabel(r.monthlyStatus):`${r.baselineRank?'原序 #'+r.baselineRank:'風險旁列'}｜原分 ${r.baselineScore??r.baselineQuality??'未提供'}｜${monthLabel(r.monthlyStatus)}`,...C.lines(r.evidence),...rowContext(r)];}
function imagePage(run,rows,offset,page,total,prepared){
 const canvas=document.createElement('canvas');canvas.width=1284;canvas.height=2778;const ctx=canvas.getContext('2d');ctx.fillStyle='#edf3f8';ctx.fillRect(0,0,1284,2778);
 const draw=(text,y,size=42,color='#18334d')=>{ctx.font=`700 ${size}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(text,48,y);};
 const body=prepared||rows.flatMap(r=>rowImageLines(r).flatMap(t=>wrapImageText(ctx,t)));
 if(body.length>32)throw Error('觀察圖超過單頁容量，請使用完整分頁產生器');
 ctx.fillStyle='#123a5a';ctx.fillRect(0,0,1284,310);draw('動能與量價情境｜'+(LABELS[run.strategy]||run.strategy),30,46,'#fff');draw(`${run.date}｜第 ${page}／${total} 頁`,108,42,'#fff');draw(run.strategy==='RESTAURANT'?'風險與符合度排序｜新策略觀察':'原排序保留｜強勢與新買風險分開',178,40,'#ffe7a2');wrapImageText(ctx,VERSION,1188,23).slice(0,2).forEach((line,i)=>draw(line,250+i*28,23,'#d9e8f7'));
 ctx.fillStyle='#fff';ctx.fillRect(24,332,1236,2070);const top=356,step=62;body.forEach((line,i)=>draw(line,top+i*step));
 draw('量價代理不等於主力意圖；非上漲機率。',2460,38);draw('價差未扣成本／滑價；未確認實際成交。',2524,38);draw(`此頁為完整報告補充｜${rows.map(r=>r.code).join('、')}`,2600,36);
 canvas.dataset.reportText=encodeURIComponent(JSON.stringify(body));canvas.dataset.indicatorShadowAudit=JSON.stringify({model:C.MODEL,page,total,width:1284,height:2778,minBodyFont:42,bodyLineCount:body.length,codes:rows.map(r=>r.code),offset,sections:[{top:332,bottom:top+body.length*step}],noOverlap:top+body.length*step<=2402});return canvas;
}
function imagePages(run,rows=run.rows,options={}){
 const probe=document.createElement('canvas').getContext('2d'),plans=[];
 rows.forEach((r,index)=>{const lines=rowImageLines(r).flatMap(t=>wrapImageText(probe,t));for(let at=0;at<lines.length;at+=32)plans.push({row:r,offset:index,lines:lines.slice(at,at+32)});});
 return plans.map((p,i)=>{const render=()=>imagePage(run,[p.row],p.offset,i+1,plans.length,p.lines);if(!options.lazy)return render();return {width:1284,height:2778,dataset:{indicatorShadowAudit:JSON.stringify({model:C.MODEL,page:i+1,total:plans.length,codes:[p.row.code],lazy:true}),reportText:encodeURIComponent(JSON.stringify(p.lines))},toBlob(callback,type='image/png'){const c=render();c.toBlob(blob=>{c.width=c.height=0;callback(blob);},type);}};});
}
function watermarkPage(page,kind){if(typeof page.getContext==='function'){root.applyAntiTheftWatermarkV3761(page,kind);return;}page.toBlob=function(callback,type){const lines=JSON.parse(decodeURIComponent(page.dataset.reportText)),audit=JSON.parse(page.dataset.indicatorShadowAudit),run={date:page.dataset.observationDate,strategy:page.dataset.observationStrategy},row={code:audit.codes[0]};const c=imagePage(run,[row],0,audit.page,audit.total,lines);root.applyAntiTheftWatermarkV3761(c,kind);c.toBlob(blob=>{c.width=c.height=0;callback(blob);},type||'image/png');};page.dataset.watermark='enabled';}
function pagesForScan(kind,scan,options={}){
 const run=capture(kind,scan);if(!run)return [];const rows=run.rows.filter(r=>r.baselineRank!==null&&(options.limit===undefined||r.baselineRank<=options.limit));const pages=imagePages(run,rows,{lazy:true});pages.forEach(p=>Object.assign(p.dataset,{observationDate:run.date,observationStrategy:kind}));
 if(options.watermark&&typeof root.applyAntiTheftWatermarkV3761==='function')pages.forEach(p=>watermarkPage(p,'all'));return pages;
}
function stockRow(input){const report=input?.report||input||{},asOf=C.date(report.marketDate||report.closeDate||report.dataDate);return makeRow(report,0,'STOCK',asOf,false,new Date().toISOString());}
function pagesForStock(report,options={}){const row=stockRow(report),run={date:row.date||'日期不足',strategy:'STOCK',rows:[row]};const pages=imagePages(run);if(options.watermark&&typeof root.applyAntiTheftWatermarkV3761==='function')pages.forEach(p=>watermarkPage(p,'stock'));return pages;}
async function showImagePages(pages,run){
 if(!pages.length)throw Error('沒有可輸出的觀察資料');
 if(root.strongStockShowPagesV47)return root.strongStockShowPagesV47(pages,{title:(LABELS[run.strategy]||'個股')+'｜動能量價附圖',prefix:'INDICATOR_SHADOW_'+VERSION,date:run.date,kind:'indicator-shadow',note:'依原序逐檔分頁；內容超出自動續頁，完整報告請下載全部ZIP。'});
 if(pages.length>1)throw Error('多頁預覽工具未載入，停止輸出以免只存第一頁');
 const blob=await new Promise(resolve=>pages[0].toBlob(resolve));if(!blob)throw Error('PNG輸出失敗');download(blob,'動能量價觀察.png');
}
async function previewStock(report){if(document.fonts?.ready)await document.fonts.ready;const row=stockRow(report);return showImagePages(pagesForStock(report),{date:row.date,strategy:'STOCK'});}
function safe(fn,fallback){try{return fn();}catch(e){console.warn('情境報告未完成',e);return fallback;}}
function wrap(name,after){const base=root[name];if(typeof base!=='function')return;root[name]=function(...args){const out=base.apply(this,args);return safe(()=>after(out,args),out);};}
for(const [name,kind,id] of [['renderMomentumScanResultV3762','MAIN','momentumResult'],['renderMomentumScanResultV3765','MAIN','momentumResult'],['renderDayTradeScanResultV1','DAYTRADE','dayTradeResult']])wrap(name,(out,[scan])=>{mount(capture(kind,scan),id);return out;});
for(const [name,kind] of [['buildMomentumScanTextReportV3763','MAIN'],['buildMomentumScanCompactTextReportV377713','MAIN'],['buildDayTradeTextReportV1','DAYTRADE']])wrap(name,(out,[scan])=>appendText(out,kind,scan));
wrap('renderBeginnerCommandCenterV46',(out,[report])=>{const row=stockRow(report),e=row.evidence;const label=document.getElementById('dailyRsiSub');if(label&&!label.textContent.includes('原策略口徑'))label.textContent+='｜原策略口徑；同源多週期另列下方';const target=document.getElementById('beginnerCommandCenterV46');if(target){let box=document.getElementById('stockIndicatorShadow');if(!box){box=el('section',undefined,'rule indicator-shadow-box');box.id='stockIndicatorShadow';target.appendChild(box);}const p=el('p',[monthLabel(row.monthlyStatus),...C.lines(e),...rowContext(row)].join('\n'));p.style.whiteSpace='pre-wrap';const b=el('button','開啟個股動能量價附圖');b.type='button';b.onclick=()=>previewStock(report).catch(error=>{box.appendChild(el('p','附圖未完成：'+String(error.message||error)));});box.replaceChildren(el('h3','個股動能與量價情境'),p,b);}return out;});
for(const name of ['buildReportText','buildReportTextV32','buildLegacyReportText'])wrap(name,(out,[report])=>typeof out!=='string'||out.includes('【個股指標並行觀察】')?out:out+'\n【個股指標並行觀察】\n'+(()=>{const row=stockRow(report);return [...C.lines(row.evidence),...rowContext(row)].join('\n');})());
const style=el('style');style.textContent='.indicator-shadow-box{margin:20px auto;padding:20px;max-width:1320px;box-sizing:border-box;border:1px solid #9ab2ca;border-radius:16px;background:#f4f8fc;color:#18334d;line-height:1.7;overflow-wrap:anywhere}.indicator-shadow-box p,.indicator-shadow-box summary{color:#18334d}.indicator-shadow-box button,.indicator-shadow-box select{min-height:44px;font-size:16px;padding:8px 12px;max-width:100%;background:var(--card,#fff);color:var(--text,#18334d);border:1px solid var(--line,#9ab2ca);border-radius:8px}.indicator-shadow-box details{margin:10px 0;border-top:1px solid #bdcddd;padding-top:8px}body.dark-mode .indicator-shadow-box{background:var(--card,#121d2b);color:var(--text,#e6ebf1);border-color:var(--line,#2d3c50)}body.dark-mode .indicator-shadow-box p,body.dark-mode .indicator-shadow-box summary,body.dark-mode .indicator-shadow-box th,body.dark-mode .indicator-shadow-box td{color:var(--text,#e6ebf1)}';document.head.appendChild(style);
root.ShitouIndicatorShadow=Object.freeze({capture:(kind,scan)=>safe(()=>capture(kind,scan),null),appendText:(base,kind,scan)=>safe(()=>appendText(base,kind,scan),base),mount:(...args)=>safe(()=>mount(...args)),imagePage,imagePages,pagesForScan,pagesForStock,previewStock,stockRow,displayName,rowContext,wrapImageText,core:C});
})(typeof window!=='undefined'?window:globalThis);
