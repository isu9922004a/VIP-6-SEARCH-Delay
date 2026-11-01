'use strict';
const fs=require('fs'),path=require('path'),base=path.resolve(__dirname,'../data/kronos'),stocks={};
for(const file of fs.readdirSync(path.join(base,'stocks'))){if(!/^\d{4,6}\.json$/.test(file))continue;const f=JSON.parse(fs.readFileSync(path.join(base,'stocks',file),'utf8'));if(f.kind==='KRONOS_INFERENCE'&&f.sampleCount===32)stocks[f.symbol]={asOf:f.asOf,targetDate:f.targetDates[0]};}
fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify({schema:'shitou-kronos-catalog-v1',generatedAt:new Date().toISOString(),stocks},null,2));console.log('Kronos catalog entries',Object.keys(stocks).length);
