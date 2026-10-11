/* V49 共同白話顯示層：量價波段＋費波回撤量尺，接到個股／大盤／主升／當沖文字與圖片；不改既有資料來源與原硬性風控。 */
(function(root){'use strict';
const W=root.ShitouWaveCoreV48;if(!W)return;
const RELEASE=W.RELEASE||'石頭少爺 Agent V50 正式版｜R5.3.2.7｜三盤量價與個股報告優化版';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function analyze(x){return W.analyzeReport(x?.report||x);}
function fibShort(a){const f=a?.fib;if(!f?.ok)return '📏 波段量尺：資料不足，不硬算';const pos=f.inRange&&f.band?`📍${f.band.label} 約 ${f.band.low.toFixed(2)}～${f.band.high.toFixed(2)}`:`📍${f.positionText||'已離開0%～100%回撤區'}`;return `📏 ${f.directionText} ${f.ratioText}｜${f.zone.label}｜${pos}｜${f.priceConfirm?'✅已有價格確認':'🟡仍等價格確認'}`;}
function compact(a){if(!a?.ok)return '量價波段資料不足';const g=W.grade(a);return `${g.label}｜${a.phaseLabel}｜${a.threeBreakout?'✅三盤突破':a.threeBreakdown?'⚠️三盤跌破':'三盤未轉折'}｜${fibShort(a)}`;}
function prependOnce(text,block,key='【📚 新版量價波段判讀】'){const s=String(text||'');return s.includes(key)?s:`${block}\n\n${s}`;}
function candidateDisplayName(c){if(typeof root.momentumSafeStockNameV377712==='function')return root.momentumSafeStockNameV377712(c);return c?.name||c?.report?.name||c?.report?.stock||c?.code||'-';}
function multiBlock(scan,title){const list=(scan?.candidates||[]).slice(0,8);if(!list.length)return `【📚 ${title}】\n目前沒有可分析候選。`;return `【📚 ${title}】\n${list.map((c,i)=>{const a=analyze(c);return `${i+1}. ${candidateDisplayName(c)}｜${compact(a)}${a?.risk?.length?`｜⚠️ ${a.risk.slice(0,2).join('、')}`:''}`;}).join('\n')}\n白話規則：先看三盤、價格三線和量能三線，再用費波回撤量「這一波吐回多少」。比例只是一個區域量尺，不是碰到61.8%就會反彈；最後仍要等價格與成交量確認。`;}
function cardHtml(a,title='📚 新版量價波段＋回撤量尺'){
 if(!a?.ok)return `<div class="rule wave-v49-card"><strong>${title}</strong><br>資料不足，保留原系統判讀，不硬補結論。</div>`;
 const g=W.grade(a),f=a.fib;const fibPos=f?.inRange&&f?.band?`<strong>📍 目前觀察帶：</strong>${esc(f.band.label)}，約 <b>${f.band.low.toFixed(2)}～${f.band.high.toFixed(2)}</b>`:`<strong>📍 目前位置：</strong>${esc(f?.positionText||'已離開0%～100%回撤區')}`;const fib=f?.ok?`<div class="wave-fib-line"><strong>📏 波段量尺：</strong>${esc(f.directionText)} ${esc(f.ratioText)}｜<strong>${esc(f.zone.label)}</strong><br>${fibPos}｜${f.priceConfirm?'✅ 已有價格確認':'🟡 仍要等價格確認'}<br><span class="wave-note">${f.inRange?'比例只描述回吐／回補幅度，不是精準反轉點。':'已越過波段端點，不再硬套23.6%～100%回撤區。'}</span></div>`:'<div class="wave-fib-line"><strong>📏 波段量尺：</strong>找不到已確認完整波段，這一層不硬算。</div>';
 return `<div class="rule wave-v49-card" style="border-left:6px solid ${g.key==='S'?'#1f7a4f':g.key==='A'?'#24628a':g.key==='REJECT'?'#b52a34':'#a66e1e'}"><strong>${title}｜${esc(g.label)}｜${esc(a.phaseLabel)}</strong><br><span>${esc(a.plain)}</span><div class="wave-price-row"><b>🎯 觀察價 ${a.trigger.toFixed(2)}</b><b>🛡️ 防守參考 ${a.support.toFixed(2)}</b></div><span class="meta"><strong>價格三線：</strong>${esc(a.maText)}<br><strong>量能三線：</strong>${esc(a.mvText)}<br>${a.threeBreakout?'✅ 三盤突破':a.threeBreakdown?'⚠️ 三盤跌破':'三盤尚未轉折'}</span>${fib}${a.risk.length?`<div class="wave-risk"><strong>⚠️ 風險：</strong>${esc(a.risk.join('、'))}</div>`:''}</div>`;
}
function ensureStyle(){if(document.getElementById('waveV49Style'))return;const s=document.createElement('style');s.id='waveV49Style';s.textContent=`
.wave-v49-card{margin:12px 0;padding:15px 16px;line-height:1.75;background:linear-gradient(145deg,#fff,#f4f8fb);border-radius:12px;overflow-wrap:anywhere}.wave-v49-card>strong{font-size:1.08rem}.wave-v49-card .meta{display:block;margin-top:8px}.wave-price-row{display:flex;gap:10px;flex-wrap:wrap;margin:9px 0}.wave-price-row b{background:#eef6ff;border:1px solid #bad1e6;border-radius:9px;padding:7px 10px;font-size:1.02rem}.wave-fib-line{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff8e6;border:1px solid #edd08c}.wave-fib-line b{font-size:1.04rem}.wave-note{font-size:.92rem;color:#6b7280;font-weight:700}.wave-risk{margin-top:8px;color:#9f2733;font-weight:800}@media(max-width:600px){.wave-v49-card{padding:14px}.wave-price-row b{font-size:.98rem}}`;document.head.appendChild(s);}ensureStyle();
function applyRelease(){document.title=RELEASE;document.documentElement.dataset.releaseVersion=RELEASE;document.querySelectorAll('.version-pill,footer strong').forEach(el=>{el.textContent=RELEASE+(el.classList?.contains('version-pill')?'｜盤後資料｜比例是量尺，不是反轉保證':'');});}applyRelease();
// 個股文字與介面
if(typeof root.buildReportText==='function'){const old=root.buildReportText;root.buildReportText=function(report){const a=W.analyzeReport(report);return prependOnce(old(report),W.textBlock(a,'📚 新版量價波段＋回撤量尺'),'【📚 新版量價波段＋回撤量尺】');};}
if(typeof root.renderBeginnerCommandCenterV46==='function'){const old=root.renderBeginnerCommandCenterV46;root.renderBeginnerCommandCenterV46=function(report){const out=old(report);let box=document.getElementById('waveStockCardV49');if(!box){box=document.createElement('div');box.id='waveStockCardV49';const target=document.getElementById('stockStageCardV53245')||document.getElementById('beginnerCommandCenterV46');target?.insertAdjacentElement('afterend',box);}if(box)box.innerHTML=cardHtml(W.analyzeReport(report),'📚 個股量價波段＋回撤量尺｜新手先看');return out;};}
// 大盤文字與介面；資料不足時明確保留原大盤核心，不把個股規則硬套到指數。
if(typeof root.buildMarketWorkerReportText==='function'){const old=root.buildMarketWorkerReportText;root.buildMarketWorkerReportText=function(data){const a=W.analyzeReport(data);const block=a.ok?W.textBlock(a,'📚 大盤量價波段＋回撤量尺'):'【📚 大盤量價波段＋回撤量尺】\n大盤回傳資料未含足夠60根完整日K，本區不硬算8／21／55、5／13／34與回撤比例，沿用原大盤環境判讀。';return prependOnce(old(data),block,'【📚 大盤量價波段＋回撤量尺】');};}
if(typeof root.renderMarketWorkerData==='function'){const old=root.renderMarketWorkerData;root.renderMarketWorkerData=function(data){const out=old(data);const a=W.analyzeReport(data);let box=document.getElementById('waveMarketCardV49');if(!box){box=document.createElement('div');box.id='waveMarketCardV49';const target=document.getElementById('marketStageCardV53245')||document.getElementById('marketStatusBox');target?.insertAdjacentElement('afterend',box);}if(box)box.innerHTML=a.ok?cardHtml(a,'📚 大盤量價波段＋回撤量尺｜白話'):'<div class="rule wave-v49-card"><strong>📚 大盤量價波段＋回撤量尺</strong><br>目前大盤歷史資料不足，沿用原本大盤判讀，不硬補均線、量潮或費波數字。</div>';return out;};}
// 主升／當沖文字同步加入回撤位置，不取代原本硬性Gate。
for(const name of ['buildMomentumScanTextReportV3763','buildMomentumScanCompactTextReportV377713']){if(typeof root[name]==='function'){const old=root[name];root[name]=function(scan){return prependOnce(old(scan),multiBlock(scan,'主升候選｜量價＋回撤位置二次確認'),'【📚 主升候選｜量價＋回撤位置二次確認】');};}}
if(typeof root.buildDayTradeTextReportV1==='function'){const old=root.buildDayTradeTextReportV1;root.buildDayTradeTextReportV1=function(scan){return prependOnce(old(scan),multiBlock(scan,'明日當沖｜量價＋回撤位置二次確認'),'【📚 明日當沖｜量價＋回撤位置二次確認】');};}
function scanUi(scan,rootId,id,title){const host=document.getElementById(rootId);if(!host)return;let box=document.getElementById(id);if(!box){box=document.createElement('div');box.id=id;host.prepend(box);}const list=(scan?.candidates||[]).slice(0,3);box.innerHTML=`<div class="rule wave-v49-card"><strong>📚 ${title}</strong><br>${list.length?list.map((c,i)=>`${i+1}. ${esc(candidateDisplayName(c))}｜${esc(compact(analyze(c)))}`).join('<br>'):'目前沒有候選可做量價與回撤位置確認。'}<br><span class="meta">這一層先確認「突破有沒有量、價格線有沒有助漲」，再用回撤比例量目前位置；比例不是買點，也不把條件分當成勝率。</span></div>`;}
if(typeof root.renderMomentumScanResultV3765==='function'){const old=root.renderMomentumScanResultV3765;root.renderMomentumScanResultV3765=function(scan){const out=old(scan);scanUi(scan,'momentumList','waveMomentumCardV49','主升段｜量價＋回撤位置確認');return out;};}
if(typeof root.renderDayTradeScanResultV1==='function'){const old=root.renderDayTradeScanResultV1;root.renderDayTradeScanResultV1=function(scan){const out=old(scan);scanUi(scan,'dayTradeList','waveDayTradeCardV49','當沖｜盤後量價＋回撤位置確認');return out;};}
// 明確轉弱保護維持：三盤跌破＋跌到21日線下＋21日線下彎時，不列正式順位；Fib不單獨當淘汰理由。
function severeWaveWeak(c){const a=analyze(c);return !!(a?.ok&&a.threeBreakdown&&a.close<a.ma21&&a.maSlope?.ma21<0);}
if(typeof root.applyMomentumLifecycleFilterV53247==='function'){const old=root.applyMomentumLifecycleFilterV53247;root.applyMomentumLifecycleFilterV53247=function(scan){if(Array.isArray(scan?.candidates))for(const c of scan.candidates){const a=analyze(c);c.waveV49=a;if(severeWaveWeak(c)){c.formalLaunchEligible=false;c.warnings=[...(c.warnings||[]),'新版量價保護：三盤跌破＋跌破強弱分界線且分界線下彎，不列正式主升順位'];}}return old(scan);};}
if(typeof root.dayTradeFormalRankEligibleV53249==='function'){const old=root.dayTradeFormalRankEligibleV53249;root.dayTradeFormalRankEligibleV53249=function(c){return old(c)&&!severeWaveWeak(c);};}
// 排名只在原排序完全相同時才用新版狀態做次順位；Fib只是量尺位置的最後一層 tie-break，不改原分數與原硬性資格。
function waveRank(c){const a=analyze(c),g=W.grade(a);return (({S:0,A:1,B:2,WATCH:3,REJECT:9,DATA:8}[g.key]??5)*100)-(a?.score||0)+(a?.fibTieRank||0)*.01;}
if(typeof root.momentumLaunchCompareV37617==='function'){const old=root.momentumLaunchCompareV37617;root.momentumLaunchCompareV37617=function(a,b){const base=old(a,b);if(base!==0)return base;return waveRank(a)-waveRank(b);};}
if(typeof root.dayTradeCompareV1==='function'){const old=root.dayTradeCompareV1;root.dayTradeCompareV1=function(a,b){const base=old(a,b);if(base!==0)return base;return waveRank(a)-waveRank(b);};}
// 圖片使用獨立安全插卡：只放短句，不把長說明壓到K線。完整說明留在文字區。
function stageFromWave(a){
 const g=W.grade(a),f=a?.fib;
 const keyPrice=a?.ok?`🎯${Number(a.trigger).toFixed(2)}｜🛡️${Number(a.support).toFixed(2)}`:'';
 const fib=f?.ok?`📏${f.directionText} ${f.ratioText}・${f.zone.label}・${f.inRange&&f.band?f.band.label:(f.positionText||'已離開回撤區')}`:'📏波段量尺資料不足';
 const headline=[keyPrice,fib].filter(Boolean).join('｜');
 return {key:`WAVE_${g.key}`,label:`${g.key==='S'?'🟢':g.key==='A'?'🔵':g.key==='REJECT'?'🔴':'🟡'} ${g.label}｜${a?.phaseLabel||'待確認'}`,headline,plainText:headline,colorRole:g.key==='S'?'early':g.key==='A'?'main':g.key==='REJECT'?'late':'unknown'};
}
function insert(base,a,title){
 if(typeof root.insertStageCanvasCardV53245!=='function')return base;
 const stage=a?.ok?stageFromWave(a):{key:'WAVE_DATA',label:'⚪ 資料不足｜沿用原判讀',headline:'這一層不硬算價格三線、量能三線或回撤比例。',plainText:'這一層不硬算價格三線、量能三線或回撤比例。',colorRole:'unknown'};
 let insertY=Math.min(210,Math.max(110,Math.round(base.height*.055)));
 try{
  const audit=base?.dataset?.layoutAudit?JSON.parse(decodeURIComponent(base.dataset.layoutAudit)):null;
  const cards=Array.isArray(audit?.stageCards)?audit.stageCards:[];
  if(cards.length){
   const last=cards[cards.length-1];
   const stacked=Number(last?.insertY)+Number(last?.height);
   if(Number.isFinite(stacked))insertY=Math.max(insertY,Math.round(stacked));
  }
 }catch(_){/* keep fallback */}
 insertY=Math.max(0,Math.min(base.height-154,insertY));
 return root.insertStageCanvasCardV53245(base,stage,title,insertY,154);
}
for(const name of ['renderStockInfographicV46','renderStockProfessionalInfographicV51']){if(typeof root[name]==='function'){const old=root[name];root[name]=function(report){return insert(old(report),W.analyzeReport(report),'📚 量價波段＋回撤量尺');};}}
if(typeof root.renderMarketInfographicV3328==='function'){const old=root.renderMarketInfographicV3328;root.renderMarketInfographicV3328=function(data){return insert(old(data),W.analyzeReport(data),'📚 大盤量價＋回撤量尺');};}
root.SHITOU_WAVE_V48_ACCEPTANCE={model:W.MODEL,release:RELEASE,loaded:true,plainChinese:true,fibAsRuler:true,fibNotReversalPromise:true,strongFilterReplaced:true,existingHardGatesPreserved:true};
})(window);
