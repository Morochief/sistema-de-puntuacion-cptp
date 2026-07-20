export type ToastKind = 'success' | 'error' | 'info';

export function esc(s: string): string {
 return String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
}

export function showToast(message: string, kind: ToastKind = 'info', ms = 3000): void {
 const container = document.getElementById('toast-container');
 if (!container) return;
 const icons: Record<ToastKind, string> = { success: 'OK', error: 'ERROR', info: 'INFO' };
 const toast = document.createElement('div');
 toast.className = `toast-item ${kind}`;
 toast.innerHTML = `<span aria-hidden="true">${icons[kind]}</span><span>${esc(message)}</span>`;
 container.appendChild(toast);
 setTimeout(() => {
  toast.classList.add('toast-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
 }, ms);
}

export function showConfirm(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'cptp-modal-backdrop';
    backdrop.innerHTML = `
      <div class="cptp-modal-content">
        <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#e2e8f0;margin:0 0 10px;">${esc(title)}</h2>
        <p style="font-size:0.92rem;color:#94a3b8;line-height:1.5;margin:0 0 20px;">${esc(message)}</p>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="modal-cancel-btn" class="btn-ghost-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;">Cancelar</button>
          <button id="modal-confirm-btn" class="btn-primary-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    void backdrop.offsetWidth;
    backdrop.classList.add('is-open');

    const closeWithResult = (res: boolean) => {
      backdrop.classList.remove('is-open');
      backdrop.classList.add('is-closing');
      setTimeout(() => {
        backdrop.remove();
        resolve(res);
      }, 150);
    };

    backdrop.querySelector('#modal-cancel-btn')?.addEventListener('click', () => closeWithResult(false));
    backdrop.querySelector('#modal-confirm-btn')?.addEventListener('click', () => closeWithResult(true));
  });
}

export function showPrompt(title: string, message: string, defaultValue: string): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'cptp-modal-backdrop';
    backdrop.innerHTML = `
      <div class="cptp-modal-content">
        <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#e2e8f0;margin:0 0 10px;">${esc(title)}</h2>
        <p style="font-size:0.92rem;color:#94a3b8;line-height:1.5;margin:0 0 16px;">${esc(message)}</p>
        <input type="text" id="modal-prompt-input" class="field-input" value="${esc(defaultValue)}" style="margin-bottom:20px;" autofocus />
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="modal-cancel-btn" class="btn-ghost-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;">Cancelar</button>
          <button id="modal-confirm-btn" class="btn-primary-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;">Aceptar</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('#modal-prompt-input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
    void backdrop.offsetWidth;
    backdrop.classList.add('is-open');

    const closeWithResult = (val: string | null) => {
      backdrop.classList.remove('is-open');
      backdrop.classList.add('is-closing');
      setTimeout(() => {
        backdrop.remove();
        resolve(val);
      }, 150);
    };

    backdrop.querySelector('#modal-cancel-btn')?.addEventListener('click', () => closeWithResult(null));
    backdrop.querySelector('#modal-confirm-btn')?.addEventListener('click', () => closeWithResult(input?.value ?? null));
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        closeWithResult(input.value);
      } else if (e.key === 'Escape') {
        closeWithResult(null);
      }
    });
  });
}
