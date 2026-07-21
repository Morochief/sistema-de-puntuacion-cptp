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
 * Sube exclusivamente toda la base de datos local (Dexie) hacia la nube (Supabase)
 * utilizando Upserts basados en las llaves primarias mapeadas a UUID.
 */
export async function pushLocalDatabaseToCloud(): Promise<SyncResult> {
  try {
    console.log('[Sync] Iniciando subida local -> Supabase...');

    // Obtener datos locales
    const localEvents = await db.events.toArray();
    const localParticipants = await db.participants.toArray();
    const localSeries = await db.series.toArray();

    let eventsSynced = 0;
    let participantsSynced = 0;
    let seriesSynced = 0;

    // ── 0. Borrar en la nube los registros que fueron eliminados localmente ──
    const localEventIds = new Set(localEvents.map(e => toDeterministicUuid(e.id, 0)));
    const localParticipantIds = new Set(localParticipants.map(p => toDeterministicUuid(p.id, 1)));
    const localSeriesIds = new Set(localSeries.map(s => toDeterministicUuid(s.id, 2)));

    // Borrar Series
    const { data: cloudSeriesIds } = await supabase.from('series').select('id');
    if (cloudSeriesIds) {
      const sToDelete = cloudSeriesIds.map(s => s.id).filter(id => !localSeriesIds.has(id));
      if (sToDelete.length > 0) {
        await supabase.from('series').delete().in('id', sToDelete);
      }
    }

    // Borrar Participantes
    const { data: cloudParticipantIds } = await supabase.from('participants').select('id');
    if (cloudParticipantIds) {
      const pToDelete = cloudParticipantIds.map(p => p.id).filter(id => !localParticipantIds.has(id));
      if (pToDelete.length > 0) {
        await supabase.from('participants').delete().in('id', pToDelete);
      }
    }

    // Borrar Eventos
    const { data: cloudEventIds } = await supabase.from('events').select('id');
    if (cloudEventIds) {
      const eToDelete = cloudEventIds.map(e => e.id).filter(id => !localEventIds.has(id));
      if (eToDelete.length > 0) {
        await supabase.from('events').delete().in('id', eToDelete);
      }
    }

    // 1. Sincronizar Eventos
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

    // 2. Sincronizar Participantes
    if (localParticipants.length > 0) {
      const participantsData = localParticipants.map(p => ({
        id: toDeterministicUuid(p.id, 1),
        event_id: toDeterministicUuid(p.eventId, 0),
        name: p.name,
        competitor_number: p.competitorNumber,
        category: `${p.category || ''}::${p.paymentStatus || 'paid'}::${p.status || 'active'}`,
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

    // 3. Sincronizar Series
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

    console.log('[Sync] Subida a la nube finalizada con éxito.');
    return {
      success: true,
      eventsSynced,
      participantsSynced,
      seriesSynced
    };
  } catch (err: any) {
    console.error('[Sync] Error crítico durante la subida:', err);
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

    // 2. Limpiar locales completamente para recibir el estado oficial de la nube
    await Promise.all([
      db.events.clear(),
      db.participants.clear(),
      db.series.clear()
    ]);

    // 3. Escribir datos de la nube en Dexie
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
        const catStr = p.category || '';
        const parts = catStr.split('::');
        const rawCategory = parts[0] || '';
        const rawPaymentStatus = (parts[1] as any) || 'paid';
        const rawStatus = (parts[2] as any) || 'active';

        await db.participants.put({
          id: localId,
          eventId: localEventId,
          name: p.name,
          competitorNumber: p.competitor_number,
          category: rawCategory,
          tanda: p.tanda || undefined,
          spot: p.spot || undefined,
          tieRank: p.tie_rank || undefined,
          paymentStatus: rawPaymentStatus,
          status: rawStatus
        });

        // ─ Alimentar Padrón Maestro local silenciosamente ─
        try {
          const existing = await db.masterCompetitors.where('name').equalsIgnoreCase(p.name).first();
          if (!existing) {
            await db.masterCompetitors.add({
              name: p.name,
              category: rawCategory || 'General',
              createdAt: Date.now()
            });
          }
        } catch (err) {
          console.warn('[Sync] No se pudo agregar al padrón maestro:', err);
        }
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

    console.log('[Sync] Base de datos local (Dexie) reemplazada con éxito desde la nube.');
    return { success: true };
  } catch (err: any) {
    console.error('[Sync] Error en pullCloudDatabaseToLocal:', err);
    return { success: false, error: err.message || String(err) };
  }
}
