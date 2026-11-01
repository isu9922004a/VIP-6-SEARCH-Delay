/* Independent report: only the complete fifth-section narrative plus stock identity. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(root,node?require('../research-report-v1.js'):root.ShitouResearchReport);if(node)module.exports=api;else root.ShitouSimpleStockReport=api;})(globalThis,function(root,R){
'use strict';
const TITLE='個股精簡分析',VERSION='V8.4',WATERMARK='石頭少爺台股分析'+VERSION+'版',TOPIC='明天可能怎麼走？該怎麼做？',W=1284,H=2778;
const titleFor=()=>TITLE;
function model(a,{watermarked=false}={}){if(!a?.code||!a.date)throw Error('請先完成個股查詢，再產生精簡分析。');const section=R.view(a).actionGuide.sections.find(s=>s.number==='05'),narrative=section?.fullNarrative||section?.narrative;if(!narrative?.length)throw Error('完整個股分析模組尚未載入。');
 return {title:titleFor(watermarked),watermarked:!!watermarked,topic:TOPIC,name:a.name||a.code,code:String(a.code),date:a.date,close:a.sourceBars?.at(-1)?.close??a.quote?.close,version:VERSION,blocks:narrative.map(b=>({...b})),modelRun:section.forecast?.modelRun===true,sourceState:section.forecast?.state||'UNAVAILABLE'};
}
function page(a,{document:doc=root.document,watermarked=false}={}){const data=model(a,{watermarked}),canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d'),M=28,CW=W-2*M,padding=32,textW=CW-padding*2,colors={text:'#f0f6fb',muted:'#b8d9e9',yellow:'#f7cf70',aqua:'#79e4d1',red:'#ff9a91'};
 const font=(size,bold)=>{ctx.font=`${bold?750:600} ${size}px "Microsoft JhengHei","Segoe UI Emoji",sans-serif`;};
 const wrap=(text,size,bold=false)=>{font(size,bold);return R.wrap(ctx,text,textW);};
 let layout;for(const body of [38,37,36,35,34,33,32]){const blocks=data.blocks.map(b=>{const size=b.kind==='headline'?body+6:b.kind==='heading'?body+4:b.kind==='subheading'?body+1:b.kind==='notice'||b.kind==='footnote'?30:body,line=size+12,bold=['headline','heading','subheading','summary'].includes(b.kind),lines=wrap(b.text,size,bold),gap=b.kind==='heading'?18:b.kind==='subheading'?12:7;return {...b,size,line,bold,lines,height:lines.length*line+gap};}),top=140,header=218,gap=14,title=64,bottom=104,bodyHeight=title+blocks.reduce((n,b)=>n+b.height,0)+20,total=top+header+gap+bodyHeight+bottom+42;if(total<=H){layout={body,blocks,top,header,gap,title,bottom,bodyHeight,extra:H-total};break;}}
 if(!layout)throw Error('此個股完整內容超出單張安全範圍，未刪減或截斷報告。');
 const panel=(y,h)=>{ctx.fillStyle='#10344f';ctx.beginPath();ctx.roundRect(M,y,CW,h,24);ctx.fill();ctx.strokeStyle='#28627d';ctx.lineWidth=2;ctx.stroke();};
 const draw=(lines,x,y,size,color,bold=false,line=size+12)=>{font(size,bold);ctx.fillStyle=color;lines.forEach((t,i)=>ctx.fillText(t,x,y+i*line));};
 ctx.fillStyle='#071f32';ctx.fillRect(0,0,W,H);panel(layout.top,layout.header);draw([data.title],M+padding,layout.top+52,42,colors.muted,true);draw([data.version+'｜'+(data.modelRun?'Kronos實跑':'盤後研究')],W-M-284,layout.top+47,30,colors.yellow,true);draw([data.name+'（'+data.code+'）'],M+padding,layout.top+126,70,colors.text,true);const money=Number.isFinite(data.close)?String(+data.close.toFixed(2)):'待核對';draw(['行情基準 '+data.date.replaceAll('-','/')+'｜收盤 '+money+' 元'],M+padding,layout.top+181,36,colors.muted);
 const bodyTop=layout.top+layout.header+layout.gap;panel(bodyTop,layout.bodyHeight+layout.extra);draw([data.topic],M+padding,bodyTop+48,42,colors.text,true);let y=bodyTop+layout.title;const extraGap=layout.extra/layout.blocks.length;
 for(const b of layout.blocks){draw(b.lines,M+padding,y+b.size,b.size,colors[b.tone]||(b.kind==='heading'?colors.muted:b.kind==='warning'?colors.yellow:colors.text),b.bold,b.line);y+=b.height+extraGap;}
 draw([data.version+'｜1/1'],W-M-190,H-111,29,colors.muted,true);
 if(watermarked)(root.ShitouReportWatermark||(typeof require==='function'?require('../report-watermark-v84.js'):null)).apply(canvas,'stock');
 const audit={watermarkStyle:watermarked?'REFERENCE_DIAGONAL_V84':null,title:data.title,watermarked:data.watermarked,topic:TOPIC,width:W,height:H,code:data.code,date:data.date,version:data.version,bodyFont:layout.body,bodyBottom:y,onlyFifthSection:true,completeNarrative:true,sourceBlocks:data.blocks,modelRun:data.modelRun,sourceState:data.sourceState,noClipping:y<=H-104,topSafeArea:140,bottomSafeArea:104};
 if(!audit.noClipping)throw Error('獨立報告超出安全區，停止匯出。');canvas.dataset.researchAudit=JSON.stringify(audit);return {width:W,height:H,dataset:{researchAudit:JSON.stringify(audit)},renderExportRegion:()=>canvas,toBlob:(cb,type='image/png')=>canvas.toBlob(cb,type)};
}
let activeUrl=null,activeImageBlob=null,activeImageFile=null,sharePending=false;
// The stock picker displays "名稱 | 代號"; compare its two exact fields,
 // not the entire decorated input, while still rejecting a different stock.
function matchesCurrentStockInput(value,a){
 const entered=String(value??'').normalize('NFKC').trim();
 if(!entered)return true; // Preserve the existing empty-input behavior.
 const code=String(a?.code??'').normalize('NFKC').trim(),name=String(a?.name??'').normalize('NFKC').trim();
 if(entered===code||entered===name)return true;
 const fields=entered.split(/\s*[|｜／/、，,()（）]\s*/).map(s=>s.trim()).filter(Boolean);
 return fields.length===2&&((fields[0]===name&&fields[1]===code)||(fields[0]===code&&fields[1]===name));
}
function current(){const stock=root.ShitouResearchIntegration?.getCurrentStock?.();if(stock?.analysis){const value=root.document.getElementById('stockInput')?.value;if(!matchesCurrentStockInput(value,stock.analysis))throw Error('輸入已變更，請先完成這檔股票的查詢。');return stock.analysis;}const p=root.previewState?.();if(p?.analysis)return p.analysis;throw Error('請先完成個股查詢，再產生精簡分析圖片。');}
function status(text){let node=root.document.getElementById('simpleStockReportStatus');if(!node){node=root.document.createElement('p');node.id='simpleStockReportStatus';node.setAttribute('role','status');root.document.getElementById('stockSimpleAnalysisButton')?.parentElement.after(node);}node.textContent=text;}
function close(){
 root.document.getElementById('simpleStockReportDialog')?.close();
 if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=null;}
 activeImageBlob=null;activeImageFile=null;
}
function shareNotice(message){
 const node=root.document.getElementById('simpleStockShareStatus');
 if(node)node.textContent=message;
}
function shareCurrentImage(){
 const blob=activeImageBlob,file=activeImageFile,button=root.document.getElementById('simpleStockLineShareButton'),nav=root.navigator;
 if(sharePending)return;
 if(!blob?.size){shareNotice('圖片尚未備妥，請先重新產生報告。');return;}
 // All share/clipboard calls are started directly inside the click event.
 // Do not await image encoding or fetch before invoking native share.
 const mobile=/iPhone|iPad|iPod|Android/i.test(nav?.userAgent||'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1);
 const clipboardAvailable=typeof nav?.clipboard?.write==='function'&&typeof root.ClipboardItem==='function';
 const supportedFileShare=typeof nav?.share==='function'&&file&&
  (typeof nav.canShare!=='function'||(()=>{try{return nav.canShare({files:[file]});}catch(_){return false;}})());
 const applyPending=value=>{sharePending=value;if(button)button.disabled=value;};
 const finish=(request,success)=>{
  applyPending(true);
  Promise.resolve(request).then(()=>shareNotice(success)).catch(error=>{
   shareNotice(error?.name==='AbortError'?
    '已取消系統分享；圖片仍保留，可再次按分享。':
    '分享未完成：'+(error?.message||'裝置未支援')+'。可改用「下載 PNG」，從 LINE 聊天室傳送。');
  }).finally(()=>applyPending(false));
 };
 // On desktop prefer copying the PNG for direct paste into the LINE desktop app.
 if(supportedFileShare&&(mobile||!clipboardAvailable)){
  try{
   // Share the actual PNG file, not a webpage URL or a stock-report link.
   finish(nav.share({files:[file]}),'已交給系統分享流程；請在 LINE 聊天室確認是否送出。');
  }catch(error){shareNotice('開啟系統分享失敗：'+(error?.message||'請改用下載 PNG')+'。');}
  return;
 }
 if(clipboardAvailable){
  try{
   finish(nav.clipboard.write([new root.ClipboardItem({'image/png':blob})]),
    '✅ 已複製完整 PNG 圖片。請開啟 LINE 電腦版聊天室，按 Ctrl+V（Mac：⌘V）貼上後送出。');
  }catch(error){shareNotice('複製圖片失敗：'+(error?.message||'權限不足')+'。請先下載 PNG，再到 LINE 傳送。');}
  return;
 }
 shareNotice('此瀏覽器不支援直接分享或複製 PNG。請先按「下載 PNG」，再從 LINE 聊天室傳送。手機建議使用 Safari 或 Chrome 開啟。');
}
let opening=false;
async function open(watermarked=false){if(opening)return null;opening=true;const triggers=["stockSimpleAnalysisButton","stockSimpleAnalysisWatermarkButton"].map(id=>root.document.getElementById(id)).filter(Boolean);triggers.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');});try{const a=current();await root.ShitouKronosData?.ensure(a);if(current().code!==a.code||current().date!==a.date)throw Error('查詢已變更，請重新產生目前個股的報告。');if(root.document.fonts?.ready)await root.document.fonts.ready;const result=page(a,{watermarked}),blob=await new Promise(resolve=>result.toBlob(resolve));if(!blob?.size)throw Error('PNG產生失敗。');if(current().code!==a.code||current().date!==a.date||current().sourceSnapshotId!==a.sourceSnapshotId)throw Error('查詢已更新，請重新產生目前報告。');if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=URL.createObjectURL(blob);activeImageBlob=blob;let dialog=root.document.getElementById('simpleStockReportDialog');if(!dialog){dialog=root.document.createElement('dialog');dialog.id='simpleStockReportDialog';dialog.setAttribute('aria-label',TITLE+'圖片預覽');dialog.addEventListener('close',()=>{if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=null;activeImageBlob=null;activeImageFile=null;});root.document.body.append(dialog);}dialog.replaceChildren();const title=root.document.createElement('h2');title.textContent=TITLE+'｜'+a.name+'（'+a.code+'）｜'+VERSION+'｜'+(watermarked?'浮水印版':'無浮水印版');const image=root.document.createElement('img');image.src=activeUrl;image.alt=TITLE+'完整圖片';const controls=root.document.createElement('div');controls.className='simple-stock-report-controls';const download=root.document.createElement('a');download.href=activeUrl;download.download=VERSION+'_個股精簡分析_'+(watermarked?'浮水印版':'無浮水印')+'_'+a.name+'_'+a.code+'_'+a.date+'.png';download.textContent='下載 PNG';download.className='mini-btn';activeImageFile=typeof root.File==='function'?new root.File([blob],download.download,{type:'image/png',lastModified:Date.now()}):null;const share=root.document.createElement('button');share.type='button';share.id='simpleStockLineShareButton';share.className='mini-btn';share.textContent='📤 分享圖片到 LINE';share.addEventListener('click',shareCurrentImage);const dismiss=root.document.createElement('button');dismiss.type='button';dismiss.textContent='關閉';dismiss.className='mini-btn';dismiss.onclick=close;controls.append(download,share,dismiss);const shareStatus=root.document.createElement('p');shareStatus.id='simpleStockShareStatus';shareStatus.className='simple-stock-report-share-status';shareStatus.setAttribute('role','status');shareStatus.setAttribute('aria-live','polite');shareStatus.textContent='手機：點分享後選 LINE 聊天室；電腦：不支援直接分享時會複製圖片，貼到 LINE 電腦版即可。';dialog.append(title,controls,shareStatus,image);dialog.dataset.reportAudit=result.dataset.researchAudit;if(!dialog.open)dialog.showModal();status('已產生 '+a.name+'（'+a.code+'）個股'+(watermarked?'浮水印版':'無浮水印版')+'精簡分析圖片。');return result;
 }catch(e){status(e.message);return null;}finally{opening=false;triggers.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');});}}
function init(){
 const binds=[['stockSimpleAnalysisButton',false],['stockSimpleAnalysisWatermarkButton',true]];
 for(const [id,watermarked] of binds){const button=root.document?.getElementById(id);
  if(button&&!button.dataset.simpleBound){button.dataset.simpleBound='true';button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>open(watermarked));}
 }
}
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
return {TITLE,VERSION,WATERMARK,titleFor,TOPIC,model,page,open,close,init,matchesCurrentStockInput,shareCurrentImage};
});
