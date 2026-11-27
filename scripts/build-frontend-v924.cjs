'use strict';
// Build a candidate in an isolated directory, never overwrite the canonical source.
// Classic scripts retain their original lexical scope and relative execution order.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const VERSION='V9.24-PERF1';
const optional=['kronos-future-core-v1.js','kronos-future-share-config-v873.js','kronos-future-shares-v873.js','kronos-future-report-v1.js'];
function build(source,{deferFuture=false}={}){
  const files=[],moves=[],deferred=[];let js=0,css=0;
  let html=source.replace(/<script>([\s\S]*?)<\/script>|<style>([\s\S]*?)<\/style>/g,(tag,body,style)=>{
    const isJs=body!==undefined,content=isJs?body:style;
    if(isJs&&/\bdocument\.(?:currentScript|write|writeln)\b|\bimport\.meta\b/.test(content))throw Error('Inline script is not safe to relocate without individual review');
    const name='index-inline-v924-'+(isJs?'js-'+String(++js).padStart(2,'0')+'.js':'css-'+String(++css).padStart(2,'0')+'.css');
    const digest=sha(content), url='./'+name+'?v='+VERSION+'-'+digest.slice(0,12);
    const replacement=isJs?'<script src="'+url+'"></script>':'<link rel="stylesheet" href="'+url+'">';
    files.push({name,content,bytes:Buffer.byteLength(content),sha256:digest});
    moves.push({original:tag,replacement});return replacement;
  });
  assert.equal(js,13,'unexpected original inline JS inventory');
  assert.equal(css,2,'unexpected original inline CSS inventory');
  if(deferFuture) for(const name of optional){
    const re=new RegExp('<script src="\\./'+name.replace(/\./g,'\\.')+'\\?v=[^"]+"></script>','g');
    const matches=[...html.matchAll(re)];
    assert.equal(matches.length,1,name+' must exist exactly once in the original order');
    const original=matches[0][0],replacement=original.replace('></script>',' defer></script>');
    html=html.replace(original,replacement);deferred.push({name,original,replacement});
  }
  let restored=html;
  for(const d of deferred)restored=restored.replace(d.replacement,d.original);
  for(const move of moves)restored=restored.replace(move.replacement,move.original);
  assert.equal(restored,source,'original text, inline bytes or script position changed');
  return {html,files,manifest:{version:VERSION,sourceBytes:Buffer.byteLength(source),htmlBytes:Buffer.byteLength(html),sourceSha256:sha(source),htmlSha256:sha(html),js,css,deferred:deferred.map(x=>x.name),assets:files.map(({content,...meta})=>meta),originalReconstructionIdentical:true}};
}
if(require.main===module){
  const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../frontend-v924-stage'));
  if(out===root||out.startsWith(root+path.sep))throw Error('Stage must be outside the checkout; do not overwrite the source');
  const result=build(fs.readFileSync(path.join(root,'index.html'),'utf8'),{deferFuture:process.argv.includes('--defer-future')});
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),result.html);
  for(const f of result.files)fs.writeFileSync(path.join(out,f.name),f.content);
  fs.writeFileSync(path.join(out,'frontend-v924-manifest.json'),JSON.stringify(result.manifest,null,2)+'\n');
  console.log(JSON.stringify(result.manifest));
}
module.exports={build};
