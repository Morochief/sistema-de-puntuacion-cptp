import { getChampionshipData, sortChampionshipRanking, type ChampionshipRankingRow } from '../championship';
import type { ShootingEvent, Modality } from '../types';
import { esc } from '../modals';
import { exportChampionshipToExcel, printChampionshipPreview } from '../printChampionship';
import { ALL_MODALITIES, MODALITY_CONFIGS } from '../modalityConfig';

let currentSortBy: 'baseFirme' | 'totalActual' = 'totalActual';
let selectedModality: Modality = '.22 LR';

export async function renderChampionshipPanel(container: HTMLElement): Promise<void> {
  const currentYear = new Date().getFullYear();
  let selectedYear = currentYear;

  const loadAndDraw = async () => {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:#64748b;font-size:0.9rem;">Cargando tabla de campeonato...</div>`;
    
    const { rankings, allEvents } = await getChampionshipData(selectedYear, selectedModality);
    const mConfig = MODALITY_CONFIGS[selectedModality];

    let html = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div>
            <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.25rem;font-weight:700;color:${mConfig.color};margin:0;">Campeonato General Anual - ${mConfig.shortLabel}</h3>
            <p style="margin:4px 0 0;font-size:0.8rem;color:#64748b;font-weight:600;">Se suman los 3 mejores puntajes de los 4 eventos. El Top 2 compone la "Base Firme".</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <label style="font-size:0.85rem;font-weight:700;color:#475569;">Modalidad:</label>
            <select id="champ-modality-select" style="padding:6px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.88rem;background:#ffffff;color:#0f172a;font-weight:700;outline:none;cursor:pointer;">
              ${ALL_MODALITIES.map(m => `
                <option value="${m}" ${selectedModality === m ? 'selected' : ''}>${MODALITY_CONFIGS[m].shortLabel}</option>
              `).join('')}
            </select>
            <label style="font-size:0.85rem;font-weight:700;color:#475569;">Año:</label>
            <select id="champ-year-select" style="padding:6px 12px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.88rem;background:#ffffff;color:#0f172a;font-weight:700;outline:none;cursor:pointer;">
              ${[currentYear, currentYear - 1, currentYear - 2].map(y => `
                <option value="${y}" ${selectedYear === y ? 'selected' : ''}>${y}</option>
              `).join('')}
            </select>
            ${rankings.length > 0 ? `
              <button id="btn-print-champ" class="btn-ghost-custom" style="padding:6px 12px;font-size:0.78rem;border-color:rgba(0,86,179,0.35);color:#0056b3;cursor:pointer;" title="Imprimir el ranking">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:4px;vertical-align:-2px;"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"></path></svg> Imprimir
              </button>
              <button id="btn-excel-champ" class="btn-ghost-custom" style="padding:6px 12px;font-size:0.78rem;border-color:rgba(34,197,94,0.35);color:#22c55e;cursor:pointer;" title="Exportar Excel">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:4px;vertical-align:-2px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Exportar
              </button>
            ` : ''}
          </div>
        </div>
    `;

    if (allEvents.length === 0) {
      html += `
        <div style="text-align:center;padding:40px 20px;color:#94a3b8;">
          No hay eventos registrados para el año ${selectedYear} en ${mConfig.shortLabel}.
        </div>
      </div>`;
      container.innerHTML = html;
      bindYearSelect();
      return;
    }

    // Cabecera Eventos (Max 4)
    const headerEvents = allEvents.slice(0, 4);
    const eventHeadersHtml = headerEvents.map((e, idx) => `
      <th style="padding:8px 4px;text-align:center;font-size:0.75rem;color:#0056b3;width:11%;min-width:65px;" title="${esc(e.name)}">
        <div style="font-weight:900;text-transform:uppercase;">E${idx + 1}</div>
        <div style="font-size:0.65rem;color:#64748b;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;margin:auto;margin-top:2px;">
          ${esc(e.championshipDate || e.name)}
        </div>
      </th>
    `).join('');

    const missingHeadersCount = Math.max(0, 4 - headerEvents.length);
    const emptyHeadersHtml = Array.from({ length: missingHeadersCount }, (_, i) => `
      <th style="padding:8px 4px;text-align:center;font-size:0.75rem;color:#94a3b8;width:11%;min-width:65px;font-weight:500;">
        E${headerEvents.length + i + 1} (Pendiente)
      </th>
    `).join('');

    // Ordenar Data
    const sortedRankings = sortChampionshipRanking(rankings, currentSortBy);

    const tableRowsHtml = sortedRankings.map((row, rankIdx) => {
      const pos = rankIdx + 1;
      const isTop6 = pos <= 6;
      
      let posHtml = '';
      if (pos === 1) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000000;box-shadow:0 2px 4px rgba(245,158,11,0.3);">${pos}</span>`;
      else if (pos === 2) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:linear-gradient(135deg,#e2e8f0,#cbd5e1);color:#0f172a;box-shadow:0 2px 4px rgba(15,23,42,0.1);">${pos}</span>`;
      else if (pos === 3) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:linear-gradient(135deg,#fcd34d,#d97706);color:#ffffff;box-shadow:0 2px 4px rgba(217,119,6,0.3);">${pos}</span>`;
      else if (isTop6) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:rgba(0,86,179,0.1);color:#0056b3;">${pos}</span>`;
      else posHtml = `<span style="font-weight:700;color:#64748b;padding-left:6px;">${pos}</span>`;

      // Celdas
      const cellsHtml = headerEvents.map(e => {
        const item = row.events[e.id!];
        if (!item) {
          return `<td style="padding:10px 8px;text-align:center;color:#cbd5e1;" class="cell-discarded">-</td>`;
        }

        let displayVal = String(item.score);
        if (item.status === 'dq') displayVal = 'DQ';

        let style = '';
        let subtitle = '';

        if (item.isBaseFirme) {
          style = `background:rgba(34,197,94,0.08);color:#16a34a;font-weight:900;border:1px solid rgba(34,197,94,0.25);`;
          subtitle = `<div style="font-size:0.55rem;font-weight:800;color:#22c55e;text-transform:uppercase;margin-top:1px;">Base Firme</div>`;
        } else if (item.isAtRisk) {
          style = `background:rgba(234,179,8,0.08);color:#ca8a04;font-weight:700;border:1px solid rgba(234,179,8,0.25);`;
          subtitle = `<div style="font-size:0.55rem;font-weight:700;color:#eab308;text-transform:uppercase;margin-top:1px;">En Riesgo</div>`;
        } else if (item.isTaken && !item.isAtRisk && !item.isBaseFirme) {
          style = `background:#f8fafc;color:#475569;font-weight:700;border:1px solid #cbd5e1;`;
          subtitle = `<div style="font-size:0.55rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-top:1px;">Top 3</div>`;
        } else {
          style = `background:#f8fafc;color:#94a3b8;opacity:0.65;font-weight:500;border:1px solid #e2e8f0;text-decoration:line-through;`;
          subtitle = `<div style="font-size:0.55rem;font-weight:500;color:#94a3b8;text-transform:uppercase;margin-top:1px;">Descarte</div>`;
        }

        return `
          <td style="padding:6px;text-align:center;font-size:0.85rem;border-radius:6px;${style}">
            <div style="font-family:'JetBrains Mono',monospace;">${displayVal}</div>
            ${subtitle}
          </td>
        `;
      }).join('');

      const emptyCellsHtml = Array.from({ length: missingHeadersCount }, () => `
        <td style="padding:10px 8px;text-align:center;color:#cbd5e1;background:#f8fafc;border:1px dashed #e2e8f0;">-</td>
      `).join('');

      // Resaltado sutil para la fila si es Top 6
      const rowBg = isTop6 ? 'background:rgba(248,250,252,0.6);' : '';

      return `
        <tr style="border-bottom:1px solid #f1f5f9;${rowBg} transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${isTop6 ? 'rgba(248,250,252,0.6)' : 'transparent'}'">
          <td style="padding:10px 4px;text-align:center;width:40px;">${posHtml}</td>
          <td style="padding:10px 6px;">
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;text-transform:uppercase;">${esc(row.competitorName)}</div>
            <div style="font-size:0.7rem;color:#64748b;font-weight:600;margin-top:2px;">${esc(row.category)}</div>
          </td>
          ${cellsHtml}
          ${emptyCellsHtml}
          <td style="padding:10px 4px;text-align:center;width:85px;background:${currentSortBy === 'baseFirme' ? '#f0fdf4' : 'transparent'};">
            <span style="font-family:'JetBrains Mono',monospace;font-size:1.05rem;font-weight:900;color:${currentSortBy === 'baseFirme' ? '#16a34a' : '#64748b'};">
              ${row.baseFirme}
            </span>
          </td>
          <td style="padding:10px 4px;text-align:center;width:85px;background:${currentSortBy === 'totalActual' ? '#eff6ff' : 'transparent'};">
            <span style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:900;color:${currentSortBy === 'totalActual' ? '#0056b3' : '#64748b'};">
              ${row.totalActual}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    html += `
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:650px;table-layout:auto;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1;text-align:left;font-family:'Rajdhani',sans-serif;font-weight:700;">
              <th style="padding:10px 4px;text-align:center;color:#0056b3;width:40px;">Pos</th>
              <th style="padding:10px 6px;color:#0056b3;">Tirador</th>
              ${eventHeadersHtml}
              ${emptyHeadersHtml}
              
              <!-- CABECERAS ORDENABLES -->
              <th id="th-sort-base" style="padding:10px 4px;text-align:center;color:#16a34a;width:85px;cursor:pointer;background:${currentSortBy === 'baseFirme' ? '#dcfce7' : 'transparent'};transition: background 0.2s;" title="Clic para ordenar por Base Firme">
                <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
                  Base Firme
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="opacity:${currentSortBy === 'baseFirme' ? '1' : '0.3'};"><path d="M12 5v14M19 12l-7 7-7-7"></path></svg>
                </div>
                <div style="font-size:0.6rem;color:#15803d;font-weight:600;margin-top:2px;">(Mejores 2)</div>
              </th>
              
              <th id="th-sort-total" style="padding:10px 4px;text-align:center;color:#0056b3;width:85px;cursor:pointer;background:${currentSortBy === 'totalActual' ? '#dbeafe' : 'transparent'};transition: background 0.2s;" title="Clic para ordenar por Total Actual">
                <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
                  Total
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="opacity:${currentSortBy === 'totalActual' ? '1' : '0.3'};"><path d="M12 5v14M19 12l-7 7-7-7"></path></svg>
                </div>
                <div style="font-size:0.6rem;color:#0369a1;font-weight:600;margin-top:2px;">(Mejores 3)</div>
              </th>
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
    bindSorting();
    bindActions(allEvents.slice(0, 4), sortedRankings, currentSortBy);
  };

  const bindYearSelect = () => {
    document.getElementById('champ-year-select')?.addEventListener('change', (e) => {
      selectedYear = Number((e.target as HTMLSelectElement).value);
      loadAndDraw();
    });
    document.getElementById('champ-modality-select')?.addEventListener('change', (e) => {
      selectedModality = (e.target as HTMLSelectElement).value as Modality;
      loadAndDraw();
    });
  };

  const bindSorting = () => {
    document.getElementById('th-sort-base')?.addEventListener('click', () => {
      if (currentSortBy !== 'baseFirme') {
        currentSortBy = 'baseFirme';
        loadAndDraw();
      }
    });
    document.getElementById('th-sort-total')?.addEventListener('click', () => {
      if (currentSortBy !== 'totalActual') {
        currentSortBy = 'totalActual';
        loadAndDraw();
      }
    });
  };

  const bindActions = (activeEvents: ShootingEvent[], rows: ChampionshipRankingRow[], sortedBy: string) => {
    document.getElementById('btn-excel-champ')?.addEventListener('click', () => {
      exportChampionshipToExcel(selectedYear, selectedModality, activeEvents, rows, sortedBy);
    });

    document.getElementById('btn-print-champ')?.addEventListener('click', () => {
      printChampionshipPreview(selectedYear, selectedModality, activeEvents, rows, sortedBy);
    });
  };

  await loadAndDraw();
}
