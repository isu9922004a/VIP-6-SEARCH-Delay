'use strict';

/*
 * R4.9.5 教材證據層：把《100張圖學會K線當沖》與《教你炒股票108課》
 * 轉成白話的隔日開盤觀察計畫。這一層只補充證據與顯示，不改原始分數、
 * grade、eligible、formalEligible、top3Eligible 或 executionAllowed。
 */
(function(root){
  const MODEL='BOOK_EVIDENCE_R495_V1';
  const ROLE='EVIDENCE_ONLY';
  const DECISIONS=Object.freeze({
    PRIORITY_WATCH:{key:'PRIORITY_WATCH',icon:'🟢',label:'明天開盤：可優先觀察，但不能直接追',colorRole:'positive'},
    WAIT_CONFIRM:{key:'WAIT_CONFIRM',icon:'🟡',label:'明天開盤：先等確認，不急著進場',colorRole:'caution'},
    AVOID:{key:'AVOID',icon:'🔴',label:'明天開盤：目前不適合進場',colorRole:'negative'},
    DATA_INSUFFICIENT:{key:'DATA_INSUFFICIENT',icon:'⚪',label:'明天開盤：資料不足，先不要進場',colorRole:'unknown'}
  });

  const number=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
  const round=(value,digits=2)=>{const n=number(value);return n===null?null:Number(n.toFixed(digits));};
  const pct=(value,digits=1)=>{const n=number(value);return n===null?'資料不足':`${n.toFixed(digits)}%`;};
  const price=value=>{const n=number(value);if(n===null)return '資料不足';return n>=1000?n.toFixed(0):n>=100?n.toFixed(1):n.toFixed(2);};
  const unique=items=>[...new Set((items||[]).filter(Boolean))];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function normalizeBars(source){
    const input=Array.isArray(source)?source:[];
    const rows=[];
    for(const item of input){
      const date=String(item?.date||item?.tradeDate||'').slice(0,10);
      const open=number(item?.open),high=number(item?.high),low=number(item?.low),close=number(item?.close),volume=number(item?.volume??item?.vol);
      if(!date||open===null||high===null||low===null||close===null||volume===null||open<=0||high<=0||low<=0||close<=0||volume<0)continue;
      if(high<Math.max(open,low,close)||low>Math.min(open,high,close))continue;
      rows.push({date,open,high,low,close,volume});
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date));
    return rows.filter((row,index)=>index===0||row.date!==rows[index-1].date);
  }

  function average(values){
    const clean=(values||[]).map(number).filter(value=>value!==null);
    return clean.length?clean.reduce((sum,value)=>sum+value,0)/clean.length:null;
  }

  function sma(rows,period,field='close',offset=0){
    const end=rows.length-offset;
    if(period<=0||end<period)return null;
    return average(rows.slice(end-period,end).map(row=>row[field]));
  }

  function ema(values,period){
    if(!values.length)return [];
    const alpha=2/(period+1),out=[values[0]];
    for(let index=1;index<values.length;index++)out.push(values[index]*alpha+out[index-1]*(1-alpha));
    return out;
  }

  function macd(rows){
    if(rows.length<35)return {available:false,dif:null,dea:null,histogram:null};
    const closes=rows.map(row=>row.close),fast=ema(closes,12),slow=ema(closes,26),dif=closes.map((_,index)=>fast[index]-slow[index]),dea=ema(dif,9);
    const last=dif.length-1;
    return {available:true,dif:dif[last],dea:dea[last],histogram:(dif[last]-dea[last])*2,aboveZero:dif[last]>0&&dea[last]>0};
  }

  function confirmedPivots(rows){
    const pivots=[];
    for(let index=1;index<rows.length-1;index++){
      const left=rows[index-1],current=rows[index],right=rows[index+1];
      if(current.high>left.high&&current.high>=right.high)pivots.push({type:'HIGH',index,date:current.date,price:current.high});
      if(current.low<left.low&&current.low<=right.low)pivots.push({type:'LOW',index,date:current.date,price:current.low});
    }
    return pivots;
  }

  function leftLevels(rows,close){
    const history=rows.slice(Math.max(0,rows.length-61),-1),raw=[];
    for(const row of history){
      raw.push({price:row.close,type:'CLOSE',date:row.date});
      raw.push({price:row.high,type:'HIGH',date:row.date});
    }
    const sorted=raw.sort((a,b)=>a.price-b.price),dedup=[];
    for(const item of sorted){
      const previous=dedup.at(-1);
      if(!previous||Math.abs(item.price/previous.price-1)>.0025)dedup.push(item);
    }
    const resistance=dedup.find(item=>item.price>close*1.0025)||null;
    const support=[...dedup].reverse().find(item=>item.price<close*.9975)||null;
    return {resistance,support};
  }

  function analyze(input){
    const report=input?.report||input||{},rows=normalizeBars(report.dailySeries||report.rows||input?.dailySeries||[]);
    if(rows.length<60){
      const decision=DECISIONS.DATA_INSUFFICIENT;
      return {model:MODEL,role:ROLE,dataTiming:'POST_CLOSE',available:false,decision,rowsUsed:rows.length,dataDate:rows.at(-1)?.date||report.closeDate||null,
        headline:decision.label,plainText:'完成日K少於60根，無法可靠比較5／20／60日線、左K價位與量價；資料不足時不硬猜。',
        reasons:['完成日K不足60根'],risks:['資料不足'],confirmation:[],invalidation:[],formalGateChanged:false,scoreChanged:false,rankingChanged:false};
    }

    const last=rows.at(-1),previous=rows.at(-2),ma5=sma(rows,5),ma5Previous=sma(rows,5,'close',1),ma20=sma(rows,20),ma60=sma(rows,60),ma60Previous=sma(rows,60,'close',5);
    const priorVolume5=sma(rows.slice(0,-1),5,'volume'),volumeRatio=priorVolume5>0?last.volume/priorVolume5:null;
    const distanceMa5=ma5>0?(last.close/ma5-1)*100:null,distanceMa20=ma20>0?(last.close/ma20-1)*100:null;
    const levels=leftLevels(rows,last.close),resistanceRoom=levels.resistance?(levels.resistance.price/last.close-1)*100:null;
    const pivots=confirmedPivots(rows),lastLow=[...pivots].reverse().find(item=>item.type==='LOW')||null,lastHigh=[...pivots].reverse().find(item=>item.type==='HIGH')||null;
    const recentLows=pivots.filter(item=>item.type==='LOW').slice(-2),higherLow=recentLows.length===2?recentLows[1].price>recentLows[0].price:null;
    const momentum=macd(rows),wave=root.ShitouWaveCoreV48?.analyzeBars?.(rows)||null;

    const positives=[],cautions=[],negatives=[];
    if(last.close>ma5)positives.push('收盤守在5日線上');else negatives.push('收盤跌到5日線下');
    if(ma5>ma5Previous)positives.push('5日線正在上揚');else negatives.push('5日線沒有上揚');
    if(last.close>ma20)positives.push('價格仍在20日線上');else negatives.push('價格落在20日線下');
    if(ma60>ma60Previous)positives.push('60日線中期方向向上');else cautions.push('60日線尚未轉強');
    if(volumeRatio!==null&&volumeRatio>=1)positives.push(`成交量是前5日均量的 ${volumeRatio.toFixed(2)} 倍`);else cautions.push('成交量尚未明顯接上');
    if(higherLow===true)positives.push('最近兩個已確認低點逐步墊高');
    if(higherLow===false)cautions.push('最近兩個已確認低點沒有墊高');
    if(momentum.available&&momentum.aboveZero)positives.push('MACD快慢線位於零軸上');
    if(momentum.available&&!momentum.aboveZero)cautions.push('MACD尚未形成零軸上多方背景');
    if(distanceMa5!==null&&distanceMa5>5)cautions.push(`收盤高出5日線 ${distanceMa5.toFixed(1)}%，追價空間要保守`);
    if(resistanceRoom!==null&&resistanceRoom<1.5)cautions.push(`上方約 ${resistanceRoom.toFixed(1)}% 就遇到左K壓力`);
    if(wave?.threeBreakdown)negatives.push('量價核心出現三盤跌破');
    if(wave?.fib?.ok&&wave.fib.direction==='UP'&&wave.fib.ratioPct>78.6)cautions.push('前一段上漲已回吐超過78.6%');

    const severeWeak=(last.close<ma5&&ma5<=ma5Previous&&last.close<ma20)||wave?.threeBreakdown===true;
    const stretched=distanceMa5!==null&&distanceMa5>8;
    const blocked=resistanceRoom!==null&&resistanceRoom<1.0;
    const strongContext=last.close>ma5&&ma5>ma5Previous&&last.close>ma20&&positives.length>=4;
    let decision;
    if(severeWeak)decision=DECISIONS.AVOID;
    else if(strongContext&&!stretched&&!blocked)decision=DECISIONS.PRIORITY_WATCH;
    else decision=DECISIONS.WAIT_CONFIRM;

    const triggerCandidates=[
      levels.resistance?.price,
      last.high,
      report?.entry?.value,
      report?.levels?.trigger,
      input?.trigger
    ].map(number).filter(value=>value!==null&&value>=last.close*.98);
    const trigger=triggerCandidates.length?Math.min(...triggerCandidates):last.high;
    const supportCandidates=[levels.support?.price,ma5,lastLow?.price,report?.support?.value,input?.support].map(number).filter(value=>value!==null&&value<last.close);
    const support=supportCandidates.length?Math.max(...supportCandidates):Math.min(last.low,ma5);
    const invalidationCandidates=[ma20,lastLow?.price,report?.invalid?.value].map(number).filter(value=>value!==null&&value<last.close);
    const invalidationPrice=invalidationCandidates.length?Math.max(...invalidationCandidates):support;

    const confirmation=[
      `開盤後先守住開盤價與均價線，不在均價線下追價`,
      `完成K帶量站上 ${price(trigger)}，才算突破有確認`,
      '若早盤已急拉，等壓回不破關鍵價再評估，不追第一段急衝'
    ];
    const invalidation=[
      `跌破 ${price(support)}，代表最近支撐失守`,
      `跌破 ${price(invalidationPrice)} 或形成更低的已確認低點，停止把它當多方候選`
    ];
    const lead=decision.key==='PRIORITY_WATCH'
      ?'盤後背景偏多，但「可觀察」不等於一開盤就買。'
      :decision.key==='AVOID'
        ?'短中期結構同步轉弱，明天先把資金留著。'
        :'條件還沒有同時到位，等價格、均價線與成交量一起確認。';
    const firstReason=decision.key==='AVOID'?negatives[0]:(positives[0]||cautions[0]||'條件仍待確認');
    const plainText=`${lead} ${firstReason}。觀察價 ${price(trigger)}，近支撐 ${price(support)}；真正進場仍要看明天盤中是否守開盤價／均價線並帶量突破。`;

    return {
      model:MODEL,role:ROLE,dataTiming:'POST_CLOSE',available:true,decision,dataDate:last.date,rowsUsed:rows.length,
      headline:decision.label,plainText,positives:unique(positives),cautions:unique(cautions),negatives:unique(negatives),
      reasons:unique([...(decision.key==='AVOID'?negatives:positives),...cautions]).slice(0,6),risks:unique([...negatives,...cautions]),
      levels:{close:round(last.close),trigger:round(trigger),support:round(support),invalidation:round(invalidationPrice),leftResistance:round(levels.resistance?.price),leftSupport:round(levels.support?.price),resistanceRoomPct:round(resistanceRoom,1)},
      metrics:{ma5:round(ma5),ma20:round(ma20),ma60:round(ma60),ma5SlopeUp:ma5>ma5Previous,ma60SlopeUp:ma60>ma60Previous,distanceMa5Pct:round(distanceMa5,1),distanceMa20Pct:round(distanceMa20,1),volumeRatio5:round(volumeRatio,2),higherLow,macdAboveZero:momentum.aboveZero??null},
      structure:{lastConfirmedHigh:lastHigh,lastConfirmedLow:lastLow,provisionalTail:true,note:'最後一段尚未由未來K棒確認，只作形成中證據。'},
      confirmation,invalidation,formalGateChanged:false,scoreChanged:false,rankingChanged:false
    };
  }

  function textBlock(input){
    const evidence=input?.model===MODEL?input:analyze(input),lines=[
      `【${evidence.decision.icon} 明天開盤行動判讀｜教材證據層】`,
      evidence.headline,
      `白話：${evidence.plainText}`
    ];
    if(evidence.available){
      lines.push(`關鍵價：觀察 ${price(evidence.levels.trigger)}｜近支撐 ${price(evidence.levels.support)}｜失效參考 ${price(evidence.levels.invalidation)}`);
      lines.push(`開盤確認：${evidence.confirmation.join('；')}`);
      if(evidence.risks.length)lines.push(`風險：${evidence.risks.slice(0,3).join('、')}`);
    }
    lines.push('定位：只作隔日觀察計畫，不改原選股分數／Gate，也不代表開盤可以直接買。');
    return lines.join('\n');
  }

  function cardHtml(input,title='📚 明天開盤行動判讀'){
    const e=input?.model===MODEL?input:analyze(input),levels=e.levels||{};
    const checks=e.available?`<div class="book-open-levels"><b>觀察價 ${price(levels.trigger)}</b><b>近支撐 ${price(levels.support)}</b><b>失效參考 ${price(levels.invalidation)}</b></div>`:'';
    const confirm=e.available?`<div class="book-open-check"><strong>開盤怎麼看：</strong>${e.confirmation.map(esc).join('；')}</div>`:'';
    const risk=e.risks?.length?`<div class="book-open-risk"><strong>先注意：</strong>${e.risks.slice(0,3).map(esc).join('、')}</div>`:'';
    return `<div class="rule book-open-card" data-decision="${esc(e.decision.key)}"><strong>${title}</strong><h3>${esc(e.headline)}</h3><p>${esc(e.plainText)}</p>${checks}${confirm}${risk}<small>教材證據層只提供隔日觀察計畫；不改正式Gate，盤中未確認前不視為進場訊號。</small></div>`;
  }

  function stage(input){
    const e=input?.model===MODEL?input:analyze(input),l=e.levels||{};
    return {key:`BOOK_${e.decision.key}`,label:`${e.decision.icon} ${e.headline.replace('明天開盤：','')}`,headline:e.headline,plainText:e.plainText,colorRole:e.decision.colorRole,
      progressText:e.available?`觀察 ${price(l.trigger)}｜支撐 ${price(l.support)}｜失效 ${price(l.invalidation)}`:'完成日K不足60根',source:'兩本教材候選證據層｜不改Gate'};
  }

  function insertCanvasCard(base,input,title='📚 明天開盤行動'){
    if(!base||typeof root.insertStageCanvasCardV53245!=='function')return base;
    const height=154,fallback=Math.min(210,Math.max(110,Math.round((base.height||0)*.055)));
    let insertY=fallback;
    try{
      const audit=base?.dataset?.layoutAudit?JSON.parse(decodeURIComponent(base.dataset.layoutAudit)):null;
      const cards=Array.isArray(audit?.stageCards)?audit.stageCards:[];
      for(const card of cards){
        const bottom=Number(card?.insertY)+Number(card?.height);
        if(Number.isFinite(bottom))insertY=Math.max(insertY,Math.round(bottom));
      }
    }catch(_){/* 缺少審計資料時沿用安全的頁首後插入位置。 */}
    insertY=Math.max(0,Math.min(Math.max(0,(base.height||height)-height),insertY));
    return root.insertStageCanvasCardV53245(base,stage(input),title,insertY,height);
  }

  function attach(candidate){
    if(!candidate||typeof candidate!=='object')return candidate;
    candidate.bookEvidenceR495=analyze(candidate.report||candidate);
    return candidate;
  }

  function installHooks(){
    // V50 由單一 analysisResult／Render 層接管畫面與報告；保留本模組計算 API，避免重複卡片與重複文字。
    if(root.ShitouReleaseV50?.major===50)return;
    if(root.__BOOK_EVIDENCE_R495_HOOKED__)return;
    root.__BOOK_EVIDENCE_R495_HOOKED__=true;
    if(typeof document!=='undefined'&&!document.getElementById('bookEvidenceStyleR495')){
      const style=document.createElement('style');style.id='bookEvidenceStyleR495';style.textContent=`
        .book-open-card{border-left:6px solid #8a6d1d;background:#fffaf0;margin-top:12px;overflow-wrap:anywhere}
        .book-open-card[data-decision="PRIORITY_WATCH"]{border-left-color:#17724a;background:#f2fbf6}
        .book-open-card[data-decision="AVOID"]{border-left-color:#aa3541;background:#fff4f5}
        .book-open-card[data-decision="DATA_INSUFFICIENT"]{border-left-color:#758292;background:#f5f7f9}
        .book-open-card h3{margin:8px 0 6px;font-size:1.08rem;line-height:1.45}
        .book-open-card p,.book-open-check,.book-open-risk{line-height:1.7;margin:7px 0}
        .book-open-levels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
        .book-open-levels b{padding:8px;border-radius:8px;background:rgba(255,255,255,.78);border:1px solid rgba(75,89,104,.2);text-align:center}
        .book-open-card small{display:block;margin-top:9px;color:#657184;line-height:1.55}
        @media(max-width:680px){.book-open-levels{grid-template-columns:1fr}.book-open-levels b{text-align:left}}
      `;document.head?.appendChild(style);
    }
    if(typeof root.buildReportText==='function'){
      const base=root.buildReportText;
      root.buildReportText=function(report){return `${textBlock(report)}\n\n${base(report)}`;};
    }
    if(typeof root.buildDayTradeTextReportV1==='function'){
      const base=root.buildDayTradeTextReportV1;
      root.buildDayTradeTextReportV1=function(scan){
        const list=(scan?.candidates||[]).slice(0,8).map(attach),summary=list.length?list.map((candidate,index)=>`${index+1}. ${candidate?.report?.name||candidate?.name||candidate?.report?.code||candidate?.code||'-'}｜${candidate.bookEvidenceR495.headline}`).join('\n'):'本次沒有候選可建立開盤判讀。';
        return `【📚 明天開盤白話總表｜不改原Gate】\n${summary}\n\n${base(scan)}`;
      };
    }
    if(typeof root.renderDayTradeScanResultV1==='function'){
      const base=root.renderDayTradeScanResultV1;
      root.renderDayTradeScanResultV1=function(scan){
        (scan?.candidates||[]).forEach(attach);
        const result=base(scan),host=typeof document!=='undefined'?document.getElementById('dayTradeList'):null,cards=Array.from(host?.querySelectorAll?.('.momentum-card')||[]);
        (scan?.candidates||[]).slice(0,cards.length).forEach((candidate,index)=>{
          if(!cards[index].querySelector('.book-open-card'))cards[index].insertAdjacentHTML('beforeend',cardHtml(candidate.bookEvidenceR495,'📚 明天開盤怎麼做'));
        });
        return result;
      };
    }
    if(typeof root.renderBeginnerCommandCenterV46==='function'){
      const base=root.renderBeginnerCommandCenterV46;
      root.renderBeginnerCommandCenterV46=function(report){
        const result=base(report);if(typeof document==='undefined')return result;
        let box=document.getElementById('bookOpeningDecisionR495');
        if(!box){box=document.createElement('div');box.id='bookOpeningDecisionR495';const target=document.getElementById('waveStockCardV49')||document.getElementById('stockStageCardV53245')||document.getElementById('beginnerCommandCenterV46');target?.insertAdjacentElement('afterend',box);}
        if(box)box.innerHTML=cardHtml(report);
        return result;
      };
    }
    for(const name of ['renderStockInfographicV46','renderStockProfessionalInfographicV51']){
      if(typeof root[name]!=='function'||typeof root.insertStageCanvasCardV53245!=='function')continue;
      const base=root[name];
      root[name]=function(report){return insertCanvasCard(base(report),report,'📚 明天開盤行動');};
    }
  }

  const API=Object.freeze({MODEL,ROLE,DECISIONS,normalizeBars,confirmedPivots,leftLevels,analyze,textBlock,cardHtml,stage,insertCanvasCard,attach,installHooks});
  root.ShitoBookEvidenceR495=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  installHooks();
})(typeof window!=='undefined'?window:globalThis);
