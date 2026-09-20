// =============================================
// ELDORADO FLOW RECORDER - Injected Script v2
// Roda no contexto da página (window scope)
// Intercepta fetch/XHR, grava o fluxo completo
// e permite replay in-browser com cookies reais.
// =============================================

(function (window) {
  'use strict';

  // -----------------------------------------------
  // Tags de fase do fluxo de compra
  // -----------------------------------------------
  const FLOW_PHASES = {
    PRODUCT:  /eldorado\.gg\/(buy-robux|g\/\d)/i,
    CHECKOUT: /\/order|\/checkout|\/cart|\/purchase|\/payment/i,
    PAYMENT:  /primer\.io|\/payment-method|\/apply-payment|\/confirm-order/i,
    PIX:      /pix|qr.?code|\/boleto/i,
    CARD:     /card|creditcard|credit-card|\/card-payment/i,
    DS3:      /\/challenge|\/threedssessiondata|\/3ds|acs\.bancodobrasil|\/authenticate/i,
    COMPLETE: /\/order-complete|\/success|\/thank-you|order-placed/i,
  };

  function detectPhase(url) {
    for (const [phase, re] of Object.entries(FLOW_PHASES)) {
      if (re.test(url)) return phase;
    }
    return 'OTHER';
  }

  function isEldoradoOrPrimer(url) {
    return /eldorado\.gg|primer\.io/.test(url);
  }

  function dispatch(data) {
    window.dispatchEvent(new CustomEvent('__ELD_FLOW__', { detail: data }));
  }

  function tryParseBody(body) {
    if (!body) return null;
    if (typeof body === 'string') {
      return body.length > 80000 ? body.substring(0, 80000) + '...[truncated]' : body;
    }
    if (body instanceof FormData) {
      const obj = {};
      body.forEach((v, k) => { obj[k] = typeof v === 'string' ? v : '[File]'; });
      return JSON.stringify(obj);
    }
    if (body instanceof URLSearchParams) return body.toString();
    try { return JSON.stringify(body); } catch { return String(body); }
  }

  // -----------------------------------------------
  // Storage em memória dos steps gravados
  // -----------------------------------------------
  window.__ELD_FLOW_STEPS__ = window.__ELD_FLOW_STEPS__ || [];

  function recordStep(entry) {
    const step = {
      ...entry,
      phase:     detectPhase(entry.url),
      stepIndex: window.__ELD_FLOW_STEPS__.length,
      pageUrl:   window.location.href,
      pageTitle: document.title,
    };
    window.__ELD_FLOW_STEPS__.push(step);
    dispatch(step);
  }

  // -----------------------------------------------
  // Interceptar XMLHttpRequest
  // -----------------------------------------------
  const OriginalXHR = window.XMLHttpRequest;

  function PatchedXHR() {
    const xhr = new OriginalXHR();
    let _method = 'GET', _url = '', _requestBody = null, _startTime = null;
    const capturedReqHeaders = {};

    xhr.open = function (method, url, ...args) {
      _method = method;
      _url = url;
      _startTime = Date.now();
      return OriginalXHR.prototype.open.call(xhr, method, url, ...args);
    };

    xhr.setRequestHeader = function (name, value) {
      capturedReqHeaders[name] = value;
      return OriginalXHR.prototype.setRequestHeader.call(xhr, name, value);
    };

    xhr.send = function (body) {
      _requestBody = tryParseBody(body);

      xhr.addEventListener('loadend', function () {
        try {
          const resText = (xhr.responseType === '' || xhr.responseType === 'text')
            ? xhr.responseText : '[binary: ' + xhr.responseType + ']';
          const trimmed = resText && resText.length > 100000
            ? resText.substring(0, 100000) + '...[truncated]' : resText;

          recordStep({
            source:          'XHR',
            method:          _method,
            url:             _url,
            status:          xhr.status,
            requestBody:     _requestBody,
            requestHeaders:  capturedReqHeaders,
            responseBody:    trimmed,
            contentType:     xhr.getResponseHeader('content-type') || '',
            duration:        Date.now() - _startTime,
            timestamp:       new Date().toISOString(),
          });
        } catch (_) {}
      });

      return OriginalXHR.prototype.send.call(xhr, body);
    };

    // Proxy todas as demais propriedades/métodos
    return new Proxy(xhr, {
      get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function') return val.bind(target);
        return val;
      },
      set(target, prop, val) { target[prop] = val; return true; }
    });
  }

  Object.setPrototypeOf(PatchedXHR, OriginalXHR);
  PatchedXHR.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // -----------------------------------------------
  // Interceptar Fetch API
  // -----------------------------------------------
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init = {}) {
    const startTime = Date.now();
    let url = '', method = 'GET', requestBody = null, requestHeaders = {};

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
      method = input.method;
      try { requestBody = tryParseBody(await input.clone().text()); } catch (_) {}
    }

    if (init) {
      method = init.method || method;
      requestBody = tryParseBody(init.body) || requestBody;
      if (init.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => { requestHeaders[k] = v; });
        } else {
          requestHeaders = { ...init.headers };
        }
      }
    }

    let response;
    try {
      response = await originalFetch(input, init);
    } catch (err) {
      recordStep({
        source: 'FETCH', method, url,
        status: 0, requestBody, requestHeaders,
        responseBody: err.message, contentType: '',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: err.message,
      });
      throw err;
    }

    try {
      const cloned = response.clone();
      const contentType = response.headers.get('content-type') || '';
      let body = '';
      if (/json|text|xml|form/.test(contentType)) {
        body = await cloned.text();
        if (body.length > 100000) body = body.substring(0, 100000) + '...[truncated]';
      } else {
        body = '[binary: ' + contentType + ']';
      }
      const resHeaders = {};
      response.headers.forEach((v, k) => { resHeaders[k] = v; });

      recordStep({
        source: 'FETCH', method, url,
        status: response.status,
        requestBody, requestHeaders,
        responseHeaders: resHeaders,
        responseBody: body,
        contentType,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (_) {}

    return response;
  };

  // -----------------------------------------------
  // In-Browser Replay Engine
  // Recebe comando via CustomEvent e executa fetch
  // no contexto autenticado da página.
  // -----------------------------------------------
  window.addEventListener('__ELD_REPLAY_CMD__', async function (e) {
    const { replayId, method, url, headers, body } = e.detail || {};
    if (!replayId || !url) return;

    const startTime = Date.now();
    try {
      const response = await originalFetch(url, {
        method: method || 'GET',
        headers: headers || {},
        body: (method !== 'GET' && method !== 'HEAD') ? body : undefined,
        credentials: 'include', // Usa os cookies reais do browser
      });

      const contentType = response.headers.get('content-type') || '';
      let responseBody = '';
      try {
        responseBody = await response.clone().text();
        if (responseBody.length > 100000) responseBody = responseBody.substring(0, 100000) + '...[truncated]';
      } catch (_) {}

      const resHeaders = {};
      response.headers.forEach((v, k) => { resHeaders[k] = v; });

      window.dispatchEvent(new CustomEvent('__ELD_REPLAY_RESULT__', {
        detail: {
          replayId,
          status: response.status,
          statusText: response.statusText,
          responseHeaders: resHeaders,
          responseBody,
          contentType,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          ok: response.ok,
        }
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('__ELD_REPLAY_RESULT__', {
        detail: {
          replayId,
          status: 0,
          error: err.message,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          ok: false,
        }
      }));
    }
  });

  // -----------------------------------------------
  // Expose API global para debug no console
  // -----------------------------------------------
  window.__ELD_REPLAY__ = async function (stepIndex) {
    const step = window.__ELD_FLOW_STEPS__[stepIndex];
    if (!step) { console.error('[ELD] Step não encontrado:', stepIndex); return; }
    const replayId = 'manual_' + Date.now();
    window.dispatchEvent(new CustomEvent('__ELD_REPLAY_CMD__', {
      detail: { replayId, method: step.method, url: step.url, headers: step.requestHeaders, body: step.requestBody }
    }));
    console.log(`[ELD] Replay disparado para step ${stepIndex}: ${step.method} ${step.url}`);
  };

  window.__ELD_STEPS__ = () => {
    console.table(window.__ELD_FLOW_STEPS__.map(s => ({
      '#': s.stepIndex,
      fase: s.phase,
      method: s.method,
      status: s.status,
      url: s.url.replace(/https?:\/\/[^/]+/, '').substring(0, 60),
      ms: s.duration,
    })));
  };

  console.log('[Eldorado Flow Recorder v2] Interceptores ativos. Use __ELD_STEPS__() e __ELD_REPLAY__(n) no console.');

})(window);
