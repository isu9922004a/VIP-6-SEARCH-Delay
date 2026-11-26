/* Presentation only: reflect existing button state, never initiate/modify a request or its text. */
(function () {
  'use strict';
  const doc = document;
  const busyLabel = /處理中|分析中|掃描中|快篩|初篩|擴掃|補充中|產生中|生成中|建置中|載入中|讀取中|查詢中|計算中|製作中|匯出中|準備中|更新中|複製中|下載中|搜尋中/;
  function install() {
    if (!doc.body || doc.documentElement.dataset.ui923Feedback === 'ready') return;
    doc.documentElement.dataset.ui923Feedback = 'ready';
    function sync(button) {
      if (!button || !button.matches('button')) return;
      const busy = button.getAttribute('aria-busy') === 'true' ||
        (button.disabled && busyLabel.test(button.textContent || ''));
      if (busy) {
        if (button.dataset.ui923Busy !== 'true') button.dataset.ui923Busy = 'true';
      } else if (button.hasAttribute('data-ui923-busy')) {
        button.removeAttribute('data-ui923-busy');
      }
    }
    function addStatus(node) {
      if (node && !node.hasAttribute('role') && !node.hasAttribute('aria-live')) {
        node.setAttribute('role','status');
      }
    }
    for (const id of ['loading','marketLoading']) addStatus(doc.getElementById(id));
    doc.querySelectorAll('button').forEach(sync);
    const observer = new MutationObserver(records => {
      const changed = new Set();
      for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const button = target && target.closest('button');
        if (button) changed.add(button);
        if (record.type !== 'childList') continue;
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches('button')) changed.add(node);
          node.querySelectorAll('button').forEach(item => changed.add(item));
          if (node.matches('#loading,#marketLoading')) addStatus(node);
          node.querySelectorAll('#loading,#marketLoading').forEach(addStatus);
        }
      }
      changed.forEach(sync);
    });
    observer.observe(doc.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['disabled','aria-busy']
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
