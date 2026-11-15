/* Read-only visual research. Core event, trend, risk and selection objects are never rewritten. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./research-chart-layout-v921.js'):root.ShitouChartLayout921);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouLifeVisual972=api;})(globalThis,function(L){
'use strict';
const RELEASE='V9.7.2',VERSION='LIFE_VISUAL_RESEARCH_V972',W=1284,H=2778,M=48,CW=W-2*M,BOTTOM=2608;
const C={bg:'#0B2032',card:'#102E43',text:'#EDF6FF',muted:'#AFC2D5',mint:'#8FF5D3',orange:'#FFB45E',risk:'#FF8C93',gold:'#FFD76A',blue:'#49B8FF',green:'#53E28C',up:'#FF8392',down:'#5ED3B0',grid:'#345267'};
const finite=n=>typeof n==='number'&&Number.isFinite(n),num=n=>finite(n)?n.toFixed(2):'資料不足',money=n=>finite(n)?num(n)+' 元':'資料不足',plain=s=>L.plain(String(s??'資料不足'));
const MA_COLORS={5:C.text,10:C.blue,20:C.green,60:C.gold};
const script=typeof document!=='undefined'?document.currentScript?.src:null,assetUrl=script?new URL('assets/shitou-character-original-v972.jpg',script).href:null;
let portrait=null,loading=null;
async function ready(doc=globalThis.document){if(!doc?.createElement)throw Error('圖片畫布尚未提供');if(doc.fonts?.ready)await doc.fonts.ready;if(portrait?.naturalWidth)return portrait;if(!assetUrl)throw Error('指定人物原圖尚未載入，不能輸出新版圖片');if(!loading)loading=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{portrait=img;resolve(img);};img.onerror=()=>{loading=null;reject(Error('指定人物原圖讀取失敗，請重新載入'));};img.src=assetUrl;});return loading;}
function seriesMA(bars,n){return bars.map((b,i)=>i>=n-1?bars.slice(i-n+1,i+1).reduce((sum,row)=>sum+row.close,0)/n:null);}
const stateNames={RESISTANCE_WATCH:'尚未突破',BREAKOUT_INITIAL:'首次收盤突破',BREAKOUT_HELD:'目前守住',BREAKOUT_CONFIRMED:'收盤突破',BREAKOUT_FAILED:'突破後失守',SUPPORT_WATCH:'目前守住',SUPPORT_BROKEN:'收盤已跌破',SUPPORT_RECLAIMED:'跌破後站回',RETEST_HELD:'回測後守住',HISTORICAL_REFERENCE:'歷史參考',INSUFFICIENT_DATA:'資料不足'};
function model(study,{record=null,display=null,source=null}={}){
 const s=JSON.parse(JSON.stringify(study)),date=s.dataAsOf||s.date||null,e=s.event||null,t=s.currentTrend||{};
 if(t.dataAsOf&&t.dataAsOf!==date)throw Error('目前趨勢與行情日期不一致');
 if(e&&(e.dataAsOf&&e.dataAsOf!==date||e.signalDate>date||(e.events||[]).some(v=>v.date>date)))throw Error('生命線事件與行情日期不一致');
 const invalid=s.state==='INSUFFICIENT_DATA'||s.lifecycleState==='INSUFFICIENT_DATA'&&!s.validatedBars?.length;
 const bars=invalid?[]:(s.validatedBars||[]).filter(b=>b.date<=date);
 if(bars.some((b,i)=>!/^\d{4}-\d\d-\d\d$/.test(b.date)||i&&b.date<=bars[i-1].date||!['open','high','low','close','volume'].every(k=>finite(b[k]))||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||b.volume<0||b.close<=0))throw Error('展示日 K 與已驗證行情不一致');
 if(bars.length&&bars.at(-1).date!==date)throw Error('完成行情日期與圖表不一致');
 const close=bars.length?bars.at(-1).close:null;if(close!==null&&s.close!==close)throw Error('最新收盤與已驗證日 K 不一致');
 if(record&&(record.code!==s.code||record.date!==date||record.eventId!==e?.eventId||record.close!==close||record.lifeLinePrice!==e?.lifeLinePrice))throw Error('入選個股與生命線快照不一致');
 const line=e&&finite(e.lifeLinePrice)&&e.lifeLinePrice>0?e.lifeLinePrice:null;const k3=bars.find(b=>b.date===e?.k3Date);if(k3&&line!==k3[e.side==='BULL'?'low':'high'])throw Error('生命線與原始 K3 價格不一致');
 const reference=!!e?.referenceOnly,active=!!e&&!reference&&['SUPPORT','RESISTANCE'].includes(e.currentRole);
 const maSeries=Object.fromEntries([5,10,20,60].map(n=>[n,seriesMA(bars,n)])),ma=Object.fromEntries([5,10,20,60].map(n=>[n,maSeries[n].at(-1)??null]));
 const recent=bars.slice(-10),range=recent.length?{high:Math.max(...recent.map(b=>b.high)),low:Math.min(...recent.map(b=>b.low))}:{high:null,low:null};
 const levels=[];if(active&&line!==null)levels.push({kind:'LIFE_LINE',role:e.currentRole,price:line,date:e.signalDate,confirmedAt:e.signalDate,label:e.currentRole==='SUPPORT'?'生命線／支撐':'生命線／壓力',color:C.mint});
 for(const [key,role]of [['swingHigh','RESISTANCE'],['swingLow','SUPPORT']]){const p=t[key];if(!p||!finite(p.price)||!p.confirmedAt||p.confirmedAt>date||p.date>p.confirmedAt)continue;const index=bars.findIndex(b=>b.date===p.date),confirm=bars.findIndex(b=>b.date===p.confirmedAt);if(index<2||confirm!==index+2||!bars[index+2]||bars[index][role==='SUPPORT'?'low':'high']!==p.price)continue;
  // Only the already-confirmed core pivot is consumed. A later closing cross retires it in this read-only overlay.
  if(bars.slice(confirm+1).some(b=>role==='RESISTANCE'?b.close>p.price:b.close<p.price))continue;
  if(role==='RESISTANCE'&&p.price<=close||role==='SUPPORT'&&p.price>=close||levels.some(v=>v.price===p.price&&v.role===role))continue;
  levels.push({kind:'CONFIRMED_SWING',role,price:p.price,date:p.date,confirmedAt:p.confirmedAt,label:role==='SUPPORT'?'結構支撐':'確認壓力',color:role==='SUPPORT'?C.green:C.orange});
 }
 const resistance=levels.filter(l=>l.role==='RESISTANCE').sort((a,b)=>a.price-b.price).slice(0,2),support=levels.filter(l=>l.role==='SUPPORT').sort((a,b)=>b.price-a.price).slice(0,2);
 const raw=source||record?.raw,rawBars=raw?.dailySeries||raw?.canonicalBars||raw?.sourceBars;
 const suppliedMatches=!raw||raw.closeDate===date&&String(raw.stock||raw.code)===s.code&&raw.completed!==false&&raw.isComplete!==false&&Array.isArray(rawBars)&&bars.slice(-6).every(b=>{const r=rawBars.find(r=>r.date===b.date);return r&&['open','high','low','close','volume'].every(k=>r[k]===b[k]);})&&raw.volumeUnit==='shares';
 const volumeKnown=bars.length>=6&&suppliedMatches&&!s.sourceVolumeAudit?.uncertain&&(record?record.volumeVerified===true:!!s.priceAdjustment?.verified&&s.priceAdjustment.basis==='UNADJUSTED_OFFICIAL_OHLC');
 const average=bars.length>=6?bars.slice(-6,-1).reduce((a,b)=>a+b.volume,0)/5:null,volume={verified:volumeKnown&&average>0,date,unit:'股',last:volumeKnown?bars.at(-1).volume:null,average5:volumeKnown?average:null,ratio:volumeKnown&&average>0?bars.at(-1).volume/average:null};
 const trend={state:t.state||'INSUFFICIENT_DATA',label:({STRONG:'目前偏強',NEUTRAL:'盤整待確認',WEAK:'目前偏弱'})[t.state]||'資料不足',explanation:({STRONG:'收盤與均線偏強',WEAK:'收盤與均線偏弱',NEUTRAL:'均線還沒同向'})[t.state]||'平均價資料不足'};
 const state=reference?'HISTORICAL_REFERENCE':e?.lifecycleState||'INSUFFICIENT_DATA';
 const lifeLabel=!e&&bars.length?'尚未成立':e&&e.signalDate===date&&['SUPPORT_WATCH','RESISTANCE_WATCH'].includes(state)?'剛成立':state==='SUPPORT_BROKEN'&&e.firstBreakdownDate===date?'首次跌破':stateNames[state]||'資料不足';
 const lifeExplanation=({RESISTANCE_WATCH:'尚未收盤站上關卡。',BREAKOUT_INITIAL:'首度站上，仍須觀察。',BREAKOUT_HELD:'突破後仍持續守住。',BREAKOUT_FAILED:'先前突破沒有守住。',SUPPORT_WATCH:'尚未正式跌破支撐。',SUPPORT_BROKEN:'收盤已低於原支撐。',SUPPORT_RECLAIMED:'站回不等於轉強',RETEST_HELD:'回頭測試後仍守住。',HISTORICAL_REFERENCE:'舊價位僅供參考'})[state]||'沒有可確認的生命線。';
 const risk={label:record?.riskLabel|| (s.chaseRisk?.level==='ELEVATED'?'追價風險較高':bars.length?'追價仍須留意':'資料不足'),reasons:[...(record?.risks||[]),...(record?.missing||[]),...(record?.excluded||[]),...(s.chaseRisk?.reasons||[]),...(s.riskWarnings||[])].map(plain)};
 risk.explanation=!bars.length?'尚無法評估風險':risk.label.includes('較高')||risk.reasons.some(x=>/波動|過熱|漲得急/.test(x))?'追高仍可能回跌':'守住不代表安全';
 const p=active&&line!==null?num(line):null,upper=resistance[0],lower=support[0];
 const lifeText=!e?'沒有可確認生命線。':reference?'舊生命線 '+num(line)+'，只供歷史參考。':state==='SUPPORT_RECLAIMED'?'收盤已站回 '+p+'，仍須觀察。':state==='SUPPORT_BROKEN'?'收盤已跌破 '+p+'，支撐失守。':state==='BREAKOUT_FAILED'?'先前突破 '+p+' 後又失守。':e.currentRole==='RESISTANCE'?'壓力 '+p+' 尚待收盤突破。':close===line?'收盤等於 '+p+'；相等不算跌破。':'收盤仍守在 '+p+' 上方。';
 const insights=[{label:'生命線',text:lifeText},{label:'短期趨勢',text:trend.explanation},{label:'上方壓力',text:upper?num(upper.price)+' 元仍待收盤突破。':'尚無確認壓力；近高不是保證關卡。'},{label:'成交量',text:!volume.verified?'量能資料待核對。':'當日量為前5日平均 '+num(volume.ratio)+' 倍。'}];
 const conclusion=[lifeExplanation,trend.explanation,risk.explanation].map(v=>v.replace(/。$/,'')).join('。')+'。';
 const scenarios=[{title:'偏強觀察',color:C.mint,text:!bars.length?'資料不足，先等待完成日行情。':lower?'收盤守住 '+num(lower.price)+'，再看均線與量能。':upper?'收盤高於 '+num(upper.price)+'，再核對量能。':'先看均線與量能，不補造關鍵價位。'},{title:'繼續整理',color:C.gold,text:!bars.length?'資料不足，暫不確認方向。':lower&&upper?'收盤在 '+num(lower.price)+'～'+num(upper.price)+' 間，方向待確認。':'均線還未同向時，先等收盤確認。'},{title:'轉弱警示',color:C.risk,text:!bars.length?'資料補齊前，不產生失效價。':lower?(lower.kind==='LIFE_LINE'&&['BREAKOUT_INITIAL','BREAKOUT_HELD','RETEST_HELD'].includes(state)?'收盤回到 '+num(lower.price)+' 或以下，突破未守住。':'收盤低於 '+num(lower.price)+'，重新檢查支撐風險。'):upper?'收盤仍站不回 '+num(upper.price)+'，壓力尚未解除。':'目前無確認支撐，留意均線與風險。'}];
 const four=e?['K3','K2','K1','K0'].map(k=>({label:k,date:e[k.toLowerCase()+'Date'],bar:bars.find(b=>b.date===e[k.toLowerCase()+'Date'])||null})):[];
 const events=(e?.events||[]).map(x=>({...x}));
 return {version:VERSION,release:RELEASE,analysisVersion:s.version,analysisModel:s.model,code:s.code||'未提供',name:s.name||record?.name||'名稱未提供',date,close,line,distancePct:line&&close?(close/line-1)*100:null,lifecycleState:e?.lifecycleState||'INSUFFICIENT_DATA',currentRole:e?.currentRole||null,referenceOnly:reference,eventId:e?.eventId||null,event:e,events,four,trend,life:{label:lifeLabel,explanation:lifeExplanation},risk,range,ma,maSeries,volume,resistance,support,insights,conclusion,scenarios,bars,historyBarCount:bars.length,chartBarCount:Math.min(30,bars.length),snapshotId:record?.proof?.snapshotId||null,cost:record?{grade:record.grade,score:record.score,formalCandidate:record.formalCandidate,scenarios:record.scenarios}:null,source:s.dataSource||s.priceAdjustment?.source||'來源未提供',priceAdjustment:s.priceAdjustment||null,sourceVolumeAudit:s.sourceVolumeAudit||null,originalStudy:s,display,performanceValidated:false,researchOnly:true,affectsEligibility:false,affectsRanking:false,automaticTrade:false};
}
function build(study,{document:doc=globalThis.document,record=null,display=null,source=null,watermark=false}={}){
 if(!doc?.createElement)throw Error('瀏覽器尚未提供圖片畫布');const m=model(study,{record,display,source}),probe=doc.createElement('canvas'),q=probe.getContext('2d');if(!q)throw Error('瀏覽器無法建立圖片畫布');
 const plans=[];let page,y;const font=(c,size,weight=650)=>L.font(c,size,weight);
 function wrap(value,width,size,weight=650){font(q,size,weight);const result=[];for(const part of String(value??'資料不足').split('\n')){let row='';for(const ch of [...part]){if(row&&q.measureText(row+ch).width>width){result.push(row);row=ch;}else row+=ch;}result.push(row||' ');}return result;}
 function text(value,x,top,width,size=42,color=C.text,weight=650){const rows=wrap(value,width,size,weight),height=rows.length*(size+10);page.ops.push({kind:'text',rows,x,y:top,width,size,color,weight,height});return height;}
 function start(title,first=false){title='第 '+(plans.length+1)+' 頁／'+title.replace(/^第\s*\d+\s*頁[／/]/,'');page={title,ops:[],charts:[],boxes:[]};plans.push(page);page.ops.push({kind:'portrait',x:M,y:34,width:140,height:140});text('石頭少爺 '+RELEASE+'｜生命線研究',216,44,W-216-M,48,C.text,750);const captionHeight=text(first?'個股分析｜趨勢・關鍵價位・隔日觀察':title,216,110,W-216-M,38,C.muted);y=Math.max(194,110+captionHeight+18);if(!first)y+=text(m.name+'（'+m.code+'）｜'+(m.date||'日期待核對'),M,y,CW,40,C.muted)+18;}
 function box(x,top,width,height,color=C.card){const b={kind:'box',x,y:top,width,height,color};page.ops.push(b);page.boxes.push({...b});}
 function section(title,value,{size=42,color=C.text}={}){const rows=wrap(value,CW-32,size),head=58;let offset=0,part=0;while(offset<rows.length){if(BOTTOM-y<head+size+10+36)start(title+'（續）');const room=Math.max(1,Math.floor((BOTTOM-y-head-32)/(size+10))),chunk=rows.slice(offset,offset+room),height=head+chunk.length*(size+10)+26;box(M,y,CW,height);text(title+(part?'（續）':''),M+16,y+10,CW-32,46,C.mint,750);text(chunk.join('\n'),M+16,y+head,CW-32,size,color);y+=height+16;offset+=chunk.length;part++;if(offset<rows.length)start(title+'（續）');}}
 function heading(title){y+=text(title,M,y,CW,48,C.mint,750)+12;}
 function chart(rows,title,height,{history=false}={}){
  if(y+height>BOTTOM)start(title+'（續）');const top=y;const maMap={};for(const n of [5,10,20,60])maMap[n]=rows.map(b=>m.maSeries[n][m.bars.indexOf(b)]??null);
  const values=rows.flatMap(b=>[b.low,b.high]).concat(Object.values(maMap).flat().filter(finite));const lo=values.length?Math.min(...values):0,hi=values.length?Math.max(...values):1,pad=Math.max((hi-lo)*.1,Math.abs(hi)*.015,.01),min=lo-pad,max=hi+pad;
  const plot={x:180,y:top+184,width:774,height:height-480},volumePlot={x:180,y:plot.y+plot.height+58,width:774,height:94};
  const visible=history&&m.line!==null?[{kind:'LIFE_LINE',price:m.line,label:m.referenceOnly?'歷史生命線':'生命線',color:m.referenceOnly?C.muted:C.mint,role:m.currentRole}]:[...m.support,...m.resistance];
  const unique=[];for(const l of visible)if(!unique.some(v=>v.price===l.price))unique.push(l);
  const tagCapacity=Math.max(2,Math.floor((plot.height+10)/104)),available=unique.filter(l=>l.price>=min&&l.price<=max).sort((a,b)=>(a.kind==='LIFE_LINE'?0:a.role==='RESISTANCE'?1:2)-(b.kind==='LIFE_LINE'?0:b.role==='RESISTANCE'?1:2)||Math.abs(a.price-(rows.at(-1)?.close||0))-Math.abs(b.price-(rows.at(-1)?.close||0)));const anchors=available.slice(0,tagCapacity-1).map(l=>({...l}));if(rows.at(-1))anchors.push({kind:'LATEST_CLOSE',price:rows.at(-1).close,label:history?'區間收盤':'最新收盤',color:C.text});
  const tagX=984,tagW=252,tagH=94;const tags=L.spread(anchors.map(l=>({...l,x:tagX,y:plot.y+(max-l.price)/(max-min)*plot.height-tagH/2,width:tagW,height:tagH,anchorY:plot.y+(max-l.price)/(max-min)*plot.height})),{min:plot.y,max:plot.y+plot.height,gap:10,dimension:'y',extent:'height'});
  const markers=m.four.filter(k=>rows.some(b=>b.date===k.date)).map(k=>({label:k.label,date:k.date,index:rows.findIndex(b=>b.date===k.date)}));
  const missingMA=[5,10,20,60].filter(n=>maMap[n].every(v=>v===null));
  const a={title,barDates:rows.map(b=>b.date),shown:rows.length,min,max,plot,volumePlot,ma:maMap,maColors:MA_COLORS,annotations:{line:anchors.find(a=>a.kind==='LIFE_LINE')||null,tags,markers},historicalMarkersOutside:m.four.length>markers.length,missingMA};
  page.ops.push({kind:'chart',rows,title,top,height,maMap,min,max,plot,volumePlot,tags,markers,missingMA,offscreen:unique.filter(l=>l.price<min||l.price>max),history});page.charts.push(a);y+=height+12;
 }
 start('第 1 頁／個股分析',true);
 const fullName=m.name+'（'+m.code+'）',nameSize=wrap(fullName,850,70,800).length===1?70:64,nameRows=wrap(fullName,850,nameSize,800),name=nameRows.length>2?'個股（'+m.code+'）｜完整名稱見技術頁':fullName;
 const nameHeight=text(name,M,y,850,nameRows.length>2?48:nameSize,C.text,800);text(m.date||'日期待核對',930,y+10,306,38,C.muted);y+=Math.max(92,nameHeight+12);y+=text('收盤 '+money(m.close),M,y,CW,86,C.gold,800)+12;
 const states=[['目前趨勢',m.trend.label,m.trend.explanation,m.trend.state==='STRONG'?C.mint:m.trend.state==='WEAK'?C.risk:C.gold],['生命線狀態',m.life.label,m.life.explanation,m.referenceOnly?C.muted:['SUPPORT_BROKEN','BREAKOUT_FAILED'].includes(m.lifecycleState)?C.risk:C.mint],['追價風險',m.risk.label.replace('追價風險','').replace('追價',''),m.risk.explanation,m.risk.label.includes('較高')?C.risk:m.risk.label.includes('不足')?C.muted:C.gold]];const sw=(CW-24)/3;
 const sh=Math.max(...states.map(s=>38+wrap(s[1],sw-24,46,750).length*56+wrap(s[2],sw-24,42).length*52+20));
 for(const [i,s]of states.entries()){const x=M+i*(sw+12);box(x,y,sw,sh);text(s[0],x+12,y+8,sw-24,32,C.muted);const val=text(s[1],x+12,y+46,sw-24,46,s[3],750);text(s[2],x+12,y+46+val,sw-24,42);}y+=sh+14;
 const priceItems=[['最新收盤',m.close,C.gold],['原始生命線'+(m.referenceOnly?'（歷史）':''),m.line,m.referenceOnly?C.muted:C.mint],['近10日高點',m.range.high,C.gold],['近10日低點',m.range.low,C.gold]],mw=(CW-36)/4;
 const mh=Math.max(...priceItems.map(v=>wrap(v[0],mw,32).length*42+wrap(num(v[1]),mw,56,750).length*66))+12;
 for(const [i,p]of priceItems.entries()){const x=M+i*(mw+12),h=text(p[0],x,y,mw,32,C.muted);text(num(p[1]),x,y+h,mw,56,p[2],750);}y+=mh;
 y+=text('距離生命線 '+(m.distancePct===null?'資料不足':(m.distancePct>=0?'+':'')+num(m.distancePct)+'%')+(m.referenceOnly?'｜只供歷史參考':''),M,y,CW,42,m.referenceOnly?C.muted:C.text)+12;
 const insightLines=m.insights.map(v=>v.label+'｜'+v.text),scenarioLines=m.scenarios.map(s=>s.title+'｜'+s.text);
 const afterHeight=58+insightLines.reduce((n,s)=>n+wrap(s,CW,42).length*52,0)+12+58+wrap(m.conclusion,CW,44).length*54+18+58+scenarioLines.reduce((n,s)=>n+wrap(s,CW-24,42).length*52+12,0);
 chart(m.bars.slice(-30),'日 K 線・均線・支撐壓力',Math.max(790,Math.min(1040,BOTTOM-y-afterHeight-12)));
 if(y+afterHeight>BOTTOM)start('個股分析｜完整觀察（續）');
 heading('現在怎麼看？');for(const i of insightLines)y+=text(i,M,y,CW,42);y+=12;
 heading('目前綜合觀察');y+=text(m.conclusion,M,y,CW,44)+18;
 heading('下一個交易日觀察重點');for(const s of m.scenarios){const h=wrap(s.title+'｜'+s.text,CW-24,42).length*52+12;box(M,y,CW,h,C.card);text(s.title+'｜'+s.text,M+12,y+6,CW-24,42,s.color);y+=h+8;}
 // Teaching is composed as independent pages. Never crop a tall raster into pieces.
 start('第 2 頁／策略說明｜K3 → K2 → K1 → K0');
 const event=m.event;if(event){const startAt=Math.max(0,m.bars.findIndex(b=>b.date===event.k3Date)-2),endAt=m.bars.findIndex(b=>b.date===event.k0Date)+3;chart(m.bars.slice(startAt,Math.min(m.bars.length,endAt)),'歷史生命線怎麼形成？',840,{history:true});}
 else section('生命線尚未成立','沒有可確認的 K0，不能補造四根 K 棒或生命線。');
 section('四根 K 棒各代表什麼？','K3：形成過程的起點，提供原始生命線價位。\nK2、K1：依原規則觀察高低點是否延續。\nK0：等完成日 K 收盤後，才確認型態。');
 if(m.four.length)section('原始日期與價位',m.four.map(k=>k.label+' '+k.date+'｜'+(k.bar?'開 '+num(k.bar.open)+'　高 '+num(k.bar.high)+'\n低 '+num(k.bar.low)+'　收 '+num(k.bar.close)+' 元':'原始 OHLC 資料不足')).join('\n'));
 section('生命線價格來源',!event?'沒有可確認的生命線。':(event.side==='BULL'?'原型態高點依序提高，取 K3 最低價。':'原型態低點依序降低，取 K3 最高價。')+'原始生命線 '+money(m.line)+'。\nK0 收盤不是生命線；這也不是主力真實持股成本。');
 if(event)section('策略說明｜歷史事件時間軸','形成 '+event.signalDate+' → '+money(m.line)+'\n'+m.events.filter(v=>v.confirmedAt).map(v=>v.date+'｜'+(stateNames[v.kind]||'收盤突破')).join('\n')+'\n目前：'+m.life.label+'，不代表已確認轉強。');
 start('第 3 頁／完整技術證據');
 if(m.cost)section('第④套入選資料','研究等級 '+m.cost.grade+'；原分數 '+num(m.cost.score)+'／100。\n'+(m.cost.formalCandidate?'本交易日通過原有正式候選門檻。':'本交易日未通過正式候選門檻。')+'分數不是上漲機率。\n快照 '+m.snapshotId);
 section('現在的狀態與價格','完整股票名稱：'+fullName+'\n完成行情 '+m.date+'；收盤 '+money(m.close)+'。\n生命線 '+money(m.line)+'；目前角色 '+(m.referenceOnly?'以前的重要參考價':m.currentRole==='SUPPORT'?'下方支撐':m.currentRole==='RESISTANCE'?'上方壓力':'資料不足')+'。\n'+m.life.label+'。'+m.conclusion);
 section('多均線｜使用完整歷史收盤',Object.entries(m.ma).map(([n,v])=>'MA'+n+'（'+n+'日平均價） '+money(v)).join('\n')+'\n研究使用 '+m.historyBarCount+' 根；主圖實際顯示 '+m.chartBarCount+' 根。\n均線只使用當時及之前的完成日 K，未滿期不畫假線。');
 section('已確認關卡與近期範圍',[...m.support,...m.resistance].map(p=>p.label+' '+money(p.price)+'｜原日期 '+p.date+'；確認 '+p.confirmedAt).join('\n')+(m.support.length||m.resistance.length?'\n':'尚無可確認支撐或壓力。\n')+'近10日高 '+money(m.range.high)+'；低 '+money(m.range.low)+'，兩者不是保證有效的關卡。\n圖上結構關卡只沿用核心已確認轉折；其後收盤穿越便移出輔助關卡。此展示規則不影響原模型。');
 section('成交量與日期核對',m.volume.verified?'當日 '+num(m.volume.last)+' 股（'+num(m.volume.last/1000)+' 張）。\n前5個完成交易日均量 '+num(m.volume.average5)+' 股。\n量比 '+num(m.volume.ratio)+' 倍；均量不包含當日。':'成交量待核對，暫不作量能確認。\n來源版本、股票、日期或單位尚無法一致確認。');
 section('風險與既有技術指標','RSI5 '+num(m.originalStudy.currentTrend?.rsi5)+'；RSI14 '+num(m.originalStudy.currentTrend?.rsi14)+'，用來觀察上漲是否太急。\nATR14 '+money(m.originalStudy.currentTrend?.atr14)+'，表示近期平均每日波動。\n'+(m.risk.reasons.join('\n')||'風險資料不足。'));
 section('已確認歷史事件',event?'成立 '+event.signalDate+'｜生命線 '+money(m.line)+'\n首次收盤突破 '+(event.firstBreakoutDate||'尚無確認')+'；首次收盤跌破 '+(event.firstBreakdownDate||'尚無確認')+'\n'+m.events.map(x=>x.date+'｜'+(stateNames[x.kind]||({SUPPORT_RECLAIMED_INTRADAY:'盤中測試，非收盤確認',BREAKOUT_ATTEMPT:'盤中突破，收盤未確認',BREAKOUT_CONFIRMED:'首次／再次收盤突破'})[x.kind]||plain(x.kind))+(x.confirmedAt?'（收盤確認）':'（盤中紀錄）')+'；關卡 '+money(x.price)).join('\n')+'\n目前 '+m.life.label+'；歷史事件不代表本交易日才成立新 K0。':'沒有可確認的原始事件。');
 if(event)section('原始事件識別與證據',event.eventId+'\n原始證據：'+(event.originalEvent?.evidence||'見核心原始紀錄')+'\n最後轉換 '+(event.lastTransitionDate||'尚無')+'；'+plain(event.statusReason||'原因未附'));
 const dated=value=>String(value).replaceAll('今天','本交易日').replaceAll('明天','下一個交易日');const teach=display?.teaching||[];for(const item of teach)section(item.title,dated(item.value));
 if(display?.fields?.details)for(const f of display.fields.details)section(dated(f.title),dated(f.value));
 if(record&&display?.costFields)for(const f of display.costFields)section(dated(f.title),dated(f.value));
 section('完整均線資料與原始 OHLC',m.bars.map((b,i)=>b.date+'｜開 '+num(b.open)+' 高 '+num(b.high)+' 低 '+num(b.low)+' 收 '+num(b.close)+'；量 '+b.volume+' 股\nMA5 '+num(m.maSeries[5][i])+'／10 '+num(m.maSeries[10][i])+'／20 '+num(m.maSeries[20][i])+'／60 '+num(m.maSeries[60][i])).join('\n')||'資料不足，沒有可用日 K。');
 section('資料來源與研究限制','行情日期 '+(m.date||'未核對')+'；來源 '+m.source+'。\n價格口徑 '+(m.priceAdjustment?.basis==='UNADJUSTED_OFFICIAL_OHLC'?'交易所未還原成交價格':m.priceAdjustment?.basis||'待核對')+'；除權息事件 '+(m.priceAdjustment?.corporateActionsVerified?'已核對':'尚未完整核對')+'。\n分析引擎 '+(m.analysisVersion||'未提供')+'／'+(m.analysisModel||'未提供')+'；展示 '+VERSION+'。\n績效尚未驗證。研究參考，不是買賣建議；生命線不是主力真實成本，也不是保證安全的買價。');
 const count=plans.length;
 function paint(p,index){if(!portrait?.naturalWidth)throw Error('指定人物原圖尚未載入，請重新開啟圖片');const canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');if(!ctx)throw Error('無法建立生命線圖片');ctx.textBaseline='top';ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
  const drawText=(v,x,top,size=38,color=C.text,weight=650)=>{font(ctx,size,weight);ctx.fillStyle=color;ctx.fillText(v,x,top);};
  for(const o of p.ops){if(o.kind==='portrait'){const scale=Math.min(o.width/portrait.naturalWidth,o.height/portrait.naturalHeight),width=portrait.naturalWidth*scale,height=portrait.naturalHeight*scale;ctx.drawImage(portrait,o.x+(o.width-width)/2,o.y+(o.height-height)/2,width,height);}else if(o.kind==='box'){ctx.fillStyle=o.color;ctx.beginPath();ctx.roundRect(o.x,o.y,o.width,o.height,12);ctx.fill();}else if(o.kind==='text')o.rows.forEach((r,i)=>drawText(r,o.x,o.y+i*(o.size+10),o.size,o.color,o.weight));else if(o.kind==='chart')paintChart(o,ctx,drawText);}
  drawText('研究參考，非買賣建議；生命線不是主力真實成本。',M,2642,34,C.muted);drawText((m.date||'日期待核對')+'｜第 '+(index+1)+'／'+count+' 頁｜'+RELEASE,M,2692,34,C.muted);if(watermark&&globalThis.ShitouReportWatermark)globalThis.ShitouReportWatermark.apply(canvas);return canvas;
 }
 function paintChart(c,ctx,draw){
  draw(c.title,M,c.top,48,C.mint,750);for(const [i,n]of [5,10,20,60].entries()){const value=c.maMap[n].at(-1),x=M+(i%2)*594,top=c.top+66+Math.floor(i/2)*48;draw('MA'+n+'／'+n+'日均價 '+(value===null?'資料不足':num(value)),x,top,38,MA_COLORS[n]);}
  if(!c.rows.length){draw('沒有可用的完成日 K，暫不畫行情。',M,c.top+244,44,C.muted);draw('資料不足，不補造價格、成交量或均線。',M,c.top+310,42,C.muted);return;}
  const p=c.plot,scale=v=>p.y+(c.max-v)/(c.max-c.min)*p.height,step=p.width/Math.max(1,c.rows.length),xAt=i=>p.x+step*(i+.5);
  ctx.strokeStyle=C.grid;ctx.lineWidth=1;for(let i=0;i<4;i++){const v=c.min+(c.max-c.min)*i/3,yy=scale(v);ctx.beginPath();ctx.moveTo(p.x,yy);ctx.lineTo(p.x+p.width,yy);ctx.stroke();font(ctx,34);draw(num(v),p.x-12-ctx.measureText(num(v)).width,yy-20,34,C.muted);}
  ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.width,p.height);ctx.clip();
  for(const n of [5,10,20,60]){ctx.strokeStyle=MA_COLORS[n];ctx.lineWidth=3;ctx.beginPath();let started=false;c.maMap[n].forEach((v,i)=>{if(v===null){started=false;return;}const x=xAt(i),yy=scale(v);if(!started){ctx.moveTo(x,yy);started=true;}else ctx.lineTo(x,yy);});ctx.stroke();}
  for(const [i,b]of c.rows.entries()){const xx=xAt(i),color=b.close>b.open?C.up:b.close<b.open?C.down:C.muted;ctx.strokeStyle=ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(xx,scale(b.high));ctx.lineTo(xx,scale(b.low));ctx.stroke();ctx.fillRect(xx-Math.max(3,step*.28),Math.min(scale(b.open),scale(b.close)),Math.max(6,step*.56),Math.max(3,Math.abs(scale(b.open)-scale(b.close))));}
  for(const t of c.tags.filter(t=>t.kind!=='LATEST_CLOSE')){ctx.strokeStyle=t.color;ctx.lineWidth=3;ctx.setLineDash(t.kind==='LIFE_LINE'?[16,10]:[9,7]);ctx.beginPath();ctx.moveTo(p.x,scale(t.price));ctx.lineTo(p.x+p.width,scale(t.price));ctx.stroke();ctx.setLineDash([]);}ctx.restore();
  for(const t of c.tags){ctx.strokeStyle=t.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+p.width,t.anchorY);ctx.lineTo(t.x-8,t.y+t.height/2);ctx.lineTo(t.x,t.y+t.height/2);ctx.stroke();ctx.fillStyle=C.card;ctx.fillRect(t.x,t.y,t.width,t.height);draw(t.label,t.x+8,t.y+4,36,t.color);draw(num(t.price),t.x+8,t.y+46,42,t.color,750);}
  // K labels occupy a dedicated row below the candles, never the candle bodies or price tags.
  const markerLabels=c.markers.map(k=>({x:xAt(k.index)-25,width:64,...k}));const spread=L.spread(markerLabels,{min:p.x,max:p.x+p.width,gap:8,dimension:'x',extent:'width'});for(const k of spread){ctx.strokeStyle=C.muted;ctx.beginPath();ctx.moveTo(xAt(k.index),p.y+p.height+2);ctx.lineTo(k.x+32,p.y+p.height+9);ctx.stroke();draw(k.label,k.x,p.y+p.height+10,32,C.gold);}
  const vp=c.volumePlot,maxVol=Math.max(1,...c.rows.map(b=>b.volume));for(const [i,b]of c.rows.entries()){ctx.fillStyle=b.close>b.open?C.up:b.close<b.open?C.down:C.muted;const height=b.volume/maxVol*vp.height;ctx.fillRect(xAt(i)-Math.max(3,step*.28),vp.y+vp.height-height,Math.max(6,step*.56),height);}
  const dateY=vp.y+vp.height+10;draw(c.rows[0]?.date||'無可用日 K',p.x,dateY,32,C.muted);if(c.rows.length>1)draw(c.rows.at(-1).date,p.x+p.width-228,dateY,32,C.muted);
  const vy=dateY+44;draw(c.history?'歷史成交量與上方同日；最新量能見第一頁。':!m.volume.verified?'量能資料待核對':'量 '+num(m.volume.last/1000)+' 張　前5日均量 '+num(m.volume.average5/1000)+' 張　量比 '+num(m.volume.ratio),M,vy,38,m.volume.verified?C.text:C.risk);
  draw('圖示 '+c.rows.length+' 根完成日 K'+(c.markers.length<m.four.length?'｜歷史 K3～K0 見第二頁。':''),M,vy+44,34,C.muted);
 }
 return plans.map((p,index)=>{const audit={version:VERSION,release:RELEASE,width:W,height:H,page:index+1,pages:count,title:p.title,model:{...m,bars:undefined,maSeries:undefined,originalStudy:undefined,display:undefined},charts:p.charts,boxes:p.boxes,text:p.ops.filter(o=>o.kind==='text').map(o=>({value:o.rows.join('\n'),x:o.x,y:o.y,width:o.width,height:o.height,size:o.size,weight:o.weight})),portrait:{asset:'assets/shitou-character-original-v972.jpg',x:M,y:34,width:140,height:140,fit:'contain',original:true},researchOnly:true,affectsEligibility:false,affectsRanking:false,performanceValidated:false};const filename='石頭少爺_'+RELEASE+'_'+m.code+'_'+(m.date||'日期待核對').replaceAll('-','')+'_P'+String(index+1).padStart(2,'0')+'_'+(index===0?'個股分析':p.title.includes('策略')?'策略說明':'技術證據')+'.png';const dataset={life94Audit:JSON.stringify(audit),life972Audit:JSON.stringify(audit),fullBleed:'true',shareAsSingleImage:'true',filename};if(record)dataset.costLife97Audit=dataset.life94Audit;
  const render=()=>{const c=paint(p,index);Object.assign(c.dataset,dataset);return c;};return {width:W,height:H,title:p.title,filename,dataset,renderExportRegion:render,toBlob(callback,type='image/png',quality){const c=render();c.toBlob(b=>{c.width=c.height=1;callback(b);},type,quality);}};
 });
}
function textReport(study,options={}){const m=model(study,options);return ['石頭少爺 '+RELEASE+'｜生命線研究',m.name+'（'+m.code+'）｜'+m.date,'收盤 '+money(m.close)+'；原始生命線 '+money(m.line)+'；距離 '+num(m.distancePct)+'%',m.trend.label+'｜'+m.life.label+'｜'+m.risk.label,...m.insights.map(v=>v.label+'：'+v.text),m.conclusion,...m.scenarios.map(v=>v.title+'：'+v.text),'MA5 '+num(m.ma[5])+'；MA10 '+num(m.ma[10])+'；MA20 '+num(m.ma[20])+'；MA60 '+num(m.ma[60]),'事件 '+m.eventId+'；快照 '+(m.snapshotId||'一般個股研究'),...m.risk.reasons,'研究參考，非買賣建議；績效未驗證。'].join('\n');}
return Object.freeze({RELEASE,VERSION,C,MA_COLORS,ready,seriesMA,model,build,textReport});
});
