import { db } from './db';
import { supabase } from './supabase';
import { showToast } from './modals';

export interface SyncResult {
  success: boolean;
  eventsSynced: number;
  participantsSynced: number;
  seriesSynced: number;
  error?: string;
}

/**
 * Convierte un ID numérico local de Dexie a un UUID válido en formato estándar RFC4122
 * de manera determinista según la tabla, evitando colisiones e invalidación de tipos en Postgres.
 */
function toDeterministicUuid(id: number | undefined, namespace: 0 | 1 | 2): string {
  if (id === undefined) return '00000000-0000-4000-0000-000000000000';
  const paddedId = String(id).padStart(12, '0');
  const namespaceStr = String(namespace).padStart(4, '0');
  return `00000000-0000-4000-${namespaceStr}-${paddedId}`;
}

/**
 * Sincroniza toda la base de datos local (Dexie) hacia la nube (Supabase)
 * utilizando Upserts basados en las llaves primarias mapeadas a UUID.
 */
export async function syncLocalDatabaseToCloud(): Promise<SyncResult> {
  try {
    console.log('[Sync] Iniciando sincronización local -> Supabase...');

    // 1. Obtener datos locales
    const localEvents = await db.events.toArray();
    const localParticipants = await db.participants.toArray();
    const localSeries = await db.series.toArray();

    let eventsSynced = 0;
    let participantsSynced = 0;
    let seriesSynced = 0;

    // 2. Sincronizar Eventos
    if (localEvents.length > 0) {
      const eventsData = localEvents.map(e => ({
        id: toDeterministicUuid(e.id, 0),
        name: e.name,
        date: e.date,
        location: e.location || null,
        created_at: new Date(e.createdAt).toISOString()
      }));

      const { error: eErr } = await supabase
        .from('events')
        .upsert(eventsData, { onConflict: 'id' });

      if (eErr) throw new Error(`Error sincronizando eventos: ${eErr.message}`);
      eventsSynced = localEvents.length;
    }

    // 3. Sincronizar Participantes
    if (localParticipants.length > 0) {
      const participantsData = localParticipants.map(p => ({
        id: toDeterministicUuid(p.id, 1),
        event_id: toDeterministicUuid(p.eventId, 0),
        name: p.name,
        competitor_number: p.competitorNumber,
        category: p.category || null,
        tanda: p.tanda || null,
        spot: p.spot || null,
        tie_rank: p.tieRank || null
      }));

      const { error: pErr } = await supabase
        .from('participants')
        .upsert(participantsData, { onConflict: 'id' });

      if (pErr) throw new Error(`Error sincronizando competidores: ${pErr.message}`);
      participantsSynced = localParticipants.length;
    }

    // 4. Sincronizar Series
    if (localSeries.length > 0) {
      const seriesData = localSeries.map(s => ({
        id: toDeterministicUuid(s.id, 2),
        event_id: toDeterministicUuid(s.eventId, 0),
        participant_id: toDeterministicUuid(s.participantId, 1),
        series_number: s.seriesNumber,
        shots: s.shots,
        total_score: s.totalScore,
        created_at: new Date(s.createdAt).toISOString()
      }));

      const { error: sErr } = await supabase
        .from('series')
        .upsert(seriesData, { onConflict: 'id' });

      if (sErr) throw new Error(`Error sincronizando series: ${sErr.message}`);
      seriesSynced = localSeries.length;
    }

    console.log('[Sync] Sincronización finalizada con éxito.');
    return {
      success: true,
      eventsSynced,
      participantsSynced,
      seriesSynced
    };
  } catch (err: any) {
    console.error('[Sync] Error crítico durante la sincronización:', err);
    return {
      success: false,
      eventsSynced: 0,
      participantsSynced: 0,
      seriesSynced: 0,
      error: err.message || String(err)
    };
  }
}
