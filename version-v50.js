'use strict';

(function(root){
  const CODE='R5.3.2.8.1-TOWER-SHADOW.5.1-DATEGATE.1-REVIEW.2';
  const RELEASE=`石頭少爺 Agent V50｜${CODE}｜共用行情與四策略正式篩選版`;
  const FILE_VERSION=`V50_${CODE}_共用行情與四策略正式篩選版`;
  const VERSION=Object.freeze({
    major:50,
    baseRelease:'R5.3.2.8.1',
    code:CODE,
    displayCode:'R5.3.2.8.1｜寶塔更新5.1｜DATEGATE.1｜REVIEW.2 共用行情與四策略正式篩選',
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
