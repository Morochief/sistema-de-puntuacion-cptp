/**
 * championship.ts
 * Carga los datos del Campeonato General desde la base local (Dexie) y delega
 * el cálculo en championshipCore.ts (lógica pura: Top 2, Top 3, Top Gun, En Riesgo).
 */
import { db } from './db';
import type { ShootingEvent, Modality } from './types';
import { computeChampionshipRankings, selectChampionshipEvents, type ChampionshipRankingRow } from './championshipCore';

export {
  sortChampionshipRanking,
  normalizeName,
  resolveEventModality,
  type ChampionshipScore,
  type ChampionshipRankingRow,
  type ChampionshipSortKey
} from './championshipCore';

export async function getChampionshipData(
  year: number,
  modality: Modality = '.22 LR'
): Promise<{ rankings: ChampionshipRankingRow[]; allEvents: ShootingEvent[] }> {
  const allStoredEvents = await db.events.filter((item: any) => !item.is_deleted).toArray();
  const events = selectChampionshipEvents(allStoredEvents, year, modality);
  const eventIds = events.map(e => e.id!).filter(id => id != null);
  if (eventIds.length === 0) return { rankings: [], allEvents: [] };

  const [participants, series, masterCompetitors] = await Promise.all([
    db.participants.where('eventId').anyOf(eventIds).filter((item: any) => !item.is_deleted).toArray(),
    db.series.where('eventId').anyOf(eventIds).filter((item: any) => !item.is_deleted).toArray(),
    db.masterCompetitors.filter((item: any) => !item.is_deleted).toArray()
  ]);

  return computeChampionshipRankings({ events, participants, series, masterCompetitors, year, modality });
}

/** Años que tienen al menos un evento de campeonato (no piloto), de más reciente a más antiguo. */
export async function getChampionshipYears(): Promise<number[]> {
  const events = await db.events.filter((item: any) => !item.is_deleted && !item.isPilot).toArray();
  const years = new Set<number>();
  for (const e of events) {
    const y = new Date(e.date + 'T12:00:00').getFullYear();
    if (!isNaN(y)) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}
