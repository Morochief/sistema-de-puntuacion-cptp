/**
 * CPTP .22 LR â€” Planilla oficial imprimible en formato horizontal (Landscape)
 *
 * Imprime dos series (Tandas) de un competidor una al lado de la otra
 * en una sola hoja A4 horizontal para ahorrar papel y facilitar la fiscalizaciÃ³n.
 */

import type { Series, ShootingEvent, Shot, Participant } from './types';
import { SCORING_TABLES } from './scoring';
import { db } from './db';
import { sortRanking } from './tiebreaker';
import { esc } from './modals';
import { getModalityConfig } from './modalityConfig';

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return isoDate; }
}

/**
 * Renderiza una celda de la tabla de puntuaciÃ³n.
 */
function renderScoreCell(
  colShotNum: number,
  cellValue: number,
  hitShotNum: number | undefined,
  missNums: Set<number>,
): string {
  const isHit = hitShotNum === colShotNum;
  const isMiss = missNums.has(colShotNum);

  if (isHit) {
    return `
     <td class="score-cell cell-hit" title="Impactado aquÃ­ â€” ${cellValue} pts">
      <span class="val">${cellValue}</span>
      <span class="pts-lbl">pts</span>
     </td>`;
  }

  if (isMiss) {
    return `
     <td class="score-cell cell-miss" title="Fallo en disparo ${colShotNum}">
      <span class="val miss-val">${cellValue}</span>
      <span class="miss-x">âœ•</span>
     </td>`;
  }

  return `
   <td class="score-cell">
    <span class="val">${cellValue}</span>
    <span class="pts-lbl">pts</span>
   </td>`;
}

/**
 * Retorna los estilos CSS para la planilla imprimible horizontal de .22 LR (dos columnas).
 * Restaurado a los valores que funcionaban antes del agregado de CF.
 */
function getLRPrintStyles(): string {
  return `
     @page { size: A4 landscape; margin: 2mm 5mm; }
   *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

   body {
    font-family: Arial, Helvetica, sans-serif;
    background: #f0f0f0;
    color: #000;
    padding: 0;
    margin: 0;
   }

   .a4-landscape-page {
    width: 287mm;
    margin: 10mm auto;
    background: #fff;
    padding: 8px 14px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    display: flex;
    gap: 12px;
    page-break-inside: avoid;
    break-inside: avoid;
   }

   @media print {
    body { background: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .a4-landscape-page { 
      margin: 0 auto; 
      padding: 6px 8px; 
      box-shadow: none; 
      width: 277mm; 
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact; 
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .no-print { display: none !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
   }

   .print-btn {
    display: block; margin: 5px auto 3px; padding: 7px 24px;
    background: #000; color: #fff; border: none; border-radius: 6px;
    font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.06em;
    font-family: Arial, sans-serif;
   }
   .print-btn:hover { background: #333; }

   /* Columnas lado a lado para .22 LR */
   .series-column {
    flex: 1;
    width: 50%;
    min-width: 0;
    border: 1.5px solid #000;
    border-radius: 6px;
    padding: 3px 6px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background: #fff;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
   }

   /* Sub-diseÃ±o de las tarjetas internas */
   .header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
   .logo-left { width: 50px; flex-shrink: 0; }
   .logo-left img, .logo-right img { width: 100%; height: auto; object-fit: contain; }
   .logo-right { width: 70px; flex-shrink: 0; text-align: center; }
   .header-fields { flex: 1; display: flex; flex-direction: column; gap: 3px; }

   .field-box {
    border: 1px solid #000; border-radius: 10px; padding: 2px 6px;
    position: relative; min-height: 26px; display: flex; align-items: flex-end;
   }
   .field-lbl { position: absolute; top: 1px; left: 6px; font-size: 6.5px; font-weight: 700; color: #555; text-transform: uppercase; }
   .field-lbl-r { position: absolute; top: 1px; right: 42px; font-size: 6.5px; font-weight: 700; color: #555; text-transform: uppercase; }
   .field-val { font-size: 9px; font-weight: 600; padding: 0 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
   .field-date { position: absolute; bottom: 2px; right: 6px; font-size: 8.5px; font-family: monospace; }

   .lr-fallback { display: flex; flex-direction: column; align-items: center; gap: 0.5px; }
   .lr-fallback .lrt { font-size: 11px; font-weight: 900; line-height: 1; text-align: center; }
   .lr-fallback .lrs { font-size: 6.5px; color: #555; letter-spacing: 0.05em; }

   .thick-hr { border: none; border-top: 2px solid #000; margin: 2px 0; }

   .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 2px; }
   .meta-box {
    border: 1.5px solid #000; border-radius: 18px; height: 40px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 2px;
   }
   .meta-box .lbl { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #000; }
   .meta-box .vl { font-size: 13px; font-weight: 900; line-height: 1.05; }
   .meta-box .vs { font-size: 12px; font-weight: 700; margin-top: 0.5px; }

   .table-wrap { border: 1.5px solid #000; border-radius: 6px; overflow: hidden; margin-bottom: 5px; }
   table.score-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
   .score-table th, .score-table td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; }
   .score-table thead tr { background: #f0f0f0; height: 20px; }
   .score-table th { font-size: 9.5px; font-weight: 900; text-transform: uppercase; }
   .th-label { width: 12%; } .th-pts { width: 10%; font-size: 8.5px; } .th-add { width: 11%; font-size: 8.5px; }

   .score-cell { height: 25px; font-size: 0; position: relative; }
   .score-cell .val   { font-size: 12px; font-weight: 600; display: block; line-height: 1.05; color: #555; }
   .score-cell .pts-lbl { font-size: 7.5px; color: #aaa; display: block; line-height: 0.85; }

   .cell-empty { height: 25px; background: #f8f8f8; }

   .score-cell.cell-hit {
    background: #000 !important;
    border: 1.5px solid #000 !important;
   }
   .score-cell.cell-hit .val {
    color: #fff !important;
    font-size: 13px !important;
    font-weight: 900 !important;
   }
   .score-cell.cell-hit .pts-lbl { color: #888 !important; }

   .score-cell.cell-miss {
    background: #fff5f5;
    position: relative;
   }
   .score-cell.cell-miss .miss-val { color: #ccc; font-size: 10px; }
   .score-cell.cell-miss .miss-x {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 13px; color: #e53e3e; font-weight: 900; opacity: 0.85;
   }

   .row-label { font-size: 15px; font-weight: 900; background: #fafafa; height: 25px; }

   .td-puntos  { font-size: 15px; font-weight: 900; background: #fffde7; }
   .td-adicional{ font-size: 14px; font-weight: 700; background: #fffde7; }

   .totals-row { display: flex; gap: 6px; margin-top: 2px; }
   .total-box {
    flex: 1; border: 1.5px solid #000; border-radius: 8px; height: 38px;
    display: flex; align-items: center; justify-content: space-between; padding: 0 10px;
   }
   .total-lbl { font-size: 9.5px; font-weight: 900; text-transform: uppercase; }
   .total-val { display: flex; align-items: baseline; gap: 3px; }
   .total-num { font-size: 20px; font-weight: 900; }
   .total-word { font-size: 11px; font-weight: 300; color: #555; }
   .visto-box { width: 36%; border: 1.5px solid #000; border-radius: 8px; height: 38px; padding: 3px 8px; position: relative; flex-shrink: 0; }
   .visto-lbl { font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #555; }

   .target-summary {
    margin: 1px 0; padding: 3px 6px; background: #f8f8f8; border-radius: 4px;
    font-size: 8.5px; display: flex; flex-direction: column; gap: 1px;
   }
   .target-summary p { margin: 0; color: #333; line-height: 1.15; }

   .importante { border: 1.5px solid #000; padding: 4px 8px; display: flex; flex-direction: column; align-items: center; margin-top: 2px; }
   .imp-title { font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
   .imp-list { width: 100%; list-style: none; padding: 0 2px; margin-bottom: 2px; }
   .imp-list li { font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 1px; padding-left: 8px; position: relative; }
   .imp-list li::before { content: 'â€¢'; position: absolute; left: 0; }
   .imp-banner { font-size: 8.5px; font-weight: 900; text-transform: uppercase; background: #000; color: #fff; padding: 2px 8px; text-align: center; margin-bottom: 1px; width: 90%; }
   .imp-banner.narrow { width: 70%; }

   .foot { text-align: center; font-size: 7.5px; color: #aaa; margin-top: 2px; font-style: italic; }

   .legend { display: flex; gap: 8px; justify-content: center; margin: 1px 0; font-size: 9px; flex-wrap: wrap; }
   .legend-item { display: flex; align-items: center; gap: 3px; }
   .legend-box { width: 12px; height: 12px; border: 1px solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 7.5px; font-weight: 900; }
   .legend-box.lhit { background: #000; color: #fff; }
   .legend-box.lmiss { background: #fff5f5; color: #e53e3e; font-size: 9px; }
  `;
}

/**
 * Genera el HTML de una sola columna representando una serie .22 LR.
 * Si la serie es undefined, genera una planilla en blanco (valores de referencia)
 * para llenado manual del competidor.
 */
function getSeriesColumnHtml(
  event: ShootingEvent,
  participant: Participant,
  series: Series | undefined,
  seriesNumberLabel: number
): string {
  const shots = series?.shots ?? [];

  const hit15  = shots.find((s) => s.targetType === '15"' && s.hit);
  const hit10  = shots.find((s) => s.targetType === '10"' && s.hit);
  const hit5  = shots.find((s) => s.targetType === '5"' && s.hit);
  const addShots = shots.filter((s) => s.targetType === 'additional');

  const miss15 = new Set(shots.filter((s) => s.targetType === '15"' && !s.hit).map((s) => s.shotNumber));
  const miss10 = new Set(shots.filter((s) => s.targetType === '10"' && !s.hit).map((s) => s.shotNumber));
  const miss5 = new Set(shots.filter((s) => s.targetType === '5"' && !s.hit).map((s) => s.shotNumber));

  const pts15  = hit15?.value ?? 0;
  const pts10  = hit10?.value ?? 0;
  const pts5  = hit5?.value ?? 0;
  const addPts = addShots.reduce((s, sh) => s + sh.value, 0);
  const mainPts = pts15 + pts10 + pts5;
  const total  = series ? (mainPts + addPts) : 0;
  const maxScore = 67;

  const vals15 = SCORING_TABLES['15"'];
  const vals10 = SCORING_TABLES['10"'];
  const vals5 = SCORING_TABLES['5"'];

  const targetSummary = (label: string, hitShot: Shot | undefined, missSet: Set<number>): string => {
    if (!series) {
      return `<span style="color:#aaa;">${label}: no impactado (Firma Fiscal)</span>`;
    }
    if (!hitShot) {
      return `<span style="color:#888;">${label}: no impactado (${missSet.size} fallo${missSet.size !== 1 ? 's' : ''})</span>`;
    }
    return `<strong>${label}:</strong> ${hitShot.value} pts (disparo ${hitShot.shotNumber})${missSet.size > 0 ? ` — ${missSet.size} fallo${missSet.size !== 1 ? 's' : ''} previo${missSet.size !== 1 ? 's' : ''}` : ''}`;
  };

  return `
  <div class="series-column">
    <!-- HEADER -->
    <div class="header">
     <div class="logo-left">
      <img src="/logo-cptp.svg" alt="Club Paraguayo de Tiro"
         onerror="this.src='/images/logo-club.png'; this.onerror=function(){this.style.display='none'; document.getElementById('logo-fallback-svg').style.display='block';};" />
      <svg id="logo-fallback-svg" style="display:none;" viewBox="0 0 80 80" width="40" height="40">
       <circle cx="40" cy="40" r="37" fill="none" stroke="#000" stroke-width="2"/>
       <text x="40" y="44" text-anchor="middle" font-size="7" font-weight="bold">CPTP</text>
      </svg>
     </div>

     <div class="header-fields">
      <div class="field-box">
       <span class="field-lbl">Evento</span>
       <span class="field-lbl-r">Fecha</span>
       <div style="display:flex;justify-content:space-between;width:100%;align-items:flex-end;">
        <span class="field-val" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${event.name}${event.championshipDate ? ` · ${event.championshipDate}` : ''}</span>
        <span class="field-date">${formatDate(event.date)}</span>
       </div>
      </div>
      <div class="field-box" style="min-height:30px;">
       <span class="field-lbl">Participante</span>
       <span class="field-val">
        ${participant.name} 
        ${seriesNumberLabel === 1
          ? (participant.tanda ? ` (Tanda ${participant.tanda} · Mesa ${participant.spot})` : '')
          : (participant.tandaS2 ? ` (Tanda ${participant.tandaS2} · Mesa ${participant.spotS2})` : '')
        }
       </span>
      </div>
     </div>

     <div class="logo-right">
      <img src="/logo-long-range.svg" alt="Long Range"
         onerror="this.src='/images/logo-long-range.png'; this.onerror=function(){this.style.display='none'; document.getElementById('lr-fallback-svg').style.display='flex';};" />
      <div id="lr-fallback-svg" class="lr-fallback" style="display:none;">
       <div class="lrt">LONG RANGE</div>
       <div class="lrs">.22 LR</div>
      </div>
     </div>
    </div>

    <hr class="thick-hr" />

    <!-- META BLOCKS (OVALOS: ORDEN, MODALIDAD, CALIBRE, CATEGORIA) -->
    <div class="meta-grid">
     <div class="meta-box">
      <span class="lbl">ORDEN</span>
      <span class="vl" style="font-size:11px;font-weight:900;text-transform:uppercase;">SERIE ${seriesNumberLabel}</span>
     </div>
     <div class="meta-box">
      <span class="lbl">MODALIDAD</span>
      <img src="/modalidad.svg" alt="Long Range" style="height:24px;width:auto;object-fit:contain;" />
     </div>
     <div class="meta-box">
      <span class="lbl">CALIBRE</span>
      <img src="/22lr.svg" alt=".22 LR" style="height:22px;width:auto;object-fit:contain;" />
     </div>
     <div class="meta-box">
      <span class="lbl">CATEGORIA</span>
      <div class="vs" style="font-size:12px;font-weight:900;text-transform:uppercase;">${participant.category || '—'}</div>
     </div>
    </div>

    <!-- LEYENDA -->
    <div class="legend no-print">
     <div class="legend-item"><div class="legend-box lhit">#</div><span>Impacto</span></div>
     <div class="legend-item"><div class="legend-box lmiss">X</div><span>Fallo</span></div>
     <div class="legend-item" style="font-size:7px;color:#555;">Valores son de referencia</div>
    </div>

    <!-- TABLA PRINCIPAL DE PUNTUACIÓN -->
    <div class="table-wrap">
     <table class="score-table">
      <colgroup>
       <col class="th-label">
       ${Array.from({ length: 10 }, () => '<col>').join('')}
       <col class="th-pts">
       <col class="th-add">
      </colgroup>
      <thead>
       <tr>
        <th class="th-label">Disparos</th>
        ${Array.from({ length: 10 }, (_, i) => `<th>${i + 1}</th>`).join('')}
        <th class="th-pts">Ptos</th>
        <th class="th-add">Adic</th>
       </tr>
      </thead>
      <tbody>

       <!-- ROW 15" - columnas 1 a 10 -->
       <tr>
        <td class="row-label">15"</td>
        ${vals15.map((v, i) => {
         const colN = i + 1;
         return renderScoreCell(colN, v, series ? hit15?.shotNumber : undefined, miss15);
        }).join('')}
        <td class="td-puntos" rowspan="3">${series ? (mainPts || '') : ''}</td>
        <td class="td-adicional" rowspan="3">${series ? addPts : ''}</td>
       </tr>

       <!-- ROW 10" - columna 1 vacía, columnas 2 a 10 -->
       <tr>
        <td class="row-label">10"</td>
        <td class="cell-empty"></td>
        ${vals10.map((v, i) => {
         const colN = i + 2;
         return renderScoreCell(colN, v, series ? hit10?.shotNumber : undefined, miss10);
        }).join('')}
        ${ vals10.length < 9 ? Array.from({ length: 9 - vals10.length }, () => '<td class="cell-empty"></td>').join('') : '' }
       </tr>

       <!-- ROW 5" - columnas 1-2 vacías, columnas 3 a 10 -->
       <tr>
        <td class="row-label">5"</td>
        <td class="cell-empty"></td>
        <td class="cell-empty"></td>
        ${vals5.map((v, i) => {
         const colN = i + 3;
         return renderScoreCell(colN, v, series ? hit5?.shotNumber : undefined, miss5);
        }).join('')}
        ${ vals5.length < 8 ? Array.from({ length: 8 - vals5.length }, () => '<td class="cell-empty"></td>').join('') : '' }
       </tr>

       <!-- FILA DE TOTAL HIGHLIGHTED (PIE DE TABLA) -->
       <tr class="total-footer-row">
        <td colspan="11" style="text-align:right; font-weight:bold; font-size:8px; padding-right:8px; background:#fafafa; border-right:1px solid #000;">TOTAL:</td>
        <td colspan="2" style="font-size:12px; font-weight:900; background:${series ? '#000' : '#fff'}; color:${series ? '#fff' : '#000'}; text-align:center; border:2.5px solid #000; padding:4px;">
         ${series ? `${total} / ${maxScore}` : `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / 67`}
        </td>
       </tr>

      </tbody>
     </table>
    </div>

     <!-- RESUMEN DE BLANCOS IMPACTADOS -->
     <div class="target-summary">
      <p>${targetSummary('15"', hit15, miss15)}</p>
      <p>${targetSummary('10"', hit10, miss10)}</p>
      <p>${targetSummary('5"', hit5, miss5)}</p>
      ${series && addShots.length > 0 ? `<p><strong>Adicionales:</strong> ${addShots.length} disparos - ${addPts} pts</p>` : series ? '' : '<p style="color:#aaa;">Adicionales: firma de fiscal al culminar</p>'}
     </div>

    <!-- TOTAL GENERAL -->
    <div class="totals-row">
     <div class="total-box">
      <span class="total-lbl">Total</span>
      <div class="total-val">
       <span class="total-num">${total || '—'}</span>
       <span class="total-word">pts</span>
      </div>
     </div>
     <div class="visto-box">
      <span class="visto-lbl">Firma Fiscal</span>
     </div>
    </div>

    <!-- IMPORTANTE -->
    <div class="importante">
     <h2 class="imp-title">Reglamento CPTP</h2>
     <ul class="imp-list">
      <li>Marcar acierto con "O", fallo con "X"</li>
      <li>Firma de fiscal es obligatoria tras la serie</li>
     </ul>
     <div class="imp-banner">Protección visual y auditiva obligatoria</div>
    </div>
    </div>

  </div>
  `;
}

/**
 * Genera la página A4 horizontal para un tirador .22 LR.
 * Dos columnas (Serie 1 y Serie 2) lado a lado.
 */
function getCompetitorLandscapePageHtml(
  event: ShootingEvent,
  participant: Participant,
  seriesList: Series[],
  pageBreakStyle: string = ''
): string {
  const s1 = seriesList.find((s) => s.seriesNumber === 1);
  const s2 = seriesList.find((s) => s.seriesNumber === 2);
  const col1Html = getSeriesColumnHtml(event, participant, s1, 1);
  const col2Html = getSeriesColumnHtml(event, participant, s2, 2);
  return `
   <div class="a4-landscape-page" ${pageBreakStyle}>
     ${col1Html}
     ${col2Html}
   </div>
  `;
}

/** Genera y abre la planilla imprimible horizontal (Series 1 y 2 juntas) para un tirador */
export async function printSeriesCard(event: ShootingEvent, participant: Participant, currentSeries: Series): Promise<void> {
  // Consultar todas las series del participante para este evento
  const participantSeries = (await db.series
    .where('participantId')
    .equals(participant.id!)
    .filter((item: any) => !item.is_deleted).toArray())
    .filter((s) => s.eventId === event.id);

  const pageHtml = getCompetitorLandscapePageHtml(event, participant, participantSeries);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Planilla CPTP — ${participant.name} — Series 1 y 2</title>
 <style>
   ${getLRPrintStyles()}
 </style>
</head>
<body>
 <button class="print-btn no-print" onclick="window.print()">Imprimir Planilla Doble</button>
 ${pageHtml}
</body>
</html>`;

  openPrintModal(html, `Planilla CPTP — ${participant.name}`);
}

/** Genera y abre una planilla única que concatena todas las series del evento agrupadas por tirador (una hoja por tirador) */
export function printEventCards(event: ShootingEvent, participants: Participant[], seriesList: Series[]): void {
  // Agrupar series por participante
  const pagesHtml = participants.map((p, idx) => {
    const pSeries = seriesList.filter((s) => s.participantId === p.id);
    const isLast = idx === participants.length - 1;
    const breakStyle = isLast ? '' : 'style="page-break-after: always; break-after: page;"';
    return getCompetitorLandscapePageHtml(event, p, pSeries, breakStyle);
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Todas las Planillas — ${event.name}</title>
 <style>
   ${getLRPrintStyles()}
 </style>
</head>
<body>
 <button class="print-btn no-print" onclick="window.print()">Imprimir Todas las Planillas</button>
 ${pagesHtml}
</body>
</html>`;

  openPrintModal(html, `Todas las Planillas — ${event.name}`);
}

export function printRankingCard(event: ShootingEvent, participants: Participant[], seriesList: Series[]): void {
  const year = new Date(event.date + 'T12:00:00').getFullYear();

  // Helper to calculate ranking for a specific series (or total if seriesNum is null)
  const getRanking = (seriesNum: number | null) => {
    const data = participants.map(p => {
      let score = 0;
      if (seriesNum === null) {
        const pSeries = seriesList.filter(s => s.participantId === p.id);
        score = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
      } else {
        const s = seriesList.find(s => s.participantId === p.id && s.seriesNumber === seriesNum);
        if (s) score = s.totalScore;
      }
      return { participant: p, totalScore: score };
    });
    // Remove people with 0 points if we are filtering? No, let's keep everyone who has > 0 points or all?
    // Actually, it's better to show everyone, but if they have 0, they rank at the bottom.
    data.sort(sortRanking);
    return data;
  };

  const rankTotal = getRanking(null);
  const rankS1 = getRanking(1);
  const rankS2 = getRanking(2);

  // Helper to build table rows
  const buildRows = (rankings: { participant: Participant, totalScore: number }[]) => {
    return rankings.map((r, i) => {
      const pos = i + 1;
      const p = r.participant;
      const isTop3 = pos <= 3;
      const isDq = p.status === 'dq';
      const isDns = p.status === 'dns';

      const posHtml = isDq
       ? `<div style="font-size:12px;font-weight:900;color:#b7201c;background:#fee2e2;padding:4px 8px;border-radius:4px;display:inline-block;">DQ</div>`
       : isDns
       ? `<div style="font-size:12px;font-weight:900;color:#d97706;background:#fef3c7;padding:4px 8px;border-radius:4px;display:inline-block;">DNS</div>`
       : isTop3 
       ? `<div class="pos-badge top-${pos}">${pos}</div>`
       : `<div class="pos-number">${pos}</div>`;
        
      const laneLabel = p.tanda
       ? `S1: T${p.tanda}·M${p.spot} | S2: T${p.tandaS2 || '—'}·M${p.spotS2 || '—'}`
       : 'Sin posición';
      const scoreDisplay = isDq ? '<span style="color:#ef4444;">DQ (0)</span>' : isDns ? '<span style="color:#f59e0b;">DNS</span>' : String(r.totalScore);

      return `
       <tr class="rank-row">
        <td class="td-pos">${posHtml}</td>
        <td class="td-name">
         <div class="name-text">${esc(p.name).toUpperCase()}</div>
         <div class="sub-text">COMPETIDOR · ${laneLabel} ${p.category ? `· ${esc(p.category)}` : ''}</div>
        </td>
        <td class="td-score">
         <div class="score-val">${scoreDisplay}</div>
        </td>
       </tr>`;
    }).join('');
  };

  const rowsTotalHtml = buildRows(rankTotal);
  const rowsS1Html = buildRows(rankS1);
  const rowsS2Html = buildRows(rankS2);

  // Calculate perfect scores
  const perfectScores = participants.map(p => {
    const pSeries = seriesList.filter(s => s.participantId === p.id);
    const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
    const s1 = pSeries.find(s => s.seriesNumber === 1)?.totalScore || 0;
    const s2 = pSeries.find(s => s.seriesNumber === 2)?.totalScore || 0;
    return { p, s1, s2, totalScore };
  }).filter(x => x.s1 === 67 || x.s2 === 67 || x.totalScore === 134);
  
  // Sort perfect scores by total
  perfectScores.sort((a, b) => b.totalScore - a.totalScore);

  let perfectRowsHtml = perfectScores.map(r => {
    let reason = [];
    if (r.s1 === 67) reason.push("Serie 1 (67 pts)");
    if (r.s2 === 67) reason.push("Serie 2 (67 pts)");
    if (r.totalScore === 134) reason = ["Evento Perfecto (134 pts)"]; // overriding for max impact

    const p = r.p;
    const isDq = p.status === 'dq';
    const isDns = p.status === 'dns';
    if (isDq || isDns) return '';

    return `
      <tr class="rank-row" style="background:#fffbeb;">
        <td class="td-pos"><div style="font-size:16px;font-weight:900;color:#d97706;text-align:center;">★</div></td>
        <td class="td-name">
         <div class="name-text">${esc(p.name).toUpperCase()}</div>
         <div class="sub-text">COMPETIDOR #${p.competitorNumber} ${p.category ? `· ${esc(p.category)}` : ''}</div>
        </td>
        <td class="td-score">
         <div class="score-val" style="font-size:14px;color:#d97706;">${reason.join(' / ')}</div>
        </td>
      </tr>`;
  }).join('');

  if (perfectRowsHtml.trim() === '') {
    perfectRowsHtml = `<tr><td colspan="3" style="text-align:center;padding:40px;color:#64748b;font-weight:bold;">Ningún tirador alcanzó puntaje perfecto (67 o 134).</td></tr>`;
  }

  // Helper to build a page
  const buildPage = (titleExtra: string, tableHtml: string, isLast: boolean = false) => `
  <div class="a4-page" ${!isLast ? 'style="page-break-after: always; break-after: page;"' : ''}>
    <div class="layout-border-red"></div>
    <div class="layout-border-blue"></div>
    <div class="layout-border-white"></div>

    <header class="header" style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e293b;padding-bottom:16px;margin-bottom:20px;gap:12px;">
     <!-- Logo Izquierdo (CPTP) -->
     <div style="background:#ffffff;border-radius:6px;padding:2px;display:flex;align-items:center;justify-content:center;height:45px;width:45px;flex-shrink:0;">
      <img src="/logo-cptp.svg" alt="CPTP Logo" style="height:38px;width:38px;object-fit:contain;" />
     </div>

     <div class="header-left" style="flex:1;margin-left:8px;">
      <span class="category">Campeonato Nacional Long Range</span>
      <h1 class="title-main">TABLA DE POSICIONES</h1>
      <span class="event-name">${event.name.toUpperCase()} ${titleExtra ? `· <span style="color:#0056b3;font-weight:900;">${titleExtra.toUpperCase()}</span>` : ''}</span>
     </div>
     
     <div class="header-right" style="margin-right:8px;">
      <div class="year">${year}</div>
      <div class="date">${formatDate(event.date)}</div>
     </div>

     <!-- Logo Derecho (Long Range) -->
     <div style="background:#ffffff;border-radius:6px;padding:2px;display:flex;align-items:center;justify-content:center;height:45px;width:55px;flex-shrink:0;">
      <img src="/logo-long-range.svg" alt="Long Range .22 LR" style="height:38px;width:48px;object-fit:contain;" />
     </div>
    </header>

    <table class="ranking-table">
     <thead>
      <tr>
       <th>Pos</th>
       <th>Tirador</th>
       <th class="th-score">Puntaje</th>
      </tr>
     </thead>
     <tbody>
      ${tableHtml}
     </tbody>
    </table>

    <footer class="footer">
     <div>Club Paraguayo de Tiro de Long Range · Planilla Oficial</div>
     <div class="footer-right">CPTP Scoring</div>
    </footer>
  </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Ranking — ${event.name}</title>
 <style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
   font-family: Arial, Helvetica, sans-serif;
   background: #f1f5f9;
   color: #0f172a;
   padding: 0;
   margin: 0;
   position: relative;
  }

  /* El div.page-container oculta todo el body si usamos margin:0, asi que usamos gap */
  .pages-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px 0;
    align-items: center;
  }

  .a4-page {
   width: 210mm;
   min-height: 297mm;
   background: #ffffff;
   padding: 24px 28px 80px 52px;
   position: relative;
   overflow: hidden;
   box-shadow: 0 4px 32px rgba(15, 23, 42, 0.15);
  }

  @media print {
   body { background: none; }
   .pages-container { padding: 0; gap: 0; display: block; }
   .a4-page { margin: 0; padding: 24px 24px 80px 40px; box-shadow: none; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
   .no-print { display: none !important; }
  }

  .print-btn {
   display: block; margin: 10px auto; padding: 10px 30px;
   background: #0056b3; color: #fff; border: none; border-radius: 8px;
   font-size: 14px; font-weight: 700; cursor: pointer;
  }
  .print-btn:hover { background: #004085; }

  .layout-border-red { position: absolute; top: 0; left: 0; bottom: 0; width: 12px; background: #b7201c; }
  .layout-border-blue { position: absolute; top: 0; left: 12px; bottom: 0; width: 8px; background: #0056b3; }
  .layout-border-white { position: absolute; top: 0; left: 20px; bottom: 0; width: 4px; background: #cbd5e1; }

  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
  .header-left { display: flex; flex-direction: column; gap: 4px; }
  .header-left .category { font-size: 11px; font-weight: 800; color: #0056b3; letter-spacing: 0.15em; text-transform: uppercase; }
  .header-left .title-main { font-size: 26px; font-weight: 900; color: #b7201c; letter-spacing: -0.02em; }
  .header-left .event-name { font-size: 13px; color: #475569; font-weight: 500; }
  
  .header-right { text-align: right; }
  .header-right .year { font-size: 32px; font-weight: 900; color: rgba(0,86,179,0.07); font-style: italic; line-height: 0.8; }
  .header-right .date { font-size: 12px; color: #475569; font-family: monospace; font-weight: bold; }

  .ranking-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .ranking-table th { text-align: left; font-size: 10px; font-weight: 800; color: #0056b3; text-transform: uppercase; letter-spacing: 0.1em; padding: 8px 12px; border-bottom: 2px solid #cbd5e1; }
  .ranking-table th.th-score { text-align: right; }

  .rank-row { border-bottom: 1px solid #e2e8f0; transition: background 0.2s; }
  .rank-row td { padding: 10px 12px; vertical-align: middle; }
  
  .td-pos { width: 60px; }
  .pos-badge { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; color: #ffffff; }
  .pos-badge.top-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000000; box-shadow: 0 0 12px rgba(245,158,11,0.4); }
  .pos-badge.top-2 { background: linear-gradient(135deg, #e2e8f0, #cbd5e1); color: #0f172a; }
  .pos-badge.top-3 { background: linear-gradient(135deg, #b7201c, #991b1b); color: #ffffff; }
  .pos-number { font-size: 15px; font-weight: bold; color: #475569; padding-left: 8px; }

  .td-name { flex: 1; }
  .name-text { font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
  .sub-text { font-size: 10px; color: #475569; font-weight: bold; margin-top: 2px; }

  .td-score { text-align: right; width: 100px; }
  .score-val { font-size: 20px; font-weight: 900; color: #16a34a; font-family: monospace; }

  .footer { position: absolute; bottom: 24px; left: 52px; right: 28px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
  .footer-right { color: #0056b3; }
 </style>
</head>
<body>
 <div class="no-print" style="text-align:center; padding:10px; background:#e2e8f0; border-bottom:1px solid #cbd5e1;">
   <button class="print-btn" onclick="window.print()" style="display:inline-block; margin:0;">Imprimir Reportes Completos</button>
 </div>
 <div class="pages-container">
   ${buildPage('Total Evento', rowsTotalHtml)}
   ${buildPage('Serie 1', rowsS1Html)}
   ${buildPage('Serie 2', rowsS2Html)}
   ${buildPage('Reporte de Premios (67 / 134 pts)', perfectRowsHtml, true)}
 </div>
</body>
</html>`;

  openPrintModal(html, `Ranking — ${event.name}`);
}
export function openPrintModal(htmlContent: string, title: string): void {
  (window as any).cptpOpenPrintModalGlobal = openPrintModal;
  const existing = document.getElementById('cptp-print-modal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'cptp-print-modal';
  backdrop.className = 'cptp-modal-backdrop no-print';
  backdrop.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px);
    z-index: 2500; display: flex; flex-direction: column;
    padding: 12px; box-sizing: border-box;
  `;

  backdrop.innerHTML = `
    <div style="width: 95%; max-width: 1100px; height: 85vh; background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 5px solid #b7201c; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(15, 23, 42, 0.25);">
      <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-family:'Orbitron',sans-serif;font-weight:900;font-size:0.95rem;color:#0056b3;">Vista Previa</span>
          <span style="font-size:0.75rem;color:#64748b;font-weight:600;">${title}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button id="btn-do-print" class="btn-primary-custom" style="padding:8px 16px;background:#0056b3;color:#ffffff;border-color:#0056b3;font-weight:bold;border-radius:8px;font-size:0.8rem;cursor:pointer;box-shadow:none;">
            Imprimir
          </button>
          <button id="btn-close-print" class="btn-ghost-custom" style="padding:8px 14px;color:#0f172a;border-color:#cbd5e1;background:#ffffff;font-weight:bold;font-size:0.8rem;cursor:pointer;">
            Cerrar
          </button>
        </div>
      </div>
      <div style="flex:1;background:#ffffff;overflow:hidden;position:relative;">
        <iframe id="print-iframe" style="width:100%;height:100%;border:none;background:#ffffff;" title="Planilla de impresion"></iframe>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  void backdrop.offsetWidth;
  backdrop.classList.add('is-open');

  const iframe = backdrop.querySelector('#print-iframe') as HTMLIFrameElement;
  const iframeWin = iframe.contentWindow;
  if (iframeWin) {
    iframeWin.document.open();
    iframeWin.document.write(htmlContent);
    iframeWin.document.close();
  }

  const triggerPrint = () => {
    if (iframeWin) {
      iframeWin.focus();
      iframeWin.print();
    }
  };

  backdrop.querySelector('#btn-do-print')?.addEventListener('click', triggerPrint);
  backdrop.querySelector('#btn-close-print')?.addEventListener('click', () => {
    backdrop.classList.remove('is-open');
    backdrop.classList.add('is-closing');
    setTimeout(() => backdrop.remove(), 150);
  });
}

export function printBlankSheet(event: ShootingEvent): void {
  const dummyParticipant: Participant = {
    id: -1,
    eventId: event.id!,
    name: '________________________________',
    category: '______________',
    competitorNumber: 0,
    tanda: undefined,
    spot: undefined
  };

  const pageHtml = getCompetitorLandscapePageHtml(event, dummyParticipant, []);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Planilla Vacía - ${event.name}</title>
 <style>
   ${getLRPrintStyles()}
 </style>
</head>
<body>
 <button class="print-btn no-print" onclick="window.print()">Imprimir Planilla Vacía</button>
 ${pageHtml}
</body>
</html>`;

  openPrintModal(html, 'Planilla Vacía');
}
