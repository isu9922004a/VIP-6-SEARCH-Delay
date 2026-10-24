(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.ShitouResearchReport=a;})(globalThis,function(){
'use strict';
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'尚無有效價位';
const STAGES={BREAKOUT_LAUNCH:'突破發動',HEALTHY_PULLBACK:'健康回踩',MOMENTUM_CONTINUATION:'強勢延續',FLOW_CONFIRMATION:'資金與基本面驗證',OVEREXTENDED:'短線過熱',BREAKOUT_FAILURE:'突破／結構失敗',INSUFFICIENT_DATA:'資料不足',OBSERVATION:'觀察中',DISABLED:'已關閉'};
const FAMILIES={PRICE_STRUCTURE:'價格結構',TREND_MA:'均線趨勢',VOLUME:'量能',MOMENTUM:'動能',FLOW:'資金',FUNDAMENTAL:'基本面',DATA_QUALITY:'資料品質'};
const CONDITIONS={B9:'衝刺公式',C6:'無參數均線',D3:'已公告營收',D4:'主力買賣',D5:'家數差',A1:'均線趨勢',A2:'完整20週線',A3:'五日漲幅',A4:'五日量增',A5:'單日增量',A6:'前高突破'};
const STATES={PASS:'符合',FAIL:'不符合',UNKNOWN:'待驗證',RESEARCH_MATCH:'研究符合',RESEARCH_NOT_MATCH:'未符合',DATA_UNVERIFIED:'資料待補',AWAIT_CONFIRMATION:'待確認',CONFIRMED:'已確認',FAILED:'已失效',EXPIRED:'已逾期',AMBIGUOUS:'先後不明',STRONG_ALIGNMENT:'一致轉強',PARTIAL_ALIGNMENT:'部分轉強',MIXED_SIGNALS:'訊號矛盾',BEARISH_ALIGNMENT:'一致轉弱',OVEREXTENSION_WARNING:'過熱警戒',INSUFFICIENT_DATA:'暫無共同訊號'};
const CONDITION_NAMES={RSI_GT_65:'日線RSI＞65',RSI_GT_70:'日線RSI＞70',MA20_CLOSE_CROSS:'MA20收盤穿越',CHIP_GT_20:'籌碼集中＞20%',TURNOVER_GT_10:'周轉率＞10%',OFFICIAL_VALUE_TOP100:'正式成交值前100'};
const checks=x=>x.map(v=>`${CONDITION_NAMES[v.id]||v.id}：${STATES[v.status]||v.status}`).join('；');
function lines(a){
 // Four-model toggle leaves the independent V7 foundation available.
 const f=a.foundation||{},m=a.models||{},t=f.threeDayStructure,g=f.granvilleContext,c=f.candlePatternContext,d=f.dualScanContext,p=f.alertPlan;
 return [`${a.name}（${a.code}）｜行情 ${a.date||'未知'}`,`【目前行情階段】${STAGES[a.state]||a.state}｜研究模式`,
 ...(!Object.keys(m).length?[`【資料完整性】${a.reason||'資料不足'}`]:[
  `【突破加速狀態】${m.A.status}｜${m.A.label}`,`【多頭回踩狀態】${m.B.status}｜${m.B.label}`,`【強勢延續狀態】${m.C.status}｜${m.C.label}`,`【資金基本面確認】${m.D.status}｜${m.D.label}`,
  `【四模型支持證據】${Object.entries(a.families).filter(([,v])=>v===true).map(([k])=>FAMILIES[k]||k).join('、')||'尚無已驗證家族'}`,
  `【四模型反向風險】${a.risks.join('、')||'未觸發額外警訊，仍須原策略確認'}`,
  `【原策略 B 價】${fmt(a.originalB)}`,`【突破確認價】${fmt(a.researchBreakoutPrice)}｜研究前20根高點，不覆蓋B價`,
  `【結構失效價】原線 ${fmt(a.originalInvalidation)}；研究候選 ${fmt(a.researchInvalidation)}`,
  `【下一交易日觀察】${a.nextTradingDate||'交易日曆未核驗，日期待確認'}｜等候完成日K收盤確認；研究線不等於成交`,
  `【實驗研究排名】依目前查詢範圍另列；原排名保留`,
  `【資料完整性】${a.dataQuality.complete?'已核驗':'部分未驗證'}｜待補：${[...new Set(a.dataQuality.missing.map(v=>CONDITIONS[v.split(':').at(-1)]||v.split(':').at(-1)))].join('、')||'無條件缺漏'}`,
  `RSI14 ${fmt(a.features.rsi14)}｜MA20 ${fmt(a.features.ma[20].value)}｜MA60 ${fmt(a.features.ma[60].value)}`,
  `量能：前5根均量 ${fmt(a.features.volumePrior5/1000)} 張｜單日增量 ${fmt(a.features.volumeChangeLots)} 張`]),
 ...(t?[`【日不落三日結構】${t.label}｜${t.signalDate||'無訊號'}；${t.confirmedDate?'確認 '+t.confirmedDate:'後續確認不得前視'}`,`D3高點 ${fmt(t.d3?.high)}｜失效 ${fmt(t.invalidation)}`]:[]),
 ...(g?[`【葛蘭碧八大法則】${g.signals.map(x=>`${x.code}/MA${x.maPeriod} ${x.label}`).join('；')||'未形成'}`]:[]),
 ...(c?[`【六種K線型態】${c.patterns.map(x=>`${x.patternLabelZh} ${x.signalDate} ${STATES[x.stage]||x.stage}；確認 ${fmt(x.confirmTrigger)}／失效 ${fmt(x.invalidationTrigger)}`).join('；')||'未形成'}`]:[]),
 ...(f.jointValidation?[`【三模型聯合判讀】${STATES[f.jointValidation.state]||f.jointValidation.state}｜共用證據不重複加分`]:[]),
 ...(d?[`【研究A｜均線初轉強】${STATES[d.modeA.status]}｜${checks(d.modeA.checks)}`,`【研究B｜高週轉強勢】${STATES[d.modeB.status]}｜${checks(d.modeB.checks)}`,`日線RSI期數 ${d.modeA.rsi.period||'未核實'}；籌碼／股數／正式成交值來源須逐項核驗`]:[]),
 ...(p?[`【下一交易日｜DRAX四項提醒】${p.nextTradingDate||'有效日期待確認'}`,`價格高於：${fmt(p.priceAbove.input)}｜來源 ${p.priceAbove.basis||'缺有效價位'}`,`價格低於：${fmt(p.priceBelow.input)}｜來源 ${p.priceBelow.basis||'缺有效價位'}`,`單日漲幅超過：${p.dayGainPercentInput??'資料不足'} %；單日跌幅超過：${p.dayLossPercentInput??'資料不足'} %`,`${p.priceAbove.alreadyCrossed||p.priceBelow.alreadyCrossed?'盤後已越過原價位，留意開盤即觸發。':''}平台比較語意待確認；設定狀態未核驗，需手動輸入。`,p.note]:[]),
 '尚未證明提高隔日精準度；原六策略資格、分數與排序保留。'];
}
function text(a){return lines(a).join('\n');}
function wrap(ctx,s,width){const out=[];for(const p of String(s).split('\n')){let row='';for(const ch of p){if(row&&ctx.measureText(row+ch).width>width){out.push(row);row=ch;}else row+=ch;}out.push(row);}return out;}
function pages(a,{document:doc=globalThis.document,displayCode='V8.2',watermark=false}={}){
 const W=1284,H=2778,M=42,SIZE=44,LH=64,TOP=260,BOTTOM=2580,ctx=doc.createElement('canvas').getContext('2d');ctx.font=`600 ${SIZE}px "Microsoft JhengHei",sans-serif`;
 const strings=lines(a).slice(0,-1),capacity=Math.floor((BOTTOM-TOP)/LH),plans=[];let current=[];for(let i=0;i<strings.length;i++){let block=wrap(ctx,strings[i],W-2*M);if(strings[i].startsWith('【下一交易日｜DRAX')){while(i+1<strings.length)block.push(...wrap(ctx,strings[++i],W-2*M));}if(current.length&&current.length+block.length>capacity){plans.push(current);current=[];}while(block.length>capacity){plans.push(block.splice(0,capacity));}current.push(...block);}if(current.length)plans.push(current);
 return plans.map((plan,i)=>{const dataset={researchAudit:JSON.stringify({code:a.code,date:a.date,sourceSnapshotId:a.sourceSnapshotId,originalB:a.originalB,alertPlan:a.foundation?.alertPlan,width:W,height:H,index:i+1,total:plans.length,minFont:34,bodyBottom:TOP+(plan.length-1)*LH,noClipping:TOP+(plan.length-1)*LH<BOTTOM,lazy:true,lines:plan}),release:a.version,fullBleed:'true'};
  const paint=x=>{x.fillStyle='#0e1b2a';x.fillRect(0,0,W,H);x.fillStyle='#17344f';x.fillRect(0,0,W,210);x.fillStyle='#fff';x.font='800 54px "Microsoft JhengHei",sans-serif';x.fillText('四策略強勢診斷',M,80);x.font='600 36px sans-serif';x.fillText(`${displayCode}｜${a.date||'日期待確認'}｜研究附頁 ${i+1}/${plans.length}`,M,154);x.font=`600 ${SIZE}px "Microsoft JhengHei",sans-serif`;plan.forEach((s,j)=>{x.fillStyle=s.startsWith('【')?'#99d7ff':'#eef5fc';x.fillText(s,M,TOP+j*LH);});x.fillStyle='#17344f';x.fillRect(0,2600,W,178);x.fillStyle='#ffdf94';x.font='600 34px "Microsoft JhengHei",sans-serif';x.fillText('原榜與B價保留｜尚未驗證樣本外績效',M,2670);x.fillStyle='#fff';x.fillText('DRAX 待手動設定｜完整識別見版本詳情',M,2732);};
  const render=({top=0,height=H,scale=1}={})=>{const c=doc.createElement('canvas');c.width=Math.floor(W*scale);c.height=Math.floor(height*scale);const x=c.getContext('2d');x.setTransform(scale,0,0,scale,0,-top*scale);paint(x);Object.assign(c.dataset,dataset);return c;};
  return {width:W,height:H,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){const c=render();if(watermark&&globalThis.applyAntiTheftWatermarkV3761)globalThis.applyAntiTheftWatermarkV3761(c,'all');c.toBlob(b=>{c.width=c.height=1;callback(b);},type);}};
 });
}
function candlePage(a,{document:doc=globalThis.document}={}){const b=a.sourceBars;if(!b?.length)return null;const c=doc.createElement('canvas');c.width=1284;c.height=2778;const x=c.getContext('2d'),left=90,right=1220,top=380,bottom=1850,volumeBottom=2350,hi=Math.max(...b.map(z=>z.high)),lo=Math.min(...b.map(z=>z.low)),span=hi-lo||1,w=(right-left)/b.length,y=v=>bottom-(v-lo)/span*(bottom-top),maxV=Math.max(...b.map(z=>z.volume));x.fillStyle='#0e1b2a';x.fillRect(0,0,1284,2778);x.fillStyle='#fff';x.font='bold 52px sans-serif';x.fillText('真實OHLCV｜研究附圖',42,90);x.font='36px sans-serif';x.fillText(`${a.name}（${a.code}）｜${a.date}`,42,170);x.fillText(`高 ${fmt(hi)}｜低 ${fmt(lo)}｜量：股`,42,255);b.forEach((z,i)=>{const xx=left+w*(i+.5),color=z.close>z.open?'#ff767d':z.close<z.open?'#54d6af':'#d3dce6';x.strokeStyle=color;x.lineWidth=4;x.beginPath();x.moveTo(xx,y(z.high));x.lineTo(xx,y(z.low));x.stroke();x.fillStyle=color;x.fillRect(xx-w*.25,Math.min(y(z.open),y(z.close)),w*.5,Math.max(3,Math.abs(y(z.close)-y(z.open))));x.fillRect(xx-w*.25,volumeBottom-z.volume/maxV*320,w*.5,z.volume/maxV*320);});x.fillStyle='#fff';x.font='36px sans-serif';x.fillText(`${b[0].date} 至 ${b.at(-1).date}｜${b.length}根完成日K`,42,2470);x.fillText('紅K收盤>開盤；平收另色；不重建盤中路徑。',42,2580);x.fillText('V8.2｜僅研究；原七格與原圖另頁保留。',42,2690);c.dataset.researchCandles=JSON.stringify({code:a.code,date:a.date,bars:b,width:1284,height:2778});return c;}
return Object.freeze({fmt,STAGES,lines,text,wrap,pages,candlePage});
});
