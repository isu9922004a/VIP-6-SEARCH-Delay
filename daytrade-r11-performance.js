'use strict';
/* R1.1 scheduling with REVIEW.2 canonical DAILY_ONLY alignment before FULL decisions.
 * Request concurrency and a single run deadline keep 140/140 from appearing frozen forever.
 */
(function(root){
  const POLICY=Object.freeze({
    version:'R1.1', concurrency:2, fullProxyAttempts:2,
    proxyTimeoutMs:18000, directTimeoutMs:14000, totalBudgetMs:75000,
    secondRoundBudgetMs:120000, secondRoundProxyMs:18000, secondRoundDirectMs:14000,
    retryGapMs:400
  });
  const numCode=c=>String(c?.report?.stock||c?.report?.code||'');
  const cancelled=()=>dayTradeScanAbortV1===true;
  const remaining=deadline=>Math.max(0,deadline-Date.now());
  const errorText=e=>String(e?.message||e||'完整個股資料未回傳');
  const label=(stage,done,total,success,failed,extra='')=>{
    const s=`${stage} ${done}/${total}｜成功 ${success}｜詳細資料暫缺 ${failed}${extra?'｜'+extra:''}`;
    const text=document.getElementById('dayTradeProgressText');
    const bar=document.getElementById('dayTradeProgressBar');
    const btn=document.getElementById('dayTradeScanButton');
    if(text)text.textContent=s;
    if(bar)bar.style.width=(total?Math.min(100,done/total*100):100).toFixed(1)+'%';
    if(btn){btn.disabled=true;btn.textContent=`⚡ ${s}`;}
  };
  root.dayTradeR11Progress=label;
  root.dayTradeR11BeginSecondRound=()=>Date.now()+POLICY.secondRoundBudgetMs;
  root.dayTradeR11SecondRoundHasTime=deadline=>remaining(deadline)>=500;
  root.dayTradeR11FetchSecondRoundCore=async(item,deadline)=>{
    const code=String(item?.code||'');
    if(!/^[1-9]\d{3}$/.test(code))throw new Error('第二輪股票代碼無效');
    const wait=Math.min(POLICY.secondRoundProxyMs,remaining(deadline));
    if(wait<500)throw new Error('第二輪時間預算已到');
    const url=`${MARKET_API_BASE_URL}/?market=DEEP_SCAN&codes=${encodeURIComponent(code)}&profile=CORE`;
    const data=await timedJson(url,wait);
    if(data?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(data?.results))throw new Error(data?.error||'CORE 回傳格式錯誤');
    return data;
  };
  root.dayTradeR11FetchSecondRoundDirect=async(item,deadline)=>{
    const code=String(item?.code||'');
    if(!/^[1-9]\d{3}$/.test(code))throw new Error('第二輪股票代碼無效');
    const wait=Math.min(POLICY.secondRoundDirectMs,remaining(deadline));
    if(wait<500)throw new Error('第二輪時間預算已到');
    const data=await timedJson(`${API_BASE_URL}/?stock=${encodeURIComponent(code)}`,wait);
    if(!data||typeof data!=='object'||String(data.stock||data.code)!==code)throw new Error('單檔補救資料不符');
    return {code,ok:true,data,recovered:true,source:'DIRECT_STOCK_FALLBACK'};
  };
  async function timedJson(url,timeoutMs){
    if(cancelled())throw new Error('使用者停止掃描');
    const ctl=registerScanControllerV39B12OPT(new AbortController());
    const timer=setTimeout(()=>ctl.abort(),Math.max(1,Math.floor(timeoutMs)));
    try{
      const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:ctl.signal});
      // JSON parsing is inside the same abort boundary as fetching the body.
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      let data;try{data=await res.json();}catch(e){
        if(ctl.signal.aborted)throw e;
        throw new Error('FULL 回傳資料不是有效 JSON');
      }
      const common=root.ShitouSelectionDataV2;if(!common)throw Error('共用日K模組未載入');
      if(data?.type==='MOMENTUM_DEEP_SCAN'){const request=common.fromUrl(url);return await common.harmonize(request.items,data,request.profile);}
      if(data?.stock||data?.code){const code=String(data.stock||data.code),p=await common.harmonize([{code}],{type:'MOMENTUM_DEEP_SCAN',results:[{code,ok:true,data}]},'FULL'),x=p.results.find(x=>x.code===code);if(!x?.ok)throw Error(x?.error||'單檔共用行情驗證失敗');return x.data;}
      return data;
    }catch(e){
      if(ctl.signal.aborted&&!cancelled())throw new Error('完整資料請求逾時');
      throw e;
    }finally{
      clearTimeout(timer);
      releaseScanControllerV39B12OPT(ctl);
    }
  }
  async function fetchProxy(code,deadline){
    const wait=Math.min(POLICY.proxyTimeoutMs,remaining(deadline));
    if(wait<500)throw new Error('完整資料補抓時間預算已到');
    const url=`${MARKET_API_BASE_URL}/?market=DEEP_SCAN&codes=${encodeURIComponent(code)}`;
    const data=await timedJson(url,wait);
    if(data?.type!=='MOMENTUM_DEEP_SCAN'||!Array.isArray(data?.results))throw new Error(data?.error||'FULL 格式不符');
    const x=data.results.find(row=>String(row.code)===code);
    if(!x?.ok)throw new Error(x?.error||'FULL 未回傳該股票');
    if(!isCompleteFullAnalysisV40(x.data,code))throw new Error('FULL 完整欄位驗收未通過');
    return x.data;
  }
  async function fetchDirect(code,deadline){
    const wait=Math.min(POLICY.directTimeoutMs,remaining(deadline));
    if(wait<500)throw new Error('完整資料補抓時間預算已到');
    const data=await timedJson(`${API_BASE_URL}/?stock=${encodeURIComponent(code)}`,wait);
    if(!isCompleteFullAnalysisV40(data,code))throw new Error('單檔完整欄位驗收未通過');
    return data;
  }
  async function enrich(list){
    const requested=list.length;
    if(!requested)return {requested:0,success:0,failed:0,pending:0,aborted:false,retryRecovered:0,failedCodes:[],failures:[],cooldowns:0,policy:POLICY.version};
    // R1.2: the all-qualified scan can create more FULL candidates than the original 140-cap scan.
    // Preserve the R1.1 cap for 70/140 modes; in all mode allot a bounded 75s window per 60 candidates.
    const allQualifiedMode=document.getElementById('dayTradeDeepLimit')?.value==='all';
    const fullStageBudgetMs=allQualifiedMode?POLICY.totalBudgetMs*Math.max(1,Math.ceil(requested/60)):POLICY.totalBudgetMs;
    const deadline=Date.now()+fullStageBudgetMs;
    let cursor=0,done=0,success=0,retryRecovered=0;
    const failures=[];
    list.forEach(c=>{c.decisionEnrichedV39B12=false;c.detailDataStatusV19={state:'PENDING',label:'完整個股資料驗證中',available:false,originalCandidatePreserved:true};});
    label('完整個股資料驗證',0,requested,0,0,`最長 ${Math.ceil(fullStageBudgetMs/1000)} 秒；不放寬安全 Gate`);
    const worker=async()=>{
      while(!cancelled()){
        const index=cursor++;
        if(index>=requested)return;
        const c=list[index],code=numCode(c);
        let data=null,lastReason='完整個股資料未回傳',usedFallback=false,attempt=0;
        if(!/^[1-9]\d{3}$/.test(code)){
          lastReason='FULL 股票代號無效';
        }else if(remaining(deadline)<500){
          lastReason='完整資料補抓時間預算已到';
        }else{
          for(attempt=1;attempt<=POLICY.fullProxyAttempts&&!cancelled();attempt++){
            try{data=await fetchProxy(code,deadline);break;}
            catch(e){lastReason=errorText(e);}
            if(attempt<POLICY.fullProxyAttempts&&remaining(deadline)>POLICY.retryGapMs+500&&!cancelled()){
              await new Promise(resolve=>setTimeout(resolve,POLICY.retryGapMs));
            }
          }
          if(!data&&!cancelled()&&remaining(deadline)>500){
            try{data=await fetchDirect(code,deadline);usedFallback=true;}
            catch(e){lastReason=errorText(e);}
          }
        }
        if(cancelled())return;
        if(data){
          // Only actual FULL data can produce a formal action Gate later.
          c.report=data;
          c.decisionEnrichedV39B12=true;
          c.detailDataStatusV19={state:'AVAILABLE',label:'完整個股資料已取得',available:true,originalCandidatePreserved:true};
          success++;
          if(attempt>1||usedFallback)retryRecovered++;
        }else{
          const status=dayTradeDetailFailureStateV19(lastReason);
          c.detailDataStatusV19={...status,available:false,originalCandidatePreserved:true};
          failures.push({code,reason:lastReason,status});
        }
        done++;
        label('完整個股資料驗證',done,requested,success,failures.length,remaining(deadline)?`剩餘上限 ${Math.ceil(remaining(deadline)/1000)} 秒`:'時間預算已到');
      }
    };
    await Promise.all(Array.from({length:Math.min(POLICY.concurrency,requested)},()=>worker()));
    const aborted=cancelled();
    if(!aborted){
      // Every unresolved candidate becomes DATA_INSUFFICIENT, never an assumed success.
      const found=new Set(failures.map(x=>x.code));
      for(const c of list){
        const code=numCode(c);
        if(c.decisionEnrichedV39B12!==true&&!found.has(code)){
          const reason='完整資料補抓時間預算已到';
          const status=dayTradeDetailFailureStateV19(reason);
          failures.push({code,reason,status});found.add(code);
        }
      }
      done=requested;
    }
    const pending=aborted?list.filter(c=>c.decisionEnrichedV39B12!==true&&!failures.some(x=>x.code===numCode(c))).length:0;
    label(aborted?'完整資料驗證已停止':'完整個股資料驗證完成',requested-pending,requested,success,failures.length,
      aborted?'已停止':'資料不足不列正式候選');
    return {requested,success,failed:failures.length,pending,aborted,retryRecovered,
      failedCodes:failures.map(x=>x.code),failures,cooldowns:0,policy:POLICY.version};
  }
  // This function is called only by scanner #2's first / second scan phases.
  dayTradeEnrichFinalCandidatesV39B12=enrich;
  root.DAYTRADE_R11_POLICY=POLICY;
  root.dayTradeR11EnrichForTest=enrich;
})(window);
