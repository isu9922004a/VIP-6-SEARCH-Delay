import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyV922Tpex, ENDPOINTS } from '../verify-tpex-v922.mjs';

const date='2026-11-20', hash=x=>createHash('sha256').update(x).digest('hex');
function fixture() {
  const rows = Array.from({length: 505},(_,i)=>String(1000+i));
  const feed = (key, data, unit) => ({
    source:ENDPOINTS[key], date, rows:data, ...(unit?{unit}:{}),
    rawResponseSha256:'a'.repeat(64),
    sourceRecords:data.length,ordinaryRows:data.length,invalidNumbers:0
  });
  const feeds={
    volume:feed('volume',rows.map(k=>[k,5000]),'shares'),
    margin:feed('margin',rows.map(k=>[k,500,55]),'lots'),
    status:feed('status',['1991','1992'],null)
  };
  const market={tradeDateIso:date,contentSha256:'c'.repeat(64)};
  const calendar={verified:true,dates:[date],source:'https://www.twse.com.tw/exchangeReport/FMTQIK'};
  const snapshot={schema:'V922_TPEX_OFFICIAL_INPUTS_V1',date,verification:'OFFICIAL_DATE_FIELDS_COUNTS_AND_UNITS',markets:{TPEX:feeds}};
  const manifest={schema:'V922_TPEX_OFFICIAL_MANIFEST_V1',date,file:date+'.json',
    completedMarketSnapshot:market.contentSha256,officialCalendarSource:calendar.source,
    verification:snapshot.verification,
    sources:Object.fromEntries(Object.entries(feeds).map(([k,f])=>[k,{
      url:f.source,sha256:f.rawResponseSha256,records:f.sourceRecords,ordinaryRows:f.ordinaryRows,
      unit:f.unit??null}]))};
  const serialize=()=>{const payload=JSON.stringify(snapshot)+'\n';manifest.sha256=hash(payload);return{payload,manifest,market,calendar};};
  return {snapshot,manifest,market,calendar,serialize};
}
test('verified official receipt preserves exactly one consistent trading day',()=>{
  const f=fixture();const result=verifyV922Tpex(f.serialize());
  assert.equal(result.volume,505);assert.equal(result.margin,505);assert.equal(result.flagged,2);
});
test('reject tampering, stale date and unauthorized provenance',()=>{
  const f=fixture();let state=f.serialize();
  assert.throws(()=>verifyV922Tpex({...state,payload:state.payload+' '}),/tampered/);
  f.manifest.date='2026-11-19';state=f.serialize();
  assert.throws(()=>verifyV922Tpex(state),/market session mismatch/);
  f.manifest.date=date;f.manifest.sources.volume.url='https://third-party.invalid/quotes';
  assert.throws(()=>verifyV922Tpex(f.serialize()),/Expected values to be strictly equal/);
});
test('reject an incomplete market, duplicated codes and absent numbers',()=>{
  const f=fixture();f.snapshot.markets.TPEX.volume.rows=f.snapshot.markets.TPEX.volume.rows.slice(0,10);
  let state=f.serialize();f.manifest.sources.volume.ordinaryRows=10;f.snapshot.markets.TPEX.volume.ordinaryRows=10;
  assert.throws(()=>verifyV922Tpex(f.serialize()),/incomplete market coverage/);
  const g=fixture();g.snapshot.markets.TPEX.margin.rows[1][0]=g.snapshot.markets.TPEX.margin.rows[0][0];
  assert.throws(()=>verifyV922Tpex(g.serialize()),/duplicate code/);
  const h=fixture();h.snapshot.markets.TPEX.margin.rows[0][1]=null;
  assert.throws(()=>verifyV922Tpex(h.serialize()),/invalid count/);
});
