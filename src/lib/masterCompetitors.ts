/**
 * masterCompetitors.ts
 * Módulo independiente para la gestión del Padrón Maestro de Tiradores (Competidores).
 * Incluye CRUD completo, filtros, ordenamiento, paginación y autocompletado para inscripciones.
 * Incluye migración automática de participantes existentes.
 */

import { db } from './db';
import type { MasterCompetitor } from './types';
import { esc, showToast, showConfirm, showPrompt } from './modals';

export async function getAllMasterCompetitors(): Promise<MasterCompetitor[]> {
  return await db.masterCompetitors.orderBy('name').toArray();
}

export async function addMasterCompetitor(name: string, category = '', phone = ''): Promise<number> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('El nombre no puede estar vacio.');

  // Verificar si ya existe en el padrón (búsqueda case-insensitive en memoria)
  const all = await db.masterCompetitors.toArray();
  const existing = all.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
  if (existing) {
    return existing.id!;
  }

  return await db.masterCompetitors.add({
    name: trimmedName,
    category: category.trim(),
    phone: phone.trim(),
    createdAt: Date.now()
  });
}

export async function updateMasterCompetitor(id: number, changes: Partial<MasterCompetitor>): Promise<void> {
  await db.masterCompetitors.update(id, changes);
}

export async function deleteMasterCompetitor(id: number): Promise<void> {
  await db.masterCompetitors.delete(id);
}

/**
 * Migra todos los participantes únicos de todos los eventos existentes al Padrón Maestro.
 * Se llama en la inicialización de la app. Es idempotente (no duplica).
 * Retorna la cantidad de nuevos tiradores agregados.
 */
export async function migrateParticipantsToPadron(): Promise<number> {
  try {
    const allParticipants = await db.participants.toArray();
    console.log(`[Padron] Encontrados ${allParticipants.length} participantes para migrar.`);
    if (allParticipants.length === 0) return 0;

    // Cargar el padrón actual una sola vez
    const currentPadron = await db.masterCompetitors.toArray();
    console.log(`[Padron] Padron actual tiene ${currentPadron.length} entradas.`);
    const padronNames = new Set(currentPadron.map(c => c.name.toLowerCase()));

    let added = 0;
    const seenInBatch = new Set<string>();

    for (const p of allParticipants) {
      const nameTrimmed = p.name.trim();
      const nameLower = nameTrimmed.toLowerCase();
      if (!nameLower || seenInBatch.has(nameLower) || padronNames.has(nameLower)) continue;

      seenInBatch.add(nameLower);
      padronNames.add(nameLower);

      try {
        await db.masterCompetitors.add({
          name: nameTrimmed,
          category: p.category?.trim() || '',
          phone: '',
          createdAt: Date.now()
        });
        added++;
        console.log(`[Padron] Agregado: "${nameTrimmed}"`);
      } catch (addErr) {
        // Si falla un add individual (ej: constraint), lo saltamos y seguimos
        console.warn(`[Padron] No se pudo agregar "${nameTrimmed}":`, addErr);
      }
    }

    return added;
  } catch (err) {
    console.error('[Padron] Error fatal en migracion:', err);
    return 0;
  }
}


// ── Modal de Gestión del Padrón Maestro ──────────────────────────────────────

let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let searchQuery = '';
let sortBy: 'name_asc' | 'name_desc' | 'category' | 'created' = 'name_asc';

export async function renderMasterCompetitorsModal(onSelectCallback?: (mc: MasterCompetitor) => void): Promise<void> {
  const backdrop = document.createElement('div');
  backdrop.className = 'cptp-modal-backdrop';
  backdrop.style.zIndex = '1050';

  const modalBox = document.createElement('div');
  modalBox.className = 'cptp-modal-content';
  modalBox.style.maxWidth = '680px';
  modalBox.style.padding = '0';
  modalBox.style.overflow = 'hidden';

  const renderContent = async () => {
    let all = await getAllMasterCompetitors();

    // 1. Filtrado
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      all = all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      );
    }

    // 2. Ordenamiento
    all.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      if (sortBy === 'created') return b.createdAt - a.createdAt;
      return 0;
    });

    // 3. Paginación
    const totalItems = all.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = all.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const rowsHtml = pageItems.length > 0
      ? pageItems.map(c => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${esc(c.name)}</td>
          <td style="padding:10px 14px;color:#64748b;font-size:0.88rem;">${esc(c.category || 'General')}</td>
          <td style="padding:10px 14px;color:#64748b;font-size:0.88rem;">${esc(c.phone || '-')}</td>
          <td style="padding:10px 14px;text-align:right;">
            <div style="display:flex;gap:6px;justify-content:flex-end;">
              ${onSelectCallback ? `<button class="btn-primary-custom" data-select-mc="${c.id}" style="padding:4px 10px;font-size:0.75rem;">Seleccionar</button>` : ''}
              <button class="btn-ghost-custom" data-edit-mc="${c.id}" title="Editar" style="padding:4px 8px;font-size:0.75rem;">Editar</button>
              <button class="btn-danger-custom" data-delete-mc="${c.id}" title="Eliminar" style="padding:4px 8px;font-size:0.75rem;">Eliminar</button>
            </div>
          </td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" style="text-align:center;padding:24px;color:#94a3b8;">No se encontraron competidores en el Padrón.</td></tr>`;

    modalBox.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0;">Padron Maestro de Tiradores</h2>
          <span style="font-size:0.75rem;color:#64748b;font-weight:600;">Base de datos de tiradores registrados (${totalItems} en total)</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="btn-sync-padron" class="btn-ghost-custom" style="padding:6px 12px;font-size:0.78rem;font-weight:700;border-color:#0056b3;color:#0056b3;" title="Importar todos los competidores de todos los eventos al Padron">
            Sincronizar desde Eventos
          </button>
          <button id="close-mc-modal" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#64748b;font-weight:bold;">X</button>
        </div>
      </div>

      <div style="padding:16px 20px;background:#ffffff;display:flex;flex-direction:column;gap:12px;">
        <!-- Barra de Alta Rápida -->
        <form id="form-new-mc" style="display:flex;gap:8px;flex-wrap:wrap;background:#f1f5f9;padding:12px;border-radius:10px;border:1px solid #cbd5e1;">
          <input type="text" id="mc-new-name" placeholder="Nombre del Tirador *" required class="field-input" style="flex:2;min-width:180px;background:#fff;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;" />
          <input type="text" id="mc-new-cat" placeholder="Categoria (Opcional)" class="field-input" style="flex:1;min-width:120px;background:#fff;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;" />
          <button type="submit" class="btn-primary-custom" style="padding:8px 16px;background:#0056b3;color:#fff;border-radius:6px;font-weight:bold;">+ Agregar al Padron</button>
        </form>

        <!-- Filtros y Ordenamiento -->
        <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;">
          <input type="text" id="mc-search-input" value="${esc(searchQuery)}" placeholder="Buscar tirador por nombre o categoria..." style="flex:1;min-width:200px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.9rem;" />

          <select id="mc-sort-select" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.88rem;background:#fff;color:#0f172a;font-weight:600;">
            <option value="name_asc" ${sortBy === 'name_asc' ? 'selected' : ''}>Nombre (A-Z)</option>
            <option value="name_desc" ${sortBy === 'name_desc' ? 'selected' : ''}>Nombre (Z-A)</option>
            <option value="category" ${sortBy === 'category' ? 'selected' : ''}>Por Categoria</option>
            <option value="created" ${sortBy === 'created' ? 'selected' : ''}>Mas Recientes</option>
          </select>
        </div>

        <!-- Tabla -->
        <div style="max-height:300px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <thead>
              <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#0056b3;text-align:left;font-family:'Rajdhani',sans-serif;font-weight:700;">
                <th style="padding:8px 14px;">Nombre</th>
                <th style="padding:8px 14px;">Categoria</th>
                <th style="padding:8px 14px;">Telefono</th>
                <th style="padding:8px 14px;text-align:right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Paginador -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;font-size:0.85rem;color:#64748b;">
          <span>Pagina <b>${currentPage}</b> de <b>${totalPages}</b></span>
          <div style="display:flex;gap:6px;">
            <button id="mc-prev-page" ${currentPage === 1 ? 'disabled style="opacity:0.4;"' : ''} class="btn-ghost-custom" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-weight:bold;">Anterior</button>
            <button id="mc-next-page" ${currentPage === totalPages ? 'disabled style="opacity:0.4;"' : ''} class="btn-ghost-custom" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-weight:bold;">Siguiente</button>
          </div>
        </div>
      </div>
    `;

    // Eventos
    modalBox.querySelector('#close-mc-modal')?.addEventListener('click', () => {
      backdrop.remove();
    });

    modalBox.querySelector('#btn-sync-padron')?.addEventListener('click', async () => {
      const syncBtn = modalBox.querySelector('#btn-sync-padron') as HTMLButtonElement;
      if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = 'Sincronizando...'; }
      try {
        const added = await migrateParticipantsToPadron();
        if (added > 0) {
          showToast(`${added} tiradores agregados al Padron Maestro.`, 'success');
        } else {
          showToast('El Padron ya esta al dia. No se encontraron tiradores nuevos.', 'info');
        }
        await renderContent();
      } catch (err) {
        showToast('Error al sincronizar el Padron.', 'error');
      } finally {
        if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = 'Sincronizar desde Eventos'; }
      }
    });

    modalBox.querySelector('#form-new-mc')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nEl = modalBox.querySelector('#mc-new-name') as HTMLInputElement;
      const cEl = modalBox.querySelector('#mc-new-cat') as HTMLInputElement;
      if (!nEl.value.trim()) return;
      try {
        await addMasterCompetitor(nEl.value.trim(), cEl.value.trim());
        showToast('Tirador agregado al Padron Maestro.', 'success');
        nEl.value = '';
        cEl.value = '';
        await renderContent();
      } catch (err: any) {
        showToast(err.message || 'Error al guardar', 'error');
      }
    });

    const searchInp = modalBox.querySelector('#mc-search-input') as HTMLInputElement;
    searchInp?.addEventListener('input', () => {
      searchQuery = searchInp.value;
      currentPage = 1;
      renderContent();
    });

    const sortSel = modalBox.querySelector('#mc-sort-select') as HTMLSelectElement;
    sortSel?.addEventListener('change', () => {
      sortBy = sortSel.value as any;
      renderContent();
    });

    modalBox.querySelector('#mc-prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; renderContent(); }
    });

    modalBox.querySelector('#mc-next-page')?.addEventListener('click', () => {
      if (currentPage < totalPages) { currentPage++; renderContent(); }
    });

    modalBox.querySelectorAll('[data-delete-mc]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number((e.currentTarget as HTMLElement).dataset.deleteMc);
        if (await showConfirm('Eliminar del Padron', 'Confirma eliminar este tirador del Padron Maestro?')) {
          await deleteMasterCompetitor(id);
          showToast('Tirador eliminado del Padron.', 'info');
          renderContent();
        }
      });
    });

    modalBox.querySelectorAll('[data-edit-mc]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number((e.currentTarget as HTMLElement).dataset.editMc);
        const comp = all.find(c => c.id === id);
        if (!comp) return;

        const newName = await showPrompt('Editar Tirador', 'Ingrese el nuevo nombre:', comp.name);
        if (newName && newName.trim()) {
          const newCat = await showPrompt('Editar Categoria', 'Ingrese la categoria:', comp.category || '');
          await updateMasterCompetitor(id, { name: newName.trim(), category: (newCat || '').trim() });
          showToast('Tirador actualizado.', 'success');
          renderContent();
        }
      });
    });

    if (onSelectCallback) {
      modalBox.querySelectorAll('[data-select-mc]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = Number((e.currentTarget as HTMLElement).dataset.selectMc);
          const comp = all.find(c => c.id === id);
          if (comp) {
            onSelectCallback(comp);
            backdrop.remove();
          }
        });
      });
    }
  };

  backdrop.appendChild(modalBox);
  document.body.appendChild(backdrop);
  void backdrop.offsetWidth;
  backdrop.classList.add('is-open');
  await renderContent();
}
