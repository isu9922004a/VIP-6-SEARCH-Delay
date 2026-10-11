(function(root){'use strict';
const A=root.ShitouTowerTrend,C=root.ShitouTowerCore;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const price=x=>x===null||x===undefined?'資料不足':Number(x).toFixed(2);
function lines(a){const t=a.tower,s=t.states[3]||{},r=a.risk;return [a.trend.plain,`T=2 ${t.states[2]?.color||'不足'}｜T=3 ${s.color||'不足'}｜T=5 ${t.states[5]?.color||'不足'}`,`最新黑翻紅 ${s.lastRedDate||'尚無已確認'}｜紅翻黑 ${s.lastBlackDate||'尚無已確認'}｜連紅 ${s.redDays??'-'}／連黑 ${s.blackDays??'-'} 日`, `目前趨勢 ${a.trend.label}｜進場風險 ${a.status}｜健康續強 ${a.type==='A'&&!['NO_CHASE','REJECT','DATA_UNAVAILABLE'].includes(a.status)?'條件觀察':'尚未確認'}`,`方向衝突 ${a.trend.directionConflict?'有':'無／資料不足'}｜反覆翻轉 ${t.flipCount20??'-'} 次／20根｜衰竭 ${r.families?.EXHAUSTION?.detail||'未見本模型警示／資料不足'}`, `A紅線恆強 ${a.type==='A'?'訊號成立':'未成立'}｜B今日黑翻紅 ${a.type==='B'?'訊號成立':'未成立'}｜月20MA ${a.monthly.status}／${price(a.monthly.ma20)}`,`關鍵轉強 > ${price(r.levels?.turnAbove)}｜失效 < ${price(r.levels?.invalidation)}｜支撐 ${price(r.levels?.support)}｜壓力 ${price(r.levels?.resistance)}`,a.nonHolder,a.holder,`資料日 ${a.date||'不足'}｜來源 ${t.source||'不足'}｜價格調整 ${t.basis||'未知'}｜${C.MODEL}`,`${C.RELEASE}｜工程研究分非上漲機率｜資料限制 ${(t.warnings||[]).join('、')||'依本次資料檢查'}`];}
function html(a){return '<section class="tower-panel"><h3>【寶塔線多空趨勢診斷】</h3>'+lines(a).map(s=>'<p>'+esc(s)+'</p>').join('')+'<h4>明天三種走法</h4>'+Object.values(a.scenarios).map(s=>'<p>'+esc(s)+'</p>').join('')+'</section>';}
function wrap(ctx,s,width,size){ctx.font=`700 ${size}px 'Microsoft JhengHei',sans-serif`;const lines=[];for(const para of String(s).split('\n')){let line='';for(const ch of para){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}lines.push(line);}return lines;}
function chart(ctx,t,T,x,y,w,h){
 const hist=t.states[T]?.history?.filter(r=>r.color!=='UNKNOWN').slice(-60)||[];
 if(!hist.length){ctx.font="24px 'Microsoft JhengHei'";ctx.fillStyle='#17324f';ctx.fillText('寶塔線資料不足，暫停繪圖',x,y+40);return;}
 const lo=Math.min(...hist.map(r=>r.bodyLow)),hi=Math.max(...hist.map(r=>r.bodyHigh)),span=hi-lo||1,Y=p=>y+35+(hi-p)/span*(h-85),step=(w-100)/hist.length;
 ctx.fillStyle='#fff';ctx.fillRect(x,y,w,h);ctx.font="30px 'Microsoft JhengHei'";ctx.fillStyle='#17324f';ctx.fillText(`T=${T}｜${hist[0].date}～${t.date}｜單色柱體：前日收盤→今日收盤`,x+16,y+7);
 hist.forEach((r,i)=>{const xx=x+90+i*step,top=Y(r.bodyHigh),bottom=Y(r.bodyLow);ctx.fillStyle=r.color==='RED'?'#b52b46':'#25364a';ctx.fillRect(xx,top,Math.max(2,step*.7),Math.max(2,bottom-top));if(r.flip){ctx.font="24px 'Microsoft JhengHei'";ctx.fillStyle='#596b7c';ctx.fillText(r.color==='RED'?'翻紅':'翻黑',xx,Math.max(y+40,top-20));}});
 ctx.fillStyle='#17324f';ctx.font="28px 'Microsoft JhengHei'";ctx.fillText(price(hi),x+5,y+40);ctx.fillText(price(lo),x+5,y+h-54);ctx.fillText(`下一完成收盤翻紅 > ${price(t.states[T].nextRedAbove)}／翻黑 < ${price(t.states[T].nextBlackBelow)}`,x+16,y+h-29);
}
function extend(base,a){
 const probe=document.createElement('canvas').getContext('2d'),ops=[],audit=[];const W=1284,M=36,inner=W-2*M;
 let y=0;
 const crop=(id,sx,sy,sw,sh)=>{const height=Math.ceil(sh*inner/sw);const top=y;ops.push(ctx=>ctx.drawImage(base,sx,sy,sw,sh,M,top,inner,height));y+=height+18;audit.push({id,top,bottom:y-18,role:'preserved'});};
 const card=(id,title,body)=>{const rows=[...wrap(probe,title,inner-48,50).map(text=>({text,size:50})),...body.flatMap(s=>wrap(probe,s,inner-48,42).map(text=>({text,size:42})))],height=48+rows.reduce((n,r)=>n+r.size*1.48,0),top=y;ops.push(ctx=>{ctx.fillStyle='#fff';ctx.fillRect(M,top,inner,height);let cy=top+24;for(const r of rows){ctx.font=`700 ${r.size}px 'Microsoft JhengHei',sans-serif`;ctx.fillStyle='#17324f';ctx.textBaseline='top';ctx.fillText(r.text,M+24,cy);cy+=r.size*1.48;}});y+=height+18;audit.push({id,top,bottom:y-18,role:'new'});};
 let old,content={};try{old=JSON.parse(decodeURIComponent(base.dataset.layoutAudit));content=JSON.parse(decodeURIComponent(base.dataset.professionalLayoutContent||'{}'));}catch(_){}
 // Actual final mother renderer is the teacher overlay. Preserve each original section
 // at native scale; B/C and E/F columns are separated into individual full-width rows.
 if(old?.sections?.some(s=>s.id==='A-chart-original')){
  crop('header-original',0,0,1284,132);ops.push(ctx=>{const scale=inner/1284;ctx.fillStyle='#244f78';ctx.fillRect(M+945*scale,99*scale,310*scale,28*scale);ctx.fillStyle='#fff';ctx.font="12px 'Microsoft JhengHei'";ctx.textBaseline='top';ctx.fillText(C.RELEASE,M+951*scale,106*scale);});card('release','版本與資料基準',[C.RELEASE+'｜SHADOW未啟用交易',`資料日 ${a.date||'不足'}｜${a.name}（${a.code}）｜原報告內容與寶塔線觀察層分別保留。`]);crop('decision-original',28,140,1228,164);crop('volume-title-original',28,312,1228,28);
  crop('volume-status-original',28,344,688,94);crop('next-step-original',724,344,532,94);
  for(let i=0;i<3;i++)crop('volume-branch-original-'+i,28+i*412,446,404,98);
  crop('volume-angle-original',28,552,610,110);crop('background-original',646,552,610,110);
  card('tower-diagnosis','【寶塔線多空趨勢診斷】',lines(a));crop('operation-and-chart-original',28,670,1228,880);
  for(const T of [3,5]){const top=y;ops.push(ctx=>chart(ctx,a.tower,T,M,top,inner,440));y+=458;audit.push({id:'tower-chart-'+T,top,bottom:y-18,role:'new'});}
  crop('tomorrow-original',28,1558,610,330);card('tower-tomorrow','明天三種走法｜寶塔線條件',[a.scenarios.bull,a.scenarios.range,a.scenarios.weak]);crop('detailed-original',646,1558,610,330);card('tower-strategy','四策略觀察與追價風險',[`主升、當沖、強勢飆股：保留原資格、分數与排序，本層僅附加 ${a.status} 證據。`,`第四套 ${a.subStrategy||'無訊號'}／${a.subtype||'無分類'}｜${a.quality?.value??'不足'}分（非勝率）`,a.nonHolder,a.holder]);
  if(content.metrics?.length===7){card('seven-metrics-title','D. 七項條件分｜原文完整重排',['盤前分數只供觀察，不代表現在可以執行。']);content.metrics.forEach((m,i)=>card('seven-metric-'+i,m.title,[m.value,m.sub]));}else crop('seven-metrics-original',28,1896,1228,212);
  crop('wave-title-original',28,2116,1228,34);crop('wave-volume-original',28,2158,610,250);crop('wave-response-original',646,2158,610,250);
  if(content.snr?.length===8)card('history-abc-trident-original',content.snr[0],content.snr.slice(1));else crop('history-abc-trident-original',28,2416,1228,190);crop('mnemonic-footer-original',0,2614,1284,164);
 }else{
  // Unknown source layout: preserve the entire original raster, then append. Never infer crop coordinates.
  crop('all-original',0,0,base.width,base.height);card('tower-diagnosis','【寶塔線多空趨勢診斷】',lines(a));
  for(const T of [3,5]){const top=y;ops.push(ctx=>chart(ctx,a.tower,T,M,top,inner,440));y+=458;audit.push({id:'tower-chart-'+T,top,bottom:y-18,role:'new'});}
  card('tower-tomorrow','明天三種走法｜寶塔線條件',Object.values(a.scenarios));
 }
 y+=M;const canvas=document.createElement('canvas');canvas.width=W;canvas.height=Math.ceil(y);if(canvas.height>32760)throw new Error('報告超過32760px，停止輸出以避免Safari裁切；請分頁。');const ctx=canvas.getContext('2d');ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,W,canvas.height);ops.forEach(fn=>fn(ctx));Object.assign(canvas.dataset,base.dataset);canvas.dataset.towerAnalysis=encodeURIComponent(JSON.stringify(a));canvas.dataset.release=C.RELEASE;canvas.dataset.dataDate=a.date||'UNAVAILABLE';canvas.dataset.iphoneFullScreen=`1284x${canvas.height}`;let originalText=[];try{const decoded=decodeURIComponent(base.dataset.reportText||'');try{const parsed=JSON.parse(decoded);originalText=Array.isArray(parsed)?parsed:[decoded];}catch(_){originalText=[decoded];}}catch(_){}canvas.dataset.reportText=encodeURIComponent(JSON.stringify([...originalText,...lines(a),...Object.values(a.scenarios)]));canvas.dataset.layoutAudit=encodeURIComponent(JSON.stringify({width:W,height:canvas.height,noOverlap:audit.every((s,i)=>!i||s.top>=audit[i-1].bottom),sections:audit,originalContentPreserved:true,sourceAudit:old,sourceOverflow:old?.textOverflowCount??null,physicalIphoneTested:false}));return canvas;
}
root.ShitouTowerReport=Object.freeze({lines,html,chart,extend,wrap});
})(typeof window!=='undefined'?window:globalThis);



