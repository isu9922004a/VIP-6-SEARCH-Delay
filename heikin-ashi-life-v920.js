/* V9.21 | Independent, research-only Heikin-Ashi analysis and life-line appendix.
 * Uses the standard Heikin-Ashi equations, not proprietary indicator code.
 * Never changes screening, life-line prices, ranking, or order execution.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ShitouHeikinAshi920=api;
})(globalThis,function(){
'use strict';
const VERSION='HEIKIN_ASHI_LIFE_V921',W=1284,H=2778;
const C={bg:'#071C2D',card:'#0A2D43',card2:'#10364D',ink:'#F3F7FF',muted:'#C2D7E5',mint:'#81F1D0',gold:'#FFE365',orange:'#FFB444',red:'#FF5975',green:'#3CDBB6',line:'#71CFFF'};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function calculate(input){
 if(!Array.isArray(input)||input.length<1)throw Error('神奇K線資料不足：沒有完成日K');
 let previous=null,previousDate='',out=[];
 for(const b of input){
  if(!b||!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||b.date<=previousDate)throw Error('神奇K線日期缺漏、重複或排序錯誤');
  const {open,high,low,close}=b;
  if(![open,high,low,close].every(v=>finite(v)&&v>0)||high<Math.max(open,close)||low>Math.min(open,close)||high<low)throw Error('神奇K線原始開高低收不合理');
  const haClose=(open+high+low+close)/4,haOpen=previous?(previous.open+previous.close)/2:(open+close)/2;
  const next={date:b.date,open:haOpen,high:Math.max(high,haOpen,haClose),low:Math.min(low,haOpen,haClose),close:haClose,realClose:close};
  next.body=Math.abs(next.close-next.open);
  next.range=next.high-next.low;
  const tol=Math.max(next.range*0.001,Math.abs(next.close)*1e-8);
  next.color=next.close>next.open+tol?'紅K':next.close<next.open-tol?'綠K':'十字K';
  next.upperWick=Math.max(0,next.high-Math.max(next.open,next.close));
  next.lowerWick=Math.max(0,Math.min(next.open,next.close)-next.low);
  next.noUpperWick=next.upperWick<=tol;
  next.noLowerWick=next.lowerWick<=tol;
  out.push(next);previous=next;previousDate=b.date;
 }
 return out;
}
function classify(series){
 if(!Array.isArray(series)||series.length<5)return {code:'INSUFFICIENT',label:'資料不足，暫時不能判斷',description:'至少需要5根完成日K，不能用猜的。',count:0};
 const a=series.at(-1),b=series.at(-2),recent=series.slice(-3);
 const consecutive=color=>{let n=0;for(let i=series.length-1;i>=0&&series[i].color===color;i--)n++;return n;};
 const reds=consecutive('紅K'),greens=consecutive('綠K');
 const base=(recent.reduce((sum,x)=>sum+x.body,0)/3)||0;
 if(greens>=2&&a.noUpperWick&&a.body>=base*0.65)return {code:'BEAR_STRENGTH',label:'賣方比較有力，尚未確認止跌',description:'連續綠K且上影線短，短線仍有下跌風險；不代表明天一定下跌。',count:greens};
 if(reds>=2&&a.noLowerWick&&a.body>=base*0.80&&!(a.body<b.body*0.75))return {code:'BULL_STRENGTH',label:'買方比較有力，但不代表適合追價',description:'連續紅K且下影線短，買方目前較有力；仍須確認真實股價與風險。',count:reds};
 if(reds>=2&&(a.body<b.body*0.75||a.lowerWick>Math.max(a.body*0.65,base*0.4)))return {code:'BULL_WEAKENING',label:'多方力道減弱',description:'雖然還是紅K，但實體縮短或影線變長；可能開始震盪，先不要追高。',count:reds};
 return {code:'UNCERTAIN',label:'多空方向不明',description:'紅綠與影線沒有形成明確連續訊號，等待下一根完成日K再判斷。',count:reds||greens};
}
function read(study,model){
 const bars=model?.bars;
 if(!Array.isArray(bars)||!bars.length||!model?.date)throw Error('缺少已驗證生命線資料');
 if(bars.at(-1).date!==model.date)throw Error('神奇K線與生命線完成日不一致');
 const series=calculate(bars),signal=classify(series);
 const trend=String(model.currentRole||model.lifecycleState||'');
 let alignment='目前生命線與神奇K線訊號需要分開觀察。';
 if(signal.code==='BULL_STRENGTH')alignment='神奇K線偏強；仍應先看真實收盤是否守住重要均價與支撐。';
 else if(signal.code==='BULL_WEAKENING')alignment='上漲可能放慢；先觀察真實股價的5日均價與生命線，不要只看到紅K就追。';
 else if(signal.code==='BEAR_STRENGTH')alignment='神奇K線偏空；如果真實收盤也跌破重要支撐，須提高警覺。';
 else alignment='訊號尚未一致；不要硬判斷方向，等待更多完成日K。';
 if(/SUPPORT|BULL/.test(trend)&&signal.code==='BEAR_STRENGTH')alignment='生命線仍有偏多訊號，但神奇K線已偏空：兩者不一致，先降低追價衝動。';
 if(/RESISTANCE|BEAR/.test(trend)&&signal.code==='BULL_STRENGTH')alignment='生命線仍有壓力，但神奇K線轉強：兩者不一致，先看真實收盤能否突破。';
 const completed=bars.filter(x=>Number.isFinite(x.close)&&Number.isFinite(x.high)&&Number.isFinite(x.low));
 const ma5=completed.length>=5?completed.slice(-5).reduce((sum,x)=>sum+x.close,0)/5:null;
 // Historical levels exclude today's completed candle. Never call a partial window "20 days".
 const prior=completed.slice(-21,-1),hasPrior20=prior.length===20;
 const support=hasPrior20?Math.min(...prior.map(x=>x.low)):null;
 const resistance=hasPrior20?Math.max(...prior.map(x=>x.high)):null;
 const realClose=finite(model.close)?model.close:null;
 const ma5GapPct=finite(realClose)&&finite(ma5)&&ma5>0?(realClose-ma5)/ma5*100:null;
 const priceState=!finite(realClose)||!hasPrior20?'INSUFFICIENT':realClose<support?'BELOW_PRIOR_LOW':realClose>resistance?'ABOVE_PRIOR_HIGH':'IN_RANGE';
 const breakPct=priceState==='BELOW_PRIOR_LOW'?(realClose-support)/support*100:priceState==='ABOVE_PRIOR_HIGH'?(realClose-resistance)/resistance*100:null;
 const risk=priceState==='BELOW_PRIOR_LOW'?'真實收盤已跌破前20日低點，不能把原低點說成仍守住。':priceState==='ABOVE_PRIOR_HIGH'?'真實收盤已突破前20日高點，但仍需觀察是否守穩。':priceState==='INSUFFICIENT'?'前20日資料不足，不能假稱已突破或跌破。':'價格仍位於前20日高低點之間，須搭配生命線觀察。';
 return {series,signal,alignment,risk,ma5,ma5GapPct,support,resistance,priceState,breakPct,priorDays:prior.length,code:model.code,name:model.name,date:model.date,realClose,market:study?.instrumentType==='TAIEX'||model.code==='TAIEX'};
}
function page(study,model,{document:doc=globalThis.document,watermark=false,release=globalThis.ShitouReleaseV50?.displayCode||'V9.22',pageNumber=4,totalPages=4}={}){
 if(!doc?.createElement)throw Error('缺少瀏覽器畫布，無法產生神奇K線圖片');
 const data=read(study,model),unit=data.market?'點':'元',last=data.series.at(-1);
 const audit={version:VERSION,release,page:pageNumber,pages:totalPages,code:data.code,date:data.date,close:data.realClose,pageType:'HEIKIN_ASHI_APPENDIX',model:{code:data.code,date:data.date,close:data.realClose},signal:data.signal.code,signalText:data.signal.label,realPriceOnly:true,researchOnly:true,affectsEligibility:false,affectsRanking:false,automaticTrade:false,chartBarDates:data.series.slice(-30).map(x=>x.date),source:'VERIFIED_LIFELINE_COMPLETED_OHLC'};
 const code=String(data.code||'未確認').replace(/[^A-Za-z0-9_-]/g,''),date=String(data.date||'').replaceAll('-','');
 const filename='石頭少爺_'+release+'_'+code+'_'+date+'_P'+String(pageNumber).padStart(2,'0')+'_神奇K線白話解讀.png';
 function paint(){
  const canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('神奇K線畫布不可用');
  ctx.textBaseline='top';ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
  const font=(size=36,weight=650)=>{ctx.font=weight+' '+size+'px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';};
  function txt(s,x,y,maxW,size=36,color=C.ink,weight=650){
   font(size,weight);ctx.fillStyle=color;let text=String(s??'資料不足');
   while(text.length>1&&ctx.measureText(text).width>maxW)text=text.slice(0,-1);
   if(text!==String(s??'資料不足'))text=text.slice(0,-1)+'…';
   ctx.fillText(text,x,y);
  }
  function wrap(s,x,y,w,size=35,color=C.ink,limit=4){
   font(size,600);const lines=[];for(const paragraph of String(s).split('\n')){let row='';for(const ch of Array.from(paragraph)){if(row&&ctx.measureText(row+ch).width>w){lines.push(row);row=ch;}else row+=ch;}lines.push(row);}
   lines.slice(0,limit).forEach((v,i)=>txt(v,x,y+i*(size+17),w,size,color,600));
  }
  function card(x,y,w,h,stroke=C.line){
   ctx.beginPath();ctx.roundRect(x,y,w,h,20);ctx.fillStyle=C.card;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke();
  }
  function divider(y){ctx.strokeStyle='#28506B';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(1244,y);ctx.stroke();}
  txt('石頭少爺 '+release+'｜神奇K線白話解讀',34,32,1216,52,C.gold,820);
  txt((data.market?'台灣加權指數':'個股 '+(data.name||data.code)+'（'+data.code+'）')+'｜資料日 '+data.date,38,118,1190,34,C.ink,690);
  txt('第 '+pageNumber+' / '+totalPages+' 頁',1018,164,234,27,C.muted,650);
  card(20,196,1244,166,C.gold);
  txt('這頁是幹嘛的？',45,216,1140,42,C.mint,800);
  wrap('生命線幫你看方向；神奇K線幫你看上漲或下跌的力道。它不是預言明天一定漲跌。',45,275,1162,34,C.ink,2);
  card(20,382,1244,796);
  txt('神奇K線｜最近30根完成日K',43,405,1180,42,C.mint,800);
  txt('紅K：買方較有力  ｜  綠K：賣方較有力（合成K線，非真實漲跌）',48,460,1170,27,C.muted,600);
  const chart=data.series.slice(-30),x0=82,y0=535,cw=1119,ch=540;
  if(chart.length<5)wrap('完成日K數量不足，暫不顯示趨勢結論。',90,705,1060,40,C.orange,3);
  else{
   const hi=Math.max(...chart.map(x=>x.high)),lo=Math.min(...chart.map(x=>x.low)),span=Math.max(hi-lo,hi*0.001),scale=v=>y0+ch-((v-lo)/span)*ch;
   for(let g=0;g<5;g++){const yy=y0+g*ch/4;ctx.strokeStyle='#28506B';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x0+cw,yy);ctx.stroke();}
   const step=cw/chart.length,bodyW=Math.max(8,Math.min(24,step*.58));
   chart.forEach((b,i)=>{
    const x=x0+step*(i+.5),high=scale(b.high),low=scale(b.low),o=scale(b.open),cl=scale(b.close);
    ctx.strokeStyle=ctx.fillStyle=b.color==='紅K'?C.red:b.color==='綠K'?C.green:C.gold;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(x,high);ctx.lineTo(x,low);ctx.stroke();
    ctx.fillRect(x-bodyW/2,Math.min(o,cl),bodyW,Math.max(3,Math.abs(cl-o)));
   });
   txt(chart[0].date.slice(5),88,1103,300,29,C.muted);
   txt(chart.at(-1).date.slice(5),935,1103,258,29,C.muted);
  }
  card(20,1202,1244,370,C.line);
  txt('目前判讀：'+data.signal.label,43,1226,1162,45,data.signal.code==='BEAR_STRENGTH'?C.green:data.signal.code==='BULL_STRENGTH'?C.red:C.orange,800);
  wrap(data.signal.description,44,1311,1156,37,C.ink,3);
  txt('連續同色根數：'+data.signal.count+'根｜依完成日K計算',44,1504,1156,31,C.muted);
  card(20,1596,1244,400,C.line);
  txt('怎麼搭配生命線？',43,1624,1150,42,C.mint,800);
  wrap(data.alignment,44,1690,1155,33,C.ink,2);
  const fmt=v=>Number.isFinite(v)?v.toFixed(2)+' '+unit:'資料不足';
  const signedPct=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(2)+'%':'資料不足';
  txt('真實收盤：'+fmt(data.realClose)+' ｜ 5日均價：'+fmt(data.ma5),44,1810,1165,31,C.gold,730);
  txt('距5日均價：'+signedPct(data.ma5GapPct)+'（負數表示低於均價）',44,1857,1165,29,C.gold,700);
  txt('前20日低點（不含當日）：'+fmt(data.support)+' ｜ 高點：'+fmt(data.resistance),44,1901,1165,28,C.gold,700);
  let priceReminder='前20日資料不足（需至少21根完成日K），無法判斷前期關卡。';
  if(data.priceState==='BELOW_PRIOR_LOW')priceReminder='已跌破前20日低點，低於該價'+Math.abs(data.breakPct).toFixed(2)+'%；原低點不代表仍守穩。';
  else if(data.priceState==='ABOVE_PRIOR_HIGH')priceReminder='已突破前20日高點，高於該價'+data.breakPct.toFixed(2)+'%；還要觀察是否守穩。';
  else if(data.priceState==='IN_RANGE')priceReminder='真實收盤仍在前20日高低點之間；關卡只是歷史參考。';
  txt('價格提醒：'+priceReminder,44,1943,1165,26,data.priceState==='BELOW_PRIOR_LOW'?C.orange:C.muted,690);
  card(20,2020,1244,530,C.line);
  txt('新手下一步怎麼看？',43,2053,1162,43,C.mint,800);
  const notes=[
   '① 尚未持有：先觀察是否止跌，不因跌深就急著進場。',
   '② 已經持有：留意真實股價與預先設定的風險界線。',
   '③ 止跌觀察：股價不再持續破低，賣壓逐漸減輕。',
   '④ 轉強觀察：神奇K線轉紅，真實股價站回均線並守穩。'
  ];
  notes.forEach((s,i)=>wrap(s,46,2151+i*85,1164,33,C.ink,2));
  divider(2595);
  wrap('提醒：神奇K線使用合成價格且可能延遲；前20日高低點不含當日，歷史關卡不保證有效。研究參考，非買賣指令。',39,2630,1190,28,C.muted,3);
  if(watermark&&globalThis.ShitouReportWatermark)globalThis.ShitouReportWatermark.apply(canvas);
  Object.assign(canvas.dataset,dataset);
  return canvas;
 }
 const dataset={life94Audit:JSON.stringify(audit),life98Audit:JSON.stringify(audit),marketLifeAudit:JSON.stringify(audit),heikinAshiAudit:JSON.stringify(audit),fullBleed:'true',shareAsSingleImage:'true',filename};
 return {width:W,height:H,title:'第二區｜神奇K線白話解讀',filename,dataset,audit,renderExportRegion:paint,toBlob(cb,type='image/png',quality){const c=paint();c.toBlob(blob=>{c.width=c.height=1;cb(blob);},type,quality);}};
}
function installJump(doc,pages){
 const viewer=globalThis.ShitouLifeViewer94,host=doc?.getElementById?.('life94Controls');
 const haIndex=Array.isArray(pages)?pages.findIndex(p=>!!p.dataset?.heikinAshiAudit):-1;
 if(!viewer||!host||haIndex<0)return false;
 let button=doc.getElementById('life94HeikinJump');
 if(!button){button=doc.createElement('button');button.id='life94HeikinJump';button.type='button';
  button.setAttribute('aria-label','切換生命線與神奇K線白話解讀');
  host.insertBefore(button,doc.getElementById('life94Zip')||null);
 }
 button._heikinObserver?.disconnect();
 const sync=()=>{
  const state=viewer.getState?.();
  button.hidden=!state||state.pages!==pages;
  if(!button.hidden)button.textContent=state.index===haIndex?'返回生命線主報告':'查看神奇K線解讀';
 };
 button.onclick=async()=>{
  const state=viewer.getState?.();
  if(!state||state.pages!==pages)return;
  await viewer.select(state.index===haIndex?0:haIndex);
  sync();
 };
 const label=doc.getElementById('life94PageLabel');
 if(label&&typeof MutationObserver==='function'){
  const observer=new MutationObserver(sync);
  observer.observe(label,{childList:true,characterData:true,subtree:true});
  button._heikinObserver=observer;
 }
 sync();return true;
}
return Object.freeze({VERSION,calculate,classify,read,page,installJump});
});
