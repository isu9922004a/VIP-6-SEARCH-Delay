/* Prepare image files before the native share gesture. */
(function(root) {
'use strict';

const MAX_WIDTH = 1284;
const MAX_HEIGHT = 4096;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_SINGLE_HEIGHT = 12288;
const FALLBACK = '此瀏覽器不支援直接分享圖片，請使用 Safari 開啟，或儲存圖片後從 LINE 傳送。';
const by = id => document.getElementById(id);
const leasedUrls = new Map();
let state = null;
let revision = 0;
let sharing = false;
let preparing = false;
let pngPending = false;
let failure = '';
let previewUrl = null;
let pngUrl = null;
let previousFocus = null;
let previousOverflow = '';
let returnFocus = false;
let keyboardBound = false;

function note(message) {
  const status = by('lineShareStatus');
  if (status) status.textContent = message;
}

function release(url) {
  if (!url) return;
  if (leasedUrls.has(url)) leasedUrls.set(url, true);
  else URL.revokeObjectURL(url);
}

function protectDownload(event) {
  const url = event.currentTarget.href;
  if (!url?.startsWith('blob:') || leasedUrls.has(url)) return;
  leasedUrls.set(url, false);
  setTimeout(() => {
    const pendingRelease = leasedUrls.get(url);
    leasedUrls.delete(url);
    if (pendingRelease) URL.revokeObjectURL(url);
  }, 30000);
}

function mount() {
  let modal = by('imagePreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'imagePreviewModal';
    modal.className = 'image-modal market-life-preview';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-labelledby', 'imagePreviewTitle');
    modal.innerHTML = '<div class="image-modal-card"><header class="image-modal-head"><strong id="imagePreviewTitle" class="image-modal-title"></strong><button class="image-modal-close" id="marketLifeClose" type="button">✕ 關閉</button></header><div class="image-preview-wrap" tabindex="0" aria-label="圖片報告內容"><img id="imagePreviewImg" alt="分析圖預覽"><p id="imagePreviewNote" class="image-preview-note" role="status"></p></div><footer class="image-modal-footer"><div class="image-modal-actions"><a id="imageDownloadLink" class="image-save-link" download>💾 儲存 PNG</a><button id="imageShareButton" class="image-share-btn" type="button">📤 分享到 LINE</button></div></footer></div>';
    document.body.append(modal);
    by('marketLifeClose').addEventListener('click', close);
    by('imageShareButton').addEventListener('click', shareCurrent);
  }
  if (modal.dataset.previewBound) return modal;
  modal.dataset.previewBound = 'true';
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  bindKeyboard();
  by('imageDownloadLink').addEventListener('click', protectDownload);
  controls();
  return modal;
}

function bindKeyboard() {
  if (keyboardBound) return;
  keyboardBound = true;
  document.addEventListener('keydown', event => {
    const modal = by('imagePreviewModal');
    if (!modal?.classList.contains('show') || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const items = [...modal.querySelectorAll('button:not(:disabled), a[href], summary, [tabindex="0"]')]
        .filter(item => item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
}

function controls() {
  if (by('lineSharePanel')) return;
  const footer = document.querySelector('#imagePreviewModal .image-modal-footer');
  if (!footer) return;
  footer.insertAdjacentHTML('beforeend', '<div id="lineSharePanel" hidden><button type="button" id="lineSharePrev">上一段</button><button type="button" id="lineShareNext">下一段</button><a id="lineShareSave" download>儲存 JPG</a></div><p id="lineShareStatus" role="status" aria-live="polite"></p>');
  by('imagePreviewNote').insertAdjacentHTML('afterend', '<details id="lineSharePreview" hidden><summary>預覽分享用 JPG／長按儲存</summary><img id="lineShareImg" alt="目前待分享的圖片"></details>');
  by('lineSharePrev').onclick = () => select(state.index - 1);
  by('lineShareNext').onclick = () => select(state.index + 1);
  by('lineShareSave').addEventListener('click', protectDownload);
  by('imageShareButton').setAttribute('aria-describedby', 'lineShareStatus');
}

function updateButton() {
  const button = by('imageShareButton');
  if (!button) return;
  button.disabled = preparing || pngPending || sharing;
  button.textContent = state?.files.length > 1
    ? `📤 分享到 LINE（${state.index + 1}/${state.files.length} 段）`
    : '📤 分享到 LINE';
  if (state) {
    by('lineSharePrev').disabled = sharing || state.index === 0;
    by('lineShareNext').disabled = sharing || state.index === state.files.length - 1;
  }
}

function clear() {
  revision++;
  state = null;
  preparing = true;
  failure = '';
  release(previewUrl);
  previewUrl = null;
  if (by('lineSharePanel')) {
    by('lineSharePanel').hidden = true;
    const details = by('lineSharePreview');
    if (details) {
      details.hidden = true;
      details.open = false;
    }
    by('lineShareImg').removeAttribute('src');
    by('lineShareSave').removeAttribute('href');
  }
  updateButton();
  note('圖片分享準備中…');
}

function capability(file) {
  if (root.isSecureContext === false || typeof navigator.share !== 'function' ||
      typeof navigator.canShare !== 'function' || typeof root.File !== 'function') return 'UNAVAILABLE';
  try {
    return file instanceof root.File && file.size > 0 && ['image/png','image/jpeg'].includes(file.type) &&
      navigator.canShare({files: [file]}) ? 'READY' : 'FILE_REJECTED';
  } catch {
    return 'UNAVAILABLE';
  }
}

function select(index) {
  if (!state || pngPending || sharing) return;
  state.index = Math.max(0, Math.min(index, state.files.length - 1));
  renderSelection();
}

function renderSelection() {
  by('lineSharePanel').hidden = false;
  const {files, names, index} = state;
  const file = files[index], segmented = files.length > 1;
  release(previewUrl);
  previewUrl = URL.createObjectURL(file);
  by('lineShareImg').src = previewUrl;
  by('lineShareImg').alt = segmented ? `目前待分享的圖片第 ${index + 1} 段` : '目前待分享的完整圖片';
  const save = by('lineShareSave');
  save.href = previewUrl;
  save.download = names[index];
  save.textContent = segmented ? '儲存本段 JPG' : '儲存 JPG';
  by('lineSharePrev').hidden = by('lineShareNext').hidden = !segmented;
  const details = by('lineSharePreview');
  if (details) details.hidden = false;
  updateButton();
  note(capability(file) === 'READY'
    ? '開啟系統分享選單後選 LINE。'
    : FALLBACK);
}

function encode(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.size && blob.type === mime) resolve(blob);
      else reject(new Error(mime === 'image/png' ? 'PNG 編碼失敗' : 'JPG 編碼失敗'));
    }, mime, quality);
  });
}

function renderTile(canvas, top, height, scale) {
  if (top === 0 && height === canvas.height && scale === 1 && typeof canvas.getContext === 'function') return canvas;
  if (typeof canvas.renderExportRegion === 'function') return canvas.renderExportRegion({top, height, scale});
  const tile = document.createElement('canvas');
  tile.width = Math.max(1, Math.floor(canvas.width * scale));
  tile.height = Math.max(1, Math.floor(height * scale));
  const ctx = tile.getContext('2d');
  if (!ctx) throw new Error('無法建立分享圖片');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tile.width, tile.height);
  ctx.drawImage(canvas, 0, top, canvas.width, height, 0, 0, tile.width, tile.height);
  return tile;
}

async function prepare(canvas, {filename = 'report.png'} = {}) {
  clear();
  controls();
  const token = revision;
  try {
    if (!(canvas.width > 0 && canvas.height > 0)) throw new Error('圖片尺寸無效');
    const single = canvas.dataset?.shareAsSingleImage === 'true';
    const scale = Math.min(1, MAX_WIDTH / canvas.width);
    if (single && Math.ceil(canvas.height * scale) > MAX_SINGLE_HEIGHT) {
      throw new Error('完整圖片超過分享用 JPG 的高度上限');
    }
    const span = single ? canvas.height : Math.max(1, Math.floor(MAX_HEIGHT / scale));
    const count = Math.ceil(canvas.height / span);
    const files = [], names = [];
    const base = String(filename).replace(/\.png$/i, '');
    for (let top = 0; top < canvas.height; top += span) {
      if (token !== revision) return null;
      const tile = renderTile(canvas, top, Math.min(span, canvas.height - top), scale);
      let blob;
      try {
        for (const quality of [.92, .82, .7, .6, .5]) {
          blob = await encode(tile, 'image/jpeg', quality);
          if (token !== revision) return null;
          if (blob.size <= MAX_BYTES) break;
        }
      } finally {
        if (tile !== canvas) tile.width = tile.height = 1;
      }
      if (blob.size > MAX_BYTES) throw new Error('圖片超過分享用 JPG 的大小上限');
      const name = base + (count > 1 ? `_${files.length + 1}-${count}` : '') + '.jpg';
      names.push(name);
      files.push(typeof root.File === 'function' ? new root.File([blob], name, {type: blob.type}) : blob);
      if (count > 1) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (token !== revision) return null;
    state = {files, names, index: 0, singleImage: single};
    preparing = false;
    if (!pngPending) renderSelection();
    return state;
  } catch (error) {
    if (token !== revision) return null;
    failure = `分享圖片準備失敗（${error.message}）。可儲存 PNG 後從 LINE 傳送。`;
    preparing = false;
    if (!pngPending) note(failure);
    updateButton();
    return null;
  }
}

async function shareCurrent() {
  if (sharing) return;
  if (preparing || pngPending || !state) {
    note(failure || '圖片分享準備中…');
    return;
  }
  const selected = state, file = selected.files[selected.index];
  const support = capability(file);
  if (support !== 'READY') {
    note(support === 'FILE_REJECTED' ? '瀏覽器拒絕分享這個圖片檔。' + FALLBACK : FALLBACK);
    return;
  }
  if (navigator.userActivation?.isActive === false) {
    note('系統需要你再按一次「分享到 LINE」才能開啟分享。');
    return;
  }
  sharing = true;
  updateButton();
  try {
    await navigator.share({files: [file]});
    if (state === selected) note('已交由系統分享，請確認 LINE 傳送結果。');
  } catch (error) {
    if (state === selected) {
      if (error?.name === 'AbortError') note('分享已取消，可再試一次。');
      else if (error?.name === 'NotAllowedError') note('系統未允許分享，請直接再按一次，或儲存圖片後從 LINE 傳送。');
      else note('系統分享未完成。請再試一次，或儲存圖片後從 LINE 傳送。');
    }
  } finally {
    sharing = false;
    updateButton();
  }
}

async function shareCompact({file, blob, button, status, isCurrent}) {
  if (!blob?.size || !button || button.disabled || !isCurrent()) return;
  const nav = root.navigator;
  const mobile = /iPhone|iPad|iPod|Android/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const canCopy = typeof nav.clipboard?.write === 'function' && typeof root.ClipboardItem === 'function';
  const supportsFile = capability(file) === 'READY';
  if (!supportsFile && !canCopy) {
    status(FALLBACK);
    return;
  }
  const copy = canCopy && (!supportsFile || !mobile);
  if (nav.userActivation?.isActive === false) {
    status('系統需要你再按一次「分享到 LINE」才能開啟分享。');
    return;
  }
  button.disabled = true;
  try {
    if (copy) await nav.clipboard.write([new root.ClipboardItem({'image/png':blob})]);
    else await nav.share({files:[file]});
    if (isCurrent()) status(copy
      ? '已複製完整 PNG，可貼到 LINE 電腦版聊天室。'
      : '已交由系統分享，請確認 LINE 傳送結果。');
  } catch (error) {
    if (isCurrent()) status(error?.name === 'AbortError'
      ? '分享已取消，可再試一次。'
      : '系統未完成分享，請再按一次，或儲存 PNG 後從 LINE 傳送。');
  } finally {
    if (isCurrent()) button.disabled = false;
  }
}

function layoutCompact(dialog, {title, controls, dismiss, status, image, download}) {
  const heading = document.createElement('header');
  const scroll = document.createElement('div');
  const footer = document.createElement('footer');
  dialog.classList.add('compact-report-preview');
  heading.className = 'compact-preview-head';
  scroll.className = 'compact-preview-scroll';
  footer.className = 'compact-preview-footer';
  dismiss.textContent = '✕ 關閉';
  heading.append(title, dismiss);
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', '圖片報告內容');
  scroll.append(image);
  footer.append(controls, status);
  download.addEventListener('click', protectDownload);
  dialog.append(heading, scroll, footer);
}

function resetPng() {
  by('postmarketPreviewText')?.remove();
  by('imagePreviewImg')?.removeAttribute('src');
  const link = by('imageDownloadLink');
  link?.removeAttribute('href');
  link?.removeAttribute('download');
  release(pngUrl);
  pngUrl = null;
}

function nextRequest() {
  return root.ShitouReportPreviewEpoch = (root.ShitouReportPreviewEpoch || 0) + 1;
}

async function show(canvas, filename, title, {owner} = {}) {
  const modal = mount();
  const request = nextRequest();
  pngPending = true;
  const opening = !modal.classList.contains('show');
  modal.dispatchEvent(new CustomEvent('shitou-preview-change', {detail: owner}));
  clear();
  resetPng();
  root.ShitouMarketComfortReport?.mountReader(canvas);
  modal.dataset.reportFullBleed = canvas.dataset?.fullBleed === 'true' ? 'true' : 'false';
  const heading = by('imagePreviewTitle');
  heading.textContent = title;
  heading.title = title;
  const link = by('imageDownloadLink');
  link.textContent = '💾 儲存 PNG';
  link.download = filename;
  by('imagePreviewNote').textContent = '';
  modal.querySelector('.image-preview-wrap').scrollTop = 0;
  if (opening) {
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    returnFocus = true;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('.image-modal-close').focus();
  }
  const shareReady = prepare(canvas, {filename});
  let blob;
  try {
    blob = await encode(canvas, 'image/png');
  } catch (error) {
    if (request !== root.ShitouReportPreviewEpoch) return false;
    clear();
    preparing = false;
    pngPending = false;
    failure = 'PNG 編碼失敗，請重新產生圖片。';
    updateButton();
    note(failure);
    throw error;
  }
  if (request !== root.ShitouReportPreviewEpoch) return false;
  pngUrl = URL.createObjectURL(blob);
  by('imagePreviewImg').src = pngUrl;
  link.href = pngUrl;
  const previewText = canvas.renderPreviewText?.();
  if (previewText) by('imagePreviewNote')?.after(previewText);
  pngPending = false;
  if (state) renderSelection();
  else {
    if (failure) note(failure);
    updateButton();
  }
  await shareReady;
  return request === root.ShitouReportPreviewEpoch;
}

function close() {
  const modal = by('imagePreviewModal');
  if (!modal) return;
  nextRequest();
  pngPending = false;
  modal.dispatchEvent(new CustomEvent('shitou-preview-change'));
  clear();
  resetPng();
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  if (modal.classList.contains('market-life-preview')) {
    modal.remove();
    if (root.showInfographicPreviewV3328 === show) delete root.showInfographicPreviewV3328;
    if (root.closeInfographicPreviewV3328 === close) delete root.closeInfographicPreviewV3328;
  }
  if (returnFocus) {
    document.body.style.overflow = previousOverflow;
    (previousFocus?.disabled ? null : previousFocus)?.focus();
    returnFocus = false;
    previousFocus = null;
  }
}

root.ShitouImageShareV1 = Object.freeze({
  mount, show, close, prepare, clear, select, shareCurrent, shareCompact, layoutCompact, release, getState: () => state,
  limits: {width: MAX_WIDTH, height: MAX_HEIGHT, bytes: MAX_BYTES, singleImageHeight: MAX_SINGLE_HEIGHT}
});
})(globalThis);
