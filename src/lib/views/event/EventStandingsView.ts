/**
 * EventStandingsView.ts
 * Tab "Posiciones" del detalle de evento: tabla de posiciones, premios especiales.
 */

import type { Participant, Series, ShootingEvent } from '../../types';
import { esc } from '../../modals';
import { sortRanking } from '../../tiebreaker';
import { printRankingCard } from '../../printRankingCard';
import { printBlankSheet } from '../../printScoreSheet';
import { printCFBlankSheet } from '../../printCF';

export function renderPosicionesTab(
  containerId: string,
  event: ShootingEvent,
  participants: Participant[],
  allSeries: Series[],
  maxSeriesPerEvent: number,
  isCF: boolean
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (participants.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:#64748b;font-size:0.85rem;">No hay competidores inscritos.</div>`;
    return;
  }

  const getRanking = (seriesNum: number | null) => {
    const data = participants.map(p => {
      let score = 0;
      if (seriesNum === null) {
        const pSeries = allSeries.filter(s => s.participantId === p.id);
        score = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
      } else {
        const s = allSeries.find(s => s.participantId === p.id && s.seriesNumber === seriesNum);
        if (s) score = s.totalScore;
      }
      return { participant: p, totalScore: score };
    });
    data.sort(sortRanking);
    return data;
  };

  const rankTotal = getRanking(null);
  const rankS1 = getRanking(1);
  const rankS2 = getRanking(2);

  const buildTable = (title: string, rankings: any[]) => {
    const rowsHtml = rankings.map((r, i) => {
      const p = r.participant;
      const isTop3 = i < 3;
      const isDq = p.status === 'dq';
      const isDns = p.status === 'dns';

      let posHtml = `<span style="font-weight:700;color:#64748b;">${i + 1}</span>`;
      if (isDq) posHtml = `<span style="font-size:0.65rem;background:#fee2e2;color:#b7201c;padding:2px 4px;border-radius:4px;font-weight:700;">DQ</span>`;
      else if (isDns) posHtml = `<span style="font-size:0.65rem;background:#fef3c7;color:#d97706;padding:2px 4px;border-radius:4px;font-weight:700;">DNS</span>`;
      else if (isTop3) {
        posHtml = `<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;
                  background:${i === 0 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : i === 1 ? '#cbd5e1' : '#f59e0b'};
                  color:${i === 0 ? '#000000' : i === 1 ? '#0f172a' : '#ffffff'};">${i + 1}</span>`;
      }

      const scoreDisplay = isDq ? '<span style="color:#ef4444;font-size:0.8rem;">DQ</span>' : isDns ? '<span style="color:#f59e0b;font-size:0.8rem;">DNS</span>' : String(r.totalScore);

      return `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 8px;text-align:center;width:40px;">${posHtml}</td>
          <td style="padding:10px 8px;">
            <div style="font-weight:700;color:#0f172a;font-size:0.85rem;text-transform:uppercase;">${esc(p.name)}</div>
            <div style="font-size:0.7rem;color:#64748b;">COMPETIDOR #${p.competitorNumber} ${p.category ? '· ' + esc(p.category.split('::')[0]) : ''}</div>
          </td>
          <td style="padding:10px 8px;text-align:right;width:80px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:1.05rem;font-weight:900;color:#16a34a;">${scoreDisplay}</span>
          </td>
        </tr>`;
    }).join('');

    return `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;">
          <h4 style="margin:0;font-family:'Rajdhani',sans-serif;font-weight:700;color:#0f172a;font-size:1.1rem;text-transform:uppercase;">${title}</h4>
        </div>
        <table style="width:100%;border-collapse:collapse;"><tbody>${rowsHtml}</tbody></table>
      </div>`;
  };

  // Prize thresholds depend on modality
  const prizePerSeries = isCF ? [87, 96] : [67];
  const prizePerEvent  = isCF ? [87, 96] : [134];
  const prizeLabel     = isCF ? '87 / 96' : '67 / 134';

  const perfectScores = participants.map(p => {
    const pSeries = allSeries.filter(s => s.participantId === p.id);
    const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
    const s1 = pSeries.find(s => s.seriesNumber === 1)?.totalScore || 0;
    const s2 = pSeries.find(s => s.seriesNumber === 2)?.totalScore || 0;
    return { p, s1, s2, totalScore };
  }).filter(x => {
    if (x.p.status === 'dq' || x.p.status === 'dns') return false;
    return prizePerSeries.some(v => x.s1 === v || x.s2 === v) || prizePerEvent.some(v => x.totalScore === v);
  });

  perfectScores.sort((a, b) => b.totalScore - a.totalScore);

  let perfectRowsHtml = perfectScores.map(r => {
    let reason: string[] = [];
    for (const v of prizePerSeries) {
      if (r.s1 === v) reason.push(`S1: ${v} pts`);
      if (r.s2 === v) reason.push(`S2: ${v} pts`);
    }
    for (const v of prizePerEvent) {
      if (r.totalScore === v) { reason = [`Evento Perfecto (${v})`]; break; }
    }
    const p = r.p;
    return `<tr style="border-bottom:1px solid #fef3c7;background:#fffbeb;">
        <td style="padding:10px 8px;text-align:center;width:40px;"><span style="color:#d97706;font-size:1.1rem;">&#9733;</span></td>
        <td style="padding:10px 8px;">
          <div style="font-weight:700;color:#0f172a;font-size:0.85rem;text-transform:uppercase;">${esc(p.name)}</div>
        </td>
        <td style="padding:10px 8px;text-align:right;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;font-weight:900;color:#d97706;">${reason.join(' / ')}</span>
        </td>
      </tr>`;
  }).join('');

  if (perfectRowsHtml === '') {
    perfectRowsHtml = `<tr><td colspan="3" style="padding:20px;text-align:center;color:#94a3b8;font-size:0.8rem;">Ningun tirador alcanzo puntaje premiado (${prizeLabel}).</td></tr>`;
  }

  const perfectTable = `<div style="background:#ffffff;border:1px solid #fde68a;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(245,158,11,0.1);">
      <div style="background:#fef3c7;padding:12px 16px;border-bottom:1px solid #fde68a;display:flex;align-items:center;gap:8px;">
        <h4 style="margin:0;font-family:'Rajdhani',sans-serif;font-weight:700;color:#b45309;font-size:1.1rem;text-transform:uppercase;">Premios Especiales (${prizeLabel})</h4>
      </div>
      <table style="width:100%;border-collapse:collapse;"><tbody>${perfectRowsHtml}</tbody></table>
    </div>`;

  container.innerHTML = `
    ${buildTable('Total del Evento', rankTotal)}
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;">
      ${maxSeriesPerEvent > 1 ? buildTable('Serie 1', rankS1) : ''}
      ${maxSeriesPerEvent > 1 ? buildTable('Serie 2', rankS2) : ''}
    </div>
    ${perfectTable}
  `;
}
