/**
 * printBlackjack.ts
 * Módulo de impresión específico para la modalidad "21 Blackjack Challenge" (.22 LR 200m).
 * Diseñado para tarjetas de SERIE ÚNICA y planillas en EXACTAMENTE 1 HOJA A4 Landscape.
 */

import type { ShootingEvent, Participant, Series, Shot } from './types';
import { calculateSeriesTotalBJ, BJ_SHOTS_PER_SERIES, BJ_TARGET_VALUES } from './scoringBlackjack';
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

function getBJPrintStyles(): string {
  return `
    @page { size: A4 landscape; margin-top: 10mm; margin-bottom: 5mm; margin-left: 5mm; margin-right: 5mm; }
    *, *::before, *::after { box-sizing: border-box !important; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: #000; padding: 0; margin: 0; }

    .a4-landscape-page {
      width: 190mm;
      min-height: 135mm;
      margin: 5mm auto;
      background: #fff;
      padding: 6px 12px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    @media print {
      body { background: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
      .a4-landscape-page {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        width: 190mm !important;
        height: 98vh !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        break-after: page !important;
      }
      .no-print { display: none !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }

    .series-column {
      width: 100% !important;
      max-width: 100% !important;
      border: 2px solid #7c3aed !important;
      border-radius: 8px !important;
      padding: 6px 12px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      background: #fff !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
    }

    .header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .logo-left { width: 50px; flex-shrink: 0; }
    .logo-left img, .logo-right img { width: 100%; height: auto; object-fit: contain; }
    .logo-right { width: 70px; flex-shrink: 0; text-align: center; }
    .header-fields { flex: 1; display: flex; flex-direction: column; gap: 3px; }

    .field-box {
      border: 1.5px solid #000; border-radius: 4px; padding: 2px 6px; position: relative;
      display: flex; flex-direction: column; justify-content: center; background: #fff;
    }
    .field-lbl { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #555; }
    .field-val { font-size: 13px; font-weight: 900; line-height: 1.1; color: #000; text-transform: uppercase; }
    .field-date { font-size: 11px; font-weight: 900; color: #000; text-align: right; }

    .meta-grid { display: flex; gap: 6px; margin: 4px 0; }
    .meta-box {
      flex: 1; border: 1.5px solid #000; border-radius: 6px; height: 36px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 2px;
    }
    .meta-box .lbl { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #000; }
    .meta-box .vl { font-size: 13px; font-weight: 900; line-height: 1.05; }

    .table-wrap { border: 1.5px solid #000; border-radius: 6px; overflow: hidden; margin-bottom: 4px; }
    table.score-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .score-table th, .score-table td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; }
    .score-table thead tr { background: #f3e8ff; height: 20px; }
    .score-table th { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #6b21a8; }

    .score-cell { height: 24px; font-size: 11px; font-weight: 700; }
    .cell-hit { background: #7c3aed !important; color: #ffffff !important; font-weight: 900 !important; }
    .cell-miss { background: #fee2e2 !important; color: #b91c1c !important; font-weight: 900 !important; }
    .cell-empty { background: #f8fafc; color: #cbd5e1; }

    .totals-row { display: flex; gap: 8px; margin-top: 4px; }
    .total-box {
      flex: 1; border: 2px solid #7c3aed; border-radius: 8px; height: 40px; background: #f3e8ff;
      display: flex; align-items: center; justify-content: space-between; padding: 0 12px;
    }
    .total-lbl { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #6b21a8; }
    .total-num { font-size: 22px; font-weight: 900; color: #7c3aed; font-family: monospace; }

    .visto-box { width: 35%; border: 1.5px solid #000; border-radius: 8px; height: 40px; padding: 3px 8px; flex-shrink: 0; }
    .visto-lbl { font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #555; }

    .rules-box {
      border: 1.5px solid #7c3aed; background: #faf5ff; border-radius: 6px; padding: 4px 8px; margin-top: 4px;
    }
    .rules-title { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #6b21a8; margin-bottom: 2px; }
    .rules-list { list-style: none; padding: 0; margin: 0; }
    .rules-list li { font-size: 8.5px; font-weight: 700; color: #4c1d95; text-transform: uppercase; margin-bottom: 1px; }
  `;
}

function getBJSeriesColumnHtml(event: ShootingEvent, participant: Participant, series: Series | undefined): string {
  const shots = series?.shots ?? [];

  const targetsList: { id: any; label: string; val: number }[] = [
    { id: '12"', label: '12" (1 pt)', val: 1 },
    { id: '10"', label: '10" (2 pts)', val: 2 },
    { id: '8"',  label: '8" (3 pts)', val: 3 },
    { id: '6"',  label: '6" (4 pts)', val: 4 },
    { id: '4"',  label: '4" (5 pts)', val: 5 },
    { id: '2"',  label: '2" (6 pts)', val: 6 },
    { id: '2" (bonus)', label: '🎯 BONUS 2" (+21 pts)', val: 21 },
  ];

  const rowsHtml = targetsList.map(t => {
    const cells = Array.from({ length: 12 }, (_, i) => {
      const s = shots[i];
      if (!s) return `<td class="score-cell cell-empty">-</td>`;
      if (s.targetType === t.id) {
        return s.hit
          ? `<td class="score-cell cell-hit">+${s.value}</td>`
          : `<td class="score-cell cell-miss">✕</td>`;
      }
      return `<td class="score-cell cell-empty">.</td>`;
    }).join('');

    return `
      <tr>
        <td style="font-size:9px;font-weight:900;text-align:left;padding-left:6px;background:#f8fafc;">${t.label}</td>
        ${cells}
      </tr>
    `;
  }).join('');

  const total = series ? calculateSeriesTotalBJ(shots) : 0;

  return `
    <div class="series-column">
      <div class="header">
        <div class="logo-left">
          <img src="/logo-cptp.svg" alt="CPTP" onerror="this.style.display='none';" />
        </div>
        <div class="header-fields">
          <div class="field-box">
            <span class="field-lbl">Evento</span>
            <div style="display:flex;justify-content:space-between;width:100%;align-items:flex-end;">
              <span class="field-val">${esc(event.name)}</span>
              <span class="field-date">${formatDate(event.date)}</span>
            </div>
          </div>
          <div class="field-box">
            <span class="field-lbl">Competidor</span>
            <span class="field-val">${esc(participant.name)}</span>
          </div>
        </div>
        <div class="logo-right">
          <img src="/logo-long-range.svg" alt="LR" onerror="this.style.display='none';" />
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-box"><span class="lbl">TURNO DE TIRO</span><span class="vl">${participant.tanda || '—'}</span></div>
        <div class="meta-box"><span class="lbl">MODALIDAD</span><span class="vl" style="color:#7c3aed;">21 BLACKJACK</span></div>
        <div class="meta-box"><span class="lbl">CALIBRE / DISTANCIA</span><span class="vl">.22 LR (200m)</span></div>
        <div class="meta-box"><span class="lbl">CATEGORÍA</span><span class="vl">${esc(participant.category || 'GENERAL')}</span></div>
      </div>

      <div class="table-wrap">
        <table class="score-table">
          <thead>
            <tr>
              <th style="width:25%;text-align:left;padding-left:6px;">Blancos del Desafío</th>
              ${Array.from({ length: 12 }, (_, i) => `<th>D${i + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="totals-row">
        <div class="total-box">
          <span class="total-lbl">PUNTAJE TOTAL SERIE ÚNICA</span>
          <span class="total-num">${total} <span style="font-size:12px;font-weight:700;color:#6b21a8;">/ 147 pts</span></span>
        </div>
        <div class="visto-box">
          <span class="visto-lbl">FIRMA DE FISCAL DE CANCHA</span>
        </div>
      </div>

      <div class="rules-box">
        <div class="rules-title">Reglamento 21 Blackjack Challenge (.22 LR 200m)</div>
        <ul class="rules-list">
          <li>• 12 disparos totales por serie única. Secuencia obligatoria de rack: 12" ➔ 10" ➔ 8" ➔ 6" ➔ 4" ➔ 2" (21 pts).</li>
          <li>• Al completar el rack de 21 pts, cada tiro sobrante acertado al blanco de 2" otorga +21 PUNTOS DE BONUS.</li>
          <li>• Firma obligatoria del Fiscal al finalizar la serie.</li>
        </ul>
      </div>
    </div>
  `;
}

/**
 * Imprime la tarjeta oficial de Serie Única de 21 Blackjack para un competidor.
 */
export function printBlackjackSeriesCard(
  event: ShootingEvent,
  participant: Participant,
  series: Series | undefined
): void {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Planilla 21 Blackjack - ${esc(participant.name)}</title>
        <style>${getBJPrintStyles()}</style>
      </head>
      <body>
        <div class="a4-landscape-page">
          ${getBJSeriesColumnHtml(event, participant, series)}
        </div>
      </body>
    </html>
  `;
  openPrintModal(htmlContent, `Planilla 21 Blackjack - ${participant.name}`);
}

/**
 * Imprime las tarjetas oficiales de Serie Única de 21 Blackjack para todos los competidores del evento.
 */
export function printBlackjackEventCards(
  event: ShootingEvent,
  participants: Participant[],
  seriesList: Series[]
): void {
  const cardsHtml = participants.map((p) => {
    const pSeries = seriesList.find(s => s.participantId === p.id);
    return `
      <div class="a4-landscape-page">
        ${getBJSeriesColumnHtml(event, p, pSeries)}
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Planillas 21 Blackjack - ${esc(event.name)}</title>
        <style>${getBJPrintStyles()}</style>
      </head>
      <body>
        ${cardsHtml || `<div style="text-align:center;padding:40px;font-family:sans-serif;">Sin competidores inscritos.</div>`}
      </body>
    </html>
  `;
  openPrintModal(htmlContent, `Planillas 21 Blackjack - ${event.name}`);
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
