/* R5.3.2.8.2 quality guard: user-selected scan scope, semantics, export and front-end provenance.
   Additive evidence only; does not change old scoring/Gates/Worker contract. */
(function(root){
  'use strict';
  const release=root.ShitouReleaseV50?.release||'石頭少爺 Agent V50 正式版｜R5.3.2.8.2｜手機免CMD自動同步版';
  const modeLabel=m=>m==='ALL'?'全部快篩合格股':m==='TOP_140'?'前140檔（可能另擴掃60檔）':m==='TOP_70'?'前70檔':'舊紀錄／模式未標記';
  function audit(scan){
    if(!scan)return null;
    const mode=scan.requestedMode||null,quick=Number(scan.quickQualified??scan.phase1Ranked),plan=Number(scan.plannedDeep??scan.total),done=Number(scan.done);
    const extra=Number(scan.secondRoundAnalyzedR43||0);
    const full=mode==='ALL',ok=full&&Number.isFinite(quick)&&quick===plan&&Number(scan.deferredCount||0)===0&&scan.completed===true&&done===plan&&Number(scan.failed||0)===0&&Number(scan.dataSkippedCount||0)===0&&Number(scan.pending||0)===0&&scan.fullDataReady!==false;
    const scopeOk=!full||(Number.isFinite(quick)&&quick===plan&&Number(scan.deferredCount||0)===0);
    const label=full?(ok?'✅ 全量範圍已處理且無資料失敗':scopeOk?'⚠️ 全量範圍正確，但尚有未完成、失敗或資料不足':'❌ 全量規劃數與快篩數不符'):'⚪ 範圍限制模式，未掃個股不視為不合格';
    return {mode,requested:modeLabel(mode),actual:modeLabel(scan.actualMode||mode),quick,planned:plan,done,extra,scopeOk,fullVerified:ok,label};
  }
  function section(scan){
    const a=audit(scan);if(!a)return '';
    return ['','【R5.3.2.8.2｜本次掃描範圍驗收】',`使用者所選模式：${a.requested}`,`程式實際模式：${a.actual}`,`原始快篩合格：${Number.isFinite(a.quick)?a.quick:'未知'} 檔`,`原始規劃深掃：${Number.isFinite(a.planned)?a.planned:'未知'} 檔`,`第一輪後追加：${a.extra} 檔`,`最終實際已處理：${Number.isFinite(a.done)?a.done:'未知'} 檔`,`尚未深掃：${scan.deferredCount??'未知'} 檔`,a.label,'※ 全量模式有資料不足、服務失敗或資訊未補齊時仍屬部分驗證，不能將未驗證股票視為策略淘汰。','RSI5 附註：原策略風控以各模組原始資料計算；不同Worker歷史日K樣本／RSI初始化可能導致跨榜RSI5不同，未經核對不得當成同一口徑。'].join('\n');
  }
  if(typeof buildDayTradeTextReportV1==='function'){
    const original=buildDayTradeTextReportV1;
    buildDayTradeTextReportV1=function(scan){const t=original(scan),marker='【R5.3.2.8.2｜本次掃描範圍驗收】';return t.includes(marker)?t:t+section(scan);};
  }
  if(typeof renderDayTradeScanResultV1==='function'){
    const original=renderDayTradeScanResultV1;
    renderDayTradeScanResultV1=function(scan){const result=original(scan);const node=document.getElementById('dayTradeAudit')||document.getElementById('dayTradeMeta');if(node){let el=document.getElementById('r53282ScopeAudit');if(!el){el=document.createElement('div');el.id='r53282ScopeAudit';el.style.cssText='white-space:pre-wrap;line-height:1.65;padding:9px 0;font-weight:650';node.prepend(el);}el.textContent=section(scan).trim();}return result;};
  }
  // Industry enrichment in the legacy wrapper may have run before the optional R4.3
  // 140+60 second round. Refresh it once after the final candidate set is committed.
  if(typeof runDayTradeScanV1==='function'){
    const originalScan=runDayTradeScanV1;
    runDayTradeScanV1=async function(){
      const result=await originalScan.apply(this,arguments);
      try{
        if(typeof lastDayTradeScanDataV1!=='undefined'&&lastDayTradeScanDataV1?.completed===true&&
           root.ShitoIndustryContextV47?.enrichScans){
          await root.ShitoIndustryContextV47.enrichScans();
          if(typeof renderDayTradeScanResultV1==='function')renderDayTradeScanResultV1(lastDayTradeScanDataV1);
        }
      }catch(error){console.warn('產業補充未完成，原掃描與Gate保留',error);}
      return result;
    };
  }
  // Prevent a legacy inline script from leaving the browser title at an older module release.
  document.title=release;
  document.querySelectorAll('.version-pill,footer strong').forEach(x=>{if(/石頭少爺 Agent/.test(x.textContent||''))x.textContent=release;});
  root.ShitouQualityGuard53282=Object.freeze({version:'R5.3.2.8.2',audit,section});
})(typeof globalThis!=='undefined'?globalThis:this);
