/**
 * EventRosterView.ts
 * Tab "Tiradores" del detalle de evento: inscripcion, sorteo, cuadro de tandas, lista de inscritos.
 */

import type { Participant, ShootingEvent, Series, Modality } from '../../types';
import type { ModalityConfig } from '../../modalityConfig';
import { esc, showToast, showConfirm, showEditParticipantModal } from '../../modals';
import { db } from '../../db';

let pFilterTanda = 'all';
let pFilterStatus = 'all';
let pFilterPayment = 'all';
let pSortBy = 'num';
let activeSorteoTab: 1 | 2 = 1;

export function renderListaInscritos(
  containerId: string,
  participants: Participant[],
  eventId: number,
  callbacks: {
    onRefresh: () => Promise<void>;
    onRefreshData: () => Promise<{ participants: Participant[]; allSeries: Series[] }>;
    updateTabCounter: (count: number) => void;
  },
  isCF: boolean = false
): void {
  const listEl = document.getElementById(containerId);
  if (!listEl) return;

  if (participants.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;padding:24px;font-size:0.82rem;color:#475569;">
     Ningun competidor inscrito en este evento.</div>`;
    return;
  }

  let displayed = [...participants];
  if (pFilterTanda !== 'all') {
    if (pFilterTanda === 'none') displayed = displayed.filter(p => p.tanda === undefined);
    else displayed = displayed.filter(p => p.tanda === Number(pFilterTanda));
  }
  if (pFilterStatus !== 'all') displayed = displayed.filter(p => (p.status || 'active') === pFilterStatus);
  if (pFilterPayment !== 'all') displayed = displayed.filter(p => (p.paymentStatus || 'paid') === pFilterPayment);

  displayed.sort((a, b) => {
    if (pSortBy === 'name') return a.name.localeCompare(b.name);
    if (pSortBy === 'tanda') return (a.tanda ?? 99) - (b.tanda ?? 99);
    if (pSortBy === 'payment') return (a.paymentStatus || 'paid').localeCompare(b.paymentStatus || 'paid');
    return a.competitorNumber - b.competitorNumber;
  });

  const filterBarHtml = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px;background:#f8fafc;padding:12px 16px;border-radius:12px;border:1px solid #e2e8f0;">
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
     <div class="staff-only" style="display:flex;align-items:center;gap:6px;">
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
       <option value="num" ${pSortBy === 'num' ? 'selected' : ''}>N Competidor</option>
       <option value="name" ${pSortBy === 'name' ? 'selected' : ''}>Nombre (A-Z)</option>
       <option value="tanda" ${pSortBy === 'tanda' ? 'selected' : ''}>Por Tanda</option>
       <option value="payment" ${pSortBy === 'payment' ? 'selected' : ''}>Estado de Pago</option>
      </select>
     </div>
    </div>`;

  const rowsHtml = displayed.length > 0
    ? displayed.map((p) => {
        const cleanCategory = (p.category || '').split('::')[0];
        const statusBadge = p.status === 'dq'
          ? `<span style="font-size:0.65rem;background:#fee2e2;color:#b7201c;padding:2px 6px;border-radius:4px;font-weight:700;border:1px solid #fca5a5;">DQ</span>`
          : p.status === 'dns'
          ? `<span style="font-size:0.65rem;background:#fef3c7;color:#d97706;padding:2px 6px;border-radius:4px;font-weight:700;border:1px solid #fde68a;">DNS</span>`
          : '';
        const payBadge = p.paymentStatus === 'pending'
          ? `<span class="staff-only" style="font-size:0.65rem;background:#fff7ed;color:#ea580c;padding:2px 5px;border-radius:4px;font-weight:700;border:1px solid #fed7aa;">$ Pendiente</span>`
          : p.paymentStatus === 'paid'
          ? `<span class="staff-only" style="font-size:0.65rem;background:#f0fdf4;color:#16a34a;padding:2px 5px;border-radius:4px;font-weight:700;border:1px solid #bbf7d0;">$ Abonado</span>`
          : '';
        const rifleBadge = p.sharedRifleId
          ? `<span style="font-size:0.65rem;background:#f3e8ff;color:#7e22ce;padding:2px 5px;border-radius:4px;font-weight:700;border:1px solid #d8b4fe;" title="Rifle Compartido"> ${esc(p.sharedRifleId)}</span>`
          : '';
        const isRaffleChecked = p.presentForRaffle !== false;

        return `
        <div class="competitor-row-card" style="display:flex;flex-direction:column;padding:12px 16px;background:#ffffff;border-radius:12px;gap:8px;">
         <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;width:100%;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-family:'JetBrains Mono',monospace;font-weight:800;color:#0056b3;font-size:0.95rem;">#${p.competitorNumber}</span>
            <span style="font-weight:700;color:#0f172a;font-size:0.95rem;">${esc(p.name)}</span>
            ${cleanCategory ? `<span style="font-size:0.75rem;color:#64748b;font-weight:600;">(${esc(cleanCategory)})</span>` : ''}
            ${p.tanda ? `<span style="font-size:0.72rem;background:rgba(0,86,179,0.08);color:#0056b3;padding:3px 8px;border-radius:6px;font-weight:700;border:1px solid rgba(0,86,179,0.18);" title="${isCF ? `Turno ${p.tanda} Mesa ${p.spot}` : `S1: T${p.tanda} M${p.spot} | S2: T${p.tandaS2 || '-'} M${p.spotS2 || '-'}`}">${isCF ? `T${p.tanda}M${p.spot}` : `S1: T${p.tanda}M${p.spot} | S2: T${p.tandaS2 || '-'}M${p.spotS2 || '-'}`}</span>` : ''}
            ${statusBadge}${payBadge}${rifleBadge}
          </div>
          <label class="staff-only" style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;cursor:pointer;color:#334155;font-weight:700;user-select:none;" title="Presente para sorteo">
           <input type="checkbox" data-set-raffle="${p.id}" ${isRaffleChecked ? 'checked' : ''} class="checkbox checkbox-xs checkbox-primary" style="cursor:pointer;" />
           <span>Sorteo</span>
          </label>
         </div>
         <div style="display:flex;gap:8px;align-items:center;justify-content:flex-start;flex-wrap:wrap;width:100%;border-top:1px dashed #f1f5f9;padding-top:8px;">
          <select data-set-status="${p.id}" class="select-tactical staff-only" style="font-size:0.75rem;padding:5px 8px;border:1px solid #cbd5e1;border-radius:8px;" title="Estado del competidor">
           <option value="active" ${!p.status || p.status === 'active' ? 'selected' : ''}>Activo</option>
           <option value="dq" ${p.status === 'dq' ? 'selected' : ''}>DQ</option>
           <option value="dns" ${p.status === 'dns' ? 'selected' : ''}>DNS</option>
          </select>
          <select data-set-payment="${p.id}" class="select-tactical staff-only" style="font-size:0.75rem;padding:5px 8px;border:1px solid #cbd5e1;border-radius:8px;" title="Estado de pago">
           <option value="paid" ${!p.paymentStatus || p.paymentStatus === 'paid' ? 'selected' : ''}>$ Abonado</option>
           <option value="pending" ${p.paymentStatus === 'pending' ? 'selected' : ''}>$ Pendiente</option>
           <option value="exempt" ${p.paymentStatus === 'exempt' ? 'selected' : ''}>Exento</option>
          </select>
          <div style="margin-left:auto;display:flex;gap:6px;align-items:center;">
            ${p.tanda === undefined || p.tandaS2 === undefined ? `<button class="btn-ghost-custom staff-only" data-assign-late="${p.id}" style="padding:6px 12px;font-size:0.75rem;font-weight:700;color:#16a34a;border-color:#bbf7d0;background:#f0fdf4;border-radius:8px;" title="Asignar a primera mesa libre">Asignar Mesa</button>` : ''}
            <button class="btn-ghost-custom staff-only" data-edit-participant="${p.id}" style="padding:6px 12px;font-size:0.75rem;font-weight:700;color:#0056b3;border-color:#cbd5e1;border-radius:8px;">Editar</button>
            <button class="btn-danger-custom staff-only" data-remove-participant="${p.id}" style="padding:6px 12px;font-size:0.75rem;font-weight:700;border-radius:8px;">Eliminar</button>
          </div>
         </div>
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:0.85rem;">No se encontraron competidores con los filtros seleccionados.</div>`;

  listEl.innerHTML = filterBarHtml + `<div style="display:flex;flex-direction:column;gap:8px;">${rowsHtml}</div>`;

  // Bind assign-late
  listEl.querySelectorAll('[data-assign-late]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.assignLate);
      const p = participants.find(x => x.id === pid);
      if (!p) return;

      const occupiedS1 = new Set<string>();
      participants.forEach(x => {
        if (x.tanda !== undefined && x.spot !== undefined) occupiedS1.add(`${x.tanda}-${x.spot}`);
      });

      let foundS1 = false;
      for (let t = 1; t <= 8; t++) {
        let rifleClash = false;
        if (p.sharedRifleId) {
          for (const existingP of participants) {
            if (existingP.tanda === t && existingP.sharedRifleId === p.sharedRifleId && existingP.id !== p.id) { rifleClash = true; break; }
          }
        }
        if (rifleClash) continue;
        for (let s = 1; s <= 4; s++) {
          if (!occupiedS1.has(`${t}-${s}`)) { p.tanda = t; p.spot = s as 1|2|3|4; foundS1 = true; break; }
        }
        if (foundS1) break;
      }
      if (!foundS1) {
        for (let t = 1; t <= 8; t++) {
          for (let s = 1; s <= 4; s++) {
            if (!occupiedS1.has(`${t}-${s}`)) { p.tanda = t; p.spot = s as 1|2|3|4; foundS1 = true; break; }
          }
          if (foundS1) break;
        }
      }

      p.presentForRaffle = true;
      if (foundS1) {
        const occupiedInTandaS2 = new Set<number>();
        participants.forEach(x => { if (x.tandaS2 === p.tanda && x.spotS2 !== undefined) occupiedInTandaS2.add(x.spotS2); });
        const availableSpots = [1, 2, 3, 4].filter(s => !occupiedInTandaS2.has(s));
        let s2Found = availableSpots.length > 0 ? availableSpots[0] : 1;
        const differentSpots = availableSpots.filter(s => s !== p.spot);
        if (differentSpots.length > 0) s2Found = differentSpots[Math.floor(Math.random() * differentSpots.length)];
        p.tandaS2 = p.tanda;
        p.spotS2 = s2Found as 1|2|3|4;
        await db.participants.put(p);
        showToast(`Se asigno a ${esc(p.name)} a Tanda ${p.tanda} ${isCF ? `(Mesa ${p.spot})` : `(Mesa S1: ${p.spot} | Mesa S2: ${p.spotS2})`}.`, 'success');
        await callbacks.onRefresh();
      } else {
        showToast('No hay mesas libres disponibles.', 'error');
      }
    });
  });

  // Bind filter dropdowns
  (listEl.querySelector('#p-filter-tanda') as HTMLSelectElement)?.addEventListener('change', (e) => { pFilterTanda = (e.target as HTMLSelectElement).value; renderListaInscritos(containerId, participants, eventId, callbacks); });
  (listEl.querySelector('#p-filter-status') as HTMLSelectElement)?.addEventListener('change', (e) => { pFilterStatus = (e.target as HTMLSelectElement).value; renderListaInscritos(containerId, participants, eventId, callbacks); });
  (listEl.querySelector('#p-filter-payment') as HTMLSelectElement)?.addEventListener('change', (e) => { pFilterPayment = (e.target as HTMLSelectElement).value; renderListaInscritos(containerId, participants, eventId, callbacks); });
  (listEl.querySelector('#p-sort-by') as HTMLSelectElement)?.addEventListener('change', (e) => { pSortBy = (e.target as HTMLSelectElement).value as any; renderListaInscritos(containerId, participants, eventId, callbacks); });

  // Bind remove
  listEl.querySelectorAll('[data-remove-participant]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.removeParticipant);
      const p = participants.find(x => x.id === pid);
      if (!p) return;
      if (!await showConfirm('Eliminar Inscripcion', `Eliminar la inscripcion de ${esc(p.name)}? Se perderan sus series.`)) return;
      try {
        await db.participants.delete(pid);
        await db.series.where('participantId').equals(pid).delete();
        const restantes = await db.participants.where('eventId').equals(eventId).filter((item: any) => !item.is_deleted).toArray();
        restantes.sort((a, b) => a.competitorNumber - b.competitorNumber);
        for (let i = 0; i < restantes.length; i++) {
          if (restantes[i].competitorNumber !== i + 1) await db.participants.update(restantes[i].id!, { competitorNumber: i + 1 });
        }
        showToast('Inscripcion eliminada. Tiradores reordenados.', 'info');
        await callbacks.onRefreshData();
        callbacks.updateTabCounter(restantes.length);
      } catch (err) {
        console.error('[DB] Error eliminando inscripcion:', err);
        showToast('Error al eliminar la inscripcion', 'error');
      }
    });
  });

  // Bind status change
  listEl.querySelectorAll('[data-set-status]').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.setStatus);
      const val = (e.currentTarget as HTMLSelectElement).value as 'active' | 'dq' | 'dns';
      await db.participants.update(pid, { status: val });
      const data = await callbacks.onRefreshData();
      participants.length = 0; participants.push(...data.participants);
      renderListaInscritos(containerId, participants, eventId, callbacks);
      showToast(val === 'dq' ? 'Competidor DQ' : val === 'dns' ? 'Competidor DNS' : 'Competidor reactivado', val === 'active' ? 'success' : 'info');
    });
  });

  // Bind payment change
  listEl.querySelectorAll('[data-set-payment]').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.setPayment);
      const val = (e.currentTarget as HTMLSelectElement).value as 'paid' | 'pending' | 'exempt';
      await db.participants.update(pid, { paymentStatus: val });
      const data = await callbacks.onRefreshData();
      participants.length = 0; participants.push(...data.participants);
      renderListaInscritos(containerId, participants, eventId, callbacks);
      showToast(val === 'paid' ? 'Pago registrado como Abonado' : val === 'pending' ? 'Pago marcado como Pendiente' : 'Competidor Exento', 'info');
    });
  });

  // Bind edit
  listEl.querySelectorAll('[data-edit-participant]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.editParticipant);
      const p = participants.find(x => x.id === pid);
      if (!p) return;
      const res = await showEditParticipantModal('Editar Competidor', { name: p.name, category: p.category, sharedRifleId: p.sharedRifleId });
      if (res !== null && res.name.trim() !== '') {
        await db.participants.update(pid, { name: res.name.trim(), category: res.category, sharedRifleId: res.sharedRifleId });
        const data = await callbacks.onRefreshData();
        participants.length = 0; participants.push(...data.participants);
        renderListaInscritos(containerId, participants, eventId, callbacks);
        showToast('Nombre actualizado con exito', 'success');
      }
    });
  });

  // Bind raffle checkbox
  listEl.querySelectorAll('[data-set-raffle]').forEach((chk) => {
    chk.addEventListener('change', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.setRaffle);
      const checked = (e.currentTarget as HTMLInputElement).checked;
      await db.participants.update(pid, { presentForRaffle: checked });
      showToast(checked ? 'Marcado Presente para sorteo' : 'Marcado Ausente para sorteo', 'info');
    });
  });
}

export function renderCuadroSorteo(
  containerId: string,
  participants: Participant[],
  maxSeriesPerEvent: number,
  isCF: boolean,
  mConfig: ModalityConfig,
  onTabSwitch?: () => void
): void {
  const tableEl = document.getElementById(containerId);
  if (!tableEl) return;

  const sortedParticipants = participants.filter(p => (activeSorteoTab === 1 ? p.tanda : p.tandaS2) !== undefined);

  const tabsHtml = maxSeriesPerEvent > 1 ? `
    <div class="tabs tabs-boxed mb-4" style="background:#e2e8f0;border:1px solid #cbd5e1;display:flex;gap:4px;padding:4px;border-radius:12px;margin-bottom:16px;">
      <button id="sorteo-tab-btn-s1" class="tab ${activeSorteoTab === 1 ? 'tab-active' : ''}" style="flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:0.8rem;${activeSorteoTab === 1 ? 'color:#0f172a;' : 'color:#475569;'}">Ver Serie 1</button>
      <button id="sorteo-tab-btn-s2" class="tab ${activeSorteoTab === 2 ? 'tab-active' : ''}" style="flex:1;border-radius:8px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:0.8rem;${activeSorteoTab === 2 ? 'color:#0f172a;' : 'color:#475569;'}">Ver Serie 2</button>
    </div>` : '';

  if (sortedParticipants.length === 0) {
    tableEl.innerHTML = tabsHtml + `<div style="text-align:center;padding:32px 16px;border:1px dashed #cbd5e1;border-radius:12px;"><div style="font-size:0.8rem;color:#475569;">Sorteo pendiente${maxSeriesPerEvent > 1 ? ' para Serie ' + activeSorteoTab : ''}. Presiona el boton Sortear Posiciones.</div></div>`;
    if (maxSeriesPerEvent > 1) {
      tableEl.querySelector('#sorteo-tab-btn-s1')?.addEventListener('click', () => { activeSorteoTab = 1; renderCuadroSorteo(containerId, participants, maxSeriesPerEvent, isCF, mConfig, onTabSwitch); });
      tableEl.querySelector('#sorteo-tab-btn-s2')?.addEventListener('click', () => { activeSorteoTab = 2; renderCuadroSorteo(containerId, participants, maxSeriesPerEvent, isCF, mConfig, onTabSwitch); });
    }
    return;
  }

  let html = tabsHtml + `<div style="display:flex;flex-direction:column;gap:18px;">`;

  for (let t = 1; t <= mConfig.maxHeats; t++) {
    const competitorsInHeat = participants.filter(p => (activeSorteoTab === 1 ? p.tanda === t : p.tandaS2 === t));
    if (isCF && competitorsInHeat.length === 0) continue;

    const getCompetitor = (spotNum: number) => participants.find(p => (activeSorteoTab === 1 ? p.tanda === t && p.spot === spotNum : p.tandaS2 === t && p.spotS2 === spotNum));
    const spotsArray = Array.from({ length: mConfig.spotsPerHeat }, (_, i) => i + 1);

    html += `
      <div class="card-tactical" style="padding:14px;border-color:#e2e8f0;">
       <div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;font-weight:900;color:#0f172a;letter-spacing:0.08em;margin-bottom:10px;text-align:center;border-bottom:1px solid #f1f5f9;padding-bottom:6px;">
        ${isCF ? 'TURNO ' + t : 'TANDA ' + t + ' (' + (activeSorteoTab === 1 ? 'Serie 1' : 'Serie 2') + ')'}
       </div>
       <div style="display:flex;flex-direction:column;gap:6px;">
         ${spotsArray.map(spotNum => { const p = getCompetitor(spotNum); return renderSpotCell(spotNum, p); }).join('')}
       </div>
      </div>`;
  }

  html += '</div>';
  tableEl.innerHTML = html;

  if (maxSeriesPerEvent > 1) {
    tableEl.querySelector('#sorteo-tab-btn-s1')?.addEventListener('click', () => { activeSorteoTab = 1; renderCuadroSorteo(containerId, participants, maxSeriesPerEvent, isCF, mConfig, onTabSwitch); if (onTabSwitch) onTabSwitch(); });
    tableEl.querySelector('#sorteo-tab-btn-s2')?.addEventListener('click', () => { activeSorteoTab = 2; renderCuadroSorteo(containerId, participants, maxSeriesPerEvent, isCF, mConfig, onTabSwitch); if (onTabSwitch) onTabSwitch(); });
  }

  // Bind click en celdas para ir a series
  tableEl.querySelectorAll('[data-goto-participant-id]').forEach(cell => {
    cell.addEventListener('click', () => {
      const pid = Number((cell as HTMLElement).dataset.gotoParticipantId);
      const btnSeries = document.getElementById('tab-btn-series');
      if (btnSeries) btnSeries.click();
      setTimeout(() => {
        const targetEl = document.getElementById('tirador-block-' + pid);
        if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });
}

export function renderSpotCell(spotNum: number, p: Participant | undefined): string {
  if (!p) {
    return `<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:8px;text-align:center;font-size:0.75rem;color:#64748b;">Mesa ${spotNum}: [Libre]</div>`;
  }
  return `<div data-goto-participant-id="${p.id}" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;gap:6px;transition:border-color 0.2s;">
    <span style="font-weight:900;color:#64748b;">M${spotNum}</span>
    <span style="font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${esc(p.name)}</span>
   </div>`;
}

export function findFirstFreeSpot(existingParticipants: Participant[]): { tanda: number; spot: 1 | 2 | 3 | 4 } | null {
  const hasBeenSorted = existingParticipants.some(p => p.tanda !== undefined);
  if (!hasBeenSorted) return null;
  const occupied = new Set(existingParticipants.filter(p => p.tanda !== undefined).map(p => p.tanda + '_' + p.spot));
  for (let t = 1; t <= 8; t++) {
    for (let s = 1; s <= 4; s++) {
      if (!occupied.has(t + '_' + s)) return { tanda: t, spot: s as 1 | 2 | 3 | 4 };
    }
  }
  return null;
}
