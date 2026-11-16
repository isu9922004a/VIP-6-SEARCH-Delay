/* V9.9 index-only presentation adapter: reuse the verified stock visual layout,
   never reuse stock quotes, stock selection, or stock trading assumptions. */
(function(root,factory){
 const node=typeof module==='object'&&!!module.exports;
 const api=factory(node?require('./life-line-visual-v98.js'):root.ShitouLifeVisual98);
 if(node)module.exports=api;else root.ShitouMarketLifeVisual99=api;
})(globalThis,function(StockVisual){
 'use strict';
 const VERSION='MARKET_LIFE_VISUAL_V99',RELEASE='V9.9',INSTRUMENT='TAIEX';
 function convert(value){
  let v=String(value??'');
  const terms=[
   ['V9.8','V9.9'],
   ['個股生命線圖片報告','大盤生命線圖片報告'],
   ['個股分析','大盤分析'],
   ['追價與波動風險','短線過熱與波動風險'],
   ['追價風險','短線過熱風險'],
   ['追價仍須留意','短線過熱仍須留意'],
   ['追高仍可能回跌','指數拉高後仍可能回落'],
   ['主力真實持股成本','市場參與者的實際持有成本'],
   ['股價仍須觀察均線方向與收盤變化','指數仍須觀察均線方向與收盤變化'],
   ['不要只因為股價站回生命線就追高','不要只因為指數站回生命線就判定全面轉強'],
   ['最高價','最高點'],['最低價','最低點'],
   ['股價','指數'],['個股','大盤'],['股票','指數'],
   ['成交量來源待核對','集中市場成交股數來源待核對'],
   ['成交量','成交股數'],
   ['量能待核對（不使用未驗證量比）','集中市場成交股數待核對（不使用量比）'],
   [' 元',' 點'],['元；','點；'],['元，','點，'],['元生命線','點生命線'],['元。','點。']
  ];
  for(const [from,to] of terms)v=v.replaceAll(from,to);
  return v;
 }
 function renderedDocument(doc){
  return {createElement(tag){
   const el=doc.createElement(tag);
   if(String(tag).toLowerCase()!=='canvas'||typeof el.getContext!=='function')return el;
   const get=el.getContext.bind(el);
   el.getContext=function(kind,...args){
    const ctx=get(kind,...args);
    if(kind!=='2d'||!ctx||ctx.__marketLifeConverted)return ctx;
    const fill=ctx.fillText?.bind(ctx),measure=ctx.measureText?.bind(ctx);
    if(fill)ctx.fillText=(value,...tail)=>fill(convert(value),...tail);
    if(measure)ctx.measureText=value=>measure(convert(value));
    Object.defineProperty(ctx,'__marketLifeConverted',{value:true});
    return ctx;
   };
   return el;
  }};
 }
 async function ready(doc=globalThis.document){
  if(!StockVisual||typeof StockVisual.build!=='function')throw Error('大盤報告缺少 V9.8 共用繪圖模組');
  return StockVisual.ready(doc);
 }
 function build(study,{document:doc=globalThis.document,source=null,watermark=false}={}){
  if(!StockVisual||typeof StockVisual.build!=='function')throw Error('大盤圖片尚未載入 V9.8 繪圖模組');
  if(!doc?.createElement)throw Error('圖片畫布不可用');
  if(study?.instrumentType!==INSTRUMENT||study?.code!==INSTRUMENT||study?.sourceVerified!==true)throw Error('必須使用已核對的大盤加權指數，不接受個股或推論資料');
  if(!Array.isArray(study.validatedBars)||!study.validatedBars.length)throw Error('大盤已確認日 K 不足');
  // The index audit deliberately prevents use of uncertain turnover as a confirmation.
  // The common visual receives only the index life-line study; no stock source is passed.
  const raw=StockVisual.build(study,{document:renderedDocument(doc),source:null,watermark});
  if(raw.length!==2)throw Error('大盤生命線雙頁排版失敗');
  return raw.map((page,i)=>{
   const number=i+1,kind=i===0?'大盤分析':'生命線形成教學';
   const audit0=JSON.parse(page.dataset.life98Audit);
   const audit={...audit0,version:VERSION,release:RELEASE,title:kind,instrumentType:INSTRUMENT,unit:'點',sourceVerified:true,marketVolumeMeaning:'集中市場成交股數',volumeConfirmationAllowed:!study.sourceVolumeAudit?.uncertain&&audit0.model.volume.verified===true};
   const filename='石頭少爺_'+RELEASE+'_TAIEX_'+(study.dataAsOf||'日期待核對').replaceAll('-','')+'_P0'+number+'_'+kind+'.png';
   const dataset={...page.dataset,marketLifeAudit:JSON.stringify(audit),filename,fullBleed:'true',shareAsSingleImage:'true'};
   const renderOriginal=page.renderExportRegion;
   const render=()=>{const canvas=renderOriginal();Object.assign(canvas.dataset,dataset);return canvas;};
   return {...page,title:'第 '+number+' 頁／'+kind,filename,dataset,renderExportRegion:render,
    toBlob(callback,type='image/png',quality){const canvas=render();canvas.toBlob(blob=>{canvas.width=canvas.height=1;callback(blob);},type,quality);}};
  });
 }
 return Object.freeze({VERSION,RELEASE,INSTRUMENT,convert,ready,build});
});
