/* Three scanners share product/industry/status exclusions. RSI is display-only. */
(function(root,factory){const api=factory();if(root)root.ShitouScanPolicy5328=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const RULE=Object.freeze({minVolume:150000,minTradeValue:15000000,version:'R5.3.2.8'});
const LABELS=Object.freeze({FULL_DELIVERY:'全額交割／變更交易排除',DR:'DR類股排除',SPECIAL:'ETF／ETN／受益證券／特殊商品排除',FINANCIAL:'金融排除',BIOTECH:'生技排除',CONSTRUCTION:'營建排除',ILLIQUID:'低流動性排除',UNKNOWN:'產業分類不足',STATUS_UNKNOWN:'全額交割狀態未核對'});
const number=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(String(v).replace(/,/g,'')))?Number(String(v).replace(/,/g,'')):null;
function date(v){const s=String(v??'').replace(/\D/g,'');const t=s.length===7?String(Number(s.slice(0,3))+1911)+s.slice(3):s;if(t.length!==8)return null;const out=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6);const d=new Date(out+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===out?out:null;}
const yes=v=>v===true||v===1||/^(Y|YES|TRUE|1|是)$/i.test(String(v??'').normalize('NFKC').trim());
function classify(code,q={},sector={},meta={}){
 code=String(code).trim();const r={...sector,...q},name=String(r.name||r.stockName||''),kind=String(r.securityType||r.productType||r.instrumentType||'').toUpperCase(),industry=String(sector.industryName||sector.industry||r.industryName||r.industry||''),ic=String(sector.industryCode||r.industryCode||'').padStart(2,'0');
 let key='OK';
 if(yes(r.fullDelivery)||yes(r.isFullDelivery)||yes(r.alteredTrading)||yes(r.AlteredTrading)||/全額交割|變更交易/.test(String(r.tradingMethod||r.tradingStatus||'')))key='FULL_DELIVERY';
 else if(kind==='DR'||/^91\d{2,4}$/.test(code)||/(?:^|[-－\s])DR(?:$|[-－\s])/i.test(name)||/臺灣存託憑證|台灣存託憑證|存託憑證/.test(name+' '+kind))key='DR';
 else if(!/^[1-9]\d{3}$/.test(code)||/ETF|ETN|REIT|WARRANT|FUND|PREFERRED|BOND|BENEFICIARY/.test(kind)||/受益證券|受益憑證|權證|指數投資|特別股|基金/.test(name)||yes(r.isSpecialProduct)||yes(r.ManagedStock)||yes(r.SuspensionOfTrading))key='SPECIAL';
 else if(ic==='17'||/金融|銀行|保險|證券|金控/.test(industry))key='FINANCIAL';
 else if(ic==='22'||/生技|生物科技|醫療|醫材|製藥|藥品/.test(industry))key='BIOTECH';
 else if(ic==='14'||/建材營造|營建|營造|建設|房地產|不動產/.test(industry))key='CONSTRUCTION';
 else if(!industry&&(!ic||ic==='00'))key='UNKNOWN';
 else if(!(number(q.volume)>=RULE.minVolume)||!(number(q.tradeValue)>=RULE.minTradeValue)||(number(q.avg5Volume)!==null&&number(q.avg5Volume)<RULE.minVolume)||(number(q.avg5Lots)!==null&&number(q.avg5Lots)<RULE.minVolume/1000))key='ILLIQUID';
 else if(!date(meta.targetTradeDate||meta.completedTradeDate)||(!(meta.exclusionCoverageReady===true&&date(meta.exclusionDate)===date(meta.targetTradeDate||meta.completedTradeDate))&&!(r.fullDelivery===false&&date(r.fullDeliveryDate)===date(meta.targetTradeDate||meta.completedTradeDate))))key='STATUS_UNKNOWN';
 return {key,excluded:key!=='OK',reason:LABELS[key]||'',policy:RULE.version};
}
function rsi(source={}){
 const r=source.report||source,expected=date(r.closeDate||r.dataDate||source.date),direct=number(r.dailyRsi5??r.dailyRsi),stated=date(r.dailyRsi5Date||r.rsiDate||r.closeDate||r.dataDate);
 if(direct!==null&&direct>=0&&direct<=100&&(!expected||stated===expected))return {value:direct,date:stated||expected,source:'原報告RSI5'};
 const a=r.canonicalBars||r.dailySeries;let valid=Array.isArray(a)&&a.length>=6,prior='';
 if(valid)for(const b of a){const d=date(b.date);if(!d||d<=prior||!(number(b.close)>0)||b.completed===false||b.isComplete===false){valid=false;break;}prior=d;}
 if(valid&&(!expected||prior===expected)){
  let gain=0,loss=0;for(let i=1;i<=5;i++){const delta=Number(a[i].close)-Number(a[i-1].close);gain+=Math.max(0,delta);loss+=Math.max(0,-delta);}gain/=5;loss/=5;
  for(let i=6;i<a.length;i++){const delta=Number(a[i].close)-Number(a[i-1].close);gain=(gain*4+Math.max(0,delta))/5;loss=(loss*4+Math.max(0,-delta))/5;}
  return {value:loss===0?(gain===0?50:100):100-100/(1+gain/loss),date:prior,source:'完成日K Wilder RSI(5)'};
 }
 const legacy=number(source.rsi5??source.rsi);if(legacy!==null&&legacy>=0&&legacy<=100&&(!source.rsiPeriod||Number(source.rsiPeriod)===5)&&(!expected||date(source.rsiDate||source.date||r.closeDate)===expected))return {value:legacy,date:expected,source:'掃描RSI5'};
 return {value:null,date:expected,source:'資料不足'};
}
function rsiStatus(source){
 const x=rsi(source),r=source?.report||source||{},a=r.canonicalBars||r.dailySeries;let previous=null;
 if(Array.isArray(a)&&a.length>6&&date(a.at(-1).date)===x.date){const calculated=rsi({dailySeries:a,closeDate:x.date});if(calculated.value!==null&&x.value!==null&&Math.abs(calculated.value-x.value)<.05)previous=rsi({dailySeries:a.slice(0,-1),closeDate:a.at(-2).date}).value;}
 let key='UNAVAILABLE',icon='⚪',label='熱度資料不足',color='#40556b';
 if(x.value!==null){if(previous!==null&&previous>=70&&x.value<70){key='LOST_70';icon='🔴';label='跌回70下方｜動能退潮提醒';color='#a01f37';}else if(x.value>90){key='OVERHEAT';icon='🔴';label='高於90｜高檔反轉風險提醒';color='#a01f37';}else if(x.value>70){key='STRONG';icon='🟠';label='強勢動能區｜高檔留意追價';color='#805008';}else if(x.value===70){key='AT_70';icon='🟡';label='70門檻附近｜等量價確認';color='#805008';}else if(x.value>65){key='TURNING';icon='🟢';label='高於65｜轉強觀察';color='#096b43';}else{key='OBSERVE';icon='⚪';label='未達圖示動能門檻｜觀察';}}
 const closes=Array.isArray(a)&&a.length>=20?a.slice(-20).map(b=>number(b.close)):[];const ma20=number(r.dailyMa20??r.ma20)??(closes.length===20&&closes.every(v=>v!==null)?closes.reduce((s,v)=>s+v,0)/20:null),close=number(r.close??a?.at(-1)?.close);
 const maText=ma20===null||close===null?'20日均線：資料不足':close<ma20?'收盤低於20日線｜圖示防守提醒':'收盤維持20日線之上／相等｜續抱條件仍須籌碼佐證';
 return {...x,key,icon,label,color,previous,ma20,maText,note:'依參考圖的65／70／90門檻作提示；只呈現RSI與日K可核對的項目，周轉率、籌碼、主力賣超不補猜；不改原策略分數、排名或買賣資格。'};
}
function rsiText(source,heat=false){const x=heat?rsiStatus(source):rsi(source),text='RSI 5T '+(x.value===null?'資料不足':x.value.toFixed(2));return heat?text+'｜'+x.icon+' '+x.label:text;}
function volume(source={}){
 const r=source.report||source,b=r.canonicalBars||r.dailySeries,wanted=date(r.closeDate||r.dataDate||source.date),missing={available:false,todayLots:null,yesterdayLots:null,changePct:null,state:'UNAVAILABLE',label:'量縮／量增：昨日資料不足',date:wanted};
 if(!Array.isArray(b)||b.length<1)return missing;const last=b.at(-1),prev=b.at(-2),d=date(last.date),v=number(last.volume),unit=String(r.volumeUnit||last.volumeUnit||'shares').toLowerCase(),factor=['lots','張'].includes(unit)?1:1000;
 if(!d||wanted&&d!==wanted||v===null||v<0||last.completed===false||last.isComplete===false)return missing;
 const todayLots=v/factor;if(!prev||!date(prev.date)||date(prev.date)>=d||number(prev.volume)===null||number(prev.volume)<0||prev.completed===false||prev.isComplete===false)return {...missing,todayLots,date:d};
 if(prev.volumeUnit&&String(prev.volumeUnit).toLowerCase()!==unit)return {...missing,todayLots,date:d,label:'量縮／量增：成交量單位不一致'};
 const pv=number(prev.volume),yesterdayLots=pv/factor,delta=v-pv,state=delta>0?'UP':delta<0?'DOWN':'FLAT',changePct=pv>0?delta/pv*100:null,label=(delta>0?'量增':delta<0?'量縮':'量平')+(changePct!==null?' '+(changePct>0?'+':'')+changePct.toFixed(2)+'%':'（昨日0張，無法計算增減百分比）');
 return {available:true,todayLots,yesterdayLots,changePct,state,label,date:d,yesterdayDate:date(prev.date)};
}
function volumeText(source){const v=volume(source),n=x=>x===null?'資料不足':x.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});return '今日 '+n(v.todayLots)+' 張｜昨日 '+n(v.yesterdayLots)+' 張｜'+v.label;}
function liquidity(source){const r=source?.report||source||{},b=r.canonicalBars||r.dailySeries;if(!Array.isArray(b)||b.length<5)return {known:false,ok:false,reason:'五日成交量資料不足'};const tail=b.slice(-5),v=tail.map(x=>number(x.volume));if(v.some(x=>x===null||x<0))return {known:false,ok:false,reason:'五日成交量缺漏'};const factor=['lots','張'].includes(String(r.volumeUnit||'shares').toLowerCase())?1000:1,average=v.reduce((s,x)=>s+x,0)/5*factor;return {known:true,ok:average>=RULE.minVolume,averageShares:average,reason:average<RULE.minVolume?'五日平均量低於150張，低流動性排除':''};}
function parseOfficial(twse,tpex,target){
 const wanted=date(target);if(!wanted||twse?.stat!=='OK'||date(twse.date)!==wanted||!Array.isArray(twse.data)||!Array.isArray(tpex))throw Error('官方變更交易資料格式或日期不一致');
 const dates=new Set(tpex.map(r=>date(r.Date)).filter(Boolean));if(dates.size!==1||!dates.has(wanted))throw Error('TPEx變更交易名單不是同一市場日期');
 const twseCodes=twse.data.map(r=>String(r[0]).trim()),tpexCodes=tpex.filter(r=>yes(r.AlteredTrading)).map(r=>String(r.SecuritiesCompanyCode).trim()),specialCodes=tpex.filter(r=>yes(r.ManagedStock)||yes(r.SuspensionOfTrading)).map(r=>String(r.SecuritiesCompanyCode).trim());
 if([...twseCodes,...tpexCodes,...specialCodes].some(c=>!/^\d{4,6}$/.test(c)))throw Error('官方變更交易代號格式不合理');
 return {version:RULE.version,ready:true,date:wanted,twseCodes,tpexCodes,specialCodes,sources:['https://www.twse.com.tw/exchangeReport/TWT85U','https://www.tpex.org.tw/openapi/v1/tpex_cmode']};
}
function applyStatus(bundle,status){const wanted=date(bundle.meta?.targetTradeDate||bundle.meta?.completedTradeDate);if(status?.ready!==true||date(status.date)!==wanted)throw Error('全額交割排除名單缺失或不同日；本輪暫停，請更新官方排除快照');const full=new Set([...status.twseCodes,...status.tpexCodes]),special=new Set(status.specialCodes||[]),map=new Map([...bundle.map].map(([code,q])=>[code,{...q,fullDelivery:full.has(code),fullDeliveryDate:wanted,isSpecialProduct:q.isSpecialProduct===true||special.has(code)}]));return {...bundle,map,meta:{...bundle.meta,exclusionCoverageReady:true,exclusionDate:wanted},exclusionStatus:status};}
return Object.freeze({RULE,LABELS,number,date,yes,classify,rsi,rsiStatus,rsiText,volume,volumeText,liquidity,parseOfficial,applyStatus});
});
