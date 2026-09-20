'use strict';

// =============================================
// ELDORADO FLOW RECORDER - Popup v2
// =============================================

let allRequests = [];
let selectedStep = null;
let activePhase  = 'ALL';
let activeTab    = 'url';
let capturing    = true;
let activeTabId  = null;

const FLOW_PHASES = {
  PRODUCT:  /eldorado\.gg\/(buy-robux|g\/\d)/i,
  CHECKOUT: /\/order|\/checkout|\/cart|\/purchase/i,
  PAYMENT:  /primer\.io|\/payment-method|\/apply-payment|\/confirm-order/i,
  PIX:      /pix|qr.?code|\/boleto/i,
  CARD:     /card|creditcard|credit-card|\/card-payment/i,
  DS3:      /\/challenge|\/threedssessiondata|\/3ds|acs\.|\/authenticate/i,
  COMPLETE: /\/order-complete|\/success|\/thank-you|order-placed/i,
};

function detectPhase(url) {
  for (const [phase, re] of Object.entries(FLOW_PHASES)) {
    if (re.test(url)) return phase;
  }
  return 'OTHER';
}

function statusClass(code) {
  if (!code) return 'status-0';
  if (code < 300) return 'status-2xx';
  if (code < 400) return 'status-3xx';
  if (code < 500) return 'status-4xx';
  return 'status-5xx';
}

function methodClass(m) {
  return 'method-' + (m || 'GET').toUpperCase();
}

function formatUrl(url) {
  try {
    const u = new URL(url);
    return `<span style="color:var(--muted)">${u.hostname}</span>${u.pathname.substring(0, 40)}${u.pathname.length > 40 ? '…' : ''}`;
  } catch {
    return url.substring(0, 60);
  }
}

function prettyJSON(str) {
  if (!str) return '(vazio)';
  try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

function formatHeaders(headers) {
  if (!headers || typeof headers !== 'object') return '(nenhum)';
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
}

// -----------------------------------------------
// Render
// -----------------------------------------------
function render() {
  const list = document.getElementById('flowList');
  const filtered = activePhase === 'ALL'
    ? allRequests
    : allRequests.filter(r => r.phase === activePhase);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📡</div>
      <div class="empty-title">${activePhase === 'ALL' ? 'Aguardando requests' : 'Nenhum request desta fase'}</div>
      <div class="empty-sub">Abra o Eldorado.gg e navegue até<br>a página de compra.</div>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map((req, i) => {
    const phase   = req.phase || detectPhase(req.url);
    const method  = (req.method || 'GET').toUpperCase();
    const status  = req.statusCode || 0;
    const ms      = req.timings?.duration ? Math.round(req.timings.duration) : (req.duration || 0);
    const isSelected = selectedStep && selectedStep.url === req.url && selectedStep.timestamp === req.timestamp;

    return `<div class="step-row ${isSelected ? 'selected' : ''}" data-idx="${i}">
      <span class="step-idx">${i + 1}</span>
      <span class="step-phase phase-${phase}">${phase}</span>
      <span class="step-method ${methodClass(method)}">${method}</span>
      <span class="step-url">${formatUrl(req.url)}</span>
      <span class="step-status ${statusClass(status)}">${status || '—'}</span>
      <span class="step-ms">${ms}ms</span>
    </div>`;
  }).join('');

  // Click handlers
  list.querySelectorAll('.step-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.idx);
      selectedStep = filtered[idx];
      renderDetail();
      render(); // re-render selection highlight
    });
  });

  // Update stats
  const eldoradoCount = allRequests.filter(r => r.url && (r.url.includes('eldorado.gg') || r.url.includes('primer.io'))).length;
  const paymentCount  = allRequests.filter(r => ['PAYMENT', 'PIX', 'CARD', 'DS3'].includes(r.phase)).length;
  const errorCount    = allRequests.filter(r => r.statusCode >= 400 || r.error).length;

  document.getElementById('statTotal').textContent    = allRequests.length;
  document.getElementById('statEld').textContent      = eldoradoCount;
  document.getElementById('statPayment').textContent  = paymentCount;
  document.getElementById('statErrors').textContent   = errorCount;
}

function renderDetail() {
  const panel = document.getElementById('detailPanel');
  const content = document.getElementById('detailContent');
  const replayLabel = document.getElementById('replayLabel');
  const btnReplay = document.getElementById('btnReplay');

  if (!selectedStep) {
    panel.classList.remove('visible');
    return;
  }

  panel.classList.add('visible');
  btnReplay.disabled = false;
  replayLabel.textContent = `${selectedStep.method} → ${selectedStep.url.substring(0, 50)}${selectedStep.url.length > 50 ? '…' : ''}`;

  const req = selectedStep;
  let text = '';
  switch (activeTab) {
    case 'url':
      text = `URL:     ${req.url}\nMétodo:  ${req.method}\nFase:    ${req.phase}\nStatus:  ${req.statusCode || 0}\nDuração: ${req.timings?.duration || req.duration || 0}ms\nCached:  ${req.fromCache || false}\nIP:      ${req.ip || 'n/a'}\nTabela:  ${req.timestamp || ''}`;
      break;
    case 'reqBody':
      text = prettyJSON(
        typeof req.requestBody === 'object' && req.requestBody !== null
          ? (req.requestBody.text || JSON.stringify(req.requestBody))
          : req.requestBody
      );
      break;
    case 'resBody':
      text = prettyJSON(
        typeof req.responseBody === 'object' && req.responseBody !== null
          ? (req.responseBody.text || JSON.stringify(req.responseBody))
          : req.responseBody
      );
      break;
    case 'reqHeaders':
      text = formatHeaders(req.requestHeaders);
      break;
  }
  content.textContent = text;
}

// -----------------------------------------------
// Fetch requests from background
// -----------------------------------------------
async function loadRequests() {
  chrome.runtime.sendMessage({ type: 'GET_REQUESTS' }, (res) => {
    if (!res) return;
    allRequests = (res.requests || []).map(r => ({ ...r, phase: detectPhase(r.url) }));
    render();
  });

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (!res) return;
    capturing = res.capturing;
    const dot = document.getElementById('captureDot');
    const label = document.getElementById('captureLabel');
    dot.classList.toggle('on', capturing);
    label.textContent = capturing ? 'gravando' : 'pausado';
    document.getElementById('btnToggleCapture').innerHTML = capturing
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Retomar`;
  });
}

// -----------------------------------------------
// Get active Eldorado tab for replay
// -----------------------------------------------
async function getEldoradoTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ url: '*://*.eldorado.gg/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        resolve(tabs[0].id);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs2) => {
          resolve(tabs2?.[0]?.id || null);
        });
      }
    });
  });
}

// -----------------------------------------------
// Event listeners
// -----------------------------------------------
document.getElementById('btnRefresh').addEventListener('click', loadRequests);

document.getElementById('btnToggleCapture').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_CAPTURE' }, (res) => {
    if (!res) return;
    capturing = res.capturing;
    loadRequests();
  });
});

document.getElementById('btnClear').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS' }, () => {
    allRequests = [];
    selectedStep = null;
    document.getElementById('detailPanel').classList.remove('visible');
    render();
  });
});

document.getElementById('btnExport').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'EXPORT_HAR' }, (res) => {
    if (!res?.har) return;
    const blob = new Blob([res.har], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eldorado_flow_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.har`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// Phase filter tabs
document.getElementById('phaseTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.phase-tab');
  if (!tab) return;
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activePhase = tab.dataset.phase;
  selectedStep = null;
  document.getElementById('detailPanel').classList.remove('visible');
  render();
});

// Detail tabs
document.querySelector('.detail-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.detail-tab');
  if (!tab) return;
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeTab = tab.dataset.tab;
  renderDetail();
});

// Replay button
document.getElementById('btnReplay').addEventListener('click', async () => {
  if (!selectedStep) return;
  const tabId = await getEldoradoTab();
  if (!tabId) {
    alert('Nenhuma aba do Eldorado encontrada. Abra o site primeiro.');
    return;
  }

  const btn = document.getElementById('btnReplay');
  btn.textContent = 'Enviando…';
  btn.disabled = true;

  chrome.runtime.sendMessage({
    type: 'REPLAY_IN_BROWSER',
    tabId,
    step: {
      replayId: 'popup_' + Date.now(),
      method: selectedStep.method,
      url: selectedStep.url,
      requestHeaders: selectedStep.requestHeaders || {},
      requestBody: typeof selectedStep.requestBody === 'object'
        ? (selectedStep.requestBody?.text || null)
        : selectedStep.requestBody,
    }
  }, (res) => {
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Replay In-Browser`;
    btn.disabled = false;
    if (res?.ok) {
      document.getElementById('replayLabel').textContent = '✔ Replay enviado! Veja console da aba Eldorado.';
    } else {
      document.getElementById('replayLabel').textContent = '✘ Falha: ' + (res?.error || 'erro desconhecido');
    }
  });
});

// -----------------------------------------------
// 3DS capture banner
// -----------------------------------------------
let lastDS3PreviewUrl = null;

function checkDS3Capture() {
  chrome.runtime.sendMessage({ type: 'GET_DS3' }, (res) => {
    if (!res?.capture) return;
    const cap = res.capture;
    if (!cap) return;
    const banner = document.getElementById('ds3Banner');
    document.getElementById('ds3Bank').textContent = `Banco: ${cap.bank}`;
    document.getElementById('ds3Url').textContent = cap.sourceUrl || '';
    lastDS3PreviewUrl = cap.previewUrl;
    banner.style.display = 'flex';
  });
}

document.getElementById('btnViewClone').addEventListener('click', () => {
  if (lastDS3PreviewUrl) {
    chrome.tabs.create({ url: lastDS3PreviewUrl });
  }
});

// -----------------------------------------------
// Init + auto-refresh a cada 4s
// -----------------------------------------------
loadRequests();
checkDS3Capture();
setInterval(loadRequests, 4000);
setInterval(checkDS3Capture, 5000);
