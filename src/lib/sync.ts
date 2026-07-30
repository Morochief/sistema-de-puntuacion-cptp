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
export function toDeterministicUuid(id: number | undefined, namespace: 0 | 1 | 2 | 3): string {
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
    const localEvents = await db.events.filter((item: any) => !item.is_deleted).toArray();
    const localParticipants = await db.participants.filter((item: any) => !item.is_deleted).toArray();
    const localSeries = await db.series.filter((item: any) => !item.is_deleted).toArray();
    const localMasterCompetitors = await db.masterCompetitors.filter((item: any) => !item.is_deleted).toArray();

    let eventsSynced = 0;
    let participantsSynced = 0;
    let seriesSynced = 0;

    // --- Sincronización Destructiva Removida ---
    // Ya no se ejecutan deletes en la nube. Todo el borrado es lógico usando is_deleted.
    // 1. Sincronizar Eventos
    if (localEvents.length > 0) {
      const eventsData = localEvents.map(e => ({
        id: toDeterministicUuid(e.id, 0),
        name: e.name,
        date: e.date,
        location: e.location || null,
        modality: e.modality || '.22 LR',
        is_pilot: !!e.isPilot,
        created_at: new Date(e.createdAt).toISOString(),
        is_deleted: !!e.is_deleted
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
        category: (p.category || '').split('::')[0],
        payment_status: p.paymentStatus || 'paid',
        status: p.status || 'active',
        present_for_raffle: p.presentForRaffle !== undefined ? !!p.presentForRaffle : true,
        tanda: p.tanda || null,
        spot: p.spot || null,
        tie_rank: p.tieRank || null,
        tanda_s2: p.tandaS2 || null,
        spot_s2: p.spotS2 || null,
        sector: p.sector || null,
        sector_s2: p.sectorS2 || null,
        is_deleted: !!p.is_deleted
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
        bonus_active: !!s.bonusActive,
        created_at: new Date(s.createdAt).toISOString(),
        is_deleted: !!s.is_deleted
      }));

      const { error: sErr } = await supabase
        .from('series')
        .upsert(seriesData, { onConflict: 'id' });

      if (sErr) throw new Error(`Error sincronizando series: ${sErr.message}`);
      seriesSynced = localSeries.length;
    }

    // 4. Sincronizar Master Competitors
    if (localMasterCompetitors.length > 0) {
      const masterData = localMasterCompetitors.map(m => ({
        id: toDeterministicUuid(m.id, 3),
        name: m.name,
        championship_tie_rank: m.championshipTieRank || null,
        created_at: new Date(m.createdAt || Date.now()).toISOString(),
        is_deleted: !!m.is_deleted
      }));

      const { error: mErr } = await supabase
        .from('master_competitors')
        .upsert(masterData, { onConflict: 'id' });

      if (mErr) throw new Error(`Error sincronizando padrón maestro: ${mErr.message}`);
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

    const { data: cloudMaster, error: mErr } = await supabase.from('master_competitors').select('*');
    if (mErr) throw new Error(`Error descargando padrón maestro: ${mErr.message}`);

    // 2. Escribir datos de la nube en Dexie sin borrar locales (upsert)
    //    Los datos locales que no existen en la nube se conservan.
    if (cloudEvents) {
      for (const e of cloudEvents) {
        const localId = fromDeterministicUuid(e.id);
        const existing = await db.events.get(localId);
        // Si la nube dice is_deleted pero localmente existe y no estaba borrado, conservar el estado local
        const isDeleted = e.is_deleted ? (existing ? !!existing.is_deleted : true) : false;
        
        await db.events.put({
          id: localId,
          name: e.name,
          date: e.date,
          location: e.location || '',
          modality: e.modality || '.22 LR',
          createdAt: new Date(e.created_at).getTime(),
          is_deleted: isDeleted,
          isPilot: !!e.is_pilot
        });
      }
    }

    if (cloudParticipants) {
      for (const p of cloudParticipants) {
        const localId = fromDeterministicUuid(p.id);
        const existingP = await db.participants.get(localId);
        const isDeletedP = p.is_deleted ? (existingP ? !!existingP.is_deleted : true) : false;

        const localEventId = fromDeterministicUuid(p.event_id);
        const catParts = (p.category || '').split('::');
        const rawCategory = catParts[0] || '';
        const rawPaymentStatus = p.payment_status || (catParts[1] as any) || 'paid';
        const rawStatus = p.status || (catParts[2] as any) || 'active';
        const rawRaffle = p.present_for_raffle !== null && p.present_for_raffle !== undefined
          ? !!p.present_for_raffle
          : (catParts[3] === '1' || catParts.length === 1);

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
          status: rawStatus,
          presentForRaffle: rawRaffle,
          tandaS2: p.tanda_s2 || undefined,
          spotS2: p.spot_s2 || undefined,
          sector: p.sector || undefined,
          sectorS2: p.sector_s2 || undefined,
          is_deleted: isDeletedP
        });
      }
    }

    if (cloudSeries) {
      for (const s of cloudSeries) {
        const localId = fromDeterministicUuid(s.id);
        const existingS = await db.series.get(localId);
        const isDeletedS = s.is_deleted ? (existingS ? !!existingS.is_deleted : true) : false;

        const localEventId = fromDeterministicUuid(s.event_id);
        const localParticipantId = fromDeterministicUuid(s.participant_id);
        await db.series.put({
          id: localId,
          eventId: localEventId,
          participantId: localParticipantId,
          seriesNumber: s.series_number,
          shots: s.shots,
          totalScore: s.total_score,
          bonusActive: !!s.bonus_active,
          createdAt: new Date(s.created_at).getTime(),
          is_deleted: isDeletedS
        });
      }
    }

    if (cloudMaster) {
      for (const m of cloudMaster) {
        const localId = fromDeterministicUuid(m.id);
        await db.masterCompetitors.put({
          id: localId,
          name: m.name,
          championshipTieRank: m.championship_tie_rank || undefined,
          createdAt: new Date(m.created_at).getTime(),
          is_deleted: !!m.is_deleted
        });
      }
    }

    console.log('[Sync] Datos de la nube sincronizados con exito (upsert).');
    return { success: true };
  } catch (err: any) {
    console.error('[Sync] Error en pullCloudDatabaseToLocal:', err);
    return { success: false, error: err.message || String(err) };
  }
}
