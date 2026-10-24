(function(r){'use strict';const C=r.ShitouStructureCore,S=r.ShitouStructureScanner;const W=1284,H=2778,SAFE=36,SIZE=42,LINE=60,START=560,END=2540;
function wrap(ctx,value,width=W-SAFE*2,size=SIZE){ctx.font=`600 ${size}px -apple-system,"Microsoft JhengHei","Noto Sans TC",sans-serif`;const out=[];for(const paragraph of String(value??'').split('\n')){let line='';const tokens=paragraph.match(/[0-9]+(?:[.\-/:][0-9]+)*%?|[A-Za-z][A-Za-z0-9_.]*|[^]/gu)||[];for(const token of tokens){if(ctx.measureText(token).width>width){for(const ch of token){if(line&&ctx.measureText(line+ch).width>width){out.push(line);line=ch;}else line+=ch;}}else if(line&&ctx.measureText(line+token).width>width){out.push(line);line=token;}else line+=token;}out.push(line);}return out;}
function paint(ctx,scan,plan,index,total,title,subtitle,version,layout){ctx.textBaseline='alphabetic';const draw=(text,x,y,size=SIZE,color='#17334e',bold=600)=>{ctx.font=`${bold} ${size}px -apple-system,"Microsoft JhengHei","Noto Sans TC",sans-serif`;ctx.fillStyle=color;ctx.fillText(text,x,y);};ctx.fillStyle='#f1f5f9';ctx.fillRect(0,0,W,H);ctx.fillStyle='#123b5b';ctx.fillRect(0,0,W,layout.headerBottom);draw(title,SAFE,72,52,'#fff',800);draw(subtitle,SAFE,140,40,'#dcefff',800);draw(`行情 ${scan.date}｜${index+1}/${total} 頁｜${scan.complete?'處理與資料檢查完成':scan.pending===0&&!scan.stopped&&!scan.breaker?'掃描結束／資料有缺口':'部分結果'}`,SAFE,202,34,'#fff');version.forEach((t,k)=>draw(t,SAFE,250+k*29,23,'#dcefff'));plan.heading.forEach((t,k)=>draw(t,SAFE,layout.headingY+k*43,36,'#ffe6aa',800));plan.lines.forEach((t,k)=>draw(t,SAFE,layout.bodyStart+k*LINE));ctx.fillStyle='#123b5b';ctx.fillRect(0,2600,W,178);draw('結構評分不是勝率｜未確認型態不列確認成功',SAFE,2655,30,'#fff');draw(`快照 ${scan.id}｜A/B獨立排名｜僅盤後完成日K`,SAFE,2703,28,'#dcefff');draw('完整資料不足時僅研究觀察；隔日成交仍須確認',SAFE,2749,28,'#ffe6aa');}
// Compact iPhone card is presentation only. Original C.lines, scan ordering and full pages are never shortened.
function overview(scan,{mode='A',watermark=false}={}){
 S.assertSnapshot(scan);
 if(!['A','B'].includes(mode))throw Error('無效的第六濾網模式');
 const data=scan.modeResults?.[mode];if(!data)throw Error('模式資料不存在');
 const rows=(data.top8||[]).slice(0,8);
 if(!rows.length)throw Error(mode+'模式沒有通過確認與追價門檻的候選；不補滿前8強');
 if(rows.some(c=>!C.top8Decision(c).allowed))throw Error('前8強含舊版不合格項目，請重掃');
 const WIDTH=1284,HEIGHT=2778,CARD={x:24,y:218,width:1236,height:286,step:294},FOOTER=2578;
 const probe=document.createElement('canvas').getContext('2d');
 if(!probe)throw Error('裝置無法建立圖片文字測量工具');
 const num=(v,d=2)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(d):'未驗證';
 const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?(v>=1e8?num(v/1e8,2)+'億':num(v/1e4,2)+'萬'):'未驗證';
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'尚未';
 const monthly=c=>({PASS:'月線通過',NOT_PASS:'月線未通過',UNCONFIRMED:'月線待確認',UNAVAILABLE:'月線未驗證'})[c.monthlyStatus]||'月線未驗證';
 const font=(s,b=true)=>`${b?850:500} ${s}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;
 function fit(value,width,max,min=max,{summary=false}={}){
  const fullText=String(value??'');let size=max;
  for(;size>=min;size--){probe.font=font(size);if(probe.measureText(fullText).width<=width)return {text:fullText,fullText,size,abbreviated:false};}
  if(!summary)throw Error('卡片固定欄位超出文字安全區，請檢查字級或原始資料');
  size=min;probe.font=font(size);const suffix='…詳見完整報告';let short=fullText;
  while(short&&probe.measureText(short+suffix).width>width)short=[...short].slice(0,-1).join('');
  return {text:short+suffix,fullText,size,abbreviated:true};
 }
 const blocks=rows.map((c,i)=>{
  const f=c.features||{},risk=c.risk||{},ev=c.event||{},fitScore=c.tradeFitness||{};
  const g=C.top8Decision(c),verified=!!c.eligible;
  const warn=[...(c.tradeFitness?.warnings||[]),...(risk.currentWarnings||[]),...(risk.reasons||[]),...(c.warnings||[])];
  const riskText=[...new Set(warn.filter(Boolean))].join('；')||'本輪無額外警訊，仍須確認成交條件';
  const tone=fitScore.grade==='HIGH_RISK'||risk.critical?'#b52a34':verified?'#19714c':'#a66e1e';
  const quality=verified?'資料與日K確認通過':'研究觀察／資料未完整驗證';
  const q=c.quality||{},source=String(q.source||'未驗證');
  const fields=[
   ['風險調整分',num(c.score?.total)],['短線適配分',num(fitScore.score)],
   ['距確認點',num(risk.gapTriggerPct)+'%'],['結構風險距離',num(risk.structureRiskPct)+'%'],
   ['最新量比',num(f.volumeRatio5)+' 倍']
  ].map(([label,value])=>({label:fit(label,200,17,15),value:fit(value,200,25,18)}));
  const lines=[
   {key:'status',y:75,text:`${mode}模式｜${c.label||'階段未驗證'}｜${quality}｜${monthly(c)}`,max:20,min:17,color:tone,summary:true},
   {key:'levels',y:178,text:`確認 ${num(ev.trigger)}｜失效 ${num(ev.invalidation)}｜追價 ${g.allowed?'門檻通過':'待確認'}（資料認證另查）`,max:19,min:16,color:'#18334d',summary:true},
   {key:'context',y:205,text:`MA20 ${num(f.ma20)}｜成交金額 ${money(f.tradeValue)}元｜收盤位置 ${num(f.candle?.position*100)}%`,max:18,min:16,color:'#72530b',summary:true},
   {key:'rsi',y:229,text:`RSI5 ${num(f.rsi5)}｜訊號 ${date(ev.signalDate)}／確認 ${date(ev.confirmedDate)}／回測 ${date(ev.retestDate)}`,max:18,min:16,color:'#36516c',summary:true},
   {key:'risk',y:253,text:`警訊：${riskText}`,max:18,min:16,color:tone,summary:true},
   {key:'source',y:277,text:`行情 ${scan.date}｜來源 ${source}｜快照 ${(q.snapshotHash||scan.snapshotHash||'未驗證').slice(0,12)}｜價格還原${q.basisVerified?'已驗證':'待確認'}`,max:15,min:13,color:'#52647b',summary:true}
  ].map(l=>({...l,...fit(l.text,1160,l.max,l.min,{summary:l.summary})}));
  return {rank:i+1,code:c.code,top:CARD.y+i*CARD.step,bottom:CARD.y+i*CARD.step+CARD.height,tone,
   name:fit(`觀察 #${i+1} ${c.name||'未驗證'}（${c.code}）`,715,36,22,{summary:true}),
   close:fit(`收盤 ${num(f.close)} 元`,435,32,22,{summary:false}),fields,lines};
 });
 const short=scan.release.match(/R5\.\d+(?:\.\d+)+/)?.[0]||'V50';
 const header=[
  {text:`⑥ 結構轉強・反轉確認｜${mode}模式前8強總覽`,x:30,y:58,width:1224,max:38,min:29,color:'#fff'},
  {text:`${mode==='A'?'強勢回測再轉強':'跌深反轉確認'}｜行情 ${scan.date}｜${short}｜STRUCTURECARD.1`,x:30,y:116,width:1224,max:21,min:16,color:'#e5f4ff'},
  {text:`處理 ${scan.attempted}/${scan.planned}｜日K確認 ${data.counts?.confirmed??'未驗證'}｜本頁 ${rows.length}｜資料不足 ${data.counts?.data??'未驗證'}｜${scan.fullMarketCertified?'市場資料認證完成':'市場資料認證未完整'}`,x:30,y:151,width:1224,max:20,min:16,color:'#fff4bb'},
  {text:'提醒：先看認證與風險，再看結構分；型態分不是勝率，盤後榜單不等於買點。',x:30,y:188,width:1224,max:19,min:17,color:'#fff'}
 ].map(h=>({...h,...fit(h.text,h.width,h.max,h.min,{summary:true})}));
 const footers=[
  ['結構評分不是勝率；當前日K確認不等於正式買進資格。',2622,21,'#fff'],
  [`A/B獨立排名｜本頁 ${rows.length} 檔｜完整資料資格：${scan.fullMarketCertified?'依逐檔認證結果':'尚未完全驗證'}`,2660,20,'#e9f5ff'],
  ['完整警訊、歷史訊號、月線及資料來源，請另開逐檔完整報告。',2700,19,'#fff3c2'],
  [`快照 ${scan.id||scan.snapshotHash||'未驗證'}｜STRUCTURECARD.1｜盤後完成日K觀察`,2740,16,'#d4e5f5']
 ].map(([text,y,max,color])=>({...fit(text,1228,max,max-2,{summary:true}),y,color}));
 const fullText=[`⑥ 結構轉強・反轉確認｜${mode}模式前8強總覽`,`行情 ${scan.date}｜版本 ${scan.release}`,...rows.flatMap((c,i)=>[`觀察 #${i+1}`,...C.lines(c)])];
 const audit={model:'STRUCTURE_TOP8_OVERVIEW_1',mode,date:scan.date,release:scan.release,snapshotId:scan.id||scan.snapshotHash||null,width:WIDTH,height:HEIGHT,fullBleed:true,count:rows.length,codes:rows.map(c=>c.code),quality:rows.map(c=>c.quality),
  blocks:blocks.map(b=>({rank:b.rank,code:b.code,top:b.top,bottom:b.bottom,fields:b.fields.map(f=>[f.label.text,f.value.text]),lines:b.lines})),
  abbreviated:blocks.flatMap(b=>b.lines.filter(l=>l.abbreviated).map(l=>({code:b.code,key:l.key,fullText:l.fullText}))),noOverlap:blocks.every((b,i)=>i===0||b.top>=blocks[i-1].bottom),headerBottom:210,footerTop:FOOTER};
 function paintOverview(ctx){
  if(!ctx)throw Error('無法建立第六濾網圖片繪圖工具');
  ctx.textBaseline='alphabetic';ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,WIDTH,HEIGHT);
  const draw=(plan,x,y,color=plan.color||'#18334d',align='left')=>{ctx.font=font(plan.size);ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(plan.text,x,y);ctx.textAlign='left';};
  ctx.fillStyle='#123a5a';ctx.fillRect(0,0,WIDTH,210);header.forEach(h=>draw(h,h.x,h.y));
  blocks.forEach(b=>{const x=CARD.x,y=b.top;ctx.fillStyle='#fff';ctx.fillRect(x,y,CARD.width,CARD.height);ctx.fillStyle=b.tone;ctx.fillRect(x,y,8,CARD.height);
   draw(b.name,x+24,y+39);draw(b.close,x+CARD.width-24,y+39,'#b52a34','right');
   b.fields.forEach((field,k)=>{const cx=x+22+k*238;ctx.fillStyle='#f3f7fa';ctx.fillRect(cx,y+87,224,63);draw(field.label,cx+12,y+109,'#5c6d80');draw(field.value,cx+12,y+140,b.tone);});
   b.lines.forEach(line=>draw(line,x+25,y+line.y,line.color));
  });
  ctx.fillStyle='#123a5a';ctx.fillRect(0,FOOTER,WIDTH,HEIGHT-FOOTER);footers.forEach(f=>draw(f,28,f.y,f.color));
}
 // The preview descriptor is NOT a CanvasImageSource. Web Share needs a
 // drawable canvas region to encode a standalone JPEG before the user taps.
 return [{width:WIDTH,height:HEIGHT,dataset:{fullBleed:'true',iphoneFullScreen:'1284x2778',iphoneFullWidth:'1284',structureOverviewAudit:JSON.stringify(audit),reportText:encodeURIComponent(JSON.stringify(fullText))},renderExportRegion({top=0,height=HEIGHT,scale=1}={}){
  if(!(Number.isFinite(top)&&Number.isFinite(height)&&Number.isFinite(scale))||top<0||height<=0||scale<=0||top+height>HEIGHT)throw Error('分享區段尺寸無效');
  const tile=document.createElement('canvas');tile.width=Math.max(1,Math.floor(WIDTH*scale));tile.height=Math.max(1,Math.floor(height*scale));
  const ctx=tile.getContext('2d');if(!ctx)throw Error('無法建立手機分享畫布');
  ctx.setTransform(scale,0,0,scale,0,-top*scale);paintOverview(ctx);return tile;
 },
 toBlob(callback,type='image/png'){
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
  if(/iPhone|iPad|iPod|Android/i.test(r.navigator?.userAgent||'')&&r.ShitouMobilePng5329)r.ShitouMobilePng5329.install(canvas,[],'#eef3f8');
  try{paintOverview(canvas.getContext('2d'));canvas.toBlob(blob=>{canvas.width=canvas.height=1;callback(blob);},type);}
  catch(error){canvas.width=canvas.height=1;callback(null);}
 } }];
}
function pages(scan,{mode='A',kind='full',code}={}){if(kind==='top8')return overview(scan,{mode});S.assertSnapshot(scan);const data=scan.modeResults[mode],rows=kind==='stock'?data.ranked.filter(c=>c.code===code):kind==='top8'?data.top8:null;if(kind==='top8'&&rows.some(c=>!C.top8Decision(c).allowed))throw Error('前8強含未通過追價門檻的舊結果，請重掃');if(rows&&!rows.length)throw Error('此模式沒有對應的已確認候選；不補出股票');const probe=document.createElement('canvas').getContext('2d'),version=wrap(probe,scan.release,W-SAFE*2,23),layout={headingY:250+(version.length-1)*29+70,headerBottom:250+(version.length-1)*29+170,bodyStart:250+(version.length-1)*29+250},title='⑥ 結構轉強・反轉確認',subtitle=mode+'｜'+(mode==='A'?'強勢回測再轉強':'跌深反轉確認')+'｜'+({full:'完整分析',top8:'前8強觀察',stock:'個股結構分析'})[kind],capacity=Math.floor((END-layout.bodyStart)/LINE)+1,blocks=rows?rows.map((c,i)=>({name:`${kind==='stock'?'個股':'前8強 #'+(i+1)} ${c.name}（${c.code}）`,lines:C.lines(c)})):[{name:'全市場檢查與完整逐檔紀錄',lines:scan.text[mode].split('\n')}],plans=[];
 for(const block of blocks){const lines=block.lines.flatMap(t=>wrap(probe,t));for(let at=0;at<lines.length;at+=capacity){const heading=wrap(probe,block.name+(at>0?'（續）':''),W-SAFE*2,36);if(heading.length>2)throw Error('長股名需額外頁首空間');plans.push({name:block.name,heading,lines:lines.slice(at,at+capacity)});}}
 if(version.length>7)throw Error('版本字串超出圖片安全區，需調整頁首而非裁切');return plans.map((plan,i)=>({width:W,height:H,dataset:{fullBleed:'true',iphoneFullScreen:'1284x2778',reportText:encodeURIComponent(JSON.stringify(plan.lines)),structureAudit:JSON.stringify({id:scan.id,mode,kind,index:i+1,total:plans.length,lines:plan.lines,bodyStart:layout.bodyStart,headerBottom:layout.headerBottom,bodyBottom:layout.bodyStart+(plan.lines.length-1)*LINE,safe:SAFE,release:scan.release})},
 // The existing share pipeline accepts a small raster region without allocating
 // all report pages or trying to draw this lazy descriptor as a CanvasImageSource.
 renderExportRegion({top=0,height=H,scale=1}={}){const tile=document.createElement('canvas');tile.width=Math.max(1,Math.floor(W*scale));tile.height=Math.max(1,Math.floor(height*scale));const ctx=tile.getContext('2d');ctx.setTransform(scale,0,0,scale,0,-top*scale);paint(ctx,scan,plan,i,plans.length,title,subtitle,version,layout);return tile;},
 toBlob(callback,type='image/png'){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;if(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)&&r.ShitouMobilePng5329)r.ShitouMobilePng5329.install(canvas,[],'#f1f5f9');paint(canvas.getContext('2d'),scan,plan,i,plans.length,title,subtitle,version,layout);canvas.toBlob(b=>{canvas.width=canvas.height=1;callback(b);},type);}}));}
async function preview(scan,options={}){if(document.fonts?.ready)await document.fonts.ready;const out=pages(scan,options),mode=options.mode||'A';return r.strongStockShowPagesV47(out,{title:'⑥ 結構轉強・反轉確認｜'+mode+'模式',prefix:'STRUCTURE_'+mode+'_'+(options.kind||'full'),date:scan.date,kind:'structure-reversal',note:options.kind==='top8'?'iPhone 12 Pro Max 1284×2778 單張滿版｜模式內前8檔依原排序，完整資料請另看逐檔報告。':'1284×2778 滿版閱讀；全部欄位完整分頁。請逐頁分享，或下載全部圖片ZIP。'});}
r.ShitouStructureReport=Object.freeze({pages,overview,preview,wrap,geometry:{width:W,height:H,safe:SAFE,font:SIZE,start:START,end:END,line:LINE}});})(globalThis);
