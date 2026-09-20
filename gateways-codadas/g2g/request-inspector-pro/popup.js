// =============================================
// REQUEST INSPECTOR PRO - Popup JS
// Corrigido: event delegation + sem flickering
// =============================================

const SERVER_URL = 'http://localhost:7331';

let allRequests = [];
let selectedRequest = null;
let activeFilter = 'ALL';
let searchQuery = '';
let activeTab = 'overview';
let isCapturing = true;
let lastRenderCount = -1;   // evita re-render desnecessário
let lastRenderFilter = '';  // idem para filtro/busca

const reqListEl = document.getElementById('req-list');
const detailPanelEl = document.getElementById('detail-panel');

// -----------------------------------------------
// Refresh status & requests
// -----------------------------------------------
function refresh() {
  // Atualiza só os contadores — não toca no DOM da lista
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
    if (chrome.runtime.lastError || !status) return;
    isCapturing = status.capturing;
    document.getElementById('stat-total').textContent = status.count;
    document.getElementById('stat-payment').textContent = status.paymentCount;
    document.getElementById('sb-mem').textContent = `${status.count} / 2000`;
    document.getElementById('progress-bar').style.width =
      `${Math.min((status.count / 2000) * 100, 100)}%`;

    const captureBtn = document.getElementById('btn-capture');
    const capturing = isCapturing;
    if (capturing) {
      if (captureBtn.dataset.state !== 'on') {
        captureBtn.innerHTML = '<span class="recording-dot"></span> Capturando';
        captureBtn.className = 'btn btn-capture';
        captureBtn.dataset.state = 'on';
        document.getElementById('sb-status').textContent = '● Capturando';
      }
    } else {
      if (captureBtn.dataset.state !== 'off') {
        captureBtn.innerHTML = '⏸ Pausado';
        captureBtn.className = 'btn btn-capture paused';
        captureBtn.dataset.state = 'off';
        document.getElementById('sb-status').textContent = '⏸ Pausado';
      }
    }

    // Só busca e re-renderiza se o total mudou
    const renderKey = `${status.count}|${activeFilter}|${searchQuery}`;
    if (renderKey !== lastRenderFilter) {
      lastRenderFilter = renderKey;
      chrome.runtime.sendMessage({ type: 'GET_REQUESTS', filter: 'ALL' }, (resp) => {
        if (chrome.runtime.lastError || !resp) return;
        allRequests = resp.requests || [];
        renderList();
      });
    }
  });
}

// -----------------------------------------------
// Filtered list
// -----------------------------------------------
function getFilteredRequests() {
  return allRequests.filter(r => {
    const matchFilter = activeFilter === 'ALL' || r.category === activeFilter;
    const matchSearch = !searchQuery ||
      r.url.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });
}

function renderList() {
  const filtered = getFilteredRequests();
  document.getElementById('sb-filter').textContent =
    `Filtro: ${activeFilter} (${filtered.length})`;

  if (filtered.length === 0) {
    reqListEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📡</div>
        <div>${activeFilter === 'ALL' ? 'Aguardando requisições...' : 'Nenhuma requisição ' + activeFilter}</div>
        <div style="font-size:9px;color:var(--text3)">Navegue no site para capturar</div>
      </div>`;
    return;
  }

  const sorted = [...filtered].reverse();
  reqListEl.innerHTML = sorted.map(req => {
    const statusClass = getStatusClass(req.statusCode);
    const isPayment = req.category === 'PAYMENT';
    const isSelected = selectedRequest && selectedRequest.id === req.id;
    const shortUrl = getShortUrl(req.url);
    const duration = req.timings?.duration
      ? `${Math.round(req.timings.duration)}ms` : '—';

    return `<div class="req-item ${isPayment ? 'payment-req' : ''} ${isSelected ? 'selected' : ''}"
                 data-req-id="${req.id}">
      <div class="req-item-top">
        <span class="method-badge method-${req.method}">${req.method}</span>
        <span class="req-url" title="${escapeHtml(req.url)}">${escapeHtml(shortUrl)}</span>
        <span class="status-badge ${statusClass}">${req.statusCode || '—'}</span>
      </div>
      <div class="req-meta">
        <span class="cat-badge cat-${req.category}">${req.category}</span>
        <span>${duration}</span>
        ${req.fromCache ? '<span style="color:var(--yellow)">cache</span>' : ''}
        ${req.error ? '<span style="color:var(--red)">ERR</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

// -----------------------------------------------
// Event delegation para clique na lista
// -----------------------------------------------
reqListEl.addEventListener('click', (e) => {
  const item = e.target.closest('[data-req-id]');
  if (!item) return;
  const id = item.dataset.reqId;
  selectRequest(id);
});

// -----------------------------------------------
// Select & render detail
// -----------------------------------------------
function selectRequest(id) {
  selectedRequest = allRequests.find(r => r.id === id);
  if (!selectedRequest) return;

  document.getElementById('sb-selected').textContent =
    `${selectedRequest.method} ${getShortUrl(selectedRequest.url)}`;

  document.querySelectorAll('.req-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.reqId === id);
  });

  renderDetail(selectedRequest);
}

function renderDetail(req) {
  const duration = req.timings?.duration
    ? `${Math.round(req.timings.duration)}ms` : 'N/A';
  const statusClass = getStatusClass(req.statusCode);
  const isPayment = req.category === 'PAYMENT';

  detailPanelEl.innerHTML = `
    <div class="detail-tabs">
      <button class="tab-btn ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">📋 Overview</button>
      <button class="tab-btn ${activeTab === 'request' ? 'active' : ''}" data-tab="request">⬆ Request</button>
      <button class="tab-btn ${activeTab === 'response' ? 'active' : ''}" data-tab="response">⬇ Response</button>
      <button class="tab-btn ${activeTab === 'headers' ? 'active' : ''}" data-tab="headers">📝 Headers</button>
      <button class="tab-btn ${activeTab === 'analysis' ? 'active' : ''}" data-tab="analysis">🔬 Análise</button>
    </div>

    <!-- OVERVIEW -->
    <div class="tab-content ${activeTab === 'overview' ? 'active' : ''}" id="tab-overview">
      ${isPayment ? `<div class="alert-box alert-warning">💳 Requisição de PAGAMENTO — veja aba Análise</div>` : ''}
      ${req.error ? `<div class="alert-box alert-error">⚠ Erro: ${escapeHtml(req.error)}</div>` : ''}
      <div class="section-title">URL</div>
      <div class="url-box">${escapeHtml(req.url)}</div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="copy-btn" data-copy="${escapeAttr(req.url)}">📋 Copiar URL</button>
        <button class="copy-btn" id="btn-copy-curl">📋 cURL</button>
        <button class="copy-btn" id="btn-copy-req-json">📋 JSON</button>
      </div>
      <div class="section-title" style="margin-top:12px">Informações</div>
      <table class="kv-table">
        <tr><td>Método</td><td><span class="method-badge method-${req.method}">${req.method}</span></td></tr>
        <tr><td>Status</td><td><span class="status-badge ${statusClass}">${req.statusCode || '—'}</span> ${escapeHtml(req.statusLine || '')}</td></tr>
        <tr><td>Categoria</td><td><span class="cat-badge cat-${req.category}">${req.category}</span></td></tr>
        <tr><td>Duração</td><td class="${(req.timings?.duration || 0) > 3000 ? 'highlight-warning' : ''}">${duration}</td></tr>
        <tr><td>Timestamp</td><td>${req.timestamp || '—'}</td></tr>
        <tr><td>IP Servidor</td><td>${escapeHtml(req.ip || '—')}</td></tr>
        <tr><td>Cache</td><td class="${req.fromCache ? 'highlight-warning' : ''}">${req.fromCache ? '⚠ SIM (cacheada!)' : 'Não'}</td></tr>
        <tr><td>Tipo</td><td>${escapeHtml(req.type || '—')}</td></tr>
        <tr><td>Iniciador</td><td style="word-break:break-all;font-size:9px">${escapeHtml(req.initiator || '—')}</td></tr>
      </table>
      ${req.redirects?.length > 0 ? `
        <div class="section-title">Redirecionamentos (${req.redirects.length})</div>
        ${req.redirects.map(r => `
          <div class="alert-box alert-warning" style="flex-direction:column;gap:2px">
            <div><b>${r.statusCode}</b> ${escapeHtml(r.from)}</div>
            <div style="color:var(--text2)">→ ${escapeHtml(r.to)}</div>
          </div>`).join('')}
      ` : ''}
      <div class="section-title">Timing</div>
      <div class="timing-bar">
        <div class="timing-fill" style="width:${Math.min(((req.timings?.duration || 0) / 5000) * 100, 100)}%"></div>
      </div>
      <div style="font-size:9px;color:var(--text3);margin-top:3px">${duration} total</div>
    </div>

    <!-- REQUEST -->
    <div class="tab-content ${activeTab === 'request' ? 'active' : ''}" id="tab-request">
      <div class="section-title">Body da Requisição</div>
      ${req.requestBody
        ? `<button class="copy-btn" data-copy-obj='${safeAttrJSON(req.requestBody)}'>📋 Copiar</button>
           <div class="code-block" style="margin-top:6px">${escapeHtml(formatBody(req.requestBody))}</div>`
        : '<div style="color:var(--text3);font-size:10px">Sem body</div>'}
      <div class="section-title" style="margin-top:12px">Query Params</div>
      ${renderQueryParams(req.url)}
      <div class="section-title" style="margin-top:12px">Fingerprint</div>
      ${renderFingerprint(req.fingerprint)}
    </div>

    <!-- RESPONSE -->
    <div class="tab-content ${activeTab === 'response' ? 'active' : ''}" id="tab-response">
      <div class="section-title">Body da Resposta</div>
      ${req.responseBody
        ? `<button class="copy-btn" data-copy-obj='${safeAttrJSON(req.responseBody)}'>📋 Copiar</button>
           <div class="code-block" style="margin-top:6px">${escapeHtml(
               typeof req.responseBody.parsed === 'object'
                 ? JSON.stringify(req.responseBody.parsed, null, 2)
                 : (req.responseBody.text || ''))}</div>`
        : '<div style="color:var(--text3);font-size:10px">Body capturado via XHR/Fetch (veja Headers)</div>'}
      <div class="section-title" style="margin-top:12px">Headers de Segurança</div>
      ${renderSecurityHeaders(req.securityHeaders)}
    </div>

    <!-- HEADERS -->
    <div class="tab-content ${activeTab === 'headers' ? 'active' : ''}" id="tab-headers">
      <div class="section-title">Request Headers</div>
      <button class="copy-btn" data-copy-obj='${safeAttrJSON(req.requestHeaders)}'>📋 Copiar</button>
      ${renderHeadersTable(req.requestHeaders)}
      <div class="section-title" style="margin-top:12px">Response Headers</div>
      <button class="copy-btn" data-copy-obj='${safeAttrJSON(req.responseHeaders)}'>📋 Copiar</button>
      ${renderHeadersTable(req.responseHeaders)}
    </div>

    <!-- ANALYSIS -->
    <div class="tab-content ${activeTab === 'analysis' ? 'active' : ''}" id="tab-analysis">
      ${renderAnalysis(req)}
    </div>
  `;

  // ─── bind eventos do detail panel ───
  // Tabs
  detailPanelEl.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Copiar URL simples
  detailPanelEl.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.dataset.copy));
  });

  // Copiar objeto JSON
  detailPanelEl.querySelectorAll('[data-copy-obj]').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const obj = JSON.parse(btn.dataset.copyObj);
        copyText(JSON.stringify(obj, null, 2));
      } catch (e) { copyText(btn.dataset.copyObj); }
    });
  });

  // cURL
  const curlBtn = document.getElementById('btn-copy-curl');
  if (curlBtn) curlBtn.addEventListener('click', copyRequestAsCurl);

  // JSON da req selecionada
  const jsonBtn = document.getElementById('btn-copy-req-json');
  if (jsonBtn) jsonBtn.addEventListener('click', copyRequestAsJSON);

  // Botão salvar sessão (análise)
  const saveBtn = document.getElementById('btn-save-session');
  if (saveBtn) saveBtn.addEventListener('click', saveSessionToServer);
}

function switchTab(tab) {
  activeTab = tab;
  if (selectedRequest) renderDetail(selectedRequest);
}

// -----------------------------------------------
// Render helpers
// -----------------------------------------------
function formatBody(body) {
  if (!body) return '';
  if (body.type === 'raw') {
    return typeof body.parsed === 'object'
      ? JSON.stringify(body.parsed, null, 2)
      : (body.text || '');
  }
  if (body.type === 'formData') return JSON.stringify(body.data, null, 2);
  return JSON.stringify(body, null, 2);
}

function renderQueryParams(url) {
  try {
    const u = new URL(url);
    const params = [];
    u.searchParams.forEach((v, k) => params.push({ k, v }));
    if (!params.length) return '<div style="color:var(--text3);font-size:10px">Sem query params</div>';
    return `<table class="kv-table">${params.map(p =>
      `<tr><td>${escapeHtml(p.k)}</td><td>${escapeHtml(p.v)}</td></tr>`
    ).join('')}</table>`;
  } catch (e) { return '<div style="color:var(--text3);font-size:10px">—</div>'; }
}

function renderFingerprint(fp) {
  if (!fp) return '<div style="color:var(--text3);font-size:10px">—</div>';
  const rows = [
    ['User-Agent', fp.userAgent],
    ['Origin', fp.origin],
    ['Referer', fp.referer],
    ['Cookie', fp.cookie],
    ['Content-Type', fp.contentType],
    ['Authorization', fp.authorization],
    ['X-Forwarded-For', fp.xForwardedFor],
    ['Custom Headers', fp.customHeaders?.join(', ')]
  ].filter(([, v]) => v);
  if (!rows.length) return '<div style="color:var(--text3);font-size:10px">—</div>';
  return `<table class="kv-table">${rows.map(([k, v]) => {
    const cls = k === 'X-Forwarded-For' ? 'highlight-payment' : '';
    return `<tr><td>${k}</td><td class="${cls}" style="font-size:9px">${escapeHtml(String(v))}</td></tr>`;
  }).join('')}</table>`;
}

function renderHeadersTable(headers) {
  if (!headers || !Object.keys(headers).length)
    return '<div style="color:var(--text3);font-size:10px">Sem headers</div>';
  const important = ['authorization','cookie','set-cookie','x-forwarded-for','x-real-ip',
    'cf-connecting-ip','content-type','location','www-authenticate'];
  return `<table class="kv-table">${Object.entries(headers).map(([k, v]) => {
    const hi = important.includes(k.toLowerCase()) ? 'highlight-payment' : '';
    return `<tr>
      <td class="${hi}">${escapeHtml(k)}</td>
      <td style="font-size:9px;word-break:break-all">${escapeHtml(String(v).substring(0, 300))}</td>
    </tr>`;
  }).join('')}</table>`;
}

function renderSecurityHeaders(sec) {
  if (!sec) return '<div style="color:var(--text3);font-size:10px">—</div>';
  return `<table class="kv-table">${Object.entries(sec).map(([k, v]) =>
    `<tr>
      <td>${k}</td>
      <td class="${v ? 'highlight-ok' : 'highlight-warning'}">${v ? escapeHtml(String(v).substring(0, 200)) : '—'}</td>
    </tr>`
  ).join('')}</table>`;
}

function renderAnalysis(req) {
  const issues = [], warnings = [], info = [];

  if (req.fromCache) issues.push('⚠ Resposta CACHEADA — pode usar dados antigos no pagamento');
  if (req.statusCode >= 400) issues.push(`🔴 Erro HTTP ${req.statusCode} — servidor rejeitou`);
  if (req.error) issues.push(`🔴 Erro de rede: ${escapeHtml(req.error)}`);

  const rh = req.requestHeaders || {};
  const ua = rh['User-Agent'] || rh['user-agent'] || '';
  if (ua.includes('HeadlessChrome') || ua.includes('PhantomJS'))
    issues.push('🔴 User-Agent revela automação/headless — detectável por anti-fraude');
  if (!rh['Cookie'] && !rh['cookie'])
    warnings.push('🟡 Sem cookies — sessão pode estar incorreta');
  if (!rh['Origin'] && !rh['origin'] && !rh['Referer'] && !rh['referer'])
    warnings.push('🟡 Sem Origin/Referer — pode ser sinalizado como suspeito');

  if (req.fingerprint?.xForwardedFor)
    warnings.push(`🟡 X-Forwarded-For exposto: ${escapeHtml(req.fingerprint.xForwardedFor)}`);

  const respH = req.responseHeaders || {};
  if (respH['retry-after']) issues.push(`🔴 Rate limiting — Retry-After: ${respH['retry-after']}`);
  if (respH['x-fraud-score']) issues.push(`🔴 Fraud score detectado: ${respH['x-fraud-score']}`);
  if (respH['location']?.includes('challenge')) warnings.push('🟡 Redirect para challenge detectado');
  if (respH['location'] && /3ds|acs|vbv/i.test(respH['location']))
    info.push('🔵 3DS/VBV redirect: ' + escapeHtml(respH['location']));

  if (req.requestBody) {
    const bt = JSON.stringify(req.requestBody);
    if (/"card"|"number"|"cvv"/i.test(bt)) info.push('🔵 Dados de cartão no payload');
    if (/"token"|"nonce"/i.test(bt)) info.push('🔵 Token/Nonce de pagamento no payload');
    if (/"3ds"|"threeds"|"authentication"/i.test(bt)) info.push('🔵 Dados 3DS no payload');
    if (/null|"undefined"/i.test(bt)) warnings.push('🟡 Valores nulos/undefined no payload');
  }

  if (!issues.length && !warnings.length) info.push('✅ Nenhum problema evidente detectado');

  return `
    <div class="analysis-section">
      <div class="section-title">🔬 Diagnóstico</div>
      ${issues.map(i => `<div class="alert-box alert-error">${i}</div>`).join('')}
      ${warnings.map(w => `<div class="alert-box alert-warning">${w}</div>`).join('')}
      ${info.map(i => `<div class="alert-box alert-info">${i}</div>`).join('')}
    </div>
    <div class="analysis-section">
      <div class="section-title">📊 Indicadores</div>
      ${renderRiskIndicators(req)}
    </div>
    <div class="analysis-section">
      <div class="section-title">💾 Salvar no Diretório</div>
      <div style="font-size:10px;color:var(--text2);margin-bottom:8px">
        O servidor local deve estar rodando (<code style="color:var(--accent)">node server.js</code>).
        Salva em <code style="color:var(--green)">tetsee/captures/</code>
      </div>
      <button class="copy-btn" id="btn-save-session" style="padding:6px 14px;font-size:11px">
        💾 Salvar sessão completa agora
      </button>
    </div>
    <div class="analysis-section">
      <div class="section-title">💡 Pontos de Atenção</div>
      <table class="kv-table">
        <tr><td>Cookie</td><td class="${req.fingerprint?.cookie ? 'highlight-ok' : 'highlight-error'}">${req.fingerprint?.cookie || '❌ AUSENTE'}</td></tr>
        <tr><td>IP exposto</td><td class="${req.fingerprint?.xForwardedFor ? 'highlight-warning' : 'highlight-ok'}">${req.fingerprint?.xForwardedFor || '✅ OK'}</td></tr>
        <tr><td>Auth</td><td class="${req.fingerprint?.authorization ? 'highlight-ok' : ''}">${req.fingerprint?.authorization || '—'}</td></tr>
        <tr><td>Status</td><td class="${(req.statusCode || 0) >= 400 ? 'highlight-error' : 'highlight-ok'}">${req.statusCode || '—'}</td></tr>
        <tr><td>Duração</td><td class="${(req.timings?.duration || 0) > 5000 ? 'highlight-warning' : ''}">${req.timings?.duration ? Math.round(req.timings.duration) + 'ms' : '—'}</td></tr>
        <tr><td>Redirects</td><td class="${(req.redirects?.length || 0) > 0 ? 'highlight-warning' : ''}">${req.redirects?.length || 0}</td></tr>
      </table>
    </div>`;
}

function renderRiskIndicators(req) {
  const ua = (req.requestHeaders?.['user-agent'] || req.requestHeaders?.['User-Agent'] || '');
  const indicators = [
    { label: 'Headless Browser', risk: ua.includes('Headless') ? 'high' : 'low', value: ua.includes('Headless') ? 'DETECTADO ⚠' : 'OK' },
    { label: 'Proxy visível', risk: req.fingerprint?.xForwardedFor ? 'high' : 'low', value: req.fingerprint?.xForwardedFor || 'Não detectado' },
    { label: 'Resposta cacheada', risk: req.fromCache ? 'medium' : 'low', value: req.fromCache ? 'SIM ⚠' : 'Não' },
    { label: 'Erro HTTP', risk: (req.statusCode || 0) >= 400 ? 'high' : 'low', value: (req.statusCode || 0) >= 400 ? `${req.statusCode} ERRO` : 'OK' },
    { label: 'Cookies', risk: req.fingerprint?.cookie ? 'low' : 'medium', value: req.fingerprint?.cookie ? '✅ Presente' : '❌ Ausente' }
  ];
  return indicators.map(ind => `
    <div class="risk-indicator risk-${ind.risk}">
      <div class="risk-dot"></div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:10px">${ind.label}</div>
        <div style="font-size:9px;color:var(--text2);margin-top:1px">${escapeHtml(ind.value)}</div>
      </div>
    </div>`).join('');
}

// -----------------------------------------------
// Utilitários
// -----------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeAttrJSON(obj) {
  try {
    return JSON.stringify(obj).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  } catch (e) { return '{}'; }
}

function getStatusClass(code) {
  if (!code || code === 0) return 'status-0';
  if (code < 300) return 'status-2xx';
  if (code < 400) return 'status-3xx';
  if (code < 500) return 'status-4xx';
  return 'status-5xx';
}

function getShortUrl(url) {
  try {
    const u = new URL(url);
    const p = u.pathname;
    return u.hostname + (p.length > 30 ? '...' + p.slice(-25) : p);
  } catch (e) { return url.substring(0, 50); }
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function copyRequestAsCurl() {
  if (!selectedRequest) return;
  const r = selectedRequest;
  const hdr = Object.entries(r.requestHeaders || {})
    .map(([k, v]) => `-H '${k}: ${v}'`).join(' \\\n  ');
  const body = r.requestBody?.text ? `--data '${r.requestBody.text}'` : '';
  copyText(`curl -X ${r.method} '${r.url}' \\\n  ${hdr} \\\n  ${body}`);
}

function copyRequestAsJSON() {
  if (!selectedRequest) return;
  copyText(JSON.stringify(selectedRequest, null, 2));
}

// -----------------------------------------------
// Salvar no servidor local (via background worker)
// -----------------------------------------------
async function saveSessionToServer() {
  chrome.runtime.sendMessage({ type: 'SAVE_NOW' }, (resp) => {
    if (chrome.runtime.lastError) {
      showToast('❌ Erro ao contatar background', 'error');
      return;
    }
    showToast('✅ Salvo pelo background!', 'success');
  });
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  const colors = { success: 'var(--green)', warning: 'var(--yellow)', error: 'var(--red)', info: 'var(--accent)' };
  Object.assign(toast.style, {
    position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
    background: 'var(--surface2)', border: `1px solid ${colors[type]}`,
    color: colors[type], padding: '6px 14px', borderRadius: '20px',
    fontSize: '11px', fontWeight: '600', zIndex: '9999',
    fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
  });
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// -----------------------------------------------
// Toolbar buttons
// -----------------------------------------------
document.getElementById('btn-capture').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_CAPTURE' }, (resp) => {
    if (resp) { isCapturing = resp.capturing; refresh(); }
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS' }, () => {
    allRequests = [];
    selectedRequest = null;
    renderList();
    detailPanelEl.innerHTML = `
      <div class="detail-empty">
        <div class="icon">👆</div>
        <p>Selecione uma requisição para ver detalhes</p>
      </div>`;
    document.getElementById('stat-total').textContent = '0';
    document.getElementById('stat-payment').textContent = '0';
  });
});

document.getElementById('btn-export-json').addEventListener('click', () => {
  const data = JSON.stringify(allRequests, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: `requests_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    saveAs: true
  });
});

document.getElementById('btn-export-har').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'EXPORT_HAR' }, (resp) => {
    if (!resp) return;
    const blob = new Blob([resp.har], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url,
      filename: `requests_${new Date().toISOString().replace(/[:.]/g, '-')}.har`,
      saveAs: true
    });
  });
});

document.getElementById('btn-copy-all').addEventListener('click', () => {
  const filtered = getFilteredRequests();
  const summary = filtered.map(r => ({
    method: r.method, url: r.url, status: r.statusCode,
    duration: r.timings?.duration, category: r.category, error: r.error
  }));
  copyText(JSON.stringify(summary, null, 2));
  showToast(`📋 ${filtered.length} requisições copiadas`, 'success');
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.f;
    renderList();
  });
});

// Search
document.getElementById('search-box').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderList();
});

// -----------------------------------------------
// Init
// -----------------------------------------------
refresh();
setInterval(refresh, 100);
// Auto-save agora é feito pelo background service worker via chrome.alarms (a cada 15s)
// O popup não precisa fazer isso (fecha quando perde foco)
