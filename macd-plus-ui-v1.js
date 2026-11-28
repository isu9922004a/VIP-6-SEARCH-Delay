/* 強化 MACD+ 前端掃描、渲染與純圖片報告匯出模組 */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const state = {
    running: false,
    abortRequested: false,
    lastReport: null,
  };

  const $ = (id) => doc.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const REJECT_LABELS = {
    EXCLUDED_INDUSTRY: '排除生技醫療、金融保險及建材營造',
    NON_COMMON_PRODUCT: '非一般普通股',
    PRODUCT_UNVERIFIED: '官方普通股身分未核實',
    DATA_UNAVAILABLE: '新版日 K、來源日期或價量待核實',
    FULL_DELIVERY: '全額交割 / 變更交易',
    ETF_EXCLUDED: 'ETF 商品',
    CAPITAL_UNAVAILABLE: '官方實收資本額缺漏或為 0',
    CAPITAL_OVER_LIMIT: '官方實收資本額 ≥ 50 億元',
    VOLUME_UNAVAILABLE: '成交量缺漏',
    VOLUME_OUT_OF_RANGE: '成交量不在 2,000～10,000 張',
    CALENDAR_UNAVAILABLE: '市場交易日曆未備妥',
    INSUFFICIENT_BARS: '有效日 K 數不足（標準 < 100 根或新掛牌未滿 50 根完整核對）',
    MISSING_RECENT_MARKET_SESSION: '最近兩個市場交易日缺收盤（不補價）',
    MISSING_RESEARCH_HISTORY: '官方歷史日 K 檔尚未就緒',
    MACD_UNAVAILABLE: 'MACD(12,26,9) 無法計算',
    NO_FRESH_GOLDEN_CROSS: '非最新交易日剛黃金交叉',
  };

  async function fetchJsonNoStore(relPath) {
    const res = await fetch(`${relPath}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`無法載入 ${relPath}（HTTP ${res.status}）`);
    return res.json();
  }

  function setProgress(pct, text) {
    const bar = $('macdPlusProgressBar');
    const txt = $('macdPlusProgressText');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (txt && text !== undefined) txt.textContent = text;
  }

  function showError(msg) {
    const err = $('macdPlusError');
    if (!err) return;
    if (!msg) {
      err.style.display = 'none';
      err.textContent = '';
    } else {
      err.style.display = 'block';
      err.textContent = msg;
    }
  }

  function jumpToStock(code) {
    const input = $('stockInput');
    if (input) input.value = String(code);
    root.ShitouWorkspaceV831?.select?.('stock');
    if (typeof root.analyzeStock === 'function') {
      setTimeout(() => root.analyzeStock(), 40);
    }
  }

  function buildAuditText(report) {
    if (report.published) return [
      '新版 V9.23 完整官方核驗｜行情基準日：' + report.tradeDate,
      '全市場 ' + report.totalUniverse + ' 檔｜三條件全部通過 ' + report.totalQualified + ' 檔｜正式 Top ' + report.top.length,
      'MACD(12,26,9) 最新完成日剛金叉；成交量 2,000～10,000 張；實收資本額大於0且小於50億元。',
      '排除生技醫療、金融保險、建材營造與非普通股。月線與量比供解讀及排名，不額外當入選硬門檻。',
      '官方資料日期、價格及股數口徑、最近兩個交易日、來源完整性與排名順序均已核對。',
      ...report.sources.map(x => x.market + ' ' + x.dataset + '｜' + x.date + '｜' + x.source),
      ...(report.comparison || []).map(x => (x.name || x.code) + '（' + x.code + '）｜' + (x.reasons || []).join('；'))
    ].join('\n');
    const lines = [
      `行情基準日：${report.tradeDate}（比較前一日：${report.prevTradeDate || '—'}）`,
      `全市場行情：${report.totalUniverse} 檔｜初篩（排除三產業與非普通股＋股本 < 50 億＋量 2,000～10,000 張）通過：${report.preFiltered} 檔｜實際計算 MACD：${report.deepScanned} 檔｜最終入選：${report.totalQualified} 檔`,
      '',
      '【未入選原因統計】',
    ];
    for (const [k, count] of Object.entries(report.rejectCounts || {}).sort((a, b) => b[1] - a[1])) {
      lines.push(`• ${REJECT_LABELS[k] || k}：${count} 檔`);
    }
    return lines.join('\n');
  }

  function renderResult(report) {
    const section = $('macdPlusResult');
    if (!section) return;
    section.style.display = 'block';

    const meta = $('macdPlusMeta');
    if (meta) {
      meta.textContent = `行情基準：${report.tradeDate}｜官方股本核對：${report.capitalSourceDate || report.tradeDate}｜符合 ${report.totalQualified} 檔（顯示 Top ${report.top.length}）`;
    }

    const setVal = (id, val) => {
      const el = $(id);
      if (el) el.textContent = String(val);
    };
    const statLabel = (id, label) => { const k = $(id)?.parentElement?.querySelector('.k'); if (k) k.textContent = label; };
    statLabel('macdPlusPreFilterCount', report.published ? '入選必要條件' : '股本＋量能初篩');
    statLabel('macdPlusScannedCount', report.published ? '資料核驗' : 'MACD 核對數');
    setVal('macdPlusUniverseCount', report.totalUniverse);
    setVal('macdPlusPreFilterCount', report.preFiltered);
    setVal('macdPlusScannedCount', report.deepScanned);
    setVal('macdPlusQualifiedCount', report.totalQualified);

    const audit = $('macdPlusAudit');
    if (audit) audit.textContent = buildAuditText(report);

    const listEl = $('macdPlusList');
    if (!listEl) return;

    if (!report.complete) {
      listEl.innerHTML = '<div class="macdplus-empty">掃描尚未完整核對；已核驗符合 ' + report.totalQualified + ' 檔，暫不列正式 Top 8。請展開原因統計。</div>';
      return;
    }
    if (!report.top.length) {
      listEl.innerHTML = `
        <div class="macdplus-empty">
          本交易日（${esc(report.tradeDate)}）沒有同時符合「MACD(12,26,9) 剛黃金交叉、成交量 2,000～10,000 張、官方實收資本額 < 50 億元，並排除生技醫療、金融保險、建材營造及非普通股」之普通股。<br>
          本策略維持嚴格口徑，不會為了湊足名額而放寬條件。
        </div>
      `;
      return;
    }

    listEl.innerHTML = report.top
      .map((item, idx) => {
        const gradeCls = item.grade === 'S' ? 's' : item.grade === 'A' ? 'a' : 'b';
        const pctCls = item.pct > 0 ? 'ux-up' : item.pct < 0 ? 'ux-down' : '';
        const pctText = `${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(2)}%`;
        const volSub = item.insufficientPrev5Vol
          ? '前 5 日均量不足（計 0 分）'
          : `5 日量比 ${item.volRatio5}x（均 ${item.prev5AvgLots} 張）`;
        const maBias = `${item.ma20BiasPct >= 0 ? '+' : ''}${item.ma20BiasPct}%`;
        const riskCls = item.riskLabel === '高' ? 'risk-high' : item.riskLabel === '中' ? 'risk-mid' : 'risk-low';

        return `
          <article class="momentum-card macdplus-card ${gradeCls}">
            <div class="macdplus-card-head">
              <div class="macdplus-card-title-wrap">
                <span class="macdplus-rank">#${idx + 1}</span>
                <span class="momentum-badge ${gradeCls}">${esc(item.grade)}級｜${item.totalScore} 分</span>
                <strong class="momentum-name">${esc(item.code)} ${esc(item.name)}</strong>
                <span class="macdplus-tag">${item.market === 'TPEx' ? '上櫃' : '上市'}${item.industry ? `・${esc(item.industry)}` : ''}</span>
                <span class="macdplus-tag macdplus-cap-tag">股本 ${item.paidInCapitalYi} 億</span>
              </div>
              <button type="button" class="mini-btn macdplus-jump-btn" data-macd-stock="${esc(item.code)}">🔎 查個股詳情</button>
            </div>
            <div class="macdplus-metrics-grid">
              <div class="momentum-metric">
                <div class="k">最新收盤</div>
                <div class="v">${item.close} <small class="${pctCls}">${pctText}</small></div>
              </div>
              <div class="momentum-metric">
                <div class="k">成交量（2,000～10,000 張）</div>
                <div class="v">${item.lots.toLocaleString('en-US')} 張</div>
                <div class="macdplus-sub">${esc(volSub)}</div>
              </div>
              <div class="momentum-metric">
                <div class="k">MACD (12,26,9) 剛金叉</div>
                <div class="v">OSC +${item.macd.osc}</div>
                <div class="macdplus-sub">DIF ${item.macd.dif} ／ DEA ${item.macd.dea}</div>
              </div>
              <div class="momentum-metric">
                <div class="k">月線 MA20（近 20 根）</div>
                <div class="v">${item.ma20}</div>
                <div class="macdplus-sub">乖離 ${esc(maBias)}｜追高風險：<span class="${riskCls}">${esc(item.riskLabel)}</span></div>
              </div>
            </div>
            <div class="macdplus-score-pills">
              <span>MACD 動能(35%)：<strong>${item.scores.macd}</strong></span>
              <span>月線趨勢(25%)：<strong>${item.scores.ma20}</strong></span>
              <span>成交量增強(25%)：<strong>${item.scores.volume}</strong></span>
              <span>突破與風險(15%)：<strong>${item.scores.breakoutRisk}</strong></span>
              ${item.isNewListingEligible ? '<span class="macdplus-new-pill">新掛牌完整核對（≥50根）</span>' : ''}
            </div>
            <div class="macdplus-summary">${esc(item.summary)}</div>
          </article>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-macd-stock]').forEach((btn) => {
      btn.addEventListener('click', () => jumpToStock(btn.dataset.macdStock));
    });
  }

  async function runMacdPlusScanV1() {
    if (state.running) return;
    const Engine = root.ShitouMacdPlusFilterV1;
    if (!Engine) {
      showError('強化 MACD+ 核心引擎尚未載入，請重新整理頁面。');
      return;
    }

    state.lastReport = null;
    if ($('macdPlusResult')) $('macdPlusResult').style.display = 'none';
    state.running = true;
    state.abortRequested = false;
    showError('');

    const scanBtn = $('macdPlusScanButton');
    const stopBtn = $('macdPlusStopButton');
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.setAttribute('aria-busy', 'true');
    }
    if (stopBtn) stopBtn.disabled = false;

    try {
      setProgress(4, '核對新版完整官方篩選資料…');
      const [currentSnapshot, published] = await Promise.all([
        fetchJsonNoStore('./data/market/latest.json'),
        fetchJsonNoStore('./data/enhanced-macd/latest.json').catch(() => null)
      ]);
      const r = published?.result, core = root.ShitouEnhancedMacd;
      const feeds = published?.sources || [];
      const date = currentSnapshot.tradeDateIso;
      const rowsValid = Array.isArray(r?.qualified) && r.qualified.every(x => x.date === date && x.qualifiesA === true && Number.isFinite(x.score?.total) && ['cross','volume','capital'].every(key => x.gates?.[key] === true));
      const sorted = rowsValid ? [...r.qualified].sort((a,b) => b.score.total-a.score.total || a.code.localeCompare(b.code,'en') || a.market.localeCompare(b.market,'en')) : [];
      const publishedReady = published?.schema === 'ENHANCED_MACD_SCAN_V2' && published.version === core.VERSION && published.date === date && published.snapshotHash === currentSnapshot.contentSha256 &&
        published.volumeUnit === 'shares' && published.capitalUnit === 'NTD' && published.priceBasis === 'UNADJUSTED_OFFICIAL_OHLC' &&
        Array.isArray(published.sessions) && published.sessions.length >= core.WINDOW && published.sessions.length <= core.HISTORY_SESSIONS && published.sessions.at(-1) === date &&
        published.sessions.every((day,i) => core.validDate(day) && (!i || day > published.sessions[i-1])) && published.historySources?.length === published.sessions.length*2 &&
        feeds.length === 6 && new Set(feeds.map(x => x.market+':'+x.dataset)).size === 6 && feeds.every(x => ['TWSE','TPEX'].includes(x.market) && ['quotes','companies','status'].includes(x.dataset) && x.date === date && x.source.startsWith('https://') && (new URL(x.source).hostname.endsWith('.twse.com.tw') || new URL(x.source).hostname === 'www.tpex.org.tw')) &&
        r?.date === date && r.complete === true && r.errors?.length === 0 && r.incomplete?.length === 0 && r.total >= currentSnapshot.rows.length && rowsValid && new Set(r.qualified.map(x => x.code)).size === r.qualified.length && JSON.stringify(sorted) === JSON.stringify(r.qualified) && JSON.stringify(r.top8) === JSON.stringify(r.qualified.slice(0,8));
      if (publishedReady && !state.abortRequested) {
        const industries = new Map(currentSnapshot.rows.map(x => [x.code,x.industryName || x.industry || '']));
        const all = r.qualified.map(x => Engine.convertEnhancedCandidate(x,industries.get(x.code),published.sessions.at(-2)));
        const report = {schema:Engine.SCHEMA,complete:true,published:true,tradeDate:date,prevTradeDate:published.sessions.at(-2),capitalSourceDate:date,totalUniverse:r.total,preFiltered:'3 項',deepScanned:'完整',totalQualified:all.length,rejectCounts:{},top:all.slice(0,8),all,sources:feeds,comparison:r.comparison};
        state.lastReport=report;renderResult(report);setProgress(100,'新版完整核驗完成｜全市場 '+r.total+' 檔｜符合 '+all.length+' 檔｜顯示 Top '+report.top.length);return;
      }
      setProgress(8, '正在載入最新盤後行情、官方實收資本額與交易日曆…');
      const [latest, excl, capitalDoc, calendarDoc, manifest, liquidityDoc] = await Promise.all([
        fetchJsonNoStore('./data/market/latest.json'),
        fetchJsonNoStore('./data/market/scan-exclusions.json'),
        fetchJsonNoStore('./data/market/company-capital.json'),
        fetchJsonNoStore('./data/market/research-calendar.json'),
        fetchJsonNoStore('./data/research/manifest.json'),
        fetchJsonNoStore('./lifeline-liquidity-v97.json'),
      ]);

      const tradeDate = latest?.tradeDateIso;
      if (!tradeDate || manifest?.date !== tradeDate || manifest?.snapshotContentSha256 !== latest.contentSha256 || calendarDoc?.verified !== true || calendarDoc?.sourceSnapshotHash !== latest.contentSha256 || liquidityDoc?.verified !== true || liquidityDoc?.date !== tradeDate || liquidityDoc?.snapshotContentSha256 !== latest.contentSha256) {
        throw new Error(`行情日期（${tradeDate || '—'}）與官方日 K 檔案日期（${manifest?.date || '—'}）尚未一致，已停止計算。`);
      }

      const marketCalendarDates = Array.isArray(calendarDoc?.dates) ? calendarDoc.dates : [];
      if (marketCalendarDates.length < 2 || marketCalendarDates.at(-1) !== tradeDate) {
        throw new Error('官方交易日曆與最新完成交易日尚未對齊，已停止計算。');
      }

      const fullSet = new Set([...(excl?.twseCodes || []), ...(excl?.tpexCodes || [])]);
      const specSet = new Set([...(excl?.specialCodes || [])]);
      const rows = Array.isArray(latest?.rows) ? latest.rows : [];
      const rejectCounts = {};
      const prePassed = [];

      for (const q of rows) {
        const code = String(q.code || '').trim();
        const security = liquidityDoc.records?.[code]?.security;
        const securityReady = security?.code === code && security?.market === q.market && security?.asOf >= tradeDate && liquidityDoc.securitySources?.some(src => src.market === q.market && src.asOf === security.asOf && /^[a-f0-9]{64}$/.test(src.sha256));
        const enriched = {
          ...q,
          securityProduct: securityReady ? security.type : null,
          fullDelivery: fullSet.has(code),
          isSpecialProduct: q.isSpecialProduct === true || specSet.has(code),
        };
        const originalCap = capitalDoc?.companies?.[code];
        const capEntry = originalCap ? { ...originalCap, companyDate: capitalDoc.sourceDates?.[q.market === 'TPEX' ? 'tpex' : 'twse'] } : null;
        const pre = Engine.checkCapitalAndVolumePreFilter(enriched, capEntry);
        if (!pre.pass) {
          rejectCounts[pre.reason] = (rejectCounts[pre.reason] || 0) + 1;
          continue;
        }
        const entry = manifest?.stocks?.[code];
        if (!entry?.ready || !entry?.path) {
          rejectCounts.MISSING_RESEARCH_HISTORY = (rejectCounts.MISSING_RESEARCH_HISTORY || 0) + 1;
          continue;
        }
        prePassed.push({ code, quote: enriched, capital: capEntry, path: entry.path });
      }

      setProgress(22, `初篩通過 ${prePassed.length} 檔（股本 < 50 億且量 2,000～10,000 張），正在逐檔核對 MACD(12,26,9) 黃金交叉…`);

      const qualified = [];
      let done = 0;
      const BATCH = 18;
      for (let i = 0; i < prePassed.length; i += BATCH) {
        if (state.abortRequested) break;
        const slice = prePassed.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          slice.map(async (item) => {
            try {
              const response = await fetch(`./data/research/${item.path}?revision=${manifest.stocks[item.code].sha256}`, { cache: 'no-store' });
              if (!response.ok) throw Error('歷史檔未取得');
              const sourceText = await response.text();
              if (await root.ShitouOfficialResearchHistory.digest(sourceText) !== manifest.stocks[item.code].sha256) throw Error('歷史檔指紋不符');
              const src = JSON.parse(sourceText);
              root.ShitouOfficialResearchHistory.inspectReport(src, manifest, item.code);
              return Engine.evaluateMacdPlus({
                quote: item.quote,
                capital: item.capital,
                dailySeries: src?.dailySeries || [],
                historyGaps: src?.historyGaps || [],
                marketCalendarDates,
              });
            } catch {
              return { eligible: false, rejectReason: 'MISSING_RESEARCH_HISTORY' };
            }
          })
        );
        for (const res of batchResults) {
          if (res.eligible) qualified.push(res);
          else rejectCounts[res.rejectReason] = (rejectCounts[res.rejectReason] || 0) + 1;
        }
        done += slice.length;
        const pct = 22 + Math.round((done / Math.max(1, prePassed.length)) * 76);
        setProgress(pct, `已核對 ${done} / ${prePassed.length} 檔（目前符合 MACD 剛金叉：${qualified.length} 檔）…`);
      }

      const ranked = Engine.rankMacdPlusCandidates(qualified, 8);
      const incomplete = state.abortRequested || ['PRODUCT_UNVERIFIED','DATA_UNAVAILABLE','CAPITAL_UNAVAILABLE','VOLUME_UNAVAILABLE','MISSING_RESEARCH_HISTORY'].some(key => (rejectCounts[key] || 0) > 0);
      const report = {
        complete: !incomplete,
        schema: Engine.SCHEMA,
        tradeDate,
        prevTradeDate: marketCalendarDates[marketCalendarDates.length - 2],
        capitalSourceDate: capitalDoc?.sourceDates?.twse || capitalDoc?.sourceDates?.tpex || tradeDate,
        totalUniverse: rows.length,
        preFiltered: prePassed.length,
        deepScanned: done,
        totalQualified: ranked.all.length,
        aborted: state.abortRequested,
        rejectCounts,
        top: incomplete ? [] : ranked.top,
        all: ranked.all,
      };
      state.lastReport = report;
      renderResult(report);
      setProgress(
        100,
        incomplete
          ? `掃描未完整：已核對 ${done}/${prePassed.length} 檔，符合 ${ranked.all.length} 檔。`
          : `掃描完成｜全市場 ${rows.length} 檔 → 初篩 ${prePassed.length} 檔 → 符合 MACD 剛金叉 ${ranked.all.length} 檔（顯示 Top ${ranked.top.length}）。`
      );
    } catch (err) {
      showError(`強化 MACD+ 掃描失敗：${err?.message || err}`);
      setProgress(0, '掃描中斷，請確認資料狀態後重試。');
    } finally {
      state.running = false;
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.removeAttribute('aria-busy');
      }
      if (stopBtn) stopBtn.disabled = true;
    }
  }

  function stopMacdPlusScanV1() {
    if (state.running) state.abortRequested = true;
  }

  async function showMacdPlusImageV1() {
    const Engine = root.ShitouMacdPlusFilterV1;
    if (!state.lastReport || !Engine) {
      const msg = $('macdPlusMessage');
      if (msg) msg.textContent = '請先執行「強化 MACD+ 掃描」，再產生 Top 8 圖片報告。';
      return;
    }
    if (!state.lastReport.complete) { $('macdPlusMessage').textContent = '掃描尚未完整核對，暫不產生正式 Top 8 圖片。'; return; }
    const canvas = Engine.renderMacdPlusInfographicCanvas(state.lastReport);
    if (!canvas) return;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const modal = $('imagePreviewModal');
    const img = $('imagePreviewImg');
    const title = $('imagePreviewTitle');
    const dl = $('imageDownloadLink');
    if (title) title.textContent = `📊 強化 MACD+｜Top 8 圖片報告（${state.lastReport.tradeDate}）`;
    if (dl) {
      dl.href = url;
      dl.download = `強化MACD+_${state.lastReport.tradeDate}_Top8.png`;
    }
    if (img) {
      img.onload = () => {};
      img.src = url;
    }
    if (modal) {
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      doc.body.style.overflow = 'hidden';
    }
  }

  async function copyMacdPlusTextV1() {
    const msg = $('macdPlusMessage');
    if (!state.lastReport) {
      if (msg) msg.textContent = '請先執行「強化 MACD+ 掃描」。';
      return;
    }
    const r = state.lastReport;
    if (!r.complete) { if (msg) msg.textContent = '掃描尚未完整核對，暫不匯出正式 Top 8；已核驗符合 ' + r.totalQualified + ' 檔。'; return; }
    const lines = [
      `📊 強化 MACD+｜Top ${r.top.length} 候選（行情基準 ${r.tradeDate}）`,
      `口徑：MACD(12,26,9) 剛金叉｜量 2,000～10,000 張｜官方股本 < 50 億｜共符合 ${r.totalQualified} 檔`,
      '',
    ];
    if (!r.top.length) {
      lines.push('本交易日無符合全部嚴格條件之標的。');
    } else {
      r.top.forEach((x, idx) => {
        const volStr = x.insufficientPrev5Vol ? `${x.lots}張(前5日均量不足)` : `${x.lots}張(${x.volRatio5}x)`;
        lines.push(
          `${idx + 1}. ${x.code} ${x.name}｜${x.grade}級 ${x.totalScore}分｜收 ${x.close}（${x.pct >= 0 ? '+' : ''}${x.pct}%）｜量 ${volStr}｜股本 ${x.paidInCapitalYi}億｜MA20 ${x.ma20}（${x.ma20BiasPct >= 0 ? '+' : ''}${x.ma20BiasPct}%）`
        );
      });
    }
    lines.push('', '⚠️ 回測資料不足｜尚無可驗證的歷史報酬樣本。除權息或拆併股可能影響訊號，僅供隔日到 5 個交易日研究參考。');
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      if (msg) msg.textContent = '✅ 已複製強化 MACD+ 文字報告到剪貼簿。';
    } catch {
      if (msg) msg.textContent = '無法自動寫入剪貼簿，請改用圖片報告。';
    }
  }

  root.runMacdPlusScanV1 = runMacdPlusScanV1;
  root.stopMacdPlusScanV1 = stopMacdPlusScanV1;
  root.showMacdPlusImageV1 = showMacdPlusImageV1;
  root.copyMacdPlusTextV1 = copyMacdPlusTextV1;
  root.ShitouMacdPlusUiV1 = Object.freeze({
    run: runMacdPlusScanV1,
    stop: stopMacdPlusScanV1,
    showImage: showMacdPlusImageV1,
    copyText: copyMacdPlusTextV1,
    getLastReport: () => state.lastReport,
  });
})(globalThis);
