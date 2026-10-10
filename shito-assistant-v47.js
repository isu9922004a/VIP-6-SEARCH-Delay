/* 石頭少爺 Agent V47｜少爺助理：三重選股把關＋區段量價防守
 * 本檔只新增 evidence layer / risk layer，不會改寫 ABC、N字、Pivot、Swing Chain、
 * Fibonacci、原分數或 executionAllowed。
 */
(function(){
"use strict";

const SHITO_ASSISTANT_RULES_V1=Object.freeze({
  version:"石頭少爺 Agent V47 正式版｜R5.3.2.4.12 顯示與共用狀態一致性收尾版",
  profileBins:48,
  maxDailyBars:240,
  minDailyBars:20,
  smallHolderLevels:[1,2,3],
  largeHolderLevels:[12,13,14,15]
});
const STATUS_LABEL={pass:"通過",near:"接近條件",fail:"未通過",unavailable:"官方資料不足，不計分",stale:"資料較舊",error:"資料取得失敗"};
const STATUS_ICON={pass:"✅",near:"🟡",fail:"❌",unavailable:"⚪",stale:"🟡",error:"⚪"};

function finite(v){if(v===null||v===undefined||String(v).trim()===""||String(v).trim()==="-")return null;const x=Number(String(v).replace(/,/g,""));return Number.isFinite(x)?x:null;}
function pct(v,d=1){return finite(v)===null?"尚無資料":`${finite(v).toFixed(d).replace(/\.0$/,"")}%`;}
function price(v,d=2){const x=finite(v);if(x===null)return "尚未建立";return `${x.toFixed(d).replace(/\.00$/,"").replace(/(\.\d)0$/,"$1")}元`;}
function range(a,b){return finite(a)===null||finite(b)===null?"尚未建立":`${price(a).replace("元","")}～${price(b)}`;}
function safeDate(v){return String(v||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3")||"尚無日期";}
function avg(xs){const a=xs.map(finite).filter(v=>v!==null);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;}
function sum(xs){return xs.map(finite).filter(v=>v!==null).reduce((s,v)=>s+v,0);}
function statusCount(items){const usable=items.filter(x=>!["unavailable","error"].includes(x.status));return {pass:usable.filter(x=>x.status==="pass").length,total:usable.length,missing:items.length-usable.length};}
function summaryText(items,noun="項"){const c=statusCount(items);return `通過${c.pass}／${c.total}${noun}${c.missing?`｜另有${c.missing}${noun}資料不足`:""}`;}
function normalizeRows(rows){return (Array.isArray(rows)?rows:[]).map(r=>({date:safeDate(r.date||r.Date),open:finite(r.open),high:finite(r.high),low:finite(r.low),close:finite(r.close),volume:finite(r.volume)})).filter(r=>r.date&&[r.open,r.high,r.low,r.close,r.volume].every(v=>v!==null)&&r.high>=r.low&&r.close>0&&r.volume>0).sort((a,b)=>a.date.localeCompare(b.date));}
function ma(rows,n){return rows.length>=n?avg(rows.slice(-n).map(r=>r.close)):null;}
function roc(rows,n){return rows.length>n&&rows.at(-n-1).close>0?(rows.at(-1).close/rows.at(-n-1).close-1)*100:null;}
function atr(rows,n=14){if(rows.length<n+1)return null;const tr=rows.slice(-n).map((r,i,a)=>{const prev=i?a[i-1].close:rows[rows.length-n-1].close;return Math.max(r.high-r.low,Math.abs(r.high-prev),Math.abs(r.low-prev));});return avg(tr);}
function obvSeries(rows){let v=0;return rows.map((r,i)=>{if(i)v+=r.close>rows[i-1].close?r.volume:r.close<rows[i-1].close?-r.volume:0;return v;});}
function cmf(rows,n=20){if(rows.length<n)return null;let flow=0,vol=0;for(const r of rows.slice(-n)){const m=r.high===r.low?0:((r.close-r.low)-(r.high-r.close))/(r.high-r.low);flow+=m*r.volume;vol+=r.volume;}return vol?flow/vol:null;}

function findAnchorDate(report,rows){
  const f=report?.fib||{};
  const candidates=[f?.A?.date,f?.current?.A?.date,f?.active?.A?.date,f?.points?.A?.date,report?.startMonth];
  const a=candidates.find(Boolean);
  if(!a)return {date:rows[Math.max(0,rows.length-SHITO_ASSISTANT_RULES_V1.maxDailyBars)]?.date||null,type:"最近可用日K區段"};
  const d=String(a).length===7?`${a}-01`:safeDate(a);
  return {date:d,type:String(a)===String(report?.startMonth)?"目前月線有效區段":"有效ABC的A點"};
}

function groupBins(bins,predicate){
  const groups=[];let g=[];
  bins.forEach(b=>{if(predicate(b)){g.push(b);}else if(g.length){groups.push(g);g=[];}});if(g.length)groups.push(g);
  return groups.map(x=>({lower:x[0].lower,upper:x.at(-1).upper,center:(x[0].lower+x.at(-1).upper)/2,volume:sum(x.map(y=>y.volume))}));
}

function anchoredVolumeProfileEvidence(report){
  const all=normalizeRows(report?.dailySeries),anchor=findAnchorDate(report,all);
  let rows=all.filter(r=>!anchor.date||r.date>=anchor.date).slice(-SHITO_ASSISTANT_RULES_V1.maxDailyBars);
  if(rows.length<SHITO_ASSISTANT_RULES_V1.minDailyBars)return {status:"unavailable",label:"日K資料不足20根，先不計算",dataTiming:"POST_CLOSE",moneyFlowRole:"SECONDARY_CONFIRMATION",anchorType:anchor.type,anchorStartDate:rows[0]?.date||anchor.date,anchorEndDate:rows.at(-1)?.date||report?.closeDate,dataDate:rows.at(-1)?.date||report?.closeDate,volumeProfileDataQuality:"資料不足",calculationMethod:"48個價格箱；每根日K以（最高＋最低＋收盤）÷3代表",rowsUsed:rows.length};
  const lo=Math.min(...rows.map(r=>r.low)),hi=Math.max(...rows.map(r=>r.high));
  let width=(hi-lo)/SHITO_ASSISTANT_RULES_V1.profileBins;if(!(width>0))width=Math.max(Math.abs(lo)*0.0001,0.01);
  const bins=Array.from({length:SHITO_ASSISTANT_RULES_V1.profileBins},(_,i)=>({lower:lo+i*width,upper:lo+(i+1)*width,volume:0}));
  rows.forEach(r=>{const tp=(r.high+r.low+r.close)/3;const i=Math.max(0,Math.min(bins.length-1,Math.floor((tp-lo)/width)));bins[i].volume+=r.volume;});
  const total=sum(bins.map(b=>b.volume)),poc=bins.reduce((a,b)=>b.volume>a.volume?b:a,bins[0]),mean=total/bins.length;
  const hvn=groupBins(bins,b=>b.volume>=mean*1.35),lvn=groupBins(bins,b=>b.volume>0&&b.volume<=mean*0.45),close=rows.at(-1).close;
  const nearest=groups=>groups.length?groups.reduce((a,b)=>Math.abs(b.center-close)<Math.abs(a.center-close)?b:a):null;
  const nearH=nearest(hvn),nearL=nearest(lvn),role=close>poc.upper?"價格在區段上方，這裡偏支撐":close<poc.lower?"價格在區段下方，這裡偏壓力":"價格正在交易密集區內拉鋸";
  const tolerance=Math.max(width*2,(atr(rows,14)||0)*0.5),last10=rows.slice(-10),touched=last10.some(r=>r.low<=poc.upper+tolerance&&r.high>=poc.lower-tolerance),held=touched&&close>=poc.upper;
  const vol20=avg(rows.slice(-20).map(r=>r.volume)),pullbackDry=touched&&rows.at(-1).volume<(vol20||Infinity),obv=obvSeries(rows),obvHeld=obv.length>=10&&obv.at(-1)>=Math.min(...obv.slice(-10)),cmf20=cmf(rows),executionAllowed=report?.shitoOriginalExecutionAllowed===true;
  const confirmations=[close>poc.upper,held,pullbackDry,obvHeld,cmf20!==null&&cmf20>0,executionAllowed].filter(Boolean).length;
  return {status:"pass",label:"已用盤後日K完成區段估算",dataTiming:"POST_CLOSE",moneyFlowRole:"SECONDARY_CONFIRMATION",anchorType:anchor.type,anchorStartDate:rows[0].date,anchorEndDate:rows.at(-1).date,pocPrice:(poc.lower+poc.upper)/2,pocLower:poc.lower,pocUpper:poc.upper,pocVolumeShare:total?poc.volume/total*100:null,nearestHvnZone:nearH,nearestLvnZone:nearL,currentPriceVsPoc:close>poc.upper?"above":close<poc.lower?"below":"inside",pocRole:role,pocRetestState:held?(confirmations>=3&&executionAllowed?"拉回後守穩，輔助證據足夠":"拉回有守，但原有進場檢查尚未允許，不能當買進訊號"):touched?"最近碰到此區，尚未完成守穩確認":"最近10個交易日還沒有拉回測試這個區域",supportConfirmations:confirmations,volumeProfileDataQuality:`有效日K ${rows.length} 根`,calculationMethod:"價格分成48箱；每根日K以（最高＋最低＋收盤）÷3歸入一箱並累加成交量，屬區段估算，不是逐筆成交分布",dataDate:rows.at(-1).date,rowsUsed:rows.length,boxWidth:width};
}

function mergeSnapshots(live,staticData,code){
  const s=staticData?.stocks?.[code]||staticData?.[code]||{};
  const merged={...live,...s};
  ["revenueHistory","grossMarginHistory","tdccHistory","institutionalTrading"].forEach(k=>{
    const rows=[...(Array.isArray(live?.[k])?live[k]:[]),...(Array.isArray(s?.[k])?s[k]:[])];
    const key=r=>String(r?.date||r?.period||r?.month||r?.quarter||"");
    merged[k]=Array.from(new Map(rows.filter(Boolean).map(r=>[key(r),r])).values()).sort((a,b)=>key(a).localeCompare(key(b)));
  });
  return merged;
}

function operatingGateEvidence(raw){
  const rev=(raw.revenueHistory||[]).slice(-3),gm=(raw.grossMarginHistory||[]).slice(-3);
  const revY=rev.map(x=>finite(x.yoy)),gmV=gm.map(x=>finite(x.grossMargin));
  const checks=[
    {key:"gross",label:"公司每賣100元，留下的毛利連續兩季增加",status:gmV.length<3?"unavailable":gmV[2]>gmV[1]&&gmV[1]>gmV[0]?"pass":"fail",value:gmV},
    {key:"rev20",label:"最近兩個月營收都比去年同期多20%以上",status:revY.length<2?"unavailable":revY.slice(-2).every(v=>v!==null&&v>20)?"pass":"fail"},
    {key:"rev30",label:"最新一個月營收比去年同期多30%以上",status:revY.length<1||revY.at(-1)===null?"unavailable":revY.at(-1)>30?"pass":"fail"},
    {key:"rev10",label:"最近三個月營收都比去年同期多10%以上",status:revY.length<3?"unavailable":revY.every(v=>v!==null&&v>10)?"pass":"fail"}
  ];
  const available=checks.filter(x=>x.status!=="unavailable"),passed=available.filter(x=>x.status==="pass").length;
  const status=!available.length?"unavailable":passed>=2?"pass":passed===1?"near":"fail";
  return {status,label:STATUS_LABEL[status],checks,latestQuarter:gm.at(-1)?.quarter||null,latestRevenueMonth:rev.at(-1)?.month||null,revenueHistory:rev,grossMarginHistory:gm};
}

function holderGateEvidence(raw){
  const td=(raw.tdccHistory||[]).slice(-8),now=td.at(-1),four=td.length>=5?td.at(-5):null;
  const large=finite(now?.largeHolderPct),large4=finite(four?.largeHolderPct),small=finite(now?.smallHolderPct),small4=finite(four?.smallHolderPct);
  const checks=[
    {key:"large",label:"持有400張以上的大戶比例比四週前增加",status:large===null||large4===null?"unavailable":large>large4?"pass":"fail"},
    {key:"small",label:"持有10張以下的小額股東比例比四週前下降",status:small===null||small4===null?"unavailable":small<small4?"pass":"fail"}
  ];
  const status=checks.some(x=>x.status==="unavailable")?"unavailable":checks.every(x=>x.status==="pass")?"pass":checks.some(x=>x.status==="pass")?"near":"fail";
  return {status,label:STATUS_LABEL[status],checks,latestDate:now?.date||null,largeHolderPct:large,largeFourWeeksAgoPct:large4,smallHolderPct:small,smallFourWeeksAgoPct:small4,note:"這裡只看集保股權分散變化，不把400張以上大戶直接叫做內資。"};
}

function capitalGateEvidence(raw){
  const days=(raw.institutionalTrading||[]).filter(x=>[finite(x.foreign),finite(x.trust),finite(x.dealer),finite(x.total)].some(v=>v!==null)).slice(-5);
  if(days.length<5)return {status:"unavailable",label:"近5個交易日資料不足，不計分",checks:[],days,latestDate:days.at(-1)?.date||null};
  const foreign=sum(days.map(x=>x.foreign)),trust=sum(days.map(x=>x.trust)),dealer=sum(days.map(x=>x.dealer)),total=sum(days.map(x=>x.total)),foreignBuyDays=days.filter(x=>finite(x.foreign)>0).length,trustBuyDays=days.filter(x=>finite(x.trust)>0).length;
  const checks=[
    {label:"外資近5日合計買超",status:foreign>0?"pass":"fail"},
    {label:"外資近5日至少3日買超",status:foreignBuyDays>=3?"pass":"fail"},
    {label:"投信近5日合計買超",status:trust>0?"pass":"fail"},
    {label:"三大法人近5日合計買超",status:total>0?"pass":"fail"}
  ];
  const passed=checks.filter(x=>x.status==="pass").length,status=passed>=2?"pass":passed===1?"near":"fail";
  return {status,label:STATUS_LABEL[status],checks,days,latestDate:days.at(-1)?.date,foreign,trust,dealer,total,foreignBuyDays,trustBuyDays,foreignFiveStrong:days.every(x=>finite(x.foreign)>=500000),trustThreeStrong:days.slice(-3).every(x=>finite(x.trust)>=200000)};
}

function momentumBreakoutEvidence(report,raw,poc){
  const r=normalizeRows(report?.dailySeries),last=r.at(-1),m5=ma(r,5),m10=ma(r,10),m20=ma(r,20),m20prev=r.length>=25?avg(r.slice(-25,-5).map(x=>x.close)):null,vol20=avg(r.slice(-20).map(x=>x.volume)),ret5=roc(r,5),ret20=roc(r,20),high60=r.length>=60?Math.max(...r.slice(-60).map(x=>x.high)):null;
  const rev=(raw.revenueHistory||[]).slice(-3),cap=capitalGateEvidence(raw),hold=holderGateEvidence(raw),items=[];
  const add=(label,test,available=true,detail="")=>items.push({label,status:!available?"unavailable":test?"pass":"fail",detail});
  add("收盤站上5日平均價",last&&m5!==null&&last.close>m5,!!last&&m5!==null,m5===null?"":`5日平均價 ${price(m5)}`);
  add("沒有高出5日平均價超過5%",last&&m5!==null&&((last.close/m5-1)*100)<=5,!!last&&m5!==null);
  add("今天沒有出最新收盤跌量增",r.length>=2&&!(last.close<r.at(-2).close&&last.volume>r.at(-2).volume),r.length>=2);
  add("5、10、20日平均價呈多頭順序",m5>m10&&m10>m20,[m5,m10,m20].every(x=>x!==null));
  add("20日平均價正在往上",m20>m20prev,m20!==null&&m20prev!==null);
  add("最近5日漲幅沒有超過15%",ret5!==null&&ret5<=15,ret5!==null,ret5===null?"":`近5日 ${pct(ret5)}`);
  add("最近20日漲幅沒有超過30%",ret20!==null&&ret20<=30,ret20!==null,ret20===null?"":`近20日 ${pct(ret20)}`);
  const amount5=r.length>=5?avg(r.slice(-5).map(x=>x.volume*((x.high+x.low+x.close)/3))):null;add("近5日平均成交金額超過1,000萬元",amount5>10000000,amount5!==null);
  const amp=r.length>=20?(Math.max(...r.slice(-20).map(x=>x.high))-Math.min(...r.slice(-20).map(x=>x.low)))/Math.min(...r.slice(-20).map(x=>x.low))*100:null;add("20日價格整理範圍小於10%",amp<10,amp!==null,amp===null?"":`目前 ${pct(amp)}`);
  add("最近3日成交量都高於20日平均量",r.length>=20&&r.slice(-3).every(x=>x.volume>vol20),r.length>=20);
  add("最新收盤在60日最高價附近（95%～105%）",last&&high60&&last.close/high60>=.95&&last.close/high60<=1.05,!!last&&!!high60);
  let above=0;for(let i=Math.max(5,r.length-10);i<r.length;i++){const a=avg(r.slice(i-5,i).map(x=>x.volume));if(a!==null&&r[i].volume>a)above++;}add("最近10日至少5日成交量高於各自5日平均量",above>=5,r.length>=15,`符合 ${above} 日`);
  const ys=rev.map(x=>finite(x.yoy));add("最近三個月營收年增都超過10%",ys.length===3&&ys.every(x=>x>10),ys.length===3);
  add("外資連續5日且每天買超500張",cap.foreignFiveStrong,cap.days?.length===5);
  add("投信連續3日且每天買超200張",cap.trustThreeStrong,cap.days?.length===5);
  add("400張以上大戶比例比四週前增加",hold.checks?.[0]?.status==="pass",hold.checks?.[0]?.status!=="unavailable");
  return {status:"pass",items,summary:summaryText(items),dataDate:last?.date||null,pocRole:poc?.pocRole};
}

function originalExecutionAllowed(report){
  try{const s=typeof window.stockInfographicStateV3328==="function"?window.stockInfographicStateV3328(report):null;return s?.decisionRiskState?.executionAllowed===true||s?.executionAllowed===true;}catch(_){return false;}
}

function buildShitoAssistantEvidence(report,raw){
  report.shitoOriginalExecutionAllowed=originalExecutionAllowed(report);
  const operating=operatingGateEvidence(raw),holder=holderGateEvidence(raw),capital=capitalGateEvidence(raw),poc=anchoredVolumeProfileEvidence(report),momentum=momentumBreakoutEvidence(report,raw,poc);
  const gates=[operating,holder,capital],main=statusCount(gates),strengths=[],risks=[];
  if(operating.status==="pass")strengths.push("營收／毛利把關已通過");if(holder.status==="pass")strengths.push("集保大戶增加且小額股東下降");if(capital.status==="pass")strengths.push("近5日法人買盤具有持續性");if(poc.currentPriceVsPoc==="above")strengths.push("收盤位於主要成交密集區上方");
  if(operating.status==="fail")risks.push("營運把關尚未通過");if(holder.status==="fail")risks.push("大戶把關尚未通過");if(capital.status!=="pass")risks.push(capital.status==="unavailable"?"近5日法人資料不足":"法人買盤尚未形成足夠持續性");if(!report.shitoOriginalExecutionAllowed)risks.push("原有進場檢查尚未允許執行");
  return {version:"石頭少爺 Agent V47 正式版｜R5.3.2.4.12 顯示與共用狀態一致性收尾版",dataTiming:"POST_CLOSE",moneyFlowRole:"SECONDARY_CONFIRMATION",executionPolicy:"EVIDENCE_ONLY_NEVER_OVERRIDES_EXECUTION_ALLOWED",operatingGateEvidence:operating,holderGateEvidence:holder,capitalGateEvidence:capital,anchoredVolumeProfileEvidence:poc,momentumBreakoutEvidence:momentum,summary:`三項背景檢查中通過 ${main.pass}／${main.total} 項${main.missing?`｜另有 ${main.missing} 項資料不足`:""}`,strengths:strengths.slice(0,2),risks:risks.slice(0,2),dataFreshness:{price:report.closeDate||poc.dataDate,institution:capital.latestDate,tdcc:holder.latestDate,revenue:operating.latestRevenueMonth,financial:operating.latestQuarter,poc:poc.dataDate},originalExecutionAllowed:report.shitoOriginalExecutionAllowed,sourceNote:"只使用官方公開資料與原本盤後日K；沒有穩定官方來源的欄位不顯示，也不計分。"};
}

async function fetchJson(url,ms=18000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{cache:"no-store",headers:{Accept:"application/json"},signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(t);}}
async function loadShitoAssistantEvidenceV47(report){
  const code=String(report?.code||report?.stock||"");
  const base=typeof API_BASE_URL!=="undefined"?API_BASE_URL:"";
  const url=`${base}/?assistant=1&stock=${encodeURIComponent(code)}&market=${encodeURIComponent(report?.market||"")}`;
  const [liveResult,staticResult]=await Promise.allSettled([fetchJson(url),fetchJson(`./data/shito-assistant/stocks-v2/${encodeURIComponent(code)}.json`,6000)]);
  const live=liveResult.status==="fulfilled"?(liveResult.value?.data||liveResult.value):{};
  const stat=staticResult.status==="fulfilled"?{stocks:{[code]:staticResult.value}}:{};
  const raw=mergeSnapshots(live,stat,code),evidence=buildShitoAssistantEvidence(report,raw);
  evidence.loadWarnings=[];if(liveResult.status!=="fulfilled")evidence.loadWarnings.push("官方補充資料服務暫時無法連線，已保留原報告並把缺少項目標為不計分");
  report.shitoAssistantEvidence=evidence;renderShitoAssistantV47(evidence);return evidence;
}

function gateHtml(title,g){return `<article class="sa-gate" data-status="${g.status}"><div class="sa-gate-title"><span>${STATUS_ICON[g.status]} ${title}</span><strong>${STATUS_LABEL[g.status]}</strong></div><div class="sa-gate-note">${(g.checks||[]).length?summaryText(g.checks):g.label}</div></article>`;}
function evidenceRows(items){return (items||[]).map(x=>`<li data-status="${x.status}"><span>${STATUS_ICON[x.status]} ${x.label}</span>${x.detail?`<small>${x.detail}</small>`:""}</li>`).join("");}
function renderShitoAssistantV47(e){
  const root=document.getElementById("shitoAssistantV47");if(!root)return;
  root.hidden=false;root.querySelector("#saSummary").textContent=e.summary;
  root.querySelector("#saGateGrid").innerHTML=gateHtml("① 公司營運有沒有變好",e.operatingGateEvidence)+gateHtml("② 大戶持股有沒有增加",e.holderGateEvidence)+gateHtml("③ 法人最近有沒有持續買",e.capitalGateEvidence);
  const p=e.anchoredVolumeProfileEvidence;
  root.querySelector("#saPoc").innerHTML=p.status==="pass"?`<div class="sa-price">📍 主要成交密集價區：${range(p.pocLower,p.pocUpper)}</div><p><strong>現在的位置：</strong>${p.pocRole}</p><p><strong>拉回有沒有守住：</strong>${p.pocRetestState}</p><p>🧱 附近成交較密集價區：${p.nearestHvnZone?range(p.nearestHvnZone.lower,p.nearestHvnZone.upper):"尚未辨識"}<br>↔️ 附近成交較稀疏價區：${p.nearestLvnZone?range(p.nearestLvnZone.lower,p.nearestLvnZone.upper):"尚未辨識"}</p><small>${p.anchorStartDate}～${p.anchorEndDate}｜這是用日K成交量估算的價區，不是逐筆成交資料</small>`:`<p>${STATUS_ICON[p.status]} ${p.label}</p>`;
  root.querySelector("#saMomentumSummary").textContent=e.momentumBreakoutEvidence.summary;
  root.querySelector("#saMomentumList").innerHTML=evidenceRows((e.momentumBreakoutEvidence.items||[]).filter(x=>x.status!=="unavailable"));
  root.querySelector("#saStrengths").innerHTML=(e.strengths.length?e.strengths:["目前沒有足夠資料形成主要加分證據"]).map(x=>`<li>✅ ${x}</li>`).join("");
  root.querySelector("#saRisks").innerHTML=(e.risks.length?e.risks:["目前沒有新增的明確風險證據"]).map(x=>`<li>⚠️ ${x}</li>`).join("");
  const d=e.dataFreshness;root.querySelector("#saDates").textContent=`股價 ${safeDate(d.price)}｜法人 ${safeDate(d.institution)}｜集保 ${safeDate(d.tdcc)}｜月營收 ${d.revenue||"資料不足"}｜財報 ${d.financial||"資料不足"}｜區段估算截至 ${safeDate(d.poc)}`;
  root.querySelector("#saConclusion").textContent=e.originalExecutionAllowed?"新增證據只用來補充判讀；原有進場檢查目前允許執行，仍要依原本價位與風險界線行動。":"新增證據不能把原有進場檢查改成通過；目前仍應等待原本條件完成，不要把分數當成直接買進訊號。";
}

function buildAssistantText(e){
  if(!e)return "";const p=e.anchoredVolumeProfileEvidence,c=e.capitalGateEvidence,h=e.holderGateEvidence,o=e.operatingGateEvidence;
  return ["","━━━━━━━━━━━━━━━━━━","🛡️ 少爺助理｜公司、大戶、法人＋主要成交價區","━━━━━━━━━━━━━━━━━━",`三項背景檢查：${e.summary}`,`公司營運：${STATUS_LABEL[o.status]}`,`大戶持股：${STATUS_LABEL[h.status]}（依集保資料判讀，不把大戶直接叫做內資）`,`法人買盤：${STATUS_LABEL[c.status]}`,"",`主要成交密集區：${p.status==="pass"?range(p.pocLower,p.pocUpper):p.label}`,`目前角色：${p.pocRole||"資料不足"}`,`拉回狀態：${p.pocRetestState||"資料不足"}`,`短線與突破檢查：${e.momentumBreakoutEvidence.summary}`,`主要加分證據：${e.strengths.join("、")||"目前資料不足"}`,`主要風險證據：${e.risks.join("、")||"目前沒有新增明確警訊"}`,`資料日期：${document.getElementById("saDates")?.textContent||"各欄位依上方標示"}`,"",`結論：${document.getElementById("saConclusion")?.textContent||"本模組只作輔助證據。"}`,"提醒：這是盤後資料，不是即時看盤；本模組屬輔助證據，仍須通過原有進場檢查。"].join("\n");
}

function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=2){const words=String(text||"").split("");let line="",lines=[];for(const ch of words){const t=line+ch;if(ctx.measureText(t).width>maxWidth&&line){lines.push(line);line=ch;if(lines.length===maxLines-1)break;}else line=t;}if(line&&lines.length<maxLines)lines.push(line);lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));}
function appendAssistantCanvasV47(base,e,industry=null){
  // R4.5：圖片版移除整個「少爺助理｜公司、法人」展示，只保留使用者指定的主要成交密集區。
  // 網頁、文字報告與底層公司／法人／大戶／產業資料不變；緊縮高度以利 iPhone 12 Pro Max 單頁滿版。
  if(!e)return base;const extra=138,out=document.createElement("canvas");out.width=base.width;out.height=base.height+extra;const c=out.getContext("2d");c.drawImage(base,0,0);c.fillStyle="#eef3f8";c.fillRect(0,base.height,out.width,extra);
  const p=e.anchoredVolumeProfileEvidence,y=base.height+10;c.fillStyle="#fff";c.strokeStyle="#b9cadd";c.lineWidth=2;c.beginPath();c.roundRect(36,y,out.width-72,116,14);c.fill();c.stroke();c.fillStyle="#153a67";c.font="950 24px 'Noto Sans TC','Microsoft JhengHei',sans-serif";c.fillText(`📍 主要成交密集區（估算）：${p.status==="pass"?range(p.pocLower,p.pocUpper):p.label}`,56,y+34);c.fillStyle="#34445a";c.font="850 18px 'Noto Sans TC','Microsoft JhengHei',sans-serif";wrapCanvasText(c,`${p.pocRole||"資料不足"}｜${p.pocRetestState||"資料不足"}`,56,y+66,out.width-112,23,1);c.font="800 15px 'Noto Sans TC','Microsoft JhengHei',sans-serif";c.fillStyle="#657286";wrapCanvasText(c,`資料 ${p.anchorStartDate||"-"}～${p.anchorEndDate||"-"}｜48格價格區估算，不是逐筆成交分布`,56,y+94,out.width-112,20,1);
  out.dataset.reportMode=base.dataset.reportMode||"";out.dataset.language=base.dataset.language||"plain-zh-TW";out.dataset.snrAudit=base.dataset.snrAudit||"";out.dataset.layoutAudit=base.dataset.layoutAudit||"";out.dataset.r45AssistantAppendHeight=String(extra);out.dataset.r45ImageBlocksRemoved="assistant-heading,company-card,capital-card,holder-card,industry-panel,strength-risk-panel";out.dataset.r45ImageBlocksKept="major-volume-zone";return out;
}

const originalBuild=window.buildReportText;
if(typeof originalBuild==="function")window.buildReportText=function(report){return `${originalBuild(report)}${buildAssistantText(report?.shitoAssistantEvidence)}`;};
const originalGenerator=window.generateStockImageByModeV51;
if(typeof originalGenerator==="function")window.generateStockImageByModeV51=async function(mode="beginner",withWatermark=false){
  const professional=mode==="professional",buttonId=professional?(withWatermark?"generateStockProfessionalWatermarkImageButton":"generateStockProfessionalImageButton"):(withWatermark?"generateStockBeginnerWatermarkImageButton":"generateStockBeginnerImageButton"),button=document.getElementById(buttonId),message=document.getElementById("copyMessage");
  const report=typeof lastReportData!=="undefined"?lastReportData:null;
  if(!report){if(message)message.textContent="請先完成個股分析，再生成圖片報告。";return;}
  const old=button?.textContent||"";if(button){button.disabled=true;button.textContent="圖片產生中…";}
try{if(document.fonts?.ready)await document.fonts.ready;const base=professional?window.renderStockProfessionalInfographicV51(report):window.renderStockInfographicV46(report);let canvas=appendAssistantCanvasV47(base,report.shitoAssistantEvidence,report.industryContext);if(withWatermark&&typeof window.applyAntiTheftWatermarkV3761==="function")window.applyAntiTheftWatermarkV3761(canvas,"stock");const d=String(report.closeDate||"").replace(/\D/g,"").slice(0,8)||"latest",filename=window.sanitizeFilenameV3328(`石頭少爺_${report.name||report.code}_${report.code}_${professional?"專業":"新手"}個股圖片報告_${d}_V50_R5.3.2.5.6.3.1_圖片統一排版完整版.png`);await window.showInfographicPreviewV3328(canvas,filename,`${window.formatStockNameWithCode(report.name,report.code)}｜個股盤後報告`);const note=document.getElementById("imagePreviewNote");if(note)note.textContent=`${professional?"專業完整":"新手簡易"}版為 ${canvas.width}×${canvas.height}；圖片已移除公司／法人助理區，只保留主要成交密集區。`;if(message)message.textContent="✅ 圖片報告已產生；公司／法人助理區已移除，主要成交密集區保留。";}catch(err){console.error(err);if(message)message.textContent=`❌ 圖片產生失敗：${err?.message||"未知錯誤"}`;}finally{if(button){button.disabled=false;button.textContent=old;}}
};

window.SHITO_ASSISTANT_RULES_V1=SHITO_ASSISTANT_RULES_V1;
window.anchoredVolumeProfileEvidence=anchoredVolumeProfileEvidence;
window.operatingGateEvidence=operatingGateEvidence;
window.holderGateEvidence=holderGateEvidence;
window.capitalGateEvidence=capitalGateEvidence;
window.momentumBreakoutEvidence=momentumBreakoutEvidence;
window.buildShitoAssistantEvidence=buildShitoAssistantEvidence;
window.loadShitoAssistantEvidenceV47=loadShitoAssistantEvidenceV47;
window.ShitoAssistantV47={rules:SHITO_ASSISTANT_RULES_V1,anchoredVolumeProfileEvidence,operatingGateEvidence,holderGateEvidence,capitalGateEvidence,momentumBreakoutEvidence,buildShitoAssistantEvidence,summaryText,appendCanvas:appendAssistantCanvasV47};
})();
