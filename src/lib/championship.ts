/**
 * championship.ts
 * Módulo puro de lógica matemática para el Campeonato General.
 * Calcula los puntajes de todos los tiradores aplicando reglas de:
 * - Base Firme (Top 2)
 * - Total Actual (Top 3)
 */
import { db } from './db';
import type { ShootingEvent, Participant, Series, MasterCompetitor } from './types';

export interface ChampionshipScore {
  eventId: number;
  score: number;
  status: 'active' | 'dq' | 'dns';
  isBaseFirme: boolean; // Entró en el Top 2
  isTaken: boolean;     // Entró en el Top 3 (Total Actual)
  isAtRisk: boolean;    // Es el 3er puntaje (puede ser descartado en F4)
  isDiscarded: boolean; // Peor que el 3er puntaje (se descarta de todo)
}

export interface ChampionshipRankingRow {
  competitorName: string;
  category: string;
  events: Record<number, ChampionshipScore | null>; 
  totalActual: number; // Suma de los 3 mejores
  baseFirme: number;   // Suma de los 2 mejores
  tieRank?: number;    // Posición táctica manual en caso de empate general
}

export async function getChampionshipData(year: number): Promise<{ rankings: ChampionshipRankingRow[], allEvents: ShootingEvent[] }> {
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
    .sort((a, b) => a.date.localeCompare(b.date));

  if (yearEvents.length === 0) {
    return { rankings: [], allEvents: [] };
  }

  const eventIds = yearEvents.map(e => e.id!);
  const allParticipants = await db.participants.where('eventId').anyOf(eventIds).toArray();
  const allSeries = await db.series.where('eventId').anyOf(eventIds).toArray();
  const masterCompetitors = await db.masterCompetitors.toArray();

  const groupedByName = new Map<string, Participant[]>();
  for (const p of allParticipants) {
    const norm = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (!groupedByName.has(norm)) {
      groupedByName.set(norm, []);
    }
    groupedByName.get(norm)!.push(p);
  }

  const rankings: ChampionshipRankingRow[] = [];

  for (const [normName, parts] of groupedByName.entries()) {
    const masterInfo = masterCompetitors.find(mc => mc.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === normName);
    
    // Buscar la categoría real usada en los eventos, priorizando una que no sea 'General'
    let bestCategory = 'General';
    for (const p of parts) {
      if (p.category && p.category !== 'General') {
        bestCategory = p.category;
        break;
      }
    }
    if (bestCategory === 'General' && masterInfo?.category) {
      bestCategory = masterInfo.category;
    }

    const tieRank = masterInfo?.championshipTieRank;
    const displayName = masterInfo?.name || parts[0]?.name || normName;

    const row: ChampionshipRankingRow = {
      competitorName: displayName.trim(),
      category: bestCategory,
      events: {},
      totalActual: 0,
      baseFirme: 0,
      tieRank
    };

    const scoresList: { eventId: number; score: number, status: 'active' | 'dq' | 'dns' }[] = [];
    let hasParticipated = false;

    for (const e of yearEvents) {
      const pForEvent = parts.find(p => p.eventId === e.id);
      if (!pForEvent) {
        row.events[e.id!] = null; // null = DNS o no inscripto
        scoresList.push({ eventId: e.id!, score: 0, status: 'dns' });
      } else {
        hasParticipated = true;
        const status = pForEvent.status || 'active';
        if (status === 'dq' || status === 'dns') {
          scoresList.push({ eventId: e.id!, score: 0, status });
        } else {
          const pSeries = allSeries.filter(s => s.participantId === pForEvent.id);
          const totalScore = pSeries.reduce((sum, s) => sum + s.totalScore, 0);
          scoresList.push({ eventId: e.id!, score: totalScore, status: 'active' });
        }
      }
    }

    if (!hasParticipated) continue;

    // Ordenar puntajes de mayor a menor
    const sortedScores = [...scoresList].sort((a, b) => b.score - a.score);
    let totalActual = 0;
    let baseFirme = 0;

    const userParticipations = yearEvents.filter(e => row.events[e.id!] !== null).length;

    for (let i = 0; i < sortedScores.length; i++) {
      const s = sortedScores[i];
      const isBaseFirme = i < 2;
      const isTaken = i < 3; // Top 3
      const isAtRisk = i === 2 && userParticipations < 4; // El 3ro en discordia si faltan fechas al tirador
      const isDiscarded = i >= 3;

      if (isBaseFirme) baseFirme += s.score;
      if (isTaken) totalActual += s.score;

      // Asignar el score al evento correspondiente. 
      // Ignoramos si es null (DNS puro sin anotarse).
      if (row.events[s.eventId] !== null) {
         row.events[s.eventId] = {
           eventId: s.eventId,
           score: s.score,
           status: s.status,
           isBaseFirme,
           isTaken,
           isAtRisk,
           isDiscarded
         };
      }
    }

    row.totalActual = totalActual;
    row.baseFirme = baseFirme;
    rankings.push(row);
  }

  return { rankings, allEvents: yearEvents };
}

export function sortChampionshipRanking(
  rankings: ChampionshipRankingRow[],
  sortBy: 'baseFirme' | 'totalActual' = 'totalActual'
): ChampionshipRankingRow[] {
  return [...rankings].sort((a, b) => {
    // 1. Criterio Primario
    if (a[sortBy] !== b[sortBy]) {
      return b[sortBy] - a[sortBy];
    }
    // 2. Criterio Secundario (Desempate por el otro total)
    const secondarySort = sortBy === 'totalActual' ? 'baseFirme' : 'totalActual';
    if (a[secondarySort] !== b[secondarySort]) {
      return b[secondarySort] - a[secondarySort];
    }
    // 3. Desempate táctico manual (MasterCompetitors)
    const rankA = a.tieRank ?? 999;
    const rankB = b.tieRank ?? 999;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    // 4. Alfabético final
    return a.competitorName.localeCompare(b.competitorName);
  });
}
