'use strict';

(function(root){
  const CODE='R5.3.2.8.1-TOWER-SHADOW.5.1';
  const RELEASE=`石頭少爺 Agent V50｜${CODE}｜寶塔價位溯源與風險分層版`;
  const FILE_VERSION=`V50_${CODE}_寶塔價位溯源與風險分層版`;
  const VERSION=Object.freeze({
    major:50,
    baseRelease:'R5.3.2.8.1',
    code:CODE,
    displayCode:'R5.3.2.8.1｜寶塔更新5.1｜深掃資料健康檢查',
    towerModel:'TOWER_OHLC_RANGE_SINGLE_COLOR_1.0.0',
    release:RELEASE,
    fileVersion:FILE_VERSION,
    dataTiming:'POST_CLOSE_ONLY',
    researchRole:'SHADOW_ONLY'
  });
  root.ShitouReleaseV50=VERSION;
  root.R50_RELEASE_LABEL=RELEASE;
  root.R50_FILE_VERSION=FILE_VERSION;
  if(typeof module!=='undefined'&&module.exports)module.exports=VERSION;
})(typeof globalThis!=='undefined'?globalThis:this);
