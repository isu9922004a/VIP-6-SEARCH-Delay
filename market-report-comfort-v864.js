/* Approved 1284x2778 market page. Analysis helpers remain authoritative. */
(function(root){
'use strict';
const W=1284,H=2778,M=42,PAD=44,C={bg:'#eef3f8',card:'#ffffff',ink:'#233c51',muted:'#607489',line:'#d8e3ed',teal:'#17776e',orange:'#ac651d',purple:'#7960a1'};
const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function model(data,{notice=''}={}){
 if(!data||!/^\d{4}-\d{2}-\d{2}$/.test(data.closeDate||''))throw Error('大盤行情日期尚未核對，請重新載入。');
 if(data.index&&String(data.index).toUpperCase()!=='TAIEX')throw Error('這份圖片需要加權指數資料。');
 const st=root.marketInfographicStateV3328(data),stage=root.marketStageDisplayAdapterV53245(data),progress=root.marketInfographicProgressV3330(st),rsiInfo=root.marketRsiComfortDisplayV37723(data),bars=root.normalizeMarketDailyBarsV365(data),last=bars.at(-1),quoteAligned=!!last&&last.date===data.closeDate&&(!data.dailySeriesMeta?.lastDate||data.dailySeriesMeta.lastDate===data.closeDate)&&st.close!==null&&Math.abs(last.close-st.close)<.005,chartReady=quoteAligned&&bars.length>=20&&data.completed!==false&&data.dailySeriesMeta?.onlyCompletedBars!==false;
 const fmt=v=>number(v)===null?'待確認':root.fmt(Number(v)),stateText=(stage.shortLabel||'')+' '+(st.env?.state||''),source=String(data.source||data.dailySeriesMeta?.source||'來源待核對');
 let tone=!chartReady||st.ma20===null?'UNKNOWN':/轉弱|偏弱/.test(stateText)?'WEAK':/高檔風險|末升段/.test(stateText)?'CAUTION':/主升段|偏多/.test(stateText)?'STRONG':/初升段|轉強/.test(stateText)?'TURNING':'MIXED';
 const headline={UNKNOWN:'資料待核對，先保留判斷',WEAK:'走勢偏弱，先等止跌',CAUTION:'已漲過一段，追價要更小心',STRONG:'走勢偏強，仍要守住關卡',TURNING:'開始轉強，仍要確認站穩',MIXED:'多空還在拉鋸，先等方向'}[tone];
 let abcStatus='ABC 資料還不完整，先等新結構。';
 if(st.nStatus==='FAILED')abcStatus=[st.A,st.B,st.C].every(v=>v===null)?'ABC 尚未形成，先別急著搶反彈。':'原本 ABC 已失效，先等新結構確認。';
 else if(st.nStatus==='CONFIRMED')abcStatus=st.nPhase==='WEAKENING'?'ABC 已確認但轉弱，先看能否守住。':'ABC 已確認，仍要看突破後能否守住。';
 else if(st.nStatus==='ABC_READY')abcStatus='ABC 已形成，等待能否突破 B 點。';
 else if(st.A!==null&&st.B!==null)abcStatus='A、B 已形成，C 還要等回落確認。';
 if(!chartReady)abcStatus='完整日 K 尚未核對，先不下多空結論。';
 const slope=st.slope===null?'斜率待確認':st.slope>0?'仍往上':st.slope<0?'仍往下':'目前走平',relative=st.close===null||st.ma20===null?null:st.close<st.ma20?'上方':st.close>st.ma20?'下方':'附近';
 const maReason=relative===null?'20日均線資料不足，先不判斷中期強弱。':`20日均線 ${fmt(st.ma20)} 在${relative}，${st.slope===null?slope:'而且'+slope}。`;
 const context=st.rsiContext3750?.key;
 const rsiMeaning={TOP_DIV_CONFIRMED:'價格已轉弱，先前上漲力道沒跟上。',TOP_DIV_CANDIDATE:'價格創高，力道沒跟上，留意轉弱。',BOTTOM_DIV_CONFIRMED:'下跌力道減弱，價格也已轉強。',BOTTOM_DIV_CANDIDATE:'下跌力道減弱，仍要等價格轉強。'}[context]||(st.rsi===null?'短線力道資料不足。':st.rsi<30?'短線力道弱，跌深不代表會反彈。':st.rsi>=70?'短線偏強，漲多仍別急著追。':st.rsi>=50?'短線力道回升，仍要看價格站穩。':'短線力道仍在拉鋸，先等價格站穩。');
 const rsiReason=`RSI ${fmt(st.rsi)}：${rsiMeaning}`;
 const tri=st.trident365||{},definitions=[['壓力線','pressure','漲到這裡，留意賣壓。',C.orange],['支撐線','support','跌到這裡，看能否守住。',C.teal],['預備線','preparatory','支撐失守後的備用觀察。',C.purple]];
 const prices=definitions.map(([label,key,meaning,color])=>({label,key,value:number(tri[key]?.value),meaning:number(tri[key]?.value)===null?'資料不足，暫不猜價位。':meaning,color})),has=key=>prices.find(v=>v.key===key).value!==null;
 const scenarios=[{label:tone==='STRONG'?'續強時':'反彈時',body:has('pressure')?'站回壓力線並守住，再觀察反彈。':'上方關卡待確認，先不填反彈目標。',color:C.orange},{label:'盤整時',body:has('pressure')&&has('support')?'壓力與支撐之間來回，先等方向。':'主要關卡待確認，先觀察價格站穩。',color:C.muted},{label:'續跌時',body:has('support')?(has('preparatory')?'支撐線失守，留意下方預備線。':'支撐線失守，先核對下方風險。'):'支撐資料不足，先保留風險判斷。',color:C.teal}];
 const previous=quoteAligned?bars.at(-2):null,previousClose=number(previous?.close),change=previousClose!==null&&previousClose>0?st.close-previousClose:null,changePct=change===null?null:change/previousClose*100;
 const freshnessNote=notice||(!quoteAligned?'日 K 與收盤尚未核對，暫不解讀線圖。':'');
 return {version:root.ShitouReleaseV50?.displayCode||'V8.7.3',date:data.closeDate,close:st.close,previousDate:previous?.date||null,previousClose,change,changePct,source,sourceLabel:/TWSE|證交所|Official/i.test(source)?'證交所':'行情來源見網頁',st,stage,progress,rsiInfo,tone,headline,riskColor:st.env.risk==='低'?C.teal:st.env.risk==='中'?C.muted:C.orange,risk:tone==='UNKNOWN'?'風險待核對':({高:'風險偏高',中:'風險中等',低:'風險較低'}[st.env.risk]||'風險待核對'),abcStatus,reasonsTitle:tone==='WEAK'?'為什麼現在偏弱？':tone==='STRONG'?'目前偏強的依據？':tone==='UNKNOWN'?'哪些資料還待確認？':'目前有哪些線索？',maReason,rsiReason,prices,scenarios,chartReady,barCount:bars.length,chartBars:chartReady?root.selectMarketChartBarsV365(data,st).bars.length:0,tri,freshnessNote,newEntry:tone==='UNKNOWN'?'還沒買：先等完整資料，再核對個股條件。':tone==='STRONG'||tone==='TURNING'?'還沒買：等價格站穩，再看個股自己的條件。':tone==='CAUTION'?'還沒買：別急著追高，先核對個股風險。':tone==='WEAK'?'還沒買：先等止跌，再看個股自己的條件。':'還沒買：先等方向明朗，再核對個股條件。'};
}

function render(raw,options={}){
 const sourceBefore=JSON.stringify(raw),v=model(raw,options),st=v.st,tri=v.tri,fmt=x=>number(x)===null?'待確認':root.fmt(Number(x)),datefmt=root.datefmt,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d'),checks=[];c.fillStyle=C.bg;c.fillRect(0,0,W,H);c.textBaseline='top';
function font(size,weight=400){c.font=`${weight} ${size}px "Noto Sans CJK TC","Noto Sans TC",sans-serif`;c.textBaseline='top';}
function text(value,x,y,{size=51,weight=400,color=C.ink,width=W-M-x,lineHeight=size*1.45}={}){const lines=String(value).split('\n');font(size,weight);while(size>32&&lines.some(line=>c.measureText(line).width>width+1)){size--;font(size,weight);}c.fillStyle=color;for(let i=0;i<lines.length;i++){const actual=c.measureText(lines[i]).width;if(actual>width+1)throw Error('Text exceeds column: '+lines[i]+' '+actual+' > '+width);c.fillText(lines[i],x,y+i*lineHeight);}const bottom=y+lines.length*lineHeight;if(bottom>H-16)throw Error('Text exceeds page: '+value);checks.push({text:value,x,y,bottom,size,width});return bottom;}
function card(y,h,fill=C.card){c.beginPath();c.roundRect(M,y,W-2*M,h,26);c.fillStyle=fill;c.fill();c.strokeStyle=C.line;c.lineWidth=2;c.stroke();}
function pill(value,x,y,w,color,fill){c.beginPath();c.roundRect(x,y,w,56,28);c.fillStyle=fill;c.fill();text(value,x+(w-5*30)/2,y+5,{size:30,weight:650,color,width:w-20,lineHeight:45});}
text('石頭少爺・盤後研究',M,24,{size:30,weight:600,color:C.teal});pill('盤後白話版',W-M-220,18,220,C.teal,'#e2f1ed');
text('大盤一頁看懂',M,76,{size:66,weight:750});text(`臺灣加權指數｜${datefmt(v.date)} 盤後`,M,164,{size:34,color:C.muted});
text('收盤 '+fmt(st.close)+' 點',M,222,{size:52,weight:650});const delta=v.change===null?'漲跌待核對':`${v.change>=0?'+':''}${fmt(v.change)}（${v.changePct>=0?'+':''}${v.changePct.toFixed(2)}%）`;text(delta,820,235,{size:36,weight:550,color:v.change===null?C.muted:v.change>0?'#bc444c':C.teal,width:W-M-820});
card(310,184,'#f8fbfd');text(v.headline,M+PAD,332,{size:56,weight:700,lineHeight:75});text(v.risk,W-M-PAD-172,343,{size:33,weight:650,color:v.riskColor,width:172});text(v.abcStatus,M+PAD,414,{size:44,lineHeight:60,width:W-2*(M+PAD)});
const chart=document.createElement('canvas');chart.width=3200;chart.height=1500;const chartH=Math.round((W-2*M)*520/1016);if(v.chartReady){const cc=chart.getContext('2d');cc.scale(2,2);root.applyMarketVisualQualityV37775(cc);root.drawMarketTopChartV365(cc,raw,st);c.drawImage(chart,1120,348,2032,1040,M,514,W-2*M,chartH);}else{card(514,chartH);text('完整日 K 尚未到齊，暫不畫線。',M+PAD,690,{size:52,weight:650});text('請重新載入大盤資料，避免用缺漏數據判讀。',M+PAD,800,{size:44,width:W-2*(M+PAD)});}
card(1146,224);text('ABC：看這波上漲有沒有站穩',M+PAD,1166,{size:46,weight:700,lineHeight:60});
[['A','起漲的低點',86,C.teal],['B','前一個高點',455,C.orange],['C','回落守住的低點',824,C.purple]].forEach(([label,meaning,x,color])=>{text(label,x,1232,{size:44,weight:700,color,width:46,lineHeight:56});text(meaning,x+60,1236,{size:39,width:W-M-PAD-x-60,lineHeight:52});});
text('回落守住 C，再突破 B，才有繼續上漲的線索。',M+PAD,1294,{size:40,lineHeight:56,width:W-2*(M+PAD),color:C.muted});
card(1388,252);text(v.reasonsTitle,M+PAD,1410,{size:48,weight:700,lineHeight:66});text(v.maReason,M+PAD,1488,{size:45,lineHeight:64,width:W-2*(M+PAD)});text(v.rsiReason,M+PAD,1558,{size:45,lineHeight:64,width:W-2*(M+PAD)});
card(1658,368);text('🔱 三叉戟：明天的三條觀察線',M+PAD,1680,{size:48,weight:700,lineHeight:66});const priceRows=v.prices.map(p=>[p.label,p.value,p.meaning,p.color]);
priceRows.forEach(([label,value,meaning,color],i)=>{const y=1754+i*70;if(i){c.strokeStyle='#e9eef3';c.lineWidth=2;c.beginPath();c.moveTo(M+PAD,y-9);c.lineTo(W-M-PAD,y-9);c.stroke();}text(label,M+PAD,y+6,{size:39,weight:550,color,width:220,lineHeight:56});text(fmt(value),334,y,{size:51,weight:700,color,width:350,lineHeight:64});text(meaning,728,y+6,{size:39,color:C.muted,width:W-M-PAD-728,lineHeight:56});});
text('預備線不保證會跌到，也不保證能止跌。',M+PAD,1970,{size:34,lineHeight:49,color:C.muted,width:W-2*(M+PAD)});
card(2044,288);text('明天怎麼觀察？',M+PAD,2062,{size:48,weight:700,lineHeight:66});const actions=v.scenarios.map(s=>[s.label,s.body,s.color]);
actions.forEach(([label,body,color],i)=>{const y=2146+i*60;text(label,M+PAD,y+4,{size:40,weight:650,color,width:150,lineHeight:56});text(body,238,y,{size:44,width:W-M-PAD-238,lineHeight:60});});
card(2350,256,'#e4edf4');text('新手與已持有的人怎麼做？',M+PAD,2372,{size:48,weight:700,lineHeight:66});text(v.newEntry,M+PAD,2456,{size:44,width:W-2*(M+PAD),lineHeight:64});text('已持有：核對個股的風險與停損計畫。',M+PAD,2526,{size:44,width:W-2*(M+PAD),lineHeight:64});
if(v.freshnessNote){text(v.freshnessNote,M+8,2628,{size:28,color:C.orange,lineHeight:40});text('觀察不保證明天漲跌，大盤價位也不是個股買賣點。',M+8,2672,{size:28,color:C.muted,lineHeight:40});text(v.sourceLabel+' '+datefmt(v.date)+'｜'+v.version+' 白話版｜投資風險自負。',M+8,2716,{size:26,color:C.muted,lineHeight:38});}else{text('觀察不保證明天漲跌，大盤價位也不是個股買賣點。',M+8,2634,{size:32,color:C.muted});text(v.sourceLabel+' '+datefmt(v.date)+'｜'+v.version+' 白話版｜投資風險自負。',M+8,2690,{size:28,color:C.muted});}
if(JSON.stringify(raw)!==sourceBefore)throw Error('Source analysis mutated');const sections=[{name:'header',top:18,bottom:294},{name:'status',top:310,bottom:494},{name:'chart',top:514,bottom:514+chartH},{name:'abc',top:1146,bottom:1370},{name:'reasons',top:1388,bottom:1640},{name:'trident',top:1658,bottom:2026},{name:'scenarios',top:2044,bottom:2332},{name:'personal-actions',top:2350,bottom:2606},{name:'footer',top:2634,bottom:v.freshnessNote?2754:2731}];const noOverlap=sections.every((s,i)=>!i||s.top>sections[i-1].bottom);if(!noOverlap)throw Error('Panel overlap');

 const audit={version:'MARKET_COMFORT_LAYOUT_V864',layoutVersion:'MARKET_ONEPAGE_DYNAMIC_V864',width:W,height:H,bodyFont:44,bodyLineHeight:64,bodyWeight:400,panelGap:18,minFont:Math.min(...checks.map(x=>x.size)),noOverlap,noClipping:checks.every(x=>x.bottom<=H-16),sections,sourceDate:v.date,sourceClose:v.close,source:v.source,previousDate:v.previousDate,change:v.change,changePct:v.changePct,abc:{A:st.A,B:st.B,C:st.C,status:st.nStatus,phase:st.nPhase},tone:v.tone,headline:v.headline,risk:v.risk,abcStatus:v.abcStatus,reasons:[v.maReason,v.rsiReason],prices:v.prices,scenarios:v.scenarios,trident:tri,chartReady:v.chartReady,chartBarCount:v.chartBars,chartUsesOriginalRenderer:v.chartReady,freshnessNote:v.freshnessNote,text:checks.map(x=>x.text),analysisChanged:false};
 if(!audit.noClipping)throw Error('單頁大盤報告超出安全範圍，已停止匯出。');
 const metrics=[['大盤環境',st.env.state,'市場風險：'+st.env.risk,C.teal],['20日均線',fmt(st.ma20)+' 點',v.maReason,C.teal],['日 RSI 5T',fmt(st.rsi),v.rsiReason,C.orange]],abc=[['A','起漲的低點',st.A,st.fib.ADate,C.teal],['B','前一個高點',st.B,st.fib.BDate,C.orange],['C','回落守住的低點',st.C,st.fib.CDate,C.purple]].map(([key,label,value,date,color])=>({key,label,value,date,color}));
 canvas.marketReaderData={version:v.version,close:v.close,metadata:`行情基準 ${datefmt(v.date)}｜${v.source}`,generated:root.reportGeneratedAt?.()||'',stage:{label:v.headline,headline:v.abcStatus},abc,progress:v.progress.combined,chart:sections.find(s=>s.name==='chart'),metrics,map:v.prices.filter(p=>p.value!==null).map(p=>({value:p.value,label:p.label+'｜'+p.meaning,color:p.color})),scenarios:v.scenarios.map(s=>s.label+'：'+s.body),bullets:[v.newEntry,'已持有：核對個股的風險與停損計畫。',v.freshnessNote].filter(Boolean),trident:tri,tridentNote:'預備線不保證會跌到，也不保證能止跌。',mnemonic:'回落守住 C，再突破 B，才有繼續上漲的線索。'};
 canvas.dataset.iphoneFullScreen='1284x2778';canvas.dataset.shareAsSingleImage='true';canvas.dataset.reportMode='market';canvas.dataset.marketComfortLayout='true';canvas.dataset.marketComfortAudit=JSON.stringify(audit);return canvas;
}
// The mobile reader and exported PNG share the same prepared report content.
function mountReader(canvas){
 const modal=document.getElementById('imagePreviewModal'),image=document.getElementById('imagePreviewImg');if(!modal||!image)return;
 document.getElementById('marketMobileReader')?.remove();document.getElementById('marketReaderToggle')?.remove();document.getElementById('marketReaderTitle')?.remove();delete modal.dataset.marketReader;delete modal.dataset.marketView;delete modal.dataset.marketWatermarked;delete modal.dataset.marketFreshnessNotice;
 const data=canvas.marketReaderData;if(!data)return;
 if(!document.getElementById('marketReaderStyle')){const style=document.createElement('style');style.id='marketReaderStyle';style.textContent=READER_CSS;document.head.append(style);}
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;if(cls)node.className=cls;return node;},article=el('article',null,'market-reader');article.id='marketMobileReader';article.setAttribute('aria-label','大盤 ABC 手機閱讀報告');
 const section=(title,cls='')=>{const node=el('section',null,'mr-card '+cls);node.append(el('h2',title));article.append(node);return node;},paragraph=(host,text,cls)=>{host.append(el('p',text,cls));};
 const intro=el('header',null,'mr-card mr-intro');intro.append(el('p','大盤一頁看懂','mr-eyebrow'),el('h1','大盤一頁看懂'));paragraph(intro,'臺灣加權股價指數','mr-index');paragraph(intro,'收盤 '+(number(data.close)===null?'待確認':root.fmt(data.close)+' 點'),'mr-index');paragraph(intro,data.metadata,'mr-meta');paragraph(intro,`報告製作 By.石頭少爺｜${data.version}\n${data.generated}`,'mr-meta');article.append(intro);
 const stage=section('大盤行情階段','mr-stage');paragraph(stage,data.stage.label,'mr-status');paragraph(stage,data.stage.headline);
 const abc=section('ABC 是這套分析的核心');paragraph(abc,'A 是起漲低點，B 是前一個高點，C 是回落後確認的低點。');const abcRows=el('dl',null,'mr-abc');data.abc.forEach(a=>{const row=el('div');row.style.setProperty('--mr-accent',a.color);row.append(el('dt',a.key+' '+a.label));const value=el('dd');value.append(el('strong',a.value===null?'尚未形成':root.fmt(a.value)+' 點'));if(a.value!==null&&a.date)value.append(el('span',root.dateCompactV3328(a.date),'mr-meta'));row.append(value);abcRows.append(row);});abc.append(abcRows);paragraph(abc,'目前進度：'+data.progress,'mr-emphasis');paragraph(abc,'口訣：A 起漲 → B 前高 → 等有效 C → 再突破 B＝完整 N 字確認。');
 const chart=section('真實大盤日 K 與成交量');paragraph(chart,'最近 80 根・20 日均線・三叉戟','mr-meta');const chartArea=el('div',null,'mr-chart-area'),chartImage=el('canvas',null,'mr-chart');chartImage.width=canvas.width;chartImage.height=data.chart.bottom-data.chart.top;chartImage.getContext('2d').drawImage(canvas,0,data.chart.top,canvas.width,chartImage.height,0,0,canvas.width,chartImage.height);chartImage.setAttribute('role','img');chartImage.setAttribute('aria-label','與下載報告相同的大盤日 K、20 日均線、成交量及三條關鍵線');chartArea.append(chartImage);chart.append(chartArea);const zoom=el('button','放大 K 線圖','mr-chart-toggle');zoom.type='button';zoom.setAttribute('aria-expanded','false');zoom.onclick=()=>{const expanded=zoom.getAttribute('aria-expanded')!=='true';zoom.setAttribute('aria-expanded',String(expanded));chartArea.classList.toggle('mr-chart-expanded',expanded);zoom.textContent=expanded?'縮回完整圖':'放大 K 線圖';};chart.append(zoom);
 const metrics=section('大盤重點');const metricList=el('div',null,'mr-metrics');data.metrics.forEach(([title,value,sub,color])=>{const cell=el('div',null,'mr-metric');cell.style.setProperty('--mr-accent',color);cell.append(el('h3',title),el('p',value,'mr-value'),el('p',sub));metricList.append(cell);});metrics.append(metricList);
 const map=section('A. 大盤價格作戰地圖');paragraph(map,'關鍵價位由高到低排列。','mr-meta');const prices=el('dl',null,'mr-price-map');data.map.forEach(item=>{const row=el('div');const price=el('dt',root.fmt(item.value)+' 點');price.style.color=item.color;row.append(price,el('dd',item.label));prices.append(row);});map.append(prices);paragraph(map,'大盤關卡用來調整個股操作積極度，不是指數交易指令。','mr-meta');
 data.scenarios.forEach((text,i)=>paragraph(section(`B. 明天怎麼走？｜劇本 ${i+1}`,'mr-scenario mr-scenario-'+i),text));
 const decision=section('C. 現在能不能進？持有要不要出？'),list=el('ul');data.bullets.forEach(text=>list.append(el('li',text)));decision.append(list);
 paragraph(section('記住口訣'),data.mnemonic,'mr-emphasis');
 const trident=section('大盤三條關鍵線'),triList=el('dl',null,'mr-trident');[['壓力',data.trident.pressure],['支撐',data.trident.support],['備用觀察',data.trident.preparatory]].forEach(([label,item])=>{const row=el('div');row.append(el('dt',label),el('dd',item?root.fmt(item.value)+' 點':'資料不足'));triList.append(row);});trident.append(triList);paragraph(trident,data.tridentNote,'mr-meta');
 if(data.elliottWave){const waves=section('波浪位置｜輔助觀察');for(const line of data.elliottWave.lines)paragraph(waves,line);}
 const footer=section('風險提醒');paragraph(footer,'技術分析僅供研究與決策參考，風險自負。');paragraph(footer,`${data.version}｜下載／分享：${canvas.dataset.marketReaderWatermarked==='true'?'浮水印版':'無浮水印版'}`,'mr-meta');
 image.after(article);modal.dataset.marketReader='true';modal.dataset.marketWatermarked=canvas.dataset.marketReaderWatermarked||'false';modal.dataset.marketFreshnessNotice=JSON.parse(canvas.dataset.marketComfortAudit||'{}').freshnessNote||'';modal.dataset.marketView='image';modal.scrollTop=0;
 const toggle=el('button','文字閱讀','market-reader-toggle');toggle.id='marketReaderToggle';toggle.type='button';toggle.setAttribute('aria-controls','marketMobileReader imagePreviewImg');toggle.setAttribute('aria-pressed','false');toggle.onclick=()=>{const reading=modal.dataset.marketView!=='reading';modal.dataset.marketView=reading?'reading':'image';toggle.textContent=reading?'完整圖片':'文字閱讀';toggle.setAttribute('aria-pressed',String(reading));modal.scrollTop=0;};const title=el('span','大盤報告','market-reader-title');title.id='marketReaderTitle';title.setAttribute('aria-hidden','true');modal.querySelector('.image-modal-head').prepend(title);modal.querySelector('.image-modal-close').before(toggle);
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

root.ShitouMarketComfortReport={model,render,mountReader};
})(globalThis);
