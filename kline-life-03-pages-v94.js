/* V9.4 presentation only. Every page is composed independently; no signal calculation. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./research-chart-layout-v921.js'):root.ShitouChartLayout921);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouLifePages94=api;})(globalThis,function(L){
'use strict';
const W=1284,H=2778,M=64,CW=W-2*M,BOTTOM=2600,VERSION='LIFE_REPORT_PAGES_V94';
const C={bg:'#0B2032',card:'#102E43',text:'#EDF6FF',mint:'#8FF5D3',gold:'#FFD76A',risk:'#FF8C93',history:'#AFC2D5',muted:'#B8CBE2',up:'#FF8392',down:'#5ED3B0',grid:'#345267'};
const number=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'資料不足',money=v=>typeof v==='number'&&Number.isFinite(v)?number(v)+' 元':'資料不足';
const stateName={BREAKOUT_CONFIRMED:'收盤突破',BREAKOUT_INITIAL:'剛收盤突破',BREAKOUT_HELD:'突破後持續站穩',BREAKOUT_FAILED:'突破後又跌回來',SUPPORT_WATCH:'下方支撐仍在觀察',SUPPORT_BROKEN:'跌破重要支撐',SUPPORT_RECLAIMED:'跌破後重新站回',RETEST_HELD:'回頭測試後仍守住',RESISTANCE_WATCH:'還沒突破上方壓力',HISTORICAL_REFERENCE:'以前的重要參考價',INSUFFICIENT_DATA:'資料不足，無法確認',SUPPORT_RECLAIMED_INTRADAY:'盤中跌過、收盤守回（不是正式收復）',SUPPORT_TEST:'收盤剛好等於支撐',RESISTANCE_TEST:'收盤剛好等於壓力',BREAKOUT_ATTEMPT:'盤中漲過、收盤未突破'};
function build(study,display,{document:doc=globalThis.document,watermark=false}={}){
 if(!doc?.createElement)return [];study=JSON.parse(JSON.stringify(study));const probe=doc.createElement('canvas'),q=probe.getContext('2d');if(!q)return [];
 // Only the core's validated snapshot is allowed to enter a chart.
 const bars=(study.validatedBars||[]).filter(b=>b.date<=(study.dataAsOf||study.date)),e=study.event,t=study.currentTrend||{},f=display.fields,view=f.overview;
 const model=JSON.parse(JSON.stringify({release:'V9.4',analysisVersion:study.version,analysisModel:study.model,code:study.code,name:study.name,date:study.dataAsOf||study.date,close:study.close??null,lifecycleState:study.lifecycleState,currentRole:study.currentRole,referenceOnly:!!study.referenceOnly,line:e?.lifeLinePrice??null,trend:t,chaseRisk:study.chaseRisk||null,scenario:study.scenario||null,sourceVolumeAudit:study.sourceVolumeAudit||null,historyBarCount:study.historyBarCount||0,fields:f}));
 const pages=[];let current,y;
 const wrap=(value,width,size)=>L.wrap(q,String(value??'資料不足'),width,size);
 function text(value,x,top,width,size=32,color=C.text,weight=600){const rows=wrap(value,width,size);current.ops.push({kind:'text',rows,x,y:top,width,size,color,weight,height:rows.length*(size+12)});return rows.length*(size+12);}
 function start(title,stockHeader=false){current={title,ops:[],charts:[]};pages.push(current);text('石頭少爺 V9.4｜生命線研究',M,48,CW,40,C.text,750);text(title,M,112,CW,34,C.muted);y=177;
  if(stockHeader){const name=(study.name||'個股')+'（'+(study.code||'代號未提供')+'）';const nameRows=wrap(name,CW,66);y+=text(nameRows.length<=3?name:'個股 '+(study.code||'代號未提供')+'｜完整名稱見技術頁',M,y,CW,66,C.text,800)+12;y+=text((model.date||'行情日期尚未核對')+'｜最新完成交易日',M,y,CW,32,C.muted)+10;y+=text('收盤 '+money(model.close),M,y,CW,72,C.gold,800)+24;
  }else{y+=text((study.name&&wrap(study.name,CW,36).length<=2?study.name:'個股')+'（'+(study.code||'代號未提供')+'）｜'+(model.date||'日期待核對'),M,y,CW,36,C.muted)+24;}
 }
 function ensure(height,title=current.title){if(y+height>BOTTOM)start(title+'（續）');}
 function card(title,value,{size=32,color=C.text}={}){
  const rows=wrap(value,CW-40,size),titles=wrap(title,CW-40,38),head=titles.length*50+18,available=BOTTOM-y;
  if(available<head+size+12+32){start(current.title.replace(/（續）$/,'')+'（續）');}
  let offset=0,part=0;
  while(offset<rows.length){const room=Math.floor((BOTTOM-y-head-32)/(size+12));if(room<1){start(current.title.replace(/（續）$/,'')+'（續）');continue;}
   const chunk=rows.slice(offset,offset+room),height=head+chunk.length*(size+12)+32;
   current.ops.push({kind:'box',x:M,y,width:CW,height,color:C.card});text(title+(part?'（續）':''),M+20,y+16,CW-40,38,C.mint,750);text(chunk.join('\n'),M+20,y+head,CW-40,size,color);y+=height+18;offset+=chunk.length;part++;if(offset<rows.length)start(current.title.replace(/（續）$/,'')+'（續）');
  }
 }
 function metrics(items,height=144){ensure(height+18);const gap=18,width=(CW-gap*(items.length-1))/items.length;items.forEach((item,i)=>{const x=M+i*(width+gap);current.ops.push({kind:'box',x,y,width,height,color:C.card});text(item[0],x+20,y+16,width-40,30,C.muted);text(item[1],x+20,y+63,width-40,item[3]||46,item[2]||C.gold,750);});y+=height+18;}
 function priceCard(title,price,note,color){const head=wrap(title,CW-40,38).length*50,noteRows=wrap(note,CW-40,32),height=16+head+8+64+8+noteRows.length*44+20;ensure(height+18);current.ops.push({kind:'box',x:M,y,width:CW,height,color:C.card});text(title,M+20,y+16,CW-40,38,C.mint,750);text(money(price),M+20,y+16+head+8,CW-40,52,color,750);text(note,M+20,y+16+head+80,CW-40,32);y+=height+18;}
 function chart(rows,title,history,height=636){history=history&&!!e;ensure(height+18);const top=y,plot={x:M+150,y:top+174,width:CW-390,height:height-(history?360:400)};
  const values=rows.flatMap(b=>[b.low,b.high]);const means={};for(const n of [5,10])means[n]=rows.map(b=>{const i=bars.indexOf(b);return i>=n-1?bars.slice(i-n+1,i+1).reduce((a,b)=>a+b.close,0)/n:null;});
  if(history&&e)values.push(e.lifeLinePrice);if(!history)values.push(...Object.values(means).flat().filter(Number.isFinite));
  const lo=values.length?Math.min(...values):0,hi=values.length?Math.max(...values):1,pad=Math.max((hi-lo)*.12,Math.abs(hi)*.01,.01),min=lo-pad,max=hi+pad;
  const c={kind:'chart',rows,history,top,height,plot,min,max,means,title,event:history?e:null,volumeUncertain:!!study.sourceVolumeAudit?.uncertain};c.annotations=chartAnnotations(q,c,study);current.ops.push(c);current.charts.push({title,min,max,barDates:rows.map(b=>b.date),plot,annotations:c.annotations});y+=height+18;
 }
 // Page 1: independently useful current analysis. Detailed provenance belongs on the technical page.
 start('第 1 頁／個股分析',true);
 const trend={STRONG:'目前偏強',WEAK:'目前偏弱',NEUTRAL:'盤整／待確認'}[t.state]||'資料不足';
 const risk=study.chaseRisk?.level==='ELEVATED'?'追價風險較高':study.chaseRisk?.level==='INSUFFICIENT_DATA'||!Number.isFinite(t.atr14)?'資料不足，無法評估':'追價風險仍需留意';
 metrics([['目前股價方向',trend,C.mint,48],['追價風險',risk,C.risk,40]],160);
 metrics([[view.recentBarCount?'近'+view.recentBarCount+'個交易日高點':'近期高點｜資料不足',money(t.recentHigh)],[view.recentBarCount?'近'+view.recentBarCount+'個交易日低點':'近期低點｜資料不足',money(t.recentLow)]],142);
 const role=e?(e.referenceOnly?'歷史生命線｜以前的重要價位':e.currentRole==='SUPPORT'?'目前下方支撐':'目前上方壓力'):'生命線尚未成立';
 if(e)priceCard(role,e.lifeLinePrice,'取 '+e.k3Date+' K3'+view.sourcePoint+'；'+e.k0Date+' 收盤後成立。\n'+(e.referenceOnly?(e.firstBreakoutDate?'過去已收盤突破；現在以近期高低點、平均價為主。':'這是以前形成的價位，現在優先看近期高低點與平均價。'):f.title+'；是否守住，要看完成日 K 的收盤。'),e.referenceOnly?C.history:e.currentRole==='SUPPORT'?C.mint:C.gold);
 else card(role,'目前沒有可確認的生命線關卡；近期高低點仍只是觀察價格。');
 const i3=bars.findIndex(b=>b.date===e?.k3Date),i0=bars.findIndex(b=>b.date===e?.k0Date),ib=bars.findIndex(b=>b.date===(e?.firstBreakoutDate||e?.firstBreakdownDate));
 const history=e?bars.slice(Math.max(0,i3-2)):bars.slice(-10);
 chart(history,e?'圖 A｜歷史生命線怎麼形成？':'圖 A｜尚無生命線，先看已收盤行情',true,760);
 card('現在怎麼看？',[view.trendSummary,view.riskReasons.length?view.riskReasons.join('；')+'。':null,study.sourceVolumeAudit?.uncertain?'成交量待核對，暫不作量能確認。':null].filter(Boolean).join('\n'));
 const sc=study.scenario||{};
 card('下一個交易日要看什麼？','如果繼續上漲｜'+(sc.bullish||f.details[3].value)+'\n如果開始回跌｜'+(sc.bearish||f.details[4].value)+'\n如果上下整理｜先看當天收盤，盤中短暫穿越不算正式突破或跌破。');
 card('已確認的歷史紀錄',e?e.signalDate+'：形成 '+money(e.lifeLinePrice)+' 生命線。\n'+(e.firstBreakoutDate?e.firstBreakoutDate+'：首次收盤突破。':e.firstBreakdownDate?e.firstBreakdownDate+'：首次收盤跌破。':'尚無首次收盤突破或跌破。')+' '+(e.referenceOnly?'現在主要作為歷史參考。':f.title+'。'):'尚無成立事件，資料不足時不補造日期或價位。');
 // Page 2 is genuine teaching, distinct from the actual historical quotation chart.
 start('策略說明｜什麼是生命線？');
 card('先認識生命線',display.teaching[0].value);
 // Exact descriptions originate in the report/core contract, including all exclusion conditions.
 card('K3 → K2 → K1 → K0 → 後續觀察',display.teaching[1].value);
 card('用收盤確認｜盤中碰到不算',display.teaching[2].value);
 card('回頭測試、歷史價位與追價風險',display.teaching[3].value);
 ensure(250);current.ops.push({kind:'schematic',top:y,height:230});y+=250;
 card('為什麼看收盤？','盤中可能先衝過、又掉回；也可能先跌破、又站回。用收盤才能分清短暫穿越與正式狀態改變。');
 card('新手三步驟','① 先看目前方向，同時看追價風險。\n② 分清有效支撐、壓力與歷史參考價。\n③ 看下一個收盤是否守住，不只看盤中。');
 // Page 3+ contains complete evidence. Overflow creates independent continuation pages.
 start('技術數據與歷史證據');
 if(wrap(study.name||'',CW,36).length>3)card('股票完整名稱',study.name);
 chart(bars.slice(-10),'圖 B｜最近股價怎麼走？',false,730);
 card('研究範圍與圖表範圍','研究使用 '+model.historyBarCount+' 根完成日 K；圖 A 顯示 '+history.length+' 根；圖 B 顯示 '+Math.min(10,bars.length)+' 根。兩圖使用各自的價格座標，沒有拼接不同日期。');
 for(const detail of [f.details[6],f.details[7],f.details[0],f.details[1],f.details[2],f.details[5],f.details[8]])card(detail.title,detail.value);
 card('最近確認的重要高低點','重要高點：'+(t.swingHigh?t.swingHigh.date+' '+money(t.swingHigh.price)+'；確認日 '+t.swingHigh.confirmedAt:'資料不足或尚未形成')+'\n重要低點：'+(t.swingLow?t.swingLow.date+' '+money(t.swingLow.price)+'；確認日 '+t.swingLow.confirmedAt:'資料不足或尚未形成'));
 for(const ev of study.events||[]){const records=(ev.events||[]).map(v=>v.date+'｜'+(stateName[v.kind]||'狀態待核對')+' '+money(v.price)+(v.confirmedAt?'（收盤確認）':/_TEST$/.test(v.kind)?'（收盤相等，沒有正式轉換）':'（僅盤中測試）'));
  card('歷史事件｜'+ev.signalDate,'原始'+(ev.side==='BULL'?'支撐':'壓力')+' '+money(ev.lifeLinePrice)+'；目前'+(ev.referenceOnly?'歷史參考':ev.currentRole==='SUPPORT'?'下方支撐':ev.currentRole==='RESISTANCE'?'上方壓力':'角色待確認')+'。\nK3 '+ev.k3Date+'｜K2 '+ev.k2Date+'｜K1 '+ev.k1Date+'｜K0 '+ev.k0Date+'\n'+(records.join('\n')||'尚無後續穿越或測試事件。')+'\n事件編號 '+ev.eventId);
 }
 const previous=bars.slice(-6,-1),baseline=previous.length===5?previous.reduce((sum,b)=>sum+(b.volume||0),0)/5:null;
 card('成交量原始證據',study.sourceVolumeAudit?.uncertain?'成交量待核對，暫不作量能確認。\n封存 '+(study.sourceVolumeAudit.archiveLastVolume??'未提供')+' 股；核對來源 '+(study.sourceVolumeAudit.latestOfficialVolume??'未提供')+' 股。':'當日成交量 '+(bars.at(-1)?.volume??'資料不足')+' 股；前5根完成日 K 平均 '+(baseline===null?'資料不足':number(baseline)+' 股')+'。\n量能倍數依核心資料；放量本身不保證繼續上漲。');
 card('分析模型與研究限制','呈現版本 V9.4；判讀沿用 V9.3.2 核心。\n模型 '+(study.model||'尚未提供')+'；原始版本 '+(study.version||'尚未提供')+'。\n資料時間 '+(model.date||'尚未核對')+'；獲利表現尚未驗證。\n僅供研究；不影響選股資格、評分、排名，也不自動交易。');
 const count=pages.length;
 const descriptors=pages.map((plan,index)=>{
  const audit={version:VERSION,release:'V9.4',page:index+1,pages:count,title:plan.title,width:W,height:H,model,charts:plan.charts,text:plan.ops.filter(o=>o.kind==='text').map(o=>({value:o.rows.join('\n'),x:o.x,y:o.y,width:o.width,height:o.height,size:o.size})),barDates:bars.map(b=>b.date),researchOnly:true,performanceValidated:false};
  const suffix=index===0?'個股分析':plan.title.includes('策略')?'策略說明':'技術歷史';const filename='石頭少爺_V9.4_'+(study.code||'未提供')+'_'+(model.date||'日期未提供').replaceAll('-','')+'_P'+String(index+1).padStart(2,'0')+'_'+suffix+'.png';
  function paint(){const canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');c.textBaseline='top';c.fillStyle=C.bg;c.fillRect(0,0,W,H);
   for(const o of plan.ops){if(o.kind==='box'){c.fillStyle=o.color;c.beginPath();c.roundRect(o.x,o.y,o.width,o.height,18);c.fill();c.strokeStyle=C.grid;c.lineWidth=1;c.stroke();}else if(o.kind==='text'){L.font(c,o.size,o.weight);c.fillStyle=o.color;o.rows.forEach((r,i)=>c.fillText(r,o.x,o.y+i*(o.size+12)));}else if(o.kind==='chart')paintChart(c,o,study,bars);else paintSchematic(c,o);}
   L.font(c,28);c.fillStyle=C.muted;c.fillText('研究參考，不是買賣建議，不能保證獲利｜V9.4',M,2642);c.fillText('第 '+(index+1)+'／'+count+' 頁｜完整資料見技術頁',M,2690);
   if(watermark&&globalThis.ShitouReportWatermark?.paint)globalThis.ShitouReportWatermark.paint(c,{width:W,height:H,type:'all'});Object.assign(canvas.dataset,dataset);return canvas;}
  const dataset={life94Audit:JSON.stringify(audit),fullBleed:'true',shareAsSingleImage:'true',iphoneFullScreen:'1284x2778',release:'V9.4',filename};
  return {width:W,height:H,dataset,filename,title:plan.title,renderExportRegion:paint,toBlob(callback,type='image/png',quality){const c=paint();c.toBlob(blob=>{c.width=c.height=1;callback(blob);},type,quality);}};
 });probe.width=probe.height=1;return descriptors;
}
function label(c,value,x,y,size=28,color=C.text){L.font(c,size);c.fillStyle=color;c.fillText(value,x,y);}
// Presentation geometry only. Price and event evidence always come from the core snapshot.
function chartAnnotations(q,o,study){
 const {rows,plot:p,min,max,history,event:e}=o,yp=value=>p.y+p.height-(value-min)/(max-min)*p.height,dx=p.width/(rows.length||1),xp=i=>p.x+(i+.5)*dx;
 if(!rows.length)return {line:null,latest:null,firstCross:null,source:null,tags:[]};
 const active=history?e:study.event&&!study.event.referenceOnly?study.event:null;
 const line=active&&active.lifeLinePrice>=min&&active.lifeLinePrice<=max?{kind:'LIFE_LINE',price:active.lifeLinePrice,referenceOnly:!!active.referenceOnly,role:active.currentRole,label:active.referenceOnly?'歷史生命線':active.currentRole==='SUPPORT'?'下方支撐':'上方壓力',color:active.referenceOnly?C.history:active.currentRole==='SUPPORT'?C.mint:C.gold,anchorY:yp(active.lifeLinePrice)}:null;
 const latestIndex=rows.findIndex(b=>b.date===(study.dataAsOf||study.date));
 const latest=latestIndex>=0?{kind:'LATEST_CLOSE',label:'最新收盤',price:rows[latestIndex].close,date:rows[latestIndex].date,color:C.text,x:xp(latestIndex),anchorY:yp(rows[latestIndex].close)}:null;
 const firstDate=e?.firstBreakoutDate||e?.firstBreakdownDate,firstIndex=rows.findIndex(b=>b.date===firstDate),sourceIndex=rows.findIndex(b=>b.date===e?.k3Date);
 const firstCross=history&&e&&firstIndex>=0?{kind:e.firstBreakoutDate?'BREAKOUT':'BREAKDOWN',date:firstDate,price:rows[firstIndex].close,x:xp(firstIndex),y:yp(rows[firstIndex].close),markerY:yp(e.firstBreakoutDate?rows[firstIndex].high:rows[firstIndex].low),color:e.firstBreakoutDate?C.gold:C.risk}:null;
 const source=history&&e&&sourceIndex>=0?{date:e.k3Date,price:e.lifeLinePrice,point:e.side==='BULL'?'最低價':'最高價',x:xp(sourceIndex),y:yp(e.lifeLinePrice)}:null;
 const tags=L.spread([line,latest].filter(Boolean).map(item=>{L.font(q,38);const width=Math.max(176,Math.min(W-M-(p.x+p.width+18),q.measureText(number(item.price)).width+28));return {...item,x:p.x+p.width+18,y:item.anchorY-44,width,height:88};}),{min:p.y,max:p.y+p.height,gap:12,dimension:'y',extent:'height'});
 return {line,latest,firstCross,source,tags};
}
function paintLifeLine(c,line,p){if(!line)return;c.strokeStyle=line.color;c.lineWidth=5;c.setLineDash([16,9]);c.beginPath();c.moveTo(p.x,line.anchorY);c.lineTo(p.x+p.width,line.anchorY);c.stroke();c.setLineDash([]);c.lineWidth=1;}
function paintPriceTag(c,tag,p){
 c.strokeStyle=tag.color;c.lineWidth=2;c.beginPath();c.moveTo(p.x+p.width,tag.anchorY);c.lineTo(tag.x-8,tag.y+tag.height/2);c.lineTo(tag.x,tag.y+tag.height/2);c.stroke();
 c.fillStyle=tag.color;c.beginPath();c.roundRect(tag.x,tag.y,tag.width,tag.height,10);c.fill();
 label(c,tag.label,tag.x+12,tag.y+5,26,C.bg);label(c,number(tag.price),tag.x+12,tag.y+39,38,C.bg);
}
function paintChart(c,o,study,bars){
 const {rows,plot:p,min,max,top,history}=o,dx=p.width/(rows.length||1),xp=i=>p.x+(i+.5)*dx,yp=v=>p.y+p.height-(v-min)/(max-min)*p.height,a=o.annotations;
 label(c,o.title,M,top,38,C.mint);
 if(!rows.length){label(c,'完成日 K 資料不足，暫不繪製價格。',M,top+75,32);return;}
 if(history&&o.event){
  const e=o.event;
  ['K3','K2','K1','K0'].forEach((key,j)=>{const date=e[key.toLowerCase()+'Date'],i=rows.findIndex(b=>b.date===date),x=M+j*(CW/4);
   label(c,key,x+8,top+58,30,C.gold);label(c,date||'日期未提供',x+8,top+99,28);
   if(i>=0){c.strokeStyle=C.history;c.lineWidth=1;c.beginPath();c.moveTo(x+95,top+137);c.lineTo(xp(i),key==='K3'?yp(e.lifeLinePrice):yp(rows[i].high));c.stroke();}
  });
 }else{
  label(c,'黃：5日平均價；青：10日平均價',M,top+65,30,C.muted);
  const active=study.event&&!study.event.referenceOnly?study.event:null;
  label(c,active?(active.currentRole==='SUPPORT'?'目前下方支撐 ':'目前上方壓力 ')+money(active.lifeLinePrice)+(a.line?'':'（在本圖範圍外）'):'近期高低點是觀察價格，不保證守得住。',M,top+108,28,active?C.gold:C.muted);
 }
 for(let i=0;i<=4;i++){
  const yy=p.y+p.height*i/4,v=max-(max-min)*i/4;c.strokeStyle=C.grid;c.lineWidth=1;c.beginPath();c.moveTo(p.x,yy);c.lineTo(p.x+p.width,yy);c.stroke();
  const s=number(v);L.font(c,26);c.fillStyle=C.muted;c.fillText(s,p.x-12-c.measureText(s).width,yy-13);
  // The other axis remains visible when a dedicated price tag replaces a duplicate tick.
  if(!a.tags.some(t=>yy+18>t.y&&yy-18<t.y+t.height))c.fillText(s,p.x+p.width+12,yy-13);
 }
 rows.forEach((b,i)=>{c.fillStyle=c.strokeStyle=b.close>=b.open?C.up:C.down;c.lineWidth=3;c.beginPath();c.moveTo(xp(i),yp(b.high));c.lineTo(xp(i),yp(b.low));c.stroke();c.fillRect(xp(i)-dx*.27,Math.min(yp(b.open),yp(b.close)),Math.max(2,dx*.54),Math.max(3,Math.abs(yp(b.open)-yp(b.close))));});
 if(history)paintLifeLine(c,a.line,p);
 if(history&&o.event){
  if(a.source){const s=a.source;c.fillStyle=C.bg;c.strokeStyle=a.line?.color||C.history;c.lineWidth=3;c.beginPath();c.moveTo(s.x,s.y-9);c.lineTo(s.x+9,s.y);c.lineTo(s.x,s.y+9);c.lineTo(s.x-9,s.y);c.closePath();c.fill();c.stroke();}
  if(a.firstCross){const f=a.firstCross,d=f.kind==='BREAKOUT'?-1:1;c.fillStyle=f.color;c.beginPath();c.moveTo(f.x,f.markerY+d*24);c.lineTo(f.x-10,f.markerY+d*6);c.lineTo(f.x+10,f.markerY+d*6);c.closePath();c.fill();}
  label(c,'虛線：'+(o.event.referenceOnly?'歷史生命線':'生命線')+' '+money(o.event.lifeLinePrice)+'｜取 K3 '+(a.source?.point||'原始價位'),M,top+o.height-130,30,a.line?.color||C.history);
  label(c,a.firstCross?(a.firstCross.kind==='BREAKOUT'?'▲ 首次收盤突破 ':'▼ 首次收盤跌破 ')+a.firstCross.date+'｜當天收盤 '+money(a.firstCross.price):'尚無首次收盤突破或跌破',M,top+o.height-88,28,a.firstCross?.color||C.muted);
 }else{
  for(const [n,color]of [[5,C.gold],[10,C.mint]]){c.strokeStyle=color;c.lineWidth=3;c.beginPath();let started=false;o.means[n].forEach((v,i)=>{if(v===null)return;if(!started)c.moveTo(xp(i),yp(v));else c.lineTo(xp(i),yp(v));started=true;});c.stroke();}
  paintLifeLine(c,a.line,p);
  const maxVol=Math.max(1,...rows.map(b=>b.volume||0));rows.forEach((b,i)=>{const h=(b.volume||0)/maxVol*50;c.fillStyle=b.close>=b.open?C.up:C.down;c.fillRect(xp(i)-dx*.25,top+o.height-110-h,dx*.5,h);});
  label(c,o.volumeUncertain?'封存成交量待核對，暫不作量能確認':'下方：成交量（股數）',M,top+o.height-88,26,C.muted);
 }
 if(a.latest){c.fillStyle=C.bg;c.strokeStyle=C.text;c.lineWidth=3;c.beginPath();c.arc(a.latest.x,a.latest.anchorY,6,0,Math.PI*2);c.fill();c.stroke();}
 for(const tag of a.tags)paintPriceTag(c,tag,p);
 label(c,rows[0].date,p.x,p.y+p.height+14,26,C.muted);L.font(c,26);const last=rows.at(-1).date;label(c,last,p.x+p.width-c.measureText(last).width,p.y+p.height+14,26,C.muted);
 label(c,'本圖截至 '+rows.at(-1).date+'｜最新收盤 '+money(study.close)+(history?'；近期細節見圖 B':''),M,top+o.height-44,26,C.gold);
}
function paintSchematic(c,o){label(c,'示意教學｜不是實際行情',M,o.top,30,C.muted);const panels=[{title:'盤中越過壓力，收盤掉回',x:M,close:130,high:45,low:170,color:C.down},{title:'盤中跌破支撐，收盤站回',x:M+CW/2+20,close:75,high:40,low:175,color:C.up}];for(const p of panels){label(c,p.title,p.x,o.top+46,28);c.strokeStyle=C.gold;c.setLineDash([8,6]);c.beginPath();c.moveTo(p.x,o.top+120);c.lineTo(p.x+500,o.top+120);c.stroke();c.setLineDash([]);c.strokeStyle=c.fillStyle=p.color;c.lineWidth=4;c.beginPath();c.moveTo(p.x+220,o.top+p.high+40);c.lineTo(p.x+220,o.top+p.low+40);c.stroke();c.fillRect(p.x+204,o.top+p.close+40,32,30);label(c,p.close>100?'未確認突破':'未確認跌破',p.x,o.top+214,28,C.mint);}}
return Object.freeze({VERSION,width:W,height:H,build,number,money,chartAnnotations});
});
