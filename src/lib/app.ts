/**
 * CPTP .22 LR Scoring — App principal
 * Arquitectura: SPA hash-router con vistas renderizadas client-side via Dexie (IndexedDB)
 *
 * SISTEMA DE PUNTUACIÓN (arrastre progresivo):
 *  La tabla de puntos tiene 3 blancos (15", 10", 5") y 10 columnas (disparos 1-10).
 *  El valor que se obtiene al impactar depende del NÚMERO DE DISPARO en que se logra.
 *  Si se falla, el "arrastre" hace que el siguiente intento del mismo blanco valga menos.
 *  No se puede pasar al siguiente blanco sin impactar el actual.
 */

import { esc, showToast, showConfirm, showPrompt } from './modals';
import { navigate, getRoute, showView } from './router';
import { exportRankingToExcel } from './excel';
import { exportEventBackup, importEventBackup } from './backup';
import { sortRanking, showTieBreakerModal } from './tiebreaker';
import { handleSeedParticipants, handleSeedScores } from './seeder';
import { db } from './db';
import type { ShootingEvent, Participant, Series, Shot } from './types';
import { printSeriesCard, printEventCards, printRankingCard } from './print';
import html2canvas from 'html2canvas';
import { getFilteredEvents, showEditEventModal } from './eventsManager';
import { renderMasterCompetitorsModal, addMasterCompetitor, migrateParticipantsToPadron } from './masterCompetitors';
import { applySpecialFamilySeedingRules, resetEventSeeding, showManualHeatsReorderModal } from './heatsManager';
import { renderChampionshipPanel } from './championship';

(window as any).downloadElementAsPng = async (el: HTMLElement, filename: string) => {
 showToast('Generando imagen de alta calidad…', 'info', 4000);
 try {
  const canvas = await html2canvas(el, {
   scale: 2, // 2x resolution
   backgroundColor: '#080c14',
   logging: false,
   useCORS: true,
   allowTaint: true
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Imagen descargada con éxito', 'success');
 } catch (err) {
  console.error('[Export Image] Error:', err);
  showToast('Error al exportar la imagen.', 'error');
 }
};
import {
 calculateSeriesTotal,
 calculateShotValue,
 deriveCurrentPhase,
 getNextPhase,
 getMaxPossibleRemaining,
 getValueIfHit,
 getTargetLabel,
 getTargetBadgeClass,
} from './scoring';

// ── Utilidades ─────────────────────────────────────────────────────────────


type ToastKind = 'success' | 'error' | 'info';




function formatDate(isoDate: string): string {
 try {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('es-AR', {
   day: '2-digit', month: 'short', year: 'numeric',
  });
 } catch { return isoDate; }
}

// ── Dashboard State ──────────────────────────────────────────────────────
let dashSearchQuery = '';
let dashSortBy: 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' = 'date_desc';
let dashPage = 1;
const DASH_ITEMS_PER_PAGE = 6;


async function renderDashboard(): Promise<void> {
 const container = document.getElementById('event-list-container');
 if (!container) return;

 container.innerHTML = `<div style="text-align:center;padding:32px;color:#334155;font-size:0.85rem;">Cargando…</div>`;

 let filteredData;
 try {
  filteredData = await getFilteredEvents({
   searchQuery: dashSearchQuery,
   sortBy: dashSortBy,
   page: dashPage,
   itemsPerPage: DASH_ITEMS_PER_PAGE
  });
 } catch (err) {
  console.error('[DB] Error cargando eventos:', err);
  container.innerHTML = `<div class="empty-state"><div class="empty-icon"></div>
   <p class="text-sm text-error">Error al cargar eventos. Intentá recargar la app.</p></div>`;
  return;
 }

 const { events, totalItems, totalPages } = filteredData;

 let listHtml = `
  <!-- Barra de Filtros, Ordenamiento y Padrón Maestro -->
  <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
   <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
    <input type="text" id="dash-search-input" value="${esc(dashSearchQuery)}"
        placeholder="Buscar por nombre, ubicación o fecha de campeonato…"
        class="field-input" style="flex:2;min-width:200px;padding:9px 14px;font-size:0.9rem;" />
    
    <select id="dash-sort-select" style="padding:9px 14px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:0.88rem;background:#ffffff;color:#0f172a;font-weight:600;">
     <option value="date_desc" ${dashSortBy === 'date_desc' ? 'selected' : ''}>Fecha (Más reciente)</option>
     <option value="date_asc" ${dashSortBy === 'date_asc' ? 'selected' : ''}>Fecha (Más antigua)</option>
     <option value="name_asc" ${dashSortBy === 'name_asc' ? 'selected' : ''}>Nombre (A-Z)</option>
     <option value="name_desc" ${dashSortBy === 'name_desc' ? 'selected' : ''}>Nombre (Z-A)</option>
    </select>

    <button id="btn-open-master-padron" class="btn-ghost-custom"
        style="padding:9px 16px;border:1.5px solid #0056b3;color:#0056b3;font-weight:700;border-radius:10px;background:#ffffff;"
        title="Administrar el Padrón Maestro de Tiradores">
      Padrón Maestro
    </button>
   </div>
  </div>
 `;

 if (events.length === 0) {
  listHtml += `<div class="empty-state">
   <div class="empty-icon" aria-hidden="true"></div>
   <p style="color:#64748b;font-size:0.95rem;margin:0">No se encontraron eventos.</p>
   <p style="color:#475569;font-size:0.82rem;margin:8px 0 0">Probá cambiando los filtros o creá un nuevo evento.</p>
  </div>`;
 } else {
  listHtml += `<div style="display:flex;flex-direction:column;gap:12px;">${events.map((e) => `
   <article class="event-card" data-event-id="${e.id}" role="button" tabindex="0"
        aria-label="Evento: ${esc(e.name)}, ${formatDate(e.date)}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
     <div style="min-width:0;flex:1;">
      <h3 style="margin:0 0 4px;font-size:1.05rem;font-weight:700;color:#0056b3;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(e.name)}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
       <span style="font-size:0.78rem;color:#64748b;">${formatDate(e.date)}</span>
       ${e.location ? `<span style="color:#cbd5e1;font-size:0.7rem;">·</span><span style="font-size:0.78rem;color:#64748b;">${esc(e.location)}</span>` : ''}
       ${e.championshipDate ? `<span style="font-size:0.72rem;background:#eff6ff;color:#0056b3;padding:2px 6px;border-radius:4px;font-weight:600;">${esc(e.championshipDate)}</span>` : ''}
      </div>
     </div>
     <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
      <button class="btn-ghost-custom" data-edit-event-id="${e.id}"
          aria-label="Editar evento ${esc(e.name)}"
          onclick="event.stopPropagation()"
          style="padding:6px 10px;font-size:0.72rem;font-weight:700;color:#0056b3;border-color:#0056b3;">Editar</button>
      <button class="btn-danger-custom" data-delete-id="${e.id}"
          aria-label="Eliminar evento ${esc(e.name)}"
          onclick="event.stopPropagation()">
       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.5" aria-hidden="true">
        <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
        <path d="M10,11v6M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
       </svg>
      </button>
     </div>
    </div>
   </article>`).join('')}</div>`;

  // Paginador
  listHtml += `
   <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;font-size:0.85rem;color:#64748b;">
    <span>Página <b>${dashPage}</b> de <b>${totalPages}</b> (${totalItems} eventos)</span>
    <div style="display:flex;gap:6px;">
     <button id="dash-prev-page" ${dashPage === 1 ? 'disabled style="opacity:0.4;"' : ''} class="btn-ghost-custom" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-weight:bold;">← Anterior</button>
     <button id="dash-next-page" ${dashPage >= totalPages ? 'disabled style="opacity:0.4;"' : ''} class="btn-ghost-custom" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-weight:bold;">Siguiente →</button>
    </div>
   </div>
  `;
 }

 // Agregar el panel inferior para importar, vaciar base de datos + cloud sync
 listHtml += `
  <div style="margin-top:32px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;border-top:1px solid #e2e8f0;padding-top:24px;width:100%;">
   <button id="btn-import-backup" class="btn-ghost-custom"
       style="font-size:0.85rem;padding:12px 20px;border:1.5px solid #0056b3;
           border-radius:10px;color:#0056b3;font-weight:700;
           cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:#ffffff;"
       title="Importar un evento desde un archivo .json de otra máquina">
     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
     Importar Evento
   </button>
   <button id="btn-reset-db" class="btn-danger-custom"
       style="font-size:0.85rem;padding:12px 20px;border:2px solid #ef4444;
           border-radius:10px;background:#ef4444;color:#ffffff;font-weight:700;
           cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
     Vaciar Base de Datos
   </button>
   <button id="btn-cloud-upload" class="btn-ghost-custom"
       style="font-size:0.85rem;padding:12px 20px;border:1.5px solid #22c55e;
           border-radius:10px;color:#22c55e;font-weight:700;
           cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:#ffffff;"
       title="Subir base de datos local a la nube (Supabase)">
     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
     Subir a la Nube
   </button>
   <button id="btn-cloud-download" class="btn-ghost-custom"
       style="font-size:0.85rem;padding:12px 20px;border:1.5px solid #3b82f6;
           border-radius:10px;color:#3b82f6;font-weight:700;
           cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:#ffffff;"
       title="Bajar datos oficiales de la nube a este dispositivo">
     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
     Bajar de la Nube
   </button>
  </div>`;

 // Renderizar al DOM
 container.innerHTML = listHtml;

 // Bind filtro de búsqueda
 const searchInp = container.querySelector('#dash-search-input') as HTMLInputElement;
 searchInp?.addEventListener('input', () => {
  dashSearchQuery = searchInp.value;
  dashPage = 1;
  renderDashboard();
 });

 // Bind ordenamiento
 const sortSel = container.querySelector('#dash-sort-select') as HTMLSelectElement;
 sortSel?.addEventListener('change', () => {
  dashSortBy = sortSel.value as any;
  renderDashboard();
 });

 // Bind paginador
 container.querySelector('#dash-prev-page')?.addEventListener('click', () => {
  if (dashPage > 1) { dashPage--; renderDashboard(); }
 });
 container.querySelector('#dash-next-page')?.addEventListener('click', () => {
  if (dashPage < totalPages) { dashPage++; renderDashboard(); }
 });

 // Bind Padrón Maestro button
 container.querySelector('#btn-open-master-padron')?.addEventListener('click', () => {
  renderMasterCompetitorsModal();
 });

 // Vincular eventos a las tarjetas de eventos
 if (events.length > 0) {
  container.querySelectorAll('[data-event-id]').forEach((el) => {
   const card = el as HTMLElement;
   const onClick = (e: Event) => {
    if ((e.target as HTMLElement).closest('[data-delete-id]')) return;
    if ((e.target as HTMLElement).closest('[data-edit-event-id]')) return;
    navigate(`/event/${card.dataset.eventId}`);
   };
   card.addEventListener('click', onClick);
   card.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
     e.preventDefault(); onClick(e);
    }
   });
  });

  container.querySelectorAll('[data-delete-id]').forEach((el) => {
   el.addEventListener('click', async (e) => {
    e.stopPropagation();
    const eid = Number((e.currentTarget as HTMLElement).dataset.deleteId);
    if (!await showConfirm('Eliminar Evento', '¿Eliminar este evento, participantes y todas sus series? Esta acción no se puede deshacer.')) return;
    try {
     await db.events.delete(eid);
     await db.participants.where('eventId').equals(eid).delete();
     await db.series.where('eventId').equals(eid).delete();
      
      // Eliminar de Supabase de manera asíncrona si hay conexión
      if (navigator.onLine) {
        const eventUuid = toDeterministicUuid(eid, 0);
        supabase.from('events').delete().eq('id', eventUuid)
          .then(({ error }) => {
            if (error) console.error('[Sync] Error al borrar de Supabase:', error);
            else console.log('[Sync] Evento eliminado de la nube con éxito');
          });
      }

      showToast('Evento eliminado', 'success');
      renderDashboard();
    } catch (err) {
     console.error('[DB] Error deleting event:', err);
     showToast('Error al eliminar el evento.', 'error');
    }
   });
  });

  // Vincular botón de editar evento
  container.querySelectorAll('[data-edit-event-id]').forEach((el) => {
   el.addEventListener('click', async (e) => {
    e.stopPropagation();
    const eid = Number((e.currentTarget as HTMLElement).dataset.editEventId);
    await showEditEventModal(eid, () => renderDashboard());
   });
  });

  // Update button states whenever the cuadro is rendered
  const btnUndoState = document.getElementById('btn-undo-sorteo');
  if (btnUndoState) {
    const hasRaffle = participants.some(p => p.tanda !== undefined);
    btnUndoState.disabled = !hasRaffle;
  }
  const btnShuffle = document.getElementById('btn-shuffle-sorteo');
  if (btnShuffle) {
    btnShuffle.disabled = participants.length === 0;
  }
 }


 // Vincular botón de importar backup
 document.getElementById('btn-import-backup')?.addEventListener('click', () => {
  importEventBackup(() => renderDashboard());
 });

 // Vincular evento del botón para vaciar la base de datos
 document.getElementById('btn-reset-db')?.addEventListener('click', async () => {
  if (!await showConfirm('Vaciar Base de Datos', '¿Restablecer la aplicación? Esto VACIARÁ toda la base de datos (eventos, competidores y series) y no se puede deshacer.')) return;
  if (!await showConfirm('Confirmación Final', '¿Realmente querés borrar todos los datos locales de la aplicación?')) return;
   try {
    await Promise.all([
     db.events.clear(),
     db.participants.clear(),
     db.series.clear(),
    ]);

    // Vaciar base remota si hay conexión
    if (navigator.onLine) {
      Promise.all([
        supabase.from('series').delete().neq('id', '00000000-0000-4000-0000-000000000000'),
        supabase.from('participants').delete().neq('id', '00000000-0000-4000-0000-000000000000'),
        supabase.from('events').delete().neq('id', '00000000-0000-4000-0000-000000000000')
      ]).then(() => {
        console.log('[Sync] Base de datos remota vaciada con éxito');
      }).catch(err => {
        console.error('[Sync] Error al vaciar base de datos remota:', err);
      });
    }

    showToast('Base de datos restablecida con éxito.', 'success');
    renderDashboard();
   } catch (err) {
    console.error('[DB] Error restableciendo:', err);
    showToast('Error al limpiar la base de datos.', 'error');
   }
 });

 const btnNew = document.getElementById('btn-new-event');
 if (btnNew) btnNew.onclick = () => navigate('/new');

 // Re-configurar cloud sync (botones en dashboard)
 setupCloudSync();
}

// ── Nuevo Evento ──────────────────────────────────────────────────────────

async function renderNewEvent(): Promise<void> {
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

async function renderEvent(eventId: string): Promise<void> {
 const container = document.getElementById('event-detail-container');
 if (!container) return;

 const id = Number(eventId);
 let event: ShootingEvent | undefined;
 let participants: Participant[] = [];
 let allSeries: Series[] = [];

 try {
  [event, participants, allSeries] = await Promise.all([
   db.events.get(id),
   db.participants.where('eventId').equals(id).toArray(),
   db.series.where('eventId').equals(id).toArray(),
  ]);
 } catch (err) {
  console.error('[DB] Error cargando evento:', err);
  container.innerHTML = `<div class="empty-state"><div class="empty-icon"></div>
   <p class="text-sm text-error">Error al cargar el evento.</p></div>`;
  return;
 }

 if (!event) {
  container.innerHTML = `<div class="empty-state">
   <div class="empty-icon" aria-hidden="true"></div>
   <p style="color:#64748b;">Evento no encontrado.</p>
   <button class="btn-ghost-custom" id="btn-back-notfound" style="margin-top:8px;">← Inicio</button>
  </div>`;
  document.getElementById('btn-back-notfound')?.addEventListener('click', () => navigate('/'));
  return;
 }

 // Ordenar participantes por número correlativo
 participants.sort((a, b) => a.competitorNumber - b.competitorNumber);

 // --- RENDERIZADO DEL CONTENEDOR PRINCIPAL ---
 container.innerHTML = `
  <!-- Back button -->
  <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;">
   <button class="btn-ghost-custom" id="btn-back-event" aria-label="Volver al inicio">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    Inicio
   </button>
  </div>

  <!-- Header del evento -->
  <div style="margin-bottom:20px;">
   <div class="section-title" style="margin-bottom:2px;">Evento</div>
   <h1 style="margin:0 0 4px;font-family:'Rajdhani',sans-serif;font-size:1.6rem;
         font-weight:700;color:#0056b3;line-height:1.2;">${esc(event.name)}</h1>
   <p style="margin:0;font-size:0.85rem;color:#64748b;">
    ${formatDate(event.date)} ${event.location ? `· ${esc(event.location)}` : ''}
   </p>
  </div>

  <!-- TABS DE NAVEGACIÓN -->
  <div class="tabs tabs-boxed mb-6" style="background:#e2e8f0;border:1px solid #cbd5e1;display:flex;gap:4px;padding:4px;border-radius:12px;">
   <button id="tab-btn-tiradores" class="tab tab-active" style="flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:700;color:#0f172a;">
    Sorteo y Puestos (${participants.length}/32)
   </button>
   <button id="tab-btn-series" class="tab" style="flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:700;color:#475569;">
    Series y Puntuación
   </button>
  </div>

  <!-- PANEL 1: REGISTRO Y SORTEO -->
  <div id="tab-panel-tiradores" class="tab-panel">
   <!-- Formulario de Inscripción -->
   <div class="card-tactical" style="padding:16px;margin-bottom:20px;">
    <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.1rem;font-weight:700;color:#0056b3;margin-bottom:12px;">
     Inscribir Competidor
    </h3>
    <div style="display:flex;gap:10px;">
     <div style="display:flex;gap:10px;flex:1;">
      <input type="text" id="field-participant-name" class="field-input" style="flex:2;"
          placeholder="Nombre completo" maxlength="60" list="padron-suggestions"
          ${participants.length >= 32 ? 'disabled placeholder="Capacidad máxima (32)"' : ''} />
       <datalist id="padron-suggestions"></datalist>
      <input type="text" id="field-participant-category" class="field-input" style="flex:1;"
          placeholder="Categoría (ej: Senior)" maxlength="30"
          ${participants.length >= 32 ? 'disabled' : ''} />
     </div>
     <button id="btn-add-participant" class="btn-primary-custom" style="padding:10px 18px;"
         ${participants.length >= 32 ? 'disabled' : ''}>
      Inscribir
     </button>
    </div>
    <div style="font-size:0.72rem;color:#475569;margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
     <span>Asignación de número aleatoria al inscribir.</span>
     <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button id="btn-padron-selector" class="btn-ghost-custom" style="font-size:0.68rem;padding:4px 8px;border-color:rgba(0,86,179,0.35);color:#0056b3;"
          title="Seleccionar tirador del Padrón Maestro" ${participants.length >= 32 ? 'disabled' : ''}>
        Padrón Maestro
      </button>
      <button id="btn-seed-participants" class="btn-ghost-custom" style="font-size:0.68rem;padding:4px 8px;border-color:rgba(59,130,246,0.25);" title="Importar tiradores registrados en el Padrón Maestro que falten en este evento">
        Importar Padrón en Lote
      </button>
      <button id="btn-seed-scores" class="btn-ghost-custom" style="font-size:0.68rem;padding:4px 8px;border-color:rgba(34,197,94,0.25);color:#22c55e;"
          ${participants.length === 0 ? 'disabled' : ''}>
        Simular Resultados
      </button>
     </div>
    </div>
   </div>

   <!-- Sorteo Acción -->
   <div class="card-tactical" style="padding:16px;margin-bottom:20px;border-color:rgba(245,158,11,0.25);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
     <div>
      <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.1rem;font-weight:700;color:#d97706;margin:0;">
       Sorteo de Puestos
      </h3>
      <p style="margin:4px 0 0;font-size:0.78rem;color:#64748b;">
       Sortea aleatoriamente en 8 Tandas (Spots 1-4). Reglas especiales de la organización aplicadas automáticamente.
      </p>
     </div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btn-shuffle-sorteo" class="btn-primary-custom" 
          style="background:#d97706;color:#ffffff;border-color:#d97706;padding:12px 20px;"
          ${participants.length === 0 ? 'disabled' : ''}>
        Sortear Posiciones
      </button>
      <button id="btn-reorder-heats" class="btn-ghost-custom"
          style="padding:12px 16px;font-size:0.8rem;border-color:rgba(245,158,11,0.35);color:#d97706;"
          ${participants.length === 0 ? 'disabled' : ''}
          title="Reasignar tandas manualmente">
        Reordenar Manual
      </button>
      <button id="btn-undo-sorteo" class="btn-ghost-custom"
          style="padding:12px 16px;font-size:0.8rem;border-color:rgba(239,68,68,0.35);color:#ef4444;"
          ${participants.some(p => p.tanda !== undefined) ? '' : 'disabled'}
          title="Deshacer sorteo y limpiar todas las asignaciones de tandas">
        Deshacer Sorteo
      </button>
     </div>
    </div>
   </div>

   <!-- Cuadro de Tiro por Tandas -->
   <div id="cuadro-sorteo-container"></div>

   <!-- Lista Plana de Inscritos -->
   <div class="section-title" style="margin:24px 0 10px;">Competidores Registrados</div>
   <div id="lista-inscritos" style="display:flex;flex-direction:column;gap:8px;"></div>
  </div>

  <!-- PANEL 2: SERIES Y PUNTUACIÓN -->
  <div id="tab-panel-series" class="tab-panel hidden">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div class="section-title" style="margin:0;">Series por Tirador</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
     ${participants.length > 0 ? `
      <button class="btn-ghost-custom" id="btn-print-ranking" style="padding:8px 12px;font-size:0.75rem;border-color:rgba(245,158,11,0.25);color:#d97706;"
          aria-label="Ver y Exportar Tabla de Posiciones">
        Tabla de Resultados
      </button>` : ''}
     ${participants.length > 0 ? `
      <button class="btn-ghost-custom" id="btn-export-excel" style="padding:8px 12px;font-size:0.75rem;border-color:rgba(34,197,94,0.25);color:#22c55e;"
          aria-label="Exportar todos los datos a CSV">
        Exportar CSV
      </button>` : ''}
     ${participants.length > 1 ? `
      <button class="btn-ghost-custom" id="btn-resolve-ties" style="padding:8px 12px;font-size:0.75rem;border-color:rgba(99,102,241,0.35);color:#6366f1;"
          aria-label="Resolver empates de posiciones manualmente"
          title="Resolver empates ordenándolos uno a uno en desempate">
        Resolver Desempates
      </button>` : ''}
     <button class="btn-ghost-custom" id="btn-export-backup" style="padding:8px 12px;font-size:0.75rem;border-color:rgba(59,130,246,0.35);color:#3b82f6;"
          aria-label="Exportar copia de seguridad del evento"
          title="Exportar como .json para importar en otra máquina">
       Exportar Copia
     </button>
     ${allSeries.length > 0 ? `
      <button class="btn-ghost-custom" id="btn-clear-all-series" style="padding:8px 12px;font-size:0.75rem;border-color:rgba(239,68,68,0.35);color:#ef4444;"
          aria-label="Vaciar todas las series del evento" title="Eliminar todas las series y resultados (los tiradores se mantienen)">
        Reiniciar Todo
      </button>` : ''}
     ${allSeries.length > 0 ? `
      <button class="btn-ghost-custom" id="btn-print-event" style="padding:8px 12px;font-size:0.75rem;"
          aria-label="Imprimir todas las planillas">
        Imprimir Todo
      </button>` : ''}
    </div>
   </div>
   <div id="lista-series-por-tirador" style="display:flex;flex-direction:column;gap:16px;"></div>
  </div>`;

 // --- ELEMENTOS DE LA INTERFAZ ---
 const btnTiradores = document.getElementById('tab-btn-tiradores');
 const btnSeries = document.getElementById('tab-btn-series');
 const panelTiradores = document.getElementById('tab-panel-tiradores');
 const panelSeries = document.getElementById('tab-panel-series');

 // --- LÓGICA DE TABS ---
 btnTiradores?.addEventListener('click', () => {
  btnTiradores.classList.add('tab-active');
  btnSeries?.classList.remove('tab-active');
  panelTiradores?.classList.remove('hidden');
  panelSeries?.classList.add('hidden');
 });

 btnSeries?.addEventListener('click', () => {
  btnSeries.classList.add('tab-active');
  btnTiradores?.classList.remove('tab-active');
  panelSeries?.classList.remove('hidden');
  panelTiradores?.classList.add('hidden');
 });

 // --- RENDER DE LISTA DE INSCRITOS ---
 let pFilterTanda = 'all';
 let pFilterStatus = 'all';
 let pFilterPayment = 'all';
 let pSortBy = 'num';

 function renderListaInscritos(): void {
  const listEl = document.getElementById('lista-inscritos');
  if (!listEl) return;

  if (participants.length === 0) {
   listEl.innerHTML = `<div style="text-align:center;padding:24px;font-size:0.82rem;color:#475569;">
    Ningún competidor inscrito en este evento.</div>`;
   return;
  }

  // Filtrar
  let displayed = [...participants];
  if (pFilterTanda !== 'all') {
   if (pFilterTanda === 'none') {
    displayed = displayed.filter(p => p.tanda === undefined);
   } else {
    displayed = displayed.filter(p => p.tanda === Number(pFilterTanda));
   }
  }
  if (pFilterStatus !== 'all') {
   displayed = displayed.filter(p => (p.status || 'active') === pFilterStatus);
  }
  if (pFilterPayment !== 'all') {
   displayed = displayed.filter(p => (p.paymentStatus || 'paid') === pFilterPayment);
  }

  // Ordenar
  displayed.sort((a, b) => {
   if (pSortBy === 'name') return a.name.localeCompare(b.name);
   if (pSortBy === 'tanda') return (a.tanda ?? 99) - (b.tanda ?? 99);
   if (pSortBy === 'payment') return (a.paymentStatus || 'paid').localeCompare(b.paymentStatus || 'paid');
   return a.competitorNumber - b.competitorNumber;
  });

  const filterBarHtml = `
   <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;background:#f8fafc;padding:10px;border-radius:10px;border:1px solid #e2e8f0;">
    <div style="display:flex;align-items:center;gap:4px;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;">Tanda:</label>
     <select id="p-filter-tanda" style="font-size:0.78rem;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-weight:600;">
      <option value="all" ${pFilterTanda === 'all' ? 'selected' : ''}>Todas</option>
      ${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}" ${pFilterTanda === String(i + 1) ? 'selected' : ''}>Tanda ${i + 1}</option>`).join('')}
      <option value="none" ${pFilterTanda === 'none' ? 'selected' : ''}>Sin Tanda</option>
     </select>
    </div>

    <div style="display:flex;align-items:center;gap:4px;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;">Estado:</label>
     <select id="p-filter-status" style="font-size:0.78rem;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-weight:600;">
      <option value="all" ${pFilterStatus === 'all' ? 'selected' : ''}>Todos</option>
      <option value="active" ${pFilterStatus === 'active' ? 'selected' : ''}>Activos</option>
      <option value="dq" ${pFilterStatus === 'dq' ? 'selected' : ''}>DQ</option>
      <option value="dns" ${pFilterStatus === 'dns' ? 'selected' : ''}>DNS</option>
     </select>
    </div>

    <div style="display:flex;align-items:center;gap:4px;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;">Pago:</label>
     <select id="p-filter-payment" style="font-size:0.78rem;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-weight:600;">
      <option value="all" ${pFilterPayment === 'all' ? 'selected' : ''}>Todos</option>
      <option value="paid" ${pFilterPayment === 'paid' ? 'selected' : ''}>Abonados</option>
      <option value="pending" ${pFilterPayment === 'pending' ? 'selected' : ''}>Pendientes</option>
     </select>
    </div>

    <div style="display:flex;align-items:center;gap:4px;margin-left:auto;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;">Orden:</label>
     <select id="p-sort-by" style="font-size:0.78rem;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-weight:600;">
      <option value="num" ${pSortBy === 'num' ? 'selected' : ''}>Nº Competidor</option>
      <option value="name" ${pSortBy === 'name' ? 'selected' : ''}>Nombre (A-Z)</option>
      <option value="tanda" ${pSortBy === 'tanda' ? 'selected' : ''}>Por Tanda</option>
      <option value="payment" ${pSortBy === 'payment' ? 'selected' : ''}>Estado de Pago</option>
     </select>
    </div>
   </div>
  `;

  const rowsHtml = displayed.length > 0
   ? displayed.map((p) => {
    const cleanCategory = (p.category || '').split('::')[0];
    const statusBadge = p.status === 'dq'
     ? `<span style="font-size:0.65rem;background:#fee2e2;color:#b7201c;padding:2px 6px;border-radius:4px;font-weight:700;border:1px solid #fca5a5;">DQ</span>`
     : p.status === 'dns'
     ? `<span style="font-size:0.65rem;background:#fef3c7;color:#d97706;padding:2px 6px;border-radius:4px;font-weight:700;border:1px solid #fde68a;">DNS</span>`
     : '';
    const payBadge = p.paymentStatus === 'pending'
     ? `<span style="font-size:0.65rem;background:#fff7ed;color:#ea580c;padding:2px 5px;border-radius:4px;font-weight:700;border:1px solid #fed7aa;">$ Pendiente</span>`
     : p.paymentStatus === 'paid'
     ? `<span style="font-size:0.65rem;background:#f0fdf4;color:#16a34a;padding:2px 5px;border-radius:4px;font-weight:700;border:1px solid #bbf7d0;">$ Abonado</span>`
     : '';
    const isRaffleChecked = p.presentForRaffle !== false;
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;
          background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
     <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;font-weight:700;
             background:#f1f5f9;padding:4px 8px;border-radius:6px;color:#0056b3;">
       #${p.competitorNumber}
      </span>
      <span style="font-weight:600;color:#0f172a;font-size:0.9rem;">${esc(p.name)}</span>
      ${cleanCategory ? `<span style="font-size:0.75rem;color:#64748b;">(${esc(cleanCategory)})</span>` : ''}
      ${p.tanda ? `<span style="font-size:0.68rem;background:rgba(0,86,179,0.1);color:#0056b3;padding:2px 6px;border-radius:4px;border:1px solid rgba(0,86,179,0.2);">T${p.tanda} · P${p.spot}</span>` : ''}
      ${statusBadge}${payBadge}
      <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;cursor:pointer;color:#334155;margin-left:4px;" title="Presente para sorteo">
       <input type="checkbox" data-set-raffle="${p.id}" ${isRaffleChecked ? 'checked' : ''} style="cursor:pointer;" />
       <span>Sorteo</span>
      </label>
     </div>
     <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
      <select data-set-status="${p.id}" style="font-size:0.72rem;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;" title="Estado del competidor">
       <option value="active" ${!p.status || p.status === 'active' ? 'selected' : ''}>Activo</option>
       <option value="dq" ${p.status === 'dq' ? 'selected' : ''}>DQ (Descalif.)</option>
       <option value="dns" ${p.status === 'dns' ? 'selected' : ''}>DNS (No se presentó)</option>
      </select>
      <select data-set-payment="${p.id}" style="font-size:0.72rem;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;" title="Estado de pago">
       <option value="paid" ${!p.paymentStatus || p.paymentStatus === 'paid' ? 'selected' : ''}>$ Abonado</option>
       <option value="pending" ${p.paymentStatus === 'pending' ? 'selected' : ''}>$ Pendiente</option>
       <option value="exempt" ${p.paymentStatus === 'exempt' ? 'selected' : ''}>Exento</option>
      </select>
      <button class="btn-ghost-custom" data-edit-participant="${p.id}" style="padding:6px 10px;font-size:0.72rem;font-weight:700;color:#0056b3;border-color:#0056b3;">
       Editar
      </button>
      <button class="btn-danger-custom" data-remove-participant="${p.id}"
          aria-label="Eliminar inscripcion de ${esc(p.name)}" style="padding:6px 10px;font-size:0.72rem;font-weight:700;">
       Eliminar
      </button>
     </div>
    </div>`;
   }).join('')
   : `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:0.85rem;">No se encontraron competidores con los filtros seleccionados.</div>`;

  listEl.innerHTML = filterBarHtml + `<div style="display:flex;flex-direction:column;gap:8px;">${rowsHtml}</div>`;

  // Bind dropdown filters
  (listEl.querySelector('#p-filter-tanda') as HTMLSelectElement)?.addEventListener('change', (e) => {
   pFilterTanda = (e.target as HTMLSelectElement).value;
   renderListaInscritos();
  });
  (listEl.querySelector('#p-filter-status') as HTMLSelectElement)?.addEventListener('change', (e) => {
   pFilterStatus = (e.target as HTMLSelectElement).value;
   renderListaInscritos();
  });
  (listEl.querySelector('#p-filter-payment') as HTMLSelectElement)?.addEventListener('change', (e) => {
   pFilterPayment = (e.target as HTMLSelectElement).value;
   renderListaInscritos();
  });
  (listEl.querySelector('#p-sort-by') as HTMLSelectElement)?.addEventListener('change', (e) => {
   pSortBy = (e.target as HTMLSortBy) === 'sort-by' ? (e.target as HTMLSelectElement).value as any : pSortBy;
   renderListaInscritos();
  });

  // Bind desinscribir
  listEl.querySelectorAll('[data-remove-participant]').forEach((btn) => {
   btn.addEventListener('click', async (e) => {
    const pid = Number((e.currentTarget as HTMLElement).dataset.removeParticipant);
    const p = participants.find(x => x.id === pid);
    if (!p) return;
    if (!await showConfirm('Eliminar Inscripción', `¿Eliminar la inscripción de ${p.name}? Se perderán sus series.`)) return;

    try {
     await db.participants.delete(pid);
     await db.series.where('participantId').equals(pid).delete();

     // Reordenar secuencialmente los participantes restantes del evento
     const restantes = await db.participants.where('eventId').equals(id).toArray();
     restantes.sort((a, b) => a.competitorNumber - b.competitorNumber);
     for (let i = 0; i < restantes.length; i++) {
       const nuevoNum = i + 1;
       if (restantes[i].competitorNumber !== nuevoNum) {
         await db.participants.update(restantes[i].id!, { competitorNumber: nuevoNum });
       }
     }

     showToast('Inscripción eliminada. Tiradores reordenados consecutivamente.', 'info');
     // recargar datos y UI
     participants = await db.participants.where('eventId').equals(id).toArray();
     allSeries = await db.series.where('eventId').equals(id).toArray();
     participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
     renderListaInscritos();
     renderCuadroSorteo();
     renderListaSeries();
     // actualizar contador en el tab
     if (btnTiradores) btnTiradores.textContent = `Sorteo y Puestos (${participants.length}/32)`;
     
     // Actualizar estado del botón de sorteo
     const btnShuffle = document.getElementById('btn-shuffle-sorteo') as HTMLButtonElement | null;
     if (btnShuffle) btnShuffle.disabled = participants.length === 0;
    } catch (err) {
     console.error('[DB] Error desinscribiendo:', err);
     showToast('Error al eliminar la inscripción', 'error');
    }
   });
  });




  // Bind cambio de estado (DQ / DNS / Active)
  listEl.querySelectorAll('[data-set-status]').forEach((sel) => {
   sel.addEventListener('change', async (e) => {
    const pid = Number((e.currentTarget as HTMLElement).dataset.setStatus);
    const val = (e.currentTarget as HTMLSelectElement).value as 'active' | 'dq' | 'dns';
    await db.participants.update(pid, { status: val });
    participants = await db.participants.where('eventId').equals(id).toArray();
    participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
    renderListaInscritos();
    renderListaSeries();
    showToast(val === 'dq' ? 'Competidor DQ (Descalificado)' : val === 'dns' ? 'Competidor DNS (No se presentó)' : 'Competidor reactivado', val === 'active' ? 'success' : 'info');
   });
  });

  // Bind cambio de estado de pago
  listEl.querySelectorAll('[data-set-payment]').forEach((sel) => {
   sel.addEventListener('change', async (e) => {
    const pid = Number((e.currentTarget as HTMLElement).dataset.setPayment);
    const val = (e.currentTarget as HTMLSelectElement).value as 'paid' | 'pending' | 'exempt';
    await db.participants.update(pid, { paymentStatus: val });
    participants = await db.participants.where('eventId').equals(id).toArray();
    participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
     renderListaInscritos();
     showToast(val === 'paid' ? 'Pago registrado como Abonado' : val === 'pending' ? 'Pago marcado como Pendiente' : 'Competidor marcado como Exento', 'info');
    });
   });

  // Bind edit participant name
  listEl.querySelectorAll('[data-edit-participant]').forEach((btn) => {
   btn.addEventListener('click', async (e) => {
    const pid = Number((e.currentTarget as HTMLElement).dataset.editParticipant);
    const p = participants.find(x => x.id === pid);
    if (!p) return;
    const newName = await showPrompt('Editar Competidor', 'Nuevo nombre del competidor:', p.name);
    if (newName !== null && newName.trim() !== '') {
     await db.participants.update(pid, { name: newName.trim() });
     participants = await db.participants.where('eventId').equals(id).toArray();
     participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
     renderListaInscritos();
     renderCuadroSorteo();
     renderListaSeries();
     showToast('Nombre actualizado con éxito', 'success');
    }
   });
  });

  // Bind present for raffle checkbox
  listEl.querySelectorAll('[data-set-raffle]').forEach((chk) => {
   chk.addEventListener('change', async (e) => {
    const pid = Number((e.currentTarget as HTMLElement).dataset.setRaffle);
    const checked = (e.currentTarget as HTMLInputElement).checked;
    await db.participants.update(pid, { presentForRaffle: checked });
    participants = await db.participants.where('eventId').equals(id).toArray();
    showToast(checked ? 'Marcado Presente para sorteo' : 'Marcado Ausente para sorteo', 'info');
   });
  });
 }

 // --- RENDER DEL CUADRO DE SORTEO (8 TANDAS) ---
 function renderCuadroSorteo(): void {
  const tableEl = document.getElementById('cuadro-sorteo-container');
  if (!tableEl) return;

  // Verificar si ya se sorteó (al menos uno tiene tanda asignada)
  const sortedParticipants = participants.filter(p => p.tanda !== undefined);
  if (sortedParticipants.length === 0) {
   tableEl.innerHTML = `
    <div style="text-align:center;padding:32px 16px;border:1px dashed #cbd5e1;border-radius:12px;">
     <div style="font-size:1.6rem;margin-bottom:6px;"></div>
     <div style="font-size:0.8rem;color:#475569;">Sorteo pendiente. Presioná el botón de arriba.</div>
    </div>`;
   return;
  }

  let html = `<div style="display:flex;flex-direction:column;gap:18px;">`;

  // 8 Tandas de 4 spots cada una (32 competidores max)
  for (let t = 1; t <= 8; t++) {
    const getCompetitor = (spotNum: 1 | 2 | 3 | 4) => {
      return participants.find(p => p.tanda === t && p.spot === spotNum);
    };

    html += `
     <div class="card-tactical" style="padding:14px;border-color:#e2e8f0;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;font-weight:900;
            color:#0f172a;letter-spacing:0.08em;margin-bottom:10px;text-align:center;
            border-bottom:1px solid #f1f5f9;padding-bottom:6px;">
       TANDA ${t}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${[1, 2, 3, 4].map(spotNum => {
          const p = getCompetitor(spotNum as 1 | 2 | 3 | 4);
          return renderSpotCell(spotNum, p);
        }).join('')}
      </div>
     </div>`;
  }

  html += `</div>`;
  tableEl.innerHTML = html;

  // Bind click en spots con competidor para ver sus series
  tableEl.querySelectorAll('[data-goto-participant-id]').forEach(cell => {
   cell.addEventListener('click', () => {
    const pid = Number((cell as HTMLElement).dataset.gotoParticipantId);
    // Switch tab a series
    if (btnSeries) btnSeries.click();
    // Scroll suave al tirador
    setTimeout(() => {
     const targetEl = document.getElementById(`tirador-block-${pid}`);
     if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
   });
  });
 }

 function renderSpotCell(spotNum: number, p: Participant | undefined): string {
  if (!p) {
   return `
    <div style="border:1px dashed #cbd5e1;border-radius:8px;padding:8px;
          text-align:center;font-size:0.75rem;color:#64748b;">
     Puesto ${spotNum}: [Libre]
    </div>`;
  }
  return `
   <div data-goto-participant-id="${p.id}"
      style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;
         padding:8px 10px;font-size:0.75rem;cursor:pointer;
         display:flex;align-items:center;gap:6px;transition:border-color 0.2s;">
    <span style="font-weight:900;color:#64748b;">P${spotNum}</span>
    <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#0056b3;">#${p.competitorNumber}</span>
    <span style="font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">
     ${esc(p.name)}
    </span>
   </div>`;
 }

 // --- RENDER DE LISTA DE SERIES (PANEL 2) ---
 function renderListaSeries(): void {
  const containerEl = document.getElementById('lista-series-por-tirador');
  if (!containerEl) return;

  if (participants.length === 0) {
   containerEl.innerHTML = `<div style="text-align:center;padding:24px;font-size:0.82rem;color:#475569;">
    Inscribí competidores para poder cargarles series de tiro.</div>`;
   return;
  }

  containerEl.innerHTML = participants.map((p) => {
   // Filtrar series de este participante
   const pSeries = allSeries.filter(s => s.participantId === p.id);
   const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);

   const seriesCards = pSeries.length > 0
    ? pSeries.map(s => {
      const shotDots = Array.from({ length: 10 }, (_, i) => {
       const sh = s.shots[i];
       if (!sh) return `<span class="shot-dot" style="background:#e2e8f0;color:#94a3b8;">·</span>`;
       return `<span class="shot-dot ${sh.hit ? 'hit' : 'miss'}">${sh.hit ? 'O' : 'X'}</span>`;
      }).join('');
      return `
      <div class="series-card" data-series-id="${s.id}" role="button" tabindex="0"
         style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;margin-top:6px;border-radius:10px;">
       <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div style="flex:1;min-width:0;">
         <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;font-weight:700;color:#64748b;margin-bottom:6px;">
          SERIE ${s.seriesNumber}
         </div>
         <div style="display:flex;gap:3px;flex-wrap:wrap;">${shotDots}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
         <div style="font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:700;color:#d97706;">
          ${s.totalScore}
         </div>
         <div style="font-size:0.6rem;color:#475569;">/ 67 pts</div>
        </div>
       </div>
      </div>`;
     }).join('')
    : `<div style="font-size:0.75rem;color:#475569;margin-top:4px;">Sin series registradas</div>`;

   return `
   <div id="tirador-block-${p.id}" class="card-tactical" style="padding:14px;border-color:#e2e8f0;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;
          border-bottom:1px solid #f1f5f9;padding-bottom:10px;margin-bottom:8px;">
     <div>
      <div style="display:flex;align-items:center;gap:6px;">
       <span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:#0056b3;font-weight:700;">
        #${p.competitorNumber}
       </span>
       <h4 style="margin:0;font-size:0.95rem;font-weight:700;color:#0056b3;">${esc(p.name)}</h4>${p.category ? ` <span style="font-size:0.75rem;color:#64748b;">(${esc(p.category.split('::')[0])})</span>` : ''}
      </div>
      <div style="font-size:0.7rem;color:#64748b;margin-top:2px;">
       ${p.tanda ? `Tanda ${p.tanda} — Puesto ${p.spot}` : 'Posición no sorteada'}
       ${pSeries.length > 0 ? `· Acumulado: <strong style="color:#22c55e;">${totalScore} pts</strong>` : ''}
      </div>
     </div>
     <div style="display:flex;gap:6px;">
      ${pSeries.length > 0 ? `
      <button class="btn-ghost-custom" data-clear-series-for="${p.id}"
          style="font-size:0.7rem;padding:6px 10px;border-color:rgba(239,68,68,0.25);color:#ef4444;" aria-label="Limpiar series para ${esc(p.name)}" title="Eliminar las series de este tirador">
       Vaciar
      </button>` : ''}
      ${pSeries.length < 2 ? `
      <button class="btn-primary-custom" data-add-series-for="${p.id}"
          style="font-size:0.7rem;padding:6px 10px;" aria-label="Nueva serie para ${esc(p.name)}">
       + Serie
      </button>` : ''}
     </div>
    </div>
    <div>
     ${seriesCards}
    </div>
   </div>`;
  }).join('');

  // Bind Nueva Serie
  containerEl.querySelectorAll('[data-add-series-for]').forEach(btn => {
   btn.addEventListener('click', async (e) => {
    const pid = Number((e.currentTarget as HTMLElement).dataset.addSeriesFor);
    const p = participants.find(x => x.id === pid);
    if (!p) return;

    const btnEl = e.currentTarget as HTMLButtonElement;
    btnEl.disabled = true;
    btnEl.textContent = 'Creando…';

    try {
     const existingSeries = allSeries.filter(s => s.participantId === pid);
     if (existingSeries.length >= 2) {
      showToast('Límite alcanzado: Máximo 2 series por participante.', 'error');
      btnEl.disabled = false;
      btnEl.textContent = '+ Serie';
      return;
     }
     const nextNum = existingSeries.length > 0
      ? Math.max(...existingSeries.map(s => s.seriesNumber)) + 1
      : 1;

     const seriesId = await db.series.add({
      eventId: id,
      participantId: pid,
      seriesNumber: nextNum,
      shots: [],
      totalScore: 0,
      createdAt: Date.now()
     });
     navigate(`/series/${seriesId}`);
    } catch (err) {
     console.error('[DB] Error creando serie:', err);
     showToast('Error al crear la serie.', 'error');
     btnEl.disabled = false;
     btnEl.textContent = '+ Serie';
    }
   });
  });

  // Bind Limpiar Series por Tirador
  containerEl.querySelectorAll('[data-clear-series-for]').forEach(btn => {
   btn.addEventListener('click', async (e) => {
    const pid = Number((e.currentTarget as HTMLElement).dataset.clearSeriesFor);
    const p = participants.find(x => x.id === pid);
    if (!p) return;
    if (!await showConfirm('Vaciar Series', `¿Eliminar TODAS las series de ${p.name}? Esto dejará sus puntajes en cero.`)) return;
    try {
     await db.series.where('participantId').equals(pid).delete();
     allSeries = await db.series.where('eventId').equals(id).toArray();
     renderListaSeries();
     showToast(`Series de ${p.name} eliminadas.`, 'info');
    } catch (err) {
     console.error('[DB] Error borrando series del participante:', err);
     showToast('Error al vaciar series.', 'error');
    }
   });
  });

  // Bind click en series para ir al score
  containerEl.querySelectorAll('[data-series-id]').forEach(card => {
   card.addEventListener('click', () => {
    navigate(`/series/${(card as HTMLElement).dataset.seriesId}`);
   });
  });
 }

 // --- HELPER: ENCONTRAR PRIMER PUESTO LIBRE EN EL CUADRO DE SORTEO ---
 function findFirstFreeSpot(existingParticipants: Participant[]): { tanda: number, spot: 1 | 2 | 3 | 4 } | null {
  const hasBeenSorted = existingParticipants.some(p => p.tanda !== undefined);
  if (!hasBeenSorted) return null;

  const occupied = new Set(
   existingParticipants
    .filter(p => p.tanda !== undefined)
    .map(p => `${p.tanda}_${p.spot}`)
  );

  for (let t = 1; t <= 8; t++) {
   for (let s = 1; s <= 4; s++) {
    const key = `${t}_${s}`;
    if (!occupied.has(key)) {
     return { tanda: t, spot: s as 1 | 2 | 3 | 4 };
    }
   }
  }
  return null;
 }

 // --- HANDLER: INSCRIBIR PARTICIPANTE ---
 document.getElementById('btn-add-participant')?.addEventListener('click', async () => {
  const input = document.getElementById('field-participant-name') as HTMLInputElement | null;
  const catInput = document.getElementById('field-participant-category') as HTMLInputElement | null;
  if (!input || !catInput) return;
  const name = input.value.trim();
  const categoryVal = catInput.value.trim();
  if (!name) { showToast('Ingresá el nombre del tirador', 'error'); return; }

  if (participants.length >= 32) {
   showToast('Capacidad máxima de 32 personas alcanzada.', 'error');
   return;
  }

  const normalizedNewName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (participants.some(p => p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === normalizedNewName)) {
   showToast(`El tirador "${name}" ya está inscrito en este evento.`, 'error');
   return;
  }

  try {
   const chosenNumber = participants.length > 0 ? Math.max(...participants.map(p => p.competitorNumber)) + 1 : 1;
   const freeSpot = findFirstFreeSpot(participants);

   await db.participants.add({
    eventId: id,
    name,
    category: categoryVal || undefined,
    competitorNumber: chosenNumber,
    tanda: freeSpot?.tanda,
    spot: freeSpot?.spot,
    status: 'active',
    paymentStatus: 'paid'
   });

   // Agregar al Padrón Maestro silenciosamente (sin duplicar)
   addMasterCompetitor(name, categoryVal).catch(err => console.warn('[Padrón] No se pudo agregar:', err));

   input.value = '';
   catInput.value = '';
   showToast(`Inscrito Competidor #${chosenNumber}`, 'success');

   // recargar
   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
   renderListaSeries();

   // actualizar contador en el tab
   if (btnTiradores) btnTiradores.textContent = `Sorteo y Puestos (${participants.length}/32)`;


    // Actualizar estado de los botones de sorteo
    const btnShuffle = document.getElementById('btn-shuffle-sorteo');
    if (btnShuffle) btnShuffle.disabled = participants.length === 0;
    const btnUndoState = document.getElementById('btn-undo-sorteo');
    if (btnUndoState) {
      const hasRaffle = participants.some(p => p.tanda !== undefined);
      btnUndoState.disabled = !hasRaffle;
    }

  } catch (err) {
   console.error('[DB] Error inscribiendo competidor:', err);
   showToast('Error al guardar la inscripción.', 'error');
  }
 });

 // --- HANDLER: PADRÓN MAESTRO SELECTOR ---
 document.getElementById('btn-padron-selector')?.addEventListener('click', async () => {
  if (participants.length >= 32) { showToast('Capacidad máxima alcanzada.', 'error'); return; }
  await renderMasterCompetitorsModal(async (mc) => {
   // Pre-fill the name input from Padrón selection
   const nameInput = document.getElementById('field-participant-name') as HTMLInputElement | null;
   const catInput2 = document.getElementById('field-participant-category') as HTMLInputElement | null;
   if (nameInput) nameInput.value = mc.name;
   if (catInput2) catInput2.value = mc.category || '';
   showToast(`Tirador "${mc.name}" seleccionado del Padrón. Presioná Inscribir para confirmar.`, 'info', 3500);
  });
 });

 // --- HANDLER: POBLAR tiradores DEMO ---
 document.getElementById('btn-seed-participants')?.addEventListener('click', async () => {
  await handleSeedParticipants(id, participants, findFirstFreeSpot, async () => {
   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
   renderListaSeries();
   if (btnTiradores) btnTiradores.textContent = `Sorteo y Puestos (${participants.length}/32)`;
   const btnShuffle = document.getElementById('btn-shuffle-sorteo') as HTMLButtonElement | null;
   if (btnShuffle) btnShuffle.disabled = participants.length === 0;
   const btnSeedScores = document.getElementById('btn-seed-scores') as HTMLButtonElement | null;
   if (btnSeedScores) btnSeedScores.disabled = false;
  });
 });
 // --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---
 document.getElementById('btn-seed-scores')?.addEventListener('click', async () => {
  await handleSeedScores(id, participants, async () => {
   allSeries = await db.series.where('eventId').equals(id).toArray();
   renderListaSeries();
   await renderEvent(String(id));
  });
 });
 // --- HANDLER: REALIZAR SORTEO ALEATORIO ---
 document.getElementById('btn-shuffle-sorteo')?.addEventListener('click', async () => {
  if (participants.length === 0) {
   showToast('No hay competidores inscritos para sortear.', 'error');
   return;
  }

  const presentes = participants.filter(p => p.presentForRaffle !== false);
  const ausentes = participants.length - presentes.length;

  if (presentes.length === 0) {
   showToast('No hay competidores marcados como presentes para el sorteo.', 'error');
   return;
  }

  const msg = ausentes > 0 
    ? `¿Realizar el sorteo aleatorio de posiciones para los ${presentes.length} competidores presentes? (${ausentes} ausentes quedarán sin tanda)`
    : '¿Realizar el sorteo aleatorio de posiciones? Esto reasignará a todos los competidores actuales.';

  if (!await showConfirm('Realizar Sorteo', msg)) return;

  try {
   const list = [...presentes];
   const N = list.length;

   const compNumbers = Array.from({ length: N }, (_, i) => i + 1);
   for (let i = compNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [compNumbers[i], compNumbers[j]] = [compNumbers[j], compNumbers[i]];
   }

   for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
   }

   for (let i = 0; i < list.length; i++) {
    const tanda = Math.floor(i / 4) + 1;
    const spot = (i % 4) + 1;

    list[i].competitorNumber = compNumbers[i];
    list[i].tanda = tanda;
    list[i].sector = undefined;
    list[i].spot = spot;
   }

   if (typeof applySpecialFamilySeedingRules === 'function') {
      applySpecialFamilySeedingRules(list);
   }

   const listAusentes = participants.filter(p => p.presentForRaffle === false);
   for (const p of listAusentes) {
     p.tanda = undefined;
     p.sector = undefined;
     p.spot = undefined;
     
   }

   await Promise.all(list.map(p => db.participants.put(p)));
   await Promise.all(listAusentes.map(p => db.participants.put(p)));

   showToast('¡Sorteo completado! Reglas aplicadas.', 'success');

   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
   renderListaSeries();
  } catch (err) {
   console.error('[DB] Error ejecutando sorteo:', err);
   showToast('Error al guardar el sorteo.', 'error');
  }
 });

 // --- HANDLER: REORDENAR TANDAS MANUALMENTE ---
 document.getElementById('btn-reorder-heats')?.addEventListener('click', async () => {
  if (participants.length === 0) { showToast('No hay competidores inscritos.', 'error'); return; }
  await showManualHeatsReorderModal(id, async () => {
   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
  });
 });


  // --- HANDLER: DESHACER SORTEO ---
  const btnUndo = document.getElementById('btn-undo-sorteo');
  if (btnUndo) {
    // Prevent duplicate listeners if this is run multiple times by replacing the element
    const newBtnUndo = btnUndo.cloneNode(true);
    btnUndo.parentNode?.replaceChild(newBtnUndo, btnUndo);
    newBtnUndo.addEventListener('click', async () => {
      if (!await showConfirm('Deshacer Sorteo', '¿Estás seguro de deshacer el sorteo? Se borrarán todas las tandas y puestos asignados.')) return;
      try {
        for (const p of participants) {
          p.tanda = undefined;
          p.spot = undefined;
          p.sector = undefined;
          
          await db.participants.put(p);
        }
        showToast('Sorteo deshecho. Tandas y puestos restablecidos.', 'info');
        participants = await db.participants.where('eventId').equals(id).toArray();
        participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
        renderListaInscritos();
        renderCuadroSorteo();
        renderListaSeries();
      } catch (err) {
        console.error('[DB] Error deshaciendo sorteo:', err);
        showToast('Error al deshacer el sorteo', 'error');
      }
    });
  }

  // --- HANDLER: RESOLVER DESEMPATES TÁCTICO ---
  document.getElementById('btn-resolve-ties')?.addEventListener('click', () => {
   showTieBreakerModal(Number(id), participants, allSeries, async () => {
    // recargar tiradores y refrescar
    participants = await db.participants.where('eventId').equals(Number(id)).toArray();
    participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
    renderListaSeries();
   });
  });

  // --- EXPORTAR RANKING / TABLA DE POSICIONES ---
  document.getElementById('btn-export-excel')?.addEventListener('click', () => {
   if (participants.length === 0) { showToast('No hay competidores inscritos.', 'info'); return; }
   exportRankingToExcel(event!, participants, allSeries);
  });

  // --- EXPORTAR COPIA DE SEGURIDAD (JSON) ---
  document.getElementById('btn-export-backup')?.addEventListener('click', async () => {
   await exportEventBackup(Number(id));
  });

 // --- EXPORTAR RANKING / TABLA DE POSICIONES ---
 document.getElementById('btn-print-ranking')?.addEventListener('click', async () => {
  const freshParticipants = await db.participants.where('eventId').equals(Number(id)).toArray();
  if (freshParticipants.length === 0) { showToast('No hay competidores inscritos.', 'info'); return; }

  // Calcular acumulado
  const rankingData = freshParticipants.map(p => {
   const pSeries = allSeries.filter(s => s.participantId === p.id);
   const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
   return { participant: p, totalScore };
  });

  // Ordenar por puntaje total y desempates manuales
  rankingData.sort(sortRanking);

  printRankingCard(event!, rankingData);
 });

 // --- IMPRIMIR TODO EL EVENTO ---
 document.getElementById('btn-print-event')?.addEventListener('click', () => {
  if (allSeries.length === 0) { showToast('No hay series registradas.', 'info'); return; }
  printEventCards(event!, participants, allSeries);
 });

 // --- HANDLER: REINICIAR TODAS LAS SERIES ---
 document.getElementById('btn-clear-all-series')?.addEventListener('click', async () => {
  if (allSeries.length === 0) return;
  if (!await showConfirm('Reiniciar Todo', '¿Eliminar absolutamente TODAS las series de este evento? Los puntajes de todos los tiradores quedarán en 0. ¡Esta acción no se puede deshacer!')) return;
  try {
   await db.series.where('eventId').equals(id).delete();
   allSeries = [];
   renderListaSeries();
   showToast('Todas las series fueron eliminadas.', 'info');
  } catch (err) {
   console.error('[DB] Error reiniciando series:', err);
   showToast('Error al reiniciar las series.', 'error');
  }
 });

 // --- INICIALIZACIÓN DE PANELES ---
 renderListaInscritos();
 renderCuadroSorteo();
 renderListaSeries();

 // --- HANDLER: VOLVER AL INICIO (DASHBOARD) ---
 document.getElementById('btn-back-event')?.addEventListener('click', () => {
  navigate('/');
 });
}

// ── Scoring de Serie ───────────────────────────────────────────────────────

async function renderSeries(seriesId: string): Promise<void> {
 const container = document.getElementById('series-container');
 if (!container) return;

 const id = Number(seriesId);
 let series: Series | undefined;
 let event: ShootingEvent | undefined;
 let participant: Participant | undefined;

 try {
  series = await db.series.get(id);
  if (series) {
   event = await db.events.get(series.eventId);
   participant = await db.participants.get(series.participantId);
  }
 } catch (err) {
  console.error('[DB] Error cargando serie:', err);
  container.innerHTML = `<div class="empty-state"><div class="empty-icon"></div>
   <p class="text-sm" style="color:#ef4444;">Error al cargar la serie.</p></div>`;
  return;
 }

 if (!series || !participant) {
  container.innerHTML = `<div class="empty-state">
   <div class="empty-icon" aria-hidden="true"></div>
   <p style="color:#64748b;">Serie o competidor no encontrado.</p>
   <button class="btn-ghost-custom" id="btn-back-nf" style="margin-top:8px;">← Volver</button>
  </div>`;
  document.getElementById('btn-back-nf')?.addEventListener('click', () => navigate('/'));
  return;
 }

 let currentShots: Shot[] = [...series.shots].sort((a, b) => a.shotNumber - b.shotNumber);

 // ─ Persist ────────────────────────────────────────────────
 async function persistShots(): Promise<void> {
  const total = calculateSeriesTotal(currentShots);
  try {
   await db.series.update(id, { shots: currentShots, totalScore: total });
  } catch (err) {
   console.error('[DB] Error guardando:', err);
   showToast('Error al guardar. Verificá el almacenamiento.', 'error');
  }
 }

 // ─ Progress bar ───────────────────────────────────────────
 function renderProgressBar(): void {
  const bar = document.getElementById('shots-progress-bar');
  if (!bar) return;
  bar.innerHTML = Array.from({ length: 10 }, (_, i) => {
   const s = currentShots[i];
   if (!s) {
    return `<div class="shot-pip${currentShots.length === i ? ' current' : ''}"
           aria-label="Disparo ${i+1}: pendiente"></div>`;
   }
   return `<div class="shot-pip ${s.hit ? 'hit' : 'miss'}"
          title="${s.hit ? '+'+s.value+' pts' : 'Fallo'}"
          aria-label="Disparo ${i+1}: ${s.hit ? 'acierto '+s.value+' pts' : 'fallo'}"></div>`;
  }).join('');
  const c = document.getElementById('shots-count');
  if (c) c.textContent = `${currentShots.length}/10`;
 }

 // ─ Historial ──────────────────────────────────────────────
 function renderHistory(): void {
  const hist = document.getElementById('shots-history');
  if (!hist) return;
  if (currentShots.length === 0) {
   hist.innerHTML = `<div style="text-align:center;color:#334155;font-size:0.8rem;padding:16px 0;">
    Sin disparos registrados aún.</div>`;
   return;
  }
  hist.innerHTML = [...currentShots].map((s) => {
   const label = getTargetLabel(s.targetType);
   const badgeCls = getTargetBadgeClass(s.targetType);
   return `
   <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
         background:${s.hit ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'};
         border-left:3px solid ${s.hit ? '#22c55e' : '#ef4444'};
         border-radius:0 8px 8px 0;margin-bottom:6px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:#475569;
          min-width:22px;text-align:center;">D${s.shotNumber}</div>
    <span class="${badgeCls}" style="font-size:0.65rem;">${label}</span>
    <div style="flex:1;font-weight:900;font-size:1rem;color:${s.hit ? '#22c55e' : '#ef4444'}">
     ${s.hit ? 'O' : 'X'}
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-weight:700;
          color:${s.hit ? '#f59e0b' : '#475569'};">
     ${s.hit ? '+'+s.value : '0'} pts
    </div>
   </div>`;
  }).join('');
 }

 // ─ Panel de acción (próximo disparo) ──────────────────────
 function renderActionPanel(): void {
  const panel = document.getElementById('action-panel');
  if (!panel) return;

  const nextShotNum = currentShots.length + 1;
  const isComplete = nextShotNum > 10;
  const total    = calculateSeriesTotal(currentShots);
  const phase    = deriveCurrentPhase(currentShots);

  // Actualizar score header
  const scoreEl = document.getElementById('series-total-score');
  if (scoreEl) {
   scoreEl.textContent = String(total);
   scoreEl.setAttribute('aria-label', `Puntaje acumulado: ${total} de 67`);
  }

  if (isComplete) {
   panel.innerHTML = `
    <div style="text-align:center;padding:28px 16px;">
     <div style="font-size:3rem;margin-bottom:10px;"></div>
     <div style="font-family:'Rajdhani',sans-serif;font-size:1.3rem;font-weight:700;
           color:#e2e8f0;margin-bottom:6px;">Serie completa</div>
     <div style="font-family:'JetBrains Mono',monospace;font-size:2.5rem;font-weight:700;
           background:linear-gradient(135deg,#f59e0b,#fbbf24);
           -webkit-background-clip:text;-webkit-text-fill-color:transparent;
           background-clip:text;">${total} pts</div>
     <div style="font-size:0.75rem;color:#475569;margin-top:4px;">de 67 posibles</div>
    </div>`;
   return;
  }

  const hitValue = getValueIfHit(nextShotNum, phase);
  const maxIfHit = total + (hitValue ?? 1) +
   getMaxPossibleRemaining(nextShotNum + 1, phase === 'additional' ? 'additional' : getNextPhase(phase));
  const maxIfMiss = total + getMaxPossibleRemaining(nextShotNum + 1, phase);
  const costOfMiss = maxIfHit - maxIfMiss;
  const label = getTargetLabel(phase);
  const badgeCls = getTargetBadgeClass(phase);

  panel.innerHTML = `
   <div style="padding:20px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
     <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:1.7rem;font-weight:900;
            color:#e2e8f0;line-height:1;">Disparo ${nextShotNum}</div>
      <span class="${badgeCls}">${label}</span>
     </div>
     <div style="text-align:right;">
      <div style="font-size:0.62rem;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">Acumulado</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.3rem;font-weight:700;color:#f59e0b;">
       ${total} pts
      </div>
     </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
     <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);
           border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:0.62rem;color:#64748b;text-transform:uppercase;
            letter-spacing:0.08em;margin-bottom:4px;">Si aciertás</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;
            font-weight:700;color:#22c55e;">+${hitValue ?? 1} pts</div>
     </div>
     <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);
           border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:0.62rem;color:#64748b;text-transform:uppercase;
            letter-spacing:0.08em;margin-bottom:4px;">Costo de fallar</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;
            font-weight:700;color:#ef4444;">−${costOfMiss} pts</div>
     </div>
    </div>

    <div style="text-align:center;margin-bottom:18px;font-size:0.72rem;color:#475569;">
     Máximo posible ahora: <strong style="color:#94a3b8;">${maxIfHit} pts</strong>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
     <button class="btn-hit" id="btn-do-hit"
         style="font-size:2rem;padding:24px 8px;"
         aria-label="Acierto — disparo ${nextShotNum} en ${label} — vale ${hitValue ?? 1} puntos">
      O
     </button>
     <button class="btn-miss" id="btn-do-miss"
         style="font-size:2rem;padding:24px 8px;"
         aria-label="Fallo — disparo ${nextShotNum} en ${label} — 0 puntos">
      X
     </button>
    </div>
   </div>`;

  // Bind O
  document.getElementById('btn-do-hit')?.addEventListener('click', async () => {
   const sn = currentShots.length + 1;
   const ph = deriveCurrentPhase(currentShots);
   const val = calculateShotValue(sn, ph, true);
   currentShots.push({ shotNumber: sn, targetType: ph, hit: true, value: val });

   // Si se acaba de impactar el 5", rellenar automáticamente
   // los disparos restantes como adicionales (1 pt cada uno).
   const newPhase = deriveCurrentPhase(currentShots);
   if (newPhase === 'additional') {
    const nextN = currentShots.length + 1;
    for (let n = nextN; n <= 10; n++) {
     currentShots.push({ shotNumber: n, targetType: 'additional', hit: true, value: 1 });
    }
    const addCount = 10 - sn;
    await persistShots();
    renderActionPanel();
    renderHistory();
    renderProgressBar();
    updateUndoButton();
    showToast(` ${val} pts · +${addCount} adicionales automáticos`, 'success', 2500);
    return;
   }

   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(` Acierto — +${val} pts`, 'success', 1500);
  });

  // Bind X
  document.getElementById('btn-do-miss')?.addEventListener('click', async () => {
   const sn = currentShots.length + 1;
   const ph = deriveCurrentPhase(currentShots);
   currentShots.push({ shotNumber: sn, targetType: ph, hit: false, value: 0 });
   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(` Fallo — 0 pts`, 'info', 1200);
  });
 }

 // ─ Undo button ────────────────────────────────────────────
 function updateUndoButton(): void {
  const btn = document.getElementById('btn-undo') as HTMLButtonElement | null;
  if (btn) btn.disabled = currentShots.length === 0;
 }

 // ─ HTML base ──────────────────────────────────────────────
 const total = calculateSeriesTotal(currentShots);

 container.innerHTML = `
  <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
   <button class="btn-ghost-custom" id="btn-back-series" aria-label="Volver al evento">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    Volver
   </button>
   <div style="display:flex;gap:8px;">
    <button class="btn-undo" id="btn-undo" aria-label="Deshacer último disparo" disabled>
     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" aria-hidden="true">
      <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
     </svg>
     Deshacer
    </button>
    <button class="btn-ghost-custom" id="btn-print-series" style="padding:10px 14px;"
        aria-label="Imprimir planilla de esta serie">
     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" aria-hidden="true">
      <polyline points="6,9 6,2 18,2 18,9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
     </svg>
     Planilla
    </button>
   </div>
  </div>

  <div style="margin-bottom:16px;">
   <div class="section-title" style="margin-bottom:2px;">
    ${event ? esc(event.name) : ''} · Competidor #${participant.competitorNumber}
   </div>
   <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;">
    <div>
     <h2 style="margin:0;font-family:'Rajdhani',sans-serif;font-size:1.3rem;
           font-weight:700;color:#e2e8f0;line-height:1.2;">
      ${esc(participant.name)}
     </h2>
     <span style="font-size:0.7rem;color:#64748b;">
      Serie ${series!.seriesNumber} ${participant.tanda ? `· Tanda ${participant.tanda} — ${participant.sector}${participant.spot}` : ''}
     </span>
    </div>
    <div style="text-align:right;flex-shrink:0;">
     <div id="series-total-score"
        style="font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:700;
           background:linear-gradient(135deg,#f59e0b,#fbbf24);
           -webkit-background-clip:text;-webkit-text-fill-color:transparent;
           background-clip:text;"
        aria-live="polite" aria-label="Puntaje acumulado: ${total} de 67">${total}</div>
     <div style="font-size:0.7rem;color:#475569;">/ 67 pts</div>
    </div>
   </div>
  </div>

  <div style="margin-bottom:18px;">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span class="section-title">Disparos</span>
    <span id="shots-count" style="font-family:'JetBrains Mono',monospace;
       font-size:0.8rem;color:#64748b;" aria-live="polite">${currentShots.length}/10</span>
   </div>
   <div id="shots-progress-bar" class="shots-progress" role="progressbar"
      aria-valuenow="${currentShots.length}" aria-valuemin="0" aria-valuemax="10"
      aria-label="Progreso de disparos"></div>
  </div>

  <div id="action-panel" class="shot-entry" style="margin-bottom:20px;border-color:#1e3a5f;padding:0;"></div>

  <div class="section-title" style="margin-bottom:10px;">Historial</div>
  <div id="shots-history"></div>`;

 renderProgressBar();
 renderActionPanel();
 renderHistory();
 updateUndoButton();

 document.getElementById('btn-back-series')?.addEventListener('click', () => {
  navigate(`/event/${series!.eventId}`);
 });

 document.getElementById('btn-print-series')?.addEventListener('click', () => {
  if (!event) { showToast('No se puede generar la planilla sin datos del evento.', 'error'); return; }
  const sp: Series = { ...series!, shots: currentShots, totalScore: calculateSeriesTotal(currentShots) };
  printSeriesCard(event, participant!, sp);
 });

 document.getElementById('btn-undo')?.addEventListener('click', async () => {
  if (currentShots.length === 0) return;

  const lastShot = currentShots[currentShots.length - 1];

  if (lastShot.targetType === 'additional') {
   const firstAddIdx = currentShots.findIndex((s) => s.targetType === 'additional');
   const removedCount = currentShots.length - firstAddIdx;
   currentShots = currentShots.slice(0, firstAddIdx);
   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(`${removedCount} adicionales deshechos`, 'info', 1800);
  } else {
   const removed = currentShots[currentShots.length - 1];
   currentShots = currentShots.slice(0, -1);
   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(`Disparo ${removed.shotNumber} deshecho`, 'info', 1800);
  }
 });
}

// ── Router principal ───────────────────────────────────────────────────────

async function router(): Promise<void> {
 const route = getRoute();
 showView(route.view);
 try {
  switch (route.view) {
   case 'dashboard': await renderDashboard();       break;
   case 'new-event': await renderNewEvent();       break;
   case 'event':   await renderEvent(route.params.id); break;
   case 'series':   await renderSeries(route.params.id); break;
  }
 } catch (err) {
  console.error('[Router] Error inesperado:', err);
  showToast('Ocurrió un error inesperado. Recargá la app.', 'error', 5000);
 }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// ── Sincronización con Supabase (Nube) ────────────────────────────────────
import { pushLocalDatabaseToCloud, pullCloudDatabaseToLocal, toDeterministicUuid } from './sync';
import { supabase } from './supabase';

// Bind de los botones en el navbar (Subir y Descargar por separado)
const setupCloudSync = () => {
  const uploadBtn = document.getElementById('btn-cloud-upload');
  const downloadBtn = document.getElementById('btn-cloud-download');

  // Vincular botón de SUBIR
  if (uploadBtn) {
    if (!(uploadBtn as any)._hasListener) {
      (uploadBtn as any)._hasListener = true;
      uploadBtn.addEventListener('click', async () => {
        if (!navigator.onLine) {
          showToast('Sin conexión a internet. No se puede subir.', 'error', 3000);
          return;
        }

        uploadBtn.disabled = true;
        uploadBtn.style.opacity = '0.5';
        showToast('Subiendo datos locales a la nube...', 'info', 2000);

        const res = await pushLocalDatabaseToCloud();
        uploadBtn.disabled = false;
        uploadBtn.style.opacity = '1';

        if (res.success) {
          showToast('¡Datos subidos a la nube con éxito!', 'success', 3000);
        } else {
          showToast(`Error al subir: ${res.error}`, 'error', 5000);
        }
      });
    }
  }

  // Vincular botón de DESCARGAR (Bajar)
  if (downloadBtn) {
    if (!(downloadBtn as any)._hasListener) {
      (downloadBtn as any)._hasListener = true;
      downloadBtn.addEventListener('click', async () => {
        if (!navigator.onLine) {
          showToast('Sin conexión a internet. No se puede descargar.', 'error', 3000);
          return;
        }

        if (!await showConfirm('Descargar Datos', '¿Descargar datos oficiales de la nube? Esto REEMPLAZARÁ la base de datos de este dispositivo con los datos guardados en internet.')) return;

        downloadBtn.disabled = true;
        downloadBtn.style.opacity = '0.5';
        showToast('Descargando datos oficiales...', 'info', 2000);

        const res = await pullCloudDatabaseToLocal();
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';

        if (res.success) {
          await router(); // Recargar UI con datos nuevos
          showToast('¡Base de datos descargada con éxito!', 'success', 3000);
        } else {
          showToast(`Error al descargar: ${res.error}`, 'error', 5000);
        }
      });
    }
  }
};

// Configurar enlaces y auto-descarga inteligente al iniciar
window.addEventListener('load', () => {
  setupCloudSync();
  
  // Auto-descarga silenciosa al abrir si no tenemos NADA de datos locales
  if (navigator.onLine) {
    setTimeout(async () => {
      const localEvents = await db.events.toArray();
      if (localEvents.length === 0) {
        console.log('[Sync] Base de datos vacía. Iniciando descarga automática...');
        const pullRes = await pullCloudDatabaseToLocal();
        if (pullRes.success) {
          await router();
        }
      }
    }, 1200);
  }

  // Migrar participantes existentes al Padrón Maestro (silencioso, idempotente)
  setTimeout(async () => {
    try {
      const added = await migrateParticipantsToPadron();
      if (added > 0) {
        console.log(`[Padron] Migracion completada: ${added} tiradores nuevos agregados al Padron Maestro.`);
        showToast(`${added} tiradores migrados al Padron Maestro.`, 'info', 3000);
      } else {
        console.log('[Padron] Padron ya actualizado, sin nuevos tiradores para migrar.');
      }
    } catch (err) {
      console.error('[Padron] Error en migracion silenciosa:', err);
    }
  }, 2000);

  // Inicializar pestañas del Dashboard principal
  setupDashboardTabs();
});

function setupDashboardTabs() {
  const btnEventos = document.getElementById('dash-tab-btn-eventos');
  const btnCampeonato = document.getElementById('dash-tab-btn-campeonato');
  const panelEventos = document.getElementById('dash-panel-eventos');
  const panelCampeonato = document.getElementById('dash-panel-campeonato');
  const dashTitle = document.getElementById('dashboard-title');
  const btnNewEvent = document.getElementById('btn-new-event');

  if (!btnEventos || !btnCampeonato || !panelEventos || !panelCampeonato) return;

  // Evitar duplicar listeners
  if ((btnEventos as any)._hasTabListener) return;
  (btnEventos as any)._hasTabListener = true;

  btnEventos.addEventListener('click', () => {
    btnEventos.classList.add('tab-active');
    btnCampeonato.classList.remove('tab-active');
    panelEventos.classList.remove('hidden');
    panelCampeonato.classList.add('hidden');
    if (dashTitle) dashTitle.textContent = 'Mis Eventos';
    if (btnNewEvent) btnNewEvent.style.display = 'inline-flex';
    renderDashboard();
  });

  btnCampeonato.addEventListener('click', () => {
    btnCampeonato.classList.add('tab-active');
    btnEventos.classList.remove('tab-active');
    panelCampeonato.classList.remove('hidden');
    panelEventos.classList.add('hidden');
    if (dashTitle) dashTitle.textContent = 'Campeonato General';
    if (btnNewEvent) btnNewEvent.style.display = 'none';
    const container = document.getElementById('championship-container');
    if (container) {
      renderChampionshipPanel(container);
    }
  });
}

window.addEventListener('hashchange', () => {
  setTimeout(() => {
    setupCloudSync();
    setupDashboardTabs();
  }, 100);
});
