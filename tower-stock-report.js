(function(root){'use strict';
const I=root.ShitouTowerIntegration,R=root.ShitouTowerReport,U=root.ShitouThreePanUI,C=root.ShitouTowerCore,B=root.ShitouTowerBeginner;
if(!I||!R||!U||!C||!B){console.error('寶塔線獨立報告相依模組未載入');return;}
const WIDTH=1284,HEIGHT=2778,RELEASE=root.ShitouReleaseV50.code;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,n=2)=>v===null||v===undefined||!Number.isFinite(Number(v))?'不足':Number(v).toFixed(n);
const color=s=>s==='RED'?'紅線':s==='BLACK'?'黑線':'資料不足';
const flip=s=>s==='BLACK_TO_RED'?'今日黑翻紅':s==='RED_TO_BLACK'?'今日紅翻黑':'今日無新翻轉';
const status=s=>({FORMAL_CANDIDATE:'符合原模型候選條件',CONDITIONAL_WATCH:'條件觀察',NO_CHASE:'追價風險偏高',REJECT:'未通過候選條件',DATA_UNAVAILABLE:'資料不足，暫停判讀'}[s]||s);
const monthly=s=>({PASS:'原月線關卡通過',UNCONFIRMED:'起始月尚未確認',NOT_PASS:'原月線關卡未通過',UNAVAILABLE:'月線資料不足'}[s]||s);
let active=null,queryPending=false;
const current=()=>typeof lastReportData!=='undefined'?lastReportData:null;
const raw=input=>input?.report||input||{};
function get(input){return I.get(input);}
function textFrom(a,input){
 const t=a.tower,f=a.risk.features||{},l=a.risk.levels||{},s=t.states[3]||{},g=B.guide(a);
 return [
  '【寶塔線個股分析｜新手白話版】',`${a.name||raw(input).name||'個股'}（${a.code||'-'}）｜資料日 ${a.date||'不足'}`,
  `${t.completed?'完成收盤':'未確認行情參考價'} ${g.price}｜${t.completed?'盤後已確認':'收盤狀態未確認'}`,
  '', '【1. 先看結論｜強不強、能不能追】',
  `${g.category}｜${status(a.status)}｜追價風險：${g.chaseRisk}`,
  g.intro,`現在能追嗎？${g.buy}`,
  `【為什麼現在不能只看翻紅就追？】${g.explainNoChase}`, 
  `研究品質 ${a.quality?.value??'不足'}/100（模型條件評分，絕非隔日上漲機率）。`,
  '', '【2. 寶塔紅黑｜今天到底發生什麼】',
  `T3 ${g.color3}｜T5 ${g.color5}｜T3連紅 ${s.redDays??'不足'} 根`,
  g.todayFlip,
  `今天以前3根的高低：上 ${g.pastHigh}／下 ${g.pastLow}。`,
  `最近翻紅日 ${s.lastRedDate||'未確認'}｜最近翻黑日 ${s.lastBlackDate||'未確認'}。`,
  '', '【3. 價格與量能｜是真的比較強嗎】',
  g.volume, g.rsi,
  `日MA20 ${num(f.ma20)}（20日平均成本參考）｜日MA60 ${num(f.ma60)}（較長方向參考）`,
  `距日MA20 ${num(f.gap20Pct,1)}%｜${monthly(a.monthly.status)}，月MA20 ${num(a.monthly.ma20)}。`,
  '', '【4. 追高風險｜看懂「很強卻不一定能買」】',
  `${g.modelHeat}；另外提醒：${g.heat}`,
  `假突破／衰竭／資料風險：${a.risk.groups?.length?a.risk.groups.map(v=>v.detail).join('；'):'本模型未列警示，不能解讀成零風險。'}`,
  g.outlook,
  '', '【5. 價位階梯｜每個數字有不同用途】',
  `今天 T3 翻色所用的「前3日」上緣 ${g.pastHigh}／下緣 ${g.pastLow}（是歷史判讀，不是明天進場價）。`,
  `當日低點 ${g.dayLow}（短線第一觀察點；跌破不等於寶塔已翻黑）。`,
  `第一道上方壓力 ${g.resistance1}。來源：${g.resistance1Source}。`,
  `第二道較高的轉折壓力 ${g.resistance2}。來源：${g.resistance2Source}。`,
  `歷史低點候選 ${g.support}。來源：${g.supportSource}。`,
  g.nextThreshold,
  '注意：T3上緣達標，不等於突破第一道歷史壓力，更不等於跨過更高的前波高點。這裡的數字都由個股資料動態帶入；關卡與個人停損不可畫等號。',
  '', '【6. 明天三種走法｜只講條件，不猜一定漲跌】',g.up,g.sideways,g.down,
  '', '【7. 空手者下一步】',g.empty,
  '', '【8. 已持有下一步】',g.holder,
  '', '【9. 資料來源／限制】',
  `日K完整狀態：${t.completed?'已確認':'未確認'}｜資料有效：${t.ok?'是':'否'}`,
  `日K來源 ${t.source||'資料不足'}｜價格調整 ${t.basis||'未知'}｜${t.warnings?.join('、')||'無額外註記'}`,
  `原模型風險與候選資格未修改。月20MA、T3/T5 與研究分數仍由原核心計算。`,g.limitation,
  '', '【10. 最後一句白話口訣】',
  '寶塔翻紅代表值得觀察，不代表隔天開盤值得追；守住支撐再看量價，跌破防線要重評。',
  `版本 ${RELEASE}｜${C.MODEL}`
 ].join('\n');
}
function text(input){return textFrom(get(input),input);}
function chart(ctx,t,T,x,y,w,h){
 const history=t.states[T]?.history?.filter(r=>r.color!=='UNKNOWN').slice(-60)||[],fit=U.fit;
 if(!history.length){fit(ctx,'有效寶塔歷史不足，暫停繪圖',x+20,y+50,w-40,h-70,32,26);return;}
 const low=Math.min(...history.map(r=>r.bodyLow)),high=Math.max(...history.map(r=>r.bodyHigh)),margin=(high-low)*.1||Math.max(high*.01,1),lo=low-margin,hi=high+margin;
 const px=x+100,py=y+12,pw=w-120,ph=h-62,step=pw/history.length,Y=v=>py+(hi-v)/(hi-lo)*ph;
 for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3,yy=Y(v);ctx.strokeStyle='#dce5ef';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,yy);ctx.lineTo(px+pw,yy);ctx.stroke();fit(ctx,num(v),x+4,Math.max(py,Math.min(py+ph-25,yy-13)),88,32,23,18,'#3d536b');}
 history.forEach((r,i)=>{const xx=px+(i+.5)*step,top=Y(r.bodyHigh),bottom=Y(r.bodyLow);ctx.fillStyle=r.color==='RED'?'#b52b46':'#25364a';ctx.fillRect(xx-step*.34,top,Math.max(2,step*.68),Math.max(3,bottom-top));if(r.flip){ctx.beginPath();ctx.arc(xx,py+ph+11,4,0,Math.PI*2);ctx.fill();}});
 fit(ctx,`${history[0].date} — ${history.at(-1).date}｜圓點為已確認翻轉`,px,py+ph+23,pw,32,23,20,'#3d536b');
}
function renderAnalysis(a,input){
 const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
 const ctx=canvas.getContext('2d'),M=36,W=1212,sections=[],fit=U.fit,r=raw(input),t=a.tower,s=t.states[3]||{},f=a.risk.features||{},l=a.risk.levels||{},g=B.guide(a);
 ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,WIDTH,HEIGHT);
 const mark=(id,top,bottom)=>sections.push({id,top,bottom});
 const card=(id,y,h,title,body,tone='blue',opts={})=>{U.box(ctx,M,y,W,h,title,body,tone,{size:30,min:26,titleSize:33,titleH:44,pad:20,...opts});mark(id,y,y+h);};
 ctx.fillStyle='#15344e';ctx.fillRect(0,0,WIDTH,184);
 fit(ctx,`${a.name||r.name||'個股'}（${a.code||'-'}）`,M,24,W,70,47,30,'#fff',900);
 fit(ctx,`寶塔線個股分析｜專業版｜${a.date||'資料不足'}`,M,103,W,38,29,25,'#d9e7f1');
 fit(ctx,`${t.completed?'有效收盤':'未確認行情參考價'} ${num(t.bars?.at(-1)?.close)}｜${t.completed?'盤後已確認':'盤後未確認'}`,M,143,W,34,25,22,'#d9e7f1');mark('header',0,184);
 card('verdict',200,204,`${g.category}｜追價風險 ${g.chaseRisk}`,[
  `${g.intro}`,
  `買點怎麼看？${g.buy}`,
  `T3 ${g.color3}｜T5 ${g.color5}｜研究品質 ${a.quality?.value??'不足'}/100（非勝率）`
 ],g.heatFlag||a.status==='NO_CHASE'?'yellow':a.status==='FORMAL_CANDIDATE'?'green':'yellow',{size:27,min:23,titleSize:31,titleH:42,pad:13});
 for(const [T,y,h] of [[3,420,378],[5,814,314]]){
  card('chart-'+T,y,h,`T=${T} 寶塔線｜${color(t.states[T]?.color)}`,[], 'blue');
  chart(ctx,t,T,M+20,y+70,W-40,h-114);
  fit(ctx,'單色柱＝前日收盤 → 今日收盤｜紅線／黑線由原核心判定',M+20,y+h-38,W-40,32,25,22,'#3d536b');
 }
 card('turns',1144,152,'今天寶塔發生什麼事？',[g.todayFlip,
  `T3 連紅 ${s.redDays??'不足'} 根｜T3／T5 ${t.ok?(a.trend.directionConflict?'不同方向':'同方向'):'資料不足'}`
 ],'blue',{size:27,min:23,titleH:38,pad:12});
 card('confirmation',1312,178,'量價與均線確認',[
  `日MA20 ${num(f.ma20)}｜日MA60 ${num(f.ma60)}｜RSI5 ${num(f.rsi5,1)}`,
  `20日量比 ${num(f.volumeRatio20)}｜收盤位置 ${f.clv==null?'不足':num(f.clv*100,1)+'%'}`,
  `日MA20乖離 ${num(f.gap20Pct,1)}%｜月20MA ${num(a.monthly.ma20)}`
 ],'blue',{size:30,min:25,pad:12});
 const risk=key=>a.risk.families?.[key]?({HIGH:'高風險',MEDIUM:'需留意',LOW:'觀察'}[a.risk.families[key].severity]):a.risk.ok?'未見本模型警示':'資料不足';
 card('risk',1506,254,'為什麼不能直接追？｜模型與新手提醒',[ 
  `${g.modelHeat}；追價風險 ${g.chaseRisk}`,
  `注意：${g.heat}`,
  `假突破 ${risk('BREAKOUT')}｜衰竭 ${risk('EXHAUSTION')}`,
  `趨勢很強也可能買太貴；先等收盤與量能確認。`
 ],g.heatFlag||a.status==='NO_CHASE'?'yellow':'blue',{size:27,min:22,titleSize:32,titleH:42,pad:13});
 card('actions',1776,208,'下一步｜沒買與已持有分開看',[
  g.empty,g.holder
 ],'blue',{size:29,min:24,pad:15});
 card('scenarios',2000,308,'下一交易日｜三種可能的走法',[
  g.up,g.sideways,g.down
 ],'blue',{size:29,min:24,pad:14});
 card('levels',2324,212,'價位階梯｜來源與用途分開',[
  `今天 T3 上 ${g.pastHigh}／下 ${g.pastLow}；明日上 ${g.nextHigh}／下 ${g.nextLow}`,
  `第一壓力 ${g.resistance1}（前60根單日高點）｜第二 ${g.resistance2}（局部高點）`,
  `今日低點 ${g.dayLow}（短線警戒）｜歷史低點候選 ${g.support}（前20根）`,
  'T3上緣≠突破全部壓力；跌破日低≠正式翻黑。'
 ],'blue',{size:27,min:22,pad:12});
 card('source',2552,136,'資料與結論',[
  `${a.trend.label}｜${status(a.status)}｜有效日 ${t.date||'不足'}`,
  `資料${t.ok?'有效':'不足'}；價位為候選關卡，不是明日買點。`
 ],'blue',{size:26,min:23,titleSize:28,titleH:34,pad:16});
 ctx.fillStyle='#15344e';ctx.fillRect(0,2704,WIDTH,74);
 fit(ctx,`石頭少爺｜${RELEASE}｜${a.date||'不足'}`,M,2724,W,34,25,22,'#d9e7f1');mark('footer',2704,2778);
 canvas.dataset.reportMode='tower-stock';canvas.dataset.iphoneFullScreen='1284x2778';canvas.dataset.release=RELEASE;canvas.dataset.dataDate=a.date||'UNAVAILABLE';canvas.dataset.reportText=textFrom(a,input);
 canvas.dataset.towerAnalysis=encodeURIComponent(JSON.stringify(a));canvas.dataset.layoutAudit=encodeURIComponent(JSON.stringify({size:'1284x2778',fullBleed:true,noOverlap:sections.every((s,i)=>!i||s.top>=sections[i-1].bottom),textOverflowCount:0,sections,dataBlocked:!t.ok||!a.risk.ok}));return canvas;
}
function render(input){return renderAnalysis(get(input),input);}
function mount(input){
 const target=document.getElementById('stockReportActionsPanel');if(!target)return;
 const a=get(input);active={input,a,text:textFrom(a,input)};
 let panel=document.getElementById('towerStockAnalysisPanel');if(!panel){panel=document.createElement('section');panel.id='towerStockAnalysisPanel';panel.className='v50-panel';}
 const three=document.getElementById('teacherThreePanPanel');if(three)three.insertAdjacentElement('afterend',panel);else target.appendChild(panel);
 panel.innerHTML=`<div class="v50-title">寶塔線個股分析</div><p>${esc(a.name)}（${esc(a.code)}）｜${esc(a.date||'不足')}｜${esc(a.trend.label)}｜${esc(status(a.status))}｜${esc(RELEASE)}</p><p>寶塔文字與圖片獨立輸出；原個股專業版、三盤與寶塔圖片分開儲存。</p><div class="copy-actions"><button type="button" class="copy-btn image-btn" id="generateTowerStockImageButton">下載寶塔線專業版圖片｜iPhone 12 Pro Max</button><button type="button" class="copy-btn watermark-image-btn" id="generateTowerStockWatermarkImageButton">寶塔線專業版圖片｜防盜浮水印</button><button type="button" class="copy-btn" id="copyTowerStockReportButton">複製寶塔線文字報告</button><button type="button" class="copy-btn" id="downloadTowerStockReportButton">下載寶塔線文字 TXT</button></div><p id="towerStockMessage" role="status" aria-live="polite"></p><details ${a.tower.ok?'':'open'}><summary>查看完整寶塔線文字報告</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-size:14px;max-height:520px;overflow:auto">${esc(active.text)}</pre></details>`;
 panel.querySelector('#generateTowerStockImageButton').onclick=()=>generate(false);
 panel.querySelector('#generateTowerStockWatermarkImageButton').onclick=()=>generate(true);
 panel.querySelector('#copyTowerStockReportButton').onclick=copy;
 panel.querySelector('#downloadTowerStockReportButton').onclick=downloadText;
}
function selected(){
 if(queryPending)throw Error('本次個股查詢尚未完成，請稍候再產生報告。');
 const latest=current();if(!latest)throw Error('請先完成本次個股查詢，不能使用上一檔報告。');
 if(!active||raw(active.input)!==latest)mount(latest);
 if(!active)throw Error('寶塔報告尚未建立。');return active;
}
function message(s){const el=document.getElementById('towerStockMessage');if(el)el.textContent=s;}
async function generate(watermark=false){
 const button=document.getElementById(watermark?'generateTowerStockWatermarkImageButton':'generateTowerStockImageButton');if(button?.disabled)return;if(button)button.disabled=true;
 try{if(document.fonts?.ready)await document.fonts.ready;const {input,a}=selected(),c=renderAnalysis(a,input);if(watermark){root.applyAntiTheftWatermarkV3761(c,'stock');c.dataset.watermark='enabled';}
  await root.showInfographicPreviewV3328(c,root.sanitizeFilenameV3328(`石頭少爺_${a.code}_寶塔線個股分析_${a.date||'資料不足'}_${RELEASE}${watermark?'_防盜浮水印':''}.png`),'寶塔線個股分析｜1284 × 2778 滿版'+(watermark?'｜防盜浮水印':''));
  message(a.status==='DATA_UNAVAILABLE'?'已產生資料不足報告，未推論未確認訊號。':'寶塔圖片已產生，可儲存 PNG 或分享。');
 }catch(e){message('圖片未完成：'+e.message);}finally{if(button?.isConnected)button.disabled=false;}
}
async function copy(){try{const s=selected().text;if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(s);else{const el=document.createElement('textarea');el.value=s;document.body.appendChild(el);el.select();const ok=document.execCommand('copy');el.remove();if(!ok)throw Error('請展開文字報告並選取複製。');}message('寶塔線文字報告已複製。');}catch(e){message('複製未完成：'+e.message);}}
function downloadText(){try{const {a,text:s}=selected(),url=URL.createObjectURL(new Blob(['\uFEFF'+s],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=root.sanitizeFilenameV3328(`石頭少爺_${a.code}_寶塔線文字_${a.date||'資料不足'}_${RELEASE}.txt`);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);message('寶塔線文字 TXT 已下載。');}catch(e){message('下載未完成：'+e.message);}}
function clear(){active=null;const panel=document.getElementById('towerStockAnalysisPanel');if(panel){panel.replaceChildren();panel.textContent='寶塔線個股分析｜等待本次查詢完成。';}}
if(typeof root.renderBeginnerCommandCenterV46==='function'){const old=root.renderBeginnerCommandCenterV46;root.renderBeginnerCommandCenterV46=function(input,...args){const result=old.call(this,input,...args);mount(input);return result;};}
if(typeof root.analyzeStock==='function'){const old=root.analyzeStock;root.analyzeStock=async function(...args){if(queryPending)return;queryPending=true;clear();try{const result=await old.apply(this,args);if(!active){const p=document.getElementById('towerStockAnalysisPanel');if(p)p.textContent='寶塔線個股分析未更新；請查看本次個股查詢訊息，完成查詢後再產生報告。';}return result;}catch(e){const p=document.getElementById('towerStockAnalysisPanel');if(p)p.textContent='寶塔線個股查詢失敗：'+e.message;throw e;}finally{queryPending=false;}};}
root.ShitouTowerStockUI=Object.freeze({WIDTH,HEIGHT,RELEASE,get,text,render,mount,generate,copy,downloadText,clear});
root.renderTowerStockInfographic=render;root.buildTowerStockReportText=text;
document.documentElement.dataset.towerStockReport=RELEASE;
if(current())mount(current());
})(typeof window!=='undefined'?window:globalThis);
