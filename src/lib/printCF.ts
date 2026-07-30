/**
 * CPTP Fuego Central (.308 / .223) — Planilla oficial imprimible
 *
 * UNA SOLA SERIE por competidor. Tabla de 12, 11 y 10 disparos.
 * Layout: una columna a ancho completo en hoja A4 landscape.
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

function renderScoreCell(colShotNum: number, cellValue: number, hitShotNum: number | undefined, missNums: Set<number>): string {
  const isHit = hitShotNum === colShotNum;
  const isMiss = missNums.has(colShotNum);
  if (isHit) return `<td class="score-cell cell-hit" title="Impactado aquí — ${cellValue} pts"><span class="val">${cellValue}</span><span class="pts-lbl">pts</span></td>`;
  if (isMiss) return `<td class="score-cell cell-miss" title="Fallo en disparo ${colShotNum}"><span class="val miss-val">${cellValue}</span><span class="miss-x">✕</span></td>`;
  return `<td class="score-cell"><span class="val">${cellValue}</span><span class="pts-lbl">pts</span></td>`;
}

function getCFPrintStyles(): string {
  return `
     @page { size: A4 landscape; margin-top: 18mm; margin-bottom: 5mm; margin-left: 5mm; margin-right: 5mm; }
   *, *::before, *::after { box-sizing: border-box !important; margin: 0; padding: 0; }

   body {
    font-family: Arial, Helvetica, sans-serif;
    background: #f0f0f0;
    color: #000;
    padding: 0;
    margin: 0;
   }

   .a4-landscape-page {
    width: 277mm;
    min-height: 175mm;
    margin: 10mm auto;
    background: #fff;
    padding: 8px 14px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    display: flex;
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
      width: 100% !important;
      height: 98vh !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      break-after: page !important;
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

   /* Una sola columna a ancho completo */
   .series-column {
    width: 100% !important;
    max-width: 100% !important;
    flex: none !important;
    border: 1.5px solid #000 !important;
    border-radius: 6px !important;
    padding: 4px 10px !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-start !important;
    background: #fff !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
   }

   .header { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
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

   .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 3px; }
   .meta-box {
    border: 1.5px solid #000; border-radius: 18px; height: 40px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 2px;
   }
   .meta-box .lbl { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #000; }
   .meta-box .vl { font-size: 13px; font-weight: 900; line-height: 1.05; }
   .meta-box .vs { font-size: 12px; font-weight: 700; margin-top: 0.5px; }

   .table-wrap { border: 1.5px solid #000; border-radius: 6px; overflow: hidden; margin-bottom: 4px; }
   table.score-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
   .score-table th, .score-table td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; }
   .score-table thead tr { background: #f0f0f0; height: 20px; }
   .score-table th { font-size: 9.5px; font-weight: 900; text-transform: uppercase; }
   .th-label { width: 10%; } .th-pts { width: 8%; font-size: 8.5px; } .th-add { width: 9%; font-size: 8.5px; }

   .score-cell { height: 26px; font-size: 0; position: relative; }
   .score-cell .val   { font-size: 12px; font-weight: 600; display: block; line-height: 1.05; color: #555; }
   .score-cell .pts-lbl { font-size: 7.5px; color: #aaa; display: block; line-height: 0.85; }
   .cell-empty { height: 26px; background: #f8f8f8; }

   .score-cell.cell-hit { background: #000 !important; border: 1.5px solid #000 !important; }
   .score-cell.cell-hit .val { color: #fff !important; font-size: 13px !important; font-weight: 900 !important; }
   .score-cell.cell-hit .pts-lbl { color: #888 !important; }
   .score-cell.cell-miss { background: #fff5f5; position: relative; }
   .score-cell.cell-miss .miss-val { color: #ccc; font-size: 10px; }
   .score-cell.cell-miss .miss-x {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 13px; color: #e53e3e; font-weight: 900; opacity: 0.85;
   }

   .row-label { font-size: 15px; font-weight: 900; background: #fafafa; height: 26px; }
   .td-puntos  { font-size: 15px; font-weight: 900; background: #fffde7; }
   .td-adicional{ font-size: 14px; font-weight: 700; background: #fffde7; }

   .totals-row { display: flex; gap: 6px; margin-top: 3px; }
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
    margin: 2px 0; padding: 3px 6px; background: #f8f8f8; border-radius: 4px;
    font-size: 8.5px; display: flex; flex-direction: column; gap: 1px;
   }
   .target-summary p { margin: 0; color: #333; line-height: 1.15; }

   .importante { border: 1.5px solid #000; padding: 4px 8px; display: flex; flex-direction: column; align-items: center; margin-top: 3px; }
   .imp-title { font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
   .imp-list { width: 100%; list-style: none; padding: 0 2px; margin-bottom: 2px; }
   .imp-list li { font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 1px; padding-left: 8px; position: relative; }
   .imp-list li::before { content: '•'; position: absolute; left: 0; }
  `;
}

function getCFSeriesColumnHtml(event: ShootingEvent, participant: Participant, series: Series | undefined, modality: string): string {
  const shots = series?.shots ?? [];

  const hitGrande  = shots.find((s) => s.targetType === 'grande' && s.hit);
  const hitMediano = shots.find((s) => s.targetType === 'mediano' && s.hit);
  const hitPequeno = shots.find((s) => s.targetType === 'pequeño' && s.hit);
  const addShots   = shots.filter((s) => s.targetType === 'additional');

  const missGrande  = new Set(shots.filter((s) => s.targetType === 'grande'  && !s.hit).map((s) => s.shotNumber));
  const missMediano = new Set(shots.filter((s) => s.targetType === 'mediano' && !s.hit).map((s) => s.shotNumber));
  const missPequeno = new Set(shots.filter((s) => s.targetType === 'pequeño' && !s.hit).map((s) => s.shotNumber));

  const ptsGrande  = hitGrande?.value ?? 0;
  const ptsMediano = hitMediano?.value ?? 0;
  const ptsPequeno = hitPequeno?.value ?? 0;
  const addPts     = addShots.reduce((s, sh) => s + sh.value, 0);
  const mainPts    = ptsGrande + ptsMediano + ptsPequeno;
  const total      = series ? (mainPts + addPts) : 0;
  const maxScore   = series?.bonusActive ? 96 : 87;

  const valsGrande  = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const valsMediano = [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4];
  const valsPequeno = [42, 38, 34, 30, 26, 22, 18, 14, 11, 7];

  const targetSummary = (label: string, hitShot: Shot | undefined, missSet: Set<number>): string => {
    if (!series) return `<span style="color:#aaa;">${label}: no impactado (Firma Fiscal)</span>`;
    if (!hitShot) return `<span style="color:#888;">${label}: no impactado (${missSet.size} fallo${missSet.size !== 1 ? 's' : ''})</span>`;
    return `<strong>${label}:</strong> ${hitShot.value} pts (disparo ${hitShot.shotNumber})${missSet.size > 0 ? ` — ${missSet.size} fallo${missSet.size !== 1 ? 's' : ''} previo${missSet.size !== 1 ? 's' : ''}` : ''}`;
  };

  return `
  <div class="series-column">
    <div class="header">
     <div class="logo-left">
      <img src="/logo-cptp.svg" alt="Club Paraguayo de Tiro" onerror="this.style.display='none';" />
     </div>
     <div class="header-fields">
      <div class="field-box">
       <span class="field-lbl">Evento</span>
       <span class="field-lbl-r">Fecha</span>
       <div style="display:flex;justify-content:space-between;width:100%;align-items:flex-end;">
        <span class="field-val" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${event.name}${event.championshipDate ? ` · ${event.championshipDate}` : ''}</span>
        <span class="field-date">${formatDate(event.date)}</span>
       </div>
      </div>
      <div class="field-box" style="min-height:30px;">
       <span class="field-lbl">Participante</span>
       <span class="field-val">${participant.name}${participant.tanda ? ` (Turno ${participant.tanda})` : ''}</span>
      </div>
     </div>
     <div class="logo-right">
      <img src="/logo-long-range.svg" alt="Long Range" onerror="this.style.display='none';" />
     </div>
    </div>

    <hr class="thick-hr" />

    <div class="meta-grid">
     <div class="meta-box"><span class="lbl">TURNO</span><span class="vl" style="font-size:11px;font-weight:900;">${participant.tanda || '—'}</span></div>
     <div class="meta-box"><span class="lbl">MODALIDAD</span><img src="/modalidad.svg" alt="Long Range" style="height:24px;width:auto;object-fit:contain;" /></div>
     <div class="meta-box"><span class="lbl">CALIBRE</span><div style="font-size:16px;font-weight:900;font-family:'Rajdhani',sans-serif;margin-top:2px;">${modality}</div></div>
     <div class="meta-box"><span class="lbl">CATEGORIA</span><div class="vs" style="font-size:12px;font-weight:900;text-transform:uppercase;">${participant.category || '—'}</div></div>
    </div>

    <div class="table-wrap">
     <table class="score-table">
      <colgroup>
       <col class="th-label">
       ${Array.from({ length: 12 }, () => '<col>').join('')}
       <col class="th-pts" style="width: 7%;">
       <col class="th-add" style="width: 9%;">
       <col class="th-pts" style="width: 7%;">
      </colgroup>
      <thead><tr>
       <th class="th-label">Disparos</th>
       ${Array.from({ length: 12 }, (_, i) => `<th>${i + 1}</th>`).join('')}
       <th class="th-pts">Bonus</th>
       <th class="th-add">Adicional</th>
       <th class="th-pts">Puntos</th>
      </tr></thead>
      <tbody>
       <tr>
        <td class="row-label" style="font-size:12px;">Grande</td>
        ${valsGrande.map((v, i) => renderScoreCell(i + 1, v, series ? hitGrande?.shotNumber : undefined, missGrande)).join('')}
        <td class="td-puntos" rowspan="3" style="font-size:10px;font-weight:700;line-height:1.4;">
          ${series ? `<div style="border-radius:3px;margin-bottom:2px;${series.bonusActive ? 'background:#000;color:#fff;' : ''}">SI</div><div style="border-radius:3px;${!series.bonusActive ? 'background:#000;color:#fff;' : ''}">NO</div>` : '<div style="margin-bottom:2px;">SI</div><div>NO</div>'}
        </td>
        <td class="td-adicional" rowspan="3">${series ? addPts : ''}</td>
        <td class="td-puntos" rowspan="3">${series ? total : ''}</td>
       </tr>
       <tr>
        <td class="row-label" style="font-size:12px;">Mediano</td>
        <td class="cell-empty"></td>
        ${valsMediano.map((v, i) => renderScoreCell(i + 2, v, series ? hitMediano?.shotNumber : undefined, missMediano)).join('')}
        ${Array.from({ length: 12 - valsMediano.length - 1 }, () => '<td class="cell-empty"></td>').join('')}
       </tr>
       <tr>
        <td class="row-label" style="font-size:12px;">Pequeño</td>
        <td class="cell-empty"></td>
        <td class="cell-empty"></td>
        ${valsPequeno.map((v, i) => renderScoreCell(i + 3, v, series ? hitPequeno?.shotNumber : undefined, missPequeno)).join('')}
        ${Array.from({ length: 12 - valsPequeno.length - 2 }, () => '<td class="cell-empty"></td>').join('')}
       </tr>
       <tr class="total-footer-row">
        <td colspan="13" style="text-align:right;font-weight:bold;font-size:8px;padding-right:8px;background:#fafafa;border-right:1px solid #000;">TOTAL:</td>
        <td colspan="2" style="font-size:12px;font-weight:900;background:${series ? '#000' : '#fff'};color:${series ? '#fff' : '#000'};text-align:center;border:2.5px solid #000;padding:4px;">
         ${series ? `${total} / ${maxScore}` : `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / ${maxScore}`}
        </td>
       </tr>
      </tbody>
     </table>
    </div>

    <div class="target-summary">
     <p>${targetSummary('Grande', hitGrande, missGrande)}</p>
     <p>${targetSummary('Mediano', hitMediano, missMediano)}</p>
     <p>${targetSummary('Pequeño', hitPequeno, missPequeno)}</p>
     ${series && addShots.length > 0 ? `<p><strong>Adicionales:</strong> ${addShots.length} disparos - ${addPts} pts</p>` : series ? '' : '<p style="color:#aaa;">Adicionales: firma de fiscal al culminar</p>'}
    </div>

    <div class="totals-row">
     <div class="total-box">
      <span class="total-lbl">Total</span>
      <div class="total-val">
       <span class="total-num">${total || '—'}</span>
       <span class="total-word">pts</span>
      </div>
     </div>
     <div class="visto-box"><span class="visto-lbl">Firma Fiscal</span></div>
    </div>

    <div class="importante" style="align-items:flex-start;padding:4px 8px;">
     <h2 class="imp-title" style="align-self:center;">IMPORTANTE</h2>
     <ul class="imp-list" style="font-size:7px;font-weight:700;">
      <li>TIRO "BONUS" MARCAR CASILLA "SI"</li>
      <li>TIRO CORRECTO MARCAR CON "O"</li>
      <li>TIRO ERRADO MARCAR CON "X"</li>
      <li>AL TERMINO DE LA PRUEBA SUMAR LOS PUNTOS</li>
      <li>ES OBLIGATORIA LA FIRMA DEL FISCAL DESPUES DE CADA SERIE Y DEL TIRADOR AL FINAL</li>
     </ul>
    </div>
  </div>
  `;
}

/** Imprime la planilla CF para un tirador individual */
export async function printCFSeriesCard(event: ShootingEvent, participant: Participant, currentSeries: Series): Promise<void> {
  let modality = event.modality || '.308';
  if (!event.modality && event.name) {
    if (event.name.includes('.308')) modality = '.308';
    else if (event.name.includes('.223')) modality = '.223';
  }

  const participantSeries = (await db.series
    .where('participantId')
    .equals(participant.id!)
    .filter((item: any) => !item.is_deleted).toArray())
    .filter((s) => s.eventId === event.id);

  const s1 = participantSeries.find((s) => s.seriesNumber === 1);
  const colHtml = getCFSeriesColumnHtml(event, participant, s1, modality);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Planilla CF — ${participant.name}</title>
 <style>${getCFPrintStyles()}</style>
</head>
<body>
 <button class="print-btn no-print" onclick="window.print()">Imprimir Planilla</button>
 <div class="a4-landscape-page">${colHtml}</div>
</body>
</html>`;

  openPrintModal(html, `Planilla CF — ${participant.name}`);
}

/** Imprime todas las planillas CF del evento */
export function printCFEventCards(event: ShootingEvent, participants: Participant[], seriesList: Series[]): void {
  let modality = event.modality || '.308';
  if (!event.modality && event.name) {
    if (event.name.includes('.308')) modality = '.308';
    else if (event.name.includes('.223')) modality = '.223';
  }

  const pagesHtml = participants.map((p, idx) => {
    const s1 = seriesList.find((s) => s.participantId === p.id && s.seriesNumber === 1);
    const colHtml = getCFSeriesColumnHtml(event, p, s1, modality);
    const isLast = idx === participants.length - 1;
    const breakStyle = isLast ? '' : 'style="page-break-after: always; break-after: page;"';
    return `<div class="a4-landscape-page" ${breakStyle}>${colHtml}</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Todas las Planillas CF — ${event.name}</title>
 <style>${getCFPrintStyles()}</style>
</head>
<body>
 <button class="print-btn no-print" onclick="window.print()">Imprimir Todas las Planillas CF</button>
 ${pagesHtml}
</body>
</html>`;

  openPrintModal(html, `Todas las Planillas CF — ${event.name}`);
}

/** Imprime planilla CF vacía para llenado manual */
export function printCFBlankSheet(event: ShootingEvent): void {
  let modality = event.modality || '.308';
  if (!event.modality && event.name) {
    if (event.name.includes('.308')) modality = '.308';
    else if (event.name.includes('.223')) modality = '.223';
  }

  const dummyParticipant: Participant = {
    id: -1,
    eventId: event.id!,
    name: '________________________________',
    category: '______________',
    competitorNumber: 0,
    tanda: undefined,
    spot: undefined
  };

  const colHtml = getCFSeriesColumnHtml(event, dummyParticipant, undefined, modality);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8"/>
 <title>Planilla CF Vacía — ${event.name}</title>
 <style>${getCFPrintStyles()}</style>
</head>
<body>
 <button class="print-btn no-print" onclick="window.print()">Imprimir Planilla Vacía</button>
 <div class="a4-landscape-page">${colHtml}</div>
</body>
</html>`;

  openPrintModal(html, 'Planilla CF Vacía');
}
