/* Draw only precomputed, dated research evidence. Rendering never changes a signal. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouResearchChart=api;})(globalThis,function(){
'use strict';
const VERSION='RESEARCH_CHART_8_2_3',W=1284,H=2778;
const fmt=x=>Number.isFinite(x)?String(+x.toFixed(2)):'待核';
function page(a,{document:doc=globalThis.document,displayCode=globalThis.ShitouReleaseV50?.displayCode||'V8.2.3',watermark=false}={}){
 const u=a?.unifiedResearch,n=a?.nContinuation,d=u?.state==='RESEARCH_ONLY'?u.chart:n?.state==='RESEARCH_ONLY'?n.chart:null;if(!d?.bars?.length)return null;
 const bars=d.bars.slice(-80),start=bars[0].index,end=bars.at(-1).index,patterns=d.patterns.filter(x=>x.type==='DOUBLE_BOTTOM'?x.points.some(v=>v.index>=start):x.endIndex>=start).slice(0,2);
 const shown=[{title:'區間突破參考',price:d.trigger,color:'#f6cf65',solid:false},{title:'情境收盤失效',price:d.invalidation,color:'#ff858f',solid:true},{title:'候選防守參考',price:d.defenseReference,color:'#8dc9c2',solid:false},{title:'最近上方關卡',price:d.nextResistance?.price,color:'#d6aeff',solid:false}];
 const nq=n?.pattern,nOverlay=nq?{id:nq.id,stage:nq.stage,knownAt:nq.knownAt,points:['A','B','C'].map(key=>({key,...nq[key],visible:nq[key].index>=start})),projection:{...nq.projection}}:null;
 const audit={code:a.code,date:a.date,sourceSnapshotId:a.sourceSnapshotId,schemaVersion:u?.schemaVersion||n?.version||VERSION,chartVersion:VERSION,section:'STRUCTURE_CHART',width:W,height:H,noClipping:true,barCount:bars.length,firstDate:bars[0].date,lastDate:bars.at(-1).date,priceBasis:d.priceBasis,volumeStatus:d.volume.status,nContinuation:nOverlay,
  levels:shown.map(x=>({title:x.title,price:x.price??null})),patterns:patterns.map(x=>({type:x.type,status:x.status,formedAt:x.formedAt,confirmedAt:x.confirmedAt})),fields:shown.map(x=>({title:x.title,value:fmt(x.price)})),note:'虛線為參考／形成中；無已確認進場情境則不畫失效線；所有型態為未驗證績效的研究'};
 const dataset={researchAudit:JSON.stringify(audit),fullBleed:'true',release:displayCode};
 function paint(ctx){
  ctx.fillStyle='#102235';ctx.fillRect(0,0,W,H);
  function text(value,x,y,size=42,color='#f2f7ff',max=W-128){ctx.font=`650 ${size}px "Microsoft JhengHei",sans-serif`;while(ctx.measureText(String(value)).width>max&&size>28){size--;ctx.font=`650 ${size}px "Microsoft JhengHei",sans-serif`;}ctx.fillStyle=color;ctx.fillText(String(value),x,y);}
  function wrapped(value,x,y,width,size=40,line=55){ctx.font=`650 ${size}px "Microsoft JhengHei",sans-serif`;let row='',n=0;for(const ch of String(value)){if(row&&ctx.measureText(row+ch).width>width){text(row,x,y+n*line,size,'#bcd1e2',width);row=ch;n++;}else row+=ch;}if(row)text(row,x,y+n*line,size,'#bcd1e2',width);return y+(n+1)*line;}
  ctx.fillStyle='#1b3c59';ctx.fillRect(40,35,W-80,225);
  text('四策略研究｜結構證據圖',68,100,46);
  text(`${a.name}（${a.code}）`,68,180,66);
  text(`${a.date}｜完成日K ${bars.length}根｜${displayCode}`,68,235,36,'#bcd1e2');
  text('圖中價位為研究參考，入榜不等於可新買',68,320,43,'#ffdc8c');
  for(const [i,[label,color]] of [['MA5','#f6cf65'],['MA20','#65c5f2'],['MA60','#c1a0ff']].entries())text(label,80+i*315,389,40,color);
  const x0=120,y0=435,pw=1050,ph=1100,vy=1635,vh=330,dx=pw/bars.length;
  const raw=bars.flatMap(x=>[x.low,x.high,x.ma5,x.ma20,x.ma60]).filter(Number.isFinite),rawMin=Math.min(...raw),rawMax=Math.max(...raw),pad=Math.max((rawMax-rawMin)*.08,rawMax*.01),min=rawMin-pad,max=rawMax+pad;
  const xp=index=>x0+(index-start+.5)*dx,yp=price=>y0+ph-(price-min)/(max-min)*ph;
  const maxV=Math.max(...bars.map(x=>x.volume)),vp=v=>vy+vh-v/maxV*vh;
  ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=y0+ph*i/5;ctx.strokeStyle='#2d485c';ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+pw,y);ctx.stroke();text(fmt(max-(max-min)*i/5),42,y+12,30,'#a8c6db',72);}
  ctx.save();ctx.beginPath();ctx.rect(x0,y0,pw,ph);ctx.clip();
  for(const b of bars){const x=xp(b.index),color=b.close>=b.open?'#f26370':'#42ca9b';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(1,dx*.16);ctx.beginPath();ctx.moveTo(x,yp(b.high));ctx.lineTo(x,yp(b.low));ctx.stroke();ctx.fillRect(x-dx*.31,Math.min(yp(b.open),yp(b.close)),Math.max(2,dx*.62),Math.max(2,Math.abs(yp(b.open)-yp(b.close))));}
  for(const [key,color] of [['ma5','#f6cf65'],['ma20','#65c5f2'],['ma60','#c1a0ff']]){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();let pen=false;for(const b of bars){if(!Number.isFinite(b[key])){pen=false;continue;}if(pen)ctx.lineTo(xp(b.index),yp(b[key]));else{ctx.moveTo(xp(b.index),yp(b[key]));pen=true;}}ctx.stroke();}
  for(const item of shown.filter(x=>x.price>0)){ctx.strokeStyle=item.color;ctx.lineWidth=2.5;ctx.setLineDash(item.solid?[]:[12,9]);ctx.beginPath();ctx.moveTo(x0,yp(item.price));ctx.lineTo(x0+pw,yp(item.price));ctx.stroke();}
  for(const pattern of patterns){ctx.strokeStyle=pattern.status==='CONFIRMED'?'#71efd1':'#f0bf71';ctx.lineWidth=4;ctx.setLineDash(pattern.status==='CONFIRMED'?[]:[10,7]);
   if(pattern.type==='DOUBLE_BOTTOM'){ctx.beginPath();pattern.points.forEach((point,i)=>i?ctx.lineTo(xp(point.index),yp(point.price)):ctx.moveTo(xp(point.index),yp(point.price)));ctx.stroke();ctx.beginPath();ctx.moveTo(xp(pattern.points[0].index),yp(pattern.neckline));ctx.lineTo(x0+pw,yp(pattern.neckline));ctx.stroke();}
   else for(const line of [pattern.top,pattern.bottom]){const from=Math.max(start,pattern.startIndex);ctx.beginPath();ctx.moveTo(xp(from),yp(line.intercept+line.slope*from));ctx.lineTo(xp(end),yp(line.intercept+line.slope*end));ctx.stroke();}
  }
  if(nOverlay){
   const color=['INVALIDATED','AMBIGUOUS','WAIT_NEW_C','RETEST_FAILED'].includes(nq.stage)?'#ff929c':'#ffd76d';ctx.strokeStyle=color;ctx.lineWidth=4;ctx.setLineDash(nq.provisional?[10,7]:[]);ctx.beginPath();
   nOverlay.points.forEach((v,i)=>i?ctx.lineTo(xp(v.index),yp(v.price)):ctx.moveTo(xp(v.index),yp(v.price)));ctx.stroke();
   for(const v of nOverlay.points.filter(x=>x.visible)){ctx.fillStyle=color;ctx.beginPath();ctx.arc(xp(v.index),yp(v.price),7,0,Math.PI*2);ctx.fill();text(`${v.key} ${fmt(v.price)}`,Math.max(x0+8,Math.min(xp(v.index)+10,W-240)),Math.max(y0+35,Math.min(yp(v.price)-14,y0+ph-16)),30,color,200);}
   const target=nq.projection.price;ctx.setLineDash([12,9]);ctx.strokeStyle='#80d8c7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x0,yp(target));ctx.lineTo(x0+pw,yp(target));ctx.stroke();
  }
  ctx.setLineDash([]);ctx.restore();
  text(bars[0].date,x0,1588,32,'#bcd1e2');text(bars.at(-1).date,930,1588,32,'#bcd1e2',280);
  text('成交量（股）',68,1627,36,'#bcd1e2');
  for(const b of bars){ctx.fillStyle=b.close>=b.open?'#f26370':'#42ca9b';ctx.fillRect(xp(b.index)-dx*.31,vp(b.volume),Math.max(2,dx*.62),vy+vh-vp(b.volume));}
  if(d.volume.baseline5>0){const y=vp(d.volume.baseline5);ctx.save();ctx.beginPath();ctx.rect(x0,vy,pw,vh);ctx.clip();ctx.setLineDash([10,8]);ctx.strokeStyle='#e6d98e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+pw,y);ctx.stroke();ctx.restore();}
  text(`前5日量比 ${fmt(d.volume.ratio5)} 倍｜均量分母不含當日`,68,2032,39,'#e6d98e');
  let y=2110;for(const item of shown){text(`${item.title}：${fmt(item.price)}${!item.price&&item.title==='情境收盤失效'?'（尚無合格進場情境）':''}`,68,y,43,item.color);y+=78;}
  const label=nq?`N字：${n.label}；D等幅1.0投射 ${fmt(nq.projection.price)}，非已核驗壓力`:(patterns.map(x=>x.label+' '+({FORMING:'形成中',PENDING_CONFIRMATION:'待確認',CONFIRMED:'技術確認',INVALIDATED:'已失效',BREAKDOWN_OBSERVED:'向下跌破觀察'}[x.status]||x.status)).join('；')||'未識別符合研究定義的N字／W底／三角，不強制套型態');
  y=wrapped(label,68,2450,W-136,38,52);
  wrapped(`量能：${d.volume.status==='CONFLICT'?'來源衝突，不能確認':d.volume.usable?'同來源日K量可算，非主力證據':'來源待核'}；價格口徑${d.basisVerified?'已核驗':'待核'}。虛線為參考，型態未驗證績效。`,68,Math.max(2550,y),W-136,36,48);
  text(`${displayCode}｜行情 ${a.date}｜紅漲綠跌`,68,2740,32,'#9cb8cc');
 }
 const render=({top=0,height=H,scale=1}={})=>{const canvas=doc.createElement('canvas');canvas.width=Math.floor(W*scale);canvas.height=Math.floor(height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D unavailable');ctx.setTransform(scale,0,0,scale,0,-top*scale);paint(ctx);Object.assign(canvas.dataset,dataset);return canvas;};
 return {width:W,height:H,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){const canvas=render();if(watermark&&globalThis.applyAntiTheftWatermarkV3761)globalThis.applyAntiTheftWatermarkV3761(canvas,'all');canvas.toBlob(blob=>{canvas.width=canvas.height=1;callback(blob);},type);}};
}
return Object.freeze({VERSION,page});
});
