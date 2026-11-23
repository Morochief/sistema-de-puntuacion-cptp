/**
 * championshipCore.ts
 * Lógica pura (sin base de datos ni DOM) del Campeonato General Anual.
 *
 * Reglas:
 * - Top 2 (Base Firme): suma de los 2 mejores puntajes del año.
 * - Top 3 (Total Actual): suma de los 3 mejores puntajes del año.
 * - Top Gun: suma de los 4 mejores puntajes del año.
 * - En Riesgo: el 3er mejor puntaje, mientras falten fechas por disputar
 *   (temporada abierta), porque una nota mejor en una fecha futura lo desplaza.
 * - Descarte: puntajes más allá del Top 3.
 * - Las fechas con DQ, DNS o sin inscripción valen 0 y no reciben etiqueta
 *   de Top 2 / Top 3 / Riesgo / Descarte.
 */
import type { ShootingEvent, Participant, Series, MasterCompetitor, Modality } from './types';

export type ChampionshipSortKey = 'baseFirme' | 'totalActual' | 'mejores4';

export interface ChampionshipScore {
  eventId: number;
  score: number;
  status: 'active' | 'dq' | 'dns';
  isBaseFirme: boolean; // Entró en el Top 2
  isTaken: boolean;     // Entró en el Top 3 (Total Actual)
  isAtRisk: boolean;    // Es el 3er puntaje y todavía faltan fechas (puede ser desplazado)
  isDiscarded: boolean; // Peor que el 3er puntaje (se descarta del Top 3)
}

export interface ChampionshipRankingRow {
  competitorName: string;
  category: string;
  events: Record<number, ChampionshipScore | null>;
  totalActual: number; // Top 3: suma de los 3 mejores
  baseFirme: number;   // Top 2: suma de los 2 mejores
  mejores4: number;    // Top Gun: suma de los 4 mejores
  tieRank?: number;    // Posición táctica manual en caso de empate general
}

/** Normaliza un nombre para agrupar: sin tildes, sin espacios dobles, minúsculas. */
export function normalizeName(name: string): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Modalidad efectiva de un evento. Misma regla que Analytics:
 * los eventos antiguos guardados como '.22 LR' por defecto pero cuyo nombre
 * o fecha de campeonato dice ".308" o ".223" se asignan a esa modalidad.
 */
export function resolveEventModality(e: Pick<ShootingEvent, 'modality' | 'name' | 'championshipDate'>): Modality {
  if (e.name?.includes('.308') || e.championshipDate?.includes('.308')) return '.308';
  if (e.name?.includes('.223') || e.championshipDate?.includes('.223')) return '.223';
  return e.modality || '.22 LR';
}

/**
 * Puntaje de un tirador en un evento: suma de sus series, contando una sola
 * vez cada número de serie (si hay duplicados por sincronización, gana la más reciente).
 */
export function sumParticipantSeries(series: Series[]): number {
  const bySeriesNumber = new Map<number, Series>();
  for (const s of series) {
    const prev = bySeriesNumber.get(s.seriesNumber);
    if (!prev || (s.createdAt ?? 0) >= (prev.createdAt ?? 0)) {
      bySeriesNumber.set(s.seriesNumber, s);
    }
  }
  let total = 0;
  bySeriesNumber.forEach(s => { total += Number(s.totalScore) || 0; });
  return total;
}

/**
 * Asigna las marcas (Top 2 / Top 3 / Riesgo / Descarte) y calcula los totales
 * de una fila a partir de sus celdas. Devuelve celdas nuevas (no muta las recibidas).
 */
export function applyPlacements(
  events: Record<number, ChampionshipScore | null>,
  seasonOpen: boolean
): { events: Record<number, ChampionshipScore | null>; baseFirme: number; totalActual: number; mejores4: number } {
  const out: Record<number, ChampionshipScore | null> = {};
  const active: ChampionshipScore[] = [];

  for (const key of Object.keys(events)) {
    const id = Number(key);
    const ev = events[id];
    if (!ev) { out[id] = null; continue; }
    const copy: ChampionshipScore = { ...ev, isBaseFirme: false, isTaken: false, isAtRisk: false, isDiscarded: false };
    out[id] = copy;
    if (copy.status === 'active') active.push(copy);
  }

  // Orden estable: a igual puntaje se respeta el orden de las fechas
  active.sort((a, b) => b.score - a.score);

  let baseFirme = 0, totalActual = 0, mejores4 = 0;
  active.forEach((ev, i) => {
    ev.isBaseFirme = i < 2;
    ev.isTaken = i < 3;
    ev.isAtRisk = i === 2 && seasonOpen;
    ev.isDiscarded = i >= 3;
    if (i < 2) baseFirme += ev.score;
    if (i < 3) totalActual += ev.score;
    if (i < 4) mejores4 += ev.score;
  });

  return { events: out, baseFirme, totalActual, mejores4 };
}

export interface ChampionshipInput {
  events: ShootingEvent[];
  participants: Participant[];
  series: Series[];
  masterCompetitors: MasterCompetitor[];
  year: number;
  modality: Modality;
  /** Si todavía faltan fechas por disputar. Por defecto: el año seleccionado no terminó. */
  seasonOpen?: boolean;
}

/** Filtra y ordena los eventos que cuentan para el campeonato de ese año y modalidad. */
export function selectChampionshipEvents(events: ShootingEvent[], year: number, modality: Modality): ShootingEvent[] {
  return events
    .filter(e => {
      if (e.is_deleted || e.isPilot) return false; // Eventos piloto no cuentan
      if (resolveEventModality(e) !== modality) return false;
      const dateObj = new Date(e.date + 'T12:00:00');
      return !isNaN(dateObj.getTime()) && dateObj.getFullYear() === year;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeChampionshipRankings(input: ChampionshipInput): { rankings: ChampionshipRankingRow[]; allEvents: ShootingEvent[] } {
  const yearEvents = selectChampionshipEvents(input.events, input.year, input.modality);
  if (yearEvents.length === 0) return { rankings: [], allEvents: [] };

  const seasonOpen = input.seasonOpen ?? input.year >= new Date().getFullYear();
  const eventIds = new Set(yearEvents.map(e => e.id!));
  const eventDate = new Map(yearEvents.map(e => [e.id!, e.date]));

  const seriesByParticipant = new Map<number, Series[]>();
  for (const s of input.series) {
    if (s.is_deleted || !eventIds.has(s.eventId)) continue;
    if (!seriesByParticipant.has(s.participantId)) seriesByParticipant.set(s.participantId, []);
    seriesByParticipant.get(s.participantId)!.push(s);
  }

  const mastersByName = new Map<string, MasterCompetitor>();
  for (const mc of input.masterCompetitors) {
    if (mc.is_deleted) continue;
    const key = normalizeName(mc.name);
    if (!mastersByName.has(key)) mastersByName.set(key, mc);
  }

  const groupedByName = new Map<string, Participant[]>();
  for (const p of input.participants) {
    if (p.is_deleted || !eventIds.has(p.eventId)) continue;
    const norm = normalizeName(p.name);
    if (!groupedByName.has(norm)) groupedByName.set(norm, []);
    groupedByName.get(norm)!.push(p);
  }

  const rankings: ChampionshipRankingRow[] = [];

  for (const [normName, parts] of groupedByName.entries()) {
    const masterInfo = mastersByName.get(normName);

    // Categoría: la de la inscripción más reciente distinta de 'General', luego la del Padrón
    const byNewest = [...parts].sort((a, b) => (eventDate.get(b.eventId) || '').localeCompare(eventDate.get(a.eventId) || ''));
    let bestCategory = byNewest.find(p => p.category && p.category !== 'General')?.category || 'General';
    if (bestCategory === 'General' && masterInfo?.category) bestCategory = masterInfo.category;

    const displayName = (masterInfo?.name || parts[0]?.name || normName).trim();

    const cells: Record<number, ChampionshipScore | null> = {};
    for (const e of yearEvents) {
      const entries = parts.filter(p => p.eventId === e.id);
      if (entries.length === 0) { cells[e.id!] = null; continue; }

      // Si por error quedó inscrito dos veces en la misma fecha, se toma la inscripción con mejor puntaje
      let best: ChampionshipScore | null = null;
      for (const p of entries) {
        const status = p.status || 'active';
        const score = status === 'active' ? sumParticipantSeries(seriesByParticipant.get(p.id!) || []) : 0;
        const cell: ChampionshipScore = { eventId: e.id!, score, status, isBaseFirme: false, isTaken: false, isAtRisk: false, isDiscarded: false };
        if (!best || (cell.status === 'active' && (best.status !== 'active' || cell.score > best.score))) best = cell;
      }
      cells[e.id!] = best;
    }

    const placed = applyPlacements(cells, seasonOpen);
    rankings.push({
      competitorName: displayName,
      category: bestCategory,
      events: placed.events,
      baseFirme: placed.baseFirme,
      totalActual: placed.totalActual,
      mejores4: placed.mejores4,
      tieRank: masterInfo?.championshipTieRank
    });
  }

  return { rankings, allEvents: yearEvents };
}

export function sortChampionshipRanking(
  rankings: ChampionshipRankingRow[],
  sortBy: ChampionshipSortKey = 'totalActual'
): ChampionshipRankingRow[] {
  return [...rankings].sort((a, b) => {
    // 1. Criterio primario
    if (a[sortBy] !== b[sortBy]) return b[sortBy] - a[sortBy];
    // 2. Criterio secundario (desempate por el otro total)
    const secondarySort = sortBy === 'totalActual' ? 'baseFirme' : 'totalActual';
    if (a[secondarySort] !== b[secondarySort]) return b[secondarySort] - a[secondarySort];
    if (sortBy === 'mejores4' && a.baseFirme !== b.baseFirme) return b.baseFirme - a.baseFirme;
    // 3. Desempate táctico manual (Padrón Maestro)
    const rankA = a.tieRank ?? 999;
    const rankB = b.tieRank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    // 4. Alfabético final
    return a.competitorName.localeCompare(b.competitorName);
  });
}
