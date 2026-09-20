// content.js — Bridge entre injected.js e background.js
// + Detector de frame 3DS (captura HTML e envia ao servidor local)
(function () {
  'use strict';

  // -----------------------------------------------
  // Injeta o script no contexto da página
  // -----------------------------------------------
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('injected.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);

  // -----------------------------------------------
  // Repassa steps do fluxo para o background
  // -----------------------------------------------
  window.addEventListener('__ELD_FLOW__', (e) => {
    const step = e.detail;
    if (step && step.url && (
      step.url.includes('eldorado.gg') ||
      step.url.includes('primer.io') ||
      step.url.includes('worldpay') ||
      step.url.includes('adyen') ||
      step.phase !== 'OTHER'
    )) {
      chrome.runtime.sendMessage({
        type: 'RESPONSE_BODY',
        url: step.url,
        body: step.responseBody || '',
        size: (step.responseBody || '').length,
        contentType: step.contentType || ''
      }).catch(() => {});
    }
  });

  // -----------------------------------------------
  // Resultado de replay — loga no console
  // -----------------------------------------------
  window.addEventListener('__ELD_REPLAY_RESULT__', (e) => {
    const r = e.detail;
    console.log(
      `%c[ELD REPLAY] ${r.ok ? '✔' : '✘'} ${r.status} — ${r.duration}ms`,
      `color: ${r.ok ? '#10b981' : '#ef4444'}; font-weight: bold`,
      r
    );
  });

  // -----------------------------------------------
  // Detector de página 3DS
  // Roda em TODOS os frames (all_frames: true).
  // Detecta se o frame atual é uma página de desafio bancário
  // e captura seu HTML completo para clonar no localhost.
  // -----------------------------------------------
  const DS3_PATTERNS = [
    /\/challenge/i,
    /\/threedssessiondata/i,
    /\/3ds/i,
    /\/authenticate/i,
    /\/acs\//i,
    /acs\./i,
    /visa\.com\/3ds/i,
    /mastercard\.com/i,
    /3dsecure/i,
    /verifiedbyvisa/i,
    /securecode/i,
    /santander/i,
    /bradesco/i,
    /itau/i,
    /cielo/i,
    /pagseguro.*3ds/i,
    /primer\.io.*challenge/i,
  ];

  const DS3_DOM_HINTS = [
    /autentique/i,
    /autenticação/i,
    /authentication/i,
    /confirme.*pagamento/i,
    /código.*sms/i,
    /código.*segurança/i,
    /one.time.password/i,
    /3d.secure/i,
    /verificar.*identidade/i,
    /card.*verification/i,
    /payment.*challenge/i,
    /enter.*otp/i,
  ];

  function detectBank(url) {
    const u = url.toLowerCase();
    if (u.includes('santander')) return 'Santander';
    if (u.includes('bradesco')) return 'Bradesco';
    if (u.includes('itau') || u.includes('itaú')) return 'Itaú';
    if (u.includes('cielo')) return 'Cielo';
    if (u.includes('pagseguro')) return 'PagSeguro';
    if (u.includes('rede.')) return 'Rede';
    if (u.includes('getnet')) return 'Getnet';
    if (u.includes('visa')) return 'Visa 3DS';
    if (u.includes('mastercard')) return 'Mastercard 3DS';
    if (u.includes('primer')) return 'Primer';
    return 'Desconhecido';
  }

  function isDS3Page() {
    const url = window.location.href;
    // Check URL
    if (DS3_PATTERNS.some(re => re.test(url))) return true;
    // Check DOM content (body text)
    const bodyText = document.body?.innerText || '';
    if (DS3_DOM_HINTS.some(re => re.test(bodyText))) return true;
    // Check if inside an iframe (window !== top) and URL differs from Eldorado
    if (window !== window.top && !url.includes('eldorado.gg') && !url.includes('localhost')) {
      // Se veio de um checkout do Eldorado, é candidato a ser 3DS
      return true;
    }
    return false;
  }

  function captureAndSend3DS() {
    const url = window.location.href;
    const bank = detectBank(url);
    const html = document.documentElement.outerHTML;

    const payload = {
      sourceUrl:   url,
      bank,
      capturedAt:  new Date().toISOString(),
      html,
      title:       document.title,
      frameDepth:  window === window.top ? 0 : 1,
    };

    // Envia para o servidor local via fetch (não depende de GM)
    fetch('http://localhost:7331/save-3ds', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    .then(r => r.json())
    .then(res => {
      if (res.ok) {
        console.log(
          `%c[ELD 3DS] Página clonada! Preview: ${res.previewUrl}`,
          'color:#a855f7;font-weight:bold;font-size:14px'
        );
        // Informa o background para exibir no popup
        chrome.runtime.sendMessage({
          type:     'DS3_CAPTURED',
          bank,
          sourceUrl: url,
          previewUrl: res.previewUrl,
          id:       res.id,
        }).catch(() => {});
      }
    })
    .catch(err => {
      console.warn('[ELD 3DS] Servidor local não encontrado. Inicie server.js com: node server.js', err.message);
    });
  }

  // Aguarda o DOM estar pronto e verifica se é página 3DS
  function tryDetect3DS() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryDetect3DS);
      return;
    }
    // Testa de forma debounced (página pode carregar conteúdo assincronamente)
    setTimeout(() => {
      if (isDS3Page()) {
        console.log(`%c[ELD 3DS] Página de desafio bancário detectada! Capturando...`, 'color:#a855f7;font-weight:bold');
        captureAndSend3DS();
      }
    }, 800); // Aguarda 800ms para garantir que o conteúdo dinâmico carregou
  }

  tryDetect3DS();

})();
