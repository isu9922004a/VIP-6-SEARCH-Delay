(function (root) {
  'use strict';

  const C = root.ShitouEnhancedMacd;
  const by = id => document.getElementById('structure' + id);
  const element = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let controller = null;
  let last = null;

  function message(text) {
    by('Message').textContent = text;
  }

  async function request(query, signal) {
    const url = query ? new URL(typeof MARKET_API_BASE_URL === 'string' ? MARKET_API_BASE_URL :
      'https://shitou-taiwanmarket-api.d318426.workers.dev') :
      new URL('./data/enhanced-macd/latest.json', document.baseURI);
    if (query) url.search = new URLSearchParams(query);
    const requestController = new AbortController();
    const stop = () => requestController.abort();
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    const timeout = setTimeout(stop, 20000);
    try {
      const response = await fetch(url, { signal: requestController.signal, cache: 'no-store' });
      if (!response.ok) throw Error((query ? '市場資料服務' : '第六套盤後資料') + ' HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', stop);
    }
  }

  function progress(done, total, label = '') {
    const value = total ? Math.round(done / total * 100) : 0;
    by('Progress').value = value;
    message(label || `逐檔核對 ${done}／${total}（${value}%）`);
  }

  const number = (value, digits = 2) => Number.isFinite(value) ?
    value.toLocaleString('zh-TW', { maximumFractionDigits: digits }) : '資料不足';
  const percent = value => (value > 0 ? '+' : '') + number(value) + '%';
  const lots = value => number(value / 1000, 3) + ' 張';
  const metrics = row => '收盤 ' + number(row.close) + ' 元（' + percent(row.change) + '）｜排名分數 ' + number(row.score.total, 4);

  function detailLines(row) {
    const risk = row.riskFlags.length ? row.riskFlags.join('、') : '目前未觸發本套警示';
    const levels = [
      row.support === null ? null : '參考支撐 ' + number(row.support),
      row.resistance === null ? null : '參考壓力 ' + number(row.resistance)
    ].filter(Boolean);
    return [
      row.date + '｜' + metrics(row),
      '當日剛黃金交叉（' + row.axis + '）｜DIF ' + number(row.macd.dif, 6) +
        '、Signal ' + number(row.macd.signal, 6) + '、MACD 柱 ' + number(row.macd.histogram, 6),
      '成交量 ' + lots(row.volume) + '｜前 5 日均量 ' + (row.averageVolume === null ? '資料不足' : lots(row.averageVolume)) +
        (row.volumeRatio === null ? '' : '（' + number(row.volumeRatio) + ' 倍）'),
      '實收資本額 ' + number(row.capital, 0) + ' 元（' + row.companyDate + ' 出表）',
      'MA20 ' + number(row.ma20) + ' 元｜距月線 ' + percent(row.gap) + '｜近 20 日 ' + percent(row.gain20),
      '追高與假突破風險｜' + risk,
      ...(levels.length ? ['前 20 日區間｜' + levels.join(' 元／') + ' 元'] : []),
      'MACD 今天剛黃金交叉，短線動能可能開始轉強。成交量與實收資本額皆在入選範圍內。' +
        (row.riskFlags.length ? '隔日追價仍可能遇到回檔，先留意上方風險。' : '')
    ];
  }

  function list(rows, ordered = false) {
    const out = element(ordered ? 'ol' : 'ul');
    out.className = 'enhanced-macd-list';
    for (const row of rows) {
      const entry = element('li');
      const identity = row.name + '（' + row.code + '）';
      entry.append(element('strong', identity));
      for (const line of row.qualifiesA ? detailLines(row) : [row.reason]) entry.append(element('span', line));
      out.append(entry);
    }
    return out;
  }

  function render(result) {
    last = result;
    const host = by('Result');
    host.replaceChildren(element('p', '交易日 ' + result.date + '｜版本 ' + C.VERSION + '｜' + C.summary(result)));
    if (result.complete) {
      host.append(element('h3', 'Top 8 研究候選股'));
      host.append(result.top8.length ? list(result.top8, true) : element('p', '本交易日合格 0 檔。'));
    }
    if (result.qualified.length) {
      const known = element('details');
      known.append(element('summary', result.complete ? '合格清單' : '已核對的個股（全市場排名待確認）'),
        list(result.complete ? result.qualified : result.qualified.slice().sort((a, b) => a.code.localeCompare(b.code))));
      host.append(known);
    }
    if (result.errors.length || result.incomplete.length) {
      const detail = element('details');
      detail.append(element('summary', '資料不足原因'));
      for (const error of result.errors) detail.append(element('p', error));
      if (result.incomplete.length) detail.append(list(result.incomplete));
      host.append(detail);
    }
    const sources = element('details');
    sources.append(element('summary', '資料來源與日期'));
    for (const feed of result.sources) {
      const line = element('p', [feed.label, feed.date || '待核對', feed.retrievedAt].filter(Boolean).join('｜'));
      const link = element('a', '官方來源');
      link.href = feed.source;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      line.append(' ', link);
      sources.append(line);
    }
    host.append(sources);
    by('ReportPanel').hidden = false;
    by('Image').disabled = !result.complete || !result.top8.length;
    by('AllImages').disabled = !result.complete || !result.qualified.length;
  }

  function textReport(result) {
    return [
      '石頭少爺 ' + C.VERSION + '｜' + C.TITLE, result.date + '｜' + C.summary(result),
      ...C.RULES, '回測資料不足｜尚無可驗證的歷史報酬樣本。',
      'Top 8 按規則排序，供隔日到 5 個交易日研究參考。',
      ...(result.complete ? result.top8 : []).flatMap(row => [row.name + '（' + row.code + '）', ...detailLines(row)]),
      ...result.errors, ...result.incomplete.map(row => row.name + '（' + row.code + '）｜' + row.reason),
      ...result.sources.map(feed => [feed.label, feed.date, feed.source, feed.retrievedAt].filter(Boolean).join('｜'))
    ].join('\n');
  }

  async function run() {
    if (controller) return;
    controller = new AbortController();
    const { signal } = controller;
    last = null;
    by('Run').disabled = true;
    by('Run').textContent = '處理中…';
    by('Run').setAttribute('aria-busy', 'true');
    by('Stop').disabled = false;
    by('ReportPanel').hidden = true;
    by('Result').replaceChildren();
    progress(0, 0, '確認最近已完成交易日…');
    try {
      const snapshot = await request({ market: 'ALL_STOCKS' }, signal);
      if (snapshot.type !== 'MARKET_SCAN_SNAPSHOT' || snapshot.mode !== 'ALL_STOCKS' || !Array.isArray(snapshot.rows)) {
        throw Error('完整市場快照格式未驗證');
      }
      const checked = root.ShitouStrongStockFilterV47.validateMarket(snapshot.meta, snapshot.rows.length);
      if (!checked.ok) throw Error(checked.reason);
      const date = checked.date;
      // Block trades count in total volume through 17:00 Taipei time.
      const taipei = new Date(Date.now() + 8 * 3600000).toISOString();
      if (!checked.marketClosed && taipei.slice(11, 16) >= '17:00' && date !== taipei.slice(0, 10)) {
        throw Error('今日交易已結束，等待同日盤後資料');
      }
      progress(1, 2, '載入 ' + date + ' 最新盤後策略資料…');
      const data = await request(null, signal);
      if (data?.schema !== 'ENHANCED_MACD_SCAN_V2' || data.version !== C.VERSION ||
          data.date !== date || data.result?.date !== date || typeof data.result?.complete !== 'boolean' ||
          data.snapshotHash !== snapshot.meta.snapshotContentSha256 ||
          data.volumeUnit !== 'shares' || data.capitalUnit !== 'NTD' ||
          data.priceBasis !== 'UNADJUSTED_OFFICIAL_OHLC' ||
          !Array.isArray(data.sources) || !Array.isArray(data.result.errors) ||
          !Array.isArray(data.result.qualified) || !Array.isArray(data.result.incomplete) ||
          !Array.isArray(data.result.top8)) {
        throw Error('第六套資料與最新完成交易日或官方快照不一致');
      }
      if (signal.aborted) throw new DOMException('已停止', 'AbortError');
      const result = data.result;
      const sourceLabels = { quotes: '收盤成交股數', companies: '實收資本額及產業', status: '停牌狀態' };
      result.sources = data.sources.filter(feed => /^https:\/\/(?:[a-z]+\.twse\.com\.tw|www\.tpex\.org\.tw)\//.test(feed.source))
        .map(feed => ({ ...feed, label: feed.market + ' ' + sourceLabels[feed.dataset] }));
      result.sources.push({
        source: 'https://www.twse.com.tw/exchangeReport/FMTQIK', date, label: '官方交易日曆與歷史日 K 校對日期'
      });
      if (result.complete && (!Array.isArray(data.sessions) || data.sessions.length < C.WINDOW ||
          data.sessions.length > C.HISTORY_SESSIONS || data.historySources?.length !== data.sessions.length * 2 || result.errors.length ||
          result.incomplete.length || result.total < snapshot.rows.length ||
          result.sources.length !== 7 || result.qualified.some(row => row.date !== date ||
            row.qualifiesA !== true || !Number.isFinite(row.score?.total) ||
            ['cross', 'volume', 'capital'].some(key => row.gates?.[key] !== true)) ||
          JSON.stringify(result.top8) !== JSON.stringify(result.qualified.slice(0, 8)))) {
        throw Error('第六套全市場掃描或 Top 8 核對失敗');
      }
      if (!result.complete) result.top8 = [];
      render(result);
      progress(result.complete ? 2 : 1, 2, C.summary(result));
    } catch (error) {
      message(signal.aborted ? '已停止｜尚無已核對結果' :
        '資料不足／掃描未完成｜' + (error.name === 'AbortError' ? '市場資料服務逾時' : error.message));
    } finally {
      controller = null;
      by('Run').disabled = false;
      by('Run').textContent = '開始掃描';
      by('Run').removeAttribute('aria-busy');
      by('Stop').disabled = true;
    }
  }

  function stop() {
    controller?.abort();
  }

  function downloadText() {
    const blob = new Blob([textReport(last)], { type: 'text/plain;charset=utf-8' });
    const address = URL.createObjectURL(blob);
    const link = element('a');
    link.href = address;
    link.download = `強化MACD_${last.date}_${C.VERSION}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(address), 30000);
  }

  function imagePages(result, topOnly) {
    const width = 1284;
    const height = 2778;
    const rows = topOnly ? result.top8 : result.qualified;
    const pages = Math.max(1, Math.ceil(rows.length / 8));
    const subtitle = topOnly ? 'Top 8' : '合格清單';
    return Array.from({ length: pages }, (_, index) => {
      const segment = rows.slice(index * 8, (index + 1) * 8);
      const renderExportRegion = ({ top = 0, height: regionHeight = height, scale = 1 } = {}) => {
        const canvas = element('canvas');
        canvas.width = Math.max(1, Math.floor(width * scale));
        canvas.height = Math.max(1, Math.floor(regionHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, 0, -top * scale);
        ctx.fillStyle = '#eff5f6';
        ctx.fillRect(0, 0, width, height);
        const draw = (text, y, size, color, weight = 500) => {
          ctx.fillStyle = color;
          ctx.font = `${weight} ${size}px "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif`;
          ctx.fillText(text, 68, y, width - 136);
        };
        ctx.fillStyle = '#183c50';
        ctx.fillRect(0, 0, width, 380);
        draw(C.TITLE, 120, 73, '#ffffff', 700);
        draw(subtitle + '｜' + (index + 1) + '／' + pages, 205, 49, '#d6f4ef', 700);
        draw('交易日 ' + result.date + '｜版本 ' + C.VERSION, 276, 43, '#ffffff');
        draw('最新完成日剛黃金交叉｜風險與分數僅供研究', 337, 39, '#ffffff');
        draw(C.summary(result), 474, 44, '#183c50', 700);
        if (!segment.length) draw(result.complete ? '本交易日沒有合格股票' : '目前尚無可列入的已驗證股票', 588, 45, '#314e60');
        segment.forEach((row, offset) => {
          const y = 532 + offset * 249;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(45, y, width - 90, 224);
          draw((index * 8 + offset + 1) + '. ' + row.name + '（' + row.code + '）', y + 63, 55, '#19364c', 700);
          draw(metrics(row), y + 126, 43, '#164e4a', 700);
          draw('當日剛黃金交叉｜成交量 ' + lots(row.volume), y + 188, 39, '#314e60');
        });
        draw('石頭少爺 ' + C.VERSION, height - 94, 39, '#314e60', 700);
        return canvas;
      };
      return {
        width, height, renderExportRegion,
        dataset: { iphoneFullScreen: '1284x2778' },
        toBlob(callback, type = 'image/png') {
          const canvas = renderExportRegion();
          canvas.toBlob(blob => {
            canvas.width = canvas.height = 1;
            callback(blob);
          }, type);
        }
      };
    });
  }

  async function preview(topOnly) {
    const result = last;
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      if (last !== result) return;
      const heading = topOnly ? 'Top 8' : '合格清單';
      await root.strongStockShowPagesV47(imagePages(result, topOnly), {
        title: C.TITLE + '｜' + heading, prefix: '強化MACD_' + heading,
        date: result.date, kind: 'enhanced-macd', note: C.summary(result)
      });
    } catch (error) {
      message('圖片未完成｜' + error.message);
    }
  }

  function install() {
    const panel = element('section');
    panel.id = 'structurePanel';
    panel.dataset.enhancedMacdCopy = '';
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="filter-unified">
        <h2 class="section-title">${C.TITLE}</h2>
        <p class="section-subtitle">${C.SUBTITLE}</p>
        <p>回測資料不足｜尚無可驗證的歷史報酬樣本。</p>
        <details class="enhanced-macd-rules">
          <summary>入選條件與資料口徑</summary>
          <ol>${C.RULES.map(rule => '<li>' + rule + '</li>').join('')}</ol>
          <p>採交易所未還原收盤價。MACD 使用最近 100 根有效日 K，已核對的無收盤日不補價。新掛牌股至少有 50 根且自掛牌日完整核對才計算。黃金交叉仍須比較最近兩個市場交易日。除權息或拆併股可能影響訊號。</p>
          <p>排除生技醫療、金融保險、建材營造及非一般普通股商品。</p>
          <p>MA20 取最近 20 根有效日 K，並與前 5 個交易日均量一同供解讀與排名。均量資料不足時量能項目計 0 分。排名權重為 MACD 動能 35%、月線趨勢 25%、成交量增強 25%、突破與追高風險 15%。Top 8 供隔日到 5 個交易日研究參考。</p>
        </details>
        <div class="filter-actions">
          <button type="button" class="btn" id="structureRun">開始掃描</button>
          <button type="button" class="momentum-stop-btn show" id="structureStop" disabled>■ 停止</button>
        </div>
        <progress id="structureProgress" aria-label="第六套掃描進度" max="100" value="0"></progress>
        <p id="structureMessage" role="status" aria-live="polite">等待盤後查詢。</p>
      </div>
      <section id="structureReportPanel" hidden>
        <div class="filter-actions">
          <button type="button" id="structureCopy">複製文字報告</button>
          <button type="button" id="structureText">下載 TXT</button>
          <button type="button" id="structureImage">前 8 強圖片</button>
          <button type="button" id="structureAllImages">合格清單圖片</button>
        </div>
        <div id="structureResult"></div>
      </section>`;
    document.querySelector('main').append(panel);
    by('Run').onclick = run;
    by('Stop').onclick = stop;
    by('Copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(textReport(last));
        message('已複製文字報告。');
      } catch {
        message('複製未完成，請使用下載 TXT。');
      }
    };
    by('Text').onclick = downloadText;
    by('Image').onclick = () => preview(true);
    by('AllImages').onclick = () => preview(false);
  }

  root.ShitouEnhancedMacdUI = Object.freeze({ getLast: () => last, isRunning: () => !!controller });
  install();
})(globalThis);
