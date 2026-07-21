/**
 * heatsManager.ts
 * Módulo para gestionar la asignación manual de tandas, el sorteo con reglas especiales (Ángel & Facundo Domínguez),
 * el reseteo de sorteo (Deshacer Sorteo) y el filtrado/ordenamiento de competidores del evento.
 */

import { db } from './db';
import type { Participant } from './types';
import { esc, showToast, showConfirm } from './modals';

/**
 * Aplica las Reglas Especiales de Sorteo de la Organización CPTP:
 * 1. Ángel Domínguez y Facundo Domínguez NUNCA deben estar en la misma tanda.
 * 2. Facundo Domínguez debe tirar SIEMPRE en una tanda ANTERIOR (menor número) que Ángel Domínguez.
 */
export function applySpecialFamilySeedingRules(participants: Participant[]): Participant[] {
  // Buscar participantes de la familia Domínguez
  const facundoIndex = participants.findIndex(p => p.name.toLowerCase().includes('facundo domínguez') || p.name.toLowerCase().includes('facundo dominguez'));
  const angelIndex = participants.findIndex(p => p.name.toLowerCase().includes('ángel domínguez') || p.name.toLowerCase().includes('angel dominguez'));

  if (facundoIndex >= 0 && angelIndex >= 0) {
    const facundo = participants[facundoIndex];
    const angel = participants[angelIndex];

    if (facundo.tanda !== undefined && angel.tanda !== undefined) {
      if (facundo.tanda >= angel.tanda) {
        if (facundo.tanda > angel.tanda) {
          // Si Facundo tiene una tanda mayor a Ángel, simplemente intercambiar sus puestos y tandas
          const tempT = facundo.tanda;
          const tempS = facundo.spot;
          facundo.tanda = angel.tanda;
          facundo.spot = angel.spot;
          angel.tanda = tempT;
          angel.spot = tempS;
        } else {
          // Si coinciden en la misma tanda, mover a Facundo a una tanda anterior o a Ángel a una posterior
          if (angel.tanda < 8) {
            angel.tanda = angel.tanda + 1;
          } else {
            facundo.tanda = Math.max(1, facundo.tanda - 1);
          }
        }
      }
    }
  }

  return participants;
}

/**
 * Función para deshacer/limpiar el sorteo de tandas de todos los competidores de un evento.
 */
export async function resetEventSeeding(eventId: number, onSaveCallback: () => void): Promise<void> {
  if (!await showConfirm('Deshacer Sorteo', '¿Confirma deshacer y limpiar el sorteo de tandas de todos los competidores de este evento? Podrá sortear nuevamente o asignar de forma manual.')) {
    return;
  }

  const participants = await db.participants.where('eventId').equals(eventId).toArray();
  for (const p of participants) {
    await db.participants.update(p.id!, {
      tanda: undefined,
      sector: undefined,
      spot: undefined
    });
  }

  showToast('Sorteo deshecho con éxito. Puestos y tandas limpiadas.', 'info');
  onSaveCallback();
}

/**
 * Modal táctico para cambiar el orden de las tandas y puestos manualmente (Control Total del Organizador).
 */
export async function showManualHeatsReorderModal(eventId: number, onSaveCallback: () => void): Promise<void> {
  const participants = await db.participants.where('eventId').equals(eventId).toArray();
  if (participants.length === 0) {
    showToast('No hay competidores en este evento.', 'info');
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'cptp-modal-backdrop';
  backdrop.style.zIndex = '1050';

  const modalBox = document.createElement('div');
  modalBox.className = 'cptp-modal-content';
  modalBox.style.maxWidth = '640px';
  modalBox.style.padding = '0';
  modalBox.style.overflow = 'hidden';

  // Copia de trabajo
  const workingParticipants = participants.map(p => ({ ...p }));

  const renderList = () => {
    // Agrupar por Tanda
    const heatsMap = new Map<number, Participant[]>();
    workingParticipants.forEach(p => {
      const t = p.tanda || 0; // 0 = Sin tanda
      if (!heatsMap.has(t)) heatsMap.set(t, []);
      heatsMap.get(t)!.push(p);
    });

    const sortedTandas = Array.from(heatsMap.keys()).sort((a, b) => a - b);

    const tandasHtml = sortedTandas.map(tandaNum => {
      const group = heatsMap.get(tandaNum)!;
      const title = tandaNum === 0 ? '⚠️ Competidores sin Tanda Asignada' : `Tanda ${tandaNum}`;

      const itemsHtml = group.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:#ffffff;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;gap:8px;">
          <div style="min-width:0;flex:1;">
            <span style="font-weight:700;color:#0f172a;font-size:0.9rem;">#${p.competitorNumber} — ${esc(p.name)}</span>
            <span style="font-size:0.75rem;color:#64748b;display:block;">${esc(p.category || 'General')} ${p.sector ? `· Sector ${p.sector}` : ''} ${p.spot ? `· Puesto ${p.spot}` : ''}</span>
          </div>

          <div style="display:flex;gap:6px;align-items:center;">
            <label style="font-size:0.75rem;font-weight:700;color:#475569;">Tanda:</label>
            <select data-move-p="${p.id}" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.85rem;background:#fff;font-weight:bold;color:#0056b3;">
              ${Array.from({ length: 8 }, (_, i) => i + 1).map(n => `
                <option value="${n}" ${p.tanda === n ? 'selected' : ''}>Tanda ${n}</option>
              `).join('')}
            </select>
          </div>
        </div>
      `).join('');

      return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-size:0.95rem;font-weight:800;color:#0056b3;font-family:'Orbitron',sans-serif;margin-bottom:8px;display:flex;justify-content:space-between;">
            <span>${title}</span>
            <span style="font-size:0.78rem;color:#64748b;">${group.length} Tiradores</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">${itemsHtml}</div>
        </div>
      `;
    }).join('');

    modalBox.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0;">Reordenar Tandas Manualmente</h2>
          <span style="font-size:0.75rem;color:#64748b;font-weight:600;">Control Total del Organizador del Evento</span>
        </div>
        <button id="close-heats-modal" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#64748b;font-weight:bold;">X</button>
      </div>

      <div style="padding:16px 20px;max-height:60vh;overflow-y:auto;background:#ffffff;">
        ${tandasHtml}
      </div>

      <div style="padding:16px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;">
        <button id="btn-cancel-heats" class="btn-ghost-custom" style="padding:8px 16px;">Cancelar</button>
        <button id="btn-save-heats" class="btn-primary-custom" style="padding:8px 20px;background:#0056b3;color:#ffffff;border-radius:8px;font-weight:bold;">Guardar Nuevo Orden</button>
      </div>
    `;

    modalBox.querySelector('#close-heats-modal')?.addEventListener('click', () => backdrop.remove());
    modalBox.querySelector('#btn-cancel-heats')?.addEventListener('click', () => backdrop.remove());

    modalBox.querySelectorAll('[data-move-p]').forEach(select => {
      select.addEventListener('change', (e) => {
        const pId = Number((e.currentTarget as HTMLElement).dataset.moveP);
        const newTanda = Number((e.currentTarget as HTMLSelectElement).value);
        const target = workingParticipants.find(p => p.id === pId);
        if (target) {
          target.tanda = newTanda;
          renderList();
        }
      });
    });

    modalBox.querySelector('#btn-save-heats')?.addEventListener('click', async () => {
      // Aplicar reglas especiales de Ángel y Facundo Domínguez si aplican
      const validatedParticipants = applySpecialFamilySeedingRules(workingParticipants);

      // Agrupar por tanda asignada y asignar spots secuenciales del 1 al 4
      const groups: Record<number, Participant[]> = {};
      for (const p of validatedParticipants) {
        if (p.tanda) {
          if (!groups[p.tanda]) groups[p.tanda] = [];
          groups[p.tanda].push(p);
        }
      }

      // Para cada tanda, reasignar spots consecutivamente de 1 a 4
      for (const tString in groups) {
        const t = Number(tString);
        groups[t].forEach((p, idx) => {
          p.spot = (idx + 1) as 1 | 2 | 3 | 4;
        });
      }

      for (const p of validatedParticipants) {
        await db.participants.update(p.id!, {
          tanda: p.tanda,
          spot: p.tanda ? p.spot : undefined,
          sector: undefined
        });
      }

      showToast('Orden de tandas actualizado con éxito.', 'success');
      backdrop.remove();
      onSaveCallback();
    });
  };

  backdrop.appendChild(modalBox);
  document.body.appendChild(backdrop);
  void backdrop.offsetWidth;
  backdrop.classList.add('is-open');
  renderList();
}
