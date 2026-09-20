// =============================================
// ELDORADO FLOW RECORDER - Background v2
// =============================================
'use strict';

let lastDS3Capture = null; // Armazena o último clone 3DS capturado

let capturedRequests = {};
let isCapturing = true;
let sessionId = Date.now();

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// -----------------------------------------------
// webRequest listeners — captura headers/status
// -----------------------------------------------
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isCapturing) return;
    const body = details.requestBody;
    let bodyText = null;
    if (body) {
      if (body.raw) {
        try {
          const decoder = new TextDecoder('utf-8');
          bodyText = decoder.decode(body.raw.map(r => new Uint8Array(r.bytes)).reduce((a, b) => {
            const c = new Uint8Array(a.length + b.length);
            c.set(a); c.set(b, a.length); return c;
          }));
        } catch (_) {}
      } else if (body.formData) {
        bodyText = JSON.stringify(body.formData);
      }
    }
    capturedRequests[details.requestId] = {
      id:           details.requestId,
      url:          details.url,
      method:       details.method,
      timestamp:    new Date().toISOString(),
      tabId:        details.tabId,
      requestBody:  bodyText ? { text: bodyText, parsed: safeParseJSON(bodyText) } : null,
      requestHeaders: {},
      responseHeaders: {},
      statusCode:   null,
      redirects:    [],
      timings:      { start: details.timeStamp },
      responseBody: null,
      fromCache:    false,
      ip:           null,
      error:        null,
    };
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!capturedRequests[details.requestId]) return;
    const h = {};
    (details.requestHeaders || []).forEach(({ name, value }) => { h[name.toLowerCase()] = value; });
    capturedRequests[details.requestId].requestHeaders = h;
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!capturedRequests[details.requestId]) return;
    const h = {};
    (details.responseHeaders || []).forEach(({ name, value }) => { h[name.toLowerCase()] = value; });
    capturedRequests[details.requestId].responseHeaders = h;
    capturedRequests[details.requestId].statusCode = details.statusCode;
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders', 'extraHeaders']
);

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    if (!capturedRequests[details.requestId]) return;
    capturedRequests[details.requestId].redirects.push({
      from: details.url, to: details.redirectUrl,
      statusCode: details.statusCode, timestamp: details.timeStamp
    });
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!capturedRequests[details.requestId]) return;
    const req = capturedRequests[details.requestId];
    req.timings.end = details.timeStamp;
    req.timings.duration = details.timeStamp - req.timings.start;
    req.statusCode = details.statusCode;
    req.fromCache = details.fromCache || false;
    req.ip = details.ip || req.ip;
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!capturedRequests[details.requestId]) return;
    const req = capturedRequests[details.requestId];
    req.error = details.error;
    req.timings.end = details.timeStamp;
    req.timings.duration = details.timeStamp - req.timings.start;
  },
  { urls: ['<all_urls>'] }
);

// -----------------------------------------------
// Mensagens do content/popup
// -----------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RESPONSE_BODY') {
    // Recebido do injected.js via content.js
    const entry = Object.values(capturedRequests).find(r =>
      r.url === message.url && r.responseBody === null
    );
    if (entry) {
      entry.responseBody = {
        text: message.body,
        size: message.size,
        parsed: safeParseJSON(message.body),
        contentType: message.contentType
      };
    }
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_REQUESTS') {
    const all = Object.values(capturedRequests);
    const domain = message.domain || 'eldorado.gg';
    const filtered = all.filter(r => r.url.includes(domain) || r.url.includes('primer.io'));
    sendResponse({ requests: filtered, count: filtered.length });
    return true;
  }

  if (message.type === 'CLEAR_REQUESTS') {
    capturedRequests = {};
    sessionId = Date.now();
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_STATUS') {
    const all = Object.values(capturedRequests);
    sendResponse({
      capturing: isCapturing,
      count: all.length,
      eldoradoCount: all.filter(r => r.url.includes('eldorado.gg') || r.url.includes('primer.io')).length,
      sessionId
    });
    return true;
  }

  if (message.type === 'TOGGLE_CAPTURE') {
    isCapturing = !isCapturing;
    sendResponse({ capturing: isCapturing });
  }

  if (message.type === 'EXPORT_HAR') {
    const har = buildHAR(Object.values(capturedRequests));
    sendResponse({ har: JSON.stringify(har, null, 2) });
    return true;
  }

  // Replay: executa fetch dentro de uma aba ativa do Eldorado
  if (message.type === 'REPLAY_IN_BROWSER') {
    const { tabId, step } = message;
    chrome.scripting.executeScript({
      target: { tabId },
      func: (replayPayload) => {
        window.dispatchEvent(new CustomEvent('__ELD_REPLAY_CMD__', { detail: replayPayload }));
      },
      args: [{ replayId: step.replayId, method: step.method, url: step.url, headers: step.requestHeaders, body: step.requestBody }]
    }).then(() => sendResponse({ ok: true, tabId }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // 3DS: content.js notifica quando clona uma página de desafio bancário
  if (message.type === 'DS3_CAPTURED') {
    lastDS3Capture = {
      bank:       message.bank,
      sourceUrl:  message.sourceUrl,
      previewUrl: message.previewUrl,
      id:         message.id,
      capturedAt: new Date().toISOString(),
    };
    console.log(`[🔐 3DS] Clonado: ${message.bank} — ${message.previewUrl}`);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_DS3') {
    sendResponse({ capture: lastDS3Capture });
    return true;
  }

  // Bloquio de anti-fraude
  if (message.type === 'GET_BLOCK_STATUS') {
    chrome.declarativeNetRequest.getEnabledRulesets().then((rulesets) => {
      sendResponse({ blocking: rulesets.includes('block_antifraud'), rulesets });
    });
    return true;
  }

  if (message.type === 'TOGGLE_BLOCKING') {
    chrome.declarativeNetRequest.getEnabledRulesets().then((rulesets) => {
      const isOn = rulesets.includes('block_antifraud');
      chrome.declarativeNetRequest.updateEnabledRulesets({
        [isOn ? 'disableRulesetIds' : 'enableRulesetIds']: ['block_antifraud']
      }).then(() => sendResponse({ blocking: !isOn }));
    });
    return true;
  }

  return true;
});

// -----------------------------------------------
// HAR Export
// -----------------------------------------------
function buildHAR(requests) {
  return {
    log: {
      version: '1.2',
      creator: { name: 'Eldorado Flow Recorder', version: '2.0.0' },
      entries: requests.map(req => ({
        startedDateTime: req.timestamp,
        time: req.timings.duration || 0,
        request: {
          method: req.method,
          url: req.url,
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(req.requestHeaders || {}).map(([name, value]) => ({ name, value })),
          queryString: parseQueryString(req.url),
          postData: req.requestBody ? {
            mimeType: req.requestHeaders?.['content-type'] || '',
            text: req.requestBody.text || JSON.stringify(req.requestBody.data || {})
          } : undefined,
          headersSize: -1,
          bodySize: req.requestBody ? (req.requestBody.text || '').length : 0
        },
        response: {
          status: req.statusCode || 0,
          statusText: '',
          headers: Object.entries(req.responseHeaders || {}).map(([name, value]) => ({ name, value })),
          content: {
            size: req.responseBody?.size || -1,
            mimeType: req.responseHeaders?.['content-type'] || '',
            text: req.responseBody?.text || ''
          },
          redirectURL: req.redirects?.length > 0 ? req.redirects[req.redirects.length - 1].to : '',
          headersSize: -1,
          bodySize: -1
        },
        cache: {},
        timings: { send: 0, wait: req.timings.duration || 0, receive: 0 },
        serverIPAddress: req.ip || ''
      }))
    }
  };
}

function parseQueryString(url) {
  try {
    const u = new URL(url);
    const result = [];
    u.searchParams.forEach((value, name) => result.push({ name, value }));
    return result;
  } catch { return []; }
}

console.log('[Eldorado Flow Recorder v2] Background worker started');
