/* Shared raster watermark, matching the supplied chart report reference. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouReportWatermark=api;})(globalThis,function(){
'use strict';
const STYLE='REFERENCE_DIAGONAL_V84',BRAND='石頭少爺分析助手｜僅供授權使用';
function paint(ctx,{width:W,height:H,type='stock'}={}){
 if(!ctx||!(W>0&&H>0))throw Error('浮水印畫布尺寸無效');
 // Keep the caller's transform: cropped mobile sharing uses logical page coordinates.
 ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
 let dark=false;try{const p=ctx.getImageData(Math.floor(ctx.canvas.width*.5),Math.floor(ctx.canvas.height*.18),1,1).data;dark=p[0]+p[1]+p[2]<300;}catch(_){}
 const ink=dark?'170,188,205':'45,78,115';
 const pageH=Math.min(H,W*2.1636),sections=Math.max(1,Math.ceil(H/(W*2.8)));
 for(let i=0;i<sections;i++){
  ctx.save();ctx.translate(W*.66,Math.min(H-80,i*H/sections+pageH*(type==='professional'?.48:type==='market'?.165:.19)));ctx.rotate(-Math.PI/9);
  let size=Math.round(W*.034);ctx.font=`800 ${size}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;
  while(size>12&&ctx.measureText(BRAND).width>W*.65)ctx.font=`800 ${--size}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;
  ctx.fillStyle=`rgba(${ink},0.16)`;ctx.fillText(BRAND,0,0);ctx.restore();
 }
 ctx.font=`800 ${Math.round(W*.018)}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;
 ctx.fillStyle=`rgba(${ink},0.10)`;ctx.fillText(BRAND,W*.5,H*.944);
 ctx.font=`700 ${Math.max(9,Math.round(W*.0095))}px "Microsoft JhengHei","Noto Sans TC",sans-serif`;
 ctx.fillStyle=`rgba(${ink},0.36)`;ctx.textAlign='left';
 ctx.fillText('石頭少爺分析助手｜防盜浮水印版｜未經授權請勿轉載',W*.025,H-10);
 ctx.textAlign='right';ctx.fillText('僅供授權使用',W*.975,H-10);ctx.restore();
}
function apply(canvas,type='stock'){
 if(!canvas?.getContext)throw Error('浮水印需要完整圖片畫布');
 if(canvas.dataset?.watermarkStyle===STYLE)return canvas;
 const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);
 paint(ctx,{width:canvas.width,height:canvas.height,type:canvas.dataset?.reportMode==='professional'?'professional':type});ctx.restore();
 if(canvas.dataset){canvas.dataset.watermark='enabled';canvas.dataset.watermarkStyle=STYLE;}
 return canvas;
}
return Object.freeze({STYLE,BRAND,paint,apply});
});
