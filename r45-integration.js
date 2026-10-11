/* V50 R5.3.2.5.6.3.1: 教材證據與明日開盤白話判讀；正式 Gate、分數與排名不變。 */
(function(){
'use strict';

const RELEASE=window.ShitouReleaseV50.release;
const FILE_VERSION=window.ShitouReleaseV50.fileVersion;
const E=window.ShitouTechnicalEvidenceR45;
window.R45_RELEASE_LABEL=RELEASE;
window.R45_FILE_VERSION=FILE_VERSION;

function activeText(value){
  return String(value??'')
    .replaceAll('石頭少爺 Agent V47 正式版｜R5.3.2.4.13-R4.4 五本教材策略保留｜雙選股圖片字體自適應優化版',RELEASE)
    .replaceAll('V47_R5.3.2.4.13-R4.4_五本教材策略保留_雙選股圖片字體自適應優化版',FILE_VERSION)
    .replaceAll('石頭少爺 Agent V47 正式版｜R5.3.2.4.12 顯示與共用狀態一致性收尾版',RELEASE)
    .replaceAll('V47_R5.3.2.4.12_顯示與共用狀態一致性收尾版',FILE_VERSION)
    .replace(/R5\.3\.2\.4\.13-R4\.4/g,'R5.3.2.4.30-R4.9.5')
    .replaceAll('石頭少爺 Agent V49 正式版｜R5.3.2.4.28-R4.9.3｜主升中文名稱＋個股圖片版面安全修正版',RELEASE)
    .replaceAll('V49_R5.3.2.4.28-R4.9.3_主升中文名稱_個股圖片版面安全修正版',FILE_VERSION);
}
window.r45ActiveText=activeText;

document.documentElement.dataset.releaseVersion=RELEASE;
document.documentElement.dataset.r45Candidate='true';
document.title=RELEASE;
document.querySelectorAll('.version-pill,footer strong').forEach(element=>{
  if(/石頭少爺 Agent V47/.test(element.textContent||'')){
    element.textContent=RELEASE+(element.classList.contains('version-pill')?'｜盤後資料｜原始策略不變':'');
  }
});
document.querySelectorAll('.meta,strong').forEach(element=>{
  if(/石頭少爺 Agent V47 (?:正式版|研究候選版)/.test(element.textContent||''))element.textContent=activeText(element.textContent);
});

const style=document.createElement('style');
style.textContent=`
.technical-evidence-r45{margin:14px 0;padding:16px;border:1px solid #b9c9da;border-left:6px solid #245b91;border-radius:14px;background:#f7fbff;color:#17324d}
.technical-evidence-r45 h3{margin:0 0 10px;font-size:clamp(1.05rem,2.6vw,1.3rem);line-height:1.45}
.technical-evidence-r45 p{margin:7px 0;line-height:1.7;font-weight:650}
.technical-date-r45{color:#53657a;font-size:.92rem}
.technical-price-grid-r45{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:10px}
.technical-price-r45{padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #d8e2ed;display:flex;gap:8px;justify-content:space-between;align-items:center}
.technical-price-r45 strong{font-size:1.08rem;color:#123d68;overflow-wrap:anywhere}
.r45-candidate-banner{margin:10px 0;padding:12px 14px;border-radius:12px;background:#fff8df;border:1px solid #e7cf80;color:#715300;font-weight:800;line-height:1.6}
.r45-preview-actions{display:flex;flex-wrap:wrap;gap:8px;margin-left:8px}
.r45-preview-actions button{min-height:44px;padding:8px 13px;border:1px solid #b9c7d8;border-radius:9px;background:#fff;color:#173a61;font-weight:800;cursor:pointer}
@media(max-width:520px){.technical-evidence-r45{padding:13px}.technical-price-grid-r45{grid-template-columns:1fr}.r45-preview-actions{width:100%;margin:8px 0 0}}
`;
document.head.append(style);

function createPanel(evidence,title,prices=[]){
  const panel=document.createElement('section');
  panel.className='technical-evidence-r45';
  panel.dataset.evidenceMode='supplementary-only';
  const heading=document.createElement('h3');
  heading.textContent=`${title}｜EMA／KD補充證據（不計分、不改原判讀）`;
  panel.append(heading);
  const lines=E?E.plain(evidence):['⚠️ 新增技術證據模組未載入；原有報告仍可使用。'];
  for(const text of lines){const p=document.createElement('p');p.textContent=text;panel.append(p);}
  const date=document.createElement('p');date.className='technical-date-r45';
  date.textContent=evidence?.available?`📅 技術證據使用日：${evidence.dataQuality.dataDate}｜已完成日K ${evidence.dataQuality.bars} 根｜盤後參考`:'⚠️ 本項證據未取得；原有結果不受影響。';
  panel.append(date);
  const valid=prices.filter(item=>Number.isFinite(Number(item.value))&&Number(item.value)>0);
  if(valid.length){
    const grid=document.createElement('div');grid.className='technical-price-grid-r45';
    for(const item of valid){
      const card=document.createElement('div');card.className='technical-price-r45';
      const label=document.createElement('span');label.textContent=item.label;
      const strong=document.createElement('strong');strong.textContent=`${E.price(item.value)}${item.unit||' 元'}`;
      card.append(label,strong);grid.append(card);
    }
    panel.append(grid);
  }
  return panel;
}

function insertPanel(rootId,evidence,title,prices=[]){
  const root=document.getElementById(rootId);if(!root)return;
  root.querySelectorAll(':scope > .technical-evidence-r45').forEach(element=>element.remove());
  root.append(createPanel(evidence,title,prices));
}

function stockUi(report){
  if(!report||!E)return;
  insertPanel('result',E.analyze(report,{kind:'stock'}),'個股趨勢',[
    {label:'🔴 原始最新收盤',value:report.close},{label:'👀 ABC的B點',value:report.fib?.B},
    {label:'🛡️ 原有20日均線',value:report.structure?.ma20??report.dailyMa20??report.ma20}
  ]);
}

function marketUi(report){
  if(!report||!E)return;
  insertPanel('marketResult',E.analyze(report,{kind:'market'}),'大盤趨勢',[
    {label:'📍 最近收盤',value:report.close,unit:' 點'},{label:'👀 ABC的B點',value:report.fib?.B,unit:' 點'},
    {label:'🛡️ 原有20日均線',value:report.ma20,unit:' 點'}
  ]);
}

function candidateEvidence(candidate,kind){
  const report=candidate?.report||{};
  const evidence=E?E.analyze(report,{kind}):null;
  const rsi=E?.rsi5(report,report?.closeDate);
  const phase=E?.existingPhase({...report,stageSafety:candidate?.stageSafety,stage:candidate?.stage});
  return {evidence,rsi,phase};
}

function scanUi(scan,rootId,kind){
  const root=document.getElementById(rootId);if(!root||!Array.isArray(scan?.candidates)||!E)return;
  const cards=[...root.querySelectorAll('.momentum-card')];
  cards.forEach((card,index)=>{
    card.querySelectorAll('.technical-evidence-r45').forEach(element=>element.remove());
    const candidate=scan.candidates[index];if(!candidate)return;
    const {evidence}=candidateEvidence(candidate,kind);
    const panel=createPanel(evidence,kind==='momentum'?'主升附加證據':'當沖附加證據');
    card.append(panel);
  });
}

function appendTechnicalText(text,block){
  if(typeof text!=='string'||!text.trim())return text;
  if(text.includes('【R4.5 EMA／KD補充證據｜不改原分數與進場限制】'))return activeText(text);
  const addition=`\n\n【R4.5 EMA／KD補充證據｜不改原分數與進場限制】\n${block}\n`;
  const marker=/^(?:完整結尾標記：)?END-OF-(?:MOMENTUM|DAYTRADE)-[^\n]*$/m;
  if(marker.test(text))return activeText(text.replace(marker,value=>addition+'\n'+value));
  const disclaimer='技術分析僅供研究與決策參考，不構成投資建議。';
  const index=text.lastIndexOf(disclaimer);
  return activeText(index>=0?text.slice(0,index)+addition+'\n'+text.slice(index):text+addition);
}

function singleText(report,kind){
  if(!E)return '新增證據模組未載入；原報告保持不變。';
  return E.plain(E.analyze(report||{},{kind})).join('\n');
}

function scanText(scan,kind){
  const candidates=Array.isArray(scan?.candidates)?scan.candidates:[];
  if(!candidates.length)return '本次沒有原始入列股票，沒有逐檔EMA／KD補充資料。';
  return candidates.map((candidate,index)=>{
    const report=candidate?.report||{};
    const code=report.stock||report.code||'代號不明';
    const name=report.name||candidate.name||'';
    const evidence=E.analyze({...report,stageSafety:candidate?.stageSafety??report?.stageSafety,stage:candidate?.stage??report?.stage},{kind});
    return `${index+1}. ${name}（${code}）\n${E.plain(evidence).join('\n')}`;
  }).join('\n\n');
}

function wrapSync(name,after){
  const original=window[name];if(typeof original!=='function')return;
  window[name]=function(...args){const result=original.apply(this,args);try{after(args[0],result);}catch(error){console.warn(`${name} R4.5顯示層未完成`,error);}return result;};
}

function wrapAsyncAnalyze(){
  const original=window.analyzeStock;if(typeof original!=='function')return;
  window.analyzeStock=async function(...args){
    const result=await original.apply(this,args);
    try{if(typeof lastReportData!=='undefined')stockUi(lastReportData);}catch(error){console.warn('個股技術證據顯示失敗',error);}
    return result;
  };
}

function wrapText(name,makeBlock){
  const original=window[name];if(typeof original!=='function')return;
  window[name]=function(...args){return appendTechnicalText(original.apply(this,args),makeBlock(args[0]));};
}

wrapAsyncAnalyze();
wrapSync('renderMarketWorkerData',marketUi);
wrapSync('renderMomentumScanResultV3765',scan=>scanUi(scan,'momentumList','momentum'));
wrapSync('renderDayTradeScanResultV1',scan=>scanUi(scan,'dayTradeList','daytrade'));
wrapText('buildReportText',report=>singleText(report,'stock'));
wrapText('buildMarketWorkerReportText',report=>singleText(report,'market'));
wrapText('buildMomentumScanTextReportV3763',scan=>scanText(scan,'momentum'));
wrapText('buildMomentumScanCompactTextReportV377713',scan=>scanText(scan,'momentum'));
wrapText('buildDayTradeTextReportV1',scan=>scanText(scan,'daytrade'));

const candidateBanner=document.createElement('div');
candidateBanner.className='r45-candidate-banner';
candidateBanner.textContent='📚 R4.9.5 教材證據＋明日開盤白話判讀：直接顯示可優先觀察／先等確認／不適合進場；不改原正式 Gate、分數或排名。';
const main=document.querySelector('main');if(main)main.prepend(candidateBanner);

window.SHITO_R45_UI_AUDIT={
  installed:true,release:RELEASE,mode:'SUPPLEMENTARY_ONLY',noOriginalRankChange:true,
  noWorkerChange:true,noScoreChange:true,noQualificationChange:true
};
})();
