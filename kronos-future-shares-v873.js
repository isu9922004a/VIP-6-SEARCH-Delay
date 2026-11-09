/* Derived counts only. Original samples, model, scores and entry/stop rules are immutable. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./kronos-future-core-v1'):root.ShitouKronosFutureCore,node?require('./research-v83/forecast-engine'):root.ShitouForecastPreview,node?require('./kronos-future-share-config-v873'):root.ShitouFutureShareConfig);if(node)module.exports=api;else root.ShitouFutureShares=api;})(globalThis,function(C,F,DEFAULT){
'use strict';
const ORDER=Object.freeze(['up','flat','down']),PATTERNS=Object.freeze(['UP','FLAT','DOWN','UP_FLAT_TIE','DOWN_FLAT_TIE','MULTI_TIE']);
const unavailable=(reason,extra={})=>({state:'LIMITED',reason,tradeAllowed:false,affectsOriginalEligibility:false,...extra});
function typeOf(s){
 const declared=s?.type;if(declared!==undefined&&!['stock','index'].includes(declared))return {type:'unsupported',reportedType:String(declared),source:'explicit type',reason:'這類商品尚未納入新版，等待確認適用方式。'};
 if(s?.instrumentType==='TAIEX'&&s.market==='TWSE_INDEX'&&(s.symbol==='TAIEX'||s.code==='TAIEX'||!s.symbol)){if(declared==='stock')return {type:'unsupported',reason:'商品類型與指數身分不一致。',source:'conflicting type'};return {type:'index',unit:'點',source:'verified instrumentType=TAIEX; market=TWSE_INDEX'};}
 if(s?.securityType==='COMMON'&&['TWSE','TPEX'].includes(s.market)){if(declared==='index')return {type:'unsupported',reason:'商品類型與普通股身分不一致。',source:'conflicting type'};return {type:'stock',unit:'元',source:'official research securityType=COMMON; exchange='+s.market};}
 return {type:'unsupported',reportedType:s?.securityType||s?.instrumentType||declared||'unknown',source:'official securityType/instrumentType',reason:'這類商品或商品類型尚待確認，先不套用個股模板。'};
}
function settings(value=DEFAULT){
 if(!value||!Number.isInteger(value.lookbackTR)||value.lookbackTR<1||value.lookbackTR>159||!Number.isFinite(value.bandMultiplier)||value.bandMultiplier<=0||value.percentageDecimals!==1||!Array.isArray(value.horizons)||value.horizons.length!==3||value.horizons.some((h,i)=>!Number.isInteger(h)||h<1||h>20||i&&h<=value.horizons[i-1])||!value.classificationVersion||!(value.distributionWarningShare>0&&value.distributionWarningShare<1)||!Number.isInteger(value.distributionWarningMinStocks)||value.distributionWarningMinStocks<1)throw Error('模擬占比設定未通過核對');
 return value;
}
function percentages(counts,n,decimals=1){
 if(!Number.isInteger(n)||n<=0||decimals!==1||counts.length!==3||counts.some(v=>!Number.isInteger(v)||v<0)||counts.reduce((a,b)=>a+b,0)!==n)throw Error('分類計數與樣本數不一致');
 const scale=10**decimals,total=100*scale,units=counts.map(v=>Math.floor(v*total/n)),rank=counts.map((v,i)=>({i,remainder:v*total%n})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);for(let i=0,left=total-units.reduce((a,b)=>a+b,0);i<left;i++)units[rank[i].i]++;
 return {raw:counts.map(v=>v/n*100),units,display:units.map(v=>(v/scale).toFixed(decimals)+'%')};
}
function describe(counts,type){
 const maximum=Math.max(...counts),w=ORDER.filter((_,i)=>counts[i]===maximum);let pattern;
 if(w.length===1)pattern={up:'UP',flat:'FLAT',down:'DOWN'}[w[0]];else if(w.length===2&&w.includes('flat'))pattern=w.includes('up')?'UP_FLAT_TIE':'DOWN_FLAT_TIE';else pattern='MULTI_TIE';
 const lines={UP:type==='index'?'模擬較多落在上方，仍要各自核對個股條件。':'模擬較多落在上方，仍要核對原本買進條件。',FLAT:type==='index'?'模擬較多靠近目前點位，先觀察方向。':'模擬較多靠近目前價格，先觀察方向。',DOWN:type==='index'?'模擬較多落在下方，先檢查個股風險計畫。':'模擬較多落在下方，已持有者先檢查原風險計畫。',UP_FLAT_TIE:'偏多與盤整並列最多，目前沒有單一方向占優。',DOWN_FLAT_TIE:'偏空與盤整並列最多，先留意風險。',MULTI_TIE:'多種走法並列最多，目前沒有單一方向占優。'};
 return {pattern,winners:w,line:lines[pattern]};
}
function evaluate(source,forecast,config=DEFAULT){
 const kind=typeOf(source);if(kind.type==='unsupported')return unavailable(kind.reason,{state:'UNSUPPORTED',instrument:kind});
 let cfg;try{cfg=settings(config);}catch(e){return unavailable(e.message,{instrument:kind});}
 const model=C.evaluate(source,forecast);if(model.state!=='READY')return unavailable(model.reason,{state:'MODEL_UNAVAILABLE',instrument:kind});
 const bars=F.inputWindow(source.canonicalBars||source.dailySeries||[]).bars,needed=cfg.lookbackTR+1;if(bars.length<needed)return unavailable('近'+cfg.lookbackTR+'日波幅需要'+needed+'根同基準日K，目前資料不足。',{instrument:kind});
 const recent=bars.slice(-needed),tr=recent.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-recent[i].close),Math.abs(b.low-recent[i].close))),mean=tr.reduce((a,b)=>a+b,0)/cfg.lookbackTR,lower=source.close-cfg.bandMultiplier*mean,upper=source.close+cfg.bandMultiplier*mean;
 if(tr.some(v=>!Number.isFinite(v)||v<0)||!Number.isFinite(mean)||mean<=0||!Number.isFinite(lower)||lower<=0||!Number.isFinite(upper)||upper<=lower)return unavailable('近'+cfg.lookbackTR+'日波幅無法建立有效的正價分類區間，暫不列占比。',{instrument:kind});
 const rows=cfg.horizons.map(horizon=>{const counts=[0,0,0];for(const p of model.closePaths){const close=p[horizon-1];counts[close>upper?0:close<lower?2:1]++;}const n=model.sampleCount,p=percentages(counts,n,cfg.percentageDecimals);return {horizon,date:model.targetDates[horizon-1],counts,denominator:n,rawPercent:p.raw,displayUnits:p.units,displayPercent:p.display,...describe(counts,kind.type)};});
 return {state:'READY',instrument:kind,classificationVersion:cfg.classificationVersion,config:{...cfg,horizons:[...cfg.horizons]},sourceFingerprint:forecast.historySignature,modelIdentity:model.identity,sampleCount:model.sampleCount,trDates:recent.slice(1).map(b=>b.date),trValues:tr,meanTR:mean,band:{lower,upper},rows,tradeAllowed:false,affectsOriginalEligibility:false,affectsOriginalRanking:false,personalStop:null};
}
return Object.freeze({VERSION:'FUTURE_SHARES_V873_1',ORDER,PATTERNS,typeOf,settings,percentages,describe,evaluate});
});
