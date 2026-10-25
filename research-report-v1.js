(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.ShitouResearchReport=a;})(globalThis,function(){
'use strict';
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'—';
const STAGES={BREAKOUT_LAUNCH:'突破發動',HEALTHY_PULLBACK:'健康回踩',MOMENTUM_CONTINUATION:'強勢延續',FLOW_CONFIRMATION:'資金確認',OVEREXTENDED:'短線過熱',BREAKOUT_FAILURE:'結構失敗',INSUFFICIENT_DATA:'資料不足',OBSERVATION:'觀察中',DISABLED:'已關閉'};
const STATES={PASS:'符合',FAIL:'不符合',UNKNOWN:'待驗證',RESEARCH_MATCH:'研究符合',RESEARCH_NOT_MATCH:'未符合',DATA_UNVERIFIED:'資料待補',AWAIT_CONFIRMATION:'待確認',CONFIRMED:'已確認',FAILED:'已失效',EXPIRED:'已逾期',AMBIGUOUS:'先後不明',STRONG_ALIGNMENT:'一致轉強',PARTIAL_ALIGNMENT:'部分轉強',MIXED_SIGNALS:'訊號矛盾',BEARISH_ALIGNMENT:'一致轉弱',OVEREXTENSION_WARNING:'過熱警戒',INSUFFICIENT_DATA:'暫無共同訊號'};
const CONDITION_NAMES={RSI_GT_65:'日線RSI＞65',RSI_GT_70:'日線RSI＞70',MA20_CLOSE_CROSS:'收盤站上MA20',CHIP_GT_20:'籌碼集中＞20%',TURNOVER_GT_10:'周轉率＞10%',OFFICIAL_VALUE_TOP100:'成交值前100'};
function stageLabel(a){return a?.compactStateLabel||STAGES[a?.state]||a?.state||'觀察中';}
function evidenceSummary(a){
 const names=[];
 for(const [k,v] of Object.entries(a?.families||{}))if(v===true)names.push(k==='PRICE_STRUCTURE'?'突破/結構':k==='TREND_MA'?'均線趨勢':k==='VOLUME'?'量能':k==='MOMENTUM'?'動能':k==='FLOW'?'資金':k==='FUNDAMENTAL'?'基本面':k==='DATA_QUALITY'?'資料完整':'');
 return names.filter(Boolean).slice(0,4).join('、')||'尚無明確共振';
}
function riskSummary(a){return (a?.risks||[]).slice(0,3).join('、')||'暫無額外警訊';}
function dataSummary(a){return a?.dataQuality?.complete?'資料較完整':'部分資料待驗證';}
function actionSummary(a){
 switch(a?.state){
  case 'BREAKOUT_LAUNCH': return '觀察是否續強，未確認前不追價。';
  case 'HEALTHY_PULLBACK': return '先看支撐是否守住，再等重新轉強。';
  case 'MOMENTUM_CONTINUATION': return '強勢延續中，留意量價是否維持。';
  case 'FLOW_CONFIRMATION': return '可列入觀察，但仍要回到原策略檢查。';
  case 'OVEREXTENDED': return '短線偏熱，先不急追。';
  case 'BREAKOUT_FAILURE': return '結構轉弱，先保守。';
  case 'INSUFFICIENT_DATA': return '資料不足，先不下判斷。';
  default: return '先觀察，等待更完整訊號。';
 }
}
function dualSummary(d){
 if(!d)return '研究A/B：未啟用';
 const a=(d.modeA?.checks||[]).filter(x=>x.status==='PASS').map(x=>CONDITION_NAMES[x.id]||x.id);
 const b=(d.modeB?.checks||[]).filter(x=>x.status==='PASS').map(x=>CONDITION_NAMES[x.id]||x.id);
 const left=a.length?`A ${a.slice(0,2).join('、')}`:'A 暫無明確條件';
 const right=b.length?`B ${b.slice(0,2).join('、')}`:'B 暫無明確條件';
 return `${left}｜${right}`;
}
function alertSummary(p){
 if(!p)return '到價提醒：未建立';
 return `上破 ${fmt(p.priceAbove?.input)}｜下破 ${fmt(p.priceBelow?.input)}｜漲跌幅 ${p.dayGainPercentInput??'—'}% / ${p.dayLossPercentInput??'—'}%`;
}
function lines(a){
 const d=a?.foundation?.dualScanContext,p=a?.foundation?.alertPlan;
 return [
  `${a.name}（${a.code}）｜${a.date||'日期待確認'}`,
  `【現況】${stageLabel(a)}`,
  `【研究重點】${evidenceSummary(a)}`,
  `【關鍵價位】B價 ${fmt(a.originalB)}｜研究突破 ${fmt(a.researchBreakoutPrice)}｜失效 ${fmt(a.originalInvalidation??a.researchInvalidation)}`,
  `【風險】${riskSummary(a)}`,
  `【研究A/B】${dualSummary(d)}`,
  `【到價提醒】${alertSummary(p)}`,
  ...(p?[`【提醒設定】價格高於：${fmt(p.priceAbove?.input)}｜價格低於：${fmt(p.priceBelow?.input)}；僅供手動設定`,
            ...(p.priceAbove?.alreadyCrossed||p.priceBelow?.alreadyCrossed?['【提醒狀態】盤後已越過原價位，請重新檢查通知門檻。']:[])]:[]),
  `【資料狀態】${dataSummary(a)}`,
  `【摘要結論】${actionSummary(a)}`,
  '原榜分數、資格與排序保留；本區僅提供研究摘要。'
 ];
}
function text(a){return lines(a).join('\n');}
function wrap(ctx,s,width){const out=[];for(const p of String(s).split('\n')){let row='';for(const ch of p){if(row&&ctx.measureText(row+ch).width>width){out.push(row);row=ch;}else row+=ch;}out.push(row);}return out;}
function roundRectPath(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function pages(a,{document:doc=globalThis.document,displayCode='V8.2.1',watermark=false,stockMetrics=null}={}){
 const W=1284,H=2778,M=54,FIELD_FONT=56,FIELD_LINE=77,LABEL_FONT=40,MAX_BOTTOM=2430;
 const ctx=doc.createElement('canvas').getContext('2d');
 if(!ctx)throw Error('Canvas 2D unavailable');
 const sourceLines=lines(a),extra=stockMetrics?[`【個股收盤】${fmt(stockMetrics.close)} 元｜${stockMetrics.marketDate||'日期待核對'}`,`【日RSI5】${fmt(stockMetrics.rsi5)}`,`【日MA20】${fmt(stockMetrics.ma20)}｜資料不足不補值`,`【報價來源】${stockMetrics.source||'未標示'}`]:[];
 const strings=[...sourceLines.slice(0,1),...extra,...sourceLines.slice(1)],fields=strings.map(s=>s.match(/^【([^】]+)】(.*)$/)).filter(Boolean)
  .filter(m=>!['現況','提醒設定'].includes(m[1]));
 function measuredWrap(value,font,width){
  ctx.font=font;
  const fragments=String(value).split('｜').map(x=>x.trim()).filter(Boolean),out=[];
  let line='';
  for(const fragment of fragments){
   const combined=line?line+'｜'+fragment:fragment;
   if(ctx.measureText(combined).width<=width){line=combined;continue;}
   if(line){out.push(line);line='';}
   if(ctx.measureText(fragment).width<=width){line=fragment;continue;}
   // Even a single logical fragment is too long: only then use character wrapping.
   const inner=wrap(ctx,fragment,width);
   out.push(...inner.slice(0,-1));line=inner.at(-1)||'';
  }
  if(line)out.push(line);
  return out.length?out:['—'];
 }
 const boxes=fields.map(m=>{
  const body=measuredWrap(m[2],`700 ${FIELD_FONT}px "Microsoft JhengHei",sans-serif`,W-2*M-82);
  const size=47+body.length*FIELD_LINE+48;
  return {title:m[1],body,size};
 });
 const plans=[];let items=[],y=630;
 for(const box of boxes){
  if(items.length&&y+box.size+12>MAX_BOTTOM){plans.push(items);items=[];y=365;}
  items.push({box,y});y+=box.size+12;
 }
 if(items.length||!plans.length)plans.push(items);
 function paint(x,plan,index){
  x.fillStyle='#0f2032';x.fillRect(0,0,W,H);
  x.fillStyle='#173958';x.fillRect(0,0,W,210);
  x.fillStyle='#fff';x.font='850 70px "Microsoft JhengHei",sans-serif';x.fillText(stockMetrics?'個股查詢｜研究摘要':'四策略研究｜現況摘要',M,96);
  x.font='650 38px "Microsoft JhengHei",sans-serif';x.fillStyle='#cae6fa';x.fillText(`${displayCode}｜${a.date||'日期待核對'}｜${index+1}/${plans.length}`,M,166);
  if(index===0){
   x.fillStyle='#fff';x.font='850 77px "Microsoft JhengHei",sans-serif';
   let title=`${a.name||'名稱待核對'}（${a.code||'—'}）`;
   while(title.length>2&&x.measureText(title).width>W-2*M)title=title.slice(0,-2)+'…';
   x.fillText(title,M,322);
   x.fillStyle='#245676';roundRectPath(x,M,382,W-2*M,144,23);x.fill();
   x.fillStyle='#fff';x.font='850 60px "Microsoft JhengHei",sans-serif';x.fillText(`現況：${stageLabel(a)}`,M+29,476);
  }else{
   x.fillStyle='#fff';x.font='800 58px "Microsoft JhengHei",sans-serif';
   x.fillText(`${a.name||'名稱待核對'}（${a.code||'—'}）｜續頁`,M,320);
  }
  for(const {box,y:top} of plan){
   x.fillStyle='#1b364d';roundRectPath(x,M,top,W-2*M,box.size,18);x.fill();
   x.fillStyle='#8dd4ff';x.fillRect(M,top+14,7,box.size-28);
   x.font=`800 ${LABEL_FONT}px "Microsoft JhengHei",sans-serif`;
   x.fillStyle='#9fdbff';x.fillText(box.title,M+33,top+53);
   x.font=`700 ${FIELD_FONT}px "Microsoft JhengHei",sans-serif`;
   x.fillStyle='#f4f8ff';
   box.body.forEach((line,i)=>x.fillText(line,M+33,top+117+i*FIELD_LINE));
  }
  x.fillStyle='#173958';x.fillRect(0,2530,W,248);
  x.fillStyle='#ffdf93';x.font='700 37px "Microsoft JhengHei",sans-serif';
  x.fillText('僅供盤後研究｜未證明隔日勝率',M,2605);
  x.fillStyle='#d1e5f5';x.font='650 34px "Microsoft JhengHei",sans-serif';
  x.fillText(stockMetrics?'單股查詢不列入濾網排名':'原榜、原分數與原資格維持不變',M,2671);
  x.fillText('資料不足須核驗；價格提醒非買進訊號',M,2732);
 }
 return plans.map((plan,index)=>{
  const bodyBottom=plan.length?Math.max(...plan.map(x=>x.y+x.box.size)):0;
  const dataset={researchAudit:JSON.stringify({code:a.code,date:a.date,sourceSnapshotId:a.sourceSnapshotId,originalB:a.originalB,alertPlan:a.foundation?.alertPlan,width:W,height:H,index:index+1,total:plans.length,minFont:FIELD_FONT,bodyBottom,noClipping:bodyBottom<=MAX_BOTTOM,mode:stockMetrics?'SINGLE_STOCK':'FILTER_RESEARCH',summary:strings}),release:a.version,fullBleed:'true'};
  const render=({top=0,height=H,scale=1}={})=>{
   const c=doc.createElement('canvas');c.width=Math.floor(W*scale);c.height=Math.floor(height*scale);
   const x=c.getContext('2d');x.setTransform(scale,0,0,scale,0,-top*scale);paint(x,plan,index);
   Object.assign(c.dataset,dataset);return c;
  };
  return {width:W,height:H,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){
   const c=render();if(watermark&&globalThis.applyAntiTheftWatermarkV3761)globalThis.applyAntiTheftWatermarkV3761(c,'all');
   c.toBlob(b=>{c.width=c.height=1;callback(b);},type);
  }};
 });
}
function candlePage(a,{document:doc=globalThis.document}={}){return null;}
return Object.freeze({fmt,STAGES,lines,text,wrap,pages,candlePage,STATES});
});
