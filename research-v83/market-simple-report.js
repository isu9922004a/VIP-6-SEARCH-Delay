/* Standalone market PNG: uses only the validated independent TAIEX page snapshot. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ShitouMarketSimpleReport=api;
})(globalThis,function(root){
'use strict';
const Copy=typeof module==='object'&&module.exports?require('../report-beginner-copy-v88.js'):globalThis.ShitouReportCopyV88;
const explain=value=>Copy?Copy.line(value):String(value??'');
const TITLE='大盤精簡分析',VERSION='V8.8',WATERMARK='石頭少爺台股分析'+VERSION+'版',W=1284,MIN_H=2778,MAX_H=8192;
const V=typeof module==='object'&&module.exports?require('../elliott-wave-visual-v1.js'):root.ShitouElliottVisual;
const titleFor=()=>TITLE;
const colors={background:'#071f32',card:'#10344f',border:'#28627d',text:'#f0f6fb',muted:'#b8d9e9',yellow:'#f7cf70',aqua:'#79e4d1',red:'#ff9a91'};
const num=v=>Number.isFinite(v)?Number(v).toFixed(2):'待核對';
function validationText(b){const v=b?.schema==='v86-comparison-v1'&&b.partitions?.test?.variants;if(!v||!['A','C'].every(k=>Number.isFinite(v[k]?.accuracy)&&v[k].n>0))return '歷史驗證：尚無足夠證據證明V8.6.1較V8.5準確；未取得核驗回測表。';const a=v.A,c=v.C,e=c.crashSensitivity?.[-.02];return '歷史驗證：'+c.n+'日測試，V8.5方向命中 '+(a.accuracy*100).toFixed(1)+'%、V8.6.1 '+(c.accuracy*100).toFixed(1)+'%（保留方向亦列未命中）'+(e?.events?'；急跌辨識 '+e.truePositive+'/'+e.events:'')+'。'+(c.accuracy>a.accuracy?'小樣本尚不能證明提升。':'本次未改善方向準確率。')+'事後回測，未經前瞻驗證。';}
function model(snapshot,{watermarked=false}={}){
 const a=snapshot&&snapshot.analysis,src=snapshot&&snapshot.source,f=snapshot&&snapshot.forecast;
 if(!a||a.state!=='AVAILABLE'||!a.input?.bars?.length||!src?.name||!src?.source||a.illustration){
  throw Error('請先取得已核驗的台股大盤完成日K，再產生圖片；示意資料不可當成正式行情。');
 }
 if(a.instrumentType!=='TAIEX'||a.date!==a.input.asOf||a.input.bars.at(-1)?.date!==a.date||!Number.isFinite(a.close)){
  throw Error('大盤資料代號、日期或收盤點位不一致，請重新載入。');
 }
 const R=typeof module==='object'&&module.exports?require('../research-v86/market-regime.js'):root.ShitouMarketRegimeV86;
 const r=R.analyze(a.input,f),E=typeof module==='object'&&module.exports?require('./report-observations.js'):root.ShitouReportObservations,observations=E.fromMarket(a.input);
 if(r.state!=='AVAILABLE')throw Error('行情風險判讀資料未核驗：'+r.reasons.join('；'));
 const fresh=r.model.available?f:null,m=r.model;
 const pct=x=>(x*100).toFixed(1)+'%',direction={BULL:'偏多',BEAR:'偏空',FLAT:'持平',MIXED:'方向分歧',ABSTAIN:'保留方向判斷'};
 const blocks=[],add=(kind,text,tone)=>blocks.push({kind,text,...(tone?{tone}:{})});
 const T=typeof module==='object'&&module.exports?require('./market-freshness.js'):root.ShitouMarketFreshness,timeliness=T.historyStatus(a.input);if(timeliness.stale)add('notice',timeliness.message,'yellow');
 add('heading','① 下一交易日可能方向');
 add('highlight',fresh?(fresh.executionVerified?'已核對模型執行紀錄：':'模型執行紀錄尚未核對：')+direction[m.direction]+'；推演 '+m.targetDate+'，模擬收盤的中間值 '+num(m.medianClose)+' 點（'+pct(m.medianReturn)+'）。':'Kronos模型不可用；僅呈現歷史技術劇本，沒有模型方向或取樣比例。','yellow');
 add('body','目前走勢：'+r.regime.label+'；合併觀察：'+r.combinedState+'，'+direction[r.combinedDirection]+'。急跌風險：'+r.crashRisk.label+'。');
 add('heading','② 現在適合進場嗎');add('highlight',r.entryAssessment,'yellow');
 add('heading','③ 三個重要價位');
 r.levels.forEach((l,i)=>add('highlight',num(l.price)+' 點｜'+l.role+'。'+l.note,['aqua','yellow','red'][i]));
 if(observations.state==='AVAILABLE')for(const line of observations.levels)add('body','關卡有沒有站穩：'+line.text);
 add('heading','④ 為什麼這樣判斷');
 if(observations.state==='AVAILABLE'){add('highlight','漲跌力道：'+observations.momentum.text,'yellow');if(observations.divergence)add('body',observations.divergence.text);}
 for(const reason of r.reasons)add('body',reason);
 add('body','最近5／20／60天的平均收盤：'+[5,20,60].map(k=>num(r.features.ma[k].value)).join('／')+' 點；近14天平均每日波動 '+num(r.features.atr)+' 點。'+(r.structure.reversalConfirmed?'突破延續與均價、動能改善條件通過；仍需管理失效風險。':'尚未同時確認突破延續與趨勢反轉。'));
 add('heading','⑤ 明日三種可能走法');if(observations.action)add('body','明天先看：'+observations.action);for(const s of r.scenarios)add('body',s.title+'：'+s.trigger+' 不再適用的情況：'+s.invalid);
 add('body','新增的力道與關卡觀察還沒證明能提高預測準確率，不能單靠這些提醒決定買賣。');
 add('heading','⑥ 模型結果有多大把握');
 add('notice',fresh?'模擬結果：上漲 '+pct(f.bullish)+'／下跌 '+pct(f.bearish)+'／持平 '+pct(f.flat)+'（'+f.sampleCount+'條）。'+(r.uncertainty.level==='HIGH'?'結果分散或與行情訊號不一致，暫時無法明確判斷方向。':'結果較集中，仍需等行情確認。')+'這些比例不代表明天實際漲跌的機率。':'模型不可用：只保留技術與風險分析，不補造AI數據。','yellow');
 add('body','歷史驗證：目前沒有足夠證據證明這一版比前一版更準。資料完整度：'+(r.dataQuality.complete?'完成日K與交易日曆核對通過。':'日曆核驗仍有限制。')+'模型範圍與近期波動估計，都還沒證實能準確涵蓋隔日走勢。');
 if(fresh)add('notice','模擬收盤結果中間八成的範圍：'+num(m.interval.low)+'～'+num(m.interval.high)+'；合併近期波動後的觀察範圍 '+num(r.riskEnvelope.low)+'～'+num(r.riskEnvelope.high)+' 點。不是保證高低點。');
 if(fresh?.provenance?.inputQuality?.warning)add('footnote','模型需要成交金額，但資料來源沒有提供；目前以開盤、最高、最低、收盤價的平均乘以成交量估算，與實際成交金額可能有差異。');
 if(fresh?.provenance?.outputQuality?.warning)add('footnote','部分模擬結果的最高、最低價順序不合理，因此只列開盤與收盤結果，不提供模擬最高、最低價。');
 add('heading','⑦ 一句話總結');add('summary',r.summary,'aqua');
 // Wave pictures have their own buttons and do not lengthen this report.
 add('footnote','資料：'+src.source+'｜行情 '+a.date+'。盤後研究；跳空須重算風險，個股停損依原持股計畫，不保證走勢。');
 return {title:titleFor(watermarked),watermarked:!!watermarked,name:'臺灣加權股價指數（TAIEX）',date:a.date,close:a.close,modelRun:fresh?.executionVerified===true,source:src.source,forecastState:f?.state||'UNAVAILABLE',reportObservations:observations,blocks,levels:r.levels,nextTradeDate:m.targetDate||null,risk:r};

}
function wrap(ctx,text,maxWidth){
 const lines=[];for(const para of explain(text).split('\n')){
  let line='';for(const char of Array.from(para)){
   if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char;}
   else line+=char;
  }lines.push(line||' ');
 }return lines;
}
function page(snapshot,{document:doc=root.document,watermarked=false}={}){
 const data=model(snapshot,{watermarked}),canvas=doc.createElement('canvas');
 let H=MIN_H;canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('此瀏覽器無法建立PNG畫布。');
 const M=28,IN=34,maxWidth=W-2*M-2*IN,top=132,header=220,gap=14,chartHeight=740,chartTop=top+header+gap,bodyTop=chartTop+chartHeight+gap;let panelBottom=H-122;
 const font=(size,bold)=>{ctx.font=(bold?'750 ':'600 ')+size+'px "Microsoft JhengHei","Noto Sans TC",sans-serif';};
 const makeLayout=size=>{
  let total=76;
  const blocks=data.blocks.map(b=>{
   const s=b.kind==='heading'?size+4:b.kind==='footnote'?Math.max(24,size-6):b.kind==='notice'?size-3:size;
   const lineH=s+12,bold=['heading','summary','highlight'].includes(b.kind);
   font(s,bold);const lines=wrap(ctx,b.text,maxWidth),space=b.kind==='heading'?14:b.kind==='summary'?13:8;
   const height=lines.length*lineH+space;total+=height;
   return {...b,size:s,bold,lineH,lines,height};
  });
  return {size,blocks,total};
 };
 let layout=null;
 for(const s of [39,38,37,36,35,34,33]){
  const candidate=makeLayout(s);
  if(candidate.total<=panelBottom-bodyTop-36){layout=candidate;break;}
 }
 if(!layout){layout=makeLayout(33);H=Math.max(MIN_H,Math.ceil(bodyTop+layout.total+180));if(H>MAX_H)throw Error('大盤精簡分析內容超過圖片安全範圍，未刪除或截斷資料。');canvas.height=H;panelBottom=H-122;}
 const panel=(y,h)=>{ctx.fillStyle=colors.card;ctx.strokeStyle=colors.border;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(M,y,W-2*M,h,23);ctx.fill();ctx.stroke();};
 const draw=(lines,x,y,size,color,bold,lineH=size+12)=>{
  font(size,bold);ctx.fillStyle=color;for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*lineH);
 };
 ctx.fillStyle=colors.background;ctx.fillRect(0,0,W,H);
 panel(top,header);draw([data.title],M+IN,top+52,42,colors.muted,true);
 draw([VERSION+'｜'+(data.modelRun?'Kronos實跑':'盤後研究')],W-M-321,top+46,28,colors.yellow,true);
 draw([data.name],M+IN,top+125,62,colors.text,true);
 draw(['行情基準 '+data.date.replaceAll('-','/')+'｜收盤 '+num(data.close)+' 點'],M+IN,top+182,35,colors.muted);
 const wave=snapshot.analysis.elliottWave||V.result(snapshot.analysis);const chartAudit=V.chart(ctx,wave,{x:M,y:chartTop,width:W-2*M,height:chartHeight,bars:wave.bars?.length?wave.bars:snapshot.analysis.input.bars,levels:data.levels.map(l=>({label:l.role,price:l.price})),annotate:false,dark:true});
 panel(bodyTop,panelBottom-bodyTop);draw(['明天可能怎麼走？該怎麼做？'],M+IN,bodyTop+52,43,colors.text,true);
 let y=bodyTop+78;
 const usedHeight=layout.blocks.reduce((sum,b)=>sum+b.height,0);const spare=Math.max(0,panelBottom-24-(bodyTop+78+usedHeight));const spread=Math.min(12,spare/Math.max(1,layout.blocks.length+1));
 for(const b of layout.blocks){
  draw(b.lines,M+IN,y+b.size,b.size,colors[b.tone]||(b.kind==='heading'?colors.muted:b.kind==='notice'?colors.yellow:b.kind==='footnote'?colors.muted:colors.text),b.bold,b.lineH);
  y+=b.height+spread;
 }
 if(y>panelBottom-22)throw Error('大盤報告內容超過畫布安全區，已停止輸出避免裁切。');
 draw([VERSION+'｜1/1'],W-M-205,H-77,29,colors.muted,true);
 if(watermarked)(root.ShitouReportWatermark||(typeof require==='function'?require('../report-watermark-v84.js'):null)).apply(canvas,'market');
 const audit={wordingVersion:Copy?.VERSION,chart:chartAudit,elliottWave:null,extendedHeight:H>MIN_H,watermarkStyle:watermarked?'REFERENCE_DIAGONAL_V84':null,title:data.title,watermarked:data.watermarked,version:VERSION,width:W,height:H,date:data.date,close:data.close,bodyFont:layout.size,bodyBottom:y,safeBottom:panelBottom-22,noClipping:true,modelRun:data.modelRun,forecastState:data.forecastState,source:data.source,levels:data.levels,completeNarrative:true,blockCount:data.blocks.length,sections:7,regime:data.risk.regime.key,technicalDirection:data.risk.technicalDirection,combinedDirection:data.risk.combinedDirection,crashRisk:data.risk.crashRisk.level,executionVerified:data.modelRun};
 canvas.dataset.researchAudit=JSON.stringify(audit);
 return {width:W,height:H,dataset:{researchAudit:JSON.stringify(audit)},renderExportRegion:()=>canvas,toBlob:(cb,type='image/png')=>canvas.toBlob(cb,type)};
}
let activeUrl=null,imageBlob=null,imageFile=null,sharePending=false;
function current(){
 const snapshot=root.independentMarketReportSnapshot?.();
 if(!snapshot)throw Error('請先完成獨立大盤資料載入，再產生圖片。');
 return snapshot;
}
function status(message){const target=root.document.getElementById('simpleMarketReportStatus');if(target)target.textContent=message;}
function shareNotice(message){const target=root.document.getElementById('simpleMarketShareStatus');if(target)target.textContent=message;}
function cleanup(){if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=null;}imageBlob=null;imageFile=null;}
function close(){const dialog=root.document.getElementById('simpleMarketReportDialog');if(dialog?.open)dialog.close();else cleanup();}
function shareCurrentImage(){
 const nav=root.navigator,button=root.document.getElementById('simpleMarketLineShareButton');
 if(sharePending)return;
 if(!imageBlob?.size){shareNotice('圖片不存在，請重新產生大盤報告。');return;}
 const mobile=/iPhone|iPad|iPod|Android/i.test(nav?.userAgent||'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1);
 const clipboardAvailable=typeof nav?.clipboard?.write==='function'&&typeof root.ClipboardItem==='function';
 const fileShare=typeof nav?.share==='function'&&imageFile&&(typeof nav.canShare!=='function'||(()=>{try{return nav.canShare({files:[imageFile]});}catch(_){return false;}})());
 const finish=(promise,success)=>{sharePending=true;if(button)button.disabled=true;Promise.resolve(promise).then(()=>shareNotice(success)).catch(e=>shareNotice(e?.name==='AbortError'?'分享已取消；可重新分享。':'分享失敗：'+(e?.message||'瀏覽器不支援')+'；請下載PNG後至LINE聊天室傳送。')).finally(()=>{sharePending=false;if(button)button.disabled=false;});};
 if(fileShare&&(mobile||!clipboardAvailable)){
  try{finish(nav.share({files:[imageFile]}),'已交給系統分享功能；請在LINE聊天室確認送出。');}
  catch(e){shareNotice('開啟分享功能失敗，請下載PNG後至LINE傳送。');}
  return;
 }
 if(clipboardAvailable){
  try{finish(nav.clipboard.write([new root.ClipboardItem({'image/png':imageBlob})]),'已複製完整PNG圖片，請到LINE電腦版聊天室貼上送出。');}
  catch(e){shareNotice('複製PNG失敗，請下載PNG後至LINE傳送。');}
  return;
 }
 shareNotice('此瀏覽器無法直接分享圖片，請按「下載PNG」再從LINE聊天室傳送。');
}
let opening=false;
async function open(watermarked=false,researchCanvas=null){if(opening)return null;opening=true;const triggers=["marketSimpleAnalysisButton","marketSimpleAnalysisWatermarkButton"].map(id=>root.document.getElementById(id)).filter(Boolean);triggers.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');});
 try{
  const snapshot=current(),date=snapshot.analysis.date;
  status('正在產生大盤圖片…');
  if(root.document.fonts?.ready)await root.document.fonts.ready;
  if(current().analysis.date!==date)throw Error('大盤資料已更新，請重新產生圖片。');
  const result=researchCanvas||page(snapshot,{watermarked}),blob=await new Promise(resolve=>result.toBlob(resolve,'image/png'));
  if(!blob?.size)throw Error('PNG產生失敗，請重新產生。');if(current().analysis!==snapshot.analysis)throw Error('大盤資料已更新，請重新產生圖片。');
  cleanup();imageBlob=blob;
  const wavePicture=!!researchCanvas?.dataset?.waveReportAudit;const filename=VERSION+(wavePicture?'_大盤波浪分析_':researchCanvas?'_吞沒箱體研究_':'_大盤精簡分析_')+(watermarked?'浮水印版':'無浮水印')+'_TAIEX_'+date+'.png';
  imageFile=typeof root.File==='function'?new root.File([blob],filename,{type:'image/png',lastModified:Date.now()}):null;
  activeUrl=URL.createObjectURL(blob);
  let dialog=root.document.getElementById('simpleMarketReportDialog');
  if(!dialog){dialog=root.document.createElement('dialog');dialog.id='simpleMarketReportDialog';dialog.setAttribute('aria-label','大盤精簡分析圖片預覽');dialog.addEventListener('close',cleanup);root.document.body.append(dialog);}
  dialog.dataset.reportFullBleed=result.dataset?.fullBleed==='true'?'true':'false';
  dialog.replaceChildren();
  const title=root.document.createElement('h2');title.textContent=(wavePicture?'大盤波浪分析':researchCanvas?'吞沒與箱體研究':'大盤精簡分析')+'｜TAIEX｜'+VERSION+'｜'+(watermarked?'浮水印版':'無浮水印版');
  const controls=root.document.createElement('div');controls.className='simple-market-report-controls';
  const download=root.document.createElement('a');download.href=activeUrl;download.download=filename;download.className='market-report-btn';download.textContent='下載 PNG';
  const share=root.document.createElement('button');share.type='button';share.id='simpleMarketLineShareButton';share.className='market-report-btn';share.textContent='📤 分享圖片到 LINE';share.addEventListener('click',shareCurrentImage);
  const dismiss=root.document.createElement('button');dismiss.type='button';dismiss.className='market-report-btn';dismiss.textContent='關閉';dismiss.addEventListener('click',close);
  controls.append(download,share,dismiss);
  const note=root.document.createElement('p');note.id='simpleMarketShareStatus';note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.textContent='手機可從分享面板選LINE，電腦可複製圖片貼到LINE聊天室。';
  const img=root.document.createElement('img');img.src=activeUrl;img.alt='大盤精簡分析完整圖片';img.width=result.width;img.height=result.height;
  dialog.append(title,controls,note,img);dialog.dataset.reportAudit=result.dataset.waveReportAudit||result.dataset.researchAudit||result.dataset.engulfRangeAudit;
  if(!dialog.open)dialog.showModal();
  status('已產生大盤'+(watermarked?'浮水印版':'無浮水印版')+'精簡分析圖片，請預覽、下載或分享。');
  return result;
 }catch(e){status(e?.message||'大盤報告產生失敗');return null;}finally{opening=false;triggers.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');});}
}
function init(){
 const binds=[['marketSimpleAnalysisButton',false],['marketSimpleAnalysisWatermarkButton',true]];
 for(const [id,watermarked] of binds){
  const button=root.document?.getElementById(id);
  if(button&&!button.dataset.marketSimpleBound){button.dataset.marketSimpleBound='true';button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>open(watermarked));}
 }
}
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
return {TITLE,VERSION,WATERMARK,validationText,titleFor,model,page,open,close,init,shareCurrentImage};
});


