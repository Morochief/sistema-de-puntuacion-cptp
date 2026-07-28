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



  const participants = await db.participants.where('eventId').equals(eventId).filter((item: any) => !item.is_deleted).toArray();

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

export async function showManualHeatsReorderModal(eventId: number, onSaveCallback: () => void, seriesNum: number = 1, isCF: boolean = false): Promise<void> {
  const participants = await db.participants.where('eventId').equals(eventId).filter((item: any) => !item.is_deleted).toArray();
  if (participants.length === 0) { showToast('No hay competidores en este evento.', 'info'); return; }

  const backdrop = document.createElement('div');
  backdrop.className = 'cptp-modal-backdrop';
  backdrop.style.zIndex = '1050';
  const modalBox = document.createElement('div');
  modalBox.className = 'cptp-modal-content';
  modalBox.style.maxWidth = isCF ? '520px' : '640px';
  modalBox.style.padding = '0';
  modalBox.style.overflow = 'hidden';

  const workingParticipants = participants.map(p => ({ ...p }));

  // ── CF: flat sequential list ──────────────────────────────────────────────
  if (isCF) {
    const sorted = [...workingParticipants].sort((a, b) => (a.tanda ?? 9999) - (b.tanda ?? 9999));

    modalBox.innerHTML = `
      <div style="padding:14px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2 style="font-family:'Orbitron',sans-serif;font-size:1.05rem;font-weight:900;color:#0056b3;margin:0;">Reordenar Turnos</h2>
          <span style="font-size:0.73rem;color:#64748b;font-weight:600;">Usá ▲ y ▼ para cambiar el orden de tiro</span>
        </div>
        <button id="close-heats-modal" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#64748b;font-weight:bold;padding:6px;">X</button>
      </div>
      <div id="modal-scroll-body" style="padding:14px 18px;max-height:65vh;overflow-y:auto;background:#fff;"></div>
      <div style="padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:10px;">
        <button id="btn-cancel-heats" class="btn-ghost-custom" style="padding:8px 14px;">Cancelar</button>
        <button id="btn-save-heats" class="btn-primary-custom" style="padding:8px 18px;background:#0056b3;color:#fff;border-radius:8px;font-weight:bold;">Guardar Nuevo Orden</button>
      </div>`;

    const renderCFList = () => {
      const body = modalBox.querySelector('#modal-scroll-body');
      if (!body) return;
      const sv = body.scrollTop;
      body.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">${
        sorted.map((p, idx) => `
          <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
            <span style="font-size:0.85rem;font-weight:900;color:#0056b3;min-width:24px;text-align:center;">${idx + 1}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;font-size:0.88rem;color:#0f172a;">#${p.competitorNumber} — ${esc(p.name)}</div>
              <div style="font-size:0.7rem;color:#64748b;">${esc(p.category || 'General')}</div>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="cf-up" data-idx="${idx}" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:0.82rem;font-weight:bold;color:#333;" ${idx===0?'disabled':''}>▲</button>
              <button class="cf-dn" data-idx="${idx}" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:0.82rem;font-weight:bold;color:#333;" ${idx===sorted.length-1?'disabled':''}>▼</button>
            </div>
          </div>`).join('')}
      </div>`;
      body.scrollTop = sv;
      body.querySelectorAll('.cf-up').forEach(b => b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        if (i > 0) { [sorted[i-1], sorted[i]] = [sorted[i], sorted[i-1]]; renderCFList(); }
      }));
      body.querySelectorAll('.cf-dn').forEach(b => b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        if (i < sorted.length - 1) { [sorted[i], sorted[i+1]] = [sorted[i+1], sorted[i]]; renderCFList(); }
      }));
    };

    const closeModal = () => { backdrop.classList.remove('is-open'); backdrop.classList.add('is-closing'); setTimeout(() => backdrop.remove(), 150); };
    modalBox.querySelector('#close-heats-modal')?.addEventListener('click', closeModal);
    modalBox.querySelector('#btn-cancel-heats')?.addEventListener('click', closeModal);
    modalBox.querySelector('#btn-save-heats')?.addEventListener('click', async () => {
      for (let i = 0; i < sorted.length; i++) {
        const p = workingParticipants.find(wp => wp.id === sorted[i].id);
        if (!p) continue;
        p.tanda = i + 1; p.spot = 1; p.competitorNumber = i + 1;
        await db.participants.put(p);
      }
      showToast('Orden de tiro actualizado.', 'success');
      closeModal(); if (onSaveCallback) onSaveCallback();
    });
    backdrop.appendChild(modalBox); document.body.appendChild(backdrop);
    void backdrop.offsetWidth; backdrop.classList.add('is-open'); renderCFList(); return;
  }

  // ── .22 LR: original tanda/mesa modal ────────────────────────────────────
  modalBox.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0;">Reordenar Serie ${seriesNum}</h2>
        <span style="font-size:0.75rem;color:#64748b;font-weight:600;">Elegí la Tanda con la lista y cambiá de Mesa (1-4) usando ▲ y ▼</span>
      </div>
      <button id="close-heats-modal" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#64748b;font-weight:bold;padding:8px;">X</button>
    </div>
    <div id="modal-scroll-body" style="padding:16px 20px;max-height:60vh;overflow-y:auto;background:#ffffff;"></div>
    <div style="padding:16px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;">
      <button id="btn-cancel-heats" class="btn-ghost-custom" style="padding:8px 16px;">Cancelar</button>
      <button id="btn-save-heats" class="btn-primary-custom" style="padding:8px 20px;background:#0056b3;color:#ffffff;border-radius:8px;font-weight:bold;">Guardar Nuevo Orden</button>
    </div>`;

  const renderList = () => {
    const scrollBody = modalBox.querySelector('#modal-scroll-body');
    if (!scrollBody) return;
    const savedScrollTop = scrollBody.scrollTop;
    workingParticipants.sort((a, b) => {
      const tA = (seriesNum === 1 ? a.tanda : a.tandaS2) ?? 999;
      const tB = (seriesNum === 1 ? b.tanda : b.tandaS2) ?? 999;
      if (tA !== tB) return tA - tB;
      return ((seriesNum === 1 ? a.spot : a.spotS2) ?? 999) - ((seriesNum === 1 ? b.spot : b.spotS2) ?? 999);
    });
    const heatsMap = new Map();
    workingParticipants.forEach(p => {
      const t = (seriesNum === 1 ? p.tanda : p.tandaS2) || 0;
      if (!heatsMap.has(t)) heatsMap.set(t, []);
      heatsMap.get(t).push(p);
    });
    const sortedTandas = Array.from(heatsMap.keys()).sort((a, b) => a - b);
    scrollBody.innerHTML = sortedTandas.map(tandaNum => {
      const group = heatsMap.get(tandaNum);
      const title = tandaNum === 0 ? '⚠️ Sin Tanda' : `Tanda ${tandaNum}`;
      return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:14px;">
        <div style="font-size:0.95rem;font-weight:800;color:#0056b3;font-family:'Orbitron',sans-serif;margin-bottom:10px;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
          <span>${title}</span><span style="font-size:0.78rem;color:#64748b;">${group.length} Tiradores</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">${group.map((p, gIdx) => {
          const pSpot = seriesNum === 1 ? p.spot : p.spotS2;
          const pTanda = seriesNum === 1 ? p.tanda : p.tandaS2;
          return `<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;gap:12px;">
            <div style="min-width:0;flex:1;">
              <span style="font-weight:800;color:#0f172a;font-size:0.9rem;">#${p.competitorNumber} — ${esc(p.name)}</span>
              <span style="font-size:0.75rem;color:#64748b;font-weight:600;display:block;margin-top:2px;">${esc(p.category||'General')} · Mesa ${pSpot||'—'}</span>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              <div style="display:flex;gap:4px;align-items:center;">
                <span style="font-size:0.75rem;font-weight:700;color:#475569;">Tanda:</span>
                <select data-move-p="${p.id}" style="padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;background:#fff;font-weight:bold;color:#0056b3;">
                  ${Array.from({length:8},(_,i)=>i+1).map(n=>`<option value="${n}"${pTanda===n?' selected':''}>${n}</option>`).join('')}
                </select>
              </div>
              <div style="display:flex;gap:4px;align-items:center;">
                <span style="font-size:0.75rem;font-weight:700;color:#475569;margin-left:4px;">Mesa:</span>
                <button class="btn-arrow-up" data-p-id="${p.id}" data-tanda="${tandaNum}" data-spot="${pSpot}" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;width:30px;height:30px;cursor:pointer;font-weight:bold;font-size:0.85rem;" ${gIdx===0||!pSpot?'disabled':''}>▲</button>
                <button class="btn-arrow-down" data-p-id="${p.id}" data-tanda="${tandaNum}" data-spot="${pSpot}" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;width:30px;height:30px;cursor:pointer;font-weight:bold;font-size:0.85rem;" ${gIdx===group.length-1||!pSpot?'disabled':''}>▼</button>
              </div>
            </div>
          </div>`;
        }).join('')}</div></div>`;
    }).join('');
    scrollBody.scrollTop = savedScrollTop;

    scrollBody.querySelectorAll('[data-move-p]').forEach(select => {
      select.addEventListener('change', e => {
        const pId = Number((e.currentTarget as HTMLSelectElement).dataset.moveP);
        const newTanda = Number((e.currentTarget as HTMLSelectElement).value);
        const target = workingParticipants.find(p => p.id === pId);
        if (!target) return;
        const occupied = new Set();
        workingParticipants.forEach(p => { if (p.id !== pId && (seriesNum===1?p.tanda:p.tandaS2)===newTanda) { const s=seriesNum===1?p.spot:p.spotS2; if(s) occupied.add(s); } });
        let nextSpot = 1;
        for (let s=1; s<=4; s++) { if (!occupied.has(s)) { nextSpot=s; break; } }
        if (seriesNum===1) { target.tanda=newTanda; target.spot=nextSpot as 1|2|3|4; } else { target.tandaS2=newTanda; target.spotS2=nextSpot as 1|2|3|4; }
        renderList();
      });
    });
    scrollBody.querySelectorAll('.btn-arrow-up').forEach(btn => {
      btn.addEventListener('click', e => {
        const pId = Number((e.currentTarget as HTMLButtonElement).dataset.pId);
        const cur = workingParticipants.find(p => p.id===pId);
        if (!cur) return;
        const ct = seriesNum===1?cur.tanda:cur.tandaS2, cs=seriesNum===1?cur.spot:cur.spotS2;
        if (!cs||cs===1) return;
        const prev = workingParticipants.find(p=>(seriesNum===1?p.tanda:p.tandaS2)===ct&&Number(seriesNum===1?p.spot:p.spotS2)===cs-1);
        if (seriesNum===1){cur.spot=(cs-1) as 1|2|3|4;if(prev)prev.spot=cs as 1|2|3|4;}else{cur.spotS2=(cs-1) as 1|2|3|4;if(prev)prev.spotS2=cs as 1|2|3|4;}
        renderList();
      });
    });
    scrollBody.querySelectorAll('.btn-arrow-down').forEach(btn => {
      btn.addEventListener('click', e => {
        const pId = Number((e.currentTarget as HTMLButtonElement).dataset.pId);
        const cur = workingParticipants.find(p => p.id===pId);
        if (!cur) return;
        const ct = seriesNum===1?cur.tanda:cur.tandaS2, cs=seriesNum===1?cur.spot:cur.spotS2;
        if (!cs||cs===4) return;
        const nxt = workingParticipants.find(p=>(seriesNum===1?p.tanda:p.tandaS2)===ct&&Number(seriesNum===1?p.spot:p.spotS2)===cs+1);
        if (seriesNum===1){cur.spot=(cs+1) as 1|2|3|4;if(nxt)nxt.spot=cs as 1|2|3|4;}else{cur.spotS2=(cs+1) as 1|2|3|4;if(nxt)nxt.spotS2=cs as 1|2|3|4;}
        renderList();
      });
    });
  };

  const closeModal = () => { backdrop.classList.remove('is-open'); backdrop.classList.add('is-closing'); setTimeout(() => backdrop.remove(), 150); };
  modalBox.querySelector('#close-heats-modal')?.addEventListener('click', closeModal);
  modalBox.querySelector('#btn-cancel-heats')?.addEventListener('click', closeModal);

  modalBox.querySelector('#btn-save-heats')?.addEventListener('click', async () => {
    let vp = [...workingParticipants];
    if (seriesNum === 1) {
      vp = applySpecialFamilySeedingRules(vp);
      vp = applySharedRifleRules(vp);
      const groups: Record<number, typeof vp> = {};
      for (const p of vp) { if (p.tanda) { if (!groups[p.tanda]) groups[p.tanda]=[]; groups[p.tanda].push(p); } }
      for (const tStr in groups) {
        const t = Number(tStr), group = groups[t];
        group.forEach(p => { p.tandaS2 = t; });
        const as2 = new Set(), us2: typeof vp = [];
        group.forEach(p => { const ts=p.spotS2; if(ts&&ts>=1&&ts<=4&&!as2.has(ts)){as2.add(ts);p.spotS2=ts;}else{us2.push(p);} });
        const avail=[1,2,3,4].filter(s=>!as2.has(s));
        for(let i=avail.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[avail[i],avail[j]]=[avail[j],avail[i]];}
        us2.forEach((p,i)=>{p.spotS2=avail[i] as 1|2|3|4;});
      }
    }
    for (const p of vp) {
      if (p.tanda===undefined||p.tanda===null) p.spot=undefined;
      if (p.tandaS2===undefined||p.tandaS2===null) p.spotS2=undefined;
      p.sector=undefined; await db.participants.put(p);
    }
    showToast('Orden de tandas y mesas actualizado con éxito.', 'success');
    closeModal(); if (onSaveCallback) onSaveCallback();
  });

  backdrop.appendChild(modalBox); document.body.appendChild(backdrop);
  void backdrop.offsetWidth; backdrop.classList.add('is-open'); renderList();
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

