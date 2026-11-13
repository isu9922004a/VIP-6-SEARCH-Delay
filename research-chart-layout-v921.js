/* Shared presentation text and geometry. No market or research calculations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouChartLayout921=api;})(globalThis,function(){
'use strict';
const lifeStates=Object.freeze({STRONG:'偏強',WEAK:'偏弱',TURNING_STRONG:'收盤已確認轉強',TURNING_WEAK:'收盤已確認轉弱',NEUTRAL:'盤整，還要等確認',INSUFFICIENT_DATA:'資料不足，先不判斷'});
const eventStates=Object.freeze({BULL_SUPPORT_WATCH:'下方支撐還在觀察中',BEAR_RESISTANCE_WATCH:'上方壓力還在觀察中',SUPPORT_BROKEN:'收盤已跌破生命線',SUPPORT_RECLAIMED:'跌破後已站回生命線',BREAKOUT_CONFIRMED:'收盤已站上生命線壓力',BREAKOUT_FAILED:'站上壓力後又掉回來',SUPPORT_RECLAIMED_INTRADAY:'盤中曾跌破，收盤已站回支撐',SUPPORT_TEST:'收盤剛好碰到支撐',RESISTANCE_TEST:'收盤剛好碰到壓力',BREAKOUT_ATTEMPT:'盤中曾漲過壓力，收盤還沒站穩',RETEST_HELD:'回來測試後仍守住關卡'});
const wording=Object.freeze([
 ['生命線尚有效，但收盤低於MA20','生命線還沒被跌破，但收盤仍低於20日平均價（MA20）'],
 ['壓力尚有效，但收盤高於MA20','上方壓力還沒解除，但收盤高於20日平均價（MA20）'],
 ['ATR波動較大，生命線不是保證成交的停損價','最近股價起伏較大（ATR）；這條線是參考價，不保證能剛好在這個價格成交'],
 ['RSI14偏熱，注意追價與回落','最近上漲較急（RSI14偏熱），注意追高後回落'],
 ['短期MA5已下彎','最近5天平均價（MA5）開始往下'],
 ['收盤高於MA20','收盤高於20日平均價（MA20）'],
 ['收盤低於MA20','收盤低於20日平均價（MA20）'],
 ['上影線較長，觀察收盤賣壓','K棒上方細線較長，代表當天高點有回落；仍要看收盤'],
 ['下一完成日K若收盤高於','下一個交易日，如果收盤高於'],
 ['下一完成日K若收盤低於','下一個交易日，如果收盤低於'],
 ['，才確認壓力突破','，才算用收盤確認站上壓力'],
 ['，構成生命線失守','，就表示生命線已被收盤跌破'],
 ['並突破已確認前高，才觀察多方延續','，而且漲過已確認的前一個高點，再觀察是否繼續偏強'],
 ['若守住','如果守住'],
 ['若仍在','如果仍在'],
 ['空方壓力尚未解除','上方壓力還沒解除'],
 ['收盤剛好等於關卡，或反覆往返時，維持觀察','收盤剛好碰到這個價位，或反覆上下穿越時，先繼續等'],
 ['盤中高於壓力但收盤未站上、或突破後又收回，須標示失敗候選','盤中漲過壓力，收盤卻沒站穩，或站上後又掉回來：可能是假突破，還不能認定已轉強'],
 ['盤中低於支撐而收盤重新站回，不視為已確認轉弱','盤中跌破支撐，收盤卻站回來：還不能只憑盤中跌破就說已轉弱'],
 ['固定生命線屬於價位結構研究，不是隔日報酬預測','這條線用來看價格有沒有守住，不是在預測明天能賺多少'],
 ['沒有可確認的0號K事件','目前還找不到可成立生命線的K0訊號'],
 ['研究日K尚未取得完整來源認證','日K來源還沒核對完整，先不判斷'],
 ['至少需要4根已完成日K','至少要有4根已收盤的日K，才有足夠資料判斷'],
 ['同向確認','支持同一方向的證據'],
 ['尚未核驗','還沒核對']
]);
function plain(value){let text=String(value??'尚未確認');for(const [from,to]of wording)text=text.split(from).join(to);return text;}
const lifeState=(code,fallback)=>lifeStates[code]||plain(fallback||'狀態尚未確認');
const eventState=(code,fallback)=>eventStates[code]||lifeStates[code]||plain(fallback||'目前還沒有可確認的狀態變化');
const patternState=code=>({CONFIRMED:'已確認',FORMING:'還在形成，尚未確認',PENDING:'還要等確認',INVALIDATED:'原看法已不成立',FAILED:'先前的條件沒有守住',EXPIRED:'先前的觀察，現在要重新確認'})[code]||'狀態說明尚未提供（'+String(code||'缺少原始狀態')+'）';
const font=(ctx,size=34,weight=650)=>{ctx.font=`${weight} ${size}px "Microsoft JhengHei","Noto Sans CJK TC","Noto Sans TC",sans-serif`;};
function wrap(ctx,value,width,size=34){font(ctx,size);const rows=[];for(const segment of String(value??'尚未確認').split('\n')){let row='';const atoms=segment.match(/[（(][^（）()\n]{1,16}[）)]|\d{4}-\d{2}-\d{2}|\d+(?:\.\d+)?(?: ?(?:元|[%％]|倍))?|[A-Za-z0-9]+(?:[._/-][A-Za-z0-9]+)*|./gu)||[];for(const atom of atoms){const parts=ctx.measureText(atom).width>width?[...atom]:[atom];for(const ch of parts){if(row&&ctx.measureText(row+ch).width>width){rows.push(row);row=ch;}else row+=ch;}}rows.push(row||' ');}return rows;}
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
return Object.freeze({font,wrap,blocks,paintBlocks,spread,eventLayout,plain,lifeState,eventState,patternState});
});
