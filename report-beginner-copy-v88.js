/* Presentation only. No prices, indicators, wave rules or trading decisions are calculated here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouReportCopyV88=api;})(globalThis,function(){
'use strict';
const VERSION='REPORT_BEGINNER_COPY_V88_1';
const headings=Object.freeze({
 '目前波浪位置':'現在走到哪裡？',
 '量價確認：哪些跟上、哪些還要等？':'哪些條件有了？還在等什麼？',
 '回檔多深？哪些線索支持？':'價格怎麼走？還要等什麼？',
 '還沒買的人：現在可以買嗎？':'還沒買，先等什麼？',
 '已經持有：先檢查原持股理由與停損':'已經買了：原本的理由還在嗎？',
 '已經持有：留意回落，原停損計畫優先':'已經買了：回落先看原停損計畫',
 '原方法的三條價位：這次未提供':'三個參考價：這次尚未取得',
 '原方法的三條觀察線，各有用途':'三條觀察線，分別看什麼？',
 '為什麼原方法的價位，還沒確認？':'為什麼還沒有可用的參考價？',
 '價格先看這三處':'往上看哪裡？往下注意哪裡？',
 '圖上價位怎麼看？':'圖上價位，分別看什麼？',
 '① 下一交易日可能方向':'① 明天可能怎麼走？',
 '② 現在適合進場嗎':'② 還沒買，先等什麼？',
 '③ 三個重要價位':'③ 上下先看這三處',
 '④ 為什麼這樣判斷':'④ 哪些條件有了？',
 '⑤ 明日三種可能走法':'⑤ 明天三種情況，分別怎麼看？',
 '⑥ 模型結果有多大把握':'⑥ 模擬有多分歧？',
 '什麼情況可以考慮買？':'還沒買，先等什麼？',
 '什麼情況要小心？':'出現什麼情況，要重新判斷？',
 '轉強觀察':'站回再觀察',
 '支撐觀察':'下方留意',
 '壓力觀察':'上方留意',
 '再跌破要注意':'跌破要留意',
 '新買觀察':'買前先觀察',
 '原結構失效價':'原看法重查價',
 '原失效參考':'原看法重查價',
 '關鍵支撐價位':'下方先看哪裡？',
 '關鍵壓力價位':'上方先看哪裡？',
 '判斷失效條件':'什麼情況要重新判斷？',
 '空手操作建議':'還沒買，要注意什麼？',
 '持股風險提醒':'已經買了，要注意什麼？',
 '多方有利依據':'支持上漲的線索',
 '空方風險因素':'可能轉弱的線索'
});
function line(value){
 let text=String(value??'');
 // Identity rows remain literal, including unusual company names.
 if(/^[^\n]+[（(][A-Z0-9^._-]+[）)]$/u.test(text))return text;
 if(Object.hasOwn(headings,text))return headings[text];
 for(const [from,to] of [
  ['新買觀察','買前觀察'],['價格通道：','近期範圍：'],['說明：量能','說明：成交量'],['回吐','退回'],['反彈回補','跌後漲回'],['回撤量尺','回調量尺'],
  ['費波回撤','前段回調'],['比例只描述退回／回補幅度','比例只描述前段漲跌退回多少'],
  ['價格與成交量確認','收盤走勢與成交量確認'],
  ['原方法提供價位','原策略提供價位'],['原方法價位','原策略價位'],
  ['新手白話版','新手說明版'],['白話規則','說明'],['｜白話','｜說明']
 ])text=text.split(from).join(to);
 return text;
}
function field(value){return {...value,title:line(value.title),value:line(value.value)};}
// Fixed copy shared by stock/index views. Existing computed swing values remain unchanged.
const fibNote='比例量的是「前一段漲跌退回多少」，不是股價跌幅。先看前高、前低或整理邊界是否在附近，再看完成日K的收盤與成交量。碰到比例不能直接買，原買進條件與停損計畫仍優先。';
const fibRatios='38.2%退回較少；50%退回一半；61.8%退回較多。50%是常用中間位置，這些比例都不保證反轉。';
return Object.freeze({VERSION,line,field,headings,fibNote,fibRatios});
});
