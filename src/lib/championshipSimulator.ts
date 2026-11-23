/**
 * championshipSimulator.ts
 * Simulación en memoria de una próxima fecha del Campeonato Anual.
 * Recalcula Top 2 / Top 3 / Top Gun y las marcas de cada celda con las mismas
 * reglas que championshipCore.ts, sin modificar los datos originales.
 */

import {
  applyPlacements,
  sortChampionshipRanking,
  type ChampionshipRankingRow,
  type ChampionshipSortKey
} from './championshipCore';
import { MODALITY_CONFIGS } from './modalityConfig';
import type { Modality } from './types';

export interface SimulatedChampionshipRow extends ChampionshipRankingRow {
  originalRank: number;
  projectedRank: number;
  rankDelta: number; // Diferencia de posición (ej: +3 subió 3 puestos)
  isSimulated: boolean;
}

/** Id reservado para la fecha simulada (no existe en la base). */
export const SIMULATED_EVENT_ID = -1;

/** Modalidades de Fuego Central (tienen máximo con y sin bonus). */
export function isCentralFireModality(modality: Modality): boolean {
  return modality === '.308' || modality === '.223';
}

/**
 * Puntaje máximo por evento según la modalidad (desde modalityConfig):
 * - .22 LR: 134 (2 series × 67)
 * - .308 / .223: 96 con bonus, 87 sin bonus (1 serie)
 * - 21 Blackjack: 147 (1 serie)
 */
export function getMaxEventScore(modality: Modality, withBonus: boolean = true): number {
  if (isCentralFireModality(modality) && !withBonus) return 87;
  const cfg = MODALITY_CONFIGS[modality] ?? MODALITY_CONFIGS['.22 LR'];
  return cfg.maxSeriesScore * cfg.seriesPerEvent;
}

/**
 * Aplica puntajes simulados (por tirador) y devuelve la tabla proyectada
 * reordenada con los deltas de posición.
 */
export function simulateChampionshipRankings(
  originalRankings: ChampionshipRankingRow[],
  simulations: Map<string, { eventId: number; score: number }[]>, // competitorName -> puntajes simulados
  sortBy: ChampionshipSortKey = 'totalActual',
  seasonOpen: boolean = true
): SimulatedChampionshipRow[] {
  // 1. Posiciones originales
  const originalPosMap = new Map<string, number>();
  sortChampionshipRanking(originalRankings, sortBy).forEach((row, idx) => {
    originalPosMap.set(row.competitorName, idx + 1);
  });

  // 2. Proyectar cada competidor (copias profundas de las celdas)
  const projectedRows: ChampionshipRankingRow[] = originalRankings.map(row => {
    const simList = simulations.get(row.competitorName);
    if (!simList || simList.length === 0) {
      const copy: ChampionshipRankingRow['events'] = {};
      for (const key of Object.keys(row.events)) {
        const ev = row.events[Number(key)];
        copy[Number(key)] = ev ? { ...ev } : null;
      }
      return { ...row, events: copy };
    }

    const cells: ChampionshipRankingRow['events'] = { ...row.events };
    simList.forEach(sim => {
      cells[sim.eventId] = {
        eventId: sim.eventId,
        score: sim.score,
        status: 'active',
        isBaseFirme: false,
        isTaken: false,
        isAtRisk: false,
        isDiscarded: false
      };
    });

    const placed = applyPlacements(cells, seasonOpen);
    return {
      ...row,
      events: placed.events,
      baseFirme: placed.baseFirme,
      totalActual: placed.totalActual,
      mejores4: placed.mejores4
    };
  });

  // 3. Reordenar con la simulación aplicada y calcular deltas
  return sortChampionshipRanking(projectedRows, sortBy).map((row, idx) => {
    const projectedRank = idx + 1;
    const originalRank = originalPosMap.get(row.competitorName) || projectedRank;
    return {
      ...row,
      originalRank,
      projectedRank,
      rankDelta: originalRank - projectedRank, // Positivo = subió puestos
      isSimulated: simulations.has(row.competitorName)
    };
  });
}
