(function(root){'use strict';
const C=root.ShitouRestaurantCore;
function fullPages(scan,{limit='all',watermark=false}={}){
 root.ShitouRestaurantScanner.assertSnapshot(scan);
 const observer=root.ShitouIndicatorShadow;if(!observer?.imagePage)throw Error('動能量價圖片模組未載入');
 const observationRun=observer.capture('RESTAURANT',scan);
 const rows=scan.candidates.slice(0,limit==='all'?scan.candidates.length:limit),probe=document.createElement('canvas').getContext('2d'),plans=[];
 probe.font='700 42px "Microsoft JhengHei","Noto Sans TC",sans-serif';
 const wrap=s=>observer.wrapImageText(probe,s);
 rows.forEach((row,index)=>{const observation=observationRun?.rows.find(r=>r.code===row.code),extra=observation?[...root.ShitouIndicatorShadow.core.lines(observation.evidence),...root.ShitouIndicatorShadow.rowContext(observation)]:['多週期情境尚未建立；請重新掃描，不補猜'];const text=[`觀察序 #${index+1}`,...C.lines(row),...extra,`掃描 ${scan.attempted}/${scan.planned}｜${scan.fullMarketCertified?'完整市場資料認證':'非全市場完整排名'}｜原圖完整符合 ${scan.sourceVerifiedMatches} 檔`],lines=text.flatMap(wrap);for(let at=0;at<lines.length;at+=32)plans.push({row,index,lines:lines.slice(at,at+32)});});
 return plans.map((p,i)=>({width:1284,height:2778,dataset:{restaurantAudit:JSON.stringify({model:C.MODEL,snapshotId:scan.snapshotId,validationId:p.row.validation.id,release:scan.release,code:p.row.code,page:i+1,total:plans.length,lines:p.lines.length,rank:p.index+1,sourceMatch:p.row.sourceMatch,lazy:true}),reportText:encodeURIComponent(JSON.stringify(p.lines))},toBlob(callback,type='image/png'){
  const canvas=observer.imagePage({strategy:'RESTAURANT',date:scan.date},[{code:p.row.code}],p.index,i+1,plans.length,p.lines);if(watermark&&root.applyAntiTheftWatermarkV3761)root.applyAntiTheftWatermarkV3761(canvas,'all');canvas.toBlob(blob=>{canvas.width=canvas.height=0;callback(blob);},type);
 }}));
}
// Presentation only: same 1284x2778 card geometry as the third filter.
// A restaurant candidate keeps its own status/metrics; no score or ranking is inferred.
function overview(scan,{watermark=false}={}){
 root.ShitouRestaurantScanner.assertSnapshot(scan);
 const observer=root.ShitouIndicatorShadow;
 if(!observer?.wrapImageText)throw Error('圖片文字模組未載入');
 const rows=scan?.candidates?.slice(0,8)||[];
 if(!rows.length)throw Error('目前沒有候選可產圖');
 const run=observer.capture('RESTAURANT',scan),probe=document.createElement('canvas').getContext('2d');
 const WIDTH=1284,HEIGHT=2778,CARD={x:24,y:218,width:1236,height:286,step:294},FOOTER=2578;
 const font=(size,bold=true)=>`${bold?850:500} ${size}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;
 const fmt=(v,d=2)=>C.number(v)===null?'未驗證':C.number(v).toFixed(d);
 const monthly=c=>c.monthlyStatus==='PASS'?'月線通過':c.monthlyStatus==='NOT_PASS'?'月線未通過':'月線未驗證';
 const original=c=>({UNVERIFIED:'尚未完整核對',NOT_MATCH:'條件不完全符合',VERIFIED_MATCH:'六項核對符合'})[c.sourceCheckState]||'資料不足';
 // Plan every line before rendering. Only explicitly marked summary text may
 // abbreviate; full reasons stay in reportText/audit and the full report pages.
 function fit(text,width,max,min=max,{summary=false}={}){
  text=String(text??'');let size=max;
  for(;size>=min;size--){probe.font=font(size);if(probe.measureText(text).width<=width)return {text,fullText:text,size,width,abbreviated:false};}
  if(!summary)throw Error('圖片文字無法完整容納，請開啟全部候選完整圖片報告');
  size=min;probe.font=font(size);let short=text;
  while(short&&probe.measureText(short+'…｜詳見完整報告').width>width)short=[...short].slice(0,-1).join('');
  return {text:short+'…｜詳見完整報告',fullText:text,size,width,abbreviated:true};
 }
 const plans=rows.map((c,i)=>{
  const f=c.features||{},v=c.validation,loc=v.closeLocation,observed=run?.rows.find(r=>r.code===c.code),rsi=observed?.rsiExtended;
  const col=c.status==='CANDIDATE'?'#1f7a4f':c.status==='WATCH'?'#a66e1e':'#52647b';
  const event=c.event,kind=event?.kind==='OFFICIAL'?'官方訊號':event?.kind==='ESTIMATED'?'推估訊號':'訊號未驗證';
  const riskTexts=(c.reasons||[]).slice(1),riskText=riskTexts.length?riskTexts.join('；'):'本輪無額外量價警訊，仍須確認價格與成交條件';
  const boundary=v.invalidation,relation=boundary.status==='OK'?`${C.price(boundary.close)} ${boundary.relation} ${C.price(boundary.threshold)}`:'資料不足';
  const defense=boundary.status!=='OK'?'防守未驗證':boundary.breached?'已跌破防守':boundary.relation==='='?'接觸，未嚴格跌破':'未跌破防守';
  const cells=[
   ['量／前5日均量',`${fmt(f.volumeRatio5)} 倍`],
   ['量／前20日均量',`${fmt(f.volumeRatio20)} 倍`],
   ['距SMA20',`${fmt(f.gap20Pct)}%`],
   ['CMF20',fmt(f.cmf20)],
   ['日內收盤位置',loc.status==='OK'?loc.flat?'無日內區間':`${fmt(loc.position*100)}%`:'資料不足']
  ].map(([label,value])=>({label:fit(label,200,17,15),value:fit(value,200,25,18)}));
  const lines=[
   {key:'status',y:75,text:`${c.label}｜原圖：${original(c)}｜${monthly(c)}`,max:20,min:18,color:col},
   {key:'defense',y:178,text:`防守 ${C.price(c.levels?.invalidation)}｜${defense}（${relation}）｜壓力 ${C.price(c.levels?.pressure)}`,max:19,min:16,color:boundary.breached?'#b52a34':'#18334d'},
   {key:'context',y:205,text:`SMA20 ${fmt(f.ma20)}｜10日 ${fmt(f.return10Pct)}%｜日內中點 ${loc.status==='OK'?C.price(loc.midpoint):'未驗證'}${loc.status==='OK'?(loc.flat?'（高低相同）':loc.belowMidpoint?'（下半部）':'（非下半部）'):''}`,max:18,min:16,color:'#72530b'},
   {key:'rsi',y:229,text:`RSI5 ${fmt(rsi?.periods?.[5]?.value)}／10 ${fmt(rsi?.periods?.[10]?.value)}／14 ${fmt(rsi?.periods?.[14]?.value)}｜${kind} ${event?.date||'未驗證'}／距今${Number.isInteger(event?.age)?event.age:'未驗證'}根`,max:18,min:16,color:'#36516c'},
   {key:'risk',y:253,text:`警訊：${riskText}`,max:18,min:17,color:col,summary:true},
   {key:'source',y:277,text:`行情 ${v.date}｜${v.market}｜資料 ${v.id}｜調整口徑${v.basisVerified?'已驗證':'待確認'}${c.nameFallback?'｜股名待確認':''}`,max:15,min:13,color:'#52647b'}
  ].map(line=>({...line,...fit(line.text,1160,line.max,line.min,{summary:line.summary===true})}));
  return {code:c.code,rank:i+1,name:fit(`觀察 #${i+1} ${C.displayName(c.code,c)}（${c.code}）`,715,36,22),close:fit(`收盤 ${C.price(boundary.close)} 元`,435,32,22),col,cells,lines,top:CARD.y+i*CARD.step,bottom:CARD.y+i*CARD.step+CARD.height};
 });
 const scope=scan.fullMarketCertified?'完整市場認證':'部分驗證｜非全市場完整排名';
 const headings=[
  {text:'⑤ 餐廳擠不進去濾網｜前8強滿版總覽',x:30,y:58,width:1224,max:38,min:30,color:'#fff'},
  {text:`已處理 ${scan.attempted}/${scan.planned}｜本次候選 ${scan.candidates.length}｜本頁 ${rows.length}｜資料不足 ${scan.dataUnavailable??'待確認'}｜${scope}`,x:30,y:143,width:1224,max:20,min:17,color:'#fff4bb'},
  {text:'提醒：先看量價防守與警訊，再看量縮／CMF；原圖核對未驗證不算通過，排序非漲停機率。',x:30,y:183,width:1224,max:19,min:17,color:'#fff'}
 ].map(l=>({...l,...fit(l.text,l.width,l.max,l.min)}));
 const version=observer.wrapImageText(probe,`${scan.date}｜${root.ShitouReleaseV50?.displayCode||"V8.2.1"}`,1224,26);
 if(version.length>2)throw Error('版本資訊超出圖片安全區');
 const footers=[
  ['訊號日低點是量價防守線，嚴格跌破才失效；日SMA20不替代月20MA資格。',2622,21,'#fff'],
  [`全數核對：本頁 ${rows.length} 檔｜本次候選 ${scan.candidates.length} 檔｜${scope}`,2660,21,'#e9f5ff'],
  ['全部警訊、原圖六項核對與逐檔來源：另開「全部候選完整圖片報告」。',2700,19,'#fff3c2'],
  [`快照 ${scan.snapshotId}｜IPHONECARD.1｜條件與風險不是勝率，盤後名單不等於買點。`,2740,17,'#d4e5f5']
 ].map(([text,y,size,color])=>({...fit(text,1228,size,size-2),y,color}));
 const audit={model:'RESTAURANT_TOP8_OVERVIEW_1',layout:'IPHONE_CARD_1284X2778_1',reference:'STRONG_STOCK_CARD_GEOMETRY',strategyModel:C.MODEL,width:WIDTH,height:HEIGHT,fullBleed:true,count:rows.length,codes:rows.map(c=>c.code),date:scan.date,fullDetails:false,snapshotId:scan.snapshotId,release:scan.release,validations:rows.map(c=>c.validation),blocks:plans.map(p=>({code:p.code,rank:p.rank,top:p.top,bottom:p.bottom,cells:p.cells.map(c=>[c.label.text,c.value.text]),lines:p.lines})),headerBottom:210,footerTop:FOOTER,summaryAbbreviated:plans.filter(p=>p.lines.some(l=>l.abbreviated)).map(p=>p.code)};
 const text=['⑤ 餐廳擠不進去｜前8強滿版總覽',`行情 ${scan.date}｜版本 ${scan.release}｜快照 ${scan.snapshotId}`,...rows.flatMap((c,i)=>[`觀察序 #${i+1}`,...C.lines(c)]),'五格指標只呈現原策略數據，不另計條件分或改排序。'];
 function paintOverview(ctx){
  if(!ctx)throw Error('無法建立第五濾網圖片繪圖工具');
  ctx.textBaseline='alphabetic';ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,WIDTH,HEIGHT);
  const draw=(plan,x,y,color=plan.color||'#18334d',align='left')=>{ctx.font=font(plan.size);ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(plan.text,x,y);ctx.textAlign='left';};
  ctx.fillStyle='#123a5a';ctx.fillRect(0,0,WIDTH,210);headings.forEach(l=>draw(l,l.x,l.y));
  version.forEach((text,i)=>draw({text,size:26},30,96+i*30,'#e5f4ff'));
  plans.forEach(p=>{
   const x=CARD.x,y=p.top;ctx.fillStyle='#fff';ctx.fillRect(x,y,CARD.width,CARD.height);ctx.fillStyle=p.col;ctx.fillRect(x,y,8,CARD.height);
   draw(p.name,x+24,y+39);draw(p.close,x+CARD.width-24,y+39,'#b52a34','right');
   p.cells.forEach((cell,k)=>{const cx=x+22+k*238;ctx.fillStyle='#f3f7fa';ctx.fillRect(cx,y+87,224,63);draw(cell.label,cx+12,y+109,'#5c6d80');draw(cell.value,cx+12,y+140,p.col);});
   p.lines.forEach(l=>draw(l,x+25,y+l.y,l.color));
  });
  ctx.fillStyle='#123a5a';ctx.fillRect(0,FOOTER,WIDTH,HEIGHT-FOOTER);footers.forEach(l=>draw(l,28,l.y,l.color));
}
 // The preview descriptor is NOT a CanvasImageSource. Web Share needs a
 // drawable canvas region to encode a standalone JPEG before the user taps.
 return [{width:WIDTH,height:HEIGHT,dataset:{fullBleed:'true',iphoneFullScreen:'1284x2778',iphoneFullWidth:'1284',restaurantOverviewAudit:JSON.stringify(audit),reportText:encodeURIComponent(JSON.stringify(text))},renderExportRegion({top=0,height=HEIGHT,scale=1}={}){
  if(!(Number.isFinite(top)&&Number.isFinite(height)&&Number.isFinite(scale))||top<0||height<=0||scale<=0||top+height>HEIGHT)throw Error('分享區段尺寸無效');
  const tile=document.createElement('canvas');tile.width=Math.max(1,Math.floor(WIDTH*scale));tile.height=Math.max(1,Math.floor(height*scale));
  const ctx=tile.getContext('2d');if(!ctx)throw Error('無法建立手機分享畫布');
  ctx.setTransform(scale,0,0,scale,0,-top*scale);paintOverview(ctx);return tile;
 },
 toBlob(callback,type='image/png'){
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
  if(/iPhone|iPad|iPod|Android/i.test(root.navigator?.userAgent||'')&&root.ShitouMobilePng5329)root.ShitouMobilePng5329.install(canvas,[],'#eef3f8');
  try{paintOverview(canvas.getContext('2d'));canvas.toBlob(blob=>{canvas.width=canvas.height=1;callback(blob);},type);}
  catch(error){canvas.width=canvas.height=1;callback(null);}
 } }];
}
function pages(scan,options={}){return options.limit==='all'?fullPages(scan,options):overview(scan,options);}
async function preview(scan,all=false){if(!scan?.candidates?.length)throw Error('目前沒有候選可產圖');if(document.fonts?.ready)await document.fonts.ready;const out=pages(scan,{limit:all?'all':8});if(!root.strongStockShowPagesV47)throw Error('完整圖片預覽工具未載入');return root.strongStockShowPagesV47(out,{title:all?'⑤ 餐廳擠不進去｜逐檔完整明細':'⑤ 餐廳擠不進去｜前8強滿版卡片',prefix:(all?'RESTAURANT_FULL_':'RESTAURANT_TOP8_')+(root.ShitouReleaseV50?.fileVersion||C.MODEL),date:scan.date,kind:'restaurant',note:all?'全部候選逐檔完整分頁｜請下載完整ZIP保留全部頁面':'iPhone 12 Pro Max 1284×2778 單張滿版｜前8檔依原排序；全部警訊與核對明細請另開完整圖片報告'});}
root.ShitouRestaurantReport=Object.freeze({pages,fullPages,overview,preview});
})(globalThis);
