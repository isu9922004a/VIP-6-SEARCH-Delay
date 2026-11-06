'use strict';
/* No downloads. Explicit PIT input runs the validator; no input audits the local official archive. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),S=require('../structure-context-v1.js'),V=require('../research-validation-v1.js');
const root=path.resolve(__dirname,'..'),input=process.argv[2],output=process.argv[3];
let result;
if(input){const data=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));result=V.walkForwardEngulfRange(data.snapshots,data.split);}
else{
 const manifestPath=path.join(root,'data/research/manifest.json');
 if(!fs.existsSync(manifestPath))result={status:'BLOCKED_MISSING_ARCHIVE',performanceProven:false,missing:['data/research/manifest.json','逐日歷史母體、正式排名及成本成交證明']};
 else{
  const bytes=fs.readFileSync(manifestPath),manifest=JSON.parse(bytes),dir=path.join(root,'data/research',manifest.date),files=fs.readdirSync(dir).filter(n=>/^\d{4,6}\.json$/.test(n)),reasons={},states={},markets={},dates=[],examples=[];let corp=0,contract=0;
  for(const file of files){const r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')),a=S.confirmationResearch(r);corp+=r.priceAdjustment?.corporateActionsVerified===true;contract+=!!r.dataContract;states[a.state]=(states[a.state]||0)+1;markets[r.market]=(markets[r.market]||0)+1;const reason=a.reason||'READY_RESEARCH';reasons[reason]=(reasons[reason]||0)+1;if(examples.length<5)examples.push({code:r.stock,date:r.closeDate,state:a.state,reason:a.reason||null,bars:r.dailySeries?.length});for(const b of r.dailySeries||[])dates.push(b.date);}
  const groups=Object.fromEntries(V.ENGULF_RANGE_GROUPS.map(name=>[name,{status:'BLOCKED_MISSING_POINT_IN_TIME_HISTORY',signalSampleCount:null,nextDayUpRatio:null,return1:null,return3:null,return5:null,falseBreakoutRatio:null,maxAdverseExcursion:null,riskReward:null,missedOriginalSuccessRatio:null,top8Performance:null,coverage:null,netAfterCostReturn:null}]));
  result={schema:'ENGULF_RANGE_ARCHIVE_AUDIT_1',status:'BLOCKED_MISSING_POINT_IN_TIME_HISTORY',performanceProven:false,parameterVersion:S.CONFIRM_PARAM.version,source:{type:'LOCAL_OFFICIAL_RESEARCH_ARCHIVE',manifest:'data/research/manifest.json',manifestSha256:crypto.createHash('sha256').update(bytes).digest('hex'),manifestDate:manifest.date,sourceDays:manifest.sourceDays,referenceUniverseSize:manifest.universeCount||manifest.total||files.length,archivedStocks:files.length,markets,observedBarDates:{start:dates.sort()[0]||null,end:dates.at(-1)||null},source:'原系統官方歷史檔及Worker契約；未加發網路API'},evidence:{contractPresent:contract,corporateActionsVerified:corp,newResearchStates:states,blockingReasons:reasons,examples},groups,missing:[{item:'公司行動與價格調整逐日證明',period:'整個候選歷史區間',availableStocks:corp,requiredStocks:files.length},{item:'含下市、停止交易與當日分類的歷史全市場母體',period:'訓練及樣本外期間均未提供',availableVerifiedDailySnapshots:0},{item:'六策略當日可得輸入、原候選分數及正式TOP8原序',period:'訓練及樣本外期間均未提供',availableVerifiedDailySnapshots:0},{item:'可執行成交、費用、交易稅與滑價證明',period:'同一比較期間未提供',availableVerifiedExecutions:0}],notes:['現存股票快照不是歷史存活者無偏母體','資料缺口不等於0%勝率；四組比較樣本數為未知，不能虛報成0個有效訊號','未以日後K棒重建先前榜單；未尋優門檻','單元測試合成資料僅驗證計算，不能證明台股預測效果']};
 }
}
const json=JSON.stringify(result,null,2)+'\n';if(output){const dest=path.resolve(output);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,json);}else process.stdout.write(json);
