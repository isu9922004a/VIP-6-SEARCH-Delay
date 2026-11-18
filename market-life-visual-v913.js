/* V9.14 index-only multi-event fork: original individual stock renderer untouched. */
(function(root,factory){
 const node=typeof module==='object'&&!!module.exports;
 const api=factory(node?require('./life-line-visual-v972.js'):root.ShitouLifeVisual972,node?require('./market-life-risk-v913.js'):root.ShitouMarketLifeRisk913,node?require('./life-line-intelligence-v913.js'):root.ShitouLifeIntelligence913);
 if(node)module.exports=api;else root.ShitouMarketLifeVisual913=api;
})(globalThis,function(Legacy,Risk,Info){
'use strict';
if(!Legacy||typeof Legacy.model!=='function'||!Risk||typeof Risk.evaluate!=='function'||!Info||typeof Info.evaluate!=='function')throw Error('缺少大盤 V9.14 風險模型或K3事件資料');
const RELEASE='V9.14',VERSION='MARKET_LIFE_VISUAL_V913',W=1284,H=2778,M=14,FOOT=2672;
const C={bg:'#071C2D',card:'#0A2D43',card2:'#10364D',ink:'#F3F7FF',muted:'#C2D7E5',mint:'#81F1D0',green:'#60EE92',gold:'#FFE365',orange:'#FFB444',risk:'#FF859F',blue:'#39B9FF',grid:'#28506B',up:'#FF5975',down:'#3CDBB6',line:'#71CFFF'};
const finite=n=>typeof n==='number'&&Number.isFinite(n),num=n=>finite(n)?n.toFixed(2):'資料不足',date=v=>typeof v==='string'&&v.length>=10?v.slice(5).replace('-','/'):'未確認';
async function ready(doc=globalThis.document){if(!doc?.createElement)throw Error('圖片畫布不可用');if(doc.fonts?.ready)await doc.fonts.ready;return true;}
function build(study,{document:doc=globalThis.document,record=null,display=null,source=null,watermark=false}={}){
 if(!doc?.createElement)throw Error('圖片畫布不可用');
 if(study?.instrumentType!=='TAIEX'||study?.code!=='TAIEX'||study?.sourceVerified!==true)throw Error('只允許已確認的加權指數日 K');
 const intelligence=Risk.evaluate(study);
 const intel=Info.evaluate(study);
 const m=Legacy.model(study,{record:null,display:null,source:null}),bars=m.bars.slice(-30),last=bars.at(-1),line=m.line;

 // Extending MA lines is allowed only with the exact validated, unadjusted official
 // series matching EVERY existing completed K. The research core remains untouched.
 const candidate=source?.dailySeries;
 const sourceAgrees=!!(source&&String(source.stock||source.code)===m.code&&
   source.closeDate===m.date&&source.completed===true&&source.volumeUnit==='shares'&&
   source.dailySeriesMeta?.onlyCompletedBars===true&&
   source.priceAdjustment?.verified===true&&
   source.priceAdjustment?.basis==='UNADJUSTED_OFFICIAL_OHLC'&&
   Array.isArray(candidate)&&candidate.length>=m.bars.length+29&&
   candidate.every((b,i)=>b&&typeof b.date==='string'&&Number.isFinite(b.close)&&b.close>0&&
     (i===0||candidate[i-1].date<b.date))&&
   candidate.at(-1).date===m.date&&m.bars.every((b,i)=>{
    const c=candidate[candidate.length-m.bars.length+i];
    return ['date','open','high','low','close','volume'].every(k=>b[k]===c[k]);
   }));
 const extendedMA={};
 for(const n of [5,10,20,60]){
   const current=m.maSeries[n].slice(-bars.length);
   const longer=sourceAgrees?bars.map((_,i)=>{
     const pos=candidate.length-bars.length+i;
     return pos<n-1?null:candidate.slice(pos-n+1,pos+1).reduce((sum,b)=>sum+b.close,0)/n;
   }):null;
   extendedMA[n]=longer&&Number.isFinite(longer.at(-1))&&
     Number.isFinite(m.ma[n])&&Math.abs(longer.at(-1)-m.ma[n])<1e-7?longer:current;
 }

 const ranges=m.range||{},lifeCurrent=finite(line)&&!m.referenceOnly&&m.currentRole==='SUPPORT';
 const scenario=intelligence.scenarios,fours=m.four||[];
 const lastBreak=m.event?.firstBreakdownDate;
 const breakEvent=m.events?.find(e=>e.date===lastBreak&&e.kind==='SUPPORT_BROKEN');
 const finalReclaim=[...(m.events||[])].reverse().find(e=>e.kind==='SUPPORT_RECLAIMED'&&e.confirmedAt);
 const sourceEvent=(m.event?.signalDate||null);
 const short=v=>String(v??'未確認').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
 const barOn=d=>m.bars.find(b=>b.date===d);
 const mkVol=v=>finite(v)?Math.round(v).toLocaleString('en-US')+' 股':'資料不足';
 const draw=(canvas,pageno)=>{
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D 不可用');
  ctx.textBaseline='top';ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
  function font(size,weight=650){ctx.font=weight+' '+size+'px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';}
  function fit(value,x,y,width,size,color=C.ink,weight=650,min=24){
   let v=String(value??'資料不足');let s=size;font(s,weight);
   while(s>min&&ctx.measureText(v).width>width){s-=1;font(s,weight);}
   if(ctx.measureText(v).width>width){while(v.length>1&&ctx.measureText(v+'…').width>width)v=v.slice(0,-1);v+='…';}
   ctx.fillStyle=color;ctx.fillText(v,x,y);return s;
  }
  function wrap(value,width,size,weight=600){font(size,weight);const lines=[];for(const part of String(value??'資料不足').split('\n')){let row='';for(const ch of Array.from(part)){if(row&&ctx.measureText(row+ch).width>width){lines.push(row);row=ch;}else row+=ch;}lines.push(row||' ');}return lines;}
  function paragraph(value,x,y,width,size,color=C.ink,maxLines=5,leading=1.27,weight=590){
   const lines=wrap(value,width,size,weight);const count=Math.min(maxLines,lines.length);for(let i=0;i<count;i++){const line=i===maxLines-1&&lines.length>maxLines?lines[i].slice(0,-1)+'…':lines[i];fit(line,x,y+i*size*leading,width,size,color,weight,Math.min(22,size));}return count*size*leading;
  }
  function round(x,y,w,h,r=16,color=C.card,stroke=C.line,lw=2){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}}
  function hr(x1,y1,x2,y2,color=C.line,width=2,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
  function trophy(){
   round(22,14,90,93,18,'#0C2637','#AD8D4E',1.5);
   ctx.save();ctx.translate(67,22);
   // Draw an actual vector trophy: color-emoji fonts are not available on all CI browsers.
   const metallic=ctx.createLinearGradient(-24,0,25,0);
   metallic.addColorStop(0,'#B87711');metallic.addColorStop(.26,'#FFE07A');metallic.addColorStop(.6,'#FFBE32');metallic.addColorStop(1,'#9E6410');
   ctx.fillStyle=metallic;ctx.strokeStyle='#FFE29B';ctx.lineWidth=3;
   for(const direction of [-1,1]){
    ctx.beginPath();ctx.moveTo(direction*22,14);
    ctx.bezierCurveTo(direction*43,6,direction*44,36,direction*30,46);
    ctx.bezierCurveTo(direction*25,49,direction*19,48,direction*15,41);
    ctx.lineWidth=4;ctx.stroke();
   }
   ctx.beginPath();ctx.moveTo(-24,8);ctx.lineTo(24,8);ctx.lineTo(22,29);
   ctx.bezierCurveTo(21,48,11,56,2,59);ctx.lineTo(-2,59);
   ctx.bezierCurveTo(-11,56,-21,48,-22,29);ctx.closePath();ctx.fill();ctx.lineWidth=2;ctx.stroke();
   ctx.fillStyle='#FFE36B';ctx.fillRect(-5,57,10,16);
   ctx.fillStyle=metallic;ctx.fillRect(-20,72,40,7);ctx.fillRect(-27,79,54,7);
   ctx.restore();
  }
  function header(sub){
   trophy();fit('石頭少爺 '+RELEASE+'｜',128,15,440,54,C.ink,820,40);fit('大盤生命線研究',560,14,385,53,C.gold,800,37);
   fit(sub,129,82,790,30,C.muted,640,25);
   round(960,17,306,69,21,'#0763AD',C.blue,2);
   fit('大盤生命線圖片報告',978,30,269,32,C.ink,760,26);
  }
  function footer(pageLabel){
   hr(M,2660,W-M,2660,C.line,2);
   fit('ⓘ 研究參考，非買賣建議，績效未驗證｜'+RELEASE,22,2691,705,28,C.muted,610,24);
   round(760,2682,500,56,12,'#081F35',C.muted,1.5);
   fit(pageLabel,778,2693,467,29,C.ink,650,23);
  }
  function title(x,y,text,color=C.ink,width=1100){fit(text,x,y,width,38,color,770,30);}
  function stateCard(x,y,w,label,status,color){
   round(x,y,w,94,15,C.card,C.line,1.6);
   fit(label,x+18,y+9,w-36,26,C.muted,690,22);
   fit(status,x+18,y+45,w-36,37,color,780,27);
  }
  function page1(){
   header('第 1 / 2 頁｜大盤風險分析（趨勢・關鍵價位・隔日觀察）');
   round(M,123,W-M*2,147,20,C.card,C.line,2);
   fit('台灣加權指數',33,142,445,51,C.ink,820,40);fit('（TAIEX）',33,208,445,34,C.muted,700,28);
   hr(490,147,490,252,C.line,2);
   fit('▦ 最新完成交易日',524,142,360,30,C.ink,700);
   fit(m.date||'資料不足',555,190,300,41,C.ink,760);
   hr(915,147,915,252,C.line,2);
   fit('收盤',927,172,76,32,C.ink,760,27);
   fit(num(m.close),1013,151,249,46,C.gold,850,33);fit('點',1218,207,44,29,C.gold,750,24);
   stateCard(14,285,618,'大盤目前趨勢',intelligence.trend.label,intelligence.trend.state==='WEAK'?C.risk:intelligence.trend.state==='STRONG'?C.mint:C.gold);
   stateCard(652,285,618,'K3 生命線事件',Info.statusLabel(m.lifecycleState,Info.statusLabel(m.life.label)),['BREAKOUT_FAILED','SUPPORT_BROKEN'].includes(m.lifecycleState)?C.risk:C.mint);
   stateCard(14,391,618,'短線風險（第 '+intelligence.risk.level+' 級）',intelligence.risk.label,intelligence.risk.color);
   stateCard(652,391,618,'多日風險階段',Info.statusLabel(intelligence.phase.state,Info.statusLabel(intelligence.phase.label)),['ACTIVE_SHOCK','POST_SHOCK_WEAKNESS'].includes(intelligence.phase.state)?C.risk:C.gold);
   round(M,500,W-2*M,134,20,'#081E34',C.line,2);
   round(22,506,131,122,16,'#40316C','#AEB2FE',2);
   fit('關鍵',39,518,104,38,C.ink,740);fit('價位',39,561,104,38,C.ink,740);
   const metrics=[['最新收盤',num(m.close),C.gold],['原始K3生命線',num(line),C.mint],['近10日高點',num(ranges.high),C.orange],['近10日低點',num(ranges.low),C.green],['距離生命線',finite(m.distancePct)?(m.distancePct>0?'+':'')+num(m.distancePct)+'%':'資料不足',m.distancePct>=0?C.risk:C.green]];
   const mw=219;metrics.forEach((a,i)=>{const x=155+i*mw;fit(a[0],x+3,516,208,30,C.ink,710,25);fit(a[1],x+5,557,208,43,a[2],800,29);if(i)hr(x-3,510,x-3,623,C.line,1.5);});
   drawChart();
   round(14,1727,624,472,18,C.card,C.line,2);
   title(34,1742,'⌕ 現在怎麼看？（重點判讀）',C.ink,575);
   const rows=[
    ['生命線角色',intelligence.life.role.label+'；'+(intel.activeResistanceEvent?'壓力 '+num(intel.activeResistanceEvent.lifeLinePrice)+' 點；':'')+(intel.activeSupportEvent?'支撐 '+num(intel.activeSupportEvent.lifeLinePrice)+' 點。':'支撐待核對。'),C.mint,'◎'],
    ['短期均線','MA5 '+num(intelligence.metrics.ma5)+'、MA20 '+num(intelligence.metrics.ma20)+'，收盤位置才是確認依據。',C.gold,'▥'],
    ['反彈觀察',intelligence.rebound.label+'；'+intelligence.rebound.explanation,C.orange,'◇'],
    ['成交股數',intelligence.volume.notice,C.gold,'▥']
   ];
   rows.forEach((r,i)=>{const y=1801+i*95;round(30,y,594,88,10,C.card2,'#739DB6',1);fit(r[3],40,y+23,48,38,r[2],800,32);fit(r[0],94,y+22,185,33,r[2],800,28);hr(280,y+5,280,y+81,'#7196AE',1);paragraph(r[1],294,y+5,314,24,C.ink,3,1.07,590);});
   round(649,1727,621,472,18,C.card,C.line,2);
   title(665,1742,'◎ 下一個交易日觀察重點',C.ink,575);
   const scenColors=[C.green,C.gold,C.risk],scenBG=['#0B3932','#483611','#4B1B30'],labels=['↗','～','↘'];
   scenario.slice(0,3).forEach((s,i)=>{const y=1801+i*129;round(666,y,584,121,16,scenBG[i],C.line,1.5);round(680,y+22,68,68,34,scenColors[i],null);fit(labels[i],696,y+28,50,47,'#081F2E',850,35);fit('情境 '+['A','B','C'][i]+'｜'+s.title+(s.active?'【目前】':''),764,y+9,473,31,scenColors[i],780,25);paragraph(s.text,765,y+43,458,24,C.ink,3,1.04,590);});
   round(14,2213,773,429,18,C.card,C.line,2);title(33,2226,'▦ 已確認的歷史紀錄（生命線事件）',C.ink,735);
   hr(61,2299,750,2299,'#87D3FF',4);
   const hs=fours.map((v,i)=>({date:v.date,label:v.label,price:v.bar?num(i===3?v.bar.close:i===0?(m.event?.side==='BULL'?v.bar.low:v.bar.high):(m.event?.side==='BEAR'?v.bar.low:v.bar.high)):'未確認',color:i===3?C.mint:C.gold}));
   const makeHistorical=(dt,lab,kind,col)=>({date:dt,label:lab,price:dt&&barOn(dt)?num(barOn(dt).close):'未確認',color:col});
   hs.push(makeHistorical(lastBreak,'跌破','broken',C.risk));hs.push(makeHistorical(finalReclaim?.date,'站回','reclaim',C.green));
   hs.slice(0,6).forEach((e,i)=>{const x=24+i*126;round(x,2315,119,238,15,'#09243A',e.color,1.3);round(x+49,2287,18,18,9,e.color,null);fit(date(e.date),x+7,2338,106,27,C.ink,730,23);fit(e.label,x+12,2390,98,40,e.color,810,31);fit(i===3?'收盤價':i===0?(m.event?.side==='BULL'?'最低價':'最高價'):(m.event?.side==='BEAR'?'最低價':'最高價'),x+8,2449,107,22,C.muted,600,20);fit(e.price,x+4,2489,112,24,C.ink,760,18);});
   fit('K3 原始生命線 '+num(line)+' 點；歷史事件均以完成日收盤確認。',32,2580,735,25,C.muted,620,23);
   round(800,2213,470,429,18,'#292619',C.gold,2.5);
   title(814,2227,'☼ 目前綜合觀察',C.ink,439);
   const summary=intelligence.risk.label+'；'+intelligence.phase.reason+' '+intelligence.risk.reasons.slice(0,1).join('；')+'。';
   const status='生命線目前角色：'+intelligence.life.role.label+'。';
   paragraph(summary+status+'主要情境 '+intelligence.activeScenario+'；判讀依完成日K，不保證隔日方向。',821,2294,425,28,C.ink,8,1.26,630);
   footer('第 1 / 2 頁　下一頁：生命線教學 ▷');
  }
  function drawChart(){
   const x=14,y=650,w=W-28,h=1061;round(x,y,w,h,18,'#05192B',C.line,2);
   title(x+21,y+14,'▥ 日 K 線走勢與關鍵位置（近30個交易日）');
   const legend=[[5,C.ink],[10,C.blue],[20,C.green],[60,C.gold]];
   legend.forEach(([n,col],i)=>{const xx=38+i*308;hr(xx,y+87,xx+33,y+87,col,8);fit('MA'+n+' '+num(m.ma[n]),xx+44,y+67,247,27,C.ink,640,23);});
   if(!bars.length){title(45,y+250,'尚無經核對的完成日 K，暫不畫技術線。',C.risk);return;}
   const p={x:25,y:y+148,w:1119,h:611};const left=p.x,right=p.x+p.w;
   const levels=[];
   if(finite(intel.activeSupportEvent?.lifeLinePrice))levels.push({value:intel.activeSupportEvent.lifeLinePrice,title:'多方支撐 '+num(intel.activeSupportEvent.lifeLinePrice)+' 點',color:C.green,kind:'support'});
   if(finite(intel.activeResistanceEvent?.lifeLinePrice))levels.push({value:intel.activeResistanceEvent.lifeLinePrice,title:'空方壓力 '+num(intel.activeResistanceEvent.lifeLinePrice)+' 點',color:C.risk,kind:'resistance'});
   if(finite(ranges.high))levels.push({value:ranges.high,title:'近10日高 '+num(ranges.high),color:C.orange,kind:'range'});
   if(finite(ranges.low))levels.push({value:ranges.low,title:'近10日低 '+num(ranges.low),color:C.green,kind:'range'});
   if(finite(line)&&!m.referenceOnly)levels.push({value:line,title:'生命線 '+num(line)+'（K3）',color:C.mint,kind:'line'});
   const firstRes=m.resistance?.find(z=>finite(z.price)&&z.price>m.close&&Math.abs(z.price-ranges.high)>.01);
   if(firstRes&&!levels.some(v=>Math.abs(v.value-firstRes.price)<.01))levels.push({value:firstRes.price,title:'確認壓力 '+num(firstRes.price),color:C.orange,kind:'level'});
   const vals=bars.flatMap(b=>[b.high,b.low]);for(const n of [5,10,20,60])vals.push(...extendedMA[n].filter(finite));for(const l of levels)vals.push(l.value);
   const lo=Math.min(...vals),hi=Math.max(...vals),pad=Math.max((hi-lo)*.075,1),min=lo-pad,max=hi+pad;
   const scale=v=>p.y+(max-v)/(max-min)*p.h,step=p.w/bars.length,xAt=i=>p.x+step*(i+.5);
   for(let i=0;i<=7;i++){const yy=p.y+p.h*i/7;hr(left,yy,right,yy,C.grid,1);fit(num(max-(max-min)*i/7),1154,yy-13,110,25,C.muted,530,22);}
   for(let i=0;i<=6;i++)hr(left+p.w*i/6,p.y,left+p.w*i/6,p.y+p.h,C.grid,1);
   ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
   const cols={5:C.ink,10:C.blue,20:C.green,60:C.gold};
   for(const n of [60,20,10,5]){const series=extendedMA[n];ctx.strokeStyle=cols[n];ctx.lineWidth=n===5?3.5:4;ctx.beginPath();let started=false;series.forEach((v,i)=>{if(!finite(v)){started=false;return;}if(!started){ctx.moveTo(xAt(i),scale(v));started=true;}else ctx.lineTo(xAt(i),scale(v));});ctx.stroke();}
   bars.forEach((b,i)=>{const col=b.close>b.open?C.up:b.close<b.open?C.down:C.muted,xx=xAt(i),wid=Math.max(5,step*.55);hr(xx,scale(b.high),xx,scale(b.low),col,2);ctx.fillStyle=col;ctx.fillRect(xx-wid/2,Math.min(scale(b.open),scale(b.close)),wid,Math.max(3,Math.abs(scale(b.open)-scale(b.close))));});
   for(const v of levels){hr(left,scale(v.value),right,scale(v.value),v.color,3,[13,9]);}
   ctx.restore();
   let placed=[];
   for(const l of levels.slice().sort((a,b)=>b.value-a.value)){
    const yy=scale(l.value);if(yy<p.y+13||yy>p.y+p.h-14)continue;
    let tagY=yy-18;for(const t of placed)if(Math.abs(tagY-t)<42)tagY=t+43;
    placed.push(tagY);const tw=Math.min(370,Math.max(220,l.title.length*28+23));
    round(28,tagY,tw,36,9,l.color,null);fit(l.title,37,tagY+4,tw-15,27,'#071A2B',820,22);
   }
   const markers=fours.filter(e=>e.bar&&bars.some(b=>b.date===e.date));
   const tagStart=Math.max(480,Math.min(690,right-580));
   markers.forEach((k,i)=>{const idx=bars.findIndex(b=>b.date===k.date),bx=xAt(idx),by=scale(bars[idx].high),labelX=tagStart+i*141,yy=y+105;round(labelX,yy,131,69,12,'#091D32','#BDE9FF',1.5);fit(k.label,labelX+29,yy+6,100,31,C.gold,820);fit(k.date.slice(5),labelX+5,yy+41,122,21,C.ink,560,20);hr(labelX+65,yy+69,bx,by-7,'#E4F3FF',2);round(bx-5,by-7,10,10,5,C.green,null);});
   const volTop=y+816,volBottom=y+945,volHeight=volBottom-volTop;
   hr(26,volTop,1145,volTop,C.grid,1);
   const maxVol=Math.max(1,...bars.map(b=>b.volume)),volumeColor=b=>b.close>b.open?C.up:b.close<b.open?C.down:C.muted;
   bars.forEach((b,i)=>{const bh=b.volume/maxVol*volHeight,ww=Math.max(4,step*.56);ctx.fillStyle=volumeColor(b);ctx.fillRect(xAt(i)-ww/2,volBottom-bh,ww,bh);});
   const volAvg=bars.map((b,i)=>{const index=m.bars.length-bars.length+i;return index>=4?m.bars.slice(index-4,index+1).reduce((sum,v)=>sum+v.volume,0)/5:null;});
   ctx.strokeStyle=C.gold;ctx.lineWidth=3;ctx.beginPath();let began=false;volAvg.forEach((v,i)=>{if(!finite(v)){began=false;return;}const yy=volBottom-v/maxVol*volHeight;if(!began){ctx.moveTo(xAt(i),yy);began=true;}else ctx.lineTo(xAt(i),yy);});ctx.stroke();
   round(26,y+765,162,46,8,C.card2,C.line,1);fit('成交股數',36,y+773,145,29,C.ink,720,24);
   const vs=m.volume.verified?'量 '+mkVol(m.volume.last)+'　量比 '+num(m.volume.ratio)+'　前5日均量 '+mkVol(m.volume.average5):'集中市場成交股數來源待核對（不使用量比）';
   fit(vs,209,y+772,886,29,C.ink,660,23);
   for(const idx of [0,5,10,15,20,25,29])if(idx<bars.length){const xx=xAt(idx);fit(date(bars[idx].date),Math.max(38,xx-56),y+959,102,25,C.muted,540,21);}
   if(fours.length&&markers.length<fours.length)fit('部分 K3～K0 不在近30日範圍；完整歷史見第2頁。',40,y+1018,915,26,C.muted,520,22);
  }
  function page2(){
   header('第 2 / 2 頁｜K3～K0 生命線形成教學');
   round(14,123,1256,188,20,C.card,C.line,2);
   fit('台灣加權指數（TAIEX）',33,143,690,49,C.ink,820,40);fit('原始生命線 '+num(line)+' 點',32,220,720,43,C.mint,780,35);
   fit('完成交易日：'+(m.date||'未確認'),785,158,449,30,C.muted,650,25);
   title(32,331,'一、四根 K 棒怎麼形成？',C.mint);
   const x0=26,ww=299,yy=406;fours.forEach((k,i)=>{const xx=x0+i*(ww+14);round(xx,yy,ww,370,18,C.card,i===0?C.gold:C.line,2);fit(k.label,xx+20,yy+18,200,62,i===0?C.gold:C.mint,800,45);fit(k.date||'未確認',xx+20,yy+90,ww-35,31,C.ink,650,26);if(k.bar){paragraph('開 '+num(k.bar.open)+'\n高 '+num(k.bar.high)+'\n低 '+num(k.bar.low)+'\n收 '+num(k.bar.close),xx+18,yy+150,ww-35,35,C.ink,4,1.46,720);}else paragraph('沒有經確認的原始 K 棒；不可補造。',xx+20,yy+155,ww-40,31,C.risk,5);});
   if(!fours.length){round(28,410,1227,330,16,C.card,C.line);paragraph('目前沒有符合核心規則的 K0；本頁不會補造 K3、K2、K1、K0。',50,465,1180,40,C.risk,5);}
   round(14,803,1256,218,18,C.card,C.line,2);
   title(35,821,'生命線價格從哪裡來？',C.mint);
   const rule=m.event?(m.event.side==='BULL'?'多方型態：取 K3 當日「最低價」形成原始生命線。':'空方型態：取 K3 當日「最高價」形成原始生命線。'):'尚無已確認型態，因此也沒有原始生命線價格。';
   paragraph(rule+'　原始生命線 '+num(line)+' 點；K0 收盤價不是生命線，也不是市場實際持有成本。',37,884,1200,36,C.ink,3,1.3,620);
   title(34,1051,'二、先看收盤，再判斷有沒有突破或跌破',C.mint);
   const rules=[
    ['收盤突破', '當日收盤嚴格高於原本的壓力價，才確認突破。',C.gold],
    ['正式跌破', '當日收盤嚴格低於下方支撐價，才確認跌破。',C.risk],
    ['跌破後站回', '先有正式跌破，之後收盤嚴格重新高於關卡，才稱站回。',C.green],
    ['沒有確認', '盤中穿越或收盤剛好相等，不代表完成正式突破／跌破。',C.muted],
   ];
   rules.forEach((r,i)=>{const yy=1128+i*167;round(15,yy,1254,147,16,C.card,C.line,1.7);round(33,yy+22,236,101,12,C.card2,r[2],2);fit(r[0],52,yy+50,198,36,r[2],780,30);paragraph(r[1],303,yy+33,925,35,C.ink,3,1.2,610);});
   title(34,1826,'三、已確認的實際歷史事件',C.mint);
   round(14,1888,1256,415,20,C.card,C.line,2);
   const history=[];
   if(m.event)history.push('生命線形成：'+m.event.signalDate+'｜'+num(line)+' 點');
   for(const e of m.events||[])if(e.confirmedAt&&/SUPPORT_BROKEN|SUPPORT_RECLAIMED|BREAKOUT_INITIAL|BREAKOUT_CONFIRMED|BREAKOUT_FAILED/.test(e.kind))history.push(e.date+'｜'+({SUPPORT_BROKEN:'收盤跌破',SUPPORT_RECLAIMED:'跌破後站回',BREAKOUT_INITIAL:'首次突破',BREAKOUT_CONFIRMED:'收盤突破',BREAKOUT_FAILED:'突破後失守'}[e.kind]||'歷史事件'));
   if(!history.length)history.push('目前沒有已確認的生命線事件。');
   paragraph(history.slice(-7).join('\n'),38,1916,1190,34,C.ink,8,1.39,660);
   if(history.length<=4)paragraph('白話提醒：同一條生命線可能先突破，之後又失守。看最新完成日狀態，不要把以前的突破當成今天仍守住。',38,2164,1190,29,C.muted,3,1.26,590);
   round(14,2332,1256,309,18,'#24271D',C.gold,2);
   title(35,2352,'四、四級風險與技術指標怎麼看？',C.gold);
   const riskGuide=[
    {text:'① 偏強：站穩關卡，均線支持',color:C.green},
    {text:'② 整理：多空還沒分出方向',color:C.gold},
    {text:'③ 偏弱：生命線失守、均線偏弱',color:C.orange},
    {text:'④ 急跌：跌幅超出近期正常波動',color:C.risk}
   ];
   riskGuide.forEach((v,i)=>{const xx=i%2?647:34,yy=2404+Math.floor(i/2)*58;
    round(xx,yy,590,51,9,C.card2,v.color,1.5);
    fit(v.text,xx+12,yy+8,563,28,v.color,720,24);
   });
   const move=intelligence.momentum;
   fit('RSI5 '+num(move.rsi5)+'｜MACD DIF '+num(move.macdDiff)+'（Wilder RSI5；EMA12/26/9）',37,2527,1200,26,C.ink,620,23);
   fit('目前：'+intelligence.phase.label+'。'+intelligence.volume.notice,37,2566,1200,26,C.ink,620,23);
   fit('資料日 '+intelligence.date+'｜依完成日收盤觀察，不用盤中價格冒充收盤。',37,2604,1200,26,C.muted,600,23);
   footer('第 2 / 2 頁　收盤確認｜非交易指令');
  }
  if(pageno===1)page1();else page2();
  if(watermark&&globalThis.ShitouReportWatermark)globalThis.ShitouReportWatermark.apply(canvas);
 };
 const snapshot={life913:intel,phase913:intelligence.phase,code:m.code,name:m.name,date:m.date,close:m.close,line:m.line,state:m.lifecycleState,role:m.currentRole,referenceOnly:m.referenceOnly,ma:m.ma,range:m.range,volume:m.volume,events:m.events,markers:fours.map(k=>({label:k.label,date:k.date})),source:m.source,chartBarDates:bars.map(b=>b.date),chartMa60Available:extendedMA[60].filter(finite).length};
 return [1,2].map(i=>{
  const audit={version:VERSION,release:RELEASE,width:W,height:H,page:i,pages:2,title:i===1?'大盤風險分析':'生命線教學',model:snapshot,marketRisk:intelligence,sourceVerified:true,instrumentType:'TAIEX',unit:'點',marketVolumeMeaning:'集中市場成交股數',volumeConfirmationAllowed:intelligence.volume.verified,chartBars:bars.length,trophy:true,reportOnly:true,originalEventId:m.eventId,researchOnly:true,affectsEligibility:false,affectsRanking:false,automaticTrade:false};
  const filename='石頭少爺_'+RELEASE+'_TAIEX_'+(m.date||'日期待核對').replaceAll('-','')+'_P0'+i+'_'+(i===1?'大盤風險分析':'生命線教學')+'.png';
  const dataset={marketLifeAudit:JSON.stringify(audit),marketRiskAudit:JSON.stringify(intelligence),life98Audit:JSON.stringify(audit),life972Audit:JSON.stringify(audit),life94Audit:JSON.stringify(audit),fullBleed:'true',shareAsSingleImage:'true',filename};
  const render=()=>{const canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;draw(canvas,i);Object.assign(canvas.dataset,dataset);return canvas;};
  return {width:W,height:H,title:i===1?'第 1 頁／大盤風險分析':'第 2 頁／生命線教學',filename,dataset,renderExportRegion:render,toBlob(callback,type='image/png',quality){const c=render();c.toBlob(blob=>{c.width=c.height=1;callback(blob);},type,quality);}};
 });
}
return Object.freeze({RELEASE,VERSION,ready,build,model:Legacy.model,textReport:Legacy.textReport});
});