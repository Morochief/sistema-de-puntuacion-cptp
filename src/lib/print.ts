/**
 * CPTP .22 LR — Planilla oficial imprimible
 *
 * Genera la planilla con MARCAS VISUALES sobre la tabla de puntuación:
 *  - Celda del valor LOGRADO → fondo negro, valor en blanco ()
 *  - Celdas donde se FALLÓ antes de lograrlo → marca "" superpuesta
 *  - Disparos adicionales (shots 4-10) → O/X en la fila de resultado
 */

import type { Series, ShootingEvent, Shot, Participant } from './types';
import { SCORING_TABLES } from './scoring';

function findShot(shots: Shot[], shotNumber: number): Shot | undefined {
 return shots.find((s) => s.shotNumber === shotNumber);
}

function formatDate(isoDate: string): string {
 try {
  const d = new Date(isoDate + 'T12:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
 } catch { return isoDate; }
}

/**
 * Renderiza una celda de la tabla de puntuación.
 *
 * @param colShotNum Número de disparo que corresponde a esta columna (1-10)
 * @param cellValue  Valor de referencia de la celda (ej: 7)
 * @param hitShotNum En qué disparo se impactó este blanco (undefined = no impactado aún)
 * @param missNums  Set de números de disparo donde se falló este blanco
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
   <td class="score-cell cell-hit" title="Impactado aquí — ${cellValue} pts">
    <span class="val">${cellValue}</span>
    <span class="pts-lbl">pts</span>
   </td>`;
 }

 if (isMiss) {
  return `
   <td class="score-cell cell-miss" title="Fallo en disparo ${colShotNum}">
    <span class="val miss-val">${cellValue}</span>
    <span class="miss-x"></span>
   </td>`;
 }

 return `
  <td class="score-cell">
   <span class="val">${cellValue}</span>
   <span class="pts-lbl">pts</span>
  </td>`;
}

/** Genera y abre la planilla imprimible para una serie */
export function printSeriesCard(event: ShootingEvent, participant: Participant, series: Series): void {
 const shots = series.shots;

 // ── Buscar el impacto y los fallos de cada blanco ──────────────
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
 const total  = mainPts + addPts;

 const vals15 = SCORING_TABLES['15"'];
 const vals10 = SCORING_TABLES['10"'];
 const vals5 = SCORING_TABLES['5"'];

 const resultRow = Array.from({ length: 10 }, (_, i) => {
  const sn = i + 1;
  const sh = findShot(shots, sn);
  if (!sh) return `<td class="res-cell res-empty">·</td>`;
  return `<td class="res-cell ${sh.hit ? 'res-hit' : 'res-miss'}">${sh.hit ? 'O' : 'X'}</td>`;
 }).join('');

 const targetSummary = (label: string, hitShot: Shot | undefined, missSet: Set<number>): string => {
  if (!hitShot) {
   return `<span style="color:#888;">${label}: no impactado (${missSet.size} fallo${missSet.size !== 1 ? 's' : ''})</span>`;
  }
  return `<strong>${label}:</strong> ${hitShot.value} pts (disparo ${hitShot.shotNumber})${missSet.size > 0 ? ` — ${missSet.size} fallo${missSet.size !== 1 ? 's' : ''} previo${missSet.size !== 1 ? 's' : ''}` : ''}`;
 };

 const html = /* html */`<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Planilla CPTP — ${event.name} — Serie ${series.seriesNumber}</title>
 <style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
   font-family: Arial, Helvetica, sans-serif;
   background: #f0f0f0;
   color: #000;
  }

  .a4-page {
   width: 210mm;
   min-height: 270mm;
   margin: 8mm auto;
   background: #fff;
   padding: 16px 18px;
   box-shadow: 0 4px 24px rgba(0,0,0,0.2);
  }
  @media print {
   body { background: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
   .a4-page { margin: 0; padding: 14px 16px; box-shadow: none; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
   .no-print { display: none !important; }
   * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }

  .print-btn {
   display: block; margin: 0 auto 10px; padding: 9px 28px;
   background: #000; color: #fff; border: none; border-radius: 6px;
   font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.06em;
   font-family: Arial, sans-serif;
  }
  .print-btn:hover { background: #333; }

  .outer-card { border: 1px solid #aaa; border-radius: 4px; padding: 12px; margin-bottom: 10px; }

  .header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .logo-left { width: 80px; flex-shrink: 0; }
  .logo-left img, .logo-right img { width: 100%; height: auto; object-fit: contain; }
  .logo-right { width: 110px; flex-shrink: 0; text-align: center; }
  .header-fields { flex: 1; display: flex; flex-direction: column; gap: 6px; }

  .field-box {
   border: 1px solid #000; border-radius: 18px; padding: 5px 12px;
   position: relative; min-height: 42px; display: flex; align-items: flex-end;
  }
  .field-lbl { position: absolute; top: 4px; left: 12px; font-size: 8.5px; font-weight: 700; color: #555; text-transform: uppercase; }
  .field-lbl-r { position: absolute; top: 4px; right: 72px; font-size: 8.5px; font-weight: 700; color: #555; text-transform: uppercase; }
  .field-val { font-size: 11px; font-weight: 600; padding: 0 4px; }
  .field-date { position: absolute; bottom: 5px; right: 12px; font-size: 11px; font-family: monospace; }

  .lr-fallback { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .lr-fallback .lrt { font-size: 18px; font-weight: 900; line-height: 1; text-align: center; }
  .lr-fallback .lrs { font-size: 9px; color: #555; letter-spacing: 0.1em; }

  .thick-hr { border: none; border-top: 4px solid #000; margin: 8px 0; }

  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
  .meta-box {
   border: 1px solid #000; border-radius: 35px; height: 70px;
   display: flex; flex-direction: column; align-items: center; justify-content: center;
   text-align: center; padding: 4px;
  }
  .meta-box .lbl { font-size: 7.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: #000; }
  .meta-box .vl { font-size: 20px; font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; }
  .meta-box .vs { font-size: 12px; font-weight: 700; margin-top: 2px; }
  .meta-box .vxl { font-size: 26px; font-weight: 900; font-style: italic; letter-spacing: -0.03em; }

  .table-wrap { border: 1px solid #000; border-radius: 12px; overflow: hidden; margin-bottom: 10px; }
  table.score-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .score-table th, .score-table td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; }
  .score-table thead tr { background: #f0f0f0; height: 30px; }
  .score-table th { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
  .th-label { width: 13%; } .th-pts { width: 9%; font-size: 8.5px; } .th-add { width: 10%; font-size: 8.5px; }

  .score-cell { height: 36px; font-size: 0; position: relative; }
  .score-cell .val   { font-size: 11px; font-weight: 600; display: block; line-height: 1.2; color: #555; }
  .score-cell .pts-lbl { font-size: 7.5px; color: #aaa; display: block; line-height: 1; }

  .cell-empty { height: 36px; background: #f8f8f8; }

  .score-cell.cell-hit {
   background: #000 !important;
   border: 2px solid #000 !important;
  }
  .score-cell.cell-hit .val {
   color: #fff !important;
   font-size: 13px !important;
   font-weight: 900 !important;
  }
  .score-cell.cell-hit .pts-lbl { color: #999 !important; }

  .score-cell.cell-miss {
   background: #fff5f5;
   position: relative;
  }
  .score-cell.cell-miss .miss-val { color: #ccc; font-size: 10px; }
  .score-cell.cell-miss .miss-x {
   position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
   font-size: 14px; color: #e53e3e; font-weight: 900; opacity: 0.85;
  }

  .row-label { font-size: 18px; font-weight: 900; background: #fafafa; height: 36px; }

  .td-puntos  { font-size: 18px; font-weight: 900; background: #fffde7; }
  .td-adicional{ font-size: 16px; font-weight: 700; background: #fffde7; }

  .res-row td { height: 26px; }
  .res-cell { font-size: 13px; font-weight: 900; }
  .res-hit { background: #e8f5e9; color: #1b5e20; }
  .res-miss { background: #fce4ec; color: #880e4f; }
  .res-empty { color: #ccc; font-size: 10px; }
  .res-lbl {
   font-size: 7.5px; font-weight: 900; background: #e8e8e8;
   text-transform: uppercase; letter-spacing: 0.06em;
  }

  .totals-row { display: flex; gap: 10px; }
  .total-box {
   flex: 1; border: 1px solid #000; border-radius: 14px; height: 52px;
   display: flex; align-items: center; justify-content: space-between; padding: 0 14px;
  }
  .total-lbl { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; }
  .total-val { display: flex; align-items: baseline; gap: 5px; }
  .total-num { font-size: 26px; font-weight: 900; }
  .total-word { font-size: 13px; font-weight: 300; color: #555; }
  .visto-box { width: 36%; border: 1px solid #000; border-radius: 14px; height: 52px; padding: 5px 10px; position: relative; flex-shrink: 0; }
  .visto-lbl { font-size: 7.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }

  .target-summary {
   margin: 8px 0; padding: 7px 12px; background: #f8f8f8; border-radius: 8px;
   font-size: 9px; display: flex; flex-direction: column; gap: 3px;
  }
  .target-summary p { margin: 0; color: #333; }

  .importante { border: 1px solid #000; padding: 10px 14px; display: flex; flex-direction: column; align-items: center; }
  .imp-title { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
  .imp-list { width: 100%; list-style: none; padding: 0 6px; margin-bottom: 8px; }
  .imp-list li { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; padding-left: 10px; position: relative; }
  .imp-list li::before { content: '•'; position: absolute; left: 0; }
  .imp-banner { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; background: #000; color: #fff; padding: 4px 18px; text-align: center; margin-bottom: 4px; width: 90%; }
  .imp-banner.narrow { width: 70%; }

  .foot { text-align: center; font-size: 7.5px; color: #aaa; margin-top: 8px; font-style: italic; }

  .legend { display: flex; gap: 14px; justify-content: center; margin: 7px 0; font-size: 8.5px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 5px; }
  .legend-box { width: 14px; height: 14px; border: 1px solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; }
  .legend-box.lhit { background: #000; color: #fff; }
  .legend-box.lmiss { background: #fff5f5; color: #e53e3e; font-size: 11px; }
 </style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()"> Imprimir / Guardar PDF</button>

<div class="a4-page">
<div class="outer-card">

 <!-- HEADER -->
 <div class="header">
  <div class="logo-left">
   <img src="/logo.svg" alt="Club Paraguayo de Tiro"
      onerror="this.src='/images/logo-club.png'; this.onerror=function(){this.style.display='none'; document.getElementById('logo-fallback-svg').style.display='block';};" />
   <svg id="logo-fallback-svg" style="display:none;" viewBox="0 0 80 80" width="80" height="80">
    <circle cx="40" cy="40" r="37" fill="none" stroke="#000" stroke-width="2"/>
    <circle cx="40" cy="40" r="27" fill="none" stroke="#000" stroke-width="1.5"/>
    <text x="40" y="18" text-anchor="middle" font-size="5.5" font-weight="bold">CLUB PARAGUAYO</text>
    <text x="40" y="26" text-anchor="middle" font-size="5">L.P.B.C.</text>
    <line x1="40" y1="30" x2="40" y2="58" stroke="#000" stroke-width="2.5"/>
    <line x1="26" y1="44" x2="54" y2="44" stroke="#000" stroke-width="2.5"/>
    <circle cx="40" cy="44" r="7" fill="none" stroke="#000" stroke-width="1.5"/>
    <circle cx="40" cy="44" r="2.5" fill="#000"/>
    <text x="40" y="72" text-anchor="middle" font-size="5" font-weight="bold">N.C.</text>
   </svg>
  </div>

  <div class="header-fields">
   <div class="field-box">
    <span class="field-lbl">Evento</span>
    <span class="field-lbl-r">Fecha</span>
    <div style="display:flex;justify-content:space-between;width:100%;align-items:flex-end;">
     <span class="field-val">${event.name}</span>
     <span class="field-date">${formatDate(event.date)}</span>
    </div>
   </div>
   <div class="field-box" style="min-height:36px;">
    <span class="field-lbl">Participante</span>
    <span class="field-val">
     #${participant.competitorNumber} — ${participant.name} 
     ${participant.tanda ? ` (Tanda ${participant.tanda} · Sector ${participant.sector} · Puesto ${participant.spot})` : ''}
    </span>
   </div>
  </div>

  <div class="logo-right">
   <img src="/long-range.svg" alt="Long Range"
      onerror="this.src='/images/logo-long-range.png'; this.onerror=function(){this.style.display='none'; document.getElementById('lr-fallback-svg').style.display='flex';};" />
   <div id="lr-fallback-svg" class="lr-fallback" style="display:none;">
    <svg viewBox="0 0 40 18" width="34" height="14" style="margin-bottom:2px;">
     <rect x="0" y="6" width="27" height="4" fill="#000" rx="1"/>
     <rect x="7" y="3" width="12" height="10" fill="#000" rx="1"/>
     <rect x="25" y="7" width="10" height="2" fill="#000" rx="1"/>
     <rect x="3" y="10" width="8" height="6" fill="#000" rx="1"/>
    </svg>
    <div class="lrt">LONG<br>RANGE</div>
    <div class="lrs">.22 LR</div>
   </div>
  </div>
 </div>

 <hr class="thick-hr" />

 <!-- META BLOCKS (OVALOS: ORDEN, MODALIDAD, CALIBRE, CATEGORIA) -->
 <div class="meta-grid">
  <div class="meta-box">
   <span class="lbl">ORDEN</span>
   <span class="vl" style="font-size:12px;font-weight:900;margin-top:4px;text-transform:uppercase;">SERIE ${series.seriesNumber}</span>
  </div>
  <div class="meta-box">
   <span class="lbl">MODALIDAD</span>
   <img src="/modalidad.svg" alt="Long Range" style="height:44px;width:auto;object-fit:contain;margin-top:2px;" />
  </div>
  <div class="meta-box">
   <span class="lbl">CALIBRE</span>
   <img src="/22lr.svg" alt=".22 LR" style="height:36px;width:auto;object-fit:contain;margin-top:4px;" />
  </div>
  <div class="meta-box">
   <span class="lbl" style="margin-bottom:8px;">CATEGORIA</span>
   <div style="height:14px;width:100%;"></div>
  </div>
 </div>

 <!-- LEYENDA -->
 <div class="legend no-print">
  <div class="legend-item"><div class="legend-box lhit">#</div><span>Valor logrado (impacto)</span></div>
  <div class="legend-item"><div class="legend-box lmiss">X</div><span>Fallo en ese disparo</span></div>
  <div class="legend-item" style="font-size:8.5px;color:#555;">Los demás son valores de referencia</div>
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
     <th class="th-pts">Puntos</th>
     <th class="th-add">Adicional</th>
    </tr>
   </thead>
   <tbody>

    <!-- ROW 15" — columnas 1 a 10 -->
    <tr>
     <td class="row-label">15"</td>
     ${vals15.map((v, i) => {
      const colN = i + 1;
      return renderScoreCell(colN, v, hit15?.shotNumber, miss15);
     }).join('')}
     <td class="td-puntos" rowspan="3">${mainPts || '—'}</td>
     <td class="td-adicional" rowspan="3">${addPts}</td>
    </tr>

    <!-- ROW 10" — columna 1 vacía, columnas 2 a 10 -->
    <tr>
     <td class="row-label">10"</td>
     <td class="cell-empty"></td>
     ${vals10.map((v, i) => {
      const colN = i + 2;
      return renderScoreCell(colN, v, hit10?.shotNumber, miss10);
     }).join('')}
     ${ vals10.length < 9 ? Array.from({ length: 9 - vals10.length }, () => '<td class="cell-empty"></td>').join('') : '' }
    </tr>

    <!-- ROW 5" — columnas 1-2 vacías, columnas 3 a 10 -->
    <tr>
     <td class="row-label">5"</td>
     <td class="cell-empty"></td>
     <td class="cell-empty"></td>
     ${vals5.map((v, i) => {
      const colN = i + 3;
      return renderScoreCell(colN, v, hit5?.shotNumber, miss5);
     }).join('')}
     ${ vals5.length < 8 ? Array.from({ length: 8 - vals5.length }, () => '<td class="cell-empty"></td>').join('') : '' }
    </tr>

    <!-- ROW RESULTADO: O/X por cada disparo -->
    <tr class="res-row">
     <td class="res-lbl">Resultado</td>
     ${resultRow}
     <td colspan="2" style="font-size:9.5px;font-weight:700;background:#fffde7;text-align:center;">
      Total: <strong style="font-size:12px;">${total}</strong> / 67 pts
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
  ${addShots.length > 0 ? `<p><strong>Disparos no realizados (Adicionales):</strong> ${addShots.length} disparos sobrantes — ${addPts} pts</p>` : ''}
 </div>

 <!-- TOTAL GENERAL -->
 <div class="totals-row">
  <div class="total-box">
   <span class="total-lbl">Total General</span>
   <div class="total-val">
    <span class="total-num">${total}</span>
    <span class="total-word">puntos</span>
   </div>
  </div>
  <div class="visto-box">
   <span class="visto-lbl">Visto Por (Fiscal)</span>
  </div>
 </div>

</div><!-- /outer-card -->

<!-- IMPORTANTE -->
<div class="importante">
 <h2 class="imp-title">Importante</h2>
 <ul class="imp-list">
  <li>Tiro correcto marcar con "O"</li>
  <li>Tiro errado marcar con "X"</li>
  <li>Al término de la prueba sumar los puntos</li>
  <li>Es obligatoria la firma del fiscal después de cada serie y del tirador al final de la prueba</li>
 </ul>
 <div class="imp-banner">En la línea de tiro es obligatorio el uso de lentes y tapa oído</div>
 <div class="imp-banner narrow">La seguridad es un hábito, ¡Practíquela!</div>
</div>

<div class="foot">
 Generado automáticamente por CPTP .22 LR Scoring App
 · ${new Date().toLocaleDateString('es-AR')} · ${event.name} · Serie ${series.seriesNumber}
</div>

</div><!-- /a4-page -->
</body>
</html>`;

 const win = window.open('', '_blank');
 if (!win) { alert('Habilitá las ventanas emergentes para generar la planilla.'); return; }
 win.document.write(html);
 win.document.close();
}

export function printEventCards(event: ShootingEvent, participants: Participant[], seriesList: Series[]): void {
 const sorted = [...seriesList].sort((a, b) => a.seriesNumber - b.seriesNumber);
 for (const s of sorted) {
  const p = participants.find((x) => x.id === s.participantId);
  if (p) {
   printSeriesCard(event, p, s);
  }
 }
}

export function printRankingCard(event: ShootingEvent, rankings: { participant: Participant, totalScore: number }[]): void {
 const year = new Date(event.date + 'T12:00:00').getFullYear();
 
 const rowsHtml = rankings.map((r, i) => {
  const pos = i + 1;
  const p = r.participant;
  const isTop3 = pos <= 3;
  const posHtml = isTop3 
   ? `<div class="pos-badge top-${pos}">${pos}</div>`
   : `<div class="pos-number">${pos}</div>`;
   
  const laneLabel = p.tanda ? `T${p.tanda} · Sector ${p.sector} · Puesto ${p.spot}` : 'Sin posición';

  return `
   <tr class="rank-row">
    <td class="td-pos">${posHtml}</td>
    <td class="td-name">
     <div class="name-text">${p.name.toUpperCase()}</div>
     <div class="sub-text">COMPETIDOR #${p.competitorNumber} · ${laneLabel}</div>
    </td>
    <td class="td-score">
     <div class="score-val">${r.totalScore}</div>
    </td>
   </tr>`;
 }).join('');

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
   background: #080c14;
   color: #ffffff;
   padding: 0;
   margin: 0;
   min-height: 297mm;
   position: relative;
  }

  .a4-page {
   width: 210mm;
   min-height: 297mm;
   margin: 0 auto;
   background: #080c14;
   padding: 24px 28px 24px 52px;
   position: relative;
   overflow: hidden;
   box-shadow: 0 4px 32px rgba(0,0,0,0.5);
  }

  @media print {
   body { background: #080c14; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
   .a4-page { box-shadow: none; margin: 0; width: 100%; min-height: 100vh; }
   .no-print { display: none !important; }
  }

  .print-btn {
   display: block; margin: 15px auto 10px; padding: 10px 32px;
   background: #ef4444; color: #fff; border: 2px solid #ef4444; border-radius: 8px;
   font-size: 14px; font-weight: 900; cursor: pointer; letter-spacing: 0.08em;
   text-transform: uppercase;
   font-family: Arial, sans-serif;
  }
  .print-btn:hover { background: #d52b1e; }

  .left-flag-stripe {
   position: absolute;
   left: 0;
   top: 0;
   bottom: 0;
   width: 24px;
   display: flex;
   height: 100%;
   z-index: 10;
  }
  .flag-red  { width: 8px; background: #d52b1e; height: 100%; }
  .flag-white { width: 8px; background: #ffffff; height: 100%; }
  .flag-blue { width: 8px; background: #0038a8; height: 100%; }

  .header-container {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 16px;
   margin-bottom: 12px;
  }

  .logo-box {
   width: 90px;
   height: 90px;
   flex-shrink: 0;
   display: flex;
   align-items: center;
   justify-content: center;
  }
  .logo-box img {
   width: 100%;
   height: auto;
   object-fit: contain;
  }

  .title-box {
   flex: 1;
   text-align: center;
   display: flex;
   flex-direction: column;
   align-items: center;
   justify-content: center;
  }
  .title-sub {
   font-size: 13px;
   color: #94a3b8;
   font-weight: 900;
   letter-spacing: 0.18em;
   margin-bottom: 2px;
  }
  .title-main {
   font-size: 38px;
   color: #ef4444;
   font-weight: 900;
   line-height: 0.9;
   letter-spacing: 0.02em;
   margin: 4px 0;
   text-transform: uppercase;
   text-shadow: 2px 2px 0px #000;
  }
  .title-event {
   font-size: 13px;
   color: #60a5fa;
   font-weight: 700;
   font-style: italic;
   letter-spacing: 0.06em;
   margin-top: 4px;
  }

  .sub-banner {
   background: #111827;
   border: 1px solid #1f2937;
   text-align: center;
   padding: 8px;
   font-size: 11px;
   font-weight: 900;
   letter-spacing: 0.12em;
   text-transform: uppercase;
   margin-bottom: 20px;
   border-radius: 4px;
   color: #e2e8f0;
  }

  .ranking-table {
   width: 100%;
   border-collapse: separate;
   border-spacing: 0 8px;
   margin-bottom: 20px;
  }

  .ranking-table th {
   font-size: 10px;
   color: #64748b;
   font-weight: 900;
   text-transform: uppercase;
   letter-spacing: 0.08em;
   padding: 6px 12px;
   text-align: left;
  }
  .ranking-table th.th-pos { text-align: center; width: 14%; }
  .ranking-table th.th-score { text-align: center; width: 22%; }

  .rank-row {
   background: #111827;
   border-radius: 8px;
  }
  
  .rank-row td {
   padding: 10px 14px;
   vertical-align: middle;
   border-top: 1px solid #1f2937;
   border-bottom: 1px solid #1f2937;
  }
  .rank-row td:first-child {
   border-left: 1px solid #1f2937;
   border-top-left-radius: 8px;
   border-bottom-left-radius: 8px;
   text-align: center;
  }
  .rank-row td:last-child {
   border-right: 1px solid #1f2937;
   border-top-right-radius: 8px;
   border-bottom-right-radius: 8px;
   padding: 0;
   text-align: center;
  }

  .pos-badge {
   width: 32px;
   height: 32px;
   border-radius: 6px;
   display: inline-flex;
   align-items: center;
   justify-content: center;
   color: #ffffff;
   font-weight: 900;
   font-size: 16px;
   box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .pos-badge.top-1 { background: #ef4444; border: 1px solid #ff6b6b; }
  .pos-badge.top-2 { background: #f97316; border: 1px solid #ff9d5c; }
  .pos-badge.top-3 { background: #f59e0b; border: 1px solid #ffc252; }

  .pos-number {
   font-size: 14px;
   font-weight: 900;
   color: #94a3b8;
  }

  .td-name {
   text-align: left;
  }
  .name-text {
   font-size: 12.5px;
   font-weight: 900;
   color: #ffffff;
   letter-spacing: 0.02em;
  }
  .sub-text {
   font-size: 8px;
   color: #4b5563;
   font-weight: 700;
   margin-top: 3px;
   letter-spacing: 0.04em;
  }

  .td-score {
   background: #ef4444 !important;
   border-top-right-radius: 8px;
   border-bottom-right-radius: 8px;
   height: 48px;
  }
  .score-val {
   font-size: 18px;
   font-weight: 900;
   color: #ffffff;
   text-shadow: 1px 1px 2px rgba(0,0,0,0.4);
  }

  .footer-note {
   text-align: center;
   font-size: 8px;
   color: #374151;
   margin-top: 24px;
   font-style: italic;
   border-top: 1px solid #111827;
   padding-top: 12px;
  }
 </style>
</head>
<body>

<div class="no-print" style="display:flex;gap:12px;justify-content:center;margin:15px auto 10px;width:210mm;max-width:100%;padding:0 10px;">
 <button class="print-btn" onclick="window.print()" style="margin:0;flex:1;"> Imprimir / PDF</button>
 <button class="print-btn" onclick="if(window.opener &amp;&amp; window.opener.downloadElementAsPng){ window.opener.downloadElementAsPng(document.querySelector('.a4-page'), 'ranking-' + '${event.name.replace(/\s+/g, '-').toLowerCase()}' + '.png'); } else { alert('Error: Ventana principal no accesible.'); }" style="margin:0;flex:1;background:#22c55e;border-color:#22c55e;"> Guardar Imagen (PNG)</button>
</div>

<div class="a4-page">
 <div class="left-flag-stripe">
  <div class="flag-red"></div>
  <div class="flag-white"></div>
  <div class="flag-blue"></div>
 </div>

 <div class="header-container">
  <div class="logo-box">
   <img src="/logo.svg" alt="Club Logo"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
   <svg style="display:none;" viewBox="0 0 80 80" width="80" height="80">
    <circle cx="40" cy="40" r="37" fill="none" stroke="#fff" stroke-width="2"/>
    <text x="40" y="44" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">CPTP</text>
   </svg>
  </div>

  <div class="title-box">
   <div class="title-sub">• TABLA DE POSICIONES •</div>
   <div class="title-main">RESULTADOS</div>
   <div class="title-event">${event.name.toUpperCase()} — ${year}</div>
  </div>

  <div class="logo-box">
   <img src="/long-range.svg" alt="Long Range Logo"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
   <svg style="display:none;" viewBox="0 0 40 18" width="40" height="18">
    <text x="20" y="12" text-anchor="middle" font-size="6" fill="#fff" font-weight="bold">.22 LR</text>
   </svg>
  </div>
 </div>

 <div class="sub-banner">
  ${event.location ? event.location : 'CAMPEONATO CPTP .22 LR'} · ${formatDate(event.date)}
 </div>

 <table class="ranking-table">
  <thead>
   <tr>
    <th class="th-pos">POS</th>
    <th>COMPETIDOR / PUESTO DE TIRO</th>
    <th class="th-score">GENERAL</th>
   </tr>
  </thead>
  <tbody>
   ${rowsHtml}
  </tbody>
 </table>

 <div class="footer-note">
  Generado automáticamente por CPTP .22 LR Scoring App
  · ${new Date().toLocaleDateString('es-AR')} · ${event.name}
 </div>

</div>

</body>
</html>`;

 const win = window.open('', '_blank');
 if (!win) { alert('Habilitá las ventanas emergentes para generar la tabla.'); return; }
 win.document.write(html);
 win.document.close();
}
