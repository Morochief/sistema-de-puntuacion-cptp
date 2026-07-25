import { showToast } from '../modals';
import { navigate } from '../router';
import { db } from '../db';

export async function renderNewEvent(): Promise<void> {
 const container = document.getElementById('new-event-container');
 if (!container) return;

 const today = new Date().toISOString().split('T')[0];

 container.innerHTML = `
  <div style="margin-bottom:24px;display:flex;align-items:center;gap:12px;">
   <button class="btn-ghost-custom" id="btn-back-new" aria-label="Volver al inicio">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    Volver
   </button>
  </div>

  <div style="margin-bottom:28px;">
   <div class="section-title" style="margin-bottom:4px;">Nuevo Evento</div>
   <h1 style="margin:0;font-family:'Rajdhani',sans-serif;font-size:1.8rem;font-weight:700;color:#0056b3;">
    Crear Evento de Tiro
   </h1>
  </div>

  <form id="form-new-event" novalidate>
   <div style="display:flex;flex-direction:column;gap:20px;">
    <div class="field-group">
     <label class="field-label" for="field-name">Nombre del evento</label>
     <input type="text" id="field-name" name="name" class="field-input"
         placeholder="Ej: Torneo Apertura CPTP .22 LR"
         maxlength="80" required autocomplete="off" />
    </div>
    <div class="field-group">
     <label class="field-label" for="field-date">Fecha</label>
     <input type="date" id="field-date" name="date" class="field-input"
         value="${today}" required />
    </div>
    <div class="field-group">
     <label class="field-label" for="field-champ-date">
      Fecha del Campeonato <span style="font-weight:400;color:#475569;">(ej: 1ª Fecha .22 LR)</span>
     </label>
     <input type="text" id="field-champ-date" name="championshipDate" class="field-input"
         placeholder="Ej: 1ª Fecha .22 LR"
         maxlength="80" autocomplete="off" />
    </div>
    <div class="field-group">
     <label class="field-label" for="field-location">
      Ubicación <span style="font-weight:400;color:#475569;">(opcional)</span>
     </label>
     <input type="text" id="field-location" name="location" class="field-input"
         placeholder="Ej: Campo de Tiro LPBC"
         maxlength="80" autocomplete="off" />
    </div>
    <div style="display:flex;gap:12px;padding-top:8px;">
     <button type="button" class="btn-ghost-custom" style="flex:1;" id="btn-cancel-new">Cancelar</button>
     <button type="submit" class="btn-primary-custom" style="flex:2;" id="btn-submit-new">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      Crear Evento
     </button>
    </div>
   </div>
  </form>`;

 document.getElementById('btn-back-new')?.addEventListener('click', () => navigate('/'));
 document.getElementById('btn-cancel-new')?.addEventListener('click', () => navigate('/'));

 const form = document.getElementById('form-new-event');
 const btnSubmit = document.getElementById('btn-submit-new') as HTMLButtonElement | null;

 form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name   = (document.getElementById('field-name') as HTMLInputElement).value.trim();
  const date   = (document.getElementById('field-date') as HTMLInputElement).value;
  const championshipDate = (document.getElementById('field-champ-date') as HTMLInputElement).value.trim();
  const location = (document.getElementById('field-location') as HTMLInputElement).value.trim();
  if (!name || !date) { showToast('Completá nombre y fecha.', 'error'); return; }
  if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Guardando…'; }
  try {
   const eid = await db.events.add({ name, date, location, championshipDate, createdAt: Date.now() });
   navigate(`/event/${eid}`);
  } catch (err) {
   console.error('[DB] Error creando evento:', err);
   showToast('Error al guardar el evento.', 'error');
   if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Crear Evento'; }
  }
 });
}

// ── Detalle de Evento (Inscripciones, Sorteo y Series) ──────────────────────
