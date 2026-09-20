// Privacy Shield Pro - Background Service Worker

// Configure WebRTC protection to prevent leaking local and non-proxied IP addresses
function applyWebRTCPrivacy() {
  if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
    chrome.privacy.network.webRTCIPHandlingPolicy.set({
      value: 'disable_non_proxied_udp'
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('WebRTC Policy Error:', chrome.runtime.lastError.message);
      } else {
        console.log('Privacy Shield: WebRTC leak protection active (disable_non_proxied_udp).');
      }
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  applyWebRTCPrivacy();
  // Generate initial identity seed
  chrome.storage.local.set({
    identitySeed: Math.floor(Math.random() * 1000000),
    clearedCount: 0,
    lastCleared: null
  });
});

chrome.runtime.onStartup.addListener(() => {
  applyWebRTCPrivacy();
});

// Message listener for data clearing and identity renewal
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearData') {
    const origin = request.origin;
    const newSeed = Math.floor(Math.random() * 1000000);

    const removalOptions = origin ? { origins: [origin] } : {};
    const dataToRemove = {
      cache: true,
      cookies: true,
      indexedDB: true,
      localStorage: true,
      webSQL: true,
      serviceWorkers: true
    };

    chrome.browsingData.remove(removalOptions, dataToRemove, () => {
      chrome.storage.local.get(['clearedCount'], (res) => {
        const count = (res.clearedCount || 0) + 1;
        chrome.storage.local.set({
          identitySeed: newSeed,
          clearedCount: count,
          lastCleared: new Date().toLocaleTimeString()
        }, () => {
          sendResponse({ success: true, newSeed: newSeed, clearedCount: count });
        });
      });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'getStatus') {
    chrome.storage.local.get(['identitySeed', 'clearedCount', 'lastCleared'], (res) => {
      sendResponse({
        identitySeed: res.identitySeed || 123456,
        clearedCount: res.clearedCount || 0,
        lastCleared: res.lastCleared || 'Nunca'
      });
    });
    return true;
  }
});
