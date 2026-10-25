/* Display-only Traditional Chinese mapping. Never mutate internal contracts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ShitouResearchZhTW=api;})(globalThis,function(){
'use strict';
const FIELDS=Object.freeze({
 multiTimeframeResearch:'多週期綜合研判',indicatorPatternResearch:'指標型態研究',marketPhaseResearch:'目前行情階段',riskEvidence:'風險與關鍵依據',researchDataHealth:'行情資料完整性',supportResistance:'關鍵支撐與壓力',strategyResults:'四策略研究結果',researchVersion:'研究版本'
});
const PATTERNS=Object.freeze({
 OSC_SECOND_CROSS:'指標型態一｜動能二次轉強',OSC_SHRINK_REEXPAND:'指標型態二｜動能收斂後再增強',BEAR_TO_BULL_SECOND_CROSS:'指標型態三｜空頭反轉二次確認',KD_SECOND_CROSS_WASHOUT:'指標型態四｜短線洗盤後再轉強',KD_TRIPLE_CROSS_BOTTOM:'指標型態五｜震盪落底三次交叉'
});
const STATUS=Object.freeze({
 PASS:'符合',FAIL:'不符合',UNKNOWN:'待驗證',CONFIRMED:'已確認',DEVELOPING:'形成中',NOT_TRIGGERED:'尚未觸發',INSUFFICIENT_DATA:'資料不足',INVALID_DATA:'資料異常',DISABLED:'已關閉',OBSERVATION:'觀察中',AWAIT_CONFIRMATION:'等待確認',FAILED:'條件失效',EXPIRED:'訊號已過期',AMBIGUOUS:'訊號順序不明',RESEARCH_MATCH:'研究符合',RESEARCH_NOT_MATCH:'尚未符合',DATA_UNVERIFIED:'資料待核驗',UNVERIFIED:'尚未核驗',VERIFIED:'已核驗',TECHNICAL_VERIFIED:'技術資料已核驗',FUNDAMENTAL_VERIFIED:'基本面已核驗',FLOW_VERIFIED:'籌碼資料已核驗',PARTIALLY_VERIFIED:'部分資料已核驗',BASE_DATA_INVALID:'基礎資料異常',HISTORY_INSUFFICIENT:'歷史資料不足',TECHNICAL_AVAILABLE:'技術資料可供研究',TECHNICAL_PARTIAL:'技術資料部分可用',RESEARCH_COMPLETE:'研究資料已備齊',STRONG_ALIGNMENT:'週期一致轉強',PARTIAL_ALIGNMENT:'週期部分轉強',MIXED_SIGNALS:'週期訊號衝突',BEARISH_ALIGNMENT:'週期一致轉弱',OVEREXTENSION_WARNING:'短線過熱警戒',BREAKOUT_LAUNCH:'突破發動',HEALTHY_PULLBACK:'健康回踩',MOMENTUM_CONTINUATION:'強勢延續',FLOW_CONFIRMATION:'資金確認',OVEREXTENDED:'短線過熱',BREAKOUT_FAILURE:'結構轉弱',SIDEWAYS_UNCLEAR:'區間整理',UNKNOWN_INSUFFICIENT_DATA:'資料不足，暫無法判斷',NO_CANDIDATES:'暫無符合條件個股',NOT_QUERIED:'尚未查詢',RESEARCH_CANDIDATES:'研究候選',CALENDAR_UNVERIFIED:'交易日曆尚未核驗',ADJUSTMENT_BASIS_UNKNOWN:'股價還原基準不明',PRICE_BASIS_UNVERIFIED:'股價基準尚未核驗',VOLUME_UNIT_ASSUMED_SHARES:'成交量原始單位尚未確認',NOT_VALIDATED:'尚未完成績效驗證',MANUAL_ONLY:'僅供手動設定',RESEARCH_ONLY:'僅供研究',DAILY_ONLY:'單日日Ｋ來源',DEEP_SCAN:'深度掃描'
});
const MODEL=Object.freeze({BREAKOUT_ACCELERATION_V1:'突破研究模型',BULL_PULLBACK_RECLAIM_V1:'回踩研究模型',MOMENTUM_CONTINUATION_V1:'動能研究模型',FLOW_FUNDAMENTAL_CONFIRM_V1:'資金與基本面研究模型'});
const TECHNICAL=new Set(['KD','MACD','DIF','OSC','RSI','SMA','EMA','MA','OBV','OHLCV','TWSE','TPEX','ETF','ETN','KY','TDR','DR','LINE','JSON','CSV','TXT','DRAX']);
function status(value){const key=String(value??'');return STATUS[key]||PATTERNS[key]||MODEL[key]||(/^[A-D][1-9]$/.test(key)?`${key[0]}模型條件${key.slice(1)}`:null)||'狀態待核對';}
function humanize(value){
 if(value===null||value===undefined||String(value).trim()==='')return '—';
 const raw=String(value);
 return raw.replace(/[A-Z][A-Z0-9_]{2,}(?:_V\d+)?/g,(token)=>{
  if(STATUS[token]||MODEL[token]||PATTERNS[token])return status(token);
  if(TECHNICAL.has(token)||/^(MA|RSI|KD)\d+$/.test(token))return token;
  // Stable condition identifiers are preserved for technical evidence (not user-facing labels).
  if(/^[A-D]\d+$/.test(token))return status(token);
  return '內部狀態待核對';
 });
}
function field(name){return FIELDS[name]||name;}
return Object.freeze({FIELDS,PATTERNS,STATUS,field,status,humanize});
});
