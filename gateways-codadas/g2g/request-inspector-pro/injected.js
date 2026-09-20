// =============================================
// REQUEST INSPECTOR PRO - Injected Script
// Roda no contexto da página (window scope)
// Intercepta XMLHttpRequest e fetch nativamente
// =============================================

(function (window) {
  'use strict';

  function dispatch(data) {
    window.dispatchEvent(new CustomEvent('__REQUEST_INSPECTOR__', { detail: data }));
  }

  function tryParseBody(body) {
    if (!body) return null;
    if (typeof body === 'string') {
      return body.length > 50000 ? body.substring(0, 50000) + '...[truncated]' : body;
    }
    if (body instanceof FormData) {
      const obj = {};
      body.forEach((v, k) => { obj[k] = v; });
      return JSON.stringify(obj);
    }
    if (body instanceof URLSearchParams) {
      return body.toString();
    }
    try { return JSON.stringify(body); } catch (e) { return String(body); }
  }

  // -----------------------------------------------
  // Interceptar XMLHttpRequest
  // -----------------------------------------------
  const OriginalXHR = window.XMLHttpRequest;

  function PatchedXHR() {
    const xhr = new OriginalXHR();
    let _method = 'GET';
    let _url = '';
    let _requestBody = null;
    let _startTime = null;

    const originalOpen = xhr.open.bind(xhr);
    const originalSend = xhr.send.bind(xhr);
    const originalSetRequestHeader = xhr.setRequestHeader.bind(xhr);

    const capturedHeaders = {};

    xhr.open = function (method, url, ...args) {
      _method = method;
      _url = url;
      _startTime = Date.now();
      return originalOpen(method, url, ...args);
    };

    xhr.setRequestHeader = function (name, value) {
      capturedHeaders[name] = value;
      return originalSetRequestHeader(name, value);
    };

    xhr.send = function (body) {
      _requestBody = tryParseBody(body);

      xhr.addEventListener('loadend', function () {
        try {
          const responseText = xhr.responseType === '' || xhr.responseType === 'text'
            ? xhr.responseText
            : '[non-text response: ' + xhr.responseType + ']';

          const trimmed = responseText && responseText.length > 100000
            ? responseText.substring(0, 100000) + '...[truncated]'
            : responseText;

          dispatch({
            source: 'XHR',
            method: _method,
            url: _url,
            status: xhr.status,
            statusText: xhr.statusText,
            requestBody: _requestBody,
            requestHeaders: capturedHeaders,
            body: trimmed,
            size: responseText ? responseText.length : 0,
            contentType: xhr.getResponseHeader('content-type') || '',
            timestamp: new Date().toISOString(),
            duration: Date.now() - _startTime
          });
        } catch (e) {}
      });

      return originalSend(body);
    };

    return xhr;
  }

  // Copia propriedades estáticas do XHR original
  Object.keys(OriginalXHR).forEach(key => {
    try { PatchedXHR[key] = OriginalXHR[key]; } catch (e) {}
  });
  PatchedXHR.prototype = OriginalXHR.prototype;

  window.XMLHttpRequest = PatchedXHR;

  // -----------------------------------------------
  // Interceptar Fetch API
  // -----------------------------------------------
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init = {}) {
    const startTime = Date.now();
    let url = '';
    let method = 'GET';
    let requestBody = null;
    let requestHeaders = {};

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
      method = input.method;
      // Clonar para ler o body
      try {
        const cloned = input.clone();
        requestBody = tryParseBody(await cloned.text());
      } catch (e) {}
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
      dispatch({
        source: 'FETCH',
        method,
        url,
        status: 0,
        statusText: 'Network Error',
        requestBody,
        requestHeaders,
        body: err.message,
        size: 0,
        contentType: '',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: err.message
      });
      throw err;
    }

    // Clonar response para ler o body sem consumir o original
    try {
      const cloned = response.clone();
      const contentType = response.headers.get('content-type') || '';
      let body = '';

      if (contentType.includes('json') || contentType.includes('text') || contentType.includes('xml') || contentType.includes('form')) {
        body = await cloned.text();
        if (body.length > 100000) body = body.substring(0, 100000) + '...[truncated]';
      } else {
        body = '[binary: ' + contentType + ']';
      }

      const responseHeaders = {};
      response.headers.forEach((v, k) => { responseHeaders[k] = v; });

      dispatch({
        source: 'FETCH',
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        requestBody,
        requestHeaders,
        responseHeaders,
        body,
        size: body.length,
        contentType,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      });
    } catch (e) {}

    return response;
  };

  // -----------------------------------------------
  // Interceptar navigator.sendBeacon
  // -----------------------------------------------
  const originalBeacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function (url, data) {
    dispatch({
      source: 'BEACON',
      method: 'POST',
      url,
      status: null,
      requestBody: tryParseBody(data),
      body: null,
      size: 0,
      contentType: '',
      timestamp: new Date().toISOString(),
      duration: 0
    });
    return originalBeacon(url, data);
  };

  console.log('[Request Inspector Pro] Page interceptors active');

})(window);
