/**
 * tiebreaker.ts
 * Módulo para gestionar desempates manuales entre competidores con el mismo puntaje.
 * Permite ordenar la prioridad de los empatados manteniendo su puntuación intacta.
 */

import { db } from './db';
import type { Participant, Series } from './types';
import { showToast } from './modals';

/**
 * Ordena la lista de clasificación teniendo en cuenta el puntaje acumulado y el desempate manual.
 */
export function sortRanking(
  a: { participant: Participant; totalScore: number },
  b: { participant: Participant; totalScore: number }
): number {
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }
  // Si hay empate de puntos, decide el tieRank manual (más bajo = mejor posición)
  const rankA = a.participant.tieRank ?? 999;
  const rankB = b.participant.tieRank ?? 999;
  return rankA - rankB;
}

/**
 * Agrupa los tiradores que tienen exactamente el mismo puntaje para detectar empates.
 * Retorna solo los grupos que contienen 2 o más tiradores empatados y tienen puntuación > 0.
 */
export function detectTies(
  participants: Participant[],
  seriesList: Series[]
): { score: number; rows: { participant: Participant; totalScore: number }[] }[] {
  const scoreMap = new Map<number, { participant: Participant; totalScore: number }[]>();

  participants.forEach(p => {
    const pSeries = seriesList.filter(s => s.participantId === p.id);
    const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
    
    if (totalScore > 0) {
      if (!scoreMap.has(totalScore)) {
        scoreMap.set(totalScore, []);
      }
      scoreMap.get(totalScore)!.push({ participant: p, totalScore });
    }
  });

  const tiedGroups: { score: number; rows: { participant: Participant; totalScore: number }[] }[] = [];
  
  scoreMap.forEach((rows, score) => {
    if (rows.length > 1) {
      // Ordenar por tieRank existente antes de presentar
      rows.sort((a, b) => (a.participant.tieRank ?? 999) - (b.participant.tieRank ?? 999));
      tiedGroups.push({ score, rows });
    }
  });

  // Ordenar grupos de mayor a menor puntuación
  return tiedGroups.sort((a, b) => b.score - a.score);
}

/**
 * Muestra el modal táctico de desempates interactivo.
 */
export function showTieBreakerModal(
  eventId: number,
  participants: Participant[],
  seriesList: Series[],
  onSaveCallback: () => void
): void {
  const groups = detectTies(participants, seriesList);

  if (groups.length === 0) {
    showToast('No se detectaron empates en este evento.', 'info');
    return;
  }

  // Clonar los participantes de los grupos de empate para manipulación local
  const workingGroups = groups.map(g => ({
    score: g.score,
    rows: g.rows.map(r => ({ ...r, participant: { ...r.participant } }))
  }));

  // Crear contenedor del modal
  const modalOverlay = document.createElement('div');
  modalOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
    z-index: 1000; display: flex; align-items: center; justify-content: center;
    padding: 16px; font-family: 'Rajdhani', sans-serif;
  `;

  const modalBox = document.createElement('div');
  modalBox.style.cssText = `
    background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 5px solid #b7201c; border-radius: 16px;
    width: 100%; max-width: 520px; max-height: 90vh; display: flex;
    flex-direction: column; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3);
    overflow: hidden; color: #0f172a;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center; background: #f8fafc;
  `;
  header.innerHTML = `
    <h3 style="margin:0;font-size:1.2rem;font-weight:800;color:#0056b3;font-family:'Orbitron',sans-serif;">Resolver Desempates</h3>
    <span style="font-size:0.75rem;background:#eff6ff;color:#0056b3;padding:4px 8px;border-radius:4px;font-weight:700;">CPTP .22 LR</span>
  `;

  const body = document.createElement('div');
  body.style.cssText = `
    padding: 16px 20px; overflow-y: auto; flex: 1;
    display: flex; flex-direction: column; gap: 16px; background: #ffffff;
  `;

  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 16px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc;
    display: flex; justify-content: flex-end; gap: 12px;
  `;

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn-ghost-custom';
  btnCancel.textContent = 'Cancelar';
  btnCancel.style.padding = '8px 16px';
  btnCancel.onclick = () => {
    if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
  };

  const btnSave = document.createElement('button');
  btnSave.className = 'btn-primary-custom';
  btnSave.textContent = 'Aplicar Posiciones';
  btnSave.style.cssText = 'padding:8px 20px;background:#0056b3;color:#ffffff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;';

  footer.appendChild(btnCancel);
  footer.appendChild(btnSave);

  modalBox.appendChild(header);
  modalBox.appendChild(body);
  modalBox.appendChild(footer);
  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  // Renderizar la lista de grupos empatados en el modal
  function renderTiedList(): void {
    body.innerHTML = '';
    
    // Calcular el ranking general temporal en base al orden actual en el modal
    const tempRankings = participants.map(p => {
      let matchedRow = null;
      let groupRef = null;
      let groupIndex = -1;
      
      for (const group of workingGroups) {
        const idx = group.rows.findIndex(r => r.participant.id === p.id);
        if (idx >= 0) {
          matchedRow = group.rows[idx];
          groupRef = group;
          groupIndex = idx;
          break;
        }
      }
      
      if (matchedRow) {
        return {
          participant: matchedRow.participant,
          score: groupRef!.score,
          fromGroup: true,
          groupIdx: groupIndex,
          groupRef
        };
      }
      
      const pSeries = seriesList.filter(s => s.participantId === p.id);
      const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
      return {
        participant: p,
        score: totalScore,
        fromGroup: false,
        groupIdx: 0,
        groupRef: null
      };
    });

    // Ordenar ranking general temporal
    tempRankings.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.fromGroup && b.fromGroup && a.groupRef === b.groupRef) {
        return a.groupIdx - b.groupIdx;
      }
      return (a.participant.tieRank ?? 999) - (b.participant.tieRank ?? 999);
    });

    workingGroups.forEach((group, gIdx) => {
      const groupContainer = document.createElement('div');
      groupContainer.style.cssText = `
        background: #f8fafc; border: 1px solid #e2e8f0;
        border-radius: 12px; padding: 12px 14px;
      `;

      const groupTitle = document.createElement('div');
      groupTitle.style.cssText = `
        font-size: 0.95rem; font-weight: 700; color: #b7201c;
        margin-bottom: 10px; display: flex; justify-content: space-between;
      `;
      groupTitle.innerHTML = `
        <span>Empate en ${group.score} Puntos</span>
        <span style="font-size:0.75rem;color:#64748b;">${group.rows.length} competidores</span>
      `;
      groupContainer.appendChild(groupTitle);

      const itemsList = document.createElement('div');
      itemsList.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

      group.rows.forEach((row, rIdx) => {
        const overallPos = tempRankings.findIndex(item => item.participant.id === row.participant.id) + 1;

        const item = document.createElement('div');
        item.style.cssText = `
          display: flex; align-items: center; justify-content: space-between;
          background: #ffffff; padding: 8px 12px; border-radius: 8px;
          border: 1px solid #cbd5e1;
        `;

        const leftSide = document.createElement('div');
        leftSide.style.cssText = 'display:flex;align-items:center;gap:10px;';
        leftSide.innerHTML = `
          <span style="font-family:monospace;font-size:0.8rem;background:#eff6ff;color:#0056b3;padding:2px 6px;border-radius:4px;font-weight:bold;" title="Posición general proyectada">
            ${overallPos}° Lugar
          </span>
          <span style="font-weight:700;font-size:0.9rem;color:#0f172a;">
            ${row.participant.name}
          </span>
        `;

        const rightSide = document.createElement('div');
        rightSide.style.cssText = 'display:flex;gap:6px;';

        const btnUp = document.createElement('button');
        btnUp.style.cssText = 'background:#e2e8f0;color:#0f172a;border:none;border-radius:4px;width:30px;height:30px;cursor:pointer;font-weight:bold;';
        btnUp.innerHTML = '▲';
        btnUp.disabled = rIdx === 0;
        if (rIdx === 0) btnUp.style.opacity = '0.3';
        btnUp.onclick = () => {
          const temp = group.rows[rIdx];
          group.rows[rIdx] = group.rows[rIdx - 1];
          group.rows[rIdx - 1] = temp;
          renderTiedList();
        };

        const btnDown = document.createElement('button');
        btnDown.style.cssText = 'background:#e2e8f0;color:#0f172a;border:none;border-radius:4px;width:30px;height:30px;cursor:pointer;font-weight:bold;';
        btnDown.innerHTML = '▼';
        btnDown.disabled = rIdx === group.rows.length - 1;
        if (rIdx === group.rows.length - 1) btnDown.style.opacity = '0.3';
        btnDown.onclick = () => {
          const temp = group.rows[rIdx];
          group.rows[rIdx] = group.rows[rIdx + 1];
          group.rows[rIdx + 1] = temp;
          renderTiedList();
        };

        rightSide.appendChild(btnUp);
        rightSide.appendChild(btnDown);

        item.appendChild(leftSide);
        item.appendChild(rightSide);
        itemsList.appendChild(item);
      });

      groupContainer.appendChild(itemsList);
      body.appendChild(groupContainer);
    });
  }

  renderTiedList();

  // Acción del botón guardar
  btnSave.onclick = async () => {
    try {
      btnSave.disabled = true;
      btnSave.textContent = 'Guardando...';

      for (const group of workingGroups) {
        for (let i = 0; i < group.rows.length; i++) {
          const participant = group.rows[i].participant;
          await db.participants.update(participant.id!, { tieRank: i + 1 });
        }
      }

      showToast('Posiciones de desempate aplicadas con éxito.', 'success');
    } catch (err) {
      console.error('[tiebreaker] Error guardando desempates:', err);
      showToast('Error al guardar las posiciones.', 'error');
    } finally {
      if (modalOverlay.parentNode) {
        modalOverlay.parentNode.removeChild(modalOverlay);
      }
      onSaveCallback();
    }
  };
}
