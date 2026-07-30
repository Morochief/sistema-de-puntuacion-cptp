/**
 * eventsManager.ts
 * Módulo para administrar el listado de eventos con Filtros, Ordenamiento, Paginación y Edición.
 */

import { db } from './db';
import type { ShootingEvent } from './types';
import { esc, showToast, showConfirm } from './modals';

export interface EventFilterOptions {
  searchQuery: string;
  sortBy: 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc';
  page: number;
  itemsPerPage: number;
  modalityFilter?: string; // '' = todos, '.22 LR', '.308', '.223'
  yearFilter?: number | ''; // '' = todos los años, o año específico ej: 2026
}

export async function getFilteredEvents(options: EventFilterOptions): Promise<{
  events: ShootingEvent[];
  totalItems: number;
  totalPages: number;
}> {
  let allEvents = await db.events.filter((item: ShootingEvent) => !item.is_deleted).toArray();
  allEvents = allEvents.filter(e => !e.is_deleted);

  // Normalizar modalidad si el nombre/fecha del campeonato contiene .308 o .223
  allEvents.forEach(e => {
    if (!e.modality || e.modality === '.22 LR') {
      if (e.name?.includes('.308') || e.championshipDate?.includes('.308')) e.modality = '.308';
      else if (e.name?.includes('.223') || e.championshipDate?.includes('.223')) e.modality = '.223';
    }
  });

  // 1. Filtrado por modalidad
  if (options.modalityFilter && options.modalityFilter.trim()) {
    allEvents = allEvents.filter(e => e.modality === options.modalityFilter);
  }

  // Filtrado por año
  if (options.yearFilter !== undefined && options.yearFilter !== '') {
    const yearStr = String(options.yearFilter);
    allEvents = allEvents.filter(e => e.date.startsWith(yearStr));
  }

  // 2. Filtrado por texto
  if (options.searchQuery.trim()) {
    const q = options.searchQuery.toLowerCase().trim();
    allEvents = allEvents.filter(e => 
      e.name.toLowerCase().includes(q) || 
      (e.location && e.location.toLowerCase().includes(q)) ||
      (e.championshipDate && e.championshipDate.toLowerCase().includes(q)) ||
      e.date.includes(q)
    );
  }

  // 2. Ordenamiento
  allEvents.sort((a, b) => {
    if (options.sortBy === 'date_desc') return b.date.localeCompare(a.date);
    if (options.sortBy === 'date_asc') return a.date.localeCompare(b.date);
    if (options.sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (options.sortBy === 'name_desc') return b.name.localeCompare(a.name);
    return 0;
  });

  // 3. Paginación
  const totalItems = allEvents.length;
  const totalPages = Math.ceil(totalItems / options.itemsPerPage) || 1;
  const page = Math.max(1, Math.min(options.page, totalPages));
  const startIndex = (page - 1) * options.itemsPerPage;
  const pageEvents = allEvents.slice(startIndex, startIndex + options.itemsPerPage);

  return {
    events: pageEvents,
    totalItems,
    totalPages
  };
}

/**
 * Muestra el modal táctico de Edición de Evento (Nombre, Fecha, Ubicación, Fecha de Campeonato)
 */
export async function showEditEventModal(eventId: number, onSaveCallback: () => void): Promise<void> {
  const event = await db.events.get(eventId);
  if (!event) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'cptp-modal-backdrop';
  backdrop.style.zIndex = '1050';

  const modalBox = document.createElement('div');
  modalBox.className = 'cptp-modal-content';
  modalBox.style.maxWidth = '500px';

  modalBox.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0;">Editar Evento</h2>
      <button id="close-edit-modal" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#64748b;">✕</button>
    </div>

    <form id="form-edit-event" style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label style="font-size:0.8rem;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Nombre del Evento *</label>
        <input type="text" id="edit-event-name" class="field-input" value="${esc(event.name)}" required style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;" />
      </div>

      <div>
        <label style="font-size:0.8rem;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha del Campeonato (Ej: 1ª Fecha .22 LR)</label>
        <input type="text" id="edit-event-champ" class="field-input" value="${esc(event.championshipDate || '')}" placeholder="Ej: Primera Fecha .22 LR" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;" />
      </div>

      <div style="display:flex;gap:12px;">
        <div style="flex:1;">
          <label style="font-size:0.8rem;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Fecha *</label>
          <input type="date" id="edit-event-date" class="field-input" value="${esc(event.date)}" required style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;" />
        </div>
        <div style="flex:1;">
          <label style="font-size:0.8rem;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Ubicación (Opcional)</label>
          <input type="text" id="edit-event-loc" class="field-input" value="${esc(event.location || '')}" placeholder="Ej: Polígono CPTP" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;" />
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="edit-event-pilot" ${event.isPilot ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;" />
        <label for="edit-event-pilot" style="font-size:0.85rem;font-weight:600;color:#b7201c;cursor:pointer;">
          Evento Piloto (no cuenta para el Campeonato General)
        </label>
      </div>

      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
        <button type="button" id="btn-cancel-edit" class="btn-ghost-custom" style="padding:10px 18px;">Cancelar</button>
        <button type="submit" class="btn-primary-custom" style="padding:10px 18px;background:#0056b3;color:#ffffff;border-radius:8px;font-weight:bold;">Guardar Cambios</button>
      </div>
    </form>
  `;

  backdrop.appendChild(modalBox);
  document.body.appendChild(backdrop);
  void backdrop.offsetWidth;
  backdrop.classList.add('is-open');

  const close = () => {
    backdrop.classList.remove('is-open');
    backdrop.classList.add('is-closing');
    setTimeout(() => backdrop.remove(), 150);
  };

  modalBox.querySelector('#close-edit-modal')?.addEventListener('click', close);
  modalBox.querySelector('#btn-cancel-edit')?.addEventListener('click', close);

  modalBox.querySelector('#form-edit-event')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (modalBox.querySelector('#edit-event-name') as HTMLInputElement).value.trim();
    const date = (modalBox.querySelector('#edit-event-date') as HTMLInputElement).value;
    const location = (modalBox.querySelector('#edit-event-loc') as HTMLInputElement).value.trim();
    const championshipDate = (modalBox.querySelector('#edit-event-champ') as HTMLInputElement).value.trim();
    const isPilot = (modalBox.querySelector('#edit-event-pilot') as HTMLInputElement).checked;

    if (!name || !date) return;

    await db.events.update(eventId, { name, date, location, championshipDate, isPilot });
    showToast('Evento actualizado correctamente.', 'success');
    close();
    onSaveCallback();
  });
}
