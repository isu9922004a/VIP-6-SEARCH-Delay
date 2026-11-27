/* V9.6: isolated index-report entry. No scanner, stock analysis or prediction inputs. */
(function(root){'use strict';
const doc=root.document;if(!doc)return;
const by=id=>doc.getElementById(id);
function standalonePreview(){
 if(typeof root.showInfographicPreviewV3328==='function')return;
 root.ShitouImageShareV1.mount();
 root.showInfographicPreviewV3328=root.ShitouImageShareV1.show;
 root.closeInfographicPreviewV3328=root.ShitouImageShareV1.close;
}
async function loadMarketVisual(doc){
 const dependencies=[
  ['ShitouLifeVisual972','life-line-visual-v972.js'],
  ['ShitouLifeVisual98','life-line-visual-v98.js'],
  ['ShitouLifeIntelligence913','life-line-intelligence-v913.js'],
  ['ShitouMarketLifeRisk910','market-life-risk-v910.js'],
  ['ShitouMarketLifeRisk913','market-life-risk-v913.js'],
  ['ShitouTransparency916','life-risk-transparency-v916.js'],
   ['ShitouHeikinAshi920','heikin-ashi-life-v920.js'],
   ['ShitouMarketLifeVisual913','market-life-visual-v913.js']
 ];
 for(const [key,file] of dependencies){
  if(root[key])continue;
  await new Promise((resolve,reject)=>{
   const script=doc.createElement('script');
   script.src=new URL('./'+file+'?v='+(root.ShitouReleaseV50?.cacheVersion||'V9.22-HIGH-VOLATILITY-1'),doc.baseURI).href;
   script.async=false;
   script.onload=()=>root[key]?resolve():reject(Error(file+' 載入後未提供繪圖模組'));
   script.onerror=()=>reject(Error(file+' 載入失敗'));
   doc.head.append(script);
  });
 }
 return root.ShitouMarketLifeVisual913.ready(doc);
}
function install(){
 if(by('marketLifeReportButton'))return;
 const host=by('marketAnalyzeButton')?.parentElement||doc.querySelector('.controls');if(!host)return;
 const button=doc.createElement('button');button.id='marketLifeReportButton';button.type='button';button.className='btn market-btn market-life-button';button.textContent='大盤生命線研究報告';
 const note=doc.createElement('p');note.id='marketLifeReportStatus';note.className='market-life-status';note.setAttribute('role','status');note.setAttribute('aria-live','polite');host.append(button);host.after(note);
 let revision=0,pending=false,controller=null,history=null;
 // Match the report renderer's *actual* version, not the site release label.
 // The V9.12 website may embed a V9.10 historical poster; never let its
 // verified source-expiry/export guard be skipped by that filename difference.
 const ownPreview=()=>{
  const versions=[root.ShitouReleaseV50?.displayCode,root.ShitouMarketLifeVisual913?.RELEASE].filter(Boolean);
  const filename=by('imageDownloadLink')?.download||'';
  return by('imagePreviewModal')?.classList.contains('show')&&
   (versions.some(version=>filename.startsWith('石頭少爺_'+version+'_TAIEX_')) ||
    /^石頭少爺_V9\.26_TAIEX_\d{8}_盤後趨勢研究\.png$/.test(filename));
 };
 function invalidate(message=''){revision++;controller?.abort();controller=null;pending=false;history=null;button.disabled=false;button.removeAttribute('aria-busy');button.textContent='大盤生命線研究報告';note.textContent=message;if(ownPreview())root.closeInfographicPreviewV3328();}
 button.addEventListener('click',async()=>{
  if(pending)return;invalidate();const token=revision;pending=true;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='正在建立大盤報告…';note.textContent='正在核對加權指數完成日 K 與資料來源…';controller=new AbortController();
  try{
   if(by('market-type')&&by('market-type').value!=='TAIEX')throw Error('目前僅支援台灣加權指數。');
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),response=await fetch(new URL('./data/index/TAIEX.json',doc.baseURI),{cache:'no-store',signal});if(!response.ok)throw Error('行情讀取失敗（HTTP '+response.status+'）');const source=await response.json();if(token!==revision)return;
   const study=root.ShitouMarketLife96.evaluate(source);if(!study.sourceVerified)throw Error(study.reason||'大盤資料尚未核對');if(!study.validatedBars?.length)throw Error(study.reason||'完成日 K 不足，暫無法建立報告');
   await doc.fonts.ready;if(token!==revision)return;await loadMarketVisual(doc);if(token!==revision)return;const pages=root.ShitouMarketLifeVisual913.build(study,{document:doc,v916:true});
   if(new URLSearchParams(root.location.search).get('postmarket-study')==='1'){
    try{
     const {makeStudyPage}=await import('./postmarket-preview-v926.js?v=V9.26-RESEARCH-2');
     const research=await makeStudyPage({source,study,marketRisk:root.ShitouMarketLifeRisk913.evaluate(study),index:true});
     if(research)pages.push(research);
    }catch(error){console.warn('盤後趨勢研究頁暫不可用',error.message);}
   }
   if(token!==revision)return;
   if(!pages.length)throw Error('圖片畫布無法使用');history=source;
   standalonePreview();const shown=await root.ShitouLifeViewer94.show(pages);if(token!==revision)return;if(!shown)throw Error('圖片預覽未完成，請重試');root.ShitouHeikinAshi920?.installJump(doc,pages);note.textContent='加權指數｜'+study.dataAsOf+'｜'+pages.length+' 頁；'+(study.sourceVolumeAudit?.uncertain?'成交股數待核對，暫不作量能確認。':'量能為集中市場成交股數。');
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
