import { getChampionshipData, sortChampionshipRanking, type ChampionshipRankingRow } from '../championship';
import { simulateChampionshipRankings, calculatePodiumRequirements, getMaxEventScore } from '../championshipSimulator';
import type { ShootingEvent, Modality } from '../types';
import { esc } from '../modals';
import { exportChampionshipToExcel, printChampionshipPreview } from '../printChampionship';
import { ALL_MODALITIES, MODALITY_CONFIGS } from '../modalityConfig';

let currentSortBy: 'baseFirme' | 'totalActual' = 'totalActual';
let selectedModality: Modality = '.22 LR';

// Estado global de Simulación (100% en memoria)
let isSimulatorActive = false;
let selectedCompetitorName: string = '';
let simulatedScoreValue: number = 134;

export async function renderChampionshipPanel(container: HTMLElement): Promise<void> {
  const currentYear = new Date().getFullYear();
  let selectedYear = currentYear;

  const loadAndDraw = async () => {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:#64748b;font-size:0.9rem;">Cargando tabla de campeonato...</div>`;
    
    const { rankings, allEvents } = await getChampionshipData(selectedYear, selectedModality);
    const mConfig = MODALITY_CONFIGS[selectedModality];
    const maxScore = getMaxEventScore(selectedModality);

    if (!selectedCompetitorName && rankings.length > 0) {
      selectedCompetitorName = rankings[0].competitorName;
    }

    // Preparar simulación si está activa
    const simulationMap = new Map<string, { eventId: number; score: number }[]>();
    if (isSimulatorActive && selectedCompetitorName) {
      simulationMap.set(selectedCompetitorName, [{ eventId: 9999, score: simulatedScoreValue }]);
    }

    const processedRankings = isSimulatorActive 
      ? simulateChampionshipRankings(rankings, simulationMap, currentSortBy)
      : sortChampionshipRanking(rankings, currentSortBy).map((r, i) => ({
          ...r,
          originalRank: i + 1,
          projectedRank: i + 1,
          rankDelta: 0,
          isSimulated: false
        }));

    // Requerimientos de Podio para el tirador seleccionado
    const podiumRequirements = selectedCompetitorName
      ? calculatePodiumRequirements(selectedCompetitorName, rankings, selectedModality, currentSortBy)
      : [];

    let html = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div>
            <h3 style="font-family:'Rajdhani',sans-serif;font-size:1.25rem;font-weight:700;color:${mConfig.color};margin:0;">
              Campeonato General Anual - ${mConfig.shortLabel}
            </h3>
            <p style="margin:4px 0 0;font-size:0.8rem;color:#64748b;font-weight:600;">
              Se suman los 3 mejores puntajes de todos los eventos del año. El Top 2 compone la "Base Firme".
            </p>
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
            
            <!-- Botón del Simulador -->
            <button id="btn-toggle-simulator" class="${isSimulatorActive ? 'btn-primary-custom' : 'btn-ghost-custom'}" style="padding:6px 14px;font-size:0.78rem;font-weight:700;border-color:rgba(0,86,179,0.35);color:${isSimulatorActive ? '#ffffff' : '#0056b3'};background:${isSimulatorActive ? '#0056b3' : 'transparent'};cursor:pointer;" title="Abrir Simulador Táctico de Posiciones">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:4px;vertical-align:-2px;"><path d="M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"></path></svg>
              ${isSimulatorActive ? 'Ocultar Simulador' : '🧮 Simulador / Podio'}
            </button>

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

    // Panel del Simulador (si está abierto)
    if (isSimulatorActive && rankings.length > 0) {
      const podiumCardsHtml = podiumRequirements.map(req => {
        const neededScore = currentSortBy === 'baseFirme' ? req.neededPointsBase : req.neededPointsTotal;
        const isPossible = currentSortBy === 'baseFirme' ? req.isAchievableBase : req.isAchievableTotal;

        let badgeBg = '#f1f5f9';
        let badgeColor = '#475569';
        let mainText = `${neededScore} pts`;

        if (neededScore === 0) {
          badgeBg = '#dcfce7';
          badgeColor = '#15803d';
          mainText = '¡Ya asegurado!';
        } else if (!isPossible) {
          badgeBg = '#fee2e2';
          badgeColor = '#b91c1c';
          mainText = 'Inalcanzable';
        } else {
          badgeBg = '#eff6ff';
          badgeColor = '#1d4ed8';
        }

        return `
          <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="font-size:0.75rem;font-weight:800;color:#0f172a;text-transform:uppercase;">${req.targetLabel}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-size:0.7rem;color:#64748b;font-weight:600;">Necesario prox. fecha:</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:0.9rem;font-weight:900;background:${badgeBg};color:${badgeColor};padding:3px 8px;border-radius:6px;">
                ${mainText}
              </span>
            </div>
            <div style="font-size:0.65rem;color:#94a3b8;font-weight:500;">
              Superando puntaje actual del líder (${currentSortBy === 'baseFirme' ? req.leaderScoreBase : req.leaderScoreTotal} pts)
            </div>
          </div>
        `;
      }).join('');

      html += `
        <div style="background:linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%);border:2px dashed #0056b3;border-radius:14px;padding:18px;margin-bottom:20px;animation: fadeIn 0.3s ease;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.1rem;">🧮</span>
              <h4 style="margin:0;font-family:'Rajdhani',sans-serif;font-weight:800;color:#0056b3;font-size:1.05rem;text-transform:uppercase;">Simulador Táctico de Proyección</h4>
              <span style="font-size:0.65rem;background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-weight:800;">EN MEMORIA</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button id="btn-sim-max" class="btn-ghost-custom" style="padding:4px 10px;font-size:0.72rem;font-weight:700;border-color:rgba(0,86,179,0.3);color:#0056b3;cursor:pointer;" title="Simular puntaje perfecto en la fecha futura">
                ⚡ Simular Máximo (${maxScore} pts)
              </button>
              <button id="btn-sim-reset" class="btn-ghost-custom" style="padding:4px 10px;font-size:0.72rem;font-weight:700;border-color:rgba(239,68,68,0.3);color:#ef4444;cursor:pointer;" title="Reiniciar simulación">
                🔄 Limpiar
              </button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;align-items:start;margin-bottom:14px;">
            <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;">
              <label style="font-size:0.75rem;font-weight:800;color:#334155;text-transform:uppercase;">Seleccionar Tirador a Simular:</label>
              <select id="sim-competitor-select" style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.85rem;font-weight:700;color:#0f172a;background:#ffffff;outline:none;cursor:pointer;">
                ${rankings.map(r => `
                  <option value="${esc(r.competitorName)}" ${r.competitorName === selectedCompetitorName ? 'selected' : ''}>
                    ${esc(r.competitorName)} (${r.totalActual} pts)
                  </option>
                `).join('')}
              </select>

              <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:0.75rem;font-weight:700;color:#475569;">Puntaje Simulado Prox. Fecha:</span>
                  <span style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:900;color:#0056b3;">${simulatedScoreValue} pts</span>
                </div>
                <input type="range" id="sim-score-range" min="0" max="${maxScore}" value="${simulatedScoreValue}" step="1" style="width:100%;accent-color:#0056b3;cursor:pointer;" />
              </div>
            </div>

            <!-- Contenedor de Tarjetas de Podio -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(190px, 1fr));gap:10px;grid-column: span 2;">
              ${podiumCardsHtml}
            </div>
          </div>
        </div>
      `;
    }

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

    // Cabecera Eventos (dinámica según cantidad de eventos)
    const totalEventCount = allEvents.length;
    const eventHeadersHtml = allEvents.map((e, idx) => {
      const baseWidth = totalEventCount <= 4 ? 11 : Math.min(11, Math.floor(65 / totalEventCount));
      return `
      <th style="padding:8px 4px;text-align:center;font-size:0.75rem;color:#0056b3;width:${baseWidth}%;min-width:55px;" title="${esc(e.name)}">
        <div style="font-weight:900;text-transform:uppercase;">E${idx + 1}</div>
        <div style="font-size:0.65rem;color:#64748b;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;margin:auto;margin-top:2px;">
          ${esc(e.championshipDate || e.name)}
        </div>
      </th>`;
    }).join('');

    const simHeaderHtml = isSimulatorActive ? `
      <th style="padding:8px 4px;text-align:center;font-size:0.75rem;color:#1d4ed8;width:75px;background:#dbeafe;" title="Evento Simulado">
        <div style="font-weight:900;text-transform:uppercase;">E+ (Sim)</div>
        <div style="font-size:0.6rem;color:#1e40af;font-weight:700;">Próxima</div>
      </th>
    ` : '';

    const tableRowsHtml = processedRankings.map((row) => {
      const pos = row.projectedRank;
      const origPos = row.originalRank;
      const isTop6 = pos <= 6;
      
      let posHtml = '';
      if (pos === 1) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000000;box-shadow:0 2px 4px rgba(245,158,11,0.3);">${pos}</span>`;
      else if (pos === 2) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:linear-gradient(135deg,#e2e8f0,#cbd5e1);color:#0f172a;box-shadow:0 2px 4px rgba(15,23,42,0.1);">${pos}</span>`;
      else if (pos === 3) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:linear-gradient(135deg,#fcd34d,#d97706);color:#ffffff;box-shadow:0 2px 4px rgba(217,119,6,0.3);">${pos}</span>`;
      else if (isTop6) posHtml = `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;background:rgba(0,86,179,0.1);color:#0056b3;">${pos}</span>`;
      else posHtml = `<span style="font-weight:700;color:#64748b;padding-left:6px;">${pos}</span>`;

      // Badge de variación de posición
      let deltaBadge = '';
      if (isSimulatorActive && row.rankDelta !== 0) {
        if (row.rankDelta > 0) {
          deltaBadge = `<span style="font-size:0.65rem;font-weight:900;background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:4px;margin-left:4px;" title="Subió ${row.rankDelta} puestos">▲ +${row.rankDelta}</span>`;
        } else {
          deltaBadge = `<span style="font-size:0.65rem;font-weight:900;background:#fee2e2;color:#b91c1c;padding:1px 5px;border-radius:4px;margin-left:4px;" title="Bajó ${Math.abs(row.rankDelta)} puestos">▼ ${row.rankDelta}</span>`;
        }
      }

      // Celdas reales
      const cellsHtml = allEvents.map(e => {
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

      // Celda Simulada (E+)
      const simCellHtml = isSimulatorActive ? `
        <td style="padding:6px;text-align:center;font-size:0.85rem;border-radius:6px;${row.isSimulated ? 'background:#eff6ff;color:#1d4ed8;font-weight:900;border:1.5px solid #3b82f6;' : 'color:#cbd5e1;'}">
          <div style="font-family:'JetBrains Mono',monospace;">${row.isSimulated ? simulatedScoreValue : '-'}</div>
          ${row.isSimulated ? '<div style="font-size:0.55rem;font-weight:800;color:#2563eb;text-transform:uppercase;margin-top:1px;">Simulado</div>' : ''}
        </td>
      ` : '';

      // Resaltado si la fila está siendo simulada
      const isTargetRow = isSimulatorActive && row.competitorName === selectedCompetitorName;
      const rowStyle = isTargetRow 
        ? 'background:rgba(219,234,254,0.7);border-left:4px solid #0056b3;' 
        : isTop6 ? 'background:rgba(248,250,252,0.6);' : '';

      return `
        <tr style="border-bottom:1px solid #f1f5f9;${rowStyle} transition: background 0.2s;">
          <td style="padding:10px 4px;text-align:center;width:40px;">
            ${posHtml}
          </td>
          <td style="padding:10px 6px;">
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;text-transform:uppercase;display:flex;align-items:center;">
              ${esc(row.competitorName)}
              ${deltaBadge}
            </div>
            <div style="font-size:0.7rem;color:#64748b;font-weight:600;margin-top:2px;">${esc(row.category)}</div>
          </td>
          ${cellsHtml}
          ${simCellHtml}
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
              ${simHeaderHtml}
              
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
    bindSimulatorControls(maxScore);
    bindActions(allEvents, processedRankings, currentSortBy);
  };

  const bindYearSelect = () => {
    document.getElementById('champ-year-select')?.addEventListener('change', (e) => {
      selectedYear = Number((e.target as HTMLSelectElement).value);
      loadAndDraw();
    });
    document.getElementById('champ-modality-select')?.addEventListener('change', (e) => {
      selectedModality = (e.target as HTMLSelectElement).value as Modality;
      simulatedScoreValue = getMaxEventScore(selectedModality);
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

  const bindSimulatorControls = (maxScore: number) => {
    // Botón para alternar simulador
    document.getElementById('btn-toggle-simulator')?.addEventListener('click', () => {
      isSimulatorActive = !isSimulatorActive;
      loadAndDraw();
    });

    if (!isSimulatorActive) return;

    // Selector de tirador
    document.getElementById('sim-competitor-select')?.addEventListener('change', (e) => {
      selectedCompetitorName = (e.target as HTMLSelectElement).value;
      loadAndDraw();
    });

    // Slider de puntaje
    document.getElementById('sim-score-range')?.addEventListener('input', (e) => {
      simulatedScoreValue = Number((e.target as HTMLInputElement).value);
      loadAndDraw();
    });

    // Botón simular máximo
    document.getElementById('btn-sim-max')?.addEventListener('click', () => {
      simulatedScoreValue = maxScore;
      loadAndDraw();
    });

    // Botón limpiar
    document.getElementById('btn-sim-reset')?.addEventListener('click', () => {
      isSimulatorActive = false;
      loadAndDraw();
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
