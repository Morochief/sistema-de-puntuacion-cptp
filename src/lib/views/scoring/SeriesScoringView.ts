import { esc, showToast, showConfirm } from '../../modals';
import { navigate } from '../../router';
import { db } from '../../db';
import type { ShootingEvent, Participant, Series, Shot, Modality } from '../../types';
import { printSeriesCard } from '../../print';
import { printCFSeriesCard } from '../../printCF';
import { printBlackjackSeriesCard } from '../../printBlackjack';
import {
  calculateSeriesTotal,
  calculateShotValue,
  deriveCurrentPhase,
  getTargetLabel,
  getTargetBadgeClass,
} from '../../scoring';
import {
  calculateSeriesTotalCF,
  calculateShotValueCF,
  deriveCurrentPhaseCF,
  getTargetLabelCF,
  getTargetBadgeClassCF,
} from '../../scoringCentralFire';
import {
  calculateSeriesTotalBJ,
  calculateShotValueBJ,
  deriveCurrentPhaseBJ,
  getTargetLabelBJ,
  getTargetBadgeStyleBJ,
} from '../../scoringBlackjack';
import { getModalityConfig } from '../../modalityConfig';

// ── Helpers de abstracción por modalidad ─────────────────────────────────────
function isCentralFire(m?: Modality): boolean { return m === '.308' || m === '.223'; }
function isBlackjack(m?: Modality): boolean { return m === '21 Blackjack'; }

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
  const isBJ = isBlackjack(modality);
  const mConfig = getModalityConfig(modality);
  const maxShots = mConfig.shotsPerSeries;
  const maxScore = mConfig.maxSeriesScore;
  let bonusActive = !!series.bonusActive;

  let currentShots: Shot[] = [...series.shots].sort((a, b) => a.shotNumber - b.shotNumber);

  // ─ Persist ────────────────────────────────────────────────
  async function persistShots(): Promise<void> {
    const total = isBJ
      ? calculateSeriesTotalBJ(currentShots)
      : isCF
      ? calculateSeriesTotalCF(currentShots)
      : calculateSeriesTotal(currentShots);
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
      let label = '';
      let badgeStyleAttr = '';
      if (isBJ) {
        label = getTargetLabelBJ(s.targetType as any);
        badgeStyleAttr = `style="font-size:0.65rem;padding:2px 6px;border-radius:4px;${getTargetBadgeStyleBJ(s.targetType as any)}"`;
      } else if (isCF) {
        label = getTargetLabelCF(s.targetType as any);
        badgeStyleAttr = `class="${getTargetBadgeClassCF(s.targetType as any)}" style="font-size:0.65rem;"`;
      } else {
        label = getTargetLabel(s.targetType as any);
        badgeStyleAttr = `class="${getTargetBadgeClass(s.targetType as any)}" style="font-size:0.65rem;"`;
      }

      return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
            background:${s.hit ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'};
            border-left:3px solid ${s.hit ? '#22c55e' : '#ef4444'};
            border-radius:0 8px 8px 0;margin-bottom:6px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:#475569;
              min-width:22px;text-align:center;">D${s.shotNumber}</div>
        <span ${badgeStyleAttr}>${esc(label)}</span>
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
    const total = isBJ
      ? calculateSeriesTotalBJ(currentShots)
      : isCF
      ? calculateSeriesTotalCF(currentShots)
      : calculateSeriesTotal(currentShots);

    // Actualizar score header
    const scoreEl = document.getElementById('series-total-score');
    if (scoreEl) {
      scoreEl.textContent = String(total);
      scoreEl.setAttribute('aria-label', `Puntaje acumulado: ${total} de ${maxScore}`);
    }

    if (isComplete) {
      panel.innerHTML = `
        <div style="background:#ffffff;border-radius:11px;text-align:center;padding:28px 16px;">
          <div style="font-size:3rem;margin-bottom:10px;">🎯</div>
          <div style="font-family:'Rajdhani',sans-serif;font-size:1.3rem;font-weight:700;
                color:#0f172a;margin-bottom:6px;">Serie completa</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:2.5rem;font-weight:700;
                background:linear-gradient(135deg,#7c3aed,#a855f7);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                margin-bottom:16px;">${total} pts</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button class="btn-ghost-custom" id="btn-undo-last" style="font-size:0.8rem;padding:8px 16px;">
               Deshacer último
            </button>
            <button class="btn-primary-custom" id="btn-done" style="font-size:0.85rem;padding:8px 20px;background:#7c3aed;color:#ffffff;border:none;">
              Volver al evento ➔
            </button>
          </div>
        </div>`;

      document.getElementById('btn-undo-last')?.addEventListener('click', undoLastShot);
      document.getElementById('btn-done')?.addEventListener('click', () => navigate(`/event/${series!.eventId}`));
      return;
    }

    // Determinación de fase y valor si acierta
    let phaseLabel = '';
    let valueIfHit = 0;
    let badgeStyleAttr = '';

    if (isBJ) {
      const phase = deriveCurrentPhaseBJ(currentShots);
      phaseLabel = getTargetLabelBJ(phase);
      valueIfHit = calculateShotValueBJ(phase, true);
      badgeStyleAttr = `style="font-size:0.75rem;padding:4px 8px;border-radius:6px;${getTargetBadgeStyleBJ(phase)}"`;
    } else if (isCF) {
      const phase = deriveCurrentPhaseCF(currentShots);
      phaseLabel = getTargetLabelCF(phase);
      valueIfHit = calculateShotValueCF(nextShotNum, phase, true, bonusActive);
      badgeStyleAttr = `class="${getTargetBadgeClassCF(phase)}" style="font-size:0.75rem;"`;
    } else {
      const phase = deriveCurrentPhase(currentShots);
      phaseLabel = getTargetLabel(phase);
      valueIfHit = calculateShotValue(nextShotNum, phase, true);
      badgeStyleAttr = `class="${getTargetBadgeClass(phase)}" style="font-size:0.75rem;"`;
    }

    panel.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#ffffff;padding:12px 14px;border-radius:10px;border:1px solid #cbd5e1;">
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase;">Disparo Actual:</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:1.1rem;font-weight:900;color:#0f172a;">#${nextShotNum} de ${maxShots}</div>
          </div>
          <div>
            <span ${badgeStyleAttr}>${esc(phaseLabel)}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <button id="btn-hit" style="padding:18px 12px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;border:none;border-radius:12px;font-family:'Rajdhani',sans-serif;font-size:1.15rem;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(34,197,94,0.25);text-transform:uppercase;" title="Registrar Acierto (+${valueIfHit} pts)">
            🎯 ACIERTO (+${valueIfHit} pts)
          </button>
          
          <button id="btn-miss" style="padding:18px 12px;background:#ffffff;color:#ef4444;border:2px solid #ef4444;border-radius:12px;font-family:'Rajdhani',sans-serif;font-size:1.15rem;font-weight:900;cursor:pointer;text-transform:uppercase;" title="Registrar Fallo (0 pts)">
            ❌ FALLO (0 pts)
          </button>
        </div>

        <button id="btn-undo-action" class="btn-ghost-custom" style="width:100%;padding:11px 14px;background:#ffffff;border:1.5px solid #cbd5e1;color:${currentShots.length > 0 ? '#b7201c' : '#94a3b8'};border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:0.95rem;font-weight:800;cursor:${currentShots.length > 0 ? 'pointer' : 'not-allowed'};display:flex;align-items:center;justify-content:center;gap:6px;" ${currentShots.length === 0 ? 'disabled' : ''} title="Deshacer el último disparo cargado">
          ↩ Deshacer Último Disparo
        </button>
      </div>
    `;

    document.getElementById('btn-hit')?.addEventListener('click', () => registerShot(true));
    document.getElementById('btn-miss')?.addEventListener('click', () => registerShot(false));
    document.getElementById('btn-undo-action')?.addEventListener('click', undoLastShot);
  }

  // ─ Registrar Disparo ──────────────────────────────────────
  async function registerShot(hit: boolean): Promise<void> {
    const nextShotNum = currentShots.length + 1;
    if (nextShotNum > maxShots) return;

    let value = 0;
    let phaseType: any = '15"';

    if (isBJ) {
      const phase = deriveCurrentPhaseBJ(currentShots);
      phaseType = phase;
      value = calculateShotValueBJ(phase, hit);
    } else if (isCF) {
      const phase = deriveCurrentPhaseCF(currentShots);
      phaseType = phase;
      value = calculateShotValueCF(nextShotNum, phase, hit, bonusActive);
    } else {
      const phase = deriveCurrentPhase(currentShots);
      phaseType = phase;
      value = calculateShotValue(nextShotNum, phase, hit);
    }

    currentShots.push({
      shotNumber: nextShotNum,
      targetType: phaseType,
      hit,
      value,
    });

    await persistShots();
    renderProgressBar();
    renderHistory();
    renderActionPanel();
  }

  // ─ Deshacer Disparo ──────────────────────────────────────
  async function undoLastShot(): Promise<void> {
    if (currentShots.length === 0) return;
    currentShots.pop();
    await persistShots();
    renderProgressBar();
    renderHistory();
    renderActionPanel();
  }

  // ── Render Estructura Base de la Vista ────────────────────
  const totalScore = isBJ
    ? calculateSeriesTotalBJ(currentShots)
    : isCF
    ? calculateSeriesTotalCF(currentShots)
    : calculateSeriesTotal(currentShots);

  container.innerHTML = `
    <div style="max-width:600px;margin:0 auto;padding:16px;">
      <!-- Top Bar Navigation -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:8px;flex-wrap:wrap;">
        <button id="btn-nav-back" class="btn-ghost-custom" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#ffffff;border:1px solid #cbd5e1;color:#0056b3;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:0.85rem;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);cursor:pointer;" title="Volver a la vista del evento">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Volver al Evento
        </button>

        <div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;font-weight:800;color:${mConfig.color};text-transform:uppercase;letter-spacing:0.04em;background:${mConfig.bgColor};padding:4px 12px;border-radius:6px;border:1px solid ${mConfig.color}33;">
          ${mConfig.seriesPerEvent === 1 ? mConfig.shortLabel : `${mConfig.shortLabel} · Serie #${series.seriesNumber}`}
        </div>

        <button id="btn-print-series" class="btn-ghost-custom" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#ffffff;border:1px solid #cbd5e1;color:#0f172a;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:0.85rem;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);cursor:pointer;" title="Imprimir ticket o planilla de serie">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Imprimir Ticket
        </button>
      </div>

      <!-- Competitor Info Card -->
      <div style="background:#ffffff;border:1.5px solid #cbd5e1;border-radius:14px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.03);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:'Rajdhani',sans-serif;font-size:1.2rem;font-weight:900;color:#0f172a;text-transform:uppercase;">
            ${esc(participant.name)}
          </div>
          <div style="font-size:0.75rem;color:#64748b;font-weight:600;margin-top:2px;">
            COMPETIDOR #${participant.competitorNumber} ${participant.category ? '· ' + esc(participant.category) : ''}
          </div>
        </div>

        <div style="text-align:right;">
          <div style="font-size:0.65rem;font-weight:700;color:#64748b;text-transform:uppercase;">Puntaje Serie:</div>
          <div id="series-total-score" style="font-family:'JetBrains Mono',monospace;font-size:1.8rem;font-weight:900;color:${mConfig.color};">
            ${totalScore}
          </div>
        </div>
      </div>

      <!-- Progress Bar (Pips) -->
      <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:0.75rem;font-weight:700;color:#475569;text-transform:uppercase;">Progreso de Disparos:</span>
          <span id="shots-count" style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;font-weight:700;color:#64748b;">
            ${currentShots.length}/${maxShots}
          </span>
        </div>
        <div id="shots-progress-bar" style="display:grid;grid-template-columns:repeat(${maxShots}, 1fr);gap:4px;"></div>
      </div>

      <!-- Panel de Acción (Botones Hit/Miss) -->
      <div id="action-panel" style="margin-bottom:20px;"></div>

      <!-- Historial de Disparos -->
      <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <div style="font-family:'Rajdhani',sans-serif;font-size:0.9rem;font-weight:800;color:#0f172a;text-transform:uppercase;margin-bottom:10px;">
          Historial de Disparos
        </div>
        <div id="shots-history"></div>
      </div>
    </div>
  `;

  // Bind top bar events
  document.getElementById('btn-nav-back')?.addEventListener('click', () => navigate(`/event/${series!.eventId}`));
  document.getElementById('btn-print-series')?.addEventListener('click', () => {
    if (isBJ) {
      printBlackjackSeriesCard(event!, participant!, series!);
    } else if (isCF || mConfig.seriesPerEvent === 1) {
      printCFSeriesCard(event!, participant!, series!, currentShots);
    } else {
      printSeriesCard(event!, participant!, series!, currentShots);
    }
  });

  // Render sub-components
  renderProgressBar();
  renderHistory();
  renderActionPanel();
}
