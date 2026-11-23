import Dexie, { type EntityTable } from 'dexie';
import type { ShootingEvent, Participant, Series, MasterCompetitor } from './types';

const db = new Dexie('cptpScoring') as Dexie & {
  events: EntityTable<ShootingEvent, 'id'>;
  participants: EntityTable<Participant, 'id'>;
  series: EntityTable<Series, 'id'>;
  masterCompetitors: EntityTable<MasterCompetitor, 'id'>;
};

// Historial de versiones anteriores para compatibilidad
db.version(2).stores({
  events: '++id, date, participant, createdAt',
  series: '++id, eventId, seriesNumber',
});

db.version(3).stores({
  events: '++id, date, participant, createdAt',
  series: '++id, eventId, seriesNumber',
}).upgrade(async (tx) => {
  await tx.table('series').toCollection().modify((series) => {
    series.shots = [];
    series.totalScore = 0;
  });
});

// Versión 4: Esquema con múltiples competidores e inscripción/sorteo.
db.version(4).stores({
  events: '++id, date, createdAt',
  participants: '++id, eventId, competitorNumber',
  series: '++id, eventId, participantId, seriesNumber',
}).upgrade(async (tx) => {
  const events = await tx.table('events').toArray();
  for (const e of events) {
    const oldName = (e as any).participant || 'Tirador';
    const pId = await tx.table('participants').add({
      eventId: e.id!,
      name: oldName,
      competitorNumber: 1,
      tanda: 1,
      sector: 'A',
      spot: 1
    } as Participant);

    await tx.table('series')
      .where('eventId')
      .equals(e.id!)
      .modify((s: any) => {
        s.participantId = pId;
      });
  }
});

// Versión 5: Esquema con Padrón Maestro de Tiradores y nuevos campos de estado/pago/fecha.
db.version(5).stores({
  events: '++id, date, createdAt',
  participants: '++id, eventId, competitorNumber, status, paymentStatus',
  series: '++id, eventId, participantId, seriesNumber',
  masterCompetitors: '++id, &name, createdAt',
});

// Versión 6: Eliminar constraint UNIQUE de masterCompetitors.name para permitir
// migración robusta. La deduplicación se maneja a nivel de aplicación.
db.version(6).stores({
  events: '++id, date, createdAt',
  participants: '++id, eventId, competitorNumber, status, paymentStatus',
  series: '++id, eventId, participantId, seriesNumber',
  masterCompetitors: '++id, name, createdAt',
});

// Versión 7: Añadir championshipTieRank al padrón maestro para el ranking del campeonato.
db.version(7).stores({
  events: '++id, date, createdAt',
  participants: '++id, eventId, competitorNumber, status, paymentStatus',
  series: '++id, eventId, participantId, seriesNumber',
  masterCompetitors: '++id, name, championshipTieRank, createdAt',
});

// Versión 8: Soporte multi-modalidad (.22 LR, .308, .223).
// Agrega índice de modalidad a eventos. Migra eventos existentes a '.22 LR'.
db.version(8).stores({
  events: '++id, date, modality, createdAt',
  participants: '++id, eventId, competitorNumber, status, paymentStatus',
  series: '++id, eventId, participantId, seriesNumber',
  masterCompetitors: '++id, name, championshipTieRank, createdAt',
}).upgrade(async (tx) => {
  await tx.table('events').toCollection().modify((event: any) => {
    if (!event.modality) {
      event.modality = '.22 LR';
    }
  });
});

// ── IDs únicos entre dispositivos + marca de "cambios sin subir" ───────────
//
// Antes los IDs eran autoincrementales (1, 2, 3...). Dos tablets que creaban
// registros sin sincronizar generaban el mismo ID y, al subir, una pisaba a la
// otra en Supabase (el UUID de la nube se arma con el ID local).
// Ahora cada registro nuevo recibe un ID aleatorio grande (< 10^12, para que
// siga entrando en el UUID determinista de sync.ts).
//
// Además cada escritura local marca el registro con `_dirty = 1`. La subida
// (pushLocalDatabaseToCloud) solo envía lo marcado, y la descarga no pisa
// registros locales que todavía no se subieron. Las escrituras que hace la
// propia sincronización llevan `_syncRev` y no se marcan.

export const MIN_RANDOM_ID = 1_000_000_000;
export const MAX_RANDOM_ID = 999_999_999_999;

export function generateRecordId(): number {
  return MIN_RANDOM_ID + Math.floor(Math.random() * (MAX_RANDOM_ID - MIN_RANDOM_ID));
}

for (const table of [db.events, db.participants, db.series, db.masterCompetitors]) {
  table.hook('creating', function (primKey, obj: any) {
    if (!('_syncRev' in obj)) obj._dirty = 1;
    if (primKey === undefined || primKey === null) {
      obj.id = generateRecordId();
      return obj.id;
    }
    return undefined;
  });
  table.hook('updating', function (mods: any) {
    if ('_syncRev' in mods) return undefined;
    return { _dirty: 1 };
  });
}

export { db };
