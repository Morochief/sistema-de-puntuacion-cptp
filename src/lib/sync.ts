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
 * Sincroniza toda la base de datos local (Dexie) hacia la nube (Supabase)
 * utilizando Upserts basados en las llaves primarias numéricas actuales.
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
      // Mapeamos los campos a la estructura de Supabase
      const eventsData = localEvents.map(e => ({
        id: e.id,
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
        id: p.id,
        event_id: p.eventId,
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
        id: s.id,
        event_id: s.eventId,
        participant_id: s.participantId,
        series_number: s.seriesNumber,
        shots: s.shots, // Objeto JSONB
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
