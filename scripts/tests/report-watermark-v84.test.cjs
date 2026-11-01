'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),watermark=require('../../report-watermark-v84.js');
function canvas(){const calls=[],c={width:1284,height:2778,dataset:{}};const x={canvas:c,save(){calls.push(['save']);},restore(){calls.push(['restore']);},setTransform(...v){calls.push(['transform',...v]);},translate(...v){calls.push(['translate',...v]);},rotate(v){calls.push(['rotate',v]);},measureText:t=>({width:t.length*25}),fillText(...v){calls.push(['text',...v]);},getImageData:()=>({data:[255,255,255,255]})};c.getContext=()=>x;return {c,x,calls};}
test('reference watermark draws one diagonal, a pale footer and source edges, once per canvas',()=>{
 const {c,calls}=canvas();assert.equal(watermark.apply(c),c);assert.equal(c.dataset.watermarkStyle,watermark.STYLE);
 assert.equal(calls.filter(v=>v[0]==='rotate').length,1);assert.equal(calls.find(v=>v[0]==='rotate')[1],-Math.PI/9);
 assert.equal(calls.filter(v=>v[0]==='text').length,4);const count=calls.length;watermark.apply(c);assert.equal(calls.length,count);
});
test('professional watermark follows the chart and region painting preserves the sharing transform',()=>{
 const {c,x,calls}=canvas();c.dataset.reportMode='professional';watermark.apply(c);
 assert.ok(calls.find(v=>v[0]==='translate')[2]>c.height*.45);
 calls.length=0;watermark.paint(x,{width:1284,height:2778,type:'all'});assert.equal(calls.some(v=>v[0]==='transform'),false);
 assert.equal(calls.filter(v=>v[0]==='save').length,calls.filter(v=>v[0]==='restore').length);
});
