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

  modalBox.style.maxWidth = '640px';

  modalBox.style.padding = '0';

  modalBox.style.overflow = 'hidden';



  // Copia de trabajo

  const workingParticipants = participants.map(p => ({ ...p }));



  const renderList = () => {

    // Agrupar por Tanda (dependiendo de la Serie)

    const heatsMap = new Map<number, Participant[]>();

    workingParticipants.forEach(p => {

      const t = (seriesNum === 1 ? p.tanda : p.tandaS2) || 0; // 0 = Sin tanda

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

            <span style="font-size:0.75rem;color:#64748b;display:block;">${esc(p.category || 'General')} ${seriesNum === 1 ? (p.spot ? `· Mesa ${p.spot}` : '') : (p.spotS2 ? `· Mesa ${p.spotS2}` : '')}</span>

          </div>



          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">

            <label style="font-size:0.75rem;font-weight:700;color:#475569;">Tanda:</label>

            <select data-move-p="${p.id}" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.85rem;background:#fff;font-weight:bold;color:#0056b3;">

              ${Array.from({ length: 8 }, (_, i) => i + 1).map(n => `

                <option value="${n}" ${(seriesNum === 1 ? p.tanda : p.tandaS2) === n ? 'selected' : ''}>Tanda ${n}</option>

              `).join('')}

            </select>

            <label style="font-size:0.75rem;font-weight:700;color:#475569;margin-left:8px;">Mesa:</label>
            <select data-move-spot="${p.id}" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.85rem;background:#fff;font-weight:bold;color:#0f172a;">
              ${Array.from({ length: 4 }, (_, i) => i + 1).map(n => `
                <option value="${n}" ${(seriesNum === 1 ? p.spot : p.spotS2) === n ? 'selected' : ''}>Mesa ${n}</option>
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

          <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0;">Reordenar Tandas Serie ${seriesNum}</h2>

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
          // Find occupied spots in the new tanda
          const occupiedSpots = new Set<number>();
          workingParticipants.forEach(p => {
            if (p.id !== pId && (seriesNum === 1 ? p.tanda : p.tandaS2) === newTanda) {
              const s = seriesNum === 1 ? p.spot : p.spotS2;
              if (s) occupiedSpots.add(s);
            }
          });
          
          let nextSpot = 1;
          for (let s = 1; s <= 4; s++) {
            if (!occupiedSpots.has(s)) {
              nextSpot = s;
              break;
            }
          }
          
          if (seriesNum === 1) {
            target.tanda = newTanda;
            target.spot = nextSpot as 1|2|3|4;
          } else {
            target.tandaS2 = newTanda;
            target.spotS2 = nextSpot as 1|2|3|4;
          }
          renderList();
        }
      });
    });

    modalBox.querySelectorAll('[data-move-spot]').forEach(select => {
      select.addEventListener('change', (e) => {
        const pId = Number((e.currentTarget as HTMLElement).dataset.moveSpot);
        const newSpot = Number((e.currentTarget as HTMLSelectElement).value) as 1|2|3|4;
        const target = workingParticipants.find(p => p.id === pId);
        if (target) {
          const currentTanda = seriesNum === 1 ? target.tanda : target.tandaS2;
          const oldSpot = seriesNum === 1 ? target.spot : target.spotS2;
          
          // Swap spots with the other competitor in the same tanda if they occupy the new spot
          const swapPartner = workingParticipants.find(p => 
            p.id !== pId && 
            (seriesNum === 1 ? p.tanda : p.tandaS2) === currentTanda && 
            (seriesNum === 1 ? p.spot : p.spotS2) === newSpot
          );
          
          if (seriesNum === 1) {
            target.spot = newSpot;
            if (swapPartner && oldSpot) {
              swapPartner.spot = oldSpot as 1|2|3|4;
            }
          } else {
            target.spotS2 = newSpot;
            if (swapPartner && oldSpot) {
              swapPartner.spotS2 = oldSpot as 1|2|3|4;
            }
          }
          renderList();
        }
      });
    });



    modalBox.querySelector('#btn-save-heats')?.addEventListener('click', async () => {
      let validatedParticipants = [...workingParticipants];
      
      if (seriesNum === 1) {
        // Enforce S1 rules
        validatedParticipants = applySpecialFamilySeedingRules(validatedParticipants);
        validatedParticipants = applySharedRifleRules(validatedParticipants);
        
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
          
          // Resolve S1 spot conflicts preserving manual selections
          const assignedSpots = new Set<number>();
          const unassigned: Participant[] = [];
          group.forEach(p => {
             const targetSpot = p.spot;
             if (targetSpot && targetSpot >= 1 && targetSpot <= 4 && !assignedSpots.has(targetSpot)) {
                assignedSpots.add(targetSpot);
                p.spot = targetSpot as 1|2|3|4;
             } else {
                unassigned.push(p);
             }
          });
          
          let nextAvailable = 1;
          for (const p of unassigned) {
             while (assignedSpots.has(nextAvailable)) {
               nextAvailable++;
             }
             if (nextAvailable <= 4) {
               p.spot = nextAvailable as 1|2|3|4;
               assignedSpots.add(nextAvailable);
             } else {
               p.spot = 4;
             }
          }
          
          // Ensure S2 tanda is set for everyone in S1 edit
          group.forEach(p => { p.tandaS2 = t; });
          
          // Resolve S2 spots preserving manually assigned ones, fallback to shuffling remaining
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
        const groups: Record<number, Participant[]> = {};
        for (const p of validatedParticipants) {
          if (p.tandaS2) {
            if (!groups[p.tandaS2]) groups[p.tandaS2] = [];
            groups[p.tandaS2].push(p);
          }
        }
        
        for (const tString in groups) {
          const t = Number(tString);
          const group = groups[t];
          
          const assignedSpots = new Set<number>();
          const unassigned: Participant[] = [];
          
          group.forEach(p => {
             const targetSpot = p.spotS2;
             if (targetSpot && targetSpot >= 1 && targetSpot <= 4 && !assignedSpots.has(targetSpot)) {
                assignedSpots.add(targetSpot);
                p.spotS2 = targetSpot as 1|2|3|4;
             } else {
                unassigned.push(p);
             }
          });

          let nextAvailable = 1;
          for (const p of unassigned) {
             while (assignedSpots.has(nextAvailable)) {
               nextAvailable++;
             }
             if (nextAvailable <= 4) {
               p.spotS2 = nextAvailable as 1|2|3|4;
               assignedSpots.add(nextAvailable);
             } else {
               p.spotS2 = 4;
             }
          }
        }
      }
      
      for (const p of validatedParticipants) {

        await db.participants.update(p.id!, {

          tanda: p.tanda,

          spot: p.tanda ? p.spot : undefined,

          tandaS2: p.tandaS2,

          spotS2: p.tandaS2 ? p.spotS2 : undefined,

          sector: undefined

        });

      }



      showToast('Orden de tandas actualizado con éxito.', 'success');

      backdrop.remove();

      if (onSaveCallback) onSaveCallback();

    });

  };



  backdrop.appendChild(modalBox);

  document.body.appendChild(backdrop);

  void backdrop.offsetWidth;

  backdrop.classList.add('is-open');

  renderList();

}

export function applySharedRifleRules(participants: Participant[]): Participant[] {
  const groups: Record<string, Participant[]> = {};
  for (const p of participants) {
    if (p.sharedRifleId && p.tanda) {
      if (!groups[p.sharedRifleId]) groups[p.sharedRifleId] = [];
      groups[p.sharedRifleId].push(p);
    }
  }

  for (const rifleId in groups) {
    const members = groups[rifleId];
    if (members.length < 2) continue;
    
    let tandasOccupied = new Set<number>();
    for (const m of members) {
      if (tandasOccupied.has(m.tanda!)) {
        const candidate = participants.find(x => 
          x.tanda !== undefined &&
          x.tanda !== m.tanda &&
          !tandasOccupied.has(x.tanda!) &&
          x.sharedRifleId !== rifleId &&
          !x.name.toLowerCase().includes('domnguez') &&
          !x.name.toLowerCase().includes('dominguez') &&
          !m.name.toLowerCase().includes('domnguez') &&
          !m.name.toLowerCase().includes('dominguez')
        );
        if (candidate) {
          const tempT = m.tanda;
          const tempS = m.spot;
          m.tanda = candidate.tanda;
          m.spot = candidate.spot;
          candidate.tanda = tempT;
          candidate.spot = tempS;
          tandasOccupied.add(m.tanda!);
        }
      } else {
        tandasOccupied.add(m.tanda!);
      }
    }
  }
  return participants;
}

