/* 三盤與量價波段判讀；只用完成OHLCV、三盤、波段、8/21/55與5/13/34。 */
(function(root,factory){const api=factory();if(root)root.ShitouTeacherThreePan=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MODEL='TEACHER_THREE_PAN_V1';
const PARAMETERS=Object.freeze({minBars:60,stallWarningBars:3,rangeWaves:3,note:'三日未創高是止漲預警；波段百分比/根數及分段端點為工程約定，非教材固定倍率。'});
const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(String(v).replace(/,/g,'')))?Number(String(v).replace(/,/g,'')):null;
const date=v=>{const m=String(v||'').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);if(!m)return null;const s=`${m[1]}-${m[2]}-${m[3]}`,d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:null;};
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sma=(b,k,n,end=b.length)=>end>=n?mean(b.slice(end-n,end).map(x=>x[k])):null;
const change=(a,b)=>a!==null&&b!==null?a-b:null;
const pct=(a,b)=>a!==null&&b>0?(a/b-1)*100:null;
const up=v=>v!==null&&v>0;
const fmt=v=>v===null||v===undefined?'資料不足':Number(v).toFixed(2);
const arrow=v=>v===null?'?':v>0?'↑':v<0?'↓':'→';
function validate(source){
 if(!Array.isArray(source)||!source.length)return {ok:false,reason:'缺少完成日K'};
 const bars=[];let previous='';
 for(const item of source){const d=date(item?.date||item?.tradeDate),o=number(item?.open),h=number(item?.high),l=number(item?.low),c=number(item?.close),v=number(item?.volume??item?.vol);
  if(item?.completed===false||item?.isComplete===false||!d||d<=previous||!(o>0&&h>0&&l>0&&c>0&&v!==null&&v>=0)||h<Math.max(o,c,l)||l>Math.min(o,c,h))return {ok:false,reason:'日K日期、順序、完成狀態或OHLCV不完整；停止判讀'};
  bars.push({date:d,open:o,high:h,low:l,close:c,volume:v});previous=d;
 }
 return {ok:true,bars};
}
function signal(b,i=b.length-1){if(i<2)return {key:'DATA'};const high=Math.max(b[i-1].high,b[i-2].high),low=Math.min(b[i-1].low,b[i-2].low);return {key:b[i].close>high?'UP':b[i].close<low?'DOWN':'NONE',high,low,date:b[i].date};}
function waves(b){
 let current=null;const completed=[];
 const anchor=(direction,i)=>{const candidates=[i-2,i-1,i];return candidates.reduce((best,j)=>direction==='UP'?(b[j].low<b[best].low?j:best):(b[j].high>b[best].high?j:best),candidates[0]);};
 const summarize=(w,at,ended)=>{const n=Math.max(1,w.extremeIndex-w.startIndex),ret=pct(w.extremePrice,w.startPrice);return {...w,returnPct:ret,pctPerBar:ret/n,barsToExtreme:n,averageVolume:mean(b.slice(w.startIndex,at+1).map(x=>x.volume)),confirmedAt:b[at].date,confirmedIndex:at,ended};};
 for(let i=2;i<b.length;i++){
  const s=signal(b,i),dir=s.key==='UP'?'UP':s.key==='DOWN'?'DOWN':null;
  if(!current&&dir){const j=anchor(dir,i);current={direction:dir,startIndex:j,startDate:b[j].date,startPrice:dir==='UP'?b[j].low:b[j].high,signalDate:b[i].date,signalIndex:i,extremeIndex:i,extremeDate:b[i].date,extremePrice:dir==='UP'?b[i].high:b[i].low};}
  else if(current&&dir&&dir!==current.direction){
   completed.push(summarize(current,i,true));const j=current.extremeIndex,start=current.extremePrice;
   current={direction:dir,startIndex:j,startDate:b[j].date,startPrice:start,signalDate:b[i].date,signalIndex:i,extremeIndex:i,extremeDate:b[i].date,extremePrice:dir==='UP'?b[i].high:b[i].low};
  }
  if(current){const p=current.direction==='UP'?b[i].high:b[i].low;if(current.direction==='UP'?p>current.extremePrice:p<current.extremePrice){current.extremeIndex=i;current.extremeDate=b[i].date;current.extremePrice=p;}}
 }
 return {completed,current:current?summarize(current,b.length-1,false):null,endpointConvention:'首波取訊號三根區間極值；換向從前波極值起，完成確認日另記；只讀截至當日的前綴。'};
}
function structure(w,b){
 const list=w.completed.slice(-3);if(list.length<3)return {key:'UNCONFIRMED',label:'波段結構待確認',plain:'尚不足三個完成波段，不硬判箱型或長期多空。'};
 const a=list[0],p=list[1],z=list[2];
 const same=a.direction===z.direction,better=same&&(z.direction==='UP'?z.extremePrice>a.extremePrice:z.extremePrice<a.extremePrice),power=Math.abs(z.pctPerBar)>Math.abs(p.pctPerBar),volume=z.averageVolume>p.averageVolume;
 let key='MIXED',label='多空結構未同步',plain='前高前低與波段量價尚未形成一致方向。';
 const held=same&&(z.direction==='UP'?z.startPrice>=a.startPrice:z.startPrice<=a.startPrice);
 if(better&&power&&volume&&held){key=z.direction==='UP'?'BULL':'BEAR';label=key==='BULL'?'多方波段型態':'空方波段型態';plain=key==='BULL'?'上漲波較回檔強，量較大、延伸前高並守住前波低。':'下跌波較反彈強，量較大、延伸前低並未越過前波高。';}
 if(key==='BULL'&&b.at(-1).close<z.startPrice){key='BROKEN_BULL';label='前波低點失守';plain='當前收盤已失守前波起漲低點，已完成多方型態需要重新建立。';}
 if(key==='BEAR'&&b.at(-1).close>z.startPrice){key='BROKEN_BEAR';label='前波高點收復';plain='當前收盤已收復前波起跌高點，已完成空方型態需要重新建立。';}
 const lows=list.filter(x=>x.direction==='DOWN'),highs=list.filter(x=>x.direction==='UP');
 const upper=Math.max(...list.map(x=>Math.max(x.startPrice,x.extremePrice))),lower=Math.min(...list.map(x=>Math.min(x.startPrice,x.extremePrice)));
 const noExtension=!better&&b.at(-1).close<=upper&&b.at(-1).close>=lower;
 if(noExtension&&b.length>=10&&mean(b.slice(-5).map(x=>x.volume))<=mean(b.slice(-10,-5).map(x=>x.volume))){key='RANGE_CANDIDATE';label='盤整候選';plain='近期完成波段未延伸，收盤在波段區間且量縮；箱型／壓縮形狀待續驗。';}
 return {key,label,plain,upper,lower,sameDirectionExtended:better,sameDirectionAngleImproved:same?Math.abs(z.pctPerBar)>Math.abs(a.pctPerBar):null,oppositeAngleStronger:power,oppositeVolumeStronger:volume,lows,highs};
}
function analyze(source,context={}){
 const checked=validate(source);if(!checked.ok)return {ok:false,model:MODEL,reason:checked.reason,formalEligible:false};const b=checked.bars,i=b.length-1,c=b[i];
 if(b.length<3)return {ok:false,model:MODEL,reason:'三盤至少需要三根完成日K',formalEligible:false};
 const s=signal(b),w=waves(b),pattern=structure(w,b),full=b.length>=PARAMETERS.minBars;
 const ma={},mv={},maSlope={},mvSlope={};for(const n of [8,21,55]){ma[n]=sma(b,'close',n);maSlope[n]=change(ma[n],sma(b,'close',n,b.length-1));}for(const n of [5,13,34]){mv[n]=sma(b,'volume',n);mvSlope[n]=change(mv[n],sma(b,'volume',n,b.length-1));}
 const priceStack=ma[55]!==null&&c.close>ma[8]&&ma[8]>ma[21]&&ma[21]>ma[55];
 const volumeStack=mv[34]!==null&&mv[5]>mv[13]&&mv[13]>mv[34];
 const priceRising=[8,21,55].every(n=>up(maSlope[n])),tideRising=[5,13,34].every(n=>up(mvSlope[n]));
 const prev5=sma(b,'volume',5,b.length-1),ratio=prev5>0?c.volume/prev5:null;
 const prior5Max=b.length>=6?Math.max(...b.slice(-6,-1).map(x=>x.volume)):null;
 const volumeStart=b.length>=6&&c.volume>b[i-1].volume&&c.volume>b[i-5].volume&&up(mvSlope[5]);
 const intervalAttack=prior5Max!==null&&c.volume>prior5Max;
 const newHigh=c.high>b[i-1].high,volumeShrinking=c.volume<b[i-1].volume;
 const previous=b.length>3?waves(b.slice(0,-1)):null,existingUp=previous?.current?.direction==='UP'&&s.key!=='DOWN';
 const stall=w.current?.direction==='UP'?i-w.current.extremeIndex:0;
 const exhaustion=existingUp&&stall>=PARAMETERS.stallWarningBars&&mvSlope[5]!==null&&mvSlope[5]<0;
 const liveDirection=w.current?.direction||'UNKNOWN';
 const volumePhase=up(mvSlope[5])?(volumeStack&&tideRising?'量增接力':volumeStart?'量起':'短線量增'):mvSlope[5]<0?(mvSlope[13]>0&&mvSlope[34]>0?'攻擊量退、較大潮仍上':'量退／量縮'):'量潮待確認';
 const longKey=priceStack&&priceRising?'BULL_ENV':ma[55]!==null&&c.close<ma[55]&&maSlope[55]<0?'BEAR_ENV':'MIXED_ENV';
 const longLabel=longKey==='BULL_ENV'?'均線環境偏多':longKey==='BEAR_ENV'?'較長均線環境偏弱':'較長環境未同步';
 const healthyPullback=s.key!=='DOWN'&&!exhaustion&&priceStack&&maSlope[55]>=0&&mvSlope[5]<0&&mvSlope[13]>0&&mvSlope[34]>0&&w.completed.some(x=>x.direction==='UP')&&liveDirection==='UP';
 const strongEnvironment=full&&priceStack&&priceRising&&volumeStack&&mvSlope[13]>0&&mvSlope[34]>0;
 const launch=s.key==='UP'&&!existingUp&&strongEnvironment&&volumeStart;
 const continuation=existingUp&&strongEnvironment&&!exhaustion&&(up(mvSlope[5])||(volumeShrinking&&newHigh));
 let phase='WATCH',phaseLabel='證據不足／等待方向',plain='價格、波段與量潮尚未同步，先保留觀察。';
 if(s.key==='DOWN'){phase='WEAKENING';phaseLabel='三盤跌破／當前上漲資格失效';plain='完成收盤跌破前兩日低點，先更新波段風控；較長環境另列，不抵銷跌破。';}
 else if(exhaustion){phase='EXHAUSTING';phaseLabel='三盤止漲預警／攻擊量退';plain=`上漲波段連續 ${stall} 根未創波高且MV5下彎；停止新增強勢資格，追蹤波段結束。`;}
 else if(launch){phase='LAUNCH';phaseLabel='三盤發動／量潮接力';plain='價格一過二，攻擊量轉上，較大潮與價格環境配合；列入下日條件確認。';}
 else if(continuation){phase='MAIN_ADVANCE';phaseLabel=volumeShrinking&&newHigh?'主升延續／量縮仍創高':'主升延續';plain=volumeShrinking&&newHigh?'既有上漲波段量縮仍創高；較大潮仍支持，未發生三盤跌破。':'既有波段未失效，價格與量潮背景持續支持。';}
 else if(healthyPullback){phase='HEALTHY_PULLBACK';phaseLabel='量縮整理／等攻擊量再起';plain='較大潮仍上，短攻擊量退；只列整理觀察，等待再攻。';}
 else if(s.key==='UP'){phase=longKey==='BEAR_ENV'?'REBOUND':'EARLY_LAUNCH';phaseLabel=phase==='REBOUND'?'短線反彈／長環境弱':'三盤向上／發動證據待接力';plain='價格訊號已成立；量潮或較長結構仍不足，不把一次突破直接當成飆股。';}
 else if(pattern.key==='RANGE_CANDIDATE'){phase='BASE_BUILDING';phaseLabel='盤整候選／區間未延伸';plain=pattern.plain;}
 const formalEligible=phase==='LAUNCH'||phase==='MAIN_ADVANCE';
 const completeness=[priceStack,priceRising,volumeStack,tideRising,volumeStart,existingUp||s.key==='UP'].filter(Boolean).length;
 const score=Math.round(completeness/6*100); // 工程條件覆盖，不参與风险否决，也不是勝率
 const signalLabel=s.key==='UP'?'三盤向上':s.key==='DOWN'?'三盤向下':'無新三盤轉折';
 const next={high:Math.max(c.high,b[i-1].high),low:Math.min(c.low,b[i-1].low)};
 const relative={industryVsMarket:null,stockVsIndustry:null,stockVsMarket:null,period:null,date:null};
 const ic=context.industryContext||{};if(date(ic.dataDate)===c.date){relative.industryVsMarket=number(ic.relativeStrength);relative.date=c.date;relative.period='同日';}
 // 成對期間資料必須同日同期間且有可辨識基期；缺資料不補分。
 const rs=context.relativeComparison;if(rs&&date(rs.date)===c.date&&date(rs.startDate)&&date(rs.startDate)<c.date&&rs.period){const stock=number(rs.stockReturnPct),industry=number(rs.industryReturnPct),market=number(rs.marketReturnPct);relative.stockVsIndustry=stock!==null&&industry!==null?stock-industry:null;relative.stockVsMarket=stock!==null&&market!==null?stock-market:null;relative.period=rs.period;relative.date=c.date;}
 const evidence=[`${signalLabel}：收盤 ${fmt(c.close)}／前兩日高 ${fmt(s.high)}、低 ${fmt(s.low)}`,longLabel,`MV5 ${arrow(mvSlope[5])}／MV13 ${arrow(mvSlope[13])}／MV34 ${arrow(mvSlope[34])}`,pattern.label];
 const risk=[];if(s.key==='DOWN')risk.push('三盤跌破優先處理；量縮或均線偏多均不能解除');if(exhaustion)risk.push('止漲預警與量退；工程三日計數需歷史驗證');if(!full)risk.push('少於60根，強勢濾網資格停止');if(c.volume===0)risk.push('最新成交量為0，停止正式資格');
 const eligible=formalEligible&&c.volume>0;
 const prior=previous?.current;
 const angle=prior&&w.completed.length?`最近完成波 ${w.completed.at(-1).direction==='UP'?'上漲':'下跌'} ${fmt(w.completed.at(-1).pctPerBar)}%/根；當前波 ${fmt(w.current?.pctPerBar)}%/根（未完成）`:'波段尚不足以比較角度；不以均線方向代替';
 return {ok:true,model:MODEL,date:c.date,bars:b,close:c.close,signal:s,signalLabel,next,waves:w,pattern,phase,phaseLabel,plain,formalEligible:eligible,strongEnvironment,score,completeness,coverageMax:6,ma,mv,maSlope,mvSlope,priceStack,volumeStack,priceRising,tideRising,volumeStart,intervalAttack,prior5Volume:prev5,threePanVolumeRatio:ratio,newHigh,volumeShrinking,existingUp,exhaustion,stall,healthyPullback,volumePhase,longKey,longLabel,relative,angle,evidence,risk,parameters:PARAMETERS,sourceEvidence:['PDF 19、57–58：三盤與波段退出','PDF 38、67：量縮仍創高的例外','PDF 85–96：波段量價與角度','PDF 99–103、113–156：均線／量潮接力','上集 00:49:28–00:50:14：三盤風控','下集 00:00:04–00:00:32：相對強弱']};
}
function fromReport(input){const r=input?.report||input||{},a=analyze(r.canonicalBars||r.dailySeries||r.rows||r.history||[],{industryContext:input?.industryContext||r.industryContext,relativeComparison:input?.relativeComparison||r.relativeComparison});
 if(a.ok){const stockDate=date(r.closeDate||r.dataDate),marketDate=date(r.marketDate||r.marketDataDate);if(!stockDate||stockDate!==a.date||(marketDate&&marketDate!==a.date)||number(r.close)!==null&&Math.abs(number(r.close)-a.close)>Math.max(.02,a.close*.0001))return {ok:false,model:MODEL,reason:'個股／市場／完成日K日期或收盤不一致',formalEligible:false};}return a;}
function text(input){const P=globalThis.ShitouScanPolicy5328||(typeof require==='function'?require('./scan-exclusions-rsi-v5328.js'):null);const a=input?.model===MODEL?input:fromReport(input),r=input?.report||input||{};if(!a.ok)return `【三盤趨勢分析】\n資料不足：${a.reason}`;
 const rel=a.relative.stockVsMarket===null?'個股相對大盤：缺少同期間資料':`個股相對大盤 ${fmt(a.relative.stockVsMarket)} 個百分點（${a.relative.period}）`;
 return [`【石頭少爺｜三盤趨勢分析】`,`${r.name||''} ${r.code||r.stock||''}｜資料日 ${a.date}｜完成日K`,`收盤 ${fmt(a.close)}｜${a.phaseLabel}`,P?P.rsiText(r,true):"RSI 5T 資料不足",P?P.volumeText(r):"成交量張數：資料不足",a.plain,`較長背景：${a.longLabel}｜${a.pattern.label}`,`本次比較：前兩日高 ${fmt(a.signal.high)}／低 ${fmt(a.signal.low)}｜${a.signalLabel}`,`價格：MA8 ${fmt(a.ma[8])}${arrow(a.maSlope[8])}／MA21 ${fmt(a.ma[21])}${arrow(a.maSlope[21])}／MA55 ${fmt(a.ma[55])}${arrow(a.maSlope[55])}`,`量潮：MV5 ${fmt(a.mv[5])}${arrow(a.mvSlope[5])}／MV13 ${fmt(a.mv[13])}${arrow(a.mvSlope[13])}／MV34 ${fmt(a.mv[34])}${arrow(a.mvSlope[34])}`,`量能：${a.volumePhase}｜今日／前五日均量 ${fmt(a.threePanVolumeRatio)} 倍（描述值，非固定判定門檻）`,`波段角度：${a.angle}`,`強勢名單資格：${a.formalEligible?'通過量價波段資格；進場仍另查':'未通過；不因分數改為可買'}`,`空手：${a.formalEligible?'列入下日條件重查，不能直接開盤買':'等待新的價格與攻擊量同步'}`,`持有：${a.signal.key==='DOWN'?'三盤退出／風控訊號已成立':a.exhaustion?'止漲與量退預警，檢查波段管理':'追蹤三盤失效及量退不再創高'}`,`下一根收盤 > ${fmt(a.next.high)}：新三盤向上，另查量潮`,`下一根收盤 < ${fmt(a.next.low)}：新三盤向下，更新風控`,`區間內：沒有新三盤，不單憑此稱盤整`,rel,`產業相對大盤：${a.relative.industryVsMarket===null?'同日資料不足':fmt(a.relative.industryVsMarket)+' 個百分點（產業背景）'}`,`工程條件覆蓋 ${a.completeness}/6；不是勝率`,...a.risk.map(x=>'注意：'+x),`依據：${a.sourceEvidence.join('；')}`,`分段端點與止漲預警計數屬工程約定，需歷史驗證；盤後日K不還原盤中委買賣。`].join('\n');}
return Object.freeze({MODEL,PARAMETERS,number,date,mean,sma,validate,signal,waves,structure,analyze,fromReport,text,fmt,arrow});
});
