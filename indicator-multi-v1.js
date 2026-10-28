/* Read-only indicator studies: never changes eligibility, score, trading levels or rank. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ShitouIndicatorMultiV1=api;})(globalThis,function(){
'use strict';
const VERSION='INDICATOR-MULTITF-RESEARCH-1';
const mean=a=>a.reduce((sum,x)=>sum+x,0)/a.length;
const val=(n)=>typeof n==='number'&&Number.isFinite(n);
const round=n=>val(n)?Math.round(n*10000)/10000:null;
const format=v=>val(v)?v.toFixed(2):'—';
function kd(bars,period=9){let k=50,d=50;const out=[];
 for(let i=0;i<bars.length;i++){
  if(i<period-1){out.push({date:bars[i].date,k:null,d:null});continue;}
  const block=bars.slice(i-period+1,i+1),high=Math.max(...block.map(x=>x.high)),low=Math.min(...block.map(x=>x.low));
  const rsv=high>low?(bars[i].close-low)/(high-low)*100:50;
  k=k*2/3+rsv/3;d=d*2/3+k/3;
  out.push({date:bars[i].date,k:round(k),d:round(d)});
 }return out;
}
function ema(values,period){const out=[];let last=null;for(let i=0;i<values.length;i++){
 const x=values[i];if(!val(x)){out.push(null);continue;}
 last=last===null?x:last+(x-last)*2/(period+1);out.push(last);
 }return out;}
function macd(bars){const close=bars.map(x=>x.close),e12=ema(close,12),e26=ema(close,26),dif=e12.map((x,i)=>x-e26[i]),signal=ema(dif,9);
 return bars.map((b,i)=>({date:b.date,dif:round(dif[i]),signal:round(signal[i]),hist:round(dif[i]-signal[i])}));}
function cross(a,b,axis='up'){
 if(!val(a?.k)||!val(b?.k)||!val(a?.d)||!val(b?.d))return false;
 return axis==='up'?a.k<=a.d&&b.k>b.d:a.k>=a.d&&b.k<b.d;
}
function histCross(a,b,axis='up'){
 if(!val(a?.hist)||!val(b?.hist))return false;
 return axis==='up'?a.hist<=0&&b.hist>0:a.hist>=0&&b.hist<0;
}
function events(series,fn){const out=[];for(let i=1;i<series.length;i++)if(fn(series[i-1],series[i]))out.push(i);return out;}
function completePeriods(bars,calendar,type){
 if(calendar?.verified!==true||!Array.isArray(calendar.dates)||!calendar.source||!calendar.start||!calendar.end)return {status:'資料不足',reason:'正式交易日曆尚未核驗',bars:[]};
 if(!bars.length)return {status:'資料不足',reason:'缺少完成日K',bars:[]};
 const asOf=bars.at(-1).date,dates=calendar.dates;
 if(!dates.includes(asOf)||calendar.start>bars[0].date||calendar.end<asOf||dates.some((x,i)=>i&&x<=dates[i-1]))return {status:'資料不足',reason:'交易日曆涵蓋範圍不足或不一致',bars:[]};
 const groups=new Map();
 const groupKey=date=>{if(type==='MONTH')return date.slice(0,7);const d=new Date(date+'T00:00:00Z'),dow=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dow);return d.toISOString().slice(0,10);};
 for(const b of bars){const key=groupKey(b.date);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
 const keys=[...groups.keys()].sort();const currentKey=groupKey(asOf),out=[];
 for(const key of keys){
  // Exclude the last period: without a later-period observation, its closing is not proven.
  if(key===currentKey)continue;
  const rows=groups.get(key),expected=dates.filter(d=>groupKey(d)===key);
  if(key===keys[0]&&expected.length&&expected[0]<bars[0].date)continue; // Left-edge partial period is not an internal data gap.
  if(!expected.length||expected.length!==rows.length||expected.some((d,i)=>d!==rows[i].date))return {status:'資料不足',reason:'已完成週月K有交易日缺漏',bars:[]};
  out.push({date:rows.at(-1).date,open:rows[0].open,high:Math.max(...rows.map(x=>x.high)),low:Math.min(...rows.map(x=>x.low)),close:rows.at(-1).close,volume:rows.reduce((v,b)=>v+b.volume,0)});
 }
 return {status:out.length>=(type==='MONTH'?15:30)?'已確認':'資料不足',reason:out.length<(type==='MONTH'?15:30)?'完整週月K暖機資料不足':null,bars:out};
}
function study(bars,{calendar=null}={}){
 if(!Array.isArray(bars)||bars.length<60||bars.some((x,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||![x.open,x.high,x.low,x.close,x.volume].every(val)||i&&x.date<=bars[i-1].date))return Object.freeze({version:VERSION,status:'資料不足',reason:'需至少60根已驗證且依日期排序的日K',patterns:[]});
 const K=kd(bars),M=macd(bars),i=bars.length-1,z=bars[i],k=K[i],m=M[i],prev=bars[i-1];
 const gold=events(K,(a,b)=>cross(a,b)),dead=events(K,(a,b)=>cross(a,b,'down'));
 const up=events(M,(a,b)=>histCross(a,b)),down=events(M,(a,b)=>histCross(a,b,'down'));
 const volumeMean=mean(bars.slice(-21,-1).map(x=>x.volume)),volOK=volumeMean>0&&z.volume>=volumeMean;
 const priorHigh=Math.max(...bars.slice(-21,-1).map(x=>x.high)),priorLow=Math.min(...bars.slice(-21,-1).map(x=>x.low));
 const recentUp=up.filter(n=>n>=i-5),recentGold=gold.filter(n=>n>=i-3);
 const uptwice=up.length>=2&&down.some(n=>n>up.at(-2)&&n<up.at(-1));
 const swingPairs=[];for(let j=0;j<gold.length-1;j++)for(const d of dead){if(d>gold[j]&&d<gold[j+1])swingPairs.push([gold[j],d,gold[j+1]]);}
 const pair=swingPairs.at(-1),recentPair=pair&&i-pair[2]<=5;
 const nearZero=Math.abs(m.hist)<=Math.max(.01,Math.abs(m.dif)*.15);
 const before=M.slice(-15,-2).map(x=>x.hist).filter(val),hadPositive=before.some(x=>x>0),hadSmall=before.some(x=>x>=0&&x<Math.max(...before)*.35);
 const patterns=[
  {id:'OSC_SECOND_CROSS',label:'指標型態一｜動能二次轉強',candidate:uptwice&&recentUp.length>0,confirm:uptwice&&recentUp.length>0&&recentGold.length>0&&volOK&&z.close>priorHigh},
  {id:'OSC_SHRINK_REEXPAND',label:'指標型態二｜動能收斂後再增強',candidate:hadPositive&&hadSmall&&m.hist>0&&m.hist>M[i-1].hist,confirm:hadPositive&&hadSmall&&m.hist>0&&m.hist>M[i-1].hist&&z.close>=prev.close&&volOK},
  {id:'BEAR_TO_BULL_SECOND_CROSS',label:'指標型態三｜空頭反轉二次確認',candidate:uptwice&&recentUp.length>0&&M[i-10].dif<0,confirm:uptwice&&recentUp.length>0&&M[i-10].dif<0&&z.close>priorHigh&&volOK},
  {id:'KD_SECOND_CROSS_WASHOUT',label:'指標型態四｜短線洗盤後再轉強',candidate:!!recentPair&&pair[2]-pair[0]<=20,confirm:!!recentPair&&pair[2]-pair[0]<=20&&z.close>=priorLow&&volOK&&m.hist>0},
  {id:'KD_TRIPLE_CROSS_BOTTOM',label:'指標型態五｜震盪落底三次交叉',candidate:!!recentPair&&pair[1]-pair[0]<=3&&pair[2]-pair[1]<=3&&Math.min(...K.slice(pair[0],pair[2]+1).map(x=>x.k))<35,confirm:!!recentPair&&pair[1]-pair[0]<=3&&pair[2]-pair[1]<=3&&Math.min(...K.slice(pair[0],pair[2]+1).map(x=>x.k))<35&&z.close>=priorLow&&m.hist>0&&volOK}
 ].map(x=>({...x,status:x.confirm?'已確認':x.candidate?'觀察中':'尚未觸發',eventDate:x.candidate?(x.id.startsWith('KD_')&&pair?bars[pair[2]].date:bars[up.at(-1)]?.date||null):null,performanceValidated:false}));
 const weekly=completePeriods(bars,calendar,'WEEK'),monthly=completePeriods(bars,calendar,'MONTH');
 const period=x=>x.status==='已確認'?{status:'已確認',last:x.bars.at(-1)?.date,kd:kd(x.bars).at(-1),macd:macd(x.bars).at(-1)}:{status:'資料不足',reason:x.reason};
 const ma20=mean(bars.slice(-20).map(x=>x.close)),ma60=mean(bars.slice(-60).map(x=>x.close));
 const phase=z.close<ma20&&m.dif<0?'結構轉弱':z.close>ma20&&ma20>ma60&&m.hist>0?'多頭續強':ma20>ma60&&m.hist<=0?'多頭整理':m.dif<0&&m.hist>0?'空頭反彈':z.close>ma20&&m.hist>0?'整理轉強':'區間整理';
 return Object.freeze({version:VERSION,status:'已確認',date:z.date,phase,day:{kd:k,macd:m},week:period(weekly),month:period(monthly),patterns,priceStructure:{priorHigh:round(priorHigh),priorLow:round(priorLow),volumeConfirmed:volOK},researchOnly:true,affectsOriginalRank:false});
}
return Object.freeze({VERSION,kd,macd,completePeriods,study});
});
