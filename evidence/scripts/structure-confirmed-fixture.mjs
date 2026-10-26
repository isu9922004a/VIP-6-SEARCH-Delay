// Synthetic candidate for admission/ranking tests. No exchange data or certification.
export function confirmedCandidate(extra={}) {
 const defaults={code:'1001',name:'合成測試股',mode:'A',eligible:false,confirmed:true,historicalConfirmed:true,status:'CONFIRMED',
  event:{signalDate:'2026-10-20',confirmedDate:'2026-10-21'},
  qualification:{ordinaryVerified:false,provisional:true},score:{total:65},tradeFitness:{score:70,grade:'WATCHABLE'},
  features:{close:105,tradeValue:400e6,rsi5:55,volumeRatio5:1.2,candle:{position:.8}},
  risk:{gapTriggerPct:1.5,gap20Pct:2,structureRiskPct:4.5,critical:false,reasons:[]}};
 return {...defaults,...extra,event:{...defaults.event,...extra.event},score:{...defaults.score,...extra.score},
  tradeFitness:{...defaults.tradeFitness,...extra.tradeFitness},risk:{...defaults.risk,...extra.risk},
  features:{...defaults.features,...extra.features,candle:{...defaults.features.candle,...extra.features?.candle}}};
}
