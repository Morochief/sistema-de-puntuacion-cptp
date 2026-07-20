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
 * Traduce un ID numérico local de Dexie a un UUID válido en formato estándar RFC4122
 * de manera determinista según la tabla, evitando colisiones e invalidación de tipos en Postgres.
 */
export function toDeterministicUuid(id: number | undefined, namespace: 0 | 1 | 2): string {
  if (id === undefined) return '00000000-0000-4000-0000-000000000000';
  const paddedId = String(id).padStart(12, '0');
  const namespaceStr = String(namespace).padStart(4, '0');
  return `00000000-0000-4000-${namespaceStr}-${paddedId}`;
}

/**
 * Sincroniza toda la base de datos local (Dexie) hacia la nube (Supabase)
 * utilizando un flujo bidireccional limpio de descarga (pull) y subida (push).
 */
export async function syncLocalDatabaseToCloud(): Promise<SyncResult> {
  try {
    console.log('[Sync] Iniciando sincronización local -> Supabase...');

    // 1. Descargamos primero y limpiamos los borrados de la nube para no re-subirlos
    const pullRes = await pullCloudDatabaseToLocal();
    if (!pullRes.success) {
      console.warn('[Sync] Advertencia: fallo al descargar antes de subir:', pullRes.error);
    }

    // 2. Obtener datos locales limpios después del pull
    const localEvents = await db.events.toArray();
    const localParticipants = await db.participants.toArray();
    const localSeries = await db.series.toArray();

    let eventsSynced = 0;
    let participantsSynced = 0;
    let seriesSynced = 0;

    // 3. Sincronizar Eventos
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

    // 4. Sincronizar Participantes
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

    // 5. Sincronizar Series
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

    console.log('[Sync] Sincronización bidireccional finalizada con éxito.');
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

/**
 * Traduce un UUID determinista de vuelta a su ID entero original de Dexie
 */
function fromDeterministicUuid(uuid: string): number {
  if (!uuid) return 0;
  const parts = uuid.split('-');
  const lastPart = parts[parts.length - 1];
  return parseInt(lastPart, 10);
}

/**
 * Descarga todos los registros desde Supabase y los inserta/actualiza en Dexie (IndexedDB)
 * eliminando localmente lo que haya sido borrado en la nube (excepto ítems creados offline hace menos de 5 minutos).
 */
export async function pullCloudDatabaseToLocal(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Sync] Descargando datos desde Supabase...');

    // 1. Obtener datos de Supabase
    const { data: cloudEvents, error: eErr } = await supabase.from('events').select('*');
    if (eErr) throw new Error(`Error descargando eventos: ${eErr.message}`);

    const { data: cloudParticipants, error: pErr } = await supabase.from('participants').select('*');
    if (pErr) throw new Error(`Error descargando competidores: ${pErr.message}`);

    const { data: cloudSeries, error: sErr } = await supabase.from('series').select('*');
    if (sErr) throw new Error(`Error descargando series: ${sErr.message}`);

    // Umbral de 5 minutos para proteger registros locales nuevos creados en modo offline
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

    // 2. Limpiar locales que ya no existen en la nube (borrados desde otro dispositivo)
    if (cloudEvents) {
      const cloudEventIds = new Set(cloudEvents.map(e => fromDeterministicUuid(e.id)));
      const localEvents = await db.events.toArray();
      for (const e of localEvents) {
        if (e.id && !cloudEventIds.has(e.id)) {
          // Si el evento tiene más de 5 minutos local y ya no está en Supabase, lo borramos de local
          if (e.createdAt < fiveMinutesAgo) {
            console.log(`[Sync] Borrando evento local ${e.id} porque no está en la nube.`);
            await db.events.delete(e.id);
            await db.participants.where('eventId').equals(e.id).delete();
            await db.series.where('eventId').equals(e.id).delete();
          }
        }
      }
    }

    if (cloudParticipants) {
      const cloudParticipantIds = new Set(cloudParticipants.map(p => fromDeterministicUuid(p.id)));
      const localParticipants = await db.participants.toArray();
      for (const p of localParticipants) {
        if (p.id && !cloudParticipantIds.has(p.id)) {
          // Solo borramos el competidor si no es parte de un evento offline nuevo
          const parentEvent = await db.events.get(p.eventId);
          if (!parentEvent || parentEvent.createdAt < fiveMinutesAgo) {
            console.log(`[Sync] Borrando competidor local ${p.id} porque no está en la nube.`);
            await db.participants.delete(p.id);
          }
        }
      }
    }

    if (cloudSeries) {
      const cloudSeriesIds = new Set(cloudSeries.map(s => fromDeterministicUuid(s.id)));
      const localSeries = await db.series.toArray();
      for (const s of localSeries) {
        if (s.id && !cloudSeriesIds.has(s.id)) {
          const parentEvent = await db.events.get(s.eventId);
          if (!parentEvent || parentEvent.createdAt < fiveMinutesAgo) {
            console.log(`[Sync] Borrando serie local ${s.id} porque no está en la nube.`);
            await db.series.delete(s.id);
          }
        }
      }
    }

    // 3. Escribir/Actualizar datos de la nube en Dexie
    if (cloudEvents) {
      for (const e of cloudEvents) {
        const localId = fromDeterministicUuid(e.id);
        await db.events.put({
          id: localId,
          name: e.name,
          date: e.date,
          location: e.location || '',
          createdAt: new Date(e.created_at).getTime()
        });
      }
    }

    if (cloudParticipants) {
      for (const p of cloudParticipants) {
        const localId = fromDeterministicUuid(p.id);
        const localEventId = fromDeterministicUuid(p.event_id);
        await db.participants.put({
          id: localId,
          eventId: localEventId,
          name: p.name,
          competitorNumber: p.competitor_number,
          category: p.category || '',
          tanda: p.tanda || undefined,
          spot: p.spot || undefined,
          tieRank: p.tie_rank || undefined
        });
      }
    }

    if (cloudSeries) {
      for (const s of cloudSeries) {
        const localId = fromDeterministicUuid(s.id);
        const localEventId = fromDeterministicUuid(s.event_id);
        const localParticipantId = fromDeterministicUuid(s.participant_id);
        await db.series.put({
          id: localId,
          eventId: localEventId,
          participantId: localParticipantId,
          seriesNumber: s.series_number,
          shots: s.shots,
          totalScore: s.total_score,
          createdAt: new Date(s.created_at).getTime()
        });
      }
    }

    console.log('[Sync] Base de datos local (Dexie) sincronizada con Supabase con éxito.');
    return { success: true };
  } catch (err: any) {
    console.error('[Sync] Error en pullCloudDatabaseToLocal:', err);
    return { success: false, error: err.message || String(err) };
  }
}
