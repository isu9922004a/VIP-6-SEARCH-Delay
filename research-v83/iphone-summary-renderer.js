/* Native 1284x2778 export. Sections 01-04 are drawn verbatim; only 05 is condensed. */
(function(root){
'use strict';
const W=1284,H=2778,M=24,CW=W-2*M,num=n=>Number.isFinite(n)?String(+n.toFixed(2)):'尚未確認';
const PALETTE={bg:'#071f32',card:'#10344f',line:'#28627d',text:'#f0f6fb',muted:'#b8d9e9',blue:'#25a5eb',aqua:'#79e4d1',yellow:'#f7cf70',red:'#ff9a91'};
function compactFifth(a,g){const s=g.sections[4],f=s.forecast||{},p=root.ShitouOpeningPlan.evaluate(a),name=a.name||a.code;
 const source=s.narrative||[],context=root.ShitouOpeningPlan.plainContext(a)||{},bars=a.sourceBars||[],z=bars.at(-1),previous=bars.at(-2),ma5=a.features?.ma?.[5]?.value,ma20=a.features?.ma?.[20]?.value;
 const available=!!f.daily,bear=f.direction==='BEAR',direction=f.direction==='BULL'?'偏多':bear?'偏空':'方向分歧';
 const lead=available?`電腦模擬【${name}】：${direction}，${f.openingLabel}。多${+(f.bullish*100).toFixed(1)}%／空${+(f.bearish*100).toFixed(1)}%／平${+(f.flat*100).toFixed(1)}%。`:`【${name}】尚無可用模型結果，不填明日多空比例。`;
 const volume=context.volumeVerified&&previous?.volume>0&&Number.isFinite(z?.volume)?`量${z.volume>=previous.volume?'增':'減'}${Math.round(Math.abs(z.volume/previous.volume-1)*100)}%${z.volume>previous.volume&&z.close<previous.close?'卻下跌':z.close>previous.close?'、股價上漲':z.close<previous.close?'、股價下跌':'、價格持平'}`:'量價尚待核對';
 const proof=Number.isFinite(ma5)&&Number.isFinite(ma20)?`${volume}；${p.close>=ma20?'高於':'低於'}20日均價${num(ma20)}、${p.close>=ma5?'高於':'低於'}5日均價${num(ma5)}。`:volume+'；均線與價格尚待核對。';
 return {number:'05',title:s.title,lines:[
  {text:lead,tone:bear?'red':'aqua',bold:true},
  {text:f.state==='ILLUSTRATION'?'＊人工示意、未執行Kronos；取樣比例不是實際漲跌機率。':'＊盤後模型推演，取樣比例不是實際漲跌機率。',tone:'yellow'},
  {text:`新買先等：${p.watch>0?`站回並守穩 ${num(p.watch)} 元後，仍要確認其他買進與風險條件。`:'缺少可靠觀察價，暫不列買進條件。'}`},
  {text:`價位試算：${num(p.watch)}轉強／${num(p.stop)}新買防守／${num(p.target)}壓力；非保證成交或必達。`},
  {text:'依據：'+proof},
  {text:`站不回觀察價或續跌，${bear?'勿急著搶反彈或只因模型偏空追空':'勿因模型偏多而貿然進場'}；跳空重算價位與風險，已持股者按原計畫。`}
 ]};}
function pages(a,report,{doc,displayCode='V8.3',wrap}){
 const guide=report.actionGuide,canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d'),compact=compactFifth(a,guide),trace=[];
 const font=(size,bold=false)=>{ctx.font=`${bold?750:600} ${size}px "Microsoft JhengHei","Segoe UI Emoji",sans-serif`;};
 const measure=(text,width,size,bold=false)=>{font(size,bold);return wrap(ctx,String(text),width);};
 function layout(size){const line=size+10,inner=CW-44,headSize=40,titleLine=50;
  const status=guide.status.lines.flatMap(t=>measure(t,inner-84,size));const statusHead=measure(guide.status.headline,inner-84,50,true),statusH=26+statusHead.length*60+status.length*line;
  const sections=guide.sections.slice(0,4).map(s=>{const titles=measure(s.title,CW-106,headSize,true),rows=s.rows.map(r=>{const left=246,gap=22,right=inner-left-gap-16;let priceSize=42;
   font(priceSize,true);while(priceSize>30&&ctx.measureText(r.price||'').width>left)font(--priceSize,true);
   const prices=r.price?measure(r.price,left,priceSize,true):[],labels=r.label?measure(r.label,left,size-4):[],bullets=r.bullets.map(t=>measure(t,right-18,size));
   return {r,left,gap,right,priceSize,prices,labels,bullets,height:Math.max(prices.length*(priceSize+8)+labels.length*(size+4),bullets.reduce((n,b)=>n+b.length*line,0))+12};
  }),callout=s.callout?{title:measure(s.callout.title,inner,size+2,true),lines:s.callout.lines.flatMap(t=>measure(t,inner,size))}:null;
   const titleH=titles.length*titleLine+14,callH=callout?callout.title.length*(size+12)+callout.lines.length*line+12:0;
   return {s,titles,titleH,rows,callout,height:18+titleH+rows.reduce((n,r)=>n+r.height,0)+callH+12};
  });
  const fifthTitle=measure(compact.title,CW-106,headSize,true),fifthLines=compact.lines.map(t=>({...t,lines:measure(t.text,inner,size,t.bold),height:measure(t.text,inner,size,t.bold).length*line+7})),fifthH=18+fifthTitle.length*titleLine+14+fifthLines.reduce((n,t)=>n+t.height,0)+12;
  const top=140,headerH=176,gap=12,footerH=200,total=top+headerH+gap+statusH+gap+sections.reduce((n,s)=>n+s.height+gap,0)+fifthH+footerH;
  return {size,line,headSize,titleLine,inner,status,statusHead,statusH,sections,fifthTitle,fifthLines,fifthH,top,headerH,gap,footerH,total};
 }
 let l;for(const size of [36,35,34,33,32]){const trial=layout(size);if(trial.total<=H){l=trial;break;}}if(!l)throw Error('目前內容超過單張滿版安全範圍；需再精簡第五項，未裁切其他內容。');
 const extra=(H-l.total)/6;const panel=(y,h,stroke=PALETTE.line,fill=PALETTE.card)=>{ctx.beginPath();ctx.roundRect(M,y,CW,h,22);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();};
 function draw(text,x,y,size,color=PALETTE.text,bold=false,line=size+10){font(size,bold);ctx.fillStyle=color;text.forEach((t,i)=>ctx.fillText(t,x,y+i*line));}
 function title(s,titles,y){ctx.fillStyle=PALETTE.blue;ctx.beginPath();ctx.arc(M+39,y+39,27,0,Math.PI*2);ctx.fill();draw([s.number],M+21,y+51,30,PALETTE.text,true);draw(titles,M+84,y+46,l.headSize,PALETTE.text,true,l.titleLine);}
 ctx.fillStyle=PALETTE.bg;ctx.fillRect(0,0,W,H);let y=l.top;
 panel(y,l.headerH);draw([guide.title],M+24,y+40,34,PALETTE.muted,true);draw([guide.name+'（'+guide.code+'）'],M+24,y+107,64,PALETTE.text,true);draw(['行情基準 '+guide.date.replaceAll('-','/')+'｜收盤 '+num(guide.close)+' 元'],M+24,y+151,34,PALETTE.muted);draw([guide.badge],W-M-172,y+48,30,PALETTE.yellow,true);y+=l.headerH+l.gap;
 panel(y,l.statusH,PALETTE.yellow,'#252c28');draw(['!'],M+29,y+63,56,PALETTE.yellow,true);draw(l.statusHead,M+104,y+61,50,PALETTE.yellow,true,60);draw(l.status,M+104,y+61+l.statusHead.length*60,l.size,PALETTE.text,false,l.line);y+=l.statusH+l.gap;
 for(const section of l.sections){const height=section.height+extra;panel(y,height);title(section.s,section.titles,y);let rowY=y+18+section.titleH;
  trace.push(section.s.title);
  for(const row of section.rows){const r=row.r,tone=r.tone==='red'||r.icon==='fall'?PALETTE.red:r.tone==='aqua'?PALETTE.aqua:'#a6e5fc';let priceY=rowY+row.priceSize;
   draw(row.prices,M+22,priceY,row.priceSize,tone,true,row.priceSize+8);draw(row.labels,M+22,priceY+row.prices.length*(row.priceSize+8),l.size-4,PALETTE.muted,false,l.size+4);
   const divider=M+22+row.left+row.gap/2;ctx.strokeStyle=PALETTE.line;ctx.beginPath();ctx.moveTo(divider,rowY+3);ctx.lineTo(divider,rowY+row.height-4);ctx.stroke();let bulletY=rowY+l.size;
   for(const bullet of row.bullets){ctx.fillStyle=PALETTE.aqua;ctx.beginPath();ctx.arc(divider+17,bulletY-11,4,0,Math.PI*2);ctx.fill();draw(bullet,divider+29,bulletY,l.size,PALETTE.text,false,l.line);bulletY+=bullet.length*l.line;}
   trace.push(...[r.price,r.label,...r.bullets].filter(Boolean));rowY+=row.height;
  }
  if(section.callout){const c=section.callout;draw(c.title,M+22,rowY+l.size+2,l.size+2,PALETTE.muted,true,l.size+12);draw(c.lines,M+22,rowY+l.size+2+c.title.length*(l.size+12),l.size,PALETTE.text,false,l.line);trace.push(section.s.callout.title,...section.s.callout.lines);}
  y+=height+l.gap;
 }
 panel(y,l.fifthH+extra);title(compact,l.fifthTitle,y);let fy=y+18+l.fifthTitle.length*l.titleLine+14;for(const block of l.fifthLines){draw(block.lines,M+22,fy+l.size,l.size,PALETTE[block.tone]||PALETTE.text,block.bold,l.line);fy+=block.height;}y+=l.fifthH+extra;
 const footerTop=y+16;ctx.strokeStyle=PALETTE.line;ctx.beginPath();ctx.moveTo(M,footerTop);ctx.lineTo(W-M,footerTop);ctx.stroke();const foot=measure(guide.guideNote,CW-40,27);draw(foot,M+12,footerTop+38,27,PALETTE.muted,false,35);draw([displayCode+'｜1/1'],W-M-225,H-108,29,PALETTE.muted,true);
 const original=guide.sections.slice(0,4).flatMap(s=>[s.title,...s.rows.flatMap(r=>[r.price,r.label,...r.bullets].filter(Boolean)),...(s.callout?[s.callout.title,...s.callout.lines]:[])]);
 if(JSON.stringify(trace)!==JSON.stringify(original))throw Error('第一至第四項文字核對失敗');
 const audit={fields:guide.summary,width:W,height:H,minBodyFont:l.size,topSafeArea:140,bottomSafeArea:104,footerBottom:footerTop+38+(foot.length-1)*35,firstFourPreserved:true,firstFourText:trace,originalFirstFour:guide.sections.slice(0,4),headerPreserved:{title:guide.title,name:guide.name,code:guide.code,date:guide.date,close:guide.close,badge:guide.badge},statusPreserved:guide.status,fifthCondensed:true,fifthLines:compact.lines.map(t=>t.text),guideNote:guide.guideNote,noClipping:fy<=y&&footerTop+38+(foot.length-1)*35<=H-104,fullBleed:true,modelRun:guide.sections[4].forecast?.modelRun===true};
 canvas.dataset.researchAudit=JSON.stringify(audit);return [{width:W,height:H,dataset:{researchAudit:JSON.stringify(audit)},renderExportRegion(){return canvas;},toBlob(cb,type='image/png'){canvas.toBlob(cb,type);}}];
}
root.ShitouIPhoneSummary={pages,compactFifth};
})(globalThis);
