/* R5.3.2.8.2 display-only verification and classification.
 * Original scan quick filters, score formulas, existing ranks and Worker contract are preserved.
 */
(function(root){
  'use strict';
  const RELEASE=root.ShitouReleaseV50?.release||'石頭少爺 Agent V50 正式版｜R5.3.2.8.2｜手機免CMD自動同步版';
  const POLICY=Object.freeze({
    release:RELEASE,monthlyMomentum:'BONUS_ONLY',monthlyFormalWave:'HARD_GATE',monthlySafety:'HARD_GATE',
    statusPurpose:'研究觀察分類，不構成隔日買進許可',changingOriginalScoring:false
  });
  const num=x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
  const fmt=(x,n=1)=>num(x)===null?'—':num(x).toFixed(n);
  const id=c=>String(c?.report?.stock||c?.report?.code||c?.code||'');
  const name=c=>String(c?.report?.name||c?.name||'—');
  const escape=x=>String(x??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const lite=scan=>String(scan?.analysisProfile||'').toUpperCase()==='MOMENTUM_LITE'||String(scan?.source||'').includes('MOMENTUM_LITE');
  function monthly(c,scan){
    // MOMENTUM_LITE never fetched official monthly candles. Inferred FAIL must not masquerade as verified FAIL.
    if(lite(scan))return {key:'UNKNOWN',label:'🟡 月線尚未驗證',detail:'只有日線資料；不得聲稱月K跌破或站上20MA'};
    const m=String(c?.st?.monthlyStatus||'').toUpperCase();
    if(m==='PASS')return {key:'PASS',label:'🟢 月K≥20MA，資格成立',detail:'以已完成月K驗證'};
    if(m==='FAIL')return {key:'FAIL',label:'🔴 月線20MA資格未成立',detail:'已完成月K未符合正式波段門檻'};
    return {key:'UNKNOWN',label:'🟡 月線尚未驗證',detail:'需載入官方已完成月K，才能宣告正式資格'};
  }
  function breakout(c){
    if(c?.st?.nStatus==='failed'||c?.stability?.key==='RED')return {key:'FAILED',label:'🔴 突破失效／停止新買'};
    if(!c?.st?.nStatus)return {key:'UNKNOWN',label:'⚪ 突破資料尚未驗證'};
    if(c?.st?.nStatus!=='confirmed')return {key:'PREBREAK',label:'⚪ 尚未正式突破B'};
    if(c?.stability?.key==='GREEN')return {key:'CONFIRMED',label:'🟢 已正式突破並站穩'};
    return {key:'WAIT_STABLE',label:'🟡 已突破B，等待站穩'};
  }
  function triplePan(c){
    const source=c?.report||c;
    let a=null;
    try{a=root.ShitouTeacherThreePan?.fromReport?.(source)||null;}catch(e){a={ok:false,reason:String(e.message||e)};}
    if(!a?.ok)return {key:'UNKNOWN',label:'⚪ 三盤尚未驗證',severity:'UNKNOWN',detail:a?.reason||'未取得可交叉核對的完成日K'};
    if(a.signal?.key==='DOWN'||a.phase==='WEAKENING')return {key:'DOWN',label:'🔴 三盤跌破／空頭警戒',severity:'HIGH',detail:a.plain||'三盤向下'};
    if(a.phase==='EXHAUSTING'||a.exhaustion)return {key:'STALL',label:'🔴 三盤止漲／攻擊量退',severity:'HIGH',detail:a.plain||'三盤止漲'};
    if(a.phase==='HEALTHY_PULLBACK'||(/量退|攻擊量退/.test(String(a.volumePhase))&&!a.newHigh))
      return {key:'VOLUME_WEAK',label:'🟠 攻擊量退／等待量能接力',severity:'MEDIUM',detail:a.plain||a.volumePhase};
    if(a.phase==='REBOUND')return {key:'REBOUND',label:'🟠 短彈但較長均線偏弱',severity:'MEDIUM',detail:a.plain};
    return {key:a.phase||'WATCH',label:'🟢 '+String(a.phaseLabel||'三盤未發出跌破訊號'),severity:'LOW',detail:a.plain||''};
  }
  function opportunity(c,scan){
    const b=breakout(c),m=monthly(c,scan),p=triplePan(c);
    const blockers=[];
    if(c?.formalLaunchEligible!==true)blockers.push('非日線正式候選／生命週期觀察');
    if(b.key!=='CONFIRMED')blockers.push(b.label);
    if(p.severity==='HIGH'||p.severity==='MEDIUM')blockers.push(p.label);
    const gap=num(c?.gap),rsi=num(c?.rsi),near=num(c?.upsidePct),rr=num(c?.nearestRRRatio),rem=num(c?.strategicUpsidePct),vol=num(c?.effectiveVol);
    if(gap===null||gap>8||gap<0)blockers.push('20MA乖離未在0～8%');
    if(rsi===null||rsi>75||rsi<50)blockers.push('RSI5熱度不在50～75');
    if(near===null||near<2)blockers.push('第一壓力空間不足2%／資料不足');
    if(rr===null||rr<1)blockers.push('近端價差比不足1:1／資料不足');
    if(rem===null||rem<8)blockers.push('遠期波段剩餘不足8%／資料不足');
    if(vol===null||vol<.8)blockers.push('量能不足0.8倍／資料不足');
    const viable=blockers.length===0;
    const verified=m.key==='PASS'&&p.severity==='LOW';
    return {breakout:b,monthly:m,pan:p,viable,verified,blockers,
      // Never call a scan-lite candidate 'safe to buy': monthly and/or three-pan may not be checked.
      label:!viable?'⛔ 不列新買優先觀察':verified?'🟢 優先觀察（仍須次日確認）':'🟡 日線新買候補（尚非正式可買）'};
  }
  function prepare(scan){
    if(!scan)return scan;
    if(lite(scan)){
      scan.analysisProfile='MOMENTUM_LITE';
      scan.safeRankingReady=false;
      scan.safeRankingReason='月線尚未驗證｜只完成日線掃描，不能把安全榜寫成正式0檔';
    }
    const all=Array.isArray(scan.candidates)?scan.candidates:(scan.launchCandidates||[]);
    all.forEach(c=>{if(!c)return; c.r53281Status=opportunity(c,scan);});
    scan.r53281BuyWatch=all.filter(c=>c?.r53281Status?.viable).slice();
    scan.r53281BreakoutStats={confirmed:0,wait:0,prebreak:0,failed:0,unknown:0};
    all.forEach(c=>{const k=c?.r53281Status?.breakout?.key;if(k==='CONFIRMED')scan.r53281BreakoutStats.confirmed++;else if(k==='WAIT_STABLE')scan.r53281BreakoutStats.wait++;else if(k==='PREBREAK')scan.r53281BreakoutStats.prebreak++;else if(k==='FAILED')scan.r53281BreakoutStats.failed++;else scan.r53281BreakoutStats.unknown++;});
    return scan;
  }
  function safetyLabel(scan){
    if(lite(scan))return '🟡 月線尚未驗證｜本次僅日線掃描；安全榜不正式排名，不能判作0檔';
    if(scan?.safeRankingReason&&scan?.safeRankingReady===false)return '🟡 '+scan.safeRankingReason;
    if(scan?.qualityPass!==true||scan?.marketBundleMeta?.marketCoverageReady!==true||scan?.marketBundleMeta?.industryCoverageReady!==true)return '🟡 市場／產業／深入分析尚未完整驗證';
    const all=scan?.candidates||[];
    if(all.length&&all.some(c=>monthly(c,scan).key==='UNKNOWN'))return '🟡 部分股票官方月線尚未驗證，安全榜尚無完整判斷';
    return '🟢 月線與掃描完整性檢查已完成；安全榜可按原安全硬條件排序';
  }
  const RULES='月線20MA規則：日線發動榜僅作加分，不會單獨淘汰日線候選；「正式月線波段資格」及「安全起漲正式榜」則為硬條件，須以已完成官方月K收盤≥20MA驗證。未取得月K時一律標「月線尚未驗證」，不得標為月線通過或正式安全0檔。';
  function reportNote(scan){
    prepare(scan);const a=scan.r53281BreakoutStats;
    const lines=[
      '【R5.3.2.8.2｜盤後風險與新買觀察分流】',
      '版本：'+RELEASE,
      RULES,
      '突破資格：🟢已突破且站穩 '+a.confirmed+'｜🟡已突破等站穩 '+a.wait+'｜⚪尚未突破 '+a.prebreak+'｜🔴失效 '+a.failed+'｜⚪資料未驗證 '+a.unknown,
      '🛡️ 安全起漲榜：'+safetyLabel(scan),
      '🔥 強勢排名＝原強度計分，保留不變；🧭 新買觀察順位＝從原候選中另按突破、熱度、近壓、RR、量能與三盤風險篩選，僅代表隔日需驗證的觀察順序，不是買點。',
      `🧭 新買觀察候補 ${scan.r53281BuyWatch.length} 檔（不視為月線正式買進名單）。`,
      ...scan.r53281BuyWatch.slice(0,15).map((c,i)=>`${i+1}. ${name(c)}（${id(c)}）｜${c.r53281Status.label}｜${c.r53281Status.monthly.label}｜${c.r53281Status.pan.label}｜近壓 ${fmt(c.upsidePct)}%｜近端RR 1:${fmt(c.nearestRRRatio,2)}`),
      '【逐檔突破、月線與三盤狀態｜與原始分數分開】',
      ...(scan.candidates||[]).map((c,i)=>`${i+1}. ${name(c)}（${id(c)}）｜${c.r53281Status.breakout.label}｜${c.r53281Status.monthly.label}｜${c.r53281Status.pan.label}｜${c.r53281Status.label}${c.r53281Status.blockers.length?'｜原因：'+c.r53281Status.blockers.slice(0,2).join('、'):''}`),
      '※ 三盤顯示「尚未驗證」代表欠缺同日完成日K，絕不可視為三盤安全。以上不更動原主升硬Gate、評分、排名、候選及原Worker API。'
    ];
    return lines.join('\n');
  }
  function addOverview(scan){
    const target=document.getElementById('momentumList');if(!target)return;
    prepare(scan);target.querySelector('#r53281Overview')?.remove();
    const box=document.createElement('div');box.className='rule';box.id='r53281Overview';box.style.cssText='margin:10px 0 16px;padding:15px;border-left:5px solid #b4771a;line-height:1.7';
    const s=scan.r53281BreakoutStats;
    box.innerHTML=`<strong>🧭 月線／突破／風險分流（${escape(RELEASE)}）</strong><p>${escape(RULES)}</p><p>🟢 已站穩 ${s.confirmed}｜🟡 等站穩 ${s.wait}｜⚪ 尚未突破 ${s.prebreak}｜🔴 失效 ${s.failed}｜⚪ 資料未驗證 ${s.unknown}</p><p><strong>${escape(safetyLabel(scan))}</strong></p><p>🔥 原強度榜不等於可買；下方另有「新買觀察順位」。</p>`;
    target.prepend(box);
    target.querySelector('#r53281BuyBoard')?.remove();
    const board=document.createElement('section');board.id='r53281BuyBoard';board.className='rule';board.style.cssText='margin:14px 0;padding:14px 16px;border-left:5px solid #1a6a85';
    const header=document.createElement('strong');header.textContent='🧭 新買觀察順位（非強度榜，也非買進許可）';board.appendChild(header);
    const desc=document.createElement('p');desc.textContent='只對既有入選候選做日線風險分流，不更動原排名；月線未驗證者只能列候補。三盤若無有效完成日K，需另行查核。';board.appendChild(desc);
    const list=scan.r53281BuyWatch.slice(0,15);
    if(!list.length){const empty=document.createElement('p');empty.textContent='本輪沒有同時滿足日線新買觀察門檻的股票；不硬湊名單，也不代表全市場沒有交易機會。';board.appendChild(empty);}
    for(const [i,c] of list.entries()){
      const el=document.createElement('div');el.style.cssText='padding:9px 2px;border-top:1px solid #d8e0e6';
      const a=c.r53281Status;el.textContent=`${i+1}. ${name(c)}（${id(c)}）｜${a.label}｜${a.monthly.label}｜${a.pan.label}｜近壓 ${fmt(c.upsidePct)}%／近端RR 1:${fmt(c.nearestRRRatio,2)}`;board.appendChild(el);
    }
    const allKids=[...target.children];const safeTitle=allKids.find(el=>el!==board&&/安全起漲榜/.test(el.textContent||'')&&el.classList?.contains('rule')&&el.id!=='r53281Overview');
    if(safeTitle)target.insertBefore(board,safeTitle);else target.append(board);
    // Replace only misleading empty-safety explanation, never assert official zero without monthly data.
    if(lite(scan))for(const el of target.children){
      if(el===box||el===board)continue;
      if(el.classList?.contains('rule')&&(/暫停正式排名|本次沒有股票同時通過全部安全起漲條件/.test(el.textContent||''))){
        el.textContent='🛡️ 月線尚未驗證｜本輪只有日線結果，安全起漲正式榜暫不排名。此處不代表安全股為0檔；補齊官方已完成月K後再評估。';
      }
    }
  }
  if(typeof root.momentumSafeRankingReadyV37777==='function'){
    const base=root.momentumSafeRankingReadyV37777;
    root.momentumSafeRankingReadyV37777=function(scan){if(lite(scan))return false;return base(scan);};
  }
  if(typeof root.renderMomentumScanResultV3765==='function'){
    const base=root.renderMomentumScanResultV3765;
    root.renderMomentumScanResultV3765=function(scan){prepare(scan);const result=base(scan);addOverview(scan);return result;};
  }
  if(typeof root.momentumCardV37613==='function'){
    const base=root.momentumCardV37613;
    root.momentumCardV37613=function(c,i,mode){
      const div=base(c,i,mode);if(!div)return div;
      const s=c.r53281Status||opportunity(c,{analysisProfile:'MOMENTUM_LITE'});
      const risk=document.createElement('div');risk.className='rule';risk.style.cssText='margin:7px 0 12px;padding:10px 12px;border-left:5px solid '+(s.pan.severity==='HIGH'?'#b42318':s.pan.severity==='MEDIUM'?'#b4771a':'#466f88')+';line-height:1.65';
      risk.innerHTML=`<strong>🔎 入選資格：${escape(s.breakout.label)}｜${escape(s.monthly.label)}</strong><div><strong>${escape(s.pan.label)}</strong>｜${escape(s.label)}</div><div class="meta">強度分 ≠ 適合新買；原評分、榜單順位與安全Gate未改。</div>`;
      div.insertBefore(risk,div.firstChild);return div;
    };
  }
  for(const key of ['buildMomentumScanTextReportV3763','buildMomentumScanCompactTextReportV377713']){
    if(typeof root[key]!=='function')continue;
    const base=root[key];root[key]=function(scan){
      prepare(scan);let body=String(base(scan)||'');
      if(lite(scan)){
        body=body.replaceAll('安全榜：完整性未全部通過','安全榜：月線尚未驗證')
          .replaceAll('安全榜結果：完整性未全部 PASS','安全榜結果：月線尚未驗證')
          .replaceAll('完整性未通過・僅列候補','月線尚未驗證・暫停排名');
      }
      return `${reportNote(scan)}\n\n${body}`;
    };
  }
  // Canvas generators already dynamically size risk/phase card rows. Image module uses risk field in detail rows.
  root.ShitouR53281Safety=Object.freeze({POLICY,RELEASE,breakout,monthly,triplePan,opportunity,prepare,safetyLabel,riskLine(c,scan){
    const o=c?.r53281Status||opportunity(c,scan||{analysisProfile:'MOMENTUM_LITE'});
    return `${o.breakout.label}｜${o.monthly.label}｜${o.pan.label}｜${o.label}`;
  }});
  root.R50_RELEASE_LABEL=RELEASE;
  document.title=RELEASE;
  document.documentElement.dataset.releaseVersion=RELEASE;
})(window);
