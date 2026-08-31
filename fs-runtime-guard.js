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



  function installBuiltInCanvasFallback() {
    if (typeof window.html2canvas === 'function') return;

    async function fallbackHtml2Canvas(element, options) {
      if (!element) throw new Error('Elemento de exportação não encontrado.');
      const supplied = options || {};
      const rect = element.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(Number(supplied.width) || element.scrollWidth || element.offsetWidth || rect.width || 1200));
      const height = Math.max(1, Math.ceil(Number(supplied.height) || element.scrollHeight || element.offsetHeight || rect.height || 900));
      const requestedScale = Math.max(0.5, Number(supplied.scale) || 1);
      const maxPixels = 26000000;
      const safeScale = Math.max(0.5, Math.min(requestedScale, Math.sqrt(maxPixels / Math.max(1, width * height)), 8192 / Math.max(width, height)));
      const outW = Math.max(1, Math.floor(width * safeScale));
      const outH = Math.max(1, Math.floor(height * safeScale));
      const background = supplied.backgroundColor === null ? 'transparent' : (supplied.backgroundColor || '#ffffff');

      const clone = element.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      clone.style.width = width + 'px';
      clone.style.maxWidth = 'none';
      clone.style.height = 'auto';
      clone.style.margin = '0';
      clone.style.transform = 'none';
      clone.style.position = 'relative';
      clone.style.left = '0';
      clone.style.top = '0';

      clone.querySelectorAll('img').forEach(function(img){
        try {
          const src = img.getAttribute('src') || '';
          if (src && !/^(data:|blob:|https?:|file:|content:)/i.test(src)) {
            img.setAttribute('src', new URL(src, document.baseURI).href);
          }
        } catch(e) {}
      });

      let css = '';
      Array.from(document.styleSheets || []).forEach(function(sheet){
        try {
          Array.from(sheet.cssRules || []).forEach(function(rule){ css += rule.cssText + '\n'; });
        } catch(e) {}
      });
      Array.from(document.querySelectorAll('style')).forEach(function(st){
        if (st.textContent && css.indexOf(st.textContent) === -1) css += st.textContent + '\n';
      });

      const wrapper = document.createElement('div');
      wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      wrapper.style.width = width + 'px';
      wrapper.style.minHeight = height + 'px';
      wrapper.style.overflow = 'hidden';
      wrapper.style.background = background;
      const style = document.createElement('style');
      style.textContent = css + '\nhtml,body{margin:0!important;padding:0!important;}';
      wrapper.appendChild(style);
      wrapper.appendChild(clone);

      const serialized = new XMLSerializer().serializeToString(wrapper);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
        '<foreignObject x="0" y="0" width="100%" height="100%">' + serialized + '</foreignObject></svg>';
      const blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);

      try {
        const img = await new Promise(function(resolve, reject){
          const image = new Image();
          image.onload = function(){ resolve(image); };
          image.onerror = function(){ reject(new Error('Falha ao preparar a imagem para exportação.')); };
          image.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas não disponível neste navegador.');
        if (background !== 'transparent') {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, outW, outH);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, outW, outH);
        return canvas;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    fallbackHtml2Canvas.__fsFallback = true;
    fallbackHtml2Canvas.__fsOptimized = true;
    window.html2canvas = fallbackHtml2Canvas;
  }

  function installCanvasGuard() {
    const original = window.html2canvas;
    if (typeof original !== 'function' || original.__fsFallback || original.__fsOptimized) return;

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

  installBuiltInCanvasFallback();

  window.fsInstallCanvasGuard = installCanvasGuard;

  function loadOptionalLibraries() {
    const libraries = [
      {
        id: 'fs-lib-html2canvas',
        src: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        ready: function () { return typeof window.html2canvas === 'function' && !window.html2canvas.__fsFallback; },
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
    document.addEventListener('DOMContentLoaded', function(){ installCanvasGuard(); loadOptionalLibraries(); }, { once: true });
  } else {
    installCanvasGuard();
    loadOptionalLibraries();
  }

  let libraryChecks = 0;
  const libraryCheckTimer = nativeSetInterval(function () {
    libraryChecks += 1;
    installCanvasGuard();
    if ((window.html2canvas && window.html2canvas.__fsOptimized && !window.html2canvas.__fsFallback) || libraryChecks >= 120) {
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
