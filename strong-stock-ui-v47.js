/* Strong Stock V50 R5.3.2.5.6.3.1 — 圖片版面一致性；原選股與排序邏輯不變。 */
(function(root){
  'use strict';
  const F=root.ShitouStrongStockFilterV47;
  if(!F)throw new Error('強勢飆股濾網策略模組未載入');
  // 第三套獨立策略。R4.9 不再讓 800+ 檔逐檔執行重型 SCAN_LITE；
  // 改由 Market Worker 每批取得 DAILY_ONLY 已完成日K，再由前端沿用同一套 F.evaluate 正式判斷。
  const BATCH=8,REQUEST_GAP=250,CPU_RETRY_GAP=1800,RETRY_GAP=800;
  const DAILY_BATCH_TIMEOUT_MS=32000;
  const CACHE_KEY='SHITOU_STRONG_STOCK_TEACHER_R5328';
  const CACHE_REV='TEACHER_V1_CANONICAL_VOLUME_EXCLUSIONS_RSI5';
  const CPU_BREAKER_CONSECUTIVE=4;
  const FAILURE_WINDOW_SIZE=16;
  const MARKET_ENDPOINT_R49=(typeof MARKET_API_BASE_URL!=='undefined'&&MARKET_API_BASE_URL)?MARKET_API_BASE_URL:'https://shitou-taiwanmarket-api.d318426.workers.dev';
  let activeCache=null;
  let last=null,running=false,stopped=false;
  const id=key=>document.getElementById('strongStock'+key);
  const html=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=(value,digits=2)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(digits):'資料不足';
  const fibLine=c=>{const t=c?.wave?.teacher;return t?`教材波段：${t.phaseLabel}｜${t.volumePhase}｜${t.pattern.label}`:'教材波段：資料不足';};
  const displayError=(text,type='error')=>{const el=id('Error');if(el){el.style.display='block';el.style.color=type==='warn'?'var(--yellow)':'var(--red)';el.textContent=text;}};
  const note=text=>{const el=id('Message');if(el)el.textContent=text;};
  const marketDateDiagnostic=meta=>{
    const m=meta||{},items=[['目標日',m.targetTradeDate||m.completedTradeDate],['上市',m.twseQuoteDate],['上櫃',m.tpexQuoteDate]]
      .filter(([,value])=>value!==null&&value!==undefined&&String(value).trim())
      .map(([label,value])=>`${label} ${value}`);
    return items.length?`｜Worker 日期：${items.join('／')}`:'';
  };
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const isCpuError=value=>/exceeded\s*CPU|CPU\s*time\s*limit|CPU.*(?:超限|用量)|1102|script.*exceeded/i.test(String(value||''));
  const isRetryable=value=>/CPU|1102|timeout|timed out|aborted|failed to fetch|network|HTTP\s*(?:429|5\d\d)|服務暫時|連線|逾時|分析未回傳/i.test(String(value||''));
  const statusTitle=scan=>scan.fullMarketCertified?'完整市場驗證報告':'部分驗證報告｜非全市場完整排名';
  const RELEASE_R493='石頭少爺 Agent V50 正式版｜R5.3.2.8｜七類排除與RSI 5T清晰報告版';
  const triggerMeta=c=>{
    const close=F.number(c?.close),trigger=F.number(c?.trigger);
    const crossed=close!==null&&trigger!==null&&close>=trigger;
    return crossed?{icon:'✅',label:'已突破確認價／回測觀察價'}:{icon:'🎯',label:'等待突破價'};
  };
  const confidenceText=c=>{
    const a=c?.volumeAudit;if(!a)return '成交量來源：未提供校正資訊';
    const level={HIGH:'高',MEDIUM:'中',LOW:'低'}[a.confidence]||'待確認';
    return `成交量資料信心 ${level}｜市場快照 ${Math.round(a.officialVolume||0).toLocaleString()} 股／來源日K ${Math.round(a.sourceVolume||0).toLocaleString()} 股｜差異 ${fmt(a.diffPct,1)}%${a.reconciled?'｜已用市場快照校正':''}`;
  };
  function snapshotFingerprint(bundle,date){
    // A date alone is insufficient: a later corrected snapshot invalidates earlier outcomes.
    const quotes=[...bundle.map].sort(([a],[b])=>a.localeCompare(b)).map(([code,q])=>[
      code,q.market,q.quoteDate,q.open,q.high,q.low,q.close,q.volume,q.tradeValue,q.pct,q.closePos,q.fullDelivery,q.fullDeliveryDate,q.isSpecialProduct,
      bundle.sectorMap?.get(code)?.industryCode,bundle.sectorMap?.get(code)?.industryName
    ]);
    // The outer Worker response gets a fresh generation time per call. Cache identity
    // must use the underlying published snapshot instead of the volatile response time.
    return JSON.stringify([F.MODEL,CACHE_REV,'DAILY_ONLY',date,bundle.snapshotRows,bundle.snapshotDropped||0,
      bundle.meta?.snapshotContentSha256||bundle.meta?.snapshotGeneratedAt||null,quotes]);
  }
  function recoverCache(fingerprint,marketDate){
    if(activeCache?.fingerprint===fingerprint)return activeCache;
    let entries=[],failedCodes=[];
    try{
      const saved=JSON.parse(root.sessionStorage?.getItem(CACHE_KEY)||'null');
      if(saved?.revision===CACHE_REV&&saved.fingerprint===fingerprint){
        if(Array.isArray(saved.entries))entries=saved.entries;
        if(Array.isArray(saved.failedCodes))failedCodes=saved.failedCodes;
      }
    }catch(_){/* Safari private mode / disabled storage: in-memory cache still works. */}
    const map=new Map(entries.filter(entry=>Array.isArray(entry)&&entry.length===2&&/^\d{4}$/.test(entry[0])&&
      entry[1]?.code===entry[0]&&entry[1]?.verifiedDate===marketDate&&
      (entry[1]?.status==='REJECT'||(entry[1]?.status==='DATA'&&entry[1]?.cacheableData===true)||(['S','A','B'].includes(entry[1]?.status)&&entry[1]?.eligible===true&&
        entry[1]?.date===marketDate&&Number.isFinite(Number(entry[1]?.score))&&Number(entry[1]?.close)>0))));
    activeCache={fingerprint,map,failed:new Set(failedCodes.filter(code=>/^\d{4}$/.test(code)))};
    return activeCache;
  }
  function persistCache(cache){
    try{root.sessionStorage?.setItem(CACHE_KEY,JSON.stringify({revision:CACHE_REV,fingerprint:cache.fingerprint,entries:[...cache.map],failedCodes:[...cache.failed]}));}
    catch(_){/* Non-fatal: verified results remain available until this tab is closed. */}
  }
  const cacheableDataReason=reason=>/日K少於\d+根|日K日期、順序或OHLCV資料不完整|同日成交量缺失|成交量差異過大|回傳股票代號不符/.test(String(reason||''));
  function remember(cache,item,result,marketDate){
    const cacheableData=result.status==='DATA'&&cacheableDataReason(result.reason);
    if(result.eligible!==true&&result.status!=='REJECT'&&!cacheableData)return false;
    // R4.9：候選/確定淘汰照舊快取；同一快照下確定性的 DATA 也暫存，避免每次重打 Worker。
    const compact={...result}; // 快取也保留校正後report，圖片不可退回不同行情。
    cache.map.set(item.code,{...compact,cacheableData,code:item.code,name:item.name,verifiedDate:marketDate});
    return true;
  }
  const marketHintOf=item=>String(item?.q?.market||'').toUpperCase()==='TPEX'?'TPEX':'TWSE';
  async function fetchDailyBatchRawR49(items){
    const codes=items.map(x=>x.code).join(','),markets=items.map(marketHintOf).join(',');
    const url=`${MARKET_ENDPOINT_R49}/?market=DEEP_SCAN&profile=DAILY_ONLY&codes=${encodeURIComponent(codes)}&markets=${encodeURIComponent(markets)}`;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),DAILY_BATCH_TIMEOUT_MS);
    try{
      const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
      const text=await res.text();
      if(!res.ok)throw new Error(`DAILY_ONLY Worker HTTP ${res.status}｜${text.slice(0,180)}`);
      let data;try{data=JSON.parse(text);}catch{throw new Error('DAILY_ONLY Worker 回傳非 JSON');}
      if(data?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(data.results))throw new Error(data?.error||'DAILY_ONLY Worker 格式錯誤');
      return data;
    }finally{clearTimeout(timer);}
  }
  async function fetchDailyBatchWithRetryR49(items,marketDate){
    const outcomes=new Map();let pending=[...items],requests=0;
    for(let attempt=1;attempt<=2&&pending.length&&!stopped;attempt++){
      let payload=null,batchError=null;requests++;
      try{payload=await fetchDailyBatchRawR49(pending);}catch(error){batchError=error;}
      const retry=[];
      for(const item of pending){
        let outcome;
        if(batchError)outcome={status:'FAILED',eligible:false,reason:String(batchError?.message||batchError)};
        else{
          const result=(payload.results||[]).find(x=>String(x.code||x.data?.stock||x.data?.code||'')===item.code);
          outcome=evaluateResponse(item,result,marketDate);
        }
        if(outcome.status==='FAILED'&&attempt<2&&isRetryable(outcome.reason)){retry.push(item);}
        else outcomes.set(item.code,{...outcome,attempts:attempt});
      }
      pending=retry;
      if(pending.length&&!stopped)await sleep(pending.some(x=>isCpuError(outcomes.get(x.code)?.reason))?CPU_RETRY_GAP:RETRY_GAP);
    }
    for(const item of pending)if(!outcomes.has(item.code))outcomes.set(item.code,{status:'FAILED',eligible:false,reason:'DAILY_ONLY 批次重試後仍未取得資料',attempts:2});
    return {outcomes,requests};
  }
  function breakerReason(recent,consecutiveCpu){
    if(consecutiveCpu>=CPU_BREAKER_CONSECUTIVE)return `連續 ${consecutiveCpu} 檔出現 Worker CPU 超限`;
    if(recent.length>=FAILURE_WINDOW_SIZE && recent.filter(x=>x==='CPU').length>=8)
      return `最近 ${FAILURE_WINDOW_SIZE} 檔有至少 8 檔 CPU 超限`;
    return null;
  }
  function marketPool(bundle,limit){
    const audit={financial:0,biotech:0,construction:0,fullDelivery:0,dr:0,special:0,statusUnknown:0,unknown:0,invalidQuote:0,missingLiquidity:0,illiquid:0};const ready=[];
    for(const [code,q] of bundle.map){
      const decision=root.ShitouScanPolicy5328.classify(code,q,bundle.sectorMap?.get(code),bundle.meta);
      if(decision.excluded){const key={FINANCIAL:"financial",BIOTECH:"biotech",CONSTRUCTION:"construction",FULL_DELIVERY:"fullDelivery",DR:"dr",SPECIAL:"special",STATUS_UNKNOWN:"statusUnknown",UNKNOWN:"unknown",ILLIQUID:"illiquid"}[decision.key];audit[key||"unknown"]++;continue;}
      const industry=F.officialIndustry(bundle.sectorMap?.get(code));
      if(industry.key==='FINANCIAL'){audit.financial++;continue;}
      if(industry.key==='BIOTECH'){audit.biotech++;continue;}
      if(industry.key!=='OK'){audit.unknown++;continue;}
      if(!/^[1-9]\d{3}$/.test(code)||[q.open,q.high,q.low,q.close,q.volume].some(v=>!(v>0))){audit.invalidQuote++;continue;}
      if(F.number(q.tradeValue)===null){audit.missingLiquidity++;continue;}
      if(!(q.tradeValue>=F.RULE.minTradeValue)){audit.illiquid++;continue;}
      // 這裡只決定深入分析順序；真正的飆股資格由三盤、量潮與8/21/55日線共同判斷。
      const stableRise=Math.min(5,Math.max(-5,Number(q.pct)||0));
      const priority=Math.log10(Math.max(1,q.tradeValue))*5 + (q.closePos||0)*5 + stableRise;
      ready.push({code,name:LOCAL_NAME_MAP?.[code]||code,q,priority});
    }
    ready.sort((a,b)=>b.priority-a.priority||(b.q.tradeValue||0)-(a.q.tradeValue||0)||a.code.localeCompare(b.code));
    return {deep:ready.slice(0,limit==='all'?ready.length:Number(limit)||140),deferred:ready.slice(limit==='all'?ready.length:Number(limit)||140),quick:ready.length,audit};
  }
  function evaluateResponse(item,x,marketDate){
    if(!x?.ok || !x.data)return {status:'FAILED',reason:String(x?.error||'深度分析未回傳完整個股資料')};
    const report=x.data,returned=String(report.stock||report.code||x.code||'');
    if(returned!==item.code)return {status:'DATA',reason:'回傳股票代號不符或缺失'};
    const result=F.evaluate(report,marketDate,item.q);
    if(result.eligible){result.code=item.code;result.name=LOCAL_NAME_MAP?.[item.code]||report.name||item.code;}
    return result;
  }
  const progress=(done,total,selected,verified,cacheHits,startedAt)=>{
    const elapsed=Math.max(1,Date.now()-startedAt),rate=done/elapsed,remainMs=rate>0?(total-done)/rate:null;
    const eta=done>=BATCH&&remainMs!==null?`｜預估剩餘 ${remainMs<60000?Math.max(1,Math.ceil(remainMs/1000))+' 秒':Math.ceil(remainMs/60000)+' 分鐘'}`:'';
    const t=id('ProgressText');if(t)t.textContent=`已處理 ${done}/${total}｜有效判讀 ${verified}｜候選 ${selected}｜重用 ${cacheHits}${eta}`;
    const b=id('ProgressBar');if(b)b.style.width=`${total?Math.floor(done/total*100):0}%`;
  };
  function render(scan){
    const target=id('Result'),meta=id('Meta'),summary=id('Summary'),list=id('List');if(target)target.style.display='block';
    if(meta)meta.textContent=`${statusTitle(scan)}｜市場日期 ${scan.dataDate}｜產生 ${scan.createdAt}｜來源：完整市場快照＋DAILY_ONLY 輕量完成日K｜掃描範圍 ${scan.total} 檔`;
    if(summary){
      const a=scan.audit;
      summary.textContent=`${statusTitle(scan)}｜完整市場 ${scan.universe}｜快篩合格 ${scan.quick}｜深入規劃 ${scan.total}｜請求已處理 ${scan.done}｜有效判讀 ${scan.verified}｜同快照重用 ${scan.cacheHits}｜重試 ${scan.retries}｜範圍外未分析 ${scan.deferred}｜停止或資源限制後未分析 ${scan.pending}｜金融排除 ${a.financial}｜生技排除 ${a.biotech}｜營建排除 ${a.construction||0}｜全額交割 ${a.fullDelivery||0}｜DR ${a.dr||0}｜特殊商品 ${a.special||0}｜全額狀態未核 ${a.statusUnknown||0}｜產業未知 ${a.unknown}｜無法解析行情 ${scan.unparsed}｜無效報價 ${a.invalidQuote}｜成交金額缺失 ${a.missingLiquidity}｜流動性不足 ${a.illiquid}｜資料不足 ${scan.data}｜服務失敗 ${scan.failed}（CPU ${scan.cpuFailed}）｜確定不符 ${scan.rejected}｜已驗證候選 ${scan.candidates.length}（S ${scan.counts.S}／A ${scan.counts.A}／B ${scan.counts.B}）｜${scan.breaker?`資源熔斷：${scan.breaker}；其餘未分析。`:scan.fullMarketCertified?'全部範圍與資料驗證通過。':'不能宣稱全市場完整排名或全市場零候選。'}`;
    }
    if(list){
      if(!scan.candidates.length){list.textContent=scan.fullMarketCertified?'全市場通過驗證且未找到符合新版三盤＋量價＋均線條件的股票；不代表隔日不會上漲。':'目前沒有已驗證候選；尚有未分析或資料異常股票，不能視為全市場零候選。';}
      else list.innerHTML=scan.candidates.map((c,i)=>{const t=triggerMeta(c),course=c.courseV52;return `<div class="rule strong-stock-row"><div><strong>${scan.fullMarketCertified?'#':'暫列 #'}${i+1}　${html(c.name)}（${html(c.code)}）｜${html(c.status)} ${html(c.label)}</strong><br>收盤 <b>${fmt(c.close)}</b>｜教材條件覆蓋 <b>${fmt(c.courseSuitabilityScore,0)}/100</b>（非勝率）｜量價條件分 ${fmt(c.score,0)}｜${html(c.date)}｜<b>${html(root.ShitouScanPolicy5328.rsiText(c,true))}</b><br>${html(root.ShitouScanPolicy5328.volumeText(c))}<br><b>${t.icon} ${html(t.label)} ${fmt(c.trigger)}</b>｜<b>🛡️ 防守參考 ${fmt(c.support)}</b>｜今日量／前5日均量 ${fmt(c.wave?.threePanVolumeRatio)} 倍｜距強弱分界線 ${fmt(c.ma21GapPct??c.ma20GapPct)}%</div><div class="meta"><strong>${html(course?.threePan?.icon||'⚪')} 三盤白話：</strong>${html(course?.threePan?.plain||'資料不足')}<br>${html(c.phaseLabel||'量價階段待確認')}｜${html(c.reason)}<br><strong>價格三線：</strong>${html(c.maText||'資料不足')}<br><strong>量能三線：</strong>${html(c.mvText||'資料不足')}<br><strong>${html(fibLine(c))}</strong><br><strong>資料校正：</strong>${html(confidenceText(c))}<br>${scan.fullMarketCertified?'':'僅為已驗證樣本內排序，非全市場排名。'}教材條件覆蓋是條件完整度，不是上漲機率；仍須核對量價與防守。</div></div>`;}).join('');
    }
    const top=id('TopImage'),all=id('AllImage');if(top)top.disabled=!scan.candidates.length;if(all)all.disabled=!scan.candidates.length;
  }
  function buildText(scan){
    const lines=[`${RELEASE_R493}｜第三套「強勢飆股濾網」${statusTitle(scan)}`,`市場交易日：${scan.dataDate}｜產生：${scan.createdAt}`,
      '先記分，再按查詢；請確認市場及個股日期一致。僅供下一交易日觀察，不是進場或獲利保證。',
      `全市場${scan.universe}｜快篩${scan.quick}｜規劃深入${scan.total}｜已處理${scan.done}｜有效判讀${scan.verified}｜同快照重用${scan.cacheHits}｜重試${scan.retries}｜範圍外${scan.deferred}｜停止或熔斷後${scan.pending}`,
      `金融排除${scan.audit.financial}｜生技排除${scan.audit.biotech}｜營建${scan.audit.construction||0}｜全額交割${scan.audit.fullDelivery||0}｜DR${scan.audit.dr||0}｜特殊商品${scan.audit.special||0}｜狀態未核${scan.audit.statusUnknown||0}｜產業不明${scan.audit.unknown}｜未解析行情${scan.unparsed}｜報價無效${scan.audit.invalidQuote}｜成交金額缺失${scan.audit.missingLiquidity}｜流動性不足${scan.audit.illiquid}`,
      `資料不足${scan.data}｜服務失敗${scan.failed}（CPU ${scan.cpuFailed}）｜確定不符${scan.rejected}｜已驗證候選${scan.candidates.length}｜S${scan.counts.S}／A${scan.counts.A}／B${scan.counts.B}`,
      scan.fullMarketCertified?'本次完整市場與所有候選驗證完成。':'⚠️ 部分驗證：本次名單與排序僅代表成功驗證的股票，不是全市場完整排名；失敗、資料不足、未分析者均未判斷。',
      ...(scan.breaker?[`⚠️ 資源熔斷：${scan.breaker}；剩餘 ${scan.pending} 檔尚未分析，請先處理 Worker CPU 問題。`]:[]),
      '新版主軸：先以三盤判斷波段是否失效，再檢查8／21／55價格環境、5／13／34量潮與既有波段；量縮創高與量縮止漲分開。觀察不靠高分變成可買，較長背景不解除當前跌破。條件覆蓋不是勝率；產業背景不冒充個股強弱',
      '僅使用完成日K；全額交割、DR、特殊商品、金融、生技、營建及低流動性排除；資料不同日、缺漏或超限時如實標記；排序分不代表勝率。', `━━━━━━━━━━ ${scan.fullMarketCertified?'全部已入選股票':'本次已驗證候選（非全市場名次）'} ━━━━━━━━━━`];
    scan.candidates.forEach((c,i)=>{const t=triggerMeta(c);lines.push(`${i+1}. ${c.name}（${c.code}）｜${c.status} ${c.label}｜教材條件覆蓋 ${fmt(c.courseSuitabilityScore,0)}/100（非勝率）｜量價條件分 ${c.score}｜收盤 ${fmt(c.close)}｜日期 ${c.date}｜${root.ShitouScanPolicy5328.rsiText(c,true)}
   ${root.ShitouScanPolicy5328.volumeText(c)}
   ${c.courseV52?.threePan?.icon||'⚪'}三盤白話：${c.courseV52?.threePan?.plain||'資料不足'}
   ${t.icon}${t.label} ${fmt(c.trigger)}｜🛡️防守參考 ${fmt(c.support)}｜前兩根高點 ${fmt(c.referenceHigh)}｜今日量／前5日均量 ${fmt(c.wave?.threePanVolumeRatio)}倍｜距強弱分界線 ${fmt(c.ma21GapPct??c.ma20GapPct)}%
   目前位置 ${c.phaseLabel||'待確認'}｜${c.reason}
   均線：${c.maText||'資料不足'}
   量能：${c.mvText||'資料不足'}
   資料校正：${confidenceText(c)}${c.evidence?.length?`
   依據：${c.evidence.join('、')}`:''}${c.risk?.length?`
   ⚠️風險：${c.risk.join('、')}`:''}`);});
    if(!scan.candidates.length)lines.push(scan.fullMarketCertified?'全市場已驗證且未入選。':'無已驗證候選：尚有未分析／資料不足／服務失敗，禁止推論全市場不合格。');
    lines.push('━━━━━━━━━━ 失敗與資料不足（不計為淘汰） ━━━━━━━━━━');
    scan.issues.forEach(x=>lines.push(`${x.code} ${x.name}｜${x.status}｜${x.reason}`));
    if(scan.deferred)lines.push(`未深入分析：${scan.deferred} 檔，不能標記為不合格。`);
    if(scan.pending)lines.push(`掃描停止或資源熔斷後未分析：${scan.pending} 檔。`);
    lines.push(`END-OF-STRONG-STOCK-REPORT-R5327｜候選 ${scan.candidates.length}/${scan.candidates.length}`);
    return lines.join('\n');
  }
  async function run(){
    if(running||dayTradeScanRunningV1||momentumScanRunningV3762){displayError('已有選股任務執行中，請勿同時掃描。');return;}
    running=true;stopped=false;last=null;
    const button=id('ScanButton'),stop=id('StopButton'),result=id('Result'),err=id('Error'),limit=id('DeepLimit');
    // Disable original scan entry buttons only while this independent scan is running.
    const originalButtons=['momentumScanButton','dayTradeScanButton'].map(key=>document.getElementById(key)).filter(Boolean);
    const originalButtonState=originalButtons.map(element=>element.disabled);
    originalButtons.forEach(element=>element.disabled=true);
    if(button){button.disabled=true;button.textContent='取得正式盤後資料…';}if(stop)stop.disabled=false;if(limit)limit.disabled=true;
    if(result)result.style.display='none';if(err)err.style.display='none';note('');
    try{
      const bundle=await loadDayTradeMarketBundleV377736();
      const meta=bundle.meta||{},market=F.validateMarket(meta,bundle.snapshotRows,new Date());
      if(!market.ok)throw new Error(`${market.reason}${marketDateDiagnostic(meta)}｜本次未進行選股；請等待官方資料更新並確認 Market Worker 已同步後重試。`);
      const pool=marketPool(bundle,limit?.value||'140'),total=pool.deep.length;
      if(!total)throw new Error('無有效深度分析範圍；請檢查市場及產業資料');
      const cache=recoverCache(snapshotFingerprint(bundle,market.date),market.date);
      // Failed stocks from a previous attempt move to the end, rather than permanently
      // blocking new stocks behind the same four CPU failures. No stock is discarded.
      const queue=[...pool.deep.filter(x=>!cache.failed.has(x.code)),...pool.deep.filter(x=>cache.failed.has(x.code))];
      const candidates=[],issues=[];
      let done=0,data=0,failed=0,rejected=0,cacheHits=0,retries=0,cpuFailed=0,consecutiveCpu=0,breaker=null;
      const recent=[],startedAt=Date.now();
      for(let from=0;from<total&&!stopped;from+=BATCH){
        const batch=queue.slice(from,from+BATCH);
        if(button)button.textContent=`輕量日K批次 ${done}/${total}…`;
        const remote=batch.filter(item=>!cache.map.has(item.code));
        let fetched={outcomes:new Map(),requests:0};
        if(remote.length){
          fetched=await fetchDailyBatchWithRetryR49(remote,market.date);
          retries+=Math.max(0,fetched.requests-1);
        }
        for(const item of batch){
          let c=cache.map.get(item.code);
          if(c){cacheHits++;}
          else{
            c=fetched.outcomes.get(item.code)||{status:'FAILED',eligible:false,reason:'批次未回傳此股票資料'};
            if(remember(cache,item,c,market.date)&&cache.map.size%16===0)persistCache(cache);
          }
          done++;
          if(c.eligible)candidates.push(c);
          else if(c.status==='DATA'){data++;issues.push({code:item.code,name:item.name,...c});}
          else if(c.status==='FAILED'){failed++;issues.push({code:item.code,name:item.name,...c});}
          else if(c.status==='REJECT')rejected++;
          else{data++;issues.push({code:item.code,name:item.name,status:'DATA',reason:'未識別的策略狀態，未計入淘汰'});}
          if(c.status==='FAILED')cache.failed.add(item.code);else cache.failed.delete(item.code);
          const cpu=c.status==='FAILED'&&isCpuError(c.reason);
          if(cpu){cpuFailed++;consecutiveCpu++;}else consecutiveCpu=0;
          recent.push(cpu?'CPU':c.status==='FAILED'?'FAILED':'OK');if(recent.length>FAILURE_WINDOW_SIZE)recent.shift();
          progress(done,total,candidates.length,candidates.length+rejected,cacheHits,startedAt);
        }
        breaker=breakerReason(recent,consecutiveCpu);
        if(breaker){stopped=true;break;}
        if(!stopped&&done<total&&remote.length)await sleep(REQUEST_GAP);
      }
      persistCache(cache);
      candidates.sort(F.compare);
      const counts={S:0,A:0,B:0};candidates.forEach(x=>counts[x.status]++);
      const verified=candidates.length+rejected;
      const snapshotDropped=Math.max(0,bundle.snapshotRows-bundle.map.size,bundle.snapshotDropped||0);
      const completed=!stopped&&done===total&&data===0&&failed===0;
      const fullMarketCertified=completed&&pool.deferred.length===0&&snapshotDropped===0&&
        pool.audit.unknown===0&&pool.audit.invalidQuote===0&&pool.audit.missingLiquidity===0;
      if(done!==verified+data+failed)throw new Error('本次逐檔數量帳不平衡，停止產生報告');
      last=Object.freeze({model:F.MODEL,profile:'DAILY_ONLY',dataDate:market.date,createdAt:taipeiStampV3762(),universe:bundle.snapshotRows,unparsed:snapshotDropped,
        quick:pool.quick,total,done,deferred:pool.deferred.length,pending:total-done,audit:pool.audit,
        verified,cacheHits,retries,cpuFailed,breaker,data,failed,rejected,candidates,issues,counts,completed,fullMarketCertified,
        scopeFinished:done===total});
      render(last);
      if(breaker){const pt=id('ProgressText');if(pt)pt.textContent=`⏸ 已暫停於 ${done}/${total}｜${breaker}｜剩餘 ${last.pending} 檔尚未分析；已完成結果已保存，再按查詢會重用。`;}
      if(!last.fullMarketCertified)displayError(`⚠️ 部分驗證／非全市場完整排名：已處理 ${done}/${total}，有效判讀 ${verified}，範圍外 ${last.deferred}，未處理 ${last.pending}，CPU 超限 ${cpuFailed}，其他服務失敗 ${failed-cpuFailed}，資料不足 ${data}。${breaker?`已安全暫停：${breaker}。`:''}同一快照再次查詢會重用已完成與可確定的資料不足結果，只重試暫時失敗項目。`,'warn');
      else if(err){err.style.display='none';}
      note(`${last.fullMarketCertified?'完整市場驗證':'⚠️ 部分驗證，非全市場排名'}｜快照 ${last.dataDate}｜重用 ${cacheHits} 檔｜文字、圖片共用本次結果。`);
      return last;
    }catch(error){
      last=null;
      const progressText=id('ProgressText'),progressBar=id('ProgressBar');
      if(progressText)progressText.textContent='本次查詢已中止；沒有產生新的選股結果。';
      if(progressBar)progressBar.style.width='0%';
      displayError(`❌ 強勢標股掃描未產生有效結果：${error?.message||error}`);
      throw error;
    }
    finally{running=false;originalButtons.forEach((element,i)=>element.disabled=originalButtonState[i]);if(button){button.disabled=false;button.textContent='🔎 查詢強勢飆股濾網';}if(stop)stop.disabled=true;if(limit)limit.disabled=false;}
  }
  function stop(){stopped=true;const button=id('ScanButton');if(button)button.textContent='停止請求中，保留已完成結果…';const pt=id('ProgressText');if(pt)pt.textContent='⏸ 使用者要求停止；目前批次結束後會保留已完成結果。';}
  function ensure(){if(!last)throw new Error('請先完成強勢飆股濾網查詢');return last;}
  async function copyText(){try{const text=buildText(ensure());await navigator.clipboard.writeText(text);note(`✅ 已複製 ${last.candidates.length} 檔${last.fullMarketCertified?'完整市場':'部分驗證'}文字報告。`);}catch(e){note(`❌ 文字複製失敗：${e.message}`);}}
  function save(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);}
  function downloadText(){try{const s=ensure();save(new Blob(['\uFEFF',buildText(s)],{type:'text/plain;charset=utf-8'}),`強勢飆股濾網_${s.fullMarketCertified?'完整市場':'部分驗證'}_本次候選_${s.dataDate}.txt`);note(`✅ ${s.fullMarketCertified?'完整市場':'部分驗證'}文字報告已開始下載。`);}catch(e){note(`❌ ${e.message}`);}}
  const draw=(ctx,text,x,y,w,size=22,color='#1b344d',align='left')=>fitScanTextV3762(ctx,String(text??''),x,y,w,size,Math.max(11,size-9),850,color,align);
  function renderPage(scan,subset,pageIndex,totalPages,offset=0){
    const canvas=document.createElement('canvas');canvas.width=1284;canvas.height=2778;canvas.dataset.reportMode='strong-stock';
    const ctx=canvas.getContext('2d');ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,1284,2778);
    ctx.fillStyle='#123a5a';ctx.fillRect(0,0,1284,210);
    draw(ctx,`🔎 強勢飆股濾網｜${statusTitle(scan)}`,30,58,1190,38,'#fff');
    draw(ctx,`${scan.dataDate}｜${RELEASE_R493}｜第 ${pageIndex}/${totalPages} 頁`,30,101,1190,18,'#e5f4ff');
    draw(ctx,`已處理 ${scan.done}/${scan.total}｜有效判讀 ${scan.verified}｜未分析 ${scan.pending+scan.deferred}｜缺資料 ${scan.data}｜服務失敗 ${scan.failed}｜已驗證候選 ${scan.candidates.length}`,30,137,1190,19,'#fff4bb');
    draw(ctx,'提醒：先記分再查詢；S 強中強／A 條件完整／B 可觀察，都只是隔日優先順序，不是買進保證。',30,176,1190,19,'#fff');
    subset.forEach((c,index)=>{
      const x=24,y=218+index*294,w=1236,h=286,col={S:'#1f7a4f',A:'#24628a',B:'#a66e1e'}[c.status]||'#52647b';
      ctx.fillStyle='#fff';ctx.fillRect(x,y,w,h);ctx.fillStyle=col;ctx.fillRect(x,y,8,h);
      draw(ctx,`${scan.fullMarketCertified?'#':'暫列 #'}${offset+index+1} ${c.name}（${c.code}）`,x+24,y+39,715,34,'#18334d');
      draw(ctx,`收盤 ${fmt(c.close)} 元`,x+w-24,y+39,435,30,'#b52a34','right');
      draw(ctx,`${c.status}｜${c.label}｜教材條件覆蓋 ${fmt(c.courseSuitabilityScore,0)}/100（非勝率）｜量價條件分 ${c.score}`,x+25,y+75,1165,20,col);
      const cells=[['條件覆蓋',`${fmt(c.courseSuitabilityScore,0)}/100`],['今日量／前5日量',`${fmt(c.wave?.threePanVolumeRatio)} 倍`],['距21日線',`${fmt(c.ma21GapPct??c.ma20GapPct)}%`],['量潮方向',`${c.wave?.teacher?.tideRising?'三線上':'較大潮支持'}`],['今日／昨日（張）',`${root.ShitouScanPolicy5328.volume(c).todayLots?.toFixed(2)??'不足'}／${root.ShitouScanPolicy5328.volume(c).yesterdayLots?.toFixed(2)??'不足'}`]];
      cells.forEach((cell,k)=>{const cx=x+22+k*238;ctx.fillStyle='#f3f7fa';ctx.fillRect(cx,y+87,224,63);draw(ctx,cell[0],cx+12,y+109,200,17,'#5c6d80');draw(ctx,cell[1],cx+12,y+140,200,25,col);});
      const tm=triggerMeta(c);draw(ctx,`${tm.icon} ${tm.label} ${fmt(c.trigger)}｜🛡️ 防守參考 ${fmt(c.support)}｜前兩根高點 ${fmt(c.referenceHigh)}`, x+25,y+178,1160,19);
      draw(ctx,`${fibLine(c)}`,x+25,y+207,1160,17,'#72530b');
      draw(ctx,`${root.ShitouScanPolicy5328.rsiText(c,true)}｜${root.ShitouScanPolicy5328.volume(c).label}｜📅 ${c.date}｜${c.phaseLabel||'量價階段待確認'}｜${c.courseV52?.threePan?.icon||'⚪'}${c.courseV52?.threePan?.label||'三盤資料不足'}`,x+25,y+233,1160,18);
      draw(ctx,`🧭 ${c.reason}`,x+25,y+258,1160,18,col);
      draw(ctx,'⚠️ 比例只量回吐幅度；隔日仍須驗證量價與防守，不可只憑排名或61.8%直接進場。',x+25,y+278,1160,15,'#765d1e');
    });
    if(!subset.length)draw(ctx,'本次沒有已確認候選。',40,400,1190,31,'#52647b');
    ctx.fillStyle='#123a5a';ctx.fillRect(0,2578,1284,200);
    draw(ctx,'教材條件覆蓋＝條件完整度，不是勝率｜三盤波段先判資格，再看量潮接力',28,2622,1230,20,'#fff');
    draw(ctx,`全數核對：本頁 ${subset.length} 檔｜本次候選 ${scan.candidates.length} 檔｜${scan.fullMarketCertified?'全市場排名':'僅已驗證股票內排序'}`,28,2660,1230,20,'#e9f5ff');
    draw(ctx,'資料不足和未深入分析不得當成淘汰；技術分析僅供研究參考。',28,2700,1230,18,'#fff3c2');
    canvas.dataset.strongStockAudit=encodeURIComponent(JSON.stringify({date:scan.dataDate,codes:subset.map(x=>x.code),page:pageIndex,pages:totalPages,offset,sourceCandidates:scan.candidates.length,size:'1284x2778',fullMarketCertified:scan.fullMarketCertified===true}));
    return canvas;
  }
  function images(scan,all=false){const list=all?scan.candidates:scan.candidates.slice(0,8),pages=[];for(let i=0;i<list.length;i+=8)pages.push(renderPage(scan,list.slice(i,i+8),pages.length+1,Math.ceil(list.length/8),i));return pages;}
  async function showImage(all=false,watermark=false){try{
    const scan=ensure();if(!scan.candidates.length)throw new Error('沒有候選可以產圖');
    if(document.fonts?.ready)await document.fonts.ready;
    const pages=images(scan,all);if(watermark)pages.forEach(p=>applyAntiTheftWatermarkV3761(p,'all'));
    const title=`強勢飆股濾網｜${scan.fullMarketCertified?'完整市場':'部分驗證非全市場排名'}｜${all?'全部候選圖片':'前8檔圖片'}`;
    await root.strongStockShowPagesV47(pages,{title,prefix:`強勢飆股濾網_${scan.fullMarketCertified?'完整市場':'部分驗證'}_${all?'全部候選':'前8檔'}${watermark?'_浮水印':''}`,date:scan.dataDate.replace(/\D/g,''),note:`同一份盤後快照｜${pages.length}頁｜本次已驗證候選 ${all?scan.candidates.length:Math.min(8,scan.candidates.length)} 檔｜${scan.fullMarketCertified?'完整市場驗證':'未分析／失敗檔尚未判讀，並非全市場完整排名'}`,kind:'strong-stock'});
    note(`✅ 已產生 ${pages.length} 頁，含 ${all?scan.candidates.length:Math.min(8,scan.candidates.length)} 檔。${scan.fullMarketCertified?'':'⚠️ 部分驗證，非全市場排名。'}${pages.length>1?'預覽視窗可下載全部 ZIP。':'可預覽或儲存 PNG。'}`);
    return pages;
  }catch(e){note(`❌ 圖片產生失敗：${e.message}`);throw e;}}
  async function copyImage(all=false){try{
    const scan=ensure(),pages=await showImage(all,false);
    if(pages.length!==1){note(`⚠️ 全部候選共 ${pages.length} 頁；剪貼簿無法保證保留全部頁面。請在預覽視窗下載完整 ZIP。`);return;}
    const blob=await new Promise((resolve,reject)=>pages[0].toBlob(x=>x?resolve(x):reject(new Error('PNG轉換失敗')),'image/png'));
    if(!navigator.clipboard?.write || typeof ClipboardItem==='undefined'){note('⚠️ 裝置不支援圖片直接複製，已開啟 PNG 預覽。');return;}
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);note(`✅ 已複製${all?'全部候選':'前8檔'} PNG。`);
  }catch(e){note(`❌ 複製失敗：${e.message}`);}}
  root.runStrongStockScanV47=()=>run().catch(()=>{});
  root.stopStrongStockScanV47=stop;
  root.copyStrongStockTextV47=copyText;
  root.downloadStrongStockTextV47=downloadText;
  root.showStrongStockImageV47=(all=false,watermark=false)=>showImage(all,watermark).catch(()=>{});
  root.copyStrongStockImageV47=copyImage;
  root.STRONG_STOCK_TEST_API_V47=Object.freeze({marketPool,evaluateResponse,buildText,renderPage,images,getLast:()=>last,render,batchSize:BATCH,profile:'DAILY_ONLY',cacheableDataReason});
})(window);
