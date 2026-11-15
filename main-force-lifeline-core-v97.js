/* V9.7 fourth-strategy research policy. The shared life-line detector is unchanged. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./kline-life-03-core-v1.js'):root.ShitouKlineLife03);if(node)module.exports=api;else root.ShitouMainForceLife97=api;})(globalThis,function(Core){
'use strict';
const ID='MAIN_FORCE_LIFELINE_COST_V1';
const POLICY=Object.freeze({id:ID,minTradeValue:30000000,priorityDistance:3,maxDistance:6,minVolumeRatio:.8,maxVolumeRatio:2.5,rsiWarning:80,rsiExtreme:85,maxAtrPct:6,gapWarning:3,gradeAScore:75,performanceValidated:false,automaticTrade:false});
const INDUSTRIES=Object.freeze({'24':'半導體業','25':'電腦及週邊設備業','26':'光電業','27':'通信網路業','28':'電子零組件業','29':'電子通路業','30':'資訊服務業','31':'其他電子業','36':'數位雲端'});
const finite=v=>typeof v==='number'&&Number.isFinite(v),fmt=v=>finite(v)?v.toFixed(2):'資料不足';
function latestSession(calendar,now=new Date()){
 const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now),today=p.slice(0,10),minute=Number(p.slice(11,13))*60+Number(p.slice(14,16));
 if(calendar?.verified!==true||String(calendar.coverageYear)!==today.slice(0,4)||calendar.source!=='https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule'||!Array.isArray(calendar.dates)||calendar.dates.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||i&&d<=calendar.dates[i-1]))throw Error('最新完成交易日曆尚未核驗');
 // A dated official archive must also exist. Never turn provisional intraday data into a close.
 const date=calendar.dates.filter(d=>d<today||d===today&&minute>=1055).at(-1);if(!date)throw Error('交易日曆沒有可確認的完成日');return date;
}
function validateBars(raw,targetDate,sessions){
 const v=Core.validate(raw);if(!v.ok)return {ok:false,reason:v.reason||v.errors?.join('；')||'日 K 未通過核心驗證'};
 const bars=v.bars;if(!bars?.length||bars.at(-1).date!==targetDate||raw.closeDate!==targetDate)return {ok:false,reason:'行情不是本次目標完成交易日'};
 if(!Array.isArray(sessions)||!sessions.includes(targetDate))return {ok:false,reason:'缺少已核驗交易日序列'};
 const expected=sessions.filter(d=>d>=bars[0].date&&d<=targetDate);
 if(expected.length!==bars.length||bars.some((b,i)=>b.date!==expected[i]))return {ok:false,reason:'交易日缺漏，不能拼湊四根 K 棒'};
 return {ok:true,bars};
}
function classify({raw,quote,targetDate,sessions,exclusions,liquidity,proof}){
 const code=String(raw?.stock||raw?.code||quote?.code||''),industryQualified=!!quote?.industryCode&&INDUSTRIES[quote.industryCode]===quote.industryName,base={strategy:ID,code,name:raw?.name||quote?.name||code,market:raw?.market,date:targetDate,industryQualified,performanceValidated:false,automaticTrade:false};
 const v=validateBars(raw,targetDate,sessions);if(!v.ok)return {...base,kind:'INSUFFICIENT_DATA',reason:v.reason};
 const bars=v.bars,z=bars.at(-1),events=Core.detect(bars,{code}),seed=events.find(e=>e.side==='BULL'&&e.k0Date===targetDate&&e.k0Index===bars.length-1);
 const missing=[],excluded=[];
 if(!quote||quote.code!==code||quote.market!==raw.market||String(quote.quoteDate).replaceAll('-','')!==targetDate.replaceAll('-','')||['open','high','low','close'].some(k=>quote[k]!==z[k]))missing.push('當日快照與已核驗日 K 的股票、日期或價格不一致');
 const security=liquidity?.security;
 if(!security||security.code!==code||security.market!==raw.market||!security.asOf||security.asOf<targetDate||security.listingDate>targetDate)missing.push('官方商品主檔尚未核驗');
 else if(security.type!=='COMMON'||security.cfi!=='ESVUFR')excluded.push('官方商品分類不是一般普通股');
 if(!['TWSE','TPEX'].includes(raw.market)||raw.securityType!=='COMMON')excluded.push('不是可確認的上市櫃一般普通股');
 if(!quote?.industryCode||!quote?.industryName)missing.push('官方產業分類資料不足');else if(INDUSTRIES[quote.industryCode]!==quote.industryName)excluded.push('不在預設科技成長產業白名單');
 // The two official masters differ only in whether some sector labels end in 業.
 if(security?.industryName&&quote?.industryName?.replace(/業$/,'')!==security.industryName.replace(/業$/,''))missing.push('官方產業分類來源不一致');
 if(exclusions?.ready!==true||String(exclusions.date||exclusions.tradeDate||'').replaceAll('-','')!==targetDate.replaceAll('-','')||!['twseCodes','tpexCodes','specialCodes'].every(k=>Array.isArray(exclusions[k]))||!exclusions.sources?.includes('https://www.twse.com.tw/exchangeReport/TWT85U?response=json&date='+targetDate.replaceAll('-',''))||!exclusions.sources?.includes('https://www.tpex.org.tw/openapi/v1/tpex_cmode'))missing.push('交易狀態及處置名單尚未核驗');
 const lists=[...(exclusions?.twseCodes||[]),...(exclusions?.tpexCodes||[]),...(exclusions?.specialCodes||[])];
 if(lists.some(x=>String(x.code||x)===code)||raw.suspended||quote?.suspended||raw.tradingStatus&&raw.tradingStatus!=='NORMAL')excluded.push('全額交割、變更交易、停牌或交易狀態不明');
 if(!seed)return {...base,kind:missing.length?'INSUFFICIENT_DATA':excluded.length?'EXCLUDED':'NO_SIGNAL',reason:[...missing,...excluded].join('；')||'今天沒有新生多方 K0'};
 const study=Core.evaluate(raw),t={...(study.currentTrend||{})},line=seed.lifeLinePrice,distancePct=Math.round((z.close/line-1)*100*1e10)/1e10;
 const facts=liquidity,priceMatch=facts&&facts.code===code&&facts.market===raw.market&&facts.date===targetDate&&['open','high','low','close'].every(k=>facts[k]===z[k]);
 const tradeValue=priceMatch&&facts.verified===true&&finite(facts.tradeValue)?facts.tradeValue:null;
 if(tradeValue===null)missing.push('官方成交金額未核對，不能用收盤乘成交量代替');else if(tradeValue<POLICY.minTradeValue)excluded.push('成交金額未達三千萬元');
 const prev=bars.slice(-6,-1),averageVolume5=prev.length===5?prev.reduce((a,b)=>a+b.volume,0)/5:null;
 const volumeVerified=priceMatch&&facts.verified===true&&facts.volume===z.volume&&quote?.volume===z.volume;
 const volumeRatio=volumeVerified&&averageVolume5>0?z.volume/averageVolume5:null;t.volumeRatio=volumeRatio;
 if(!volumeVerified)missing.push('成交量待核對，暫不作量能確認');
 const technicalComplete=['ma5','ma10','ma20','rsi5','rsi14','atr14'].every(k=>finite(t[k]))&&finite(volumeRatio);
 if(!technicalComplete)missing.push('均線、漲勢急緩、平均波動或量能資料不足');
 if(distancePct<0)excluded.push('收盤已跌破 K3 生命線');
 const atrPct=finite(t.atr14)?t.atr14/z.close*100:null,previousMa5=bars.length>=6?bars.slice(-6,-1).reduce((a,b)=>a+b.close,0)/5:null;
 const prior=bars.slice(-21,-1),pressure20=prior.length===20?Math.max(...prior.map(b=>b.high)):null;
 const upperSpacePct=pressure20>z.close?(pressure20/z.close-1)*100:null;
 const scores={proximity:distancePct>=0&&distancePct<=6?25*(1-distancePct/6):0,structure:10*(z.high===z.low?.5:(z.close-z.low)/(z.high-z.low))+(z.low>=line?5:0)+(z.close>=z.open?5:2),volumeLiquidity:(tradeValue>=60000000?10:tradeValue>=30000000?5:0)+(volumeRatio===null?0:volumeRatio>=1&&volumeRatio<=2?10:volumeRatio>=.8&&volumeRatio<=2.5?7:volumeRatio<.8?2:0),trend:(z.close>t.ma20?7:0)+(t.ma5>previousMa5?5:0)+(t.ma5>=t.ma10&&t.ma10>=t.ma20?3:0),risk:(finite(t.rsi5)?t.rsi5<70?5:t.rsi5<80?3:t.rsi5<85?1:0:0)+(finite(atrPct)?atrPct<3?5:atrPct<6?3:0:0),space:pressure20===null?0:upperSpacePct===null?5:finite(atrPct)&&atrPct>0?upperSpacePct/atrPct>=2?10:upperSpacePct/atrPct>=1?7:upperSpacePct/atrPct>=.5?4:0:0};
 scores.trend=(finite(t.ma20)&&z.close>t.ma20?7:0)+(finite(t.ma5)&&finite(previousMa5)&&t.ma5>previousMa5?5:0)+(['ma5','ma10','ma20'].every(k=>finite(t[k]))&&t.ma5>=t.ma10&&t.ma10>=t.ma20?3:0);
 for(const k of Object.keys(scores))scores[k]=Math.round(scores[k]*100)/100;
 const score=Math.round(Object.values(scores).reduce((a,b)=>a+b,0)*100)/100,risks=[];
 if(distancePct>6)risks.push('收盤離生命線超過6%，不列優先追價名單');
 if(t.rsi5>=85)risks.push('最近漲得很急，屬高度追價警戒');else if(t.rsi5>=80)risks.push('最近漲得較急，要留意追高回跌');
 if(atrPct>=6)risks.push('近期每日波動較大');
 if(finite(t.deviation5)&&finite(atrPct)&&t.deviation5>2*atrPct)risks.push('股價離5日平均價較遠，追高回跌風險較大');
 if(volumeRatio!==null&&(volumeRatio<.8||volumeRatio>2.5))risks.push(volumeRatio>2.5?'突然出現異常大量，先核對原因':'當日成交量低於觀察區間');
 const qualified=!missing.length&&!excluded.length,formalCandidate=qualified&&technicalComplete&&distancePct<=6&&risks.length===0;
 const grade=formalCandidate?(distancePct<=3&&score>=75?'A':'B'):'C';
 const riskLabel=missing.length?'資料不足，無法完整評估':risks.length?'追價風險較高':'追價風險仍需留意';
 const conclusion=!qualified?'今天有新生 K0，但'+[...missing,...excluded][0]+'。':risks.length?'今天有新生 K0，但'+risks[0]+'。':'今天剛形成生命線，收盤距離 '+fmt(distancePct)+'%；仍需看下一個收盤，這不是買進指令。';
 return {...base,kind:'NEWBORN',eventId:seed.eventId,event:Core.trace(seed,bars),seed,close:z.close,lifeLinePrice:line,distancePct,k0Low:z.low,shortTermInvalidation:z.low,tradeValue,volumeVerified,volumeRatio,averageVolume5,pressure20,upperSpacePct,previousMa5,atrPct,indicators:t,score,scores,grade,qualified,formalCandidate,missing:[...new Set(missing)],excluded,risks,riskLabel,conclusion,industryQualified:!!quote?.industryCode&&INDUSTRIES[quote.industryCode]===quote.industryName,proof:proof||null,liquidityProof:priceMatch?facts:null,historyBarCount:bars.length,raw,scenarios:{A:'隔日若沒有明顯跳空、距離生命線未超過6%，且量價條件維持，可繼續觀察；不代表可以直接買進。',B:'隔日若比前一日收盤高出3%以上（參考 '+fmt(z.close*1.03)+' 元），或離生命線及短期平均價過遠，追價風險偏高。這是警示條件，不是預測目標。',C:'若跌破短線觀察價 '+fmt(z.low)+' 元，或收盤跌破原始生命線 '+fmt(line)+' 元，先不進場並重新觀察結構；兩個價位不同，也不保證能在該價成交。'}};
}
function summarize(records,{total=records.length,completed=true,date=null,snapshotId=null}={}){
 const newborn=records.filter(r=>r.kind==='NEWBORN'),sort=(a,b)=>b.score-a.score||a.distancePct-b.distancePct||a.code.localeCompare(b.code),formal=newborn.filter(r=>r.formalCandidate).sort(sort),count=f=>records.filter(f).length,top8=completed&&records.length===total?formal.slice(0,8):[];
 const counts={total,parsed:records.length,excluded:count(r=>r.kind==='EXCLUDED'||r.excluded?.length>0),industryQualified:count(r=>r.industryQualified),deepScanned:count(r=>!['SERVICE_FAILED','UNFINISHED'].includes(r.kind)),successful:count(r=>['NEWBORN','NO_SIGNAL','EXCLUDED'].includes(r.kind)),insufficient:count(r=>r.kind==='INSUFFICIENT_DATA'||r.missing?.length>0),serviceFailed:count(r=>r.kind==='SERVICE_FAILED'),unfinished:Math.max(0,total-records.length),newborn:newborn.length,A:newborn.filter(r=>r.grade==='A').length,B:newborn.filter(r=>r.grade==='B').length,C:newborn.filter(r=>r.grade==='C').length,formal:formal.length,top8:Math.min(8,formal.length)};
 counts.top8=top8.length;
 return {strategy:ID,date,snapshotId,completed:completed&&records.length===total,fullMarketCertified:completed&&records.length===total&&counts.insufficient===0&&counts.serviceFailed===0,counts,records,newborn,top8,groups:{A:newborn.filter(r=>r.grade==='A').sort(sort),B:newborn.filter(r=>r.grade==='B').sort(sort),C:newborn.filter(r=>r.grade==='C').sort(sort)},performanceValidated:false};
}
return Object.freeze({ID,POLICY,INDUSTRIES,latestSession,validateBars,classify,summarize,fmt});
});
