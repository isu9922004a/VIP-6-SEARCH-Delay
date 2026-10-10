'use strict';

(function(root){
  const RELEASE='石頭少爺 Agent V50 正式版｜R5.3.2.8.1｜手機免CMD自動同步版';
  const FILE_VERSION='V50_R5.3.2.8.1_手機免CMD自動同步版';
  const VERSION=Object.freeze({
    major:50,
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
