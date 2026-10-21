(function () {
  'use strict';

  const nativeSetInterval = window.setInterval.bind(window);
  const minimumIntervalMs = 1500;
  let intervalCount = 0;

  window.setInterval = function (handler, timeout) {
    const args = Array.prototype.slice.call(arguments, 2);
    const requestedDelay = Number(timeout) || 0;
    const safeDelay = Math.max(minimumIntervalMs, requestedDelay);

    if (typeof handler !== 'function') {
      return nativeSetInterval(handler, safeDelay);
    }

    let running = false;
    intervalCount += 1;

    return nativeSetInterval(function () {
      if (document.hidden || running) return;
      running = true;
      try {
        handler.apply(window, args);
      } finally {
        running = false;
      }
    }, safeDelay);
  };

  window.fsRuntimeStatus = {
    optimized: true,
    minimumIntervalMs: minimumIntervalMs,
    get intervalCount() {
      return intervalCount;
    }
  };

  window.fsAssinaturaExportacao = window.fsAssinaturaExportacao || function () {
    return '<div class="fsExportSignatureBar"><span class="fsDevSignature">Developed by FildoSobral © 2026</span></div>';
  };

  function installCanvasGuard() {
    const original = window.html2canvas;
    if (typeof original !== 'function' || original.__fsOptimized) return;

    const maxPixels = 30000000;
    const maxDimension = 8192;
    let exportQueue = Promise.resolve();

    function optimizedHtml2Canvas(element, options) {
      const supplied = options || {};
      const width = Math.max(1, Number(supplied.width) || Number(element && element.scrollWidth) || 1200);
      const height = Math.max(1, Number(supplied.height) || Number(element && element.scrollHeight) || 900);
      const requestedScale = Math.max(0.5, Number(supplied.scale) || 1);
      const pixelScale = Math.sqrt(maxPixels / Math.max(1, width * height));
      const dimensionScale = maxDimension / Math.max(width, height);
      const safeScale = Math.max(0.5, Math.min(requestedScale, pixelScale, dimensionScale));
      const tunedOptions = Object.assign({}, supplied, { scale: safeScale });

      const execute = function () {
        return original(element, tunedOptions);
      };
      const job = exportQueue.then(execute, execute);
      exportQueue = job.catch(function () {});
      return job;
    }

    optimizedHtml2Canvas.__fsOptimized = true;
    optimizedHtml2Canvas.__fsOriginal = original;
    window.html2canvas = optimizedHtml2Canvas;
  }

  window.fsInstallCanvasGuard = installCanvasGuard;

  function loadOptionalLibraries() {
    const libraries = [
      {
        id: 'fs-lib-html2canvas',
        src: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        ready: function () { return typeof window.html2canvas === 'function'; },
        onload: installCanvasGuard
      },
      {
        id: 'fs-lib-pdfjs',
        src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        ready: function () { return !!window.pdfjsLib; }
      },
      {
        id: 'fs-lib-tesseract',
        src: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
        ready: function () { return !!window.Tesseract; }
      }
    ];

    libraries.forEach(function (library) {
      if (library.ready() || document.getElementById(library.id)) return;
      const script = document.createElement('script');
      script.id = library.id;
      script.src = library.src;
      script.async = true;
      if (library.onload) script.addEventListener('load', library.onload, { once: true });
      document.head.appendChild(script);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installCanvasGuard, { once: true });
  } else {
    installCanvasGuard();
  }

  let libraryChecks = 0;
  const libraryCheckTimer = nativeSetInterval(function () {
    libraryChecks += 1;
    installCanvasGuard();
    if ((window.html2canvas && window.html2canvas.__fsOptimized) || libraryChecks >= 120) {
      window.clearInterval(libraryCheckTimer);
    }
  }, 500);

  window.addEventListener('load', function () {
    window.setTimeout(loadOptionalLibraries, 0);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }, { once: true });
})();
