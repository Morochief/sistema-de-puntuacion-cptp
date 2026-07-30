/**
 * championshipSimulator.ts
 * Módulo puro de simulación matemática y proyecciones para el Campeonato Anual.
 */

import type { ChampionshipRankingRow, ChampionshipScore } from './championship';
import { sortChampionshipRanking } from './championship';
import type { Modality } from './types';

export interface SimulatedChampionshipRow extends ChampionshipRankingRow {
  originalRank: number;
  projectedRank: number;
  rankDelta: number; // Diferencia de posición (ej: +3 subió 3 puestos)
  isSimulated: boolean;
}

export interface PodiumRequirement {
  targetRank: 1 | 2 | 3;
  targetLabel: string;
  leaderScoreTotal: number;
  leaderScoreBase: number;
  neededPointsTotal: number | null; // Puntos necesarios en la siguiente fecha para Total Actual (Top 3)
  neededPointsBase: number | null;  // Puntos necesarios en la siguiente fecha para Base Firme (Top 2)
  isAchievableTotal: boolean;
  isAchievableBase: boolean;
}

/**
 * Calcula la puntuación máxima por evento según la modalidad.
 * - .22 LR: Max 134 pts (2 series x 67 pts)
 * - Gran Calibre (.308 / .223): Max 87 pts (sin bonus) o 96 pts (con bonus)
 */
export function getMaxEventScore(modality: Modality, withBonus: boolean = true): number {
  if (modality === 'Gran Calibre' || modality === '.308 / .223 Gran Calibre') {
    return withBonus ? 96 : 87;
  }
  return 134; // .22 LR (2 series de 67 pts)
}

/**
 * Aplica simulación de un puntaje en un nuevo evento (o actualización de un evento existente)
 * a una lista de competidores y retorna la tabla proyectada reordenada con los deltas de posición.
 */
export function simulateChampionshipRankings(
  originalRankings: ChampionshipRankingRow[],
  simulations: Map<string, { eventId: number; score: number }[]>, // competitorName -> lista de puntajes simulados por evento
  sortBy: 'baseFirme' | 'totalActual' = 'totalActual'
): SimulatedChampionshipRow[] {
  // 1. Guardar ranking original ordenado
  const sortedOriginal = sortChampionshipRanking(originalRankings, sortBy);
  const originalPosMap = new Map<string, number>();
  sortedOriginal.forEach((row, idx) => {
    originalPosMap.set(row.competitorName, idx + 1);
  });

  // 2. Proyectar cada competidor
  const projectedRows: ChampionshipRankingRow[] = originalRankings.map(row => {
    const simList = simulations.get(row.competitorName);
    if (!simList || simList.length === 0) {
      return { ...row, events: { ...row.events } };
    }

    // Copiar eventos y aplicar simulaciones
    const newEvents = { ...row.events };
    simList.forEach(sim => {
      newEvents[sim.eventId] = {
        eventId: sim.eventId,
        score: sim.score,
        status: 'active',
        isBaseFirme: false,
        isTaken: false,
        isAtRisk: false,
        isDiscarded: false
      };
    });

    // Recalcular Base Firme (Top 2) y Total Actual (Top 3)
    const validScores: number[] = [];
    Object.values(newEvents).forEach(ev => {
      if (ev && ev.status === 'active') {
        validScores.push(ev.score);
      }
    });

    validScores.sort((a, b) => b - a);

    const baseFirme = (validScores[0] || 0) + (validScores[1] || 0);
    const totalActual = baseFirme + (validScores[2] || 0);

    return {
      ...row,
      events: newEvents,
      baseFirme,
      totalActual
    };
  });

  // 3. Reordenar con la simulación aplicada
  const sortedProjected = sortChampionshipRanking(projectedRows, sortBy);

  // 4. Calcular deltas
  return sortedProjected.map((row, idx) => {
    const projectedRank = idx + 1;
    const originalRank = originalPosMap.get(row.competitorName) || projectedRank;
    const rankDelta = originalRank - projectedRank; // Positivo = subió puestos
    const isSimulated = simulations.has(row.competitorName);

    return {
      ...row,
      originalRank,
      projectedRank,
      rankDelta,
      isSimulated
    };
  });
}

/**
 * Calcula los puntos necesarios en una nueva fecha para que el competidor indicado
 * alcance el Podio (1°, 2° o 3° puesto en el Campeonato).
 */
export function calculatePodiumRequirements(
  competitorName: string,
  rankings: ChampionshipRankingRow[],
  modality: Modality,
  sortBy: 'baseFirme' | 'totalActual' = 'totalActual'
): PodiumRequirement[] {
  const sorted = sortChampionshipRanking(rankings, sortBy);
  const compRow = sorted.find(r => r.competitorName === competitorName);
  if (!compRow) return [];

  const maxPossibleSingleEvent = getMaxEventScore(modality, true);

  // Obtener los puntajes actuales del competidor ordenados de mayor a menor
  const compScores: number[] = [];
  Object.values(compRow.events).forEach(ev => {
    if (ev && ev.status === 'active') compScores.push(ev.score);
  });
  compScores.sort((a, b) => b - a);

  // El 3er puntaje actual (si tiene 3+) que sería desplazado en Total Actual si saca una nota mejor
  const lowestTakenInTop3 = compScores.length >= 3 ? compScores[2] : 0;
  // El 2do puntaje actual (si tiene 2+) que sería desplazado en Base Firme si saca una nota mejor
  const lowestTakenInTop2 = compScores.length >= 2 ? compScores[1] : 0;

  const targets: (1 | 2 | 3)[] = [1, 2, 3];
  const labels: Record<1 | 2 | 3, string> = {
    1: '🏆 1° Puesto (Campeón)',
    2: '🥈 2° Puesto (Subcampeón)',
    3: '🥉 3° Puesto (Podio)'
  };

  return targets.map(targetRank => {
    const leaderIndex = targetRank - 1;
    const leaderRow = sorted[leaderIndex];

    if (!leaderRow || leaderRow.competitorName === competitorName) {
      return {
        targetRank,
        targetLabel: labels[targetRank],
        leaderScoreTotal: compRow.totalActual,
        leaderScoreBase: compRow.baseFirme,
        neededPointsTotal: 0,
        neededPointsBase: 0,
        isAchievableTotal: true,
        isAchievableBase: true
      };
    }

    // Puntos necesarios para superar el Total Actual del líder
    const targetTotal = leaderRow.totalActual + 1; // +1 para superar
    const currentTotalWithoutLowest = compRow.totalActual - lowestTakenInTop3;
    let neededPointsTotal = targetTotal - currentTotalWithoutLowest;
    if (neededPointsTotal < 0) neededPointsTotal = 0;

    // Puntos necesarios para superar la Base Firme del líder
    const targetBase = leaderRow.baseFirme + 1;
    const currentBaseWithoutLowest = compRow.baseFirme - lowestTakenInTop2;
    let neededPointsBase = targetBase - currentBaseWithoutLowest;
    if (neededPointsBase < 0) neededPointsBase = 0;

    const isAchievableTotal = neededPointsTotal !== null && neededPointsTotal <= maxPossibleSingleEvent;
    const isAchievableBase = neededPointsBase !== null && neededPointsBase <= maxPossibleSingleEvent;

    return {
      targetRank,
      targetLabel: labels[targetRank],
      leaderScoreTotal: leaderRow.totalActual,
      leaderScoreBase: leaderRow.baseFirme,
      neededPointsTotal: isAchievableTotal ? neededPointsTotal : null,
      neededPointsBase: isAchievableBase ? neededPointsBase : null,
      isAchievableTotal,
      isAchievableBase
    };
  });
}
