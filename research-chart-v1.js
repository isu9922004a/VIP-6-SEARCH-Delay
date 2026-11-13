/* Draw only precomputed, dated research evidence. Rendering never changes a signal. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./research-beginner-v1.js'):root.ShitouResearchBeginner);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouResearchChart=api;})(globalThis,function(B){
'use strict';
const Copy=typeof module==='object'&&module.exports?require('./report-beginner-copy-v88.js'):globalThis.ShitouReportCopyV88;
const Layout=typeof module==='object'&&module.exports?require('./research-chart-layout-v921.js'):globalThis.ShitouChartLayout921;
const explain=value=>Layout.plain(Copy?Copy.line(value):String(value??''));
const VERSION='RESEARCH_CHART_8_2_9',W=1284,H=2778;
const fmt=x=>Number.isFinite(x)?String(+x.toFixed(2)):'待核';
function page(a,{document:doc=globalThis.document,displayCode=globalThis.ShitouReleaseV50?.displayCode||'V9.3',watermark=false}={}){
 const V=globalThis.ShitouElliottVisual||(typeof module==='object'&&module.exports?require('./elliott-wave-visual-v1.js'):null),wave=null;const measure=wave?doc.createElement('canvas').getContext('2d'):null,extra=wave?Math.ceil(V.linesFor(wave).reduce((sum,l)=>sum+V.wrap(measure,l,W-136,34).length*34*1.45+14,38)):0,waveGap=wave?40:0,PAGE_H=H+extra+waveGap;
 const u=a?.unifiedResearch,n=a?.nContinuation,d=u?.state==='RESEARCH_ONLY'?u.chart:n?.state==='RESEARCH_ONLY'?n.chart:null;if(!d?.bars?.length)return null;
 const bars=d.bars.slice(-80),start=bars[0].index,end=bars.at(-1).index,patterns=d.patterns.filter(x=>x.type==='DOUBLE_BOTTOM'?x.points.some(v=>v.index>=start):x.endIndex>=start).slice(0,2);
 const guide=B.chartContext(a,d);
 const shown=[{title:'往上先看',price:d.trigger,color:'#f6cf65',solid:false},{title:'原看法重查價',price:d.invalidation,color:'#ff858f',solid:true},{title:'往下先看',price:d.defenseReference,color:'#8dc9c2',solid:false},{title:'最近壓力（上方關卡）',price:d.nextResistance?.price,color:'#d6aeff',solid:false}];
 const patternLevels=patterns.flatMap((p,i)=>p.type==='DOUBLE_BOTTOM'&&Number.isFinite(p.neckline)&&p.neckline>0?[{id:'P'+(i+1),title:'雙底頸線',price:p.neckline,color:p.status==='CONFIRMED'?'#71efd1':'#f0bf71'}]:[]);
 const nq=n?.pattern,nOverlay=nq?{id:nq.id,stage:nq.stage,knownAt:nq.knownAt,points:['A','B','C'].map(key=>({key,...nq[key],visible:nq[key].index>=start})),projection:{...nq.projection}}:null;
 const audit={code:a.code,date:a.date,sourceSnapshotId:a.sourceSnapshotId,schemaVersion:u?.schemaVersion||n?.version||VERSION,chartVersion:VERSION,section:'STRUCTURE_CHART',width:W,height:PAGE_H,noClipping:true,barCount:bars.length,firstDate:bars[0].date,lastDate:bars.at(-1).date,priceBasis:d.priceBasis,volumeStatus:d.volume.status,entryDirection:a.entryDirection||null,nContinuation:nOverlay,beginnerGuide:guide,
  life03:null,
  levels:shown.map(x=>({title:x.title,price:x.price??null})),patterns:patterns.map(x=>({type:x.type,status:x.status,formedAt:x.formedAt,confirmedAt:x.confirmedAt})),fields:shown.map(x=>({title:x.title,value:fmt(x.price)})),note:'虛線為參考／形成中；無已確認進場情境則不畫失效線；所有型態為未驗證績效的研究'};
 const measurement=doc.createElement('canvas').getContext('2d')||{measureText:t=>({width:[...String(t)].length*34})};
 const body=Layout.blocks(measurement,[
  {title:'往上看哪裡？往下注意哪裡？｜元',value:shown.map((v,i)=>`${i+1} ${v.title}｜${Number.isFinite(v.price)&&v.price>0?v.price.toFixed(2)+' 元':'尚未確認'}\n${guide.levels[i].explanation}`).join('\n')},
  {title:'目前這段走勢怎麼看？',value:guide.stage+'。\n'+guide.points},
  ...(patterns.length?[{title:'圖上其他線條是什麼？',value:patterns.map((p,i)=>'P'+(i+1)+' '+(p.type==='DOUBLE_BOTTOM'?'兩次低點後的上方關卡（雙底頸線）｜'+fmt(p.neckline)+' 元':'價格上下邊界逐漸靠近（收斂型態）')+'｜'+Layout.patternState(p.status)+'｜成立 '+(p.formedAt||'尚未確認')).join('\n')}]:[]),
  {title:'接下來要等什麼？',value:[a.entryDirection?.reason,...(a.entryDirection?.signals||[]).map(s=>s.explanation)].filter(Boolean).join('\n')||'等當天收盤，再核對研究條件；盤中碰到價位還不算確認。'},
  {title:'哪些情況要小心？',value:[...(a.risks||[]),guide.projection,guide.volume.caution].join('\n')},
  {title:'資料怎麼核對？',value:`已收盤行情 ${a.date}｜${d.basisVerified?'價格計算方式已核對':'價格計算方式還沒確認'}｜${d.volume.status==='CONFLICT'?'成交量來源數字不同，先不下結論':d.volume.usable?'日K成交量來源已核對':'成交量來源還沒核對'}\n${guide.volume.ratio}\nA/B/C 是三個價格轉折點；生命線請看另一張圖片。模型對未來的估計，和已成交的行情分開看；還沒驗證能否獲利。\n紅色K棒：收盤不低於開盤；綠色K棒：收盤低於開盤。`}
 ].map(item=>({...item,value:Layout.plain(item.value)})),{top:1740});
 const totalHeight=Math.max(PAGE_H,body.at(-1).top+body.at(-1).height+170);audit.height=totalHeight;audit.fields=shown.map(x=>({title:x.title,value:Number.isFinite(x.price)&&x.price>0?x.price.toFixed(2)+' 元':'尚未確認'}));audit.body=body;
 const dataset={researchAudit:JSON.stringify(audit),fullBleed:'true',shareAsSingleImage:'true',release:displayCode};
 function paint(ctx){
  ctx.fillStyle='#102235';ctx.fillRect(0,0,W,totalHeight);
  function text(value,x,y,size=42,color='#f2f7ff',max=W-128){value=explain(value);ctx.font=`650 ${size}px "Microsoft JhengHei",sans-serif`;while(ctx.measureText(String(value)).width>max&&size>28){size--;ctx.font=`650 ${size}px "Microsoft JhengHei",sans-serif`;}ctx.fillStyle=color;ctx.fillText(String(value),x,y);}
  function wrapped(value,x,y,width,size=40,line=55){ctx.font=`650 ${size}px "Microsoft JhengHei",sans-serif`;let row='',n=0;for(const ch of explain(value)){if(row&&ctx.measureText(row+ch).width>width){text(row,x,y+n*line,size,'#bcd1e2',width);row=ch;n++;}else row+=ch;}if(row)text(row,x,y+n*line,size,'#bcd1e2',width);return y+(n+1)*line;}
  ctx.fillStyle='#1b3c59';ctx.fillRect(40,35,W-80,225);
  text('石頭少爺 '+displayCode+'｜結構證據圖',68,100,46);
  text(`${a.name}（${a.code}）`,68,180,66);
  text(`已收盤行情 ${a.date}｜一根K棒代表一天`,68,235,36,'#bcd1e2');
  text(a.entryDirection?.state==='RESEARCH_ONLY'?a.entryDirection.direction.label+'｜'+a.entryDirection.label:'先看現在能否評估，再看哪些價位要留意',68,320,39,'#ffdc8c');
  for(const [i,[label,color]] of [['5日平均價 MA5','#f6cf65'],['20日平均價 MA20','#65c5f2'],['60日平均價 MA60','#c1a0ff']].entries())text(label,68+i*395,389,36,color);
  const x0=160,y0=435,pw=1010,ph=800,vy=1335,vh=220,dx=pw/bars.length;
  const raw=[...bars.flatMap(x=>[x.low,x.high,x.ma5,x.ma20,x.ma60]),...[...shown,...patternLevels].filter(x=>x.price>0).map(x=>x.price)].filter(Number.isFinite),rawMin=Math.min(...raw),rawMax=Math.max(...raw),pad=Math.max((rawMax-rawMin)*.08,rawMax*.01),min=rawMin-pad,max=rawMax+pad;
  const xp=index=>x0+(index-start+.5)*dx,yp=price=>y0+ph-(price-min)/(max-min)*ph;
  const maxV=Math.max(...bars.map(x=>x.volume)),vp=v=>vy+vh-v/maxV*vh;
  ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=y0+ph*i/5;ctx.strokeStyle='#2d485c';ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+pw,y);ctx.stroke();text(fmt(max-(max-min)*i/5),10,y+12,28,'#a8c6db',72);}
  ctx.save();ctx.beginPath();ctx.rect(x0,y0,pw,ph);ctx.clip();
  for(const b of bars){const x=xp(b.index),color=b.close>=b.open?'#f26370':'#42ca9b';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(1,dx*.16);ctx.beginPath();ctx.moveTo(x,yp(b.high));ctx.lineTo(x,yp(b.low));ctx.stroke();ctx.fillRect(x-dx*.31,Math.min(yp(b.open),yp(b.close)),Math.max(2,dx*.62),Math.max(2,Math.abs(yp(b.open)-yp(b.close))));}
  for(const [key,color] of [['ma5','#f6cf65'],['ma20','#65c5f2'],['ma60','#c1a0ff']]){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();let pen=false;for(const b of bars){if(!Number.isFinite(b[key])){pen=false;continue;}if(pen)ctx.lineTo(xp(b.index),yp(b[key]));else{ctx.moveTo(xp(b.index),yp(b[key]));pen=true;}}ctx.stroke();}
  for(const item of shown.filter(x=>Number.isFinite(x.price)&&x.price>0)){ctx.strokeStyle=item.color;ctx.lineWidth=2.5;ctx.setLineDash(item.solid?[]:[12,9]);ctx.beginPath();ctx.moveTo(x0,yp(item.price));ctx.lineTo(x0+pw,yp(item.price));ctx.stroke();}
  for(const pattern of patterns){ctx.strokeStyle=pattern.status==='CONFIRMED'?'#71efd1':'#f0bf71';ctx.lineWidth=4;ctx.setLineDash(pattern.status==='CONFIRMED'?[]:[10,7]);
   if(pattern.type==='DOUBLE_BOTTOM'){ctx.beginPath();pattern.points.forEach((point,i)=>i?ctx.lineTo(xp(point.index),yp(point.price)):ctx.moveTo(xp(point.index),yp(point.price)));ctx.stroke();ctx.beginPath();ctx.moveTo(xp(pattern.points[0].index),yp(pattern.neckline));ctx.lineTo(x0+pw,yp(pattern.neckline));ctx.stroke();}
   else for(const line of [pattern.top,pattern.bottom]){const from=Math.max(start,pattern.startIndex);ctx.beginPath();ctx.moveTo(xp(from),yp(line.intercept+line.slope*from));ctx.lineTo(xp(end),yp(line.intercept+line.slope*end));ctx.stroke();}
  }
  if(nOverlay){
   const color=['INVALIDATED','AMBIGUOUS','WAIT_NEW_C','RETEST_FAILED'].includes(nq.stage)?'#ff929c':'#ffd76d';ctx.strokeStyle=color;ctx.lineWidth=4;ctx.setLineDash(nq.provisional?[10,7]:[]);ctx.beginPath();
   nOverlay.points.forEach((v,i)=>i?ctx.lineTo(xp(v.index),yp(v.price)):ctx.moveTo(xp(v.index),yp(v.price)));ctx.stroke();
   for(const v of nOverlay.points.filter(x=>x.visible)){ctx.fillStyle=color;ctx.beginPath();ctx.arc(xp(v.index),yp(v.price),7,0,Math.PI*2);ctx.fill();text(`${v.key}${({A:"起漲",B:"前高",C:"回低"})[v.key]} ${fmt(v.price)}`,Math.max(x0+8,Math.min(xp(v.index)+10,W-320)),Math.max(y0+35,Math.min(yp(v.price)-14,y0+ph-16)),28,color,280);}
   // Projection remains in the dated research text; never present an old target as current pressure.
  }
  ctx.setLineDash([]);ctx.restore();
  if(wave)audit.elliottWave=V.overlay(ctx,wave,{bars,x:x0,y:y0,width:pw,height:ph,min,max,upperY:y0-40,lowerY:y0+ph+5});
  if(wave){audit.elliottWave.dateLabelTop=1288+waveGap-32;ctx.save();ctx.translate(0,waveGap);}
  text(bars[0].date,x0,1288,32,'#bcd1e2');text(bars.at(-1).date,930,1288,32,'#bcd1e2',280);
  text('交易量：每天成交多少股',68,1327,36,'#bcd1e2');
  for(const b of bars){ctx.fillStyle=b.close>=b.open?'#f26370':'#42ca9b';ctx.fillRect(xp(b.index)-dx*.31,vp(b.volume),Math.max(2,dx*.62),vy+vh-vp(b.volume));}
  if(d.volume.baseline5>0){const y=vp(d.volume.baseline5);ctx.save();ctx.beginPath();ctx.rect(x0,vy,pw,vh);ctx.clip();ctx.setLineDash([10,8]);ctx.strokeStyle='#e6d98e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+pw,y);ctx.stroke();ctx.restore();}
  wrapped(guide.volume.ratio,68,1610,W-136,34,43);
  wrapped(guide.volume.caution,68,1664,W-136,32,42);
  // Numbered outside markers connect each line to the full-name/price legend below.
  const tags=Layout.spread([...shown.map((v,i)=>({...v,id:i+1})),...patternLevels].map(v=>({...v,y:yp(v.price)-20,height:42})).filter(v=>Number.isFinite(v.price)&&v.price>0),{min:y0,max:y0+ph,dimension:'y',extent:'height',gap:10});audit.levelLabels=tags;
  for(const t of tags){ctx.strokeStyle=t.color;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(136,t.y+21);ctx.lineTo(x0,yp(t.price));ctx.stroke();ctx.fillStyle='#102235';ctx.fillRect(94,t.y,42,42);text(t.id,98,t.y+34,34,t.color,42);}
  ctx.textBaseline='top';Layout.paintBlocks(ctx,body);ctx.textBaseline='alphabetic';
  text(`${displayCode}｜已收盤行情 ${a.date}｜只供觀察，不是買賣通知`,68,totalHeight-70,32,'#9cb8cc');
  if(wave){V.block(ctx,wave,40,H,W-80,{dark:true,size:34});ctx.restore();}
 }
 const render=({top=0,height=totalHeight,scale=1}={})=>{const canvas=doc.createElement('canvas');canvas.width=Math.floor(W*scale);canvas.height=Math.floor(height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D unavailable');ctx.setTransform(scale,0,0,scale,0,-top*scale);paint(ctx);if(watermark)globalThis.ShitouReportWatermark.paint(ctx,{width:W,height:totalHeight,type:'all'});Object.assign(canvas.dataset,dataset);canvas.dataset.researchAudit=JSON.stringify(audit);return canvas;};
 return {width:W,height:totalHeight,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){const canvas=render();canvas.toBlob(blob=>{canvas.width=canvas.height=1;callback(blob);},type);}};
}
return Object.freeze({VERSION,page});
});

