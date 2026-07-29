/**
 * EventSeriesView.ts
 * Tab "Series" del detalle de evento: lista de series por tirador, nueva serie, limpiar.
 */

import type { Participant, Series, Modality } from '../../types';
import { esc, showToast, showConfirm } from '../../modals';
import { navigate } from '../../router';
import { db } from '../../db';
import { getModalityConfig } from '../../modalityConfig';

export function renderListaSeries(
  containerId: string,
  participants: Participant[],
  allSeries: Series[],
  eventId: number,
  maxSeriesPerEvent: number,
  isCF: boolean,
  onRefresh: () => Promise<void>
): void {
  const containerEl = document.getElementById(containerId);
  if (!containerEl) return;

  const validParticipants = participants.filter(p =>
    p.tanda !== undefined || allSeries.some(s => s.participantId === p.id)
  ).sort((a, b) => {
    const tA = a.tanda ?? 999; const tB = b.tanda ?? 999;
    if (tA !== tB) return tA - tB;
    const sA = a.spot ?? 999; const sB = b.spot ?? 999;
    if (sA !== sB) return sA - sB;
    return a.competitorNumber - b.competitorNumber;
  });

  if (validParticipants.length === 0) {
    containerEl.innerHTML = `<div style="text-align:center;padding:24px;font-size:0.82rem;color:#475569;">Debe realizar el sorteo de tandas primero para poder cargar puntuaciones.</div>`;
    return;
  }

  containerEl.innerHTML = validParticipants.map((p) => {
    const pSeries = allSeries.filter(s => s.participantId === p.id);
    const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);

    const seriesCards = pSeries.length > 0
      ? pSeries.map(s => {
          const maxShots = isCF ? 12 : 10;
          const maxScore = isCF ? (s.bonusActive ? 96 : 87) : 67;
          const shotDots = Array.from({ length: maxShots }, (_, i) => {
            const sh = s.shots[i];
            if (!sh) return `<span class="shot-dot" style="background:#e2e8f0;color:#94a3b8;">·</span>`;
            return `<span class="shot-dot ${sh.hit ? 'hit' : 'miss'}">${sh.hit ? 'O' : 'X'}</span>`;
          }).join('');
          return `<div class="series-card" data-series-id="${s.id}" role="button" tabindex="0" style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;margin-top:6px;border-radius:10px;">
           <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div style="flex:1;min-width:0;">
             <div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;font-weight:700;color:#64748b;margin-bottom:6px;">SERIE ${s.seriesNumber}</div>
             <div style="display:flex;gap:3px;flex-wrap:wrap;">${shotDots}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
             <div style="font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:700;color:#d97706;">${s.totalScore}</div>
             <div style="font-size:0.6rem;color:#475569;">/ ${maxScore} pts</div>
            </div>
           </div>
          </div>`;
        }).join('')
      : `<div style="font-size:0.75rem;color:#475569;margin-top:4px;">Sin series registradas</div>`;

    return `<div id="tirador-block-${p.id}" class="card-tactical" style="padding:14px;border-color:#e2e8f0;">
     <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:1px solid #f1f5f9;padding-bottom:10px;margin-bottom:8px;">
      <div>
       <h4 style="margin:0;font-size:0.95rem;font-weight:700;color:#0056b3;">${esc(p.name)}</h4>
       <div style="font-size:0.7rem;color:#64748b;margin-top:2px;">
        ${isCF ? (p.tanda ? 'Turno ' + p.tanda : 'Turno no sorteado') : (p.tanda ? 'S1: Tanda ' + p.tanda + ' Mesa ' + p.spot + ' | S2: Tanda ' + (p.tandaS2 || '—') + ' Mesa ' + (p.spotS2 || '—') : 'Posicion no sorteada')}
        ${pSeries.length > 0 ? ' Acumulado: <strong style="color:#22c55e;">' + totalScore + ' pts</strong>' : ''}
       </div>
      </div>
      <div style="display:flex;gap:6px;">
       ${pSeries.length > 0 ? '<button class="btn-ghost-custom staff-only" data-clear-series-for="' + p.id + '" style="font-size:0.7rem;padding:6px 10px;border-color:rgba(239,68,68,0.25);color:#ef4444;">Vaciar</button>' : ''}
       ${pSeries.length < maxSeriesPerEvent ? '<button class="btn-primary-custom staff-only" data-add-series-for="' + p.id + '" style="font-size:0.7rem;padding:6px 10px;">+ Serie</button>' : ''}
      </div>
     </div>
     <div>${seriesCards}</div>
    </div>`;
  }).join('');

  // Bind nueva serie
  containerEl.querySelectorAll('[data-add-series-for]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.addSeriesFor);
      const p = participants.find(x => x.id === pid);
      if (!p) return;
      const existingSeries = allSeries.filter(s => s.participantId === pid);
      if (existingSeries.length >= maxSeriesPerEvent) {
        showToast('Limite alcanzado: Maximo ' + maxSeriesPerEvent + ' serie(s) por participante.', 'error');
        return;
      }
      const nextNum = existingSeries.length > 0 ? Math.max(...existingSeries.map(s => s.seriesNumber)) + 1 : 1;
      try {
        const seriesId = await db.series.add({
          eventId, participantId: pid, seriesNumber: nextNum, shots: [], totalScore: 0, createdAt: Date.now()
        });
        navigate('/series/' + seriesId);
      } catch (err) {
        console.error('[DB] Error creando serie:', err);
        showToast('Error al crear la serie.', 'error');
      }
    });
  });

  // Bind limpiar series por tirador
  containerEl.querySelectorAll('[data-clear-series-for]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pid = Number((e.currentTarget as HTMLElement).dataset.clearSeriesFor);
      const p = participants.find(x => x.id === pid);
      if (!p) return;
      if (!await showConfirm('Vaciar Series', 'Eliminar TODAS las series de ' + esc(p.name) + '?')) return;
      await db.series.where('participantId').equals(pid).delete();
      await onRefresh();
      showToast('Series de ' + esc(p.name) + ' eliminadas.', 'info');
    });
  });

  // Bind click en series para ir al score
  containerEl.querySelectorAll('[data-series-id]').forEach(card => {
    card.addEventListener('click', () => {
      navigate('/series/' + (card as HTMLElement).dataset.seriesId);
    });
  });
}
