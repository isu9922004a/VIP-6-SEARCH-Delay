/* Read-only action guide: all numbers come from the existing research plan. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouResearchActionGuide=api;})(globalThis,function(){
'use strict';
const VERSION='ACTION_GUIDE_8_2_10',TITLE='四策略研究｜白話行動指南';
const TITLES=['現在方向與資料狀態','還沒買，先等什麼？','已有持股，看懂價位用途','下一交易日，開盤怎麼看？','想放空？目前也先等','還缺什麼確認？'];
const finite=Number.isFinite,price=n=>finite(n)&&n>0?String(+n.toFixed(2))+' 元':'價位尚未取得';
const amount=n=>finite(n)?String(+n.toFixed(2))+' 元':'尚無法比較';
const rowText=r=>[r.price,r.label,...r.bullets].filter(Boolean).join('\n');
const sectionText=s=>[...(s.rows||[]).map(rowText),...(s.callout?[s.callout.title,...s.callout.lines]:[])].join('\n');
function build(a,plan,context){
 const technical=a.validation?.technicalModelAvailable===true,issues=plan.dataIssues||[],data=plan.state==='DATA',failed=a.state==='BREAKOUT_FAILURE',good=plan.state==='CONDITIONAL'&&!!plan.entryRange&&!issues.length&&!failed;
 const bear=plan.bear||{},hasWatch=technical&&plan.watch>0,hasStop=technical&&plan.stop>0,hasTarget=technical&&plan.target>0;
 const headline=failed?'原買進理由已失效，先不買':data?'先不下單：'+(issues[0]?.reason||plan.reason):good?'盤後條件通過，盤中仍須確認':plan.weak?'短線偏弱，先觀察':'先觀察，現在不追價';
 const statusLines=[good?'尚未持股：盤中確認後，才評估新部位。':'尚未持股：暫不建立新部位。'];
 if(!data&&context?.direction)statusLines.push(...context.direction.split('\n'));
 else if(data&&plan.weak)statusLines.push('可計算部分顯示短線偏弱；完整行情仍需核對。');
 if(hasWatch)statusLines.push((plan.close<plan.watch?'先看 '+price(plan.watch)+'能否站回':'先看 '+price(plan.watch)+'能否守穩')+'；漲過不等於可以買。');
 if(!technical&&a.quote?.verified&&plan.close>0)statusLines.push('同日官方收盤 '+price(plan.close)+'已取得；完整日線尚未通過。');
 const firstBullets=!hasWatch?['日線尚未確認完整，暫不列買價。']:good?[
  '盤後條件已通過，仍須確認開盤後回落守住觀察價，再轉強。',
  '確認後才評估 '+price(plan.entryRange.low)+'～'+price(plan.entryRange.high)+'；超過不追。',
  '完整盤中規則見研究明細；本頁沒有即時5分鐘行情。'
 ]:[plan.close<plan.watch?'未站回：繼續等。':'已在觀察價附近或上方：仍要看後續能否守穩。',
  plan.close<plan.watch?'收回後：重新檢查趨勢、確認條件與買價空間。':'維持在上方後：重新檢查趨勢、確認條件與買價空間。',
  '目前沒有通過檢查的買價區間，先不追。'];
 if(data)firstBullets.push('資料檢查尚未通過，以上僅為候選觀察，先不下單。');
 let comparison;
 if(hasWatch&&hasTarget&&hasStop&&plan.target>plan.watch&&plan.watch>plan.stop){
  const entry=+plan.watch.toFixed(2),target=+plan.target.toFixed(2),stop=+plan.stop.toFixed(2),reward=+(target-entry).toFixed(2),risk=+(entry-stop).toFixed(2);
  if(reward>0&&risk>0)comparison={entry,target,stop,reward,risk,ratio:reward/risk,costsIncluded:false};
 }
 const callout={title:good?'買進空間與風險怎麼比？':plan.close>=plan.watch?'為什麼碰到價位還不能直接買？':'為什麼站回還不能直接買？',lines:comparison?[
  '假設買在 '+price(comparison.entry)+'：',
  '到 '+price(comparison.target)+(comparison.reward<comparison.risk?'只有 ':'相差 ')+amount(comparison.reward)+'；到 '+price(comparison.stop)+'相差 '+amount(comparison.risk)+'。',
  '未扣成本，上方價差'+(comparison.reward<comparison.risk?'小於':comparison.reward>comparison.risk?'大於':'等於')+'向下風險'+(comparison.reward>=comparison.risk?'；仍須通過其他條件。':'。'),
  '這是比較試算，'+price(comparison.entry)+'並非已核准買價。'
 ]:[hasTarget?'缺少可比較的觀察價或防守價，先不拼成買賣計畫。':'上方歷史關卡不足，無法完整比較上方空間與向下風險。','觀察價不等於買價；目前條件仍須逐項核對。']};
 const sections=[
  {number:'01',title:TITLES[1],rows:[{icon:'trend',price:hasWatch?price(plan.watch):'暫不列價位',label:'轉強觀察線',bullets:firstBullets}],callout},
  {number:'02',title:TITLES[2],rows:[
   {icon:'shield',price:hasStop?price(plan.stop):'暫不列價位',label:'新買防守試算',bullets:['不是每位持股者通用的停損價。','請核對自己的成本、進場理由與原定停損。']},
   {icon:'bars',price:hasTarget?price(plan.target)+'附近':'上方歷史關卡不足',label:'持股檢視關卡',bullets:hasTarget?['已經獲利者，可評估是否先賣出一部分。','尚未獲利者，不能把這裡一律當成停利點。','不要因期待反彈，就把原停損往下移。']:['上方歷史關卡不足，不預設停利目標。','仍需依自己的成本、持股數量與原本計畫管理。']}
  ]},
  {number:'03',title:TITLES[3],bands:true,rows:[]},
  {number:'04',title:TITLES[4],rows:[
   {icon:'fall',price:technical&&bear.watch>0?price(bear.watch):'暫不列價位',label:'轉弱觀察線',bullets:['跌破不代表放空條件已全部通過。']},
   {icon:'shield',price:technical&&bear.stop>0?price(bear.stop):'暫不列價位',label:'空單停損試算',bullets:['用於有效空單計畫的風險評估，並非買進訊號。','目前沒有可直接執行的放空計畫，不追空。']}
  ]},
  {number:'05',title:TITLES[5],compact:true,rows:[{icon:'search',price:'',label:'',bullets:[]}]}
 ];
 const bands=sections[2].rows;
 if(hasWatch&&technical&&bear.watch>0&&bear.watch<plan.watch){
  bands.push({icon:'up',tone:'aqua',price:'高於 '+price(plan.watch),label:'',bullets:[good?'仍須依完整盤中規則確認，不直接追買。':'觀察價格修復，仍不直接追買。']},
   {icon:'flat',price:String(+bear.watch.toFixed(2))+'～'+String(+plan.watch.toFixed(2))+' 元',label:'',bullets:[good?'等盤中條件確認，不因開盤落在區間就買。':'繼續等，目前沒有合適的新買計畫。']},
   {icon:'down',tone:'red',price:'低於 '+price(bear.watch),label:'',bullets:['留意進一步轉弱，不因跌深就買。']});
 }else if(hasWatch){
  bands.push({icon:'up',tone:'aqua',price:'高於 '+price(plan.watch),label:'',bullets:['仍須核對趨勢、確認條件與買價空間。']},
   {icon:'flat',price:'接近 '+price(plan.watch),label:'',bullets:['先看是否守穩，不因碰到價位就買。']},
   {icon:'down',tone:'red',price:'低於 '+price(plan.watch),label:'',bullets:['留意跌回觀察價下方，不因便宜就買。']});
 }else bands.push({icon:'flat',price:'先等行情核對',label:'',bullets:['日線還沒確認完整，暫不列開盤觀察區間。']});
 if(failed)bands.forEach(r=>r.bullets=['原買進理由已失效，先等新條件形成，不沿用原計畫。']);
 if(data)bands.forEach(r=>r.bullets.push('資料尚未通過，不能依此下單。'));
 const pending=sections[4].rows[0].bullets;
 if(!technical)pending.push(issues[0]?.reason||'日線還沒確認完整，暫不解讀量價。');
 else if(context?.volumeVerified){pending.push('成交量來源已完成本次核對。',context.volumeShort,'量增減本身不能證明洗盤或主力進場。');}
 else pending.push(context?.volumeShort||'成交量來源尚未核對，暫不解讀量增減。','目前不能據此判定放量反攻、洗盤或主力進場。');
 for(const issue of issues)if(!pending.some(x=>x.includes(issue.reason)))pending.push(issue.reason+'。');
 pending.push('日線站回須看收盤；盤中仍需另行確認，本頁沒有即時分K。');
 const status={title:TITLES[0],headline,lines:statusLines,tone:failed?'red':good?'aqua':'yellow'};
 const summary=[{title:status.title,value:[headline,...status.lines].join('\n')},...sections.map(s=>({title:s.title,value:sectionText(s)}))];
 return {version:VERSION,title:TITLE,badge:'白話版研究',code:a.code,name:a.name,date:a.date,close:plan.close,status,sections,summary,comparison,guideNote:'盤後研究｜未提供即時盤中確認｜非個人持倉計畫\n試算未驗證績效；價位不是已確認支撐；跳空可能以更差價格成交。'};
}
function svg(doc,kind){
 const ns='http://www.w3.org/2000/svg',s=doc.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 64 64');s.setAttribute('aria-hidden','true');
 const paths={shield:'M32 5 L55 15 L51 39 L32 58 L13 39 L9 15 Z M21 31 L29 39 L44 22',trend:'M9 50 L22 37 L31 42 L52 15 M37 15 L52 15 L52 30 M12 57 L12 48 M25 57 L25 44 M39 57 L39 36 M52 57 L52 28',fall:'M10 13 L24 29 L33 24 L52 48 M39 48 L52 48 L52 35',bars:'M12 54 L12 39 M27 54 L27 28 M42 54 L42 17 M56 54 L56 8',search:'M13 7 L39 7 L47 15 L47 31 M13 7 L13 54 L30 54 M21 18 L36 18 M21 27 L35 27 M45 46 L59 59',up:'M32 52 L32 12 M16 28 L32 12 L48 28',down:'M32 12 L32 52 M16 36 L32 52 L48 36',flat:'M15 32 L49 32',alert:'M32 12 L32 36 M32 48 L32 49'};
 const p=doc.createElementNS(ns,'path');p.setAttribute('d',paths[kind]||paths.alert);p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','5');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');s.appendChild(p);return s;
}
function mount(doc,guide){
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const root=el('section','research-action-guide');root.dataset.actionGuide=VERSION;
 const header=el('header','action-header');header.append(el('div','action-kicker',guide.title),el('strong','action-stock',guide.name+'（'+guide.code+'）'),el('div','action-date','行情基準 '+(guide.date||'待核驗').replaceAll('-','/')+'｜收盤 '+price(guide.close)),el('span','action-badge',guide.badge));root.append(header);
 function field(title,value){const box=el('section','research-card-field action-section'),key=el('span','research-card-label',title),body=el('div','research-card-value');box.append(key,body);return {box,key,body};}
 const status=field(guide.status.title);status.box.classList.add('action-status','action-tone-'+guide.status.tone);status.key.classList.add('action-sr-only');
 const icon=el('span','action-status-icon');icon.append(svg(doc,'alert'));status.box.prepend(icon);status.body.append(el('strong','action-headline',guide.status.headline));
 guide.status.lines.forEach(line=>status.body.append(doc.createTextNode('\n'),el('div','action-status-line',line)));root.append(status.box);
 for(const section of guide.sections){const f=field(section.title),heading=el('div','action-section-heading'),number=el('span','action-number',section.number);number.setAttribute('aria-hidden','true');heading.append(number,f.key);f.box.prepend(heading);f.box.classList.toggle('action-bands',!!section.bands);f.box.classList.toggle('action-compact',!!section.compact);
  section.rows.forEach((row,i)=>{if(i)f.body.append(doc.createTextNode('\n'));const r=el('div','action-row'+(row.tone?' action-tone-'+row.tone:'')),metric=el('div','action-metric'),ic=el('span','action-row-icon');ic.append(svg(doc,row.icon));metric.append(ic);const words=el('div','action-metric-words');let has=false;
   if(row.price){words.append(el('strong','action-price',row.price));has=true;}if(row.label){if(has)words.append(doc.createTextNode('\n'));words.append(el('span','action-price-label',row.label));has=true;}metric.append(words);r.append(metric);
   const ul=el('div','action-bullets');row.bullets.forEach((line,j)=>{if(j)ul.append(doc.createTextNode('\n'));ul.append(el('div','action-bullet',line));});if(has&&row.bullets.length)r.append(doc.createTextNode('\n'));r.append(ul);f.body.append(r);
  });
  if(section.callout){f.body.append(doc.createTextNode('\n'));const c=el('aside','action-callout');c.append(el('strong','action-callout-title',section.callout.title));for(const line of section.callout.lines)c.append(doc.createTextNode('\n'),el('div','action-callout-line',line));f.body.append(c);}root.append(f.box);
 }
 root.append(el('p','action-footer',guide.guideNote));return root;
}
// Canvas layout is measured before painting, so no paragraph is clipped or omitted.
function pages(a,report,{doc,displayCode,watermark,stockMode,wrap,roundRectPath}){
 const guide=report.actionGuide,W=1284,M=30,CW=W-2*M,FONT=34,LINE=46,ctx=doc.createElement('canvas').getContext('2d');let H=2778;
 const font=(size,weight=700)=>{ctx.font=`${weight} ${size}px "Microsoft JhengHei","Noto Sans CJK TC",sans-serif`;};
 const measure=(text,width,size=FONT)=>{font(size);return wrap(ctx,String(text),width);};
 const stockLines=measure(guide.name+'（'+guide.code+'）',CW-300,80),headerH=164+stockLines.length*88;
 const statusLines=guide.status.lines.flatMap(s=>measure(s,CW-220,36)),headLines=measure(guide.status.headline,CW-220,60),statusH=44+headLines.length*76+statusLines.length*49+20;
 const layouts=guide.sections.map(section=>{
  const title=measure(section.title,CW-140,50),titleH=32+title.length*64;
  const rows=section.rows.map(row=>{
   const left=section.compact?150:section.bands?460:430,right=CW-left-76;
   const p=measure(row.price||'',left-116,section.bands?44:50),label=row.label?measure(row.label,left-116,32):[];
   const bullets=row.bullets.map(text=>measure(text,right));const lines=bullets.reduce((n,b)=>n+b.length,0);
   return {row,left,p:row.price?p:[],label,bullets,height:Math.max(section.bands?82:136,lines*LINE+28,(row.price?p.length*60:0)+label.length*42+32)};
  });
  const callout=section.callout?{title:measure(section.callout.title,CW-100,40),lines:section.callout.lines.flatMap(s=>measure(s,CW-100))}:null;
  return {section,title,titleH,rows,callout,height:titleH+rows.reduce((s,r)=>s+r.height+10,0)+(callout?callout.title.length*54+callout.lines.length*LINE+42:0)+18};
 });
 let y=20;const headerY=y;y+=headerH+20;const statusY=y;y+=statusH+20;
 for(const l of layouts){l.top=y;y+=l.height+18;}const bodyBottom=y-18;H=Math.max(H,bodyBottom+150);
 const fields=report.summary.map(f=>({...f}));
 function panel(x,px,py,pw,ph,stroke='#24617f',fill){
  x.fillStyle=fill||'#10344f';if(!fill&&x.createLinearGradient){const g=x.createLinearGradient(px,py,px+pw,py+ph);g.addColorStop(0,'#123c58');g.addColorStop(1,'#0c2b43');x.fillStyle=g;}
  roundRectPath(x,px,py,pw,ph,30);x.fill();x.lineWidth=2;x.strokeStyle=stroke;x.stroke();
 }
 function lines(x,rows,px,py,size=FONT,color='#f0f6fb',line=LINE,weight=700){x.fillStyle=color;x.font=`${weight} ${size}px "Microsoft JhengHei","Noto Sans CJK TC",sans-serif`;rows.forEach((s,i)=>x.fillText(s,px,py+i*line));}
 function icon(x,kind,cx,cy,size=46,color='#64e2de'){
  x.save();x.translate(cx-size/2,cy-size/2);x.scale(size/64,size/64);x.strokeStyle=color;x.lineWidth=5;x.lineCap='round';x.lineJoin='round';x.beginPath();
  const path=points=>{points.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));};
  if(kind==='shield'){path([[32,5],[55,15],[51,39],[32,58],[13,39],[9,15],[32,5]]);path([[21,31],[29,39],[44,22]]);}
  else if(kind==='trend'||kind==='fall'){path(kind==='trend'?[[9,50],[22,37],[31,42],[52,15],[37,15]]:[[10,13],[24,29],[33,24],[52,48],[39,48]]);path(kind==='trend'?[[52,15],[52,30]]:[[52,48],[52,35]]);}
  else if(kind==='bars'){for(let i=0;i<4;i++)path([[12+i*14,54],[12+i*14,40-i*10]]);}
  else if(kind==='search'){path([[13,54],[13,7],[39,7],[47,15],[47,28]]);path([[22,19],[36,19]]);path([[22,28],[34,28]]);x.moveTo(52,42);x.arc(40,42,12,0,Math.PI*2);path([[49,51],[59,61]]);}
  else if(kind==='up'||kind==='down'){path(kind==='up'?[[32,52],[32,12],[16,28]]:[[32,12],[32,52],[16,36]]);path(kind==='up'?[[32,12],[48,28]]:[[32,52],[48,36]]);}
  else if(kind==='flat')path([[15,32],[49,32]]);else {path([[32,12],[32,36]]);path([[32,48],[32,49]]);}x.stroke();x.restore();
 }
 function paint(x){
  x.fillStyle='#071f32';x.fillRect(0,0,W,H);panel(x,M,headerY,CW,headerH);
  lines(x,[guide.title],M+40,headerY+58,39,'#b8e2f5');lines(x,stockLines,M+40,headerY+155,80,'#fff',88,850);
  lines(x,['行情基準 '+(guide.date||'待核驗').replaceAll('-','/')+'｜收盤 '+price(guide.close)],M+40,headerY+headerH-28,38,'#b8dff0');
  panel(x,W-M-270,headerY+headerH-125,230,70,'#7bbbd5','#164566');lines(x,[guide.badge],W-M-248,headerY+headerH-77,34,'#d8f2ff');
  const tone=guide.status.tone==='aqua'?'#68e7cf':guide.status.tone==='red'?'#ff8073':'#ffd451';panel(x,M,statusY,CW,statusH,tone,'#252c28');
  x.fillStyle=tone;x.beginPath();x.arc(M+90,statusY+91,55,0,Math.PI*2);x.fill();icon(x,'alert',M+90,statusY+91,60,'#09354b');
  lines(x,headLines,M+180,statusY+86,60,tone,76,850);lines(x,statusLines,M+180,statusY+86+headLines.length*76,36,'#fff',49);
  for(const l of layouts){const s=l.section;panel(x,M,l.top,CW,l.height);x.fillStyle='#25a5eb';x.beginPath();x.arc(M+64,l.top+52,43,0,Math.PI*2);x.fill();lines(x,[s.number],M+34,l.top+70,44,'#fff');lines(x,l.title,M+140,l.top+65,50,'#fff',64,850);
   let ry=l.top+l.titleH;
   for(const r of l.rows){const row=r.row,color=row.tone==='red'||row.icon==='fall'?'#ff8576':row.tone==='aqua'?'#69e6d1':'#a6e5fc';
    if(s.bands)panel(x,M+22,ry,CW-44,r.height,'#2d6680','#103950');else if(!s.compact)panel(x,M+42,ry,r.left-34,r.height,'#53a8c9','#12425e');
    const divider=M+r.left+8;x.strokeStyle='#467d98';x.lineWidth=2;x.beginPath();x.moveTo(divider,ry+10);x.lineTo(divider,ry+r.height-10);x.stroke();
    icon(x,row.icon,M+(s.compact?88:90),ry+r.height/2,s.compact?96:66,row.icon==='fall'?'#ffc75c':color);
    if(!s.compact){let py=ry+22;lines(x,r.p,M+145,py+46,s.bands?44:50,color,60);py+=r.p.length*60;lines(x,r.label,M+145,py+32,32,'#b7e4f5',42);}
    let by=ry+38;for(const bullet of r.bullets){x.fillStyle='#64dcea';x.beginPath();x.arc(divider+30,by-11,7,0,Math.PI*2);x.fill();lines(x,bullet,divider+56,by,FONT,'#f3f7fb');by+=bullet.length*LINE;}ry+=r.height+10;
   }
   if(l.callout){const h=l.callout.title.length*54+l.callout.lines.length*LINE+42;panel(x,M+28,ry,CW-56,h);lines(x,l.callout.title,M+54,ry+48,40,'#e1f5ff',54,850);lines(x,l.callout.lines,M+54,ry+48+l.callout.title.length*54,FONT,'#e4f1f8');}
  }
  x.strokeStyle='#5285a0';x.beginPath();x.moveTo(M,H-116);x.lineTo(W-M,H-116);x.stroke();lines(x,guide.guideNote.split('\n'),M+12,H-77,27,'#a8c7da',38);lines(x,[displayCode+'｜1/1'],W-M-255,H-20,29,'#b4d6e8');
 }
 const dataset={researchAudit:JSON.stringify({code:a.code,date:a.date,width:W,height:H,index:1,total:1,minFont:FONT,bodyBottom,noClipping:bodyBottom<=H-150,mode:stockMode?'SINGLE_STOCK':'FILTER_RESEARCH',schemaVersion:report.schemaVersion,stage:report.stage,fields,section:'SUMMARY',summary:fields.map(f=>f.title+'\n'+f.value)}),release:a.version,fullBleed:'true'};
 const render=({top=0,height=H,scale=1}={})=>{const canvas=doc.createElement('canvas');canvas.width=Math.floor(W*scale);canvas.height=Math.floor(height*scale);const x=canvas.getContext('2d');x.setTransform(scale,0,0,scale,0,-top*scale);paint(x);Object.assign(canvas.dataset,dataset);return canvas;};
 return [{width:W,height:H,dataset,renderExportRegion:render,toBlob(callback,type='image/png'){const canvas=render();if(watermark&&globalThis.applyAntiTheftWatermarkV3761)globalThis.applyAntiTheftWatermarkV3761(canvas,'all');canvas.toBlob(blob=>{canvas.width=canvas.height=1;callback(blob);},type);}}];
}
return Object.freeze({VERSION,TITLE,TITLES,build,mount,pages,price});
});
