/**
 * printModal.ts
 * Modal de iframe para vista previa e impresion de planillas.
 * Separado de print.ts para que printCF.ts y printChampionship.ts
 * importen solo esto sin arrastrar todo el resto.
 */

export function openPrintModal(htmlContent: string, title: string): void {
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
  backdrop.querySelector('#btn-close-print')?.addEventListener('click', () => {
    backdrop.classList.remove('is-open');
    backdrop.classList.add('is-closing');
    setTimeout(() => backdrop.remove(), 150);
  });
}
