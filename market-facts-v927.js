/* V9.27 stage 1: completed-session facts only. No prediction or ranking. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouMarketFacts927=api;})(globalThis,function(){
'use strict';
function summarize(history,checked){
 if(!checked?.ok||history?.symbol!=='TAIEX'||history.market!=='TWSE_INDEX'||history.completed!==true||history.dailySeriesMeta?.onlyCompletedBars!==true||history.priceAdjustment?.basis!=='OFFICIAL_INDEX_LEVEL'||history.priceAdjustment?.verified!==true)return {ok:false,reason:checked?.reason||'完成日 K 與指數來源未核對'};
 const rows=checked.bars,raw=history.dailySeries;
 if(!Array.isArray(rows)||!Array.isArray(raw)||rows.length!==raw.length||rows.length<21||history.closeDate!==checked.timing?.expectedDate||rows.at(-1).date!==history.closeDate||rows.at(-1).close!==history.close||!rows.every((r,i)=>['date','open','high','low','close','volume'].every(k=>r[k]===raw[i]?.[k])))return {ok:false,reason:'已完成交易日或原始日 K 不一致'};
 const last=rows.at(-1),prev=rows.at(-2),ma=n=>rows.slice(-n).reduce((sum,r)=>sum+r.close,0)/n,hi=Math.max(...rows.slice(-20).map(r=>r.high)),lo=Math.min(...rows.slice(-20).map(r=>r.low));
 if(![last.close,prev.close,ma(5),ma(20),hi,lo].every(x=>Number.isFinite(x)&&x>0))return {ok:false,reason:'歷史點位不足'};
 return {ok:true,date:last.date,close:last.close,change:last.close-prev.close,changePct:(last.close/prev.close-1)*100,ma5:ma(5),ma20:ma(20),high20:hi,low20:lo,bars:rows.length,source:history.dailySeriesMeta.source||'官方指數日 K',retrievedAt:history.sourceReceipt.retrievedAt};
}
function mount(doc,host,validate,getHistory){
 const section=doc.createElement('section');section.id='marketFacts927';section.className='market-life-status';section.style.cssText='padding:12px;margin:8px 0;border:1px solid currentColor;border-radius:8px;';
 const heading=doc.createElement('h3');heading.textContent='V9.27｜已完成日 K 趨勢觀察';
 const note=doc.createElement('p');note.textContent='僅顯示已完成日 K 的客觀點位；不提供新預測分數或買賣訊號。';
 const button=doc.createElement('button');button.type='button';button.textContent='核對最新盤後點位';button.className='btn market-btn';
 const result=doc.createElement('div');result.id='marketFacts927Result';result.setAttribute('aria-live','polite');
 section.append(heading,note,button,result);host.after(section);
 let generation=0;
 const clear=()=>{generation++;result.replaceChildren();button.disabled=false;};
 const fmt=x=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2,minimumFractionDigits:2}).format(x);
 button.addEventListener('click',async()=>{const ticket=++generation;button.disabled=true;result.textContent='核對資料中…';try{
 const source=await getHistory();if(ticket!==generation)return;const r=summarize(source,validate(source));if(!r.ok)throw Error(r.reason);
 result.replaceChildren();for(const t of ['行情截至 '+r.date,'收盤 '+fmt(r.close)+' 點｜較前日 '+(r.change>=0?'+':'')+fmt(r.change)+' 點（'+(r.changePct>=0?'+':'')+fmt(r.changePct)+'%）','5 日均線 '+fmt(r.ma5)+' 點｜20 日均線 '+fmt(r.ma20)+' 點','近 20 日最高 '+fmt(r.high20)+' 點｜最低 '+fmt(r.low20)+' 點','來源 '+r.source+'｜已核對 '+r.bars+' 根完成日 K','新趨勢預測、ABC 歷史關卡與勝率仍在研究驗證，尚未開放。']){
 const p=doc.createElement('p');p.textContent=t;result.append(p);}
 }catch(e){if(ticket===generation)result.textContent='資料待核對：'+e.message;}finally{if(ticket===generation)button.disabled=false;}});
 for(const id of ['marketAnalyzeButton','market-refresh','market-type'])doc.getElementById(id)?.addEventListener(id==='market-type'?'change':'click',clear,true);
 return section;
}
return Object.freeze({summarize,mount});
});
