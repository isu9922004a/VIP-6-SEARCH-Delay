/* Presentation only: consume the completed V9.7 ranking, never score or fetch stocks. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./main-force-lifeline-core-v97.js'):root.ShitouMainForceLife97,node?require('./research-chart-layout-v921.js'):root.ShitouChartLayout921);if(node)module.exports=api;else root.ShitouCostRanking971=api;})(globalThis,function(E,L){
'use strict';
const RELEASE='V9.7.1',W=1284,H=2778,M=64,CW=W-M*2,BOTTOM=2528;
const C={bg:'#0B2032',card:'#102E43',edge:'#345267',text:'#EDF6FF',muted:'#B8CBE2',gold:'#FFD76A',mint:'#8FF5D3',risk:'#FF8C93'};
const finite=n=>typeof n==='number'&&Number.isFinite(n),fmt=n=>finite(n)?n.toFixed(2):'資料不足';
const asOfText=value=>String(value??'資料不足').replace(/今天(?=形成多方 K0|收盤剛形成|剛形成生命線|有新生 K0|成交金額|成交量|的成交量|剛完成的多方 K0|為什麼入選|是哪四根|的生命線|主要關卡|最重要)/g,'本交易日').replace(/明天(?=先注意|可以觀察什麼)/g,'下一個交易日');
const formatStockText=(r,value)=>String(value)===r.name||String(value).startsWith(r.name+'（'+r.code+'）')?String(value):asOfText(value);
function distance(record){return record.distancePct===0?'收盤價等於生命線':'收盤價比生命線'+(record.distancePct<0?'低 ':'高 ')+fmt(Math.abs(record.distancePct))+'%';}
function stock(record){
 const r=record;
 return {code:r.code,name:r.name,date:r.date,eventId:r.eventId,snapshotId:r.proof?.snapshotId||null,close:r.close,lifeLinePrice:r.lifeLinePrice,distancePct:r.distancePct,grade:r.grade,score:r.score,trend:({STRONG:'目前偏強',WEAK:'目前偏弱',NEUTRAL:'目前還在整理，方向尚未確認'})[r.indicators?.state]||'方向資料不足',risk:r.riskLabel||'資料不足，無法評估',mainRisk:r.risks?.[0]||r.missing?.[0]||r.excluded?.[0]||null,conclusion:r.formalCandidate?'本交易日剛形成多方 K0，通過目前研究門檻；接下來仍要看收盤能否守住。':asOfText(r.conclusion).replace(/，這不是買進指令。$/,'。'),distanceText:distance(r)};
}
function model(snapshot){
 const s=snapshot,c=s?.counts;
 if(!s?.completed||s.stopped||!c||c.unfinished!==0||c.parsed!==c.total)throw Error('掃描尚未完成，不能產生正式 TOP 8 報告');
 if(!/^\d{4}-\d\d-\d\d$/.test(s.date||'')||!s.snapshotId)throw Error('缺少完成交易日或掃描快照識別');
 if(!Array.isArray(s.records)||s.records.length!==c.total||!Array.isArray(s.top8))throw Error('排名母體與掃描統計不一致');
 const canonical=E.summarize(s.records,{total:c.total,date:s.date,snapshotId:s.snapshotId});
 if(Object.keys(canonical.counts).some(k=>c[k]!==canonical.counts[k]))throw Error('掃描統計與原始結果不一致');
 if(c.formal!==canonical.counts.formal||c.newborn!==canonical.counts.newborn||c.top8!==s.top8.length||canonical.top8.length!==s.top8.length||canonical.top8.some((r,i)=>r!==s.top8[i]&&JSON.stringify(stock(r))!==JSON.stringify(stock(s.top8[i]))))throw Error('排行榜與 V9.7 正式排序不一致');
 const ids=new Set();
 const rows=s.top8.map((r,index)=>{
  const bars=r.raw?.dailySeries||r.raw?.sourceBars;
  if(r.kind!=='NEWBORN'||!r.formalCandidate||!r.qualified||!['A','B'].includes(r.grade)||r.missing?.length||r.excluded?.length||r.risks?.length||r.date!==s.date||r.proof?.snapshotId!==s.snapshotId||r.eventId!==r.seed?.eventId||r.eventId!==r.event?.eventId||r.seed?.side!=='BULL'||r.seed?.k0Date!==s.date||r.event?.k0Date!==s.date||r.seed?.k0Index!==bars?.length-1||bars?.at(-1)?.date!==s.date||bars?.at(-1)?.close!==r.close||r.event?.lifeLinePrice!==r.lifeLinePrice||!['close','lifeLinePrice','distancePct','score'].every(k=>finite(r[k]))||r.close<=0||r.lifeLinePrice<=0||ids.has(r.eventId))throw Error('排名個股的資格、日期或生命線證據不一致：'+(r.code||'未提供'));
  if(String(r.raw.stock||r.raw.code)!==r.code||r.raw.closeDate!==s.date||r.seed.k3Date!==bars[r.seed.k3Index]?.date||bars[r.seed.k3Index]?.low!==r.lifeLinePrice||r.score<0||r.score>100)throw Error('股票、分數或 K3 原始價位不一致：'+r.code);
  ids.add(r.eventId);return {rank:index+1,...stock(r)};
 });
 const covered=s.fullMarketCertified===true&&c.insufficient===0&&c.serviceFailed===0;
 return {release:RELEASE,strategy:E.ID,date:s.date,snapshotId:s.snapshotId,counts:{...c},rows,fullMarketCertified:covered,coverage:covered?'本次全市場母體已完成核驗。':'排名僅代表已成功核驗的範圍，非完整全市場排名。',source:'交易所完成日 K／官方商品與產業主檔',performanceValidated:false};
}
function pages(snapshot,{document:doc=globalThis.document}={}){
 const data=model(snapshot);if(!doc?.createElement)throw Error('瀏覽器尚未提供圖片畫布');const probe=doc.createElement('canvas'),q=probe.getContext('2d');if(!q)throw Error('瀏覽器無法建立圖片畫布');
 const plans=[];let plan,y;
 function text(value,x,top,width,size,color=C.text,weight=600){const rows=L.wrap(q,value,width,size),height=rows.length*(size+12);plan.ops.push({kind:'text',rows,x,y:top,width,size,color,weight,height});return height;}
 function start(){plan={ops:[],ranks:[],boxes:[]};plans.push(plan);y=48;y+=text('石頭少爺 '+RELEASE+'｜主力生命線成本',M,y,CW,40,C.text,750)+20;y+=text('盤後 K0｜前八強研究排行榜',M,y,CW,50,C.text,800)+20;y+=text(data.date+' 盤後結果',M,y,CW,46,C.gold,750)+16;y+=text('新生 K0 '+data.counts.newborn+' 檔　正式候選 '+data.counts.formal+' 檔　實列 '+data.rows.length+' 名',M,y,CW,34,C.muted)+14;y+=text(data.coverage,M,y,CW,32,data.fullMarketCertified?C.muted:C.risk)+24;}
 start();
 for(const r of data.rows){
  const specs=[['TOP '+r.rank+'　'+r.name+'（'+r.code+'）',60,C.text,800],['收盤 '+fmt(r.close)+' 元',68,C.gold,800],['K3 生命線 '+fmt(r.lifeLinePrice)+' 元',50,C.mint,750],[r.distanceText,40,C.text,650],[r.grade+' 級研究　'+fmt(r.score)+'／100 分',38,C.muted,600],[r.trend,38,C.text,650],[r.risk+(r.mainRisk?'｜'+r.mainRisk:''),38,C.risk,650],[r.conclusion,38,C.text,600]];
  const lines=specs.flatMap(([value,size,color,weight])=>L.wrap(q,value,CW-48,size).map(value=>({value,size,color,weight,height:size+12})));
  let offset=0,part=0;while(offset<lines.length){
   const remaining=lines.slice(offset).reduce((n,v)=>n+v.height,0)+48;
   if(y+remaining>BOTTOM&&plan.ranks.length&&remaining<=BOTTOM-520)start();
   if(BOTTOM-y<200)start();const top=y;let bodyY=y+22;
   if(part)bodyY+=text('TOP '+r.rank+'（續）',M+24,bodyY,CW-48,34,C.gold,750)+8;
   const index=plan.ops.length;let printed=0;
   while(offset<lines.length&&bodyY+lines[offset].height+22<=BOTTOM){const v=lines[offset++];bodyY+=text(v.value,M+24,bodyY,CW-48,v.size,v.color,v.weight);printed++;}
   if(!printed)throw Error('排名圖片內容無法排入頁面');
   const box={kind:'box',x:M,y:top,width:CW,height:bodyY-top+22};plan.ops.splice(part?index-1:index,0,box);plan.boxes.push({...box,rank:r.rank,eventId:r.eventId});if(!plan.ranks.includes(r.rank))plan.ranks.push(r.rank);y=bodyY+44;part++;if(offset<lines.length)start();
  }
 }
 if(!data.rows.length)text('本交易日沒有符合目前條件的股票。',M,y,CW,48,C.text,750);
 const count=plans.length;
 const result=plans.map((p,index)=>{
  const audit={version:'COST_TOP8_REPORT_V971',release:RELEASE,width:W,height:H,page:index+1,pages:count,title:'TOP 8｜'+(p.ranks.length?'第 '+p.ranks.join('、')+' 名':'本交易日無正式候選'),model:data,ranks:p.ranks,boxes:p.boxes,text:p.ops.filter(o=>o.kind==='text').map(o=>({value:o.rows.join('\n'),x:o.x,y:o.y,width:o.width,height:o.height,size:o.size})),researchOnly:true,performanceValidated:false};
  const filename='石頭少爺_'+RELEASE+'_TOP8_'+data.date.replaceAll('-','')+'_P'+String(index+1).padStart(2,'0')+'_排行榜.png';
  const dataset={life94Audit:JSON.stringify(audit),costRank971Audit:JSON.stringify(audit),fullBleed:'true',shareAsSingleImage:'true',iphoneFullScreen:'1284x2778',release:RELEASE,filename};
  function paint(){const canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');if(!ctx)throw Error('無法建立排行榜圖片');ctx.textBaseline='top';ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);for(const o of p.ops){if(o.kind==='box'){ctx.fillStyle=C.card;ctx.strokeStyle=C.edge;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(o.x,o.y,o.width,o.height,22);ctx.fill();ctx.stroke();}else{L.font(ctx,o.size,o.weight);ctx.fillStyle=o.color;o.rows.forEach((r,i)=>ctx.fillText(r,o.x,o.y+i*(o.size+12)));}}
   L.font(ctx,30);ctx.fillStyle=C.muted;ctx.fillText('研究參考，非買賣建議；生命線不代表主力真實持股成本。',M,2600);ctx.fillText('第 '+(index+1)+'／'+count+' 頁｜研究分數不是上漲機率',M,2650);L.font(ctx,28);ctx.fillText('來源：'+data.source,M,2700);Object.assign(canvas.dataset,dataset);return canvas;}
  return {width:W,height:H,dataset,filename,title:audit.title,renderExportRegion:paint,toBlob(callback,type='image/png',quality){const c=paint();c.toBlob(b=>{c.width=c.height=1;callback(b);},type,quality);}};
 });probe.width=probe.height=1;return result;
}
return Object.freeze({RELEASE,fmt,asOfText,formatStockText,distance,stock,model,pages});
});
