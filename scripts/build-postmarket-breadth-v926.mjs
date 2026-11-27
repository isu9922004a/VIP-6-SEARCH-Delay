// Reuse the existing completed-session company, status, quote and OHLCV inputs.
import Patterns from '../postmarket-patterns-v926.js';

const markets = ['TWSE', 'TPEX'];
const datasets = ['companies', 'quotes', 'status'];
const digest = /^[a-f0-9]{64}$/;
const sameSession = (stamp, date) => typeof stamp === 'string' && stamp.endsWith('Z') &&
  Date.parse(stamp) >= Date.parse(`${date}T15:00:00+08:00`) &&
  Date.parse(stamp) <= Date.parse(`${date}T23:59:59.999+08:00`);
const count = text => {
  const value=String(text ?? '').normalize('NFKC').replaceAll(',', '').trim();
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
};

export function officialBreadthQuote(market, raw) {
  if (!raw) return { state:'MISSING' };
  const volume=count(raw.成交股數);
  if (volume===0) return { state:'NO_TRADES' };
  if (!(volume>0)) return { state:'MISSING' };
  if (market==='TPEX') {
    const value=String(raw.漲跌 ?? '').normalize('NFKC').trim();
    const change=count(value);
    if (change!==null) return { state:'COMPARABLE',change };
    return { state:/^(?:X|除權|除息|除權息)$/.test(value)?'NO_COMPARISON':'MISSING' };
  }
  const sign=String(raw['漲跌(+/-)'] ?? raw['漲跌(+／-)'] ?? raw.漲跌 ?? '')
    .replace(/<[^>]+>/g,'').normalize('NFKC').replaceAll('−','-').trim();
  // The exchange publishes an independent sign column. An X cannot count as flat.
  if (sign==='X') return { state:'NO_COMPARISON' };
  const amount=count(raw.漲跌價差);
  if (amount===0 && ['', '+', '-'].includes(sign)) return { state:'COMPARABLE',change:0 };
  if (!(amount>0) || !['+','-'].includes(sign)) return { state:'MISSING' };
  return { state:'COMPARABLE',change:sign==='+'?amount:-amount };
}

export function buildPostmarketBreadth({date,snapshotHash,sessions,receipts,universe,quoteStates}) {
  if (!digest.test(snapshotHash ?? '') || sessions.at(-1)!==date || sessions.length<21) return null;
  const result={};
  const window=sessions.slice(-21);
  for (const market of markets) {
    const sources=receipts.filter(row=>row.market===market && datasets.includes(row.dataset));
    if (sources.length!==datasets.length || new Set(sources.map(row=>row.dataset)).size!==datasets.length ||
        !sources.every(row=>digest.test(row.sha256 ?? '')&&sameSession(row.retrievedAt,date)&&
          (row.date===date || row.dataset==='companies' && row.date===sessions.at(-2)))) continue;
    const all=universe.filter(row=>row.market===market);
    if (all.some(row=>!['COMMON','OTHER'].includes(row.product)) || new Set(all.map(row=>row.code)).size!==all.length) continue;
    const stocks=all.filter(row=>row.product==='COMMON');
    if (!stocks.length) continue;
    const counts={up:0,down:0,flat:0,above20:0,newHigh:0,newLow:0};
    const coverage={official:stocks.length,suspended:0,noTrades:0,noComparison:0,eligible:0,quote:0,history:0};
    for (const stock of stocks) {
      const quote=quoteStates.get(`${market}:${stock.code}`);
      if (quote?.halted) {coverage.suspended++;continue;}
      if (quote?.state==='NO_TRADES') {coverage.noTrades++;continue;}
      if (quote?.state==='NO_COMPARISON') {coverage.noComparison++;continue;}
      coverage.eligible++;
      const last=stock.bars.at(-1);
      if (quote?.state!=='COMPARABLE' || last?.date!==date || !Patterns.validBar(last)) continue;
      coverage.quote++;
      counts[quote.change>0?'up':quote.change<0?'down':'flat']++;
      const bars=stock.bars.slice(-21);
      if (bars.length!==window.length || bars.some((bar,i)=>bar?.date!==window[i]||!Patterns.validBar(bar))) continue;
      coverage.history++;
      const ma=bars.slice(-20).reduce((sum,bar)=>sum+bar.close,0)/20;
      if (last.close>ma) counts.above20++;
      const earlier=bars.slice(0,-1);
      if (last.high>Math.max(...earlier.map(bar=>bar.high))) counts.newHigh++;
      if (last.low<Math.min(...earlier.map(bar=>bar.low))) counts.newLow++;
    }
    result[market]={sources,counts,coverage};
  }
  return Object.keys(result).length ? {schema:'OFFICIAL_POSTMARKET_BREADTH_V1',date,snapshotHash,
    priceBasis:'UNADJUSTED_OFFICIAL_OHLC',markets:result} : null;
}
