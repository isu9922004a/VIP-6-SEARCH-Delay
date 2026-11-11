(function(r){'use strict';const C=r.ShitouStrategy2560,S=r.ShitouStrategy2560Scanner,R=r.ShitouKlineAttackReport;
const TITLE='2560戰法｜25日均線突破',SUBTITLE='突破確認 × 量能轉強 × 均線多頭';
function pages(scan,{limit=8,watermark=false,testOnly=false}={}){
 S.assertSnapshot(scan);const rows=limit==='all'?scan.candidates:scan.candidates.slice(0,Math.min(8,limit));
 if(!rows.length)throw Error(scan.fullMarketCertified?'今日2560無符合條件的股票':'這輪沒有已核對合格股票，部分資料仍待核對');
 const result=[];for(let i=0;i<rows.length;i+=2){const part=rows.slice(i,i+2),blocks=part.map(c=>({code:c.code,date:c.date,data:c,lines:C.lines(c)}));result.push(R.page({title:TITLE+'｜'+SUBTITLE+'｜'+(i/2+1)+'頁',date:scan.date,watermark,testOnly,includeChart:false,blocks}));}
 return result;
}
async function preview(scan,all=false,watermark=false){if(document.fonts?.ready)await document.fonts.ready;return r.strongStockShowPagesV47(pages(scan,{limit:all?'all':8,watermark}),{title:TITLE+'｜'+(all?'完整明細':'前8檔'),prefix:'2560_V9.1'+(watermark?'_浮水印':''),date:scan.date,kind:'restaurant',note:SUBTITLE+'；依代號排序，非預測排行。#9012部分還原；不足8檔不補滿。分頁圖片可逐頁分享至LINE。'});}
r.ShitouStrategy2560Report=Object.freeze({pages,preview});
})(globalThis);
