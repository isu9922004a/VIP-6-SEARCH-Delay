/* Native-size, measured market ABC report. Rendering only; original analysis helpers remain authoritative. */
(function(root){
'use strict';
const W=1284,M=32,G=24,PAD=30,INNER=W-M*2,MAX_H=8192,C={bg:'#eef3f8',card:'#ffffff',ink:'#24364b',muted:'#536578',line:'#d7e1eb',navy:'#183c56',teal:'#176f65',green:'#23724c',orange:'#a86421',red:'#b4484f',purple:'#775995'};
function render(data){
 const st=root.marketInfographicStateV3328(data),progress=root.marketInfographicProgressV3330(st),stage=root.marketStageDisplayAdapterV53245(data),rsi=root.marketRsiComfortDisplayV37723(data),map=root.buildMarketMapItemsV3328(data,st).slice(0,11),scenarios=root.marketScenarioTextsV3328(st),fmt=root.fmt;
 const sourceBefore=JSON.stringify(data),canvas=document.createElement('canvas');canvas.width=W;canvas.height=1;const ctx=canvas.getContext('2d'),jobs=[],sections=[],painted=[];let y=M;
 const font=(size,weight=500)=>{ctx.font=`${weight} ${size}px "Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;ctx.textBaseline='top';ctx.textAlign='left';};
 function wrap(value,width,size=38,weight=500){font(size,weight);const out=[];for(const para of String(value??'').split('\n')){let line='';for(const token of para.match(/[A-Za-z0-9][A-Za-z0-9.,/%_\-]*|./gu)||['']){if(ctx.measureText(token).width>width){for(const ch of [...token]){if(line&&ctx.measureText(line+ch).width>width){out.push(line);line=ch;}else line+=ch;}}else if(line&&ctx.measureText(line+token).width>width){out.push(line);line=token;}else line+=token;}out.push(line);}return out;}
 function prepare(text,width,size=38,weight=500,color=C.ink,gap=16){const lines=wrap(text,width,size,weight),lineHeight=Math.ceil(size*1.5);return {text:String(text),lines,size,weight,color,gap,lineHeight,height:lines.length*lineHeight};}
 function draw(block,x,top){font(block.size,block.weight);ctx.fillStyle=block.color;block.lines.forEach((line,i)=>ctx.fillText(line,x,top+i*block.lineHeight));painted.push({text:block.text,top,bottom:top+block.height,size:block.size,lineHeight:block.lineHeight,weight:block.weight});return top+block.height+block.gap;}
 function panel(x,top,w,h,fill=C.card){ctx.beginPath();ctx.roundRect(x,top,w,h,22);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=C.line;ctx.lineWidth=1.5;ctx.stroke();}
 function add(id,height,paint){const top=y;jobs.push(()=>paint(top));sections.push({id,top,bottom:top+height});y+=height+G;}
 function card(id,title,paragraphs,{fill=C.card}={}){const titleBlock=prepare(title,INNER-PAD*2,40,750,C.navy,22),blocks=paragraphs.map(p=>prepare(typeof p==='string'?p:p.text,INNER-PAD*2,p.size||38,p.weight||500,p.color||C.ink,p.gap??16)),height=PAD*2+titleBlock.height+titleBlock.gap+blocks.reduce((s,b)=>s+b.height+b.gap,0)-16;add(id,height,top=>{panel(M,top,INNER,height,fill);let cy=draw(titleBlock,M+PAD,top+PAD);for(const block of blocks)cy=draw(block,M+PAD,cy);});}
 const metadata=`行情基準 ${root.datefmt(data.closeDate)}　｜　資料來源：${data.source||'TWSE Official'}`,generated=typeof root.reportGeneratedAt==='function'?root.reportGeneratedAt():'',version=root.ShitouReleaseV50?.displayCode||'V8.6.4';
 card('header','大盤先懂 ABC｜現在市場走到哪一步？',[
  {text:'臺灣加權股價指數（TAIEX）',size:38,weight:700},
  {text:metadata,size:28,color:C.muted},
  {text:`報告製作 By.石頭少爺　｜　${version}　｜　${generated}`,size:26,color:C.muted}
 ]);
 card('stage','大盤行情階段',[{text:stage.shortLabel||stage.label,size:46,weight:700,color:C.navy},{text:stage.headline||stage.plainText,size:36}],{fill:'#f7f9fc'});
 const abcTitle=prepare('ABC 是這套分析的核心',INNER-PAD*2,40,750,C.navy,18),abcIntro=prepare('A 是起漲低點，B 是前一個高點，C 是回落後確認的低點。',INNER-PAD*2,34),abcWidth=(INNER-PAD*2-G*2)/3;
 const abc=[['A','起漲點',st.A,st.fib.ADate,C.green],['B','前波高點',st.B,st.fib.BDate,C.orange],['C','回檔低點',st.C,st.fib.CDate,C.teal]].map(([key,label,value,date,color])=>({key,label,value,date,color,blocks:[prepare(key+'　'+label,abcWidth-30,32,700,color,8),prepare(value===null?'尚未形成':fmt(value)+' 點',abcWidth-30,36,650,color,8),prepare(value!==null&&date?root.dateCompactV3328(date):'待確認',abcWidth-30,26,500,C.muted,0)]}));
 const abcRowH=Math.max(...abc.map(a=>a.blocks.reduce((n,b)=>n+b.height+b.gap,0)))+30,abcProgress=prepare('目前進度：'+progress.combined,INNER-PAD*2,34,600,C.navy),mnemonic=prepare('口訣：A起漲 → B前高 → 等有效C → 再突破B＝完整N字確認。',INNER-PAD*2,32,500,C.muted,0),abcH=PAD*2+abcTitle.height+abcTitle.gap+abcIntro.height+abcIntro.gap+abcRowH+20+abcProgress.height+abcProgress.gap+mnemonic.height;
 add('abc',abcH,top=>{panel(M,top,INNER,abcH);let cy=draw(abcTitle,M+PAD,top+PAD);cy=draw(abcIntro,M+PAD,cy);abc.forEach((a,i)=>{const x=M+PAD+i*(abcWidth+G);panel(x,cy,abcWidth,abcRowH,'#f8fbfd');let ay=cy+15;for(const b of a.blocks)ay=draw(b,x+15,ay);});cy+=abcRowH+20;cy=draw(abcProgress,M+PAD,cy);draw(mnemonic,M+PAD,cy);});
 const chartH=Math.round(INNER*520/1016);add('chart',chartH,top=>{const source=document.createElement('canvas');source.width=3200;source.height=1500;const sc=source.getContext('2d');sc.scale(2,2);root.applyMarketVisualQualityV37775?.(sc);root.drawMarketTopChartV365(sc,data,st);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,1120,348,2032,1040,M,top,INNER,chartH);});
 const metrics=[
  ['大盤環境',st.env.state,'市場風險：'+st.env.risk,C.green],
  ['20日均線',st.ma20===null?'資料不足':fmt(st.ma20)+' 點',`方向 ${st.slope===null?'待確認':`${st.slope>=0?'+':''}${fmt(st.slope)}%`}\n乖離 ${st.gap===null?'待確認':`${st.gap>=0?'+':''}${fmt(st.gap)}%`}`,C.teal],
  ['日 RSI 5T',rsi.value,[rsi.headline,rsi.line1,rsi.line2].filter(Boolean).join('\n'),C.orange],
  ['價格位置',st.pos.label,'從前高拉回的位置',C.orange],
  ['漲勢進度',progress.main,progress.sub,C.navy],
  ['個股操作環境',st.action.label,st.action.label==='保守'?'提高門檻':'依個股自身結構選股',C.purple]
 ];
 const metricW=(INNER-G*2)/3;for(let row=0;row<2;row++){const cells=metrics.slice(row*3,row*3+3).map(([title,value,sub,color])=>({color,blocks:[prepare(title,metricW-44,30,650,color,14),prepare(value,metricW-44,38,700,C.ink,14),prepare(sub,metricW-44,30,500,C.muted,0)]})),height=Math.max(...cells.map(c=>c.blocks.reduce((s,b)=>s+b.height+b.gap,0)))+44;add('metrics-'+row,height,top=>cells.forEach((cell,i)=>{const x=M+i*(metricW+G);panel(x,top,metricW,height);ctx.fillStyle=cell.color;ctx.fillRect(x,top+24,5,height-48);let cy=top+22;for(const b of cell.blocks)cy=draw(b,x+22,cy);}));}
 const mapTitle=prepare('A. 大盤價格作戰地圖｜由高到低',INNER-PAD*2,40,750,C.navy,18),mapRows=map.map(it=>{const current=it.label==='目前收盤',price=prepare(fmt(it.value)+' 點',265,36,700,current?C.red:it.color,0),label=prepare(it.label,INNER-PAD*2-285,34,current?650:500,current?C.red:C.ink,0);return {price,label,height:Math.max(price.height,label.height)+24};}),mapNote=prepare('※ 大盤關卡用來調整個股操作積極度，不是指數交易指令。',INNER-PAD*2,28,500,C.muted,0),mapH=PAD*2+mapTitle.height+mapTitle.gap+mapRows.reduce((n,r)=>n+r.height,0)+18+mapNote.height;
 add('price-map',mapH,top=>{panel(M,top,INNER,mapH);let cy=draw(mapTitle,M+PAD,top+PAD);for(const row of mapRows){draw(row.price,M+PAD,cy+10);draw(row.label,M+PAD+285,cy+10);cy+=row.height;ctx.strokeStyle='#e6edf3';ctx.beginPath();ctx.moveTo(M+PAD,cy);ctx.lineTo(W-M-PAD,cy);ctx.stroke();}draw(mapNote,M+PAD,cy+18);});
 scenarios.forEach((text,i)=>card('scenario-'+i,`B. 明天怎麼走？｜劇本 ${i+1}`,[text],{fill:['#f5faf7','#fffaf3','#fff7f7'][i]}));
 const bullets=[`大盤環境：${st.env.state}｜風險${st.env.risk}`,`N字：${progress.combined}`,`價格位置：${st.pos.label}`,`20日均線：${st.ma20===null?'資料不足':fmt(st.ma20)} 點｜方向 ${st.slope===null?'待確認':`${st.slope>=0?'向上':'向下'} ${fmt(Math.abs(st.slope))}%`}`,`個股操作：${st.action.label}`,st.B!==null?`往上先看：B｜${fmt(st.B)} 點`:'往上等待新前高',st.ma20!==null?`先看能否守住20日均線：${fmt(st.ma20)} 點`:'均線資料不足，先觀察下方支撐',data?.dailySeriesMeta?.volumeMeaning?`成交量資料：${data.dailySeriesMeta.volumeMeaning}`:'成交量資料不足，暫不判斷量能',st.nStatus==='FORMING'?'C尚未確認：止跌K只能先當候選C。':'跟著這波漲勢的變化持續觀察。'];
 card('decision','C. 現在能不能進？持有要不要出？',bullets.map(text=>({text:'• '+text,size:36,gap:18})));
 card('mnemonic','記住口訣',[{text:`A 起漲 → B 前高 →\n${st.C!==null?'C 回檔':'等有效 C'} → 再突破 B\n＝ 完整 N 字確認`,size:38,weight:650,color:C.teal}]);
 const tri=st.trident365||{},triCells=[['壓力',tri.pressure,C.orange],['支撐',tri.support,C.teal],['備用觀察',tri.preparatory,C.purple]],triTitle=prepare('大盤三條關鍵線｜壓力・支撐・備用觀察',INNER-PAD*2,38,750,C.navy,22),triW=(INNER-PAD*2-G*2)/3,triRows=triCells.map(([label,item,color])=>[prepare(label,triW-20,30,650,color,12),prepare(item?fmt(item.value)+' 點':'資料不足',triW-20,36,700,color,0)]),triRowH=Math.max(...triRows.map(b=>b.reduce((s,x)=>s+x.height+x.gap,0)))+28,triNote=prepare(tri.preparatory?'預：如果撐不住，下面還有一條備用防線（候選線，不等同正式支撐）':'三叉戟：壓＝上方賣壓觀察｜撐＝下方防守觀察',INNER-PAD*2,28,500,C.muted,0),triH=PAD*2+triTitle.height+triTitle.gap+triRowH+22+triNote.height;
 add('trident',triH,top=>{panel(M,top,INNER,triH);let cy=draw(triTitle,M+PAD,top+PAD);triRows.forEach((blocks,i)=>{const x=M+PAD+i*(triW+G);panel(x,cy,triW,triRowH,'#f8fbfd');let yy=cy+14;for(const b of blocks)yy=draw(b,x+10,yy);});draw(triNote,M+PAD,cy+triRowH+22);});
 card('footer','風險提醒',[{text:'技術分析僅供研究與決策參考，風險自負。',size:30,color:C.red},{text:version+'｜盤後研究',size:28,color:C.muted}]);
 const H=Math.ceil(y);if(H>MAX_H)throw Error('完整大盤報告內容超過長圖容量，請改用文字報告。');canvas.height=H;ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);jobs.forEach(paint=>paint());
 if(JSON.stringify(data)!==sourceBefore)throw Error('圖片排版不得修改原分析資料。');
 const audit={version:'MARKET_COMFORT_LAYOUT_V864',width:W,height:H,bodyFont:38,bodyLineHeight:57,bodyWeight:500,panelGap:G,minFont:26,noOverlap:sections.every((s,i)=>!i||s.top>=sections[i-1].bottom+G),noClipping:painted.every(t=>t.bottom<=H-M),sections,sourceDate:data.closeDate,sourceClose:data.close,abc:{A:st.A,B:st.B,C:st.C},map,scenarios,bullets,metrics:metrics.map(([title,value,sub])=>({title,value,sub})),trident:tri,stage:stage.shortLabel||stage.label,originalContentPreserved:true,analysisChanged:false,chartUsesOriginalRenderer:true,text:painted.map(x=>x.text)};
 if(!audit.noOverlap||!audit.noClipping)throw Error('大盤報告文字超出安全範圍，已停止匯出。');
 canvas.marketReaderData={version,metadata,generated,stage:{label:stage.shortLabel||stage.label,headline:stage.headline||stage.plainText},abc:abc.map(({key,label,value,date,color})=>({key,label,value,date,color})),progress:progress.combined,chart:sections.find(s=>s.id==='chart'),metrics,map,scenarios,bullets,trident:tri,tridentNote:triNote.text,mnemonic:`A 起漲 → B 前高 →\n${st.C!==null?'C 回檔':'等有效 C'} → 再突破 B\n＝ 完整 N 字確認`};
 canvas.dataset.reportMode='market';canvas.dataset.marketComfortLayout='true';canvas.dataset.marketComfortAudit=JSON.stringify(audit);return canvas;
}
// The mobile reader and exported PNG share the same prepared report content.
function mountReader(canvas){
 const modal=document.getElementById('imagePreviewModal'),image=document.getElementById('imagePreviewImg');if(!modal||!image)return;
 document.getElementById('marketMobileReader')?.remove();document.getElementById('marketReaderToggle')?.remove();document.getElementById('marketReaderTitle')?.remove();delete modal.dataset.marketReader;delete modal.dataset.marketView;
 const data=canvas.marketReaderData;if(!data)return;
 if(!document.getElementById('marketReaderStyle')){const style=document.createElement('style');style.id='marketReaderStyle';style.textContent=READER_CSS;document.head.append(style);}
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;if(cls)node.className=cls;return node;},article=el('article',null,'market-reader');article.id='marketMobileReader';article.setAttribute('aria-label','大盤 ABC 手機閱讀報告');
 const section=(title,cls='')=>{const node=el('section',null,'mr-card '+cls);node.append(el('h2',title));article.append(node);return node;},paragraph=(host,text,cls)=>{host.append(el('p',text,cls));};
 const intro=el('header',null,'mr-card mr-intro');intro.append(el('p','大盤先懂 ABC','mr-eyebrow'),el('h1','現在市場走到哪一步？'));paragraph(intro,'臺灣加權股價指數','mr-index');paragraph(intro,data.metadata,'mr-meta');paragraph(intro,`報告製作 By.石頭少爺｜${data.version}\n${data.generated}`,'mr-meta');article.append(intro);
 const stage=section('大盤行情階段','mr-stage');paragraph(stage,data.stage.label,'mr-status');paragraph(stage,data.stage.headline);
 const abc=section('ABC 是這套分析的核心');paragraph(abc,'A 是起漲低點，B 是前一個高點，C 是回落後確認的低點。');const abcRows=el('dl',null,'mr-abc');data.abc.forEach(a=>{const row=el('div');row.style.setProperty('--mr-accent',a.color);row.append(el('dt',a.key+' '+a.label));const value=el('dd');value.append(el('strong',a.value===null?'尚未形成':root.fmt(a.value)+' 點'));if(a.value!==null&&a.date)value.append(el('span',root.dateCompactV3328(a.date),'mr-meta'));row.append(value);abcRows.append(row);});abc.append(abcRows);paragraph(abc,'目前進度：'+data.progress,'mr-emphasis');paragraph(abc,'口訣：A 起漲 → B 前高 → 等有效 C → 再突破 B＝完整 N 字確認。');
 const chart=section('真實大盤日 K 與成交量');paragraph(chart,'最近 80 根・20 日均線・三叉戟','mr-meta');const chartArea=el('div',null,'mr-chart-area'),chartImage=el('canvas',null,'mr-chart');chartImage.width=canvas.width;chartImage.height=data.chart.bottom-data.chart.top;chartImage.getContext('2d').drawImage(canvas,0,data.chart.top,canvas.width,chartImage.height,0,0,canvas.width,chartImage.height);chartImage.setAttribute('role','img');chartImage.setAttribute('aria-label','與下載報告相同的大盤日 K、20 日均線、成交量及三條關鍵線');chartArea.append(chartImage);chart.append(chartArea);const zoom=el('button','放大 K 線圖','mr-chart-toggle');zoom.type='button';zoom.setAttribute('aria-expanded','false');zoom.onclick=()=>{const expanded=zoom.getAttribute('aria-expanded')!=='true';zoom.setAttribute('aria-expanded',String(expanded));chartArea.classList.toggle('mr-chart-expanded',expanded);zoom.textContent=expanded?'縮回完整圖':'放大 K 線圖';};chart.append(zoom);
 const metrics=section('大盤重點');const metricList=el('div',null,'mr-metrics');data.metrics.forEach(([title,value,sub,color])=>{const cell=el('div',null,'mr-metric');cell.style.setProperty('--mr-accent',color);cell.append(el('h3',title),el('p',value,'mr-value'),el('p',sub));metricList.append(cell);});metrics.append(metricList);
 const map=section('A. 大盤價格作戰地圖');paragraph(map,'關鍵價位由高到低排列。','mr-meta');const prices=el('dl',null,'mr-price-map');data.map.forEach(item=>{const row=el('div');const price=el('dt',root.fmt(item.value)+' 點');price.style.color=item.color;row.append(price,el('dd',item.label));prices.append(row);});map.append(prices);paragraph(map,'大盤關卡用來調整個股操作積極度，不是指數交易指令。','mr-meta');
 data.scenarios.forEach((text,i)=>paragraph(section(`B. 明天怎麼走？｜劇本 ${i+1}`,'mr-scenario mr-scenario-'+i),text));
 const decision=section('C. 現在能不能進？持有要不要出？'),list=el('ul');data.bullets.forEach(text=>list.append(el('li',text)));decision.append(list);
 paragraph(section('記住口訣'),data.mnemonic,'mr-emphasis');
 const trident=section('大盤三條關鍵線'),triList=el('dl',null,'mr-trident');[['壓力',data.trident.pressure],['支撐',data.trident.support],['備用觀察',data.trident.preparatory]].forEach(([label,item])=>{const row=el('div');row.append(el('dt',label),el('dd',item?root.fmt(item.value)+' 點':'資料不足'));triList.append(row);});trident.append(triList);paragraph(trident,data.tridentNote,'mr-meta');
 const footer=section('風險提醒');paragraph(footer,'技術分析僅供研究與決策參考，風險自負。');paragraph(footer,`${data.version}｜下載／分享：${canvas.dataset.marketReaderWatermarked==='true'?'浮水印版':'無浮水印版'}`,'mr-meta');
 image.after(article);modal.dataset.marketReader='true';modal.dataset.marketView='reading';modal.scrollTop=0;
 const toggle=el('button','圖片預覽','market-reader-toggle');toggle.id='marketReaderToggle';toggle.type='button';toggle.setAttribute('aria-controls','marketMobileReader imagePreviewImg');toggle.setAttribute('aria-pressed','true');toggle.onclick=()=>{const reading=modal.dataset.marketView!=='reading';modal.dataset.marketView=reading?'reading':'image';toggle.textContent=reading?'圖片預覽':'手機閱讀';toggle.setAttribute('aria-pressed',String(reading));modal.scrollTop=0;};const title=el('span','大盤報告','market-reader-title');title.id='marketReaderTitle';title.setAttribute('aria-hidden','true');modal.querySelector('.image-modal-head').prepend(title);modal.querySelector('.image-modal-close').before(toggle);
}
const READER_CSS=`
.market-reader,.market-reader-toggle,.market-reader-title{display:none}
@media (max-width:600px),(max-width:1000px) and (pointer:coarse){
 #imagePreviewModal[data-market-reader="true"]{padding:0;background:#eef3f8;backdrop-filter:none;-webkit-backdrop-filter:none;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;height:100vh;height:100dvh}
 #imagePreviewModal[data-market-reader="true"].show{display:block}
 #imagePreviewModal[data-market-reader="true"] .image-modal-card{box-sizing:border-box;width:100%;max-width:none;min-height:100%;margin:0;padding:0 0 calc(112px + env(safe-area-inset-bottom,0px));border:0;border-radius:0;box-shadow:none;background:#eef3f8;color:#24364b}
 #imagePreviewModal[data-market-reader="true"] .image-modal-head{position:sticky;top:0;z-index:2;gap:8px;margin:0;padding:calc(10px + env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) 10px max(12px,env(safe-area-inset-left,0px));background:#fff;border-bottom:1px solid #d7e1eb}
 #imagePreviewModal[data-market-reader="true"] .image-modal-title{display:none}
 #imagePreviewModal[data-market-reader="true"] .market-reader-title{display:block;flex:1;min-width:0;font-size:17px;font-weight:650;line-height:1.5}
 #imagePreviewModal[data-market-reader="true"] .image-modal-close,#imagePreviewModal[data-market-reader="true"] .market-reader-toggle{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-height:44px;padding:8px 10px;border:1px solid #ccd9e5;border-radius:10px;background:#fff;color:#183c56;font-size:14px;font-weight:600;white-space:nowrap;cursor:pointer}
 #imagePreviewModal[data-market-reader="true"] .image-preview-wrap{box-sizing:border-box;width:100%;margin:0;padding:0;border:0;border-radius:0;max-height:none;overflow:visible;background:#eef3f8;text-align:left}
 #imagePreviewModal[data-market-reader="true"][data-market-view="reading"] #imagePreviewImg{display:none}
 #imagePreviewModal[data-market-reader="true"][data-market-view="image"] #imagePreviewImg{display:block;width:100%;height:auto;max-width:none;margin:0;border-radius:0;box-shadow:none}
 #imagePreviewModal[data-market-reader="true"][data-market-view="reading"] .market-reader{display:block}
 #imagePreviewModal .market-reader{box-sizing:border-box;max-width:100%;padding:12px max(12px,env(safe-area-inset-right,0px)) 20px max(12px,env(safe-area-inset-left,0px));font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;font-size:17px;font-weight:400;line-height:1.8;color:#24364b;overflow-wrap:anywhere;-webkit-text-size-adjust:100%;text-align:left}
 #imagePreviewModal .market-reader *{box-sizing:border-box}
 #imagePreviewModal .market-reader .mr-card{scroll-margin-top:90px;scroll-margin-bottom:90px;min-width:0;margin:0 0 14px;padding:20px 18px;border:1px solid #d7e1eb;border-radius:16px;background:#fff;box-shadow:none}
 #imagePreviewModal .market-reader h1{margin:4px 0 16px;font-size:25px;font-weight:750;line-height:1.5;color:#183c56}
 #imagePreviewModal .market-reader h2{margin:0 0 14px;font-size:20px;font-weight:700;line-height:1.6;color:#183c56}
 #imagePreviewModal .market-reader h3{margin:0 0 6px;font-size:16px;font-weight:600;line-height:1.6}
 #imagePreviewModal .market-reader p{margin:0 0 14px;font-size:17px;font-weight:400;line-height:1.8;white-space:pre-line}
 #imagePreviewModal .market-reader p:last-child{margin-bottom:0}
 #imagePreviewModal .market-reader .mr-meta{font-size:14px;line-height:1.75;color:#536578}
 #imagePreviewModal .market-reader .mr-eyebrow{margin-bottom:4px;font-size:16px;font-weight:650;color:#176f65}
 #imagePreviewModal .market-reader .mr-index{font-size:18px;font-weight:600}
 #imagePreviewModal .market-reader .mr-status{font-size:24px;font-weight:700;line-height:1.6;color:#183c56}
 #imagePreviewModal .market-reader .mr-emphasis{font-weight:600;color:#176f65}
 #imagePreviewModal .market-reader .mr-stage{background:#f7f9fc}
 #imagePreviewModal .market-reader dl{margin:16px 0}
 #imagePreviewModal .market-reader dl>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);align-items:start;gap:10px;padding:13px 0;border-bottom:1px solid #e6edf3}
 #imagePreviewModal .market-reader dt,#imagePreviewModal .market-reader dd{min-width:0;margin:0;font-size:17px;font-weight:400;line-height:1.8}
 #imagePreviewModal .market-reader .mr-abc dt{color:var(--mr-accent);font-weight:650}
 #imagePreviewModal .market-reader .mr-abc dd strong{display:block;font-size:18px;font-weight:650;color:var(--mr-accent)}
 #imagePreviewModal .market-reader .mr-abc dd span{display:block}
 #imagePreviewModal .market-reader .mr-chart-area{width:100%;overflow-x:auto;overscroll-behavior-x:contain}
 #imagePreviewModal .market-reader .mr-chart{display:block;width:100%;max-width:none;height:auto}
 #imagePreviewModal .market-reader .mr-chart-expanded .mr-chart{width:1000px}
 #imagePreviewModal .market-reader .mr-chart-toggle{min-height:44px;margin-top:10px;padding:8px 12px;border:1px solid #ccd9e5;border-radius:10px;background:#fff;color:#183c56;font-size:15px;font-weight:500}
 #imagePreviewModal .market-reader .mr-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
 #imagePreviewModal .market-reader .mr-metric{min-width:0;padding:14px 12px;border-left:3px solid var(--mr-accent);background:#f8fbfd;border-radius:8px}
 #imagePreviewModal .market-reader .mr-metric:nth-child(3),#imagePreviewModal .market-reader .mr-metric:last-child{grid-column:1/-1}
 #imagePreviewModal .market-reader .mr-value{font-size:20px;font-weight:650;line-height:1.5}
 #imagePreviewModal .market-reader .mr-price-map>div{display:block}
 #imagePreviewModal .market-reader .mr-price-map dt{font-size:21px;font-weight:650;line-height:1.5;font-variant-numeric:tabular-nums}
 #imagePreviewModal .market-reader .mr-price-map dd{margin-top:6px}
 #imagePreviewModal .market-reader ul{margin:0;padding-left:1.3em}
 #imagePreviewModal .market-reader li{margin:0 0 16px;padding-left:4px;font-size:17px;line-height:1.8}
 #imagePreviewModal .market-reader li:last-child{margin-bottom:0}
 #imagePreviewModal .market-reader .mr-scenario-0{background:#f5faf7}
 #imagePreviewModal .market-reader .mr-scenario-1{background:#fffaf3}
 #imagePreviewModal .market-reader .mr-scenario-2{background:#fff7f7}
 #imagePreviewModal .market-reader .mr-trident dd{font-size:20px;font-weight:650;color:#176f65;font-variant-numeric:tabular-nums}
 #imagePreviewModal[data-market-reader="true"] .image-modal-actions{position:fixed;left:0;right:0;bottom:0;z-index:3;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:10px max(12px,env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));background:#fff;border-top:1px solid #d7e1eb}
 #imagePreviewModal[data-market-reader="true"] .image-save-link,#imagePreviewModal[data-market-reader="true"] .image-share-btn{min-width:0;min-height:46px;padding:10px 8px;font-size:14px;font-weight:600;line-height:1.5}
 #imagePreviewModal[data-market-reader="true"] .image-preview-note{margin:0;padding:12px 18px;font-size:14px;line-height:1.8;color:#536578}
 #imagePreviewModal[data-market-reader="true"] .r45-preview-actions{display:none}
}
@media(max-width:374px){#imagePreviewModal .market-reader .mr-metrics{grid-template-columns:minmax(0,1fr)}#imagePreviewModal .market-reader .mr-metric:nth-child(3){grid-column:auto}}
`;

root.ShitouMarketComfortReport={render,mountReader};
})(globalThis);
