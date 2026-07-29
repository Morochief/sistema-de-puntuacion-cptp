/**
 * printScoreSheet.ts
 * Planilla oficial imprimible .22 LR en formato horizontal (Landscape).
 * Imprime dos series (Tandas) de un competidor una al lado de la otra
 * en una sola hoja A4 horizontal.
 */

import type { Series, ShootingEvent, Shot, Participant } from './types';
import { SCORING_TABLES } from './scoring';
import { db } from './db';
import { esc } from './modals';
import { openPrintModal } from './printModal';

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return isoDate; }
}

/**
 * Renderiza una celda de la tabla de puntuacion.
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
     <td class="score-cell cell-hit" title="Impactado aqui — ${cellValue} pts">
      <span class="val">${cellValue}</span>
      <span class="pts-lbl">pts</span>
     </td>`;
  }

  if (isMiss) {
    return `
     <td class="score-cell cell-miss" title="Fallo en disparo ${colShotNum}">
      <span class="val miss-val">${cellValue}</span>
      <span class="miss-x">&#10005;</span>
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
 */
function getLRPrintStyles(): string {
  return `
     @page { size: A4 landscape; margin: 0; }
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
    align-items: flex-start;
   }

   @media print {
    body { background: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .a4-landscape-page { 
      display: block;
      margin: 0;
      padding: 4mm;
      box-shadow: none;
      width: 297mm;
      height: 210mm;
      overflow: hidden;
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact; 
    }
    .series-column {
      float: left;
      width: 46%;
      margin: 0 2%;
      border: 1.5px solid #000;
      border-radius: 6px;
      padding: 2px 5px;
      background: #fff;
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
    width: 50%;
    border: 1.5px solid #000;
    border-radius: 6px;
    padding: 3px 6px;
    background: #fff;
   }

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
   .imp-list li::before { content: '\\2022'; position: absolute; left: 0; }
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
 * Si la serie es undefined, genera una planilla en blanco (valores de referencia).
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

    <!-- TABLA PRINCIPAL DE PUNTUACION -->
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

       <!-- ROW 10" - columna 1 vacia, columnas 2 a 10 -->
       <tr>
        <td class="row-label">10"</td>
        <td class="cell-empty"></td>
        ${vals10.map((v, i) => {
         const colN = i + 2;
         return renderScoreCell(colN, v, series ? hit10?.shotNumber : undefined, miss10);
        }).join('')}
        ${ vals10.length < 9 ? Array.from({ length: 9 - vals10.length }, () => '<td class="cell-empty"></td>').join('') : '' }
       </tr>

       <!-- ROW 5" - columnas 1-2 vacias, columnas 3 a 10 -->
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
     <div class="imp-banner">Proteccion visual y auditiva obligatoria</div>
    </div>
    </div>

  </div>
  `;
}

/**
 * Genera la pagina A4 horizontal para un tirador .22 LR.
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
export async function printSeriesCard(event: ShootingEvent, participant: Participant, _currentSeries: Series): Promise<void> {
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

/** Genera y abre una planilla unica que concatena todas las series del evento */
export function printEventCards(event: ShootingEvent, participants: Participant[], seriesList: Series[]): void {
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

/** Genera una planilla en blanco para llenado manual */
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
 <title>Planilla Vacia - ${event.name}</title>
 <style>
   ${getLRPrintStyles()}
 </style>
</head>
<body>
 <button class="print-btn no-print" onclick="window.print()">Imprimir Planilla Vacia</button>
 ${pageHtml}
</body>
</html>`;

  openPrintModal(html, 'Planilla Vacia');
}
