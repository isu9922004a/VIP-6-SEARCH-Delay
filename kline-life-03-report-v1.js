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
function inspect(a){const study=Core?.evaluate(a)||{state:'INSUFFICIENT_DATA',reason:'生命線模組尚未載入',label:'資料不足',events:[]};return {...study,name:study.name||a?.name||'',code:study.code||a?.code||''};}
function fields(x){
 const event=x.event,dates=event?['K0 '+event.k0Date,'K1 '+event.k1Date,'K2 '+event.k2Date,'K3 '+event.k3Date].join('｜'):'尚無成立的0號K';
 const anchor=event?(event.side==='BULL'?'3號K多方支撐 ':'3號K空方壓力 ')+fmt(event.lifeLinePrice)+'元':'目前沒有有效生命線';
 const summary={title:'生命線現況',value:x.label+'｜'+anchor+'｜完成日K '+(x.date||'尚未核驗')+'；'+(x.state==='INSUFFICIENT_DATA'?(x.reason||'資料不足'):'盤後研究，不保證隔日漲跌')};
 const details=[
  {title:'生命線｜訊號日期與來源',value:dates+'；'+anchor+'；事件 '+(event?.eventId||'未形成')},
  {title:'生命線｜強弱與距離',value:'目前 '+x.label+'；收盤 '+fmt(x.close)+'元；距生命線 '+fmt(x.distancePct)+'%；生命線成立後價格固定'},
  {title:'生命線｜轉折及失效',value:x.transitionDate?'狀態轉移 '+x.transitionDate+'；'+(x.transitionReason||'條件已確認'):'尚無完成日K的轉折確認；不能預判明日已轉強或轉弱'},
  {title:'生命線｜偏多確認',value:x.scenario?.bullish||x.reason||'訊號尚未形成'},
  {title:'生命線｜偏空確認',value:x.scenario?.bearish||'無有效結構價位'},
  {title:'生命線｜盤整與假突破',value:[x.scenario?.neutral,x.scenario?.falseBreak,x.scenario?.falseBreakdown].filter(Boolean).join('；')||'尚無可確認的固定關卡'},
  {title:'生命線｜多空證據',value:(x.confirmationEvidence||[]).join('；')||'未出現其他可核驗的同向確認'},
  {title:'生命線｜矛盾與風險',value:[...(x.contradictions||[]),...(x.riskWarnings||[])].join('；')||'目前未新增風險提示；不等於零風險'},
  {title:'生命線｜資料與限制',value:'V9.2-KLINE-LIFE03｜'+(x.historyBarCount||0)+'根已完成日K｜回測 '+(x.performance||'NOT_VALIDATED')+'（績效未驗證）｜獨立研究，非選股必要條件'}
 ];
 return {summary,details};
}
function lines(x){const v=fields(x);return [v.summary,...v.details].map(f=>'【'+f.title+'】'+f.value);}
function page(x,{document:doc=globalThis.document,displayCode=globalThis.ShitouReleaseV50?.displayCode||'V9.2.1',watermark=false,bars:source=[]}={}){
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
 const omissions=geometry.events.filter(e=>e.status!=='VISIBLE').map(e=>e.key+' '+(e.date||'日期缺失')+'｜'+(e.status==='OUT_OF_RANGE'?'不在目前顯示範圍':'對應日K未提供'));
 const hasChart=bars.length>0,top=hasChart?1760:600;
 const items=[{title:'目前狀態與風險',value:[x.label,...(x.contradictions||[]),...(x.riskWarnings||[])].join('；')},
  {title:'隔日觀察｜須完成日K收盤確認',value:[x.scenario?.bullish,x.scenario?.bearish,x.scenario?.neutral].filter(Boolean).join('\n')||x.reason||'訊號尚未形成'},
  {title:'假突破／假跌破',value:[x.scenario?.falseBreak,x.scenario?.falseBreakdown].filter(Boolean).join('\n')||'沒有有效事件，不補造確認條件'},
  {title:'事件與資料稽核',value:[x.event?['K3','K2','K1','K0'].map(k=>k+' '+(x.event[k.toLowerCase()+'Date']||'日期缺失')).join('｜'):'沒有有效事件','生命線成立 '+(x.event?.signalDate||'尚未成立'),'原始狀態 '+(x.currentState||x.state),...omissions,'圖表 '+(hasChart?bars[0].date+'～'+bars.at(-1).date+'；'+bars.length+'根':'尚無同日期日K可定位')].join('\n')},
  {title:'收盤與生命線距離',value:'收盤 '+fmt(x.close)+' 元｜距固定生命線 '+fmt(x.distancePct)+'%（不是預測報酬）'},
  ...[v.details[2],v.details[6],v.details[8]]];
 const cards=Layout.blocks(ctx,items,{top,width:WIDTH}),H=Math.max(MIN,cards.at(-1).top+cards.at(-1).height+170);
 const audit={version:VERSION,model:x.model,date:x.date,code:x.code,width:W,height:H,noClipping:true,
  k0Date:x.event?.k0Date||null,k3Date:x.event?.k3Date||null,lifeLinePrice:x.event?.lifeLinePrice||null,signalDate:x.event?.signalDate||null,
  state:x.state,currentState:x.currentState,studyOnly:true,performance:'NOT_VALIDATED',fieldCount:cards.length,
  barDates:bars.map(b=>b.date),geometry,fields:[v.summary,...items],section:'LIFE_CHART'};
 const paint=()=>{
  const c=doc.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');if(!q)throw Error('生命線圖片Canvas不可用');
  q.textBaseline='top';q.fillStyle='#0b2032';q.fillRect(0,0,W,H);
  const text=(t,y,size=38,color='#e7f0f6')=>{Layout.font(q,size);q.fillStyle=color;let yy=y;for(const row of Layout.wrap(q,t,WIDTH,size)){q.fillText(row,M,yy);yy+=size+14;}};
  text('石頭少爺 '+displayCode+'｜生命線研究',60,46);
  text(String(x.name||x.code||'個股')+'（'+String(x.code||'—')+'）',140,62);
  text('完成日K '+String(x.date||'尚未核驗')+'｜收盤 '+fmt(x.close)+' 元',230,36,'#b8d2e3');
  text(x.label||'資料不足',310,54,'#92ded4');
  text(validPrice?(x.event.side==='BULL'?'多方支撐':'空方壓力')+'｜'+fmt(price)+' 元':'生命線尚未成立',395,50);
  text('成立 '+(x.event?.signalDate||'尚未確認')+'｜獨立價位研究，績效未驗證',478,34,'#b8d2e3');
  if(hasChart){
   const p=geometry.plot,yp=n=>p.y+p.height-(n-min)/(max-min)*p.height,xp=i=>p.x+(i+.5)*geometry.dx;
   q.lineWidth=1;for(let i=0;i<=4;i++){const y=p.y+i*p.height/4;q.strokeStyle='#29495d';q.beginPath();q.moveTo(p.x,y);q.lineTo(p.x+p.width,y);q.stroke();Layout.font(q,30);q.fillStyle='#b8d2e3';q.fillText(fmt(max-(max-min)*i/4),10,y-18);}
   for(const [i,b] of bars.entries()){const xx=xp(i);q.strokeStyle=q.fillStyle=b.close>=b.open?'#ff8b95':'#6adbb4';q.lineWidth=3;q.beginPath();q.moveTo(xx,yp(b.high));q.lineTo(xx,yp(b.low));q.stroke();q.fillRect(xx-geometry.dx*.28,Math.min(yp(b.open),yp(b.close)),Math.max(2,geometry.dx*.56),Math.max(3,Math.abs(yp(b.open)-yp(b.close))));}
   if(validPrice){q.strokeStyle='#ffdc8c';q.setLineDash([12,8]);q.beginPath();q.moveTo(p.x,yp(price));q.lineTo(p.x+p.width,yp(price));q.stroke();q.setLineDash([]);Layout.font(q,34);q.fillStyle='#ffdc8c';q.fillText('固定生命線 '+fmt(price)+' 元',p.x,1650);}
   geometry.labels.forEach((e,i)=>{q.strokeStyle='#b8d2e3';q.lineWidth=2;q.beginPath();q.moveTo(e.x+e.width/2,e.y+e.height);q.lineTo(e.x+e.width/2,715+i*26);q.lineTo(e.anchorX,820+i*6);q.lineTo(e.anchorX,e.anchorY);q.stroke();q.fillStyle='#163b52';q.fillRect(e.x,e.y,e.width,e.height);Layout.font(q,38,750);q.fillStyle='#ffdc8c';q.fillText(e.key,e.x+14,e.y+5);Layout.font(q,31);q.fillStyle='#eef6ff';q.fillText(e.date,e.x+14,e.y+54);q.beginPath();q.arc(e.anchorX,e.anchorY,6,0,Math.PI*2);q.fill();});
   Layout.font(q,32);q.fillStyle='#b8d2e3';q.fillText(bars[0].date,p.x,1600);q.fillText(bars.at(-1).date,p.x+p.width-210,1600);
   if(!x.event)text('目前沒有有效 K0～K3 事件',650,38);
   text('日K：收盤 ≥ 開盤為紅；收盤 < 開盤為綠',1700,32,'#b8d2e3');
  }else text('沒有同日期日K，無法定位事件；未補造圖形。',560,34,'#ffdc8c');
  Layout.paintBlocks(q,cards);
  text('研究資訊，不構成買賣指令｜'+displayCode,H-90,32,'#b8d2e3');
  if(watermark&&globalThis.ShitouReportWatermark?.paint)globalThis.ShitouReportWatermark.paint(q,{width:W,height:H,type:'all'});
  Object.assign(c.dataset,{life03Audit:JSON.stringify(audit),release:displayCode,fullBleed:'true',shareAsSingleImage:'true'});return c;
 };
 return {width:W,height:H,dataset:{life03Audit:JSON.stringify(audit),release:displayCode,shareAsSingleImage:'true'},renderExportRegion:paint,
  toBlob(callback,type='image/png'){const c=paint();c.toBlob(blob=>{c.width=c.height=1;callback(blob);},type);}};
}
return Object.freeze({VERSION,inspect,fields,lines,page});
});
