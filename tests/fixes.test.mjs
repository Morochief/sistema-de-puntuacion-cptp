// Tests de los arreglos de la auditoría (respaldos, sincronización, Padrón).
// Usa fake-indexeddb para correr Dexie en Node y un Supabase falso en memoria.
import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, MIN_RANDOM_ID, MAX_RANDOM_ID } from '../src/lib/db.ts';
import { supabase } from '../src/lib/supabase.ts';
import {
  pushLocalDatabaseToCloud,
  pullCloudDatabaseToLocal,
  countPendingChanges,
  toDeterministicUuid,
  nextSyncRev
} from '../src/lib/sync.ts';
import { FullBackupZodSchema, SingleEventBackupZodSchema } from '../src/lib/backup.ts';
import { normalizeName, nameKey } from '../src/lib/masterCompetitors.ts';

// ── Supabase falso (tablas en memoria) ──────────────────────────────────────
const cloud = { events: new Map(), participants: new Map(), series: new Map(), master_competitors: new Map() };
const upserts = [];
supabase.from = (table) => ({
  async upsert(rows) {
    upserts.push({ table, ids: rows.map(r => r.id) });
    for (const r of rows) cloud[table].set(r.id, { ...cloud[table].get(r.id), ...r });
    return { error: null };
  },
  async select() { return { data: [...cloud[table].values()], error: null }; },
  update(changes) {
    return { async in(_col, ids) { for (const id of ids) cloud[table].set(id, { ...cloud[table].get(id), ...changes }); return { error: null }; } };
  }
});

beforeEach(async () => {
  await Promise.all([db.events.clear(), db.participants.clear(), db.series.clear(), db.masterCompetitors.clear()]);
  for (const t of Object.values(cloud)) t.clear();
  upserts.length = 0;
});

const shot = (n, hit, value, targetType = '15"') => ({ shotNumber: n, targetType, hit, value });

// ── Respaldos ───────────────────────────────────────────────────────────────
test('respaldo completo real (disparos como objetos, DQ/DNS, exento) es válido', () => {
  const backup = {
    version: 1, type: 'full_cptp_database_backup', exportedAt: '2026-07-30T00:00:00Z',
    events: [{ id: 1, name: 'Fecha 1', date: '2026-07-25', modality: '.22 LR', createdAt: 1 }],
    participants: [
      { id: 10, eventId: 1, name: 'A', competitorNumber: 1, status: 'dns', paymentStatus: 'exempt', tieRank: 2 },
      { id: 11, eventId: 1, name: 'B', competitorNumber: 2, status: 'dq', paymentStatus: 'paid' }
    ],
    series: [{ id: 20, eventId: 1, participantId: 10, seriesNumber: 1, shots: [shot(1, true, 10)], totalScore: 10, createdAt: 1 }],
    masterCompetitors: [{ id: 30, name: 'A', category: 'Senior', phone: '0981', createdAt: 1 }]
  };
  const r = FullBackupZodSchema.safeParse(backup);
  assert.ok(r.success, JSON.stringify(r.error?.issues?.slice(0, 3)));
  assert.equal(r.data.series[0].shots[0].hit, true);
  assert.equal(r.data.participants[0].status, 'dns');
  assert.equal(r.data.masterCompetitors[0].category, 'Senior');
  assert.equal(r.data.masterCompetitors[0].phone, '0981');
});

test('respaldo con estados de nombre viejo se convierte a dq/dns', () => {
  const r = SingleEventBackupZodSchema.safeParse({
    version: 1, exportedAt: 'x',
    event: { name: 'E', date: '2026-01-01' },
    participants: [
      { eventId: 1, name: 'A', competitorNumber: 1, status: 'disqualified' },
      { eventId: 1, name: 'B', competitorNumber: 2, status: 'withdrawn' }
    ],
    series: []
  });
  assert.ok(r.success);
  assert.deepEqual(r.data.participants.map(p => p.status), ['dq', 'dns']);
});

// ── IDs y marca de cambios ──────────────────────────────────────────────────
test('los registros nuevos reciben un ID aleatorio grande y quedan pendientes de subir', async () => {
  const a = await db.events.add({ name: 'E1', date: '2026-01-01', location: '', createdAt: 1 });
  const b = await db.events.add({ name: 'E2', date: '2026-01-01', location: '', createdAt: 1 });
  assert.ok(a >= MIN_RANDOM_ID && a <= MAX_RANDOM_ID, `id ${a}`);
  assert.notEqual(a, b);
  assert.equal((await db.events.get(a))._dirty, 1);
  // Cabe en el UUID determinista y vuelve al mismo número
  assert.match(toDeterministicUuid(a, 0), /^00000000-0000-4000-0000-\d{12}$/);
});

test('editar un registro lo marca como pendiente; las escrituras de la sincronización no', async () => {
  const id = await db.series.add({ eventId: 1, participantId: 2, seriesNumber: 1, shots: [], totalScore: 0, createdAt: 1 });
  await db.series.update(id, { _dirty: 0, _syncRev: nextSyncRev() });
  assert.equal((await db.series.get(id))._dirty, 0);
  await db.series.update(id, { totalScore: 10 });
  assert.equal((await db.series.get(id))._dirty, 1);
});

// ── Sincronización ──────────────────────────────────────────────────────────
test('subir envía solo los cambios pendientes y después los marca como subidos', async () => {
  const ev = await db.events.add({ name: 'E', date: '2026-01-01', location: '', createdAt: 1 });
  const res1 = await pushLocalDatabaseToCloud();
  assert.ok(res1.success);
  assert.equal(res1.eventsSynced, 1);
  assert.equal(await countPendingChanges(), 0);

  // Sin cambios: no se sube nada
  upserts.length = 0;
  const res2 = await pushLocalDatabaseToCloud();
  assert.equal(res2.eventsSynced, 0);
  assert.equal(upserts.length, 0);

  // Un cambio: se sube solo ese registro
  await db.events.update(ev, { name: 'E editado' });
  const res3 = await pushLocalDatabaseToCloud();
  assert.equal(res3.eventsSynced, 1);
  assert.equal(cloud.events.get(toDeterministicUuid(ev, 0)).name, 'E editado');
});

test('dos dispositivos: subir datos viejos ya no pisa lo que cargó el otro', async () => {
  // El dispositivo baja una serie desde la nube (queda "limpia")
  const sid = toDeterministicUuid(5, 2);
  cloud.series.set(sid, { id: sid, event_id: toDeterministicUuid(1, 0), participant_id: toDeterministicUuid(2, 1), series_number: 1, shots: [], total_score: 0, created_at: new Date(1).toISOString(), is_deleted: false });
  await pullCloudDatabaseToLocal();
  // Otro dispositivo carga puntaje en la nube
  cloud.series.set(sid, { ...cloud.series.get(sid), total_score: 55, shots: [shot(1, true, 10)] });
  // Este dispositivo sube (sin haber tocado esa serie): no debe reenviar su copia vieja
  await db.events.add({ name: 'Otro evento', date: '2026-01-01', location: '', createdAt: 1 });
  await pushLocalDatabaseToCloud();
  assert.equal(cloud.series.get(sid).total_score, 55);
});

test('bajar de la nube no pisa cambios locales sin subir (salvo espectadores)', async () => {
  const pid = toDeterministicUuid(7, 1);
  cloud.participants.set(pid, { id: pid, event_id: toDeterministicUuid(1, 0), name: 'Nube', competitor_number: 1, is_deleted: false });
  await pullCloudDatabaseToLocal();
  await db.participants.update(7, { name: 'Local sin subir' });

  await pullCloudDatabaseToLocal();
  assert.equal((await db.participants.get(7)).name, 'Local sin subir');

  await pullCloudDatabaseToLocal({ keepLocalChanges: false });
  assert.equal((await db.participants.get(7)).name, 'Nube');
});

test('bajar de la nube conserva categoría y teléfono del Padrón y el rifle compartido', async () => {
  await db.masterCompetitors.put({ id: 9, name: 'Juan Perez', category: 'Senior', phone: '0981', createdAt: 1, _dirty: 0, _syncRev: 1 });
  await db.participants.put({ id: 8, eventId: 1, name: 'Juan Perez', competitorNumber: 1, sharedRifleId: 'Rifle A', _dirty: 0, _syncRev: 1 });
  const mid = toDeterministicUuid(9, 3);
  cloud.master_competitors.set(mid, { id: mid, name: 'Juan Perez', championship_tie_rank: 2, created_at: new Date(1).toISOString(), is_deleted: false });
  const pid = toDeterministicUuid(8, 1);
  cloud.participants.set(pid, { id: pid, event_id: toDeterministicUuid(1, 0), name: 'Juan Perez', competitor_number: 1, is_deleted: false });
  await pullCloudDatabaseToLocal();
  const m = await db.masterCompetitors.get(9);
  assert.equal(m.category, 'Senior');
  assert.equal(m.phone, '0981');
  assert.equal(m.championshipTieRank, 2);
  assert.equal((await db.participants.get(8)).sharedRifleId, 'Rifle A');
});

// ── Nombres del Padrón ──────────────────────────────────────────────────────
test('normalizeName conserva la ñ y nameKey compara sin acentos', () => {
  assert.equal(normalizeName('josé muñoz'), 'Jose Muñoz');
  assert.equal(normalizeName('ñandú peña'), 'Ñandu Peña');
  assert.equal(nameKey('Muñoz'), nameKey('MUNOZ'));
});
