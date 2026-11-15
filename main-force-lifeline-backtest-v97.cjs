/* Independent, causal research replay. Current classifications cannot certify old eligibility. */
'use strict';
const Core=require('./kline-life-03-core-v1'),Engine=require('./main-force-lifeline-core-v97');
const COSTS=Object.freeze({buyFee:.001425,sellFee:.001425,sellTax:.003,slippageEachSide:.001});
function netReturn(entry,exit,costs=COSTS){return (exit*(1-costs.sellFee-costs.sellTax-costs.slippageEachSide)/(entry*(1+costs.buyFee+costs.slippageEachSide))-1)*100;}
function replay({histories,sessions,asOf,pointInTime={},days=120,costs=COSTS}){
 const dates=sessions.filter(d=>d<=asOf).slice(-days),out={strategy:Engine.ID,asOf,requestedSessions:days,availableSessions:dates.length,costs,performanceValidated:false,status:'BLOCKED_MISSING_POINT_IN_TIME_HISTORY',newbornEvents:0,pointInTimeBlocked:0,executionBlocked:0,immature:0,completeSamples:0,outOfSample:{validated:false,reason:'尚無獨立、具時點資格證據的樣本外資料'},groups:{}};
 for(const group of ['PURE_K0','K0_DISTANCE','K0_VOLUME','K0_FULL_SCORE'])out.groups[group]=Object.fromEntries([1,3,5].map(n=>[n,[]]));
 const diagnostics=[];
 for(const [code,raw]of Object.entries(histories)){
  const v=Core.validate(raw);if(!v.ok)continue;const bars=v.bars;
  for(const date of dates){const i=bars.findIndex(b=>b.date===date);if(i<3)continue;const prefix=bars.slice(0,i+1),expected=sessions.filter(d=>d>=prefix[0].date&&d<=date);if(expected.length!==prefix.length||expected.some((d,j)=>d!==prefix[j].date))continue;
   const seed=Core.detect(prefix,{code}).find(e=>e.side==='BULL'&&e.k0Date===date&&e.k0Index===i);if(!seed)continue;out.newbornEvents++;
   const p=pointInTime[date]?.[code];
   // A dated master published by that close is mandatory. Do not borrow today's membership/status.
   if(!p||p.verified!==true||p.date!==date||p.code!==code||!Number.isFinite(Date.parse(p.publishedAt))||Date.parse(p.publishedAt)>Date.parse(date+'T23:59:59+08:00')||p.liquidity?.security?.asOf>date||p.corporateActionsVerified!==true||p.executionRulesVerified!==true){out.pointInTimeBlocked++;continue;}
   const at={...raw,sourceBars:prefix,validation:{technicalModelAvailable:true},date,closeDate:date,marketDate:date,close:prefix.at(-1).close,expectedTradingDates:expected,securityType:p.securityType,tradingStatus:p.tradingStatus};
   const r=Engine.classify({raw:at,quote:p.quote,targetDate:date,sessions,exclusions:p.exclusions,liquidity:p.liquidity});if(r.kind!=='NEWBORN'||!r.qualified)continue;
   const entry=bars[i+1];if(!entry){out.immature++;continue;}
   // A marketable next-session open is an explicit execution assumption, never assumed on locked bars.
   if(!p.nextSessionExecution||p.nextSessionExecution.date!==entry.date||p.nextSessionExecution.canBuyOpen!==true){out.executionBlocked++;continue;}
   const groups=['PURE_K0',...(r.distancePct>=0&&r.distancePct<=6?['K0_DISTANCE']:[]),...(r.volumeVerified&&r.volumeRatio>=.8&&r.volumeRatio<=2.5?['K0_VOLUME']:[]),...(r.formalCandidate?['K0_FULL_SCORE']:[])];
   for(const n of [1,3,5]){const end=bars[i+n];if(!end||end.date>asOf){out.immature++;continue;}if(!p.exitExecution?.[n]||p.exitExecution[n].date!==end.date||p.exitExecution[n].canSellClose!==true){out.executionBlocked++;continue;}const result={code,signalDate:date,eventId:seed.eventId,entryDate:entry.date,entry:entry.open,exitDate:end.date,exit:end.close,netPct:netReturn(entry.open,end.close,costs)};for(const group of groups)out.groups[group][n].push(result);out.completeSamples++;}
  }
 }
 if(out.completeSamples>0)out.status='RESEARCH_ONLY_NOT_OUT_OF_SAMPLE_VALIDATED';
 for(const [group,horizons]of Object.entries(out.groups))for(const [n,samples]of Object.entries(horizons)){const returns=samples.map(s=>s.netPct);diagnostics.push({group,horizon:Number(n),samples:samples.length,meanNetPct:returns.length?returns.reduce((a,b)=>a+b,0)/returns.length:null,positiveFraction:returns.length?returns.filter(v=>v>0).length/returns.length:null});}
 out.summary=diagnostics;out.limitations=['逐日母體、產業、交易狀態、除權息及可成交性缺一不可','沒有使用今天的產業與資格回填過去','未取得可核驗樣本外資料，績效維持未驗證','未到期訊號與不可成交訊號不納入已完成報酬'];return out;
}
module.exports={COSTS,netReturn,replay};
