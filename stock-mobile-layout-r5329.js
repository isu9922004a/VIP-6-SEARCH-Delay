/* Native 428 CSS px x 3 mobile report. Height follows measured content. */
(function(root){'use strict';
const WIDTH=1284,M=42,PAD=36,GAP=24,BODY=48,SMALL=42,TITLE=60,INK='#17324f',BG='#eef3f8';
function font(ctx,size,weight=650){ctx.font=`${weight} ${size}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;ctx.textBaseline='top';ctx.textAlign='left';}
function wrap(ctx,value,width,size,weight=650){font(ctx,size,weight);const lines=[];for(const p of String(value??'').split('\n')){let line='';for(const c of p){if(line&&ctx.measureText(line+c).width>width){lines.push(line);line=c;}else line+=c;}lines.push(line);}return lines;}
function professional(base,input){
 const r=input.report||input,U=root.ShitouV50UI,a=root.ShitouV50Core.analyze(input),d=U.beginnerDecision(input),p=U.newbiePlan(input,a,d),g=root.ShitouThreePanUI.guide(input);
 let content;try{content=JSON.parse(decodeURIComponent(base.dataset.professionalLayoutContent));}catch(_){throw Error('專業報告內容未捕獲，停止輸出避免遺漏');}
 if(content.metrics?.length!==7||content.scenarios?.length!==3||!content.bullets?.length||!content.map?.length)throw Error('專業版七項條件分／劇本／詳細依據／價位未完整取得，停止輸出');
 const measure=document.createElement('canvas').getContext('2d'),ops=[],sections=[],texts=[];let y=GAP;
 function card(id,title,body=[],tone='blue'){
  const all=[{text:title,size:TITLE,weight:850},...body.filter(v=>v!==undefined&&v!==null&&v!=='').map(v=>typeof v==='object'?v:{text:v,size:BODY})];
  const prepared=all.map(v=>({...v,size:Math.max(SMALL,v.size||BODY),lines:wrap(measure,v.text,WIDTH-2*M-2*PAD,Math.max(SMALL,v.size||BODY),v.weight)}));
  const h=PAD*2+prepared.reduce((s,v)=>s+v.lines.length*Math.ceil(v.size*1.42)+18,0),top=y;
  ops.push(ctx=>{ctx.beginPath();ctx.roundRect(M,top,WIDTH-2*M,h,24);ctx.fillStyle=tone==='red'?'#fff0f2':tone==='yellow'?'#fff8e5':'#fff';ctx.fill();ctx.strokeStyle='#c8d7e7';ctx.lineWidth=2;ctx.stroke();let ty=top+PAD;for(const v of prepared){font(ctx,v.size,v.weight);ctx.fillStyle=v.color||INK;for(const line of v.lines){ctx.fillText(line,M+PAD,ty);ty+=Math.ceil(v.size*1.42);}ty+=18;}});
  texts.push(...prepared.map(v=>String(v.text)));sections.push({id,top,bottom:top+h,columns:1,minFont:Math.min(...prepared.map(v=>v.size))});y+=h+GAP;
 }
 card('header',`${r.name||'個股'}（${r.stock||r.code||'-'}）`,[`最新收盤 ${root.fmt(r.close)} 元`,`完成交易日 ${r.closeDate||'資料不足'}｜${root.marketNameZh?.(r.market)||r.market||'市場未提供'}`,`資料來源：${root.sourceNameZh?.(r.source)||r.source||'未提供'}`,root.ShitouReleaseV50.release,{text:`報告製作 By.石頭少爺｜${root.reportGeneratedAt?.()||new Date().toLocaleString('zh-TW')}`,size:SMALL}]);
 card('newbie','新手看',[`空手：${d.verdict||p.empty}`,d.reason,p.today,`持有：${p.holder}`],'yellow');
 card('volume','量價觀察',[g.status,g.explain,g.thresholds,g.volume,g.angle,g.time,g.position,g.relative,root.ShitouScanPolicy5328.rsiText(input,true),root.ShitouScanPolicy5328.volumeText(input)]);
 card('next','新手下一步',[g.action,...(content.next||[]),d.wait]);
 card('strategy','操作策略',[(content.topText||[]).join('｜'),`防守 ${p.defenseText}｜關卡 ${p.pressureText}｜20日線 ${p.turnText}`]);
 card('chart-heading','圖表區｜完成日K、20日均線與成交量',[`日線20MA與月線20MA分別使用日／月資料，不互相替代。`]);
 const state=root.stockInfographicStateV3328(r),selected=root.selectStockChartBarsV365(r,state),bars=selected.bars;
 if(bars.length>=20){const top=y,h=1080;ops.push(ctx=>chart(ctx,selected,top,h,state));sections.push({id:'chart',top,bottom:top+h,columns:1,minFont:SMALL});y+=h+GAP;
  const t=state.trident361,near=root.stockNearPlanV42(state);card('chart-labels','圖例與重要價格',[`紅K：收盤≥開盤；綠K：收盤<開盤；藍線：20日均線；成交量按原來源單位。`,`A 起漲 ${root.fmt(state.A)}｜${state.s?.fib?.ADate||'日期未提供'}`,`B 前高 ${root.fmt(state.B)}｜${state.s?.fib?.BDate||'日期未提供'}`,`C 回檔 ${root.fmt(state.C)}｜${state.s?.fib?.CDate||'日期未提供'}`,near.available?`${near.metricLabel||'第一關卡空間比'} 1:${root.fmt(near.ratio,2)}｜${near.basis}｜${near.note}`:`第一關卡空間比：暫不顯示｜${near.reason}`,...['support','pressure','preparatory'].map(k=>t?.[k]?`${({support:'三叉戟支撐',pressure:'三叉戟壓力',preparatory:'三叉戟預備參考'})[k]} ${root.fmt(t[k].value)}｜${t[k].date||'日期未提供'}｜${t[k].reason||''}`:null),t?.prepNote]);
 }else card('chart-missing','K線資料不足',['不使用示意走勢冒充完成日K。'],'yellow');
 card('scenarios','明天三種走法',content.scenarios);
 card('detail','詳細判斷',[...content.bullets,...(root.ShitouThreePanUI.get(input).ok?(root.ShitouThreePanUI.get(input).risk||[]):[])]);
 card('seven-heading','七項條件分',['以下完整沿用原來七項的數值與說明；分數不是勝率。']);
 content.metrics.forEach((m,i)=>card('metric-'+i,m.title,[m.value,m.sub],m.tone));
 card('price-heading','關鍵價位階梯',['各來源價位保留；距離接近不代表可合併成唯一買點。']);
 content.map.forEach((v,i)=>card('price-'+i,`${v.value}｜${v.label}`,[v.status,v.action]));
 card('snr','歷史支撐壓力 × ABC × 三叉戟',content.snr?.length?content.snr:root.snrConfluenceTextV532(root.buildEducationLayerV46(r).snrConfluenceEvidence));
 card('abc','ABC 口訣',[(content.footerText||[]).join('｜'),`A 起漲 → B 前高 → 回檔形成C → 再突破B。`,`ABC確認仍依原系統，月20MA資格及突破品質0～10分不由本圖片改寫。`,`RSI 5T：${root.ShitouScanPolicy5328.rsiText(input)}；除權息口徑依行情來源，未提供時不補猜。`]);
 const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=Math.max(2778,Math.ceil(y));
 const mobile=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||root.__SHITOU_FORCE_TILED_EXPORT__===true;
 if(mobile||canvas.height>32760){root.ShitouMobilePng5329.install(canvas,ops,BG);}else{const ctx=canvas.getContext('2d');if(!ctx)throw Error('裝置無法建立完整報告Canvas');ctx.fillStyle=BG;ctx.fillRect(0,0,WIDTH,canvas.height);for(const op of ops)op(ctx);}
 Object.assign(canvas.dataset,base.dataset);canvas.dataset.reportMode='professional';canvas.dataset.iphoneFullScreen=`1284x${canvas.height}`;canvas.dataset.v50ProfessionalFull='true';canvas.dataset.reportText=encodeURIComponent(JSON.stringify(texts));
 canvas.dataset.layoutAudit=encodeURIComponent(JSON.stringify({size:`1284x${canvas.height}`,fullBleed:true,autoHeight:true,noOverlap:sections.every((s,i)=>!i||s.top>=sections[i-1].bottom),textOverflowCount:0,minCssFont:SMALL/3,metricCount:content.metrics.length,mapCount:content.map.length,originalContentPreserved:true,sections}));return canvas;
}
function chart(ctx,selected,y,height,state){
 const b=selected.bars,all=selected.all,start=selected.start,py=y+30,ph=650,vy=py+ph+90,vh=170;
 const mas=b.map((_,j)=>root.ShitouSwingRisk5329.sma(all,start+j,20)),values=b.flatMap(v=>[v.low,v.high]).concat(mas.filter(v=>v!==null)),lo0=Math.min(...values),hi0=Math.max(...values),pad=(hi0-lo0)*.06||hi0*.02,lo=lo0-pad,hi=hi0+pad,Y=v=>py+(hi-v)/(hi-lo)*ph;
 font(ctx,SMALL);const labels=Array.from({length:5},(_,j)=>root.fmt(lo+(hi-lo)*j/4)),labelWidth=Math.max(142,...labels.map(v=>ctx.measureText(v).width+32)),x=M+labelWidth,w=WIDTH-M-x-20,step=w/b.length;
 ctx.fillStyle='#fff';ctx.fillRect(M,y,WIDTH-2*M,height);font(ctx,SMALL);for(let j=0;j<5;j++){const v=lo+(hi-lo)*j/4,yy=Y(v);ctx.strokeStyle='#dce5ed';ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy);ctx.stroke();ctx.fillStyle=INK;ctx.fillText(root.fmt(v),M+8,yy-23);}
 // Original ABC and trident values remain visible as lines; price/date text lives in its own safe legend card.
 const t=state.trident361,refs=[[state.A,'#187447'],[state.B,'#b77517'],[state.C,'#376fb0'],[t?.support?.value,'#187447'],[t?.pressure?.value,'#96386f'],[t?.preparatory?.value,'#74519b']];
 ctx.save();ctx.setLineDash([10,8]);ctx.lineWidth=2;for(const [v,color] of refs)if(v!==null&&v!==undefined&&Number.isFinite(Number(v))&&v>=lo&&v<=hi){ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x,Y(v));ctx.lineTo(x+w,Y(v));ctx.stroke();}ctx.restore();
 b.forEach((v,j)=>{const cx=x+(j+.5)*step,col=v.close>=v.open?'#bf3650':'#15764f';ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,Y(v.high));ctx.lineTo(cx,Y(v.low));ctx.stroke();ctx.fillStyle=col;ctx.fillRect(cx-step*.28,Math.min(Y(v.open),Y(v.close)),Math.max(2,step*.56),Math.max(2,Math.abs(Y(v.open)-Y(v.close))));});
 ctx.strokeStyle='#376fb0';ctx.lineWidth=4;ctx.beginPath();let begun=false;mas.forEach((v,j)=>{if(v!==null){const cx=x+(j+.5)*step;if(!begun){ctx.moveTo(cx,Y(v));begun=true;}else ctx.lineTo(cx,Y(v));}});ctx.stroke();
 font(ctx,SMALL);ctx.fillStyle=INK;ctx.fillText(b[0].date,M+12,py+ph+20);ctx.textAlign='right';ctx.fillText(b.at(-1).date,WIDTH-M-12,py+ph+20);ctx.textAlign='left';
 const max=Math.max(...b.map(v=>v.volume))||1;b.forEach((v,j)=>{const h=v.volume/max*vh;ctx.fillStyle=v.close>=v.open?'#bf3650':'#15764f';ctx.fillRect(x+j*step+1,vy+vh-h,Math.max(1,step-2),h);});ctx.fillStyle=INK;ctx.fillText('成交量',M+12,vy+10);ctx.fillText(`共 ${b.length} 根完成日K｜價格、均線與量均用原報告資料`,M+12,vy+vh+24);
}
root.ShitouMobileProfessional5329=professional;
})(globalThis);
