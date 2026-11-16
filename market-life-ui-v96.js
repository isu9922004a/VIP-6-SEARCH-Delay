/* V9.6: isolated index-report entry. No scanner, stock analysis or prediction inputs. */
(function(root){'use strict';
const doc=root.document;if(!doc)return;
const by=id=>doc.getElementById(id);
// Create the standalone shell only while this report is open; other reports keep their own DOM and APIs.
function standalonePreview(){
 if(typeof root.showInfographicPreviewV3328==='function')return;
 const modal=doc.createElement('div');modal.id='imagePreviewModal';modal.className='market-life-preview';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-hidden','true');modal.setAttribute('aria-labelledby','imagePreviewTitle');
 modal.innerHTML='<div class="image-modal-card"><div class="image-modal-head"><strong id="imagePreviewTitle"></strong><button type="button" id="marketLifeClose">關閉</button></div><div class="image-modal-actions"><a id="imageDownloadLink" download>下載目前頁 PNG</a><button type="button" id="imageShareButton" disabled>分享目前頁圖片</button></div><p id="imagePreviewNote" role="status"></p><img id="imagePreviewImg" alt="大盤生命線研究報告目前頁"></div>';
 doc.body.append(modal);let url=null,epoch=0,previousFocus=null;
 root.closeInfographicPreviewV3328=function close(){epoch++;root.ShitouImageShareV1?.clear();root.ShitouLifeViewer94?.reset();if(url)URL.revokeObjectURL(url);url=null;modal.classList.remove('show');modal.setAttribute('aria-hidden','true');doc.body.style.overflow='';doc.removeEventListener('keydown',keyboard);modal.remove();if(root.closeInfographicPreviewV3328===close){delete root.closeInfographicPreviewV3328;delete root.showInfographicPreviewV3328;}previousFocus?.focus();};
 root.showInfographicPreviewV3328=async function(page,filename,title){const token=++epoch,ready=root.ShitouImageShareV1.prepare(page,{filename}),blob=await new Promise((resolve,reject)=>page.toBlob(b=>b?resolve(b):reject(Error('PNG 編碼失敗'))));if(token!==epoch)return false;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);by('imagePreviewImg').src=url;by('imageDownloadLink').href=url;by('imageDownloadLink').download=filename;by('imagePreviewTitle').textContent=title;const opening=!modal.classList.contains('show');if(opening)previousFocus=doc.activeElement;modal.classList.add('show');modal.setAttribute('aria-hidden','false');doc.body.style.overflow='hidden';if(opening)by('marketLifeClose').focus();await ready;return token===epoch;};
 by('marketLifeClose').addEventListener('click',root.closeInfographicPreviewV3328);by('imageShareButton').addEventListener('click',()=>root.ShitouImageShareV1.shareCurrent());const keyboard=e=>{if(!modal.classList.contains('show'))return;if(e.key==='Escape')root.closeInfographicPreviewV3328();if(e.key==='Tab'){const focusable=[...modal.querySelectorAll('button:not(:disabled),a[href],summary')].filter(e=>e.getClientRects().length),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first?.focus();}}};doc.addEventListener('keydown',keyboard);
}
async function loadMarketVisual(doc){
 const dependencies=[
  ['ShitouLifeVisual972','life-line-visual-v972.js'],
  ['ShitouLifeVisual98','life-line-visual-v98.js'],
  ['ShitouMarketLifeRisk910','market-life-risk-v910.js'],
  ['ShitouMarketLifeVisual910','market-life-visual-v910.js']
 ];
 for(const [key,file] of dependencies){
  if(root[key])continue;
  await new Promise((resolve,reject)=>{
   const script=doc.createElement('script');
   script.src=new URL('./'+file+'?v=V9.11-MARKETLIFE1',doc.baseURI).href;
   script.async=false;
   script.onload=()=>root[key]?resolve():reject(Error(file+' 載入後未提供繪圖模組'));
   script.onerror=()=>reject(Error(file+' 載入失敗'));
   doc.head.append(script);
  });
 }
 return root.ShitouMarketLifeVisual910.ready(doc);
}
function install(){
 if(by('marketLifeReportButton'))return;
 const host=by('marketAnalyzeButton')?.parentElement||doc.querySelector('.controls');if(!host)return;
 const button=doc.createElement('button');button.id='marketLifeReportButton';button.type='button';button.className='btn market-btn market-life-button';button.textContent='大盤生命線研究報告';
 const note=doc.createElement('p');note.id='marketLifeReportStatus';note.className='market-life-status';note.setAttribute('role','status');note.setAttribute('aria-live','polite');host.append(button);host.after(note);
 let revision=0,pending=false,controller=null,history=null;
 const ownPreview=()=>by('imagePreviewModal')?.classList.contains('show')&&by('imageDownloadLink')?.download.startsWith('石頭少爺_V9.11_TAIEX_');
 function invalidate(message=''){revision++;controller?.abort();controller=null;pending=false;history=null;button.disabled=false;button.removeAttribute('aria-busy');button.textContent='大盤生命線研究報告';note.textContent=message;if(ownPreview())root.closeInfographicPreviewV3328();}
 button.addEventListener('click',async()=>{
  if(pending)return;invalidate();const token=revision;pending=true;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='正在建立大盤報告…';note.textContent='正在核對加權指數完成日 K 與資料來源…';controller=new AbortController();
  try{
   if(by('market-type')&&by('market-type').value!=='TAIEX')throw Error('目前僅支援台灣加權指數。');
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),response=await fetch(new URL('./data/index/TAIEX.json',doc.baseURI),{cache:'no-store',signal});if(!response.ok)throw Error('行情讀取失敗（HTTP '+response.status+'）');const source=await response.json();if(token!==revision)return;
   const study=root.ShitouMarketLife96.evaluate(source);if(!study.sourceVerified)throw Error(study.reason||'大盤資料尚未核對');if(!study.validatedBars?.length)throw Error(study.reason||'完成日 K 不足，暫無法建立報告');
   await doc.fonts.ready;if(token!==revision)return;await loadMarketVisual(doc);if(token!==revision)return;const pages=root.ShitouMarketLifeVisual910.build(study,{document:doc});if(!pages.length)throw Error('圖片畫布無法使用');history=source;
   standalonePreview();const shown=await root.ShitouLifeViewer94.show(pages);if(token!==revision)return;if(!shown)throw Error('圖片預覽未完成，請重試');note.textContent='加權指數｜'+study.dataAsOf+'｜'+pages.length+' 頁；'+(study.sourceVolumeAudit?.uncertain?'成交股數待核對，暫不作量能確認。':'量能為集中市場成交股數。');
  }catch(e){if(token!==revision)return;if(ownPreview())root.closeInfographicPreviewV3328();history=null;note.textContent='無法建立大盤生命線報告：'+(e.name==='TimeoutError'?'行情連線逾時，請重試。':e.message);}
  finally{if(token===revision){pending=false;controller=null;button.disabled=false;button.removeAttribute('aria-busy');button.textContent='大盤生命線研究報告';}}
 });
 for(const id of ['marketAnalyzeButton','market-refresh','market-type'])by(id)?.addEventListener(id==='market-type'?'change':'click',()=>invalidate('行情重新載入，請重新產生大盤生命線報告。'),true);
 new MutationObserver(()=>{if(doc.body.dataset.workspaceV831!=='market')invalidate();}).observe(doc.body,{attributes:true,attributeFilter:['data-workspace-v831']});
 if(by('imagePreviewModal'))new MutationObserver(()=>{if(pending&&by('imagePreviewModal')?.classList.contains('show')&&!ownPreview())invalidate('已切換其他報告；需要時請重新產生大盤生命線報告。');}).observe(by('imagePreviewModal'),{attributes:true,attributeFilter:['class']});
 // A report left open across the next official close must be regenerated before export.
 doc.addEventListener('click',e=>{if(!history||!ownPreview()||!e.target.closest('#imageDownloadLink,#imageShareButton,#lineShareSave,#life94Zip,#life94Prev,#life94Next'))return;const valid=root.ShitouMarketLife96.validate(history);if(!valid.ok){e.preventDefault();e.stopImmediatePropagation();invalidate(valid.reason+' 請重新產生報告。');}},true);
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(globalThis);
