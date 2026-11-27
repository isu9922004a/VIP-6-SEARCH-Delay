import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPostmarketBreadth,officialBreadthQuote} from '../build-postmarket-breadth-v926.mjs';
import Trend from '../../postmarket-trend-v926.js';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const dates=require('../../data/market/research-calendar.json').dates.slice(-21);
const date=dates.at(-1);
const retrievedAt=new Date(`${date}T21:00:00+08:00`).toISOString();
const hash='a'.repeat(64);
const markets={TWSE:'www.twse.com.tw',TPEX:'www.tpex.org.tw'};
const bar=(day,close)=>({date:day,open:close,low:close-1,high:close+1,close,volume:100});
const history=dates.map((day,i)=>bar(day,100+i));
const receipts=Object.entries(markets).flatMap(([market,host])=>['companies','quotes','status'].map(dataset=>({
  market,dataset,date,retrievedAt,sha256:hash,source:`https://${host}/${dataset}`
})));
const stock=(code,market,bars=history,product='COMMON')=>({code,market,bars,product});
const context={analysisDate:date, dataAsOf:`${date}T22:00:00+08:00`,bars:history,instrument:{market:'TAIEX'}};
function fixture() {
  return {date,snapshotHash:hash,sessions:dates,receipts,universe:[stock('1101','TWSE'),stock('1102','TWSE'),
    stock('1103','TWSE'),stock('1104','TWSE',[]),stock('9110','TWSE',[],'OTHER'),stock('6001','TPEX',history.with(10,null)),
    stock('6002','TPEX'),stock('6003','TPEX')],quoteStates:new Map([
    ['TWSE:1101',{state:'COMPARABLE',change:-1}],['TWSE:1102',{state:'NO_COMPARISON'}],
    ['TWSE:1103',{state:'NO_TRADES'}],['TWSE:1104',{state:'MISSING',halted:true}],
    ['TPEX:6001',{state:'COMPARABLE',change:1}],['TPEX:6002',{state:'COMPARABLE',change:0}]
  ])};
}

test('official quote comparison recognizes signs and keeps no-comparison apart from flat',()=>{
  const listed=(sign,amount,volume='10,000')=>officialBreadthQuote('TWSE',{'漲跌(+/-)':sign,漲跌價差:amount,成交股數:volume});
  assert.deepEqual(listed('<p>-</p>','1.25'),{state:'COMPARABLE',change:-1.25});
  assert.deepEqual(listed('X','0.00'),{state:'NO_COMPARISON'});
  assert.deepEqual(listed('','0.00'),{state:'COMPARABLE',change:0});
  assert.deepEqual(listed('','1.00'),{state:'MISSING'});
  assert.deepEqual(listed('','--','0'),{state:'NO_TRADES'});
  assert.deepEqual(officialBreadthQuote('TPEX',{漲跌:'＋1.50',成交股數:'18,000'}),{state:'COMPARABLE',change:1.5});
  assert.deepEqual(officialBreadthQuote('TPEX',{漲跌:'--',成交股數:'18,000'}),{state:'MISSING'});
});

test('official aggregate uses the eligible denominators and withholds incomplete figures',()=>{
  const archive=buildPostmarketBreadth(fixture());
  const state=Trend.marketBreadth(context,archive);
  const {TWSE,TPEX}=state.markets;
  assert.deepEqual(TWSE.coverage,{official:4,suspended:1,noTrades:1,noComparison:1,eligible:1,quote:1,history:1,
    excluded:3,missingQuotes:0,missingHistory:0});
  assert.deepEqual(TWSE.proportions,{up:0,down:1,flat:0});
  assert.equal(TWSE.above20Ratio,1);
  assert.equal(TWSE.counts.newHigh,1);
  assert.equal(TWSE.divergence,true);
  assert.equal(TPEX.coverage.missingQuotes,1);
  assert.equal(TPEX.coverage.missingHistory,2);
  assert.equal(TPEX.proportions,null);
  assert.equal(TPEX.above20Ratio,null);
  assert.equal(TPEX.divergence,null);
  assert.equal(state.status,'DATA_INSUFFICIENT');
});

test('stale, future, ambiguous, off-origin or internally inconsistent breadth cannot certify a market',()=>{
  const clean=buildPostmarketBreadth(fixture());
  assert.deepEqual(Trend.marketBreadth({...context,dataAsOf:`${date}T20:59:00+08:00`},clean).markets,{});
  const late=fixture();
  late.receipts=receipts.map(receipt=>({...receipt,retrievedAt:new Date(Date.parse(`${date}T23:59:59+08:00`)+10000).toISOString()}));
  assert.equal(buildPostmarketBreadth(late),null);
  const unknown=fixture();
  unknown.universe.push(stock('7780','TWSE',[],'UNKNOWN'));
  assert.deepEqual(Object.keys(buildPostmarketBreadth(unknown).markets),['TPEX']);
  const bad=structuredClone(clean);
  bad.markets.TWSE.sources[0].source='https://www.twse.com.tw.invalid/companies';
  bad.markets.TPEX.counts.up++;
  assert.deepEqual(Trend.marketBreadth(context,bad).markets,{});
  assert.equal(Trend.marketBreadth(context,{...clean,date:dates.at(-2)}).status,'DATA_INSUFFICIENT');
});
