/**
 * printBlackjack.ts
 * Módulo de impresión y exportación específico para la modalidad 21 Blackjack Challenge (.22 LR 200m).
 * Mantiene la separación de responsabilidades en archivos independientes sin crear monolitos.
 */

import type { ShootingEvent, Participant, Series } from './types';
import { calculateSeriesTotalBJ, BJ_SHOTS_PER_SERIES } from './scoringBlackjack';

/**
 * Genera la vista previa o planilla imprimible de 21 Blackjack Challenge.
 */
export function printBlackjackScoreSheet(
  event: ShootingEvent,
  participants: Participant[],
  seriesList: Series[]
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const rowsHtml = participants.map((p, idx) => {
    const pSeries = seriesList.find(s => s.participantId === p.id);
    const shots = pSeries?.shots || [];
    const total = pSeries ? calculateSeriesTotalBJ(shots) : 0;

    const cells = Array.from({ length: BJ_SHOTS_PER_SERIES }, (_, i) => {
      const s = shots[i];
      if (!s) return `<td style="border:1px solid #cbd5e1;text-align:center;padding:6px;font-size:0.8rem;color:#cbd5e1;">-</td>`;
      const valStr = s.hit ? `+${s.value}` : '0';
      const color = s.hit ? '#15803d' : '#b91c1c';
      const bg = s.hit ? '#f0fdf4' : '#fef2f2';
      return `<td style="border:1px solid #cbd5e1;text-align:center;padding:6px;font-size:0.85rem;font-weight:700;color:${color};background:${bg};font-family:monospace;">${valStr}</td>`;
    }).join('');

    return `
      <tr>
        <td style="border:1px solid #cbd5e1;text-align:center;padding:6px;font-size:0.85rem;font-weight:700;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;font-size:0.85rem;font-weight:700;text-transform:uppercase;">${p.name}</td>
        ${cells}
        <td style="border:1px solid #cbd5e1;text-align:center;padding:6px;font-size:1.05rem;font-weight:900;color:#7c3aed;font-family:monospace;">${total}</td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>21 Blackjack Challenge - Planilla de Campo</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #0f172a; }
          h2 { text-transform: uppercase; color: #7c3aed; margin-bottom: 4px; }
          .header-info { font-size: 0.9rem; color: #475569; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f3e8ff; color: #6b21a8; border: 1px solid #cbd5e1; padding: 8px; font-size: 0.75rem; text-transform: uppercase; }
          @media print {
            @page { size: landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <h2>21 BLACKJACK CHALLENGE (.22 LR - 200M)</h2>
        <div class="header-info">
          <strong>Evento:</strong> ${event.name} | <strong>Fecha:</strong> ${event.date} | <strong>Lugar:</strong> ${event.location || 'CPTP'}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Tirador</th>
              ${Array.from({ length: 12 }, (_, i) => `<th>D${i + 1}</th>`).join('')}
              <th style="width:70px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
