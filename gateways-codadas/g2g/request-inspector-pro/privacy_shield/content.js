// Privacy Shield Pro - Content Script Injector with Total Cloudflare Challenge Exemption

(function() {
  'use strict';

  // Check if current page is a Cloudflare Challenge / Turnstile verification page
  function isCloudflareChallengePage() {
    try {
      const loc = window.location;
      const href = loc.href || '';
      const host = loc.hostname || '';
      const path = loc.pathname || '';

      // 1. URL pattern checks
      if (
        href.includes('__cf_chl_') ||
        href.includes('__cf_chl_tk') ||
        href.includes('__cf_chl_rt_tk') ||
        href.includes('__cf_chl_f_tk') ||
        host.includes('challenges.cloudflare.com') ||
        path.includes('/cdn-cgi/challenge-platform') ||
        path.includes('/cdn-cgi/turnstile')
      ) {
        return true;
      }

      // 2. Cloudflare global object check
      if (window._cf_chl_opt || window._cf_chl_ctx) {
        return true;
      }

      // 3. Document Title / HTML check
      if (document.title && document.title.includes('Just a moment')) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  // If on a Cloudflare challenge page, do NOT inject anything.
  // Allow real Chrome environment to solve proof-of-work instantly.
  if (isCloudflareChallengePage()) {
    console.log('🛡️ Privacy Shield: Desafio Cloudflare detectado. Injeção suspensa para passagem instantânea.');
    return;
  }

  function inject() {
    if (isCloudflareChallengePage()) return;

    try {
      const container = document.head || document.documentElement;
      if (!container) return;

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.dataset.source = 'privacy-shield-pro';

      container.insertBefore(script, container.firstChild);
      script.onload = function() {
        script.remove();
      };
    } catch (e) {
      console.warn('Privacy Shield injection error:', e);
    }
  }

  // Inject immediately
  inject();

  // If documentElement is not yet available, wait for readyState
  if (!document.documentElement) {
    document.addEventListener('readystatechange', () => {
      if (document.documentElement && !document.querySelector('script[data-source="privacy-shield-pro"]')) {
        inject();
      }
    }, { once: true });
  }
})();
