/* Explicit preview of the independent study page. Loaded only with postmarket-study=1. */
const root = globalThis;
const version = 'V9.26-RESEARCH-1';
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

export async function makeStudyPage({source, study, marketRisk, quality, dataAsOf, watermark = false, index = false}) {
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
  const result = root.ShitouPostmarketTrend926.analyze(input,{levels});
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
  const canvas=report.page(report.view(input,result,{riskLabel:marketRisk?.risk?.label,
    originalQuality:quality,syntheticCrossRead}),{watermark});
  return canvas;
}
