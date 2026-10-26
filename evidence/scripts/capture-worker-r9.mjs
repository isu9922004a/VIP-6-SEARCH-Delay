// Read-only, bounded production evidence capture. Never deploys or modifies data.
import fs from 'node:fs';
const dir=new URL('../evidence/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
const urls={
 page:'https://isu9922004a.github.io/VIP-BOWTOWER-4-SEARCH/version-v50.js',
 snapshot:'https://shitou-taiwanmarket-api.d318426.workers.dev/?market=ALL_STOCKS',
 daily:'https://shitou-taiwanmarket-api.d318426.workers.dev/?market=DEEP_SCAN&codes=6173,4526&markets=TPEX,TWSE&profile=DAILY_ONLY&debug=1',
 stockDaily:'https://shitou-agent-fib-api.d318426.workers.dev/?stock=6173&marketHint=TPEX&mode=DAILY_ONLY',
 stockFull:'https://shitou-agent-fib-api.d318426.workers.dev/?stock=6173&marketHint=TPEX',
};
const summary={capturedAt:new Date().toISOString(),readOnly:true,responses:{}};
for(const [key,url] of Object.entries(urls)){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)}),body=await r.text();
 fs.writeFileSync(new URL(key+(key==='page'?'.js':'.json'),dir),body);
 summary.responses[key]={url,status:r.status,bytes:body.length,headers:Object.fromEntries([...r.headers].filter(([k])=>/^(content-type|date|etag|cf-cache-status|x-shitou)/i.test(k)))};
 console.log(key,r.status,body.length);
 }catch(e){summary.responses[key]={url,error:e.message};console.log(key,e.message);}
 fs.writeFileSync(new URL('production-capture.json',dir),JSON.stringify(summary,null,2)+'\n');
}
