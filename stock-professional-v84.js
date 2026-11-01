/* Reference professional report. Every value comes from the current stock's existing analysis. */
(function(root){
'use strict';
const W=1284,H=2778,M=26,G=12,I=W-M*2,INK='#233B53',MUTED='#52657C',NAVY='#123E68';
const tone=Object.freeze({green:'#11834A',red:'#C92D45',orange:'#A45700',blue:'#136CC3',purple:'#7045A5'});
const price=v=>Number.isFinite(v)?v.toFixed(2)+' 元':'尚未建立';
const clean=v=>String(v??'資料待確認').replace(/新ABC尚未建立/g,'新一輪ABC待確認');
// Professional image presentation only: trend is NOT ABC eligibility, advice or win probability.
function trendFor(report,stage,st){
 const ma=st?.s?.maCtx||null,close=Number(report?.close);
 const slope=String(ma?.slopeClass?.key||'').toLowerCase();
 const hasData=Number.isFinite(close)&&close>0&&/^20\d{2}-?\d{2}-?\d{2}$/.test(String(report?.closeDate||''))&&
  Number.isFinite(ma?.value)&&ma.value>0&&Number.isFinite(ma?.slope)&&
  typeof ma?.above==='boolean'&&['up','down','flat'].includes(slope);
 const abc=String(st?.nStatus||stage?.sourceState?.nStatus||'').toLowerCase();
 const phase=String(st?.nPhase||stage?.sourceState?.nPhase||'').toUpperCase();
 const wave=String(stage?.sourceState?.waveKey||'').toUpperCase();
 if(!hasData)return Object.freeze({label:'資料不足',detail:'日20MA、斜率或完成交易日未核實；暫不判斷多空。',tone:'neutral',color:MUTED,verified:false,abc,phase,wave});
 const abcNote=abc==='failed'?'原ABC結構失效':abc==='confirmed'?'ABC已確認':abc==='abc_ready'?'ABC待突破':'ABC仍在形成';
 let label,detail,role;
 if(ma.above&&slope==='up'){
  if(wave==='LATE_EXTENSION'){
   label='強勢上行';role='green';detail='股價在上升日20MA上方，但已延伸；留意過熱與追價風險。';
  }else{
   label='偏多';role='green';detail=(wave==='MID_CONSOLIDATION'?'上升趨勢整理，主要支撐仍需守穩。':'股價站在上升日20MA上方，趨勢背景偏強。');
  }
 }else if(!ma.above&&slope==='up'){
  label='拉回整理';role='orange';detail='20日線仍上升，但股價已跌到線下；先看能否重新站回。';
 }else if(ma.above&&slope==='down'){
  label='反彈觀察';role='orange';detail='股價站回日20MA，但均線仍向下；尚未確認正式轉強。';
 }else if(!ma.above&&slope==='down'){
  label='偏空';role='red';detail='股價在下降日20MA下方，趨勢與價格位置均偏弱。';
 }else if(ma.above){
  label='盤整';role='orange';detail='股價在近走平日20MA上方，方向仍需等待量價確認。';
 }else{
  label='弱勢整理';role='red';detail='股價在近走平日20MA下方，先看能否止跌並收復均線。';
 }
 const note=abc==='failed'?'':('｜'+abcNote);
 return Object.freeze({label,detail:detail+note,tone:role,color:tone[role],verified:true,abc,phase,wave,ma20:ma.value,slope:ma.slope,above:ma.above});
}
// Short-term state is a separate, descriptive view of completed daily K bars.
// It never changes ABC, trading gates, stop levels, or the source report.
function shortTermFor(report,medium,st){
 const rows=Array.isArray(report?.dailySeries)?report.dailySeries:[];
 const last=rows[rows.length-1],prev=rows[rows.length-2];
 const date=v=>String(v||'').replaceAll('/','-').slice(0,10);
 const validPrice=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
 const close=report?.close;
 const verified=rows.length>=6&&validPrice(close)&&validPrice(last?.close)&&validPrice(prev?.close)&&
  date(last?.date)===date(report?.closeDate)&&Math.abs(last.close-close)<=Math.max(.02,close*.0001)&&
  rows.slice(-6).every(r=>validPrice(r?.close)&&/^\d{4}-\d{2}-\d{2}$/.test(date(r?.date)));
 if(!verified)return Object.freeze({label:'短線資料不足',tone:'neutral',color:MUTED,verified:false,
  detail:'缺少一致的最近6根完成日K，無法核驗5MA與單日變化。',ma5:null,changePct:null});
 const ma5=rows.slice(-5).reduce((sum,r)=>sum+r.close,0)/5;
 const prevMa5=rows.slice(-6,-1).reduce((sum,r)=>sum+r.close,0)/5;
 const changePct=(close/prev.close-1)*100,above5=close>=ma5;
 const vol=last?.volume,prevVol=prev?.volume;
 const volumeChangePct=validPrice(vol)&&validPrice(prevVol)?(vol/prevVol-1)*100:null;
 const nStatus=String(st?.nStatus||'').toLowerCase(),nPhase=String(st?.nPhase||'').toUpperCase();
 const failure=nStatus==='failed'||nPhase==='FAILED';
 let label,role,detail;
 if(failure){label='結構受損';role='red';detail='ABC/N字原結構失效，先核對防守與新結構。';}
 else if(changePct<=-5&&!above5){label='急跌轉弱';role='red';detail='單日明顯下跌且跌破5MA，短線先觀察止跌。';}
 else if(changePct<=-5){label='急跌警戒';role='red';detail='單日明顯下跌，即使仍在5MA上方也應提高警戒。';}
 else if(!above5&&changePct<0){label='短線轉弱';role='red';detail='收盤跌破5MA且當日續跌，短線動能偏弱。';}
 else if(!above5&&changePct>0){label='反彈觀察';role='orange';detail='當日反彈但尚未站回5MA，不視為正式轉強。';}
 else if(!above5){label='弱勢整理';role='orange';detail='收盤仍在5MA下方，等待重新站回確認。';}
 else if(changePct>0&&ma5>=prevMa5){label=volumeChangePct!==null&&volumeChangePct>=50?'放量續強':'短線續強';role='green';detail='收盤在5MA上方，且當日上漲、5MA未轉降。';}
 else if(changePct<0){label='回檔觀察';role='orange';detail='當日拉回，但收盤仍守在5MA上方。';}
 else{label='整理觀察';role='orange';detail='短線未形成持續推進的確認證據。';}
 return Object.freeze({label,detail,tone:role,color:tone[role],verified:true,ma5,prevMa5,above5,changePct,volumeChangePct,nStatus,nPhase,mediumLabel:medium?.label||'資料不足'});
}
function trendSummary(medium,short){
 if(!medium.verified&&!short.verified)return '中期與短線資料不足，暫不作出方向結論。';
 const mid=medium.verified?'20MA '+Number(medium.ma20).toFixed(2)+(medium.above?' 上方':' 下方'):'20MA待核驗';
 const shortText=short.verified?'日'+(short.changePct>=0?'漲':'跌')+Math.abs(short.changePct).toFixed(2)+'%，'+(short.above5?'站上':'跌破')+'5MA '+short.ma5.toFixed(2):'短線日K／5MA待核驗';
 const volume=short.verified&&short.volumeChangePct!==null?'｜日量較前日'+(short.volumeChangePct>=0?'增':'減')+Math.abs(short.volumeChangePct).toFixed(0)+'%':'';
 return '中期：'+mid+'｜短線：'+shortText+volume+'；到價仍須核對交易條件。';
}
// Display-only caution for strong daily bars: distinguish verified evidence
// from price momentum; neither RSI nor breakout completion changes trading gates.
function professionalMomentumCaution(report,st,short,gate,rsi10Derived=null){
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const rsi5=finite(report?.dailyRsi5)?report.dailyRsi5:finite(report?.dailyRsi)?report.dailyRsi:null;
 const rsi10=finite(report?.dailyRsi10)?report.dailyRsi10:rsi10Derived;
 const verified10=finite(rsi10)&&rsi10>=0&&rsi10<=100?rsi10:null;
 const rising=short?.verified===true&&['短線續強','放量續強'].includes(short.label);
 const heat=(finite(rsi5)&&rsi5>=75)||(verified10!==null&&verified10>=70);
 const B=finite(st?.B)&&st.B>0?st.B:null;
 const actualBreakout=rising&&B!==null&&finite(report?.close)&&report.close>B&&st?.nStatus==='confirmed';
 const status=gate?.applicable&&actualBreakout?String(gate.threeStatus||'pending').toLowerCase():'unverified';
 const pending=actualBreakout&&status!=='passed';
 const active=rising&&(heat||pending);
 if(!active)return Object.freeze({active:false,heat,pending,RSI5:rsi5,RSI10:verified10,B,threeStatus:status,detail:''});
 const rsiParts=[];
 if(finite(rsi5))rsiParts.push('RSI5 '+rsi5.toFixed(2));
 if(verified10!==null)rsiParts.push('RSI10'+(finite(report?.dailyRsi10)?' ':'(日K) ')+verified10.toFixed(2));
 const rsiText=rsiParts.length?rsiParts.join('／'):'RSI資料待核驗';
 let bText='B點尚未核實';
 if(B!==null){
  if(actualBreakout&&status==='passed')bText='B '+B.toFixed(2)+' 三日站穩已驗證';
  else if(actualBreakout&&status==='pending')bText='B '+B.toFixed(2)+' 三日站穩待確認';
  else if(actualBreakout&&status==='failed')bText='B '+B.toFixed(2)+' 三日確認未通過';
  else bText='B '+B.toFixed(2)+' 突破資格待核驗';
 }
 const label=heat?'⚠ 短線偏熱，勿急追價':'⚠ B突破仍待確認，勿急追價';
 const detail=label+'｜'+rsiText+'；'+bText+'。空手先等站穩及風險條件。';
 return Object.freeze({active:true,heat,pending,label,detail,RSI5:rsi5,RSI10:verified10,B,threeStatus:status});
}
function professionalRsi10(report){
 const r=report?.dailyRsi10;
 if(typeof r==='number'&&Number.isFinite(r)&&r>=0&&r<=100)return r;
 const bars=Array.isArray(report?.dailySeries)?report.dailySeries:null;
 if(!bars||bars.length<50||bars[bars.length-1]?.date!==report?.closeDate||
    typeof globalThis.wilderRsiSeriesV3750!=='function')return null;
 const value=globalThis.wilderRsiSeriesV3750(bars,10).at(-1);
 return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null;
}
function render(report){
 if(!report?.code&&!report?.stock)throw Error('請先完成個股查詢');
 const st=root.stockInfographicStateV3328(report),layer=root.buildEducationLayerV46(report),L=layer.supportResistanceConfluence;
 const source=root.ShitouReportLayoutV563.captureProfessional(()=>renderStockProfessionalBaseV51(report));
 const captured=JSON.parse(decodeURIComponent(source.dataset.professionalLayoutContent||'%7B%7D'));
 const stage=root.stockStageDisplayAdapterV53245(report),trend=trendFor(report,stage,st),shortTrend=shortTermFor(report,trend,st),risk=layer.decisionRiskState,exit=layer.exitManagementState;
 const strictGate=typeof root.strictBreakoutEvidenceGateV370==='function'?root.strictBreakoutEvidenceGateV370(report,st.s):null;
 const momentumCaution=professionalMomentumCaution(report,st,shortTrend,strictGate,professionalRsi10(report));
 const c=root.document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),sections=[],texts=[];

 const font=(size,bold=true)=>{x.font=`${bold?800:600} ${size}px "Microsoft JhengHei","Noto Sans TC","Segoe UI Emoji",sans-serif`;x.textBaseline='top';x.textAlign='left';};
 function wrap(value,width,size,bold=true){font(size,bold);const lines=[];for(const p of clean(value).split('\n')){let line='';for(const ch of [...p]){if(line&&x.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}lines.push(line);}return lines;}
 function text(value,px,py,w,h,{size=25,min=17,color=INK,bold=true,line=1.3}={}){
  let rows,n=size;for(;n>=min;n--){rows=wrap(value,w,n,bold);if(rows.length*n*line<=h)break;}
  if(n<min)throw Error('專業報告文字超出安全範圍：'+clean(value).slice(0,35));
  font(n,bold);x.fillStyle=color;rows.forEach((r,i)=>x.fillText(r,px,py+i*n*line));texts.push(clean(value));
 }
 function panel(px,py,w,h,fill='#fff',border='#cfdeeb'){x.beginPath();x.roundRect(px,py,w,h,12);x.fillStyle=fill;x.fill();x.strokeStyle=border;x.lineWidth=1.5;x.stroke();}
 function section(id,y,h){sections.push({id,top:y,bottom:y+h});}
 x.fillStyle='#F4F9FD';x.fillRect(0,0,W,H);
 const gradient=x.createLinearGradient(0,0,W,142);gradient.addColorStop(0,'#123E68');gradient.addColorStop(1,'#0B2B4A');x.fillStyle=gradient;x.fillRect(0,0,W,142);
 text(`${report.name||'股票'}（${report.code||report.stock}）`,M,20,630,66,{size:58,min:26,color:'#fff'});
 text('現價 '+price(st.close),665,32,335,50,{size:38,min:23,color:'#FF879B'});
 panel(1012,15,246,112,'#123b60','#6789a7');text('報告製作 By.石頭少爺',1024,25,222,27,{size:21,min:16,color:'#fff'});
 text(root.reportGeneratedAt().replace('（台灣時間）',''),1024,60,222,28,{size:18,min:14,color:'#e0edf9'});
 text('V8.4｜個股專業分析',1024,98,222,20,{size:15,min:13,color:'#b5cce2'});
 text(`${root.marketNameZh(report.market)}｜最新交易日 ${report.closeDate||'待確認'}｜資料來源：${root.sourceNameZh(report.source)}`,M,105,970,29,{size:21,min:16,color:'#fff'});section('header',0,142);
 panel(M,158,I,149,'#F4F9FD','#CEDDEB');x.fillStyle=trend.color;x.fillRect(M,169,6,125);
 text('📈 行情雙層判讀｜趨勢不等於進場許可',M+23,168,I-46,30,{size:26,min:21,color:NAVY});
 const split=M+I/2;
 x.strokeStyle='#CEDDEB';x.lineWidth=2;x.beginPath();x.moveTo(split,202);x.lineTo(split,264);x.stroke();
 text('中期趨勢（20MA）',M+23,204,I/2-47,26,{size:20,min:17,color:MUTED});
 text(trend.label,M+23,228,I/2-47,40,{size:36,min:26,color:trend.color});
 text('短線狀態（5MA／日K）',split+18,204,I/2-52,26,{size:20,min:17,color:MUTED});
 text(shortTrend.label,split+18,228,I/2-52,40,{size:36,min:26,color:shortTrend.color});
 if(momentumCaution.active){
  panel(M+15,268,I-30,36,'#FFF8ED','#EDCC9A');
  text(momentumCaution.detail,M+23,272,I-46,30,{size:17,min:12,color:tone.orange,line:1.05});
 }else{
  text(trendSummary(trend,shortTrend),M+23,271,I-46,34,{size:19,min:13,color:INK,line:1.06});
 }
 section('stage',158,149);
 const half=(I-G)/2,audienceY=324,audienceH=212;
 for(const [i,title,action,body,color] of [
  [0,'👤 我現在沒有持股',root.v46ImageHeadline(risk),root.v46ActionFlowV511(report,layer).ifPass,risk.tone==='red'?tone.red:tone.orange],
  [1,'💼 我已經有持股',root.v46HolderActionCopy(exit),`${exit.label} 核心防守：${price(L.coreDefense)}。`,exit.tone==='green'?tone.green:tone.red]
 ]){const px=M+i*(half+G);panel(px,audienceY,half,audienceH,i?'#fff5f6':'#fffaf0',i?'#e8b5bf':'#edcc9a');text(title,px+18,audienceY+15,half-36,40,{size:34,min:25,color:i?'#912c3c':INK});text(action,px+18,audienceY+62,half-36,65,{size:29,min:21,color});text(body,px+18,audienceY+132,half-36,70,{size:23,min:17});}section('audiences',324,212);
 text('📍 今日關鍵價位｜價格地圖',M,552,I,43,{size:35,min:26,color:NAVY});
 const levels=[
  ['🔴 現價',price(L.close),'最近完整交易日收盤',tone.red],['👀 空手觀察線／B點',price(L.observation),'到價後才重新檢查',tone.blue],
  ['⚡ 積極型試單觸發',price(L.probe),L.probe===null?'目前不啟用積極試單':'仍須通過量價與風險條件',tone.orange],['✅ '+(L.confirmationLabel||'保守型確認門檻'),price(L.confirmation),'完整日K站穩後，再檢查位置、量價與資金',tone.green],
  ['🟢 第一支撐',root.v46RangeText(L.supportLow,L.supportHigh),'先看能否止穩',tone.green],['🛡 核心防守',price(L.coreDefense),'跌破後看多理由變差',tone.red],
  ['🎯 風險界線 C／A',root.v46RiskBoundaryText(L),'C為計畫失效；A為ABC最終失效',tone.red],['🧱 '+(L.firstResistanceLabel||'最近上方關卡'),price(L.firstResistance),L.firstResistanceRole==='CANDIDATE'?'候選壓力，仍待確認':'觀察這一關能否站穩',tone.purple],
  ['🎯 '+(L.nextTargetRole?.startsWith('LONG')?'長線目標參考':L.nextTargetLabel||'波段延伸目標'),price(L.nextTarget),L.nextTargetRole?.startsWith('LONG')?'長線參考，不是目前ABC目標或最近壓力':'較後方參考，不保證到達',tone.purple],['📘 20日均線',price(L.ma20),'趨勢防守／後續平均成本參考',tone.blue]
 ];
 levels.forEach(([title,value,note,color],i)=>{const px=M+(i%2)*(half+G),py=604+Math.floor(i/2)*96;panel(px,py,half,88);x.fillStyle=color;x.fillRect(px,py+7,5,74);text(title,px+18,py+11,half*.53,33,{size:25,min:19});text(note,px+18,py+48,half*.53,36,{size:17,min:13,line:1.15,color:MUTED,bold:false});text(value,px+half*.57,py+28,half*.40,47,{size:34,min:20,color});});section('key-levels',552,524);
 const abcY=1094,abcH=520,abcW=450,chartX=M+abcW+G,chartW=I-abcW-G;
 panel(M,abcY,abcW,abcH);text('📖 ABC 是這套分析的核心',M+16,abcY+14,abcW-32,42,{size:29,min:23,color:NAVY});
 text('把股價的轉折分成三個角色，依序核對結構與轉折條件。',M+16,abcY+64,abcW-32,66,{size:23,min:19,bold:false});
 [['A（起漲點）','山頭起漲第一站，這一波的起點',tone.green],['B（前波高點）','前高壓力區，確認突破的機會',tone.orange],['C（回檔低點）','回檔確認，不破才保留結構',tone.blue]].forEach(([title,note,color],i)=>{text(title,M+18,abcY+144+i*70,abcW-36,30,{size:26,color});text(note,M+18,abcY+179+i*70,abcW-36,31,{size:20,min:17,bold:false});});
 [['A',st.A,st.s.fib.ADate,tone.green],['B',st.B,st.s.fib.BDate,tone.orange],['C',st.C,st.s.fib.CDate,tone.blue]].forEach(([label,value,date,color],i)=>{const py=abcY+362+i*39;panel(M+14,py,abcW-28,36,'#f8fbff');text(label,M+23,py+5,34,29,{size:28,color});text(price(value),M+70,py+7,210,27,{size:23,min:18,color});text(date||'待確認',M+284,py+10,142,24,{size:17,min:14,color:MUTED});});
 text(root.stockInfographicProgressV3329(st),M+16,abcY+485,abcW-32,29,{size:19,min:15});
 // The original chart is a verified rendering of this stock's OHLCV and ABC labels.
 const scale=source.width/1600;x.drawImage(source,560*scale,794*scale,1016*scale,520*scale,chartX,abcY,chartW,abcH);
 section('abc-chart',abcY,abcH);
 const bcY=1630,bcH=446;panel(M,bcY,half,bcH);panel(M+half+G,bcY,half,bcH);
 text('B. 明天三種走法｜看到什麼就怎麼做',M+16,bcY+14,half-32,42,{size:29,min:22,color:NAVY});
 const scenarios=captured.scenarios?.length===3?captured.scenarios:[`續強：等完整日K站穩 ${price(L.observation)}，再檢查量價與風險。`,`整理：觀察 ${price(L.ma20)} 與支撐，未確認前先等。`,`轉弱：若跌破 ${price(L.coreDefense)}，依原防守計畫管理。`];
 scenarios.forEach((body,i)=>{const py=bcY+67+i*121,color=[tone.green,tone.orange,tone.red][i];panel(M+14,py,half-28,112,['#f0faf4','#fff8ed','#fff3f5'][i]);text(['✅ 怎樣才算轉強','▶ 如果繼續整理','✕ 哪裡跌破要退出'][i],M+28,py+9,half-56,31,{size:26,min:21,color});text(body,M+28,py+43,half-56,63,{size:21,min:16});});
 const cx=M+half+G;text('C. 詳細判斷依據｜想知道原因再看',cx+16,bcY+14,half-32,42,{size:29,min:22,color:NAVY});
 text([...(captured.bullets||[]),...(captured.next||[])].map(v=>'• '+v).join('\n')||layer.evidenceEngine?.summary||'資料待核驗，先確認完成日K與行情來源。',cx+18,bcY+66,half-36,bcH-82,{size:23,min:17});section('scenarios-evidence',bcY,bcH);
 const dY=2093;text('D. 七項條件分｜盤前分數只供觀察，不代表現在可以執行',M,dY,I,42,{size:30,min:24,color:NAVY});
 const metrics=captured.metrics||[],metricW=(I-4*G)/5;
 metrics.forEach((m,i)=>{const col=i<5?i:i-5,row=i<5?0:1,px=M+col*(metricW+G),py=dY+50+row*99;panel(px,py,metricW,91);x.fillStyle=tone[m.tone]||tone.blue;x.fillRect(px,py+8,4,75);text(m.title,px+12,py+7,metricW-24,32,{size:18,min:12,color:INK,line:1.1});const label=/目前不可執行|不適合執行/.test(m.value)?'目前不可執行':/分數可觀察/.test(m.value)?'分數可觀察':m.value;text(label,px+12,py+40,metricW-24,28,{size:21,min:12,line:1.1});const score=String(m.sub).match(/(?:條件分|背景條件分)?\s*\d+\s*[／/]\s*100/);text(score?.[0]||'依原條件核對',px+12,py+71,metricW-24,17,{size:14,min:10,color:MUTED,bold:false,line:1.1});});
 text('條件分不是勝率；行情、量能或資格未核驗時，保留原本的等待與風險提示。',M+2* (metricW+G),dY+161,I-2*(metricW+G),71,{size:22,min:18,color:MUTED});section('condition-scores',dY,240);
 const efY=2350,efH=294,ew=386,fx=M+ew+G,fw=I-ew-G;panel(M,efY,ew,efH);panel(fx,efY,fw,efH);
 text('E. 進階完整價位｜需要時再看',M+14,efY+12,ew-28,35,{size:25,min:19,color:NAVY});
 const maps=captured.map||[],rows=maps.length||1,rowH=Math.min(24,238/rows);
 maps.forEach((m,i)=>{text(m.value,M+14,efY+52+i*rowH,145,rowH,{size:17,min:12,color:m.color||INK});text(m.label.split(/[｜|]/)[0],M+166,efY+52+i*rowH,ew-180,rowH,{size:16,min:11});});
 text('F. 歷史支撐壓力 × ABC × 三叉戟',fx+14,efY+12,fw-28,37,{size:27,min:22,color:NAVY});
 const snr=layer.snrConfluenceEvidence,confluences=[snr?.supportConfluence,snr?.resistanceConfluence],small=(fw-40)/2;
 confluences.forEach((v,i)=>{const px=fx+14+i*(small+12);panel(px,efY+57,small,79,i?'#f6f1fc':'#eefaf0');text((i?'壓力 ':'支撐 ')+root.snrRangeTextV532(v)+'｜'+(v?.label||'待確認'),px+10,efY+67,small-20,31,{size:19,min:15,color:i?tone.purple:tone.green});text(root.snrDistanceTextV532(v),px+10,efY+103,small-20,26,{size:16,min:13,color:MUTED});});
 panel(fx+14,efY+148,small,132,'#f8fbff');text('☁ 記住口訣：',fx+24,efY+160,small-20,30,{size:25,min:20});text('A 起漲 → B 前高\nC 回檔 → 再突破 B\n＝完整 N 字確認',fx+24,efY+195,small-20,77,{size:23,min:18});
 panel(fx+26+small,efY+148,small,132,'#fff9ef');text('📍 現在位置／下一步',fx+36+small,efY+160,small-20,30,{size:23,min:18,color:tone.orange});text(`現價：${price(L.close)}\n20日線 ${price(L.ma20)}\n下一步：確認 ${price(L.observation)}`,fx+36+small,efY+196,small-20,75,{size:21,min:16});section('advanced-confluence',efY,efH);
 const footY=2656;x.fillStyle='#123b67';x.fillRect(M,footY,I,31);text('少爺助理｜公司、法人、主要成交價區',M+10,footY+4,I-20,26,{size:21,min:18,color:'#fff'});
 const assistant=report.shitoAssistantEvidence,poc=assistant?.anchoredVolumeProfileEvidence,third=(I-2*G)/3;
 const status=e=>({pass:'通過',fail:'未通過',unavailable:'資料不足',caution:'待觀察'})[e?.status]||e?.label||'資料待確認';
 [['公司營運',status(assistant?.operatingGateEvidence)],['法人買盤',status(assistant?.capitalGateEvidence)],['主要成交密集區（估算）',poc?.status==='pass'?`${poc.pocLower?.toFixed(2)}～${poc.pocUpper?.toFixed(2)} 元`:'資料待確認']].forEach(([title,value],i)=>{const px=M+i*(third+G);panel(px,footY+38,third,60);text(title,px+12,footY+44,third-24,24,{size:18,min:15});text(value,px+12,footY+70,third-24,22,{size:19,min:15,color:i===2?tone.blue:tone.orange});});
 text('V8.4｜盤後完成日K研究；條件分不是勝率，到價仍須確認，交易風險自負。',M,H-20,I,18,{size:14,min:12,color:MUTED,bold:false});section('assistant-footer',footY,H-footY);
 c.dataset.reportMode='professional';c.dataset.unifiedReport='true';c.dataset.iphoneFullScreen='1284x2778';c.dataset.fullBleed='true';c.dataset.reportText=encodeURIComponent(JSON.stringify(texts));
 c.dataset.layoutAudit=encodeURIComponent(JSON.stringify({version:'V8.4',template:'USER_REFERENCE_PROFESSIONAL',code:report.code||report.stock,date:report.closeDate,width:W,height:H,noOverlap:sections.every((s,i)=>!i||s.top>=sections[i-1].bottom),sections,metricCount:metrics.length,levelCount:levels.length,abc:{A:st.A,B:st.B,C:st.C},close:L.close,trend,shortTrend,momentumCaution,referenceLayout:true}));
 return c;
}
root.ShitouProfessionalV84=Object.freeze({render,trendFor,shortTermFor,trendSummary,professionalMomentumCaution,professionalRsi10,tone});root.renderStockProfessionalInfographicV51=render;
})(globalThis);
