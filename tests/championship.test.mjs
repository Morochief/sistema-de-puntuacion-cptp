// Tests del Campeonato General (lógica pura).
// Ejecutar con: npm test   (esbuild empaqueta este archivo junto con los .ts y node:test lo corre)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeChampionshipRankings,
  sortChampionshipRanking,
  normalizeName,
  resolveEventModality,
  sumParticipantSeries
} from '../src/lib/championshipCore.ts';
import {
  simulateChampionshipRankings,
  getMaxEventScore,
  isCentralFireModality,
  SIMULATED_EVENT_ID
} from '../src/lib/championshipSimulator.ts';

// ── Helpers de datos ────────────────────────────────────────────────────────
let nextId = 1;
const ev = (date, extra = {}) => ({ id: nextId++, name: `Fecha ${date}`, date, location: 'CPTP', createdAt: 0, ...extra });
const part = (eventId, name, extra = {}) => ({ id: nextId++, eventId, name, competitorNumber: 1, ...extra });
const ser = (p, seriesNumber, totalScore, createdAt = 0) => ({ id: nextId++, eventId: p.eventId, participantId: p.id, seriesNumber, shots: [], totalScore, createdAt });

function compute({ events, participants, series = [], masters = [], year = 2026, modality = '.22 LR', seasonOpen = true }) {
  return computeChampionshipRankings({ events, participants, series, masterCompetitors: masters, year, modality, seasonOpen });
}
const row = (rankings, name) => rankings.find(r => r.competitorName === name);

// ── Cálculo base ────────────────────────────────────────────────────────────
test('Top 2, Top 3 y Top Gun suman los 2, 3 y 4 mejores puntajes', () => {
  const evs = ['2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'].map(d => ev(d));
  const scores = [100, 120, 90, 130, 80];
  const parts = evs.map(e => part(e.id, 'Ana'));
  const series = parts.map((p, i) => ser(p, 1, scores[i]));
  const { rankings } = compute({ events: evs, participants: parts, series });
  const r = row(rankings, 'Ana');
  assert.equal(r.baseFirme, 130 + 120);
  assert.equal(r.totalActual, 130 + 120 + 100);
  assert.equal(r.mejores4, 130 + 120 + 100 + 90);
  assert.equal(r.events[evs[4].id].isDiscarded, true);
  assert.equal(r.events[evs[3].id].isBaseFirme, true);
});

test('suma las 2 series de .22 LR de cada fecha', () => {
  const e = ev('2026-03-01');
  const p = part(e.id, 'Ana');
  const { rankings } = compute({ events: [e], participants: [p], series: [ser(p, 1, 60), ser(p, 2, 55)] });
  assert.equal(row(rankings, 'Ana').totalActual, 115);
});

// ── Bug 3: DQ / DNS no reciben etiquetas ────────────────────────────────────
test('una fecha DQ o DNS vale 0 y no queda marcada como Top 2 / Top 3', () => {
  const [e1, e2, e3] = [ev('2026-03-01'), ev('2026-04-01'), ev('2026-05-01')];
  const p1 = part(e1.id, 'Ana');
  const p2 = part(e2.id, 'Ana', { status: 'dq' });
  const p3 = part(e3.id, 'Ana', { status: 'dns' });
  const { rankings } = compute({ events: [e1, e2, e3], participants: [p1, p2, p3], series: [ser(p1, 1, 100), ser(p2, 1, 120)] });
  const r = row(rankings, 'Ana');
  assert.equal(r.totalActual, 100, 'la serie del DQ no suma');
  for (const id of [e2.id, e3.id]) {
    const c = r.events[id];
    assert.equal(c.score, 0);
    assert.equal(c.isBaseFirme || c.isTaken || c.isAtRisk || c.isDiscarded, false);
  }
  assert.equal(r.events[e2.id].status, 'dq');
  assert.equal(r.events[e3.id].status, 'dns');
  assert.equal(r.events[e1.id].isBaseFirme, true);
});

// ── En Riesgo: mientras falten fechas ───────────────────────────────────────
test('el 3er puntaje está En Riesgo mientras falten fechas (temporada abierta)', () => {
  const evs = ['2026-03-01', '2026-04-01', '2026-05-01'].map(d => ev(d));
  const parts = evs.map(e => part(e.id, 'Ana'));
  const series = parts.map((p, i) => ser(p, 1, [100, 90, 80][i]));
  const open = row(compute({ events: evs, participants: parts, series, seasonOpen: true }).rankings, 'Ana');
  assert.equal(open.events[evs[2].id].isAtRisk, true, 'con 3 fechas y temporada abierta, el 3ro está en riesgo');
  const closed = row(compute({ events: evs, participants: parts, series, seasonOpen: false }).rankings, 'Ana');
  assert.equal(closed.events[evs[2].id].isAtRisk, false, 'con la temporada cerrada ya no hay riesgo');
  assert.equal(closed.events[evs[2].id].isTaken, true);
});

// ── Inconsistencias ─────────────────────────────────────────────────────────
test('series duplicadas (sincronización) no suman doble', () => {
  const p = { id: 1, eventId: 1 };
  assert.equal(sumParticipantSeries([ser(p, 1, 60, 1), ser(p, 1, 62, 2), ser(p, 2, 50, 1)]), 112);
});

test('agrupa nombres con tildes, mayúsculas y espacios dobles', () => {
  assert.equal(normalizeName('  José   PÉREZ '), 'jose perez');
  const [e1, e2] = [ev('2026-03-01'), ev('2026-04-01')];
  const p1 = part(e1.id, 'José Pérez');
  const p2 = part(e2.id, 'jose  perez');
  const { rankings } = compute({ events: [e1, e2], participants: [p1, p2], series: [ser(p1, 1, 100), ser(p2, 1, 90)] });
  assert.equal(rankings.length, 1);
  assert.equal(rankings[0].totalActual, 190);
});

test('modalidad: eventos viejos con ".308" en el nombre no cuentan para .22 LR', () => {
  assert.equal(resolveEventModality({ name: 'Fecha 1 .308', modality: '.22 LR' }), '.308');
  assert.equal(resolveEventModality({ name: 'Fecha 1' }), '.22 LR');
  const e22 = ev('2026-03-01');
  const e308 = ev('2026-03-02', { name: '1ª Fecha .308' });
  const p1 = part(e22.id, 'Ana');
  const p2 = part(e308.id, 'Ana');
  const series = [ser(p1, 1, 100), ser(p2, 1, 90)];
  assert.equal(row(compute({ events: [e22, e308], participants: [p1, p2], series }).rankings, 'Ana').totalActual, 100);
  assert.equal(row(compute({ events: [e22, e308], participants: [p1, p2], series, modality: '.308' }).rankings, 'Ana').totalActual, 90);
});

test('excluye eventos piloto, borrados y de otros años', () => {
  const ok = ev('2026-03-01');
  const pilot = ev('2026-04-01', { isPilot: true });
  const deleted = ev('2026-05-01', { is_deleted: true });
  const other = ev('2025-05-01');
  const ps = [ok, pilot, deleted, other].map(e => part(e.id, 'Ana'));
  const { allEvents, rankings } = compute({ events: [ok, pilot, deleted, other], participants: ps, series: ps.map(p => ser(p, 1, 50)) });
  assert.deepEqual(allEvents.map(e => e.id), [ok.id]);
  assert.equal(row(rankings, 'Ana').totalActual, 50);
});

test('categoría: toma la de la inscripción más reciente y si no, la del Padrón', () => {
  const [e1, e2] = [ev('2026-03-01'), ev('2026-04-01')];
  const ps = [part(e1.id, 'Ana', { category: 'Novato' }), part(e2.id, 'Ana', { category: 'Experto' })];
  assert.equal(compute({ events: [e1, e2], participants: [ps[1], ps[0]] }).rankings[0].category, 'Experto');
  const pb = part(e1.id, 'Beto');
  const r = compute({ events: [e1], participants: [pb], masters: [{ name: 'Beto', category: 'Senior', createdAt: 0 }] }).rankings[0];
  assert.equal(r.category, 'Senior');
});

test('orden: criterio elegido, el otro total, desempate manual y alfabético', () => {
  const rows = [
    { competitorName: 'B', category: '', events: {}, totalActual: 300, baseFirme: 200, mejores4: 350 },
    { competitorName: 'A', category: '', events: {}, totalActual: 300, baseFirme: 200, mejores4: 350 },
    { competitorName: 'C', category: '', events: {}, totalActual: 300, baseFirme: 210, mejores4: 340, tieRank: 5 },
    { competitorName: 'D', category: '', events: {}, totalActual: 300, baseFirme: 200, mejores4: 350, tieRank: 1 }
  ];
  assert.deepEqual(sortChampionshipRanking(rows, 'totalActual').map(r => r.competitorName), ['C', 'D', 'A', 'B']);
  assert.deepEqual(sortChampionshipRanking(rows, 'mejores4').map(r => r.competitorName), ['D', 'A', 'B', 'C']);
});

// ── Bug 2: máximos por modalidad ────────────────────────────────────────────
test('máximo por evento según la modalidad', () => {
  assert.equal(getMaxEventScore('.22 LR'), 134);
  assert.equal(getMaxEventScore('.308'), 96);
  assert.equal(getMaxEventScore('.223'), 96);
  assert.equal(getMaxEventScore('.308', false), 87);
  assert.equal(getMaxEventScore('21 Blackjack'), 147);
  assert.equal(isCentralFireModality('.308'), true);
  assert.equal(isCentralFireModality('.223'), true);
  assert.equal(isCentralFireModality('.22 LR'), false);
  assert.equal(isCentralFireModality('21 Blackjack'), false);
});

// ── Bug 4: simulador ────────────────────────────────────────────────────────
test('el simulador recalcula etiquetas, respeta DQ y no modifica los datos reales', () => {
  const [e1, e2, e3] = [ev('2026-03-01'), ev('2026-04-01'), ev('2026-05-01')];
  const a = [part(e1.id, 'Ana'), part(e2.id, 'Ana', { status: 'dq' }), part(e3.id, 'Ana')];
  const b = [part(e1.id, 'Beto'), part(e2.id, 'Beto'), part(e3.id, 'Beto')];
  const series = [ser(a[0], 1, 100), ser(a[2], 1, 90), ser(b[0], 1, 110), ser(b[1], 1, 100), ser(b[2], 1, 80)];
  const { rankings } = compute({ events: [e1, e2, e3], participants: [...a, ...b], series });
  const snapshot = JSON.stringify(rankings);

  const sim = simulateChampionshipRankings(rankings, new Map([['Ana', [{ eventId: SIMULATED_EVENT_ID, score: 134 }]]]), 'totalActual', true);
  const ana = row(sim, 'Ana');
  assert.equal(ana.totalActual, 134 + 100 + 90);
  assert.equal(ana.projectedRank, 1);
  assert.equal(ana.rankDelta, 1);
  const flagged = Object.values(ana.events).filter(c => c && c.isBaseFirme);
  assert.equal(flagged.length, 2, 'solo 2 celdas Base Firme');
  const dq = ana.events[e2.id];
  assert.equal(dq.status, 'dq');
  assert.equal(dq.isBaseFirme || dq.isTaken || dq.isAtRisk || dq.isDiscarded, false);
  assert.equal(ana.events[e3.id].isAtRisk, true);
  assert.equal(JSON.stringify(rankings), snapshot, 'los datos reales no cambian');
});
