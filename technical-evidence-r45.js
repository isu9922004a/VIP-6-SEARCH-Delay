/*
* R5.3.2.4.19-R4.5 official release
 * Pure supplementary evidence. It never mutates reports, scores, ranking,
 * candidate qualification, Hard Reject, ABC/N-wave, or Worker contracts.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ShitouTechnicalEvidenceR45=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';

  const MODEL='TECHNICAL_EVIDENCE_R45_RESEARCH_CANDIDATE';
  const EMA_PERIODS=Object.freeze([8,12,21,50,200]);
  const KD_PERIOD=9;
  const unavailable=(reason,extra={})=>({available:false,label:'資料不足，暫不判斷',reason,...extra});

  function number(value){
    if(value===null||value===undefined||value==='')return null;
    const parsed=Number(typeof value==='string'?value.replace(/,/g,''):value);
    return Number.isFinite(parsed)?parsed:null;
  }

  function isoDate(value){
    const raw=String(value||'').trim();
    if(/^\d{8}$/.test(raw))return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6)}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:null;
  }

  function normalize(report){
    const source=report?.dailySeries;
    if(!Array.isArray(source)||!source.length)return unavailable('缺少已完成交易日的日K歷史');
    const rows=[];
    let priorDate='';
    for(const bar of source){
      const date=isoDate(bar?.date);
      const open=number(bar?.open),high=number(bar?.high),low=number(bar?.low),close=number(bar?.close);
      const volume=number(bar?.volume);
      if(!date||!(open>0)||!(close>0)||!(low>0)||!(high>=Math.max(open,close,low))||!(low<=Math.min(open,close,high))){
        return unavailable('日K日期或開高低收資料有缺漏，停止新增指標');
      }
      if(priorDate&&date<=priorDate)return unavailable('日K日期重複或排列錯誤，停止新增指標');
      if(volume!==null&&volume<0)return unavailable('成交量為負值，停止新增指標');
      rows.push({date,open,high,low,close,volume});
      priorDate=date;
    }
    const expectedDate=isoDate(report?.closeDate);
    const dataDate=rows.at(-1).date;
    if(expectedDate&&dataDate!==expectedDate){
      return unavailable('日K末日與報告交易日不一致，不能混用不同日期',{dataDate,expectedDate});
    }
    const displayedClose=number(report?.close);
    if(displayedClose!==null&&Math.abs(rows.at(-1).close-displayedClose)>Math.max(.02,displayedClose*.0001)){
      return unavailable('日K收盤價與報告最新收盤不一致，避免混用價格',{dataDate,expectedClose:displayedClose,seriesClose:rows.at(-1).close});
    }
    return {available:true,rows,dataDate,count:rows.length,period:'已完成日K',source:report?.source||'既有正式報告日K'};
  }

  function emaSeries(rows,period){
    if(!Array.isArray(rows)||rows.length<period+30){
      return unavailable(`EMA${period}需至少${period+30}根日K以降低起始值影響；目前只有${rows?.length||0}根`,{period});
    }
    const series=Array(rows.length).fill(null);
    let seed=0;
    for(let i=0;i<period;i++)seed+=rows[i].close;
    series[period-1]=seed/period;
    const alpha=2/(period+1);
    for(let i=period;i<rows.length;i++)series[i]=rows[i].close*alpha+series[i-1]*(1-alpha);
    const value=series.at(-1),previous=series.at(-2),fiveBarsAgo=series.at(-6);
    const slopeFiveBarsPct=fiveBarsAgo>0?(value-fiveBarsAgo)/fiveBarsAgo*100:null;
    const direction=slopeFiveBarsPct===null?'資料不足':slopeFiveBarsPct>.15?'向上':slopeFiveBarsPct<-.15?'向下':'接近平走';
    return {available:true,period,value,previous,slopeFiveBarsPct,direction,series,seedMethod:`前${period}根收盤價簡單平均後，以2/(N+1)遞迴`};
  }

  function kdSeries(rows){
    const warmup=30;
    if(!Array.isArray(rows)||rows.length<KD_PERIOD+warmup){
      return unavailable(`KD(9,3,3)需至少${KD_PERIOD+warmup}根已完成日K，目前只有${rows?.length||0}根`);
    }
    let k=50,d=50;
    const seriesK=[],seriesD=[],seriesRsv=[];
    for(let i=0;i<rows.length;i++){
      if(i<KD_PERIOD-1){seriesK.push(null);seriesD.push(null);seriesRsv.push(null);continue;}
      let low=Infinity,high=-Infinity;
      for(let j=i-KD_PERIOD+1;j<=i;j++){
        low=Math.min(low,rows[j].low);
        high=Math.max(high,rows[j].high);
      }
      const rsv=high===low?null:(rows[i].close-low)/(high-low)*100;
      if(rsv!==null){k=(2*k+rsv)/3;d=(2*d+k)/3;}
      seriesK.push(k);seriesD.push(d);seriesRsv.push(rsv);
    }
    const index=rows.length-1;
    const currentK=seriesK[index],currentD=seriesD[index],previousK=seriesK[index-1],previousD=seriesD[index-1];
    const cross=previousK<=previousD&&currentK>currentD?'黃金交叉':previousK>=previousD&&currentK<currentD?'死亡交叉':'沒有新交叉';
    const band=currentK>80?'高於80，短線偏熱但不等於反轉':currentK<20?'低於20，短線偏弱但不等於反轉':currentK>=50?'50以上，偏強區':'50以下，偏弱區';
    return {
      available:true,periods:[9,3,3],k:currentK,d:currentD,previousK,previousD,cross,band,
      seriesK,seriesD,rsvLast:seriesRsv[index],initialK:50,initialD:50,
      divergence:unavailable('KD背離規則尚未完成可重現驗證，本版不產生背離結論')
    };
  }

  function controlPoints(rows){
    if(!Array.isArray(rows)||rows.length<3)return unavailable('控制點至少需要3根已完成日K');
    const highs=[],lows=[];
    for(let i=1;i<rows.length-1;i++){
      if(rows[i].low<rows[i-1].low&&rows[i].low<rows[i+1].low){
        lows.push({pivotDate:rows[i].date,confirmedAt:rows[i+1].date,confirmedPrice:rows[i].low});
      }
      if(rows[i].high>rows[i-1].high&&rows[i].high>rows[i+1].high){
        highs.push({pivotDate:rows[i].date,confirmedAt:rows[i+1].date,confirmedPrice:rows[i].high});
      }
    }
    return {
      available:true,lastHigh:highs.at(-1)||null,lastLow:lows.at(-1)||null,
      definition:'兩側各一根嚴格高低點，下一根完成後才確認；僅供教材研究，不取代原版Pivot',
      dataDate:rows.at(-1).date
    };
  }

  function existingPhase(report){
    const candidates=[
      report?.currentExecutionPhase?.label,report?.decisionLayer?.currentExecutionPhase?.label,
      report?.structure?.phaseLabel,report?.structure?.phase,report?.marketPhase,
      report?.stageSafety?.label,report?.stage?.label
    ];
    const label=candidates.find(value=>typeof value==='string'&&value.trim());
    return label?{available:true,label:String(label).trim(),source:'既有正式判讀'}:unavailable('原系統沒有可可靠沿用的行情階段，顯示階段待確認',{label:'階段待確認'});
  }

  function rsi5(report,dataDate){
    const P=globalThis.ShitouScanPolicy5328;if(P){const x=P.rsi(report);return x.value===null?unavailable("原報告與完成日K沒有可靠RSI 5T",{date:x.date}):{available:true,value:x.value,date:x.date,period:"日RSI 5T",source:x.source};}
    const value=number(report?.dailyRsi5 ?? report?.dailyRsi);
    const date=isoDate(report?.dailyRsi5Date||report?.rsiDate||report?.closeDate)||dataDate||null;
    return value===null?unavailable('原有報告沒有可靠的日RSI 5T',{date}):{available:true,value,date,period:'日RSI 5T',source:'既有正式報告欄位'};
  }

  function analyze(report,{kind='stock'}={}){
    const data=normalize(report);
    const phase=existingPhase(report||{});
    if(!data.available){
      return {
        model:MODEL,kind,available:false,dataQuality:data,ema:unavailable(data.reason),kd:unavailable(data.reason),
        controls:unavailable(data.reason),rsi5:rsi5(report||{},data.dataDate),phase,
        risk:'未取得可靠日K，不提供新增技術結論',originalDecisionUnchanged:true
      };
    }
    const emas={};
    for(const period of EMA_PERIODS)emas[period]=emaSeries(data.rows,period);
    const e21=emas[21],e50=emas[50],e200=emas[200];
    const primaryReady=[e21,e50,e200].every(item=>item.available);
    const alignment=!primaryReady?'長期趨勢資料不足':
      e21.value>e50.value&&e50.value>e200.value?'短、中、長期平均價格由高到低排列，目前趨勢偏強':
      e21.value<e50.value&&e50.value<e200.value?'短、中、長期平均價格由低到高排列，目前趨勢偏弱':
      '各期間平均價格方向不一致，暫時不以排列判定趨勢';
    const kd=kdSeries(data.rows);
    const bias21Pct=e21.available?(data.rows.at(-1).close-e21.value)/e21.value*100:null;
    const kdPlain=!kd.available?kd.reason:kd.cross==='黃金交叉'?
      '短線力道剛有轉強跡象，仍要看價格是否突破並站穩':kd.cross==='死亡交叉'?
      '短線力道出現轉弱跡象，不能單憑交叉判定整段趨勢失敗':'短線暫無新的交叉，繼續觀察價格與量能';
    return {
      model:MODEL,kind,available:true,
      dataQuality:{available:true,dataDate:data.dataDate,bars:data.count,period:data.period,source:data.source,volumeReady:data.rows.every(row=>row.volume!==null)},
      ema:{available:true,values:emas,alignment,bias21Pct,shortDirection:e21.available?e21.direction:'資料不足',longTermReady:e200.available},
      kd:{...kd,plain:kdPlain},controls:controlPoints(data.rows),rsi5:rsi5(report,data.dataDate),phase,
      risk:'本區只有補充證據，不能代替原有進場檢查',originalDecisionUnchanged:true
    };
  }

  function price(value,digits=2){
    const parsed=number(value);
    return parsed===null?'資料不足':parsed.toLocaleString('zh-TW',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  }

  function plain(evidence){
    if(!evidence?.available){
      return [
        `⚪ 新增趨勢資料不足：${evidence?.dataQuality?.reason||'請先取得可靠的已完成日K。'}`,
        `📊 日RSI 5T：${evidence?.rsi5?.available?`${price(evidence.rsi5.value,1)}（${evidence.rsi5.date||'日期未提供'}）`:'資料不足'}`,
        `🧭 目前行情階段：${evidence?.phase?.label||'階段待確認'}。原有選股結果保持不變。`
      ];
    }
    const values=evidence.ema.values;
    return [
      `📈 EMA趨勢：${evidence.ema.alignment}。${values[21].available?`EMA21 ${price(values[21].value)}、${values[21].direction}`:'EMA21資料不足'}；${values[50].available?`EMA50 ${price(values[50].value)}`:'EMA50資料不足'}；${values[200].available?`EMA200 ${price(values[200].value)}`:'EMA200歷史不足，不做長期結論'}。`,
      `📊 KD(9,3,3)：${evidence.kd.available?`${evidence.kd.plain}；K ${price(evidence.kd.k,1)}、D ${price(evidence.kd.d,1)}；${evidence.kd.band}`:'資料不足'}。`,
      `🌡️ 日RSI 5T：${evidence.rsi5.available?`${price(evidence.rsi5.value,1)}｜資料日 ${evidence.rsi5.date||evidence.dataQuality.dataDate}`:'資料不足'}。`,
      `🧭 目前行情階段：${evidence.phase?.label||'階段待確認'}｜${evidence.phase?.available?'沿用原始判讀':'沒有可靠模型，不自行推測'}。`,
      `🕒 技術證據只使用 ${evidence.dataQuality.dataDate} 以前已完成的日K；不計分、不改資格，也不是隔日買點。`
    ];
  }

  return Object.freeze({MODEL,EMA_PERIODS,KD_PERIOD,number,isoDate,normalize,emaSeries,kdSeries,controlPoints,existingPhase,rsi5,analyze,plain,price});
});
