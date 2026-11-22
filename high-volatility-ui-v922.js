(function (root) {
  'use strict';

  const C = root.ShitouHighVolatility;
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
    const url = new URL(typeof MARKET_API_BASE_URL === 'string' ? MARKET_API_BASE_URL :
      'https://shitou-taiwanmarket-api.d318426.workers.dev');
    url.search = new URLSearchParams(query);
    const requestController = new AbortController();
    const stop = () => requestController.abort();
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    const timeout = setTimeout(stop, 20000);
    try {
      const response = await fetch(url, { signal: requestController.signal, cache: 'no-store' });
      if (!response.ok) throw Error('市場資料服務 HTTP ' + response.status);
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

  function list(rows, ordered = false) {
    const out = element(ordered ? 'ol' : 'ul');
    out.className = 'high-volatility-list';
    for (const row of rows) {
      const entry = element('li');
      entry.append(element('strong', row.code + ' ' + row.name),
        element('span', C.metrics(row)),
        element('span', row.date + '｜' + C.STATUS[row.status] + (row.reason ? '｜' + row.reason : '')));
      out.append(entry);
    }
    return out;
  }

  function render(result) {
    last = result;
    const host = by('Result');
    host.replaceChildren(
      element('p', '交易日 ' + result.date + '｜版本 ' + C.VERSION + '｜' + C.summary(result)),
      element('h3', 'Top 8')
    );
    if (result.top8.length) host.append(list(result.top8, true));
    else host.append(element('p', result.complete ? '本交易日沒有符合兩項門檻的股票。' : '目前尚無可列入 Top 8 的已驗證股票。'));
    host.append(element('h3', '合格清單'));
    host.append(result.qualified.length ? list(result.qualified) :
      element('p', result.complete ? '本交易日合格 0 檔。' : '合格清單待資料核對。'));
    if (result.unverified.length) {
      const detail = element('details');
      detail.append(element('summary', `資料未驗證 ${result.unverified.length} 檔（展開明細）`));
      detail.addEventListener('toggle', () => {
        if (detail.open && !detail.querySelector('ul')) detail.append(list(result.unverified));
      });
      host.append(detail);
    }
    const sources = element('details');
    sources.append(element('summary', '資料來源與日期'));
    for (const feed of result.sources) {
      const line = element('p', [feed.label, feed.date || '未驗證', feed.error].filter(Boolean).join('｜'));
      if (feed.source) {
        const link = element('a', '官方報表／資料來源');
        link.href = feed.source;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        line.append(' ', link);
      }
      sources.append(line);
    }
    host.append(sources);
    by('ReportPanel').hidden = false;
  }

  async function run() {
    if (controller) return;
    controller = new AbortController();
    const { signal } = controller;
    last = null;
    by('Run').disabled = true;
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
      const stocks = snapshot.rows.map(row => ({ ...row, quoteDate: root.ShitouScanPolicy5328.date(row.quoteDate) }));
      message('核對 ' + date + ' 官方成交股數、融資融券與流通在外普通股數…');
      const inputs = await request({ market: 'HIGH_VOLATILITY_INPUTS', date }, signal);
      const result = await C.scan(stocks, snapshot.meta, inputs, date, { signal, onProgress: progress });
      render(result);
      message((result.stopped ? '已停止｜' : '掃描完成｜') + C.summary(result));
    } catch (error) {
      message(signal.aborted ? '已停止｜尚無已核對結果' :
        '資料未驗證｜' + (error.name === 'AbortError' ? '市場資料服務逾時' : error.message));
    } finally {
      controller = null;
      by('Run').disabled = false;
      by('Stop').disabled = true;
    }
  }

  function stop() {
    controller?.abort();
  }

  function downloadText() {
    const blob = new Blob([C.textReport(last)], { type: 'text/plain;charset=utf-8' });
    const address = URL.createObjectURL(blob);
    const link = element('a');
    link.href = address;
    link.download = `高波動超夯選股_${last.date}_${C.VERSION}.txt`;
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
        draw('券資比與單日週轉率均須 > 30%', 337, 39, '#ffffff');
        draw(C.summary(result), 474, 44, '#183c50', 700);
        if (!segment.length) draw(result.complete ? '本交易日沒有合格股票' : '目前尚無可列入的已驗證股票', 588, 45, '#314e60');
        segment.forEach((row, offset) => {
          const y = 532 + offset * 249;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(45, y, width - 90, 224);
          draw((index * 8 + offset + 1) + '. ' + row.code + ' ' + row.name, y + 63, 55, '#19364c', 700);
          draw(C.metrics(row), y + 126, 43, '#164e4a', 700);
          draw(row.date + '｜' + C.STATUS[row.status], y + 188, 39, '#314e60');
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
        title: C.TITLE + '｜' + heading, prefix: '高波動超夯選股_' + heading,
        date: result.date, kind: 'high-volatility', note: C.summary(result)
      });
    } catch (error) {
      message('圖片未完成｜' + error.message);
    }
  }

  function install() {
    const panel = element('section');
    panel.id = 'structurePanel';
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="filter-unified">
        <h2 class="section-title">${C.TITLE}</h2>
        <p class="section-subtitle">最近已完成交易日的券資比與單日週轉率均須大於 30%。</p>
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
        await navigator.clipboard.writeText(C.textReport(last));
        message('已複製文字報告。');
      } catch {
        message('複製未完成，請使用下載 TXT。');
      }
    };
    by('Text').onclick = downloadText;
    by('Image').onclick = () => preview(true);
    by('AllImages').onclick = () => preview(false);
  }

  root.ShitouHighVolatilityUI = Object.freeze({ getLast: () => last, isRunning: () => !!controller });
  install();
})(globalThis);
