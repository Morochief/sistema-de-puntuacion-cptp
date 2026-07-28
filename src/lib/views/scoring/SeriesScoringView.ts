import { esc, showToast, showConfirm } from '../../modals';
import { navigate } from '../../router';
import { db } from '../../db';
import type { ShootingEvent, Participant, Series, Shot, Modality } from '../../types';
import { printSeriesCard } from '../../print';
import {
 calculateSeriesTotal,
 calculateShotValue,
 deriveCurrentPhase,
 getNextPhase,
 getMaxPossibleRemaining,
 getValueIfHit,
 getTargetLabel,
 getTargetBadgeClass,
} from '../../scoring';
import {
 calculateSeriesTotalCF,
 calculateShotValueCF,
 deriveCurrentPhaseCF,
 getNextPhaseCF,
 getMaxPossibleRemainingCF,
 getValueIfHitCF,
 getTargetLabelCF,
 getTargetBadgeClassCF,
 CF_SHOTS_PER_SERIES,
} from '../../scoringCentralFire';
import { getModalityConfig } from '../../modalityConfig';

// ── Helpers de abstracción por modalidad ─────────────────────────────────────
function isCentralFire(m?: Modality): boolean { return m === '.308' || m === '.223'; }

export async function renderSeries(seriesId: string): Promise<void> {
 const container = document.getElementById('series-container');
 if (!container) return;

 const id = Number(seriesId);
 let series: Series | undefined;
 let event: ShootingEvent | undefined;
 let participant: Participant | undefined;

 try {
  series = await db.series.get(id);
  if (series) {
   event = await db.events.get(series.eventId);
   participant = await db.participants.get(series.participantId);
  }
 } catch (err) {
  console.error('[DB] Error cargando serie:', err);
  container.innerHTML = `<div class="empty-state"><div class="empty-icon"></div>
   <p class="text-sm" style="color:#ef4444;">Error al cargar la serie.</p></div>`;
  return;
 }

 if (!series || !participant) {
  container.innerHTML = `<div class="empty-state">
   <div class="empty-icon" aria-hidden="true"></div>
   <p style="color:#64748b;">Serie o competidor no encontrado.</p>
   <button class="btn-ghost-custom" id="btn-back-nf" style="margin-top:8px;">← Volver</button>
  </div>`;
  document.getElementById('btn-back-nf')?.addEventListener('click', () => navigate('/'));
  return;
 }

 // ── Detección de modalidad ───────────────────────────────────────────────
 const modality: Modality = event?.modality || '.22 LR';
 const isCF = isCentralFire(modality);
 const mConfig = getModalityConfig(modality);
 const maxShots = mConfig.shotsPerSeries;
 const maxScore = mConfig.maxSeriesScore;
 let bonusActive = !!series.bonusActive;

 let currentShots: Shot[] = [...series.shots].sort((a, b) => a.shotNumber - b.shotNumber);

 // ─ Persist ────────────────────────────────────────────────
 async function persistShots(): Promise<void> {
  const total = isCF ? calculateSeriesTotalCF(currentShots) : calculateSeriesTotal(currentShots);
  try {
   await db.series.update(id, { shots: currentShots, totalScore: total, bonusActive });
  } catch (err) {
   console.error('[DB] Error guardando:', err);
   showToast('Error al guardar. Verificá el almacenamiento.', 'error');
  }
 }

 // ─ Progress bar ───────────────────────────────────────────
 function renderProgressBar(): void {
  const bar = document.getElementById('shots-progress-bar');
  if (!bar) return;
  bar.innerHTML = Array.from({ length: maxShots }, (_, i) => {
   const s = currentShots[i];
   if (!s) {
    return `<div class="shot-pip${currentShots.length === i ? ' current' : ''}"
           aria-label="Disparo ${i+1}: pendiente"></div>`;
   }
   return `<div class="shot-pip ${s.hit ? 'hit' : 'miss'}"
          title="${s.hit ? '+'+s.value+' pts' : 'Fallo'}"
          aria-label="Disparo ${i+1}: ${s.hit ? 'acierto '+s.value+' pts' : 'fallo'}"></div>`;
  }).join('');
  const c = document.getElementById('shots-count');
  if (c) c.textContent = `${currentShots.length}/${maxShots}`;
 }

 // ─ Historial ──────────────────────────────────────────────
 function renderHistory(): void {
  const hist = document.getElementById('shots-history');
  if (!hist) return;
  if (currentShots.length === 0) {
   hist.innerHTML = `<div style="text-align:center;color:#334155;font-size:0.8rem;padding:16px 0;">
    Sin disparos registrados aún.</div>`;
   return;
  }
  hist.innerHTML = [...currentShots].map((s) => {
   const label = isCF ? getTargetLabelCF(s.targetType as any) : getTargetLabel(s.targetType as any);
   const badgeCls = isCF ? getTargetBadgeClassCF(s.targetType as any) : getTargetBadgeClass(s.targetType as any);
   return `
   <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
         background:${s.hit ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'};
         border-left:3px solid ${s.hit ? '#22c55e' : '#ef4444'};
         border-radius:0 8px 8px 0;margin-bottom:6px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:#475569;
          min-width:22px;text-align:center;">D${s.shotNumber}</div>
    <span class="${badgeCls}" style="font-size:0.65rem;">${label}</span>
    <div style="flex:1;font-weight:900;font-size:1rem;color:${s.hit ? '#22c55e' : '#ef4444'}">
     ${s.hit ? 'O' : 'X'}
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-weight:700;
          color:${s.hit ? '#f59e0b' : '#475569'};">
     ${s.hit ? '+'+s.value : '0'} pts
    </div>
   </div>`;
  }).join('');
 }

 // ─ Panel de acción (próximo disparo) ──────────────────────
 function renderActionPanel(): void {
  const panel = document.getElementById('action-panel');
  if (!panel) return;

  const nextShotNum = currentShots.length + 1;
  const isComplete = nextShotNum > maxShots;
  const total = isCF ? calculateSeriesTotalCF(currentShots) : calculateSeriesTotal(currentShots);
  const phase = isCF ? deriveCurrentPhaseCF(currentShots) : deriveCurrentPhase(currentShots);

  // Actualizar score header
  const scoreEl = document.getElementById('series-total-score');
  if (scoreEl) {
   scoreEl.textContent = String(total);
   scoreEl.setAttribute('aria-label', `Puntaje acumulado: ${total} de ${maxScore}`);
  }

  if (isComplete) {
   panel.innerHTML = `
    <div style="background:#ffffff;border-radius:11px;text-align:center;padding:28px 16px;">
     <div style="font-size:3rem;margin-bottom:10px;"></div>
     <div style="font-family:'Rajdhani',sans-serif;font-size:1.3rem;font-weight:700;
           color:#0f172a;margin-bottom:6px;">Serie completa</div>
     <div style="font-family:'JetBrains Mono',monospace;font-size:2.5rem;font-weight:700;
           background:linear-gradient(135deg,#d97706,#f59e0b);
           -webkit-background-clip:text;-webkit-text-fill-color:transparent;
           background-clip:text;">${total} pts</div>
     <div style="font-size:0.75rem;color:#64748b;margin-top:4px;">de ${maxScore} posibles${isCF && bonusActive ? ' (con Bonus)' : ''}</div>
    </div>`;
   return;
  }

  // ── Cálculos por modalidad ──
  let hitValue: number | null;
  let maxIfHit: number;
  let maxIfMiss: number;
  let costOfMiss: number;
  let label: string;
  let badgeCls: string;

  if (isCF) {
   hitValue = getValueIfHitCF(nextShotNum, phase as any, bonusActive);
   const nextPhase = phase === 'additional' ? 'additional' : getNextPhaseCF(phase as any);
   maxIfHit = total + (hitValue ?? (bonusActive ? 2 : 1)) +
    getMaxPossibleRemainingCF(nextShotNum + 1, nextPhase as any, bonusActive);
   maxIfMiss = total + getMaxPossibleRemainingCF(nextShotNum + 1, phase as any, bonusActive);
   costOfMiss = maxIfHit - maxIfMiss;
   label = getTargetLabelCF(phase as any);
   badgeCls = getTargetBadgeClassCF(phase as any);
  } else {
   hitValue = getValueIfHit(nextShotNum, phase as any);
   const nextPhase = phase === 'additional' ? 'additional' : getNextPhase(phase as any);
   maxIfHit = total + (hitValue ?? 1) +
    getMaxPossibleRemaining(nextShotNum + 1, nextPhase as any);
   maxIfMiss = total + getMaxPossibleRemaining(nextShotNum + 1, phase as any);
   costOfMiss = maxIfHit - maxIfMiss;
   label = getTargetLabel(phase as any);
   badgeCls = getTargetBadgeClass(phase as any);
  }

  // ── Botón BONUS (solo fuego central, solo disparo 1, solo si estamos en blanco Grande) ──
  const showBonusBtn = isCF && nextShotNum === 1 && phase === 'grande';

  panel.innerHTML = `
   <div style="background:#ffffff;border-radius:11px;padding:20px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
     <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:1.7rem;font-weight:900;
            color:#0f172a;line-height:1;">Disparo ${nextShotNum}</div>
      <span class="${badgeCls}">${label}</span>
      ${bonusActive ? '<span style="font-size:0.7rem;background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:6px;font-weight:800;border:1px solid #fde68a;">⚡ BONUS x2</span>' : ''}
     </div>
     <div style="text-align:right;">
      <div style="font-size:0.62rem;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Acumulado</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.3rem;font-weight:700;color:#d97706;">
       ${total} pts
      </div>
     </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
     <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);
           border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:0.62rem;color:#64748b;text-transform:uppercase;
            letter-spacing:0.08em;margin-bottom:4px;">Si aciertás</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;
            font-weight:700;color:#22c55e;">+${hitValue ?? 1} pts</div>
     </div>
     <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);
           border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:0.62rem;color:#64748b;text-transform:uppercase;
            letter-spacing:0.08em;margin-bottom:4px;">Costo de fallar</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;
            font-weight:700;color:#ef4444;">−${costOfMiss} pts</div>
     </div>
    </div>

    <div style="text-align:center;margin-bottom:18px;font-size:0.72rem;color:#475569;">
     Máximo posible ahora: <strong style="color:#0f172a;">${maxIfHit} pts</strong>
    </div>

    ${showBonusBtn ? `
    <button class="btn-primary-custom" id="btn-do-bonus"
        style="width:100%;font-size:1.3rem;padding:18px 8px;margin-bottom:14px;
               background:linear-gradient(135deg,#d97706,#f59e0b);border:none;color:#fff;
               font-family:'Rajdhani',sans-serif;font-weight:900;border-radius:12px;
               box-shadow:0 4px 12px rgba(217,119,6,0.35);"
        aria-label="Bonus — acierto en zona especial del Blanco Grande">
     ⚡ BONUS
    </button>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
     <button class="btn-hit" id="btn-do-hit"
         style="font-size:2rem;padding:24px 8px;"
         aria-label="Acierto — disparo ${nextShotNum} en ${label} — vale ${hitValue ?? 1} puntos">
      O
     </button>
     <button class="btn-miss" id="btn-do-miss"
         style="font-size:2rem;padding:24px 8px;"
         aria-label="Fallo — disparo ${nextShotNum} en ${label} — 0 puntos">
      X
     </button>
    </div>
   </div>`;

  // ── Bind BONUS ──
  document.getElementById('btn-do-bonus')?.addEventListener('click', async () => {
   bonusActive = true;
   const sn = currentShots.length + 1;
   const val = isCF
    ? calculateShotValueCF(sn, 'grande', true, true)
    : calculateShotValue(sn, 'grande' as any, true);
   currentShots.push({ shotNumber: sn, targetType: 'grande', hit: true, value: val });
   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(`⚡ BONUS activado — +${val} pts`, 'success', 2000);
  });

  // ── Bind O (Acierto) ──
  document.getElementById('btn-do-hit')?.addEventListener('click', async () => {
   const sn = currentShots.length + 1;
   let ph: any;
   let val: number;

   if (isCF) {
    ph = deriveCurrentPhaseCF(currentShots);
    val = calculateShotValueCF(sn, ph, true, bonusActive);
   } else {
    ph = deriveCurrentPhase(currentShots);
    val = calculateShotValue(sn, ph, true);
   }
   currentShots.push({ shotNumber: sn, targetType: ph, hit: true, value: val });

   // Auto-fill adicionales tras impactar el último blanco
   const newPhase = isCF ? deriveCurrentPhaseCF(currentShots) : deriveCurrentPhase(currentShots);
   if (newPhase === 'additional') {
    const nextN = currentShots.length + 1;
    const addVal = isCF && bonusActive ? 2 : 1;
    for (let n = nextN; n <= maxShots; n++) {
     currentShots.push({ shotNumber: n, targetType: 'additional', hit: true, value: addVal });
    }
    const addCount = maxShots - sn;
    await persistShots();
    renderActionPanel();
    renderHistory();
    renderProgressBar();
    updateUndoButton();
    showToast(` ${val} pts · +${addCount} adicionales automáticos${bonusActive ? ' (x2)' : ''}`, 'success', 2500);
    return;
   }

   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(` Acierto — +${val} pts`, 'success', 1500);
  });

  // ── Bind X (Fallo) ──
  document.getElementById('btn-do-miss')?.addEventListener('click', async () => {
   const sn = currentShots.length + 1;
   const ph = isCF ? deriveCurrentPhaseCF(currentShots) : deriveCurrentPhase(currentShots);
   currentShots.push({ shotNumber: sn, targetType: ph as any, hit: false, value: 0 });
   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(` Fallo — 0 pts`, 'info', 1200);
  });
 }

 // ─ Undo button ────────────────────────────────────────────
 function updateUndoButton(): void {
  const btn = document.getElementById('btn-undo') as HTMLButtonElement | null;
  if (btn) btn.disabled = currentShots.length === 0;
 }

 // ─ HTML base ──────────────────────────────────────────────
 const total = isCF ? calculateSeriesTotalCF(currentShots) : calculateSeriesTotal(currentShots);

 container.innerHTML = `
  <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
   <button class="btn-ghost-custom" id="btn-back-series" aria-label="Volver al evento">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    Volver
   </button>
   <div style="display:flex;gap:8px;">
    <button class="btn-undo staff-only" id="btn-undo" aria-label="Deshacer último disparo" disabled>
     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" aria-hidden="true">
      <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
     </svg>
     Deshacer
    </button>
    <button class="btn-ghost-custom" id="btn-print-series" style="padding:10px 14px;"
        aria-label="Imprimir planilla de esta serie">
     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" aria-hidden="true">
      <polyline points="6,9 6,2 18,2 18,9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
     </svg>
     Planilla
    </button>
   </div>
  </div>

  <div style="margin-bottom:16px;">
   <div class="section-title" style="margin-bottom:2px;">
    ${event ? esc(event.name) : ''} · Competidor #${participant.competitorNumber}
   </div>
   <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;">
    <div>
     <h2 style="margin:0;font-family:'Rajdhani',sans-serif;font-size:1.3rem;
           font-weight:700;color:#0056b3;line-height:1.2;">
      ${esc(participant.name)}
     </h2>
      <span style="font-size:0.7rem;color:#64748b;">
       ${isCF ? `Serie ${series!.seriesNumber} ${participant.tanda ? `· Turno ${participant.tanda}` : ''}` :
       `Serie ${series!.seriesNumber} ${(() => {
         const isS2 = series!.seriesNumber === 2;
         const t = isS2 ? participant.tandaS2 : participant.tanda;
         const s = isS2 ? participant.spotS2 : participant.spot;
         return t ? `· Tanda ${t} – Mesa ${s || ''}` : '';
       })()}`}
     </span>
    </div>
    <div style="text-align:right;flex-shrink:0;">
     <div id="series-total-score"
        style="font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:700;
           background:linear-gradient(135deg,#f59e0b,#fbbf24);
           -webkit-background-clip:text;-webkit-text-fill-color:transparent;
           background-clip:text;"
        aria-live="polite" aria-label="Puntaje acumulado: ${total} de ${maxScore}">${total}</div>
     <div style="font-size:0.7rem;color:#475569;">/ ${maxScore} pts</div>
    </div>
   </div>
  </div>

  <div style="margin-bottom:18px;">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span class="section-title">Disparos</span>
    <span id="shots-count" style="font-family:'JetBrains Mono',monospace;
       font-size:0.8rem;color:#64748b;" aria-live="polite">${currentShots.length}/${maxShots}</span>
   </div>
   <div id="shots-progress-bar" class="shots-progress" role="progressbar"
      aria-valuenow="${currentShots.length}" aria-valuemin="0" aria-valuemax="${maxShots}"
      aria-label="Progreso de disparos"></div>
  </div>

  <div id="action-panel" class="shot-entry" style="margin-bottom:20px;border-color:#0056b3;padding:3px;"></div>

  <div class="section-title" style="margin-bottom:10px;">Historial</div>
  <div id="shots-history"></div>`;

 renderProgressBar();
 renderActionPanel();
 renderHistory();
 updateUndoButton();

 document.getElementById('btn-back-series')?.addEventListener('click', () => {
  navigate(`/event/${series!.eventId}`);
 });

 document.getElementById('btn-print-series')?.addEventListener('click', () => {
  if (!event) { showToast('No se puede generar la planilla sin datos del evento.', 'error'); return; }
  const sp: Series = { ...series!, shots: currentShots, totalScore: calculateSeriesTotal(currentShots) };
  printSeriesCard(event, participant!, sp);
 });

 document.getElementById('btn-undo')?.addEventListener('click', async () => {
  if (currentShots.length === 0) return;

  const lastShot = currentShots[currentShots.length - 1];

  if (lastShot.targetType === 'additional') {
   const firstAddIdx = currentShots.findIndex((s) => s.targetType === 'additional');
   const removedCount = currentShots.length - firstAddIdx;
   currentShots = currentShots.slice(0, firstAddIdx);
   if (currentShots.length === 0) bonusActive = false;
   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(`${removedCount} adicionales deshechos`, 'info', 1800);
  } else {
   const removed = currentShots[currentShots.length - 1];
   currentShots = currentShots.slice(0, -1);
   if (currentShots.length === 0) bonusActive = false;
   await persistShots();
   renderActionPanel();
   renderHistory();
   renderProgressBar();
   updateUndoButton();
   showToast(`Disparo ${removed.shotNumber} deshecho`, 'info', 1800);
  }
 });
}
