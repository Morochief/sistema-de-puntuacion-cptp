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



export function applySpecialFamilySeedingRulesS2(participants: Participant[]): Participant[] {

  const facundoIndex = participants.findIndex(p => p.name.toLowerCase().includes('facundo domínguez') || p.name.toLowerCase().includes('facundo dominguez'));

  const angelIndex = participants.findIndex(p => p.name.toLowerCase().includes('ángel domínguez') || p.name.toLowerCase().includes('angel dominguez'));



  if (facundoIndex >= 0 && angelIndex >= 0) {

    const facundo = participants[facundoIndex];

    const angel = participants[angelIndex];



    if (facundo.tandaS2 !== undefined && angel.tandaS2 !== undefined) {

      const allowedTandas = [2, 3, 4];

      

      const swapWithCandidate = (p: Participant, candidate: Participant) => {

        const tempT = p.tandaS2;

        const tempS = p.spotS2;

        p.tandaS2 = candidate.tandaS2;

        p.spotS2 = candidate.spotS2;

        candidate.tandaS2 = tempT;

        candidate.spotS2 = tempS;

      };



      const enforceAllowedTanda = (p: Participant, otherId: number) => {

        if (!allowedTandas.includes(p.tandaS2!)) {

          const candidate = participants.find(x => 

            x.id !== p.id && x.id !== otherId && x.tandaS2 !== undefined && allowedTandas.includes(x.tandaS2)

          );

          if (candidate) {

            swapWithCandidate(p, candidate);

          } else {

            p.tandaS2 = 2;

          }

        }

      };



      // Regla 1

      enforceAllowedTanda(facundo, angel.id!);

      enforceAllowedTanda(angel, facundo.id!);



      // Regla 2

      if (facundo.tandaS2 > angel.tandaS2!) {

        swapWithCandidate(facundo, angel);

      }

      

      // Regla 3

      if (facundo.tandaS2 === angel.tandaS2) {

        let targetTanda = angel.tandaS2! < 4 ? angel.tandaS2! + 1 : facundo.tandaS2! - 1;

        let personToMove = angel.tandaS2! < 4 ? angel : facundo;

        

        const swapCandidate = participants.find(x => x.id !== facundo.id && x.id !== angel.id && x.tandaS2 === targetTanda);

        if (swapCandidate) {

          swapWithCandidate(personToMove, swapCandidate);

        } else {

          personToMove.tandaS2 = targetTanda;

          personToMove.spotS2 = 1;

        }

      }

    }

  }



  const groups: Record<number, Participant[]> = {};

  for (const p of participants) {

    if (p.tandaS2 !== undefined) {

      if (!groups[p.tandaS2]) groups[p.tandaS2] = [];

      groups[p.tandaS2].push(p);

    }

  }



  const overfilled: Participant[] = [];

  for (const t in groups) {

    if (groups[t].length > 4) {

      overfilled.push(...groups[t].splice(4));

    }

    groups[t].forEach((p, idx) => {

      p.spotS2 = (idx + 1) as 1|2|3|4;

    });

  }



  if (overfilled.length > 0) {

    for (const p of overfilled) {

      let found = false;

      for (let t = 1; t <= 8; t++) {

        if (!groups[t]) groups[t] = [];

        if (groups[t].length < 4) {

          p.tandaS2 = t;

          groups[t].push(p);

          p.spotS2 = groups[t].length as 1|2|3|4;

          found = true;

          break;

        }

      }

      if (!found) {

        p.tandaS2 = undefined;

        p.spotS2 = undefined;

      }

    }

  }



  return participants;

}



export function applySpecialFamilySeedingRules(participants: Participant[]): Participant[] {

  const facundoIndex = participants.findIndex(p => p.name.toLowerCase().includes('facundo domínguez') || p.name.toLowerCase().includes('facundo dominguez'));

  const angelIndex = participants.findIndex(p => p.name.toLowerCase().includes('ángel domínguez') || p.name.toLowerCase().includes('angel dominguez'));



  if (facundoIndex >= 0 && angelIndex >= 0) {

    const facundo = participants[facundoIndex];

    const angel = participants[angelIndex];



    if (facundo.tanda !== undefined && angel.tanda !== undefined) {

      const allowedTandas = [2, 3, 4];

      

      const swapWithCandidate = (p: Participant, candidate: Participant) => {

        const tempT = p.tanda;

        const tempS = p.spot;

        p.tanda = candidate.tanda;

        p.spot = candidate.spot;

        candidate.tanda = tempT;

        candidate.spot = tempS;

      };



      const enforceAllowedTanda = (p: Participant, otherId: number) => {

        if (!allowedTandas.includes(p.tanda!)) {

          const candidate = participants.find(x => 

            x.id !== p.id && x.id !== otherId && x.tanda !== undefined && allowedTandas.includes(x.tanda)

          );

          if (candidate) {

            swapWithCandidate(p, candidate);

          } else {

            p.tanda = 2;

          }

        }

      };



      // Regla 1

      enforceAllowedTanda(facundo, angel.id!);

      enforceAllowedTanda(angel, facundo.id!);



      // Regla 2

      if (facundo.tanda > angel.tanda!) {

        swapWithCandidate(facundo, angel);

      }

      

      // Regla 3

      if (facundo.tanda === angel.tanda) {

        let targetTanda = angel.tanda! < 4 ? angel.tanda! + 1 : facundo.tanda! - 1;

        let personToMove = angel.tanda! < 4 ? angel : facundo;

        

        // Find someone in the target tanda to swap with

        const swapCandidate = participants.find(x => x.id !== facundo.id && x.id !== angel.id && x.tanda === targetTanda);

        if (swapCandidate) {

          swapWithCandidate(personToMove, swapCandidate);

        } else {

          // If no one is there, it's safe to just move without causing >4 per tanda

          personToMove.tanda = targetTanda;

          personToMove.spot = 1;

        }

      }

    }

  }



  // To absolutely ensure no tanda has >4 people and spots are unique,

  // we do a quick re-pack of spots per tanda.

  const groups: Record<number, Participant[]> = {};

  for (const p of participants) {

    if (p.tanda !== undefined) {

      if (!groups[p.tanda]) groups[p.tanda] = [];

      groups[p.tanda].push(p);

    }

  }



  // Fix any overfilled tandas by moving extra people to the first available spot

  const overfilled: Participant[] = [];

  for (const t in groups) {

    if (groups[t].length > 4) {

      overfilled.push(...groups[t].splice(4));

    }

    // Reassign spots 1-4

    groups[t].forEach((p, idx) => {

      p.spot = (idx + 1) as 1|2|3|4;

    });

  }



  // Assign any overfilled participants to the next available tanda/spot

  if (overfilled.length > 0) {

    for (const p of overfilled) {

      let found = false;

      for (let t = 1; t <= 8; t++) {

        if (!groups[t]) groups[t] = [];

        if (groups[t].length < 4) {

          p.tanda = t;

          groups[t].push(p);

          p.spot = groups[t].length as 1|2|3|4;

          found = true;

          break;

        }

      }

      if (!found) {

        // Fallback if event is totally full

        p.tanda = undefined;

        p.spot = undefined;

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

      spot: undefined,

      tandaS2: undefined,

      spotS2: undefined

    });

  }



  showToast('Sorteo deshecho con éxito. Mesas y tandas limpiadas.', 'info');

  onSaveCallback();

}



/**

 * Modal táctico para cambiar el orden de las tandas y mesas manualmente (Control Total del Organizador).

 */

export async function showManualHeatsReorderModal(eventId: number, onSaveCallback: () => void, seriesNum: number = 1): Promise<void> {
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
  modalBox.style.maxWidth = '600px';
  modalBox.style.padding = '0';
  modalBox.style.overflow = 'hidden';

  // Copia de trabajo para cambios locales
  const workingParticipants = participants.map(p => ({ ...p }));

  const renderList = () => {
    // Ordenar por Tanda y luego por Mesa (según la Serie que estemos editando)
    workingParticipants.sort((a, b) => {
      const tA = (seriesNum === 1 ? a.tanda : a.tandaS2) ?? 999;
      const tB = (seriesNum === 1 ? b.tanda : b.tandaS2) ?? 999;
      if (tA !== tB) return tA - tB;
      const sA = (seriesNum === 1 ? a.spot : a.spotS2) ?? 999;
      const sB = (seriesNum === 1 ? b.spot : b.spotS2) ?? 999;
      return sA - sB;
    });

    // Agrupar por tanda para la cabecera visual
    const heatsMap = new Map<number, typeof workingParticipants>();
    workingParticipants.forEach(p => {
      const t = (seriesNum === 1 ? p.tanda : p.tandaS2) || 0; // 0 = Sin tanda
      if (!heatsMap.has(t)) heatsMap.set(t, []);
      heatsMap.get(t)!.push(p);
    });

    const sortedTandas = Array.from(heatsMap.keys()).sort((a, b) => a - b);

    const tandasHtml = sortedTandas.map(tandaNum => {
      const group = heatsMap.get(tandaNum)!;
      const title = tandaNum === 0 ? '⚠️ Competidores sin Tanda Asignada' : `Tanda ${tandaNum}`;

      const itemsHtml = group.map(p => {
        // Encontrar el índice en la lista general ordenada para los botones arriba/abajo
        const globalIdx = workingParticipants.findIndex(x => x.id === p.id);
        const pSpot = seriesNum === 1 ? p.spot : p.spotS2;
        const pTanda = seriesNum === 1 ? p.tanda : p.tandaS2;

        return `
          <div style="display:flex;align-items:center;justify-content:space-between;background:#ffffff;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;gap:12px;">
            <div style="min-width:0;flex:1;">
              <span style="font-weight:800;color:#0f172a;font-size:0.92rem;">#${p.competitorNumber} — ${esc(p.name)}</span>
              <span style="font-size:0.78rem;color:#64748b;font-weight:600;display:block;margin-top:2px;">
                ${esc(p.category || 'General')} · ${pTanda ? `Tanda ${pTanda}` : 'Sin Tanda'} · ${pSpot ? `Mesa ${pSpot}` : 'Sin Mesa'}
              </span>
            </div>

            <div style="display:flex;gap:6px;align-items:center;">
              <button class="btn-arrow-up" data-p-idx="${globalIdx}" 
                  style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;width:34px;height:34px;cursor:pointer;font-weight:bold;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"
                  ${globalIdx === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                ▲
              </button>
              <button class="btn-arrow-down" data-p-idx="${globalIdx}" 
                  style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;width:34px;height:34px;cursor:pointer;font-weight:bold;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"
                  ${globalIdx === workingParticipants.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                ▼
              </button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-size:0.95rem;font-weight:800;color:#0056b3;font-family:'Orbitron',sans-serif;margin-bottom:10px;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
            <span>${title}</span>
            <span style="font-size:0.78rem;color:#64748b;">${group.length} Tiradores</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">${itemsHtml}</div>
        </div>
      `;
    }).join('');

    modalBox.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0;">Reordenar Serie ${seriesNum}</h2>
          <span style="font-size:0.75rem;color:#64748b;font-weight:600;">Usá ▲ y ▼ para mover competidores entre Tandas y Mesas</span>
        </div>
        <button id="close-heats-modal" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#64748b;font-weight:bold;padding:8px;">X</button>
      </div>

      <div style="padding:16px 20px;max-height:60vh;overflow-y:auto;background:#ffffff;">
        ${tandasHtml}
      </div>

      <div style="padding:16px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;">
        <button id="btn-cancel-heats" class="btn-ghost-custom" style="padding:8px 16px;">Cancelar</button>
        <button id="btn-save-heats" class="btn-primary-custom" style="padding:8px 20px;background:#0056b3;color:#ffffff;border-radius:8px;font-weight:bold;">Guardar Nuevo Orden</button>
      </div>
    `;

    // Vincular cierre
    modalBox.querySelector('#close-heats-modal')?.addEventListener('click', () => backdrop.remove());
    modalBox.querySelector('#btn-cancel-heats')?.addEventListener('click', () => backdrop.remove());

    // Vincular botones de subir posición (▲)
    modalBox.querySelectorAll('.btn-arrow-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).dataset.pIdx);
        if (idx > 0) {
          const current = workingParticipants[idx];
          const prev = workingParticipants[idx - 1];
          
          if (seriesNum === 1) {
            const tempT = current.tanda;
            const tempS = current.spot;
            current.tanda = prev.tanda;
            current.spot = prev.spot;
            prev.tanda = tempT;
            prev.spot = tempS;
          } else {
            const tempT = current.tandaS2;
            const tempS = current.spotS2;
            current.tandaS2 = prev.tandaS2;
            current.spotS2 = prev.spotS2;
            prev.tandaS2 = tempT;
            prev.spotS2 = tempS;
          }
          renderList();
        }
      });
    });

    // Vincular botones de bajar posición (▼)
    modalBox.querySelectorAll('.btn-arrow-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).dataset.pIdx);
        if (idx < workingParticipants.length - 1) {
          const current = workingParticipants[idx];
          const next = workingParticipants[idx + 1];
          
          if (seriesNum === 1) {
            const tempT = current.tanda;
            const tempS = current.spot;
            current.tanda = next.tanda;
            current.spot = next.spot;
            next.tanda = tempT;
            next.spot = tempS;
          } else {
            const tempT = current.tandaS2;
            const tempS = current.spotS2;
            current.tandaS2 = next.tandaS2;
            current.spotS2 = next.spotS2;
            next.tandaS2 = tempT;
            next.spotS2 = tempS;
          }
          renderList();
        }
      });
    });

    // Vincular botón guardar
    modalBox.querySelector('#btn-save-heats')?.addEventListener('click', async () => {
      let validatedParticipants = [...workingParticipants];
      
      if (seriesNum === 1) {
        // Reglas de familia y rifles compartidos para la Serie 1
        validatedParticipants = applySpecialFamilySeedingRules(validatedParticipants);
        validatedParticipants = applySharedRifleRules(validatedParticipants);
        
        // Agrupar y asegurar sincronía en S2
        const groups: Record<number, Participant[]> = {};
        for (const p of validatedParticipants) {
          if (p.tanda) {
            if (!groups[p.tanda]) groups[p.tanda] = [];
            groups[p.tanda].push(p);
          }
        }
        
        for (const tString in groups) {
          const t = Number(tString);
          const group = groups[t];
          
          // Re-indexar los spots secuenciales de S1 del 1 al 4 (por seguridad)
          group.forEach((p, idx) => {
            p.spot = (idx + 1) as 1|2|3|4;
            p.tandaS2 = t;
          });
          
          // Para S2, si no hay spots válidos asignados, barajar
          const assignedSpotsS2 = new Set<number>();
          const unassignedS2: Participant[] = [];
          group.forEach(p => {
             const targetSpot = p.spotS2;
             if (targetSpot && targetSpot >= 1 && targetSpot <= 4 && !assignedSpotsS2.has(targetSpot)) {
                assignedSpotsS2.add(targetSpot);
                p.spotS2 = targetSpot as 1|2|3|4;
             } else {
                unassignedS2.push(p);
             }
          });
          
          const availableS2Spots = [1, 2, 3, 4].filter(s => !assignedSpotsS2.has(s));
          for (let i = availableS2Spots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableS2Spots[i], availableS2Spots[j]] = [availableS2Spots[j], availableS2Spots[i]];
          }
          unassignedS2.forEach((p, idx) => {
            p.spotS2 = availableS2Spots[idx] as 1|2|3|4;
          });
        }
      } else {
        // En Serie 2, asegurar que se preserva el mismo orden seleccionado
        const groups: Record<number, Participant[]> = {};
        for (const p of validatedParticipants) {
          if (p.tandaS2) {
            if (!groups[p.tandaS2]) groups[p.tandaS2] = [];
            groups[p.tandaS2].push(p);
          }
        }
        for (const tString in groups) {
          const t = Number(tString);
          groups[t].forEach((p, idx) => {
            p.spotS2 = (idx + 1) as 1|2|3|4;
          });
        }
      }
      
      // Guardar todos los participantes con Dexie.put para total compatibilidad
      for (const p of validatedParticipants) {
        if (p.tanda === undefined || p.tanda === null) {
          p.spot = undefined;
        }
        if (p.tandaS2 === undefined || p.tandaS2 === null) {
          p.spotS2 = undefined;
        }
        p.sector = undefined;
        await db.participants.put(p);
      }

      showToast('Orden de tandas y mesas actualizado con éxito.', 'success');
      backdrop.remove();
      if (onSaveCallback) onSaveCallback();
    });
  };

  backdrop.appendChild(modalBox);
  document.body.appendChild(backdrop);
  renderList();
}
