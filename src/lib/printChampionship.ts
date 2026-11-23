import type { ShootingEvent, Modality } from './types';
import type { ChampionshipRankingRow } from './championship';
import { esc, showToast } from './modals';
import { openPrintModal } from './printModal';
import { MODALITY_CONFIGS } from './modalityConfig';

/** Cantidad de posiciones que reciben premio. */
export const PRIZE_POSITIONS = 6;

export interface ChampionshipExportOptions {
  /** Si se indica, solo se incluyen las primeras N posiciones (ej: 6 premiados). */
  top?: number;
}

const SORT_LABELS: Record<string, string> = { baseFirme: 'Top 2', totalActual: 'Top 3', mejores4: 'Top Gun' };

/** Evita que Excel interprete como fórmula un texto que empieza con =, +, - o @. */
function safeCsvCell(value: string): string {
  return /^[=+\-@]./.test(value) ? `'${value}` : value;
}

export function exportChampionshipToExcel(
  year: number,
  modality: string,
  events: ShootingEvent[],
  rows: ChampionshipRankingRow[],
  sortedBy: string,
  options: ChampionshipExportOptions = {}
): void {
  try {
    const exportRows = options.top ? rows.slice(0, options.top) : rows;
    const modalityLabel = MODALITY_CONFIGS[modality as Modality]?.label || modality;
    let csv = '\uFEFF';
    csv += `"${safeCsvCell(`Campeonato General ${year} - ${modalityLabel}${options.top ? ` - Top ${options.top} (premiados)` : ''}`).replace(/"/g, '""')}"\n`;
    const headers = ['Posición', 'Tirador', 'Categoría'];
    events.forEach((e, idx) => {
      headers.push(`Evento ${idx + 1} (${e.championshipDate || e.name})`);
    });
    const targetColumns = Math.max(4, events.length);
    for (let i = events.length; i < targetColumns; i++) {
      headers.push(`Evento ${i + 1} (Pendiente)`);
    }
    headers.push('Top 2');
    headers.push('Top 3');
    headers.push('Top Gun');

    csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';') + '\n';

    exportRows.forEach((r, rankIdx) => {
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
          const val = String(item.score);

          if (item.status !== 'active') {
            line.push(item.status === 'dq' ? 'DQ' : 'DNS');
          } else if (item.isBaseFirme) {
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
      line.push(String(r.mejores4));
      csv += line.map(c => `"${safeCsvCell(c).replace(/"/g, '""')}"`).join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const suffix = options.top ? `Top${options.top}` : `OrdenadoPor_${SORT_LABELS[sortedBy]?.replace(/\s/g, '') || sortedBy}`;
    link.download = `Campeonato_${modality.replace(/[\.\s\/]/g, '')}_${year}_${suffix}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast(options.top ? `Top ${options.top} exportado con éxito.` : 'Planilla de campeonato exportada con éxito.', 'success');
  } catch (err) {
    console.error('[Excel] Error al exportar:', err);
    showToast('No se pudo exportar a Excel.', 'error');
  }
}


/**
 * Vista de impresión del Campeonato General con el mismo formato visual que la
 * tabla del módulo (colores de Top 2 / En Riesgo / Top 3 / Descarte, medallas),
 * logos del club y la modalidad (calibre) indicada en el encabezado.
 * Con options.top = 6 imprime solo las posiciones premiadas.
 */
export function printChampionshipPreview(
  year: number,
  modality: string,
  events: ShootingEvent[],
  rows: ChampionshipRankingRow[],
  sortedBy: string,
  options: ChampionshipExportOptions = {}
): void {
  const cfg = MODALITY_CONFIGS[modality as Modality];
  const accent = cfg?.color || '#0056b3';
  const accentBg = cfg?.bgColor || '#e0f0ff';
  const modalityLabel = cfg?.label || modality;
  const printRows = options.top ? rows.slice(0, options.top) : rows;
  const isTopOnly = !!options.top;

  const isSortedByBase = sortedBy === 'baseFirme';
  const isSortedByMejores4 = sortedBy === 'mejores4';
  const isSortedByTotal = !isSortedByBase && !isSortedByMejores4;

  const eventHeadersHtml = events.map((e, idx) => `
    <th class="th-event">
      <div class="ev-num">E${idx + 1}</div>
      <div class="ev-name">${esc(e.championshipDate || e.name)}</div>
    </th>`).join('');

  const posBadge = (pos: number) => {
    if (pos === 1) return `<span class="pos pos-1">${pos}</span>`;
    if (pos === 2) return `<span class="pos pos-2">${pos}</span>`;
    if (pos === 3) return `<span class="pos pos-3">${pos}</span>`;
    if (pos <= PRIZE_POSITIONS) return `<span class="pos pos-top6">${pos}</span>`;
    return `<span class="pos pos-rest">${pos}</span>`;
  };

  const rowsHtml = printRows.map((r, idx) => {
    const pos = idx + 1;
    const cells = events.map(e => {
      const item = r.events[e.id!];
      if (!item) return `<td class="cell cell-empty">-</td>`;
      if (item.status !== 'active') {
        return `<td class="cell cell-dq"><div class="val">${item.status === 'dq' ? 'DQ' : 'DNS'}</div><div class="sub">0 pts</div></td>`;
      }
      if (item.isBaseFirme) return `<td class="cell cell-base"><div class="val">${item.score}</div><div class="sub">Base Firme</div></td>`;
      if (item.isAtRisk) return `<td class="cell cell-risk"><div class="val">${item.score}</div><div class="sub">En Riesgo</div></td>`;
      if (item.isTaken) return `<td class="cell cell-top3"><div class="val">${item.score}</div><div class="sub">Top 3</div></td>`;
      return `<td class="cell cell-discard"><div class="val"><span>${item.score}</span></div><div class="sub">Descarte</div></td>`;
    }).join('');

    return `
      <tr class="${pos <= PRIZE_POSITIONS ? 'row-top6' : ''}">
        <td class="td-pos">${posBadge(pos)}</td>
        <td class="td-name">
          <div class="name">${esc(r.competitorName)}</div>
          <div class="cat">${esc(r.category)}</div>
        </td>
        ${cells}
        <td class="td-total ${isSortedByBase ? 'sorted sorted-base' : ''}">${r.baseFirme}</td>
        <td class="td-total ${isSortedByTotal ? 'sorted sorted-total' : ''}">${r.totalActual}</td>
        <td class="td-total ${isSortedByMejores4 ? 'sorted sorted-m4' : ''}">${r.mejores4}</td>
      </tr>`;
  }).join('');

  const subtitle = isTopOnly
    ? `Top ${options.top} · Posiciones premiadas`
    : 'Clasificación anual acumulada: Top 2, Top 3 y Top Gun';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Campeonato General ${year} - ${esc(cfg?.shortLabel || modality)}</title>
  <style>
    @page { size: A4 ${events.length > 4 ? 'landscape' : 'portrait'}; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; line-height: 1.3; margin: 0; padding: 16px; color: #0f172a; background: #ffffff; }
    .card { background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; }
    .header { display:flex; align-items:center; gap:16px; padding-bottom:14px; margin-bottom:16px; border-bottom:3px solid ${accent}; }
    .header img { object-fit:contain; flex-shrink:0; }
    .logo-left { height:64px; width:64px; }
    .logo-right { height:64px; width:80px; }
    .header-center { flex:1; text-align:center; }
    .club { font-size:11px; font-weight:800; letter-spacing:0.12em; color:#475569; text-transform:uppercase; }
    .title { margin:4px 0 6px; font-size:24px; font-weight:900; color:${accent}; text-transform:uppercase; letter-spacing:0.02em; }
    .badges { display:flex; justify-content:center; align-items:center; gap:10px; }
    .modality { white-space:nowrap; padding:4px 14px; border-radius:999px; background:${accentBg}; color:${accent}; border:1.5px solid ${accent}; font-weight:900; font-size:13px; }
    .year { font-size:13px; font-weight:900; color:#0f172a; }
    .subtitle { margin-top:6px; font-size:11px; color:#64748b; font-weight:700; }
    table { width:100%; border-collapse:separate; border-spacing:0 4px; font-size:13px; }
    thead th { background:#f8fafc; border-bottom:2px solid #cbd5e1; padding:8px 4px; font-weight:800; color:#0056b3; font-size:12px; }
    th.th-event { text-align:center; }
    .ev-num { font-weight:900; text-transform:uppercase; }
    .ev-name { font-size:9px; color:#64748b; font-weight:600; margin-top:2px; }
    th.th-sort { text-align:center; width:70px; }
    th.th-base { color:#16a34a; } th.th-total { color:#0056b3; } th.th-m4 { color:#6366f1; }
    th.th-base.active { background:#dcfce7; } th.th-total.active { background:#dbeafe; } th.th-m4.active { background:#ede9fe; }
    tbody tr { page-break-inside: avoid; }
    tbody tr.row-top6 td.td-name, tbody tr.row-top6 td.td-pos { background:rgba(248,250,252,0.9); }
    td { padding:6px 4px; }
    .td-pos { text-align:center; width:40px; }
    .pos { display:inline-block; width:26px; height:26px; line-height:26px; text-align:center; border-radius:50%; font-size:12px; font-weight:900; }
    .pos-1 { background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#000; }
    .pos-2 { background:linear-gradient(135deg,#e2e8f0,#cbd5e1); color:#0f172a; }
    .pos-3 { background:linear-gradient(135deg,#fcd34d,#d97706); color:#fff; }
    .pos-top6 { background:rgba(0,86,179,0.1); color:#0056b3; }
    .pos-rest { color:#64748b; }
    .td-name .name { white-space:nowrap; font-weight:800; text-transform:uppercase; font-size:13px; }
    .td-name .cat { font-size:10px; color:#64748b; font-weight:600; margin-top:2px; }
    .cell { text-align:center; border-radius:6px; font-family:'JetBrains Mono', Consolas, monospace; }
    .cell .val { font-size:13px; }
    .cell .sub { font-family:'Segoe UI', Arial, sans-serif; font-size:8px; text-transform:uppercase; margin-top:1px; font-weight:800; }
    .cell-base { background:#ecfdf3; color:#16a34a; font-weight:900; border:1px solid rgba(34,197,94,0.35); }
    .cell-base .sub { color:#22c55e; }
    .cell-risk { background:#fefce8; color:#ca8a04; font-weight:700; border:1px solid rgba(234,179,8,0.35); }
    .cell-risk .sub { color:#eab308; }
    .cell-top3 { background:#f8fafc; color:#475569; font-weight:700; border:1px solid #cbd5e1; }
    .cell-top3 .sub { color:#64748b; }
    .cell-discard { background:#f8fafc; color:#94a3b8; border:1px solid #e2e8f0; }
    .cell-discard .val span { position:relative; padding:0 3px; }
    .cell-discard .val span::after { content:''; position:absolute; left:0; right:0; top:50%; height:1.5px; background:#94a3b8; }
    .cell-dq { background:#fef2f2; color:#b91c1c; font-weight:700; border:1px solid #fecaca; }
    .cell-dq .sub { color:#ef4444; }
    .cell-empty { color:#cbd5e1; }
    .td-total { text-align:center; font-family:'JetBrains Mono', Consolas, monospace; font-weight:900; font-size:15px; color:#64748b; }
    .td-total.sorted-base { background:#f0fdf4; color:#16a34a; }
    .td-total.sorted-total { background:#eff6ff; color:#0056b3; font-size:16px; }
    .td-total.sorted-m4 { background:#f5f3ff; color:#6366f1; }
    .legend { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:14px; font-size:10px; font-weight:700; }
    .legend div { white-space:nowrap; padding:3px 8px; border-radius:6px; }
    .emission { text-align:right; font-size:10px; color:#94a3b8; font-weight:600; margin-top:10px; }
  </style>
</head>
<body>
  <div class="card">
    <header class="header">
      <img class="logo-left" src="/logo-cptp.svg" alt="CPTP" onerror="this.style.display='none';" />
      <div class="header-center">
        <div class="club">Club Paraguayo de Tiro de Long Range</div>
        <h1 class="title">Campeonato General Anual</h1>
        <div class="badges"><div class="modality">${esc(modalityLabel)}</div><div class="year">${year}</div></div>
        <div class="subtitle">${esc(subtitle)} · Orden: ${SORT_LABELS[sortedBy] || 'Top 3'}</div>
      </div>
      <img class="logo-right" src="/logo-long-range.svg" alt="Long Range" onerror="this.style.display='none';" />
    </header>

    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center;">Pos</th>
          <th style="text-align:left;">Tirador</th>
          ${eventHeadersHtml}
          <th class="th-sort th-base ${isSortedByBase ? 'active' : ''}">Top 2</th>
          <th class="th-sort th-total ${isSortedByTotal ? 'active' : ''}">Top 3</th>
          <th class="th-sort th-m4 ${isSortedByMejores4 ? 'active' : ''}">Top Gun</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="legend">
      <div style="background:#ecfdf3;color:#16a34a;">Base Firme: 2 mejores</div>
      <div style="background:#fefce8;color:#ca8a04;">En Riesgo: 3er puntaje mientras falten fechas</div>
      <div style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;">Top 3: 3 mejores</div>
      <div style="background:#f5f3ff;color:#6366f1;">Top Gun: 4 mejores</div>
    </div>
    <div class="emission">Emisión: ${new Date().toLocaleDateString('es-PY')}</div>
  </div>
</body>
</html>`;

  const shortLabel = cfg?.shortLabel || modality;
  openPrintModal(html, `Campeonato General ${year} · ${shortLabel}${isTopOnly ? ` · Top ${options.top}` : ''}`, {
    imageFileName: `Campeonato_${shortLabel.replace(/[\.\s\/]/g, '')}_${year}${isTopOnly ? `_Top${options.top}` : ''}.png`
  });
}
