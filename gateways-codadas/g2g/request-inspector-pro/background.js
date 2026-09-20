// =============================================
// REQUEST INSPECTOR PRO - Background Service Worker
// Auto-save persistente via chrome.alarms
// =============================================
console.log('[RIP] >>> Service Worker LOADING <<<');

const MAX_REQUESTS = 2000;
const SERVER_URL = 'http://localhost:7331';
const ALARM_NAME = 'auto-save';

let capturedRequests = {};
let isCapturing = true;
let sessionId = Date.now();

// -----------------------------------------------
// Ping imediato ao servidor ao iniciar
// Confirma que extensão + servidor estão conectados
// -----------------------------------------------
async function pingServer() {
  try {
    const resp = await fetch(`${SERVER_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        savedAt: new Date().toISOString(),
        auto: true,
        sessionId,
        startup: true,
        totalRequests: 0,
        requests: []
      })
    });
    if (resp.ok) {
      console.log('[Request Inspector] ✅ Conectado ao servidor — auto-save ativo');
    }
  } catch (e) {
    console.warn('[Request Inspector] ⚠ Servidor offline — inicie node server.js');
  }
}
pingServer();


// -----------------------------------------------
// Alarm para auto-save a cada 15 segundos
// (chrome.alarms funciona mesmo com popup fechado)
// -----------------------------------------------
chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.25 }); // ~15s

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    autoSaveToServer();
  }
});

async function autoSaveToServer() {
  const reqs = Object.values(capturedRequests);
  if (!reqs.length) return;

  const payload = {
    savedAt: new Date().toISOString(),
    auto: true,
    sessionId,
    totalRequests: reqs.length,
    requests: reqs
  };

  try {
    const resp = await fetch(`${SERVER_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      console.log(`[💾 Auto-save] OK — ${data.file} | ${reqs.length} reqs | ${data.paymentReqs} payment`);
    }
  } catch (err) {
    console.warn('[💾 Auto-save] Servidor offline:', err.message);
  }
}

// -----------------------------------------------
// Utilitários
// -----------------------------------------------
function generateId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch (e) { return str; }
}

function decodeBody(details) {
  if (!details.requestBody) return null;
  const body = details.requestBody;
  if (body.raw && body.raw.length > 0) {
    try {
      const bytes = new Uint8Array(body.raw[0].bytes);
      const text = new TextDecoder('utf-8').decode(bytes);
      return { type: 'raw', text, parsed: safeParseJSON(text) };
    } catch (e) {
      return { type: 'raw', text: '[binary data]', parsed: null };
    }
  }
  if (body.formData) {
    return { type: 'formData', data: body.formData };
  }
  return null;
}

function categorizeUrl(url) {
  const lower = url.toLowerCase();
  if (lower.includes('payment') || lower.includes('checkout') || lower.includes('order') ||
      lower.includes('cart') || lower.includes('purchase') || lower.includes('stripe') ||
      lower.includes('paypal') || lower.includes('cielo') || lower.includes('pagseguro') ||
      lower.includes('mercadopago') || lower.includes('adyen') || lower.includes('braintree') ||
      lower.includes('authorize') || lower.includes('card') || lower.includes('3ds') ||
      lower.includes('vbv') || lower.includes('acs') || lower.includes('mpi') ||
      lower.includes('fraud') || lower.includes('risk') || lower.includes('bin') ||
      lower.includes('pagar') || lower.includes('boleto') || lower.includes('pix')) {
    return 'PAYMENT';
  }
  if (lower.includes('api') || lower.includes('graphql') || lower.includes('rest')) return 'API';
  if (lower.includes('analytics') || lower.includes('gtm') || lower.includes('pixel') ||
      lower.includes('tracking') || lower.includes('facebook') || lower.includes('google-analytics')) {
    return 'ANALYTICS';
  }
  if (/\.(js|css|png|jpg|jpeg|gif|webp|woff|woff2|ttf|svg|ico)(\?|$)/.test(lower)) return 'STATIC';
  return 'OTHER';
}

// -----------------------------------------------
// Interceptação de Requisições
// -----------------------------------------------
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isCapturing) return;
    if (Object.keys(capturedRequests).length >= MAX_REQUESTS) {
      // Remove os mais antigos (10 de cada vez para não travar)
      const oldest = Object.keys(capturedRequests).slice(0, 10);
      oldest.forEach(k => delete capturedRequests[k]);
    }

    const body = decodeBody(details);
    capturedRequests[details.requestId] = {
      id: details.requestId,
      uid: generateId(),
      sessionId,
      timestamp: getTimestamp(),
      timestampMs: details.timeStamp,
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      frameId: details.frameId,
      category: categorizeUrl(details.url),
      requestBody: body,
      requestHeaders: {},
      responseHeaders: {},
      statusCode: null,
      statusLine: null,
      responseBody: null,
      error: null,
      timings: {
        start: details.timeStamp,
        headersSent: null,
        responseStart: null,
        end: null,
        duration: null
      },
      redirects: [],
      fromCache: false,
      ip: null,
      initiator: details.initiator || null
    };
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!isCapturing || !capturedRequests[details.requestId]) return;
    const req = capturedRequests[details.requestId];
    req.timings.headersSent = details.timeStamp;

    const headers = {};
    if (details.requestHeaders) {
      details.requestHeaders.forEach(h => { headers[h.name] = h.value; });
    }
    req.requestHeaders = headers;

    req.fingerprint = {
      userAgent: headers['User-Agent'] || headers['user-agent'],
      origin: headers['Origin'] || headers['origin'],
      referer: headers['Referer'] || headers['referer'],
      cookie: headers['Cookie']
        ? `[PRESENT - ${headers['Cookie'].length} chars]`
        : null,
      contentType: headers['Content-Type'] || headers['content-type'],
      accept: headers['Accept'] || headers['accept'],
      acceptLanguage: headers['Accept-Language'] || headers['accept-language'],
      xForwardedFor: headers['X-Forwarded-For'] || headers['x-forwarded-for'],
      authorization: headers['Authorization'] ? '[PRESENT]' : null,
      customHeaders: Object.keys(headers).filter(k =>
        k.toLowerCase().startsWith('x-') ||
        k.toLowerCase().startsWith('sec-') ||
        ['authorization', 'api-key', 'token', 'bearer'].some(t => k.toLowerCase().includes(t))
      )
    };
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!isCapturing || !capturedRequests[details.requestId]) return;
    const req = capturedRequests[details.requestId];
    req.statusCode = details.statusCode;
    req.statusLine = details.statusLine;
    req.timings.responseStart = details.timeStamp;
    req.fromCache = details.fromCache || false;

    const headers = {};
    if (details.responseHeaders) {
      details.responseHeaders.forEach(h => { headers[h.name] = h.value; });
    }
    req.responseHeaders = headers;

    req.securityHeaders = {
      contentSecurityPolicy: headers['content-security-policy'] || null,
      xFrameOptions: headers['x-frame-options'] || null,
      strictTransportSecurity: headers['strict-transport-security'] || null,
      setCookie: headers['set-cookie']
        ? `[PRESENT - ${headers['set-cookie'].length} chars]`
        : null,
      server: headers['server'] || null,
      xPoweredBy: headers['x-powered-by'] || null,
      location: headers['location'] || null,
      wwwAuthenticate: headers['www-authenticate'] || null,
      xRequestId: headers['x-request-id'] || headers['x-correlation-id'] || null,
      retryAfter: headers['retry-after'] || null
    };
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders', 'extraHeaders']
);

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    if (!capturedRequests[details.requestId]) return;
    capturedRequests[details.requestId].redirects.push({
      from: details.url,
      to: details.redirectUrl,
      statusCode: details.statusCode,
      timestamp: details.timeStamp
    });
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (!capturedRequests[details.requestId]) return;
    capturedRequests[details.requestId].ip = details.ip || null;
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
// Mensagens
// -----------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RESPONSE_BODY') {
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
    const filtered = message.filter === 'PAYMENT'
      ? all.filter(r => r.category === 'PAYMENT')
      : all;
    sendResponse({ requests: filtered, count: filtered.length });
    return true;
  }

  if (message.type === 'CLEAR_REQUESTS') {
    capturedRequests = {};
    sessionId = Date.now();
    sendResponse({ ok: true });
  }

  if (message.type === 'TOGGLE_CAPTURE') {
    isCapturing = !isCapturing;
    sendResponse({ capturing: isCapturing });
  }

  if (message.type === 'GET_STATUS') {
    sendResponse({
      capturing: isCapturing,
      count: Object.keys(capturedRequests).length,
      paymentCount: Object.values(capturedRequests).filter(r => r.category === 'PAYMENT').length,
      sessionId
    });
    return true;
  }

  if (message.type === 'SAVE_NOW') {
    autoSaveToServer().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'EXPORT_HAR') {
    const har = buildHAR(Object.values(capturedRequests));
    sendResponse({ har: JSON.stringify(har, null, 2) });
    return true;
  }

  return true;
});

// -----------------------------------------------
// HAR export
// -----------------------------------------------
function buildHAR(requests) {
  return {
    log: {
      version: '1.2',
      creator: { name: 'Request Inspector Pro', version: '1.0.0' },
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
          statusText: req.statusLine || '',
          headers: Object.entries(req.responseHeaders || {}).map(([name, value]) => ({ name, value })),
          content: {
            size: req.responseBody ? req.responseBody.size : -1,
            mimeType: req.responseHeaders?.['content-type'] || '',
            text: req.responseBody ? req.responseBody.text : ''
          },
          redirectURL: req.redirects?.length > 0
            ? req.redirects[req.redirects.length - 1].to : '',
          headersSize: -1,
          bodySize: -1
        },
        cache: {},
        timings: { send: 0, wait: req.timings.duration || 0, receive: 0 },
        serverIPAddress: req.ip || '',
        _category: req.category,
        _error: req.error
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
  } catch (e) { return []; }
}

// -----------------------------------------------
// Bloqueador de Anti-Fraude (declarativeNetRequest)
// Log das regras que estão sendo aplicadas
// -----------------------------------------------
let blockedLog = [];
let blockedCount = 0;

const RULE_NAMES = {
  1: 'Forter CDN',
  2: 'Forter (all)',
  3: 'Nsure SDK',
  4: 'Nsure (all)',
  5: 'Clarity',
  6: 'Clarity (all)',
  7: 'Bing Tracking',
  8: 'TikTok Pixel',
  9: 'Facebook Pixel',
  10: 'DoubleClick Ads',
  11: 'Proxy Headers (Eldorado)',
  12: 'Proxy Headers (Primer)'
};

// Log quando uma regra bloqueia algo
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    blockedCount++;
    const entry = {
      timestamp: new Date().toISOString(),
      ruleId: info.rule.ruleId,
      ruleName: RULE_NAMES[info.rule.ruleId] || 'Unknown',
      url: info.request.url.substring(0, 150),
      method: info.request.method,
      tabId: info.request.tabId
    };
    blockedLog.push(entry);
    if (blockedLog.length > 200) blockedLog.shift();
    console.log(`[🛡️ BLOCKED] Rule ${info.rule.ruleId} (${entry.ruleName}) → ${entry.url}`);
  });
}

// Handler de mensagem para o popup pegar info de bloqueio
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_BLOCK_STATUS') {
    chrome.declarativeNetRequest.getEnabledRulesets().then((rulesets) => {
      sendResponse({
        blocking: rulesets.includes('block_antifraud'),
        blockedCount,
        recentBlocks: blockedLog.slice(-20).reverse(),
        rules: Object.keys(RULE_NAMES).length,
        rulesets
      });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_BLOCKING') {
    chrome.declarativeNetRequest.getEnabledRulesets().then((rulesets) => {
      if (rulesets.includes('block_antifraud')) {
        chrome.declarativeNetRequest.updateEnabledRulesets({
          disableRulesetIds: ['block_antifraud']
        }).then(() => {
          console.log('[🛡️] Bloqueio DESATIVADO');
          sendResponse({ blocking: false });
        });
      } else {
        chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: ['block_antifraud']
        }).then(() => {
          console.log('[🛡️] Bloqueio ATIVADO');
          sendResponse({ blocking: true });
        });
      }
    });
    return true;
  }

  return true;
});

console.log('[Request Inspector Pro] Background worker started');
console.log('[🛡️ Blocker] Regras de bloqueio carregadas: Forter, Nsure, Clarity, tracking pixels');
console.log('[🛡️ Blocker] Headers de proxy serão removidos para Eldorado e Primer');
