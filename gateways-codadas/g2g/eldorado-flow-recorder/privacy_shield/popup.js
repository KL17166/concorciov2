// Privacy Shield Pro - Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const seedVal = document.getElementById('seedVal');
  const cleanVal = document.getElementById('cleanVal');
  const clearBtn = document.getElementById('clearBtn');
  const feedback = document.getElementById('feedback');

  // Load initial status
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response) {
      if (seedVal) seedVal.textContent = '#' + response.identitySeed;
      if (cleanVal) cleanVal.textContent = response.clearedCount;
    }
  });

  // Handle Clear & Renew Action
  clearBtn.addEventListener('click', async () => {
    clearBtn.disabled = true;
    clearBtn.style.opacity = '0.7';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let origin = null;
      if (tab && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        const url = new URL(tab.url);
        origin = url.origin;
      }

      chrome.runtime.sendMessage({ action: 'clearData', origin: origin }, (response) => {
        clearBtn.disabled = false;
        clearBtn.style.opacity = '1';

        if (response && response.success) {
          if (seedVal) seedVal.textContent = '#' + response.newSeed;
          if (cleanVal) cleanVal.textContent = response.clearedCount;

          feedback.style.display = 'block';
          setTimeout(() => {
            feedback.style.display = 'none';
          }, 3500);

          // If on a webpage, reload the tab to immediately apply fresh storage & cookies
          if (tab && tab.id && origin) {
            chrome.tabs.reload(tab.id);
          }
        }
      });
    } catch (e) {
      clearBtn.disabled = false;
      clearBtn.style.opacity = '1';
      console.error('Privacy Shield action error:', e);
    }
  });
});
