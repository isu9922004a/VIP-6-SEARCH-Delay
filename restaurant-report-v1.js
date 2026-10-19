(function(root){'use strict';
const C=root.ShitouRestaurantCore;
function fullPages(scan,{limit='all',watermark=false}={}){
 const observer=root.ShitouIndicatorShadow;if(!observer?.imagePage)throw Error('動能量價圖片模組未載入');
 const observationRun=observer.capture('RESTAURANT',scan);
 const rows=scan.candidates.slice(0,limit==='all'?scan.candidates.length:limit),probe=document.createElement('canvas').getContext('2d'),plans=[];
 probe.font='700 42px "Microsoft JhengHei","Noto Sans TC",sans-serif';
 const wrap=s=>observer.wrapImageText(probe,s);
 rows.forEach((row,index)=>{const observation=observationRun?.rows.find(r=>r.code===row.code),extra=observation?[...root.ShitouIndicatorShadow.core.lines(observation.evidence),...root.ShitouIndicatorShadow.rowContext(observation)]:['多週期情境尚未建立；請重新掃描，不補猜'];const text=[`觀察序 #${index+1}`,...C.lines(row),...extra,`掃描 ${scan.attempted}/${scan.planned}｜${scan.fullMarketCertified?'完整市場資料認證':'非全市場完整排名'}｜原圖完整符合 ${scan.sourceVerifiedMatches} 檔`],lines=text.flatMap(wrap);for(let at=0;at<lines.length;at+=32)plans.push({row,index,lines:lines.slice(at,at+32)});});
 return plans.map((p,i)=>({width:1284,height:2778,dataset:{restaurantAudit:JSON.stringify({model:C.MODEL,code:p.row.code,page:i+1,total:plans.length,lines:p.lines.length,rank:p.index+1,sourceMatch:p.row.sourceMatch,lazy:true}),reportText:encodeURIComponent(JSON.stringify(p.lines))},toBlob(callback,type='image/png'){
  const canvas=observer.imagePage({strategy:'RESTAURANT',date:scan.date},[{code:p.row.code}],p.index,i+1,plans.length,p.lines);if(watermark&&root.applyAntiTheftWatermarkV3761)root.applyAntiTheftWatermarkV3761(canvas,'all');canvas.toBlob(blob=>{canvas.width=canvas.height=0;callback(blob);},type);
 }}));
}
// Presentation only: preserve the candidate array and its original order.
// One overview is distinct from the complete, paginated evidence report.
function overview(scan,{watermark=false}={}){
 const observer=root.ShitouIndicatorShadow;
 if(!observer?.wrapImageText)throw Error('圖片文字模組未載入');
 const rows=scan?.candidates?.slice(0,8)||[];
 if(!rows.length)throw Error('目前沒有候選可產圖');
 const run=observer.capture('RESTAURANT',scan),probe=document.createElement('canvas').getContext('2d');
 const font=(size,bold=false)=>`${bold?700:500} ${size}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;
 const fmt=v=>C.number(v)===null?'未驗證':Number(v).toFixed(2);
 const monthly=c=>c.monthlyStatus==='PASS'?'月線通過':c.monthlyStatus==='NOT_PASS'?'月線未通過':'月線未驗證';
 const blocks=rows.map((c,i)=>{
  const f=c.features||{},x=run?.rows.find(r=>r.code===c.code)?.rsiExtended;
  const spec=[];
  const add=(text,size=30,color='#36516c',bold=false,width=1140)=>{
   probe.font=font(size,bold);
   const lines=observer.wrapImageText(probe,text,width,size);
   spec.push({text,lines,size,color,bold,height:lines.length*(size+4)});
  };
  add(`#${i+1}  ${C.displayName(c.code,c)}（${c.code}）`,40,'#18354f',true,720);
  const name=spec.pop();
  add(`量價失效：收盤 < ${fmt(c.levels?.invalidation)}　｜　壓力 ${fmt(c.levels?.pressure)}`,36,'#963d25',true);
  add(`SMA20 ${fmt(f.ma20)}　｜　乖離 ${fmt(f.gap20Pct)}%　｜　10日 ${fmt(f.return10Pct)}%`);
  add(`量／前5均量 ${fmt(f.volumeRatio5)}　｜　量／前20均量 ${fmt(f.volumeRatio20)}　｜　CMF20 ${fmt(f.cmf20)}`);
  add(`共用 RSI5 ${fmt(x?.periods?.[5]?.value)}　｜　RSI10 ${fmt(x?.periods?.[10]?.value)}　｜　RSI14 ${fmt(x?.periods?.[14]?.value)}`);
  const event=c.event,kind=event?.kind==='OFFICIAL'?'官方漲停':event?.kind==='ESTIMATED'?'推估漲停':'訊號未驗證';
  add(`${kind} ${event?.date||'未驗證'}／距今${Number.isInteger(event?.age)?event.age:'未驗證'}根　｜　${monthly(c)}`,28);
  const risks=(c.reasons||[]).slice(1),risk=risks.length?risks.join('；'):Array.isArray(c.riskCodes)&&!c.riskCodes.length?'本輪無額外量價警訊，仍須確認價格與成交條件':'量價警訊請核對完整明細';
  add(`${c.label||'狀態未驗證'}｜${risk}`,28,c.status==='CANDIDATE'?'#17634f':'#915b0a',true);
  if(c.nameFallback)add('繁中名稱未驗證，暫以股票代號識別',28);
  const close=`收盤 ${fmt(c.report?.close)}`;probe.font=font(40,true);
  const closeLines=observer.wrapImageText(probe,close,430,40),headingHeight=Math.max(name.height,closeLines.length*44);
  const height=Math.max(280,24+headingHeight+6+spec.reduce((n,s)=>n+s.height,0));
  return {code:c.code,rank:i+1,name,close,closeLines,headingHeight,spec,height};
 });
 const header=206,gap=8,footer=156,total=header+blocks.reduce((n,b)=>n+b.height+gap,0)+footer,height=Math.max(2778,total);
 const audit={model:'RESTAURANT_TOP8_OVERVIEW_1',strategyModel:C.MODEL,count:rows.length,codes:rows.map(r=>r.code),date:scan.date,width:1284,height,fullDetails:false,noOverlap:true,blocks:[]};
 let at=header;for(const b of blocks){audit.blocks.push({code:b.code,rank:b.rank,top:at,bottom:at+b.height});at+=b.height+gap;}
 const text=['⑤ 餐廳擠不進去｜前8強重點總覽',`行情 ${scan.date}｜實列 ${rows.length} 檔｜依原觀察序`,...blocks.flatMap(b=>[b.name.text,b.close,...b.spec.map(s=>s.text)]),'原圖六項核對逐檔見明細；總覽不代表原條件通過。','關鍵點位採原策略；完整條件、RSI情境及資料核對請看完整明細。'];
 return [{width:1284,height,dataset:{...(height===2778?{iphoneFullScreen:'1284x2778'}:{}),restaurantOverviewAudit:JSON.stringify(audit),reportText:encodeURIComponent(JSON.stringify(text))},toBlob(callback,type='image/png'){
  const canvas=document.createElement('canvas');canvas.width=1284;canvas.height=height;const ctx=canvas.getContext('2d');
  const draw=(t,x,y,size,color,bold=false)=>{ctx.font=font(size,bold);ctx.fillStyle=color;ctx.fillText(t,x,y);};
  ctx.textBaseline='top';ctx.fillStyle='#edf3f8';ctx.fillRect(0,0,1284,height);ctx.fillStyle='#163c58';ctx.fillRect(0,0,1284,190);
  draw('⑤ 餐廳擠不進去｜前8強重點總覽',30,24,46,'#ffffff',true);
  draw(`行情 ${scan.date||'未驗證'}　｜　實列 ${rows.length} 檔　｜　依原觀察序，非上漲機率`,30,91,30,'#d4e5f5');
  draw(scan.fullMarketCertified?'完整市場資料認證｜完整條件另見明細':'部分範圍／資料未全驗證｜非全市場完整排名',30,138,30,'#ffe5a3');
  blocks.forEach((b,i)=>{
   const top=audit.blocks[i].top;ctx.fillStyle='#ffffff';ctx.fillRect(24,top,1236,b.height);ctx.fillStyle='#b68822';ctx.fillRect(24,top,8,b.height);
   let y=top+12;b.name.lines.forEach(line=>{draw(line,48,y,40,'#18354f',true);y+=44;});
   ctx.font=font(40,true);b.closeLines.forEach((line,j)=>draw(line,1230-ctx.measureText(line).width,top+12+j*44,40,'#d43045',true));
   y=top+12+b.headingHeight+6;
   b.spec.forEach((s,j)=>{if(j===0){ctx.fillStyle='#fff4df';ctx.fillRect(44,y-2,1194,s.height);}s.lines.forEach(line=>{draw(line,48,y,s.size,s.color,s.bold);y+=s.size+4;});});
  });
  const foot=height-footer;ctx.fillStyle='#163c58';ctx.fillRect(0,foot,1284,footer);
  draw('量價失效採訊號日低點；SMA20不替代月20MA資格。',30,foot+16,30,'#ffffff',true);
  draw('原圖六項核對逐檔見明細；推估漲停／主力／JMA不冒稱通過。',30,foot+59,28,'#ffe5a3');
  draw('關鍵總覽｜完整RSI、風險與核對：另開「全部候選完整圖片報告」',30,foot+100,28,'#d4e5f5');
  if(watermark&&root.applyAntiTheftWatermarkV3761)root.applyAntiTheftWatermarkV3761(canvas,'all');
  canvas.toBlob(blob=>{canvas.width=canvas.height=0;callback(blob);},type);
 }}];
}
function pages(scan,options={}){return options.limit==='all'?fullPages(scan,options):overview(scan,options);}
async function preview(scan,all=false){if(!scan?.candidates?.length)throw Error('目前沒有候選可產圖');if(document.fonts?.ready)await document.fonts.ready;const out=pages(scan,{limit:all?'all':8});if(!root.strongStockShowPagesV47)throw Error('完整圖片預覽工具未載入');return root.strongStockShowPagesV47(out,{title:all?'⑤ 餐廳擠不進去｜逐檔完整明細':'⑤ 餐廳擠不進去｜前8強單張總覽',prefix:(all?'RESTAURANT_FULL_':'RESTAURANT_TOP8_')+(root.ShitouReleaseV50?.code||C.MODEL),date:scan.date,kind:'restaurant',note:all?'全部候選逐檔完整分頁｜請下載完整ZIP保留全部頁面':'前8檔集中一張，少於8檔依實際顯示｜重點總覽不含完整核對明細；請另開全部候選完整圖片報告'});}
root.ShitouRestaurantReport=Object.freeze({pages,fullPages,overview,preview});
})(globalThis);
