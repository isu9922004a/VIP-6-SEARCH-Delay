/* Independent phone-sized wave PNGs. Reuses the verified wave result; no new analysis/API. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(root,node?require('./elliott-wave-visual-v1'):root.ShitouElliottVisual);if(node)module.exports=api;else root.ShitouWaveReport=api;})(globalThis,function(root,V){
'use strict';
const W=1284,H=2778,VERSION='WAVE_REPORT_1',fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}):'待確認';let opening=false,active=null,revision=0;
function buildModel(raw,{kind='stock',name,code,date,close,levels=[]}={}){
 const a=V.result(raw),market=kind==='market';code=String(code||raw.code||raw.stock||raw.instrumentType||raw.index||'');date=date||raw.closeDate||raw.date;close=close??raw.close??a.bars?.at(-1)?.close;
 if(!code||!date||a.code!==code||a.date!==date||market&&code!=='TAIEX')throw Error('波浪圖片的股票代號或行情日期不一致，請重新查詢。');
 if(a.bars?.length&&(a.bars.at(-1).date!==date||a.bars.at(-1).close!==close))throw Error('波浪圖與收盤行情尚未對齊，請重新查詢。');
 const title=market?'大盤波浪分析':'個股波浪分析',p=a.primary,h=a.historicalCounts?.[0];let explanation;
 if(p)explanation=p.plain;
 else if(h)explanation='灰藍色1～5是過去已符合規則的五段，只供回顧；目前仍不能指定第幾浪。';
 else if(a.diagnostics?.[0]?.observed){const d=a.diagnostics[0];explanation=`若從 ${d.origin} 開始看${d.direction==='UP'?'上漲':'下跌'}，${d.observed.date} 的${d.direction==='UP'?'低點':'高點'} ${fmt(d.observed.price)} 已碰回 ${fmt(d.boundary)}，這種分段先不採用。`;}
 else explanation=a.reason||'已確認的高低點還不足，先等新的完成日K。';
 const scales=a.scaleComparisons?.length?a.scaleComparisons.map(s=>s.scale.label+'：'+(s.hasCandidate?'有觀察走法':'先等確認')).join('／'):'資料尚未核對，不猜測波浪位置。';
 const next=p?.reference?`${p.reference.label} ${fmt(p.reference.price)}：${p.reference.meaning}`:'先看原報告的支撐與壓力，等新的完成日K確認後再數浪；不只因一根上漲就進場。';
 const identity=JSON.stringify([kind,code,date,close,a.inputFingerprint||[a.state,a.reason],levels]);
 return {version:VERSION,release:root.ShitouReleaseV50?.displayCode||'V8.7.1',title,kind,code,date,close,name:name||raw.name||(market?'臺灣加權指數':'個股'),wave:a,explanation,scales,next,levels:levels.slice(0,3),identity};
}
function render(raw,options={}){
 const m=buildModel(raw,options),doc=options.document||root.document,c=doc.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),boxes=[],textBoxes=[];
 const font=(size,bold=false,color='#24435e')=>{x.font=`${bold?750:500} ${size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;x.fillStyle=color;x.textAlign='left';x.textBaseline='top';};
 function card(name,y,h,fill='#fff'){x.fillStyle=fill;x.strokeStyle='#cfdeea';x.lineWidth=2;x.beginPath();x.roundRect(42,y,W-84,h,24);x.fill();x.stroke();boxes.push({name,top:y,bottom:y+h});}
 function text(value,left,top,width,size=44,{bold=false,color='#24435e',bottom=H-34}={}){const rows=V.wrap(x,value,width,size),line=size*1.38;const end=top+rows.length*line;if(end>bottom+.01)throw Error('波浪圖片文字超出手機版範圍，已停止輸出避免裁切。');font(size,bold,color);rows.forEach((s,i)=>x.fillText(s,left,top+i*line));textBoxes.push({top,bottom:end,size});return end;}
 x.fillStyle='#eef3f8';x.fillRect(0,0,W,H);text('石頭少爺・'+m.title,48,32,850,38,{bold:true,color:'#147a76'});text(m.release,1015,36,230,31,{color:'#147a76'});
 text(m.name+'（'+m.code+'）',48,100,W-96,60,{bold:true,bottom:235});text(`${m.date} ${m.wave.state==='DATA_INSUFFICIENT'?'資料待核對':'盤後'}｜收盤 ${fmt(m.close)}${m.kind==='market'?' 點':' 元'}`,48,205,W-96,36);
 card('position',282,190);text(m.wave.headline||'目前無法確認波浪位置',78,302,W-156,44,{bold:true,bottom:428});text('輔助觀察；原本的進場條件與停損照舊。',78,420,W-156,32,{bottom:466});
 const chart=V.chart(x,m.wave,{x:42,y:490,width:W-84,height:850,annotate:true});if(!chart.chartReady){card('chart',490,850,'#f4f7fa');text('完成日K尚未核對，暫不畫波浪圖。',92,765,W-184,48,{bold:true});text('不補畫示意K線，也不猜測1～5。',92,850,W-184,40);}
 else boxes.push({name:'chart',top:490,bottom:1340});
 card('explanation',1358,600);text('這張圖怎麼看？',78,1380,W-156,46,{bold:true});let y=text(m.explanation,78,1450,W-156,44,{bottom:1805});
 if(m.wave.scaleDisagreement)y=text('大小波段有不同解讀，先觀察。',78,y+16,W-156,40,{color:'#a26221',bottom:1840});text(m.scales,78,1843,W-156,36,{bottom:1950});
 card('original-levels',1976,250);text(m.kind==='market'?'原報告的三條觀察線':'原報告價位｜不由波浪改寫',78,1990,W-156,40,{bold:true});for(let i=0;i<3;i++){const l=m.levels[i]||{label:'參考價位',price:null};text(l.label,78,2050+i*53,610,36,{bottom:2220});text(fmt(l.price),740,2048+i*53,450,42,{bold:true,bottom:2220});}
 card('next',2244,350);text('下一步先看什麼？',78,2265,W-156,46,{bold:true});text(m.next,78,2337,W-156,42,{bottom:2520});text('只作觀察，不取代原本的買賣與風險計畫。',78,2530,W-156,32,{bottom:2585});
 text('歷史數浪不保證未來走法；有問號或虛線，就代表還沒確認。',48,2630,W-96,32,{bottom:2730});text(`${m.release}｜行情 ${m.date}｜單張手機版`,48,2732,W-96,28,{bottom:2774});
 if(options.watermarked){const watermark=root.ShitouReportWatermark||(typeof require==='function'?require('./report-watermark-v84.js'):null);if(!watermark)throw Error('浮水印模組尚未載入');watermark.apply(c,m.kind);}
 const audit={version:VERSION,release:m.release,reportType:'ELLIOTT_WAVE_STANDALONE',kind:m.kind,code:m.code,date:m.date,close:m.close,width:W,height:H,headline:m.wave.headline,state:m.wave.state,explanation:m.explanation,scales:m.scales,next:m.next,originalLevels:m.levels,waveReference:m.wave.primary?.reference||null,chart,watermarked:!!options.watermarked,boxes,textBoxes,noClipping:true,noOverlap:boxes.every((b,i)=>!i||b.top>=boxes[i-1].bottom),identity:m.identity};
 c.dataset.waveReportAudit=JSON.stringify(audit);c.dataset.researchAudit=JSON.stringify(audit);c.dataset.iphoneFullScreen='1284x2778';c.dataset.shareAsSingleImage='true';return c;
}
function stockPayload(){const raw=root.shitouGetLastReportV82?.();if(!raw)throw Error('請先完成個股查詢，再開啟波浪分析圖片。');if(root.ShitouSimpleStockReport?.matchesCurrentStockInput&&!root.ShitouSimpleStockReport.matchesCurrentStockInput(root.document.getElementById('stockInput')?.value,raw))throw Error('股票輸入已變更，請先完成新查詢。');const st=root.stockInfographicStateV3328(raw);return {raw,options:{kind:'stock',levels:[{label:'原突破觀察價',price:st.B},{label:'原回檔參考價',price:st.C},{label:'原結構失效價',price:st.A}]}};}
function marketPayload(){
 const independent=root.independentMarketReportSnapshot?.();if(independent){const a=independent.analysis,levels=a.regimeAnalysis?.levels||[],raw=a;return {raw,options:{kind:'market',name:independent.source.name,code:a.code,date:a.date,close:a.close,levels:levels.map(l=>({label:l.role,price:l.price}))},calendar:a.input};}
 const raw=typeof lastMarketReportData!=='undefined'?lastMarketReportData:null;if(!raw)throw Error('請先完成大盤分析，再開啟波浪圖片。');const m=root.ShitouMarketComfortReport.model(raw);return {raw,options:{kind:'market',levels:m.prices.map(l=>({label:l.label,price:l.value}))},calendar:raw};
}
function payload(kind){const p=kind==='market'?marketPayload():stockPayload();if(p.calendar&&root.ShitouMarketFreshness?.historyStatus(p.calendar).stale)throw Error('最新大盤行情尚未核對，請重新載入後再產生波浪圖片。');return p;}
function identity(p){return buildModel(p.raw,p.options).identity;}
function message(kind,value){const id=kind==='market'?'waveMarketStatus':'waveStockStatus',e=root.document?.getElementById(id);if(e)e.textContent=value;}
async function open(kind='stock',watermarked=false){if(opening)return null;opening=true;const token=++revision,buttons=[...root.document.querySelectorAll('[data-wave-export-button]')];buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');});try{
 message(kind,'正在產生單張手機版波浪圖片…');if(kind==='market'&&root.ShitouMarketReportRefresh){const fresh=await root.ShitouMarketReportRefresh.refresh();if(!fresh.ready)throw Error('最新大盤行情尚未核對，請重新載入。');}
 const p=payload(kind),key=identity(p);if(root.document.fonts?.ready)await root.document.fonts.ready;if(token!==revision||identity(payload(kind))!==key)throw Error('行情或查詢已更新，請重新產生波浪圖片。');
 const canvas=render(p.raw,{...p.options,watermarked});if(root.strongStockShowPagesV47){await root.strongStockShowPagesV47([canvas],{title:(kind==='market'?'大盤':'個股')+'波浪分析圖片',prefix:'石頭少爺_'+(kind==='market'?'TAIEX':p.raw.code||p.raw.stock)+'_波浪分析'+(watermarked?'_浮水印版':'_無浮水印'),date:buildModel(p.raw,p.options).date.replaceAll('-',''),kind:'wave-'+kind,note:'波浪專用單張手機版；1284×2778 PNG，原本專業報告不加長。'});}else if(kind==='market'&&root.ShitouMarketSimpleReport){const shown=await root.ShitouMarketSimpleReport.open(watermarked,canvas);if(!shown)throw Error('波浪圖片預覽未完成，請重新產生。');}else throw Error('圖片預覽模組尚未載入');
 if(identity(payload(kind))!==key){root.closeInfographicPreviewV3328?.();root.ShitouMarketSimpleReport?.close?.();root.ShitouImageShareV1?.clear?.();throw Error('行情已更新，請重新產生波浪圖片。');}
 const image=root.document.getElementById('imagePreviewImg')||root.document.querySelector('#simpleMarketReportDialog img');active={kind,key,url:image?.src,audit:JSON.parse(canvas.dataset.waveReportAudit)};message(kind,'已產生單張 1284×2778 波浪圖片，可下載或分享。');return canvas;
 }catch(e){message(kind,e.message||'波浪圖片產生失敗');return null;}finally{opening=false;buttons.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');});}}
function mount(){if(!root.document)return;const add=(host,kind)=>{if(!host||host.querySelector('[data-wave-export-kind="'+kind+'"]'))return;const group=root.document.createElement('section');group.dataset.waveExportKind=kind;group.style.cssText='display:grid;grid-template-columns:minmax(0,1fr);gap:10px;grid-column:1 / -1;padding:14px 0;min-width:0;max-width:100%';const title=root.document.createElement('strong');title.textContent=(kind==='market'?'大盤':'個股')+'波浪分析圖片｜獨立手機版';group.append(title);for(const marked of [false,true]){const b=root.document.createElement('button');b.type='button';b.id='wave'+(kind==='market'?'Market':'Stock')+(marked?'Marked':'Clean')+'Button';b.dataset.waveExportButton='true';b.className='copy-btn '+(marked?'watermark-image-btn':'image-btn');b.style.cssText='min-height:48px;font-size:16px;white-space:normal;max-width:100%';b.textContent=marked?'🛡️ 波浪分析圖片（浮水印版）':'📈 波浪分析圖片（無浮水印）';b.onclick=()=>open(kind,marked);group.append(b);}const status=root.document.createElement('p');status.id=kind==='market'?'waveMarketStatus':'waveStockStatus';status.setAttribute('role','status');status.style.cssText='font-size:15px;line-height:1.6;margin:0;overflow-wrap:anywhere';status.textContent='波浪圖片獨立產生；原本的報告不會加長。';group.append(status);host.append(group);};add(root.document.getElementById('stockReportActionsPanel'),'stock');add(root.document.querySelector('section.controls')||root.document.getElementById('generateMarketImageButton')?.parentElement,'market');}
function init(){mount();let queued=false;new root.MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;mount();});}}).observe(root.document.body,{childList:true,subtree:true});root.document.addEventListener('click',e=>{
 const control=e.target.closest?.('#imageDownloadLink,#imageShareButton,#lineShareSave,#r45PreviewZip,#simpleMarketReportDialog a[download],#simpleMarketLineShareButton');if(!control||!active)return;const img=root.document.getElementById('imagePreviewImg')||root.document.querySelector('#simpleMarketReportDialog img');if(img?.src!==active.url)return;try{if(identity(payload(active.kind))===active.key)return;}catch(_){}e.preventDefault();e.stopImmediatePropagation();message(active.kind,'行情或查詢已更新，請重新產生波浪圖片後再下載或分享。');
 },true);}
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
return Object.freeze({VERSION,W,H,buildModel,render,open,mount,getState:()=>active?{kind:active.kind,audit:JSON.parse(JSON.stringify(active.audit))}:null});
});
