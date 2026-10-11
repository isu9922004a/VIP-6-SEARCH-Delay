/* 三套盤後結果共同套用波段續強二次把關；原分數、月線與個股專業版圖片均未變動。 */
(function(root){
 'use strict';
 const G=root.ShitouSwingAfterCloseGuardV1;
 if(!G)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const code=c=>String(c?.report?.stock||c?.report?.code||c?.code||'').trim();
 const d8=v=>G.iso(v);
 const marketDate=s=>d8(s?.marketBundleMeta?.completedTradeDate||s?.marketBundleMeta?.targetTradeDate||s?.dataDate||s?.marketBundleMeta?.twseQuoteDate);
 function guardScan(scan,mode){
  if(!scan||!Array.isArray(scan.candidates))return scan;
  const mdate=marketDate(scan),prior=scan.swingOriginalCandidateSet||[];
  const merged=new Map();
  for(const c of [...prior,...scan.candidates]){const k=code(c);if(k)merged.set(k,c);}
  const original=[...merged.values()];
  const res=G.filter(original,{marketDate:mdate,scanner:mode});
  // 原策略既有的 stage / actionGate 仍應成立；不能因波段價量條件通過就越過原 Gate。
  const deferred=[];
  const formal=res.ready.filter(c=>{
   const ok=mode==='momentum'?c.formalLaunchEligible===true:mode==='continuation'?c.actionGate?.top3Eligible===true&&c.actionGate?.dataComplete===true:true;
   if(!ok)deferred.push(c);
   return ok;
  });
  formal.sort((a,b)=>(b.swingAfterClose?.score??0)-(a.swingAfterClose?.score??0));
  scan.swingOriginalCandidateSet=original;scan.swingRiskAudit={model:G.VERSION,date:mdate,original:original.length,ready:formal.length,watch:res.watch.length+deferred.length,blocked:res.blocked.length,missing:res.missing.length,source:'日K完成資料；不表示有真實隔日沖分點資料',monthlyUnverified:mode==='momentum'};
  scan.swingWatch=[...res.watch,...deferred];scan.swingBlocked=res.blocked;scan.swingDataMissing=res.missing;
  scan.candidates=formal;
  if(mode==='momentum'){
   scan.launchCandidates=formal.slice();scan.strengthCandidates=formal.slice();scan.safeCandidates=(scan.safeCandidates||[]).filter(c=>formal.some(x=>code(x)===code(c)));
   scan.sCount=formal.filter(c=>c.grade==='S').length;scan.aCount=formal.filter(c=>c.grade==='A').length;scan.bCount=formal.filter(c=>c.grade==='B').length;
  }
  if(mode==='continuation'){
   if(typeof root.assignDayTradeDisplayRanksV40==='function')root.assignDayTradeDisplayRanksV40(formal);
   scan.sCount=formal.filter(c=>c.grade==='S').length;scan.aCount=formal.filter(c=>c.grade==='A').length;scan.bCount=formal.filter(c=>c.grade==='B').length;
   scan.lowTurnCount=formal.filter(c=>c.setup?.key==='LOW_TURN').length;scan.breakoutCount=formal.filter(c=>c.setup?.key==='BREAKOUT').length;scan.continuationCount=formal.filter(c=>c.setup?.key==='CONTINUATION').length;
  }
  return scan;
 }
 const summary=s=>{
   const a=s?.swingRiskAudit;
   return a?`🛡️ 盤後波段防追高：原策略候選 ${a.original}｜波段正式候選 ${a.ready}｜等待確認 ${a.watch}｜過熱／疑似假突破擋下 ${a.blocked}｜資料不足 ${a.missing}。只看完整收盤日K；隔日沖僅為量價風險代理，非券商交易證據。${a.monthlyUnverified?' 本輪輕量日K不能確認官方月K 20MA資格，請用個股完整查詢核對。':''}`:'🛡️ 尚未完成盤後波段風險驗證';
 };
 function banner(scan,where){
  const host=document.getElementById(where);if(!host)return;
  host.querySelector('.swing-afterclose-audit')?.remove();
  const div=document.createElement('div');div.className='rule swing-afterclose-audit';
  div.style.cssText='margin:10px 0;padding:15px;border:2px solid #277869;border-radius:14px;background:var(--greenbg,#ecf7f2);color:var(--ink,#153348);font-size:15px;line-height:1.65;overflow-wrap:anywhere';
  const risks=(scan.swingWatch||[]).slice(0,4).map(c=>`${esc(c?.report?.name||c?.name||code(c))}（${esc(code(c))}）：${esc(c?.swingAfterClose?.reasons?.[0]||'原策略正式資格尚未成立')}`).join('<br>');
  div.innerHTML=`<strong>🛡️ 三策略共用｜盤後波段續強濾網</strong><div>${esc(summary(scan))}</div>${risks?`<details style="margin-top:6px"><summary>等待確認示例（前4檔）</summary>${risks}</details>`:''}<div style="font-size:12px;margin-top:6px">這是研究候選不是買進訊號；高風險樣本僅降為觀察或排除，不代表隔日一定下跌。原始策略分數及七項條件分均未變。</div>`;
  host.insertBefore(div,host.firstChild);
 }
 // 原主升階段優先級保留；同一主升階段內，波段續強、熱度較低者優先。
 if(typeof root.momentumLaunchCompareV37617==='function'){
  const compare=root.momentumLaunchCompareV37617;
  root.momentumLaunchCompareV37617=(a,b)=>{
   const old=compare(a,b),rankA=a?.mainAdvanceStage?.entryRank,rankB=b?.mainAdvanceStage?.entryRank;
   if(rankA===rankB&&a?.swingAfterClose?.eligible&&b?.swingAfterClose?.eligible){
    const score=(b.swingAfterClose.score??0)-(a.swingAfterClose.score??0);if(score)return score;
   }
   return old;
  };
 }
 if(typeof root.renderMomentumScanResultV3765==='function'){
  const base=root.renderMomentumScanResultV3765;
  root.renderMomentumScanResultV3765=function(scan){guardScan(scan,'momentum');const out=base(scan);banner(scan,'momentumResult');return out;};
 }
 if(typeof root.renderDayTradeScanResultV1==='function'){
  const base=root.renderDayTradeScanResultV1;
  root.renderDayTradeScanResultV1=function(scan){guardScan(scan,'continuation');const out=base(scan);banner(scan,'dayTradeResult');return out;};
 }
 for(const name of ['buildMomentumScanTextReportV3763','buildMomentumScanCompactTextReportV377713','buildDayTradeTextReportV1']){
   if(typeof root[name]!=='function')continue;const base=root[name];
   root[name]=function(scan,...args){if(scan?.candidates&&!scan.swingRiskAudit)guardScan(scan,name.includes('DayTrade')?'continuation':'momentum');return `${summary(scan)}\n\n${base(scan,...args)}`;};
 }
 // 第二套過去的短線初選模型仍保留原演算法；正式選股現在以波段閘覆核，不代表改寫了底層分數。
 const labels=[
  ['.daytrade-shortcut .section-title','⚡ 第二套｜盤後波段續強觀察（原短線初選＋波段風險閘）'],
  ['#dayTradeScanButton','⚡ 查詢盤後波段續強候選'],
  ['.daytrade-query-time-note','⏰ 僅收盤後選股：交易日 17:35 後使用當日完整市場快照；週末或休市日使用最近完成交易日。不進行盤中或即時選股。'],
  ['#dayTradeResult .daytrade-hero-title','⚡ 盤後波段續強｜避開短沖與高檔過熱風險'],
  ['.strong-stock-shortcut .section-title','🔎 第三套｜恆強低熱波段濾網（沿用強勢股初選）']
 ];
 for(const [selector,value] of labels){const node=document.querySelector(selector);if(node)node.textContent=value;}
 const reminder=document.querySelector('.daytrade-shortcut .section-subtitle');if(reminder)reminder.textContent='先由原短線量價模型取得候選，再以完整收盤日K檢查均線持續上揚、近五日站穩、假突破、異常爆量及高檔過熱；未通過者不列波段正式名次。原評分保留，不能把這套當作盤中或隔日沖推薦。';
 const note=document.createElement('div');note.className='rule';note.style.cssText='margin:10px 0;padding:10px;line-height:1.6';note.textContent='📌 三套策略均僅研究盤後完成日K；正式波段候選仍須個股查詢確認月K 20MA資格。缺少60根完整日K或日期不一致時只列資料不足，絕不補猜。';
 document.querySelector('.strong-stock-shortcut .section-subtitle')?.after(note);
 function canStart(now=new Date()){
  const f=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const v=k=>f.find(x=>x.type===k)?.value,today=`${v('year')}-${v('month')}-${v('day')}`,minute=Number(v('hour'))*60+Number(v('minute'));
  const marketClosed=root.ShitouStrongStockFilterV47?.marketClosedStateV49?.(null,today);
  return {ok:marketClosed?.closed===true||minute>=17*60+35,today,reason:'交易日 17:35 前禁止啟動選股；盤後完整 TWSE／TPEX 同日快照可用後才查詢。'};
 }
 for(const [fn,errorId] of [['runMomentumScanV3769','momentumError'],['runDayTradeScanV1','dayTradeError'],['runStrongStockScanV47','strongStockError']]){
  if(typeof root[fn]!=='function')continue;
  const base=root[fn];root[fn]=function(...args){const state=canStart();if(!state.ok){const el=document.getElementById(errorId);if(el){el.style.display='block';el.textContent=`⏰ ${state.reason}`;}return;}const outcome=base(...args);
   if(fn==='runDayTradeScanV1')return Promise.resolve(outcome).finally(()=>{const button=document.getElementById('dayTradeScanButton');if(button&&!button.disabled)button.textContent='⚡ 查詢盤後波段續強候選';});
   return outcome;};
 }
 root.ShitouSwingScanR1=Object.freeze({guardScan,canStart,summary});
})(window);
