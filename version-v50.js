'use strict';

(function(root){
  const CODE='R5.3.2.8.1-TOWER-SHADOW.5.1-DATEGATE.1-REVIEW.2-OBSERVE.2-RESTAURANT.2-RSICTX.1-TOP8.1-SNAPFIX.1-NOPARALLEL.1-BUGFIX.1-FULLBLEED.1-IPHONECARD.1-MOBILE-LINE.1-HEALTH.2';
  const RELEASE=`石頭少爺 Agent V50｜${CODE}｜RSI多週期暨餐廳前八強單張總覽版`;
  const FILE_VERSION=`V50_${CODE}_RSI多週期暨餐廳前八強單張總覽版`;
  const VERSION=Object.freeze({
    major:50,
    baseRelease:'R5.3.2.8.1',
    code:CODE,
    displayCode:'R5.3.2.8.1｜寶塔更新5.1｜DATEGATE.1｜REVIEW.2｜OBSERVE.2 動能量價情境｜RESTAURANT.2 第五濾網｜RSICTX.1 多週期觀察｜TOP8.1 餐廳單張總覽｜SNAPFIX.1 市場備援與圖片頁尾修正｜NOPARALLEL.1 移除獨立並行驗證區｜BUGFIX.1 餐廳比較與快照一致性｜FULLBLEED.1 iPhone滿寬長圖｜IPHONECARD.1 前八強滿版卡片｜MOBILE-LINE.1 圖片分享｜HEALTH.2 逐檔健康重試',
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
