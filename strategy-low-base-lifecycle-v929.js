/* V9.29 post-close lifecycle candidate. Inputs must be independently verified completed daily bars. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouLowBaseLifecycleV929=api;})(globalThis,function(){
'use strict';
function track(signal,bars,asOf){
 const unavailable=reason=>({state:'UNAVAILABLE',reason,asOf});
 if(signal?.eligible!==true||!signal.date||!Array.isArray(bars)||!asOf||signal.date>asOf)return unavailable('缺少已確認突破訊號或指定交易日');
 if(bars.some((b,i)=>!b.date||b.date>asOf||i>0&&b.date<=bars[i-1].date||!['open','high','low','close','volume'].every(k=>Number.isFinite(b[k]))||b.low<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.volume<=0))return unavailable('日K順序、日期或價量無效');
 if(bars.at(-1)?.date!==asOf)return unavailable('缺少指定日完成行情');
 const i=bars.findIndex(b=>b.date===signal.date);
 if(i<19||i!==bars.findLastIndex(b=>b.date===signal.date))return unavailable('缺少突破日或歷史資料');
 const s=bars[i],ma=(n,j)=>j>=n-1?bars.slice(j-n+1,j+1).reduce((a,c)=>a+c.close,0)/n:null;
 if(!Number.isFinite(signal.features?.ma20)||!Number.isFinite(signal.features?.vma5)||signal.features.vma5<=0||s.close!==signal.features?.close||s.volume!==signal.features?.volume||Math.abs(ma(20,i)-signal.features.ma20)>1e-8)return unavailable('突破日行情與原始訊號不一致');
 // Candidate definition: follow-up volume must be at least the pre-signal five-session mean. This threshold is not calibrated by performance research.
 const volumeFloor=signal.features.vma5;
 let state='INITIAL',failureDate=null,lastVolumeHealthy=null,confirmedAt=null;
 for(let j=i+1;j<bars.length&&j-i<=5;j++){
 const b=bars[j],m=ma(20,j),m60=ma(60,j),age=j-i;
 if(b.close<s.low||b.close<m){state='FAILED';failureDate=b.date;break;}
 if(b.close/m-1>.08||m60!==null&&b.close/m60-1>.20){state='OVERHEATED';continue;}
 lastVolumeHealthy=b.volume>=volumeFloor;
 if(age===1&&b.close>=s.close&&lastVolumeHealthy){state='CONFIRMED';confirmedAt=b.date;}
 else if(age>=2&&b.close>=s.close&&b.close>=bars[j-1].close&&lastVolumeHealthy){state='DEVELOPING';confirmedAt??=b.date;}
 else state='WATCH';
 }
 const age=bars.length-1-i;
 if(age>5&&state!=='FAILED')state='EXPIRED';
 return {state,age,asOf,signalDate:s.date,breakoutPrice:s.close,breakoutLow:s.low,ma20:ma(20,bars.length-1),failureDate,confirmedAt,volumeFloor,lastVolumeHealthy,scope:'盤後候選追蹤，並非買賣指令'};
}
return Object.freeze({track});
});
