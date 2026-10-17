/* Fourth tower strategy only: opt-in two-stage screening. Experimental, non-certified.
 * Original FULL and DAILY_ONLY modes, ranking criteria and other strategies unchanged.
 */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./tower-line-core.js'):root.ShitouTowerCore,typeof module==='object'&&module.exports?require('./tower-trend-classifier.js'):root.ShitouTowerTrend,typeof module==='object'&&module.exports?require('./tower-gold-scanner.js'):root.ShitouTowerScanner);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouTowerFastA=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,A,S){
'use strict';
const eq=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(.02,Number(a)*.0001);
const market=i=>String(i?.q?.market||i?.market||'').toUpperCase()==='TPEX'?'TPEX':'TWSE';
function inspect(item,x,date){
  if(!x?.ok||!x.data)return {action:'FULL',reason:'日K缺失或來源失敗'};
  const r=x.data,q=item.q,rows=r.canonicalBars||r.dailySeries,last=rows?.at(-1);
  if(String(r.stock||r.code||'')!==item.code||(r.market&&String(r.market).toUpperCase()!==(market(item)==='TPEX'?'TPEX':'TWSE'))||!Array.isArray(rows)||rows.length<80||!last||C.date(r.closeDate)!==date||C.date(last.date)!==date)return {action:'FULL',reason:'日期、代號或完整長度不明'};
  if(!q||C.date(q.quoteDate)!==date||!eq(q.close,last.close)||!eq(r.close,last.close)||!(Number(q.volume)>0)||!(Number(last.volume)>0)||Math.abs(Number(q.volume)-Number(last.volume))/Number(q.volume)>.2)return {action:'FULL',reason:'與市場官方快照不一致'};
  const safe=rows.map(v=>({...v}));safe.at(-1).volume=Number(q.volume);
  const t=C.analyze({...r,canonicalBars:safe},{asOf:date,completed:true});
  if(!t.ok||t.bars.length<80)return {action:'FULL',reason:'日K未通過寶塔核心資料檢查'};
  // A signal can be safely screened only when its recent T3 state is independent
  // of the warmup history. Verify recomputation on an independent 60-bar tail.
  const s=t.states[3],h=s.history,prior=h.at(-2),independent=C.compute(t.bars.slice(-60),3);
  if(!s.ready||!prior||independent.color==='UNKNOWN'||!independent.ready||independent.color!==s.color||independent.previousColor!==s.previousColor||independent.flip!==s.flip)return {action:'FULL',reason:'短視窗寶塔狀態無法獨立確認'};
  const type=s.flip==='BLACK_TO_RED'&&s.lastRedDate===date?'B':s.color==='RED'&&s.previousColor==='RED'&&s.redDays>=2?'A':null;
  return {action:type?'FULL':'FAST_REJECT',reason:type?'A/B 候選 FULL 複驗':'日K T3 可確定無 A/B 訊號',type,report:r,rows:safe};
}
function getOne(item,payload){if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))return null;const found=payload.results.filter(x=>String(x?.code||x?.data?.stock||x?.data?.code||'')===item.code);return found.length===1?found[0]:null;}
async function scan({items,universe,parsed=universe,excluded=0,date,fetchBatch,subset='ALL',requestedMode='all',marketTower=null,onProgress=()=>{},shouldStop=()=>false,batchSize=8,auditPerMarket=2}){
 if(!C.date(date)||!Array.isArray(items)||new Set(items.map(x=>x.code)).size!==items.length)throw Error('雙階段模式輸入數據不完整或股票重複');
 const quick=[],needFull=[],lightRejected=new Map(),hints=new Map(),issues=[];
 let fetched=0;
 for(let start=0;start<items.length;start+=batchSize){
  if(shouldStop())throw Error('使用者停止雙階段初篩；未產生正式結果');
  const batch=items.slice(start,start+batchSize),payload=await fetchBatch(batch,'DAILY_ONLY');
  if(payload?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(payload.results))throw Error('輕量批次資料格式不完整，拒絕初篩');
  for(const item of batch){const v=inspect(item,getOne(item,payload),date);hints.set(item.code,v);if(v.action==='FAST_REJECT')lightRejected.set(item.code,v);else needFull.push(item);}
  fetched+=batch.length;onProgress({phase:'FAST',processed:fetched,planned:items.length,fullNeeded:needFull.length,fastRejected:lightRejected.size});
 }
 // A small negative sample checks divergence, but can NEVER certify the remaining negatives.
 const audits=[];for(const m of ['TWSE','TPEX'])audits.push(...items.filter(x=>market(x)===m&&lightRejected.has(x.code)).slice(0,auditPerMarket));
 const fullQueue=[...needFull,...audits];
 const verify=await S.scan({items:fullQueue,universe:fullQueue.length,parsed:fullQueue.length,excluded:0,date,fetchBatch,subset:'ALL',requestedMode:'all',profile:'FULL',marketTower,batchSize,shouldStop,onProgress:v=>onProgress({phase:'FULL',processed:v.attempted,planned:fullQueue.length,fullNeeded:needFull.length,fastRejected:lightRejected.size})});
 if(shouldStop())throw Error('使用者停止 FULL 複驗；拒絕產生完整名單');
 const verified=new Map(verify.results.map(r=>[r.code,r]));
 for(const item of fullQueue){const r=verified.get(item.code);if(!r||!r.tower.ok||!r.risk.ok)throw Error(`FULL 完整驗證失敗：${item.code}；本次雙階段掃描停止，請使用原 FULL 模式`);}
 // Reconcile DAILY_ONLY vs FULL for all light A/B candidates and all audit negatives.
 // Never silently demote or lose a FULL A/B candidate.
 for(const item of fullQueue){const a=verified.get(item.code),v=hints.get(item.code);if(!a||!v)continue;
  if(v.action==='FAST_REJECT'&&a.type)throw Error(`雙階段漏選警報：${item.code} FULL 出現 ${a.type}，但日K初篩排除；已拒絕產生加速排名，請使用原 FULL 模式`);
  if(v.type&&a.type!==v.type)throw Error(`雙階段訊號不一致：${item.code} 日K=${v.type} FULL=${a.type||'無'}；已拒絕產生加速排名`);
 }
 const results=[];
 for(const item of items){
  const r=verified.get(item.code),v=lightRejected.get(item.code);
  if(r){results.push(r);continue;}
  if(v){const a=A.analyze({...v.report,name:item.name||v.report.name,canonicalBars:v.rows},{asOf:date,completed:true,marketTower});if(!a.tower.ok||a.type)throw Error(`雙階段初篩出現不穩定狀態：${item.code}，請回原 FULL`);results.push(a);continue;}
  issues.push({code:item.code,reason:'FULL 必要驗證結果缺失'});
 }
 const fullIssues=verify.issues.filter(x=>!issues.some(y=>y.code===x.code));issues.push(...fullIssues);
 const fullRequired=needFull.length,actualFull=verified.size,fastRejected=lightRejected.size;
 const success=results.filter(a=>a.tower.ok&&a.risk.ok&&a.status!=='DATA_UNAVAILABLE').length,failed=items.length-results.length;
 const dataUnavailable=results.length-success;
 const result={date,model:C.MODEL,release:C.RELEASE,universe,parsed,excluded,quick:items.length,planned:items.length,requestedMode,actualMode:'all',profile:'FAST_A_SHADOW',subset,attempted:items.length,success,failed,dataUnavailable,pending:0,results,issues,
  complete:fastRejected===0&&failed===0&&dataUnavailable===0&&quickBalanced(universe,parsed,excluded,items.length)&&results.length===items.length,
  fullMarketCertified:false,
  fastAudit:{mode:'SHADOW_NOT_FULL_PARITY_CERTIFIED',dailyScanned:items.length,fastRejected,fullRequired,fullAudit:audits.length,fullReceived:actualFull,fullSignalMatched:true,note:'抽樣一致不代表全母體與FULL等價；僅正式候選由FULL複驗，不宣稱全市場FULL完整排名。'}};
 result.candidates=result.results.filter(r=>r.type&&['FORMAL_CANDIDATE','CONDITIONAL_WATCH'].includes(r.status)&&(subset==='ALL'||subset===r.type)).sort(S.compare);result.riskCandidates=result.results.filter(r=>r.type&&['NO_CHASE','REJECT','DATA_UNAVAILABLE'].includes(r.status)&&(subset==='ALL'||subset===r.type)).sort(S.compare);
 result.text=S.buildText(result)+'\n【方案A雙階段加速實驗附錄】\n'+`輕量檢查 ${items.length}｜FULL必驗 ${fullRequired}｜額外FULL抽核 ${audits.length}｜輕量排除 ${fastRejected}｜FULL結果 ${actualFull}`+'\n注意：未對每檔輕量排除股票執行FULL，本次不可宣稱與原版FULL全量結果完全相同；正式全量認證必須使用原FULL模式。';
 return result;
}
function quickBalanced(universe,parsed,excluded,quick){return Number(quick)+Number(excluded)===Number(parsed)&&Number(parsed)===Number(universe);}
return Object.freeze({inspect,scan,revision:'TOWER_FAST_A_SHADOW_1'});
});
