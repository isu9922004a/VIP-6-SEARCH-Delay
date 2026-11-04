'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),C=require('../four-models-research-v1.js'),S=require('../research-v83/structure-strength.js'),root=path.resolve(__dirname,'..'),m=require('../data/research/manifest.json'),counts={},failures=[];
for(const item of Object.values(m.stocks))try{
 const raw=JSON.parse(fs.readFileSync(path.join(root,'data/research',item.path))),a=C.evaluate(raw),before=JSON.stringify(a),r=S.fromAnalysis(a);counts[r.state]=(counts[r.state]||0)+1;assert.equal(JSON.stringify(a),before);assert.equal(r.tradeAllowed,false);assert.equal(r.performanceValidated,false);
 for(const e of [r.support,r.resistance].filter(Boolean)){assert.ok(e.knownAt<=a.date);assert.ok(e.referenceDate<e.knownAt);assert.equal(e.price,a.kronosInput.bars.find(b=>b.date===e.referenceDate)[e.type==='SUPPORT'?'low':'high']);assert.ok(e.age<=20);}
}catch(e){failures.push({code:item.code,error:e.message});}
console.log(JSON.stringify({date:m.date,checked:Object.keys(m.stocks).length,counts,failures},null,2));if(failures.length)process.exitCode=1;
