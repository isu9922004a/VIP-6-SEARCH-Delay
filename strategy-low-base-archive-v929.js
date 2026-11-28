/* Shared V9.29 fifth-strategy archive contract. Partial inputs never imply confirmed zero. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouLowBaseArchiveV929=api;})(globalThis,function(){
'use strict';
const SCHEMA='LOW_BASE_BREAKOUT_ARCHIVE_V1',MODEL='LOW_BASE_VOLUME_BREAKOUT_V1',VERSION='V9.29.1-BALANCED',HEX=/^[a-f0-9]{64}$/,DATE=/^\d{4}-\d{2}-\d{2}$/;
const int=n=>Number.isSafeInteger(n)&&n>=0,finite=n=>typeof n==='number'&&Number.isFinite(n);
const statuses=['PASS','FAIL','EXCLUDED','DATA_ERROR','INSUFFICIENT_DATA'];
const rank=(a,b)=>b.score-a.score||a.code.localeCompare(b.code);
const grade=n=>n>=90?'S':n>=80?'A':n>=70?'B':n>=60?'C':'D';
function validate(a,{date,snapshotHash,historyManifestHash,fundamentalEvidenceHash}={}){
 const fail=reason=>({ok:false,reason});
 if(!a||a.schema!==SCHEMA||a.model!==MODEL||a.version!==VERSION||!DATE.test(a.date)||a.date!==date||!HEX.test(snapshotHash||'')||a.snapshotHash!==snapshotHash||!HEX.test(a.historyManifestHash||'')||(historyManifestHash&&a.historyManifestHash!==historyManifestHash))return fail('榜單版本、交易日或來源指紋不符');
 if(!int(a.total)||a.total===0||!a.counts||!statuses.every(k=>int(a.counts[k]))||Object.keys(a.counts).some(k=>!statuses.includes(k))||statuses.reduce((n,k)=>n+a.counts[k],0)!==a.total)return fail('母體統計不一致');
 const unavailable=a.counts.DATA_ERROR+a.counts.INSUFFICIENT_DATA;
 if(a.unavailable!==unavailable||typeof a.marketCoverageReady!=='boolean'||typeof a.complete!=='boolean'||a.complete!==(unavailable===0&&a.marketCoverageReady)||a.zeroConfirmed!==(a.complete&&a.counts.PASS===0)||typeof a.fundamentalsConnected!=='boolean'||(a.fundamentalsConnected?(!HEX.test(a.fundamentalEvidenceHash||'')||a.fundamentalEvidenceHash!==fundamentalEvidenceHash):a.fundamentalEvidenceHash!=null)||a.performanceBacktest!==false)return fail('資料不足或零入選狀態不一致');
 if(!Array.isArray(a.candidates)||!Array.isArray(a.top8)||a.candidates.length!==a.counts.PASS||a.top8.length>8)return fail('候選數量不一致');
 const ids=new Set();
 for(let i=0;i<a.candidates.length;i++){
  const c=a.candidates[i];
  if(!/^[1-9]\d{3}$/.test(c?.code||'')||ids.has(c.code)||c.date!==date||typeof c.name!=='string'||!c.name.trim()||!finite(c.close)||c.close<=0||!finite(c.score)||c.score<0||c.score>100||!finite(c.scoreUpper)||c.scoreUpper<c.score||c.scoreUpper>100||c.grade!==grade(c.score)||c.gatesPassed!==21||!HEX.test(c.sourceHash||'')||typeof c.historyFingerprint!=='string'||!c.historyFingerprint||i&&rank(a.candidates[i-1],c)>0)return fail('候選身分、分數或排序不符');
  ids.add(c.code);
 }
 if(JSON.stringify(a.top8)!==JSON.stringify(a.candidates.filter(c=>c.score>=60).slice(0,8).map(c=>c.code)))return fail('TOP8不符合原策略排序');
 return {ok:true,complete:a.complete,zeroConfirmed:a.zeroConfirmed};
}
function build(scan,{snapshotHash,historyManifestHash,fundamentalEvidenceHash=null}){
 if(!scan||scan.model!==MODEL||scan.stopped||scan.pending!==0||scan.identityErrors!==0||scan.deferred!==0||scan.processed!==scan.marketTotal||scan.results.length!==scan.marketTotal||scan.marketSnapshotFingerprint!==snapshotHash)throw Error('掃描未完成或身分不一致，不得發布');
 const counts=Object.fromEntries(statuses.map(k=>[k,scan.results.filter(x=>x.status===k).length]));
 const candidates=scan.candidates.map(c=>({code:c.code,name:c.name,date:c.date,close:c.features?.close,score:c.quality.score,scoreUpper:c.quality.scoreUpper,grade:c.quality.grade,gatesPassed:c.checks?.filter(x=>x.pass===true).length,sourceHash:c.sourceHash,historyFingerprint:c.historyFingerprint}));
 const a={schema:SCHEMA,version:VERSION,model:MODEL,date:scan.date,snapshotHash,historyManifestHash,total:scan.marketTotal,counts,unavailable:counts.DATA_ERROR+counts.INSUFFICIENT_DATA,marketCoverageReady:scan.fullMarketCertified||scan.marketCoverageReady===true,complete:scan.fullMarketCertified===true,zeroConfirmed:scan.zeroConfirmed===true,candidates,top8:scan.top8.map(c=>c.code),fundamentalsConnected:fundamentalEvidenceHash!==null,fundamentalEvidenceHash,performanceBacktest:false};
 const checked=validate(a,{date:scan.date,snapshotHash,historyManifestHash,fundamentalEvidenceHash});if(!checked.ok)throw Error(checked.reason);
 return a;
}
function text(a,context){
 const checked=validate(a,context);if(!checked.ok)return {ready:false,complete:false,text:'⑤ 主升段低位階帶量突破：盤後榜單尚未核驗（'+checked.reason+'）'};
 const byCode=new Map(a.candidates.map(c=>[c.code,c])),fmt=n=>n.toFixed(2);
 const lines=['⑤ 主升段低位階帶量突破｜均衡起漲版｜'+a.date,'已處理 '+a.total+' 檔｜必要條件通過 '+a.counts.PASS+'｜資料待核對 '+a.unavailable,a.complete?'全市場已核對':'部分資料不足；非完整市場排名',...a.top8.map((code,i)=>{const x=byCode.get(code);return (i+1)+'. '+x.code+' '+x.name+' '+fmt(x.close)+'元｜'+fmt(x.score)+'分（'+x.grade+'）';})];
 if(!a.top8.length)lines.push(a.zeroConfirmed?'已核對全市場，無符合必要條件標的。':a.counts.PASS?'符合必要條件，但無達60分之TOP8候選。':'未確認候選；不可宣稱全市場零入選。');
 lines.push(a.fundamentalsConnected?'已核對基本面封存；缺少項目不加分；尚未驗證績效。':'基本面尚未接通，不加分；尚未驗證績效。');
 return {ready:true,complete:a.complete,zeroConfirmed:a.zeroConfirmed,text:lines.join('\n')};
}
return Object.freeze({SCHEMA,MODEL,VERSION,validate,build,text});
});
