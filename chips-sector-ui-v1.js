/* 孫悟空STOCK 9.1LX｜籌碼板塊泡泡圖（證交所／櫃買中心盤後籌碼）＋ 個股三大法人籌碼卡 */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const state = {
    sectorDoc: null,
    sectorLoading: null,
    stocksDoc: null,
    stocksLoading: null,
    bubbleMode: 'focus', // 'focus' (四角重點12) | 'all' (全部板塊)
    quadrantFilter: null, // null | 'accelerate' | 'weaken' | 'bottoming' | 'receding'
    sidebarRange: '1d', // '1d' | '5d'
    moverTab: 'buy', // 'buy' | 'sell'
    selectedSector: null,
    stockChartSeries: 'total', // 'total' | 'foreign' | 'trust' | 'dealer'
    lastStockCode: '',
  };

  const QUADRANT_META = {
    accelerate: { key: 'accelerate', label: '加速', sub: '加速流入', fill: '#B84A39', stroke: '#F09A6A', glow: 'rgba(240, 154, 106, 0.35)', text: '#FDE8D7' },
    weaken: { key: 'weaken', label: '轉弱', sub: '流入放緩', fill: '#9E7B26', stroke: '#E8CC7D', glow: 'rgba(232, 204, 125, 0.34)', text: '#FCF3CF' },
    bottoming: { key: 'bottoming', label: '築底', sub: '流出收斂', fill: '#3B426B', stroke: '#9BA5CF', glow: 'rgba(155, 165, 207, 0.28)', text: '#E7E9F5' },
    receding: { key: 'receding', label: '退潮', sub: '持續流出', fill: '#146B54', stroke: '#45C496', glow: 'rgba(69, 196, 150, 0.32)', text: '#CCF5E5' },
  };

  const $ = (id) => doc.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmtYi(v, showPlus = true) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    const sign = n > 0 && showPlus ? '+' : '';
    const abs = Math.abs(n);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return `${sign}${n.toFixed(digits)}億`;
  }

  function fmtLots(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    const sign = n > 0 ? '+' : '';
    return `${sign}${Math.round(n).toLocaleString('en-US')} 張`;
  }

  function flowClass(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return 'chips-flat';
    return n > 0 ? 'chips-buy' : 'chips-sell';
  }

  function streakBadge(label, val) {
    const n = Number(val) || 0;
    if (n === 0) return '';
    const cls = n > 0 ? 'chips-streak-buy' : 'chips-streak-sell';
    return `<span class="chips-streak ${cls}">${esc(label)}連 ${Math.abs(n)} ${n > 0 ? '買' : '賣'}</span>`;
  }

  function jumpToStock(code) {
    const input = $('stockInput');
    if (input) input.value = String(code);
    root.ShitouWorkspaceV831?.select?.('stock');
    if (typeof root.analyzeStock === 'function') {
      setTimeout(() => root.analyzeStock(), 40);
    }
  }

  async function loadSectorDoc() {
    if (state.sectorDoc) return state.sectorDoc;
    if (!state.sectorLoading) {
      state.sectorLoading = fetch(`./data/chips/sector-flow.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((d) => {
          state.sectorDoc = d;
          return d;
        })
        .catch((err) => {
          state.sectorLoading = null;
          throw err;
        });
    }
    return state.sectorLoading;
  }

  async function loadStocksDoc() {
    if (state.stocksDoc) return state.stocksDoc;
    if (!state.stocksLoading) {
      state.stocksLoading = fetch(`./data/chips/stocks-latest.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((d) => {
          state.stocksDoc = d;
          return d;
        })
        .catch((err) => {
          state.stocksLoading = null;
          throw err;
        });
    }
    return state.stocksLoading;
  }

  // Symlog transform for smooth separation of mega & mid sectors
  function symlog(v, linthresh) {
    return Math.sign(v) * Math.log10(1 + Math.abs(v) / linthresh);
  }

  function pickVisibleSectors(docData) {
    const all = Array.isArray(docData?.sectors) ? docData.sectors : [];
    if (state.quadrantFilter) {
      return all.filter((s) => s.quadrant === state.quadrantFilter);
    }
    if (state.bubbleMode === 'all') return all;
    // 'focus': up to 3 most active sectors per quadrant (12 total, matching Tide 四角重點)
    const buckets = { accelerate: [], weaken: [], bottoming: [], receding: [] };
    for (const s of all) {
      if (buckets[s.quadrant]) buckets[s.quadrant].push(s);
    }
    const picked = [];
    for (const key of ['accelerate', 'weaken', 'bottoming', 'receding']) {
      buckets[key].sort((a, b) => Math.abs(b.net5dYi) + b.abs20dYi * 0.25 - (Math.abs(a.net5dYi) + a.abs20dYi * 0.25));
      picked.push(...buckets[key].slice(0, 3));
    }
    return picked;
  }

  function renderBubbleSvg(docData) {
    const host = $('chipsBubbleChartHost');
    if (!host) return;
    const sectors = pickVisibleSectors(docData);
    const W = 860;
    const H = 540;
    const padL = 74;
    const padR = 28;
    const padT = 26;
    const padB = 46;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const xThresh = 6;
    const yThresh = 1.2;
    const allSecs = docData.sectors || [];
    const maxAbsX = Math.max(50, ...allSecs.map((s) => Math.abs(s.net5dYi || 0)));
    const maxAbsY = Math.max(5, ...allSecs.map((s) => Math.abs(s.accelYiPerDay || 0)));
    const xMaxLog = symlog(maxAbsX * 1.15, xThresh);
    const yMaxLog = symlog(maxAbsY * 1.15, yThresh);

    const mapX = (v) => padL + ((symlog(v, xThresh) + xMaxLog) / (2 * xMaxLog)) * plotW;
    const mapY = (v) => padT + ((yMaxLog - symlog(v, yThresh)) / (2 * yMaxLog)) * plotH;
    const zeroX = mapX(0);
    const zeroY = mapY(0);

    // Bubble radius based on log(abs20dYi)
    const maxAbs20 = Math.max(10, ...allSecs.map((s) => s.abs20dYi || 0));
    const mapR = (abs20) => {
      const ratio = Math.log10(1 + Math.max(0, abs20)) / Math.log10(1 + maxAbs20);
      return Math.round(23 + ratio * 23); // 23px .. 46px
    };

    const nodes = sectors.map((s) => {
      const r = mapR(s.abs20dYi);
      return {
        sector: s,
        x: Math.max(padL + r + 2, Math.min(W - padR - r - 2, mapX(s.net5dYi))),
        y: Math.max(padT + r + 2, Math.min(H - padB - r - 2, mapY(s.accelYiPerDay))),
        r,
      };
    });

    // Gentle collision relaxation while preserving quadrant membership
    for (let iter = 0; iter < 45; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const minDist = a.r + b.r + 5;
          if (dist < minDist) {
            const push = (minDist - dist) * 0.45;
            const ux = dx / dist;
            const uy = dy / dist;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }
      for (const n of nodes) {
        // Keep inside plot bounds and respect quadrant side of zero crosshair
        const s = n.sector;
        const minX = s.net5dYi > 0 ? zeroX + n.r + 3 : padL + n.r + 2;
        const maxX = s.net5dYi <= 0 ? zeroX - n.r - 3 : W - padR - n.r - 2;
        const minY = s.accelYiPerDay <= 0 ? zeroY + n.r + 3 : padT + n.r + 2;
        const maxY = s.accelYiPerDay > 0 ? zeroY - n.r - 3 : H - padB - n.r - 2;
        if (minX <= maxX) n.x = Math.max(minX, Math.min(maxX, n.x));
        if (minY <= maxY) n.y = Math.max(minY, Math.min(maxY, n.y));
      }
    }

    const xTicks = [-1000, -200, -50, -10, -2, 0, 2, 10, 50, 200, 1000].filter((v) => Math.abs(v) <= maxAbsX * 1.15);
    const yTicks = [-50, -10, -2, -1, 0, 1, 2, 5, 10, 50].filter((v) => Math.abs(v) <= maxAbsY * 1.15);

    const gridLines = [
      ...xTicks.map((v) => {
        const x = mapX(v);
        const isZero = v === 0;
        const label = v > 0 ? `+${v}` : `${v}`;
        return `
          <line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${H - padB}"
            stroke="${isZero ? 'rgba(201,162,63,0.48)' : 'rgba(201,162,63,0.11)'}"
            stroke-width="${isZero ? 1.4 : 1}" />
          <text x="${x.toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" fill="#9E9A90" font-size="11">${label}</text>
        `;
      }),
      ...yTicks.map((v) => {
        const y = mapY(v);
        const isZero = v === 0;
        const label = v === 0 ? '0億/天' : `${v > 0 ? '+' : ''}${v}億/天`;
        return `
          <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"
            stroke="${isZero ? 'rgba(201,162,63,0.48)' : 'rgba(201,162,63,0.11)'}"
            stroke-width="${isZero ? 1.4 : 1}" />
          <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#9E9A90" font-size="11">${label}</text>
        `;
      }),
    ].join('');

    const bubblesSvg = nodes
      .map((n) => {
        const s = n.sector;
        const qm = QUADRANT_META[s.quadrant] || QUADRANT_META.receding;
        const isSel = state.selectedSector === s.name;
        const shortName = s.name.replace(/及週邊設備業$/, '週邊').replace(/工業$/, '').replace(/業$/, '');
        const fontSize = n.r >= 36 ? 12.5 : n.r >= 29 ? 11.5 : 10.5;
        const valSize = n.r >= 34 ? 11 : 10;
        return `
          <g class="chips-bubble-node ${isSel ? 'is-selected' : ''}" data-sector-name="${esc(s.name)}" role="button" tabindex="0" aria-label="${esc(s.name)} 近5日 ${fmtYi(s.net5dYi)}">
            <circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r}"
              fill="${qm.fill}" fill-opacity="${isSel ? '0.96' : '0.82'}"
              stroke="${isSel ? '#ffffff' : qm.stroke}" stroke-width="${isSel ? 2.8 : 1.8}" />
            <text x="${n.x.toFixed(1)}" y="${(n.y - 3).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="${fontSize}" font-weight="700" pointer-events="none">${esc(shortName.slice(0, 6))}</text>
            <text x="${n.x.toFixed(1)}" y="${(n.y + 12).toFixed(1)}" text-anchor="middle" fill="${qm.text}" font-size="${valSize}" font-weight="600" pointer-events="none">${fmtYi(s.net5dYi)}</text>
          </g>
        `;
      })
      .join('');

    host.innerHTML = `
      <svg class="chips-bubble-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="三大法人板塊籌碼四象限泡泡圖">
        <defs>
          <radialGradient id="chipsQuadBg" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stop-color="#1A2042" />
            <stop offset="100%" stop-color="#0E1228" />
          </radialGradient>
        </defs>
        <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" rx="10" fill="url(#chipsQuadBg)" stroke="rgba(201,162,63,0.22)" />
        <text x="${padL + 14}" y="${padT + 22}" fill="rgba(182,177,166,0.42)" font-size="13" font-weight="800">築底｜流出收斂</text>
        <text x="${W - padR - 14}" y="${padT + 22}" text-anchor="end" fill="rgba(240,154,106,0.50)" font-size="13" font-weight="800">加速｜持續流入</text>
        <text x="${padL + 14}" y="${H - padB - 12}" fill="rgba(69,196,150,0.46)" font-size="13" font-weight="800">退潮｜持續流出</text>
        <text x="${W - padR - 14}" y="${H - padB - 12}" text-anchor="end" fill="rgba(232,204,125,0.48)" font-size="13" font-weight="800">轉弱｜流入放緩</text>
        ${gridLines}
        <text x="${padL + 4}" y="${H - 8}" fill="#45C496" font-size="11.5" font-weight="700">← 資金流出（近 5 日億元）</text>
        <text x="${W - padR - 4}" y="${H - 8}" text-anchor="end" fill="#E86A7A" font-size="11.5" font-weight="700">資金流入（近 5 日億元） →</text>
        ${bubblesSvg}
      </svg>
    `;

    host.querySelectorAll('.chips-bubble-node').forEach((g) => {
      const name = g.dataset.sectorName;
      const select = () => {
        state.selectedSector = name;
        renderBubbleSvg(docData);
        renderSectorDetail(docData);
      };
      g.addEventListener('click', select);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });
    });
  }

  function renderSectorDetail(docData) {
    const box = $('chipsSectorDetail');
    if (!box) return;
    const sec = (docData.sectors || []).find((s) => s.name === state.selectedSector);
    if (!sec) {
      box.innerHTML = `<div class="chips-detail-placeholder">點擊任一板塊泡泡或右側資金排行，查看該板塊三大法人分項與買賣超前 5 檔代表股。</div>`;
      return;
    }
    const qm = QUADRANT_META[sec.quadrant] || QUADRANT_META.receding;
    const buyers = state.sidebarRange === '1d' ? sec.topBuyers1d : sec.topBuyers5d;
    const sellers = state.sidebarRange === '1d' ? sec.topSellers1d : sec.topSellers5d;
    const valKey = state.sidebarRange === '1d' ? 'tot1Yi' : 'tot5Yi';
    const lotsKey = state.sidebarRange === '1d' ? 'tot1Lots' : 'tot5Lots';
    const rangeLabel = state.sidebarRange === '1d' ? '今日' : '近 5 日';

    const renderStockRows = (list) => {
      if (!list || !list.length) return '<div class="chips-empty-row">無明顯紀錄</div>';
      return list
        .map(
          (st) => `
          <button type="button" class="chips-stock-row" data-jump-code="${esc(st.code)}">
            <span class="chips-sr-left"><strong>${esc(st.code)} ${esc(st.name)}</strong><small>收 ${st.close}（${st.pct >= 0 ? '+' : ''}${st.pct}%）</small></span>
            <span class="chips-sr-right ${flowClass(st[valKey])}"><strong>${fmtYi(st[valKey])}</strong><small>${fmtLots(st[lotsKey])}</small></span>
          </button>
        `
        )
        .join('');
    };

    box.innerHTML = `
      <div class="chips-detail-head">
        <div class="chips-detail-title">
          <span class="chips-quad-pill" style="background:${qm.fill};border-color:${qm.stroke};color:#fff">${esc(qm.label)}・${esc(qm.sub)}</span>
          <strong>${esc(sec.name)}</strong>
          <small>共 ${sec.stockCount} 檔（近 5 日 ${sec.buyCount5d} 買 / ${sec.sellCount5d} 賣）</small>
        </div>
        <div class="chips-detail-kpis">
          <span>今日 <strong class="${flowClass(sec.net1dYi)}">${fmtYi(sec.net1dYi)}</strong></span>
          <span>近 5 日 <strong class="${flowClass(sec.net5dYi)}">${fmtYi(sec.net5dYi)}</strong></span>
          <span>動能差 <strong class="${flowClass(sec.accelYiPerDay)}">${fmtYi(sec.accelYiPerDay)}/天</strong></span>
        </div>
      </div>
      <div class="chips-breakdown-row">
        <span>5日外資 <strong class="${flowClass(sec.breakdown5d.foreignYi)}">${fmtYi(sec.breakdown5d.foreignYi)}</strong></span>
        <span>5日投信 <strong class="${flowClass(sec.breakdown5d.trustYi)}">${fmtYi(sec.breakdown5d.trustYi)}</strong></span>
        <span>5日自營商 <strong class="${flowClass(sec.breakdown5d.dealerYi)}">${fmtYi(sec.breakdown5d.dealerYi)}</strong></span>
        <span>近 20 日累計 <strong class="${flowClass(sec.net20dYi)}">${fmtYi(sec.net20dYi)}</strong></span>
      </div>
      <div class="chips-detail-cols">
        <div class="chips-detail-col">
          <h4>🔴 ${rangeLabel}法人買超前 5 檔（點擊查個股）</h4>
          ${renderStockRows(buyers)}
        </div>
        <div class="chips-detail-col">
          <h4>🟢 ${rangeLabel}法人賣超前 5 檔（點擊查個股）</h4>
          ${renderStockRows(sellers)}
        </div>
      </div>
    `;

    box.querySelectorAll('[data-jump-code]').forEach((btn) => {
      btn.addEventListener('click', () => jumpToStock(btn.dataset.jumpCode));
    });
  }

  function renderSidebar(docData) {
    const side = $('chipsSectorSidebar');
    if (!side) return;
    const ms = docData.marketSummary || {};
    const latest = ms.latest || { foreignYi: 0, trustYi: 0, dealerYi: 0, totalYi: 0 };
    const hist = ms.history10d || [];
    const maxHist = Math.max(20, ...hist.map((h) => Math.abs(h.totalYi || 0)));
    const miniBars = hist
      .map((h, i) => {
        const barH = Math.max(4, Math.round((Math.abs(h.totalYi) / maxHist) * 28));
        const x = i * 24 + 4;
        const y = h.totalYi >= 0 ? 32 - barH : 32;
        const color = h.totalYi >= 0 ? '#fb7185' : '#34d399';
        return `<rect x="${x}" y="${y}" width="16" height="${barH}" rx="3" fill="${color}"><title>${h.date}：合計 ${fmtYi(h.totalYi)}（外資 ${fmtYi(h.foreignYi)}）</title></rect>`;
      })
      .join('');

    const sectors = docData.sectors || [];
    const sortKey = state.sidebarRange === '1d' ? 'net1dYi' : 'net5dYi';
    const buyTop = [...sectors].sort((a, b) => b[sortKey] - a[sortKey]).filter((s) => s[sortKey] > 0).slice(0, 4);
    const sellTop = [...sectors].sort((a, b) => a[sortKey] - b[sortKey]).filter((s) => s[sortKey] < 0).slice(0, 4);

    const renderSecList = (list, isBuy) => {
      if (!list.length) return '<div class="chips-empty-row">今日無明顯淨流向</div>';
      return list
        .map((s) => {
          const reps = (state.sidebarRange === '1d'
            ? isBuy
              ? s.topBuyers1d
              : s.topSellers1d
            : isBuy
            ? s.topBuyers5d
            : s.topSellers5d
          )
            .slice(0, 2)
            .map((x) => x.name)
            .join('、');
          const cnt =
            state.sidebarRange === '1d'
              ? isBuy
                ? `${s.buyCount1d}/${s.stockCount} 檔買超`
                : `${s.sellCount1d}/${s.stockCount} 檔賣超`
              : isBuy
              ? `${s.buyCount5d}/${s.stockCount} 檔買超`
              : `${s.sellCount5d}/${s.stockCount} 檔賣超`;
          return `
            <button type="button" class="chips-flow-item ${state.selectedSector === s.name ? 'is-selected' : ''}" data-pick-sector="${esc(s.name)}">
              <div class="chips-fi-left">
                <strong>${esc(s.name)}</strong>
                <small>${esc(cnt)}${reps ? `・${esc(reps)}` : ''}</small>
              </div>
              <span class="chips-fi-val ${flowClass(s[sortKey])}">${fmtYi(s[sortKey])}</span>
            </button>
          `;
        })
        .join('');
    };

    const moverList =
      state.sidebarRange === '1d'
        ? state.moverTab === 'buy'
          ? docData.topStocks?.buy1d || []
          : docData.topStocks?.sell1d || []
        : state.moverTab === 'buy'
        ? docData.topStocks?.buy5d || []
        : docData.topStocks?.sell5d || [];
    const mvKey = state.sidebarRange === '1d' ? 'tot1Yi' : 'tot5Yi';
    const mvLots = state.sidebarRange === '1d' ? 'tot1Lots' : 'tot5Lots';

    side.innerHTML = `
      <div class="chips-side-card">
        <div class="chips-side-head">
          <strong>今日盤後三大法人</strong>
          <small>${esc(docData.tradeDate)}</small>
        </div>
        <div class="chips-mkt-total ${flowClass(latest.totalYi)}">${fmtYi(latest.totalYi)}</div>
        <div class="chips-mkt-sub-grid">
          <div><span>外資</span><strong class="${flowClass(latest.foreignYi)}">${fmtYi(latest.foreignYi)}</strong></div>
          <div><span>投信</span><strong class="${flowClass(latest.trustYi)}">${fmtYi(latest.trustYi)}</strong></div>
          <div><span>自營商</span><strong class="${flowClass(latest.dealerYi)}">${fmtYi(latest.dealerYi)}</strong></div>
        </div>
        <div class="chips-mini-hist">
          <div class="chips-mini-label">近 10 日大盤三大法人合計（億元）</div>
          <svg viewBox="0 0 244 64" width="100%" height="58">
            <line x1="0" y1="32" x2="244" y2="32" stroke="rgba(148,163,184,0.28)" stroke-width="1" />
            ${miniBars}
          </svg>
        </div>
      </div>

      <div class="chips-side-card">
        <div class="chips-side-head">
          <strong>資金去向（板塊）</strong>
          <div class="chips-seg">
            <button type="button" class="${state.sidebarRange === '1d' ? 'is-active' : ''}" data-side-range="1d">今日</button>
            <button type="button" class="${state.sidebarRange === '5d' ? 'is-active' : ''}" data-side-range="5d">近 5 日</button>
          </div>
        </div>
        <div class="chips-flow-group-label chips-buy">● 法人買最多</div>
        ${renderSecList(buyTop, true)}
        <div class="chips-flow-group-label chips-sell" style="margin-top:10px">● 法人賣最多</div>
        ${renderSecList(sellTop, false)}
      </div>

      <div class="chips-side-card">
        <div class="chips-side-head">
          <strong>個股法人焦點</strong>
          <div class="chips-seg">
            <button type="button" class="${state.moverTab === 'buy' ? 'is-active' : ''}" data-mover-tab="buy">買超 Top 5</button>
            <button type="button" class="${state.moverTab === 'sell' ? 'is-active' : ''}" data-mover-tab="sell">賣超 Top 5</button>
          </div>
        </div>
        ${moverList
          .slice(0, 5)
          .map(
            (st) => `
          <button type="button" class="chips-stock-row" data-jump-code="${esc(st.code)}">
            <span class="chips-sr-left"><strong>${esc(st.code)} ${esc(st.name)}</strong><small>${esc(st.industry || '')}</small></span>
            <span class="chips-sr-right ${flowClass(st[mvKey])}"><strong>${fmtYi(st[mvKey])}</strong><small>${fmtLots(st[mvLots])}</small></span>
          </button>
        `
          )
          .join('')}
      </div>
    `;

    side.querySelectorAll('[data-side-range]').forEach((b) => {
      b.addEventListener('click', () => {
        state.sidebarRange = b.dataset.sideRange;
        renderSidebar(docData);
        renderSectorDetail(docData);
      });
    });
    side.querySelectorAll('[data-mover-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        state.moverTab = b.dataset.moverTab;
        renderSidebar(docData);
      });
    });
    side.querySelectorAll('[data-pick-sector]').forEach((b) => {
      b.addEventListener('click', () => {
        state.selectedSector = b.dataset.pickSector;
        if (state.quadrantFilter) state.quadrantFilter = null;
        if (state.bubbleMode === 'focus') {
          const visible = pickVisibleSectors(docData);
          if (!visible.some((x) => x.name === state.selectedSector)) state.bubbleMode = 'all';
        }
        renderSectorBoard(docData);
      });
    });
    side.querySelectorAll('[data-jump-code]').forEach((b) => {
      b.addEventListener('click', () => jumpToStock(b.dataset.jumpCode));
    });
  }

  function renderSectorBoard(docData) {
    const qCounts = docData.quadrantCounts || {};
    const rail = $('chipsQuadRail');
    if (rail) {
      rail.innerHTML = ['accelerate', 'weaken', 'bottoming', 'receding']
        .map((k) => {
          const m = QUADRANT_META[k];
          const active = state.quadrantFilter === k;
          return `
            <button type="button" class="chips-quad-card ${active ? 'is-active' : ''}" data-quad="${k}" style="--q-accent:${m.stroke}">
              <span class="chips-qc-name" style="color:${m.stroke}">${m.label}</span>
              <strong class="chips-qc-num">${qCounts[k] ?? 0}</strong>
              <span class="chips-qc-sub">${m.sub}</span>
            </button>
          `;
        })
        .join('');
      rail.querySelectorAll('[data-quad]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const q = btn.dataset.quad;
          state.quadrantFilter = state.quadrantFilter === q ? null : q;
          renderSectorBoard(docData);
        });
      });
    }

    const toolbar = $('chipsBubbleToolbar');
    if (toolbar) {
      const totalSecs = (docData.sectors || []).length;
      toolbar.innerHTML = `
        <div class="chips-tb-left">
          <span class="chips-tb-title">💰 板塊泡泡圖</span>
          <div class="chips-seg">
            <button type="button" class="${state.bubbleMode === 'focus' && !state.quadrantFilter ? 'is-active' : ''}" data-bmode="focus">四角重點 (12)</button>
            <button type="button" class="${state.bubbleMode === 'all' && !state.quadrantFilter ? 'is-active' : ''}" data-bmode="all">全部板塊 (${totalSecs})</button>
          </div>
          ${state.quadrantFilter ? '<button type="button" class="mini-btn chips-reset-btn" id="chipsResetFilter">✕ 清除象限篩選</button>' : ''}
        </div>
        <div class="chips-tb-legend">橫軸＝近 5 日淨買賣超（億）｜縱軸＝比近 20 日均額加減速（億/天）｜圈越大＝近 20 日進出規模越大｜資料日期 ${esc(docData.tradeDate)}</div>
      `;
      toolbar.querySelectorAll('[data-bmode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.quadrantFilter = null;
          state.bubbleMode = btn.dataset.bmode;
          renderSectorBoard(docData);
        });
      });
      $('chipsResetFilter')?.addEventListener('click', () => {
        state.quadrantFilter = null;
        renderSectorBoard(docData);
      });
    }

    if (!state.selectedSector && docData.sectors?.length) {
      state.selectedSector = docData.sectors[0].name;
    }

    renderBubbleSvg(docData);
    renderSectorDetail(docData);
    renderSidebar(docData);
  }

  async function ensureSectorBoardLoaded() {
    const host = $('chipsBubbleChartHost');
    if (!host) return;
    if (state.sectorDoc) {
      renderSectorBoard(state.sectorDoc);
      return;
    }
    host.innerHTML = '<div class="chips-loading">⏳ 正在載入證交所／櫃買中心近 20 日盤後籌碼板塊資料…</div>';
    try {
      const docData = await loadSectorDoc();
      renderSectorBoard(docData);
    } catch (err) {
      host.innerHTML = `<div class="chips-error">⚠️ 籌碼板塊資料載入失敗：${esc(err?.message || err)}</div>`;
    }
  }

  // ---- Part 2: Individual Stock Three-Institutions Card inside #result ----
  function renderStockChipsBarSvg(series, mode) {
    if (!Array.isArray(series) || !series.length) return '';
    const idx = mode === 'foreign' ? 1 : mode === 'trust' ? 2 : mode === 'dealer' ? 3 : 4;
    const vals = series.map((r) => Number(r[idx]) || 0);
    const maxAbs = Math.max(10, ...vals.map((v) => Math.abs(v)));
    const W = 680;
    const H = 128;
    const padX = 14;
    const midY = 58;
    const maxBarH = 44;
    const step = (W - padX * 2) / series.length;
    const barW = Math.max(10, Math.min(22, step - 6));

    const bars = series
      .map((row, i) => {
        const v = vals[i];
        const h = v === 0 ? 2 : Math.max(4, Math.round((Math.abs(v) / maxAbs) * maxBarH));
        const x = padX + i * step + (step - barW) / 2;
        const y = v >= 0 ? midY - h : midY;
        const color = v > 0 ? '#fb7185' : v < 0 ? '#34d399' : '#475569';
        const showLabel = i === 0 || i === series.length - 1 || i % 4 === 0;
        return `
          <g>
            <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h}" rx="3" fill="${color}">
              <title>${row[0]}：${fmtLots(v)}（合計 ${fmtYi(row[5])}）</title>
            </rect>
            ${showLabel ? `<text x="${(x + barW / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="#64748b" font-size="10.5">${esc(row[0])}</text>` : ''}
          </g>
        `;
      })
      .join('');

    return `
      <svg class="stock-chips-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="近 20 交易日三大法人買賣超柱狀圖">
        <line x1="${padX}" y1="${midY}" x2="${W - padX}" y2="${midY}" stroke="rgba(148,163,184,0.32)" stroke-width="1" />
        ${bars}
      </svg>
    `;
  }

  async function renderStockChipsCard(report) {
    const result = $('result');
    const cmdCenter = $('beginnerCommandCenterV46');
    if (!result || !cmdCenter) return;
    const code = String(report?.code || report?.stock || '').trim();
    if (!/^[1-9]\d{3}$/.test(code)) return;

    let card = $('stockChipsCardV90');
    if (!card) {
      card = doc.createElement('section');
      card.id = 'stockChipsCardV90';
      card.className = 'panel stock-chips-card';
      card.setAttribute('aria-label', '個股三大法人盤後籌碼');
      cmdCenter.before(card);
    }

    state.lastStockCode = code;
    card.innerHTML = '<div class="chips-loading">⏳ 正在讀取證交所／櫃買中心三大法人籌碼資料…</div>';

    try {
      const stocksDoc = await loadStocksDoc();
      if (state.lastStockCode !== code) return;
      const st = stocksDoc?.stocks?.[code];
      if (!st) {
        card.innerHTML = `
          <div class="stock-chips-head">
            <div class="section-title">🏦 三大法人盤後籌碼</div>
            <span class="meta">基準日 ${esc(stocksDoc?.tradeDate || '—')}</span>
          </div>
          <div class="chips-empty-row">此標的暫無官方三大法人盤後買賣超資料。</div>
        `;
        return;
      }

      const [stF, stT, stD, stTot] = st.st || [0, 0, 0, 0];
      const streaks = [
        streakBadge('外資', stF),
        streakBadge('投信', stT),
        streakBadge('自營商', stD),
        streakBadge('三大法人', stTot),
      ]
        .filter(Boolean)
        .join('');

      const drawCard = () => {
        card.innerHTML = `
          <div class="stock-chips-head">
            <div>
              <div class="section-title">🏦 三大法人盤後籌碼｜${esc(st.n)}（${esc(code)}）</div>
              <div class="stock-chips-meta">資料日期：${esc(stocksDoc.tradeDate)}｜來源：證交所 T86／櫃買中心官方盤後資料（1 張 = 1,000 股）</div>
            </div>
            <div class="stock-chips-streaks">${streaks || '<span class="chips-streak">今日無連續買賣超</span>'}</div>
          </div>
          <div class="stock-chips-grid">
            <div class="stock-chips-kpi">
              <div class="k">外資及陸資</div>
              <div class="v ${flowClass(st.f1)}">${fmtLots(st.f1)}</div>
              <div class="s">估 ${fmtYi(st.f1Yi)}｜5日 ${fmtLots(st.f5)}｜20日 ${fmtLots(st.f20)}</div>
            </div>
            <div class="stock-chips-kpi">
              <div class="k">投信</div>
              <div class="v ${flowClass(st.t1)}">${fmtLots(st.t1)}</div>
              <div class="s">估 ${fmtYi(st.t1Yi)}｜5日 ${fmtLots(st.t5)}｜20日 ${fmtLots(st.t20)}</div>
            </div>
            <div class="stock-chips-kpi">
              <div class="k">自營商</div>
              <div class="v ${flowClass(st.d1)}">${fmtLots(st.d1)}</div>
              <div class="s">估 ${fmtYi(st.d1Yi)}｜5日 ${fmtLots(st.d5)}｜20日 ${fmtLots(st.d20)}</div>
            </div>
            <div class="stock-chips-kpi is-total">
              <div class="k">三大法人合計</div>
              <div class="v ${flowClass(st.tot1)}">${fmtLots(st.tot1)}</div>
              <div class="s">今日 ${fmtYi(st.tot1Yi)}｜5日 ${fmtYi(st.tot5Yi)}｜20日 ${fmtYi(st.tot20Yi)}</div>
            </div>
          </div>
          <div class="stock-chips-chart-wrap">
            <div class="stock-chips-chart-head">
              <span>近 ${st.s?.length || 20} 交易日買賣超趨勢（張數｜紅買綠賣）</span>
              <div class="chips-seg">
                <button type="button" class="${state.stockChartSeries === 'total' ? 'is-active' : ''}" data-sc-series="total">合計</button>
                <button type="button" class="${state.stockChartSeries === 'foreign' ? 'is-active' : ''}" data-sc-series="foreign">外資</button>
                <button type="button" class="${state.stockChartSeries === 'trust' ? 'is-active' : ''}" data-sc-series="trust">投信</button>
                <button type="button" class="${state.stockChartSeries === 'dealer' ? 'is-active' : ''}" data-sc-series="dealer">自營商</button>
              </div>
            </div>
            ${renderStockChipsBarSvg(st.s, state.stockChartSeries)}
          </div>
        `;
        card.querySelectorAll('[data-sc-series]').forEach((b) => {
          b.addEventListener('click', () => {
            state.stockChartSeries = b.dataset.scSeries;
            drawCard();
          });
        });
      };
      drawCard();
    } catch (err) {
      card.innerHTML = `<div class="chips-error">⚠️ 三大法人籌碼載入失敗：${esc(err?.message || err)}</div>`;
    }
  }

  function hookStockAnalysis() {
    const tryRefresh = () => {
      const result = $('result');
      if (!result || result.style.display !== 'block') return;
      const report = root.shitouGetLastReportV82?.();
      const code = String(report?.code || report?.stock || '').trim();
      if (code && (code !== state.lastStockCode || !$('stockChipsCardV90'))) {
        renderStockChipsCard(report);
      }
    };

    const result = $('result');
    if (result) {
      new MutationObserver(tryRefresh).observe(result, { attributes: true, attributeFilter: ['style'], childList: true });
    }
    const bodyObserver = new MutationObserver(() => {
      if (doc.body.dataset.workspaceV831 === 'filters' && doc.body.dataset.workspaceFilterV831 === 'chips') {
        ensureSectorBoardLoaded();
      }
    });
    bodyObserver.observe(doc.body, { attributes: true, attributeFilter: ['data-workspace-v831', 'data-workspace-filter-v831'] });

    // Also load immediately if already on chips tab
    if (doc.body.dataset.workspaceV831 === 'filters' && doc.body.dataset.workspaceFilterV831 === 'chips') {
      ensureSectorBoardLoaded();
    }
    tryRefresh();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', hookStockAnalysis, { once: true });
  else hookStockAnalysis();

  root.ShitouChipsUiV1 = Object.freeze({
    ensureSectorBoardLoaded,
    renderStockChipsCard,
    getState: () => ({ ...state }),
  });
})(globalThis);
