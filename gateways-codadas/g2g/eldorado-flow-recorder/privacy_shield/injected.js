// Privacy Shield Pro v5.0 (Deep Coherence & Advanced Vector Engine)
// Comprehensive JS-level defense covering Canvas (Pixels + TextMetrics), WebGL/WebGPU,
// Audio, SVG, WebWorkers, ClientRects, and Stack Sanitization with Cloudflare Exemption.

(function() {
  'use strict';

  // =========================================================================
  // 0. ABSOLUTE CLOUDFLARE CHALLENGE & TURNSTILE BYPASS
  // =========================================================================
  function isCloudflareChallenge() {
    try {
      const loc = window.location;
      const href = loc.href || '';
      const host = loc.hostname || '';
      const path = loc.pathname || '';

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

      if (window._cf_chl_opt || window._cf_chl_ctx || window._cf_chl_enter) {
        return true;
      }

      if (document.title && document.title.includes('Just a moment')) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  // If on a Cloudflare challenge page, halt immediately
  if (isCloudflareChallenge()) {
    console.log('🛡️ Privacy Shield: Página Cloudflare ("Just a moment...") detectada. Mascaramento suspenso.');
    return;
  }

  if (window.__privacyShieldInitialized) return;
  window.__privacyShieldInitialized = true;

  function isCloudflareCaller() {
    try {
      if (isCloudflareChallenge()) return true;
      const stack = new Error().stack || '';
      return (
        stack.includes('cloudflare.com') ||
        stack.includes('challenges.cloudflare') ||
        stack.includes('/cdn-cgi/challenge-platform') ||
        stack.includes('turnstile') ||
        stack.includes('cf-challenge') ||
        stack.includes('cloudflareinsights')
      );
    } catch (e) {
      return false;
    }
  }

  function isCloudflareCanvas(canvas) {
    if (isCloudflareCaller()) return true;
    if (!canvas) return false;
    try {
      const id = (canvas.id || '') + ' ' + (canvas.className || '');
      if (id.includes('cf-') || id.includes('turnstile') || id.includes('cloudflare')) return true;
      let parent = canvas.parentElement;
      let depth = 0;
      while (parent && depth < 6) {
        const pid = (parent.id || '') + ' ' + (parent.className || '');
        if (pid.includes('cf-') || pid.includes('turnstile') || pid.includes('challenge')) return true;
        parent = parent.parentElement;
        depth++;
      }
    } catch (e) {}
    return false;
  }

  // =========================================================================
  // 1. STEALTH INFRASTRUCTURE: makeNative & Stack Trace Sanitizer
  // =========================================================================
  const nativeFunctions = new Map();
  const origFunctionToString = Function.prototype.toString;

  const customToString = function toString() {
    if (typeof this === 'function' && nativeFunctions.has(this)) {
      return nativeFunctions.get(this);
    }
    return origFunctionToString.apply(this, arguments);
  };

  nativeFunctions.set(customToString, 'function toString() { [native code] }');
  Function.prototype.toString = customToString;

  function makeNative(fn, name = '', isGetter = false) {
    const fnName = name || fn.name || '';
    const prefix = isGetter ? 'get ' : '';
    const nativeStr = `function ${prefix}${fnName}() { [native code] }`;
    nativeFunctions.set(fn, nativeStr);
    try {
      Object.defineProperty(fn, 'name', { value: fnName, configurable: true });
    } catch (e) {}
    return fn;
  }

  // Clean error stack traces so anti-fraud scripts (CreepJS/Forter) cannot detect extension wrappers
  try {
    const origStackGetter = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
    if (origStackGetter && origStackGetter.get) {
      Object.defineProperty(Error.prototype, 'stack', {
        get: makeNative(function() {
          const stack = origStackGetter.get.call(this);
          if (typeof stack !== 'string') return stack;
          return stack
            .split('\n')
            .filter(line => !line.includes('privacy_shield') && !line.includes('injected.js') && !line.includes('makeNative'))
            .join('\n');
        }, 'stack', true),
        configurable: true
      });
    }
  } catch (e) {}

  // =========================================================================
  // 2. DETERMINISTIC SESSION SEED (Brave-style Farbling)
  // =========================================================================
  function getSessionSeed() {
    let hash = 0;
    const str = (window.location.hostname || 'domain') + (sessionStorage.getItem('ps_shield_seed') || '789123');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 12345;
  }

  const SEED = getSessionSeed();
  function pseudoRandom(offset = 0) {
    const x = Math.sin(SEED + offset) * 10000;
    return x - Math.floor(x);
  }

  // Code to bootstrap Web Workers with identical hardware spoofing
  const WORKER_BOOTSTRAP_CODE = `
    (function() {
      try {
        const SEED = ${SEED};
        function makeNative(fn, name, isGetter) {
          try { Object.defineProperty(fn, 'name', { value: name || '', configurable: true }); } catch(e){}
          return fn;
        }

        const navProto = typeof WorkerNavigator !== 'undefined' ? WorkerNavigator.prototype : null;
        if (navProto) {
          Object.defineProperty(navProto, 'hardwareConcurrency', { get: makeNative(() => 8, 'hardwareConcurrency', true), configurable: true, enumerable: true });
          Object.defineProperty(navProto, 'deviceMemory', { get: makeNative(() => 16, 'deviceMemory', true), configurable: true, enumerable: true });
          Object.defineProperty(navProto, 'languages', { get: makeNative(() => Object.freeze(['pt-BR', 'pt', 'en-US', 'en']), 'languages', true), configurable: true, enumerable: true });
          Object.defineProperty(navProto, 'language', { get: makeNative(() => 'pt-BR', 'language', true), configurable: true, enumerable: true });
          Object.defineProperty(navProto, 'platform', { get: makeNative(() => 'Win32', 'platform', true), configurable: true, enumerable: true });
          Object.defineProperty(navProto, 'webdriver', { get: makeNative(() => false, 'webdriver', true), configurable: true, enumerable: true });
        }

        if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
          const origGetImageData = OffscreenCanvasRenderingContext2D.prototype.getImageData;
          OffscreenCanvasRenderingContext2D.prototype.getImageData = makeNative(function(sx, sy, sw, sh) {
            const imgData = origGetImageData.apply(this, arguments);
            const data = imgData.data;
            const len = data.length;
            const step = Math.max(4, Math.floor(len / 32));
            for (let i = 0; i < len; i += step) {
              if (data[i + 3] > 10) {
                const shift = ((i + SEED) % 3) - 1;
                data[i] = Math.min(255, Math.max(0, data[i] + shift));
              }
            }
            return imgData;
          }, 'getImageData', false);
        }
      } catch(e){}
    })();
  `;

  // =========================================================================
  // 3. CORE MULTI-VECTOR STEALTH SUITE (PROTOTYPE-ONLY INJECTION)
  // =========================================================================
  function applyStealthToContext(targetWindow) {
    if (!targetWindow || targetWindow.__ps_context_patched) return;

    try {
      const h = targetWindow.location.hostname || '';
      const p = targetWindow.location.pathname || '';
      if (h.includes('cloudflare.com') || p.includes('/cdn-cgi/challenge-platform')) {
        return;
      }
    } catch (e) {}

    targetWindow.__ps_context_patched = true;

    // -----------------------------------------------------------------------
    // A. WINDOW.CHROME FIDELITY MOCK
    // -----------------------------------------------------------------------
    try {
      if (!targetWindow.chrome) {
        targetWindow.chrome = {};
      }
      const c = targetWindow.chrome;
      c.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getIsInstalled: makeNative(() => false, 'getIsInstalled', false),
        getDetails: makeNative(() => null, 'getDetails', false),
        getRunningState: makeNative(() => 'cannot_run', 'getRunningState', false)
      };
      c.csi = makeNative(function csi() {
        return {
          startE: Date.now() - 3000,
          onloadT: Date.now() - 500,
          pageT: 1200 + (SEED % 400),
          tran: 15
        };
      }, 'csi', false);
      c.loadTimes = makeNative(function loadTimes() {
        const now = Date.now() / 1000;
        return {
          requestTime: now - 3.0,
          startLoadTime: now - 2.8,
          commitLoadTime: now - 2.2,
          finishDocumentLoadTime: now - 0.8,
          firstPaintTime: now - 1.2,
          finishLoadTime: now - 0.5,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2'
        };
      }, 'loadTimes', false);
    } catch (e) {}

    // -----------------------------------------------------------------------
    // B. NAVIGATOR PROTOTYPE OVERRIDES
    // -----------------------------------------------------------------------
    try {
      const navProto = targetWindow.Navigator ? targetWindow.Navigator.prototype : null;
      if (navProto) {
        Object.defineProperty(navProto, 'webdriver', {
          get: makeNative(() => false, 'webdriver', true),
          configurable: true,
          enumerable: true
        });

        Object.defineProperty(navProto, 'hardwareConcurrency', {
          get: makeNative(() => 8, 'hardwareConcurrency', true),
          configurable: true,
          enumerable: true
        });

        Object.defineProperty(navProto, 'deviceMemory', {
          get: makeNative(() => 16, 'deviceMemory', true),
          configurable: true,
          enumerable: true
        });

        const languages = Object.freeze(['pt-BR', 'pt', 'en-US', 'en']);
        Object.defineProperty(navProto, 'languages', {
          get: makeNative(() => languages, 'languages', true),
          configurable: true,
          enumerable: true
        });

        Object.defineProperty(navProto, 'language', {
          get: makeNative(() => 'pt-BR', 'language', true),
          configurable: true,
          enumerable: true
        });

        Object.defineProperty(navProto, 'platform', {
          get: makeNative(() => 'Win32', 'platform', true),
          configurable: true,
          enumerable: true
        });

        Object.defineProperty(navProto, 'maxTouchPoints', {
          get: makeNative(() => 0, 'maxTouchPoints', true),
          configurable: true,
          enumerable: true
        });

        // Network Information API on Navigator.prototype
        try {
          Object.defineProperty(navProto, 'connection', {
            get: makeNative(() => ({
              effectiveType: '4g',
              rtt: 40 + (SEED % 25),
              downlink: 15.5 + (SEED % 5),
              saveData: false,
              onchange: null,
              addEventListener: makeNative(() => {}, 'addEventListener', false),
              removeEventListener: makeNative(() => {}, 'removeEventListener', false),
              dispatchEvent: makeNative(() => false, 'dispatchEvent', false)
            }), 'connection', true),
            configurable: true,
            enumerable: true
          });
        } catch (e) {}

        // Mock navigator.plugins on Navigator.prototype (Chrome PDF Viewer)
        try {
          const createPlugin = (name, filename, description) => {
            return { name, filename, description, length: 0 };
          };

          const mockPlugins = [
            createPlugin('PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
            createPlugin('Chrome PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
            createPlugin('Chromium PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
            createPlugin('Microsoft Edge PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
            createPlugin('WebKit built-in PDF', 'internal-pdf-viewer', 'Portable Document Format')
          ];

          Object.defineProperty(navProto, 'plugins', {
            get: makeNative(() => {
              const pluginArray = Object.create(PluginArray.prototype);
              mockPlugins.forEach((p, i) => {
                pluginArray[i] = p;
                pluginArray[p.name] = p;
              });
              Object.defineProperty(pluginArray, 'length', { value: mockPlugins.length });
              pluginArray.item = makeNative((index) => mockPlugins[index] || null, 'item', false);
              pluginArray.namedItem = makeNative((name) => mockPlugins.find(p => p.name === name) || null, 'namedItem', false);
              pluginArray.refresh = makeNative(() => {}, 'refresh', false);
              return pluginArray;
            }, 'plugins', true),
            configurable: true,
            enumerable: true
          });
        } catch (e) {}

        // Battery API on Navigator.prototype
        if (navProto.getBattery) {
          navProto.getBattery = makeNative(function getBattery() {
            return Promise.resolve({
              charging: true,
              chargingTime: 0,
              dischargingTime: Infinity,
              level: 1.0,
              onchargingchange: null,
              onchargingtimechange: null,
              ondischargingtimechange: null,
              onlevelchange: null,
              addEventListener: makeNative(function addEventListener() {}, 'addEventListener', false),
              removeEventListener: makeNative(function removeEventListener() {}, 'removeEventListener', false),
              dispatchEvent: makeNative(function dispatchEvent() { return false; }, 'dispatchEvent', false)
            });
          }, 'getBattery', false);
        }
      }

      // MediaDevices Mock (Physical Desktop Devices)
      const mediaDevProto = targetWindow.MediaDevices ? targetWindow.MediaDevices.prototype : null;
      if (mediaDevProto && mediaDevProto.enumerateDevices) {
        const fakeDevices = [
          { deviceId: 'default', kind: 'audioinput', label: '', groupId: 'group_audio_in' },
          { deviceId: 'communications', kind: 'audioinput', label: '', groupId: 'group_audio_in' },
          { deviceId: 'default', kind: 'audiooutput', label: '', groupId: 'group_audio_out' },
          { deviceId: 'communications', kind: 'audiooutput', label: '', groupId: 'group_audio_out' },
          { deviceId: 'camera_01', kind: 'videoinput', label: '', groupId: 'group_video_in' }
        ];

        mediaDevProto.enumerateDevices = makeNative(function enumerateDevices() {
          return Promise.resolve(fakeDevices);
        }, 'enumerateDevices', false);
      }

      // UserAgentData Client Hints
      const uadProto = targetWindow.NavigatorUAData ? targetWindow.NavigatorUAData.prototype : null;
      if (uadProto && uadProto.getHighEntropyValues) {
        const origGetHEV = uadProto.getHighEntropyValues;
        uadProto.getHighEntropyValues = makeNative(function getHighEntropyValues(hints) {
          return origGetHEV.call(this, hints).then(res => {
            if (res) {
              res.architecture = 'x86';
              res.bitness = '64';
              res.model = '';
              res.platform = 'Windows';
              res.platformVersion = '15.0.0';
            }
            return res;
          });
        }, 'getHighEntropyValues', false);
      }

      // WebGPU Hardware Mocking (Matching NVIDIA RTX 3060)
      if (targetWindow.GPU && targetWindow.GPU.prototype.requestAdapter) {
        const origReqAdapter = targetWindow.GPU.prototype.requestAdapter;
        targetWindow.GPU.prototype.requestAdapter = makeNative(function requestAdapter(options) {
          return origReqAdapter.apply(this, arguments).then(adapter => {
            if (adapter && adapter.requestAdapterInfo) {
              const origReqInfo = adapter.requestAdapterInfo;
              adapter.requestAdapterInfo = makeNative(function requestAdapterInfo() {
                return origReqInfo.apply(this, arguments).then(info => {
                  return {
                    vendor: 'nvidia',
                    architecture: 'ampere',
                    device: 'NVIDIA GeForce RTX 3060',
                    description: 'NVIDIA GeForce RTX 3060 (Direct3D11)'
                  };
                });
              }, 'requestAdapterInfo', false);
            }
            return adapter;
          });
        }, 'requestAdapter', false);
      }
    } catch (e) {}

    // -----------------------------------------------------------------------
    // C. SCREEN PROTOTYPE OVERRIDES
    // -----------------------------------------------------------------------
    try {
      const scrProto = targetWindow.Screen ? targetWindow.Screen.prototype : null;
      if (scrProto) {
        const screenSpecs = {
          width: 1920,
          height: 1080,
          availWidth: 1920,
          availHeight: 1040,
          colorDepth: 24,
          pixelDepth: 24
        };

        for (const [prop, val] of Object.entries(screenSpecs)) {
          Object.defineProperty(scrProto, prop, {
            get: makeNative(() => val, prop, true),
            configurable: true,
            enumerable: true
          });
        }
      }
    } catch (e) {}

    // -----------------------------------------------------------------------
    // D. WEBGL & WEBGL2 HARDWARE MASQUERADE (NVIDIA RTX 3060 Direct3D11)
    // -----------------------------------------------------------------------
    try {
      const MASK_VENDOR = 'Google Inc. (NVIDIA)';
      const MASK_RENDERER = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

      const webglParams = {
        37445: MASK_VENDOR,                                                // UNMASKED_VENDOR_WEBGL
        37446: MASK_RENDERER,                                              // UNMASKED_RENDERER_WEBGL
        7936: 'WebKit',                                                    // VENDOR
        7937: 'WebKit WebGL',                                              // RENDERER
        7938: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',                        // VERSION
        35724: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',      // SHADING_LANGUAGE_VERSION
        3379: 16384,                                                       // MAX_TEXTURE_SIZE
        34076: 16384,                                                      // MAX_CUBE_MAP_TEXTURE_SIZE
        34024: 16384,                                                      // MAX_RENDERBUFFER_SIZE
        34921: 16,                                                         // MAX_VERTEX_ATTRIBS
        34930: 32,                                                         // MAX_COMBINED_TEXTURE_IMAGE_UNITS
        34929: 16                                                          // MAX_TEXTURE_IMAGE_UNITS
      };

      function patchGL(proto) {
        if (!proto || !proto.getParameter) return;
        const origGetParam = proto.getParameter;
        proto.getParameter = makeNative(function getParameter(param) {
          if (webglParams[param] !== undefined) {
            return webglParams[param];
          }
          return origGetParam.apply(this, arguments);
        }, 'getParameter', false);

        if (proto.readPixels) {
          const origReadPixels = proto.readPixels;
          proto.readPixels = makeNative(function readPixels(x, y, w, h, format, type, pixels) {
            origReadPixels.apply(this, arguments);
            if (isCloudflareCaller()) return;

            if (pixels && pixels.length > 0) {
              const step = Math.max(1, Math.floor(pixels.length / 25));
              for (let i = 0; i < pixels.length; i += step) {
                pixels[i] = (pixels[i] ^ (SEED & 0x01)) & 0xFF;
              }
            }
          }, 'readPixels', false);
        }
      }

      if (targetWindow.WebGLRenderingContext) patchGL(targetWindow.WebGLRenderingContext.prototype);
      if (targetWindow.WebGL2RenderingContext) patchGL(targetWindow.WebGL2RenderingContext.prototype);
    } catch (e) {}

    // -----------------------------------------------------------------------
    // E. CANVAS 2D, OFFSCREENCANVAS & TEXTMETRICS (measureText Farbling)
    // -----------------------------------------------------------------------
    try {
      const ctx2D = targetWindow.CanvasRenderingContext2D ? targetWindow.CanvasRenderingContext2D.prototype : null;
      const offscreenCtx2D = targetWindow.OffscreenCanvasRenderingContext2D ? targetWindow.OffscreenCanvasRenderingContext2D.prototype : null;
      const canvasEl = targetWindow.HTMLCanvasElement ? targetWindow.HTMLCanvasElement.prototype : null;
      const offscreenEl = targetWindow.OffscreenCanvas ? targetWindow.OffscreenCanvas.prototype : null;

      function applyCanvasFarbling(proto) {
        if (!proto) return;

        if (proto.getImageData) {
          const origGetImageData = proto.getImageData;
          proto.getImageData = makeNative(function getImageData(sx, sy, sw, sh) {
            const imgData = origGetImageData.apply(this, arguments);
            if (isCloudflareCanvas(this.canvas) || isCloudflareCaller()) {
              return imgData;
            }

            const data = imgData.data;
            const len = data.length;
            const step = Math.max(4, Math.floor(len / 32));
            for (let i = 0; i < len; i += step) {
              if (data[i + 3] > 10) {
                const shift = ((i + SEED) % 3) - 1;
                data[i] = Math.min(255, Math.max(0, data[i] + shift));
              }
            }
            return imgData;
          }, 'getImageData', false);
        }

        // Font Fingerprinting via measureText (TextMetrics Farbling)
        if (proto.measureText) {
          const origMeasureText = proto.measureText;
          proto.measureText = makeNative(function measureText(text) {
            const metrics = origMeasureText.apply(this, arguments);
            if (isCloudflareCaller()) return metrics;

            const shift = (SEED % 2 === 0 ? 0.01 : -0.01);
            try {
              // Perturb width slightly to prevent font enumeration
              Object.defineProperty(metrics, 'width', {
                value: metrics.width + shift,
                configurable: true,
                enumerable: true
              });
            } catch (err) {}
            return metrics;
          }, 'measureText', false);
        }
      }

      applyCanvasFarbling(ctx2D);
      applyCanvasFarbling(offscreenCtx2D);

      if (canvasEl) {
        if (canvasEl.toDataURL) {
          const origToDataURL = canvasEl.toDataURL;
          canvasEl.toDataURL = makeNative(function toDataURL() {
            if (isCloudflareCanvas(this) || isCloudflareCaller()) {
              return origToDataURL.apply(this, arguments);
            }

            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              try {
                const img = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
                if (img.data.length >= 4) {
                  img.data[0] = (img.data[0] ^ (SEED & 0x01));
                  ctx.putImageData(img, 0, 0);
                }
              } catch (err) {}
            }
            return origToDataURL.apply(this, arguments);
          }, 'toDataURL', false);
        }

        if (canvasEl.toBlob) {
          const origToBlob = canvasEl.toBlob;
          canvasEl.toBlob = makeNative(function toBlob(callback, type, quality) {
            if (isCloudflareCanvas(this) || isCloudflareCaller()) {
              return origToBlob.apply(this, arguments);
            }

            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              try {
                const img = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
                if (img.data.length >= 4) {
                  img.data[0] = (img.data[0] ^ (SEED & 0x01));
                  ctx.putImageData(img, 0, 0);
                }
              } catch (err) {}
            }
            return origToBlob.apply(this, arguments);
          }, 'toBlob', false);
        }
      }

      if (offscreenEl && offscreenEl.convertToBlob) {
        const origConvertToBlob = offscreenEl.convertToBlob;
        offscreenEl.convertToBlob = makeNative(function convertToBlob(options) {
          if (isCloudflareCaller()) {
            return origConvertToBlob.apply(this, arguments);
          }
          const ctx = this.getContext('2d');
          if (ctx && this.width > 0 && this.height > 0) {
            try {
              const img = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
              if (img.data.length >= 4) {
                img.data[0] = (img.data[0] ^ (SEED & 0x01));
                ctx.putImageData(img, 0, 0);
              }
            } catch (err) {}
          }
          return origConvertToBlob.apply(this, arguments);
        }, 'convertToBlob', false);
      }
    } catch (e) {}

    // -----------------------------------------------------------------------
    // F. AUDIOCONTEXT & OFFLINE AUDIO FARBLING (FingerprintJS Pro Defense)
    // -----------------------------------------------------------------------
    try {
      const audioBufferProto = targetWindow.AudioBuffer ? targetWindow.AudioBuffer.prototype : null;
      if (audioBufferProto && audioBufferProto.getChannelData) {
        const origGetChannelData = audioBufferProto.getChannelData;
        audioBufferProto.getChannelData = makeNative(function getChannelData(channel) {
          const channelData = origGetChannelData.apply(this, arguments);
          if (isCloudflareCaller()) return channelData;

          const noiseFactor = 0.0000001 * (1 + (SEED % 5));
          const step = Math.max(1, Math.floor(channelData.length / 50));
          for (let i = 0; i < channelData.length; i += step) {
            channelData[i] += noiseFactor * pseudoRandom(i);
          }
          return channelData;
        }, 'getChannelData', false);
      }

      const offlineAudioProto = targetWindow.OfflineAudioContext ? targetWindow.OfflineAudioContext.prototype : null;
      if (offlineAudioProto && offlineAudioProto.startRendering) {
        const origStartRendering = offlineAudioProto.startRendering;
        offlineAudioProto.startRendering = makeNative(function startRendering() {
          return origStartRendering.apply(this, arguments).then(buffer => {
            if (buffer && !isCloudflareCaller()) {
              const data = buffer.getChannelData(0);
              const noiseFactor = 0.0000001 * (1 + (SEED % 5));
              for (let i = 0; i < data.length; i += 30) {
                data[i] += noiseFactor * pseudoRandom(i);
              }
            }
            return buffer;
          });
        }, 'startRendering', false);
      }

      const analyserProto = targetWindow.AnalyserNode ? targetWindow.AnalyserNode.prototype : null;
      if (analyserProto && analyserProto.getFloatFrequencyData) {
        const origGetFloatFreq = analyserProto.getFloatFrequencyData;
        analyserProto.getFloatFrequencyData = makeNative(function getFloatFrequencyData(array) {
          origGetFloatFreq.apply(this, arguments);
          if (isCloudflareCaller()) return;

          for (let i = 0; i < array.length; i += 15) {
            array[i] += 0.001 * (pseudoRandom(i) - 0.5);
          }
        }, 'getFloatFrequencyData', false);
      }
    } catch (e) {}

    // -----------------------------------------------------------------------
    // G. FONT METRIC & SVG SPOOFING (Bounding Box, ClientRects, SVG Text)
    // -----------------------------------------------------------------------
    try {
      const htmlProto = targetWindow.HTMLElement ? targetWindow.HTMLElement.prototype : null;
      const elemProto = targetWindow.Element ? targetWindow.Element.prototype : null;
      const svgTextProto = targetWindow.SVGTextContentElement ? targetWindow.SVGTextContentElement.prototype : null;

      function isFontProbe(el) {
        if (!el || !el.style) return false;
        const s = el.style;
        const isOffscreen = s.position === 'absolute' && (parseInt(s.left) < -1000 || parseInt(s.top) < -1000);
        const isHuge = s.fontSize && parseInt(s.fontSize) >= 60;
        const isHidden = s.visibility === 'hidden' || s.display === 'none';
        return isOffscreen || isHuge || (isHidden && s.fontFamily);
      }

      if (htmlProto) {
        const origOffsetWidth = Object.getOwnPropertyDescriptor(htmlProto, 'offsetWidth');
        const origOffsetHeight = Object.getOwnPropertyDescriptor(htmlProto, 'offsetHeight');

        if (origOffsetWidth && origOffsetHeight) {
          Object.defineProperty(htmlProto, 'offsetWidth', {
            get: makeNative(function() {
              const w = origOffsetWidth.get.call(this);
              if (isFontProbe(this) && !isCloudflareCaller()) {
                return w + ((SEED % 2 === 0) ? 0.01 : -0.01);
              }
              return w;
            }, 'offsetWidth', true),
            configurable: true
          });

          Object.defineProperty(htmlProto, 'offsetHeight', {
            get: makeNative(function() {
              const h = origOffsetHeight.get.call(this);
              if (isFontProbe(this) && !isCloudflareCaller()) {
                return h + ((SEED % 3 === 0) ? 0.01 : -0.01);
              }
              return h;
            }, 'offsetHeight', true),
            configurable: true
          });
        }
      }

      if (elemProto && elemProto.getBoundingClientRect) {
        const origGetBCR = elemProto.getBoundingClientRect;
        elemProto.getBoundingClientRect = makeNative(function getBoundingClientRect() {
          const rect = origGetBCR.apply(this, arguments);
          if (isFontProbe(this) && !isCloudflareCaller()) {
            const shift = (SEED % 2 === 0 ? 0.02 : -0.02);
            return new DOMRect(rect.x, rect.y, rect.width + shift, rect.height + shift);
          }
          return rect;
        }, 'getBoundingClientRect', false);
      }

      if (elemProto && elemProto.getClientRects) {
        const origGetCR = elemProto.getClientRects;
        elemProto.getClientRects = makeNative(function getClientRects() {
          const list = origGetCR.apply(this, arguments);
          if (isFontProbe(this) && !isCloudflareCaller() && list.length > 0) {
            const shift = (SEED % 2 === 0 ? 0.02 : -0.02);
            const domRect = new DOMRect(list[0].x, list[0].y, list[0].width + shift, list[0].height + shift);
            return [domRect];
          }
          return list;
        }, 'getClientRects', false);
      }

      if (svgTextProto && svgTextProto.getComputedTextLength) {
        const origGetCTL = svgTextProto.getComputedTextLength;
        svgTextProto.getComputedTextLength = makeNative(function getComputedTextLength() {
          const len = origGetCTL.apply(this, arguments);
          if (!isCloudflareCaller()) {
            return len + (SEED % 2 === 0 ? 0.01 : -0.01);
          }
          return len;
        }, 'getComputedTextLength', false);
      }
    } catch (e) {}

    // -----------------------------------------------------------------------
    // H. WEBRTC INTERNAL IP LEAK FILTERING
    // -----------------------------------------------------------------------
    try {
      const rtc = targetWindow.RTCPeerConnection || targetWindow.webkitRTCPeerConnection;
      if (rtc) {
        function sanitizeCandidate(candidate) {
          if (!candidate || !candidate.candidate) return candidate;
          if (/(\.local|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\.)/.test(candidate.candidate)) {
            return null;
          }
          return candidate;
        }

        const OrigRTC = rtc;
        const CustomRTC = function RTCPeerConnection(config, constraints) {
          const pc = new OrigRTC(config, constraints);
          const origAddEventListener = pc.addEventListener;
          pc.addEventListener = makeNative(function addEventListener(type, listener, options) {
            if (type === 'icecandidate') {
              const wrapped = function(evt) {
                if (evt && evt.candidate && !sanitizeCandidate(evt.candidate)) {
                  return;
                }
                return listener.apply(this, arguments);
              };
              return origAddEventListener.call(this, type, wrapped, options);
            }
            return origAddEventListener.apply(this, arguments);
          }, 'addEventListener', false);
          return pc;
        };

        CustomRTC.prototype = OrigRTC.prototype;
        makeNative(CustomRTC, 'RTCPeerConnection', false);
        targetWindow.RTCPeerConnection = CustomRTC;
      }
    } catch (e) {}

    // -----------------------------------------------------------------------
    // I. WEB WORKER & SHAREDWORKER INTERCEPTION
    // -----------------------------------------------------------------------
    try {
      if (targetWindow.Worker) {
        const OrigWorker = targetWindow.Worker;
        const CustomWorker = function Worker(scriptURL, options) {
          let finalURL = scriptURL;
          try {
            if (typeof scriptURL === 'string') {
              const bootstrapBlob = new Blob([
                WORKER_BOOTSTRAP_CODE + '\n' +
                'try { importScripts(' + JSON.stringify(scriptURL) + '); } catch(e) {}'
              ], { type: 'application/javascript' });
              finalURL = URL.createObjectURL(bootstrapBlob);
            }
          } catch(err) {}
          return new OrigWorker(finalURL, options);
        };
        CustomWorker.prototype = OrigWorker.prototype;
        makeNative(CustomWorker, 'Worker', false);
        targetWindow.Worker = CustomWorker;
      }

      if (targetWindow.SharedWorker) {
        const OrigSharedWorker = targetWindow.SharedWorker;
        const CustomSharedWorker = function SharedWorker(scriptURL, options) {
          let finalURL = scriptURL;
          try {
            if (typeof scriptURL === 'string') {
              const bootstrapBlob = new Blob([
                WORKER_BOOTSTRAP_CODE + '\n' +
                'try { importScripts(' + JSON.stringify(scriptURL) + '); } catch(e) {}'
              ], { type: 'application/javascript' });
              finalURL = URL.createObjectURL(bootstrapBlob);
            }
          } catch(err) {}
          return new OrigSharedWorker(finalURL, options);
        };
        CustomSharedWorker.prototype = OrigSharedWorker.prototype;
        makeNative(CustomSharedWorker, 'SharedWorker', false);
        targetWindow.SharedWorker = CustomSharedWorker;
      }
    } catch (e) {}
  }

  // =========================================================================
  // 4. DYNAMIC IFRAME ISOLATION HOOK
  // =========================================================================
  try {
    const origContentWindowDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    if (origContentWindowDesc && origContentWindowDesc.get) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: makeNative(function() {
          const win = origContentWindowDesc.get.call(this);
          if (win) {
            try {
              applyStealthToContext(win);
            } catch (err) {}
          }
          return win;
        }, 'contentWindow', true),
        configurable: true
      });
    }
  } catch (e) {}

  // Apply stealth suite to top-level window
  applyStealthToContext(window);

  console.log('🛡️ Privacy Shield Pro v5.0 (Deep Coherence Engine): Proteções ativas em WebGL/WebGPU, TextMetrics, Canvas, Áudio e WebWorkers.');
})();
