/* V9.2 independent life-line presentation. Shares no selection or trading controls. */
(function(root,factory){
 const node=typeof module==='object'&&!!module.exports;
 const api=factory(node?require('./kline-life-03-core-v1.js'):root.ShitouKlineLife03);
 if(node)module.exports=api;else root.ShitouKlineLife03Report=api;
})(globalThis,function(Core){
'use strict';
const VERSION='KLINE_LIFE_03_REPORT_V1';
const Layout=typeof module==='object'&&module.exports?require('./research-chart-layout-v921.js'):globalThis.ShitouChartLayout921;
const fmt=x=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(2):'尚未核驗';
const money=x=>typeof x==='number'&&Number.isFinite(x)?fmt(x)+' 元':'價格還沒核對';
const say=value=>Layout.plain(value);
function inspect(a){const study=Core?.evaluate(a)||{state:'INSUFFICIENT_DATA',reason:'生命線模組尚未載入',label:'資料不足',events:[]};return {...study,name:study.name||a?.name||'',code:study.code||a?.code||''};}
function fields(x){
 const event=x.event,dates=event?['K3','K2','K1','K0'].map(k=>k+' '+(event[k.toLowerCase()+'Date']||'日期未提供')).join('｜'):'目前還沒有可成立生命線的K0訊號';
 const anchor=event?(event.side==='BULL'?'下方支撐（K3低點） ':'上方壓力（K3高點） ')+money(event.lifeLinePrice):'目前還沒有可用的生命線';
 const summary={title:'現在怎麼看？',value:Layout.lifeState(x.state,x.label)+'｜'+anchor+'｜已收盤行情 '+(x.date||'日期還沒核對')+'；'+(x.state==='INSUFFICIENT_DATA'?say(x.reason||'資料不足'):'只供盤後觀察，不保證明天漲跌')};
 const details=[
  {title:'這條線是怎麼來的？',value:dates+'；'+anchor+'。K3是這組訊號最早的K棒，K0是訊號成立當天。'},
  {title:'收盤離這條線多遠？',value:'收盤 '+money(x.close)+'；'+(Number.isFinite(x.distancePct)?'距生命線 '+fmt(x.distancePct)+'%':'目前還算不出距離')+'。這是價格距離，不是預測能賺多少；生命線成立後價格固定。'},
  {title:'有沒有確認轉強或轉弱？',value:x.transitionDate?x.transitionDate+'｜'+Layout.eventState(x.transitionReason,x.transitionReason):'還沒有新的收盤確認，不能先說明天已經轉強或轉弱。'},
  {title:'什麼情況可能繼續偏強？',value:say(x.scenario?.bullish||x.reason||'還沒有可用的確認條件')},
  {title:'什麼情況要留意轉弱？',value:say(x.scenario?.bearish||'還沒有可用的參考價')},
  {title:'漲過或跌破，為什麼還要等？',value:say([x.scenario?.neutral,x.scenario?.falseBreak,x.scenario?.falseBreakdown].filter(Boolean).join('；')||'目前還沒有可核對的固定價位')},
  {title:'還有哪些線索？',value:say((x.confirmationEvidence||[]).join('；')||'目前沒有其他已核對的線索支持同一方向')},
  {title:'哪些地方要小心？',value:say([...(x.contradictions||[]),...(x.riskWarnings||[])].join('；')||'目前沒有新增提醒，仍然有交易風險')},
  {title:'資料從哪來？有什麼限制？',value:'使用 '+(x.historyBarCount||0)+' 根已收盤日K。這項方法的獲利表現還沒驗證，不能當成勝率或買賣保證；只作獨立觀察，不影響原本的選股資格。'}
 ];
 return {summary,details};
}
function lines(x){const v=fields(x);return [v.summary,...v.details].map(f=>'【'+f.title+'】'+f.value);}
function page(x,{document:doc=globalThis.document,displayCode=globalThis.ShitouReleaseV50?.displayCode||'V9.3',watermark=false,bars:source=[]}={}){
 if(!doc?.createElement)return null;
 const W=1284,MIN=2778,M=72,WIDTH=W-2*M;
 const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const v=fields(x);
 // Use only the dated bars supplied to the original life-line study. No fallback to ABC/model history.
 const bars=Array.isArray(source)&&source.at(-1)?.date===x.date?source.slice(-80):[];
 const price=x.event?.lifeLinePrice,validPrice=Number.isFinite(price)&&price>0;
 const values=bars.flatMap(b=>[b.low,b.high]).filter(Number.isFinite);if(validPrice)values.push(price);
 const lo=values.length?Math.min(...values):0,hi=values.length?Math.max(...values):1,pad=Math.max((hi-lo)*.12,hi*.01),min=lo-pad,max=hi+pad;
 const geometry=Layout.eventLayout(x.event,bars,{min,max});
 const omissions=geometry.events.filter(e=>e.status!=='VISIBLE').map(e=>e.key+' '+(e.date||'日期未提供')+'｜'+(e.status==='OUT_OF_RANGE'?'日期在這張圖以外，沒有硬畫在圖內':'缺少當天的K棒，無法標在圖上'));
 const hasChart=bars.length>0,top=hasChart?1760:600;
 const items=[{title:'現在怎麼看？哪些地方要小心？',value:say([Layout.lifeState(x.state,x.label),...(x.contradictions||[]),...(x.riskWarnings||[])].join('；'))+'\n20日平均價（MA20）｜'+money(x.indicators?.ma20)},
  {title:'下一個交易日，收盤要看什麼？',value:say([x.scenario?.bullish,x.scenario?.bearish,x.scenario?.neutral].filter(Boolean).join('\n')||x.reason||'目前還沒有可用的確認條件')},
  {title:'盤中漲過或跌破，先別急著下結論',value:say([x.scenario?.falseBreak,x.scenario?.falseBreakdown].filter(Boolean).join('\n')||'目前沒有可用的訊號，先等資料完整')},
  {title:'這條線是怎麼來的？',value:[x.event?['K3','K2','K1','K0'].map(k=>k+' '+(x.event[k.toLowerCase()+'Date']||'日期未提供')).join('｜'):'目前還沒有可用的訊號','K3是最早那根K棒，K0是訊號成立當天。','生命線成立 '+(x.event?.signalDate||'尚未成立'),'目前這條線：'+Layout.eventState(x.currentState,Layout.lifeState(x.state,x.label)),...omissions,'圖表 '+(hasChart?bars[0].date+'～'+bars.at(-1).date+'；'+bars.length+'根日K':'缺少同一天的日K，無法對照')].join('\n')},
  v.details[1],
  ...[v.details[2],v.details[6],v.details[8]]];
 const cards=Layout.blocks(ctx,items,{top,width:WIDTH}),H=Math.max(MIN,cards.at(-1).top+cards.at(-1).height+170);
 const audit={version:VERSION,model:x.model,date:x.date,code:x.code,width:W,height:H,noClipping:true,
  eventId:x.event?.eventId||null,k0Date:x.event?.k0Date||null,k1Date:x.event?.k1Date||null,k2Date:x.event?.k2Date||null,k3Date:x.event?.k3Date||null,lifeLinePrice:x.event?.lifeLinePrice||null,signalDate:x.event?.signalDate||null,
  state:x.state,currentState:x.currentState,studyOnly:true,performance:'NOT_VALIDATED',fieldCount:cards.length,
  barDates:bars.map(b=>b.date),geometry,fields:[v.summary,...items],section:'LIFE_CHART'};
 const paint=()=>{
  const c=doc.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');if(!q)throw Error('生命線圖片Canvas不可用');
  q.textBaseline='top';q.fillStyle='#0b2032';q.fillRect(0,0,W,H);
  const text=(t,y,size=38,color='#e7f0f6')=>{Layout.font(q,size);q.fillStyle=color;let yy=y;for(const row of Layout.wrap(q,t,WIDTH,size)){q.fillText(row,M,yy);yy+=size+14;}};
  text('石頭少爺 '+displayCode+'｜生命線研究',60,46);
  text(String(x.name||x.code||'個股')+'（'+String(x.code||'—')+'）',140,62);
  text('已收盤行情 '+String(x.date||'日期還沒核對')+'｜收盤 '+money(x.close),230,36,'#b8d2e3');
  text(Layout.lifeState(x.state,x.label),310,54,'#92ded4');
  text(validPrice?(x.event.side==='BULL'?'下方支撐':'上方壓力')+'｜'+money(price):'生命線還沒成立',395,50);
  text('成立 '+(x.event?.signalDate||'尚未確認')+'｜用收盤確認，不保證獲利',478,34,'#b8d2e3');
  if(hasChart){
   const p=geometry.plot,yp=n=>p.y+p.height-(n-min)/(max-min)*p.height,xp=i=>p.x+(i+.5)*geometry.dx;
   q.lineWidth=1;for(let i=0;i<=4;i++){const y=p.y+i*p.height/4;q.strokeStyle='#29495d';q.beginPath();q.moveTo(p.x,y);q.lineTo(p.x+p.width,y);q.stroke();Layout.font(q,30);q.fillStyle='#b8d2e3';q.fillText(fmt(max-(max-min)*i/4),10,y-18);}
   for(const [i,b] of bars.entries()){const xx=xp(i);q.strokeStyle=q.fillStyle=b.close>=b.open?'#ff8b95':'#6adbb4';q.lineWidth=3;q.beginPath();q.moveTo(xx,yp(b.high));q.lineTo(xx,yp(b.low));q.stroke();q.fillRect(xx-geometry.dx*.28,Math.min(yp(b.open),yp(b.close)),Math.max(2,geometry.dx*.56),Math.max(3,Math.abs(yp(b.open)-yp(b.close))));}
   if(validPrice){q.strokeStyle='#ffdc8c';q.setLineDash([12,8]);q.beginPath();q.moveTo(p.x,yp(price));q.lineTo(p.x+p.width,yp(price));q.stroke();q.setLineDash([]);Layout.font(q,34);q.fillStyle='#ffdc8c';q.fillText('固定生命線 '+fmt(price)+' 元',p.x,1650);}
   geometry.labels.forEach((e,i)=>{q.strokeStyle='#b8d2e3';q.lineWidth=2;q.beginPath();q.moveTo(e.x+e.width/2,e.y+e.height);q.lineTo(e.x+e.width/2,715+i*26);q.lineTo(e.anchorX,820+i*6);q.lineTo(e.anchorX,e.anchorY);q.stroke();q.fillStyle='#163b52';q.fillRect(e.x,e.y,e.width,e.height);Layout.font(q,38,750);q.fillStyle='#ffdc8c';q.fillText(e.key,e.x+14,e.y+5);Layout.font(q,31);q.fillStyle='#eef6ff';q.fillText(e.date,e.x+14,e.y+54);q.beginPath();q.arc(e.anchorX,e.anchorY,6,0,Math.PI*2);q.fill();});
   Layout.font(q,32);q.fillStyle='#b8d2e3';q.fillText(bars[0].date,p.x,1600);q.fillText(bars.at(-1).date,p.x+p.width-210,1600);
   if(!x.event)text('目前沒有可成立生命線的 K0～K3 訊號',650,38);
   text('每根K棒代表一天；紅：收盤≥開盤；綠：收盤<開盤',1700,32,'#b8d2e3');
  }else text('缺少同一天的日K，先不畫事件位置。',560,34,'#ffdc8c');
  Layout.paintBlocks(q,cards);
  text('只供觀察，不是買賣通知｜'+displayCode,H-90,32,'#b8d2e3');
  if(watermark&&globalThis.ShitouReportWatermark?.paint)globalThis.ShitouReportWatermark.paint(q,{width:W,height:H,type:'all'});
  Object.assign(c.dataset,{life03Audit:JSON.stringify(audit),release:displayCode,fullBleed:'true',shareAsSingleImage:'true'});return c;
 };
 return {width:W,height:H,dataset:{life03Audit:JSON.stringify(audit),release:displayCode,shareAsSingleImage:'true'},renderExportRegion:paint,
  toBlob(callback,type='image/png'){const c=paint();c.toBlob(blob=>{c.width=c.height=1;callback(blob);},type);}};
}
return Object.freeze({VERSION,inspect,fields,lines,page});
});
