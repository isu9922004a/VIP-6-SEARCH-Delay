(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./main-force-lifeline-core-v97.js'):root.ShitouMainForceLife97,node?require('./research-official-history-v1.js'):root.ShitouOfficialResearchHistory);if(node)module.exports=api;else root.ShitouMainForceScanner97=api;})(globalThis,function(Engine,History){
'use strict';
let active=null,last=null;
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function context({market,manifest,calendar,liquidity,now=new Date()}){
 const target=Engine.latestSession(calendar,now);History.inspectManifest(manifest,target);
 if(market.marketCoverageReady!==true||market.tradeDateIso!==target||manifest.snapshotContentSha256!==market.contentSha256||!Array.isArray(market.rows)||market.rows.length!==manifest.universe||market.counts?.totalRows!==market.rows.length||market.counts?.twseRows!==market.rows.filter(r=>r.market==='TWSE').length||market.counts?.tpexRows!==market.rows.filter(r=>r.market==='TPEX').length)throw Error('最新完成日的行情、歷史套件與全市場母體尚未對齊');
 const codes=market.rows.map(r=>r.code);if(new Set(codes).size!==codes.length||codes.some(c=>!manifest.stocks[c]))throw Error('全市場母體有重複或缺少歷史資料');
 if(market.sourceMeta?.twseCompanies?.status!==200||market.sourceMeta?.tpexCompanies?.status!==200)throw Error('官方商品及產業分類來源尚未核驗');
 const sourcesValid=liquidity?.sources?.length===2&&new Set(liquidity.sources.map(s=>s.market)).size===2&&liquidity.sources.every(s=>s.date===target&&/^[a-f0-9]{64}$/.test(s.sha256)&&s.url===(s.market==='TWSE'?`https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${target.replaceAll('-','')}&type=ALLBUT0999`:`https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${target.replaceAll('-','/')}&type=EW&response=json`));
 const securityValid=liquidity?.securitySources?.length===2&&new Set(liquidity.securitySources.map(s=>s.market)).size===2&&liquidity.securitySources.every(s=>s.asOf>=target&&/^[a-f0-9]{64}$/.test(s.sha256)&&s.url==='https://isin.twse.com.tw/isin/C_public.jsp?strMode='+(s.market==='TWSE'?2:4));
 const facts=liquidity?.schema==='LIFELINE_OFFICIAL_TURNOVER_V97'&&liquidity.verified===true&&liquidity.date===target&&liquidity.snapshotContentSha256===market.contentSha256&&sourcesValid&&securityValid?liquidity.records:{};
 return {target,rows:market.rows,manifest,market,facts,sources:liquidity?.sources||[],securitySources:liquidity?.securitySources||[],snapshotId:target+'|'+market.contentSha256};
}
async function scan(options={}){
 if(active)throw Error('掃描正在進行，請先停止或等待完成');
 const c=context(options),controller=new AbortController();c.snapshotId+='|'+globalThis.crypto.randomUUID();active=controller;last=null;const records=[],startedAt=new Date().toISOString();let cursor=0;
 const timeout=Math.min(60000,Math.max(100,options.timeout||12000)),retries=options.retries??1,concurrency=Math.min(8,Math.max(1,options.concurrency||4));
 function progress(){options.onProgress?.(Engine.summarize(records,{total:c.rows.length,completed:false,date:c.target,snapshotId:c.snapshotId}));}
 async function worker(){while(!controller.signal.aborted){const i=cursor++;if(i>=c.rows.length)return;const quote=c.rows[i],item=c.manifest.stocks[quote.code];let record;
  try{let raw;for(let attempt=0;attempt<=retries;attempt++){if(controller.signal.aborted)break;try{const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(timeout)]);raw=await options.loadReport(item,{signal});if(controller.signal.aborted)break;break;}catch(error){if(attempt===retries||controller.signal.aborted)throw error;}}
   if(controller.signal.aborted)return;
   History.inspectReport(raw,c.manifest,quote.code);record=Engine.classify({raw,quote,targetDate:c.target,sessions:c.manifest.researchSessions,exclusions:c.market.exclusionStatus,liquidity:c.facts[quote.code]?{...c.facts[quote.code],source:c.sources.find(s=>s.market===quote.market),securitySource:c.securitySources.find(s=>s.market===quote.market)}:null,proof:{sha256:item.sha256,snapshotId:c.snapshotId}});
  }catch(error){if(controller.signal.aborted)return;record={code:quote.code,name:quote.name,date:c.target,kind:'SERVICE_FAILED',reason:error.message};}
  records.push(record);progress();options.release?.(quote.code,c.target);
 }}
 try{progress();await Promise.all(Array.from({length:concurrency},worker));last=freeze({...Engine.summarize(records,{total:c.rows.length,completed:!controller.signal.aborted,date:c.target,snapshotId:c.snapshotId}),startedAt,finishedAt:new Date().toISOString(),stopped:controller.signal.aborted});return last;}finally{active=null;}
}
function stop(){active?.abort();}function reset(){stop();last=null;}
return Object.freeze({context,scan,stop,reset,getLast:()=>last,isRunning:()=>!!active});
});
