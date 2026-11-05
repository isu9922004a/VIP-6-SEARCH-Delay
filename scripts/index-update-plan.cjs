'use strict';
const fs=require('fs'),path=require('path'),F=require('../research-v83/forecast-engine.js'),M=require('../research-v83/market-engine.js');
function plan(history,model,expected){
 const analysis=M.analyze(history),matched=analysis.state==='AVAILABLE'&&model?.asOf===history.closeDate&&F.evaluate(analysis.input,model).state==='MODEL_SAMPLE'&&F.executionVerified(model);
 const current=history?.closeDate===expected&&matched;
 return {needed:!current,expectedCompletedDate:expected,indexDate:history?.closeDate||null,modelDate:model?.asOf||null,reason:current?'最近完成交易日的行情與模型已核對，略過重算':'需要補上最新完成交易日的行情或相符模型'};
}
async function main(){const root=path.resolve(__dirname,'..'),get=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),market=get('data/market/latest.json');if(market.marketCalendar?.ready!==true)throw Error('缺少官方交易日曆，不猜測應更新日期');const {expectedCompletedDate}=await import('./update-market-snapshot.mjs'),raw=expectedCompletedDate(market.marketCalendar),date=raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6);let model=null;try{model=get('data/kronos/TAIEX.json');}catch{}const r=plan(get('data/index/TAIEX.json'),model,date);console.log(JSON.stringify(r));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'needed='+r.needed+'\n');}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={plan};
