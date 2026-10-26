/* Append-only research identities. No in-place updates or moving old stops. */
(function(r,f){const c=typeof module==='object'&&module.exports,a=f(c?require('./research-common-v1.js'):r.ShitouResearchCommon);if(c)module.exports=a;else r.ShitouResearchHistory=a;})(globalThis,function(U){
'use strict';
function advance(previous,current){if(previous.code!==current.code||current.date<=previous.date)throw Error('必須同股票且時間遞增');const closed=current.close;return U.freeze({original:previous,asOfDate:current.date,transitions:(previous.scenarios||[]).map(s=>({id:s.id,originalDate:previous.date,originalTrigger:s.triggerPrice,originalInvalidation:s.invalidationPrice,signalStatus:s.signalStatus==='CONFIRMED'&&closed<s.invalidationPrice?'INVALIDATED':s.signalStatus,stopPlan:s.signalStatus==='CONFIRMED'&&closed<s.invalidationPrice?null:s.riskReward,reason:closed<s.invalidationPrice?'原假設收盤失效；舊停損計畫不再沿用':'原假設未觸發收盤失效'})),current});}
function append(storage,a){if(!a?.code||!a?.date)return;const key='shitou-research-history-r13:'+a.code+':'+a.date+':'+U.hash([a.sourceSnapshotId,a.parameters,a.flags]);const serialized=JSON.stringify(a),old=storage.getItem(key);if(old&&old!==serialized)throw Error('研究快照身分衝突，禁止覆寫');if(!old)storage.setItem(key,serialized);return key;}
return Object.freeze({advance,append});
});
