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

export { db };
