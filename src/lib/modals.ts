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
  const icons: Record<ToastKind, string> = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast-item ${kind}`;
  toast.innerHTML = `<span aria-hidden="true" style="font-weight:bold;">${icons[kind]}</span><span>${esc(message)}</span>`;
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
    backdrop.style.zIndex = '99999';
    backdrop.innerHTML = `
      <div class="cptp-modal-content">
        <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0 0 10px;">${esc(title)}</h2>
        <p style="font-size:0.92rem;color:#334155;line-height:1.5;margin:0 0 20px;">${esc(message)}</p>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="modal-cancel-btn" class="btn-ghost-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;">Cancelar</button>
          <button id="modal-confirm-btn" class="btn-primary-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;background:#0056b3;color:#ffffff;">Confirmar</button>
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
    backdrop.style.zIndex = '99999';
    backdrop.innerHTML = `
      <div class="cptp-modal-content">
        <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0 0 10px;">${esc(title)}</h2>
        <p style="font-size:0.92rem;color:#334155;line-height:1.5;margin:0 0 16px;">${esc(message)}</p>
        <input type="text" id="modal-prompt-input" class="field-input" value="${esc(defaultValue)}" style="margin-bottom:20px;border:1px solid #cbd5e1;padding:8px 12px;border-radius:6px;width:100%;font-size:0.95rem;" autofocus />
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="modal-cancel-btn" class="btn-ghost-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;">Cancelar</button>
          <button id="modal-confirm-btn" class="btn-primary-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;background:#0056b3;color:#ffffff;">Aceptar</button>
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
export interface ParticipantEditData {
  name: string;
  category?: string;
  sharedRifleId?: string;
}

export function showEditParticipantModal(title: string, p: { name: string, category?: string, sharedRifleId?: string }): Promise<ParticipantEditData | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'cptp-modal-backdrop';
    backdrop.style.zIndex = '99999';
    backdrop.innerHTML = `
      <div class="cptp-modal-content">
        <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0 0 10px;">${esc(title)}</h2>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
          <div>
            <label style="font-size:0.75rem;color:#64748b;font-weight:700;">Nombre Completo</label>
            <input type="text" id="modal-edit-name" class="field-input" value="${esc(p.name)}" style="border:1px solid #cbd5e1;padding:8px 12px;border-radius:6px;width:100%;font-size:0.95rem;" autofocus />
          </div>
          <div>
            <label style="font-size:0.75rem;color:#64748b;font-weight:700;">Categoría</label>
            <input type="text" id="modal-edit-category" class="field-input" value="${esc(p.category || '')}" style="border:1px solid #cbd5e1;padding:8px 12px;border-radius:6px;width:100%;font-size:0.95rem;" />
          </div>
          <div>
            <label style="font-size:0.75rem;color:#64748b;font-weight:700;">Rifle Compartido</label>
            <select id="modal-edit-rifle" class="field-input" style="border:1px solid #cbd5e1;padding:8px 12px;border-radius:6px;width:100%;font-size:0.95rem;">
              <option value="" ${!p.sharedRifleId ? 'selected' : ''}>Ninguno</option>
              <option value="Rifle A" ${p.sharedRifleId === 'Rifle A' ? 'selected' : ''}>Rifle A</option>
              <option value="Rifle B" ${p.sharedRifleId === 'Rifle B' ? 'selected' : ''}>Rifle B</option>
              <option value="Rifle C" ${p.sharedRifleId === 'Rifle C' ? 'selected' : ''}>Rifle C</option>
              <option value="Rifle D" ${p.sharedRifleId === 'Rifle D' ? 'selected' : ''}>Rifle D</option>
              <option value="Rifle E" ${p.sharedRifleId === 'Rifle E' ? 'selected' : ''}>Rifle E</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="modal-cancel-btn" class="btn-ghost-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;">Cancelar</button>
          <button id="modal-confirm-btn" class="btn-primary-custom" style="padding:10px 18px;font-size:0.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;background:#0056b3;color:#ffffff;">Guardar Cambios</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const nameInput = backdrop.querySelector('#modal-edit-name') as HTMLInputElement | null;
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
    void backdrop.offsetWidth;
    backdrop.classList.add('is-open');

    const closeWithResult = (val: ParticipantEditData | null) => {
      backdrop.classList.remove('is-open');
      backdrop.classList.add('is-closing');
      setTimeout(() => {
        backdrop.remove();
        resolve(val);
      }, 150);
    };

    backdrop.querySelector('#modal-cancel-btn')?.addEventListener('click', () => closeWithResult(null));
    backdrop.querySelector('#modal-confirm-btn')?.addEventListener('click', () => {
      const catInput = backdrop.querySelector('#modal-edit-category') as HTMLInputElement;
      const rifleInput = backdrop.querySelector('#modal-edit-rifle') as HTMLSelectElement;
      closeWithResult({
        name: nameInput?.value || '',
        category: catInput?.value || undefined,
        sharedRifleId: rifleInput?.value || undefined
      });
    });
  });
}
