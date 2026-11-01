/* Standalone market PNG: uses only the validated independent TAIEX page snapshot. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ShitouMarketSimpleReport=api;
})(globalThis,function(root){
'use strict';
const TITLE='大盤精簡分析',VERSION='V8.3.1',WATERMARK='石頭少爺台股分析'+VERSION+'版',W=1284,H=2778;
const titleFor=watermarked=>TITLE+(watermarked?WATERMARK:'');
const colors={background:'#071f32',card:'#10344f',border:'#28627d',text:'#f0f6fb',muted:'#b8d9e9',yellow:'#f7cf70',aqua:'#79e4d1',red:'#ff9a91'};
const num=v=>Number.isFinite(v)?Number(v).toFixed(2):'待核對';
function model(snapshot,{watermarked=false}={}){
 const a=snapshot&&snapshot.analysis,src=snapshot&&snapshot.source,f=snapshot&&snapshot.forecast;
 if(!a||a.state!=='AVAILABLE'||!a.input?.bars?.length||!src?.name||!src?.source||a.illustration){
  throw Error('請先取得已核驗的台股大盤完成日K，再產生圖片；示意資料不可當成正式行情。');
 }
 if(a.instrumentType!=='TAIEX'||a.date!==a.input.asOf||a.input.bars.at(-1)?.date!==a.date||!Number.isFinite(a.close)){
  throw Error('大盤資料代號、日期或收盤點位不一致，請重新載入。');
 }
 const forecastValid=f?.state==='MODEL_SAMPLE'&&f?.modelRun===true&&Array.isArray(f.dates)&&f.dates[0]>a.date&&Number.isFinite(f.bullish)&&Number.isFinite(f.bearish)&&Number.isFinite(f.flat)&&f.provenance?.kind==='KRONOS_INFERENCE';
 const fresh=forecastValid?f:null;
 const slope=a.slope20>0?'上揚':a.slope20<0?'下彎':'走平';
 const above=a.close>=a.ma20;
 const recovered=a.close>=a.support;
 const cleared=a.close>a.resistance;
 const positions='MA5 '+num(a.ma5)+'、MA20 '+num(a.ma20)+'、MA60 '+num(a.ma60)+' 點；20日均線'+slope+'。';
 const trendLine='目前大盤'+a.trend+'；收盤 '+num(a.close)+' 點，'+(above?'在20日均線上方。':'仍在20日均線下方。')+(recovered?'':'前20日低點已跌破，先看能否收回。');
 const sampled=fresh?'Kronos已實跑：'+fresh.label+'；偏多 '+(fresh.bullish*100).toFixed(1)+'%、偏空 '+(fresh.bearish*100).toFixed(1)+'%、持平 '+(fresh.flat*100).toFixed(1)+'%（'+fresh.sampleCount+'條模型取樣）。':'模型結果未通過當期核驗：僅呈現歷史技術劇本，沒有可用的多空取樣比例。';
 const modelCaveat=fresh?'模型取樣比例不是隔日漲跌的實際機率或勝率；推演交易日 '+fresh.dates[0]+'。':'模型缺漏或逾期時不補造預測結果，也不把技術趨勢當成已確定的明日方向。';
 const recoverLevel=a.close<a.ma20?a.ma20:a.resistance;
 const buyLine=!recovered?'目前已跌破前20日低點，先等收回關卡，不宜急著進場。':!above?'目前仍在20日均線下方，先觀察是否站回並守穩，不追價。':cleared?'即使已越過前20日高點，仍須確認收盤站穩與風險條件，不因碰到價位就追價。':'目前尚未突破前20日高點，先等帶量突破並收盤確認。';
 const resistanceLabel=cleared?'已越過的前20日高點（觀察能否續守）':'前20日高點（上方候選壓力）';
 const supportLabel=recovered?'前20日低點（下方候選支撐）':'前20日低點（已跌破，觀察能否收回）';
 const bars=a.input.bars,last=bars.at(-1),prev=bars.at(-2);
 let volumeText='量能比較：資料不足，不以成交量作為買進依據。';
 if(Number.isFinite(last?.volume)&&last.volume>0&&Number.isFinite(prev?.volume)&&prev.volume>0){
  const diff=(last.volume/prev.volume-1)*100;
  volumeText='最近一個交易日市場成交量較前日'+(diff>=0?'增加 ':'減少 ')+Math.abs(diff).toFixed(1)+'%；量能變化必須搭配價格及收盤確認。';
 }
 const blocks=[
  {kind:'heading',text:'① 下一交易日可能怎麼走？'},
  {kind:'body',text:trendLine},
  {kind:'highlight',tone:fresh?(fresh.direction==='BEAR'?'red':fresh.direction==='BULL'?'aqua':'yellow'):'yellow',text:sampled},
  {kind:'notice',tone:'yellow',text:modelCaveat},
  {kind:'heading',text:'② 明天可以直接進場嗎？'},
  {kind:'highlight',tone:above&&recovered?'aqua':'yellow',text:buyLine},
  {kind:'body',text:'關鍵位只是觀察條件，不能把「碰到點位」直接當成買進訊號；收盤確認與量價風險仍須檢查。'},
  {kind:'heading',text:'③ 明天要注意哪三個點位？'},
  {kind:'highlight',tone:'aqua',text:'● '+num(a.ma20)+' 點｜20日均線：觀察趨勢是否站回或守穩（不是保證買點）。'},
  {kind:'highlight',tone:'yellow',text:'● '+num(a.resistance)+' 點｜'+resistanceLabel+'。'},
  {kind:'highlight',tone:'red',text:'● '+num(a.support)+' 點｜'+supportLabel+'。'},
  {kind:'heading',text:'④ 為什麼目前不能太樂觀或悲觀？'},
  {kind:'body',text:positions},
  {kind:'body',text:volumeText},
  {kind:'notice',text:'支撐壓力取自最新日K以前的20根日K，不含當日；歷史價位不是保證能守住的價格。'},
  {kind:'heading',text:'⑤ 明天實際怎麼做？'},
  {kind:'body',text:'續強劇本：若越過 '+num(a.resistance)+' 點，且收盤守穩上方，再觀察是否延續；未確認前不視為突破成立。'},
  {kind:'body',text:'整理劇本：若大盤主要在 '+num(a.support)+'～'+num(a.resistance)+' 點間波動，按區間觀察，不預設方向。'},
  {kind:'body',text:'轉弱劇本：'+(recovered?'若跌破 ':'若仍無法收回 ')+num(a.support)+' 點，重新檢查下方結構與部位風險。'},
  {kind:'notice',text:'空手者：等條件成立再評估；已有持股者：依原持股風險與停損計畫，不用大盤點位直接替代個股停損。'},
  {kind:'heading',text:'📌 一句話總結'},
  {kind:'summary',tone:'aqua',text:'大盤目前'+a.trend+'，先看 '+num(recoverLevel)+' 點附近的改善條件，以及 '+num(a.support)+' 點的風險；未收盤確認前不追價。'},
  {kind:'footnote',text:'資料：'+src.source+'｜行情 '+a.date+'。盤後研究，非即時訊號；隔日跳空須重算風險，不保證走勢，不構成投資建議。'}
 ];
 return {title:titleFor(watermarked),watermarked:!!watermarked,name:'臺灣加權股價指數（TAIEX）',date:a.date,close:a.close,modelRun:!!fresh,source:src.source,forecastState:f?.state||'UNAVAILABLE',blocks,levels:{ma20:a.ma20,resistance:a.resistance,support:a.support},nextTradeDate:fresh?.dates?.[0]||null};
}
function wrap(ctx,text,maxWidth){
 const lines=[];for(const para of String(text).split('\n')){
  let line='';for(const char of Array.from(para)){
   if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char;}
   else line+=char;
  }lines.push(line||' ');
 }return lines;
}
function page(snapshot,{document:doc=root.document,watermarked=false}={}){
 const data=model(snapshot,{watermarked}),canvas=doc.createElement('canvas');
 canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('此瀏覽器無法建立PNG畫布。');
 const M=28,IN=34,maxWidth=W-2*M-2*IN,top=132,header=220,gap=14,bodyTop=top+header+gap,panelBottom=H-122;
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
 for(const s of [39,38,37,36,35,34,33,32,31,30,29]){
  const candidate=makeLayout(s);
  if(candidate.total<=panelBottom-bodyTop-36){layout=candidate;break;}
 }
 if(!layout)throw Error('大盤精簡分析內容超過1284×2778單張圖片安全範圍，未刪除或截斷資料。');
 const panel=(y,h)=>{ctx.fillStyle=colors.card;ctx.strokeStyle=colors.border;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(M,y,W-2*M,h,23);ctx.fill();ctx.stroke();};
 const draw=(lines,x,y,size,color,bold,lineH=size+12)=>{
  font(size,bold);ctx.fillStyle=color;for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*lineH);
 };
 ctx.fillStyle=colors.background;ctx.fillRect(0,0,W,H);
 panel(top,header);draw([data.title],M+IN,top+52,42,colors.muted,true);
 draw([VERSION+'｜'+(data.modelRun?'Kronos實跑':'盤後研究')],W-M-321,top+46,28,colors.yellow,true);
 draw([data.name],M+IN,top+125,62,colors.text,true);
 draw(['行情基準 '+data.date.replaceAll('-','/')+'｜收盤 '+num(data.close)+' 點'],M+IN,top+182,35,colors.muted);
 panel(bodyTop,panelBottom-bodyTop);draw(['明天可能怎麼走？該怎麼做？'],M+IN,bodyTop+52,43,colors.text,true);
 let y=bodyTop+78;
 const usedHeight=layout.blocks.reduce((sum,b)=>sum+b.height,0);const spare=Math.max(0,panelBottom-24-(bodyTop+78+usedHeight));const spread=Math.min(12,spare/Math.max(1,layout.blocks.length+1));
 for(const b of layout.blocks){
  draw(b.lines,M+IN,y+b.size,b.size,colors[b.tone]||(b.kind==='heading'?colors.muted:b.kind==='notice'?colors.yellow:b.kind==='footnote'?colors.muted:colors.text),b.bold,b.lineH);
  y+=b.height+spread;
 }
 if(y>panelBottom-22)throw Error('大盤報告內容超過畫布安全區，已停止輸出避免裁切。');
 draw([VERSION+'｜1/1'],W-M-205,H-77,29,colors.muted,true);
 const audit={title:data.title,watermarked:data.watermarked,version:VERSION,width:W,height:H,date:data.date,close:data.close,bodyFont:layout.size,bodyBottom:y,safeBottom:panelBottom-22,noClipping:true,modelRun:data.modelRun,forecastState:data.forecastState,source:data.source,levels:data.levels,completeNarrative:true,blockCount:data.blocks.length};
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
async function open(watermarked=false){
 try{
  const snapshot=current(),date=snapshot.analysis.date;
  status('正在產生大盤圖片…');
  if(root.document.fonts?.ready)await root.document.fonts.ready;
  if(current().analysis.date!==date)throw Error('大盤資料已更新，請重新產生圖片。');
  const result=page(snapshot,{watermarked}),blob=await new Promise(resolve=>result.toBlob(resolve,'image/png'));
  if(!blob?.size)throw Error('PNG產生失敗，請重新產生。');
  cleanup();imageBlob=blob;
  const filename=VERSION+'_大盤精簡分析_'+(watermarked?'浮水印版':'無浮水印')+'_TAIEX_'+date+'.png';
  imageFile=typeof root.File==='function'?new root.File([blob],filename,{type:'image/png',lastModified:Date.now()}):null;
  activeUrl=URL.createObjectURL(blob);
  let dialog=root.document.getElementById('simpleMarketReportDialog');
  if(!dialog){dialog=root.document.createElement('dialog');dialog.id='simpleMarketReportDialog';dialog.setAttribute('aria-label','大盤精簡分析圖片預覽');dialog.addEventListener('close',cleanup);root.document.body.append(dialog);}
  dialog.replaceChildren();
  const title=root.document.createElement('h2');title.textContent='大盤精簡分析｜TAIEX｜'+VERSION+'｜'+(watermarked?'浮水印版':'無浮水印版');
  const controls=root.document.createElement('div');controls.className='simple-market-report-controls';
  const download=root.document.createElement('a');download.href=activeUrl;download.download=filename;download.className='market-report-btn';download.textContent='下載 PNG';
  const share=root.document.createElement('button');share.type='button';share.id='simpleMarketLineShareButton';share.className='market-report-btn';share.textContent='📤 分享圖片到 LINE';share.addEventListener('click',shareCurrentImage);
  const dismiss=root.document.createElement('button');dismiss.type='button';dismiss.className='market-report-btn';dismiss.textContent='關閉';dismiss.addEventListener('click',close);
  controls.append(download,share,dismiss);
  const note=root.document.createElement('p');note.id='simpleMarketShareStatus';note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.textContent='手機可從分享面板選LINE，電腦可複製圖片貼到LINE聊天室。';
  const img=root.document.createElement('img');img.src=activeUrl;img.alt='1284×2778大盤精簡分析完整圖片';img.width=W;img.height=H;
  dialog.append(title,controls,note,img);dialog.dataset.reportAudit=result.dataset.researchAudit;
  if(!dialog.open)dialog.showModal();
  status('已產生大盤'+(watermarked?'浮水印版':'無浮水印版')+'精簡分析圖片，請預覽、下載或分享。');
  return result;
 }catch(e){status(e?.message||'大盤報告產生失敗');return null;}
}
function init(){
 const binds=[['marketSimpleAnalysisButton',false],['marketSimpleAnalysisWatermarkButton',true]];
 for(const [id,watermarked] of binds){
  const button=root.document?.getElementById(id);
  if(button&&!button.dataset.marketSimpleBound){button.dataset.marketSimpleBound='true';button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>open(watermarked));}
 }
}
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
return {TITLE,VERSION,WATERMARK,titleFor,model,page,open,close,init,shareCurrentImage};
});
