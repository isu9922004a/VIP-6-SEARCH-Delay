'use strict';
const $=id=>document.getElementById(id),M=ShitouIndependentMarket,F=ShitouForecastPreview,n=v=>String(+v.toFixed(2)),records=new Map(),models=new Map();
let state=null,reportSnapshot=null,backtest=null;
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function draw(a,forecast){const bars=a.input.bars,visible=bars.slice(-40),future=forecast?.daily||[],W=680,H=320,L=74,R=20,T=25,B=45,total=visible.length+Math.max(5,future.length),values=[...visible.map(b=>b.close),...future.flatMap(b=>[b.low,b.high])],lo=Math.min(...values)*.995,hi=Math.max(...values)*1.005,x=i=>L+i*(W-L-R)/(total-1),y=v=>T+(hi-v)/(hi-lo)*(H-T-B),ma=k=>visible.map((_,i)=>{const end=bars.length-40+i+1;return bars.slice(end-k,end).reduce((s,b)=>s+b.close,0)/k;}),path=(values,start=0)=>values.map((v,i)=>(i?'L':'M')+x(i+start)+','+y(v)).join(' ');
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="大盤指數歷史、均線與模型推演，單位為點">`;
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;svg+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#285369"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${n(v)}</text>`;}
 for(const [values,color] of [[visible.map(b=>b.close),'#91d8ff'],[ma(5),'#edcc77'],[ma(20),'#c4adf5']])svg+=`<path d="${path(values)}" fill="none" stroke="${color}" stroke-width="2"/>`;
 const cut=x(39);svg+=`<line x1="${cut}" y1="${T}" x2="${cut}" y2="${H-B}" stroke="#7799a9" stroke-dasharray="4 4"/>`;
 if(future.length){svg+=`<path d="M${cut},${y(visible.at(-1).close)} ${future.map((b,i)=>`L${x(40+i)},${y(b.median)}`).join(' ')}" fill="none" stroke="#79e4d1" stroke-width="2" stroke-dasharray="5 4"/>`;svg+=`<polygon points="${future.map((b,i)=>`${x(40+i)},${y(b.high)}`).concat([...future].reverse().map((b,i)=>`${x(39+future.length-i)},${y(b.low)}`)).join(' ')}" fill="#79e4d1" opacity=".15"/>`;}
 if(future.length===1){const b=future[0],xx=x(40);svg+=`<rect x="${xx-5}" y="${y(b.high)}" width="10" height="${Math.max(1,y(b.low)-y(b.high))}" fill="#79e4d1" opacity=".25"/><line x1="${xx}" y1="${y(b.high)}" x2="${xx}" y2="${y(b.low)}" stroke="#79e4d1"/><circle cx="${xx}" cy="${y(b.median)}" r="3" fill="#79e4d1"/>`;}
 svg+=`<text x="${L}" y="15">指數（點）</text><text x="${L}" y="${H-20}">${visible[0].date}</text><text x="${cut}" y="${H-20}" text-anchor="end">${a.date}</text><text x="${W-R}" y="${H-20}" text-anchor="end">未來</text><text x="${W/2}" y="${H-2}">交易日（日K）</text></svg>`;$('market-chart').innerHTML=svg;
}
function render(){const type=$('market-type').value,data=records.get(type),a=M.analyze(data);state=a;reportSnapshot=null;
 $('market-engulf-range').replaceChildren();if(a.state==='AVAILABLE')$('market-engulf-range').append(ShitouEngulfRangeReport.mount(document,a));
 $('market-levels').replaceChildren();$('market-observations').replaceChildren();
 if(a.state!=='AVAILABLE'){$('market-source').textContent='尚未載入'+(type==='TAIEX'?'加權指數':'櫃買指數')+'行情；使用獨立指數資料來源。';$('market-verdict').textContent='等待指數資料';$('market-plain').textContent=a.reason;$('market-next').textContent='下一交易日模型推斷：尚無結果。';$('market-chart').replaceChildren(element('p','尚無指數歷史，暫不畫線。','muted'));$('market-scenarios').textContent='指數資料尚未齊全，暫不填關卡。';$('market-evidence').textContent='等待同一指數的完成日K與來源。';return;}
 const f=F.evaluate(a.input,models.get(type)),r=ShitouMarketRegimeV86.analyze(a.input,f);a.regimeAnalysis=r;const observations=ShitouReportObservations.fromMarket(a.input);a.reportObservations=observations;if(observations.state==='AVAILABLE'){for(const text of ['漲跌力道：'+observations.momentum.text,observations.divergence?.text,...observations.levels.map(x=>x.text),observations.action?'明天先看：'+observations.action:null].filter(Boolean))$('market-observations').append(element('p',text));}reportSnapshot={analysis:a,forecast:f,backtest,source:{name:data.name||type,source:data.dailySeriesMeta.source}};$('market-source').textContent=(a.illustration?'獨立合成指數示意，非真實行情｜':'指數歷史｜')+`${data.name||type}｜截止 ${a.date}｜來源：${data.dailySeriesMeta.source}`;
 $('market-verdict').textContent=r.combinedState+'｜急跌風險：'+r.crashRisk.label;$('market-plain').textContent=r.summary;
 const runLabel=f.executionVerified?'Kronos實跑收據已核對':'Kronos歷史輸出／執行收據未核驗';
 $('market-next').textContent=f.state==='UNAVAILABLE'?'Kronos模型不可用：'+f.reason:`【${runLabel}｜${f.dates[0]}】原始${f.label}，${f.openingLabel}；收盤中位數 ${n(f.closing.median)} 點（${((f.closing.median/a.close-1)*100).toFixed(2)}%）。多 ${+(f.bullish*100).toFixed(1)}%／空 ${+(f.bearish*100).toFixed(1)}%／平 ${+(f.flat*100).toFixed(1)}%；${f.sampleCount}條取樣占比不是實際勝率。`;
 for(const l of r.levels){const c=element('div',undefined,'price-item');c.append(element('span',l.role),element('strong',n(l.price)+' 點'),element('span',l.note));$('market-levels').append(c);}
 $('market-scenarios').replaceChildren();for(const s of r.scenarios)$('market-scenarios').append(element('p',s.title+'：'+s.trigger+' 失效：'+s.invalid));
 $('market-evidence').replaceChildren();for(const line of [...r.reasons,'模型方向是否清楚：'+(r.uncertainty.level==='HIGH'?'結果分散，或與目前走勢不一致，先保留判斷。':'結果較集中，仍要等價格確認。'),'資料完整度：'+(r.dataQuality.complete?'日K及交易日曆核對通過':'日曆／資料核驗仍有限制'),f.provenance?.inputQuality?.warning||'',f.provenance?.outputQuality?.warning||'',ShitouMarketSimpleReport.validationText(backtest),'模型範圍與近期波動估計，都還沒證實能準確涵蓋明日走勢。'])if(line)$('market-evidence').append(element('p',line));draw(a,f);

}
let pending=null,lastAttempt=0;
const dataBase=new URL('../',new URL('research-v83/market.js',location.href));
function load(){
 if(pending)return pending;
 lastAttempt=Date.now();$('market-refresh').disabled=true;$('market-error').textContent='正在核對最新大盤資料…';
 pending=(async()=>{
  records.clear();models.clear();backtest=null;
  const get=path=>ShitouMarketFreshness.getJSON(new URL(path,dataBase));
  try{
   const [historyResult,modelResult,comparison]=await Promise.allSettled([get('data/index/TAIEX.json'),get('data/kronos/TAIEX.json'),get('data/backtest/v86/comparison.json')]);
   if(historyResult.status!=='fulfilled')throw Error('大盤行情暫未載入，請重新載入；系統稍後會自動重試。');
   const history=historyResult.value;records.set('TAIEX',history);
   const timeliness=ShitouMarketFreshness.historyStatus(history);if(timeliness.stale)throw Error(timeliness.message+' 網頁會每5分鐘重新檢查。');
   if(comparison.status==='fulfilled'&&comparison.value.schema==='v86-comparison-v1'&&comparison.value.improvementEstablished===false)backtest=comparison.value;
   if(modelResult.status!=='fulfilled')throw Error('模型資料暫未載入，請重新載入；系統稍後會自動重試。');
   const f=modelResult.value,valid=ShitouMarketFreshness.check(f,history);
   if(!valid.ready)throw Error(valid.reason);
   models.set('TAIEX',f);$('market-error').textContent='';
  }catch(e){$('market-error').textContent=e.message;}
  finally{render();$('market-refresh').disabled=false;pending=null;}
 })();return pending;
}
function refreshVisible(){if(document.visibilityState!=='hidden'&&Date.now()-lastAttempt>60000)load();}
$('market-refresh').onclick=load;window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
setInterval(()=>{if(document.visibilityState!=='hidden')load();},300000);
$('market-type').onchange=render;window.independentMarketState=()=>state;window.independentMarketReportSnapshot=()=>reportSnapshot;load();

