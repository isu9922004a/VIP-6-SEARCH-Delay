'use strict';
// Synthetic ranking/overflow cases only. Never loaded by the application or official audit.
const E=require('../../main-force-lifeline-core-v97.js'),{sample}=require('./main-force-v97.cjs');
function snapshot(n=3,{insufficient=0,stopped=false}={}){
 const snapshotId='UNIT_V971_ONLY',records=[];
 for(let i=n;i>0;i--){const x=sample({volume:6000000}),code=String(9000+i);x.raw.stock=x.raw.code=x.quote.code=x.liquidity.code=x.liquidity.security.code=code;x.raw.name=x.quote.name='合成介面測試'+i;x.liquidity.tradeValue=61200000;x.proof.snapshotId=snapshotId;records.push(E.classify(x));}
 for(let i=0;i<insufficient;i++)records.push({kind:'INSUFFICIENT_DATA',code:String(8000+i),name:'合成資料不足',date:records[0]?.date||'2026-11-13',reason:'合成介面測試，非正式行情'});
 return {...E.summarize(records,{total:records.length+(stopped?1:0),completed:!stopped,date:records[0]?.date||'2026-11-13',snapshotId}),stopped};
}
module.exports={snapshot};
