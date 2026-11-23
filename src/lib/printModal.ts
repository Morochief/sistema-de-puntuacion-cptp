/**
 * printModal.ts
 * Modal de iframe para vista previa e impresion de planillas.
 * Separado de print.ts para que printCF.ts y printChampionship.ts
 * importen solo esto sin arrastrar todo el resto.
 */

export interface PrintModalOptions {
  /** Si se indica, muestra el botón "Descargar imagen" (PNG) con este nombre de archivo. */
  imageFileName?: string;
}

export function openPrintModal(htmlContent: string, title: string, options: PrintModalOptions = {}): void {
  const existing = document.getElementById('cptp-print-modal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'cptp-print-modal';
  backdrop.className = 'cptp-modal-backdrop no-print';
  backdrop.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px);
    z-index: 2500; display: flex; flex-direction: column;
    padding: 12px; box-sizing: border-box;
  `;

  backdrop.innerHTML = `
    <div style="width: 95%; max-width: 1100px; height: 85vh; background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 5px solid #b7201c; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(15, 23, 42, 0.25);">
      <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-family:'Orbitron',sans-serif;font-weight:900;font-size:0.95rem;color:#0056b3;">Vista Previa</span>
          <span style="font-size:0.75rem;color:#64748b;font-weight:600;">${title}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          ${options.imageFileName ? `
          <button id="btn-download-image" class="btn-ghost-custom" style="padding:8px 14px;color:#16a34a;border-color:rgba(34,197,94,0.45);background:#ffffff;font-weight:bold;font-size:0.8rem;cursor:pointer;">
            Descargar imagen
          </button>` : ''}
          <button id="btn-do-print" class="btn-primary-custom" style="padding:8px 16px;background:#0056b3;color:#ffffff;border-color:#0056b3;font-weight:bold;border-radius:8px;font-size:0.8rem;cursor:pointer;box-shadow:none;">
            Imprimir
          </button>
          <button id="btn-close-print" class="btn-ghost-custom" style="padding:8px 14px;color:#0f172a;border-color:#cbd5e1;background:#ffffff;font-weight:bold;font-size:0.8rem;cursor:pointer;">
            Cerrar
          </button>
        </div>
      </div>
      <div style="flex:1;background:#ffffff;overflow:hidden;position:relative;">
        <iframe id="print-iframe" style="width:100%;height:100%;border:none;background:#ffffff;" title="Planilla de impresion"></iframe>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  void backdrop.offsetWidth;
  backdrop.classList.add('is-open');

  const iframe = backdrop.querySelector('#print-iframe') as HTMLIFrameElement;
  const iframeWin = iframe.contentWindow;
  if (iframeWin) {
    iframeWin.document.open();
    iframeWin.document.write(htmlContent);
    iframeWin.document.close();
  }

  const triggerPrint = () => {
    if (iframeWin) {
      iframeWin.focus();
      iframeWin.print();
    }
  };

  backdrop.querySelector('#btn-do-print')?.addEventListener('click', triggerPrint);

  const downloadBtn = backdrop.querySelector('#btn-download-image') as HTMLButtonElement | null;
  downloadBtn?.addEventListener('click', async () => {
    const doc = iframe.contentDocument;
    if (!doc?.body || !options.imageFileName) return;
    downloadBtn.disabled = true;
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = 'Generando...';
    try {
      const { default: html2canvas } = await import('html2canvas');
      // html2canvas no dibuja bien los <img> SVG sin tamaño intrínseco: se rasterizan antes a PNG
      const restore: Array<() => void> = [];
      for (const img of Array.from(doc.images)) {
        if (!/\.svg(\?|$)/i.test(img.src) || !img.complete || img.clientWidth === 0) continue;
        const w = img.clientWidth, h = img.clientHeight;
        const c = doc.createElement('canvas');
        c.width = w * 3; c.height = h * 3;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        const ratio = Math.min(c.width / (img.naturalWidth || c.width), c.height / (img.naturalHeight || c.height));
        const dw = (img.naturalWidth || c.width) * ratio, dh = (img.naturalHeight || c.height) * ratio;
        ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
        const originalSrc = img.src;
        img.src = c.toDataURL('image/png');
        await img.decode().catch(() => undefined);
        restore.push(() => { img.src = originalSrc; });
      }
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(doc.body, { backgroundColor: '#ffffff', scale: 2, useCORS: true, foreignObjectRendering: true });
      } finally {
        restore.forEach(fn => fn());
      }
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = options.imageFileName;
      link.click();
    } catch (err) {
      console.error('[Print] No se pudo generar la imagen:', err);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = originalText;
    }
  });
  backdrop.querySelector('#btn-close-print')?.addEventListener('click', () => {
    backdrop.classList.remove('is-open');
    backdrop.classList.add('is-closing');
    setTimeout(() => backdrop.remove(), 150);
  });
}
