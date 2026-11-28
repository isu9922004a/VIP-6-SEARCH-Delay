/* UX Enhancement Layer V1:
 * 1. Market Regime Banner (大盤位階區塊)
 * 2. Consolidated Export / Share Hub (declutters duplicate export buttons while preserving DOM)
 */
(function (root) {
  'use strict';
  if (typeof document === 'undefined' || !root.ShitouStrategyEnhanceV1) return;

  const S = root.ShitouStrategyEnhanceV1;
  const state = {
    marketDoc: null,
    taiexDoc: null,
    regime: null,
  };

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function formatPct(p) {
    if (!Number.isFinite(p)) return '—';
    const sign = p > 0 ? '+' : '';
    return `${sign}${p.toFixed(2)}%`;
  }

  function pctClass(p) {
    if (!Number.isFinite(p)) return '';
    return p > 0 ? 'ux-up' : p < 0 ? 'ux-down' : '';
  }

  function buildRegimeCard() {
    const main = document.querySelector('main.container');
    if (!main || document.getElementById('uxCommandBar')) return;

    const shell = document.createElement('section');
    shell.id = 'uxCommandBar';
    shell.className = 'ux-shell ux-kpi-shell';
    shell.setAttribute('aria-label', '大盤位階總覽');
    shell.innerHTML = `
      <div class="kachi-section-bar"><span>數據指標</span><i></i></div>
      <div class="ux-kpi-grid" id="uxRegimeBar">
        <div class="ux-kpi-card ux-kpi-regime neutral" id="uxKpiRegimeCard">
          <div class="ux-kpi-label">大盤位階</div>
          <div class="ux-kpi-value" id="uxRegimeBadge">⏳ 讀取中...</div>
          <div class="ux-kpi-sub" id="uxRegimeMedian">市場中位數 —</div>
        </div>
        <div class="ux-kpi-card ux-kpi-index" id="uxKpiIndexCard">
          <div class="ux-kpi-label">加權指數</div>
          <div class="ux-kpi-value" id="uxKpiTaiex">—</div>
          <div class="ux-kpi-sub" id="uxKpiDate">行情基準 —</div>
        </div>
        <div class="ux-kpi-card ux-kpi-breadth" id="uxKpiBreadthCard">
          <div class="ux-kpi-label">上漲 / 下跌家數</div>
          <div class="ux-breadth-track" aria-hidden="true">
            <span class="ux-breadth-up" id="uxBreadthUpBar" style="width:50%"></span>
            <span class="ux-breadth-down" id="uxBreadthDownBar" style="width:50%"></span>
          </div>
          <div class="ux-breadth-meta" id="uxRegimeStats">
            <span>廣度 —</span>
            <span>— / —</span>
          </div>
        </div>
        <div class="ux-kpi-card ux-kpi-guide" id="uxKpiGuideCard">
          <div class="ux-kpi-label">盤後操作定位</div>
          <p class="ux-kpi-guide-text" id="uxRegimeHint">正在核對最新盤後行情與市場廣度…</p>
        </div>
      </div>
    `;

    main.insertBefore(shell, main.firstChild);
  }

  function renderRegimeBanner() {
    const r = state.regime;
    if (!r) return;
    const regimeCard = document.getElementById('uxKpiRegimeCard');
    const badge = document.getElementById('uxRegimeBadge');
    const medianEl = document.getElementById('uxRegimeMedian');
    const taiexEl = document.getElementById('uxKpiTaiex');
    const dateEl = document.getElementById('uxKpiDate');
    const upBar = document.getElementById('uxBreadthUpBar');
    const downBar = document.getElementById('uxBreadthDownBar');
    const stats = document.getElementById('uxRegimeStats');
    const hint = document.getElementById('uxRegimeHint');
    if (!badge || !stats || !hint) return;

    const tone = r.tone === 'bull' ? 'bull' : r.tone === 'bear' ? 'bear' : 'neutral';
    if (regimeCard) regimeCard.className = `ux-kpi-card ux-kpi-regime ${tone}`;
    badge.textContent = r.label || '判讀中';
    if (medianEl) {
      medianEl.innerHTML = `中位數 <strong class="${pctClass(r.medianPct)}">${formatPct(r.medianPct)}</strong>`;
    }
    if (taiexEl) {
      taiexEl.textContent = r.taiexClose ? r.taiexClose.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    }
    if (dateEl) {
      dateEl.textContent = `行情日期 ${r.taiexDate || r.snapshotDate || '—'}`;
    }
    const adv = Number(r.advancers) || 0;
    const dec = Number(r.decliners) || 0;
    const total = adv + dec;
    const upPct = total > 0 ? Math.max(4, Math.min(96, Math.round((adv / total) * 100))) : 50;
    if (upBar) upBar.style.width = `${upPct}%`;
    if (downBar) downBar.style.width = `${100 - upPct}%`;
    const breadthPct = r.breadthRatio !== null ? `${(r.breadthRatio * 100).toFixed(0)}%` : '—';
    stats.innerHTML = `
      <span class="ux-breadth-ratio">廣度 <strong>${breadthPct}</strong></span>
      <span class="ux-breadth-counts"><strong class="ux-up">${adv}</strong> / <strong class="ux-down">${dec}</strong></span>
    `;
    hint.textContent = r.positionHint || '盤後資料僅供研究與決策參考。';
  }

  function consolidateExportGroups() {
    const targets = [
      { selector: '.momentum-image-actions', title: '主升掃描報告匯出 / 分享' },
      { selector: '.daytrade-image-actions', title: '當沖盤前報告匯出 / 分享' },
      { selector: '.strong-stock-image-actions', title: '強勢飆股報告匯出 / 分享' },
      { selector: '.market-copy-actions', title: '大盤戰報與分析圖匯出 / 分享' },
    ];
    for (const t of targets) {
      const container = document.querySelector(t.selector);
      if (!container || container.dataset.uxHubWrapped === '1') continue;
      container.dataset.uxHubWrapped = '1';

      const buttons = [...container.querySelectorAll('button')];
      if (buttons.length < 3) continue;

      const hub = document.createElement('div');
      hub.className = 'ux-export-hub';

      const findBtn = (rx, wantWatermark) =>
        buttons.find((b) => rx.test(b.textContent || '') && (/浮水印/.test(b.textContent || '') === !!wantWatermark));

      hub.innerHTML = `
        <div class="ux-export-hub-bar">
          <span class="ux-export-hub-title">📤 ${esc(t.title)}（已收斂 ${buttons.length} 項匯出）</span>
          <div class="ux-export-hub-controls">
            <label style="font-size:12px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" class="ux-wm-toggle" /> 防盜浮水印
            </label>
            <button type="button" class="ux-btn ux-quick-text">📋 複製文字</button>
            <button type="button" class="ux-btn ux-quick-img">🖼️ 生成圖片</button>
            <button type="button" class="ux-btn ux-toggle-all">展開全部選項 ▾</button>
          </div>
        </div>
        <div class="ux-export-drawer ux-collapsed"></div>
      `;

      const drawer = hub.querySelector('.ux-export-drawer');
      container.parentNode.insertBefore(hub, container);
      drawer.appendChild(container);

      const wmToggle = hub.querySelector('.ux-wm-toggle');
      hub.querySelector('.ux-quick-text').addEventListener('click', () => {
        const b = buttons.find((x) => /複製/.test(x.textContent || '') && !/圖片/.test(x.textContent || '')) || buttons[0];
        b?.click();
      });
      hub.querySelector('.ux-quick-img').addEventListener('click', () => {
        const wm = wmToggle.checked;
        const b = findBtn(/圖片|分析圖/, wm) || findBtn(/圖片|分析圖/, !wm) || buttons[0];
        b?.click();
      });
      hub.querySelector('.ux-toggle-all').addEventListener('click', (e) => {
        const collapsed = drawer.classList.toggle('ux-collapsed');
        e.currentTarget.textContent = collapsed ? '展開全部選項 ▾' : '收合詳細按鈕 ▴';
      });
    }
  }

  async function initData() {
    try {
      const [mktRes, taiexRes] = await Promise.all([
        fetch('./data/market/latest.json?v=' + Date.now(), { cache: 'no-store' }),
        fetch('./data/index/TAIEX.json?v=' + Date.now(), { cache: 'no-store' }).catch(() => null),
      ]);
      if (mktRes && mktRes.ok) state.marketDoc = await mktRes.json();
      if (taiexRes && taiexRes.ok) state.taiexDoc = await taiexRes.json();
      state.regime = S.evaluateMarketRegime(state.taiexDoc, state.marketDoc);
      renderRegimeBanner();
    } catch (_) {
      const badge = document.getElementById('uxRegimeBadge');
      if (badge) badge.textContent = '⚠️ 行情快照載入中（可直接使用下方查詢）';
    }
  }

  function boot() {
    buildRegimeCard();
    consolidateExportGroups();
    initData();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis);
