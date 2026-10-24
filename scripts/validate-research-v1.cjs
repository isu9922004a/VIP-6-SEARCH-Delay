const fs=require('fs'),path=require('path'),V=require('../research-validation-v1.js');
const input=process.argv[2],output=process.argv[3];
let result;if(!input)result={status:'BLOCKED_MISSING_POINT_IN_TIME_HISTORY',performanceProven:false,groups:V.GROUPS,foundationGroups:V.FOUNDATION_GROUPS,dualGroups:V.DUAL_GROUPS,missing:['逐日歷史全市場含下市股票與當日分類','原六策略歷史候選分數與排序','同日已完成OHLCV與正式交易日曆','營收發布時間、歷史籌碼／股數／正式成交值','可執行成交與成本、樣本外區間及市場環境'],note:'倉庫只有市場快照，不能由現值推造歷史Precision@8。'};else {const data=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));result=V.walkForward(data.snapshots,data.split);}
if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2));else console.log(JSON.stringify(result,null,2));
