let activeSorteoTab: 1 | 2 = 1;
import { esc, showToast, showConfirm, showPrompt, showEditParticipantModal } from '../../modals';
import { navigate } from '../../router';
import { exportRankingToExcel } from '../../excel';
import { exportEventBackup, importEventBackup } from '../../backup';
import { sortRanking, showTieBreakerModal } from '../../tiebreaker';
import { handleSeedParticipants, handleSeedScores } from '../../seeder';
import { db } from '../../db';
import type { ShootingEvent, Participant, Series, Shot } from '../../types';
import { printEventCards, printRankingCard, printBlankSheet } from '../../print';
import html2canvas from 'html2canvas';
import { renderMasterCompetitorsModal } from '../../masterCompetitors';
import { applySpecialFamilySeedingRules, applySpecialFamilySeedingRulesS2, applySharedRifleRules, resetEventSeeding, showManualHeatsReorderModal } from '../../heatsManager';


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
  <div role="tablist" aria-label="Navegación del Evento" class="tabs tabs-boxed mb-6 bg-slate-200 border border-slate-300 flex gap-1 p-1 rounded-xl">
   <button role="tab" aria-selected="true" aria-controls="tab-panel-tiradores" id="tab-btn-tiradores" class="tab tab-active flex-1 rounded-lg font-['Rajdhani'] font-bold text-slate-900 text-sm transition-all duration-200">
    Sorteo (${participants.length}/32)
   </button>
   <button role="tab" aria-selected="false" aria-controls="tab-panel-series" id="tab-btn-series" class="tab flex-1 rounded-lg font-['Rajdhani'] font-bold text-slate-600 text-sm transition-all duration-200">
    Series
   </button>
   <button role="tab" aria-selected="false" aria-controls="tab-panel-posiciones" id="tab-btn-posiciones" class="tab flex-1 rounded-lg font-['Rajdhani'] font-bold text-slate-600 text-sm transition-all duration-200">
    Posiciones
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
     <div style="display:flex;gap:10px;flex:1;flex-wrap:wrap;">
      <input type="text" id="field-participant-name" class="field-input" style="flex:2;min-width:140px;"
          placeholder="Nombre completo" maxlength="60" list="padron-suggestions"
          ${participants.length >= 32 ? 'disabled placeholder="Capacidad máxima (32)"' : ''} />
       <datalist id="padron-suggestions"></datalist>
      <input type="text" id="field-participant-category" class="field-input" style="flex:1;min-width:100px;"
          placeholder="Categoría (ej: Senior)" maxlength="30"
          ${participants.length >= 32 ? 'disabled' : ''} />
      <select id="field-participant-rifle" class="field-input" style="flex:1;min-width:100px;font-size:0.8rem;" ${participants.length >= 32 ? 'disabled' : ''}>
        <option value="">Rifle (Ninguno)</option>
        <option value="Rifle A">Rifle A</option>
        <option value="Rifle B">Rifle B</option>
        <option value="Rifle C">Rifle C</option>
        <option value="Rifle D">Rifle D</option>
        <option value="Rifle E">Rifle E</option>
      </select>
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
   <div class="card-tactical" style="padding:16px;margin-bottom:20px;border-color:rgba(0,86,179,0.25);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
     <div>
      <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.1rem;font-weight:700;color:#0056b3;margin:0;">
       Sorteo de Mesas
      </h3>
      <p style="margin:4px 0 0;font-size:0.78rem;color:#64748b;">
       Sortea aleatoriamente en 8 Tandas (Spots 1-4). Reglas especiales de la organización aplicadas automáticamente.
      </p>
     </div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btn-shuffle-sorteo" class="btn-primary-custom" 
          style="background:#0056b3;color:#ffffff;border-color:#0056b3;padding:12px 20px;"
          ${participants.length === 0 ? 'disabled' : ''}>
        Sortear Posiciones
      </button>
      <button id="btn-reorder-heats" class="btn-ghost-custom"
          style="padding:12px 16px;font-size:0.8rem;border-color:rgba(0,86,179,0.35);color:#0056b3;"
          ${participants.length === 0 ? 'disabled' : ''}
          title="Reasignar tandas manualmente para Serie 1">
        Reordenar S1
      </button>
      <button id="btn-reorder-heats-s2" class="btn-ghost-custom"
          style="padding:12px 16px;font-size:0.8rem;border-color:rgba(0,86,179,0.35);color:#0056b3;"
          ${participants.length === 0 || !participants.some(p => p.tanda !== undefined) ? 'disabled' : ''}
          title="Reasignar tandas manualmente para Serie 2">
        Reordenar S2
      </button>
      
      <button id="btn-undo-sorteo" class="btn-ghost-custom"
          style="padding:12px 16px;font-size:0.8rem;border-color:rgba(183,32,28,0.35);color:#b7201c;"
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
   <!-- Panel de Acciones y Herramientas Deportivas -->
   <div class="card-tactical" style="padding:16px;margin-bottom:20px;border-color:rgba(0,86,179,0.15);background:#ffffff;">
    <div style="display:flex;flex-direction:column;gap:12px;">
      
      <!-- Fila 1: Impresión -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid #f1f5f9;">
        <span style="font-family:'Rajdhani',sans-serif;font-weight:800;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:#0056b3;margin-right:4px;">📄 Impresión:</span>
        ${participants.length > 0 ? `
         <button class="btn-ghost-custom" id="btn-print-ranking" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;"
             title="Ver y exportar Reporte de Posiciones">
           Resultados
         </button>` : ''}
        ${allSeries.length > 0 ? `
         <button class="btn-ghost-custom" id="btn-print-event" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;"
             title="Imprimir planillas de todos los tiradores">
           Imprimir Todo
         </button>` : ''}
         <button class="btn-ghost-custom" id="btn-print-blank-series" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;" 
             title="Imprimir planilla vacía para llenado manual">
           Planilla Vacía
         </button>
      </div>

      <!-- Fila 2: Torneo y Datos -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span style="font-family:'Rajdhani',sans-serif;font-weight:800;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:#0056b3;margin-right:4px;">🏆 Torneo:</span>
        ${participants.length > 1 ? `
         <button class="btn-ghost-custom" id="btn-resolve-ties" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;"
             title="Resolver empates ordenándolos uno a uno en desempate">
           Resolver Desempates
         </button>` : ''}
        ${participants.length > 0 ? `
         <button class="btn-ghost-custom" id="btn-export-excel" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;"
             title="Exportar todos los datos a CSV">
           Exportar CSV
         </button>` : ''}
         <button class="btn-ghost-custom" id="btn-export-backup" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;"
             title="Exportar copia de seguridad .json para importar en otra máquina">
           Copia (.json)
         </button>

        ${allSeries.length > 0 ? `
         <button class="btn-ghost-custom" id="btn-clear-all-series" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(183,32,28,0.3);color:#b7201c;border-radius:8px;margin-left:auto;"
             title="Eliminar todas las series y resultados (mantiene los tiradores)">
           Reiniciar Todo
         </button>` : ''}
      </div>

    </div>
   </div>
   </div>
   <div id="lista-series-por-tirador" style="display:flex;flex-direction:column;gap:16px;"></div>
  </div>

  <!-- PANEL 3: POSICIONES -->
  <div id="tab-panel-posiciones" class="tab-panel hidden">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div class="section-title" style="margin:0;">Tabla de Posiciones</div>
    <div>
     <button class="btn-ghost-custom" id="btn-print-blank-tab" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;margin-right:8px;" title="Imprimir planilla sin datos para llenado manual">
       Planilla Vacía
     </button>
     <button class="btn-ghost-custom" id="btn-print-ranking-tab" style="padding:6px 14px;font-size:0.75rem;font-weight:700;border-color:rgba(0,86,179,0.25);color:#0056b3;border-radius:8px;">
       Imprimir Reportes
     </button>
    </div>
   </div>
   <div id="posiciones-container"></div>
  </div>`;

 // --- ELEMENTOS DE LA INTERFAZ ---
 const btnTiradores = document.getElementById('tab-btn-tiradores');
 const btnSeries = document.getElementById('tab-btn-series');
 const btnPosiciones = document.getElementById('tab-btn-posiciones');
 const panelTiradores = document.getElementById('tab-panel-tiradores');
 const panelSeries = document.getElementById('tab-panel-series');
 const panelPosiciones = document.getElementById('tab-panel-posiciones');

 // --- LÓGICA DE ESTILOS DE TABS ---
 function updateTabStyles(): void {
  if (!btnTiradores || !btnSeries || !btnPosiciones) return;
      
  const setTabStyle = (btn: HTMLElement, isActive: boolean) => {
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      btn.style.cssText = "flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:800;font-size:0.8rem;padding:8px;transition:all 0.2s;background:#b7201c;color:#ffffff;box-shadow:0 4px 12px rgba(183, 32, 28, 0.3);";
    } else {
      btn.style.cssText = "flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:800;font-size:0.8rem;padding:8px;transition:all 0.2s;background:transparent;color:#475569;";
    }
  };

  setTabStyle(btnTiradores, btnTiradores.classList.contains('tab-active'));
  setTabStyle(btnSeries, btnSeries.classList.contains('tab-active'));
  setTabStyle(btnPosiciones, btnPosiciones.classList.contains('tab-active'));
 }
 // --- LÓGICA DE TABS ---
 btnTiradores?.addEventListener('click', () => {
  btnTiradores.classList.add('tab-active');
  btnSeries?.classList.remove('tab-active');
  btnPosiciones?.classList.remove('tab-active');
  panelTiradores?.classList.remove('hidden');
  panelSeries?.classList.add('hidden');
  panelPosiciones?.classList.add('hidden');
  updateTabStyles();
 });

 btnSeries?.addEventListener('click', () => {
  btnSeries.classList.add('tab-active');
  btnTiradores?.classList.remove('tab-active');
  btnPosiciones?.classList.remove('tab-active');
  panelSeries?.classList.remove('hidden');
  panelTiradores?.classList.add('hidden');
  panelPosiciones?.classList.add('hidden');
  updateTabStyles();
 });

 btnPosiciones?.addEventListener('click', () => {
  btnPosiciones.classList.add('tab-active');
  btnTiradores?.classList.remove('tab-active');
  btnSeries?.classList.remove('tab-active');
  panelPosiciones?.classList.remove('hidden');
  panelTiradores?.classList.add('hidden');
  panelSeries?.classList.add('hidden');
  renderPosicionesTab();
  updateTabStyles();
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
   <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px;background:#f8fafc;padding:12px 16px;border-radius:12px;border:1px solid #e2e8f0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.8);">
    <div style="display:flex;align-items:center;gap:6px;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Tanda:</label>
     <select id="p-filter-tanda" class="select-tactical" style="font-size:0.8rem;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;">
      <option value="all" ${pFilterTanda === 'all' ? 'selected' : ''}>Todas</option>
      ${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}" ${pFilterTanda === String(i + 1) ? 'selected' : ''}>Tanda ${i + 1}</option>`).join('')}
      <option value="none" ${pFilterTanda === 'none' ? 'selected' : ''}>Sin Tanda</option>
     </select>
    </div>

    <div style="display:flex;align-items:center;gap:6px;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Estado:</label>
     <select id="p-filter-status" class="select-tactical" style="font-size:0.8rem;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;">
      <option value="all" ${pFilterStatus === 'all' ? 'selected' : ''}>Todos</option>
      <option value="active" ${pFilterStatus === 'active' ? 'selected' : ''}>Activos</option>
      <option value="dq" ${pFilterStatus === 'dq' ? 'selected' : ''}>DQ</option>
      <option value="dns" ${pFilterStatus === 'dns' ? 'selected' : ''}>DNS</option>
     </select>
    </div>

    <div style="display:flex;align-items:center;gap:6px;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Pago:</label>
     <select id="p-filter-payment" class="select-tactical" style="font-size:0.8rem;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;">
      <option value="all" ${pFilterPayment === 'all' ? 'selected' : ''}>Todos</option>
      <option value="paid" ${pFilterPayment === 'paid' ? 'selected' : ''}>Abonados</option>
      <option value="pending" ${pFilterPayment === 'pending' ? 'selected' : ''}>Pendientes</option>
     </select>
    </div>

    <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
     <label style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Orden:</label>
     <select id="p-sort-by" class="select-tactical" style="font-size:0.8rem;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;">
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
    const rifleBadge = p.sharedRifleId
     ? `<span style="font-size:0.65rem;background:#f3e8ff;color:#7e22ce;padding:2px 5px;border-radius:4px;font-weight:700;border:1px solid #d8b4fe;" title="Rifle Compartido">🎯 ${esc(p.sharedRifleId)}</span>`
     : '';
    const isRaffleChecked = p.presentForRaffle !== false;
    const statusClass = p.status === 'dq' ? 'select-status-dq' : p.status === 'dns' ? 'select-status-dns' : 'select-status-active';
    const paymentClass = p.paymentStatus === 'pending' ? 'select-payment-pending' : p.paymentStatus === 'exempt' ? 'select-payment-exempt' : 'select-payment-paid';

    return `
    <div class="competitor-row-card" style="display:flex; flex-direction:column; padding:12px 16px; background:#ffffff; border-radius:12px; gap:8px;">
     <!-- Fila 1: Info del competidor -->
     <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; width:100%;">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="font-family:'JetBrains Mono',monospace;font-weight:800;color:#0056b3;font-size:0.95rem;">#${p.competitorNumber}</span>
        <span style="font-weight:700;color:#0f172a;font-size:0.95rem;">${esc(p.name)}</span>
        ${cleanCategory ? `<span style="font-size:0.75rem;color:#64748b;font-weight:600;">(${esc(cleanCategory)})</span>` : ''}
        ${p.tanda ? `<span style="font-size:0.72rem;background:rgba(0,86,179,0.08);color:#0056b3;padding:3px 8px;border-radius:6px;font-weight:700;border:1px solid rgba(0,86,179,0.18);" title="S1: Tanda ${p.tanda} Mesa ${p.spot} | S2: Tanda ${p.tandaS2 || '—'} Mesa ${p.spotS2 || '—'}">S1: T${p.tanda}M${p.spot} | S2: T${p.tandaS2 || '—'}M${p.spotS2 || '—'}</span>` : ''}
        ${statusBadge}${payBadge}${rifleBadge}
      </div>
      <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;cursor:pointer;color:#334155;font-weight:700;user-select:none;" title="Presente para sorteo">
       <input type="checkbox" data-set-raffle="${p.id}" ${isRaffleChecked ? 'checked' : ''} class="checkbox checkbox-xs checkbox-primary" style="cursor:pointer;--chkbg:#0056b3;--chkfg:#ffffff;" />
       <span>Sorteo</span>
      </label>
     </div>
     
     <!-- Fila 2: Acciones y Dropdowns -->
     <div style="display:flex; gap:8px; align-items:center; justify-content:flex-start; flex-wrap:wrap; width:100%; border-top:1px dashed #f1f5f9; padding-top:8px;">
      <select data-set-status="${p.id}" class="select-tactical ${statusClass}" style="font-size:0.75rem;padding:5px 8px;border:1px solid #cbd5e1;border-radius:8px;" title="Estado del competidor">
       <option value="active" ${!p.status || p.status === 'active' ? 'selected' : ''}>Activo</option>
       <option value="dq" ${p.status === 'dq' ? 'selected' : ''}>DQ (Descalif.)</option>
       <option value="dns" ${p.status === 'dns' ? 'selected' : ''}>DNS (No asistió)</option>
      </select>
      <select data-set-payment="${p.id}" class="select-tactical ${paymentClass}" style="font-size:0.75rem;padding:5px 8px;border:1px solid #cbd5e1;border-radius:8px;" title="Estado de pago">
       <option value="paid" ${!p.paymentStatus || p.paymentStatus === 'paid' ? 'selected' : ''}>$ Abonado</option>
       <option value="pending" ${p.paymentStatus === 'pending' ? 'selected' : ''}>$ Pendiente</option>
       <option value="exempt" ${p.paymentStatus === 'exempt' ? 'selected' : ''}>Exento</option>
      </select>
      <div style="margin-left:auto; display:flex; gap:6px; align-items:center;">
        ${p.tanda === undefined || p.tandaS2 === undefined ? `<button class="btn-ghost-custom" data-assign-late="${p.id}" style="padding:6px 12px;font-size:0.75rem;font-weight:700;color:#16a34a;border-color:#bbf7d0;background:#f0fdf4;border-radius:8px;" title="Asignar a primera mesa libre">Asignar Mesa</button>` : ''}
        <button class="btn-ghost-custom" data-edit-participant="${p.id}" style="padding:6px 12px;font-size:0.75rem;font-weight:700;color:#0056b3;border-color:#cbd5e1;border-radius:8px;">
         Editar
        </button>
        <button class="btn-danger-custom" data-remove-participant="${p.id}"
            aria-label="Eliminar inscripcion de ${esc(p.name)}" style="padding:6px 12px;font-size:0.75rem;font-weight:700;border-radius:8px;">
         Eliminar
        </button>
      </div>
     </div>
    </div>`;
   }).join('')
   : `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:0.85rem;">No se encontraron competidores con los filtros seleccionados.</div>`;

  listEl.innerHTML = filterBarHtml + `<div style="display:flex;flex-direction:column;gap:8px;">${rowsHtml}</div>`;


  listEl.querySelectorAll('[data-assign-late]').forEach(btn => {
   btn.addEventListener('click', async (e) => {
    const id = Number((e.currentTarget as HTMLElement).dataset.assignLate);
    const p = participants.find(x => x.id === id);
    if (!p) return;

    // Encontrar puestos ocupados en Serie 1
    const occupiedS1 = new Set<string>();
    participants.forEach(x => {
     if (x.tanda !== undefined && x.spot !== undefined) {
      occupiedS1.add(`${x.tanda}-${x.spot}`);
     }
    });

    let foundS1 = false;
    for (let t = 1; t <= 8; t++) {
     // Check for sharedRifleId clash
     let rifleClash = false;
     if (p.sharedRifleId) {
       for (const existingP of participants) {
         if (existingP.tanda === t && existingP.sharedRifleId === p.sharedRifleId && existingP.id !== p.id) {
           rifleClash = true;
           break;
         }
       }
     }
     if (rifleClash) continue; // Skip this tanda

     for (let s = 1; s <= 4; s++) {
      if (!occupiedS1.has(`${t}-${s}`)) {
       p.tanda = t;
       p.spot = s as 1|2|3|4;
       foundS1 = true;
       break;
      }
     }
     if (foundS1) break;
    }

    // Fallback: If no spots found without a clash, just put them anywhere available
    if (!foundS1) {
      for (let t = 1; t <= 8; t++) {
       for (let s = 1; s <= 4; s++) {
        if (!occupiedS1.has(`${t}-${s}`)) {
         p.tanda = t;
         p.spot = s as 1|2|3|4;
         foundS1 = true;
         break;
        }
       }
       if (foundS1) break;
      }
    }

    p.presentForRaffle = true;

    if (foundS1) {
     // Para la Serie 2, lo ponemos en la misma tanda, pero en una mesa libre de esa tanda para S2.
     const occupiedInTandaS2 = new Set<number>();
     participants.forEach(x => {
       if (x.tandaS2 === p.tanda && x.spotS2 !== undefined) {
         occupiedInTandaS2.add(x.spotS2);
       }
     });
     
     let availableSpots = [];
      for (let s = 1; s <= 4; s++) {
        if (!occupiedInTandaS2.has(s)) {
          availableSpots.push(s);
        }
      }
      
      let s2Found = availableSpots.length > 0 ? availableSpots[0] : 1;
      
      const differentSpots = availableSpots.filter(s => s !== p.spot);
      if (differentSpots.length > 0) {
        s2Found = differentSpots[Math.floor(Math.random() * differentSpots.length)];
      }
     p.tandaS2 = p.tanda;
     p.spotS2 = s2Found as 1|2|3|4;

     await db.participants.put(p);
     showToast(`Se asignó a ${esc(p.name)} a Tanda ${p.tanda} (Mesa S1: ${p.spot} | Mesa S2: ${p.spotS2}).`, 'success');
     renderEvent(String(event!.id!));
    } else {
     showToast('No hay mesas libres disponibles (Capacidad máxima alcanzada).', 'error');
    }
   });
  });

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
    if (!await showConfirm('Eliminar Inscripción', `¿Eliminar la inscripción de ${esc(p.name)}? Se perderán sus series.`)) return;

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
     if (btnTiradores) btnTiradores.textContent = `Sorteo y Mesas (${participants.length}/32)`;
     
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
    const res = await showEditParticipantModal('Editar Competidor', {
      name: p.name,
      category: p.category,
      sharedRifleId: p.sharedRifleId
    });
    if (res !== null && res.name.trim() !== '') {
     await db.participants.update(pid, { 
       name: res.name.trim(),
       category: res.category,
       sharedRifleId: res.sharedRifleId
     });
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
  const sortedParticipants = participants.filter(p => (activeSorteoTab === 1 ? p.tanda : p.tandaS2) !== undefined);
  
  // Render tabs for Serie 1 / Serie 2 selection inside Sorteo view
  const tabsHtml = `
    <div class="tabs tabs-boxed mb-4" style="background:#e2e8f0;border:1px solid #cbd5e1;display:flex;gap:4px;padding:4px;border-radius:12px;margin-bottom:16px;">
      <button id="sorteo-tab-btn-s1" class="tab ${activeSorteoTab === 1 ? 'tab-active' : ''}" style="flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:0.8rem;${activeSorteoTab === 1 ? 'color:#0f172a;' : 'color:#475569;'}">
        Ver Serie 1
      </button>
      <button id="sorteo-tab-btn-s2" class="tab ${activeSorteoTab === 2 ? 'tab-active' : ''}" style="flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:0.8rem;${activeSorteoTab === 2 ? 'color:#0f172a;' : 'color:#475569;'}">
        Ver Serie 2
      </button>
    </div>
  `;

  if (sortedParticipants.length === 0) {
   tableEl.innerHTML = tabsHtml + `
    <div style="text-align:center;padding:32px 16px;border:1px dashed #cbd5e1;border-radius:12px;">
     <div style="font-size:0.8rem;color:#475569;">Sorteo pendiente para Serie ${activeSorteoTab}. Presioná el botón "Sortear Posiciones".</div>
    </div>`;
    
    // Bind tab clicks even if empty
    tableEl.querySelector('#sorteo-tab-btn-s1')?.addEventListener('click', () => { activeSorteoTab = 1; renderCuadroSorteo(); });
    tableEl.querySelector('#sorteo-tab-btn-s2')?.addEventListener('click', () => { activeSorteoTab = 2; renderCuadroSorteo(); });
    return;
  }

  let html = tabsHtml + `<div style="display:flex;flex-direction:column;gap:18px;">`;

  // 8 Tandas de 4 spots cada una (32 competidores max)
  for (let t = 1; t <= 8; t++) {
    const getCompetitor = (spotNum: 1 | 2 | 3 | 4) => {
      return participants.find(p => (activeSorteoTab === 1 ? p.tanda === t && p.spot === spotNum : p.tandaS2 === t && p.spotS2 === spotNum));
    };

    html += `
     <div class="card-tactical" style="padding:14px;border-color:#e2e8f0;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;font-weight:900;
            color:#0f172a;letter-spacing:0.08em;margin-bottom:10px;text-align:center;
            border-bottom:1px solid #f1f5f9;padding-bottom:6px;">
       TANDA ${t} (${activeSorteoTab === 1 ? 'Serie 1' : 'Serie 2'})
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

  // Bind tab clicks
  tableEl.querySelector('#sorteo-tab-btn-s1')?.addEventListener('click', () => { activeSorteoTab = 1; renderCuadroSorteo(); });
  tableEl.querySelector('#sorteo-tab-btn-s2')?.addEventListener('click', () => { activeSorteoTab = 2; renderCuadroSorteo(); });

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

  // Update button states
  const btnUndoState = document.getElementById('btn-undo-sorteo') as HTMLButtonElement | null;
  if (btnUndoState) {
   const hasRaffle = participants.some(p => p.tanda !== undefined || p.tandaS2 !== undefined);
   btnUndoState.disabled = !hasRaffle;
  }
  const btnShuffleState = document.getElementById('btn-shuffle-sorteo') as HTMLButtonElement | null;
  if (btnShuffleState) {
   btnShuffleState.disabled = participants.length === 0;
  }
  const btnReorderS1 = document.getElementById('btn-reorder-heats') as HTMLButtonElement | null;
  if (btnReorderS1) {
   btnReorderS1.disabled = participants.length === 0;
  }
  const btnReorderS2 = document.getElementById('btn-reorder-heats-s2') as HTMLButtonElement | null;
  if (btnReorderS2) {
   btnReorderS2.disabled = participants.length === 0 || !participants.some(p => p.tanda !== undefined);
  }
 }


 function renderSpotCell(spotNum: number, p: Participant | undefined): string {
  if (!p) {
   return `
    <div style="border:1px dashed #cbd5e1;border-radius:8px;padding:8px;
          text-align:center;font-size:0.75rem;color:#64748b;">
     Mesa ${spotNum}: [Libre]
    </div>`;
  }
  return `
   <div data-goto-participant-id="${p.id}"
      style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;
         padding:8px 10px;font-size:0.75rem;cursor:pointer;
         display:flex;align-items:center;gap:6px;transition:border-color 0.2s;">
    <span style="font-weight:900;color:#64748b;">M${spotNum}</span>
    <span style="font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">
     ${esc(p.name)}
    </span>
   </div>`;
 }

 // --- RENDER DE LISTA DE SERIES (PANEL 2) ---
 function renderListaSeries(): void {
  const containerEl = document.getElementById('lista-series-por-tirador');
  if (!containerEl) return;

  const validParticipants = participants.filter(p => 
    p.tanda !== undefined || allSeries.some(s => s.participantId === p.id)
  ).sort((a, b) => {
    const tA = a.tanda ?? 999;
    const tB = b.tanda ?? 999;
    if (tA !== tB) return tA - tB;
    const sA = a.spot ?? 999;
    const sB = b.spot ?? 999;
    if (sA !== sB) return sA - sB;
    return a.competitorNumber - b.competitorNumber;
  });

  if (validParticipants.length === 0) {
   containerEl.innerHTML = `<div style="text-align:center;padding:24px;font-size:0.82rem;color:#475569;">
    Debe realizar el sorteo de tandas primero para poder cargar puntuaciones a los competidores.</div>`;
   return;
  }

  containerEl.innerHTML = validParticipants.map((p) => {
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
        
       </span>
       <h4 style="margin:0;font-size:0.95rem;font-weight:700;color:#0056b3;">${esc(p.name)}</h4>${p.category ? ` <span style="font-size:0.75rem;color:#64748b;">(${esc(p.category.split('::')[0])})</span>` : ''}
      </div>
      <div style="font-size:0.7rem;color:#64748b;margin-top:2px;">
       ${p.tanda ? `S1: Tanda ${p.tanda}·Mesa ${p.spot} | S2: Tanda ${p.tandaS2 || '—'}·Mesa ${p.spotS2 || '—'}` : 'Posición no sorteada'}
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
    if (!await showConfirm('Vaciar Series', `¿Eliminar TODAS las series de ${esc(p.name)}? Esto dejará sus puntajes en cero.`)) return;
    try {
     await db.series.where('participantId').equals(pid).delete();
     allSeries = await db.series.where('eventId').equals(id).toArray();
     renderListaSeries();
     showToast(`Series de ${esc(p.name)} eliminadas.`, 'info');
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


 function renderPosicionesTab(): void {
  const container = document.getElementById('posiciones-container');
  if (!container) return;

  if (participants.length === 0) {
   container.innerHTML = `<div style="text-align:center;padding:24px;color:#64748b;font-size:0.85rem;">No hay competidores inscritos.</div>`;
   return;
  }

  // Generate ranking data
  const getRanking = (seriesNum: number | null) => {
    const data = participants.map(p => {
      let score = 0;
      if (seriesNum === null) {
        const pSeries = allSeries.filter(s => s.participantId === p.id);
        score = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
      } else {
        const s = allSeries.find(s => s.participantId === p.id && s.seriesNumber === seriesNum);
        if (s) score = s.totalScore;
      }
      return { participant: p, totalScore: score };
    });
    data.sort(sortRanking);
    return data;
  };

  const rankTotal = getRanking(null);
  const rankS1 = getRanking(1);
  const rankS2 = getRanking(2);

  // Helper to build table
  const buildTable = (title: string, rankings: any[]) => {
    const rowsHtml = rankings.map((r, i) => {
      const p = r.participant;
      const isTop3 = i < 3;
      const isDq = p.status === 'dq';
      const isDns = p.status === 'dns';
      
      let posHtml = `<span style="font-weight:700;color:#64748b;">${i + 1}</span>`;
      if (isDq) posHtml = `<span style="font-size:0.65rem;background:#fee2e2;color:#b7201c;padding:2px 4px;border-radius:4px;font-weight:700;">DQ</span>`;
      else if (isDns) posHtml = `<span style="font-size:0.65rem;background:#fef3c7;color:#d97706;padding:2px 4px;border-radius:4px;font-weight:700;">DNS</span>`;
      else if (isTop3) {
        posHtml = `<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;
                  background:${i === 0 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : i === 1 ? '#cbd5e1' : '#f59e0b'};
                  color:${i === 0 ? '#000000' : i === 1 ? '#0f172a' : '#ffffff'};">${i + 1}</span>`;
      }

      const scoreDisplay = isDq ? '<span style="color:#ef4444;font-size:0.8rem;">DQ</span>' : isDns ? '<span style="color:#f59e0b;font-size:0.8rem;">DNS</span>' : r.totalScore;

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 8px;text-align:center;width:40px;">${posHtml}</td>
          <td style="padding:10px 8px;">
            <div style="font-weight:700;color:#0f172a;font-size:0.85rem;text-transform:uppercase;">${esc(p.name)}</div>
            <div style="font-size:0.7rem;color:#64748b;">COMPETIDOR #${p.competitorNumber} ${p.category ? `· ${esc(p.category.split('::')[0])}` : ''}</div>
          </td>
          <td style="padding:10px 8px;text-align:right;width:80px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:1.05rem;font-weight:900;color:#16a34a;">${scoreDisplay}</span>
          </td>
        </tr>`;
    }).join('');

    return `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;">
          <h4 style="margin:0;font-family:'Rajdhani',sans-serif;font-weight:700;color:#0f172a;font-size:1.1rem;text-transform:uppercase;">${title}</h4>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  };

  // Perfect Scores
  const perfectScores = participants.map(p => {
    const pSeries = allSeries.filter(s => s.participantId === p.id);
    const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
    const s1 = pSeries.find(s => s.seriesNumber === 1)?.totalScore || 0;
    const s2 = pSeries.find(s => s.seriesNumber === 2)?.totalScore || 0;
    return { p, s1, s2, totalScore };
  }).filter(x => x.s1 === 67 || x.s2 === 67 || x.totalScore === 134);
  
  perfectScores.sort((a, b) => b.totalScore - a.totalScore);

  let perfectRowsHtml = perfectScores.map(r => {
    let reason = [];
    if (r.s1 === 67) reason.push("S1: 67 pts");
    if (r.s2 === 67) reason.push("S2: 67 pts");
    if (r.totalScore === 134) reason = ["Evento Perfecto (134)"];

    const p = r.p;
    if (p.status === 'dq' || p.status === 'dns') return '';

    return `
      <tr style="border-bottom:1px solid #fef3c7;background:#fffbeb;">
        <td style="padding:10px 8px;text-align:center;width:40px;"><span style="color:#d97706;font-size:1.1rem;">★</span></td>
        <td style="padding:10px 8px;">
          <div style="font-weight:700;color:#0f172a;font-size:0.85rem;text-transform:uppercase;">${esc(p.name)}</div>
          
        </td>
        <td style="padding:10px 8px;text-align:right;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;font-weight:900;color:#d97706;">${reason.join(' / ')}</span>
        </td>
      </tr>`;
  }).join('');

  if (perfectRowsHtml === '') {
    perfectRowsHtml = `<tr><td colspan="3" style="padding:20px;text-align:center;color:#94a3b8;font-size:0.8rem;">Ningún tirador alcanzó puntaje perfecto (67 o 134).</td></tr>`;
  }

  const perfectTable = `
    <div style="background:#ffffff;border:1px solid #fde68a;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(245,158,11,0.1);">
      <div style="background:#fef3c7;padding:12px 16px;border-bottom:1px solid #fde68a;display:flex;align-items:center;gap:8px;">
        <h4 style="margin:0;font-family:'Rajdhani',sans-serif;font-weight:700;color:#b45309;font-size:1.1rem;text-transform:uppercase;">Premios Especiales (67/134)</h4>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${perfectRowsHtml}</tbody>
      </table>
    </div>`;

  container.innerHTML = `
    ${buildTable('Total del Evento', rankTotal)}
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;">
      ${buildTable('Serie 1', rankS1)}
      ${buildTable('Serie 2', rankS2)}
    </div>
    ${perfectTable}
  `;

  // Imprimir Button in Tab
  
  document.getElementById('btn-print-blank-tab')?.addEventListener('click', () => {
    printBlankSheet(event!);
  });
  document.getElementById('btn-print-blank-series')?.addEventListener('click', () => {
    printBlankSheet(event!);
  });
  document.getElementById('btn-print-ranking-tab')?.addEventListener('click', () => {
    printRankingCard(event!, participants, allSeries);
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
  const rifleInput = document.getElementById('field-participant-rifle') as HTMLSelectElement | null;
  if (!input || !catInput) return;
  const name = input.value.trim();
  const categoryVal = catInput.value.trim();
  const rifleVal = rifleInput?.value.trim();
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
    paymentStatus: 'paid',
    sharedRifleId: rifleVal || undefined
   });

   // Agregar al Padrón Maestro silenciosamente (sin duplicar)
   addMasterCompetitor(name, categoryVal).catch(err => console.warn('[Padrón] No se pudo agregar:', err));

   input.value = '';
   catInput.value = '';
   if (rifleInput) rifleInput.value = '';
   showToast(`Inscrito Competidor #${chosenNumber}`, 'success');

   // recargar
   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
   renderListaSeries();

   // actualizar contador en el tab
   if (btnTiradores) btnTiradores.textContent = `Sorteo y Mesas (${participants.length}/32)`;


    // Actualizar estado de los botones de sorteo
    const btnShuffle = document.getElementById('btn-shuffle-sorteo');
    if (btnShuffle) btnShuffle.disabled = participants.length === 0;
    const btnUndoState = document.getElementById('btn-undo-sorteo');
    if (btnUndoState) {
      const hasRaffle = participants.some(p => p.tanda !== undefined || p.tandaS2 !== undefined);
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
   showToast(`Tirador "${esc(mc.name)}" seleccionado del Padrón. Presioná Inscribir para confirmar.`, 'info', 3500);
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
   if (btnTiradores) btnTiradores.textContent = `Sorteo y Mesas (${participants.length}/32)`;
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

   // 1. SORTEO SERIE 1 (Normal)
   const listS1 = [...list];
   for (let i = listS1.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [listS1[i], listS1[j]] = [listS1[j], listS1[i]];
   }
   for (let i = 0; i < listS1.length; i++) {
    listS1[i].tanda = Math.floor(i / 4) + 1;
    listS1[i].spot = ((i % 4) + 1) as 1|2|3|4;
   }
   if (typeof applySpecialFamilySeedingRules === 'function') {
      applySpecialFamilySeedingRules(listS1);
   }
   if (typeof applySharedRifleRules === 'function') {
      applySharedRifleRules(listS1);
   }

   // 2. SORTEO SERIE 2 (Mismo grupo de tanda, pero mezclando las mesas/spots)
   const groupsS1: Record<number, Participant[]> = {};
   for (const p of listS1) {
     if (p.tanda) {
       if (!groupsS1[p.tanda]) groupsS1[p.tanda] = [];
       groupsS1[p.tanda].push(p);
     }
   }

   for (const tString in groupsS1) {
     const t = Number(tString);
     const competitorsInTanda = [...groupsS1[t]];
     const spots = [1, 2, 3, 4].slice(0, competitorsInTanda.length);
     // Mezclar spots
     for (let i = spots.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       [spots[i], spots[j]] = [spots[j], spots[i]];
     }
     competitorsInTanda.forEach((p, idx) => {
       p.tandaS2 = t;
       p.spotS2 = spots[idx] as 1|2|3|4;
     });
   }

   // Guardar la lista combinada
   for (const p of list) {
     const p1 = listS1.find(x => x.id === p.id);
     p.tanda = p1?.tanda;
     p.spot = p1?.spot;
     p.tandaS2 = p1?.tandaS2;
     p.spotS2 = p1?.spotS2;
     p.sector = undefined;
   }

   let nextNumber = list.length + 1;
   const listAusentes = participants.filter(p => p.presentForRaffle === false);
   for (const p of listAusentes) {
     p.tanda = undefined;
     p.spot = undefined;
     p.tandaS2 = undefined;
     p.spotS2 = undefined;
     p.sector = undefined;
     p.competitorNumber = nextNumber++;
   }

   await Promise.all(list.map(p => db.participants.put(p)));
   await Promise.all(listAusentes.map(p => db.participants.put(p)));

   showToast('¡Sorteo completado! Reglas aplicadas.', 'success');

   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
   renderListaSeries();
   updateTabStyles();
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
  }, 1);
 });

 document.getElementById('btn-reorder-heats-s2')?.addEventListener('click', async () => {
  if (participants.length === 0) { showToast('No hay competidores inscritos.', 'error'); return; }
  await showManualHeatsReorderModal(id, async () => {
   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
  }, 2);
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
        participants.sort((a, b) => (a.id || 0) - (b.id || 0));
        let num = 1;
        for (const p of participants) {
          p.tanda = undefined;
          p.spot = undefined;
          p.sector = undefined;
          p.tandaS2 = undefined;
          p.spotS2 = undefined;
          p.sectorS2 = undefined;
          p.competitorNumber = num++;
          
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

  printRankingCard(event!, freshParticipants, allSeries);
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
 renderPosicionesTab();

 // --- HANDLER: VOLVER AL INICIO (DASHBOARD) ---
 document.getElementById('btn-back-event')?.addEventListener('click', () => {
  navigate('/');
 });
}

// ── Scoring de Serie ───────────────────────────────────────────────────────
