'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),E=require('../main-force-lifeline-core-v97'),C=require('../kline-life-03-core-v1'),S=require('../main-force-lifeline-scanner-v97'),B=require('../main-force-lifeline-backtest-v97.cjs');
async function main(){
 const out=path.resolve(process.argv[2]||'/tmp/v97-audit');fs.mkdirSync(out,{recursive:true});
 const market=require('../data/market/latest.json'),manifest=require('../data/research/manifest.json'),calendar=require('../data/index/TAIEX.json').tradingCalendar,liquidity=require('../lifeline-liquidity-v97.json'),histories={},oracle=[];
 const result=await S.scan({market,manifest,calendar,liquidity,now:new Date(process.env.V97_AS_OF||Date.now()),concurrency:4,loadReport:async item=>{
  const text=fs.readFileSync(path.join(__dirname,'../data/research',item.path),'utf8');assert.equal(crypto.createHash('sha256').update(text).digest('hex'),item.sha256);const raw=JSON.parse(text);histories[item.code]=raw;
  const v=E.validateBars(raw,manifest.date,manifest.researchSessions);if(v.ok){const [a,b,c,z]=v.bars.slice(-4);if(a.high<b.high&&b.high<c.high&&!(a.low>b.low&&b.low>c.low)&&z.high<=c.high)oracle.push(item.code);}return raw;
 }});
 assert.equal(result.counts.parsed,market.rows.length);assert.equal(result.counts.unfinished,0);assert.equal(result.counts.serviceFailed,0);assert.deepEqual(result.newborn.map(r=>r.code).sort(),oracle.sort());assert.equal(new Set(result.newborn.map(r=>r.eventId)).size,result.newborn.length);
 for(const r of result.newborn){assert.equal(r.date,manifest.date);assert.equal(r.seed.k0Index,histories[r.code].dailySeries.length-1);assert.equal(C.detect(C.validate(histories[r.code]).bars,{code:r.code}).some(e=>e.eventId===r.eventId),true);}
 const clean=r=>{const {raw,...value}=r;return value;};const saved={...result,records:result.records.map(clean),newborn:result.newborn.map(clean),top8:result.top8.map(clean),groups:Object.fromEntries(Object.entries(result.groups).map(([k,a])=>[k,a.map(clean)])),oracle:{checked:market.rows.length,newborn:oracle.length,allMatch:true}};
 fs.writeFileSync(path.join(out,'scan.json'),JSON.stringify(saved,null,2));
 const replay=B.replay({histories,sessions:manifest.researchSessions,asOf:manifest.date,days:120});fs.writeFileSync(path.join(out,'backtest.json'),JSON.stringify(replay,null,2));
 console.log(JSON.stringify({date:result.date,counts:result.counts,top8:result.top8.map(r=>({code:r.code,name:r.name,score:r.score,distancePct:r.distancePct,grade:r.grade})),oracle:saved.oracle,backtest:{status:replay.status,availableSessions:replay.availableSessions,newbornEvents:replay.newbornEvents,pointInTimeBlocked:replay.pointInTimeBlocked,completeSamples:replay.completeSamples}},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
