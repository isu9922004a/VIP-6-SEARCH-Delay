/* Explicit preview of the independent study page. Loaded only with postmarket-study=1. */
const root = globalThis;
const version = 'V9.26-RESEARCH-2A';
let pending;

function loadScripts() {
  if (!pending) {
    pending = (async () => {
      const dependencies = [
        ['ShitouResearchCommon','research-common-v1.js'],
        ['ShitouEnhancedMacd','enhanced-macd-v923.js'],
        ['ShitouPostmarketPatterns926','postmarket-patterns-v926.js'],
        ['ShitouPostmarketTrend926','postmarket-trend-v926.js'],
        ['ShitouPostmarketReport926','postmarket-report-v926.js']
      ];
      for (const [key,file] of dependencies) {
        if (root[key]) continue;
        await new Promise((resolve,reject) => {
          const script = document.createElement('script');
          script.src = new URL('./' + file + '?v=' + version, document.baseURI).href;
          script.onload = () => root[key] ? resolve() : reject(new Error(file + ' 未完成初始化'));
          script.onerror = () => { script.remove(); reject(new Error(file + ' 載入失敗')); };
          document.head.append(script);
        });
      }
    })().catch(error => {pending = null;throw error;});
  }
  return pending;
}

export function originalStockAnchors(input, analysis) {
  const archived=input?.bars;
  const sourceBars=analysis?.sourceBars;
  if (!input?.complete || !Array.isArray(archived) || !input.instrument ||
      analysis?.date!==input.analysisDate ||
      String(analysis.code)!==String(input.instrument.code)) return [];
  const columns=['date','open','high','low','close','volume'];
  const matchesSuffix=rows=>{
    if (!Array.isArray(rows)||!rows.length||rows.length>archived.length) return false;
    const tail=archived.slice(-rows.length);
    return rows.every((row,i)=>row && tail[i] &&
      columns.every(key=>row[key]===tail[i][key]));
  };
  if (!matchesSuffix(sourceBars)) return [];
  const {code,market,basis}=input.instrument, out=[];
  const verifiedChart=study=>study?.state==='RESEARCH_ONLY' &&
    String(study.code)===String(code) && study.date===input.analysisDate &&
    study.chart?.basisVerified===true && study.chart?.calendarVerified===true &&
    study.chart.priceBasis===basis && matchesSuffix(study.chart.bars);
  const add=(kind,price,knownDate,source,invalidatedDate=null)=>{
    if (Number.isFinite(price)&&price>0&&knownDate&&source) out.push({
      kind,price,knownDate,source,invalidatedDate,code,market,basis,verified:true,
      availability:'DERIVED_FROM_COMPLETED_SESSION'
    });
  };
  const unified=analysis.unifiedResearch;
  if (verifiedChart(unified)) {
    const dates=new Set(unified.chart.bars.map(row=>row.date));
    for (const level of unified.levels || []) {
      const kind={PIVOT_HIGH:'RESISTANCE',PIVOT_LOW:'SUPPORT',RANGE_HIGH:'NH'}[level.kind];
      if (kind&&level.confirmationStatus==='CONFIRMED_REFERENCE'&&dates.has(level.confirmedAt))
        add(kind,level.price,level.confirmedAt,level.source);
    }
    for (const pattern of unified.chart.patterns || []) {
      if (pattern.type==='DOUBLE_BOTTOM'&&dates.has(pattern.formedAt))
        add('NECKLINE',pattern.neckline,pattern.formedAt,'原已確認雙底頸線');
    }
  }
  const n=analysis.nContinuation;
  if (verifiedChart(n) && n.gates?.priceBasisVerified===true && n.gates?.calendarVerified===true) {
    const byDate=new Map(n.chart.bars.map(row=>[row.date,row]));
    const confirmedPivot=(point,type)=>{
      const bar=byDate.get(point?.pivotDate);
      return point?.type===type && !!bar && byDate.has(point.knownAt) &&
        point.pivotDate<point.knownAt && point.knownAt<=input.analysisDate &&
        Number.isFinite(point.price) && point.price===bar[type==='HIGH'?'high':'low'];
    };
    for (const event of n.history || []) {
      const {A,B,C,knownAt,invalidatedAt}=event;
      if (!confirmedPivot(A,'LOW')||!confirmedPivot(B,'HIGH')||!confirmedPivot(C,'LOW')||
          !(A.pivotDate<B.pivotDate&&B.pivotDate<C.pivotDate&&A.price<C.price&&C.price<B.price)||
          knownAt!==C.knownAt||A.knownAt>knownAt||B.knownAt>knownAt||
          (invalidatedAt!=null&&(!byDate.has(invalidatedAt)||invalidatedAt<knownAt))) continue;
      add('N_B',B.price,knownAt,'原 N 字 B 點',invalidatedAt);
      add('N_C',C.price,knownAt,'原 N 字 C 點',invalidatedAt);
    }
  }
  // The legacy ABC report exposes prices but not a verified historical confirmation
  // timestamp. Never relabel N pivots or infer an ABC knownDate from a price match.
  return out;
}

export async function makeStudyReport({source, study, analysis, benchmark, marketRisk, quality, dataAsOf, index = false}) {
  await loadScripts();
  const report = root.ShitouPostmarketReport926;
  const input = report.archiveInput(source,{index,dataAsOf});
  if (input.analysisDate !== (study.dataAsOf||study.date)) return null;
  const line = study.event;
  const levels = !line?.referenceOnly && Number.isFinite(line?.lifeLinePrice) && line.k0Date<=input.analysisDate
    ? {lifeLine:{date:input.analysisDate,code:input.instrument.code,market:input.instrument.market,verified:true,
      source:'原 0～3 號 K 生命線',publishedAt:input.analysisDate+'T23:59:59.999+08:00',price:line.lifeLinePrice}} : {};
  if (levels.lifeLine) {
    // The line is derived from the already verified completed snapshot; it binds to the same Taipei session.
    const receipt = Date.parse(input.dataAsOf);
    if (Number.isFinite(receipt)) levels.lifeLine.publishedAt = new Date(
      Math.min(receipt,Date.parse(levels.lifeLine.publishedAt))).toISOString();
  }
  const result = root.ShitouPostmarketTrend926.analyze(input,{levels,anchors:index?[]:originalStockAnchors(input,analysis),
    benchmark:benchmark?report.archiveInput(benchmark,{index:true}):undefined});
  let syntheticCrossRead;
  if (!index && root.ShitouHeikinAshi920 && result.status==='AVAILABLE' && study.validatedBars?.length>=5) {
    const series = root.ShitouHeikinAshi920.calculate(study.validatedBars);
    const current = series.at(-1), prior = series.at(-2);
    if (current.date===result.analysisDate) {
      const sameColor=series.findLastIndex(k=>k.color!==current.color);
      const conflict=current.color==='紅K'&&current.realClose<prior.realClose || current.color==='綠K'&&current.realClose>prior.realClose;
      syntheticCrossRead=`連續 ${series.length-1-sameColor} 根${current.color}｜${conflict?'顏色與真實收盤方向不同':'同步核對真實收盤與原生命線'}`;
    }
  }
  return report.view(input,result,{riskLabel:marketRisk?.risk?.label,originalQuality:quality,syntheticCrossRead});
}

export async function makeStudyPage({watermark = false, ...inputs}) {
  const report=await makeStudyReport(inputs);
  return report ? root.ShitouPostmarketReport926.page(report,{watermark}) : null;
}

export async function modelPreviewReading(source, {index = false, analysis, document = root.document} = {}) {
  const study=index ? root.ShitouMarketLife96?.evaluate(source) : root.ShitouKlineLife03Report?.inspect(analysis);
  if (!study || (index && study.sourceVerified !== true)) return null;
  const proof=index ? null : root.ShitouOfficialResearchHistory?.proof(source);
  const report=await makeStudyReport({source,study,analysis,index,dataAsOf:proof?.generatedAt});
  if (!report) return null;
  const lines=report.lines.filter(({label})=>['盤後研究','關鍵價位','開盤觀察'].includes(label) ||
    label.startsWith('下一交易日收盤情境'));
  return ()=>root.ShitouPostmarketReport926.previewText(document,lines,'盤後條件與價位（技術研究）');
}
