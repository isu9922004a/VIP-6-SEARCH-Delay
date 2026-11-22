/* V9.16 explanatory layer only. Never changes any market/stock signal, rank or eligibility. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ShitouTransparency916=api;
})(globalThis,function(){
 'use strict';
 const VERSION='LIFELINE_TRANSPARENCY_V916',RELEASE='V9.16',W=1284,H=2778;
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const fmt=x=>finite(x)?x.toFixed(2):'尚未確認';
 const ensure=(ok,message)=>{if(!ok)throw Error(message);};
 const risks={1:['風險較低','偏強觀察'],2:['風險提高','盤整待確認'],3:['偏高風險','弱勢偏空'],4:['極高風險','急跌風險']};
 const s=(title,lines,color='normal')=>({title,lines:lines.filter(Boolean).map(String),color});
 const trend=x=>x==='偏強觀察'||x==='持續走強'||x==='逐漸變強'?'強':x==='還在走弱'||x==='偏弱觀察'?'弱':null;
 function market(study,risk,observation){
  ensure(study?.instrumentType==='TAIEX'&&study?.sourceVerified===true,'V9.16 大盤必須使用已確認指數行情');
  ensure(risk?.date===study.dataAsOf&&risk?.risk?.level>=0&&risk.risk.level<=4,'V9.16 大盤風險與完成日資料不一致');
  const v=risk.risk.level,m=risk.metrics||{},line=risk.life?.referencePrice;
  const belowLine=finite(line)&&m.close<line;
  const below5=finite(m.ma5)&&m.close<m.ma5,below20=finite(m.ma20)&&m.close<m.ma20;
  const failed=['BREAKOUT_FAILED','SUPPORT_BROKEN'].includes(study.lifecycleState);
  const shortBelow=finite(m.ma5)&&finite(m.ma20)&&m.ma5<m.ma20;
  const weakCount=[belowLine,below5,below20,failed,shortBelow].filter(Boolean).length;
  const shock=finite(m.dropATR)&&finite(m.shockThreshold)&&m.returnPct<0&&m.dropATR>=m.shockThreshold;
  const predicted=(!finite(m.atr14)||!finite(m.ma20)||!finite(m.ma5)||study.validatedBars.length<21)?0:
   shock&&(belowLine||below5)&&weakCount>=2?4:
   ((failed||belowLine)&&weakCount>=2||weakCount>=4)?3:
   m.close>m.ma5&&m.close>m.ma20&&finite(m.ma10)&&m.ma5>=m.ma10&&(!finite(line)||m.close>=line)&&!failed?1:2;
  ensure(predicted===v,'V9.16 判定原因無法重現原本四級風險，禁止輸出不一致報告');
  const causes=[
   [belowLine,'收盤低於原始K3生命線 '+fmt(line)+' 點'],
   [below20,'收盤低於20日均價 '+fmt(m.ma20)+' 點'],
   [below5,'收盤低於5日均價 '+fmt(m.ma5)+' 點'],
   [failed,'既有生命線事件顯示突破失敗或支撐失守'],
   [shortBelow,'5日均價低於20日均價']
  ].filter(x=>x[0]).map(x=>x[1]);
  const reasons=v===0?['必要資料不足，尚不能判定風險等級。']:
   v===4?['當日跌幅 '+fmt(m.dropATR)+' 倍14日平均波動，達急跌門檻 '+fmt(m.shockThreshold)+' 倍。',...causes]:
   v===3?causes:v===1?['收盤同時站在5日及20日均價上方。','5日均價不低於10日均價，且符合生命線與歷史事件條件。']:
   ['目前不符合第1級偏強，也未達第3／4級的完整弱勢條件。'];
  const shockLine=finite(m.shockThreshold)?
   '當日跌幅 '+fmt(m.dropATR)+' 倍14日平均波動；本次急跌門檻 '+fmt(m.shockThreshold)+' 倍。':
   '歷史波動樣本不足，急跌門檻尚未成立。';
  const detail='第4級必須同時符合：當日跌幅達波動門檻、收盤跌破原始生命線或5日均價、至少兩項弱勢條件成立。';
  const compare=v===4?'目前已達第4級，不能把單日急跌當作未來必然持續下跌。':
   v===3?'目前已符合第3級弱勢規則；'+detail+' '+(shock?'其他急跌條件未全部成立。':'目前未達當日急跌條件。'):
   v===2?'第3級需要生命線失守／突破失敗並搭配至少兩項弱勢條件，或至少四項弱勢條件。':
   v===1?'第2級代表尚未達偏強的全部確認條件，第3級則屬較明確的弱勢。':
   '資料不足，不應推估相鄰級別。';
  const upgrade=v===4?'已達最高級；下個完成日仍需重新計算，不表示必然繼續急跌。':
   v===3?detail+' '+shockLine:
   v===2?'若符合「生命線失守／突破失敗且至少兩項弱勢」，或累積四項弱勢，會進入第3級；急跌時還須檢查第4級。':
   v===1?'當偏強條件不再成立，下一個完成日可能重新落入第2、3或4級，需依完整條件評估。':'等待足夠有效歷史資料後重新評估。';
  const downgrade=v===4?'若下一個完成日不再達第4級，仍可能因生命線與均線偏弱而落在第3級；不代表風險解除。':
   v===3?'須先不再符合第3與第4級條件；若同時符合偏強規則，可能進入第1級，否則才是第2級。只站回5日均價不保證降級。':
   v===2?'須同時站上5日與20日均價、5日均價不低於10日均價，生命線未失守且無突破失敗事件，才符合第1級。':
   v===1?'已屬本模型最低風險級別；仍可能隔日轉弱，並非保證上漲。':'需要足夠已確認完成日，不能以猜測補級別。';
  const list=(observation?.scenarios||risk.scenarios||[]).slice(0,3).map((x,i)=>['情境'+['A','B','C'][i]+'：'+(x.title||'觀察'),x.text||'依下一根完成日收盤評估。'].join(' '));
  const extra='近10日低點 '+fmt(m.range10Low)+' 點是行情觀察價位，不是原始四級引擎的自動升級門檻。';
  const descriptor=v===0?'資料不足':('第'+v+'級／共4級｜'+risks[v][0]+'（'+risks[v][1]+'）');
  return Object.freeze({version:VERSION,release:RELEASE,type:'market',code:'TAIEX',date:risk.date,close:m.close,headline:descriptor,sourceRiskVersion:risk.sourceRiskVersion||risk.version,sourceRiskLevel:v,explanationStatus:v===0?'INSUFFICIENT_DATA':'VERIFIED_FROM_CORE',sections:[
   s('① 為什麼是這個等級？',reasons,v>=3?'risk':'normal'),
   s('② 與相鄰等級差在哪裡？',[compare, '目前實際成立的弱勢條件：'+weakCount+'／5項。'],'watch'),
   s('③ 哪些情況會提高風險？',[upgrade], 'risk'),
   s('④ 哪些情況代表風險改善？',[downgrade], 'good'),
   s('⑤ 下一交易日 A／B／C 觀察',list.length?list:['尚無可核對情境，不補造價位。'],'watch'),
   s('⑥ 觀察價位與風險等級要分開',[extra,'均線與生命線會隨新完成日更新，當日變化需重新計算。'],'normal')
  ],researchOnly:true,performanceValidated:false});
 }
 function stock(study,intel,observation,legacy,marketRisk){
  ensure(study&&intel&&legacy&&observation&&intel.date===legacy.date&&legacy.date===study.dataAsOf,'V9.16 個股資料日期不一致');
  const ma=legacy.ma||{},price=legacy.close,unit=' 元',line=legacy.line;
  const marketVerified=intel.marketVerified===true&&marketRisk?.sourceVerified===true&&marketRisk.date===intel.date&&
   (intel.securityMarket==='TWSE'&&marketRisk.instrumentType==='TAIEX'||intel.securityMarket==='TPEX'&&marketRisk.instrumentType==='TPEX');
  const stockDirection=trend(observation.stage)||trend(intel.priceTrend);
  const marketDirection=marketVerified?(marketRisk.risk?.level>=3?'弱':marketRisk.risk?.level===1?'強':null):null;
  const linkage=!marketVerified?'所屬市場沒有經核對的同一交易日風險資料，不拿加權指數代替櫃買指數。':
   marketDirection==='強'&&stockDirection==='強'?'大盤與個股都偏強；仍要檢查個股買點與突破是否成立。':
   marketDirection==='弱'&&stockDirection==='強'?'個股相對抗跌，但整體市場偏弱，仍需留意補跌。':
   marketDirection==='強'&&stockDirection==='弱'?'大盤偏強，個股仍偏弱；不能只因大盤上漲就追買。':
   marketDirection==='弱'&&stockDirection==='弱'?'市場與個股都偏弱，優先觀察防守條件。':
   '市場或個股方向還不明確，暫不把其中一方當成另一方的買賣依據。';
  const reasons=[observation.reason,observation.lineText,'既有生命線狀態：'+intel.lifeStatus];
  const riskReasons=intel.riskReasons?.length?intel.riskReasons:['目前未觸發額外的已確認追價提醒。'];
  const worsening=[
   Number.isFinite(ma[5])?'若完成日收盤低於5日均價 '+fmt(ma[5])+unit+'，需重新檢查短線弱勢。':'5日均價尚未確認。',
   Number.isFinite(legacy.range?.low)?'近期10日低點 '+fmt(legacy.range.low)+unit+'是觀察位置，不是自動設定的停損價。':null,
   '只有實際收盤與既有生命線事件相符時，才能稱為正式跌破。'
  ];
  const improving=[
   Number.isFinite(ma[5])?'站回5日均價 '+fmt(ma[5])+unit+'只是改善的第一步。':null,
   Number.isFinite(intel.activeResistanceEvent?.lifeLinePrice)?'上方已確認壓力 '+fmt(intel.activeResistanceEvent.lifeLinePrice)+unit+'須看完成日收盤能否突破。':null,
   '止跌、反彈與真正轉強是不同階段；不能把單日反彈當作已反轉。'
  ];
  const scenarios=(observation.scenarios||[]).slice(0,3).map((x,i)=>'情境'+['A','B','C'][i]+'：'+x.title+'。'+x.text);
  return Object.freeze({version:VERSION,release:RELEASE,type:'stock',code:legacy.code,date:intel.date,close:price,
   headline:observation.stage+'｜個股採既有強弱模型（不是四級風險）',explanationStatus:'VERIFIED_FROM_CORE',
   sections:[
    s('① 為什麼顯示這個狀態？',reasons,stockDirection==='弱'?'risk':'normal'),
    s('② 什麼情況需要更警覺？',worsening,'risk'),
    s('③ 什麼情況代表開始改善？',improving,'good'),
    s('④ 追價與假突破提醒',riskReasons.concat(['突破關卡後仍須檢查既有收盤、量能等必要條件；不能宣稱尚未驗證的突破已確認。']),'watch'),
    s('⑤ 下一交易日 A／B／C 觀察',scenarios.length?scenarios:['有效行情資料不足，暫不補造價位。'],'watch'),
    s('⑥ 大盤與個股聯動',[linkage,marketVerified?'所屬市場風險：'+(marketRisk.risk?.label||'已核對，但未取得級別'):'市場資料缺漏時，不推測強弱。'],'normal')
   ],marketVerified,researchOnly:true,performanceValidated:false});
 }
 const theme={bg:'#071C2D',card:'#0A2D43',border:'#39718B',white:'#F3F7FF',muted:'#BBD5E5',gold:'#FFE365',normal:'#81F1D0',risk:'#FF859F',good:'#60EE92',watch:'#FFBD55'};
 function pageSegments(doc,report){
  const c=doc.createElement('canvas'),ctx=c.getContext('2d');ensure(ctx,'無法使用畫布檢查 V9.16 文字排版');
  const font=(n,weight=600)=>{ctx.font=weight+' '+n+'px "Noto Sans TC","Microsoft JhengHei",sans-serif';};
  function wrap(value,width,sz){
   font(sz);const lines=[];for(const para of String(value).split('\n')){let line='';for(const char of para){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}lines.push(line||' ');}return lines;
  }
  const chunks=[];let current=[],y=325;
  for(const section of report.sections){
   const lineGroups=section.lines.map(t=>wrap(t,1142,30)),h=64+lineGroups.reduce((sum,lines)=>sum+lines.length*41+13,0)+20;
   ensure(h<2150,'V9.16 單一說明卡片過長，需要拆分內容');
   if(y+h+135>H&&current.length){chunks.push(current);current=[];y=325;}
   current.push({...section,lineGroups,height:h});y+=h+13;
  }
  if(current.length)chunks.push(current);
  return {chunks,wrap};
 }
 function buildPage(report,{document:doc=globalThis.document,additionalPages=0}={}){
  ensure(doc?.createElement&&report?.version===VERSION,'V9.16 報告資料或畫布無效');
  ensure(Number.isInteger(additionalPages)&&additionalPages>=0&&additionalPages<=2,'V9.20 附加頁數無效');
  const planned=pageSegments(doc,report);
  const displayRelease=globalThis.ShitouReleaseV50?.displayCode||RELEASE;
  return planned.chunks.map((items,offset)=>{
   const pageNumber=3+offset,total=2+planned.chunks.length+additionalPages;
   const name='石頭少爺_'+displayRelease+'_'+report.code+'_'+report.date.replaceAll('-','')+'_P0'+pageNumber+'_風險透明化.png';
   const audit={version:VERSION,release:displayRelease,code:report.code,type:report.type,date:report.date,close:report.close,
    sourceRiskVersion:report.sourceRiskVersion||null,sourceRiskLevel:report.sourceRiskLevel??null,explanationStatus:report.explanationStatus,
    sections:items.map(x=>({title:x.title,lines:x.lines})),page:pageNumber,pages:total,width:W,height:H,researchOnly:true,affectsEligibility:false,affectsRanking:false,performanceValidated:false};
   const key=report.type==='market'?'marketLifeAudit':'life98Audit';
   const dataset={filename:name,fullBleed:'true',shareAsSingleImage:'true',[key]:JSON.stringify(audit)};
   function render(){
    const canvas=doc.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ensure(ctx,'V9.16 Canvas不可用');ctx.textBaseline='top';
    ctx.fillStyle=theme.bg;ctx.fillRect(0,0,W,H);
    const rect=(x,y,w,h,color,stroke=theme.border)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,20);ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();};
    const write=(t,x,y,sz=30,color=theme.white,weight=600)=>{ctx.font=weight+' '+sz+'px "Noto Sans TC","Microsoft JhengHei",sans-serif';ctx.fillStyle=color;ctx.fillText(t,x,y);};
    rect(15,15,1254,272,theme.card);
    write('🏆 石頭少爺 '+displayRelease+'｜生命線風險透明化',35,35,46,theme.gold,800);
    write(report.type==='market'?'大盤生命線｜真正的四級判定條件':'個股生命線｜沿用既有強弱模型',37,109,35,theme.white,700);
    const head=planned.wrap(report.headline,1150,33);
    head.forEach((t,i)=>write(t,39,169+i*40,33,report.type==='market'&&report.sourceRiskLevel>=3?theme.risk:theme.normal,750));
    write('資料日 '+report.date+'｜'+report.code+'｜收盤 '+fmt(report.close)+(report.type==='market'?' 點':' 元'),38,251,25,theme.muted,600);
    let y=320;
    for(const section of items){
     rect(15,y,1254,section.height,theme.card);
     write(section.title,36,y+17,37,theme[section.color]||theme.normal,770);
     let py=y+72;
     section.lineGroups.forEach((lines,idx)=>{
      lines.forEach(line=>{write(line,42,py,30,theme.white,590);py+=41;});
      py+=13;
     });
     y+=section.height+13;
    }
    ensure(y+88<=H,'V9.16 說明文字超出頁面安全區');
    ctx.strokeStyle=theme.border;ctx.beginPath();ctx.moveTo(24,H-112);ctx.lineTo(W-24,H-112);ctx.stroke();
    write('完成日研究｜分級與行情情境不同｜非買賣保證',28,H-86,26,theme.muted,600);
    write('第 '+pageNumber+' / '+total+' 頁',1031,H-86,27,theme.gold,720);
    Object.assign(canvas.dataset,dataset);
    return canvas;
   }
   return {width:W,height:H,title:'第 '+pageNumber+' 頁／風險透明化',filename:name,dataset,renderExportRegion:render,
    toBlob(callback,type='image/png',quality){const c=render();c.toBlob(blob=>{c.width=c.height=1;callback(blob);},type,quality);}};
  });
 }
 return Object.freeze({VERSION,RELEASE,market,stock,buildPage});
});
