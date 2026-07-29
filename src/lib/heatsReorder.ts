/**
 * heatsReorder.ts
 * Modal de reorden manual de tandas/turnos y reseteo de sorteo.
 */

import { db } from './db';
import type { Participant } from './types';
import { esc, showToast, showConfirm } from './modals';
import { applySpecialFamilySeedingRules, applySharedRifleRules } from './heatsRules';

/**
 * Deshacer/limpiar el sorteo de tandas de todos los competidores de un evento.
 */
export async function resetEventSeeding(eventId: number, onSaveCallback: () => void): Promise<void> {
  if (!await showConfirm('Deshacer Sorteo', 'Confirma deshacer y limpiar el sorteo de tandas de todos los competidores de este evento? Podra sortear nuevamente o asignar de forma manual.')) {
    return;
  }

  const participants = await db.participants.where('eventId').equals(eventId).filter((item: any) => !item.is_deleted).toArray();
  for (const p of participants) {
    await db.participants.update(p.id!, {
      tanda: undefined, sector: undefined, spot: undefined,
      tandaS2: undefined, spotS2: undefined
    });
  }

  showToast('Sorteo deshecho con exito. Mesas y tandas limpiadas.', 'info');
  onSaveCallback();
}

/**
 * Modal tactico para cambiar el orden de las tandas y mesas manualmente.
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

  // CF: flat sequential list
  if (isCF) {
    const sorted = [...workingParticipants].sort((a, b) => (a.tanda ?? 9999) - (b.tanda ?? 9999));

    modalBox.innerHTML = `
      <div style="padding:14px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2 style="font-family:'Orbitron',sans-serif;font-size:1.05rem;font-weight:900;color:#0056b3;margin:0;">Reordenar Turnos</h2>
          <span style="font-size:0.73rem;color:#64748b;font-weight:600;">Usa ▲ y ▼ para cambiar el orden de tiro</span>
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

  // .22 LR: original tanda/mesa modal
  modalBox.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h2 style="font-family:'Orbitron',sans-serif;font-size:1.15rem;font-weight:900;color:#0056b3;margin:0;">Reordenar Serie ${seriesNum}</h2>
        <span style="font-size:0.75rem;color:#64748b;font-weight:600;">Elegi la Tanda con la lista y cambia de Mesa (1-4) usando ▲ y ▼</span>
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
    showToast('Orden de tandas y mesas actualizado con exito.', 'success');
    closeModal(); if (onSaveCallback) onSaveCallback();
  });

  backdrop.appendChild(modalBox); document.body.appendChild(backdrop);
  void backdrop.offsetWidth; backdrop.classList.add('is-open'); renderList();
}
