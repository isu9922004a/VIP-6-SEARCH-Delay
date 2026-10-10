/* V50 R5.3.2.5.6.3.1: image-report layout consistency fix; stock logic is unchanged. */
(function(){
'use strict';

const RELEASE=window.R45_RELEASE_LABEL||'石頭少爺 Agent V50 正式版｜R5.3.2.7｜三盤量價與個股報告優化版';
const FILE_VERSION=window.R45_FILE_VERSION||'V50_R5.3.2.5.6.3.1_圖片統一排版完整版';
const E=window.ShitouTechnicalEvidenceR45;
const DETAIL={width:1284,height:2778,top:92,bottom:70,side:22};
const IPHONE_12_PRO_MAX={width:1284,height:2778,minReadableScale:.90};
const SUMMARY={width:1284,height:2778,top:188,bottom:74,side:44};
const original={
  show:window.showInfographicPreviewV3328,
  stockGenerator:window.generateStockImageByModeV51,
  marketRender:window.renderMarketInfographicV3328,
  momentumRender:window.renderMomentumScanInfographicV3762,
  daytradeRender:window.renderDayTradeInfographicV1,
  watermark:window.applyAntiTheftWatermarkV3761
};
let previewSet=null;
let previewUrl=null;

function canvas(width,height,fill='#f3f6fa'){
  const out=document.createElement('canvas');out.width=width;out.height=height;
  const context=out.getContext('2d');context.fillStyle=fill;context.fillRect(0,0,width,height);
  context.imageSmoothingEnabled=true;if('imageSmoothingQuality' in context)context.imageSmoothingQuality='high';
  return out;
}

function blob(source){
  return new Promise((resolve,reject)=>{
    try{source.toBlob(value=>value?resolve(value):reject(new Error('PNG轉換失敗')),'image/png');}
    catch(error){reject(error);}
  });
}

function download(value,name){
  const url=URL.createObjectURL(value),anchor=document.createElement('a');anchor.href=url;anchor.download=name;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);
}

function u16(value){return [value&255,(value>>>8)&255];}
function u32(value){return [value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255];}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(entries){
  const encoder=new TextEncoder(),chunks=[],central=[];let offset=0;
  for(const entry of entries){
    const name=encoder.encode(entry.name),size=entry.bytes.length,crc=crc32(entry.bytes);
    const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(size),...u32(size),...u16(name.length),...u16(0),...name]);
    chunks.push(local,entry.bytes);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(size),...u32(size),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]));
    offset+=local.length+size;
  }
  let centralSize=0;for(const part of central){centralSize+=part.length;chunks.push(part);}
  chunks.push(new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(offset),...u16(0)]));
  return new Blob(chunks,{type:'application/zip'});
}

function safeName(value){
  const base=typeof window.sanitizeFilenameV3328==='function'?window.sanitizeFilenameV3328(value):String(value||'報告').replace(/[\\/:*?"<>|]+/g,'_');
  return base
    .replace(/R5\.3\.2\.4\.13-R4\.4[^.\s]*/g,'R5.3.2.4.30-R4.9.5')
    .replace(/V47_R5\.3\.2\.4\.19-R4\.5_[^.]*/g,FILE_VERSION)
    .replace(/V49_R5\.3\.2\.4\.28-R4\.9\.3_[^.]*/g,FILE_VERSION);
}

function dateOf(value){return String(value||'').replace(/\D/g,'').slice(0,8)||'latest';}
function reportDate(report){return report?.closeDate||report?.dataDate||null;}

function fitText(context,text,x,y,width,{max=30,min=14,weight=800,color='#17324d',align='left'}={}){
  context.textAlign=align;context.textBaseline='alphabetic';context.fillStyle=color;
  for(let size=max;size>=min;size--){
    context.font=`${weight} ${size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
    if(context.measureText(String(text||'')).width<=width){context.fillText(String(text||''),x,y);return size;}
  }
  context.font=`${weight} ${min}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
  context.fillText(String(text||''),x,y);return min;
}

function wrapLines(context,text,width,size=22,weight=750){
  context.font=`${weight} ${size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
  const parts=typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter('zh-TW',{granularity:'grapheme'}).segment(String(text||''))].map(item=>item.segment):Array.from(String(text||''));
  const lines=[];let line='';
  for(const part of parts){
    if(part==='\n'){lines.push(line);line='';continue;}
    const test=line+part;
    if(line&&context.measureText(test).width>width){lines.push(line);line=part;}else line=test;
  }
  if(line||!lines.length)lines.push(line);return lines;
}

function rounded(context,x,y,width,height,radius,fill,stroke='#d1dbe7'){
  context.beginPath();context.roundRect(x,y,width,height,radius);context.fillStyle=fill;context.fill();
  if(stroke){context.strokeStyle=stroke;context.lineWidth=2;context.stroke();}
}

function copyCanvas(source,height=source.height){
  const out=canvas(source.width,height);out.getContext('2d').drawImage(source,0,0,source.width,height,0,0,source.width,height);
  for(const [key,value] of Object.entries(source.dataset||{}))out.dataset[key]=value;
  return out;
}

function removeScanIndustryAppend(source,scan){
  if(!source||!scan?.industryContext||source.height<=165)return source;
  return copyCanvas(source,source.height-165);
}

function evidenceFor(candidate,kind){
  const report=candidate?.report||candidate||{};
  const evidence=E?E.analyze(report,{kind}):null;
  const phase=E?E.existingPhase({...report,stageSafety:candidate?.stageSafety,stage:candidate?.stage}):{label:'階段待確認'};
  return {report,evidence,phase};
}

function evidenceLines(candidate,kind){
  const {report,evidence,phase}=evidenceFor(candidate,kind);
  const values=evidence?.ema?.values||{};
  const value=period=>values[period]?.available?E.price(values[period].value):'資料不足';
  const rsi=evidence?.rsi5?.available?`${E.price(evidence.rsi5.value,2)}（${evidence.rsi5.date||'日期未提供'}）`:'資料不足';
  const kd=evidence?.kd?.available?`K ${E.price(evidence.kd.k,1)}／D ${E.price(evidence.kd.d,1)}｜${evidence.kd.cross}`:'資料不足';
  return [
    `${candidateName(candidate)}（${report?.stock||report?.code||'-'}）｜最新收盤 ${Number.isFinite(Number(report?.close??candidate?.close))?E.price(report?.close??candidate?.close):'資料不足'}｜日RSI 5T ${rsi}`,
    `行情階段：${phase?.label||'階段待確認'}｜EMA21 ${value(21)}｜EMA50 ${value(50)}｜EMA200 ${value(200)}`,
    `KD(9,3,3)：${kd}｜${evidence?.available?`技術資料日 ${evidence.dataQuality.dataDate}`:'日K資料不足'}｜補充證據不計分、不改資格`
  ];
}

function appendEvidence(source,candidates,kind,title,{compact=false}={}){
  const rows=(candidates||[]).map(candidate=>evidenceLines(candidate,kind));
  if(!rows.length)return source;
  const pad=32,titleH=compact?60:78,rowH=compact?105:126,footer=compact?26:38,extra=titleH+rows.length*rowH+footer;
  const out=canvas(source.width,source.height+extra,'#eef3f8'),context=out.getContext('2d');context.drawImage(source,0,0);
  const y0=source.height;context.fillStyle='#eef3f8';context.fillRect(0,y0,source.width,extra);
  context.fillStyle='#123a5a';context.fillRect(0,y0,source.width,titleH);
  fitText(context,`${title}｜EMA／KD與日RSI 5T補充證據`,pad,y0+(compact?39:48),source.width-pad*2,{max:compact?25:28,min:18,weight:950,color:'#fff'});
  rows.forEach((lines,index)=>{
    const y=y0+titleH+index*rowH+(compact?5:8);rounded(context,pad,y,source.width-pad*2,rowH-(compact?10:14),13,'#fff');
    fitText(context,lines[0],pad+18,y+(compact?25:31),source.width-pad*2-36,{max:compact?19:20,min:13,weight:950,color:'#142f4c'});
    fitText(context,lines[1],pad+18,y+(compact?53:65),source.width-pad*2-36,{max:compact?17:18,min:12,weight:850,color:'#314f6c'});
    fitText(context,lines[2],pad+18,y+(compact?80:96),source.width-pad*2-36,{max:compact?15:16,min:11,weight:800,color:'#5a687a'});
  });
  fitText(context,'研究候選補充層｜資料不足明示，不改原始策略。',pad,out.height-(compact?8:15),source.width-pad*2,{max:compact?12:14,min:10,weight:800,color:'#69788b'});
  return out;
}

function prepareStockBaseForIphone(source){
  // 新手十秒決策圖已是完整 1284×2778 成品；不可再依舊版 snrAudit 切除任何區段。
  if(source?.dataset?.v50NewbieFirst==='true')return copyCanvas(source);
  const assistantHeight=Math.max(0,Number(source?.dataset?.r45AssistantAppendHeight)||0);
  const sourceAudit=readLayoutAudit(source),alreadyIphoneFull=source?.dataset?.iphoneFullScreen==='1284x2778'||sourceAudit?.iphoneFullScreen?.noCrop===true;
  const originalFooterHeight=source?.dataset?.reportMode&&!alreadyIphoneFull?138:0;
  const targetHeight=Math.max(1,source.height-assistantHeight-originalFooterHeight);
  let out=copyCanvas(source,targetHeight);
  out.dataset.r45RemovedAssistantHeight=String(assistantHeight);
  out.dataset.r45RemovedOriginalFooterHeight=String(originalFooterHeight);
  if(source?.dataset?.reportMode==='professional'&&source?.dataset?.snrAudit){
    try{
      const audit=JSON.parse(decodeURIComponent(source.dataset.snrAudit)),layout=audit?.layoutAudit;
      const insertHeight=Math.max(0,Number(layout?.insertH)||0),cutY=Math.max(0,Math.round(Number(layout?.cutY)||0));
      const stageCards=readLayoutAudit(source)?.stageCards||[];
      const stageHeight=stageCards.reduce((sum,card)=>Number(card?.insertY)<cutY?sum+Math.max(0,Number(card?.height)||0):sum,0);
      const panelStart=cutY+stageHeight;
      if(insertHeight>0&&panelStart+insertHeight<=out.height){
        const compact=canvas(out.width,out.height-insertHeight,'#eef3f8'),context=compact.getContext('2d');
        context.drawImage(out,0,0,out.width,panelStart,0,0,out.width,panelStart);
        context.drawImage(out,0,panelStart+insertHeight,out.width,out.height-panelStart-insertHeight,0,panelStart,out.width,out.height-panelStart-insertHeight);
        for(const [key,value] of Object.entries(out.dataset||{}))compact.dataset[key]=value;
        compact.dataset.r45RemovedProfessionalSupplement=`snr-panel:${insertHeight}`;
        out=compact;
      }
    }catch(_){out.dataset.r45RemovedProfessionalSupplement='audit-invalid';}
  }
  return out;
}

function insertV50CompactEvidenceRow(source,report,evidence,profile){
  const audit=readLayoutAudit(source)||{},iphone=audit.iphoneFullScreen||{},cards=Array.isArray(audit.stageCards)?audit.stageCards:[];
  const decisionCard=cards.find(card=>/新手先看|適不適合買/.test(String(card?.title||'')))||cards.at(-1)||null;
  const scale=Number.isFinite(Number(iphone.scale))?Number(iphone.scale):1,offsetY=Number.isFinite(Number(iphone.offsetY))?Number(iphone.offsetY):0;
  const rawBottom=decisionCard?Number(decisionCard.cardBottom??(Number(decisionCard.insertY)+Number(decisionCard.height))):NaN;
  const estimatedBottom=Number.isFinite(rawBottom)?Math.round(offsetY+rawBottom*scale):Math.round(source.height*.17);
  const insertY=Math.max(170,Math.min(source.height-242,estimatedBottom+10)),rowHeight=228;
  const out=canvas(source.width,source.height+rowHeight,'#eef3f8'),context=out.getContext('2d');
  context.drawImage(source,0,0,source.width,insertY,0,0,source.width,insertY);
  context.fillStyle='#eef3f8';context.fillRect(0,insertY,source.width,rowHeight);
  context.drawImage(source,0,insertY,source.width,source.height-insertY,0,insertY+rowHeight,source.width,source.height-insertY);
  const margin=36,gap=18,cardY=insertY+12,cardH=rowHeight-24,cardW=(source.width-margin*2-gap)/2;
  const p=profile||{},price=value=>Number.isFinite(Number(value))?(E?E.price(value):Number(value).toFixed(2)):'資料不足';
  const zone=p.status==='pass'?`${price(p.pocLower)}～${price(p.pocUpper)}`:(p.label||'資料不足');
  const values=evidence?.ema?.values||{},ema=period=>values[period]?.available?price(values[period].value):'資料不足';
  const rsi=evidence?.rsi5?.available?`${price(evidence.rsi5.value)}（${evidence.rsi5.date||'日期未提供'}）`:'資料不足';
  rounded(context,margin,cardY,cardW,cardH,14,'#f8fbff','#8da3ba');context.fillStyle='#27648a';context.fillRect(margin,cardY,8,cardH);
  fitText(context,`📍 主要成交密集區 ${zone}`,margin+22,cardY+37,cardW-42,{max:22,min:15,weight:950,color:'#153a67'});
  fitText(context,`日RSI 5T ${rsi}`,margin+22,cardY+76,cardW-42,{max:18,min:12,weight:900,color:'#314f6c'});
  fitText(context,`EMA21 ${ema(21)}｜EMA50 ${ema(50)}｜EMA200 ${ema(200)}`,margin+22,cardY+111,cardW-42,{max:17,min:11,weight:850,color:'#314f6c'});
  fitText(context,'補充證據，不改適合度、資格、分數或正式風控',margin+22,cardY+cardH-26,cardW-42,{max:14,min:10,weight:850,color:'#68788b'});
  const trident=typeof window.tridentEngineV361==='function'?window.tridentEngineV361(report):null,rightX=margin+cardW+gap;
  const triPrice=item=>item&&Number.isFinite(Number(item.value))?`${price(item.value)} 元`:'資料不足',triDate=item=>item?.date||'日期不足';
  rounded(context,rightX,cardY,cardW,cardH,14,'#f8fbff','#9bb2c9');
  fitText(context,'🔱 三叉戟價位｜補充觀察',rightX+22,cardY+37,cardW-44,{max:22,min:15,weight:950,color:'#173a5d'});
  const rows=[['🧱 壓力',trident?.pressure,'#a85a08'],['🛡️ 支撐',trident?.support,'#16724a'],['📌 候選預備',trident?.preparatory,'#6c43a3']];
  rows.forEach((item,index)=>fitText(context,`${item[0]} ${triPrice(item[1])}｜${triDate(item[1])}`,rightX+22,cardY+76+index*32,cardW-44,{max:18,min:11,weight:900,color:item[2]}));
  fitText(context,trident?.available?'量能大於左一根；紅K取低、綠K取高｜只作補充':'逐日 OHLCV 不足｜不建立假價位',rightX+22,cardY+cardH-26,cardW-44,{max:14,min:10,weight:850,color:'#68788b'});
  for(const [key,value] of Object.entries(source.dataset||{}))out.dataset[key]=value;
  out.dataset.layoutAudit=encodeURIComponent(JSON.stringify({...audit,size:`${out.width}x${out.height}`,v50SafeEvidenceRow:{insertY,rowHeight,cardY,cardBottom:cardY+cardH,physicalInsert:true,overlap:false,duplicateWarning:false}}));
  out.dataset.r45StockCompactPanel='v50-safe-insert:left-major-volume,right-trident';
  out.dataset.r45NoOverlay='true';
  return out;
}

function readLayoutAudit(source){
  try{return source?.dataset?.layoutAudit?JSON.parse(decodeURIComponent(source.dataset.layoutAudit)):null;}catch(_){return null;}
}
function compactProfessionalBottom(source,report){
  if(source?.dataset?.reportMode!=='professional'||source?.dataset?.r45RemovedProfessionalSupplement?.indexOf('snr-panel:')!==0)return source;
  const audit=readLayoutAudit(source),sections=audit?.sections||{};
  const fallbackStageHeight=170,logicalScale=source.width/1600;
  let mapY=Number(sections?.efTop);
  if(!Number.isFinite(mapY)){
    const dBottom=Number(sections?.dBottom),efGap=Number(sections?.efGap);
    mapY=Number.isFinite(dBottom)?dBottom+(Number.isFinite(efGap)?efGap:Math.round(42*logicalScale)):NaN;
  }
  if(!Number.isFinite(mapY))mapY=Math.round(2534*logicalScale)+fallbackStageHeight;
  mapY=Math.round(mapY);
  if(mapY<1||mapY>=source.height-300)return source;
  const out=copyCanvas(source),context=out.getContext('2d'),panelY=mapY+4,panelH=out.height-panelY-8;
  context.fillStyle='#eef3f8';context.fillRect(0,mapY,out.width,out.height-mapY);
  const leftX=18,gap=14,leftW=350,rightX=leftX+leftW+gap,rightW=out.width-rightX-18;
  rounded(context,leftX,panelY,leftW,panelH,15,'#ffffff','#c9d7e5');
  rounded(context,rightX,panelY,rightW,panelH,15,'#ffffff','#c9d7e5');
  fitText(context,'E. 進階完整價位｜需要時再看',leftX+16,panelY+34,leftW-32,{max:20,min:14,weight:950,color:'#173a5d'});
  let state=null,map=[];
  try{
    state=typeof window.stockInfographicStateV3328==='function'?window.stockInfographicStateV3328(report):null;
    map=state&&typeof window.buildStockMapItemsV3328==='function'?window.buildStockMapItemsV3328(report,state).slice(0,12):[];
  }catch(_){map=[];}
  const rowTop=panelY+55,rowH=Math.max(29,Math.min(52,Math.floor((panelH-82)/Math.max(1,map.length))));
  if(map.length){
    map.forEach((item,index)=>{
      const y=rowTop+index*rowH,isCurrent=['目前收盤','現在價格'].includes(String(item?.label||'').trim());
      if(index){context.strokeStyle='#e3eaf2';context.lineWidth=1;context.beginPath();context.moveTo(leftX+14,y-15);context.lineTo(leftX+leftW-14,y-15);context.stroke();}
      fitText(context,`${priceText(item.value)} 元`,leftX+16,y+7,112,{max:17,min:12,weight:950,color:isCurrent?'#d7273f':(item.color||'#173a5d')});
      fitText(context,String(item.label||'價位'),leftX+132,y+7,leftW-148,{max:15,min:10,weight:isCurrent?950:850,color:isCurrent?'#d7273f':'#263f5a'});
    });
  }else{
    fitText(context,'價位資料不足',leftX+18,rowTop+20,leftW-36,{max:17,min:13,weight:900,color:'#6a7889'});
  }
  fitText(context,'實際委託仍以上方觀察、確認與失效價位為準',leftX+16,panelY+panelH-16,leftW-32,{max:11,min:9,weight:800,color:'#68788b'});

  const layer=typeof window.buildEducationLayerV46==='function'?window.buildEducationLayerV46(report):null;
  const snr=layer?.snrConfluenceEvidence||{},support=snr.supportConfluence,resistance=snr.resistanceConfluence;
  const rangeText=value=>typeof window.snrRangeTextV532==='function'?window.snrRangeTextV532(value):(value?.rangeText||'資料不足');
  const distanceText=value=>typeof window.snrDistanceTextV532==='function'?window.snrDistanceTextV532(value):(value?.distanceText||'距離資料不足');
  const freshText=value=>typeof window.snrFreshTextV532==='function'?window.snrFreshTextV532(value):(value?.freshnessText||'歷史資料不足');
  const roleText=value=>typeof window.snrRoleTextV532==='function'?window.snrRoleTextV532(value):(value?.roleText||'依既有支撐壓力判讀');
  fitText(context,'F. 歷史支撐壓力 × ABC × 三叉戟｜三種方法一起看',rightX+16,panelY+34,rightW-32,{max:20,min:13,weight:950,color:'#173a5d'});
  const cardGap=12,cardW=(rightW-44-cardGap)/2,cardY=panelY+52,cardH=118;
  rounded(context,rightX+16,cardY,cardW,cardH,12,'#eef9f2','#bcdcca');
  fitText(context,`🟢 支撐 ${rangeText(support)}｜${support?.label||'0級'}`,rightX+28,cardY+29,cardW-24,{max:17,min:11,weight:950,color:'#176a45'});
  const supportLines=wrapLines(context,`${distanceText(support)}｜${support?.reason||'目前沒有多種方法集中在同一區'}`,cardW-24,13,780).slice(0,2);
  supportLines.forEach((line,index)=>fitText(context,line,rightX+28,cardY+64+index*22,cardW-24,{max:14,min:10,weight:780,color:'#43566a'}));
  const resistanceX=rightX+28+cardW;
  rounded(context,resistanceX,cardY,cardW,cardH,12,'#fff5f2','#e2c5bd');
  fitText(context,`🟣 壓力 ${rangeText(resistance)}｜${resistance?.label||'0級'}`,resistanceX+12,cardY+29,cardW-24,{max:17,min:11,weight:950,color:'#7a3454'});
  const resistanceLines=wrapLines(context,`${distanceText(resistance)}｜${resistance?.reason||'目前沒有多種方法集中在同一區'}`,cardW-24,13,780).slice(0,2);
  resistanceLines.forEach((line,index)=>fitText(context,line,resistanceX+12,cardY+64+index*22,cardW-24,{max:14,min:10,weight:780,color:'#43566a'}));

  const summaryY=cardY+134,summaryH=145,summaryW=(rightW-44-cardGap)/2;
  rounded(context,rightX+16,summaryY,summaryW,summaryH,12,'#f8fbff','#d3dfeb');
  fitText(context,'☁️ 記住口訣',rightX+30,summaryY+29,summaryW-28,{max:18,min:13,weight:950,color:'#173a5d'});
  const a=state?.A,b=state?.B,c=state?.C;
  fitText(context,a!==null&&a!==undefined&&b!==null&&b!==undefined?'A 起漲 → B 前高 →':'ABC 結構資料不足',rightX+30,summaryY+60,summaryW-28,{max:18,min:12,weight:950,color:'#173a5d'});
  if(a!==null&&a!==undefined&&b!==null&&b!==undefined)fitText(context,c!==null&&c!==undefined?'C 回檔 → 再突破 B':'等待 C 回檔確認',rightX+30,summaryY+88,summaryW-28,{max:18,min:12,weight:950,color:'#bd2638'});
  fitText(context,'＝完整 N 字確認',rightX+30,summaryY+125,summaryW-28,{max:16,min:11,weight:950,color:'#173a5d'});
  const currentX=rightX+28+summaryW;
  rounded(context,currentX,summaryY,summaryW,summaryH,12,'#fff8ea','#ead2a5');
  fitText(context,'📍 現在位置／下一步',currentX+12,summaryY+29,summaryW-24,{max:18,min:12,weight:950,color:'#a65d08'});
  fitText(context,`最新收盤：${priceText(state?.close)} 元`,currentX+12,summaryY+58,summaryW-24,{max:16,min:11,weight:900,color:'#263f5a'});
  fitText(context,`20日均線：${priceText(state?.ma)} 元`,currentX+12,summaryY+84,summaryW-24,{max:15,min:10,weight:850,color:'#263f5a'});
  fitText(context,b!==null&&b!==undefined?`下一步：等待突破 B ${priceText(b)} 元`:'下一步：等待有效 ABC 結構',currentX+12,summaryY+118,summaryW-24,{max:15,min:10,weight:900,color:'#314aaf'});

  const detailY=summaryY+169,detailW=rightW-32;
  fitText(context,`歷史支撐：${freshText(snr.nearestSnrSupport)}｜${roleText(snr.nearestSnrSupport)}`,rightX+16,detailY,detailW,{max:14,min:10,weight:800,color:'#31475d'});
  fitText(context,`歷史壓力：${freshText(snr.nearestSnrResistance)}｜${roleText(snr.nearestSnrResistance)}`,rightX+16,detailY+27,detailW,{max:14,min:10,weight:800,color:'#31475d'});
  const plain=wrapLines(context,`白話：${snr.plainInterpretation||'歷史支撐壓力資料不足，仍以原本ABC、三叉戟與共用進場檢查為準。'}`,detailW,14,850).slice(0,3);
  plain.forEach((line,index)=>fitText(context,line,rightX+16,detailY+56+index*22,detailW,{max:14,min:10,weight:850,color:'#8a5208'}));
  out.dataset.r45ProfessionalCompactBottom='e-left,f-right:real-map-and-snr';
  return out;
}

function priceText(value){
  return Number.isFinite(Number(value))?(E?E.price(value):Number(value).toFixed(2)):'資料不足';
}


function appendStockCompactEvidence(source,report){
  // V50 新手首頁已把成交密集區、七項分數與歷史支撐壓力合併成「進階參考」。
  // 靜態圖片無法真的折疊，因此不再追加重複卡片，避免重新變回資訊過載。
  if(source?.dataset?.v50NewbieFirst==='true')return source;
  const p=report?.shitoAssistantEvidence?.anchoredVolumeProfileEvidence||{},evidence=E?E.analyze(report||{},{kind:'stock'}):null,values=evidence?.ema?.values||{};
  const price=value=>Number.isFinite(Number(value))?(E?E.price(value):Number(value).toFixed(2)):'資料不足';
  const zone=p.status==='pass'?`${price(p.pocLower)}～${price(p.pocUpper)}`:(p.label||'資料不足');
  const rsi=evidence?.rsi5?.available?`${price(evidence.rsi5.value)}（${evidence.rsi5.date||'日期未提供'}）`:'資料不足';
  const ema=period=>values[period]?.available?price(values[period].value):'資料不足';
  const kd=evidence?.kd?.available?`K ${price(evidence.kd.k)}／D ${price(evidence.kd.d)}｜${evidence.kd.cross}`:'資料不足';
  const mode=source?.dataset?.reportMode;
  if(mode==='professional'||mode==='beginner'){
    const initialAudit=readLayoutAudit(source);
    if(source?.dataset?.iphoneFullScreen==='1284x2778'||initialAudit?.iphoneFullScreen?.noCrop===true)return insertV50CompactEvidenceRow(source,report,evidence,p);
    const out=copyCanvas(source),context=out.getContext('2d');
    const audit=readLayoutAudit(out),stageCards=audit?.stageCards||[];
    const waveCard=stageCards.find(card=>/量價波段|回撤量尺/.test(String(card?.title||'')))||null;
    const margin=36,gap=18,rowY=Math.round(Number(waveCard?.insertY)),rowHeight=Math.round(Number(waveCard?.height));
    const hasWaveRow=mode==='professional'&&Number.isFinite(rowY)&&Number.isFinite(rowHeight)&&rowHeight>=100;
    let x=mode==='professional'?Math.round(out.width*.535):590;
    let y=mode==='professional'?132:166;
    let width=mode==='professional'?out.width-x-margin:526;
    let height=mode==='professional'?136:124;
    let leftBounds=null;
    if(hasWaveRow){
      const usable=out.width-margin*2-gap,leftWidth=Math.round(usable*.52);
      leftBounds={x:margin,y:rowY+12,width:leftWidth,height:rowHeight-24};
      x=margin+leftWidth+gap;y=rowY+12;width=out.width-margin-x;height=rowHeight-24;
      context.fillStyle='#eef3f8';context.fillRect(0,rowY,out.width,rowHeight);
      rounded(context,leftBounds.x,leftBounds.y,leftBounds.width,leftBounds.height,13,'#ffffff','#8da3ba');
      const wave=window.ShitouWaveCoreV48?.analyzeReport?.(report),grade=wave?.ok?window.ShitouWaveCoreV48.grade(wave):null;
      const fib=wave?.fib,position=fib?.inRange&&fib?.band?`${fib.band.label} ${price(fib.band.low)}～${price(fib.band.high)}`:(fib?.positionText||'回撤資料不足');
      fitText(context,'📚 量價波段＋費波回撤量尺',leftBounds.x+18,leftBounds.y+27,leftBounds.width-36,{max:19,min:13,weight:950,color:'#173a5d'});
      fitText(context,wave?.ok?`${grade?.label||'量價待確認'}｜${wave.phaseLabel||'階段待確認'}`:'量價波段資料不足，不硬算',leftBounds.x+18,leftBounds.y+53,leftBounds.width-36,{max:16,min:11,weight:950,color:'#314f6c'});
      fitText(context,wave?.ok?`${wave.threeBreakout?'✅ 三盤突破':wave.threeBreakdown?'⚠️ 三盤跌破':'三盤未轉折'}｜${fib?.directionText||'回撤方向待確認'}`:'沿用原本判讀與風控',leftBounds.x+18,leftBounds.y+77,leftBounds.width-36,{max:15,min:10,weight:850,color:'#4c5f73'});
      fitText(context,`📏 ${position}｜比例不是買點`,leftBounds.x+18,leftBounds.y+101,leftBounds.width-36,{max:14,min:9,weight:850,color:'#6a4b15'});
      fitText(context,'只補充位置，不改 ABC／N字／原始分數與 Gate',leftBounds.x+18,leftBounds.y+height-8,leftBounds.width-36,{max:11,min:8,weight:800,color:'#68788b'});
    }
    rounded(context,x,y,width,height,13,'#f8fbff','#8da3ba');context.fillStyle='#27648a';context.fillRect(x,y,8,height);
    fitText(context,`📍 主要成交密集區 ${zone}`,x+20,y+25,width-34,{max:19,min:14,weight:950,color:'#153a67'});
    fitText(context,`日RSI 5T ${rsi}｜EMA21 ${ema(21)}`,x+20,y+50,width-34,{max:16,min:11,weight:950,color:'#314f6c'});
    fitText(context,`EMA50 ${ema(50)}｜EMA200 ${ema(200)}`,x+20,y+75,width-34,{max:16,min:11,weight:950,color:'#314f6c'});
    fitText(context,`KD(9,3,3) ${kd}`,x+20,y+99,width-34,{max:15,min:10,weight:900,color:'#586a7e'});
    fitText(context,`資料日 ${evidence?.dataQuality?.dataDate||report?.closeDate||'未提供'}｜補充證據不計分`,x+20,y+height-7,width-34,{max:11,min:9,weight:900,color:'#66758a'});
    out.dataset.r45StockCompactPanel=hasWaveRow?'wave-row:left-wave-fib,right-major-volume-zone':'stage-right:major-volume-zone,ema,kd,rsi5';
    out.dataset.r45StockCompactAudit=encodeURIComponent(JSON.stringify({mode,waveRow:hasWaveRow,left:leftBounds,right:{x,y,width,height},gap:leftBounds?x-(leftBounds.x+leftBounds.width):null,overlap:leftBounds?leftBounds.x+leftBounds.width>x:false}));
    if(mode==='professional')return compactProfessionalBottom(out,report);

    const trident=typeof window.tridentEngineV361==='function'?window.tridentEngineV361(report):null;
    const layer=typeof window.buildEducationLayerV46==='function'?window.buildEducationLayerV46(report):null;
    const triPrice=item=>item&&Number.isFinite(Number(item.value))?`${price(item.value)} 元`:'資料不足';
    const triDate=item=>item?.date||'未取得有效大量K';
    const layoutAudit=readLayoutAudit(out),sections=layoutAudit?.sections||{};
    const warningTop=Number(sections?.warningTop),snrBottom=Number(sections?.snrBottom);
    const computedWarningY=Number.isFinite(warningTop)?warningTop:(Number.isFinite(snrBottom)?snrBottom+20:1744);
    const c=out.getContext('2d'),warningY=Math.round(computedWarningY),leftX=42,leftWidth=524,rightX=578,rightWidth=532,panelHeight=180;
    c.fillStyle='#eef3f8';c.fillRect(36,warningY-6,1080,panelHeight+12);
    rounded(c,leftX,warningY,leftWidth,panelHeight,18,'#fff8ea','#e6c38b');
    fitText(c,'⚠️ 現在最需要注意',leftX+24,warningY+36,leftWidth-48,{max:25,min:19,weight:950,color:'#8e5308'});
    fitText(c,`主要原因：${layer?.decisionRiskState?.primary||'目前資料不足'}`,leftX+24,warningY+76,leftWidth-48,{max:18,min:13,weight:900,color:'#3a4658'});
    const volumeLines=wrapLines(c,`量價背景：${layer?.volumeContextState?.warning||'量價資料不足，先依原有進場檢查等待。'}`,leftWidth-48,15,800).slice(0,2);
    volumeLines.forEach((line,index)=>fitText(c,line,leftX+24,warningY+118+index*25,leftWidth-48,{max:15,min:12,weight:800,color:'#5d6878'}));

    rounded(c,rightX,warningY,rightWidth,panelHeight,18,'#f8fbff','#9bb2c9');
    fitText(c,'🔱 三叉戟價位分析',rightX+22,warningY+34,rightWidth-44,{max:23,min:18,weight:950,color:'#173a5d'});
    const rows=[
      {icon:'🧱',label:'壓力',item:trident?.pressure,color:'#a85a08'},
      {icon:'🛡️',label:'支撐',item:trident?.support,color:'#16724a'},
      {icon:'📌',label:'候選預備',item:trident?.preparatory,color:'#6c43a3'}
    ];
    rows.forEach((item,index)=>{
      const rowY=warningY+68+index*32;
      fitText(c,`${item.icon} ${item.label} ${triPrice(item.item)}｜${triDate(item.item)}`,rightX+22,rowY,rightWidth-44,{max:18,min:13,weight:950,color:item.color});
    });
    fitText(c,trident?.available?'量能＞左一根；紅K取低、綠K取高｜只補充證據，不改資格':'逐日OHLCV不足｜不建立假價位',rightX+22,warningY+166,rightWidth-44,{max:13,min:10,weight:850,color:'#68788b'});
    out.dataset.r45TridentPanel='warning-right:pressure,support,preparatory';
    const auditItem=item=>item&&Number.isFinite(Number(item.value))?{value:Number(item.value),date:item.date||null,volRatio:Number.isFinite(Number(item.volRatio))?Number(item.volRatio):null}:null;
    out.dataset.r45TridentAudit=encodeURIComponent(JSON.stringify({source:'tridentEngineV361',available:trident?.available===true,key:trident?.key||'UNAVAILABLE',pressure:auditItem(trident?.pressure),support:auditItem(trident?.support),preparatory:auditItem(trident?.preparatory),invented:false}));
    return out;
  }
  return source;
}

function backgroundRatio(source,y){
  const context=source.getContext('2d',{willReadFrequently:true});
  const row=context.getImageData(0,Math.max(0,Math.min(source.height-1,y)),source.width,1).data;
  const base=[row[4],row[5],row[6]];let similar=0,total=0;
  // Only accept a near-exact background match. A loose threshold can mistake a
  // white card interior for the pale page background and split the card.
  for(let x=4;x<source.width;x+=12){const i=x*4,d=Math.abs(row[i]-base[0])+Math.abs(row[i+1]-base[1])+Math.abs(row[i+2]-base[2]);if(d<14)similar++;total++;}
  return total?similar/total:0;
}

function safeCut(source,start,desired){
  // Detailed candidate cards can be tall. Search far enough back to find the
  // real inter-card gutter instead of splitting the last visible card.
  const lower=Math.max(start+420,desired-1100);let best=desired,bestScore=-1;
  for(let y=desired;y>=lower;y-=3){
    let score=0;for(let offset=-3;offset<=3;offset+=3)score+=backgroundRatio(source,y+offset);
    if(score>bestScore){bestScore=score;best=y;}
    if(score>=2.75)return y;
  }
  return best;
}

function paginateDetailed(source,{title,date='資料日期依原報告',watermark=false}={}){
  if(!source)throw new Error('原始圖片畫布不存在');
  const scale=(DETAIL.width-DETAIL.side*2)/source.width;
  const maxSourceHeight=Math.floor((DETAIL.height-DETAIL.top-DETAIL.bottom)/scale);
  const segments=[];let start=0;
  while(source.height-start>maxSourceHeight){const cut=safeCut(source,start,start+maxSourceHeight);segments.push([start,Math.max(start+1,cut)]);start=Math.max(start+1,cut);}
  segments.push([start,source.height]);
  const pages=segments.map(([from,to],index)=>{
    const out=canvas(DETAIL.width,DETAIL.height,'#eef3f8'),context=out.getContext('2d');
    context.fillStyle='#123a5a';context.fillRect(0,0,DETAIL.width,DETAIL.top-10);
    fitText(context,title,DETAIL.side,48,DETAIL.width-DETAIL.side*2-210,{max:31,min:20,weight:950,color:'#fff'});
    fitText(context,`第 ${index+1}／${segments.length} 頁`,DETAIL.width-DETAIL.side,48,190,{max:24,min:18,weight:900,color:'#d9edff',align:'right'});
    fitText(context,`${date||'資料日期依原報告'}｜${RELEASE}`,DETAIL.side,76,DETAIL.width-DETAIL.side*2,{max:17,min:11,weight:750,color:'#d5e5f4'});
    const sliceHeight=to-from,drawHeight=Math.round(sliceHeight*scale);
    context.drawImage(source,0,from,source.width,sliceHeight,DETAIL.side,DETAIL.top,DETAIL.width-DETAIL.side*2,drawHeight);
    context.fillStyle='#123a5a';context.fillRect(0,DETAIL.height-DETAIL.bottom,DETAIL.width,DETAIL.bottom);
    fitText(context,'完整原圖安全分頁｜頁面間像素連續、沒有裁掉原始內容｜技術分析僅供研究參考',DETAIL.side,DETAIL.height-27,DETAIL.width-DETAIL.side*2,{max:17,min:12,weight:800,color:'#eef6ff'});
    if(watermark&&typeof original.watermark==='function')original.watermark(out,title.includes('大盤')?'market':'stock');
    out.dataset.r45PageAudit=encodeURIComponent(JSON.stringify({size:`${out.width}x${out.height}`,page:index+1,pages:segments.length,sourceFrom:from,sourceTo:to,sourceHeight:source.height,noPixelGap:index===0?from===0:segments[index-1][1]===from}));
    return out;
  });
  return {pages,segments,sourceHeight:source.height,size:'1284x2778'};
}

function singleLongDetailed(source,{title,date='資料日期依原報告',watermark=false}={}){
  if(!source)throw new Error('原始圖片畫布不存在');
  const scale=(DETAIL.width-DETAIL.side*2)/source.width;
  const drawHeight=Math.ceil(source.height*scale);
  const height=DETAIL.top+drawHeight+DETAIL.bottom;
  const out=canvas(DETAIL.width,height,'#eef3f8'),context=out.getContext('2d');
  context.fillStyle='#123a5a';context.fillRect(0,0,DETAIL.width,DETAIL.top-10);
  fitText(context,title,DETAIL.side,48,DETAIL.width-DETAIL.side*2,{max:31,min:18,weight:950,color:'#fff'});
  fitText(context,`${date||'資料日期依原報告'}｜${RELEASE}`,DETAIL.side,76,DETAIL.width-DETAIL.side*2,{max:17,min:11,weight:750,color:'#d5e5f4'});
  context.drawImage(source,0,0,source.width,source.height,DETAIL.side,DETAIL.top,DETAIL.width-DETAIL.side*2,drawHeight);
  context.fillStyle='#123a5a';context.fillRect(0,height-DETAIL.bottom,DETAIL.width,DETAIL.bottom);
  fitText(context,'單一張完整長圖｜原始內容連續保留、不拆頁｜技術分析僅供研究參考',DETAIL.side,height-27,DETAIL.width-DETAIL.side*2,{max:17,min:12,weight:800,color:'#eef6ff'});
  if(watermark&&typeof original.watermark==='function')original.watermark(out,title.includes('大盤')?'market':'stock');
  out.dataset.r45SingleAudit=encodeURIComponent(JSON.stringify({size:`${out.width}x${out.height}`,pages:1,sourceFrom:0,sourceTo:source.height,sourceHeight:source.height,complete:true}));
  return {pages:[out],segments:[[0,source.height]],sourceHeight:source.height,size:`${out.width}x${out.height}`,singleLong:true};
}

function fitIphoneStockReport(source,{title,date='資料日期依原報告',watermark=false,watermarkKind='stock'}={}){
  if(!source)throw new Error('個股原始圖片畫布不存在');
  const scaleX=IPHONE_12_PRO_MAX.width/source.width,scaleY=IPHONE_12_PRO_MAX.height/source.height,scale=Math.min(scaleX,scaleY);
  if(scale<IPHONE_12_PRO_MAX.minReadableScale){
    const fallback=paginateDetailed(source,{title,date,watermark});
    fallback.iphoneFallback=true;fallback.fitScale=scale;return fallback;
  }
  const out=canvas(IPHONE_12_PRO_MAX.width,IPHONE_12_PRO_MAX.height,'#eef3f8'),context=out.getContext('2d');
  const fullBleed=['professional','beginner','market'].includes(source?.dataset?.reportMode);
  const drawWidth=fullBleed?out.width:Math.round(source.width*scale),drawHeight=fullBleed?out.height:Math.round(source.height*scale),x=fullBleed?0:Math.floor((out.width-drawWidth)/2),y=fullBleed?0:Math.floor((out.height-drawHeight)/2);
  context.drawImage(source,0,0,source.width,source.height,x,y,drawWidth,drawHeight);
  if(watermark&&typeof original.watermark==='function')original.watermark(out,watermarkKind);
  out.dataset.r45IphoneAudit=encodeURIComponent(JSON.stringify({size:`${out.width}x${out.height}`,sourceSize:`${source.width}x${source.height}`,scale:Number(scale.toFixed(4)),scaleX:Number(scaleX.toFixed(4)),scaleY:Number(scaleY.toFixed(4)),contentBox:{x,y,width:drawWidth,height:drawHeight},fullBleed,complete:true,overlap:false}));
  return {pages:[out],segments:[[0,source.height]],sourceHeight:source.height,size:'1284x2778',singleLong:true,iphoneFullScreen:true,fullBleed,fitScale:scale,scaleX,scaleY};
}

function candidateCode(candidate){return String(candidate?.report?.stock||candidate?.report?.code||candidate?.code||'-');}
function candidateName(candidate){return String(typeof window.momentumSafeStockNameV377712==='function'?window.momentumSafeStockNameV377712(candidate):(candidate?.report?.name||candidate?.name||candidateCode(candidate)));}
function candidateClose(candidate){const value=Number(candidate?.close??candidate?.report?.close);return Number.isFinite(value)?value:null;}
function candidateRsi(candidate){return window.ShitouScanPolicy5328.rsi(candidate).value;}
function candidatePhase(candidate){return E?E.existingPhase({...candidate?.report,stageSafety:candidate?.stageSafety,stage:candidate?.stage}).label:(candidate?.stageSafety?.label||candidate?.stage?.label||'階段待確認');}
function candidateQualification(candidate,kind){
  if(kind==='momentum')return candidate?.formalLaunchEligible===true?'正式候選':candidate?.formalLaunchEligible===false?(candidate?.launchRole?.label||candidate?.stage?.label||'條件式觀察'):(candidate?.stage?.label||'原始入列');
  return candidate?.actionGate?.top3Eligible===true?'正式候選':candidate?.actionGate?.label||candidate?.stageSafety?.label||'條件式觀察';
}
function top8Finite(...values){
  for(const value of values){const number=Number(value);if(Number.isFinite(number))return number;}
  return null;
}
function top8Number(value,digits=2){
  const number=Number(value);return Number.isFinite(number)?number.toLocaleString('zh-TW',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'資料不足';
}
function top8Percent(value){
  const number=Number(value);return Number.isFinite(number)?(number>=0?'+':'')+top8Number(number,1)+'%':'資料不足';
}
function top8Technical(candidate,kind){
  const info=evidenceFor(candidate,kind),evidence=info.evidence,values=evidence?.ema?.values||{};
  const ema=period=>values[period]?.available?top8Number(values[period].value,2):'資料不足';
  let trend='長期資料不足';
  if(values[21]?.available&&values[50]?.available&&values[200]?.available){
    const a=Number(values[21].value),b=Number(values[50].value),c=Number(values[200].value);
    trend=a>b&&b>c?'多頭排列':a<b&&b<c?'空頭排列':'方向不一致';
  }
  const kd=evidence?.kd,cross=kd?.cross==='黃金交叉'?'力道轉強':kd?.cross==='死亡交叉'?'力道轉弱':'沒有新交叉';
  return {
    phase:info.phase?.label||'階段待確認',
    rsiLabel:window.ShitouScanPolicy5328.rsiText(candidate,true),
    emaLine:'📈 平均價趨勢：短期 '+ema(21)+'｜中期 '+ema(50)+'｜長期 '+ema(200)+'｜'+trend,
    kdLine:kd?.available?'🎚️ 短線力道：K '+top8Number(kd.k,1)+'／D '+top8Number(kd.d,1)+'｜'+cross+'｜資料日 '+(evidence?.dataQuality?.dataDate||'日期未提供')+'｜只作補充，不改資格':'🎚️ 短線力道：資料不足｜只作補充，不改資格',
    rsi:evidence?.rsi5?.available?Number(evidence.rsi5.value):candidateRsi(candidate)
  };
}
function top8MomentumMetrics(candidate,report,technical){
  const rr=top8Finite(candidate?.waveRRRatio,candidate?.waveRiskRewardRatio,candidate?.wave?.riskRewardRatio,candidate?.tradeability?.riskRewardRatio,candidate?.decisionLayer?.remainingOpportunity?.riskRewardRatio);
  const upside=top8Finite(candidate?.strategicUpsidePct,candidate?.remainingUpsidePct,candidate?.remainingOpportunity?.upsidePct,candidate?.decisionLayer?.remainingOpportunity?.upsidePct);
  const near=top8Finite(candidate?.nearestRRRatio,candidate?.nearestRiskRewardRatio,candidate?.nearestGateRiskRewardRatio,candidate?.tradeability?.nearestRiskRewardRatio);
  return [['波段價差比',rr===null?'資料不足':'1:'+top8Number(rr,2),'#5b3e91'],['上方剩餘空間',upside===null?'資料不足':top8Percent(upside),'#198357'],['近端價差比',near===null?'資料不足':'1:'+top8Number(near,2),'#315878']];
}
function top8DaytradeMetrics(candidate,report,technical){
  const volume=top8Finite(candidate?.volRatio,candidate?.relativeVolume20,candidate?.volumeRatio,report?.volume?.latest?.relativeVolume20);
  const ma20=top8Finite(candidate?.gap,candidate?.ma20GapPct,report?.ma20GapPct,report?.structure?.ma20GapPct);
  return [['今日量／5日均量',volume===null?'資料不足':top8Number(volume,2)+'×','#315878'],['距20日均線',ma20===null?'資料不足':top8Percent(ma20),'#315878'],['RSI 5T',technical.rsi===null?'資料不足':top8Number(technical.rsi,2),'#9b6509']];
}
function top8Price(report,candidate,...paths){
  for(const path of paths){
    let value=path==='close'?(report?.close??candidate?.close):path.split('.').reduce((object,key)=>object?.[key],candidate);
    if(value===null||value===undefined)value=path.split('.').reduce((object,key)=>object?.[key],report);
    value=Number(value);if(Number.isFinite(value))return top8Number(value,2)+' 元';
  }
  return '資料不足';
}
function top8CardLines(candidate,kind,technical){
  const report=candidate?.report||candidate||{};
  if(kind==='momentum'){
    const volume=top8Finite(candidate?.effectiveVol,candidate?.volumeRatio,candidate?.relativeVolume20,report?.volume?.latest?.relativeVolume20);
    const quality=top8Finite(candidate?.breakoutQualityScore,candidate?.breakoutQuality?.score,candidate?.qualityScore);
    return [
      '🛡 防守 '+top8Price(report,candidate,'waveRiskLevel','fib.retracement.0.764','stop764')+'｜近撐 '+top8Price(report,candidate,'support.value')+'｜🎯 目標 '+top8Price(report,candidate,'strategicTarget.value','target.value','fib.target1618','target1618'),
      '🟢 行情階段：'+technical.phase+'｜'+technical.rsiLabel+'｜關鍵價位請以原始候選資料為準',
      technical.emaLine,technical.kdLine+'｜量能 '+(volume===null?'資料不足':top8Number(volume,2)+'×')+'｜突破品質 '+(quality===null?'資料不足':top8Number(quality,1)+'/10')
    ];
  }
  const trigger=top8Price(report,candidate,'levels.triggerShadow.value','entryTrigger','triggerPrice','close'),defense=top8Price(report,candidate,'levels.support.value','defensePrice','supportPrice','dailyMa20','ma20');
  const strategy=(typeof window.dayTradeStrategyExplainV377728==='function'?window.dayTradeStrategyExplainV377728(candidate)?.short:null)||candidate?.strategyType||candidate?.selectionType||candidate?.actionGate?.label||'依原始條件觀察';
  const riskReasons=Array.isArray(candidate?.fake?.reasons)?candidate.fake.reasons.filter(Boolean).join('、'):'',warning=riskReasons||candidate?.falseBreakoutWarning||candidate?.riskWarning||'未見主要假突破警訊';
  const flow=top8Finite(candidate?.moneyFlowConfirmation?.dayTradeMoneyFlowScore),flowText=flow===null?'資金流暫不評分':'資金流 '+top8Number(flow,0)+'/100';
  return [technical.rsiLabel+'｜'+'🎯 觀察價 '+trigger+'｜🛡 防守價 '+defense+'｜做法：'+strategy,'🟢 行情階段：'+technical.phase+'｜⚠️ 假突破提醒：'+warning+'｜'+flowText,technical.emaLine,technical.kdLine];
}
function drawTop8Badge(context,x,y,width,text,fill,color){
  rounded(context,x,y,width,34,17,fill,color);fitText(context,text,x+width/2,y+24,width-18,{max:16,min:11,weight:900,color,align:'center'});
}
function drawTop8Card(context,candidate,index,kind,x,y,width,height){
  const report=candidate?.report||candidate||{},technical=top8Technical(candidate,kind),grade=String(candidate?.grade||report?.grade||'-').toUpperCase(),accent=grade==='S'?'#176a45':grade==='A'?'#28735b':grade==='B'?'#9a7208':'#315878';
  rounded(context,x,y,width,height,18,'#ffffff','#c7d4e1');context.fillStyle=accent;context.fillRect(x,y,8,height);
  const rank=kind==='daytrade'?(candidate?.displayRankV40?'#'+candidate.displayRankV40:(candidate?.rank?'#'+candidate.rank:'等待')):'#'+(index+1);
  rounded(context,x+18,y+14,58,36,9,accent,null);fitText(context,rank,x+47,y+40,48,{max:17,min:12,weight:950,color:'#fff',align:'center'});
  fitText(context,candidateName(candidate)+'（'+candidateCode(candidate)+'）',x+90,y+42,560,{max:29,min:17,weight:950,color:'#172f4b'});
  const close=candidateClose(candidate);fitText(context,close===null?'最新收盤 資料不足':'最新收盤 '+top8Number(close,2)+' 元',x+660,y+42,width-690,{max:29,min:18,weight:950,color:'#d42d3d'});
  const score=top8Finite(candidate?.score?.final,candidate?.score,candidate?.finalScore,candidate?.conditionScore,candidate?.launchScore,candidate?.actionGate?.score);
  drawTop8Badge(context,x+90,y+55,245,'條件 '+grade+'｜總分 '+(score===null?'依原報告':top8Number(score,0)),'#f8fbfd',accent);
  drawTop8Badge(context,x+345,y+55,360,candidateQualification(candidate,kind),'#f7fbf8',accent);
  drawTop8Badge(context,x+715,y+55,width-733,technical.phase,'#fbfaf3',accent);
  const metrics=kind==='momentum'?top8MomentumMetrics(candidate,report,technical):top8DaytradeMetrics(candidate,report,technical),metricY=y+100,gap=10,metricW=(width-56-gap*2)/3;
  metrics.forEach((metric,i)=>{const mx=x+18+i*(metricW+gap);rounded(context,mx,metricY,metricW,62,10,'#f3f6fa','#e0e7ee');fitText(context,metric[0],mx+12,metricY+22,metricW-24,{max:15,min:11,weight:850,color:'#52657a'});fitText(context,metric[1],mx+12,metricY+51,metricW-24,{max:24,min:14,weight:950,color:metric[2]});});
  const lines=[...top8CardLines(candidate,kind,technical),window.ShitouScanPolicy5328.volumeText(candidate)],lineY=[178,201,224,247,273];
  lines.forEach((line,i)=>fitText(context,line,x+22,y+lineY[i],width-44,{max:i<2?17:16,min:12,weight:i<2?850:800,color:i===3?'#6c5b11':i===2?'#244f72':'#334a61'}));
}
function buildTop8IphoneReport(scan,kind){
  const candidates=(scan?.candidates||scan?.launchCandidates||[]).slice(0,8),out=canvas(IPHONE_12_PRO_MAX.width,IPHONE_12_PRO_MAX.height,'#eef3f8'),context=out.getContext('2d');
  const title=kind==='momentum'?'主升段前八名詳細圖片':'當沖前八名詳細圖片',accent=kind==='momentum'?'#245f4b':'#246063',gradient=context.createLinearGradient(0,0,out.width,0);
  gradient.addColorStop(0,'#123a5a');gradient.addColorStop(1,kind==='momentum'?'#5b4c91':'#25636b');context.fillStyle=gradient;context.fillRect(0,0,out.width,170);
  fitText(context,title,28,55,760,{max:35,min:24,weight:950,color:'#fff'});
  fitText(context,(scan?.dataDate||scan?.createdAt||'資料日期依各股')+'｜'+RELEASE,28,92,900,{max:17,min:10,weight:800,color:'#d8eaf6'});
  fitText(context,'原始順序與資格不變｜每檔已整合平均價趨勢、短線力道與 RSI5',28,132,900,{max:20,min:13,weight:850,color:'#fff4bd'});
  rounded(context,972,20,284,126,16,'rgba(255,255,255,.13)','rgba(255,255,255,.4)');
  fitText(context,'iPhone 12 Pro Max',1114,58,245,{max:20,min:13,weight:950,color:'#fff',align:'center'});
  fitText(context,'1284 × 2778 單頁滿版',1114,88,245,{max:17,min:11,weight:900,color:'#dff5ff',align:'center'});
  fitText(context,'底部重複證據已移除',1114,119,245,{max:15,min:10,weight:800,color:'#fff4bd',align:'center'});
  rounded(context,24,184,1236,76,14,'#fff8df','#e5c86f');context.fillStyle=accent;context.fillRect(24,184,8,76);
  fitText(context,'🔎 閱讀方式：先看關鍵價位與行情階段，再用平均價趨勢、KD短線力道與RSI5交叉確認；它們只補充說明，不改原始排名。',48,231,1188,{max:18,min:12,weight:900,color:'#6a5211'});
  const cardX=24,cardY=270,cardW=1236,cardH=282,gap=8;
  if(!candidates.length){rounded(context,cardX,cardY,cardW,320,18,'#fff');fitText(context,'本次沒有可輸出的前八名候選。',out.width/2,cardY+180,cardW-80,{max:31,min:21,weight:950,color:'#66758a',align:'center'});}
  candidates.forEach((candidate,index)=>drawTop8Card(context,candidate,index,kind,cardX,cardY+index*(cardH+gap),cardW,cardH));
  const footerY=2598;context.fillStyle='#123a5a';context.fillRect(0,footerY,out.width,out.height-footerY);
  fitText(context,'符號說明｜🎯 觀察或目標價　🛡 防守價　📈 平均價趨勢　🎚️ KD短線力道　RSI5＝近5日漲跌熱度',28,footerY+48,out.width-56,{max:18,min:12,weight:900,color:'#eef7ff'});
  fitText(context,'若顯示「資料不足」，代表原始日K不足，系統不會用假數字補齊。技術分析僅供研究參考，不構成投資建議。',28,footerY+90,out.width-56,{max:17,min:11,weight:800,color:'#d9e8f4'});
  fitText(context,'版面核對：8檔卡片內已整合 EMA／KD／RSI5；沒有底部重複附錄；沒有改動選股公式、排序、分數或資格。',28,footerY+132,out.width-56,{max:16,min:10,weight:800,color:'#fff4bd'});
  out.dataset.reportMode=kind;out.dataset.r45Top8Layout='iphone-1284x2778-integrated-evidence';out.dataset.r45Top8EvidenceCount=String(candidates.length);out.dataset.r45RemovedBottomEvidence='true';
  const auditRows=candidates.map((candidate,index)=>{
    const report=candidate?.report||candidate||{},evidence=E?E.analyze(report,{kind}):null,values=evidence?.ema?.values||{},kd=evidence?.kd;
    return {index:index+1,code:candidateCode(candidate),score:top8Finite(candidate?.score?.final,candidate?.score,candidate?.finalScore,candidate?.conditionScore,candidate?.launchScore,candidate?.actionGate?.score),qualification:candidateQualification(candidate,kind),ema21:values[21]?.available?Number(values[21].value):null,ema50:values[50]?.available?Number(values[50].value):null,ema200:values[200]?.available?Number(values[200].value):null,k:kd?.available?Number(kd.k):null,d:kd?.available?Number(kd.d):null,rsi:evidence?.rsi5?.available?Number(evidence.rsi5.value):candidateRsi(candidate)};
  });
  out.dataset.r45Top8Audit=encodeURIComponent(JSON.stringify({kind,codes:auditRows.map(row=>row.code),rows:auditRows,orderPreserved:true,scorePreserved:true,qualificationPreserved:true,technicalEvidenceMatchedByCandidate:true}));
  out.dataset.r45IphoneAudit=encodeURIComponent(JSON.stringify({size:'1284x2778',sourceSize:'1284x2778',contentBox:{x:0,y:0,width:1284,height:2778},fullBleed:true,complete:true,overlap:false,candidates:candidates.length,integratedEvidence:true,bottomEvidenceRemoved:true}));
  return out;
}
function category(candidate){
  const fields=[candidate?.strategyType,candidate?.selectionType,candidate?.entryMode,candidate?.stage?.label,candidate?.stageSafety?.label,candidate?.action,candidate?.patternLabel,candidate?.mainAdvanceStage?.label].filter(Boolean).join('｜');
  if(/低位|轉強|起漲/.test(fields))return '低位轉強';
  if(/突破|站穩|確認/.test(fields))return '突破確認';
  if(/延續|續強|強勢/.test(fields))return '強勢延續';
  return candidate?.strategyType||candidate?.selectionType||candidate?.stage?.label||'其他型態';
}

function summaryRows(scan,kind){
  const candidates=Array.isArray(scan?.candidates)?scan.candidates:[];
  return candidates.map((candidate,index)=>({
    index,code:candidateCode(candidate),name:candidateName(candidate),grade:String(candidate?.grade||'-').toUpperCase(),
    close:candidateClose(candidate),rsi:candidateRsi(candidate),phase:candidatePhase(candidate),
    volumeText:window.ShitouScanPolicy5328.volumeText(candidate)+'｜'+window.ShitouScanPolicy5328.rsiStatus(candidate).icon+' '+window.ShitouScanPolicy5328.rsiStatus(candidate).label,qualification:candidateQualification(candidate,kind),category:category(candidate),date:reportDate(candidate?.report)||scan?.dataDate||scan?.createdAt||null
  }));
}

function pageHeader(context,title,scan,index,total,kind,count){
  const gradient=context.createLinearGradient(0,0,SUMMARY.width,0);gradient.addColorStop(0,kind==='momentum'?'#153b68':'#174c43');gradient.addColorStop(1,'#27648a');
  context.fillStyle=gradient;context.fillRect(0,0,SUMMARY.width,150);
  fitText(context,title,SUMMARY.side,52,SUMMARY.width-SUMMARY.side*2-170,{max:34,min:22,weight:950,color:'#fff'});
  fitText(context,`第 ${index}／${total} 頁`,SUMMARY.width-SUMMARY.side,52,150,{max:23,min:17,weight:900,color:'#e2f1ff',align:'right'});
  fitText(context,`原始入列 ${count} 檔｜行情 ${scan?.dataDate||scan?.createdAt||'日期依各股'}｜${RELEASE}`,SUMMARY.side,91,SUMMARY.width-SUMMARY.side*2,{max:17,min:10,weight:750,color:'#d8e8f5'});
  fitText(context,'每檔：名稱／代號／原始S-A-B／最新有效收盤／RSI 5T／行情階段／原始資格',SUMMARY.side,128,SUMMARY.width-SUMMARY.side*2,{max:17,min:11,weight:800,color:'#fff4bd'});
}

function buildSummaryPages(scan,kind){
  const rows=summaryRows(scan,kind),order=['突破確認','強勢延續','低位轉強'];
  const categories=[...new Set(rows.map(row=>row.category))];
  const groups=[...order.filter(value=>categories.includes(value)),...categories.filter(value=>!order.includes(value))].map(name=>({name,rows:rows.filter(row=>row.category===name)}));
  const tokens=[];for(const group of groups){tokens.push({type:'group',name:group.name,count:group.rows.length});for(const row of group.rows)tokens.push({type:'row',row,group:group.name});}
  if(!tokens.length)tokens.push({type:'empty'});
  const pageCapacity=SUMMARY.height-SUMMARY.top-SUMMARY.bottom;
  const pagesTokens=[];let current=[],used=0,lastGroup=null;
  for(const token of tokens){
    const height=token.type==='group'?48:token.type==='row'?174:160;
    if(used+height>pageCapacity&&current.length){pagesTokens.push(current);current=[];used=0;if(token.type==='row'&&lastGroup){current.push({type:'group',name:`${lastGroup}（續）`,count:null});used+=48;}}
    current.push(token);used+=height;if(token.type==='group')lastGroup=token.name;
  }
  if(current.length)pagesTokens.push(current);
  const title=kind==='momentum'?'主升段｜全部結果摘要':'當沖｜全部結果摘要';
  const rendered=[];
  const pages=pagesTokens.map((pageTokens,pageIndex)=>{
    const out=canvas(SUMMARY.width,SUMMARY.height,'#f2f6fa'),context=out.getContext('2d');pageHeader(context,title,scan,pageIndex+1,pagesTokens.length,kind,rows.length);
    let y=SUMMARY.top;
    for(const token of pageTokens){
      if(token.type==='group'){
        context.fillStyle='#dce9f5';context.fillRect(SUMMARY.side,y,SUMMARY.width-SUMMARY.side*2,40);
        fitText(context,`${token.name}${token.count===null?'':`｜${token.count} 檔`}`,SUMMARY.side+14,y+29,SUMMARY.width-SUMMARY.side*2-28,{max:22,min:16,weight:950,color:'#163b60'});y+=48;continue;
      }
      if(token.type==='empty'){
        rounded(context,SUMMARY.side,y,SUMMARY.width-SUMMARY.side*2,126,16,'#fff');fitText(context,'本次原始報告沒有入列股票。',SUMMARY.width/2,y+72,SUMMARY.width-SUMMARY.side*2-60,{max:27,min:20,weight:900,color:'#66758a',align:'center'});y+=160;continue;
      }
      const row=token.row,gradeColor=row.grade==='S'?'#8f2f68':row.grade==='A'?'#176a45':row.grade==='B'?'#a7640a':'#677386';
      rounded(context,SUMMARY.side,y,SUMMARY.width-SUMMARY.side*2,166,14,'#fff');context.fillStyle=gradeColor;context.fillRect(SUMMARY.side,y,8,166);
      fitText(context,`${row.index+1}. ${row.name}（${row.code}）`,SUMMARY.side+22,y+45,430,{max:28,min:18,weight:950,color:'#162f4b'});
      fitText(context,`${row.grade}級`,SUMMARY.side+465,y+45,88,{max:22,min:16,weight:950,color:gradeColor});
      fitText(context,row.close===null?'收盤：資料不足':`收盤 ${E?E.price(row.close):row.close}`,SUMMARY.side+565,y+45,210,{max:25,min:17,weight:900,color:'#bd303d'});
      fitText(context,row.rsi===null?'RSI 5T：資料不足':`RSI 5T ${E?E.price(row.rsi,2):row.rsi}`,SUMMARY.side+790,y+45,210,{max:25,min:17,weight:900,color:'#a65f08'});
      fitText(context,`階段：${row.phase}`,SUMMARY.side+22,y+104,510,{max:24,min:16,weight:800,color:'#315777'});
      fitText(context,`資格：${row.qualification}`,SUMMARY.side+565,y+104,500,{max:24,min:16,weight:850,color:'#4e3f70'});
      fitText(context,row.volumeText,SUMMARY.side+22,y+147,SUMMARY.width-SUMMARY.side*2-44,{max:23,min:17,weight:850,color:'#224866'});
      rendered.push(row.code);y+=174;
    }
    context.fillStyle='#153b5b';context.fillRect(0,SUMMARY.height-SUMMARY.bottom,SUMMARY.width,SUMMARY.bottom);
    fitText(context,`數量核對 ${rows.length}／${rendered.length}（累計）｜iPhone 12 Pro Max 滿版分頁｜每檔資料不跨頁`,SUMMARY.side,SUMMARY.height-39,SUMMARY.width-SUMMARY.side*2,{max:24,min:16,weight:800,color:'#edf6ff'});
    out.dataset.r45SummaryAudit=encodeURIComponent(JSON.stringify({size:`${out.width}x${out.height}`,page:pageIndex+1,pages:pagesTokens.length,expected:rows.length,renderedOnAllPages:rendered.length}));
    return out;
  });
  const expected=rows.map(row=>row.code),ok=expected.length===rendered.length&&expected.every(code=>rendered.includes(code))&&new Set(rendered).size===rendered.length;
  pages.forEach(page=>page.dataset.r45SummaryFinalAudit=encodeURIComponent(JSON.stringify({expected:expected.length,rendered:rendered.length,unique:new Set(rendered).size,ok})));
  return {pages,rows,rendered,ok,size:'1284x2778'};
}

async function setPreviewPage(index){
  if(!previewSet)return;
  previewSet.index=Math.max(0,Math.min(index,previewSet.pages.length-1));
  const page=previewSet.pages[previewSet.index],value=await blob(page);
  if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(value);
  const image=document.getElementById('imagePreviewImg'),link=document.getElementById('imageDownloadLink'),title=document.getElementById('imagePreviewTitle');
  if(image)image.src=previewUrl;if(link){link.href=previewUrl;link.download=previewSet.names[previewSet.index];}
  if(title)title.textContent=previewSet.pages.length===1?`🖼️ ${previewSet.title}｜單一張完整長圖`:`🖼️ ${previewSet.title}｜第 ${previewSet.index+1}/${previewSet.pages.length} 頁`;
  const label=document.getElementById('r45PreviewPageLabel');if(label)label.textContent=previewSet.pages.length===1?'單一張完整長圖':`第 ${previewSet.index+1}／${previewSet.pages.length} 頁`;
  const prev=document.getElementById('r45PreviewPrev'),next=document.getElementById('r45PreviewNext');if(prev)prev.disabled=previewSet.index===0;if(next)next.disabled=previewSet.index===previewSet.pages.length-1;
}

function mountPreviewActions(){
  const actions=document.querySelector('#imagePreviewModal .image-modal-actions');if(!actions)return;
  let group=actions.querySelector('.r45-preview-actions');
  if(!group){
    group=document.createElement('div');group.className='r45-preview-actions';
    group.innerHTML='<button id="r45PreviewPrev" type="button">← 上一頁</button><strong id="r45PreviewPageLabel"></strong><button id="r45PreviewNext" type="button">下一頁 →</button><button id="r45PreviewZip" type="button">⬇️ 下載完整 ZIP</button>';
    actions.append(group);
    group.querySelector('#r45PreviewPrev').addEventListener('click',()=>setPreviewPage((previewSet?.index||0)-1));
    group.querySelector('#r45PreviewNext').addEventListener('click',()=>setPreviewPage((previewSet?.index||0)+1));
    group.querySelector('#r45PreviewZip').addEventListener('click',async()=>{
      if(!previewSet)return;const button=group.querySelector('#r45PreviewZip'),old=button.textContent;button.disabled=true;button.textContent='正在打包…';
      try{
        const entries=[];for(let i=0;i<previewSet.pages.length;i++){const value=await blob(previewSet.pages[i]);entries.push({name:previewSet.names[i],bytes:new Uint8Array(await value.arrayBuffer())});}
        download(zip(entries),previewSet.zipName);
      }finally{button.disabled=false;button.textContent=old;}
    });
  }
  group.hidden=!previewSet||previewSet.pages.length<=1;
}

async function showPages(pages,{title,prefix,date='latest',note='',kind='report'}={}){
  if(!Array.isArray(pages)||!pages.length)throw new Error('沒有可預覽的頁面');
  if(kind==='stock'&&window.ShitouStockImageColors)pages.forEach(page=>window.ShitouStockImageColors.enhance(page));
  const iphoneSingle=pages.length===1&&pages[0]?.dataset?.iphoneFullScreen==='1284x2778';
  const names=pages.length===1?[safeName(`${prefix}_${iphoneSingle?'iPhone12ProMax_1284x2778_單張滿版':'單一張完整長圖'}_${date}_${FILE_VERSION}.png`)]:pages.map((_,index)=>safeName(`${prefix}_${String(index+1).padStart(2,'0')}-${pages.length}_${date}_${FILE_VERSION}.png`));
  previewSet={pages,names,title,index:0,zipName:safeName(`${prefix}_完整${pages.length}頁_${date}_${FILE_VERSION}.zip`),kind};
  if(typeof original.show==='function')await original.show(pages[0],names[0],`${title}｜第 1/${pages.length} 頁`);
  mountPreviewActions();await setPreviewPage(0);
  const element=document.getElementById('imagePreviewNote');if(element)element.textContent=pages.length===1?`${note}｜${pages[0]?.dataset?.iphoneFullScreen==='1284x2778'?'已輸出 1284×2778 單張滿版 PNG':'完整內容已合併為單一張 PNG'}，可直接預覽或下載。`:`${note}｜共 ${pages.length} 頁；可逐頁預覽／下載，或下載完整ZIP。`;
  return previewSet;
}

async function captureStock(mode){
  let captured=null;
  if(typeof original.stockGenerator==='function'){
    const currentShow=window.showInfographicPreviewV3328;
    window.showInfographicPreviewV3328=async source=>{captured=source;};
    try{await original.stockGenerator(mode,false);}finally{window.showInfographicPreviewV3328=currentShow;}
  }
  if(!captured){
    const report=typeof lastReportData!=='undefined'?lastReportData:null;
    const render=mode==='professional'?window.renderStockProfessionalInfographicV51:window.renderStockInfographicV46;
    if(report&&typeof render==='function')captured=render(report);
  }
  if(!captured)throw new Error('個股原始圖片尚未產生');return captured;
}

async function generateStock(mode='beginner',withWatermark=false){
  const report=typeof lastReportData!=='undefined'?lastReportData:null;if(!report)throw new Error('請先完成個股分析');
  if(document.fonts?.ready)await document.fonts.ready;
  // Render the two formats directly. Re-running the old image generator appended
  // assistant/evidence strips over already complete V50 canvases.
  const professional=mode==='professional',renderer=professional?window.renderStockProfessionalInfographicV51:window.renderStockInfographicV46;
  if(typeof renderer!=='function')throw new Error('個股圖片產生器不存在');
  const source=renderer(report);if(!source)throw new Error('個股圖片畫布不存在');
  let result;
  if(professional||source.dataset?.unifiedReport==='true'){
    if(withWatermark&&typeof original.watermark==='function')original.watermark(source,'stock');
    result={pages:[source],segments:[[0,source.height]],sourceHeight:source.height,size:`${source.width}x${source.height}`,singleLong:true,professionalFull:professional,iphoneFullScreen:source.dataset?.iphoneFullScreen==='1284x2778',fullBleed:source.dataset?.iphoneFullScreen==='1284x2778',fitScale:1};
  }else result=fitIphoneStockReport(source,{title:`${report.name||report.code}（${report.code||report.stock||'-'}）個股新手報告`,date:report.closeDate,watermark:withWatermark});
  const layoutNote=result.iphoneFullScreen?'iPhone 12 Pro Max 1284×2778 單張滿版；A～F 僅重排版、不改分析內容':source.dataset?.unifiedReport==='true'?'統一版面單張長圖；高度隨完整內容調整':professional?'專業完整內容保留為單張長圖，避免縮小文字或裁切證據':'內容無法在可讀比例下單頁容納，已安全分頁';
  await showPages(result.pages,{title:`${report.name||report.code} 個股圖片報告`,prefix:`石頭少爺_${report.name||report.code}_${report.code||report.stock}_${professional?'專業完整':'新手'}個股圖片報告${withWatermark?'_防盜浮水印':''}`,date:dateOf(report.closeDate),note:`${layoutNote}；新手結論與專業證據分區呈現，價位不是自動買點`,kind:'stock'});
  return result;
}

async function generateMarket(withWatermark=false){
  const report=typeof lastMarketReportData!=='undefined'?lastMarketReportData:null;if(!report)throw new Error('請先完成大盤分析');
  if(document.fonts?.ready)await document.fonts.ready;
  const result=buildMarketIphoneReport(report,withWatermark);
  await showPages(result.pages,{title:'臺灣加權股價指數大盤圖片報告',prefix:`石頭少爺_TAIEX_大盤分析圖${withWatermark?'_防盜浮水印':''}`,date:dateOf(report.closeDate),note:'iPhone 12 Pro Max 1284×2778 原生模板滿版；保留ABC、真實K線、量能、三劇本與三條關鍵線，不另加頁首、頁尾或重複技術附錄',kind:'market'});
  return result;
}

function buildMarketIphoneReport(report,withWatermark=false){
  if(typeof original.marketRender!=='function')throw new Error('大盤原始圖片產生器不存在');
  const source=original.marketRender(report);source.dataset.reportMode='market';
  return fitIphoneStockReport(source,{title:'臺灣加權股價指數（TAIEX）大盤分析',date:report?.closeDate,watermark:withWatermark,watermarkKind:'market'});
}

async function generateDetailed(kind,withWatermark=false){
  const scan=kind==='momentum'?(typeof lastMomentumScanDataV3762!=='undefined'?lastMomentumScanDataV3762:null):(typeof lastDayTradeScanDataV1!=='undefined'?lastDayTradeScanDataV1:null);
  if(!scan)throw new Error(kind==='momentum'?'請先完成主升段掃描':'請先完成當沖掃描');
  if(document.fonts?.ready)await document.fonts.ready;
  const candidates=(scan.candidates||scan.launchCandidates||[]).slice(0,8);
  const title=kind==='momentum'?'主升段前八名詳細圖片':'當沖前八名詳細圖片';
  const page=buildTop8IphoneReport(scan,kind);if(withWatermark&&typeof original.watermark==='function')original.watermark(page,'all');
  const result={pages:[page],segments:[[0,IPHONE_12_PRO_MAX.height]],sourceHeight:IPHONE_12_PRO_MAX.height,size:'1284x2778',singleLong:true,iphoneFullScreen:true,fullBleed:true,fitScale:1,scaleX:1,scaleY:1};
  await showPages(result.pages,{title,prefix:`石頭少爺_${kind==='momentum'?'主升段':'當沖'}_前八名_iPhone12ProMax滿版${withWatermark?'_防盜浮水印':''}`,date:dateOf(scan.dataDate||scan.createdAt),note:`沿用原始展示順序 ${candidates.length} 檔；原生 1284×2778 單頁滿版；EMA、KD、RSI5 已整合到每檔卡片，底部重複證據區已移除`,kind});
  return result;
}

async function generateSummary(kind,withWatermark=false){
  const scan=kind==='momentum'?(typeof lastMomentumScanDataV3762!=='undefined'?lastMomentumScanDataV3762:null):(typeof lastDayTradeScanDataV1!=='undefined'?lastDayTradeScanDataV1:null);
  if(!scan)throw new Error(kind==='momentum'?'請先完成主升段掃描':'請先完成當沖掃描');
  if(document.fonts?.ready)await document.fonts.ready;
  const result=buildSummaryPages(scan,kind);if(!result.ok)throw new Error(`摘要名單核對失敗：預期 ${result.rows.length}，實際 ${result.rendered.length}`);
  if(withWatermark&&typeof original.watermark==='function')result.pages.forEach(page=>original.watermark(page,'all'));
  const title=kind==='momentum'?'主升段全部結果摘要':'當沖全部結果摘要';
  await showPages(result.pages,{title,prefix:`石頭少爺_${kind==='momentum'?'主升段':'當沖'}_全部結果摘要${withWatermark?'_防盜浮水印':''}`,date:dateOf(scan.dataDate||scan.createdAt),note:`1284×2778 iPhone 12 Pro Max 滿版分頁；原始入列 ${result.rows.length} 檔，實際輸出 ${result.rendered.length} 檔，沒有遺漏或重複`,kind});
  return result;
}

async function copyFirst(resultFactory,messageId){
  try{
    const result=await resultFactory(),page=result.pages[0],value=await blob(page);
    if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
      await navigator.clipboard.write([new ClipboardItem({'image/png':value})]);
      const message=document.getElementById(messageId);if(message)message.textContent=result.pages.length===1?'✅ 已複製單一張完整長圖 PNG。':'✅ 已複製第1頁PNG；完整多頁請使用ZIP下載。';return;
    }
    const message=document.getElementById(messageId);if(message)message.textContent='⚠️ 瀏覽器不支援圖片剪貼簿，已開啟完整分頁預覽。';
  }catch(error){const message=document.getElementById(messageId);if(message)message.textContent=`❌ ${error.message}`;}
}

window.generateStockImageByModeV51=(mode='beginner',withWatermark=false)=>generateStock(mode,withWatermark).catch(error=>{const message=document.getElementById('copyMessage');if(message)message.textContent=`❌ 個股圖片產生失敗：${error.message}`;throw error;});
window.generateStockBeginnerInfographicV51=(withWatermark=false)=>window.generateStockImageByModeV51('beginner',withWatermark);
window.generateStockProfessionalInfographicV51=(withWatermark=false)=>window.generateStockImageByModeV51('professional',withWatermark);
window.generateStockInfographicV3328=window.generateStockBeginnerInfographicV51;
window.generateMarketInfographicV3328=(withWatermark=false)=>generateMarket(withWatermark).catch(error=>{const message=document.getElementById('marketCopyMessage');if(message)message.textContent=`❌ 大盤圖片產生失敗：${error.message}`;throw error;});
window.generateMomentumScanImageV3762=(withWatermark=false)=>generateDetailed('momentum',withWatermark);
window.downloadMomentumTop8ImageWatermarkV377716=()=>generateDetailed('momentum',true);
window.downloadMomentumAllCandidatesImageV377715=()=>generateSummary('momentum',false);
window.downloadMomentumAllCandidatesImageWatermarkV377716=()=>generateSummary('momentum',true);
window.generateDayTradeImageV1=(withWatermark=false)=>generateDetailed('daytrade',withWatermark);
window.downloadDayTradeAllCandidatesImageV1=(withWatermark=false)=>generateSummary('daytrade',withWatermark);
window.copyDayTradeTop8ImageV377727=(withWatermark=false)=>copyFirst(()=>generateDetailed('daytrade',withWatermark),'dayTradeImageMessage');
window.copyDayTradeAllCandidatesImageV377727=(withWatermark=false)=>copyFirst(()=>generateSummary('daytrade',withWatermark),'dayTradeImageMessage');

// Additive shared preview entrypoint for the independent third scanner; existing report generation unchanged.
window.strongStockShowPagesV47=showPages;
window.R45_REPORT_TEST_API=Object.freeze({
  release:RELEASE,detailSize:{...DETAIL},summarySize:{...SUMMARY},summaryRows,buildSummaryPages,buildTop8IphoneReport,
  paginateDetailed,singleLongDetailed,fitIphoneStockReport,prepareStockBaseForIphone,appendStockCompactEvidence,buildMarketIphoneReport,appendEvidence,removeScanIndustryAppend,evidenceLines,zip,blob,
  audits:{originalOrderPreserved:true,summaryIncludesAllCandidates:true,workerChanged:false,scoreChanged:false,qualificationChanged:false}
});
})();
