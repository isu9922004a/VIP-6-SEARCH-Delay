/* A DAILY_ONLY response never becomes verified monthly data. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./worker-data-contract-v1.js'):root.ShitouWorkerDataContractV1);if(node)module.exports=api;else root.ShitouResearchQueryFallback=api;})(globalThis,function(C){
'use strict';
function shouldUseDaily(response,data){return response?.status>=500||data?.error_code===1102||data?.error_name==='worker_exceeded_resources'||data?.retrySuggested===true&&/月K|月20MA|official.*month|monthly/i.test(String(data.error||data.message||data.officialMonthlyUnavailableReason||''));}
function adapt(daily,{stock,market,reason='完整分析服務暫時無法使用',failureCode=null}={}){
 const checked=C.verify(daily);if(!checked.ok)throw Error('日線備援未通過來源檢查：'+checked.reason);
 const c=checked.contract;if(c.sourceMode!=='DAILY_ONLY'||c.stock!==String(stock)||!['TWSE','TPEX'].includes(c.market)||market&&c.market!==String(market).toUpperCase())throw Error('日線備援的股票、市場或資料模式不符');
 return {...daily,officialMonthlyUnavailable:true,officialMonthlyUnavailableReason:'完整分析暫不可用；本次僅使用已完成日線，月線資格與固定倍數不判讀。',monthlyStatus:'UNAVAILABLE',monthlyPass:null,entry:null,startMonthConfirmed:false,technicalOnlyFallback:{active:true,profile:'DAILY_ONLY',reason:String(reason),failureCode,monthlyVerified:false}};
}
return Object.freeze({VERSION:'RESEARCH_QUERY_FALLBACK_8_2_8',shouldUseDaily,adapt});
});
