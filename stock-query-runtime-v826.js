/* Bounded asynchronous work. A timeout never upgrades missing financial evidence. */
(function(root){'use strict';
function deadline(work,ms,message='等待資料超時，請稍後重試。'){
 let timer;return Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]).finally(()=>clearTimeout(timer));
}
async function json(url,ms=7000){const controller=new AbortController();
 try{return await deadline(async()=>{const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json();},ms,'名稱資料暫時無法取得，可改用股票代號查詢。');}finally{controller.abort();}
}
const api=Object.freeze({version:'QUERY_RUNTIME_8_2_6',deadline,json});root.ShitouQueryRuntime=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
