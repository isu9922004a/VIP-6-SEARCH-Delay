(function(r){'use strict';const C=r.ShitouStrategy2560,S=r.ShitouStrategy2560Scanner,R=r.ShitouKlineAttackReport;
function pages(scan,{limit=8,watermark=false,testOnly=false}={}){S.assertSnapshot(scan);const rows=limit==='all'?scan.candidates:scan.candidates.slice(0,limit);if(!rows.length)throw Error(scan.fullMarketCertified?'今日無符合2560戰法條件的股票':'這輪沒有合格股票，部分資料仍待核對');
 if(limit==='all')return rows.flatMap(c=>[R.page({title:'⑤ 🌟2560戰法｜逐檔條件',date:scan.date,watermark,testOnly,blocks:[{code:c.code,date:c.date,data:c,lines:C.lines(c)}]})]);
 const p=r.ShitouKlineAttack.fmt,blocks=rows.map((c,i)=>({code:c.code,date:c.date,data:{features:c.features,status:c.status,eligible:c.eligible,exitWarning:c.exitWarning,kline:c.kline},lines:[`${i+1}. ${c.name}（${c.code}）`,`MA5 ${p(c.features.ma5.today)}元 ↑／MA25 ${p(c.features.ma25.today)}元 ↑`,`MA40 ${p(c.features.ma40.today)}元；MA5今天剛穿到上方。`,'今天新交叉，兩條均線都向上：正式條件通過。',c.exitWarning?'收盤低於MA5：已有持股者核對原出場計畫。':'收盤未低於MA5；仍要核對其他風險。',`K線：${c.kline?.status||c.kline?.reason||'資料待核對'}。`]}));
 return [R.page({title:'⑤ 🌟2560戰法｜前8檔（代號排序，非強弱排名）',date:scan.date,watermark,testOnly,blocks}),...R.pages(rows,{title:'2560入選後，K線提醒你看什麼？',watermark,testOnly})];
}
async function preview(scan,all=false,watermark=false){if(document.fonts?.ready)await document.fonts.ready;return r.strongStockShowPagesV47(pages(scan,{limit:all?'all':8,watermark}),{title:'⑤ 🌟2560戰法｜'+(all?'完整明細':'前8檔與攻防說明'),prefix:'2560_V9.0'+(watermark?'_浮水印':''),date:scan.date,kind:'restaurant',note:'依代號排列，非強弱排名；不足8檔不補滿。新增說明依原序分頁，請下載全部圖片或逐頁分享至LINE。'});}
r.ShitouStrategy2560Report=Object.freeze({pages,preview});
})(globalThis);
