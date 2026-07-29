import type { ShootingEvent } from './types';
import type { ChampionshipRankingRow } from './championship';
import { esc, showToast } from './modals';
import { openPrintModal } from './printModal';

export function exportChampionshipToExcel(
  year: number,
  modality: string,
  events: ShootingEvent[],
  rows: ChampionshipRankingRow[],
  sortedBy: string
): void {
  try {
    let csv = '\uFEFF'; 
    const headers = ['Posición', 'Tirador', 'Categoría'];
    events.forEach((e, idx) => {
      headers.push(`Evento ${idx + 1} (${e.championshipDate || e.name})`);
    });
    const targetColumns = Math.max(4, events.length);
    for (let i = events.length; i < targetColumns; i++) {
      headers.push(`Evento ${i + 1} (Pendiente)`);
    }
    headers.push('Base Firme (Mejores 2)');
    headers.push('Total (Mejores 3)');

    csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';') + '\n';

    rows.forEach((r, rankIdx) => {
      const line = [
        String(rankIdx + 1),
        r.competitorName,
        r.category
      ];

      events.forEach(e => {
        const item = r.events[e.id!];
        if (!item) {
          line.push('-');
        } else {
          let val = String(item.score);
          if (item.status === 'dq') val = 'DQ';
          
          if (item.isBaseFirme) {
            line.push(`${val} (Base Firme)`);
          } else if (item.isAtRisk) {
            line.push(`${val} (En Riesgo)`);
          } else if (item.isTaken) {
            line.push(`${val} (Top 3)`);
          } else {
            line.push(`${val} (Descarte)`);
          }
        }
      });

      const targetColumns = Math.max(4, events.length);
      for (let i = events.length; i < targetColumns; i++) {
        line.push('-');
      }

      line.push(String(r.baseFirme));
      line.push(String(r.totalActual));
      csv += line.map(c => `"${c.replace(/"/g, '""')}"`).join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Campeonato_${modality.replace(/[\.\s]/g, '')}_${year}_OrdenadoPor_${sortedBy}.csv`;
    link.click();
    showToast('Planilla de campeonato exportada con éxito.', 'success');
  } catch (err) {
    console.error('[Excel] Error al exportar:', err);
    showToast('No se pudo exportar a Excel.', 'error');
  }
}

export function printChampionshipPreview(
  year: number,
  modality: string,
  events: ShootingEvent[],
  rows: ChampionshipRankingRow[],
  sortedBy: string
): void {
  const tableHeadersHtml = events.map((e, idx) => `
    <th style="border:1px solid #000000;padding:6px;text-align:center;font-size:10px;width:11%;">
      E${idx + 1}<br>
      <span style="font-size:8px;font-weight:normal;color:#333;">${esc(e.championshipDate || e.name)}</span>
    </th>
  `).join('');

  const targetColumns = Math.max(4, events.length);
  const emptyHeadersHtml = Array.from({ length: targetColumns - events.length }, (_, i) => `
    <th style="border:1px solid #000000;padding:6px;text-align:center;font-size:10px;color:#666;width:11%;">
      E${events.length + i + 1}<br>
      <span style="font-size:8px;font-weight:normal;">(Pendiente)</span>
    </th>
  `).join('');

  const isSortedByBase = sortedBy === 'baseFirme';

  const tableRowsHtml = rows.map((r, rankIdx) => {
    const pos = rankIdx + 1;
    const isTop6 = pos <= 6;
    
    // Top 6 styling for print
    let posStyle = 'font-weight:bold;font-size:11px;';
    if (pos === 1) posStyle = 'font-weight:bold;font-size:11px;background:#fbbf24;color:#000;';
    else if (pos === 2) posStyle = 'font-weight:bold;font-size:11px;background:#e2e8f0;color:#000;';
    else if (pos === 3) posStyle = 'font-weight:bold;font-size:11px;background:#f59e0b;color:#fff;';
    else if (isTop6) posStyle = 'font-weight:bold;font-size:11px;background:#e0f2fe;color:#0369a1;';
    
    const cellsHtml = events.map(e => {
      const item = r.events[e.id!];
      if (!item) return `<td style="border:1px solid #000000;padding:6px;text-align:center;background:#f2f2f2;color:#999;">-</td>`;
      
      let displayVal = String(item.score);
      if (item.status === 'dq') displayVal = 'DQ';

      let style = '';
      if (item.isBaseFirme) style = 'font-weight:bold;background:#dcfce7;color:#16a34a;';
      else if (item.isAtRisk) style = 'font-weight:bold;background:#fef9c3;color:#ca8a04;';
      else if (item.isTaken) style = 'font-weight:bold;background:#ffffff;color:#000000;';
      else style = 'color:#999999;background:#f2f2f2;text-decoration:line-through;';

      return `<td style="border:1px solid #000000;padding:6px;text-align:center;font-size:11px;${style}">${displayVal}</td>`;
    }).join('');

    const emptyCellsHtml = Array.from({ length: targetColumns - events.length }, () => `
      <td style="border:1px solid #000000;padding:6px;text-align:center;background:#f2f2f2;color:#999;">-</td>
    `).join('');

    const rowBg = isTop6 ? 'background:rgba(248,250,252,0.5);' : '';

    return `
      <tr style="${rowBg}">
        <td style="border:1px solid #000000;padding:6px;text-align:center;${posStyle}">${pos}</td>
        <td style="border:1px solid #000000;padding:6px;font-size:11px;font-weight:bold;">
          ${esc(r.competitorName.toUpperCase())}<br>
          <span style="font-size:8px;font-weight:normal;color:#555;">${esc(r.category)}</span>
        </td>
        ${cellsHtml}
        ${emptyCellsHtml}
        <td style="border:1px solid #000000;padding:6px;text-align:center;font-weight:bold;font-size:12px;${isSortedByBase ? 'background:#dcfce7;color:#16a34a;' : 'color:#555;'}">
          ${r.baseFirme}
        </td>
        <td style="border:1px solid #000000;padding:6px;text-align:center;font-weight:bold;font-size:13px;${!isSortedByBase ? 'background:#eff6ff;color:#0056b3;' : 'color:#555;'}">
          ${r.totalActual}
        </td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Campeonato Anual ${year}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 15mm; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; }
    .page { width: 100%; position: relative; padding-bottom: 30px; } /* Evita superposicion con footer */
    .layout-border-red { position: absolute; top: 0; left: 0; bottom: 0; width: 10px; background: #b7201c; }
    .layout-border-blue { position: absolute; top: 0; left: 10px; bottom: 0; width: 6px; background: #0056b3; }
    .content { padding-left: 28px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
    .title-main { font-size: 20px; font-weight: 900; color: #b7201c; margin: 0 0 4px; text-transform: uppercase; }
    .sub-title { font-size: 10px; font-weight: bold; color: #0056b3; letter-spacing: 0.1em; text-transform: uppercase; }
    .date-info { text-align: right; font-size: 10px; font-weight: bold; color: #333; }
    .year-txt { font-size: 24px; font-weight: bold; font-style: italic; color: #ccc; line-height: 0.8; }
    
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table.data-table th { background: #f2f2f2; font-size: 10px; font-weight: bold; padding: 6px; text-transform: uppercase; border: 1px solid #000; }
    table.data-table td { border: 1px solid #000; }
    
    .footer { position: fixed; bottom: 10mm; left: 28px; right: 0; border-top: 1px solid #ccc; padding-top: 8px; font-size: 8px; color: #666; display: flex; justify-content: space-between; font-weight: bold; background: #fff; }
  </style>
</head>
<body>
  <div class="page">
    <div class="layout-border-red"></div>
    <div class="layout-border-blue"></div>
    <div class="content">
      <header class="header">
        <div>
          <span class="sub-title">Club Paraguayo de Tiro de Long Range</span>
          <h1 class="title-main">RANKING CAMPEONATO GENERAL ANUAL - ${modality}</h1>
          <span style="font-size:11px;color:#333;font-weight:bold;">PLANILLA OFICIAL ACUMULADA (Orden: ${isSortedByBase ? 'BASE FIRME' : 'TOTAL'})</span>
        </div>
        <div class="date-info">
          <div class="year-txt">${year}</div>
          <div style="margin-top:4px;">Emisión: ${new Date().toLocaleDateString('es-AR')}</div>
        </div>
      </header>
      
      <div style="font-size:9px;color:#444;margin-bottom:10px;">
        <strong>Regla:</strong> Se toman los mejores 3 puntajes (del total de fechas). 
        <span style="background:#dcfce7;color:#15803d;padding:2px 4px;font-weight:bold;">Base Firme: Mejores 2</span> 
        <span style="background:#fef9c3;color:#a16207;padding:2px 4px;font-weight:bold;">En Riesgo: 3er Puntaje (Se descarta si en la última fecha saca algo mejor)</span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width:6%;text-align:center;">Pos</th>
            <th style="text-align:left;">Tirador / Categoría</th>
            ${tableHeadersHtml}
            ${emptyHeadersHtml}
            <th style="width:11%;text-align:center;${isSortedByBase ? 'background:#dcfce7;color:#16a34a;' : ''}">Base (Top 2)</th>
            <th style="width:11%;text-align:center;${!isSortedByBase ? 'background:#dbeafe;color:#0056b3;' : ''}">Total (Top 3)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  </div>
  <footer class="footer">
    <div>Planilla oficial del campeonato - Sujeta a fiscalización del Club CPTP</div>
    <div>CPTP Scoring v1.0</div>
  </footer>
</body>
</html>`;

  openPrintModal(html, `Campeonato General ${year}`);
}
