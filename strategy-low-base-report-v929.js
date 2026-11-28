/* V9.29 candidate report adapter. Reuses the established multi-page LINE/ZIP preview. */
(function(root){'use strict';
const S=root.ShitouLowBaseScannerV929;
function pages(scan,{all=false,watermark=false,testOnly=false}={}){
 if(!scan||scan.model!=='LOW_BASE_VOLUME_BREAKOUT_V1')throw Error('報告策略版本錯誤');
 const rows=all?scan.candidates:scan.top8;
 if(!rows?.length)throw Error(scan.zeroConfirmed?'全市場無符合必要條件':'本輪無可匯出候選');
 const R=root.ShitouKlineAttackReport;
 if(!R?.page)throw Error('圖片報告服務尚未就緒');
 return rows.map((c,i)=>R.page({title:'⑤ 主升段低位階帶量突破｜'+(all?'完整榜單':'TOP 8')+' '+(i+1)+'/'+rows.length,date:scan.date,watermark,testOnly:testOnly||scan.testOnly===true,includeChart:false,blocks:[{code:c.code,date:c.date,data:c,lines:[...S.lines(c),'本報告只使用已完成日K；未核實基本面未加分；非獲利預測。']}]}));
}
async function preview(scan,all=false,watermark=false){
 if(document.fonts?.ready)await document.fonts.ready;
 if(typeof root.strongStockShowPagesV47!=='function')throw Error('LINE分享預覽服務尚未就緒');
 return root.strongStockShowPagesV47(pages(scan,{all,watermark}),{title:'主升段低位階帶量突破｜'+(all?'完整榜單':'TOP 8'),prefix:'LOW_BASE_V929'+(watermark?'_浮水印':''),date:scan.date,kind:'restaurant',note:'依已核實品質分數排序，不足8檔不補滿；請逐頁分享或下載完整圖片。'});
}
root.ShitouLowBaseReportV929=Object.freeze({pages,preview});
})(globalThis);
