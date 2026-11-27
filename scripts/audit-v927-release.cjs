'use strict';
const fs=require('node:fs');
const policy=require('./fixtures/postmarket-study-v926.cjs');
function audit(report){
 const blockers=[],metrics=[];
 const add=(id,detail)=>blockers.push({id,detail});
 if(JSON.stringify(report?.protocol)!==JSON.stringify(policy))add('PROTOCOL','Frozen protocol differs or missing');
 if(report?.pointInTimeVerified!==true)add('POINT_IN_TIME','Historical snapshots and market membership not independently verified');
 const studies=Array.isArray(report?.studies)?report.studies:[];
 for(const expected of policy.instruments)if(!studies.some(s=>s?.symbol===expected.symbol))add('MISSING_INSTRUMENT',expected.symbol);
 for(const s of studies){
  if(!s||typeof s.symbol!=='string'){add('INVALID_STUDY','Missing symbol');continue;}
  if(!Number.isInteger(s.holdout?.samples)||s.holdout.samples<policy.minimumOverall)add('OVERALL_SAMPLE',s.symbol+' holdout below '+policy.minimumOverall);
  for(const horizon of policy.horizons)for(const direction of ['BULL','BEAR']){
   const m=s.holdout?.metrics?.[horizon]?.[direction],shadow=m?.shadow,baseline=m?.baseline;
   const valid=x=>Number.isInteger(x?.signalCount)&&x.signalCount>=policy.minimumPerEvent&&Number.isFinite(x.precision)&&x.precision>=0&&x.precision<=1;
   const lift=Number.isFinite(shadow?.precision)&&Number.isFinite(baseline?.precision)?shadow.precision-baseline.precision:null;
   metrics.push({symbol:s.symbol,horizon,direction,shadowCount:shadow?.signalCount??null,baselineCount:baseline?.signalCount??null,lift});
   if(!valid(shadow)||!valid(baseline))add('DIRECTION_SAMPLE',s.symbol+' '+horizon+' '+direction+' below sample minimum or invalid');
   if(lift!==null&&lift<policy.minimumPrecisionLift)add('PRECISION_LIFT',s.symbol+' '+horizon+' '+direction+' below frozen precision lift');
  }
  if(!Array.isArray(s.walkForward)||s.walkForward.length!==policy.holdoutBlocks)add('WALK_FORWARD',s.symbol+' missing frozen walk-forward blocks');
 }
 if(report?.status!=='VALIDATED_INDEPENDENT_POINT_IN_TIME')add('EXPLORATORY_ONLY','Independent validation not supplied');
 // This auditor describes the current exploratory schema only, not a production authorization mechanism.
 return {release:'V9.27',scope:'EXPLORATORY_REPLAY_ONLY',status:blockers.length?'BLOCKED':'REQUIRES_INDEPENDENT_RELEASE_REVIEW',publicResearchEnabled:false,productionScoreEnabled:false,blockers,metrics};
}
if(require.main===module){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: audit-v927-release.cjs INPUT OUTPUT');const result=audit(JSON.parse(fs.readFileSync(input)));fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,blockers:result.blockers.length,publicResearchEnabled:false}));}
module.exports={audit};
