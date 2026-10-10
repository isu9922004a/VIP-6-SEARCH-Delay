(function(root){'use strict';
const T=root.ShitouTeacherThreePan,C=root.ShitouV50Core;if(!T||!C)return;
const WIDTH=1284,HEIGHT=2778;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>typeof lastReportData!=='undefined'?lastReportData:null;
const get=input=>C.analyze(input).teacher;
const theme={ink:'#17324f',muted:'#3d536b',blue:'#244f78',red:'#aa2f48',green:'#15755e',yellow:'#926020'};
function wrap(ctx,s,w,size,weight=700){ctx.font=`${weight} ${size}px 'Microsoft JhengHei','Noto Sans TC',sans-serif`;const lines=[];for(const p of String(s??'').split('\n')){let line='';for(const ch of p){if(line&&ctx.measureText(line+ch).width>w){lines.push(line);line=ch;}else line+=ch;}lines.push(line);}return lines;}
function fit(ctx,s,x,y,w,h,max=25,min=18,color=theme.ink,weight=700){let lines,size=max;for(;size>=min;size--){lines=wrap(ctx,s,w,size,weight);if(lines.length*size*1.32<=h)break;}if(size<min)throw Error('文字超出安全區：'+String(s).slice(0,30));ctx.font=`${weight} ${size}px 'Microsoft JhengHei','Noto Sans TC',sans-serif`;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillStyle=color;lines.forEach((line,i)=>ctx.fillText(line,x,y+i*size*1.32));return lines.length*size*1.32;}
function box(ctx,x,y,w,h,title,body,tone='blue',options={}){
 const palette={red:['#fff1f2',theme.red],green:['#eef9f3',theme.green],yellow:['#fff8e6',theme.yellow],blue:['#ffffff',theme.blue]},p=palette[tone]||palette.blue;
 ctx.beginPath();ctx.roundRect(x,y,w,h,15);ctx.fillStyle=p[0];ctx.fill();ctx.strokeStyle='#cbd9e7';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=p[1];ctx.fillRect(x+1,y+14,5,h-28);
 const pad=options.pad||20,titleH=options.titleH||35;fit(ctx,title,x+pad,y+pad,w-2*pad,titleH,options.titleSize||28,options.titleMin||Math.min(18,Math.floor(titleH/1.32)),p[1],900);
 fit(ctx,Array.isArray(body)?body.join('\n'):body,x+pad,y+pad+titleH+8,w-2*pad,h-pad*2-titleH-8,options.size||24,options.min||18);
}
function crop(ctx,source,sx,sy,sw,sh,x,y,w,h){if(!(sw>0&&sh>0))throw Error('原報告保留區座標缺失');const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;ctx.drawImage(source,sx,sy,sw,sh,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
function relativeText(a){const r=a.relative;return r.stockVsMarket===null?'個股對大盤：同期間資料不足':`個股對大盤 ${T.fmt(r.stockVsMarket)} 個百分點（${r.period}）`;}
function strategyLines(a){return a.ok?[a.plain,`本次收盤 ${T.fmt(a.close)}／前兩日高 ${T.fmt(a.signal.high)}、低 ${T.fmt(a.signal.low)}。`,`較長背景：${a.longLabel}；${a.pattern.label}。`,`強勢資格：${a.formalEligible?'通過；下日執行仍需重查':'未通過；觀察與可進場分開'}。`,a.signal.key==='DOWN'?'波段跌破優先；不以量縮或仍在均線上解除。':a.exhaustion?'未創高且MV5退，停止新增強勢資格。':'量縮仍創高與量縮止漲分開追蹤。']:['資料不足：'+a.reason];}
function guide(input){const a=get(input);if(!a.ok)return {key:'DATA',icon:'⚪',status:'資料不足',explain:a.reason,action:'先補齊完成OHLCV與行情日期。',thresholds:'三盤關卡：資料不足',volume:'量潮：資料不足',angle:'角度：資料不足',time:'只用完成日K',position:'均線環境：資料不足',relative:'相對比較：資料不足',score:'不補猜分數',branches:[{title:'向上',text:'等待完成日K。'},{title:'區間',text:'資料不足不判盤整。'},{title:'向下',text:'仍依既有風控。'}],sourceDate:'資料不足'};
 return {key:a.signal.key==='DOWN'?'BREAKDOWN_CONFIRMED':a.formalEligible?'BREAKOUT_CONFIRMED':'NO_TURN',icon:a.signal.key==='DOWN'?'🔴':a.formalEligible?'🟢':'🟡',status:a.phaseLabel,explain:a.plain,action:a.formalEligible?'下日重新查價格與量潮；名單資格不等於開盤直接買。':'空手等待價格與攻擊量同步；持有追蹤波段退出條件。',thresholds:`本次前兩日高 ${T.fmt(a.signal.high)}／低 ${T.fmt(a.signal.low)}`,volume:`量潮：${a.volumePhase}；5 ${T.arrow(a.mvSlope[5])}／13 ${T.arrow(a.mvSlope[13])}／34 ${T.arrow(a.mvSlope[34])}`,angle:`角度：${a.angle}`,time:'完成日K；未完成波段不作已完成比較。',position:`價格背景：${a.longLabel}；三盤波段另判。`,relative:relativeText(a),score:`工程條件覆蓋 ${a.completeness}/6（不是勝率）`,sourceDate:a.date,branches:[{title:'向上突破',text:`下一根收盤 > ${T.fmt(a.next.high)}，另查攻擊量與較大潮。`},{title:'區間內',text:'無新三盤不等於盤整；須波段收斂與量能佐證。'},{title:'向下跌破',text:`下一根收盤 < ${T.fmt(a.next.low)}，更新波段風控。`}]};
}
function professional(base,input){
 const source=root.ShitouV50UI.compactPreviousCards(base),a=get(input),canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;const ctx=canvas.getContext('2d');ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,WIDTH,HEIGHT);
 let audit={},content={};try{audit=JSON.parse(decodeURIComponent(source.dataset.layoutAudit));content=JSON.parse(decodeURIComponent(source.dataset.professionalLayoutContent));}catch(e){throw Error('原版報告區塊資料缺失，停止輸出避免遺漏');}
 const s=audit.sections,M=28,G=8,inner=1228,k=source.width/1600,oldX=24*k,oldW=source.width-48*k,bodyTop=158*k,bcTop=1334*k,sections=[];
 const mark=(id,top,bottom,role)=>sections.push({id,top,bottom,role});
 crop(ctx,source,0,0,source.width,bodyTop,0,0,WIDTH,132);mark('header-original',0,132,'preserved');
 const d=root.ShitouV50UI.beginnerDecision(input),p=root.ShitouV50UI.newbiePlan(input,C.analyze(input),d),g=guide(input);
 box(ctx,M,140,inner,164,'新手先看｜三盤波段與原進場條件｜'+root.ShitouScanPolicy5328.rsiText(input),[
  a.ok?`${a.phaseLabel}｜${a.formalEligible?'量價波段資格通過；仍查原進場條件':'本次未取得強勢資格'}`:a.reason,
  `空手：${d.verdict}｜${a.ok?a.plain:d.reason}`,
  `已持有：${a.ok&&a.signal.key==='DOWN'?'三盤退出／風控訊號已成立':p.holder}`
 ],a.ok&&a.signal.key==='DOWN'?'red':'yellow',{size:21,min:15,titleSize:24,titleH:28,pad:12});mark('decision',140,304,'updated');
 fit(ctx,'教材量價觀察｜三盤、波段、量潮分開判',M,312,inner,28,24,19,theme.ink,900);
 const leftW=688;box(ctx,M,344,leftW,94,g.status,[g.explain,g.thresholds],a.ok&&a.signal.key==='DOWN'?'red':'yellow',{size:16,min:12,titleSize:18,titleH:22,pad:10});box(ctx,M+leftW+G,344,inner-leftW-G,94,'下一步｜訊號與執行分開',[g.action,g.score],'blue',{size:15,min:12,titleSize:18,titleH:22,pad:10});
 const bw=(inner-2*G)/3;g.branches.forEach((x,i)=>box(ctx,M+i*(bw+G),446,bw,98,x.title,x.text,['green','yellow','red'][i],{size:16,min:12,titleSize:18,titleH:22,pad:10}));
 const half=(inner-G)/2;box(ctx,M,552,half,110,'量價時間與角度',[g.volume,g.angle,g.time],'blue',{size:15,min:11,titleSize:18,titleH:22,pad:10});box(ctx,M+half+G,552,half,110,'環境與相對比較',[g.position,g.relative,`資料日 ${g.sourceDate}`],'blue',{size:15,min:11,titleSize:18,titleH:22,pad:10});mark('guide',312,662,'updated');
 crop(ctx,source,oldX,bodyTop,oldW,bcTop-bodyTop,M,670,inner,880);mark('A-chart-original',670,1550,'preserved');
 // B完整像素保留，C只換右欄；不依賴原版文字擷取是否包含研究卡。
 const col=(inner-G)/2;if(content.scenarios?.length===3){const bLines=[];content.scenarios.forEach((value,i)=>bLines.push(['怎樣才算轉強','如果繼續整理','哪裡跌破要退出'][i]+'：'+value));bLines.push('以上可進／續抱／減碼／退出僅為技術條件的白話風控，不保證漲跌，交易風險仍需自負。');box(ctx,M,1558,col,330,'B. 明天三種走法｜原內容',bLines,'blue',{size:20,min:12,titleSize:24,titleH:32,pad:14});}else crop(ctx,source,24*k,bcTop,760*k,780*k,M,1558,col,330);mark('B-original',1558,1888,'preserved');
 box(ctx,M+col+G,1558,col,330,'C. 三盤與波段戰法',[...strategyLines(a),root.ShitouScanPolicy5328.rsiText(input,true),root.ShitouScanPolicy5328.volumeText(input)],a.ok&&a.signal.key==='DOWN'?'red':'blue',{size:21,min:16,titleSize:26,titleH:34,pad:18});mark('C-teacher',1558,1888,'replaced');
 const dSourceTop=s.dTitleTop-42*k;crop(ctx,source,oldX,dSourceTop,oldW,s.efTop-dSourceTop,M,1896,inner,212);mark('D-seven-metrics-original',1896,2108,'preserved');
 fit(ctx,'E. 量潮接力與波段應變',M,2116,inner,34,27,20,theme.ink,900);
 const eLeft=a.ok?[`MA8 ${T.fmt(a.ma[8])}${T.arrow(a.maSlope[8])}／MA21 ${T.fmt(a.ma[21])}${T.arrow(a.maSlope[21])}／MA55 ${T.fmt(a.ma[55])}${T.arrow(a.maSlope[55])}`,`MV5 ${T.arrow(a.mvSlope[5])}／MV13 ${T.arrow(a.mvSlope[13])}／MV34 ${T.arrow(a.mvSlope[34])}：${a.volumePhase}`,a.angle]:[a.reason];
 const eRight=a.ok?[`下根向上 > ${T.fmt(a.next.high)}／向下 < ${T.fmt(a.next.low)}（完成收盤）`,relativeText(a),`型態：${a.pattern.label}；${a.pattern.plain}`,`依據：PDF 19、38、57–58、67、85–103；上集49:28。分段／三日止漲是工程約定。`]:['資料不足，不生成判斷。'];
 box(ctx,M,2158,col,250,'量價與角度',eLeft,'blue',{size:21,min:16,titleH:31,pad:16});box(ctx,M+col+G,2158,col,250,'條件與依據',eRight,'blue',{size:21,min:15,titleH:31,pad:16});mark('E-teacher',2116,2408,'replaced');
 if(content.snr?.length===8){const f=content.snr;box(ctx,M,2416,inner,190,f[0],[],'blue',{titleSize:24,titleH:28,pad:12});fit(ctx,[f[1],f[2]].join('\n'),M+14,2458,col-28,58,17,12);fit(ctx,[f[3],f[4]].join('\n'),M+col+G+14,2458,col-28,58,17,12);fit(ctx,f[5],M+14,2522,inner-28,22,16,12);fit(ctx,f[6],M+14,2550,col-28,44,16,12);fit(ctx,f[7],M+col+G+14,2550,col-28,44,16,12);}else crop(ctx,source,oldX,s.footerCutTop,oldW,310,M,2416,inner,190);mark('F-original',2416,2606,'preserved');
 const footerFrom=Math.min(source.height,s.footerCutTop+310);crop(ctx,source,oldX,footerFrom,oldW,source.height-footerFrom,0,2614,WIDTH,164);mark('footer-original',2614,2778,'preserved');
 Object.assign(canvas.dataset,source.dataset);canvas.dataset.reportMode='professional';canvas.dataset.teacherThreePan='true';canvas.dataset.iphoneFullScreen='1284x2778';canvas.dataset.teacherText=T.text({...input,report:input.report||input});
 canvas.dataset.layoutAudit=encodeURIComponent(JSON.stringify({size:'1284x2778',noOverlap:true,textOverflowCount:0,sections,preserved:['header','A','chart','B','D','F','footer'],replaced:['C','E'],metricCount:content.metrics?.length||0,fullBleed:true,sourceSize:`${source.width}x${source.height}`}));return canvas;
}
function chart(ctx,b,x,y,w,h){
 const data=b.slice(-60),start=b.length-data.length,maValues=data.flatMap((r,j)=>[8,21,55].map(n=>T.sma(b,'close',n,start+j+1)).filter(v=>v!==null)),min=Math.min(...data.map(r=>r.low),...maValues),max=Math.max(...data.map(r=>r.high),...maValues),pad=(max-min)*.06||max*.01,lo=min-pad,hi=max+pad,Y=v=>y+(hi-v)/(hi-lo)*h,step=w/data.length;
 ctx.fillStyle='#fff';ctx.fillRect(x,y,w,h);for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3,yy=Y(v);ctx.strokeStyle='#e2e9f1';ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy);ctx.stroke();fit(ctx,T.fmt(v),x+5,i===3?yy+3:yy-25,100,26,19,16,theme.muted);}
 const maColors={8:'#c18835',21:'#487ec0',55:'#8a62ad'};
 for(const n of [8,21,55]){ctx.beginPath();ctx.strokeStyle=maColors[n];ctx.lineWidth=2.5;let began=false;data.forEach((r,j)=>{const v=T.sma(b,'close',n,start+j+1);if(v!==null){const xx=x+(j+.5)*step;if(!began){ctx.moveTo(xx,Y(v));began=true;}else ctx.lineTo(xx,Y(v));}});ctx.stroke();}
 data.forEach((r,j)=>{const xx=x+(j+.5)*step,color=r.close>=r.open?'#c94860':'#188574';ctx.strokeStyle=color;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(xx,Y(r.high));ctx.lineTo(xx,Y(r.low));ctx.stroke();ctx.fillStyle=color;ctx.fillRect(xx-step*.23,Math.min(Y(r.open),Y(r.close)),step*.46,Math.max(3,Math.abs(Y(r.open)-Y(r.close))));});
 fit(ctx,'MA8 金／MA21 藍／MA55 紫｜最近60根完成K',x,y+h+8,w,30,23,18,theme.muted);
 const volMax=Math.max(...data.map(r=>r.volume))||1,vy=y+h+48,vh=90;data.forEach((r,j)=>{ctx.fillStyle=r.close>=r.open?'#c94860':'#188574';const hh=r.volume/volMax*vh;ctx.fillRect(x+j*step+2,vy+vh-hh,Math.max(2,step-4),hh);});
 fit(ctx,'成交量（股）｜'+root.ShitouScanPolicy5328.volumeText({dailySeries:b,closeDate:b.at(-1).date}),x,vy+vh+6,w,28,21,18,theme.muted);
}
function render(input){
 const a=get(input),r=input.report||input,canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;const ctx=canvas.getContext('2d'),sections=[];ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,WIDTH,HEIGHT);
 ctx.fillStyle='#15344e';ctx.fillRect(0,0,WIDTH,186);fit(ctx,`${r.name||'個股'}（${r.code||r.stock||'-'}）｜三盤趨勢`,42,25,1200,78,40,22,'#fff',900);fit(ctx,`量價波段分析｜完成日K｜資料日 ${a.date||'不足'}｜${root.ShitouScanPolicy5328.rsiText(r)}`,42,121,1200,38,25,19,'#c8dbe9');
 if(!a.ok){box(ctx,36,210,1212,250,'資料不足，暫停三盤判讀',[a.reason,root.ShitouScanPolicy5328.rsiText(r,true),root.ShitouScanPolicy5328.volumeText(r),'補齊完成OHLCV與相同資料日後再產生報告。'],'yellow');canvas.dataset.layoutAudit=encodeURIComponent(JSON.stringify({size:'1284x2778',noOverlap:true,dataBlocked:true}));return canvas;}
 const M=36,W=1212,G=16,H=(W-G)/2,mark=(id,top,bottom)=>sections.push({id,top,bottom});
 box(ctx,M,208,W,220,`${a.phaseLabel}｜收盤 ${T.fmt(a.close)}`,[a.plain,`強勢名單資格：${a.formalEligible?'通過；實際進場仍需重查':'未通過；分數不能解除失效或等待'}。`,`${a.longLabel}；${a.pattern.label}。 ${root.ShitouScanPolicy5328.rsiText(r,true)}`],a.signal.key==='DOWN'?'red':a.formalEligible?'green':'yellow',{titleSize:34,titleH:47,size:27,min:23});mark('verdict',208,428);
 box(ctx,M,444,H,168,'本次三盤關卡',[`前兩日高 ${T.fmt(a.signal.high)}／低 ${T.fmt(a.signal.low)}`,`${a.signalLabel}；相等不算。`],'blue',{size:25,min:22});
 box(ctx,M+H+G,444,H,168,'下一根三盤關卡',[`向上 > ${T.fmt(a.next.high)}／向下 < ${T.fmt(a.next.low)}`,`由今日＋昨日更新，僅以完成收盤確認。`],'blue',{size:25,min:21});mark('levels',444,612);
 box(ctx,M,628,W,708,'K線・教材均線・成交量',[],'blue');chart(ctx,a.bars,M+22,690,W-44,426);mark('chart',628,1336);
 box(ctx,M,1352,H,228,'價格環境｜8／21／55',[`MA8 ${T.fmt(a.ma[8])}${T.arrow(a.maSlope[8])}`,`MA21 ${T.fmt(a.ma[21])}${T.arrow(a.maSlope[21])}`,`MA55 ${T.fmt(a.ma[55])}${T.arrow(a.maSlope[55])}`,a.longLabel],'blue',{size:26,min:22});
 box(ctx,M+H+G,1352,H,228,'量潮｜5／13／34',[`MV5 ${T.fmt(a.mv[5])}${T.arrow(a.mvSlope[5])}`,`MV13 ${T.fmt(a.mv[13])}${T.arrow(a.mvSlope[13])}`,`MV34 ${T.fmt(a.mv[34])}${T.arrow(a.mvSlope[34])}`,a.volumePhase],'blue',{size:26,min:21});mark('environment',1352,1580);
 box(ctx,M,1596,W,200,'波段・角度・型態',[a.angle,a.pattern.plain,`完成波段 ${a.waves.completed.length} 段；極值發生日與換向確認日分開記錄。`],'blue',{size:25,min:22});mark('waves',1596,1796);
 box(ctx,M,1812,H,204,'空手｜資格與買點分開',[a.formalEligible?'列入下日條件重查，核對量潮及價格能否持續。':'等待新三盤向上與攻擊量再起。','止跌或無新訊號，不直接代表起漲。'],'yellow',{size:25,min:22});
 box(ctx,M+H+G,1812,H,204,'持有｜波段退出條件',[a.signal.key==='DOWN'?'三盤跌破已成立；檢查原波段退出與風控執行。':a.exhaustion?'未創高且攻擊量退，已出現止漲預警。':'持續追蹤一破二、量退且不再創高。','日K不還原盤中委買賣或成交價。'],'red',{size:25,min:22});mark('actions',1812,2016);
 box(ctx,M,2032,W,248,'下一根完成日K｜三種情境',[`向上：收盤 > ${T.fmt(a.next.high)}，新三盤訊號；另查量潮接力。`,`區間：${T.fmt(a.next.low)}～${T.fmt(a.next.high)}，沒有新三盤；盤整需結構佐證。`,`向下：收盤 < ${T.fmt(a.next.low)}，更新波段風控。`,`未來收盤尚未知；三日未創高為工程止漲預警。`],'blue',{size:27,min:24});mark('next',2032,2280);
 box(ctx,M,2296,W,210,'相對強弱與資料完整性',[relativeText(a),`產業對大盤：${a.relative.industryVsMarket===null?'同日資料不足':T.fmt(a.relative.industryVsMarket)+' 個百分點（僅產業背景）'}`,`條件覆蓋 ${a.completeness}/6；原始量校正：${r.volumeAudit?.note||'本次使用日K來源成交量'}。`],'blue',{size:25,min:22});mark('relative-quality',2296,2506);
 box(ctx,M,2522,W,166,'來源與方法',[`PDF 19、38、57–58、67、85–103、113–156；上集49:28–50:14。`,`分段端點、百分比／根數及止漲預警為工程約定，尚需歷史績效驗證。`],'blue',{size:23,min:20,titleSize:26,titleH:32,pad:16});mark('sources',2522,2688);
 ctx.fillStyle='#15344e';ctx.fillRect(0,2704,WIDTH,74);fit(ctx,`石頭少爺｜三盤量價版｜不是勝率或保證獲利｜${a.date}`,M,2724,W,35,24,20,'#d9e7f1');mark('footer',2704,2778);
 canvas.dataset.reportMode='three-pan';canvas.dataset.iphoneFullScreen='1284x2778';canvas.dataset.reportText=T.text(input);canvas.dataset.teacherDataDate=a.date;canvas.dataset.teacherPhase=a.phase;
 canvas.dataset.layoutAudit=encodeURIComponent(JSON.stringify({size:'1284x2778',fullBleed:true,noOverlap:sections.every((s,i)=>!i||s.top>=sections[i-1].bottom),textOverflowCount:0,sections}));return canvas;
}
let activeReport=null;
function mount(input){activeReport=input;const target=document.getElementById('stockReportActionsPanel');if(!target)return;let panel=document.getElementById('teacherThreePanPanel');if(!panel){panel=document.createElement('section');panel.id='teacherThreePanPanel';panel.className='v50-panel';}if(panel.parentElement!==target||target.lastElementChild!==panel)target.appendChild(panel);
 const a=get(input);panel.innerHTML=`<div class="v50-title">三盤分析專區</div><p>${esc(a.ok?a.phaseLabel:a.reason)}</p><p>${esc(a.ok?a.plain:'補齊資料後再分析。')}</p><div class="copy-actions"><button type="button" class="copy-btn image-btn" id="generateThreePanImageButton" ${a.ok?'':'disabled'}>一鍵生成三盤圖片｜iPhone 12 Pro Max</button><button type="button" class="copy-btn watermark-image-btn" id="generateThreePanWatermarkImageButton" ${a.ok?'':'disabled'}>生成一鍵生成三盤圖片分析報告(防盜浮水印)</button><button type="button" class="copy-btn" id="copyThreePanReportButton">一鍵複製三盤文字</button></div><p id="threePanMessage" role="status" aria-live="polite"></p><pre style="white-space:pre-wrap;line-height:1.7;font-size:14px;max-height:440px;overflow:auto">${esc(T.text(input))}</pre>`;
 panel.querySelector('#generateThreePanImageButton').onclick=generate;panel.querySelector('#generateThreePanWatermarkImageButton').onclick=generateWatermark;panel.querySelector('#copyThreePanReportButton').onclick=copy;
}
function selected(){const r=current();if(r&&(!activeReport||r!==(activeReport.report||activeReport)))return r;return activeReport||r;}
async function generate(){const r=selected(),message=document.getElementById('threePanMessage'),button=document.getElementById('generateThreePanImageButton');if(!r){if(message)message.textContent='請先完成個股分析。';return;}if(button)button.disabled=true;try{const c=render(r),a=get(r);if(!a.ok)throw Error(a.reason);await root.showInfographicPreviewV3328(c,root.sanitizeFilenameV3328(`石頭少爺_${(r.report||r).code||(r.report||r).stock}_三盤趨勢_${a.date}_R5328.png`),'三盤趨勢分析｜1284×2778 滿版');if(message)message.textContent='圖片已生成，可儲存 PNG 或分享。';}catch(e){if(message)message.textContent='生成未完成：'+e.message;}finally{if(button)button.disabled=false;}}
async function generateWatermark(){const r=selected(),message=document.getElementById('threePanMessage'),button=document.getElementById('generateThreePanWatermarkImageButton');if(!r){if(message)message.textContent='請先完成個股分析。';return;}if(button)button.disabled=true;try{const c=render(r),a=get(r);if(!a.ok)throw Error(a.reason);root.applyAntiTheftWatermarkV3761(c,'stock');c.dataset.watermark='enabled';await root.showInfographicPreviewV3328(c,root.sanitizeFilenameV3328(`石頭少爺_${(r.report||r).code||(r.report||r).stock}_三盤趨勢_${a.date}_R5328_防盜浮水印版.png`),'三盤趨勢分析｜1284×2778 滿版｜防盜浮水印版');if(message)message.textContent='防盜浮水印圖片已生成，可儲存 PNG 或分享。';}catch(e){if(message)message.textContent='生成未完成：'+e.message;}finally{if(button)button.disabled=false;}}
async function copy(){const r=selected(),message=document.getElementById('threePanMessage');if(!r){if(message)message.textContent='請先完成個股分析。';return;}try{const text=T.text(r);if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(!ok)throw Error('瀏覽器未允許複製，請從下方文字選取複製');}if(message)message.textContent='三盤文字報告已複製。';}catch(e){if(message)message.textContent='複製未完成：'+e.message;}}
root.ShitouThreePanUI=Object.freeze({WIDTH,HEIGHT,get,guide,professional,render,mount,generate,generateWatermark,copy,fit,box});
root.renderThreePanStockInfographic=render;root.buildThreePanStockReportText=T.text;
if(typeof root.renderBeginnerCommandCenterV46==='function'){const old=root.renderBeginnerCommandCenterV46;root.renderBeginnerCommandCenterV46=function(report,...rest){const result=old(report,...rest);mount(report);return result;};}
// 最後載入，沿用原預覽／下載／浮水印流程，只替換專業排版。
document.title=root.ShitouReleaseV50.release;document.documentElement.dataset.releaseVersion=root.ShitouReleaseV50.release;
document.querySelectorAll('.version-pill,footer strong').forEach(el=>el.textContent=root.ShitouReleaseV50.release);
if(current())mount(current());
})(typeof window!=='undefined'?window:globalThis);
