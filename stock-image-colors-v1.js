(function(root){'use strict';
  // Apply the same color-only adjustment to completed individual-stock PNGs.
  // Text, coordinates, dimensions, alpha, report data and canvas metadata stay intact.
  const modes=new Set(['beginner','professional','three-pan']);
  const enhanced=new WeakSet();
  function enhance(canvas){
    if(!canvas||!modes.has(canvas.dataset?.reportMode)||enhanced.has(canvas))return canvas;
    const ctx=canvas.getContext('2d');
    if(!ctx)return canvas;
    const image=ctx.getImageData(0,0,canvas.width,canvas.height),pixels=image.data;
    for(let i=0;i<pixels.length;i+=4){
      if(!pixels[i+3])continue;
      const lightness=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
      // Keep light backgrounds and bright text on dark headings clear.
      if(lightness>=192)continue;
      const t=Math.max(0,(lightness-144)/48);
      const strength=.70+.30*t*t*(3-2*t);
      // A shared RGB multiplier keeps red/green/blue signal hues consistent.
      pixels[i]=Math.round(pixels[i]*strength);
      pixels[i+1]=Math.round(pixels[i+1]*strength);
      pixels[i+2]=Math.round(pixels[i+2]*strength);
    }
    ctx.putImageData(image,0,0);
    enhanced.add(canvas);
    return canvas;
  }
  if(typeof root.showInfographicPreviewV3328==='function'){
    const preview=root.showInfographicPreviewV3328;
    root.showInfographicPreviewV3328=function(canvas,...args){return preview.call(this,root.ShitouStockImageColors.enhance(canvas),...args);};
  }
  root.ShitouStockImageColors=Object.freeze({enhance});
})(typeof window!=='undefined'?window:globalThis);
