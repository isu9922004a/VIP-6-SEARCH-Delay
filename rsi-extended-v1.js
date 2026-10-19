/* RSICTX.1: immutable observation only; no strategy scores, gates or orders. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouRsiExtended=api;})(globalThis,function(){
'use strict';
const MODEL='RSI_5_10_14_CONTEXT_1';
const POLICY=Object.freeze({highInclusive:90,lowExclusive:10,smoothing:'WILDER_RMA',seed:'FIRST_N_CLOSE_DELTAS_SMA',flat:50,multiDayThreshold:null,rankingChanged:false,eligibilityChanged:false,weights:null});
const numeric=v=>v===null||v===undefined||typeof v==='boolean'||typeof v==='object'||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
const num=v=>numeric(v)!==null&&numeric(v)>=0&&numeric(v)<=100?numeric(v):null;
const fmt=v=>numeric(v)===null?'資料不足':Number(v).toFixed(2);
const seriesCache=new Map();let computations=0;
function series(bars,calculate,fingerprint){
 const text=JSON.stringify(bars),key=fingerprint(bars),old=seriesCache.get(key);
 if(old?.text===text)return old.values;
 const values=Object.freeze(Object.fromEntries([5,10,14].map(p=>[p,Object.freeze(calculate(bars,p))])));
 seriesCache.set(key,{text,values});computations++;if(seriesCache.size>1500)seriesCache.delete(seriesCache.keys().next().value);return values;
}
function streak(values,predicate){let count=0,i=values.length-1;for(;i>=0&&num(values[i])!==null&&predicate(values[i]);i--)count++;return {count,lowerBound:count>0&&(i<0||num(values[i])===null)};}
function period(values,p){
 const value=num(values.at(-1)),previous=num(values.at(-2)),available=value!==null,eventsAvailable=available&&previous!==null;
 const high=available?streak(values,v=>v>=90):null,low=available?streak(values,v=>v<10):null;
 return {period:p,available,previousAvailable:previous!==null,value,previous,delta:eventsAvailable?value-previous:null,direction:!eventsAvailable?'UNAVAILABLE':value>previous?'UP':value<previous?'DOWN':'FLAT',high:available?value>=90:null,low:available?value<10:null,highStreak:high?.count??null,highStreakLowerBound:high?.lowerBound??null,lowStreak:low?.count??null,lowStreakLowerBound:low?.lowerBound??null,exitedLow:eventsAvailable?previous<10&&value>=10:null,exitedHigh:eventsAvailable?previous>=90&&value<90:null,eventsAvailable};
}
function unavailable(reason,metadata={}){return {model:MODEL,policy:POLICY,status:'DATA',available:false,reason,metadata,periods:{5:period([],5),10:period([],10),14:period([],14)},bothLow:null,price:{abovePriorHigh:null},worker:{status:'UNVERIFIED',value:null,delta:null,reason:'共用序列尚未核對'},fundamentals:{status:'UNVERIFIED',reason:'未接基本面、新聞或主力身分驗證'},rankingChanged:false,eligibilityChanged:false};}
function worker(report,metadata,computed){
 const saved=report.rsiSourceAudit,raw=saved||{value:report.dailyRsi5??report.dailyRsi,date:report.dailyRsi5Date||report.rsiDate||report.closeDate||report.dataDate,market:report.market,code:report.stock||report.code,source:'REPORT_UNVERIFIED',meta:report.rsi5Meta||null},value=num(raw.value),delta=value!==null&&computed!==null?value-computed:null;
 const meta=raw.meta||{},sameIdentity=String(raw.code||'')===metadata.code&&String(raw.market||'').toUpperCase()===metadata.market&&raw.date===metadata.date;
 const decimals=Number.isInteger(meta.decimals)&&meta.decimals>=0&&meta.decimals<=10?meta.decimals:null;
 const proved=(decimals!==null||meta.precision==='FULL')&&sameIdentity&&meta.verified===true&&meta.period===5&&meta.smoothing==='WILDER_RMA'&&meta.seed==='FIRST_N_CLOSE_DELTAS_SMA'&&meta.fingerprint===metadata.fingerprint&&meta.rows===metadata.rows&&meta.adjustmentVerified===true&&metadata.basisVerified===true;
 const within=proved&&value!==null&&computed!==null&&(decimals!==null?Math.abs(delta)<=.5*Math.pow(10,-decimals)+1e-10:Math.abs(delta)<=1e-10);
 return {source:raw.source||'REPORT_UNVERIFIED',value,date:raw.date||null,code:raw.code||null,market:raw.market||null,computed,delta,provenanceVerified:proved,decimals,status:!proved||value===null||computed===null?'UNVERIFIED':within?'MATCHED':'DIFFERENT',reason:!proved?'來源公式、初始化、歷史指紋、精度或調整證據不足；不拼接序列':value===null?'來源RSI5缺失或不合法':within?'已核對來源與已知精度':'已核對來源但數值不一致；保留差異，不回寫原策略'};
}
function build(report,{bars,values,date,fingerprint,calendarVerified,basisVerified,rsi14}){
 const code=String(report.stock||report.code||''),market=String(report.market||'').toUpperCase(),metadata={code,market,date,from:bars[0]?.date||null,to:bars.at(-1)?.date||null,rows:bars.length,fingerprint,smoothing:POLICY.smoothing,seed:POLICY.seed,calendarVerified,basisVerified:basisVerified===true&&typeof report.priceAdjustment?.basis==='string'&&report.priceAdjustment.basis.trim()!==''&&report.priceAdjustment.basis!=='UNKNOWN',adjustmentBasis:report.priceAdjustment?.basis||'UNKNOWN',source:report.dailyBasisV2?.model||report.dailySeriesMeta?.source||'COMPLETED_DAILY_BARS'};
 if(!/^\d{4}$/.test(code)||!['TWSE','TPEX'].includes(market))return unavailable('代號／市場尚未核對，不確認新事件',metadata);
 const periods=Object.fromEntries([5,10,14].map(p=>[p,period(values[p],p)])),last=bars.at(-1),prior=bars.at(-2),legacyValue=report.rsiLegacyAudit?num(report.rsiLegacyAudit.value):num(report.dailyRsi5??report.dailyRsi);
 return {model:MODEL,policy:POLICY,status:metadata.calendarVerified&&metadata.basisVerified?'VERIFIED':'UNVERIFIED',available:true,metadata,periods,rsi14:{state:rsi14.state||null,consecutiveAbove50:rsi14.consecutiveAbove50??null,streakLowerBound:rsi14.streakLowerBound??null,newHigh20:rsi14.newHigh20??null,newHigh20Available:rsi14.newHigh20Available??false},originalStrategy:{value:legacyValue,date:report.rsiLegacyAudit?.date||date,source:report.rsiLegacyAudit?.source||'REPORT_VALUE',delta:legacyValue!==null&&periods[5].value!==null?legacyValue-periods[5].value:null},bothLow:periods[5].available&&periods[10].available?periods[5].low&&periods[10].low:null,price:{abovePriorHigh:prior?last.close>prior.high:null,close:last.close,priorHigh:prior?.high??null,priorDate:prior?.date??null,definition:'工程研究欄位：當日完成收盤嚴格高於前一完成日K高點；相等不算'},worker:worker(report,metadata,periods[5].value),fundamentals:{status:'UNVERIFIED',reason:'基本面／新聞／主力身分未提供可核對資料'},rankingChanged:false,eligibilityChanged:false};
}
function lines(x){
 if(!x||x.model!==MODEL)return ['RSI5／10多週期情境：未計算（舊紀錄保持原樣，不回填）'];
 if(!x.available)return ['RSI5／10多週期情境：資料不足｜'+x.reason];
 const count=(v,low)=>`${low?'至少 ':''}${v}根完成日K`,direction={UP:'上升',DOWN:'下降',FLAT:'持平',UNAVAILABLE:'前值不足'};
 const out=['【RSI多週期情境｜獨立觀察，不改原榜】'];
 for(const p of [5,10]){const r=x.periods[p];out.push(`RSI${p} ${fmt(r.value)}｜前值 ${fmt(r.previous)}｜${direction[r.direction]}｜變化 ${fmt(r.delta)}`);out.push(r.available?`RSI${p}：≥90 ${r.high?'是':'否'}／連續${count(r.highStreak,r.highStreakLowerBound)}；<10 ${r.low?'是':'否'}／連續${count(r.lowStreak,r.lowStreakLowerBound)}`:`RSI${p}暖機不足`);out.push(`RSI${p}離開<10：${r.exitedLow===null?'未驗證':r.exitedLow?'是':'否'}｜離開≥90：${r.exitedHigh===null?'未驗證':r.exitedHigh?'是':'否'}`);}
 out.push(`RSI14 ${fmt(x.periods[14].value)}（沿用原情境）；RSI5與RSI10同時<10：${x.bothLow===null?'未驗證':x.bothLow?'是':'否'}`);
 out.push(`價格另核對：完成收盤 > 前一日高點 ${fmt(x.price.priorHigh)}（${x.price.priorDate||'不足'}）：${x.price.abovePriorHigh===null?'不足':x.price.abovePriorHigh?'是':'否'}；工程研究定義，非買進許可`);
 out.push(`原策略RSI5 ${fmt(x.originalStrategy?.value)}｜共用情境 ${fmt(x.periods[5].value)}｜差 ${fmt(x.originalStrategy?.delta)}；原RSI卡保留原策略口徑`, `來源Worker RSI參考值 ${fmt(x.worker.value)}｜與共用差 ${fmt(x.worker.delta)}｜${x.worker.status==='MATCHED'?'已核對一致':x.worker.status==='DIFFERENT'?'已核對但不同':'來源一致性未驗證'}`);
 out.push(x.worker.reason,`資料 ${x.metadata.code}／${x.metadata.market}／${x.metadata.date}｜${x.metadata.from}～${x.metadata.to} ${x.metadata.rows}根｜指紋 ${x.metadata.fingerprint}`);
 out.push(`Wilder平滑；前N個收盤價差均值初始化｜日曆${x.metadata.calendarVerified?'已核對':'未驗證'}／價格調整${x.metadata.basisVerified?'已核對':'未驗證'}（${x.metadata.adjustmentBasis}）`,`基本面／新聞／主力身分：未驗證；90／10為工程定義，不自行指定連續多日門檻。`);return out;
}
function advice(e,candidate={},kind='STOCK',monthly='UNVERIFIED'){
 const x=e?.rsiExtended,valid=x?.available===true,p5=x?.periods?.[5],p10=x?.periods?.[10],date=e?.date;
 const evidence=candidate.selectionEvidence?.date===date?candidate.selectionEvidence:null;
 const weak=(e?.volume?.available&&e.volume.state==='CAUTION')||evidence?.state==='CAUTION';
 const dates=[candidate.date,candidate.closeDate,candidate.report?.closeDate,candidate.tower?.date].filter(Boolean),sourceVerified=e?.status!=='DATA'&&dates.length>0&&dates.every(d=>String(d).replaceAll('/','-')===date);
 const failed=sourceVerified&&((candidate.report?.fib||candidate.fib)?.status==='failed'||candidate.st?.nStatus==='failed'||candidate.hardRiskCodes?.includes('EVENT_LOW_BROKEN')===true);
 let level=null;
 if(sourceVerified&&kind==='RESTAURANT'&&candidate.date===date&&numeric(candidate.levels?.invalidation)>0&&candidate.levels?.source)level={value:numeric(candidate.levels.invalidation),comparison:'<',timing:'COMPLETED_CLOSE',source:candidate.levels.source,date,verified:true};
 if(sourceVerified&&kind==='TOWER'&&candidate.tower?.date===date&&candidate.risk?.ok&&numeric(candidate.risk.levels?.invalidation)>0)level={value:numeric(candidate.risk.levels.invalidation),comparison:'<',timing:'NEXT_COMPLETED_CLOSE',source:'原寶塔T3空方門檻／原scenarios.weak',date,verified:true};
 const reference=numeric(candidate.waveRiskLevel??candidate.support?.value??candidate.support??candidate.levels?.support?.value??candidate.levels?.support??candidate.fib?.stop764??candidate.report?.fib?.stop764);
 let flat='等待原策略價格觸發與可成交條件；此處不新增買進許可。',holder='依原有防守管理；沒有持倉成本或部位資料，不指定賣出比例。';
 if(valid){if(p5.low||p10.low)flat='極低檔先列超跌觀察，等待動能改善與價格確認；基本面未驗證。';else if(p5.exitedLow||p10.exitedLow)flat='動能離開極低檔；價格站回關卡仍須另外確認，不等於買進。';else if(p10.high)flat='RSI10極高檔仍可能續強；提高追價警覺，等待合適位置與原價格條件。';else if(p5.high)flat='RSI5短期動能很強；檢查追價距離，不直接判定末升段。';else if(p5.direction==='UP'&&e.rsi?.state==='UP_CONTEXT')flat='偏多背景下短期動能改善；只有原資格與支撐成立才列順勢回測觀察。';
 if(p10.high)holder='RSI10極高檔持續同時反映強動能；追蹤原防守，不因天數增加直接宣告反轉。';
 if(weak&&(p10.high||p10.exitedHigh||p5.exitedHigh))holder='極高檔／退潮事件與既有量價轉弱同時出現：持股評估減碼或提高防守；不自動下單。';}
 if(failed)holder='原策略已明示結構失效：依原失效規則處理；RSI極低不能取消防守。';
 if(monthly!=='PASS')flat+=' 月線'+(monthly==='NOT_PASS'?'未通過':'尚未驗證')+'，不由新情境提升安全榜資格。';
 const levels=level?`失效：${level.timing==='NEXT_COMPLETED_CLOSE'?'下一完成收盤':'完成收盤'} ${level.comparison} ${fmt(level.value)}｜${level.source}｜計算日 ${date}`:`失效：原策略未附完整觸發定義，保持未驗證${reference>0?'；原防守參考 '+fmt(reference)+'（不據此新增停損）':''}`;
 const aims={MAIN:'主升突破／延續／回測與新買位置分開；原RSI計分保留',DAYTRADE:'日K只列次日觀察，跳空與盤中可成交尚未知',STRONG:'三盤／價格三線／量能三線保留，強勢與新買風險並列',TOWER:candidate.type==='B'?'B黑翻紅看低檔改善；不要求RSI14已連續多天>50':candidate.type==='A'?'A紅線續強看趨勢與高檔警覺；原翻色與風控優先':'寶塔子型態未提供；不推定A／B，原翻色與風控優先',RESTAURANT:'單日RSI5高不新增淘汰；主力／JMA仍須獨立核對',STOCK:'趨勢、空手、持股與失效分開；不預測必漲必跌'};
 const reasons=weak?(e?.volume?.reasons||evidence?.reasons||[]).map(text=>({date,text})):[];
 return {model:MODEL,date,kind,monthlyStatus:monthly,trend:e?.rsi?.label||'趨勢資料不足',flat,holder,level,reference:reference>0?reference:null,weakEvidence:reasons,originalFailure:!!failed,lines:[`趨勢：${e?.rsi?.label||'資料不足'}｜月線 ${monthly==='PASS'?'已驗證通過':monthly==='NOT_PASS'?'未通過':'尚未驗證'}`,`空手：${flat}`,`持股：${holder}`,levels,...reasons.map(r=>`既有量價證據 ${r.date}：${r.text}`),aims[kind]||aims.STOCK]};
}
function comparison(observations,topN=10){
 const partitions=new Map(),ordered=observations.slice().sort((a,b)=>String(a.capturedAt).localeCompare(String(b.capturedAt))),seen=new Set();
 for(const r of ordered){const x=r.evidence?.rsiExtended,rule=r.strategyEvidence?.rule?.eventWindow??'',meta=x?.metadata,cohort=[r.strategy,r.subtype||'',r.baselineModel||'',r.baselineRelease||'',rule,x?.model||'NOT_COMPUTED',meta?.market||'',meta?.rows??'',meta?.smoothing||'',meta?.seed||'',meta?.adjustmentBasis||'UNKNOWN'].join('|'),key=[cohort,r.date,r.code].join('|');if(r.origin!=='LIVE_CAPTURE'||seen.has(key))continue;seen.add(key);if(!partitions.has(cohort))partitions.set(cohort,{cohort,model:x?.model||'NOT_COMPUTED',strategy:r.strategy,subtype:r.subtype||'',window:rule,rows:[]});partitions.get(cohort).rows.push(r);}
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null,stats=rows=>({n:rows.length,dates:new Set(rows.map(r=>r.date)).size,meanOpenToCloseGrossPct:mean(rows.map(r=>r.outcome.openToCloseGrossPct)),meanCloseToClosePct:mean(rows.map(r=>r.outcome.closeToClosePct)),executionVerified:false});
 const groups=[['RSI5_HIGH','RSI5≥90',x=>x.periods[5].high],['RSI10_HIGH','RSI10≥90',x=>x.periods[10].high],['RSI5_LOW','RSI5<10',x=>x.periods[5].low],['RSI10_LOW','RSI10<10',x=>x.periods[10].low],['BOTH_LOW','兩者同時<10',x=>x.bothLow],['RSI5_EXIT_LOW','RSI5離開<10',x=>x.periods[5].exitedLow],['RSI10_EXIT_HIGH','RSI10離開≥90',x=>x.periods[10].exitedHigh],['PRIOR_HIGH','收盤>前一日高點',x=>x.price.abovePriorHigh]];
 return {model:MODEL,topN,exitStudy:{status:'UNVERIFIED',reason:'未提供同批持倉交易、成本、滑價及可成交紀錄，不產生出場淨報酬／回撤績效'},cohorts:[...partitions.values()].map(p=>{const eligible=p.rows.filter(r=>r.baselineRank>=1&&r.baselineRank<=topN&&r.evidence?.rsiExtended?.model===MODEL&&r.evidence.rsiExtended.available&&r.evidence.calendarVerified&&r.evidence.basisVerified&&r.evidence.rsiExtended.metadata.calendarVerified===true&&r.evidence.rsiExtended.metadata.basisVerified===true&&r.outcome?.status==='COMPLETE'&&numeric(r.outcome.openToCloseGrossPct)!==null&&numeric(r.outcome.closeToClosePct)!==null&&Number.isFinite(Date.parse(r.capturedAt))&&Date.parse(r.capturedAt)<Date.parse(r.outcome.date+'T09:00:00+08:00'));return {...p,rows:undefined,observations:p.rows.length,excluded:p.rows.length-eligible.length,groups:groups.map(([key,label,test])=>{const valid=eligible.filter(r=>typeof test(r.evidence.rsiExtended)==='boolean');return {key,label,excludedData:eligible.length-valid.length,match:stats(valid.filter(r=>test(r.evidence.rsiExtended))),other:stats(valid.filter(r=>!test(r.evidence.rsiExtended)))};})};})};
}
return Object.freeze({MODEL,POLICY,numeric,period,streak,series,build,worker,unavailable,lines,advice,comparison,cacheStats:()=>({entries:seriesCache.size,computations})});
});
