(function(root){'use strict';
const C=root.ShitouRestaurantCore;
function pages(scan,{limit=8,watermark=false}={}){
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
async function preview(scan,all=false){if(!scan?.candidates?.length)throw Error('目前沒有候選可產圖');if(document.fonts?.ready)await document.fonts.ready;const out=pages(scan,{limit:all?'all':8});if(!root.strongStockShowPagesV47)throw Error('完整圖片預覽工具未載入');return root.strongStockShowPagesV47(out,{title:'⑤ 餐廳擠不進去｜均衡量價觀察',prefix:'RESTAURANT_'+(root.ShitouReleaseV50?.code||C.MODEL),date:scan.date,kind:'restaurant',note:`${all?'全部候選':'前8檔'}逐檔完整分頁｜推估漲停與原圖未驗證項目均明示｜請下載完整ZIP保留全部頁面`});}
root.ShitouRestaurantReport=Object.freeze({pages,preview});
})(globalThis);
