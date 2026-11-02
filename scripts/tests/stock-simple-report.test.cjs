'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../../research-report-v1.js'),source=fs.readFileSync(require.resolve('../../research-v83/stock-simple-report.js'),'utf8');
const analysis={code:'3466',name:'德晉',date:'2026-10-30',quote:{close:28.75}};
function render(blocks,watermarked=false){
 const calls=[];
 const ctx={measureText(text){const size=Number(this.font.match(/ (\d+)px/)[1]);return {width:[...text].length*size};},
  beginPath(){},roundRect(){},fill(){},stroke(){},fillRect(){},save(){},restore(){},setTransform(){},translate(){},rotate(){},
  fillText(text,x,y){calls.push({text,x,y,font:this.font});}};
 const canvas={dataset:{},getContext:()=>ctx,toBlob(cb,type){cb({size:1024,type});}};
 ctx.canvas=canvas;
 const context=vm.createContext({ShitouResearchReport:{...R,view:()=>({actionGuide:{sections:[{number:'05',fullNarrative:blocks,forecast:{state:'UNAVAILABLE'}}]}})},ShitouReportWatermark:require('../../report-watermark-v84.js')});
 vm.runInContext(source,context);
 const output=context.ShitouSimpleStockReport.page(analysis,{document:{createElement:()=>canvas},watermarked});return {output,canvas,calls,audit:JSON.parse(output.dataset.researchAudit)};
}
test('short narratives retain the compact PNG and all original text',()=>{
 const blocks=[{kind:'heading',text:'下一交易日'},{kind:'body',text:'完整短報告。'}];
 const {output,canvas,audit,calls}=render(blocks);
 assert.equal(output.width,1284);assert.equal(output.height,2778);assert.equal(canvas.height,output.height);
 assert.equal(audit.extendedHeight,false);assert.equal(audit.bodyFont,38);
 assert.deepEqual(audit.sourceBlocks,blocks);assert.ok(calls.some(c=>c.text==='完整短報告。'));
 assert.equal(audit.noClipping,true);
});
test('overflowing clean and watermarked reports grow without truncating their narrative',()=>{
 const blocks=Array.from({length:18},(_,i)=>({kind:i%3===0?'heading':'body',text:`第${i+1}段：`+'完整分析內容，保留全部文字。'.repeat(8)}));
 const clean=render(blocks),marked=render(blocks,true);
 for(const {output,canvas,audit,calls} of [clean,marked]){
  assert.equal(output.width,1284);assert.ok(output.height>2778&&output.height<=8192);
  assert.equal(canvas.height,output.height);assert.equal(audit.height,output.height);assert.equal(audit.extendedHeight,true);
  assert.equal(audit.bodyFont,32);assert.equal(audit.noClipping,true);assert.ok(audit.bodyBottom<=output.height-104);
  assert.deepEqual(audit.sourceBlocks,blocks);assert.equal(audit.completeNarrative,true);
  // All wrapped lines must be painted, including the final paragraph.
  const painted=calls.map(c=>c.text).join('');
  for(const b of blocks)assert.ok(painted.includes(b.text));
  assert.ok(calls.filter(c=>c.text.includes('完整分析')).every(c=>c.y<output.height-104));
 }
 assert.equal(clean.output.height,marked.output.height);assert.equal(marked.audit.watermarked,true);
 assert.equal(marked.canvas.dataset.watermarkStyle,'REFERENCE_DIAGONAL_V84');
});
test('pathologically large content stops before allocating an unsafe canvas',()=>{
 assert.throws(()=>render([{kind:'body',text:'完整內容'.repeat(10000)}]),/長圖容量.*完整文字/);
});
