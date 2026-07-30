/**
 * EventDetailView.ts — Orquestador de vistas de detalle de evento.
 *
 * Delega el render de cada tab a sus modulos especializados:
 *   - EventRosterView.ts     → Tab Tiradores
 *   - EventSeriesView.ts     → Tab Series
 *   - EventStandingsView.ts  → Tab Posiciones
 */

import { esc, showToast, showConfirm } from '../../modals';
import { navigate } from '../../router';
import { db } from '../../db';
import { updateUIRoles } from '../../authManager';
import type { ShootingEvent, Participant, Series, Modality } from '../../types';
import { getModalityConfig } from '../../modalityConfig';
import { printEventCards, printBlankSheet } from '../../printScoreSheet';
import { printRankingCard } from '../../printRankingCard';
import { printCFSeriesCard, printCFEventCards, printCFBlankSheet } from '../../printCF';
import html2canvas from 'html2canvas';
import { renderMasterCompetitorsModal, addMasterCompetitor } from '../../masterCompetitors';
import { applySpecialFamilySeedingRules, applySharedRifleRules } from '../../heatsRules';
import { resetEventSeeding, showManualHeatsReorderModal } from '../../heatsReorder';
import { sortRanking, showTieBreakerModal } from '../../tiebreaker';
import { handleSeedParticipants, handleSeedScores } from '../../seeder';
import { exportRankingToExcel } from '../../excel';
import { exportEventBackup, importEventBackup } from '../../backup';
import { renderListaInscritos, renderCuadroSorteo, findFirstFreeSpot } from './EventRosterView';
import { renderListaSeries as renderListaSeriesView } from './EventSeriesView';
import { renderPosicionesTab as renderStandingsView } from './EventStandingsView';

let activeMainTab: 'tiradores' | 'series' | 'posiciones' = 'tiradores';

function formatDate(isoDate: string): string {
 try {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('es-AR', {
   day: '2-digit', month: 'short', year: 'numeric',
  });
 } catch { return isoDate; }
}

export async function renderEvent(eventId: string): Promise<void> {
 const container = document.getElementById('event-detail-container');
 if (!container) return;

 const id = Number(eventId);
 let event: ShootingEvent | undefined;
 let participants: Participant[] = [];
 let allSeries: Series[] = [];

 try {
  [event, participants, allSeries] = await Promise.all([
   db.events.get(id),
   db.participants.where('eventId').equals(id).filter((item: any) => !item.is_deleted).toArray(),
   db.series.where('eventId').equals(id).filter((item: any) => !item.is_deleted).toArray(),
  ]);
 } catch (err) {
  console.error('[DB] Error cargando evento:', err);
  container.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><p class="text-sm text-error">Error al cargar el evento.</p></div>`;
  return;
 }

 if (!event) {
  container.innerHTML = `<div class="empty-state"><div class="empty-icon" aria-hidden="true"></div><p style="color:#64748b;">Evento no encontrado.</p><button class="btn-ghost-custom" id="btn-back-notfound" style="margin-top:8px;">← Inicio</button></div>`;
  document.getElementById('btn-back-notfound')?.addEventListener('click', () => navigate('/'));
  return;
 }

 participants.sort((a, b) => a.competitorNumber - b.competitorNumber);

 let modality: Modality = event.modality || '.22 LR';
 if (event.name?.includes('.308') || event.championshipDate?.includes('.308')) modality = '.308';
 else if (event.name?.includes('.223') || event.championshipDate?.includes('.223')) modality = '.223';

 if (event.id && event.modality !== modality) {
  event.modality = modality;
  db.events.update(event.id, { modality }).catch(err => console.error('[DB] Auto-fix modality error:', err));
 }

 const mConfig = getModalityConfig(modality);
 const isCF = modality === '.308' || modality === '.223';
 const maxSeriesPerEvent = mConfig.seriesPerEvent;

 async function refreshData() {
  participants = await db.participants.where('eventId').equals(id).filter((item: any) => !item.is_deleted).toArray();
  participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
  allSeries = await db.series.where('eventId').equals(id).filter((item: any) => !item.is_deleted).toArray();
  return { participants, allSeries };
 }

 async function refreshAll() {
  await refreshData();
  renderRosterSubViews();
  renderSeriesSubView();
  updateTabStyles();
 }

 // ── Render shell ──
 container.innerHTML = `
  <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;">
   <button class="btn-ghost-custom" id="btn-back-event" aria-label="Volver al inicio">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    Inicio
   </button>
  </div>
  <div style="margin-bottom:20px;">
   <div class="section-title" style="margin-bottom:2px;display:flex;align-items:center;gap:8px;">
     Evento
   </div>
   <h1 style="margin:0 0 4px;font-family:'Rajdhani',sans-serif;font-size:1.6rem;font-weight:700;color:#0056b3;line-height:1.2;">${esc(event.name)}</h1>
   <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;">
    <span style="font-size:0.75rem;background:#d52b1e;color:#ffffff;padding:2px 6px;border-radius:4px;font-weight:700;">${formatDate(event.date)}</span>
    ${event.location ? `<span style="font-size:0.75rem;background:#ffffff;color:#0f172a;padding:2px 6px;border-radius:4px;font-weight:700;border:1px solid #cbd5e1;">${esc(event.location)}</span>` : ''}
    ${event.championshipDate ? `<span style="font-size:0.75rem;background:#0038a8;color:#ffffff;padding:2px 6px;border-radius:4px;font-weight:700;">${esc(event.championshipDate)}</span>` : ''}
   </div>
  </div>
  <div role="tablist" aria-label="Navegacion del Evento" class="tabs tabs-boxed mb-6 bg-slate-200 border border-slate-300 flex gap-1 p-1 rounded-xl">
   <button role="tab" aria-selected="${activeMainTab === 'tiradores' ? 'true' : 'false'}" id="tab-btn-tiradores" class="tab ${activeMainTab === 'tiradores' ? 'tab-active' : ''} flex-1 rounded-lg font-['Rajdhani'] font-bold text-slate-900 text-sm transition-all duration-200">Sorteo (${participants.length}/32)</button>
   <button role="tab" aria-selected="${activeMainTab === 'series' ? 'true' : 'false'}" id="tab-btn-series" class="tab ${activeMainTab === 'series' ? 'tab-active' : ''} flex-1 rounded-lg font-['Rajdhani'] font-bold text-slate-600 text-sm transition-all duration-200">Series</button>
   <button role="tab" aria-selected="${activeMainTab === 'posiciones' ? 'true' : 'false'}" id="tab-btn-posiciones" class="tab ${activeMainTab === 'posiciones' ? 'tab-active' : ''} flex-1 rounded-lg font-['Rajdhani'] font-bold text-slate-600 text-sm transition-all duration-200">Posiciones</button>
  </div>

  <!-- PANEL 1: TIRADORES -->
  <div id="tab-panel-tiradores" class="tab-panel ${activeMainTab === 'tiradores' ? '' : 'hidden'}">
   <div class="card-tactical staff-only" style="padding:16px;margin-bottom:20px;">
    <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.1rem;font-weight:700;color:#0056b3;margin-bottom:12px;">Inscribir Competidor</h3>
    <div style="display:flex;gap:10px;">
     <div style="display:flex;gap:10px;flex:1;flex-wrap:wrap;">
      <input type="text" id="field-participant-name" class="field-input" style="flex:2;min-width:140px;" placeholder="Nombre completo" maxlength="60" list="padron-suggestions" ${participants.length >= 32 ? 'disabled' : ''} />
      <datalist id="padron-suggestions"></datalist>
      <input type="text" id="field-participant-category" class="field-input" style="flex:1;min-width:100px;" placeholder="Categoria" maxlength="30" ${participants.length >= 32 ? 'disabled' : ''} />
      <select id="field-participant-rifle" class="field-input" style="flex:1;min-width:100px;font-size:0.8rem;" ${participants.length >= 32 ? 'disabled' : ''}>
        <option value="">Rifle</option>
        <option value="Rifle A">Rifle A</option>
        <option value="Rifle B">Rifle B</option>
        <option value="Rifle C">Rifle C</option>
        <option value="Rifle D">Rifle D</option>
        <option value="Rifle E">Rifle E</option>
      </select>
     </div>
     <button id="btn-add-participant" class="btn-primary-custom staff-only" style="padding:10px 18px;" ${participants.length >= 32 ? 'disabled' : ''}>Inscribir</button>
    </div>
    <div style="font-size:0.72rem;color:#475569;margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
     <span>Asignacion de numero aleatoria al inscribir.</span>
     <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button id="btn-padron-selector" class="btn-ghost-custom staff-only" style="font-size:0.68rem;padding:4px 8px;border-color:rgba(0,86,179,0.35);color:#0056b3;" ${participants.length >= 32 ? 'disabled' : ''}>Padron Maestro</button>
      <button id="btn-seed-participants" class="btn-ghost-custom staff-only" style="font-size:0.68rem;padding:4px 8px;border-color:rgba(59,130,246,0.25);">Importar Padron en Lote</button>
      <button id="btn-seed-scores" class="btn-ghost-custom staff-only" style="font-size:0.68rem;padding:4px 8px;border-color:rgba(34,197,94,0.25);color:#22c55e;" ${participants.length === 0 ? 'disabled' : ''}>Simular Resultados</button>
     </div>
    </div>
   </div>
   <div class="card-tactical staff-only" style="padding:16px;margin-bottom:20px;border-color:rgba(0,86,179,0.25);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
     <div>
      <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.1rem;font-weight:700;color:#0056b3;margin:0;">${isCF ? 'Orden de Tiro' : 'Sorteo de Mesas'}</h3>
      <p style="margin:4px 0 0;font-size:0.78rem;color:#64748b;">${isCF ? 'Asigna el turno de tiro a cada competidor.' : 'Sortea aleatoriamente en 8 Tandas.'}</p>
     </div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btn-shuffle-sorteo" class="btn-primary-custom staff-only" style="background:#0056b3;color:#ffffff;border-color:#0056b3;padding:12px 20px;" ${participants.length === 0 ? 'disabled' : ''}>Sortear Posiciones</button>
      <button id="btn-reorder-heats" class="btn-ghost-custom staff-only" style="padding:12px 16px;font-size:0.8rem;border-color:rgba(0,86,179,0.35);color:#0056b3;" ${participants.length === 0 ? 'disabled' : ''}>${isCF ? 'Reordenar' : 'Reordenar S1'}</button>
      ${!isCF ? '<button id="btn-reorder-heats-s2" class="btn-ghost-custom staff-only" style="padding:12px 16px;font-size:0.8rem;border-color:rgba(0,86,179,0.35);color:#0056b3;" ' + (participants.length === 0 || !participants.some(p => p.tanda !== undefined) ? 'disabled' : '') + '>Reordenar S2</button>' : ''}
      <button id="btn-undo-sorteo" class="btn-ghost-custom staff-only" style="padding:12px 16px;font-size:0.8rem;border-color:rgba(183,32,28,0.35);color:#b7201c;" ${participants.some(p => p.tanda !== undefined) ? '' : 'disabled'}>Deshacer Sorteo</button>
     </div>
    </div>
   </div>
   <div id="cuadro-sorteo-container"></div>
   <div class="section-title" style="margin:24px 0 10px;">Competidores Registrados</div>
   <div id="lista-inscritos" style="display:flex;flex-direction:column;gap:8px;"></div>
  </div>

  <!-- PANEL 2: SERIES -->
  <div id="tab-panel-series" class="tab-panel ${activeMainTab === 'series' ? '' : 'hidden'}">
   <div class="card-tactical staff-only" style="padding:16px;margin-bottom:20px;border-color:rgba(0,86,179,0.15);background:#ffffff;">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <!-- Menú de Impresión -->
      <details class="dropdown">
        <summary class="btn-ghost-custom" style="padding:8px 16px;font-size:0.8rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Opciones de Impresión
        </summary>
        <ul class="menu dropdown-content bg-base-100 rounded-box z-[10] w-52 p-2 shadow-lg" style="border:1px solid #e2e8f0; margin-top:6px; background:#fff;">
          ${participants.length > 0 ? '<li><a id="btn-print-ranking" style="font-weight:600;color:#0f1f3d;">Imprimir Resultados</a></li>' : ''}
          ${allSeries.length > 0 ? '<li><a id="btn-print-event" style="font-weight:600;color:#0f1f3d;">Imprimir Todo</a></li>' : ''}
          ${participants.length > 0 ? '<li><a id="btn-print-prefilled" style="font-weight:600;color:#0f1f3d;">Planillas Pre-completadas</a></li>' : ''}
          <li><a id="btn-print-blank-series" style="font-weight:600;color:#0f1f3d;">Imprimir Planilla Vacía</a></li>
        </ul>
      </details>

      <!-- Menú de Gestión del Torneo -->
      <details class="dropdown dropdown-end">
        <summary class="btn-ghost-custom" style="padding:8px 16px;font-size:0.8rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Gestión del Torneo
        </summary>
        <ul class="menu dropdown-content bg-base-100 rounded-box z-[10] w-52 p-2 shadow-lg" style="border:1px solid #e2e8f0; margin-top:6px; background:#fff;">
          ${participants.length > 1 ? '<li><a id="btn-resolve-ties" style="font-weight:600;color:#0f1f3d;">Resolver Desempates</a></li>' : ''}
          ${participants.length > 0 ? '<li><a id="btn-export-excel" style="font-weight:600;color:#0f1f3d;">Exportar a CSV</a></li>' : ''}
          <li><a id="btn-export-backup" style="font-weight:600;color:#0f1f3d;">Copia Local (.json)</a></li>
          ${allSeries.length > 0 ? '<li><a id="btn-clear-all-series" style="font-weight:800;color:#b7201c;margin-top:8px;">⚠️ Reiniciar Todo</a></li>' : ''}
        </ul>
      </details>
    </div>
   </div>
   <div id="lista-series-por-tirador" style="display:flex;flex-direction:column;gap:16px;"></div>
  </div>

  <!-- PANEL 3: POSICIONES -->
  <div id="tab-panel-posiciones" class="tab-panel ${activeMainTab === 'posiciones' ? '' : 'hidden'}">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div class="section-title" style="margin:0;">Tabla de Posiciones</div>
    <div>
     <button class="btn-ghost-custom staff-only" id="btn-print-ranking-tab" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;">Imprimir Reportes</button>
    </div>
   </div>
   <div id="posiciones-container"></div>
  </div>`;

 // ── Tab switching ──
 function updateTabStyles(): void {
  ['tab-btn-tiradores', 'tab-btn-series', 'tab-btn-posiciones'].forEach(id => {
   const btn = document.getElementById(id);
   if (!btn) return;
   const isActive = btn.classList.contains('tab-active');
   btn.style.cssText = `flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:800;font-size:0.8rem;padding:8px;transition:all 0.2s;${isActive ? 'background:#b7201c;color:#ffffff;box-shadow:0 4px 12px rgba(183,32,28,0.3);' : 'background:transparent;color:#475569;'}`;
  });
 }

 function switchTab(tab: 'tiradores' | 'series' | 'posiciones'): void {
  ['tiradores', 'series', 'posiciones'].forEach(t => {
   const panel = document.getElementById('tab-panel-' + t);
   const btn = document.getElementById('tab-btn-' + t);
   if (panel) panel.classList.toggle('hidden', t !== tab);
   if (btn) btn.classList.toggle('tab-active', t === tab);
  });
 }

 document.getElementById('tab-btn-tiradores')?.addEventListener('click', () => { activeMainTab = 'tiradores'; switchTab('tiradores'); updateTabStyles(); });
 document.getElementById('tab-btn-series')?.addEventListener('click', () => { activeMainTab = 'series'; switchTab('series'); updateTabStyles(); });
 document.getElementById('tab-btn-posiciones')?.addEventListener('click', () => { activeMainTab = 'posiciones'; switchTab('posiciones'); updateTabStyles(); renderSubStandings(); });

 // ── Sub-view renders ──
 function renderRosterSubViews(): void {
  renderCuadroSorteo('cuadro-sorteo-container', participants, maxSeriesPerEvent, isCF, mConfig);
  renderListaInscritos('lista-inscritos', participants, id, {
    onRefresh: () => renderEvent(String(id)),
    onRefreshData: refreshData,
    updateTabCounter: (count: number) => {
      const btn = document.getElementById('tab-btn-tiradores');
      if (btn) btn.textContent = 'Sorteo (' + count + '/32)';
    }
  });
 }

 function renderSeriesSubView(): void {
  renderListaSeriesView('lista-series-por-tirador', participants, allSeries, id, maxSeriesPerEvent, isCF, async () => {
   allSeries = await db.series.where('eventId').equals(id).filter((item: any) => !item.is_deleted).toArray();
   renderSeriesSubView();
  });
  updateUIRoles();
 }

 function renderSubStandings(): void {
  renderStandingsView('posiciones-container', event!, participants, allSeries, maxSeriesPerEvent, isCF);
 }

 // ── Handler: inscribir ──
 document.getElementById('btn-add-participant')?.addEventListener('click', async () => {
  const input = document.getElementById('field-participant-name') as HTMLInputElement | null;
  const catInput = document.getElementById('field-participant-category') as HTMLInputElement | null;
  const rifleInput = document.getElementById('field-participant-rifle') as HTMLSelectElement | null;
  if (!input || !catInput) return;
  const name = input.value.trim();
  const categoryVal = catInput.value.trim();
  const rifleVal = rifleInput?.value.trim();
  if (!name) { showToast('Ingresa el nombre del tirador', 'error'); return; }
  if (participants.length >= 32) { showToast('Capacidad maxima de 32.', 'error'); return; }
  if (participants.some(p => p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase())) {
   showToast('El tirador ya esta inscrito.', 'error'); return;
  }
  try {
   const chosenNumber = participants.length > 0 ? Math.max(...participants.map(p => p.competitorNumber)) + 1 : 1;
   const freeSpot = findFirstFreeSpot(participants);
   await db.participants.add({ eventId: id, name, category: categoryVal || undefined, competitorNumber: chosenNumber, tanda: freeSpot?.tanda, spot: freeSpot?.spot, status: 'active', paymentStatus: 'paid', sharedRifleId: rifleVal || undefined });
   addMasterCompetitor(name, categoryVal).catch(err => console.warn('[Padron] Error:', err));
   input.value = ''; catInput.value = ''; if (rifleInput) rifleInput.value = '';
   showToast('Inscrito #' + chosenNumber, 'success');
   await refreshData();
   renderRosterSubViews();
   renderSeriesSubView();
   const tabBtn = document.getElementById('tab-btn-tiradores');
   if (tabBtn) tabBtn.textContent = 'Sorteo (' + participants.length + '/32)';
   updateTabStyles();
  } catch (err) { console.error('[DB] Error inscribiendo:', err); showToast('Error al guardar.', 'error'); }
 });

 // ── Handler: padron ──
 document.getElementById('btn-padron-selector')?.addEventListener('click', async () => {
  if (participants.length >= 32) { showToast('Capacidad maxima.', 'error'); return; }
  await renderMasterCompetitorsModal(async (mc) => {
   (document.getElementById('field-participant-name') as HTMLInputElement).value = mc.name;
   (document.getElementById('field-participant-category') as HTMLInputElement).value = mc.category || '';
   showToast('Tirador seleccionado del Padron.', 'info', 3500);
  });
 });

 // ── Handler: seed participants ──
 document.getElementById('btn-seed-participants')?.addEventListener('click', async () => {
  await handleSeedParticipants(id, participants, findFirstFreeSpot, async () => {
   await refreshData();
   renderRosterSubViews();
   const tabBtn = document.getElementById('tab-btn-tiradores');
   if (tabBtn) tabBtn.textContent = 'Sorteo (' + participants.length + '/32)';
   const ss = document.getElementById('btn-seed-scores') as HTMLButtonElement;
   if (ss) ss.disabled = false;
  });
 });

 // ── Handler: seed scores ──
 document.getElementById('btn-seed-scores')?.addEventListener('click', async () => {
  await handleSeedScores(id, participants, async () => {
   allSeries = await db.series.where('eventId').equals(id).filter((item: any) => !item.is_deleted).toArray();
   renderSeriesSubView();
  });
 });

 // ── Handler: shuffle ──
 document.getElementById('btn-shuffle-sorteo')?.addEventListener('click', async () => {
  if (participants.length === 0) { showToast('No hay competidores.', 'error'); return; }
  const presentes = participants.filter(p => p.presentForRaffle !== false);
  if (presentes.length === 0) { showToast('No hay presentes para el sorteo.', 'error'); return; }
  const ausentes = participants.length - presentes.length;
  if (!await showConfirm('Realizar Sorteo', ausentes > 0 ? 'Sortear ' + presentes.length + ' presentes? (' + ausentes + ' ausentes sin tanda)' : 'Sortear todos?')) return;

  try {
   const list = [...presentes];
   for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
   const listS1 = [...list];
   for (let i = listS1.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [listS1[i], listS1[j]] = [listS1[j], listS1[i]]; }
   const sp = mConfig.spotsPerHeat;
   for (let i = 0; i < listS1.length; i++) { listS1[i].tanda = Math.floor(i / sp) + 1; listS1[i].spot = ((i % sp) + 1) as 1|2|3|4; }
   if (mConfig.useFamilyRules) applySpecialFamilySeedingRules(listS1);
   if (mConfig.useSharedRifle) applySharedRifleRules(listS1);
   if (maxSeriesPerEvent > 1) {
    const g: Record<number, Participant[]> = {};
    for (const p of listS1) { if (p.tanda) { if (!g[p.tanda]) g[p.tanda] = []; g[p.tanda].push(p); } }
    for (const t in g) { const spots = [1,2,3,4].slice(0, g[t].length); for (let i = spots.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [spots[i],spots[j]] = [spots[j],spots[i]]; } g[t].forEach((p,idx) => { p.tandaS2 = Number(t); p.spotS2 = spots[idx] as 1|2|3|4; }); }
   }
   for (const p of list) { const p1 = listS1.find(x => x.id === p.id); if (p1) { p.tanda = p1.tanda; p.spot = p1.spot; p.tandaS2 = p1.tandaS2; p.spotS2 = p1.spotS2; } p.sector = undefined; }
   let nextNum = list.length + 1;
   for (const p of participants.filter(p => p.presentForRaffle === false)) { p.tanda = undefined; p.spot = undefined; p.tandaS2 = undefined; p.spotS2 = undefined; p.sector = undefined; p.competitorNumber = nextNum++; }
   await Promise.all(list.map(p => db.participants.put(p)));
   await Promise.all(participants.filter(p => p.presentForRaffle === false).map(p => db.participants.put(p)));
   showToast('Sorteo completado!', 'success');
   await refreshData();
   renderRosterSubViews();
   updateTabStyles();
  } catch (err) { console.error('[DB] Error sorteo:', err); showToast('Error al guardar sorteo.', 'error'); }
 });

 // ── Handler: reorder heats ──
 document.getElementById('btn-reorder-heats')?.addEventListener('click', async () => {
  if (participants.length === 0) { showToast('No hay competidores.', 'error'); return; }
  await showManualHeatsReorderModal(id, async () => { await refreshData(); renderRosterSubViews(); }, 1, isCF);
 });
 document.getElementById('btn-reorder-heats-s2')?.addEventListener('click', async () => {
  if (participants.length === 0) { showToast('No hay competidores.', 'error'); return; }
  await showManualHeatsReorderModal(id, async () => { await refreshData(); renderRosterSubViews(); }, 2);
 });

 // ── Handler: undo sorteo ──
 const btnUndo = document.getElementById('btn-undo-sorteo');
 if (btnUndo) {
  const newBtnUndo = btnUndo.cloneNode(true);
  btnUndo.parentNode?.replaceChild(newBtnUndo, btnUndo);
  newBtnUndo.addEventListener('click', async () => {
   if (!await showConfirm('Deshacer Sorteo', 'Borrar todas las tandas?')) return;
   participants.sort((a, b) => (a.id || 0) - (b.id || 0));
   let num = 1;
   for (const p of participants) { p.tanda = undefined; p.spot = undefined; p.sector = undefined; p.tandaS2 = undefined; p.spotS2 = undefined; p.competitorNumber = num++; await db.participants.put(p); }
   showToast('Sorteo deshecho.', 'info');
   await refreshData();
   renderRosterSubViews();
  });
 }

 // ── Handler: tiebreaker ──
 document.getElementById('btn-resolve-ties')?.addEventListener('click', () => {
  showTieBreakerModal(Number(id), participants, allSeries, async () => {
   participants = await db.participants.where('eventId').equals(Number(id)).filter((item: any) => !item.is_deleted).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderSeriesSubView();
  });
 });

 // ── Handler: export ──
 document.getElementById('btn-export-excel')?.addEventListener('click', () => { if (participants.length > 0) exportRankingToExcel(event!, participants, allSeries); });
 document.getElementById('btn-export-backup')?.addEventListener('click', async () => { await exportEventBackup(Number(id)); });

 // ── Handler: print ranking ──
 document.getElementById('btn-print-ranking')?.addEventListener('click', async () => {
  const fresh = await db.participants.where('eventId').equals(Number(id)).filter((item: any) => !item.is_deleted).toArray();
  if (fresh.length > 0) printRankingCard(event!, fresh, allSeries);
 });

 // ── Handler: print event ──
 document.getElementById('btn-print-event')?.addEventListener('click', () => {
  if (allSeries.length > 0) {
   if (isCF) printCFEventCards(event!, participants, allSeries);
   else printEventCards(event!, participants, allSeries);
  }
 });

 // ── Handler: clear all series ──
 document.getElementById('btn-clear-all-series')?.addEventListener('click', async () => {
  if (allSeries.length === 0) return;
  if (!await showConfirm('Reiniciar Todo', 'Eliminar TODAS las series?')) return;
  await db.series.where('eventId').equals(id).delete();
  allSeries = []; renderSeriesSubView();
  showToast('Series eliminadas.', 'info');
 });

 // ── Handler: print blank ──
 const printBlank = () => { if (isCF) printCFBlankSheet(event!); else printBlankSheet(event!); };
 document.getElementById('btn-print-blank-series')?.addEventListener('click', printBlank);
 document.getElementById('btn-print-prefilled')?.addEventListener('click', () => {
  if (participants.length > 0) {
   if (isCF) printCFEventCards(event!, participants, []);
   else printEventCards(event!, participants, []);
  }
 });
 document.getElementById('btn-print-ranking-tab')?.addEventListener('click', () => { printRankingCard(event!, participants, allSeries); });

 // ── Back ──
 document.getElementById('btn-back-event')?.addEventListener('click', () => navigate('/'));

 // ── Initial render ──
 renderRosterSubViews();
 renderSeriesSubView();
 renderSubStandings();
 updateTabStyles();
}
