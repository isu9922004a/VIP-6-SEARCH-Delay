'use strict';
const F=require('./engulf-range-fixtures.cjs');
const anchors=[[0,90],[35,110],[45,100],[55,120],[65,110],[75,145],[85,130],[95,155],[105,138],[115,147],[125,128],[135,132]];
function rows(count=129,{down=false,completeFive=false}={}){const dates=F.dates(count);return dates.map((date,i)=>{const k=anchors.findIndex((a,j)=>j<anchors.length-1&&i>=a[0]&&i<=anchors[j+1][0]),[ai,av]=anchors[k<0?anchors.length-2:k],[bi,bv]=anchors[k<0?anchors.length-1:k+1];let close=Math.round((av+(bv-av)*(i-ai)/(bi-ai))*2)/2;if(completeFive&&i>95)close=154.5;if(down)close=500-close;return {date,open:close-.5,close,high:close+.5,low:close-.5,volume:i>=66&&i<=75?180000:100000,completed:true};});}
const report=(count=129,options={})=>F.report(rows(count,options),options.extra||{});
module.exports={rows,report};
