(function(r){'use strict';const C=r.ShitouStrategy2560,S=r.ShitouStrategy2560Scanner,R=r.ShitouKlineAttackReport;
function pages(scan,{limit=8,watermark=false,testOnly=false}={}){
 S.assertSnapshot(scan);const rows=limit==='all'?scan.candidates:scan.candidates.slice(0,limit);
 if(!rows.length)throw Error(scan.fullMarketCertified?'今日2560無符合條件的股票':'這輪沒有合格股票，部分資料仍待核對');
 const p=r.ShitouKlineAttack.fmt;
 if(limit==='all')return rows.map(c=>R.page({title:'2560戰法｜25日均線突破｜逐檔條件',date:scan.date,watermark,testOnly,blocks:[{code:c.code,date:c.date,data:c,lines:C.lines(c)}]}));
 const first=[];
 for(let i=0;i<rows.length;i+=3){
  const chunk=rows.slice(i,i+3),blocks=chunk.map((c,j)=>({code:c.code,date:c.date,data:c,lines:[
   String(i+j+1)+'. '+c.name+'（'+c.code+'）｜'+c.date,
   '收盤 '+p(c.features.close)+'元｜MA5 '+p(c.features.ma5.today)+'｜MA25 '+p(c.features.ma25.today)+'｜MA40 '+p(c.features.ma40.today),
   ...c.checks.map(x=>(x.pass?'✓ ':'✗ ')+x.code+' '+(x.key==='9041'?'收盤新突破MA25':x.key==='9012'?'VMA5>VMA60（部分還原）':'MA5>MA40')),
   'MA25突破 '+c.features.breakoutPct.toFixed(2)+'%（非隔日獲利）｜MA5乖離 '+c.features.deviationMA5.toFixed(2)+'%',
   'VMA5 '+c.features.vma5.toFixed(0)+'股｜VMA60 '+c.features.vma60.toFixed(0)+'股',
   '量能擴張 '+c.features.volumeRatio.toFixed(2)+'倍｜今日量 '+c.features.volumeToday.toFixed(0)+'股',
   'K棒品質：實體 '+(c.features.bodyShare===null?'無振幅':(c.features.bodyShare*100).toFixed(1)+'%')+'｜上影 '+(c.features.upperShadowShare===null?'無振幅':(c.features.upperShadowShare*100).toFixed(1)+'%'),
   '前20日高 '+p(c.features.previousHigh20)+'元｜距前高 '+c.features.nearPreviousHighPct.toFixed(2)+'%',
   '追價風險：'+c.risk.level+'｜'+(c.risk.warnings[0]||'無額外警示'),
   '#9012量能規則部分還原，待確認；目前僅VMA5>VMA60',
   '最終：'+c.status+'｜非自動買賣指令'
  ]}));
  first.push(R.page({title:'2560戰法｜25日均線突破｜前'+rows.length+'檔 '+(i+1)+'～'+(i+chunk.length),date:scan.date,watermark,testOnly,blocks}));
 }
 return [...first,...R.pages(rows,{title:'2560入選後｜K線風險觀察（不影響選股）',watermark,testOnly})];
}
async function preview(scan,all=false,watermark=false){if(document.fonts?.ready)await document.fonts.ready;return r.strongStockShowPagesV47(pages(scan,{limit:all?'all':8,watermark}),{title:'2560戰法｜25日均線突破｜'+(all?'完整明細':'前8檔與風險'),prefix:'2560_V9.1'+(watermark?'_浮水印':''),date:scan.date,kind:'restaurant',note:'#9012量能規則部分還原，待確認；依代號排序、不補滿8檔。請下載全部分頁或逐頁分享到LINE。'});}
r.ShitouStrategy2560Report=Object.freeze({pages,preview});
})(globalThis);
