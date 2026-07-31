/**
 * printBlackjack.ts
 * Módulo de impresión específico para la modalidad 21 Blackjack Challenge (.22 LR 200m).
 * Diseñado para encajar en EXACTAMENTE 1 HOJA A4 Landscape por planilla o tarjeta.
 */

import type { ShootingEvent, Participant, Series } from './types';
import { calculateSeriesTotalBJ, BJ_SHOTS_PER_SERIES } from './scoringBlackjack';
import { esc } from './modals';
import { openPrintModal } from './printModal';

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

/**
 * Genera la Planilla de Campo Consolidada de 21 Blackjack Challenge en EXACTAMENTE 1 HOJA.
 */
export function printBlackjackScoreSheet(
  event: ShootingEvent,
  participants: Participant[],
  seriesList: Series[]
): void {
  const rowsHtml = participants.map((p, idx) => {
    const pSeries = seriesList.find(s => s.participantId === p.id);
    const shots = pSeries?.shots || [];
    const total = pSeries ? calculateSeriesTotalBJ(shots) : 0;

    const cells = Array.from({ length: BJ_SHOTS_PER_SERIES }, (_, i) => {
      const s = shots[i];
      if (!s) return `<td style="border:1px solid #cbd5e1;text-align:center;padding:2px;font-size:0.72rem;color:#cbd5e1;">-</td>`;
      const valStr = s.hit ? `+${s.value}` : '0';
      const color = s.hit ? '#15803d' : '#b91c1c';
      const bg = s.hit ? '#f0fdf4' : '#fef2f2';
      return `<td style="border:1px solid #cbd5e1;text-align:center;padding:2px;font-size:0.75rem;font-weight:700;color:${color};background:${bg};font-family:monospace;">${valStr}</td>`;
    }).join('');

    return `
      <tr style="height:22px;">
        <td style="border:1px solid #cbd5e1;text-align:center;padding:2px;font-size:0.75rem;font-weight:700;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:2px 6px;font-size:0.75rem;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${esc(p.name)}</td>
        <td style="border:1px solid #cbd5e1;text-align:center;padding:2px;font-size:0.72rem;font-weight:600;color:#64748b;">${p.tanda ? 'T' + p.tanda : '—'}</td>
        ${cells}
        <td style="border:1px solid #cbd5e1;text-align:center;padding:2px;font-size:0.85rem;font-weight:900;color:#7c3aed;font-family:monospace;background:#f3e8ff;">${total}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>21 Blackjack Challenge - Planilla Oficial</title>
        <style>
          @page { size: A4 landscape; margin: 6mm; }
          *, *::before, *::after { box-sizing: border-box !important; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: #0f172a; padding: 4px; }
          .page-container { width: 100%; max-height: 185mm; overflow: hidden; page-break-inside: avoid; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c3aed; padding-bottom: 4px; margin-bottom: 6px; }
          .title { font-size: 1.1rem; font-weight: 900; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.04em; }
          .subtitle { font-size: 0.72rem; color: #475569; font-weight: 700; margin-top: 2px; }
          .meta-info { font-size: 0.75rem; color: #334155; font-weight: 600; text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; table-layout: fixed; }
          th { background: #f3e8ff; color: #6b21a8; border: 1px solid #cbd5e1; padding: 4px 2px; font-size: 0.68rem; text-transform: uppercase; font-weight: 900; text-align: center; }
          @media print {
            body { background: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page-container { width: 100% !important; max-height: 100vh !important; }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="header">
            <div>
              <div class="title">21 BLACKJACK CHALLENGE (.22 LR - 200M)</div>
              <div class="subtitle">PLANILLA OFICIAL DE PUNTUACIÓN Y REGISTRO DE SERIE ÚNICA</div>
            </div>
            <div class="meta-info">
              <div><strong>Evento:</strong> ${esc(event.name)}</div>
              <div><strong>Fecha:</strong> ${formatDate(event.date)} | <strong>Lugar:</strong> ${esc(event.location || 'CPTP')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:26px;">#</th>
                <th style="width:160px;text-align:left;padding-left:6px;">Tirador</th>
                <th style="width:40px;">Turno</th>
                ${Array.from({ length: 12 }, (_, i) => `<th>D${i + 1}</th>`).join('')}
                <th style="width:55px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="16" style="text-align:center;padding:12px;font-size:0.8rem;color:#64748b;">Sin tiradores inscritos</td></tr>`}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;

  openPrintModal(htmlContent, 'Planilla 21 Blackjack Challenge');
}
