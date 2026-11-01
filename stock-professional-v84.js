/* Reference professional report. Every value comes from the current stock's existing analysis. */
(function(root){
'use strict';
const W=1284,H=2778,M=26,G=12,I=W-M*2,INK='#17365b',MUTED='#5b6d84';
const price=v=>Number.isFinite(v)?v.toFixed(2)+' 元':'尚未建立';
const clean=v=>String(v??'資料待確認').replace(/新ABC尚未建立/g,'新一輪ABC待確認');
function render(report){
 if(!report?.code&&!report?.stock)throw Error('請先完成個股查詢');
 const st=root.stockInfographicStateV3328(report),layer=root.buildEducationLayerV46(report),L=layer.supportResistanceConfluence;
 const source=root.ShitouReportLayoutV563.captureProfessional(()=>renderStockProfessionalBaseV51(report));
 const captured=JSON.parse(decodeURIComponent(source.dataset.professionalLayoutContent||'%7B%7D'));
 const stage=root.stockStageDisplayAdapterV53245(report),risk=layer.decisionRiskState,exit=layer.exitManagementState;
 const c=root.document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),sections=[],texts=[];
 const tone={green:'#12804c',red:'#c52d42',orange:'#b76913',blue:'#1467a8',purple:'#7952aa'};
 const font=(size,bold=true)=>{x.font=`${bold?800:600} ${size}px "Microsoft JhengHei","Noto Sans TC","Segoe UI Emoji",sans-serif`;x.textBaseline='top';x.textAlign='left';};
 function wrap(value,width,size,bold=true){font(size,bold);const lines=[];for(const p of clean(value).split('\n')){let line='';for(const ch of [...p]){if(line&&x.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}lines.push(line);}return lines;}
 function text(value,px,py,w,h,{size=25,min=17,color=INK,bold=true,line=1.3}={}){
  let rows,n=size;for(;n>=min;n--){rows=wrap(value,w,n,bold);if(rows.length*n*line<=h)break;}
  if(n<min)throw Error('專業報告文字超出安全範圍：'+clean(value).slice(0,35));
  font(n,bold);x.fillStyle=color;rows.forEach((r,i)=>x.fillText(r,px,py+i*n*line));texts.push(clean(value));
 }
 function panel(px,py,w,h,fill='#fff',border='#cfdeeb'){x.beginPath();x.roundRect(px,py,w,h,12);x.fillStyle=fill;x.fill();x.strokeStyle=border;x.lineWidth=1.5;x.stroke();}
 function section(id,y,h){sections.push({id,top:y,bottom:y+h});}
 x.fillStyle='#eff6fb';x.fillRect(0,0,W,H);
 const gradient=x.createLinearGradient(0,0,W,142);gradient.addColorStop(0,'#123b67');gradient.addColorStop(1,'#082949');x.fillStyle=gradient;x.fillRect(0,0,W,142);
 text(`${report.name||'股票'}（${report.code||report.stock}）`,M,20,630,66,{size:58,min:26,color:'#fff'});
 text('現價 '+price(st.close),665,32,335,50,{size:38,min:23,color:'#ff879b'});
 panel(1012,15,246,112,'#123b60','#6789a7');text('報告製作 By.石頭少爺',1024,25,222,27,{size:21,min:16,color:'#fff'});
 text(root.reportGeneratedAt().replace('（台灣時間）',''),1024,60,222,28,{size:18,min:14,color:'#e0edf9'});
 text('V8.4｜個股專業分析',1024,98,222,20,{size:15,min:13,color:'#b5cce2'});
 text(`${root.marketNameZh(report.market)}｜最新交易日 ${report.closeDate||'待確認'}｜資料來源：${root.sourceNameZh(report.source)}`,M,105,970,29,{size:21,min:16,color:'#fff'});section('header',0,142);
 panel(M,158,I,149,'#f8fbff','#879fb9');x.fillStyle='#637d9c';x.fillRect(M,169,6,125);
 text('📈 行情階段｜主要依據與風險',M+23,174,I-46,32,{size:27});
 text(stage.label||'階段待確認',M+23,212,I-46,49,{size:43,min:28});
 text(stage.plainText||stage.headline||'目前證據不足，先確認資料與關鍵價位。',M+23,265,I-46,34,{size:23,min:17});section('stage',158,149);
 const half=(I-G)/2,audienceY=324,audienceH=212;
 for(const [i,title,action,body,color] of [
  [0,'👤 我現在沒有持股',root.v46ImageHeadline(risk),root.v46ActionFlowV511(report,layer).ifPass,risk.tone==='red'?tone.red:tone.orange],
  [1,'💼 我已經有持股',root.v46HolderActionCopy(exit),`${exit.label} 核心防守：${price(L.coreDefense)}。`,exit.tone==='green'?tone.green:tone.red]
 ]){const px=M+i*(half+G);panel(px,audienceY,half,audienceH,i?'#fff5f6':'#fffaf0',i?'#e8b5bf':'#edcc9a');text(title,px+18,audienceY+15,half-36,40,{size:34,min:25,color:i?'#912c3c':INK});text(action,px+18,audienceY+62,half-36,65,{size:29,min:21,color});text(body,px+18,audienceY+132,half-36,70,{size:23,min:17});}section('audiences',324,212);
 text('📍 今日關鍵價位｜價格地圖',M,552,I,43,{size:35,min:26});
 const levels=[
  ['🔴 現價',price(L.close),'最近完整交易日收盤',tone.red],['👀 空手觀察線／B點',price(L.observation),'到價後才重新檢查',tone.blue],
  ['⚡ 積極型試單觸發',price(L.probe),L.probe===null?'目前不啟用積極試單':'仍須通過量價與風險條件',tone.orange],['✅ '+(L.confirmationLabel||'保守型確認門檻'),price(L.confirmation),'完整日K站穩後，再檢查位置、量價與資金',tone.green],
  ['🟢 第一支撐',root.v46RangeText(L.supportLow,L.supportHigh),'先看能否止穩',tone.green],['🛡 核心防守',price(L.coreDefense),'跌破後看多理由變差',tone.red],
  ['🎯 風險界線 C／A',root.v46RiskBoundaryText(L),'C為計畫失效；A為ABC最終失效',tone.red],['🧱 '+(L.firstResistanceLabel||'最近上方關卡'),price(L.firstResistance),L.firstResistanceRole==='CANDIDATE'?'候選壓力，仍待確認':'觀察這一關能否站穩',tone.purple],
  ['🎯 '+(L.nextTargetRole?.startsWith('LONG')?'長線目標參考':L.nextTargetLabel||'波段延伸目標'),price(L.nextTarget),L.nextTargetRole?.startsWith('LONG')?'長線參考，不是目前ABC目標或最近壓力':'較後方參考，不保證到達',tone.purple],['📘 20日均線',price(L.ma20),'趨勢防守／後續平均成本參考',tone.blue]
 ];
 levels.forEach(([title,value,note,color],i)=>{const px=M+(i%2)*(half+G),py=604+Math.floor(i/2)*96;panel(px,py,half,88);x.fillStyle=color;x.fillRect(px,py+7,5,74);text(title,px+18,py+11,half*.53,33,{size:25,min:19});text(note,px+18,py+48,half*.53,36,{size:17,min:13,line:1.15,color:MUTED,bold:false});text(value,px+half*.57,py+28,half*.40,47,{size:34,min:20,color});});section('key-levels',552,524);
 const abcY=1094,abcH=520,abcW=450,chartX=M+abcW+G,chartW=I-abcW-G;
 panel(M,abcY,abcW,abcH);text('📖 ABC 是這套分析的核心',M+16,abcY+14,abcW-32,42,{size:29,min:23});
 text('把股價的轉折分成三個角色，依序核對結構與轉折條件。',M+16,abcY+64,abcW-32,66,{size:23,min:19,bold:false});
 [['A（起漲點）','山頭起漲第一站，這一波的起點',tone.green],['B（前波高點）','前高壓力區，確認突破的機會',tone.orange],['C（回檔低點）','回檔確認，不破才保留結構',tone.blue]].forEach(([title,note,color],i)=>{text(title,M+18,abcY+144+i*70,abcW-36,30,{size:26,color});text(note,M+18,abcY+179+i*70,abcW-36,31,{size:20,min:17,bold:false});});
 [['A',st.A,st.s.fib.ADate,tone.green],['B',st.B,st.s.fib.BDate,tone.orange],['C',st.C,st.s.fib.CDate,tone.blue]].forEach(([label,value,date,color],i)=>{const py=abcY+362+i*39;panel(M+14,py,abcW-28,36,'#f8fbff');text(label,M+23,py+5,34,29,{size:28,color});text(price(value),M+70,py+7,210,27,{size:23,min:18,color});text(date||'待確認',M+284,py+10,142,24,{size:17,min:14,color:MUTED});});
 text(root.stockInfographicProgressV3329(st),M+16,abcY+485,abcW-32,29,{size:19,min:15});
 // The original chart is a verified rendering of this stock's OHLCV and ABC labels.
 const scale=source.width/1600;x.drawImage(source,560*scale,794*scale,1016*scale,520*scale,chartX,abcY,chartW,abcH);
 section('abc-chart',abcY,abcH);
 const bcY=1630,bcH=446;panel(M,bcY,half,bcH);panel(M+half+G,bcY,half,bcH);
 text('B. 明天三種走法｜看到什麼就怎麼做',M+16,bcY+14,half-32,42,{size:29,min:22});
 const scenarios=captured.scenarios?.length===3?captured.scenarios:[`續強：等完整日K站穩 ${price(L.observation)}，再檢查量價與風險。`,`整理：觀察 ${price(L.ma20)} 與支撐，未確認前先等。`,`轉弱：若跌破 ${price(L.coreDefense)}，依原防守計畫管理。`];
 scenarios.forEach((body,i)=>{const py=bcY+67+i*121,color=[tone.green,tone.orange,tone.red][i];panel(M+14,py,half-28,112,['#f0faf4','#fff8ed','#fff3f5'][i]);text(['✅ 怎樣才算轉強','▶ 如果繼續整理','✕ 哪裡跌破要退出'][i],M+28,py+9,half-56,31,{size:26,min:21,color});text(body,M+28,py+43,half-56,63,{size:21,min:16});});
 const cx=M+half+G;text('C. 詳細判斷依據｜想知道原因再看',cx+16,bcY+14,half-32,42,{size:29,min:22});
 text([...(captured.bullets||[]),...(captured.next||[])].map(v=>'• '+v).join('\n')||layer.evidenceEngine?.summary||'資料待核驗，先確認完成日K與行情來源。',cx+18,bcY+66,half-36,bcH-82,{size:23,min:17});section('scenarios-evidence',bcY,bcH);
 const dY=2093;text('D. 七項條件分｜盤前分數只供觀察，不代表現在可以執行',M,dY,I,42,{size:30,min:24});
 const metrics=captured.metrics||[],metricW=(I-4*G)/5;
 metrics.forEach((m,i)=>{const col=i<5?i:i-5,row=i<5?0:1,px=M+col*(metricW+G),py=dY+50+row*99;panel(px,py,metricW,91);x.fillStyle=tone[m.tone]||tone.blue;x.fillRect(px,py+8,4,75);text(m.title,px+12,py+7,metricW-24,32,{size:18,min:12,color:INK,line:1.1});const label=/目前不可執行|不適合執行/.test(m.value)?'目前不可執行':/分數可觀察/.test(m.value)?'分數可觀察':m.value;text(label,px+12,py+40,metricW-24,28,{size:21,min:12,line:1.1});const score=String(m.sub).match(/(?:條件分|背景條件分)?\s*\d+\s*[／/]\s*100/);text(score?.[0]||'依原條件核對',px+12,py+71,metricW-24,17,{size:14,min:10,color:MUTED,bold:false,line:1.1});});
 text('條件分不是勝率；行情、量能或資格未核驗時，保留原本的等待與風險提示。',M+2* (metricW+G),dY+161,I-2*(metricW+G),71,{size:22,min:18,color:MUTED});section('condition-scores',dY,240);
 const efY=2350,efH=294,ew=386,fx=M+ew+G,fw=I-ew-G;panel(M,efY,ew,efH);panel(fx,efY,fw,efH);
 text('E. 進階完整價位｜需要時再看',M+14,efY+12,ew-28,35,{size:25,min:19});
 const maps=captured.map||[],rows=maps.length||1,rowH=Math.min(24,238/rows);
 maps.forEach((m,i)=>{text(m.value,M+14,efY+52+i*rowH,145,rowH,{size:17,min:12,color:m.color||INK});text(m.label.split(/[｜|]/)[0],M+166,efY+52+i*rowH,ew-180,rowH,{size:16,min:11});});
 text('F. 歷史支撐壓力 × ABC × 三叉戟',fx+14,efY+12,fw-28,37,{size:27,min:22});
 const snr=layer.snrConfluenceEvidence,confluences=[snr?.supportConfluence,snr?.resistanceConfluence],small=(fw-40)/2;
 confluences.forEach((v,i)=>{const px=fx+14+i*(small+12);panel(px,efY+57,small,79,i?'#f6f1fc':'#eefaf0');text((i?'壓力 ':'支撐 ')+root.snrRangeTextV532(v)+'｜'+(v?.label||'待確認'),px+10,efY+67,small-20,31,{size:19,min:15,color:i?tone.purple:tone.green});text(root.snrDistanceTextV532(v),px+10,efY+103,small-20,26,{size:16,min:13,color:MUTED});});
 panel(fx+14,efY+148,small,132,'#f8fbff');text('☁ 記住口訣：',fx+24,efY+160,small-20,30,{size:25,min:20});text('A 起漲 → B 前高\nC 回檔 → 再突破 B\n＝完整 N 字確認',fx+24,efY+195,small-20,77,{size:23,min:18});
 panel(fx+26+small,efY+148,small,132,'#fff9ef');text('📍 現在位置／下一步',fx+36+small,efY+160,small-20,30,{size:23,min:18,color:tone.orange});text(`現價：${price(L.close)}\n20日線 ${price(L.ma20)}\n下一步：確認 ${price(L.observation)}`,fx+36+small,efY+196,small-20,75,{size:21,min:16});section('advanced-confluence',efY,efH);
 const footY=2656;x.fillStyle='#123b67';x.fillRect(M,footY,I,31);text('少爺助理｜公司、法人、主要成交價區',M+10,footY+4,I-20,26,{size:21,min:18,color:'#fff'});
 const assistant=report.shitoAssistantEvidence,poc=assistant?.anchoredVolumeProfileEvidence,third=(I-2*G)/3;
 const status=e=>({pass:'通過',fail:'未通過',unavailable:'資料不足',caution:'待觀察'})[e?.status]||e?.label||'資料待確認';
 [['公司營運',status(assistant?.operatingGateEvidence)],['法人買盤',status(assistant?.capitalGateEvidence)],['主要成交密集區（估算）',poc?.status==='pass'?`${poc.pocLower?.toFixed(2)}～${poc.pocUpper?.toFixed(2)} 元`:'資料待確認']].forEach(([title,value],i)=>{const px=M+i*(third+G);panel(px,footY+38,third,60);text(title,px+12,footY+44,third-24,24,{size:18,min:15});text(value,px+12,footY+70,third-24,22,{size:19,min:15,color:i===2?tone.blue:tone.orange});});
 text('V8.4｜盤後完成日K研究；條件分不是勝率，到價仍須確認，交易風險自負。',M,H-20,I,18,{size:14,min:12,color:MUTED,bold:false});section('assistant-footer',footY,H-footY);
 c.dataset.reportMode='professional';c.dataset.unifiedReport='true';c.dataset.iphoneFullScreen='1284x2778';c.dataset.fullBleed='true';c.dataset.reportText=encodeURIComponent(JSON.stringify(texts));
 c.dataset.layoutAudit=encodeURIComponent(JSON.stringify({version:'V8.4',template:'USER_REFERENCE_PROFESSIONAL',code:report.code||report.stock,date:report.closeDate,width:W,height:H,noOverlap:sections.every((s,i)=>!i||s.top>=sections[i-1].bottom),sections,metricCount:metrics.length,levelCount:levels.length,abc:{A:st.A,B:st.B,C:st.C},close:L.close,referenceLayout:true}));
 return c;
}
root.ShitouProfessionalV84=Object.freeze({render});root.renderStockProfessionalInfographicV51=render;
})(globalThis);
