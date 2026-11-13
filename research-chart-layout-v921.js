/* Presentation geometry only. No market or research calculations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouChartLayout921=api;})(globalThis,function(){
'use strict';
const font=(ctx,size=34,weight=650)=>{ctx.font=`${weight} ${size}px "Microsoft JhengHei","Noto Sans CJK TC","Noto Sans TC",sans-serif`;};
function wrap(ctx,value,width,size=34){font(ctx,size);const rows=[];for(const segment of String(value??'尚未確認').split('\n')){let row='';for(const ch of segment){if(row&&ctx.measureText(row+ch).width>width){rows.push(row);row=ch;}else row+=ch;}rows.push(row||' ');}return rows;}
function blocks(ctx,items,{top=0,width=1140,size=34}={}){let y=top;return items.map(item=>{const title=wrap(ctx,item.title,width,38),body=wrap(ctx,item.value,width,size),height=title.length*52+body.length*48+44,b={...item,titleRows:title,bodyRows:body,top:y,height};y+=height+24;return b;});}
function paintBlocks(ctx,items,{x=72,width=1140,size=34}={}){for(const b of items){ctx.fillStyle='#23445a';ctx.fillRect(x,b.top,width,2);let y=b.top+20;ctx.fillStyle='#92ded4';font(ctx,38,750);for(const row of b.titleRows){ctx.fillText(row,x,y);y+=52;}font(ctx,size);ctx.fillStyle='#e7f0f6';for(const row of b.bodyRows){ctx.fillText(row,x,y);y+=48;}}}
// Spread close horizontal labels with a forward/backward pass; retain exact anchors.
function spread(items,{min,max,gap=12,dimension='x',extent='width'}){const list=items.map(x=>({...x})).sort((a,b)=>a[dimension]-b[dimension]);let edge=min;for(const x of list){x[dimension]=Math.max(edge,Math.min(x[dimension],max-x[extent]));edge=x[dimension]+x[extent]+gap;}edge=max;for(let i=list.length-1;i>=0;i--){const x=list[i];x[dimension]=Math.min(x[dimension],edge-x[extent]);edge=x[dimension]-gap;}return list;}
function eventLayout(event,bars,{x=120,y=860,width=1050,height=720,min,max,labelY=580}={}){
 const dx=width/(bars.length||1),yp=p=>y+height-(p-min)/(max-min)*height;
 const events=event?['K3','K2','K1','K0'].map(key=>{const date=event[key.toLowerCase()+'Date'],i=bars.findIndex(b=>b.date===date);if(!date)return {key,date:null,status:'MISSING'};if(i<0)return {key,date,status:bars.length&&(date<bars[0].date||date>bars.at(-1).date)?'OUT_OF_RANGE':'MISSING_BAR'};const bar=bars[i],price=event.side==='BULL'?bar.low:bar.high;return {key,date,status:'VISIBLE',index:i,price,anchorX:x+(i+.5)*dx,anchorY:yp(price)};}):[];
 const labels=spread(events.filter(e=>e.status==='VISIBLE').map(e=>({...e,x:e.anchorX-115,y:labelY,width:230,height:94})),{min:x,max:x+width});
 return {events,labels,plot:{x,y,width,height,min,max},dx};
}
return Object.freeze({font,wrap,blocks,paintBlocks,spread,eventLayout});
});
