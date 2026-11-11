(function(r){'use strict';const C=r.ShitouStrategy2560,S=r.ShitouStrategy2560Scanner,R=r.ShitouKlineAttackReport;
function pages(scan,{limit=8,watermark=false,testOnly=false}={}){S.assertSnapshot(scan);const rows=limit==='all'?scan.candidates:scan.candidates.slice(0,limit);if(!rows.length)throw Error(scan.fullMarketCertified?'今日2560無符合條件的股票':'這輪沒有合格股票，部分資料仍待核對');
 const p=r.ShitouKlineAttack.fmt;
 if(limit==='all')return rows.map(c=>R.page({title:'2560戰法｜25日均線突破',date:scan.date,watermark,testOnly,blocks:[{code:c.code,date:c.date,data:c,lines:C.lines(c)}]}));
 const blocks=rows.map((c,i)=>{const f=c.features,risk=c.risk;return {code:c.code,date:c.date,data:{features:f,status:c.status,eligible:c.eligible,risk,kline:c.kline},lines:[
 (i+1)+'. '+c.name+'（'+c.code+'）｜'+c.date+'｜'+c.status,
 '收盤 '+p(f.close)+'元｜MA5 '+p(f.ma5.today)+'｜MA25 '+p(f.ma25.today)+'｜MA40 '+p(f.ma40.today),
 '#9041 '+(c.checks[0].pass?'通過':'不通過')+'｜#9012 '+(c.checks[1].pass?'通過':'不通過')+'｜#533 '+(c.checks[2].pass?'通過':'不通過'),
 'MA25突破 '+p(f.breakoutPct)+'%（非隔日獲利）｜MA5乖離 '+p(f.deviationMA5)+'%',
 'VMA5 '+p(f.vma5)+'股｜VMA60 '+p(f.vma60)+'股｜擴張 '+p(f.volumeRatio)+'倍',
 '最新量 '+p(f.latestVolume)+'股｜上影 '+(risk.upperShadowRatio===null?'無法計算':p(risk.upperShadowRatio*100)+'%')+'｜實體 '+(risk.bodyRatio===null?'無法計算':p(risk.bodyRatio*100)+'%'),
 (risk.unusualVolume?'異常放量；':'')+(risk.nearPriorHigh?'接近前高；':'')+(f.deviationMA5>6?'高乖離追價風險':f.deviationMA5>3?'留意追價':'乖離初步觀察')+'；風險不改PASS',
 '#9012量能規則部分還原，待確認｜無強制出場｜非勝率預測'
 ]};});
 const allPages=[];for(let i=0;i<blocks.length;i+=3)allPages.push(R.page({title:'2560戰法｜25日均線突破｜Top '+rows.length+'（第'+(Math.floor(i/3)+1)+'頁）',date:scan.date,watermark,testOnly,blocks:blocks.slice(i,i+3)}));return [...allPages,...R.pages(rows,{title:'2560通過後｜K線攻防觀察',watermark,testOnly})];
}
async function preview(scan,all=false,watermark=false){if(document.fonts?.ready)await document.fonts.ready;return r.strongStockShowPagesV47(pages(scan,{limit:all?'all':8,watermark}),{title:'2560戰法｜25日均線突破｜'+(all?'完整明細':'前8檔與攻防說明'),prefix:'2560_V9.1'+(watermark?'_浮水印':''),date:scan.date,kind:'restaurant',note:'依代號排列，非強弱排名；不足8檔不補滿。新增說明依原序分頁，請下載全部圖片或逐頁分享至LINE。'});}
r.ShitouStrategy2560Report=Object.freeze({pages,preview});
})(globalThis);
