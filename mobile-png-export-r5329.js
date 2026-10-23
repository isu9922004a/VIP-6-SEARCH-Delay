/* Single PNG encoded from small raster strips; no full-size iOS pixel buffer. */
(function(root){'use strict';
const TABLE=Uint32Array.from({length:256},(_,v)=>{for(let j=0;j<8;j++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
const u32=v=>Uint8Array.of(v>>>24,v>>>16&255,v>>>8&255,v&255);
function chunk(type,data){const name=new TextEncoder().encode(type);let crc=0xffffffff;for(const a of [name,data])for(const v of a)crc=TABLE[(crc^v)&255]^(crc>>>8);return [u32(data.length),name,data,u32((crc^0xffffffff)>>>0)];}
function install(canvas,ops,bg){
 const commands=[],probe=document.createElement('canvas').getContext('2d');
 const proxy=new Proxy(probe,{get(t,k){if(k==='canvas')return canvas;const value=t[k];if(typeof value!=='function')return value;
   if(['measureText','getTransform','createLinearGradient','createRadialGradient','createPattern'].includes(k))return value.bind(t);
   return (...args)=>{commands.push({method:k,args});return value.apply(t,args);};},set(t,k,v){commands.push({property:k,value:v});t[k]=v;return true;}});
 canvas.renderExportRegion=function({top=0,height=canvas.height,scale=1}={}){
  const tile=document.createElement('canvas');tile.width=Math.max(1,Math.floor(canvas.width*scale));tile.height=Math.max(1,Math.floor(height*scale));
  const ctx=tile.getContext('2d');if(!ctx)throw Error('裝置無法建立分享圖片');ctx.fillStyle='#fff';ctx.fillRect(0,0,tile.width,tile.height);
  ctx.setTransform(scale,0,0,scale,0,-top*scale);ctx.fillStyle=bg;ctx.fillRect(0,top,canvas.width,height);for(const op of ops)op(ctx);
  for(const c of commands){if(c.property)ctx[c.property]=c.value;else if(c.method==='resetTransform')ctx.setTransform(scale,0,0,scale,0,-top*scale);else if(c.method==='setTransform'&&c.args.length===6){const a=c.args.map(v=>v*scale);a[5]-=top*scale;ctx.setTransform(...a);}else ctx[c.method](...c.args);}
  return tile;
 };
 canvas.getContext=type=>type==='2d'?proxy:null;
 canvas.toBlob=function(callback,type='image/png'){
  if(type!=='image/png'){callback(null);return;}
  encode(canvas,ops,commands,bg).then(callback,error=>{canvas.dataset.exportError=error.message;callback(null);});
 };
 canvas.toDataURL=()=>{throw Error('完整手機長圖請使用非同步PNG匯出／預覽');};canvas.dataset.exportMode='STRIP_STREAM_PNG';return canvas;
}
async function encode(canvas,ops,commands,bg){
 if(typeof CompressionStream!=='function')throw Error('此Safari版本不支援長圖串流PNG；請更新Safari後重試');
 const compressor=new CompressionStream('deflate'),writer=compressor.writable.getWriter(),reader=compressor.readable.getReader(),compressed=[];
 const drain=(async()=>{for(;;){const {done,value}=await reader.read();if(done)break;compressed.push(value);}})();
 const tile=document.createElement('canvas');tile.width=canvas.width;const stripe=512;
 try{for(let top=0;top<canvas.height;top+=stripe){tile.height=Math.min(stripe,canvas.height-top);const ctx=tile.getContext('2d',{willReadFrequently:true});ctx.translate(0,-top);ctx.fillStyle=bg;ctx.fillRect(0,top,tile.width,tile.height);for(const op of ops)op(ctx);
   for(const c of commands){if(c.property)ctx[c.property]=c.value;else if(c.method==='resetTransform')ctx.setTransform(1,0,0,1,0,-top);else if(c.method==='setTransform'&&c.args.length===6){const a=[...c.args];a[5]-=top;ctx.setTransform(...a);}else ctx[c.method](...c.args);}
   const pixels=ctx.getImageData(0,0,tile.width,tile.height).data,rowBytes=tile.width*4,raw=new Uint8Array((rowBytes+1)*tile.height);
   for(let y=0;y<tile.height;y++)raw.set(pixels.subarray(y*rowBytes,(y+1)*rowBytes),y*(rowBytes+1)+1);await writer.write(raw);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  await writer.close();await drain;
 }catch(e){await writer.abort(e).catch(()=>{});await drain.catch(()=>{});throw e;}finally{tile.width=tile.height=1;}
 const ihdr=new Uint8Array(13);ihdr.set(u32(canvas.width));ihdr.set(u32(canvas.height),4);ihdr[8]=8;ihdr[9]=6;
 return new Blob([Uint8Array.of(137,80,78,71,13,10,26,10),...chunk('IHDR',ihdr),...compressed.flatMap(bytes=>chunk('IDAT',bytes)),...chunk('IEND',new Uint8Array())],{type:'image/png'});
}
root.ShitouMobilePng5329=Object.freeze({install,encode});
})(globalThis);
