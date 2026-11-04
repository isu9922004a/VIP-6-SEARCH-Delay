(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./structure-strength.js'):root.ShitouStructureStrength);if(node)module.exports=api;else root.ShitouStockFifthModule=api;})(globalThis,function(S){
'use strict';
const finite=Number.isFinite,num=x=>finite(x)?String(+x.toFixed(2)):'尚未確認',money=x=>finite(x)&&x>0?num(x)+' 元':'價位尚未確認';
function build(a,p,f,pending=[],input=null,context={}){
 context=context||{};
 const name=a.name||a.code||'此個股',valid=a.validation?.technicalModelAvailable===true,has=key=>valid&&finite(p[key])&&p[key]>0;
 const available=!!f.daily,bull=f.direction==='BULL',bear=f.direction==='BEAR',demo=f.state==='ILLUSTRATION',good=p.state==='CONDITIONAL'&&!!p.entryRange&&!p.dataIssues?.length,temporary=f.loadStatus==='TEMPORARY_ERROR',loading=f.loadStatus==='LOADING';
 const watch=has('watch')?p.watch:null,stop=has('stop')?p.stop:null,target=has('target')?p.target:null,close=has('close')?p.close:null;
 const structure=S.fromAnalysis(a),support=structure.support,resistance=structure.resistance,reference=e=>`${money(e.price)}（${e.referenceDate} 日K${e.type==='SUPPORT'?'最低':'最高'}價；${e.signalDate} 訊號固定記錄）`;
 const blocks=[],add=(kind,text,tone)=>blocks.push({kind,text,tone});
 const direction=available?(bull?'🟢偏多向上漲':bear?'🔴偏空可能下跌':'🟡多空分歧、方向不明'):temporary?'⚪模型資料暫未載入':loading?'⚪模型資料載入中':'⚪尚無可用的模型結果';
 const advice=!available?'先依已核對的行情觀察。':bear?'先別急著搶反彈，也不要直接追空！':good&&bull?'仍要等盤中條件確認！':'但還不能急著買！';
 add('headline',`📊 電腦模擬：【${name}】${direction}，${advice}`,bear?'red':bull?'aqua':'yellow');
 if(f.modelRun){add('notice',(f.executionVerified?'已核對模型執行紀錄；':'模型執行紀錄尚未核對；')+'台股績效尚未驗證，取樣比例不是勝率。'+(f.provenance?.inputQuality?.warning?'成交金額是估算值，與實際成交金額可能有差異。':'')+(f.provenance?.outputQuality?.warning?'部分模擬的最高、最低價不合理，因此只參考開盤與收盤結果。':''),'yellow');add('body','推演交易日：'+f.dates[0]+'；基準為 '+a.date+' 收盤。');}
 if(demo)add('notice','本機人工示意｜尚未執行 Kronos；以下比例與明日方向只供檢視模組。','yellow');
 if(f.modelRun&&f.provenance?.inputQuality?.window?.cutoff)add('notice',`模型只使用 ${f.provenance.inputQuality.window.cutoff} 價格斷點後的 ${f.provenance.parameters.lookback} 根日線，不跨越前後價格基準，也沒有補造或按猜測比例還原價格。`,'yellow');
 add('heading','① 明天可能怎麼走？');
 if(available){
  const opening={'接近平開':'可能接近今天收盤價開盤','傾向開高':'可能高於今天收盤價開盤','傾向開低':'可能低於今天收盤價開盤'}[f.openingLabel];
  add('body',`電腦模擬【${name}】明天${opening}，${bull?'收盤略偏向上漲':bear?'收盤略偏向下跌':'收盤漲跌的結果分歧，暫時沒有明確方向'}。`);
  add('body',`模擬結果：偏多 ${+(f.bullish*100).toFixed(1)}%、偏空 ${+(f.bearish*100).toFixed(1)}%、持平 ${+(f.flat*100).toFixed(1)}%。`);
  const ratio=Math.round((bear?f.bearish:f.bullish)*100);
  add('warning',`⚠️ 這只是電腦模擬的取樣比例，${f.direction==='MIXED'?'不能直接當成明天實際漲跌的機率，也不保證股價方向':`不代表明天有 ${ratio}% 的機率${bear?'下跌':'上漲'}，也不保證股價會${bear?'跌':'漲'}`}。`);
 }else add('body',(temporary?'模型資料連線暫時中斷，請重新載入；尚未完成核對前，不顯示推演比例。':loading?'正在載入模型資料；完成核對後才顯示推演比例。':'此個股尚未取得可用的模型結果；不填入多空比例，也不猜明日方向。')+(f.reason||''));
 add('subheading','價格結構：'+structure.label,structure.state==='BULL_HOLDING'||structure.state==='TURNING_UP'?'aqua':'yellow');
 add('body',structure.state==='UNAVAILABLE'||structure.state==='NOT_FORMED'?structure.reason:'這是已完成日K的結構觀察，不代表明天漲跌機率；與電腦模擬分開判讀，尚未經績效驗證。');
 add('heading','② 明天可以買進嗎？');
 add('subheading',good&&!bear&&available?'🟡 盤後條件已通過，仍要等盤中確認！':'🟡 建議先觀望，不要急著買！','yellow');
 if(close&&watch){
  add('body',`今天收盤價是 ${money(close)}，${close<watch?'還沒有站回':close===watch?'剛好接近':'已在'}短線觀察價 ${money(watch)}${close<watch?'，代表短線轉強尚未確認。':'；仍不能只看碰到價位就買進。'}`);
  add('body',`即使明天${close<watch?'漲回':'守在'} ${money(watch)}，也只是觀察轉強的初步線索，還要確認其他風險條件，不能直接當成買進訊號。`);
 }else add('body','短線觀察價或完整日K尚未核對，現在沒有足夠依據列出買價。');
 if(good&&!bear&&available)add('body',`只有原盤中確認條件成立後，才評估 ${money(p.entryRange.low)}～${money(p.entryRange.high)}；超出範圍要重算，不直接追價。`);
 if(bear)add('warning','模型偏空也不等於放空條件通過；本模組不自動建立空單。');
 add('heading','③ 明天要注意哪些價格？');
 add('subheading',`🟢 ${money(watch)}｜觀察是否轉強`,'aqua');
 add('body',watch?'如果股價重新站上並守住，代表短線有機會改善，但仍須確認其他買進條件。':'缺少可核對的轉強觀察價，先不猜價位。');
 if(resistance)add('body',`結構壓力觀察：${reference(resistance)}。${resistance.status==='BROKEN'?'已收盤突破，後續回測守穩仍待確認':resistance.status==='FAILED'?'突破後已失守，原轉強情境需重查':'尚未收盤突破，反彈轉強待確認'}。${watch?`此價${resistance.price===watch?'與短線觀察價相同':resistance.price>watch?'高於短線觀察價，站回較低價仍不代表突破結構壓力':'低於短線觀察價，跨過後仍須確認較高觀察價'}。`:''}`);
 add('subheading',`🔴 ${money(stop)}｜新買進的防守試算價`,'red');
 add('body',stop?'如果未來符合條件而買進，可用這個價位作為初步風險參考。它不是保證能成交的停損價。':'缺少可核對的防守依據，先不填停損試算。');
 if(support)add('body',`結構支撐觀察：${reference(support)}。${support.status==='HOLDING'?'尚未收盤跌破，不等於隔日一定上漲':'曾收盤跌破，原多方情境已失效；站回仍須重新確認'}；${stop?`與防守試算價${support.price===stop?'相同，但用途不同':support.price>stop?'相比較高': '相比較低'}，` :''}不自動取代個人停損或原買進條件。`);
 add('subheading',`🎯 ${money(target)}｜上方壓力參考價`,'yellow');
 add('body',target?'如果股價持續上漲，接近這裡要特別注意是否遇到賣壓，並不是保證會漲到的目標價。':'上方歷史關卡不足，不自行填入目標價。');
 add('heading',good?'④ 為什麼仍要確認，不能直接追買？':'④ 為什麼現在不建議急著買？');
 const bars=input?.bars||[],z=bars.at(-1),prev=bars.at(-2),volumeVerified=context.volumeVerified===true||pending.includes('成交量來源已完成本次核對。');
 let volumeSummary='量價仍待核對';
 if(volumeVerified&&z&&prev&&finite(z.volume)&&finite(prev.volume)&&prev.volume>0&&close){
  const change=(z.volume/prev.volume-1)*100,move=close-prev.close,v=change>0?'增加':change<0?'減少':'持平',price=move>0?'上漲':move<0?'下跌':'持平';
  volumeSummary=(change>0?'放量':change<0?'量縮':'量平')+(move>0?'上漲':move<0?'下跌':'持平');
  add('body',`今天成交量比昨天${v}${change?'約 '+Math.round(Math.abs(change))+'%':''}，${change>0&&move<0?'但股價反而下跌，代表交易變熱絡，股價卻沒有跟著走強，需要小心':`股價${price}；成交量變化仍須搭配後續價格確認，不能單獨當成買進理由`}。`);
 }else add('body',context.volumeShort||'成交量與前一日比較尚未取得完整核對，先不判定放量或縮量。');
 const ma20=a.features?.ma?.[20]?.value,ma5=a.features?.ma?.[5]?.value;
 if(valid&&finite(ma20)&&finite(ma5)&&close){
  let short=close<ma5?'仍低於':'仍在';
  if(close<ma5&&bars.length>=6){const priorMA5=bars.slice(-6,-1).reduce((s,b)=>s+b.close,0)/5;if(prev.close>=priorMA5)short='已跌破';}
  add('body',`目前股價${close>=ma20?'還在':'低於'}20日均線（${money(ma20)}）${close>=ma20?'之上':'之下'}，${close>=ma20&&close<ma5?'但':'而'}${short}5日均線（${money(ma5)}）${close>=ma5?'之上':''}，${close<ma5?'短線仍要觀察能不能重新轉強':'後續仍要確認能否守穩'}。`);
 }else add('body','均線與價格資料還不完整，先不硬下多空結論。');
 add('heading','⑤ 明天實際怎麼做？');
 if(support)add('body',support.status==='HOLDING'?`結構劇本：守住 ${money(support.price)}，僅表示多方結構尚未失效；若收盤跌破，改列轉弱並重查原計畫。`:`結構劇本：${money(support.price)} 曾收盤失守；重新站回僅是重建線索，不能直接恢復原買進情境。`);
 if(resistance)add('body',resistance.status==='BROKEN'?`結構劇本：${money(resistance.price)} 已收盤突破；續看回測是否守穩與量能，若再收盤跌回下方，轉強情境需重查。`:`結構劇本：先觀察是否收盤突破 ${money(resistance.price)} 並後續守穩，再核對量能與原買進條件；未突破前不把反彈當成反轉。`);
 if(watch){add('body',`✅ 如果站回 ${money(watch)}：繼續觀察是否站穩，以及其他買進條件是否通過。`);add('body',`⚠️ 如果一直站不上 ${money(watch)}：短線尚未確認轉強，先不要追價。`);}
 else add('body','⚠️ 先等可靠的完整日K與觀察價，不用缺資料的計畫進場。');
 add('body',`❌ 如果價格繼續下跌：注意風險，${bear?'不要因為股價跌了就急著搶反彈，也不要只因模型偏空就追空':bull?'不要因為電腦預測偏多就貿然進場':'不要把方向不明的推演當成買進訊號'}。`);
 if(bear&&valid&&p.bear?.watch>0)add('body',`另看 ${money(p.bear.watch)} 的轉弱觀察線；跌破也不代表放空資格與風險條件已通過。`);
 add('heading','📌 一句話總結：');
 add('summary',`「${available?`電腦模擬明天${bull?'有偏多跡象':bear?'有偏空跡象':'多空方向仍不明'}`:'明天尚無可用的模型結果'}，今天的量價狀況：${volumeSummary}，${close&&watch&&close<watch?'短線還沒有確認轉強':'後續仍要看價格是否守穩'}。${watch?`新買先等股價${close<watch?'站回':'守穩'} ${money(watch)}，並確認其他風險條件通過後，再考慮進場。`:'新買先等可靠資料與完整風險條件。'}」`);
 add('footnote','＊以上為盤後模擬，無法預知明天盤中走勢；若明天大幅跳空，價位與風險都要重新計算。已持有股票者，應依原本持股計畫判斷。');
 return {number:'05',title:'明天可能怎麼走？該怎麼做？',compact:true,narrative:blocks,rows:[{icon:'search',price:'',label:'',bullets:blocks.map(b=>b.text)}],originalPending:[...pending],forecast:f,structureStrength:structure};
}
return {build};
});


