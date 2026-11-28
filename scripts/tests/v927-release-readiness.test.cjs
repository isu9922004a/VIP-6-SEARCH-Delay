'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{audit}=require('../audit-v927-release.cjs'),protocol=require('../fixtures/postmarket-study-v926.cjs');
test('missing and exploratory evidence cannot authorize research or scores',()=>{
 for(const r of [null,{}, {protocol,pointInTimeVerified:false,studies:[]}, {protocol,pointInTimeVerified:true,status:'VALIDATED_INDEPENDENT_POINT_IN_TIME',studies:[null,{symbol:'TAIEX',holdout:{samples:999,metrics:{}},walkForward:[]}]}]){
 const a=audit(r);assert.equal(a.status,'BLOCKED');assert.equal(a.publicResearchEnabled,false);assert.equal(a.productionScoreEnabled,false);assert.ok(a.blockers.length);
 }
});
test('known low sample and negative lift are explicit',()=>{
 const r=audit({protocol,pointInTimeVerified:false,status:'EXPLORATORY_NOT_VALIDATED',studies:[{symbol:'TAIEX',holdout:{samples:44,metrics:{5:{BULL:{shadow:{signalCount:15,precision:.467},baseline:{signalCount:17,precision:.529}},BEAR:{shadow:{signalCount:17,precision:.765},baseline:{signalCount:17,precision:.704}}}}}}]});
 assert.ok(r.blockers.some(x=>x.id==='DIRECTION_SAMPLE'&&x.detail.startsWith('TAIEX 5 BULL')));
 assert.ok(r.blockers.some(x=>x.id==='PRECISION_LIFT'&&x.detail.startsWith('TAIEX 5 BULL')));
 assert.ok(r.blockers.some(x=>x.id==='POINT_IN_TIME'));assert.equal(r.metrics.find(x=>x.horizon===5&&x.direction==='BULL').lift,.467-.529);
});
