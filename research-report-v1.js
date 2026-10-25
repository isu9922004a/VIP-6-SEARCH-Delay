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
  `【資料狀態】${dataSummary(a)}`,
  `【摘要結論】${actionSummary(a)}`,
  '原榜分數、資格與排序保留；本區僅提供研究摘要。'
 ];
}
function text(a){return lines(a).join('\n');}
function wrap(ctx,s,width){const out=[];for(const p of String(s).split('\n')){let row='';for(const ch of p){if(row&&ctx.measureText(row+ch).width>width){out.push(row);row=ch;}else row+=ch;}out.push(row);}return out;}
function roundRectPath(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function pages(a,{document:doc=globalThis.document,displayCode='V8.2',watermark=false}={}){
 const W=1284,H=2778,M=54,SIZE=48,LH=72,TOP=320,ctx=doc.createElement('canvas').getContext('2d');ctx.font=`600 ${SIZE}px "Microsoft JhengHei",sans-serif`;
 const strings=lines(a),plan=[];for(const s of strings)plan.push(...wrap(ctx,s,W-2*M-52));
 const dataset={researchAudit:JSON.stringify({code:a.code,date:a.date,width:W,height:H,summary:strings}),release:a.version,fullBleed:'true'};
 const paint=x=>{x.fillStyle='#0e1b2a';x.fillRect(0,0,W,H);x.fillStyle='#17344f';x.fillRect(0,0,W,220);x.fillStyle='#fff';x.font='800 56px "Microsoft JhengHei",sans-serif';x.fillText('四策略研究摘要',M,88);x.font='600 34px sans-serif';x.fillText(`${displayCode}｜${a.date||'日期待確認'}｜精簡版`,M,154);x.fillStyle='#214566';roundRectPath(x,M,250,W-2*M,2050,24);x.fill();x.font=`600 ${SIZE}px "Microsoft JhengHei",sans-serif`;plan.forEach((s,j)=>{x.fillStyle=s.startsWith('【')?'#9fd9ff':'#eef5fc';x.fillText(s,M+26,TOP+j*LH);});x.fillStyle='#17344f';x.fillRect(0,2580,W,198);x.fillStyle='#ffdf94';x.font='600 34px "Microsoft JhengHei",sans-serif';x.fillText('精簡摘要僅供研究觀察｜正式判斷仍看原榜',M,2652);x.fillStyle='#fff';x.fillText('原分數、原排序與原資格保留',M,2718);};
 const render=({top=0,height=H,scale=1}={})=>{const c=doc.createElement('canvas');c.width=Math.floor(W*scale);c.height=Math.floor(height*scale);const x=c.getContext('2d');x.setTransform(scale,0,0,scale,0,-top*scale);paint(x);Object.assign(c.dataset,dataset);return c;};
 return [{width:W,height:H,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){const c=render();if(watermark&&globalThis.applyAntiTheftWatermarkV3761)globalThis.applyAntiTheftWatermarkV3761(c,'all');c.toBlob(b=>{c.width=c.height=1;callback(b);},type);}}];
}
function candlePage(a,{document:doc=globalThis.document}={}){return null;}
return Object.freeze({fmt,STAGES,lines,text,wrap,pages,candlePage,STATES});
});
