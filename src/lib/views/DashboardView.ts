import { esc, showToast, showConfirm, showPrompt } from '../modals';
import { navigate } from '../router';
import { router } from '../app';
import { db } from '../db';
import { getCurrentRole, updateUIRoles } from '../authManager';
import { getFilteredEvents, showEditEventModal } from '../eventsManager';
import { renderMasterCompetitorsModal, addMasterCompetitor } from '../masterCompetitors';
import { renderChampionshipPanel } from './ChampionshipView';
import { pushLocalDatabaseToCloud, pullCloudDatabaseToLocal, toDeterministicUuid } from '../sync';
import { importEventBackup } from '../backup';
import { supabase } from '../supabase';


export let dashSearchQuery = '';
export let dashSortBy: 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' = 'date_desc';
export let dashModalityFilter = '';
export let dashYearFilter: number | '' = '';
export let dashPage = 1;
export const DASH_ITEMS_PER_PAGE = 6;

function formatDate(isoDate: string): string {
 try {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('es-AR', {
   day: '2-digit', month: 'short', year: 'numeric',
  });
 } catch { return isoDate; }
}

export async function renderDashboard(): Promise<void> {
 const container = document.getElementById('event-list-container');
 if (!container) return;

 container.innerHTML = `<div style="text-align:center;padding:32px;color:#334155;font-size:0.85rem;">Cargando…</div>`;

 let filteredData;
 try {
  filteredData = await getFilteredEvents({
   searchQuery: dashSearchQuery,
   sortBy: dashSortBy,
   page: dashPage,
   itemsPerPage: DASH_ITEMS_PER_PAGE,
   modalityFilter: dashModalityFilter,
   yearFilter: dashYearFilter,
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

    <button id="btn-open-master-padron" class="btn-ghost-custom admin-only"
        style="padding:9px 16px;border:1.5px solid #0056b3;color:#0056b3;font-weight:700;border-radius:10px;background:#ffffff;"
        title="Administrar el Padrón Maestro de Tiradores">
      Padrón Maestro
    </button>
   </div>

   <!-- Filtros de Modalidad y Año -->
   <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <span style="font-size:0.78rem;font-weight:700;color:#64748b;white-space:nowrap;">Modalidad:</span>
    ${['', '.22 LR', '.308', '.223'].map(m => {
     const label = m === '' ? 'Todas' : m;
     const isActive = dashModalityFilter === m;
     return `<button class="dash-modality-pill" data-modality="${m}"
       style="padding:5px 14px;border-radius:20px;border:1.5px solid ${isActive ? '#0056b3' : '#cbd5e1'};
       background:${isActive ? '#0056b3' : '#fff'};color:${isActive ? '#fff' : '#475569'};
       font-size:0.8rem;font-weight:700;cursor:pointer;transition:all 0.15s;"
     >${label}</button>`;
    }).join('')}

    <span style="font-size:0.78rem;font-weight:700;color:#64748b;white-space:nowrap;margin-left:12px;">Año:</span>
    <select id="dash-year-select" style="padding:5px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.85rem;background:#fff;color:#0f172a;font-weight:600;cursor:pointer;">
      <option value="" ${dashYearFilter === '' ? 'selected' : ''}>Todos</option>
      ${[2026, 2025, 2024, 2023, 2022].map(y => `
        <option value="${y}" ${dashYearFilter === y ? 'selected' : ''}>${y}</option>
      `).join('')}
    </select>
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
  listHtml += `<div style="display:flex;flex-direction:column;gap:12px;">${events.map((e) => {
   const modalityColors: Record<string, string> = {
    '.22 LR':  '#0056b3',
    '.308':    '#b34500',
    '.223':    '#006b3c',
   };
   const mColor = modalityColors[e.modality || ''] ?? '#64748b';
   return `
   <article class="event-card" data-event-id="${e.id}" role="button" tabindex="0"
        aria-label="Evento: ${esc(e.name)}, ${formatDate(e.date)}"
        style="border-left: 4px solid ${mColor};">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
     <div style="min-width:0;flex:1;">
      <h3 style="margin:0 0 4px;font-size:1.05rem;font-weight:700;color:#0056b3;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(e.name)}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px;">
       <span style="font-size:0.72rem;background:#d52b1e;color:#ffffff;padding:2px 6px;border-radius:4px;font-weight:700;">${formatDate(e.date)}</span>
       ${e.location ? `<span style="font-size:0.72rem;background:#ffffff;color:#0f172a;padding:2px 6px;border-radius:4px;font-weight:700;border:1px solid #cbd5e1;">${esc(e.location)}</span>` : ''}
       ${e.championshipDate ? `<span style="font-size:0.72rem;background:#0038a8;color:#ffffff;padding:2px 6px;border-radius:4px;font-weight:700;">${esc(e.championshipDate)}</span>` : ''}
       ${e.modality ? `<span style="font-size:0.72rem;padding:2px 8px;border-radius:12px;font-weight:700;background:${mColor}18;color:${mColor};border:1px solid ${mColor}40;">${esc(e.modality)}</span>` : ''}
      </div>
     </div>
     <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
      <button class="btn-ghost-custom admin-only" data-edit-event-id="${e.id}"
          aria-label="Editar evento ${esc(e.name)}"
          onclick="event.stopPropagation()"
          style="padding:6px 10px;font-size:0.72rem;font-weight:700;color:#0056b3;border-color:#0056b3;">Editar</button>

      <button class="btn-danger-custom admin-only" data-delete-id="${e.id}"
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
   </article>`;
  }).join('')}</div>`;

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
   <button id="btn-import-backup" class="btn-ghost-custom admin-only"
       style="font-size:0.85rem;padding:12px 20px;border:1.5px solid #0056b3;
           border-radius:10px;color:#0056b3;font-weight:700;
           cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:#ffffff;"
       title="Importar un evento desde un archivo .json de otra máquina">
     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
     Importar Evento
   </button>
   <button id="btn-reset-db" class="btn-danger-custom admin-only"
       style="font-size:0.85rem;padding:12px 20px;border:2px solid #ef4444;
           border-radius:10px;background:#ef4444;color:#ffffff;font-weight:700;
           cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
     Vaciar Base de Datos
   </button>
   <button id="btn-cloud-upload" class="btn-ghost-custom staff-only"
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

 // Bind filtros de modalidad (pills)
 container.querySelectorAll('.dash-modality-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
   dashModalityFilter = (btn as HTMLElement).dataset.modality ?? '';
   dashPage = 1;
   renderDashboard();
  });
 });

 // Bind filtro de año
 const yearSel = document.getElementById('dash-year-select') as HTMLSelectElement;
 yearSel?.addEventListener('change', () => {
  const val = yearSel.value;
  dashYearFilter = val === '' ? '' : Number(val);
  dashPage = 1;
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
      await db.events.update(eid, { is_deleted: true });
      await db.participants.where('eventId').equals(eid).modify({ is_deleted: true });
      await db.series.where('eventId').equals(eid).modify({ is_deleted: true });
      
      const eventUuid = toDeterministicUuid(eid, 0);
      try {
        supabase.from('events').update({ is_deleted: true }).eq('id', eventUuid)
          .then(({error}) => { if(error) console.error(error); });
      } catch (e) {}

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
        supabase.from('series').update({ is_deleted: true }).neq('id', '00000000-0000-4000-0000-000000000000'),
        supabase.from('participants').update({ is_deleted: true }).neq('id', '00000000-0000-4000-0000-000000000000'),
        supabase.from('events').update({ is_deleted: true }).neq('id', '00000000-0000-4000-0000-000000000000')
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


export const setupCloudSync = () => {
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

export function setupDashboardTabs() {
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
    if (btnNewEvent) btnNewEvent.style.display = getCurrentRole() === 'admin' ? 'inline-flex' : 'none';
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
