/* V8.2: stock report data-lineage audit and manually-copyable price alerts.
 * Read-only: never changes a quote, bar, qualification, score, ranking, or order.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.ShitouStockAuditAlertV82=api;api.install(root);}
})(globalThis,function(){'use strict';
  const f=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  const num=v=>v===null||v===undefined||v===''?null:f(Number(v));
  const price=v=>num(v)===null?'資料不足':Number(v).toFixed(2);
  const date=v=>{const s=String(v||'').replace(/\D/g,'');return s.length===8?s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8):null;};
  const tick=p=>p<10?.01:p<50?.05:p<100?.1:p<500?.5:p<1000?1:5;
  const legal=p=>p>0&&Math.abs(p/tick(p)-Math.round(p/tick(p)))<1e-6;
  function roundLegal(raw,direction){const v=num(raw);if(v===null||v<=0)return null;const cents=Math.round(v*100);for(let j=0;j<=600;j++){
    const p=(cents+direction*j)/100;
    if(p>0&&legal(p)&&(direction>0?p+1e-9>=v:p-1e-9<=v))return Number(p.toFixed(2));
  }return null;}
  function nextTick(v,direction){if(v===null)return null;return roundLegal(Number((v+direction*.01).toFixed(2)),direction);}
  function alertPlan({close,turn,pressure,defense,marketDate,code}={}){
    // '價格高於' and '價格低於' have not been verified as strict vs inclusive in the user's broker UI.
    // A legal floor for an above threshold does NOT imply that the alert is a trade/close confirmation.
    const upper=roundLegal(turn,-1),lower=roundLegal(defense,-1),early=roundLegal(pressure,-1);
    const firstStrictAbove=nextTick(upper,1),firstStrictBelow=nextTick(lower,-1);
    return Object.freeze({code:String(code||''),marketDate:date(marketDate),asOfClose:num(close),
      priceAbove:{raw:num(turn),input:upper,firstStrictTrigger:firstStrictAbove,kind:'MA20_TREND_OBSERVATION',alreadyCrossed:num(close)!==null&&upper!==null&&Number(close)>upper},
      earlyAbove:{raw:num(pressure),input:early,firstStrictTrigger:nextTick(early,1),kind:'NEAR_RESISTANCE',alreadyCrossed:num(close)!==null&&early!==null&&Number(close)>early},
      priceBelow:{raw:num(defense),input:lower,firstStrictTrigger:firstStrictBelow,kind:'DEFENSE_OBSERVATION',alreadyCrossed:num(close)!==null&&lower!==null&&Number(close)<lower},
      dayGainPercentInput:5,dayLossPercentInput:5,providerIntegrationStatus:'MANUAL_ONLY',operatorStatus:'UNVERIFIED',
      note:'價格通知是盤中提醒，不代表完成日K收盤站穩；均線每日變動，日K更新後須重新設定。'});
  }
  function check(report,bundle){
    const code=String(report?.code||report?.stock||''),reportDate=date(report?.closeDate||report?.marketDate||report?.dataDate),asOf=date(bundle?.tradeDateIso||bundle?.tradeDate),rows=bundle?.rows;
    const summary={code,reportDate,snapshotDate:asOf,status:'NOT_VERIFIED',source:'資料來源待核驗',rawVolumeLots:null,snapshotVolumeLots:null,relativeDiffPct:null,details:''};
    if(!asOf||!reportDate||asOf!==reportDate){summary.status='DATE_MISMATCH';summary.details='個股報告與專案市場快照的交易日期不同；不能混用數量。';return summary;}
    if(bundle?.marketCoverageReady!==true||!Array.isArray(rows)){summary.details='市場快照覆蓋或資料結構未通過；不能當成完整官方母體。';return summary;}
    const candidates=rows.filter(r=>String(r.code)===code&&date(r.quoteDate)===reportDate);
    if(candidates.length!==1){summary.details='當日沒有唯一且同日的個股市場快照；未強制對齊。';return summary;}
    const q=candidates[0],close=num(report?.close),qclose=num(q.close);
    summary.snapshotVolumeLots=num(q.volume)===null?null:Number(q.volume)/1000;
    if(close===null||qclose===null||Math.abs(close-qclose)>Math.max(.02,qclose*.0001)){
      summary.status='PRICE_MISMATCH';summary.details='收盤價與市場快照不一致，應先處理日期或商品代號；禁止用不同來源合算。';return summary;
    }
    const bars=Array.isArray(report?.dailySeries)?report.dailySeries:Array.isArray(report?.canonicalBars)?report.canonicalBars:[];
    const last=bars.at(-1);if(!last||date(last.date)!==reportDate){summary.status='NO_COMPARABLE_BARS';summary.details='缺當日的可核對日K；不虛構最新成交量。';return summary;}
    for(const field of ['open','high','low','close']){if(num(last[field])===null||num(q[field])===null||Math.abs(num(last[field])-num(q[field]))>Math.max(.02,num(q[field])*.0001)){
      summary.status='OHLC_MISMATCH';summary.details='最新日K的 OHLC 與同日市場快照不同；須回查行情來源。';return summary;
    }}
    const unit=String(report.volumeUnit||report.dailySeriesMeta?.volumeUnit||'').toLowerCase();const factor=unit==='shares'?1:unit==='lots'||unit==='thousand_shares'?1000:null;
    if(factor===null||num(last.volume)===null||num(q.volume)===null||q.volume<=0){summary.status='UNKNOWN_VOLUME_UNIT';summary.details='缺可驗證的成交量單位（股／張），不能比較。';return summary;}
    const raw=Number(last.volume)*factor,qv=Number(q.volume),diff=Math.abs(raw-qv)/qv*100;
    return {...summary,rawVolumeLots:raw/1000,snapshotVolumeLots:qv/1000,relativeDiffPct:diff,
      status:diff>.5?'VOLUME_MISMATCH':'MATCHED',source:'專案市場快照與個股日K',
      details:diff>.5?'同日成交量口徑有差異；這裡僅提示、不直接覆寫策略輸入。':'同日收盤、OHLC與成交量在0.5%容差內對齊（不等於歷史資料全部通過）。'};
  }
  const el=(tag,content)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=String(content);return n;};
  function install(root){
    if(!root.document||typeof root.analyzeStock!=='function')return;
    const original=root.analyzeStock;
    let memo=null;const load=()=>memo||(memo=fetch('./data/market/latest.json',{cache:'no-store'})
      .then(r=>r.ok?r.json():null).catch(()=>null));
    const copy=async(text,button)=>{try{await navigator.clipboard.writeText(text);button.textContent='已複製';}
      catch(_){const input=el('textarea');input.value=text;input.readOnly=true;button.after(input);input.select();button.textContent='請選取文字複製';}};
    async function render(report){
      const host=document.getElementById('result');if(!host||!report||host.style.display==='none')return;
      document.getElementById('shitou-v82-stock-audit')?.remove();
      const wrapper=el('section');wrapper.id='shitou-v82-stock-audit';wrapper.className='v82-stock-audit';host.append(wrapper);
      const heading=el('h3','到價提醒參數｜下一交易日手動設定');wrapper.append(heading);
      let plan=null;
      try{const p=root.ShitouV50UI?.newbiePlan?.(report);if(p)plan=alertPlan({close:report.close,turn:p.turn,pressure:p.pressure,defense:p.defense,marketDate:report.closeDate,code:report.code});}catch(error){console.warn('V8.2提醒參數不足：',error);}
      if(plan){
        const subtitle=el('p',`${report.name||report.code}（${report.code}）｜行情 ${plan.marketDate||'日期待核對'}｜到價僅提醒，收盤＋量價另行確認`);wrapper.append(subtitle);
        const rows=[['價格高於（趨勢觀察）',plan.priceAbove],['提前提醒（近期壓力，擇一取代上欄）',plan.earlyAbove],['價格低於（防守觀察）',plan.priceBelow]];
        const table=el('div');table.className='v82-price-rows';
        for(const [label,item] of rows){const line=el('div');line.className='v82-price-row';line.append(el('span',label));const first=item.input===null?'資料不足':`${price(item.input)} 元`;
          line.append(el('strong',first));const b=el('button','複製');b.type='button';b.disabled=item.input===null;b.onclick=()=>copy(price(item.input),b);line.append(b);
          line.append(el('small',item.input===null?'此價位未建立':`原始技術價 ${price(item.raw)}；若 APP 為嚴格高／低於，首次可能觸發 ${price(item.firstStrictTrigger)} 元${item.alreadyCrossed?'；⚠ 報告收盤已越線，開盤可能立即提醒':''}`));table.append(line);}
        wrapper.append(table);
        const toggles=el('p',`單日漲幅超過：${plan.dayGainPercentInput}%（選用）｜單日跌幅超過：${plan.dayLossPercentInput}%（選用）`);wrapper.append(toggles);
        const note=el('p','比較符號（＞、≥、＜、≤）須以 APP 實際說明確認；上述觸發價僅是假設「嚴格高於／低於」，不保證推播價格、時間或盤中可成交。');wrapper.append(note);
        const all=el('button','一鍵複製通知四欄');all.type='button';all.onclick=()=>copy([`股票 ${report.code}｜報告 ${plan.marketDate}`,`價格高於 ${price(plan.priceAbove.input)}`,`價格低於 ${price(plan.priceBelow.input)}`,'單日漲幅超過 5%（選用）','單日跌幅超過 5%（選用）',plan.note,'價位隨新日K重新核對'].join('\n'),all);wrapper.append(all);
      }else wrapper.append(el('p','關鍵價位資料不足，不能產生到價輸入值。'));
      const a=el('details');a.open=true;a.append(el('summary','同日行情一致性核對'));wrapper.append(a);
      const snap=root.ShitouSelectionDataV2?.getSnapshot?.();let bundle=null;
      if(snap?.map instanceof Map&&snap?.date){bundle={tradeDateIso:snap.date,marketCoverageReady:snap.meta?.marketCoverageReady,rows:[...snap.map.values()]};}
      else bundle=await load();
      if(host.style.display==='none'||document.getElementById('shitou-v82-stock-audit')!==wrapper)return;
      const audit=bundle?check(report,bundle):{status:'NOT_VERIFIED',details:'未能取得同日市場快照；不宣稱資料已對齊。'};
      a.append(el('p',audit.details));
      if(audit.snapshotVolumeLots!==null&&audit.rawVolumeLots===null)a.append(el('p',`市場快照紀錄量 ${price(audit.snapshotVolumeLots)} 張；個股原日K量尚無可比較單位，暫不判定一致。`));
      if(audit.relativeDiffPct!==null&&audit.relativeDiffPct!==undefined)a.append(el('p',`個股原日K：${price(audit.rawVolumeLots)} 張｜市場快照：${price(audit.snapshotVolumeLots)} 張｜差異 ${price(audit.relativeDiffPct)}%`));
      a.append(el('p',`資料核對狀態：${audit.status}｜報告交易日 ${audit.reportDate||'未知'}｜快照交易日 ${audit.snapshotDate||'未知'}。不更動原策略分數及排序。`));
      report.stockAuditV82=audit; // Output provenance only: no OHLCV, score, or strategy input replaced.
      wrapper.dataset.audit=JSON.stringify(audit);wrapper.dataset.alertPlan=JSON.stringify(plan);
    }
    root.analyzeStock=async function(...args){const out=await original.apply(this,args),report=root.lastReportData;
      // Legacy top-level let is lexical, not necessarily a global property. Use the optional safe accessor.
      const r=typeof root.shitouGetLastReportV82==='function'?root.shitouGetLastReportV82():report;
      if(r){try{await render(r);}catch(error){console.warn('V8.2行情核對暫時不可用：',error);}}
      return out;
    };
    const oldText=root.buildReportText;
    if(typeof oldText==='function')root.buildReportText=function(report,...args){const value=oldText.apply(this,[report,...args]);const audit=report?.stockAuditV82;return typeof value==='string'&&audit?.status==='VOLUME_MISMATCH'&&!value.includes('【V8.2同日行情核對】')?value+`\n\n【V8.2同日行情核對】${audit.details}｜個股日K ${price(audit.rawVolumeLots)}張／市場快照 ${price(audit.snapshotVolumeLots)}張。以原計算結果為研究參考，尚未同源一致。`:value;};
    const css=el('style');css.textContent=`.v82-stock-audit{margin:14px 0;padding:15px;border:1px solid #bfcfe0;border-left:6px solid #21577b;border-radius:14px;background:#f4f8fc;color:#20364e;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box}.v82-stock-audit h3{margin:0 0 8px}.v82-stock-audit p{margin:8px 0;line-height:1.6}.v82-price-rows{display:grid;gap:7px}.v82-price-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;background:white;border:1px solid #dce5ee;border-radius:9px;padding:9px}.v82-price-row small{grid-column:1/-1;font-size:.79rem;color:#52657c}.v82-stock-audit button{border:1px solid #8aa9c9;border-radius:7px;padding:7px 12px;background:#f1f7fd;color:#17466a;cursor:pointer}.v82-stock-audit button:disabled{opacity:.5;cursor:not-allowed}`;document.head.append(css);
  }
  return Object.freeze({tick,legal,roundLegal,nextTick,alertPlan,check,install});
});
