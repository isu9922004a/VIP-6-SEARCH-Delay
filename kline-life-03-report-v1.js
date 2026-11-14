/* V9.3.2 shared beginner display model and measured single-image report. */
(function(root,factory){const node=typeof module==='object'&&!!module.exports;const api=factory(node?require('./kline-life-03-core-v1.js'):root.ShitouKlineLife03);if(node)module.exports=api;else root.ShitouKlineLife03Report=api;})(globalThis,function(Core){
'use strict';
const VERSION='KLINE_LIFE_03_REPORT_V1';
const Layout=typeof module==='object'&&module.exports?require('./research-chart-layout-v921.js'):globalThis.ShitouChartLayout921;
const fmt=x=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(2):'資料不足';
const localTime=value=>Number.isFinite(new Date(value).getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'時間未核對';
const money=x=>typeof x==='number'&&Number.isFinite(x)?fmt(x)+' 元':'資料不足';
const names={RESISTANCE_WATCH:'還沒突破上方壓力',BREAKOUT_INITIAL:'剛收盤突破',BREAKOUT_HELD:'突破後持續站穩',BREAKOUT_CONFIRMED:'收盤突破',BREAKOUT_FAILED:'突破後又跌回來',SUPPORT_WATCH:'下方支撐仍在觀察',SUPPORT_BROKEN:'跌破重要支撐',SUPPORT_RECLAIMED:'跌破後重新站回',RETEST_HELD:'回頭測試後仍守住',HISTORICAL_REFERENCE:'以前的重要參考價',INSUFFICIENT_DATA:'資料不足，無法確認'};
function missingText(items){const translations={'BULL_PULLBACK_RECLAIM_V1:B9':'回檔研究的衝刺條件尚未驗證','MOMENTUM_CONTINUATION_V1:C6':'短線延續研究的均線條件尚未驗證','FLOW_FUNDAMENTAL_CONFIRM_V1:D3':'已公布營收證據未完整','FLOW_FUNDAMENTAL_CONFIRM_V1:D4':'主力買盤證據未完整','FLOW_FUNDAMENTAL_CONFIRM_V1:D5':'分公司買賣差額證據未完整'};return [...new Set((items||[]).map(v=>translations[v]||(/[A-Z_]+_V\d+:/.test(v)?'部分研究條件缺少可核對資料，完整代碼見技術資料':v)))].join('；')||'未列出';}
function inspect(a){const study=Core.evaluate(a);return {...study,name:study.name||a?.name||'',code:study.code||a?.code||''};}
function teaching(){return [
 {title:'新手教學｜生命線怎麼看？',value:'生命線是從過去 K 線找出的重要參考價，幫助觀察突破或跌破；不是保證漲跌的價格。每根日 K 記錄一天的開盤、最高、最低與收盤。'},
 {title:'① 生命線從哪來｜四根完成日 K',value:'K3：四根中最早的一根，提供生命線價位。\nK2：比較 K3，高點升高或低點降低。\nK1：延續 K2，同方向再升高或降低。\nK0：高點不再升高，或低點不再降低，當天收盤後才確認。\n高點一路升高的組合：取 K3 最低價當支撐。\n低點一路降低的組合：取 K3 最高價當壓力。\n如果高點一路升高、低點也一路降低，這組不成立。四根都是相鄰的有效交易日 K，遇缺漏不能自行補齊。\n生命線取 K3 的價位，不是直接拿 K0 的收盤價。'},
 {title:'② 用收盤確認｜盤中碰到不算',value:'收盤 ＞ 壓力：正式突破。\n連續 '+Core.DEFAULT.holdBars+' 根完成日 K 收盤 ＞ 同一關卡：持續站穩。\n收盤 ＜ 支撐：正式跌破。\n跌破後，收盤重新 ＞ 支撐：重新站回。\n相等不算突破或重新站回；支撐相等不算跌破。突破後收盤回到關卡或以下，則算突破失守。'},
 {title:'③ 現在還能不能參考？',value:'突破失敗：曾收盤突破，後來收盤又回到關卡或以下。\n回測守住：已站穩後，前一根低點離開關卡；後一根最低價回到關卡上下 '+Core.DEFAULT.retestTolerancePct+'% 內，且收盤仍高於關卡。不是所有站穩都算回測。\n歷史參考價：事件較久，或已離現價超過近期平均波動的三倍，且近十根 K 未碰到；不當成今天主要關卡。\n偏強也可能漲得太急。接下來要看近期高低點、平均價和成交量，不能只憑突破追價。'}
];}
function overview(x){
 const e=x.event,t=x.currentTrend||{},source=(x.validatedBars||[]).find(b=>b.date===e?.k3Date),k0=(x.validatedBars||[]).find(b=>b.date===e?.k0Date);
 const sourcePoint=e?(e.side==='BULL'?'最低價':'最高價'):null;
 const firstDate=e?.firstBreakoutDate||e?.firstBreakdownDate||null,firstBar=(x.validatedBars||[]).find(b=>b.date===firstDate);
 const simplify=value=>({
  '最近5日漲得急，追高後可能回落':'最近5個交易日上漲較快',
  '股價離5日平均價超過兩倍近期平均波動，追價風險較高':'股價離最近5天平均價較遠，回跌風險較大',
  '目前未觸發急漲提醒，仍不代表追價安全':'目前沒有急漲提醒，仍要留意回跌風險。'
 }[value]||Layout.plain(value));
 return {trendSummary:({STRONG:'股價近期偏強，但追高買進仍可能遇到回跌。',WEAK:'股價近期偏弱，先看收盤能不能重新站回重要價位。',NEUTRAL:'股價還在上下整理，目前沒有一致的方向。'})[t.state]||'完成日 K 或平均價資料不足，暫時無法判斷方向。',riskReasons:(x.chaseRisk?.reasons||[]).map(v=>simplify(v).replace(/[。；]+$/,'')),technicalRiskReasons:[...(x.chaseRisk?.reasons||[])],sourcePoint,sourceDate:source?.date??null,sourcePrice:e?.lifeLinePrice??null,k0Date:e?.k0Date??null,k0Close:k0?.close??null,firstCrossDate:firstDate,firstCrossClose:firstBar?.close??null,recentBarCount:t.recentBarCount??Math.min(10,x.validatedBars?.length||0)};
}
function fields(x){
 const e=x.event,t=x.currentTrend||{},dates=e?['K3','K2','K1','K0'].map(k=>k+' '+(e[k.toLowerCase()+'Date']||'日期未提供')).join('｜'):'目前還沒有可成立生命線的K0訊號';
 const title=e?(e.referenceOnly?names.HISTORICAL_REFERENCE:names[e.lifecycleState]):x.state==='INSUFFICIENT_DATA'?names.INSUFFICIENT_DATA:'尚未出現符合規則的生命線';
 const anchor=e?(e.referenceOnly?'以前的重要參考價':e.currentRole==='SUPPORT'?(e.side==='BULL'?'下方支撐（K3低點）':'下方支撐（原壓力已突破）'):'上方壓力')+' '+money(e.lifeLinePrice):'生命線尚未成立';
 const summary={title:'先用一句話告訴我結論',value:(x.scenario?.summary||x.reason||names.INSUFFICIENT_DATA)+' '+anchor};
 const details=[
 {title:'這條生命線從哪來？',value:dates+'\n'+anchor+'。原始型態：'+(e?(e.side==='BULL'?'高點逐根升高，K0停止創高':'低點逐根降低，K0停止創低'):x.state==='INSUFFICIENT_DATA'?'資料不足':'尚未形成')+'\n首次突破：'+(e?.firstBreakoutDate||'尚無確認')+'；首次跌破：'+(e?.firstBreakdownDate||'尚無確認')+'\n目前：'+title},
 {title:'收盤離這條線多遠？',value:'收盤 '+money(x.close)+'；價格距離 '+(typeof x.distancePct==='number'&&x.distancePct>0?'+':'')+fmt(x.distancePct)+'%。這是價格距離，不是報酬預測。'+'\n歷史生命線：'+(x.events||[]).map(e=>e.signalDate+' '+money(e.lifeLinePrice)).join('；')},
 {title:'已確認',value:(x.scenario?.confirmed||[]).map(v=>v.date+' '+(v.kind==='BREAKOUT_CONFIRMED'?(v.date===e?.firstBreakoutDate?'首次收盤突破':'再次收盤突破'):names[v.kind]||v.kind)+' '+money(v.price)).join('\n')||'尚無收盤確認事件'},
 {title:'如果繼續走強',value:x.scenario?.bullish||(x.state==='INSUFFICIENT_DATA'?'資料不足，先不產生價格條件。':'尚無可用生命線，先觀察最近高點 '+money(t.recentHigh)+' 與成交量是否配合。')},
 {title:'如果開始轉弱',value:x.scenario?.bearish||(x.state==='INSUFFICIENT_DATA'?'資料不足，先不產生價格條件。':'先觀察最近低點 '+money(t.recentLow)+' 與短期平均價，不能補造生命線支撐。')},
 {title:'還沒確認',value:(x.scenario?.pending||(x.state==='INSUFFICIENT_DATA'?['等待資料補齊並核對完成日 K']:['等待新的完成日 K 形成符合規則的 K0'])).join('；')+'\n'+(x.scenario?.neutral||(x.state==='INSUFFICIENT_DATA'?'需取得足夠的完成日 K 才能判讀。':'目前沒有可用生命線，不能補造突破價位。'))},
 {title:'現在偏強還是偏弱？',value:(t.state==='STRONG'?'收盤高於5日平均價，5日平均價又高於20日平均價，近期價格偏強。':t.state==='WEAK'?'收盤低於5日平均價，5日平均價又低於20日平均價，近期價格偏弱。':t.state==='NEUTRAL'?'收盤與短中期平均價的位置沒有一致方向，暫列上下整理、繼續觀察。':'平均價資料不足，暫時無法確認目前方向。')+'\n目前'+(t.label||'資料不足')+'；收盤 '+money(x.close)+'。\n5日平均價（MA5）'+money(t.ma5)+'；10日 '+money(t.ma10)+'；20日平均價（MA20）'+money(t.ma20)+'。\n股價與5日平均價距離 '+fmt(t.deviation5)+'%；與20日距離 '+fmt(t.deviation20)+'%。\n上漲下跌力道（RSI，越高表示近期上漲較急）：5日 '+fmt(t.rsi5)+'；14日 '+fmt(t.rsi14)+'。\n'+(x.sourceVolumeAudit?.uncertain?'成交量來源版本有差異，暫不判讀是否放量。':'成交量為前5日平均的 '+fmt(t.volumeRatio)+' 倍；放量本身不保證繼續上漲。')},
 {title:'追價與波動風險',value:[...(x.chaseRisk?.reasons||[]),...x.riskWarnings.map(Layout.plain)].join('\n')+'\n近期平均每日波動金額（ATR14）'+money(t.atr14)+'。股價起伏較大（ATR）時，不能保證在指定價成交。'+(x.sourceVolumeAudit?.uncertain?'\n成交股數差異於 '+localTime(x.sourceVolumeAudit.latestRetrievedAt)+'（台北時間）核對，量能暫不確認。':'')},
 {title:'資料來源與注意事項',value:'行情 '+(x.dataAsOf||x.date||'尚未核對')+'；使用 '+(x.historyBarCount||0)+' 根完成日 K。'+(x.sourcePublishedAt?'\n研究套件產製時間 '+localTime(x.sourcePublishedAt)+'（台北時間）。':'')+'\n價格與成交量來源：'+(x.dataSource==='Verified official exchange daily archive'?'交易所官方逐日行情（成交量以股數計）':x.dataSource||'尚未提供')+'；價格口徑：'+(x.priceAdjustment?.basis==='UNADJUSTED_OFFICIAL_OHLC'?'交易所未還原成交價格':x.priceAdjustment?.basis||'這份分析未附口徑明細，須查原始行情')+(x.priceAdjustment?.corporateActionsVerified===false?'；除權息事件尚未完整核對':'')+'。\n研究版本 V9.3.2；'+(x.state==='INSUFFICIENT_DATA'?'資料不足':'已通過輸入檢查，部分長期指標可能不足')+'；其他缺項：'+missingText(x.dataCompleteness?.missing)+'。\n獲利表現還沒驗證；本報告提供技術研究參考，未來仍可能上漲或下跌，不能保證獲利。'}
 ];return {summary,details,teaching:teaching(),statusCode:e?.lifecycleState||'INSUFFICIENT_DATA',title,overview:overview(x),importantPrices:{line:e?.referenceOnly?null:e?.lifeLinePrice??null,high:t.recentHigh??null,low:t.recentLow??null}};
}
function lines(x){const v=fields(x);return [v.summary,...v.teaching,...v.details].map(f=>'【'+f.title+'】'+f.value);}
function page(x,{document:doc=globalThis.document,displayCode=globalThis.ShitouReleaseV50?.displayCode||'V9.3.2',watermark=false,bars:source=[]}={}){
 if(!doc?.createElement)return null;
 const W=1284,M=72,WIDTH=W-2*M,probe=doc.createElement('canvas').getContext('2d');if(!probe)return null;
 const v=fields(x);source=x.validatedBars||source;const bars=Array.isArray(source)&&source.at(-1)?.date===x.date?source.filter(b=>b.date<=x.date):[];
 const historical=x.event?bars.slice(Math.max(0,bars.findIndex(b=>b.date===x.event.k3Date)-3)):bars.slice(-30),recent=bars.slice(-10);
 let top=430;const sections=[];
 const cards=items=>{const blocks=Layout.blocks(probe,items,{top,width:WIDTH,size:38});sections.push({kind:'cards',blocks});top=blocks.at(-1).top+blocks.at(-1).height+36;};
 cards([v.summary,...v.teaching,v.details[0]]);
 const charts=[];
 function chart(rows,title,history){
  const values=rows.flatMap(b=>[b.low,b.high]);if(!history)for(const b of rows){const i=bars.indexOf(b);for(const n of [5,10])if(i>=n-1)values.push(bars.slice(i-n+1,i+1).reduce((s,b)=>s+b.close,0)/n);}
  if(history&&x.event)values.push(x.event.lifeLinePrice);
  const lo=values.length?Math.min(...values):0,hi=values.length?Math.max(...values):1,pad=Math.max((hi-lo)*.12,hi*.01),min=lo-pad,max=hi+pad;
  const geometry=Layout.eventLayout(history?x.event:null,rows,{x:155,y:top+250,width:1045,height:600,min,max,labelY:top+100});
  const c={kind:'chart',rows,title,history,top,min,max,geometry};sections.push(c);charts.push(c);top+=1080;
 }
 chart(historical,'圖 A｜以前發生什麼事？',true);chart(recent,'圖 B｜最近股價怎麼走？',false);
 cards([v.details[6],v.details[7],{title:'下一交易日要看什麼？',value:'重要價位：近期高點 '+money(v.importantPrices.high)+'；低點 '+money(v.importantPrices.low)+'。\n'+(v.importantPrices.line?'目前生命線 '+money(v.importantPrices.line):'原始生命線僅供歷史參考，或尚未成立。')},v.details[3],v.details[4],v.details[2],v.details[5],v.details[8]]);
 const H=Math.max(2778,top+150),audit={version:VERSION,model:x.model,date:x.date,code:x.code,width:W,height:H,noClipping:true,eventId:x.event?.eventId||null,...Object.fromEntries(['k0Date','k1Date','k2Date','k3Date','lifeLinePrice','signalDate'].map(k=>[k,x.event?.[k]??null])),state:x.state,lifecycleState:x.lifecycleState,currentState:x.currentState,studyOnly:true,performance:'NOT_VALIDATED',fieldCount:v.details.length+v.teaching.length,barDates:historical.map(b=>b.date),sourceBarDates:bars.map(b=>b.date),geometry:charts[0].geometry,charts:charts.map(c=>({title:c.title,min:c.min,max:c.max,barDates:c.rows.map(b=>b.date)})),fields:[v.summary,...v.teaching,...v.details],section:'LIFE_CHART'};
 function paint(){
  const c=doc.createElement('canvas');c.width=W;c.height=H;const q=c.getContext('2d');q.textBaseline='top';q.fillStyle='#0b2032';q.fillRect(0,0,W,H);
  const text=(s,y,size=38,color='#e7f0f6',xx=M)=>{Layout.font(q,size);q.fillStyle=color;for(const row of Layout.wrap(q,s,WIDTH,size)){q.fillText(row,xx,y);y+=size+14;}};
  text('石頭少爺 '+displayCode+'｜生命線研究',48,42);text((x.name||x.code||'個股')+'（'+(x.code||'—')+'）',115,62);
  text('收盤 '+money(x.close)+'｜'+(x.date||'日期尚未核對'),205,46);
  text('目前'+(x.currentTrend?.label||'資料不足')+'｜'+(x.chaseRisk?.level==='ELEVATED'?'追價風險較高':'追價風險仍需留意'),290,40,'#ffdc8c');
  text(x.state==='INSUFFICIENT_DATA'?'資料不足，暫不確認生命線':x.sourceVolumeAudit?.uncertain?'日 K 價格已核對｜成交量仍待核對':'完成日 K '+(x.historyBarCount||0)+' 根｜依已核對窗口判讀',355,34,'#b8d2e3');
  for(const s of sections){if(s.kind==='cards'){Layout.paintBlocks(q,s.blocks,{size:38});continue;}
   text(s.title,s.top,44,'#92ded4');const {rows,geometry:g,min,max}=s,p=g.plot,yp=n=>p.y+p.height-(n-min)/(max-min)*p.height,xp=i=>p.x+(i+.5)*g.dx;
   if(!rows.length){text('缺少完成日 K，先不畫價格位置。',s.top+110);continue;}
   for(let i=0;i<=4;i++){const yy=p.y+i*p.height/4;q.strokeStyle='#29495d';q.lineWidth=1;q.beginPath();q.moveTo(p.x,yy);q.lineTo(p.x+p.width,yy);q.stroke();Layout.font(q,30);q.fillStyle='#b8d2e3';q.fillText(fmt(max-(max-min)*i/4),8,yy-15);}
   const maxVol=Math.max(...rows.map(b=>b.volume));
   rows.forEach((b,i)=>{const xx=xp(i);q.strokeStyle=q.fillStyle=b.close>=b.open?'#ff8b95':'#6adbb4';q.lineWidth=3;q.beginPath();q.moveTo(xx,yp(b.high));q.lineTo(xx,yp(b.low));q.stroke();q.fillRect(xx-g.dx*.26,Math.min(yp(b.open),yp(b.close)),Math.max(2,g.dx*.52),Math.max(3,Math.abs(yp(b.open)-yp(b.close))));q.fillRect(xx-g.dx*.26,s.top+980-b.volume/maxVol*70,Math.max(2,g.dx*.52),b.volume/maxVol*70);});
   if(s.history&&x.event){const firstDate=x.event.firstBreakoutDate||x.event.firstBreakdownDate,firstIndex=rows.findIndex(b=>b.date===firstDate);if(firstIndex>=0){text((x.event.firstBreakoutDate?'首次突破 ':'首次跌破 ')+firstDate,s.top+205,32,'#ffdc8c');q.fillStyle='#ffdc8c';q.beginPath();q.arc(xp(firstIndex),yp(rows[firstIndex].close),8,0,Math.PI*2);q.fill();}
   q.strokeStyle='#ffdc8c';q.setLineDash([12,8]);q.beginPath();q.moveTo(p.x,yp(x.line));q.lineTo(p.x+p.width,yp(x.line));q.stroke();q.setLineDash([]);text('原始生命線 '+money(x.line)+'｜首次突破 '+(x.event.firstBreakoutDate||'尚無'),s.top+870,34);g.labels.forEach(e=>{q.strokeStyle='#b8d2e3';q.beginPath();q.moveTo(e.x+e.width/2,e.y+e.height);q.lineTo(e.anchorX,e.anchorY);q.stroke();q.fillStyle='#163b52';q.fillRect(e.x,e.y,e.width,e.height);text(e.key,e.y+5,38,'#ffdc8c',e.x+12);Layout.font(q,30);q.fillStyle='#eef6ff';q.fillText(e.date,e.x+12,e.y+52);});
   }else{text('黃線：5日平均價；青線：10日平均價',s.top+100,34,'#b8d2e3');if(x.event&&!x.event.referenceOnly){const line=x.event.lifeLinePrice,inside=line>=min&&line<=max;text('目前觀察'+(x.event.currentRole==='SUPPORT'?'下方支撐 ':'上方壓力 ')+money(line)+(inside?'':'（在本圖價格範圍外）'),s.top+155,34,'#ffdc8c');if(inside){q.strokeStyle='#ffdc8c';q.lineWidth=2;q.setLineDash([12,8]);q.beginPath();q.moveTo(p.x,yp(line));q.lineTo(p.x+p.width,yp(line));q.stroke();q.setLineDash([]);}}const trend=x.currentTrend||{};for(const [n,color] of [[5,'#ffdc8c'],[10,'#92ded4']]){q.strokeStyle=color;q.lineWidth=3;q.beginPath();let started=false;rows.forEach((b,i)=>{const j=bars.indexOf(b);if(j<n-1)return;const value=bars.slice(j-n+1,j+1).reduce((a,b)=>a+b.close,0)/n;if(!started){q.moveTo(xp(i),yp(value));started=true;}else q.lineTo(xp(i),yp(value));});q.stroke();}text('近十根高點 '+money(trend.recentHigh)+'｜低點 '+money(trend.recentLow),s.top+870,34);}
   Layout.font(q,30);q.fillStyle='#b8d2e3';q.fillText(rows[0].date,p.x,s.top+1010);q.fillText(rows.at(-1).date,p.x+p.width-200,s.top+1010);text(x.sourceVolumeAudit?.uncertain?'紅：收盤不低於開盤；綠：收盤較低｜下方為封存成交量，待核對':'紅：收盤高於或等於開盤；綠：收盤低於開盤｜下方為成交量',s.top+1045,30);
  }
  text('研究參考，不能保證獲利｜'+displayCode,H-95,34,'#b8d2e3');if(watermark&&globalThis.ShitouReportWatermark?.paint)globalThis.ShitouReportWatermark.paint(q,{width:W,height:H,type:'all'});
  Object.assign(c.dataset,{life03Audit:JSON.stringify(audit),release:displayCode,fullBleed:'true',shareAsSingleImage:'true'});return c;
 }
 return {width:W,height:H,dataset:{life03Audit:JSON.stringify(audit),release:displayCode,shareAsSingleImage:'true'},renderExportRegion:paint,toBlob(callback,type='image/png'){const c=paint();c.toBlob(blob=>{c.width=c.height=1;callback(blob);},type);}};
}
function pages(x,options={}){const renderer=typeof module==='object'&&module.exports?require('./kline-life-03-pages-v94.js'):globalThis.ShitouLifePages94;return renderer.build(x,{fields:fields(x),teaching:teaching()},options);}
return Object.freeze({VERSION,inspect,fields,lines,page,pages,teaching,overview});
});
