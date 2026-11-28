/* Independent visual theme and report painter. No selection or data rules are changed. */
(function(root){'use strict';
const d=root.document;if(!d)return;const KEY='shitou-agent-theme-v930',BRAND='石頭少爺Agent',VERSION='V9.30';
let theme='mario';try{const saved=root.localStorage.getItem(KEY);if(['mario','original'].includes(saved))theme=saved;}catch(_){}
d.documentElement.dataset.siteTheme=theme;
const mushroom='<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" shape-rendering="crispEdges"><path fill="#160a08" d="M10 2h12v2h4v4h4v6h2v10h-6v6H6v-6H0V14h2V8h4V4h4z"/><path fill="#ee302b" d="M10 4h12v2h4v4h4v12H2V14h2V8h6z"/><path fill="#fff6d5" d="M12 4h8v8h-8zM4 12h6v8H4zM24 12h6v8h-6zM8 24h16v4H8zM6 22h20v4H6z"/><path fill="#17110e" d="M12 22h2v4h-2zM20 22h2v4h-2z"/></svg>';
function active(){return theme==='mario';}
function canvasActive(c){return c?.dataset?.reportTheme?c.dataset.reportTheme==='mario':active();}
function text(value){return String(value).replace(/孫悟空\s*STOCK(?:\s*9\.1LX)?/gi,BRAND+' '+VERSION).replace(/石頭少爺\s*(?:AGENT|Agent)/g,BRAND).replace(/\bV(?:8|9)\.\d+(?:\.\d+)?\b/g,VERSION).replace(/9\.1LX/g,VERSION);}
function apply(next){if(!['mario','original'].includes(next))return;theme=next;d.documentElement.dataset.siteTheme=next;try{root.localStorage.setItem(KEY,next);}catch(_){}const b=d.getElementById('marioThemeToggle');if(b){b.setAttribute('aria-pressed',String(active()));b.title=active()?'切換原版介面':'切換瑪莉歐介面';b.setAttribute('aria-label',b.title);}if(d.getElementById('imagePreviewModal')?.classList.contains('show'))root.closeInfographicPreviewV3328?.();d.dispatchEvent(new CustomEvent('shitou-theme-change',{detail:{theme,version:VERSION}}));}
function mount(){const tools=d.querySelector('.header-right-tools')||d.querySelector('header.top');if(!tools||d.getElementById('marioThemeToggle'))return;const b=d.createElement('button');b.id='marioThemeToggle';b.type='button';b.innerHTML=mushroom;b.addEventListener('click',()=>apply(active()?'original':'mario'));tools.append(b);apply(theme);const mark=d.createElement('div');mark.className='mario-world-decoration';mark.setAttribute('aria-hidden','true');mark.innerHTML='<i class="mario-pipe left"></i><i class="mario-pipe right"></i><i class="mario-ground"></i>';d.body.append(mark);}
function parse(raw){const api=root.SunWukongKachiCanvasTheme;return api?.parseCssColor(raw);}
function color(raw,role){const c=parse(raw);if(!c)return raw;const max=Math.max(c.r,c.g,c.b),min=Math.min(c.r,c.g,c.b),l=(max+min)/510,s=max-min;let out;
const red=c.r>c.g*1.35&&c.r>c.b*1.18,green=c.g>c.r*1.2&&c.g>c.b*.92,gold=c.r>c.b*1.5&&c.g>c.b*1.25&&c.g>c.r*.58;
if(role==='text')out=red?'#ff8b87':green?'#65ed88':gold?'#ffe45b':l>.3&&l<.7?'#f6d9bd':'#fff8e8';
else if(role==='stroke')out=red?'#ff6d68':green?'#4cdd6b':gold?'#ffe34f':s>90&&c.b>c.r?'#8bd7ff':'#ffd343';
else out=red?'#c31c25':green&&s>90?'#229d43':gold?'#e7b526':l<.16?'#580916':l<.32?'#78101d':l>.84?'#a41724':'#911321';
const n=parse(out);return c.a<1&&n?`rgba(${n.r},${n.g},${n.b},${c.a})`:out;}
let painting=false;
function installCanvas(){const P=root.CanvasRenderingContext2D?.prototype,CP=root.HTMLCanvasElement?.prototype;if(!P||P.__mario930)return;P.__mario930=true;
const states=new WeakMap(),get=ctx=>{let s=states.get(ctx);if(!s){s={fill:null,stroke:null,stack:[]};states.set(ctx,s);}return s;};
const eligible=ctx=>!painting&&ctx.canvas.width>=300&&ctx.canvas.height>=200&&canvasActive(ctx.canvas);
const bind=ctx=>{if(!ctx.canvas.dataset.reportTheme)ctx.canvas.dataset.reportTheme=theme;};
for(const [key,field]of [['fillStyle','fill'],['strokeStyle','stroke']]){const desc=Object.getOwnPropertyDescriptor(P,key);Object.defineProperty(P,key,{configurable:true,enumerable:desc.enumerable,get(){return desc.get.call(this);},set(value){get(this)[field]=value;return desc.set.call(this,value);}});}
const save=P.save,restore=P.restore;P.save=function(){get(this).stack.push({fill:get(this).fill,stroke:get(this).stroke});return save.call(this);};P.restore=function(){const s=get(this),v=s.stack.pop();const r=restore.call(this);if(v){s.fill=v.fill;s.stroke=v.stroke;}return r;};
for(const method of ['fillRect','fill','fillText','strokeText','stroke','strokeRect']){const original=P[method];P[method]=function(...args){bind(this);if(method==='fillText'||method==='strokeText')args[0]=text(args[0]);if(!eligible(this))return original.apply(this,args);const s=get(this),field=method.startsWith('stroke')?'stroke':'fill',property=field+'Style',raw=s[field],before=this[property];if(typeof raw==='string')this[property]=color(raw,method.endsWith('Text')?'text':field==='stroke'?'stroke':'fill');
if(method==='fillRect'&&args[0]<=2&&args[1]<=2&&args[2]>=this.canvas.width*.96&&args[3]>=this.canvas.height*.96)this[property]='#690d1b';
const result=original.apply(this,args);this[property]=before;s[field]=raw;return result;};}
for(const method of ['createLinearGradient','createRadialGradient']){const original=P[method];P[method]=function(...args){const g=original.apply(this,args);g.__mario930=eligible(this);return g;};}
const G=root.CanvasGradient?.prototype;if(G){const add=G.addColorStop;G.addColorStop=function(offset,value){return add.call(this,offset,this.__mario930?color(value,'fill'):value);};}
const round=P.roundRect;if(round)P.roundRect=function(x,y,w,h,...r){return eligible(this)?this.rect(x,y,w,h):round.call(this,x,y,w,h,...r);};
function frame(canvas){if(!canvasActive(canvas)||canvas.width<300||canvas.height<200)return;const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;painting=true;try{c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';const unit=Math.max(2,Math.round(w/320));c.strokeStyle='#140c0b';c.lineWidth=unit*3;c.strokeRect(unit*2,unit*2,w-unit*4,h-unit*4);c.strokeStyle='#ffe03b';c.lineWidth=unit;c.strokeRect(unit*3.7,unit*3.7,w-unit*7.4,h-unit*7.4);const icon=['0000011111100000','0001122222211000','0012223332222100','0122233333222210','1222223332222221','1223322222233221','1233332222333321','1233332222333321','1223322222233221','1111111111111111','0011333333331100','0013331331333100','0013331331333100','0001333333331000','0000111111110000'];const colors=['','#170d09','#ee2929','#fff8db'];const px=Math.max(1,Math.floor(w/520)),ox=w-16*px-unit*5,oy=h-15*px-unit*5;for(let yy=0;yy<icon.length;yy++)for(let xx=0;xx<16;xx++){const n=Number(icon[yy][xx]);if(n){c.fillStyle=colors[n];c.fillRect(ox+xx*px,oy+yy*px,px,px);}}c.restore();}finally{painting=false;}}
for(const name of ['toBlob','toDataURL']){const original=CP[name];CP[name]=function(...args){frame(this);return original.apply(this,args);};}
}
root.ShitouMarioTheme=Object.freeze({VERSION,BRAND,getTheme:()=>theme,isActive:active,canvasActive,apply,text,color,installCanvas});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',()=>{installCanvas();mount();},{once:true});else{installCanvas();mount();}
})(globalThis);
