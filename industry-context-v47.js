/* 石頭少爺 Agent V47 R5.3.2｜產業輪動與兩種名單同時出現證據層 */
(function(){
"use strict";
const SHITO_INDUSTRY_CONTEXT_SCHEMA_V1="SHITO_INDUSTRY_CONTEXT_SCHEMA_V1";
const SHITO_INDUSTRY_CONTEXT_ACTIVE_VERSION_V53247="石頭少爺 Agent V47 正式版｜R5.3.2.4.12 顯示與共用狀態一致性收尾版";
const INDUSTRY_STORAGE_KEY="shito-industry-rotation-v1";
let resourcesPromise=null,capturedMarketBundle=null,currentRotation=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number=v=>{if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const median=xs=>{const a=xs.map(number).filter(v=>v!==null).sort((a,b)=>a-b);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const average=xs=>{const a=xs.map(number).filter(v=>v!==null);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;};
const fmt=(v,d=1)=>number(v)===null?"資料不足":number(v).toFixed(d).replace(/\.0$/,"");
const codeOf=c=>String(c?.report?.stock||c?.report?.code||c?.stock||c?.code||"").trim();
const candidateName=c=>String(c?.report?.name||c?.name||codeOf(c)||"-");

async function fetchJson(url){const r=await fetch(url,{cache:"no-store",headers:{Accept:"application/json"}});if(!r.ok)throw new Error(`${url} HTTP ${r.status}`);return r.json();}
async function loadResources(){
  if(resourcesPromise)return resourcesPromise;
  resourcesPromise=Promise.allSettled([
    fetchJson("./data/industry/SHITO_INDUSTRY_MAPPING_V1.json"),
    fetchJson("./data/industry/industry_snapshot.json")
  ]).then(([m,s])=>({mapping:m.status==="fulfilled"?m.value:{mappingVersion:"SHITO_INDUSTRY_MAPPING_V1",mappings:{}},snapshot:s.status==="fulfilled"?s.value:{members:{},industries:{},dataDate:null}}));
  return resourcesPromise;
}
function mappedMember(code,resources){
  const official=resources.snapshot?.members?.[code]||{},mapped=resources.mapping?.mappings?.[code]||{};
  return {code,name:official.name||code,market:official.market||null,industryCode:String(official.industryCode||""),industryName:official.industryName||"官方產業資料不足",subIndustryCode:mapped.primarySubIndustry?`SUB_${mapped.primarySubIndustry}`:null,subIndustryName:mapped.primarySubIndustry||null,primarySubIndustry:mapped.primarySubIndustry||null,secondaryTags:Array.isArray(mapped.secondaryTags)?mapped.secondaryTags:[],displayIndustry:mapped.primarySubIndustry||official.industryName||"產業資料不足",industryDataSource:official.industryDataSource||resources.snapshot?.source||"TWSE／TPEx官方盤後資料",industryMappingVersion:resources.mapping?.mappingVersion||"SHITO_INDUSTRY_MAPPING_V1",pct:number(official.pct),tradeValue:number(official.tradeValue),closePos:number(official.closePos)};
}
function scoreOf(c,type){return type==="main"?number(c?.launchScore??c?.score?.final??c?.score):number(c?.score?.final??c?.score);}
function candidateReturn(c,n){const rows=c?.report?.dailySeries;if(!Array.isArray(rows)||rows.length<=n)return null;const a=number(rows.at(-n-1)?.close),b=number(rows.at(-1)?.close);return a&&b?(b/a-1)*100:null;}
function buildIndustryRotation(mainCandidates=[],dayCandidates=[],resources){
  const main=Array.isArray(mainCandidates)?mainCandidates:[],day=Array.isArray(dayCandidates)?dayCandidates:[],mainCodes=new Set(main.map(codeOf)),dayCodes=new Set(day.map(codeOf)),selected=new Set([...mainCodes,...dayCodes]);
  const groups=new Map();
  for(const code of Object.keys(resources.snapshot?.members||{})){const member=mappedMember(code,resources),key=member.displayIndustry,g=groups.get(key)||{industryName:key,industryCode:member.subIndustryCode||member.industryCode,members:[]};g.members.push(member);groups.set(key,g);}
  const results=[];
  for(const g of groups.values()){
    const mainRows=main.filter(c=>mappedMember(codeOf(c),resources).displayIndustry===g.industryName),dayRows=day.filter(c=>mappedMember(codeOf(c),resources).displayIndustry===g.industryName),overlap=mainRows.filter(c=>dayCodes.has(codeOf(c))),unique=new Set([...mainRows.map(codeOf),...dayRows.map(codeOf)]),up=g.members.filter(x=>x.pct!==null&&x.pct>0).length,down=g.members.filter(x=>x.pct!==null&&x.pct<0).length,valid=g.members.filter(x=>x.pct!==null).length,upRatio=valid?up/valid:null,selectionRatio=g.members.length?unique.size/g.members.length:null;
    const mainScores=mainRows.map(x=>scoreOf(x,"main")),dayScores=dayRows.map(x=>scoreOf(x,"day")),r5=[...mainRows,...dayRows].map(x=>candidateReturn(x,5)),r20=[...mainRows,...dayRows].map(x=>candidateReturn(x,20)),industryMedian=median(g.members.map(x=>x.pct)),marketMedian=number(resources.snapshot?.marketMedianPct);
    let state="產業觀察",stateKey="observe";
    if(g.members.length<2){state="資料不足";stateKey="unavailable";}
    else if(mainRows.length>=2&&dayRows.length>=2&&overlap.length>=1&&upRatio!==null&&upRatio>=.5){state="產業轉強";stateKey="strengthening";}
    else if(unique.size>=2&&selectionRatio>=.05&&upRatio!==null&&upRatio>=.5){state="產業偏強";stateKey="strong";}
    else if(unique.size===0&&upRatio!==null&&upRatio<.35){state="產業降溫";stateKey="cooling";}
    const consensus=mainRows.length&&dayRows.length?(overlap.length?"同一檔同時入選兩種名單重疊":"主升段與短線同族群出現"):"尚未形成兩種名單同時出現";
    results.push({industryName:g.industryName,industryCode:g.industryCode,totalSample:g.members.length,mainWaveCount:mainRows.length,dayTradeCount:dayRows.length,overlapCount:overlap.length,selectedUniqueCount:unique.size,selectionRatio,averageOriginalScore:average([...mainScores,...dayScores]),medianOriginalScore:median([...mainScores,...dayScores]),todayNewCount:null,consecutiveDays:null,upCount:up,downCount:down,upRatio,averageReturn5d:average(r5),averageReturn20d:average(r20),relativeStrength:industryMedian!==null&&marketMedian!==null?industryMedian-marketMedian:null,medianReturn1d:industryMedian,averageTradeValueChange:null,institutionDirection:"資料不足，不計分",state,stateKey,consensusState:consensus,breadthState:upRatio===null?"資料不足":upRatio>=.6?"多數上漲":upRatio>=.45?"漲跌互見":"同產業上漲情況偏弱",dataDate:resources.snapshot?.dataDate||null,components:{rule:"不做一個看不懂的總分；直接顯示有幾檔入選、同產業總共有幾檔、上漲家數比例與近期表現。",absoluteSelected:unique.size,breadthRatio:selectionRatio,upRatio,medianReturn1d:industryMedian}});
  }
  const stateOrder={strengthening:4,strong:3,observe:2,cooling:1,unavailable:0};
  results.sort((a,b)=>(stateOrder[b.stateKey]-stateOrder[a.stateKey])||b.overlapCount-a.overlapCount||b.selectedUniqueCount-a.selectedUniqueCount||(b.selectionRatio||0)-(a.selectionRatio||0));
  const byIndustry=Object.fromEntries(results.map(x=>[x.industryName,x]));
  const attach=(c,type)=>{const m=mappedMember(codeOf(c),resources),g=byIndustry[m.displayIndustry]||null;c.industryContext={...m,dataTiming:"POST_CLOSE",role:"EVIDENCE_ONLY",industryState:g?.state||"資料不足",mainWaveCount:g?.mainWaveCount??null,dayTradeCount:g?.dayTradeCount??null,overlapCount:g?.overlapCount??null,selectionRatio:g?.selectionRatio??null,breadthState:g?.breadthState||"資料不足",relativeStrength:g?.relativeStrength??null,dataDate:g?.dataDate||resources.snapshot?.dataDate||null,sourceList:type};};
  main.forEach(c=>attach(c,"主升段"));day.forEach(c=>attach(c,"當沖"));
  const industrySelectionConsensus=results.filter(x=>x.mainWaveCount&&x.dayTradeCount).map(x=>({industryName:x.industryName,mainWaveCount:x.mainWaveCount,dayTradeCount:x.dayTradeCount,overlapCount:x.overlapCount,consensusState:x.consensusState,breadthState:x.breadthState,relativeStrength:x.relativeStrength,dataDate:x.dataDate}));
  return {schema:SHITO_INDUSTRY_CONTEXT_SCHEMA_V1,version:SHITO_INDUSTRY_CONTEXT_ACTIVE_VERSION_V53247,dataTiming:"POST_CLOSE",role:"EVIDENCE_ONLY",dataDate:resources.snapshot?.dataDate||null,industries:results,byIndustry,industrySelectionConsensus,mainHot:results.filter(x=>x.mainWaveCount).sort((a,b)=>b.mainWaveCount-a.mainWaveCount||b.selectionRatio-a.selectionRatio).slice(0,6),dayHot:results.filter(x=>x.dayTradeCount).sort((a,b)=>b.dayTradeCount-a.dayTradeCount||b.selectionRatio-a.selectionRatio).slice(0,6)};
}
function saveRotation(x){currentRotation=x;try{localStorage.setItem(INDUSTRY_STORAGE_KEY,JSON.stringify(x));}catch(_){} }
function readRotation(){if(currentRotation)return currentRotation;try{return JSON.parse(localStorage.getItem(INDUSTRY_STORAGE_KEY)||"null");}catch{return null;}}
function hotHtml(title,rows,type){return `<div class="ic-hot"><h3>${title}</h3>${rows.length?rows.map(x=>`<div><strong>${esc(x.industryName)}</strong><span>${type==="main"?`主升段 ${x.mainWaveCount}`:`當沖 ${x.dayTradeCount}`}｜${x.selectedUniqueCount}/${x.totalSample}（${fmt((x.selectionRatio||0)*100)}%）｜${esc(x.state)}</span></div>`).join(""):`<p>尚未執行這一種選股，沒有可統計的名單。</p>`}</div>`;}
function ensureRadar(targetId){const parent=document.querySelector(`#${targetId} > .panel`);if(!parent)return null;let root=parent.querySelector(".industry-radar-v47");if(!root){root=document.createElement("section");root.className="industry-radar-v47";root.innerHTML='<div class="ic-title">🧭 少爺助理｜同產業有沒有一起變強</div><div class="ic-radar-grid"></div><details><summary>查看同產業同時出現在兩種名單的情況</summary><div class="ic-consensus"></div></details><div class="ic-date"></div>';parent.insertBefore(root,parent.querySelector(".momentum-list")||parent.lastElementChild);}return root;}
function renderRadars(rotation){
  for(const [id] of [["momentumResult"],["dayTradeResult"]]){const root=ensureRadar(id);if(!root)continue;root.querySelector(".ic-radar-grid").innerHTML=hotHtml("今日主升段熱門產業",rotation.mainHot,"main")+hotHtml("今日短線熱門產業",rotation.dayHot,"day");root.querySelector(".ic-consensus").innerHTML=rotation.industrySelectionConsensus.length?rotation.industrySelectionConsensus.map(x=>`<p><strong>${esc(x.industryName)}</strong>｜主升段 ${x.mainWaveCount}｜當沖 ${x.dayTradeCount}｜同一檔同時入選兩種名單 ${x.overlapCount}｜${esc(x.consensusState)}｜${esc(x.breadthState)}</p>`).join(""):"目前尚未同時完成兩種選股，或沒有形成同一產業同時出現在主升段與當沖名單。";root.querySelector(".ic-date").textContent=`產業資料日：${rotation.dataDate||"資料不足"}｜不改原榜分數、排序與候選數。`;}
}
function candidateIndustryHtml(c){const x=c?.industryContext;if(!x)return '<div class="ic-candidate"><strong>產業資料：</strong>整理中</div>';return `<details class="ic-candidate"><summary><span class="ic-tag">${esc(x.displayIndustry)}</span><span class="ic-state" data-state="${esc(x.industryState)}">${esc(x.industryState)}</span></summary><div>官方產業：${esc(x.industryName)}${x.subIndustryName?`｜次產業：${esc(x.subIndustryName)}`:"｜次產業：未建立可信對照，不硬猜"}<br>同產業主升段：${x.mainWaveCount??"資料不足"}檔｜同產業當沖：${x.dayTradeCount??"資料不足"}檔｜同一檔同時入選兩種名單：${x.overlapCount??"資料不足"}檔<br>同產業上漲情況：${esc(x.breadthState)}<br><small>來源：${esc(x.industryDataSource)}｜對照版：${esc(x.industryMappingVersion)}</small></div></details>`;}
function renderIndividual(context){const root=document.getElementById("industryEtfContextV47");if(!root)return;root.hidden=false;document.getElementById("icIndustryName").textContent=context.displayIndustry;document.getElementById("icOfficialIndustry").textContent=context.industryName;document.getElementById("icSubIndustry").textContent=context.subIndustryName||"沒有可信對照，不硬猜";document.getElementById("icIndustryState").textContent=context.industryState;document.getElementById("icCounts").textContent=context.mainWaveCount===null?"尚未完成本次兩種選股，暫無同產業入選統計":`主升段 ${context.mainWaveCount}檔｜當沖 ${context.dayTradeCount}檔｜同一檔同時入選兩種名單 ${context.overlapCount}檔`;document.getElementById("icBreadth").textContent=`同產業上漲情況：${context.breadthState}｜和大盤相比：${context.relativeStrength===null?"資料不足":`${fmt(context.relativeStrength)}個百分點`}`;document.getElementById("icPlainConclusion").textContent=context.mainWaveCount===null?`目前可確認 ${context.displayIndustry} 的官方產業與盤後廣度，但尚未同時完成主升段、當沖兩種選股，所以不硬說已形成兩種名單同時出現。本股仍要看自己的ABC與原有進場檢查。`:`目前 ${context.displayIndustry} 有主升段 ${context.mainWaveCount} 檔、短線 ${context.dayTradeCount} 檔；這是族群背景，不會讓本股自動變成可進場。`;document.getElementById("icDataDate").textContent=`產業資料日：${context.dataDate||"資料不足"}｜盤後整理，不是即時看盤`;}
async function loadIndustryContextForStock(report,{isCurrent=()=>true}={}){const resources=await loadResources(),member=mappedMember(String(report?.code||report?.stock||""),resources),rotation=readRotation(),g=rotation?.byIndustry?.[member.displayIndustry]||null,context={...member,dataTiming:"POST_CLOSE",role:"EVIDENCE_ONLY",industryState:g?.state||"產業觀察",mainWaveCount:g?.mainWaveCount??null,dayTradeCount:g?.dayTradeCount??null,overlapCount:g?.overlapCount??null,breadthState:g?.breadthState||((resources.snapshot?.industries?.[member.industryName]?.upRatio??0)>=.6?"多數上漲":resources.snapshot?.industries?.[member.industryName]?.upRatio===null?"資料不足":"漲跌互見"),relativeStrength:g?.relativeStrength??null,dataDate:g?.dataDate||resources.snapshot?.dataDate||null};report.industryContext=context;if(isCurrent())renderIndividual(context);return context;}
async function enrichScans(){const resources=await loadResources(),main=typeof lastMomentumScanDataV3762!=="undefined"?(lastMomentumScanDataV3762?.candidates||[]):[],day=typeof lastDayTradeScanDataV1!=="undefined"?(lastDayTradeScanDataV1?.candidates||[]):[],rotation=buildIndustryRotation(main,day,resources);saveRotation(rotation);if(typeof lastMomentumScanDataV3762!=="undefined"&&lastMomentumScanDataV3762)lastMomentumScanDataV3762.industryContext=rotation;if(typeof lastDayTradeScanDataV1!=="undefined"&&lastDayTradeScanDataV1)lastDayTradeScanDataV1.industryContext=rotation;renderRadars(rotation);return rotation;}
function industryText(rotation,type){if(!rotation)return "";const rows=type==="main"?rotation.mainHot:rotation.dayHot;return ["","━━━━━━━━━━━━━━━━━━","【少爺助理｜同產業有沒有一起變強】","━━━━━━━━━━━━━━━━━━",`${type==="main"?"主升段":"當沖"}熱門產業：${rows.map(x=>`${x.industryName} ${type==="main"?x.mainWaveCount:x.dayTradeCount}檔（${fmt((x.selectionRatio||0)*100)}%）`).join("｜")||"尚無"}`,`同一產業同時出現在主升段與當沖名單：${rotation.industrySelectionConsensus.map(x=>`${x.industryName} 主升${x.mainWaveCount}／當沖${x.dayTradeCount}／重疊${x.overlapCount}`).join("｜")||"尚未形成"}`,`產業資料日：${rotation.dataDate||"資料不足"}`,"提醒：產業背景只作輔助，不會改變原榜排名、原分數或原有進場檢查。"].join("\n");}
function stockIndustryText(x){if(!x)return "";return ["","━━━━━━━━━━━━━━━━━━","【少爺助理｜同產業有沒有一起變強】","━━━━━━━━━━━━━━━━━━",`產業：${x.displayIndustry}`,`官方產業：${x.industryName}`,`次產業：${x.subIndustryName||"沒有可信對照，不硬猜"}`,`產業狀態：${x.industryState}`,`主升段同產業：${x.mainWaveCount??"資料不足"}｜當沖同產業：${x.dayTradeCount??"資料不足"}｜同一檔同時入選兩種名單：${x.overlapCount??"資料不足"}`,"產業背景只作輔助，實際進場仍須通過原有進場檢查。"].join("\n");}

function appendIndustryCanvasV47(base,rotation,type){
  if(!base||!rotation)return base;
  const rows=(type==="day"?rotation.dayHot:rotation.mainHot).slice(0,3),extra=165,out=document.createElement("canvas");out.width=base.width;out.height=base.height+extra;const c=out.getContext("2d");c.drawImage(base,0,0);c.fillStyle="#eef7f3";c.fillRect(0,base.height,out.width,extra);c.fillStyle="#174f43";c.font="900 22px sans-serif";c.fillText("少爺助理｜同產業有沒有一起變強",42,base.height+42);c.fillStyle="#34445a";c.font="750 17px sans-serif";c.fillText(`${type==="day"?"短線":"主升段"}熱門產業：${rows.map(x=>`${x.industryName} ${type==="day"?x.dayTradeCount:x.mainWaveCount}檔`).join("｜")||"尚無"}`,42,base.height+80);c.fillText(`同一產業同時出現在主升段與當沖名單：${rotation.industrySelectionConsensus.slice(0,3).map(x=>`${x.industryName}（重疊${x.overlapCount}）`).join("｜")||"尚未形成"}`,42,base.height+112);c.fillStyle="#657286";c.font="700 15px sans-serif";c.fillText(`產業資料日：${rotation.dataDate||"資料不足"}｜盤後整理，不是即時看盤；不改原分數、排名與進場檢查。`,42,base.height+145);
  for(const key of ["_momentumAllCandidatesAuditV377715","_dayTradeRenderedCodesV1"])if(base[key]!==undefined)out[key]=base[key];
  return out;
}

// R5.3.2.4.4｜主HTML已提供可停止、可重試且綁定交易日的 KEY_BROKERS 補充層。
// 產業模組不得再覆蓋券商查詢或顯示函式；券商資料仍只作補充，不改分數、排名與進場檢查。

if(typeof loadMomentumMarketBundleV377737==="function"){const base=loadMomentumMarketBundleV377737;loadMomentumMarketBundleV377737=async function(){capturedMarketBundle=await base();return capturedMarketBundle;};}
if(typeof loadDayTradeMarketBundleV377736==="function"){const base=loadDayTradeMarketBundleV377736;loadDayTradeMarketBundleV377736=async function(){capturedMarketBundle=await base();return capturedMarketBundle;};}
if(typeof momentumCardV37613==="function"){const base=momentumCardV37613;momentumCardV37613=function(c,i,mode){const div=base(c,i,mode);div?.insertAdjacentHTML("beforeend",candidateIndustryHtml(c));return div;};}
if(typeof renderDayTradeScanResultV1==="function"){const base=renderDayTradeScanResultV1;renderDayTradeScanResultV1=function(scan){base(scan);const root=document.getElementById("dayTradeList"),cards=Array.from(root?.children||[]).filter(x=>x.classList?.contains("momentum-card"));(scan?.candidates||[]).slice(0,cards.length).forEach((c,i)=>cards[i]?.insertAdjacentHTML("beforeend",candidateIndustryHtml(c)));if(scan?.industryContext)renderRadars(scan.industryContext);};}

const momentumCore=typeof runMomentumScanV3769==="function"?runMomentumScanV3769:null;
if(momentumCore)runMomentumScanV3769=async function(){await momentumCore();if(typeof momentumScanAbortV3762!=="undefined"&&momentumScanAbortV3762)return;const rotation=await enrichScans();if(typeof lastMomentumScanDataV3762!=="undefined"&&lastMomentumScanDataV3762)renderMomentumScanResultV3765(lastMomentumScanDataV3762);renderRadars(rotation);};
const dayCore=typeof runDayTradeScanV1==="function"?runDayTradeScanV1:null;
if(dayCore)runDayTradeScanV1=async function(){await dayCore();if(typeof dayTradeScanAbortV1!=="undefined"&&dayTradeScanAbortV1)return;const rotation=await enrichScans();if(typeof lastDayTradeScanDataV1!=="undefined"&&lastDayTradeScanDataV1)renderDayTradeScanResultV1(lastDayTradeScanDataV1);renderRadars(rotation);};

if(typeof buildMomentumScanTextReportV3763==="function"){const base=buildMomentumScanTextReportV3763;buildMomentumScanTextReportV3763=scan=>`${base(scan)}${industryText(scan?.industryContext||readRotation(),"main")}`;}
if(typeof buildDayTradeTextReportV1==="function"){const base=buildDayTradeTextReportV1;buildDayTradeTextReportV1=scan=>`${base(scan)}${industryText(scan?.industryContext||readRotation(),"day")}`;}
if(typeof buildReportText==="function"){const base=buildReportText;buildReportText=report=>`${base(report)}${stockIndustryText(report?.industryContext)}`;}
if(typeof renderMomentumScanInfographicV3762==="function"){const base=renderMomentumScanInfographicV3762;renderMomentumScanInfographicV3762=scan=>appendIndustryCanvasV47(base(scan),scan?.industryContext||readRotation(),"main");}
if(typeof buildMomentumAllCandidatesImageV377715==="function"){const base=buildMomentumAllCandidatesImageV377715;buildMomentumAllCandidatesImageV377715=scan=>appendIndustryCanvasV47(base(scan),scan?.industryContext||readRotation(),"main");}
if(typeof renderDayTradeInfographicV1==="function"){const base=renderDayTradeInfographicV1;renderDayTradeInfographicV1=scan=>appendIndustryCanvasV47(base(scan),scan?.industryContext||readRotation(),"day");}
if(typeof buildDayTradeAllCandidatesImageV1==="function"){const base=buildDayTradeAllCandidatesImageV1;buildDayTradeAllCandidatesImageV1=scan=>appendIndustryCanvasV47(base(scan),scan?.industryContext||readRotation(),"day");}
if(typeof window.loadShitoAssistantEvidenceV47==="function"){const base=window.loadShitoAssistantEvidenceV47;window.loadShitoAssistantEvidenceV47=async (report,options)=>{const e=await base(report,options);try{await loadIndustryContextForStock(report,options);}catch(err){console.warn("產業資料暫時無法載入：",err);}return e;};}

window.ShitoIndustryContextV47={version:SHITO_INDUSTRY_CONTEXT_ACTIVE_VERSION_V53247,dataTiming:"POST_CLOSE",role:"EVIDENCE_ONLY",schemas:{industry:SHITO_INDUSTRY_CONTEXT_SCHEMA_V1},mappedMember,buildIndustryRotation,loadIndustryContextForStock};
})();

