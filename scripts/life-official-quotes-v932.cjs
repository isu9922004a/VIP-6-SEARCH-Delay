'use strict';
const fs=require('fs'),assert=require('assert/strict');
function loadQuotes(files,date){
 const quotes=new Map(),num=v=>typeof v==='number'?v:typeof v==='string'&&/^[+-]?[\d,.]+$/.test(v.trim())?Number(v.replaceAll(',','')):null;
 for(const market of ['TWSE','TPEX']){const bytes=fs.readFileSync(files[market]),body=JSON.parse(bytes[0]===31&&bytes[1]===139?require('zlib').gunzipSync(bytes):bytes);assert.equal(String(body.date).replaceAll('/','').replaceAll('-',''),date.replaceAll('-',''),'official response date');const tables=body.tables||[{fields:body.fields9,data:body.data9}];for(const table of tables){const fields=table.fields||[];const codeIndex=fields.findIndex(f=>/證券代號|代號/.test(f));const indexes=Object.fromEntries(Object.entries({open:/^開盤(?:價)?$/,high:/^最高(?:價)?$/,low:/^最低(?:價)?$/,close:/^收盤(?:價)?$/,volume:/成交股數/}).map(([k,re])=>[k,fields.findIndex(f=>re.test(f))]));if(codeIndex<0||Object.values(indexes).some(i=>i<0))continue;for(const row of table.data||[])quotes.set(market+'|'+String(row[codeIndex]).trim(),Object.fromEntries(Object.entries(indexes).map(([k,i])=>[k,num(row[i])])));}}
 return quotes;
}
module.exports={loadQuotes};
