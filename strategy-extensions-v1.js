/* Mount independent strategy hosts before the new UI modules install. */
(function(root){'use strict';const d=root.document;if(!d)return;const main=d.querySelector('main.container');if(!main)return;
const panel=d.createElement('section');panel.id='mainForceLifelinePanel';panel.className='panel';main.append(panel);
async function loadBundle(){
 const json=async path=>{const r=await fetch(new URL(path,d.baseURI),{cache:'no-store'});if(!r.ok)throw Error('資料未取得 '+path);return r.json();};
 const [market,manifest,index]=await Promise.all([json('data/market/latest.json'),json('data/research/manifest.json'),json('data/index/TAIEX.json')]);
 const date=root.ShitouMainForceLife97.latestSession(index.tradingCalendar,new Date());
 root.ShitouOfficialResearchHistory.inspectManifest(manifest,date);
 if(market.marketCoverageReady!==true||market.tradeDateIso!==date||manifest.snapshotContentSha256!==market.contentSha256||!Array.isArray(market.rows)||market.rows.length!==manifest.universe||new Set(market.rows.map(x=>x.code)).size!==market.rows.length||market.sourceMeta?.twseCompanies?.status!==200||market.sourceMeta?.tpexCompanies?.status!==200)throw Error('完成日、完整市場或官方來源尚未對齊');
 const rows=market.rows,map=new Map(rows.map(q=>[q.code,{...q,quoteDate:date,volumeUnit:'shares'}])),sectorMap=new Map(rows.map(q=>[q.code,{industryCode:q.industryCode,industryName:q.industryName,industry:q.industry}]));
 const meta={total:rows.length,targetTradeDate:date,completedTradeDate:date,expectedTradeDate:date,twseQuoteDate:date,tpexQuoteDate:date,marketCoverageReady:true,industryCoverageReady:rows.every(q=>!root.ShitouRestaurantCore.ordinary(q.code,q)||q.industryCode&&q.industryName),snapshotTimelinessReady:true,snapshotContentSha256:market.contentSha256,exclusionCoverageReady:market.exclusionStatus?.ready===true,exclusionDate:market.exclusionStatus?.date,marketCalendar:market.marketCalendar};
 return {map,sectorMap,meta,snapshotRows:rows.length,exclusionStatus:market.exclusionStatus,source:'已核驗官方完成日封存'};
}
root.ShitouStrategyExtensionsV1=Object.freeze({loadBundle});
// New viewer navigation must be cleared when a different legacy image preview opens.
const show=root.showInfographicPreviewV3328,close=root.closeInfographicPreviewV3328;
if(typeof show==='function')root.showInfographicPreviewV3328=async function(canvas,name,title,options){const modal=d.getElementById('imagePreviewModal');modal?.dispatchEvent(new CustomEvent('shitou-preview-change',{detail:options?.owner||null}));return show.call(this,canvas,name,title);};
if(typeof close==='function')root.closeInfographicPreviewV3328=function(...args){root.ShitouLifeViewer94?.reset();return close.apply(this,args);};
})(globalThis);
