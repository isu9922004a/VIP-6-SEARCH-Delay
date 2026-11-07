/* Independent phone-sized wave PNGs. Reuses the verified wave result; no new analysis/API. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(root,node?require('./elliott-wave-visual-v1'):root.ShitouElliottVisual);if(node)module.exports=api;else root.ShitouWaveReport=api;})(globalThis,function(root,V){
'use strict';
const W=1284,H=2778,VERSION='WAVE_REPORT_PLAIN_2',fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}):'待確認';let opening=false,active=null,revision=0;
function baseModel(raw,{kind='stock',name,code,date,close,levels=[]}={}){
 const a=V.result(raw),market=kind==='market';code=String(code||raw.code||raw.stock||raw.instrumentType||raw.index||'');date=date||raw.closeDate||raw.date;close=close??raw.close??a.bars?.at(-1)?.close;
 if(!code||!date||a.code!==code||a.date!==date||market&&code!=='TAIEX')throw Error('波浪圖片的股票代號或行情日期不一致，請重新查詢。');
 if(a.bars?.length&&(a.bars.at(-1).date!==date||a.bars.at(-1).close!==close))throw Error('波浪圖與收盤行情尚未對齊，請重新查詢。');
 const title=market?'大盤波浪分析':'個股波浪分析',p=a.primary,h=a.historicalCounts?.[0];let explanation;
 if(p)explanation=p.plain;
 else if(h)explanation='灰藍色1～5是過去已符合規則的五段，只供回顧；目前仍不能指定第幾浪。';
 else explanation=a.reason||'已確認的高低點還不足，先等新的完成日K。';
 const scales=a.scaleComparisons?.length?a.scaleComparisons.map(s=>s.scale.label+'：'+(s.hasCandidate?'有觀察走法':'先等確認')).join('／'):'資料尚未核對，不猜測波浪位置。';
 const next=p?.reference?`${p.reference.label} ${fmt(p.reference.price)}：${p.reference.meaning}`:'先看原報告的支撐與壓力，等新的完成日K確認後再數浪；不只因一根上漲就進場。';
 const identity=JSON.stringify([kind,code,date,close,a.inputFingerprint||[a.state,a.reason],levels]);
 return {version:VERSION,release:root.ShitouReleaseV50?.displayCode||'V8.7.1',title,kind,code,date,close,name:name||raw.name||(market?'臺灣加權指數':'個股'),wave:a,explanation,scales,next,levels:levels.slice(0,3),identity};
}
function buildModel(raw,options={}){
 const m=baseModel(raw,options),a=m.wave,t=a.trend,p=a.primary,last=p?.points?.at(-1),history=a.historicalCounts?.[0],ready=a.state!=='DATA_INSUFFICIENT'&&Number.isFinite(t?.ma20)&&Number.isFinite(t?.slope);let trendTitle,trendReason,color='#24435e';
 if(!ready){trendTitle='資料還沒核對好，先不判斷';trendReason='先等完整行情，不使用缺少證據的走勢判斷。';}
 else if(t.direction==='RANGE'){trendTitle='上下震盪，先等方向更清楚';trendReason=(m.close<t.ma20?'價格低於':m.close>t.ma20?'價格高於':'價格接近')+'最近20天的平均價，平均價大致走平。';}
 else if(t.direction==='DOWN'&&m.close<t.ma20){trendTitle='走勢偏弱，先觀察能否止跌';trendReason='價格低於最近20天的平均價，平均價也往下。';color='#176d68';}
 else if(t.direction==='UP'&&m.close>t.ma20){trendTitle='走勢偏強，仍要看能否守穩';trendReason='價格高於最近20天的平均價，平均價也往上。';color='#b2464e';}
 else{trendTitle='漲跌線索還不一致，先觀察';trendReason='價格與最近20天平均走勢不同步，仍要等確認。';}
 let wavePosition='波浪位置：目前看不清楚，先不標數字',waveReason;
 if(p&&last){const up=p.direction==='UP',label=last.label;const words=up?{'2':'可能在第2浪回檔，仍待確認','3':'可能在第3浪上漲，仍待確認','4':'可能在第4浪整理，仍待確認','5':'可能在第5浪後段，留意追高風險'}:{'2':'下跌後暫時反彈，仍待確認','3':'可能在第3段下跌，先看能否止跌','4':'下跌後的反彈整理，仍待確認','5':'可能在下跌後段，反彈仍要確認'};wavePosition='波浪位置：'+(words[label]||(up?'上漲後修正，可能在':'下跌後反彈，可能在')+label+'段');
  waveReason=a.scaleDisagreement?'大小波段看法不同，這種分段仍需確認。':!p.evidence?.volumeIncreased||!p.evidence?.macdGrowing?'成交量或漲跌力道還沒一起支持，仍要等價格確認。':'已有分段線索，但後續價格仍可能讓數浪改變。';
 }else if(!ready)waveReason='行情還沒核對完整，不畫假K線，也不猜第幾浪。';
 else if(history)waveReason='灰藍數字是過去已形成的走法，不能當作目前位置。';
 else if(a.state==='RULE_VIOLATION')waveReason='目前三種大小的波段都沒符合規則，先不猜第幾浪。';
 else waveReason='高低點還沒走出清楚的節奏，先等新的價格轉折。';
 const levels=m.levels.map(l=>({...l})),above=levels.filter(l=>Number.isFinite(l.price)&&l.price>m.close).sort((a,b)=>a.price-b.price)[0],below=levels.filter(l=>Number.isFinite(l.price)&&l.price<m.close).sort((a,b)=>b.price-a.price)[0],observations=[];
 if(above)observations.push(`上方先看 ${fmt(above.price)} 附近，漲回後還要看能否守住。`);
 if(below)observations.push(`回檔先看 ${fmt(below.price)} 附近；若失守，留意風險增加。`);
 if(!observations.length&&p?.reference)observations.push(p.reference.meaning.split('，')[0]+'時，要重新檢查這種分段。');
 if(!observations.length)observations.push('先看價格能否走出新的高點與低點，暫時不猜買價。');
 if(observations.length<2)observations.push('等新的完成日K出現後，再重新核對走勢與風險。');
 const risk=!ready?'行情還沒核對完整，先不用這張圖決定買賣。':m.kind==='market'?'大盤變強不代表每檔股票都能買，仍要看個股自己的條件。':t.direction==='DOWN'||t.direction==='RANGE'?'先等價格和轉折更清楚，別只因跌深就急著搶反彈。':'就算看起來偏強，也要先核對自己的進場理由與停損。';
 return {...m,explanation:'走勢：'+trendReason+' 波浪：'+waveReason,next:observations.join(' ')+' 不取代原本停損。',trendTitle,trendReason,color,wavePosition,waveReason,observations,risk,displayLevels:levels.map(l=>({...l,displayLabel:({'失守後需收復的關卡':'上方先看這裡','下方歷史觀察':'下方先看這裡','上方反壓':'再往上的壓力'})[l.label]||l.label}))};
}
function render(raw,options={}){
 const m=buildModel(raw,options),c=(options.document||root.document).createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),boxes=[],textBoxes=[];
 const font=(size,bold,color)=>{x.font=`${bold?750:500} ${size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;x.fillStyle=color;x.textAlign='left';x.textBaseline='top';};
 const text=(value,left,top,width,size=44,{bold=false,color='#24435e',bottom=H-24}={})=>{const rows=V.wrap(x,value,width,size),line=size*1.38,end=top+rows.length*line;if(end>bottom+.01)throw Error('波浪圖片文字超出手機版範圍：'+value);font(size,bold,color);rows.forEach((s,i)=>x.fillText(s,left,top+i*line));textBoxes.push({top,bottom:end,size,text:value});return end;};
 const card=(name,y,h,fill='#fff')=>{x.fillStyle=fill;x.strokeStyle='#d3e0ea';x.lineWidth=2;x.beginPath();x.roundRect(42,y,W-84,h,24);x.fill();x.stroke();boxes.push({name,top:y,bottom:y+h});};
 x.fillStyle='#eef3f8';x.fillRect(0,0,W,H);text('石頭少爺・'+m.title,48,32,880,38,{bold:true,color:'#147a76'});text(m.release,1015,36,230,31,{color:'#147a76'});
 text(m.name+'（'+m.code+'）',48,100,W-96,60,{bold:true,bottom:235});text(`${m.date} ${m.wave.state==='DATA_INSUFFICIENT'?'資料待核對':'盤後'}｜收盤 ${fmt(m.close)}${m.kind==='market'?' 點':' 元'}`,48,205,W-96,36);
 card('position',282,228);text('現在怎麼走？',78,298,W-156,34,{color:'#6b7e8e'});text(m.trendTitle,78,352,W-156,48,{bold:true,color:m.color,bottom:423});text(m.wavePosition,78,434,W-156,34,{bottom:504});
 const chart=V.chart(x,m.wave,{x:42,y:528,width:W-84,height:920,annotate:true});if(chart.chartReady)boxes.push({name:'chart',top:528,bottom:1448});else{card('chart',528,920,'#f5f8fb');text('行情尚未核對，暫不畫波浪。',92,910,W-184,48,{bold:true});}
 card('why',1466,380);text('為什麼先不急？',78,1484,W-156,46,{bold:true});let y=text('走勢：'+m.trendReason,78,1556,W-156,42,{bottom:1695});text('波浪：'+m.waveReason,78,y+16,W-156,42,{bottom:1828});
 card('observe',1864,350);text('接下來看什麼？',78,1882,W-156,46,{bold:true});y=text('1. '+m.observations[0],78,1952,W-156,42,{bottom:2075});text('2. '+m.observations[1],78,y+10,W-156,42,{bottom:2198});
 card('levels',2232,240);text(m.kind==='market'?'價格先看這三處':'原報告價位｜波浪不改買價或停損',78,2245,W-156,38,{bold:true});for(let i=0;i<3;i++){const l=m.displayLevels[i]||{label:'參考價位',price:null};text(l.displayLabel||l.label,78,2300+i*51,630,35,{bottom:2460});text(fmt(l.price),755,2298+i*51,425,42,{bold:true,bottom:2460});}
 card('risk',2490,180,'#e4edf5');text('新手提醒',78,2505,W-156,35,{bold:true});text(m.risk,78,2560,W-156,34,{bottom:2660});
 text(options.sourceNote||'第幾浪仍是研究判讀，不保證未來走法；原買賣與停損計畫照舊。',48,2692,W-96,28,{bottom:2740});text(`${m.release}｜行情 ${m.date}｜單張手機白話版`,48,2742,W-96,24,{bottom:2776});
 if(options.watermarked){const watermark=root.ShitouReportWatermark||(typeof require==='function'?require('./report-watermark-v84.js'):null);if(!watermark)throw Error('浮水印模組尚未載入');watermark.apply(c,m.kind);}
 const audit={version:VERSION,release:m.release,reportType:'ELLIOTT_WAVE_STANDALONE',kind:m.kind,code:m.code,name:m.name,date:m.date,close:m.close,width:W,height:H,headline:m.wave.headline,trendTitle:m.trendTitle,trendReason:m.trendReason,wavePosition:m.wavePosition,waveReason:m.waveReason,state:m.wave.state,explanation:m.explanation,scales:m.scales,next:m.next,observations:m.observations,originalLevels:m.levels,waveReference:m.wave.primary?.reference||null,chart,watermarked:!!options.watermarked,boxes,textBoxes,noClipping:true,noOverlap:boxes.every((b,i)=>!i||b.top>=boxes[i-1].bottom),identity:m.identity};
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
