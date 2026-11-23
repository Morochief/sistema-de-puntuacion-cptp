import { db } from './db';
import { supabase } from './supabase';
import { showToast } from './modals';
import type { Table } from 'dexie';
import type { SyncMeta } from './types';

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

/** Registro con cambios locales todavía no subidos (los registros viejos sin marca cuentan como pendientes). */
function isPendingPush(r: SyncMeta): boolean {
  return r._dirty !== 0;
}

/** Quita los metadatos de sincronización para comparar contenido. */
function stripMeta<T extends SyncMeta>(r: T): Omit<T, '_dirty' | '_syncRev'> {
  const { _dirty, _syncRev, ...rest } = r as any;
  return rest;
}

let syncRevCounter = 0;
/** Valor único para marcar escrituras hechas por la sincronización (no cuentan como cambio local). */
export function nextSyncRev(): number {
  syncRevCounter = (syncRevCounter + 1) % 1000;
  return Date.now() * 1000 + syncRevCounter;
}

/**
 * Marca como "subidos" los registros enviados, solo si no cambiaron desde que se leyeron
 * (si el usuario editó algo mientras se subía, queda pendiente para la próxima subida).
 */
async function markPushed<T extends SyncMeta & { id?: number }>(table: Table<any, any, any>, pushed: T[]): Promise<void> {
  if (pushed.length === 0) return;
  await db.transaction('rw', table, async () => {
    for (const snap of pushed) {
      if (snap.id === undefined) continue;
      const current = await table.get(snap.id);
      if (!current) continue;
      if (JSON.stringify(stripMeta(current)) === JSON.stringify(stripMeta(snap))) {
        await table.update(snap.id, { _dirty: 0, _syncRev: nextSyncRev() } as any);
      }
    }
  });
}

/** Cantidad de registros locales con cambios pendientes de subir. */
export async function countPendingChanges(): Promise<number> {
  const [e, p, s, m] = await Promise.all([
    db.events.filter(isPendingPush).count(),
    db.participants.filter(isPendingPush).count(),
    db.series.filter(isPendingPush).count(),
    db.masterCompetitors.filter(isPendingPush).count(),
  ]);
  return e + p + s + m;
}

/**
 * Sube a la nube (Supabase) los registros locales con cambios pendientes, con upsert
 * por UUID determinista. Ya no sube toda la base: así un dispositivo con datos viejos
 * no pisa lo que cargó otro dispositivo.
 */
export async function pushLocalDatabaseToCloud(): Promise<SyncResult> {
  try {
    console.log('[Sync] Iniciando subida local -> Supabase...');

    // Obtener solo los registros con cambios pendientes
    const localEvents = await db.events.filter(isPendingPush).toArray();
    const localParticipants = await db.participants.filter(isPendingPush).toArray();
    const localSeries = await db.series.filter(isPendingPush).toArray();
    const localMasterCompetitors = await db.masterCompetitors.filter(isPendingPush).toArray();

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
        championship_date: e.championshipDate || null,
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

    // Todo se subió bien: marcar como sincronizado
    await markPushed(db.events, localEvents);
    await markPushed(db.participants, localParticipants);
    await markPushed(db.series, localSeries);
    await markPushed(db.masterCompetitors, localMasterCompetitors);

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
 * Aplica un registro bajado de la nube sin pisar cambios locales pendientes de subir.
 * Conserva los campos que la nube no guarda (ej: categoría/teléfono del Padrón, rifle compartido).
 */
async function applyCloudRecord(
  table: Table<any, any, any>, id: number, mapped: Record<string, unknown>, keepLocalChanges: boolean
): Promise<void> {
  if (!id) return;
  const local = await table.get(id);
  if (keepLocalChanges && local && local._dirty === 1) return; // gana el cambio local que todavía no se subió
  await table.put({ ...(local || {}), ...mapped, id, _dirty: 0, _syncRev: nextSyncRev() });
}

/** Aplica un borrado lógico venido de la nube (salvo que haya cambios locales pendientes). */
async function applyCloudDelete(table: Table<any, any, any>, id: number, keepLocalChanges: boolean): Promise<void> {
  if (!id) return;
  const local = await table.get(id);
  if (!local || (local as any).is_deleted) return;
  if (keepLocalChanges && local._dirty === 1) return;
  await table.update(id, { is_deleted: true, _dirty: 0, _syncRev: nextSyncRev() } as any);
}

/**
 * Descarga todos los registros desde Supabase y los inserta/actualiza en Dexie (IndexedDB)
 * eliminando localmente lo que haya sido borrado en la nube (excepto ítems creados offline hace menos de 5 minutos).
 */
export async function pullCloudDatabaseToLocal(
  options: { keepLocalChanges?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  // Por defecto no se pisan cambios locales pendientes de subir. Los espectadores
  // (que nunca suben) descargan con keepLocalChanges=false: la nube manda siempre.
  const keepLocalChanges = options.keepLocalChanges ?? true;
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
        if (e.is_deleted) {
          await applyCloudDelete(db.events, localId, keepLocalChanges);
          continue;
        }
        await applyCloudRecord(db.events, localId, {
          name: e.name,
          date: e.date,
          location: e.location || '',
          modality: e.modality || '.22 LR',
          championshipDate: e.championship_date || undefined,
          createdAt: new Date(e.created_at).getTime(),
          is_deleted: false,
          isPilot: !!e.is_pilot
        }, keepLocalChanges);
      }
    }

    if (cloudParticipants) {
      for (const p of cloudParticipants) {
        const localId = fromDeterministicUuid(p.id);
        if (p.is_deleted) {
          await applyCloudDelete(db.participants, localId, keepLocalChanges);
          continue;
        }
        const localEventId = fromDeterministicUuid(p.event_id);
        const catParts = (p.category || '').split('::');
        const rawCategory = catParts[0] || '';
        const rawPaymentStatus = p.payment_status || (catParts[1] as any) || 'paid';
        const rawStatus = p.status || (catParts[2] as any) || 'active';
        const rawRaffle = p.present_for_raffle !== null && p.present_for_raffle !== undefined
          ? !!p.present_for_raffle
          : (catParts[3] === '1' || catParts.length === 1);

        await applyCloudRecord(db.participants, localId, {
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
          is_deleted: false
        }, keepLocalChanges);
      }
    }

    if (cloudSeries) {
      // 1. Agrupar series no borradas por (participant_id, series_number)
      const activeSeries = cloudSeries.filter(s => !s.is_deleted);
      const groups = new Map<string, typeof cloudSeries>();
      for (const s of activeSeries) {
        const key = `${s.participant_id}_${s.series_number}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(s);
      }

      // 2. Identificar la más nueva de cada grupo y marcar el resto como duplicados
      const duplicateIds: string[] = [];
      for (const [_, list] of groups.entries()) {
        if (list.length > 1) {
          // Ordenar de más nueva a más vieja (created_at desc)
          list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          // La primera (index 0) es la buena/reciente. Las demás son duplicadas.
          for (let i = 1; i < list.length; i++) {
            duplicateIds.push(list[i].id);
          }
        }
      }

      // 3. Actualizar en Supabase para que queden borradas lógicamente en la nube permanentemente
      if (duplicateIds.length > 0) {
        console.log(`[Sync] Limpiando ${duplicateIds.length} series duplicadas en la nube...`);
        const { error: updErr } = await supabase
          .from('series')
          .update({ is_deleted: true })
          .in('id', duplicateIds);
        if (updErr) {
          console.error('[Sync] Error al marcar duplicados en la nube:', updErr);
        }
      }

      // 4. Escribir series en IndexedDB
      for (const s of cloudSeries) {
        const localId = fromDeterministicUuid(s.id);
        // Si el registro está borrado o fue identificado como duplicado, marcarlo como borrado localmente
        if (s.is_deleted || duplicateIds.includes(s.id)) {
          await applyCloudDelete(db.series, localId, keepLocalChanges);
          continue;
        }
        const localEventId = fromDeterministicUuid(s.event_id);
        const localParticipantId = fromDeterministicUuid(s.participant_id);
        await applyCloudRecord(db.series, localId, {
          eventId: localEventId,
          participantId: localParticipantId,
          seriesNumber: s.series_number,
          shots: s.shots,
          totalScore: s.total_score,
          bonusActive: !!s.bonus_active,
          createdAt: new Date(s.created_at).getTime(),
          is_deleted: false
        }, keepLocalChanges);
      }
    }

    if (cloudMaster) {
      for (const m of cloudMaster) {
        const localId = fromDeterministicUuid(m.id);
        await applyCloudRecord(db.masterCompetitors, localId, {
          name: m.name,
          championshipTieRank: m.championship_tie_rank || undefined,
          createdAt: new Date(m.created_at).getTime(),
          is_deleted: !!m.is_deleted
        }, keepLocalChanges);
      }
    }

    // 5. Limpieza local post-sincronización para evitar duplicados en IndexedDB
    try {
      const allLocalSeries = await db.series.toArray();
      const allLocalEvents = await db.events.toArray();
      
      const eventModalityMap = new Map<number, string>();
      for (const e of allLocalEvents) {
        if (e.id !== undefined) {
          eventModalityMap.set(e.id, e.modality || '.22 LR');
        }
      }

      const activeLocalSeries = allLocalSeries.filter(s => !s.is_deleted);
      const localGroups = new Map<string, typeof allLocalSeries>();
      
      for (const s of activeLocalSeries) {
        const key = `${s.participantId}_${s.seriesNumber}`;
        if (!localGroups.has(key)) {
          localGroups.set(key, []);
        }
        localGroups.get(key)!.push(s);
      }

      for (const [key, list] of localGroups.entries()) {
        if (list.length > 1) {
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          for (let i = 1; i < list.length; i++) {
            const dup = list[i];
            if (dup.id !== undefined) {
              await db.series.update(dup.id, { is_deleted: true }).catch(() => {});
              console.log(`[Sync-Cleanup] Marcado duplicado local ID ${dup.id} como borrado (Participante: ${dup.participantId}, Serie: ${dup.seriesNumber})`);
            }
          }
        }
      }

      for (const s of activeLocalSeries) {
        const modality = eventModalityMap.get(s.eventId) || '.22 LR';
        const isCFModality = modality === '.308' || modality === '.223' || modality === '21 Blackjack';
        if (isCFModality && s.seriesNumber > 1) {
          if (s.id !== undefined) {
            await db.series.update(s.id, { is_deleted: true }).catch(() => {});
            console.log(`[Sync-Cleanup] Marcada serie local incorrecta ID ${s.id} (Serie: ${s.seriesNumber}) como borrada para modalidad Fuego Central (Evento: ${s.eventId})`);
          }
        }
      }
    } catch (cleanupErr) {
      console.error('[Sync-Cleanup] Error en la autolimpieza local:', cleanupErr);
    }

    console.log('[Sync] Datos de la nube sincronizados con exito (upsert).');
    return { success: true };
  } catch (err: any) {
    console.error('[Sync] Error en pullCloudDatabaseToLocal:', err);
    return { success: false, error: err.message || String(err) };
  }
}
