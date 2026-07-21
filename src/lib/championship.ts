/**
 * championship.ts
 * Módulo para calcular, renderizar y exportar la tabla de Campeonato General Anual.
 * Regla: Se consideran los 4 eventos del año, seleccionando y sumando únicamente los mejores 3 puntajes de cada tirador.
 */

import { db } from './db';
import type { ShootingEvent, Participant, Series } from './types';
import { esc, showToast } from './modals';
import { openPrintModal } from './print';

export interface ChampionshipRow {
  name: string;
  category: string;
  scores: Record<number, { score: number; status?: 'active' | 'dq' | 'dns'; taken: boolean }>;
  totalScore: number;
}

/**
 * Obtiene y procesa las puntuaciones del campeonato anual.
 */
export async function getChampionshipData(year: number): Promise<{
  rows: ChampionshipRow[];
  events: ShootingEvent[];
}> {
  // 1. Obtener todos los eventos del año correspondiente
  const allEvents = await db.events.toArray();
  const yearEvents = allEvents
    .filter(e => {
      try {
        const dateObj = new Date(e.date + 'T12:00:00');
        return dateObj.getFullYear() === year;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date)); // Orden cronológico E1, E2, E3, E4...

  if (yearEvents.length === 0) {
    return { rows: [], events: [] };
  }

  // 2. Obtener todos los participantes del Padrón Maestro para tener la lista de tiradores oficiales
  const padron = await db.masterCompetitors.toArray();

  // 3. Obtener todas las series y participantes inscritos de estos eventos
  const eventIds = yearEvents.map(e => e.id!);
  const allParticipants = await db.participants.where('eventId').anyOf(eventIds).toArray();
  const allSeries = await db.series.where('eventId').anyOf(eventIds).toArray();

  // 4. Calcular puntajes para cada tirador del Padrón
  const rows: ChampionshipRow[] = [];

  for (const mc of padron) {
    const mcNameLower = mc.name.trim().toLowerCase();
    const scores: Record<number, { score: number; status?: 'active' | 'dq' | 'dns'; taken: boolean }> = {};
    const scoresList: { eventId: number; score: number; status: 'active' | 'dq' | 'dns' }[] = [];

    let hasParticipated = false;

    for (const event of yearEvents) {
      // Buscar si el competidor del padrón participó en este evento específico (por coincidencia de nombre exacto)
      const part = allParticipants.find(p => p.eventId === event.id && p.name.trim().toLowerCase() === mcNameLower);

      if (part) {
        hasParticipated = true;
        const status = part.status || 'active';
        
        if (status === 'dq') {
          // Si está descalificado en este evento, su puntaje es 0
          scoresList.push({ eventId: event.id!, score: 0, status: 'dq' });
        } else if (status === 'dns') {
          // Si no se presentó, su puntaje es 0
          scoresList.push({ eventId: event.id!, score: 0, status: 'dns' });
        } else {
          // Sumar puntajes de las series de este participante en este evento
          const partSeries = allSeries.filter(s => s.eventId === event.id && s.participantId === part.id);
          const totalScore = partSeries.reduce((sum, s) => sum + s.totalScore, 0);
          scoresList.push({ eventId: event.id!, score: totalScore, status: 'active' });
        }
      } else {
        // No participó en este evento
        scoresList.push({ eventId: event.id!, score: 0, status: 'dns' });
      }
    }

    // Si el competidor no participó en NINGÚN evento de este año, no lo mostramos en el campeonato
    if (!hasParticipated) continue;

    // 5. Aplicar regla: tomar los mejores 3 puntajes
    // Creamos una copia ordenada de mayor a menor para identificar el peor puntaje a descartar
    const sortedScores = [...scoresList].sort((a, b) => b.score - a.score);

    // Los 3 mejores se marcan como tomados (taken: true)
    const takenEventIds = new Set<number>();
    // Tomamos los primeros 3 (si hay 4 o más, se descartan los peores)
    sortedScores.slice(0, 3).forEach(item => {
      takenEventIds.add(item.eventId);
    });

    // Armar el Record final y calcular el acumulado general
    let totalScore = 0;
    scoresList.forEach(item => {
      const isTaken = takenEventIds.has(item.eventId);
      scores[item.eventId] = {
        score: item.score,
        status: item.status,
        taken: isTaken
      };
      if (isTaken) {
        totalScore += item.score;
      }
    });

    rows.push({
      name: mc.name,
      category: mc.category || 'General',
      scores,
      totalScore
    });
  }

  // 6. Ordenar ranking general de mayor a menor totalScore
  rows.sort((a, b) => b.totalScore - a.totalScore);

  return { rows, events: yearEvents };
}

/**
 * Renderiza la interfaz de la Tabla de Campeonato General
 */
export async function renderChampionshipPanel(container: HTMLElement): Promise<void> {
  const currentYear = new Date().getFullYear();
  let selectedYear = currentYear;

  const loadAndDraw = async () => {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:#64748b;font-size:0.9rem;">Cargando tabla de campeonato...</div>`;
    
    const { rows, events } = await getChampionshipData(selectedYear);

    let html = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div>
            <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.25rem;font-weight:700;color:#0056b3;margin:0;">Campeonato General Anual</h3>
            <p style="margin:4px 0 0;font-size:0.8rem;color:#64748b;font-weight:600;">Se toman únicamente las mejores 3 puntuaciones de cada tirador entre los 4 eventos del año.</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <label style="font-size:0.85rem;font-weight:700;color:#475569;">Año:</label>
            <select id="champ-year-select" style="padding:6px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.88rem;background:#ffffff;color:#0f172a;font-weight:700;outline:none;">
              ${[currentYear, currentYear - 1, currentYear - 2].map(y => `
                <option value="${y}" ${selectedYear === y ? 'selected' : ''}>${y}</option>
              `).join('')}
            </select>
            ${rows.length > 0 ? `
              <button id="btn-print-champ" class="btn-ghost-custom" style="padding:6px 12px;font-size:0.78rem;border-color:rgba(0,86,179,0.35);color:#0056b3;" title="Imprimir el ranking del campeonato general">
                Imprimir
              </button>
              <button id="btn-excel-champ" class="btn-ghost-custom" style="padding:6px 12px;font-size:0.78rem;border-color:rgba(34,197,94,0.35);color:#22c55e;" title="Exportar campeonato a planilla Excel">
                Exportar Excel
              </button>
            ` : ''}
          </div>
        </div>
    `;

    if (events.length === 0) {
      html += `
        <div style="text-align:center;padding:40px 20px;color:#94a3b8;">
          No hay eventos registrados para el año ${selectedYear}.
        </div>
      </div>`;
      container.innerHTML = html;
      bindYearSelect();
      return;
    }

    // Construir cabecera de eventos (máximo los primeros 4 eventos ordenados del año)
    const headerEvents = events.slice(0, 4);
    const eventHeadersHtml = headerEvents.map((e, idx) => `
      <th style="padding:10px 8px;text-align:center;font-size:0.75rem;color:#0056b3;width:15%;min-width:90px;" title="${esc(e.name)}">
        <div style="font-weight:900;text-transform:uppercase;">E${idx + 1}</div>
        <div style="font-size:0.65rem;color:#64748b;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;margin-top:2px;">
          ${esc(e.championshipDate || e.name)}
        </div>
      </th>
    `).join('');

    // Rellenar cabeceras vacías si hay menos de 4 eventos
    const missingHeadersCount = Math.max(0, 4 - headerEvents.length);
    const emptyHeadersHtml = Array.from({ length: missingHeadersCount }, (_, i) => `
      <th style="padding:10px 8px;text-align:center;font-size:0.75rem;color:#94a3b8;width:15%;min-width:90px;font-weight:500;">
        E${headerEvents.length + i + 1} (Pendiente)
      </th>
    `).join('');

    const tableRowsHtml = rows.map((row, rankIdx) => {
      const pos = rankIdx + 1;
      const isTop3 = pos <= 3;
      
      const posHtml = isTop3
        ? `<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;
              background:${pos === 1 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : pos === 2 ? '#cbd5e1' : '#f59e0b'};
              color:${pos === 1 ? '#000000' : pos === 2 ? '#0f172a' : '#ffffff'};">${pos}</span>`
        : `<span style="font-weight:700;color:#64748b;padding-left:6px;">${pos}</span>`;

      // Celdas de puntuaciones
      const cellsHtml = headerEvents.map(e => {
        const item = row.scores[e.id!];
        if (!item) {
          return `<td style="padding:10px 8px;text-align:center;color:#cbd5e1;" class="cell-discarded">-</td>`;
        }

        const scoreVal = item.score;
        let displayVal = String(item.score);
        if (item.status === 'dq') displayVal = 'DQ';

        const cellClass = item.taken ? 'cell-taken' : 'cell-discarded';
        const style = item.taken
          ? `background:rgba(34,197,94,0.08);color:#16a34a;font-weight:900;border:1px solid rgba(34,197,94,0.25);`
          : `background:#f8fafc;color:#94a3b8;opacity:0.65;font-weight:500;border:1px solid #e2e8f0;`;

        return `
          <td style="padding:8px;text-align:center;font-size:0.85rem;border-radius:6px;${style}" class="${cellClass}">
            <div style="font-family:'JetBrains Mono',monospace;">${displayVal}</div>
            ${item.taken ? '<div style="font-size:0.55rem;font-weight:700;color:#22c55e;text-transform:uppercase;margin-top:1px;">Tomado</div>' : '<div style="font-size:0.55rem;font-weight:500;color:#94a3b8;text-transform:uppercase;margin-top:1px;">Descarte</div>'}
          </td>
        `;
      }).join('');

      const emptyCellsHtml = Array.from({ length: missingHeadersCount }, () => `
        <td style="padding:10px 8px;text-align:center;color:#cbd5e1;background:#f8fafc;border:1px dashed #e2e8f0;" class="cell-discarded">-</td>
      `).join('');

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px 8px;text-align:center;width:45px;">${posHtml}</td>
          <td style="padding:12px 8px;">
            <div style="font-weight:700;color:#0f172a;font-size:0.95rem;text-transform:uppercase;">${esc(row.name)}</div>
            <div style="font-size:0.72rem;color:#64748b;font-weight:600;margin-top:2px;">${esc(row.category)}</div>
          </td>
          ${cellsHtml}
          ${emptyCellsHtml}
          <td style="padding:12px 8px;text-align:center;width:95px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:1.15rem;font-weight:900;color:#0056b3;">
              ${row.totalScore}
            </span>
            <span style="font-size:0.68rem;color:#64748b;display:block;margin-top:1px;">PTS TOTAL</span>
          </td>
        </tr>
      `;
    }).join('');

    html += `
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;min-width:650px;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1;text-align:left;font-family:'Rajdhani',sans-serif;font-weight:700;">
              <th style="padding:10px 8px;text-align:center;color:#0056b3;width:45px;">Pos</th>
              <th style="padding:10px 8px;color:#0056b3;">Tirador</th>
              ${eventHeadersHtml}
              ${emptyHeadersHtml}
              <th style="padding:10px 8px;text-align:center;color:#0056b3;width:95px;">Campeonato</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>`;

    container.innerHTML = html;
    bindYearSelect();
    bindActions(events.slice(0, 4), rows);
  };

  const bindYearSelect = () => {
    document.getElementById('champ-year-select')?.addEventListener('change', (e) => {
      selectedYear = Number((e.target as HTMLSelectElement).value);
      loadAndDraw();
    });
  };

  const bindActions = (activeEvents: ShootingEvent[], rows: ChampionshipRow[]) => {
    // ── BOTÓN EXCEL ──
    document.getElementById('btn-excel-champ')?.addEventListener('click', () => {
      exportChampionshipToExcel(selectedYear, activeEvents, rows);
    });

    // ── BOTÓN IMPRIMIR ──
    document.getElementById('btn-print-champ')?.addEventListener('click', () => {
      printChampionshipPreview(selectedYear, activeEvents, rows);
    });
  };

  await loadAndDraw();
}

/**
 * Exporta el ranking general a un archivo Excel en formato CSV/TSV descargable
 */
function exportChampionshipToExcel(year: number, events: ShootingEvent[], rows: ChampionshipRow[]): void {
  try {
    let csv = '\uFEFF'; // BOM para español/acentos en Excel
    // Encabezados
    const headers = ['Posición', 'Tirador', 'Categoría'];
    events.forEach((e, idx) => {
      headers.push(`Evento ${idx + 1} (${e.championshipDate || e.name})`);
    });
    // Rellenar hasta 4 columnas de eventos
    for (let i = events.length; i < 4; i++) {
      headers.push(`Evento ${i + 1} (Pendiente)`);
    }
    headers.push('Puntaje Total');

    csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';') + '\n';

    rows.forEach((r, rankIdx) => {
      const line = [
        String(rankIdx + 1),
        r.name,
        r.category
      ];

      events.forEach(e => {
        const item = r.scores[e.id!];
        if (!item) {
          line.push('-');
        } else {
          let val = String(item.score);
          if (item.status === 'dq') val = 'DQ';
          line.push(item.taken ? `${val} (Tomado)` : `${val} (Descarte)`);
        }
      });

      for (let i = events.length; i < 4; i++) {
        line.push('-');
      }

      line.push(String(r.totalScore));
      csv += line.map(c => `"${c.replace(/"/g, '""')}"`).join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Campeonato_General_${year}.csv`;
    link.click();
    showToast('Planilla de campeonato exportada con éxito.', 'success');
  } catch (err) {
    console.error('[Excel] Error al exportar:', err);
    showToast('No se pudo exportar a Excel.', 'error');
  }
}

/**
 * Muestra el ranking del campeonato general en el modal táctico de impresión
 */
function printChampionshipPreview(year: number, events: ShootingEvent[], rows: ChampionshipRow[]): void {
  // Crear HTML para la planilla del campeonato
  const tableHeadersHtml = events.map((e, idx) => `
    <th style="border:1px solid #000000;padding:6px;text-align:center;font-size:10px;width:13%;">
      E${idx + 1}<br>
      <span style="font-size:8px;font-weight:normal;color:#333;">${esc(e.championshipDate || e.name)}</span>
    </th>
  `).join('');

  const emptyHeadersHtml = Array.from({ length: Math.max(0, 4 - events.length) }, (_, i) => `
    <th style="border:1px solid #000000;padding:6px;text-align:center;font-size:10px;color:#666;width:13%;">
      E${events.length + i + 1}<br>
      <span style="font-size:8px;font-weight:normal;">(Pendiente)</span>
    </th>
  `).join('');

  const tableRowsHtml = rows.map((r, rankIdx) => {
    const pos = rankIdx + 1;
    const cellsHtml = events.map(e => {
      const item = r.scores[e.id!];
      if (!item) return `<td style="border:1px solid #000000;padding:6px;text-align:center;background:#f2f2f2;color:#999;">-</td>`;
      
      let displayVal = String(item.score);
      if (item.status === 'dq') displayVal = 'DQ';

      const style = item.taken
        ? 'font-weight:bold;background:#ffffff;color:#000000;'
        : 'color:#999999;background:#f2f2f2;text-decoration:line-through;';

      return `<td style="border:1px solid #000000;padding:6px;text-align:center;font-size:11px;${style}">${displayVal}</td>`;
    }).join('');

    const emptyCellsHtml = Array.from({ length: Math.max(0, 4 - events.length) }, () => `
      <td style="border:1px solid #000000;padding:6px;text-align:center;background:#f2f2f2;color:#999;">-</td>
    `).join('');

    return `
      <tr>
        <td style="border:1px solid #000000;padding:6px;text-align:center;font-weight:bold;font-size:11px;">${pos}</td>
        <td style="border:1px solid #000000;padding:6px;font-size:11px;font-weight:bold;">
          ${esc(r.name.toUpperCase())}<br>
          <span style="font-size:8px;font-weight:normal;color:#555;">${esc(r.category)}</span>
        </td>
        ${cellsHtml}
        ${emptyCellsHtml}
        <td style="border:1px solid #000000;padding:6px;text-align:center;font-weight:bold;font-size:13px;background:#eef6ff;color:#0056b3;">
          ${r.totalScore}
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
    .page { width: 100%; position: relative; }
    .layout-border-red { position: absolute; top: 0; left: 0; bottom: 0; width: 10px; background: #b7201c; }
    .layout-border-blue { position: absolute; top: 0; left: 10px; bottom: 0; width: 6px; background: #0056b3; }
    .content { padding-left: 28px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    .title-main { font-size: 20px; font-weight: 900; color: #b7201c; margin: 0 0 4px; text-transform: uppercase; }
    .sub-title { font-size: 10px; font-weight: bold; color: #0056b3; letter-spacing: 0.1em; text-transform: uppercase; }
    .date-info { text-align: right; font-size: 10px; font-weight: bold; color: #333; }
    .year-txt { font-size: 24px; font-weight: bold; font-style: italic; color: #ccc; line-height: 0.8; }
    
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    table.data-table th { background: #f2f2f2; font-size: 10px; font-weight: bold; padding: 6px; text-transform: uppercase; border: 1px solid #000; }
    table.data-table td { border: 1px solid #000; }
    
    .footer { position: absolute; bottom: 0; left: 28px; right: 0; border-top: 1px solid #ccc; padding-top: 8px; font-size: 8px; color: #666; display: flex; justify-content: space-between; font-weight: bold; }
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
          <h1 class="title-main">RANKING CAMPEONATO GENERAL ANUAL</h1>
          <span style="font-size:11px;color:#333;font-weight:bold;">PLANILLA OFICIAL ACUMULADA</span>
        </div>
        <div class="date-info">
          <div class="year-txt">${year}</div>
          <div style="margin-top:4px;">Emisión: ${new Date().toLocaleDateString('es-AR')}</div>
        </div>
      </header>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width:6%;text-align:center;">Pos</th>
            <th style="text-align:left;">Tirador / Categoría</th>
            ${tableHeadersHtml}
            ${emptyHeadersHtml}
            <th style="width:14%;text-align:center;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <footer class="footer">
        <div>Planilla oficial del campeonato - Sujeta a fiscalización del Club CPTP</div>
        <div>CPTP Scoring v1.0</div>
      </footer>
    </div>
  </div>
</body>
</html>`;

  // Invocar al visor de impresión universal
  openPrintModal(html, `Campeonato General ${year}`);
}
