// =============================================
// REQUEST INSPECTOR PRO - Content Script
// Injeta interceptor no contexto da página
// =============================================

(function () {
  // Injeta o script no contexto da página para interceptar fetch/XHR
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // Ouve mensagens do script injetado
  window.addEventListener('__REQUEST_INSPECTOR__', (event) => {
    const data = event.detail;
    if (!data) return;

    chrome.runtime.sendMessage({
      type: 'RESPONSE_BODY',
      url: data.url,
      body: data.body,
      size: data.size,
      contentType: data.contentType,
      method: data.method,
      status: data.status,
      requestBody: data.requestBody,
      timestamp: data.timestamp
    }).catch(() => {});
  });
})();
