/* V9.2 independent life-line presentation. Shares no selection or trading controls. */
(function(root,factory){
 const node=typeof module==='object'&&!!module.exports;
 const api=factory(node?require('./kline-life-03-core-v1.js'):root.ShitouKlineLife03);
 if(node)module.exports=api;else root.ShitouKlineLife03Report=api;
})(globalThis,function(Core){
'use strict';
const VERSION='KLINE_LIFE_03_REPORT_V1';
const fmt=x=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(2):'尚未核驗';
function inspect(a){return Core?.evaluate(a)||{state:'INSUFFICIENT_DATA',reason:'生命線模組尚未載入',label:'資料不足',events:[]};}
function fields(x){
 const event=x.event,dates=event?['K0 '+event.k0Date,'K1 '+event.k1Date,'K2 '+event.k2Date,'K3 '+event.k3Date].join('｜'):'尚無成立的0號K';
 const anchor=event?(event.side==='BULL'?'3號K多方支撐 ':'3號K空方壓力 ')+fmt(event.lifeLinePrice)+'元':'目前沒有有效生命線';
 const summary={title:'0～3號K生命線｜隔日強弱研究',value:x.label+'｜'+anchor+'｜資料日 '+(x.date||'尚未核驗')+'；'+(x.state==='INSUFFICIENT_DATA'?(x.reason||'資料不足'):'這是盤後結構研究，不保證明日漲跌')};
 const details=[
  {title:'生命線｜訊號日期與來源',value:dates+'；'+anchor+'；事件 '+(event?.eventId||'未形成')},
  {title:'生命線｜強弱與距離',value:'目前 '+x.label+'；收盤 '+fmt(x.close)+'元；距生命線 '+fmt(x.distancePct)+'%；生命線成立後價格固定'},
  {title:'生命線｜轉折及失效',value:x.transitionDate?'狀態轉移 '+x.transitionDate+'；'+(x.transitionReason||'條件已確認'):'尚無完成日K的轉折確認；不能預判明日已轉強或轉弱'},
  {title:'生命線｜偏多確認',value:x.scenario?.bullish||x.reason||'訊號尚未形成'},
  {title:'生命線｜偏空確認',value:x.scenario?.bearish||'無有效結構價位'},
  {title:'生命線｜盤整與假突破',value:[x.scenario?.neutral,x.scenario?.falseBreak,x.scenario?.falseBreakdown].filter(Boolean).join('；')||'尚無可確認的固定關卡'},
  {title:'生命線｜多空證據',value:(x.confirmationEvidence||[]).join('；')||'未出現其他可核驗的同向確認'},
  {title:'生命線｜矛盾與風險',value:[...(x.contradictions||[]),...(x.riskWarnings||[])].join('；')||'目前未新增風險提示；不等於零風險'},
  {title:'生命線｜資料與限制',value:'V9.2-KLINE-LIFE03｜'+(x.historyBarCount||0)+'根已完成日K｜回測 '+x.performance+'｜非選股必要條件，原六套PASS/FAIL不變'}
 ];
 return {summary,details};
}
function lines(x){const v=fields(x);return [v.summary,...v.details].map(f=>'【'+f.title+'】'+f.value);}
function page(x,{document:doc=globalThis.document,displayCode='V9.2',watermark=false}={}){
 if(!doc?.createElement)return null;
 const W=1284,MIN=2778,M=55,WIDTH=W-2*M-62;
 const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const v=fields(x),blocks=[{title:'0～3號K生命線',value:v.summary.value},...v.details];
 const font=(size,weight=650)=>{ctx.font=weight+' '+size+'px "Microsoft JhengHei","Noto Sans TC",sans-serif';};
 const wrap=(raw,size=34,width=WIDTH)=>{font(size);const out=[];for(const segment of String(raw).split('\n')){let row='';for(const ch of segment){if(row&&ctx.measureText(row+ch).width>width){out.push(row);row=ch;}else row+=ch;}out.push(row||' ');}return out;};
 const cards=blocks.map((b,i)=>{const title=wrap(b.title,40),body=wrap(b.value,i===0?37:33),height=38+title.length*52+body.length*44+34;return {...b,title,body,height};});
 const bodyHeight=380+cards.reduce((t,c)=>t+c.height+18,0)+150,H=Math.max(MIN,bodyHeight);
 const audit={version:VERSION,model:x.model,date:x.date,code:x.code,width:W,height:H,noClipping:true,noOverlap:true,
  k0Date:x.event?.k0Date||null,k3Date:x.event?.k3Date||null,lifeLinePrice:x.event?.lifeLinePrice||null,signalDate:x.event?.signalDate||null,
  studyOnly:true,performance:'NOT_VALIDATED',fieldCount:cards.length};
 const paint=()=>{
  const c=doc.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');if(!q)throw Error('生命線圖片Canvas不可用');
  q.textBaseline='top';q.fillStyle='#0b2032';q.fillRect(0,0,W,H);
  q.fillStyle='#1b4059';q.fillRect(35,35,W-70,285);
  q.fillStyle='#fff';font.call(null,50,800);q.font=ctx.font;q.fillText('石頭少爺 '+displayCode+'｜生命線研究',72,73);
  font(44,700);q.font=ctx.font;q.fillStyle='#b8deef';q.fillText(String(x.name||x.code||'個股')+'（'+String(x.code||'—')+'）',72,155);
  font(34);q.font=ctx.font;q.fillText('完成日K '+String(x.date||'待核')+'｜不可預測隔日必然漲跌',72,236);
  let y=362;
  for(const b of cards){
   q.fillStyle='#13334a';q.fillRect(M,y,W-2*M,b.height);
   q.strokeStyle='#34708a';q.lineWidth=2;q.strokeRect(M,y,W-2*M,b.height);
   q.fillStyle='#8ee6db';font(40,750);q.font=ctx.font;let top=y+26;for(const text of b.title){q.fillText(text,M+30,top);top+=52;}
   q.fillStyle='#f1f7fa';font(33,650);q.font=ctx.font;top+=7;for(const text of b.body){q.fillText(text,M+30,top);top+=44;}
   y+=b.height+18;
  }
  q.fillStyle='#b8d2e3';font(30);q.font=ctx.font;q.fillText('研究資訊，不構成買賣指令｜訊號日期與完成行情必須一致',M,H-95);
  if(watermark&&globalThis.ShitouReportWatermark?.paint)globalThis.ShitouReportWatermark.paint(q,{width:W,height:H,type:'all'});
  Object.assign(c.dataset,{life03Audit:JSON.stringify(audit),release:displayCode,fullBleed:'true'});return c;
 };
 return {width:W,height:H,dataset:{life03Audit:JSON.stringify(audit),release:displayCode},renderExportRegion:paint,
  toBlob(callback,type='image/png'){const c=paint();c.toBlob(blob=>{c.width=c.height=1;callback(blob);},type);}};
}
return Object.freeze({VERSION,inspect,fields,lines,page});
});
