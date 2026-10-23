/* MOBILE-LINE.1: prepare small, image-only files before the user's share tap. */
(function(root){'use strict';
const MAX_WIDTH=1284,MAX_HEIGHT=4096,MAX_BYTES=4*1024*1024;
let state=null,revision=0,sharing=false,previewUrl=null;
const by=id=>document.getElementById(id);
function note(text){const el=by('lineShareStatus');if(el)el.textContent=text;}
function controls(){
 if(by('lineSharePanel'))return;
 const host=by('imagePreviewNote');if(!host)return;
 const panel=document.createElement('div');panel.id='lineSharePanel';panel.className='image-preview-note';
 panel.innerHTML='<div id="lineShareStatus" role="status" aria-live="polite"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" id="lineSharePrev">上一段</button><button type="button" id="lineShareNext">下一段</button><a id="lineShareSave" download>儲存目前分享圖片 JPG</a></div><details><summary>預覽目前分享圖片／長按儲存</summary><img id="lineShareImg" alt="目前待分享的圖片段落" style="display:block;width:100%;height:auto"></details>';
 host.after(panel);by('lineSharePrev').onclick=()=>select((state?.index||0)-1);by('lineShareNext').onclick=()=>select((state?.index||0)+1);
}
function clear(){
 revision++;state=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;
 const button=by('imageShareButton');if(button){button.disabled=true;button.style.display='inline-flex';button.textContent='圖片分享準備中…';}
 if(by('lineSharePanel')){by('lineSharePanel').hidden=true;by('lineShareImg').removeAttribute('src');by('lineShareSave').removeAttribute('href');}
}
function supported(file){try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});}catch(_){return false;}}
function select(index){
 if(!state)return;state.index=Math.max(0,Math.min(index,state.files.length-1));
 const file=state.files[state.index],count=state.files.length;
 if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);
 by('lineShareImg').src=previewUrl;const save=by('lineShareSave');save.href=previewUrl;save.download=file.name;
 by('lineSharePrev').disabled=state.index===0||sharing;by('lineShareNext').disabled=state.index===count-1||sharing;
 const canShare=supported(file);
 const button=by('imageShareButton');button.disabled=sharing||!canShare;
 button.textContent=count>1?`📤 分享第 ${state.index+1}/${count} 段到 LINE`:'📤 分享目前圖片到 LINE';
 note(`${count>1?`完整長圖分成 ${count} 段，請逐段分享；目前 ${state.index+1}/${count}。`:'已備妥 JPG 分享圖片。'} ${file.size<1024*1024?Math.ceil(file.size/1024)+' KB':(file.size/1024/1024).toFixed(1)+' MB'}。${canShare?'請在系統分享選單選 LINE。':'此瀏覽器無法直接分享圖片，請用 Safari／Chrome 開啟，或儲存 JPG 後從 LINE 相簿傳送。'}`);
}
function toBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?.size?resolve(b):reject(Error('JPG轉換失敗')),'image/jpeg',quality));}
async function prepare(canvas,{filename='report.png'}={}){
 clear();controls();const token=revision;
 if(by('lineSharePanel'))by('lineSharePanel').hidden=false;
 note('正在準備手機分享圖片…');
 try{
  if(!(canvas.width>0&&canvas.height>0))throw Error('圖片尺寸無效');
  const scale=Math.min(1,MAX_WIDTH/canvas.width),span=Math.max(1,Math.floor(MAX_HEIGHT/scale)),files=[];
  const count=Math.ceil(canvas.height/span);
  const code=String(filename).match(/(?:^|_)([1-9]\d{3})(?:_|\D|$)/)?.[1]||'report';
  // Short ASCII names avoid oversized UTF-8 filenames in receiving apps.
  const stamp=Date.now().toString(36);
  for(let top=0;top<canvas.height;top+=span){
   if(token!==revision)return null;
   const height=Math.min(span,canvas.height-top);
   const tile=typeof canvas.renderExportRegion==='function'?canvas.renderExportRegion({top,height,scale}):document.createElement('canvas');
   if(typeof canvas.renderExportRegion!=='function'){
    tile.width=Math.max(1,Math.floor(canvas.width*scale));tile.height=Math.max(1,Math.floor(height*scale));const ctx=tile.getContext('2d');if(!ctx)throw Error('手機無法建立分享圖片');ctx.fillStyle='#fff';ctx.fillRect(0,0,tile.width,tile.height);ctx.drawImage(canvas,0,top,canvas.width,height,0,0,tile.width,tile.height);
   }
   let value;
   try{for(const quality of [.92,.82,.7]){value=await toBlob(tile,quality);if(value.size<=MAX_BYTES)break;}if(value.size>MAX_BYTES)throw Error('單段圖片仍過大，請儲存原圖後傳送');}
   finally{tile.width=tile.height=1;}
   files.push(new File([value],`shitou_${code}_${stamp}_${String(files.length+1).padStart(2,'0')}-${count}.jpg`,{type:'image/jpeg',lastModified:Date.now()}));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(token!==revision)return null;
  state={files,index:0};select(0);return state;
 }catch(error){if(token!==revision)return null;note(`分享圖片準備失敗：${error.message}。可儲存原始 PNG 後從 LINE 相簿傳送。`);const button=by('imageShareButton');if(button){button.disabled=true;button.textContent='分享圖片未備妥';}return null;}
}
async function shareCurrent(){
 if(sharing||!state)return;const file=state.files[state.index],selected=state;
 if(!supported(file)){note('此瀏覽器未確認支援圖片檔案分享，請儲存 JPG 再到 LINE 相簿傳送。');return;}
 sharing=true;by('imageShareButton').disabled=true;
 try{
  // No encoding, fetch, timers, or await before invoking the native share sheet.
  const result=navigator.share({files:[file]});await result;
  if(state===selected)note('已交給系統分享；請到 LINE 確認是否送出。'+(state.files.length>1?' 尚有其他段落時，請按下一段再分享。':''));
 }catch(error){if(state===selected)note(error?.name==='AbortError'?'分享已取消，或接收 App 未完成；可以重試，或儲存 JPG 後從 LINE 相簿傳送。':`分享未完成（${error?.name||'Error'}）：${error?.message||'接收 App 無法處理'}。請儲存目前 JPG 後從 LINE 相簿傳送；在 LINE 內開網頁時可改用 Safari／Chrome。`);}
 finally{sharing=false;if(state){by('imageShareButton').disabled=!supported(state.files[state.index]);by('lineSharePrev').disabled=state.index===0;by('lineShareNext').disabled=state.index===state.files.length-1;}}
}
root.ShitouImageShareV1=Object.freeze({prepare,clear,select,shareCurrent,getState:()=>state,limits:{width:MAX_WIDTH,height:MAX_HEIGHT,bytes:MAX_BYTES}});
})(globalThis);
