/* 孫悟空STOCK 9.1LX｜16:9 桌面版 ＆ 行動版自動偵測切換引擎 */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const STORAGE_KEY = 'sunwukong_viewport_mode_v90'; // 'auto' | 'mobile' | 'desktop'
  const MOBILE_WIDTH_BREAKPOINT = 820;

  let manualPref = 'auto';
  try {
    const q = new URLSearchParams(root.location?.search || '').get('view');
    if (q === 'mobile' || q === 'desktop' || q === 'auto') {
      manualPref = q;
      root.localStorage?.setItem(STORAGE_KEY, q);
    } else {
      const saved = root.localStorage?.getItem(STORAGE_KEY);
      if (saved === 'mobile' || saved === 'desktop' || saved === 'auto') manualPref = saved;
    }
  } catch (_) {}

  function detectMobileDevice() {
    const nav = root.navigator || {};
    const ua = String(nav.userAgent || '');
    const uaMobile = nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean' ? nav.userAgentData.mobile : null;
    const mobileUaRegex = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    const coarse = typeof root.matchMedia === 'function' && root.matchMedia('(pointer: coarse)').matches;
    const width = Number(root.innerWidth || doc.documentElement?.clientWidth || 1440);
    if (width <= MOBILE_WIDTH_BREAKPOINT) return true;
    if (uaMobile === true) return true;
    if (mobileUaRegex) return true;
    if (coarse && width <= 1024) return true;
    return false;
  }

  function resolveMode() {
    if (manualPref === 'mobile' || manualPref === 'desktop') return manualPref;
    return detectMobileDevice() ? 'mobile' : 'desktop';
  }

  function updateToggleButton(mode) {
    const btn = doc.getElementById('viewportModeToggleV90');
    if (!btn) return;
    const isMobile = mode === 'mobile';
    const isAuto = manualPref === 'auto';
    btn.textContent = isMobile ? '🖥️ 桌面版' : '📱 行動版';
    btn.setAttribute('aria-pressed', String(isMobile));
    btn.title = isAuto
      ? `目前為自動偵測（${isMobile ? '行動版' : '16:9 桌面版'}），點擊可手動切換`
      : `目前為手動指定（${isMobile ? '行動版' : '16:9 桌面版'}），點擊切換介面模式`;
  }

  function applyViewportMode() {
    const mode = resolveMode();
    const isMobile = mode === 'mobile';
    doc.documentElement.dataset.viewportMode = mode;
    doc.documentElement.dataset.viewportSource = manualPref === 'auto' ? 'auto' : 'manual';
    if (doc.body) {
      doc.body.classList.toggle('viewport-mobile', isMobile);
      doc.body.classList.toggle('viewport-desktop', !isMobile);
      doc.body.dataset.viewportMode = mode;
    }
    updateToggleButton(mode);
    syncMobileDockActive();
    return mode;
  }

  function setMode(nextPref) {
    if (!['auto', 'mobile', 'desktop'].includes(nextPref)) return;
    manualPref = nextPref;
    try {
      root.localStorage?.setItem(STORAGE_KEY, nextPref);
    } catch (_) {}
    applyViewportMode();
  }

  function toggleMode() {
    const current = resolveMode();
    setMode(current === 'mobile' ? 'desktop' : 'mobile');
  }

  function mountHeaderToggle() {
    const tools = doc.querySelector('.header-right-tools');
    if (!tools || doc.getElementById('viewportModeToggleV90')) return;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.id = 'viewportModeToggleV90';
    btn.className = 'kachi-viewport-toggle';
    btn.addEventListener('click', toggleMode);
    tools.prepend(btn);
    updateToggleButton(resolveMode());
  }

  function closeStrategySheet() {
    const sheet = doc.getElementById('mobileStrategySheetV90');
    const backdrop = doc.getElementById('mobileSheetBackdropV90');
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }

  function openStrategySheet() {
    const sheet = doc.getElementById('mobileStrategySheetV90');
    const backdrop = doc.getElementById('mobileSheetBackdropV90');
    if (sheet) sheet.hidden = false;
    if (backdrop) backdrop.hidden = false;
  }

  function selectTab(tab, filter) {
    closeStrategySheet();
    root.ShitouWorkspaceV831?.select?.(tab, filter);
    root.scrollTo?.({ top: 0, behavior: 'smooth' });
    syncMobileDockActive();
  }

  function syncMobileDockActive() {
    const dock = doc.getElementById('mobileBottomDockV90');
    if (!dock) return;
    const tab = doc.body?.dataset?.workspaceV831 || 'market';
    const filter = doc.body?.dataset?.workspaceFilterV831 || '';
    const isStrategyGroup = tab === 'filters' && ['momentum', 'daytrade', 'strong', 'mainforce', 'lowbase'].includes(filter);

    dock.querySelectorAll('[data-mdock]').forEach((btn) => {
      const k = btn.dataset.mdock;
      let active = false;
      if (k === 'market') active = tab === 'market';
      else if (k === 'stock') active = tab === 'stock';
      else if (k === 'chips') active = tab === 'filters' && filter === 'chips';
      else if (k === 'macdplus') active = tab === 'filters' && filter === 'macdplus';
      else if (k === 'strategies') active = isStrategyGroup;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });

    const sheet = doc.getElementById('mobileStrategySheetV90');
    if (sheet) {
      sheet.querySelectorAll('[data-msheet-filter]').forEach((btn) => {
        btn.classList.toggle('is-active', tab === 'filters' && filter === btn.dataset.msheetFilter);
      });
    }
  }

  function mountMobileDock() {
    if (!doc.body || doc.getElementById('mobileBottomDockV90')) return;

    const backdrop = doc.createElement('div');
    backdrop.id = 'mobileSheetBackdropV90';
    backdrop.className = 'mobile-sheet-backdrop';
    backdrop.hidden = true;
    backdrop.addEventListener('click', closeStrategySheet);

    const sheet = doc.createElement('div');
    sheet.id = 'mobileStrategySheetV90';
    sheet.className = 'mobile-strategy-sheet';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', '選股策略切換');
    sheet.innerHTML = `
      <div class="mobile-sheet-head">
        <span>選股策略工具</span>
        <button type="button" class="mobile-sheet-close" aria-label="關閉">✕</button>
      </div>
      <div class="mobile-sheet-grid">
        <button type="button" data-msheet-filter="momentum"><strong>🚀 主升段</strong><small>主動式主升掃描</small></button>
        <button type="button" data-msheet-filter="daytrade"><strong>⚡ 當沖標的</strong><small>明日當沖盤前適配</small></button>
        <button type="button" data-msheet-filter="strong"><strong>🔥 強勢飆股</strong><small>強勢飆股篩選</small></button>
        <button type="button" data-msheet-filter="mainforce"><strong>📐 主力生命線成本</strong><small>盤後新生 K0 與生命線研究</small></button>
        <button type="button" data-msheet-filter="lowbase"><strong>🌟 低位階帶量突破</strong><small>主升段低位階帶量突破</small></button>
        <button type="button" data-msheet-filter="macdplus"><strong>📊 MACD+</strong><small>強化 MACD+黃金交叉</small></button>
      </div>
    `;
    sheet.querySelector('.mobile-sheet-close')?.addEventListener('click', closeStrategySheet);
    sheet.querySelectorAll('[data-msheet-filter]').forEach((b) => {
      b.addEventListener('click', () => selectTab('filters', b.dataset.msheetFilter));
    });

    const dock = doc.createElement('nav');
    dock.id = 'mobileBottomDockV90';
    dock.className = 'mobile-bottom-dock';
    dock.setAttribute('aria-label', '行動版底部導覽');
    dock.innerHTML = `
      <button type="button" data-mdock="market"><i>📈</i><span>大盤</span></button>
      <button type="button" data-mdock="stock"><i>🔎</i><span>個股</span></button>
      <button type="button" data-mdock="chips"><i>💰</i><span>籌碼</span></button>
      <button type="button" data-mdock="strategies"><i>🎯</i><span>策略</span></button>
      <button type="button" data-mdock="macdplus"><i>📊</i><span>MACD+</span></button>
    `;

    dock.querySelector('[data-mdock="market"]')?.addEventListener('click', () => selectTab('market'));
    dock.querySelector('[data-mdock="stock"]')?.addEventListener('click', () => selectTab('stock'));
    dock.querySelector('[data-mdock="chips"]')?.addEventListener('click', () => selectTab('filters', 'chips'));
    dock.querySelector('[data-mdock="macdplus"]')?.addEventListener('click', () => selectTab('filters', 'macdplus'));
    dock.querySelector('[data-mdock="strategies"]')?.addEventListener('click', () => {
      if (sheet.hidden) openStrategySheet();
      else closeStrategySheet();
    });

    doc.body.append(backdrop, sheet, dock);
    syncMobileDockActive();
  }

  function boot() {
    mountHeaderToggle();
    mountMobileDock();
    applyViewportMode();

    let resizeTimer = 0;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (manualPref === 'auto') applyViewportMode();
      }, 90);
    };
    root.addEventListener('resize', onResize, { passive: true });
    root.addEventListener('orientationchange', onResize, { passive: true });

    if (doc.body) {
      new MutationObserver(syncMobileDockActive).observe(doc.body, {
        attributes: true,
        attributeFilter: ['data-workspace-v831', 'data-workspace-filter-v831'],
      });
    }
  }

  // Apply early on <html> to prevent flash before DOMContentLoaded
  doc.documentElement.dataset.viewportMode = resolveMode();
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.SunWukongViewportV90 = Object.freeze({
    detectMobileDevice,
    getMode: resolveMode,
    getPreference: () => manualPref,
    setMode,
    toggleMode,
  });
})(globalThis);
