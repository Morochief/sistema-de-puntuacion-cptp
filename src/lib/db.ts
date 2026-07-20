import Dexie, { type EntityTable } from 'dexie';
import type { ShootingEvent, Participant, Series } from './types';

const db = new Dexie('cptpScoring') as Dexie & {
  events: EntityTable<ShootingEvent, 'id'>;
  participants: EntityTable<Participant, 'id'>;
  series: EntityTable<Series, 'id'>;
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
// Migra el participante único anterior como "Competidor #1" del evento y vincula sus series.
db.version(4).stores({
  events: '++id, date, createdAt',
  participants: '++id, eventId, competitorNumber',
  series: '++id, eventId, participantId, seriesNumber',
}).upgrade(async (tx) => {
  const events = await tx.table('events').toArray();
  for (const e of events) {
    const oldName = (e as any).participant || 'Tirador';
    // Crear participante único v4
    const pId = await tx.table('participants').add({
      eventId: e.id!,
      name: oldName,
      competitorNumber: 1,
      tanda: 1,
      sector: 'A',
      spot: 1
    } as Participant);

    // Actualizar series de este evento para apuntar al participante
    await tx.table('series')
      .where('eventId')
      .equals(e.id!)
      .modify((s: any) => {
        s.participantId = pId;
      });
  }
});

export { db };
